/**
 * BetaService - Enhanced beta fetching with backtestDefaults.json integration
 *
 * Multi-tier beta resolution:
 * Tier 1: backtestDefaults.json (user-defined overrides) - highest priority
 * Tier 2-6: betaDataService (database cache → providers → fallback)
 *
 * This service wraps betaDataService to add file-based configuration support (Spec 42).
 */

const betaDataService = require('./betaDataService');
const path = require('path');
const fs = require('fs').promises;

class BetaService {
  constructor() {
    this.DEFAULTS_PATH = path.join(__dirname, '../../frontend/src/config/backtestDefaults.json');
    this.defaultsCache = null;
    this.defaultsCacheTime = null;
    this.DEFAULTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Load backtestDefaults.json with caching
   * @returns {Promise<Object>} Defaults configuration
   */
  async loadDefaults() {
    const now = Date.now();

    // Return cached defaults if still fresh
    if (this.defaultsCache && this.defaultsCacheTime && (now - this.defaultsCacheTime) < this.DEFAULTS_CACHE_TTL) {
      return this.defaultsCache;
    }

    try {
      const data = await fs.readFile(this.DEFAULTS_PATH, 'utf8');
      this.defaultsCache = JSON.parse(data);
      this.defaultsCacheTime = now;
      return this.defaultsCache;
    } catch (error) {
      console.error('Error loading backtestDefaults.json:', error.message);
      // Return empty object on error (fall through to database/provider)
      return {};
    }
  }

  /**
   * Get beta value from backtestDefaults.json
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object|null>} Beta data or null if not found
   */
  async getBetaFromFile(symbol) {
    try {
      const defaults = await this.loadDefaults();
      const upperSymbol = symbol.toUpperCase();

      // Check stock-specific beta
      if (defaults[upperSymbol]?.beta?.beta !== undefined) {
        const betaValue = defaults[upperSymbol].beta.beta;
        console.log(`📄 File: Using beta ${betaValue} for ${symbol} from backtestDefaults.json`);

        return {
          beta: betaValue,
          source: 'file',
          lastUpdated: null, // File-based values don't have timestamps
          isManualOverride: true, // File values are user-defined
          providerName: 'backtestDefaults.json',
          metadata: {
            fromFile: true,
            stockSpecific: true
          }
        };
      }

      // Check global beta
      if (defaults.global?.beta?.beta !== undefined) {
        const betaValue = defaults.global.beta.beta;
        console.log(`📄 File: Using global beta ${betaValue} for ${symbol} from backtestDefaults.json`);

        return {
          beta: betaValue,
          source: 'file',
          lastUpdated: null,
          isManualOverride: true,
          providerName: 'backtestDefaults.json',
          metadata: {
            fromFile: true,
            stockSpecific: false
          }
        };
      }

      // No file-based beta found
      return null;

    } catch (error) {
      console.error(`Error getting beta from file for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Get beta value with multi-tier resolution
   * Tier 1: backtestDefaults.json (highest priority)
   * Tier 2-6: betaDataService (database → provider → fallback)
   *
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Beta data
   */
  async getBeta(symbol) {
    // Tier 1: Check backtestDefaults.json
    const fileBeta = await this.getBetaFromFile(symbol);
    if (fileBeta) {
      return fileBeta;
    }

    // Tier 2-6: Delegate to betaDataService
    const providerBeta = await betaDataService.fetchBeta(symbol);

    return providerBeta;
  }

  /**
   * Get beta values for multiple symbols (batch operation)
   * Fetches in parallel for performance
   *
   * @param {string[]} symbols - Array of stock symbols
   * @returns {Promise<Object>} Object keyed by symbol with beta data
   */
  async getBetaBatch(symbols) {
    const betas = {};

    // Fetch all betas in parallel
    const promises = symbols.map(async (symbol) => {
      try {
        const betaData = await this.getBeta(symbol);
        betas[symbol.toUpperCase()] = betaData;
      } catch (error) {
        console.error(`Error fetching beta for ${symbol}:`, error);
        // Fallback to default
        betas[symbol.toUpperCase()] = {
          beta: 1.0,
          source: 'default',
          lastUpdated: new Date().toISOString(),
          isManualOverride: false,
          metadata: { error: error.message }
        };
      }
    });

    await Promise.all(promises);

    return betas;
  }

  /**
   * Refresh beta from provider (force fetch, skip cache)
   * File-based betas cannot be refreshed (must edit backtestDefaults.json)
   *
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Refreshed beta data
   */
  async refreshBeta(symbol) {
    // Check if file override exists
    const fileBeta = await this.getBetaFromFile(symbol);
    if (fileBeta) {
      throw new Error(
        `Cannot refresh beta for ${symbol}: value is defined in backtestDefaults.json. ` +
        `To change this beta value, edit the backtestDefaults.json file.`
      );
    }

    // Get current cached value (before refresh)
    const previousBeta = await betaDataService.getCachedBeta(symbol);
    const previousValue = previousBeta?.beta;

    // Remove cached beta to force fresh fetch
    const stock = await this.getStockBySymbol(symbol);
    if (stock) {
      const database = require('../database');
      await database.deleteBeta(stock.id);
    }

    // Fetch fresh beta
    const newBeta = await betaDataService.fetchBeta(symbol);

    return {
      symbol: symbol.toUpperCase(),
      beta: newBeta.beta,
      source: newBeta.source,
      lastUpdated: newBeta.lastUpdated,
      previousBeta: previousValue || null,
      changed: previousValue ? (previousValue !== newBeta.beta) : true,
      providerName: newBeta.metadata?.providerName || newBeta.source
    };
  }

  /**
   * Calculate age of beta data in seconds
   * @param {string} lastUpdated - ISO timestamp
   * @returns {number} Age in seconds
   */
  calculateAge(lastUpdated) {
    if (!lastUpdated) return null;
    const updated = new Date(lastUpdated);
    const now = new Date();
    return Math.floor((now - updated) / 1000);
  }

  /**
   * Check if beta is stale (based on config)
   * @param {Object} betaData - Beta data with lastUpdated
   * @returns {boolean} True if stale
   */
  isBetaStale(betaData) {
    // File-based betas are never stale
    if (betaData.source === 'file' || betaData.isManualOverride) {
      return false;
    }

    return betaDataService.isBetaFresh(betaData) === false;
  }

  /**
   * Get stock record by symbol (helper)
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object|null>} Stock record
   */
  async getStockBySymbol(symbol) {
    const database = require('../database');
    return await database.getStock(symbol);
  }

  /**
   * Set manual beta override in database
   * This is different from file-based beta (which has higher priority)
   *
   * @param {string} symbol - Stock symbol
   * @param {number} beta - Beta value
   * @returns {Promise<Object>} Updated beta data
   */
  async setManualBeta(symbol, beta) {
    // Check if file override exists
    const fileBeta = await this.getBetaFromFile(symbol);
    if (fileBeta) {
      console.warn(
        `Warning: Setting manual beta for ${symbol}, but backtestDefaults.json has beta ${fileBeta.beta}. ` +
        `File-based beta will take precedence.`
      );
    }

    return await betaDataService.setManualBeta(symbol, beta);
  }

  /**
   * Remove manual beta override
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Fresh beta data
   */
  async removeManualBeta(symbol) {
    return await betaDataService.removeManualBeta(symbol);
  }

  /**
   * Clear defaults cache (for testing or after file updates)
   */
  clearDefaultsCache() {
    this.defaultsCache = null;
    this.defaultsCacheTime = null;
    console.log('Cleared backtestDefaults.json cache');
  }
}

module.exports = new BetaService();
