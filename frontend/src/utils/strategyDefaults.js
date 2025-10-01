import defaultsConfig from '../config/strategyDefaults.json';

/**
 * Get default parameters for a specific symbol and strategy mode
 * Falls back to 'default' if symbol-specific config doesn't exist
 *
 * @param {string} symbol - The stock symbol (e.g., 'TSLA', 'NVDA')
 * @param {string} strategyMode - 'long' or 'short'
 * @returns {object} Default parameters for the strategy
 */
export const getDefaultParameters = (symbol, strategyMode = 'long') => {
  // Try to get symbol-specific defaults
  const symbolDefaults = defaultsConfig[symbol]?.[strategyMode];

  // Fall back to global defaults if symbol-specific doesn't exist
  const defaults = symbolDefaults || defaultsConfig.default[strategyMode];

  if (!defaults) {
    console.error(`No defaults found for symbol: ${symbol}, strategy: ${strategyMode}`);
    return {};
  }

  // Return a copy to prevent mutation
  return { ...defaults, symbol };
};

/**
 * Get all available symbols that have custom defaults
 *
 * @returns {string[]} Array of symbol names
 */
export const getAvailableSymbols = () => {
  return Object.keys(defaultsConfig).filter(key => key !== 'default');
};

/**
 * Check if a symbol has custom defaults
 *
 * @param {string} symbol - The stock symbol
 * @returns {boolean} True if custom defaults exist
 */
export const hasCustomDefaults = (symbol) => {
  return defaultsConfig[symbol] !== undefined;
};

/**
 * Reset parameters to defaults for current symbol and strategy
 * This is the single source of truth for reset operations
 *
 * @param {string} symbol - Current symbol
 * @param {string} strategyMode - Current strategy mode
 * @returns {object} Default parameters
 */
export const resetToDefaults = (symbol, strategyMode) => {
  console.log(`🔄 Resetting to defaults for ${symbol} (${strategyMode})`);
  const defaults = getDefaultParameters(symbol, strategyMode);
  console.log('📋 Loaded defaults:', defaults);
  return defaults;
};

export default {
  getDefaultParameters,
  getAvailableSymbols,
  hasCustomDefaults,
  resetToDefaults
};
