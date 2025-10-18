/**
 * Portfolio-Based Capital Management (Spec 28)
 *
 * Runs DCA backtest for multiple stocks with shared capital pool.
 * Key features:
 * - Capital constraint enforcement (never exceed total capital)
 * - Rejected order logging (when insufficient capital)
 * - Portfolio-level and per-stock metrics
 * - Time-series capital utilization tracking
 */

const dcaBacktestService = require('./dcaBacktestService');
const dcaSignalEngine = require('./dcaSignalEngine');
const { createDCAExecutor } = require('./dcaExecutor');
const database = require('../database');

/**
 * Portfolio State - Tracks shared capital pool and all stocks
 */
class PortfolioState {
  constructor(config) {
    this.totalCapital = config.totalCapital;
    this.cashReserve = config.totalCapital;  // Starts at total
    this.deployedCapital = 0;                // Starts at 0

    this.stocks = new Map();  // symbol -> StockState
    this.rejectedOrders = [];
    this.capitalFlowHistory = [];
    this.valuationHistory = [];

    this.config = config;
  }

  get availableCapital() {
    return this.cashReserve;
  }

  get portfolioValue() {
    let total = this.cashReserve;
    for (const stock of this.stocks.values()) {
      total += stock.marketValue;
    }
    return total;
  }

  get totalPNL() {
    return this.portfolioValue - this.totalCapital;
  }

  get utilizationPercent() {
    return (this.deployedCapital / this.totalCapital) * 100;
  }

  /**
   * Validate capital constraints
   * @throws Error if constraints violated
   */
  validateCapitalConstraints() {
    // deployed + cash can exceed total due to profits, but should never be less
    const calculated = this.deployedCapital + this.cashReserve;
    const expected = this.totalCapital;

    // Allow for profits (calculated >= expected), but check for capital leaks (calculated < expected)
    if (calculated < expected - 0.01) {
      throw new Error(
        `Capital constraint violated (capital leaked): ` +
        `deployed(${this.deployedCapital.toFixed(2)}) + ` +
        `cash(${this.cashReserve.toFixed(2)}) = ${calculated.toFixed(2)}, ` +
        `expected at least ${expected.toFixed(2)}`
      );
    }

    // Also validate that cash reserve is never negative
    if (this.cashReserve < -0.01) {
      throw new Error(
        `Capital constraint violated (negative cash): ` +
        `cashReserve = ${this.cashReserve.toFixed(2)}`
      );
    }
  }
}

/**
 * Stock State - Tracks individual stock holdings and transactions
 */
class StockState {
  constructor(symbol, params) {
    this.symbol = symbol;
    this.params = params;

    // Holdings
    this.lots = [];
    this.lotsHeld = 0;
    this.averageCost = 0;

    // Capital
    this.capitalDeployed = 0;
    this.maxCapitalDeployed = 0;  // Track maximum capital deployed for return % calculation
    this.marketValue = 0;

    // P&L
    this.unrealizedPNL = 0;
    this.realizedPNL = 0;
    this.totalPNL = 0;

    // Activity
    this.transactions = [];
    this.rejectedBuys = 0;
    this.rejectedBuyValues = 0;
    this.rejectedOrders = [];  // NEW: Detailed rejected order tracking

    // DCA state variables (mirrored from dcaBacktestService)
    this.dcaState = {
      lastBuyPrice: null,
      lastSellPrice: null,
      consecutiveBuyCount: 0,
      consecutiveSellCount: 0,
      trailingStopBuy: null,
      activeStop: null,
      peak: null,
      bottom: null,
      lastBuyRebound: null,
      lastBuyDirection: null,
      lastSellPullback: null,
      lastSellDirection: null,
      referencePrice: null
    };
  }

  /**
   * Update market value based on current price
   */
  updateMarketValue(currentPrice) {
    this.marketValue = this.lots.reduce((sum, lot) => {
      return sum + (lot.shares * currentPrice);
    }, 0);

    this.unrealizedPNL = this.marketValue - this.capitalDeployed;
    this.totalPNL = this.realizedPNL + this.unrealizedPNL;
  }

