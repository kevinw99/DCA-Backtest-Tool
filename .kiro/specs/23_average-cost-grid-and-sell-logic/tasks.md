# Implementation Tasks - Spec 23: Average-Cost Grid & Sell Logic

## Overview

This document breaks down the implementation of Features #1 (Average-Based Grid) and #2 (Average-Based Sell) into specific, actionable tasks.

**Timeline**: 3 weeks total

---

## Phase 1: Average-Based Grid Spacing (Week 1)

### Task 1.1: Add Parameter & Validation
**File**: `backend/services/dcaBacktestService.js`
**Estimated Time**: 1 hour

- [ ] Add `enableAverageBasedGrid` to parameter definition (default: `false`)
- [ ] Add JSDoc documentation for parameter
- [ ] Add validation: must be boolean
- [ ] Add validation: cannot be array in batch mode (throw error if array)
- [ ] Update parameter summary logging

**Acceptance Criteria**:
- Parameter accepts `true` or `false`
- Throws error if non-boolean value provided
- Throws error if array provided: `"enableAverageBasedGrid cannot be an array"`
- Default value is `false` (backward compatible)

---

### Task 1.2: Implement Grid Spacing Logic
**File**: `backend/services/dcaBacktestService.js` (lines ~697-736)
**Estimated Time**: 4 hours

- [ ] Create helper function: `checkGridSpacingAgainstAverage(currentPrice, averageCost, gridSize)`
- [ ] Handle edge case: first buy (when `lots.length === 0`)
- [ ] Handle edge case: `averageCost === 0` (return true)
- [ ] Implement asymmetric spacing:
  - Below average: full spacing required
  - Above average: half spacing required
- [ ] Integrate with dynamic grid feature (use calculated grid size)
- [ ] Integrate with consecutive incremental buy grid feature
- [ ] Add conditional logic to use average-based OR lot-based grid checking

**Code Structure**:
```javascript
function checkGridSpacingAgainstAverage(currentPrice, averageCost, gridSize) {
  // Edge case: first buy
  if (averageCost === 0) {
    return true;
  }

  // Asymmetric spacing
  if (currentPrice < averageCost) {
    // Buying below average - require full spacing
    const spacingBelowAverage = (averageCost - currentPrice) / averageCost;
    return spacingBelowAverage >= gridSize;
  } else {
    // Buying above average - require half spacing (more lenient)
    const spacingAboveAverage = (currentPrice - averageCost) / averageCost;
    return spacingAboveAverage >= (gridSize * 0.5);
  }
}

// In buy logic
const respectsGridSpacing = enableAverageBasedGrid
  ? checkGridSpacingAgainstAverage(currentPrice, averageCost, buyGridSize)
  : lots.every((lot, index) => {
      // ... existing lot-based logic
    });
```

**Acceptance Criteria**:
- First buy always allowed
- Spacing calculated correctly for buying below average
- Spacing calculated correctly for buying above average
- Works with dynamic grid feature
- Works with consecutive incremental buy grid feature
- Backward compatible when disabled

---

### Task 1.3: Add Logging
**File**: `backend/services/dcaBacktestService.js`
**Estimated Time**: 1 hour

- [ ] Log when average-based grid is enabled (at start of backtest)
- [ ] Log average cost in daily header (verbose mode)
- [ ] Log spacing calculation details (verbose mode)
- [ ] Log grid check result: pass/fail with spacing value

**Example Log Output**:
```
Feature: Average-Based Grid Spacing = ENABLED
Average cost reference will be used for buy grid spacing.

--- 2024-01-15 ---
Price: 45.50 | Avg Cost: 50.00 | Spacing: 9.00% (below avg, need 10.00%)
  ❌ Buy grid spacing not met (avg-based)

--- 2024-01-20 ---
Price: 44.50 | Avg Cost: 50.00 | Spacing: 11.00% (below avg, need 10.00%)
  ✅ Buy grid spacing met (avg-based)
```

