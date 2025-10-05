const database = require('../database');
const PerformanceCalculatorService = require('./performanceCalculatorService');
const AdaptiveStrategyService = require('./adaptiveStrategyService');
const {
  calculatePortfolioDrawdown,
  assessMarketCondition,
  calculateBuyAndHold: calculateBuyAndHoldUtil,
  calculateSharpeRatio,
  calculateWinRate,
  validateBacktestParameters,
  calculateDynamicGridSpacing
} = require('./shared/backtestUtilities');
const { detectScenario } = require('./scenarioDetectionService');

/**
 * Core DCA Backtesting Service
 * This service contains the shared algorithm that can be used by both:
 * 1. Server API endpoints (with dynamic parameters)
 * 2. Command line execution (with static parameters)
 */

// --- Utility Functions ---
function calculateMetrics(dailyValues, capitalDeployed, transactionLog, prices, enhancedTransactions = []) {
  const returns = [];
  const portfolioValues = [];
  let peakValue = 0;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  for (let i = 0; i < dailyValues.length; i++) {
    portfolioValues.push(dailyValues[i]);

    if (i > 0) {
      const dailyReturn = (dailyValues[i] - dailyValues[i-1]) / dailyValues[i-1];
      returns.push(dailyReturn);
    }

    if (dailyValues[i] > peakValue) {
      peakValue = dailyValues[i];
    }

    const drawdown = peakValue - dailyValues[i];
    const drawdownPercent = peakValue > 0 ? (drawdown / peakValue) * 100 : 0;

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
    if (drawdownPercent > maxDrawdownPercent) {
      maxDrawdownPercent = drawdownPercent;
    }
  }

  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const returnStdDev = returns.length > 1 ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)) : 0;
  const sharpeRatio = returnStdDev > 0 ? (avgReturn * 252) / (returnStdDev * Math.sqrt(252)) : 0;

  // Use enhanced transactions for more accurate metrics
  const sellTransactions = enhancedTransactions.filter(t => t.type === 'SELL');
  const buyTransactions = enhancedTransactions.filter(t => t.type === 'TRAILING_STOP_LIMIT_BUY');
  const winningTrades = sellTransactions.filter(t => t.realizedPNLFromTrade > 0);
  const winRate = sellTransactions.length > 0 ? (winningTrades.length / sellTransactions.length) * 100 : 0;
  const totalTrades = sellTransactions.length; // Count sells as completed trades

  const totalCapitalDeployed = Math.max(...capitalDeployed, 0);
  const avgCapitalDeployed = capitalDeployed.reduce((a, b) => a + b, 0) / capitalDeployed.length;
  const finalValue = portfolioValues[portfolioValues.length - 1];
  const initialValue = portfolioValues[0];
  const totalReturn = finalValue - initialValue;

  const combinedWeightedReturn = totalCapitalDeployed > 0 ?
    (totalReturn / avgCapitalDeployed) * (avgCapitalDeployed / totalCapitalDeployed) * 100 : 0;

  // Calculate DCA annualized return
  const totalReturnDecimal = initialValue > 0 ? (finalValue - initialValue) / initialValue : 0;
  const totalDays = portfolioValues.length;
  const dcaAnnualizedReturn = totalDays > 0 ?
    totalReturnDecimal * 365 / totalDays : 0;
  const dcaAnnualizedReturnPercent = dcaAnnualizedReturn * 100;

  return {
    totalReturn: finalValue - initialValue,
    totalReturnPercent: avgCapitalDeployed > 0 ? ((finalValue - initialValue) / avgCapitalDeployed) * 100 : 0,
    annualizedReturn: dcaAnnualizedReturn,
    annualizedReturnPercent: dcaAnnualizedReturnPercent,
    maxDrawdown: maxDrawdown,
    maxDrawdownPercent: maxDrawdownPercent,
    sharpeRatio: sharpeRatio,
    winRate: winRate,
    totalTrades: totalTrades,
    avgCapitalDeployed: avgCapitalDeployed,
    maxCapitalDeployed: totalCapitalDeployed,
    combinedWeightedReturn: combinedWeightedReturn,
    volatility: returnStdDev * Math.sqrt(252) * 100
  };
}

// Calculate annualized return for individual trades and current holdings
function calculateTradeAnnualizedReturns(enhancedTransactions, startDate, endDate, currentHoldings, finalPrice, lotSizeUsd) {
  const tradeReturns = [];
  const holdingReturns = [];
  const buyTransactions = enhancedTransactions.filter(t => t.type === 'TRAILING_STOP_LIMIT_BUY');
  const sellTransactions = enhancedTransactions.filter(t => t.type === 'SELL');

  // Calculate total backtest period in days (for current holdings only)
  const totalBacktestDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));

  // Calculate annualized returns for completed trades
  for (const sellTx of sellTransactions) {
    if (sellTx.realizedPNLFromTrade && sellTx.lotsDetails) {
      for (const lotSold of sellTx.lotsDetails) {
        // Find the corresponding buy transaction for this lot
        const buyTx = buyTransactions.find(buy =>
          buy.price === lotSold.price && buy.date <= sellTx.date
        );

        if (buyTx) {
          const investment = lotSold.price * lotSold.shares;
          const returns = (sellTx.price - lotSold.price) * lotSold.shares;
          const totalReturn = investment + returns;
          const returnPercent = investment > 0 ? returns / investment : 0;

          // Calculate actual days held for this specific trade
          const actualDaysHeld = Math.max(1, Math.ceil((new Date(sellTx.date) - new Date(buyTx.date)) / (1000 * 60 * 60 * 24)));

          // Calculate annualized return: simple linear annualization
          const annualizedReturn = returnPercent * 365 / actualDaysHeld;

          tradeReturns.push({
            type: 'COMPLETED_TRADE',
            buyDate: buyTx.date,
            sellDate: sellTx.date,
            buyPrice: lotSold.price,
            sellPrice: sellTx.price,
            shares: lotSold.shares,
            investment: investment,
            returns: returns,
            returnPercent: returnPercent * 100,
            annualizedReturn: annualizedReturn,
            annualizedReturnPercent: annualizedReturn * 100,
            actualDaysHeld: actualDaysHeld
          });
        }
      }
    }
  }

  // Calculate annualized returns for current holdings (open positions)
  if (currentHoldings && currentHoldings.length > 0 && finalPrice > 0) {
    for (const holding of currentHoldings) {
      const investment = holding.price * holding.shares;
      const currentValue = finalPrice * holding.shares;
      const returns = currentValue - investment;
      const returnPercent = investment > 0 ? returns / investment : 0;

      // Calculate actual days held for this specific holding
      const actualDaysHeld = Math.max(1, Math.ceil((new Date(endDate) - new Date(holding.date)) / (1000 * 60 * 60 * 24)));

      // Simple linear annualization for current holdings
      const annualizedReturn = returnPercent * 365 / actualDaysHeld;

      holdingReturns.push({
        type: 'CURRENT_HOLDING',
        buyDate: holding.date,
        sellDate: endDate, // Theoretical sell date for annualized calculation
        buyPrice: holding.price,
        sellPrice: finalPrice, // Current market price
        shares: holding.shares,
        investment: investment,
        returns: returns,
        returnPercent: returnPercent * 100,
        annualizedReturn: annualizedReturn,
        annualizedReturnPercent: annualizedReturn * 100,
        actualDaysHeld: actualDaysHeld
      });
    }
  }

  // Combine all returns for overall weighted average
  const allReturns = [...tradeReturns, ...holdingReturns];

  // Calculate weighted average (each lot is weighted by its actual dollar investment)
  // For DCA, each lot is worth lotSizeUsd, so this is a proper weighted average
  const totalWeight = allReturns.length * lotSizeUsd;
  const weightedSum = allReturns.length > 0 ?
    allReturns.reduce((sum, position) => sum + (position.annualizedReturn * lotSizeUsd), 0) : 0;
  const avgAnnualizedReturn = allReturns.length > 0 ? weightedSum / totalWeight : 0;
  const avgAnnualizedReturnPercent = avgAnnualizedReturn * 100;

  // Single consolidated logging for all individual trade returns
  console.log(`📊 All Individual Trade Returns for Average Calculation:`,
    allReturns.map((pos, i) =>
      `${i+1}. ${(pos.annualizedReturn * 100).toFixed(2)}% (weight: $${lotSizeUsd.toLocaleString()})`
    ).join('\n')
  );
  console.log(`📈 Weighted Average Result: ${avgAnnualizedReturnPercent.toFixed(2)}% (${allReturns.length} positions)`);

  // Separate weighted averages for completed trades and holdings
  const tradeOnlyTotalWeight = tradeReturns.length * lotSizeUsd;
  const tradeOnlyAvg = tradeReturns.length > 0 ?
    tradeReturns.reduce((sum, trade) => sum + (trade.annualizedReturn * lotSizeUsd), 0) / tradeOnlyTotalWeight : 0;

  const holdingOnlyTotalWeight = holdingReturns.length * lotSizeUsd;
  const holdingOnlyAvg = holdingReturns.length > 0 ?
    holdingReturns.reduce((sum, holding) => sum + (holding.annualizedReturn * lotSizeUsd), 0) / holdingOnlyTotalWeight : 0;

  return {
    individualTradeReturns: tradeReturns,
    currentHoldingReturns: holdingReturns,
    allReturns: allReturns,
    averageAnnualizedReturn: avgAnnualizedReturn,
    averageAnnualizedReturnPercent: avgAnnualizedReturnPercent,
    tradeOnlyAverageAnnualizedReturnPercent: tradeOnlyAvg * 100,
    holdingOnlyAverageAnnualizedReturnPercent: holdingOnlyAvg * 100
  };
}

