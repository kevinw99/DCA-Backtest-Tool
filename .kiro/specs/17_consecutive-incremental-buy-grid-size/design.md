# Consecutive Incremental Buy Grid Size - Design Document

## Architecture Overview

This feature enhances the DCA backtest engine's trailing stop buy system by implementing dynamic grid spacing that increases with consecutive buys during downtrends.

### Key Components

1. **State Management**: Track consecutive buy count and last buy price
2. **Grid Calculation**: Simple formula-based grid size calculation
3. **Integration**: Seamless integration with existing trailing stop buy logic
4. **Configuration**: New parameters for enabling and controlling the feature

## Technical Design

### 1. Data Structures

#### State Variables (in `dcaBacktestService.js`)

```javascript
// Add to backtest state
let consecutiveBuyCount = 0; // Tracks consecutive buys
let lastBuyPrice = null; // Last buy execution price
```

#### Configuration Parameters

```javascript
{
  enableConsecutiveIncrementalBuyGrid: false,  // Feature toggle
  gridConsecutiveIncrement: 0.05,               // 5% increment per consecutive buy
  gridIntervalPercent: 0.10                     // Base 10% grid (existing)
}
```

### 2. Grid Size Calculation Function

```javascript
/**
 * Calculate grid size for next buy based on consecutive buy count
 * @param {number} gridIntervalPercent - Base grid size (e.g., 0.10 for 10%)
 * @param {number} gridConsecutiveIncrement - Increment per consecutive buy (e.g., 0.05 for 5%)
 * @param {number} consecutiveBuyCount - Current consecutive buy count
 * @param {number|null} lastBuyPrice - Price of last buy
 * @param {number} currentBuyPrice - Current potential buy price
 * @param {boolean} enableConsecutiveIncrementalBuyGrid - Feature enabled?
 * @returns {number} Grid size to use for next buy
 */
function calculateBuyGridSize(
  gridIntervalPercent,
  gridConsecutiveIncrement,
  consecutiveBuyCount,
  lastBuyPrice,
  currentBuyPrice,
  enableConsecutiveIncrementalBuyGrid
) {
  // Default to base grid size
  let gridSize = gridIntervalPercent;

  // Apply incremental grid only if conditions are met
  if (
    enableConsecutiveIncrementalBuyGrid &&
    consecutiveBuyCount > 0 &&
    lastBuyPrice !== null &&
    currentBuyPrice < lastBuyPrice
  ) {
    // Consecutive downtrend buy - apply incremental spacing
    gridSize = gridIntervalPercent + consecutiveBuyCount * gridConsecutiveIncrement;

    if (verbose) {
      console.log(
        `📊 Incremental Grid: Base ${(gridIntervalPercent * 100).toFixed(0)}% + ${consecutiveBuyCount}×${(gridConsecutiveIncrement * 100).toFixed(0)}% = ${(gridSize * 100).toFixed(1)}%`
      );
    }
  } else {
    if (verbose && enableConsecutiveIncrementalBuyGrid) {
      const reason =
        consecutiveBuyCount === 0
          ? 'first buy'
          : lastBuyPrice === null
            ? 'no prior buy'
            : currentBuyPrice >= lastBuyPrice
              ? 'price not declining'
              : 'feature disabled';
      console.log(`📊 Base Grid: ${(gridIntervalPercent * 100).toFixed(0)}% (${reason})`);
    }
  }

  return gridSize;
}
```

### 3. Integration Points

#### A. Trailing Stop Buy Execution

**Location**: `dcaBacktestService.js` - trailing stop buy execution logic

```javascript
// When trailing stop buy executes
const executeBuy = (price, shares) => {
  // Calculate grid size for NEXT buy (before executing this buy)
  const nextGridSize = calculateBuyGridSize(
    gridIntervalPercent,
    gridConsecutiveIncrement,
    consecutiveBuyCount,
    lastBuyPrice,
    price,
    enableConsecutiveIncrementalBuyGrid
  );

  // Execute the buy
  lots.push({
    price: price,
    shares: shares,
    timestamp: currentDate,
    gridSizeUsed: nextGridSize, // Track for history
  });

  // Update state AFTER buy
  lastBuyPrice = price;
  consecutiveBuyCount++;

  // Log the buy with grid info
  transactionLog.push(
    `BUY: ${shares} shares @ ${formatCurrency(price)} ` +
      `(Consecutive: ${consecutiveBuyCount}, Next Grid: ${(nextGridSize * 100).toFixed(1)}%)`
  );

  // Recalculate trailing stop buy trigger for next buy
  // This will use the nextGridSize we just calculated
};
```

#### B. Trailing Stop Buy Activation

**Location**: `dcaBacktestService.js` - check for new trailing stop buy activation