  /**
   * Add a buy transaction
   */
  addBuy(transaction) {
    this.lots.push({
      price: transaction.price,
      shares: transaction.shares,
      date: transaction.date
    });

    this.lotsHeld = this.lots.length;

    // Calculate value if not provided (avoid NaN from undefined)
    const transactionValue = transaction.value !== undefined ? transaction.value : (transaction.price * transaction.shares);
    this.capitalDeployed += transactionValue;

    // Track maximum capital deployed
    if (this.capitalDeployed > this.maxCapitalDeployed) {
      this.maxCapitalDeployed = this.capitalDeployed;
    }

    // Update average cost
    const totalShares = this.lots.reduce((sum, lot) => sum + lot.shares, 0);
    const totalCost = this.lots.reduce((sum, lot) => sum + (lot.price * lot.shares), 0);
    this.averageCost = totalShares > 0 ? totalCost / totalShares : 0;

    this.transactions.push(transaction);
  }

  /**
   * Add a sell transaction
   */
  addSell(transaction) {
    // Remove sold lots
    if (transaction.lotsDetails && Array.isArray(transaction.lotsDetails)) {
      for (const soldLot of transaction.lotsDetails) {
        const index = this.lots.findIndex(lot =>
          Math.abs(lot.price - soldLot.price) < 0.01 && lot.date === soldLot.date
        );
        if (index !== -1) {
          this.lots.splice(index, 1);
        }
      }
    }

    this.lotsHeld = this.lots.length;

    // Calculate lotsCost if not provided (avoid NaN from undefined)
    const lotsCost = transaction.lotsCost !== undefined ? transaction.lotsCost : 0;
    this.capitalDeployed -= lotsCost;

    const realizedPNL = transaction.realizedPNLFromTrade !== undefined ? transaction.realizedPNLFromTrade : 0;
    this.realizedPNL += realizedPNL;

    // Update average cost
    const totalShares = this.lots.reduce((sum, lot) => sum + lot.shares, 0);
    const totalCost = this.lots.reduce((sum, lot) => sum + (lot.price * lot.shares), 0);
    this.averageCost = totalShares > 0 ? totalCost / totalShares : 0;

    this.transactions.push(transaction);
  }
}

/**
 * Main portfolio backtest function
 *
 * @param {Object} config - Portfolio configuration
 * @param {number} config.totalCapital - Total capital for portfolio (e.g., 500000)
 * @param {string} config.startDate - Start date (YYYY-MM-DD)
 * @param {string} config.endDate - End date (YYYY-MM-DD)
 * @param {number} config.lotSizeUsd - Lot size in USD (e.g., 10000)
 * @param {number} config.maxLotsPerStock - Max lots any stock can hold (e.g., 10)
 * @param {Object} config.defaultParams - Default DCA parameters for all stocks
 * @param {Array} config.stocks - Array of {symbol, params} objects
 * @returns {Object} Portfolio backtest results
 */
