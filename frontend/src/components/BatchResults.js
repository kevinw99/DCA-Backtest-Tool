import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Target, Trophy, Activity, DollarSign, BarChart3, Users, Percent } from 'lucide-react';
import URLParameterManager from '../utils/URLParameterManager';
import { formatCurrency, formatPercent, formatParameterPercent, formatPerformancePercent, formatNumber } from '../utils/formatters';

/**
 * FutureTradeCard Component (Spec 33)
 * Displays future trade information for a single stock in batch results
 */
const FutureTradeCard = ({ symbol, futureTrades, parameters, isSelected, onRunSingleBacktest }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!futureTrades) {
    return null; // Skip if no future trades data
  }

  const { currentPrice, currentPriceDate, avgCost, hasHoldings, buyActivation, sellActivation } = futureTrades;

  const handleToggle = () => setIsExpanded(!isExpanded);

  // Helper function to calculate distance between current price and target price
  const calculateDistance = (targetPrice) => {
    if (!targetPrice || !currentPrice) return null;
    const diff = targetPrice - currentPrice;
    const pct = (diff / currentPrice) * 100;
    return { diff, pct };
  };

  return (
    <div className={`future-trade-card ${isSelected ? 'selected' : ''}`}>
      <div
        className="card-header"
        onClick={handleToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); }}}
        role="button"
        tabIndex={0}
        style={{ cursor: 'pointer' }}
        aria-expanded={isExpanded}
      >
        <h4>{symbol}</h4>
        <div className="header-info">
          <span>Current: {formatCurrency(currentPrice)} as of {currentPriceDate}</span>
          <span className={hasHoldings ? 'has-holdings' : 'no-holdings'}>
            {hasHoldings ? `Holdings: ${formatCurrency(avgCost)} avg` : 'No Holdings'}
          </span>
          {onRunSingleBacktest && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent card collapse when clicking Run button
                onRunSingleBacktest(parameters);
              }}
              className="run-single-button"
              title="Run single backtest in new window"
              style={{ marginLeft: '10px' }}
            >
              📊 Run
            </button>
          )}
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="card-body">
          <div className="current-price-section">
            <div><span className="label">Current Price:</span> <span className="value">{formatCurrency(currentPrice)}</span></div>
            {hasHoldings && <div><span className="label">Avg Cost:</span> <span className="value">{formatCurrency(avgCost)}</span></div>}
          </div>
          <div className="trade-directions">
            {/* BUY Direction */}
            <div className={`buy-section ${buyActivation.isActive ? 'is-active' : 'is-pending'}`}>
              <h5>
                <TrendingDown size={16} />
                {buyActivation.description}
                <span className="status-badge">
                  {buyActivation.isActive ? 'ACTIVE TRACKING' : 'PENDING'}
                </span>
              </h5>
              {buyActivation.isActive ? (
                <>
                  <div className="active-stop">
                    <div>
                      <span className="label">Stop Price:</span>
                      <span className="value">{formatCurrency(buyActivation.stopPrice)}</span>
                      {(() => {
                        const dist = calculateDistance(buyActivation.stopPrice);
                        return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                      })()}
                    </div>
                    <div className="detail">
                      {formatParameterPercent(buyActivation.reboundPercent)} rebound
                      from {formatCurrency(buyActivation.lowestPrice)}
                    </div>
                  </div>
                  <div>
                    <span className="label">Lowest Price:</span>
                    <span className="value">{formatCurrency(buyActivation.lowestPrice)}</span>
                    {(() => {
                      const dist = calculateDistance(buyActivation.lowestPrice);
                      return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                    })()}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="label">Activates at:</span>
                    <span className="value">{formatCurrency(buyActivation.activationPrice)}</span>
                    {(() => {
                      const dist = calculateDistance(buyActivation.activationPrice);
                      return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                    })()}
                  </div>
                  <div className="detail">
                    {formatParameterPercent(buyActivation.activationPercent)} drop
                    from {formatCurrency(buyActivation.referencePrice)}
                  </div>
                  <div>
                    <span className="label">Reference Price:</span>
                    <span className="value">{formatCurrency(buyActivation.referencePrice)}</span>
                    {(() => {
                      const dist = calculateDistance(buyActivation.referencePrice);
                      return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                    })()}
                  </div>
                  <div>
                    <span className="label">Executes on:</span>
                    <span className="value">
                      {formatParameterPercent(buyActivation.reboundPercent)} rebound
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* SELL Direction */}
            {sellActivation ? (
              <div className={`sell-section ${sellActivation.isActive ? 'is-active' : 'is-pending'}`}>
                <h5>
                  <TrendingUp size={16} />
                  {sellActivation.description}
                  <span className="status-badge">
                    {sellActivation.isActive ? 'ACTIVE TRACKING' : 'PENDING'}
                  </span>
                </h5>
                {sellActivation.isActive ? (
                  <>
                    <div className="active-stop">
                      <div>
                        <span className="label">Stop Price:</span>
                        <span className="value">{formatCurrency(sellActivation.stopPrice)}</span>
                        {(() => {
                          const dist = calculateDistance(sellActivation.stopPrice);
                          return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                        })()}
                      </div>
                      <div className="detail">
                        {formatParameterPercent(sellActivation.pullbackPercent)} pullback
                        from {formatCurrency(sellActivation.lastUpdatePrice)}
                      </div>
                    </div>
                    {sellActivation.limitPrice && (
                      <div>
                        <span className="label">Limit Price:</span>
                        <span className="value">{formatCurrency(sellActivation.limitPrice)}</span>
                        {(() => {
                          const dist = calculateDistance(sellActivation.limitPrice);
                          return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                        })()}
                      </div>
                    )}
                    <div>
                      <span className="label">Last Update Price:</span>
                      <span className="value">{formatCurrency(sellActivation.lastUpdatePrice)}</span>
                      {(() => {
                        const dist = calculateDistance(sellActivation.lastUpdatePrice);
                        return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                      })()}
                    </div>
                    <div>
                      <span className="label">Profit target:</span>
                      <span className="value">{formatCurrency(sellActivation.profitRequirement)}</span>
                      {(() => {
                        const dist = calculateDistance(sellActivation.profitRequirement);
                        return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                      })()}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="label">Activates at:</span>
                      <span className="value">{formatCurrency(sellActivation.activationPrice)}</span>
                      {(() => {
                        const dist = calculateDistance(sellActivation.activationPrice);
                        return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↑'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                      })()}
                    </div>
                    <div className="detail">
                      {formatParameterPercent(sellActivation.activationPercent)} rise
                      from {formatCurrency(sellActivation.referencePrice)}
                    </div>
                    <div>
                      <span className="label">Reference Price:</span>
                      <span className="value">{formatCurrency(sellActivation.referencePrice)}</span>
                      {(() => {
                        const dist = calculateDistance(sellActivation.referencePrice);
                        return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                      })()}
                    </div>
                    <div>
                      <span className="label">Then trails:</span>
                      <span className="value">
                        {formatParameterPercent(sellActivation.pullbackPercent)} pullback
                      </span>
                    </div>
                    <div>
                      <span className="label">Profit target:</span>
                      <span className="value">{formatCurrency(sellActivation.profitRequirement)}</span>
                      {(() => {
                        const dist = calculateDistance(sellActivation.profitRequirement);
                        return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                      })()}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="sell-section disabled">
                <h5>Next SELL</h5>
                <p>No holdings to sell</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const BatchResults = ({ data }) => {
  const [selectedStock, setSelectedStock] = useState('all');
  const [selectedBeta, setSelectedBeta] = useState('all');

  // [Spec 33] Aggregate future trades by symbol (use best-performing config per stock)
  // MUST be before early return to satisfy React Hooks rules
  const futureTradesBySymbol = useMemo(() => {
    if (!data?.results || data.results.length === 0) return {};

    const grouped = {};
    data.results.forEach(result => {
      const symbol = result.parameters.symbol;
      // Only store the first (best) result per symbol since results are pre-sorted
      if (!grouped[symbol] && result.futureTrades) {
        grouped[symbol] = {
          futureTrades: result.futureTrades,
          parameters: result.parameters,
          rank: data.results.indexOf(result) + 1,
          totalReturn: result.summary?.totalReturn || 0
        };
      }
    });

    return grouped;
  }, [data?.results]);

  // DEBUG: Log the received data
  console.log('🐛 BatchResults received data:', data);
  if (data && data.results && data.results[0]) {
    console.log('🐛 First result details:', data.results[0]);
    console.log('🐛 First result summary:', data.results[0].summary);
  }

  // Detect strategy type from data
  const isShortStrategy = data?.strategy === 'SHORT_DCA' ||
    (data?.results && data.results.length > 0 &&
     (data.results[0].parameters?.strategyMode === 'short' ||
      data.results[0].parameters?.hasOwnProperty('maxShorts') ||
      data.results[0].parameters?.hasOwnProperty('trailingShortActivationPercent')));

  console.log('🎯 BatchResults Strategy Detection:', {
    dataStrategy: data?.strategy,
    firstResultStrategyMode: data?.results?.[0]?.parameters?.strategyMode,
    hasMaxShorts: data?.results?.[0]?.parameters?.hasOwnProperty('maxShorts'),
    hasShortActivation: data?.results?.[0]?.parameters?.hasOwnProperty('trailingShortActivationPercent'),
    finalDecision: isShortStrategy ? 'SHORT_DCA' : 'LONG_DCA'
  });

  // Function to run single backtest in new tab
  const runSingleBacktest = (parameters) => {
    // Detect current mode from URL to preserve user's choice
    const currentUrl = new URL(window.location.href);
    const currentMode = currentUrl.searchParams.get('mode') || 'single'; // Default to single if not specified
    console.log('🚀 =================================');
    console.log('🚀 USER CLICKED RUN BUTTON ON BATCH RESULT ROW');
    console.log('🚀 =================================');
    console.log(`🔄 Current page mode: ${currentMode} (will be preserved in new tab)`);
    console.log('📊 Raw parameters received from batch result:', JSON.stringify(parameters, null, 2));
    console.log('🔍 CRITICAL: endDate from batch result:', parameters.endDate);
    console.log('🔍 CRITICAL: startDate from batch result:', parameters.startDate);

    // Detect strategy type from batch data - use multiple indicators for robust detection
    const hasShortParams = parameters.hasOwnProperty('maxShorts') || parameters.hasOwnProperty('trailingShortActivationPercent');
    const hasLongParams = parameters.hasOwnProperty('maxLots') || parameters.hasOwnProperty('trailingBuyActivationPercent');
    const isShortStrategy = data?.strategy === 'SHORT_DCA' || parameters.strategyMode === 'short' || (hasShortParams && !hasLongParams);

    console.log('🎯 Strategy Detection Debug:');
    console.log(`  - data.strategy: ${data?.strategy}`);
    console.log(`  - parameters.strategyMode: ${parameters.strategyMode}`);
    console.log(`  - hasShortParams: ${hasShortParams} (maxShorts: ${!!parameters.maxShorts}, trailingShort: ${!!parameters.trailingShortActivationPercent})`);
    console.log(`  - hasLongParams: ${hasLongParams} (maxLots: ${!!parameters.maxLots}, trailingBuy: ${!!parameters.trailingBuyActivationPercent})`);
    console.log(`  - Final decision: ${isShortStrategy ? 'SHORT_DCA' : 'LONG_DCA'}`);

    console.log('📊 Parameter breakdown (backend decimal format):');
    console.log(`  📈 Symbol: ${parameters.symbol}`);
    console.log(`  📅 Date Range: ${parameters.startDate} to ${parameters.endDate}`);

    if (isShortStrategy) {
      console.log(`  💰 Investment: $${parameters.lotSizeUsd} per lot, max ${parameters.maxShorts} shorts, max ${parameters.maxShortsToCovers} covers per transaction`);
      console.log(`  🎯 Short Strategy Parameters (DECIMAL FORMAT FROM BACKEND):`);
      console.log(`     - Grid Interval: ${parameters.gridIntervalPercent} (${(parameters.gridIntervalPercent * 100).toFixed(1)}%)`);
      console.log(`     - Profit Requirement: ${parameters.profitRequirement} (${(parameters.profitRequirement * 100).toFixed(1)}%)`);
      console.log(`     - Trailing Short Activation: ${parameters.trailingShortActivationPercent} (${(parameters.trailingShortActivationPercent * 100).toFixed(1)}%)`);
      console.log(`     - Trailing Short Pullback: ${parameters.trailingShortPullbackPercent} (${(parameters.trailingShortPullbackPercent * 100).toFixed(1)}%)`);
      console.log(`     - Trailing Cover Activation: ${parameters.trailingCoverActivationPercent} (${(parameters.trailingCoverActivationPercent * 100).toFixed(1)}%)`);
      console.log(`     - Trailing Cover Rebound: ${parameters.trailingCoverReboundPercent} (${(parameters.trailingCoverReboundPercent * 100).toFixed(1)}%)`);
    } else {
      console.log(`  💰 Investment: $${parameters.lotSizeUsd} per lot, max ${parameters.maxLots} lots, max ${parameters.maxLotsToSell} sell per transaction`);
      console.log(`  🎯 Long Strategy Parameters (DECIMAL FORMAT FROM BACKEND):`);
      console.log(`     - Grid Interval: ${parameters.gridIntervalPercent} (${(parameters.gridIntervalPercent * 100).toFixed(1)}%)`);
      console.log(`     - Profit Requirement: ${parameters.profitRequirement} (${(parameters.profitRequirement * 100).toFixed(1)}%)`);
      console.log(`     - Trailing Buy Activation: ${parameters.trailingBuyActivationPercent} (${(parameters.trailingBuyActivationPercent * 100).toFixed(1)}%)`);
      console.log(`     - Trailing Buy Rebound: ${parameters.trailingBuyReboundPercent} (${(parameters.trailingBuyReboundPercent * 100).toFixed(1)}%)`);
      console.log(`     - Trailing Sell Activation: ${parameters.trailingSellActivationPercent} (${(parameters.trailingSellActivationPercent * 100).toFixed(1)}%)`);
      console.log(`     - Trailing Sell Pullback: ${parameters.trailingSellPullbackPercent} (${(parameters.trailingSellPullbackPercent * 100).toFixed(1)}%)`);
    }
    console.log('🌐 Current window location:', window.location.href);

    // Prepare parameters for URLParameterManager (keep decimal format - URLParameterManager will handle conversion)
    const urlParams = {
      mode: 'single', // Always single mode for individual batch result row
      strategyMode: isShortStrategy ? 'short' : 'long',
      symbol: parameters.symbol,
      startDate: parameters.startDate,
      endDate: parameters.endDate,
      lotSizeUsd: parameters.lotSizeUsd,
      // Keep backend decimal values as-is - URLParameterManager will convert to percentage for URL
      gridIntervalPercent: parameters.gridIntervalPercent,
      profitRequirement: parameters.profitRequirement,
      source: 'batch' // Mark that this came from a batch result
    };

    // Add strategy-specific parameters (keep decimal format - URLParameterManager will handle conversion)
    if (isShortStrategy) {
      Object.assign(urlParams, {
        maxShorts: parameters.maxShorts,
        maxShortsToCovers: parameters.maxShortsToCovers,
        trailingShortActivationPercent: parameters.trailingShortActivationPercent,
        trailingShortPullbackPercent: parameters.trailingShortPullbackPercent,
        trailingCoverActivationPercent: parameters.trailingCoverActivationPercent,
        trailingCoverReboundPercent: parameters.trailingCoverReboundPercent,
        hardStopLossPercent: parameters.hardStopLossPercent,
        portfolioStopLossPercent: parameters.portfolioStopLossPercent
      });
    } else {
      Object.assign(urlParams, {
        maxLots: parameters.maxLots,
        maxLotsToSell: parameters.maxLotsToSell,
        trailingBuyActivationPercent: parameters.trailingBuyActivationPercent,
        trailingBuyReboundPercent: parameters.trailingBuyReboundPercent,
        trailingSellActivationPercent: parameters.trailingSellActivationPercent,
        trailingSellPullbackPercent: parameters.trailingSellPullbackPercent
      });
    }

    // Add advanced parameters that affect the backtest algorithm
    // IMPORTANT: Use batchRequestParameters for boolean flags that should NOT vary per combination
    // These come from the original batch request, not from individual combination parameters
    const batchRequestParams = data.batchRequestParameters || {};

    console.log('🔍 Checking for boolean flags:', {
      batchRequestParams,
      parametersValues: {
        enableDynamicGrid: parameters.enableDynamicGrid,
        normalizeToReference: parameters.normalizeToReference,
        enableConsecutiveIncrementalBuyGrid: parameters.enableConsecutiveIncrementalBuyGrid,
        enableConsecutiveIncrementalSellProfit: parameters.enableConsecutiveIncrementalSellProfit,
        enableScenarioDetection: parameters.enableScenarioDetection,
        dynamicGridMultiplier: parameters.dynamicGridMultiplier,
        gridConsecutiveIncrement: parameters.gridConsecutiveIncrement
      }
    });

    // Use batch request parameters for boolean flags (non-varying parameters)
    // Fall back to combination parameters if batch request parameters are not available (backward compatibility)
    urlParams.enableDynamicGrid = batchRequestParams.enableDynamicGrid ?? parameters.enableDynamicGrid ?? true;
    urlParams.normalizeToReference = batchRequestParams.normalizeToReference ?? parameters.normalizeToReference ?? true;
    urlParams.enableConsecutiveIncrementalBuyGrid = batchRequestParams.enableConsecutiveIncrementalBuyGrid ?? parameters.enableConsecutiveIncrementalBuyGrid ?? false;
    urlParams.enableConsecutiveIncrementalSellProfit = batchRequestParams.enableConsecutiveIncrementalSellProfit ?? parameters.enableConsecutiveIncrementalSellProfit ?? true;
    urlParams.enableScenarioDetection = batchRequestParams.enableScenarioDetection ?? parameters.enableScenarioDetection ?? false;
    urlParams.gridConsecutiveIncrement = batchRequestParams.gridConsecutiveIncrement ?? parameters.gridConsecutiveIncrement;
    urlParams.trailingStopOrderType = batchRequestParams.trailingStopOrderType ?? parameters.trailingStopOrderType ?? 'limit';

    // Use combination parameters for varying values (these CAN differ per combination)
    if (parameters.dynamicGridMultiplier !== undefined) urlParams.dynamicGridMultiplier = parameters.dynamicGridMultiplier;

    // CRITICAL: Force beta parameters to prevent double-scaling
    // The parameters in batch results are ALREADY beta-scaled, so we must disable beta scaling
    // to prevent the single test from scaling them AGAIN (which would cause incorrect results)
    urlParams.beta = parameters.beta || 1;  // Include for display purposes
    urlParams.coefficient = parameters.coefficient || 1;  // Include for display purposes
    urlParams.enableBetaScaling = false;  // FORCE to false - parameters already scaled (this should ALWAYS be false)
    urlParams.isManualBetaOverride = false;  // Not relevant for batch results

    console.log('🔍 Final urlParams being passed to generateShareableURL:', urlParams);

    console.log(`🔄 PARAMETER CONVERSION (decimal → percentage for ${isShortStrategy ? 'SHORT' : 'LONG'} strategy URL):`);
    console.log(`  📊 Strategy Mode: ${urlParams.strategyMode}`);
    console.log(`  📊 Grid Interval: ${parameters.gridIntervalPercent} → ${urlParams.gridIntervalPercent}%`);
    console.log(`  📊 Profit Requirement: ${parameters.profitRequirement} → ${urlParams.profitRequirement}%`);

    // Generate URL using URLParameterManager
    const url = URLParameterManager.generateShareableURL(urlParams, 'single');
    console.log('🌐 Complete URL being opened in new tab (via URLParameterManager):', url);

    // Open new tab with single backtest page
    console.log('🐛 Calling window.open with _blank target...');
    const newWindow = window.open(url, '_blank');
    console.log('🐛 window.open returned:', newWindow ? 'success' : 'blocked/failed');
  };

  console.log('🐛 Checking data validity:');
  console.log('🐛   data exists?', !!data);
  console.log('🐛   data.results exists?', !!data?.results);
  console.log('🐛   typeof data:', typeof data);
  console.log('🐛   data keys:', data ? Object.keys(data) : 'N/A');

  if (!data || !data.results) {
    console.error('❌ BatchResults EARLY RETURN: No data or no results!');
    console.error('❌   data:', data);
    console.error('❌   data.results:', data?.results);
    return <div>No batch results available</div>;
  }

  const { summary, results, totalCombinations, successfulRuns, failedRuns, executionTimeMs } = data;

  // Get unique stocks and coefficient values from results
  const stocks = [...new Set(results.map(r => r.parameters.symbol))];
  const coefficients = [...new Set(results.map(r => r.parameters.coefficient || 1.0))].sort((a, b) => a - b);

  // Filter results by selected stock and coefficient, then limit based on view mode
  let filteredByFilters = results;

  if (selectedStock !== 'all') {
    filteredByFilters = filteredByFilters.filter(r => r.parameters.symbol === selectedStock);
  }

  if (selectedBeta !== 'all') {
    filteredByFilters = filteredByFilters.filter(r => (r.parameters.coefficient || 1.0) === parseFloat(selectedBeta));
  }

  // Single stock view: show top 10 results
  // Multiple stocks view: show top 5 per stock
  const filteredResults = selectedStock === 'all' && selectedBeta === 'all'
    ? getTopNPerStock(filteredByFilters, 5)
    : filteredByFilters.slice(0, 10);

  // Helper function to create a unique key for parameter configuration
  function getParameterKey(params) {
    const isShort = params.strategyMode === 'short' || params.hasOwnProperty('maxShorts');

    if (isShort) {
      return `${params.profitRequirement}_${params.gridIntervalPercent}_${params.trailingShortActivationPercent}_${params.trailingShortPullbackPercent}_${params.trailingCoverActivationPercent}_${params.trailingCoverReboundPercent}`;
    } else {
      return `${params.profitRequirement}_${params.gridIntervalPercent}_${params.trailingBuyActivationPercent}_${params.trailingBuyReboundPercent}_${params.trailingSellActivationPercent}_${params.trailingSellPullbackPercent}`;
    }
  }

  // Helper function to get top N results per stock (sorted by Total Return %)
  function getTopNPerStock(results, n) {
    const resultsByStock = {};

    // Group results by stock symbol
    results.forEach(result => {
      const symbol = result.parameters.symbol;
      if (!resultsByStock[symbol]) {
        resultsByStock[symbol] = [];
      }
      resultsByStock[symbol].push(result);
    });

    // Get top N results for each stock and combine
    const topResults = [];
    Object.keys(resultsByStock).forEach(symbol => {
      const stockResults = resultsByStock[symbol];

      // Take top N results (already sorted by totalReturn from backend)
      const topN = stockResults.slice(0, n);
      topResults.push(...topN);
    });

    // Sort by overall performance to maintain ranking
    return topResults.sort((a, b) => {
      const aValue = a.summary?.totalReturn || 0;
      const bValue = b.summary?.totalReturn || 0;
      return bValue - aValue;
    });
  }

  return (
    <div className="batch-results">
      <div className="results-header">
        <h2>
          <Trophy size={24} />
          Batch Optimization Results
        </h2>
        <div className="execution-stats">
          <span>✅ {successfulRuns} successful</span>
          <span>❌ {failedRuns} failed</span>
          <span>⏱️ {(executionTimeMs / 1000).toFixed(1)}s</span>
        </div>
      </div>

      {/* Backend API Test Command */}
      {data.batchRequestParameters && (
        <div className="api-url-section" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '16px' }}>Backend API Test Command</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              readOnly
              value={(() => {
                // Construct batch request body from available data
                const batchParams = data.batchRequestParameters;
                // Extract unique parameter values from results to show what was tested
                const profitReqs = [...new Set(results.map(r => r.parameters.profitRequirement))];
                const gridIntervals = [...new Set(results.map(r => r.parameters.gridIntervalPercent))];
                const buyActivations = [...new Set(results.map(r => r.parameters.trailingBuyActivationPercent || r.parameters.trailingShortActivationPercent))];
                const buyRebounds = [...new Set(results.map(r => r.parameters.trailingBuyReboundPercent || r.parameters.trailingShortPullbackPercent))];
                const sellActivations = [...new Set(results.map(r => r.parameters.trailingSellActivationPercent || r.parameters.trailingCoverActivationPercent))];
                const sellPullbacks = [...new Set(results.map(r => r.parameters.trailingSellPullbackPercent || r.parameters.trailingCoverReboundPercent))];

                const requestBody = {
                  symbols: data.validSymbols,
                  parameterRanges: {
                    startDate: batchParams.startDate || '2021-09-01',
                    endDate: batchParams.endDate || '2025-10-16',
                    profitRequirement: profitReqs,
                    gridIntervalPercent: gridIntervals,
                    trailingBuyActivationPercent: buyActivations,
                    trailingBuyReboundPercent: buyRebounds,
                    trailingSellActivationPercent: sellActivations,
                    trailingSellPullbackPercent: sellPullbacks,
                    enableBetaScaling: batchParams.enableBetaScaling,
                    enableDynamicGrid: batchParams.enableDynamicGrid,
                    normalizeToReference: batchParams.normalizeToReference,
                    enableConsecutiveIncrementalBuyGrid: batchParams.enableConsecutiveIncrementalBuyGrid,
                    enableConsecutiveIncrementalSellProfit: batchParams.enableConsecutiveIncrementalSellProfit
                  }
                };

                const jsonBody = JSON.stringify(requestBody, null, 2);
                return `curl -X POST http://localhost:3001/api/backtest/batch -H "Content-Type: application/json" -d '${jsonBody.replace(/\n/g, ' ')}'`;
              })()}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '13px',
                fontFamily: 'monospace',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white'
              }}
              onClick={(e) => e.target.select()}
            />
            <button
              onClick={() => {
                const batchParams = data.batchRequestParameters;
                const profitReqs = [...new Set(results.map(r => r.parameters.profitRequirement))];
                const gridIntervals = [...new Set(results.map(r => r.parameters.gridIntervalPercent))];
                const buyActivations = [...new Set(results.map(r => r.parameters.trailingBuyActivationPercent || r.parameters.trailingShortActivationPercent))];
                const buyRebounds = [...new Set(results.map(r => r.parameters.trailingBuyReboundPercent || r.parameters.trailingShortPullbackPercent))];
                const sellActivations = [...new Set(results.map(r => r.parameters.trailingSellActivationPercent || r.parameters.trailingCoverActivationPercent))];
                const sellPullbacks = [...new Set(results.map(r => r.parameters.trailingSellPullbackPercent || r.parameters.trailingCoverReboundPercent))];

                const requestBody = {
                  symbols: data.validSymbols,
                  parameterRanges: {
                    startDate: batchParams.startDate || '2021-09-01',
                    endDate: batchParams.endDate || '2025-10-16',
                    profitRequirement: profitReqs,
                    gridIntervalPercent: gridIntervals,
                    trailingBuyActivationPercent: buyActivations,
                    trailingBuyReboundPercent: buyRebounds,
                    trailingSellActivationPercent: sellActivations,
                    trailingSellPullbackPercent: sellPullbacks,
                    enableBetaScaling: batchParams.enableBetaScaling,
                    enableDynamicGrid: batchParams.enableDynamicGrid,
                    normalizeToReference: batchParams.normalizeToReference,
                    enableConsecutiveIncrementalBuyGrid: batchParams.enableConsecutiveIncrementalBuyGrid,
                    enableConsecutiveIncrementalSellProfit: batchParams.enableConsecutiveIncrementalSellProfit
                  }
                };

                const jsonBody = JSON.stringify(requestBody, null, 2);
                const curlCommand = `curl -X POST http://localhost:3001/api/backtest/batch -H "Content-Type: application/json" -d '${jsonBody.replace(/\n/g, ' ')}'`;
                navigator.clipboard.writeText(curlCommand);
                alert('Curl command copied to clipboard!');
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Copy Command
            </button>
          </div>
          <p style={{ marginTop: '8px', marginBottom: 0, fontSize: '12px', color: '#666' }}>
            Use this curl command to reproduce the batch test from terminal
          </p>
        </div>
      )}

      {/* Stock Validation Errors */}
      {data.invalidSymbols && data.invalidSymbols.length > 0 && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          <strong>⚠️ Stock Validation Errors:</strong>
          <div style={{ marginTop: '0.5rem' }}>
            {data.stockValidationErrors.map((err, idx) => (
              <div key={idx} style={{ marginLeft: '1rem', fontSize: '0.9rem' }}>
                • <strong>{err.symbol}</strong>: {err.error}
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Valid symbols tested: {data.validSymbols.join(', ')}
          </div>
        </div>
      )}

      {/* Overall Summary */}
      <div className="summary-section">
        <h3>📊 Overall Statistics</h3>
        <div className="metrics-grid">
          <div className="metric-card">
            <Activity size={20} />
            <div>
              <span className="metric-label">Total Combinations Tested</span>
              <span className="metric-value">{totalCombinations}</span>
            </div>
          </div>
          <div className="metric-card">
            <TrendingUp size={20} />
            <div>
              <span className="metric-label">Average Total Return</span>
              <span className="metric-value">{formatPerformancePercent(summary?.statistics?.averageTotalReturn || 0)}</span>
            </div>
          </div>
          <div className="metric-card">
            <Target size={20} />
            <div>
              <span className="metric-label">Average Win Rate</span>
              <span className="metric-value">{formatPerformancePercent(summary?.statistics?.averageWinRate || 0)}</span>
            </div>
          </div>
          <div className="metric-card">
            <BarChart3 size={20} />
            <div>
              <span className="metric-label">Max Total Return</span>
              <span className="metric-value">{formatPercent(summary?.statistics?.maxTotalReturn || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Best Overall Result */}
      {summary?.overallBest && (
        <div className="best-result-section">
          <h3>🏆 Best Overall Performance</h3>
          <div className="best-result-card">
            <div className="best-result-header">
              <h4>{summary.overallBest.parameters.symbol}</h4>
              <span className="return-badge">
                {formatPerformancePercent(summary.overallBest?.summary?.totalReturn || 0)} Total Return
              </span>
            </div>
            <div className="best-params">
              <div className="param-group">
                <span>Profit Req:</span>
                <span>{formatParameterPercent(summary.overallBest.parameters.profitRequirement)}</span>
              </div>
              <div className="param-group">
                <span>Grid Interval:</span>
                <span>{formatParameterPercent(summary.overallBest.parameters.gridIntervalPercent)}</span>
              </div>
              <div className="param-group">
                <span>{isShortStrategy ? 'Short Activation:' : 'Buy Activation:'}</span>
                <span>{formatParameterPercent(summary.overallBest.parameters[isShortStrategy ? 'trailingShortActivationPercent' : 'trailingBuyActivationPercent'])}</span>
              </div>
              <div className="param-group">
                <span>{isShortStrategy ? 'Short Pullback:' : 'Buy Rebound:'}</span>
                <span>{formatParameterPercent(summary.overallBest.parameters[isShortStrategy ? 'trailingShortPullbackPercent' : 'trailingBuyReboundPercent'])}</span>
              </div>
              <div className="param-group">
                <span>{isShortStrategy ? 'Cover Activation:' : 'Sell Activation:'}</span>
                <span>{formatParameterPercent(summary.overallBest.parameters[isShortStrategy ? 'trailingCoverActivationPercent' : 'trailingSellActivationPercent'])}</span>
              </div>
              <div className="param-group">
                <span>{isShortStrategy ? 'Cover Rebound:' : 'Sell Pullback:'}</span>
                <span>{formatParameterPercent(summary.overallBest.parameters[isShortStrategy ? 'trailingCoverReboundPercent' : 'trailingSellPullbackPercent'])}</span>
              </div>
            </div>
            <div className="performance-summary">
              <div className="perf-metric">
                <DollarSign size={16} />
                <span>Total Return: {formatPerformancePercent(summary?.overallBest?.summary?.totalReturn || 0)}</span>
              </div>
              <div className="perf-metric">
                <Activity size={16} />
                <span>Trades: {summary?.overallBest?.summary?.totalTrades || 0}</span>
              </div>
              <div className="perf-metric">
                <Target size={16} />
                <span>Win Rate: {formatPerformancePercent(summary?.overallBest?.summary?.winRate || 0)}</span>
              </div>
              <div className="perf-metric">
                <Percent size={16} />
                <span>Max Drawdown: {formatPerformancePercent(summary?.overallBest?.summary?.maxDrawdownPercent || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Best Parameters by Stock */}
      {summary?.bestParametersBySymbol && (
        <div className="stock-best-section">
          <h3>📈 Best Parameters by Stock</h3>
          <div className="stock-best-grid">
            {Object.entries(summary.bestParametersBySymbol).map(([symbol, bestParams]) => (
              <div key={symbol} className="stock-best-card">
                <div className="stock-header">
                  <h4>{symbol}</h4>
                  <div className="stock-returns">
                    <span>Best Total Return: {formatPercent(bestParams?.bestByTotalReturn?.totalReturn || 0)}</span>
                  </div>
                </div>

                <div className="best-params-section">
                  <h5>🎯 Best Parameters for Total Return</h5>
                  <div className="mini-params">
                    <span>Profit: {formatParameterPercent(bestParams.bestByTotalReturn.parameters.profitRequirement)}</span>
                    <span>Grid: {formatParameterPercent(bestParams.bestByTotalReturn.parameters.gridIntervalPercent)}</span>
                    <span>{isShortStrategy ? 'Short Activation' : 'Buy Activation'}: {formatParameterPercent(bestParams.bestByTotalReturn.parameters[isShortStrategy ? 'trailingShortActivationPercent' : 'trailingBuyActivationPercent'])}</span>
                    <span>{isShortStrategy ? 'Short Pullback' : 'Buy Rebound'}: {formatParameterPercent(bestParams.bestByTotalReturn.parameters[isShortStrategy ? 'trailingShortPullbackPercent' : 'trailingBuyReboundPercent'])}</span>
                    <span>{isShortStrategy ? 'Cover Activation' : 'Sell Activation'}: {formatParameterPercent(bestParams.bestByTotalReturn.parameters[isShortStrategy ? 'trailingCoverActivationPercent' : 'trailingSellActivationPercent'])}</span>
                    <span>{isShortStrategy ? 'Cover Rebound' : 'Sell Pullback'}: {formatParameterPercent(bestParams.bestByTotalReturn.parameters[isShortStrategy ? 'trailingCoverReboundPercent' : 'trailingSellPullbackPercent'])}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Future Trades by Stock (Spec 33) */}
      {Object.keys(futureTradesBySymbol).length > 0 && (
        <div className="future-trades-section">
          <h3>🎯 Future Trades by Stock</h3>
          <div className="future-trades-grid">
            {Object.entries(futureTradesBySymbol)
              .sort(([symbolA], [symbolB]) => symbolA.localeCompare(symbolB)) // Sort alphabetically by symbol
              .map(([symbol, data]) => (
                <FutureTradeCard
                  key={symbol}
                  symbol={symbol}
                  futureTrades={data.futureTrades}
                  parameters={data.parameters}
                  isSelected={selectedStock === symbol}
                  onRunSingleBacktest={runSingleBacktest}
                />
              ))}
          </div>
        </div>
      )}

      {/* Detailed Results Table */}
      <div className="detailed-results-section">
        <div className="results-controls">
          <h3>📋 Detailed Results</h3>
          <div className="filter-controls">
            <div className="stock-filter">
              <label htmlFor="stock-filter">Filter by Stock:</label>
              <select
                id="stock-filter"
                value={selectedStock}
                onChange={(e) => setSelectedStock(e.target.value)}
              >
                <option value="all">All Stocks (top 5 per stock, {filteredResults.length} total results)</option>
                {stocks.map(stock => {
                  const stockResultsCount = results.filter(r => r.parameters.symbol === stock).length;
                  const displayCount = Math.min(stockResultsCount, 10);
                  return (
                    <option key={stock} value={stock}>
                      {stock} (top {displayCount} of {stockResultsCount} results)
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="beta-filter">
              <label htmlFor="beta-filter">Filter by Coefficient:</label>
              <select
                id="beta-filter"
                value={selectedBeta}
                onChange={(e) => setSelectedBeta(e.target.value)}
              >
                <option value="all">All Coefficients ({filteredResults.length} results)</option>
                {coefficients.map(coefficient => {
                  const coeffResultsCount = results.filter(r => (r.parameters.coefficient || 1.0) === coefficient).length;
                  return (
                    <option key={coefficient} value={coefficient}>
                      Coefficient = {coefficient.toFixed(2)} ({coeffResultsCount} results)
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        <div className="results-table-container">
          <table className="results-table">
            <thead>
              <tr>
                <th>Actions</th>
                <th>Rank</th>
                <th>Stock</th>
                <th>Beta</th>
                <th>Coeff</th>
                <th>β-Factor</th>
                <th>Total Return</th>
                <th>CAGR on Max Deployed</th>
                <th>CAGR on Avg Deployed</th>
                <th>Return on Max Deployed</th>
                <th>Sharpe Ratio</th>
                <th>Sortino Ratio</th>
                <th>Total Trades</th>
                <th>Win Rate</th>
                <th>Avg Profit/Trade</th>
                <th>Max Drawdown</th>
                <th>Capital Util.</th>
                {!isShortStrategy && <th>Max Lots/Sell</th>}
                <th>Profit Req.</th>
                <th>Grid Int.</th>
                <th>{isShortStrategy ? 'Short Act.' : 'Buy Act.'}</th>
                <th>{isShortStrategy ? 'Short Pullback' : 'Buy Rebound'}</th>
                <th>{isShortStrategy ? 'Cover Act.' : 'Sell Act.'}</th>
                <th>{isShortStrategy ? 'Cover Rebound' : 'Sell Pullback'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((result, index) => (
                <tr key={index} className={index < 5 ? 'top-result' : ''}>
                  <td>
                    <button
                      onClick={() => runSingleBacktest(result.parameters)}
                      className="run-single-button"
                      title="Run single backtest in new window"
                    >
                      📊 Run
                    </button>
                  </td>
                  <td>{index + 1}</td>
                  <td className="stock-cell">{result.parameters.symbol}</td>
                  <td className="beta-cell">
                    {(result.parameters.beta || 1.0).toFixed(2)}
                    {result.parameters.betaInfo?.warnings?.length ? ' ⚠️' : ''}
                  </td>
                  <td className="coefficient-cell">
                    {(result.parameters.coefficient || 1.0).toFixed(2)}
                  </td>
                  <td className="beta-factor-cell">
                    {(result.parameters.betaFactor || 1.0).toFixed(2)}
                  </td>
                  <td className={`return-cell ${(result.summary?.totalReturn || 0) >= 0 ? 'positive' : 'negative'}`}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ fontWeight: 'bold' }}>{formatCurrency(result.summary?.totalPNL || 0)}</div>
                      <div style={{ fontSize: '0.85em' }}>
                        {formatPerformancePercent(result.summary?.totalReturn || 0)} | Avg: {formatCurrency(result.summary?.avgCapitalDeployed || 0)}
                      </div>
                      <div style={{ fontSize: '0.85em', color: '#666' }}>
                        Max: {formatCurrency(result.summary?.maxCapitalDeployed || 0)}
                      </div>
                    </div>
                  </td>
                  <td className={`return-cell ${(result.summary?.cagrOnMaxDeployed || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {formatPerformancePercent(result.summary?.cagrOnMaxDeployed || 0)}
                  </td>
                  <td className={`return-cell ${(result.summary?.cagrOnAvgDeployed || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {formatPerformancePercent(result.summary?.cagrOnAvgDeployed || 0)}
                  </td>
                  <td className={`return-cell ${(result.summary?.returnOnMaxDeployed || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {formatPerformancePercent(result.summary?.returnOnMaxDeployed || 0)}
                  </td>
                  <td className="ratio-cell">
                    {(result.summary?.sharpeRatio || 0).toFixed(2)}
                  </td>
                  <td className="ratio-cell">
                    {(result.summary?.sortinoRatio || 0).toFixed(2)}
                  </td>
                  <td>{result.summary?.totalTrades || 0}</td>
                  <td>{formatPerformancePercent(result.summary?.winRate || 0)}</td>
                  <td className={`return-cell ${(result.summary?.avgProfitPerTrade || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(result.summary?.avgProfitPerTrade || 0)}
                  </td>
                  <td className="drawdown-cell">{formatPerformancePercent(result.summary?.maxDrawdownPercent || 0)}</td>
                  <td>{formatPerformancePercent(result.summary?.capitalUtilizationRate || 0)}</td>
                  {!isShortStrategy && <td>{result.parameters.maxLotsToSell || 1}</td>}
                  <td>{formatParameterPercent(result.parameters.profitRequirement)}</td>
                  <td>{formatParameterPercent(result.parameters.gridIntervalPercent)}</td>
                  <td>{formatParameterPercent(result.parameters[isShortStrategy ? 'trailingShortActivationPercent' : 'trailingBuyActivationPercent'])}</td>
                  <td>{formatParameterPercent(result.parameters[isShortStrategy ? 'trailingShortPullbackPercent' : 'trailingBuyReboundPercent'])}</td>
                  <td>{formatParameterPercent(result.parameters[isShortStrategy ? 'trailingCoverActivationPercent' : 'trailingSellActivationPercent'])}</td>
                  <td>{formatParameterPercent(result.parameters[isShortStrategy ? 'trailingCoverReboundPercent' : 'trailingSellPullbackPercent'])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Explanation */}
      <div className="report-explanation">
        <h3>📚 Report Metrics Explained</h3>
        <div className="explanation-grid">
          <div className="explanation-item">
            <strong>Beta:</strong> Stock's volatility relative to market (fetched from Yahoo Finance). Beta=1.0 moves with market, Beta&gt;1.0 more volatile, Beta&lt;1.0 less volatile.
          </div>
          <div className="explanation-item">
            <strong>Coefficient:</strong> User-selected multiplier (0.25-3.0) to amplify or reduce Beta's effect on parameter scaling.
          </div>
          <div className="explanation-item">
            <strong>β-Factor:</strong> Beta × Coefficient = final multiplier used for parameter calculations (e.g., TSLA Beta=2.1 × Coeff=1.5 = β-Factor=3.15).
          </div>
          <div className="explanation-item">
            <strong>Total Return:</strong> (Final Portfolio Value - Initial Investment) / Initial Investment
          </div>
          <div className="explanation-item">
            <strong>CAGR on Max Deployed:</strong> Compound Annual Growth Rate based on maximum capital actually deployed (most realistic annualized return metric)
          </div>
          <div className="explanation-item">
            <strong>CAGR on Avg Deployed:</strong> CAGR based on average capital deployed over time (shows capital efficiency)
          </div>
          <div className="explanation-item">
            <strong>Return on Max Deployed:</strong> Total return percentage based on peak capital used, not total available capital
          </div>
          <div className="explanation-item">
            <strong>Sharpe Ratio:</strong> Risk-adjusted return metric: (Avg Return - Risk-Free Rate) / Volatility. Higher is better (>1.0 is good, >2.0 is excellent)
          </div>
          <div className="explanation-item">
            <strong>Sortino Ratio:</strong> Like Sharpe but only penalizes downside volatility. Higher is better (>1.0 is good, >2.0 is excellent)
          </div>
          <div className="explanation-item">
            <strong>Total Trades:</strong> Total number of buy and sell transactions executed
          </div>
          <div className="explanation-item">
            <strong>Win Rate:</strong> Number of profitable trades / Total number of trades
          </div>
          <div className="explanation-item">
            <strong>Average Profit per Trade:</strong> Total realized profit / Total number of sell trades
          </div>
          <div className="explanation-item">
            <strong>Maximum Drawdown:</strong> Largest peak-to-trough decline in portfolio value
          </div>
          <div className="explanation-item">
            <strong>Capital Utilization:</strong> Average capital deployed / Total available capital
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchResults;