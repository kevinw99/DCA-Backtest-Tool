# G05: URL Parameter Handling

## Overview

This guide covers adding URL encoding and decoding support for new parameters, ensuring they can be shared via URLs and persist across page navigation.

## Why URL Parameter Handling Matters

URL parameters enable:
- **Shareable Links**: Users can share backtest configurations via URL
- **Bookmarking**: Users can bookmark specific parameter combinations
- **Deep Linking**: Direct navigation to results with specific parameters
- **Browser History**: Back/forward navigation preserves parameters

## File Location

Primary File: `/Users/kweng/AI/DCA-Backtest-Tool/frontend/src/utils/URLParameterManager.js`

## Architecture Overview

```
User Changes Parameters
         ↓
    React State Updated
         ↓
URLParameterManager.generateSemanticURL()
         ↓
   _encodeSingleParameters()  ← ADD PARAMETER HERE
         ↓
    URL Query String
         ↓
    Browser Address Bar

         ↓

User Shares/Bookmarks URL
         ↓
   URL Loaded in Browser
         ↓
URLParameterManager.parseSemanticURL()
         ↓
  _decodeSingleParameters()  ← ADD PARAMETER HERE
         ↓
    React State Restored
         ↓
  Form Shows Parameters
```

## Step 1: Add to URL Encoding

### Location
Method: `_encodeSingleParameters()` in `URLParameterManager.js`
Line Reference: Around line 409-473

### 1.1: Find Appropriate Section

Parameters are organized by category in the encoding method:
```javascript
_encodeSingleParameters(params, parameters) {
  // Basic parameters (symbol, dates, strategyMode)
  // Investment parameters (lotSizeUsd, maxLots, etc.)
  // Strategy parameters (gridIntervalPercent, profitRequirement, etc.)
  // Short selling parameters (conditional on strategyMode)
  // Beta parameters
  // Grid & Incremental Options (boolean flags)
  // Average-based features (Spec 23)
  // Dynamic profile (Spec 24)
  // Momentum-based trading (Spec 45) ← ADD HERE
  // Trailing stop order type
  // Source information
}
```

### 1.2: Add Boolean Parameters

**Example (Momentum Mode):**
```javascript
// Spec 23: Average-based features
if (parameters.enableAverageBasedGrid !== undefined) params.set('enableAverageBasedGrid', parameters.enableAverageBasedGrid.toString());
if (parameters.enableAverageBasedSell !== undefined) params.set('enableAverageBasedSell', parameters.enableAverageBasedSell.toString());

// Spec 24: Dynamic profile switching
if (parameters.enableDynamicProfile !== undefined) params.set('enableDynamicProfile', parameters.enableDynamicProfile.toString());

// Spec 45: Momentum-based trading parameters
if (parameters.momentumBasedBuy !== undefined) params.set('momentumBasedBuy', parameters.momentumBasedBuy.toString());
if (parameters.momentumBasedSell !== undefined) params.set('momentumBasedSell', parameters.momentumBasedSell.toString());

// Trailing stop order type (only include if not 'limit' to keep URLs clean)
if (parameters.trailingStopOrderType && parameters.trailingStopOrderType !== 'limit') {
  params.set('trailingStopOrderType', parameters.trailingStopOrderType);
}
```

**Pattern:**
```javascript
if (parameters.parameterName !== undefined) params.set('parameterName', parameters.parameterName.toString());
```

**Line Reference**: Around line 429-431 (for momentum mode)

### 1.3: Add Percentage Parameters

**Example:**
```javascript
if (parameters.thresholdPercent !== undefined) {
  params.set('thresholdPercent', this._formatDecimalAsPercentage(parameters.thresholdPercent).toString());
}
```

**Important**: Use `_formatDecimalAsPercentage()` helper:
- Backend stores: `0.10` (decimal)
- URL shows: `10` (whole number percentage)
- Conversion: `0.10 * 100 = 10`

### 1.4: Add Numeric Parameters

**Example:**
```javascript
if (parameters.maxRetries) params.set('maxRetries', parameters.maxRetries.toString());
```

### 1.5: Add String Parameters

**Example:**
```javascript
if (parameters.orderType && parameters.orderType !== 'default') {
  params.set('orderType', parameters.orderType);
}
```

**Tip**: Omit default values to keep URLs clean.

## Step 2: Add to URL Decoding

### Location
Method: `_decodeSingleParameters()` in `URLParameterManager.js`
Line Reference: Around line 567-661

### 2.1: Find Appropriate Section

Decoding follows similar organization:
```javascript
_decodeSingleParameters(params) {
  const decoded = {
    mode: 'single',
    // Basic parameters
    // Investment parameters
    // Strategy parameters
    // Short selling parameters (conditional)
    // Grid & Incremental Options boolean flags
    // Average-based features (Spec 23)
    // Dynamic profile (Spec 24)
    // Momentum-based trading (Spec 45) ← ADD HERE
    // Grid option numeric parameters
    // Trailing stop order type
  };

  return decoded;
}
```

### 2.2: Add Boolean Parameter Decoding

