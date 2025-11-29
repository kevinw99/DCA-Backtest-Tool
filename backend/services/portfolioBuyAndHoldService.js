/**
 * Portfolio Buy & Hold Service
 *
 * Calculates a passive Buy & Hold investment strategy for portfolio comparison.
 * Allocates equal capital to each stock at the start date and holds until end date.
 * Provides comprehensive comparison metrics against active DCA strategy.
 */

/**
 * Calculate maximum drawdown from daily values
 * @param {Array} dailyValues - Array of {date, value} objects
 * @returns {Object} - {maxDrawdown, maxDrawdownPercent, duration}
 */
function calculateMaxDrawdownFromValues(dailyValues) {
  if (!dailyValues || dailyValues.length === 0) {
    return { maxDrawdown: 0, maxDrawdownPercent: 0, duration: 0 };
  }

  let peak = dailyValues[0].portfolioValue || dailyValues[0].value || 0;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let maxDrawdownDuration = 0;
  let currentDrawdownStart = null;

  dailyValues.forEach((point, index) => {
    const value = point.portfolioValue || point.value || 0;

    if (value > peak) {
      peak = value;
      currentDrawdownStart = null;
    } else {
      const drawdown = peak - value;
      const drawdownPercent = (drawdown / peak) * 100;

      if (drawdownPercent > maxDrawdownPercent) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;

        // Calculate duration
        if (currentDrawdownStart === null) {
          currentDrawdownStart = index;
        }
        maxDrawdownDuration = index - currentDrawdownStart;
      }
    }
  });

  // Spec 60: Return positive values for max drawdown (represents magnitude of decline)
  // Negative convention is handled by metricsCalculator, but here we return positive for display
  return {
    maxDrawdown: maxDrawdown,
    maxDrawdownPercent: maxDrawdownPercent,
    duration: maxDrawdownDuration
  };
}

/**
 * Calculate Sharpe ratio from daily values
 * @param {Array} dailyValues - Array of {date, value} objects
 * @returns {Number} - Sharpe ratio
 */
function calculateSharpeRatioFromValues(dailyValues) {
  if (!dailyValues || dailyValues.length < 2) {
    return 0;
  }

  // Calculate daily returns
  const dailyReturns = [];
  for (let i = 1; i < dailyValues.length; i++) {
    const prevValue = dailyValues[i - 1].value;
    const currValue = dailyValues[i].value;
    if (prevValue > 0) {
      const dailyReturn = (currValue - prevValue) / prevValue;
      dailyReturns.push(dailyReturn);
    }
  }

  if (dailyReturns.length === 0) {
    return 0;
  }

  // Calculate mean and standard deviation
  const avgDailyReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);

  // Annualize (252 trading days)
  const annualizedReturn = avgDailyReturn * 252;
  const annualizedVolatility = stdDev * Math.sqrt(252);

  return annualizedVolatility > 0 ? annualizedReturn / annualizedVolatility : 0;
}

/**
 * Calculate Buy & Hold for a single stock
 * @param {String} symbol - Stock symbol
 * @param {Array|Map} prices - Price data array or Map(date -> data)
 * @param {Number} allocatedCapital - Capital allocated to this stock
 * @param {String} startDate - Start date (YYYY-MM-DD)
 * @param {String} endDate - End date (YYYY-MM-DD)
 * @returns {Object} - Buy & Hold position details
 */
