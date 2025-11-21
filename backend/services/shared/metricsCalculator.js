/**
 * Unified Metrics Calculator
 * Single source of truth for all performance metric calculations
 *
 * Data Type Convention:
 * - All percentages stored as DECIMALS (0.5943 = 59.43%)
 * - Convert to percentage (*100) only for display
 * - All monetary values in USD
 * - All time periods in calendar days/years (not trading days)
 *
 * Spec 60: Metrics Calculation Standardization
 */

const TRADING_DAYS_PER_YEAR = 252;
const DAYS_PER_YEAR = 365.25;
const DEFAULT_RISK_FREE_RATE = 0.04; // 4% annual

/**
 * Calculate CAGR (Compound Annual Growth Rate)
 *
 * Formula: CAGR = (Final Value / Initial Value)^(1 / Years) - 1
 *
 * @param {number} finalValue - Final portfolio value
 * @param {number} initialValue - Initial portfolio value
 * @param {string|Date} startDate - Start date of period
 * @param {string|Date} endDate - End date of period
 * @returns {number} CAGR as decimal (0.6640 = 66.40%)
 *
 * @example
 * calculateCAGR(827777.85, 100000, '2021-09-01', '2025-10-26') // Returns 0.6640
 */
function calculateCAGR(finalValue, initialValue, startDate, endDate) {
  if (!finalValue || !initialValue || initialValue <= 0) return 0;
  if (finalValue <= 0) return -1; // Total loss

  const start = new Date(startDate);
  const end = new Date(endDate);
  const years = (end - start) / (1000 * 60 * 60 * 24 * DAYS_PER_YEAR);

  if (years <= 0) return 0;

  return Math.pow(finalValue / initialValue, 1 / years) - 1;
}

/**
 * Calculate CAGR from total return percentage
 *
 * Formula: CAGR = (1 + Total Return %)^(1 / Years) - 1
 *
 * @param {number} totalReturnPercent - Total return as percentage (727.78 for 727.78%)
 * @param {string|Date} startDate - Start date of period
 * @param {string|Date} endDate - End date of period
 * @returns {number} CAGR as decimal (0.6640 = 66.40%)
 */
function calculateCAGRFromReturn(totalReturnPercent, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const years = (end - start) / (1000 * 60 * 60 * 24 * DAYS_PER_YEAR);

  if (years <= 0) return 0;

  const finalValue = 1 + (totalReturnPercent / 100);
  if (finalValue <= 0) return -1;

  return Math.pow(finalValue, 1 / years) - 1;
}

/**
 * Calculate Maximum Drawdown
 *
 * Formula: Max Drawdown = (Trough - Peak) / Peak
 *
 * @param {number[]} dailyValues - Array of daily portfolio values
 * @returns {Object} { maxDrawdown, maxDrawdownPercent, avgDrawdownPercent }
 *         maxDrawdownPercent is NEGATIVE decimal (-0.3176 = -31.76%)
 *
 * @example
 * calculateMaxDrawdown([100000, 110000, 95000, 120000])
 * // Returns { maxDrawdown: -15000, maxDrawdownPercent: -0.1364, avgDrawdownPercent: -0.0454 }
 */
function calculateMaxDrawdown(dailyValues) {
  if (!dailyValues || dailyValues.length < 2) {
    return { maxDrawdown: 0, maxDrawdownPercent: 0, avgDrawdownPercent: 0 };
  }

  let peak = dailyValues[0];
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  const drawdownPercents = [];

  for (const value of dailyValues) {
    if (value > peak) {
      peak = value;
    }

    const drawdown = value - peak;
    const drawdownPct = peak > 0 ? drawdown / peak : 0;

    if (drawdownPct < 0) {
      drawdownPercents.push(drawdownPct);
    }

    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPercent = drawdownPct;
    }
  }

  const avgDrawdownPercent = drawdownPercents.length > 0
    ? drawdownPercents.reduce((a, b) => a + b, 0) / drawdownPercents.length
    : 0;

  return {
    maxDrawdown: maxDrawdown, // Negative USD value
    maxDrawdownPercent: maxDrawdownPercent, // Negative decimal (-0.3176)
    avgDrawdownPercent: avgDrawdownPercent // Negative decimal
  };
}

/**
 * Calculate daily returns from portfolio values
 *
 * @param {number[]} dailyValues - Array of daily portfolio values
 * @returns {number[]} Array of daily returns as decimals
 */
function calculateDailyReturns(dailyValues) {
  if (!dailyValues || dailyValues.length < 2) return [];

  const returns = [];
  for (let i = 1; i < dailyValues.length; i++) {
    if (dailyValues[i - 1] !== 0) {
      returns.push((dailyValues[i] - dailyValues[i - 1]) / dailyValues[i - 1]);
    }
  }
  return returns;
}

