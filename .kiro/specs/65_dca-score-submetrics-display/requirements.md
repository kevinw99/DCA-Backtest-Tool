# Spec 65: Requirements - DCA Score Sub-Metrics Display

## Problem Statement

The DCA Suitability Score currently shows only the total score (0-100) without breaking down the 4 component metrics. This makes it difficult for users to understand:
- Which aspects of their strategy are working well
- Which aspects need improvement
- Why high-volatility stocks might have high returns but low DCA suitability scores

## User Request

> "I see 'Understanding DCA Suitability Score [...]' Then would be interesting to report these 4 sub-metrics as well for better understanding. please implement this as a new spec."

## Background

The DCA Suitability Score is calculated from 4 equally-weighted components (each worth 0-25 points):

1. **Trade Activity** (0-25 pts): How frequently the strategy trades
   - 25pts: ≥12 trades per year
   - 15pts: 6-11 trades per year
   - 5pts: 1-5 trades per year
   - 0pts: No trades

2. **Mean Reversion** (0-25 pts): How well prices revert after dips
   - 25pts: Mean reversion score ≥75
   - 15pts: Mean reversion score 50-74
   - 5pts: Mean reversion score 1-49
   - 0pts: No mean reversion

3. **Capital Efficiency** (0-25 pts): How well capital is utilized
   - 25pts: Capital utilization ≥70%
   - 15pts: Capital utilization 50-69%
   - 5pts: Capital utilization 1-49%
   - 0pts: No capital utilized

4. **Grid Utilization** (0-25 pts): Optimal usage of averaging-down levels
   - 25pts: Grid utilization 60-80% (optimal range)
   - 15pts: Grid utilization 40-59% or 81-100%
   - 5pts: Grid utilization 1-39%
   - 0pts: No grid utilization

**Total Score**: Sum of 4 components (0-100)

## Current State

**Backend** (`backend/services/helpers/dcaSuitabilityScorer.js`):
- Already calculates and returns the breakdown in response
- Response format:
  ```javascript
  {
    totalScore: 75.0,
    breakdown: {
      tradeActivity: 25,
      meanReversion: 15,
      capitalEfficiency: 25,
      gridUtilization: 10
    },
    interpretation: "Excellent"
  }
  ```

**Frontend**:
- Only displays the total score
- Does not show the breakdown
- Missing visualization of component scores

## Requirements

### FR1: Display Sub-Metrics Breakdown

Display the 4 component scores alongside the total DCA Suitability Score:

```
DCA Suitability Score: 75 (Excellent)

Score Breakdown:
• Trade Activity:      25/25 pts  [████████████████████████████] 100%
• Mean Reversion:      15/25 pts  [████████████████            ]  60%
• Capital Efficiency:  25/25 pts  [████████████████████████████] 100%
• Grid Utilization:    10/25 pts  [███████████                 ]  40%
```

### FR2: Location

Add the breakdown display wherever DCA Suitability Score is currently shown:
- Portfolio results summary
- Beta group analysis
- Individual stock analysis

### FR3: Visual Design

- Use progress bars or similar visual indicators for each component
- Show both numeric value (X/25 pts) and percentage
- Use color coding:
  - Green: 20-25 pts (80-100%)
  - Yellow: 10-19 pts (40-79%)
  - Red: 0-9 pts (0-39%)

### FR4: Tooltip/Help Text

Provide explanations for each component (on hover or info icon):
- Trade Activity: "Frequency of buy/sell trades"
- Mean Reversion: "How well prices bounce back after dips"
- Capital Efficiency: "Percentage of capital actively deployed"
- Grid Utilization: "Usage of averaging-down grid levels"

### FR5: Consistency

Ensure breakdown display is consistent across:
- Regular portfolio backtests
- Optimized capital scenarios (Spec 61)
- Beta group analysis
- Any other location showing DCA scores

## Non-Functional Requirements

### NFR1: Performance
- No impact on backtest execution time (data already computed)
- Minimal impact on rendering time

### NFR2: Maintainability
- Create reusable component for breakdown display
- Use existing score data from backend (no API changes needed)

### NFR3: Accessibility
- Color coding should not be the only indicator (use numeric values too)
- Screen reader friendly labels

## Success Criteria

1. Users can see which components contribute to DCA score
2. Users understand why high-volatility stocks may have low DCA suitability despite high returns
3. Users can identify which aspects of their strategy need improvement
4. Breakdown display is consistent across all DCA score locations

## Out of Scope

- Changing the scoring algorithm
- Adding weights or customization to components
- Historical trending of component scores
- Component-specific recommendations
