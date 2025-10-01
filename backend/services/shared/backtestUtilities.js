/**
 * Shared Backtest Utilities
 *
 * Common calculations and helper functions used across DCA backtest services.
 * Eliminates code duplication between dcaBacktestService and shortDCABacktestService.
 */

/**
 * Calculate portfolio drawdown from portfolio values
 * Identical implementation used in both long and short strategies
 *
 * @param {Array<number>} portfolioValues - Array of portfolio values over time
 * @returns {Object} { maxDrawdown, maxDrawdownPercent }
 */
function calculatePortfolioDrawdown(portfolioValues) {
  if (portfolioValues.length === 0) return { maxDrawdown: 0, maxDrawdownPercent: 0 };

  let maxValue = Math.max(0, portfolioValues[0]);
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  for (const value of portfolioValues) {
    if (value > maxValue && value > 0) {
      maxValue = value;
    }

    if (maxValue > 0) {
      const drawdown = Math.max(0, maxValue - value);
      const drawdownPercent = (drawdown / maxValue) * 100;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
      if (drawdownPercent > maxDrawdownPercent) {
        maxDrawdownPercent = drawdownPercent;
      }
    }
  }

  return { maxDrawdown, maxDrawdownPercent };
}

/**
 * Assess market condition based on technical indicators
 * Identical implementation used in both long and short strategies
 *
 * @param {Object} indicators - Technical indicators object
 * @param {number} indicators.adjusted_close - Current price
 * @param {number} indicators.ma_200 - 200-day moving average
 * @param {number} indicators.ma_50 - 50-day moving average
 * @param {number} indicators.volatility_20 - 20-day volatility
 * @param {string} indicators.weekly_trend - Weekly trend direction
 * @returns {Object} { regime, isHighVolatility, weeklyTrend, volatility }
 */
function assessMarketCondition(indicators) {
  if (!indicators.ma_200 || !indicators.ma_50) {
    return { regime: 'neutral', isHighVolatility: false, weeklyTrend: 'neutral', volatility: null };
  }

  const currentPrice = indicators.adjusted_close;
  let marketRegime = 'neutral';

  if (currentPrice > indicators.ma_200 && indicators.ma_50 > indicators.ma_200) {
    marketRegime = 'bull';
  } else if (currentPrice < indicators.ma_200 && indicators.ma_50 < indicators.ma_200) {
    marketRegime = 'bear';
  }

  const isHighVolatility = indicators.volatility_20 && indicators.volatility_20 > 0.40;

  return {
    regime: marketRegime,
    isHighVolatility: isHighVolatility,
    weeklyTrend: indicators.weekly_trend || 'neutral',
    volatility: indicators.volatility_20
  };
}

/**
 * Calculate buy-and-hold strategy returns for comparison
 * Works for both long and short strategies
 *
 * @param {Array<Object>} prices - Array of price objects with adjusted_close
 * @param {number} initialCapital - Initial investment amount
 * @param {number|null} avgCapitalForComparison - Optional average capital for fair comparison
 * @returns {Object} { totalReturn, returnPercent, finalValue, shares }
 */
function calculateBuyAndHold(prices, initialCapital, avgCapitalForComparison = null) {
  const startPrice = prices[0].adjusted_close;
  const endPrice = prices[prices.length - 1].adjusted_close;
  const shares = initialCapital / startPrice;
  const finalValue = shares * endPrice;
  const totalReturn = finalValue - initialCapital;

  // Use average capital for comparison if provided, otherwise use initial capital
  const capitalForComparison = avgCapitalForComparison || initialCapital;
  const returnPercent = (totalReturn / capitalForComparison) * 100;

  return {
    totalReturn,
    returnPercent,
    finalValue,
    shares
  };
}

/**
 * Calculate short-and-hold strategy returns for comparison
 * Mirrors buy-and-hold logic but for short positions
 *
 * @param {Array<Object>} prices - Array of price objects with adjusted_close
 * @param {number} initialCapital - Initial investment amount
 * @param {number|null} avgCapitalForComparison - Optional average capital for fair comparison
 * @returns {Object} { totalReturn, returnPercent, finalValue, shares }
 */
function calculateShortAndHold(prices, initialCapital, avgCapitalForComparison = null) {
  const startPrice = prices[0].adjusted_close;
  const endPrice = prices[prices.length - 1].adjusted_close;
  const shares = initialCapital / startPrice;

  // For short selling: profit when price goes down
  const finalValue = initialCapital + (shares * (startPrice - endPrice));
  const totalReturn = finalValue - initialCapital;

  // Use average capital for comparison if provided
  const capitalForComparison = avgCapitalForComparison || initialCapital;
  const returnPercent = (totalReturn / capitalForComparison) * 100;

  return {
    totalReturn,
    returnPercent,
    finalValue,
    shares
  };
}

/**
 * Calculate Sharpe Ratio for risk-adjusted returns
 *
 * @param {Array<number>} dailyReturns - Array of daily return percentages
 * @param {number} riskFreeRate - Annual risk-free rate (default: 2%)
 * @returns {number} Sharpe ratio
 */
function calculateSharpeRatio(dailyReturns, riskFreeRate = 0.02) {
  if (dailyReturns.length === 0) return 0;

  // Calculate average daily return
  const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

  // Calculate standard deviation
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  // Annualize (assuming 252 trading days)
  const annualizedReturn = avgReturn * 252;
  const annualizedStdDev = stdDev * Math.sqrt(252);

  // Sharpe Ratio = (Return - Risk Free Rate) / Std Dev
  return (annualizedReturn - riskFreeRate) / annualizedStdDev;
}

/**
 * Calculate win rate from transactions
 *
 * @param {Array<Object>} transactions - Array of transaction objects
 * @param {string} profitKey - Key name for profit field (e.g., 'profit' or 'profitAmount')
 * @returns {Object} { winRate, wins, losses, total }
 */
function calculateWinRate(transactions, profitKey = 'profit') {
  const profitableTransactions = transactions.filter(t => t[profitKey] && t[profitKey] > 0);
  const total = transactions.filter(t => t[profitKey] !== undefined).length;

  return {
    winRate: total > 0 ? (profitableTransactions.length / total) * 100 : 0,
    wins: profitableTransactions.length,
    losses: total - profitableTransactions.length,
    total
  };
}

/**
 * Validate backtest parameters
 * Common validation logic for both strategies
 *
 * @param {Object} params - Backtest parameters
 * @throws {Error} If validation fails
 */
function validateBacktestParameters(params) {
  if (!params.symbol || typeof params.symbol !== 'string') {
    throw new Error('Invalid symbol: must be a non-empty string');
  }

  if (!params.startDate || !params.endDate) {
    throw new Error('Invalid date range: startDate and endDate are required');
  }

  if (new Date(params.startDate) >= new Date(params.endDate)) {
    throw new Error('Invalid date range: startDate must be before endDate');
  }

  if (!params.lotSizeUsd || params.lotSizeUsd <= 0) {
    throw new Error('Invalid lotSizeUsd: must be a positive number');
  }

  if (params.gridIntervalPercent !== undefined && (params.gridIntervalPercent <= 0 || params.gridIntervalPercent > 1)) {
    throw new Error('Invalid gridIntervalPercent: must be between 0 and 1');
  }
}

module.exports = {
  calculatePortfolioDrawdown,
  assessMarketCondition,
  calculateBuyAndHold,
  calculateShortAndHold,
  calculateSharpeRatio,
  calculateWinRate,
  validateBacktestParameters
};
