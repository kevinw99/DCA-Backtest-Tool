# Reference Parameter: `trailingBuyReboundPercent` (Number Type - Percentage)

## Parameter Overview

- **Name**: `trailingBuyReboundPercent`
- **Type**: Percentage (decimal in backend, whole number in URL/UI)
- **Default**: `0.05` (5%)
- **Purpose**: Minimum price rebound from bottom required to trigger trailing buy order
- **Used In**: Single backtest, portfolio backtest, batch mode

## Why This is a Good Reference

This parameter demonstrates:
- ✅ Complete integration across all modes (single, portfolio, batch)
- ✅ Percentage handling (decimal ↔ whole number conversion)
- ✅ Configuration defaults in all strategies
- ✅ URL parameter encoding/decoding with type conversion
- ✅ Integration into core executor logic
- ✅ Used in conjunction with other trailing stop parameters

## Integration Points

### 1. Backend - Executor (`dcaExecutor.js`)

**Function Signature** (~line 340):
```javascript
async function runDCABacktest({
  // ... parameters ...
  trailingBuyActivationPercent = 0.10,
  trailingBuyReboundPercent = 0.05,  // ← DEFINED HERE with default
  trailingSellActivationPercent = 0.20,
  // ... parameters ...
}) {
```

**Usage in Logic** (~line 520-728, trailing buy logic):
```javascript
// Calculate trailing buy stop price based on rebound requirement
const trailingBuyStopPrice = lowestPriceSinceActivation * (1 + trailingBuyReboundPercent);

// Check if price has rebounded enough to trigger buy
if (price >= trailingBuyStopPrice) {
  // Execute trailing buy
  executeBuy();
}
```

**Key Lesson**: Parameter is used in mathematical calculations to determine order execution. Follow this pattern for any percentage-based threshold parameters.

### 2. Backend - Service Layer (`dcaBacktestService.js`)

**Extraction** (~line 606):
```javascript
async function runDCABacktest({
  // ... parameters ...
  trailingBuyReboundPercent = 0.05,  // ← EXTRACTED from request
  // ... parameters ...
}) {
```

**Passing to Executor** (~line 800+):
```javascript
const executorResults = await dcaExecutor.runDCABacktest({
  // ... parameters ...
  trailingBuyReboundPercent,  // ← PASSED to executor
  // ... parameters ...
});
```

**Key Lesson**: Service layer simply extracts and passes through. No transformation needed here.

### 3. Backend - API Layer (`server.js`)

**Explicit Preservation** (~line 679-682):
```javascript
const params = {
  ...backtestConfig.mergeWithDefaults(req.body),
  // Parameters are preserved if present in request
};
```

**Passing to Service** (~line 913-914):
```javascript
const results = await dcaBacktestService.runDCABacktest({
  // ... ~30 existing parameters ...
  trailingBuyReboundPercent: finalParams.trailingBuyReboundPercent,  // ← MUST ADD HERE
  // ... other parameters ...
});
```

**Key Lesson**: CRITICAL step - parameter must be explicitly listed in the service call, otherwise it gets dropped!

### 4. Configuration - Defaults (`backtestDefaults.json`)

**Global Defaults**:
```json
{
  "longStrategy": {
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,  // ← DEFAULT VALUE (5%)
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10
  },
  "shortStrategy": {
    "trailingSellActivationPercent": 0.10,
    "trailingSellReboundPercent": 0.05,  // ← Also in short strategy
    "trailingBuyActivationPercent": 0.20,
    "trailingBuyPullbackPercent": 0.10
  }
}
```

**Key Lesson**: Add to ALL applicable strategies (long AND short if parameter makes sense for both).

### 5. Frontend - UI Component (`DCABacktestForm.js`)

**Form Control** (~line 1800-1850, trailing buy section):
```jsx
<div className="form-group">
  <label>Trailing Buy Rebound (%):</label>
  <input
    type="number"
    min="0"
    max="100"
    step="0.1"
    value={(parameters.trailingBuyReboundPercent ?? 0.05) * 100}  // ← DISPLAY: 0.05 → 5
    onChange={(e) => handleChange('trailingBuyReboundPercent',
      parseFloat(e.target.value) / 100)}  // ← STORE: 5 → 0.05
  />
  <span className="form-help">
    Price rebound from bottom to trigger buy
  </span>
</div>
```

