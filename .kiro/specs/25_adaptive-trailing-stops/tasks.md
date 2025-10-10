# Spec 25: Adaptive Trailing Stops - Implementation Tasks

## Phase 1: Foundation & Constants

### Task 1.1: Add Constants
**File:** `backend/services/dcaBacktestService.js`
**Location:** Top of file (after existing constants)

- [ ] Add `ADAPTIVE_SELL_PULLBACK_DECAY = 0.5`
- [ ] Add `ADAPTIVE_BUY_REBOUND_DECAY = 0.8`
- [ ] Add `MIN_ADAPTIVE_SELL_PULLBACK = 0.02`
- [ ] Add `MIN_ADAPTIVE_BUY_REBOUND = 0.05`
- [ ] Add JSDoc comments explaining each constant

**Estimated Time:** 10 minutes

### Task 1.2: Initialize State Variables
**File:** `backend/services/dcaBacktestService.js`
**Location:** Around line 600 (after existing state initialization)

- [ ] Add `let lastSellPrice = null;`
- [ ] Add `let lastSellPullback = null;`
- [ ] Add `let lastBuyRebound = null;`
- [ ] Verify `lastBuyPrice` already exists
- [ ] Add comments explaining adaptive state

**Estimated Time:** 5 minutes

---

## Phase 2: Helper Functions

### Task 2.1: Create Adaptive Sell Parameter Calculator
**File:** `backend/services/dcaBacktestService.js`
**Location:** Before `runDCABacktest` function (with other utility functions)

- [ ] Create `calculateAdaptiveSellParameters()` function
- [ ] Implement price direction detection
- [ ] Implement pullback decay logic
- [ ] Implement profit requirement skip logic
- [ ] Enforce minimum threshold (2%)
- [ ] Add comprehensive JSDoc
- [ ] Return object with: `{ activation, pullback, skipProfitRequirement, isAdaptive, direction }`

**Estimated Time:** 35 minutes

### Task 2.2: Create Adaptive Buy Parameter Calculator
**File:** `backend/services/dcaBacktestService.js`
**Location:** After `calculateAdaptiveSellParameters()`

- [ ] Create `calculateAdaptiveBuyParameters()` function
- [ ] Implement price direction detection
- [ ] Implement rebound decay logic
- [ ] Enforce minimum threshold (5%)
- [ ] Add comprehensive JSDoc
- [ ] Return object with: `{ activation, rebound, isAdaptive, direction }`

**Estimated Time:** 30 minutes

---

## Phase 3: Sell Logic Integration

### Task 3.1: Find Sell Trailing Stop Logic
**File:** `backend/services/dcaBacktestService.js`
**Location:** Around line 1050-1150 (sell execution section)

- [ ] Locate where `trailingSellActivationPercent` is used
- [ ] Locate where `trailingSellPullbackPercent` is used
- [ ] Identify sell execution point
- [ ] Document current flow for reference

**Estimated Time:** 15 minutes

### Task 3.2: Integrate Adaptive Sell Logic
**File:** `backend/services/dcaBacktestService.js`
**Location:** Before trailing stop activation check

- [ ] Call `calculateAdaptiveSellParameters()` before trailing stop logic
- [ ] Store result in `adaptiveSellParams`
- [ ] Add conditional: if `adaptiveSellParams.isAdaptive`
- [ ] Override `trailingSellActivationPercent` with `adaptiveSellParams.activation`
- [ ] Override `trailingSellPullbackPercent` with `adaptiveSellParams.pullback`
- [ ] Skip profit requirement check if `adaptiveSellParams.skipProfitRequirement` is true
- [ ] Update `lastSellPullback = adaptiveSellParams.pullback`
- [ ] Add logging for adaptive mode activation (include profit requirement status)

**Estimated Time:** 50 minutes

### Task 3.3: Update Sell State After Execution
**File:** `backend/services/dcaBacktestService.js`
**Location:** After sell execution

- [ ] Add `lastSellPrice = sellPrice;` after successful sell
- [ ] Ensure state updates before consecutive count changes
- [ ] Add debug logging for state update

**Estimated Time:** 10 minutes

### Task 3.4: Reset Sell State on Sequence End
**File:** `backend/services/dcaBacktestService.js`
**Location:** Where `consecutiveSellCount` resets to 0

- [ ] Add `lastSellPrice = null;` on reset
- [ ] Add `lastSellPullback = null;` on reset
- [ ] Add logging for state reset

**Estimated Time:** 10 minutes

---

## Phase 4: Buy Logic Integration

### Task 4.1: Find Buy Trailing Stop Logic
**File:** `backend/services/dcaBacktestService.js`
**Location:** Around line 750-900 (buy execution section)

- [ ] Locate where `trailingBuyActivationPercent` is used
- [ ] Locate where `trailingBuyReboundPercent` is used
- [ ] Identify buy execution point
- [ ] Document current flow for reference

**Estimated Time:** 15 minutes

### Task 4.2: Integrate Adaptive Buy Logic
**File:** `backend/services/dcaBacktestService.js`
**Location:** Before trailing stop activation check

- [ ] Call `calculateAdaptiveBuyParameters()` before trailing stop logic
- [ ] Store result in `adaptiveBuyParams`
- [ ] Add conditional: if `adaptiveBuyParams.isAdaptive`
- [ ] Override `trailingBuyActivationPercent` with `adaptiveBuyParams.activation`
- [ ] Override `trailingBuyReboundPercent` with `adaptiveBuyParams.rebound`
- [ ] Update `lastBuyRebound = adaptiveBuyParams.rebound`
- [ ] Add logging for adaptive mode activation