```javascript
// When setting up next trailing stop buy
const activateTrailingStopBuy = currentPrice => {
  // Calculate grid size for this potential buy
  const gridSize = calculateBuyGridSize(
    gridIntervalPercent,
    gridConsecutiveIncrement,
    consecutiveBuyCount,
    lastBuyPrice,
    currentPrice,
    enableConsecutiveIncrementalBuyGrid
  );

  // Use gridSize to determine stop price and limit price
  const stopPrice = currentPrice * (1 + trailingBuyReboundPercent);
  const limitPrice = recentPeak; // Peak price reference

  // Minimum spacing from existing lots
  const minNextBuyPrice = calculateMinNextBuyPrice(lots, currentPrice, gridSize);

  // Validate spacing
  if (currentPrice > minNextBuyPrice) {
    // Too close to existing lots, don't activate
    return;
  }

  // Activate trailing stop buy order
  activeStopBuy = {
    stopPrice,
    limitPrice,
    gridSizeUsed: gridSize,
  };
};
```

#### C. Sell Execution (Reset Logic)

**Location**: `dcaBacktestService.js` - trailing stop sell execution

```javascript
// When trailing stop sell executes
const executeSell = (price, lotsToSell) => {
  // ... execute sell logic ...

  // RESET consecutive buy tracking
  consecutiveBuyCount = 0;
  lastBuyPrice = null;

  transactionLog.push(
    `SELL: ${lotsToSell.length} lots @ ${formatCurrency(price)} ` +
      `(Reset consecutive buy count to 0)`
  );

  // ... continue with sell logic ...
};
```

### 4. Database Schema Changes

No database changes required - all state is transient during backtest execution.

### 5. API Changes

#### Request Parameters

```javascript
// POST /api/backtest/dca
{
  // ... existing parameters ...
  enableConsecutiveIncrementalBuyGrid: false,  // New
  gridConsecutiveIncrement: 0.05                // New
}
```

#### Response Data

```javascript
{
  summary: {
    // ... existing fields ...
    consecutiveIncrementalBuyGridEnabled: false,
    gridConsecutiveIncrement: 0.05,
    maxConsecutiveBuyCount: 5,  // Max reached during backtest
    avgGridSizeUsed: 0.125      // Average grid size across all buys
  },
  transactions: [
    {
      type: 'BUY',
      price: 90.00,
      shares: 111,
      gridSizeUsed: 0.15,  // New field
      consecutiveBuyCount: 1  // New field
    },
    // ...
  ]
}
```

### 6. Configuration Management

#### Default Configuration (`backtestDefaults.json`)

```json
{
  "global": {
    "longStrategy": {
      "gridIntervalPercent": 10,
      "gridConsecutiveIncrement": 5,
      "maxLots": 10,
      "maxLotsToSell": 1,
      "profitRequirement": 10,
      "trailingBuyActivationPercent": 10,
      "trailingBuyReboundPercent": 5,
      "trailingSellActivationPercent": 20,
      "trailingSellPullbackPercent": 10
    },
    "dynamicFeatures": {
      "enableDynamicGrid": false,
      "enableConsecutiveIncrementalBuyGrid": false,
      "enableConsecutiveIncrementalSellProfit": false
    }
  }
}
```

#### Validation Rules

```javascript
// backend/middleware/validation.js
function validateDCABacktestParams(req, res, next) {
  const { enableConsecutiveIncrementalBuyGrid, gridConsecutiveIncrement } = req.body;

  // Validate boolean
  if (
    enableConsecutiveIncrementalBuyGrid !== undefined &&
    typeof enableConsecutiveIncrementalBuyGrid !== 'boolean'
  ) {
    return res.status(400).json({
      error: 'enableConsecutiveIncrementalBuyGrid must be boolean',
    });
  }

  // Validate increment (0-100% as whole number)
  if (gridConsecutiveIncrement !== undefined) {
    validateNumeric(gridConsecutiveIncrement, 'gridConsecutiveIncrement', {
      min: 0,
      max: 100,
      required: false,
    });
  }
}
```

### 7. Frontend Integration

#### Form Component (`DCABacktestForm.js`)

```jsx
{
  /* Consecutive Incremental Buy Grid */
}
<div className="form-group">
  <div className="checkbox-group">
    <label>
      <input
        type="checkbox"
        checked={parameters.enableConsecutiveIncrementalBuyGrid || false}
        onChange={e => handleChange('enableConsecutiveIncrementalBuyGrid', e.target.checked)}
      />
      <span className="checkbox-label">
        Enable Consecutive Incremental Buy Grid
        <span
          className="help-icon"
          title="Increase grid spacing with each consecutive buy during downtrends"
        >
          ⓘ
        </span>
      </span>
    </label>
  </div>

  {parameters.enableConsecutiveIncrementalBuyGrid && (
    <div className="input-group">
      <label>Grid Consecutive Increment (%):</label>
      <input
        type="number"
        value={parameters.gridConsecutiveIncrement || 5}
        onChange={e => handleChange('gridConsecutiveIncrement', parseFloat(e.target.value))}
        min="0"
        max="100"
        step="1"
      />
      <span className="help-text">
        Amount to add to base grid for each consecutive buy (e.g., 5% means 10%, 15%, 20%, ...)
      </span>
    </div>
  )}
</div>;
```

