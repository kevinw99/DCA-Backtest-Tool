/**
 * Adaptive Strategy Service
 *
 * Implements real-time adaptive strategy that adjusts parameters based on detected market scenarios.
 * Extends scenario detection (Spec #13) from ex-post analysis to real-time adaptation during backtest.
 *
 * Key Features:
 * - Periodic scenario detection during backtest
 * - Dynamic parameter adjustment (grid spacing, profit requirements, position sizing, buy/sell pausing)
 * - Regime change detection
 * - Adaptation history tracking
 * - Comprehensive adjustment rules for all scenario types
 */

class AdaptiveStrategyService {
  /**
   * Initialize adaptive strategy controller
   * @param {Object} config - Configuration parameters
   * @param {boolean} config.enableAdaptiveStrategy
   * @param {number} config.adaptationCheckIntervalDays
   * @param {number} config.adaptationRollingWindowDays
   * @param {number} config.minDataDaysBeforeAdaptation
   * @param {number} config.confidenceThreshold
   */
  constructor(config) {
    this.config = {
      enableAdaptiveStrategy: config.enableAdaptiveStrategy !== undefined ? config.enableAdaptiveStrategy : false,
      adaptationCheckIntervalDays: config.adaptationCheckIntervalDays || 30,
      adaptationRollingWindowDays: config.adaptationRollingWindowDays || 90,
      minDataDaysBeforeAdaptation: config.minDataDaysBeforeAdaptation || 90,
      confidenceThreshold: config.confidenceThreshold || 0.7
    };

    this.adaptationHistory = [];
    this.currentScenario = null;
    this.baselineParameters = null;
    this.regimeChangeCount = 0;
    this.rollingWindowCache = new Map();
  }

  /**
   * Check if adaptation should be performed on this day
   * @param {number} dayIndex - Current day in backtest
   * @returns {boolean}
   */
  shouldCheckScenario(dayIndex) {
    // Don't check until minimum data collected
    if (dayIndex < this.config.minDataDaysBeforeAdaptation) {
      return false;
    }

    // Check every N days
    const daysSinceStart = dayIndex - this.config.minDataDaysBeforeAdaptation;
    return daysSinceStart % this.config.adaptationCheckIntervalDays === 0;
  }

  /**
   * Perform scenario detection and parameter adjustment
   * @param {Object} context - Current backtest context
   * @param {Array} context.priceHistory - Recent price data
   * @param {Array} context.transactionHistory - Recent transactions
   * @param {Object} context.currentParameters - Current strategy parameters
   * @param {string} context.currentDate - Current date in backtest
   * @param {number} context.dayIndex - Current day index
   * @returns {Object|null} - Adaptation event or null
   */
  async checkAndAdapt(context) {
    const { priceHistory, transactionHistory, currentParameters, currentDate, dayIndex } = context;

    try {
      // Get rolling window of data
      const rollingWindowData = this.extractRollingWindow(
        priceHistory,
        transactionHistory,
        this.config.adaptationRollingWindowDays
      );

      // Detect current scenario
      const scenarioDetectionService = require('./scenarioDetectionService');
      const detectedScenario = await scenarioDetectionService.detectScenario({
        priceData: rollingWindowData.prices,
        transactions: rollingWindowData.transactions,
        strategy: currentParameters.strategy || 'LONG_DCA'
      });

      // Check if regime change occurred
      const regimeChange = this.detectRegimeChange(detectedScenario);

      // Adjust parameters if needed
      const adjustedParameters = this.adjustParameters(
        currentParameters,
        detectedScenario,
        regimeChange
      );

      // Log adaptation event
      const adaptationEvent = {
        date: currentDate,
        dayIndex: dayIndex,
        event: regimeChange ? 'regime_change' : 'scenario_check',
        scenarioDetected: detectedScenario,
        parametersChanged: this.getParameterDiff(currentParameters, adjustedParameters),
        regimeChange: regimeChange,
        previousScenario: this.currentScenario?.type || null
      };

      this.adaptationHistory.push(adaptationEvent);
      this.currentScenario = detectedScenario;

      return {
        adaptationEvent,
        adjustedParameters,
        regimeChange
      };
    } catch (error) {
      console.error('Scenario detection failed:', error);

      // Fall back to mixed scenario with low confidence
      const fallbackScenario = {
        type: 'mixed',
        confidence: 0.5,
        keyMetrics: {},
        error: error.message
      };

      const adjustedParameters = this.adjustParameters(
        currentParameters,
        fallbackScenario,
        false
      );

      const adaptationEvent = {
        date: currentDate,
        dayIndex: dayIndex,
        event: 'scenario_check_failed',
        scenarioDetected: fallbackScenario,
        parametersChanged: this.getParameterDiff(currentParameters, adjustedParameters),
        regimeChange: false,
        error: error.message
      };

      this.adaptationHistory.push(adaptationEvent);
      this.currentScenario = fallbackScenario;

      return {
        adaptationEvent,
        adjustedParameters,
        regimeChange: false
      };
    }
  }

