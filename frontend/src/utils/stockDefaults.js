import { getConfigSync } from '../services/configService';

/**
 * Get stock-specific parameters merged with global defaults
 * @param {string} symbol - Stock symbol
 * @returns {object} - Merged parameters for the stock
 */
export const getStockParameters = (symbol) => {
  const backtestDefaults = getConfigSync();
  const globalDefaults = backtestDefaults.global;
  const stockSpecific = backtestDefaults[symbol];

  if (!stockSpecific) {
    // Return global defaults if no stock-specific config exists
    return {
      symbol,
      ...globalDefaults
    };
  }

  // Deep merge stock-specific with global defaults
  return {
    symbol,
    basic: {
      ...globalDefaults.basic,
      ...(stockSpecific.basic || {})
    },
    longStrategy: {
      ...globalDefaults.longStrategy,
      ...(stockSpecific.longStrategy || {})
    },
    shortStrategy: {
      ...globalDefaults.shortStrategy,
      ...(stockSpecific.shortStrategy || {}),
      stopLoss: {
        ...(globalDefaults.shortStrategy?.stopLoss || {}),
        ...(stockSpecific.shortStrategy?.stopLoss || {})
      }
    },
    beta: {
      ...globalDefaults.beta,
      ...(stockSpecific.beta || {})
    },
    dynamicFeatures: {
      ...globalDefaults.dynamicFeatures,
      ...(stockSpecific.dynamicFeatures || {})
    },
    adaptiveStrategy: {
      ...globalDefaults.adaptiveStrategy,
      ...(stockSpecific.adaptiveStrategy || {})
    }
  };
};

/**
 * Check if a stock has specific configuration in backtestDefaults.json
 * @param {string} symbol - Stock symbol
 * @returns {boolean} - True if stock has specific config
 */
export const hasStockSpecificDefaults = (symbol) => {
  const backtestDefaults = getConfigSync();
  return backtestDefaults.hasOwnProperty(symbol);
};

/**
 * Get available stock symbols from backtestDefaults.json
 * @returns {string[]} - Array of stock symbols with specific configs
 */
export const getStocksWithDefaults = () => {
  const backtestDefaults = getConfigSync();
  return Object.keys(backtestDefaults).filter(key => key !== 'global');
};

/**
 * Get the list of all available stocks (for now, hardcoded based on database query)
 * TODO: This should ideally come from an API endpoint
 */
export const getAllAvailableStocks = () => {
  return [
    'TSLA', 'APP', 'HOOD', 'SEZL', 'HIMS', 'SOFI', 'AMD', 'RXRX',
    'CRCL', 'CRWV', 'FIGR', 'NBIS', 'AMSC', 'COIN', 'HYLN', 'SNDK',
    'WDC', 'CRDO', 'IDCC', 'SOUN', 'BITF', 'CIFR', 'ONDS', 'NVDA',
    'PLTR', 'ALAB', 'QBTS', 'AVGO', 'ORCL', 'IREN', 'FIG', 'OPEN', 'RDDT'
  ];
};

/**
 * Get default stock selection (10 stocks, prioritizing those with specific configs)
 */
export const getDefaultStockSelection = () => {
  const stocksWithDefaults = getStocksWithDefaults(); // PLTR, AAPL, TSLA, SHOP, MSFT
  const allStocks = getAllAvailableStocks();

  // Prioritize stocks with defaults, then add others to reach 10
  const defaultSelection = [];

  // Add stocks with specific defaults first
  stocksWithDefaults.forEach(symbol => {
    if (allStocks.includes(symbol) && defaultSelection.length < 10) {
      defaultSelection.push(symbol);
    }
  });

  // Add remaining stocks to reach 10
  allStocks.forEach(symbol => {
    if (!defaultSelection.includes(symbol) && defaultSelection.length < 10) {
      defaultSelection.push(symbol);
    }
  });

  return defaultSelection;
};

/**
 * Format parameters for API call (convert percentages from UI format to API format)
 * @param {object} params - Parameters in UI format (0-100)
 * @returns {object} - Parameters in API format (0-1)
 */
export const formatParametersForAPI = (params) => {
  return {
    gridIntervalPercent: params.gridIntervalPercent / 100,
    profitRequirement: params.profitRequirement / 100,
    stopLossPercent: params.stopLossPercent ? params.stopLossPercent / 100 : undefined,
    trailingBuyActivationPercent: params.trailingBuyActivationPercent ? params.trailingBuyActivationPercent / 100 : undefined,
    trailingBuyReboundPercent: params.trailingBuyReboundPercent ? params.trailingBuyReboundPercent / 100 : undefined,
    trailingSellActivationPercent: params.trailingSellActivationPercent ? params.trailingSellActivationPercent / 100 : undefined,
    trailingSellPullbackPercent: params.trailingSellPullbackPercent ? params.trailingSellPullbackPercent / 100 : undefined
  };
};

export default {
  getStockParameters,
  hasStockSpecificDefaults,
  getStocksWithDefaults,
  getAllAvailableStocks,
  getDefaultStockSelection,
  formatParametersForAPI
};
