# Consecutive Incremental Profit Requirement - Requirements

## Problem Statement

Current DCA strategy uses a fixed profit requirement for all sells, which leads to:

- **Selling too early during strong uptrends**: Missing larger profit opportunities when price momentum is strong
- **Not capturing runaway price increases**: When price rapidly increases, we sell at minimum profit requirement and miss the continued upside
- **Inefficient profit capture strategy**: Not adapting sell behavior to market momentum

The goal is to implement an **adaptive profit requirement** that increases for consecutive sells during uptrends, allowing the strategy to "let winners run" while still taking systematic profits.

## Core Concept

**Incremental Profit Requirement on Consecutive Uptrend Sells**

When executing consecutive sells with rising prices, progressively increase the profit requirement by adding the current grid size to the base profit requirement. This creates a dynamic profit ladder that captures more upside during strong momentum.

### Formula

```
lotProfitRequirement = baseProfitRequirement + currentGridSize

where currentGridSize =
  - calculateDynamicGridSpacing(...) if enableDynamicGrid = true
  - gridIntervalPercent if enableDynamicGrid = false
```

**CRITICAL**: This incremental profit requirement applies **ONLY** to individual lot/short price comparisons, **NOT** to average cost comparisons.

### Key Conditions

The profit requirement increases **ONLY** when **BOTH** conditions are met:

1. **Consecutive sell**: The last action was a sell (no buy in between)
2. **Price going up**: Current price > last sell price

If either condition fails, reset to base profit requirement.

### Two-Tier Profit Requirement System

| Comparison Type          | Variable Name                    | When to Use                              | Purpose                                         |
| ------------------------ | -------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| **Average Cost**         | `profitRequirement` (base)       | `averageCost × (1 + profitRequirement)`  | Portfolio-level profitability guarantee         |
| **Individual Lot Price** | `lotProfitRequirement` (dynamic) | `lot.price × (1 + lotProfitRequirement)` | Position-level selection with consecutive logic |

**Rationale**: Average cost comparisons ensure overall portfolio profitability and should always use the base profit requirement. Individual lot comparisons determine which specific positions to sell and benefit from the consecutive incremental logic.

## Detailed Requirements

### 1. Configuration

**New Parameter**:

- **`enableConsecutiveIncrementalSellProfit`** (boolean, default: `true`)
  - When `true`: Apply incremental profit requirement on consecutive uptrend sells
  - When `false`: Use fixed profit requirement (legacy behavior)

**Existing Parameters Used**:

- `profitRequirement`: Base profit requirement (e.g., 0.05 for 5%)
- `gridIntervalPercent`: Fixed grid size when dynamic grid disabled
- `enableDynamicGrid`: Whether to use dynamic or fixed grid
- `normalizeToReference`: Whether to normalize dynamic grid calculations
- `dynamicGridMultiplier`: Multiplier for dynamic grid calculation

### 2. State Tracking

Track the following variables during backtest:

- **`lastActionType`**: 'buy' | 'sell' | null
  - Initialized to `null` at start
  - Updated to 'buy' after every buy execution
  - Updated to 'sell' after every sell execution

- **`lastSellPrice`**: number | null
  - Initialized to `null` at start
  - Updated to the sell price after every sell execution
  - Used to determine if current price is higher than previous sell

### 3. Profit Requirement Calculation Logic

#### Case 1: Calculate Lot-Level Profit Requirement (Dynamic)

```javascript
// Calculate lot-level profit requirement for individual lot comparisons
let lotProfitRequirement = profitRequirement; // Default to base

if (
  enableConsecutiveIncrementalSellProfit &&
  lastActionType === 'sell' &&
  currentPrice > lastSellPrice
) {
  // Calculate current grid size
  let gridSize;
  if (enableDynamicGrid) {
    gridSize = calculateDynamicGridSpacing(
      currentPrice,
      referencePrice,
      dynamicGridMultiplier,
      normalizeToReference
    );
  } else {
    gridSize = gridIntervalPercent;
  }

  lotProfitRequirement = profitRequirement + gridSize;
}
```

**Reset conditions** (lotProfitRequirement = profitRequirement):

- No previous action (first trade)
- Last action was a buy
- Current price ≤ last sell price (price declining or flat)

#### Case 2: Application Rules

**Use BASE `profitRequirement` for average cost comparisons**:

```javascript
// ✅ Portfolio-level profitability check - uses BASE
const minProfitablePrice = averageCost * (1 + profitRequirement);

// Example locations:
// - Trailing sell activation
// - Trailing stop cancellation
// - Limit order execution validation
```

**Use DYNAMIC `lotProfitRequirement` for individual lot comparisons**:

```javascript
// ✅ Lot-level selection - uses DYNAMIC
const eligibleLots = lots.filter(lot => currentPrice > lot.price * (1 + lotProfitRequirement));

// Example locations:
// - Lot eligibility filtering
// - Trailing sell limit price calculation
```

### 4. Code Locations Summary

#### DCA Backtest Service (`dcaBacktestService.js`)

| Line | Comparison     | Profit Req Type | Code                                     |
| ---- | -------------- | --------------- | ---------------------------------------- |
| 668  | Average cost   | ✅ BASE         | `averageCost * (1 + profitRequirement)`  |
| 674  | Individual lot | 🔄 DYNAMIC      | `lot.price * (1 + lotProfitRequirement)` |
| 718  | Individual lot | 🔄 DYNAMIC      | `lot.price * (1 + lotProfitRequirement)` |
| 744  | Average cost   | ✅ BASE         | `averageCost * (1 + profitRequirement)`  |
| 814  | Average cost   | ✅ BASE         | `averageCost * (1 + profitRequirement)`  |

#### Short DCA Backtest Service (`shortDCABacktestService.js`)

| Line | Comparison       | Profit Req Type | Code                                         |
| ---- | ---------------- | --------------- | -------------------------------------------- |
| 795  | Average cost     | ✅ BASE         | `averageShortCost * (1 - profitRequirement)` |
| 801  | Individual short | 🔄 DYNAMIC      | `short.price * (1 - shortProfitRequirement)` |
| 816  | Individual short | 🔄 DYNAMIC      | `shortPrice * (1 - shortProfitRequirement)`  |
| 851  | Individual short | 🔄 DYNAMIC      | `short.price * (1 - shortProfitRequirement)` |
| 859  | Individual short | 🔄 DYNAMIC      | `shortPrice * (1 - shortProfitRequirement)`  |
| 886  | Average cost     | ✅ BASE         | `averageShortCost * (1 - profitRequirement)` |
| 1041 | Average cost     | ✅ BASE         | `averageShortCost * (1 - profitRequirement)` |

## Examples

### Example 1: Dynamic Grid + Consecutive Uptrend Sells

**Configuration**:

- `profitRequirement`: 0.05 (5%)
- `enableDynamicGrid`: true
- `enableConsecutiveIncrementalSellProfit`: true
- `dynamicGridMultiplier`: 1.0
- `normalizeToReference`: true

**Scenario**:
| Step | Event | Price | Last Action | Last Sell Price | Current Grid | Effective Profit Req | Sell Threshold | Action |
|------|-------|-------|-------------|-----------------|--------------|---------------------|----------------|--------|
| 1 | Start | $100 | null | null | - | - | - | - |
| 2 | Buy | $100 | buy | null | - | - | - | BUY |
| 3 | Price rises | $110 | buy | null | - | 5% | $105 | Check sell |
| 4 | **First Sell** | $110 | buy � sell | null � $110 | - | **5%** (base) | $105  | **SELL** |
| 5 | Price rises | $122 | sell | $110 | ~9.5% | **5% + 9.5% = 14.5%** | $114.5  | **SELL** |
| 6 | Price rises | $135 | sell | $122 | ~9.1% | **5% + 9.1% = 14.1%** | $114.1  | **SELL** |
| 7 | Price drops | $130 | sell | $135 | - | **5%** (reset: price d last sell) | $105  | SELL |
| 8 | Price drops further | $95 | sell | $130 | - | - | - | - |
| 9 | Buy triggered | $95 | sell � buy | $130 � null | - | - | - | BUY |
| 10 | Price rises | $104 | buy | null | - | **5%** (reset: last was buy) | $99.75  | SELL |

**Key observations**:

- Step 4: First sell uses base profit requirement (5%)
- Step 5: Second sell is consecutive + uptrend � uses 5% + 9.5% = 14.5%
- Step 6: Third sell is consecutive + uptrend � uses 5% + 9.1% = 14.1%
- Step 7: Fourth sell price d last sell price � resets to base 5%
- Step 10: Buy occurred � resets to base 5%

