# Spec 48: Design - Portfolio Momentum Parameters Fix

## Overview

Simple 2-line code fix to include momentum parameters in portfolio backtest API request payload.

## Root Cause Analysis

### Data Flow (Current - Broken)

```
┌──────────────────────────────────────┐
│ 1. User sets momentum parameters     │
│    momentumBasedBuy: true            │
│    momentumBasedSell: true           │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 2. Parameters stored in React state  │
│    parameters.momentumBasedBuy ✅    │
│    parameters.momentumBasedSell ✅   │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 3. URL encoding includes params ✅   │
│    ?momentumBasedBuy=true&...        │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 4. handleSubmit builds API payload   │
│    ❌ DOES NOT include params!      │
│                                      │
│    defaultParams: {                  │
│      gridIntervalPercent,            │
│      profitRequirement,              │
│      // Missing momentum params!     │
│    }                                 │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 5. Backend receives incomplete data  │
│    momentum parameters: undefined    │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 6. Executor uses defaults             │
│    momentumBasedBuy = false (default)│
│    Feature silently disabled         │
└───────────────────────────────────────┘
```

### Fixed Data Flow

```
┌──────────────────────────────────────┐
│ 4. handleSubmit builds API payload   │
│    ✅ INCLUDES params                │
│                                      │
│    defaultParams: {                  │
│      gridIntervalPercent,            │
│      profitRequirement,              │
│      momentumBasedBuy,     ← ADD     │
│      momentumBasedSell,    ← ADD     │
│    }                                 │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 5. Backend receives complete data ✅ │
│    momentum parameters: true         │
└──────────┬───────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 6. Executor uses correct values ✅   │
│    momentumBasedBuy = true (from req)│
│    Feature works as expected         │
└───────────────────────────────────────┘
```

## Implementation

### File: `frontend/src/components/PortfolioBacktestPage.js`

**Function**: `handleSubmit`

**Location**: Approximately line 200-300 (search for "const defaultParams = {")

### Before (Broken)

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();

  // ... validation logic ...

  const defaultParams = {
    gridIntervalPercent: parameters.defaultParams.gridIntervalPercent,
    profitRequirement: parameters.defaultParams.profitRequirement,
    stopLossPercent: parameters.defaultParams.stopLossPercent,
    trailingBuyActivationPercent: parameters.defaultParams.trailingBuyActivationPercent,
    trailingBuyReboundPercent: parameters.defaultParams.trailingBuyReboundPercent,
    trailingSellActivationPercent: parameters.defaultParams.trailingSellActivationPercent,
    trailingSellPullbackPercent: parameters.defaultParams.trailingSellPullbackPercent,
    enableConsecutiveIncrementalBuyGrid: parameters.defaultParams.enableConsecutiveIncrementalBuyGrid,
    gridConsecutiveIncrement: parameters.defaultParams.gridConsecutiveIncrement,
    enableConsecutiveIncrementalSellProfit: parameters.defaultParams.enableConsecutiveIncrementalSellProfit,
    enableDynamicGrid: parameters.defaultParams.enableDynamicGrid,
    normalizeToReference: parameters.defaultParams.normalizeToReference,
    dynamicGridMultiplier: parameters.defaultParams.dynamicGridMultiplier,
    // ❌ MISSING: momentumBasedBuy
    // ❌ MISSING: momentumBasedSell
  };

  const requestBody = {
    totalCapital: parameters.totalCapital,
    startDate: parameters.startDate,
    endDate: parameters.endDate,
    defaultParams,  // ← Sent to backend without momentum params
    ...
  };

  // ... API call ...
};
```

### After (Fixed)

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();

  // ... validation logic ...

  const defaultParams = {
    gridIntervalPercent: parameters.defaultParams.gridIntervalPercent,
    profitRequirement: parameters.defaultParams.profitRequirement,
    stopLossPercent: parameters.defaultParams.stopLossPercent,
    trailingBuyActivationPercent: parameters.defaultParams.trailingBuyActivationPercent,
    trailingBuyReboundPercent: parameters.defaultParams.trailingBuyReboundPercent,
    trailingSellActivationPercent: parameters.defaultParams.trailingSellActivationPercent,
    trailingSellPullbackPercent: parameters.defaultParams.trailingSellPullbackPercent,
    enableConsecutiveIncrementalBuyGrid: parameters.defaultParams.enableConsecutiveIncrementalBuyGrid,
    gridConsecutiveIncrement: parameters.defaultParams.gridConsecutiveIncrement,
    enableConsecutiveIncrementalSellProfit: parameters.defaultParams.enableConsecutiveIncrementalSellProfit,
    enableDynamicGrid: parameters.defaultParams.enableDynamicGrid,
    normalizeToReference: parameters.defaultParams.normalizeToReference,
    dynamicGridMultiplier: parameters.defaultParams.dynamicGridMultiplier,
    momentumBasedBuy: parameters.defaultParams.momentumBasedBuy,      // ← ADD THIS LINE
    momentumBasedSell: parameters.defaultParams.momentumBasedSell,    // ← ADD THIS LINE
  };

  const requestBody = {
    totalCapital: parameters.totalCapital,
    startDate: parameters.startDate,
    endDate: parameters.endDate,
    defaultParams,  // ← Now includes momentum params
    ...
  };

  // ... API call ...
};
```

