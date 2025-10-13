# Tasks: DCA Signal Engine Refactoring

## Overview

This document outlines the specific implementation tasks for extracting core DCA trading logic into a shared signal engine. Tasks are organized by phase and dependency order.

## Phase 1: Create Signal Engine Module

### Task 1.1: Create dcaSignalEngine.js skeleton
- [ ] Create `/backend/services/dcaSignalEngine.js`
- [ ] Add file header with documentation
- [ ] Add module exports structure
- [ ] Add helper functions (generateLotId, etc.)

**Estimated effort**: 30 minutes

---

### Task 1.2: Implement Grid Calculation Functions
- [ ] `calculateAverageCost(lots)`
- [ ] `calculateBuyGridLevel(averageCost, gridIntervalPercent, consecutiveBuys)`
- [ ] `calculateSellGridLevel(lotCost, profitRequirement, consecutiveSells)`
- [ ] Add unit tests for grid calculations

**Estimated effort**: 1 hour

**Acceptance criteria**:
- Grid calculations match existing logic in both individual and portfolio
- Tests cover edge cases (empty lots, zero prices, etc.)

---

### Task 1.3: Implement Lot Management Functions
- [ ] `calculateLotProfitPercent(lot, currentPrice)`
- [ ] `filterProfitableLots(lots, currentPrice, minProfitPercent)`
- [ ] `selectLotsToSell(lots, strategy)`
- [ ] Add unit tests for lot management

**Estimated effort**: 1 hour

**Acceptance criteria**:
- LIFO, FIFO strategies work correctly
- Profit calculations accurate to 2 decimal places
- Handle edge cases (no lots, negative prices, etc.)

---

### Task 1.4: Implement Signal Evaluation - Buy
- [ ] `evaluateBuySignal(state, params, currentPrice, indicators)`
- [ ] Handle maxLots constraint
- [ ] Handle grid interval logic
- [ ] Handle consecutive buy increments
- [ ] Add unit tests for buy signals

**Estimated effort**: 2 hours

**Acceptance criteria**:
- Buy signals trigger at correct grid levels
- MaxLots constraint enforced
- Consecutive buy logic works correctly
- All edge cases tested

---

### Task 1.5: Implement Signal Evaluation - Sell
- [ ] `evaluateSellSignal(state, params, currentPrice, indicators)`
- [ ] Handle profit requirement
- [ ] Handle lot selection
- [ ] Handle consecutive sell increments
- [ ] Add unit tests for sell signals

**Estimated effort**: 2 hours

**Acceptance criteria**:
- Sell signals trigger when lots are profitable
- Correct lots selected based on strategy
- Consecutive sell logic works correctly
- All edge cases tested

---

### Task 1.6: Implement Signal Evaluation - Trailing Stop
- [ ] `evaluateTrailingStop(state, params, currentPrice)`
- [ ] Handle activation threshold
- [ ] Handle pullback distance
- [ ] Handle peak tracking
- [ ] Add unit tests for trailing stops

**Estimated effort**: 2 hours

**Acceptance criteria**:
- Trailing stop activates at correct threshold (20%)
- Triggers on correct pullback (10%)
- Peak tracking accurate
- Matches existing individual DCA logic

---

### Task 1.7: Implement State Transformation Functions
- [ ] `applyBuyTransaction(state, transaction)`
- [ ] `applySellTransaction(state, transaction, lotsToRemove)`
- [ ] `updatePeakTracking(state, currentPrice)`
- [ ] Add unit tests for state transformations

**Estimated effort**: 1.5 hours

