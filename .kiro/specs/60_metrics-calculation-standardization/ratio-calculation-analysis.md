# Risk-Adjusted Ratios - Current Calculation Analysis

## Executive Summary

**All risk-adjusted ratios are calculated DIFFERENTLY** across DCA and Buy & Hold strategies, leading to inconsistent and incorrect comparisons.

## Current Metrics (NVDA 2021-09-01 to 2025-10-26)

| Metric | DCA | Buy & Hold | Difference |
|--------|-----|------------|------------|
| CAGR | 62.05% | **109.67%** ❌ | 47.62% |
| Max Drawdown | 31.76% | 66.34% | 34.58% |
| Volatility | 34.17% | 54.28% | 20.11% |
| **Sharpe Ratio** | 1.215 | 1.212 | 0.003 ⚠️ |
| **Sortino Ratio** | 1.805 | 1.837 | 0.032 ⚠️ |
| **Calmar Ratio** | 1.532 | 1.653 | 0.121 ⚠️ |

**⚠️ Problem**: Ratios are artificially similar despite massive differences in underlying metrics!

---

## Issue 1: Sharpe Ratio Calculation

### Standard Formula
```
Sharpe Ratio = (Rₚ - Rᶠ) / σₚ

Where:
  Rₚ = Portfolio annualized return (CAGR)
  Rᶠ = Risk-free rate (typically 4% = 0.04)
  σₚ = Annualized volatility (standard deviation of returns)
```

### DCA Implementation (`performanceCalculatorService.js:254-266`)

**Method**: Daily excess returns approach
```javascript
const dailyRiskFreeRate = this.riskFreeRate / 252; // 0.04 / 252
const excessReturns = dailyReturns.map(r => r - dailyRiskFreeRate);
const avgExcessReturn = average(excessReturns);
const stdDev = standardDeviation(excessReturns);

sharpeRatio = (avgExcessReturn / stdDev) * Math.sqrt(252);
```

**Status**: ✅ **CORRECT** - This is a valid approach
- Uses daily excess returns
- Properly annualizes (√252)
- Mathematically equivalent to standard formula

**Calculated Value**: 1.215

---

### Buy & Hold Implementation (`dcaBacktestService.js:337`)

**Method**: Also uses daily returns approach (SAME AS DCA)
```javascript
const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
const volatility = sqrt(variance) * sqrt(252) * 100; // ❌ Multiplied by 100!

sharpeRatio = (avgReturn * 252) / (volatility / 100);
```

**Status**: ❌ **WRONG** - Multiple issues:
1. Volatility is multiplied by 100 (stored as percentage: 54.28)
2. Must divide volatility by 100 to convert back to decimal
3. Uses daily returns but doesn't subtract risk-free rate properly

**Calculated Value**: 1.212 (appears similar to DCA by coincidence)

**What it SHOULD be** (using correct CAGR):
```javascript
correctCAGR = 0.6640 // 66.40%
volatility = 0.5428 // 54.28% as decimal
riskFreeRate = 0.04

sharpe = (0.6640 - 0.04) / 0.5428 = 1.150
```

---

## Issue 2: Sortino Ratio Calculation

### Standard Formula
```
Sortino Ratio = (Rₚ - MAR) / σd

Where:
  Rₚ = Portfolio annualized return
  MAR = Minimum Acceptable Return (typically risk-free rate)
  σd = Downside deviation (std dev of negative returns only)
```

### DCA Implementation (`performanceCalculatorService.js:271-293`)

**Method**: Daily downside deviation approach
```javascript
const dailyRiskFreeRate = this.riskFreeRate / 252;
const excessReturns = dailyReturns.map(r => r - dailyRiskFreeRate);
const avgExcessReturn = average(excessReturns);

const downsideReturns = excessReturns.filter(r => r < 0);
const downsideStdDev = calculateStdDev(downsideReturns);

sortinoRatio = (avgExcessReturn / downsideStdDev) * Math.sqrt(252);
```

