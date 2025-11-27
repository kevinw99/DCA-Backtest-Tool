# Spec 25: Adaptive Trailing Stops for Consecutive Trades

**Status:** 📝 Not Started
**Priority:** Medium
**Estimated Effort:** ~7.7 hours
**Dependencies:** Existing consecutive buy/sell features

---

## Quick Summary

Enhance consecutive trade features with **adaptive trailing stop parameters** that automatically tighten based on price direction, enabling:

- **Faster exits** during consecutive sell downtrends (tighter pullbacks)
- **Faster accumulation** during consecutive buy uptrends (tighter rebounds)
- **Zero configuration** - automatically activates when consecutive features enabled

---

## The Problem

Current consecutive features use **fixed trailing stop parameters** regardless of price direction:

**Example - Consecutive Sells:**
```
Sell #1 at $100 → Price drops to $95
Sell #2 uses same 5% pullback
Sell #3 uses same 5% pullback
...even though price keeps falling!
```

**Desired Behavior:**
```
Sell #1 at $100 → Price drops to $95 (5% pullback)
Sell #2 at $95  → Price drops to $90 (2.5% pullback) ← Tighter!
Sell #3 at $90  → Price drops to $85 (2% pullback)   ← Even tighter!
```

---

## The Solution

### Adaptive Sell Trailing Stops

**When price is falling** (current price < last sell price):
- ✅ Skip activation check (exit immediately)
- ✅ Skip profit requirement check (exit regardless of profit)
- ✅ Reduce pullback: `max(lastPullback * 0.5, 2%)`
- ✅ Get out faster before price falls further

**When price is rising** (current price ≥ last sell price):
- Use standard activation and pullback
- Respect profit requirement
- Take time to maximize profit

### Adaptive Buy Trailing Stops

**When price is rising** (current price > last buy price):
- ✅ Skip activation check (buy immediately)
- ✅ Reduce rebound: `max(lastRebound * 0.8, 5%)`
- ✅ Accumulate faster during momentum

**When price is falling** (current price ≤ last buy price):
- Use standard activation and rebound
- Let normal DCA logic apply

---

## Key Features

### 1. Zero Configuration
- Uses existing `enableConsecutiveIncrementalSellProfit` flag
- Uses existing `enableConsecutiveIncrementalBuyGrid` flag
- No new UI parameters needed

### 2. Safe Defaults
- **Sell minimum:** 2% pullback (prevents over-tightening)
- **Buy minimum:** 5% rebound (prevents over-tightening)
- Enforced on every iteration

### 3. Direction-Aware
- Detects price trend each iteration
- Adapts only during favorable movements
- Reverts to standard when trend reverses

### 4. Transparent Logging
- Shows when adaptive mode activates
- Displays parameter adjustments
- Logs direction detection

---

## Example Scenario

### Consecutive Sells During Downtrend

```javascript
Base Parameters:
- trailingSellActivationPercent = 10%
- trailingSellPullbackPercent = 5%

Trade Sequence:
────────────────────────────────────────────────────
Sell #1: $100
  Standard behavior (first sell)
  Activation: 10%, Pullback: 5%

Price drops to $95 (downtrend detected)
────────────────────────────────────────────────────
Sell #2: $95
  🎯 ADAPTIVE MODE
  Direction: DOWN
  Activation: 0% (skipped)
  Profit Requirement: SKIPPED
  Pullback: 2.5% (was 5%) ← Decayed by 50%

Price drops to $90 (still downtrend)
────────────────────────────────────────────────────
Sell #3: $90
  🎯 ADAPTIVE MODE
  Direction: DOWN
  Activation: 0% (skipped)
  Profit Requirement: SKIPPED
  Pullback: 2% (was 2.5%) ← Minimum reached

Price drops to $85 (still downtrend)
────────────────────────────────────────────────────
Sell #4: $85
  🎯 ADAPTIVE MODE
  Direction: DOWN
  Activation: 0% (skipped)
  Profit Requirement: SKIPPED
  Pullback: 2% ← Stays at minimum

Price rises to $90 (trend reversal!)
────────────────────────────────────────────────────
Sell #5: $90
  📊 STANDARD MODE (trend reversed)
  Direction: UP
  Activation: 10%
  Pullback: 5% ← Reset to base
```

