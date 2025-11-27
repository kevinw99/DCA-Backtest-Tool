# Implementation Tasks - Average Cost Grid & Dynamic Profiles

## Critical Issues & Gaps Identified

### 🚨 Major Flaws

#### 1. **Average-Based Sell Logic Loses Lot Granularity**
**Problem**: When selling with average cost, we lose the ability to track which specific lots were sold.

**Impact**:
- Transaction history becomes ambiguous
- Tax lot tracking impossible (FIFO/LIFO for tax purposes)
- Can't reconstruct actual trading sequence

**Proposed Solution**:
Keep internal lot tracking but use average cost ONLY for profitability decisions:
```javascript
// Check profitability against average
const isProfitable = currentPrice > averageCost * (1 + profitRequirement);

// But still select and track specific lots
const lotsToSell = selectLotsToSell(lots, maxLotsToSell); // FIFO, LIFO, or Highest-First

// Remove sold lots from array
lots = lots.filter(l => !lotsToSell.includes(l));
```

#### 2. **First Buy Edge Case with Average Cost**
**Problem**: When `lots.length = 0`, `averageCost = 0`. Division by zero in spacing calculation.

**Current Code Risk**:
```javascript
const spacing = Math.abs(currentPrice - averageCost) / averageCost;  // 0/0 = NaN!
```

**Solution**: Explicit check before calculation.

#### 3. **Dynamic Profile Can Create Infinite Loops**
**Problem**: If total P/L oscillates around 0, profile could switch every day.

**Scenario**:
```
Day 1: P/L = -$100 → Switch to Conservative
Day 2: Conservative reduces buying, P/L becomes +$50 → Switch to Aggressive
Day 3: Aggressive increases buying, P/L becomes -$20 → Switch to Conservative
...repeat infinitely
```

