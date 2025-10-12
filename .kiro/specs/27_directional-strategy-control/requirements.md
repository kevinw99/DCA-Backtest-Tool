# Spec 27: Directional Strategy Control Flags

## Problem Statement

Currently, the system has three distinct trading strategies controlled by different specs:

- **Spec 17 (Incremental Buy Grid)**: Buy when price goes DOWN (dip buying / traditional DCA)
- **Spec 18 (Incremental Sell Profit)**: Sell when price goes UP (profit taking / traditional)
- **Spec 25 (Adaptive Trailing Stops)**: Buy when price goes UP and sell when price goes DOWN (momentum / adaptive)

However, there's no clean way to choose between traditional DCA (buy dips, sell rallies) and adaptive/momentum strategy (buy rallies, sell dips) without managing complex combinations of parameters.

Users need simple flags to control directional behavior for each strategy independently.

## Proposed Solution

Add two new **secondary flags** that act as hierarchical controls under the existing primary flags:

### 1. enableAdaptiveTrailingBuy

**Parent Flag**: `enableConsecutiveIncrementalBuyGrid`

**Behavior**:
- When `enableConsecutiveIncrementalBuyGrid = false`: This flag is **ignored** (no incremental buy logic)
- When `enableConsecutiveIncrementalBuyGrid = true`:
  - **`enableAdaptiveTrailingBuy = false`**: Buy ONLY when price goes DOWN (Spec 17 - traditional DCA)
  - **`enableAdaptiveTrailingBuy = true`**: Buy when price goes UP (Spec 25 - momentum buying)

### 2. enableAdaptiveTrailingSell

**Parent Flag**: `enableConsecutiveIncrementalSellProfit`

**Behavior**:
- When `enableConsecutiveIncrementalSellProfit = false`: This flag is **ignored** (no incremental sell logic)
- When `enableConsecutiveIncrementalSellProfit = true`:
  - **`enableAdaptiveTrailingSell = false`**: Sell ONLY when price goes UP (Spec 18 - traditional take profit)
  - **`enableAdaptiveTrailingSell = true`**: Sell when price goes DOWN (Spec 25 - adaptive stop loss)

## Strategy Combinations

This creates four distinct strategic approaches:

### 1. Traditional DCA (Conservative)
```
enableConsecutiveIncrementalBuyGrid = true
enableAdaptiveTrailingBuy = false
enableConsecutiveIncrementalSellProfit = true
enableAdaptiveTrailingSell = false
```
**Behavior**: Buy dips, Sell rallies (lower risk)

### 2. Momentum/Trend Following (Aggressive)
```
enableConsecutiveIncrementalBuyGrid = true
enableAdaptiveTrailingBuy = true
enableConsecutiveIncrementalSellProfit = true
enableAdaptiveTrailingSell = true
```
**Behavior**: Buy rallies, Sell dips (higher risk, trend-following)

### 3. Hybrid - Aggressive Accumulation, Conservative Exit
```
enableConsecutiveIncrementalBuyGrid = true
enableAdaptiveTrailingBuy = true
enableConsecutiveIncrementalSellProfit = true
enableAdaptiveTrailingSell = false
```
**Behavior**: Buy rallies (accumulate fast), Sell rallies (maximize profit)

### 4. Hybrid - Conservative Accumulation, Fast Exit
```
enableConsecutiveIncrementalBuyGrid = true
enableAdaptiveTrailingBuy = false
enableConsecutiveIncrementalSellProfit = true
enableAdaptiveTrailingSell = true
```
**Behavior**: Buy dips (preserve capital), Sell dips (cut losses fast)

## Detailed Requirements

### R1: Flag Behavior - Buy Direction Control

**enableAdaptiveTrailingBuy** (boolean, default: `false`)

**R1.1 When parent flag is disabled:**
```javascript
if (!enableConsecutiveIncrementalBuyGrid) {
  // enableAdaptiveTrailingBuy is ignored, no effect
}
```