// calculatePortfolioDrawdown and assessMarketCondition moved to shared/backtestUtilities.js

function calculateBuyAndHold(prices, initialCapital, avgCapitalForComparison = null) {
  const startPrice = prices[0].adjusted_close;
  const endPrice = prices[prices.length - 1].adjusted_close;
  const shares = initialCapital / startPrice;
  const finalValue = shares * endPrice;
  const totalReturn = finalValue - initialCapital;

  // Use average capital for comparison if provided, otherwise use initial capital
  const denominator = avgCapitalForComparison || initialCapital;
  const totalReturnPercent = (totalReturn / denominator) * 100;

  // Calculate annualized return: (1 + total return) ^ (365 / days) - 1
  const totalDays = prices.length;
  const annualizedReturn = totalDays > 0 ?
    Math.pow(1 + (totalReturnPercent / 100), 365 / totalDays) - 1 : 0;
  const annualizedReturnPercent = annualizedReturn * 100;

  let peakValue = initialCapital;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  const dailyValues = [];

  for (const price of prices) {
    const currentValue = shares * price.adjusted_close;
    dailyValues.push(currentValue);

    if (currentValue > peakValue) {
      peakValue = currentValue;
    }

    const drawdown = peakValue - currentValue;
    const drawdownPercent = (drawdown / peakValue) * 100;

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
    if (drawdownPercent > maxDrawdownPercent) {
      maxDrawdownPercent = drawdownPercent;
    }
  }

  const returns = [];
  for (let i = 1; i < dailyValues.length; i++) {
    returns.push((dailyValues[i] - dailyValues[i-1]) / dailyValues[i-1]);
  }
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const volatility = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)) * Math.sqrt(252) * 100;
  const sharpeRatio = volatility > 0 ? (avgReturn * 252) / (volatility / 100) : 0;

  return {
    totalReturn: totalReturn,
    totalReturnPercent: totalReturnPercent,
    annualizedReturn: annualizedReturn,
    annualizedReturnPercent: annualizedReturnPercent,
    maxDrawdown: maxDrawdown,
    maxDrawdownPercent: maxDrawdownPercent,
    sharpeRatio: sharpeRatio,
    volatility: volatility,
    finalValue: finalValue,
    shares: shares
  };
}

/**
 * Core DCA Backtest Algorithm
 * @param {Object} params - Backtest parameters
 * @param {string} params.symbol - Stock symbol
 * @param {string} params.startDate - Start date (YYYY-MM-DD)
 * @param {string} params.endDate - End date (YYYY-MM-DD)
 * @param {number} params.lotSizeUsd - Amount per lot in USD
 * @param {number} params.maxLots - Maximum number of lots
 * @param {number} params.gridIntervalPercent - Grid interval as decimal (0.10 for 10%)
 * @param {number} params.remainingLotsLossTolerance - Loss tolerance as decimal (0.05 for 5%)
 * @param {boolean} params.verbose - Whether to log detailed output (default: true)
 * @returns {Promise<Object>} Backtest results
 */
