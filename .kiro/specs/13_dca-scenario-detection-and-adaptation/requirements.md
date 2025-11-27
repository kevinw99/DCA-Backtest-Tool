# DCA Scenario Detection and Adaptive Strategy - Requirements

## Overview

Implement scenario detection to classify DCA backtest outcomes and provide adaptive strategy recommendations based on market conditions. The system should identify three primary scenarios where DCA performs differently and provide insights to optimize strategy parameters.

## Business Goals

1. Help users understand WHY a DCA strategy succeeded or failed
2. Provide actionable insights for parameter optimization
3. Enable early detection of unfavorable scenarios during live trading
4. Improve capital efficiency by adapting to market conditions

## Three Core Scenarios

### Scenario 1: Oscillating Uptrend (DCA Optimal)

**Characteristics:**

- Price trends upward with periodic pullbacks
- Sufficient volatility to trigger both buy and sell signals
- DCA captures dips and peaks while riding the trend

**Expected Results:**

- Total return > Buy-and-hold return
- High trade count (>10 trades)
- Good win rate (>70%)
- Efficient capital deployment
- Lower max drawdown vs buy-and-hold

### Scenario 2: Downtrend (DCA Underperforms)

**Characteristics:**

- Price trends downward consistently
- DCA keeps buying the dip ("catching a falling knife")
- Few or no sell opportunities due to profit requirements
- High capital deployed with large unrealized losses

**Expected Results:**

- Negative total return
- Many buy orders, few/no sell orders
- High capital utilization (>70%)
- Large unrealized losses > realized gains
- Total loss magnitude > buy-and-hold loss

### Scenario 3: Fast Rally (DCA Misses Opportunity)

**Characteristics:**

- Price appreciates quickly without significant pullbacks
- No entry points at desired grid levels
- DCA sits in cash while stock runs up

**Expected Results:**

- Low trade count (<5 trades)
- Low capital utilization (<30%)
- Total return << Buy-and-hold return
- High opportunity cost

## Functional Requirements

### FR1: Scenario Classification (Ex-Post Analysis)

**Priority:** Must Have

After each backtest completes:

1. Analyze backtest metrics
2. Classify into one of the three scenarios (or "Mixed")
3. Calculate confidence score (0-100%)
4. Provide scenario-specific insights

**Classification Criteria:**

```
Scenario 2 (Downtrend):
- totalReturn < -10% AND
- capitalUtilization > 70% AND
- unrealizedPnL < 0 AND
- |unrealizedPnL| > |realizedPnL|
- Confidence: High

Scenario 3 (Missed Rally):
- totalTrades < 5 AND
- capitalUtilization < 30% AND
- buyAndHoldReturn > totalReturn * 2
- Confidence: High

Scenario 1 (Oscillating Uptrend):
- totalReturn > 0 AND
- winRate > 70% AND
- totalTrades > 10
- Confidence: High

Mixed:
- None of the above criteria met
- Confidence: Medium/Low
```

### FR2: Scenario Analysis Dashboard Section

**Priority:** Must Have

Add new section to backtest results displaying:

1. Scenario type (with icon/color coding)
2. Confidence level
3. Key characteristics that led to classification
4. Comparison metrics vs buy-and-hold
5. Actionable recommendations

**Example Display:**

