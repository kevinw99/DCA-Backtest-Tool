/**
 * Portfolio Config Loader Service
 *
 * Loads, validates, and converts portfolio config files to backtest parameters.
 * Provides detailed error messages.
 */

const fs = require('fs').promises;
const path = require('path');

// Config directory
const CONFIG_DIR = path.join(__dirname, '../configs/portfolios');

/**
 * Load and validate a portfolio config file
 * @param {string} configName - Config file name (with or without .json extension)
 * @returns {Promise<Object>} Validated config object
 * @throws {Error} If config invalid or not found
 */
async function loadPortfolioConfig(configName) {
  // Sanitize config name (remove .json if present)
  const sanitized = sanitizeConfigName(configName);

  // Build file path
  const filePath = path.join(CONFIG_DIR, `${sanitized}.json`);

  console.log(`📋 Loading portfolio config: ${sanitized} from ${filePath}`);

  // Check file exists
  try {
    await fs.access(filePath);
  } catch (error) {
    throw new Error(`Config file not found: ${sanitized}.json (looked in ${CONFIG_DIR})`);
  }

  // Read file
  let fileContent;
  try {
    fileContent = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read config file ${sanitized}.json: ${error.message}`);
  }

  // Parse JSON
  let config;
  try {
    config = JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Invalid JSON in config file ${sanitized}.json: ${error.message}`);
  }

  // Validate config structure
  validateConfig(config);

  console.log(`✅ Config loaded successfully: ${config.name} (${config.stocks.length} stocks)`);

  return config;
}

/**
 * Convert config to portfolio backtest parameters
 * @param {Object} config - Validated config object
 * @returns {Object} Parameters for portfolioBacktestService.runPortfolioBacktest()
 */
function configToBacktestParams(config) {
  const {
    totalCapitalUsd,
    marginPercent,
    startDate,
    endDate,
    globalDefaults,
    stocks,
    stockSpecificOverrides = {}
  } = config;

  // Extract portfolio-level parameters from globalDefaults
  const lotSizeUsd = globalDefaults.basic?.lotSizeUsd || globalDefaults.lotSizeUsd || 10000;
  const maxLotsPerStock = globalDefaults.longStrategy?.maxLots || globalDefaults.maxLots || 10;

  // Flatten nested config structure to flat DCA parameters expected by executor
  const flattenedDefaults = flattenConfigToParams(globalDefaults);

  // Build stocks array with merged parameters
  const stocksWithParams = stocks.map(symbol => {
    const stockOverrides = stockSpecificOverrides[symbol] || {};

    // Merge flattened global defaults with stock-specific overrides
    const mergedParams = { ...flattenedDefaults, ...flattenConfigToParams(stockOverrides) };

    return {
      symbol,
      params: mergedParams
    };
  });

  // Spec 61: Extract optimizedTotalCapital from capitalOptimization
  const capitalOptimization = config.capitalOptimization || { enabled: false };
  const optimizedTotalCapital = capitalOptimization.optimizedTotalCapital || false;

  // Convert to format expected by portfolioBacktestService
  return {
    totalCapital: totalCapitalUsd,
    marginPercent: marginPercent !== undefined ? marginPercent : 0,  // Spec 50: Include margin parameter
    startDate: endDate === 'current' ? startDate : startDate,
    endDate: endDate === 'current' ? getCurrentDate() : endDate,
    lotSizeUsd,
    maxLotsPerStock,
    defaultParams: flattenedDefaults,  // Use flattened parameters
    stocks: stocksWithParams,
    indexTracking: config.indexTracking || { enabled: false },
    capitalOptimization: capitalOptimization,
    optimizedTotalCapital: optimizedTotalCapital  // Spec 61: Pass optimizedTotalCapital to backtest service
  };
}

/**
 * Validate config structure and values
 * @param {Object} config - Config object to validate
 * @throws {Error} If validation fails with descriptive message
 */