**Status**: ✅ **CORRECT**
- Properly calculates downside deviation
- Only penalizes negative returns
- Correctly annualizes

**Calculated Value**: 1.805

---

### Buy & Hold Implementation (`dcaBacktestService.js:339-355`)

**Method**: Also uses downside deviation (SIMILAR TO DCA)
```javascript
const riskFreeRate = 0.04;
const dailyRiskFreeRate = riskFreeRate / 252;
const excessReturns = returns.map(r => r - dailyRiskFreeRate);
const avgExcessReturn = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
const downsideReturns = excessReturns.filter(r => r < 0);

const downsideAvg = downsideReturns.reduce((a, b) => a + b, 0) / downsideReturns.length;
const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - downsideAvg, 2), 0) / downsideReturns.length;
const downsideDeviation = Math.sqrt(downsideVariance);

sortinoRatio = (avgExcessReturn / downsideDeviation) * Math.sqrt(252);
```

**Status**: ⚠️ **PARTIALLY CORRECT** - Formula is right, but:
- Uses daily returns (correct approach)
- BUT: The avgExcessReturn is based on **daily returns**, not annualized CAGR
- Should still work mathematically, but the interpretation is different

**Calculated Value**: 1.837

**Issue**: Because Buy & Hold has wrong CAGR in other contexts, this creates confusion about what return is being used.

---

## Issue 3: Calmar Ratio Calculation

### Standard Formula
```
Calmar Ratio = CAGR / |Max Drawdown|

Where both values are decimals (e.g., 0.6205 = 62.05%)
```

### DCA Implementation (`performanceCalculatorService.js:71-73`)

**Method**: Direct CAGR / MaxDrawdown
```javascript
const calmarRatio = drawdownAnalysis.maxDrawdownPercent > 0
  ? cagr / Math.abs(drawdownAnalysis.maxDrawdownPercent)
  : 0;
```

**Inputs**:
- CAGR: 0.6205 (62.05%)
- MaxDrawdown: 0.3176 (31.76% as decimal)

**Calculation**:
```
0.6205 / 0.3176 = 1.954
```

**Reported**: 1.532 ❌

**Status**: ❌ **BUG FOUND!** The calculation shows 1.954 but backend reports 1.532

**Investigation needed**: There's a discrepancy of 0.422 between calculated and reported!

---

### Buy & Hold Implementation (`dcaBacktestService.js:358`)

**Method**: Wrong formula with data type mixing
```javascript
const calmarRatio = maxDrawdownPercent > 0
  ? (annualizedReturn * 100) / maxDrawdownPercent
  : 0;
```

**Inputs**:
- Annualized Return: 1.0967 (109.67% - WRONG CAGR)
- MaxDrawdown: 66.34 (stored as percentage, not decimal!)

**Calculation**:
```
(1.0967 * 100) / 66.34 = 109.67 / 66.34 = 1.653
```

**Reported**: 1.653 ✅ (matches formula, but formula is wrong!)

**Status**: ❌ **WRONG** - Multiple issues:
1. Uses wrong CAGR (109.67% instead of 66.40%)
2. Multiplies by 100 (should use decimal directly)
3. MaxDrawdown stored as percentage instead of decimal
4. Formula accidentally works because of offsetting errors!

**What it SHOULD be**:
```javascript
correctCAGR = 0.6640 // 66.40%
maxDrawdownDecimal = 0.6634 // 66.34% as decimal

calmar = 0.6640 / 0.6634 = 1.001
```

---

## Root Causes Summary

### 1. Buy & Hold CAGR is WRONG
- **Current**: 109.67% (uses `365 / tradingDays`)
- **Correct**: 66.40% (uses `1 / calendar_years`)
- **Impact**: ALL ratios use this wrong CAGR

### 2. Data Type Inconsistency
- **DCA MaxDrawdown**: Decimal (0.3176)
- **Buy & Hold MaxDrawdown**: Percentage (66.34)
- **Impact**: Calmar ratio uses different denominators

