const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/**
 * Ensure all required parameters exist with default values
 * This prevents undefined parameters from causing issues when saving
 * @param {object} parameters - Parameters object (may have missing values)
 * @returns {object} Complete parameters object with defaults for missing values
 */
function ensureCompleteParameters(parameters) {
  const requiredDefaults = {
    // Dynamic features
    enableDynamicGrid: false,
    dynamicGridMultiplier: 1,
    enableConsecutiveIncrementalBuyGrid: false,
    enableConsecutiveIncrementalSellProfit: false,
    enableScenarioDetection: false,
    normalizeToReference: false,
    gridConsecutiveIncrement: 5,
    // Spec 23: Average-based features
    enableAverageBasedGrid: false,
    enableAverageBasedSell: false
  };

  return { ...requiredDefaults, ...parameters };
}

/**
 * Get ticker-specific defaults from backend API
 * Backend returns ticker-specific defaults merged with global defaults
 * @param {string} symbol - Stock ticker symbol
 * @returns {Promise<object>} Default parameters for the ticker
 */
export async function getTickerDefaults(symbol) {
  const response = await fetch(`${API_BASE_URL}/api/backtest/defaults/${symbol}`);
  const data = await response.json();

  if (!data.success || !data.defaults) {
    throw new Error(data.message || 'Failed to load defaults');
  }

  console.log(`✅ Loaded defaults for ${symbol}`);
  // Ensure all required parameters exist
  return ensureCompleteParameters(data.defaults);
}

/**
 * Save ticker-specific defaults to backend API
 * @param {string} symbol - Stock ticker symbol
 * @param {object} parameters - Parameters to save (ticker-specific only)
 * @returns {Promise<object>} API response
 */
export async function saveTickerDefaults(symbol, parameters) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/backtest/defaults/${symbol}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ parameters })
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Saved defaults for ${symbol}`);
    } else {
      console.error(`❌ Failed to save defaults for ${symbol}:`, data.message);
    }

    return data;
  } catch (error) {
    console.error(`❌ Error saving defaults for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Extract ticker-specific parameters from form state
 * Removes non-ticker-specific fields like symbol, dates, mode, source
 * @param {object} allParameters - Complete form state
 * @returns {object} Ticker-specific parameters only
 */
export function extractTickerSpecificParams(allParameters) {
  const {
    symbol,
    startDate,
    endDate,
    availableSymbols,
    mode,
    source,
    ...tickerParams
  } = allParameters;

  return tickerParams;
}

export default {
  getTickerDefaults,
  saveTickerDefaults,
  extractTickerSpecificParams
};
