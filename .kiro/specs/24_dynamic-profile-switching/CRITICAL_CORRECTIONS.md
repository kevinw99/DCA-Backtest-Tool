# CRITICAL CORRECTIONS to Spec 24: Dynamic Profile Switching

## Latest Update: 2025-10-10 - Position Status-Based Switching

**IMPORTANT**: The implementation has evolved beyond the corrections described below. As of October 10, 2025:

### Current Implementation (Spec 26 Integration)
The dynamic profile switching now uses **position status** from Spec 26 instead of direct P/L comparison:

```javascript
// Current implementation uses position status
const positionStatus = calculatePositionStatus(lots, currentPrice, positionThreshold);
// Returns 'winning', 'losing', or 'neutral'

if (positionStatus === 'winning') {
  targetProfile = 'AGGRESSIVE';
} else if (positionStatus === 'losing') {
  targetProfile = 'CONSERVATIVE';
}
// Note: 'neutral' position doesn't trigger profile changes
```

**Benefits of Position Status Approach**:
1. **Threshold-based stability**: Uses unrealized P/L threshold (10% of lot size) to avoid noise
2. **Three states**: winning/losing/neutral provides better hysteresis
3. **Integration with Spec 26**: Consistent with position-based adaptive behavior
4. **More robust**: Prevents switching on small P/L fluctuations near zero

**Profile Definitions (Updated)**:
- **Conservative**: Active when position status = LOSING (P/L < -threshold)
  - Buy: 20% drop required
  - Sell: No activation, no profit requirement (easy exit)
- **Aggressive**: Active when position status = WINNING (P/L > +threshold)
  - Buy: Immediate (0% activation)
  - Sell: 20% from peak, 10% profit requirement

---

## Historical Context: Original Corrections (2025-10-09)

The sections below document the evolution from Total P/L → Unrealized P/L → Position Status.

## Summary of Critical Design Flaw and Corrections

### Original Design Flaw Identified

**Problem**: The original spec had a logical contradiction:
- Conservative profile was triggered when "Total P/L < 0"
- But Conservative profile had `profitRequirement = 0%` (sell at any profit)
- **Contradiction**: If we can sell at profit, we're not losing money - we should be Aggressive!

**Root Cause**: Using Total P/L (unrealized + realized) doesn't reflect current position health. It mixes past trading performance with current position status.

---

## KEY CORRECTION #1: Use Unrealized P/L, Not Total P/L

### OLD (WRONG):
```javascript
const totalPNL = unrealizedPNL + realizedPNL;
const targetProfile = totalPNL >= 0 ? 'AGGRESSIVE' : 'CONSERVATIVE';
```

### NEW (CORRECT):
```javascript
const unrealizedPNL = (totalSharesHeld * currentPrice) - totalCostOfHeldLots;
const targetProfile = unrealizedPNL >= 0 ? 'AGGRESSIVE' : 'CONSERVATIVE';
```

**Rationale**:
- **Unrealized P/L** = current position health (are we underwater?)
- **Realized P/L** = past trading history (irrelevant for current position management)
- We want to react to whether **current holdings** are profitable or losing

---

## KEY CORRECTION #2: Conservative Profile Parameters

### OLD (WRONG):
```javascript
CONSERVATIVE: {
  overrides: {
    trailingBuyActivationPercent: 0.10,  // 10%
    profitRequirement: 0.00              // 0% - CONTRADICTION!
  }
}
```

**Problem**: `profitRequirement = 0%` means "sell at any profit", but if we're in a losing position (Unrealized P/L < 0), we CAN'T sell at profit!

### NEW (CORRECT):
```javascript
CONSERVATIVE: {
  description: 'Cut losses when positions are underwater',
  trigger: 'Unrealized P/L < 0',
  overrides: {
    trailingBuyActivationPercent: 0.10,     // 10% - harder to buy
    profitRequirement: -0.10,               // -10% - sell at LOSS to cut losses
    maxLotsToSell: Number.MAX_SAFE_INTEGER  // Sell ALL lots at once
  }
}
```

**Behavior**: When positions are underwater (losing money):
1. **Make buying harder**: Require 10% drop before activating buy
2. **Sell at -10% loss**: Cut losses early to limit drawdown
3. **Exit quickly**: Sell all lots at once to reduce exposure