function validateConfig(config) {
  // Required fields
  const requiredFields = ['name', 'totalCapitalUsd', 'startDate', 'endDate', 'globalDefaults', 'stocks'];

  for (const field of requiredFields) {
    if (!(field in config)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate name
  if (typeof config.name !== 'string' || config.name.trim().length === 0) {
    throw new Error('Field "name" must be a non-empty string');
  }

  // Validate totalCapitalUsd
  if (typeof config.totalCapitalUsd !== 'number' || config.totalCapitalUsd < 1000) {
    throw new Error('Field "totalCapitalUsd" must be a number >= 1000');
  }

  // Spec 50: Validate marginPercent if present
  if (config.marginPercent !== undefined) {
    if (typeof config.marginPercent !== 'number') {
      throw new Error('Field "marginPercent" must be a number');
    }

    if (config.marginPercent < 0) {
      throw new Error('Field "marginPercent" must be >= 0');
    }

    if (config.marginPercent > 100) {
      throw new Error('Field "marginPercent" must be <= 100 (maximum 100% leverage)');
    }

    if (!Number.isFinite(config.marginPercent)) {
      throw new Error('Field "marginPercent" must be a finite number (not NaN or Infinity)');
    }
  }

  // Set default if not provided
  if (config.marginPercent === undefined) {
    config.marginPercent = 0;
  }

  // Validate dates
  if (!isValidDate(config.startDate)) {
    throw new Error(`Invalid date format for "startDate": ${config.startDate} (expected YYYY-MM-DD)`);
  }

  if (config.endDate !== 'current' && !isValidDate(config.endDate)) {
    throw new Error(`Invalid date format for "endDate": ${config.endDate} (expected YYYY-MM-DD or "current")`);
  }

  // Validate globalDefaults
  if (typeof config.globalDefaults !== 'object' || config.globalDefaults === null) {
    throw new Error('Field "globalDefaults" must be an object');
  }

  // Validate stocks array
  if (!Array.isArray(config.stocks)) {
    throw new Error('Field "stocks" must be an array');
  }

  if (config.stocks.length === 0) {
    throw new Error('Field "stocks" cannot be empty - must contain at least one stock symbol');
  }

  // Validate each stock symbol
  for (let i = 0; i < config.stocks.length; i++) {
    const symbol = config.stocks[i];
    if (typeof symbol !== 'string' || symbol.trim().length === 0) {
      throw new Error(`Invalid stock symbol at index ${i}: must be a non-empty string`);
    }
    if (!/^[A-Z0-9.-]+$/.test(symbol)) {
      throw new Error(`Invalid stock symbol at index ${i}: "${symbol}" (must be uppercase letters, numbers, dots, or hyphens)`);
    }
  }

  // Validate stockSpecificOverrides if present
  if (config.stockSpecificOverrides) {
    if (typeof config.stockSpecificOverrides !== 'object' || config.stockSpecificOverrides === null) {
      throw new Error('Field "stockSpecificOverrides" must be an object');
    }

    // Validate that override keys are valid stock symbols
    for (const symbol of Object.keys(config.stockSpecificOverrides)) {
      if (!config.stocks.includes(symbol)) {
        throw new Error(`Stock override for "${symbol}" but "${symbol}" not in stocks array`);
      }
    }
  }

  // Validate globalDefaults has required nested structure
  validateGlobalDefaults(config.globalDefaults);

  // Validate indexTracking if present
  if (config.indexTracking) {
    validateIndexTracking(config.indexTracking);
  }

  // Validate capitalOptimization if present
  if (config.capitalOptimization) {
    validateCapitalOptimization(config.capitalOptimization);
  }
}

/**
 * Validate globalDefaults structure
 * @param {Object} defaults - Global defaults object
 * @throws {Error} If invalid
 */
function validateGlobalDefaults(defaults) {
  // Check for basic structure (either flat or nested)
  const hasNestedStructure = defaults.basic || defaults.longStrategy || defaults.shortStrategy;
  const hasFlatStructure = defaults.lotSizeUsd !== undefined || defaults.maxLots !== undefined;

  if (!hasNestedStructure && !hasFlatStructure) {
    throw new Error(
      'globalDefaults must contain either nested structure (basic, longStrategy, etc.) ' +
      'or flat structure (lotSizeUsd, maxLots, etc.)'
    );
  }

  // If nested structure, validate basic fields
  if (hasNestedStructure) {
    if (defaults.basic) {
      if (defaults.basic.lotSizeUsd === undefined) {
        throw new Error('globalDefaults.basic must contain "lotSizeUsd"');
      }
      if (typeof defaults.basic.lotSizeUsd !== 'number' || defaults.basic.lotSizeUsd < 100) {
        throw new Error('globalDefaults.basic.lotSizeUsd must be a number >= 100');
      }
    }

    if (defaults.longStrategy) {
      if (defaults.longStrategy.maxLots === undefined) {
        throw new Error('globalDefaults.longStrategy must contain "maxLots"');
      }
      if (typeof defaults.longStrategy.maxLots !== 'number' || defaults.longStrategy.maxLots < 1) {
        throw new Error('globalDefaults.longStrategy.maxLots must be a number >= 1');
      }
    }
  }

  // If flat structure, validate required fields
  if (hasFlatStructure) {
    if (defaults.lotSizeUsd !== undefined) {
      if (typeof defaults.lotSizeUsd !== 'number' || defaults.lotSizeUsd < 100) {
        throw new Error('globalDefaults.lotSizeUsd must be a number >= 100');
      }
    }

    if (defaults.maxLots !== undefined) {
      if (typeof defaults.maxLots !== 'number' || defaults.maxLots < 1) {
        throw new Error('globalDefaults.maxLots must be a number >= 1');
      }
    }
  }
}

/**
 * Validate date format (YYYY-MM-DD)
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid
 */
function isValidDate(dateStr) {
  if (typeof dateStr !== 'string') return false;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;

  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
}

/**
 * Sanitize config name (prevent directory traversal)
 * @param {string} configName - Config name to sanitize
 * @returns {string} Sanitized config name
 */
function sanitizeConfigName(configName) {
  // Remove .json extension if present
  let sanitized = configName.replace(/\.json$/, '');

  // Remove any path separators or dangerous characters
  sanitized = sanitized.replace(/[^a-zA-Z0-9-_]/g, '');

  if (sanitized.length === 0) {
    throw new Error('Invalid config name');
  }

  return sanitized;
}

/**
 * Flatten nested config structure to flat DCA parameters
 * Converts {basic: {}, longStrategy: {}, ...} to flat {param1: val1, param2: val2, ...}
 * @param {Object} nestedConfig - Nested config object
 * @returns {Object} Flattened parameters for DCA executor
 */
function flattenConfigToParams(nestedConfig) {
  const flattened = {};

  // Extract from all nested sections
  const sections = ['basic', 'longStrategy', 'shortStrategy', 'beta', 'dynamicFeatures', 'adaptiveStrategy'];

  for (const section of sections) {
    if (nestedConfig[section] && typeof nestedConfig[section] === 'object') {
      Object.assign(flattened, nestedConfig[section]);
    }
  }

  // Also include any top-level parameters (for backward compatibility with flat configs)
  for (const key in nestedConfig) {
    if (nestedConfig.hasOwnProperty(key) && !sections.includes(key)) {
      flattened[key] = nestedConfig[key];
    }
  }

  // Convert percentage values from whole numbers to decimals (if needed)
  // The DCA executor expects decimal format (e.g., 0.10 for 10%)
  const percentageFields = [
    'gridIntervalPercent',
    'profitRequirement',
    'stopLossPercent',
    'trailingBuyActivationPercent',
    'trailingBuyReboundPercent',
    'trailingSellActivationPercent',
    'trailingSellPullbackPercent',
    'gridConsecutiveIncrement'
  ];

  for (const field of percentageFields) {
    if (flattened[field] !== undefined && flattened[field] > 1) {
      // Convert from whole number (10) to decimal (0.10)
      flattened[field] = flattened[field] / 100;
    }
  }

  return flattened;
}

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const output = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (isObject(source[key]) && isObject(target[key])) {
        output[key] = deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }
  }

  return output;
}

