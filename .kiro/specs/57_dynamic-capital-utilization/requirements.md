# Spec 57: Dynamic Capital Utilization for Portfolio Backtests

## Problem Statement

When running portfolio backtests with filtered stock subsets (e.g., high-beta stocks from S&P 500), we face a capital utilization problem:

**Current Issue**:
- SP500 high-beta portfolio: 48 stocks selected from 505 stocks
- Total capital configured: $3,000,000
- Result: Large amounts of capital remain unused throughout backtest
- Performance metrics (ROI, returns) are artificially deflated because they're calculated against total capital, not invested capital

**Example**:
```
Total Capital: $3,000,000
Max Capital Used: $800,000 (26.7% utilization)
Reported ROI: 15% (based on $3,000,000)
True ROI: 56.25% (based on $800,000 actually invested)
```

This makes it impossible to accurately compare performance across different portfolios or strategies.

## Business Requirements

### R1: Accurate Performance Metrics
Performance metrics (ROI, returns, Sharpe ratio) must reflect the true performance of the capital **actually deployed**, not unused capital sitting idle.

### R2: Two Operational Modes

#### Mode 1: Full Capital Deployment (Dynamic Reallocation)
- **Behavior**: Continuously reallocate unused capital to existing positions proportionally
- **Goal**: Maintain 100% capital utilization at all times
- **Use Case**: Maximize returns when you want full capital exposure

#### Mode 2: Normalized Capital Base (Retroactive Adjustment)
- **Behavior**: Calculate maximum capital utilization during backtest, use that as the effective total capital
- **Goal**: Report accurate metrics without changing trading behavior
- **Use Case**: Understand true strategy performance with realistic capital deployment

### R3: Impact on Deferred Selling
The deferred selling threshold is based on `availableCapital < totalCapital * deferredSellThreshold`. When we adjust total capital, this must be handled correctly:

- **Mode 1 (Dynamic)**: Deferred selling logic uses original total capital
- **Mode 2 (Normalized)**: Deferred selling logic uses adjusted total capital retroactively

### R4: Configuration Options
Add portfolio config field:
```json
"capitalUtilization": {
  "mode": "dynamic" | "normalized" | "off",
  "enableFullDeployment": true,  // Mode 1: reallocate unused capital
  "normalizeToMaxUsage": false    // Mode 2: adjust capital base
}
```

### R5: Reporting Requirements
The backtest results must clearly show:
- Total capital configured
- Effective capital (if Mode 2)
- Maximum capital utilized
- Average capital utilization %
- ROI based on effective capital
- ROI based on configured capital (for comparison)

## Functional Requirements

### FR1: Capital Utilization Tracking
Track capital usage daily:
- Total capital allocated per stock
- Total unused capital
- Capital utilization percentage
- Peak capital usage

### FR2: Mode 1 - Dynamic Reallocation Algorithm
**Trigger**: After each day's trading, if `unusedCapital > 0`

**Algorithm**:
1. Calculate `unusedCapital = totalCapital - sum(allocatedCapitalPerStock)`
2. For each stock with active positions:
   - Calculate current allocation: `stockValue / totalAllocatedCapital`
   - New capital allocation: `currentAllocation * (totalAllocatedCapital + unusedCapital)`
   - Increase stock's `lotSizeUsd` proportionally
3. Execute additional buys with the reallocated capital
4. Repeat until `unusedCapital < minReallocationThreshold` (e.g., $1000)

**Constraints**:
- Respect `maxLots` per stock
- Don't violate strategy rules (grid intervals, etc.)
- Log all reallocation actions

### FR3: Mode 2 - Normalized Capital Calculation
**Phase 1 - During Backtest**: Track peak capital usage daily

**Phase 2 - Post-Backtest**:
1. Identify `maxCapitalUsed` across entire backtest period
2. Set `effectiveCapital = maxCapitalUsed`
3. Recalculate all percentage-based metrics using `effectiveCapital`
4. Keep deferred selling thresholds based on `effectiveCapital`

### FR4: Performance Metrics Calculation
Calculate both sets of metrics for comparison:

