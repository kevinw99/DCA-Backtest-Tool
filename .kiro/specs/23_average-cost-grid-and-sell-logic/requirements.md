# Spec 23: Average-Cost Grid & Sell Logic - Requirements

## Overview
Enable the DCA algorithm to use average cost as the reference for grid spacing and sell profitability checks, instead of tracking individual lot prices. This simplifies the algorithm and enables real-world portfolio management where only average cost is known.

## Motivation

### Primary Goal
**Real Portfolio Management**: Enable the algo to manage real stock portfolios where individual lot prices may not be tracked by the broker, only average cost is available.

### Secondary Goals
1. **Simplified Logic**: Reduce complexity by checking against single reference point (average cost) instead of all individual lots
2. **Performance**: Reduce grid spacing checks from O(n) to O(1)
3. **Backward Compatibility**: Preserve existing behavior as default, allow opt-in to new features

## Scope

### In Scope (This Spec)
- ✅ **Feature #1**: Average-based grid spacing for buy logic
- ✅ **Feature #2**: Average-based sell profitability logic
- ✅ Backward compatibility with existing features
- ✅ Integration with consecutive incremental features
- ✅ Real portfolio management use case
- ✅ UI controls and documentation

### Out of Scope (Separate Spec 24)
- ❌ **Feature #3**: Dynamic profile switching (P/L-based strategy adjustment)
- ❌ Adaptive strategy enhancements
- ❌ Technical indicator-based switching

**Rationale**: Features #1 and #2 are tightly coupled (both about position tracking), while feature #3 is independent (about strategy adjustment). Separating allows faster delivery of real portfolio management capability.

## Requirements

### Feature #1: Average-Based Grid Spacing

**User Story**: As a trader, I want buy grid spacing checked against my average cost, so that I can use a simpler position tracking model.

#### Current Behavior
```javascript
// Check spacing against EVERY lot
lots.every((lot) => {
  const spacing = Math.abs(currentPrice - lot.price) / lot.price;
  return spacing >= gridIntervalPercent;  // Must be true for ALL lots
});
```

**Problem**: With 10 lots, that's 10 checks. Complex and slow.

#### Proposed Behavior
```javascript
// Check spacing against average cost ONLY
const spacing = Math.abs(currentPrice - averageCost) / averageCost;
const respectsGridSpacing = spacing >= gridIntervalPercent;  // Single check
```

**Benefit**: O(1) instead of O(n). Simpler logic.

#### Acceptance Criteria
1. When `enableAverageBasedGrid = true`:
   - New buy must be >= `gridIntervalPercent` away from `averageCost`
   - First buy is always allowed (when `lots.length = 0`)
   - Spacing calculation handles `averageCost = 0` edge case
2. When `enableAverageBasedGrid = false`:
   - Current lot-based behavior is preserved (backward compatible)
3. Works with dynamic grid feature
4. Works with consecutive incremental buy grid feature
5. Logging shows which mode is active

#### Open Questions
1. **Symmetric vs Asymmetric Spacing**:
   - Should buying ABOVE average cost require full spacing (10%) or half spacing (5%)?
   - Buying below average (averaging down): definitely require full spacing
   - **DECISION**: Full spacing for both (symmetric) - simpler and more consistent

2. **Consecutive Buy Grid Interaction**:
   - When both `enableAverageBasedGrid` and `enableConsecutiveIncrementalBuyGrid` are true
   - Should incremental grid size be applied to average cost spacing?
   - **DECISION**: Yes - use average cost as reference, apply incremental sizing

---

### Feature #2: Average-Based Sell Logic

**User Story**: As a portfolio manager, I want sell profitability checked against my average cost, so that I match my broker's tracking method.

#### Current Behavior
```javascript
// Filter lots by individual profitability
const eligibleLots = lots.filter(lot => {
  return currentPrice > lot.price * (1 + profitRequirement);
});

// Sell highest-priced eligible lots
const lotsToSell = eligibleLots.sort((a, b) => b.price - a.price)
  .slice(0, maxLotsToSell);
```

**Issue**: Requires knowing individual lot prices. Real brokers often only show average cost.