**R1.2 When parent flag is enabled and enableAdaptiveTrailingBuy = false:**
```javascript
// TRADITIONAL DCA - Buy only when price goes DOWN
if (enableConsecutiveIncrementalBuyGrid && !enableAdaptiveTrailingBuy) {
  // Allow buy only if currentPrice < lastBuyPrice (or lastBuyPrice === null)
  // This is Spec 17 behavior
  if (lastBuyPrice !== null && currentPrice >= lastBuyPrice) {
    // BLOCK buy - price not declining
    return;
  }
  // Allow buy - price is declining
}
```

**R1.3 When parent flag is enabled and enableAdaptiveTrailingBuy = true:**
```javascript
// ADAPTIVE - Buy when price goes UP
if (enableConsecutiveIncrementalBuyGrid && enableAdaptiveTrailingBuy) {
  // Allow buy when currentPrice > lastBuyPrice
  // This is Spec 25 behavior
  if (lastBuyPrice !== null && currentPrice > lastBuyPrice) {
    // Use adaptive trailing stop logic:
    // - Skip activation check
    // - Use tighter rebound percentage
  }
  // Also allow buy when price goes down (first buy or downtrend)
}
```

### R2: Flag Behavior - Sell Direction Control

**enableAdaptiveTrailingSell** (boolean, default: `false`)

**R2.1 When parent flag is disabled:**
```javascript
if (!enableConsecutiveIncrementalSellProfit) {
  // enableAdaptiveTrailingSell is ignored, no effect
}
```

**R2.2 When parent flag is enabled and enableAdaptiveTrailingSell = false:**
```javascript
// TRADITIONAL - Sell only when price goes UP
if (enableConsecutiveIncrementalSellProfit && !enableAdaptiveTrailingSell) {
  // Allow sell only if currentPrice > lastSellPrice (or lastSellPrice === null)
  // This is Spec 18 behavior
  if (lastSellPrice !== null && currentPrice <= lastSellPrice) {
    // BLOCK sell - price not rising
    return;
  }
  // Allow sell - price is rising
}
```

**R2.3 When parent flag is enabled and enableAdaptiveTrailingSell = true:**
```javascript
// ADAPTIVE - Sell when price goes DOWN
if (enableConsecutiveIncrementalSellProfit && enableAdaptiveTrailingSell) {
  // Allow sell when currentPrice < lastSellPrice
  // This is Spec 25 behavior
  if (lastSellPrice !== null && currentPrice < lastSellPrice) {
    // Use adaptive trailing stop logic:
    // - Skip activation check
    // - Skip profit requirement
    // - Use tighter pullback percentage
  }
  // Also allow sell when price goes up (first sell or uptrend)
}
```

### R3: Integration with Existing Specs

**R3.1 Spec 17 (Incremental Buy Grid)**:
- When `enableAdaptiveTrailingBuy = false`: Spec 17 logic applies (buy dips only)
- When `enableAdaptiveTrailingBuy = true`: Spec 17 grid spacing still applies, but allow uptrend buys

**R3.2 Spec 18 (Incremental Sell Profit)**:
- When `enableAdaptiveTrailingSell = false`: Spec 18 logic applies (sell rallies only)
- When `enableAdaptiveTrailingSell = true`: Spec 18 profit requirements still apply, but allow downtrend sells

**R3.3 Spec 25 (Adaptive Trailing Stops)**:
- When `enableAdaptiveTrailingBuy = true`: Spec 25 buy logic activates
- When `enableAdaptiveTrailingSell = true`: Spec 25 sell logic activates
- When both are `false`: Spec 25 adaptive behavior is disabled

**R3.4 Spec 26 (Position-Based Adaptive Behavior)**:
- Position-based gating still applies when adaptive flags are enabled
- P/L status determines when adaptive behavior is allowed

### R4: Logging Requirements

**R4.1 Log flag status on backtest start:**
```
🎯 Directional Strategy Control:
   Buy Direction: ADAPTIVE (uptrend buying enabled)
   Sell Direction: TRADITIONAL (uptrend selling only)
```

