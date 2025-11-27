# Bug #3: Portfolio vs Standalone Execution Logic Mismatch

**Date**: 2025-10-26
**Investigation Method**: G02 Deep Dive
**Priority**: 🔴 **CRITICAL**

## Summary

Even with **identical parameters**, portfolio mode and standalone mode produce **completely different backtest results** due to incorrect parameter application in portfolio mode.

## Evidence

### Test Setup

Used **EXACT SAME PARAMETERS** for both modes:

```json
{
  "symbol": "NVDA",
  "startDate": "2021-11-01",
  "endDate": "2025-10-19",
  "lotSizeUsd": 20000,
  "maxLots": 5,
  "gridIntervalPercent": 0.10615,  // Beta-scaled (10% × √2.123)
  "profitRequirement": 0.10615,
  "trailingBuyActivationPercent": 0.10615,
  "trailingBuyReboundPercent": 0.053075,
  "trailingSellActivationPercent": 0.2123,
  "trailingSellPullbackPercent": 0.10615,
  "gridConsecutiveIncrement": 0.053075,
  "momentumBasedBuy": true,
  "momentumBasedSell": true
}
```

### Results Comparison

| Metric | Portfolio Mode | Standalone Mode | Match? |
|--------|----------------|-----------------|--------|
| **Total BUYs** | 2 | 5 | ❌ NO |
| **First BUY Date** | Dec 27, 2021 | Dec 7, 2021 | ❌ NO (20 days off!) |
| **First BUY Price** | $30.89 | $32.37 | ❌ NO |
| **buyGridSize** | 0.2123 | should be 0.10615 | ❌ NO (2× value!) |
| **Total SELLs** | 1 | 4 | ❌ NO |

### Critical Finding: Wrong `buyGridSize`

**Portfolio transaction shows**:
```json
{
  "date": "2021-12-27",
  "type": "TRAILING_STOP_LIMIT_BUY",
  "price": 30.88688850402832,
  "buyGridSize": 0.21230000000000004,  // ← WRONG!
  "consecutiveBuyCount": 1
}
```

**Expected value**: `0.10615` (gridIntervalPercent)

**Actual value**: `0.2123` (which is exactly `trailingSellActivationPercent`!)

**Problem**: Portfolio is using **SELL parameter for BUY logic**!

## Root Cause Analysis

### Location

File: `/Users/kweng/AI/DCA-Backtest-Tool/backend/services/portfolioBacktestService.js:279-311`

```javascript
// Apply beta scaling if enabled (Spec 43: Centralized Beta Scaling)
if (config.betaScaling?.enabled) {
  const BetaScalingService = require('./betaScaling');
  const betaService = require('./betaService');
  const betaScalingService = new BetaScalingService(betaService);

  const coefficient = config.betaScaling.coefficient || 1.0;

  // Apply beta scaling using centralized service
  const scalingResult = await betaScalingService.applyBetaScaling(
    symbol,
    params,
    coefficient,
    { enableBetaScaling: true, coefficient }
  );

  if (scalingResult.success) {
    console.log(`📊 Beta scaling applied for ${symbol}`);
    params = { ...params, ...scalingResult.adjustedParameters };
    params._betaInfo = scalingResult.betaInfo;
  }
}
```

### Hypothesis

One or more of the following is happening:

1. **Double Beta Scaling**: Portfolio applies beta scaling, then passes already-scaled parameters to executor which may scale again
2. **Parameter Swap Bug**: `buyGridSize` is being assigned `trailingSellActivationPercent` instead of `gridIntervalPercent`
3. **Momentum Mode Conflict**: Momentum parameters override grid parameters incorrectly in portfolio mode

### Evidence of Parameter Confusion

The value `0.2123` appears in transaction data as `buyGridSize`, but `0.2123` is:
- Exactly `trailingSellActivationPercent` (0.20 × 2.123^0.5)
- Exactly 2× `gridIntervalPercent` (0.10615)

This is **NOT** a coincidence - portfolio is confusing BUY and SELL parameters.

## Impact

**Severity**: 🔴 **CRITICAL**

Users running portfolio backtests with momentum + beta scaling get:
- ❌ Wrong buy signals (20+ days off in timing)
- ❌ Wrong grid spacing (2× expected)
- ❌ Completely different results from standalone
- ❌ Unable to reproduce or verify results
- ❌ Wrong parameter values in transactions

**This affects ALL portfolio backtests with momentum + beta scaling enabled.**

## Verification Steps

### Test 1: Portfolio with NVDA Only

```bash
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "totalCapital": 500000,
    "lotSizeUsd": 20000,
    "maxLotsPerStock": 5,
    "stocks": [{"symbol": "NVDA"}],
    "defaultParams": {
      "gridIntervalPercent": 0.10,
      "momentumBasedBuy": true,
      "momentumBasedSell": true,
      ...
    },
    "enableBetaScaling": true,
    "betaScalingCoefficient": 0.5
  }'
```

**Result**: `buyGridSize: 0.2123` (WRONG!)

### Test 2: Standalone with Same Parameters

```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NVDA",
    "lotSizeUsd": 20000,
    "maxLots": 5,
    "gridIntervalPercent": 0.10615,  // Pre-scaled
    "momentumBasedBuy": true,
    "momentumBasedSell": true,
    ...
  }'
```

**Result**: First BUY on Dec 7, 2021 (CORRECT!)

## Next Steps to Identify Exact Bug

1. **Add debug logging** to `portfolioBacktestService.js` before calling executor
   - Log the exact parameters being passed to `runDCABacktest()`
   - Verify beta-scaled values are correct

2. **Check dcaExecutor.js** for momentum + beta parameter handling
   - Search for where `buyGridSize` is assigned
   - Verify it's using `gridIntervalPercent` not `trailingSellActivationPercent`

3. **Test portfolio WITHOUT beta scaling**
   - Run same test with `enableBetaScaling: false`
   - Check if `buyGridSize` is still wrong

4. **Test portfolio WITHOUT momentum**
   - Run with `momentumBasedBuy: false`
   - Check if date/price match standalone

## Success Criteria for Fix

- ✅ Portfolio first BUY date matches standalone (Dec 7, 2021)
- ✅ Portfolio `buyGridSize` = `0.10615` (not `0.2123`)
- ✅ Portfolio total BUYs = 5 (same as standalone)
- ✅ All transaction dates/prices match between modes

## Related Bugs

- **Bug #1** (Spec 49): Portfolio individual URL uses wrong parameters
- **Bug #2** (Spec 45): Momentum mode incorrectly uses `maxLots` for capital calculation
- **Bug #3** (THIS): Portfolio execution logic differs from standalone

All three bugs prevent users from verifying and reproducing portfolio backtest results.

---

**Investigation Status**: Root cause partially identified, needs code trace to find exact line causing parameter swap

**Test Scripts**:
- `/Users/kweng/AI/DCA-Backtest-Tool/backend/test_portfolio_simple.sh`
- `/Users/kweng/AI/DCA-Backtest-Tool/backend/test_portfolio_params.sh`
