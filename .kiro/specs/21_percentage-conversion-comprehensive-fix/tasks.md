# Tasks: Percentage Conversion Comprehensive Fix

## Phase 1: Update Specification (30 min)

### Task 1.1: Add URL Parameters Section to Spec
**File**: `.kiro/specs/percentage-conversion-standard.md`

Add new section after "Standard Convention":

```markdown
### URL Parameters Convention

**URLs MUST use WHOLE NUMBER PERCENTAGES** for human readability.

#### Rationale:
- URLs are user-facing and shareable
- `gridIntervalPercent=25.95` is more readable than `gridIntervalPercent=0.2595`
- Matches user mental model (people think in "25.95%" not "0.2595")

#### Rules:

1. **URL Encoding**: Convert decimals to whole numbers
   ```javascript
   // Backend URL logging
   const urlParam = toPercent(0.2595); // Returns 25.95
   const url = `gridIntervalPercent=${urlParam}`;
   ```

2. **URL Decoding**: Convert whole numbers to decimals
   ```javascript
   // URLParameterManager
   const decimal = parseFloat(urlParam) / 100; // 25.95 → 0.2595
   ```

3. **Examples**:
   ```
   ✅ CORRECT: ?gridIntervalPercent=25.95&profitRequirement=10
   ❌ WRONG:   ?gridIntervalPercent=0.2595&profitRequirement=0.10
   ```

#### Conversion Points:

| Point | Location | Input | Output | Method |
|-------|----------|-------|--------|--------|
| URL Encode | URLParameterManager.encodeParametersToURL() | 0.2595 (decimal) | 25.95 (whole) | `toPercent()` |
| URL Decode | URLParameterManager.parseSemanticURL() | 25.95 (whole) | 0.2595 (decimal) | `/ 100` |
| Backend Log | batchBacktestService.js | 0.2595 (decimal) | 25.95 (whole) | `toPercent()` |
```

**Acceptance Criteria**:
- [ ] Section added with clear rules
- [ ] Examples provided
- [ ] Conversion table included

---

### Task 1.2: Add Form State Management Section
**File**: `.kiro/specs/percentage-conversion-standard.md`

Add new section:

```markdown
### Form State Management

**Forms use WHOLE NUMBERS for UX, convert to DECIMALS for API**

#### Flow:

```
User Input (String)  →  Form State (Number)  →  API Request (Decimal)
    "10%"           →         10             →       0.10
```

#### Rules:

1. **Form State**: Store whole numbers for UX simplicity
   ```javascript
   const [gridInterval, setGridInterval] = useState(10); // Whole number
   ```

2. **API Submission**: Convert to decimals before sending
   ```javascript
   const handleSubmit = () => {
     const apiParams = {
       gridIntervalPercent: gridInterval / 100, // 10 → 0.10
       profitRequirement: profitReq / 100        // 5 → 0.05
     };
     api.post('/backtest/dca', apiParams);
   };
   ```

3. **Batch Parameters**: Convert arrays to decimals
   ```javascript
   const batchOptions = {
     parameterRanges: {
       profitRequirement: batchParams.profitRequirement.map(p => p / 100),
       gridIntervalPercent: batchParams.gridIntervalPercent.map(p => p / 100)
     }
   };
   ```

#### Anti-patterns:

❌ **Sending whole numbers to API**:
```javascript
// WRONG - violates decimal standard
api.post('/backtest/dca', { gridIntervalPercent: 10 });
```

✅ **Convert before API call**:
```javascript
// CORRECT - follows decimal standard
api.post('/backtest/dca', { gridIntervalPercent: 0.10 });
```
```

**Acceptance Criteria**:
- [ ] Section clearly explains form state convention
- [ ] API conversion examples provided
- [ ] Anti-patterns documented

---

## Phase 2: Fix Frontend Form → API Conversion (1 hour)

### Task 2.1: Fix DCABacktestForm Batch Parameters
**File**: `frontend/src/components/DCABacktestForm.js`
**Lines**: 683-713

