# Spec 24: Dynamic Profile Switching - Requirements

## Overview
Enable the DCA algorithm to automatically adjust strategy parameters based on **position status** (from Spec 26). When in a losing position, switch to a Conservative profile (preserve capital). When in a winning position, switch to an Aggressive profile (maximize gains).

## Motivation

### Primary Goal
**Automatic Risk Management**: Reduce drawdowns by automatically becoming defensive when in losing positions, and maximize gains by becoming aggressive when in winning positions.

### Key Insight
The algorithm should "change its personality" based on position status (Spec 26):
- **Losing Position**: Be cautious - make buying harder, selling easier
- **Winning Position**: Be bold - make buying easier, selling harder
- **Neutral Position**: No profile change (maintain current profile)

## Scope

### In Scope (This Spec)
- ✅ **Feature #3**: Position status-based profile switching (integrates with Spec 26)
- ✅ Conservative profile definition (preserve capital)
- ✅ Aggressive profile definition (maximize gains)
- ✅ Switching logic with hysteresis (prevent thrashing)
- ✅ Profile metrics and logging
- ✅ UI controls and documentation

### Out of Scope (Future Enhancements)
- ❌ Multiple profile definitions (only Conservative/Aggressive in Phase 1)
- ❌ Technical indicator-based switching (MA, RSI, etc.)
- ❌ Machine learning-based profile selection
- ❌ Custom user-defined profiles

### Prerequisites
- None - this spec is independent of Spec 23
- Can be implemented before or after Spec 23
- Can be used with or without average-cost features

## Requirements

### Feature: Position Status-Based Profile Switching

**User Story**: As a trader, I want the algorithm to automatically adjust its aggressiveness based on my position status (from Spec 26), so that I preserve capital when in losing positions and maximize gains when in winning positions.

#### Profile Definitions

**Conservative Profile** (active when Position Status = LOSING):
- **Goal**: Preserve capital, reduce risk, easier to exit positions
- **Behavior**: Make buying harder (wait for bigger dips), sell more easily
- **Trigger**: Position status = LOSING for 3+ consecutive days
- **Parameter Overrides**:
  - `trailingBuyActivationPercent = 20%` (harder to buy - wait for 20% drop)
  - `trailingSellActivationPercent = 0%` (easier to sell - no activation needed)
  - `profitRequirement = 0%` (easier to sell - no profit requirement)
- **All other parameters**: Keep user-specified values

**Aggressive Profile** (active when Position Status = WINNING):
- **Goal**: Maximize gains, hold winners, accumulate more
- **Behavior**: Make buying easier (accumulate winners), sell only at good profits
- **Trigger**: Position status = WINNING for 3+ consecutive days
- **Parameter Overrides**:
  - `trailingBuyActivationPercent = 0%` (easier to buy - accumulate winners)
  - `trailingSellActivationPercent = 20%` (harder to sell - wait for 20% gain from peak)
  - `profitRequirement = 10%` (only sell at +10% profit)
- **All other parameters**: Keep user-specified values

#### Switching Logic

```
// Position status is calculated by Spec 26
Position Status = calculatePositionStatus(lots, currentPrice, positionThreshold)
// Returns 'winning', 'losing', or 'neutral'

At start of each trading day:
  IF Position Status == 'losing' AND current profile != CONSERVATIVE:
    IF Position Status has been 'losing' for >= 3 consecutive days:  // Hysteresis
      Switch to CONSERVATIVE
      Log switch with position status and P/L amount
      Apply parameter overrides

  ELSE IF Position Status == 'winning' AND current profile != AGGRESSIVE:
    IF Position Status has been 'winning' for >= 3 consecutive days:  // Hysteresis
      Switch to AGGRESSIVE
      Log switch with position status and P/L amount
      Apply parameter overrides

  // Note: 'neutral' position status does not trigger profile changes
```

