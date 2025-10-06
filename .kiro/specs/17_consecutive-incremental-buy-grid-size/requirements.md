# Consecutive Incremental Buy Grid Size - Requirements

## Problem Statement

Current DCA strategy uses a fixed grid interval for all buy orders, which doesn't adapt to consecutive buying during downtrends. This leads to:

- **Equal spacing regardless of trend strength**: Missing opportunity to space out buys more during extended downtrends
- **Fixed capital deployment pattern**: Not adapting buy spacing based on how far price has fallen
- **Inefficient use of capital during crashes**: Could benefit from wider spacing as consecutive buys increase

The goal is to implement **incremental grid spacing** that increases with each consecutive buy, allowing the strategy to "spread out" purchases more as price continues to decline.

## Core Concept

**Incremental Grid Spacing on Consecutive Downtrend Buys**

When executing consecutive buys with declining prices, progressively increase the grid spacing by adding an increment for each consecutive buy. This creates wider spacing as more buys are executed during downtrends.

### Formula

```
next_consecutive_buy_grid_size = base_grid_size + (ith * grid_consecutive_increment)

where:
  - base_grid_size = gridIntervalPercent (e.g., 0.10 for 10%)
  - ith = consecutive buy count (0, 1, 2, 3, ...)
  - grid_consecutive_increment = new parameter (default 0.05 for 5%)
```

### Key Conditions

The grid spacing increases **ONLY** when **BOTH** conditions are met:

1. **Consecutive buy**: The last action was a buy (no sell in between)
2. **Price going down**: Current buy price < last buy price

If either condition fails, reset to base grid size.

### Consecutive Buy Restrictions

**IMPORTANT**: These restrictions apply **regardless of whether `enableConsecutiveIncrementalBuyGrid` is enabled or disabled**.

1. **Price restriction when `lastBuyPrice` exists (not null)**:
   - Buy orders can **ONLY** execute when `currentPrice < lastBuyPrice`
   - This applies whether `consecutiveBuyCount > 0` or `consecutiveBuyCount = 0`
   - If price rises above or equals last buy price, the trailing stop buy is **canceled**

2. **Consecutive buy count resets to 0 when**:
   - **A.** A sell order executes
     - Reset both `consecutiveBuyCount = 0` and `lastBuyPrice = null`
   - **B.** A buy order executes at a price >= average cost of all held lots
     - This buy must still respect **base grid spacing** from all existing lots
     - After this buy executes, reset `consecutiveBuyCount = 0`
     - **Keep `lastBuyPrice` unchanged** (do NOT reset to null)
     - This allows next buy to use base grid, but still requires price < lastBuyPrice

3. **After count reset (consecutiveBuyCount = 0)**:
   - If `lastBuyPrice = null` (after sell): Next buy can execute at any price (only grid spacing required)
   - If `lastBuyPrice` is kept (after buy >= avg cost): Next buy still requires price < lastBuyPrice
   - Grid size always uses base grid when count = 0

## Detailed Requirements

### 1. Configuration

**New Parameters**:

- **`enableConsecutiveIncrementalBuyGrid`** (boolean, default: `false`)
  - When `true`: Apply incremental grid spacing on consecutive downtrend buys
  - When `false`: Use fixed grid spacing (legacy behavior)

- **`gridConsecutiveIncrement`** (decimal, default: `0.05` for 5%)
  - Amount to add to base grid for each consecutive buy
  - Example: If base grid is 10% and increment is 5%:
    - 1st buy: 10% grid
    - 2nd consecutive buy: 15% grid (10% + 5%)
    - 3rd consecutive buy: 20% grid (10% + 2×5%)

**Existing Parameters Used**:

- `gridIntervalPercent`: Base grid size (e.g., 0.10 for 10%)

### 2. State Tracking

Track the following variables during backtest:

- **`consecutiveBuyCount`**: number
  - Initialized to `0` at start
  - Incremented after each buy execution
  - Reset to `0` when:
    - A sell order executes, OR
    - Price rises above average cost of all held lots

- **`lastBuyPrice`**: number | null
  - Initialized to `null` at start
  - Updated to the buy price after every buy execution
  - Reset to `null` when consecutiveBuyCount is reset
  - Used to enforce consecutive buy price restriction (buy only when currentPrice < lastBuyPrice)

### 3. Grid Size Calculation Logic

#### Price Restriction Check Before Buy Execution

**CRITICAL**: Before executing any buy order, check price restrictions:

```javascript
// PRICE RESTRICTION CHECK
// If lastBuyPrice exists, only allow buys when price < lastBuyPrice
// This applies regardless of consecutiveBuyCount value
if (lastBuyPrice !== null && currentPrice >= lastBuyPrice) {
  // Block the buy and cancel trailing stop buy
  if (verbose) {
    const countMsg = consecutiveBuyCount > 0 ? `count: ${consecutiveBuyCount}` : `count: 0`;
    log(`BLOCKED: Buy prevented - Price ${currentPrice} >= last buy ${lastBuyPrice} (${countMsg})`);
  }
  cancelTrailingStopBuy();
  return false; // Do not execute buy
}
```

#### Reset Consecutive Buy Count

Reset **ONLY** when:

**A. After sell execution:**

```javascript
// After sell executes
consecutiveBuyCount = 0;
lastBuyPrice = null;
```

**B. After buy execution at price >= average cost:**

```javascript
// After buy executes, check if we need to reset count
// IMPORTANT: Get OLD average cost BEFORE this buy was added
const oldAverageCost = calculateOldAverageCost(); // Before current buy

if (oldAverageCost > 0 && currentBuyPrice >= oldAverageCost) {
  // This buy was at or above average cost
  // Reset consecutive count but KEEP lastBuyPrice
  consecutiveBuyCount = 0;
  // Do NOT reset lastBuyPrice - keep the reference
  // Log the reset
}
```

**IMPORTANT**: Do NOT reset based on price movements alone. Only reset when an actual buy or sell executes.

#### Calculate Dynamic Grid Size

```javascript
// Calculate grid size for next buy
let nextGridSize = gridIntervalPercent; // Default to base

if (
  enableConsecutiveIncrementalBuyGrid &&
  consecutiveBuyCount > 0 &&
  lastBuyPrice !== null &&
  currentBuyPrice < lastBuyPrice
) {
  // Consecutive downtrend buy - apply incremental spacing
  nextGridSize = gridIntervalPercent + consecutiveBuyCount * gridConsecutiveIncrement;
}
```

**Reset conditions** (nextGridSize = gridIntervalPercent):

- No previous buy (first buy, consecutiveBuyCount = 0)
- Last action was a sell (consecutiveBuyCount reset to 0)
- Previous buy was at or above average cost (consecutiveBuyCount reset to 0)
- Current buy price ≥ last buy price (price not declining - incremental grid not applicable)

#### Calculate Next Buy Price

```javascript
// For trailing stop buy system
const nextBuyPrice = currentBuyPrice * (1 - nextGridSize);
```

### 4. Integration with Trailing Stop Buy System

**Current trailing stop buy logic**:

- Activates when price drops by `trailingBuyActivationPercent` from peak
- Sets stop price at `currentPrice * (1 + trailingBuyReboundPercent)`
- Executes when price rebounds to stop price

**Enhanced with incremental grid**:

- After buy execution, calculate next buy trigger using incremental grid size
- Grid spacing check ensures new buy respects the calculated spacing
- Consecutive buy count affects the minimum spacing for next buy

### 5. Examples

#### Example 1: Consecutive Downtrend Buys

**Configuration**:

- `gridIntervalPercent`: 0.10 (10%)
- `gridConsecutiveIncrement`: 0.05 (5%)
- `enableConsecutiveIncrementalBuyGrid`: true

**Scenario**:

| Step | Event       | Price  | Last Buy | Consecutive Count | Grid Size      | Next Buy Trigger | Action |
| ---- | ----------- | ------ | -------- | ----------------- | -------------- | ---------------- | ------ |
| 1    | First buy   | $100   | null     | 0→1               | 10%            | $90              | BUY    |
| 2    | Price drops | $90    | $100     | 1                 | 15% (10%+1×5%) | $76.50           | BUY    |
| 3    | Price drops | $76.50 | $90      | 2                 | 20% (10%+2×5%) | $61.20           | BUY    |
| 4    | Price drops | $61.20 | $76.50   | 3                 | 25% (10%+3×5%) | $45.90           | BUY    |
| 5    | **Sell**    | $70    | $61.20   | 3→0               | -              | -                | SELL   |
| 6    | Price drops | $65    | null     | 0                 | 10% (reset)    | $58.50           | BUY    |

**Key observations**:

- Grid spacing increases with each consecutive buy during downtrend
- Sell resets consecutive count to 0
- After sell, next buy uses base 10% grid

#### Example 2: Grid Size Reset After Sell

**Scenario**:

| Step | Event            | Price | Last Buy | Consecutive | Grid Size Calc                | Next Buy At | Action            |
| ---- | ---------------- | ----- | -------- | ----------- | ----------------------------- | ----------- | ----------------- |
| 1    | First buy        | $100  | null     | 0→1         | 10% (base)                    | $90         | BUY               |
| 2    | Price drops      | $90   | $100     | 1→2         | 15% (10% + 1×5%)              | $76.50      | BUY               |
| 3    | Price rebounds   | $95   | $90      | 2           | -                             | -           | -                 |
| 4    | Price drops      | $85   | $90      | 2           | -                             | -           | NO BUY (> $76.50) |
| 5    | Price continues  | $76   | $90      | 2→3         | 20% (10% + 2×5%, consecutive) | $60.80      | BUY               |
| 6    | **SELL happens** | $80   | $76      | 3→0         | -                             | -           | SELL              |
| 7    | Price drops      | $75   | null     | 0→1         | 10% (base, reset after sell)  | $67.50      | BUY               |

**Key observations**:

- Grid size determines the trigger price for next buy
- Buy only executes when price reaches the calculated trigger price
- Consecutive count increments only when buy executes
- Grid resets to base after a sell (step 7)

#### Example 3: Consecutive Buy Restrictions

**Configuration**:

- `gridIntervalPercent`: 0.10 (10%)
- `gridConsecutiveIncrement`: 0.05 (5%)
- `enableConsecutiveIncrementalBuyGrid`: true

**Scenario**: Downtrend followed by price recovery

| Day | Event              | Price | Avg Cost | Last Buy | Consecutive | Action                              | Reason                                           |
| --- | ------------------ | ----- | -------- | -------- | ----------- | ----------------------------------- | ------------------------------------------------ |
| 1   | First buy          | $100  | $100     | null     | 0→1         | BUY                                 | First buy (count=0)                              |
| 2   | Price drops        | $90   | $100     | $100     | 1→2         | BUY                                 | $90 < $100 (last buy), grid met                  |
| 3   | Price drops        | $76   | $88.67   | $90      | 2→3         | BUY                                 | $76 < $90 (last buy), grid met                   |
| 4   | Price rises        | $80   | $88.67   | $76      | 3           | BLOCKED                             | $80 >= $76 (last buy), consecutive mode          |
| 5   | Price rises        | $85   | $88.67   | $76      | 3           | BLOCKED                             | $85 >= $76 (last buy), consecutive mode          |
| 6   | Price rises        | $92   | $88.67   | $76      | 3           | BLOCKED                             | $92 >= $76 (last buy), consecutive mode          |
| 7   | Price rises        | $95   | $88.67   | $76      | 3           | BLOCKED                             | $95 >= $76 (last buy), consecutive mode          |
| 8   | Trailing stop hits | $93   | $88.67   | $76      | 3→0         | BUY, RESET (count to 0)             | $93 >= $88.67 (avg), count→0, lastBuy stays $76  |
| 9   | Price drops        | $88   | $90.25   | $76      | 0           | BLOCKED                             | $88 >= $76 (last buy), still in consecutive mode |
| 10  | Price drops        | $75   | $90.25   | $76      | 0→1         | BUY                                 | $75 < $76 (last buy), count=0 so base grid       |
| 11  | Price drops        | $68   | $84.00   | $75      | 1→2         | BUY                                 | $68 < $75 (last buy), incremental grid applies   |
| 12  | Sell executes      | $85   | varies   | $68      | 2→0         | SELL, RESET (count & lastBuy to 0)  | Sell resets both count and lastBuyPrice to null  |
| 13  | New buy cycle      | $80   | varies   | null     | 0→1         | BUY (if trailing stop buy triggers) | Count=0, lastBuy=null, no price restrictions     |

**Key observations**:

- Days 4-7: Buys blocked because price rose above last buy price ($76) during consecutive mode
- Day 8: Buy at $93 (>= avg cost $88.67), count resets to 0, but lastBuyPrice stays $76
- Day 9: Still blocked because $88 >= $76 (lastBuyPrice not reset)
- Day 10: Buy allowed at $75 < $76, uses base grid (count=0)
- Day 11: Incremental grid resumes (count=1, so 15% grid for next buy)
- Day 12: Sell resets BOTH count and lastBuyPrice to null
- Day 13: After sell, no price restrictions (lastBuyPrice is null)

#### Example 4: Feature Disabled

**Configuration**:

- `enableConsecutiveIncrementalBuyGrid`: false

**Result**:

- All buys use fixed 10% grid spacing regardless of consecutive count
- **Consecutive buy restrictions still apply** (price < lastBuyPrice during consecutive mode)
- Consecutive count still tracked and reset on sell or when buy executes at price >= average cost

## Implementation Requirements

### Backend Changes

1. **Add configuration parameters**:
   - `enableConsecutiveIncrementalBuyGrid` in `backtestDefaults.json` (default: false)
   - `gridConsecutiveIncrement` in `backtestDefaults.json` (default: 0.05)

2. **Update DCA backtest service** (`dcaBacktestService.js`):
   - Add state tracking: `consecutiveBuyCount`, `lastBuyPrice`
   - Implement consecutive buy price restriction (block buy if price >= lastBuyPrice during consecutive mode)
   - Implement consecutive buy reset logic (reset when price rises above average cost)
   - Implement grid size calculation logic before buy execution
   - Update buy logic to use dynamic grid size
   - Update transaction logging to show grid size used and consecutive buy resets
   - Reset consecutive count on sell execution

3. **Validation** (`backend/middleware/validation.js`):
   - `enableConsecutiveIncrementalBuyGrid`: boolean, optional
   - `gridConsecutiveIncrement`: numeric (0-1 range), optional, default 0.05

### Frontend Changes

1. **Add UI controls** in `DCABacktestForm.js`:
   - Checkbox: "Enable Consecutive Incremental Buy Grid"
   - Number input: "Grid Consecutive Increment (%)"
   - Help text explaining the feature
   - Place in "Long Strategy Parameters" section

2. **Update URL parameter manager**:
   - Add `enableConsecutiveIncrementalBuyGrid` to URL encoding/decoding
   - Add `gridConsecutiveIncrement` to URL encoding/decoding

3. **Update results display**:
   - Show whether consecutive incremental buy grid was enabled
   - Display `gridConsecutiveIncrement` value used
   - Show grid size for each buy in transaction history

### Batch Testing Support

1. **Batch parameter ranges**:
   - Add `gridConsecutiveIncrement` to batch testing options
   - Range: 0%, 5%, 10%, 15% (configurable)
   - Test combinations with base grid intervals

2. **Batch results**:
   - Include `gridConsecutiveIncrement` in parameter columns
   - Allow filtering by this parameter

## Success Criteria

1. **Correct calculation**: Grid size = base + (count × increment) only when conditions met
2. **Proper resets**:
   - Count resets to 0 on sell (also resets lastBuyPrice to null)
   - Count resets to 0 on buy >= avg cost (keeps lastBuyPrice)
   - Price movements alone do NOT trigger resets
3. **Price restrictions enforced**: Buys only execute when price < lastBuyPrice (when lastBuyPrice exists)
4. **Performance improvement**: Better capital deployment during extended downtrends
5. **Backward compatibility**: Can be disabled to reproduce legacy behavior
6. **Clear logging**: Transaction logs show grid size used for each buy and reset events
7. **UI integration**: Parameter easily configurable in both single and batch modes

## Edge Cases

1. **First buy of backtest**: Uses base grid (count = 0, lastBuyPrice = null), can execute at any price
2. **All lots sold**: Resets count to 0 and lastBuyPrice to null, next buy can execute at any price
3. **Buy executes at price >= average cost**: Resets count to 0 but KEEPS lastBuyPrice, next buy must still be < lastBuyPrice
4. **Price rebounds above average cost (no buy)**: NO reset occurs, count and lastBuyPrice unchanged
5. **Price rises above lastBuyPrice (with or without count)**: Trailing stop buy is canceled, no buy executes
6. **Very high consecutive count**: Grid size can grow very large (consider max cap?)
7. **Average cost = 0**: Skip buy-price-vs-avg-cost reset check (no positions held)
8. **Consecutive buy blocked multiple times**: Each day the check runs and cancels the trailing stop buy if needed

## Testing Strategy

1. **Unit tests**: Test grid size calculation with various conditions
2. **Integration tests**: Run backtests with feature enabled/disabled
3. **Comparison tests**: Same stock, compare with/without feature
4. **Edge case tests**: Verify all reset conditions work correctly
5. **Performance tests**: Verify improved performance during crashes

## Performance Expectations

**Extended downtrend scenarios**: Wider spacing reduces number of buys, preserves capital for lower prices
**Choppy markets**: Frequent resets due to price rebounds, similar to base
**Strong downtrend recovery**: Benefits from having capital preserved for lower entry points
**Crash scenarios**: Significantly better capital deployment vs fixed grid spacing
