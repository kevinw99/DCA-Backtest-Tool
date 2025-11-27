/**
 * Chart Data Processor Service
 *
 * Preprocesses portfolio chart data to ensure all charts share the same
 * date range and alignment for synchronized x-axis display.
 */

/**
 * Generates array of all trading days in a date range
 * Note: For simplicity, we extract from actual data rather than generating calendar dates
 */
function generateMasterDates(allTimeSeriesData) {
  const allDates = new Set();

  // Collect all unique dates from all time series
  allTimeSeriesData.forEach(timeSeries => {
    if (timeSeries && Array.isArray(timeSeries)) {
      timeSeries.forEach(dataPoint => {
        if (dataPoint.date) {
          allDates.add(dataPoint.date);
        }
      });
    }
  });

  // Sort dates chronologically
  return Array.from(allDates).sort();
}

/**
 * Aligns data to master date array
 * If data point doesn't exist for a date, fills with null or carries forward last known value
 */
function alignDataToDates(data, masterDates, carryForward = false) {
  if (!data || data.length === 0) {
    return masterDates.map(date => ({ date }));
  }

  const dataMap = new Map();
  data.forEach(point => {
    dataMap.set(point.date, point);
  });

  const aligned = [];
  let lastKnownValues = {};

  masterDates.forEach(date => {
    if (dataMap.has(date)) {
      const dataPoint = dataMap.get(date);
      aligned.push(dataPoint);

      // Update last known values for carry forward
      if (carryForward) {
        Object.keys(dataPoint).forEach(key => {
          if (key !== 'date' && dataPoint[key] !== null && dataPoint[key] !== undefined) {
            lastKnownValues[key] = dataPoint[key];
          }
        });
      }
    } else {
      // Create placeholder with either null or carried forward values
      const placeholder = { date };

      if (carryForward) {
        Object.keys(lastKnownValues).forEach(key => {
          placeholder[key] = lastKnownValues[key];
        });
      }

      aligned.push(placeholder);
    }
  });

  return aligned;
}

/**
 * Main preprocessing function for portfolio chart data
 * Returns unified data structure with aligned dates across all charts
 */
export function preprocessPortfolioChartData(portfolioData) {
  if (!portfolioData) {
    return {
      masterDates: [],
      dcaVsBuyAndHold: [],
      composition: [],
      normalizedPrices: [],
      capitalUtilization: []
    };
  }

  const {
    capitalUtilizationTimeSeries,
    portfolioCompositionTimeSeries,
    stockResults,
    buyAndHoldSummary,
    etfBenchmark  // Spec 67: ETF benchmark data
  } = portfolioData;

  // Generate master dates from all available time series
  const allTimeSeries = [
    capitalUtilizationTimeSeries,
    portfolioCompositionTimeSeries,
    buyAndHoldSummary?.dailyValues,
    etfBenchmark?.dailyValues  // Spec 67: Include ETF dates
  ].filter(Boolean);

  // Also include dates from stock price data
  if (stockResults && stockResults.length > 0) {
    stockResults.forEach(stock => {
      if (stock.priceData && stock.priceData.length > 0) {
        allTimeSeries.push(stock.priceData);
      }
    });
  }

  const masterDates = generateMasterDates(allTimeSeries);

  // Align DCA vs Buy & Hold data (Spec 67: includes ETF benchmark)
  const dcaVsBuyAndHold = alignDCAVsBuyAndHoldData(
    capitalUtilizationTimeSeries,
    buyAndHoldSummary?.dailyValues,
    etfBenchmark,  // Spec 67: Pass ETF benchmark
    masterDates
  );

  // Align composition data (already has all dates typically, but ensure consistency)
  const composition = alignDataToDates(portfolioCompositionTimeSeries, masterDates, true);

  // Align normalized price data with transactions
  const normalizedPrices = alignNormalizedPriceData(stockResults, masterDates);

  // Align capital utilization data
  const capitalUtilization = alignDataToDates(capitalUtilizationTimeSeries, masterDates, true);

  return {
    masterDates,
    dcaVsBuyAndHold,
    composition,
    normalizedPrices,
    capitalUtilization,
    etfBenchmark  // Spec 67: Return ETF benchmark for chart component
  };
}