async function runDCABacktest(params) {
  const {
    symbol,
    startDate,
    endDate,
    lotSizeUsd,
    maxLots,
    maxLotsToSell = 1, // Default to 1 lot for backward compatibility
    gridIntervalPercent,
    profitRequirement = 0.05, // Default 5% profit requirement
    trailingBuyActivationPercent = 0.1, // Default 10% drop to activate trailing buy
    trailingBuyReboundPercent = 0.05, // Default 5% rebound for trailing buy stop price
    trailingSellActivationPercent = 0.2, // Default 20% rise to activate trailing sell
    trailingSellPullbackPercent = 0.1, // Default 10% pullback for trailing sell stop price
    enableDynamicGrid = true, // Enable square root-based dynamic grid spacing
    normalizeToReference = true, // Normalize first trade price to $100 reference
    dynamicGridMultiplier = 1.0, // Grid width multiplier (1.0 = ~10% at $100)
    enableConsecutiveIncrementalSellProfit = true, // Enable incremental profit req for consecutive uptrend sells
    enableScenarioDetection = true, // Enable scenario detection and analysis
    verbose = true
  } = params;

  if (verbose) {
    console.log(`🎯 Starting DCA backtest for ${symbol}...`);
    if (enableDynamicGrid) {
      console.log(`📊 Parameters: ${lotSizeUsd} USD/lot, ${maxLots} max lots, ${maxLotsToSell} max lots per sell`);
      console.log(`📐 Dynamic Grid: ${normalizeToReference ? 'Normalized' : 'Absolute'} (multiplier: ${dynamicGridMultiplier})`);
    } else {
      console.log(`📊 Parameters: ${lotSizeUsd} USD/lot, ${maxLots} max lots, ${maxLotsToSell} max lots per sell, ${(gridIntervalPercent*100).toFixed(1)}% fixed grid`);
    }
  }

  // Initialize Adaptive Strategy
  let adaptiveStrategy = null;
  let currentParams = {
    ...params,
    buyEnabled: true,  // Default: buying enabled
    sellEnabled: true  // Default: selling enabled
  };

  if (params.enableAdaptiveStrategy) {
    adaptiveStrategy = new AdaptiveStrategyService({
      enableAdaptiveStrategy: params.enableAdaptiveStrategy,
      adaptationCheckIntervalDays: params.adaptationCheckIntervalDays || 30,
      adaptationRollingWindowDays: params.adaptationRollingWindowDays || 90,
      minDataDaysBeforeAdaptation: params.minDataDaysBeforeAdaptation || 90,
      confidenceThreshold: params.confidenceThreshold || 0.7
    });

    if (verbose) {
      console.log(`🔄 Adaptive Strategy ENABLED`);
      console.log(`   Check interval: ${params.adaptationCheckIntervalDays || 30} days`);
      console.log(`   Rolling window: ${params.adaptationRollingWindowDays || 90} days`);
      console.log(`   Confidence threshold: ${params.confidenceThreshold || 0.7}`);
    }
  }

  try {
    // 1. Get or create Stock ID
    let stock = await database.getStock(symbol);
    if (!stock) {
      console.log(`🆕 Creating new stock record for backtest: ${symbol}`);
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
      // Check if we have data up to the requested endDate
      const latestDate = new Date(latestPriceDate);
      const requestedEndDate = new Date(endDate);

      if (latestDate < requestedEndDate) {
        // Calculate next day after latest data
        const nextDay = new Date(latestDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const fromDate = nextDay.toISOString().split('T')[0];

        console.log(`📡 Data gap detected for ${symbol}:`);
        console.log(`   Database has data until: ${latestPriceDate}`);
        console.log(`   Requested data until: ${endDate}`);
        console.log(`   Fetching missing data from ${fromDate} to ${endDate}...`);

        try {
          const stockDataService = require('./stockDataService');
          const startTime = Date.now();

          await stockDataService.updateStockData(stock.id, symbol, {
            updatePrices: true,
            fromDate: fromDate,
            updateFundamentals: false, // Don't re-fetch fundamentals
            updateCorporateActions: false // Don't re-fetch corporate actions
          });

          const endTime = Date.now();
          const duration = ((endTime - startTime) / 1000).toFixed(2);

          // Get count of new records
          const newLatestDate = await database.getLastPriceDate(stock.id);
          console.log(`✅ Gap filled successfully in ${duration}s`);
          console.log(`   New latest date: ${newLatestDate}`);

        } catch (fetchError) {
          console.error(`❌ Failed to fetch missing data: ${fetchError.message}`);
          console.warn(`⚠️  Proceeding with available data (until ${latestPriceDate})`);
          // Don't throw - allow backtest to proceed with available data
        }
      }
    }

    // 3. Get Combined Price and Technical Indicator Data
    let pricesWithIndicators = await database.getPricesWithIndicators(stock.id, startDate, endDate);

    // If no data found for the exact date range, try with latest available data
    if (pricesWithIndicators.length === 0) {
      const latestPriceDate = await database.getLastPriceDate(stock.id);

      if (latestPriceDate) {
        // Adjust end date to latest available data
        console.warn(`⚠️  No data found until ${endDate} for ${symbol}, using latest available data (${latestPriceDate})`);
        pricesWithIndicators = await database.getPricesWithIndicators(stock.id, startDate, latestPriceDate);
      }

      // If still no data, the stock truly has no price data in the database
      if (pricesWithIndicators.length === 0) {
        throw new Error(`No price/indicator data found for ${symbol}. The stock may not exist or data fetch failed. Please check the symbol and try again.`);
      }
    }

    if (verbose) {
      console.log(`📈 Fetched ${pricesWithIndicators.length} records with technical indicators.`);
    }

    // --- Core Backtesting Algorithm ---
    let lots = [];
    let realizedPNL = 0;
    let averageCost = 0;
    const initialPrice = pricesWithIndicators[0].adjusted_close;
    const trailingAmount = initialPrice * gridIntervalPercent;
    const transactionLog = [];
    let referencePrice = null; // Will be set on first trade for dynamic grid normalization
    let activeStop = null;
    const dailyPortfolioValues = [];
    const dailyCapitalDeployed = [];

    // Consecutive incremental profit tracking
    let lastActionType = null; // 'buy' | 'sell' | null
    let lastSellPrice = null; // Price of last sell, or null

    // Questionable events monitoring
    const questionableEvents = [];
    const dailyTransactionTypes = new Map(); // Track transaction types per date

    // Recent Peak/Bottom Tracking System (simplified approach)
    let recentPeak = null;  // Highest price since last transaction
    let recentBottom = null; // Lowest price since last transaction
    let trailingStopBuy = null; // Active trailing stop buy order
    let lastTransactionDate = null; // Track when peak/bottom tracking started

    const recalculateAverageCost = () => {
      if (lots.length > 0) {
        const totalCost = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
        const totalShares = lots.reduce((sum, lot) => sum + lot.shares, 0);
        return totalCost / totalShares;
      }
      return 0;
    };

    const getLotsPrices = (lotArray) => `[${lotArray.map(l => l.price.toFixed(2)).join(', ')}]`;

    // Color codes for terminal output
    const colors = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      reset: '\x1b[0m',
      bright: '\x1b[1m'
    };

    const colorize = (text, color) => `${colors[color]}${text}${colors.reset}`;

    // Track transactions for questionable event detection
    const trackTransaction = (date, type, price, details) => {
      if (!dailyTransactionTypes.has(date)) {
        dailyTransactionTypes.set(date, []);
      }
      dailyTransactionTypes.get(date).push({ type, price, details, time: new Date().toISOString() });

      // Check for questionable same-day events
      const dayTransactions = dailyTransactionTypes.get(date);
      const hasSell = dayTransactions.some(tx => tx.type === 'SELL');
      const hasBuy = dayTransactions.some(tx => tx.type === 'TRAILING_STOP_LIMIT_BUY');

      if (hasSell && hasBuy && dayTransactions.length >= 2) {
        const sellTx = dayTransactions.find(tx => tx.type === 'SELL');
        const buyTx = dayTransactions.find(tx => tx.type === 'TRAILING_STOP_LIMIT_BUY');

        questionableEvents.push({
          date: date,
          type: 'SAME_DAY_SELL_BUY',
          description: 'Both trailing sell and buy orders executed on the same day',
          severity: 'WARNING',
          sellPrice: sellTx.price,
          buyPrice: buyTx.price,
          priceChange: ((buyTx.price - sellTx.price) / sellTx.price * 100).toFixed(2),
          sellDetails: sellTx.details,
          buyDetails: buyTx.details,
          allTransactions: dayTransactions
        });

        transactionLog.push(
          colorize(`⚠️  QUESTIONABLE EVENT: Same-day sell ($${sellTx.price.toFixed(2)}) and buy ($${buyTx.price.toFixed(2)}) execution - Price change: ${((buyTx.price - sellTx.price) / sellTx.price * 100).toFixed(2)}%`, 'yellow')
        );
      }
    };

    // Reset peak/bottom tracking after any transaction
    const resetPeakBottomTracking = (currentPrice, currentDate) => {
      recentPeak = currentPrice;
      recentBottom = currentPrice;
      lastTransactionDate = currentDate;
      transactionLog.push(colorize(`  ACTION: Reset peak/bottom tracking - Peak: ${currentPrice.toFixed(2)}, Bottom: ${currentPrice.toFixed(2)}`, 'cyan'));
    };

    // Update recent peak and bottom tracking
    const updatePeakBottomTracking = (currentPrice) => {
      if (recentPeak === null || currentPrice > recentPeak) {
        recentPeak = currentPrice;
      }
      if (recentBottom === null || currentPrice < recentBottom) {
        recentBottom = currentPrice;
      }
    };

    // Check if trailing stop buy should be activated
    const checkTrailingStopBuyActivation = (currentPrice, currentDate) => {
      if (!trailingStopBuy && recentPeak && currentPrice <= recentPeak * (1 - trailingBuyActivationPercent)) {
        // Price dropped {trailingBuyActivationPercent}% from recent peak - activate trailing stop buy
        trailingStopBuy = {
          stopPrice: currentPrice * (1 + trailingBuyReboundPercent), // {trailingBuyReboundPercent}% above current price
          triggeredAt: currentPrice,
          activatedDate: currentDate,
          recentPeakReference: recentPeak,
          lastUpdatePrice: currentPrice  // Track the actual bottom price (price when order was last updated)
        };
        transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY ACTIVATED - Stop: ${trailingStopBuy.stopPrice.toFixed(2)}, Triggered by ${(trailingBuyActivationPercent*100).toFixed(1)}% drop from peak ${recentPeak.toFixed(2)}`, 'blue'));
      }
    };

    // Update trailing stop buy (move stop down if price goes down further)
    const updateTrailingStopBuy = (currentPrice) => {
      if (trailingStopBuy) {
        const newStopPrice = currentPrice * (1 + trailingBuyReboundPercent); // Always {trailingBuyReboundPercent}% above current price
        if (newStopPrice < trailingStopBuy.stopPrice) {
          const oldStopPrice = trailingStopBuy.stopPrice;
          trailingStopBuy.stopPrice = newStopPrice;
          trailingStopBuy.lastUpdatePrice = currentPrice;  // Update the actual bottom price
          transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY UPDATED from ${oldStopPrice.toFixed(2)} to ${newStopPrice.toFixed(2)} (Price: ${currentPrice.toFixed(2)})`, 'blue'));
        }
      }
    };

    // Cancel trailing stop buy if price exceeds the peak (limit price)
    const cancelTrailingStopBuyIfAbovePeak = (currentPrice) => {
      if (trailingStopBuy && currentPrice > trailingStopBuy.recentPeakReference) {
        transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY CANCELLED - Price ${currentPrice.toFixed(2)} > limit price ${trailingStopBuy.recentPeakReference.toFixed(2)} (peak)`, 'yellow'));
        trailingStopBuy = null;
        return true;
      }
      return false;
    };

    // Check if trailing stop buy should execute
    const checkTrailingStopBuyExecution = (currentPrice, currentDate) => {
      // Check if buying is disabled by adaptive strategy
      if (!currentParams.buyEnabled) {
        if (trailingStopBuy && verbose) {
          transactionLog.push(colorize(`  INFO: Trailing stop buy BLOCKED - Buying disabled by adaptive strategy (${currentParams.buyPauseReason || 'regime detected'})`, 'yellow'));
        }
        return false;
      }

      if (trailingStopBuy && currentPrice >= trailingStopBuy.stopPrice) {
        // Check if price is still within limit (below peak)
        if (currentPrice <= trailingStopBuy.recentPeakReference) {
          // Trailing stop buy triggered - check if we can execute
          if (lots.length < maxLots) {
            // Calculate dynamic grid spacing for validation
            const respectsGridSpacing = lots.every(lot => {
              const midPrice = (currentPrice + lot.price) / 2;
              const ref = referencePrice || midPrice; // Use midPrice if no reference yet

              let gridSize;
              if (enableDynamicGrid) {
                gridSize = calculateDynamicGridSpacing(midPrice, ref, dynamicGridMultiplier, normalizeToReference);
              } else {
                gridSize = gridIntervalPercent; // Legacy fixed percentage
              }

              return Math.abs(currentPrice - lot.price) / lot.price >= gridSize;
            });
            if (respectsGridSpacing) {
            // Execute the trailing stop buy
            const shares = lotSizeUsd / currentPrice;
            lots.push({ price: currentPrice, shares: shares, date: currentDate });

            // Set reference price on first trade (for normalized dynamic grid)
            if (referencePrice === null) {
              referencePrice = currentPrice;
              if (verbose && enableDynamicGrid && normalizeToReference) {
                transactionLog.push(colorize(`  INFO: Reference price set to ${referencePrice.toFixed(2)} (normalized to $100)`, 'cyan'));
              }
            }

            // Update consecutive sell tracking state
            lastActionType = 'buy';
            lastSellPrice = null; // Reset on buy

            averageCost = recalculateAverageCost();

            // Calculate P&L values after trailing stop buy
            const totalSharesHeldAfterBuy = lots.reduce((sum, lot) => sum + lot.shares, 0);
            const totalCostOfHeldLotsAfterBuy = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
            const unrealizedPNLAfterBuy = (totalSharesHeldAfterBuy * currentPrice) - totalCostOfHeldLotsAfterBuy;
            const totalPNLAfterBuy = realizedPNL + unrealizedPNLAfterBuy;

            const buyDetails = {
              shares: shares,
              lotValue: lotSizeUsd,
              stopPrice: trailingStopBuy.stopPrice,
              peakReference: trailingStopBuy.recentPeakReference
            };

            // Record enhanced transaction
            enhancedTransactions.push({
              date: currentDate,
              type: 'TRAILING_STOP_LIMIT_BUY',
              price: currentPrice,
              shares: shares,
              value: lotSizeUsd,
              lotsDetails: null,
              lotsAfterTransaction: [...lots],
              averageCost: averageCost,
              unrealizedPNL: unrealizedPNLAfterBuy,
              realizedPNL: realizedPNL,
              totalPNL: totalPNLAfterBuy,
              realizedPNLFromTrade: 0,
              ocoOrderDetail: null,
              trailingStopDetail: {
                triggered: true,
                stopPrice: trailingStopBuy.stopPrice,
                limitPrice: trailingStopBuy.recentPeakReference, // Peak price is the limit price
                recentPeakReference: trailingStopBuy.recentPeakReference,
                activatedAt: trailingStopBuy.triggeredAt,
                priceWhenOrderSet: trailingStopBuy.triggeredAt, // Price when trailing stop was triggered
                lastUpdatePrice: trailingStopBuy.lastUpdatePrice, // Actual bottom price when order was last updated
                executionPrice: currentPrice
              }
            });

            // Track this buy transaction for questionable event detection
            trackTransaction(currentDate, 'BUY', currentPrice, buyDetails);

            transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY EXECUTED at ${currentPrice.toFixed(2)} (stop: ${trailingStopBuy.stopPrice.toFixed(2)}). Lots: ${getLotsPrices(lots)}, New Avg Cost: ${averageCost.toFixed(2)}`, 'green'));

            // Clear trailing stop buy and reset peak/bottom tracking
            trailingStopBuy = null;
            resetPeakBottomTracking(currentPrice, currentDate);

              return true; // Transaction occurred
            } else {
              transactionLog.push(colorize(`  INFO: TRAILING STOP BUY blocked at ${currentPrice.toFixed(2)} - violates grid spacing rule`, 'yellow'));
            }
          } else {
            transactionLog.push(colorize(`  INFO: TRAILING STOP BUY blocked at ${currentPrice.toFixed(2)} - max lots reached`, 'yellow'));
          }
        } else {
          // Price exceeded limit price - order should have been cancelled already
          transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY CANCELLED - Price ${currentPrice.toFixed(2)} > limit price ${trailingStopBuy.recentPeakReference.toFixed(2)} (peak)`, 'yellow'));
          trailingStopBuy = null;
        }
      }
      return false; // No transaction
    };

    // Check if trailing stop sell should be activated (when price rises from recent bottom)
    const checkTrailingStopSellActivation = (currentPrice) => {
      if (lots.length > 0 && currentPrice > averageCost && !activeStop && recentBottom && currentPrice >= recentBottom * (1 + trailingSellActivationPercent)) {
        // Price rose {trailingSellActivationPercent}% from recent bottom - activate trailing stop sell
        // Calculate current unrealized P&L
        const totalSharesHeld = lots.reduce((sum, lot) => sum + lot.shares, 0);
        const totalCostOfHeldLots = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
        const unrealizedPNL = (totalSharesHeld * currentPrice) - totalCostOfHeldLots;

        // Only set trailing stop if unrealized P&L > 0
        if (unrealizedPNL > 0) {
          // Calculate lot-level profit requirement (dynamic for consecutive uptrend sells)
          let lotProfitRequirement = profitRequirement; // Default to base
          if (enableConsecutiveIncrementalSellProfit && lastActionType === 'sell' && lastSellPrice !== null && currentPrice > lastSellPrice) {
            // Consecutive uptrend sell - calculate dynamic grid size
            let gridSize;
            if (enableDynamicGrid) {
              gridSize = calculateDynamicGridSpacing(
                currentPrice,
                referencePrice || currentPrice,
                dynamicGridMultiplier,
                normalizeToReference
              );
              if (verbose) {
                transactionLog.push(
                  colorize(`  🔬 Grid calc: currentPrice=${currentPrice.toFixed(2)}, refPrice=${(referencePrice || currentPrice).toFixed(2)}, gridSize=${(gridSize * 100).toFixed(4)}%`, 'cyan')
                );
              }
            } else {
              gridSize = gridIntervalPercent;
            }
            lotProfitRequirement = profitRequirement + gridSize;

            if (verbose) {
              transactionLog.push(
                colorize(`  📈 Consecutive uptrend sell: lot profit req ${(lotProfitRequirement * 100).toFixed(2)}% (base ${(profitRequirement * 100).toFixed(2)}% + grid ${(gridSize * 100).toFixed(2)}%)`, 'cyan')
              );
            }
          }

          // Find the highest-priced lot that is eligible for selling
          // Calculate stop price using parameterized pullback percentage
          const stopPrice = currentPrice * (1 - trailingSellPullbackPercent);
          const minProfitablePrice = averageCost * (1 + profitRequirement); // ✅ BASE for average cost

          transactionLog.push(colorize(`DEBUG LOT SELECTION: currentPrice=${currentPrice.toFixed(2)}, stopPrice=${stopPrice.toFixed(2)}, baseProfitReq=${profitRequirement}, lotProfitReq=${lotProfitRequirement}, averageCost=${averageCost.toFixed(2)}, minProfitablePrice=${minProfitablePrice.toFixed(2)}`, 'cyan'));
          transactionLog.push(colorize(`DEBUG ALL LOTS: ${lots.map(lot => `$${lot.price.toFixed(2)}`).join(', ')}`, 'cyan'));

          // Select lots that would be profitable to sell (meeting profit requirement)
          const eligibleLots = lots.filter(lot => currentPrice > lot.price * (1 + lotProfitRequirement)); // 🔄 DYNAMIC for lot comparison

          transactionLog.push(colorize(`DEBUG ELIGIBLE LOTS: ${eligibleLots.map(lot => `$${lot.price.toFixed(2)}`).join(', ')} (${eligibleLots.length} eligible)`, 'cyan'));

          if (eligibleLots.length > 0) {
            const sortedEligibleLots = eligibleLots.sort((a, b) => b.price - a.price);
            // Select up to maxLotsToSell highest-priced eligible lots
            const lotsToSell = sortedEligibleLots.slice(0, Math.min(maxLotsToSell, sortedEligibleLots.length));

            transactionLog.push(colorize(`DEBUG SELECTED LOTS: ${lotsToSell.map(lot => `$${lot.price.toFixed(2)}`).join(', ')} (${lotsToSell.length} of ${eligibleLots.length} eligible, max ${maxLotsToSell})`, 'cyan'));

            // New pricing logic based on requirements:
            // Stop Price: current price * (1 - trailingSellPullbackPercent) below current price
            // Limit Price: the highest-priced lot among selected lots
            const stopPrice = currentPrice * (1 - trailingSellPullbackPercent);
            const limitPrice = lotsToSell[0].price; // Highest price among selected lots

            activeStop = {
              stopPrice: stopPrice,
              limitPrice: limitPrice,
              lotsToSell: lotsToSell, // Now supports multiple lots
              highestPrice: currentPrice,  // Track highest price for trailing
              recentBottomReference: recentBottom,
              triggerCondition: 'recent_bottom_10pct_rise',
              priceWhenOrderSet: currentPrice,  // Track the price when the trailing stop was first set
              lastUpdatePrice: currentPrice  // Track the actual peak price when order was last updated
            };
            transactionLog.push(colorize(`  ACTION: TRAILING STOP SELL ACTIVATED - Stop: ${stopPrice.toFixed(2)}, Limit: ${limitPrice.toFixed(2)}, Triggered by 20% rise from bottom ${recentBottom.toFixed(2)} (Unrealized P&L: ${unrealizedPNL.toFixed(2)})`, 'yellow'));
          }
        }
      }
    };

    // Update trailing stop when price moves higher (maintains 10% below current price)
    const updateTrailingStop = (currentPrice) => {
      if (activeStop && currentPrice > activeStop.highestPrice) {
        // Keep stop price at current price * (1 - trailingSellPullbackPercent) below current price
        const newStopPrice = currentPrice * (1 - trailingSellPullbackPercent);

        if (newStopPrice > activeStop.stopPrice) {
          const oldStopPrice = activeStop.stopPrice;
          const oldLimitPrice = activeStop.limitPrice;

          // Calculate lot-level profit requirement (same logic as activation)
          let lotProfitRequirement = profitRequirement; // Default to base
          if (enableConsecutiveIncrementalSellProfit && lastActionType === 'sell' && lastSellPrice !== null && currentPrice > lastSellPrice) {
            let gridSize;
            if (enableDynamicGrid) {
              gridSize = calculateDynamicGridSpacing(
                currentPrice,
                referencePrice || currentPrice,
                dynamicGridMultiplier,
                normalizeToReference
              );
            } else {
              gridSize = gridIntervalPercent;
            }
            lotProfitRequirement = profitRequirement + gridSize;
          }

          // Recalculate lot selection with new stop price using profit requirement
          const eligibleLots = lots.filter(lot => currentPrice > lot.price * (1 + lotProfitRequirement)); // 🔄 DYNAMIC

          if (eligibleLots.length > 0) {
            const sortedEligibleLots = eligibleLots.sort((a, b) => b.price - a.price);
            // Select up to maxLotsToSell highest-priced eligible lots
            const newLotsToSell = sortedEligibleLots.slice(0, Math.min(maxLotsToSell, sortedEligibleLots.length));

            activeStop.stopPrice = newStopPrice;
            activeStop.limitPrice = newLotsToSell[0].price; // Highest price among selected lots
            activeStop.lotsToSell = newLotsToSell; // Now supports multiple lots
            activeStop.highestPrice = currentPrice;
            activeStop.lastUpdatePrice = currentPrice;

            transactionLog.push(colorize(`  ACTION: TRAILING STOP SELL UPDATED from stop ${oldStopPrice.toFixed(2)} to ${newStopPrice.toFixed(2)}, limit ${oldLimitPrice.toFixed(2)} to ${newLotsToSell[0].price.toFixed(2)}, lots: ${newLotsToSell.map(lot => `$${lot.price.toFixed(2)}`).join(', ')} (High: ${currentPrice.toFixed(2)})`, 'cyan'));
            transactionLog.push(colorize(`  DEBUG: Updated eligible lots: ${eligibleLots.map(lot => `$${lot.price.toFixed(2)}`).join(', ')}, selected: ${newLotsToSell.map(lot => `$${lot.price.toFixed(2)}`).join(', ')}`, 'cyan'));
          } else {
            // No eligible lots, cancel the stop
            activeStop = null;
            transactionLog.push(colorize(`  ACTION: TRAILING STOP CANCELLED - No eligible lots at price ${currentPrice.toFixed(2)} with maxEligiblePrice ${maxEligiblePrice.toFixed(2)}`, 'yellow'));
          }
        }
      }
    };

    // Cancel trailing stop if price falls below profit requirement threshold
    const cancelTrailingStopIfUnprofitable = (currentPrice) => {
      const minProfitablePrice = averageCost * (1 + profitRequirement);
      if (activeStop && currentPrice <= minProfitablePrice) {
        const cancelledStopPrice = activeStop.stopPrice;
        activeStop = null;
        transactionLog.push(colorize(`  ACTION: TRAILING STOP CANCELLED - Price ${currentPrice.toFixed(2)} <= min profitable price ${minProfitablePrice.toFixed(2)} (avg cost ${averageCost.toFixed(2)}, profit requirement ${(profitRequirement*100).toFixed(1)}%, stop was ${cancelledStopPrice.toFixed(2)})`, 'yellow'));
      }
    };


    // Enhanced transaction records for UI
    const enhancedTransactions = [];

    // Main loop through each day's data
    for (let i = 0; i < pricesWithIndicators.length; i++) {
      const dayData = pricesWithIndicators[i];
      const currentPrice = dayData.adjusted_close;
      const holdingsAtStartOfDay = [...lots];
      averageCost = recalculateAverageCost();

      const marketCondition = assessMarketCondition(dayData);

      // Adaptive Strategy: Check and adjust parameters based on market regime
      if (adaptiveStrategy && adaptiveStrategy.shouldCheckScenario(i)) {
        const adaptationResult = await adaptiveStrategy.checkAndAdapt({
          priceHistory: pricesWithIndicators.slice(0, i + 1),
          transactionHistory: enhancedTransactions,
          currentParameters: currentParams,
          currentDate: dayData.date,
          dayIndex: i
        });

        if (adaptationResult.regimeChange && verbose) {
          const scenario = adaptationResult.scenario;
          transactionLog.push(colorize(`\n🔄 REGIME CHANGE DETECTED on ${dayData.date}`, 'magenta'));
          transactionLog.push(colorize(`   Scenario: ${scenario.type.toUpperCase()}`, 'magenta'));
          transactionLog.push(colorize(`   Confidence: ${(scenario.confidence * 100).toFixed(1)}%`, 'magenta'));
          transactionLog.push(colorize(`   Buy Operations: ${adaptationResult.adjustedParameters.buyEnabled ? '✅ ENABLED' : '🛑 DISABLED'}`, 'magenta'));
          transactionLog.push(colorize(`   Sell Operations: ${adaptationResult.adjustedParameters.sellEnabled ? '✅ ENABLED' : '🛑 DISABLED'}`, 'magenta'));
          if (adaptationResult.adjustedParameters.buyPauseReason) {
            transactionLog.push(colorize(`   Buy Pause Reason: ${adaptationResult.adjustedParameters.buyPauseReason}`, 'yellow'));
          }
          if (adaptationResult.adjustedParameters.sellPauseReason) {
            transactionLog.push(colorize(`   Sell Pause Reason: ${adaptationResult.adjustedParameters.sellPauseReason}`, 'yellow'));
          }
        }

        // Update current parameters with adjusted values
        currentParams = adaptationResult.adjustedParameters;
      }

      // Daily PNL Calculation
      const totalSharesHeld = holdingsAtStartOfDay.reduce((sum, lot) => sum + lot.shares, 0);
      const totalCostOfHeldLots = holdingsAtStartOfDay.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
      const unrealizedPNL = (totalSharesHeld * currentPrice) - totalCostOfHeldLots;
      const totalPNL = realizedPNL + unrealizedPNL;

      // Portfolio tracking
      // When no positions are held, show the available capital as baseline
      const maxExposure = maxLots * lotSizeUsd;
      const deployedCapital = totalCostOfHeldLots;
      const availableCapital = maxExposure - deployedCapital;
      const currentPortfolioValue = availableCapital + totalCostOfHeldLots + unrealizedPNL + realizedPNL;

      dailyPortfolioValues.push(currentPortfolioValue);
      dailyCapitalDeployed.push(totalCostOfHeldLots);

      // Removed remaining lots loss tolerance check as per requirements

      const pad = (str, len) => String(str).padEnd(len);
      let actionsOccurred = false;
      const dayStartLogLength = transactionLog.length;

      // Initialize peak/bottom tracking on first day if not started
      if (recentPeak === null || recentBottom === null) {
        recentPeak = currentPrice;
        recentBottom = currentPrice;
        lastTransactionDate = dayData.date;
      }

      // Update recent peak and bottom tracking
      updatePeakBottomTracking(currentPrice);

      // Check if trailing stop sell should be activated (price rises 10% from recent bottom)
      checkTrailingStopSellActivation(currentPrice);

      // Update trailing stop if price has moved higher
      updateTrailingStop(currentPrice);

      // Cancel trailing stop if price falls below average cost (no longer profitable)
      cancelTrailingStopIfUnprofitable(currentPrice);

      // HIGHEST PRIORITY: Execute trailing stop sells first
      if (activeStop && currentPrice <= activeStop.stopPrice) {
        // Check if selling is disabled by adaptive strategy
        if (!currentParams.sellEnabled) {
          if (verbose) {
            transactionLog.push(colorize(`  INFO: Trailing stop sell BLOCKED - Selling disabled by adaptive strategy (${currentParams.sellPauseReason || 'regime detected'})`, 'yellow'));
          }
          // Cancel the stop since we can't execute it
          activeStop = null;
        } else {
          const { stopPrice, limitPrice, lotsToSell } = activeStop;

          // Always use current price as execution price
          const executionPrice = currentPrice;

          // Execute only if execution price > limit price AND execution price > average cost * (1 + profitRequirement)
          const minProfitablePrice = averageCost * (1 + profitRequirement);
          if (executionPrice > limitPrice && executionPrice > minProfitablePrice) {
          let totalSaleValue = 0;
          let costOfSoldLots = 0;

          lotsToSell.forEach(soldLot => {
            totalSaleValue += soldLot.shares * executionPrice;
            costOfSoldLots += soldLot.shares * soldLot.price;
          });

          const pnl = totalSaleValue - costOfSoldLots;
          realizedPNL += pnl;

          // Calculate unrealized P&L before removing sold lots
          const totalSharesHeldBeforeSell = lots.reduce((sum, lot) => sum + lot.shares, 0);
          const totalCostOfHeldLotsBeforeSell = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
          const unrealizedPNLBeforeSell = (totalSharesHeldBeforeSell * currentPrice) - totalCostOfHeldLotsBeforeSell;

          lots = lots.filter(l => !lotsToSell.find(sl => sl.price === l.price && sl.shares === l.shares));
          averageCost = recalculateAverageCost();

          // Calculate values after sell
          const totalSharesHeldAfterSell = lots.reduce((sum, lot) => sum + lot.shares, 0);
          const totalCostOfHeldLotsAfterSell = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
          const unrealizedPNLAfterSell = (totalSharesHeldAfterSell * currentPrice) - totalCostOfHeldLotsAfterSell;
          const totalPNLAfterSell = realizedPNL + unrealizedPNLAfterSell;

          // Calculate annualized return for this trade based on actual holding period
          // Find the buy date for the lots being sold (use the lot with the target price)
          const soldLotPrice = activeStop.limitPrice; // This is the price of the lot being sold
          const buyTransaction = enhancedTransactions.find(t =>
            t.type === 'TRAILING_STOP_LIMIT_BUY' && Math.abs(t.price - soldLotPrice) < 0.01
          );

          let actualDaysHeld = 1; // Default to 1 day if we can't find the buy date
          if (buyTransaction) {
            actualDaysHeld = Math.ceil((new Date(dayData.date) - new Date(buyTransaction.date)) / (1000 * 60 * 60 * 24));
            actualDaysHeld = Math.max(1, actualDaysHeld); // Ensure at least 1 day
          }

          const totalReturnPercent = costOfSoldLots > 0 ? pnl / costOfSoldLots : 0;
          const annualizedReturn = actualDaysHeld > 0 ?
            Math.pow(1 + totalReturnPercent, 365 / actualDaysHeld) - 1 : 0;
          const annualizedReturnPercent = annualizedReturn * 100;

          // Record separate enhanced transactions for each lot sold
          lotsToSell.forEach((soldLot, index) => {
            // Calculate individual lot metrics
            const lotSaleValue = soldLot.shares * executionPrice;
            const lotCost = soldLot.price * soldLot.shares;
            const lotPNL = lotSaleValue - lotCost;
            const lotTotalReturn = lotCost > 0 ? lotPNL / lotCost : 0;

            // Calculate holding period for this specific lot (from when it was bought to when it's sold)
            const buyTransaction = enhancedTransactions.find(tx =>
              tx.type === 'TRAILING_STOP_LIMIT_BUY' &&
              tx.price === soldLot.price &&
              tx.date <= dayData.date
            );
            const actualDaysHeldForLot = buyTransaction ?
              Math.max(1, Math.ceil((new Date(dayData.date) - new Date(buyTransaction.date)) / (1000 * 60 * 60 * 24))) :
              actualDaysHeld;

            const lotAnnualizedReturn = actualDaysHeldForLot > 0 ?
              Math.pow(1 + lotTotalReturn, 365 / actualDaysHeldForLot) - 1 : 0;

            const transactionDetails = {
              lotPrice: soldLot.price,
              shares: soldLot.shares,
              pnl: lotPNL,
              annualizedReturn: lotAnnualizedReturn * 100,
              daysHeld: actualDaysHeldForLot
            };

            enhancedTransactions.push({
              date: dayData.date,
              type: 'SELL',
              price: executionPrice,
              shares: soldLot.shares,
              value: lotSaleValue,
              lotPrice: soldLot.price, // Original purchase price of this specific lot
              lotsDetails: [{ price: soldLot.price, shares: soldLot.shares, date: buyTransaction?.date || dayData.date }], // Individual lot details
              lotsAfterTransaction: [...lots], // Portfolio state after all lots are sold
              averageCost: averageCost,
              unrealizedPNL: unrealizedPNLAfterSell,
              realizedPNL: realizedPNL,
              totalPNL: totalPNLAfterSell,
              realizedPNLFromTrade: lotPNL, // Individual lot P&L
              annualizedReturn: lotAnnualizedReturn, // Individual lot annualized return
              annualizedReturnPercent: lotAnnualizedReturn * 100,
              actualDaysHeld: actualDaysHeldForLot, // Individual lot holding period
              ocoOrderDetail: null,
              trailingStopDetail: {
                triggered: true,
                stopPrice: stopPrice,
                limitPrice: limitPrice,
                executionPrice: executionPrice,
                highestPriceBeforeStop: activeStop.highestPrice,
                recentBottomReference: activeStop.recentBottomReference,
                priceWhenOrderSet: activeStop.priceWhenOrderSet,
                lastUpdatePrice: activeStop.lastUpdatePrice,
                batchSellIndex: index, // Indicates this was part of a batch sell
                batchSellTotal: lotsToSell.length // Total lots sold in this batch
              }
            });

            // Track this sell transaction for questionable event detection
            trackTransaction(dayData.date, 'SELL', executionPrice, transactionDetails);
          });

          // Log overall batch sale summary
          transactionLog.push(
            colorize(`  ACTION: TRAILING STOP SELL EXECUTED - ${lotsToSell.length} lots at ${executionPrice.toFixed(2)} (stop: ${stopPrice.toFixed(2)})`, 'red')
          );

          // Log individual lot sales
          lotsToSell.forEach((soldLot, index) => {
            const lotSaleValue = soldLot.shares * executionPrice;
            const lotCost = soldLot.price * soldLot.shares;
            const lotPNL = lotSaleValue - lotCost;
            const lotTotalReturn = lotCost > 0 ? lotPNL / lotCost : 0;

            const buyTransaction = enhancedTransactions.find(tx =>
              tx.type === 'TRAILING_STOP_LIMIT_BUY' &&
              tx.price === soldLot.price &&
              tx.date <= dayData.date
            );
            const actualDaysHeldForLot = buyTransaction ?
              Math.max(1, Math.ceil((new Date(dayData.date) - new Date(buyTransaction.date)) / (1000 * 60 * 60 * 24))) :
              actualDaysHeld;

            const lotAnnualizedReturn = actualDaysHeldForLot > 0 ?
              Math.pow(1 + lotTotalReturn, 365 / actualDaysHeldForLot) - 1 : 0;

            transactionLog.push(
              colorize(`    Lot ${index + 1}/${lotsToSell.length}: Sold ${soldLot.shares.toFixed(4)} shares @ $${soldLot.price.toFixed(2)} -> $${executionPrice.toFixed(2)}, PNL: ${lotPNL.toFixed(2)}, Ann.Return: ${(lotAnnualizedReturn * 100).toFixed(2)}% (${actualDaysHeldForLot} days)`, 'red')
            );
          });

          transactionLog.push(
            colorize(`    Total PNL: ${pnl.toFixed(2)}, Remaining lots: ${getLotsPrices(lots)}, New Avg Cost: ${averageCost.toFixed(2)}`, 'red')
          );

          // Update consecutive sell tracking state
          lastActionType = 'sell';
          lastSellPrice = executionPrice;

          // Clear active stop and reset peak/bottom tracking after sell
          activeStop = null;
          resetPeakBottomTracking(currentPrice, dayData.date);

          actionsOccurred = true;
        } else {
          const reason = executionPrice <= limitPrice
            ? `Execution price ${executionPrice.toFixed(2)} <= limit price ${limitPrice.toFixed(2)}`
            : `Execution price ${executionPrice.toFixed(2)} <= average cost ${averageCost.toFixed(2)} (would be unprofitable)`;
          transactionLog.push(
            colorize(`  INFO: Trailing stop execution BLOCKED - ${reason}`, 'yellow')
          );
        }
        }
      }

      // SECOND PRIORITY: Execute trailing stop buy orders
      // First, check if we need to cancel due to price exceeding limit
      const wasCancelled = cancelTrailingStopBuyIfAbovePeak(currentPrice);
      if (wasCancelled) {
        actionsOccurred = true;
      }

      const trailingStopBuyExecuted = checkTrailingStopBuyExecution(currentPrice, dayData.date);
      if (trailingStopBuyExecuted) {
        actionsOccurred = true;
      } else {
        // Check if trailing stop buy should be activated (only if not currently active)
        if (!trailingStopBuy) {
          checkTrailingStopBuyActivation(currentPrice, dayData.date);
        }

        // Update trailing stop buy if active
        updateTrailingStopBuy(currentPrice);
      }

      // ALL BUYING - Only through trailing stop buy orders (no initial purchase)

      if (transactionLog.length > dayStartLogLength) {
        actionsOccurred = true;
      }

      // Create header and log entries
      if (actionsOccurred) {
        let header = `--- ${dayData.date} ---\n`;
        header += `${pad('Price: ' + currentPrice.toFixed(2), 18)}| `;
        header += `${pad('R.PNL: ' + realizedPNL.toFixed(0), 18)}| `;
        header += `${pad('U.PNL: ' + unrealizedPNL.toFixed(0), 18)}| `;
        header += `${pad('T.PNL: ' + totalPNL.toFixed(0), 18)}| `;
        header += `Holdings: ${getLotsPrices(holdingsAtStartOfDay)}`;

        transactionLog.splice(dayStartLogLength, 0, header);
      } else if (verbose) {
        // For command line, show all days. For API, only show action days
        const singleLine = `--- ${dayData.date} --- ${pad('Price: ' + currentPrice.toFixed(2), 18)}| ${pad('R.PNL: ' + realizedPNL.toFixed(0), 18)}| ${pad('U.PNL: ' + unrealizedPNL.toFixed(0), 18)}| ${pad('T.PNL: ' + totalPNL.toFixed(0), 18)}| Holdings: ${getLotsPrices(holdingsAtStartOfDay)}`;
        transactionLog.push(singleLine);
      }
    }

    // Calculate final results
    const totalSharesHeld = lots.reduce((sum, lot) => sum + lot.shares, 0);
    const totalCostOfHeldLots = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
    const finalPrice = pricesWithIndicators[pricesWithIndicators.length - 1].adjusted_close;
    const marketValueOfHeldLots = totalSharesHeld * finalPrice;
    const unrealizedPNL = marketValueOfHeldLots - totalCostOfHeldLots;
    const totalPNL = realizedPNL + unrealizedPNL;
    const maxExposure = maxLots * lotSizeUsd;
    const returnOnMaxExposure = (totalPNL / maxExposure) * 100;

    // Calculate metrics
    const metrics = calculateMetrics(dailyPortfolioValues, dailyCapitalDeployed, transactionLog, pricesWithIndicators, enhancedTransactions);
    const initialCapital = lotSizeUsd * maxLots;
    const buyAndHoldResults = calculateBuyAndHold(pricesWithIndicators, initialCapital, metrics.avgCapitalDeployed);
    const dcaFinalValue = totalCostOfHeldLots + realizedPNL + unrealizedPNL;
    // Compare P&L percentages: DCA return % - Buy & Hold return %
    // Example: if DCA = +15% and Buy & Hold = +10%, then outperformance = +15% - (+10%) = +5%
    const outperformancePercent = metrics.totalReturnPercent - buyAndHoldResults.totalReturnPercent;
    const outperformance = dcaFinalValue - buyAndHoldResults.finalValue;

    // Calculate individual trade annualized returns including current holdings
    const tradeAnalysis = calculateTradeAnnualizedReturns(enhancedTransactions, startDate, endDate, lots, finalPrice, lotSizeUsd);

    // Print summary if verbose
    if (verbose) {
      console.log('\n--- Transaction Log ---');
      transactionLog.forEach(log => console.log(log));

      console.log('\n--- Final Summary ---');
      console.log(`Ending Date: ${pricesWithIndicators[pricesWithIndicators.length - 1].date}`);
      console.log(`Final Held Lots: ${lots.length}`);
      console.log(`Total Shares Held: ${totalSharesHeld.toFixed(2)}`);
      console.log(`Average Cost of Holdings: ${totalSharesHeld > 0 ? (totalCostOfHeldLots / totalSharesHeld).toFixed(2) : 'N/A'}`);
      console.log(`Final Market Price: ${finalPrice.toFixed(2)}`);
      console.log(`Market Value of Holdings: ${marketValueOfHeldLots.toFixed(2)}`);
      console.log(`\nRealized P&L: ${realizedPNL.toFixed(2)}`);
      console.log(`Unrealized P&L: ${unrealizedPNL.toFixed(2)}`);
      console.log(`Total P&L: ${totalPNL.toFixed(2)}`);
      console.log(`Return on Max Exposure (${maxExposure}): ${returnOnMaxExposure.toFixed(2)}%`);

      console.log(`\n--- Backtesting Metrics ---`);
      console.log(`Total Return: ${metrics.totalReturn.toFixed(2)} USD (${metrics.totalReturnPercent.toFixed(2)}%)`);
      console.log(`DCA Annualized Return: ${metrics.annualizedReturnPercent.toFixed(2)}%`);
      console.log(`Max Drawdown: ${metrics.maxDrawdown.toFixed(2)} USD (${metrics.maxDrawdownPercent.toFixed(2)}%)`);
      console.log(`Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
      console.log(`Win Rate: ${metrics.winRate.toFixed(2)}%`);
      console.log(`Average Trade Annualized Return: ${tradeAnalysis.averageAnnualizedReturnPercent.toFixed(2)}%`);
      console.log(`  - Completed Trades Only: ${tradeAnalysis.tradeOnlyAverageAnnualizedReturnPercent.toFixed(2)}% (${tradeAnalysis.individualTradeReturns.length} trades)`);
      console.log(`  - Current Holdings Only: ${tradeAnalysis.holdingOnlyAverageAnnualizedReturnPercent.toFixed(2)}% (${tradeAnalysis.currentHoldingReturns.length} holdings)`);
      console.log(`  - Combined (All Positions): ${tradeAnalysis.averageAnnualizedReturnPercent.toFixed(2)}% (${tradeAnalysis.allReturns.length} total)`);
      console.log(`Total Trades: ${metrics.totalTrades}`);
      console.log(`Volatility: ${metrics.volatility.toFixed(2)}%`);

      // Add detailed current holdings calculations
      if (tradeAnalysis.currentHoldingReturns.length > 0) {
        console.log(`\n--- Current Holdings Annualized Return Calculations ---`);
        tradeAnalysis.currentHoldingReturns.forEach((holding, index) => {
          console.log(`Holding ${index + 1}: Buy @$${holding.buyPrice.toFixed(2)} → Current @$${holding.sellPrice.toFixed(2)}`);
          console.log(`  Investment: $${holding.investment.toFixed(2)}, Current Value: $${(holding.investment + holding.returns).toFixed(2)}`);
          console.log(`  P&L: $${holding.returns.toFixed(2)} (${holding.returnPercent.toFixed(2)}%)`);
          console.log(`  Annualized Return: ${holding.annualizedReturnPercent.toFixed(2)}% (${holding.totalBacktestDays} days backtest period)`);
          console.log(`  Formula: ${holding.returnPercent < 0 ? `(1 - |${holding.returnPercent.toFixed(2)}%|) ^ (365 / ${holding.totalBacktestDays}) - 1` : `(1 + ${holding.returnPercent.toFixed(2)}%) ^ (365 / ${holding.totalBacktestDays}) - 1`}`);
        });
      }

      console.log(`\n--- Strategy Comparison (DCA vs Buy & Hold) ---`);
      console.log(`DCA Final Portfolio Value: ${dcaFinalValue.toFixed(2)} USD`);
      console.log(`Buy & Hold Final Value: ${buyAndHoldResults.finalValue.toFixed(2)} USD`);
      console.log(`DCA Total Return: ${metrics.totalReturnPercent.toFixed(2)}% vs B&H: ${buyAndHoldResults.totalReturnPercent.toFixed(2)}%`);
      console.log(`DCA Annualized Return: ${metrics.annualizedReturnPercent.toFixed(2)}% vs B&H: ${buyAndHoldResults.annualizedReturnPercent.toFixed(2)}%`);
      console.log(`Outperformance: ${outperformance.toFixed(2)} USD (${outperformancePercent.toFixed(2)}%)`);
      console.log(`DCA Max Drawdown: ${metrics.maxDrawdownPercent.toFixed(2)}% vs B&H: ${buyAndHoldResults.maxDrawdownPercent.toFixed(2)}%`);

      // Report questionable events
      if (questionableEvents.length > 0) {
        console.log(`\n--- Questionable Events (${questionableEvents.length}) ---`);
        questionableEvents.forEach((event, index) => {
          console.log(`${index + 1}. ${event.date}: ${event.description} [${event.severity}]`);
        });
      }
    }

    // Calculate comprehensive performance metrics
    const performanceCalculator = new PerformanceCalculatorService();

    // Prepare trades data for performance calculator
    const tradesForPerformance = enhancedTransactions
      .filter(t => t.type === 'SELL')
      .map(t => ({
        entryDate: t.lotsDetails && t.lotsDetails[0] ? t.lotsDetails[0].date : startDate,
        exitDate: t.date,
        profit: t.realizedPNLFromTrade || 0,
        shares: t.shares || 0
      }));

    const performanceMetrics = performanceCalculator.calculateComprehensiveMetrics({
      dailyPortfolioValues: dailyPortfolioValues,
      dailyCapitalDeployed: dailyCapitalDeployed,
      trades: tradesForPerformance,
      maxExposure: maxLots * lotSizeUsd,
      startDate: startDate,
      endDate: endDate
    });

    // Add performance metrics breakdown to transaction log
    const initialValue = dailyPortfolioValues[0] || 0;
    const finalValue = dailyPortfolioValues[dailyPortfolioValues.length - 1] || 0;
    const totalDays = dailyPortfolioValues.length;
    const totalYears = totalDays / 252;
    const maxDeployedCapital = performanceMetrics.maxDeployedCapital;
    const avgDeployedCapital = performanceMetrics.avgDeployedCapital;
    // maxExposure already declared above, reuse it

    transactionLog.push('');
    transactionLog.push('========== PERFORMANCE METRICS CALCULATION BREAKDOWN ==========');
    transactionLog.push('');
    transactionLog.push('INPUT VALUES:');
    transactionLog.push(`   Initial Portfolio Value: $${initialValue.toFixed(2)}`);
    transactionLog.push(`   Final Portfolio Value: $${finalValue.toFixed(2)}`);
    transactionLog.push(`   Max Capital Deployed: $${maxDeployedCapital.toFixed(2)}`);
    transactionLog.push(`   Avg Capital Deployed: $${avgDeployedCapital.toFixed(2)}`);
    transactionLog.push(`   Max Exposure (Available): $${maxExposure.toFixed(2)}`);
    transactionLog.push(`   Total Days: ${totalDays} (${totalYears.toFixed(2)} years)`);
    transactionLog.push(`   Number of Trades: ${tradesForPerformance.length}`);
    transactionLog.push('');
    transactionLog.push('RETURNS CALCULATIONS:');
    transactionLog.push(`   Total Return = (Final - Initial) / Initial`);
    transactionLog.push(`              = ($${finalValue.toFixed(2)} - $${initialValue.toFixed(2)}) / $${initialValue.toFixed(2)}`);
    transactionLog.push(`              = $${(finalValue - initialValue).toFixed(2)} / $${initialValue.toFixed(2)}`);
    transactionLog.push(`              = ${performanceMetrics.totalReturn.toFixed(4)} = ${performanceMetrics.totalReturnPercent.toFixed(2)}%`);
    transactionLog.push('');
    transactionLog.push(`   CAGR = (Final / Initial)^(1/Years) - 1`);
    transactionLog.push(`        = ($${finalValue.toFixed(2)} / $${initialValue.toFixed(2)})^(1/${totalYears.toFixed(2)}) - 1`);
    transactionLog.push(`        = ${(finalValue/initialValue).toFixed(4)}^${(1/totalYears).toFixed(4)} - 1`);
    transactionLog.push(`        = ${performanceMetrics.cagr.toFixed(4)} = ${performanceMetrics.cagrPercent.toFixed(2)}%`);
    transactionLog.push('');
    transactionLog.push(`   Return on Max Deployed = (Final - Max Capital) / Max Capital`);
    transactionLog.push(`                         = ($${finalValue.toFixed(2)} - $${maxDeployedCapital.toFixed(2)}) / $${maxDeployedCapital.toFixed(2)}`);
    transactionLog.push(`                         = $${(finalValue - maxDeployedCapital).toFixed(2)} / $${maxDeployedCapital.toFixed(2)}`);
    transactionLog.push(`                         = ${performanceMetrics.returnOnMaxDeployed.toFixed(4)} = ${performanceMetrics.returnOnMaxDeployedPercent.toFixed(2)}%`);
    transactionLog.push('');
    transactionLog.push(`   CAGR on Max Deployed = (Final / Max Capital)^(1/Years) - 1`);
    transactionLog.push(`                       = ($${finalValue.toFixed(2)} / $${maxDeployedCapital.toFixed(2)})^(1/${totalYears.toFixed(2)}) - 1`);
    transactionLog.push(`                       = ${(finalValue/maxDeployedCapital).toFixed(4)}^${(1/totalYears).toFixed(4)} - 1`);
    transactionLog.push(`                       = ${performanceMetrics.cagrOnMaxDeployed.toFixed(4)} = ${performanceMetrics.cagrOnMaxDeployedPercent.toFixed(2)}%`);
    transactionLog.push('');
    transactionLog.push(`   Return on Avg Deployed = (Final - Avg Capital) / Avg Capital`);
    transactionLog.push(`                         = ($${finalValue.toFixed(2)} - $${avgDeployedCapital.toFixed(2)}) / $${avgDeployedCapital.toFixed(2)}`);
    transactionLog.push(`                         = $${(finalValue - avgDeployedCapital).toFixed(2)} / $${avgDeployedCapital.toFixed(2)}`);
    transactionLog.push(`                         = ${performanceMetrics.returnOnAvgDeployed.toFixed(4)} = ${performanceMetrics.returnOnAvgDeployedPercent.toFixed(2)}%`);
    transactionLog.push('');
    transactionLog.push(`   CAGR on Avg Deployed = (Final / Avg Capital)^(1/Years) - 1`);
    transactionLog.push(`                       = ($${finalValue.toFixed(2)} / $${avgDeployedCapital.toFixed(2)})^(1/${totalYears.toFixed(2)}) - 1`);
    transactionLog.push(`                       = ${(finalValue/avgDeployedCapital).toFixed(4)}^${(1/totalYears).toFixed(4)} - 1`);
    transactionLog.push(`                       = ${performanceMetrics.cagrOnAvgDeployed.toFixed(4)} = ${performanceMetrics.cagrOnAvgDeployedPercent.toFixed(2)}%`);
    transactionLog.push('');
    transactionLog.push(`   Time-Weighted Return = ${performanceMetrics.timeWeightedReturn.toFixed(4)} = ${performanceMetrics.timeWeightedReturnPercent.toFixed(2)}%`);
    transactionLog.push('');
    transactionLog.push('RISK METRICS:');
    transactionLog.push(`   Sharpe Ratio: ${performanceMetrics.sharpeRatio.toFixed(3)}`);
    transactionLog.push(`   Sortino Ratio: ${performanceMetrics.sortinoRatio.toFixed(3)}`);
    transactionLog.push(`   Calmar Ratio = CAGR / Max Drawdown`);
    transactionLog.push(`                = ${performanceMetrics.cagr.toFixed(4)} / ${(performanceMetrics.maxDrawdown).toFixed(4)}`);
    transactionLog.push(`                = ${performanceMetrics.calmarRatio.toFixed(3)}`);
    transactionLog.push(`   Max Drawdown: ${performanceMetrics.maxDrawdownPercent.toFixed(2)}%`);
    transactionLog.push(`   Avg Drawdown: ${performanceMetrics.avgDrawdownPercent.toFixed(2)}%`);
    transactionLog.push('');
    transactionLog.push('TRADING EFFICIENCY:');
    transactionLog.push(`   Win Rate: ${performanceMetrics.winRatePercent.toFixed(2)}%`);
    transactionLog.push(`   Profit Factor: ${performanceMetrics.profitFactor.toFixed(3)}`);
    transactionLog.push(`   Expectancy: $${performanceMetrics.expectancy.toFixed(2)}`);
    transactionLog.push(`   Avg Win: $${performanceMetrics.avgWin.toFixed(2)}`);
    transactionLog.push(`   Avg Loss: $${performanceMetrics.avgLoss.toFixed(2)}`);
    transactionLog.push(`   Avg Holding Period: ${performanceMetrics.avgHoldingPeriod.toFixed(1)} days`);
    transactionLog.push(`   Profit Per Day Held: $${performanceMetrics.profitPerDayHeld.toFixed(2)}`);
    transactionLog.push('');
    transactionLog.push('CAPITAL EFFICIENCY:');
    transactionLog.push(`   Capital Utilization = Avg Deployed / Max Exposure`);
    transactionLog.push(`                      = $${avgDeployedCapital.toFixed(2)} / $${maxExposure.toFixed(2)}`);
    transactionLog.push(`                      = ${performanceMetrics.capitalUtilization.toFixed(4)} = ${performanceMetrics.capitalUtilizationPercent.toFixed(2)}%`);
    transactionLog.push(`   Avg Idle Capital: $${performanceMetrics.avgIdleCapital.toFixed(2)}`);
    transactionLog.push(`   Total Opportunity Cost: $${performanceMetrics.opportunityCost.toFixed(2)}`);
    transactionLog.push(`   Opportunity Cost Adjusted Return: ${performanceMetrics.opportunityCostAdjustedReturnPercent.toFixed(2)}%`);
    transactionLog.push('');
    transactionLog.push('============================================================');

    // Calculate trade statistics for scenario detection
    const sellTransactions = enhancedTransactions.filter(t => t.type === 'SELL');
    const winningTrades = sellTransactions.filter(t => t.realizedPNLFromTrade > 0).length;
    const losingTrades = sellTransactions.filter(t => t.realizedPNLFromTrade <= 0).length;

    // Prepare result object for scenario detection
    const backtestResult = {
      strategy: 'SHARED_CORE',
      symbol: symbol,
      startDate: startDate,
      endDate: endDate,
      finalLots: lots.length,
      totalSharesHeld: totalSharesHeld,
      averageCostOfHoldings: totalSharesHeld > 0 ? totalCostOfHeldLots / totalSharesHeld : 0,
      finalMarketPrice: finalPrice,
      marketValueOfHoldings: marketValueOfHeldLots,
      realizedPNL: realizedPNL,
      unrealizedPNL: unrealizedPNL,
      totalPNL: totalPNL,
      returnOnMaxExposure: returnOnMaxExposure,
      totalReturn: metrics.totalReturn,
      totalReturnPercent: metrics.totalReturnPercent,
      annualizedReturn: metrics.annualizedReturn,
      annualizedReturnPercent: metrics.annualizedReturnPercent,
      maxDrawdown: metrics.maxDrawdown,
      maxDrawdownPercent: metrics.maxDrawdownPercent,
      sharpeRatio: metrics.sharpeRatio,
      winRate: metrics.winRate,
      totalTrades: metrics.totalTrades,
      avgCapitalDeployed: metrics.avgCapitalDeployed,
      maxCapitalDeployed: metrics.maxCapitalDeployed,
      combinedWeightedReturn: metrics.combinedWeightedReturn,
      volatility: metrics.volatility,
      tradeAnalysis: tradeAnalysis,
      dcaFinalValue: dcaFinalValue,
      buyAndHoldResults: buyAndHoldResults,
      outperformance: outperformance,
      outperformancePercent: outperformancePercent,
      transactionLog: transactionLog,
      lots: lots,
      enhancedTransactions: enhancedTransactions,
      questionableEvents: questionableEvents,

      // Add comprehensive performance metrics
      performanceMetrics: performanceMetrics,

      // Add backtest parameters for reference
      backtestParameters: {
        symbol,
        startDate,
        endDate,
        lotSizeUsd,
        maxLots,
        maxLotsToSell,
        gridIntervalPercent,
        profitRequirement,
        trailingBuyActivationPercent,
        trailingBuyReboundPercent,
        trailingSellActivationPercent,
        trailingSellPullbackPercent,
        enableDynamicGrid,
        normalizeToReference,
        dynamicGridMultiplier,
        enableConsecutiveIncrementalSellProfit,
        enableScenarioDetection,
        enableAdaptiveStrategy: params.enableAdaptiveStrategy || false,
        adaptationCheckIntervalDays: params.adaptationCheckIntervalDays || 30,
        adaptationRollingWindowDays: params.adaptationRollingWindowDays || 90,
        minDataDaysBeforeAdaptation: params.minDataDaysBeforeAdaptation || 90,
        confidenceThreshold: params.confidenceThreshold || 0.7
      },

      // Add adaptive strategy results if enabled
      adaptiveStrategy: adaptiveStrategy ? {
        enabled: true,
        adaptationHistory: adaptiveStrategy.getAdaptationHistory(),
        regimeChanges: adaptiveStrategy.regimeChangeCount,
        finalScenario: adaptiveStrategy.currentScenario
      } : {
        enabled: false
      },

      // Add transactions for scenario analysis
      transactions: enhancedTransactions,
      winningTrades: winningTrades,
      losingTrades: losingTrades,
      buyAndHoldReturn: buyAndHoldResults.totalReturn
    };

    // Run scenario detection if enabled
    const scenarioAnalysis = detectScenario(backtestResult, enableScenarioDetection);

    // Add scenario analysis to result
    if (scenarioAnalysis) {
      backtestResult.scenarioAnalysis = scenarioAnalysis;
    }

    console.log(`🔍 DCA Backtest Debug - Enhanced Transactions: ${enhancedTransactions.length} total`);

    return backtestResult;

  } catch (error) {
    if (verbose) {
      console.error('Error running DCA backtest:', error);
    }
    throw error;
  }
}

module.exports = {
  runDCABacktest,
  calculateMetrics,
  calculatePortfolioDrawdown,
  assessMarketCondition,
  calculateBuyAndHold
};
