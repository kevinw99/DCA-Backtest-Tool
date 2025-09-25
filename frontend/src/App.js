import React, { useState, useEffect } from 'react';
import './App.css';
import DCABacktestForm from './components/DCABacktestForm';
import BacktestResults from './components/BacktestResults';
import BatchResults from './components/BatchResults';
import { Play, TrendingUp, Settings, Zap } from 'lucide-react';

function App() {
  const [backtestData, setBacktestData] = useState(null);
  const [batchData, setBatchData] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('parameters');
  const [testMode, setTestMode] = useState('single'); // 'single' or 'batch'
  const [urlParams, setUrlParams] = useState(null); // Store URL parameters

  // Handle URL parameters on component mount
  useEffect(() => {
    const urlSearchParams = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(urlSearchParams.entries());

    if (Object.keys(params).length > 0) {
      setUrlParams(params);
      if (params.mode === 'single') {
        setTestMode('single');
        setActiveTab('parameters');
      } else if (params.mode === 'batch') {
        setTestMode('batch');
        setActiveTab('parameters');
      }
    }

    // Load persisted state from localStorage
    try {
      const persistedTab = localStorage.getItem('dca-active-tab');
      const persistedMode = localStorage.getItem('dca-test-mode');
      if (persistedTab && !params.mode) setActiveTab(persistedTab);
      if (persistedMode && !params.mode) setTestMode(persistedMode);
    } catch (err) {
      console.warn('Failed to load persisted state:', err);
    }
  }, []);

  // Persist state changes to localStorage
  useEffect(() => {
    localStorage.setItem('dca-active-tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('dca-test-mode', testMode);
  }, [testMode]);

  const handleBacktestSubmit = async (parameters, isBatchMode = false) => {
    console.log(`Starting ${isBatchMode ? 'batch optimization' : 'single backtest'} for ${parameters.symbol}`);

    setLoading(true);
    setError(null);
    setTestMode(isBatchMode ? 'batch' : 'single');

    // Clear previous results
    if (isBatchMode) {
      setBatchData(null);
      setBacktestData(null);
      setChartData(null);
    } else {
      setBacktestData(null);
      setBatchData(null);
      setChartData(null);
    }

    try {
      if (isBatchMode) {
        const batchResponse = await fetch('http://localhost:3001/api/backtest/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(parameters),
        });

        if (!batchResponse.ok) {
          throw new Error(`Batch backtest failed: ${batchResponse.statusText}`);
        }

        const batchResult = await batchResponse.json();
        setBatchData({ ...batchResult.data, executionTimeMs: batchResult.executionTimeMs });
        setActiveTab('results');
      } else {
        const backtestResponse = await fetch('http://localhost:3001/api/backtest/dca', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(parameters),
        });

        if (!backtestResponse.ok) {
          throw new Error(`Backtest failed: ${backtestResponse.statusText}`);
        }

        const backtestResult = await backtestResponse.json();
        setBacktestData(backtestResult.data);

        const chartResponse = await fetch(
          `http://localhost:3001/api/stocks/${parameters.symbol}?startDate=${parameters.startDate}&endDate=${parameters.endDate}`
        );

        if (!chartResponse.ok) {
          throw new Error(`Chart data failed: ${chartResponse.statusText}`);
        }

        const chartResult = await chartResponse.json();
        const finalChartData = {
          ...chartResult,
          backtestParameters: parameters,
          transactions: backtestResult.data.transactions
        };

        setChartData(finalChartData);
        setActiveTab('chart');
      }
    } catch (err) {
      console.error('Error in', isBatchMode ? 'batch optimization' : 'backtest', ':', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1>
            <TrendingUp className="header-icon" />
            DCA Backtesting Platform
          </h1>
          <p>Analyze Dollar Cost Averaging strategies with technical indicators</p>
        </div>
      </header>

      <nav className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'parameters' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('parameters');
            // Clear URL parameters when switching to parameters tab to prevent auto-run
            if (window.location.search) {
              window.history.replaceState({}, '', window.location.pathname);
              setUrlParams(null);
            }
          }}
        >
          <Settings size={18} />
          Parameters
        </button>
        <button
          className={`tab-button ${activeTab === 'chart' ? 'active' : ''}`}
          onClick={() => setActiveTab('chart')}
          disabled={!chartData || testMode === 'batch'}
        >
          <TrendingUp size={18} />
          Chart & Analysis
        </button>
        <button
          className={`tab-button ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
          disabled={!batchData && !backtestData}
        >
          <Zap size={18} />
          {testMode === 'batch' ? 'Batch Results' : 'Results'}
        </button>
      </nav>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading && (
          <div className="loading-banner">
            <div className="loading-spinner"></div>
            {testMode === 'batch' ? 'Running batch optimization analysis...' : 'Running backtest analysis...'}
          </div>
        )}

        {activeTab === 'parameters' && (
          <div className="tab-content">
            <DCABacktestForm
              onSubmit={handleBacktestSubmit}
              loading={loading}
              urlParams={urlParams}
              currentTestMode={testMode}
              setAppTestMode={setTestMode}
            />
          </div>
        )}

        {activeTab === 'chart' && chartData && backtestData && testMode === 'single' && (
          <div className="tab-content">
            <BacktestResults data={backtestData} chartData={chartData} />
          </div>
        )}

        {activeTab === 'results' && testMode === 'batch' && batchData && (
          <div className="tab-content">
            <BatchResults data={batchData} />
          </div>
        )}

        {activeTab === 'results' && testMode === 'single' && backtestData && (
          <div className="tab-content">
            <BacktestResults data={backtestData} chartData={chartData} />
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
