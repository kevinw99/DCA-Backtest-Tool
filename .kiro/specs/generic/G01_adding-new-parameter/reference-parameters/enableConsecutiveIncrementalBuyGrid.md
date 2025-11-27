# Reference Parameter: `enableConsecutiveIncrementalBuyGrid` (Boolean Type)

## Parameter Overview

- **Name**: `enableConsecutiveIncrementalBuyGrid`
- **Type**: Boolean
- **Default**: `false`
- **Purpose**: Enable incremental grid spacing that increases with each consecutive buy (grid grows wider after each purchase)
- **Used In**: Single backtest, portfolio backtest, batch mode
- **Spec**: Spec 31 - Consecutive Incremental Buy Grid

## Why This is a Good Reference

This parameter demonstrates:
- ✅ Complete boolean parameter integration across all modes
- ✅ Feature flag pattern (enables optional behavior)
- ✅ Conditional logic activation in executor
- ✅ Configuration defaults in all strategies
- ✅ URL parameter encoding/decoding for booleans
- ✅ Simple checkbox UI control
- ✅ Used alongside related numeric parameter (`incrementalGridMultiplier`)

## Integration Points

### 1. Backend - Executor (`dcaExecutor.js`)

**Function Signature** (~line 340):
```javascript
async function runDCABacktest({
  // ... parameters ...
  gridIntervalPercent = 0.10,

  // Spec 31: Consecutive Incremental Buy Grid
  enableConsecutiveIncrementalBuyGrid = false,  // ← DEFINED HERE with default
  incrementalGridMultiplier = 1.5,  // Related numeric parameter

  // ... parameters ...
}) {
```

**Usage in Logic** (~line 800+, buy grid calculation):
```javascript
// Calculate grid interval for this buy
let currentGridInterval = gridIntervalPercent;

// Spec 31: Apply incremental grid spacing if enabled
if (enableConsecutiveIncrementalBuyGrid && lots.length > 0) {
  // Grid spacing increases with each buy
  // First buy: gridIntervalPercent
  // Second buy: gridIntervalPercent * multiplier
  // Third buy: gridIntervalPercent * multiplier^2, etc.
  currentGridInterval = gridIntervalPercent * Math.pow(incrementalGridMultiplier, lots.length);

  transactionLog.push(
    `📊 INCREMENTAL GRID: Buy #${lots.length + 1}, ` +
    `Grid: ${(currentGridInterval * 100).toFixed(2)}% ` +
    `(base ${(gridIntervalPercent * 100).toFixed(2)}% × ${incrementalGridMultiplier}^${lots.length})`
  );
}

