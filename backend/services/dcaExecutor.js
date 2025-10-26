const dcaSignalEngine = require('./dcaSignalEngine');
const { assessMarketCondition, calculateDynamicGridSpacing } = require('./shared/backtestUtilities');

/**
 * DCA Executor Module - Spec 32 Phase 1
 * Extracted trading execution logic from dcaBacktestService.js
 * 
 * This module encapsulates the day-by-day DCA trading execution in a factory pattern,
 * allowing it to be called by both single-stock backtests and portfolio backtests.
 */

/**
 * Profile definitions for dynamic profile switching (Spec 24)
 */
const PROFILES = {
  CONSERVATIVE: {
    name: 'Conservative',
    description: 'Preserve capital when in losing position',
    trigger: 'Position status = LOSING for 3+ consecutive days',
    overrides: {
      trailingBuyActivationPercent: 0.20,
      trailingSellActivationPercent: 0.00,
      profitRequirement: 0.00
    },
    color: 'blue'
  },
  AGGRESSIVE: {
    name: 'Aggressive',
    description: 'Maximize gains when in winning position',
    trigger: 'Position status = WINNING for 3+ consecutive days',
    overrides: {
      trailingBuyActivationPercent: 0.00,
      trailingSellActivationPercent: 0.20,
      profitRequirement: 0.10
    },
    color: 'green'
  }
};

const HYSTERESIS_DAYS = 3;
const ADAPTIVE_SELL_PULLBACK_DECAY = 0.5;
const ADAPTIVE_BUY_REBOUND_DECAY = 0.8;
const MIN_ADAPTIVE_SELL_PULLBACK = 0.02;
const MIN_ADAPTIVE_BUY_REBOUND = 0.05;

/**
 * Calculate total unrealized P/L for current position (Spec 45: Momentum-Based Trading)
 *
 * @param {Array} lots - Current position lots [{price, shares, date}]
 * @param {number} currentPrice - Current market price
 * @returns {number} Total unrealized P/L in USD
 */
