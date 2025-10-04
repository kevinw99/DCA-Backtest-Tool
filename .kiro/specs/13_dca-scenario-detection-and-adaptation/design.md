# DCA Scenario Detection and Adaptive Strategy - Design

## Architecture Overview

### High-Level Design

```
┌─────────────────┐
│  Backtest Run   │
│   (Existing)    │
└────────┬────────┘
         │
         ├──────────────────────┐
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌─────────────────────┐
│ Backtest Result │    │  enableScenario     │
│    Metrics      │    │   Detection?        │
└────────┬────────┘    └──────────┬──────────┘
         │                        │
         │              Yes ───────┘
         │                        │
         ▼                        ▼
┌─────────────────────────────────────────────┐
│       Scenario Detection Service            │
│  ┌────────────────────────────────────────┐ │
│  │  1. Metric Extraction                  │ │
│  │  2. Scenario Classification            │ │
│  │  3. Confidence Calculation             │ │
│  │  4. Recommendations Generation         │ │
│  └────────────────────────────────────────┘ │
└────────────────────┬────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Enhanced Result with │
         │  Scenario Analysis    │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│  Individual     │     │  Batch Results   │
│  Results UI     │     │  with Scenario   │
│  + Scenario     │     │  Summary         │
│  Section        │     └──────────────────┘
└─────────────────┘
```

## Component Design

### 1. Scenario Detection Service

**Location:** `/backend/services/scenarioDetectionService.js`

**Purpose:** Analyze backtest results and classify into scenarios

**Key Functions:**

