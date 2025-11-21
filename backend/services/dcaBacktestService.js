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
const { createDCAExecutor } = require('./dcaExecutor');

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
    description: 'Preserve capital when in losing position',
    trigger: 'Position status = LOSING for 3+ consecutive days',
    overrides: {
      trailingBuyActivationPercent: 0.20,  // Harder to buy - wait for 20% drop
      trailingSellActivationPercent: 0.00, // Easier to sell - no activation needed
      profitRequirement: 0.00              // Easier to sell - no profit requirement
    },
    color: 'blue'
  },

  AGGRESSIVE: {
    name: 'Aggressive',
    description: 'Maximize gains when in winning position',
    trigger: 'Position status = WINNING for 3+ consecutive days',
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
 * @param {string|null} lastBuyDirection - Direction of last buy ('up'|'down'|null)
 * @returns {number} Grid size to use for next buy (as decimal, e.g., 0.10 for 10%)
 */
function calculateBuyGridSize(
  gridIntervalPercent,
  gridConsecutiveIncrement,
  consecutiveBuyCount,
  lastBuyPrice,
  currentBuyPrice,
  enableConsecutiveIncrementalBuyGrid,
  lastBuyDirection
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
    // CRITICAL FIX: Predict what the consecutiveBuyCount will be AFTER this trade executes
    // This ensures the grid size shown in the transaction matches the actual count in effect
    let predictedCount;

    if (consecutiveBuyCount === 0) {
      // First buy - count will become 1
      predictedCount = 1;
    } else {
      // Determine direction of this buy relative to last buy
      const currentDirection = (currentBuyPrice > lastBuyPrice) ? 'up' : 'down';

      if (lastBuyDirection === null) {
        // Second buy - direction will be established, count will increment
        predictedCount = consecutiveBuyCount + 1;
      } else if (currentDirection === lastBuyDirection) {
        // Same direction - count will increment
        predictedCount = consecutiveBuyCount + 1;
      } else {
        // Direction reversal - count will reset to 1
        predictedCount = 1;
      }
    }

    // Formula: base_grid + (predicted_count * increment)
    // Use the count that will be in effect AFTER this trade, not the current count
    nextGridSize = gridIntervalPercent + (predictedCount * gridConsecutiveIncrement);
  }

  return nextGridSize;
}

