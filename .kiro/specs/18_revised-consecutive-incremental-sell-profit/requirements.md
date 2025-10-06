# Revised Consecutive Incremental Sell Profit - Requirements

## Problem Statement

Current Consecutive Incremental Sell Profit (Spec #12) implementation calculates profit requirement from the **lot's purchase price**, which doesn't align with the consecutive sell concept. This leads to:

- **Inconsistent with consecutive buy logic**: Consecutive buy uses lastBuyPrice as reference, not lot price
- **Missed profit opportunities**: Even with increased profit requirement (e.g., 20%), the reference price (lot buy price) is too low
- **Confusing behavior**: Users expect consecutive sells to require spacing from the last sell, similar to how consecutive buys require spacing from the last buy

**Example of current behavior:**

```
Lot bought at $317.54
Last sell at $346.00
Current price $389.22
Profit requirement: 20% (consecutive sell)
Threshold: $317.54 × 1.20 = $381.05 ✓ (current price exceeds, so sell)
```

**This is wrong because** even though it's a consecutive sell in an uptrend (last sell $346), the profit requirement is still anchored to the lot's buy price ($317.54), not the last sell price ($346).

## Proposed Solution

**Change profit requirement reference point based on context:**

1. **First sell after buy**: Use lot purchase price as reference
2. **Consecutive sell (price > lastSellPrice)**: Use lastSellPrice as reference
3. **Non-consecutive sell (price ≤ lastSellPrice)**: Use lot purchase price as reference

This makes consecutive sell behavior consistent with consecutive buy logic.

## Core Concept

### Profit Requirement Reference Price Logic

```javascript
// Determine reference price for profit requirement
let profitReqReferencePrice;
let isConsecutiveSell = false;

if (lastSellPrice !== null && currentPrice > lastSellPrice) {
  // Consecutive sell: use last sell price as reference
  profitReqReferencePrice = lastSellPrice;
  isConsecutiveSell = true;
} else {
  // Not consecutive: use lot purchase price as reference
  profitReqReferencePrice = lot.price;
  isConsecutiveSell = false;
}

// Calculate profit requirement
let profitRequirement = baseProfitRequirement;
if (enableConsecutiveIncrementalSellProfit && isConsecutiveSell) {
  // Increase profit requirement for consecutive sells
  let gridSize = enableDynamicGrid
    ? calculateDynamicGridSpacing(...)
    : gridIntervalPercent;
  profitRequirement = baseProfitRequirement + gridSize;
}

// Check if lot is eligible
const minSellPrice = profitReqReferencePrice * (1 + profitRequirement);
const isEligible = currentPrice > minSellPrice;
```

### State Tracking

Similar to consecutive buy tracking, maintain:

1. **`lastSellPrice`**: Price of the last sell execution
   - Initialized to `null`
   - Updated after every sell execution
   - Reset to `null` after every buy execution

2. **`consecutiveSellCount`**: Number of consecutive sells
   - Initialized to `0`
   - Increment after each sell in uptrend (price > lastSellPrice)
   - Reset to `0` after buy or when price ≤ lastSellPrice

## Detailed Requirements

### 1. Configuration

**No new parameters needed** - uses existing:

- `enableConsecutiveIncrementalSellProfit` (boolean)
- `profitRequirement` (decimal, e.g., 0.05 for 5%)
- `gridIntervalPercent` (decimal)
- `enableDynamicGrid` (boolean)

### 2. State Tracking Variables

Add to backtest state:

```javascript
let lastSellPrice = null; // Price of last sell execution
let consecutiveSellCount = 0; // Number of consecutive sells in uptrend
```

### 3. Logic Flow

#### A. Trailing Stop Sell Activation & Update

When checking for eligible lots to sell:

```javascript
// Determine if this is a consecutive sell scenario
const isConsecutiveSell = lastSellPrice !== null && currentPrice > lastSellPrice;

// Calculate profit requirement
let lotProfitRequirement = profitRequirement; // Base
if (enableConsecutiveIncrementalSellProfit && isConsecutiveSell) {
  let gridSize = enableDynamicGrid
    ? calculateDynamicGridSpacing(
        currentPrice,
        referencePrice,
        dynamicGridMultiplier,
        normalizeToReference
      )
    : gridIntervalPercent;
  lotProfitRequirement = profitRequirement + gridSize;
}

// Filter eligible lots
const eligibleLots = lots.filter(lot => {
  let referencePrice;
  if (isConsecutiveSell) {
    // Consecutive sell: check from last sell price
    referencePrice = lastSellPrice;
  } else {
    // Not consecutive: check from lot purchase price
    referencePrice = lot.price;
  }

  const minSellPrice = referencePrice * (1 + lotProfitRequirement);
  return currentPrice > minSellPrice;
});
```

#### B. Sell Execution

After sell executes:

```javascript
// Update state
if (lastSellPrice !== null && executionPrice > lastSellPrice) {
  consecutiveSellCount++;
} else {
  consecutiveSellCount = 1; // First sell or price declined
}
lastSellPrice = executionPrice;
```

#### C. Buy Execution

After buy executes:

```javascript
// Reset sell tracking
lastSellPrice = null;
consecutiveSellCount = 0;
```

### 4. Average Cost Comparison

**Average cost comparisons always use base profit requirement** (unchanged from Spec #12):

```javascript
// Portfolio-level profitability check
const minProfitablePrice = averageCost * (1 + profitRequirement); // BASE only
```

## Examples

### Example 1: Consecutive Sells in Uptrend

**Configuration:**

- `profitRequirement`: 0.10 (10%)
- `gridIntervalPercent`: 0.10 (10%)
- `enableConsecutiveIncrementalSellProfit`: true
- `enableDynamicGrid`: false

**Scenario:**

| Step | Event         | Price | lastSellPrice | consecutiveSellCount | Profit Req    | Reference Price  | Threshold | Lot Price | Action       |
| ---- | ------------- | ----- | ------------- | -------------------- | ------------- | ---------------- | --------- | --------- | ------------ |
| 1    | Buy           | $300  | null          | 0                    | -             | -                | -         | $300      | BUY          |
| 2    | Price rises   | $340  | null          | 0                    | 10%           | $300 (lot)       | $330      | $300      | **SELL**     |
| 3    | After sell #1 | $340  | $340          | 1                    | -             | -                | -         | -         | -            |
| 4    | Price rises   | $380  | $340          | 1                    | 20% (10%+10%) | $340 (last sell) | **$408**  | $300      | NOT eligible |
| 5    | Price rises   | $420  | $340          | 1                    | 20%           | $340 (last sell) | **$408**  | $300      | **SELL**     |
| 6    | After sell #2 | $420  | $420          | 2                    | -             | -                | -         | -         | -            |
| 7    | Price rises   | $480  | $420          | 2                    | 20%           | $420 (last sell) | **$504**  | $300      | NOT eligible |

**Key observations:**

- **Step 2**: First sell uses lot price ($300) as reference, 10% requirement → threshold $330
- **Step 4**: Consecutive sell uses lastSellPrice ($340) as reference, 20% requirement → threshold $408
  - Current price $380 < $408, so NOT eligible even though $380 > $300 × 1.20 = $360
- **Step 5**: Price $420 > threshold $408, so eligible to sell
- **Step 7**: Next threshold is $420 × 1.20 = $504

**Comparison with old behavior:**

- Old: Step 4 would sell at $380 (because $380 > $300 × 1.20 = $360)
- New: Step 4 does NOT sell (because $380 < $340 × 1.20 = $408)
- **Result**: Higher profit capture per sell, more spacing in uptrends

### Example 2: Price Decline Resets to Lot Price

**Scenario:**

| Step | Event       | Price | lastSellPrice | Profit Req  | Reference Price | Threshold | Lot Price | Action       |
| ---- | ----------- | ----- | ------------- | ----------- | --------------- | --------- | --------- | ------------ |
| 1    | After sell  | $420  | $420          | -           | -               | -         | $300      | -            |
| 2    | Price drops | $400  | $420          | 10% (reset) | $300 (lot)      | $330      | $300      | **CAN SELL** |

**Key observation:**

- Price $400 ≤ lastSellPrice $420, so NOT consecutive
- Uses lot price ($300) as reference with base 10% requirement
- Threshold $330, current $400 > $330, so eligible

### Example 3: Multiple Lots with Different Buy Prices

**Scenario:**

- Lot A: bought at $280
- Lot B: bought at $350
- lastSellPrice: $400
- Current price: $450
- Profit requirement: 20% (consecutive sell)

**Eligibility check:**

```
Reference price: $400 (lastSellPrice, because consecutive)
Threshold: $400 × 1.20 = $480
Current price: $450 < $480

Result: NEITHER lot is eligible
```

**Note**: Both lots use the same reference price (lastSellPrice) when in consecutive sell mode, regardless of individual lot buy prices.

## Implementation Changes

### Backend (`dcaBacktestService.js`)

#### 1. State Variables

Add near top of backtest function:

```javascript
let lastSellPrice = null;
let consecutiveSellCount = 0;
```

#### 2. Trailing Stop Sell Activation (checkTrailingStopSellActivation)

Update lot eligibility filtering:

```javascript
// Calculate lot-level profit requirement
let lotProfitRequirement = profitRequirement;
const isConsecutiveSell = lastSellPrice !== null && currentPrice > lastSellPrice;

if (enableConsecutiveIncrementalSellProfit && isConsecutiveSell) {
  let gridSize;
  if (enableDynamicGrid) {
    gridSize = calculateDynamicGridSpacing(
      currentPrice,
      referencePrice || currentPrice,
      dynamicGridMultiplier,
      normalizeToReference
    );
  } else {
    gridSize = gridIntervalPercent;
  }
  lotProfitRequirement = profitRequirement + gridSize;
}

// Filter eligible lots with dynamic reference price
const eligibleLots = lots.filter(lot => {
  let refPrice = isConsecutiveSell ? lastSellPrice : lot.price;
  return currentPrice > refPrice * (1 + lotProfitRequirement);
});
```

#### 3. Trailing Stop Update (updateTrailingStop)

Same logic as activation.

#### 4. Sell Execution

After sell executes, update state:

```javascript
// Update consecutive sell tracking
if (lastSellPrice !== null && executionPrice > lastSellPrice) {
  consecutiveSellCount++;
} else {
  consecutiveSellCount = 1;
}
lastSellPrice = executionPrice;
```

#### 5. Buy Execution

After buy executes, reset:

```javascript
lastSellPrice = null;
consecutiveSellCount = 0;
```

#### 6. Logging

Update logs to show:

- Whether sell is consecutive
- Reference price used (lot price vs lastSellPrice)
- consecutiveSellCount

### Frontend Changes

**No frontend changes needed** - uses existing UI controls.

## Success Criteria

1. **First sell after buy**: Uses lot purchase price as reference
2. **Consecutive sell in uptrend**: Uses lastSellPrice as reference with increased profit requirement
3. **Price decline**: Resets to lot purchase price reference with base profit requirement
4. **Buy resets state**: lastSellPrice → null, consecutiveSellCount → 0
5. **Logging clarity**: Shows which reference price and profit requirement used
6. **Higher profit capture**: More spacing between consecutive sells in uptrends

## Testing Strategy

1. **Test with SHOP backtest**: Verify consecutive sell behavior
2. **Compare old vs new**: Same params, check sell prices and spacing
3. **Edge cases**:
   - First sell after buy
   - Price decline after sell
   - Multiple consecutive sells
   - Buy after sells

## Expected Impact

**Old behavior:**

- Lot @ $317.54, lastSell $346, price $389, requirement 20%
- Threshold: $317.54 × 1.20 = $381.05
- **Sells at $389** ✓

**New behavior:**

- Lot @ $317.54, lastSell $346, price $389, requirement 20%
- Threshold: $346 × 1.20 = $415.20
- **Does NOT sell at $389** ✗ (waits for $415.20)

**Result**: Higher profit per sell, better "let winners run" behavior in strong uptrends.
