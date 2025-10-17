const { spawn } = require('child_process');
const path = require('path');

class CurrentPriceService {
  constructor() {
    // Cache: key = "symbol_bucket", value = { priceData, timestamp }
    this.priceCache = new Map();
    this.CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Check if US stock market is currently open
   * Market hours: 9:30 AM - 4:00 PM ET, Monday-Friday
   */
  isMarketOpen() {
    const now = new Date();

    // Convert to ET timezone
    const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

    // Check if it's a weekday (0=Sunday, 6=Saturday)
    const dayOfWeek = etTime.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false; // Weekend
    }

    // Check if it's within market hours (9:30 AM - 4:00 PM ET)
    const currentMinutes = etTime.getHours() * 60 + etTime.getMinutes();
    const marketOpen = 9 * 60 + 30;  // 9:30 AM = 570 minutes
    const marketClose = 16 * 60;     // 4:00 PM = 960 minutes

    return currentMinutes >= marketOpen && currentMinutes < marketClose;
  }

  /**
   * Get cache key with time bucket for TTL
   */
  getCacheKey(symbol) {
    const now = Date.now();
    const bucket = Math.floor(now / this.CACHE_TTL_MS);
    return `${symbol}_${bucket}`;
  }

  /**
   * Get cached price if available and not expired
   */
  getCachedPrice(symbol) {
    const cacheKey = this.getCacheKey(symbol);
    const cached = this.priceCache.get(cacheKey);

    if (cached) {
      console.log(`💾 Cache hit for ${symbol} (age: ${Math.floor((Date.now() - cached.timestamp) / 1000)}s)`);
      return cached.priceData;
    }

    return null;
  }

  /**
   * Store price in cache
   */
  setCachedPrice(symbol, priceData) {
    const cacheKey = this.getCacheKey(symbol);
    this.priceCache.set(cacheKey, {
      priceData,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    this.cleanupCache();
  }

  /**
   * Remove expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    const currentBucket = Math.floor(now / this.CACHE_TTL_MS);

    for (const [key, value] of this.priceCache.entries()) {
      const age = now - value.timestamp;
      if (age > this.CACHE_TTL_MS * 2) {
        this.priceCache.delete(key);
      }
    }
  }

  /**
   * Fetch current intraday price for a symbol using yfinance
   * Returns synthetic OHLC bar for today or null if fetch fails
   */
  async fetchCurrentPrice(symbol, options = {}) {
    const { useCache = true, marketOpenOverride = null } = options;

    // Check if market is open (allow override for testing)
    const marketOpen = marketOpenOverride !== null ? marketOpenOverride : this.isMarketOpen();

    if (!marketOpen) {
      console.log(`📊 Market closed - skipping current price fetch for ${symbol}`);
      return null;
    }

    // Check cache first
    if (useCache) {
      const cached = this.getCachedPrice(symbol);
      if (cached) {
        return cached;
      }
    }

    console.log(`📊 Fetching current intraday price for ${symbol}...`);

    try {
      // Run Python script to fetch current price via yfinance
      const priceData = await this.runPythonScript(symbol);

      if (priceData && priceData.close) {
        // Cache the result
        this.setCachedPrice(symbol, priceData);

        console.log(`✅ Current price for ${symbol}: $${priceData.close} (${priceData.date})`);
        return priceData;
      } else {
        console.warn(`⚠️  No current price data returned for ${symbol}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error fetching current price for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch current prices for multiple symbols in parallel
   */
  async fetchCurrentPricesParallel(symbols, options = {}) {
    console.log(`📊 Fetching current prices for ${symbols.length} symbols in parallel...`);

    const pricePromises = symbols.map(symbol =>
      this.fetchCurrentPrice(symbol, options)
        .catch(error => {
          console.error(`Error fetching ${symbol}:`, error.message);
          return null;
        })
    );

    const prices = await Promise.all(pricePromises);

    // Convert array to object map
    const priceMap = {};
    symbols.forEach((symbol, index) => {
      priceMap[symbol] = prices[index];
    });

    const successCount = prices.filter(p => p !== null).length;
    console.log(`✅ Fetched ${successCount}/${symbols.length} current prices`);

    return priceMap;
  }

  /**
   * Run Python script to fetch current intraday price
   */
  async runPythonScript(symbol) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, 'fetch_current_price.py');
      const pythonProcess = spawn('python3', [scriptPath, symbol]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Parse JSON output from Python script
          const priceData = JSON.parse(stdout);
          resolve(priceData);
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${error.message}\nOutput: ${stdout}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });
    });
  }
}

module.exports = new CurrentPriceService();
