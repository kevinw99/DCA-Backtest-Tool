# Spec 48: Tasks - Portfolio Momentum Parameters Fix

## Overview

Simple 2-line code fix to include momentum parameters in portfolio backtest API request payload.

**Total Estimate**: 15 minutes

---

## Task 1: Locate handleSubmit Function

**Priority**: P0
**Estimate**: 2 minutes
**File**: `frontend/src/components/PortfolioBacktestPage.js`

**Actions**:
```bash
# Search for the function and defaultParams object
grep -n "const defaultParams = {" frontend/src/components/PortfolioBacktestPage.js
```

**Expected Location**: Approximately line 200-300

**Verification**:
- Found `handleSubmit` function
- Found `defaultParams` object construction

---

## Task 2: Add Momentum Parameters to defaultParams

**Priority**: P0
**Estimate**: 5 minutes
**File**: `frontend/src/components/PortfolioBacktestPage.js`

**Changes**:

Add these two lines to the `defaultParams` object:
```javascript
momentumBasedBuy: parameters.defaultParams.momentumBasedBuy,
momentumBasedSell: parameters.defaultParams.momentumBasedSell,
```

**Placement**: After `dynamicGridMultiplier` line (or any other existing parameter)

**Before**:
```javascript
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
  // ❌ Missing momentum params
};
```

**After**:
```javascript
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
  momentumBasedBuy: parameters.defaultParams.momentumBasedBuy,      // ← ADD
  momentumBasedSell: parameters.defaultParams.momentumBasedSell,    // ← ADD
};
```

**Verification**:
```bash
# Verify the two new lines exist
grep -n "momentumBasedBuy\|momentumBasedSell" frontend/src/components/PortfolioBacktestPage.js
```

---

## Task 3: Verify Frontend Parameters Exist in State

**Priority**: P0
**Estimate**: 2 minutes
**File**: `frontend/src/components/PortfolioBacktestPage.js`

**Actions**:
```bash
# Search for state initialization
grep -n "defaultParams.*momentumBased" frontend/src/components/PortfolioBacktestPage.js
```

**Expected**: Should find these already exist from Spec 45:
```javascript
momentumBasedBuy: false,
momentumBasedSell: false,
```

**If Missing**: Add them to the state initialization (unlikely, Spec 45 should have added them)

---

## Task 4: Test with DevTools (G02 Step 2)

**Priority**: P0
**Estimate**: 3 minutes

**Actions**:

1. **Start frontend and backend**:
```bash
# Terminal 1: Backend
cd backend && npm start

# Terminal 2: Frontend
cd frontend && npm start
```

2. **Access portfolio URL with momentum enabled**:
```
http://localhost:3000/portfolio-backtest?
  stocks=TSLA,NVDA&
  momentumBasedBuy=true&
  momentumBasedSell=true&
  startDate=2024-01-01&
  endDate=2025-01-01&
  totalCapital=10000
```

3. **Open DevTools → Network → Submit backtest**

4. **Find POST request to `/api/portfolio-backtest`**

5. **Copy as curl and extract payload**:
```bash
# Check defaultParams includes momentum parameters
curl -X POST http://localhost:3001/api/portfolio-backtest ... | jq '.defaultParams'
```

**Expected Output**:
```json
{
  "defaultParams": {
    "gridIntervalPercent": 0.1,
    "profitRequirement": 0.1,
    "momentumBasedBuy": true,      // ✅ Should appear
    "momentumBasedSell": true      // ✅ Should appear
  }
}
```

**Verification**:
- ✅ `momentumBasedBuy` present in payload
- ✅ `momentumBasedSell` present in payload

---

## Task 5: Test Result Difference (G02 Steps 5-6)

**Priority**: P1
**Estimate**: 3 minutes

**Actions**:

**Test A** (Momentum enabled):
```
http://localhost:3000/portfolio-backtest?
  stocks=NVDA&
  momentumBasedBuy=true&
  momentumBasedSell=true&
  startDate=2024-01-01&
  endDate=2025-01-01&
  totalCapital=10000
```

**Test B** (Momentum disabled):
```
http://localhost:3000/portfolio-backtest?
  stocks=NVDA&
  momentumBasedBuy=false&
  momentumBasedSell=false&
  startDate=2024-01-01&
  endDate=2025-01-01&
  totalCapital=10000
```

**Expected**:
- **Different buy counts** (momentum buys on strength, non-momentum buys on weakness)
- **Different transaction patterns** in logs
- **Different P/L results**

**Verification**:
```bash
# Compare transaction logs
# Test A should show "MOMENTUM MODE" entries
# Test B should show "TRAILING BUY" entries
```

---

## Task 6: Verify Individual Stock Match (G02 Step 4)

**Priority**: P2
**Estimate**: Optional (comprehensive verification)

**Actions**:

1. **Run portfolio backtest** with single stock NVDA, momentum enabled
2. **Extract individual result URL** from portfolio results
3. **Run standalone NVDA backtest** with same parameters
4. **Compare results** (should match when no capital constraints)

**Expected**: Portfolio NVDA result == Standalone NVDA result

**If Mismatch**: Follow G02 debugging steps (capital optimization, transaction log comparison)

---

## Success Criteria

- [x] **SC-1**: `momentumBasedBuy` and `momentumBasedSell` appear in DevTools payload
- [x] **SC-2**: Enabled vs disabled produce DIFFERENT results
- [x] **SC-3**: Individual stock matches standalone (G02 verification)

---

## Rollback Plan

If fix causes issues:

```bash
# Revert the two added lines
git diff frontend/src/components/PortfolioBacktestPage.js
git checkout frontend/src/components/PortfolioBacktestPage.js
```

No backend or database changes involved, rollback is simple file revert.

---

## Notes

- **Backend already supports these parameters** (Spec 45 implemented them)
- **Frontend UI already has controls** (Spec 45 implemented them)
- **URL encoding/decoding already works** (Spec 45 implemented them)
- **Only missing piece**: Include params in `handleSubmit` → `defaultParams`

**Related Specs**:
- Spec 45: Original momentum parameter implementation
- G01: Parameter implementation guide
- G02: Portfolio backtest verification guide (used to discover this bug)