#### Proposed Behavior
```javascript
// Check profitability against average cost
const isProfitable = currentPrice > averageCost * (1 + profitRequirement);

if (isProfitable) {
  // ALL lots are eligible
  // Still select highest-priced lots to sell (preserve FIFO behavior)
  const lotsToSell = lots.sort((a, b) => b.price - a.price)
    .slice(0, maxLotsToSell);
}
```

**Key Point**: We check profitability against average cost, but still track and select specific lots internally. This preserves transaction history detail.

#### Acceptance Criteria
1. When `enableAverageBasedSell = true`:
   - Profitability check: `currentPrice > averageCost * (1 + profitRequirement)`
   - All lots become eligible if condition is true
   - Still select highest-priced lots for actual selling (FIFO at highest)
   - Limit price: `max(averageCost * (1 + profitRequirement), stopPrice * 0.95)`
2. When `enableAverageBasedSell = false`:
   - Current lot-based behavior is preserved
3. Works with consecutive incremental sell profit feature
4. Transaction history still shows individual lot details
5. Logging shows average cost reference

#### Open Questions
1. **Lot Selection Method**:
   - Keep highest-price first (current behavior)?
   - Change to lowest-price first (true FIFO)?
   - **Recommendation**: Keep highest-price first (preserves existing behavior)