  /**
   * Extract rolling window of recent data
   * @param {Array} priceHistory - Full price history
   * @param {Array} transactionHistory - Full transaction history
   * @param {number} windowDays - Size of rolling window
   * @returns {Object} - { prices, transactions }
   */
  extractRollingWindow(priceHistory, transactionHistory, windowDays) {
    const cacheKey = `${priceHistory.length}-${windowDays}`;

    if (this.rollingWindowCache.has(cacheKey)) {
      return this.rollingWindowCache.get(cacheKey);
    }

    const startIndex = Math.max(0, priceHistory.length - windowDays);

    const result = {
      prices: priceHistory.slice(startIndex),
      transactions: transactionHistory.filter(tx => {
        if (!tx.date || !priceHistory[startIndex]?.date) return false;
        const txDate = new Date(tx.date);
        const windowStartDate = new Date(priceHistory[startIndex].date);
        return txDate >= windowStartDate;
      })
    };

    // Cache result
    this.rollingWindowCache.set(cacheKey, result);

    // Limit cache size
    if (this.rollingWindowCache.size > 100) {
      const firstKey = this.rollingWindowCache.keys().next().value;
      this.rollingWindowCache.delete(firstKey);
    }

    return result;
  }

  /**
   * Detect if a regime change has occurred
   * @param {Object} newScenario - Newly detected scenario
   * @returns {boolean}
   */
  detectRegimeChange(newScenario) {
    if (!this.currentScenario) {
      return false; // First detection
    }

    // Regime change if scenario type changed and confidence above threshold
    const scenarioChanged = newScenario.type !== this.currentScenario.type;
    const confidenceHigh = newScenario.confidence >= this.config.confidenceThreshold;

    if (scenarioChanged && confidenceHigh) {
      this.regimeChangeCount++;
      return true;
    }

    return false;
  }