```
📊 Scenario Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scenario Type: Downtrend (Unfavorable for DCA)
Confidence: High (92%)

Key Indicators:
  ✗ Total Return: -23.5% vs Buy & Hold: -12.3%
  ✗ Capital Deployed: 85% (too high in downtrend)
  ✗ Unrealized Loss: -$18,500 vs Realized: -$2,300
  ✗ Trade Pattern: 15 buys, 2 sells (buying falling knife)

Recommendations:
  1. Consider stop-loss at -15% to limit downside
  2. Reduce position sizing in downtrends
  3. Use trend filters (e.g., price above 200-day MA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### FR3: Risk Metrics Enhancement

**Priority:** Must Have

Add new risk metrics to backtest results:

1. **Capital Efficiency Score:** % of time capital was deployed profitably
2. **Opportunity Cost:** % lost vs buy-and-hold (when underperforming)
3. **Scenario Risk Score:** 0-100 indicating strategy suitability
4. **Max Unrealized Drawdown:** Largest paper loss during backtest
5. **Buy/Sell Ratio:** Number of buys vs sells (indicates trend)

### FR4: Batch Results Scenario Summary

**Priority:** Should Have

For batch testing, provide aggregate scenario analysis:

1. Distribution chart: How many tests fell into each scenario
2. Symbol-scenario matrix: Which symbols exhibit which scenarios
3. Parameter sensitivity: Which parameters correlate with favorable scenarios
4. Best/worst performers by scenario type

### FR5: Enable/Disable Flag

**Priority:** Must Have

**Requirement:** Easy fallback to existing behavior

Add configuration flag: `enableScenarioDetection` (default: true)

- When `true`: Calculate and display scenario analysis
- When `false`: Skip all scenario detection (existing behavior)
- No impact on backtest calculations, only on analysis/display

Implementation:

```javascript
{
  // In backtestDefaults.json
  enableScenarioDetection: true,  // New flag, defaults to true

  // In backtest results
  scenarioAnalysis: enableScenarioDetection ? {
    type: 'downtrend',
    confidence: 0.92,
    // ... analysis data
  } : null
}
```

### FR6: Parameter Recommendations (Future Phase)

**Priority:** Nice to Have

Based on scenario detected, suggest parameter adjustments:

- Scenario 2: Recommend adding stop-loss, reducing position size
- Scenario 3: Recommend wider grids, initial position, or aggressive entry
- Scenario 1: Current parameters working well

## Non-Functional Requirements

### NFR1: Performance

- Scenario classification must complete in <100ms
- Should not increase backtest execution time by >5%
- Calculations should be done after backtest completes

### NFR2: Backward Compatibility

- Existing backtests continue to work without modification
- All existing metrics remain unchanged
- New features are additive only (no breaking changes)

### NFR3: User Experience

- Clear, actionable insights (not just data dumps)
- Color-coded indicators (green=good, red=bad, yellow=warning)
- Progressive disclosure: summary first, details on expand

### NFR4: Extensibility

- Easy to add new scenario types in future
- Pluggable classification algorithms
- Configurable thresholds for scenario detection

## User Stories

### US1: As a trader, I want to understand why my DCA strategy failed

**Acceptance Criteria:**

- After backtest, I see clear classification of the scenario
- I understand which market conditions led to poor performance
- I receive specific recommendations to improve strategy

### US2: As a batch tester, I want to see which stocks are suitable for DCA

**Acceptance Criteria:**

- Batch results show scenario distribution
- I can filter results by scenario type
- I can identify stocks that exhibit oscillating patterns (Scenario 1)

### US3: As a risk manager, I want to know worst-case capital requirements

**Acceptance Criteria:**

- I see max unrealized drawdown metrics
- I understand maximum capital that could be at risk
- I can assess if the strategy fits my risk tolerance

### US4: As a developer, I want to easily disable new features

**Acceptance Criteria:**

- Single flag disables all scenario detection
- System falls back to existing behavior
- No errors or warnings when disabled

## Success Metrics

### Quantitative

1. 90%+ accuracy in scenario classification (validated against manual review)
2. <100ms overhead for scenario analysis
3. Zero regression in existing backtest functionality
4. User adoption: >70% keep feature enabled after 1 month

### Qualitative

1. Users report better understanding of DCA performance
2. Reduced questions about "why did DCA lose money in downtrend"
3. Positive feedback on actionable recommendations

## Out of Scope (For This Phase)

1. **Real-time scenario detection during live trading**
   - Complex, requires streaming data analysis
   - Will be separate feature in future

2. **Automated parameter adjustment**
   - Too risky for initial release
   - Requires extensive testing and validation

3. **Machine learning-based prediction**
   - Requires training data collection first
   - Consider for Phase 2

4. **Multi-timeframe scenario analysis**
   - Adds complexity
   - Start with single timeframe

## Dependencies

1. Existing backtest metrics (totalReturn, trades, etc.)
2. Buy-and-hold return calculation (already implemented)
3. Price data for volatility calculations (already available)

## Assumptions

1. Users understand basic DCA strategy mechanics
2. Historical patterns provide useful classification (not predictive)
3. Three scenario types cover 80%+ of real-world cases
4. Users prefer actionable insights over raw metrics

## Risks and Mitigations

### Risk 1: Over-classification

**Impact:** False confidence in scenario detection
**Mitigation:**

- Include confidence scores
- Add "Mixed" category for unclear cases
- Provide threshold tuning in future

### Risk 2: Analysis paralysis

**Impact:** Too much information overwhelms users
**Mitigation:**

- Start with summary view
- Progressive disclosure for details
- Focus on top 3 recommendations

### Risk 3: Performance degradation

**Impact:** Slow backtest results
**Mitigation:**

- Optimize calculations
- Run analysis asynchronously
- Cache intermediate results

## Future Enhancements

1. **Phase 2: Predictive Indicators**
   - Volatility forecasting
   - Trend strength analysis
   - Early warning system

2. **Phase 3: Adaptive Strategy**
   - Auto-adjust parameters based on conditions
   - Dynamic position sizing
   - Conditional stop-losses

3. **Phase 4: Portfolio-level Analysis**
   - Scenario correlation across symbols
   - Diversification recommendations
   - Risk-adjusted scenario allocation