**Current Code** (VIOLATION):
```javascript
if (batchMode) {
  // Use whole numbers directly (10 = 10%) - no conversion needed
  const batchOptions = {
    parameterRanges: {
      symbols: batchParameters.symbols,
      coefficients: batchParameters.coefficients,
      maxLotsToSell: batchParameters.maxLotsToSell,
      profitRequirement: batchParameters.profitRequirement,  // ❌ Whole numbers
      gridIntervalPercent: batchParameters.gridIntervalPercent,  // ❌ Whole numbers
      // ... other parameters
    },
    // ...
  };
  onSubmit(batchOptions, true);
}
```

**Required Fix**:
```javascript
if (batchMode) {
  // Convert percentage arrays from whole numbers to decimals for API
  const convertPercentageArray = (arr) => arr.map(val => val / 100);

  const batchOptions = {
    parameterRanges: {
      symbols: batchParameters.symbols,
      coefficients: batchParameters.coefficients,  // Not percentages, leave as-is
      maxLotsToSell: batchParameters.maxLotsToSell,  // Not percentages, leave as-is
      profitRequirement: convertPercentageArray(batchParameters.profitRequirement),  // ✅ Convert
      gridIntervalPercent: convertPercentageArray(batchParameters.gridIntervalPercent),  // ✅ Convert
      trailingBuyActivationPercent: convertPercentageArray(batchParameters.trailingBuyActivationPercent),
      trailingBuyReboundPercent: convertPercentageArray(batchParameters.trailingBuyReboundPercent),
      trailingSellActivationPercent: convertPercentageArray(batchParameters.trailingSellActivationPercent),
      trailingSellPullbackPercent: convertPercentageArray(batchParameters.trailingSellPullbackPercent),
      dynamicGridMultiplier: batchParameters.dynamicGridMultiplier,  // Not percentage, leave as-is
      gridConsecutiveIncrement: batchParameters.gridConsecutiveIncrement,  // Not percentage, leave as-is
      // Fixed parameters from single mode
      startDate: parameters.startDate,
      endDate: parameters.endDate,
      lotSizeUsd: parameters.lotSizeUsd,
      maxLots: parameters.maxLots
    },
    // Move enableBetaScaling to top level to match URL structure
    enableBetaScaling: batchParameters.enableBetaScaling,
    enableDynamicGrid: batchParameters.enableDynamicGrid,
    normalizeToReference: batchParameters.normalizeToReference,
    enableConsecutiveIncrementalBuyGrid: batchParameters.enableConsecutiveIncrementalBuyGrid,
    enableConsecutiveIncrementalSellProfit: batchParameters.enableConsecutiveIncrementalSellProfit,
    enableScenarioDetection: batchParameters.enableScenarioDetection,
    sortBy: 'totalReturn'
  };
  onSubmit(batchOptions, true);
}
```

**Acceptance Criteria**:
- [ ] All percentage parameters converted to decimals
- [ ] Non-percentage parameters (coefficients, maxLotsToSell, etc.) left unchanged
- [ ] Comment updated to reflect new behavior
- [ ] Code tested with sample batch request

---

### Task 2.2: Fix DCABacktestForm Single Parameters
**File**: `frontend/src/components/DCABacktestForm.js`
**Lines**: 714-735

**Current Code** (VIOLATION):
```javascript
} else {
  // Use whole numbers directly (10 = 10%) - no conversion needed
  const backendParams = {
    ...parameters,
    gridIntervalPercent: parameters.gridIntervalPercent,  // ❌ Whole number
    profitRequirement: parameters.profitRequirement,  // ❌ Whole number
    // ... other percentage parameters
  };
  onSubmit(backendParams, false);
}
```

**Required Fix**:
```javascript
} else {
  // Convert percentage parameters from whole numbers to decimals for API
  const backendParams = {
    ...parameters,
    gridIntervalPercent: parameters.gridIntervalPercent / 100,  // ✅ Convert
    profitRequirement: parameters.profitRequirement / 100,  // ✅ Convert
    trailingBuyActivationPercent: parameters.trailingBuyActivationPercent / 100,
    trailingBuyReboundPercent: parameters.trailingBuyReboundPercent / 100,
    trailingSellActivationPercent: parameters.trailingSellActivationPercent / 100,
    trailingSellPullbackPercent: parameters.trailingSellPullbackPercent / 100,
    // Add Beta information (not percentages, leave as-is)
    beta: beta,
    coefficient: coefficient,
    betaFactor: betaFactor,
    enableBetaScaling: enableBetaScaling,
    isManualBetaOverride: isManualBetaOverride,
    // Add strategy mode
    strategyMode: strategyMode
  };
  onSubmit(backendParams, false);
}
```