**Example (Momentum Mode):**
```javascript
// Spec 24: Dynamic profile switching
if (params.enableDynamicProfile !== undefined) {
  decoded.enableDynamicProfile = this._parseBoolean(params.enableDynamicProfile, false);
}

// Spec 45: Momentum-based trading parameters
if (params.momentumBasedBuy !== undefined) {
  decoded.momentumBasedBuy = this._parseBoolean(params.momentumBasedBuy, false);
}
if (params.momentumBasedSell !== undefined) {
  decoded.momentumBasedSell = this._parseBoolean(params.momentumBasedSell, false);
}

// Grid option numeric parameters
if (params.dynamicGridMultiplier !== undefined) {
  decoded.dynamicGridMultiplier = this._parseNumber(params.dynamicGridMultiplier, 1.0);
}
```

**Pattern:**
```javascript
if (params.parameterName !== undefined) {
  decoded.parameterName = this._parseBoolean(params.parameterName, defaultValue);
}
```

**Line Reference**: Around line 653-659 (for momentum mode)

### 2.3: Add Percentage Parameter Decoding

**Example:**
```javascript
if (params.thresholdPercent !== undefined) {
  decoded.thresholdPercent = this._parsePercentageAsDecimal(params.thresholdPercent, 10);
}
```

**Important**: Use `_parsePercentageAsDecimal()` helper:
- URL shows: `10` (whole number percentage)
- Backend expects: `0.10` (decimal)
- Conversion: `10 / 100 = 0.10`

### 2.4: Add Numeric Parameter Decoding

**Example:**
```javascript
if (params.maxRetries !== undefined) {
  decoded.maxRetries = this._parseNumber(params.maxRetries, 5);
}
```

### 2.5: Add String Parameter Decoding

**Example:**
```javascript
decoded.orderType = params.orderType || 'market';
```

## Step 3: Add to Override Support Arrays

### Location
Method: `_extractParameterOverrides()` in `URLParameterManager.js`
Line Reference: Around line 827-894

### 3.1: Add to Appropriate Array

The method uses type-specific arrays to handle parameter extraction:

**Boolean Parameters:**
```javascript
const booleanParams = [
  'enableBetaScaling', 'isManualBetaOverride',
  'enableDynamicGrid',
  'normalizeToReference', 'enableConsecutiveIncrementalSellProfit',
  'enableConsecutiveIncrementalBuyGrid',
  'enableAverageBasedGrid', 'enableAverageBasedSell',
  'momentumBasedBuy', 'momentumBasedSell'  // NEW: Add here
];
```

**Percentage Parameters:**
```javascript
const percentageParams = [
  'gridIntervalPercent', 'profitRequirement',
  'trailingBuyActivationPercent', 'trailingBuyReboundPercent',
  'trailingSellActivationPercent', 'trailingSellPullbackPercent',
  'thresholdPercent'  // NEW: Add percentage parameters here
];
```

**Numeric Parameters:**
```javascript
const numberParams = [
  'lotSizeUsd', 'maxLots', 'maxLotsToSell',
  'maxShorts', 'maxShortsToCovers',
  'beta', 'coefficient', 'dynamicGridMultiplier',
  'maxRetries'  // NEW: Add numeric parameters here
];
```

**String Parameters:**
```javascript
const stringParams = ['symbol', 'startDate', 'endDate', 'strategyMode', 'source'];
```

**Line Reference**: Around line 859-866 (for boolean params)

## Helper Methods Reference

### Boolean Parsing
```javascript
_parseBoolean(str, defaultValue) {
  if (str === 'true') return true;
  if (str === 'false') return false;
  return defaultValue;
}
```

**Usage**: Converts URL string "true"/"false" to JavaScript boolean

### Numeric Parsing
```javascript
_parseNumber(str, defaultValue) {
  const num = parseFloat(str);
  return isNaN(num) ? defaultValue : num;
}
```

**Usage**: Converts URL string to number with fallback

### Percentage Conversion - URL to Backend
```javascript
_parsePercentageAsDecimal(str, defaultPercentage) {
  const wholeNumber = this._parseNumber(str, defaultPercentage);
  return wholeNumber / 100;  // 10 → 0.10
}
```

**Usage**: Converts URL whole number (10) to backend decimal (0.10)

### Percentage Conversion - Backend to URL
```javascript
_formatDecimalAsPercentage(decimalValue) {
  return decimalValue * 100;  // 0.10 → 10
}
```

**Usage**: Converts backend decimal (0.10) to URL whole number (10)

## URL Format Examples

### Boolean Parameter
**URL**: `?momentumBasedBuy=true`
**Decoded**: `{ momentumBasedBuy: true }`

### Percentage Parameter
**URL**: `?gridIntervalPercent=12.5`
**Decoded**: `{ gridIntervalPercent: 0.125 }`

### Numeric Parameter
**URL**: `?maxLots=15`
**Decoded**: `{ maxLots: 15 }`

### String Parameter
**URL**: `?trailingStopOrderType=market`
**Decoded**: `{ trailingStopOrderType: 'market' }`

