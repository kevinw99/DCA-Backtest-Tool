# Spec 52: Enhanced Trading Guidance with Holdings and Grid Requirements

## Problem Statement

The current "Future Trades" display shows **activation conditions only**, but does not provide complete guidance for real trading because it omits critical information about **grid requirements**. This creates a dangerous information gap where:

1. A trailing stop may show as "ACTIVE" and triggered
2. The current price may satisfy the trailing stop condition
3. **BUT the trade won't execute** because the grid requirement is not met
4. The user has no way to know this without manual calculation

### Real Example (APP - 2024-10-30)

```
Current: $628.71
Last Buy: $631.85 on 2024-10-07

Active BUY Stop: $580.27 (triggered by 5% rebound from $552.64)
Current price $628.71 > Stop price $580.27 ✓

BUT: Grid requirement (10% drop from last buy):
  Required: $631.85 × 0.90 = $568.67
  Current: $628.71
  Satisfied? NO! ($628.71 is NOT <= $568.67)

Result: Stop appears triggered but trade WON'T execute
```

This misleads users into thinking a trade is about to happen when it's actually blocked by grid requirements.

## Current State

### What's Shown (Spec 51)
- Last trade info
- Peak and bottom prices with dates
- Next BUY activation (trailing stop condition)
- Next SELL activation (trailing stop condition)
- Current price vs activation prices

### What's Missing
1. **Current holdings details**: Users can't see individual lot positions
2. **Grid requirement validation**: No indication if grid spacing is satisfied
3. **Effective execution price**: The REAL price needed for execution (considering both constraints)
4. **Execution readiness**: Clear YES/NO indicator if trade will execute now

## User Need

For **real trading decisions**, users need to answer:

1. **"What positions am I holding?"**
   - Each lot's buy price
   - Each lot's current unrealized P/L
   - Overall average cost

2. **"Will this trade actually execute?"**
   - Is the trailing stop condition met? (already shown)
   - Is the grid requirement met? (NOT shown)
   - What's the effective target price considering BOTH?

3. **"What price do I need for execution?"**
   - Not just activation price
   - The REAL price that satisfies ALL constraints

## Proposed Solution

### Solution 1: Display Current Holdings (User's Suggestion)

Add a **"Current Holdings"** section showing:

```
Current Holdings (2 lots)
───────────────────────────────────────
Lot 1: $631.85 x 15.83 shares (2024-10-07)
       Current Value: $9,954.23
       Unrealized P/L: -$49.73 (-0.50%)

Lot 2: $620.45 x 16.11 shares (2024-09-15)
       Current Value: $10,127.84
       Unrealized P/L: +$132.98 (+1.33%)

Average Cost: $626.03
Total Holdings Value: $20,082.07
```

**Pros:**
- User can see all positions at a glance
- Can manually calculate grid requirements
- Provides full transparency

**Cons:**
- User still needs to calculate grid requirements manually
- Doesn't directly answer "will trade execute?"

### Solution 2: Show Effective Execution Price (Enhanced)

Add **grid validation logic** and show the REAL target price:

```
Next BUY
───────────────────────────────────────
Trailing Stop: $580.27 ✓ (triggered)
Grid Requirement: $568.67 ✗ (NOT satisfied)

Effective Target: $568.67
Current Price: $628.71
Difference: -$60.04 (price needs to drop 9.54%)

Status: ⏳ WAITING FOR GRID
Will execute when price drops to $568.67 or below
```

**Pros:**
- Crystal clear execution status
- Shows exactly what price is needed
- No manual calculation required

**Cons:**
- More complex to implement
- Requires backend logic changes

### Solution 3: Combined Approach (RECOMMENDED)

Combine both solutions for maximum clarity:

1. **Holdings Section** - Show what user owns
2. **Smart Execution Status** - Show what will happen

```
┌─ Current Holdings ──────────────────────┐
│ 2 lots • $626.03 avg • $20,082 value   │
│ Lot 1: $631.85 (2024-10-07) -$49.73    │
│ Lot 2: $620.45 (2024-09-15) +$132.98   │
└─────────────────────────────────────────┘

┌─ Next BUY ──────────────────────────────┐
│ ⏳ WAITING FOR GRID                     │
│                                         │
│ Trailing Stop: $580.27 ✓               │
│ Grid Spacing: $568.67 ✗                │
│ → Effective Target: $568.67             │
│                                         │
│ Current: $628.71                        │
│ Target:  $568.67 ↓ $60.04 (9.54%)      │
│                                         │
│ Will execute when price drops to        │
│ $568.67 or below (last buy was $631.85) │
└─────────────────────────────────────────┘
```

## Functional Requirements

### FR1: Display Current Holdings Details
**Priority: High**

Display all held lots with:
- Buy price
- Number of shares
- Purchase date
- Current market value
- Unrealized P/L ($ and %)
- Average cost across all lots
- Total holdings value

**Acceptance Criteria:**
- Each lot shows all required fields
- P/L calculations are accurate
- Sorted by purchase date (oldest first)
- Clear visual separation between lots

### FR2: Calculate Grid Requirement Price
**Priority: High**

Backend must calculate the minimum price required to satisfy grid spacing:

For BUY orders:
```
gridRequirementPrice = lastBuyPrice × (1 - gridIntervalPercent)
```

For SELL orders:
```
gridRequirementPrice = avgCost × (1 + profitRequirement)
```

