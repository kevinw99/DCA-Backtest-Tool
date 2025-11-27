# Spec 25: Adaptive Trailing Stops - Design Document

## Architecture Overview

This feature enhances existing consecutive trade logic with **direction-aware adaptive trailing stop parameters**. No new parameters or UI changes required - it automatically activates when consecutive features are enabled.

## Design Principles

1. **Zero Configuration** - Uses existing feature flags, no new parameters
2. **Trend Responsive** - Reduces friction during favorable price movements
3. **Safe Defaults** - Enforces minimum thresholds to prevent over-tightening
4. **Transparent** - Full logging of adaptive behavior
5. **Non-Breaking** - Only affects trades when consecutive features enabled

## State Management

### New State Variables

```javascript
// Adaptive Sell State
let lastSellPrice = null;          // Price of most recent sell execution
let lastSellPullback = null;       // Last used pullback % (for decay calculation)

// Adaptive Buy State
// lastBuyPrice already exists in current implementation
let lastBuyRebound = null;         // Last used rebound % (for decay calculation)
```

### State Lifecycle

**Sell State:**
- Initialize `lastSellPullback = trailingSellPullbackPercent` on first consecutive sell
- Update `lastSellPrice` after each sell execution
- Reset both to `null` when `consecutiveSellCount` resets to 0

**Buy State:**
- Initialize `lastBuyRebound = trailingBuyReboundPercent` on first consecutive buy
- Update `lastBuyPrice` after each buy execution (already exists)
- Reset `lastBuyRebound` to `null` when `consecutiveBuyCount` resets to 0

## Algorithms

### Adaptive Sell Trailing Stop

```javascript
function calculateAdaptiveSellParameters(
  currentPrice,
  lastSellPrice,
  trailingSellActivationPercent,
  trailingSellPullbackPercent,
  lastSellPullback,
  consecutiveSellCount,
  enableConsecutiveIncrementalSellProfit
) {
  // Default to standard parameters
  let activation = trailingSellActivationPercent;
  let pullback = trailingSellPullbackPercent;

  // Only apply adaptive logic if consecutive feature enabled and we have a previous sell
  if (!enableConsecutiveIncrementalSellProfit || consecutiveSellCount === 0 || !lastSellPrice) {
    return { activation, pullback, isAdaptive: false, direction: 'none' };
  }

  // Determine price direction
  const isDowntrend = currentPrice < lastSellPrice;

  if (isDowntrend) {
    // CASE 1: Price falling - exit faster
    activation = 0;  // Skip activation check
    const skipProfitRequirement = true;  // Skip profit requirement

    // Calculate decayed pullback
    const basePullback = lastSellPullback || trailingSellPullbackPercent;
    const decayedPullback = basePullback * 0.5;
    const minPullback = 0.02;  // 2% minimum
    pullback = Math.max(decayedPullback, minPullback);

    return {
      activation,
      pullback,
      skipProfitRequirement,
      isAdaptive: true,
      direction: 'down',
      previousPullback: basePullback
    };
  }

  // CASE 2: Price rising - standard behavior
  return {
    activation,
    pullback,
    skipProfitRequirement: false,
    isAdaptive: false,
    direction: 'up'
  };
}
```

### Adaptive Buy Trailing Stop

```javascript
function calculateAdaptiveBuyParameters(
  currentPrice,
  lastBuyPrice,
  trailingBuyActivationPercent,
  trailingBuyReboundPercent,
  lastBuyRebound,
  consecutiveBuyCount,
  enableConsecutiveIncrementalBuyGrid
) {
  // Default to standard parameters
  let activation = trailingBuyActivationPercent;
  let rebound = trailingBuyReboundPercent;

  // Only apply adaptive logic if consecutive feature enabled and we have a previous buy
  if (!enableConsecutiveIncrementalBuyGrid || consecutiveBuyCount === 0 || !lastBuyPrice) {
    return { activation, rebound, isAdaptive: false, direction: 'none' };
  }

  // Determine price direction
  const isUptrend = currentPrice > lastBuyPrice;

  if (isUptrend) {
    // CASE 1: Price rising - accumulate faster
    activation = 0;  // Skip activation check

    // Calculate decayed rebound
    const baseRebound = lastBuyRebound || trailingBuyReboundPercent;
    const decayedRebound = baseRebound * 0.8;
    const minRebound = 0.05;  // 5% minimum
    rebound = Math.max(decayedRebound, minRebound);

    return {
      activation,
      rebound,
      isAdaptive: true,
      direction: 'up',
      previousRebound: baseRebound
    };
  }

  // CASE 2: Price falling - standard behavior
  return {
    activation,
    rebound,
    isAdaptive: false,
    direction: 'down'
  };
}
```

