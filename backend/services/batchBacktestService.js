const { runDCABacktest } = require('./dcaBacktestService');

/**
 * Batch Backtest Service
 * Runs multiple DCA backtests with different parameter combinations
 * and generates comparison reports
 */

/**
 * Generate all parameter combinations for backtesting
 * @param {Object} paramRanges - Parameter ranges to test
 * @returns {Array} Array of parameter combinations
 */
function generateParameterCombinations(paramRanges) {
  const {
    symbols = ['TSLA'],
    profitRequirement = [0.05],
    gridIntervalPercent = [0.1],
    trailingBuyActivationPercent = [0.1],
    trailingBuyReboundPercent = [0.05],
    trailingSellActivationPercent = [0.2],
    trailingSellPullbackPercent = [0.1],
    // Fixed parameters
    startDate = '2021-09-01',
    endDate = '2025-09-01',
    lotSizeUsd = 10000,
    maxLots = 10,
    maxLotsToSell = 1
  } = paramRanges;

  const combinations = [];

  for (const symbol of symbols) {
    for (const profit of profitRequirement) {
      for (const grid of gridIntervalPercent) {
        for (const buyActivation of trailingBuyActivationPercent) {
          for (const buyRebound of trailingBuyReboundPercent) {
            for (const sellActivation of trailingSellActivationPercent) {
              for (const sellPullback of trailingSellPullbackPercent) {
                combinations.push({
                  symbol,
                  startDate,
                  endDate,
                  lotSizeUsd,
                  maxLots,
                  maxLotsToSell,
                  profitRequirement: profit,
                  gridIntervalPercent: grid,
                  trailingBuyActivationPercent: buyActivation,
                  trailingBuyReboundPercent: buyRebound,
                  trailingSellActivationPercent: sellActivation,
                  trailingSellPullbackPercent: sellPullback
                });
              }
            }
          }
        }
      }
    }
  }

  return combinations;
}

/**
 * Calculate buy and hold performance for comparison
 * @param {Array} priceData - Historical price data
 * @param {number} totalCapital - Total capital available
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @returns {Object} Buy and hold performance metrics
 */
function calculateBuyAndHoldPerformance(priceData, totalCapital, startDate, endDate) {
  const startPrice = priceData.find(p => p.date >= startDate)?.adjusted_close;
  const endPrice = priceData.find(p => p.date >= endDate)?.adjusted_close ||
                   priceData[priceData.length - 1]?.adjusted_close;

  if (!startPrice || !endPrice) return null;

  const shares = totalCapital / startPrice;
  const finalValue = shares * endPrice;
  const totalReturn = (finalValue - totalCapital) / totalCapital;

  const startPriceDate = new Date(startDate);
  const endPriceDate = new Date(endDate);
  const daysHeld = Math.max(1, (endPriceDate - startPriceDate) / (1000 * 60 * 60 * 24));
  const annualizedReturn = Math.pow(1 + totalReturn, 365 / daysHeld) - 1;

  return {
    strategy: 'Buy and Hold',
    totalReturn,
    annualizedReturn,
    finalValue,
    totalTrades: 1,
    capitalUtilization: 1.0,
    maxDrawdown: 0, // Would need price data to calculate actual drawdown
    startPrice,
    endPrice,
    sharesHeld: shares
  };
}

/**
 * Run batch backtests with multiple parameter combinations
 * @param {Object} options - Batch backtest options
 * @param {Function} progressCallback - Optional progress callback function
 * @returns {Promise<Object>} Batch backtest results
 */