function calculatePositionPnL(lots, currentPrice) {
  if (!lots || lots.length === 0) {
    return 0;
  }

  return lots.reduce((totalPnL, lot) => {
    const pnl = (currentPrice - lot.price) * lot.shares;
    return totalPnL + pnl;
  }, 0);
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
 * Create DCA Executor
 * @param {string} symbol - Stock symbol
 * @param {Object} params - Trading parameters
 * @param {Array} pricesWithIndicators - Price data
 * @param {boolean} verbose - Logging flag
 * @param {Object} adaptiveStrategy - Adaptive strategy instance
 * @returns {Object} Executor with processDay(), getState(), getResults() methods
 */
function createDCAExecutor(symbol, params, pricesWithIndicators, verbose = false, adaptiveStrategy = null) {
  // Extract destructured parameters from params
  const {
    lotSizeUsd,
    maxLots,
    maxLotsToSell = 1,
    gridIntervalPercent,
    profitRequirement = 0.05,
    trailingBuyActivationPercent = 0.1,
    trailingBuyReboundPercent = 0.05,
    trailingSellActivationPercent = 0.2,
    trailingSellPullbackPercent = 0.1,
    enableDynamicGrid = false,
    normalizeToReference = true,
    dynamicGridMultiplier = 1.0,
    enableConsecutiveIncrementalSellProfit = true,
    enableConsecutiveIncrementalBuyGrid = false,
    gridConsecutiveIncrement = 0.05,
    enableAdaptiveTrailingBuy = false,
    enableAdaptiveTrailingSell = false,
    trailingStopOrderType = 'limit',
    enableAverageBasedGrid = false,
    enableAverageBasedSell = false,
    enableDynamicProfile = false,
    momentumBasedBuy = false,
    momentumBasedSell = false
  } = params;

  // Clone params to track changes
  let currentParams = {
    ...params,
    buyEnabled: true,
    sellEnabled: true
  };

  // Initialize all state variables (lines 799-853 from original)
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

    // Additional tracking variables
    let maxCapitalDeployed = 0;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let rejectedBuys = 0;
    let rejectedBuyValues = 0;

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

    // Momentum-Based Trading State (Spec 45)
    let positionPnL = 0;                 // Current unrealized P/L for momentum buy gating
    let maxLotsReached = 0;              // Track maximum lots held simultaneously
    let buyBlockedByPnL = 0;             // Count of buys blocked by P/L <= 0
    const dailyPnL = [];                 // Track daily P/L history

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
      // Spec 45: Momentum mode overrides activation to 0%
      let effectiveActivation, effectiveRebound, adaptiveBuyParams;

      if (momentumBasedBuy) {
        // MOMENTUM MODE: Immediate activation (0% threshold)
        effectiveActivation = 0;
        effectiveRebound = params.trailingBuyReboundPercent;
        adaptiveBuyParams = { isAdaptive: false, activation: 0, rebound: effectiveRebound };
      } else {
        // TRADITIONAL MODE: Calculate adaptive parameters for buy (Spec 25 + Spec 27)
        adaptiveBuyParams = calculateAdaptiveBuyParameters(
          currentPrice,
          lastBuyPrice,
          params.trailingBuyActivationPercent,
          params.trailingBuyReboundPercent,
          lastBuyRebound,
          consecutiveBuyCount,
          enableConsecutiveIncrementalBuyGrid,
          positionStatus,  // Spec 26: position-based buy gating
          enableAdaptiveTrailingBuy  // Spec 27: directional control
        );

        // Use adaptive or standard parameters
        effectiveActivation = adaptiveBuyParams.activation;
        effectiveRebound = adaptiveBuyParams.rebound;
      }

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

      // Spec 27: Log directional buy blocks (always visible)
      if (adaptiveBuyParams.direction === 'up_blocked_spec27') {
        transactionLog.push(colorize(
          `  🚫 BLOCKED (Spec 27): Uptrend buy prevented - Traditional mode (Spec 17) only allows downtrend buys. ` +
          `Enable "enableAdaptiveTrailingBuy" for uptrend momentum buys (Spec 25).`,
          'yellow'
        ));
      }

      // Spec 26: Log position-based buy blocks (always visible)
      if (adaptiveBuyParams.direction === 'up_blocked') {
        transactionLog.push(colorize(
          `  🚫 BLOCKED (Spec 26): Uptrend buy prevented (Position: ${positionStatus.toUpperCase()}, P/L: ${portfolioUnrealizedPNL >= 0 ? '+' : ''}$${portfolioUnrealizedPNL.toFixed(2)}) - ` +
          `Only allow uptrend buys in WINNING position. Using standard downtrend logic instead.`,
          'yellow'
        ));
      }
      // Activation condition depends on mode
      let shouldActivate = false;
      if (momentumBasedBuy) {
        // MOMENTUM MODE: Activate when recentBottom exists (any price movement tracked)
        shouldActivate = !trailingStopBuy && recentBottom;
      } else {
        // TRADITIONAL MODE: Activate when price drops enough from peak
        shouldActivate = !trailingStopBuy && recentPeak && currentPrice <= recentPeak * (1 - effectiveActivation);
      }

      if (shouldActivate) {
        // Activate trailing stop buy
        trailingStopBuy = {
          stopPrice: currentPrice * (1 + effectiveRebound), // {effectiveRebound}% above current price
          triggeredAt: currentPrice,
          activatedDate: currentDate,
          recentPeakReference: recentPeak || currentPrice,
          lastUpdatePrice: currentPrice  // Track the actual bottom price (price when order was last updated)
        };

        // Update adaptive state for next iteration
        if (adaptiveBuyParams.isAdaptive) {
          lastBuyRebound = effectiveRebound;
        }

        const modeLabel = momentumBasedBuy ? '[MOMENTUM]' : (adaptiveBuyParams.isAdaptive ? '[ADAPTIVE]' : '');
        transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY ACTIVATED ${modeLabel} - Stop: ${trailingStopBuy.stopPrice.toFixed(2)}, Triggered by ${(effectiveActivation*100).toFixed(1)}% threshold`, 'blue'));
      }
    };

    // Update trailing stop buy (move stop down if price goes down further)
    const updateTrailingStopBuy = (currentPrice) => {
      if (trailingStopBuy) {
        // Calculate adaptive parameters (Spec 25 + Spec 27)
        const adaptiveBuyParams = calculateAdaptiveBuyParameters(
          currentPrice,
          lastBuyPrice,
          params.trailingBuyActivationPercent,
          params.trailingBuyReboundPercent,
          lastBuyRebound,
          consecutiveBuyCount,
          enableConsecutiveIncrementalBuyGrid,
          positionStatus,  // Spec 26: position-based buy gating
          enableAdaptiveTrailingBuy  // Spec 27: directional control
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

          // Spec 45: MOMENTUM MODE - Check position P/L
          if (momentumBasedBuy) {
            // Exception: First buy always allowed (no position yet)
            if (lots.length > 0 && positionPnL <= 0) {
              transactionLog.push(colorize(
                `  ✗ MOMENTUM BUY BLOCKED: Position P/L $${positionPnL.toFixed(2)} ≤ 0 (need profit to buy more)`,
                'yellow'
              ));
              buyBlockedByPnL++;
              return false;  // Blocked - not profitable
            } else if (lots.length > 0) {
              transactionLog.push(colorize(
                `  ✓ MOMENTUM BUY CHECK PASSED: Position P/L $${positionPnL.toFixed(2)} > 0`,
                'green'
              ));
            } else {
              transactionLog.push(colorize(
                `  ✓ MOMENTUM BUY CHECK PASSED: First buy (no P/L requirement)`,
                'green'
              ));
            }
          }

          // Position size check: maxLots vs Capital
          let canBuy = false;
          if (momentumBasedBuy) {
            // MOMENTUM MODE: Check capital availability only
            const deployedCapital = lots.reduce((sum, lot) =>
              sum + (lot.price * lot.shares), 0
            );
            const totalCapital = maxLots * lotSizeUsd;
            const availableCapital = totalCapital - deployedCapital;

            if (availableCapital >= lotSizeUsd) {
              canBuy = true;
              if (verbose) {
                transactionLog.push(colorize(
                  `  ✓ MOMENTUM CAPITAL CHECK: $${availableCapital.toFixed(0)} available >= $${lotSizeUsd} needed`,
                  'cyan'
                ));
              }
            } else {
              transactionLog.push(colorize(
                `  ✗ MOMENTUM BUY BLOCKED: Insufficient capital ($${availableCapital.toFixed(0)} available, need $${lotSizeUsd})`,
                'yellow'
              ));
            }
          } else {
            // TRADITIONAL MODE: Check maxLots
            canBuy = lots.length < maxLots;
          }

          // Trailing stop buy triggered - check if we can execute
          if (canBuy) {
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
              enableConsecutiveIncrementalBuyGrid,
              lastBuyDirection
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
                const isLastBuy = (index === lots.length - 1);

                if (enableDynamicGrid) {
                  gridSize = calculateDynamicGridSpacing(midPrice, ref, dynamicGridMultiplier, normalizeToReference);
                  transactionLog.push(colorize(`    [DEBUG] DYNAMIC GRID BRANCH: lot#${index + 1}, gridSize=${(gridSize*100).toFixed(2)}%`, 'magenta'));
                } else if (enableConsecutiveIncrementalBuyGrid) {
                  // For consecutive incremental buy grid:
                  // - Check spacing from LAST buy using incremental spacing based on consecutive count
                  // - Check spacing from OTHER buys using base gridIntervalPercent

                  if (isLastBuy && consecutiveBuyCount > 0) {
                    // For last buy, always use incremental grid spacing based on current consecutive count
                    // We use consecutiveBuyCount (not -1) because this is the count BEFORE this new buy
                    // At execution time, we need the spacing that SHOULD be required based on downtrend state
                    gridSize = gridIntervalPercent + (consecutiveBuyCount * gridConsecutiveIncrement);
                    transactionLog.push(colorize(`    [DEBUG] CONSEC INCR BRANCH (LAST): lot#${index + 1}, isLast=${isLastBuy}, consec=${consecutiveBuyCount}, base=${(gridIntervalPercent*100).toFixed(0)}%, incr=${(gridConsecutiveIncrement*100).toFixed(0)}%, gridSize=${(gridSize*100).toFixed(2)}%`, 'magenta'));
                  } else {
                    // For other buys or first buy: Use base grid spacing
                    gridSize = gridIntervalPercent;
                    transactionLog.push(colorize(`    [DEBUG] CONSEC INCR BRANCH (OTHER): lot#${index + 1}, isLast=${isLastBuy}, consec=${consecutiveBuyCount}, gridSize=${(gridSize*100).toFixed(2)}%`, 'magenta'));
                  }
                } else {
                  gridSize = gridIntervalPercent; // Legacy fixed percentage
                  transactionLog.push(colorize(`    [DEBUG] LEGACY BRANCH: lot#${index + 1}, gridSize=${(gridSize*100).toFixed(2)}%`, 'magenta'));
                }

                const spacing = Math.abs(currentPrice - lot.price) / lot.price;
                const meetsSpacing = spacing >= gridSize;

                // ALWAYS log spacing check at execution time for debugging
                transactionLog.push(colorize(`    ✓ EXEC CHECK Lot #${index + 1} @ $${lot.price.toFixed(2)}: spacing=${(spacing*100).toFixed(2)}%, required=${(gridSize*100).toFixed(2)}%, consec=${consecutiveBuyCount}, passes=${meetsSpacing}`, meetsSpacing ? 'green' : 'yellow'));

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

            // BUG FIX: Re-check adaptive buy parameters at execution time
            // The trailing stop may have been set during downtrend but executing during uptrend
            const executionAdaptiveParams = calculateAdaptiveBuyParameters(
              currentPrice,
              lastBuyPrice,
              trailingBuyActivationPercent,
              trailingBuyReboundPercent,
              lastBuyRebound,
              consecutiveBuyCount,
              enableConsecutiveIncrementalBuyGrid,
              positionStatus,  // Current position status at execution
              enableAdaptiveTrailingBuy  // Spec 27: directional control
            );

            // Check if this buy should be blocked at execution time
            if (executionAdaptiveParams.direction === 'up_blocked_spec27') {
              // BLOCKED: Uptrend buy prevented by Spec 27
              transactionLog.push(colorize(
                `  🚫 BLOCKED AT EXECUTION (Spec 27): Uptrend buy prevented - Traditional mode only allows downtrend buys. ` +
                `Trailing stop was set at $${trailingStopBuy.stopPrice.toFixed(2)} but execution at $${currentPrice.toFixed(2)} would be uptrend (last buy: $${lastBuyPrice.toFixed(2)}). ` +
                `Enable "enableAdaptiveTrailingBuy" for uptrend momentum buys.`,
                'yellow'
              ));
              // Cancel the trailing stop
              trailingStopBuy = null;
              return false;
            }

            if (executionAdaptiveParams.direction === 'up_blocked') {
              // BLOCKED: Uptrend buy prevented by Spec 26 position gating
              transactionLog.push(colorize(
                `  🚫 BLOCKED AT EXECUTION (Spec 26): Uptrend buy prevented (Position: ${positionStatus.toUpperCase()}, P/L: ${portfolioUnrealizedPNL >= 0 ? '+' : ''}$${portfolioUnrealizedPNL.toFixed(2)}) - ` +
                `Trailing stop was set at $${trailingStopBuy.stopPrice.toFixed(2)} but execution at $${currentPrice.toFixed(2)} would be uptrend (last buy: $${lastBuyPrice.toFixed(2)}). ` +
                `Only allow uptrend buys in WINNING position.`,
                'yellow'
              ));
              // Cancel the trailing stop
              trailingStopBuy = null;
              return false;
            }

            // RE-VALIDATE grid spacing at execution time with CURRENT consecutive buy count
            // The trailing stop may have been set days/weeks ago when consecutiveBuyCount was different
            // We need to ensure the spacing requirement is still met based on the current count
            let respectsGridSpacingAtExecution;
            if (enableAverageBasedGrid) {
              // Average-based grid spacing check
              if (lots.length === 0) {
                respectsGridSpacingAtExecution = true;
              } else if (averageCost === 0) {
                respectsGridSpacingAtExecution = true;
              } else {
                const spacing = Math.abs(currentPrice - averageCost) / averageCost;
                let gridSize;
                if (enableDynamicGrid) {
                  const midPrice = (currentPrice + averageCost) / 2;
                  const ref = referencePrice || midPrice;
                  gridSize = calculateDynamicGridSpacing(midPrice, ref, dynamicGridMultiplier, normalizeToReference);
                } else if (enableConsecutiveIncrementalBuyGrid) {
                  // Use CURRENT count for validation (count BEFORE this buy executes)
                  gridSize = gridIntervalPercent + (consecutiveBuyCount * gridConsecutiveIncrement);
                } else {
                  gridSize = gridIntervalPercent;
                }
                respectsGridSpacingAtExecution = spacing >= gridSize;

                if (!respectsGridSpacingAtExecution && verbose) {
                  transactionLog.push(colorize(
                    `  🚫 EXECUTION BLOCKED: Grid spacing violation at execution - ` +
                    `Avg Cost: $${averageCost.toFixed(2)}, Spacing: ${(spacing * 100).toFixed(2)}%, Required: ${(gridSize * 100).toFixed(2)}% (Consecutive Count: ${consecutiveBuyCount})`,
                    'yellow'
                  ));
                }
              }
            } else {
              // Lot-based grid spacing check
              respectsGridSpacingAtExecution = lots.every((lot, index) => {
                const isLastBuy = (index === lots.length - 1);
                let gridSize;

                if (enableDynamicGrid) {
                  const midPrice = (currentPrice + lot.price) / 2;
                  const ref = referencePrice || midPrice;
                  gridSize = calculateDynamicGridSpacing(midPrice, ref, dynamicGridMultiplier, normalizeToReference);
                } else if (enableConsecutiveIncrementalBuyGrid && isLastBuy && consecutiveBuyCount > 0) {
                  // For consecutive incremental buy grid, always check against the last buy with incremental spacing
                  // We use consecutiveBuyCount (not consecutiveBuyCount - 1) because this is the count BEFORE the new buy
                  // At execution time, we need the spacing that SHOULD be required based on current state
                  gridSize = gridIntervalPercent + (consecutiveBuyCount * gridConsecutiveIncrement);

                  if (verbose) {
                    transactionLog.push(colorize(
                      `  📏 EXECUTION VALIDATION: Checking lot #${index + 1} @ $${lot.price.toFixed(2)} - ` +
                      `Current Price: $${currentPrice.toFixed(2)}, Consecutive Count: ${consecutiveBuyCount}, Required Grid: ${(gridSize * 100).toFixed(2)}%`,
                      'cyan'
                    ));
                  }
                } else {
                  gridSize = gridIntervalPercent;
                }

                const spacing = Math.abs(currentPrice - lot.price) / lot.price;
                const meetsSpacing = spacing >= gridSize;

                if (!meetsSpacing && verbose) {
                  transactionLog.push(colorize(
                    `  🚫 EXECUTION BLOCKED: Lot #${index + 1} @ $${lot.price.toFixed(2)} spacing violation - ` +
                    `Spacing: ${(spacing * 100).toFixed(2)}%, Required: ${(gridSize * 100).toFixed(2)}% (Consecutive Count: ${consecutiveBuyCount})`,
                    'yellow'
                  ));
                }

                return meetsSpacing;
              });
            }

            // If grid spacing check fails at execution time, cancel the trailing stop
            if (!respectsGridSpacingAtExecution) {
              transactionLog.push(colorize(
                `  🚫 BLOCKED AT EXECUTION: Grid spacing validation failed - ` +
                `Trailing stop was set at $${trailingStopBuy.stopPrice.toFixed(2)} but execution at $${currentPrice.toFixed(2)} violates spacing requirement (Consecutive Buy Count: ${consecutiveBuyCount})`,
                'yellow'
              ));
              // Cancel the trailing stop
              trailingStopBuy = null;
              return false;
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

            // Clear trailing stop buy and any active sell stop (mutual exclusion)
            trailingStopBuy = null;
            activeStop = null; // Cancel opposing sell stop to prevent simultaneous execution
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
                  // Use CURRENT count for spacing validation, not predicted count
                  gridSize = gridIntervalPercent + (consecutiveBuyCount * gridConsecutiveIncrement);
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
                      // DOWNTREND: Use incremental grid spacing based on CURRENT count (not predicted)
                      // For spacing validation, use the grid that's currently active, not the future grid
                      gridSize = gridIntervalPercent + (consecutiveBuyCount * gridConsecutiveIncrement);
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
      // Spec 45: Momentum mode overrides activation to 0%
      let effectiveActivation, effectivePullback, skipProfitRequirement, adaptiveSellParams;

      if (momentumBasedSell) {
        // MOMENTUM MODE: Immediate activation (0% threshold)
        effectiveActivation = 0;
        effectivePullback = params.trailingSellPullbackPercent;
        skipProfitRequirement = false;  // Still require profit in momentum mode
        adaptiveSellParams = { isAdaptive: false, activation: 0, pullback: effectivePullback };
      } else {
        // TRADITIONAL MODE: Calculate adaptive sell parameters (Spec 25 + Spec 27)
        adaptiveSellParams = calculateAdaptiveSellParameters(
          currentPrice,
          lastSellPrice,
          trailingSellActivationPercent,
          trailingSellPullbackPercent,
          lastSellPullback,
          consecutiveSellCount,
          enableConsecutiveIncrementalSellProfit,
          positionStatus,  // Spec 26: position-based sell gating
          enableAdaptiveTrailingSell  // Spec 27: directional control
        );

        // Use adaptive or standard parameters
        effectiveActivation = adaptiveSellParams.activation;
        effectivePullback = adaptiveSellParams.pullback;
        skipProfitRequirement = adaptiveSellParams.skipProfitRequirement;
      }

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

      // Spec 27: Log directional sell blocks (always visible)
      if (adaptiveSellParams.direction === 'down_blocked_spec27') {
        transactionLog.push(colorize(
          `  🚫 BLOCKED (Spec 27): Downtrend sell prevented - Traditional mode (Spec 18) only allows uptrend sells. ` +
          `Enable "enableAdaptiveTrailingSell" for downtrend stop loss sells (Spec 25).`,
          'yellow'
        ));
      }

      // Activation condition depends on mode
      let shouldActivate = false;
      if (momentumBasedSell) {
        // MOMENTUM MODE: Activate when recentPeak exists (any price movement tracked)
        shouldActivate = lots.length > 0 && !activeStop && recentPeak;
      } else {
        // TRADITIONAL MODE: Activate when price rises enough from bottom and above average cost
        shouldActivate = lots.length > 0 && currentPrice > averageCost && !activeStop && recentBottom && currentPrice >= recentBottom * (1 + effectiveActivation);
      }

      if (shouldActivate) {
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
            const modeLabel = momentumBasedSell ? '[MOMENTUM]' : (adaptiveSellParams.isAdaptive ? '[ADAPTIVE]' : '');
            transactionLog.push(colorize(`  ACTION: TRAILING STOP SELL ACTIVATED ${modeLabel} - ${orderTypeInfo}, Triggered by ${(effectiveActivation * 100).toFixed(1)}% threshold (Unrealized P&L: ${unrealizedPNL.toFixed(2)})`, 'yellow'));
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
        // Calculate adaptive sell parameters for update (Spec 25 + Spec 27)
        const adaptiveSellParams = calculateAdaptiveSellParameters(
          currentPrice,
          lastSellPrice,
          trailingSellActivationPercent,
          trailingSellPullbackPercent,
          lastSellPullback,
          consecutiveSellCount,
          enableConsecutiveIncrementalSellProfit,
          positionStatus,  // Spec 26: position-based sell gating
          enableAdaptiveTrailingSell  // Spec 27: directional control
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
            transactionLog.push(colorize(`  ACTION: TRAILING STOP SELL CANCELLED - No eligible lots at price ${currentPrice.toFixed(2)} (profit requirement: ${(lotProfitRequirement * 100).toFixed(2)}%)`, 'yellow'));
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
        transactionLog.push(colorize(`  ACTION: TRAILING STOP SELL CANCELLED - Price ${currentPrice.toFixed(2)} <= min profitable price ${minProfitablePrice.toFixed(2)} (avg cost ${averageCost.toFixed(2)}, profit requirement ${(params.profitRequirement*100).toFixed(1)}%, stop was ${cancelledStopPrice.toFixed(2)})`, 'yellow'));
      }
    };


    // Enhanced transaction records for UI
    const enhancedTransactions = [];

    /**
     * Determine and apply dynamic profile based on position status (Spec 24)
     * @param {string} currentDate - Current date
     * @param {number} unrealizedPNL - Unrealized profit/loss
     * @param {string} currentPositionStatus - Current position status ('winning'|'losing'|'neutral')
     */
    const determineAndApplyProfile = (currentDate, unrealizedPNL, currentPositionStatus) => {
      if (!enableDynamicProfile) {
        return; // Feature disabled
      }

      const totalPNL = unrealizedPNL + realizedPNL;

      // Determine target profile based on position status
      let targetProfile = null;
      if (currentPositionStatus === 'winning') {
        targetProfile = 'AGGRESSIVE';
      } else if (currentPositionStatus === 'losing') {
        targetProfile = 'CONSERVATIVE';
      }
      // Note: neutral position doesn't trigger profile change

      // Check if position status changed (reset hysteresis counter)
      if (currentPositionStatus !== lastPnLSign) {
        consecutiveDaysInRegion = 1;  // Reset to 1 (current day)
        lastPnLSign = currentPositionStatus;
      } else {
        consecutiveDaysInRegion++;
      }

      // Check if we should switch profiles (only switch if targetProfile is defined)
      if (targetProfile && targetProfile !== currentProfile && consecutiveDaysInRegion >= HYSTERESIS_DAYS) {
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
          `  🔄 PROFILE SWITCH: ${oldProfile} → ${currentProfile} (Position: ${currentPositionStatus.toUpperCase()}, P/L: $${totalPNL.toFixed(2)}, ${consecutiveDaysInRegion} days)`,
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

    /**
     * Process one day of trading execution
     * Extracted from main loop for Phase 1 of Spec 32
     * @param {Object} dayData - Price and indicator data for the day
     * @param {number} i - Day index
     * @param {Object} context - Execution context
     * @param {boolean} context.buyEnabled - Whether to execute buy orders (default: true)
     */
    const processOneDayOfTrading = async (dayData, i, context = { buyEnabled: true }) => {
      const currentPrice = dayData.adjusted_close;

      // DEBUG: Log first 3 days
      if (i < 3) {
        console.log(`🔧 EXECUTOR Day ${i}: price=${currentPrice}, context=`, context, `lots=${lots.length}`);
      }

      const holdingsAtStartOfDay = [...lots];
      averageCost = recalculateAverageCost();

      // Spec 26: Calculate position status based on unrealized P/L
      const positionCalc = calculatePositionStatus(lots, currentPrice, positionThreshold);
      const previousPositionStatus = positionStatus;
      positionStatus = positionCalc.status;
      portfolioUnrealizedPNL = positionCalc.pnl;

      // Spec 45: Calculate position P/L for momentum buy gating
      positionPnL = calculatePositionPnL(lots, currentPrice);
      dailyPnL.push({ date: dayData.date, pnl: positionPnL });

      // Track max lots reached
      if (lots.length > maxLotsReached) {
        maxLotsReached = lots.length;
      }

      // Log position status changes (Spec 26: always visible)
      if (positionStatus !== previousPositionStatus) {
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
        // First day: initialize profile based on position status
        if (enableDynamicProfile) {
          // Determine initial profile from position status
          if (positionStatus === 'winning') {
            currentProfile = 'AGGRESSIVE';
          } else if (positionStatus === 'losing') {
            currentProfile = 'CONSERVATIVE';
          }
          // Note: neutral position starts with no profile

          lastPnLSign = positionStatus;
          consecutiveDaysInRegion = 1;

          // Apply initial profile if one was determined
          if (currentProfile) {
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
              `  🎯 INITIAL PROFILE: ${currentProfile} (Position: ${positionStatus.toUpperCase()}, P/L: $${totalPNL.toFixed(2)})`,
              'magenta'
            ));
            transactionLog.push(colorize(
              `     Buy Activation: ${(profile.overrides.trailingBuyActivationPercent * 100).toFixed(0)}%, Sell Activation: ${(profile.overrides.trailingSellActivationPercent * 100).toFixed(0)}%, Profit Req: ${(profile.overrides.profitRequirement * 100).toFixed(0)}%`,
              'cyan'
            ));
          }
        }
      } else {
        // Subsequent days: check for profile switches
        determineAndApplyProfile(dayData.date, portfolioUnrealizedPNL, positionStatus);
      }

      // Portfolio tracking
      // When no positions are held, show the available capital as baseline
      const maxExposure = maxLots * lotSizeUsd;
      const deployedCapital = totalCostOfHeldLots;
      const availableCapital = maxExposure - deployedCapital;
      const currentPortfolioValue = availableCapital + totalCostOfHeldLots + portfolioUnrealizedPNL + realizedPNL;

      dailyPortfolioValues.push(currentPortfolioValue);
      dailyCapitalDeployed.push(totalCostOfHeldLots);

      // Track max capital deployed
      if (deployedCapital > maxCapitalDeployed) {
        maxCapitalDeployed = deployedCapital;
      }

      // Track drawdown
      let peakValue = dailyPortfolioValues.reduce((max, val) => Math.max(max, val), 0);
      if (peakValue > 0) {
        const drawdown = peakValue - currentPortfolioValue;
        const drawdownPercent = (drawdown / peakValue) * 100;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
        if (drawdownPercent > maxDrawdownPercent) {
          maxDrawdownPercent = drawdownPercent;
        }
      }

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
              lotsCost: soldLot.shares * soldLot.price, // Original cost of the lot sold
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

          // Clear active sell stop and any active buy stop (mutual exclusion)
          activeStop = null;
          trailingStopBuy = null; // Cancel opposing buy stop to prevent simultaneous execution
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
      // Gate buy execution based on context.buyEnabled (Spec 32 Phase 1)
      if (context.buyEnabled) {
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
    };

  // Return executor interface
  return {
    /**
     * Process one day of trading
     */
    processDay: async (dayData, dayIndex, context = { buyEnabled: true }) => {
      // Update currentParams from context
      if (context.buyEnabled !== undefined) {
        currentParams.buyEnabled = context.buyEnabled;
      }
      if (context.sellEnabled !== undefined) {
        currentParams.sellEnabled = context.sellEnabled;
      }

      return await processOneDayOfTrading(dayData, dayIndex, context);
    },

    /**
     * Get current state (for inspection)
     */
    getState: () => {
      // Calculate current unrealized PNL
      const totalSharesHeld = lots.reduce((sum, lot) => sum + lot.shares, 0);
      const totalCostOfHeldLots = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
      const lastPrice = pricesWithIndicators[pricesWithIndicators.length - 1]?.adjusted_close || 0;
      const unrealizedPNL = (totalSharesHeld * lastPrice) - totalCostOfHeldLots;
      const totalPNL = realizedPNL + unrealizedPNL;

      return {
        lots,
        enhancedTransactions,
        realizedPNL,
        unrealizedPNL,
        totalPNL,
        averageCost,
        positionStatus,
        trailingStopBuy,
        activeStop,
        consecutiveBuyCount,
        consecutiveSellCount,
        maxCapitalDeployed,
        dailyPortfolioValues,
        dailyCapitalDeployed
      };
    },

    /**
     * Get final results
     */
    getResults: () => {
      // Calculate final metrics
      const capitalDeployed = lots.reduce((sum, lot) =>
        sum + (lot.shares * lot.price), 0
      );

      const lastPrice = pricesWithIndicators[pricesWithIndicators.length - 1].close;
      const marketValue = lots.reduce((sum, lot) =>
        sum + (lot.shares * lastPrice), 0
      );

      const finalUnrealizedPNL = marketValue - capitalDeployed;
      const finalTotalPNL = realizedPNL + finalUnrealizedPNL;

      return {
        summary: {
          symbol,
          lotsHeld: lots.length,
          capitalDeployed,
          marketValue,
          unrealizedPNL: finalUnrealizedPNL,
          realizedPNL,
          totalPNL: finalTotalPNL,
          totalReturn: marketValue + realizedPNL,
          returnPercent: maxCapitalDeployed > 0 ?
            (finalTotalPNL / maxCapitalDeployed) * 100 : 0,
          maxDrawdown,
          maxDrawdownPercent,
          maxCapitalDeployed,
          rejectedBuys,
          rejectedBuyValues,
          buyTransactions: enhancedTransactions.filter(t => t.type.includes('BUY')).length,
          sellTransactions: enhancedTransactions.filter(t => t.type.includes('SELL')).length,
          profileSwitchCount,
          daysInConservative,
          daysInAggressive,
          // Spec 45: Momentum mode statistics
          momentumMode: {
            buy: momentumBasedBuy,
            sell: momentumBasedSell
          },
          maxLotsReached: maxLotsReached,
          buyBlockedByPnL: buyBlockedByPnL
        },
        transactions: enhancedTransactions,
        lots: lots,
        transactionLog: transactionLog,  // Always return transaction log (verbose controls extra detail only)
        dailyPortfolioValues,
        profileSwitches,
        questionableEvents,
        recentPeak,
        recentBottom,
        lastTransactionDate,
        maxConsecutiveBuyCount,
        totalGridSizeUsed,
        totalBuysCount,
        currentProfile,
        // Spec 45: Additional momentum tracking
        dailyPnL: dailyPnL,
        positionMetrics: dailyPnL.length > 0 ? {
          avgPnL: dailyPnL.reduce((sum, d) => sum + d.pnl, 0) / dailyPnL.length,
          maxPnL: Math.max(...dailyPnL.map(d => d.pnl)),
          minPnL: Math.min(...dailyPnL.map(d => d.pnl)),
          finalPnL: positionPnL
        } : null
      };
    }
  };
}

module.exports = {
  createDCAExecutor,
  PROFILES,
  HYSTERESIS_DAYS
};