**Key Points**:
1. **Uses Position Status from Spec 26** (winning/losing/neutral based on unrealized P/L threshold)
2. Check happens at **start of each day** (before any trading)
3. **Hysteresis**: Require 3 consecutive days in same position status before switching
4. **Neutral position**: Does NOT trigger profile changes (maintains current profile)
5. **Overrides 3 parameters**: Buy activation %, sell activation %, profit requirement
6. **All other parameters preserved**: Grid spacing, rebound percentages, etc.

#### Acceptance Criteria

1. When `enableDynamicProfile = true`:
   - Profile is determined at start of each day based on **Position Status** (Spec 26)
   - Hysteresis prevents switching on single-day fluctuations (require 3 consecutive days)
   - Parameter overrides are applied when profile switches
   - Original parameters are restored when feature is disabled
   - Profile switches are logged in transaction log with position status
   - Profile metrics are included in results summary

2. When `enableDynamicProfile = false`:
   - Current behavior preserved (backward compatible)
   - No profile switching occurs
   - User parameters are used as-is

3. Active trailing stops:
   - ARE UPDATED when profile switches (honor new profile immediately)
   - Trailing buy stops: Recalculate with new `trailingBuyActivationPercent`
   - Trailing sell stops: Recalculate with new `profitRequirement`
   - Log all order updates with old and new parameters for debugging

4. Works with all other features:
   - Compatible with average-based grid/sell (Spec 23)
   - Compatible with consecutive incremental features
   - Compatible with dynamic grid

5. Batch mode:
   - Single boolean parameter (not an array)
   - Either test with profile switching or without
   - Cannot sweep profile switching like other parameters

---

## User Stories

### US-24.1: Automatic Risk Management
**As a** trader
**I want** the algorithm to automatically reduce risk when I'm losing
**So that** I preserve capital during drawdowns

**Scenario**:
```
Starting: $100,000, Lot size: $1,000, Position threshold: $100 (10% of lot)
Day 1-10: Position = WINNING (P/L > +$100) → Aggressive profile active
  - Buys activate immediately (0% drop requirement)
  - Sells require 20% from peak, 10% profit
  - Accumulating winner

Day 11: Position = LOSING (P/L < -$100) → Still Aggressive (need 3 days)
Day 12: Position = LOSING → Still Aggressive (need 3 days)
Day 13: Position = LOSING → Switch to Conservative (3 days losing)
  - Now requires 20% drop before buy activates
  - Sells with no activation, no profit requirement (easier exit)
  - Defensive mode to preserve capital

Day 20: Position = WINNING (P/L > +$100) → Still Conservative (need 3 days)
Day 21: Position = WINNING → Still Conservative (need 3 days)
Day 22: Position = WINNING → Switch to Aggressive (3 days winning)
```

**Acceptance Criteria**:
- ✅ Profile switches to Conservative after 3 days in LOSING position
- ✅ Profile switches back to Aggressive after 3 days in WINNING position
- ✅ Hysteresis prevents thrashing on daily position status fluctuations
- ✅ All switches are logged with position status and P/L amounts

### US-24.2: Performance Comparison
**As an** algo developer
**I want to** compare performance with and without dynamic profiles
**So that** I can validate the feature improves results

**Acceptance Criteria**:
- Can run same backtest twice (with/without feature)
- Profile metrics show time spent in each profile
- Can analyze impact of profile switching on drawdown and returns

### US-24.3: Observability
**As a** trader
**I want to** see when and why profile switches occurred
**So that** I understand the algorithm's behavior

**Acceptance Criteria**:
- Transaction log shows profile switches with dates and P/L
- Results summary includes profile metrics
- Can see how many times profiles switched
- Can see total days in each profile

---

## Parameters

### New Parameter

#### `enableDynamicProfile` (boolean)
- **Default**: `false` (backward compatible)
- **UI**: Checkbox in "Strategy Options" section
- **Description**: "Automatically switch between Conservative and Aggressive profiles based on position status (Spec 26)"
- **Batch Mode**: Single boolean only (NOT an array)
- **Tooltip**: "Conservative when in LOSING position: harder to buy (20% drop), easier to sell (no activation, no profit req). Aggressive when in WINNING position: easier to buy (immediate), harder to sell (20% from peak, 10% profit req). Requires 3 consecutive days in same position status before switching."