---

## KEY CORRECTION #3: Aggressive Profile Parameters

### OLD:
```javascript
AGGRESSIVE: {
  overrides: {
    trailingBuyActivationPercent: 0.00,  // 0%
    profitRequirement: 0.10              // 10%
  }
}
```

### NEW (ENHANCED):
```javascript
AGGRESSIVE: {
  description: 'Maximize gains when positions are profitable',
  trigger: 'Unrealized P/L >= 0',
  overrides: {
    trailingBuyActivationPercent: 0.00,  // 0% - easier to buy
    profitRequirement: 0.10,             // 10% - sell only at good profit
    maxLotsToSell: 1                     // Sell SLOWLY (1 lot at a time)
  }
}
```

**Behavior**: When positions are profitable (making money):
1. **Make buying easier**: Activate buy on any drop (accumulate winners)
2. **Sell at +10% profit**: Only take profits at good levels
3. **Scale out slowly**: Sell 1 lot at a time to maximize gains

---

## Why This Makes Sense

### Conservative Profile (Unrealized P/L < 0)
**Situation**: You bought stock at $50, now it's at $45. You're underwater by $5/share.

**Strategy**: Cut losses before they get worse
- Don't buy more unless price drops another 10% (don't throw good money after bad)
- Sell when loss reaches -10% (stop the bleeding)
- Exit entire position at once (reduce risk exposure quickly)

**Example**:
```
Position: 100 shares @ $50 avg cost = $5,000 invested
Current price: $45
Unrealized P/L: -$500 (losing 10%)

Conservative Action: SELL ALL 100 shares at $45
Result: Realize -$500 loss, but prevent further losses if price drops to $40
```

### Aggressive Profile (Unrealized P/L >= 0)
**Situation**: You bought stock at $50, now it's at $55. You're profitable by $5/share.

**Strategy**: Maximize gains, let winners run
- Buy more on any dip (accumulate winning positions)
- Only sell at +10% profit (let it run)
- Sell slowly 1 lot at a time (keep exposure to upside)

**Example**:
```
Position: 100 shares @ $50 avg cost = $5,000 invested
Current price: $55
Unrealized P/L: +$500 (up 10%)

Aggressive Action:
1. If price dips to $54, BUY MORE (accumulate winners)
2. If price hits $60 (+20%), sell 1 lot only (scale out slowly)
3. Keep most position to capture further upside
```

---

## Updated Switching Logic

```javascript
// Calculate unrealized P/L
const totalSharesHeld = lots.reduce((sum, lot) => sum + lot.shares, 0);
const totalCostOfHeldLots = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
const unrealizedPNL = (totalSharesHeld * currentPrice) - totalCostOfHeldLots;

// Determine target profile based on UNREALIZED P/L only
const currentPnLSign = unrealizedPNL >= 0 ? 'positive' : 'negative';
const targetProfile = unrealizedPNL >= 0 ? 'AGGRESSIVE' : 'CONSERVATIVE';

// Check if P/L sign changed (reset hysteresis counter)
if (currentPnLSign !== lastPnLSign) {
  consecutiveDaysInRegion = 1;  // Reset to 1 (current day)
  lastPnLSign = currentPnLSign;
} else {
  consecutiveDaysInRegion++;
}

// Switch only after 3 consecutive days in same region
if (targetProfile !== currentProfile && consecutiveDaysInRegion >= 3) {
  // Switch profile and apply parameter overrides
  currentProfile = targetProfile;

  const profile = PROFILES[currentProfile];
  trailingBuyActivationPercent = profile.overrides.trailingBuyActivationPercent;
  profitRequirement = profile.overrides.profitRequirement;
  maxLotsToSell = profile.overrides.maxLotsToSell;

  // Log switch
  console.log(`Profile switched to ${currentProfile} (Unrealized P/L: $${unrealizedPNL})`);
}
```

---

## KEY CORRECTION #4: Update Active Trailing Stops on Profile Switch

### Issue Identified
**Problem**: Original design said "let active stops complete naturally" when profile switches.
**Critical Flaw**: If we switch to Conservative because we're losing money, keeping old Aggressive stops would defeat the entire purpose of risk management!

