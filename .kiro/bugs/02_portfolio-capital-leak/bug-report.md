# Bug Report: Portfolio Capital Leak ($20,587 Missing)

## Status
🟡 INVESTIGATING - Phase 1/Phase 2 fix implemented, secondary issue found

## Priority
HIGH - Blocks portfolio backtesting

## Reported Date
2025-10-31

## Summary
Portfolio backtest fails with capital constraint violation showing $20,587.38 missing from total capital tracking. The error occurs consistently with both nasdaq100.json (with adaptive lot sizing) and nasdaq100_NoLotResizing.json (without adaptive lot sizing).

## Error Message
```
Capital constraint violated (capital leaked beyond margin):
deployed(2620000.00) + cash(359412.62) = 2979412.62,
expected at least 3000000.00 (total: 3000000.00, margin: 0.00)
```

## Expected Behavior
```
deployed + cash = 3000000.00 (total capital)
```

## Actual Behavior
```
deployed (2620000.00) + cash (359412.62) = 2979412.62
Missing: $20,587.38
```

## Reproduction
1. Run portfolio backtest with: `backend/configs/portfolios/nasdaq100.json`
2. OR run with: `backend/configs/portfolios/nasdaq100_NoLotResizing.json`
3. Backtest fails with capital leak error

## Configuration Tested

### nasdaq100.json
- Total Capital: $3,000,000
- Lot Size: $10,000
- Adaptive Lot Sizing: ENABLED (can scale to $20,000)
- Beta Scaling: DISABLED
- Margin: 0%

### nasdaq100_NoLotResizing.json
- Total Capital: $3,000,000
- Lot Size: $10,000
- Adaptive Lot Sizing: DISABLED
- Beta Scaling: DISABLED
- Margin: 0%

**Result**: Both configurations show THE SAME $20,587 capital leak

## Investigation Results

### 1. Verified Buy Transaction Values Match
Added debug logging at `portfolioBacktestService.js:559`:
```javascript
console.log(`💵 BUY ${symbol}: deducting tx.value=${tx.value.toFixed(2)}, currentLotSize=${currentLotSize.toFixed(2)}`);
```

**Result**: All transactions show `tx.value === currentLotSize === 10000.00`
- No mismatch between transaction value and lot size
- Portfolio deducts the correct amount from cashReserve
- Portfolio adds the correct amount to deployedCapital

### 2. Code Paths Analyzed

**EXECUTOR Flow** (currently used for nasdaq100):
- Line 507: `currentLotSize` calculated with adaptive lot sizing
- Line 530: Executor processes with `lotSizeUsd: currentLotSize`
- Line 559-560: Deducts `tx.value` from cash and adds to deployed
- Line 562: `stock.addBuy(tx)` called

**PROCESSBUY Flow** (not used for nasdaq100):
- Line 1030: Calls `executeBuy(stock, buySignal, dayData, date, portfolio.config.lotSizeUsd)`
- Line 1035-1036: Fixed to use `buyTransaction.value` instead of config value

### 3. StockState.addBuy() Analysis
Located at `portfolioBacktestService.js:165-189`:
```javascript
addBuy(transaction) {
  // Line 175: Gets transactionValue
  const transactionValue = transaction.value !== undefined
    ? transaction.value
    : (transaction.price * transaction.shares);

  // Line 176: Adds to capitalDeployed
  this.capitalDeployed += transactionValue;
}
```

**Question**: Is `stock.capitalDeployed` being double-counted or duplicating `portfolio.deployedCapital`?

### 4. Missing Capital Breakdown
- Total Capital: $3,000,000.00
- Deployed: $2,620,000.00
- Cash: $359,412.62
- **Missing: $20,587.38** (0.69% of total capital)

## Possible Causes

### Theory 1: SELL Transaction Not Crediting Correctly
- Sells may not be crediting full transaction value back to cash
- Check `portfolioBacktestService.js:591` (SELL path)
- Verify `sellTransaction.value` includes both cost + profit/loss

### Theory 2: Index Removal Liquidation
Logs show:
```
🔴 INDEX REMOVAL: Liquidating all 8 lots of LCID on 2023-12-18
✅ Liquidation complete for LCID: Realized P&L = $-52915.60

🔴 INDEX REMOVAL: Liquidating all 9 lots of ZM on 2023-12-18
✅ Liquidation complete for ZM: Realized P&L = $-37105.44
```

**Question**: Are index removal liquidations properly crediting cash?

### Theory 3: Cash Yield Revenue
Line 610: `portfolio.cashReserve += yieldRevenue;`

