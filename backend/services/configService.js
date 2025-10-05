const fs = require('fs').promises;
const path = require('path');

/**
 * Service for managing ticker-specific default parameters
 */
class ConfigService {
  constructor(configPath) {
    this.configPath = configPath || path.join(__dirname, '../../config/backtestDefaults.json');
  }

  /**
   * Flatten nested object structure into a single level object
   * @param {object} nested - Nested object structure
   * @returns {object} Flattened object
   */
  flattenObject(nested) {
    const result = {};

    for (const [groupKey, groupValue] of Object.entries(nested)) {
      if (typeof groupValue === 'object' && groupValue !== null && !Array.isArray(groupValue)) {
        // Handle nested groups
        Object.assign(result, this.flattenObject(groupValue));
      } else {
        // Direct value
        result[groupKey] = groupValue;
      }
    }

    return result;
  }

  /**
   * Convert flat parameter object to nested structure
   * @param {object} flat - Flat parameter object
   * @returns {object} Nested structure
   */
  flatToNested(flat) {
    const nested = {
      basic: {},
      longStrategy: {},
      shortStrategy: {
        stopLoss: {}
      },
      beta: {},
      dynamicFeatures: {},
      adaptiveStrategy: {}
    };

    // Map flat keys to nested structure
    const mapping = {
      // Basic
      lotSizeUsd: 'basic',
      strategyMode: 'basic',

      // Long strategy
      maxLots: 'longStrategy',
      maxLotsToSell: 'longStrategy',
      gridIntervalPercent: 'longStrategy', // Will also be in shortStrategy
      profitRequirement: 'longStrategy', // Will also be in shortStrategy
      trailingBuyActivationPercent: 'longStrategy',
      trailingBuyReboundPercent: 'longStrategy',
      trailingSellActivationPercent: 'longStrategy',
      trailingSellPullbackPercent: 'longStrategy',

      // Short strategy
      maxShorts: 'shortStrategy',
      maxShortsToCovers: 'shortStrategy',
      trailingShortActivationPercent: 'shortStrategy',
      trailingShortPullbackPercent: 'shortStrategy',
      trailingCoverActivationPercent: 'shortStrategy',
      trailingCoverReboundPercent: 'shortStrategy',

      // Stop loss (nested under shortStrategy)
      hardStopLossPercent: 'shortStrategy.stopLoss',
      portfolioStopLossPercent: 'shortStrategy.stopLoss',
      cascadeStopLossPercent: 'shortStrategy.stopLoss',

      // Beta
      enableBetaScaling: 'beta',
      beta: 'beta',
      betaFactor: 'beta',
      coefficient: 'beta',
      isManualBetaOverride: 'beta',

      // Dynamic features
      enableDynamicGrid: 'dynamicFeatures',
      dynamicGridMultiplier: 'dynamicFeatures',
      enableConsecutiveIncremental: 'dynamicFeatures',
      enableConsecutiveIncrementalSellProfit: 'dynamicFeatures',
      enableScenarioDetection: 'dynamicFeatures',
      normalizeToReference: 'dynamicFeatures',

      // Adaptive strategy
      enableAdaptiveStrategy: 'adaptiveStrategy',
      adaptationCheckIntervalDays: 'adaptiveStrategy',
      adaptationRollingWindowDays: 'adaptiveStrategy',
      minDataDaysBeforeAdaptation: 'adaptiveStrategy',
      confidenceThreshold: 'adaptiveStrategy'
    };

    // Place each parameter in its group
    for (const [key, value] of Object.entries(flat)) {
      const group = mapping[key];
      if (group) {
        if (group.includes('.')) {
          // Nested group (e.g., shortStrategy.stopLoss)
          const [parent, child] = group.split('.');
          nested[parent][child][key] = value;
        } else {
          nested[group][key] = value;
        }

        // gridIntervalPercent and profitRequirement go in both long and short
        if (key === 'gridIntervalPercent' || key === 'profitRequirement') {
          nested.shortStrategy[key] = value;
        }
      }
    }

    // Remove empty groups
    for (const key of Object.keys(nested)) {
      if (Object.keys(nested[key]).length === 0) {
        delete nested[key];
      }
    }

    return nested;
  }

