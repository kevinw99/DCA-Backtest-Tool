import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PortfolioBacktestForm from './PortfolioBacktestForm';
import PortfolioResults from './PortfolioResults';
import { getDefaultStockSelection, getStockParameters } from '../utils/stockDefaults';
import './PortfolioBacktestPage.css';

const PortfolioBacktestPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [parameters, setParameters] = useState(() => {
    // Try to load from localStorage first
    const saved = localStorage.getItem('portfolio-backtest-params');
    if (saved) {
      return JSON.parse(saved);
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
        enableTrailingBuy: false,
        enableTrailingSell: false,
        trailingBuyActivationPercent: 10,
        trailingBuyReboundPercent: 5,
        trailingSellActivationPercent: 20,
        trailingSellPullbackPercent: 10,
        enableConsecutiveIncrementalBuyGrid: false,
        gridConsecutiveIncrement: 5,
        enableConsecutiveIncrementalSellProfit: false
      }
    };
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('parameters');
  const [isConfigMode, setIsConfigMode] = useState(false); // Track if using config file

  // Parse URL parameters on mount
  useEffect(() => {
    const configParam = searchParams.get('config');
    const stocksParam = searchParams.get('stocks');

    // Priority 1: Config file (e.g., ?config=nasdaq100)
    if (configParam) {
      setIsConfigMode(true);
      runConfigBacktest(configParam);
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
          enableTrailingBuy: searchParams.get('trailingBuy') === 'true',
          enableTrailingSell: searchParams.get('trailingSell') === 'true',
          trailingBuyActivationPercent: parseFloat(searchParams.get('trailingBuyActivation')) || 10,
          trailingBuyReboundPercent: parseFloat(searchParams.get('trailingBuyRebound')) || 5,
          trailingSellActivationPercent: parseFloat(searchParams.get('trailingSellActivation')) || 20,
          trailingSellPullbackPercent: parseFloat(searchParams.get('trailingSellPullback')) || 10,
          enableConsecutiveIncrementalBuyGrid: searchParams.get('consecutiveBuyGrid') === 'true',
          gridConsecutiveIncrement: parseFloat(searchParams.get('gridConsecutiveIncrement')) || 5,
          enableConsecutiveIncrementalSellProfit: searchParams.get('consecutiveSellProfit') === 'true'
        }
      };

      setParameters(urlParams);

      // Auto-run if run=true
      if (searchParams.get('run') === 'true') {
        runBacktest(urlParams);
      }
    }
  }, []); // Only run on mount

  // Save parameters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('portfolio-backtest-params', JSON.stringify(parameters));
  }, [parameters]);

  // Update URL when parameters change (but not when in config mode)
  useEffect(() => {
    // Skip URL update if we're in config mode
    if (isConfigMode) {
      return;
    }

    const params = new URLSearchParams();
    params.set('stocks', parameters.stocks.join(','));
    params.set('totalCapital', parameters.totalCapital.toString());
    params.set('lotSize', parameters.lotSizeUsd.toString());
    params.set('maxLots', parameters.maxLotsPerStock.toString());
    params.set('startDate', parameters.startDate);
    params.set('endDate', parameters.endDate);
    params.set('gridInterval', parameters.defaultParams.gridIntervalPercent.toString());
    params.set('profitReq', parameters.defaultParams.profitRequirement.toString());
    params.set('stopLoss', (parameters.defaultParams.stopLossPercent || 30).toString());
    params.set('trailingBuy', parameters.defaultParams.enableTrailingBuy ? 'true' : 'false');
    params.set('trailingSell', parameters.defaultParams.enableTrailingSell ? 'true' : 'false');
    params.set('trailingBuyActivation', (parameters.defaultParams.trailingBuyActivationPercent || 10).toString());
    params.set('trailingBuyRebound', (parameters.defaultParams.trailingBuyReboundPercent || 5).toString());
    params.set('trailingSellActivation', (parameters.defaultParams.trailingSellActivationPercent || 20).toString());
    params.set('trailingSellPullback', (parameters.defaultParams.trailingSellPullbackPercent || 10).toString());
    params.set('consecutiveBuyGrid', parameters.defaultParams.enableConsecutiveIncrementalBuyGrid ? 'true' : 'false');
    params.set('gridConsecutiveIncrement', (parameters.defaultParams.gridConsecutiveIncrement || 5).toString());
    params.set('consecutiveSellProfit', parameters.defaultParams.enableConsecutiveIncrementalSellProfit ? 'true' : 'false');

    setSearchParams(params, { replace: true });
  }, [parameters, setSearchParams, isConfigMode]);

  const runConfigBacktest = async (configName) => {
    setLoading(true);
    setError(null);
    setActiveTab('results');

    try {
      console.log('📋 Running config-based portfolio backtest:', configName);

      const response = await fetch(`http://localhost:3001/api/backtest/portfolio/config/${configName}`);
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
            enableTrailingBuy: paramsToUse.defaultParams.enableTrailingBuy || false,
            enableTrailingSell: paramsToUse.defaultParams.enableTrailingSell || false,
            trailingBuyActivationPercent: (stockParams.longStrategy.trailingBuyActivationPercent || paramsToUse.defaultParams.trailingBuyActivationPercent || 10) / 100,
            trailingBuyReboundPercent: (stockParams.longStrategy.trailingBuyReboundPercent || paramsToUse.defaultParams.trailingBuyReboundPercent || 5) / 100,
            trailingSellActivationPercent: (stockParams.longStrategy.trailingSellActivationPercent || paramsToUse.defaultParams.trailingSellActivationPercent || 20) / 100,
            trailingSellPullbackPercent: (stockParams.longStrategy.trailingSellPullbackPercent || paramsToUse.defaultParams.trailingSellPullbackPercent || 10) / 100
          }
        };
      });

      console.log('📋 Stocks with specific parameters:', stocksWithParams);

      const response = await fetch('http://localhost:3001/api/portfolio-backtest', {
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
            enableTrailingBuy: paramsToUse.defaultParams.enableTrailingBuy || false,
            enableTrailingSell: paramsToUse.defaultParams.enableTrailingSell || false,
            trailingBuyActivationPercent: (paramsToUse.defaultParams.trailingBuyActivationPercent || 10) / 100,
            trailingBuyReboundPercent: (paramsToUse.defaultParams.trailingBuyReboundPercent || 5) / 100,
            trailingSellActivationPercent: (paramsToUse.defaultParams.trailingSellActivationPercent || 20) / 100,
            trailingSellPullbackPercent: (paramsToUse.defaultParams.trailingSellPullbackPercent || 10) / 100,
            enableConsecutiveIncrementalBuyGrid: paramsToUse.defaultParams.enableConsecutiveIncrementalBuyGrid || false,
            gridConsecutiveIncrement: (paramsToUse.defaultParams.gridConsecutiveIncrement || 5) / 100,
            enableConsecutiveIncrementalSellProfit: paramsToUse.defaultParams.enableConsecutiveIncrementalSellProfit || false
          },
          stocks: stocksWithParams // Send stocks with their specific parameters
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Portfolio backtest failed');
      }

      console.log('✅ Portfolio backtest completed:', data.data);
      setResults(data.data);
      setActiveTab('results');

      // Update URL to include run=true
      const params = new URLSearchParams(searchParams);
      params.set('run', 'true');
      setSearchParams(params, { replace: true });

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
        <h1>📊 Portfolio Backtest</h1>
        <p className="page-subtitle">
          Test your DCA strategy across multiple stocks with shared capital constraints
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
          <PortfolioResults data={results} />
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