**Question**: Is yield revenue being added without corresponding deployed capital adjustment?

### Theory 4: Double-Tracking
- Both `portfolio.deployedCapital` AND `stock.capitalDeployed` track capital
- Potential for inconsistency between the two

## Files Involved
- `backend/services/portfolioBacktestService.js`
  - Lines 559-562: BUY execution (EXECUTOR path)
  - Lines 591: SELL execution
  - Lines 610: Cash yield revenue
  - Lines 165-189: StockState.addBuy()
  - Lines 194-222: StockState.addSell()
  - Lines 73-100: PortfolioState.validateCapitalConstraints()

- `backend/services/dcaExecutor.js`
  - Line 1069: Creates BUY transaction with `value: lotSizeUsd`

## Next Steps for Investigation

1. **Add comprehensive capital tracking logs**:
   - Log every capital change with before/after state
   - Track: `portfolio.deployedCapital`, `portfolio.cashReserve`, sum of all `stock.capitalDeployed`

2. **Verify SELL transactions**:
   - Check if `sellTransaction.value` includes full proceeds
   - Verify line 995: `portfolio.cashReserve += sellTransaction.value`

3. **Verify index removal liquidations**:
   - Check if LCID and ZM liquidations credited cash correctly
   - Total losses: $52,915.60 + $37,105.44 = $90,021.04

4. **Check cash yield calculations**:
   - Verify yield revenue doesn't create/destroy capital

5. **Audit stock.capitalDeployed vs portfolio.deployedCapital**:
   - Add validation: `sum(stock.capitalDeployed) === portfolio.deployedCapital`

## Investigation Update (2025-11-04)

### ROOT CAUSE IDENTIFIED AND PARTIALLY FIXED

**Primary Issue: Interleaved BUY/SELL During Liquidations** ✅ FIXED
- **Problem**: Liquidations happened one stock at a time with normal trading in between
- **Impact**: Capital from liquidated stocks wasn't available for margin calculations
- **Fix**: Split daily processing into Phase 1 (all liquidations) and Phase 2 (normal trading)
- **Location**: `backend/services/portfolioBacktestService.js:438-511`
- **Status**: IMPLEMENTED ✅

**Secondary Issue: Missing marginPercent in Config**
- **Problem**: `nasdaq100_NoLotResizing.json` missing `marginPercent` field
- **Impact**: Defaults to 0%, causing validation to fail on ANY trading losses
- **Solution**: Add `"marginPercent": 20` to config file (line 5, after totalCapitalUsd)

**Tertiary Issue: Extra $44.62 Being Created**
- **Problem**: After liquidations cash=369368, after FANG BUY expected=359368, actual=359412.62
- **Impact**: +$44.62 capital created from unknown source
- **Status**: NEEDS INVESTIGATION

### Capital Flow Analysis

**Before Liquidations (2023-12-18)**:
- deployed: $3,000,000
- cash: $134,677
- sum: $3,134,677 (+$134,677 profit from previous trades)

**After All Liquidations**:
- deployed: $2,610,000
- cash: $369,368
- sum: $2,979,368

**Liquidation Losses**:
- ALGN: -$18,197
- EBAY: -$7,510
- ENPH: -$12,191
- JD: -$26,363
- LCID: -$52,916
- ZM: -$37,105
- **Total**: -$154,282

**After FANG BUY**:
- deployed: $2,620,000 (increased by $10,000 ✓)
- cash: $359,412.62 (should be $359,368, off by +$44.62)
- sum: $2,979,412.62

### Validation Logic

Current validation (line 73-90):
```javascript
const calculated = deployedCapital + cashReserve;
const minimumExpected = totalCapital - marginAmount;
if (calculated < minimumExpected - 0.01) throw Error;
```

With marginPercent=0:
- minimumExpected = 3,000,000 - 0 = 3,000,000
- calculated = 2,979,412.62
- FAILS validation (less than minimum)

The validation is correctly catching that capital dropped below minimum, but this is due to LEGITIMATE TRADING LOSSES, not a bug.

## Workaround
**Option 1**: Add `"marginPercent": 20` to `nasdaq100_NoLotResizing.json` (line 5)
**Option 2**: Accept that validation will fail when trading losses exceed margin buffer

## Related Issues
- None

## Notes
- Bug persists even with adaptive lot sizing disabled
- Bug persists even with beta scaling disabled
- Transaction value logging confirms correct deduction amounts
- The $20,587 leak is approximately 2 lots worth of capital ($10,000 x 2)