async function runBatchBacktest(options, progressCallback = null) {
  const {
    parameterRanges,
    includeComparison = true,
    sortBy = 'annualizedReturn' // 'totalReturn', 'annualizedReturn', 'winRate'
  } = options;

  console.log('🚀 Starting batch backtest...');

  // Generate all parameter combinations
  const combinations = generateParameterCombinations(parameterRanges);
  console.log(`📊 Generated ${combinations.length} parameter combinations`);

  const results = [];
  const errors = [];

  // Run backtest for each combination
  for (let i = 0; i < combinations.length; i++) {
    const params = combinations[i];

    try {
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: combinations.length,
          currentParams: params,
          symbol: params.symbol
        });
      }

      console.log(`🔄 Running backtest ${i + 1}/${combinations.length}: ${params.symbol} - Profit: ${(params.profitRequirement * 100).toFixed(1)}%, Grid: ${(params.gridIntervalPercent * 100).toFixed(1)}%`);

      const result = await runDCABacktest({
        ...params,
        verbose: false // Don't log individual backtest details
      });

      // DEBUG: Log the raw result to see what we're getting
      console.log(`🐛 Raw result for ${params.symbol}:`, {
        totalReturnPercent: result.totalReturnPercent,
        annualizedReturnPercent: result.annualizedReturnPercent,
        totalTrades: result.totalTrades,
        winRate: result.winRate,
        maxDrawdownPercent: result.maxDrawdownPercent
      });

      // Add parameter info to result
      result.parameters = params;
      result.testId = i + 1;

      // Calculate return percentages from actual PNL and exposure
      const maxExposure = result.maxCapitalDeployed || (result.parameters.maxLots * result.parameters.lotSizeUsd);
      const actualTotalReturnPercent = maxExposure > 0 ? (result.totalPNL / maxExposure) * 100 : 0;

      // Use the annualized return from the DCA service calculation (tradeAnalysis.averageAnnualizedReturnPercent)
      const tradeAnalysisAnnualized = result.tradeAnalysis?.averageAnnualizedReturnPercent;
      const originalAnnualized = result.annualizedReturnPercent;
      let actualAnnualizedReturnPercent = tradeAnalysisAnnualized || originalAnnualized || 0;

      // Cap extreme values to prevent unrealistic returns
      if (Math.abs(actualAnnualizedReturnPercent) > 1000) {
        console.log(`⚠️ Capping extreme annualized return: ${actualAnnualizedReturnPercent}% -> 1000%`);
        actualAnnualizedReturnPercent = actualAnnualizedReturnPercent > 0 ? 1000 : -1000;
      }

      // DEBUG: Log annualized return calculation (but limit output)
      if (i < 3) { // Only log first 3 results to avoid spam
        console.log(`🐛 Annualized Return Debug for ${params.symbol}:`);
        console.log(`  - tradeAnalysis.averageAnnualizedReturnPercent: ${tradeAnalysisAnnualized}`);
        console.log(`  - original annualizedReturnPercent: ${originalAnnualized}`);
        console.log(`  - final actualAnnualizedReturnPercent: ${actualAnnualizedReturnPercent}`);
      }

      // Calculate total trades from transaction log
      const sellTransactions = result.enhancedTransactions ?
        result.enhancedTransactions.filter(t => t.type === 'SELL').length : 0;
      const buyTransactions = result.enhancedTransactions ?
        result.enhancedTransactions.filter(t => t.type === 'BUY' || t.type.includes('BUY')).length : 0;

      // Calculate win rate from profitable sell transactions
      let profitableTrades = 0;
      if (result.enhancedTransactions && sellTransactions > 0) {
        profitableTrades = result.enhancedTransactions
          .filter(t => t.type === 'SELL' && (t.realizedPNLFromTrade || 0) > 0).length;
      }
      const calculatedWinRate = sellTransactions > 0 ? (profitableTrades / sellTransactions) * 100 : 0;

      // Calculate average profit per trade
      const avgProfitPerTrade = sellTransactions > 0 ? result.realizedPNL / sellTransactions : 0;

      // Add summary property with the correct mapping for frontend compatibility
      result.summary = {
        totalReturn: actualTotalReturnPercent / 100, // Convert percentage to decimal
        annualizedReturn: actualAnnualizedReturnPercent / 100, // Convert percentage to decimal
        totalReturnPercent: actualTotalReturnPercent,
        annualizedReturnPercent: actualAnnualizedReturnPercent,
        winRate: calculatedWinRate / 100, // Convert percentage to decimal for display
        totalTrades: sellTransactions,
        avgProfitPerTrade: avgProfitPerTrade,
        maxDrawdownPercent: (result.maxDrawdownPercent || 0) / 100, // Convert to decimal for display
        capitalUtilizationRate: result.avgCapitalDeployed ? result.avgCapitalDeployed / maxExposure : 0
      };

      // DEBUG: Log the created summary (only first 3)
      if (i < 3) {
        console.log(`🐛 Created summary for ${params.symbol}:`, result.summary);
      }

      // Remove large data to prevent JSON serialization issues
      delete result.transactionLog; // This can be very large
      delete result.questionableEvents; // Usually not needed for batch results

      results.push(result);

    } catch (error) {
      console.error(`❌ Error in backtest ${i + 1} (${params.symbol}):`, error.message);
      errors.push({
        testId: i + 1,
        parameters: params,
        error: error.message
      });
    }
  }

  console.log(`✅ Completed ${results.length} successful backtests, ${errors.length} errors`);

  // Sort results by specified metric
  results.sort((a, b) => {
    // Add null checks to prevent undefined property access
    const aValue = a.summary || {};
    const bValue = b.summary || {};

    if (sortBy === 'totalReturn') {
      return (bValue.totalReturn || 0) - (aValue.totalReturn || 0);
    }
    if (sortBy === 'annualizedReturn') {
      return (bValue.annualizedReturn || 0) - (aValue.annualizedReturn || 0);
    }
    if (sortBy === 'winRate') {
      return (bValue.winRate || 0) - (aValue.winRate || 0);
    }
    return (bValue.annualizedReturn || 0) - (aValue.annualizedReturn || 0); // default
  });

  // Generate summary statistics
  const summary = generateBatchSummary(results, parameterRanges);

  return {
    summary,
    results,
    errors,
    totalCombinations: combinations.length,
    successfulRuns: results.length,
    failedRuns: errors.length,
    sortedBy: sortBy
  };
}

/**
 * Generate summary statistics from batch results
 * @param {Array} results - Array of backtest results
 * @param {Object} parameterRanges - Original parameter ranges
 * @returns {Object} Summary statistics
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

module.exports = {
  runBatchBacktest,
  generateParameterCombinations,
  calculateBuyAndHoldPerformance,
  generateBatchSummary
};