// Use currentGridInterval for buy threshold
const buyThreshold = lastBuyPrice * (1 - currentGridInterval);
if (price <= buyThreshold) {
  executeBuy();
}
```

**Key Lesson**: Boolean parameters gate entire code blocks. When `false`, the feature is completely disabled. When `true`, additional logic executes.

### 2. Backend - Service Layer (`dcaBacktestService.js`)

**Extraction** (~line 606):
```javascript
async function runDCABacktest({
  // ... parameters ...
  gridIntervalPercent = 0.10,

  // Spec 31: Consecutive Incremental Buy Grid
  enableConsecutiveIncrementalBuyGrid = false,  // ← EXTRACTED from request
  incrementalGridMultiplier = 1.5,

  // ... parameters ...
}) {
```

**Passing to Executor** (~line 800+):
```javascript
const executorResults = await dcaExecutor.runDCABacktest({
  // ... parameters ...
  gridIntervalPercent,

  // Spec 31: Consecutive Incremental Buy Grid
  enableConsecutiveIncrementalBuyGrid,  // ← PASSED to executor
  incrementalGridMultiplier,

  // ... parameters ...
});
```

**Key Lesson**: Service layer simply extracts and passes through boolean values. No transformation needed.

### 3. Backend - API Layer (`server.js`)

**Explicit Preservation** (~line 679-682):
```javascript
const params = {
  ...backtestConfig.mergeWithDefaults(req.body),

  // Spec 31: Explicitly preserve incremental grid parameters
  enableConsecutiveIncrementalBuyGrid: req.body.enableConsecutiveIncrementalBuyGrid ?? false,
  incrementalGridMultiplier: req.body.incrementalGridMultiplier ?? 1.5,
};
```

**Passing to Service** (~line 913-914):
```javascript
const results = await dcaBacktestService.runDCABacktest({
  // ... ~30 existing parameters ...
  gridIntervalPercent: finalParams.gridIntervalPercent,

  // Spec 31: Consecutive Incremental Buy Grid
  enableConsecutiveIncrementalBuyGrid: finalParams.enableConsecutiveIncrementalBuyGrid,  // ← MUST ADD HERE
  incrementalGridMultiplier: finalParams.incrementalGridMultiplier,

  // ... other parameters ...
});
```

**Key Lesson**:
- Use `?? false` for boolean defaults (NOT `|| false`, which treats `false` as falsy)
- Boolean must be explicitly listed in service call

### 4. Configuration - Defaults (`backtestDefaults.json`)

**Global Defaults**:
```json
{
  "longStrategy": {
    "gridIntervalPercent": 0.10,

    "enableDynamicGrid": false,
    "enableConsecutiveIncrementalBuyGrid": false,  // ← DEFAULT VALUE (disabled)
    "incrementalGridMultiplier": 1.5,

    "enableAverageBasedGrid": false,
    "enableAverageBasedSell": false
  },
  "shortStrategy": {
    "gridIntervalPercent": 0.10,

    "enableConsecutiveIncrementalBuyGrid": false,  // ← Also in short strategy
    "incrementalGridMultiplier": 1.5
  }
}
```

**Key Lesson**:
- Boolean feature flags default to `false` (opt-in behavior)
- Group with related parameters (e.g., `incrementalGridMultiplier`)
- Add to ALL applicable strategies

### 5. Frontend - UI Component (`DCABacktestForm.js`)

**Form Control** (~line 1950-1980, advanced features section):
```jsx
{/* Spec 31: Consecutive Incremental Buy Grid */}
<div className="form-group checkbox-group">
  <label>
    <input
      type="checkbox"
      checked={parameters.enableConsecutiveIncrementalBuyGrid ?? false}  // ← DISPLAY: boolean
      onChange={(e) => handleChange('enableConsecutiveIncrementalBuyGrid',
        e.target.checked)}  // ← STORE: boolean (e.target.checked is already boolean)
    />
    Enable Consecutive Incremental Buy Grid (Spec 31)
  </label>
  <span className="form-help">
    Grid spacing increases with each consecutive buy (1st: 10%, 2nd: 15%, 3rd: 22.5%, etc.)
  </span>
</div>

{/* Related numeric parameter - only relevant when feature enabled */}
{parameters.enableConsecutiveIncrementalBuyGrid && (
  <div className="form-group">
    <label>Incremental Grid Multiplier:</label>
    <input
      type="number"
      min="1.0"
      max="3.0"
      step="0.1"
      value={parameters.incrementalGridMultiplier ?? 1.5}
      onChange={(e) => handleChange('incrementalGridMultiplier',
        parseFloat(e.target.value))}
    />
    <span className="form-help">
      Multiplier for grid spacing growth (1.5 = 50% wider each time)
    </span>
  </div>
)}
```

**Key Lesson**:
- Use `type="checkbox"` for boolean parameters
- Use `e.target.checked` (already boolean, no conversion needed)
- Always provide default with null coalescing (`?? false`)
- Can conditionally show related parameters when feature is enabled

### 6. Frontend - URL Encoding (`URLParameterManager.js`)

**Encoding** (~line 409-473, `_encodeSingleParameters` method):
```javascript
// Grid & Incremental Options
if (parameters.enableDynamicGrid !== undefined) {
  params.set('enableDynamicGrid', parameters.enableDynamicGrid.toString());
}
if (parameters.normalizeToReference !== undefined) {
  params.set('normalizeToReference', parameters.normalizeToReference.toString());
}

// Spec 31: Consecutive Incremental Buy Grid
if (parameters.enableConsecutiveIncrementalBuyGrid !== undefined) {
  params.set('enableConsecutiveIncrementalBuyGrid',
    parameters.enableConsecutiveIncrementalBuyGrid.toString());  // ← ENCODE: true → "true"
}
```

**Decoding** (~line 567-661, `_decodeSingleParameters` method):
```javascript
// Grid & Incremental Options boolean flags
if (params.enableDynamicGrid !== undefined) {
  decoded.enableDynamicGrid = this._parseBoolean(params.enableDynamicGrid, false);
}
if (params.normalizeToReference !== undefined) {
  decoded.normalizeToReference = this._parseBoolean(params.normalizeToReference, false);
}

// Spec 31: Consecutive Incremental Buy Grid
if (params.enableConsecutiveIncrementalBuyGrid !== undefined) {
  decoded.enableConsecutiveIncrementalBuyGrid =
    this._parseBoolean(params.enableConsecutiveIncrementalBuyGrid, false);  // ← DECODE: "true" → true
}

// Related numeric parameter
if (params.incrementalGridMultiplier !== undefined) {
  decoded.incrementalGridMultiplier =
    this._parseNumber(params.incrementalGridMultiplier, 1.5);
}
```

**Override Arrays** (~line 827-894, `_extractParameterOverrides` method):
```javascript
const booleanParams = [
  'enableBetaScaling', 'isManualBetaOverride',
  'enableDynamicGrid',
  'normalizeToReference',
  'enableConsecutiveIncrementalSellProfit',
  'enableConsecutiveIncrementalBuyGrid',  // ← IN BOOLEAN ARRAY
  'enableAverageBasedGrid', 'enableAverageBasedSell',
  'enableDynamicProfile',
  'momentumBasedBuy', 'momentumBasedSell'
];
```

**Key Lesson**:
- Use `.toString()` for encoding (true → "true")
- Use `_parseBoolean()` for decoding ("true" → true)
- Add to `booleanParams` array for override support
- ALWAYS provide default value to `_parseBoolean()` (second parameter)

### 7. Portfolio Backtest - Manual URL Handling (`PortfolioBacktestPage.js`)

**IMPORTANT**: Portfolio page uses manual URL parameter handling!

**Default State** (~line 57):
```javascript
const [parameters, setParameters] = useState({
  // ... other parameters ...

  // Spec 31: Consecutive Incremental Buy Grid
  enableConsecutiveIncrementalBuyGrid: false,  // ← ADD TO DEFAULT STATE
  incrementalGridMultiplier: 1.5,

  // ... other parameters ...
});
```

**URL Decoding** (~line 125):
```javascript
// Parse URL parameters
const urlParams = {
  // ... other parameters ...

  // Spec 31: Consecutive Incremental Buy Grid
  enableConsecutiveIncrementalBuyGrid:
    searchParams.get('enableConsecutiveIncrementalBuyGrid') === 'true',  // ← DECODE
  incrementalGridMultiplier:
    parseFloat(searchParams.get('incrementalGridMultiplier')) || 1.5,

  // ... other parameters ...
};
```

**URL Encoding** (~line 200):
```javascript
// Build shareable URL
const params = new URLSearchParams();

// ... other parameters ...

// Spec 31: Consecutive Incremental Buy Grid
params.set('enableConsecutiveIncrementalBuyGrid',
  parameters.defaultParams.enableConsecutiveIncrementalBuyGrid || false);  // ← ENCODE
params.set('incrementalGridMultiplier',
  parameters.defaultParams.incrementalGridMultiplier || 1.5);
```

**Key Lesson**: For portfolio backtest, must manually update 3 locations (state, decode, encode).

## URL Example

```
http://localhost:3000/backtest/long/PLTR/results?
  startDate=2024-01-01&
  endDate=2024-03-31&
  gridIntervalPercent=10&
  enableConsecutiveIncrementalBuyGrid=true&  ← Shows as "true" string
  incrementalGridMultiplier=1.5
```

## Testing Example

```bash
# Test with incremental grid enabled
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "startDate": "2024-01-01",
    "endDate": "2024-03-31",
    "lotSizeUsd": 10000,
    "gridIntervalPercent": 0.10,
    "enableConsecutiveIncrementalBuyGrid": true,  ← BACKEND FORMAT: boolean
    "incrementalGridMultiplier": 1.5,
    "profitRequirement": 0.10
  }' | jq '{
    success: .success,
    incrementalGridEnabled: .data.parameters.enableConsecutiveIncrementalBuyGrid
  }'

