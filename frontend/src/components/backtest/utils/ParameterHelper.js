/**
 * ParameterHelper - Parameter loading, merging, and persistence utilities
 *
 * Handles loading defaults from backtestDefaults.json, localStorage persistence,
 * URL parameter parsing, and parameter comparison operations.
 */

import backtestDefaults from '../../../config/backtestDefaults.json';

export const ParameterHelper = {
  /**
   * Get global default parameters
   */
  getGlobalDefaults() {
    return backtestDefaults.global || {};
  },

  /**
   * Get stock-specific defaults merged with global defaults
   *
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @returns {Object} Merged parameters (stock-specific overrides + global defaults)
   */
  getStockDefaults(symbol) {
    const globalDefaults = this.getGlobalDefaults();
    const stockDefaults = backtestDefaults[symbol] || {};

    return this.mergeStockDefaults(globalDefaults, stockDefaults);
  },

  /**
   * Deep merge stock-specific parameters with global defaults
   *
   * @param {Object} globalDefaults - Global default parameters
   * @param {Object} stockDefaults - Stock-specific parameter overrides
   * @returns {Object} Merged parameters
   */
  mergeStockDefaults(globalDefaults, stockDefaults) {
    const merged = {};

    // Sections to merge
    const sections = ['basic', 'longStrategy', 'shortStrategy', 'beta', 'dynamicFeatures', 'adaptiveStrategy'];

    for (const section of sections) {
      if (globalDefaults[section] || stockDefaults[section]) {
        merged[section] = {
          ...(globalDefaults[section] || {}),
          ...(stockDefaults[section] || {})
        };

        // Handle nested objects (like stopLoss in shortStrategy)
        for (const key in merged[section]) {
          const globalValue = globalDefaults[section]?.[key];
          const stockValue = stockDefaults[section]?.[key];

          if (stockValue && typeof stockValue === 'object' && !Array.isArray(stockValue)) {
            merged[section][key] = {
              ...(globalValue || {}),
              ...stockValue
            };
          }
        }
      }
    }

    return merged;
  },

  /**
   * Flatten merged defaults into a single-level object for form use
   *
   * @param {Object} mergedDefaults - Nested defaults structure from getStockDefaults()
   * @returns {Object} Flattened parameters
   */
  flattenDefaults(mergedDefaults) {
    const flat = {};

    // Basic parameters
    if (mergedDefaults.basic) {
      Object.assign(flat, mergedDefaults.basic);
    }

    // Long strategy parameters
    if (mergedDefaults.longStrategy) {
      Object.assign(flat, mergedDefaults.longStrategy);
    }

    // Short strategy parameters
    if (mergedDefaults.shortStrategy) {
      Object.assign(flat, mergedDefaults.shortStrategy);
    }

    // Beta parameters
    if (mergedDefaults.beta) {
      Object.assign(flat, mergedDefaults.beta);
    }

    // Dynamic features
    if (mergedDefaults.dynamicFeatures) {
      Object.assign(flat, mergedDefaults.dynamicFeatures);
    }

    // Adaptive strategy
    if (mergedDefaults.adaptiveStrategy) {
      Object.assign(flat, mergedDefaults.adaptiveStrategy);
    }

    return flat;
  },

  /**
   * Check if a stock has specific parameter overrides
   *
   * @param {string} symbol - Stock symbol
   * @returns {boolean} True if stock has custom parameters
   */
  hasStockSpecificOverrides(symbol) {
    return backtestDefaults[symbol] !== undefined && backtestDefaults[symbol] !== null;
  },

  /**
   * Get list of all stocks with custom parameters
   *
   * @returns {Array} Array of stock symbols with custom parameters
   */
  getStocksWithOverrides() {
    const symbols = [];
    for (const key in backtestDefaults) {
      if (key !== 'global' && backtestDefaults[key]) {
        symbols.push(key);
      }
    }
    return symbols;
  },

  /**
   * Get differences between stock-specific and global defaults
   *
   * @param {string} symbol - Stock symbol
   * @returns {Object} Object with differences by section
   */
  getStockDifferences(symbol) {
    const globalDefaults = this.getGlobalDefaults();
    const stockDefaults = backtestDefaults[symbol] || {};

    return {
      symbol,
      hasOverrides: Object.keys(stockDefaults).length > 0,
      differences: stockDefaults
    };
  },

  /**
   * Load parameters from localStorage
   *
   * @param {string} key - localStorage key
   * @returns {Object|null} Stored parameters or null if not found
   */
  loadFromLocalStorage(key) {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
    return null;
  },

  /**
   * Save parameters to localStorage
   *
   * @param {string} key - localStorage key
   * @param {Object} parameters - Parameters to save
   */
  saveToLocalStorage(key, parameters) {
    try {
      localStorage.setItem(key, JSON.stringify(parameters));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  },

  /**
   * Clear parameters from localStorage
   *
   * @param {string} key - localStorage key
   */
  clearLocalStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  },

  /**
   * Parse URL parameters from query string
   *
   * @param {string} queryString - URL query string (e.g., from window.location.search)
   * @returns {Object} Parsed parameters
   */
  parseURLParameters(queryString) {
    const params = {};
    const searchParams = new URLSearchParams(queryString);

    for (const [key, value] of searchParams.entries()) {
      // Parse boolean values
      if (value === 'true') {
        params[key] = true;
      } else if (value === 'false') {
        params[key] = false;
      }
      // Parse numeric values
      else if (!isNaN(value) && value !== '') {
        params[key] = parseFloat(value);
      }
      // Parse array values (comma-separated)
      else if (value.includes(',')) {
        params[key] = value.split(',').map(v => v.trim());
      }
      // Keep as string
      else {
        params[key] = value;
      }
    }

    return params;
  },

  /**
   * Generate URL query string from parameters
   *
   * @param {Object} parameters - Parameters to encode
   * @returns {string} URL query string
   */
  generateURLParameters(parameters) {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(parameters)) {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          searchParams.set(key, value.join(','));
        } else {
          searchParams.set(key, String(value));
        }
      }
    }

    return searchParams.toString();
  },

  /**
   * Compare two parameter objects and return differences
   *
   * @param {Object} params1 - First parameter object
   * @param {Object} params2 - Second parameter object
   * @returns {Object} Object with differences
   */
  getDifferences(params1, params2) {
    const differences = {};

    const allKeys = new Set([...Object.keys(params1), ...Object.keys(params2)]);

    for (const key of allKeys) {
      const val1 = params1[key];
      const val2 = params2[key];

      // Skip functions and symbols
      if (typeof val1 === 'function' || typeof val2 === 'function') continue;

      // Handle nested objects
      if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
        const nestedDiff = this.getDifferences(val1, val2);
        if (Object.keys(nestedDiff).length > 0) {
          differences[key] = nestedDiff;
        }
      }
      // Compare primitive values
      else if (val1 !== val2) {
        differences[key] = {
          old: val1,
          new: val2
        };
      }
    }

    return differences;
  },

  /**
   * Get default parameters for portfolio mode
   *
   * @returns {Object} Portfolio default parameters
   */
  getPortfolioDefaults() {
    const globalDefaults = this.flattenDefaults(this.getGlobalDefaults());

    return {
      totalCapital: 500000,
      lotSizeUsd: 10000,
      maxLotsPerStock: 10,
      stocks: ['TSLA', 'AAPL', 'NVDA', 'MSFT'],
      startDate: '2020-01-01',
      endDate: new Date().toISOString().split('T')[0],
      defaultParams: {
        gridIntervalPercent: globalDefaults.gridIntervalPercent || 10,
        profitRequirement: globalDefaults.profitRequirement || 10,
        stopLossPercent: globalDefaults.stopLossPercent || 30,
        trailingBuyActivationPercent: globalDefaults.trailingBuyActivationPercent || 10,
        trailingBuyReboundPercent: globalDefaults.trailingBuyReboundPercent || 5,
        trailingSellActivationPercent: globalDefaults.trailingSellActivationPercent || 20,
        trailingSellPullbackPercent: globalDefaults.trailingSellPullbackPercent || 10,
        enableTrailingBuy: globalDefaults.enableTrailingBuy || false,
        enableTrailingSell: globalDefaults.enableTrailingSell || false,
        enableConsecutiveIncrementalBuyGrid: globalDefaults.enableConsecutiveIncrementalBuyGrid || false,
        gridConsecutiveIncrement: globalDefaults.gridConsecutiveIncrement || 5,
        enableConsecutiveIncrementalSellProfit: globalDefaults.enableConsecutiveIncrementalSellProfit || false,
        enableDynamicGrid: globalDefaults.enableDynamicGrid || false,
        dynamicGridMultiplier: globalDefaults.dynamicGridMultiplier || 1,
        enableScenarioDetection: globalDefaults.enableScenarioDetection || false,
        normalizeToReference: globalDefaults.normalizeToReference || false,
        enableAdaptiveStrategy: globalDefaults.enableAdaptiveStrategy || false
      }
    };
  },

  /**
   * Get default parameters for single stock mode
   *
   * @param {string} symbol - Stock symbol
   * @returns {Object} Single stock default parameters
   */
  getSingleStockDefaults(symbol = 'AAPL') {
    const stockDefaults = this.flattenDefaults(this.getStockDefaults(symbol));

    return {
      symbol,
      startDate: '2020-01-01',
      endDate: new Date().toISOString().split('T')[0],
      lotSizeUsd: stockDefaults.lotSizeUsd || 10000,
      maxLots: stockDefaults.maxLots || 10,
      maxLotsToSell: stockDefaults.maxLotsToSell || 1,
      strategyMode: stockDefaults.strategyMode || 'long',
      ...stockDefaults
    };
  }
};

export default ParameterHelper;