### Complete URL Example
```
http://localhost:3000/backtest/long/TSLA/results?
  startDate=2021-09-01&
  endDate=2022-03-01&
  lotSizeUsd=10000&
  maxLots=10&
  gridIntervalPercent=10&
  profitRequirement=10&
  momentumBasedBuy=true&
  momentumBasedSell=false&
  trailingStopOrderType=market
```

## Testing URL Parameter Round-Trip

### Test Encoding
```javascript
// In browser console
const params = {
  momentumBasedBuy: true,
  gridIntervalPercent: 0.10
};
const url = URLParameterManager.generateSemanticURL(params, 'single', true);
console.log(url);
```

**Expected**: URL includes `momentumBasedBuy=true&gridIntervalPercent=10`

### Test Decoding
```javascript
// Navigate to URL with parameters
// In browser console
const decoded = URLParameterManager.parseSemanticURL();
console.log(decoded.parameters);
```

**Expected**: `{ momentumBasedBuy: true, gridIntervalPercent: 0.10 }`

### Full Round-Trip Test
```bash
# 1. Run backtest with parameter
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{"symbol":"TSLA","momentumBasedBuy":true,"gridIntervalPercent":0.10,...}'

# 2. Check results URL in browser
# URL should show: ?momentumBasedBuy=true&gridIntervalPercent=10

# 3. Copy URL, open in new tab
# Parameters should be restored correctly
```

## URL Parameter Handling Checklist

- [ ] Added parameter to `_encodeSingleParameters()` method
- [ ] Used correct encoding helper (`toString()`, `_formatDecimalAsPercentage()`, etc.)
- [ ] Added parameter to `_decodeSingleParameters()` method
- [ ] Used correct decoding helper (`_parseBoolean()`, `_parsePercentageAsDecimal()`, etc.)
- [ ] Added parameter to appropriate array in `_extractParameterOverrides()`
- [ ] Added condition check (`!== undefined`) before encoding
- [ ] Provided sensible default value for decoding
- [ ] Tested URL encoding (parameter appears in URL)
- [ ] Tested URL decoding (parameter restored from URL)
- [ ] Tested round-trip (encode → decode → matches original)

## Common URL Handling Pitfalls

### Pitfall 1: Missing from Encoding Method
**Symptom**: Parameter works in UI but doesn't appear in shareable URL

**Cause**: Forgot to add to `_encodeSingleParameters()`

**Fix**: Add encoding logic as shown in Step 1.2-1.5

### Pitfall 2: Missing from Decoding Method
**Symptom**: URL has parameter but it's not restored when loading URL

**Cause**: Forgot to add to `_decodeSingleParameters()`

**Fix**: Add decoding logic as shown in Step 2.2-2.5

### Pitfall 3: Wrong Type Conversion for Percentages
**Problem**: Percentage shows as `0.10` in URL instead of `10`

**Wrong:**
```javascript
params.set('gridIntervalPercent', parameters.gridIntervalPercent.toString());  // Shows 0.10
```

**Correct:**
```javascript
params.set('gridIntervalPercent', this._formatDecimalAsPercentage(parameters.gridIntervalPercent).toString());  // Shows 10
```

### Pitfall 4: Not in Override Arrays
**Symptom**: Can't override compressed parameters with individual URL params

**Fix**: Add to appropriate array in `_extractParameterOverrides()`

### Pitfall 5: Missing Default Value
**Problem**: Parameter becomes undefined when not in URL

**Wrong:**
```javascript
if (params.momentumBasedBuy !== undefined) {
  decoded.momentumBasedBuy = this._parseBoolean(params.momentumBasedBuy);  // No default!
}
```

**Correct:**
```javascript
if (params.momentumBasedBuy !== undefined) {
  decoded.momentumBasedBuy = this._parseBoolean(params.momentumBasedBuy, false);  // Has default
}
```

## Real-World Example

See momentum mode implementation in `URLParameterManager.js`:

**Encoding (lines 429-431):**
```javascript
// Spec 45: Momentum-based trading parameters
if (parameters.momentumBasedBuy !== undefined) params.set('momentumBasedBuy', parameters.momentumBasedBuy.toString());
if (parameters.momentumBasedSell !== undefined) params.set('momentumBasedSell', parameters.momentumBasedSell.toString());
```

**Decoding (lines 653-659):**
```javascript
// Spec 45: Momentum-based trading parameters
if (params.momentumBasedBuy !== undefined) {
  decoded.momentumBasedBuy = this._parseBoolean(params.momentumBasedBuy, false);
}
if (params.momentumBasedSell !== undefined) {
  decoded.momentumBasedSell = this._parseBoolean(params.momentumBasedSell, false);
}
```

**Override Support (line 865):**
```javascript
const booleanParams = [
  // ... other params ...
  'momentumBasedBuy', 'momentumBasedSell'
];
```

This complete implementation enables:
- ✅ Parameters appear in shareable URLs
- ✅ Parameters restore when URL is loaded
- ✅ Parameters can override compressed params
- ✅ Round-trip encoding/decoding works perfectly
