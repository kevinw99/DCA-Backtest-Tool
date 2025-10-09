# Peak/Bottom Tracking Analysis

## Investigation Date: 2025-10-09
## File: `services/dcaBacktestService.js`

---

## Executive Summary

Peak and bottom tracking is used to trigger trailing stop orders. The current implementation updates `recentPeak` and `recentBottom` AFTER all executions (line 1433), but the SELL stop's internal peak tracker (`activeStop.highestPrice`) updates BEFORE BUY execution checks, causing execution order bugs.

---

## All Places Where Peak/Bottom Tracking is Updated

### 1. **Initial Setup** (Lines 1151-1154)
```javascript
if (recentPeak === null || recentBottom === null) {
  recentPeak = currentPrice;
  recentBottom = currentPrice;
  lastTransactionDate = dayData.date;
}
```
**When**: First day of backtest
**Purpose**: Initialize tracking

---

### 2. **Reset After BUY Execution** (Line 858)
```javascript
// In checkTrailingStopBuyExecution() after successful BUY
trailingStopBuy = null;
resetPeakBottomTracking(currentPrice, currentDate);
```
**When**: Trailing stop BUY executes successfully
**Purpose**: Reset peak/bottom to current price after adding new position
**Function**: `resetPeakBottomTracking()` sets both peak and bottom to currentPrice

---

### 3. **Reset After SELL Execution** (Line 1375)
```javascript
// After selling lots
activeStop = null;
resetPeakBottomTracking(currentPrice, dayData.date);
```
**When**: Trailing stop SELL executes successfully
**Purpose**: Reset peak/bottom to current price after selling position
**Function**: `resetPeakBottomTracking()` sets both peak and bottom to currentPrice

---

### 4. **Daily Update After All Executions** (Line 1433)
```javascript
// At end of daily loop, AFTER all execution checks
updatePeakBottomTracking(currentPrice);
```
**When**: End of each day, after all executions complete
**Purpose**: Track new peaks/bottoms for next day's activation logic
**Function**: `updatePeakBottomTracking()` updates peak if price > recentPeak, updates bottom if price < recentBottom

---

## Complete Daily Execution Sequence

Here's the **exact order** of operations in the daily loop (lines 1145-1434):

```
FOR EACH DAY:

  1. Initialize (Lines 1151-1155)
     - Set recentPeak/recentBottom if first day

  2. SELL STOP ACTIVATION (Line 1165)
     checkTrailingStopSellActivation(currentPrice, dayData.date)
     - Uses: recentBottom (from yesterday)
     - Creates: activeStop with highestPrice = currentPrice

  3. SELL STOP UPDATE (Line 1168) ⚠️ PROBLEM AREA
     updateTrailingStop(currentPrice)
     - Uses: activeStop.highestPrice (NOT recentPeak!)
     - If currentPrice > activeStop.highestPrice:
       - Updates activeStop.highestPrice = currentPrice
       - Updates activeStop.stopPrice
       - Updates activeStop.limitPrice

  4. SELL STOP CANCELLATION CHECK (Line 1171)
     cancelTrailingStopIfUnprofitable(currentPrice)
     - Checks if still profitable

  5. SELL EXECUTION CHECK (Lines 1174-1387)
     if (activeStop && currentPrice <= activeStop.stopPrice)
     - Executes SELL if conditions met
     - Calls resetPeakBottomTracking() if executed

  6. BUY CANCELLATION CHECK (Line 1391)
     cancelTrailingStopBuyIfAbovePeak(currentPrice)
     - For LIMIT orders: cancels if currentPrice > trailingStopBuy.recentPeakReference
     - For MARKET orders: never cancels (returns false)

  7. BUY EXECUTION CHECK (Line 1396)
     checkTrailingStopBuyExecution(currentPrice, dayData.date)
     - For LIMIT orders: only executes if currentPrice <= trailingStopBuy.recentPeakReference
     - For MARKET orders: executes if currentPrice >= stopPrice (no peak check)
     - Calls resetPeakBottomTracking() if executed

  8. BUY ACTIVATION (Line 1402)
     checkTrailingStopBuyActivation(currentPrice, dayData.date)
     - Uses: recentPeak (from yesterday or last execution)
     - Creates: trailingStopBuy with recentPeakReference = recentPeak

  9. BUY STOP UPDATE (Line 1406)
     updateTrailingStopBuy(currentPrice)
     - Updates trailingStopBuy.stopPrice if price drops further

  10. PEAK/BOTTOM DAILY UPDATE (Line 1433) ✅ CORRECT PLACEMENT
      updatePeakBottomTracking(currentPrice)
      - Updates recentPeak if currentPrice > recentPeak
      - Updates recentBottom if currentPrice < recentBottom
```

