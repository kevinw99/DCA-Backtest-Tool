# Consecutive Incremental Buy Grid Size - Implementation Tasks

## Phase 1: Backend Core Implementation

### Task 1.1: Add Configuration Parameters

**File**: `config/backtestDefaults.json`

- [ ] Add `enableConsecutiveIncrementalBuyGrid: false` to global.dynamicFeatures
- [ ] Add `gridConsecutiveIncrement: 5` to global.longStrategy
- [ ] Add same parameters to ticker-specific defaults (PLTR, AAPL, TSLA)
- [ ] Verify JSON syntax is valid

### Task 1.2: Add Parameter Validation

**File**: `backend/middleware/validation.js`

- [ ] Add validation for `enableConsecutiveIncrementalBuyGrid` (boolean, optional)
- [ ] Add validation for `gridConsecutiveIncrement` (numeric 0-100, optional, default 5)
- [ ] Test validation with valid and invalid inputs

### Task 1.3: Implement Grid Calculation Function

**File**: `backend/services/dcaBacktestService.js`

- [ ] Create `calculateBuyGridSize()` function with parameters:
  - gridIntervalPercent
  - gridConsecutiveIncrement
  - consecutiveBuyCount
  - lastBuyPrice
  - currentBuyPrice
  - enableConsecutiveIncrementalBuyGrid
- [ ] Implement formula: `base_grid + (ith * increment)`
- [ ] Add condition checks (consecutive, price declining)
- [ ] Add verbose logging
- [ ] Test function with various inputs

### Task 1.4: Add State Tracking Variables

**File**: `backend/services/dcaBacktestService.js`

- [ ] Initialize `consecutiveBuyCount = 0` at backtest start
- [ ] Initialize `lastBuyPrice = null` at backtest start
- [ ] Document state variables with comments

### Task 1.5: Integrate with Trailing Stop Buy Execution

**File**: `backend/services/dcaBacktestService.js`

- [ ] Locate trailing stop buy execution code
- [ ] Calculate grid size BEFORE executing buy using `calculateBuyGridSize()`
- [ ] Update `lastBuyPrice = currentBuyPrice` AFTER buy
- [ ] Increment `consecutiveBuyCount++` AFTER buy
- [ ] Store `gridSizeUsed` in lot/transaction record
- [ ] Update transaction log to show consecutive count and grid size
- [ ] Test buy execution updates state correctly

### Task 1.6: Integrate with Trailing Stop Sell Execution

**File**: `backend/services/dcaBacktestService.js`

- [ ] Locate trailing stop sell execution code
- [ ] Reset `consecutiveBuyCount = 0` when sell executes
- [ ] Reset `lastBuyPrice = null` when sell executes
- [ ] Update transaction log to show reset
- [ ] Test sell execution resets state correctly

### Task 1.7: Update Grid Spacing Validation

**File**: `backend/services/dcaBacktestService.js`

- [ ] Locate grid spacing validation for new buys
- [ ] Use calculated grid size (not fixed gridIntervalPercent) for spacing checks
- [ ] Ensure minimum spacing respects incremental grid
- [ ] Test spacing validation with incremental grid

### Task 1.8: Add Summary Statistics

**File**: `backend/services/dcaBacktestService.js`

- [ ] Track `maxConsecutiveBuyCount` during backtest
- [ ] Calculate `avgGridSizeUsed` across all buys
- [ ] Add to summary response:
  - consecutiveIncrementalBuyGridEnabled
  - gridConsecutiveIncrement
  - maxConsecutiveBuyCount
  - avgGridSizeUsed

## Phase 2: Frontend Implementation

### Task 2.1: Add UI Controls

**File**: `frontend/src/components/DCABacktestForm.js`

- [ ] Add checkbox for `enableConsecutiveIncrementalBuyGrid` in Long Strategy section
- [ ] Add number input for `gridConsecutiveIncrement` (conditionally shown)
- [ ] Add help text/tooltip explaining the feature
- [ ] Set default values (false, 5)
- [ ] Handle state changes
- [ ] Test UI controls work correctly

### Task 2.2: Update URL Parameter Manager

**File**: `frontend/src/utils/URLParameterManager.js`

- [ ] Add `enableConsecutiveIncrementalBuyGrid` to parameter keys
- [ ] Add `gridConsecutiveIncrement` to parameter keys
- [ ] Test encoding parameters to URL
- [ ] Test decoding parameters from URL
- [ ] Verify semantic URLs work

### Task 2.3: Update Strategy Defaults Utility

**File**: `frontend/src/utils/strategyDefaults.js`

