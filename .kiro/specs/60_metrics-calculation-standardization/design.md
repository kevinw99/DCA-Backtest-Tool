# Metrics Calculation Standardization - Design Document

## Overview

This document defines the canonical formulas and implementation approach for all performance metrics in the DCA Backtest Tool.

## Architecture

### New Unified Metrics Library

**File**: `backend/services/shared/metricsCalculator.js`

```javascript
/**
 * Unified Metrics Calculator
 * Single source of truth for all performance metric calculations
 *
 * Data Type Convention:
 * - All percentages stored as DECIMALS (0.5943 = 59.43%)
 * - Convert to percentage (*100) only for display
 * - All monetary values in USD
 * - All time periods in calendar days/years (not trading days)
 */
```

### Strategy Adapters

Each strategy (DCA, Buy & Hold, Short & Hold) will have an adapter that:
1. Collects strategy-specific data
2. Converts to standard format
3. Calls unified metrics calculator
4. Returns standardized results

## Canonical Metric Formulas

### 1. Return Metrics

#### 1.1 Total Return (Absolute)
```
Total Return = Final Value - Initial Investment

Where:
  - Final Value: Portfolio value at end (USD)
  - Initial Investment: Total capital deployed (USD)

Data Type: Number (USD)
Example: $415,160.24
```

#### 1.2 Total Return Percentage
```
Total Return % = (Total Return / Capital Base) × 100

Where:
  - Capital Base: Reference capital (initial, max deployed, or avg deployed)
  - Result stored as DECIMAL (5.9309 = 593.09%)

Data Types:
  - Input: USD
  - Output: Decimal (0.5943 = 59.43%)
```

#### 1.3 CAGR (Compound Annual Growth Rate)
```
CAGR = (Final Value / Initial Value)^(1 / Years) - 1

Where:
  - Years = (End Date - Start Date) / 365.25 days
  - Use CALENDAR years, not trading days
  - Result stored as DECIMAL

Formula Breakdown:
  Years = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365.25)
  CAGR = Math.pow(finalValue / initialValue, 1 / years) - 1

Data Types:
  - Input: USD, Date
  - Output: Decimal (0.5943 = 59.43%)

Edge Cases:
  - Years ≤ 0: Return 0
  - Final Value ≤ 0: Return -1 (total loss)
  - Initial Value = 0: Return null (undefined)
```

**CRITICAL FIX**: Buy & Hold was using:
```javascript
// ❌ WRONG (uses trading days)
Math.pow(1 + (totalReturnPercent / 100), 365 / prices.length) - 1

// ✅ CORRECT (uses calendar years)
Math.pow(finalValue / initialValue, 1 / years) - 1
```

#### 1.4 Time-Weighted Return (TWR)
```
TWR = ∏(1 + Rᵢ) - 1

Where:
  - Rᵢ = Return for period i
  - Eliminates impact of cash flows

Data Type: Decimal
```

### 2. Risk Metrics

#### 2.1 Maximum Drawdown
```
Max Drawdown % = (Trough Value - Peak Value) / Peak Value

Where:
  - Peak Value: Highest portfolio value before drawdown
  - Trough Value: Lowest value after peak
  - Result: ALWAYS NEGATIVE or ZERO
  - Stored as DECIMAL (-0.3176 = -31.76%)

Algorithm:
  peak = initial_value
  max_drawdown = 0
  for each daily_value:
    if daily_value > peak:
      peak = daily_value
    drawdown = (daily_value - peak) / peak
    if drawdown < max_drawdown:
      max_drawdown = drawdown
  return max_drawdown

Data Types:
  - Input: Array of daily portfolio values (USD)
  - Output: Decimal (negative, e.g., -0.3176 = -31.76%)
```

**CRITICAL**: All strategies must store drawdown as **negative decimal**:
- ❌ WRONG: `maxDrawdownPercent: 31.76` (positive percentage)
- ❌ WRONG: `maxDrawdownPercent: 0.3176` (positive decimal)
- ✅ CORRECT: `maxDrawdownPercent: -0.3176` (negative decimal)

#### 2.2 Volatility (Annualized Standard Deviation)
```
Volatility = σ_daily × √252

Where:
  - σ_daily = Standard deviation of daily returns
  - 252 = Trading days per year
  - Daily return = (Price_t - Price_t-1) / Price_t-1

Algorithm:
  daily_returns = []
  for i in 1 to n:
    return = (value[i] - value[i-1]) / value[i-1]
    daily_returns.push(return)

  mean = average(daily_returns)
  variance = average((return - mean)² for each return)
  volatility = √variance × √252

Data Type: Decimal (0.3417 = 34.17%)
```

#### 2.3 Downside Deviation
```
Downside Deviation = √(∑(min(Rᵢ - MAR, 0)²) / n) × √252

Where:
  - MAR = Minimum Acceptable Return (typically risk-free rate)
  - Only penalizes returns below MAR
  - Used in Sortino Ratio

Data Type: Decimal
```

### 3. Risk-Adjusted Metrics

#### 3.1 Sharpe Ratio
```
Sharpe Ratio = (Rₚ - Rᶠ) / σₚ

Where:
  - Rₚ = Portfolio annualized return (CAGR)
  - Rᶠ = Risk-free rate (default: 4% = 0.04)
  - σₚ = Portfolio annualized volatility

Algorithm:
  annual_return = CAGR (as decimal)
  risk_free_rate = 0.04 (as decimal)
  annual_volatility = calculateVolatility(daily_values)

  if annual_volatility == 0:
    return 0

  sharpe = (annual_return - risk_free_rate) / annual_volatility

Data Type: Number (dimensionless, typically 0-4)
Interpretation:
  - < 1.0: Sub-optimal
  - 1.0-2.0: Good
  - 2.0-3.0: Very good
  - > 3.0: Excellent
```