### Configuration Constants

These are hardcoded in Phase 1 (not user-configurable):

```javascript
const HYSTERESIS_DAYS = 3;  // Require 3 consecutive days before switching

const PROFILES = {
  CONSERVATIVE: {
    name: 'Conservative',
    description: 'Preserve capital when in losing position',
    trigger: 'Position status = LOSING for 3+ consecutive days',
    overrides: {
      trailingBuyActivationPercent: 0.20,  // 20% - harder to buy
      trailingSellActivationPercent: 0.00, // 0% - easier to sell
      profitRequirement: 0.00              // 0% - easier to sell
    },
    color: 'blue'
  },

  AGGRESSIVE: {
    name: 'Aggressive',
    description: 'Maximize gains when in winning position',
    trigger: 'Position status = WINNING for 3+ consecutive days',
    overrides: {
      trailingBuyActivationPercent: 0.00,  // 0% - easier to buy
      trailingSellActivationPercent: 0.20, // 20% - harder to sell
      profitRequirement: 0.10              // 10% - harder to sell
    },
    color: 'green'
  }
};
```

**Future Enhancement**: Make these user-configurable (Phase 2)

**Note**: Position status thresholds are defined in Spec 26 (typically 10% of lot size)

---

## Edge Cases

### Edge Case 1: Starting Profile (Day 1)
**Scenario**: First day of backtest, no positions yet
**Issue**: What profile should be active?
**Solution**: Start with NULL profile, determine on Day 1 based on position status (usually neutral → no profile)

### Edge Case 2: Position Status Oscillating (Volatile Market)
**Scenario**: Position status fluctuates between winning/losing/neutral
```
Day 1: Position = neutral → No profile active
Day 2: Position = winning → Start counting (1 day)
Day 3: Position = winning → Continue (2 days)
Day 4: Position = neutral  → Reset counter, back to no profile
Day 5: Position = losing   → Start counting (1 day)
Day 6: Position = losing   → Continue (2 days)
Day 7: Position = neutral  → Reset counter, back to no profile
```
**Solution**: Hysteresis prevents switching. Need 3 CONSECUTIVE days in same status.

### Edge Case 3: Active Trailing Stop When Profile Switches
**Scenario**:
- Aggressive profile: Trailing buy stop active (0% activation)
- Profile switches to Conservative (10% activation requirement)
- Question: Should we keep old stop or update to new parameters?

**Solution**: UPDATE active stops to honor new profile immediately
- **Rationale**: If we're switching to Conservative because we're losing money, we MUST honor the new risk management parameters
- **Implementation**:
  1. When profile switches, check for active trailing stops
  2. Recalculate stop prices/thresholds with new parameters
  3. Update the active stop orders
  4. Log the updates with old and new values for debugging

**Example**:
```
Switching to CONSERVATIVE profile (Unrealized P/L: -$2,500)

Active Trailing Buy Stop:
  OLD: Activation = 0%, Stop Price = $45.00
  NEW: Activation = 10%, Stop Price = $40.50 (10% below current peak)
  STATUS: Updated to honor Conservative parameters

Active Trailing Sell Stop:
  OLD: Profit Req = 10%, Stop Price = $55.00
  NEW: Profit Req = -10%, Stop Price = $45.00 (cut loss at -10%)
  STATUS: Updated to honor Conservative parameters
```

### Edge Case 4: Batch Mode with Dynamic Profile
**Scenario**: User tries to pass `enableDynamicProfile: [true, false]` in batch
**Solution**: Reject with validation error - must be single boolean

