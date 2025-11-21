# Metrics Calculation Standardization - Implementation Tasks

## Phase 1: Foundation (High Priority)

### Task 1.1: Create Unified Metrics Calculator
**File**: `backend/services/shared/metricsCalculator.js`

- [ ] Create base module structure
- [ ] Add comprehensive JSDoc documentation
- [ ] Implement data type conversion utilities
  - [ ] `toDecimal(value)` - Convert percentage to decimal
  - [ ] `toPercentage(decimal)` - Convert decimal to percentage
  - [ ] `validateNumber(value)` - Input validation
- [ ] Set up unit test framework
- [ ] Add test fixtures with known values

**Acceptance Criteria**:
- Module exports all metric calculation functions
- All functions have JSDoc with formulas and examples
- 100% unit test coverage
- Type validation on all inputs

---

### Task 1.2: Implement Return Metrics
**Dependencies**: Task 1.1

- [ ] `calculateTotalReturn(finalValue, initialValue)`
- [ ] `calculateTotalReturnPercent(totalReturn, capitalBase)`
- [ ] `calculateCAGR(finalValue, initialValue, startDate, endDate)`
  - [ ] Use calendar years (365.25 days)
  - [ ] Handle edge cases (zero, negative)
  - [ ] Unit tests with known values
- [ ] `calculateTimeWeightedReturn(periodReturns)`

**Test Cases**:
```javascript
// Example test
const result = calculateCAGR(827777.85, 100000, '2021-09-01', '2025-10-26');
expect(result).toBeCloseTo(0.6640, 4); // 66.40%
```

**Acceptance Criteria**:
- All return metrics tested against manual calculations
- CAGR uses calendar years, not trading days
- All return to decimals, not percentages

---

### Task 1.3: Implement Risk Metrics
**Dependencies**: Task 1.1

- [ ] `calculateMaxDrawdown(dailyValues)`
  - [ ] Return negative decimal (-0.3176)
  - [ ] Track peak value
  - [ ] Handle empty/invalid arrays
- [ ] `calculateAverageDrawdown(dailyValues)`
- [ ] `calculateVolatility(dailyReturns, annualize=true)`
  - [ ] Use 252 trading days for annualization
  - [ ] Standard deviation calculation
- [ ] `calculateDownsideDeviation(dailyReturns, mar)`

**Test Cases**:
```javascript
const dailyValues = [100000, 110000, 105000, 95000, 120000];
const maxDD = calculateMaxDrawdown(dailyValues);
expect(maxDD).toBeLessThan(0); // Always negative
expect(maxDD).toBeCloseTo(-0.1364, 4); // -13.64%
```

**Acceptance Criteria**:
- MaxDrawdown always negative or zero
- Volatility annualized correctly
- Edge cases handled (flat returns, all losses)

---

### Task 1.4: Implement Risk-Adjusted Metrics
**Dependencies**: Task 1.2, Task 1.3

- [ ] `calculateSharpeRatio(cagr, volatility, riskFreeRate=0.04)`
- [ ] `calculateSortinoRatio(cagr, downsideDeviation, mar=0.04)`
- [ ] `calculateCalmarRatio(cagr, maxDrawdownPercent)`
  - [ ] Use absolute value of drawdown
  - [ ] Both inputs as decimals
  - [ ] Handle zero drawdown

**Test Cases**:
```javascript
// DCA example
const sharpe = calculateSharpeRatio(0.5943, 0.3417, 0.04);
expect(sharpe).toBeCloseTo(1.62, 2);

// Buy & Hold example
const calmar = calculateCalmarRatio(0.6640, 0.6634);
expect(calmar).toBeCloseTo(1.00, 2);
```

**Acceptance Criteria**:
- All ratios use decimal inputs
- Zero division handled gracefully
- Formulas match industry standards

---

## Phase 2: Critical Fixes (High Priority)

### Task 2.1: Fix Buy & Hold CAGR Calculation
**File**: `backend/services/dcaBacktestService.js:262-276`