**Acceptance Criteria**:
- [ ] All percentage parameters converted to decimals
- [ ] Beta parameters left unchanged
- [ ] Comment updated
- [ ] Single backtest tested

---

### Task 2.3: Fix Short Selling Form Parameters
**File**: `frontend/src/components/DCABacktestForm.js`
**Lines**: 634-665 (shortBatchParameters)

Apply same conversion pattern to short selling parameters.

**Acceptance Criteria**:
- [ ] Short batch parameters converted
- [ ] Short single parameters converted
- [ ] Tested with short strategy mode

---

## Phase 3: Remove Backend Workaround (30 min)

### Task 3.1: Remove Compensation in Batch Service
**File**: `backend/services/batchBacktestService.js`
**Lines**: 96-112

**Current Code** (WORKAROUND):
```javascript
// Calculate Beta-adjusted parameters using parameterCorrelationService
// Convert whole number percentages to decimals before scaling (10 -> 0.10)
const baseParams = {
  profitRequirement: profit / 100,  // ⚠️ WORKAROUND for frontend violation
  gridIntervalPercent: grid / 100,  // ⚠️ WORKAROUND for frontend violation
  // ...
};
```

**Required Fix**:
```javascript
// Calculate Beta-adjusted parameters using parameterCorrelationService
// Frontend now sends decimals per spec, use directly
const baseParams = {
  profitRequirement: profit,  // ✅ Already decimal from frontend
  gridIntervalPercent: grid,  // ✅ Already decimal from frontend
  trailingBuyActivationPercent: buyActivation,
  trailingBuyReboundPercent: buyRebound,
  trailingSellActivationPercent: sellActivation,
  trailingSellPullbackPercent: sellPullback
};
```

**Acceptance Criteria**:
- [ ] Division by 100 removed
- [ ] Comment updated
- [ ] Tested with corrected frontend

**IMPORTANT**: This task MUST be done AFTER Task 2.1 (frontend fix), otherwise batch tests will break.

---

## Phase 4: Fix Backend URL Logging (30 min)

### Task 4.1: Fix Batch Service URL Logging
**File**: `backend/services/batchBacktestService.js`
**Lines**: 463-480

**Current Code**:
```javascript
const toPercent = (decimal) => (decimal * 100).toFixed(3);
const frontendUrl = `http://localhost:3000/backtest?mode=single&symbol=${params.symbol}` +
  `&startDate=${params.startDate}&endDate=${params.endDate}&strategyMode=long` +
  `&lotSizeUsd=${params.lotSizeUsd}&maxLots=${params.maxLots}&maxLotsToSell=${params.maxLotsToSell}` +
  `&gridIntervalPercent=${toPercent(params.gridIntervalPercent)}` +
  `&profitRequirement=${toPercent(params.profitRequirement)}` +
  // ... rest of parameters