#### URL Parameter Manager

```javascript
// Add to URLParameterManager.js
const PARAMETER_KEYS = {
  // ... existing keys ...
  enableConsecutiveIncrementalBuyGrid: 'enableConsecutiveIncrementalBuyGrid',
  gridConsecutiveIncrement: 'gridConsecutiveIncrement',
};
```

#### Results Display

```jsx
{
  /* Show in backtest summary */
}
{
  data.summary.consecutiveIncrementalBuyGridEnabled && (
    <div className="metric-row">
      <span>Consecutive Incremental Buy Grid:</span>
      <span>
        Enabled ({data.summary.gridConsecutiveIncrement}% increment)
        <br />
        Max Consecutive: {data.summary.maxConsecutiveBuyCount}
        <br />
        Avg Grid Size: {(data.summary.avgGridSizeUsed * 100).toFixed(1)}%
      </span>
    </div>
  );
}
```

### 8. Logging Strategy

```javascript
// Detailed logging for debugging
if (verbose) {
  console.log('═══ Consecutive Buy Grid Calculation ═══');
  console.log(`  Enable Feature: ${enableConsecutiveIncrementalBuyGrid}`);
  console.log(`  Consecutive Count: ${consecutiveBuyCount}`);
  console.log(`  Last Buy Price: ${lastBuyPrice ? formatCurrency(lastBuyPrice) : 'null'}`);
  console.log(`  Current Buy Price: ${formatCurrency(currentBuyPrice)}`);
  console.log(`  Price Declining: ${lastBuyPrice !== null && currentBuyPrice < lastBuyPrice}`);
  console.log(`  Base Grid: ${(gridIntervalPercent * 100).toFixed(0)}%`);
  console.log(`  Increment: ${(gridConsecutiveIncrement * 100).toFixed(0)}%`);
  console.log(`  Calculated Grid: ${(gridSize * 100).toFixed(1)}%`);
  console.log('════════════════════════════════════════');
}
```

### 9. Batch Testing Integration

```javascript
// batchBacktestService.js
const parameterRanges = {
  gridIntervalPercent: [5, 10, 15, 20],
  gridConsecutiveIncrement: [0, 5, 10, 15], // New
  enableConsecutiveIncrementalBuyGrid: [false, true], // New
};

// Generate combinations including new parameters
const generateCombinations = () => {
  // ... existing logic ...
  // Include gridConsecutiveIncrement in combinations
};
```

## Error Handling

### Edge Cases

1. **Consecutive count overflow**: No artificial limit, but grid size can grow unbounded
   - Consider adding max cap in future if needed

2. **Null/undefined values**: All calculations check for null/undefined before using values

3. **Invalid parameters**: Validation middleware catches invalid values before processing

4. **Feature disabled mid-backtest**: Not applicable - configuration is static per backtest

## Performance Considerations

- **Minimal overhead**: Simple arithmetic calculation (no external calls)
- **No external dependencies**: Pure JavaScript, no Python subprocess
- **State tracking**: Two additional variables per backtest (negligible memory)
- **Logging**: Optional verbose logging can be disabled for production

## Testing Strategy

### Unit Tests

```javascript
describe('calculateBuyGridSize', () => {
  test('returns base grid when feature disabled', () => {
    const result = calculateBuyGridSize(0.1, 0.05, 5, 90, 80, false);
    expect(result).toBe(0.1);
  });

  test('returns incremental grid for consecutive downtrend buy', () => {
    const result = calculateBuyGridSize(0.1, 0.05, 2, 90, 80, true);
    expect(result).toBe(0.2); // 0.10 + 2*0.05
  });

  test('returns base grid when price not declining', () => {
    const result = calculateBuyGridSize(0.1, 0.05, 2, 90, 95, true);
    expect(result).toBe(0.1);
  });

  test('returns base grid for first buy', () => {
    const result = calculateBuyGridSize(0.1, 0.05, 0, null, 100, true);
    expect(result).toBe(0.1);
  });
});
```

### Integration Tests

Test full backtest scenarios:

- Extended downtrend (should see increasing grid sizes)
- Choppy market (should see frequent resets)
- Sell and rebuy (should reset consecutive count)

## Migration Strategy

1. **Backward compatible**: Default is feature disabled
2. **Opt-in**: Users must explicitly enable the feature
3. **No breaking changes**: All existing backtests continue to work
4. **Clear documentation**: Help text and tooltips explain the feature

## Future Enhancements

1. **Maximum grid cap**: Limit how large the grid can grow
2. **Adaptive increment**: Adjust increment based on volatility
3. **Separate increment for shorts**: Different logic for short selling
4. **UI visualization**: Chart showing grid sizes over time
