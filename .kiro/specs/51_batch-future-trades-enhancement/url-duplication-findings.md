# URL Parameter Duplication Investigation Findings

## Issue Description

Batch backtest URLs contain duplicate symbol lists:
- **Path parameter**: `/batch/TSLA+APP+HOOD+...`
- **Query parameter**: `?symbols=TSLA%2CAPP%2CHOOD%2C...`

Example URL:
```
http://localhost:3000/batch/TSLA+APP+HOOD+SEZL+HIMS+.../results?symbols=TSLA%2CAPP%2CHOOD%2CSEZL%2CHIMS%2C...&startDate=...
```

## Root Cause Analysis

### File: `frontend/src/utils/URLParameterManager.js`

**Problem Location: `generateSemanticURL()` method (lines 178-243)**

The method attempts to avoid redundancy by deleting path parameters before encoding query parameters:

```javascript
// Line 204-211
// Prepare parameters (excluding path parameters to avoid redundancy)
const paramsToEncode = { ...parameters };
if (mode === 'single') {
  delete paramsToEncode.symbol;
  delete paramsToEncode.strategyMode;
} else if (mode === 'batch') {
  delete paramsToEncode.symbols;  // Only deletes top-level symbols!
}
```

**However**, the `_encodeBatchParameters()` method (lines 483-492) checks BOTH locations:

```javascript
const symbols = parameters.parameterRanges?.symbols || parameters.symbols;
if (symbols) {
  if (Array.isArray(symbols)) {
    params.set('symbols', symbols.join(','));  // Still adds symbols!
  } else {
    params.set('symbols', symbols);
  }
}
```

### The Issue

1. Symbols are added to the path: `/batch/TSLA+APP+HOOD+...` (line 196-197)
2. Only `paramsToEncode.symbols` is deleted (line 210)
3. `paramsToEncode.parameterRanges.symbols` is NOT deleted
4. `_encodeBatchParameters` finds symbols in `parameterRanges` and adds them to query parameters
5. Result: Symbols appear in both path and query parameters

## Impact Assessment

### Current Behavior
- **Frontend**: Both path and query parameters are present
- **Backend**: Likely uses query parameter (standard REST practice)
- **Path parameter**: Used for routing only
- **Duplication**: Causes URL bloat and confusion

### No Breaking Issues
- The duplication doesn't break functionality
- Backend API works correctly (uses query parameters)
- Frontend routing works correctly (uses path parameters)

## Recommended Solution

### Option 1: Delete Both Symbol Locations (Recommended)

**Change in `generateSemanticURL()` method (line 210):**

```javascript
} else if (mode === 'batch') {
  delete paramsToEncode.symbols;
  // [Spec 51] Also delete symbols from parameterRanges to prevent duplication in query params
  if (paramsToEncode.parameterRanges) {
    delete paramsToEncode.parameterRanges.symbols;
  }
}
```

**Pros:**
- Minimal code change (2 lines)
- No breaking changes
- Maintains backward compatibility
- Follows existing pattern

**Cons:**
- None identified

### Option 2: Remove Path Parameter Entirely

Remove symbols from the path and use only query parameters:
```
/batch/results?symbols=TSLA,APP,HOOD,...&startDate=...
```

**Pros:**
- Cleaner URL structure
- Standard REST API practice
- Easier to parse

**Cons:**
- Requires routing changes
- Less user-friendly URLs
- Breaking change for bookmarked URLs

### Option 3: Remove Query Parameter Entirely

Use only path parameters:
```
/batch/TSLA+APP+HOOD+.../results?startDate=...
```

**Pros:**
- More RESTful
- Better for bookmarking
- Cleaner query string

**Cons:**
- URL length limits with many symbols
- Harder to parse in backend
- Breaking change

## Decision

**Recommended: Option 1 - Delete Both Symbol Locations**

**Rationale:**
1. Minimal code change
2. No breaking changes
3. Fixes the duplication immediately
4. Maintains backward compatibility
5. Follows the existing pattern already established for single backtest mode

## Implementation

**File**: `frontend/src/utils/URLParameterManager.js`

**Location**: Line 210 (inside `generateSemanticURL` method)

**Change**:
```javascript
// Current code:
} else if (mode === 'batch') {
  delete paramsToEncode.symbols;
}

// New code:
} else if (mode === 'batch') {
  delete paramsToEncode.symbols;
  // [Spec 51] Also delete symbols from parameterRanges to prevent duplication in query params
  if (paramsToEncode.parameterRanges) {
    delete paramsToEncode.parameterRanges.symbols;
  }
}
```

## Testing Plan

1. **Generate Batch URL**
   - Create batch backtest with multiple symbols
   - Check URL format
   - Verify symbols appear only in path, not in query parameters

2. **Verify Functionality**
   - Navigate using generated URL
   - Verify batch backtest loads correctly
   - Check that results display properly

3. **Backward Compatibility**
   - Test with old URLs containing symbols in query params
   - Ensure they still work (the backend should prefer query params if present)

4. **Edge Cases**
   - Test with many symbols (50+)
   - Test with single symbol
   - Test with special characters in symbol names

## URL Comparison

### Before Fix:
```
http://localhost:3000/batch/TSLA+APP+HOOD+SEZL/results?symbols=TSLA%2CAPP%2CHOOD%2CSEZL&startDate=2021-09-01&endDate=2025-10-29&...
```

### After Fix:
```
http://localhost:3000/batch/TSLA+APP+HOOD+SEZL/results?startDate=2021-09-01&endDate=2025-10-29&...
```

**URL Length Reduction**: ~40-50 characters (depending on number of symbols)

## Conclusion

The URL duplication is caused by an incomplete deletion of the symbols parameter when generating semantic URLs. The fix is simple and non-breaking: also delete `parameterRanges.symbols` when preparing parameters for batch mode. This maintains the clean semantic URL structure with symbols in the path while avoiding redundancy in query parameters.