```javascript
/**
 * Main entry point for scenario detection
 * @param {Object} backtestResult - Complete backtest result
 * @param {Object} config - Configuration (enable/disable flags)
 * @returns {Object|null} Scenario analysis or null if disabled
 */
function detectScenario(backtestResult, config = {}) {
  if (!config.enableScenarioDetection) {
    return null;
  }

  const metrics = extractMetrics(backtestResult);
  const scenario = classifyScenario(metrics);
  const confidence = calculateConfidence(scenario, metrics);
  const recommendations = generateRecommendations(scenario, metrics);

  return {
    type: scenario.type,
    confidence: confidence,
    metrics: scenario.keyMetrics,
    recommendations: recommendations,
    analysis: scenario.analysis,
  };
}

/**
 * Extract relevant metrics for classification
 */
function extractMetrics(backtestResult) {
  return {
    totalReturn: backtestResult.totalReturnPercent,
    buyAndHoldReturn: backtestResult.buyAndHoldReturnPercent,
    totalTrades: backtestResult.totalTrades,
    winRate: backtestResult.winRate,
    capitalUtilization: backtestResult.avgCapitalDeployed / backtestResult.maxExposure,
    unrealizedPnL: backtestResult.unrealizedPnL,
    realizedPnL: backtestResult.realizedPnL,
    buyCount: backtestResult.transactions.filter(t => t.type === 'buy').length,
    sellCount: backtestResult.transactions.filter(t => t.type === 'sell').length,
    maxDrawdown: backtestResult.maxDrawdownPercent,
    maxUnrealizedDrawdown: calculateMaxUnrealizedDrawdown(backtestResult),
  };
}

/**
 * Classify scenario based on metrics
 */
function classifyScenario(metrics) {
  // Scenario 2: Downtrend (highest priority - most dangerous)
  if (isDowntrendScenario(metrics)) {
    return {
      type: 'downtrend',
      keyMetrics: {
        totalReturn: metrics.totalReturn,
        capitalUtilization: metrics.capitalUtilization,
        unrealizedPnL: metrics.unrealizedPnL,
        buySellRatio: metrics.buyCount / (metrics.sellCount || 1),
      },
      analysis: {
        pattern: 'Falling Knife',
        dcaSuitability: 'Poor',
        risk: 'High',
      },
    };
  }

  // Scenario 3: Fast Rally
  if (isFastRallyScenario(metrics)) {
    return {
      type: 'missed_rally',
      keyMetrics: {
        totalTrades: metrics.totalTrades,
        capitalUtilization: metrics.capitalUtilization,
        opportunityCost: metrics.buyAndHoldReturn - metrics.totalReturn,
      },
      analysis: {
        pattern: 'Momentum Without Pullbacks',
        dcaSuitability: 'Poor',
        risk: 'Low (Opportunity Cost)',
      },
    };
  }

  // Scenario 1: Oscillating Uptrend
  if (isOscillatingUptrendScenario(metrics)) {
    return {
      type: 'oscillating_uptrend',
      keyMetrics: {
        totalReturn: metrics.totalReturn,
        winRate: metrics.winRate,
        totalTrades: metrics.totalTrades,
        vsBAH: metrics.totalReturn - metrics.buyAndHoldReturn,
      },
      analysis: {
        pattern: 'Volatile Uptrend',
        dcaSuitability: 'Excellent',
        risk: 'Low-Medium',
      },
    };
  }

  // Default: Mixed
  return {
    type: 'mixed',
    keyMetrics: metrics,
    analysis: {
      pattern: 'Complex/Mixed',
      dcaSuitability: 'Moderate',
      risk: 'Variable',
    },
  };
}

/**
 * Calculate confidence score (0-1)
 */
function calculateConfidence(scenario, metrics) {
  const thresholds = getScenarioThresholds(scenario.type);
  let matchScore = 0;
  let totalChecks = 0;

  // Check each criterion and calculate match percentage
  for (const [key, threshold] of Object.entries(thresholds)) {
    totalChecks++;
    if (meetsThreshold(metrics[key], threshold)) {
      matchScore++;
    }
  }

  return matchScore / totalChecks;
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(scenario, metrics) {
  const recommendations = [];

  switch (scenario.type) {
    case 'downtrend':
      recommendations.push({
        priority: 'critical',
        action: 'Add Stop-Loss Protection',
        reason: `Total loss ${metrics.totalReturn.toFixed(1)}% exceeds threshold`,
        suggestion: `Enable hardStopLoss at -15% to limit downside risk`,
      });

      if (metrics.capitalUtilization > 0.7) {
        recommendations.push({
          priority: 'high',
          action: 'Reduce Position Sizing',
          reason: `${(metrics.capitalUtilization * 100).toFixed(0)}% capital deployed in downtrend`,
          suggestion: `Consider reducing maxLots or increasing lotSizeUsd to limit exposure`,
        });
      }

      recommendations.push({
        priority: 'medium',
        action: 'Use Trend Filter',
        reason: 'DCA performs poorly in sustained downtrends',
        suggestion: 'Only allow buys when price is above 200-day moving average',
      });
      break;

    case 'missed_rally':
      recommendations.push({
        priority: 'high',
        action: 'Consider Initial Position',
        reason: `Missed ${metrics.opportunityCost.toFixed(1)}% opportunity due to no entry`,
        suggestion: 'Buy 1 lot immediately, then use DCA for additional entries',
      });

      recommendations.push({
        priority: 'medium',
        action: 'Widen Grid Intervals',
        reason: 'Tight grids prevented entry in fast-moving market',
        suggestion: 'Increase gridIntervalPercent from 10% to 15-20%',
      });
      break;

    case 'oscillating_uptrend':
      recommendations.push({
        priority: 'low',
        action: 'Strategy Working Well',
        reason: `${metrics.totalReturn.toFixed(1)}% return with ${metrics.winRate.toFixed(0)}% win rate`,
        suggestion: 'Current parameters are well-suited for this stock',
      });

      if (metrics.vsBAH > 5) {
        recommendations.push({
          priority: 'low',
          action: 'Consider Position Sizing',
          reason: `DCA outperformed buy-and-hold by ${metrics.vsBAH.toFixed(1)}%`,
          suggestion: 'This stock exhibits ideal DCA characteristics - consider larger position',
        });
      }
      break;

    case 'mixed':
      recommendations.push({
        priority: 'medium',
        action: 'Review Parameters',
        reason: 'Results show mixed characteristics',
        suggestion: 'Analyze individual trades to identify optimization opportunities',
      });
      break;
  }

  return recommendations;
}
```

### 2. Scenario Classification Logic

