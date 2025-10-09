# Batch Result URL Parameter Analysis

## ✅ IMPLEMENTATION COMPLETE (2025-10-08)

### Summary of Fix

Implemented **Option 3 - Hybrid Fix** to ensure batch result URLs preserve original batch request parameters.

**Backend Changes** (batchBacktestService.js:635-643):
- Added `batchRequestParameters` object to batch response containing:
  - `enableBetaScaling`, `enableDynamicGrid`, `normalizeToReference`
  - `enableConsecutiveIncrementalBuyGrid`, `enableConsecutiveIncrementalSellProfit`
  - `gridConsecutiveIncrement`, `enableScenarioDetection`

**Frontend Changes** (BatchResults.js:137-147):
- Modified URL generation to use `data.batchRequestParameters` for non-varying boolean flags
- Falls back to combination parameters for backward compatibility
- Preserves combination parameters for varying values (e.g., `dynamicGridMultiplier`)

**Result**: Individual run URLs now correctly match the original batch request parameters.

---

## Issue Summary

When clicking on a batch result row to open the individual backtest, the URL parameters don't match the batch input parameters. This causes the individual test to produce different results than shown in the batch results table.

## Specific Issues Found

### Issue 1: `enableBetaScaling` Mismatch
**Batch URL**: `enableBetaScaling=false`
**Individual Run URL**: `enableBetaScaling=true`

**Root Cause**:
- Batch backend stores `enableBetaScaling: true` in the combination objects when beta scaling is enabled (line 134 in batchBacktestService.js)
- Frontend BatchResults.js takes `enableBetaScaling` from the parameters object without overriding it (line 130-144)
- **PARTIALLY FIXED**: My recent change forces `enableBetaScaling=false` in the URL, but this needs verification

### Issue 2: `enableDynamicGrid` Mismatch
**Batch URL**: `enableDynamicGrid=false`
**Individual Run URL**: `enableDynamicGrid=true`

**Root Cause**:
- Batch backend uses DEFAULTS from `generateParameterCombinations` function (lines 49-52):
  ```javascript
  enableDynamicGrid = true,  // DEFAULT is true!
  normalizeToReference = true,
  enableConsecutiveIncrementalBuyGrid = false,
  enableConsecutiveIncrementalSellProfit = true
  ```
- When the batch request has `enableDynamicGrid=false`, the backend SHOULD use that value, but the default is true
- These defaults are then passed to each combination (lines 135-138, 193-196)
- Frontend takes these values directly from parameters object (lines 130-136)

## How Batch Processing Works

### Step-by-Step Flow:

1. **Frontend**: User submits batch request with `parameterRanges`:
   ```javascript
   {
     symbols: ['PLTR'],
     enableBetaScaling: false,
     enableDynamicGrid: false,
     normalizeToReference: true,
     // ... other parameters
   }
   ```

2. **Backend** (`batchBacktestService.js`): `generateParameterCombinations(paramRanges)` is called:
   - Line 31-53: Extracts parameters from `paramRanges` with HARD-CODED DEFAULTS
   - Line 49: `enableDynamicGrid = true` (DEFAULT!)
   - Line 50: `normalizeToReference = true` (DEFAULT!)
   - Line 52: `enableConsecutiveIncrementalSellProfit = true` (DEFAULT!)

3. **Backend**: For each combination:
   - **If enableBetaScaling=true** (lines 70-162):
     - Calculates beta-adjusted parameters
     - Stores combination with `enableBetaScaling: true` (line 134)
     - Stores `enableDynamicGrid`, `normalizeToReference`, etc. from destructured defaults (lines 135-138)

   - **If enableBetaScaling=false** (lines 163-207):
     - Uses parameters as-is
     - Stores combination with `enableBetaScaling: false` (line 192)
     - Stores `enableDynamicGrid`, `normalizeToReference`, etc. from destructured defaults (lines 193-196)

4. **Backend**: Runs backtest with these combination parameters

5. **Backend**: Returns results with `parameters` object containing the combination used

