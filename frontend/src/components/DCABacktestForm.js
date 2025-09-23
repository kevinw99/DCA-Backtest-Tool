import React, { useState } from 'react';
import { Play, DollarSign, TrendingUp, Settings, Info } from 'lucide-react';

const DCABacktestForm = ({ onSubmit, loading }) => {
  const [parameters, setParameters] = useState({
    symbol: 'TSLA',
    startDate: '2021-11-01',
    endDate: '2023-11-01',
    lotSizeUsd: 10000,
    maxLots: 5,
    gridIntervalPercent: 10,
    remainingLotsLossTolerance: 5
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(parameters);
  };

  const handleChange = (field, value) => {
    setParameters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-section">
        <h2 className="section-title">
          <TrendingUp size={24} />
          Stock & Time Period
        </h2>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="symbol">Stock Symbol</label>
            <input
              id="symbol"
              type="text"
              value={parameters.symbol}
              onChange={(e) => handleChange('symbol', e.target.value.toUpperCase())}
              placeholder="TSLA"
              required
            />
            <span className="form-help">Enter a valid stock ticker symbol</span>
          </div>

          <div className="form-group">
            <label htmlFor="startDate">Start Date</label>
            <input
              id="startDate"
              type="date"
              value={parameters.startDate}
              onChange={(e) => handleChange('startDate', e.target.value)}
              required
            />
            <span className="form-help">Backtest period start date</span>
          </div>

          <div className="form-group">
            <label htmlFor="endDate">End Date</label>
            <input
              id="endDate"
              type="date"
              value={parameters.endDate}
              onChange={(e) => handleChange('endDate', e.target.value)}
              required
            />
            <span className="form-help">Backtest period end date</span>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2 className="section-title">
          <DollarSign size={24} />
          Investment Parameters
        </h2>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="lotSizeUsd">Lot Size (USD)</label>
            <input
              id="lotSizeUsd"
              type="number"
              value={parameters.lotSizeUsd}
              onChange={(e) => handleChange('lotSizeUsd', parseInt(e.target.value))}
              min="100"
              step="100"
              required
            />
            <span className="form-help">Amount invested per lot purchase</span>
          </div>

          <div className="form-group">
            <label htmlFor="maxLots">Maximum Lots</label>
            <input
              id="maxLots"
              type="number"
              value={parameters.maxLots}
              onChange={(e) => handleChange('maxLots', parseInt(e.target.value))}
              min="1"
              max="20"
              required
            />
            <span className="form-help">Maximum number of lots to hold</span>
          </div>

          <div className="form-group">
            <label htmlFor="gridIntervalPercent">Grid Interval (%)</label>
            <input
              id="gridIntervalPercent"
              type="number"
              value={parameters.gridIntervalPercent}
              onChange={(e) => handleChange('gridIntervalPercent', parseFloat(e.target.value))}
              min="1"
              max="50"
              step="0.1"
              required
            />
            <span className="form-help">Minimum price difference between lots</span>
          </div>

          <div className="form-group">
            <label htmlFor="remainingLotsLossTolerance">Loss Tolerance (%)</label>
            <input
              id="remainingLotsLossTolerance"
              type="number"
              value={parameters.remainingLotsLossTolerance}
              onChange={(e) => handleChange('remainingLotsLossTolerance', parseFloat(e.target.value))}
              min="1"
              max="20"
              step="0.1"
              required
            />
            <span className="form-help">Maximum loss tolerance for remaining lots</span>
          </div>
        </div>
      </div>

      <div className="strategy-info">
        <div className="info-card">
          <Info size={20} />
          <div>
            <h4>DCA Strategy Overview</h4>
            <p>
              This strategy uses Dollar Cost Averaging with technical indicators to optimize entry points.
              It employs grid trading, stop-loss protection, and market condition filters to manage risk
              while building positions over time.
            </p>
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="submit-button"
        disabled={loading}
      >
        {loading ? (
          <>
            <div className="loading-spinner"></div>
            Running Backtest...
          </>
        ) : (
          <>
            <Play size={20} />
            Run DCA Backtest
          </>
        )}
      </button>
    </form>
  );
};

export default DCABacktestForm;