```

**Debug Check**:
Before fixing, add logging to verify what `params.gridIntervalPercent` contains:
```javascript
console.log(`🐛 URL LOGGING DEBUG:`);
console.log(`  params.gridIntervalPercent (raw): ${params.gridIntervalPercent}`);
console.log(`  params.gridIntervalPercent type: ${typeof params.gridIntervalPercent}`);
console.log(`  toPercent result: ${toPercent(params.gridIntervalPercent)}`);
```

**Expected After Frontend Fix**:
- `params.gridIntervalPercent` = 0.2595 (decimal after beta scaling)
- `toPercent(0.2595)` = 25.950 ✓
- URL shows: `gridIntervalPercent=25.950` ✓

**Acceptance Criteria**:
- [ ] URL logging shows whole numbers (25.95 not 0.2595)
- [ ] Debug logging confirms correct values
- [ ] URL can be copy-pasted and works correctly

---

### Task 4.2: Add URL Logging to Single DCA Endpoint
**File**: `backend/server.js`
**Lines**: After line 770 (after beta scaling)

**Add Similar Logging**:
```javascript
// Log equivalent frontend URL for debugging (after beta scaling if enabled)
const toPercent = (decimal) => (decimal * 100).toFixed(3);
const frontendUrl = `http://localhost:3000/backtest?mode=single&symbol=${symbol}` +
  `&startDate=${startDate}&endDate=${endDate}&strategyMode=long` +
  `&lotSizeUsd=${lotSizeUsd}&maxLots=${maxLots}&maxLotsToSell=${maxLotsToSell}` +
  `&gridIntervalPercent=${toPercent(finalParams.gridIntervalPercent)}` +
  `&profitRequirement=${toPercent(finalParams.profitRequirement)}` +
  `&trailingBuyActivationPercent=${toPercent(finalParams.trailingBuyActivationPercent)}` +
  `&trailingBuyReboundPercent=${toPercent(finalParams.trailingBuyReboundPercent)}` +
  `&trailingSellActivationPercent=${toPercent(finalParams.trailingSellActivationPercent)}` +
  `&trailingSellPullbackPercent=${toPercent(finalParams.trailingSellPullbackPercent)}`;