## Verification Steps (Following G02)

### Step 1: Verify State Contains Parameters

```bash
# In browser console after fix:
console.log(parameters.defaultParams.momentumBasedBuy);
# Expected: true or false (not undefined)
```

### Step 2: Verify DevTools Shows Parameters

```bash
# DevTools → Network → portfolio-backtest POST request → Payload:
{
  "defaultParams": {
    "momentumBasedBuy": true,   # ✅ Should appear
    "momentumBasedSell": true   # ✅ Should appear
  }
}
```

### Step 3: Verify Backend Receives Parameters

```bash
# Backend logs (if debug logging enabled):
grep "momentumBasedBuy" /tmp/server_debug.log
# Expected: Should show parameter value
```

### Step 4: Verify Different Results

```bash
# Test A: Momentum enabled
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -d '{"defaultParams": {"momentumBasedBuy": true}}' \
  | jq '.data.stockResults[0].transactionLog[]' \
  | grep "MOMENTUM"

# Test B: Momentum disabled
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -d '{"defaultParams": {"momentumBasedBuy": false}}' \
  | jq '.data.stockResults[0].transactionLog[]' \
  | grep "TRAILING"

# ✅ Different transaction patterns
```

## Edge Cases

### EC-1: Parameter is undefined

If `parameters.defaultParams.momentumBasedBuy` is undefined:
- Default to `false` (backend will handle via defaults)
- No error should occur

### EC-2: Beta Scaling Interaction

Beta scaling should still apply to momentum parameters:
```javascript
// In portfolio results, individual stock may show:
momentumBasedBuy: true  // From defaultParams (not beta-scaled, boolean stays same)
```

### EC-3: Stock-Specific Overrides

If stock has specific momentum override:
```javascript
stocks: [{
  symbol: "NVDA",
  params: {
    momentumBasedBuy: false  // Override for this stock only
  }
}]
```

This should work correctly (override takes precedence).

## Testing Plan

### Test 1: Parameter Presence

1. Set momentum parameters in UI
2. Submit portfolio backtest
3. Check DevTools payload
4. **Pass**: `defaultParams.momentumBasedBuy` and `momentumBasedSell` present

### Test 2: Result Difference

1. Run with `momentumBasedBuy=true`
2. Run with `momentumBasedBuy=false`
3. Compare transaction logs
4. **Pass**: Different buy patterns (strength vs weakness)

### Test 3: Individual Stock Match

1. Run portfolio backtest with NVDA
2. Get NVDA individual result URL
3. Run standalone NVDA with same params
4. **Pass**: Results match (following G02 Step 4)

## Rollback Plan

If fix causes issues:
```javascript
// Remove the two added lines
// Return to previous state (parameters missing from payload)
// Feature will revert to broken state (using defaults)
```

No database or backend changes involved, so rollback is simple file revert.

## Impact

**User-Facing**: Portfolio backtest with momentum parameters will finally work as expected

**Developer-Facing**: Demonstrates importance of G02 verification process (caught this bug!)

**Related**: Any future parameters added must also be included in `handleSubmit` → `defaultParams`