### Example 2: Fixed Grid + Consecutive Uptrend Sells

**Configuration**:

- `profitRequirement`: 0.05 (5%)
- `gridIntervalPercent`: 0.10 (10%)
- `enableDynamicGrid`: false
- `enableConsecutiveIncrementalSellProfit`: true

**Scenario**:
| Step | Event | Price | Last Action | Last Sell Price | Effective Profit Req | Sell Threshold | Action |
|------|-------|-------|-------------|-----------------|---------------------|----------------|--------|
| 1 | Buy | $100 | buy | null | - | - | BUY |
| 2 | **First Sell** | $110 | sell | $110 | **5%** (base) | $105  | **SELL** |
| 3 | **Second Sell** | $125 | sell | $110 | **5% + 10% = 15%** | $115  | **SELL** |
| 4 | **Third Sell** | $138 | sell | $125 | **5% + 10% = 15%** | $115  | **SELL** |
| 5 | Price drops | $120 | sell | $138 | **5%** (reset) | $105  | SELL |

**Key observations**:

- Fixed grid always uses 10%
- Consecutive uptrend sells use 5% + 10% = 15%
- Price decline resets to base 5%

### Example 3: Feature Disabled (Legacy Behavior)

**Configuration**:

- `profitRequirement`: 0.05 (5%)
- `enableConsecutiveIncrementalSellProfit`: false

**Scenario**:
All sells use 5% profit requirement regardless of consecutive status or price direction.

## Implementation Requirements

### Backend Changes

1. **Add configuration parameter**:
   - `enableConsecutiveIncrementalSellProfit` in `backtestDefaults.json`
   - Default: `true`

2. **Update DCA backtest service** (`dcaBacktestService.js`):
   - Add state tracking: `lastActionType`, `lastSellPrice`
   - Implement profit requirement calculation logic before sell checks
   - Update sell condition to use `effectiveProfitRequirement`
   - Update transaction logging to show effective vs base profit requirement

3. **Update Short DCA backtest service** (`shortDCABacktestService.js`):
   - Apply inverse logic for shorts (consecutive covers during downtrends)
   - Cover profit requirement increases when price declining + consecutive covers

### Frontend Changes

1. **Add UI control** in `DCABacktestForm.js`:
   - Checkbox: "Enable Consecutive Incremental Sell Profit"
   - Help text: "Increase profit requirement for consecutive sells during uptrends"
   - Place in "Long Strategy Parameters" section

2. **Update results display** in `BacktestResults.js`:
   - Show whether consecutive incremental profit was enabled
   - Optionally show max effective profit requirement used

### Validation

1. **Parameter validation** in `backend/middleware/validation.js`:
   - `enableConsecutiveIncrementalSellProfit`: boolean, optional, defaults to true

2. **Integration validation**:
   - Works with both dynamic grid and fixed grid
   - Works with Beta scaling
   - Works with trailing sells
   - Works with all stop loss mechanisms

## Success Criteria

1. **Correct calculation**: Effective profit requirement = base + grid only when both conditions met
2. **Proper resets**: Resets to base on buy or price decline
3. **Grid integration**: Works correctly with both dynamic and fixed grid modes
4. **Performance improvement**: Captures larger profits during strong uptrends
5. **Backward compatibility**: Can be disabled to reproduce legacy behavior
6. **Clear logging**: Transaction logs show effective profit requirement used for each sell

## Edge Cases

1. **All lots sold**: No impact, resets on next buy
2. **Trailing sell active**: Incremental profit applies to initial threshold, trailing logic unchanged
3. **Stop loss triggered**: State resets (last action becomes 'sell')
4. **Beta scaling**: Base profit requirement is beta-adjusted, then grid added
5. **First trade of backtest**: Uses base profit requirement

## Testing Strategy

1. **Unit tests**: Test profit requirement calculation with various conditions
2. **Integration tests**: Run backtests with feature enabled/disabled
3. **Comparison tests**: Same stock, compare with/without feature
4. **Edge case tests**: Verify all reset conditions work correctly
5. **Performance tests**: Verify improved profit capture during uptrends

## Performance Expectations

**Uptrend scenarios**: Higher total profit, better profit/trade ratio, captures momentum
**Choppy markets**: Similar to base (frequent resets)
**Downtrend scenarios**: Similar to base (infrequent sells)
**Strong momentum**: Significantly better profit capture vs fixed profit requirement
