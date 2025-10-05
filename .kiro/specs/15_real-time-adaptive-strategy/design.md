# Design: Real-Time Adaptive Strategy

## Document Control

- **Spec ID**: 15
- **Created**: 2025-10-04
- **Status**: Draft
- **Dependencies**: Spec #13 (DCA Scenario Detection)

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     DCA Backtest Service                        │
│                                                                 │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐  │
│  │ Main Backtest│───→│ Adaptive Strategy│───→│Regime Change │  │
│  │     Loop     │    │    Controller    │    │   Detector   │  │
│  └──────────────┘    └─────────────────┘    └──────────────┘  │
│         │                      │                      │         │
│         │                      ↓                      │         │
│         │            ┌─────────────────┐              │         │
│         │            │Scenario Detection│←────────────┘         │
│         │            │    Service       │                       │
│         │            └─────────────────┘                       │
│         │                      │                               │
│         ↓                      ↓                               │
│  ┌──────────────────────────────────────┐                     │
│  │    Parameter Adjustment Engine       │                     │
│  └──────────────────────────────────────┘                     │
│                      │                                         │
│                      ↓                                         │
│  ┌──────────────────────────────────────┐                     │
│  │     Adaptation History Logger        │                     │
│  └──────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Adaptive Strategy Controller

**File**: `/backend/services/adaptiveStrategyService.js`

**Responsibility**: Orchestrate periodic scenario detection and parameter adaptation

**Key Methods**:

```javascript
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
    this.config = config;
    this.adaptationHistory = [];
    this.currentScenario = null;
    this.baselineParameters = null;
    this.regimeChangeCount = 0;
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
      strategy: currentParameters.strategy,
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
      previousScenario: this.currentScenario?.type || null,
    };

    this.adaptationHistory.push(adaptationEvent);
    this.currentScenario = detectedScenario;

    return {
      adaptationEvent,
      adjustedParameters,
      regimeChange,
    };
  }

  /**
   * Extract rolling window of recent data
   * @param {Array} priceHistory - Full price history
   * @param {Array} transactionHistory - Full transaction history
   * @param {number} windowDays - Size of rolling window
   * @returns {Object} - { prices, transactions }
   */
  extractRollingWindow(priceHistory, transactionHistory, windowDays) {
    const startIndex = Math.max(0, priceHistory.length - windowDays);

    return {
      prices: priceHistory.slice(startIndex),
      transactions: transactionHistory.filter(tx => {
        const txDate = new Date(tx.date);
        const windowStartDate = new Date(priceHistory[startIndex].date);
        return txDate >= windowStartDate;
      }),
    };
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
        0.01,
        1.0
      ),
      profitRequirement: this.applyBounds(
        this.baselineParameters.profitRequirement * rules.profitRequirementMultiplier,
        0.01,
        1.0
      ),
      maxLots: Math.max(
        1,
        Math.min(100, Math.round(this.baselineParameters.maxLots * rules.maxLotsMultiplier))
      ),
      maxLotsToSell: Math.max(
        1,
        Math.min(
          100,
          Math.round((this.baselineParameters.maxLotsToSell || 1) * rules.maxLotsToSellMultiplier)
        )
      ),
      lotSizeUsd: this.baselineParameters.lotSizeUsd * rules.lotSizeMultiplier,

      // Trailing Stop Parameters
      enableTrailingBuy: rules.enableTrailingBuy,
      enableTrailingSell: rules.enableTrailingSell,
      trailingBuyActivationPercent: this.applyBounds(
        (this.baselineParameters.trailingBuyActivationPercent || 0.1) *
          rules.trailingBuyActivationMultiplier,
        0.01,
        1.0
      ),
      trailingBuyReboundPercent: this.applyBounds(
        (this.baselineParameters.trailingBuyReboundPercent || 0.05) *
          rules.trailingBuyReboundMultiplier,
        0.0,
        0.5
      ),
      trailingSellActivationPercent: this.applyBounds(
        (this.baselineParameters.trailingSellActivationPercent || 0.1) *
          rules.trailingSellActivationMultiplier,
        0.01,
        1.0
      ),
      trailingSellPullbackPercent: this.applyBounds(
        (this.baselineParameters.trailingSellPullbackPercent || 0.05) *
          rules.trailingSellPullbackMultiplier,
        0.0,
        0.5
      ),

      // Stop Loss Parameters
      hardStopLossPercent: this.applyBounds(
        (this.baselineParameters.hardStopLossPercent || 0.3) * rules.hardStopLossMultiplier,
        0.05,
        0.9
      ),
      portfolioStopLossPercent: rules.portfolioStopLossMultiplier
        ? this.applyBounds(
            (this.baselineParameters.portfolioStopLossPercent || 0.25) *
              rules.portfolioStopLossMultiplier,
            0.05,
            0.9
          )
        : this.baselineParameters.portfolioStopLossPercent,
      cascadeStopLossPercent: rules.cascadeStopLossMultiplier
        ? this.applyBounds(
            (this.baselineParameters.cascadeStopLossPercent || 0.35) *
              rules.cascadeStopLossMultiplier,
            0.05,
            0.9
          )
        : this.baselineParameters.cascadeStopLossPercent,

      // Timing Parameters
      entryDelay: rules.entryDelay,
      exitUrgencyMultiplier: rules.exitUrgencyMultiplier,
      minHoldingPeriod: rules.minHoldingPeriod || 0,
      confirmationPeriod: rules.confirmationPeriod || 0,

      // Feature Toggles
      enableConsecutiveIncremental: rules.enableConsecutiveIncremental,
      enableDynamicGrid: rules.enableDynamicGrid,

      // Volatility Thresholds (for mixed scenario)
      volatilityPauseThresholds: rules.volatilityPauseThresholds || null,

      // Metadata
      adaptiveRiskLevel: rules.riskLevel,
      lastAdaptationScenario: scenario.type,
      lastAdaptationConfidence: scenario.confidence,
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
        enableConsecutiveIncremental: true,
        enableDynamicGrid: true,

        riskLevel: 'MODERATE_AGGRESSIVE',
      },

      downtrend: {
        // Primary Controls - STOP BUYING
        buyEnabled: false,
        sellEnabled: true,
        buyPauseReason: 'DOWNTREND_DETECTED',

        // Parameter Multipliers
        gridSpacingMultiplier: 1.5,
        profitRequirementMultiplier: 1.3,
        maxLotsMultiplier: 0.5, // Reduce to 50%
        maxLotsToSellMultiplier: 1.5, // Sell more at once
        lotSizeMultiplier: 0.7,

        // Trailing Stop Adjustments - AGGRESSIVE SELLING
        enableTrailingBuy: false, // Buying disabled anyway
        enableTrailingSell: true,
        trailingBuyActivationMultiplier: 2.0,
        trailingBuyReboundMultiplier: 1.5,
        trailingSellActivationMultiplier: 0.7, // Activate earlier
        trailingSellPullbackMultiplier: 0.8, // Tighter pullback

        // Risk Management - TIGHTER PROTECTION
        hardStopLossMultiplier: 0.8,
        portfolioStopLossMultiplier: 0.8,
        cascadeStopLossMultiplier: 0.8,
        entryDelay: 5, // Wait 5 days
        exitUrgencyMultiplier: 1.5, // 50% faster exits

        // Feature Toggles
        enableConsecutiveIncremental: false,
        enableDynamicGrid: true,

        riskLevel: 'DEFENSIVE',
      },

      missed_rally: {
        // Primary Controls - STOP SELLING
        buyEnabled: true,
        sellEnabled: false,
        sellPauseReason: 'FAST_RALLY_DETECTED',

        // Parameter Multipliers
        gridSpacingMultiplier: 0.7,
        profitRequirementMultiplier: 0.8,
        maxLotsMultiplier: 1.2, // Increase to 120%
        maxLotsToSellMultiplier: 0.7, // Sell fewer when resumed
        lotSizeMultiplier: 1.1,

        // Trailing Stop Adjustments - AGGRESSIVE BUYING
        enableTrailingBuy: true,
        enableTrailingSell: false, // Selling disabled anyway
        trailingBuyActivationMultiplier: 0.5, // Activate earlier
        trailingBuyReboundMultiplier: 0.7, // Lower rebound
        trailingSellActivationMultiplier: 1.5,
        trailingSellPullbackMultiplier: 1.3,

        // Risk Management - LOOSER STOPS
        hardStopLossMultiplier: 1.3,
        portfolioStopLossMultiplier: 1.2,
        cascadeStopLossMultiplier: 1.3,
        entryDelay: 0,
        exitUrgencyMultiplier: 0.6, // Slower exits
        minHoldingPeriod: 7, // Hold at least 7 days

        // Feature Toggles
        enableConsecutiveIncremental: true,
        enableDynamicGrid: true,

        riskLevel: 'AGGRESSIVE',
      },

      mixed: {
        // Primary Controls - BOTH ENABLED BUT CAUTIOUS
        buyEnabled: true,
        sellEnabled: true,

        // Parameter Multipliers
        gridSpacingMultiplier: 1.0,
        profitRequirementMultiplier: 1.1, // Slight noise filter
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
        entryDelay: 1, // 1 day confirmation
        exitUrgencyMultiplier: 1.0,
        confirmationPeriod: 2,

        // Feature Toggles
        enableConsecutiveIncremental: true,
        enableDynamicGrid: true,

        // Conditional pausing based on volatility
        volatilityPauseThresholds: {
          buyPauseIfVolatilityAbove: 0.4,
          sellPauseIfVolatilityAbove: 0.5,
        },

        riskLevel: 'NEUTRAL_CAUTIOUS',
      },
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
    const keysToTrack = ['gridIntervalPercent', 'profitRequirement', 'maxLots'];

    keysToTrack.forEach(key => {
      if (oldParams[key] !== newParams[key]) {
        changes[key] = {
          from: oldParams[key],
          to: newParams[key],
        };
      }
    });

    return changes;
  }

  /**
   * Check for excessive regime flipping
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
        : null,
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
      averageRegimeDuration:
        scenarioDurations.length > 0
          ? scenarioDurations.reduce((sum, s) => sum + s.duration, 0) / scenarioDurations.length
          : 0,
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
            duration: event.dayIndex - regimeStartDay,
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
        duration: lastEvent.dayIndex - regimeStartDay,
      });
    }

    return durations;
  }
}

module.exports = AdaptiveStrategyService;
```