6. **Frontend** (`BatchResults.js`): When user clicks a row:
   - Lines 130-136: Conditionally adds boolean flags from `parameters` object
   - Line 130: `if (parameters.enableDynamicGrid !== undefined) urlParams.enableDynamicGrid = parameters.enableDynamicGrid;`
   - **PROBLEM**: This uses the value from the combination, which may have come from the DEFAULT, not from the user's input!

## The Core Problem

**The batch backend's `generateParameterCombinations` function uses hard-coded defaults that override the user's input when the user doesn't provide a value.**

Example:
- User sets `enableDynamicGrid=false` in batch request
- Backend destructures with `enableDynamicGrid = true` (line 49)
- **JavaScript destructuring**: If `paramRanges.enableDynamicGrid` is `false`, it WILL use `false`
- **BUT**: If `paramRanges.enableDynamicGrid` is `undefined`, it uses the default `true`

**WAIT** - Let me verify this is actually the issue...

Looking at line 49:
```javascript
enableDynamicGrid = true,
```

This should work correctly with destructuring:
- If `paramRanges.enableDynamicGrid === false`, then `enableDynamicGrid = false`
- If `paramRanges.enableDynamicGrid === undefined`, then `enableDynamicGrid = true`

**So the issue might be**:
1. The batch request doesn't include `enableDynamicGrid` in parameterRanges (it's undefined)
2. Backend uses default `true`
3. Each combination gets `enableDynamicGrid: true`
4. Frontend URL shows `enableDynamicGrid=true`

## Source of Truth: Where Should These Values Come From?