console.log(`🌐 Equivalent Frontend URL: ${frontendUrl}`);
```

**Acceptance Criteria**:
- [ ] Single DCA endpoint logs URLs
- [ ] URLs show whole number percentages
- [ ] Consistent format with batch logging

---

## Phase 5: Verify URLParameterManager (30 min)

### Task 5.1: Review URL Encoding Logic
**File**: `frontend/src/utils/URLParameterManager.js`
**Method**: `_encodeDecimalArrayAsPercentage()` (lines 672-677)

**Current Code**:
```javascript
_encodeDecimalArrayAsPercentage(decimalArray) {
  if (!Array.isArray(decimalArray)) return decimalArray?.toString() || '';
  // Convert decimals to whole number percentages for URL
  // 0.05 -> 5, 0.10 -> 10, etc.
  return decimalArray.map(d => d * 100).join(',');
}
```

**Verification**:
- [ ] Confirm this correctly converts decimals → whole numbers
- [ ] Test with beta-scaled values: `[0.2595, 0.1298]` → `"25.95,12.98"`
- [ ] Confirm usage in `encodeParametersToURL()`

---

### Task 5.2: Review URL Decoding Logic
**File**: `frontend/src/utils/URLParameterManager.js`
**Method**: `_decodePercentageArray()` (lines 657-666)

**Current Code**:
```javascript
_decodePercentageArray(str, defaultPercentageArray = []) {
  if (!str) return defaultPercentageArray;
  return str.split(',').map(s => {
    const num = parseFloat(s.trim());
    if (isNaN(num)) return 0;
    // Convert whole number percentages to decimals for backend
    // 5 -> 0.05, 10 -> 0.10, etc.
    return num / 100;
  }).filter(n => n >= 0);
}
```

**Verification**:
- [ ] Confirm this correctly converts whole numbers → decimals
- [ ] Test with beta-scaled values: `"25.95,12.98"` → `[0.2595, 0.1298]`
- [ ] Confirm usage in `decodeBatchParameters()` and `parseSemanticURL()`

---

### Task 5.3: Review JSON-Encoded Parameter Conversion
**File**: `frontend/src/utils/URLParameterManager.js`
**Lines**: 282-299

**Current Code**:
```javascript
if (value.startsWith('{') || value.startsWith('[')) {
  const parsed = JSON.parse(value);
  // Special handling for parameterRanges - convert percentage arrays to decimals
  if (key === 'parameterRanges' && typeof parsed === 'object') {
    const percentageRangeParams = [
      'profitRequirement',
      'gridIntervalPercent',
      // ... other percentage parameters
    ];
    for (const param of percentageRangeParams) {
      if (Array.isArray(parsed[param])) {
        // Convert whole number percentages to decimals: [5, 10] -> [0.05, 0.10]
        parsed[param] = parsed[param].map(v => v / 100);
      }
    }
  }
  parameters[key] = parsed;
}
```

**Verification**:
- [ ] Confirm this handles JSON-encoded arrays correctly
- [ ] Test with: `parameterRanges={"profitRequirement":[10,5]}`
- [ ] Should convert to: `{profitRequirement: [0.10, 0.05]}`

**Acceptance Criteria**:
- [ ] All three methods verified correct
- [ ] Test cases cover beta-scaled values
- [ ] No changes needed (already correct per spec)

---

## Phase 6: Testing (1 hour)

### Task 6.1: Unit Test - Percentage Conversions

**File**: Create `frontend/src/utils/__tests__/URLParameterManager.percentages.test.js`

```javascript
describe('URLParameterManager - Percentage Conversions', () => {
  test('encodes decimals to whole number percentages', () => {
    const params = {
      gridIntervalPercent: [0.2595, 0.1298],  // Beta-scaled values
      profitRequirement: [0.10, 0.05]
    };
    const encoded = URLParameterManager.encodeParametersToURL(params);
    expect(encoded).toContain('gridIntervalPercent=25.95,12.98');
    expect(encoded).toContain('profitRequirement=10,5');
  });

  test('decodes whole number percentages to decimals', () => {
    const url = '?gridIntervalPercent=25.95,12.98&profitRequirement=10,5';
    const decoded = URLParameterManager.decodeParametersFromURL(url);
    expect(decoded.gridIntervalPercent).toEqual([0.2595, 0.1298]);
    expect(decoded.profitRequirement).toEqual([0.10, 0.05]);
  });

  test('round-trip conversion preserves values', () => {
    const original = {
      gridIntervalPercent: [0.2595, 0.1298],
      profitRequirement: [0.10, 0.05]
    };
    const encoded = URLParameterManager.encodeParametersToURL(original);
    const decoded = URLParameterManager.decodeParametersFromURL(encoded);

    expect(decoded.gridIntervalPercent[0]).toBeCloseTo(0.2595, 4);
    expect(decoded.gridIntervalPercent[1]).toBeCloseTo(0.1298, 4);
  });
});
```

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Covers beta-scaled values
- [ ] Tests round-trip conversion

---

### Task 6.2: Integration Test - Form → API → URL

**Manual Test Procedure**:

1. **Setup**: Start frontend and backend servers
   ```bash
   cd frontend && npm start
   cd backend && npm start
   ```

2. **Test Batch Mode**:
   - Navigate to http://localhost:3000
   - Select "Batch Test"
   - Enter parameters:
     - Symbol: PLTR
     - Profit Requirement: 10, 5
     - Grid Interval: 10, 5
     - Enable Beta Scaling: ✓
     - Coefficient: 1
   - Click "Run Batch Test"

3. **Verify Backend Logs**:
   ```
   Expected in terminal:
   📝 Body Parameters: {
     parameterRanges: {
       profitRequirement: [ 0.1, 0.05 ],  // ✅ Decimals from frontend
       gridIntervalPercent: [ 0.1, 0.05 ]  // ✅ Decimals from frontend
     }
   }

   🚀 SPAWNING TEST 1/X: PLTR Beta: 2.595, Coeff: 1, β-factor: 2.60
   🌐 URL: http://localhost:3000/backtest?...&gridIntervalPercent=25.95&profitRequirement=25.95...
                                                                  ^^^^^^                    ^^^^^^
   Expected: 25.95 (0.10 × 2.595 × 100)
   ```

4. **Verify Frontend URL**:
   - Browser should navigate to URL like:
     ```
     http://localhost:3000/batch/PLTR/results?profitRequirement=10,5&gridIntervalPercent=10,5...
     ```
   - Parameters should show as whole numbers (10, 5) not decimals (0.10, 0.05)

5. **Test Single Backtest from Batch**:
   - Click "Run" button on a batch result
   - Check URL shows whole numbers: `gridIntervalPercent=25.95`
   - Backend should receive decimal: `0.2595`
   - Result should match batch result

**Acceptance Criteria**:
- [ ] Frontend sends decimals to API
- [ ] Backend logs whole number URLs
- [ ] URLs are human-readable
- [ ] Copy-paste URL works correctly
- [ ] Single test from batch matches result

---

### Task 6.3: Regression Test - Existing URLs

**Test Old URLs Still Work**:

1. Test URL without beta scaling:
   ```
   http://localhost:3000/backtest?mode=single&symbol=AAPL&profitRequirement=10&gridIntervalPercent=10
   ```
   - Should parse: profitRequirement=0.10, gridIntervalPercent=0.10
   - Should work correctly

2. Test batch URL:
   ```
   http://localhost:3000/batch/AAPL/results?profitRequirement=5,10&gridIntervalPercent=5,10
   ```
   - Should parse arrays correctly
   - Should work correctly

3. Test beta-scaled URL (new format):
   ```
   http://localhost:3000/backtest?symbol=PLTR&profitRequirement=25.95&gridIntervalPercent=25.95&enableBetaScaling=true&coefficient=1
   ```
   - Should parse: profitRequirement=0.2595, gridIntervalPercent=0.2595
   - Should work correctly

**Acceptance Criteria**:
- [ ] All URL formats work
- [ ] No breaking changes to existing URLs
- [ ] Beta-scaled URLs parse correctly

---

## Phase 7: Documentation Update (30 min)

### Task 7.1: Update percentage-conversion-standard.md

Add sections created in Task 1.1 and 1.2:
- [ ] URL Parameters Convention section
- [ ] Form State Management section
- [ ] Update Quick Reference table
- [ ] Add complete flow diagram

---

### Task 7.2: Create Flow Diagram

Add to spec:

```markdown
## Complete Percentage Conversion Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│ USER INPUT: "10%"                                                        │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
                          parsePercentString("10%")
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│ FORM STATE: 10 (whole number)                                           │
│ Location: DCABacktestForm.js useState()                                 │
│ Format: Whole numbers for UX                                            │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
                            onSubmit() / 100
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│ API REQUEST: 0.10 (decimal)                                             │
│ Location: POST /api/backtest/dca                                        │
│ Format: Decimals per spec                                               │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
                    Backend Processing (Beta Scaling)
                     0.10 × 2.595 = 0.2595 (decimal)
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│ BACKEND URL LOGGING: gridIntervalPercent=25.95                          │
│ Location: batchBacktestService.js                                       │
│ Format: Whole numbers × 100 for readability                             │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
                    User copies URL from terminal
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│ URL NAVIGATION: ?gridIntervalPercent=25.95                              │
│ Location: Browser address bar                                           │
│ Format: Whole numbers for human readability                             │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
            URLParameterManager.parseSemanticURL() / 100
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│ INTERNAL STATE: 0.2595 (decimal)                                        │
│ Location: App.js urlParams                                              │
│ Format: Decimals for internal processing                                │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
                  formatParameterPercent() × 100
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│ DISPLAY: "25.95%"                                                        │
│ Location: BatchResults.js / BacktestResults.js                          │
│ Format: Percentage string for user                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