/**
 * Aligns DCA, Buy & Hold, and ETF benchmark data together
 * Spec 67: Added ETF benchmark support
 */
function alignDCAVsBuyAndHoldData(dcaTimeSeries, buyAndHoldTimeSeries, etfBenchmark, masterDates) {
  if (!dcaTimeSeries || !buyAndHoldTimeSeries) {
    return masterDates.map(date => ({ date, dcaValue: null, buyAndHoldValue: null, etfValue: null }));
  }

  const dcaMap = new Map();
  const bhMap = new Map();
  const etfMap = new Map();

  dcaTimeSeries.forEach(point => {
    dcaMap.set(point.date, point.portfolioValue);
  });

  buyAndHoldTimeSeries.forEach(point => {
    bhMap.set(point.date, point.portfolioValue);
  });

  // Spec 67: Map ETF benchmark values
  if (etfBenchmark && etfBenchmark.dailyValues) {
    etfBenchmark.dailyValues.forEach(point => {
      etfMap.set(point.date, point.value);
    });
  }

  return masterDates.map(date => ({
    date,
    dcaValue: dcaMap.get(date) || null,
    buyAndHoldValue: bhMap.get(date) || null,
    etfValue: etfMap.get(date) || null  // Spec 67: ETF benchmark value
  }));
}

/**
 * Aligns normalized price data with transaction markers
 */
function alignNormalizedPriceData(stockResults, masterDates) {
  if (!stockResults || stockResults.length === 0) {
    return masterDates.map(date => ({ date }));
  }

  // Build normalized price data structure
  const dataMap = new Map();

  // Initialize all dates
  masterDates.forEach(date => {
    dataMap.set(date, { date });
  });

  // Process each stock's price data
  stockResults.forEach(stock => {
    if (!stock.priceData || stock.priceData.length === 0) return;

    const startPrice = stock.priceData[0].close;

    stock.priceData.forEach(pricePoint => {
      if (dataMap.has(pricePoint.date)) {
        const percentChange = ((pricePoint.close - startPrice) / startPrice) * 100;
        const existing = dataMap.get(pricePoint.date);
        existing[stock.symbol] = percentChange;
      }
    });

    // Add transaction markers
    if (stock.transactions) {
      stock.transactions.forEach(tx => {
        if (dataMap.has(tx.date)) {
          const existing = dataMap.get(tx.date);

          // Initialize transaction arrays if not exists
          if (!existing.transactions) {
            existing.transactions = [];
          }

          existing.transactions.push({
            symbol: stock.symbol,
            type: tx.type.toUpperCase(),
            price: tx.price,
            shares: tx.shares
          });
        }
      });
    }

    // Add rejected orders
    if (stock.rejectedOrders) {
      stock.rejectedOrders.forEach(order => {
        if (dataMap.has(order.date)) {
          const existing = dataMap.get(order.date);

          if (!existing.transactions) {
            existing.transactions = [];
          }

          existing.transactions.push({
            symbol: stock.symbol,
            type: 'REJECTED',
            price: order.price,
            reason: order.reason
          });
        }
      });
    }
  });

  return Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Extracts stock symbols from results
 */
export function getStockSymbols(stockResults) {
  if (!stockResults) return [];
  return stockResults
    .filter(stock => !stock.skipped)
    .map(stock => stock.symbol);
}

/**
 * Extracts stock colors for consistent coloring across charts
 */
export function getStockColors() {
  return [
    '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6610f2',
    '#fd7e14', '#20c997', '#e83e8c', '#6c757d', '#343a40', '#f8f9fa',
    '#495057', '#00d4ff', '#ff6b6b',
  ];
}

export default {
  preprocessPortfolioChartData,
  getStockSymbols,
  getStockColors
};
