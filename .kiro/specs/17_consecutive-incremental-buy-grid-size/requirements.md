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
  - Reset to `0` after any sell execution

- **`lastBuyPrice`**: number | null
  - Initialized to `null` at start
  - Updated to the buy price after every buy execution
  - Used to determine if current buy price is lower

### 3. Grid Size Calculation Logic

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

- No previous buy (first buy)
- Last action was a sell
- Current buy price ≥ last buy price (price not declining)

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

#### Example 2: Price Rebounds (Reset Condition)

**Scenario**:

| Step | Event              | Price | Last Buy | Consecutive Count | Grid Size                        | Action |
| ---- | ------------------ | ----- | -------- | ----------------- | -------------------------------- | ------ |
| 1    | Buy                | $100  | null     | 0→1               | 10%                              | BUY    |
| 2    | Buy                | $90   | $100     | 1                 | 15%                              | BUY    |
| 3    | **Price rebounds** | $95   | $90      | 2                 | 10% (reset: price > last buy)    | -      |
| 4    | Buy                | $92   | $90      | 2                 | 10% (base, not consecutive down) | BUY    |

**Key observation**: Grid resets to base when buy price is not lower than previous buy

#### Example 3: Feature Disabled

**Configuration**:

- `enableConsecutiveIncrementalBuyGrid`: false

**Result**: All buys use fixed 10% grid spacing regardless of consecutive count

## Implementation Requirements

### Backend Changes

1. **Add configuration parameters**:
   - `enableConsecutiveIncrementalBuyGrid` in `backtestDefaults.json` (default: false)
   - `gridConsecutiveIncrement` in `backtestDefaults.json` (default: 0.05)

2. **Update DCA backtest service** (`dcaBacktestService.js`):
   - Add state tracking: `consecutiveBuyCount`, `lastBuyPrice`
   - Implement grid size calculation logic before buy execution
   - Update buy logic to use dynamic grid size
   - Update transaction logging to show grid size used
   - Reset consecutive count on sell

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
2. **Proper resets**: Resets to base on sell or when price not declining
3. **Performance improvement**: Better capital deployment during extended downtrends
4. **Backward compatibility**: Can be disabled to reproduce legacy behavior
5. **Clear logging**: Transaction logs show grid size used for each buy
6. **UI integration**: Parameter easily configurable in both single and batch modes

## Edge Cases

1. **First buy of backtest**: Uses base grid (consecutive count = 0)
2. **All lots sold**: Resets consecutive count to 0
3. **Price rebounds during downtrend**: Resets to base grid
4. **Very high consecutive count**: Grid size can grow very large (consider max cap?)
5. **Trailing stop buy cancellation**: Does not affect consecutive count

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
