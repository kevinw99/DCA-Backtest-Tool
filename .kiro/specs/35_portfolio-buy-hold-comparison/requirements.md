# Spec 35: Portfolio Buy & Hold Comparison

## Problem Statement

Portfolio backtest results currently show DCA strategy performance in isolation, making it difficult to evaluate whether the strategy outperforms a simple passive investment approach. Users need a clear comparison baseline to determine if the active DCA strategy justifies its complexity and trading costs.

## User Story

As a portfolio investor evaluating DCA strategies, I want to see how my DCA portfolio performs against a simple Buy & Hold strategy with the same capital, so I can determine if the active management adds value over passive investing.

## Requirements

### Functional Requirements

#### FR1: Buy & Hold Portfolio Calculation
- Calculate a Buy & Hold strategy using the same total capital as DCA portfolio
- Allocate capital equally across all stocks at the start date
- Buy shares at start date prices and hold until end date
- Sell all positions at end date prices
- Track portfolio value over time for visualization

#### FR2: Comprehensive Comparison Metrics
Compare DCA vs Buy & Hold across multiple dimensions:

**Performance Metrics:**
- Total Return ($ and %)
- Annualized Return (CAGR) ($ and %)
- Final Portfolio Value

**Risk Metrics:**
- Maximum Drawdown ($ and %)
- Volatility (annualized standard deviation)
- Sharpe Ratio
- Sortino Ratio

**Efficiency Metrics:**
- Risk-Adjusted Return (Sharpe comparison)
- Return per unit of risk
- Drawdown recovery time

**Outperformance Metrics:**
- Absolute outperformance ($)
- Relative outperformance (%)
- CAGR difference (percentage points)
- Drawdown advantage (percentage points)
- Sharpe ratio advantage

#### FR3: Per-Stock Buy & Hold Breakdown
For each stock in the portfolio:
- Calculate individual Buy & Hold performance
- Show capital allocation per stock
- Show shares purchased and held
- Compare to DCA performance for that stock
- Show contribution to overall outperformance

#### FR4: Time Series Visualization
- Generate daily portfolio values for both strategies
- Enable side-by-side comparison chart
- Show divergence over time
- Highlight periods of outperformance/underperformance

#### FR5: Frontend Display Components

**Summary Card Enhancement:**
- Add Buy & Hold comparison section
- Display key comparison metrics prominently
- Show outperformance badge/indicator
- Use visual cues (colors, icons) for quick understanding

**Dedicated Comparison Section:**
- Side-by-side metric comparison table
- DCA vs B&H columns
- Difference/advantage column
- Visual indicators for better/worse metrics

**Comparison Chart:**
- Dual-line chart showing both portfolio values over time
- Clearly labeled lines (DCA vs Buy & Hold)
- Show crossover points
- Display final value difference

**Per-Stock Comparison Table:**
- Add B&H columns to stock performance table
- Show individual stock B&H returns
- Highlight which stocks drove outperformance

### Non-Functional Requirements

#### NFR1: Performance
- Buy & Hold calculation should add < 500ms to backtest time
- Reuse existing price data (no additional API calls)
- Efficient time series generation

#### NFR2: Accuracy
- Use same price data as DCA backtest
- Handle edge cases (gaps, missing data, short periods)
- Validate calculations against manual verification

#### NFR3: Maintainability
- Create reusable functions for B&H calculations
- Follow existing patterns in metricsService
- Document calculation methodology

#### NFR4: User Experience
- Clear visual hierarchy for comparison data
- Intuitive interpretation (green = better, red = worse)
- Responsive layout for all screen sizes
- Consistent styling with existing components

## Success Criteria

1. **Calculation Accuracy**: Buy & Hold results match manual calculations within 0.01%
2. **Complete Metrics**: All comparison metrics specified in FR2 are calculated and displayed
3. **Visual Clarity**: Users can determine outperformance at a glance
4. **Performance**: No noticeable delay added to backtest execution
5. **Edge Cases**: Handles stocks with varying start dates and missing data gracefully

## Out of Scope

- Buy & Hold with rebalancing (future enhancement)
- Transaction costs for Buy & Hold (assume zero like DCA)
- Dividend reinvestment (not currently in DCA either)
- Alternative weighting strategies (market cap, equal dollar)
- Single-stock DCA vs Buy & Hold (already exists)

## Assumptions

1. Same total capital available for both strategies
2. Equal capital allocation per stock at start (simple approach)
3. No transaction costs for either strategy
4. All stocks can be purchased at start date (fractional shares allowed)
5. No rebalancing during holding period
6. Same backtest period for both strategies

## Dependencies

- Existing `portfolioBacktestService.js` for DCA results
- Existing `portfolioMetricsService.js` for metric calculations
- Price data already loaded for all stocks
- Frontend charting library (Recharts) already in use

## Testing Requirements

1. **Unit Tests**: Buy & Hold calculation functions
2. **Integration Tests**: Full portfolio backtest with B&H comparison
3. **Edge Case Tests**:
   - Single stock portfolio
   - Two stock portfolio (equal/unequal performance)
   - Stocks with different start dates
   - Very short backtest periods (<1 year)
   - All stocks gain vs all stocks lose
4. **Manual Verification**: Compare results to spreadsheet calculations
5. **Visual Regression**: Ensure UI components render correctly

## Future Enhancements

- Buy & Hold with periodic rebalancing (monthly/quarterly)
- Multiple weighting strategies (market cap, volatility-based)
- Transaction cost comparison
- Tax efficiency comparison (holding period vs frequent trading)
- Risk-parity weighting
- Benchmark comparison (S&P 500, etc.)