async function runPortfolioBacktest(config) {
  console.log('🎯 Starting Portfolio Backtest');
  console.log(`   Total Capital: $${config.totalCapital.toLocaleString()}`);
  console.log(`   Lot Size: $${config.lotSizeUsd.toLocaleString()}`);
  console.log(`   Stocks: ${config.stocks.length}`);
  console.log(`   Date Range: ${config.startDate} to ${config.endDate}`);

  // 1. Initialize portfolio state
  const portfolio = new PortfolioState(config);

  // 2. Load price data for all stocks
  console.log('📡 Loading price data for all stocks...');
  const priceDataMap = await loadAllPriceData(config.stocks, config.startDate, config.endDate);

  // 3. Initialize executors and stock states for each stock
  const executors = new Map();
  const executorDayIndices = new Map();  // Track each executor's current day index

  for (const stockConfig of config.stocks) {
    // Handle both string symbols and object configs
    const symbol = typeof stockConfig === 'string' ? stockConfig : stockConfig.symbol;
    const stockParams = typeof stockConfig === 'string' ? {} : stockConfig.params || {};

    const params = {
      ...config.defaultParams,
      ...stockParams,
      maxLots: config.maxLotsPerStock,  // Add maxLots constraint from portfolio config
      lotSizeUsd: config.lotSizeUsd     // Ensure lot size is passed
    };

    // Get price data as array for this stock
    const dateMap = priceDataMap.get(symbol);
    const pricesArray = Array.from(dateMap.values());

    // Create DCA executor for this stock
    const executor = createDCAExecutor(
      symbol,
      params,
      pricesArray,
      false,  // verbose
      null    // adaptiveStrategy
    );

    executors.set(symbol, executor);
    executorDayIndices.set(symbol, 0);  // Start at day 0

    // Still create stock state for portfolio tracking
    portfolio.stocks.set(symbol, new StockState(symbol, params));
  }

  // 4. Get all unique dates (union of all stock dates)
  const allDates = getAllUniqueDates(priceDataMap);
  console.log(`📅 Simulating ${allDates.length} trading days...`);

  // 5. Simulate chronologically using executors
  let transactionCount = 0;
  let rejectedCount = 0;

  for (let i = 0; i < allDates.length; i++) {
    const date = allDates[i];

    // Process each stock using its executor
    const sortedSymbols = Array.from(portfolio.stocks.keys()).sort();

    for (const symbol of sortedSymbols) {
      const executor = executors.get(symbol);
      const stock = portfolio.stocks.get(symbol);
      const dayData = priceDataMap.get(symbol).get(date);

      if (!dayData) continue;

      // Get the current day index for this executor
      const dayIndex = executorDayIndices.get(symbol);

      // Determine if buy is enabled based on capital availability
      const hasCapital = portfolio.cashReserve >= config.lotSizeUsd;

      // Get transaction count before processing
      const stateBefore = executor.getState();
      const txCountBefore = stateBefore.enhancedTransactions.length;

      // Process one day using executor with correct day index
      await executor.processDay(dayData, dayIndex, { buyEnabled: hasCapital });

      // Increment day index for this executor
      executorDayIndices.set(symbol, dayIndex + 1);

      // Get state again after processing (state is updated by reference)
      const stateAfter = executor.getState();
      const txCountAfter = stateAfter.enhancedTransactions.length;

      if (i % 100 === 0 && txCountAfter > 0) {
        console.log(`📊 DEBUG Day ${i}: txCountBefore=${txCountBefore}, txCountAfter=${txCountAfter}, hasCapital=${hasCapital}`);
      }

      // Check if a new transaction occurred
      if (txCountAfter > txCountBefore) {
        // Get the latest transaction
        const tx = stateAfter.enhancedTransactions[txCountAfter - 1];

        if (tx.type.includes('BUY')) {
          if (hasCapital) {
            // Execute buy: deduct from capital pool
            portfolio.cashReserve -= tx.value;
            portfolio.deployedCapital += tx.value;
            stock.addBuy(tx);
            transactionCount++;
          } else {
            // Rejected due to insufficient capital
            logRejectedOrder(portfolio, stock, { triggered: true }, dayData, date);
            rejectedCount++;
          }
        } else {
          // SELL or other transaction types
          // Add full sell value to cash (includes both original cost and profit/loss)
          portfolio.cashReserve += tx.value;
          // Reduce deployed capital by original cost
          portfolio.deployedCapital -= tx.lotsCost;
          stock.addSell(tx);
          transactionCount++;
        }
      }

      // Update market value
      stock.updateMarketValue(dayData.close);
    }

    // Validate capital constraints after every date
    portfolio.validateCapitalConstraints();

    // Snapshot portfolio state
    if (i % 30 === 0 || i === allDates.length - 1) {  // Every 30 days or last day
      portfolio.valuationHistory.push(createSnapshot(portfolio, date));
    }

    // Progress logging
    if (i > 0 && i % 100 === 0) {
      const progress = ((i / allDates.length) * 100).toFixed(1);
      console.log(`   Progress: ${progress}% (${i}/${allDates.length} days) - Transactions: ${transactionCount}, Rejected: ${rejectedCount}`);
    }
  }

  console.log('✅ Portfolio Backtest Complete');
  console.log(`   Total Transactions: ${transactionCount}`);
  console.log(`   Rejected Orders: ${rejectedCount}`);
  console.log(`   Final Portfolio Value: $${portfolio.portfolioValue.toLocaleString()}`);
  console.log(`   Total Return: $${portfolio.totalPNL.toLocaleString()} (${((portfolio.totalPNL / portfolio.totalCapital) * 100).toFixed(2)}%)`);

  // 6. Calculate final metrics
  const portfolioMetricsService = require('./portfolioMetricsService');
  const results = portfolioMetricsService.calculatePortfolioMetrics(portfolio, config, priceDataMap);

  // 7. Calculate Buy & Hold comparison
  const portfolioBuyAndHoldService = require('./portfolioBuyAndHoldService');
  const buyAndHoldResults = portfolioBuyAndHoldService.calculatePortfolioBuyAndHold(
    priceDataMap,
    config,
    { portfolioSummary: results.portfolioSummary, stockResults: results.stockResults }
  );

  // Add Buy & Hold results to response
  if (buyAndHoldResults) {
    results.buyAndHoldSummary = buyAndHoldResults.buyAndHoldSummary;
    results.comparison = buyAndHoldResults.comparison;
  }

  return results;
}

