# Spec 67: ETF Benchmark Comparison

## Problem Statement

Portfolio backtests currently compare the active DCA strategy against a passive Buy & Hold approach using equal capital allocation across the same stocks. However, investors also want to see how the portfolio performs against the underlying index ETF (e.g., QQQ for NASDAQ-100, SPY for S&P 500).

Without this comparison, users cannot easily assess whether their active portfolio strategy is outperforming or underperforming the simple strategy of buying and holding the index ETF.

## Current Limitations

1. **No index ETF comparison**: Results only show DCA vs Buy & Hold of the same stocks
2. **Missing market context**: Users don't know if the portfolio beat the broader market index
3. **Incomplete benchmarking**: Professional investors expect to see index comparison as standard practice
4. **Chart visualization**: The "Portfolio Value: DCA vs Buy & Hold" chart only shows two lines

## Proposed Solution

Add ETF benchmark comparison to portfolio backtest results:

1. **Add `benchmarkSymbol` parameter** to portfolio configs (e.g., `"benchmarkSymbol": "QQQ"`)
2. **Calculate ETF Buy & Hold performance** using the same total capital and date range
3. **Display ETF benchmark as third line** in the comparison chart
4. **Show ETF comparison metrics** in the results summary
5. **Auto-select benchmark** based on portfolio type:
   - NASDAQ-100 portfolios → QQQ
   - S&P 500 portfolios → SPY
   - Custom portfolios → User-specified or none

## Functional Requirements

### FR-1: Backend ETF Benchmark Calculation

- [ ] Accept optional `benchmarkSymbol` parameter in portfolio backtest config
- [ ] Fetch historical price data for benchmark ETF (using existing price data service)
- [ ] Calculate buy & hold performance for the ETF:
  - Start with total capital at start date
  - Calculate shares purchased at start (capital / start price)
  - Calculate final value (shares × end price)
  - Calculate return percentage
  - Track daily portfolio value for chart
- [ ] Return ETF benchmark data in results:
  ```javascript
  {
    etfBenchmark: {
      symbol: "QQQ",
      startDate: "2021-09-02",
      endDate: "2025-10-22",
      startPrice: 150.25,
      endPrice: 450.75,
      sharesPurchased: 19980.02,
      initialInvestment: 3000000,
      finalValue: 9002345.67,
      totalReturn: 200.08,
      cagr: 35.5,
      maxDrawdown: -35.2,
      dailyValues: [...] // For chart
    }
  }
  ```

### FR-2: Frontend Chart Visualization

- [ ] Add third line to "Portfolio Value: DCA vs Buy & Hold" chart for ETF benchmark
- [ ] Use distinct color and line style (e.g., orange dashed line)
- [ ] Add toggle checkbox to show/hide ETF benchmark line
- [ ] Update legend to include "ETF Benchmark (QQQ)" or similar
- [ ] Ensure all three lines are aligned on the same time axis

### FR-3: Frontend Comparison Display

- [ ] Add ETF benchmark column to comparison table
- [ ] Show ETF benchmark metrics:
  - Final value
  - Total return %
  - CAGR
  - Max drawdown
  - Sharpe ratio (if applicable)
- [ ] Highlight if DCA strategy outperformed or underperformed ETF

### FR-4: Portfolio Config Updates

- [ ] Add `benchmarkSymbol` field to all NASDAQ-100 configs with value `"QQQ"`
- [ ] Add `benchmarkSymbol` field to all S&P 500 configs with value `"SPY"`
- [ ] Make `benchmarkSymbol` optional (backward compatible)
- [ ] Document in config schema

### FR-5: Multi-Scenario Support

- [ ] Support ETF benchmark in optimized capital mode (Spec 61)
- [ ] Calculate ETF benchmark for each scenario (discovery, optimal, constrained)
- [ ] Use the same total capital for each scenario's ETF calculation
- [ ] Display ETF benchmark in all scenario tabs

## Non-Functional Requirements

### NFR-1: Performance

- ETF price data fetch should not significantly slow down backtest execution
- Reuse existing price data fetching infrastructure
- Cache ETF price data to avoid redundant API calls

### NFR-2: Backward Compatibility

- Existing portfolio configs without `benchmarkSymbol` should continue to work
- Frontend should gracefully handle results without ETF benchmark data
- Chart should display correctly with or without ETF benchmark line

### NFR-3: Data Quality

- Handle missing ETF price data gracefully (show warning, don't fail)
- Validate that ETF symbol exists before running backtest
- Use same price adjustment logic as stock data (adjusted close prices)

## Success Criteria

1. ✅ NASDAQ-100 portfolio backtests show QQQ performance as third line in chart
2. ✅ S&P 500 portfolio backtests show SPY performance as third line in chart
3. ✅ ETF benchmark metrics displayed alongside DCA and Buy & Hold metrics
4. ✅ Users can toggle ETF benchmark line on/off in chart
5. ✅ All existing backtests continue to work without benchmark
6. ✅ ETF benchmark works correctly in optimized capital mode (all three scenarios)

## Out of Scope

- Multiple benchmarks (e.g., showing both QQQ and SPY)
- Custom benchmark portfolios (only support single ETF symbols)
- Benchmark comparison for single stock backtests (portfolio only)
- Historical benchmark changes (e.g., QQQ composition changes over time)
- Risk-adjusted metrics beyond basic CAGR and drawdown

## User Impact

**Positive**:
- Clear visibility into whether portfolio beats the market index
- Professional-grade benchmarking standard in results
- Easy comparison across different portfolio strategies
- Better decision-making for capital allocation

**Negative**:
- Slightly longer backtest execution time (minimal, <1 second per ETF)
- More data on screen (mitigated by toggle option)

## Related Specs

- Spec 61: Optimized Total Capital Discovery (multi-scenario support required)
- Spec 66: Beta Range Filtering (beta-filtered portfolios also need ETF comparison)

## Example Use Cases

### Use Case 1: NASDAQ-100 High Beta Portfolio

```json
{
  "name": "NASDAQ-100 High Beta",
  "benchmarkSymbol": "QQQ",
  "minBeta": 1.5,
  "totalCapitalUsd": 3000000,
  ...
}
```

**Expected Result**: Chart shows three lines:
1. DCA Strategy (blue solid) - Active trading with 20 high-beta stocks
2. Buy & Hold (green dashed) - Passive holding of same 20 stocks
3. QQQ Benchmark (orange dashed) - NASDAQ-100 ETF performance

### Use Case 2: S&P 500 Portfolio

```json
{
  "name": "S&P 500 Full Index",
  "benchmarkSymbol": "SPY",
  "totalCapitalUsd": 5000000,
  ...
}
```

**Expected Result**: Chart shows SPY as benchmark for S&P 500 portfolio performance.