### 2. Integration with DCA Backtest Service

**File**: `/backend/services/dcaBacktestService.js`

**Integration Points**:

```javascript
// At the start of runBacktest()
async function runBacktest(params) {
  // ... existing initialization ...

  // Initialize adaptive strategy if enabled
  let adaptiveStrategy = null;
  if (params.enableAdaptiveStrategy) {
    const AdaptiveStrategyService = require('./adaptiveStrategyService');
    adaptiveStrategy = new AdaptiveStrategyService({
      enableAdaptiveStrategy: params.enableAdaptiveStrategy,
      adaptationCheckIntervalDays: params.adaptationCheckIntervalDays || 30,
      adaptationRollingWindowDays: params.adaptationRollingWindowDays || 90,
      minDataDaysBeforeAdaptation: params.minDataDaysBeforeAdaptation || 90,
      confidenceThreshold: params.confidenceThreshold || 0.7,
    });
  }

  // ... existing backtest loop ...
}

// Within the daily iteration loop
for (let dayIndex = 0; dayIndex < priceData.length; dayIndex++) {
  const dayData = priceData[dayIndex];

  // Check if adaptation should occur
  if (adaptiveStrategy && adaptiveStrategy.shouldCheckScenario(dayIndex)) {
    const adaptationResult = await adaptiveStrategy.checkAndAdapt({
      priceHistory: priceData.slice(0, dayIndex + 1),
      transactionHistory: transactions,
      currentParameters: currentParams,
      currentDate: dayData.date,
      dayIndex: dayIndex,
    });

    if (adaptationResult) {
      // Update current parameters for subsequent trading
      currentParams = adaptationResult.adjustedParameters;

      // Log regime change if occurred
      if (adaptationResult.regimeChange) {
        console.log(
          `Regime change detected on ${dayData.date}: ${adaptationResult.adaptationEvent.previousScenario} → ${adaptationResult.adaptationEvent.scenarioDetected.type}`
        );
      }
    }
  }

  // ... existing daily trading logic using currentParams ...
}

// At the end of backtest
const backtestResult = {
  // ... existing results ...

  // Add adaptive strategy results if enabled
  ...(adaptiveStrategy && {
    adaptiveStrategy: {
      enabled: true,
      adaptationHistory: adaptiveStrategy.getAdaptationHistory(),
      regimeStatistics: adaptiveStrategy.getRegimeStatistics(),
      whipsawWarning: adaptiveStrategy.checkForWhipsaw(),
      finalScenario: adaptiveStrategy.getCurrentScenario(),
    },
  }),
};
```

### 3. Comparative Analysis Service

**File**: `/backend/services/comparativeAnalysisService.js`

**Purpose**: Run both static and adaptive strategies for comparison