### Edge Case 5: User Sets Profit Requirement = 20%
**Scenario**: User wants 20% profit, but profile overrides to -10% or 10%
**Question**: Should we honor user's preference?
**Answer**: No - profile overrides user settings (that's the point). User's 20% is ignored when profile is active.
**Mitigation**: Document clearly in UI tooltip

### Edge Case 6: Zero-Length Hysteresis (Immediate Switching)
**Future Enhancement**: Allow `HYSTERESIS_DAYS = 0` for testing
**Current**: Hardcoded to 3 days
**Behavior**: Profile can switch every day if P/L crosses 0
**Risk**: Thrashing, poor performance
**Recommendation**: Keep 3-day minimum for Phase 1

---

## Success Metrics

### Functional
- ✅ Profile switches occur at correct times (3-day hysteresis)
- ✅ Parameter overrides are applied correctly
- ✅ Transaction log shows all switches
- ✅ Metrics calculation is accurate
- ✅ Backward compatibility preserved when disabled

### Performance
- ✅ No performance degradation (<1% overhead)
- ✅ Switching logic is fast (<1ms per day)

### Quality
- ✅ Test coverage: >90% for new code
- ✅ All edge cases have unit tests
- ✅ Integration tests with real backtests
- ✅ Documentation complete with examples

### Business Value
- ✅ Reduces max drawdown by 10%+ in volatile markets (target)
- ✅ Maintains or improves total return
- ✅ Sharpe ratio improves (better risk-adjusted returns)

---

## Dependencies

### Internal Dependencies
- Current DCA backtest service (stable)
- Unrealized P/L calculation (already exists in service)
- `maxLotsToSell` parameter (already exists, will be overridden)
- Frontend parameter UI (needs checkbox added)
- Batch test infrastructure (needs validation updated)

### No External Dependencies
All changes are internal to the application.

---

## Non-Goals (Deferred to Future)

These are explicitly OUT OF SCOPE for Phase 1:
- ❌ User-configurable profiles (hardcoded Conservative/Aggressive)
- ❌ More than 2 profiles (future: Neutral, Very Conservative, etc.)
- ❌ Configurable hysteresis days (hardcoded to 3)
- ❌ Technical indicator-based switching (MA, RSI, etc.)
- ❌ Different profile parameters (future: also override grid spacing, other trailing %)
- ❌ Profile backtesting comparison tool
- ❌ ML-based profile prediction
- ❌ Combining realized + unrealized P/L for switching (Phase 1 uses unrealized only)

**Rationale**: Start simple, validate the concept, then enhance based on results.

---

## Interaction with Spec 23

### Independent Features
- Dynamic profiles (Spec 24) and average-cost features (Spec 23) are **fully independent**
- Can enable one, both, or neither
- No conflicts or dependencies

### Recommended Combinations

**Combo A: Dynamic + Average-Cost**
```javascript
enableDynamicProfile: true
enableAverageBasedGrid: true
enableAverageBasedSell: true
```
**Use Case**: Real portfolio with automatic risk adjustment
**Benefit**: Best of both worlds

**Combo B: Dynamic Only**
```javascript
enableDynamicProfile: true
enableAverageBasedGrid: false
enableAverageBasedSell: false
```
**Use Case**: Testing profile switching with lot-based tracking
**Benefit**: Isolate profile switching impact

**Combo C: Average-Cost Only**
```javascript
enableDynamicProfile: false
enableAverageBasedGrid: true
enableAverageBasedSell: true
```
**Use Case**: Real portfolio with manual risk management
**Benefit**: Simplified tracking without auto-adjustment

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Core Logic | 1 week | Profile determination & switching |
| Phase 2: Metrics & Logging | 1 week | Transaction logs, metrics calculation |
| Phase 3: Integration & Testing | 1 week | Full testing, docs, UI |
| **Total** | **3 weeks** | Production-ready feature #3 |

**Note**: Can start after Spec 23 is complete, or in parallel if resources allow.

---

## Open Questions

1. **Hysteresis Duration**: 3 days, 5 days, or user-configurable?
   - **Recommendation**: 3 days (good balance, proven in similar systems)

2. **Active Order Handling**: Cancel or update when profile switches?
   - **DECISION**: Update active stops to honor new profile immediately (critical for risk management)

3. **Profile Parameter Scope**: Only buy/sell params, or also grid/trailing?
   - **Recommendation**: Three parameters for Phase 1 (trailingBuyActivationPercent, profitRequirement, maxLotsToSell)

4. **Starting Profile**: Aggressive, Conservative, or NULL?
   - **Recommendation**: NULL → determine on Day 1 based on P/L

5. **Cooldown Period**: Limit switches to once per week?
   - **Recommendation**: No cooldown for Phase 1 (hysteresis is enough)

These should be decided in kickoff meeting before implementation.

---

## Risk Assessment

### High Risk
1. **Profile Thrashing**: Rapid switching degrades performance
   - **Mitigation**: 3-day hysteresis
   - **Monitoring**: Track switch count, alert if >10 per backtest

2. **Unexpected Interactions**: Profile + consecutive incremental features
   - **Mitigation**: Extensive testing of all combinations
   - **Fallback**: Document limitations

### Medium Risk
3. **User Confusion**: Override behavior not clear
   - **Mitigation**: Clear tooltips, documentation, examples
   - **Fallback**: Add "current profile" indicator in UI

4. **Performance Validation**: Does it actually improve results?
   - **Mitigation**: Benchmark on multiple symbols/timeframes
   - **Fallback**: Make feature opt-in (already is!)

### Low Risk
5. **Implementation Bugs**: Edge cases missed
   - **Mitigation**: Comprehensive unit tests
   - **Fallback**: Beta testing period

---

## Success Criteria

### Must Have (P0)
- ✅ Profile switching works correctly with 3-day hysteresis
- ✅ Parameter overrides apply/restore properly
- ✅ Transaction log shows all switches
- ✅ Metrics calculation accurate
- ✅ Backward compatible when disabled
- ✅ UI checkbox and tooltip
- ✅ Complete documentation

### Should Have (P1)
- ✅ Reduces max drawdown by 10%+ (validated on multiple symbols)
- ✅ Performance comparison tool (before/after)
- ✅ Profile history chart in UI
- ✅ Beta tested by 5+ users

### Nice to Have (P2)
- ⭕ Configurable hysteresis days
- ⭕ Custom profile definitions
- ⭕ Real-time profile indicator in UI
- ⭕ Profile switch email alerts

---

## Validation Plan

### Backtesting Scenarios

**Scenario 1: Bull Market (2021 PLTR)**
- Expect: Mostly Aggressive profile
- Goal: Maximize gains, few switches

**Scenario 2: Bear Market (2022 PLTR)**
- Expect: Mostly Conservative profile
- Goal: Reduce drawdown vs non-profile baseline

**Scenario 3: Volatile Market (2024 PLTR)**
- Expect: Multiple switches
- Goal: Reduce drawdown while capturing upside

**Scenario 4: Sideways Market (2023 PLTR)**
- Expect: Frequent switches near breakeven
- Goal: Hysteresis prevents thrashing

### Performance Targets

| Metric | Without Profile | With Profile | Target Improvement |
|--------|----------------|--------------|-------------------|
| Max Drawdown | -40% | -30% | 25% reduction |
| Total Return | +100% | +95% | Similar (±5%) |
| Sharpe Ratio | 1.5 | 1.8 | 20% improvement |
| Switch Count | 0 | 3-8 | Reasonable range |

---

## Documentation Requirements

### User Guide
- What is dynamic profile switching?
- When should I enable it?
- How do profiles work?
- What parameters are overridden?
- Examples with real backtests

### API Documentation
- New parameter: `enableDynamicProfile`
- New response fields: profile metrics
- Transaction log format changes

### Developer Guide
- Implementation details
- Profile determination logic
- Hysteresis algorithm
- Testing strategies

---

## Summary

Spec 24 implements automatic strategy adjustment based on position status (Spec 26):
- **Conservative profile** when in LOSING position (preserve capital, easier to exit)
- **Aggressive profile** when in WINNING position (maximize gains, accumulate more)
- **3-day hysteresis** prevents thrashing on position status changes
- **Integrates with Spec 26** (Position-Based Adaptive Behavior)
- **Fully independent** of Spec 23 (average-cost features)

**Timeline**: 3 weeks after Spec 23, or can be done in parallel.

**Value**: Automatic risk management that adapts to position performance, targeting drawdown reduction while maintaining returns.