## Integration Points

### Location: `dcaBacktestService.js`

#### Point 1: State Initialization (around line 600)

```javascript
// Existing state
let consecutiveSellCount = 0;
let consecutiveBuyCount = 0;
let lastBuyPrice = null;  // Already exists

// NEW: Adaptive trailing stop state
let lastSellPrice = null;
let lastSellPullback = null;
let lastBuyRebound = null;
```

#### Point 2: Sell Logic Integration (around line 1050-1100)

```javascript
// Before executing sell
if (enableConsecutiveIncrementalSellProfit && consecutiveSellCount > 0) {
  // NEW: Calculate adaptive parameters
  const adaptiveParams = calculateAdaptiveSellParameters(
    currentPrice,
    lastSellPrice,
    trailingSellActivationPercent,
    trailingSellPullbackPercent,
    lastSellPullback,
    consecutiveSellCount,
    enableConsecutiveIncrementalSellProfit
  );

  // Use adaptive parameters for this sell
  if (adaptiveParams.isAdaptive) {
    console.log(`🎯 Adaptive Sell: Direction=${adaptiveParams.direction}, ` +
                `Activation=${(adaptiveParams.activation * 100).toFixed(1)}%, ` +
                `Pullback=${(adaptiveParams.pullback * 100).toFixed(1)}% ` +
                `(was ${(adaptiveParams.previousPullback * 100).toFixed(1)}%), ` +
                `ProfitReq=${adaptiveParams.skipProfitRequirement ? 'SKIPPED' : 'Required'}`);

    // Override trailing stop parameters for this trade
    const tempActivation = adaptiveParams.activation;
    const tempPullback = adaptiveParams.pullback;
    const tempSkipProfit = adaptiveParams.skipProfitRequirement;

    // ... use tempActivation, tempPullback, and tempSkipProfit in trailing stop logic

    // Update last pullback for next iteration
    lastSellPullback = adaptiveParams.pullback;
  }
}

// After sell execution
if (sellExecuted) {
  lastSellPrice = sellPrice;  // NEW: Track for next iteration
}
```

#### Point 3: Buy Logic Integration (around line 750-900)

```javascript
// Before executing buy
if (enableConsecutiveIncrementalBuyGrid && consecutiveBuyCount > 0) {
  // NEW: Calculate adaptive parameters
  const adaptiveParams = calculateAdaptiveBuyParameters(
    currentPrice,
    lastBuyPrice,
    trailingBuyActivationPercent,
    trailingBuyReboundPercent,
    lastBuyRebound,
    consecutiveBuyCount,
    enableConsecutiveIncrementalBuyGrid
  );

  // Use adaptive parameters for this buy
  if (adaptiveParams.isAdaptive) {
    console.log(`🎯 Adaptive Buy: Direction=${adaptiveParams.direction}, ` +
                `Activation=${(adaptiveParams.activation * 100).toFixed(1)}%, ` +
                `Rebound=${(adaptiveParams.rebound * 100).toFixed(1)}% ` +
                `(was ${(adaptiveParams.previousRebound * 100).toFixed(1)}%)`);

    // Override trailing stop parameters for this trade
    const tempActivation = adaptiveParams.activation;
    const tempRebound = adaptiveParams.rebound;

    // ... use tempActivation and tempRebound in trailing stop logic

    // Update last rebound for next iteration
    lastBuyRebound = adaptiveParams.rebound;
  }
}

// After buy execution (already exists)
lastBuyPrice = buyPrice;
```

#### Point 4: State Reset Logic

```javascript
// When consecutive sell count resets
if (consecutiveSellCount === 0) {
  lastSellPrice = null;      // NEW
  lastSellPullback = null;   // NEW
}

// When consecutive buy count resets
if (consecutiveBuyCount === 0) {
  lastBuyPrice = null;       // Already exists
  lastBuyRebound = null;     // NEW
}
```