```javascript
class ComparativeAnalysisService {
  /**
   * Run both static and adaptive strategies and compare results
   * @param {Object} params - Backtest parameters
   * @returns {Object} - Comparison results
   */
  async runComparison(params) {
    const dcaBacktestService = require('./dcaBacktestService');

    // Run static strategy (baseline)
    const staticParams = {
      ...params,
      enableAdaptiveStrategy: false,
    };
    const staticResult = await dcaBacktestService.runBacktest(staticParams);

    // Run adaptive strategy
    const adaptiveParams = {
      ...params,
      enableAdaptiveStrategy: true,
    };
    const adaptiveResult = await dcaBacktestService.runBacktest(adaptiveParams);

    // Calculate deltas
    const comparison = this.calculateComparison(staticResult, adaptiveResult);

    return {
      static: staticResult,
      adaptive: adaptiveResult,
      comparison: comparison,
    };
  }

  /**
   * Calculate performance deltas between strategies
   * @param {Object} staticResult
   * @param {Object} adaptiveResult
   * @returns {Object}
   */
  calculateComparison(staticResult, adaptiveResult) {
    const metrics = ['totalReturn', 'totalReturnPercent', 'maxDrawdown', 'winRate'];

    const deltas = {};
    metrics.forEach(metric => {
      const staticValue = staticResult.summary[metric] || 0;
      const adaptiveValue = adaptiveResult.summary[metric] || 0;
      const delta = adaptiveValue - staticValue;
      const deltaPercent = staticValue !== 0 ? (delta / Math.abs(staticValue)) * 100 : 0;

      deltas[metric] = {
        static: staticValue,
        adaptive: adaptiveValue,
        delta: delta,
        deltaPercent: deltaPercent,
        improvement: delta > 0,
      };
    });

    // Trade count comparison
    deltas.totalTrades = {
      static: staticResult.summary.totalTrades || 0,
      adaptive: adaptiveResult.summary.totalTrades || 0,
      delta: (adaptiveResult.summary.totalTrades || 0) - (staticResult.summary.totalTrades || 0),
    };

    // Regime changes (adaptive only)
    deltas.regimeChanges =
      adaptiveResult.adaptiveStrategy?.regimeStatistics.totalRegimeChanges || 0;

    return deltas;
  }
}

module.exports = new ComparativeAnalysisService();
```

## API Design

### New Configuration Parameters

Add to backtest configuration:

```javascript
{
  // Existing parameters...
  symbol: "AAPL",
  startDate: "2023-01-01",
  endDate: "2024-01-01",

  // New adaptive strategy parameters
  enableAdaptiveStrategy: false,           // Master switch
  adaptationCheckIntervalDays: 30,         // How often to check (days)
  adaptationRollingWindowDays: 90,         // Rolling window size (days)
  minDataDaysBeforeAdaptation: 90,         // Min days before first check
  confidenceThreshold: 0.7,                // Min confidence for regime change
  compareWithStatic: false                 // Run both strategies for comparison
}
```

### API Response Extensions

#### Single Backtest Response

```javascript
{
  "summary": {
    // Existing fields...
  },
  "transactions": [...],
  "priceData": [...],

  // New adaptive strategy section (if enabled)
  "adaptiveStrategy": {
    "enabled": true,
    "adaptationHistory": [
      {
        "date": "2023-02-15",
        "dayIndex": 45,
        "event": "scenario_check",
        "scenarioDetected": {
          "type": "oscillating_uptrend",
          "confidence": 0.85,
          "keyMetrics": {
            "overallReturn": 8.5,
            "volatility": 12.3,
            "trendStrength": 0.72
          }
        },
        "parametersChanged": {
          "gridIntervalPercent": { "from": 0.10, "to": 0.09 }
        },
        "regimeChange": false
      },
      {
        "date": "2023-04-01",
        "dayIndex": 90,
        "event": "regime_change",
        "scenarioDetected": {
          "type": "downtrend",
          "confidence": 0.92,
          "keyMetrics": {
            "overallReturn": -15.2,
            "volatility": 18.5,
            "trendStrength": -0.68
          }
        },
        "parametersChanged": {
          "gridIntervalPercent": { "from": 0.09, "to": 0.15 },
          "profitRequirement": { "from": 0.05, "to": 0.06 },
          "maxLots": { "from": 10, "to": 6 }
        },
        "regimeChange": true,
        "previousScenario": "oscillating_uptrend"
      }
    ],
    "regimeStatistics": {
      "totalRegimeChanges": 3,
      "scenarioDurations": [
        {
          "scenario": "oscillating_uptrend",
          "startDay": 0,
          "endDay": 90,
          "duration": 90
        },
        {
          "scenario": "downtrend",
          "startDay": 90,
          "endDay": 180,
          "duration": 90
        }
      ],
      "averageRegimeDuration": 90
    },
    "whipsawWarning": {
      "warning": false,
      "changeCount": 3,
      "message": null
    },
    "finalScenario": {
      "type": "mixed",
      "confidence": 0.65,
      "keyMetrics": {...}
    }
  }
}
```