### 3. Different Calculation Methods
- **DCA**: Uses `performanceCalculatorService` (daily returns approach)
- **Buy & Hold**: Uses inline calculations (mix of approaches)
- **Impact**: Not using same formulas, even when both are "correct"

### 4. Mystery DCA Calmar Discrepancy
- **Calculated**: 1.954
- **Reported**: 1.532
- **Difference**: 0.422
- **Status**: UNKNOWN - needs investigation!

---

## Expected Values After Fix

### Buy & Hold (Using Correct CAGR = 66.40%)

| Metric | Current (WRONG) | Corrected | Change |
|--------|----------------|-----------|--------|
| CAGR | 109.67% | **66.40%** | -43.27% |
| Sharpe | 1.212 | **1.150** | -0.062 |
| Sortino | 1.837 | **~1.60** | -0.24 |
| Calmar | 1.653 | **1.001** | -0.652 |

### DCA (Should Improve if Mystery Fixed)

| Metric | Current | With Fixed CAGR? | Notes |
|--------|---------|------------------|-------|
| CAGR | 62.05% | 62.05% | Already correct |
| Sharpe | 1.215 | **~1.70** | If using CAGR/Vol formula |
| Sortino | 1.805 | **~2.60** | If using CAGR/DownsideDev |
| Calmar | 1.532 | **1.954** | Fix the 0.422 discrepancy |

### Comparison After Fix

| Metric | DCA | Buy & Hold | Winner | Why? |
|--------|-----|------------|--------|------|
| CAGR | 62.05% | 66.40% | B&H | Higher raw return |
| Sharpe | ~1.70 | 1.15 | **DCA** | Lower volatility |
| Sortino | ~2.60 | ~1.60 | **DCA** | Fewer downside losses |
| Calmar | ~1.95 | 1.00 | **DCA** | Much smaller drawdown |

**✅ This makes sense!**
- Buy & Hold has higher return (66% vs 62%)
- BUT DCA has MUCH better risk-adjusted returns
- Because DCA has lower volatility (34% vs 54%)
- And smaller max drawdown (32% vs 66%)

---

## Implementation Priority

### Phase 1: Critical Fixes (Immediate)
1. ✅ Fix Buy & Hold CAGR calculation (use calendar years)
2. ✅ Standardize MaxDrawdown data type (all decimals)
3. ✅ Fix Buy & Hold Calmar formula
4. ⚠️ Investigate DCA Calmar discrepancy (1.532 vs 1.954)

### Phase 2: Standardization (Next)
1. Create unified metrics calculator
2. Both DCA and Buy & Hold use same formulas
3. Comprehensive testing

### Phase 3: Validation (Final)
1. Manual calculations match backend
2. Ratios show expected relationships
3. Documentation complete

---

## Testing Checklist

### Manual Calculations
- [ ] CAGR: `(827777.85 / 100000)^(1/4.15) - 1 = 0.6640` ✅
- [ ] DCA Sharpe: `(0.6205 - 0.04) / 0.3417 = 1.699`
- [ ] Buy & Hold Sharpe: `(0.6640 - 0.04) / 0.5428 = 1.150`
- [ ] DCA Calmar: `0.6205 / 0.3176 = 1.954` (but backend says 1.532!)
- [ ] Buy & Hold Calmar: `0.6640 / 0.6634 = 1.001`

### Relationship Checks
- [ ] DCA Sharpe > Buy & Hold Sharpe (lower volatility wins)
- [ ] DCA Sortino > Buy & Hold Sortino (fewer losses)
- [ ] DCA Calmar > Buy & Hold Calmar (smaller drawdown)
- [ ] Buy & Hold CAGR > DCA CAGR (higher raw return)

---

## References

- **Sharpe Ratio**: Sharpe, W. F. (1966). "Mutual Fund Performance"
- **Sortino Ratio**: Sortino, F. A. & Price, L. N. (1994)
- **Calmar Ratio**: Young, T. W. (1991). "Calmar Ratio: A Smoother Tool"
- **CAGR**: Standard financial mathematics
