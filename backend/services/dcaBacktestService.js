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

/**
 * Profile definitions for dynamic profile switching (Spec 24)
 * @constant
 */
const PROFILES = {
  CONSERVATIVE: {
    name: 'Conservative',
    description: 'Preserve capital when losing money',
    trigger: 'Total P/L < 0 for 3+ consecutive days',
    overrides: {
      trailingBuyActivationPercent: 0.20,  // Harder to buy - wait for 20% drop
      trailingSellActivationPercent: 0.00, // Easier to sell - no activation needed
      profitRequirement: 0.00              // Easier to sell - no profit requirement
    },
    color: 'blue'
  },

  AGGRESSIVE: {
    name: 'Aggressive',
    description: 'Maximize gains when making money',
    trigger: 'Total P/L >= 0 for 3+ consecutive days',
    overrides: {
      trailingBuyActivationPercent: 0.00,  // Easier to buy - accumulate winners
      trailingSellActivationPercent: 0.20, // Harder to sell - wait for 20% gain
      profitRequirement: 0.10              // Harder to sell - require 10% profit
    },
    color: 'green'
  }
};

const HYSTERESIS_DAYS = 3;  // Require 3 consecutive days before switching profiles

/**
 * Adaptive trailing stop constants (Spec 25)
 * These control how trailing stop parameters decay during consecutive trades
 * @constant
 */
const ADAPTIVE_SELL_PULLBACK_DECAY = 0.5;    // 50% decay per iteration (faster exit during downtrends)
const ADAPTIVE_BUY_REBOUND_DECAY = 0.8;      // 20% decay per iteration (faster accumulation during uptrends)
const MIN_ADAPTIVE_SELL_PULLBACK = 0.02;     // 2% minimum (prevents too-tight sell stops)
const MIN_ADAPTIVE_BUY_REBOUND = 0.05;       // 5% minimum (prevents too-tight buy stops)

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

  // Buy & Hold invests full initialCapital upfront, so return % is based on that
  const totalReturnPercent = (totalReturn / initialCapital) * 100;

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
 * Calculate grid size for next buy based on consecutive buy count
 *
 * Formula: base_grid + (consecutive_count * increment)
 * Only applies when both conditions are met:
 * 1. Feature is enabled
 * 2. Consecutive buy (last action was buy)
 * 3. Price going down (currentBuyPrice < lastBuyPrice)
 *
 * @param {number} gridIntervalPercent - Base grid size (e.g., 0.10 for 10%)
 * @param {number} gridConsecutiveIncrement - Increment per consecutive buy (e.g., 0.05 for 5%)
 * @param {number} consecutiveBuyCount - Current consecutive buy count
 * @param {number|null} lastBuyPrice - Price of last buy (null if no previous buy)
 * @param {number} currentBuyPrice - Current potential buy price
 * @param {boolean} enableConsecutiveIncrementalBuyGrid - Feature enabled?
 * @returns {number} Grid size to use for next buy (as decimal, e.g., 0.10 for 10%)
 */
function calculateBuyGridSize(
  gridIntervalPercent,
  gridConsecutiveIncrement,
  consecutiveBuyCount,
  lastBuyPrice,
  currentBuyPrice,
  enableConsecutiveIncrementalBuyGrid
) {
  // Default to base grid size
  let nextGridSize = gridIntervalPercent;

  // Apply incremental spacing only if:
  // 1. Feature is enabled
  // 2. There was a previous buy (consecutiveBuyCount > 0)
  // 3. Last buy price exists
  // 4. Current buy price is lower than last buy price (downtrend)
  if (
    enableConsecutiveIncrementalBuyGrid &&
    consecutiveBuyCount > 0 &&
    lastBuyPrice !== null &&
    currentBuyPrice < lastBuyPrice
  ) {
    // Formula: base_grid + (consecutive_count * increment)
    nextGridSize = gridIntervalPercent + (consecutiveBuyCount * gridConsecutiveIncrement);
  }

  return nextGridSize;
}

/**
 * Calculate adaptive sell trailing stop parameters (Spec 25)
 * Automatically adjusts trailing stop parameters based on price direction during consecutive sells
 *
 * @param {number} currentPrice - Current market price
 * @param {number|null} lastSellPrice - Price of most recent sell (null if no previous sell)
 * @param {number} trailingSellActivationPercent - Base activation threshold (decimal)
 * @param {number} trailingSellPullbackPercent - Base pullback threshold (decimal)
 * @param {number|null} lastSellPullback - Last used pullback % (null on first sell)
 * @param {number} consecutiveSellCount - Number of consecutive sells
 * @param {boolean} enableConsecutiveIncrementalSellProfit - Is feature enabled?
 * @returns {Object} Adaptive parameters: { activation, pullback, skipProfitRequirement, isAdaptive, direction, previousPullback? }
 */
function calculateAdaptiveSellParameters(
  currentPrice,
  lastSellPrice,
  trailingSellActivationPercent,
  trailingSellPullbackPercent,
  lastSellPullback,
  consecutiveSellCount,
  enableConsecutiveIncrementalSellProfit,
  positionStatus  // Spec 26: position status for sell gating
) {
  // Default to standard parameters
  let activation = trailingSellActivationPercent;
  let pullback = trailingSellPullbackPercent;
  let skipProfitRequirement = false;

  // Only apply adaptive logic if consecutive feature enabled and we have a previous sell
  if (!enableConsecutiveIncrementalSellProfit || consecutiveSellCount === 0 || !lastSellPrice) {
    return { activation, pullback, skipProfitRequirement, isAdaptive: false, direction: 'none' };
  }

  // Determine price direction
  const isDowntrend = currentPrice < lastSellPrice;

  if (isDowntrend) {
    // Spec 26: Downtrend sells ONLY allowed when in losing position
    if (positionStatus !== 'losing') {
      // Block downtrend sell - return standard behavior (uptrend logic)
      return {
        activation,
        pullback,
        skipProfitRequirement: false,
        isAdaptive: false,
        direction: 'down_blocked',  // Indicates downtrend but blocked by position
        blockReason: `position_${positionStatus}`
      };
    }

    // CASE 1: Price falling + losing position - exit faster
    activation = 0;  // Skip activation check
    skipProfitRequirement = true;  // Skip profit requirement

    // Calculate decayed pullback
    const basePullback = lastSellPullback || trailingSellPullbackPercent;
    const decayedPullback = basePullback * ADAPTIVE_SELL_PULLBACK_DECAY;
    pullback = Math.max(decayedPullback, MIN_ADAPTIVE_SELL_PULLBACK);

    return {
      activation,
      pullback,
      skipProfitRequirement,
      isAdaptive: true,
      direction: 'down',
      previousPullback: basePullback
    };
  }

  // CASE 2: Price rising - standard behavior
  return {
    activation,
    pullback,
    skipProfitRequirement: false,
    isAdaptive: false,
    direction: 'up'
  };
}

/**
 * Calculate adaptive buy trailing stop parameters (Spec 25)
 * Automatically adjusts trailing stop parameters based on price direction during consecutive buys
 *
 * @param {number} currentPrice - Current market price
 * @param {number|null} lastBuyPrice - Price of most recent buy (null if no previous buy)
 * @param {number} trailingBuyActivationPercent - Base activation threshold (decimal)
 * @param {number} trailingBuyReboundPercent - Base rebound threshold (decimal)
 * @param {number|null} lastBuyRebound - Last used rebound % (null on first buy)
 * @param {number} consecutiveBuyCount - Number of consecutive buys
 * @param {boolean} enableConsecutiveIncrementalBuyGrid - Is feature enabled?
 * @returns {Object} Adaptive parameters: { activation, rebound, isAdaptive, direction, previousRebound? }
 */