**Estimated Time:** 45 minutes

### Task 4.3: Update Buy State After Execution
**File:** `backend/services/dcaBacktestService.js`
**Location:** After buy execution

- [ ] Verify `lastBuyPrice = buyPrice;` already exists
- [ ] Ensure state updates before consecutive count changes
- [ ] Add debug logging for state update

**Estimated Time:** 5 minutes

### Task 4.4: Reset Buy State on Sequence End
**File:** `backend/services/dcaBacktestService.js`
**Location:** Where `consecutiveBuyCount` resets to 0

- [ ] Add `lastBuyRebound = null;` on reset
- [ ] Verify `lastBuyPrice = null;` already exists
- [ ] Add logging for state reset

**Estimated Time:** 5 minutes

---

## Phase 5: Testing & Validation

### Task 5.1: Create Test Scenarios
**Location:** Manual testing or test script

- [ ] Scenario 1: Consecutive sells during continuous downtrend
- [ ] Scenario 2: Consecutive buys during continuous uptrend
- [ ] Scenario 3: Direction reversal (down → up, up → down)
- [ ] Scenario 4: Minimum threshold enforcement
- [ ] Scenario 5: Multiple consecutive cycles

**Estimated Time:** 30 minutes

### Task 5.2: Run Backtest Validation
**Location:** Backend testing

- [ ] Run PLTR backtest with `enableConsecutiveIncrementalSellProfit=true`
- [ ] Verify adaptive sell activation during downtrends
- [ ] Verify pullback decay progression
- [ ] Run backtest with `enableConsecutiveIncrementalBuyGrid=true`
- [ ] Verify adaptive buy activation during uptrends
- [ ] Verify rebound decay progression

**Estimated Time:** 1 hour

### Task 5.3: Verify Logging Output
**Location:** Backend logs

- [ ] Check adaptive mode activation messages appear
- [ ] Verify direction detection logged correctly
- [ ] Confirm decay calculations shown in logs
- [ ] Verify state reset messages
- [ ] Ensure minimum threshold enforcement logged

**Estimated Time:** 20 minutes

### Task 5.4: Edge Case Testing
**Location:** Backend testing

- [ ] Test with consecutive feature disabled (should be no-op)
- [ ] Test first consecutive trade (no adaptation)
- [ ] Test rapid direction changes
- [ ] Test minimum threshold reached and sustained
- [ ] Test sequence reset and restart

**Estimated Time:** 45 minutes

---

## Phase 6: Documentation & Cleanup

### Task 6.1: Add Code Comments
**File:** `backend/services/dcaBacktestService.js`

- [ ] Document adaptive logic in helper functions
- [ ] Add inline comments for direction detection
- [ ] Explain decay formula in comments
- [ ] Document state management flow
- [ ] Add examples in JSDoc

**Estimated Time:** 30 minutes

### Task 6.2: Update Transaction Log Messages
**File:** `backend/services/dcaBacktestService.js`

- [ ] Ensure adaptive activation logged clearly
- [ ] Add direction and parameter info to log messages
- [ ] Include previous vs. new values
- [ ] Log profit requirement skip status (SKIPPED vs Required)
- [ ] Use consistent emoji/formatting (🎯 for adaptive)

**Estimated Time:** 15 minutes

### Task 6.3: Verify No Breaking Changes
**Location:** Existing backtests

- [ ] Run previous backtests with features disabled
- [ ] Verify identical results to before implementation
- [ ] Confirm no changes to non-consecutive trades
- [ ] Test backward compatibility

**Estimated Time:** 30 minutes

---

## Phase 7: Git Commit

### Task 7.1: Stage Changes
- [ ] Review all modified files
- [ ] Ensure no debug code left behind
- [ ] Verify code follows existing patterns
- [ ] Run git diff to review changes

**Estimated Time:** 15 minutes

### Task 7.2: Create Commit
- [ ] Write descriptive commit message
- [ ] Include feature overview
- [ ] List key changes (constants, helper functions, integrations)
- [ ] Mention testing performed
- [ ] Add Claude Code attribution

**Estimated Time:** 10 minutes

---

## Summary

**Total Estimated Time:** ~7.7 hours

**Breakdown:**
- Phase 1 (Foundation): 15 minutes
- Phase 2 (Helper Functions): 1 hour 5 minutes
- Phase 3 (Sell Integration): 1 hour 25 minutes
- Phase 4 (Buy Integration): 1 hour 10 minutes
- Phase 5 (Testing): 2 hours 35 minutes
- Phase 6 (Documentation): 1 hour 15 minutes
- Phase 7 (Git): 25 minutes

**Critical Path:**
1. Constants and state → Helper functions → Sell integration → Buy integration → Testing

**Dependencies:**
- Sell logic can be implemented independently of buy logic
- Testing requires both sell and buy integration complete
- Documentation can be done concurrently with implementation

**Risk Areas:**
- Integration with existing trailing stop logic (test thoroughly)
- State reset timing (ensure happens at right moment)
- Direction detection edge cases (price exactly equal)

**Success Metrics:**
- ✅ All tests pass
- ✅ Adaptive mode activates in expected scenarios
- ✅ Decay formulas produce correct values
- ✅ Minimum thresholds enforced
- ✅ No impact when features disabled
