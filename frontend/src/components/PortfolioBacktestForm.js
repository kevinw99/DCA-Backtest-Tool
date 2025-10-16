import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Calendar, Settings, Play, RefreshCw } from 'lucide-react';
import StockSelector from './StockSelector';
import './PortfolioBacktestForm.css';

const PortfolioBacktestForm = ({ parameters, onParametersChange, onSubmit, loading }) => {
  const [validationErrors, setValidationErrors] = useState([]);

  const handleFieldChange = (field, value) => {
    onParametersChange({
      ...parameters,
      [field]: value
    });
  };

  const handleDefaultParamChange = (field, value) => {
    onParametersChange({
      ...parameters,
      defaultParams: {
        ...parameters.defaultParams,
        [field]: value
      }
    });
  };

  const handleStocksChange = (stocks) => {
    onParametersChange({
      ...parameters,
      stocks
    });
  };

  const validateForm = () => {
    const errors = [];

    if (!parameters.totalCapital || parameters.totalCapital <= 0) {
      errors.push({ field: 'totalCapital', message: 'Total capital must be a positive number' });
    }

    if (!parameters.lotSizeUsd || parameters.lotSizeUsd <= 0) {
      errors.push({ field: 'lotSizeUsd', message: 'Lot size must be a positive number' });
    }

    if (!parameters.maxLotsPerStock || parameters.maxLotsPerStock <= 0) {
      errors.push({ field: 'maxLotsPerStock', message: 'Max lots per stock must be a positive number' });
    }

    if (!parameters.stocks || parameters.stocks.length === 0) {
      errors.push({ field: 'stocks', message: 'Please select at least one stock' });
    }

    if (parameters.stocks && parameters.stocks.length > 20) {
      errors.push({ field: 'stocks', message: 'Maximum 20 stocks allowed' });
    }

    if (!parameters.startDate) {
      errors.push({ field: 'startDate', message: 'Start date is required' });
    }

    if (!parameters.endDate) {
      errors.push({ field: 'endDate', message: 'End date is required' });
    }

    if (parameters.startDate && parameters.endDate && new Date(parameters.startDate) >= new Date(parameters.endDate)) {
      errors.push({ field: 'dateRange', message: 'Start date must be before end date' });
    }

    if (parameters.defaultParams.gridIntervalPercent <= 0 || parameters.defaultParams.gridIntervalPercent > 100) {
      errors.push({ field: 'gridIntervalPercent', message: 'Grid interval must be between 0 and 100%' });
    }

    if (parameters.defaultParams.profitRequirement <= 0 || parameters.defaultParams.profitRequirement > 100) {
      errors.push({ field: 'profitRequirement', message: 'Profit requirement must be between 0 and 100%' });
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit();
    }
  };

  const handleReset = () => {
    // Preserve current dates - they are NOT parameters that should be reset
    onParametersChange({
      totalCapital: 500000,
      lotSizeUsd: 10000,
      maxLotsPerStock: 10,
      startDate: parameters.startDate,  // Preserve current start date
      endDate: parameters.endDate,      // Preserve current end date
      stocks: ['TSLA', 'AAPL', 'NVDA', 'MSFT'],
      defaultParams: {
        gridIntervalPercent: 10,
        profitRequirement: 10,
        stopLossPercent: 30,
        trailingBuyActivationPercent: 10,
        trailingBuyReboundPercent: 5,
        trailingSellActivationPercent: 20,
        trailingSellPullbackPercent: 10,
        enableTrailingBuy: false,
        enableTrailingSell: false,
        enableConsecutiveIncrementalBuyGrid: false,
        gridConsecutiveIncrement: 5,
        enableConsecutiveIncrementalSellProfit: false
      }
    });
    setValidationErrors([]);
  };

  const getFieldError = (field) => {
    const error = validationErrors.find(e => e.field === field);
    return error ? error.message : null;
  };

  return (
    <form className="portfolio-backtest-form" onSubmit={handleSubmit}>
      {validationErrors.length > 0 && (
        <div className="validation-errors">
          <h4>⚠️ Please fix the following errors:</h4>
          <ul>
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="form-section capital-settings">
        <h3>
          <DollarSign size={20} />
          Capital Settings
        </h3>

        <div className="input-grid">
          <div className="input-group">
            <label htmlFor="totalCapital">
              Total Capital ($)
              <span className="help-text">Total amount of capital available for the portfolio</span>
            </label>
            <input
              id="totalCapital"
              type="number"
              value={parameters.totalCapital}
              onChange={(e) => handleFieldChange('totalCapital', parseFloat(e.target.value) || 0)}
              className={getFieldError('totalCapital') ? 'error' : ''}
              step="1000"
              min="0"
            />
            {getFieldError('totalCapital') && (
              <span className="error-message">{getFieldError('totalCapital')}</span>
            )}
          </div>

          <div className="input-group">
            <label htmlFor="lotSizeUsd">
              Lot Size ($)
              <span className="help-text">Dollar amount per lot (typically $5,000 - $20,000)</span>
            </label>
            <input
              id="lotSizeUsd"
              type="number"
              value={parameters.lotSizeUsd}
              onChange={(e) => handleFieldChange('lotSizeUsd', parseFloat(e.target.value) || 0)}
              className={getFieldError('lotSizeUsd') ? 'error' : ''}
              step="1000"
              min="0"
            />
            {getFieldError('lotSizeUsd') && (
              <span className="error-message">{getFieldError('lotSizeUsd')}</span>
            )}
          </div>

          <div className="input-group">
            <label htmlFor="maxLotsPerStock">
              Max Lots Per Stock
              <span className="help-text">Maximum number of lots any single stock can hold</span>
            </label>
            <input
              id="maxLotsPerStock"
              type="number"
              value={parameters.maxLotsPerStock}
              onChange={(e) => handleFieldChange('maxLotsPerStock', parseInt(e.target.value) || 0)}
              className={getFieldError('maxLotsPerStock') ? 'error' : ''}
              min="1"
              max="100"
            />
            {getFieldError('maxLotsPerStock') && (
              <span className="error-message">{getFieldError('maxLotsPerStock')}</span>
            )}
          </div>
        </div>
      </section>

      <section className="form-section stock-selection">
        <h3>
          <TrendingUp size={20} />
          Stock Selection
        </h3>
        <StockSelector
          selectedStocks={parameters.stocks}
          onChange={handleStocksChange}
        />
        {getFieldError('stocks') && (
          <span className="error-message">{getFieldError('stocks')}</span>
        )}
      </section>

      <section className="form-section date-range">
        <h3>
          <Calendar size={20} />
          Date Range
        </h3>

        <div className="input-grid">
          <div className="input-group">
            <label htmlFor="startDate">Start Date</label>
            <input
              id="startDate"
              type="date"
              value={parameters.startDate}
              onChange={(e) => handleFieldChange('startDate', e.target.value)}
              className={getFieldError('startDate') || getFieldError('dateRange') ? 'error' : ''}
            />
          </div>

          <div className="input-group">
            <label htmlFor="endDate">End Date</label>
            <input
              id="endDate"
              type="date"
              value={parameters.endDate}
              onChange={(e) => handleFieldChange('endDate', e.target.value)}
              className={getFieldError('endDate') || getFieldError('dateRange') ? 'error' : ''}
            />
          </div>
        </div>
        {getFieldError('dateRange') && (
          <span className="error-message">{getFieldError('dateRange')}</span>
        )}
      </section>

      <section className="form-section dca-parameters">
        <h3>
          <Settings size={20} />
          Default DCA Parameters
          <span className="section-subtitle">Applied to all stocks in the portfolio</span>
        </h3>

        <div className="input-grid">
          <div className="input-group">
            <label htmlFor="gridIntervalPercent">
              Grid Interval (%)
              <span className="help-text">Price drop % to trigger next buy</span>
            </label>
            <input
              id="gridIntervalPercent"
              type="number"
              value={parameters.defaultParams.gridIntervalPercent}
              onChange={(e) => handleDefaultParamChange('gridIntervalPercent', parseFloat(e.target.value) || 0)}
              step="0.1"
              min="0"
              max="100"
            />
          </div>

          <div className="input-group">
            <label htmlFor="profitRequirement">
              Profit Requirement (%)
              <span className="help-text">Minimum profit % to trigger sell</span>
            </label>
            <input
              id="profitRequirement"
              type="number"
              value={parameters.defaultParams.profitRequirement}
              onChange={(e) => handleDefaultParamChange('profitRequirement', parseFloat(e.target.value) || 0)}
              step="0.1"
              min="0"
              max="100"
            />
          </div>

          <div className="input-group">
            <label htmlFor="stopLossPercent">
              Stop Loss (%)
              <span className="help-text">Maximum loss % before liquidation</span>
            </label>
            <input
              id="stopLossPercent"
              type="number"
              value={parameters.defaultParams.stopLossPercent || 30}
              onChange={(e) => handleDefaultParamChange('stopLossPercent', parseFloat(e.target.value) || 0)}
              step="0.1"
              min="0"
              max="100"
            />
          </div>

          <div className="input-group">
            <label htmlFor="trailingBuyActivationPercent">
              Trailing Buy Activation (%)
              <span className="help-text">Price drop % from peak to activate trailing buy</span>
            </label>
            <input
              id="trailingBuyActivationPercent"
              type="number"
              value={parameters.defaultParams.trailingBuyActivationPercent || 10}
              onChange={(e) => handleDefaultParamChange('trailingBuyActivationPercent', parseFloat(e.target.value) || 0)}
              step="0.1"
              min="0"
              max="100"
            />
          </div>

          <div className="input-group">
            <label htmlFor="trailingBuyReboundPercent">
              Trailing Buy Rebound (%)
              <span className="help-text">Stop price % above current price for trailing buy</span>
            </label>
            <input
              id="trailingBuyReboundPercent"
              type="number"
              value={parameters.defaultParams.trailingBuyReboundPercent || 5}
              onChange={(e) => handleDefaultParamChange('trailingBuyReboundPercent', parseFloat(e.target.value) || 0)}
              step="0.1"
              min="0"
              max="100"
            />
          </div>

          <div className="input-group">
            <label htmlFor="trailingSellActivationPercent">
              Trailing Sell Activation (%)
              <span className="help-text">Price rise % from bottom to activate trailing sell</span>
            </label>
            <input
              id="trailingSellActivationPercent"
              type="number"
              value={parameters.defaultParams.trailingSellActivationPercent || 20}
              onChange={(e) => handleDefaultParamChange('trailingSellActivationPercent', parseFloat(e.target.value) || 0)}
              step="0.1"
              min="0"
              max="100"
            />
          </div>

          <div className="input-group">
            <label htmlFor="trailingSellPullbackPercent">
              Trailing Sell Pullback (%)
              <span className="help-text">Price pullback % before selling</span>
            </label>
            <input
              id="trailingSellPullbackPercent"
              type="number"
              value={parameters.defaultParams.trailingSellPullbackPercent || 10}
              onChange={(e) => handleDefaultParamChange('trailingSellPullbackPercent', parseFloat(e.target.value) || 0)}
              step="0.1"
              min="0"
              max="100"
            />
          </div>
        </div>

        <div className="checkbox-grid">
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={parameters.defaultParams.enableTrailingBuy || false}
                onChange={(e) => handleDefaultParamChange('enableTrailingBuy', e.target.checked)}
              />
              Enable Trailing Buy
              <span className="help-text">Wait for price rebound before buying</span>
            </label>
          </div>

          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={parameters.defaultParams.enableTrailingSell || false}
                onChange={(e) => handleDefaultParamChange('enableTrailingSell', e.target.checked)}
              />
              Enable Trailing Sell
              <span className="help-text">Wait for price pullback before selling</span>
            </label>
          </div>

          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={parameters.defaultParams.enableConsecutiveIncrementalBuyGrid || false}
                onChange={(e) => handleDefaultParamChange('enableConsecutiveIncrementalBuyGrid', e.target.checked)}
              />
              Enable Consecutive Incremental Buy Grid
            </label>
          </div>

          {parameters.defaultParams.enableConsecutiveIncrementalBuyGrid && (
            <div className="input-group">
              <label htmlFor="gridConsecutiveIncrement">
                Grid Consecutive Increment (%)
                <span className="help-text">Grid consecutive increment %</span>
              </label>
              <input
                id="gridConsecutiveIncrement"
                type="number"
                value={parameters.defaultParams.gridConsecutiveIncrement ?? 5}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  handleDefaultParamChange('gridConsecutiveIncrement', isNaN(val) ? 0 : val);
                }}
                step="0.1"
                min="0"
                max="100"
              />
            </div>
          )}

          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={parameters.defaultParams.enableConsecutiveIncrementalSellProfit || false}
                onChange={(e) => handleDefaultParamChange('enableConsecutiveIncrementalSellProfit', e.target.checked)}
              />
              Enable Consecutive Incremental Sell Profit
            </label>
          </div>
        </div>
      </section>

      <div className="form-actions">
        <button type="button" onClick={handleReset} className="btn-reset" disabled={loading}>
          <RefreshCw size={18} />
          Reset to Defaults
        </button>
        <button type="submit" className="btn-submit" disabled={loading}>
          <Play size={18} />
          {loading ? 'Running Backtest...' : 'Run Portfolio Backtest'}
        </button>
      </div>
    </form>
  );
};

export default PortfolioBacktestForm;