**Key Conversion Points**:
1. **User Input → Form State**: Parse string, keep whole number
2. **Form State → API**: Divide by 100 (whole → decimal)
3. **Backend Processing**: Use decimals internally
4. **Backend → URL Log**: Multiply by 100 (decimal → whole)
5. **URL → Internal**: Divide by 100 (whole → decimal)
6. **Internal → Display**: Multiply by 100, format (decimal → string)
```

**Acceptance Criteria**:
- [ ] Flow diagram added
- [ ] All conversion points documented
- [ ] Clear visual representation

---

### Task 7.3: Update Checklist

Update the "Checklist for New Code" section:

```markdown
## Checklist for New Code

When adding percentage-related code, verify:

- [ ] **API requests use decimals** (0.05, not 5)
  - Form submissions convert whole → decimal before API call
  - Batch parameters convert arrays: `arr.map(v => v / 100)`

- [ ] **API responses use decimals** (0.05, not 5)
  - Backend returns decimals per spec
  - No conversion needed in response handlers

- [ ] **URLs use whole numbers** (5, not 0.05)
  - URLParameterManager encodes: `value * 100`
  - URLParameterManager decodes: `value / 100`
  - Backend URL logging: `toPercent(decimal)`

- [ ] **Display uses format functions**
  - `formatParameterPercent()` for strategy parameters
  - `formatPerformancePercent()` for backtest results
  - Never manual string concatenation with `%`