  /**
   * Adjust strategy parameters based on detected scenario
   * @param {Object} currentParams - Current parameters
   * @param {Object} scenario - Detected scenario
   * @param {boolean} regimeChange - Whether regime changed
   * @returns {Object} - Adjusted parameters
   */
  adjustParameters(currentParams, scenario, regimeChange) {
    // Store baseline parameters on first run
    if (!this.baselineParameters) {
      this.baselineParameters = { ...currentParams };
    }

    // Get comprehensive adjustment rules for scenario type
    const rules = this.getAdjustmentRules(scenario.type);

    // Calculate adjusted parameters
    const adjusted = {
      ...currentParams,

      // Primary Controls
      buyEnabled: rules.buyEnabled,
      sellEnabled: rules.sellEnabled,
      buyPauseReason: rules.buyPauseReason || null,
      sellPauseReason: rules.sellPauseReason || null,

      // Core Parameters
      gridIntervalPercent: this.applyBounds(
        this.baselineParameters.gridIntervalPercent * rules.gridSpacingMultiplier,
        0.01, 1.0
      ),
      profitRequirement: this.applyBounds(
        this.baselineParameters.profitRequirement * rules.profitRequirementMultiplier,
        0.01, 1.0
      ),
      maxLots: Math.max(1, Math.min(100,
        Math.round(this.baselineParameters.maxLots * rules.maxLotsMultiplier)
      )),
      maxLotsToSell: Math.max(1, Math.min(100,
        Math.round((this.baselineParameters.maxLotsToSell || 1) * rules.maxLotsToSellMultiplier)
      )),
      lotSizeUsd: this.baselineParameters.lotSizeUsd * rules.lotSizeMultiplier,

      // Trailing Stop Parameters
      enableTrailingBuy: rules.enableTrailingBuy,
      enableTrailingSell: rules.enableTrailingSell,
      trailingBuyActivationPercent: this.applyBounds(
        (this.baselineParameters.trailingBuyActivationPercent || 0.1) * rules.trailingBuyActivationMultiplier,
        0.01, 1.0
      ),
      trailingBuyReboundPercent: this.applyBounds(
        (this.baselineParameters.trailingBuyReboundPercent || 0.05) * rules.trailingBuyReboundMultiplier,
        0.0, 0.5
      ),
      trailingSellActivationPercent: this.applyBounds(
        (this.baselineParameters.trailingSellActivationPercent || 0.1) * rules.trailingSellActivationMultiplier,
        0.01, 1.0
      ),
      trailingSellPullbackPercent: this.applyBounds(
        (this.baselineParameters.trailingSellPullbackPercent || 0.05) * rules.trailingSellPullbackMultiplier,
        0.0, 0.5
      ),

      // Stop Loss Parameters
      hardStopLossPercent: this.applyBounds(
        (this.baselineParameters.hardStopLossPercent || 0.3) * rules.hardStopLossMultiplier,
        0.05, 0.9
      ),
      portfolioStopLossPercent: rules.portfolioStopLossMultiplier ? this.applyBounds(
        (this.baselineParameters.portfolioStopLossPercent || 0.25) * rules.portfolioStopLossMultiplier,
        0.05, 0.9
      ) : this.baselineParameters.portfolioStopLossPercent,
      cascadeStopLossPercent: rules.cascadeStopLossMultiplier ? this.applyBounds(
        (this.baselineParameters.cascadeStopLossPercent || 0.35) * rules.cascadeStopLossMultiplier,
        0.05, 0.9
      ) : this.baselineParameters.cascadeStopLossPercent,

      // Timing Parameters
      entryDelay: rules.entryDelay,
      exitUrgencyMultiplier: rules.exitUrgencyMultiplier,
      minHoldingPeriod: rules.minHoldingPeriod || 0,
      confirmationPeriod: rules.confirmationPeriod || 0,

      // Feature Toggles
      enableConsecutiveIncrementalBuyGrid: rules.enableConsecutiveIncrementalBuyGrid,
      enableConsecutiveIncrementalSellProfit: rules.enableConsecutiveIncrementalSellProfit,
      enableDynamicGrid: rules.enableDynamicGrid,

      // Volatility Thresholds (for mixed scenario)
      volatilityPauseThresholds: rules.volatilityPauseThresholds || null,

      // Metadata
      adaptiveRiskLevel: rules.riskLevel,
      lastAdaptationScenario: scenario.type,
      lastAdaptationConfidence: scenario.confidence
    };

    return adjusted;
  }

