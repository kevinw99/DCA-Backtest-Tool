# Spec 24: Dynamic Profile Switching - Requirements

## Overview
Enable the DCA algorithm to automatically adjust strategy parameters based on portfolio performance (P/L). When losing money, switch to a Conservative profile (preserve capital). When making money, switch to an Aggressive profile (maximize gains).

## Motivation

### Primary Goal
**Automatic Risk Management**: Reduce drawdowns by automatically becoming defensive when losing, and maximize gains by becoming aggressive when profitable.

### Key Insight
The algorithm should "change its personality" based on whether it's winning or losing:
- **Losing (P/L < 0)**: Be cautious - make buying harder, selling easier
- **Winning (P/L >= 0)**: Be bold - make buying easier, selling harder

## Scope

### In Scope (This Spec)
- ✅ **Feature #3**: P/L-based profile switching
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

### Feature: P/L-Based Profile Switching

**User Story**: As a trader, I want the algorithm to automatically adjust its aggressiveness based on my P/L, so that I preserve capital in losses and maximize gains in profits.

#### Profile Definitions

**Conservative Profile** (active when Unrealized P/L < 0):
- **Goal**: Cut losses, reduce risk, exit losing positions
- **Behavior**: Make buying harder, sell aggressively to limit losses
- **Parameter Overrides**:
  - `trailingBuyActivationPercent = 10%` (harder to buy - wait for 10% drop)
  - `profitRequirement = -10%` (sell at -10% loss to cut losses!)
  - `maxLotsToSell = maxLots` (sell all lots at once to exit quickly)
- **All other parameters**: Keep user-specified values

**Aggressive Profile** (active when Unrealized P/L >= 0):
- **Goal**: Maximize gains, hold winners, scale in
- **Behavior**: Make buying easier, sell slowly at good profit
- **Parameter Overrides**:
  - `trailingBuyActivationPercent = 0%` (easier to buy - accumulate winners)
  - `profitRequirement = 10%` (only sell at +10% profit)
  - `maxLotsToSell = 1` (sell slowly - 1 lot at a time to maximize gains)
- **All other parameters**: Keep user-specified values

#### Switching Logic

```
// Use UNREALIZED P/L only (not total P/L)
Unrealized P/L = (total shares held × current price) - (total cost of held lots)

At start of each trading day:
  IF Unrealized P/L < 0 AND current profile != CONSERVATIVE:
    IF P/L has been < 0 for >= 3 consecutive days:  // Hysteresis
      Switch to CONSERVATIVE
      Log switch with P/L amount
      Apply parameter overrides

  ELSE IF Unrealized P/L >= 0 AND current profile != AGGRESSIVE:
    IF P/L has been >= 0 for >= 3 consecutive days:  // Hysteresis
      Switch to AGGRESSIVE
      Log switch with P/L amount
      Apply parameter overrides
```

**Key Points**:
1. **Use Unrealized P/L** (current position health), NOT total P/L (includes realized gains)
2. Check happens at **start of each day** (before any trading)
3. **Hysteresis**: Require 3 consecutive days in P/L region before switching
4. **Overrides 3 parameters**: Buy activation %, profit requirement, max lots to sell
5. **All other parameters preserved**: Grid spacing, other trailing percentages, etc.

#### Acceptance Criteria

1. When `enableDynamicProfile = true`:
   - Profile is determined at start of each day based on **Unrealized P/L**
   - Hysteresis prevents switching on single-day fluctuations (require 3 days)
   - Parameter overrides are applied when profile switches
   - Original parameters are restored when feature is disabled
   - Profile switches are logged in transaction log
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
Starting balance: $100,000
Day 1-10: Unrealized P/L = +$5,000 (holding profitable positions) → Aggressive profile active
  - Buys activate immediately (0% drop requirement)
  - Requires 10% profit to sell
  - Sells 1 lot at a time

