# Tasks: Remove Legacy enableConsecutiveIncremental Parameter

## Phase 1: Config File Cleanup

### Task 1.1: Fix backtestDefaults.json Structure

- [ ] Remove flat TSLA structure (lines 217-259)
- [ ] Verify nested TSLA structure remains intact (lines 164-216)
- [ ] Validate JSON syntax after removal

### Task 1.2: Add Missing Parameters to Ticker Configs

**PLTR (lines 94-101):**

- [ ] Add `enableConsecutiveIncrementalBuyGrid: false` to dynamicFeatures
- [ ] Add `gridConsecutiveIncrement: 5` to longStrategy
- [ ] Remove `enableConsecutiveIncremental` from dynamicFeatures

**TSLA (lines 201-208):**

- [ ] Add `enableConsecutiveIncrementalBuyGrid: false` to dynamicFeatures
- [ ] Verify `gridConsecutiveIncrement` exists in longStrategy (should already exist)
- [ ] Remove `enableConsecutiveIncremental` from dynamicFeatures

**SHOP (lines 297-304):**

- [ ] Add `enableConsecutiveIncrementalBuyGrid: false` to dynamicFeatures
- [ ] Add `gridConsecutiveIncrement: 5` to longStrategy
- [ ] Remove `enableConsecutiveIncremental` from dynamicFeatures

**AAPL (lines 147-155):**

- [ ] Remove `enableConsecutiveIncremental` from dynamicFeatures
- [ ] Verify `enableConsecutiveIncrementalBuyGrid` exists (already there)
- [ ] Add `gridConsecutiveIncrement: 5` to longStrategy if missing

**global (lines 40-48):**

- [ ] Remove `enableConsecutiveIncremental` from dynamicFeatures
- [ ] Verify `enableConsecutiveIncrementalBuyGrid` exists (already there)

### Task 1.3: Validate Config File

- [ ] Verify JSON is valid
- [ ] Check all ticker configs have consistent structure
- [ ] Ensure no duplicate keys

## Phase 2: Backend Service Updates

### Task 2.1: Update adaptiveStrategyService.js

**Remove from adjusted parameters (line 297):**

- [ ] Remove `enableConsecutiveIncremental: rules.enableConsecutiveIncremental,`

**Update BULL_TREND scenario (line 357):**

- [ ] Replace `enableConsecutiveIncremental: true` with:
  ```javascript
  enableConsecutiveIncrementalBuyGrid: false,
  enableConsecutiveIncrementalSellProfit: true,
  ```

**Update BEAR_TREND scenario (line 392):**

- [ ] Replace `enableConsecutiveIncremental: false` with:
  ```javascript
  enableConsecutiveIncrementalBuyGrid: false,
  enableConsecutiveIncrementalSellProfit: false,
  ```

**Update RANGE_BOUND scenario (line 428):**

- [ ] Replace `enableConsecutiveIncremental: true` with:
  ```javascript
  enableConsecutiveIncrementalBuyGrid: true,
  enableConsecutiveIncrementalSellProfit: true,
  ```

**Update HIGH_VOLATILITY scenario (line 462):**

- [ ] Replace `enableConsecutiveIncremental: true` with:
  ```javascript
  enableConsecutiveIncrementalBuyGrid: true,
  enableConsecutiveIncrementalSellProfit: true,
  ```

**Remove from compatible parameters (line 502):**

- [ ] Remove `'enableConsecutiveIncremental',` from array

### Task 2.2: Update batchBacktestService.js

**Remove parameter declarations and usages:**

- [ ] Line 51: Remove `enableConsecutiveIncremental = true,` from function parameters
- [ ] Line 128: Remove `enableConsecutiveIncremental,` from parameter object
- [ ] Line 179: Remove `enableConsecutiveIncremental,` from parameter pass-through
- [ ] Line 247: Remove `enableConsecutiveIncremental,` from parameter list
- [ ] Line 262: Remove `enableConsecutiveIncremental: enableConsecutiveIncremental ?? parameterRanges.enableConsecutiveIncremental,`

**Add the two specific flags if not present:**

- [ ] Verify `enableConsecutiveIncrementalBuyGrid` is handled
- [ ] Verify `enableConsecutiveIncrementalSellProfit` is handled