**Thresholds Configuration:**

```javascript
const SCENARIO_THRESHOLDS = {
  downtrend: {
    totalReturn: { operator: '<', value: -10 },
    capitalUtilization: { operator: '>', value: 0.7 },
    unrealizedPnL: { operator: '<', value: 0 },
    unrealizedToRealizedRatio: { operator: '>', value: 1.5 },
  },

  missed_rally: {
    totalTrades: { operator: '<', value: 5 },
    capitalUtilization: { operator: '<', value: 0.3 },
    opportunityCostRatio: { operator: '>', value: 2.0 }, // BAH return > 2x DCA
  },

  oscillating_uptrend: {
    totalReturn: { operator: '>', value: 0 },
    winRate: { operator: '>', value: 70 },
    totalTrades: { operator: '>', value: 10 },
  },
};
```

### 3. Enhanced Risk Metrics

**New Metrics to Calculate:**

```javascript
function calculateEnhancedRiskMetrics(backtestResult) {
  return {
    // Capital Efficiency: % of time capital was deployed profitably
    capitalEfficiencyScore: calculateCapitalEfficiency(backtestResult),

    // Opportunity Cost: Lost return vs buy-and-hold
    opportunityCost: backtestResult.buyAndHoldReturnPercent - backtestResult.totalReturnPercent,

    // Scenario Risk Score: 0-100 indicating strategy suitability
    scenarioRiskScore: calculateScenarioRiskScore(backtestResult),

    // Max Unrealized Drawdown: Largest paper loss
    maxUnrealizedDrawdown: calculateMaxUnrealizedDrawdown(backtestResult),

    // Buy/Sell Ratio: Indicates trend direction
    buySellRatio: backtestResult.buyCount / (backtestResult.sellCount || 1),
  };
}

function calculateCapitalEfficiency(result) {
  // Calculate % of days where deployed capital had positive return
  let profitableDays = 0;
  let totalDaysWithCapital = 0;

  result.dailyPnL.forEach(day => {
    if (day.capitalDeployed > 0) {
      totalDaysWithCapital++;
      if (day.dailyReturn > 0) {
        profitableDays++;
      }
    }
  });

  return totalDaysWithCapital > 0 ? profitableDays / totalDaysWithCapital : 0;
}

function calculateScenarioRiskScore(result) {
  // 0 = very risky, 100 = very safe
  let score = 50; // Start neutral

  // Adjust based on return
  score += Math.min(30, Math.max(-30, result.totalReturnPercent / 2));

  // Adjust based on drawdown
  score -= Math.min(30, result.maxDrawdownPercent);

  // Adjust based on capital utilization in loss scenarios
  if (result.totalReturnPercent < 0 && result.capitalUtilization > 0.7) {
    score -= 20; // High capital in losing strategy = risky
  }

  return Math.max(0, Math.min(100, score));
}
```

### 4. Integration Points

#### 4.1 Backtest Service Integration

**File:** `/backend/services/dcaBacktestService.js`

```javascript
async function runDCABacktest(params) {
  // ... existing backtest logic ...

  const result = {
    // ... existing result fields ...
  };

  // Add scenario detection if enabled
  if (params.enableScenarioDetection !== false) {
    const scenarioDetectionService = require('./scenarioDetectionService');
    result.scenarioAnalysis = scenarioDetectionService.detectScenario(result, {
      enableScenarioDetection: params.enableScenarioDetection,
    });

    // Add enhanced risk metrics
    result.enhancedRiskMetrics = scenarioDetectionService.calculateEnhancedRiskMetrics(result);
  }

  return result;
}
```

#### 4.2 Batch Results Enhancement

**File:** `/backend/services/batchBacktestService.js`

