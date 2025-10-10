/**
 * Chart Calculation Utilities
 *
 * Extracted helper functions for calculating chart metrics in BacktestResults.
 * These functions eliminate code duplication and improve maintainability.
 */

/**
 * Calculate P/L percentage based on max capital deployed
 * @param {number} totalPNL - Total profit/loss amount
 * @param {number} maxCapitalDeployed - Maximum capital deployed (only increases, never decreases)
 * @returns {number|null} - P/L percentage or null if no capital deployed
 */
export const calculatePNLPercentage = (totalPNL, maxCapitalDeployed) => {
  return maxCapitalDeployed > 0 ? (totalPNL / maxCapitalDeployed) * 100 : null;
};

/**
 * Find the most recent non-aborted transaction on or before a given date
 * @param {Array} transactions - Array of transaction objects
 * @param {Date|string} currentDate - Current date to search from
 * @returns {Object|null} - Most recent transaction or null
 */
export const findMostRecentTransaction = (transactions, currentDate) => {
  for (let i = transactions.length - 1; i >= 0; i--) {
    const txDate = new Date(transactions[i].date);
    const compDate = new Date(currentDate);

    if (txDate <= compDate &&
        !['ABORTED_BUY', 'ABORTED_SELL'].includes(transactions[i].type)) {
      return transactions[i];
    }
  }
  return null;
};

/**
 * Calculate Buy & Hold return percentage
 * @param {number} currentPrice - Current stock price
 * @param {number} startPrice - Starting stock price
 * @returns {number} - Buy & Hold return percentage
 */
export const calculateBuyAndHoldPercent = (currentPrice, startPrice) => {
  return startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;
};

/**
 * Get current number of lots from a transaction object
 * Handles both long positions (lotsAfterTransaction) and short positions (shortsAfterTransaction)
 * @param {Object} transaction - Transaction object
 * @returns {number} - Number of lots/shorts
 */
export const getCurrentLots = (transaction) => {
  if (!transaction) return 0;
  return transaction.lotsAfterTransaction?.length ||
         transaction.shortsAfterTransaction?.length || 0;
};

/**
 * Calculate unrealized P/L for current open positions
 * @param {Array} lots - Array of open lot objects with buyPrice
 * @param {number} currentPrice - Current market price
 * @param {number} lotSizeUsd - Size of each lot in USD
 * @returns {number} - Unrealized P/L amount
 */
export const calculateUnrealizedPNL = (lots, currentPrice, lotSizeUsd) => {
  if (!lots || lots.length === 0) return 0;

  return lots.reduce((sum, lot) => {
    const shares = lotSizeUsd / lot.buyPrice;
    const currentValue = shares * currentPrice;
    const pnl = currentValue - lotSizeUsd;
    return sum + pnl;
  }, 0);
};

/**
 * Calculate total capital deployed based on number of lots
 * @param {number} numberOfLots - Number of open lots
 * @param {number} lotSizeUsd - Size of each lot in USD
 * @returns {number} - Total capital deployed
 */
export const calculateCapitalDeployed = (numberOfLots, lotSizeUsd) => {
  return numberOfLots * lotSizeUsd;
};

/**
 * Calculate capital deployment percentage relative to max exposure
 * @param {number} capitalDeployed - Current capital deployed
 * @param {number} maxExposure - Maximum allowed exposure
 * @returns {number|null} - Deployment percentage or null if maxExposure is 0
 */
export const calculateDeploymentPercent = (capitalDeployed, maxExposure) => {
  return maxExposure > 0 ? (capitalDeployed / maxExposure) * 100 : null;
};