/**
 * Calculate annualized volatility (standard deviation)
 *
 * Formula: Volatility = StdDev(daily returns) * sqrt(252)
 *
 * @param {number[]} dailyReturns - Array of daily returns as decimals
 * @returns {number} Annualized volatility as decimal (0.3417 = 34.17%)
 */
function calculateVolatility(dailyReturns) {
  if (!dailyReturns || dailyReturns.length < 2) return 0;

  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (dailyReturns.length - 1);
  const stdDev = Math.sqrt(variance);

  return stdDev * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/**
 * Calculate downside deviation (for Sortino ratio)
 *
 * @param {number[]} dailyReturns - Array of daily returns as decimals
 * @param {number} mar - Minimum Acceptable Return (daily, default: risk-free rate / 252)
 * @returns {number} Annualized downside deviation as decimal
 */
function calculateDownsideDeviation(dailyReturns, mar = DEFAULT_RISK_FREE_RATE / TRADING_DAYS_PER_YEAR) {
  if (!dailyReturns || dailyReturns.length < 2) return 0;

  const downsideReturns = dailyReturns.filter(r => r < mar);
  if (downsideReturns.length === 0) return 0;

  const downsideMean = downsideReturns.reduce((a, b) => a + b, 0) / downsideReturns.length;
  const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - downsideMean, 2), 0) / downsideReturns.length;
  const downsideStdDev = Math.sqrt(downsideVariance);

  return downsideStdDev * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/**
 * Calculate Sharpe Ratio
 *
 * Formula: Sharpe = (CAGR - Risk Free Rate) / Volatility
 *
 * @param {number} cagr - CAGR as decimal (0.6640)
 * @param {number} volatility - Annualized volatility as decimal (0.5428)
 * @param {number} riskFreeRate - Risk-free rate as decimal (default 0.04)
 * @returns {number} Sharpe ratio (dimensionless)
 *
 * @example
 * calculateSharpeRatio(0.6640, 0.5428, 0.04) // Returns 1.150
 */
function calculateSharpeRatio(cagr, volatility, riskFreeRate = DEFAULT_RISK_FREE_RATE) {
  if (!volatility || volatility === 0) return 0;
  return (cagr - riskFreeRate) / volatility;
}

/**
 * Calculate Sharpe Ratio from daily returns (more accurate)
 *
 * @param {number[]} dailyReturns - Array of daily returns as decimals
 * @param {number} riskFreeRate - Annual risk-free rate as decimal (default 0.04)
 * @returns {number} Sharpe ratio (dimensionless)
 */
