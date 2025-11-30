/**
 * Config Service - Single Source of Truth for Backtest Defaults
 *
 * Fetches configuration from backend API and caches it.
 * Backend owns the configuration file at /config/backtestDefaults.json
 * Frontend fetches via API to avoid duplication and configuration drift.
 *
 * Spec 54: Configuration Single Source of Truth
 */

import { getApiUrl } from '../config/api';

// Singleton cache
let cachedConfig = null;
let fetchPromise = null;

/**
 * Fetch backtest defaults from backend API
 * Implements caching to avoid repeated API calls
 *
 * @returns {Promise<Object>} Config object with global and stock-specific defaults
 */
export const fetchBacktestDefaults = async () => {
  // Return cached config if available
  if (cachedConfig) {
    console.log('📦 Using cached backtest defaults');
    return cachedConfig;
  }

  // Return existing promise if fetch already in progress
  if (fetchPromise) {
    console.log('⏳ Waiting for in-progress config fetch');
    return fetchPromise;
  }

  console.log('🌐 Fetching backtest defaults from API...');

  // Start new fetch
  fetchPromise = fetch(getApiUrl('/api/config/backtest-defaults'))
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        cachedConfig = data.data;
        fetchPromise = null;
        console.log('✅ Backtest defaults loaded successfully');
        return cachedConfig;
      }
      throw new Error(data.error || 'Failed to load config');
    })
    .catch((error) => {
      fetchPromise = null;
      console.error('❌ Failed to fetch backtest defaults:', error);

      // Return minimal fallback defaults
      const fallbackConfig = {
        global: {
          basic: {
            lotSizeUsd: 10000,
            strategyMode: 'long'
          },
          longStrategy: {
            maxLots: 10,
            maxLotsToSell: 1,
            gridIntervalPercent: 5,
            profitRequirement: 10,
            trailingBuyActivationPercent: 5,
            trailingBuyReboundPercent: 2.5,
            trailingSellActivationPercent: 15,
            trailingSellPullbackPercent: 7.5
          },
          shortStrategy: {
            maxShorts: 6,
            maxShortsToCovers: 3,
            gridIntervalPercent: 10,
            profitRequirement: 10,
            trailingShortActivationPercent: 25,
            trailingShortPullbackPercent: 15,
            trailingCoverActivationPercent: 20,
            trailingCoverReboundPercent: 10,
            stopLoss: {
              hardStopLossPercent: 30,
              portfolioStopLossPercent: 25,
              cascadeStopLossPercent: 35
            }
          },
          beta: {
            enableBetaScaling: false,
            beta: 1,
            betaFactor: 1,
            coefficient: 1,
            isManualBetaOverride: false
          },
          dynamicFeatures: {
            enableDynamicGrid: false,
            dynamicGridMultiplier: 1,
            enableConsecutiveIncrementalBuyGrid: false,
            gridConsecutiveIncrement: 5,
            enableConsecutiveIncrementalSellProfit: false,
            enableScenarioDetection: false,
            normalizeToReference: false
          },
          adaptiveStrategy: {
            enableAdaptiveStrategy: false,
            adaptationCheckIntervalDays: 30,
            adaptationRollingWindowDays: 90,
            minDataDaysBeforeAdaptation: 90,
            confidenceThreshold: 0.7
          }
        }
      };

      console.warn('⚠️  Using fallback defaults due to API error');
      cachedConfig = fallbackConfig;
      return cachedConfig;
    });

  return fetchPromise;
};

/**
 * Get cached config synchronously
 * Returns fallback config if not yet loaded (during component initialization)
 *
 * @returns {Object} Cached config object (or fallback if not loaded)
 */
export const getConfigSync = () => {
  if (!cachedConfig) {
    console.warn('⚠️  Config not yet loaded, using fallback defaults');
    // Return same fallback config as used in fetchBacktestDefaults
    return {
      global: {
        basic: {
          lotSizeUsd: 10000,
          strategyMode: 'long'
        },
        longStrategy: {
          maxLots: 10,
          maxLotsToSell: 1,
          gridIntervalPercent: 5,
          profitRequirement: 10,
          trailingBuyActivationPercent: 5,
          trailingBuyReboundPercent: 2.5,
          trailingSellActivationPercent: 15,
          trailingSellPullbackPercent: 7.5
        },
        shortStrategy: {
          maxShorts: 6,
          maxShortsToCovers: 3,
          gridIntervalPercent: 10,
          profitRequirement: 10,
          trailingShortActivationPercent: 25,
          trailingShortPullbackPercent: 15,
          trailingCoverActivationPercent: 20,
          trailingCoverReboundPercent: 10,
          stopLoss: {
            hardStopLossPercent: 30,
            portfolioStopLossPercent: 25,
            cascadeStopLossPercent: 35
          }
        },
        beta: {
          enableBetaScaling: false,
          beta: 1,
          betaFactor: 1,
          coefficient: 1,
          isManualBetaOverride: false
        },
        dynamicFeatures: {
          enableDynamicGrid: false,
          dynamicGridMultiplier: 1,
          enableConsecutiveIncrementalBuyGrid: false,
          gridConsecutiveIncrement: 5,
          enableConsecutiveIncrementalSellProfit: false,
          enableScenarioDetection: false,
          normalizeToReference: false
        },
        adaptiveStrategy: {
          enableAdaptiveStrategy: false,
          adaptationCheckIntervalDays: 30,
          adaptationRollingWindowDays: 90,
          minDataDaysBeforeAdaptation: 90,
          confidenceThreshold: 0.7
        }
      }
    };
  }
  return cachedConfig;
};

/**
 * Check if config is loaded
 *
 * @returns {boolean} True if config is cached
 */
export const isConfigLoaded = () => {
  return cachedConfig !== null;
};

/**
 * Clear cached config
 * Useful for testing or forcing a refresh
 */
export const clearConfigCache = () => {
  console.log('🗑️  Clearing config cache');
  cachedConfig = null;
  fetchPromise = null;
};

/**
 * Refresh config from API
 * Clears cache and fetches fresh data
 *
 * @returns {Promise<Object>} Fresh config object
 */
export const refreshConfig = async () => {
  clearConfigCache();
  return fetchBacktestDefaults();
};

export default {
  fetchBacktestDefaults,
  getConfigSync,
  isConfigLoaded,
  clearConfigCache,
  refreshConfig
};
