/**
 * DCA Signal Engine - Pure Functions for Trading Logic
 *
 * This module contains stateless, pure functions for DCA trading signal evaluation.
 * All functions take input parameters and return results without side effects.
 *
 * Used by both:
 * - Individual DCA backtest (dcaBacktestService.js)
 * - Portfolio backtest (portfolioBacktestService.js)
 *
 * @module dcaSignalEngine
 */

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

let lotIdCounter = 0;

/**
 * Generate unique lot ID
 * @returns {string} Unique lot identifier
 */
function generateLotId() {
  return `lot-${Date.now()}-${++lotIdCounter}`;
}

// ============================================================================
// GRID CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate average cost of all lots
 * @param {Array} lots - Array of lot objects with price and shares
 * @returns {number} Average cost per share
 */
function calculateAverageCost(lots) {
  if (!lots || lots.length === 0) return 0;

  const totalCost = lots.reduce((sum, lot) => sum + (lot.price * lot.shares), 0);
  const totalShares = lots.reduce((sum, lot) => sum + lot.shares, 0);

  return totalShares > 0 ? totalCost / totalShares : 0;
}

/**
 * Calculate the buy grid level (price threshold for next buy)
 * @param {number} referencePrice - Reference price (average cost or last buy price)
 * @param {number} gridIntervalPercent - Grid interval percentage (e.g., 0.10 for 10%)
 * @param {number} consecutiveBuys - Number of consecutive buys (for incremental adjustment)
 * @returns {number} Buy grid price
 */
function calculateBuyGridLevel(referencePrice, gridIntervalPercent, consecutiveBuys = 0) {
  if (!referencePrice || referencePrice === 0) {
    return 0; // No grid level for first buy
  }

  // Apply incremental grid adjustment for consecutive buys (optional enhancement)
  // const adjustedInterval = gridIntervalPercent * (1 + consecutiveBuys * 0.1);
  const adjustedInterval = gridIntervalPercent; // Keep simple for now

  return referencePrice * (1 - adjustedInterval);
}

/**
 * Calculate the sell grid level (target price for selling a lot)
 * @param {number} lotCost - Cost basis of the lot
 * @param {number} profitRequirement - Required profit percentage (e.g., 0.10 for 10%)
 * @param {number} consecutiveSells - Number of consecutive sells (for incremental adjustment)
 * @returns {number} Sell grid price
 */
function calculateSellGridLevel(lotCost, profitRequirement, consecutiveSells = 0) {
  // Apply incremental profit adjustment for consecutive sells (optional enhancement)
  // const adjustedProfit = profitRequirement * (1 + consecutiveSells * 0.1);
  const adjustedProfit = profitRequirement; // Keep simple for now

  return lotCost * (1 + adjustedProfit);
}

// ============================================================================
// LOT MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Calculate profit percentage for a lot
 * @param {Object} lot - Lot object with price
 * @param {number} currentPrice - Current market price
 * @returns {number} Profit percentage
 */
function calculateLotProfitPercent(lot, currentPrice) {
  if (!lot || !lot.price || lot.price === 0) return 0;
  return ((currentPrice - lot.price) / lot.price) * 100;
}

/**
 * Filter lots that meet minimum profit requirement
 * @param {Array} lots - All lots
 * @param {number} currentPrice - Current market price
 * @param {number} minProfitPercent - Minimum profit percentage (e.g., 10 for 10%)
 * @returns {Array} Profitable lots with profit info
 */
function filterProfitableLots(lots, currentPrice, minProfitPercent) {
  if (!lots || lots.length === 0) return [];

  return lots
    .map(lot => ({
      ...lot,
      profitPercent: calculateLotProfitPercent(lot, currentPrice)
    }))
    .filter(lot => lot.profitPercent >= minProfitPercent);
}

/**
 * Select lots to sell based on strategy (LIFO, FIFO, etc.)
 * @param {Array} lots - Available lots
 * @param {string} strategy - Selection strategy ('LIFO', 'FIFO', 'HIGHEST_PROFIT')
 * @returns {Array} Selected lots (single lot for now)
 */
function selectLotsToSell(lots, strategy = 'LIFO') {
  if (!lots || lots.length === 0) return [];

  switch (strategy) {
    case 'LIFO':
      // Return the most recent lot (last in, first out)
      // Sort by price DESC to get highest-priced lot
      const sortedByPrice = [...lots].sort((a, b) => b.price - a.price);
      return [sortedByPrice[0]];

    case 'FIFO':
      // Return the oldest lot (first in, first out)
      return [lots[0]];

    case 'HIGHEST_PROFIT':
      // Return lot with highest profit percentage
      return [lots.reduce((max, lot) =>
        lot.profitPercent > max.profitPercent ? lot : max
      )];

    default:
      // Default to LIFO (highest price)
      const sorted = [...lots].sort((a, b) => b.price - a.price);
      return [sorted[0]];
  }
}