- [ ] Read current `calculateBuyAndHold` function
- [ ] Replace CAGR calculation
  ```javascript
  // Replace lines 273-276
  // OLD: const annualizedReturn = Math.pow(1 + (totalReturnPercent / 100), 365 / totalDays) - 1;

  // NEW: Import from metricsCalculator
  const { calculateCAGR } = require('./shared/metricsCalculator');
  const annualizedReturn = calculateCAGR(finalValue, initialCapital, startDate, endDate);
  ```
- [ ] Add startDate/endDate parameters to function
- [ ] Update all callers to pass dates
- [ ] Add unit tests

**Expected Change**:
- Buy & Hold CAGR: 109.67% → 66.40%
- Buy & Hold Calmar: 1.653 → 1.00

**Testing**:
```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{"symbol": "NVDA", "startDate": "2021-09-01", "endDate": "2025-10-26", ...}' \
  | jq '.data.buyAndHoldMetrics.annualizedReturn'
# Should return ~0.6640 (66.40%)
```

---

### Task 2.2: Standardize MaxDrawdown Data Type
**Files**: All services calculating drawdown

- [ ] Audit all maxDrawdown calculations
  - [ ] `dcaBacktestService.js`
  - [ ] `shortDCABacktestService.js`
  - [ ] `portfolioMetricsService.js`
  - [ ] `performanceCalculatorService.js`
- [ ] Ensure all return negative decimal
- [ ] Update comparison logic (use Math.abs() when needed)
- [ ] Fix Calmar ratio calculations

**Changes**:
```javascript
// Ensure drawdown is stored as negative decimal
const maxDrawdownPercent = (maxDrawdown / peakValue) * -1; // Multiply by -1

// In Calmar calculation
const calmar = cagr / Math.abs(maxDrawdownPercent); // Use absolute value
```

---

### Task 2.3: Update All Risk-Adjusted Ratio Calculations
**Files**: All services calculating ratios

- [ ] Replace inline calculations with metricsCalculator calls
- [ ] Ensure all use correct CAGR (not wrong annualizedReturn)
- [ ] Pass decimals, not percentages
- [ ] Add validation tests

**Files to Update**:
- `dcaBacktestService.js` (lines 337-371)
- `performanceCalculatorService.js` (lines 68-75)
- Any portfolio services

---

## Phase 3: Strategy Migration (Medium Priority)

### Task 3.1: Update DCA Strategy
**File**: `backend/services/dcaBacktestService.js`

- [ ] Replace metric calculations with metricsCalculator
- [ ] Remove duplicate code
- [ ] Ensure data types consistent
- [ ] Update tests
- [ ] Regression test old vs new values

---

### Task 3.2: Update Buy & Hold Strategy
**File**: `backend/services/dcaBacktestService.js:calculateBuyAndHold`

- [ ] Refactor to use metricsCalculator
- [ ] Fix CAGR calculation (already done in Task 2.1)
- [ ] Update volatility calculation
- [ ] Update all ratio calculations
- [ ] Add comprehensive tests

---

### Task 3.3: Update Short & Hold Strategy
**File**: `backend/services/shortDCABacktestService.js`

- [ ] Audit metric calculations
- [ ] Apply same fixes as Buy & Hold
- [ ] Ensure consistency with DCA
- [ ] Update tests

---

## Phase 4: Frontend Alignment (Medium Priority)

### Task 4.1: Remove Frontend CAGR Recalculation
**Files**: `frontend/src/components/BacktestResults.js`, `ComparisonMetricsTable.js`

- [ ] Remove frontend CAGR calculation (lines 1173-1184, 1232-1247)
- [ ] Use backend values directly
- [ ] Keep only display formatting
- [ ] Update tests

**Current Problematic Code**:
```javascript
// Lines 1173-1184 - Remove this calculation
const cagr = Math.pow(finalValue, 1 / years) - 1;

// Replace with:
const cagr = summary.performanceMetrics.cagr; // Use backend value
```

---

### Task 4.2: Update Comparison Table
**File**: `frontend/src/components/ComparisonMetricsTable.js`