- [ ] Add default values for new parameters in `getDefaultParameters()`
- [ ] Include in parameter reset logic
- [ ] Test defaults are applied correctly

### Task 2.4: Update Results Display

**File**: `frontend/src/components/BacktestResults.js`

- [ ] Add section showing consecutive incremental buy grid settings
- [ ] Display `gridConsecutiveIncrement` value
- [ ] Display `maxConsecutiveBuyCount` reached
- [ ] Display `avgGridSizeUsed` percentage
- [ ] Show grid size in transaction history table
- [ ] Test display updates correctly

### Task 2.5: Update Transaction History Table

**File**: `frontend/src/components/BacktestResults.js`

- [ ] Add "Grid Size" column to transaction table
- [ ] Add "Consecutive #" column for buy transactions
- [ ] Format percentages correctly
- [ ] Test table displays new columns

## Phase 3: Batch Testing Integration

### Task 3.1: Add Batch Parameters

**File**: `frontend/src/components/DCABacktestForm.js`

- [ ] Add `gridConsecutiveIncrement` to batch parameter options
- [ ] Add checkbox grid for [0%, 5%, 10%, 15%]
- [ ] Add `enableConsecutiveIncrementalBuyGrid` toggle
- [ ] Update combination counter to include new parameters

### Task 3.2: Update Batch Service

**File**: `backend/services/batchBacktestService.js`

- [ ] Add `gridConsecutiveIncrement` to parameter ranges
- [ ] Add `enableConsecutiveIncrementalBuyGrid` to parameter ranges
- [ ] Test batch generation includes new parameters

### Task 3.3: Update Batch Results Display

**File**: `frontend/src/components/BatchResults.js`

- [ ] Add `gridConsecutiveIncrement` column to results table
- [ ] Add `enableConsecutiveIncrementalBuyGrid` column
- [ ] Add sorting by grid consecutive increment
- [ ] Add filtering by these parameters

## Phase 4: Testing

### Task 4.1: Unit Tests

- [ ] Test `calculateBuyGridSize()` with various inputs
- [ ] Test state updates on buy/sell
- [ ] Test reset conditions
- [ ] Test validation rules

### Task 4.2: Integration Tests

- [ ] Run backtest with feature enabled on extended downtrend (TSLA 2022)
- [ ] Run backtest with feature disabled (baseline)
- [ ] Compare results - should show fewer buys with incremental grid
- [ ] Test URL parameter round-trip
- [ ] Test batch optimization includes new parameters

### Task 4.3: Regression Tests

- [ ] Verify existing backtests (feature disabled) produce same results
- [ ] Test backward compatibility with old URLs
- [ ] Test all parameter combinations in batch mode

## Phase 5: Documentation

### Task 5.1: Update REQUIREMENTS.md

- [ ] Document new parameters in section 2.10 (or new section)
- [ ] Explain consecutive incremental buy grid concept
- [ ] Provide examples

### Task 5.2: Add Inline Code Comments

- [ ] Comment grid calculation function
- [ ] Comment state tracking logic
- [ ] Comment integration points

### Task 5.3: Update Help Text

- [ ] Add tooltips in UI for new controls
- [ ] Explain when feature should be used
- [ ] Provide example scenarios

## Phase 6: Deployment

### Task 6.1: Backend Deployment

- [ ] Restart backend server (port 3001)
- [ ] Verify API accepts new parameters
- [ ] Test with curl commands

### Task 6.2: Frontend Deployment

- [ ] Rebuild frontend
- [ ] Verify UI shows new controls
- [ ] Test end-to-end workflow

### Task 6.3: Verification

- [ ] Run test backtest with feature enabled
- [ ] Verify logs show correct grid sizes
- [ ] Verify transaction history shows grid data
- [ ] Verify batch testing includes new parameters

## Success Criteria

- [ ] Backend calculates incremental grid sizes correctly
- [ ] State resets properly on sell
- [ ] Frontend UI allows configuring new parameters
- [ ] URL parameters encode/decode correctly
- [ ] Transaction history shows grid sizes
- [ ] Batch testing supports new parameters
- [ ] Feature is opt-in (disabled by default)
- [ ] All tests pass
- [ ] Documentation is complete

## Rollback Plan

If issues arise:

1. Set `enableConsecutiveIncrementalBuyGrid: false` in defaults
2. Remove UI controls (commented out, not deleted)
3. Backend still accepts parameters but ignores them
4. Existing backtests unaffected

## Estimated Effort

- Backend: 4-6 hours
- Frontend: 3-4 hours
- Testing: 2-3 hours
- Documentation: 1-2 hours
- **Total**: 10-15 hours