// ============================================================================
// SIGNAL EVALUATION FUNCTIONS
// ============================================================================

/**
 * Evaluate if a buy signal should trigger
 * @param {Object} state - Current trading state
 * @param {Object} params - Trading parameters
 * @param {number} currentPrice - Current market price
 * @param {Object} indicators - Technical indicators (optional)
 * @returns {Object} { triggered: boolean, reason: string, type: string, ... }
 */
function evaluateBuySignal(state, params, currentPrice, indicators = {}) {
  const { lots = [], dcaState = {}, consecutiveBuys = 0 } = state;

  // Check max lots constraint
  if (lots.length >= params.maxLots) {
    return { triggered: false, reason: 'Max lots reached' };
  }

  // First buy - no grid needed
  if (lots.length === 0) {
    return {
      triggered: true,
      reason: 'Initial buy',
      type: 'INITIAL_BUY',
      price: currentPrice
    };
  }

  // Grid-based buy logic: Buy when price drops by gridIntervalPercent from last buy
  const gridInterval = params.gridIntervalPercent || 0.10;
  const lastBuyPrice = dcaState.lastBuyPrice || lots[lots.length - 1]?.price;

  if (lastBuyPrice && currentPrice <= lastBuyPrice * (1 - gridInterval)) {
    const gridPrice = lastBuyPrice * (1 - gridInterval);
    return {
      triggered: true,
      reason: 'Price below buy grid',
      type: 'GRID_BUY',
      price: currentPrice,
      gridPrice
    };
  }

  // Check trailing stop buy (if enabled)
  if (params.trailingBuy && dcaState.trailingStopBuy) {
    if (currentPrice >= dcaState.trailingStopBuy.stopPrice) {
      return {
        triggered: true,
        reason: 'Trailing stop buy triggered',
        type: 'TRAILING_STOP_BUY',
        stopPrice: dcaState.trailingStopBuy.stopPrice,
        price: currentPrice
      };
    }
  }

  return { triggered: false, reason: 'No buy conditions met' };
}

/**
 * Evaluate if a sell signal should trigger
 * @param {Object} state - Current trading state
 * @param {Object} params - Trading parameters
 * @param {number} currentPrice - Current market price
 * @param {Object} indicators - Technical indicators (optional)
 * @returns {Object} { triggered: boolean, reason: string, lotsToSell: Array, ... }
 */
function evaluateSellSignal(state, params, currentPrice, indicators = {}) {
  const { lots = [], dcaState = {}, consecutiveSells = 0 } = state;

  // No lots to sell
  if (lots.length === 0) {
    return { triggered: false, reason: 'No lots to sell' };
  }

  // Check trailing stop sell (if active)
  if (dcaState.activeStop) {
    if (currentPrice <= dcaState.activeStop.stopPrice) {
      // Select lot based on strategy
      const lotsToSell = selectLotsToSell(lots, params.lotSelectionStrategy || 'LIFO');
      return {
        triggered: true,
        reason: 'Trailing stop sell triggered',
        type: 'TRAILING_STOP_SELL',
        stopPrice: dcaState.activeStop.stopPrice,
        price: currentPrice,
        lotsToSell
      };
    }
  }

  // Profit-taking sell logic: Sell highest lot if profit >= profitRequirement
  const profitRequirement = (params.profitRequirement || 0.10) * 100; // Convert to percentage
  const profitableLots = filterProfitableLots(lots, currentPrice, profitRequirement);

  if (profitableLots.length === 0) {
    return { triggered: false, reason: 'No profitable lots' };
  }

  // Select lots to sell (LIFO by default)
  const lotsToSell = selectLotsToSell(profitableLots, params.lotSelectionStrategy || 'LIFO');

  return {
    triggered: true,
    reason: 'Profitable lots available',
    type: 'PROFIT_TAKING',
    price: currentPrice,
    lotPrice: lotsToSell[0].price,
    profitPercent: calculateLotProfitPercent(lotsToSell[0], currentPrice),
    lotsToSell
  };
}

/**
 * Evaluate trailing stop conditions
 * @param {Object} state - Current trading state
 * @param {Object} params - Trading parameters (trailingStopActivation, trailingStopDistance)
 * @param {number} currentPrice - Current market price
 * @returns {Object} { triggered: boolean, reason: string, lotsToSell: Array, stopPrice: number }
 */