```javascript
async function runBatchBacktest(options) {
  // ... run all combinations ...

  const results = await Promise.all(
    combinations.map(combo =>
      runDCABacktest({ ...combo, enableScenarioDetection: options.enableScenarioDetection })
    )
  );

  // Calculate scenario distribution
  const scenarioSummary = calculateScenarioDistribution(results);

  return {
    results,
    scenarioSummary: options.enableScenarioDetection ? scenarioSummary : null,
    // ... other fields
  };
}

function calculateScenarioDistribution(results) {
  const distribution = {
    oscillating_uptrend: { count: 0, symbols: [] },
    downtrend: { count: 0, symbols: [] },
    missed_rally: { count: 0, symbols: [] },
    mixed: { count: 0, symbols: [] },
  };

  results.forEach(result => {
    if (result.scenarioAnalysis) {
      const type = result.scenarioAnalysis.type;
      distribution[type].count++;
      distribution[type].symbols.push(result.symbol);
    }
  });

  return distribution;
}
```

### 5. Frontend UI Components

#### 5.1 Scenario Analysis Card Component

**File:** `/frontend/src/components/ScenarioAnalysis.js`

```jsx
function ScenarioAnalysis({ scenarioAnalysis, enhancedRiskMetrics }) {
  if (!scenarioAnalysis) return null;

  const scenarioConfig = {
    oscillating_uptrend: {
      icon: '📈',
      color: '#22c55e',
      label: 'Oscillating Uptrend',
      subtitle: 'Ideal for DCA',
    },
    downtrend: {
      icon: '📉',
      color: '#ef4444',
      label: 'Downtrend',
      subtitle: 'Unfavorable for DCA',
    },
    missed_rally: {
      icon: '🚀',
      color: '#f59e0b',
      label: 'Fast Rally',
      subtitle: 'DCA Missed Opportunity',
    },
    mixed: {
      icon: '📊',
      color: '#6b7280',
      label: 'Mixed Pattern',
      subtitle: 'Moderate Suitability',
    },
  };

  const config = scenarioConfig[scenarioAnalysis.type];

  return (
    <div className="scenario-analysis-card">
      <h3>📊 Scenario Analysis</h3>

      <div className="scenario-header" style={{ borderLeft: `4px solid ${config.color}` }}>
        <div className="scenario-icon">{config.icon}</div>
        <div>
          <div className="scenario-label">{config.label}</div>
          <div className="scenario-subtitle">{config.subtitle}</div>
        </div>
        <div className="confidence-badge">
          Confidence: {(scenarioAnalysis.confidence * 100).toFixed(0)}%
        </div>
      </div>

      <div className="key-metrics">
        <h4>Key Indicators</h4>
        {Object.entries(scenarioAnalysis.metrics).map(([key, value]) => (
          <div key={key} className="metric-row">
            <span className="metric-label">{formatMetricLabel(key)}</span>
            <span className="metric-value">{formatMetricValue(key, value)}</span>
          </div>
        ))}
      </div>

      <div className="recommendations">
        <h4>Recommendations</h4>
        {scenarioAnalysis.recommendations.map((rec, idx) => (
          <div key={idx} className={`recommendation priority-${rec.priority}`}>
            <div className="rec-header">
              <span className="priority-badge">{rec.priority}</span>
              <strong>{rec.action}</strong>
            </div>
            <div className="rec-reason">{rec.reason}</div>
            <div className="rec-suggestion">💡 {rec.suggestion}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 5.2 Batch Scenario Summary

**File:** `/frontend/src/components/BatchScenarioSummary.js`

```jsx
function BatchScenarioSummary({ scenarioSummary }) {
  if (!scenarioSummary) return null;

  const total = Object.values(scenarioSummary).reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="batch-scenario-summary">
      <h3>Scenario Distribution</h3>

      <div className="scenario-chart">
        {Object.entries(scenarioSummary).map(([type, data]) => {
          const percentage = (data.count / total) * 100;
          return (
            <div key={type} className="scenario-bar">
              <div className="bar-label">
                {scenarioConfig[type].icon} {scenarioConfig[type].label}
              </div>
              <div className="bar-container">
                <div
                  className="bar-fill"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: scenarioConfig[type].color,
                  }}
                />
              </div>
              <div className="bar-stats">
                {data.count} ({percentage.toFixed(1)}%)
              </div>
            </div>
          );
        })}
      </div>

      <div className="scenario-details">
        {Object.entries(scenarioSummary).map(
          ([type, data]) =>
            data.symbols.length > 0 && (
              <details key={type}>
                <summary>
                  {scenarioConfig[type].label} Symbols ({data.symbols.length})
                </summary>
                <div className="symbol-list">{data.symbols.join(', ')}</div>
              </details>
            )
        )}
      </div>
    </div>
  );
}
```

### 6. Configuration Management

#### 6.1 Default Configuration

**File:** `/config/backtestDefaults.json`

```json
{
  "enableScenarioDetection": true
  // ... existing fields
}
```

#### 6.2 UI Toggle

**File:** `/frontend/src/components/DCABacktestForm.js`

```jsx
<div className="form-group checkbox-group">
  <label>
    <input
      type="checkbox"
      checked={parameters.enableScenarioDetection !== false}
      onChange={e => handleChange('enableScenarioDetection', e.target.checked)}
    />
    Enable Scenario Detection
  </label>
  <span className="form-help">Analyze backtest patterns and provide recommendations</span>
