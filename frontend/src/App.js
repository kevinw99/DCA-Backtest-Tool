import React, { useState, useEffect } from 'react';
import './App.css';
import DCABacktestForm from './components/DCABacktestForm';
import BacktestChart from './components/BacktestChart';
import BacktestResults from './components/BacktestResults';
import { Play, TrendingUp, Settings } from 'lucide-react';

function App() {
  const [backtestData, setBacktestData] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('parameters');

  const handleBacktestSubmit = async (parameters) => {
    console.log('🚀 Starting DCA Backtest with parameters:', parameters);
    setLoading(true);
    setError(null);

    try {
      // Run backtest
      console.log('📊 Step 1: Running DCA backtest...');
      const backtestResponse = await fetch('http://localhost:3001/api/backtest/dca', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parameters),
      });

      console.log('📊 Backtest response status:', backtestResponse.status);

      if (!backtestResponse.ok) {
        throw new Error(`Backtest failed: ${backtestResponse.statusText}`);
      }

      const backtestResult = await backtestResponse.json();
      console.log('✅ Backtest result received:', backtestResult);
      setBacktestData(backtestResult.data);

      // Get chart data with extended period for technical indicators
      console.log('📈 Step 2: Fetching chart data...');
      const chartResponse = await fetch(
        `http://localhost:3001/api/stocks/${parameters.symbol}?startDate=${parameters.startDate}&endDate=${parameters.endDate}`
      );

      console.log('📈 Chart response status:', chartResponse.status);

      if (!chartResponse.ok) {
        throw new Error(`Chart data failed: ${chartResponse.statusText}`);
      }

      const chartResult = await chartResponse.json();
      console.log('✅ Chart result received:', chartResult);
      console.log('📊 Daily prices count:', chartResult.dailyPrices?.length || 0);

      const finalChartData = {
        ...chartResult,
        backtestParameters: parameters,
        transactions: backtestResult.data.transactions
      };

      console.log('🎯 Final chart data structure:', {
        symbol: finalChartData.symbol,
        dailyPricesCount: finalChartData.dailyPrices?.length || 0,
        transactionsCount: finalChartData.transactions?.length || 0,
        backtestParameters: finalChartData.backtestParameters
      });

      setChartData(finalChartData);

      console.log('🎉 Switching to chart tab');
      setActiveTab('chart');
    } catch (err) {
      console.error('❌ Error in backtest:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      console.log('🏁 Backtest process completed');
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
          onClick={() => setActiveTab('parameters')}
        >
          <Settings size={18} />
          Parameters
        </button>
        <button
          className={`tab-button ${activeTab === 'chart' ? 'active' : ''}`}
          onClick={() => setActiveTab('chart')}
          disabled={!chartData}
        >
          <TrendingUp size={18} />
          Chart & Analysis
        </button>
        <button
          className={`tab-button ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
          disabled={!backtestData}
        >
          <Play size={18} />
          Results
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
            Running backtest analysis...
          </div>
        )}

        {activeTab === 'parameters' && (
          <div className="tab-content">
            <DCABacktestForm onSubmit={handleBacktestSubmit} loading={loading} />
          </div>
        )}

        {activeTab === 'chart' && chartData && (
          <div className="tab-content">
            <BacktestChart data={chartData} />
          </div>
        )}

        {activeTab === 'results' && backtestData && (
          <div className="tab-content">
            <BacktestResults data={backtestData} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