**Configured Capital Metrics**:
- Total ROI = (finalValue - configuredCapital) / configuredCapital
- Annual ROI, Sharpe ratio, max drawdown (all based on configured capital)

**Effective Capital Metrics**:
- Effective ROI = (finalValue - effectiveCapital) / effectiveCapital
- Annual ROI, Sharpe ratio, max drawdown (all based on effective capital)
- Capital efficiency = effectiveCapital / configuredCapital

### FR5: Backward Compatibility
- Mode "off" (default): Behave exactly as current implementation
- Existing portfolios without `capitalUtilization` config default to "off"
- All existing tests continue to pass

## Technical Requirements

### TR1: Service Layer Changes
Modify `portfolioBacktestService.js`:
- Add capital utilization mode handling
- Implement reallocation logic (Mode 1)
- Track peak capital usage (Mode 2)
- Calculate dual metrics

### TR2: API Response Enhancement
Extend portfolio backtest response:
```json
{
  "summary": {
    "totalCapital": 3000000,
    "effectiveCapital": 850000,
    "maxCapitalUtilized": 850000,
    "avgCapitalUtilization": 28.3,
    "capitalEfficiency": 0.283,

    "configuredCapitalMetrics": {
      "totalRoi": 15.2,
      "annualRoi": 3.8,
      "sharpeRatio": 0.65
    },

    "effectiveCapitalMetrics": {
      "totalRoi": 53.7,
      "annualRoi": 13.4,
      "sharpeRatio": 1.15
    }
  }
}
```

### TR3: Frontend Display
Add capital utilization section to portfolio results page:
- Toggle between configured vs effective capital metrics
- Visual indicator showing capital utilization over time
- Comparison table showing both metric sets

### TR4: Config Validation
Validate `capitalUtilization` configuration:
- Mode must be one of: "dynamic", "normalized", "off"
- Can't enable both modes simultaneously
- Warn if Mode 1 is used with very large portfolios (performance concern)

## Edge Cases

### EC1: Zero Capital Utilization
If no stocks meet buy criteria:
- Mode 1: No reallocation (nothing to reallocate to)
- Mode 2: effectiveCapital = 0, ROI = undefined

### EC2: 100% Capital Utilization
If all capital is already deployed:
- Mode 1: No reallocation needed
- Mode 2: effectiveCapital = configuredCapital (no adjustment)

### EC3: Margin Trading
If `marginPercent > 0`:
- Capital utilization can exceed 100%
- Mode 1: Reallocate based on margin-adjusted capital
- Mode 2: Peak usage may exceed configured capital

### EC4: Stock Liquidations
When stocks are removed from index:
- Mode 1: Reallocate freed capital immediately
- Mode 2: Track if liquidation affects peak usage

## Success Criteria

1. ✅ Mode 1 maintains >95% capital utilization throughout backtest
2. ✅ Mode 2 reports accurate effective capital within ±1% of actual peak usage
3. ✅ Performance metrics reflect true strategy returns
4. ✅ Backward compatibility: existing configs produce identical results
5. ✅ Clear documentation showing both configured and effective metrics
6. ✅ No performance degradation (backtest time increase <10%)

## Non-Goals

- Real-time capital reallocation (this is backtest-only feature)
- Fractional shares (maintain lot-based trading)
- Complex optimization algorithms (simple proportional reallocation)
- Cross-portfolio capital sharing

## Dependencies

- Existing portfolio backtest infrastructure
- Capital tracking per stock (already implemented)
- Deferred selling logic (already implemented)

## Testing Strategy

1. **Unit Tests**: Capital utilization calculations, reallocation algorithm
2. **Integration Tests**: Full backtest with both modes
3. **Comparison Tests**: Same portfolio with mode off vs dynamic vs normalized
4. **Edge Case Tests**: Zero utilization, 100% utilization, margin trading
5. **Performance Tests**: Ensure no significant slowdown

## Documentation

- Update portfolio config schema documentation
- Add capital utilization guide with examples
- Document interpretation of dual metrics
- Provide migration guide for existing portfolios