**Acceptance Criteria**:
- Clear indication of which mode is active
- Spacing calculations visible in verbose mode
- Easy to debug grid spacing issues

---

### Task 1.4: Unit Tests
**File**: `backend/tests/averageBasedGrid.test.js` (new file)
**Estimated Time**: 3 hours

- [ ] Test: First buy always allowed (`averageCost = 0`)
- [ ] Test: Buying below average (full spacing required)
- [ ] Test: Buying above average (half spacing required)
- [ ] Test: Exactly at average cost (edge case)
- [ ] Test: Dynamic grid interaction (grid size changes)
- [ ] Test: Consecutive incremental buy grid interaction
- [ ] Test: Backward compatibility (disabled mode matches current behavior)
- [ ] Test: Multiple buys update average cost correctly

**Example Test**:
```javascript
describe('Average-Based Grid Spacing', () => {
  test('first buy is always allowed', () => {
    const averageCost = 0;
    const currentPrice = 50;
    const gridSize = 0.10;

    const result = checkGridSpacingAgainstAverage(currentPrice, averageCost, gridSize);
    expect(result).toBe(true);
  });

  test('buying 11% below average is allowed (full spacing)', () => {
    const averageCost = 50;
    const currentPrice = 44.50;  // 11% below
    const gridSize = 0.10;

    const result = checkGridSpacingAgainstAverage(currentPrice, averageCost, gridSize);
    expect(result).toBe(true);
  });

  test('buying 6% above average is allowed (half spacing)', () => {
    const averageCost = 50;
    const currentPrice = 53;  // 6% above
    const gridSize = 0.10;  // Half spacing = 5%

    const result = checkGridSpacingAgainstAverage(currentPrice, averageCost, gridSize);
    expect(result).toBe(true);
  });
});
```

**Acceptance Criteria**:
- All tests pass
- Coverage >90% for new code
- Edge cases covered

---

### Task 1.5: Integration Tests
**File**: `backend/tests/integration/averageBasedGrid.integration.test.js` (new file)
**Estimated Time**: 2 hours

- [ ] Test: Full backtest with average-based grid enabled
- [ ] Test: Compare performance (enabled vs disabled)
- [ ] Test: Verify backward compatibility (same results when disabled)
- [ ] Test: Real portfolio scenario (single lot entry at average cost)

**Example Test**:
```javascript
describe('Average-Based Grid Integration', () => {
  test('PLTR backtest with average-based grid', async () => {
    const params = {
      symbol: 'PLTR',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      lotSizeUsd: 10000,
      maxLots: 10,
      gridIntervalPercent: 0.10,
      enableAverageBasedGrid: true
    };

    const result = await runDCABacktest(params);

    expect(result.success).toBe(true);
    expect(result.data.transactions.length).toBeGreaterThan(0);
  });

  test('backward compatibility: same results when disabled', async () => {
    const baseParams = {
      symbol: 'PLTR',
      startDate: '2024-01-01',
      endDate: '2024-06-30',
      lotSizeUsd: 10000,
      maxLots: 10
    };

    const result1 = await runDCABacktest(baseParams);
    const result2 = await runDCABacktest({
      ...baseParams,
      enableAverageBasedGrid: false
    });

    expect(result1.data.totalReturn).toBeCloseTo(result2.data.totalReturn, 2);
  });
});
```

**Acceptance Criteria**:
- Integration tests pass
- Performance is acceptable
- Backward compatibility verified

---

## Phase 2: Average-Based Sell Logic (Week 2)

### Task 2.1: Add Parameter & Validation
**File**: `backend/services/dcaBacktestService.js`
**Estimated Time**: 1 hour

- [ ] Add `enableAverageBasedSell` to parameter definition (default: `false`)
- [ ] Add JSDoc documentation
- [ ] Add validation: must be boolean
- [ ] Add validation: cannot be array in batch mode
- [ ] Update parameter summary logging