**Key Lesson**:
- Display: Multiply by 100 (decimal → percentage)
- Store: Divide by 100 (percentage → decimal)
- Always provide default with null coalescing (`??`)

### 6. Frontend - URL Encoding (`URLParameterManager.js`)

**Encoding** (~line 409-473, `_encodeSingleParameters` method):
```javascript
// Trailing Stop Buy Parameters
if (parameters.trailingBuyActivationPercent !== undefined) {
  params.set('trailingBuyActivationPercent',
    this._formatDecimalAsPercentage(parameters.trailingBuyActivationPercent).toString());
}
if (parameters.trailingBuyReboundPercent !== undefined) {
  params.set('trailingBuyReboundPercent',
    this._formatDecimalAsPercentage(parameters.trailingBuyReboundPercent).toString());  // ← ENCODE: 0.05 → "5"
}
```

**Decoding** (~line 567-661, `_decodeSingleParameters` method):
```javascript
// Trailing Stop Buy Parameters
if (params.trailingBuyActivationPercent !== undefined) {
  decoded.trailingBuyActivationPercent =
    this._parsePercentageAsDecimal(params.trailingBuyActivationPercent, 10);
}
if (params.trailingBuyReboundPercent !== undefined) {
  decoded.trailingBuyReboundPercent =
    this._parsePercentageAsDecimal(params.trailingBuyReboundPercent, 5);  // ← DECODE: "5" → 0.05
}
```

**Override Arrays** (~line 827-894, `_extractParameterOverrides` method):
```javascript
const percentageParams = [
  'gridIntervalPercent', 'profitRequirement',
  'trailingBuyActivationPercent', 'trailingBuyReboundPercent',  // ← IN PERCENTAGE ARRAY
  'trailingSellActivationPercent', 'trailingSellPullbackPercent'
];
```

**Key Lesson**:
- Use `_formatDecimalAsPercentage()` for encoding (0.05 → 5)
- Use `_parsePercentageAsDecimal()` for decoding (5 → 0.05)
- Add to `percentageParams` array for override support

## URL Example

```
http://localhost:3000/backtest/long/PLTR/results?
  startDate=2024-01-01&
  endDate=2024-03-31&
  trailingBuyActivationPercent=10&      ← Shows as whole number (10%)
  trailingBuyReboundPercent=5&          ← Shows as whole number (5%)
  trailingSellActivationPercent=20
```

## Testing Example

```bash
# Test with custom trailing buy rebound
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "startDate": "2024-01-01",
    "endDate": "2024-03-31",
    "lotSizeUsd": 10000,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,  ← BACKEND FORMAT: decimal
    "profitRequirement": 0.10
  }' | jq '.success'
```

## Complete Checklist for Your Number Parameter

When adding a similar number/percentage parameter, verify:

- [ ] Added to `dcaExecutor.js` function signature with default
- [ ] Used in executor logic (mathematical calculations, thresholds, etc.)
- [ ] Added to `dcaBacktestService.js` function signature
- [ ] Passed from service to executor
- [ ] Added to `server.js` runDCABacktest() call (CRITICAL!)
- [ ] Added to `backtestDefaults.json` for all applicable strategies
- [ ] Added UI control to `DCABacktestForm.js` with percentage conversion
- [ ] Added to `URLParameterManager.js` encoding method
- [ ] Added to `URLParameterManager.js` decoding method
- [ ] Added to appropriate array in `_extractParameterOverrides()` (percentageParams, numberParams, etc.)
- [ ] Tested with curl using decimal format
- [ ] Tested in UI with whole number format
- [ ] Verified URL shows whole number format

## Summary

`trailingBuyReboundPercent` is the perfect reference for number/percentage parameters because it shows:

1. **Type Conversion**: Decimal (backend) ↔ Whole number (UI/URL)
2. **Complete Integration**: All 6 major files modified
3. **Proper Grouping**: Placed with related trailing stop parameters
4. **Helper Function Usage**: `_formatDecimalAsPercentage()` and `_parsePercentageAsDecimal()`
5. **Default Values**: Consistent across backend, config, and frontend

**Follow this exact pattern when adding any number or percentage parameter.**