**R4.2 Log direction-based decisions:**
```
🔼 BUY ALLOWED - Adaptive uptrend buy (price: $150 > last: $140)
🚫 SELL BLOCKED - Traditional mode, price not rising (price: $140 <= last: $145)
```

**R4.3 Log in transaction history:**
- Show which directional mode was active for each trade
- Indicate if trade was adaptive or traditional

### R5: Default Values

Both flags default to `false` to maintain backward compatibility:

```json
{
  "enableAdaptiveTrailingBuy": false,
  "enableAdaptiveTrailingSell": false
}
```

This preserves existing behavior:
- Spec 17 behavior by default (buy dips)
- Spec 18 behavior by default (sell rallies)
- Spec 25 requires explicit opt-in

## Implementation Details

### Backend Changes

#### 1. Add to backtestDefaults.json
```json
{
  "enableAdaptiveTrailingBuy": false,
  "enableAdaptiveTrailingSell": false
}
```

#### 2. Update validation.js
```javascript
enableAdaptiveTrailingBuy: {
  type: 'boolean',
  optional: true,
  default: false,
  description: 'Enable adaptive trailing buy (buy in uptrends) when enableConsecutiveIncrementalBuyGrid is true'
},
enableAdaptiveTrailingSell: {
  type: 'boolean',
  optional: true,
  default: false,
  description: 'Enable adaptive trailing sell (sell in downtrends) when enableConsecutiveIncrementalSellProfit is true'
}
```

#### 3. Update dcaBacktestService.js

**Add direction check for buys:**
```javascript
// Check if buy is allowed based on price direction
function isBuyAllowedByDirection(currentPrice, lastBuyPrice, enableAdaptiveTrailingBuy) {
  if (!enableConsecutiveIncrementalBuyGrid) {
    return true; // No directional restrictions
  }

  if (lastBuyPrice === null) {
    return true; // First buy always allowed
  }

  if (enableAdaptiveTrailingBuy) {
    // Adaptive mode: allow both up and down
    return true;
  } else {
    // Traditional mode: only allow when price going down
    return currentPrice < lastBuyPrice;
  }
}
```

**Add direction check for sells:**
```javascript
// Check if sell is allowed based on price direction
function isSellAllowedByDirection(currentPrice, lastSellPrice, enableAdaptiveTrailingSell) {
  if (!enableConsecutiveIncrementalSellProfit) {
    return true; // No directional restrictions
  }

  if (lastSellPrice === null) {
    return true; // First sell always allowed
  }

  if (enableAdaptiveTrailingSell) {
    // Adaptive mode: allow both up and down
    return true;
  } else {
    // Traditional mode: only allow when price going up
    return currentPrice > lastSellPrice;
  }
}
```

**Apply adaptive logic based on flags:**
```javascript
// Determine if adaptive buy logic should apply
const useAdaptiveBuy = enableConsecutiveIncrementalBuyGrid &&
                       enableAdaptiveTrailingBuy &&
                       lastBuyPrice !== null &&
                       currentPrice > lastBuyPrice;

if (useAdaptiveBuy) {
  // Apply Spec 25 adaptive buy logic:
  // - Skip activation check
  // - Use tighter rebound
}

// Determine if adaptive sell logic should apply
const useAdaptiveSell = enableConsecutiveIncrementalSellProfit &&
                        enableAdaptiveTrailingSell &&
                        lastSellPrice !== null &&
                        currentPrice < lastSellPrice;

if (useAdaptiveSell) {
  // Apply Spec 25 adaptive sell logic:
  // - Skip activation check
  // - Skip profit requirement
  // - Use tighter pullback
}
```

### Frontend Changes

#### 1. Add UI controls in DCABacktestForm.js

Under the "Long Strategy Parameters" section:

```javascript
{/* Adaptive Trailing Buy */}
{formData.enableConsecutiveIncrementalBuyGrid && (
  <div className="form-group">
    <label className="checkbox-label">
      <input
        type="checkbox"
        name="enableAdaptiveTrailingBuy"
        checked={formData.enableAdaptiveTrailingBuy || false}
        onChange={handleInputChange}
      />
      <span className="checkbox-text">
        Enable Adaptive Trailing Buy
        <span className="help-icon" title="When enabled: buy in uptrends (momentum). When disabled: buy only in downtrends (traditional DCA)">ⓘ</span>
      </span>
    </label>
  </div>
)}

{/* Adaptive Trailing Sell */}
{formData.enableConsecutiveIncrementalSellProfit && (
  <div className="form-group">
    <label className="checkbox-label">
      <input
        type="checkbox"
        name="enableAdaptiveTrailingSell"
        checked={formData.enableAdaptiveTrailingSell || false}
        onChange={handleInputChange}
      />
      <span className="checkbox-text">
        Enable Adaptive Trailing Sell
        <span className="help-icon" title="When enabled: sell in downtrends (cut losses). When disabled: sell only in uptrends (traditional profit taking)">ⓘ</span>
      </span>
    </label>
  </div>
)}
```

**Key UI behaviors**:
- Only show `enableAdaptiveTrailingBuy` when `enableConsecutiveIncrementalBuyGrid` is checked
- Only show `enableAdaptiveTrailingSell` when `enableConsecutiveIncrementalSellProfit` is checked
- Use clear tooltips explaining traditional vs adaptive behavior

#### 2. Update URL parameter handling

Add to URL encoding/decoding:
```javascript
enableAdaptiveTrailingBuy: params.get('enableAdaptiveTrailingBuy') === 'true',
enableAdaptiveTrailingSell: params.get('enableAdaptiveTrailingSell') === 'true',
```

### Batch Mode Support

#### 1. Add to batch parameter matrix

```javascript
batchParams: {
  enableAdaptiveTrailingBuy: [false, true],
  enableAdaptiveTrailingSell: [false, true]
}
```

#### 2. Display in batch results

Add columns:
- "Adaptive Buy"
- "Adaptive Sell"

## Success Criteria

### SC1: Correct Directional Behavior

**Traditional Buy (enableAdaptiveTrailingBuy = false)**:
- ✅ Buy executes when `currentPrice < lastBuyPrice`
- ✅ Buy blocked when `currentPrice >= lastBuyPrice`
- ✅ First buy (lastBuyPrice = null) always allowed

**Adaptive Buy (enableAdaptiveTrailingBuy = true)**:
- ✅ Buy executes when `currentPrice > lastBuyPrice` with adaptive logic
- ✅ Buy also executes when `currentPrice < lastBuyPrice` (no blocking)
- ✅ Adaptive trailing parameters apply in uptrends

**Traditional Sell (enableAdaptiveTrailingSell = false)**:
- ✅ Sell executes when `currentPrice > lastSellPrice`
- ✅ Sell blocked when `currentPrice <= lastSellPrice`
- ✅ First sell (lastSellPrice = null) always allowed

**Adaptive Sell (enableAdaptiveTrailingSell = true)**:
- ✅ Sell executes when `currentPrice < lastSellPrice` with adaptive logic
- ✅ Sell also executes when `currentPrice > lastSellPrice` (no blocking)
- ✅ Adaptive trailing parameters apply in downtrends

### SC2: Parent Flag Dependency

- ✅ When `enableConsecutiveIncrementalBuyGrid = false`, `enableAdaptiveTrailingBuy` has no effect
- ✅ When `enableConsecutiveIncrementalSellProfit = false`, `enableAdaptiveTrailingSell` has no effect

### SC3: Backward Compatibility

- ✅ Default values (`false`) preserve existing Spec 17 and Spec 18 behavior
- ✅ Existing backtests without these flags behave identically
- ✅ No breaking changes to current strategy logic

### SC4: Integration

- ✅ Works with Spec 26 position-based gating
- ✅ Works with all other DCA features
- ✅ Logging clearly shows which mode is active
- ✅ UI conditionally shows/hides based on parent flags

### SC5: Testing

- ✅ Test all four strategy combinations
- ✅ Verify direction blocking works correctly
- ✅ Verify adaptive logic applies when appropriate
- ✅ Compare traditional vs adaptive results for same stock

