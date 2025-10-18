/**
 * Portfolio Results Cache
 *
 * Caches portfolio backtest results for quick retrieval when drilling
 * down into individual stock details.
 *
 * Cache TTL: No expiration (persists until server restart or explicit override)
 * Storage: In-memory Map (for production, consider Redis)
 */

class PortfolioResultsCache {
  constructor() {
    this.cache = new Map();
    // No expiration - portfolio runs persist indefinitely
    this.maxAge = null;

    // Optional: Set max cache size to prevent memory issues
    this.maxCacheSize = 1000; // Max 1000 portfolio runs
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
   * @returns {Object|null} Portfolio results or null if not found
   */
  get(runId) {
    const entry = this.cache.get(runId);

    if (!entry) {
      console.log(`❌ Portfolio run not found in cache: ${runId}`);
      return null;
    }

    // No expiration check - portfolio runs persist indefinitely
    const age = Date.now() - entry.timestamp;
    const ageHours = Math.round(age / 3600000);
    console.log(`✅ Retrieved portfolio run from cache: ${runId} (age: ${ageHours}h)`);
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
   * Remove oldest entries if cache size exceeds limit
   */
  cleanup() {
    if (this.cache.size <= this.maxCacheSize) {
      return;
    }

    // Remove oldest entries to stay within limit
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const removeCount = this.cache.size - this.maxCacheSize;
    for (let i = 0; i < removeCount; i++) {
      const [runId] = entries[i];
      this.cache.delete(runId);
    }

    console.log(`🧹 Cleaned up ${removeCount} oldest portfolio runs (size limit: ${this.maxCacheSize})`);
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
   * Destroy cache
   */
  destroy() {
    this.clear();
  }
}

// Export singleton instance
module.exports = new PortfolioResultsCache();
