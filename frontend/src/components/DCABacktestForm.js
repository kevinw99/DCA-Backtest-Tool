import React, { useState, useEffect } from 'react';
import { Play, DollarSign, TrendingUp, Settings, Info, Zap, Target, ArrowUpDown } from 'lucide-react';

const DCABacktestForm = ({ onSubmit, loading, urlParams, currentTestMode, setAppTestMode }) => {

  const [strategyMode, setStrategyMode] = useState('long'); // 'long' or 'short'

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

  // Short selling specific parameters
  const [shortParameters, setShortParameters] = useState({
    symbol: 'TSLA',
    startDate: '2021-09-01',
    endDate: '2025-09-01',
    lotSizeUsd: 10000,
    maxShorts: 6,
    maxShortsToCovers: 3,
    gridIntervalPercent: 15,
    profitRequirement: 8,
    trailingShortActivationPercent: 25,
    trailingShortPullbackPercent: 15,
    trailingCoverActivationPercent: 20,
    trailingCoverReboundPercent: 10,
    hardStopLossPercent: 30,
    portfolioStopLossPercent: 25,
    cascadeStopLossPercent: 35
  });

  const [batchMode, setBatchMode] = useState(false);
  const [batchParameters, setBatchParameters] = useState({
    symbols: ['TSLA'],
    betaValues: [1.0],
    enableBetaScaling: false,
    profitRequirement: [5],
    gridIntervalPercent: [10],
    trailingBuyActivationPercent: [10],
    trailingBuyReboundPercent: [5],
    trailingSellActivationPercent: [20],
    trailingSellPullbackPercent: [10]
  });

  // Short selling batch parameters
  const [shortBatchParameters, setShortBatchParameters] = useState({
    symbols: ['TSLA'],
    profitRequirement: [8],
    gridIntervalPercent: [15],
    trailingShortActivationPercent: [25],
    trailingShortPullbackPercent: [15],
    trailingCoverActivationPercent: [20],
    trailingCoverReboundPercent: [10],
    hardStopLossPercent: [30],
    portfolioStopLossPercent: [25],
    cascadeStopLossPercent: [35]
  });

  const [availableSymbols, setAvailableSymbols] = useState([
    'TSLA', 'NVDA', 'AAPL', 'MSFT', 'AMZN', 'PLTR', 'U', 'META',
    'SHOP', 'TDOC', 'JD', 'BABA', 'LMND', 'NIO', 'KNDI', 'API'
  ]);

  const [newSymbol, setNewSymbol] = useState('');

  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [autoRunExecuted, setAutoRunExecuted] = useState(false);

  // Beta-related state - moved before useEffect hooks to avoid initialization errors
  const [beta, setBeta] = useState(1.0);
  const [isManualBetaOverride, setIsManualBetaOverride] = useState(false);
  const [enableBetaScaling, setEnableBetaScaling] = useState(false);
  const [betaError, setBetaError] = useState(null);
  const [betaLoading, setBetaLoading] = useState(false);
  const [baseParameters, setBaseParameters] = useState({});
  const [adjustedParameters, setAdjustedParameters] = useState({});

  // Add validation state
  const [validationErrors, setValidationErrors] = useState({});

  // Load persisted batch mode and parameters from localStorage
  useEffect(() => {
    try {
      const persistedStrategyMode = localStorage.getItem('dca-strategy-mode');
      const persistedBatchMode = localStorage.getItem('dca-batch-mode');
      const persistedBatchParameters = localStorage.getItem('dca-batch-parameters');
      const persistedShortBatchParameters = localStorage.getItem('dca-short-batch-parameters');
      const persistedParameters = localStorage.getItem('dca-single-parameters');
      const persistedShortParameters = localStorage.getItem('dca-short-single-parameters');

      if (persistedStrategyMode) {
        setStrategyMode(persistedStrategyMode);
      }

      if (persistedBatchMode !== null) {
        setBatchMode(persistedBatchMode === 'true');
      }

      if (persistedBatchParameters) {
        setBatchParameters(JSON.parse(persistedBatchParameters));
      }

      if (persistedShortBatchParameters) {
        setShortBatchParameters(JSON.parse(persistedShortBatchParameters));
      }

      // Only restore persisted parameters if no URL parameters are present
      // URL parameters should always take priority over localStorage
      if (persistedParameters && (!urlParams || Object.keys(urlParams).length === 0)) {
        setParameters(JSON.parse(persistedParameters));
      }

      if (persistedShortParameters && (!urlParams || Object.keys(urlParams).length === 0)) {
        setShortParameters(JSON.parse(persistedShortParameters));
      }
    } catch (err) {
      console.warn('Failed to load persisted form state:', err);
    }
  }, [urlParams]); // Add urlParams dependency so this runs after URL params are available

  // Load default parameters from backend on component mount
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const response = await fetch('http://localhost:3003/api/backtest/defaults');
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

  // Persist strategy mode to localStorage
  useEffect(() => {
    localStorage.setItem('dca-strategy-mode', strategyMode);
  }, [strategyMode]);

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

  // Persist short batch parameters to localStorage
  useEffect(() => {
    localStorage.setItem('dca-short-batch-parameters', JSON.stringify(shortBatchParameters));
  }, [shortBatchParameters]);

  // Persist single parameters to localStorage
  useEffect(() => {
    localStorage.setItem('dca-single-parameters', JSON.stringify(parameters));
  }, [parameters]);

  // Persist short single parameters to localStorage
  useEffect(() => {
    localStorage.setItem('dca-short-single-parameters', JSON.stringify(shortParameters));
  }, [shortParameters]);

  // Fetch Beta data when symbol changes
  useEffect(() => {
    if (!batchMode && strategyMode === 'long') {
      const currentSymbol = parameters.symbol;
      if (currentSymbol && !isManualBetaOverride) {
        fetchBetaData(currentSymbol);
      }
    }
  }, [parameters.symbol, strategyMode, batchMode, isManualBetaOverride]);

  // Recalculate adjusted parameters when Beta scaling is toggled or Beta changes
  useEffect(() => {
    const updateParameters = async () => {
      if (enableBetaScaling && beta && strategyMode === 'long') {
        await calculateAdjustedParameters(beta);
      }
    };
    
    updateParameters();
  }, [enableBetaScaling, beta, strategyMode]);


  // Parameter validation function
  const validateParameters = () => {
    const errors = {};

    if (!batchMode) {
      // Single mode validation
      if (strategyMode === 'short') {
        // Short selling validation
        if (shortParameters.trailingShortActivationPercent <= shortParameters.trailingShortPullbackPercent) {
          errors.trailingShort = 'Trailing short activation percentage must be greater than trailing short pullback percentage';
        }
        if (shortParameters.trailingCoverActivationPercent <= shortParameters.trailingCoverReboundPercent) {
          errors.trailingCover = 'Trailing cover activation percentage must be greater than trailing cover rebound percentage';
        }
      } else {
        // Long DCA validation
        if (parameters.trailingBuyActivationPercent <= parameters.trailingBuyReboundPercent) {
          errors.trailingBuy = 'Trailing buy activation percentage must be greater than trailing buy rebound percentage';
        }
        if (parameters.trailingSellActivationPercent <= parameters.trailingSellPullbackPercent) {
          errors.trailingSell = 'Trailing sell activation percentage must be greater than trailing sell pullback percentage';
        }
      }

      // Beta-adjusted parameter validation (only for long strategy)
      if (enableBetaScaling && strategyMode === 'long') {
        if (parameters.profitRequirement > 20) {
          errors.betaProfitRequirement = 'Beta-adjusted profit requirement exceeds 20% - consider manual override';
        }
        if (parameters.gridIntervalPercent > 50) {
          errors.betaGridInterval = 'Beta-adjusted grid interval exceeds 50% - may reduce trading frequency';
        }
        if (parameters.trailingSellActivationPercent > 60) {
          errors.betaTrailingSell = 'Beta-adjusted trailing sell activation exceeds 60% - may be too aggressive';
        }
        if (parameters.trailingBuyActivationPercent > 40) {
          errors.betaTrailingBuy = 'Beta-adjusted trailing buy activation exceeds 40% - may miss opportunities';
        }
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

    if (strategyMode === 'short') {
      // Short selling strategy
      if (batchMode) {
        // Short batch mode - not yet implemented
        console.log('Short batch mode not yet implemented');
        return;
      } else {
        // Short single mode
        const shortBackendParams = {
          ...shortParameters,
          gridIntervalPercent: shortParameters.gridIntervalPercent / 100,
          profitRequirement: shortParameters.profitRequirement / 100,
          trailingShortActivationPercent: shortParameters.trailingShortActivationPercent / 100,
          trailingShortPullbackPercent: shortParameters.trailingShortPullbackPercent / 100,
          trailingCoverActivationPercent: shortParameters.trailingCoverActivationPercent / 100,
          trailingCoverReboundPercent: shortParameters.trailingCoverReboundPercent / 100,
          hardStopLossPercent: shortParameters.hardStopLossPercent / 100,
          portfolioStopLossPercent: shortParameters.portfolioStopLossPercent / 100,
          cascadeStopLossPercent: shortParameters.cascadeStopLossPercent / 100
        };
        onSubmit(shortBackendParams, false, 'short'); // Third parameter indicates short mode
        return;
      }
    }

    // Long DCA strategy (existing logic)
    if (batchMode) {
      // Convert percentage arrays to decimal arrays for batch testing
      const batchOptions = {
        parameterRanges: {
          symbols: batchParameters.symbols,
          betaValues: batchParameters.betaValues,
          enableBetaScaling: batchParameters.enableBetaScaling,
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
        trailingSellPullbackPercent: parameters.trailingSellPullbackPercent / 100,
        // Add Beta information
        beta: beta,
        enableBetaScaling: enableBetaScaling,
        isManualBetaOverride: isManualBetaOverride
      };
      onSubmit(backendParams, false); // false indicates single mode
    }
  };

  const handleChange = (field, value) => {
    if (strategyMode === 'short') {
      setShortParameters(prev => ({
        ...prev,
        [field]: value
      }));

      // Clear validation errors for short parameters
      if (field === 'trailingShortActivationPercent' || field === 'trailingShortPullbackPercent') {
        const updatedParams = { ...shortParameters, [field]: value };
        if (updatedParams.trailingShortActivationPercent > updatedParams.trailingShortPullbackPercent) {
          setValidationErrors(prev => ({ ...prev, trailingShort: undefined }));
        }
      }
      if (field === 'trailingCoverActivationPercent' || field === 'trailingCoverReboundPercent') {
        const updatedParams = { ...shortParameters, [field]: value };
        if (updatedParams.trailingCoverActivationPercent > updatedParams.trailingCoverReboundPercent) {
          setValidationErrors(prev => ({ ...prev, trailingCover: undefined }));
        }
      }
    } else {
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

  // Beta-related functions
  const fetchBetaData = async (symbol) => {
    if (!symbol || isManualBetaOverride || strategyMode !== 'long') return;
    
    setBetaLoading(true);
    setBetaError(null);
    
    try {
      const response = await fetch(`http://localhost:3001/api/stocks/${symbol}/beta`);
      const data = await response.json();
      
      if (response.ok || response.status === 206) { // 206 = Partial Content (with warnings)
        setBeta(data.beta);
        if (enableBetaScaling) {
          calculateAdjustedParameters(data.beta);
        }
      } else {
        setBetaError(data.message || 'Failed to fetch Beta data');
        setBeta(1.0); // Default to 1.0 on error
        if (enableBetaScaling) {
          calculateAdjustedParameters(1.0);
        }
      }
    } catch (error) {
      console.error('Error fetching Beta data:', error);
      setBetaError('Network error fetching Beta data');
      setBeta(1.0); // Default to 1.0 on error
      if (enableBetaScaling) {
        calculateAdjustedParameters(1.0);
      }
    } finally {
      setBetaLoading(false);
    }
  };

  const calculateAdjustedParameters = async (betaValue) => {
    if (!enableBetaScaling || strategyMode !== 'long') {
      setAdjustedParameters({});
      return;
    }

    // Store base parameters before any Beta adjustments
    const baseParams = {
      profitRequirement: 0.05, // 5% base
      gridIntervalPercent: 0.1, // 10% base
      trailingBuyActivationPercent: 0.1, // 10% base
      trailingBuyReboundPercent: 0.05, // 5% base
      trailingSellActivationPercent: 0.2, // 20% base
      trailingSellPullbackPercent: 0.1 // 10% base
    };

    setBaseParameters(baseParams);

    try {
      const response = await fetch('http://localhost:3003/api/backtest/beta-parameters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          beta: betaValue,
          baseParameters: baseParams,
          enableBetaScaling: true
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setAdjustedParameters(data.adjustedParameters);
        
        // Update form parameters with adjusted values
        const adjustedForUI = {
          profitRequirement: data.adjustedParameters.profitRequirement * 100,
          gridIntervalPercent: data.adjustedParameters.gridIntervalPercent * 100,
          trailingBuyActivationPercent: data.adjustedParameters.trailingBuyActivationPercent * 100,
          trailingBuyReboundPercent: data.adjustedParameters.trailingBuyReboundPercent * 100,
          trailingSellActivationPercent: data.adjustedParameters.trailingSellActivationPercent * 100,
          trailingSellPullbackPercent: data.adjustedParameters.trailingSellPullbackPercent * 100
        };

        setParameters(prev => ({
          ...prev,
          ...adjustedForUI
        }));

        // Validate adjusted parameters and set warnings
        validateAdjustedParameters(adjustedForUI);
      } else {
        setBetaError(data.message || 'Failed to calculate adjusted parameters');
      }
    } catch (error) {
      console.error('Error calculating adjusted parameters:', error);
      setBetaError('Network error calculating adjusted parameters');
    }
  };

  // Validate Beta-adjusted parameters and set warnings
  const validateAdjustedParameters = (adjustedParams) => {
    const warnings = {};
    
    if (adjustedParams.profitRequirement > 20) {
      warnings.betaProfitRequirement = 'Beta-adjusted profit requirement exceeds 20% - consider manual override';
    }
    if (adjustedParams.gridIntervalPercent > 50) {
      warnings.betaGridInterval = 'Beta-adjusted grid interval exceeds 50% - may reduce trading frequency';
    }
    if (adjustedParams.trailingSellActivationPercent > 60) {
      warnings.betaTrailingSell = 'Beta-adjusted trailing sell activation exceeds 60% - may be too aggressive';
    }
    if (adjustedParams.trailingBuyActivationPercent > 40) {
      warnings.betaTrailingBuy = 'Beta-adjusted trailing buy activation exceeds 40% - may miss opportunities';
    }

    setValidationErrors(prev => ({
      ...prev,
      ...warnings
    }));
  };

  const handleBetaChange = (newBeta) => {
    setBeta(newBeta);
    calculateAdjustedParameters(newBeta);
  };

  const handleToggleBetaScaling = (enabled) => {
    setEnableBetaScaling(enabled);
    
    if (enabled && strategyMode === 'long') {
      calculateAdjustedParameters(beta);
    } else {
      // Reset to base parameters when Beta scaling is disabled
      setAdjustedParameters({});
      
      // Clear Beta-related validation errors
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.betaProfitRequirement;
        delete newErrors.betaGridInterval;
        delete newErrors.betaTrailingSell;
        delete newErrors.betaTrailingBuy;
        return newErrors;
      });
      
      // Restore base parameter values
      const baseForUI = {
        profitRequirement: 5, // 5%
        gridIntervalPercent: 10, // 10%
        trailingBuyActivationPercent: 10, // 10%
        trailingBuyReboundPercent: 5, // 5%
        trailingSellActivationPercent: 20, // 20%
        trailingSellPullbackPercent: 10 // 10%
      };

      setParameters(prev => ({
        ...prev,
        ...baseForUI
      }));
    }
  };

  const handleToggleManualBetaOverride = (isManual) => {
    setIsManualBetaOverride(isManual);
    
    if (!isManual) {
      // Fetch Beta data when switching back to automatic
      const currentSymbol = strategyMode === 'short' ? shortParameters.symbol : parameters.symbol;
      fetchBetaData(currentSymbol);
    }
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
      {/* Strategy Selection */}
      <div className="form-section">
        <h2 className="section-title">
          <ArrowUpDown size={24} />
          Strategy Type
        </h2>
        <div className="mode-selection">
          <label className={`mode-option ${strategyMode === 'long' ? 'active' : ''}`}>
            <input
              type="radio"
              checked={strategyMode === 'long'}
              onChange={() => setStrategyMode('long')}
            />
            <TrendingUp size={20} />
            <span>Long DCA</span>
            <p>Buy low, sell high - traditional DCA strategy</p>
          </label>
          <label className={`mode-option ${strategyMode === 'short' ? 'active' : ''}`}>
            <input
              type="radio"
              checked={strategyMode === 'short'}
              onChange={() => setStrategyMode('short')}
            />
            <ArrowUpDown size={20} />
            <span>Short DCA ⚠️</span>
            <p>Sell high, buy low - higher risk, unlimited loss potential</p>
          </label>
        </div>
      </div>

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
                  value={strategyMode === 'short' ? shortParameters.symbol : parameters.symbol}
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
              value={strategyMode === 'short' ? shortParameters.startDate : parameters.startDate}
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
              value={strategyMode === 'short' ? shortParameters.endDate : parameters.endDate}
              onChange={(e) => handleChange('endDate', e.target.value)}
              required
            />
            <span className="form-help">Backtest period end date</span>
          </div>
        </div>
      </div>

      {/* Beta Controls removed - component not available */}

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
              value={strategyMode === 'short' ? shortParameters.lotSizeUsd : parameters.lotSizeUsd}
              onChange={(e) => handleChange('lotSizeUsd', parseInt(e.target.value))}
              min="100"
              step="100"
              required
            />
            <span className="form-help">{strategyMode === 'short' ? 'Amount per short position' : 'Amount invested per lot purchase'}</span>
          </div>

          {strategyMode === 'short' ? (
            <>
              <div className="form-group">
                <label htmlFor="maxShorts">Maximum Shorts</label>
                <input
                  id="maxShorts"
                  type="number"
                  value={shortParameters.maxShorts}
                  onChange={(e) => handleChange('maxShorts', parseInt(e.target.value))}
                  min="1"
                  max="10"
                  required
                />
                <span className="form-help">Maximum number of short positions to hold</span>
              </div>

              <div className="form-group">
                <label htmlFor="maxShortsToCovers">Max Shorts Per Cover</label>
                <input
                  id="maxShortsToCovers"
                  type="number"
                  value={shortParameters.maxShortsToCovers}
                  onChange={(e) => handleChange('maxShortsToCovers', parseInt(e.target.value))}
                  min="1"
                  max={shortParameters.maxShorts}
                  required
                />
                <span className="form-help">Maximum shorts to cover simultaneously</span>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
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
            {strategyMode === 'short' ? (
              // Short selling parameters
              <>
                <div className="form-group">
                  <label htmlFor="profitRequirement">Profit Requirement (%)</label>
                  <input
                    id="profitRequirement"
                    type="number"
                    value={shortParameters.profitRequirement}
                    onChange={(e) => handleChange('profitRequirement', parseFloat(e.target.value))}
                    min="0"
                    max="50"
                    step="0.1"
                    required
                  />
                  <span className="form-help">Minimum profit required before covering shorts</span>
                </div>

                <div className="form-group">
                  <label htmlFor="gridIntervalPercent">Grid Interval (%)</label>
                  <input
                    id="gridIntervalPercent"
                    type="number"
                    value={shortParameters.gridIntervalPercent}
                    onChange={(e) => handleChange('gridIntervalPercent', parseFloat(e.target.value))}
                    min="1"
                    max="30"
                    step="0.1"
                    required
                  />
                  <span className="form-help">Minimum price difference between short positions</span>
                </div>

                <div className="form-group">
                  <label htmlFor="trailingShortActivationPercent">Trailing Short Activation (%)</label>
                  <input
                    id="trailingShortActivationPercent"
                    type="number"
                    value={shortParameters.trailingShortActivationPercent}
                    onChange={(e) => handleChange('trailingShortActivationPercent', parseFloat(e.target.value))}
                    min="10"
                    max="50"
                    step="0.1"
                    required
                  />
                  <span className="form-help">Price rise % from bottom to activate trailing short</span>
                </div>

                <div className="form-group">
                  <label htmlFor="trailingShortPullbackPercent">Trailing Short Pullback (%)</label>
                  <input
                    id="trailingShortPullbackPercent"
                    type="number"
                    value={shortParameters.trailingShortPullbackPercent}
                    onChange={(e) => handleChange('trailingShortPullbackPercent', parseFloat(e.target.value))}
                    min="5"
                    max="25"
                    step="0.1"
                    required
                  />
                  <span className="form-help">Stop price % below current price for trailing short</span>
                </div>

                {/* Trailing Short Validation Error */}
                {validationErrors.trailingShort && (
                  <div className="validation-error">
                    <strong>⚠️ Validation Error:</strong> {validationErrors.trailingShort}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="trailingCoverActivationPercent">Trailing Cover Activation (%)</label>
                  <input
                    id="trailingCoverActivationPercent"
                    type="number"
                    value={shortParameters.trailingCoverActivationPercent}
                    onChange={(e) => handleChange('trailingCoverActivationPercent', parseFloat(e.target.value))}
                    min="10"
                    max="40"
                    step="0.1"
                    required
                  />
                  <span className="form-help">Price fall % from peak to activate trailing cover</span>
                </div>

                <div className="form-group">
                  <label htmlFor="trailingCoverReboundPercent">Trailing Cover Rebound (%)</label>
                  <input
                    id="trailingCoverReboundPercent"
                    type="number"
                    value={shortParameters.trailingCoverReboundPercent}
                    onChange={(e) => handleChange('trailingCoverReboundPercent', parseFloat(e.target.value))}
                    min="5"
                    max="20"
                    step="0.1"
                    required
                  />
                  <span className="form-help">Stop price % above current price for trailing cover</span>
                </div>

                {/* Trailing Cover Validation Error */}
                {validationErrors.trailingCover && (
                  <div className="validation-error">
                    <strong>⚠️ Validation Error:</strong> {validationErrors.trailingCover}
                  </div>
                )}

                {/* Short-specific Stop Loss Parameters */}
                <div className="form-group">
                  <label htmlFor="hardStopLossPercent">Hard Stop Loss (%)</label>
                  <input
                    id="hardStopLossPercent"
                    type="number"
                    value={shortParameters.hardStopLossPercent}
                    onChange={(e) => handleChange('hardStopLossPercent', parseFloat(e.target.value))}
                    min="10"
                    max="50"
                    step="1"
                    required
                  />
                  <span className="form-help">Individual position loss % that triggers automatic cover</span>
                </div>

                <div className="form-group">
                  <label htmlFor="portfolioStopLossPercent">Portfolio Stop Loss (%)</label>
                  <input
                    id="portfolioStopLossPercent"
                    type="number"
                    value={shortParameters.portfolioStopLossPercent}
                    onChange={(e) => handleChange('portfolioStopLossPercent', parseFloat(e.target.value))}
                    min="15"
                    max="40"
                    step="1"
                    required
                  />
                  <span className="form-help">Total portfolio loss % that triggers partial liquidation</span>
                </div>

                <div className="form-group">
                  <label htmlFor="cascadeStopLossPercent">Cascade Stop Loss (%)</label>
                  <input
                    id="cascadeStopLossPercent"
                    type="number"
                    value={shortParameters.cascadeStopLossPercent}
                    onChange={(e) => handleChange('cascadeStopLossPercent', parseFloat(e.target.value))}
                    min="20"
                    max="50"
                    step="1"
                    required
                  />
                  <span className="form-help">Individual loss % that triggers full position liquidation</span>
                </div>

                {/* Risk Warning for Short Selling */}
                <div className="validation-error" style={{backgroundColor: '#ffebee', border: '1px solid #f44336'}}>
                  <strong>⚠️ RISK WARNING:</strong> Short selling involves unlimited loss potential. These stop-loss parameters are critical for risk management.
                </div>
              </>
            ) : (
              // Long DCA parameters
              <>
                <div className="form-group">
                  <label htmlFor="profitRequirement">
                    Profit Requirement (%)
                    {enableBetaScaling && <span className="beta-adjusted-indicator" title="Beta-adjusted parameter">β</span>}
                  </label>
                  <input
                    id="profitRequirement"
                    type="number"
                    value={parameters.profitRequirement}
                    onChange={(e) => handleChange('profitRequirement', parseFloat(e.target.value))}
                    min="0"
                    max="50"
                    step="0.1"
                    required
                    disabled={enableBetaScaling}
                  />
                  <span className="form-help">
                    {enableBetaScaling 
                      ? `Automatically calculated: ${(0.05 * beta * 100).toFixed(1)}% (5% × ${beta.toFixed(1)} Beta)`
                      : 'Minimum profit required before selling'
                    }
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="gridIntervalPercent">
                    Grid Interval (%)
                    {enableBetaScaling && <span className="beta-adjusted-indicator" title="Beta-adjusted parameter">β</span>}
                  </label>
                  <input
                    id="gridIntervalPercent"
                    type="number"
                    value={parameters.gridIntervalPercent}
                    onChange={(e) => handleChange('gridIntervalPercent', parseFloat(e.target.value))}
                    min="1"
                    max="20"
                    step="0.1"
                    required
                    disabled={enableBetaScaling}
                  />
                  <span className="form-help">
                    {enableBetaScaling 
                      ? `Automatically calculated: ${(0.1 * beta * 100).toFixed(1)}% (10% × ${beta.toFixed(1)} Beta)`
                      : 'Minimum price difference between lots'
                    }
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="trailingBuyActivationPercent">
                    Trailing Buy Activation (%)
                    {enableBetaScaling && <span className="beta-adjusted-indicator" title="Beta-adjusted parameter">β</span>}
                  </label>
                  <input
                    id="trailingBuyActivationPercent"
                    type="number"
                    value={parameters.trailingBuyActivationPercent}
                    onChange={(e) => handleChange('trailingBuyActivationPercent', parseFloat(e.target.value))}
                    min="5"
                    max="20"
                    step="0.1"
                    required
                    disabled={enableBetaScaling}
                  />
                  <span className="form-help">
                    {enableBetaScaling 
                      ? `Automatically calculated: ${(0.1 * beta * 100).toFixed(1)}% (10% × ${beta.toFixed(1)} Beta)`
                      : 'Price drop % from peak to activate trailing buy'
                    }
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="trailingBuyReboundPercent">
                    Trailing Buy Rebound (%)
                    {enableBetaScaling && <span className="beta-adjusted-indicator" title="Beta-adjusted parameter">β</span>}
                  </label>
                  <input
                    id="trailingBuyReboundPercent"
                    type="number"
                    value={parameters.trailingBuyReboundPercent}
                    onChange={(e) => handleChange('trailingBuyReboundPercent', parseFloat(e.target.value))}
                    min="0"
                    max="10"
                    step="0.1"
                    required
                    disabled={enableBetaScaling}
                  />
                  <span className="form-help">
                    {enableBetaScaling 
                      ? `Automatically calculated: ${(0.05 * beta * 100).toFixed(1)}% (5% × ${beta.toFixed(1)} Beta)`
                      : 'Stop price % above current price for trailing buy'
                    }
                  </span>
                </div>

                {/* Trailing Buy Validation Error */}
                {validationErrors.trailingBuy && (
                  <div className="validation-error">
                    <strong>⚠️ Validation Error:</strong> {validationErrors.trailingBuy}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="trailingSellActivationPercent">
                    Trailing Sell Activation (%)
                    {enableBetaScaling && <span className="beta-adjusted-indicator" title="Beta-adjusted parameter">β</span>}
                  </label>
                  <input
                    id="trailingSellActivationPercent"
                    type="number"
                    value={parameters.trailingSellActivationPercent}
                    onChange={(e) => handleChange('trailingSellActivationPercent', parseFloat(e.target.value))}
                    min="5"
                    max="50"
                    step="0.1"
                    required
                    disabled={enableBetaScaling}
                  />
                  <span className="form-help">
                    {enableBetaScaling 
                      ? `Automatically calculated: ${(0.2 * beta * 100).toFixed(1)}% (20% × ${beta.toFixed(1)} Beta)`
                      : 'Price rise % from bottom to activate trailing sell'
                    }
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="trailingSellPullbackPercent">
                    Trailing Sell Pullback (%)
                    {enableBetaScaling && <span className="beta-adjusted-indicator" title="Beta-adjusted parameter">β</span>}
                  </label>
                  <input
                    id="trailingSellPullbackPercent"
                    type="number"
                    value={parameters.trailingSellPullbackPercent}
                    onChange={(e) => handleChange('trailingSellPullbackPercent', parseFloat(e.target.value))}
                    min="0"
                    max="20"
                    step="0.1"
                    required
                    disabled={enableBetaScaling}
                  />
                  <span className="form-help">
                    {enableBetaScaling 
                      ? `Automatically calculated: ${(0.1 * beta * 100).toFixed(1)}% (10% × ${beta.toFixed(1)} Beta)`
                      : 'Stop price % below current price for trailing sell'
                    }
                  </span>
                </div>

                {/* Trailing Sell Validation Error */}
                {validationErrors.trailingSell && (
                  <div className="validation-error">
                    <strong>⚠️ Validation Error:</strong> {validationErrors.trailingSell}
                  </div>
                )}

                {/* Beta-related validation warnings */}
                {validationErrors.betaProfitRequirement && (
                  <div className="validation-warning">
                    <strong>⚠️ Beta Warning:</strong> {validationErrors.betaProfitRequirement}
                  </div>
                )}
                {validationErrors.betaGridInterval && (
                  <div className="validation-warning">
                    <strong>⚠️ Beta Warning:</strong> {validationErrors.betaGridInterval}
                  </div>
                )}
                {validationErrors.betaTrailingSell && (
                  <div className="validation-warning">
                    <strong>⚠️ Beta Warning:</strong> {validationErrors.betaTrailingSell}
                  </div>
                )}
                {validationErrors.betaTrailingBuy && (
                  <div className="validation-warning">
                    <strong>⚠️ Beta Warning:</strong> {validationErrors.betaTrailingBuy}
                  </div>
                )}
              </>
            )}


          </div>
        ) : (
          // Batch mode - range selections
          <div className="batch-parameters">
            {/* Beta Configuration Section */}
            <div className="form-section">
              <h3 className="section-title">
                <TrendingUp size={20} />
                Beta Configuration
              </h3>
              
              <div className="beta-batch-controls">
                <div className="form-group">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={batchParameters.enableBetaScaling}
                      onChange={(e) => handleBatchParameterChange('enableBetaScaling', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                    <span>Enable Beta-based Parameter Scaling</span>
                  </label>
                  <span className="form-help">
                    When enabled, parameters will be automatically adjusted based on each stock's volatility (Beta)
                  </span>
                </div>

                <div className="parameter-range">
                  <label>Beta Values - Test different volatility scenarios</label>
                  <div className="selection-controls">
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleSelectAll('betaValues', [0.25, 0.5, 1.0, 1.5, 2.0, 3.0])}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleDeselectAll('betaValues')}
                    >
                      Deselect All
                    </button>
                  </div>
                  <div className="checkbox-grid">
                    {[0.25, 0.5, 1.0, 1.5, 2.0, 3.0].map(val => (
                      <label key={val} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={batchParameters.betaValues.includes(val)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleBatchParameterChange('betaValues', [...batchParameters.betaValues, val]);
                            } else {
                              handleBatchParameterChange('betaValues', batchParameters.betaValues.filter(b => b !== val));
                            }
                          }}
                        />
                        <span>
                          {val} 
                          <small style={{color: '#666', marginLeft: '4px'}}>
                            ({val < 1 ? 'Low Vol' : val === 1 ? 'Market' : 'High Vol'})
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <span className="form-help">
                    Selected: {batchParameters.betaValues.join(', ')} | 
                    {batchParameters.enableBetaScaling 
                      ? ' Parameters will be scaled by these Beta values' 
                      : ' These Beta values will be tested with fixed parameters'
                    }
                  </span>
                </div>

                {batchParameters.enableBetaScaling && (
                  <div className="beta-scaling-info">
                    <div className="info-card">
                      <Info size={16} />
                      <div>
                        <h4>Beta Scaling Formula</h4>
                        <ul style={{fontSize: '0.875rem', margin: '0.5rem 0', paddingLeft: '1.25rem'}}>
                          <li>Profit Requirement = 5% × Beta</li>
                          <li>Grid Interval = 10% × Beta</li>
                          <li>Trailing Buy Activation = 10% × Beta</li>
                          <li>Trailing Buy Rebound = 5% × Beta</li>
                          <li>Trailing Sell Activation = 20% × Beta</li>
                          <li>Trailing Sell Pullback = 10% × Beta</li>
                        </ul>
                        <p style={{fontSize: '0.875rem', margin: '0.5rem 0', color: '#666'}}>
                          Example: Beta 1.5 → Profit Req: 7.5%, Grid: 15%, Trailing Sell: 30%
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
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
                  (batchParameters.betaValues.length || 1) *
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
              {strategyMode === 'short' ? (
                <>
                  <h4>Short Selling DCA Strategy Overview</h4>
                  <p>
                    This strategy uses short selling with Dollar Cost Averaging principles - selling high and buying back low.
                    It employs inverted grid trading with <strong>multiple layers of risk management</strong> including individual position stops,
                    portfolio-wide stops, and cascade liquidation rules to protect against unlimited loss potential.
                  </p>
                  <p className="risk-warning" style={{color: '#f44336', fontWeight: 'bold'}}>
                    ⚠️ WARNING: Short selling involves unlimited loss potential. Use conservative parameters and proper risk management.
                  </p>
                </>
              ) : (
                <>
                  <h4>Long DCA Strategy Overview</h4>
                  <p>
                    This strategy uses Dollar Cost Averaging with parameterized trailing stops and profit requirements.
                    It employs grid trading, dynamic stop-loss protection, and market condition filters to manage risk
                    while building positions over time.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        className="submit-button"
        disabled={loading || (batchMode && batchParameters.symbols.length === 0) || (strategyMode === 'short' && batchMode)}
      >
        {loading ? (
          <>
            <div className="loading-spinner"></div>
            {strategyMode === 'short' ? 'Running Short Backtest...' : (batchMode ? 'Running Batch Tests...' : 'Running Backtest...')}
          </>
        ) : (
          <>
            {strategyMode === 'short' && batchMode ? (
              <span style={{color: '#666'}}>
                <Zap size={20} />
                Short Batch Mode (Coming Soon)
              </span>
            ) : (
              <>
                {batchMode ? <Zap size={20} /> : <Play size={20} />}
                {strategyMode === 'short' ? 'Run Short DCA Backtest' : (batchMode ? 'Run Batch Optimization' : 'Run DCA Backtest')}
              </>
            )}
          </>
        )}
      </button>
    </form>
  );
};

export default DCABacktestForm;