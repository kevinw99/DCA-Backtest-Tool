# Dynamic Grid Spacing - Requirements

## Problem Statement

Current DCA strategy uses fixed percentage grid spacing (e.g., 10%), which has limitations:

1. **At high prices ($1000)**: 10% = $100 gap → Very large dollar amounts, but relatively small percentage moves
2. **At low prices ($10)**: 10% = $1 gap → Very small dollar amounts, grids become too tight

This leads to:

- Over-trading at low prices (too many small buys)
- Under-trading at high prices (missing opportunities during large moves)
- Grid behavior depends on arbitrary starting price

## Solution: Dynamic Grid Spacing

Implement **square root-based grid spacing** that automatically adjusts:

- **High prices**: Tighter percentage (3-5%), larger dollar amounts
- **Mid prices**: Normal spacing (~10%)
- **Low prices**: Wider percentage (15-20%), smaller dollar amounts

**Formula**: `gridDollar = sqrt(price) × multiplier`

Where multiplier = 1.0 to achieve ~10% spacing at $100 reference price.

## Configuration Parameters

### 1. `enableDynamicGrid` (boolean)

- **Default**: `true`
- **Purpose**: Enable square root-based dynamic grid spacing
- **When false**: Use legacy fixed percentage spacing

### 2. `normalizeToReference` (boolean)

- **Default**: `true`
- **Purpose**: Normalize first trade price to $100 reference for consistent grid behavior
- **When true**: First trade price treated as $100, all subsequent prices scaled proportionally
- **When false**: Use absolute prices

### 3. `dynamicGridMultiplier` (number)

- **Default**: `1.0`
- **Purpose**: Adjust grid width (higher = wider grids)
- **Range**: 0.5 - 2.0
- **Note**: 1.0 gives ~10% at $100 reference

## Operating Modes

### Mode 1: Fixed Percentage (Legacy)

```json
{
  "enableDynamicGrid": false,
  "gridIntervalPercent": 0.1
}
```

- Uses traditional fixed 10% spacing
- Backward compatible

### Mode 2: Dynamic Grid (Absolute Prices)

```json
{
  "enableDynamicGrid": true,
  "normalizeToReference": false,
  "dynamicGridMultiplier": 1.0
}
```

- Square root spacing based on actual stock price
- $10 stock uses different grid than $1000 stock

### Mode 3: Dynamic Grid (Normalized) - DEFAULT

```json
{
  "enableDynamicGrid": true,
  "normalizeToReference": true,
  "dynamicGridMultiplier": 1.0
}
```

- First trade price normalized to $100
- Consistent grid behavior across all stocks regardless of absolute price
- All stocks start with ~10% first grid

## Technical Requirements

### Backend Changes

1. **backtestUtilities.js**: Add dynamic grid calculation function

   ```javascript
   calculateDynamicGrid(currentPrice, referencePrice, multiplier, normalizeToReference);
   ```

2. **dcaBacktestService.js**:
   - Calculate normalized reference price from first trade
   - Use dynamic grid in spacing validation (line 550)
   - Pass normalization factor through calculations

3. **shortDCABacktestService.js**: Same changes as DCA service

4. **backtestDefaults.json**: Add new parameters with defaults

5. **validation.js**: Add validation for new parameters

### Frontend Changes

1. **DCABacktestForm.js**: Add controls for new parameters
   - Checkbox: "Enable Dynamic Grid Spacing"
   - Checkbox: "Normalize to Reference Price"
   - Slider: "Grid Multiplier" (0.5-2.0)

2. **URLParameterManager.js**: Support new parameters in URL encoding/decoding

3. **BacktestResults.js**: Display which grid mode is active

## Success Criteria

1. ✅ Three modes work correctly (fixed, dynamic absolute, dynamic normalized)
2. ✅ Default mode (dynamic normalized) produces ~10% first grid
3. ✅ Grid spacing respects dynamic calculation at all price levels
4. ✅ Backward compatible with existing fixed percentage backtests
5. ✅ Batch optimization works with new parameters
6. ✅ URL parameters preserve grid settings

## Example Grid Behavior (Normalized Mode, multiplier=1.0)

Starting price: $150 (normalized to $100)

| Actual Price | Normalized Price | Grid $ | Grid % |
| ------------ | ---------------- | ------ | ------ |
| $150.00      | $100.00          | $10.00 | 10.0%  |
| $135.00      | $90.00           | $9.00  | 10.0%  |
| $121.50      | $81.00           | $8.10  | 10.0%  |
| $109.35      | $72.90           | $7.29  | 10.0%  |

Starting price: $15 (normalized to $100)

| Actual Price | Normalized Price | Grid $ | Grid % |
| ------------ | ---------------- | ------ | ------ |
| $15.00       | $100.00          | $1.50  | 10.0%  |
| $13.50       | $90.00           | $1.35  | 10.0%  |
| $12.15       | $81.00           | $1.22  | 10.0%  |
| $10.94       | $72.90           | $1.09  | 10.0%  |

This ensures all stocks behave consistently regardless of absolute price level.