- [ ] **No raw conversions**
  - Use `toPercent()` instead of `* 100`
  - Use `toDecimal()` instead of `/ 100`
  - Use utility functions consistently

- [ ] **Documentation states format**
  - JSDoc comments specify decimal vs whole number
  - Parameter descriptions note conversion requirements

- [ ] **Tests verify conversions**
  - Unit tests for conversion functions
  - Integration tests for full flow
  - Edge cases covered (0, negatives, large values)
```

**Acceptance Criteria**:
- [ ] Checklist updated with URL conventions
- [ ] Covers all conversion points
- [ ] Actionable for developers

---

## Phase 8: Cleanup (15 min)

### Task 8.1: Remove Debug Logging

Remove temporary debug logs added during investigation:
- [ ] `batchBacktestService.js` - remove "🐛 Total Return Debug"
- [ ] `batchBacktestService.js` - remove "🐛 Annualized Return Debug"
- [ ] `batchBacktestService.js` - remove "🐛 Created summary" debug (or keep if useful)

**Acceptance Criteria**:
- [ ] Temporary debug logs removed
- [ ] Keep useful operational logs
- [ ] Clean, production-ready output

---

### Task 8.2: Update Comments

Update misleading comments:
- [ ] `DCABacktestForm.js:684` - "Use whole numbers directly (10 = 10%) - no conversion needed"
  - Change to: "Convert whole numbers to decimals for API (10 → 0.10)"
- [ ] `batchBacktestService.js:98` - "Convert whole number percentages to decimals before scaling (10 -> 0.10)"
  - Change to: "Frontend sends decimals per spec, use directly for beta scaling"

**Acceptance Criteria**:
- [ ] All comments accurate
- [ ] Reflect new convention
- [ ] No misleading documentation

---

## Execution Order

**CRITICAL**: Tasks must be executed in this order to avoid breaking changes:

1. **Phase 1** (Spec Update) - Document the standard first
2. **Phase 2** (Frontend Fix) - Fix frontend to send decimals
3. **Phase 3** (Backend Workaround Removal) - Remove backend compensation
4. **Phase 4** (URL Logging) - Fix backend URL generation
5. **Phase 5** (Verification) - Confirm URLParameterManager correct
6. **Phase 6** (Testing) - Comprehensive testing
7. **Phase 7** (Documentation) - Complete documentation
8. **Phase 8** (Cleanup) - Remove temporary code

**DO NOT** execute Phase 3 before Phase 2 - this will break batch tests!

---

## Testing Checkpoints

After each phase, verify:

- **After Phase 2**: Frontend sends decimals to API
- **After Phase 3**: Backend uses decimals directly (no /100)
- **After Phase 4**: Backend logs whole number URLs
- **After Phase 5**: URLParameterManager handles all formats
- **After Phase 6**: All tests pass, manual testing complete

---

## Rollback Plan

If issues occur:

1. **Phase 2 breaks**: Revert `DCABacktestForm.js` changes
2. **Phase 3 breaks**: Restore `/100` division in `batchBacktestService.js`
3. **Phase 4 breaks**: Revert URL logging changes
4. **Full rollback**: Git revert to commit before changes

---

## Success Metrics

- [ ] All unit tests pass
- [ ] Manual integration test passes
- [ ] Backend logs show whole number URLs (25.95 not 0.2595)
- [ ] Frontend sends decimals to API (0.10 not 10)
- [ ] URLParameterManager correctly handles all formats
- [ ] Copy-paste URLs work correctly
- [ ] Spec fully documents all conversion points
- [ ] No breaking changes to existing URLs
- [ ] Zero manual `* 100` or `/ 100` operations (outside utilities)

---

## Estimated Time

- Phase 1: 30 min
- Phase 2: 1 hour
- Phase 3: 30 min
- Phase 4: 30 min
- Phase 5: 30 min
- Phase 6: 1 hour
- Phase 7: 30 min
- Phase 8: 15 min

**Total**: ~4.5 hours