### Task 2.3: Update configService.js

**Remove from parameter category map (line 89):**

- [ ] Remove `enableConsecutiveIncremental: 'dynamicFeatures',` from parameterCategoryMap

**Remove from dynamic features list (line 286):**

- [ ] Remove `'enableConsecutiveIncremental',` from dynamicFeatureParams array

**Verify specific flags are present:**

- [ ] Check `enableConsecutiveIncrementalBuyGrid` is in the map
- [ ] Check `enableConsecutiveIncrementalSellProfit` is in the map

## Phase 3: Frontend Updates

### Task 3.1: Update URLParameterManager.js

**Remove from parameter list (line 689):**

- [ ] Remove `'enableConsecutiveIncremental',` from feature flag array

**Verify specific flags are included:**

- [ ] Check `'enableConsecutiveIncrementalBuyGrid'` is in the array
- [ ] Check `'enableConsecutiveIncrementalSellProfit'` is in the array

## Phase 4: Test File Updates

### Task 4.1: Update aborted-events-test-cases.md

- [ ] Line 108: Remove `enableConsecutiveIncremental=true&` from test URL
- [ ] Line 117: Remove `enableConsecutiveIncremental=true&` from curl command
- [ ] Verify test URLs still work after parameter removal

### Task 4.2: Update testResults.txt (if needed)

- [ ] Search for `enableConsecutiveIncremental` in testResults.txt
- [ ] Remove from any test URLs if present

## Phase 5: Verification & Testing

### Task 5.1: Verify Config Loading

- [ ] Test loading PLTR defaults
- [ ] Test loading TSLA defaults
- [ ] Test loading SHOP defaults
- [ ] Test loading AAPL defaults
- [ ] Test loading global defaults
- [ ] Verify no console errors

### Task 5.2: Test Adaptive Strategy

- [ ] Run backtest with adaptive strategy enabled
- [ ] Verify scenario detection works
- [ ] Verify parameter adjustments use correct flags
- [ ] Check both `enableConsecutiveIncrementalBuyGrid` and `enableConsecutiveIncrementalSellProfit` are set correctly

### Task 5.3: Test Batch Backtests

- [ ] Run batch backtest with multiple tickers
- [ ] Verify parameter pass-through works
- [ ] Check results are consistent

### Task 5.4: Test URL Parameters

- [ ] Test frontend with various URL parameter combinations
- [ ] Verify `enableConsecutiveIncrementalBuyGrid` parameter works
- [ ] Verify `enableConsecutiveIncrementalSellProfit` parameter works
- [ ] Verify legacy parameter doesn't cause errors (just ignored)

### Task 5.5: Grep for Remaining References

- [ ] Run: `grep -r "enableConsecutiveIncremental[^BS]" --exclude-dir=node_modules --exclude-dir=.git --exclude="*.md"`
- [ ] Verify only spec documentation and test files remain
- [ ] Update any unexpected findings

## Phase 6: Documentation

### Task 6.1: Update Spec Documentation

- [ ] Mark spec #16 requirements.md as outdated regarding this parameter
- [ ] Create completion summary for spec #19

### Task 6.2: Commit Changes

- [ ] Create git commit with descriptive message
- [ ] Reference spec #19 in commit message

## Checklist Summary

**Config Files:**

- [ ] backtestDefaults.json cleaned and consistent
- [ ] All tickers have enableConsecutiveIncrementalBuyGrid
- [ ] All tickers have gridConsecutiveIncrement in longStrategy
- [ ] No enableConsecutiveIncremental anywhere

**Backend Services:**

- [ ] adaptiveStrategyService.js updated
- [ ] batchBacktestService.js updated
- [ ] configService.js updated

**Frontend:**

- [ ] URLParameterManager.js updated

**Tests:**

- [ ] Test documentation updated
- [ ] All test URLs work

**Verification:**

- [ ] Config loads correctly for all tickers
- [ ] Adaptive strategy works
- [ ] Batch backtests work
- [ ] URL parameters work
- [ ] No grep results for legacy parameter (except docs)

**Documentation:**

- [ ] Spec #19 completed
- [ ] Changes committed to git