#### 3.2 Sortino Ratio
```
Sortino Ratio = (Rₚ - MAR) / σ_downside

Where:
  - Rₚ = Portfolio annualized return
  - MAR = Minimum Acceptable Return (risk-free rate)
  - σ_downside = Downside deviation (only negative returns)

Algorithm:
  annual_return = CAGR (as decimal)
  mar = 0.04 (as decimal)
  downside_dev = calculateDownsideDeviation(daily_returns, mar/252)

  if downside_dev == 0:
    return annual_return > mar ? 999 : 0

  sortino = (annual_return - mar) / downside_dev

Data Type: Number (dimensionless)
```

#### 3.3 Calmar Ratio
```
Calmar Ratio = CAGR / |Max Drawdown %|

Where:
  - CAGR = Compound annual growth rate (as decimal)
  - Max Drawdown = Absolute value of max drawdown (as decimal)

Algorithm:
  cagr = calculateCAGR(...)  // Returns decimal
  max_dd = Math.abs(calculateMaxDrawdown(...))  // Returns positive decimal

  if max_dd == 0:
    return cagr > 0 ? 999 : 0

  calmar = cagr / max_dd

Data Type: Number (dimensionless, typically 0-5)
Interpretation:
  - < 1.0: Poor risk-adjusted return
  - 1.0-3.0: Acceptable
  - > 3.0: Excellent
```

**CRITICAL FIX**: Ensure both numerator and denominator use decimals:
```javascript
// ❌ WRONG (mixing percentage and decimal)
const calmar = (annualizedReturn * 100) / maxDrawdownPercent;

// ✅ CORRECT (both decimals)
const calmar = cagr / Math.abs(maxDrawdownPercent);
```

### 4. Trading Efficiency Metrics

#### 4.1 Win Rate
```
Win Rate = (Winning Trades / Total Trades) × 100

Where:
  - Winning Trade: Profit > 0
  - Stored as DECIMAL (0.65 = 65%)

Data Type: Decimal (0-1)
```

#### 4.2 Profit Factor
```
Profit Factor = Gross Profit / Gross Loss

Where:
  - Gross Profit = Sum of all winning trades
  - Gross Loss = Absolute value of sum of all losing trades
  - Undefined if no losses (return null or "Infinite")

Data Type: Number (typically 1-3) or null
```

#### 4.3 Expectancy
```
Expectancy = (Win Rate × Avg Win) - (Loss Rate × Avg Loss)

Where:
  - All values in USD
  - Represents expected profit per trade

Data Type: Number (USD)
```

## Implementation Strategy

### Phase 1: Create Unified Calculator
1. Create `metricsCalculator.js` with canonical formulas
2. Comprehensive unit tests for each formula
3. Edge case handling
4. Performance optimization

### Phase 2: Fix Critical Issues
1. **Priority 1**: Fix Buy & Hold CAGR calculation
2. **Priority 2**: Standardize maxDrawdown data type
3. **Priority 3**: Fix all risk-adjusted ratios

### Phase 3: Migrate Strategies
1. Update DCA metrics to use unified calculator
2. Update Buy & Hold to use unified calculator
3. Update Short & Hold to use unified calculator

### Phase 4: Frontend Alignment
1. Remove frontend CAGR recalculation
2. Trust backend calculations
3. Ensure display formatting only

### Phase 5: Validation & Testing
1. Compare old vs new values
2. Document expected changes
3. Regression test suite
4. Integration tests

## Data Flow

```
Strategy Execution
       ↓
  Collect Raw Data (daily values, transactions, dates)
       ↓
  Strategy Adapter (normalize to standard format)
       ↓
  Unified Metrics Calculator
       ↓
  Standardized Metrics Object
       ↓
  API Response (all as decimals)
       ↓
  Frontend Display (convert to percentages)
```

## Testing Strategy

### Unit Tests
- Test each formula independently
- Known inputs → expected outputs
- Edge cases (zero, negative, infinity)
- Precision checks (±0.01% tolerance)

### Integration Tests
- Full backtest → expected metrics
- Cross-strategy consistency
- Frontend display validation

### Regression Tests
- Compare old vs new values
- Document intentional changes
- Flag unexpected differences

## Migration Notes

### Breaking Changes
1. Buy & Hold CAGR will change from ~109% to ~66%
2. All ratios will recalculate with correct CAGR
3. MaxDrawdown data type standardized

### Backward Compatibility
- Old API responses still work (cached data)
- New calculations apply to new requests
- Historical data can be recalculated on-demand

## Performance Considerations

- Cache repeated calculations (CAGR used in multiple ratios)
- Optimize daily value iterations (single pass where possible)
- Use typed arrays for large datasets
- Profile and benchmark critical paths

## Documentation

Each metric function will include:
```javascript
/**
 * Calculate Sharpe Ratio
 *
 * Formula: (Rp - Rf) / σp
 *
 * @param {number} cagr - Annualized return as decimal (0.5943 = 59.43%)
 * @param {number} volatility - Annualized volatility as decimal
 * @param {number} [riskFreeRate=0.04] - Risk-free rate as decimal
 * @returns {number} Sharpe ratio (dimensionless)
 *
 * @example
 * calculateSharpeRatio(0.5943, 0.3417, 0.04) // Returns 1.62
 *
 * Reference: Sharpe, W. F. (1966). "Mutual Fund Performance"
 */
```
