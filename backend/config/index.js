/**
 * Centralized Configuration
 *
 * Single source of truth for all application configuration.
 * Loads from environment variables with sensible defaults.
 */

require('dotenv').config();

const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3001,
    env: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*'
  },

  // Database Configuration
  database: {
    path: process.env.DB_PATH || './data/stocks.db',
    enableWAL: process.env.DB_WAL === 'true'
  },

  // API Keys
  api: {
    alphaVantage: process.env.ALPHA_VANTAGE_API_KEY || '',
    yahooFinance: {
      baseUrl: 'https://query1.finance.yahoo.com/v8/finance/chart',
      timeout: parseInt(process.env.YAHOO_TIMEOUT || '30000'),
      retries: parseInt(process.env.YAHOO_RETRIES || '3')
    }
  },

  // Backtest Defaults
  backtest: {
    defaultStartDate: '2021-09-01',
    defaultEndDate: new Date().toISOString().split('T')[0],
    defaultLotSize: 10000,
    defaultMaxLots: 10,
    defaultProfitRequirement: 0.05,
    defaultGridInterval: 0.1,
    maxBatchCombinations: 1000
  },

  // Beta Configuration
  beta: {
    cacheExpiry: parseInt(process.env.BETA_CACHE_DAYS || '30') * 24 * 60 * 60 * 1000,
    defaultBeta: 1.0,
    validRange: { min: 0.1, max: 5.0 }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'INFO',
    enableConsole: process.env.LOG_CONSOLE !== 'false',
    enableFile: process.env.LOG_FILE === 'true',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log'
  },

  // Performance Configuration
  performance: {
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    enableProfiling: process.env.ENABLE_PROFILING === 'true'
  },

  // Feature Flags
  features: {
    enableBetaScaling: process.env.FEATURE_BETA_SCALING !== 'false',
    enableShortSelling: process.env.FEATURE_SHORT_SELLING !== 'false',
    enableBatchBacktest: process.env.FEATURE_BATCH !== 'false',
    enableValidation: process.env.FEATURE_VALIDATION !== 'false'
  }
};

/**
 * Validate required configuration
 * @throws {Error} If required config is missing
 */
function validateConfig() {
  const errors = [];

  // Alpha Vantage key is optional since we have Yahoo Finance as fallback
  // No critical errors to check - all providers have fallbacks

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}

// Validate on load
if (process.env.NODE_ENV !== 'test') {
  validateConfig();
}

module.exports = config;
