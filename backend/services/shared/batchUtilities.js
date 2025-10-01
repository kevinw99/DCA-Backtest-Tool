/**
 * Shared Batch Backtest Utilities
 *
 * Common functions for batch backtesting operations.
 * Used by both batchBacktestService and shortBatchBacktestService.
 */

/**
 * Generate summary statistics from batch backtest results
 * Identical implementation for both long and short strategies
 *
 * @param {Array<Object>} results - Array of backtest results
 * @param {Object} parameterRanges - Parameter ranges used for batch
 * @returns {Object} Summary statistics including best parameters per symbol
 */
function generateBatchSummary(results, parameterRanges) {
  if (results.length === 0) return null;

  // Group results by symbol for best parameters analysis
  const resultsBySymbol = {};
  results.forEach(result => {
    const symbol = result.parameters.symbol;
    if (!resultsBySymbol[symbol]) resultsBySymbol[symbol] = [];
    resultsBySymbol[symbol].push(result);
  });

  // Find best parameters for each symbol
  const bestParametersBySymbol = {};
  Object.keys(resultsBySymbol).forEach(symbol => {
    const symbolResults = resultsBySymbol[symbol];
    const bestByTotalReturn = symbolResults[0]; // Already sorted
    const bestByAnnualized = [...symbolResults].sort((a, b) => {
      const aValue = a.summary?.annualizedReturn || 0;
      const bValue = b.summary?.annualizedReturn || 0;
      return bValue - aValue;
    })[0];

    bestParametersBySymbol[symbol] = {
      bestByTotalReturn: {
        parameters: bestByTotalReturn.parameters,
        totalReturn: bestByTotalReturn.summary?.totalReturn || 0,
        annualizedReturn: bestByTotalReturn.summary?.annualizedReturn || 0,
        winRate: bestByTotalReturn.summary?.winRate || 0
      },
      bestByAnnualizedReturn: {
        parameters: bestByAnnualized.parameters,
        totalReturn: bestByAnnualized.summary?.totalReturn || 0,
        annualizedReturn: bestByAnnualized.summary?.annualizedReturn || 0,
        winRate: bestByAnnualized.summary?.winRate || 0
      }
    };
  });

  // Overall statistics
  const totalReturns = results.map(r => r.summary?.totalReturn || 0);
  const annualizedReturns = results.map(r => r.summary?.annualizedReturn || 0);
  const winRates = results.map(r => r.summary?.winRate || 0);

  return {
    overallBest: results[0], // Best overall result
    bestParametersBySymbol,
    statistics: {
      totalRuns: results.length,
      averageTotalReturn: totalReturns.reduce((a, b) => a + b, 0) / totalReturns.length,
      averageAnnualizedReturn: annualizedReturns.reduce((a, b) => a + b, 0) / annualizedReturns.length,
      averageWinRate: winRates.reduce((a, b) => a + b, 0) / winRates.length,
      maxTotalReturn: Math.max(...totalReturns),
      minTotalReturn: Math.min(...totalReturns),
      maxAnnualizedReturn: Math.max(...annualizedReturns),
      minAnnualizedReturn: Math.min(...annualizedReturns),
      maxWinRate: Math.max(...winRates),
      minWinRate: Math.min(...winRates)
    },
    parameterRanges
  };
}

/**
 * Sort batch results by total return (descending)
 *
 * @param {Array<Object>} results - Array of backtest results
 * @returns {Array<Object>} Sorted results
 */
function sortResultsByTotalReturn(results) {
  return results.sort((a, b) => {
    const aValue = a.summary?.totalReturn || 0;
    const bValue = b.summary?.totalReturn || 0;
    return bValue - aValue;
  });
}

/**
 * Sort batch results by annualized return (descending)
 *
 * @param {Array<Object>} results - Array of backtest results
 * @returns {Array<Object>} Sorted results
 */
function sortResultsByAnnualizedReturn(results) {
  return results.sort((a, b) => {
    const aValue = a.summary?.annualizedReturn || 0;
    const bValue = b.summary?.annualizedReturn || 0;
    return bValue - aValue;
  });
}

/**
 * Filter results by minimum performance thresholds
 *
 * @param {Array<Object>} results - Array of backtest results
 * @param {Object} thresholds - Performance thresholds
 * @param {number} thresholds.minTotalReturn - Minimum total return
 * @param {number} thresholds.minAnnualizedReturn - Minimum annualized return
 * @param {number} thresholds.minWinRate - Minimum win rate
 * @returns {Array<Object>} Filtered results
 */
function filterResultsByThresholds(results, thresholds = {}) {
  return results.filter(result => {
    const summary = result.summary || {};

    if (thresholds.minTotalReturn !== undefined && summary.totalReturn < thresholds.minTotalReturn) {
      return false;
    }
    if (thresholds.minAnnualizedReturn !== undefined && summary.annualizedReturn < thresholds.minAnnualizedReturn) {
      return false;
    }
    if (thresholds.minWinRate !== undefined && summary.winRate < thresholds.minWinRate) {
      return false;
    }

    return true;
  });
}

/**
 * Calculate progress percentage
 *
 * @param {number} current - Current iteration
 * @param {number} total - Total iterations
 * @returns {number} Progress percentage (0-100)
 */
function calculateProgress(current, total) {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
}

module.exports = {
  generateBatchSummary,
  sortResultsByTotalReturn,
  sortResultsByAnnualizedReturn,
  filterResultsByThresholds,
  calculateProgress
};