function calculateStockBuyAndHold(symbol, prices, allocatedCapital, startDate, endDate) {
  // Convert Map to array if needed
  const pricesArray = prices instanceof Map ? Array.from(prices.values()) : prices;

  // Find start and end prices
  const startPrice = pricesArray.find(p => p.date >= startDate)?.adjusted_close;
  const endPriceData = pricesArray.find(p => p.date >= endDate);
  const endPrice = endPriceData ? endPriceData.adjusted_close : pricesArray[pricesArray.length - 1].adjusted_close;

  if (!startPrice || !endPrice) {
    console.warn(`Missing price data for ${symbol}: start=${startPrice}, end=${endPrice}`);
    return null;
  }

  // Calculate position (allow fractional shares)
  const sharesHeld = allocatedCapital / startPrice;
  const finalValue = sharesHeld * endPrice;
  const totalReturn = finalValue - allocatedCapital;
  const totalReturnPercent = (totalReturn / allocatedCapital) * 100;

  // Calculate CAGR
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const years = (endDateObj - startDateObj) / (365.25 * 24 * 60 * 60 * 1000);
  const cagr = years > 0 ? (Math.pow(finalValue / allocatedCapital, 1 / years) - 1) * 100 : 0;

  // Calculate daily values for this stock
  const dailyValues = pricesArray
    .filter(p => p.date >= startDate && p.date <= endDate)
    .map(p => ({
      date: p.date,
      price: p.adjusted_close,
      value: sharesHeld * p.adjusted_close,
      returnAmount: (sharesHeld * p.adjusted_close) - allocatedCapital,
      returnPercent: ((sharesHeld * p.adjusted_close) - allocatedCapital) / allocatedCapital * 100
    }));

  // Calculate max drawdown for this stock
  const { maxDrawdown, maxDrawdownPercent, duration } = calculateMaxDrawdownFromValues(dailyValues);

  // Calculate Sharpe ratio for this stock
  const sharpeRatio = calculateSharpeRatioFromValues(dailyValues);

  return {
    symbol,
    allocatedCapital,
    startDate,
    startPrice,
    sharesHeld,
    endDate,
    endPrice,
    finalValue,
    totalReturn,
    totalReturnPercent,
    cagr,
    maxDrawdown,
    maxDrawdownPercent,
    maxDrawdownDuration: duration,
    sharpeRatio,
    dailyValues
  };
}

/**
 * Generate portfolio-level time series for Buy & Hold
 * @param {Array} stockPositions - Array of stock Buy & Hold positions
 * @param {Map} priceDataMap - Map of symbol -> price Map or array
 * @param {Number} totalCapital - Total initial capital
 * @returns {Array} - Daily portfolio values
 */
function generateBuyAndHoldTimeSeries(stockPositions, priceDataMap, totalCapital) {
  // Get union of all dates
  const allDates = new Set();
  priceDataMap.forEach(prices => {
    const pricesArray = prices instanceof Map ? Array.from(prices.values()) : prices;
    pricesArray.forEach(p => allDates.add(p.date));
  });

  const sortedDates = Array.from(allDates).sort();

  // For each date, calculate total portfolio value
  const dailyValues = sortedDates.map(date => {
    let portfolioValue = 0;

    stockPositions.forEach(position => {
      if (!position) return;

      const prices = priceDataMap.get(position.symbol);
      const pricesArray = prices instanceof Map ? Array.from(prices.values()) : prices;
      // Find price on or before this date
      const relevantPrices = pricesArray.filter(p => p.date <= date);
      if (relevantPrices.length > 0) {
        const price = relevantPrices[relevantPrices.length - 1].adjusted_close;
        portfolioValue += position.sharesHeld * price;
      }
    });

    const totalReturn = portfolioValue - totalCapital;
    const returnPercent = (totalReturn / totalCapital) * 100;

    return {
      date,
      portfolioValue,
      totalReturn,
      returnPercent
    };
  });

  return dailyValues;
}

/**
 * Calculate portfolio-level metrics for Buy & Hold
 * @param {Array} dailyValues - Daily portfolio values
 * @param {Number} totalCapital - Initial capital
 * @param {String} startDate - Start date
 * @param {String} endDate - End date
 * @returns {Object} - Portfolio metrics
 */