### OLD (WRONG):
```
When profile switches:
- Keep existing trailing stops unchanged
- They execute with original parameters
- Only NEW stops use new profile parameters
```

**Problem**: Conservative profile wants to cut losses at -10%, but old Aggressive stop still waits for +10% profit. This defeats Conservative's purpose!

### NEW (CORRECT):
```
When profile switches:
1. Check for active trailing buy stops
2. Check for active trailing sell stops
3. Recalculate ALL stops with new profile parameters
4. Update the active stops immediately
5. Log the updates with old and new values
```

**Implementation Example**:
```javascript
function applyProfileSwitch(newProfile) {
  // Apply parameter overrides
  const profile = PROFILES[newProfile];
  trailingBuyActivationPercent = profile.overrides.trailingBuyActivationPercent;
  profitRequirement = profile.overrides.profitRequirement;
  maxLotsToSell = profile.overrides.maxLotsToSell;

  // Update active trailing stops
  if (trailingStopBuyActive) {
    const oldActivation = trailingStopBuy.activationPercent;
    const oldStopPrice = trailingStopBuy.stopPrice;

    // Recalculate with new parameters
    trailingStopBuy.activationPercent = trailingBuyActivationPercent;
    trailingStopBuy.stopPrice = calculateBuyStopPrice(
      currentPrice,
      trailingBuyActivationPercent,
      trailingStopBuy.peakPrice
    );

    // Log the update
    transactionLog.push(colorize(
      `    🔄 Updated Trailing Buy Stop:`,
      'yellow'
    ));
    transactionLog.push(colorize(
      `       OLD: Activation = ${(oldActivation * 100).toFixed(0)}%, Stop = $${oldStopPrice.toFixed(2)}`,
      'dim'
    ));
    transactionLog.push(colorize(
      `       NEW: Activation = ${(trailingBuyActivationPercent * 100).toFixed(0)}%, Stop = $${trailingStopBuy.stopPrice.toFixed(2)}`,
      'cyan'
    ));
  }

  if (trailingStopSellActive) {
    const oldProfitReq = trailingStopSell.profitRequirement;
    const oldStopPrice = trailingStopSell.stopPrice;

    // Recalculate with new parameters
    trailingStopSell.profitRequirement = profitRequirement;
    trailingStopSell.stopPrice = calculateSellStopPrice(
      averageCost,
      profitRequirement,
      trailingStopSell.peakPrice
    );

    // Log the update
    transactionLog.push(colorize(
      `    🔄 Updated Trailing Sell Stop:`,
      'yellow'
    ));
    transactionLog.push(colorize(
      `       OLD: Profit Req = ${(oldProfitReq * 100).toFixed(0)}%, Stop = $${oldStopPrice.toFixed(2)}`,
      'dim'
    ));
    transactionLog.push(colorize(
      `       NEW: Profit Req = ${(profitRequirement * 100).toFixed(0)}%, Stop = $${trailingStopSell.stopPrice.toFixed(2)}`,
      'cyan'
    ));
  }
}
```

**Example Log Output**:
```
--- 2024-01-15 ---
Price: 45.50 | Unrealized P/L: -$2,500 | Holdings: [50.00, 48.00, 52.00]

  🔄 PROFILE SWITCH: AGGRESSIVE → CONSERVATIVE (Unrealized P/L: -$2,500.00, 3 days)
     Buy Activation: 0% → 10%, Profit Req: 10% → -10%, Max Lots to Sell: 1 → ALL

    🔄 Updated Trailing Buy Stop:
       OLD: Activation = 0%, Stop = $45.00
       NEW: Activation = 10%, Stop = $40.50 (10% below peak $45.00)

    🔄 Updated Trailing Sell Stop:
       OLD: Profit Req = 10%, Stop = $55.00 (waiting for profit)
       NEW: Profit Req = -10%, Stop = $45.00 (cut loss at -10%)

  ⚠️ Conservative mode: Will sell at -10% loss to limit drawdown
```

**Why This Is Critical**:
- **Without update**: Conservative profile is declared but old Aggressive stops remain → no risk management
- **With update**: Conservative profile immediately enforces -10% loss cut → prevents catastrophic drawdowns