  /**
   * Get defaults for a specific ticker symbol
   * Returns ticker-specific defaults if they exist, otherwise returns global defaults
   * @param {string} symbol - Stock ticker symbol
   * @returns {Promise<object>} Default parameters for the ticker (flattened)
   */
  async getTickerDefaults(symbol) {
    try {
      // Read the config file
      const fileContent = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(fileContent);

      // Get global defaults from config file
      if (!config.global) {
        throw new Error('Missing "global" section in backtestDefaults.json');
      }

      // Flatten global defaults
      const flatGlobalDefaults = this.flattenObject(config.global);

      // Check if ticker-specific defaults exist
      if (config[symbol]) {
        console.log(`✅ Found ticker-specific defaults for ${symbol}`);
        const flatTickerDefaults = this.flattenObject(config[symbol]);
        return { ...flatGlobalDefaults, ...flatTickerDefaults }; // Merge global with ticker-specific
      }

      // Return global defaults if ticker-specific not found
      console.log(`ℹ️  No ticker-specific defaults for ${symbol}, using global defaults`);
      return flatGlobalDefaults;

    } catch (error) {
      console.error(`❌ Error reading config for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Save ticker-specific defaults
   * @param {string} symbol - Stock ticker symbol
   * @param {object} parameters - Parameters to save (flat structure)
   * @returns {Promise<void>}
   */
  async saveTickerDefaults(symbol, parameters) {
    // Validate parameters first
    const validation = this.validateParameters(parameters);
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }

    try {
      let config = {};

      // Try to read existing config
      try {
        const fileContent = await fs.readFile(this.configPath, 'utf8');
        config = JSON.parse(fileContent);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`⚠️  Could not read existing config: ${error.message}`);
        }
        // If file doesn't exist, start with empty config
      }

      // Convert flat parameters to nested structure
      const nestedParameters = this.flatToNested(parameters);

      // Update ticker-specific defaults
      config[symbol] = nestedParameters;

      // Write back to file
      await fs.writeFile(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf8'
      );

      console.log(`✅ Saved ticker-specific defaults for ${symbol}`);

    } catch (error) {
      console.error(`❌ Error saving defaults for ${symbol}:`, error.message);
      throw new Error(`Failed to save defaults: ${error.message}`);
    }
  }

  /**
   * Validate parameter values
   * @param {object} parameters - Parameters to validate
   * @returns {object} Validation result with {valid: boolean, errors: string[]}
   */
  validateParameters(parameters) {
    const errors = [];

    // Check for required numeric fields
    const numericFields = [
      'lotSizeUsd', 'maxLots', 'maxLotsToSell',
      'gridIntervalPercent', 'profitRequirement',
      'trailingBuyActivationPercent', 'trailingBuyReboundPercent',
      'trailingSellActivationPercent', 'trailingSellPullbackPercent',
      'maxShorts', 'maxShortsToCovers',
      'trailingShortActivationPercent', 'trailingShortPullbackPercent',
      'trailingCoverActivationPercent', 'trailingCoverReboundPercent',
      'hardStopLossPercent', 'portfolioStopLossPercent', 'cascadeStopLossPercent',
      'beta', 'betaFactor', 'coefficient',
      'dynamicGridMultiplier',
      'adaptationCheckIntervalDays', 'adaptationRollingWindowDays',
      'minDataDaysBeforeAdaptation', 'confidenceThreshold'
    ];

    for (const field of numericFields) {
      if (parameters[field] !== undefined) {
        const value = parameters[field];
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push(`${field} must be a number`);
        } else if (value < 0) {
          errors.push(`${field} must be non-negative`);
        }
      }
    }

    // Validate specific constraints
    if (parameters.lotSizeUsd !== undefined && parameters.lotSizeUsd <= 0) {
      errors.push('lotSizeUsd must be greater than 0');
    }

    if (parameters.maxLots !== undefined && parameters.maxLots < 1) {
      errors.push('maxLots must be at least 1');
    }

    if (parameters.maxLotsToSell !== undefined && parameters.maxLotsToSell < 1) {
      errors.push('maxLotsToSell must be at least 1');
    }

    if (parameters.maxLots !== undefined && parameters.maxLotsToSell !== undefined) {
      if (parameters.maxLotsToSell > parameters.maxLots) {
        errors.push('maxLotsToSell cannot exceed maxLots');
      }
    }

    if (parameters.confidenceThreshold !== undefined) {
      if (parameters.confidenceThreshold < 0 || parameters.confidenceThreshold > 1) {
        errors.push('confidenceThreshold must be between 0 and 1');
      }
    }

    // Validate strategyMode
    if (parameters.strategyMode !== undefined) {
      if (!['long', 'SHORT_DCA'].includes(parameters.strategyMode)) {
        errors.push('strategyMode must be either "long" or "SHORT_DCA"');
      }
    }

    // Validate boolean fields
    const booleanFields = [
      'enableBetaScaling', 'isManualBetaOverride',
      'enableConsecutiveIncremental', 'enableDynamicGrid',
      'enableConsecutiveIncrementalSellProfit',
      'enableScenarioDetection', 'enableAdaptiveStrategy',
      'normalizeToReference'
    ];

    for (const field of booleanFields) {
      if (parameters[field] !== undefined && typeof parameters[field] !== 'boolean') {
        errors.push(`${field} must be a boolean`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = ConfigService;