/**
 * Load price data for all stocks in parallel
 */
async function loadAllPriceData(stocks, startDate, endDate) {
  const priceDataMap = new Map();

  const pricePromises = stocks.map(async (stockConfig) => {
    // Handle both string symbols and object configs
    const symbol = typeof stockConfig === 'string' ? stockConfig : stockConfig.symbol;

    // 1. Get or create Stock ID (using existing pattern from dcaBacktestService)
    let stock = await database.getStock(symbol);
    if (!stock) {
      console.log(`🆕 Creating new stock record for portfolio backtest: ${symbol}`);
      try {
        const stockDataService = require('./stockDataService');
        const stockId = await database.createStock(symbol);
        stock = await database.getStock(symbol);

        // Fetch data for new stock
        console.log(`📡 Fetching initial data for ${symbol}...`);
        await stockDataService.updateStockData(stock.id, symbol, {
          updatePrices: true,
          updateFundamentals: true,
          updateCorporateActions: true
        });
        await database.updateStockTimestamp(stock.id);
      } catch (fetchError) {
        throw new Error(`Stock symbol ${symbol} not found and could not fetch data: ${fetchError.message}`);
      }
    }

    // 2. Check for data gaps and fetch missing data
    const latestPriceDate = await database.getLastPriceDate(stock.id);
    if (latestPriceDate) {
      const latestDate = new Date(latestPriceDate);
      const requestedEndDate = new Date(endDate);

      if (latestDate < requestedEndDate) {
        const nextDay = new Date(latestDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const fromDate = nextDay.toISOString().split('T')[0];

        console.log(`📡 Data gap detected for ${symbol}: database has ${latestPriceDate}, fetching until ${endDate}...`);

        try {
          const stockDataService = require('./stockDataService');
          await stockDataService.updateStockData(stock.id, symbol, {
            updatePrices: true,
            fromDate: fromDate,
            updateFundamentals: false,
            updateCorporateActions: false
          });
          console.log(`✅ Gap filled for ${symbol}`);
        } catch (fetchError) {
          console.warn(`⚠️  Failed to fetch missing data for ${symbol}: ${fetchError.message}`);
          console.warn(`   Proceeding with available data (until ${latestPriceDate})`);
        }
      }
    }

    const prices = await database.getPricesWithIndicators(stock.id, startDate, endDate);

    // Convert to Map(date -> data) for fast lookup
    const dateMap = new Map();
    for (const priceData of prices) {
      dateMap.set(priceData.date, priceData);
    }

    return { symbol, dateMap };
  });

  const results = await Promise.all(pricePromises);

  for (const { symbol, dateMap } of results) {
    priceDataMap.set(symbol, dateMap);
  }

  return priceDataMap;
}

/**
 * Get all unique dates from all stocks (union)
 */
function getAllUniqueDates(priceDataMap) {
  const dateSet = new Set();

  for (const dateMap of priceDataMap.values()) {
    for (const date of dateMap.keys()) {
      dateSet.add(date);
    }
  }

  return Array.from(dateSet).sort();
}

/**
 * Process sell orders for all stocks on a given date
 */
async function processSells(portfolio, date, priceDataMap) {
  let executed = 0;

  // Process stocks in alphabetical order (deterministic)
  const sortedSymbols = Array.from(portfolio.stocks.keys()).sort();

  for (const symbol of sortedSymbols) {
    const stock = portfolio.stocks.get(symbol);
    const dayData = priceDataMap.get(symbol).get(date);

    if (!dayData) continue;

    // Check if stock triggers sell signal
    const sellSignal = evaluateSellSignal(stock, dayData, date);

    if (sellSignal.triggered) {
      const sellTransaction = executeSell(stock, sellSignal, dayData, date);

      if (sellTransaction) {
        // Return capital to pool
        // Add full sell value to cash (includes both original cost and profit/loss)
        portfolio.cashReserve += sellTransaction.value;
        // Reduce deployed capital by original cost
        portfolio.deployedCapital -= sellTransaction.lotsCost;

        stock.addSell(sellTransaction);
        executed++;
      }
    }
  }

  return { executed };
}

/**
 * Process buy orders for all stocks on a given date
 */
async function processBuys(portfolio, date, priceDataMap) {
  let executed = 0;
  let rejected = 0;

  // Process stocks in alphabetical order (deterministic)
  const sortedSymbols = Array.from(portfolio.stocks.keys()).sort();

  for (const symbol of sortedSymbols) {
    const stock = portfolio.stocks.get(symbol);
    const dayData = priceDataMap.get(symbol).get(date);

    if (!dayData) continue;

    // Check if stock triggers buy signal
    const buySignal = evaluateBuySignal(stock, dayData, date);

    if (buySignal.triggered) {
      // Check capital availability
      if (portfolio.cashReserve >= portfolio.config.lotSizeUsd) {
        const buyTransaction = executeBuy(stock, buySignal, dayData, date, portfolio.config.lotSizeUsd);

        if (buyTransaction) {
          // Deduct from capital pool
          portfolio.cashReserve -= portfolio.config.lotSizeUsd;
          portfolio.deployedCapital += portfolio.config.lotSizeUsd;

          stock.addBuy(buyTransaction);
          executed++;
        }
      } else {
        // Rejected due to insufficient capital
        logRejectedOrder(portfolio, stock, buySignal, dayData, date);
        rejected++;
      }
    }
  }

  return { executed, rejected };
}

/**
 * Evaluate if stock should sell (uses DCA signal engine)
 */
function evaluateSellSignal(stock, dayData, date) {
  // Prepare state for signal engine
  const state = {
    lots: stock.lots,
    dcaState: stock.dcaState,
    consecutiveSells: stock.consecutiveSells || 0
  };

  // Use signal engine to evaluate sell signal
  const signal = dcaSignalEngine.evaluateSellSignal(state, stock.params, dayData.close, {});

  // Update peak tracking if price is rising
  if (stock.dcaState.peak && dayData.close > stock.dcaState.peak) {
    stock.dcaState.peak = dayData.close;
  }

  return signal;
}

/**
 * Evaluate if stock should buy (uses DCA signal engine)
 */
function evaluateBuySignal(stock, dayData, date) {
  // Prepare state for signal engine
  const state = {
    lots: stock.lots,
    dcaState: stock.dcaState,
    consecutiveBuys: stock.consecutiveBuys || 0
  };

  // Use signal engine to evaluate buy signal
  const signal = dcaSignalEngine.evaluateBuySignal(state, stock.params, dayData.close, {});

  // Update bottom tracker if price is falling
  if (!stock.dcaState.bottom || dayData.close < stock.dcaState.bottom) {
    stock.dcaState.bottom = dayData.close;
  }

  return signal;
}

/**
 * Execute sell transaction
 */
function executeSell(stock, signal, dayData, date) {
  if (stock.lots.length === 0) return null;

  // Get lot to sell from signal (signal engine selected it)
  const lotsToSell = signal.lotsToSell || [];
  if (lotsToSell.length === 0) {
    // Fallback: select highest-priced lot (LIFO)
    const sortedLots = [...stock.lots].sort((a, b) => b.price - a.price);
    lotsToSell.push(sortedLots[0]);
  }

  const lotToSell = lotsToSell[0];

  const sellValue = lotToSell.shares * dayData.close;
  const lotCost = lotToSell.shares * lotToSell.price;
  const realizedPNL = sellValue - lotCost;

  // Clear trailing stop
  stock.dcaState.activeStop = null;
  stock.dcaState.lastSellPrice = dayData.close;

  return {
    date,
    type: signal.type || 'SELL',
    price: dayData.close,
    shares: lotToSell.shares,
    value: sellValue,
    lotsCost: lotCost,
    lotsDetails: [lotToSell],
    realizedPNLFromTrade: realizedPNL
  };
}

/**
 * Execute buy transaction
 */
function executeBuy(stock, signal, dayData, date, lotSizeUsd) {
  const shares = lotSizeUsd / dayData.close;

  // Update DCA state
  stock.dcaState.trailingStopBuy = null;
  stock.dcaState.lastBuyPrice = dayData.close;
  stock.dcaState.consecutiveBuyCount++;

  return {
    date,
    type: 'BUY',
    price: dayData.close,
    shares,
    value: lotSizeUsd
  };
}

/**
 * Log rejected buy order
 */
function logRejectedOrder(portfolio, stock, signal, dayData, date) {
  const shortfall = portfolio.config.lotSizeUsd - portfolio.cashReserve;

  // Identify which stocks are holding capital
  const competingStocks = [];
  for (const [symbol, stockState] of portfolio.stocks) {
    if (symbol !== stock.symbol && stockState.capitalDeployed > 0) {
      competingStocks.push({
        symbol,
        capitalDeployed: stockState.capitalDeployed,
        lotsHeld: stockState.lotsHeld
      });
    }
  }

  const rejectedOrder = {
    date,
    symbol: stock.symbol,
    orderType: 'BUY',
    price: dayData.close,
    lotSize: portfolio.config.lotSizeUsd,
    attemptedValue: portfolio.config.lotSizeUsd,  // NEW: For frontend compatibility
    reason: 'INSUFFICIENT_CAPITAL',
    availableCapital: portfolio.cashReserve,
    requiredCapital: portfolio.config.lotSizeUsd,
    shortfall,
    competingStocks: competingStocks.map(s => s.symbol),  // NEW: List of competing symbols
    portfolioState: {
      deployedCapital: portfolio.deployedCapital,
      cashReserve: portfolio.cashReserve,
      utilizationPercent: portfolio.utilizationPercent
    }
  };

  portfolio.rejectedOrders.push(rejectedOrder);
  stock.rejectedBuys++;
  stock.rejectedBuyValues += portfolio.config.lotSizeUsd;
  stock.rejectedOrders.push(rejectedOrder);  // NEW: Also add to stock's rejected orders
}

/**
 * Create portfolio snapshot
 */
function createSnapshot(portfolio, date) {
  return {
    date,
    totalCapital: portfolio.totalCapital,
    deployedCapital: portfolio.deployedCapital,
    cashReserve: portfolio.cashReserve,
    utilizationPercent: portfolio.utilizationPercent,
    portfolioValue: portfolio.portfolioValue,
    totalPNL: portfolio.totalPNL,
    totalPNLPercent: (portfolio.totalPNL / portfolio.totalCapital) * 100
  };
}

module.exports = {
  runPortfolioBacktest,
  PortfolioState,
  StockState
};