**Acceptance Criteria**:
- Same validation as average-based grid
- Independent of `enableAverageBasedGrid` (can be enabled separately)

---

### Task 2.2: Implement Sell Logic
**File**: `backend/services/dcaBacktestService.js` (lines ~944-1012)
**Estimated Time**: 4 hours

- [ ] Create helper function: `checkProfitabilityAgainstAverage(currentPrice, averageCost, profitRequirement)`
- [ ] Modify profitability check to use average cost when enabled
- [ ] Keep lot selection logic (still select highest-priced lots)
- [ ] Update limit price calculation (use average cost as reference)
- [ ] Integrate with consecutive sell profit feature
- [ ] Ensure lots are still removed from array after sell

**Code Structure**:
```javascript
function checkProfitabilityAgainstAverage(currentPrice, averageCost, profitRequirement) {
  if (averageCost === 0) {
    return false;  // No lots to sell
  }

  const profitPercent = (currentPrice - averageCost) / averageCost;
  return profitPercent >= profitRequirement;
}

// In sell logic
let eligibleLots;

if (enableAverageBasedSell) {
  // Check profitability against average cost
  const isProfitable = checkProfitabilityAgainstAverage(
    currentPrice,
    averageCost,
    lotProfitRequirement
  );

  if (isProfitable) {
    // ALL lots are eligible
    eligibleLots = [...lots];
  } else {
    eligibleLots = [];
  }
} else {
  // Existing lot-based logic
  eligibleLots = lots.filter(lot => {
    let refPrice = isConsecutiveSell ? lastSellPrice : lot.price;
    return currentPrice > refPrice * (1 + lotProfitRequirement);
  });
}

// Still select highest-priced lots (preserve FIFO behavior)
const sortedEligibleLots = eligibleLots.sort((a, b) => b.price - a.price);
const lotsToSell = sortedEligibleLots.slice(0, Math.min(maxLotsToSell, sortedEligibleLots.length));
```

**Acceptance Criteria**:
- Profitability checked against average cost
- All lots eligible when condition met
- Still select highest-priced lots for selling
- Limit price calculated correctly
- Works with consecutive sell profit feature
- Transaction history preserves lot details

---

### Task 2.3: Add Logging
**File**: `backend/services/dcaBacktestService.js`
**Estimated Time**: 1 hour

- [ ] Log when average-based sell is enabled (at start)
- [ ] Log profitability check against average cost
- [ ] Log selected lots with prices
- [ ] Show average cost reference in sell logs

**Example Log Output**:
```
Feature: Average-Based Sell Logic = ENABLED
Sell profitability will be checked against average cost.

--- 2024-01-15 ---
Price: 55.00 | Avg Cost: 50.00 | Profit: 10.00% (need 10.00%)
  ✅ Sell profitability met (avg-based)
  📤 SELL: 100 shares @ $55.00 (lot was $52.00, avg was $50.00)
```

**Acceptance Criteria**:
- Clear profitability calculations
- Average cost reference visible
- Individual lot prices still logged

---

### Task 2.4: Unit Tests
**File**: `backend/tests/averageBasedSell.test.js` (new file)
**Estimated Time**: 3 hours

- [ ] Test: Profitability check against average cost
- [ ] Test: All lots eligible when condition met
- [ ] Test: No lots eligible when condition not met
- [ ] Test: Lot selection (highest-price first)
- [ ] Test: Limit price calculation
- [ ] Test: Consecutive sell interaction (use average cost as reference)
- [ ] Test: Single lot edge case (average = lot price)
- [ ] Test: Backward compatibility