Day 11: Unrealized P/L = -$1,000 (positions underwater) → Still Aggressive (need 3 days)
Day 12: Unrealized P/L = -$2,000 → Still Aggressive (need 3 days)
Day 13: Unrealized P/L = -$2,500 → Switch to Conservative (3 days below 0)
  - Now requires 10% drop before buy activates
  - Will sell at -10% loss (cut losses!)
  - Can sell ALL lots at once to exit quickly

Day 20: Unrealized P/L = +$100 (back to profit) → Still Conservative (need 3 days)
Day 21: Unrealized P/L = +$300 → Still Conservative (need 3 days)
Day 22: Unrealized P/L = +$500 → Switch to Aggressive (3 days above 0)
```

**Acceptance Criteria**:
- ✅ Profile switches to Conservative after 3 days of losses
- ✅ Profile switches back to Aggressive after 3 days of profits
- ✅ Hysteresis prevents thrashing on daily P/L fluctuations
- ✅ All switches are logged with P/L amounts

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
- **Description**: "Automatically switch between Conservative and Aggressive profiles based on unrealized P/L"
- **Batch Mode**: Single boolean only (NOT an array)
- **Tooltip**: "Conservative when losing (Unrealized P/L < 0): harder to buy, sell at -10% loss to cut losses, exit all lots quickly. Aggressive when winning (Unrealized P/L >= 0): easier to buy, sell at +10% profit, sell 1 lot at a time. Requires 3 consecutive days before switching."

### Configuration Constants

These are hardcoded in Phase 1 (not user-configurable):

```javascript
const PROFILE_CONFIG = {
  HYSTERESIS_DAYS: 3,  // Require 3 consecutive days before switching

  CONSERVATIVE: {
    name: 'Conservative',
    description: 'Cut losses when positions are underwater',
    trigger: 'Unrealized P/L < 0',
    overrides: {
      trailingBuyActivationPercent: 0.10,  // 10% - harder to buy
      profitRequirement: -0.10,            // -10% - sell at loss to cut losses
      maxLotsToSell: Number.MAX_SAFE_INTEGER  // Sell all lots at once
    }
  },

  AGGRESSIVE: {
    name: 'Aggressive',
    description: 'Maximize gains when positions are profitable',
    trigger: 'Unrealized P/L >= 0',
    overrides: {
      trailingBuyActivationPercent: 0.00,  // 0% - easier to buy
      profitRequirement: 0.10,             // 10% - sell only at good profit
      maxLotsToSell: 1                     // Sell 1 lot at a time
    }
  }
};
```

**Future Enhancement**: Make these user-configurable (Phase 2)

---

## Edge Cases

### Edge Case 1: Starting Profile (Day 1)
**Scenario**: First day of backtest, no realized P/L yet
**Issue**: What profile should be active?
**Solution**: Start with NULL profile, determine on Day 1 based on initial P/L (usually 0 → Aggressive)

### Edge Case 2: Unrealized P/L Oscillating Around Zero
**Scenario**: Unrealized P/L crosses 0 every 2 days (volatile market)
```
Day 1: Unrealized P/L = +$100 → Aggressive
Day 2: Unrealized P/L = -$50  → Still Aggressive (need 3 days)
Day 3: Unrealized P/L = +$200 → Reset counter, still Aggressive
Day 4: Unrealized P/L = -$100 → Start counting (1 day)
Day 5: Unrealized P/L = -$150 → Continue (2 days)
Day 6: Unrealized P/L = +$50  → Reset counter, back to counting for Aggressive
```
**Solution**: Hysteresis prevents switching. Need 3 CONSECUTIVE days in region.

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

Spec 24 implements automatic strategy adjustment based on P/L performance:
- **Conservative profile** when losing (preserve capital)
- **Aggressive profile** when winning (maximize gains)
- **3-day hysteresis** prevents thrashing
- **Fully independent** of Spec 23 (average-cost features)

**Timeline**: 3 weeks after Spec 23, or can be done in parallel.

**Value**: Automatic risk management that adapts to market conditions, targeting 25% drawdown reduction while maintaining returns.