</div>
```

## Data Flow

### Individual Backtest Flow

```
User Input → Backtest → Result Metrics → Scenario Detection → Enhanced Result → UI Display
                                    ↓
                              (if disabled)
                                    ↓
                         Skip Detection → Basic Result → UI Display
```

### Batch Backtest Flow

```
User Input → Batch Config → Multiple Backtests → Individual Scenarios
                                                         ↓
                                                 Aggregate Analysis
                                                         ↓
                                              Distribution Summary → UI
```

## Error Handling

```javascript
function detectScenario(backtestResult, config) {
  try {
    if (!config.enableScenarioDetection) {
      return null;
    }

    // Validate input
    if (!backtestResult || !backtestResult.totalReturnPercent) {
      console.warn('Invalid backtest result for scenario detection');
      return null;
    }

    // ... detection logic ...
  } catch (error) {
    console.error('Scenario detection failed:', error);
    // Gracefully degrade - return null instead of breaking
    return null;
  }
}
```

## Performance Considerations

1. **Lazy Calculation:** Only calculate scenario analysis if enabled
2. **Memoization:** Cache scenario results for repeat access
3. **Async Processing:** Run scenario detection asynchronously for batch results
4. **Minimal Overhead:** Target <100ms for scenario detection

```javascript
// Async wrapper for batch processing
async function detectScenariosAsync(results, config) {
  if (!config.enableScenarioDetection) {
    return results;
  }

  return Promise.all(results.map(result => Promise.resolve(detectScenario(result, config))));
}
```

## Testing Strategy

1. **Unit Tests:**
   - Test each scenario classification independently
   - Test confidence calculation
   - Test recommendation generation

2. **Integration Tests:**
   - Test with real backtest results
   - Verify enable/disable flag works
   - Test batch scenario aggregation

3. **Validation Tests:**
   - Manually classify 100 backtests
   - Compare algorithm classification vs manual
   - Target >90% agreement

## Rollout Plan

### Phase 1: Core Implementation

- Implement scenario detection service
- Add to individual backtest results
- Add UI components
- Enable/disable flag

### Phase 2: Batch Enhancement

- Add scenario distribution
- Symbol-scenario matrix
- Batch UI components

### Phase 3: Refinement

- Tune classification thresholds
- Add more recommendation types
- User feedback integration

## CSS Styling

```css
.scenario-analysis-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.scenario-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  padding-left: 16px;
  background: #f9fafb;
  border-radius: 4px;
  margin-bottom: 16px;
}

.scenario-icon {
  font-size: 32px;
}

.confidence-badge {
  margin-left: auto;
  padding: 4px 12px;
  background: #3b82f6;
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.recommendation {
  border-left: 3px solid;
  padding: 12px;
  margin: 8px 0;
  background: #f9fafb;
}

.recommendation.priority-critical {
  border-color: #ef4444;
  background: #fef2f2;
}

.recommendation.priority-high {
  border-color: #f59e0b;
  background: #fffbeb;
}

.recommendation.priority-medium {
  border-color: #3b82f6;
  background: #eff6ff;
}

.recommendation.priority-low {
  border-color: #22c55e;
  background: #f0fdf4;
}
```