**Example Test**:
```javascript
describe('Average-Based Sell Logic', () => {
  test('all lots eligible when price is 11% above average', () => {
    const averageCost = 50;
    const currentPrice = 55.50;  // 11% above
    const profitRequirement = 0.10;

    const result = checkProfitabilityAgainstAverage(currentPrice, averageCost, profitRequirement);
    expect(result).toBe(true);
  });

  test('no lots eligible when price is only 9% above average', () => {
    const averageCost = 50;
    const currentPrice = 54.50;  // 9% above
    const profitRequirement = 0.10;

    const result = checkProfitabilityAgainstAverage(currentPrice, averageCost, profitRequirement);
    expect(result).toBe(false);
  });

  test('selects highest-priced lots first', () => {
    const lots = [
      { price: 50, shares: 100 },
      { price: 45, shares: 100 },
      { price: 52, shares: 100 }
    ];

    const sortedLots = lots.sort((a, b) => b.price - a.price);
    expect(sortedLots[0].price).toBe(52);
    expect(sortedLots[1].price).toBe(50);
    expect(sortedLots[2].price).toBe(45);
  });
});
```

**Acceptance Criteria**:
- All tests pass
- Coverage >90%
- Edge cases covered

---

### Task 2.5: Integration Tests
**File**: `backend/tests/integration/averageBasedSell.integration.test.js` (new file)
**Estimated Time**: 2 hours

- [ ] Test: Full backtest with average-based sell enabled
- [ ] Test: Compare with lot-based sell
- [ ] Test: Real portfolio scenario (single lot entry)
- [ ] Test: Both features enabled (grid + sell)

**Example Test**:
```javascript
describe('Average-Based Sell Integration', () => {
  test('PLTR backtest with average-based sell', async () => {
    const params = {
      symbol: 'PLTR',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      lotSizeUsd: 10000,
      maxLots: 10,
      profitRequirement: 0.10,
      enableAverageBasedSell: true
    };

    const result = await runDCABacktest(params);

    expect(result.success).toBe(true);
    expect(result.data.transactions.filter(t => t.type === 'sell').length).toBeGreaterThan(0);
  });

  test('both features enabled work together', async () => {
    const params = {
      symbol: 'PLTR',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      lotSizeUsd: 10000,
      maxLots: 10,
      enableAverageBasedGrid: true,
      enableAverageBasedSell: true
    };

    const result = await runDCABacktest(params);

    expect(result.success).toBe(true);
    expect(result.data.totalReturn).toBeDefined();
  });
});
```

**Acceptance Criteria**:
- Integration tests pass
- Features work independently and together
- Transaction history is accurate

---

## Phase 3: Frontend & Documentation (Week 3)

### Task 3.1: API Documentation
**File**: API documentation (e.g., `docs/api.md`)
**Estimated Time**: 2 hours

- [ ] Document `enableAverageBasedGrid` parameter
- [ ] Document `enableAverageBasedSell` parameter
- [ ] Document default values and types
- [ ] Document batch mode restrictions
- [ ] Add examples with curl commands

**Example**:
```markdown
### POST /api/backtest/dca

#### New Parameters (Spec 23)

**enableAverageBasedGrid** (boolean, default: false)
- Use average cost for buy grid spacing instead of individual lot prices
- Simplifies grid logic and improves performance
- Cannot be array in batch mode

**enableAverageBasedSell** (boolean, default: false)
- Use average cost for sell profitability checks
- Matches broker's tracking method
- Cannot be array in batch mode

#### Example Request
```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "enableAverageBasedGrid": true,
    "enableAverageBasedSell": true
  }'
```
```

**Acceptance Criteria**:
- Complete API documentation
- Working curl examples
- Clear parameter descriptions

---

### Task 3.2: Frontend UI
**File**: `frontend/src/components/BacktestParameters.jsx` (or similar)
**Estimated Time**: 3 hours

- [ ] Add checkbox: "Enable Average-Based Grid Spacing"
- [ ] Add checkbox: "Enable Average-Based Sell Logic"
- [ ] Add tooltips with explanations
- [ ] Add section: "Position Tracking Mode"
- [ ] Update batch test UI (ensure no arrays for these params)