function calculateBuyAndHoldMetrics(dailyValues, totalCapital, startDate, endDate) {
  if (!dailyValues || dailyValues.length === 0) {
    console.error('No daily values provided for Buy & Hold metrics calculation');
    return null;
  }

  const finalValue = dailyValues[dailyValues.length - 1].portfolioValue;
  const totalReturn = finalValue - totalCapital;
  const totalReturnPercent = (totalReturn / totalCapital) * 100;

  // Calculate CAGR
  const years = (new Date(endDate) - new Date(startDate)) / (365.25 * 24 * 60 * 60 * 1000);
  const cagr = years > 0 ? (Math.pow(finalValue / totalCapital, 1 / years) - 1) * 100 : 0;

  // Calculate max drawdown
  const { maxDrawdown, maxDrawdownPercent, duration } = calculateMaxDrawdownFromValues(dailyValues);

  // Calculate volatility and Sharpe ratio
  const dailyReturns = [];
  for (let i = 1; i < dailyValues.length; i++) {
    const prevValue = dailyValues[i - 1].portfolioValue;
    const currValue = dailyValues[i].portfolioValue;
    if (prevValue > 0) {
      const dailyReturn = (currValue - prevValue) / prevValue;
      dailyReturns.push(dailyReturn);
    }
  }

  let volatility = 0;
  let sharpeRatio = 0;
  let sortinoRatio = 0;

  if (dailyReturns.length > 0) {
    const avgDailyReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length;
    const stdDev = Math.sqrt(variance);
    volatility = stdDev * Math.sqrt(252); // Annualized

    const annualizedReturn = avgDailyReturn * 252;
    sharpeRatio = volatility > 0 ? annualizedReturn / volatility : 0;

    // Calculate Sortino ratio (downside deviation only)
    const downsideReturns = dailyReturns.filter(r => r < 0);
    if (downsideReturns.length > 0) {
      const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / dailyReturns.length;
      const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252);
      sortinoRatio = downsideDeviation > 0 ? annualizedReturn / downsideDeviation : 0;
    }
  }

  return {
    totalCapital,
    finalValue,
    totalReturn,
    totalReturnPercent,
    cagr,
    maxDrawdown,
    maxDrawdownPercent,
    maxDrawdownDuration: duration,
    volatility: volatility * 100,  // Convert to percentage to match DCA format
    sharpeRatio,
    sortinoRatio
  };
}

/**
 * Generate comparison metrics between DCA and Buy & Hold
 * @param {Object} dcaPortfolio - DCA portfolio results
 * @param {Object} buyAndHoldMetrics - Buy & Hold metrics
 * @param {Array} buyAndHoldStockPositions - Buy & Hold per-stock positions
 * @returns {Object} - Comparison results
 */
function generateComparisonMetrics(dcaPortfolio, buyAndHoldMetrics, buyAndHoldStockPositions) {
  const dcaSummary = dcaPortfolio.portfolioSummary || dcaPortfolio;

  if (!buyAndHoldMetrics) {
    console.error('Buy & Hold metrics not available for comparison');
    return null;
  }

  // Calculate outperformance
  const outperformanceAmount = dcaSummary.finalPortfolioValue - buyAndHoldMetrics.finalValue;
  const outperformancePercent = (outperformanceAmount / buyAndHoldMetrics.finalValue) * 100;

  // Metric-by-metric comparison
  const comparison = {
    totalReturn: {
      dca: dcaSummary.totalReturn,
      buyAndHold: buyAndHoldMetrics.totalReturn,
      difference: dcaSummary.totalReturn - buyAndHoldMetrics.totalReturn,
      advantage: dcaSummary.totalReturn >= buyAndHoldMetrics.totalReturn ? 'DCA' : 'BUY_AND_HOLD'
    },
    totalReturnPercent: {
      dca: dcaSummary.totalReturnPercent,
      buyAndHold: buyAndHoldMetrics.totalReturnPercent,
      difference: dcaSummary.totalReturnPercent - buyAndHoldMetrics.totalReturnPercent,
      advantage: dcaSummary.totalReturnPercent >= buyAndHoldMetrics.totalReturnPercent ? 'DCA' : 'BUY_AND_HOLD'
    },
    cagr: {
      dca: dcaSummary.cagr,
      buyAndHold: buyAndHoldMetrics.cagr,
      difference: dcaSummary.cagr - buyAndHoldMetrics.cagr,
      advantage: dcaSummary.cagr >= buyAndHoldMetrics.cagr ? 'DCA' : 'BUY_AND_HOLD'
    },
    maxDrawdown: {
      dca: dcaSummary.maxDrawdownPercent,
      buyAndHold: buyAndHoldMetrics.maxDrawdownPercent,
      difference: buyAndHoldMetrics.maxDrawdownPercent - dcaSummary.maxDrawdownPercent, // Better if smaller
      advantage: Math.abs(dcaSummary.maxDrawdownPercent) <= Math.abs(buyAndHoldMetrics.maxDrawdownPercent) ? 'DCA' : 'BUY_AND_HOLD'
    },
    sharpeRatio: {
      dca: dcaSummary.sharpeRatio,
      buyAndHold: buyAndHoldMetrics.sharpeRatio,
      difference: dcaSummary.sharpeRatio - buyAndHoldMetrics.sharpeRatio,
      advantage: dcaSummary.sharpeRatio >= buyAndHoldMetrics.sharpeRatio ? 'DCA' : 'BUY_AND_HOLD'
    },
    volatility: {
      dca: dcaSummary.volatility || 0,
      buyAndHold: buyAndHoldMetrics.volatility || 0,
      difference: buyAndHoldMetrics.volatility - (dcaSummary.volatility || 0), // Better if smaller
      advantage: (dcaSummary.volatility || 0) <= buyAndHoldMetrics.volatility ? 'DCA' : 'BUY_AND_HOLD'
    }
  };

  // Per-stock comparison
  const stockComparisons = dcaPortfolio.stockResults.map(dcaStock => {
    const bhStock = buyAndHoldStockPositions.find(s => s && s.symbol === dcaStock.symbol);
    if (!bhStock) return null;

    const dcaReturnPercent = dcaStock.maxCapitalDeployed > 0
      ? (dcaStock.totalPNL / dcaStock.maxCapitalDeployed) * 100
      : 0;

    const outperformance = dcaStock.totalPNL - bhStock.totalReturn;
    const outperformancePercent = bhStock.totalReturn !== 0
      ? (outperformance / Math.abs(bhStock.totalReturn)) * 100
      : 0;

    return {
      symbol: dcaStock.symbol,
      dcaReturn: dcaStock.totalPNL,
      dcaReturnPercent,
      buyAndHoldReturn: bhStock.totalReturn,
      buyAndHoldReturnPercent: bhStock.totalReturnPercent,
      outperformance,
      outperformancePercent
    };
  }).filter(Boolean);

  return {
    dcaFinalValue: dcaSummary.finalPortfolioValue,
    buyAndHoldFinalValue: buyAndHoldMetrics.finalValue,
    outperformanceAmount,
    outperformancePercent,
    comparison,
    stockComparisons
  };
}