### Parameters that should come from BATCH REQUEST (top-level, not ranges):
- `enableBetaScaling` - NEVER varies per combination, applies to ALL
- `enableDynamicGrid` - NEVER varies per combination, applies to ALL
- `normalizeToReference` - NEVER varies per combination, applies to ALL
- `enableConsecutiveIncrementalBuyGrid` - NEVER varies per combination, applies to ALL
- `enableConsecutiveIncrementalSellProfit` - NEVER varies per combination, applies to ALL
- `enableScenarioDetection` - NEVER varies per combination, applies to ALL
- `dynamicGridMultiplier` - CAN vary (it's in a range)
- `gridConsecutiveIncrement` - CAN vary (it's in a range)

### Parameters that SHOULD vary per combination:
- `symbol` - from symbols array
- `profitRequirement` - from range
- `gridIntervalPercent` - from range
- `trailingBuyActivationPercent` - from range
- `trailingBuyReboundPercent` - from range
- `trailingSellActivationPercent` - from range
- `trailingSellPullbackPercent` - from range
- `coefficients` - from range (affects beta scaling)
- `maxLotsToSell` - from range

## Recommended Solution

### Option 1: Frontend Fix (BatchResults.js)
**Force specific values** from the original batch request instead of trusting the combination's parameters:

```javascript
// DON'T take from parameters - force from batch request
urlParams.enableBetaScaling = false;  // ALWAYS false for batch results
urlParams.enableDynamicGrid = BATCH_REQUEST.enableDynamicGrid;  // From original request
urlParams.normalizeToReference = BATCH_REQUEST.normalizeToReference;
// etc...
```

**PROBLEM**: Frontend doesn't have access to the original batch request parameters!

### Option 2: Backend Fix (batchBacktestService.js)
**Pass both the combination parameters AND the original request parameters** in the response:

```javascript
{
  parameters: { /* combination parameters */ },
  batchRequestParameters: { /* original batch request parameters */ }
}
```

Then frontend can use `batchRequestParameters` for boolean flags.

### Option 3: Hybrid Fix (RECOMMENDED)
**Backend**: Include original batch request parameters in response metadata
**Frontend**: Override specific parameters from batch request when generating URLs

For boolean flags that don't vary:
- Take from `data.batchRequestParameters` or `data.originalRequest`

For parameters that vary (ranges):
- Take from `parameters` (the combination)

## List of All Parameters and Their Sources

| Parameter | Should Vary? | Source in URL | Notes |
|-----------|--------------|---------------|-------|
| `symbol` | YES | `parameters.symbol` | From symbols array |
| `startDate` | NO | `parameters.startDate` | Same for all |
| `endDate` | NO | `parameters.endDate` | Same for all |
| `lotSizeUsd` | NO | `parameters.lotSizeUsd` | Same for all |
| `maxLots` | NO | `parameters.maxLots` | Same for all |
| `maxLotsToSell` | YES | `parameters.maxLotsToSell` | From range |
| `profitRequirement` | YES | `parameters.profitRequirement` | From range |
| `gridIntervalPercent` | YES | `parameters.gridIntervalPercent` | From range |
| `trailingBuyActivationPercent` | YES | `parameters.trailingBuyActivationPercent` | From range |
| `trailingBuyReboundPercent` | YES | `parameters.trailingBuyReboundPercent` | From range |
| `trailingSellActivationPercent` | YES | `parameters.trailingSellActivationPercent` | From range |
| `trailingSellPullbackPercent` | YES | `parameters.trailingSellPullbackPercent` | From range |
| `beta` | YES (per symbol) | `parameters.beta` | Fetched per symbol |
| `coefficient` | YES | `parameters.coefficient` | From range |
| `enableBetaScaling` | **NO** | **FORCE `false`** | **Already scaled!** |
| `isManualBetaOverride` | NO | **FORCE `false`** | Not relevant |
| `enableDynamicGrid` | **NO** | **BATCH REQUEST** | **Same for all** |
| `normalizeToReference` | **NO** | **BATCH REQUEST** | **Same for all** |
| `enableConsecutiveIncrementalBuyGrid` | **NO** | **BATCH REQUEST** | **Same for all** |
| `enableConsecutiveIncrementalSellProfit` | **NO** | **BATCH REQUEST** | **Same for all** |
| `enableScenarioDetection` | **NO** | **BATCH REQUEST** | **Same for all** |
| `dynamicGridMultiplier` | YES | `parameters.dynamicGridMultiplier` | From range |
| `gridConsecutiveIncrement` | YES | `parameters.gridConsecutiveIncrement` | From range |

## Proposed Fix Specification

### Backend Changes:
1. **Include original request in response**:
   - Add `originalRequest` or `batchParameters` field to batch response
   - Include all top-level batch request parameters

2. **Alternatively**: Store boolean flags separately in each combination as `fromBatchRequest`:
   ```javascript
   {
     parameters: { /* varying params */ },
     batchRequestFlags: {
       enableDynamicGrid,
       normalizeToReference,
       enableConsecutiveIncrementalBuyGrid,
       enableConsecutiveIncrementalSellProfit,
       enableScenarioDetection
     }
   }
   ```

### Frontend Changes (BatchResults.js):
1. **Force enableBetaScaling**: ALWAYS `false` (parameters already scaled)
2. **Force isManualBetaOverride**: ALWAYS `false` (not relevant)
3. **Use batch request for boolean flags**:
   - `enableDynamicGrid` from batch request, NOT from parameters
   - `normalizeToReference` from batch request, NOT from parameters
   - `enableConsecutiveIncrementalBuyGrid` from batch request, NOT from parameters
   - `enableConsecutiveIncrementalSellProfit` from batch request, NOT from parameters
   - `enableScenarioDetection` from batch request, NOT from parameters
4. **Use parameters for varying values**:
   - All range parameters (profitRequirement, gridIntervalPercent, etc.)
   - Symbol, beta, coefficient
   - dynamicGridMultiplier, gridConsecutiveIncrement (if they were in ranges)

## Test Cases

### Test Case 1: Beta Scaling Enabled
**Input**:
```
enableBetaScaling=true
enableDynamicGrid=false
coefficients=[1, 0.5]
```

**Expected**: All individual run URLs should have:
- `enableBetaScaling=false` (parameters already scaled)
- `enableDynamicGrid=false` (from batch request)
- `beta=2.595` (fetched for PLTR)
- `coefficient=1` or `coefficient=0.5` (from combination)

### Test Case 2: Beta Scaling Disabled
**Input**:
```
enableBetaScaling=false
normalizeToReference=true
enableConsecutiveIncrementalBuyGrid=false
```

**Expected**: All individual run URLs should have:
- `enableBetaScaling=false`
- `normalizeToReference=true` (from batch request)
- `enableConsecutiveIncrementalBuyGrid=false` (from batch request)
