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

/**
 * Calculate dynamic grid spacing based on square root of price
 *
 * This implements an adaptive grid system where:
 * - High prices get tighter % spacing (but larger $ gaps)
 * - Low prices get wider % spacing (but smaller $ gaps)
 *
 * Formula: gridDollar = sqrt(effectivePrice) × multiplier
 *
 * @param {number} currentPrice - Current market price
 * @param {number} referencePrice - Reference price for normalization (typically first trade price)
 * @param {number} multiplier - Grid width multiplier (default 1.0 for ~10% at $100)
 * @param {boolean} normalizeToReference - Whether to normalize price to $100 reference
 * @returns {number} Grid spacing as decimal percentage (e.g., 0.10 for 10%)
 *
 * @example
 * // Without normalization (absolute prices)
 * calculateDynamicGridSpacing(1000, 100, 1.0, false) // Returns ~0.032 (3.2% at $1000)
 * calculateDynamicGridSpacing(100, 100, 1.0, false)  // Returns ~0.10 (10% at $100)
 * calculateDynamicGridSpacing(25, 100, 1.0, false)   // Returns ~0.20 (20% at $25)
 *
 * @example
 * // With normalization (first trade = $100)
 * calculateDynamicGridSpacing(150, 150, 1.0, true) // Returns ~0.10 (first trade always ~10%)
 * calculateDynamicGridSpacing(135, 150, 1.0, true) // Returns ~0.097 (normalized to $90)
 */
function calculateDynamicGridSpacing(currentPrice, referencePrice, multiplier = 1.0, normalizeToReference = true) {
  // Input validation
  if (currentPrice <= 0) {
    throw new Error('currentPrice must be positive');
  }
  if (multiplier <= 0) {
    throw new Error('multiplier must be positive');
  }

  let effectivePrice = currentPrice;

  // Normalize price relative to reference if enabled
  if (normalizeToReference && referencePrice > 0) {
    // Scale current price so that referencePrice becomes $100
    // e.g., if first trade was $150 and current is $135:
    //   effectivePrice = (135 / 150) * 100 = 90
    effectivePrice = (currentPrice / referencePrice) * 100;
  }

  // Square root grid formula: gridDollar = sqrt(effectivePrice) × multiplier
  // At $100: sqrt(100) × 1.0 = 10, which is 10% of $100
  // At $400: sqrt(400) × 1.0 = 20, which is 5% of $400
  // At $25: sqrt(25) × 1.0 = 5, which is 20% of $25
  const gridDollar = Math.sqrt(effectivePrice) * multiplier;

  // Return as percentage of effective price
  const gridPercent = gridDollar / effectivePrice;

  return gridPercent;
}

module.exports = {
  calculatePortfolioDrawdown,
  assessMarketCondition,
  calculateBuyAndHold,
  calculateShortAndHold,
  calculateSharpeRatio,
  calculateWinRate,
  validateBacktestParameters,
  calculateDynamicGridSpacing
};