#### Comparative Analysis Response

```javascript
{
  "static": {
    "summary": {...},
    "transactions": [...]
  },
  "adaptive": {
    "summary": {...},
    "transactions": [...],
    "adaptiveStrategy": {...}
  },
  "comparison": {
    "totalReturn": {
      "static": -15234.50,
      "adaptive": -8521.30,
      "delta": 6713.20,
      "deltaPercent": 44.06,
      "improvement": true
    },
    "totalReturnPercent": {
      "static": -15.2,
      "adaptive": -8.5,
      "delta": 6.7,
      "deltaPercent": 44.08,
      "improvement": true
    },
    "maxDrawdown": {
      "static": -28.4,
      "adaptive": -22.1,
      "delta": 6.3,
      "deltaPercent": 22.18,
      "improvement": true
    },
    "winRate": {
      "static": 68,
      "adaptive": 72,
      "delta": 4,
      "deltaPercent": 5.88,
      "improvement": true
    },
    "totalTrades": {
      "static": 45,
      "adaptive": 38,
      "delta": -7
    },
    "regimeChanges": 3
  }
}
```

## Data Flow

### Adaptation Check Flow

```
Day N (Check Interval Reached)
  ↓
Extract Rolling Window Data (last 90 days)
  ↓
Run Scenario Detection Service
  ↓
Get Detected Scenario (type, confidence, metrics)
  ↓
Compare with Current Scenario
  ↓
Regime Change? (type changed + confidence > threshold)
  ↓
Yes: Apply Parameter Adjustments
  - Calculate multipliers based on scenario
  - Adjust: gridIntervalPercent, profitRequirement, maxLots
  ↓
Log Adaptation Event
  - Store: date, scenario, parameters before/after, regime change flag
  ↓
Continue Backtest with Adjusted Parameters
```

## Frontend Components

### 1. Adaptation Configuration Panel

**Component**: `AdaptationConfigPanel.js`

```jsx
function AdaptationConfigPanel({ config, onChange }) {
  return (
    <div className="adaptation-config">
      <h3>Adaptive Strategy Settings</h3>

      <label>
        <input
          type="checkbox"
          checked={config.enableAdaptiveStrategy}
          onChange={e => onChange('enableAdaptiveStrategy', e.target.checked)}
        />
        Enable Adaptive Strategy
      </label>

      {config.enableAdaptiveStrategy && (
        <div className="adaptation-settings">
          <div className="setting-row">
            <label>Check Interval (days)</label>
            <input
              type="number"
              value={config.adaptationCheckIntervalDays}
              onChange={e => onChange('adaptationCheckIntervalDays', parseInt(e.target.value))}
              min="1"
              max="90"
            />
            <small>How often to detect scenario and adjust parameters</small>
          </div>

          <div className="setting-row">
            <label>Rolling Window (days)</label>
            <input
              type="number"
              value={config.adaptationRollingWindowDays}
              onChange={e => onChange('adaptationRollingWindowDays', parseInt(e.target.value))}
              min="30"
              max="365"
            />
            <small>Amount of historical data to analyze</small>
          </div>

          <div className="setting-row">
            <label>Min Data Required (days)</label>
            <input
              type="number"
              value={config.minDataDaysBeforeAdaptation}
              onChange={e => onChange('minDataDaysBeforeAdaptation', parseInt(e.target.value))}
              min="30"
              max="180"
            />
            <small>Minimum days before first adaptation</small>
          </div>

          <div className="setting-row">
            <label>Confidence Threshold</label>
            <input
              type="number"
              step="0.05"
              value={config.confidenceThreshold}
              onChange={e => onChange('confidenceThreshold', parseFloat(e.target.value))}
              min="0.5"
              max="1.0"
            />
            <small>Minimum confidence for regime change (0.5-1.0)</small>
          </div>

          <label>
            <input
              type="checkbox"
              checked={config.compareWithStatic}
              onChange={e => onChange('compareWithStatic', e.target.checked)}
            />
            Compare with Static Strategy
          </label>
        </div>
      )}
    </div>
  );
}
```