  /**
   * Apply bounds to parameter values
   * @param {number} value - Value to bound
   * @param {number} min - Minimum allowed
   * @param {number} max - Maximum allowed
   * @returns {number} - Bounded value
   */
  applyBounds(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Get comprehensive adjustment rules for scenario type
   * @param {string} scenarioType - Type of scenario
   * @returns {Object} - Complete adjustment rules
   */
  getAdjustmentRules(scenarioType) {
    const rules = {
      oscillating_uptrend: {
        // Primary Controls
        buyEnabled: true,
        sellEnabled: true,

        // Parameter Multipliers
        gridSpacingMultiplier: 0.9,
        profitRequirementMultiplier: 1.0,
        maxLotsMultiplier: 1.0,
        maxLotsToSellMultiplier: 1.0,
        lotSizeMultiplier: 1.0,

        // Trailing Stop Adjustments
        enableTrailingBuy: true,
        enableTrailingSell: true,
        trailingBuyActivationMultiplier: 1.0,
        trailingBuyReboundMultiplier: 1.0,
        trailingSellActivationMultiplier: 1.0,
        trailingSellPullbackMultiplier: 1.0,

        // Risk Management
        hardStopLossMultiplier: 1.0,
        portfolioStopLossMultiplier: 1.0,
        entryDelay: 0,
        exitUrgencyMultiplier: 1.0,

        // Feature Toggles
        enableConsecutiveIncrementalBuyGrid: false,
        enableConsecutiveIncrementalSellProfit: true,
        enableDynamicGrid: true,

        riskLevel: 'MODERATE_AGGRESSIVE'
      },

      downtrend: {
        // Primary Controls - STOP BUYING
        buyEnabled: false,
        sellEnabled: true,
        buyPauseReason: 'DOWNTREND_DETECTED',

        // Parameter Multipliers
        gridSpacingMultiplier: 1.5,
        profitRequirementMultiplier: 1.3,
        maxLotsMultiplier: 0.5,          // Reduce to 50%
        maxLotsToSellMultiplier: 1.5,    // Sell more at once
        lotSizeMultiplier: 0.7,

        // Trailing Stop Adjustments - AGGRESSIVE SELLING
        enableTrailingBuy: false,        // Buying disabled anyway
        enableTrailingSell: true,
        trailingBuyActivationMultiplier: 2.0,
        trailingBuyReboundMultiplier: 1.5,
        trailingSellActivationMultiplier: 0.7,  // Activate earlier
        trailingSellPullbackMultiplier: 0.8,     // Tighter pullback

        // Risk Management - TIGHTER PROTECTION
        hardStopLossMultiplier: 0.8,
        portfolioStopLossMultiplier: 0.8,
        cascadeStopLossMultiplier: 0.8,
        entryDelay: 5,                   // Wait 5 days
        exitUrgencyMultiplier: 1.5,      // 50% faster exits

        // Feature Toggles
        enableConsecutiveIncrementalBuyGrid: false,
        enableConsecutiveIncrementalSellProfit: false,
        enableDynamicGrid: true,

        riskLevel: 'DEFENSIVE'
      },

      missed_rally: {
        // Primary Controls - STOP SELLING
        buyEnabled: true,
        sellEnabled: false,
        sellPauseReason: 'FAST_RALLY_DETECTED',

        // Parameter Multipliers
        gridSpacingMultiplier: 0.7,
        profitRequirementMultiplier: 0.8,
        maxLotsMultiplier: 1.2,          // Increase to 120%
        maxLotsToSellMultiplier: 0.7,    // Sell fewer when resumed
        lotSizeMultiplier: 1.1,

        // Trailing Stop Adjustments - AGGRESSIVE BUYING
        enableTrailingBuy: true,
        enableTrailingSell: false,       // Selling disabled anyway
        trailingBuyActivationMultiplier: 0.5,   // Activate earlier
        trailingBuyReboundMultiplier: 0.7,      // Lower rebound
        trailingSellActivationMultiplier: 1.5,
        trailingSellPullbackMultiplier: 1.3,

        // Risk Management - LOOSER STOPS
        hardStopLossMultiplier: 1.3,
        portfolioStopLossMultiplier: 1.2,
        cascadeStopLossMultiplier: 1.3,
        entryDelay: 0,
        exitUrgencyMultiplier: 0.6,      // Slower exits
        minHoldingPeriod: 7,             // Hold at least 7 days

        // Feature Toggles
        enableConsecutiveIncrementalBuyGrid: true,
        enableConsecutiveIncrementalSellProfit: false,
        enableDynamicGrid: true,

        riskLevel: 'AGGRESSIVE'
      },

      mixed: {
        // Primary Controls - BOTH ENABLED BUT CAUTIOUS
        buyEnabled: true,
        sellEnabled: true,

        // Parameter Multipliers
        gridSpacingMultiplier: 1.0,
        profitRequirementMultiplier: 1.1,  // Slight noise filter
        maxLotsMultiplier: 0.9,
        maxLotsToSellMultiplier: 1.0,
        lotSizeMultiplier: 0.9,

        // Trailing Stop Adjustments - SLIGHTLY CONSERVATIVE
        enableTrailingBuy: true,
        enableTrailingSell: true,
        trailingBuyActivationMultiplier: 1.1,
        trailingBuyReboundMultiplier: 1.1,
        trailingSellActivationMultiplier: 1.1,
        trailingSellPullbackMultiplier: 1.0,

        // Risk Management
        hardStopLossMultiplier: 1.0,
        portfolioStopLossMultiplier: 1.0,
        entryDelay: 1,                   // 1 day confirmation
        exitUrgencyMultiplier: 1.0,
        confirmationPeriod: 2,

        // Feature Toggles
        enableConsecutiveIncrementalBuyGrid: true,
        enableConsecutiveIncrementalSellProfit: true,
        enableDynamicGrid: true,

        // Conditional pausing based on volatility
        volatilityPauseThresholds: {
          buyPauseIfVolatilityAbove: 0.4,
          sellPauseIfVolatilityAbove: 0.5
        },

        riskLevel: 'NEUTRAL_CAUTIOUS'
      }
    };

    return rules[scenarioType] || rules.mixed;
  }

  /**
   * Calculate difference between old and new parameters
   * @param {Object} oldParams
   * @param {Object} newParams
   * @returns {Object} - Parameter changes
   */
  getParameterDiff(oldParams, newParams) {
    const changes = {};
    const keysToTrack = [
      'buyEnabled',
      'sellEnabled',
      'gridIntervalPercent',
      'profitRequirement',
      'maxLots',
      'maxLotsToSell',
      'lotSizeUsd',
      'enableTrailingBuy',
      'enableTrailingSell',
      'trailingBuyActivationPercent',
      'trailingBuyReboundPercent',
      'trailingSellActivationPercent',
      'trailingSellPullbackPercent',
      'hardStopLossPercent',
      'entryDelay',
      'enableConsecutiveIncrementalBuyGrid',
      'enableConsecutiveIncrementalSellProfit',
      'enableDynamicGrid'
    ];

    keysToTrack.forEach(key => {
      if (oldParams[key] !== newParams[key]) {
        changes[key] = {
          from: oldParams[key],
          to: newParams[key]
        };
      }
    });

    return changes;
  }

  /**
   * Check for excessive regime flipping (whipsaw)
   * @param {number} recentDays - Days to check
   * @returns {Object} - Warning info
   */
  checkForWhipsaw(recentDays = 90) {
    const recentChanges = this.adaptationHistory
      .filter(event => event.regimeChange)
      .slice(-Math.ceil(recentDays / this.config.adaptationCheckIntervalDays));

    const tooManyChanges = recentChanges.length > 3;

    return {
      warning: tooManyChanges,
      changeCount: recentChanges.length,
      message: tooManyChanges
        ? `Warning: ${recentChanges.length} regime changes in last ${recentDays} days may indicate unstable conditions`
        : null
    };
  }

  /**
   * Get adaptation history
   * @returns {Array}
   */
  getAdaptationHistory() {
    return this.adaptationHistory;
  }

  /**
   * Get current scenario
   * @returns {Object|null}
   */
  getCurrentScenario() {
    return this.currentScenario;
  }

  /**
   * Get regime change statistics
   * @returns {Object}
   */
  getRegimeStatistics() {
    const regimeChanges = this.adaptationHistory.filter(e => e.regimeChange);
    const scenarioDurations = this.calculateScenarioDurations();

    return {
      totalRegimeChanges: this.regimeChangeCount,
      regimeChanges: regimeChanges,
      scenarioDurations: scenarioDurations,
      averageRegimeDuration: scenarioDurations.length > 0
        ? scenarioDurations.reduce((sum, s) => sum + s.duration, 0) / scenarioDurations.length
        : 0
    };
  }

  /**
   * Calculate duration of each scenario regime
   * @returns {Array}
   */
  calculateScenarioDurations() {
    const durations = [];
    let currentRegime = null;
    let regimeStartDay = 0;

    this.adaptationHistory.forEach((event, index) => {
      if (event.regimeChange || index === 0) {
        if (currentRegime) {
          durations.push({
            scenario: currentRegime,
            startDay: regimeStartDay,
            endDay: event.dayIndex,
            duration: event.dayIndex - regimeStartDay
          });
        }
        currentRegime = event.scenarioDetected.type;
        regimeStartDay = event.dayIndex;
      }
    });

    // Add final regime duration
    if (currentRegime && this.adaptationHistory.length > 0) {
      const lastEvent = this.adaptationHistory[this.adaptationHistory.length - 1];
      durations.push({
        scenario: currentRegime,
        startDay: regimeStartDay,
        endDay: lastEvent.dayIndex,
        duration: lastEvent.dayIndex - regimeStartDay
      });
    }

    return durations;
  }
}

module.exports = AdaptiveStrategyService;
