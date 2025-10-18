/**
 * Capital Optimizer Service
 *
 * Manages capital optimization strategies to maximize idle cash utilization.
 * Supports multiple strategies:
 * - Adaptive Lot Sizing: Increase lot sizes when excess cash is available
 * - Cash Yield: Apply money-market-like returns to idle cash reserves
 * - Deferred Selling: Skip profit-taking sells when cash reserve is abundant
 */

class CapitalOptimizerService {
  constructor(config) {
    this.config = config || {};
    this.strategies = config.strategies || [];

    // Metrics tracking
    this.metrics = {
      cashYieldRevenue: 0,
      adaptiveLotSizingEvents: 0,
      maxLotSizeReached: config.adaptiveLotSizing?.lotSizeUsd || 0,
      cashReserveHistory: [],
      totalCashYieldDays: 0,
      deferredSellingEvents: 0
    };

    console.log(`💰 Capital Optimizer initialized with strategies: ${this.strategies.join(', ')}`);
  }

  /**
   * Get lot size for a stock based on current cash reserve
   * @param {string} symbol - Stock symbol
   * @param {number} cashReserve - Current cash reserve
   * @param {number} baseLotSize - Baseline lot size
   * @returns {number} Adjusted lot size
   */
  getLotSize(symbol, cashReserve, baseLotSize) {
    // If adaptive lot sizing not enabled, return base lot size
    if (!this.strategies.includes('adaptive_lot_sizing')) {
      return baseLotSize;
    }

    const config = this.config.adaptiveLotSizing;

    // If cash reserve below threshold, use base lot size
    if (cashReserve <= config.cashReserveThreshold) {
      return baseLotSize;
    }

    // Calculate multiplier based on excess cash
    const excessCash = cashReserve - config.cashReserveThreshold;
    const excessRatio = excessCash / config.cashReserveThreshold;

    // Increase lot size by increaseStepPercent for each threshold amount of excess cash
    const multiplier = Math.min(
      1 + (Math.floor(excessRatio) * (config.increaseStepPercent / 100)),
      config.maxLotSizeMultiplier
    );

    const adjustedLotSize = baseLotSize * multiplier;

    // Track metrics
    if (adjustedLotSize > baseLotSize) {
      this.metrics.adaptiveLotSizingEvents++;

      if (adjustedLotSize > this.metrics.maxLotSizeReached) {
        this.metrics.maxLotSizeReached = adjustedLotSize;
      }
    }

    return adjustedLotSize;
  }

  /**
   * Calculate daily cash yield revenue
   * @param {number} cashReserve - Current cash reserve
   * @returns {number} Daily yield revenue
   */
  calculateDailyCashYield(cashReserve) {
    // If cash yield not enabled, return 0
    if (!this.strategies.includes('cash_yield')) {
      return 0;
    }

    const config = this.config.cashYield;

    // If not explicitly enabled or cash below minimum, return 0
    if (!config || !config.enabled || cashReserve < config.minCashToInvest) {
      return 0;
    }

    // Calculate daily rate from annual yield
    const dailyRate = config.annualYieldPercent / 100 / 365;
    const yieldRevenue = cashReserve * dailyRate;

    // Track metrics
    this.metrics.cashYieldRevenue += yieldRevenue;
    this.metrics.totalCashYieldDays++;

    return yieldRevenue;
  }

  /**
   * Check if cash yield strategy is enabled
   * @returns {boolean}
   */
  isCashYieldEnabled() {
    return this.strategies.includes('cash_yield') &&
           this.config.cashYield &&
           this.config.cashYield.enabled;
  }

  /**
   * Check if selling should be deferred due to cash abundance
   * @param {number} cashReserve - Current cash reserve
   * @returns {boolean} True if selling should be deferred
   */
  shouldDeferSelling(cashReserve) {
    // If deferred selling not enabled, return false
    if (!this.strategies.includes('deferred_selling')) {
      return false;
    }

    const config = this.config.deferredSelling;

    // If not explicitly enabled, return false
    if (!config || !config.enabled) {
      return false;
    }

    // Defer selling if cash reserve exceeds abundance threshold
    const shouldDefer = cashReserve >= config.cashAbundanceThreshold;

    // Track metric when deferring
    if (shouldDefer) {
      this.metrics.deferredSellingEvents++;
    }

    return shouldDefer;
  }

  /**
   * Track daily cash reserve for historical analysis
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {number} cashReserve - Cash reserve amount
   */
  trackCashReserve(date, cashReserve) {
    this.metrics.cashReserveHistory.push({
      date,
      cashReserve
    });
  }

  /**
   * Get optimization metrics
   * @returns {Object} Comprehensive metrics object
   */
  getMetrics() {
    // Calculate average and peak cash reserve
    let averageCashReserve = 0;
    let peakCashReserve = 0;

    if (this.metrics.cashReserveHistory.length > 0) {
      const totalCash = this.metrics.cashReserveHistory.reduce((sum, entry) => sum + entry.cashReserve, 0);
      averageCashReserve = totalCash / this.metrics.cashReserveHistory.length;
      peakCashReserve = Math.max(...this.metrics.cashReserveHistory.map(entry => entry.cashReserve));
    }

    // Calculate annualized cash yield return
    let cashYieldAnnualizedReturn = 0;
    if (this.isCashYieldEnabled() && averageCashReserve > 0 && this.metrics.totalCashYieldDays > 0) {
      const avgDailyYield = this.metrics.cashYieldRevenue / this.metrics.totalCashYieldDays;
      cashYieldAnnualizedReturn = (avgDailyYield / averageCashReserve) * 365 * 100;
    }

    return {
      enabled: true,
      strategies: this.strategies,
      averageCashReserve,
      peakCashReserve,
      cashYieldRevenue: this.metrics.cashYieldRevenue,
      cashYieldAnnualizedReturn,
      adaptiveLotSizing: {
        events: this.metrics.adaptiveLotSizingEvents,
        maxLotSizeReached: this.metrics.maxLotSizeReached,
        averageLotSize: this.calculateAverageLotSize()
      },
      deferredSelling: {
        events: this.metrics.deferredSellingEvents
      },
      cashReserveHistory: this.metrics.cashReserveHistory
    };
  }

  /**
   * Calculate average lot size (if adaptive sizing was used)
   * @returns {number}
   */
  calculateAverageLotSize() {
    // This is a simple estimation - in real implementation,
    // we would track actual lot sizes used
    if (this.metrics.adaptiveLotSizingEvents === 0) {
      return 0;
    }

    // Rough estimate: average between base and max
    const baseLotSize = this.config.adaptiveLotSizing?.lotSizeUsd || 10000;
    return (baseLotSize + this.metrics.maxLotSizeReached) / 2;
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics() {
    this.metrics = {
      cashYieldRevenue: 0,
      adaptiveLotSizingEvents: 0,
      maxLotSizeReached: this.config.adaptiveLotSizing?.lotSizeUsd || 0,
      cashReserveHistory: [],
      totalCashYieldDays: 0,
      deferredSellingEvents: 0
    };
  }
}

module.exports = CapitalOptimizerService;
