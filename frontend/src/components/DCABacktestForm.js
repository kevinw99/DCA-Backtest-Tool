/* eslint-disable jsx-a11y/label-has-associated-control */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, DollarSign, TrendingUp, Settings, Info, Zap, Target, ArrowUpDown, Layers } from 'lucide-react';
import BetaControls from './BetaControls';
import { getTickerDefaults, saveTickerDefaults, extractTickerSpecificParams } from '../utils/strategyDefaults';
import URLParameterManager from '../utils/URLParameterManager';
import { getApiUrl } from '../config/api';

const DCABacktestForm = ({ onSubmit, loading, urlParams, currentTestMode, setAppTestMode }) => {
  const navigate = useNavigate();

  const [strategyMode, setStrategyMode] = useState(() => {
    // Initialize strategy mode from localStorage or default to 'long'
    const savedStrategy = localStorage.getItem('dca-strategy-mode');
    return savedStrategy || 'long';
  }); // 'long' or 'short'

  const [parameters, setParameters] = useState(() => {
    // Initialize from localStorage with minimal fallback (useEffect will load full defaults from API)
    const saved = localStorage.getItem('dca-single-parameters');
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log('📦 Loading parameters from localStorage:', {
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        endDateBefore: parsed.endDate
      });
      // DON'T force endDate to today - respect user's saved date
      // Only set to today if the saved date is missing
      if (!parsed.endDate) {
        parsed.endDate = new Date().toISOString().split('T')[0];
        console.log('⚠️ No endDate in localStorage, setting to today:', parsed.endDate);
      } else {
        console.log('✅ Using saved endDate from localStorage:', parsed.endDate);
      }
      return parsed;
    }

    // Default dates: fixed start, current end
    return {
      symbol: 'NVDA',
      strategyMode: 'long',
      startDate: '2021-09-01',
      endDate: new Date().toISOString().split('T')[0]
    };
  });

  // Short selling specific parameters
  const [shortParameters, setShortParameters] = useState(() => {
    // Initialize from localStorage with minimal fallback (useEffect will load full defaults from API)
    const saved = localStorage.getItem('dca-short-single-parameters');
    if (saved) {
      const parsed = JSON.parse(saved);
      // DON'T force endDate to today - respect user's saved date
      // Only set to today if the saved date is missing
      if (!parsed.endDate) {
        parsed.endDate = new Date().toISOString().split('T')[0];
      }
      return parsed;
    }

    // Default dates: fixed start, current end
    return {
      symbol: 'NVDA',
      strategyMode: 'SHORT_DCA',
      startDate: '2021-09-01',
      endDate: new Date().toISOString().split('T')[0]
    };
  });

  const [batchMode, setBatchMode] = useState(() => {
    // Priority: URL params > localStorage > default to false (single mode)
    if (urlParams?.mode === 'batch') {
      return true;
    } else if (urlParams?.mode === 'single') {
      return false;
    }
    // If no URL mode parameter, default to single mode (false)
    // This ensures clean URLs like /backtest/long/NVDA always start in single mode
    return false;
  });

  const [batchParameters, setBatchParameters] = useState(() => {
    // Initialize from localStorage just like other parameters, with fallback defaults
    const saved = localStorage.getItem('dca-batch-parameters');
    const defaultParams = {
      symbols: ['TSLA', 'APP', 'HOOD', 'SEZL', 'HIMS', 'SOFI', 'AMD', 'RXRX', 'CRCL', 'CRWV', 'FIGR', 'NBIS', 'AMSC', 'COIN', 'HYLN', 'SNDK', 'WDC', 'CRDO', 'IDCC', 'SOUN', 'BITF', 'CIFR', 'ONDS', 'NVDA', 'PLTR', 'ALAB', 'QBTS', 'AVGO', 'ORCL', 'IREN', 'FIG', 'OPEN', 'RDDT'],
      coefficients: [1.0],
      enableBetaScaling: false,
      maxLotsToSell: [1],
      profitRequirement: [5],
      gridIntervalPercent: [5],
      trailingBuyActivationPercent: [5],
      trailingBuyReboundPercent: [2.5],
      trailingSellActivationPercent: [15],
      trailingSellPullbackPercent: [7.5],
      enableDynamicGrid: true,
      normalizeToReference: true,
      dynamicGridMultiplier: [1.0],
      enableConsecutiveIncrementalBuyGrid: false,
      gridConsecutiveIncrement: [5],
      enableConsecutiveIncrementalSellProfit: true,
      // Spec 27: Directional strategy control flags
      enableAdaptiveTrailingBuy: false,
      enableAdaptiveTrailingSell: false,
      enableScenarioDetection: true,
      trailingStopOrderType: 'limit',
      enableAverageBasedGrid: false,
      enableAverageBasedSell: false,
      enableDynamicProfile: false,
      // Spec 45: Momentum-based trading parameters
      momentumBasedBuy: false,
      momentumBasedSell: false
    };

    if (saved) {
      const parsedSaved = JSON.parse(saved);
      // Ensure coefficients array exists (for backwards compatibility with old betaValues)
      return {
        ...defaultParams,
        ...parsedSaved,
        coefficients: parsedSaved.coefficients || parsedSaved.betaValues || [1.0]
      };
    }

    return defaultParams;
  });

  // Short selling batch parameters
  const [shortBatchParameters, setShortBatchParameters] = useState(() => {
    // Initialize from localStorage just like other parameters, with fallback defaults
    const saved = localStorage.getItem('dca-short-batch-parameters');
    return saved ? JSON.parse(saved) : {
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
    };
  });

  const [availableSymbols, setAvailableSymbols] = useState(() => {
    const saved = localStorage.getItem('dca-available-symbols');
    const defaultSymbols = ['TSLA', 'APP', 'HOOD', 'SEZL', 'HIMS', 'SOFI', 'AMD', 'RXRX',
      'CRCL', 'CRWV', 'FIGR', 'NBIS', 'AMSC', 'COIN', 'HYLN', 'SNDK',
      'WDC', 'CRDO', 'IDCC', 'SOUN', 'BITF', 'CIFR', 'ONDS', 'NVDA',
      'PLTR', 'ALAB', 'QBTS', 'AVGO', 'ORCL', 'IREN', 'FIG', 'OPEN', 'RDDT'];
    const symbols = saved ? JSON.parse(saved) : defaultSymbols;
    // Sort alphabetically
    return symbols.sort();
  });

  const [newSymbol, setNewSymbol] = useState('');

  // Persist availableSymbols to localStorage
  useEffect(() => {
    localStorage.setItem('dca-available-symbols', JSON.stringify(availableSymbols));
  }, [availableSymbols]);

  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [autoRunExecuted, setAutoRunExecuted] = useState(false);

  // Beta-related state - moved before useEffect hooks to avoid initialization errors
  const [beta, setBeta] = useState(1.0);
  const [coefficient, setCoefficient] = useState(() => {
    // Load coefficient from localStorage for single mode persistence
    const saved = localStorage.getItem('dca-coefficient');
    return saved ? parseFloat(saved) : 1.0;
  });
  const [betaFactor, setBetaFactor] = useState(1.0);
  const [isManualBetaOverride, setIsManualBetaOverride] = useState(false);
  const [enableBetaScaling, setEnableBetaScaling] = useState(() => {
    try {
      const saved = localStorage.getItem('dca-enable-beta-scaling');
      return saved === 'true';
    } catch (error) {
      console.error('Error loading enableBetaScaling from localStorage:', error);
      return false;
    }
  });
  const [betaError, setBetaError] = useState(null);
  const [betaLoading, setBetaLoading] = useState(false);
  const [baseParameters, setBaseParameters] = useState(() => {
    try {
      const saved = localStorage.getItem('dca-base-parameters');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('Error loading base parameters from localStorage:', error);
      return {};
    }
  });
  const [adjustedParameters, setAdjustedParameters] = useState({});
  const [isUpdatingBetaParameters, setIsUpdatingBetaParameters] = useState(false);
  const [parametersAreBetaAdjusted, setParametersAreBetaAdjusted] = useState(false);

  // Add validation state
  const [validationErrors, setValidationErrors] = useState({});

  // Local input states to prevent NaN validation errors during typing
  const [localInputValues, setLocalInputValues] = useState({});

  // Ticker-specific defaults state
  const [tickerDefaults, setTickerDefaults] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Advanced settings expand/collapse state
  const [advancedSettingsExpanded, setAdvancedSettingsExpanded] = useState(false);

  // Helper function to calculate betaFactor based on scaling state
  const calculateBetaFactor = (betaValue, coefficientValue, enableScaling) => {
    // Validate inputs to prevent NaN
    const safeBeta = isNaN(betaValue) || betaValue < 0 ? 1.0 : betaValue;
    const safeCoefficient = isNaN(coefficientValue) || coefficientValue <= 0 ? 1.0 : coefficientValue;

    return enableScaling ? safeBeta * safeCoefficient : safeBeta;
  };

  // Real-time URL updates are disabled to prevent infinite loops
  // URL is updated only when submitting backtest via handleBacktestSubmit in App.js

  // Persist coefficient to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('dca-coefficient', coefficient.toString());
  }, [coefficient]);

  // Persist enableBetaScaling to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('dca-enable-beta-scaling', enableBetaScaling.toString());
  }, [enableBetaScaling]);

  // Update betaFactor whenever beta, coefficient, or enableBetaScaling changes
  useEffect(() => {
    const newBetaFactor = calculateBetaFactor(beta, coefficient, enableBetaScaling);
    setBetaFactor(newBetaFactor);

    // Add warnings for extreme betaFactor values
    if (enableBetaScaling && newBetaFactor > 5.0) {
      console.warn(`Extreme β-factor detected: ${newBetaFactor.toFixed(3)} - parameters may be too aggressive`);
    } else if (enableBetaScaling && newBetaFactor < 0.1) {
      console.warn(`Extreme β-factor detected: ${newBetaFactor.toFixed(3)} - parameters may be too conservative`);
    }
  }, [beta, coefficient, enableBetaScaling]);

  // Load default parameters from backend on component mount
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const response = await fetch(getApiUrl('/api/backtest/defaults'));
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            // Use whole numbers directly (10 = 10%), no conversion needed
            const uiParams = {
              ...result.data,
              gridIntervalPercent: result.data.gridIntervalPercent || 10,
              profitRequirement: result.data.profitRequirement ?? 5,
              trailingBuyActivationPercent: result.data.trailingBuyActivationPercent || 10,
              trailingBuyReboundPercent: result.data.trailingBuyReboundPercent || 5,
              trailingSellActivationPercent: result.data.trailingSellActivationPercent || 20,
              trailingSellPullbackPercent: result.data.trailingSellPullbackPercent || 10
            };
            console.log('📥 Backend defaults loaded:', result.data);
            console.log('📊 UI params (no conversion needed):', uiParams);

            // Backend defaults are only used if localStorage is completely empty
            // This respects the localStorage-first pattern like strategyMode
            const savedParams = localStorage.getItem('dca-single-parameters');
            const savedShortParams = localStorage.getItem('dca-short-single-parameters');

            // DON'T force-update endDate - let users control their own date
            // The initial default is already set to today in useState initialization
            // Forcing it here would override user's changes every time defaults load

            // Only apply full backend defaults if no localStorage data exists (fresh user)
            if (!savedParams) {
              console.log('📥 No localStorage found, applying backend defaults for long parameters');
              setParameters(prev => ({ ...prev, ...uiParams }));
            }

            // Handle short parameters if they exist in backend defaults
            if (result.data.maxShorts !== undefined && !savedShortParams) {
              console.log('📥 No localStorage found, applying backend defaults for short parameters');
              const shortUiParams = {
                ...result.data,
                gridIntervalPercent: result.data.gridIntervalPercent || 15,
                profitRequirement: result.data.profitRequirement !== undefined ? result.data.profitRequirement : 0,
                trailingShortActivationPercent: result.data.trailingShortActivationPercent || 25,
                trailingShortPullbackPercent: result.data.trailingShortPullbackPercent || 15,
                trailingCoverActivationPercent: result.data.trailingCoverActivationPercent || 20,
                trailingCoverReboundPercent: result.data.trailingCoverReboundPercent || 10,
                hardStopLossPercent: result.data.hardStopLossPercent || 30,
                portfolioStopLossPercent: result.data.portfolioStopLossPercent || 25,
                cascadeStopLossPercent: result.data.cascadeStopLossPercent || 35
              };
              setShortParameters(prev => ({ ...prev, ...shortUiParams }));
            }

            // Set strategy mode from backend defaults only if not already set by localStorage
            const localStorageStrategy = localStorage.getItem('dca-strategy-mode');
            if (result.data.strategyMode && !localStorageStrategy) {
              setStrategyMode(result.data.strategyMode);
            }
          }
        }
      } catch (error) {
        console.error('Error loading defaults from backend:', error);
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
      // Handle strategy mode from URL first (so we know which parameters to map)
      if (urlParams.strategyMode && urlParams.strategyMode !== strategyMode) {
        console.log(`🔄 Setting strategy mode from URL: ${urlParams.strategyMode}`);
        setStrategyMode(urlParams.strategyMode);
      }

      // Map URL parameter names to form field names and convert types
      // Include both long and short strategy parameters (only relevant ones will be used)
      // IMPORTANT: Use ?? instead of || to allow 0 values
      const urlParamMapping = {
        // Common parameters
        symbol: (value) => value,
        startDate: (value) => value,
        endDate: (value) => value,
        lotSizeUsd: (value) => {
          const parsed = parseInt(value);
          return !isNaN(parsed) ? parsed : 10000;
        },
        gridIntervalPercent: (value) => {
          const parsed = parseFloat(value);
          return !isNaN(parsed) ? parsed : 10;
        },
        profitRequirement: (value) => {
          const parsed = parseFloat(value);
          return !isNaN(parsed) ? parsed : 5;
        },

        // Long strategy parameters
        maxLots: (value) => {
          const parsed = parseInt(value);
          return !isNaN(parsed) ? parsed : 10;
        },
        maxLotsToSell: (value) => {
          const parsed = parseInt(value);
          return !isNaN(parsed) ? parsed : 1;
        },
        trailingBuyActivationPercent: (value) => {
          const parsed = parseFloat(value);
          return !isNaN(parsed) ? parsed : 10;
        },
        trailingBuyReboundPercent: (value) => {
          const parsed = parseFloat(value);
          return !isNaN(parsed) ? parsed : 5;
        },
        trailingSellActivationPercent: (value) => {
          const parsed = parseFloat(value);
          return !isNaN(parsed) ? parsed : 20;
        },
        trailingSellPullbackPercent: (value) => {
          const parsed = parseFloat(value);
          return !isNaN(parsed) ? parsed : 10;
        },

        // Short strategy parameters
        maxShorts: (value) => {
          const parsed = parseInt(value);
          return !isNaN(parsed) ? parsed : 6;
        },
        maxShortsToCovers: (value) => {
          const parsed = parseInt(value);
          return !isNaN(parsed) ? parsed : 3;
        },
        trailingShortActivationPercent: (value) => {
          const parsed = parseFloat(value);
          return !isNaN(parsed) ? parsed : 25;
        },
        trailingShortPullbackPercent: (value) => {
          const parsed = parseFloat(value);
          return !isNaN(parsed) ? parsed : 15;
        },
        trailingCoverActivationPercent: (value) => {
          const parsed = parseFloat(value);
          return !isNaN(parsed) ? parsed : 20;
        },
        trailingCoverReboundPercent: (value) => {
          const parsed = parseFloat(value);
          return !isNaN(parsed) ? parsed : 10;
        },

        // Boolean flags for Grid & Incremental Options
        enableDynamicGrid: (value) => value === 'true' || value === true,
        normalizeToReference: (value) => value === 'true' || value === true,
        enableConsecutiveIncrementalBuyGrid: (value) => value === 'true' || value === true,
        enableConsecutiveIncrementalSellProfit: (value) => value === 'true' || value === true,
        // Spec 27: Directional strategy control flags
        enableAdaptiveTrailingBuy: (value) => value === 'true' || value === true,
        enableAdaptiveTrailingSell: (value) => value === 'true' || value === true,
        enableAverageBasedGrid: (value) => value === 'true' || value === true,
        enableAverageBasedSell: (value) => value === 'true' || value === true,
        enableDynamicProfile: (value) => value === 'true' || value === true,
        enableScenarioDetection: (value) => value === 'true' || value === true,

        // Trailing stop order type
        trailingStopOrderType: (value) => value || 'limit',

        // Numeric parameters for grid options
        dynamicGridMultiplier: (value) => {
          const parsed = parseFloat(value);
          return !isNaN(parsed) ? parsed : 1.0;
        },
        gridConsecutiveIncrement: (value) => {
          const parsed = parseFloat(value);
          return !isNaN(parsed) ? parsed : 5;
        }
      };

      // Build updated parameters object - handle both long and short parameters appropriately
      const updatedParams = { ...parameters };
      const updatedShortParams = { ...shortParameters };
      let hasChanges = false;
      let hasShortChanges = false;

      // Determine which strategy we're setting parameters for
      const targetStrategy = urlParams.strategyMode || strategyMode;
      console.log(`🔄 Applying URL parameters for strategy: ${targetStrategy}`);

      Object.keys(urlParamMapping).forEach(key => {
        if (urlParams[key] !== undefined && urlParams[key] !== null && urlParams[key] !== '') {
          const value = urlParamMapping[key](urlParams[key]);

          // Special handling for symbol: ensure it's in availableSymbols
          if (key === 'symbol' && typeof value === 'string') {
            const upperSymbol = value.toUpperCase();
            if (!availableSymbols.includes(upperSymbol)) {
              console.log(`📌 Adding symbol from URL to available symbols: ${upperSymbol}`);
              setAvailableSymbols(prev => [...prev, upperSymbol].sort());
            }
          }

          // Common parameters apply to both strategies
          const commonParams = [
            'symbol', 'startDate', 'endDate', 'lotSizeUsd', 'gridIntervalPercent', 'profitRequirement',
            // Grid & Incremental Options boolean flags
            'enableDynamicGrid', 'normalizeToReference', 'enableConsecutiveIncrementalBuyGrid',
            'enableConsecutiveIncrementalSellProfit',
            // Spec 27: Directional strategy control flags
            'enableAdaptiveTrailingBuy', 'enableAdaptiveTrailingSell',
            'enableScenarioDetection',
            'enableAverageBasedGrid', 'enableAverageBasedSell', 'enableDynamicProfile',
            // Grid option numeric parameters
            'dynamicGridMultiplier', 'gridConsecutiveIncrement',
            // Trailing stop order type
            'trailingStopOrderType'
          ];

          // Long strategy specific parameters
          const longParams = ['maxLots', 'maxLotsToSell', 'trailingBuyActivationPercent', 'trailingBuyReboundPercent', 'trailingSellActivationPercent', 'trailingSellPullbackPercent'];

          // Short strategy specific parameters
          const shortParams = ['maxShorts', 'maxShortsToCovers', 'trailingShortActivationPercent', 'trailingShortPullbackPercent', 'trailingCoverActivationPercent', 'trailingCoverReboundPercent'];

          if (commonParams.includes(key)) {
            // Apply common parameters to both long and short parameter sets
            if (targetStrategy === 'long' || targetStrategy === 'short') {
              updatedParams[key] = value;
              updatedShortParams[key] = value;
              hasChanges = true;
              hasShortChanges = true;
              console.log(`✓ URL param applied: ${key} = ${value}`);
            }
          } else if (longParams.includes(key) && targetStrategy === 'long') {
            // Apply long-specific parameters only to long parameter set
            updatedParams[key] = value;
            hasChanges = true;
          } else if (shortParams.includes(key) && targetStrategy === 'short') {
            // Apply short-specific parameters only to short parameter set
            updatedShortParams[key] = value;
            hasShortChanges = true;
          }
        }
      });

      if (hasChanges) {
        setParameters(updatedParams);
      }
      if (hasShortChanges) {
        setShortParameters(updatedShortParams);
      }

      // Handle batch mode parameters
      if (urlParams.mode === 'batch') {
        setBatchMode(true);

        // Apply batch-specific parameters from URL
        const updatedBatchParams = { ...batchParameters };
        const updatedShortBatchParams = { ...shortBatchParameters };
        let hasBatchChanges = false;
        let hasShortBatchChanges = false;

        // Apply symbols array if present
        if (urlParams.symbols && Array.isArray(urlParams.symbols) && urlParams.symbols.length > 0) {
          console.log(`✓ Batch URL param: symbols = [${urlParams.symbols.join(', ')}]`);
          updatedBatchParams.symbols = urlParams.symbols;
          updatedShortBatchParams.symbols = urlParams.symbols;
          hasBatchChanges = true;
          hasShortBatchChanges = true;
        }

        // Apply common parameters to batch parameters as well
        Object.keys(urlParamMapping).forEach(key => {
          if (urlParams[key] !== undefined && urlParams[key] !== null && urlParams[key] !== '') {
            const value = urlParamMapping[key](urlParams[key]);
            const commonParams = [
              'startDate', 'endDate', 'lotSizeUsd', 'gridIntervalPercent', 'profitRequirement',
              'enableDynamicGrid', 'normalizeToReference', 'enableConsecutiveIncrementalBuyGrid',
              'enableConsecutiveIncrementalSellProfit', 'enableAdaptiveTrailingBuy', 'enableAdaptiveTrailingSell',
              'enableScenarioDetection', 'enableAverageBasedGrid', 'enableAverageBasedSell', 'enableDynamicProfile',
              'dynamicGridMultiplier', 'gridConsecutiveIncrement', 'trailingStopOrderType'
            ];

            if (commonParams.includes(key)) {
              if (targetStrategy === 'long' || targetStrategy === 'short') {
                updatedBatchParams[key] = value;
                updatedShortBatchParams[key] = value;
                hasBatchChanges = true;
                hasShortBatchChanges = true;
                console.log(`✓ Batch URL param: ${key} = ${value}`);
              }
            }
          }
        });

        if (hasBatchChanges) {
          setBatchParameters(updatedBatchParams);
        }
        if (hasShortBatchChanges) {
          setShortBatchParameters(updatedShortBatchParams);
        }
      } else if (urlParams.mode === 'single') {
        setBatchMode(false);
      }
    }
  }, [urlParams, loadingDefaults]); // Run when urlParams OR loadingDefaults change (NOT batch/parameters to avoid infinite loop)

  // Handle autoRun functionality
  useEffect(() => {
    if (urlParams && urlParams.autoRun === 'true' && !loadingDefaults && !loading && !autoRunExecuted) {
      // Mark auto-run as executed to prevent multiple triggers
      setAutoRunExecuted(true);

      // Small delay to ensure form is populated
      setTimeout(() => {
        // Trigger form submission programmatically
        if (!batchMode) {
          // Use whole numbers directly (10 = 10%) - no conversion needed
          const backendParams = {
            ...parameters,
            gridIntervalPercent: parameters.gridIntervalPercent,
            profitRequirement: parameters.profitRequirement,
            trailingBuyActivationPercent: parameters.trailingBuyActivationPercent,
            trailingBuyReboundPercent: parameters.trailingBuyReboundPercent,
            trailingSellActivationPercent: parameters.trailingSellActivationPercent,
            trailingSellPullbackPercent: parameters.trailingSellPullbackPercent,
            // Add strategy mode
            strategyMode: strategyMode
          };
          onSubmit(backendParams, false); // false indicates single mode
        } else {
          console.log('Batch mode auto-run not implemented yet');
        }
      }, 500); // 500ms delay to ensure form is ready
    }
  }, [urlParams, loadingDefaults, loading, parameters, batchMode, strategyMode, onSubmit]); // Run when these values change

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

  // Persist single parameters to localStorage - same pattern as strategyMode
  useEffect(() => {
    // Skip saving to localStorage when updating beta parameters to avoid loops
    if (isUpdatingBetaParameters) {
      console.log('⏭️ Skipping localStorage save during beta parameter update');
      return;
    }
    console.log('💾 Saving parameters to localStorage:', parameters);
    localStorage.setItem('dca-single-parameters', JSON.stringify(parameters));
  }, [parameters, isUpdatingBetaParameters]);

  // Persist short single parameters to localStorage - same pattern as strategyMode
  useEffect(() => {
    console.log('💾 Saving shortParameters to localStorage:', shortParameters);
    localStorage.setItem('dca-short-single-parameters', JSON.stringify(shortParameters));
  }, [shortParameters]);

  // Load ticker-specific defaults when symbol changes (only in single mode)
  useEffect(() => {
    if (!batchMode && parameters.symbol) {
      const loadDefaults = async () => {
        const defaults = await getTickerDefaults(parameters.symbol);
        // DON'T force endDate to today - respect user's chosen date
        // Ticker defaults shouldn't override the date the user has set
        setTickerDefaults(defaults);
      };
      loadDefaults();
    }
  }, [parameters.symbol, batchMode]);

  // Fetch Beta data when symbol changes
  useEffect(() => {
    if (!batchMode && strategyMode === 'long') {
      const currentSymbol = parameters.symbol;
      if (currentSymbol && !isManualBetaOverride) {
        fetchBetaData(currentSymbol);
      }
    }
  }, [parameters.symbol, strategyMode, batchMode, isManualBetaOverride]);

  // Recalculate adjusted parameters when Beta scaling is toggled or Beta/coefficient changes
  useEffect(() => {
    let isCancelled = false;
    
    const updateParameters = async () => {
      console.log('🔄 useEffect: Checking if parameters need update', {
        enableBetaScaling,
        beta,
        strategyMode,
        coefficient
      });

      if (enableBetaScaling && beta && strategyMode === 'long') {
        console.log('✅ Conditions met, calling calculateAdjustedParameters');
        try {
          await calculateAdjustedParameters();
        } catch (error) {
          if (!isCancelled) {
            console.error('Error in calculateAdjustedParameters:', error);
            setBetaError('Failed to calculate adjusted parameters');
          }
        }
      } else {
        console.log('❌ Conditions not met for calculateAdjustedParameters');

        // Clear adjusted parameters when beta scaling is disabled
        // Don't reset the actual parameters - user's current values should be preserved
        if (!enableBetaScaling && strategyMode === 'long') {
          console.log('🔄 Clearing adjusted parameters (beta scaling disabled)');
          setAdjustedParameters({});
        }
      }
    };

    updateParameters();

    // Cleanup function to prevent state updates after component unmount
    return () => {
      isCancelled = true;
    };
  }, [enableBetaScaling, beta, coefficient, strategyMode]);


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
        // Removed trailing buy/sell activation vs rebound/pullback validation checks
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
      // Batch mode validation
      // No validation needed for trailing stop activation vs rebound/pullback values
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    console.log('=== DEBUG: Form Submission ===');
    console.log('Strategy Mode:', strategyMode);
    console.log('Batch Mode:', batchMode);
    console.log('Enable Beta Scaling:', enableBetaScaling);
    console.log('Beta:', beta);
    console.log('Coefficient:', coefficient);
    console.log('Beta Factor:', betaFactor);
    console.log('Parameters:', parameters);
    console.log('==============================');

    // Validate parameters before submission
    if (!validateParameters()) {
      return; // Don't submit if validation fails
    }

    if (strategyMode === 'short') {
      // Short selling strategy
      if (batchMode) {
        // Short batch mode - convert percentage arrays from whole numbers to decimals for API (CP-2)
        // Reference: VIOLATION-1, ISSUE-2 fix
        const convertPercentageArray = (arr) => arr.map(val => val / 100);

        const shortBatchOptions = {
          parameterRanges: {
            symbols: shortBatchParameters.symbols,
            // Convert percentage parameters: 10 → 0.10
            profitRequirement: convertPercentageArray(shortBatchParameters.profitRequirement),
            gridIntervalPercent: convertPercentageArray(shortBatchParameters.gridIntervalPercent),
            trailingShortActivationPercent: convertPercentageArray(shortBatchParameters.trailingShortActivationPercent),
            trailingShortPullbackPercent: convertPercentageArray(shortBatchParameters.trailingShortPullbackPercent),
            trailingCoverActivationPercent: convertPercentageArray(shortBatchParameters.trailingCoverActivationPercent),
            trailingCoverReboundPercent: convertPercentageArray(shortBatchParameters.trailingCoverReboundPercent),
            hardStopLossPercent: convertPercentageArray(shortBatchParameters.hardStopLossPercent),
            portfolioStopLossPercent: convertPercentageArray(shortBatchParameters.portfolioStopLossPercent),
            cascadeStopLossPercent: convertPercentageArray(shortBatchParameters.cascadeStopLossPercent),
            // Fixed parameters from single mode
            startDate: shortParameters.startDate,
            endDate: shortParameters.endDate,
            lotSizeUsd: shortParameters.lotSizeUsd,
            maxShorts: shortParameters.maxShorts,
            maxShortsToCovers: shortParameters.maxShortsToCovers
          },
          sortBy: 'totalReturn',
          strategyMode: 'short'
        };
        console.log('Running short batch optimization with params:', shortBatchOptions);
        onSubmit(shortBatchOptions, true);
        return;
      } else {
        // Short single mode - convert percentage parameters from whole numbers to decimals for API (CP-2)
        // Reference: VIOLATION-1, ISSUE-2 fix
        const shortBackendParams = {
          ...shortParameters,
          // Convert percentage parameters: 10 → 0.10
          gridIntervalPercent: shortParameters.gridIntervalPercent / 100,
          profitRequirement: shortParameters.profitRequirement / 100,
          trailingShortActivationPercent: shortParameters.trailingShortActivationPercent / 100,
          trailingShortPullbackPercent: shortParameters.trailingShortPullbackPercent / 100,
          trailingCoverActivationPercent: shortParameters.trailingCoverActivationPercent / 100,
          trailingCoverReboundPercent: shortParameters.trailingCoverReboundPercent / 100,
          hardStopLossPercent: shortParameters.hardStopLossPercent / 100,
          portfolioStopLossPercent: shortParameters.portfolioStopLossPercent / 100,
          cascadeStopLossPercent: shortParameters.cascadeStopLossPercent / 100,
          // Add strategy mode to parameters
          strategyMode: 'short'
        };
        onSubmit(shortBackendParams, false); // Short mode is indicated by strategyMode field
        return;
      }
    }

    // Long DCA strategy (existing logic)
    if (batchMode) {
      console.log('🚀 ===== BATCH MODE SUBMISSION =====');
      console.log('🚀 Date range from parameters state:', {
        startDate: parameters.startDate,
        endDate: parameters.endDate
      });
      console.log('🚀 Full parameters state:', parameters);

      // Convert percentage arrays from whole numbers to decimals for API (CP-2)
      // Reference: VIOLATION-1, ISSUE-2 fix
      const convertPercentageArray = (arr) => arr.map(val => val / 100);

      const batchOptions = {
        symbols: batchParameters.symbols,  // symbols at top level for API
        parameterRanges: {
          coefficients: batchParameters.coefficients,  // Not percentages, leave as-is
          maxLotsToSell: batchParameters.maxLotsToSell,  // Not percentages, leave as-is
          // Convert percentage parameters: 10 → 0.10
          profitRequirement: convertPercentageArray(batchParameters.profitRequirement),
          gridIntervalPercent: convertPercentageArray(batchParameters.gridIntervalPercent),
          trailingBuyActivationPercent: convertPercentageArray(batchParameters.trailingBuyActivationPercent),
          trailingBuyReboundPercent: convertPercentageArray(batchParameters.trailingBuyReboundPercent),
          trailingSellActivationPercent: convertPercentageArray(batchParameters.trailingSellActivationPercent),
          trailingSellPullbackPercent: convertPercentageArray(batchParameters.trailingSellPullbackPercent),
          dynamicGridMultiplier: batchParameters.dynamicGridMultiplier,  // Not percentage, leave as-is
          gridConsecutiveIncrement: convertPercentageArray(batchParameters.gridConsecutiveIncrement),  // CP-2: Convert [5, 10] → [0.05, 0.10]
          // Fixed parameters from single mode
          startDate: parameters.startDate,
          endDate: parameters.endDate,
          lotSizeUsd: parameters.lotSizeUsd,
          maxLots: parameters.maxLots,
          // Boolean flags for Grid & Incremental Options (must be inside parameterRanges for backend)
          enableBetaScaling: batchParameters.enableBetaScaling,
          enableDynamicGrid: batchParameters.enableDynamicGrid,
          normalizeToReference: batchParameters.normalizeToReference,
          enableConsecutiveIncrementalBuyGrid: batchParameters.enableConsecutiveIncrementalBuyGrid,
          enableConsecutiveIncrementalSellProfit: batchParameters.enableConsecutiveIncrementalSellProfit,
          enableScenarioDetection: batchParameters.enableScenarioDetection,
          trailingStopOrderType: batchParameters.trailingStopOrderType,
          // Spec 45: Momentum-based trading parameters
          momentumBasedBuy: batchParameters.momentumBasedBuy,
          momentumBasedSell: batchParameters.momentumBasedSell
        },
        sortBy: 'totalReturn'
      };
      console.log('📤 Batch options being sent:', { symbols: batchOptions.symbols, hasSymbols: !!batchOptions.symbols, symbolsLength: batchOptions.symbols?.length });
      onSubmit(batchOptions, true); // true indicates batch mode
    } else {
      // Convert percentage parameters from whole numbers to decimals for API (CP-2)
      // Reference: VIOLATION-1, ISSUE-2 fix
      const backendParams = {
        ...parameters,
        // Convert percentage parameters: 10 → 0.10
        gridIntervalPercent: parameters.gridIntervalPercent / 100,
        profitRequirement: parameters.profitRequirement / 100,
        trailingBuyActivationPercent: parameters.trailingBuyActivationPercent / 100,
        trailingBuyReboundPercent: parameters.trailingBuyReboundPercent / 100,
        trailingSellActivationPercent: parameters.trailingSellActivationPercent / 100,
        trailingSellPullbackPercent: parameters.trailingSellPullbackPercent / 100,
        gridConsecutiveIncrement: parameters.gridConsecutiveIncrement / 100,  // CP-2: Convert 5 → 0.05
        // Add Beta information (not percentages, leave as-is)
        beta: beta,
        coefficient: coefficient,
        betaFactor: betaFactor,
        enableBetaScaling: enableBetaScaling,
        isManualBetaOverride: isManualBetaOverride,
        // Add strategy mode
        strategyMode: strategyMode,
        // Add trailing stop order type
        trailingStopOrderType: parameters.trailingStopOrderType || 'limit'
      };
      onSubmit(backendParams, false); // false indicates single mode
    }
  };

  const handleResetParameters = async () => {
    if (window.confirm('Reset all parameters to default values?')) {
      if (strategyMode === 'long') {
        const currentSymbol = parameters.symbol || 'TSLA';
        // Preserve dates - they are NOT parameters that should be reset
        const currentStartDate = parameters.startDate;
        const currentEndDate = parameters.endDate;
        // Load ticker-specific defaults from backend API
        const defaults = await getTickerDefaults(currentSymbol);
        setParameters({
          ...defaults,
          symbol: currentSymbol,
          startDate: currentStartDate,  // Preserve current start date
          endDate: currentEndDate        // Preserve current end date
        });
        setBeta(defaults.beta || 1.0);
        setCoefficient(defaults.coefficient || 1.0);
        setEnableBetaScaling(defaults.enableBetaScaling || false);
        setIsManualBetaOverride(defaults.isManualBetaOverride || false);
        setAdjustedParameters({});
        setFeedbackMessage(tickerDefaults ? `Reset to ${currentSymbol} defaults` : 'Reset to global defaults');
      } else {
        const currentSymbol = shortParameters.symbol || 'TSLA';
        // Preserve dates - they are NOT parameters that should be reset
        const currentStartDate = shortParameters.startDate;
        const currentEndDate = shortParameters.endDate;
        const defaults = await getTickerDefaults(currentSymbol);
        setShortParameters({
          ...defaults,
          symbol: currentSymbol,
          startDate: currentStartDate,  // Preserve current start date
          endDate: currentEndDate        // Preserve current end date
        });
        setFeedbackMessage(tickerDefaults ? `Reset to ${currentSymbol} defaults` : 'Reset to global defaults');
      }
      setTimeout(() => setFeedbackMessage(''), 3000);
      console.log('✅ Parameters reset to defaults');
    }
  };

  const handleSaveAsDefault = async () => {
    try {
      const currentSymbol = strategyMode === 'short' ? shortParameters.symbol : parameters.symbol;
      const currentParams = strategyMode === 'short' ? shortParameters : parameters;

      if (!currentSymbol) {
        setFeedbackMessage('❌ No symbol selected');
        setTimeout(() => setFeedbackMessage(''), 3000);
        return;
      }

      // Extract only ticker-specific parameters
      // Backend will handle merging with global defaults and validation
      const extractedParams = extractTickerSpecificParams(currentParams);

      // Save to backend
      const result = await saveTickerDefaults(currentSymbol, extractedParams);

      if (result.success) {
        setFeedbackMessage(`✅ Saved defaults for ${currentSymbol}`);
        setTickerDefaults(extractedParams);
      } else {
        setFeedbackMessage(`❌ Failed to save: ${result.message}`);
      }

      setTimeout(() => setFeedbackMessage(''), 3000);
    } catch (error) {
      setFeedbackMessage(`❌ Error: ${error.message}`);
      setTimeout(() => setFeedbackMessage(''), 3000);
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
      // Update parameters
      setParameters(prev => ({
        ...prev,
        [field]: value
      }));

      // Mark parameters as no longer beta-adjusted when user manually changes them
      setParametersAreBetaAdjusted(false);
      
      // Update base parameters if Beta scaling is disabled (user is changing their base preferences)
      if (!enableBetaScaling) {
        const updatedBaseParams = {
          ...baseParameters,
          [field]: value
        };
        setBaseParameters(updatedBaseParams);
        localStorage.setItem('dca-base-parameters', JSON.stringify(updatedBaseParams));
        console.log(`📝 Updated base parameter ${field} = ${value} (Beta scaling disabled)`);
      } else {
        // If Beta scaling is enabled and user changes parameters, we need to update base parameters
        // by reverse-calculating what the base value should be
        console.log(`⚠️ Parameter change while Beta scaling enabled: ${field} = ${value}`);
        // Note: This is complex because we'd need to reverse the beta calculation
        // For now, we'll just log this case - in practice, users shouldn't be able to edit
        // parameters when Beta scaling is enabled (they should be read-only)
      }

      // Clear validation errors when values change and become valid
      if (field === 'trailingBuyActivationPercent' || field === 'trailingBuyReboundPercent') {
        const updatedParams = { ...parameters, [field]: value };
        if (updatedParams.trailingBuyActivationPercent > updatedParams.trailingBuyReboundPercent ||
            (updatedParams.trailingBuyActivationPercent === updatedParams.trailingBuyReboundPercent && updatedParams.trailingBuyActivationPercent === 0)) {
          setValidationErrors(prev => ({ ...prev, trailingBuy: undefined }));
        }
      }
      if (field === 'trailingSellActivationPercent' || field === 'trailingSellPullbackPercent') {
        const updatedParams = { ...parameters, [field]: value };
        if (updatedParams.trailingSellActivationPercent > updatedParams.trailingSellPullbackPercent ||
            (updatedParams.trailingSellActivationPercent === updatedParams.trailingSellPullbackPercent && updatedParams.trailingSellActivationPercent === 0)) {
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

  const handleShortBatchParameterChange = (field, values) => {
    setShortBatchParameters(prev => ({
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
    if (strategyMode === 'short') {
      setShortBatchParameters(prev => ({
        ...prev,
        symbols: prev.symbols.includes(symbol)
          ? prev.symbols.filter(s => s !== symbol)
          : [...prev.symbols, symbol]
      }));
    } else {
      setBatchParameters(prev => ({
        ...prev,
        symbols: prev.symbols.includes(symbol)
          ? prev.symbols.filter(s => s !== symbol)
          : [...prev.symbols, symbol]
      }));
    }
  };

  const handleAddSymbol = () => {
    const symbol = newSymbol.trim().toUpperCase();
    if (symbol && !availableSymbols.includes(symbol)) {
      setAvailableSymbols(prev => [...prev, symbol].sort());
      if (strategyMode === 'short') {
        setShortBatchParameters(prev => ({
          ...prev,
          symbols: [...prev.symbols, symbol]
        }));
      } else {
        setBatchParameters(prev => ({
          ...prev,
          symbols: [...prev.symbols, symbol]
        }));
      }
      setNewSymbol('');
    }
  };

  const handleSelectAllSymbols = () => {
    if (strategyMode === 'short') {
      setShortBatchParameters(prev => ({
        ...prev,
        symbols: [...availableSymbols]
      }));
    } else {
      setBatchParameters(prev => ({
        ...prev,
        symbols: [...availableSymbols]
      }));
    }
  };

  const handleDeselectAllSymbols = () => {
    if (strategyMode === 'short') {
      setShortBatchParameters(prev => ({
        ...prev,
        symbols: []
      }));
    } else {
      setBatchParameters(prev => ({
        ...prev,
        symbols: []
      }));
    }
  };

  // Beta-related functions
  const fetchBetaData = async (symbol) => {
    if (!symbol || isManualBetaOverride || strategyMode !== 'long') return;
    
    setBetaLoading(true);
    setBetaError(null);
    
    try {
      const response = await fetch(getApiUrl(`/api/stocks/${symbol}/beta`));
      const data = await response.json();
      
      if (response.ok || response.status === 206) { // 206 = Partial Content (with warnings)
        setBeta(data.beta);
        if (enableBetaScaling) {
          calculateAdjustedParameters();
        }
      } else {
        setBetaError(data.message || 'Failed to fetch Beta data');
        setBeta(1.0); // Default to 1.0 on error
        if (enableBetaScaling) {
          calculateAdjustedParameters();
        }
      }
    } catch (error) {
      console.error('Error fetching Beta data:', error);
      setBetaError('Network error fetching Beta data');
      setBeta(1.0); // Default to 1.0 on error
      if (enableBetaScaling) {
        calculateAdjustedParameters();
      }
    } finally {
      setBetaLoading(false);
    }
  };

  const calculateAdjustedParameters = async () => {
    if (!enableBetaScaling || strategyMode !== 'long') {
      setAdjustedParameters({});
      return;
    }

    // Set loading state
    setBetaLoading(true);
    setBetaError(null);

    // Use current form parameters (whole numbers, 10 = 10%)
    // Convert parameters from percentage format (10) to decimal format (0.1) for backend
    const baseParams = {
      profitRequirement: parameters.profitRequirement / 100,
      gridIntervalPercent: parameters.gridIntervalPercent / 100,
      trailingBuyActivationPercent: parameters.trailingBuyActivationPercent / 100,
      trailingBuyReboundPercent: parameters.trailingBuyReboundPercent / 100,
      trailingSellActivationPercent: parameters.trailingSellActivationPercent / 100,
      trailingSellPullbackPercent: parameters.trailingSellPullbackPercent / 100
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(getApiUrl('/api/backtest/beta-parameters'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: parameters.symbol,
          coefficient: enableBetaScaling ? coefficient : 1.0, // Use coefficient only when scaling enabled
          baseParameters: baseParams
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const responseData = await response.json();
      
      if (response.ok && responseData.success && responseData.data && responseData.data.adjustedParameters) {
        const apiData = responseData.data;

        // Update baseParameters from API's userParameters (these are the actual parameters that were scaled)
        if (apiData.userParameters) {
          const baseParamsForUI = {
            profitRequirement: apiData.userParameters.profitRequirement * 100,
            gridIntervalPercent: apiData.userParameters.gridIntervalPercent * 100,
            trailingBuyActivationPercent: apiData.userParameters.trailingBuyActivationPercent * 100,
            trailingBuyReboundPercent: apiData.userParameters.trailingBuyReboundPercent * 100,
            trailingSellActivationPercent: apiData.userParameters.trailingSellActivationPercent * 100,
            trailingSellPullbackPercent: apiData.userParameters.trailingSellPullbackPercent * 100
          };
          setBaseParameters(baseParamsForUI);
        }

        setAdjustedParameters(apiData.adjustedParameters);

        // The API already returns parameters in percentage format, round to 2 decimal places
        const adjustedForUI = {
          profitRequirement: Math.round((apiData.adjustedParameters.profitRequirement || 5.0) * 100) / 100,
          gridIntervalPercent: Math.round((apiData.adjustedParameters.gridIntervalPercent || 10.0) * 100) / 100,
          trailingBuyActivationPercent: Math.round((apiData.adjustedParameters.trailingBuyActivationPercent || 10.0) * 100) / 100,
          trailingBuyReboundPercent: Math.round((apiData.adjustedParameters.trailingBuyReboundPercent || 5.0) * 100) / 100,
          trailingSellActivationPercent: Math.round((apiData.adjustedParameters.trailingSellActivationPercent || 20.0) * 100) / 100,
          trailingSellPullbackPercent: Math.round((apiData.adjustedParameters.trailingSellPullbackPercent || 10.0) * 100) / 100
        };

        console.log('📊 Calculated adjusted parameters:', adjustedForUI);

        // Don't apply the adjusted parameters to form - keep base values in form fields
        // The scaled values will be shown in the help text only
        // applyAdjustedParameters(adjustedForUI);

        // Validate adjusted parameters and set warnings
        validateAdjustedParameters(adjustedForUI);
      } else {
        setBetaError(responseData.message || responseData.error || 'Failed to calculate adjusted parameters');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Parameter calculation request was cancelled');
      } else {
        console.error('Error calculating adjusted parameters:', error);
        console.error('Request details:', {
          symbol: parameters.symbol,
          coefficient: enableBetaScaling ? coefficient : 1.0,
          baseParameters: baseParams
        });
        setBetaError(`Network error: ${error.message}`);
      }
    } finally {
      setBetaLoading(false);
    }
  };

  // Apply adjusted parameters to form inputs
  const applyAdjustedParameters = (adjustedParams) => {
    if (!adjustedParams || !enableBetaScaling) return;
    
    console.log('✅ Applying adjusted parameters to form:', adjustedParams);
    setIsUpdatingBetaParameters(true);
    setParametersAreBetaAdjusted(true); // Mark parameters as beta-adjusted
    setParameters(prev => ({
      ...prev,
      ...adjustedParams
    }));
    // Reset flag after a brief delay to allow the useEffect to run
    setTimeout(() => setIsUpdatingBetaParameters(false), 100);
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
    calculateAdjustedParameters();
  };

  // Store current parameters as base before applying beta scaling
  const storeBaseParameters = () => {
    // Safety check: don't store beta-adjusted parameters as base
    if (parametersAreBetaAdjusted) {
      console.log('⚠️ Skipping base parameter storage - parameters are currently beta-adjusted');
      return;
    }
    
    // Store the current UI parameters (in percentage format) as base parameters
    const currentBaseParams = {
      profitRequirement: parameters.profitRequirement,
      gridIntervalPercent: parameters.gridIntervalPercent,
      trailingBuyActivationPercent: parameters.trailingBuyActivationPercent,
      trailingBuyReboundPercent: parameters.trailingBuyReboundPercent,
      trailingSellActivationPercent: parameters.trailingSellActivationPercent,
      trailingSellPullbackPercent: parameters.trailingSellPullbackPercent
    };
    
    setBaseParameters(currentBaseParams);
    localStorage.setItem('dca-base-parameters', JSON.stringify(currentBaseParams));
    console.log('📦 Stored base parameters:', currentBaseParams);
  };

  // Restore base parameters when beta scaling is disabled
  const restoreBaseParameters = () => {
    let baseParamsToRestore = baseParameters;
    
    // If no base parameters in state, try to load from localStorage
    if (Object.keys(baseParamsToRestore).length === 0) {
      try {
        const saved = localStorage.getItem('dca-base-parameters');
        if (saved) {
          baseParamsToRestore = JSON.parse(saved);
          setBaseParameters(baseParamsToRestore);
          console.log('📥 Loaded base parameters from localStorage:', baseParamsToRestore);
        }
      } catch (error) {
        console.error('Error loading base parameters from localStorage:', error);
      }
    }
    
    if (Object.keys(baseParamsToRestore).length === 0) {
      console.log('⚠️ No base parameters found, using current values as defaults');
      // If still no base parameters, use current parameter values (they should be the original user values)
      baseParamsToRestore = {
        profitRequirement: parameters.profitRequirement,
        gridIntervalPercent: parameters.gridIntervalPercent,
        trailingBuyActivationPercent: parameters.trailingBuyActivationPercent,
        trailingBuyReboundPercent: parameters.trailingBuyReboundPercent,
        trailingSellActivationPercent: parameters.trailingSellActivationPercent,
        trailingSellPullbackPercent: parameters.trailingSellPullbackPercent
      };
    }

    console.log('🔄 Restoring base parameters:', baseParamsToRestore);
    setIsUpdatingBetaParameters(true);
    setParametersAreBetaAdjusted(false); // Mark parameters as no longer beta-adjusted
    setParameters(prev => ({
      ...prev,
      ...baseParamsToRestore
    }));
    setTimeout(() => setIsUpdatingBetaParameters(false), 100);
  };

  const handleToggleBetaScaling = (enabled) => {
    if (enabled && strategyMode === 'long') {
      // Store current parameters as base BEFORE enabling beta scaling
      storeBaseParameters();
      console.log('🔄 Enabling Beta scaling - stored base parameters first');
    }
    
    // Set the beta scaling state
    setEnableBetaScaling(enabled);
    
    if (enabled && strategyMode === 'long') {
      // Now calculate and apply beta-adjusted parameters
      calculateAdjustedParameters();
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
      
      console.log('🔄 Disabling Beta scaling - restoring base parameters');
      // Restore base parameters
      restoreBaseParameters();
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
          Simulation Mode
        </h2>
        <div className="mode-selection">
          <label className={`mode-option ${!batchMode ? 'active' : ''}`}>
            <input
              type="radio"
              checked={!batchMode}
              onChange={() => setBatchMode(false)}
            />
            <Target size={20} />
            <span>Single Stock</span>
          </label>
          <label className={`mode-option ${batchMode ? 'active' : ''}`}>
            <input
              type="radio"
              checked={batchMode}
              onChange={() => setBatchMode(true)}
            />
            <Zap size={20} />
            <span>Batch</span>
            <p>Simulate multiple parameter combinations to find optimal settings</p>
          </label>
          <button
            type="button"
            className="mode-option portfolio-link"
            onClick={() => navigate('/portfolio-backtest')}
          >
            <Layers size={20} />
            <span>Portfolio</span>
            <p>Simulate strategy across multiple stocks with shared capital</p>
          </button>
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
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
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
                      checked={strategyMode === 'short' ? shortBatchParameters.symbols.includes(symbol) : batchParameters.symbols.includes(symbol)}
                      onChange={() => handleSymbolToggle(symbol)}
                    />
                    <span>{symbol}</span>
                  </label>
                ))}
              </div>
              <span className="form-help">Selected: {strategyMode === 'short' ? shortBatchParameters.symbols.join(', ') : batchParameters.symbols.join(', ')}</span>

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

      {/* Beta Controls - only show for long strategy in single mode */}
      {!batchMode && strategyMode === 'long' && (
        <BetaControls
          symbol={parameters.symbol}
          beta={beta}
          coefficient={coefficient}
          betaFactor={betaFactor}
          onBetaChange={setBeta}
          onCoefficientChange={setCoefficient}
          isManualOverride={isManualBetaOverride}
          onToggleManualOverride={setIsManualBetaOverride}
          enableBetaScaling={enableBetaScaling}
          onToggleBetaScaling={setEnableBetaScaling}
          baseParameters={baseParameters}
          adjustedParameters={adjustedParameters}
          loading={betaLoading}
          error={betaError}
        />
      )}

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

              {!batchMode && (
                <div className="form-group">
                  <label htmlFor="maxLotsToSell">Max Lots Per Sell</label>
                  <select
                    id="maxLotsToSell"
                    value={parameters.maxLotsToSell}
                    onChange={(e) => handleChange('maxLotsToSell', parseInt(e.target.value))}
                    required
                  >
                    {Array.from({ length: parameters.maxLots }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                  <span className="form-help">Maximum lots to sell simultaneously</span>
                </div>
              )}
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
                    value={localInputValues.shortProfitRequirement !== undefined ? localInputValues.shortProfitRequirement : shortParameters.profitRequirement}
                    onChange={(e) => {
                      const value = e.target.value;
                      setLocalInputValues(prev => ({ ...prev, shortProfitRequirement: value }));
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      const numValue = value === '' ? 0 : parseFloat(value);
                      if (!isNaN(numValue)) {
                        handleChange('profitRequirement', numValue);
                        setLocalInputValues(prev => ({ ...prev, shortProfitRequirement: undefined }));
                      }
                    }}
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
                    value={localInputValues.longProfitRequirement !== undefined ? localInputValues.longProfitRequirement : parameters.profitRequirement}
                    onChange={(e) => {
                      const value = e.target.value;
                      setLocalInputValues(prev => ({ ...prev, longProfitRequirement: value }));
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      const numValue = value === '' ? 0 : parseFloat(value);
                      if (!isNaN(numValue)) {
                        handleChange('profitRequirement', numValue);
                        setLocalInputValues(prev => ({ ...prev, longProfitRequirement: undefined }));
                      }
                    }}
                    min="0"
                    max="50"
                    step="0.1"
                    required
                    disabled={enableBetaScaling}
                  />
                  <span className="form-help">
                    {enableBetaScaling && adjustedParameters.profitRequirement
                      ? `Will be scaled to ${adjustedParameters.profitRequirement.toFixed(2)}% (β-factor: ${betaFactor.toFixed(3)})`
                      : 'Minimum profit required before selling'
                    }
                  </span>
                </div>

                {/* Advanced Settings - Collapsible Section */}
                <div className="advanced-settings-section" style={{ marginTop: '20px', marginBottom: '20px' }}>
                  <button
                    type="button"
                    className="advanced-settings-toggle"
                    onClick={() => setAdvancedSettingsExpanded(!advancedSettingsExpanded)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      backgroundColor: '#f5f5f5',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eaeaea'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                  >
                    <span>Advanced Settings</span>
                    <span style={{ transform: advancedSettingsExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                      ▼
                    </span>
                  </button>

                  {advancedSettingsExpanded && (
                    <div className="advanced-settings-content" style={{ marginTop: '15px', paddingLeft: '10px', borderLeft: '3px solid #e0e0e0' }}>
                      <div className="form-group checkbox-group">
                        <label>
                          <input
                            type="checkbox"
                            checked={parameters.enableDynamicGrid ?? false}
                            onChange={(e) => handleChange('enableDynamicGrid', e.target.checked)}
                          />
                          Enable Dynamic Grid Spacing
                        </label>
                        <span className="form-help">
                          Square root-based grid that adapts to price level
                        </span>
                      </div>

                {parameters.enableDynamicGrid !== false ? (
                  <>
                    <div className="form-group checkbox-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={parameters.normalizeToReference ?? true}
                          onChange={(e) => handleChange('normalizeToReference', e.target.checked)}
                        />
                        Normalize to Reference Price
                      </label>
                      <span className="form-help">
                        Treat first trade as $100 for consistent grid behavior (default: enabled)
                      </span>
                    </div>

                    <div className="form-group">
                      <label htmlFor="dynamicGridMultiplier">
                        Grid Multiplier: {(parameters.dynamicGridMultiplier ?? 1.0).toFixed(1)}
                      </label>
                      <input
                        id="dynamicGridMultiplier"
                        type="range"
                        value={parameters.dynamicGridMultiplier ?? 1.0}
                        onChange={(e) => handleChange('dynamicGridMultiplier', parseFloat(e.target.value))}
                        min="0.5"
                        max="2.0"
                        step="0.1"
                      />
                      <span className="form-help">
                        1.0 = ~10% at reference, higher = wider grids
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="form-group">
                    <label htmlFor="gridIntervalPercent">
                      Fixed Grid Interval (%)
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
                      {enableBetaScaling && adjustedParameters.gridIntervalPercent
                        ? `Will be scaled to ${adjustedParameters.gridIntervalPercent.toFixed(2)}% (β-factor: ${betaFactor.toFixed(3)})`
                        : 'Minimum price difference between lots'
                      }
                    </span>
                  </div>
                )}

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={parameters.enableConsecutiveIncrementalBuyGrid ?? false}
                      onChange={(e) => handleChange('enableConsecutiveIncrementalBuyGrid', e.target.checked)}
                    />
                    Enable Consecutive Incremental Buy Grid
                  </label>
                  <span className="form-help">
                    Increase grid spacing for consecutive buys during downtrends (base grid + count × increment)
                  </span>
                </div>

                {parameters.enableConsecutiveIncrementalBuyGrid && (
                  <>
                    <div className="form-group">
                      <label htmlFor="gridConsecutiveIncrement">
                        Grid Consecutive Increment (%)
                      </label>
                      <input
                        id="gridConsecutiveIncrement"
                        type="number"
                        value={parameters.gridConsecutiveIncrement ?? 5}
                        onChange={(e) => handleChange('gridConsecutiveIncrement', parseFloat(e.target.value))}
                        min="0"
                        max="20"
                        step="1"
                        required
                      />
                      <span className="form-help">
                        Amount to add to base grid for each consecutive buy (e.g., 5% means 1st buy: 10%, 2nd: 15%, 3rd: 20%)
                      </span>
                    </div>

                    <div className="form-group checkbox-group" style={{ marginLeft: '20px' }}>
                      <label>
                        <input
                          type="checkbox"
                          checked={parameters.enableAdaptiveTrailingBuy ?? false}
                          onChange={(e) => handleChange('enableAdaptiveTrailingBuy', e.target.checked)}
                        />
                        Enable Adaptive Uptrend Buys (Spec 25)
                      </label>
                      <span className="form-help">
                        When enabled: Allow momentum buys when price rises (Spec 25). When disabled: Only buy on downtrends (Spec 17 traditional)
                      </span>
                    </div>
                  </>
                )}

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={parameters.enableConsecutiveIncrementalSellProfit ?? true}
                      onChange={(e) => handleChange('enableConsecutiveIncrementalSellProfit', e.target.checked)}
                    />
                    Enable Consecutive Incremental Sell Profit
                  </label>
                  <span className="form-help">
                    Increase profit requirement for consecutive sells during uptrends (profit req + grid size)
                  </span>
                </div>

                {/* Spec 27: Adaptive Sell Direction Control */}
                {parameters.enableConsecutiveIncrementalSellProfit && (
                  <div className="form-group checkbox-group" style={{ marginLeft: '20px' }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={parameters.enableAdaptiveTrailingSell ?? false}
                        onChange={(e) => handleChange('enableAdaptiveTrailingSell', e.target.checked)}
                      />
                      Enable Adaptive Downtrend Sells (Spec 25)
                    </label>
                    <span className="form-help">
                      When enabled: Allow stop-loss sells when price falls (Spec 25). When disabled: Only sell on uptrends (Spec 18 traditional)
                    </span>
                  </div>
                )}

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={parameters.enableScenarioDetection ?? true}
                      onChange={(e) => handleChange('enableScenarioDetection', e.target.checked)}
                    />
                    Enable Scenario Detection
                  </label>
                  <span className="form-help">
                    Analyze market scenarios (Downtrend, Missed Rally, Oscillating Uptrend) with recommendations
                  </span>
                </div>

                {/* Spec 23: Average-Based Features */}
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={parameters.enableAverageBasedGrid ?? false}
                      onChange={(e) => handleChange('enableAverageBasedGrid', e.target.checked)}
                    />
                    Enable Average-Based Grid Spacing
                  </label>
                  <span className="form-help">
                    Use average cost for grid spacing (O(1)) instead of checking all lots (O(n)). For real portfolios where only average cost is known.
                  </span>
                </div>

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={parameters.enableAverageBasedSell ?? false}
                      onChange={(e) => handleChange('enableAverageBasedSell', e.target.checked)}
                    />
                    Enable Average-Based Sell Logic
                  </label>
                  <span className="form-help">
                    Check sell profitability against average cost instead of individual lot prices. Matches broker's tracking method.
                  </span>
                </div>

                {/* Spec 24: Dynamic Profile Switching */}
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={parameters.enableDynamicProfile ?? false}
                      onChange={(e) => handleChange('enableDynamicProfile', e.target.checked)}
                    />
                    Enable Dynamic Profile Switching
                  </label>
                  <span className="form-help">
                    Automatically adjust strategy based on position status: Conservative (buy: 20% drop, sell: easier) when LOSING, Aggressive (buy: immediate, sell: 20% from peak + 10% profit) when WINNING. Requires 3 consecutive days in same position status before switching.
                  </span>
                </div>

                {/* Spec 45: Momentum-Based Trading */}
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={parameters.momentumBasedBuy ?? false}
                      onChange={(e) => handleChange('momentumBasedBuy', e.target.checked)}
                    />
                    Enable Momentum-Based Buy (Spec 45)
                  </label>
                  <span className="form-help">
                    Buy on strength: 0% activation (immediate consideration), P/L &gt; 0 required (except first buy), unlimited lots (capital-limited only). Overrides trailingBuyActivationPercent.
                  </span>
                </div>

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={parameters.momentumBasedSell ?? false}
                      onChange={(e) => handleChange('momentumBasedSell', e.target.checked)}
                    />
                    Enable Momentum-Based Sell (Spec 45)
                  </label>
                  <span className="form-help">
                    Sell on weakness: 0% activation (immediate consideration), fast exit on momentum reversal. Overrides trailingSellActivationPercent. Still requires profitRequirement.
                  </span>
                </div>

                {/* Trailing Stop Order Type */}
                <div className="form-group">
                  <label htmlFor="trailingStopOrderType">Trailing Stop Order Type</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="trailingStopOrderType"
                        value="limit"
                        checked={(parameters.trailingStopOrderType || 'limit') === 'limit'}
                        onChange={(e) => handleChange('trailingStopOrderType', e.target.value)}
                      />
                      <span>Limit - Cancels if price exceeds peak (buy) or bottom (sell)</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="trailingStopOrderType"
                        value="market"
                        checked={parameters.trailingStopOrderType === 'market'}
                        onChange={(e) => handleChange('trailingStopOrderType', e.target.value)}
                      />
                      <span>Market - Always executes when stop triggers, no cancellation</span>
                    </label>
                  </div>
                  <small className="help-text">
                    <strong>Limit (Default):</strong> Prevents buying above recent peak or selling below recent bottom.
                    <br />
                    <strong>Market:</strong> Guarantees execution but may fill at unfavorable prices.
                  </small>
                </div>
                    </div>
                  )}
                </div>
                {/* End of Advanced Settings */}

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
                    min="0"
                    max="20"
                    step="0.1"
                    required
                    disabled={enableBetaScaling}
                  />
                  <span className="form-help">
                    {enableBetaScaling && adjustedParameters.trailingBuyActivationPercent
                      ? `Will be scaled to ${adjustedParameters.trailingBuyActivationPercent.toFixed(2)}% (β-factor: ${betaFactor.toFixed(3)})`
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
                    step="0.1"
                    required
                    disabled={enableBetaScaling}
                  />
                  <span className="form-help">
                    {enableBetaScaling && adjustedParameters.trailingBuyReboundPercent !== undefined
                      ? `Will be scaled to ${adjustedParameters.trailingBuyReboundPercent.toFixed(2)}% (β-factor: ${betaFactor.toFixed(3)})`
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
                    min="0"
                    max="50"
                    step="0.1"
                    required
                    disabled={enableBetaScaling}
                  />
                  <span className="form-help">
                    {enableBetaScaling && adjustedParameters.trailingSellActivationPercent
                      ? `Will be scaled to ${adjustedParameters.trailingSellActivationPercent.toFixed(2)}% (β-factor: ${betaFactor.toFixed(3)})`
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
                    {enableBetaScaling && adjustedParameters.trailingSellPullbackPercent
                      ? `Will be scaled to ${adjustedParameters.trailingSellPullbackPercent.toFixed(2)}% (β-factor: ${betaFactor.toFixed(3)})`
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
            {strategyMode === 'short' ? (
              // Short batch parameters
              <>
                <div className="parameter-range">
                  <label>Profit Requirement (%) - Range: 0 to 50, step 5</label>
                  <div className="selection-controls">
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleShortBatchParameterChange('profitRequirement', generateRange(0, 50, 5))}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleShortBatchParameterChange('profitRequirement', [])}
                    >
                      Deselect All
                    </button>
                  </div>
                  <div className="checkbox-grid">
                    {generateRange(0, 50, 5).map(val => (
                      <label key={val} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={shortBatchParameters.profitRequirement.includes(val)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleShortBatchParameterChange('profitRequirement', [...shortBatchParameters.profitRequirement, val]);
                            } else {
                              handleShortBatchParameterChange('profitRequirement', shortBatchParameters.profitRequirement.filter(p => p !== val));
                            }
                          }}
                        />
                        <span>{val}%</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="parameter-range">
                  <label>Grid Interval (%) - Range: 10 to 30, step 5</label>
                  <div className="selection-controls">
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleShortBatchParameterChange('gridIntervalPercent', generateRange(10, 30, 5))}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleShortBatchParameterChange('gridIntervalPercent', [])}
                    >
                      Deselect All
                    </button>
                  </div>
                  <div className="checkbox-grid">
                    {generateRange(10, 30, 5).map(val => (
                      <label key={val} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={shortBatchParameters.gridIntervalPercent.includes(val)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleShortBatchParameterChange('gridIntervalPercent', [...shortBatchParameters.gridIntervalPercent, val]);
                            } else {
                              handleShortBatchParameterChange('gridIntervalPercent', shortBatchParameters.gridIntervalPercent.filter(p => p !== val));
                            }
                          }}
                        />
                        <span>{val}%</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="parameter-range">
                  <label>Trailing Short Activation (%) - Range: 15 to 40, step 5</label>
                  <div className="selection-controls">
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleShortBatchParameterChange('trailingShortActivationPercent', generateRange(15, 40, 5))}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleShortBatchParameterChange('trailingShortActivationPercent', [])}
                    >
                      Deselect All
                    </button>
                  </div>
                  <div className="checkbox-grid">
                    {generateRange(15, 40, 5).map(val => (
                      <label key={val} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={shortBatchParameters.trailingShortActivationPercent.includes(val)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleShortBatchParameterChange('trailingShortActivationPercent', [...shortBatchParameters.trailingShortActivationPercent, val]);
                            } else {
                              handleShortBatchParameterChange('trailingShortActivationPercent', shortBatchParameters.trailingShortActivationPercent.filter(p => p !== val));
                            }
                          }}
                        />
                        <span>{val}%</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="parameter-range">
                  <label>Trailing Short Pullback (%) - Range: 5 to 25, step 5</label>
                  <div className="selection-controls">
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleShortBatchParameterChange('trailingShortPullbackPercent', generateRange(5, 25, 5))}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleShortBatchParameterChange('trailingShortPullbackPercent', [])}
                    >
                      Deselect All
                    </button>
                  </div>
                  <div className="checkbox-grid">
                    {generateRange(5, 25, 5).map(val => (
                      <label key={val} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={shortBatchParameters.trailingShortPullbackPercent.includes(val)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleShortBatchParameterChange('trailingShortPullbackPercent', [...shortBatchParameters.trailingShortPullbackPercent, val]);
                            } else {
                              handleShortBatchParameterChange('trailingShortPullbackPercent', shortBatchParameters.trailingShortPullbackPercent.filter(p => p !== val));
                            }
                          }}
                        />
                        <span>{val}%</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="parameter-range">
                  <label>Trailing Cover Activation (%) - Range: 10 to 35, step 5</label>
                  <div className="selection-controls">
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleShortBatchParameterChange('trailingCoverActivationPercent', generateRange(10, 35, 5))}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleShortBatchParameterChange('trailingCoverActivationPercent', [])}
                    >
                      Deselect All
                    </button>
                  </div>
                  <div className="checkbox-grid">
                    {generateRange(10, 35, 5).map(val => (
                      <label key={val} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={shortBatchParameters.trailingCoverActivationPercent.includes(val)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleShortBatchParameterChange('trailingCoverActivationPercent', [...shortBatchParameters.trailingCoverActivationPercent, val]);
                            } else {
                              handleShortBatchParameterChange('trailingCoverActivationPercent', shortBatchParameters.trailingCoverActivationPercent.filter(p => p !== val));
                            }
                          }}
                        />
                        <span>{val}%</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="parameter-range">
                  <label>Trailing Cover Rebound (%) - Range: 5 to 20, step 5</label>
                  <div className="selection-controls">
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleShortBatchParameterChange('trailingCoverReboundPercent', generateRange(5, 20, 5))}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleShortBatchParameterChange('trailingCoverReboundPercent', [])}
                    >
                      Deselect All
                    </button>
                  </div>
                  <div className="checkbox-grid">
                    {generateRange(5, 20, 5).map(val => (
                      <label key={val} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={shortBatchParameters.trailingCoverReboundPercent.includes(val)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleShortBatchParameterChange('trailingCoverReboundPercent', [...shortBatchParameters.trailingCoverReboundPercent, val]);
                            } else {
                              handleShortBatchParameterChange('trailingCoverReboundPercent', shortBatchParameters.trailingCoverReboundPercent.filter(p => p !== val));
                            }
                          }}
                        />
                        <span>{val}%</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              // Long batch parameters
              <>
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
                      <label>Coefficient Values - Test different volatility scaling scenarios</label>
                      <div className="selection-controls">
                        <button
                          type="button"
                          className="control-button"
                          onClick={() => handleSelectAll('coefficients', [0.25, 0.5, 1.0, 1.5, 2.0, 3.0])}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          className="control-button"
                          onClick={() => handleDeselectAll('coefficients')}
                        >
                          Deselect All
                        </button>
                      </div>
                      <div className="checkbox-grid">
                        {[0.25, 0.5, 1.0, 1.5, 2.0, 3.0].map(val => (
                          <label key={val} className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={(batchParameters.coefficients || []).includes(val)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleBatchParameterChange('coefficients', [...(batchParameters.coefficients || []), val]);
                                } else {
                                  handleBatchParameterChange('coefficients', (batchParameters.coefficients || []).filter(b => b !== val));
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
                        Selected: {batchParameters.coefficients.join(', ')} |
                        {batchParameters.enableBetaScaling
                          ? ' Parameters will be scaled by Beta × Coefficient values'
                          : ' These coefficient values will be tested with fixed parameters'
                        }
                      </span>
                    </div>

                    <div className="form-group">
                      <label>Max Lots Per Sell</label>
                      <div className="control-buttons">
                        <button
                          type="button"
                          className="control-button"
                          onClick={() => handleSelectAll('maxLotsToSell', Array.from({ length: parameters.maxLots }, (_, i) => i + 1))}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          className="control-button"
                          onClick={() => handleDeselectAll('maxLotsToSell')}
                        >
                          Deselect All
                        </button>
                      </div>
                      <div className="checkbox-grid">
                        {Array.from({ length: parameters.maxLots }, (_, i) => i + 1).map(val => (
                          <label key={val} className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={(batchParameters.maxLotsToSell || [1]).includes(val)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleBatchParameterChange('maxLotsToSell', [...(batchParameters.maxLotsToSell || []), val]);
                                } else {
                                  handleBatchParameterChange('maxLotsToSell', (batchParameters.maxLotsToSell || []).filter(m => m !== val));
                                }
                              }}
                            />
                            <span>{val}</span>
                          </label>
                        ))}
                      </div>
                      <span className="form-help">
                        Selected: {(batchParameters.maxLotsToSell || [1]).join(', ')} | Maximum lots to sell per transaction
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
                  <label>Trailing Buy Activation (%) - Range: 0 to 30, step 5</label>
                  <div className="selection-controls">
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleSelectAll('trailingBuyActivationPercent', generateRange(0, 30, 5))}
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
                    {generateRange(0, 30, 5).map(val => (
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
                  <label>Trailing Buy Rebound (%) - Range: 0 to 30, step 5</label>
                  <div className="selection-controls">
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleSelectAll('trailingBuyReboundPercent', generateRange(0, 30, 5))}
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
                    {generateRange(0, 30, 5).map(val => (
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
                  <label>Trailing Sell Activation (%) - Range: 0 to 30, step 5</label>
                  <div className="selection-controls">
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleSelectAll('trailingSellActivationPercent', generateRange(0, 30, 5))}
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
                    {generateRange(0, 30, 5).map(val => (
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
                  <label>Trailing Sell Pullback (%) - Range: 0 to 30, step 5</label>
                  <div className="selection-controls">
                    <button
                      type="button"
                      className="control-button"
                      onClick={() => handleSelectAll('trailingSellPullbackPercent', generateRange(0, 30, 5))}
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
                    {generateRange(0, 30, 5).map(val => (
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
              </>
            )}

            {/* Dynamic Grid and Consecutive Incremental Options for Batch Mode */}
            {batchMode && strategyMode === 'long' && (
              <>
                <div className="parameter-section">
                  <h3>Dynamic Grid Multiplier (%)</h3>
                  <div className="batch-actions">
                    <button
                      type="button"
                      className="select-all-btn"
                      onClick={() => handleBatchParameterChange('dynamicGridMultiplier', [0.5, 1.0, 1.5, 2.0])}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="deselect-all-btn"
                      onClick={() => handleBatchParameterChange('dynamicGridMultiplier', [1.0])}
                    >
                      Reset to Default
                    </button>
                  </div>
                  <div className="checkbox-grid">
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map(val => (
                      <label key={val} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={(batchParameters.dynamicGridMultiplier || [1.0]).includes(val)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleBatchParameterChange('dynamicGridMultiplier', [...(batchParameters.dynamicGridMultiplier || []), val]);
                            } else {
                              handleBatchParameterChange('dynamicGridMultiplier', (batchParameters.dynamicGridMultiplier || []).filter(m => m !== val));
                            }
                          }}
                        />
                        <span>{val}x</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="parameter-section">
                  <h3>Grid & Incremental Options</h3>
                  <div className="form-group checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={batchParameters.enableDynamicGrid !== false}
                        onChange={(e) => handleBatchParameterChange('enableDynamicGrid', e.target.checked)}
                      />
                      Enable Dynamic Grid
                    </label>
                  </div>
                  {batchParameters.enableDynamicGrid !== false && (
                    <div className="form-group checkbox-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={batchParameters.normalizeToReference !== false}
                          onChange={(e) => handleBatchParameterChange('normalizeToReference', e.target.checked)}
                        />
                        Normalize to Reference Price
                      </label>
                    </div>
                  )}
                  <div className="form-group checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={batchParameters.enableConsecutiveIncrementalBuyGrid === true}
                        onChange={(e) => handleBatchParameterChange('enableConsecutiveIncrementalBuyGrid', e.target.checked)}
                      />
                      Enable Consecutive Incremental Buy Grid
                    </label>
                  </div>
                  <div className="form-group checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={batchParameters.enableConsecutiveIncrementalSellProfit !== false}
                        onChange={(e) => handleBatchParameterChange('enableConsecutiveIncrementalSellProfit', e.target.checked)}
                      />
                      Enable Consecutive Incremental Sell Profit
                    </label>
                  </div>
                  <div className="form-group checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={batchParameters.enableScenarioDetection !== false}
                        onChange={(e) => handleBatchParameterChange('enableScenarioDetection', e.target.checked)}
                      />
                      Enable Scenario Detection
                    </label>
                  </div>

                  {/* Trailing Stop Order Type for Batch Mode */}
                  <div className="form-group">
                    <label htmlFor="batchTrailingStopOrderType">Trailing Stop Order Type</label>
                    <div className="radio-group">
                      <label className="radio-option">
                        <input
                          type="radio"
                          name="batchTrailingStopOrderType"
                          value="limit"
                          checked={(batchParameters.trailingStopOrderType || 'limit') === 'limit'}
                          onChange={(e) => handleBatchParameterChange('trailingStopOrderType', e.target.value)}
                        />
                        <span>Limit - Cancels if price exceeds peak (buy) or bottom (sell)</span>
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          name="batchTrailingStopOrderType"
                          value="market"
                          checked={batchParameters.trailingStopOrderType === 'market'}
                          onChange={(e) => handleBatchParameterChange('trailingStopOrderType', e.target.value)}
                        />
                        <span>Market - Always executes when stop triggers, no cancellation</span>
                      </label>
                    </div>
                    <small className="help-text">
                      <strong>Limit (Default):</strong> Prevents buying above recent peak or selling below recent bottom.
                      <br />
                      <strong>Market:</strong> Guarantees execution but may fill at unfavorable prices.
                    </small>
                  </div>
                </div>

                {/* Grid Consecutive Increment Batch Parameter */}
                {batchParameters.enableConsecutiveIncrementalBuyGrid && (
                  <div className="parameter-section">
                    <h3>Grid Consecutive Increment (%)</h3>
                    <div className="batch-actions">
                      <button
                        type="button"
                        className="select-all-btn"
                        onClick={() => handleBatchParameterChange('gridConsecutiveIncrement', [0, 5, 10, 15])}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className="deselect-all-btn"
                        onClick={() => handleBatchParameterChange('gridConsecutiveIncrement', [5])}
                      >
                        Reset to Default
                      </button>
                    </div>
                    <div className="checkbox-grid">
                      {[0, 5, 10, 15, 20].map(val => (
                        <label key={val} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={(batchParameters.gridConsecutiveIncrement || [5]).includes(val)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                handleBatchParameterChange('gridConsecutiveIncrement', [...(batchParameters.gridConsecutiveIncrement || []), val]);
                              } else {
                                handleBatchParameterChange('gridConsecutiveIncrement', (batchParameters.gridConsecutiveIncrement || []).filter(m => m !== val));
                              }
                            }}
                          />
                          <span>{val}%</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
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
                  strategyMode === 'short' ? (
                    shortBatchParameters.symbols.length *
                    shortBatchParameters.profitRequirement.length *
                    shortBatchParameters.gridIntervalPercent.length *
                    shortBatchParameters.trailingShortActivationPercent.length *
                    shortBatchParameters.trailingShortPullbackPercent.length *
                    shortBatchParameters.trailingCoverActivationPercent.length *
                    shortBatchParameters.trailingCoverReboundPercent.length
                  ) : (
                    batchParameters.symbols.length *
                    (enableBetaScaling ? (batchParameters.coefficients.length || 1) : 1) *
                    (batchParameters.maxLotsToSell.length || 1) *
                    batchParameters.profitRequirement.length *
                    batchParameters.gridIntervalPercent.length *
                    batchParameters.trailingBuyActivationPercent.length *
                    batchParameters.trailingBuyReboundPercent.length *
                    batchParameters.trailingSellActivationPercent.length *
                    batchParameters.trailingSellPullbackPercent.length *
                    (batchParameters.dynamicGridMultiplier?.length || 1)
                  )
                }
              </p>
              <p>
                The report will include: total return, CAGR, total trades, win rate,
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

      <div className="form-actions">
        <button
          type="button"
          className="reset-button"
          onClick={handleResetParameters}
          disabled={loading}
        >
          <Settings size={18} />
          Reset to Defaults
        </button>
        {!batchMode && (
          <button
            type="button"
            className="save-default-button"
            onClick={handleSaveAsDefault}
            disabled={loading}
          >
            <Target size={18} />
            Save as Default for {strategyMode === 'short' ? shortParameters.symbol : parameters.symbol}
          </button>
        )}
        {feedbackMessage && (
          <div className={`feedback-message ${feedbackMessage.includes('❌') ? 'error' : 'success'}`}>
            {feedbackMessage}
          </div>
        )}
        <button
          type="submit"
          className="submit-button"
          disabled={loading || (batchMode && ((strategyMode === 'short' && shortBatchParameters.symbols.length === 0) || (strategyMode === 'long' && batchParameters.symbols.length === 0)))}
        >
          {loading ? (
            <>
              <div className="loading-spinner"></div>
              {strategyMode === 'short' ?
                (batchMode ? 'Running Short Batch Tests...' : 'Running Short Backtest...') :
                (batchMode ? 'Running Batch Tests...' : 'Running Backtest...')
              }
            </>
          ) : (
            <>
              {batchMode ? <Zap size={20} /> : <Play size={20} />}
              {strategyMode === 'short' ?
                (batchMode ? 'Run Short Batch Simulation' : 'Run Short DCA Simulation') :
                (batchMode ? 'Run Batch Simulation' : 'Run DCA Simulation')
              }
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default DCABacktestForm;
