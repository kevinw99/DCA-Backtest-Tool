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
const { createDCAExecutor, calculatePositionPnL } = require('./dcaExecutor');
const database = require('../database');
const IndexTrackingService = require('./indexTrackingService');
const CapitalOptimizerService = require('./capitalOptimizerService');

/**
 * Portfolio State - Tracks shared capital pool and all stocks
 */
class PortfolioState {
  constructor(config) {
    this.totalCapital = config.totalCapital;
    this.cashReserve = config.totalCapital;  // Starts at total
    this.deployedCapital = 0;                // Starts at 0

    // Spec 50: Margin support
    this.marginPercent = config.marginPercent || 0;
    this.effectiveCapital = this.totalCapital * (1 + this.marginPercent / 100);

    // Spec 50: Margin metrics tracking
    this.marginMetrics = {
      maxMarginUtilization: 0,      // Peak margin usage (%)
      daysOnMargin: 0,               // Days when deployed > base
      totalMarginUtilization: 0,     // Sum for average calc
      daysTracked: 0                 // Total days
    };

    this.stocks = new Map();  // symbol -> StockState
    this.rejectedOrders = [];
    this.deferredSells = [];  // Track deferred sell orders
    this.capitalFlowHistory = [];
    this.valuationHistory = [];

    // Capital leak detection - track all capital changes
    this.totalRealizedPNL = 0;  // Sum of all realized profits/losses from trades
    this.totalCashYield = 0;    // Sum of all cash yield revenue

    // Spec 61: Capital tracking for optimized capital discovery
    this.capitalTracking = {
      maxDeployed: 0,
      maxDeployedDate: null,
      totalDeployedDays: 0,
      sumDeployed: 0
    };

    this.config = config;
  }

  /**
   * Spec 61: Track capital usage for optimized capital discovery
   * Called once per day after all transactions are processed
   */
  trackCapitalUsage(date) {
    const currentDeployed = this.deployedCapital;

    if (currentDeployed > this.capitalTracking.maxDeployed) {
      this.capitalTracking.maxDeployed = currentDeployed;
      this.capitalTracking.maxDeployedDate = date;
    }

    this.capitalTracking.sumDeployed += currentDeployed;
    this.capitalTracking.totalDeployedDays++;
  }