function evaluateTrailingStop(state, params, currentPrice) {
  const { lots = [], peakPrices = {} } = state;

  if (!params.traillingSell) { // Note: typo in original code
    return { triggered: false, reason: 'Trailing stop not enabled' };
  }

  if (lots.length === 0) {
    return { triggered: false, reason: 'No lots to evaluate' };
  }

  // Check each lot for trailing stop activation
  const lotsToSell = [];
  const activationThreshold = params.trailingStopActivation || 0.20; // 20%
  const pullbackDistance = params.trailingStopDistance || 0.10; // 10%

  for (const lot of lots) {
    const profitPercent = calculateLotProfitPercent(lot, currentPrice) / 100; // Convert to decimal

    // Check if activation threshold met
    if (profitPercent < activationThreshold) {
      continue;
    }

    // Get peak price for this lot
    const peakPrice = peakPrices[lot.id] || currentPrice;
    const pullbackPercent = ((peakPrice - currentPrice) / peakPrice);

    // Check if pullback exceeds distance threshold
    if (pullbackPercent >= pullbackDistance) {
      lotsToSell.push(lot);
    }
  }

  if (lotsToSell.length === 0) {
    return { triggered: false, reason: 'No trailing stop conditions met' };
  }

  return {
    triggered: true,
    reason: 'Trailing stop triggered',
    type: 'TRAILING_STOP',
    lotsToSell,
    stopPrice: currentPrice
  };
}

// ============================================================================
// STATE TRANSFORMATION FUNCTIONS
// ============================================================================

/**
 * Apply a buy transaction to the state (immutable)
 * @param {Object} state - Current trading state
 * @param {Object} transaction - Buy transaction details
 * @returns {Object} New state
 */
function applyBuyTransaction(state, transaction) {
  const newLot = {
    id: generateLotId(),
    price: transaction.price,
    shares: transaction.shares,
    date: transaction.date,
    value: transaction.value
  };

  return {
    ...state,
    lots: [...(state.lots || []), newLot],
    consecutiveBuys: (state.consecutiveBuys || 0) + 1,
    consecutiveSells: 0, // Reset sell counter
    totalInvested: (state.totalInvested || 0) + transaction.value,
    dcaState: {
      ...(state.dcaState || {}),
      lastBuyPrice: transaction.price,
      bottom: Math.min(state.dcaState?.bottom || transaction.price, transaction.price)
    }
  };
}

/**
 * Apply a sell transaction to the state (immutable)
 * @param {Object} state - Current trading state
 * @param {Object} transaction - Sell transaction details
 * @param {Array} lotsToRemove - Lots being sold
 * @returns {Object} New state
 */
function applySellTransaction(state, transaction, lotsToRemove) {
  const lotIds = lotsToRemove.map(lot => lot.id);
  const remainingLots = (state.lots || []).filter(lot => !lotIds.includes(lot.id));

  return {
    ...state,
    lots: remainingLots,
    consecutiveSells: (state.consecutiveSells || 0) + 1,
    consecutiveBuys: 0, // Reset buy counter
    totalRealized: (state.totalRealized || 0) + (transaction.realizedPNLFromTrade || transaction.pnl || 0),
    dcaState: {
      ...(state.dcaState || {}),
      lastSellPrice: transaction.price,
      activeStop: null, // Clear active stop after sell
      peak: null // Reset peak after sell
    }
  };
}

/**
 * Update peak prices for trailing stop tracking (immutable)
 * @param {Object} state - Current trading state
 * @param {number} currentPrice - Current market price
 * @returns {Object} New state with updated peaks
 */
function updatePeakTracking(state, currentPrice) {
  const peakPrices = { ...(state.peakPrices || {}) };
  const lots = state.lots || [];

  for (const lot of lots) {
    const currentPeak = peakPrices[lot.id] || lot.price;
    peakPrices[lot.id] = Math.max(currentPeak, currentPrice);
  }

  // Also update global peak in dcaState
  const dcaState = { ...(state.dcaState || {}) };
  if (dcaState.peak) {
    dcaState.peak = Math.max(dcaState.peak, currentPrice);
  } else {
    dcaState.peak = currentPrice;
  }

  return {
    ...state,
    peakPrices,
    dcaState
  };
}

/**
 * Update bottom tracking for buy signals (immutable)
 * @param {Object} state - Current trading state
 * @param {number} currentPrice - Current market price
 * @returns {Object} New state with updated bottom
 */
function updateBottomTracking(state, currentPrice) {
  const dcaState = { ...(state.dcaState || {}) };

  if (dcaState.bottom) {
    dcaState.bottom = Math.min(dcaState.bottom, currentPrice);
  } else {
    dcaState.bottom = currentPrice;
  }

  return {
    ...state,
    dcaState
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Helper functions
  generateLotId,

  // Grid calculations
  calculateAverageCost,
  calculateBuyGridLevel,
  calculateSellGridLevel,

  // Lot management
  calculateLotProfitPercent,
  filterProfitableLots,
  selectLotsToSell,

  // Signal evaluation
  evaluateBuySignal,
  evaluateSellSignal,
  evaluateTrailingStop,

  // State transformations
  applyBuyTransaction,
  applySellTransaction,
  updatePeakTracking,
  updateBottomTracking
};
