# Spec 65: Design Document - DCA Score Sub-Metrics Display

## Status: ALREADY IMPLEMENTED

Upon investigating this feature request, I discovered that **DCA Score sub-metrics breakdown is already fully implemented** in the Beta Group Analysis component.

## Current Implementation

### Location
`frontend/src/components/backtest/BetaGroupAnalysis.js` (lines 167-211)

### Display Mechanism
The breakdown is shown in the **expanded view** when a user clicks on any beta group row. Each beta group row has an expand/collapse button (▼).

### What Gets Displayed

When a beta group is expanded, the "DCA Suitability Breakdown" section shows:

```
DCA Suitability Breakdown
┌─────────────────────────────────────────────────┐
│ Trade Activity           │ XX/25                 │
│                          │ X.X trades/stock/year │
├─────────────────────────────────────────────────┤
│ Mean Reversion           │ XX/25                 │
│                          │ XX.X% profitable exits│
├─────────────────────────────────────────────────┤
│ Capital Efficiency       │ XX/25                 │
│                          │ XX.X% utilization     │
├─────────────────────────────────────────────────┤
│ Grid Utilization         │ XX/25                 │
│                          │ XX.X% grid used       │
└─────────────────────────────────────────────────┘
```

Each metric shows:
1. **Score out of 25** (numerator/denominator format)
2. **Additional context** below the score (e.g., "5.2 trades/stock/year")

### Code Implementation

**Lines 168-211** from BetaGroupAnalysis.js:

```javascript
<div className="details-section">
  <h4>DCA Suitability Breakdown</h4>
  <div className="suitability-grid">
    <div className="suitability-metric">
      <div className="metric-label">Trade Activity</div>
      <div className="metric-value">
        {perf.suitabilityBreakdown?.tradeActivity || 0}/25
      </div>
      <div className="metric-detail">
        {perf.tradeFrequency?.toFixed(1)} trades/stock/year
      </div>
    </div>

    <div className="suitability-metric">
      <div className="metric-label">Mean Reversion</div>
      <div className="metric-value">
        {perf.suitabilityBreakdown?.meanReversion || 0}/25
      </div>
      <div className="metric-detail">
        {perf.meanReversionScore?.toFixed(1)}% profitable exits
      </div>
    </div>

    <div className="suitability-metric">
      <div className="metric-label">Capital Efficiency</div>
      <div className="metric-value">
        {perf.suitabilityBreakdown?.capitalEfficiency || 0}/25
      </div>
      <div className="metric-detail">
        {perf.avgCapitalUtilization?.toFixed(1)}% utilization
      </div>
    </div>

    <div className="suitability-metric">
      <div className="metric-label">Grid Utilization</div>
      <div className="metric-value">
        {perf.suitabilityBreakdown?.gridUtilization || 0}/25
      </div>
      <div className="metric-detail">
        {perf.gridUtilization?.toFixed(1)}% grid used
      </div>
    </div>
  </div>

  <div className="suitability-interpretation">
    {perf.suitabilityInterpretation}
  </div>
</div>
```

### Data Source

The backend already provides this data via `backend/services/helpers/dcaSuitabilityScorer.js`:

```javascript
return {
  totalScore: parseFloat(totalScore.toFixed(1)),
  breakdown: {
    tradeActivity: tradeActivityScore,      // 0-25
    meanReversion: meanRevScore,            // 0-25
    capitalEfficiency: capitalEfficiencyScore, // 0-25
    gridUtilization: gridUtilScore          // 0-25
  },
  interpretation: getScoreInterpretation(totalScore)
};
```

The data flows through:
1. `dcaSuitabilityScorer.js` calculates breakdown
2. `groupMetricsCalculator.js` includes it in group metrics
3. `portfolioBacktestService.js` includes it in beta grouping response
4. `BetaGroupAnalysis.js` displays it in the expanded view

## User Discovery Issue

The user may not have realized this feature exists because:

1. **Hidden by default**: The breakdown only appears when clicking the expand button (▼)
2. **No visual cue**: There's no indicator that sub-metrics are available
3. **Requires interaction**: Users must explicitly expand each beta group

## Potential Enhancement (Optional)

While the feature exists, we could make it more discoverable by:

1. **Always visible summary**: Show a mini-breakdown next to the total score in the collapsed view
2. **Tooltip on hover**: Display breakdown when hovering over DCA score badge
3. **Visual progress bars**: Add small progress bars for each component (0-25 scale)

However, these are **UI/UX enhancements**, not missing functionality.

## Conclusion

**No implementation work needed**. The requested feature (displaying 4 sub-metrics breakdown) is already fully implemented and working correctly.

**User Action Required**: Click the expand button (▼) on any beta group row to see the detailed breakdown.

## Verification

To verify this feature works:

1. Run a portfolio backtest (e.g., nasdaq100 config)
2. Scroll to "Beta Group Analysis" section
3. Click the expand button (▼) on any beta group row
4. Look for "DCA Suitability Breakdown" section showing:
   - Trade Activity: X/25
   - Mean Reversion: X/25
   - Capital Efficiency: X/25
   - Grid Utilization: X/25

## Related Documentation

See the interpretation guide at the bottom of BetaGroupAnalysis component (lines 280-296):

> The DCA Suitability Score (0-100) measures how well a beta group fits the DCA strategy mechanics:
>
> - **Trade Activity (25pts):** Enough volatility to create buying opportunities
> - **Mean Reversion (25pts):** Price recovery after dips (essential for DCA)
> - **Capital Efficiency (25pts):** Effective deployment of allocated capital
> - **Grid Utilization (25pts):** Volatility matches grid spacing

## Response to User

The 4 sub-metrics breakdown is already available! When viewing the Beta Group Analysis:

1. Click the ▼ (expand) button on any beta group row
2. You'll see "DCA Suitability Breakdown" showing all 4 components:
   - Trade Activity (X/25 pts)
   - Mean Reversion (X/25 pts)
   - Capital Efficiency (X/25 pts)
   - Grid Utilization (X/25 pts)

Each metric includes additional context like "X.X trades/stock/year" to help you understand the score.

The feature was already implemented to help users understand why certain beta groups have specific DCA suitability scores!