/**
 * Calculate adaptive sell trailing stop parameters (Spec 25 + Spec 27)
 * Automatically adjusts trailing stop parameters based on price direction during consecutive sells
 *
 * @param {number} currentPrice - Current market price
 * @param {number|null} lastSellPrice - Price of most recent sell (null if no previous sell)
 * @param {number} trailingSellActivationPercent - Base activation threshold (decimal)
 * @param {number} trailingSellPullbackPercent - Base pullback threshold (decimal)
 * @param {number|null} lastSellPullback - Last used pullback % (null on first sell)
 * @param {number} consecutiveSellCount - Number of consecutive sells
 * @param {boolean} enableConsecutiveIncrementalSellProfit - Is feature enabled?
 * @param {string} positionStatus - Position status for sell gating (Spec 26)
 * @param {boolean} enableAdaptiveTrailingSell - Enable adaptive (downtrend) selling (Spec 27)
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
  positionStatus,  // Spec 26: position status for sell gating
  enableAdaptiveTrailingSell = false  // Spec 27: directional control
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

  // Spec 27: Check if we should block or allow downtrend sells
  if (isDowntrend) {
    if (!enableAdaptiveTrailingSell) {
      // BLOCKED: Downtrend sell prevented by Spec 27 (traditional Spec 18 behavior)
      return {
        activation,
        pullback,
        skipProfitRequirement: false,
        isAdaptive: false,
        direction: 'down_blocked_spec27',
        blockReason: 'traditional_uptrend_only'
      };
    }

    // CASE 1: Price falling + adaptive enabled - exit faster (Spec 25)
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

  // CASE 2: Price rising - standard behavior (Spec 18)
  return {
    activation,
    pullback,
    skipProfitRequirement: false,
    isAdaptive: false,
    direction: 'up'
  };
}

/**
 * Calculate adaptive buy trailing stop parameters (Spec 25 + Spec 27)
 * Automatically adjusts trailing stop parameters based on price direction during consecutive buys
 *
 * @param {number} currentPrice - Current market price
 * @param {number|null} lastBuyPrice - Price of most recent buy (null if no previous buy)
 * @param {number} trailingBuyActivationPercent - Base activation threshold (decimal)
 * @param {number} trailingBuyReboundPercent - Base rebound threshold (decimal)
 * @param {number|null} lastBuyRebound - Last used rebound % (null on first buy)
 * @param {number} consecutiveBuyCount - Number of consecutive buys
 * @param {boolean} enableConsecutiveIncrementalBuyGrid - Is feature enabled?
 * @param {string} positionStatus - Position status for buy gating (Spec 26)
 * @param {boolean} enableAdaptiveTrailingBuy - Enable adaptive (uptrend) buying (Spec 27)
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
  positionStatus,  // Spec 26: position status for buy gating
  enableAdaptiveTrailingBuy = false  // Spec 27: directional control
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

  // Spec 27: Check if we should block or allow uptrend buys
  if (isUptrend) {
    if (!enableAdaptiveTrailingBuy) {
      // BLOCKED: Uptrend buy prevented by Spec 27 (traditional Spec 17 behavior)
      return {
        activation,
        rebound,
        isAdaptive: false,
        direction: 'up_blocked_spec27',
        blockReason: 'traditional_downtrend_only'
      };
    }

    // Adaptive enabled - check Spec 26 position gating
    if (positionStatus !== 'winning') {
      // Block uptrend buy - Spec 26 position gating
      return {
        activation,
        rebound,
        isAdaptive: false,
        direction: 'up_blocked',  // Indicates uptrend but blocked by position
        blockReason: `position_${positionStatus}`
      };
    }

    // CASE 1: Price rising + adaptive enabled + winning position - accumulate faster (Spec 25)
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

  // CASE 2: Price falling - standard behavior (Spec 17)
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
async function runDCABacktest(params, dayCallback = null) {
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
    enableAdaptiveTrailingBuy = false, // Spec 27: Enable adaptive buy (uptrend) vs traditional (downtrend only)
    enableAdaptiveTrailingSell = false, // Spec 27: Enable adaptive sell (downtrend) vs traditional (uptrend only)
    enableScenarioDetection = true, // Enable scenario detection and analysis
    trailingStopOrderType = 'limit', // Order type: 'limit' (cancels if exceeds peak/bottom) or 'market' (always executes)
    enableAverageBasedGrid = false, // Enable average-cost based grid spacing (Spec 23 Feature #1)
    enableAverageBasedSell = false, // Enable average-cost based sell profitability (Spec 23 Feature #2)
    enableDynamicProfile = false, // Enable dynamic profile switching based on P/L (Spec 24)
    momentumBasedBuy = false, // Enable momentum-based buy (Spec 45)
    momentumBasedSell = false, // Enable momentum-based sell (Spec 45)
    verbose = true
  } = params;

  // DEBUG: Log momentum parameters
  console.log('DEBUG params.momentumBasedBuy:', params.momentumBasedBuy, 'extracted:', momentumBasedBuy);
  console.log('DEBUG params.momentumBasedSell:', params.momentumBasedSell, 'extracted:', momentumBasedSell);

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
    console.log(`   Conservative when position = LOSING: Harder to buy (${(consProfile.overrides.trailingBuyActivationPercent * 100).toFixed(0)}%), easier to sell (${(consProfile.overrides.trailingSellActivationPercent * 100).toFixed(0)}%)`);
    console.log(`   Aggressive when position = WINNING: Easier to buy (${(aggProfile.overrides.trailingBuyActivationPercent * 100).toFixed(0)}%), harder to sell (${(aggProfile.overrides.trailingSellActivationPercent * 100).toFixed(0)}%)`);
    console.log(`   Requires ${HYSTERESIS_DAYS} consecutive days in same position status before switching`);
  }

  // Log directional strategy control flags (Spec 27)
  if (enableConsecutiveIncrementalBuyGrid) {
    if (enableAdaptiveTrailingBuy) {
      console.log(`📈 Buy Direction: ADAPTIVE (Spec 25) - allows uptrend buys`);
    } else {
      console.log(`📉 Buy Direction: TRADITIONAL (Spec 17) - downtrend only`);
    }
  }
  if (enableConsecutiveIncrementalSellProfit) {
    if (enableAdaptiveTrailingSell) {
      console.log(`📉 Sell Direction: ADAPTIVE (Spec 25) - allows downtrend sells`);
    } else {
      console.log(`📈 Sell Direction: TRADITIONAL (Spec 18) - uptrend only`);
    }
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

  // Apply beta scaling if enabled (Spec 43: Centralized Beta Scaling)
  let executorParams = { ...params };

  if (params.enableBetaScaling) {
    const BetaScalingService = require('./betaScaling/BetaScalingService');
    const betaService = require('./betaService');
    const betaScalingService = new BetaScalingService(betaService);

    const coefficient = params.betaScalingCoefficient || 1.0;

    const scalingResult = await betaScalingService.applyBetaScaling(
      params,
      symbol,
      {
        enableBetaScaling: true,
        coefficient,
        beta: params.beta,
        isManualBetaOverride: !!params.beta
      }
    );

    if (scalingResult.success) {
      executorParams = scalingResult.adjustedParameters;

      if (verbose) {
        console.log(`🔬 Beta Scaling Applied (Spec 43):`);
        console.log(`   Beta: ${scalingResult.betaInfo.beta.toFixed(3)} (source: ${scalingResult.betaInfo.source})`);
        console.log(`   Coefficient: ${scalingResult.betaInfo.coefficient.toFixed(2)}`);
        console.log(`   Beta Factor: ${scalingResult.betaInfo.betaFactor.toFixed(3)}`);
      }

      // Log warnings if any
      if (scalingResult.warnings && scalingResult.warnings.length > 0) {
        console.log(`⚠️  Beta Scaling Warnings:`);
        scalingResult.warnings.forEach(warning => console.log(`   - ${warning}`));
      }
    } else {
      console.warn(`⚠️  Beta scaling failed, using base parameters:`, scalingResult.errors);
    }
  }

  // Initialize Adaptive Strategy
  let adaptiveStrategy = null;
  let currentParams = {
    ...executorParams,  // Use beta-scaled parameters
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
    // Note: getPricesWithIndicators doesn't support current price appending yet
    // For now, we'll fetch daily prices with current price, then join with indicators manually
    const dailyPrices = await database.getDailyPricesWithCurrent(stock.id, symbol, startDate, endDate);

    // Join with technical indicators manually
    let pricesWithIndicators = dailyPrices;

    // Try to get technical indicators for the date range
    // Note: Tech indicators won't exist for current day's live price
    try {
      const indicators = await database.getTechnicalIndicators(stock.id, startDate, endDate);
      const indicatorMap = new Map(indicators.map(ind => [ind.date, ind]));

      pricesWithIndicators = dailyPrices.map(price => {
        const indicator = indicatorMap.get(price.date) || {};
        return {
          ...price,
          ma_5: indicator.ma_5 || null,
          ma_10: indicator.ma_10 || null,
          ma_20: indicator.ma_20 || null,
          ma_50: indicator.ma_50 || null,
          ma_200: indicator.ma_200 || null,
          rsi_14: indicator.rsi_14 || null,
          volatility_20: indicator.volatility_20 || null,
          weekly_trend: indicator.weekly_trend || null,
          avg_volume_20: indicator.avg_volume_20 || null,
          volume_ratio: indicator.volume_ratio || null,
          price_vs_ma20: indicator.price_vs_ma20 || null,
          price_vs_ma200: indicator.price_vs_ma200 || null,
          ma50_vs_ma200: indicator.ma50_vs_ma200 || null,
          support_50: indicator.support_50 || null,
          resistance_50: indicator.resistance_50 || null
        };
      });
    } catch (error) {
      // If technical indicators aren't available, proceed with just price data
      console.warn(`⚠️  Technical indicators not available: ${error.message}`);
    }

    // If no data found for the exact date range, try with latest available data
    if (pricesWithIndicators.length === 0) {
      const latestPriceDate = await database.getLastPriceDate(stock.id);

      if (latestPriceDate) {
        // Adjust end date to latest available data
        console.warn(`⚠️  No data found until ${endDate} for ${symbol}, using latest available data (${latestPriceDate})`);

        // Use new method with current price support
        const fallbackPrices = await database.getDailyPricesWithCurrent(stock.id, symbol, startDate, latestPriceDate);
        const fallbackIndicators = await database.getTechnicalIndicators(stock.id, startDate, latestPriceDate);
        const fallbackIndicatorMap = new Map(fallbackIndicators.map(ind => [ind.date, ind]));

        pricesWithIndicators = fallbackPrices.map(price => {
          const indicator = fallbackIndicatorMap.get(price.date) || {};
          return {
            ...price,
            ma_5: indicator.ma_5 || null,
            ma_10: indicator.ma_10 || null,
            ma_20: indicator.ma_20 || null,
            ma_50: indicator.ma_50 || null,
            ma_200: indicator.ma_200 || null,
            rsi_14: indicator.rsi_14 || null,
            volatility_20: indicator.volatility_20 || null,
            weekly_trend: indicator.weekly_trend || null,
            avg_volume_20: indicator.avg_volume_20 || null,
            volume_ratio: indicator.volume_ratio || null,
            price_vs_ma20: indicator.price_vs_ma20 || null,
            price_vs_ma200: indicator.price_vs_ma200 || null,
            ma50_vs_ma200: indicator.ma50_vs_ma200 || null,
            support_50: indicator.support_50 || null,
            resistance_50: indicator.resistance_50 || null
          };
        });
      }

      // If still no data, the stock truly has no price data in the database
      if (pricesWithIndicators.length === 0) {
        throw new Error(`No price/indicator data found for ${symbol}. The stock may not exist or data fetch failed. Please check the symbol and try again.`);
      }
    }

    if (verbose) {
      console.log(`📈 Fetched ${pricesWithIndicators.length} records with technical indicators.`);
    }

    // --- Core Backtesting Algorithm (Spec 32 Phase 1: Extracted to dcaExecutor.js) ---
    
    // Create DCA executor instance
    const executor = createDCAExecutor(
      symbol,
      params,
      pricesWithIndicators,
      verbose,
      adaptiveStrategy
    );

    // Main loop through each day's data
    // Spec 32 Phase 2: Support dayCallback for portfolio capital gating
    for (let i = 0; i < pricesWithIndicators.length; i++) {
      // Call day callback if provided (for portfolio capital control)
      const dayContext = dayCallback ?
        await dayCallback(pricesWithIndicators[i].date, i) :
        { buyEnabled: true };

      await executor.processDay(pricesWithIndicators[i], i, dayContext);
    }

    // Get final results from executor
    const executorResults = executor.getResults();
    const executorState = executor.getState();

    // DEBUG: Check momentum statistics
    console.log('DEBUG executorResults.summary.momentumMode:', executorResults.summary.momentumMode);
    console.log('DEBUG executorResults.summary.maxLotsReached:', executorResults.summary.maxLotsReached);
    console.log('DEBUG executorResults.summary.buyBlockedByPnL:', executorResults.summary.buyBlockedByPnL);
    
    // Extract state variables for compatibility with existing code
    const lots = executorState.lots;
    const realizedPNL = executorState.realizedPNL;
    const enhancedTransactions = executorResults.transactions;
    const transactionLog = executorResults.transactionLog;
    const dailyPortfolioValues = executorResults.dailyPortfolioValues;
    const dailyCapitalDeployed = executorState.dailyCapitalDeployed;
    const questionableEvents = executorResults.questionableEvents;
    const maxCapitalDeployed = executorState.maxCapitalDeployed;
    const profileSwitches = executorResults.profileSwitches;
    const profileSwitchCount = executorResults.summary.profileSwitchCount;
    const daysInConservative = executorResults.summary.daysInConservative;
    const daysInAggressive = executorResults.summary.daysInAggressive;
    const recentPeak = executorResults.recentPeak;
    const recentBottom = executorResults.recentBottom;
    const lastTransactionDate = executorResults.lastTransactionDate;
    const activeStop = executorState.activeStop;
    const trailingStopBuy = executorState.trailingStopBuy;

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
    transactionLog.push(`   Profit Factor: ${performanceMetrics.profitFactor !== null ? performanceMetrics.profitFactor.toFixed(3) : 'Infinite (no losses)'}`);
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
      recentPeakDate: executorResults.recentPeakDate,       // [Spec 51]
      recentBottomDate: executorResults.recentBottomDate,   // [Spec 51]
      lastTransactionDate: lastTransactionDate,

      // Consecutive incremental buy grid statistics
      consecutiveIncrementalBuyGridStats: {
        enabled: enableConsecutiveIncrementalBuyGrid,
        gridConsecutiveIncrement: gridConsecutiveIncrement,
        maxConsecutiveBuyCount: executorResults.maxConsecutiveBuyCount,
        avgGridSizeUsed: executorResults.totalBuysCount > 0 ? (executorResults.totalGridSizeUsed / executorResults.totalBuysCount) : gridIntervalPercent
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
        finalProfile: executorResults.currentProfile
      },

      // Spec 45: Momentum-Based Trading Metrics
      momentumMode: executorResults.summary.momentumMode,
      maxLotsReached: executorResults.summary.maxLotsReached,
      buyBlockedByPnL: executorResults.summary.buyBlockedByPnL,
      dailyPnL: executorResults.dailyPnL,
      positionMetrics: executorResults.positionMetrics
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

/**
 * Create a DCA executor for portfolio backtesting (Spec 32 Phase 2 - Approach A3)
 * Uses callback pattern to enable portfolio control of capital availability day-by-day.
 *
 * IMPLEMENTATION: Approach A3 - Callback-based execution
 * - Portfolio provides a Map of dates -> { buyEnabled } context
 * - runDCABacktest calls dayCallback before each day to get context
 * - Minimal changes (~10 lines), maximum compatibility
 *
 * @param {string} symbol - Stock symbol
 * @param {Object} params - DCA parameters (same as runDCABacktest)
 * @param {Map<string, Object>} capitalAvailabilityByDate - Map of date -> {buyEnabled: boolean}
 * @returns {Promise<Object>} Backtest results with capital-gated execution
 */
// OLD WRAPPER REMOVED: createDCAExecutor is now imported from ./dcaExecutor
// Portfolio now uses createDCAExecutor directly from dcaExecutor.js with processDay() calls

module.exports = {
  runDCABacktest,
  calculateMetrics,
  calculatePortfolioDrawdown,
  assessMarketCondition,
  calculateBuyAndHold
};