  /**
   * Spec 61: Get capital analysis metrics
   * @returns {Object} Capital analysis with peak, average, and utilization metrics
   */
  getCapitalAnalysis() {
    const avgDeployed = this.capitalTracking.totalDeployedDays > 0
      ? this.capitalTracking.sumDeployed / this.capitalTracking.totalDeployedDays
      : 0;

    return {
      peakDeployedCapital: this.capitalTracking.maxDeployed,
      peakCapitalDate: this.capitalTracking.maxDeployedDate,
      averageDeployedCapital: avgDeployed,
      capitalUtilization: this.totalCapital > 0 ? avgDeployed / this.totalCapital : 0
    };
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
    // Check for ACTUAL capital leaks by verifying accounting equation:
    // deployed + cash = initialCapital + realizedPNL + cashYield
    //
    // This allows for losses (normal in backtesting) but catches actual leaks
    // where capital disappears without being accounted for

    const calculated = this.deployedCapital + this.cashReserve;
    const expected = this.totalCapital + this.totalRealizedPNL + this.totalCashYield;
    const discrepancy = Math.abs(calculated - expected);

    // Allow 1 cent of rounding error
    if (discrepancy > 0.01) {
      throw new Error(
        `Capital leak detected: ` +
        `deployed(${this.deployedCapital.toFixed(2)}) + cash(${this.cashReserve.toFixed(2)}) = ${calculated.toFixed(2)}, ` +
        `but expected ${expected.toFixed(2)} ` +
        `(initial: ${this.totalCapital.toFixed(2)} + PNL: ${this.totalRealizedPNL.toFixed(2)} + yield: ${this.totalCashYield.toFixed(2)}). ` +
        `Discrepancy: ${discrepancy.toFixed(2)}`
      );
    }

    // Spec 50: Cash reserve can be negative up to margin amount (borrowed capital)
    const marginAmount = this.totalCapital * (this.marginPercent / 100);
    if (this.cashReserve < -(marginAmount + 0.01)) {
      throw new Error(
        `Capital constraint violated (borrowed beyond margin limit): ` +
        `cashReserve = ${this.cashReserve.toFixed(2)}, ` +
        `margin limit = ${marginAmount.toFixed(2)}`
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
 * Spec 50: Update margin utilization metrics
 * Called once per day after transaction processing
 */
function updateMarginMetrics(portfolio) {
  const { deployedCapital, totalCapital, effectiveCapital, marginMetrics } = portfolio;

  // Calculate current margin usage
  const marginUsed = Math.max(0, deployedCapital - totalCapital);
  const maxMarginAvailable = effectiveCapital - totalCapital;

  // Calculate utilization percentage
  let currentUtilization = 0;
  if (maxMarginAvailable > 0 && marginUsed > 0) {
    currentUtilization = (marginUsed / maxMarginAvailable) * 100;
  }

  // Update max utilization
  marginMetrics.maxMarginUtilization = Math.max(
    marginMetrics.maxMarginUtilization,
    currentUtilization
  );

  // Count days on margin
  if (deployedCapital > totalCapital) {
    marginMetrics.daysOnMargin++;
  }

  // Track for average calculation
  marginMetrics.totalMarginUtilization += currentUtilization;
  marginMetrics.daysTracked++;
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
  // Spec 61: Optimized Capital Discovery Mode
  // When enabled, runs TWO scenarios: 100% optimal capital and 90% constrained
  const { optimizedTotalCapital = false, _isConstrainedRun = false } = config;

  if (optimizedTotalCapital && !_isConstrainedRun) {
    console.log('\n🔍 Spec 61: OPTIMIZED CAPITAL DISCOVERY MODE');
    console.log('   Running discovery with unlimited capital to find optimal capital requirement...');

    // === DISCOVERY RUN (100% Optimal) ===
    const discoveryConfig = {
      ...config,
      totalCapital: Math.max(config.totalCapital || 1000000, 10000000), // Effectively unlimited (10M)
      optimizedTotalCapital: false, // Prevent recursion
      _isDiscoveryRun: true
    };

    const optimalResult = await runPortfolioBacktest(discoveryConfig);

    // Extract peak capital from discovery run
    const peakDeployedCapital = optimalResult.portfolioSummary?.peakDeployedCapital ||
                                optimalResult._capitalAnalysis?.peakDeployedCapital || 0;
    const peakCapitalDate = optimalResult._capitalAnalysis?.peakCapitalDate || null;

    console.log(`\n✅ Spec 61: Optimal capital discovered: $${peakDeployedCapital.toLocaleString()}`);
    console.log(`   Peak capital date: ${peakCapitalDate}`);

    // Prepare optimal scenario result with correct capital base
    const optimalScenario = {
      ...optimalResult,
      capitalAnalysis: {
        mode: 'optimal',
        optimizedCapital: peakDeployedCapital,
        peakDeployedCapital: peakDeployedCapital,
        peakCapitalDate: peakCapitalDate,
        percentOfOptimal: 100,
        rejectedOrderCount: optimalResult.rejectedOrders?.length || 0
      }
    };

    // === CONSTRAINED RUN (90% of Optimal) ===
    const constrainedCapital = Math.floor(peakDeployedCapital * 0.9);
    console.log(`\n🎯 Spec 61: Running constrained scenario at 90% capital ($${constrainedCapital.toLocaleString()})...`);

    const constrainedConfig = {
      ...config,
      totalCapital: constrainedCapital,
      optimizedTotalCapital: false, // Prevent recursion
      _isConstrainedRun: true
    };

    const constrainedResult = await runPortfolioBacktest(constrainedConfig);

    // Prepare constrained scenario result
    const constrainedScenario = {
      ...constrainedResult,
      capitalAnalysis: {
        mode: 'constrained_90',
        optimizedCapital: constrainedCapital,
        peakDeployedCapital: constrainedResult._capitalAnalysis?.peakDeployedCapital || constrainedCapital,
        peakCapitalDate: constrainedResult._capitalAnalysis?.peakCapitalDate,
        percentOfOptimal: 90,
        rejectedOrderCount: constrainedResult.rejectedOrders?.length || 0
      }
    };

    console.log(`\n✅ Spec 61: Constrained scenario complete`);
    console.log(`   Rejected orders: ${constrainedScenario.capitalAnalysis.rejectedOrderCount}`);

    // Return both scenarios
    return {
      success: true,
      data: {
        capitalDiscovery: {
          peakDeployedCapital: peakDeployedCapital,
          peakCapitalDate: peakCapitalDate,
          constrainedCapital: constrainedCapital
        },
        scenarios: {
          optimal: optimalScenario,
          constrained: constrainedScenario
        }
      }
    };
  }

  console.log('🎯 Starting Portfolio Backtest');
  console.log(`   Total Capital: $${config.totalCapital.toLocaleString()}`);
  console.log(`   Lot Size: $${config.lotSizeUsd.toLocaleString()}`);
  console.log(`   Stocks: ${config.stocks.length}`);
  console.log(`   Date Range: ${config.startDate} to ${config.endDate}`);

  // Extract new parameters
  const indexTracking = config.indexTracking || { enabled: false };
  const capitalOptimization = config.capitalOptimization || { enabled: false };

  // Initialize index tracker if enabled
  let indexTracker = null;
  if (indexTracking.enabled) {
    indexTracker = new IndexTrackingService();
    await indexTracker.loadIndexHistory(indexTracking.indexName || 'NASDAQ-100');
  }

  // Initialize capital optimizer if enabled
  let capitalOptimizer = null;
  if (capitalOptimization.enabled) {
    capitalOptimizer = new CapitalOptimizerService(capitalOptimization);
  }

  // Store capitalOptimization and indexTracking back in config for access by PortfolioState
  config.capitalOptimization = capitalOptimization;
  config.indexTracking = indexTracking;

  // 1. Initialize portfolio state
  const portfolio = new PortfolioState(config);

  // 2. Load price data for all stocks
  console.log('\n📡 PHASE 1: Loading price data for all stocks...');
  console.log(`   Loading data for ${config.stocks.length} stocks from ${config.startDate} to ${config.endDate}`);
  const priceDataMap = await loadAllPriceData(config.stocks, config.startDate, config.endDate);
  console.log('✅ Price data loading complete\n');

  // 3. Initialize executors and stock states for each stock
  console.log('⚙️  PHASE 2: Initializing executors for all stocks...');
  const executors = new Map();
  const executorDayIndices = new Map();  // Track each executor's current day index

  for (const stockConfig of config.stocks) {
    // Handle both string symbols and object configs
    const symbol = typeof stockConfig === 'string' ? stockConfig : stockConfig.symbol;
    const stockParams = typeof stockConfig === 'string' ? {} : stockConfig.params || {};

    // Skip if this stock was excluded due to missing data
    const dateMap = priceDataMap.get(symbol);
    if (!dateMap || dateMap.size === 0) {
      console.log(`⏩ Skipping ${symbol} - no price data available`);
      continue;
    }

    let params = {
      ...config.defaultParams,
      ...stockParams,
      maxLots: config.maxLotsPerStock,  // Add maxLots constraint from portfolio config
      lotSizeUsd: config.lotSizeUsd     // Ensure lot size is passed
    };

    // DEBUG: Log params BEFORE beta scaling
    console.log(`🔍 [DEBUG] Portfolio - ${symbol} - Params BEFORE beta scaling:`, {
      gridIntervalPercent: params.gridIntervalPercent,
      trailingSellActivationPercent: params.trailingSellActivationPercent,
      profitRequirement: params.profitRequirement,
      gridConsecutiveIncrement: params.gridConsecutiveIncrement
    });

    // Apply beta scaling if enabled (Spec 43: Centralized Beta Scaling)
    // Check params (flattened from globalDefaults.beta) instead of config.betaScaling
    if (params.enableBetaScaling) {
      const BetaScalingService = require('./betaScaling');
      const betaService = require('./betaService');
      const betaScalingService = new BetaScalingService(betaService);

      try {
        const coefficient = params.coefficient || 1.0;
        console.log(`🎯 Beta scaling enabled for ${symbol}: coefficient=${coefficient}`);

        // Apply beta scaling using centralized service
        const scalingResult = await betaScalingService.applyBetaScaling(
          params,
          symbol,
          {
            enableBetaScaling: true,
            coefficient: coefficient
          }
        );

        if (scalingResult.success) {
          // Use adjusted parameters from centralized service
          params = { ...params, ...scalingResult.adjustedParameters };

          // Store betaInfo for this stock (can be used in results)
          params._betaInfo = scalingResult.betaInfo;

          // IMPORTANT: Mark that beta scaling has been applied to prevent double-scaling
          // in drill-down/standalone backtests (Spec 43 fix for double-scaling issue)
          params.enableBetaScaling = false;
        } else {
          console.error(`❌ Beta scaling failed for ${symbol}:`, scalingResult.errors);
        }
      } catch (error) {
        console.warn(`⚠️  Beta scaling error for ${symbol}, using unadjusted parameters:`, error.message);
      }
    }

    // Get price data as array for this stock
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
  console.log(`✅ Executors initialized for ${executors.size} stocks\n`);

  console.log(`🎬 PHASE 3: Running backtest simulation...`);
  console.log(`   Total trading days: ${allDates.length}`);
  console.log(`   Total stocks: ${executors.size}`);
  console.log(`   Date range: ${allDates[0]} to ${allDates[allDates.length - 1]}\n`);

  // 5. Simulate chronologically using executors
  let transactionCount = 0;
  let rejectedCount = 0;

  // Intelligent progress logging - batch size based on number of stocks and days
  const totalOperations = allDates.length * executors.size;
  let progressInterval;
  if (totalOperations > 500000) {
    // Large portfolios (500+ stocks): log every 10%
    progressInterval = Math.floor(allDates.length / 10);
  } else if (totalOperations > 100000) {
    // Medium portfolios (200-500 stocks): log every 20%
    progressInterval = Math.floor(allDates.length / 5);
  } else {
    // Small portfolios (<200 stocks): log every 25%
    progressInterval = Math.floor(allDates.length / 4);
  }
  progressInterval = Math.max(progressInterval, 100); // At least every 100 days

  let lastLoggedDay = -1;

  for (let i = 0; i < allDates.length; i++) {
    const date = allDates[i];

    // Log progress at intervals
    if (i - lastLoggedDay >= progressInterval || i === allDates.length - 1) {
      const progress = ((i + 1) / allDates.length * 100).toFixed(1);
      console.log(`   📊 Progress: ${progress}% (Day ${i + 1}/${allDates.length}: ${date}) - Transactions: ${transactionCount}, Rejected: ${rejectedCount}`);
      lastLoggedDay = i;
    }

    const sortedSymbols = Array.from(portfolio.stocks.keys()).sort();

    // PHASE 1: Handle all index removal liquidations FIRST
    // This ensures capital from liquidations is available before any new BUYs
    if (indexTracker && indexTracking.enabled && indexTracking.handleRemovals === 'liquidate_positions') {
      const previousDate = i > 0 ? allDates[i - 1] : null;

      for (const symbol of sortedSymbols) {
        const stock = portfolio.stocks.get(symbol);
        const dayData = priceDataMap.get(symbol).get(date);

        if (!dayData) continue;

        const wasInIndexYesterday = previousDate ? indexTracker.isInIndex(symbol, previousDate) : false;
        const isInIndexToday = indexTracker.isInIndex(symbol, date);

        // Stock was just removed from index - liquidate all positions
        if (wasInIndexYesterday && !isInIndexToday && stock.lots.length > 0) {
          console.log(`   🔴 INDEX REMOVAL: Liquidating all ${stock.lots.length} lots of ${symbol} on ${date} (removed from ${indexTracking.indexName})`);

          // Force-sell all lots at market price
          while (stock.lots.length > 0) {
            const lot = stock.lots[0]; // Always take first lot
            const sellValue = lot.shares * dayData.close;
            const lotCost = lot.shares * lot.price;
            const realizedPNL = sellValue - lotCost;

            // Create liquidation transaction
            const liquidationTx = {
              date,
              type: 'SELL_LIQUIDATION',
              price: dayData.close,
              shares: lot.shares,
              value: sellValue,
              lotsCost: lotCost,
              lotsDetails: [lot],
              realizedPNLFromTrade: realizedPNL,
              reason: `Index removal: ${indexTracking.indexName}`
            };

            // Return capital to pool
            const cashBefore = portfolio.cashReserve;
            const deployedBefore = portfolio.deployedCapital;
            portfolio.cashReserve += sellValue;
            portfolio.deployedCapital -= lotCost;
            portfolio.totalRealizedPNL += realizedPNL;  // Track P&L for leak detection
            console.log(`   💰 LIQUIDATION ${symbol}: cash ${cashBefore.toFixed(0)} + ${sellValue.toFixed(0)} = ${portfolio.cashReserve.toFixed(0)}, deployed ${deployedBefore.toFixed(0)} - ${lotCost.toFixed(0)} = ${portfolio.deployedCapital.toFixed(0)}, sum=${(portfolio.cashReserve + portfolio.deployedCapital).toFixed(0)}`);

            // Update stock state
            stock.addSell(liquidationTx);
            transactionCount++;
          }

          console.log(`   ✅ Liquidation complete for ${symbol}: Realized P&L = $${stock.realizedPNL.toFixed(2)}`);

          // Update market value to zero after liquidation
          stock.updateMarketValue(dayData.close);
        }
      }
    }

    // PHASE 2: Process normal trading for each stock
    for (const symbol of sortedSymbols) {
      const executor = executors.get(symbol);
      const stock = portfolio.stocks.get(symbol);
      const dayData = priceDataMap.get(symbol).get(date);

      if (!dayData) continue;

      // Check if stock can be traded today (index tracking)
      if (indexTracker && !indexTracker.isInIndex(symbol, date)) {
        // Update market value even for non-tradeable stocks (maintains accurate portfolio value)
        stock.updateMarketValue(dayData.close);
        continue; // Skip this stock for today (already liquidated if needed)
      }

      // Get the current day index for this executor
      const dayIndex = executorDayIndices.get(symbol);

      // Get dynamic lot size from optimizer (if enabled)
      const currentLotSize = capitalOptimizer
        ? capitalOptimizer.getLotSize(symbol, portfolio.cashReserve, config.lotSizeUsd)
        : config.lotSizeUsd;

      // Log adaptive lot sizing events
      if (capitalOptimizer && currentLotSize !== config.lotSizeUsd && (i % 200 === 0 || transactionCount < 10)) {
        console.log(`   💰 Adaptive Lot Sizing: ${symbol} lot size adjusted to $${currentLotSize.toFixed(2)} (cash reserve: $${portfolio.cashReserve.toFixed(2)})`);
      }

      // Determine if sell should be deferred based on cash abundance
      const shouldDeferSell = capitalOptimizer
        ? capitalOptimizer.shouldDeferSelling(portfolio.cashReserve)
        : false;

      // Get transaction count before processing
      const stateBefore = executor.getState();
      const txCountBefore = stateBefore.enhancedTransactions.length;
      const activeStopBefore = stateBefore.activeStop ? {...stateBefore.activeStop} : null;

      // ALWAYS allow buy signal detection so we can track rejections
      // Process one day using executor with correct day index
      await executor.processDay(dayData, dayIndex, {
        buyEnabled: true,  // Always allow buy signal detection
        sellEnabled: !shouldDeferSell,  // Defer selling when cash is abundant
        lotSizeUsd: currentLotSize
      });

      // Track deferred sell if selling was disabled and there was an active stop
      if (shouldDeferSell && activeStopBefore && dayData.close <= activeStopBefore.stopPrice) {
        logDeferredSell(portfolio, stock, activeStopBefore, dayData, date, portfolio.cashReserve);
      }

      // Spec 50: Check capital availability AND margin limit
      const wouldExceedMargin = (portfolio.deployedCapital + currentLotSize) > portfolio.effectiveCapital;
      const hasCapital = portfolio.cashReserve >= currentLotSize;

      // Increment day index for this executor
      executorDayIndices.set(symbol, dayIndex + 1);

      // Get state again after processing (state is updated by reference)
      const stateAfter = executor.getState();
      const txCountAfter = stateAfter.enhancedTransactions.length;

      // Check if a new transaction occurred
      if (txCountAfter > txCountBefore) {
        // Get the latest transaction
        const tx = stateAfter.enhancedTransactions[txCountAfter - 1];

        if (tx.type.includes('BUY')) {
          // Spec 50: Margin provides available capital - only check margin limit
          // If within margin limit, allow buy (cash reserve can go negative - that's what margin is for)
          if (!wouldExceedMargin) {
            // Within margin limit - execute the buy
            const cashBefore = portfolio.cashReserve;
            const deployedBefore = portfolio.deployedCapital;
            console.log(`   💵 BUY ${symbol}: deducting tx.value=${tx.value.toFixed(2)}, currentLotSize=${currentLotSize.toFixed(2)}`);
            portfolio.cashReserve -= tx.value;
            portfolio.deployedCapital += tx.value;
            console.log(`   💰 BUY ${symbol}: cash ${cashBefore.toFixed(0)} - ${tx.value.toFixed(0)} = ${portfolio.cashReserve.toFixed(0)}, deployed ${deployedBefore.toFixed(0)} + ${tx.value.toFixed(0)} = ${portfolio.deployedCapital.toFixed(0)}, sum=${(portfolio.cashReserve + portfolio.deployedCapital).toFixed(0)}`);
            stock.addBuy(tx);
            transactionCount++;
          } else {
            // Reject - would exceed margin limit
            const reason = `would exceed margin limit (${portfolio.deployedCapital.toFixed(0)} + ${currentLotSize.toFixed(0)} > ${portfolio.effectiveCapital.toFixed(0)})`;

            console.log(`   ❌ BUY REJECTED for ${symbol} on ${date} - ${reason}`);

            // Log the rejected order with specific reason
            logRejectedOrder(portfolio, stock, { triggered: true }, dayData, date, currentLotSize, reason);
            rejectedCount++;

            // CRITICAL: Remove the lot that was added to executor's lots array
            // The executor added a lot when creating the transaction, we need to remove it
            if (stateAfter.lots && stateAfter.lots.length > 0) {
              stateAfter.lots.pop();  // Remove the last lot that was just added

              // FIX: Recalculate positionPnL after rollback (Spec 45: Momentum mode)
              // Without this, phantom lots remain in P&L calculation, causing excessive buy blocking
              const oldPnL = stateAfter.positionPnL;
              stateAfter.positionPnL = calculatePositionPnL(stateAfter.lots, dayData.close);
              console.log(`   🔧 PORTFOLIO FIX APPLIED: Recalculated positionPnL for ${symbol} on ${date} - old: ${oldPnL?.toFixed(2) || 'N/A'}, new: ${stateAfter.positionPnL?.toFixed(2) || 'N/A'}, lots: ${stateAfter.lots.length}`);
            }

            // Remove the transaction from executor's transaction log
            stateAfter.enhancedTransactions.pop();
          }
        } else {
          // SELL or other transaction types
          const cashBefore = portfolio.cashReserve;
          const deployedBefore = portfolio.deployedCapital;
          // Add full sell value to cash (includes both original cost and profit/loss)
          portfolio.cashReserve += tx.value;
          // Reduce deployed capital by original cost (use 0 if lotsCost not available)
          const lotsCost = tx.lotsCost || 0;
          portfolio.deployedCapital -= lotsCost;
          // Track realized P&L for leak detection
          const realizedPNL = tx.realizedPNLFromTrade || 0;
          portfolio.totalRealizedPNL += realizedPNL;
          console.log(`   💰 SELL ${symbol}: cash ${cashBefore.toFixed(0)} + ${(tx.value || 0).toFixed(0)} = ${portfolio.cashReserve.toFixed(0)}, deployed ${deployedBefore.toFixed(0)} - ${lotsCost.toFixed(0)} = ${portfolio.deployedCapital.toFixed(0)}, sum=${(portfolio.cashReserve + portfolio.deployedCapital).toFixed(0)}`);
          stock.addSell(tx);
          transactionCount++;
        }
      }

      // Update market value
      stock.updateMarketValue(dayData.close);
    }

    // Track cash reserve and calculate cash yield (if enabled)
    if (capitalOptimizer) {
      capitalOptimizer.trackCashReserve(date, portfolio.cashReserve);

      // Calculate daily cash yield and add to cash reserve
      const yieldRevenue = capitalOptimizer.calculateDailyCashYield(portfolio.cashReserve);
      if (yieldRevenue > 0) {
        portfolio.cashReserve += yieldRevenue;
        portfolio.totalCashYield += yieldRevenue;  // Track for leak detection
        if (i % 200 === 0) {
          console.log(`   💵 Cash Yield: +$${yieldRevenue.toFixed(2)} from $${(portfolio.cashReserve - yieldRevenue).toFixed(2)} reserve on ${date}`);
        }
      }
    }

    // Validate capital constraints after every date
    portfolio.validateCapitalConstraints();

    // Spec 61: Track capital usage for optimized capital discovery
    portfolio.trackCapitalUsage(date);

    // Snapshot portfolio state - DAILY for accurate volatility calculation
    portfolio.valuationHistory.push(createSnapshot(portfolio, date));

    // Spec 50: Update margin metrics
    updateMarginMetrics(portfolio);

    // Progress logging
    if (i > 0 && i % 100 === 0) {
      const progress = ((i / allDates.length) * 100).toFixed(1);
      console.log(`   Progress: ${progress}% (${i}/${allDates.length} days) - Transactions: ${transactionCount}, Rejected: ${rejectedCount}`);
    }
  }

  console.log('\n✅ PHASE 4: Portfolio Backtest Complete');
  console.log(`   Total Transactions: ${transactionCount}`);
  console.log(`   Rejected Orders: ${rejectedCount}`);
  console.log(`   Total Trading Days: ${allDates.length}`);
  console.log(`   Stocks Processed: ${executors.size}`);
  console.log(`   Final Portfolio Value: $${portfolio.portfolioValue.toLocaleString()}`);
  console.log(`   Total Return: $${portfolio.totalPNL.toLocaleString()} (${((portfolio.totalPNL / portfolio.totalCapital) * 100).toFixed(2)}%)`);

  // 6. Extract executor statistics and store in StockState objects (Spec 45)
  for (const [symbol, executor] of executors.entries()) {
    const executorResults = executor.getResults();  // Use getResults() not getState()
    const stock = portfolio.stocks.get(symbol);

    if (stock && executorResults.summary) {
      // Copy Spec 45 momentum statistics from executor to stock state
      stock.momentumMode = executorResults.summary.momentumMode || null;
      stock.buyBlockedByPnL = executorResults.summary.buyBlockedByPnL || 0;
      stock.maxLotsReached = executorResults.summary.maxLotsReached || 0;
    }
  }

  // 7. Calculate final metrics
  const portfolioMetricsService = require('./portfolioMetricsService');
  const results = portfolioMetricsService.calculatePortfolioMetrics(portfolio, config, priceDataMap);

  // 6a. Add skipped stocks to results with error information
  const skippedStocks = priceDataMap._skippedStocks || [];
  if (skippedStocks.length > 0) {
    // Add skipped stocks to stockResults with special error indicators
    for (const { symbol, error } of skippedStocks) {
      results.stockResults.push({
        symbol,
        skipped: true,
        error,
        // All metrics null/zero for skipped stocks
        totalPNL: 0,
        totalPNLPercent: 0,
        contributionPercent: 0,
        realizedPNL: 0,
        unrealizedPNL: 0,
        capitalDeployed: 0,
        maxCapitalDeployed: 0,
        marketValue: 0,
        lotsHeld: 0,
        totalBuys: 0,
        totalSells: 0,
        rejectedBuys: 0,
        rejectedBuyValues: 0,
        cagr: 0,
        firstBuyDate: null,
        lastBuyDate: null
      });
    }

    // Include summary of skipped stocks in results
    results.skippedStocks = skippedStocks;
  }

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

  // 8. Collect index tracking metrics
  let indexTrackingMetrics = null;
  if (indexTracker) {
    const allChanges = indexTracker.getIndexChanges(config.startDate, config.endDate);
    indexTrackingMetrics = {
      enabled: true,
      indexName: indexTracking.indexName || 'NASDAQ-100',
      stocksAdded: allChanges.filter(c => c.type === 'addition').map(c => ({
        symbol: c.symbol,
        addedDate: c.date,
        notes: c.notes
      })),
      stocksRemoved: allChanges.filter(c => c.type === 'removal').map(c => ({
        symbol: c.symbol,
        removedDate: c.date,
        notes: c.notes
      }))
    };
  }

  // 9. Collect capital optimization metrics
  let capitalOptimizationMetrics = null;
  if (capitalOptimizer) {
    capitalOptimizationMetrics = capitalOptimizer.getMetrics();
  }

  // 10. Add new metrics to results
  if (indexTrackingMetrics) {
    results.indexTracking = indexTrackingMetrics;
  }
  if (capitalOptimizationMetrics) {
    results.capitalOptimization = capitalOptimizationMetrics;
  }

  // Spec 50: Add margin metrics to capital metrics
  const avgMarginUtilization = portfolio.marginMetrics.daysTracked > 0
    ? portfolio.marginMetrics.totalMarginUtilization / portfolio.marginMetrics.daysTracked
    : 0;

  if (!results.capitalMetrics) {
    results.capitalMetrics = {};
  }

  results.capitalMetrics.marginPercent = portfolio.marginPercent;
  results.capitalMetrics.effectiveCapital = portfolio.effectiveCapital;
  results.capitalMetrics.marginUtilization = {
    max: portfolio.marginMetrics.maxMarginUtilization,
    average: avgMarginUtilization,
    daysOnMargin: portfolio.marginMetrics.daysOnMargin,
    totalDays: portfolio.marginMetrics.daysTracked
  };

  // 11. Add rejected orders and deferred sells
  results.rejectedOrders = portfolio.rejectedOrders || [];
  results.deferredSells = portfolio.deferredSells || [];

  // 12. Spec 55: Add beta grouping analysis
  const betaGroupAnalysisService = require('./betaGroupAnalysisService');
  try {
    const betaGrouping = await betaGroupAnalysisService.analyzeBetaGroups(
      results.stockResults,
      { startDate: config.startDate, endDate: config.endDate }
    );
    if (betaGrouping) {
      results.betaGrouping = betaGrouping;
    }
  } catch (error) {
    console.warn('[PortfolioBacktest] Beta grouping analysis failed:', error.message);
    // Continue without beta grouping - non-critical feature
  }

  // Spec 61: Add capital analysis for optimized capital discovery
  const capitalAnalysis = portfolio.getCapitalAnalysis();
  results._capitalAnalysis = capitalAnalysis;

  // Also add peak deployed capital to portfolioSummary for easy access
  if (results.portfolioSummary) {
    results.portfolioSummary.peakDeployedCapital = capitalAnalysis.peakDeployedCapital;
    results.portfolioSummary.peakCapitalDate = capitalAnalysis.peakCapitalDate;
    results.portfolioSummary.averageDeployedCapital = capitalAnalysis.averageDeployedCapital;
    results.portfolioSummary.capitalUtilization = capitalAnalysis.capitalUtilization;
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

    let prices = await database.getPricesWithIndicators(stock.id, startDate, endDate);

    // Validate price data has required fields
    if (prices.length === 0) {
      console.warn(`⚠️  No price data found for ${symbol} in date range ${startDate} to ${endDate}`);

      // Check if the stock exists but has no data at all (latestPriceDate is null)
      if (latestPriceDate === null) {
        console.log(`📡 Stock ${symbol} exists but has no price data. Attempting to fetch all historical data...`);

        try {
          const stockDataService = require('./stockDataService');
          await stockDataService.updateStockData(stock.id, symbol, {
            updatePrices: true,
            updateFundamentals: false,
            updateCorporateActions: false
          });

          // Retry loading prices after fetch
          prices = await database.getPricesWithIndicators(stock.id, startDate, endDate);

          if (prices.length > 0) {
            console.log(`✅ Successfully fetched ${prices.length} price records for ${symbol}`);
          } else {
            console.warn(`❌ Failed to fetch price data for ${symbol} - no data available from provider`);
            console.warn(`   Skipping ${symbol} from portfolio backtest`);
            return {
              symbol,
              dateMap: new Map(),
              skipped: true,
              error: {
                type: 'NO_DATA_AFTER_FETCH',
                message: `No price data available from provider for ${symbol}`,
                attempted: true,
                fetchAttempted: true
              }
            };
          }
        } catch (fetchError) {
          console.error(`❌ Error fetching data for ${symbol}:`, fetchError.message);
          console.warn(`   Skipping ${symbol} from portfolio backtest`);
          return {
            symbol,
            dateMap: new Map(),
            skipped: true,
            error: {
              type: 'FETCH_ERROR',
              message: `Failed to fetch price data: ${fetchError.message}`,
              attempted: true,
              fetchAttempted: true,
              fetchError: fetchError.message
            }
          };
        }
      } else {
        // Stock has some data but none in the requested date range
        console.warn(`   Skipping ${symbol} from portfolio backtest`);
        return {
          symbol,
          dateMap: new Map(),
          skipped: true,
          error: {
            type: 'NO_DATA_IN_RANGE',
            message: `No price data available in date range ${startDate} to ${endDate}`,
            attempted: false,
            latestAvailableDate: latestPriceDate
          }
        };
      }
    }

    // Check first few prices for required fields
    const sampleSize = Math.min(5, prices.length);
    for (let i = 0; i < sampleSize; i++) {
      const price = prices[i];
      if (!price.close || price.close === null || price.close === undefined) {
        console.warn(`⚠️  Invalid price data for ${symbol}: missing 'close' field on ${price.date}`);
        console.warn(`   Skipping ${symbol} from portfolio backtest`);
        return {
          symbol,
          dateMap: new Map(),
          skipped: true,
          error: {
            type: 'INVALID_DATA',
            message: `Missing required price fields (close) on ${price.date}`,
            attempted: false,
            invalidDate: price.date
          }
        };
      }
    }

    // Convert to Map(date -> data) for fast lookup
    const dateMap = new Map();
    for (const priceData of prices) {
      dateMap.set(priceData.date, priceData);
    }

    console.log(`✅ Loaded ${prices.length} price records for ${symbol}`);
    return { symbol, dateMap, skipped: false };
  });

  const results = await Promise.all(pricePromises);

  const skippedStocks = [];
  for (const result of results) {
    const { symbol, dateMap, skipped, error } = result;
    if (skipped) {
      skippedStocks.push({ symbol, error });
      continue;  // Skip this stock
    }
    priceDataMap.set(symbol, dateMap);
  }

  if (skippedStocks.length > 0) {
    console.warn(`\n⚠️  WARNING: ${skippedStocks.length} stock(s) skipped due to missing/invalid price data:`);
    for (const { symbol, error } of skippedStocks) {
      console.warn(`   - ${symbol}: ${error.message}`);
      if (error.fetchAttempted) {
        console.warn(`     Fetch attempted: Yes`);
      }
    }
    console.warn('');
  }

  // Store skipped stocks in priceDataMap metadata for later use
  priceDataMap._skippedStocks = skippedStocks;

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
          // Deduct from capital pool - use actual transaction value, not config value
          // (they may differ if adaptive lot sizing or other adjustments are applied)
          portfolio.cashReserve -= buyTransaction.value;
          portfolio.deployedCapital += buyTransaction.value;

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
function logRejectedOrder(portfolio, stock, signal, dayData, date, lotSize = null, reason = null) {
  const lotSizeUsd = lotSize || portfolio.config.lotSizeUsd;
  const shortfall = lotSizeUsd - portfolio.cashReserve;

  // Spec 50: Calculate margin context
  const marginUsed = Math.max(0, portfolio.deployedCapital - portfolio.totalCapital);
  const maxMarginAvailable = portfolio.effectiveCapital - portfolio.totalCapital;
  let marginUtilization = 0;
  if (maxMarginAvailable > 0 && marginUsed > 0) {
    marginUtilization = (marginUsed / maxMarginAvailable) * 100;
  }

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
    lotSize: lotSizeUsd,
    attemptedValue: lotSizeUsd,  // For frontend compatibility
    reason: reason || 'INSUFFICIENT_CAPITAL',  // Spec 50: Specific reason
    availableCapital: portfolio.cashReserve,
    requiredCapital: lotSizeUsd,
    shortfall,
    competingStocks: competingStocks.map(s => s.symbol),
    portfolioState: {
      deployedCapital: portfolio.deployedCapital,
      cashReserve: portfolio.cashReserve,
      utilizationPercent: portfolio.utilizationPercent
    },
    // Spec 50: Margin context
    capitalState: {
      totalCapital: portfolio.totalCapital,
      effectiveCapital: portfolio.effectiveCapital,
      marginPercent: portfolio.marginPercent,
      marginUsed: marginUsed,
      marginUtilization: marginUtilization
    }
  };

  portfolio.rejectedOrders.push(rejectedOrder);
  stock.rejectedBuys++;
  stock.rejectedBuyValues += lotSizeUsd;
  stock.rejectedOrders.push(rejectedOrder);
}

/**
 * Log deferred sell order
 */
function logDeferredSell(portfolio, stock, activeStop, dayData, date, cashReserve) {
  const lotsToSell = activeStop.lotsToSell;
  const estimatedValue = lotsToSell.reduce((sum, lot) => sum + (lot.shares * dayData.close), 0);
  const estimatedProfit = lotsToSell.reduce((sum, lot) => sum + ((dayData.close - lot.price) * lot.shares), 0);

  const deferredSell = {
    date,
    symbol: stock.symbol,
    orderType: 'SELL',
    price: dayData.close,
    stopPrice: activeStop.stopPrice,
    limitPrice: activeStop.limitPrice,
    lotsToSell: lotsToSell.length,
    estimatedValue,
    estimatedProfit,
    reason: 'DEFERRED_DUE_TO_CASH_ABUNDANCE',
    cashReserve,
    cashThreshold: portfolio.config.capitalOptimization?.deferredSelling?.cashAbundanceThreshold,
    portfolioState: {
      deployedCapital: portfolio.deployedCapital,
      cashReserve: portfolio.cashReserve,
      utilizationPercent: portfolio.utilizationPercent
    }
  };

  portfolio.deferredSells.push(deferredSell);
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