**Mitigation Options**:
- **Option A**: Add hysteresis (require 3+ consecutive days above/below 0)
- **Option B**: Add cooldown period (can't switch more than once per week)
- **Option C**: Add threshold buffer (only switch if P/L > +$100 or < -$100)

**Recommendation**: Start with Option A (hysteresis)

#### 4. **Profile Override Doesn't Restore Original Values**
**Problem**: If user starts with `profitRequirement = 20%`, profile overrides to 10%, then feature is disabled, what happens?

**Current Proposal**: User's 20% is lost
**Better Solution**: Store and restore original values when feature is disabled

#### 5. **Backward Compatibility with Consecutive Incremental Features**
**Problem**: `enableConsecutiveIncrementalBuyGrid` increments grid size based on `lastBuyPrice` and `consecutiveBuyCount`.

With average-based grid:
```javascript
// Current consecutive logic
const gridSize = gridIntervalPercent + (consecutiveBuyCount * gridConsecutiveIncrement);
const spacing = Math.abs(currentPrice - lastBuyPrice) / lastBuyPrice;  // Uses LAST buy price

// Average-based logic
const spacing = Math.abs(currentPrice - averageCost) / averageCost;  // Uses AVERAGE cost
```

**Issue**: `lastBuyPrice` and `averageCost` diverge over time. Grid sizing becomes inconsistent.

**Solution**: When both features enabled, still track `lastBuyPrice` for consecutive count, but use `averageCost` for spacing reference.

---

### ⚠️ Minor Issues

#### 6. **Real Portfolio Import UX**
**Gap**: No specification for how users input existing positions.

**Required**:
- UI form for manual position entry
- Validation: shares > 0, average cost > 0, date < today
- Convert to single lot: `{ price: averageCost, shares: totalShares, date: entryDate }`

#### 7. **Batch Mode Parameter Validation**
**Gap**: What if user passes `enableDynamicProfile: [true, false]` in batch?

**Current Design**: Says "not an array"
**Implementation Needed**: Validate and throw error if array provided

#### 8. **Transaction Log Verbosity**
**Question**: Should profile switches always log, or only in verbose mode?

**Recommendation**: Always log switches (they're significant events)

#### 9. **Metrics Calculation for Profile Switching**
**Gap**: Need to add tracking:
- Days spent in each profile
- Number of switches
- P/L before/after each switch
- Performance comparison: conservative vs aggressive periods

#### 10. **Dynamic Profile with Trailing Stops**
**Edge Case**: If trailing stop buy is active when profile switches, what happens?

**Example**:
- Aggressive profile activates buy stop at $50 (0% activation)
- Profile switches to Conservative (10% activation required)
- Buy stop still exists at $50
- Price rebounds to $51 → Should it execute?

**Current Design**: "Let it complete naturally"
**Problem**: This violates Conservative profile's 10% requirement!

**Better Solution**: Cancel active trailing stops when profile switches

---

### 📋 Missing Specifications

#### 11. **API Response Format**
**Gap**: No spec for how new fields appear in API response.

**Required Addition**:
```javascript
{
  success: true,
  data: {
    // ... existing fields
    averageBasedGridEnabled: true,
    averageBasedSellEnabled: false,
    dynamicProfileEnabled: true,
    profileMetrics: {
      currentProfile: 'AGGRESSIVE',
      switchCount: 5,
      daysInConservative: 45,
      daysInAggressive: 207,
      switches: [
        { date: '2024-02-03', from: 'AGGRESSIVE', to: 'CONSERVATIVE', pnl: -320.15 },
        // ...
      ]
    }
  }
}
```

#### 12. **Database Schema Changes**
**Gap**: If we want to persist profile switches for analysis, need DB changes.

**Required**:
- New table: `profile_switches` (backtest_id, date, from_profile, to_profile, pnl)
- Or: Add JSON column to backtest results

#### 13. **Frontend UI Components**
**Gap**: No mockups or specifications for UI controls.

**Required**:
- Checkbox: "Enable Average-Based Grid Spacing"
- Checkbox: "Enable Average-Based Sell Logic"
- Checkbox: "Enable Dynamic Profile Switching"
- Tooltip explanations for each
- Warning: "Average-based features simplify logic but lose lot granularity"

#### 14. **Performance Benchmarks**
**Gap**: No baseline performance metrics to compare against.

**Required**:
- Benchmark current implementation
- Set targets for each feature
- Create automated performance tests

---

## Implementation Tasks

### Phase 1: Average-Based Grid Spacing (Week 1)

#### Task 1.1: Add Parameter & Validation
- [ ] Add `enableAverageBasedGrid` to params schema
- [ ] Add default value (false)
- [ ] Add batch mode validation (reject if array)
- [ ] Add API documentation

**Files**: `services/dcaBacktestService.js` (param definition)

#### Task 1.2: Implement Grid Spacing Logic
- [ ] Create `checkGridSpacingAverage()` function
- [ ] Handle first buy edge case (`lots.length === 0`)
- [ ] Implement asymmetric spacing (below/above average)
- [ ] Handle dynamic grid interaction
- [ ] Handle consecutive incremental buy grid interaction

**Files**: `services/dcaBacktestService.js` (lines ~697-736)

#### Task 1.3: Add Logging
- [ ] Log when average-based grid is active
- [ ] Log spacing calculations in verbose mode
- [ ] Log grid check results

**Files**: `services/dcaBacktestService.js`

#### Task 1.4: Unit Tests
- [ ] Test: First buy always allowed
- [ ] Test: Buying below average (full spacing)
- [ ] Test: Buying above average (half spacing)
- [ ] Test: Average cost = 0 edge case
- [ ] Test: Dynamic grid interaction
- [ ] Test: Consecutive incremental interaction
- [ ] Test: Backward compatibility (disabled mode)

**Files**: `services/dcaBacktestService.test.js` (new file)

#### Task 1.5: Integration Tests
- [ ] Run full backtest with feature enabled
- [ ] Compare performance: enabled vs disabled
- [ ] Verify backward compatibility (same results when disabled)

**Files**: `integration/average-based-grid.test.js` (new file)

---

### Phase 2: Average-Based Sell Logic (Week 2)

#### Task 2.1: Add Parameter & Validation
- [ ] Add `enableAverageBasedSell` to params schema
- [ ] Add default value (false)
- [ ] Add batch mode validation
- [ ] Add API documentation

**Files**: `services/dcaBacktestService.js`

#### Task 2.2: Implement Sell Logic
- [ ] Modify profitability check (use average cost)
- [ ] Keep lot selection logic (still select specific lots)
- [ ] Update limit price calculation
- [ ] Handle consecutive sell profit interaction
- [ ] Ensure lots are still removed from array after sell

**Files**: `services/dcaBacktestService.js` (lines ~944-1012)

#### Task 2.3: Add Logging
- [ ] Log profitability check against average cost
- [ ] Log selected lots
- [ ] Show average cost in transaction log

**Files**: `services/dcaBacktestService.js`

#### Task 2.4: Unit Tests
- [ ] Test: Profitability check against average cost
- [ ] Test: Lot selection (still FIFO at highest price)
- [ ] Test: Limit price calculation
- [ ] Test: Consecutive sell interaction
- [ ] Test: Single lot edge case
- [ ] Test: Backward compatibility

**Files**: `services/dcaBacktestService.test.js`

#### Task 2.5: Integration Tests
- [ ] Full backtest with average-based sell
- [ ] Compare with lot-based sell
- [ ] Test with real portfolio scenario (single lot entry)

**Files**: `integration/average-based-sell.test.js` (new file)

---

### Phase 3: Dynamic Profile Switching (Week 3)

#### Task 3.1: Add Parameter & Validation
- [ ] Add `enableDynamicProfile` to params schema
- [ ] Add default value (false)
- [ ] Add batch mode validation (single boolean, not array)
- [ ] Add API documentation

**Files**: `services/dcaBacktestService.js`

#### Task 3.2: Implement Profile Logic
- [ ] Define profile configurations (CONSERVATIVE, AGGRESSIVE)
- [ ] Create `determineProfile()` function
- [ ] Create `applyProfileOverrides()` function
- [ ] Store original parameter values
- [ ] Add profile switch detection
- [ ] Handle first day initialization

**Files**: `services/dcaBacktestService.js` (new section)

#### Task 3.3: Handle Active Orders
- [ ] Decision: Cancel or preserve active trailing stops on switch?
- [ ] Implement chosen approach
- [ ] Add logging for affected orders

**Files**: `services/dcaBacktestService.js`

#### Task 3.4: Add Hysteresis (Mitigation for Issue #3)
- [ ] Add hysteresis counter (consecutive days in P/L region)
- [ ] Require 3 consecutive days before switching
- [ ] Add logging for hysteresis events

**Files**: `services/dcaBacktestService.js`

#### Task 3.5: Add Metrics Tracking
- [ ] Track profile switch count
- [ ] Track days in each profile
- [ ] Track P/L at each switch
- [ ] Add to results summary

**Files**: `services/dcaBacktestService.js` (results section)

#### Task 3.6: Add Logging
- [ ] Log profile switches (always, not just verbose)
- [ ] Log parameter changes
- [ ] Show current profile in daily header (optional)

**Files**: `services/dcaBacktestService.js`

#### Task 3.7: Unit Tests
- [ ] Test: Profile determination (P/L < 0 → Conservative)
- [ ] Test: Profile switching
- [ ] Test: Parameter overrides
- [ ] Test: Original parameter restoration
- [ ] Test: Hysteresis logic
- [ ] Test: Metrics calculation
- [ ] Test: Backward compatibility

**Files**: `services/dcaBacktestService.test.js`

#### Task 3.8: Integration Tests
- [ ] Full backtest crossing P/L = 0 multiple times
- [ ] Verify profile switches at correct times
- [ ] Verify metrics accuracy
- [ ] Performance test (no degradation)

**Files**: `integration/dynamic-profile.test.js` (new file)

---

### Phase 4: Frontend & Documentation (Week 4)

#### Task 4.1: API Endpoints
- [ ] Update POST `/api/backtest/dca` to accept new params
- [ ] Update response format with new fields
- [ ] Update API documentation

**Files**: `routes/backtest.js`

#### Task 4.2: Frontend UI
- [ ] Add "Average-Based Grid" checkbox
- [ ] Add "Average-Based Sell" checkbox
- [ ] Add "Dynamic Profile" checkbox
- [ ] Add tooltips with explanations
- [ ] Add "Real Portfolio Import" form (future)
- [ ] Update batch test UI

**Files**: `frontend/src/components/Parameters.jsx`

#### Task 4.3: Documentation
- [ ] User guide: What are these features?
- [ ] User guide: When to use each feature?
- [ ] User guide: How to enable/disable?
- [ ] Developer guide: Implementation details
- [ ] Migration guide: Backward compatibility notes
- [ ] Examples: Before/after comparisons

**Files**: `docs/average-cost-grid.md`, `docs/dynamic-profiles.md`

#### Task 4.4: Testing Documentation
- [ ] Document test scenarios
- [ ] Document expected outcomes
- [ ] Create test data sets

**Files**: `docs/testing-guide.md`

---

### Phase 5: Validation & Rollout (Week 5)

#### Task 5.1: Backward Compatibility Tests
- [ ] Run entire existing test suite
- [ ] Verify 0 differences when features disabled
- [ ] Create automated regression test

**Files**: `tests/backward-compat.test.js`

#### Task 5.2: Performance Benchmarks
- [ ] Benchmark with features disabled
- [ ] Benchmark with average-based grid enabled
- [ ] Benchmark with all features enabled
- [ ] Verify <10% overhead when disabled
- [ ] Verify 5-10% speedup with average-based grid

**Files**: `benchmarks/average-cost-features.js`

#### Task 5.3: Beta Testing
- [ ] Deploy to staging environment
- [ ] Invite 5-10 beta testers
- [ ] Collect feedback for 2 weeks
- [ ] Fix critical bugs
- [ ] Iterate on UX

#### Task 5.4: Production Release
- [ ] Deploy to production
- [ ] Monitor error logs
- [ ] Monitor performance metrics
- [ ] Collect user feedback
- [ ] Create support documentation

---

## Risk Assessment

### High Risk Items

1. **Profile switching infinite loops** (Issue #3)
   - **Mitigation**: Hysteresis (Task 3.4)
   - **Fallback**: Add emergency kill switch (max 10 switches per backtest)

2. **Backward compatibility break**
   - **Mitigation**: Extensive regression testing (Task 5.1)
   - **Fallback**: Feature flags to disable remotely

3. **Performance degradation**
   - **Mitigation**: Performance benchmarks (Task 5.2)
   - **Fallback**: Optimize hot paths

### Medium Risk Items

4. **Consecutive feature interactions** (Issue #5)
   - **Mitigation**: Explicit interaction handling (Tasks 1.2, 2.2)
   - **Fallback**: Document limitations

5. **Transaction history ambiguity** (Issue #1)
   - **Mitigation**: Keep internal lot tracking (Task 2.2)
   - **Fallback**: Add warnings to users

### Low Risk Items

6. **UI/UX issues**
   - **Mitigation**: Beta testing (Task 5.3)
   - **Fallback**: Iterate based on feedback

7. **Documentation gaps**
   - **Mitigation**: Comprehensive docs (Task 4.3)
   - **Fallback**: Add based on user questions

---

## Dependencies

### External Dependencies
- None (all internal changes)

### Internal Dependencies
- Current DCA backtest service (stable)
- Frontend parameter UI (requires updates)
- Batch test infrastructure (requires validation updates)

### Team Dependencies
- Product Owner: Answer open questions (Section 9 of design.md)
- QA: Test all scenarios
- DevOps: Deploy staging environment for beta

---

## Timeline

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Phase 1: Average Grid | 1 week | Week 1 | Week 1 |
| Phase 2: Average Sell | 1 week | Week 2 | Week 2 |
| Phase 3: Dynamic Profile | 1 week | Week 3 | Week 3 |
| Phase 4: UI & Docs | 1 week | Week 4 | Week 4 |
| Phase 5: Validation | 1 week | Week 5 | Week 5 |
| **Total** | **5 weeks** | | |

**Note**: Phases 1-3 can partially overlap if multiple developers work in parallel.

---

## Success Criteria

### Must Have (P0)
- ✅ All three features implemented and tested
- ✅ Backward compatibility: 0 differences when disabled
- ✅ No performance degradation (< 10% overhead)
- ✅ UI controls for all parameters
- ✅ Complete documentation

### Should Have (P1)
- ✅ Hysteresis for profile switching
- ✅ Performance improvement (5-10% with average grid)
- ✅ Beta tested by 5+ users
- ✅ Comprehensive examples and guides

### Nice to Have (P2)
- ⭕ Real portfolio import UI
- ⭕ Database persistence for profile switches
- ⭕ Advanced profile configurations
- ⭕ Backtesting comparison tool (avg vs lot-based)

---

## Open Questions (for Product Owner)

These must be answered before implementation:

1. **Average Grid Spacing (Issue #2)**: Half spacing or full spacing when buying above average?
2. **Lot Selection (Issue #1)**: Keep highest-price selection or change to FIFO?
3. **Profile Hysteresis (Issue #3)**: 3 days? 5 days? Or no hysteresis?
4. **Active Orders (Issue #10)**: Cancel on profile switch or let complete?
5. **Profile Scope**: Only buy/sell params or also grid params?

**Recommendation**: Schedule 30-minute decision meeting before Phase 1.