---

## Technical Implementation

### New State Variables
```javascript
// Adaptive sell state
let lastSellPrice = null;
let lastSellPullback = null;

// Adaptive buy state
let lastBuyPrice = null;      // Already exists
let lastBuyRebound = null;    // New
```

### New Constants
```javascript
const ADAPTIVE_SELL_PULLBACK_DECAY = 0.5;  // 50% decay
const ADAPTIVE_BUY_REBOUND_DECAY = 0.8;    // 20% decay
const MIN_ADAPTIVE_SELL_PULLBACK = 0.02;   // 2% minimum
const MIN_ADAPTIVE_BUY_REBOUND = 0.05;     // 5% minimum
```

### Helper Functions
```javascript
calculateAdaptiveSellParameters(
  currentPrice, lastSellPrice,
  baseSellActivation, baseSellPullback,
  lastPullback, consecutiveCount, enabled
)

calculateAdaptiveBuyParameters(
  currentPrice, lastBuyPrice,
  baseBuyActivation, baseBuyRebound,
  lastRebound, consecutiveCount, enabled
)
```

---

## Files to Modify

### Backend
- **`backend/services/dcaBacktestService.js`** - Core implementation
  - Add constants
  - Add state variables
  - Create helper functions
  - Integrate into sell logic (~line 1050-1150)
  - Integrate into buy logic (~line 750-900)
  - Add state reset logic

### Frontend
- **No changes required** - Uses existing feature flags

### API
- **No changes required** - No new parameters

---

## Testing Strategy

### Test Scenarios
1. ✅ Consecutive sells during continuous downtrend
2. ✅ Consecutive buys during continuous uptrend
3. ✅ Direction reversal (down → up, up → down)
4. ✅ Minimum threshold enforcement
5. ✅ Multiple consecutive cycles
6. ✅ Feature disabled (should be no-op)

### Validation Criteria
- Adaptive activation occurs only in favorable trends
- Decay formulas produce correct values
- Minimum thresholds enforced
- Standard behavior when trend unfavorable
- No impact when consecutive features disabled

---

## Benefits

### 1. Performance
- **Faster exit** from losing positions during downtrends
- **Faster accumulation** during favorable uptrends
- **Reduced slippage** during strong directional moves

### 2. Risk Management
- Get out quicker when price moving against you
- Accumulate more aggressively when momentum in your favor
- Minimum thresholds prevent excessive tightening

### 3. User Experience
- Zero configuration required
- Automatic activation when conditions met
- Clear logging shows what's happening
- Backward compatible with existing setups

---

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Stops too tight | Enforced minimums (2% sell, 5% buy) |
| False direction signals | Reset to standard on trend reversal |
| Unexpected behavior | Comprehensive logging and testing |
| Breaking changes | Only affects consecutive features |

---

## Implementation Checklist

- [ ] Phase 1: Add constants and state variables
- [ ] Phase 2: Create helper functions
- [ ] Phase 3: Integrate sell logic
- [ ] Phase 4: Integrate buy logic
- [ ] Phase 5: Test all scenarios
- [ ] Phase 6: Documentation and cleanup
- [ ] Phase 7: Git commit

**Estimated Time:** ~7.5 hours

---

## Related Specs

- **Spec 23:** Average-Cost Grid & Sell Logic (orthogonal feature)
- **Spec 24:** Dynamic Profile Switching (orthogonal feature)
- **Original Consecutive Features:** Foundation for this enhancement

---

## Notes

- This is an **enhancement** to existing consecutive features, not a replacement
- Activates automatically when consecutive features enabled
- No UI changes required
- Fully backward compatible
- Testable independently for each feature (sell/buy)

---

**Created:** 2025-10-09
**Author:** Claude Code
**Version:** 1.0
