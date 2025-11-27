# Metrics Calculation Standardization

## Problem Statement

The DCA Backtest Tool currently has **inconsistent and incorrect metric calculations** across different strategies (DCA, Buy & Hold, Short & Hold). This creates:

1. **Incorrect comparisons** - Risk-adjusted ratios appear artificially similar
2. **Data type inconsistencies** - Same metrics stored as decimals vs percentages
3. **Formula inconsistencies** - Different calculations for the same metric
4. **Display inconsistencies** - Frontend recalculates metrics differently than backend

### Specific Issues Discovered

**Issue 1: Buy & Hold CAGR Calculation (CRITICAL)**
- **Location**: `backend/services/dcaBacktestService.js:273-276`
- **Current**: Uses trading days and wrong formula
  ```javascript
  Math.pow(1 + (totalReturnPercent / 100), 365 / prices.length) - 1
  ```
- **Result**: 109.67% (WRONG)
- **Should be**: 66.40% (using actual calendar years)

**Issue 2: Max Drawdown Data Type Inconsistency**
- **DCA**: Stores as decimal (0.3176 = 31.76%)
- **Buy & Hold**: Stores as percentage (66.34%)
- **Impact**: Inconsistent usage in ratio calculations

**Issue 3: Frontend vs Backend CAGR**
- **Frontend**: Calculates from total return % using calendar years ✅
- **Backend**: Uses different formulas for DCA vs Buy & Hold ❌
- **Result**: Three different CAGR values for same data

**Issue 4: Risk-Adjusted Ratios**
- All ratios (Sharpe, Sortino, Calmar) depend on incorrect CAGR
- Buy & Hold ratios artificially similar to DCA (1.21 vs 1.21 Sharpe)
- Should show significant differences

## Requirements

### R1: Unified Metric Calculation Library
Create a single source of truth for ALL metric calculations that:
- Defines canonical formulas for every metric
- Uses consistent data types (decimals for all percentages)
- Applies uniformly to DCA, Buy & Hold, Short & Hold
- Is well-documented with mathematical formulas

### R2: Comprehensive Metric Documentation
Document every metric with:
- **Mathematical formula** (using standard notation)
- **Input parameters** (with data types and units)
- **Output format** (decimal vs percentage, precision)
- **Edge cases** (zero division, negative values)
- **References** (industry standards, academic sources)

### R3: Data Type Standardization
All percentage-based metrics must:
- **Store as decimals** internally (0.5943 = 59.43%)
- **Convert to percentages** only for display
- **Never mix** decimals and percentages in calculations
- **Document conversion points** clearly

### R4: Fix All Incorrect Calculations
Correct the following metrics:
1. Buy & Hold CAGR (use calendar years, not trading days)
2. All annualized return calculations
3. Risk-adjusted ratios (Sharpe, Sortino, Calmar)
4. Volatility calculations
5. Drawdown percentages

### R5: Validation & Testing
- Unit tests for each metric calculation
- Regression tests comparing old vs new values
- Integration tests across all strategies
- Documentation of expected value ranges

## Metrics to Standardize

### Return Metrics
1. **Total Return** (absolute currency)
2. **Total Return %** (percentage gain/loss)
3. **CAGR** (Compound Annual Growth Rate)
4. **Time-Weighted Return**
5. **Return on Max Deployed Capital**
6. **Return on Avg Deployed Capital**

### Risk Metrics
1. **Max Drawdown** (absolute and percentage)
2. **Average Drawdown**
3. **Max Drawdown Duration**
4. **Volatility** (annualized standard deviation)
5. **Downside Deviation**

### Risk-Adjusted Metrics
1. **Sharpe Ratio** (return per unit of total risk)
2. **Sortino Ratio** (return per unit of downside risk)
3. **Calmar Ratio** (CAGR / max drawdown)
4. **Information Ratio**

### Trading Efficiency Metrics
1. **Win Rate**
2. **Profit Factor**
3. **Expectancy**
4. **Average Win / Average Loss**
5. **Average Holding Period**
6. **Profit per Day Held**

### Capital Utilization Metrics
1. **Capital Utilization %**
2. **Average Deployed Capital**
3. **Max Deployed Capital**
4. **Opportunity Cost**
5. **Opportunity Cost Adjusted Return**

## Success Criteria

1. ✅ All metrics calculated using canonical formulas
2. ✅ Same metric produces identical values for DCA/Buy & Hold given same inputs
3. ✅ Frontend and backend use same calculation methods
4. ✅ Risk-adjusted ratios show realistic differences between strategies
5. ✅ All metrics documented with formulas and references
6. ✅ Zero data type mixing (no decimal/percentage confusion)
7. ✅ Comprehensive test coverage (>95% for metric calculations)

## Out of Scope

- Changing the definition of metrics (keep industry standards)
- Adding new metrics (separate spec)
- UI/UX changes (this is backend calculation only)
- Historical data migration (can recalculate on-demand)

## References

- **Sharpe Ratio**: Sharpe, W. F. (1966). Mutual Fund Performance
- **Sortino Ratio**: Sortino, F. A. & Price, L. N. (1994)
- **Calmar Ratio**: Young, T. W. (1991). Calmar Ratio: A Smoother Tool
- **CAGR Formula**: Standard financial mathematics
