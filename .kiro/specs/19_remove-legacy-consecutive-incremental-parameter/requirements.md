# Remove Legacy enableConsecutiveIncremental Parameter

## Overview

Clean up legacy `enableConsecutiveIncremental` parameter that has been superseded by two specific feature flags:

- `enableConsecutiveIncrementalBuyGrid` (controls buy grid spacing)
- `enableConsecutiveIncrementalSellProfit` (controls sell profit requirements)

The legacy parameter is no longer used in core backtest logic but still exists in:

1. Configuration files (backtestDefaults.json)
2. Adaptive strategy service
3. Batch backtest service
4. Config service
5. URL parameter manager
6. Frontend utilities

Additionally, fix structural issues in backtestDefaults.json.

## Problems to Fix

### Problem 1: backtestDefaults.json Structure Issues

**Issue 1.1: Flat TSLA Pollution**

- Lines 217-259 contain a flat TSLA structure at root level
- This pollutes the config file with duplicate/test data
- Should be completely removed

**Issue 1.2: Inconsistent enableConsecutiveIncrementalBuyGrid**

- **PLTR** (lines 94-101): Missing `enableConsecutiveIncrementalBuyGrid`
- **TSLA** (lines 201-208): Missing `enableConsecutiveIncrementalBuyGrid`
- **SHOP** (lines 297-304): Missing `enableConsecutiveIncrementalBuyGrid`
- **AAPL** (lines 147-155): Has it (correctly)
- **global** (lines 40-48): Has it (correctly)

**Issue 1.3: Legacy enableConsecutiveIncremental**

- Present in all ticker configs and global
- Should be removed entirely

### Problem 2: Code References

**adaptiveStrategyService.js**

- Line 297: Uses `enableConsecutiveIncremental` when adjusting parameters
- Lines 357, 392, 428, 462: Sets `enableConsecutiveIncremental` in scenario rules
- Line 502: Listed in compatible parameters

**batchBacktestService.js**

- Lines 51, 128, 179, 247, 262: Passes `enableConsecutiveIncremental` through batch operations

**configService.js**

- Line 89: Maps `enableConsecutiveIncremental` to 'dynamicFeatures'
- Line 286: Listed in dynamic feature parameters

**URLParameterManager.js**

- Line 689: Includes `enableConsecutiveIncremental` in parameter list

## Requirements

### FR1: Clean Up backtestDefaults.json

1. **Remove flat TSLA structure** (lines 217-259)
   - Delete entire flat structure at root level
   - Keep only the nested TSLA structure (lines 164-216)

2. **Add missing enableConsecutiveIncrementalBuyGrid**
   - Add to PLTR dynamicFeatures (default: false)
   - Add to TSLA dynamicFeatures (default: false)
   - Add to SHOP dynamicFeatures (default: false)
   - Ensure consistency with AAPL and global

3. **Remove enableConsecutiveIncremental**
   - Remove from global.dynamicFeatures
   - Remove from PLTR.dynamicFeatures
   - Remove from AAPL.dynamicFeatures
   - Remove from TSLA.dynamicFeatures
   - Remove from SHOP.dynamicFeatures

4. **Add missing gridConsecutiveIncrement**
   - PLTR should have it in longStrategy (default: 5)
   - TSLA should have it in longStrategy (default: 5)
   - SHOP should have it in longStrategy (default: 5)

### FR2: Update adaptiveStrategyService.js

1. **Remove enableConsecutiveIncremental from parameter adjustments**
   - Line 297: Remove from adjusted parameters

2. **Update scenario rules to use specific flags**
   - Lines 357, 392, 428, 462: Replace `enableConsecutiveIncremental` with:
     - `enableConsecutiveIncrementalBuyGrid: true/false`
     - `enableConsecutiveIncrementalSellProfit: true/false`

3. **Remove from compatible parameters list**
   - Line 502: Remove `enableConsecutiveIncremental`

### FR3: Update batchBacktestService.js

1. **Remove parameter references**
   - Lines 51, 128, 179, 247, 262: Remove `enableConsecutiveIncremental`
   - Replace with the two specific flags where needed

### FR4: Update configService.js

1. **Remove from parameter mapping**
   - Line 89: Remove `enableConsecutiveIncremental` from parameterCategoryMap

2. **Remove from dynamic features list**
   - Line 286: Remove from dynamicFeatureParams array

### FR5: Update URLParameterManager.js

1. **Remove from parameter list**
   - Line 689: Remove `enableConsecutiveIncremental` from feature flag list

### FR6: Update Test Files

1. **Update aborted-events-test-cases.md**
   - Lines 108, 117: Remove `enableConsecutiveIncremental=true` from test URLs

2. **Update testResults.txt**
   - Remove `enableConsecutiveIncremental` from any test URLs if present

## Implementation Strategy

### Phase 1: Config File Cleanup

1. Fix backtestDefaults.json structure
2. Remove flat TSLA
3. Add missing parameters
4. Remove legacy parameter

### Phase 2: Backend Service Updates

1. Update adaptiveStrategyService.js
2. Update batchBacktestService.js
3. Update configService.js

### Phase 3: Frontend Updates

1. Update URLParameterManager.js

### Phase 4: Test File Updates

1. Update test documentation
2. Update test URLs

### Phase 5: Verification

1. Run backtest with each ticker to verify defaults work
2. Test adaptive strategy scenarios
3. Test batch backtests
4. Verify URL parameters work correctly

## Success Criteria

1. ✅ backtestDefaults.json has clean structure (no flat TSLA)
2. ✅ All ticker configs have consistent dynamicFeatures structure
3. ✅ `enableConsecutiveIncremental` is completely removed from codebase
4. ✅ All services use `enableConsecutiveIncrementalBuyGrid` and `enableConsecutiveIncrementalSellProfit`
5. ✅ Adaptive strategy correctly sets both specific flags
6. ✅ All existing backtests continue to work
7. ✅ No console errors or warnings

## Backward Compatibility

This change maintains backward compatibility because:

- `enableConsecutiveIncremental` was never used in core backtest logic
- The two specific flags have been in use since specs #17 and #18
- Removing unused parameters doesn't affect functionality
- URL parameters will still work (just won't include the legacy param)

## Non-Functional Requirements

### Data Integrity

- Ensure backtestDefaults.json remains valid JSON
- Verify all ticker configs have complete parameter sets
- Maintain proper nesting structure

### Code Quality

- Remove all dead code
- Ensure consistent naming
- Update comments/documentation

### Testing

- Verify each ticker's defaults load correctly
- Test adaptive strategy parameter adjustments
- Verify batch operations work

## Out of Scope

- Changing functionality of consecutive buy/sell features
- Adding new parameters
- Refactoring adaptive strategy logic
- UI changes