## Examples

### Example 1: Traditional DCA (Buy Dips, Sell Rallies)

**Configuration**:
```javascript
enableConsecutiveIncrementalBuyGrid: true
enableAdaptiveTrailingBuy: false  // Traditional
enableConsecutiveIncrementalSellProfit: true
enableAdaptiveTrailingSell: false  // Traditional
```

**Behavior**:
```
Day 1: Price $100 → BUY (first buy, always allowed)
Day 2: Price $110 → NO BUY (price > last buy $100, blocked in traditional mode)
Day 3: Price $95  → BUY (price < last buy $100, allowed)
Day 4: Price $120 → SELL (price > buy avg, allowed)
Day 5: Price $115 → NO SELL (price < last sell $120, blocked in traditional mode)
Day 6: Price $125 → SELL (price > last sell $120, allowed)
```

### Example 2: Momentum Strategy (Buy Rallies, Sell Dips)

**Configuration**:
```javascript
enableConsecutiveIncrementalBuyGrid: true
enableAdaptiveTrailingBuy: true  // Adaptive
enableConsecutiveIncrementalSellProfit: true
enableAdaptiveTrailingSell: true  // Adaptive
```

**Behavior**:
```
Day 1: Price $100 → BUY (first buy, always allowed)
Day 2: Price $110 → BUY (price > last buy $100, adaptive uptrend buy)
Day 3: Price $115 → BUY (price > last buy $110, adaptive continues)
Day 4: Price $120 → SELL (price > buy avg, allowed)
Day 5: Price $115 → SELL (price < last sell $120, adaptive downtrend sell)
Day 6: Price $110 → SELL (price < last sell $115, adaptive continues)
```

### Example 3: Hybrid - Aggressive Accumulation, Conservative Exit

**Configuration**:
```javascript
enableConsecutiveIncrementalBuyGrid: true
enableAdaptiveTrailingBuy: true  // Adaptive buys
enableConsecutiveIncrementalSellProfit: true
enableAdaptiveTrailingSell: false  // Traditional sells
```

**Behavior**:
```
Day 1: Price $100 → BUY (first buy)
Day 2: Price $110 → BUY (adaptive uptrend buy)
Day 3: Price $115 → BUY (adaptive continues)
Day 4: Price $120 → SELL (first sell)
Day 5: Price $115 → NO SELL (traditional mode, price < last sell)
Day 6: Price $125 → SELL (traditional mode, price > last sell)
```

Result: Fast accumulation on uptrend, but only take profits on continued uptrend

## Risk Mitigation

### R1: Clear Documentation
- Comprehensive tooltips in UI
- Clear logging showing which mode is active
- Examples in documentation

### R2: Safe Defaults
- Both flags default to `false` (traditional, conservative)
- Requires explicit opt-in for adaptive behavior

### R3: Hierarchical Control
- Secondary flags only work when primary flags enabled
- Prevents accidental activation

### R4: Backward Compatibility
- No changes to existing behavior without explicit flag changes
- All existing tests pass

## Out of Scope

- No new adaptive logic (uses existing Spec 25)
- No changes to grid spacing calculations (Spec 17)
- No changes to profit requirement calculations (Spec 18)
- No changes to position-based gating (Spec 26)

## Dependencies

- Spec 17: Consecutive Incremental Buy Grid
- Spec 18: Revised Consecutive Incremental Sell Profit
- Spec 25: Adaptive Trailing Stops
- Spec 26: Position-Based Adaptive Behavior (optional integration)

## Testing Strategy

### Unit Tests
- Test direction blocking logic
- Test adaptive flag activation
- Test parent flag dependency

### Integration Tests
- Test all four strategy combinations
- Verify adaptive logic applies correctly
- Verify traditional logic preserved

### Comparison Tests
- Same stock, compare traditional vs adaptive results
- Verify performance differences align with expectations

### Regression Tests
- Verify existing backtests unchanged when flags = false
- Verify no breaking changes