**Example UI**:
```jsx
<div className="parameter-group">
  <h3>Position Tracking Mode</h3>

  <div className="checkbox-group">
    <input
      type="checkbox"
      id="enableAverageBasedGrid"
      checked={params.enableAverageBasedGrid || false}
      onChange={(e) => setParams({
        ...params,
        enableAverageBasedGrid: e.target.checked
      })}
    />
    <label htmlFor="enableAverageBasedGrid">
      Enable Average-Based Grid Spacing
      <Tooltip>
        Use average cost as reference for buy grid spacing instead of
        checking against every individual lot. Simplifies logic and
        improves performance. Recommended for real portfolios where
        only average cost is known.
      </Tooltip>
    </label>
  </div>

  <div className="checkbox-group">
    <input
      type="checkbox"
      id="enableAverageBasedSell"
      checked={params.enableAverageBasedSell || false}
      onChange={(e) => setParams({
        ...params,
        enableAverageBasedSell: e.target.checked
      })}
    />
    <label htmlFor="enableAverageBasedSell">
      Enable Average-Based Sell Logic
      <Tooltip>
        Check sell profitability against average cost instead of
        individual lot prices. Matches broker's tracking method.
        Recommended for real portfolios.
      </Tooltip>
    </label>
  </div>
</div>
```

**Acceptance Criteria**:
- Checkboxes work correctly
- Tooltips are informative
- UI is intuitive
- Batch mode validation works

---

### Task 3.3: User Documentation
**File**: `docs/average-cost-features.md` (new file)
**Estimated Time**: 3 hours

- [ ] Write user guide: What are these features?
- [ ] Write user guide: When to use each feature?
- [ ] Write user guide: How to enable/disable?
- [ ] Add examples: Before/after comparisons
- [ ] Add real portfolio management guide
- [ ] Add performance comparison data

**Sections**:
1. **Overview**: What are average-based features?
2. **Use Cases**: When should I use these?
3. **Feature #1**: Average-Based Grid Spacing
4. **Feature #2**: Average-Based Sell Logic
5. **Real Portfolio Management**: How to import existing positions
6. **Performance**: Speed improvements
7. **Examples**: Side-by-side comparisons
8. **FAQ**: Common questions

**Acceptance Criteria**:
- Complete user guide
- Clear examples
- Covers all use cases

---

### Task 3.4: Developer Documentation
**File**: `docs/dev/average-cost-implementation.md` (new file)
**Estimated Time**: 2 hours

- [ ] Document implementation details
- [ ] Document integration with other features
- [ ] Document edge cases and handling
- [ ] Document testing strategy
- [ ] Add code examples

**Acceptance Criteria**:
- Developers can understand the implementation
- Future maintainers can modify safely
- Edge cases documented

---

## Phase 4: Validation & Rollout

### Task 4.1: Backward Compatibility Validation
**File**: `backend/tests/backwardCompatibility.test.js`
**Estimated Time**: 2 hours

- [ ] Run entire existing test suite
- [ ] Verify 0 differences when features disabled
- [ ] Create automated regression test
- [ ] Test with multiple symbols (PLTR, TSLA, AAPL)

**Acceptance Criteria**:
- All existing tests pass
- No regressions detected
- Results identical when disabled

---

### Task 4.2: Performance Benchmarks
**File**: `backend/benchmarks/averageCostFeatures.benchmark.js` (new file)
**Estimated Time**: 3 hours

- [ ] Benchmark baseline (features disabled)
- [ ] Benchmark with average-based grid enabled
- [ ] Benchmark with average-based sell enabled
- [ ] Benchmark with both enabled
- [ ] Verify <5% overhead when disabled
- [ ] Verify 5-10% speedup with average grid
- [ ] Create performance report

**Example Benchmark**:
```javascript
describe('Performance Benchmarks', () => {
  test('average-based grid provides 5-10% speedup', async () => {
    const params = {
      symbol: 'PLTR',
      startDate: '2021-01-01',
      endDate: '2024-12-31',
      lotSizeUsd: 10000,
      maxLots: 10
    };

    const start1 = Date.now();
    await runDCABacktest({ ...params, enableAverageBasedGrid: false });
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    await runDCABacktest({ ...params, enableAverageBasedGrid: true });
    const time2 = Date.now() - start2;

    const speedup = (time1 - time2) / time1;
    expect(speedup).toBeGreaterThan(0.05);  // At least 5% faster
  });
});
```

