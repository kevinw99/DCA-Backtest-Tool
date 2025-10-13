/**
 * Portfolio Results Cache
 *
 * Caches portfolio backtest results for quick retrieval when drilling
 * down into individual stock details.
 *
 * Cache TTL: 24 hours
 * Storage: In-memory Map (for production, consider Redis)
 */

class PortfolioResultsCache {
  constructor() {
    this.cache = new Map();
    this.maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * Store portfolio results in cache
   * @param {string} runId - Unique portfolio run ID
   * @param {Object} results - Complete portfolio backtest results
   */
  set(runId, results) {
    this.cache.set(runId, {
      data: results,
      timestamp: Date.now()
    });

    console.log(`📦 Cached portfolio run: ${runId} (${this.cache.size} total cached)`);

    // Clean old entries
    this.cleanup();
  }

  /**
   * Retrieve portfolio results from cache
   * @param {string} runId - Unique portfolio run ID
   * @returns {Object|null} Portfolio results or null if not found/expired
   */
  get(runId) {
    const entry = this.cache.get(runId);

    if (!entry) {
      console.log(`❌ Portfolio run not found in cache: ${runId}`);
      return null;
    }

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > this.maxAge) {
      console.log(`⏰ Portfolio run expired: ${runId} (age: ${Math.round(age / 3600000)}h)`);
      this.cache.delete(runId);
      return null;
    }

    console.log(`✅ Retrieved portfolio run from cache: ${runId}`);
    return entry.data;
  }

  /**
   * Check if a run ID exists in cache
   * @param {string} runId - Unique portfolio run ID
   * @returns {boolean} True if exists and not expired
   */
  has(runId) {
    return this.get(runId) !== null;
  }

  /**
   * Remove expired entries from cache
   */
  cleanup() {
    const now = Date.now();
    let removedCount = 0;

    for (const [runId, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(runId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} expired portfolio runs`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.values());

    return {
      totalEntries: this.cache.size,
      oldestEntry: entries.length > 0
        ? Math.min(...entries.map(e => e.timestamp))
        : null,
      newestEntry: entries.length > 0
        ? Math.max(...entries.map(e => e.timestamp))
        : null,
      totalSizeBytes: this._estimateCacheSize()
    };
  }

  /**
   * Estimate total cache size (rough approximation)
   * @returns {number} Estimated size in bytes
   */
  _estimateCacheSize() {
    let totalSize = 0;

    for (const [runId, entry] of this.cache.entries()) {
      // Rough estimate: stringify and measure length
      try {
        const jsonStr = JSON.stringify(entry.data);
        totalSize += jsonStr.length * 2; // UTF-16 = 2 bytes per char
      } catch (err) {
        // Skip if can't stringify
      }
    }

    return totalSize;
  }

  /**
   * Clear all cached results
   */
  clear() {
    const count = this.cache.size;
    this.cache.clear();
    console.log(`🗑️  Cleared all cached portfolio runs (${count} entries)`);
  }

  /**
   * Destroy cache and cleanup interval
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}

// Export singleton instance
module.exports = new PortfolioResultsCache();