**Scenario**:
```
Current position: 100 shares @ $50 avg cost
Current price: $45 (down 10%, underwater)
Unrealized P/L: -$500

OLD BEHAVIOR (WRONG):
- Switch to Conservative profile
- But trailing sell stop still waits for $55 (+10% profit)
- Price drops to $40 → Still waiting for $55
- Price drops to $35 → Still waiting for $55
- Final loss: -$1,500 (30% drawdown!)

NEW BEHAVIOR (CORRECT):
- Switch to Conservative profile
- Update trailing sell stop to $45 (-10% loss cut)
- Price drops to $44.50 → Triggers stop
- SELL ALL 100 shares at $44.50
- Realize: -$550 loss (11% drawdown)
- Prevented: -$950 additional loss!
```

---

## Impact on Other Specs

### No Impact on Spec 23
- Spec 23 (Average-Cost Grid & Sell) is independent
- Dynamic profiles work with or without average-cost features
- No conflicts or dependencies

---

## Documentation Updates Required

### Files Updated
1. ✅ `.kiro/specs/24_dynamic-profile-switching/requirements.md`
2. ⏳ `.kiro/specs/24_dynamic-profile-switching/design.md` (needs update)
3. ⏳ `.kiro/specs/24_dynamic-profile-switching/tasks.md` (needs update)

### Key Changes in All Docs
- Replace "Total P/L" with "Unrealized P/L" everywhere
- Update Conservative profile: `profitRequirement = 0%` → `-10%`
- Add `maxLotsToSell` to profile overrides
- Update all examples and scenarios
- Update tooltips and UI descriptions

---

## Testing Implications

### New Test Scenarios Required
1. **Conservative Profile Selling at Loss**:
   - Position underwater by 10%
   - Should sell at -10% loss (not wait for profit)
   - Should exit all lots at once

2. **Aggressive Profile Scaling Out**:
   - Position profitable by 10%+
   - Should only sell 1 lot at a time
   - Should not exit entire position

3. **Profile Switching Based on Unrealized P/L**:
   - Realized P/L = +$5,000 (past profits)
   - Unrealized P/L = -$2,000 (current position losing)
   - Should be CONSERVATIVE (not Aggressive)

---

## Timeline Impact

**Original Timeline**: 3 weeks

**New Timeline**: Still 3 weeks (changes are not major, just corrections)

### What Changed
- More parameters to override (3 instead of 2): +0.5 days
- Simpler logic (unrealized only): -0.5 days
- **Net Impact**: 0 days

---

## Open Questions Resolved

1. **Q**: Use Total P/L or Unrealized P/L?
   - **A**: Unrealized P/L only (current position health)

2. **Q**: What should Conservative profile do?
   - **A**: Sell at -10% loss to cut losses, exit all lots quickly

3. **Q**: How many parameters to override?
   - **A**: Three (trailingBuyActivationPercent, profitRequirement, maxLotsToSell)

---

## Risk Assessment Update

### Risk Removed
- ❌ **Logical Contradiction**: Selling at profit when losing (FIXED)

### New Risks
- ⚠️ **Selling at Loss**: Users might not expect algorithm to sell at loss
  - **Mitigation**: Clear documentation and tooltips
  - **Benefit**: Prevents catastrophic drawdowns

---

## Summary

The original design had critical flaws that have been corrected:

### Four Major Corrections Applied:

1. **Uses Unrealized P/L** (not Total P/L) to determine current position health
   - Rationale: React to whether current positions are profitable or losing

2. **Conservative profile sells at loss** (-10%) to cut losses early
   - Prevents the logical contradiction of selling at profit when losing

3. **Aggressive profile sells slowly** (1 lot at a time) to maximize gains
   - Conservative sells ALL lots quickly to exit losing positions fast

4. **Active trailing stops are UPDATED** when profile switches
   - Critical for risk management: Must honor new parameters immediately
   - Comprehensive logging shows old vs new stop values
   - Prevents scenario where Conservative profile is active but old Aggressive stops remain

### Impact:

This corrected design will effectively:
- **Reduce drawdowns** by cutting losses early (-10% stop loss)
- **Maximize gains** by holding winners longer (sell slowly at +10%)
- **Enforce risk management** immediately via updated trailing stops
- **Make logical sense**: React to current position health, not past trading history