---

## Dependency Analysis

### What Each Action Depends On:

| Action | Depends On | Factor Type |
|--------|-----------|-------------|
| **SELL Activation** | `recentBottom` | Yesterday's bottom |
| **SELL Update** | `activeStop.highestPrice` | SELL stop's internal peak (⚠️ updates with current price) |
| **SELL Execution** | `activeStop.stopPrice` | Updated stop price |
| **BUY Cancellation (LIMIT)** | `trailingStopBuy.recentPeakReference` | Peak when BUY was activated |
| **BUY Cancellation (MARKET)** | N/A | Never cancels |
| **BUY Execution (LIMIT)** | `trailingStopBuy.recentPeakReference` | Peak when BUY was activated |
| **BUY Execution (MARKET)** | `trailingStopBuy.stopPrice` only | No peak check |
| **BUY Activation** | `recentPeak` | Yesterday's peak or last execution |
| **BUY Update** | `trailingStopBuy.stopPrice` | Current stop price |

---

## Critical Finding: Two Separate Peak Trackers

### 1. **Global Peak/Bottom Tracking** (`recentPeak`, `recentBottom`)
- **Purpose**: Trigger BUY activation (price drops from peak)
- **Updated**: End of each day (line 1433)
- **Reset**: After BUY/SELL executions
- **Used by**:
  - `checkTrailingStopBuyActivation()` - checks if price dropped from `recentPeak`
  - `checkTrailingStopSellActivation()` - checks if price rose from `recentBottom`

### 2. **SELL Stop Internal Peak** (`activeStop.highestPrice`)
- **Purpose**: Trail the stop price as price rises
- **Updated**: DURING the day when price rises (line 1054, within `updateTrailingStop()`)
- **Reset**: Never (only cleared when stop executes or is cancelled)
- **Used by**:
  - `updateTrailingStop()` - updates stop price based on new high

---

## The Root Cause of the Bug

### Problem Scenario (2024-08-08):

```
Day: 2024-08-05
  Price: 24.09
  recentPeak: (some value from earlier, let's say 28.67)
  BUY stop: 28.91
  Actions:
    - updateTrailingStopBuy: BUY stop updated to 28.91

Day: 2024-08-08
  Price: 29.28
  recentPeak: (still 28.67 from yesterday)
  BUY stop: 28.91 (active)
  SELL stop: active with highestPrice = 28.81

  Execution Order:
    1. checkTrailingStopSellActivation: no action
    2. updateTrailingStop:  ⚠️ PROBLEM!
       - currentPrice (29.28) > activeStop.highestPrice (28.81)
       - Updates activeStop.highestPrice = 29.28
       - Updates activeStop.stopPrice to 23.42
       - **Peak effectively updated BEFORE BUY check!**
    3. cancelTrailingStopBuyIfAbovePeak:
       - For MARKET orders: returns false (no cancellation)
    4. checkTrailingStopBuyExecution: ⚠️ SHOULD EXECUTE!
       - currentPrice (29.28) >= trailingStopBuy.stopPrice (28.91) ✓
       - For MARKET orders: withinLimit = true ✓
       - **Should execute but something prevents it!**

    Issue: The BUY stop should execute at 29.28, but the SELL stop
           gets updated first, suggesting priority is wrong.
```

---

## Market Orders vs Limit Orders

### **LIMIT Orders**:
- **BUY Cancellation**: Cancels if `currentPrice > trailingStopBuy.recentPeakReference`
- **BUY Execution**: Only if `currentPrice <= trailingStopBuy.recentPeakReference`
- **SELL Execution**: Only if `currentPrice > limitPrice`
- **Peak Dependency**: HIGH - peak determines whether order can execute