### 2. Adaptation Timeline Component

**Component**: `AdaptationTimeline.js`

```jsx
function AdaptationTimeline({ adaptationHistory, priceData }) {
  const scenarioColors = {
    oscillating_uptrend: '#10b981',
    downtrend: '#ef4444',
    missed_rally: '#3b82f6',
    mixed: '#f59e0b',
  };

  return (
    <div className="adaptation-timeline">
      <h3>Adaptation Timeline</h3>

      <div className="timeline-container">
        {adaptationHistory.map((event, index) => (
          <div
            key={index}
            className={`timeline-event ${event.regimeChange ? 'regime-change' : 'check'}`}
            style={{
              left: `${(event.dayIndex / priceData.length) * 100}%`,
              borderColor: scenarioColors[event.scenarioDetected.type],
            }}
          >
            <div className="event-marker" />

            <div className="event-tooltip">
              <div className="tooltip-header">
                <strong>{event.date}</strong>
                {event.regimeChange && <span className="regime-badge">Regime Change</span>}
              </div>

              <div className="tooltip-content">
                <div className="scenario-info">
                  <span className="scenario-label">Scenario:</span>
                  <span className="scenario-type">{event.scenarioDetected.type}</span>
                  <span className="scenario-confidence">
                    ({(event.scenarioDetected.confidence * 100).toFixed(0)}% confidence)
                  </span>
                </div>

                {Object.keys(event.parametersChanged).length > 0 && (
                  <div className="parameter-changes">
                    <strong>Parameter Changes:</strong>
                    {Object.entries(event.parametersChanged).map(([param, change]) => (
                      <div key={param} className="param-change">
                        {param}: {change.from.toFixed(4)} → {change.to.toFixed(4)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3. Regime Summary Component

**Component**: `RegimeSummary.js`

```jsx
function RegimeSummary({ regimeStatistics, totalDays }) {
  return (
    <div className="regime-summary">
      <h3>Market Regime Analysis</h3>

      <table className="regime-table">
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Duration</th>
            <th>% of Time</th>
            <th>Period</th>
          </tr>
        </thead>
        <tbody>
          {regimeStatistics.scenarioDurations.map((regime, index) => (
            <tr key={index}>
              <td>
                <span className={`scenario-badge ${regime.scenario}`}>
                  {regime.scenario.replace('_', ' ')}
                </span>
              </td>
              <td>{regime.duration} days</td>
              <td>{((regime.duration / totalDays) * 100).toFixed(1)}%</td>
              <td>
                Day {regime.startDay} - {regime.endDay}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="regime-stats">
        <div className="stat-item">
          <label>Regime Changes:</label>
          <span>{regimeStatistics.totalRegimeChanges}</span>
        </div>
        <div className="stat-item">
          <label>Average Regime Duration:</label>
          <span>{Math.round(regimeStatistics.averageRegimeDuration)} days</span>
        </div>
      </div>
    </div>
  );
}
```

### 4. Comparative Results Component

**Component**: `ComparativeResults.js`

```jsx
function ComparativeResults({ comparison }) {
  return (
    <div className="comparative-results">
      <h3>Strategy Performance Comparison</h3>

      <table className="comparison-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Static</th>
            <th>Adaptive</th>
            <th>Delta</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total Return</td>
            <td className={comparison.totalReturn.static >= 0 ? 'positive' : 'negative'}>
              {formatCurrency(comparison.totalReturn.static)}
            </td>
            <td className={comparison.totalReturn.adaptive >= 0 ? 'positive' : 'negative'}>
              {formatCurrency(comparison.totalReturn.adaptive)}
            </td>
            <td className={comparison.totalReturn.improvement ? 'positive' : 'negative'}>
              {comparison.totalReturn.delta > 0 ? '+' : ''}
              {formatCurrency(comparison.totalReturn.delta)}
              <small>({comparison.totalReturn.deltaPercent.toFixed(1)}%)</small>
            </td>
          </tr>

          <tr>
            <td>Total Return %</td>
            <td className={comparison.totalReturnPercent.static >= 0 ? 'positive' : 'negative'}>
              {comparison.totalReturnPercent.static.toFixed(2)}%
            </td>
            <td className={comparison.totalReturnPercent.adaptive >= 0 ? 'positive' : 'negative'}>
              {comparison.totalReturnPercent.adaptive.toFixed(2)}%
            </td>
            <td className={comparison.totalReturnPercent.improvement ? 'positive' : 'negative'}>
              {comparison.totalReturnPercent.delta > 0 ? '+' : ''}
              {comparison.totalReturnPercent.delta.toFixed(2)}%
            </td>
          </tr>

          <tr>
            <td>Max Drawdown</td>
            <td className="negative">{comparison.maxDrawdown.static.toFixed(2)}%</td>
            <td className="negative">{comparison.maxDrawdown.adaptive.toFixed(2)}%</td>
            <td className={comparison.maxDrawdown.improvement ? 'positive' : 'negative'}>
              {comparison.maxDrawdown.delta > 0 ? '+' : ''}
              {comparison.maxDrawdown.delta.toFixed(2)}%
            </td>
          </tr>

          <tr>
            <td>Win Rate</td>
            <td>{comparison.winRate.static.toFixed(1)}%</td>
            <td>{comparison.winRate.adaptive.toFixed(1)}%</td>
            <td className={comparison.winRate.improvement ? 'positive' : 'negative'}>
              {comparison.winRate.delta > 0 ? '+' : ''}
              {comparison.winRate.delta.toFixed(1)}%
            </td>
          </tr>

          <tr>
            <td>Total Trades</td>
            <td>{comparison.totalTrades.static}</td>
            <td>{comparison.totalTrades.adaptive}</td>
            <td>
              {comparison.totalTrades.delta > 0 ? '+' : ''}
              {comparison.totalTrades.delta}
            </td>
          </tr>

          <tr>
            <td>Regime Changes</td>
            <td>N/A</td>
            <td>{comparison.regimeChanges}</td>
            <td>-</td>
          </tr>
        </tbody>
      </table>

      {comparison.totalReturn.improvement && Math.abs(comparison.totalReturn.deltaPercent) > 5 && (
        <div className="significance-indicator">
          <strong>Statistically Significant:</strong> Adaptive strategy improved performance by{' '}
          {comparison.totalReturn.deltaPercent.toFixed(1)}% (>5% threshold)
        </div>
      )}
    </div>
  );
}
```

## Performance Optimizations

### 1. Caching Rolling Window Calculations

```javascript
class AdaptiveStrategyService {
  constructor(config) {
    // ... existing code ...
    this.rollingWindowCache = new Map();
  }

  extractRollingWindow(priceHistory, transactionHistory, windowDays) {
    const cacheKey = `${priceHistory.length}-${windowDays}`;

    if (this.rollingWindowCache.has(cacheKey)) {
      return this.rollingWindowCache.get(cacheKey);
    }

    const result = {
      prices: priceHistory.slice(-windowDays),
      transactions: transactionHistory.filter(tx => {
        const txDate = new Date(tx.date);
        const windowStartDate = new Date(priceHistory[priceHistory.length - windowDays].date);
        return txDate >= windowStartDate;
      }),
    };

    this.rollingWindowCache.set(cacheKey, result);
    return result;
  }
}
```

### 2. Lazy Scenario Detection

Only run full scenario detection on check intervals, not every day.

### 3. Incremental History Updates

Maintain adaptation history as events occur rather than recalculating.

## Error Handling

### Insufficient Data

```javascript
if (dayIndex < this.config.minDataDaysBeforeAdaptation) {
  return null; // Not enough data yet
}

if (priceHistory.length < this.config.adaptationRollingWindowDays) {
  console.warn(
    `Insufficient data for rolling window: ${priceHistory.length} days available, ${this.config.adaptationRollingWindowDays} required`
  );
  return null;
}
```

### Scenario Detection Failure

```javascript
try {
  const detectedScenario = await scenarioDetectionService.detectScenario({
    priceData: rollingWindowData.prices,
    transactions: rollingWindowData.transactions,
    strategy: currentParameters.strategy,
  });
} catch (error) {
  console.error('Scenario detection failed:', error);
  // Fall back to mixed scenario with low confidence
  const fallbackScenario = {
    type: 'mixed',
    confidence: 0.5,
    keyMetrics: {},
    error: error.message,
  };
  return fallbackScenario;
}
```

### Invalid Parameter Adjustments

```javascript
adjustParameters(currentParams, scenario, regimeChange) {
  const adjusted = {
    ...currentParams,
    gridIntervalPercent: Math.max(0.01, Math.min(1.0,
      this.baselineParameters.gridIntervalPercent * adjustmentRules.gridSpacingMultiplier
    )),
    profitRequirement: Math.max(0.01, Math.min(1.0,
      this.baselineParameters.profitRequirement * adjustmentRules.profitRequirementMultiplier
    )),
    maxLots: Math.max(1, Math.min(100,
      Math.round(this.baselineParameters.maxLots * adjustmentRules.maxLotsMultiplier)
    ))
  };

  return adjusted;
}
```

## Testing Strategy

### Unit Tests

```javascript
// Test adaptation timing
describe('AdaptiveStrategyService', () => {
  test('should check scenario at correct intervals', () => {
    const service = new AdaptiveStrategyService({
      adaptationCheckIntervalDays: 30,
      minDataDaysBeforeAdaptation: 90,
    });

    expect(service.shouldCheckScenario(89)).toBe(false);
    expect(service.shouldCheckScenario(90)).toBe(true);
    expect(service.shouldCheckScenario(120)).toBe(true);
    expect(service.shouldCheckScenario(121)).toBe(false);
  });

  test('should detect regime changes correctly', () => {
    const service = new AdaptiveStrategyService({ confidenceThreshold: 0.7 });

    service.currentScenario = { type: 'oscillating_uptrend', confidence: 0.8 };

    const newScenario = { type: 'downtrend', confidence: 0.85 };
    expect(service.detectRegimeChange(newScenario)).toBe(true);

    const lowConfScenario = { type: 'downtrend', confidence: 0.65 };
    expect(service.detectRegimeChange(lowConfScenario)).toBe(false);
  });

  test('should apply parameter adjustments correctly', () => {
    const service = new AdaptiveStrategyService({});
    service.baselineParameters = {
      gridIntervalPercent: 0.1,
      profitRequirement: 0.05,
      maxLots: 10,
    };

    const currentParams = { ...service.baselineParameters };
    const scenario = { type: 'downtrend', confidence: 0.9 };

    const adjusted = service.adjustParameters(currentParams, scenario, true);

    expect(adjusted.gridIntervalPercent).toBe(0.15); // 0.10 * 1.5
    expect(adjusted.profitRequirement).toBe(0.06); // 0.05 * 1.2
    expect(adjusted.maxLots).toBe(6); // 10 * 0.6
  });
});
```

### Integration Tests

```javascript
describe('DCA Backtest with Adaptive Strategy', () => {
  test('should run backtest with adaptation enabled', async () => {
    const result = await dcaBacktestService.runBacktest({
      symbol: 'AAPL',
      startDate: '2023-01-01',
      endDate: '2024-01-01',
      enableAdaptiveStrategy: true,
      adaptationCheckIntervalDays: 30,
    });

    expect(result.adaptiveStrategy).toBeDefined();
    expect(result.adaptiveStrategy.enabled).toBe(true);
    expect(result.adaptiveStrategy.adaptationHistory.length).toBeGreaterThan(0);
  });
});
```

## Migration Path

### Phase 1: Backend Implementation

1. Create adaptiveStrategyService.js
2. Add integration hooks to dcaBacktestService.js
3. Extend API responses with adaptation data
4. Add unit tests

### Phase 2: Basic Frontend

1. Add configuration controls to DCABacktestForm
2. Display adaptation history in BacktestResults
3. Basic styling

### Phase 3: Advanced Visualization

1. Implement AdaptationTimeline component
2. Implement RegimeSummary component
3. Add parameter evolution charts

### Phase 4: Comparative Analysis

1. Implement comparativeAnalysisService.js
2. Add ComparativeResults component
3. Side-by-side comparison UI

## Security Considerations

No security implications - all computations run server-side during backtest simulation.

## Monitoring and Logging

```javascript
// Log adaptation events
console.log(`[Adaptive Strategy] Day ${dayIndex}: Scenario check`);
console.log(`[Adaptive Strategy] Detected: ${scenario.type} (confidence: ${scenario.confidence})`);
if (regimeChange) {
  console.log(`[Adaptive Strategy] REGIME CHANGE: ${previousScenario} → ${newScenario}`);
}
console.log(`[Adaptive Strategy] Parameters adjusted:`, parameterChanges);
```

## Configuration Defaults

Add to `/config/backtestDefaults.json`:

```json
{
  "enableAdaptiveStrategy": false,
  "adaptationCheckIntervalDays": 30,
  "adaptationRollingWindowDays": 90,
  "minDataDaysBeforeAdaptation": 90,
  "confidenceThreshold": 0.7,
  "compareWithStatic": false
}
```