/**
 * Main function: Calculate Buy & Hold strategy for portfolio comparison
 * @param {Map} priceDataMap - Map of symbol -> price array
 * @param {Object} config - Backtest configuration
 * @param {Object} portfolio - DCA portfolio state
 * @returns {Object} - Buy & Hold results and comparison
 */
function calculatePortfolioBuyAndHold(priceDataMap, config, portfolio) {
  try {
    console.log('Calculating Buy & Hold comparison...');

    // 1. Determine equal capital allocation
    const totalCapital = config.totalCapital;
    const symbols = Array.from(priceDataMap.keys());
    const numStocks = symbols.length;
    const capitalPerStock = totalCapital / numStocks;

    console.log(`Buy & Hold: ${numStocks} stocks, $${capitalPerStock.toFixed(2)} per stock`);

    // 2. Calculate per-stock B&H positions
    const stockPositions = symbols.map(symbol => {
      const prices = priceDataMap.get(symbol);
      return calculateStockBuyAndHold(
        symbol,
        prices,
        capitalPerStock,
        config.startDate,
        config.endDate
      );
    }).filter(Boolean); // Remove nulls from stocks with missing data

    if (stockPositions.length === 0) {
      console.error('No valid Buy & Hold positions calculated');
      return null;
    }

    // 3. Generate portfolio-level time series
    const dailyValues = generateBuyAndHoldTimeSeries(
      stockPositions,
      priceDataMap,
      totalCapital
    );

    // 4. Calculate portfolio-level metrics
    const metrics = calculateBuyAndHoldMetrics(
      dailyValues,
      totalCapital,
      config.startDate,
      config.endDate
    );

    if (!metrics) {
      console.error('Failed to calculate Buy & Hold metrics');
      return null;
    }

    console.log(`Buy & Hold Final Value: $${(metrics.finalValue || 0).toFixed(2)}, Return: ${(metrics.totalReturnPercent || 0).toFixed(2)}%`);

    // 5. Generate comparison with DCA results
    const comparison = generateComparisonMetrics(
      portfolio,
      metrics,
      stockPositions
    );

    return {
      buyAndHoldSummary: {
        ...metrics,
        numStocks,
        capitalPerStock,
        stockPositions,
        dailyValues
      },
      comparison
    };
  } catch (error) {
    console.error('Error calculating Buy & Hold:', error);
    return null;
  }
}

module.exports = {
  calculatePortfolioBuyAndHold,
  calculateStockBuyAndHold,
  generateBuyAndHoldTimeSeries,
  calculateBuyAndHoldMetrics,
  generateComparisonMetrics,
  calculateMaxDrawdownFromValues,
  calculateSharpeRatioFromValues
};
