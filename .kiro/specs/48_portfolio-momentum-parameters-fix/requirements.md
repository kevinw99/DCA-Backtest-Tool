# Spec 48: Portfolio Momentum Parameters Bug Fix

## Problem Statement

**Bug Discovered via G02 Verification Process**:

When running portfolio backtest with momentum parameters:
- Frontend URL shows: `momentumBasedBuy=true&momentumBasedSell=true`
- Backend curl payload (from DevTools) shows: MISSING these parameters
- Result: Identical backtest results regardless of momentum parameter values

**Evidence** (following G02 Step 2):
```bash
# DevTools → Network → Copy as curl shows:
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -d '{
    "defaultParams": {
      "gridIntervalPercent": 0.1,
      "profitRequirement": 0.1,
      // ❌ MISSING: momentumBasedBuy
      // ❌ MISSING: momentumBasedSell
    }
  }'
```

**Expected Behavior**:
- Momentum enabled → Buys on price strength (uptrends)
- Momentum disabled → Buys on price weakness (downtrends)
- Results should be DIFFERENT

**Actual Behavior**:
- Both produce IDENTICAL results
- Backend never receives momentum parameters
- Feature silently fails

## Root Cause

**Location**: `frontend/src/components/PortfolioBacktestPage.js`

**Function**: `handleSubmit` (approximately line ~200-300)

**Issue**: When building API request payload, momentum parameters are not included in the `defaultParams` object sent to backend.

**Comparison with Working Implementation**:
- ✅ Single backtest (`DCABacktestForm.js`) → Uses `URLParameterManager` (automatic)
- ❌ Portfolio backtest (`PortfolioBacktestPage.js`) → Manual URL handling (missing params)

## Requirements

### REQ-1: Include Momentum Parameters in Portfolio API Request

Add `momentumBasedBuy` and `momentumBasedSell` to the `defaultParams` object in `handleSubmit` function.

**Before**:
```javascript
const defaultParams = {
  gridIntervalPercent,
  profitRequirement,
  // ... other params ...
  // ❌ Missing momentum params
};
```

**After**:
```javascript
const defaultParams = {
  gridIntervalPercent,
  profitRequirement,
  // ... other params ...
  momentumBasedBuy,      // ← ADD
  momentumBasedSell,     // ← ADD
};
```

### REQ-2: Verify Parameters Exist in State

Ensure `parameters` object includes these fields (should already exist from Spec 45, but verify):
```javascript
const [parameters, setParameters] = useState({
  // ...
  momentumBasedBuy: false,
  momentumBasedSell: false,
  // ...
});
```

### REQ-3: Verify URL Encoding/Decoding

Confirm URL parameter handling exists (should already exist from Spec 45):
- URL encoding (~line 200)
- URL decoding (~line 125)

## Verification Plan (Using G02)

### Step 1: Before Fix - Capture Bug

```bash
# Access portfolio URL with momentum enabled
http://localhost:3000/portfolio-backtest?
  stocks=TSLA,NVDA&
  momentumBasedBuy=true&
  momentumBasedSell=true&
  ...

# Extract curl from DevTools
# Confirm: defaultParams MISSING momentum parameters
```

### Step 2: Apply Fix

Add parameters to `handleSubmit` → `defaultParams`

### Step 3: After Fix - Verify

```bash
# Access same URL again
# Extract curl from DevTools
# Confirm: defaultParams INCLUDES momentum parameters

curl ... | jq '.defaultParams.momentumBasedBuy'
# Expected: true

curl ... | jq '.defaultParams.momentumBasedSell'
# Expected: true
```

### Step 4: Result Validation (G02 Steps 5-7)

Compare enabled vs disabled:

**Test A** (Momentum enabled):
```
momentumBasedBuy=true
→ Expected: Buys on uptrends, P/L gating
→ Verify: Transaction logs show "MOMENTUM MODE"
```

**Test B** (Momentum disabled):
```
momentumBasedBuy=false
→ Expected: Buys on downtrends, trailing stops
→ Verify: Transaction logs show "TRAILING BUY"
```

**Results should DIFFER**: Different buy counts, different timing, different P/L.

## Success Criteria

### SC-1: Backend Receives Parameters
```bash
# DevTools curl payload includes:
"defaultParams": {
  "momentumBasedBuy": true,
  "momentumBasedSell": true
}
```

### SC-2: Different Results for Different Values

```bash
# Momentum enabled
Total Buys: 12
Buy on strength: Yes
P/L: +85%

# Momentum disabled
Total Buys: 8
Buy on weakness: Yes
P/L: +42%

# ✅ DIFFERENT (feature working)
```

### SC-3: Individual Stock Matches Standalone (G02 Step 4)

When no capital constraints:
```bash
Portfolio NVDA result == Standalone NVDA result (with same parameters)
```

## Non-Requirements

- No backend changes needed (backend already supports parameters from Spec 45)
- No new UI controls needed (already exist from Spec 45)
- No URL parameter changes needed (already implemented in Spec 45)

**Only fix**: Add 2 lines to `PortfolioBacktestPage.js` → `handleSubmit` → `defaultParams`

## Related Specs

- **Spec 45**: Original momentum parameter implementation
- **G01**: Parameter implementation guide
- **G02**: Portfolio backtest verification guide (used to discover this bug)