/**
 * Check if value is a plain object
 * @param {*} obj - Value to check
 * @returns {boolean} True if plain object
 */
function isObject(obj) {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
}

/**
 * Validate indexTracking configuration
 * @param {Object} indexTracking - Index tracking config
 * @throws {Error} If invalid
 */
function validateIndexTracking(indexTracking) {
  if (typeof indexTracking !== 'object' || indexTracking === null) {
    throw new Error('Field "indexTracking" must be an object');
  }

  if (indexTracking.enabled !== undefined && typeof indexTracking.enabled !== 'boolean') {
    throw new Error('Field "indexTracking.enabled" must be a boolean');
  }

  if (indexTracking.indexName && typeof indexTracking.indexName !== 'string') {
    throw new Error('Field "indexTracking.indexName" must be a string');
  }
}

/**
 * Validate capitalOptimization configuration
 * @param {Object} capitalOptimization - Capital optimization config
 * @throws {Error} If invalid
 */
function validateCapitalOptimization(capitalOptimization) {
  if (typeof capitalOptimization !== 'object' || capitalOptimization === null) {
    throw new Error('Field "capitalOptimization" must be an object');
  }

  if (capitalOptimization.enabled !== undefined && typeof capitalOptimization.enabled !== 'boolean') {
    throw new Error('Field "capitalOptimization.enabled" must be a boolean');
  }

  if (capitalOptimization.strategies && !Array.isArray(capitalOptimization.strategies)) {
    throw new Error('Field "capitalOptimization.strategies" must be an array');
  }

  // Validate adaptive lot sizing config if present
  if (capitalOptimization.adaptiveLotSizing) {
    const als = capitalOptimization.adaptiveLotSizing;
    if (als.cashReserveThreshold !== undefined && (typeof als.cashReserveThreshold !== 'number' || als.cashReserveThreshold < 0)) {
      throw new Error('Field "capitalOptimization.adaptiveLotSizing.cashReserveThreshold" must be a non-negative number');
    }
    if (als.maxLotSizeMultiplier !== undefined && (typeof als.maxLotSizeMultiplier !== 'number' || als.maxLotSizeMultiplier < 1)) {
      throw new Error('Field "capitalOptimization.adaptiveLotSizing.maxLotSizeMultiplier" must be a number >= 1');
    }
  }

  // Validate cash yield config if present
  if (capitalOptimization.cashYield) {
    const cy = capitalOptimization.cashYield;
    if (cy.enabled !== undefined && typeof cy.enabled !== 'boolean') {
      throw new Error('Field "capitalOptimization.cashYield.enabled" must be a boolean');
    }
    if (cy.annualYieldPercent !== undefined && (typeof cy.annualYieldPercent !== 'number' || cy.annualYieldPercent < 0 || cy.annualYieldPercent > 100)) {
      throw new Error('Field "capitalOptimization.cashYield.annualYieldPercent" must be between 0 and 100');
    }
  }
}

/**
 * Get current date in YYYY-MM-DD format
 * @returns {string} Current date
 */
function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get list of all available config files
 * @returns {Promise<Array<string>>} Array of config names (without .json extension)
 */
async function listAvailableConfigs() {
  try {
    const files = await fs.readdir(CONFIG_DIR);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace(/\.json$/, ''));
  } catch (error) {
    console.error(`Failed to list configs: ${error.message}`);
    return [];
  }
}

module.exports = {
  loadPortfolioConfig,
  configToBacktestParams,
  validateConfig,
  listAvailableConfigs,
  getCurrentDate
};
