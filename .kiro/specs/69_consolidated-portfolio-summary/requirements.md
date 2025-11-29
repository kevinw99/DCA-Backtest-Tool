# Spec 69: Consolidated Portfolio Summary with Comparison Table

## Problem Statement

The Portfolio Results page currently has two separate sections that display overlapping information:

1. **Portfolio Summary Card** - Grid of metric boxes showing Total Capital, Final Value, CAGR, Sharpe, etc.
2. **Adaptive DCA vs Buy & Hold Comparison** - A separate section with comparison table

This leads to:
- Redundant display of the same metrics (CAGR, Sharpe, etc. appear in both)
- Users need to scroll between sections to compare DCA vs B&H
- Inconsistent styling between the two sections
- No visual indication of which strategy is "winning" each metric

## User Requirements

### REQ-1: Consolidate Into Single Section
- Merge Portfolio Summary Card and DCA vs B&H Comparison into ONE unified section
- Remove the separate "Adaptive DCA vs Buy & Hold Comparison" section
- The new section should be the primary summary at the top of results

### REQ-2: Use Comparison Table Format
- Display metrics in a table with columns: **Metric | DCA | Buy & Hold | Difference | Advantage**
- Group metrics by category (similar to single stock ComparisonMetricsTable):
  - **Returns**: Total Return, CAGR
  - **Risk-Adjusted Returns**: Sharpe Ratio, Sortino Ratio, Calmar Ratio
  - **Risk Metrics**: Max Drawdown, Volatility
- Each row shows the metric for both strategies side-by-side

### REQ-3: Color-Coded Advantage Indicators
- Use background colors to indicate which strategy is winning each metric:
  - **Green background** (`#a7f3d0`) with left border (`#059669`) for the better value
  - **Red background** (`#fee2e2`) with left border (`#ef4444`) for the worse value
  - **Gray background** for N/A or neutral values
- Match the styling from `ComparisonMetricsTable.css`

### REQ-4: Portfolio-Specific Metrics Section
- Add a separate footer section for DCA-only metrics (not applicable to B&H):
  - Number of Stocks Held
  - Total Trades (X buys, Y sells)
  - Win Rate
  - Capital Utilization (Deployed: $X)
  - Rejected Orders count
  - Deferred Sells count
- Style as a compact horizontal row or grid, not a full table

### REQ-5: Header with Key Summary
- Keep a condensed header showing:
  - Total Capital
  - DCA Final Value vs B&H Final Value
  - Outperformance amount and percentage
- Use the existing DCA vs B&H card layout with "vs" divider

## Visual Design

```
+-------------------------------------------------------------------+
| PORTFOLIO PERFORMANCE COMPARISON                                   |
+-------------------------------------------------------------------+
|  DCA Strategy     |  vs  |    Buy & Hold                          |
|  $1,139,315       |      |    $903,068                            |
|                   |      |                                         |
|         DCA Outperformance: +$236,247 (26.16%)                    |
+-------------------------------------------------------------------+
| Metric            | DCA      | Buy & Hold | Difference | Advantage|
+-------------------------------------------------------------------+
| RETURNS           |          |            |            |          |
| Total Return      | $752,315 | $516,068   | +$236,247  | DCA      |
| CAGR              | 29.02%   | 22.13%     | +6.88% pts | DCA      |
+-------------------------------------------------------------------+
| RISK-ADJUSTED     |          |            |            |          |
| Sharpe Ratio      | 1.02     | 0.77       | +0.25      | DCA      |
| Max Drawdown      | 27.40%   | 56.10%     | +28.70%pts | DCA      |
| Volatility        | 29.40%   | 39.50%     | +10.10%pts | DCA      |
+-------------------------------------------------------------------+
| PORTFOLIO ACTIVITY                                                 |
| Stocks: 10 | Trades: 90 (64 buys, 26 sells) | Win Rate: 100%     |
| Capital Utilization: 98.2% | Rejected: 5 | Deferred Sells: 3      |
+-------------------------------------------------------------------+
```

## Technical Requirements

### Component Changes

1. **Create new component**: `PortfolioComparisonSummary.js`
   - Replaces both `PortfolioSummaryCard` and `PortfolioBuyAndHoldComparison`
   - Reuse styling patterns from `ComparisonMetricsTable.css`

2. **Update `PortfolioResults.js`**:
   - Replace `<PortfolioSummaryCard>` and `<PortfolioBuyAndHoldComparison>` with single `<PortfolioComparisonSummary>`
   - Pass all required props: `portfolioSummary`, `comparison`, `buyAndHoldSummary`

3. **Props structure**:
```javascript
<PortfolioComparisonSummary
  portfolioSummary={portfolioSummary}  // DCA metrics
  comparison={comparison}               // Comparison data
  buyAndHoldSummary={buyAndHoldSummary} // B&H metrics
/>
```

### Metrics to Display

**Comparison Table (DCA vs B&H)**:
| Category | Metric | Higher is Better? |
|----------|--------|-------------------|
| Returns | Total Return ($) | Yes |
| Returns | CAGR (%) | Yes |
| Risk-Adjusted | Sharpe Ratio | Yes |
| Risk-Adjusted | Sortino Ratio | Yes (if available) |
| Risk-Adjusted | Calmar Ratio | Yes (if available) |
| Risk | Max Drawdown (%) | No (lower is better) |
| Risk | Volatility (%) | No (lower is better) |

**Portfolio Activity Footer (DCA-only)**:
- Number of Stocks (from stockResults.length)
- Total Trades (totalBuys + totalSells)
- Trade breakdown (X buys, Y sells)
- Win Rate (%)
- Capital Utilization (%)
- Deployed Capital ($)
- Rejected Orders count
- Deferred Sells count

## Success Criteria

1. Single consolidated section replaces two separate sections
2. All metrics displayed in comparison table format with color coding
3. Clear visual indication of which strategy wins each metric
4. Portfolio-specific metrics displayed in compact footer
5. Responsive design works on mobile
6. No loss of information from current implementation

## Files to Modify

- `frontend/src/components/PortfolioResults.js` - Update to use new component
- `frontend/src/components/PortfolioComparisonSummary.js` - NEW component
- `frontend/src/components/PortfolioComparisonSummary.css` - NEW styles

## Files to Keep (deprecated but not deleted yet)
- `frontend/src/components/PortfolioSummaryCard.js` - May be used elsewhere
- `frontend/src/components/PortfolioBuyAndHoldComparison.js` - May be used elsewhere
