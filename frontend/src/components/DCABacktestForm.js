import React, { useState, useEffect } from 'react';
import { Play, DollarSign, TrendingUp, Settings, Info, Zap, Target, ArrowUpDown } from 'lucide-react';

const DCABacktestForm = ({ onSubmit, loading, urlParams, currentTestMode, setAppTestMode }) => {

  const [parameters, setParameters] = useState({
    symbol: 'TSLA',
    startDate: '2021-09-01',
    endDate: '2025-09-01',
    lotSizeUsd: 10000,
    maxLots: 10,
    maxLotsToSell: 1,
    gridIntervalPercent: 10,
    profitRequirement: 5,
    trailingBuyActivationPercent: 10,
    trailingBuyReboundPercent: 5,
    trailingSellActivationPercent: 20,
    trailingSellPullbackPercent: 10
  });

  const [batchMode, setBatchMode] = useState(false);
  const [batchParameters, setBatchParameters] = useState({
    symbols: ['TSLA'],
    profitRequirement: [5],
    gridIntervalPercent: [10],
    trailingBuyActivationPercent: [10],
    trailingBuyReboundPercent: [5],
    trailingSellActivationPercent: [20],
    trailingSellPullbackPercent: [10]
  });

  const [availableSymbols, setAvailableSymbols] = useState([
    'TSLA', 'NVDA', 'AAPL', 'MSFT', 'AMZN', 'PLTR', 'U', 'META',
    'SHOP', 'TDOC', 'JD', 'BABA', 'LMND', 'NIO', 'KNDI', 'API'
  ]);

  const [newSymbol, setNewSymbol] = useState('');

  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [autoRunExecuted, setAutoRunExecuted] = useState(false);

  // Load persisted batch mode and parameters from localStorage
  useEffect(() => {
    try {
      const persistedBatchMode = localStorage.getItem('dca-batch-mode');
      const persistedBatchParameters = localStorage.getItem('dca-batch-parameters');
      const persistedParameters = localStorage.getItem('dca-single-parameters');

      if (persistedBatchMode !== null) {
        setBatchMode(persistedBatchMode === 'true');
      }

      if (persistedBatchParameters) {
        setBatchParameters(JSON.parse(persistedBatchParameters));
      }

      // Only restore persisted parameters if no URL parameters are present
      // URL parameters should always take priority over localStorage
      if (persistedParameters && (!urlParams || Object.keys(urlParams).length === 0)) {
        setParameters(JSON.parse(persistedParameters));
      }
    } catch (err) {
      console.warn('Failed to load persisted form state:', err);
    }
  }, [urlParams]); // Add urlParams dependency so this runs after URL params are available

  // Load default parameters from backend on component mount
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/backtest/defaults');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            // Convert decimal values to percentages for UI
            const uiParams = {
              ...result.data,
              gridIntervalPercent: (result.data.gridIntervalPercent || 0.1) * 100,
              profitRequirement: (result.data.profitRequirement || 0.05) * 100,
              trailingBuyActivationPercent: (result.data.trailingBuyActivationPercent || 0.1) * 100,
              trailingBuyReboundPercent: (result.data.trailingBuyReboundPercent || 0.05) * 100,
              trailingSellActivationPercent: (result.data.trailingSellActivationPercent || 0.2) * 100,
              trailingSellPullbackPercent: (result.data.trailingSellPullbackPercent || 0.1) * 100
            };

            // Always set defaults first, then URL parameters will override them
            setParameters(uiParams);
          }
        } else {
          console.warn('Failed to load defaults from backend, using hardcoded defaults');
        }
      } catch (error) {
        console.warn('Error loading defaults from backend:', error);
      } finally {
        setLoadingDefaults(false);
      }
    };

    loadDefaults();
  }, [urlParams]); // Add urlParams dependency so this runs after URL params are available

  // Handle URL parameters - populate form fields
  // This runs AFTER defaults are loaded to ensure URL params override defaults
  useEffect(() => {
    // Reset auto-run execution flag when URL parameters change
    if (urlParams && Object.keys(urlParams).length > 0) {
      setAutoRunExecuted(false);
    }

    // Only process URL parameters after defaults have finished loading
    if (urlParams && Object.keys(urlParams).length > 0 && !loadingDefaults) {
      // Map URL parameter names to form field names and convert types
      const urlParamMapping = {
        symbol: (value) => value,
        startDate: (value) => value,
        endDate: (value) => value,
        lotSizeUsd: (value) => parseInt(value) || 10000,
        maxLots: (value) => parseInt(value) || 10,
        maxLotsToSell: (value) => parseInt(value) || 1,
        gridIntervalPercent: (value) => parseFloat(value) || 10, // Values from BatchResults are already in percentage format
        profitRequirement: (value) => parseFloat(value) || 5, // Values from BatchResults are already in percentage format
        trailingBuyActivationPercent: (value) => parseFloat(value) || 10, // Values from BatchResults are already in percentage format
        trailingBuyReboundPercent: (value) => parseFloat(value) || 5, // Values from BatchResults are already in percentage format
        trailingSellActivationPercent: (value) => parseFloat(value) || 20, // Values from BatchResults are already in percentage format
        trailingSellPullbackPercent: (value) => parseFloat(value) || 10 // Values from BatchResults are already in percentage format
      };

      // Build updated parameters object
      const updatedParams = { ...parameters };
      let hasChanges = false;

      Object.keys(urlParamMapping).forEach(key => {
        if (urlParams[key] !== undefined && urlParams[key] !== null && urlParams[key] !== '') {
          updatedParams[key] = urlParamMapping[key](urlParams[key]);
          hasChanges = true;
        }
      });

      if (hasChanges) {
        setParameters(updatedParams);
      }

      // Set test mode based on URL parameter (only if explicitly provided)
      if (urlParams.mode === 'single') {
        setBatchMode(false);
      } else if (urlParams.mode === 'batch') {
        setBatchMode(true);
      }
    }
  }, [urlParams, loadingDefaults, parameters]); // Run when urlParams OR loadingDefaults change

  // Handle autoRun functionality
  useEffect(() => {
    if (urlParams && urlParams.autoRun === 'true' && !loadingDefaults && !loading && !autoRunExecuted) {
      console.log('Auto-run triggered');
      // Mark auto-run as executed to prevent multiple triggers
      setAutoRunExecuted(true);

      // Small delay to ensure form is populated
      setTimeout(() => {
        // Trigger form submission programmatically
        if (!batchMode) {
          // Convert percentages back to decimals for single backtest
          const backendParams = {
            ...parameters,
            gridIntervalPercent: parameters.gridIntervalPercent / 100,
            profitRequirement: parameters.profitRequirement / 100,
            trailingBuyActivationPercent: parameters.trailingBuyActivationPercent / 100,
            trailingBuyReboundPercent: parameters.trailingBuyReboundPercent / 100,
            trailingSellActivationPercent: parameters.trailingSellActivationPercent / 100,
            trailingSellPullbackPercent: parameters.trailingSellPullbackPercent / 100
          };
          onSubmit(backendParams, false); // false indicates single mode
        } else {
          console.log('Batch mode auto-run not implemented yet');
        }
      }, 500); // 500ms delay to ensure form is ready
    }
  }, [urlParams, loadingDefaults, loading, parameters, batchMode, onSubmit]); // Run when these values change

  // Persist batch mode to localStorage and sync with App.js
  useEffect(() => {
    localStorage.setItem('dca-batch-mode', batchMode.toString());

    // Sync with App.js testMode
    if (setAppTestMode) {
      setAppTestMode(batchMode ? 'batch' : 'single');
    }
  }, [batchMode, setAppTestMode]);

  // Persist batch parameters to localStorage
  useEffect(() => {
    localStorage.setItem('dca-batch-parameters', JSON.stringify(batchParameters));
  }, [batchParameters]);

  // Persist single parameters to localStorage
  useEffect(() => {
    localStorage.setItem('dca-single-parameters', JSON.stringify(parameters));
  }, [parameters]);

  // Add validation state
  const [validationErrors, setValidationErrors] = useState({});

  // Parameter validation function
  const validateParameters = () => {
    const errors = {};

    if (!batchMode) {
      // Single mode validation
      if (parameters.trailingBuyActivationPercent <= parameters.trailingBuyReboundPercent) {
        errors.trailingBuy = 'Trailing buy activation percentage must be greater than trailing buy rebound percentage';
      }
      if (parameters.trailingSellActivationPercent <= parameters.trailingSellPullbackPercent) {
        errors.trailingSell = 'Trailing sell activation percentage must be greater than trailing sell pullback percentage';
      }
    } else {
      // Batch mode validation - check if any selected combinations would be invalid
      const maxBuyActivation = Math.max(...batchParameters.trailingBuyActivationPercent);
      const minBuyRebound = Math.min(...batchParameters.trailingBuyReboundPercent);
      const maxSellActivation = Math.max(...batchParameters.trailingSellActivationPercent);
      const minSellPullback = Math.min(...batchParameters.trailingSellPullbackPercent);

      if (maxBuyActivation <= minBuyRebound) {
        errors.trailingBuyBatch = 'Selected trailing buy activation values must be greater than trailing buy rebound values';
      }
      if (maxSellActivation <= minSellPullback) {
        errors.trailingSellBatch = 'Selected trailing sell activation values must be greater than trailing sell pullback values';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate parameters before submission
    if (!validateParameters()) {
      return; // Don't submit if validation fails
    }

    if (batchMode) {
      // Convert percentage arrays to decimal arrays for batch testing
      const batchOptions = {
        parameterRanges: {
          symbols: batchParameters.symbols,
          profitRequirement: batchParameters.profitRequirement.map(p => p / 100),
          gridIntervalPercent: batchParameters.gridIntervalPercent.map(p => p / 100),
          trailingBuyActivationPercent: batchParameters.trailingBuyActivationPercent.map(p => p / 100),
          trailingBuyReboundPercent: batchParameters.trailingBuyReboundPercent.map(p => p / 100),
          trailingSellActivationPercent: batchParameters.trailingSellActivationPercent.map(p => p / 100),
          trailingSellPullbackPercent: batchParameters.trailingSellPullbackPercent.map(p => p / 100),
          // Fixed parameters from single mode
          startDate: parameters.startDate,
          endDate: parameters.endDate,
          lotSizeUsd: parameters.lotSizeUsd,
          maxLots: parameters.maxLots,
          maxLotsToSell: parameters.maxLotsToSell
        },
        sortBy: 'annualizedReturn'
      };
      onSubmit(batchOptions, true); // true indicates batch mode
    } else {
      // Convert percentages back to decimals for single backtest
      const backendParams = {
        ...parameters,
        gridIntervalPercent: parameters.gridIntervalPercent / 100,
        profitRequirement: parameters.profitRequirement / 100,
        trailingBuyActivationPercent: parameters.trailingBuyActivationPercent / 100,
        trailingBuyReboundPercent: parameters.trailingBuyReboundPercent / 100,
        trailingSellActivationPercent: parameters.trailingSellActivationPercent / 100,
        trailingSellPullbackPercent: parameters.trailingSellPullbackPercent / 100
      };
      onSubmit(backendParams, false); // false indicates single mode
    }
  };

  const handleChange = (field, value) => {
    setParameters(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear validation errors when values change and become valid
    if (field === 'trailingBuyActivationPercent' || field === 'trailingBuyReboundPercent') {
      const updatedParams = { ...parameters, [field]: value };
      if (updatedParams.trailingBuyActivationPercent > updatedParams.trailingBuyReboundPercent) {
        setValidationErrors(prev => ({ ...prev, trailingBuy: undefined }));
      }
    }
    if (field === 'trailingSellActivationPercent' || field === 'trailingSellPullbackPercent') {
      const updatedParams = { ...parameters, [field]: value };
      if (updatedParams.trailingSellActivationPercent > updatedParams.trailingSellPullbackPercent) {
        setValidationErrors(prev => ({ ...prev, trailingSell: undefined }));
      }
    }
  };

  const handleBatchParameterChange = (field, values) => {
    setBatchParameters(prev => ({
      ...prev,
      [field]: values
    }));
  };

  const handleSelectAll = (field, allValues) => {
    setBatchParameters(prev => ({
      ...prev,
      [field]: [...allValues]
    }));
  };

  const handleDeselectAll = (field) => {
    setBatchParameters(prev => ({
      ...prev,
      [field]: []
    }));
  };

  const generateRange = (min, max, step) => {
    const range = [];
    for (let i = min; i <= max; i += step) {
      range.push(Number(i.toFixed(2)));
    }
    return range;
  };

  const handleSymbolToggle = (symbol) => {
    setBatchParameters(prev => ({
      ...prev,
      symbols: prev.symbols.includes(symbol)
        ? prev.symbols.filter(s => s !== symbol)
        : [...prev.symbols, symbol]
    }));
  };

  const handleAddSymbol = () => {
    const symbol = newSymbol.trim().toUpperCase();
    if (symbol && !availableSymbols.includes(symbol)) {
      setAvailableSymbols(prev => [...prev, symbol]);
      setBatchParameters(prev => ({
        ...prev,
        symbols: [...prev.symbols, symbol]
      }));
      setNewSymbol('');
    }
  };

  const handleSelectAllSymbols = () => {
    setBatchParameters(prev => ({
      ...prev,
      symbols: [...availableSymbols]
    }));
  };

  const handleDeselectAllSymbols = () => {
    setBatchParameters(prev => ({
      ...prev,
      symbols: []
    }));
  };

  if (loadingDefaults) {
    return (
      <div className="loading-banner">
        <div className="loading-spinner"></div>
        Loading default parameters...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Mode Selection */}
      <div className="form-section">
        <h2 className="section-title">
          <Settings size={24} />
          Testing Mode
        </h2>
        <div className="mode-selection">
          <label className={`mode-option ${!batchMode ? 'active' : ''}`}>
            <input
              type="radio"
              checked={!batchMode}
              onChange={() => setBatchMode(false)}
            />
            <Target size={20} />
            <span>Single Backtest</span>
            <p>Test one parameter combination</p>
          </label>
          <label className={`mode-option ${batchMode ? 'active' : ''}`}>
            <input
              type="radio"
              checked={batchMode}
              onChange={() => setBatchMode(true)}
            />
            <Zap size={20} />
            <span>Batch Optimization</span>
            <p>Test multiple parameter combinations to find optimal settings</p>
          </label>
        </div>
      </div>

      {/* Stock & Time Period Section */}
      <div className="form-section">
        <h2 className="section-title">
          <TrendingUp size={24} />
          Stock & Time Period
        </h2>

        <div className="form-grid">
          {!batchMode ? (
            <>
              <div className="form-group">
                <label htmlFor="symbol">Stock Symbol</label>
                <select
                  id="symbol"
                  value={parameters.symbol}
                  onChange={(e) => handleChange('symbol', e.target.value)}
                  required
                >
                  {availableSymbols.map(symbol => (
                    <option key={symbol} value={symbol}>{symbol}</option>
                  ))}
                </select>
                <span className="form-help">Select stock symbol for backtest</span>
              </div>
              <div className="form-group">
                <label htmlFor="newSymbol">Add Custom Symbol</label>
                <div className="custom-symbol-input">
                  <input
                    id="newSymbol"
                    type="text"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    placeholder="Enter symbol (e.g., GOOGL)"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSymbol();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddSymbol}
                    disabled={!newSymbol.trim()}
                    className="add-symbol-button"
                  >
                    Add
                  </button>
                </div>
                <span className="form-help">Add new symbols to single and batch mode lists</span>
              </div>
            </>
          ) : (
            <div className="form-group symbols-selection">
              <label>Stock Symbols (Select one or more)</label>
              <div className="selection-controls">
                <button
                  type="button"
                  className="control-button"
                  onClick={handleSelectAllSymbols}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="control-button"
                  onClick={handleDeselectAllSymbols}
                >
                  Deselect All
                </button>
              </div>
              <div className="checkbox-grid">
                {availableSymbols.map(symbol => (
                  <label key={symbol} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={batchParameters.symbols.includes(symbol)}
                      onChange={() => handleSymbolToggle(symbol)}
                    />
                    <span>{symbol}</span>
                  </label>
                ))}
              </div>
              <span className="form-help">Selected: {batchParameters.symbols.join(', ')}</span>

              {/* Add Custom Symbol - Batch Mode */}
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label htmlFor="newSymbolBatch">Add Custom Symbol</label>
                <div className="custom-symbol-input">
                  <input
                    id="newSymbolBatch"
                    type="text"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    placeholder="Enter symbol (e.g., GOOGL)"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSymbol();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddSymbol}
                    disabled={!newSymbol.trim()}
                    className="add-symbol-button"
                  >
                    Add
                  </button>
                </div>
                <span className="form-help">New symbols will be automatically selected for batch testing</span>
              </div>
            </div>
          )}

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

      {/* Investment Parameters Section */}
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
            <label htmlFor="maxLotsToSell">Max Lots Per Sell</label>
            <input
              id="maxLotsToSell"
              type="number"
              value={parameters.maxLotsToSell}
              onChange={(e) => handleChange('maxLotsToSell', parseInt(e.target.value))}
              min="1"
              max={parameters.maxLots}
              required
            />
            <span className="form-help">Maximum lots to sell simultaneously</span>
          </div>
        </div>
      </div>

      {/* Strategy Parameters Section */}
      <div className="form-section">
        <h2 className="section-title">
          <ArrowUpDown size={24} />
          Strategy Parameters
        </h2>

        {!batchMode ? (
          // Single mode - individual inputs
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="profitRequirement">Profit Requirement (%)</label>
              <input
                id="profitRequirement"
                type="number"
                value={parameters.profitRequirement}
                onChange={(e) => handleChange('profitRequirement', parseFloat(e.target.value))}
                min="0"
                max="50"
                step="0.1"
                required
              />
              <span className="form-help">Minimum profit required before selling</span>
            </div>

            <div className="form-group">
              <label htmlFor="gridIntervalPercent">Grid Interval (%)</label>
              <input
                id="gridIntervalPercent"
                type="number"
                value={parameters.gridIntervalPercent}
                onChange={(e) => handleChange('gridIntervalPercent', parseFloat(e.target.value))}
                min="1"
                max="20"
                step="0.1"
                required
              />
              <span className="form-help">Minimum price difference between lots</span>
            </div>

            <div className="form-group">
              <label htmlFor="trailingBuyActivationPercent">Trailing Buy Activation (%)</label>
              <input
                id="trailingBuyActivationPercent"
                type="number"
                value={parameters.trailingBuyActivationPercent}
                onChange={(e) => handleChange('trailingBuyActivationPercent', parseFloat(e.target.value))}
                min="5"
                max="20"
                step="0.1"
                required
              />
              <span className="form-help">Price drop % from peak to activate trailing buy</span>
            </div>

            <div className="form-group">
              <label htmlFor="trailingBuyReboundPercent">Trailing Buy Rebound (%)</label>
              <input
                id="trailingBuyReboundPercent"
                type="number"
                value={parameters.trailingBuyReboundPercent}
                onChange={(e) => handleChange('trailingBuyReboundPercent', parseFloat(e.target.value))}
                min="0"
                max="10"
                step="0.1"
                required
              />
              <span className="form-help">Stop price % above current price for trailing buy</span>
            </div>

            {/* Trailing Buy Validation Error */}
            {validationErrors.trailingBuy && (
              <div className="validation-error">
                <strong>⚠️ Validation Error:</strong> {validationErrors.trailingBuy}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="trailingSellActivationPercent">Trailing Sell Activation (%)</label>
              <input
                id="trailingSellActivationPercent"
                type="number"
                value={parameters.trailingSellActivationPercent}
                onChange={(e) => handleChange('trailingSellActivationPercent', parseFloat(e.target.value))}
                min="5"
                max="50"
                step="0.1"
                required
              />
              <span className="form-help">Price rise % from bottom to activate trailing sell</span>
            </div>

            <div className="form-group">
              <label htmlFor="trailingSellPullbackPercent">Trailing Sell Pullback (%)</label>
              <input
                id="trailingSellPullbackPercent"
                type="number"
                value={parameters.trailingSellPullbackPercent}
                onChange={(e) => handleChange('trailingSellPullbackPercent', parseFloat(e.target.value))}
                min="0"
                max="20"
                step="0.1"
                required
              />
              <span className="form-help">Stop price % below current price for trailing sell</span>
            </div>

            {/* Trailing Sell Validation Error */}
            {validationErrors.trailingSell && (
              <div className="validation-error">
                <strong>⚠️ Validation Error:</strong> {validationErrors.trailingSell}
              </div>
            )}
          </div>
        ) : (
          // Batch mode - range selections
          <div className="batch-parameters">
            <div className="parameter-range">
              <label>Profit Requirement (%) - Range: 0 to 50, step 5</label>
              <div className="selection-controls">
                <button
                  type="button"
                  className="control-button"
                  onClick={() => handleSelectAll('profitRequirement', generateRange(0, 50, 5))}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="control-button"
                  onClick={() => handleDeselectAll('profitRequirement')}
                >
                  Deselect All
                </button>
              </div>
              <div className="checkbox-grid">
                {generateRange(0, 50, 5).map(val => (
                  <label key={val} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={batchParameters.profitRequirement.includes(val)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleBatchParameterChange('profitRequirement', [...batchParameters.profitRequirement, val]);
                        } else {
                          handleBatchParameterChange('profitRequirement', batchParameters.profitRequirement.filter(p => p !== val));
                        }
                      }}
                    />
                    <span>{val}%</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="parameter-range">
              <label>Grid Interval (%) - Range: 5 to 20, step 5</label>
              <div className="selection-controls">
                <button
                  type="button"
                  className="control-button"
                  onClick={() => handleSelectAll('gridIntervalPercent', generateRange(5, 20, 5))}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="control-button"
                  onClick={() => handleDeselectAll('gridIntervalPercent')}
                >
                  Deselect All
                </button>
              </div>
              <div className="checkbox-grid">
                {generateRange(5, 20, 5).map(val => (
                  <label key={val} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={batchParameters.gridIntervalPercent.includes(val)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleBatchParameterChange('gridIntervalPercent', [...batchParameters.gridIntervalPercent, val]);
                        } else {
                          handleBatchParameterChange('gridIntervalPercent', batchParameters.gridIntervalPercent.filter(p => p !== val));
                        }
                      }}
                    />
                    <span>{val}%</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="parameter-range">
              <label>Trailing Buy Activation (%) - Range: 5 to 20, step 5</label>
              <div className="selection-controls">
                <button
                  type="button"
                  className="control-button"
                  onClick={() => handleSelectAll('trailingBuyActivationPercent', generateRange(5, 20, 5))}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="control-button"
                  onClick={() => handleDeselectAll('trailingBuyActivationPercent')}
                >
                  Deselect All
                </button>
              </div>
              <div className="checkbox-grid">
                {generateRange(5, 20, 5).map(val => (
                  <label key={val} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={batchParameters.trailingBuyActivationPercent.includes(val)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleBatchParameterChange('trailingBuyActivationPercent', [...batchParameters.trailingBuyActivationPercent, val]);
                        } else {
                          handleBatchParameterChange('trailingBuyActivationPercent', batchParameters.trailingBuyActivationPercent.filter(p => p !== val));
                        }
                      }}
                    />
                    <span>{val}%</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="parameter-range">
              <label>Trailing Buy Rebound (%) - Range: 0 to 10, step 5</label>
              <div className="selection-controls">
                <button
                  type="button"
                  className="control-button"
                  onClick={() => handleSelectAll('trailingBuyReboundPercent', generateRange(0, 10, 5))}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="control-button"
                  onClick={() => handleDeselectAll('trailingBuyReboundPercent')}
                >
                  Deselect All
                </button>
              </div>
              <div className="checkbox-grid">
                {generateRange(0, 10, 5).map(val => (
                  <label key={val} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={batchParameters.trailingBuyReboundPercent.includes(val)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleBatchParameterChange('trailingBuyReboundPercent', [...batchParameters.trailingBuyReboundPercent, val]);
                        } else {
                          handleBatchParameterChange('trailingBuyReboundPercent', batchParameters.trailingBuyReboundPercent.filter(p => p !== val));
                        }
                      }}
                    />
                    <span>{val}%</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="parameter-range">
              <label>Trailing Sell Activation (%) - Range: 10 to 50, step 10</label>
              <div className="selection-controls">
                <button
                  type="button"
                  className="control-button"
                  onClick={() => handleSelectAll('trailingSellActivationPercent', generateRange(10, 50, 10))}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="control-button"
                  onClick={() => handleDeselectAll('trailingSellActivationPercent')}
                >
                  Deselect All
                </button>
              </div>
              <div className="checkbox-grid">
                {generateRange(10, 50, 10).map(val => (
                  <label key={val} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={batchParameters.trailingSellActivationPercent.includes(val)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleBatchParameterChange('trailingSellActivationPercent', [...batchParameters.trailingSellActivationPercent, val]);
                        } else {
                          handleBatchParameterChange('trailingSellActivationPercent', batchParameters.trailingSellActivationPercent.filter(p => p !== val));
                        }
                      }}
                    />
                    <span>{val}%</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="parameter-range">
              <label>Trailing Sell Pullback (%) - Range: 0 to 10, step 5</label>
              <div className="selection-controls">
                <button
                  type="button"
                  className="control-button"
                  onClick={() => handleSelectAll('trailingSellPullbackPercent', generateRange(0, 10, 5))}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="control-button"
                  onClick={() => handleDeselectAll('trailingSellPullbackPercent')}
                >
                  Deselect All
                </button>
              </div>
              <div className="checkbox-grid">
                {generateRange(0, 10, 5).map(val => (
                  <label key={val} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={batchParameters.trailingSellPullbackPercent.includes(val)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleBatchParameterChange('trailingSellPullbackPercent', [...batchParameters.trailingSellPullbackPercent, val]);
                        } else {
                          handleBatchParameterChange('trailingSellPullbackPercent', batchParameters.trailingSellPullbackPercent.filter(p => p !== val));
                        }
                      }}
                    />
                    <span>{val}%</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {batchMode && (
        <div className="batch-info">
          <div className="info-card">
            <Info size={20} />
            <div>
              <h4>Batch Testing Overview</h4>
              <p>
                Total combinations: {
                  batchParameters.symbols.length *
                  batchParameters.profitRequirement.length *
                  batchParameters.gridIntervalPercent.length *
                  batchParameters.trailingBuyActivationPercent.length *
                  batchParameters.trailingBuyReboundPercent.length *
                  batchParameters.trailingSellActivationPercent.length *
                  batchParameters.trailingSellPullbackPercent.length
                }
              </p>
              <p>
                The report will include: total return, annualized return, total trades, win rate,
                average profit per trade, maximum drawdown, capital utilization rate, and best
                parameter combinations for each stock.
              </p>
            </div>
          </div>

          {/* Batch Mode Validation Errors */}
          {validationErrors.trailingBuyBatch && (
            <div className="validation-error">
              <strong>⚠️ Validation Error:</strong> {validationErrors.trailingBuyBatch}
            </div>
          )}
          {validationErrors.trailingSellBatch && (
            <div className="validation-error">
              <strong>⚠️ Validation Error:</strong> {validationErrors.trailingSellBatch}
            </div>
          )}
        </div>
      )}

      {!batchMode && (
        <div className="strategy-info">
          <div className="info-card">
            <Info size={20} />
            <div>
              <h4>DCA Strategy Overview</h4>
              <p>
                This strategy uses Dollar Cost Averaging with parameterized trailing stops and profit requirements.
                It employs grid trading, dynamic stop-loss protection, and market condition filters to manage risk
                while building positions over time.
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        className="submit-button"
        disabled={loading || (batchMode && batchParameters.symbols.length === 0)}
      >
        {loading ? (
          <>
            <div className="loading-spinner"></div>
            {batchMode ? 'Running Batch Tests...' : 'Running Backtest...'}
          </>
        ) : (
          <>
            {batchMode ? <Zap size={20} /> : <Play size={20} />}
            {batchMode ? 'Run Batch Optimization' : 'Run DCA Backtest'}
          </>
        )}
      </button>
    </form>
  );
};

export default DCABacktestForm;