function calculateAdaptiveBuyParameters(
  currentPrice,
  lastBuyPrice,
  trailingBuyActivationPercent,
  trailingBuyReboundPercent,
  lastBuyRebound,
  consecutiveBuyCount,
  enableConsecutiveIncrementalBuyGrid,
  positionStatus  // Spec 26: position status for buy gating
) {
  // Default to standard parameters
  let activation = trailingBuyActivationPercent;
  let rebound = trailingBuyReboundPercent;

  // Only apply adaptive logic if consecutive feature enabled and we have a previous buy
  if (!enableConsecutiveIncrementalBuyGrid || consecutiveBuyCount === 0 || !lastBuyPrice) {
    return { activation, rebound, isAdaptive: false, direction: 'none' };
  }

  // Determine price direction
  const isUptrend = currentPrice > lastBuyPrice;

  if (isUptrend) {
    // Spec 26: Uptrend buys ONLY allowed when in winning position
    if (positionStatus !== 'winning') {
      // Block uptrend buy - return standard behavior (downtrend logic)
      return {
        activation,
        rebound,
        isAdaptive: false,
        direction: 'up_blocked',  // Indicates uptrend but blocked by position
        blockReason: `position_${positionStatus}`
      };
    }

    // CASE 1: Price rising + winning position - accumulate faster
    activation = 0;  // Skip activation check

    // Calculate decayed rebound
    const baseRebound = lastBuyRebound || trailingBuyReboundPercent;
    const decayedRebound = baseRebound * ADAPTIVE_BUY_REBOUND_DECAY;
    rebound = Math.max(decayedRebound, MIN_ADAPTIVE_BUY_REBOUND);

    return {
      activation,
      rebound,
      isAdaptive: true,
      direction: 'up',
      previousRebound: baseRebound
    };
  }

  // CASE 2: Price falling - standard behavior
  return {
    activation,
    rebound,
    isAdaptive: false,
    direction: 'down'
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
    enableConsecutiveIncrementalBuyGrid = false, // Enable incremental grid spacing for consecutive downtrend buys
    gridConsecutiveIncrement = 0.05, // Grid increment per consecutive buy (default 0.05 for 5%)
    enableScenarioDetection = true, // Enable scenario detection and analysis
    trailingStopOrderType = 'limit', // Order type: 'limit' (cancels if exceeds peak/bottom) or 'market' (always executes)
    enableAverageBasedGrid = false, // Enable average-cost based grid spacing (Spec 23 Feature #1)
    enableAverageBasedSell = false, // Enable average-cost based sell profitability (Spec 23 Feature #2)
    enableDynamicProfile = false, // Enable dynamic profile switching based on P/L (Spec 24)
    verbose = true
  } = params;

  // Validate trailingStopOrderType
  if (!['limit', 'market'].includes(trailingStopOrderType)) {
    throw new Error(`Invalid trailingStopOrderType: '${trailingStopOrderType}'. Must be 'limit' or 'market'.`);
  }

  // Validate average-based parameters (Spec 23)
  if (typeof enableAverageBasedGrid !== 'boolean') {
    throw new Error(`enableAverageBasedGrid must be boolean, got: ${typeof enableAverageBasedGrid}`);
  }
  if (typeof enableAverageBasedSell !== 'boolean') {
    throw new Error(`enableAverageBasedSell must be boolean, got: ${typeof enableAverageBasedSell}`);
  }

  // Validate dynamic profile parameter (Spec 24)
  if (typeof enableDynamicProfile !== 'boolean') {
    throw new Error(`enableDynamicProfile must be boolean, got: ${typeof enableDynamicProfile}`);
  }
  // Batch mode: must be single boolean, NOT an array
  if (Array.isArray(enableDynamicProfile)) {
    throw new Error('enableDynamicProfile cannot be an array in batch mode. Use single boolean (true or false).');
  }

  // Always log order type for debugging
  console.log(`🔧 Trailing Stop Order Type: ${trailingStopOrderType.toUpperCase()}`);

  // Log average-based features status (Spec 23)
  console.log(`🔍 DEBUG: enableAverageBasedGrid = ${enableAverageBasedGrid} (type: ${typeof enableAverageBasedGrid})`);
  console.log(`🔍 DEBUG: enableAverageBasedSell = ${enableAverageBasedSell} (type: ${typeof enableAverageBasedSell})`);

  if (enableAverageBasedGrid) {
    console.log(`📊 Feature: Average-Based Grid Spacing = ENABLED`);
    console.log(`   Grid spacing will be checked against average cost (not individual lots)`);
  }
  if (enableAverageBasedSell) {
    console.log(`📊 Feature: Average-Based Sell Logic = ENABLED`);
    console.log(`   Sell profitability will be checked against average cost`);
  }

  // Log dynamic profile feature status (Spec 24)
  if (enableDynamicProfile) {
    const consProfile = PROFILES.CONSERVATIVE;
    const aggProfile = PROFILES.AGGRESSIVE;
    console.log(`🔄 Feature: Dynamic Profile Switching = ENABLED`);
    console.log(`   Conservative when P/L < 0: Harder to buy (${(consProfile.overrides.trailingBuyActivationPercent * 100).toFixed(0)}%), easier to sell (${(consProfile.overrides.trailingSellActivationPercent * 100).toFixed(0)}%)`);
    console.log(`   Aggressive when P/L >= 0: Easier to buy (${(aggProfile.overrides.trailingBuyActivationPercent * 100).toFixed(0)}%), harder to sell (${(aggProfile.overrides.trailingSellActivationPercent * 100).toFixed(0)}%)`);
    console.log(`   Requires ${HYSTERESIS_DAYS} consecutive days before switching`);
  }

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
    let consecutiveSellCount = 0; // Number of consecutive sells in uptrend (0, 1, 2, 3, ...)

    // Consecutive incremental buy grid tracking
    let consecutiveBuyCount = 0; // Number of consecutive buys (0, 1, 2, 3, ...)
    let lastBuyPrice = null; // Price of last buy, or null
    let maxConsecutiveBuyCount = 0; // Track maximum consecutive buy count reached
    let totalGridSizeUsed = 0; // Sum of all grid sizes used for buys
    let totalBuysCount = 0; // Total number of buys executed

    // Adaptive trailing stop state (Spec 25)
    let lastSellPullback = null; // Last used pullback % for consecutive sells (for decay calculation)
    let lastBuyRebound = null;   // Last used rebound % for consecutive buys (for decay calculation)

    // Direction tracking for consecutive trades (Spec 25 - revised from Specs 17 & 18)
    let lastBuyDirection = null;  // 'up' | 'down' | null - direction of last buy relative to previous buy
    let lastSellDirection = null; // 'up' | 'down' | null - direction of last sell relative to previous sell

    // Position-Based Adaptive Behavior (Spec 26)
    let positionStatus = 'neutral'; // 'winning' | 'losing' | 'neutral'
    let portfolioUnrealizedPNL = 0;          // Current unrealized P/L
    const positionThreshold = lotSizeUsd * 0.10; // 10% of lot size

    // Questionable events monitoring
    const questionableEvents = [];
    const dailyTransactionTypes = new Map(); // Track transaction types per date

    // Recent Peak/Bottom Tracking System (simplified approach)
    let recentPeak = null;  // Highest price since last transaction
    let recentBottom = null; // Lowest price since last transaction
    let trailingStopBuy = null; // Active trailing stop buy order
    let lastTransactionDate = null; // Track when peak/bottom tracking started

    // Dynamic Profile Switching State (Spec 24)
    let currentProfile = null;           // Current active profile ('CONSERVATIVE' | 'AGGRESSIVE' | null)
    let profileSwitchCount = 0;          // Total number of switches
    let daysInConservative = 0;          // Total days spent in Conservative
    let daysInAggressive = 0;            // Total days spent in Aggressive
    let consecutiveDaysInRegion = 0;    // Counter for hysteresis
    let lastPnLSign = null;              // Track P/L sign ('positive' | 'negative')
    let originalParams = null;           // Store original parameters
    const profileSwitches = [];          // Profile switch history

    const recalculateAverageCost = () => {
      if (lots.length > 0) {
        const totalCost = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
        const totalShares = lots.reduce((sum, lot) => sum + lot.shares, 0);
        return totalCost / totalShares;
      }
      return 0;
    };

    // Calculate position status based on unrealized P/L (Spec 26)
    const calculatePositionStatus = (lotArray, currentPrice, threshold) => {
      // Calculate unrealized P/L
      const pnl = lotArray.reduce((sum, lot) => {
        return sum + (currentPrice - lot.price) * lot.shares;
      }, 0);

      // Determine position status
      let status = 'neutral';
      if (pnl > threshold) {
        status = 'winning';
      } else if (pnl < -threshold) {
        status = 'losing';
      }

      return { status, pnl, threshold };
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
      // Calculate adaptive parameters for buy (Spec 25)
      const adaptiveBuyParams = calculateAdaptiveBuyParameters(
        currentPrice,
        lastBuyPrice,
        params.trailingBuyActivationPercent,
        params.trailingBuyReboundPercent,
        lastBuyRebound,
        consecutiveBuyCount,
        enableConsecutiveIncrementalBuyGrid,
        positionStatus  // Spec 26: position-based buy gating
      );

      // Use adaptive or standard parameters
      const effectiveActivation = adaptiveBuyParams.activation;
      const effectiveRebound = adaptiveBuyParams.rebound;

      // Log adaptive mode if active
      if (adaptiveBuyParams.isAdaptive && verbose) {
        transactionLog.push(colorize(
          `  🎯 Adaptive Buy: Direction=${adaptiveBuyParams.direction}, ` +
          `Activation=${(effectiveActivation * 100).toFixed(1)}%, ` +
          `Rebound=${(effectiveRebound * 100).toFixed(1)}% ` +
          `(was ${(adaptiveBuyParams.previousRebound * 100).toFixed(1)}%)`,
          'cyan'
        ));
      }

      // Spec 26: Log position-based buy blocks
      if (adaptiveBuyParams.direction === 'up_blocked' && verbose) {
        transactionLog.push(colorize(
          `  🚫 BLOCKED: Uptrend buy prevented (Position: ${positionStatus.toUpperCase()}, P/L: ${portfolioUnrealizedPNL >= 0 ? '+' : ''}$${portfolioUnrealizedPNL.toFixed(2)}) - ` +
          `Only allow uptrend buys in WINNING position. Using standard downtrend logic instead.`,
          'yellow'
        ));
      }

      if (!trailingStopBuy && recentPeak && currentPrice <= recentPeak * (1 - effectiveActivation)) {
        // Price dropped {effectiveActivation}% from recent peak - activate trailing stop buy
        trailingStopBuy = {
          stopPrice: currentPrice * (1 + effectiveRebound), // {effectiveRebound}% above current price
          triggeredAt: currentPrice,
          activatedDate: currentDate,
          recentPeakReference: recentPeak,
          lastUpdatePrice: currentPrice  // Track the actual bottom price (price when order was last updated)
        };

        // Update adaptive state for next iteration
        if (adaptiveBuyParams.isAdaptive) {
          lastBuyRebound = effectiveRebound;
        }

        transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY ACTIVATED - Stop: ${trailingStopBuy.stopPrice.toFixed(2)}, Triggered by ${(effectiveActivation*100).toFixed(1)}% drop from peak ${recentPeak.toFixed(2)}${adaptiveBuyParams.isAdaptive ? ' [ADAPTIVE]' : ''}`, 'blue'));
      }
    };

    // Update trailing stop buy (move stop down if price goes down further)
    const updateTrailingStopBuy = (currentPrice) => {
      if (trailingStopBuy) {
        // Calculate adaptive parameters (Spec 25)
        const adaptiveBuyParams = calculateAdaptiveBuyParameters(
          currentPrice,
          lastBuyPrice,
          params.trailingBuyActivationPercent,
          params.trailingBuyReboundPercent,
          lastBuyRebound,
          consecutiveBuyCount,
          enableConsecutiveIncrementalBuyGrid,
          positionStatus  // Spec 26: position-based buy gating
        );

        const effectiveRebound = adaptiveBuyParams.rebound;
        const newStopPrice = currentPrice * (1 + effectiveRebound); // Use adaptive or standard rebound

        if (newStopPrice < trailingStopBuy.stopPrice) {
          const oldStopPrice = trailingStopBuy.stopPrice;
          trailingStopBuy.stopPrice = newStopPrice;
          trailingStopBuy.lastUpdatePrice = currentPrice;  // Update the actual bottom price

          // Update adaptive state for next iteration
          if (adaptiveBuyParams.isAdaptive) {
            lastBuyRebound = effectiveRebound;
          }

          transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY UPDATED from ${oldStopPrice.toFixed(2)} to ${newStopPrice.toFixed(2)} (Price: ${currentPrice.toFixed(2)})${adaptiveBuyParams.isAdaptive ? ' [ADAPTIVE]' : ''}`, 'blue'));
        }
      }
    };

    // Cancel trailing stop buy if price exceeds the peak (limit price)
    // SKIP cancellation for market orders (they always execute when stop is triggered)
    const cancelTrailingStopBuyIfAbovePeak = (currentPrice) => {
      // Market orders never cancel due to limit price
      if (trailingStopOrderType === 'market') {
        return false;
      }

      // Limit orders cancel if price exceeds peak reference
      if (trailingStopBuy && currentPrice > trailingStopBuy.recentPeakReference) {
        transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY CANCELLED (LIMIT) - Price ${currentPrice.toFixed(2)} > limit price ${trailingStopBuy.recentPeakReference.toFixed(2)} (peak)`, 'yellow'));
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
        // Check if price is still within limit (below peak) - SKIP for market orders
        const withinLimit = trailingStopOrderType === 'market' || currentPrice <= trailingStopBuy.recentPeakReference;
        if (withinLimit) {
          // DEBUG: Log withinLimit pass
          if (verbose) {
            transactionLog.push(colorize(`  🔍 DEBUG: withinLimit check passed! lots.length: ${lots.length}, maxLots: ${maxLots}`, 'cyan'));
          }

          // Trailing stop buy triggered - check if we can execute
          if (lots.length < maxLots) {
            // DEBUG: Log max lots check
            if (verbose) {
              transactionLog.push(colorize(`  🔍 DEBUG: Max lots check passed! Checking grid spacing...`, 'cyan'));
            }

            // Calculate grid size for this buy FIRST (before validation)
            const buyGridSize = calculateBuyGridSize(
              gridIntervalPercent,
              gridConsecutiveIncrement,
              consecutiveBuyCount,
              lastBuyPrice,
              currentPrice,
              enableConsecutiveIncrementalBuyGrid
            );

            if (verbose && enableConsecutiveIncrementalBuyGrid) {
              transactionLog.push(colorize(`  DEBUG: Before spacing check - consecutiveBuyCount: ${consecutiveBuyCount}, buyGridSize: ${(buyGridSize * 100).toFixed(1)}%, enabledFlag: ${enableConsecutiveIncrementalBuyGrid}`, 'cyan'));
            }

            // Calculate grid spacing validation
            let respectsGridSpacing;

            if (enableAverageBasedGrid) {
              // Spec 23 Feature #1: Check spacing against average cost only (O(1))
              if (lots.length === 0) {
                // First buy always allowed
                respectsGridSpacing = true;
              } else if (averageCost === 0) {
                // Safety check
                respectsGridSpacing = true;
              } else {
                // Symmetric spacing: full spacing required both above and below average
                const spacing = Math.abs(currentPrice - averageCost) / averageCost;

                // Determine required grid size
                let gridSize;
                if (enableDynamicGrid) {
                  const midPrice = (currentPrice + averageCost) / 2;
                  const ref = referencePrice || midPrice;
                  gridSize = calculateDynamicGridSpacing(midPrice, ref, dynamicGridMultiplier, normalizeToReference);
                } else if (enableConsecutiveIncrementalBuyGrid) {
                  gridSize = buyGridSize; // Use incremental grid size
                } else {
                  gridSize = gridIntervalPercent; // Use base grid size
                }

                respectsGridSpacing = spacing >= gridSize;

                if (verbose) {
                  transactionLog.push(colorize(
                    `  AVG-GRID: Price $${currentPrice.toFixed(2)}, Avg Cost $${averageCost.toFixed(2)}, ` +
                    `Spacing ${(spacing * 100).toFixed(1)}%, Required ${(gridSize * 100).toFixed(1)}% → ${respectsGridSpacing ? 'PASS' : 'FAIL'}`,
                    respectsGridSpacing ? 'cyan' : 'yellow'
                  ));
                }
              }
            } else {
              // Original lot-based grid spacing check
              respectsGridSpacing = lots.every((lot, index) => {
                const midPrice = (currentPrice + lot.price) / 2;
                const ref = referencePrice || midPrice; // Use midPrice if no reference yet

                let gridSize;
                if (enableDynamicGrid) {
                  gridSize = calculateDynamicGridSpacing(midPrice, ref, dynamicGridMultiplier, normalizeToReference);
                } else if (enableConsecutiveIncrementalBuyGrid) {
                  // For consecutive incremental buy grid:
                  // - Check spacing from LAST buy (most recent) using direction-based grid size
                  // - Check spacing from OTHER buys using base gridIntervalPercent
                  const isLastBuy = (index === lots.length - 1);

                  if (isLastBuy && lastBuyPrice !== null && currentPrice < lastBuyPrice) {
                    // DOWNTREND: Use incremental grid spacing (Spec 17)
                    gridSize = buyGridSize; // gridIntervalPercent + (consecutiveBuyCount * gridConsecutiveIncrement)
                  } else {
                    // UPTREND or no previous buy: Use base grid spacing
                    gridSize = gridIntervalPercent;
                  }
                } else {
                  gridSize = gridIntervalPercent; // Legacy fixed percentage
                }

                const spacing = Math.abs(currentPrice - lot.price) / lot.price;
                const meetsSpacing = spacing >= gridSize;

                if (verbose && enableConsecutiveIncrementalBuyGrid) {
                  transactionLog.push(colorize(`    Lot #${index} at $${lot.price.toFixed(2)}: spacing=${(spacing*100).toFixed(1)}%, required=${(gridSize*100).toFixed(1)}%, isLast=${index === lots.length - 1}, passes=${meetsSpacing}`, 'cyan'));
                }

                return meetsSpacing;
              });
            }

            if (respectsGridSpacing) {

            // Spec 17 & 25: Grid spacing check passed - proceed with buy execution
            // Note: Grid spacing already accounts for direction (downtrend=incremental, uptrend=base)
            if (verbose && enableConsecutiveIncrementalBuyGrid) {
              const direction = (lastBuyPrice && currentPrice < lastBuyPrice) ? 'DOWNTREND' :
                               (lastBuyPrice && currentPrice >= lastBuyPrice) ? 'UPTREND' : 'FIRST BUY';
              transactionLog.push(colorize(`  DEBUG: Consecutive Buy Grid - Direction: ${direction}, Count: ${consecutiveBuyCount}, Last Buy: ${lastBuyPrice ? lastBuyPrice.toFixed(2) : 'null'}, Grid Size: ${(buyGridSize * 100).toFixed(1)}%`, 'cyan'));
            }

            // Capture OLD average cost BEFORE executing this buy
            // This is needed to determine if count should reset after buy
            const oldAverageCost = averageCost;

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
            consecutiveSellCount = 0; // Reset on buy
            lastSellPullback = null; // Reset adaptive state on buy (Spec 25)
            lastSellDirection = null; // Reset sell direction on buy

            // Update consecutive buy tracking state with direction-based counting (Spec 25)
            if (consecutiveBuyCount === 0) {
              // First buy in sequence
              consecutiveBuyCount = 1;
              lastBuyDirection = null; // No previous buy to compare
              transactionLog.push(colorize(`  🔢 CONSEC BUY COUNT: Set to 1 (first buy in sequence)`, 'cyan'));
            } else {
              // Determine direction relative to last buy
              const currentDirection = (currentPrice > lastBuyPrice) ? 'up' : 'down';

              if (lastBuyDirection === null) {
                // Second buy in sequence, establish direction
                const oldCount = consecutiveBuyCount;
                consecutiveBuyCount++;
                lastBuyDirection = currentDirection;
                transactionLog.push(colorize(`  🔢 CONSEC BUY COUNT: ${oldCount} → ${consecutiveBuyCount} (direction established: ${currentDirection.toUpperCase()}, price: $${lastBuyPrice.toFixed(2)} → $${currentPrice.toFixed(2)})`, 'cyan'));
              } else if (currentDirection === lastBuyDirection) {
                // Same direction, increment count
                const oldCount = consecutiveBuyCount;
                consecutiveBuyCount++;
                transactionLog.push(colorize(`  🔢 CONSEC BUY COUNT: ${oldCount} → ${consecutiveBuyCount} (same direction: ${currentDirection.toUpperCase()}, price: $${lastBuyPrice.toFixed(2)} → $${currentPrice.toFixed(2)})`, 'cyan'));
              } else {
                // Direction reversed, reset to 1 and save new direction
                const oldCount = consecutiveBuyCount;
                const oldDirection = lastBuyDirection;
                consecutiveBuyCount = 1;
                lastBuyDirection = currentDirection;
                transactionLog.push(colorize(`  🔄 CONSEC BUY COUNT: ${oldCount} → 1 (DIRECTION REVERSED: ${oldDirection.toUpperCase()} → ${currentDirection.toUpperCase()}, price: $${lastBuyPrice.toFixed(2)} → $${currentPrice.toFixed(2)})`, 'yellow'));
              }
            }

            lastBuyPrice = currentPrice;
            maxConsecutiveBuyCount = Math.max(maxConsecutiveBuyCount, consecutiveBuyCount);
            totalGridSizeUsed += buyGridSize;
            totalBuysCount++;

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
              },
              // Consecutive incremental buy grid data
              consecutiveBuyCount: consecutiveBuyCount, // Count AFTER this buy (1, 2, 3, ...)
              buyGridSize: buyGridSize // Grid size used for this buy (decimal, e.g., 0.10 for 10%)
            });

            // Track this buy transaction for questionable event detection
            trackTransaction(currentDate, 'BUY', currentPrice, buyDetails);

            // Add consecutive buy grid info if enabled
            const buyGridInfo = enableConsecutiveIncrementalBuyGrid
              ? `, Consecutive Buy: ${consecutiveBuyCount}, Grid: ${(buyGridSize * 100).toFixed(1)}%`
              : '';
            transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY EXECUTED at ${currentPrice.toFixed(2)} (stop: ${trailingStopBuy.stopPrice.toFixed(2)}). Lots: ${getLotsPrices(lots)}, New Avg Cost: ${averageCost.toFixed(2)}${buyGridInfo}`, 'green'));

            // Clear trailing stop buy and reset peak/bottom tracking
            trailingStopBuy = null;
            resetPeakBottomTracking(currentPrice, currentDate);

              return true; // Transaction occurred
            } else {
              // Detailed grid spacing violation message
              if (enableAverageBasedGrid) {
                // Average-based grid: show average cost and spacing details
                const spacing = Math.abs(currentPrice - averageCost) / averageCost;
                let gridSize;
                if (enableDynamicGrid) {
                  const midPrice = (currentPrice + averageCost) / 2;
                  const ref = referencePrice || midPrice;
                  gridSize = calculateDynamicGridSpacing(midPrice, ref, dynamicGridMultiplier, normalizeToReference);
                } else if (enableConsecutiveIncrementalBuyGrid) {
                  gridSize = buyGridSize;
                } else {
                  gridSize = gridIntervalPercent;
                }
                transactionLog.push(colorize(
                  `  INFO: TRAILING STOP BUY blocked at $${currentPrice.toFixed(2)} - violates average-based grid spacing\n` +
                  `        Average Cost: $${averageCost.toFixed(2)}, Current Spacing: ${(spacing * 100).toFixed(2)}%, Required: ${(gridSize * 100).toFixed(2)}%`,
                  'yellow'
                ));
              } else {
                // Lot-based grid: show which lot(s) violated spacing
                const violations = [];
                lots.forEach((lot, index) => {
                  const midPrice = (currentPrice + lot.price) / 2;
                  const ref = referencePrice || midPrice;
                  let gridSize;
                  if (enableDynamicGrid) {
                    gridSize = calculateDynamicGridSpacing(midPrice, ref, dynamicGridMultiplier, normalizeToReference);
                  } else if (enableConsecutiveIncrementalBuyGrid) {
                    const isLastBuy = (index === lots.length - 1);

                    if (isLastBuy && lastBuyPrice !== null && currentPrice < lastBuyPrice) {
                      // DOWNTREND: Use incremental grid spacing
                      gridSize = buyGridSize;
                    } else {
                      // UPTREND or no previous buy: Use base grid spacing
                      gridSize = gridIntervalPercent;
                    }
                  } else {
                    gridSize = gridIntervalPercent;
                  }
                  const spacing = Math.abs(currentPrice - lot.price) / lot.price;
                  if (spacing < gridSize) {
                    violations.push(`Lot #${index + 1} @ $${lot.price.toFixed(2)}: ${(spacing * 100).toFixed(2)}% < ${(gridSize * 100).toFixed(2)}% required`);
                  }
                });
                transactionLog.push(colorize(
                  `  INFO: TRAILING STOP BUY blocked at $${currentPrice.toFixed(2)} - violates lot-based grid spacing\n` +
                  `        ${violations.join(', ')}`,
                  'yellow'
                ));
              }
            }
          } else {
            transactionLog.push(colorize(`  INFO: TRAILING STOP BUY blocked at ${currentPrice.toFixed(2)} - max lots reached`, 'yellow'));
          }
        } else {
          // Price exceeded limit price - only cancel for limit orders (market orders never reach this)
          if (trailingStopOrderType === 'limit') {
            transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY CANCELLED - Price ${currentPrice.toFixed(2)} > limit price ${trailingStopBuy.recentPeakReference.toFixed(2)} (peak)`, 'yellow'));
            trailingStopBuy = null;
          }
        }
      }
      return false; // No transaction
    };

    // Check if trailing stop sell should be activated (when price rises from recent bottom)
    const checkTrailingStopSellActivation = (currentPrice, currentDate) => {
      // Calculate adaptive sell parameters before activation check (Spec 25)
      const adaptiveSellParams = calculateAdaptiveSellParameters(
        currentPrice,
        lastSellPrice,
        trailingSellActivationPercent,
        trailingSellPullbackPercent,
        lastSellPullback,
        consecutiveSellCount,
        enableConsecutiveIncrementalSellProfit,
        positionStatus  // Spec 26: position-based sell gating
      );

      // Use adaptive or standard parameters
      const effectiveActivation = adaptiveSellParams.activation;
      const effectivePullback = adaptiveSellParams.pullback;
      const skipProfitRequirement = adaptiveSellParams.skipProfitRequirement;

      // Log adaptive mode if active
      if (adaptiveSellParams.isAdaptive && verbose) {
        transactionLog.push(colorize(
          `  🎯 Adaptive Sell: Direction=${adaptiveSellParams.direction}, ` +
          `Activation=${(effectiveActivation * 100).toFixed(1)}%, ` +
          `Pullback=${(effectivePullback * 100).toFixed(1)}% ` +
          `(was ${(adaptiveSellParams.previousPullback * 100).toFixed(1)}%), ` +
          `ProfitReq=${skipProfitRequirement ? 'SKIPPED' : 'Required'}`,
          'cyan'
        ));
      }

      // Spec 26: Log position-based sell blocks
      if (adaptiveSellParams.direction === 'down_blocked' && verbose) {
        transactionLog.push(colorize(
          `  🚫 BLOCKED: Downtrend sell prevented (Position: ${positionStatus.toUpperCase()}, P/L: ${portfolioUnrealizedPNL >= 0 ? '+' : ''}$${portfolioUnrealizedPNL.toFixed(2)}) - ` +
          `Only allow downtrend sells in LOSING position. Using standard uptrend logic instead.`,
          'yellow'
        ));
      }

      if (lots.length > 0 && currentPrice > averageCost && !activeStop && recentBottom && currentPrice >= recentBottom * (1 + effectiveActivation)) {
        // Price rose {effectiveActivation}% from recent bottom - activate trailing stop sell
        // Calculate current unrealized P&L
        const totalSharesHeld = lots.reduce((sum, lot) => sum + lot.shares, 0);
        const totalCostOfHeldLots = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
        const unrealizedPNL = (totalSharesHeld * currentPrice) - totalCostOfHeldLots;

        // Only set trailing stop if unrealized P&L > 0
        if (unrealizedPNL > 0) {
          // Determine if this is a consecutive sell scenario
          const isConsecutiveSell = (lastSellPrice !== null && currentPrice > lastSellPrice);

          // Calculate lot-level profit requirement (dynamic for consecutive uptrend sells)
          let lotProfitRequirement = params.profitRequirement; // Default to base
          if (enableConsecutiveIncrementalSellProfit && isConsecutiveSell) {
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
            lotProfitRequirement = params.profitRequirement + gridSize;

            if (verbose) {
              transactionLog.push(
                colorize(`  📈 Consecutive uptrend sell (count: ${consecutiveSellCount}): lot profit req ${(lotProfitRequirement * 100).toFixed(2)}% (base ${(params.profitRequirement * 100).toFixed(2)}% + grid ${(gridSize * 100).toFixed(2)}%)`, 'cyan')
              );
            }
          }

          // Find the highest-priced lot that is eligible for selling
          // Calculate stop price using adaptive or standard pullback percentage (Spec 25)
          const stopPrice = currentPrice * (1 - effectivePullback);
          const minProfitablePrice = averageCost * (1 + params.profitRequirement); // ✅ BASE for average cost

          // Reference price for profit requirement check
          const referenceForProfit = isConsecutiveSell ? lastSellPrice : null;

          transactionLog.push(colorize(`DEBUG LOT SELECTION: currentPrice=${currentPrice.toFixed(2)}, stopPrice=${stopPrice.toFixed(2)}, baseProfitReq=${params.profitRequirement}, lotProfitReq=${lotProfitRequirement}, averageCost=${averageCost.toFixed(2)}, minProfitablePrice=${minProfitablePrice.toFixed(2)}, isConsecutiveSell=${isConsecutiveSell}, lastSellPrice=${lastSellPrice ? lastSellPrice.toFixed(2) : 'null'}, consecutiveSellCount=${consecutiveSellCount}`, 'cyan'));
          transactionLog.push(colorize(`DEBUG ALL LOTS: ${lots.map(lot => `$${lot.price.toFixed(2)}`).join(', ')}`, 'cyan'));

          // Select lots that would be profitable to sell
          let eligibleLots;

          // Spec 25: If adaptive mode says skip profit requirement, select all lots
          if (skipProfitRequirement) {
            eligibleLots = [...lots];
            if (verbose) {
              transactionLog.push(colorize(
                `  🎯 ADAPTIVE SKIP PROFIT: ALL ${lots.length} lots eligible (profit requirement bypassed)`,
                'cyan'
              ));
            }
          } else if (enableAverageBasedSell) {
            // Spec 23 Feature #2: Check profitability against average cost
            if (averageCost === 0 || lots.length === 0) {
              eligibleLots = [];
            } else {
              // Determine reference price (average cost or lastSellPrice for consecutive sells)
              let refPrice = (enableConsecutiveIncrementalSellProfit && isConsecutiveSell) ? lastSellPrice : averageCost;

              // Check if current price exceeds required profit from reference
              const isProfitable = currentPrice > refPrice * (1 + lotProfitRequirement);

              if (isProfitable) {
                // ALL lots are eligible when average-based condition met
                eligibleLots = [...lots];

                if (verbose) {
                  transactionLog.push(colorize(
                    `  AVG-SELL: Price $${currentPrice.toFixed(2)}, Ref $${refPrice.toFixed(2)} ` +
                    `(${isConsecutiveSell ? 'Last Sell' : 'Avg Cost'}), ` +
                    `Profit ${(((currentPrice - refPrice) / refPrice) * 100).toFixed(1)}%, ` +
                    `Required ${(lotProfitRequirement * 100).toFixed(1)}% → ALL ${lots.length} lots eligible`,
                    'cyan'
                  ));
                }
              } else {
                eligibleLots = [];

                if (verbose) {
                  transactionLog.push(colorize(
                    `  AVG-SELL: Price $${currentPrice.toFixed(2)}, Ref $${refPrice.toFixed(2)}, ` +
                    `Profit ${(((currentPrice - refPrice) / refPrice) * 100).toFixed(1)}%, ` +
                    `Required ${(lotProfitRequirement * 100).toFixed(1)}% → NO lots eligible`,
                    'yellow'
                  ));
                }
              }
            }
          } else {
            // Original lot-based profitability check
            // Use lastSellPrice as reference if consecutive sell, otherwise use lot price
            eligibleLots = lots.filter(lot => {
              let refPrice = isConsecutiveSell ? lastSellPrice : lot.price;
              return currentPrice > refPrice * (1 + lotProfitRequirement);
            });

            transactionLog.push(colorize(`DEBUG ELIGIBLE LOTS: ${eligibleLots.map(lot => `$${lot.price.toFixed(2)}`).join(', ')} (${eligibleLots.length} eligible)${isConsecutiveSell ? `, using lastSellPrice=$${lastSellPrice.toFixed(2)} as reference` : ', using lot prices as reference'}`, 'cyan'));
          }

          if (eligibleLots.length > 0) {
            const sortedEligibleLots = eligibleLots.sort((a, b) => b.price - a.price);
            // Select up to maxLotsToSell highest-priced eligible lots
            const lotsToSell = sortedEligibleLots.slice(0, Math.min(maxLotsToSell, sortedEligibleLots.length));

            transactionLog.push(colorize(`DEBUG SELECTED LOTS: ${lotsToSell.map(lot => `$${lot.price.toFixed(2)}`).join(', ')} (${lotsToSell.length} of ${eligibleLots.length} eligible, max ${maxLotsToSell})`, 'cyan'));

            // New pricing logic based on requirements:
            // Stop Price: current price * (1 - effectivePullback) below current price (Spec 25)
            // Limit Price: max(highest-priced eligible lot, stopPrice * 0.95) - only for LIMIT orders
            const stopPrice = currentPrice * (1 - effectivePullback);
            const highestLotPrice = lotsToSell[0].price; // Highest price among selected lots

            // Build activeStop object - only include limitPrice for LIMIT orders
            activeStop = {
              stopPrice: stopPrice,
              lotsToSell: lotsToSell, // Now supports multiple lots
              highestPrice: currentPrice,  // Track highest price for trailing
              recentBottomReference: recentBottom,
              triggerCondition: 'recent_bottom_10pct_rise',
              priceWhenOrderSet: currentPrice,  // Track the price when the trailing stop was first set
              lastUpdatePrice: currentPrice,  // Track the actual peak price when order was last updated
              lotProfitRequirement: lotProfitRequirement,  // Store for transaction history
              orderType: trailingStopOrderType  // Track order type
            };

            // Update adaptive state for next iteration (Spec 25)
            if (adaptiveSellParams.isAdaptive) {
              lastSellPullback = effectivePullback;
            }

            // Add limitPrice only for LIMIT orders
            let orderTypeInfo;
            if (trailingStopOrderType === 'limit') {
              const limitPrice = Math.max(highestLotPrice, stopPrice * 0.95);
              activeStop.limitPrice = limitPrice;
              orderTypeInfo = `Stop: ${stopPrice.toFixed(2)}, Limit: ${limitPrice.toFixed(2)}`;
            } else {
              orderTypeInfo = `Stop: ${stopPrice.toFixed(2)} (MARKET)`;
            }
            transactionLog.push(colorize(`  ACTION: TRAILING STOP SELL ACTIVATED - ${orderTypeInfo}, Triggered by ${(trailingSellActivationPercent * 100).toFixed(1)}% rise from bottom ${recentBottom.toFixed(2)} (Unrealized P&L: ${unrealizedPNL.toFixed(2)})`, 'yellow'));
            if (enableConsecutiveIncrementalSellProfit && lotProfitRequirement !== params.profitRequirement) {
              transactionLog.push(colorize(`  📈 CONSECUTIVE SELL: Lot profit requirement ${(lotProfitRequirement * 100).toFixed(2)}% (base ${(params.profitRequirement * 100).toFixed(2)}%)`, 'cyan'));
            }
          } else if (enableConsecutiveIncrementalSellProfit && isConsecutiveSell) {
            // Track aborted sell event when consecutive sell conditions fail
            const totalSharesHeld = lots.reduce((sum, lot) => sum + lot.shares, 0);
            const unrealizedPNL = (totalSharesHeld * currentPrice) - lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);

            enhancedTransactions.push({
              date: currentDate,
              type: 'ABORTED_SELL',
              price: currentPrice,
              shares: 0,
              value: 0,
              lotsDetails: null,
              lotsAfterTransaction: [...lots],
              averageCost: averageCost,
              unrealizedPNL: unrealizedPNL,
              realizedPNL: realizedPNL,
              totalPNL: unrealizedPNL + realizedPNL,
              realizedPNLFromTrade: 0,
              abortReason: `Insufficient profit for consecutive sell - Required ${(lotProfitRequirement * 100).toFixed(2)}% from last sell ${lastSellPrice.toFixed(2)}`,
              consecutiveSellCount: consecutiveSellCount,
              lotProfitRequirement: lotProfitRequirement,
              lastSellPrice: lastSellPrice
            });

            if (verbose) {
              transactionLog.push(colorize(`  🚫 ABORTED SELL: Consecutive sell profit requirement not met - Need ${(lotProfitRequirement * 100).toFixed(2)}% from ${lastSellPrice.toFixed(2)}`, 'yellow'));
            }
          }
        }
      }
    };

    // Update trailing stop when price moves higher (maintains 10% below current price)
    const updateTrailingStop = (currentPrice) => {
      if (activeStop && currentPrice > activeStop.highestPrice) {
        // Calculate adaptive sell parameters for update (Spec 25)
        const adaptiveSellParams = calculateAdaptiveSellParameters(
          currentPrice,
          lastSellPrice,
          trailingSellActivationPercent,
          trailingSellPullbackPercent,
          lastSellPullback,
          consecutiveSellCount,
          enableConsecutiveIncrementalSellProfit,
          positionStatus  // Spec 26: position-based sell gating
        );

        // Use adaptive or standard pullback
        const effectivePullback = adaptiveSellParams.pullback;

        // Keep stop price at current price * (1 - effectivePullback) below current price (Spec 25)
        const newStopPrice = currentPrice * (1 - effectivePullback);

        if (newStopPrice > activeStop.stopPrice) {
          const oldStopPrice = activeStop.stopPrice;
          const oldLimitPrice = activeStop.limitPrice;

          // Determine if this is a consecutive sell scenario
          const isConsecutiveSell = (lastSellPrice !== null && currentPrice > lastSellPrice);

          // Calculate lot-level profit requirement (same logic as activation)
          let lotProfitRequirement = params.profitRequirement; // Default to base
          if (enableConsecutiveIncrementalSellProfit && isConsecutiveSell) {
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
            lotProfitRequirement = params.profitRequirement + gridSize;
          }

          // Recalculate lot selection with new stop price using profit requirement
          // Use lastSellPrice as reference if consecutive sell, otherwise use lot price
          const eligibleLots = lots.filter(lot => {
            let refPrice = isConsecutiveSell ? lastSellPrice : lot.price;
            return currentPrice > refPrice * (1 + lotProfitRequirement);
          });

          if (eligibleLots.length > 0) {
            const sortedEligibleLots = eligibleLots.sort((a, b) => b.price - a.price);
            // Select up to maxLotsToSell highest-priced eligible lots
            const newLotsToSell = sortedEligibleLots.slice(0, Math.min(maxLotsToSell, sortedEligibleLots.length));

            const newHighestLotPrice = newLotsToSell[0].price;

            // Update stop
            activeStop.stopPrice = newStopPrice;
            activeStop.lotsToSell = newLotsToSell; // Now supports multiple lots
            activeStop.highestPrice = currentPrice;
            activeStop.lastUpdatePrice = currentPrice;
            activeStop.lotProfitRequirement = lotProfitRequirement; // Update for transaction history

            // Update adaptive state for next iteration (Spec 25)
            if (adaptiveSellParams.isAdaptive) {
              lastSellPullback = effectivePullback;
            }

            // Update limitPrice only for LIMIT orders
            let updateOrderInfo;
            if (trailingStopOrderType === 'limit') {
              const newLimitPrice = Math.max(newHighestLotPrice, newStopPrice * 0.95);
              activeStop.limitPrice = newLimitPrice;
              updateOrderInfo = `stop ${oldStopPrice.toFixed(2)} to ${newStopPrice.toFixed(2)}, limit ${(oldLimitPrice || 0).toFixed(2)} to ${newLimitPrice.toFixed(2)}`;
            } else {
              updateOrderInfo = `stop ${oldStopPrice.toFixed(2)} to ${newStopPrice.toFixed(2)} (MARKET)`;
            }
            transactionLog.push(colorize(`  ACTION: TRAILING STOP SELL UPDATED from ${updateOrderInfo}, lots: ${newLotsToSell.map(lot => `$${lot.price.toFixed(2)}`).join(', ')} (High: ${currentPrice.toFixed(2)})`, 'cyan'));
            transactionLog.push(colorize(`  DEBUG: Updated eligible lots: ${eligibleLots.map(lot => `$${lot.price.toFixed(2)}`).join(', ')}, selected: ${newLotsToSell.map(lot => `$${lot.price.toFixed(2)}`).join(', ')}`, 'cyan'));
            if (enableConsecutiveIncrementalSellProfit && lotProfitRequirement !== params.profitRequirement) {
              transactionLog.push(colorize(`  📈 CONSECUTIVE SELL: Lot profit requirement ${(lotProfitRequirement * 100).toFixed(2)}% (base ${(params.profitRequirement * 100).toFixed(2)}%)`, 'cyan'));
            }
          } else {
            // No eligible lots, cancel the stop
            activeStop = null;
            transactionLog.push(colorize(`  ACTION: TRAILING STOP CANCELLED - No eligible lots at price ${currentPrice.toFixed(2)} (profit requirement: ${(lotProfitRequirement * 100).toFixed(2)}%)`, 'yellow'));
          }
        }
      }
    };

    // Cancel trailing stop if price falls below profit requirement threshold
    const cancelTrailingStopIfUnprofitable = (currentPrice) => {
      const minProfitablePrice = averageCost * (1 + params.profitRequirement);
      if (activeStop && currentPrice <= minProfitablePrice) {
        const cancelledStopPrice = activeStop.stopPrice;
        activeStop = null;
        transactionLog.push(colorize(`  ACTION: TRAILING STOP CANCELLED - Price ${currentPrice.toFixed(2)} <= min profitable price ${minProfitablePrice.toFixed(2)} (avg cost ${averageCost.toFixed(2)}, profit requirement ${(params.profitRequirement*100).toFixed(1)}%, stop was ${cancelledStopPrice.toFixed(2)})`, 'yellow'));
      }
    };


    // Enhanced transaction records for UI
    const enhancedTransactions = [];

    /**
     * Determine and apply dynamic profile based on P/L (Spec 24)
     * @param {string} currentDate - Current date
     * @param {number} unrealizedPNL - Unrealized profit/loss
     */
    const determineAndApplyProfile = (currentDate, unrealizedPNL) => {
      if (!enableDynamicProfile) {
        return; // Feature disabled
      }

      const totalPNL = unrealizedPNL + realizedPNL;
      const currentPnLSign = totalPNL >= 0 ? 'positive' : 'negative';
      const targetProfile = totalPNL >= 0 ? 'AGGRESSIVE' : 'CONSERVATIVE';

      // Check if P/L sign changed (reset hysteresis counter)
      if (currentPnLSign !== lastPnLSign) {
        consecutiveDaysInRegion = 1;  // Reset to 1 (current day)
        lastPnLSign = currentPnLSign;
      } else {
        consecutiveDaysInRegion++;
      }

      // Check if we should switch profiles
      if (targetProfile !== currentProfile && consecutiveDaysInRegion >= HYSTERESIS_DAYS) {
        const oldProfile = currentProfile || 'NONE';
        currentProfile = targetProfile;
        profileSwitchCount++;

        // Store original parameters on first switch
        if (!originalParams) {
          originalParams = {
            trailingBuyActivationPercent: params.trailingBuyActivationPercent,
            profitRequirement: params.profitRequirement
          };
        }

        // Apply profile overrides
        const profile = PROFILES[currentProfile];
        params.trailingBuyActivationPercent = profile.overrides.trailingBuyActivationPercent;
        params.trailingSellActivationPercent = profile.overrides.trailingSellActivationPercent;
        params.profitRequirement = profile.overrides.profitRequirement;

        // Log the switch
        const switchInfo = {
          date: currentDate,
          from: oldProfile,
          to: currentProfile,
          pnl: totalPNL,
          consecutiveDays: consecutiveDaysInRegion
        };
        profileSwitches.push(switchInfo);

        transactionLog.push(colorize(
          `  🔄 PROFILE SWITCH: ${oldProfile} → ${currentProfile} (P/L: $${totalPNL.toFixed(2)}, ${consecutiveDaysInRegion} days)`,
          'magenta'
        ));
        transactionLog.push(colorize(
          `     Buy Activation: ${(profile.overrides.trailingBuyActivationPercent * 100).toFixed(0)}%, Sell Activation: ${(profile.overrides.trailingSellActivationPercent * 100).toFixed(0)}%, Profit Req: ${(profile.overrides.profitRequirement * 100).toFixed(0)}%`,
          'cyan'
        ));

        // Reset consecutive counter after switch
        consecutiveDaysInRegion = 0;
      }

      // Track days in each profile
      if (currentProfile === 'CONSERVATIVE') {
        daysInConservative++;
      } else if (currentProfile === 'AGGRESSIVE') {
        daysInAggressive++;
      }
    };

    // Main loop through each day's data
    for (let i = 0; i < pricesWithIndicators.length; i++) {
      const dayData = pricesWithIndicators[i];
      const currentPrice = dayData.adjusted_close;
      const holdingsAtStartOfDay = [...lots];
      averageCost = recalculateAverageCost();

      // Spec 26: Calculate position status based on unrealized P/L
      const positionCalc = calculatePositionStatus(lots, currentPrice, positionThreshold);
      const previousPositionStatus = positionStatus;
      positionStatus = positionCalc.status;
      portfolioUnrealizedPNL = positionCalc.pnl;

      // Log position status changes
      if (verbose && positionStatus !== previousPositionStatus) {
        transactionLog.push(colorize(`📊 Position Status Changed: ${previousPositionStatus.toUpperCase()} → ${positionStatus.toUpperCase()} (P/L: ${portfolioUnrealizedPNL >= 0 ? '+' : ''}$${portfolioUnrealizedPNL.toFixed(2)}, threshold: ±$${positionThreshold.toFixed(2)})`, 'cyan'));
      }

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
      // Note: portfolioUnrealizedPNL is already calculated above using calculatePositionStatus (line 1678)
      const totalPNL = realizedPNL + portfolioUnrealizedPNL;

      // ===== PROFILE DETERMINATION (Spec 24) =====
      if (i === 0) {
        // First day: initialize profile
        if (enableDynamicProfile) {
          currentProfile = totalPNL >= 0 ? 'AGGRESSIVE' : 'CONSERVATIVE';
          lastPnLSign = totalPNL >= 0 ? 'positive' : 'negative';
          consecutiveDaysInRegion = 1;

          // Apply initial profile
          const profile = PROFILES[currentProfile];
          originalParams = {
            trailingBuyActivationPercent: params.trailingBuyActivationPercent,
            trailingSellActivationPercent: params.trailingSellActivationPercent,
            profitRequirement: params.profitRequirement
          };
          params.trailingBuyActivationPercent = profile.overrides.trailingBuyActivationPercent;
          params.trailingSellActivationPercent = profile.overrides.trailingSellActivationPercent;
          params.profitRequirement = profile.overrides.profitRequirement;

          transactionLog.push(colorize(
            `  🎯 INITIAL PROFILE: ${currentProfile} (P/L: $${totalPNL.toFixed(2)})`,
            'magenta'
          ));
          transactionLog.push(colorize(
            `     Buy Activation: ${(profile.overrides.trailingBuyActivationPercent * 100).toFixed(0)}%, Sell Activation: ${(profile.overrides.trailingSellActivationPercent * 100).toFixed(0)}%, Profit Req: ${(profile.overrides.profitRequirement * 100).toFixed(0)}%`,
            'cyan'
          ));
        }
      } else {
        // Subsequent days: check for profile switches
        determineAndApplyProfile(dayData.date, portfolioUnrealizedPNL);
      }

      // Portfolio tracking
      // When no positions are held, show the available capital as baseline
      const maxExposure = maxLots * lotSizeUsd;
      const deployedCapital = totalCostOfHeldLots;
      const availableCapital = maxExposure - deployedCapital;
      const currentPortfolioValue = availableCapital + totalCostOfHeldLots + portfolioUnrealizedPNL + realizedPNL;

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

      // NOTE: Peak/bottom tracking is updated AFTER executions to prevent using
      // the current day's price to update stops that should execute at that price
      // Peak/bottom update is now at the end of the daily loop

      // NOTE: Consecutive buy count is ONLY reset on actual buy/sell execution
      // Price movements alone do NOT trigger resets (per Spec #17 update)

      // DEBUG: Force action logging for debugging
      if (verbose && dayData.date >= '2024-08-05' && dayData.date <= '2024-08-10') {
        if (trailingStopBuy) {
          transactionLog.push(colorize(`  🔍 [${dayData.date}] BUY STOP EXISTS: stop=${trailingStopBuy.stopPrice.toFixed(2)}, peakRef=${trailingStopBuy.recentPeakReference.toFixed(2)}`, 'cyan'));
        } else {
          transactionLog.push(colorize(`  🔍 [${dayData.date}] BUY STOP IS NULL!`, 'cyan'));
        }
        actionsOccurred = true; // Force logging for these dates
      }

      // Check if trailing stop sell should be activated (price rises 10% from recent bottom)
      checkTrailingStopSellActivation(currentPrice, dayData.date);

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

          // Execute only if execution price > limit price AND execution price > average cost * (1 + params.profitRequirement)
          // For market orders, skip the limit price check
          const minProfitablePrice = averageCost * (1 + params.profitRequirement);
          const aboveLimitPrice = trailingStopOrderType === 'market' || executionPrice > limitPrice;
          if (aboveLimitPrice && executionPrice > minProfitablePrice) {
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
              lotProfitRequirement: activeStop.lotProfitRequirement || params.profitRequirement, // Profit requirement used for this sell
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

          // Log consecutive sell profit information if applicable
          const lotProfitReq = activeStop.lotProfitRequirement || params.profitRequirement;
          if (enableConsecutiveIncrementalSellProfit) {
            if (lotProfitReq !== params.profitRequirement) {
              transactionLog.push(
                colorize(`  📈 CONSECUTIVE SELL PROFIT: Lot profit requirement was ${(lotProfitReq * 100).toFixed(2)}% (base ${(params.profitRequirement * 100).toFixed(2)}%)`, 'cyan')
              );
              if (lastSellPrice !== null) {
                transactionLog.push(
                  colorize(`  📊 Last sell price: $${lastSellPrice.toFixed(2)}, Current price: $${executionPrice.toFixed(2)}, Uptrend: ${((executionPrice / lastSellPrice - 1) * 100).toFixed(2)}%`, 'cyan')
                );
              }
            } else {
              transactionLog.push(
                colorize(`  ℹ️  CONSECUTIVE SELL: Not in consecutive uptrend (using base profit req ${(params.profitRequirement * 100).toFixed(2)}%)`, 'cyan')
              );
            }
          }

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

          // Update consecutive sell tracking state with direction-based counting (Spec 25)
          lastActionType = 'sell';

          if (consecutiveSellCount === 0) {
            // First sell in sequence
            consecutiveSellCount = 1;
            lastSellDirection = null; // No previous sell to compare
            transactionLog.push(colorize(`  🔢 CONSEC SELL COUNT: Set to 1 (first sell in sequence)`, 'cyan'));
          } else {
            // Determine direction relative to last sell
            const currentDirection = (executionPrice > lastSellPrice) ? 'up' : 'down';

            if (lastSellDirection === null) {
              // Second sell in sequence, establish direction
              const oldCount = consecutiveSellCount;
              consecutiveSellCount++;
              lastSellDirection = currentDirection;
              transactionLog.push(colorize(`  🔢 CONSEC SELL COUNT: ${oldCount} → ${consecutiveSellCount} (direction established: ${currentDirection.toUpperCase()}, price: $${lastSellPrice.toFixed(2)} → $${executionPrice.toFixed(2)})`, 'cyan'));
            } else if (currentDirection === lastSellDirection) {
              // Same direction, increment count
              const oldCount = consecutiveSellCount;
              consecutiveSellCount++;
              transactionLog.push(colorize(`  🔢 CONSEC SELL COUNT: ${oldCount} → ${consecutiveSellCount} (same direction: ${currentDirection.toUpperCase()}, price: $${lastSellPrice.toFixed(2)} → $${executionPrice.toFixed(2)})`, 'cyan'));
            } else {
              // Direction reversed, reset to 1 and save new direction
              const oldCount = consecutiveSellCount;
              const oldDirection = lastSellDirection;
              consecutiveSellCount = 1;
              lastSellDirection = currentDirection;
              transactionLog.push(colorize(`  🔄 CONSEC SELL COUNT: ${oldCount} → 1 (DIRECTION REVERSED: ${oldDirection.toUpperCase()} → ${currentDirection.toUpperCase()}, price: $${lastSellPrice.toFixed(2)} → $${executionPrice.toFixed(2)})`, 'yellow'));
            }
          }

          lastSellPrice = executionPrice;

          // Reset consecutive buy tracking state (sell breaks the consecutive buy chain)
          // Both count and lastBuyPrice are reset to allow new buy cycle at any price
          if (verbose && enableConsecutiveIncrementalBuyGrid && consecutiveBuyCount > 0) {
            transactionLog.push(colorize(`  RESET: Consecutive buy count reset from ${consecutiveBuyCount} to 0 and lastBuyPrice reset to null after sell`, 'cyan'));
          }
          consecutiveBuyCount = 0;
          lastBuyPrice = null;
          lastBuyRebound = null; // Reset adaptive state (Spec 25)
          lastBuyDirection = null; // Reset buy direction on sell

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
        header += `${pad('U.PNL: ' + portfolioUnrealizedPNL.toFixed(0), 18)}| `;
        header += `${pad('T.PNL: ' + totalPNL.toFixed(0), 18)}| `;
        header += `Holdings: ${getLotsPrices(holdingsAtStartOfDay)}`;

        transactionLog.splice(dayStartLogLength, 0, header);
      } else if (verbose) {
        // For command line, show all days. For API, only show action days
        const singleLine = `--- ${dayData.date} --- ${pad('Price: ' + currentPrice.toFixed(2), 18)}| ${pad('R.PNL: ' + realizedPNL.toFixed(0), 18)}| ${pad('U.PNL: ' + portfolioUnrealizedPNL.toFixed(0), 18)}| ${pad('T.PNL: ' + totalPNL.toFixed(0), 18)}| Holdings: ${getLotsPrices(holdingsAtStartOfDay)}`;
        transactionLog.push(singleLine);
      }

      // Update peak/bottom tracking AFTER all executions for the day
      // This ensures trailing stops are checked against yesterday's peaks, not today's
      updatePeakBottomTracking(currentPrice);
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
    transactionLog.push(`   Return on Max Deployed = Total PNL / Max Capital`);
    transactionLog.push(`                         = ($${finalValue.toFixed(2)} - $${initialValue.toFixed(2)}) / $${maxDeployedCapital.toFixed(2)}`);
    transactionLog.push(`                         = $${(finalValue - initialValue).toFixed(2)} / $${maxDeployedCapital.toFixed(2)}`);
    transactionLog.push(`                         = ${performanceMetrics.returnOnMaxDeployed.toFixed(4)} = ${performanceMetrics.returnOnMaxDeployedPercent.toFixed(2)}%`);
    transactionLog.push('');
    transactionLog.push(`   CAGR on Max Deployed = (Final / Max Capital)^(1/Years) - 1`);
    transactionLog.push(`                       = ($${finalValue.toFixed(2)} / $${maxDeployedCapital.toFixed(2)})^(1/${totalYears.toFixed(2)}) - 1`);
    transactionLog.push(`                       = ${(finalValue/maxDeployedCapital).toFixed(4)}^${(1/totalYears).toFixed(4)} - 1`);
    transactionLog.push(`                       = ${performanceMetrics.cagrOnMaxDeployed.toFixed(4)} = ${performanceMetrics.cagrOnMaxDeployedPercent.toFixed(2)}%`);
    transactionLog.push('');
    transactionLog.push(`   Return on Avg Deployed = Total PNL / Avg Capital`);
    transactionLog.push(`                         = ($${finalValue.toFixed(2)} - $${initialValue.toFixed(2)}) / $${avgDeployedCapital.toFixed(2)}`);
    transactionLog.push(`                         = $${(finalValue - initialValue).toFixed(2)} / $${avgDeployedCapital.toFixed(2)}`);
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

      // Peak/Bottom tracking for Future Trade display
      recentPeak: recentPeak,
      recentBottom: recentBottom,
      lastTransactionDate: lastTransactionDate,

      // Consecutive incremental buy grid statistics
      consecutiveIncrementalBuyGridStats: {
        enabled: enableConsecutiveIncrementalBuyGrid,
        gridConsecutiveIncrement: gridConsecutiveIncrement,
        maxConsecutiveBuyCount: maxConsecutiveBuyCount,
        avgGridSizeUsed: totalBuysCount > 0 ? (totalGridSizeUsed / totalBuysCount) : gridIntervalPercent
      },

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
        enableConsecutiveIncrementalBuyGrid,
        gridConsecutiveIncrement,
        enableScenarioDetection,
        enableDynamicProfile,
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
      buyAndHoldReturn: buyAndHoldResults.totalReturn,

      // Dynamic Profile Switching Metrics (Spec 24)
      profileMetrics: {
        enabled: enableDynamicProfile,
        totalSwitches: profileSwitchCount,
        daysInConservative: daysInConservative,
        daysInAggressive: daysInAggressive,
        conservativePercent: pricesWithIndicators.length > 0 ? (daysInConservative / pricesWithIndicators.length * 100) : 0,
        aggressivePercent: pricesWithIndicators.length > 0 ? (daysInAggressive / pricesWithIndicators.length * 100) : 0,
        switchHistory: profileSwitches.map(sw => ({
          date: sw.date,
          from: sw.from,
          to: sw.to,
          pnl: sw.pnl,
          consecutiveDays: sw.consecutiveDays
        })),
        finalProfile: currentProfile
      }
    };

    // Run scenario detection if enabled
    const scenarioAnalysis = detectScenario(backtestResult, enableScenarioDetection);

    // Add scenario analysis to result
    if (scenarioAnalysis) {
      backtestResult.scenarioAnalysis = scenarioAnalysis;
    }

    // Add active trailing stop sell information (if any) to result
    if (activeStop) {
      backtestResult.activeTrailingStopSell = {
        isActive: true,
        stopPrice: activeStop.stopPrice,
        highestPrice: activeStop.highestPrice,
        lastUpdatePrice: activeStop.lastUpdatePrice,
        recentBottomReference: activeStop.recentBottomReference,
        priceWhenOrderSet: activeStop.priceWhenOrderSet,
        lotsToSell: activeStop.lotsToSell.map(lot => ({ price: lot.price, shares: lot.shares, date: lot.date })),
        lotProfitRequirement: activeStop.lotProfitRequirement,
        orderType: activeStop.orderType
      };
      // Only include limitPrice for LIMIT orders
      if (activeStop.limitPrice !== undefined) {
        backtestResult.activeTrailingStopSell.limitPrice = activeStop.limitPrice;
      }
      console.log('✅ ACTIVE TRAILING STOP SELL at end of backtest:', {
        stopPrice: activeStop.stopPrice,
        highestPrice: activeStop.highestPrice,
        lastUpdatePrice: activeStop.lastUpdatePrice,
        recentBottomReference: activeStop.recentBottomReference,
        orderType: activeStop.orderType
      });
    } else {
      backtestResult.activeTrailingStopSell = {
        isActive: false
      };
      console.log('❌ NO ACTIVE TRAILING STOP SELL at end of backtest');
    }

    // Add active trailing stop buy information (if any) to result
    if (trailingStopBuy) {
      backtestResult.activeTrailingStopBuy = {
        isActive: true,
        stopPrice: trailingStopBuy.stopPrice,
        lowestPrice: trailingStopBuy.lastUpdatePrice,  // Actual bottom price when order was last updated
        recentPeakReference: trailingStopBuy.recentPeakReference,
        triggeredAt: trailingStopBuy.triggeredAt,
        activatedDate: trailingStopBuy.activatedDate
      };
      console.log('✅ ACTIVE TRAILING STOP BUY at end of backtest:', {
        stopPrice: trailingStopBuy.stopPrice,
        lowestPrice: trailingStopBuy.lastUpdatePrice,
        recentPeakReference: trailingStopBuy.recentPeakReference
      });
    } else {
      backtestResult.activeTrailingStopBuy = {
        isActive: false
      };
      console.log('❌ NO ACTIVE TRAILING STOP BUY at end of backtest');
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