- [ ] Remove inline CAGR calculation (lines 5-33)
- [ ] Use backend-calculated values
- [ ] Trust backend for all metrics
- [ ] Simplify component logic

---

## Phase 5: Testing & Validation (High Priority)

### Task 5.1: Unit Tests
**File**: `backend/services/shared/__tests__/metricsCalculator.test.js`

- [ ] Test each metric function
- [ ] Known inputs → expected outputs
- [ ] Edge cases (zero, negative, infinity)
- [ ] Precision validation (±0.01%)
- [ ] Performance benchmarks

**Test Coverage Target**: >95%

---

### Task 5.2: Integration Tests
**File**: `backend/__tests__/integration/metrics.test.js`

- [ ] Full backtest → verify all metrics
- [ ] Cross-strategy consistency
- [ ] DCA vs Buy & Hold comparison
- [ ] Short vs Short & Hold comparison

---

### Task 5.3: Regression Tests
**File**: `backend/__tests__/regression/metrics-migration.test.js`

- [ ] Compare old vs new calculations
- [ ] Document intentional changes
- [ ] Flag unexpected differences
- [ ] Create baseline dataset

**Expected Changes**:
```javascript
const expectedChanges = {
  'buyAndHold.cagr': { old: 1.0967, new: 0.6640, reason: 'Fixed calendar years' },
  'buyAndHold.calmar': { old: 1.653, new: 1.00, reason: 'Fixed CAGR in calculation' },
  // ...
};
```

---

### Task 5.4: Manual Validation
- [ ] Test with NVDA (2021-09-01 to 2025-10-26)
- [ ] Test with different date ranges
- [ ] Test with different symbols
- [ ] Verify against external calculators
- [ ] Document discrepancies

---

## Phase 6: Documentation (Medium Priority)

### Task 6.1: Update API Documentation
- [ ] Document all metric fields in API response
- [ ] Specify data types (decimal vs percentage)
- [ ] Add examples
- [ ] Document breaking changes

---

### Task 6.2: Create Metrics Reference Guide
**File**: `docs/metrics-reference.md`

- [ ] List all metrics with formulas
- [ ] Provide calculation examples
- [ ] Explain interpretation
- [ ] Link to academic references

---

### Task 6.3: Migration Guide
**File**: `docs/metrics-migration-guide.md`

- [ ] Document breaking changes
- [ ] Provide before/after examples
- [ ] Explain why metrics changed
- [ ] FAQ section

---

## Testing Checklist

### Pre-Deployment Tests
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Regression tests documented
- [ ] Manual validation complete
- [ ] Performance benchmarks acceptable

### Post-Deployment Verification
- [ ] Spot check production metrics
- [ ] Monitor for errors
- [ ] Compare with historical data
- [ ] User acceptance testing

---

## Risk Mitigation

### Breaking Changes
- **Risk**: Users expect certain metric values
- **Mitigation**: Clear documentation, migration guide, changelog

### Performance
- **Risk**: More calculations = slower response
- **Mitigation**: Optimize, cache, benchmark

### Data Consistency
- **Risk**: Mixing old and new calculations
- **Mitigation**: Clear versioning, recalculate on-demand

---

## Success Metrics

- [ ] Buy & Hold CAGR matches manual calculation (66.40% ±0.01%)
- [ ] All strategies use same formulas
- [ ] Zero data type mixing errors
- [ ] Risk-adjusted ratios show realistic differences
- [ ] Test coverage >95%
- [ ] No performance regression (response time <10% increase)

---

## Estimated Timeline

- **Phase 1**: 3-4 days (foundation)
- **Phase 2**: 2-3 days (critical fixes)
- **Phase 3**: 2-3 days (strategy migration)
- **Phase 4**: 1-2 days (frontend alignment)
- **Phase 5**: 2-3 days (testing)
- **Phase 6**: 1-2 days (documentation)

**Total**: 11-17 days

---

## Notes

- Prioritize critical fixes (Phase 2) - can deploy incrementally
- Frontend changes (Phase 4) depend on backend being correct
- Comprehensive testing (Phase 5) is non-negotiable
- Document everything for future reference
