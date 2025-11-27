# Requirements: Remove and Consolidate Annualized Return Metrics

## Document Control

- **Spec ID**: 14
- **Created**: 2025-10-03
- **Status**: Draft
- **Priority**: Medium

## Overview

This specification addresses the need to remove annualized return metrics from the UI display while consolidating performance metrics to focus on the three most important metrics for comparing configurations: Total Return ($), Total Return (%), and Average Capital Deployed.

## Problem Statement

The current UI displays annualized return metrics across multiple sections (Strategy Performance Analysis, batch result tables, single backtest summary), which:

1. Adds cognitive load when comparing configurations
2. Can be misleading for shorter time periods
3. Is not the primary metric users need for performance evaluation
4. Duplicates information across different sections

Users need a cleaner, more focused view that highlights the three key metrics that matter most for configuration comparison.

## Goals

1. Remove annualized return metrics from UI display
2. Consolidate performance display to focus on three key metrics
3. Keep annualized return calculations in the backend for potential future use
4. Simplify the comparison of different configurations
5. Improve UI clarity by consolidating duplicate information

## Non-Goals

- Removing annualized return calculations from backend
- Changing how performance is calculated
- Modifying batch backtest logic
- Changing API response structure
- Removing any other metrics beyond annualized returns

## Functional Requirements

### FR1: Remove Annualized Return from Single Backtest Summary

- **Priority**: High
- **Description**: Remove all annualized return metrics from single backtest result display
- **Acceptance Criteria**:
  - No "Annualized Return" or "Annualized Return %" displayed in BacktestResults component
  - No "Average Annualized Return" displayed
  - Backend calculations remain unchanged

### FR2: Remove Annualized Return from Batch Results Table

- **Priority**: High
- **Description**: Remove annualized return columns from batch optimization results table
- **Acceptance Criteria**:
  - No "Annualized Return" column in BatchResults table
  - No "Average Annualized Return" row in summary section
  - Backend calculations remain unchanged

### FR3: Remove Annualized Return from Strategy Performance Analysis

- **Priority**: High
- **Description**: Remove annualized return metrics from the "Strategy Performance Analysis" section
- **Acceptance Criteria**:
  - No annualized return metrics in comparison with Buy & Hold strategy
  - Buy & Hold comparison uses Total Return instead
  - Strategy Performance Analysis section removed or consolidated with main metrics

### FR4: Consolidate Performance Metrics Display

- **Priority**: High
- **Description**: Consolidate duplicate performance information into a single, focused section
- **Acceptance Criteria**:
  - Single consolidated section showing:
    - Total Return: $-81,107.24 (example)
    - Total Return %: -173.80%
    - Average Capital Deployed: $46,666.67
  - These three metrics prominently displayed
  - Buy & Hold comparison uses Total Return for comparison
  - Remove duplicate display of same information

### FR5: Update Buy & Hold Comparison

- **Priority**: High
- **Description**: Update Buy & Hold strategy comparison to use Total Return instead of Annualized Return
- **Acceptance Criteria**:
  - Buy & Hold comparison shows Total Return ($)
  - Buy & Hold comparison shows Total Return (%)
  - Comparison is clear and easy to understand
  - No annualized return metrics used

## Non-Functional Requirements

### NFR1: UI Clarity

- Consolidated metrics should be visually clear and easy to read
- No confusion about which metrics are being compared
- Improved visual hierarchy

### NFR2: Backward Compatibility

- Backend API response structure unchanged
- Calculations remain in backend for potential future use
- No breaking changes to API

### NFR3: Performance

- No performance degradation
- Existing calculations remain available

## UI/UX Requirements

### Single Backtest Results

**Current State**:

```
Total Return
-$81,107.24
-173.80% | Avg Capital: $46,666.67

Final Portfolio Value
$18,892.76

Max Capital Deployed
$100,000.00

Lots Held
10

Total Trades
1

Win Rate
+100.00%

[Strategy Performance Analysis section with duplicate info and annualized returns]
```

**Desired State**:

```
Performance Summary
Total Return: -$81,107.24 (-173.80%)
Average Capital Deployed: $46,666.67

vs Buy & Hold Strategy
DCA Strategy: -$81,107.24 (-173.80%)
Buy & Hold: $XX,XXX.XX (XX.XX%)

Portfolio Details
Final Portfolio Value: $18,892.76
Max Capital Deployed: $100,000.00
Lots Held: 10

Trading Statistics
Total Trades: 1
Win Rate: +100.00%
```

### Batch Results Table

**Remove Columns**:

- "Annualized Return"
- "Average Annualized Return"

**Keep Columns**:

- Total Return ($)
- Total Return (%)
- Average Capital Deployed
- All other existing columns

## Affected Components

### Frontend Files

1. **`frontend/src/components/BacktestResults.js`**
   - Remove annualized return display
   - Consolidate duplicate performance sections
   - Update Buy & Hold comparison

2. **`frontend/src/components/BatchResults.js`**
   - Remove annualized return columns from table
   - Remove annualized return from summary rows

3. **`frontend/src/App.css`**
   - Update styles for consolidated performance section
   - May need to adjust layout for cleaner display

### Backend Files (No Changes Required)

- Keep all calculations in:
  - `backend/services/dcaBacktestService.js`
  - `backend/services/shortDCABacktestService.js`
  - `backend/services/batchBacktestService.js`
  - `backend/services/performanceCalculatorService.js`

## Success Criteria

1. No annualized return metrics visible in any UI component
2. Three key metrics (Total Return $, Total Return %, Avg Capital) prominently displayed
3. Buy & Hold comparison uses Total Return
4. Duplicate information consolidated
5. Backend calculations unchanged
6. No errors in console
7. All existing functionality works as before

## Out of Scope

- Removing annualized return calculations from backend
- Adding new performance metrics
- Changing calculation methodology
- Modifying API response structure
- Creating new comparison features
- Changing batch backtest logic

## Dependencies

- None (UI-only changes)

## Risks and Mitigations

| Risk                              | Impact | Mitigation                                              |
| --------------------------------- | ------ | ------------------------------------------------------- |
| Users may want annualized returns | Medium | Keep calculations in backend; easy to restore if needed |
| Breaking existing code            | Low    | Only removing display; no logic changes                 |
| Confusion during transition       | Low    | Clear, consolidated display will be self-explanatory    |

## Timeline Estimate

- Requirements Review: 0.5 hours
- Design: 0.5 hours
- Implementation: 2 hours
- Testing: 1 hour
- **Total**: 4 hours

## Future Enhancements

1. Add user preference to toggle annualized return display
2. Add more advanced performance metrics (Sharpe ratio, etc.)
3. Create configurable dashboard with metric selection
4. Add metric tooltips explaining calculations