2. **Consecutive Sell Interaction**:
   - Current consecutive sell uses `lastSellPrice` as reference
   - With average-based sell, should we use `averageCost` or `lastSellPrice`?
   - **Recommendation**: Always use `averageCost` (that's the point of the feature)

---

## User Stories

### US-23.1: Real Portfolio Management
**As a** real portfolio manager
**I want to** track only average cost, not individual lot prices
**So that** the algo matches my broker's position tracking

**Acceptance Criteria**:
- Can enable average-based grid without breaking existing backtests
- Can enable average-based sell independently
- Average cost updates correctly after each buy/sell
- Grid spacing works with average cost reference
- Sell profitability works with average cost reference

**Test Scenario**:
```
1. User has 100 shares @ average cost $50 (from broker)
2. User inputs position as single lot: { price: 50, shares: 100, date: '2024-01-01' }
3. Enable both average-based features
4. Price drops to $45 → Algorithm can buy (10% below average)
5. Price rises to $55 → Algorithm can sell (10% above average)
6. Transaction log shows accurate history
```

### US-23.2: Performance Testing
**As an** algo developer
**I want to** test average-based logic vs lot-based logic
**So that** I can compare performance and choose the better approach

**Acceptance Criteria**:
- Can run same backtest with both modes
- Results are comparable
- Performance difference is measurable
- Can compare in batch mode

### US-23.3: Simplified Backtesting
**As a** trader
**I want** faster backtests with simpler logic
**So that** I can iterate on parameter optimization more quickly

**Acceptance Criteria**:
- Average-based grid provides 5-10% speedup
- Logic is simpler to understand
- Transaction logs are still detailed

---

## Parameters

### New Parameters

#### `enableAverageBasedGrid` (boolean)
- **Default**: `false` (backward compatible)
- **UI**: Checkbox in "Advanced Grid Options" section
- **Description**: "Use average cost for grid spacing instead of individual lot prices"
- **Batch Mode**: Supported - can test `[true, false]`
- **Tooltip**: "Simplifies grid logic and improves performance. Use with real portfolios where only average cost is known."

#### `enableAverageBasedSell` (boolean)
- **Default**: `false` (backward compatible)
- **UI**: Checkbox in "Advanced Sell Options" section
- **Description**: "Use average cost for sell profitability instead of individual lot prices"
- **Batch Mode**: Supported - can test `[true, false]`
- **Tooltip**: "Check profitability against average cost. Use with real portfolios where only average cost is known."

### Parameter Independence
- `enableAverageBasedGrid` can be `true` while `enableAverageBasedSell` is `false` (and vice versa)
- Both can be `false` (current behavior)
- Both can be `true` (full average-cost mode)

---

## Edge Cases

### Edge Case 1: First Buy
**Scenario**: `averageCost = 0`, `lots.length = 0`
**Issue**: Division by zero in spacing calculation
**Solution**: Always allow first buy
```javascript
if (lots.length === 0) {
  return true; // Skip grid spacing check for first buy
}
```

### Edge Case 2: Buying Above Average Cost
**Scenario**: Current position @ $50 average, price rises to $60
**Question**: Should we allow buying at $60?
**Answer**: Yes, but requires full spacing (10%) same as buying below
**Rationale**: Symmetric spacing is simpler and more consistent

### Edge Case 3: Single Lot Position
**Scenario**: User has 1 lot @ $50
**Behavior**: `averageCost = $50 = lot.price`
**Result**: Average-based and lot-based produce identical results ✓

### Edge Case 4: Consecutive Buy Grid Enabled
**Scenario**: Both `enableAverageBasedGrid` and `enableConsecutiveIncrementalBuyGrid` are `true`
**Issue**: Both features want to control grid spacing
**Solution**: Use average cost as reference, apply incremental grid size
```javascript
const gridSize = enableConsecutiveIncrementalBuyGrid
  ? calculateBuyGridSize(/* ... */)
  : gridIntervalPercent;
const spacing = Math.abs(currentPrice - averageCost) / averageCost;
return spacing >= gridSize;
```

### Edge Case 5: Consecutive Sell Profit Enabled
**Scenario**: Both `enableAverageBasedSell` and `enableConsecutiveIncrementalSellProfit` are `true`
**Issue**: Consecutive sell uses `lastSellPrice`, average sell uses `averageCost`
**Solution**: Always use `averageCost` as reference, but apply incremental profit requirement
```javascript
const refPrice = enableAverageBasedSell ? averageCost : (isConsecutiveSell ? lastSellPrice : lot.price);
const lotProfitRequirement = isConsecutiveSell
  ? profitRequirement + (consecutiveSellCount * (profitRequirement * 0.1))
  : profitRequirement;
const isProfitable = currentPrice > refPrice * (1 + lotProfitRequirement);
```

---

## Success Metrics

### Functional
- ✅ All existing backtests produce identical results when features are disabled
- ✅ Average-based features produce reasonable results when enabled
- ✅ Grid spacing reduces from O(n) to O(1)
- ✅ No breaking changes to API or UI

### Performance
- ✅ <5% overhead when features disabled (backward compat cost)
- ✅ 5-10% speedup when average-based grid enabled
- ✅ No memory increase

### Quality
- ✅ Test coverage: >90% for new code
- ✅ All edge cases have unit tests
- ✅ Integration tests with real portfolio scenarios
- ✅ Documentation complete with examples

---

## Dependencies

### Internal Dependencies
- Current DCA backtest service (stable)
- `averageCost` variable (already exists and is maintained)
- Frontend parameter UI (needs checkboxes added)
- Batch test infrastructure (needs parameter validation)

### No External Dependencies
All changes are internal to the application.

---

## Non-Goals (Deferred to Spec 24)

These are explicitly OUT OF SCOPE for this spec:
- ❌ Dynamic profile switching based on P/L
- ❌ Conservative/Aggressive profile definitions
- ❌ Automatic strategy parameter adjustment
- ❌ Profile switching UI and metrics

**Rationale**: Feature #3 (dynamic profiles) is independent of #1 and #2. Separating allows:
1. Faster delivery of real portfolio management (3 weeks instead of 6)
2. Independent testing and validation
3. Cleaner code reviews
4. Easier rollback if one feature has issues

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Average Grid | 1 week | Grid spacing with average cost |
| Phase 2: Average Sell | 1 week | Sell logic with average cost |
| Phase 3: Integration & Testing | 1 week | Full testing, docs, UI |
| **Total** | **3 weeks** | Production-ready features #1 & #2 |

---

## Open Questions - RESOLVED

1. **Asymmetric Spacing**: Half spacing (5%) or full spacing (10%) when buying above average cost?
   - **DECISION**: Full spacing (10%) for both above and below - symmetric is simpler

2. **Lot Selection**: Keep highest-price first or change to lowest-price first?
   - **DECISION**: Keep highest-price first (no breaking changes)

3. **Consecutive Feature Priority**: Average-based or consecutive incremental takes precedence?
   - **DECISION**: Average-based uses average cost reference, but applies incremental sizing