## Edge Cases

### E1: First Consecutive Trade
- **Scenario:** `consecutiveCount = 1`, no previous trade
- **Behavior:** Use standard parameters (adaptive logic skipped)
- **Reason:** Need baseline for comparison

### E2: Direction Reversal
- **Scenario:** Price was falling, now rising (or vice versa)
- **Behavior:** Revert to standard parameters, reset decay state
- **Implementation:** Check direction each iteration

### E3: Minimum Threshold Reached
- **Scenario:** Decay formula produces value below minimum
- **Behavior:** Clamp to minimum (2% sell, 5% buy)
- **Implementation:** `Math.max(decayed, minimum)`

### E4: Feature Disabled Mid-Backtest
- **Scenario:** Consecutive feature is disabled
- **Behavior:** Adaptive logic automatically disabled, state persists but unused
- **Reason:** Feature flags checked every iteration

### E5: Multiple Consecutive Cycles
- **Scenario:** Sequence ends, then starts again
- **Behavior:** State resets, starts fresh from base parameters
- **Implementation:** Reset logic tied to `consecutiveCount === 0`

## Data Flow

```
Trade Execution
       ↓
Update lastSellPrice / lastBuyPrice
       ↓
Next Trade Opportunity
       ↓
Check consecutive feature enabled?
       ↓ (yes)
Calculate adaptive parameters
  • Compare current vs last price
  • Determine direction
  • Apply decay if favorable direction
  • Enforce minimum threshold
       ↓
Use adaptive parameters for trailing stop
       ↓
Update lastPullback / lastRebound
       ↓
Execute trade
       ↓
Update state for next iteration
```

## Logging Strategy

### Log Levels

**INFO (always):**
- When adaptive mode activates
- Direction detection
- Parameter adjustments

**DEBUG (verbose mode):**
- Decay calculations
- Threshold enforcement
- State transitions

### Log Format

```javascript
// Adaptive activation
console.log(`🎯 Adaptive Sell: Direction=down, Activation=0.0%, Pullback=2.5% (was 5.0%)`);

// State update
if (verbose) {
  console.log(`  DEBUG: lastSellPrice=${lastSellPrice.toFixed(2)}, ` +
              `lastSellPullback=${(lastSellPullback * 100).toFixed(1)}%`);
}

// Direction change
console.log(`📊 Trend Reversal: Sell direction changed from down to up, ` +
            `reverting to standard parameters`);
```

## Performance Considerations

- **Computation:** Minimal overhead (simple comparisons and multiplications)
- **Memory:** 3 additional state variables (negligible impact)
- **Complexity:** O(1) per iteration, no loops or recursive calls

## Backward Compatibility

- ✅ No impact when consecutive features disabled
- ✅ No new parameters required
- ✅ Existing backtests reproduce exactly if features not used
- ✅ No database schema changes
- ✅ No API changes

## Testing Strategy

### Unit Tests

1. Test decay formulas reach minimum thresholds
2. Test direction detection logic
3. Test state reset on count change
4. Test first trade behavior (no adaptation)

### Integration Tests

1. Backtest with consecutive sells during downtrend
2. Backtest with consecutive buys during uptrend
3. Verify standard behavior during unfavorable trends
4. Test direction reversal scenarios

### Validation

Compare backtests with/without consecutive features to verify:
- Faster exits during sell downtrends
- Faster accumulation during buy uptrends
- No change in non-consecutive trades

## Implementation Notes

1. Implement helper functions first (calculate adaptive parameters)
2. Add state variables to initialization section
3. Integrate into sell logic, then buy logic separately
4. Add comprehensive logging throughout
5. Test each scenario thoroughly before moving to next

## Constants

```javascript
// Adaptive trailing stop constants
const ADAPTIVE_SELL_PULLBACK_DECAY = 0.5;    // 50% decay per iteration
const ADAPTIVE_BUY_REBOUND_DECAY = 0.8;      // 20% decay per iteration
const MIN_ADAPTIVE_SELL_PULLBACK = 0.02;     // 2% minimum
const MIN_ADAPTIVE_BUY_REBOUND = 0.05;       // 5% minimum
```
