const database = require('../database');

class BetaDataService {
  constructor() {
    this.providers = [
      { name: 'yahoo_finance', priority: 1, rateLimit: null },
      { name: 'alpha_vantage', priority: 2, rateLimit: 25 },
      { name: 'cached', priority: 3, maxAge: 24 } // 24 hours
    ];
  }

  /**
   * Fetch Beta value for a stock symbol
   * @param {string} symbol - Stock symbol (e.g., 'TSLA')
   * @returns {Promise<Object>} Beta data object
   */
  async fetchBeta(symbol) {
    try {
      // First check if we have a cached Beta that's still fresh
      const cachedBeta = await this.getCachedBeta(symbol);
      if (cachedBeta && this.isBetaFresh(cachedBeta)) {
        console.log(`Using cached Beta for ${symbol}: ${cachedBeta.beta}`);
        return {
          beta: cachedBeta.beta,
          source: cachedBeta.source,
          lastUpdated: cachedBeta.last_updated,
          isManualOverride: cachedBeta.is_manual_override
        };
      }

      // Try to fetch from external providers
      let betaData = null;
      
      try {
        betaData = await this.getBetaFromYahooFinance(symbol);
      } catch (error) {
        console.warn(`Yahoo Finance Beta fetch failed for ${symbol}: ${error.message}`);
        
        try {
          betaData = await this.getBetaFromAlphaVantage(symbol);
        } catch (error2) {
          console.warn(`Alpha Vantage Beta fetch failed for ${symbol}: ${error2.message}`);
        }
      }

      // If we got fresh data, cache it
      if (betaData) {
        await this.cacheBeta(symbol, betaData);
        return betaData;
      }

      // If all providers failed, return cached data if available (even if stale)
      if (cachedBeta) {
        console.warn(`Using stale cached Beta for ${symbol}: ${cachedBeta.beta}`);
        return {
          beta: cachedBeta.beta,
          source: `${cachedBeta.source}_stale`,
          lastUpdated: cachedBeta.last_updated,
          isManualOverride: cachedBeta.is_manual_override
        };
      }

      // Last resort: return default Beta
      console.warn(`No Beta data available for ${symbol}, using default Beta = 1.0`);
      return {
        beta: 1.0,
        source: 'default',
        lastUpdated: new Date().toISOString(),
        isManualOverride: false
      };

    } catch (error) {
      console.error(`Error fetching Beta for ${symbol}:`, error);
      return {
        beta: 1.0,
        source: 'default',
        lastUpdated: new Date().toISOString(),
        isManualOverride: false
      };
    }
  }

  /**
   * Get Beta from Yahoo Finance API
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Beta data
   */
  async getBetaFromYahooFinance(symbol) {
    // For now, return a simulated Beta value
    // In a real implementation, this would make an HTTP request to Yahoo Finance
    console.log(`Fetching Beta from Yahoo Finance for ${symbol}`);
    
    // Simulate different Beta values for different stocks
    const simulatedBetas = {
      'TSLA': 1.8,
      'NVDA': 1.6,
      'AAPL': 1.2,
      'MSFT': 1.1,
      'GOOGL': 1.3,
      'AMZN': 1.4,
      'META': 1.5,
      'NFLX': 1.7,
      'AMD': 1.9,
      'SPY': 1.0,
      'QQQ': 1.1,
      'VTI': 0.9
    };

    const beta = simulatedBetas[symbol.toUpperCase()] || (0.5 + Math.random() * 2); // Random between 0.5 and 2.5

    return {
      beta: Math.round(beta * 100) / 100, // Round to 2 decimal places
      source: 'yahoo_finance',
      lastUpdated: new Date().toISOString(),
      isManualOverride: false
    };
  }

  /**
   * Get Beta from Alpha Vantage API (fallback)
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Beta data
   */
  async getBetaFromAlphaVantage(symbol) {
    // For now, return a simulated Beta value
    // In a real implementation, this would make an HTTP request to Alpha Vantage
    console.log(`Fetching Beta from Alpha Vantage for ${symbol}`);
    
    // Simulate slightly different values than Yahoo Finance
    const simulatedBetas = {
      'TSLA': 1.75,
      'NVDA': 1.55,
      'AAPL': 1.15,
      'MSFT': 1.05,
      'GOOGL': 1.25,
      'AMZN': 1.35,
      'META': 1.45,
      'NFLX': 1.65,
      'AMD': 1.85,
      'SPY': 0.98,
      'QQQ': 1.08,
      'VTI': 0.88
    };

    const beta = simulatedBetas[symbol.toUpperCase()] || (0.5 + Math.random() * 2);

    return {
      beta: Math.round(beta * 100) / 100,
      source: 'alpha_vantage',
      lastUpdated: new Date().toISOString(),
      isManualOverride: false
    };
  }

  /**
   * Cache Beta data in database
   * @param {string} symbol - Stock symbol
   * @param {Object} betaData - Beta data to cache
   */
  async cacheBeta(symbol, betaData) {
    try {
      // Get or create stock record
      let stock = await database.getStock(symbol);
      if (!stock) {
        const stockId = await database.createStock(symbol);
        stock = { id: stockId, symbol: symbol.toUpperCase() };
      }

      // Insert or update Beta data
      await database.insertBeta(stock.id, betaData);
      console.log(`Cached Beta for ${symbol}: ${betaData.beta} (source: ${betaData.source})`);
      
    } catch (error) {
      console.error(`Error caching Beta for ${symbol}:`, error);
    }
  }

