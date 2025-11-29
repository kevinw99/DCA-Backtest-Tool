/**
 * Rate Limiter for API calls
 * Implements configurable delays, exponential backoff, and jitter
 */
class RateLimiter {
  constructor(options = {}) {
    this.minDelay = options.minDelay || 2000;           // 2 seconds between requests
    this.maxRetries = options.maxRetries || 3;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.maxJitter = options.maxJitter || 500;          // Random jitter up to 500ms
    this.lastRequestTime = 0;
    this.requestCount = 0;
  }

  /**
   * Wait for the rate limit delay before next request
   */
  async wait() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const waitTime = Math.max(0, this.minDelay - elapsed);

    if (waitTime > 0) {
      // Add jitter to avoid synchronized requests
      const jitter = Math.random() * this.maxJitter;
      await new Promise(r => setTimeout(r, waitTime + jitter));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Execute a function with rate limiting and retry logic
   * @param {Function} fn - Async function to execute
   * @param {string} label - Label for logging
   * @returns {Promise} - Result of the function
   */
  async executeWithRetry(fn, label = '') {
    let lastError;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      await this.wait();

      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const errorMsg = error.message || String(error);

        // Check for rate limit error
        if (errorMsg.includes('429') ||
            errorMsg.toLowerCase().includes('rate limit') ||
            errorMsg.toLowerCase().includes('too many requests')) {
          const backoffTime = this.minDelay * Math.pow(this.backoffMultiplier, attempt + 1);
          console.log(`  ⏳ ${label} Rate limited (attempt ${attempt + 1}/${this.maxRetries}). Waiting ${backoffTime}ms...`);
          await new Promise(r => setTimeout(r, backoffTime));
        } else if (attempt < this.maxRetries - 1) {
          // Non-rate-limit error, shorter retry delay
          const retryDelay = this.minDelay * (attempt + 1);
          console.log(`  ⚠️ ${label} Error (attempt ${attempt + 1}/${this.maxRetries}): ${errorMsg}. Retrying in ${retryDelay}ms...`);
          await new Promise(r => setTimeout(r, retryDelay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Get stats about rate limiter usage
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      minDelay: this.minDelay,
      maxRetries: this.maxRetries
    };
  }

  /**
   * Reset the rate limiter state
   */
  reset() {
    this.lastRequestTime = 0;
    this.requestCount = 0;
  }
}

module.exports = RateLimiter;