function calculateSharpeRatioFromReturns(dailyReturns, riskFreeRate = DEFAULT_RISK_FREE_RATE) {
  if (!dailyReturns || dailyReturns.length < 2) return 0;

  const dailyRiskFreeRate = riskFreeRate / TRADING_DAYS_PER_YEAR;
  const excessReturns = dailyReturns.map(r => r - dailyRiskFreeRate);

  const avgExcessReturn = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;

  const variance = excessReturns.reduce((sum, r) => sum + Math.pow(r - avgExcessReturn, 2), 0) / (excessReturns.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  return (avgExcessReturn / stdDev) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/**
 * Calculate Sortino Ratio
 *
 * Formula: Sortino = (CAGR - MAR) / Downside Deviation
 *
 * @param {number} cagr - CAGR as decimal (0.6640)
 * @param {number} downsideDeviation - Annualized downside deviation as decimal
 * @param {number} mar - Minimum Acceptable Return as decimal (default 0.04)
 * @returns {number} Sortino ratio (dimensionless)
 */
function calculateSortinoRatio(cagr, downsideDeviation, mar = DEFAULT_RISK_FREE_RATE) {
  if (!downsideDeviation || downsideDeviation === 0) {
    return cagr > mar ? 999 : 0; // Infinite if no downside
  }
  return (cagr - mar) / downsideDeviation;
}

/**
 * Calculate Sortino Ratio from daily returns
 *
 * @param {number[]} dailyReturns - Array of daily returns as decimals
 * @param {number} riskFreeRate - Annual risk-free rate as decimal (default 0.04)
 * @returns {number} Sortino ratio (dimensionless)
 */
function calculateSortinoRatioFromReturns(dailyReturns, riskFreeRate = DEFAULT_RISK_FREE_RATE) {
  if (!dailyReturns || dailyReturns.length < 2) return 0;

  const dailyRiskFreeRate = riskFreeRate / TRADING_DAYS_PER_YEAR;
  const excessReturns = dailyReturns.map(r => r - dailyRiskFreeRate);
  const avgExcessReturn = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;

  const downsideReturns = excessReturns.filter(r => r < 0);

  if (downsideReturns.length === 0) {
    return avgExcessReturn > 0 ? 999 : 0;
  }

  const downsideMean = downsideReturns.reduce((a, b) => a + b, 0) / downsideReturns.length;
  const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - downsideMean, 2), 0) / downsideReturns.length;
  const downsideDeviation = Math.sqrt(downsideVariance);

  if (downsideDeviation === 0) return 0;

  return (avgExcessReturn / downsideDeviation) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/**
 * Calculate Calmar Ratio
 *
 * Formula: Calmar = CAGR / |Max Drawdown|
 *
 * @param {number} cagr - CAGR as decimal (0.6640)
 * @param {number} maxDrawdownPercent - Max drawdown as decimal (negative: -0.6634 or positive: 0.6634)
 * @returns {number} Calmar ratio (dimensionless)
 *
 * @example
 * calculateCalmarRatio(0.6640, -0.6634) // Returns 1.001
 * calculateCalmarRatio(0.6640, 0.6634)  // Returns 1.001 (handles both signs)
 */
function calculateCalmarRatio(cagr, maxDrawdownPercent) {
  const absDrawdown = Math.abs(maxDrawdownPercent);
  if (!absDrawdown || absDrawdown === 0) {
    return cagr > 0 ? 999 : 0;
  }
  return cagr / absDrawdown;
}

/**
 * Calculate all risk-adjusted metrics at once
 *
 * @param {Object} params - Parameters object
 * @param {number[]} params.dailyValues - Array of daily portfolio values
 * @param {number} params.finalValue - Final portfolio value
 * @param {number} params.initialValue - Initial portfolio value
 * @param {string|Date} params.startDate - Start date
 * @param {string|Date} params.endDate - End date
 * @param {number} [params.riskFreeRate=0.04] - Risk-free rate as decimal
 * @returns {Object} All calculated metrics
 */
function calculateAllMetrics({
  dailyValues,
  finalValue,
  initialValue,
  startDate,
  endDate,
  riskFreeRate = DEFAULT_RISK_FREE_RATE
}) {
  // CAGR
  const cagr = calculateCAGR(finalValue, initialValue, startDate, endDate);

  // Daily returns
  const dailyReturns = calculateDailyReturns(dailyValues);

  // Volatility
  const volatility = calculateVolatility(dailyReturns);

  // Drawdown
  const drawdownAnalysis = calculateMaxDrawdown(dailyValues);

  // Downside deviation
  const downsideDeviation = calculateDownsideDeviation(dailyReturns, riskFreeRate / TRADING_DAYS_PER_YEAR);

  // Risk-adjusted ratios
  const sharpeRatio = calculateSharpeRatioFromReturns(dailyReturns, riskFreeRate);
  const sortinoRatio = calculateSortinoRatioFromReturns(dailyReturns, riskFreeRate);
  const calmarRatio = calculateCalmarRatio(cagr, drawdownAnalysis.maxDrawdownPercent);

  return {
    // Return metrics
    cagr, // decimal (0.6640)
    cagrPercent: cagr * 100, // percentage (66.40)

    // Risk metrics
    volatility, // decimal (0.5428)
    volatilityPercent: volatility * 100, // percentage (54.28)
    maxDrawdown: drawdownAnalysis.maxDrawdown, // USD (negative)
    maxDrawdownPercent: drawdownAnalysis.maxDrawdownPercent, // decimal (negative, -0.6634)
    avgDrawdownPercent: drawdownAnalysis.avgDrawdownPercent, // decimal (negative)

    // Risk-adjusted metrics
    sharpeRatio,
    sortinoRatio,
    calmarRatio,

    // Additional
    downsideDeviation,
    dailyReturnsCount: dailyReturns.length
  };
}

module.exports = {
  // Constants
  TRADING_DAYS_PER_YEAR,
  DAYS_PER_YEAR,
  DEFAULT_RISK_FREE_RATE,

  // Return metrics
  calculateCAGR,
  calculateCAGRFromReturn,

  // Risk metrics
  calculateMaxDrawdown,
  calculateDailyReturns,
  calculateVolatility,
  calculateDownsideDeviation,

  // Risk-adjusted metrics
  calculateSharpeRatio,
  calculateSharpeRatioFromReturns,
  calculateSortinoRatio,
  calculateSortinoRatioFromReturns,
  calculateCalmarRatio,

  // All-in-one
  calculateAllMetrics
};