**Acceptance Criteria**:
- Benchmarks complete
- Performance targets met
- Report generated

---

### Task 4.3: Beta Testing
**Duration**: 1 week
**Estimated Time**: Ongoing monitoring

- [ ] Deploy to staging environment
- [ ] Invite 5-10 beta testers
- [ ] Collect feedback
- [ ] Monitor for bugs
- [ ] Fix critical issues
- [ ] Iterate on UX based on feedback

**Acceptance Criteria**:
- Beta testers can use features
- No critical bugs reported
- Feedback incorporated

---

### Task 4.4: Production Deployment
**Estimated Time**: 2 hours

- [ ] Create deployment checklist
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Monitor error logs (first 24 hours)
- [ ] Monitor performance metrics
- [ ] Create support documentation for issues

**Acceptance Criteria**:
- Successful deployment
- No errors in production
- Performance acceptable
- Support ready

---

## Risk Mitigation

### High Risk Items

**1. Backward Compatibility Break**
- **Mitigation**: Extensive regression testing (Task 4.1)
- **Fallback**: Feature flags to disable remotely
- **Monitoring**: Automated tests on every commit

**2. Performance Degradation**
- **Mitigation**: Performance benchmarks (Task 4.2)
- **Fallback**: Optimize hot paths
- **Monitoring**: Performance alerts in production

### Medium Risk Items

**3. Consecutive Feature Interactions**
- **Mitigation**: Explicit interaction handling (Tasks 1.2, 2.2)
- **Fallback**: Document limitations
- **Monitoring**: Integration tests

**4. Transaction History Accuracy**
- **Mitigation**: Keep internal lot tracking (Task 2.2)
- **Fallback**: Add warnings to users
- **Monitoring**: Audit transaction logs

### Low Risk Items

**5. UI/UX Issues**
- **Mitigation**: Beta testing (Task 4.3)
- **Fallback**: Iterate based on feedback
- **Monitoring**: User feedback collection

---

## Success Criteria

### Must Have (P0)
- ✅ Both features implemented and tested
- ✅ Backward compatibility: 0 differences when disabled
- ✅ No performance degradation (<5% overhead)
- ✅ UI controls for both parameters
- ✅ Complete documentation

### Should Have (P1)
- ✅ Performance improvement (5-10% with average grid)
- ✅ Beta tested by 5+ users
- ✅ Comprehensive examples and guides
- ✅ Real portfolio import guide

### Nice to Have (P2)
- ⭕ Real portfolio import UI (future enhancement)
- ⭕ Performance comparison tool
- ⭕ Advanced lot selection strategies

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Average Grid | Week 1 | Grid spacing with average cost |
| Phase 2: Average Sell | Week 2 | Sell logic with average cost |
| Phase 3: UI & Docs | Week 3 | Complete user-facing features |
| Phase 4: Validation | Ongoing | Testing, beta, deployment |
| **Total** | **3 weeks** | **Production-ready features** |

---

## Dependencies

### Internal
- Current DCA backtest service (stable)
- Frontend parameter UI (requires updates)
- Batch test infrastructure (requires validation updates)

### External
- None (all internal changes)

### Team
- Product Owner: Review specifications
- QA: Test all scenarios
- DevOps: Deploy staging for beta

---

## Open Questions (for Product Owner)

1. **Asymmetric Spacing**: Confirmed half spacing (5%) when buying above average?
2. **Lot Selection**: Keep highest-price first (current) or change to FIFO?
3. **Consecutive Feature Priority**: Confirmed average-based uses average cost reference but applies incremental sizing?

**Recommendation**: Resolve before starting Phase 1 (Task 1.2).