  /**
   * Get cached Beta data from database
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object|null>} Cached Beta data or null
   */
  async getCachedBeta(symbol) {
    try {
      const betaData = await database.getBetaBySymbol(symbol);
      return betaData;
    } catch (error) {
      console.error(`Error getting cached Beta for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Check if Beta data is still fresh (within maxAge hours)
   * @param {Object} betaData - Beta data with last_updated field
   * @param {number} maxAgeHours - Maximum age in hours (default: 24)
   * @returns {boolean} True if data is fresh
   */
  isBetaFresh(betaData, maxAgeHours = 24) {
    if (!betaData || !betaData.last_updated) {
      return false;
    }

    // Manual overrides are always considered fresh
    if (betaData.is_manual_override) {
      return true;
    }

    const lastUpdated = new Date(betaData.last_updated);
    const now = new Date();
    const ageHours = (now - lastUpdated) / (1000 * 60 * 60);
    
    return ageHours < maxAgeHours;
  }

  /**
   * Set manual Beta override for a stock
   * @param {string} symbol - Stock symbol
   * @param {number} beta - Manual Beta value
   * @returns {Promise<Object>} Updated Beta data
   */
  async setManualBeta(symbol, beta) {
    try {
      // Validate Beta value
      if (typeof beta !== 'number' || beta < 0 || beta > 10) {
        throw new Error('Beta must be a number between 0 and 10');
      }

      // Get or create stock record
      let stock = await database.getStock(symbol);
      if (!stock) {
        const stockId = await database.createStock(symbol);
        stock = { id: stockId, symbol: symbol.toUpperCase() };
      }

      const betaData = {
        beta: Math.round(beta * 100) / 100, // Round to 2 decimal places
        source: 'manual_override',
        lastUpdated: new Date().toISOString(),
        isManualOverride: true
      };

      await database.insertBeta(stock.id, betaData);
      console.log(`Set manual Beta for ${symbol}: ${betaData.beta}`);
      
      return betaData;
    } catch (error) {
      console.error(`Error setting manual Beta for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Remove manual Beta override (revert to automatic fetching)
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Fresh Beta data
   */
  async removeManualBeta(symbol) {
    try {
      const stock = await database.getStock(symbol);
      if (!stock) {
        throw new Error(`Stock ${symbol} not found`);
      }

      // Delete the Beta record to force fresh fetch
      await database.deleteBeta(stock.id);
      console.log(`Removed manual Beta override for ${symbol}`);
      
      // Fetch fresh Beta data
      return await this.fetchBeta(symbol);
    } catch (error) {
      console.error(`Error removing manual Beta for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get all Beta data for multiple symbols
   * @param {string[]} symbols - Array of stock symbols
   * @returns {Promise<Object>} Object with symbol as key and Beta data as value
   */
  async getBetasForSymbols(symbols) {
    const betas = {};
    
    // Fetch Betas concurrently for better performance
    const promises = symbols.map(async (symbol) => {
      try {
        const betaData = await this.fetchBeta(symbol);
        betas[symbol.toUpperCase()] = betaData;
      } catch (error) {
        console.error(`Error fetching Beta for ${symbol}:`, error);
        betas[symbol.toUpperCase()] = {
          beta: 1.0,
          source: 'default',
          lastUpdated: new Date().toISOString(),
          isManualOverride: false
        };
      }
    });

    await Promise.all(promises);
    return betas;
  }

  /**
   * Get stale Beta data that needs refreshing
   * @param {number} maxAgeHours - Maximum age in hours
   * @returns {Promise<Array>} Array of stale Beta records
   */
  async getStaleBeats(maxAgeHours = 24) {
    try {
      return await database.getStaleBeats(maxAgeHours);
    } catch (error) {
      console.error('Error getting stale Betas:', error);
      return [];
    }
  }

  /**
   * Refresh all stale Beta data
   * @param {number} maxAgeHours - Maximum age in hours
   * @returns {Promise<number>} Number of Betas refreshed
   */
  async refreshStaleBeats(maxAgeHours = 24) {
    try {
      const staleBetas = await this.getStaleBeats(maxAgeHours);
      console.log(`Found ${staleBetas.length} stale Betas to refresh`);
      
      let refreshed = 0;
      for (const staleBeta of staleBetas) {
        try {
          await this.fetchBeta(staleBeta.symbol);
          refreshed++;
          console.log(`Refreshed Beta for ${staleBeta.symbol}`);
        } catch (error) {
          console.error(`Failed to refresh Beta for ${staleBeta.symbol}:`, error);
        }
      }
      
      console.log(`Successfully refreshed ${refreshed} out of ${staleBetas.length} stale Betas`);
      return refreshed;
    } catch (error) {
      console.error('Error refreshing stale Betas:', error);
      return 0;
    }
  }
}

module.exports = new BetaDataService();