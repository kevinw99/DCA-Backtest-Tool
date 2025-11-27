import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PortfolioBacktestForm from './PortfolioBacktestForm';
import PortfolioResults from './PortfolioResults';
import OptimizedCapitalResults from './OptimizedCapitalResults';
import { getDefaultStockSelection, getStockParameters } from '../utils/stockDefaults';
import { getApiUrl } from '../config/api';
import './PortfolioBacktestPage.css';

const PortfolioBacktestPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [parameters, setParameters] = useState(() => {
    // If using config mode, don't load from localStorage - use defaults
    const urlParams = new URLSearchParams(window.location.search);
    const configParam = urlParams.get('config');

    // Only load from localStorage if NOT using config mode
    if (!configParam) {
      const saved = localStorage.getItem('portfolio-backtest-params');
      if (saved) {
        return JSON.parse(saved);
      }
    }

    // Default parameters - use 10 stocks with stock-specific defaults
    return {
      totalCapital: 500000,
      lotSizeUsd: 10000,
      maxLotsPerStock: 10,
      startDate: '2024-01-01',
      endDate: new Date().toISOString().split('T')[0],
      stocks: getDefaultStockSelection(), // Gets 10 stocks (5 with specific defaults + 5 without)
      defaultParams: {
        gridIntervalPercent: 10,
        profitRequirement: 10,
        stopLossPercent: 30,
        trailingBuyActivationPercent: 10,
        trailingBuyReboundPercent: 5,
        trailingSellActivationPercent: 20,
        trailingSellPullbackPercent: 10,
        enableConsecutiveIncrementalBuyGrid: false,
        gridConsecutiveIncrement: 5,
        enableConsecutiveIncrementalSellProfit: false,
        // Dynamic Grid Parameters (explicit false to override backend defaults)
        enableDynamicGrid: false,
        normalizeToReference: false,
        dynamicGridMultiplier: 1.0,
        // Capital Optimization Parameters
        enableCashYield: false,
        cashYieldAnnualPercent: 4.5,
        cashYieldMinCash: 50000,
        enableDeferredSelling: true,
        deferredSellingThreshold: 150000,
        enableAdaptiveLotSizing: false,
        adaptiveLotCashThreshold: 100000,
        adaptiveLotMaxMultiplier: 2.0,
        adaptiveLotIncreaseStep: 20,
        // Spec 45: Momentum-based trading parameters
        momentumBasedBuy: false,
        momentumBasedSell: false,
        // Spec 61: Optimized Total Capital
        optimizedTotalCapital: false
      },
      // Beta Scaling Parameters
      _betaScaling: {
        enabled: false,
        coefficient: 1.0,
        beta: undefined
      },
      // Spec 66: Beta Range Filtering
      minBeta: undefined,
      maxBeta: undefined
    };
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('parameters');
  // Initialize isConfigMode by checking URL directly to avoid race condition
  const [isConfigMode, setIsConfigMode] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return !!urlParams.get('config');
  });

  // Parse URL parameters on mount
  useEffect(() => {
    const configParam = searchParams.get('config');
    const rerunParam = searchParams.get('rerun');
    const stocksParam = searchParams.get('stocks');

    // Priority 1: Config file (e.g., ?config=nasdaq100&rerun=true)
    if (configParam) {
      runConfigBacktest(configParam, rerunParam === 'true' || rerunParam === '1');
      return;
    }

    // Priority 2: URL parameters (legacy)
    if (stocksParam) {
      const urlParams = {
        stocks: stocksParam.split(','),
        totalCapital: parseFloat(searchParams.get('totalCapital')) || 500000,
        lotSizeUsd: parseFloat(searchParams.get('lotSize')) || 10000,
        maxLotsPerStock: parseInt(searchParams.get('maxLots')) || 10,
        startDate: searchParams.get('startDate') || '2024-01-01',
        endDate: searchParams.get('endDate') || new Date().toISOString().split('T')[0],
        defaultParams: {
          gridIntervalPercent: parseFloat(searchParams.get('gridInterval')) || 10,
          profitRequirement: parseFloat(searchParams.get('profitReq')) || 10,
          stopLossPercent: parseFloat(searchParams.get('stopLoss')) || 30,
          trailingBuyActivationPercent: parseFloat(searchParams.get('trailingBuyActivation')) || 10,
          trailingBuyReboundPercent: parseFloat(searchParams.get('trailingBuyRebound')) || 5,
          trailingSellActivationPercent: parseFloat(searchParams.get('trailingSellActivation')) || 20,
          trailingSellPullbackPercent: parseFloat(searchParams.get('trailingSellPullback')) || 10,
          enableConsecutiveIncrementalBuyGrid: searchParams.get('consecutiveBuyGrid') === 'true',
          gridConsecutiveIncrement: parseFloat(searchParams.get('gridConsecutiveIncrement')) || 5,
          enableConsecutiveIncrementalSellProfit: searchParams.get('consecutiveSellProfit') === 'true',
          // Dynamic Grid Parameters
          enableDynamicGrid: searchParams.get('enableDynamicGrid') === 'true',
          normalizeToReference: searchParams.get('normalizeToReference') === 'true',
          dynamicGridMultiplier: searchParams.get('dynamicGridMultiplier') ? parseFloat(searchParams.get('dynamicGridMultiplier')) : undefined,
          // Capital Optimization Parameters
          enableCashYield: searchParams.get('enableCashYield') === 'true',
          cashYieldAnnualPercent: parseFloat(searchParams.get('cashYieldAnnualPercent')) || 4.5,
          cashYieldMinCash: parseFloat(searchParams.get('cashYieldMinCash')) || 50000,
          enableDeferredSelling: searchParams.get('enableDeferredSelling') === 'true',
          deferredSellingThreshold: parseFloat(searchParams.get('deferredSellingThreshold')) || 150000,
          enableAdaptiveLotSizing: searchParams.get('enableAdaptiveLotSizing') === 'true',
          adaptiveLotCashThreshold: parseFloat(searchParams.get('adaptiveLotCashThreshold')) || 100000,
          adaptiveLotMaxMultiplier: parseFloat(searchParams.get('adaptiveLotMaxMultiplier')) || 2.0,
          adaptiveLotIncreaseStep: parseFloat(searchParams.get('adaptiveLotIncreaseStep')) || 20,
          // Spec 45: Momentum-based trading parameters
          momentumBasedBuy: searchParams.get('momentumBasedBuy') === 'true',
          momentumBasedSell: searchParams.get('momentumBasedSell') === 'true'
        }
      };

      // Add beta scaling parameters if present in URL
      if (searchParams.get('enableBetaScaling') === 'true') {
        urlParams._betaScaling = {
          enabled: true,
          coefficient: parseFloat(searchParams.get('coefficient')) || 1.0,
          beta: searchParams.get('beta') ? parseFloat(searchParams.get('beta')) : undefined
        };
      }

      setParameters(urlParams);

      // Auto-run if run=true
      if (searchParams.get('run') === 'true') {
        runBacktest(urlParams);
      }
    }
  }, []); // Only run on mount

  // Save parameters to localStorage whenever they change (but not in config mode)
  useEffect(() => {
    if (!isConfigMode) {
      localStorage.setItem('portfolio-backtest-params', JSON.stringify(parameters));
    }
  }, [parameters, isConfigMode]);

  // Sync parameters to URL whenever they change (for shareable URLs)
  useEffect(() => {
    if (!isConfigMode) {
      const params = new URLSearchParams();

      // Basic portfolio parameters
      params.set('stocks', parameters.stocks.join(','));
      params.set('totalCapital', parameters.totalCapital);
      params.set('lotSize', parameters.lotSizeUsd);
      params.set('maxLots', parameters.maxLotsPerStock);
      params.set('startDate', parameters.startDate);
      params.set('endDate', parameters.endDate);

      // Default strategy parameters
      if (parameters.defaultParams) {
        params.set('gridInterval', parameters.defaultParams.gridIntervalPercent);
        params.set('profitReq', parameters.defaultParams.profitRequirement);
        params.set('stopLoss', parameters.defaultParams.stopLossPercent || 30);
        params.set('trailingBuyActivation', parameters.defaultParams.trailingBuyActivationPercent);
        params.set('trailingBuyRebound', parameters.defaultParams.trailingBuyReboundPercent);
        params.set('trailingSellActivation', parameters.defaultParams.trailingSellActivationPercent);
        params.set('trailingSellPullback', parameters.defaultParams.trailingSellPullbackPercent);
        params.set('consecutiveBuyGrid', parameters.defaultParams.enableConsecutiveIncrementalBuyGrid || false);
        params.set('gridConsecutiveIncrement', parameters.defaultParams.gridConsecutiveIncrement || 5);
        params.set('consecutiveSellProfit', parameters.defaultParams.enableConsecutiveIncrementalSellProfit || false);

        // Dynamic Grid Parameters (always include to override backend defaults)
        params.set('enableDynamicGrid', parameters.defaultParams.enableDynamicGrid !== undefined ? parameters.defaultParams.enableDynamicGrid : false);
        params.set('normalizeToReference', parameters.defaultParams.normalizeToReference !== undefined ? parameters.defaultParams.normalizeToReference : false);
        if (parameters.defaultParams.dynamicGridMultiplier !== undefined) {
          params.set('dynamicGridMultiplier', parameters.defaultParams.dynamicGridMultiplier);
        }

        // Capital Optimization Parameters
        params.set('enableCashYield', parameters.defaultParams.enableCashYield || false);
        params.set('cashYieldAnnualPercent', parameters.defaultParams.cashYieldAnnualPercent || 4.5);
        params.set('cashYieldMinCash', parameters.defaultParams.cashYieldMinCash || 50000);
        params.set('enableDeferredSelling', parameters.defaultParams.enableDeferredSelling || false);
        params.set('deferredSellingThreshold', parameters.defaultParams.deferredSellingThreshold || 150000);
        params.set('enableAdaptiveLotSizing', parameters.defaultParams.enableAdaptiveLotSizing || false);
        params.set('adaptiveLotCashThreshold', parameters.defaultParams.adaptiveLotCashThreshold || 100000);
        params.set('adaptiveLotMaxMultiplier', parameters.defaultParams.adaptiveLotMaxMultiplier || 2.0);
        params.set('adaptiveLotIncreaseStep', parameters.defaultParams.adaptiveLotIncreaseStep || 20);

        // Spec 45: Momentum-based trading parameters
        params.set('momentumBasedBuy', parameters.defaultParams.momentumBasedBuy || false);
        params.set('momentumBasedSell', parameters.defaultParams.momentumBasedSell || false);
      }

      // Beta scaling parameters (if present)
      if (parameters._betaScaling?.enabled) {
        params.set('enableBetaScaling', 'true');
        params.set('coefficient', parameters._betaScaling.coefficient || 1.0);
        if (parameters._betaScaling.beta) {
          params.set('beta', parameters._betaScaling.beta);
        }
      }

      // Update URL without navigation (use replaceState to not create history entries)
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({ parameters }, '', newUrl);
    }
  }, [parameters, isConfigMode]);

  const runConfigBacktest = async (configName) => {
    setLoading(true);
    setError(null);
    setActiveTab('results');

    try {
      console.log('📋 Running config-based portfolio backtest:', configName);

      const response = await fetch(getApiUrl(`/api/backtest/portfolio/config/${configName}`));
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || data.error || 'Config-based portfolio backtest failed');
      }

      console.log('✅ Config-based portfolio backtest completed:', data.data);
      setResults(data.data);

    } catch (err) {
      console.error('❌ Config-based portfolio backtest error:', err);
      setError(err.message);
      setActiveTab('parameters');
    } finally {
      setLoading(false);
    }
  };

  const runBacktest = async (paramsToUse = parameters) => {
    setLoading(true);
    setError(null);

    try {
      console.log('📊 Running portfolio backtest with params:', paramsToUse);

      // Get stock-specific parameters for each stock
      const stocksWithParams = paramsToUse.stocks.map(symbol => {
        const stockParams = getStockParameters(symbol);

        return {
          symbol,
          // Use stock-specific longStrategy params if available, otherwise use form defaults
          params: {
            gridIntervalPercent: (stockParams.longStrategy.gridIntervalPercent || paramsToUse.defaultParams.gridIntervalPercent) / 100,
            profitRequirement: (stockParams.longStrategy.profitRequirement || paramsToUse.defaultParams.profitRequirement) / 100,
            stopLossPercent: (paramsToUse.defaultParams.stopLossPercent || 30) / 100,
            trailingBuyActivationPercent: (stockParams.longStrategy.trailingBuyActivationPercent || paramsToUse.defaultParams.trailingBuyActivationPercent || 10) / 100,
            trailingBuyReboundPercent: (stockParams.longStrategy.trailingBuyReboundPercent || paramsToUse.defaultParams.trailingBuyReboundPercent || 5) / 100,
            trailingSellActivationPercent: (stockParams.longStrategy.trailingSellActivationPercent || paramsToUse.defaultParams.trailingSellActivationPercent || 20) / 100,
            trailingSellPullbackPercent: (stockParams.longStrategy.trailingSellPullbackPercent || paramsToUse.defaultParams.trailingSellPullbackPercent || 10) / 100
          }
        };
      });

      console.log('📋 Stocks with specific parameters:', stocksWithParams);

      const response = await fetch(getApiUrl('/api/portfolio-backtest'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalCapital: paramsToUse.totalCapital,
          startDate: paramsToUse.startDate,
          endDate: paramsToUse.endDate,
          lotSizeUsd: paramsToUse.lotSizeUsd,
          maxLotsPerStock: paramsToUse.maxLotsPerStock,
          defaultParams: {
            gridIntervalPercent: paramsToUse.defaultParams.gridIntervalPercent / 100,
            profitRequirement: paramsToUse.defaultParams.profitRequirement / 100,
            stopLossPercent: (paramsToUse.defaultParams.stopLossPercent || 30) / 100,
            trailingBuyActivationPercent: (paramsToUse.defaultParams.trailingBuyActivationPercent || 10) / 100,
            trailingBuyReboundPercent: (paramsToUse.defaultParams.trailingBuyReboundPercent || 5) / 100,
            trailingSellActivationPercent: (paramsToUse.defaultParams.trailingSellActivationPercent || 20) / 100,
            trailingSellPullbackPercent: (paramsToUse.defaultParams.trailingSellPullbackPercent || 10) / 100,
            enableConsecutiveIncrementalBuyGrid: paramsToUse.defaultParams.enableConsecutiveIncrementalBuyGrid || false,
            gridConsecutiveIncrement: (paramsToUse.defaultParams.gridConsecutiveIncrement || 5) / 100,
            enableConsecutiveIncrementalSellProfit: paramsToUse.defaultParams.enableConsecutiveIncrementalSellProfit || false,
            // Dynamic Grid Parameters - always send to override backend defaults
            enableDynamicGrid: paramsToUse.defaultParams.enableDynamicGrid !== undefined ? paramsToUse.defaultParams.enableDynamicGrid : false,
            normalizeToReference: paramsToUse.defaultParams.normalizeToReference !== undefined ? paramsToUse.defaultParams.normalizeToReference : false,
            dynamicGridMultiplier: paramsToUse.defaultParams.dynamicGridMultiplier || 1.0,
            // Spec 45/48: Momentum-based trading parameters
            momentumBasedBuy: paramsToUse.defaultParams.momentumBasedBuy || false,
            momentumBasedSell: paramsToUse.defaultParams.momentumBasedSell || false
          },
          stocks: stocksWithParams, // Send stocks with their specific parameters
          // Capital Optimization Parameters (top-level as expected by backend)
          enableCashYield: paramsToUse.defaultParams.enableCashYield || false,
          cashYieldAnnualPercent: paramsToUse.defaultParams.cashYieldAnnualPercent || 4.5,
          cashYieldMinCash: paramsToUse.defaultParams.cashYieldMinCash || 50000,
          enableDeferredSelling: paramsToUse.defaultParams.enableDeferredSelling || false,
          deferredSellingThreshold: paramsToUse.defaultParams.deferredSellingThreshold || 150000,
          enableAdaptiveLotSizing: paramsToUse.defaultParams.enableAdaptiveLotSizing || false,
          adaptiveLotCashThreshold: paramsToUse.defaultParams.adaptiveLotCashThreshold || 100000,
          adaptiveLotMaxMultiplier: paramsToUse.defaultParams.adaptiveLotMaxMultiplier || 2.0,
          adaptiveLotIncreaseStep: paramsToUse.defaultParams.adaptiveLotIncreaseStep || 20,
          // Beta Scaling Parameters
          ...(paramsToUse._betaScaling && { _betaScaling: paramsToUse._betaScaling }),
          // Spec 61: Optimized Total Capital
          optimizedTotalCapital: paramsToUse.defaultParams.optimizedTotalCapital || false,
          // Spec 66: Beta Range Filtering
          ...(paramsToUse.minBeta !== undefined && { minBeta: paramsToUse.minBeta }),
          ...(paramsToUse.maxBeta !== undefined && { maxBeta: paramsToUse.maxBeta })
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Portfolio backtest failed');
      }

      console.log('✅ Portfolio backtest completed:', data.data);
      setResults(data.data);
      setActiveTab('results');

    } catch (err) {
      console.error('❌ Portfolio backtest error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleParametersChange = (newParams) => {
    setParameters(newParams);
  };

  const handleSubmit = () => {
    runBacktest(parameters);
  };

  return (
    <div className="portfolio-backtest-page">
      <header className="page-header">
        <h1>📊 Portfolio Simulation</h1>
        <p className="page-subtitle">
          Simulate adaptive DCA strategies across multiple stocks with shared capital constraints
        </p>
      </header>

      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'parameters' ? 'active' : ''}`}
          onClick={() => setActiveTab('parameters')}
        >
          ⚙️ Configuration
        </button>
        <button
          className={`tab-button ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
          disabled={!results}
        >
          📈 Results
          {results && <span className="result-badge">✓</span>}
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <h3>❌ Error</h3>
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="tab-content">
        {activeTab === 'parameters' && (
          <PortfolioBacktestForm
            parameters={parameters}
            onParametersChange={handleParametersChange}
            onSubmit={handleSubmit}
            loading={loading}
          />
        )}

        {activeTab === 'results' && results && (
          // Check if this is an optimized capital response (has scenarios)
          results.scenarios ? (
            <OptimizedCapitalResults data={results} />
          ) : (
            <PortfolioResults data={results} />
          )
        )}

        {activeTab === 'results' && !results && (
          <div className="empty-results">
            <p>No results yet. Run a backtest to see results.</p>
            <button onClick={() => setActiveTab('parameters')}>
              Go to Configuration
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Running portfolio backtest...</p>
            <p className="loading-hint">
              Testing {parameters.stocks.length} stocks from {parameters.startDate} to {parameters.endDate}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioBacktestPage;
