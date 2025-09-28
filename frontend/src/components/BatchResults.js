import React, { useState } from 'react';
import { TrendingUp, Target, Trophy, Activity, DollarSign, BarChart3, Users, Percent } from 'lucide-react';

const BatchResults = ({ data }) => {
  const [selectedStock, setSelectedStock] = useState('all');
  const [selectedBeta, setSelectedBeta] = useState('all');

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

    // Create URL with parameters for the existing single backtest page
    const baseUrl = window.location.origin + window.location.pathname;
    console.log('🐛 Base URL for new tab:', baseUrl);

    // Convert decimal parameters to percentages for URL (form expects percentages)
    let convertedParams = {
      mode: currentMode, // Preserve the current mode (batch/single) from URL
      strategyMode: isShortStrategy ? 'short' : 'long',
      symbol: parameters.symbol,
      startDate: parameters.startDate,
      endDate: parameters.endDate,
      lotSizeUsd: parameters.lotSizeUsd,
      // Convert decimal values to percentages for URL parameters (backend expects decimals, form displays percentages)
      gridIntervalPercent: parameters.gridIntervalPercent * 100,
      profitRequirement: parameters.profitRequirement * 100,
      autoRun: 'true' // Flag to automatically run the backtest
    };

    if (isShortStrategy) {
      // Short strategy parameters
      convertedParams = {
        ...convertedParams,
        maxShorts: parameters.maxShorts,
        maxShortsToCovers: parameters.maxShortsToCovers,
        trailingShortActivationPercent: parameters.trailingShortActivationPercent * 100,
        trailingShortPullbackPercent: parameters.trailingShortPullbackPercent * 100,
        trailingCoverActivationPercent: parameters.trailingCoverActivationPercent * 100,
        trailingCoverReboundPercent: parameters.trailingCoverReboundPercent * 100
      };
    } else {
      // Long strategy parameters
      convertedParams = {
        ...convertedParams,
        maxLots: parameters.maxLots,
        maxLotsToSell: parameters.maxLotsToSell,
        trailingBuyActivationPercent: parameters.trailingBuyActivationPercent * 100,
        trailingBuyReboundPercent: parameters.trailingBuyReboundPercent * 100,
        trailingSellActivationPercent: parameters.trailingSellActivationPercent * 100,
        trailingSellPullbackPercent: parameters.trailingSellPullbackPercent * 100
      };
    }

    console.log(`🔄 PARAMETER CONVERSION (decimal → percentage for ${isShortStrategy ? 'SHORT' : 'LONG'} strategy URL):`);
    console.log(`  📊 Strategy Mode: ${convertedParams.strategyMode}`);
    console.log(`  📊 Grid Interval: ${parameters.gridIntervalPercent} → ${convertedParams.gridIntervalPercent}%`);
    console.log(`  📊 Profit Requirement: ${parameters.profitRequirement} → ${convertedParams.profitRequirement}%`);

    if (isShortStrategy) {
      console.log(`  📊 Trailing Short Activation: ${parameters.trailingShortActivationPercent} → ${convertedParams.trailingShortActivationPercent}%`);
      console.log(`  📊 Trailing Short Pullback: ${parameters.trailingShortPullbackPercent} → ${convertedParams.trailingShortPullbackPercent}%`);
      console.log(`  📊 Trailing Cover Activation: ${parameters.trailingCoverActivationPercent} → ${convertedParams.trailingCoverActivationPercent}%`);
      console.log(`  📊 Trailing Cover Rebound: ${parameters.trailingCoverReboundPercent} → ${convertedParams.trailingCoverReboundPercent}%`);
    } else {
      console.log(`  📊 Trailing Buy Activation: ${parameters.trailingBuyActivationPercent} → ${convertedParams.trailingBuyActivationPercent}%`);
      console.log(`  📊 Trailing Buy Rebound: ${parameters.trailingBuyReboundPercent} → ${convertedParams.trailingBuyReboundPercent}%`);
      console.log(`  📊 Trailing Sell Activation: ${parameters.trailingSellActivationPercent} → ${convertedParams.trailingSellActivationPercent}%`);
      console.log(`  📊 Trailing Sell Pullback: ${parameters.trailingSellPullbackPercent} → ${convertedParams.trailingSellPullbackPercent}%`);
    }

    const params = new URLSearchParams(convertedParams);
    const url = `${baseUrl}?${params.toString()}`;
    console.log('🌐 Complete URL being opened in new tab:', url);
    console.log('🌐 URL parameters being passed (percentage format):', Object.fromEntries(params));

    // Open new tab with single backtest page
    console.log('🐛 Calling window.open with _blank target...');
    const newWindow = window.open(url, '_blank');
    console.log('🐛 window.open returned:', newWindow ? 'success' : 'blocked/failed');
  };

  if (!data || !data.results) {
    return <div>No batch results available</div>;
  }

  const { summary, results, totalCombinations, successfulRuns, failedRuns, executionTimeMs } = data;

  // Get unique stocks and coefficient values from results
  const stocks = [...new Set(results.map(r => r.parameters.symbol))];
  const coefficients = [...new Set(results.map(r => r.parameters.coefficient || 1.0))].sort((a, b) => a - b);

  // Filter results by selected stock and coefficient, then limit to top 5 per stock
  let filteredByFilters = results;

  if (selectedStock !== 'all') {
    filteredByFilters = filteredByFilters.filter(r => r.parameters.symbol === selectedStock);
  }

  if (selectedBeta !== 'all') {
    filteredByFilters = filteredByFilters.filter(r => (r.parameters.coefficient || 1.0) === parseFloat(selectedBeta));
  }

  const filteredResults = selectedStock === 'all' && selectedBeta === 'all'
    ? getTop5PerStock(filteredByFilters)
    : filteredByFilters.slice(0, 5);

  // Helper function to get top 5 results per stock
  function getTop5PerStock(results) {
    const resultsByStock = {};

    // Group results by stock symbol
    results.forEach(result => {
      const symbol = result.parameters.symbol;
      if (!resultsByStock[symbol]) {
        resultsByStock[symbol] = [];
      }
      resultsByStock[symbol].push(result);
    });

    // Get top 5 for each stock and combine
    const top5Results = [];
    Object.keys(resultsByStock).forEach(symbol => {
      const stockResults = resultsByStock[symbol].slice(0, 5); // Top 5 for this stock
      top5Results.push(...stockResults);
    });

    // Sort by overall performance to maintain ranking
    return top5Results.sort((a, b) => {
      const aValue = a.summary?.annualizedReturn || 0;
      const bValue = b.summary?.annualizedReturn || 0;
      return bValue - aValue;
    });
  }

  const formatPercent = (value) => `${value.toFixed(2)}%`;
  const formatCurrency = (value) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatNumber = (value, decimals = 2) => value.toFixed(decimals);

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
              <span className="metric-label">Average Annualized Return</span>
              <span className="metric-value">{formatPercent(summary?.statistics?.averageAnnualizedReturn || 0)}</span>
            </div>
          </div>
          <div className="metric-card">
            <Target size={20} />
            <div>
              <span className="metric-label">Average Win Rate</span>
              <span className="metric-value">{formatPercent(summary?.statistics?.averageWinRate || 0)}</span>
            </div>
          </div>
          <div className="metric-card">
            <BarChart3 size={20} />
            <div>
              <span className="metric-label">Max Annualized Return</span>
              <span className="metric-value">{formatPercent(summary?.statistics?.maxAnnualizedReturn || 0)}</span>
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
                {formatPercent(summary.overallBest?.summary?.annualizedReturn || 0)} Annual Return
              </span>
            </div>
            <div className="best-params">
              <div className="param-group">
                <span>Profit Req:</span>
                <span>{formatPercent(summary.overallBest.parameters.profitRequirement)}</span>
              </div>
              <div className="param-group">
                <span>Grid Interval:</span>
                <span>{formatPercent(summary.overallBest.parameters.gridIntervalPercent)}</span>
              </div>
              <div className="param-group">
                <span>{isShortStrategy ? 'Short Activation:' : 'Buy Activation:'}</span>
                <span>{formatPercent(summary.overallBest.parameters[isShortStrategy ? 'trailingShortActivationPercent' : 'trailingBuyActivationPercent'])}</span>
              </div>
              <div className="param-group">
                <span>{isShortStrategy ? 'Short Pullback:' : 'Buy Rebound:'}</span>
                <span>{formatPercent(summary.overallBest.parameters[isShortStrategy ? 'trailingShortPullbackPercent' : 'trailingBuyReboundPercent'])}</span>
              </div>
              <div className="param-group">
                <span>{isShortStrategy ? 'Cover Activation:' : 'Sell Activation:'}</span>
                <span>{formatPercent(summary.overallBest.parameters[isShortStrategy ? 'trailingCoverActivationPercent' : 'trailingSellActivationPercent'])}</span>
              </div>
              <div className="param-group">
                <span>{isShortStrategy ? 'Cover Rebound:' : 'Sell Pullback:'}</span>
                <span>{formatPercent(summary.overallBest.parameters[isShortStrategy ? 'trailingCoverReboundPercent' : 'trailingSellPullbackPercent'])}</span>
              </div>
            </div>
            <div className="performance-summary">
              <div className="perf-metric">
                <DollarSign size={16} />
                <span>Total Return: {formatPercent(summary?.overallBest?.summary?.totalReturn || 0)}</span>
              </div>
              <div className="perf-metric">
                <Activity size={16} />
                <span>Trades: {summary?.overallBest?.summary?.totalTrades || 0}</span>
              </div>
              <div className="perf-metric">
                <Target size={16} />
                <span>Win Rate: {formatPercent(summary?.overallBest?.summary?.winRate || 0)}</span>
              </div>
              <div className="perf-metric">
                <Percent size={16} />
                <span>Max Drawdown: {formatPercent(summary?.overallBest?.summary?.maxDrawdownPercent || 0)}</span>
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
                    <span>Best Total: {formatPercent(bestParams?.bestByTotalReturn?.totalReturn || 0)}</span>
                    <span>Best Annual: {formatPercent(bestParams?.bestByAnnualizedReturn?.annualizedReturn || 0)}</span>
                  </div>
                </div>

                <div className="best-params-section">
                  <h5>🎯 Best for Total Return</h5>
                  <div className="mini-params">
                    <span>Profit: {formatPercent(bestParams.bestByTotalReturn.parameters.profitRequirement)}</span>
                    <span>Grid: {formatPercent(bestParams.bestByTotalReturn.parameters.gridIntervalPercent)}</span>
                    <span>{isShortStrategy ? 'Short Activation' : 'Buy Activation'}: {formatPercent(bestParams.bestByTotalReturn.parameters[isShortStrategy ? 'trailingShortActivationPercent' : 'trailingBuyActivationPercent'])}</span>
                    <span>{isShortStrategy ? 'Short Pullback' : 'Buy Rebound'}: {formatPercent(bestParams.bestByTotalReturn.parameters[isShortStrategy ? 'trailingShortPullbackPercent' : 'trailingBuyReboundPercent'])}</span>
                    <span>{isShortStrategy ? 'Cover Activation' : 'Sell Activation'}: {formatPercent(bestParams.bestByTotalReturn.parameters[isShortStrategy ? 'trailingCoverActivationPercent' : 'trailingSellActivationPercent'])}</span>
                    <span>{isShortStrategy ? 'Cover Rebound' : 'Sell Pullback'}: {formatPercent(bestParams.bestByTotalReturn.parameters[isShortStrategy ? 'trailingCoverReboundPercent' : 'trailingSellPullbackPercent'])}</span>
                  </div>
                </div>

                <div className="best-params-section">
                  <h5>📊 Best for Annualized Return</h5>
                  <div className="mini-params">
                    <span>Profit: {formatPercent(bestParams.bestByAnnualizedReturn.parameters.profitRequirement)}</span>
                    <span>Grid: {formatPercent(bestParams.bestByAnnualizedReturn.parameters.gridIntervalPercent)}</span>
                    <span>{isShortStrategy ? 'Short Activation' : 'Buy Activation'}: {formatPercent(bestParams.bestByAnnualizedReturn.parameters[isShortStrategy ? 'trailingShortActivationPercent' : 'trailingBuyActivationPercent'])}</span>
                    <span>{isShortStrategy ? 'Short Pullback' : 'Buy Rebound'}: {formatPercent(bestParams.bestByAnnualizedReturn.parameters[isShortStrategy ? 'trailingShortPullbackPercent' : 'trailingBuyReboundPercent'])}</span>
                    <span>{isShortStrategy ? 'Cover Activation' : 'Sell Activation'}: {formatPercent(bestParams.bestByAnnualizedReturn.parameters[isShortStrategy ? 'trailingCoverActivationPercent' : 'trailingSellActivationPercent'])}</span>
                    <span>{isShortStrategy ? 'Cover Rebound' : 'Sell Pullback'}: {formatPercent(bestParams.bestByAnnualizedReturn.parameters[isShortStrategy ? 'trailingCoverReboundPercent' : 'trailingSellPullbackPercent'])}</span>
                  </div>
                </div>
              </div>
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
                  const displayCount = Math.min(stockResultsCount, 5);
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
                <th>Annual Return</th>
                <th>Total Trades</th>
                <th>Win Rate</th>
                <th>Avg Profit/Trade</th>
                <th>Max Drawdown</th>
                <th>Capital Util.</th>
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
                    {formatPercent(result.summary?.totalReturn || 0)}
                  </td>
                  <td className={`return-cell ${(result.summary?.annualizedReturn || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {formatPercent(result.summary?.annualizedReturn || 0)}
                  </td>
                  <td>{result.summary?.totalTrades || 0}</td>
                  <td>{formatPercent(result.summary?.winRate || 0)}</td>
                  <td className={`return-cell ${(result.summary?.avgProfitPerTrade || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(result.summary?.avgProfitPerTrade || 0)}
                  </td>
                  <td className="drawdown-cell">{formatPercent(result.summary?.maxDrawdownPercent || 0)}</td>
                  <td>{formatPercent(result.summary?.capitalUtilizationRate || 0)}</td>
                  <td>{formatPercent(result.parameters.profitRequirement)}</td>
                  <td>{formatPercent(result.parameters.gridIntervalPercent)}</td>
                  <td>{formatPercent(result.parameters[isShortStrategy ? 'trailingShortActivationPercent' : 'trailingBuyActivationPercent'])}</td>
                  <td>{formatPercent(result.parameters[isShortStrategy ? 'trailingShortPullbackPercent' : 'trailingBuyReboundPercent'])}</td>
                  <td>{formatPercent(result.parameters[isShortStrategy ? 'trailingCoverActivationPercent' : 'trailingSellActivationPercent'])}</td>
                  <td>{formatPercent(result.parameters[isShortStrategy ? 'trailingCoverReboundPercent' : 'trailingSellPullbackPercent'])}</td>
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
            <strong>Annualized Return:</strong> (1 + Total Return) ^ (365 / Days in Period) - 1
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