**Acceptance criteria**:
- State transformations are immutable (don't modify input)
- Consecutive counters update correctly
- Peak tracking maintains history
- All fields properly updated

---

## Phase 2: Integrate with Portfolio Backtest

### Task 2.1: Refactor Portfolio evaluateBuySignal
- [ ] Read existing logic in portfolioBacktestService.js lines 461-510
- [ ] Replace with dcaEngine.evaluateBuySignal()
- [ ] Map StockState to engine state format
- [ ] Verify no behavioral changes

**Estimated effort**: 1 hour

**File**: `/backend/services/portfolioBacktestService.js`

**Acceptance criteria**:
- Buy signals identical to before refactoring
- All existing tests pass
- Capital constraints still enforced

---

### Task 2.2: Refactor Portfolio evaluateSellSignal
- [ ] Read existing logic in portfolioBacktestService.js lines 512-546
- [ ] Replace with dcaEngine.evaluateSellSignal()
- [ ] Map StockState to engine state format
- [ ] Verify no behavioral changes

**Estimated effort**: 1 hour

**Acceptance criteria**:
- Sell signals identical to before refactoring
- LIFO lot selection still works
- All existing tests pass

---

### Task 2.3: Add Trailing Stop Support to Portfolio
- [ ] Add trailing stop parameters to portfolio config
- [ ] Call dcaEngine.evaluateTrailingStop() in processSells
- [ ] Update peak tracking in StockState
- [ ] Add tests for portfolio trailing stops

**Estimated effort**: 2 hours

**File**: `/backend/services/portfolioBacktestService.js`

**Acceptance criteria**:
- Portfolio can use trailing stops like individual DCA
- Peak tracking per-stock maintained
- Capital flow still correct
- New feature tested

---

### Task 2.4: Refactor Portfolio Helper Functions
- [ ] Replace calculateAverageCost with engine version
- [ ] Use engine grid calculation functions
- [ ] Remove duplicated helper code
- [ ] Verify all calculations identical

**Estimated effort**: 1 hour

**Acceptance criteria**:
- No code duplication between portfolio and engine
- All calculations produce identical results
- Tests pass

---

### Task 2.5: Test Portfolio Integration
- [ ] Run full portfolio backtest test suite
- [ ] Compare results before/after refactoring
- [ ] Test with multiple stocks
- [ ] Test capital constraints
- [ ] Test order rejection
- [ ] Verify via curl commands

**Estimated effort**: 2 hours

**Acceptance criteria**:
- All tests pass
- Results identical to baseline (commit 69c7de8)
- Manual verification via curl shows same metrics
- No performance regression

---

## Phase 3: Integrate with Individual DCA

### Task 3.1: Analyze Individual DCA Main Loop
- [ ] Read dcaBacktestService.js lines 1845-2300
- [ ] Identify all buy/sell signal evaluations
- [ ] Map to engine functions
- [ ] Document differences from portfolio

**Estimated effort**: 1.5 hours

**File**: `/backend/services/dcaBacktestService.js`

**Deliverable**: Analysis document showing mapping

---

### Task 3.2: Refactor Individual DCA Buy Logic
- [ ] Find buy signal evaluation code
- [ ] Replace with dcaEngine.evaluateBuySignal()
- [ ] Preserve adaptive strategy hooks
- [ ] Verify signals identical

**Estimated effort**: 2 hours

**Acceptance criteria**:
- Buy signals match previous behavior
- Adaptive strategies still work
- Consecutive buy increments correct
- Tests pass

---

### Task 3.3: Refactor Individual DCA Sell Logic
- [ ] Find sell signal evaluation code
- [ ] Replace with dcaEngine.evaluateSellSignal()
- [ ] Preserve scenario detection hooks
- [ ] Verify signals identical

**Estimated effort**: 2 hours

**Acceptance criteria**:
- Sell signals match previous behavior
- Scenario detection still works
- Lot selection correct
- Tests pass

---

### Task 3.4: Refactor Individual DCA Trailing Stop
- [ ] Find trailing stop logic
- [ ] Replace with dcaEngine.evaluateTrailingStop()
- [ ] Verify peak tracking identical
- [ ] Test all trailing stop scenarios

**Estimated effort**: 2 hours

**Acceptance criteria**:
- Trailing stops work identically
- Peak tracking accurate
- Activation/distance thresholds correct
- All test cases pass

---

### Task 3.5: Refactor Individual DCA Helper Functions
- [ ] Replace grid calculation functions
- [ ] Replace lot management functions
- [ ] Remove duplicated code
- [ ] Verify all calculations identical

**Estimated effort**: 1.5 hours

**Acceptance criteria**:
- No code duplication
- All calculations identical
- Tests pass

---

### Task 3.6: Test Individual DCA Integration
- [ ] Run full individual DCA test suite
- [ ] Compare results before/after refactoring
- [ ] Test with TSLA historical data
- [ ] Test adaptive strategies
- [ ] Test scenario detection
- [ ] Verify via curl commands

**Estimated effort**: 3 hours

**Acceptance criteria**:
- All tests pass
- Results identical to baseline
- Adaptive strategies work correctly
- Manual verification successful
- No performance regression

---

## Phase 4: Cleanup and Documentation

### Task 4.1: Remove Duplicated Code
- [ ] Remove old helper functions from portfolioBacktestService.js
- [ ] Remove old helper functions from dcaBacktestService.js
- [ ] Clean up unused imports
- [ ] Run linter

**Estimated effort**: 1 hour

**Acceptance criteria**:
- No duplicated logic between services and engine
- Code is clean and well-organized
- Linter passes

---

### Task 4.2: Add Comprehensive Tests
- [ ] Add integration tests comparing both implementations
- [ ] Add performance benchmarks
- [ ] Test edge cases across all functions
- [ ] Achieve >90% code coverage for signal engine

**Estimated effort**: 3 hours

**Acceptance criteria**:
- >90% code coverage
- All edge cases tested
- Performance benchmarks established
- Integration tests pass

---

### Task 4.3: Update Documentation
- [ ] Add JSDoc comments to all engine functions
- [ ] Update architecture diagram
- [ ] Create signal engine usage guide
- [ ] Document migration from old to new approach
- [ ] Update README if needed

**Estimated effort**: 2 hours

**Acceptance criteria**:
- All functions have JSDoc comments
- Architecture docs reflect new structure
- Usage examples provided
- Migration guide complete

---

### Task 4.4: Performance Optimization
- [ ] Profile backtest execution
- [ ] Identify any bottlenecks
- [ ] Optimize hot paths if needed
- [ ] Verify no regression vs baseline

**Estimated effort**: 2 hours

**Acceptance criteria**:
- Performance within 5% of baseline
- No obvious bottlenecks
- Profiling data documented

---

### Task 4.5: Final Verification
- [ ] Run all tests (unit, integration, e2e)
- [ ] Run portfolio backtest via curl
- [ ] Run individual DCA backtest via curl
- [ ] Compare results to baseline (commit 69c7de8)
- [ ] Verify trailing stops work in portfolio
- [ ] Manual smoke testing

**Estimated effort**: 2 hours

**Acceptance criteria**:
- All tests pass
- Results match baseline
- Trailing stops work in portfolio
- No regressions found
- Ready for commit

---

## Summary

**Total estimated effort**: ~35 hours

**Phases**:
1. Create Signal Engine Module: ~10 hours
2. Integrate with Portfolio: ~8 hours
3. Integrate with Individual DCA: ~12 hours
4. Cleanup and Documentation: ~10 hours

**Key milestones**:
1. Signal engine module complete with tests ✓
2. Portfolio backtest refactored and verified ✓
3. Individual DCA refactored and verified ✓
4. All tests passing, documentation complete ✓

**Success metrics**:
- Zero test failures
- Results identical to baseline
- No performance regression
- Trailing stops work in portfolio
- >90% code coverage for signal engine
- Clean, maintainable code