**Acceptance Criteria:**
- Calculation accounts for dynamic grid multipliers
- Uses correct reference price (last buy for BUY, avg cost for SELL)
- Returns null when no holdings (for BUY grid check)

### FR3: Validate Grid Satisfaction Status
**Priority: High**

Determine if current price satisfies grid requirement:

```javascript
gridSatisfied = currentPrice <= gridRequirementPrice  // for BUY
gridSatisfied = currentPrice >= gridRequirementPrice  // for SELL
```

**Acceptance Criteria:**
- Returns boolean: true/false
- Accounts for both BUY and SELL directions
- Handles edge cases (no holdings, first buy, etc.)

### FR4: Calculate Effective Execution Price
**Priority: High**

The REAL price needed for execution considering ALL constraints:

```javascript
effectiveExecutionPrice = Math.max(
  trailingStopPrice,  // Must satisfy trailing stop
  gridRequirementPrice  // Must satisfy grid spacing
)
// For BUY direction (use Math.min for SELL)
```

**Acceptance Criteria:**
- Considers both trailing stop AND grid requirements
- Returns the more restrictive price
- Handles ACTIVE vs PENDING states correctly

### FR5: Display Execution Readiness Status
**Priority: High**

Clear visual indicator showing if trade will execute:

**States:**
1. ✅ **READY TO EXECUTE**: All conditions met, trade will execute
2. ⏳ **WAITING FOR GRID**: Trailing stop met, but grid not satisfied
3. ⏳ **WAITING FOR STOP**: Grid met, but trailing stop not triggered
4. ⏳ **WAITING**: Neither condition met yet

**Acceptance Criteria:**
- Status is immediately clear (emoji + text)
- Shows which constraint is blocking (if any)
- Updates when conditions change

### FR6: Show Target Price with Current Distance
**Priority: Medium**

Display how far current price is from effective target:

```
Target: $568.67 ↓ $60.04 (9.54% drop needed)
```

**Acceptance Criteria:**
- Shows absolute distance in dollars
- Shows percentage distance
- Uses ↑ or ↓ to indicate direction
- Color codes: red (far), yellow (close), green (met)

### FR7: Provide Execution Explanation
**Priority: Medium**

Brief text explaining why trade will/won't execute:

```
Will execute when price drops to $568.67 or below
(10% grid spacing from last buy at $631.85)
```

**Acceptance Criteria:**
- Plain English explanation
- References specific prices and percentages
- Mentions which constraint is governing

## Non-Functional Requirements

### NFR1: Performance
- Holdings calculation should be instant (< 10ms)
- No additional API calls required (use existing data)
- Grid validation should not slow down page load

### NFR2: Accuracy
- All P/L calculations must match backend precision
- Grid prices must match execution engine logic exactly
- No rounding errors that could mislead users

### NFR3: Clarity
- Status indicators must be unambiguous
- No technical jargon (avoid "grid satisfied", use "spacing requirement")
- Visual hierarchy: most important info (execution status) stands out

### NFR4: Consistency
- Same logic as actual execution engine
- No discrepancies between display and actual behavior
- Works identically for long and short strategies

## Success Criteria

1. **User can answer "What do I own?"**
   - Holdings section clearly shows all lots
   - P/L is visible at a glance

2. **User can answer "Will trade execute now?"**
   - Clear YES/NO status indicator
   - Obvious which constraint is blocking (if any)

3. **User can answer "What price do I need?"**
   - Effective execution price is clearly displayed
   - Distance from current price is shown

4. **No manual calculation required**
   - Grid requirements automatically validated
   - Target price automatically calculated

5. **Zero execution surprises**
   - Display matches actual execution logic 100%
   - Users make informed decisions

## Out of Scope

- Historical lot performance tracking
- Lot selection/management (FIFO/LIFO)
- What-if scenario analysis
- Portfolio-level holdings summary
- Tax lot optimization

## Example: APP Stock Enhancement

### Before (Current Display)
```
Active BUY Stop
Stop Price: $580.27
Lowest Price: $552.64
```
**Problem**: User doesn't know if trade will actually execute!

### After (Enhanced Display)
```
Current Holdings (1 lot)
───────────────────────────────────────
Lot 1: $631.85 x 15.83 shares (2024-10-07)
       Value: $9,954 | P/L: -$50 (-0.5%)

Next BUY
───────────────────────────────────────
⏳ WAITING FOR GRID SPACING

Trailing Stop: $580.27 ✓ (triggered)
Grid Requirement: $568.67 ✗ (not met)
→ Effective Target: $568.67

Current: $628.71
Target: $568.67 ↓ $60.04 (9.54% drop)

Trade will execute when price drops to
$568.67 or below (10% from last buy $631.85)
```
**Result**: User has complete information for trading decision!

## Risk Assessment

### Risk: Backend Calculation Mismatch
**Severity**: HIGH
**Mitigation**: Reuse exact same logic from execution engine

### Risk: UI Complexity
**Severity**: MEDIUM
**Mitigation**: Progressive disclosure - show summary, expand for details

### Risk: Performance with Many Lots
**Severity**: LOW
**Mitigation**: Typical users have < 10 lots, calculation is trivial

## Dependencies

- Spec 51 (Future Trades display) - builds on this foundation
- Execution engine grid logic - must match exactly
- Backend lots data - already available in batch results