### **MARKET Orders**:
- **BUY Cancellation**: NEVER (line 643-645)
- **BUY Execution**: If `currentPrice >= stopPrice` (no peak check, line 668)
- **SELL Execution**: Peak doesn't matter, executes at stop
- **Peak Dependency**: LOW - peak only used for initial activation

---

## CRITICAL CORRECTION: BUY Update Only Happens in ELSE Block!

### Code at Lines 1396-1407:
```javascript
const trailingStopBuyExecuted = checkTrailingStopBuyExecution(currentPrice, dayData.date);
if (trailingStopBuyExecuted) {
  actionsOccurred = true;
} else {  // ⚠️ ONLY if BUY did NOT execute!
  if (!trailingStopBuy) {
    checkTrailingStopBuyActivation(currentPrice, dayData.date);
  }
  updateTrailingStopBuy(currentPrice);  // Only runs if BUY didn't execute
}
```

**This means**:
- If BUY executes → No update happens (stop is cleared)
- If BUY doesn't execute → Then update or activate happens

**So step #9 (BUY UPDATE) only happens if step #7 (BUY EXECUTION) returns false!**

---

## The Mystery: Why Didn't BUY Execute on 2024-08-08?

### Evidence from Transaction Log:

```
2024-07-16: BUY ACTIVATED at stop 34.40 (peak reference: 28.67)
2024-08-02: BUY UPDATED to 31.30
2024-08-05: BUY UPDATED to 28.91 (price: 24.09)
2024-08-08: Price 29.28 → NO BUY EXECUTION! BUY stop silently disappeared!
2024-08-08: Only SELL UPDATED logged
2024-08-12: NEW BUY ACTIVATED at stop 35.26
```

### Analysis:

On 2024-08-08:
- `currentPrice`: 29.28
- `trailingStopBuy.stopPrice`: 28.91
- `trailingStopBuy.recentPeakReference`: 28.67 (from July 16 activation)
- Order type: MARKET

**Execution Check (Line 666):**
```javascript
if (trailingStopBuy && currentPrice >= trailingStopBuy.stopPrice)
```
- 29.28 >= 28.91 ✓ TRUE
- Should enter the block!

**Limit Check (Line 668):**
```javascript
const withinLimit = trailingStopOrderType === 'market' || currentPrice <= trailingStopBuy.recentPeakReference;
```
- For MARKET: withinLimit = true ✓
- Should execute!

**But no execution logged! Why?**

### Possible Causes:

1. **`trailingStopBuy` was null on Aug 8?**
   - But how? No cancellation logged between Aug 5 and Aug 8
   - Aug 6-7 were non-trading days (weekend)

2. **Grid spacing violation?**
   - Current holdings: [21.87]
   - New buy price: 29.28
   - Spacing: (29.28 - 21.87) / 21.87 = 33.9%
   - Grid requirement: 10%
   - ✓ Meets spacing requirement!

3. **Max lots reached?**
   - Current lots: 1
   - Max lots: 10
   - ✓ Not at max!

4. **Hidden condition?**
   - Need to add debug logging to find out!

---

## Investigation Question

**Should peak/bottom update (line 1433) be moved to the LAST step for MARKET orders?**

### Current Placement (Line 1433):
✅ **Correct** - Already at the end, after all executions

### The Real Issue:
⚠️ **NOT the global peak update** - that's already correct
⚠️ **MYSTERY**: Why doesn't BUY execute when all conditions appear to be met?

---

## Proposed Investigation Areas

1. **Add comprehensive debug logging to checkTrailingStopBuyExecution()**
   - Log when function is called
   - Log all condition checks
   - Log trailingStopBuy state
   - Log why execution doesn't happen

2. **Check if trailingStopBuy is being cleared somewhere unexpected**
   - Search for all places that set trailingStopBuy = null
   - Check if there's a path that clears it silently

3. **Consider reordering execution priority**
   - Move BUY execution check BEFORE SELL updates
   - Current: SELL activation → SELL update → BUY execution
   - Proposed: BUY execution → SELL activation → SELL update

---

## Next Steps

