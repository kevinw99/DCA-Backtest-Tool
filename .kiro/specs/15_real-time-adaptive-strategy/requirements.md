# Requirements: Real-Time Adaptive Strategy

## Document Control

- **Spec ID**: 15
- **Created**: 2025-10-04
- **Status**: Draft
- **Priority**: High
- **Depends On**: Spec #13 (DCA Scenario Detection)

## Overview

This specification extends the scenario detection system (Spec #13) from ex-post analysis to real-time adaptation. Instead of only identifying market scenarios after the backtest completes, the system will periodically detect scenarios during the backtest and dynamically adjust strategy parameters to optimize performance for the current market conditions.

## Problem Statement

The current implementation (Spec #13) provides valuable post-backtest analysis showing which market scenario occurred and whether DCA was suitable. However, this analysis is **retrospective** and doesn't help the strategy adapt during execution.

### Current Limitations:

1. **Static Parameters**: Grid spacing, profit requirements, and position sizes remain fixed throughout the entire backtest period
2. **No Adaptation**: System cannot respond to regime changes (e.g., uptrend → downtrend)
3. **Missed Optimization**: Optimal parameters for oscillating uptrends are suboptimal for downtrends
4. **Capital Inefficiency**: System deploys capital the same way regardless of whether conditions favor DCA

### Real-World Analogy:

Current system is like driving with cruise control in all conditions (highway, city, mountain). Real-time adaptation is like adjusting speed based on road conditions.

## Goals

### Primary Goals:

1. **Periodic Scenario Detection**: Analyze market conditions every N days during backtest
2. **Dynamic Parameter Adjustment**: Modify strategy parameters based on detected scenario
3. **Regime Change Detection**: Identify when market conditions shift significantly
4. **Performance Tracking**: Compare adaptive vs. static strategy performance

### Secondary Goals:

1. **Configuration Flexibility**: Allow users to enable/disable adaptation and configure check intervals
2. **Adaptation History**: Track all parameter changes and regime changes over time
3. **Visual Indicators**: Show regime changes and parameter adjustments on charts
4. **Comparative Analysis**: Display side-by-side results for static vs. adaptive strategies

## Non-Goals

- Machine learning or predictive algorithms (use rule-based thresholds)
- Real-time trading execution (backtest only)
- Intraday adaptation (daily granularity is sufficient)
- External data sources (use only price and transaction data)

## Functional Requirements

### FR1: Periodic Scenario Detection

**Priority**: High

**Description**: During backtest execution, detect current market scenario at configurable intervals.

**Acceptance Criteria**:

- Scenario detection runs every N days (configurable, default: 30 days)
- Detection uses rolling window of recent data (configurable, default: 90 days)
- Detection logic identical to post-backtest analysis (Spec #13)
- Minimum data requirement: Detection starts after first rolling window completes
- Detection results stored with timestamp for historical analysis

**Configuration Parameters**:

```javascript
{
  enableAdaptiveStrategy: true,  // Master switch
  adaptationCheckIntervalDays: 30,  // How often to check scenario
  adaptationRollingWindowDays: 90,  // How much historical data to analyze
  minDataDaysBeforeAdaptation: 90   // Minimum days before first adaptation
}
```

### FR2: Dynamic Parameter Adjustment

**Priority**: High

**Description**: Automatically adjust strategy parameters based on detected scenario.

**Acceptance Criteria**:

- Parameters adjusted immediately after scenario detection
- Adjustments based on predefined rules per scenario type
- Only specified parameters are modified (grid spacing, profit requirement, position sizing)
- Original baseline parameters preserved for reference
- Parameter changes logged with timestamp and reason

**Comprehensive Adjustment Rules**:

### **Scenario 1: Oscillating Uptrend** (Ideal DCA Environment)

**Primary Controls**:

- Buy Operations: **ENABLED** ✅
- Sell Operations: **ENABLED** ✅

**Parameter Adjustments**:

- Grid Spacing: **0.9x** baseline (tighter grid to catch dips)
- Profit Requirement: **1.0x** baseline (standard)
- Max Lots: **1.0x** baseline (full deployment)
- Max Lots to Sell: **1.0x** baseline (standard)
- Lot Size: **1.0x** baseline

**Trailing Stops**:

- Trailing Buy: **Enabled** (standard settings)
- Trailing Sell: **Enabled** (standard settings)
- Trailing Buy Activation: **1.0x** baseline
- Trailing Sell Activation: **1.0x** baseline

**Risk Management**:

- Hard Stop Loss: **1.0x** baseline (normal protection)
- Entry Delay: **0 days** (no delay)
- Exit Urgency: **1.0x** (normal timing)

**Feature Toggles**:

- Consecutive Incremental: **ENABLED**
- Dynamic Grid: **ENABLED**

**Risk Level**: Moderate-Aggressive

---

### **Scenario 2: Downtrend** (Falling Knife - High Risk)

**Primary Controls**:

- Buy Operations: **DISABLED** 🛑 (stop buying in downtrend)
- Sell Operations: **ENABLED** ✅ (exit positions)

**Parameter Adjustments**:

- Grid Spacing: **1.5x** baseline (wider grid to avoid catching knife)
- Profit Requirement: **1.3x** baseline (higher profit needed)
- Max Lots: **0.5x** baseline ⬇️ (reduce exposure to 50%)
- Max Lots to Sell: **1.5x** baseline ⬆️ (sell more at once)
- Lot Size: **0.7x** baseline (smaller positions)

**Trailing Stops**:

- Trailing Buy: **DISABLED** (buying disabled anyway)
- Trailing Sell: **AGGRESSIVE MODE**
  - Activation: **0.7x** baseline (activate earlier)
  - Pullback: **0.8x** baseline (tighter, exit faster)

**Risk Management**:

- Hard Stop Loss: **0.8x** baseline (tighter protection)
- Portfolio Stop Loss: **0.8x** baseline
- Entry Delay: **5 days** (wait before any entry consideration)
- Exit Urgency: **1.5x** (50% faster exits)

**Feature Toggles**:

- Consecutive Incremental: **DISABLED** (no progressive sizing)
- Dynamic Grid: **ENABLED** (keep volatility adjustments)

**Risk Level**: Defensive

---

### **Scenario 3: Missed Rally** (Fast Uptrend - Strong Momentum)

**Primary Controls**:

- Buy Operations: **ENABLED** ✅ (chase momentum)
- Sell Operations: **DISABLED** 🛑 (hold positions, don't miss run-up)

**Parameter Adjustments**:

- Grid Spacing: **0.7x** baseline (very tight grid)
- Profit Requirement: **0.8x** baseline (lower target, take profits faster when selling resumes)
- Max Lots: **1.2x** baseline ⬆️ (increase exposure to 120%)
- Max Lots to Sell: **0.7x** baseline ⬇️ (sell fewer when selling resumes)
- Lot Size: **1.1x** baseline (larger positions)

**Trailing Stops**:

- Trailing Buy: **AGGRESSIVE MODE**
  - Activation: **0.5x** baseline (activate earlier)
  - Rebound: **0.7x** baseline (lower rebound needed)
- Trailing Sell: **DISABLED** (selling disabled anyway)

**Risk Management**:

- Hard Stop Loss: **1.3x** baseline (looser, avoid shakeouts)
- Portfolio Stop Loss: **1.2x** baseline
- Entry Delay: **0 days** (enter immediately)
- Exit Urgency: **0.6x** (slower exits when selling resumes)
- Min Holding Period: **7 days** (hold at least 7 days)

**Feature Toggles**:

- Consecutive Incremental: **ENABLED**
- Dynamic Grid: **ENABLED**

**Risk Level**: Aggressive

---

### **Scenario 4: Mixed/Uncertain** (Choppy, No Clear Trend)

**Primary Controls**:

- Buy Operations: **ENABLED** ✅ (but cautious)
- Sell Operations: **ENABLED** ✅ (but cautious)

**Parameter Adjustments**:

- Grid Spacing: **1.0x** baseline (neutral)
- Profit Requirement: **1.1x** baseline (slightly higher, noise filter)
- Max Lots: **0.9x** baseline (slightly reduced)
- Max Lots to Sell: **1.0x** baseline
- Lot Size: **0.9x** baseline (smaller lots)

**Trailing Stops**:

- Trailing Buy: **Enabled** (slightly conservative)
  - Activation: **1.1x** baseline
  - Rebound: **1.1x** baseline (require confirmation)
- Trailing Sell: **Enabled** (slightly conservative)
  - Activation: **1.1x** baseline

**Risk Management**:

- Hard Stop Loss: **1.0x** baseline (normal)
- Entry Delay: **1 day** (small confirmation delay)
- Exit Urgency: **1.0x** (normal)
- Confirmation Period: **2 days** (wait for signal confirmation)

**Feature Toggles**:

- Consecutive Incremental: **ENABLED**
- Dynamic Grid: **ENABLED** (critical for choppy markets)

**Additional Conditions**:

- Pause buying if volatility > 0.4 (spike detection)
- Pause selling if volatility > 0.5 (high volatility)

**Risk Level**: Neutral-Cautious

---

### **Summary Table: Adjustment Rules by Scenario**

| Control Level          | Oscillating Uptrend | Downtrend    | Fast Rally   | Mixed    |
| ---------------------- | ------------------- | ------------ | ------------ | -------- |
| **PRIMARY CONTROLS**   |                     |              |              |          |
| Buy Operations         | ✅ ON               | 🛑 OFF       | ✅ ON        | ✅ ON    |
| Sell Operations        | ✅ ON               | ✅ ON        | 🛑 OFF       | ✅ ON    |
| **SECONDARY CONTROLS** |                     |              |              |          |
| Trailing Buy           | Standard            | N/A (off)    | Aggressive   | Standard |
| Trailing Sell          | Standard            | Aggressive   | N/A (off)    | Standard |
| **PARAMETERS**         |                     |              |              |          |
| Grid Spacing           | 0.9x                | 1.5x         | 0.7x         | 1.0x     |
| Profit Target          | 1.0x                | 1.3x         | 0.8x         | 1.1x     |
| Max Exposure           | 100%                | 50%          | 120%         | 90%      |
| Lot Size               | 1.0x                | 0.7x         | 1.1x         | 0.9x     |
| Entry Delay            | 0 days              | 5 days       | 0 days       | 1 day    |
| Exit Speed             | 1.0x                | 1.5x         | 0.6x         | 1.0x     |
| Stop Loss              | 1.0x                | 0.8x (tight) | 1.3x (loose) | 1.0x     |
| **FEATURES**           |                     |              |              |          |
| Consecutive Inc        | ✅                  | ❌           | ✅           | ✅       |
| Dynamic Grid           | ✅                  | ✅           | ✅           | ✅       |
| **RISK LEVEL**         | Moderate-Agg        | Defensive    | Aggressive   | Neutral  |

### FR3: Regime Change Detection

**Priority**: High

**Description**: Identify when market conditions significantly change from previous scenario.

**Acceptance Criteria**:

- Regime change flagged when scenario type changes (e.g., uptrend → downtrend)
- Regime change triggers immediate parameter adjustment
- Confidence threshold required before declaring regime change (default: 0.7)
- Regime changes logged with timestamp, old scenario, new scenario, confidence
- Frequent regime flipping (>3 changes in 90 days) triggers warning

**Regime Change Detection Logic**:

```javascript
if (newScenario.type !== currentScenario.type && newScenario.confidence > 0.7) {
  logRegimeChange({
    timestamp: currentDate,
    fromScenario: currentScenario,
    toScenario: newScenario,
    confidence: newScenario.confidence,
  });

  adjustParameters(newScenario);
}
```

### FR4: Adaptation History Tracking

**Priority**: Medium

**Description**: Maintain complete history of all scenario detections and parameter changes.

**Acceptance Criteria**:

- Each adaptation event recorded with full context
- History includes: timestamp, scenario detected, confidence, parameters before/after, reason
- History accessible in backtest results JSON
- History displayed in UI timeline component
- Export capability for analysis

**Data Structure**:

```javascript
adaptationHistory: [
  {
    date: '2024-01-15',
    dayIndex: 30,
    event: 'scenario_check',
    scenarioDetected: {
      type: 'oscillating_uptrend',
      confidence: 0.85,
      keyMetrics: {...}
    },
    parametersChanged: {
      gridIntervalPercent: { from: 0.10, to: 0.09 },
      profitRequirement: { from: 0.05, to: 0.05 }
    },
    regimeChange: false
  },
  {
    date: '2024-02-14',
    dayIndex: 60,
    event: 'regime_change',
    scenarioDetected: {
      type: 'downtrend',
      confidence: 0.92,
      keyMetrics: {...}
    },
    parametersChanged: {
      gridIntervalPercent: { from: 0.09, to: 0.15 },
      profitRequirement: { from: 0.05, to: 0.06 },
      maxLots: { from: 10, to: 6 }
    },
    regimeChange: true,
    previousScenario: 'oscillating_uptrend'
  }
]
```

### FR5: Comparative Performance Analysis

**Priority**: Medium

**Description**: Enable side-by-side comparison of adaptive vs. static strategy performance.

**Acceptance Criteria**:

- Single backtest can run both strategies simultaneously
- Results show performance delta (adaptive - static)
- Metrics tracked: total return, max drawdown, win rate, total trades
- UI displays comparison table and charts
- Statistical significance indicator (if adaptive improvement > 5%)

**Comparison Display**:

```
Strategy Performance Comparison:
┌─────────────────────┬──────────┬──────────┬────────┐
│ Metric              │ Static   │ Adaptive │ Delta  │
├─────────────────────┼──────────┼──────────┼────────┤
│ Total Return        │ -15.2%   │ -8.5%    │ +6.7%  │
│ Max Drawdown        │ -28.4%   │ -22.1%   │ +6.3%  │
│ Win Rate            │ 68%      │ 72%      │ +4%    │
│ Total Trades        │ 45       │ 38       │ -7     │
│ Regime Changes      │ N/A      │ 3        │ -      │
└─────────────────────┴──────────┴──────────┴────────┘
```

## Non-Functional Requirements

### NFR1: Performance

- Scenario detection must complete in <100ms per check
- Total backtest time increase <10% with adaptation enabled
- Memory overhead <50MB for adaptation history

### NFR2: Configurability

- All adaptation parameters configurable via UI and API
- Easy enable/disable without code changes
- Sensible defaults for new users

### NFR3: Backward Compatibility

- Existing backtests continue to work without adaptation
- API response structure extends existing (not breaks)
- Static strategy remains default behavior

### NFR4: Transparency

- All parameter changes visible and explainable
- Confidence scores displayed for all detections
- Warning when adaptation may be counterproductive

## UI/UX Requirements

### Configuration Panel

Add to backtest configuration form:

```
[x] Enable Adaptive Strategy

    Adaptation Settings:
    - Check Interval: [30] days
    - Rolling Window: [90] days
    - Min Data Required: [90] days
    - Confidence Threshold: [0.7]

    [ ] Show adaptation events on chart
    [ ] Compare with static strategy
```

### Results Display

Add new section to backtest results:

**Adaptation Timeline**:

- Visual timeline showing regime changes
- Markers for each adaptation check
- Tooltip showing detected scenario and parameter changes
- Color coding: Green (uptrend), Red (downtrend), Yellow (mixed), Blue (rally)

**Parameter Evolution Chart**:

- Line chart showing how parameters changed over time
- Separate lines for grid spacing, profit requirement, max lots
- Shaded regions indicating different regime periods

**Regime Summary**:

```
Market Regime Analysis:
┌─────────────────────┬──────────┬──────────┬───────────┐
│ Scenario            │ Duration │ % of Time│ Trades    │
├─────────────────────┼──────────┼──────────┼───────────┤
│ Oscillating Uptrend │ 180 days │ 45%      │ 28        │
│ Downtrend           │ 120 days │ 30%      │ 12        │
│ Mixed               │ 100 days │ 25%      │ 15        │
└─────────────────────┴──────────┴──────────┴───────────┘

Regime Changes: 3
Average Regime Duration: 133 days
```

## Affected Components

### Backend

**New Files**:

- `/backend/services/adaptiveStrategyService.js` - Core adaptation logic
- `/backend/services/regimeChangeDetector.js` - Regime change detection

**Modified Files**:

- `/backend/services/dcaBacktestService.js` - Integrate periodic checks
- `/backend/services/shortDCABacktestService.js` - Same for short strategy
- `/backend/services/scenarioDetectionService.js` - Extract detection to reusable function

### Frontend

**New Components**:

- `/frontend/src/components/AdaptationTimeline.js` - Timeline visualization
- `/frontend/src/components/RegimeSummary.js` - Regime analysis table
- `/frontend/src/components/ParameterEvolutionChart.js` - Parameter changes chart

**Modified Components**:

- `/frontend/src/components/DCABacktestForm.js` - Add adaptation config options
- `/frontend/src/components/BacktestResults.js` - Display adaptation results
- `/frontend/src/components/BacktestChart.js` - Add regime change markers

## Success Criteria

- [ ] Adaptive strategy improves performance in downtrend scenarios by >5%
- [ ] Regime changes detected with >80% accuracy (manual validation)
- [ ] Adaptation history complete and accurate for all checks
- [ ] UI clearly shows when/why parameters changed
- [ ] Performance overhead <10% vs. static strategy
- [ ] Comparative analysis easy to interpret
- [ ] No errors or crashes with adaptation enabled
- [ ] Configuration persists across page refreshes

## Dependencies

- **Spec #13**: DCA Scenario Detection (must be implemented first)
- **Spec #11**: Dynamic Grid Spacing (parameter adjustment builds on this)
- **Spec #12**: Consecutive Incremental (may interact with adaptation)

## Risks and Mitigations

| Risk                              | Impact | Mitigation                                 |
| --------------------------------- | ------ | ------------------------------------------ |
| Over-adaptation (too frequent)    | High   | Require minimum interval (30 days default) |
| False regime changes              | Medium | Require confidence threshold (0.7 default) |
| Whipsaw trading (regime flipping) | Medium | Flag warning if >3 changes in 90 days      |
| Performance degradation           | Low    | Cache rolling window calculations          |
| Complexity for users              | Medium | Clear defaults, optional advanced settings |
| Overfitting to historical data    | High   | Use simple rule-based logic, avoid ML      |

## Timeline Estimate

- Requirements & Design: 2 hours
- Backend Implementation: 8 hours
  - Adaptive strategy service: 4 hours
  - Integration with backtest: 2 hours
  - Regime change detector: 2 hours
- Frontend Implementation: 6 hours
  - Configuration UI: 2 hours
  - Timeline visualization: 2 hours
  - Results display: 2 hours
- Testing: 4 hours
- **Total**: ~20 hours (2.5 days)

## Future Enhancements

1. **ML-Based Prediction**: Use machine learning to predict regime changes before they fully manifest
2. **Multi-Timeframe Analysis**: Detect scenarios on different timeframes (weekly, monthly)
3. **Custom Adaptation Rules**: Allow users to define their own parameter adjustment rules
4. **Backtesting Optimization**: Run parameter sweep to find optimal adaptation rules
5. **Real-Time Alerts**: Notify when regime change detected in live trading scenario
