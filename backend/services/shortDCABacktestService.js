const database = require('../database');
const AdaptiveStrategyService = require('./adaptiveStrategyService');
const {
  calculatePortfolioDrawdown,
  assessMarketCondition,
  calculateShortAndHold: calculateShortAndHoldUtil,
  calculateSharpeRatio,
  calculateWinRate,
  validateBacktestParameters,
  calculateDynamicGridSpacing
} = require('./shared/backtestUtilities');

/**
 * Short Selling DCA Backtesting Service
 * This service implements inverted DCA logic for short selling with enhanced risk management:
 * 1. Short on rises (inverted logic from long DCA) - UPDATED: Multi-lots only allowed in strictly descending price order
 * 2. Cover on falls - UPDATED: Emergency cover logic when price rises above most recent short
 * 3. Multi-layer risk management (individual, portfolio, cascade)
 * 4. Enhanced transaction tracking - UPDATED: Includes emergency cover events
 * 5. Compatible API response format
 *
 * NEW FEATURES:
 * - Multi-lot restriction: Only allow new shorts when price is lower than previous short by grid interval
 * - Emergency cover: Automatically cover 1 lot when price rises by trailing cover rebound % above most recent short
 * - Most recent short price tracking: Updates trigger price after each emergency cover
 */

// --- Utility Functions ---
function calculateShortMetrics(dailyValues, capitalDeployed, transactionLog, prices, enhancedTransactions = []) {
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
  const coverTransactions = enhancedTransactions.filter(t => t.type === 'COVER' || t.type === 'EMERGENCY_COVER');
  const shortTransactions = enhancedTransactions.filter(t => t.type === 'TRAILING_STOP_LIMIT_SHORT' || t.type === 'SHORT');
  const winningTrades = coverTransactions.filter(t => t.realizedPNLFromTrade > 0);
  const winRate = coverTransactions.length > 0 ? (winningTrades.length / coverTransactions.length) * 100 : 0;
  const totalTrades = coverTransactions.length; // Count covers as completed trades

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

// Calculate annualized return for individual trades and current short positions
function calculateShortTradeAnnualizedReturns(enhancedTransactions, startDate, endDate, currentShorts, finalPrice, lotSizeUsd) {
  const tradeReturns = [];
  const shortReturns = [];
  const shortTransactions = enhancedTransactions.filter(t => t.type === 'TRAILING_STOP_LIMIT_SHORT');
  const coverTransactions = enhancedTransactions.filter(t => t.type === 'COVER' || t.type === 'EMERGENCY_COVER');

  // Calculate total backtest period in days (for current shorts only)
  const totalBacktestDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));

  // Calculate annualized returns for completed trades
  for (const coverTx of coverTransactions) {
    if (coverTx.realizedPNLFromTrade && coverTx.shortsDetails) {
      for (const shortCovered of coverTx.shortsDetails) {
        // Find the corresponding short transaction for this position
        const shortTx = shortTransactions.find(short =>
          short.price === shortCovered.price && short.date <= coverTx.date
        );

        if (shortTx) {
          const shortValue = shortCovered.price * shortCovered.shares;
          const returns = (shortCovered.price - coverTx.price) * shortCovered.shares; // Profit when cover price < short price
          const returnPercent = shortValue > 0 ? returns / shortValue : 0;

          // Calculate actual days held for this specific trade
          const actualDaysHeld = Math.max(1, Math.ceil((new Date(coverTx.date) - new Date(shortTx.date)) / (1000 * 60 * 60 * 24)));

          // Calculate annualized return: simple linear annualization
          const annualizedReturn = returnPercent * 365 / actualDaysHeld;

          tradeReturns.push({
            type: 'COMPLETED_TRADE',
            shortDate: shortTx.date,
            coverDate: coverTx.date,
            shortPrice: shortCovered.price,
            coverPrice: coverTx.price,
            shares: shortCovered.shares,
            shortValue: shortValue,
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

  // Calculate annualized returns for current shorts (open positions)
  if (currentShorts && currentShorts.length > 0 && finalPrice > 0) {
    for (const shortPos of currentShorts) {
      const shortValue = shortPos.price * shortPos.shares;
      const currentValue = finalPrice * shortPos.shares;
      const returns = shortValue - currentValue; // Profit when current price < short price
      const returnPercent = shortValue > 0 ? returns / shortValue : 0;

      // Calculate actual days held for this specific short
      const actualDaysHeld = Math.max(1, Math.ceil((new Date(endDate) - new Date(shortPos.date)) / (1000 * 60 * 60 * 24)));

      // Simple linear annualization for current shorts
      const annualizedReturn = returnPercent * 365 / actualDaysHeld;

      shortReturns.push({
        type: 'CURRENT_SHORT',
        shortDate: shortPos.date,
        coverDate: endDate, // Theoretical cover date for annualized calculation
        shortPrice: shortPos.price,
        coverPrice: finalPrice, // Current market price
        shares: shortPos.shares,
        shortValue: shortValue,
        returns: returns,
        returnPercent: returnPercent * 100,
        annualizedReturn: annualizedReturn,
        annualizedReturnPercent: annualizedReturn * 100,
        actualDaysHeld: actualDaysHeld
      });
    }
  }

  // Combine all returns for overall weighted average
  const allReturns = [...tradeReturns, ...shortReturns];

  // Calculate weighted average (each position is weighted by its actual dollar value)
  // For short DCA, each position is worth lotSizeUsd, so this is a proper weighted average
  const totalWeight = allReturns.length * lotSizeUsd;
  const weightedSum = allReturns.length > 0 ?
    allReturns.reduce((sum, position) => sum + (position.annualizedReturn * lotSizeUsd), 0) : 0;
  const avgAnnualizedReturn = allReturns.length > 0 ? weightedSum / totalWeight : 0;
  const avgAnnualizedReturnPercent = avgAnnualizedReturn * 100;

  // Single consolidated logging for all individual trade returns
  console.log(`📊 All Individual Short Trade Returns for Average Calculation:`,
    allReturns.map((pos, i) =>
      `${i+1}. ${(pos.annualizedReturn * 100).toFixed(2)}% (weight: $${lotSizeUsd.toLocaleString()})`
    ).join('\n')
  );
  console.log(`📈 Weighted Average Result: ${avgAnnualizedReturnPercent.toFixed(2)}% (${allReturns.length} positions)`);

  // Separate weighted averages for completed trades and current shorts
  const tradeOnlyTotalWeight = tradeReturns.length * lotSizeUsd;
  const tradeOnlyAvg = tradeReturns.length > 0 ?
    tradeReturns.reduce((sum, trade) => sum + (trade.annualizedReturn * lotSizeUsd), 0) / tradeOnlyTotalWeight : 0;

  const shortOnlyTotalWeight = shortReturns.length * lotSizeUsd;
  const shortOnlyAvg = shortReturns.length > 0 ?
    shortReturns.reduce((sum, shortPos) => sum + (shortPos.annualizedReturn * lotSizeUsd), 0) / shortOnlyTotalWeight : 0;

  return {
    individualTradeReturns: tradeReturns,
    currentShortReturns: shortReturns,
    allReturns: allReturns,
    averageAnnualizedReturn: avgAnnualizedReturn,
    averageAnnualizedReturnPercent: avgAnnualizedReturnPercent,
    tradeOnlyAverageAnnualizedReturnPercent: tradeOnlyAvg * 100,
    shortOnlyAverageAnnualizedReturnPercent: shortOnlyAvg * 100
  };
}

// calculatePortfolioDrawdown and assessMarketCondition moved to shared/backtestUtilities.js

function calculateShortAndHold(prices, initialCapital, avgCapitalForComparison = null) {
  const startPrice = prices[0].adjusted_close;
  const endPrice = prices[prices.length - 1].adjusted_close;
  const shares = initialCapital / startPrice;

  // Short and hold: profit when price falls
  const finalValue = initialCapital + (shares * (startPrice - endPrice)); // Profit = shares * (short_price - cover_price)
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
    // Short position value = initial capital + unrealized profit/loss
    const currentValue = initialCapital + (shares * (startPrice - price.adjusted_close));
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
 * Core Short Selling DCA Backtest Algorithm
 * UPDATED with new multi-lot ordering and emergency cover logic
 *
 * @param {Object} params - Backtest parameters
 * @param {string} params.symbol - Stock symbol
 * @param {string} params.startDate - Start date (YYYY-MM-DD)
 * @param {string} params.endDate - End date (YYYY-MM-DD)
 * @param {number} params.lotSizeUsd - Amount per short position in USD
 * @param {number} params.maxShorts - Maximum number of short positions (default: 6)
 * @param {number} params.maxShortsToCovers - Maximum shorts to cover per transaction (default: 3)
 * @param {number} params.gridIntervalPercent - Grid interval as decimal (default: 0.15 for 15%)
 *                 NEW: Used to enforce descending order - new shorts must be gridIntervalPercent below previous minimum
 * @param {number} params.profitRequirement - Profit requirement as decimal (default: 0.08 for 8%)
 * @param {number} params.trailingShortActivationPercent - Activation threshold (default: 0.25 for 25%)
 * @param {number} params.trailingShortPullbackPercent - Pullback for short stop (default: 0.15 for 15%)
 * @param {number} params.trailingCoverActivationPercent - Cover activation (default: 0.20 for 20%)
 * @param {number} params.trailingCoverReboundPercent - Rebound for cover stop (default: 0.10 for 10%)
 *                 NEW: Also used for emergency cover trigger - when price rises this % above most recent short
 * @param {number} params.hardStopLossPercent - Individual position stop loss (default: 0.30 for 30%)
 * @param {number} params.portfolioStopLossPercent - Portfolio stop loss (default: 0.25 for 25%)
 * @param {number} params.cascadeStopLossPercent - Cascade liquidation trigger (default: 0.35 for 35%)
 * @param {boolean} params.verbose - Whether to log detailed output (default: true)
 * @returns {Promise<Object>} Backtest results
 *
 * NEW ALGORITHM FEATURES:
 * 1. Multi-lot ordering restriction: New shorts only allowed when price < min(existing_shorts) * (1 - gridIntervalPercent)
 * 2. Emergency cover logic: Auto-cover 1 lot when price rises trailingCoverReboundPercent above most recent short
 * 3. Most recent short price tracking: Updates after each emergency cover to maintain proper trigger levels
 * 4. Enhanced transaction logging: All new events logged with detailed context
 */
async function runShortDCABacktest(params) {
  const {
    symbol,
    startDate,
    endDate,
    lotSizeUsd,
    maxShorts = 6,
    maxShortsToCovers = 3,
    gridIntervalPercent = 0.15,
    profitRequirement = 0.08,
    trailingShortActivationPercent = 0.25,
    trailingShortPullbackPercent = 0.15,
    trailingCoverActivationPercent = 0.20,
    trailingCoverReboundPercent = 0.10,
    hardStopLossPercent = 0.30,
    portfolioStopLossPercent = 0.25,
    cascadeStopLossPercent = 0.35,
    enableDynamicGrid = true, // Enable square root-based dynamic grid spacing
    normalizeToReference = true, // Normalize first trade price to $100 reference
    dynamicGridMultiplier = 1.0, // Grid width multiplier (1.0 = ~10% at $100)
    enableConsecutiveIncrementalSellProfit = true, // Enable incremental profit req for consecutive covers during downtrends
    verbose = true
  } = params;

  if (verbose) {
    console.log(`🎯 Starting SHORT DCA backtest for ${symbol}...`);
    if (enableDynamicGrid) {
      console.log(`📊 Parameters: ${lotSizeUsd} USD/short, ${maxShorts} max shorts, ${maxShortsToCovers} max shorts per cover`);
      console.log(`📐 Dynamic Grid: ${normalizeToReference ? 'Normalized' : 'Absolute'} (multiplier: ${dynamicGridMultiplier})`);
    } else {
      console.log(`📊 Parameters: ${lotSizeUsd} USD/short, ${maxShorts} max shorts, ${maxShortsToCovers} max shorts per cover, ${(gridIntervalPercent*100).toFixed(1)}% fixed grid`);
    }
  }

  // Initialize Adaptive Strategy
  let adaptiveStrategy = null;
  let currentParams = {
    ...params,
    buyEnabled: true,  // Default: buying (shorting) enabled
    sellEnabled: true  // Default: selling (covering) enabled
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

    // 2. Get Combined Price and Technical Indicator Data
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

    // --- Core Short Selling Backtesting Algorithm ---
    let shorts = []; // Array of short positions
    let realizedPNL = 0;
    let averageShortCost = 0;
    const initialPrice = pricesWithIndicators[0].adjusted_close;
    const transactionLog = [];
    let activeStop = null;
    const dailyPortfolioValues = [];
    const dailyCapitalDeployed = [];
    let stopLossTriggered = false;

    // Questionable events monitoring
    const questionableEvents = [];
    const dailyTransactionTypes = new Map(); // Track transaction types per date

    // Recent Peak/Bottom Tracking System (inverted for short selling)
    let recentPeak = null;  // Highest price since last transaction
    let recentBottom = null; // Lowest price since last transaction
    let trailingStopShort = null; // Active trailing stop short order
    let lastTransactionDate = null; // Track when peak/bottom tracking started

    // NEW: Most recent short price tracking for emergency cover
    let mostRecentShortPrice = null; // Tracks the highest (most recent) short price for emergency cover triggers
    let mostRecentShortPeakPrice = null; // Tracks the peak price associated with the most recent short position
    let emergencyCoverTriggerPrice = null; // Emergency cover trigger price to prevent scope issues
    let referencePrice = null; // Will be set on first trade for dynamic grid normalization

    // Consecutive incremental cover profit tracking (inverse logic for shorts)
    let lastActionType = null; // 'short' | 'cover' | null
    let lastCoverPrice = null; // Price of last cover, or null

    const recalculateAverageShortCost = () => {
      if (shorts.length > 0) {
        const totalValue = shorts.reduce((sum, short) => sum + short.price * short.shares, 0);
        const totalShares = shorts.reduce((sum, short) => sum + short.shares, 0);
        return totalValue / totalShares;
      }
      return 0;
    };

    const getShortsPrices = (shortArray) => `[${shortArray.map(s => s.price.toFixed(2)).join(', ')}]`;

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
      const hasCover = dayTransactions.some(tx => tx.type === 'COVER');
      const hasShort = dayTransactions.some(tx => tx.type === 'SHORT');

      if (hasCover && hasShort && dayTransactions.length >= 2) {
        const coverTx = dayTransactions.find(tx => tx.type === 'COVER');
        const shortTx = dayTransactions.find(tx => tx.type === 'SHORT');

        questionableEvents.push({
          date: date,
          type: 'SAME_DAY_SHORT_COVER',
          description: 'Both trailing short and cover orders executed on the same day',
          severity: 'WARNING',
          shortPrice: shortTx.price,
          coverPrice: coverTx.price,
          priceChange: ((shortTx.price - coverTx.price) / coverTx.price * 100).toFixed(2),
          shortDetails: shortTx.details,
          coverDetails: coverTx.details,
          allTransactions: dayTransactions
        });

        transactionLog.push(
          colorize(`⚠️  QUESTIONABLE EVENT: Same-day short ($${shortTx.price.toFixed(2)}) and cover ($${coverTx.price.toFixed(2)}) execution - Price change: ${((shortTx.price - coverTx.price) / coverTx.price * 100).toFixed(2)}%`, 'yellow')
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

    // Risk Management Functions
    const checkHardStopLoss = (currentPrice, currentDate) => {
      let emergencyCoverExecuted = false;
      const shortsToEmergencyCover = [];
      let cascadeTrigger = false;

      for (const shortPos of shorts) {
        const unrealizedLoss = (currentPrice - shortPos.price) / shortPos.price;

        // Check for cascade trigger (35% individual position loss)
        if (unrealizedLoss >= cascadeStopLossPercent) {
          cascadeTrigger = true;
          break;
        }

        // Check for individual position stop loss (30% loss)
        if (unrealizedLoss >= hardStopLossPercent) {
          shortsToEmergencyCover.push(shortPos);
        }
      }

      // Check portfolio-wide stop loss (25% of max exposure)
      const totalShortValue = shorts.reduce((sum, short) => sum + short.price * short.shares, 0);
      const totalUnrealizedLoss = shorts.reduce((sum, short) => {
        const positionLoss = Math.max(0, (currentPrice - short.price) * short.shares);
        return sum + positionLoss;
      }, 0);

      const maxExposure = maxShorts * lotSizeUsd;
      const portfolioLossPercent = totalUnrealizedLoss / maxExposure;

      if (cascadeTrigger || portfolioLossPercent >= portfolioStopLossPercent) {
        // FULL LIQUIDATION - Cover all shorts immediately
        if (shorts.length > 0) {
          const totalCoverValue = shorts.reduce((sum, short) => sum + short.shares * currentPrice, 0);
          const totalShortValue = shorts.reduce((sum, short) => sum + short.price * short.shares, 0);
          const emergencyPNL = totalShortValue - totalCoverValue; // Short PNL = short_value - cover_value

          realizedPNL += emergencyPNL;

          // Log each short being covered
          shorts.forEach((shortPos, index) => {
            const shortValue = shortPos.price * shortPos.shares;
            const coverValue = currentPrice * shortPos.shares;
            const shortPNL = shortValue - coverValue;

            enhancedTransactions.push({
              date: currentDate,
              type: 'EMERGENCY_COVER',
              price: currentPrice,
              shares: shortPos.shares,
              value: coverValue,
              shortPrice: shortPos.price,
              shortsDetails: [{ price: shortPos.price, shares: shortPos.shares, date: shortPos.date }],
              shortsAfterTransaction: [], // Will be empty after emergency liquidation
              averageShortCost: 0, // No shorts remaining
              unrealizedPNL: 0,
              realizedPNL: realizedPNL,
              totalPNL: realizedPNL,
              realizedPNLFromTrade: shortPNL,
              emergencyLiquidation: true,
              liquidationReason: cascadeTrigger ? 'CASCADE_STOP_LOSS' : 'PORTFOLIO_STOP_LOSS',
              unrealizedLossPercent: ((currentPrice - shortPos.price) / shortPos.price) * 100
            });
          });

          transactionLog.push(colorize(`🚨 EMERGENCY LIQUIDATION: ${cascadeTrigger ? 'CASCADE' : 'PORTFOLIO'} STOP LOSS TRIGGERED`, 'red'));
          transactionLog.push(colorize(`  Covered ${shorts.length} shorts at ${currentPrice.toFixed(2)}, Total PNL: ${emergencyPNL.toFixed(2)}`, 'red'));

          shorts = [];
          averageShortCost = 0;
          activeStop = null;
          stopLossTriggered = true;
          emergencyCoverExecuted = true;
          mostRecentShortPrice = null; // Clear tracking when liquidated

          resetPeakBottomTracking(currentPrice, currentDate);
        }
      } else if (shortsToEmergencyCover.length > 0) {
        // INDIVIDUAL POSITION STOP LOSSES - Cover specific shorts
        shortsToEmergencyCover.forEach(shortPos => {
          const shortValue = shortPos.price * shortPos.shares;
          const coverValue = currentPrice * shortPos.shares;
          const shortPNL = shortValue - coverValue;

          realizedPNL += shortPNL;

          enhancedTransactions.push({
            date: currentDate,
            type: 'EMERGENCY_COVER',
            price: currentPrice,
            shares: shortPos.shares,
            value: coverValue,
            shortPrice: shortPos.price,
            shortsDetails: [{ price: shortPos.price, shares: shortPos.shares, date: shortPos.date }],
            shortsAfterTransaction: shorts.filter(s => s !== shortPos),
            averageShortCost: recalculateAverageShortCost(),
            unrealizedPNL: 0, // Will be recalculated
            realizedPNL: realizedPNL,
            totalPNL: realizedPNL,
            realizedPNLFromTrade: shortPNL,
            emergencyLiquidation: false,
            liquidationReason: 'INDIVIDUAL_STOP_LOSS',
            unrealizedLossPercent: ((currentPrice - shortPos.price) / shortPos.price) * 100
          });

          transactionLog.push(colorize(`🔴 INDIVIDUAL STOP LOSS: Covered short at ${shortPos.price.toFixed(2)} → ${currentPrice.toFixed(2)}, PNL: ${shortPNL.toFixed(2)}`, 'red'));
        });

        // Remove covered shorts
        shorts = shorts.filter(short => !shortsToEmergencyCover.includes(short));
        averageShortCost = recalculateAverageShortCost();
        emergencyCoverExecuted = true;

        if (shorts.length === 0) {
          activeStop = null;
          mostRecentShortPrice = null; // Clear tracking when no shorts remain
          resetPeakBottomTracking(currentPrice, currentDate);
        }
      }

      return emergencyCoverExecuted;
    };

    // Check if trailing stop short should be activated (when price rises from recent bottom)
    const checkTrailingStopShortActivation = (currentPrice, currentDate) => {
      if (!trailingStopShort && recentBottom && currentPrice >= recentBottom * (1 + trailingShortActivationPercent)) {
        // Price rose {trailingShortActivationPercent}% from recent bottom - activate trailing stop short
        trailingStopShort = {
          stopPrice: currentPrice * (1 - trailingShortPullbackPercent), // {trailingShortPullbackPercent}% below current price
          limitPrice: recentBottom, // Bottom price is the limit (minimum short price)
          triggeredAt: currentPrice,
          activatedDate: currentDate,
          recentBottomReference: recentBottom,
          lastUpdatePrice: currentPrice  // Track the actual peak price when order was last updated
        };
        transactionLog.push(colorize(`  ACTION: TRAILING STOP SHORT ACTIVATED - Stop: ${trailingStopShort.stopPrice.toFixed(2)}, Limit: ${trailingStopShort.limitPrice.toFixed(2)}, Triggered by ${(trailingShortActivationPercent*100).toFixed(1)}% rise from bottom ${recentBottom.toFixed(2)}`, 'blue'));
      }
    };

    // Update trailing stop short (move stop up if price goes up further)
    const updateTrailingStopShort = (currentPrice) => {
      if (trailingStopShort) {
        const newStopPrice = currentPrice * (1 - trailingShortPullbackPercent); // Always {trailingShortPullbackPercent}% below current price
        if (newStopPrice > trailingStopShort.stopPrice) {
          const oldStopPrice = trailingStopShort.stopPrice;
          trailingStopShort.stopPrice = newStopPrice;
          trailingStopShort.lastUpdatePrice = currentPrice;  // Update the actual peak price
          transactionLog.push(colorize(`  ACTION: TRAILING STOP SHORT UPDATED from ${oldStopPrice.toFixed(2)} to ${newStopPrice.toFixed(2)} (Price: ${currentPrice.toFixed(2)})`, 'blue'));
        }
      }
    };

    // Cancel trailing stop short if price falls below the bottom (limit price)
    const cancelTrailingStopShortIfBelowBottom = (currentPrice) => {
      if (trailingStopShort && currentPrice < trailingStopShort.limitPrice) {
        transactionLog.push(colorize(`  ACTION: TRAILING STOP SHORT CANCELLED - Price ${currentPrice.toFixed(2)} < limit price ${trailingStopShort.limitPrice.toFixed(2)} (bottom)`, 'yellow'));
        trailingStopShort = null;
        return true;
      }
      return false;
    };

    // Check if trailing stop short should execute
    const checkTrailingStopShortExecution = (currentPrice, currentDate) => {
      // Check if shorting is disabled by adaptive strategy
      if (!currentParams.buyEnabled) {
        if (trailingStopShort && verbose) {
          transactionLog.push(colorize(`  INFO: Trailing stop short BLOCKED - Shorting disabled by adaptive strategy (${currentParams.buyPauseReason || 'regime detected'})`, 'yellow'));
        }
        return false;
      }

      if (trailingStopShort && currentPrice <= trailingStopShort.stopPrice) {
        // Check if price is still within limit (above bottom)
        if (currentPrice >= trailingStopShort.limitPrice) {
          // Trailing stop short triggered - check if we can execute
          if (shorts.length < maxShorts) {
            // NEW REQUIREMENT: Multi-lots only allowed when price is lower than previous short by grid interval
            // All shorted prices must be in strictly descending order
            // Calculate dynamic grid spacing for validation
            const minShortPrice = Math.min(...shorts.map(s => s.price));
            const ref = referencePrice || currentPrice; // Use current price if no reference yet

            let gridSize;
            if (enableDynamicGrid) {
              const midPrice = (currentPrice + minShortPrice) / 2;
              gridSize = calculateDynamicGridSpacing(midPrice, ref, dynamicGridMultiplier, normalizeToReference);
            } else {
              gridSize = gridIntervalPercent; // Legacy fixed percentage
            }

            const respectsDescendingOrder = shorts.length === 0 || currentPrice < minShortPrice * (1 - gridSize);
            if (respectsDescendingOrder) {
              // Execute the trailing stop short
              const shares = lotSizeUsd / currentPrice;
              const peakPriceAtExecution = trailingStopShort.lastUpdatePrice;
              shorts.push({ price: currentPrice, shares: shares, date: currentDate, peakPrice: peakPriceAtExecution });

              // Set reference price on first trade (for normalized dynamic grid)
              if (referencePrice === null) {
                referencePrice = currentPrice;
                if (verbose && enableDynamicGrid && normalizeToReference) {
                  transactionLog.push(colorize(`  INFO: Reference price set to ${referencePrice.toFixed(2)} (normalized to $100)`, 'cyan'));
                }
              }

              averageShortCost = recalculateAverageShortCost();

              // Update most recent short price tracking and associated peak price
              mostRecentShortPrice = currentPrice;
              mostRecentShortPeakPrice = peakPriceAtExecution; // Peak price when this short order was executed

              // Update consecutive cover tracking state
              lastActionType = 'short';
              lastCoverPrice = null; // Reset on short

              // Calculate P&L values after trailing stop short
              const totalSharesShortAfterShort = shorts.reduce((sum, short) => sum + short.shares, 0);
              const totalValueOfShortPositionsAfterShort = shorts.reduce((sum, short) => sum + short.price * short.shares, 0);
              const unrealizedPNLAfterShort = totalValueOfShortPositionsAfterShort - (totalSharesShortAfterShort * currentPrice);
              const totalPNLAfterShort = realizedPNL + unrealizedPNLAfterShort;

              const shortDetails = {
                shares: shares,
                shortValue: lotSizeUsd,
                stopPrice: trailingStopShort.stopPrice,
                bottomReference: trailingStopShort.recentBottomReference
              };

              // Record enhanced transaction
              enhancedTransactions.push({
                date: currentDate,
                type: 'TRAILING_STOP_LIMIT_SHORT',
                price: currentPrice,
                shares: shares,
                value: lotSizeUsd,
                shortsDetails: null,
                shortsAfterTransaction: [...shorts],
                averageShortCost: averageShortCost,
                unrealizedPNL: unrealizedPNLAfterShort,
                realizedPNL: realizedPNL,
                totalPNL: totalPNLAfterShort,
                realizedPNLFromTrade: 0,
                ocoOrderDetail: null,
                trailingStopDetail: {
                  triggered: true,
                  stopPrice: trailingStopShort.stopPrice,
                  limitPrice: trailingStopShort.limitPrice, // Bottom price is the limit price
                  recentBottomReference: trailingStopShort.recentBottomReference,
                  activatedAt: trailingStopShort.triggeredAt,
                  priceWhenOrderSet: trailingStopShort.triggeredAt, // Price when trailing stop was triggered
                  lastUpdatePrice: trailingStopShort.lastUpdatePrice, // Actual peak price when order was last updated
                  executionPrice: currentPrice
                }
              });

              // Track this short transaction for questionable event detection
              trackTransaction(currentDate, 'SHORT', currentPrice, {
                ...shortDetails,
                orderType: 'TRAILING_STOP_LIMIT_SHORT',
                descendingOrderEnforced: true,
                previousMinPrice: shorts.length > 1 ? Math.min(...shorts.slice(0, -1).map(s => s.price)) : null
              });

              transactionLog.push(colorize(`  ACTION: TRAILING STOP SHORT EXECUTED at ${currentPrice.toFixed(2)} (stop: ${trailingStopShort.stopPrice.toFixed(2)}). Descending order maintained.`, 'red'));
              transactionLog.push(colorize(`  New Short Position: ${shares.toFixed(4)} shares @ $${currentPrice.toFixed(2)}, Value: $${lotSizeUsd.toFixed(2)}`, 'red'));
              transactionLog.push(colorize(`  All Shorts (descending): ${getShortsPrices(shorts)}, New Avg Cost: ${averageShortCost.toFixed(2)}`, 'red'));

              // Clear trailing stop short and reset peak/bottom tracking
              trailingStopShort = null;
              resetPeakBottomTracking(currentPrice, currentDate);

              return true; // Transaction occurred
            } else {
              transactionLog.push(colorize(`  INFO: TRAILING STOP SHORT blocked at ${currentPrice.toFixed(2)} - violates descending order rule (must be < ${(Math.min(...shorts.map(s => s.price)) * (1 - gridIntervalPercent)).toFixed(2)})`, 'yellow'));
            }
          } else {
            transactionLog.push(colorize(`  INFO: TRAILING STOP SHORT blocked at ${currentPrice.toFixed(2)} - max shorts reached`, 'yellow'));
          }
        } else {
          // Price fell below limit price - order should have been cancelled already
          transactionLog.push(colorize(`  ACTION: TRAILING STOP SHORT CANCELLED - Price ${currentPrice.toFixed(2)} < limit price ${trailingStopShort.limitPrice.toFixed(2)} (bottom)`, 'yellow'));
          trailingStopShort = null;
        }
      }
      return false; // No transaction
    };

    // Check if trailing stop cover should be activated (when price falls from recent peak)
    const checkTrailingStopCoverActivation = (currentPrice) => {
      if (shorts.length > 0 && currentPrice < averageShortCost && !activeStop && recentPeak && currentPrice <= recentPeak * (1 - trailingCoverActivationPercent)) {
        // Price fell {trailingCoverActivationPercent}% from recent peak - activate trailing stop cover
        // Calculate current unrealized P&L
        const totalSharesShort = shorts.reduce((sum, short) => sum + short.shares, 0);
        const totalValueOfShorts = shorts.reduce((sum, short) => sum + short.price * short.shares, 0);
        const unrealizedPNL = totalValueOfShorts - (totalSharesShort * currentPrice); // Short PNL = short_value - current_value

        // Only set trailing stop if unrealized P&L > 0
        if (unrealizedPNL > 0) {
          // Calculate short-level profit requirement (dynamic for consecutive downtrend covers)
          let shortProfitRequirement = profitRequirement; // Default to base
          if (enableConsecutiveIncrementalSellProfit && lastActionType === 'cover' && lastCoverPrice !== null && currentPrice < lastCoverPrice) {
            // Consecutive downtrend cover - calculate dynamic grid size
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
            shortProfitRequirement = profitRequirement + gridSize;

            if (verbose) {
              transactionLog.push(
                colorize(`  📉 Consecutive downtrend cover: short profit req ${(shortProfitRequirement * 100).toFixed(2)}% (base ${(profitRequirement * 100).toFixed(2)}% + grid ${(gridSize * 100).toFixed(2)}%)`, 'cyan')
              );
            }
          }

          // Find the lowest-priced shorts that are eligible for covering
          const stopPrice = currentPrice * (1 + trailingCoverReboundPercent);
          const minProfitablePrice = averageShortCost * (1 - profitRequirement); // ✅ BASE for average cost

          transactionLog.push(colorize(`DEBUG SHORT SELECTION: currentPrice=${currentPrice.toFixed(2)}, stopPrice=${stopPrice.toFixed(2)}, profitRequirement=${profitRequirement}, averageShortCost=${averageShortCost.toFixed(2)}, minProfitablePrice=${minProfitablePrice.toFixed(2)}`, 'cyan'));
          transactionLog.push(colorize(`DEBUG ALL SHORTS: ${shorts.map(short => `$${short.price.toFixed(2)}`).join(', ')}`, 'cyan'));

          // Select shorts that would be profitable to cover (meeting profit requirement)
          const eligibleShorts = shorts.filter(short => currentPrice < short.price * (1 - shortProfitRequirement)); // 🔄 DYNAMIC for short comparison

          transactionLog.push(colorize(`DEBUG ELIGIBLE SHORTS: ${eligibleShorts.map(short => `$${short.price.toFixed(2)}`).join(', ')} (${eligibleShorts.length} eligible)`, 'cyan'));

          if (eligibleShorts.length > 0) {
            const sortedEligibleShorts = eligibleShorts.sort((a, b) => a.price - b.price); // Sort by price ascending (lowest first)
            // Select up to maxShortsToCovers lowest-priced eligible shorts
            const shortsToCover = sortedEligibleShorts.slice(0, Math.min(maxShortsToCovers, sortedEligibleShorts.length));

            transactionLog.push(colorize(`DEBUG SELECTED SHORTS: ${shortsToCover.map(short => `$${short.price.toFixed(2)}`).join(', ')} (${shortsToCover.length} of ${eligibleShorts.length} eligible, max ${maxShortsToCovers})`, 'cyan'));

            // Pricing logic as per requirements:
            // Stop Price: current price * (1 + trailingCoverReboundPercent) (default 10% above current price)
            // Limit Price: targeted short position price * (1 - shortProfitRequirement) (lowest-priced eligible short with profit requirement)
            const stopPrice = currentPrice * (1 + trailingCoverReboundPercent);
            const limitPrice = shortsToCover[0].price * (1 - shortProfitRequirement); // 🔄 DYNAMIC for short comparison

            // VALIDATION: Only activate when limit price > stop price (profitable enough to meet profit requirement)
            if (limitPrice <= stopPrice) {
              transactionLog.push(colorize(`  INFO: TRAILING STOP COVER blocked - not profitable enough (limit ${limitPrice.toFixed(2)} <= stop ${stopPrice.toFixed(2)})`, 'yellow'));
              return; // Don't activate trailing stop
            }

            activeStop = {
              stopPrice: stopPrice,
              limitPrice: limitPrice,
              shortsToCover: shortsToCover, // Now supports multiple shorts
              lowestPrice: currentPrice,  // Track lowest price for trailing
              recentPeakReference: recentPeak,
              triggerCondition: 'recent_peak_20pct_fall',
              priceWhenOrderSet: currentPrice,  // Track the price when the trailing stop was first set
              lastUpdatePrice: currentPrice  // Track the actual bottom price when order was last updated
            };
            transactionLog.push(colorize(`  ACTION: TRAILING STOP COVER ACTIVATED - Stop: ${stopPrice.toFixed(2)}, Limit: ${limitPrice.toFixed(2)}, Triggered by ${(trailingCoverActivationPercent*100).toFixed(1)}% fall from peak ${recentPeak.toFixed(2)} (Unrealized P&L: ${unrealizedPNL.toFixed(2)})`, 'yellow'));
          }
        }
      }
    };

    // Update trailing stop when price moves lower (maintains rebound percent above current price)
    const updateTrailingStop = (currentPrice) => {
      if (activeStop && currentPrice < activeStop.lowestPrice) {
        // Keep stop price following the lowest-priced short position (tracks downward movement)
        const newStopPrice = Math.min(...shorts.map(s => s.price)); // Use lowest short price as stop trigger

        if (newStopPrice < activeStop.stopPrice) {
          const oldStopPrice = activeStop.stopPrice;
          const oldLimitPrice = activeStop.limitPrice;

          // Calculate short-level profit requirement (same logic as activation)
          let shortProfitRequirement = profitRequirement; // Default to base
          if (enableConsecutiveIncrementalSellProfit && lastActionType === 'cover' && lastCoverPrice !== null && currentPrice < lastCoverPrice) {
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
            shortProfitRequirement = profitRequirement + gridSize;
          }

          // Recalculate short selection with new stop price using profit requirement
          const eligibleShorts = shorts.filter(short => currentPrice < short.price * (1 - shortProfitRequirement)); // 🔄 DYNAMIC

          if (eligibleShorts.length > 0) {
            const sortedEligibleShorts = eligibleShorts.sort((a, b) => a.price - b.price);
            // Select up to maxShortsToCovers lowest-priced eligible shorts
            const newShortsToCover = sortedEligibleShorts.slice(0, Math.min(maxShortsToCovers, sortedEligibleShorts.length));

            const newStopPrice = currentPrice * (1 + trailingCoverReboundPercent);
            const newLimitPrice = newShortsToCover[0].price * (1 - shortProfitRequirement); // 🔄 DYNAMIC

            // VALIDATION: Only update when limit price > stop price (profitable enough)
            if (newLimitPrice <= newStopPrice) {
              transactionLog.push(colorize(`  INFO: TRAILING STOP COVER update blocked - not profitable enough (limit ${newLimitPrice.toFixed(2)} <= stop ${newStopPrice.toFixed(2)})`, 'yellow'));
              return; // Don't update trailing stop
            }

            activeStop.stopPrice = newStopPrice;
            activeStop.limitPrice = newLimitPrice;
            activeStop.shortsToCover = newShortsToCover; // Now supports multiple shorts
            activeStop.lowestPrice = currentPrice;
            activeStop.lastUpdatePrice = currentPrice;

            transactionLog.push(colorize(`  ACTION: TRAILING STOP COVER UPDATED from stop ${oldStopPrice.toFixed(2)} to ${newStopPrice.toFixed(2)}, limit ${oldLimitPrice.toFixed(2)} to ${newLimitPrice.toFixed(2)}, shorts: ${newShortsToCover.map(short => `$${short.price.toFixed(2)}`).join(', ')} (Low: ${currentPrice.toFixed(2)})`, 'cyan'));
            transactionLog.push(colorize(`  DEBUG: Updated eligible shorts: ${eligibleShorts.map(short => `$${short.price.toFixed(2)}`).join(', ')}, selected: ${newShortsToCover.map(short => `$${short.price.toFixed(2)}`).join(', ')}`, 'cyan'));
          } else {
            // No eligible shorts, cancel the stop
            activeStop = null;
            transactionLog.push(colorize(`  ACTION: TRAILING STOP COVER CANCELLED - No eligible shorts at price ${currentPrice.toFixed(2)}`, 'yellow'));
          }
        }
      }
    };

    // Cancel trailing stop if price rises above profit requirement threshold
    const cancelTrailingStopIfUnprofitable = (currentPrice) => {
      const maxProfitablePrice = averageShortCost * (1 - profitRequirement);
      if (activeStop && currentPrice >= maxProfitablePrice) {
        const cancelledStopPrice = activeStop.stopPrice;
        activeStop = null;
        transactionLog.push(colorize(`  ACTION: TRAILING STOP COVER CANCELLED - Price ${currentPrice.toFixed(2)} >= max profitable price ${maxProfitablePrice.toFixed(2)} (avg short cost ${averageShortCost.toFixed(2)}, profit requirement ${(profitRequirement*100).toFixed(1)}%, stop was ${cancelledStopPrice.toFixed(2)})`, 'yellow'));
      }
    };

    // Enhanced transaction records for UI
    const enhancedTransactions = [];

    // Main loop through each day's data
    for (let i = 0; i < pricesWithIndicators.length; i++) {
      const dayData = pricesWithIndicators[i];
      const currentPrice = dayData.adjusted_close;
      const currentDate = dayData.date;
      const shortsAtStartOfDay = [...shorts];
      averageShortCost = recalculateAverageShortCost();

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
          transactionLog.push(colorize(`   Short Operations: ${adaptationResult.adjustedParameters.buyEnabled ? '✅ ENABLED' : '🛑 DISABLED'}`, 'magenta'));
          transactionLog.push(colorize(`   Cover Operations: ${adaptationResult.adjustedParameters.sellEnabled ? '✅ ENABLED' : '🛑 DISABLED'}`, 'magenta'));
          if (adaptationResult.adjustedParameters.buyPauseReason) {
            transactionLog.push(colorize(`   Short Pause Reason: ${adaptationResult.adjustedParameters.buyPauseReason}`, 'yellow'));
          }
          if (adaptationResult.adjustedParameters.sellPauseReason) {
            transactionLog.push(colorize(`   Cover Pause Reason: ${adaptationResult.adjustedParameters.sellPauseReason}`, 'yellow'));
          }
        }

        // Update current parameters with adjusted values
        currentParams = adaptationResult.adjustedParameters;

        // Extract updated parameters for use in short/cover logic
        gridIntervalPercent = currentParams.gridIntervalPercent;
        profitRequirement = currentParams.profitRequirement;
        maxShorts = currentParams.maxLots;
        maxShortsToCovers = currentParams.maxLotsToSell;
        trailingShortActivationPercent = currentParams.trailingBuyActivationPercent;
        trailingShortPullbackPercent = currentParams.trailingBuyReboundPercent;
        trailingCoverActivationPercent = currentParams.trailingSellActivationPercent;
        trailingCoverReboundPercent = currentParams.trailingSellPullbackPercent;
        hardStopLossPercent = currentParams.stopLossPercent;
      }

      // Daily PNL Calculation for short positions
      const totalSharesShort = shortsAtStartOfDay.reduce((sum, short) => sum + short.shares, 0);
      const totalValueOfShorts = shortsAtStartOfDay.reduce((sum, short) => sum + short.price * short.shares, 0);
      const unrealizedPNL = totalValueOfShorts - (totalSharesShort * currentPrice); // Short PNL = short_value - current_value
      const totalPNL = realizedPNL + unrealizedPNL;

      // Portfolio tracking
      // When no positions are held, show the available capital as baseline
      const maxExposure = maxShorts * lotSizeUsd;
      const deployedCapital = totalValueOfShorts;
      const availableCapital = maxExposure - deployedCapital;
      const currentPortfolioValue = availableCapital + totalValueOfShorts + unrealizedPNL + realizedPNL;

      dailyPortfolioValues.push(currentPortfolioValue);
      dailyCapitalDeployed.push(totalValueOfShorts);

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

      // HIGHEST PRIORITY: Hard Stop Loss Liquidation
      const emergencyCoverExecuted = checkHardStopLoss(currentPrice, dayData.date);
      if (emergencyCoverExecuted) {
        actionsOccurred = true;
      }

      // Skip further processing if stop loss was triggered (full liquidation)
      if (stopLossTriggered && shorts.length === 0) {
        // Portfolio was liquidated, skip remaining logic
        if (transactionLog.length > dayStartLogLength) {
          actionsOccurred = true;
        }
      } else {
        // NEW PRIORITY: Emergency Cover Logic
        // If price rises Trailing Cover Rebound % above the peak price associated with the most recent short, cover 1 lot at market price
        if (shorts.length > 0 && mostRecentShortPrice !== null && mostRecentShortPeakPrice !== null) {
          emergencyCoverTriggerPrice = mostRecentShortPeakPrice * (1 + trailingCoverReboundPercent);

          if (currentPrice >= emergencyCoverTriggerPrice) {
            // Execute emergency cover of 1 lot at market price
            const shortToCover = shorts.find(s => s.price === mostRecentShortPrice);

            if (shortToCover) {
              const coverValue = shortToCover.shares * currentPrice;
              const shortCost = shortToCover.price * shortToCover.shares;
              const pnl = shortCost - coverValue; // Short PNL = short_value - cover_value

              realizedPNL += pnl;

              // Store values before updating for transaction logging
              const originalMostRecentShortPrice = mostRecentShortPrice;
              const originalMostRecentShortPeakPrice = mostRecentShortPeakPrice;

              // Remove the covered short
              shorts = shorts.filter(s => s !== shortToCover);

              // Update most recent short price and peak price for next trigger
              if (shorts.length > 0) {
                const newMostRecentShort = shorts.reduce((prev, current) => (prev.price > current.price) ? prev : current);
                mostRecentShortPrice = newMostRecentShort.price;
                mostRecentShortPeakPrice = newMostRecentShort.peakPrice;
              } else {
                mostRecentShortPrice = null;
                mostRecentShortPeakPrice = null;
              }

              // Calculate values after emergency cover
              const totalSharesShortAfterCover = shorts.reduce((sum, short) => sum + short.shares, 0);
              const totalValueOfShortsAfterCover = shorts.reduce((sum, short) => sum + short.price * short.shares, 0);
              const unrealizedPNLAfterCover = totalValueOfShortsAfterCover - (totalSharesShortAfterCover * currentPrice);
              const totalPNLAfterCover = realizedPNL + unrealizedPNLAfterCover;

              averageShortCost = recalculateAverageShortCost();

              // Record enhanced transaction for emergency cover
              enhancedTransactions.push({
                date: currentDate,
                type: 'EMERGENCY_COVER',
                price: currentPrice,
                shares: shortToCover.shares,
                value: coverValue,
                shortPrice: shortToCover.price,
                shortsDetails: [{ price: shortToCover.price, shares: shortToCover.shares, date: shortToCover.date }],
                shortsAfterTransaction: [...shorts],
                averageShortCost: averageShortCost,
                unrealizedPNL: unrealizedPNLAfterCover,
                realizedPNL: realizedPNL,
                totalPNL: totalPNLAfterCover,
                realizedPNLFromTrade: pnl,
                emergencyLiquidation: false,
                liquidationReason: 'EMERGENCY_COVER_REBOUND',
                triggerPrice: emergencyCoverTriggerPrice,
                peakPriceReference: originalMostRecentShortPeakPrice,
                mostRecentShortPrice: originalMostRecentShortPrice,
                newMostRecentShortPrice: mostRecentShortPrice, // Updated to the new value after emergency cover
                newMostRecentShortPeakPrice: mostRecentShortPeakPrice,
                remainingLots: shorts.length
              });

              transactionLog.push(colorize(`🚨 EMERGENCY COVER: Price ${currentPrice.toFixed(2)} rose ${(trailingCoverReboundPercent*100).toFixed(1)}% above peak ${(originalMostRecentShortPeakPrice || 0).toFixed(2)} from most recent short ${(originalMostRecentShortPrice || 0).toFixed(2)} (trigger: ${emergencyCoverTriggerPrice.toFixed(2)})`, 'red'));
              transactionLog.push(colorize(`  Emergency Cover: 1 lot @ ${shortToCover.price.toFixed(2)} -> ${currentPrice.toFixed(2)}, PNL: ${pnl.toFixed(2)}`, 'red'));
              transactionLog.push(colorize(`  Remaining shorts: ${getShortsPrices(shorts)} (${shorts.length} lots)`, 'red'));

              if (shorts.length > 0) {
                transactionLog.push(colorize(`  Updated most recent short price to: ${(mostRecentShortPrice || 0).toFixed(2)} (peak: ${(mostRecentShortPeakPrice || 0).toFixed(2)})`, 'cyan'));
              } else {
                transactionLog.push(colorize(`  No remaining lots - cleared most recent short price and peak price, waiting for next short signal`, 'cyan'));
                // Reset peak/bottom tracking when no shorts remain
                resetPeakBottomTracking(currentPrice, currentDate);
              }

              actionsOccurred = true;
            }
          }
        }

        // SECOND PRIORITY: Execute trailing stop covers
        if (activeStop && currentPrice >= activeStop.stopPrice) {
          // Check if covering is disabled by adaptive strategy
          if (!currentParams.sellEnabled) {
            if (verbose) {
              transactionLog.push(colorize(`  INFO: Trailing stop cover BLOCKED - Covering disabled by adaptive strategy (${currentParams.sellPauseReason || 'regime detected'})`, 'yellow'));
            }
            // Cancel the stop since we can't execute it
            activeStop = null;
          } else {
            const { stopPrice, limitPrice, shortsToCover } = activeStop;

            // Always use current price as execution price
            const executionPrice = currentPrice;

            // Execute only if execution price < limit price AND execution price < average short cost * (1 - profitRequirement)
            const maxProfitablePrice = averageShortCost * (1 - profitRequirement);
            if (executionPrice < limitPrice && executionPrice < maxProfitablePrice) {
            let totalCoverValue = 0;
            let costOfCoveredShorts = 0;

            shortsToCover.forEach(coveredShort => {
              totalCoverValue += coveredShort.shares * executionPrice;
              costOfCoveredShorts += coveredShort.shares * coveredShort.price;
            });

            const pnl = costOfCoveredShorts - totalCoverValue; // Short PNL = short_value - cover_value
            realizedPNL += pnl;

            // Calculate unrealized P&L before removing covered shorts
            const totalSharesShortBeforeCover = shorts.reduce((sum, short) => sum + short.shares, 0);
            const totalValueOfShortsBeforeCover = shorts.reduce((sum, short) => sum + short.price * short.shares, 0);
            const unrealizedPNLBeforeCover = totalValueOfShortsBeforeCover - (totalSharesShortBeforeCover * currentPrice);

            shorts = shorts.filter(s => !shortsToCover.find(sc => sc.price === s.price && sc.shares === s.shares));
            averageShortCost = recalculateAverageShortCost();

            // Calculate values after cover
            const totalSharesShortAfterCover = shorts.reduce((sum, short) => sum + short.shares, 0);
            const totalValueOfShortsAfterCover = shorts.reduce((sum, short) => sum + short.price * short.shares, 0);
            const unrealizedPNLAfterCover = totalValueOfShortsAfterCover - (totalSharesShortAfterCover * currentPrice);
            const totalPNLAfterCover = realizedPNL + unrealizedPNLAfterCover;

            // Record separate enhanced transactions for each short covered
            shortsToCover.forEach((coveredShort, index) => {
              // Calculate individual short metrics
              const shortCoverValue = coveredShort.shares * executionPrice;
              const shortCost = coveredShort.price * coveredShort.shares;
              const shortPNL = shortCost - shortCoverValue; // Short PNL = short_value - cover_value

              // Calculate holding period for this specific short
              const shortTransaction = enhancedTransactions.find(tx =>
                (tx.type === 'SHORT' || tx.type === 'TRAILING_STOP_LIMIT_SHORT') &&
                tx.price === coveredShort.price &&
                tx.date <= dayData.date
              );
              const actualDaysHeldForShort = shortTransaction ?
                Math.max(1, Math.ceil((new Date(dayData.date) - new Date(shortTransaction.date)) / (1000 * 60 * 60 * 24))) :
                1;

              const shortTotalReturn = shortCost > 0 ? shortPNL / shortCost : 0;
              const shortAnnualizedReturn = actualDaysHeldForShort > 0 ?
                Math.pow(1 + shortTotalReturn, 365 / actualDaysHeldForShort) - 1 : 0;

              const transactionDetails = {
                shortPrice: coveredShort.price,
                shares: coveredShort.shares,
                pnl: shortPNL,
                annualizedReturn: shortAnnualizedReturn * 100,
                daysHeld: actualDaysHeldForShort
              };

              enhancedTransactions.push({
                date: dayData.date,
                type: 'COVER',
                price: executionPrice,
                shares: coveredShort.shares,
                value: shortCoverValue,
                shortPrice: coveredShort.price, // Original short price of this specific position
                shortsDetails: [{ price: coveredShort.price, shares: coveredShort.shares, date: shortTransaction?.date || dayData.date }], // Individual short details
                shortsAfterTransaction: [...shorts], // Portfolio state after all shorts are covered
                averageShortCost: averageShortCost,
                unrealizedPNL: unrealizedPNLAfterCover,
                realizedPNL: realizedPNL,
                totalPNL: totalPNLAfterCover,
                realizedPNLFromTrade: shortPNL, // Individual short P&L
                annualizedReturn: shortAnnualizedReturn, // Individual short annualized return
                annualizedReturnPercent: shortAnnualizedReturn * 100,
                actualDaysHeld: actualDaysHeldForShort, // Individual short holding period
                ocoOrderDetail: null,
                trailingStopDetail: {
                  triggered: true,
                  stopPrice: stopPrice,
                  limitPrice: limitPrice,
                  executionPrice: executionPrice,
                  lowestPriceBeforeStop: activeStop.lowestPrice,
                  recentPeakReference: activeStop.recentPeakReference,
                  priceWhenOrderSet: activeStop.priceWhenOrderSet,
                  lastUpdatePrice: activeStop.lastUpdatePrice,
                  batchCoverIndex: index, // Indicates this was part of a batch cover
                  batchCoverTotal: shortsToCover.length // Total shorts covered in this batch
                }
              });

              // Track this cover transaction for questionable event detection
              trackTransaction(dayData.date, 'COVER', executionPrice, {
                ...transactionDetails,
                orderType: 'TRAILING_STOP_COVER',
                triggerType: 'TRAILING_STOP_ACTIVATED',
                stopPrice: stopPrice,
                limitPrice: limitPrice
              });
            });

            // Log overall batch cover summary
            transactionLog.push(
              colorize(`  ACTION: TRAILING STOP COVER EXECUTED - ${shortsToCover.length} shorts at ${executionPrice.toFixed(2)} (stop: ${stopPrice.toFixed(2)})`, 'green')
            );

            // Log individual short covers
            shortsToCover.forEach((coveredShort, index) => {
              const shortCoverValue = coveredShort.shares * executionPrice;
              const shortCost = coveredShort.price * coveredShort.shares;
              const shortPNL = shortCost - shortCoverValue;
              const shortTotalReturn = shortCost > 0 ? shortPNL / shortCost : 0;

              const shortTransaction = enhancedTransactions.find(tx =>
                tx.type === 'SHORT' &&
                tx.price === coveredShort.price &&
                tx.date <= dayData.date
              );
              const actualDaysHeldForShort = shortTransaction ?
                Math.max(1, Math.ceil((new Date(dayData.date) - new Date(shortTransaction.date)) / (1000 * 60 * 60 * 24))) :
                1;

              const shortAnnualizedReturn = actualDaysHeldForShort > 0 ?
                Math.pow(1 + shortTotalReturn, 365 / actualDaysHeldForShort) - 1 : 0;

              transactionLog.push(
                colorize(`    Short ${index + 1}/${shortsToCover.length}: Covered ${coveredShort.shares.toFixed(4)} shares @ $${coveredShort.price.toFixed(2)} -> $${executionPrice.toFixed(2)}, PNL: ${shortPNL.toFixed(2)}, Ann.Return: ${(shortAnnualizedReturn * 100).toFixed(2)}% (${actualDaysHeldForShort} days)`, 'green')
              );
            });

            transactionLog.push(
              colorize(`    Total PNL: ${pnl.toFixed(2)}, Remaining shorts: ${getShortsPrices(shorts)}, New Avg Cost: ${averageShortCost.toFixed(2)}`, 'green')
            );

            // Update consecutive cover tracking state
            lastActionType = 'cover';
            lastCoverPrice = executionPrice;

            // Clear active stop and reset peak/bottom tracking after cover
            activeStop = null;
            resetPeakBottomTracking(currentPrice, dayData.date);

            actionsOccurred = true;
          } else {
            const reason = executionPrice >= limitPrice
              ? `Execution price ${executionPrice.toFixed(2)} >= limit price ${limitPrice.toFixed(2)}`
              : `Execution price ${executionPrice.toFixed(2)} >= max profitable price ${maxProfitablePrice.toFixed(2)} (would be unprofitable)`;
            transactionLog.push(
              colorize(`  INFO: Trailing stop execution BLOCKED - ${reason}`, 'yellow')
            );
          }
          }
        }

        // Check if trailing stop cover should be activated (price falls 20% from recent peak)
        checkTrailingStopCoverActivation(currentPrice);

        // Update trailing stop if price has moved lower
        updateTrailingStop(currentPrice);

        // Cancel trailing stop if price rises above profitable threshold
        cancelTrailingStopIfUnprofitable(currentPrice);

        // THIRD PRIORITY: Execute trailing stop short orders
        // First, check if we need to cancel due to price falling below limit
        const wasCancelled = cancelTrailingStopShortIfBelowBottom(currentPrice);
        if (wasCancelled) {
          actionsOccurred = true;
        }

        const trailingStopShortExecuted = checkTrailingStopShortExecution(currentPrice, dayData.date);
        if (trailingStopShortExecuted) {
          actionsOccurred = true;
        } else {
          // Check if trailing stop short should be activated (only if not currently active)
          if (!trailingStopShort) {
            checkTrailingStopShortActivation(currentPrice, dayData.date);
          }

          // Update trailing stop short if active
          updateTrailingStopShort(currentPrice);
        }
      }

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
        header += `Shorts: ${getShortsPrices(shortsAtStartOfDay)}`;

        transactionLog.splice(dayStartLogLength, 0, header);
      } else if (verbose) {
        // For command line, show all days. For API, only show action days
        const singleLine = `--- ${dayData.date} --- ${pad('Price: ' + currentPrice.toFixed(2), 18)}| ${pad('R.PNL: ' + realizedPNL.toFixed(0), 18)}| ${pad('U.PNL: ' + unrealizedPNL.toFixed(0), 18)}| ${pad('T.PNL: ' + totalPNL.toFixed(0), 18)}| Shorts: ${getShortsPrices(shortsAtStartOfDay)}`;
        transactionLog.push(singleLine);
      }
    }

    // Calculate final results
    const totalSharesShort = shorts.reduce((sum, short) => sum + short.shares, 0);
    const totalValueOfShorts = shorts.reduce((sum, short) => sum + short.price * short.shares, 0);
    const finalPrice = pricesWithIndicators[pricesWithIndicators.length - 1].adjusted_close;
    const marketValueOfShorts = totalSharesShort * finalPrice;
    const unrealizedPNL = totalValueOfShorts - marketValueOfShorts; // Short PNL = short_value - current_value
    const totalPNL = realizedPNL + unrealizedPNL;
    const maxExposure = maxShorts * lotSizeUsd;
    const returnOnMaxExposure = (totalPNL / maxExposure) * 100;

    // Calculate metrics
    const metrics = calculateShortMetrics(dailyPortfolioValues, dailyCapitalDeployed, transactionLog, pricesWithIndicators, enhancedTransactions);
    const initialCapital = lotSizeUsd * maxShorts;
    const shortAndHoldResults = calculateShortAndHold(pricesWithIndicators, initialCapital, metrics.avgCapitalDeployed);
    const shortDCAFinalValue = totalValueOfShorts + realizedPNL + unrealizedPNL;
    // Compare P&L percentages: Short DCA return % - Short & Hold return %
    // Example: if Short DCA = -10% and Short & Hold = -20%, then outperformance = -10% - (-20%) = +10%
    const outperformancePercent = metrics.totalReturnPercent - shortAndHoldResults.totalReturnPercent;
    const outperformance = shortDCAFinalValue - shortAndHoldResults.finalValue;

    // Calculate individual trade annualized returns including current shorts
    const tradeAnalysis = calculateShortTradeAnnualizedReturns(enhancedTransactions, startDate, endDate, shorts, finalPrice, lotSizeUsd);

    // Print summary if verbose
    if (verbose) {
      console.log('\n--- Transaction Log ---');
      transactionLog.forEach(log => console.log(log));

      console.log('\n--- Final Summary ---');
      console.log(`Ending Date: ${pricesWithIndicators[pricesWithIndicators.length - 1].date}`);
      console.log(`Final Short Positions: ${shorts.length}`);
      console.log(`Total Shares Short: ${totalSharesShort.toFixed(2)}`);
      console.log(`Average Cost of Shorts: ${totalSharesShort > 0 ? (totalValueOfShorts / totalSharesShort).toFixed(2) : 'N/A'}`);
      console.log(`Final Market Price: ${finalPrice.toFixed(2)}`);
      console.log(`Market Value of Short Positions: ${marketValueOfShorts.toFixed(2)}`);
      console.log(`\nRealized P&L: ${realizedPNL.toFixed(2)}`);
      console.log(`Unrealized P&L: ${unrealizedPNL.toFixed(2)}`);
      console.log(`Total P&L: ${totalPNL.toFixed(2)}`);
      console.log(`Return on Max Exposure (${maxExposure}): ${returnOnMaxExposure.toFixed(2)}%`);
      console.log(`Stop Loss Triggered: ${stopLossTriggered ? 'YES' : 'NO'}`);

      console.log(`\n--- Backtesting Metrics ---`);
      console.log(`Total Return: ${metrics.totalReturn.toFixed(2)} USD (${metrics.totalReturnPercent.toFixed(2)}%)`);
      console.log(`Short DCA Annualized Return: ${metrics.annualizedReturnPercent.toFixed(2)}%`);
      console.log(`Max Drawdown: ${metrics.maxDrawdown.toFixed(2)} USD (${metrics.maxDrawdownPercent.toFixed(2)}%)`);
      console.log(`Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
      console.log(`Win Rate: ${metrics.winRate.toFixed(2)}%`);
      console.log(`Average Trade Annualized Return: ${tradeAnalysis.averageAnnualizedReturnPercent.toFixed(2)}%`);
      console.log(`  - Completed Trades Only: ${tradeAnalysis.tradeOnlyAverageAnnualizedReturnPercent.toFixed(2)}% (${tradeAnalysis.individualTradeReturns.length} trades)`);
      console.log(`  - Current Shorts Only: ${tradeAnalysis.shortOnlyAverageAnnualizedReturnPercent.toFixed(2)}% (${tradeAnalysis.currentShortReturns.length} shorts)`);
      console.log(`  - Combined (All Positions): ${tradeAnalysis.averageAnnualizedReturnPercent.toFixed(2)}% (${tradeAnalysis.allReturns.length} total)`);
      console.log(`Total Trades: ${metrics.totalTrades}`);
      console.log(`Volatility: ${metrics.volatility.toFixed(2)}%`);

      console.log(`\n--- Strategy Comparison (Short DCA vs Short & Hold) ---`);
      console.log(`Short DCA Final Portfolio Value: ${shortDCAFinalValue.toFixed(2)} USD`);
      console.log(`Short & Hold Final Value: ${shortAndHoldResults.finalValue.toFixed(2)} USD`);
      console.log(`Short DCA Total Return: ${metrics.totalReturnPercent.toFixed(2)}% vs S&H: ${shortAndHoldResults.totalReturnPercent.toFixed(2)}%`);
      console.log(`Short DCA Annualized Return: ${metrics.annualizedReturnPercent.toFixed(2)}% vs S&H: ${shortAndHoldResults.annualizedReturnPercent.toFixed(2)}%`);
      console.log(`Outperformance: ${outperformance.toFixed(2)} USD (${outperformancePercent.toFixed(2)}%)`);
      console.log(`Short DCA Max Drawdown: ${metrics.maxDrawdownPercent.toFixed(2)}% vs S&H: ${shortAndHoldResults.maxDrawdownPercent.toFixed(2)}%`);

      // Report questionable events
      if (questionableEvents.length > 0) {
        console.log(`\n--- Questionable Events (${questionableEvents.length}) ---`);
        questionableEvents.forEach((event, index) => {
          console.log(`${index + 1}. ${event.date}: ${event.description} [${event.severity}]`);
        });
      }
    }

    return {
      strategy: 'SHORT_DCA',
      symbol: symbol,
      startDate: startDate,
      endDate: endDate,
      finalShorts: shorts.length,
      totalSharesShort: totalSharesShort,
      averageCostOfShorts: totalSharesShort > 0 ? totalValueOfShorts / totalSharesShort : 0,
      finalMarketPrice: finalPrice,
      marketValueOfShorts: marketValueOfShorts,
      realizedPNL: realizedPNL,
      unrealizedPNL: unrealizedPNL,
      totalPNL: totalPNL,
      returnOnMaxExposure: returnOnMaxExposure,
      stopLossTriggered: stopLossTriggered,
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
      shortDCAFinalValue: shortDCAFinalValue,
      shortAndHoldResults: shortAndHoldResults,
      outperformance: outperformance,
      outperformancePercent: outperformancePercent,
      transactionLog: transactionLog,
      shorts: shorts,
      enhancedTransactions: enhancedTransactions,
      questionableEvents: questionableEvents,

      // Add backtest parameters for reference
      backtestParameters: {
        symbol,
        startDate,
        endDate,
        lotSizeUsd,
        maxShorts,
        maxShortsToCovers,
        gridIntervalPercent,
        profitRequirement,
        trailingShortActivationPercent,
        trailingShortPullbackPercent,
        trailingCoverActivationPercent,
        trailingCoverReboundPercent,
        hardStopLossPercent,
        portfolioStopLossPercent,
        cascadeStopLossPercent,
        enableDynamicGrid,
        normalizeToReference,
        dynamicGridMultiplier,
        enableConsecutiveIncrementalSellProfit,
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
      }
    };

    console.log(`🔍 Short DCA Backtest Debug - Enhanced Transactions: ${enhancedTransactions.length} total`);

  } catch (error) {
    if (verbose) {
      console.error('Error running Short DCA backtest:', error);
    }
    throw error;
  }
}

module.exports = {
  runShortDCABacktest,
  calculateShortMetrics,
  calculatePortfolioDrawdown,
  assessMarketCondition,
  calculateShortAndHold
};