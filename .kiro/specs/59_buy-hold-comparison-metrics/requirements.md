# Spec 59: Buy & Hold Comparison Metrics and Layout Redesign

## Overview
Enhance the single DCA backtest results page to provide comprehensive side-by-side comparison between DCA strategy and Buy & Hold strategy, including fixing metric calculation issues and improving space efficiency.

## Current Issues

### 1. Missing Buy & Hold Metrics in Summary Section
Current summary shows:
- DCA Total Return, CAGR, Avg Capital
- Buy & Hold Total Return, CAGR, Capital
- **Missing**: Max Drawdown for both strategies

### 2. No Comparison in Performance Metrics Section
The detailed "Performance Metrics" section currently shows only DCA strategy metrics without Buy & Hold comparison, making it difficult to evaluate relative performance.

### 3. Metric Calculation Issues
Several metrics show suspicious or incorrect values:
- **Calmar Ratio**: Shows 0.000 (should be CAGR / Max Drawdown)
- **Avg Drawdown**: Shows 0.08% (need to verify calculation method)
- **Profit Factor**: Shows 0.00 (should be Gross Profit / Gross Loss)
- **Expectancy**: Shows $8,574.21 (need to clarify definition and calculation)

### 4. Incorrect Trade Count
Example: NVDA backtest shows "Total Trades: 2" but screenshot shows many more transactions
- Bug in trade counting logic
- Need to verify what counts as a "trade"

### 5. Inefficient Space Usage
Current layout doesn't use space efficiently, especially when adding Buy & Hold comparison metrics.

## Requirements

### R1: Summary Section Enhancement
Add Max Drawdown to both DCA and Buy & Hold in the summary comparison:

```
DCA Strategy                    Buy & Hold
─────────────────────────────  ─────────────────────────────
Total Return: $417,632.21      Total Return: $732,822.92
Return %: +596.62%             Return %: +732.82%
Avg Capital: $48,974.36        Capital: $100,000.00
CAGR: 58.47%                   CAGR: 65.32%
Max Drawdown: [ADD]            Max Drawdown: [ADD]
```

### R2: Performance Metrics Side-by-Side Comparison
Redesign Performance Metrics section to show DCA vs Buy & Hold comparison for ALL applicable metrics:

#### Metrics to Compare:
**Returns Category:**
- Total Return (%)
- CAGR
- Return on Max Deployed
- Return on Avg Deployed
- Time-Weighted Return

**Risk-Adjusted Category:**
- Sharpe Ratio
- Sortino Ratio
- Calmar Ratio
- Max Drawdown (%)
- Max Drawdown ($)
- Avg Drawdown (%)
- Volatility (%)

**Trading Efficiency Category (DCA only):**
- Win Rate
- Profit Factor
- Expectancy
- Total Trades
- Winners / Losers

### R3: Buy & Hold Metric Applicability
Determine which metrics apply to Buy & Hold:
- **Applicable**: All return and risk-adjusted metrics
- **Not Applicable**: Trading efficiency metrics (no trades in buy & hold)
- **Display**: Show "N/A" or hide trading efficiency column for Buy & Hold

### R4: Fix Metric Calculations
Review and fix calculations for:

#### Calmar Ratio
- **Formula**: CAGR / |Max Drawdown %|
- **Current**: 0.000 (incorrect)
- **Expected**: Non-zero positive value

#### Avg Drawdown
- **Definition**: Average of all drawdown periods
- **Current**: 0.08% (seems too low)
- **Verify**: Calculation method and data

#### Profit Factor
- **Formula**: Gross Profit / Gross Loss
- **Current**: 0.00 (incorrect)
- **Expected**: Ratio of profitable vs unprofitable trades

#### Expectancy
- **Definition**: Average expected profit per trade
- **Formula**: (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
- **Current**: $8,574.21
- **Verify**: Calculation matches definition

### R5: Fix Trade Count Bug
**Issue**: NVDA backtest shows "Total Trades: 2" when there are clearly more transactions

**Investigation needed**:
- What constitutes a "trade"? (Buy-Sell pair? Single transaction?)
- Review transaction log to count actual trades
- Fix counting logic in backend

**Test URL**:
```
http://localhost:3000/backtest/long/NVDA/results?startDate=2021-09-01&endDate=2025-10-26&lotSizeUsd=10000&maxLots=10&maxLotsToSell=1&gridIntervalPercent=10&profitRequirement=10&trailingBuyActivationPercent=10&trailingBuyReboundPercent=5&trailingSellActivationPercent=20&trailingSellPullbackPercent=10&momentumBasedBuy=false&momentumBasedSell=false&beta=2.123&coefficient=1&enableBetaScaling=true&isManualBetaOverride=false&enableDynamicGrid=false&normalizeToReference=false&enableConsecutiveIncrementalBuyGrid=false&enableConsecutiveIncrementalSellProfit=false&enableScenarioDetection=false&enableAverageBasedGrid=false&enableAverageBasedSell=false&dynamicGridMultiplier=1&gridConsecutiveIncrement=5
```

### R6: Layout Redesign
**Goals**:
1. More efficient use of horizontal space
2. Clear visual separation between DCA and Buy & Hold
3. Easy to scan and compare metrics
4. Responsive design for different screen sizes

**Proposed Layout** (see design.md for details):
- Two-column comparison layout for metrics
- Color coding for better/worse performance
- Collapsible sections for less important metrics
- Highlight key differences

## Success Criteria

1. ✅ Max Drawdown shown for both DCA and Buy & Hold in summary
2. ✅ All applicable metrics shown side-by-side for DCA vs Buy & Hold
3. ✅ Calmar Ratio shows correct non-zero value
4. ✅ Avg Drawdown calculation verified and documented
5. ✅ Profit Factor shows correct ratio
6. ✅ Expectancy definition clarified and calculation verified
7. ✅ Total Trades count matches actual trade count
8. ✅ Layout uses space efficiently
9. ✅ Test URL renders correctly with all fixes

## Out of Scope
- Modifying batch backtest mode (single mode only)
- Changing backend data structures (only calculations)
- Adding new metrics not listed above
- Mobile-specific optimizations (future enhancement)

## Dependencies
- Backend: Fix metric calculations in DCA service
- Frontend: Redesign BacktestResults component
- Data: Ensure Buy & Hold results include all necessary metrics
