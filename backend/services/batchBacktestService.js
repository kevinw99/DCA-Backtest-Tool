const { runDCABacktest } = require('./dcaBacktestService');
const { generateBatchSummary } = require('./shared/batchUtilities');
const sessionManager = require('../utils/sessionManager');
const sseHelpers = require('../utils/sseHelpers');
const database = require('../database');

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
async function generateParameterCombinations(paramRanges) {
  // Extract symbols from paramRanges without providing fallback
  const symbols = paramRanges.symbols;

  // Log the received symbols for debugging
  console.log('🔍 DEBUG: Received symbols from paramRanges:', symbols);
  console.log('🔍 DEBUG: Full paramRanges keys:', Object.keys(paramRanges));

  // If no symbols provided, throw an error instead of using default
  if (!symbols || symbols.length === 0) {
    throw new Error('No symbols provided for batch backtest. Please select at least one symbol.');
  }

  const {
    profitRequirement = [0.05],
    gridIntervalPercent = [0.1],
    trailingBuyActivationPercent = [0.1],
    trailingBuyReboundPercent = [0.05],
    trailingSellActivationPercent = [0.2],
    trailingSellPullbackPercent = [0.1],
    // Beta-related parameters
    coefficients = [1.0],
    enableBetaScaling = false,
    // Fixed parameters
    startDate = '2021-09-01',
    endDate = '2025-09-01',
    lotSizeUsd = 10000,
    maxLots = 10,
    maxLotsToSell = [1],
    // Dynamic grid and incremental parameters
    dynamicGridMultiplier = [1.0],
    enableDynamicGrid = true,
    normalizeToReference = true,
    enableConsecutiveIncrementalBuyGrid = false,
    enableConsecutiveIncrementalSellProfit = true
  } = paramRanges;

  console.log('🔍 DEBUG: Parameter combinations input:', {
    symbols,
    symbolsLength: symbols?.length,
    paramRanges: Object.keys(paramRanges)
  });

  const combinations = [];

  // Debug Beta scaling condition
  console.log('🔍 DEBUG: Beta scaling condition check:');
  console.log('   enableBetaScaling:', enableBetaScaling);
  console.log('   coefficients:', coefficients);
  console.log('   coefficients.length:', coefficients?.length);

  // If Beta scaling is enabled, generate combinations with coefficients
  if (enableBetaScaling && coefficients.length > 0) {
    console.log('✅ Using Beta scaling path');
    const parameterCorrelationService = require('./parameterCorrelationService');
    const betaDataService = require('./betaDataService');

    for (const symbol of symbols) {
      // Fetch real Beta for this symbol
      let beta;
      try {
        const betaData = await betaDataService.fetchBeta(symbol);
        beta = betaData.beta;
        console.log(`📊 Using Beta ${beta} for ${symbol} in batch testing`);
      } catch (error) {
        console.warn(`Failed to fetch Beta for ${symbol}, using default 1.0:`, error.message);
        beta = 1.0;
      }

      for (const coefficient of coefficients) {
        for (const lotsToSell of maxLotsToSell) {
          for (const profit of profitRequirement) {
            for (const grid of gridIntervalPercent) {
              for (const buyActivation of trailingBuyActivationPercent) {
                for (const buyRebound of trailingBuyReboundPercent) {
                  for (const sellActivation of trailingSellActivationPercent) {
                    for (const sellPullback of trailingSellPullbackPercent) {
                      for (const gridMult of dynamicGridMultiplier) {
                        try {
                          // Calculate Beta-adjusted parameters using parameterCorrelationService
                          const baseParams = {
                            profitRequirement: profit,
                            gridIntervalPercent: grid,
                            trailingBuyActivationPercent: buyActivation,
                            trailingBuyReboundPercent: buyRebound,
                            trailingSellActivationPercent: sellActivation,
                            trailingSellPullbackPercent: sellPullback
                          };

                          const betaResult = parameterCorrelationService.calculateBetaAdjustedParameters(
                            beta,
                            coefficient,
                            baseParams
                          );

                          combinations.push({
                            symbol,
                            startDate,
                            endDate,
                            lotSizeUsd,
                            maxLots,
                            maxLotsToSell: lotsToSell,
                            // Use Beta-adjusted parameters
                            profitRequirement: betaResult.adjustedParameters.profitRequirement,
                            gridIntervalPercent: betaResult.adjustedParameters.gridIntervalPercent,
                            trailingBuyActivationPercent: betaResult.adjustedParameters.trailingBuyActivationPercent,
                            trailingBuyReboundPercent: betaResult.adjustedParameters.trailingBuyReboundPercent,
                            trailingSellActivationPercent: betaResult.adjustedParameters.trailingSellActivationPercent,
                            trailingSellPullbackPercent: betaResult.adjustedParameters.trailingSellPullbackPercent,
                            dynamicGridMultiplier: gridMult,
                            // Include Beta, coefficient, and beta_factor information for display
                            beta: beta,
                            coefficient: coefficient,
                            betaFactor: betaResult.betaFactor,
                            enableBetaScaling: true,
                            enableDynamicGrid,
                            normalizeToReference,
                            enableConsecutiveIncrementalBuyGrid,
                            enableConsecutiveIncrementalSellProfit,
                            betaInfo: {
                              beta: betaResult.beta,
                              coefficient: betaResult.coefficient,
                              betaFactor: betaResult.betaFactor,
                              baseParameters: betaResult.userParameters,
                              adjustedParameters: betaResult.adjustedParameters,
                              warnings: betaResult.warnings,
                              isValid: betaResult.isValid
                            }
                          });
                        } catch (error) {
                          console.error(`Error calculating Beta parameters for Beta=${beta}, Coefficient=${coefficient}, Symbol=${symbol}:`, error);
                          // Skip this combination if Beta calculation fails
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  } else {
    console.log('❌ Using NON-Beta scaling path');
    // Original logic for non-Beta scaling
    for (const symbol of symbols) {
      for (const lotsToSell of maxLotsToSell) {
        for (const profit of profitRequirement) {
          for (const grid of gridIntervalPercent) {
            for (const buyActivation of trailingBuyActivationPercent) {
              for (const buyRebound of trailingBuyReboundPercent) {
                for (const sellActivation of trailingSellActivationPercent) {
                  for (const sellPullback of trailingSellPullbackPercent) {
                    for (const gridMult of dynamicGridMultiplier) {
                      combinations.push({
                        symbol,
                        startDate,
                        endDate,
                        lotSizeUsd,
                        maxLots,
                        maxLotsToSell: lotsToSell,
                        profitRequirement: profit,
                        gridIntervalPercent: grid,
                        trailingBuyActivationPercent: buyActivation,
                        trailingBuyReboundPercent: buyRebound,
                        trailingSellActivationPercent: sellActivation,
                        trailingSellPullbackPercent: sellPullback,
                        dynamicGridMultiplier: gridMult,
                        beta: 1.0,
                        coefficient: 1.0,
                        betaFactor: 1.0,
                        enableBetaScaling: false,
                        enableDynamicGrid,
                        normalizeToReference,
                        enableConsecutiveIncrementalBuyGrid,
                        enableConsecutiveIncrementalSellProfit
                      });
                    }
                  }
                }
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
async function runBatchBacktest(options, progressCallback = null, sessionId = null) {
  const {
    symbols,
    parameterRanges,
    enableBetaScaling,
    enableDynamicGrid,
    normalizeToReference,
    enableConsecutiveIncrementalBuyGrid,
    enableConsecutiveIncrementalSellProfit,
    includeComparison = true,
    sortBy = 'annualizedReturn' // 'totalReturn', 'annualizedReturn', 'winRate'
  } = options;

  console.log('🚀 Starting batch backtest...');

  // Merge top-level symbols and enableBetaScaling into parameterRanges for backward compatibility
  const mergedParameterRanges = {
    ...parameterRanges,
    symbols: symbols || parameterRanges.symbols, // Pass symbols from top-level to parameterRanges
    enableBetaScaling: enableBetaScaling ?? parameterRanges.enableBetaScaling,
    enableDynamicGrid: enableDynamicGrid ?? parameterRanges.enableDynamicGrid,
    normalizeToReference: normalizeToReference ?? parameterRanges.normalizeToReference,
    enableConsecutiveIncrementalBuyGrid: enableConsecutiveIncrementalBuyGrid ?? parameterRanges.enableConsecutiveIncrementalBuyGrid,
    enableConsecutiveIncrementalSellProfit: enableConsecutiveIncrementalSellProfit ?? parameterRanges.enableConsecutiveIncrementalSellProfit
  };

  console.log('🔍 DEBUG: Merged symbols into parameterRanges:', mergedParameterRanges.symbols);

  // Pre-validate stocks before generating combinations
  const validSymbols = [];
  const invalidSymbols = [];
  const stockValidationErrors = [];

  console.log('🔍 Pre-validating stocks...');
  for (const symbol of mergedParameterRanges.symbols) {
    try {
      let stock = await database.getStock(symbol);

      // If stock doesn't exist, create it and fetch data
      if (!stock) {
        console.log(`📡 Fetching data for new symbol: ${symbol}`);
        const stockDataService = require('./stockDataService');
        const stockId = await database.createStock(symbol);
        await stockDataService.updateStockData(stockId, symbol, {
          updatePrices: true,
          updateFundamentals: true,
          updateCorporateActions: true
        });
        await database.updateStockTimestamp(stockId);
        stock = await database.getStock(symbol);
      }

      // Verify we have price data - if not, fetch it
      let latestPriceDate = await database.getLastPriceDate(stock.id);
      if (!latestPriceDate) {
        console.log(`📡 Stock ${symbol} exists but has no price data. Fetching...`);
        const stockDataService = require('./stockDataService');
        await stockDataService.updateStockData(stock.id, symbol, {
          updatePrices: true,
          updateFundamentals: true,
          updateCorporateActions: true
        });
        await database.updateStockTimestamp(stock.id);

        // Verify again after fetch
        latestPriceDate = await database.getLastPriceDate(stock.id);
        if (!latestPriceDate) {
          throw new Error(`No price data available for ${symbol}`);
        }
      }

      validSymbols.push(symbol);
      console.log(`✅ ${symbol} validated (data until ${latestPriceDate})`);
    } catch (error) {
      invalidSymbols.push(symbol);
      stockValidationErrors.push({
        symbol,
        error: error.message
      });
      console.error(`❌ ${symbol} validation failed: ${error.message}`);
    }
  }

  console.log(`\n📊 Stock Validation Summary:`);
  console.log(`   Valid symbols: ${validSymbols.length} - ${validSymbols.join(', ')}`);
  if (invalidSymbols.length > 0) {
    console.log(`   Invalid symbols: ${invalidSymbols.length} - ${invalidSymbols.join(', ')}`);
  }

  // Update parameterRanges to only include valid symbols
  mergedParameterRanges.symbols = validSymbols;

  // If no valid symbols, send error event and return
  if (validSymbols.length === 0) {
    const errorResult = {
      results: [],
      errors: stockValidationErrors,
      invalidSymbols,
      validSymbols: [],
      stockValidationErrors,
      totalCombinations: 0,
      successfulRuns: 0,
      failedRuns: stockValidationErrors.length,
      sortedBy: sortBy,
      message: 'All symbols failed validation. No backtests were run.'
    };

    // Send completion event with error result if using SSE
    if (sessionId) {
      const connection = sessionManager.getConnection(sessionId);
      if (connection) {
        sseHelpers.sendSSE(connection, 'complete', {
          sessionId,
          data: errorResult,
          executionTimeMs: 0
        });
        sseHelpers.closeSSE(connection);
        sessionManager.removeConnection(sessionId);
      }
      sessionManager.completeSession(sessionId, errorResult);
    }

    return errorResult;
  }

  // Generate all parameter combinations (only for valid symbols)
  const combinations = await generateParameterCombinations(mergedParameterRanges);
  console.log(`📊 Generated ${combinations.length} parameter combinations for ${validSymbols.length} valid symbols`);

  const results = [];
  const errors = [...stockValidationErrors]; // Include stock validation errors in final error report

  // Initialize timing for progress calculation
  const startTime = Date.now();
  let bestResult = null;
  let lastProgressEmit = 0;
  const PROGRESS_THROTTLE_MS = 1500; // Emit progress at most every 1.5 seconds

  // Run backtest for each combination
  for (let i = 0; i < combinations.length; i++) {
    const params = combinations[i];

    try {
      // Calculate progress metrics
      const now = Date.now();
      const elapsedTime = now - startTime;
      const current = i + 1;
      const percentage = sseHelpers.calculatePercentage(current, combinations.length);
      const avgTimePerTest = sseHelpers.calculateAvgTime(elapsedTime, current);
      const estimatedTimeRemaining = sseHelpers.calculateETA(current, combinations.length, elapsedTime);

      // Emit SSE progress event (throttled)
      const shouldEmitProgress = sessionId && (now - lastProgressEmit > PROGRESS_THROTTLE_MS || i === 0 || i === combinations.length - 1);

      if (shouldEmitProgress) {
        const connection = sessionManager.getConnection(sessionId);
        if (connection) {
          sseHelpers.sendSSE(connection, 'progress', {
            sessionId,
            current,
            total: combinations.length,
            percentage,
            currentSymbol: params.symbol,
            currentBeta: params.beta,
            currentCoefficient: params.coefficient,
            estimatedTimeRemaining,
            elapsedTime: Math.round(elapsedTime / 1000), // Convert to seconds
            avgTimePerTest,
            successfulTests: results.length,
            failedTests: errors.length,
            bestSoFar: bestResult ? {
              symbol: bestResult.parameters?.symbol,
              annualizedReturn: bestResult.summary?.annualizedReturn || 0,
              totalReturn: bestResult.summary?.totalReturn || 0
            } : null
          });

          lastProgressEmit = now;

          // Update session progress
          sessionManager.updateProgress(sessionId, {
            current,
            total: combinations.length,
            percentage,
            elapsedTime,
            estimatedTimeRemaining,
            avgTimePerTest,
            successfulTests: results.length,
            failedTests: errors.length
          });
        }
      }

      // Legacy progress callback support
      if (progressCallback) {
        progressCallback({
          current,
          total: combinations.length,
          currentParams: params,
          symbol: params.symbol
        });
      }

      const betaInfo = params.enableBetaScaling ?
        ` Beta: ${params.beta}, Coeff: ${params.coefficient}, β-factor: ${params.betaFactor?.toFixed(2) || 'N/A'}` :
        '';
      console.log(`🔄 Running backtest ${current}/${combinations.length}: ${params.symbol}${betaInfo} - Profit: ${(params.profitRequirement).toFixed(1)}%, Grid: ${(params.gridIntervalPercent).toFixed(1)}%`);

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

      // Use the original totalReturnPercent from DCA service (already correctly calculated)
      const actualTotalReturnPercent = result.totalReturnPercent || 0;

      // DEBUG: Log total return calculation (only first result)
      if (i === 0) {
        console.log(`🐛 Total Return Debug for ${params.symbol}:`);
        console.log(`  - result.totalPNL: ${result.totalPNL}`);
        console.log(`  - result.totalCost: ${result.totalCost}`);
        console.log(`  - result.totalReturnPercent (original): ${result.totalReturnPercent}%`);
        console.log(`  - using actualTotalReturnPercent: ${actualTotalReturnPercent}%`);
      }

      // Use the portfolio annualized return (CAGR) instead of trade average to match single backtest
      const tradeAnalysisAnnualized = result.tradeAnalysis?.averageAnnualizedReturnPercent;
      const originalAnnualized = result.annualizedReturnPercent;
      let actualAnnualizedReturnPercent = originalAnnualized || tradeAnalysisAnnualized || 0;

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
        capitalUtilizationRate: result.avgCapitalDeployed && result.totalCost ? result.avgCapitalDeployed / result.totalCost : 0,
        // Include capital deployment metrics
        totalPNL: result.totalPNL || 0,
        avgCapitalDeployed: result.avgCapitalDeployed || 0,
        maxCapitalDeployed: result.maxCapitalDeployed || 0,
        // Include CAGR metrics from performanceMetrics
        cagrOnMaxDeployed: result.performanceMetrics?.cagrOnMaxDeployed,
        cagrOnMaxDeployedPercent: result.performanceMetrics?.cagrOnMaxDeployedPercent,
        cagrOnAvgDeployed: result.performanceMetrics?.cagrOnAvgDeployed,
        cagrOnAvgDeployedPercent: result.performanceMetrics?.cagrOnAvgDeployedPercent,
        returnOnMaxDeployed: result.performanceMetrics?.returnOnMaxDeployed,
        returnOnMaxDeployedPercent: result.performanceMetrics?.returnOnMaxDeployedPercent,
        returnOnAvgDeployed: result.performanceMetrics?.returnOnAvgDeployed,
        returnOnAvgDeployedPercent: result.performanceMetrics?.returnOnAvgDeployedPercent,
        // Include risk-adjusted metrics
        sharpeRatio: result.performanceMetrics?.sharpeRatio,
        sortinoRatio: result.performanceMetrics?.sortinoRatio
      };

      // DEBUG: Log the created summary (only first 3)
      if (i < 3) {
        console.log(`🐛 Created summary for ${params.symbol}:`, result.summary);
      }

      // Remove large data to prevent JSON serialization issues
      delete result.transactionLog; // This can be very large
      delete result.questionableEvents; // Usually not needed for batch results

      results.push(result);

      // Track best result for progress updates
      if (!bestResult || (result.summary?.annualizedReturn || 0) > (bestResult.summary?.annualizedReturn || 0)) {
        bestResult = result;
      }

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

  const finalResults = {
    summary,
    results,
    errors,
    totalCombinations: combinations.length,
    successfulRuns: results.length,
    failedRuns: errors.length,
    sortedBy: sortBy,
    validSymbols: validSymbols,
    invalidSymbols: invalidSymbols.length > 0 ? invalidSymbols : undefined,
    stockValidationErrors: stockValidationErrors.length > 0 ? stockValidationErrors : undefined
  };

  // Emit completion event via SSE
  if (sessionId) {
    const connection = sessionManager.getConnection(sessionId);
    if (connection) {
      sseHelpers.sendSSE(connection, 'complete', {
        sessionId,
        data: finalResults,
        executionTimeMs: Date.now() - startTime
      });

      // Close the SSE connection after a brief delay to ensure message is received
      setTimeout(() => {
        sseHelpers.closeSSE(connection);
        sessionManager.removeConnection(sessionId);
      }, 1000);
    }

    // Mark session as completed
    sessionManager.completeSession(sessionId, finalResults);
  }

  return finalResults;
}

module.exports = {
  runBatchBacktest,
  generateParameterCombinations,
  calculateBuyAndHoldPerformance
};