# Test with incremental grid disabled (baseline)
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "enableConsecutiveIncrementalBuyGrid": false,  ← Explicitly disabled
    ...
  }' | jq '.success'
```

## Complete Checklist for Your Boolean Parameter

When adding a similar boolean parameter, verify:

- [ ] Added to `dcaExecutor.js` function signature with `= false` default
- [ ] Used in executor logic with `if (parameterName) { ... }` block
- [ ] Added to `dcaBacktestService.js` function signature
- [ ] Passed from service to executor
- [ ] Added to `server.js` explicit preservation with `?? false`
- [ ] Added to `server.js` runDCABacktest() call (CRITICAL!)
- [ ] Added to `backtestDefaults.json` for all applicable strategies (default `false`)
- [ ] Added checkbox control to `DCABacktestForm.js` with null coalescing
- [ ] Added to `URLParameterManager.js` encoding method with `.toString()`
- [ ] Added to `URLParameterManager.js` decoding method with `_parseBoolean()`
- [ ] Added to `booleanParams` array in `_extractParameterOverrides()`
- [ ] Added to `PortfolioBacktestPage.js` in 3 places (state, decode, encode)
- [ ] Tested with `true` value via curl
- [ ] Tested with `false` value via curl
- [ ] Tested with omitted value (should use default `false`)
- [ ] Verified URL shows "true"/"false" as strings
- [ ] Verified checkbox updates correctly in UI

## Comparison with Number Parameter

### Boolean vs Percentage Parameter

**Boolean (`enableConsecutiveIncrementalBuyGrid`)**:
- Type: `true` or `false`
- Default: `false`
- UI Control: `<input type="checkbox">`
- URL Format: `"true"` or `"false"` (strings)
- Backend Format: `true` or `false` (booleans)
- Encoding: `.toString()` → "true"
- Decoding: `_parseBoolean()` → true
- Common Pattern: Feature flags, enable/disable toggles

**Percentage (`trailingBuyReboundPercent`)**:
- Type: Number (decimal)
- Default: `0.05` (5%)
- UI Control: `<input type="number">`
- URL Format: `5` (whole number)
- Backend Format: `0.05` (decimal)
- Encoding: `_formatDecimalAsPercentage()` → 5
- Decoding: `_parsePercentageAsDecimal()` → 0.05
- Common Pattern: Thresholds, percentages, ratios

## Summary

`enableConsecutiveIncrementalBuyGrid` is the perfect reference for boolean parameters because it shows:

1. **Feature Flag Pattern**: Enables/disables entire feature block
2. **Complete Integration**: All 7 major locations (including portfolio manual handling)
3. **Proper Grouping**: Placed with related grid parameters
4. **Helper Function Usage**: `_parseBoolean()` with proper default
5. **Default Values**: Consistent `false` across backend, config, and frontend
6. **Conditional UI**: Can show related parameters only when feature enabled
7. **Multi-Mode Support**: Works in single, portfolio, and batch modes

**Follow this exact pattern when adding any boolean/feature flag parameter.**

## Real-World Impact

When this parameter is enabled:
- First buy triggers at 10% drop (gridIntervalPercent)
- Second buy triggers at 15% drop (10% × 1.5)
- Third buy triggers at 22.5% drop (10% × 1.5²)
- And so on...

This creates wider grid spacing as the price drops, reducing buy frequency during prolonged downtrends while still maintaining DCA strategy.

**Transaction Log Example**:
```
--- 2024-01-15 ---
Price: $18.50 | Holdings: []
ACTION: BUY 540 shares at $18.50 (Grid: 10.00%)

--- 2024-01-22 ---
Price: $16.72 | Holdings: [$18.50]
📊 INCREMENTAL GRID: Buy #2, Grid: 15.00% (base 10.00% × 1.5^1)
ACTION: BUY 598 shares at $16.72

--- 2024-01-29 ---
Price: $14.37 | Holdings: [$18.50, $16.72]
📊 INCREMENTAL GRID: Buy #3, Grid: 22.50% (base 10.00% × 1.5^2)
ACTION: BUY 695 shares at $14.37
```

This shows the parameter in action with progressively wider grid spacing!
