import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import DCABacktestForm from './components/DCABacktestForm';
import BacktestResults from './components/BacktestResults';
import BatchResults from './components/BatchResults';
import BatchProgressBanner from './components/BatchProgressBanner';
import URLParameterManager from './utils/URLParameterManager';
import useSSEProgress from './hooks/useSSEProgress';
import { Play, TrendingUp, Settings, Zap } from 'lucide-react';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();

  const [backtestData, setBacktestData] = useState(null);
  const [batchData, setBatchData] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('parameters');
  const [testMode, setTestMode] = useState('single'); // 'single' or 'batch'
  const [urlParams, setUrlParams] = useState(null); // Store URL parameters
  const [autoExecuted, setAutoExecuted] = useState(false); // Prevent infinite execution
  const [batchSessionId, setBatchSessionId] = useState(null); // SSE session tracking

  // Use SSE progress hook for batch operations
  const { progress, isConnected, error: sseError, isComplete, results } = useSSEProgress(batchSessionId);

  // Handle SSE completion
  useEffect(() => {
    if (isComplete && results) {
      console.log('✅ Batch backtest completed via SSE', results);
      setBatchData(results);
      setLoading(false);
      setBatchSessionId(null); // Clear session ID
      setActiveTab('results');
    }

    if (sseError) {
      console.error('❌ SSE error:', sseError);
      setError(sseError);
      setLoading(false);
      setBatchSessionId(null); // Clear session ID
    }
  }, [isComplete, results, sseError]);

  // Handle URL parameters and route changes
  useEffect(() => {
    const path = location.pathname;

    // Try to parse semantic URL first, then fall back to legacy format
    let semanticParams = URLParameterManager.parseSemanticURL();
    let params = semanticParams ? semanticParams.parameters : URLParameterManager.decodeParametersFromURL();

    console.log('🔍 Route changed:', { path, semanticParams, params });

    // Determine if we're in results mode based on semantic URL or path
    const isResultsMode = semanticParams?.hasResults || path.includes('/results') || path === '/backtest' || path === '/batch';

    if (params || semanticParams) {
      setUrlParams(params);
      setTestMode(semanticParams?.mode || params?.mode || 'single');

      // Set active tab based on semantic URL or legacy path
      if (isResultsMode) {
        setActiveTab(semanticParams?.mode === 'batch' ? 'results' : 'chart');

        // Auto-execute if in results mode and not already executed
        const isBatch = semanticParams?.mode === 'batch' || path.includes('/batch');
        const shouldAutoExecute = isBatch
          ? (params.symbols && !autoExecuted)
          : (params.symbol && !autoExecuted);

        if (shouldAutoExecute) {
          console.log(`🚀 Auto-executing ${isBatch ? 'batch' : 'single'} from semantic URL`);
          setAutoExecuted(true);
          executeBacktestWithoutURLUpdate(params, isBatch);
        }
      } else {
        setActiveTab('parameters');
        setAutoExecuted(false); // Reset when in editing mode
      }
    } else {
      setAutoExecuted(false); // Reset when no params
      // Load persisted state from localStorage only if no URL params
      try {
        const persistedTab = localStorage.getItem('dca-active-tab');
        const persistedMode = localStorage.getItem('dca-test-mode');
        if (persistedTab) setActiveTab(persistedTab);
        if (persistedMode) setTestMode(persistedMode);
      } catch (err) {
        console.warn('Failed to load persisted state:', err);
      }
    }
  }, [location, autoExecuted]);

  // Persist state changes to localStorage
  useEffect(() => {
    localStorage.setItem('dca-active-tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('dca-test-mode', testMode);
  }, [testMode]);

  // Execute backtest without URL update (for auto-execution from URL)
  const executeBacktestWithoutURLUpdate = async (parameters, isBatchMode = false) => {
    console.log(`Auto-executing ${isBatchMode ? 'batch optimization' : 'single backtest'} for ${parameters.symbol || parameters.symbols}`);

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
        // Determine the batch endpoint based on strategy mode
        const strategyMode = parameters.strategyMode || parameters.parameterRanges?.strategyMode;
        const batchEndpoint = strategyMode === 'short'
          ? 'http://localhost:3001/api/backtest/short-batch?async=true'
          : 'http://localhost:3001/api/backtest/batch?async=true';

        console.log('=== DEBUG: Auto Batch API Call Info ===');
        console.log('Strategy Mode:', strategyMode);
        console.log('Batch Endpoint:', batchEndpoint);
        console.log('Raw parameters received:', JSON.stringify(parameters, null, 2));
        console.log('=========================================');

        const batchResponse = await fetch(batchEndpoint, {
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
        console.log('🐛 batchResult full structure:', JSON.stringify(batchResult, null, 2));

        // Check if this is async mode (returns sessionId) or sync mode (returns data)
        if (batchResult.sessionId) {
          // Async mode: Store sessionId and let SSE completion handler set batch data
          console.log('🔄 Async mode detected, sessionId:', batchResult.sessionId);
          setBatchSessionId(batchResult.sessionId);
          // Don't set activeTab yet - SSE completion handler will do it
        } else if (batchResult.data) {
          // Sync mode: Set batch data directly from response
          console.log('⚡ Sync mode detected, setting batch data directly');
          const dataToSet = { ...batchResult.data, executionTimeMs: batchResult.executionTimeMs };
          console.log('🐛 dataToSet:', JSON.stringify(dataToSet, null, 2));
          setBatchData(dataToSet);
          setActiveTab('results');
          setLoading(false);
        } else {
          throw new Error('Invalid batch response: no sessionId or data');
        }
      } else {
        // Determine the endpoint based on strategy mode
        const endpoint = parameters.strategyMode === 'short'
          ? 'http://localhost:3001/api/backtest/short-dca'
          : 'http://localhost:3001/api/backtest/dca';

        console.log('=== DEBUG: Auto API Call Info ===');
        console.log('Strategy Mode:', parameters.strategyMode);
        console.log('Selected Endpoint:', endpoint);
        console.log('================================');

        const backtestResponse = await fetch(endpoint, {
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
          transactions: backtestResult.data.transactions,
          betaInfo: backtestResult.data.betaInfo,
          scenarioAnalysis: backtestResult.data.summary?.scenarioAnalysis,
          recentPeak: backtestResult.data.recentPeak,
          recentBottom: backtestResult.data.recentBottom,
          lastTransactionDate: backtestResult.data.lastTransactionDate,
          activeTrailingStopSell: backtestResult.data.activeTrailingStopSell,
          activeTrailingStopBuy: backtestResult.data.activeTrailingStopBuy
        };

        setChartData(finalChartData);
        setActiveTab('chart');
      }
    } catch (err) {
      console.error('Error in auto-execution:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBacktestSubmit = async (parameters, isBatchMode = false) => {
    console.log(`Starting ${isBatchMode ? 'batch optimization' : 'single backtest'} for ${parameters.symbol}`);

    setLoading(true);
    setError(null);
    setTestMode(isBatchMode ? 'batch' : 'single');

    // Update URL with parameters before running backtest
    const mode = isBatchMode ? 'batch' : 'single';
    URLParameterManager.navigateToResults(parameters, mode);

    // Set active tab to show progress/results
    setActiveTab(isBatchMode ? 'results' : 'chart');

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
        // Determine the batch endpoint based on strategy mode
        // For short batch, strategyMode is at top level; for long batch, check parameterRanges
        const strategyMode = parameters.strategyMode || parameters.parameterRanges?.strategyMode;
        const batchEndpoint = strategyMode === 'short'
          ? 'http://localhost:3001/api/backtest/short-batch?async=true'
          : 'http://localhost:3001/api/backtest/batch?async=true';

        console.log('=== DEBUG: Batch API Call Info ===');
        console.log('Strategy Mode:', strategyMode);
        console.log('Batch Endpoint:', batchEndpoint);
        console.log('===================================');

        // Use async mode for SSE progress tracking (add ?async=true query param)
        const batchResponse = await fetch(`${batchEndpoint}?async=true`, {
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

        // Check if we got a sessionId (async mode) or data (sync mode fallback)
        if (batchResult.sessionId) {
          console.log('🔄 Batch started in async mode with session:', batchResult.sessionId);
          setBatchSessionId(batchResult.sessionId);
          // Keep loading state true - will be cleared when SSE completes
        } else if (batchResult.data) {
          // Fallback to sync mode (shouldn't happen with async=true, but handle it)
          console.log('⚠️ Received synchronous response instead of sessionId');
          setBatchData({ ...batchResult.data, executionTimeMs: batchResult.executionTimeMs });
          setLoading(false);
          setActiveTab('results');
        }
      } else {
        // Determine the endpoint based on strategy mode
        const endpoint = parameters.strategyMode === 'short'
          ? 'http://localhost:3001/api/backtest/short-dca'
          : 'http://localhost:3001/api/backtest/dca';

        console.log('=== DEBUG: API Call Info ===');
        console.log('Strategy Mode:', parameters.strategyMode);
        console.log('Selected Endpoint:', endpoint);
        console.log('Full Parameters:', parameters);
        console.log('============================');

        const backtestResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(parameters),
        });

        if (!backtestResponse.ok) {
          const errorData = await backtestResponse.json();
          console.error('🚨 Backend Error Response:', errorData);
          throw new Error(errorData.message || errorData.error || `Backtest failed: ${backtestResponse.statusText}`);
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
          transactions: backtestResult.data.transactions,
          betaInfo: backtestResult.data.betaInfo,
          scenarioAnalysis: backtestResult.data.summary?.scenarioAnalysis,
          recentPeak: backtestResult.data.recentPeak,
          recentBottom: backtestResult.data.recentBottom,
          lastTransactionDate: backtestResult.data.lastTransactionDate,
          activeTrailingStopSell: backtestResult.data.activeTrailingStopSell,
          activeTrailingStopBuy: backtestResult.data.activeTrailingStopBuy
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
            URLParameterManager.navigateToParameterPage();
            setUrlParams(null);
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

        {loading && testMode !== 'batch' && (
          <div className="loading-banner">
            <div className="loading-spinner"></div>
            Running backtest analysis...
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

        {activeTab === 'results' && testMode === 'batch' && (
          <div className="tab-content">
            {/* Debug: Log rendering conditions */}
            {console.log('🎨 Batch Results Tab Render:', { activeTab, testMode, loading, batchSessionId, hasBatchData: !!batchData, hasProgress: !!progress, isComplete })}

            {/* Show progress banner if we have a session ID and haven't completed yet */}
            {batchSessionId && !isComplete && (
              <BatchProgressBanner
                progress={progress}
                error={sseError}
                isConnected={isConnected}
              />
            )}

            {/* Show final results when available */}
            {batchData && <BatchResults data={batchData} />}

            {/* Show loading state if loading but no session ID yet (initial state) */}
            {loading && !batchSessionId && !batchData && (
              <div className="loading-banner">
                <div className="loading-spinner"></div>
                Starting batch backtest...
              </div>
            )}

            {/* Show waiting message only if not loading, no session, and no results */}
            {!loading && !batchSessionId && !batchData && (
              <div className="loading-banner">
                <div className="loading-spinner"></div>
                Waiting for batch results...
              </div>
            )}
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

// Main App component with Router wrapper
function App() {
  return (
    <Router>
      <Routes>
        {/* Root - clean slate */}
        <Route path="/" element={<AppContent />} />

        {/* Legacy routes (backward compatibility) */}
        <Route path="/backtest" element={<AppContent />} />
        <Route path="/batch" element={<AppContent />} />

        {/* Semantic routes for single backtest */}
        <Route path="/backtest/:strategyMode/:symbol" element={<AppContent />} />
        <Route path="/backtest/:strategyMode/:symbol/results" element={<AppContent />} />

        {/* Semantic routes for batch */}
        <Route path="/batch/:symbols" element={<AppContent />} />
        <Route path="/batch/:symbols/results" element={<AppContent />} />
      </Routes>
    </Router>
  );
}

export default App;