1. Add debug logging to trace the exact state on 2024-08-08 ✅ DONE
2. Run test again to see detailed execution path ✅ DONE
3. Identify why BUY execution check doesn't log anything ✅ DONE
4. Fix the root cause once identified → IN PROGRESS

---

## 🎯 ROOT CAUSE IDENTIFIED - 2025-10-09

### The Smoking Gun Evidence:

**2024-08-08 Debug Output:**
```
🔍 [2024-08-08] BEFORE checkTrailingStopBuyExecution: BuyStop=28.91, currentPrice=29.28
    🔍 checkTrailingStopBuyExecution ENTRY: trailingStopBuy=EXISTS, price=29.28
    🔍 checkTrailingStopBuyExecution: stopPrice=28.91, recentPeakRef=28.67
    🔍 checkTrailingStopBuyExecution: Stop triggered! 29.28 >= 28.91
    🔍 checkTrailingStopBuyExecution: orderType=market, withinLimit=true
🔍 [2024-08-08] AFTER checkTrailingStopBuyExecution: executed=false, BuyStop=NULL
```

**What Happened:**
1. BUY stop enters `checkTrailingStopBuyExecution()` with all conditions met ✓
2. Stop price check passes: 29.28 >= 28.91 ✓
3. Limit check passes: orderType=market, withinLimit=true ✓
4. BUT then the function returns false and clears `trailingStopBuy` to NULL!

### The Bug:

**File**: `services/dcaBacktestService.js`
**Lines**: 743-780

```javascript
// PRICE RESTRICTION CHECK:
// If lastBuyPrice exists, only allow buys at prices LOWER than last buy
// This applies regardless of consecutiveBuyCount value (even when count = 0)
// This prevents buying on uptrends during consecutive buy sequences
if (lastBuyPrice !== null && currentPrice >= lastBuyPrice) {
  if (verbose) {
    const countMsg = consecutiveBuyCount > 0 ? `count: ${consecutiveBuyCount}` : `count: 0`;
    transactionLog.push(colorize(`  BLOCKED: Buy prevented - Price ${currentPrice.toFixed(2)} >= last buy ${lastBuyPrice.toFixed(2)} (${countMsg})`, 'yellow'));
  }

  // ... aborted buy tracking ...

  // Cancel the trailing stop buy since we can't execute it
  if (verbose) {
    transactionLog.push(colorize(`  🔍 DEBUG: Clearing trailingStopBuy due to grid spacing/consecutive buy failure`, 'cyan'));
  }
  trailingStopBuy = null;  // ← BUG: Clears the stop!
  return false;
}
```

**Why This is Wrong:**

1. **The check is ALWAYS active** even when `enableConsecutiveIncrementalBuyGrid=false`
2. Comment says: "This applies regardless of consecutiveBuyCount value (even when count = 0)"
3. On Aug 8:
   - `lastBuyPrice` = 21.87 (from initial buy on Jan 3)
   - `currentPrice` = 29.28
   - 29.28 >= 21.87 → TRUE → BUY BLOCKED!
4. The trailing stop at 28.91 should execute at 29.28, but gets blocked by this check
5. **The log message is wrapped in `if (verbose)` so it doesn't show in production mode!**

### The Fix:

**Option 1**: Only apply this check when `enableConsecutiveIncrementalBuyGrid=true`
```javascript
if (enableConsecutiveIncrementalBuyGrid && lastBuyPrice !== null && currentPrice >= lastBuyPrice) {
```

**Option 2**: Don't cancel trailing stops due to this check - let them persist
```javascript
// Don't clear trailingStopBuy - let it persist for future opportunities
// trailingStopBuy = null;  // REMOVED
```

**Option 3**: Make the log message unconditional so users know why it's blocked
```javascript
// Remove if (verbose) wrapper
transactionLog.push(colorize(`  BLOCKED: Buy prevented - Price ${currentPrice.toFixed(2)} >= last buy ${lastBuyPrice.toFixed(2)} (${countMsg})`, 'yellow'));
```

**Recommended Fix**: **Option 1** - Only apply the price restriction check when the consecutive incremental buy grid feature is enabled. This prevents blocking normal trailing stop buys.
