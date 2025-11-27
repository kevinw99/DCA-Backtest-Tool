# Implementation Tasks: Momentum-Based Trading Mode

## Overview

This document breaks down the implementation of momentum-based trading mode into concrete, testable tasks following the migration phases defined in design.md.

## Phase 1: Core Infrastructure (Low Risk, ~3 hours)

### Task 1.1: Add Parameter Definitions

**File:** `/backend/config/backtestDefaults.json`

**Steps:**
1. Add `momentumBasedBuy` parameter
2. Add `momentumBasedSell` parameter

**Implementation:**
```json
{
  "momentumBasedBuy": false,
  "momentumBasedSell": false,

  // Existing parameters (unchanged)
  "trailingBuyActivationPercent": 0.1,
  "trailingBuyReboundPercent": 0.05,
  "trailingSellActivationPercent": 0.2,
  "trailingSellPullbackPercent": 0.1
}
```

**Acceptance Criteria:**
- ✓ Parameters added to defaults file
- ✓ Default values = false (backward compatible)
- ✓ Server loads without errors

**Verification:**
```bash
# Start server
cd backend && npm start

# Check logs for successful config load
tail -f logs/app.log | grep "Config loaded"
```

---

### Task 1.2: Create P/L Calculation Function

**File:** `/backend/services/dcaExecutor.js`

**Steps:**
1. Add `calculatePositionPnL` function at top of file (after imports)
2. Add JSDoc documentation
3. Handle empty position edge case

**Implementation:**
```javascript
/**
 * Calculate total unrealized P/L for current position
 *
 * @param {Array} lots - Current position lots [{price, shares, date}]
 * @param {number} currentPrice - Current market price
 * @returns {number} Total unrealized P/L in USD
 */
function calculatePositionPnL(lots, currentPrice) {
  if (!lots || lots.length === 0) {
    return 0;
  }

  return lots.reduce((totalPnL, lot) => {
    const pnl = (currentPrice - lot.price) * lot.shares;
    return totalPnL + pnl;
  }, 0);
}
```

**Acceptance Criteria:**
- ✓ Function handles empty lots array
- ✓ Function calculates correct P/L for single lot
- ✓ Function calculates correct net P/L for multiple lots
- ✓ JSDoc documentation complete

**Verification:**
```javascript
// Test in Node REPL
const { calculatePositionPnL } = require('./backend/services/dcaExecutor');

// Test 1: Empty position
console.log(calculatePositionPnL([], 100));  // Expected: 0

// Test 2: Single lot profit
const lots1 = [{price: 100, shares: 10}];
console.log(calculatePositionPnL(lots1, 110));  // Expected: 100

// Test 3: Multiple lots mixed P/L
const lots2 = [
  {price: 100, shares: 10},  // +100 profit
  {price: 120, shares: 10}   // -100 loss
];
console.log(calculatePositionPnL(lots2, 110));  // Expected: 0
```

---

### Task 1.3: Enhance State Tracking

**File:** `/backend/services/dcaExecutor.js`

**Steps:**
1. Find state initialization (search for `const state = {`)
2. Add new tracking fields
3. Update state documentation

**Implementation:**
```javascript
// In initializeState() or similar function
const state = {
  // Existing fields
  lots: [],
  trailingStopBuy: null,
  activeStop: null,
  recentPeak: null,
  recentBottom: null,
  referencePrice: null,
  averageCost: null,
  consecutiveBuyCount: 0,
  consecutiveSellCount: 0,
  transactionLog: [],

  // NEW: Momentum mode tracking
  positionPnL: 0,                    // Current unrealized P/L
  maxLotsReached: 0,                 // Max lots held simultaneously
  buyBlockedByPnL: 0,                // Count of buys blocked by P/L <= 0
  dailyPnL: []                       // Track P/L history
};
```

**Acceptance Criteria:**
- ✓ New fields added to state object
- ✓ Fields initialized with correct default values
- ✓ No breaking changes to existing state usage

**Verification:**
```bash
# Run existing tests - should pass unchanged
cd backend
npm test -- --grep "DCA Executor"
```

---

### Task 1.4: Add Daily P/L Calculation

**File:** `/backend/services/dcaExecutor.js`

**Steps:**
1. Find `processOneDayOfTrading` function
2. Add P/L calculation at start of function
3. Store in state for use by buy/sell checks

**Implementation:**
```javascript
// In processOneDayOfTrading() - near the beginning
function processOneDayOfTrading(state, priceData, params, dayIndex) {
  const { date, close: currentPrice } = priceData;

  // Calculate current position P/L
  state.positionPnL = calculatePositionPnL(state.lots, currentPrice);
  state.dailyPnL.push({ date, pnl: state.positionPnL });

  // Track max lots
  if (state.lots.length > state.maxLotsReached) {
    state.maxLotsReached = state.lots.length;
  }

  // ... rest of daily processing ...
}
```

**Acceptance Criteria:**
- ✓ P/L calculated once per day
- ✓ Stored in state.positionPnL
- ✓ Max lots tracked
- ✓ Daily P/L history maintained

**Verification:**
```bash
# Run simple backtest and check state
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "lotSizeUsd": 1000,
    "maxLots": 5
  }' | jq '.data.maxLotsReached'
```

---

## Phase 2: Momentum Buy Implementation (Medium Risk, ~4 hours)

### Task 2.1: Modify Buy Activation Check

**File:** `/backend/services/dcaExecutor.js`

**Steps:**
1. Find `checkTrailingStopBuyActivation` function (around line 539)
2. Add momentum mode logic for activation threshold
3. Update activation condition
4. Add momentum mode logging

**Implementation:**
```javascript
function checkTrailingStopBuyActivation(state, currentPrice, currentDate, params) {
  const { trailingStopBuy, recentPeak, recentBottom, lots, transactionLog } = state;

  // Skip if already have active buy order
  if (trailingStopBuy) {
    return;
  }

  // Determine effective activation threshold
  let effectiveActivation;
  if (params.momentumBasedBuy) {
    effectiveActivation = 0;  // MOMENTUM: Immediate activation
  } else {
    // TRADITIONAL: Use configured or adaptive value
    effectiveActivation = params.trailingBuyActivationPercent;
    // ... existing adaptive logic ...
  }

  // Need reference point for activation
  if (!recentBottom && !recentPeak) {
    return;  // No tracking yet
  }

  // MOMENTUM MODE: Activate immediately when any bottom exists
  if (params.momentumBasedBuy) {
    if (recentBottom) {
      // Calculate stop price
      const effectiveRebound = params.trailingBuyReboundPercent;
      const stopPrice = currentPrice * (1 + effectiveRebound);

      state.trailingStopBuy = {
        stopPrice,
        recentPeakReference: recentPeak || currentPrice,
        triggeredAt: currentPrice,
        activatedDate: currentDate,
        lastUpdatePrice: currentPrice
      };

      transactionLog.push(
        `MOMENTUM BUY ACTIVATED: Stop @ ${stopPrice.toFixed(2)} (rebound ${(effectiveRebound * 100).toFixed(1)}%)`
      );
      return;
    }
  }

  // TRADITIONAL MODE: Check if dropped enough from peak
  if (!params.momentumBasedBuy && recentPeak) {
    if (currentPrice <= recentPeak * (1 - effectiveActivation)) {
      // Existing activation logic...
      const effectiveRebound = params.trailingBuyReboundPercent;
      const stopPrice = currentPrice * (1 + effectiveRebound);

      state.trailingStopBuy = {
        stopPrice,
        recentPeakReference: recentPeak,
        triggeredAt: currentPrice,
        activatedDate: currentDate,
        lastUpdatePrice: currentPrice
      };

      transactionLog.push(
        `TRADITIONAL BUY ACTIVATED: Stop @ ${stopPrice.toFixed(2)}`
      );
    }
  }
}
```

**Acceptance Criteria:**
- ✓ Momentum mode sets activation to 0%
- ✓ Traditional mode uses configured activation
- ✓ Logs indicate mode type
- ✓ Existing tests still pass

**Verification:**
```bash
# Test 1: Traditional mode (should wait for 10% drop)
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2024-01-01",
    "endDate": "2024-03-31",
    "momentumBasedBuy": false,
    "trailingBuyActivationPercent": 0.1
  }' | jq '.data.transactionLog | .[] | select(contains("ACTIVATED"))'

# Test 2: Momentum mode (should activate immediately)
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2024-01-01",
    "endDate": "2024-03-31",
    "momentumBasedBuy": true
  }' | jq '.data.transactionLog | .[] | select(contains("MOMENTUM"))'
```

---

### Task 2.2: Add P/L Gating to Buy Execution

**File:** `/backend/services/dcaExecutor.js`

**Steps:**
1. Find `checkTrailingStopBuyExecution` function (around line 610)
2. Add P/L check after price checks but before other validations
3. Add exception for first buy (no position yet)
4. Add detailed logging

**Implementation:**
```javascript
function checkTrailingStopBuyExecution(state, currentPrice, currentDate, params) {
  const { trailingStopBuy, lots, transactionLog, positionPnL } = state;

  if (!trailingStopBuy) {
    return false;
  }

  // Check if price reached stop price
  if (currentPrice < trailingStopBuy.stopPrice) {
    return false;  // Not triggered yet
  }

  // Check if buying is enabled (portfolio level)
  if (!params.buyEnabled) {
    transactionLog.push(`BUY BLOCKED: Buying disabled by portfolio`);
    return false;
  }

  // LIMIT order check (if applicable)
  if (params.trailingStopOrderType === 'limit') {
    if (currentPrice > trailingStopBuy.recentPeakReference) {
      transactionLog.push(`BUY CANCELLED: Price ${currentPrice.toFixed(2)} > limit ${trailingStopBuy.recentPeakReference.toFixed(2)}`);
      state.trailingStopBuy = null;
      return false;
    }
  }

  // MOMENTUM MODE: Check position P/L
  if (params.momentumBasedBuy) {
    // Exception: First buy always allowed (no position to evaluate)
    if (lots.length > 0) {
      if (positionPnL <= 0) {
        transactionLog.push(
          `MOMENTUM BUY BLOCKED: Position P/L ${positionPnL.toFixed(2)} <= 0 (need profit to buy)`
        );
        state.buyBlockedByPnL++;
        return false;  // Blocked - not profitable
      } else {
        transactionLog.push(
          `MOMENTUM BUY CHECK PASSED: Position P/L ${positionPnL.toFixed(2)} > 0 ✓`
        );
      }
    } else {
      transactionLog.push(`MOMENTUM BUY CHECK PASSED: First buy (no P/L requirement) ✓`);
    }
  }

  // ... rest of execution checks (maxLots, grid spacing, etc.) ...
  // See Task 2.3 for maxLots modification
}
```

**Acceptance Criteria:**
- ✓ First buy always allowed (lots.length === 0)
- ✓ Subsequent buys require P/L > 0 in momentum mode
- ✓ Traditional mode unchanged (no P/L check)
- ✓ Clear logging of P/L status and blocking reasons

**Verification:**
```bash
# Create test script
cat > test_pnl_gating.sh << 'EOF'
#!/bin/bash

echo "Test 1: Momentum mode - should block buys when P/L <= 0"
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "startDate": "2024-06-01",
    "endDate": "2024-08-31",
    "momentumBasedBuy": true,
    "lotSizeUsd": 1000,
    "maxLots": 10
  }' | jq '.data.buyBlockedByPnL'

echo "Expected: > 0 (some buys blocked by P/L)"
EOF

chmod +x test_pnl_gating.sh
./test_pnl_gating.sh
```

---

### Task 2.3: Modify maxLots Check for Momentum Mode

**File:** `/backend/services/dcaExecutor.js`

**Steps:**
1. Find maxLots check in `checkTrailingStopBuyExecution`
2. Add conditional logic for momentum mode
3. Replace maxLots check with capital check in momentum mode
4. Add logging

**Implementation:**
```javascript
// In checkTrailingStopBuyExecution(), after P/L check

// Position size check: maxLots vs Capital
if (params.momentumBasedBuy) {
  // MOMENTUM MODE: Only check capital availability
  const deployedCapital = lots.reduce((sum, lot) =>
    sum + (lot.price * lot.shares), 0
  );
  const totalCapital = params.maxLots * params.lotSizeUsd;
  const availableCapital = totalCapital - deployedCapital;

  if (availableCapital < params.lotSizeUsd) {
    transactionLog.push(
      `MOMENTUM BUY BLOCKED: Insufficient capital ($${availableCapital.toFixed(0)} available, need $${params.lotSizeUsd})`
    );
    return false;
  }

  transactionLog.push(
    `MOMENTUM BUY CHECK PASSED: Capital available ($${availableCapital.toFixed(0)} >= $${params.lotSizeUsd}) ✓`
  );
} else {
  // TRADITIONAL MODE: Check maxLots constraint
  if (lots.length >= params.maxLots) {
    transactionLog.push(
      `BUY BLOCKED: Max lots ${params.maxLots} reached (currently have ${lots.length} lots)`
    );
    return false;
  }
}

// Continue with grid spacing check...
```

**Acceptance Criteria:**
- ✓ Momentum mode skips maxLots check
- ✓ Momentum mode checks capital availability
- ✓ Traditional mode uses maxLots check (unchanged)
- ✓ Clear logging of constraint type

**Verification:**
```bash
# Test: Momentum mode should exceed maxLots when profitable
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NVDA",
    "startDate": "2023-01-01",
    "endDate": "2024-12-31",
    "momentumBasedBuy": true,
    "lotSizeUsd": 5000,
    "maxLots": 5,
    "gridIntervalPercent": 0.05
  }' | jq '.data.maxLotsReached'

# Expected: > 5 (exceeded maxLots in momentum mode)
```

---

### Task 2.4: Enhance Buy Transaction Logging

**File:** `/backend/services/dcaExecutor.js`

**Steps:**
1. Find buy execution logging (in executeBuy or similar)
2. Add momentum mode indicator
3. Add P/L status to log entry

**Implementation:**
```javascript
// In executeBuy() function
function executeBuy(state, currentPrice, currentDate, params) {
  const { lots, transactionLog, positionPnL } = state;

  // Calculate shares
  const shares = params.lotSizeUsd / currentPrice;

  // Add lot to position
  lots.push({
    price: currentPrice,
    shares: shares,
    date: currentDate
  });

  // Determine buy type for logging
  const buyType = params.momentumBasedBuy ? 'MOMENTUM BUY' : 'TRADITIONAL BUY';
  const pnlInfo = lots.length > 1 ? ` | P/L: $${positionPnL.toFixed(2)}` : ' | First Buy';

  // Log execution
  transactionLog.push(
    `${buyType} EXECUTED @ $${currentPrice.toFixed(2)} | Shares: ${shares.toFixed(4)} | Lots: ${lots.length}${pnlInfo}`
  );

  // Clear trailing stop buy order
  state.trailingStopBuy = null;

  // Update consecutive buy tracking
  // ... existing logic ...

  // Update average cost
  state.averageCost = lots.reduce((sum, lot) => sum + (lot.price * lot.shares), 0) /
                      lots.reduce((sum, lot) => sum + lot.shares, 0);
}
```

**Acceptance Criteria:**
- ✓ Transaction log shows buy type (MOMENTUM vs TRADITIONAL)
- ✓ P/L included in log entry
- ✓ Clear formatting for readability

**Verification:**
```bash
# Check transaction log format
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2024-01-01",
    "endDate": "2024-06-30",
    "momentumBasedBuy": true
  }' | jq '.data.transactionLog | .[] | select(contains("EXECUTED"))'

# Expected format: "MOMENTUM BUY EXECUTED @ $185.23 | Shares: 5.4054 | Lots: 3 | P/L: $127.45"
```

---

## Phase 3: Momentum Sell Implementation (Low Risk, ~2 hours)

### Task 3.1: Modify Sell Activation Check

**File:** `/backend/services/dcaExecutor.js`

**Steps:**
1. Find `checkTrailingStopSellActivation` function
2. Add momentum mode logic for activation threshold
3. Update activation condition
4. Add momentum mode logging

**Implementation:**
```javascript
function checkTrailingStopSellActivation(state, currentPrice, currentDate, params) {
  const { activeStop, recentBottom, recentPeak, lots, transactionLog } = state;

  // Skip if already have active sell order
  if (activeStop) {
    return;
  }

  // Must have profitable lots to consider selling
  const profitableLots = getProfitableLots(lots, currentPrice, params);
  if (profitableLots.length === 0) {
    return;  // No profitable lots
  }

  // Determine effective activation threshold
  let effectiveActivation;
  if (params.momentumBasedSell) {
    effectiveActivation = 0;  // MOMENTUM: Immediate activation
  } else {
    // TRADITIONAL: Use configured or adaptive value
    effectiveActivation = params.trailingSellActivationPercent;
    // ... existing adaptive logic ...
  }

  // Need reference point for activation
  if (!recentPeak && !recentBottom) {
    return;  // No tracking yet
  }

  // MOMENTUM MODE: Activate immediately when any peak exists
  if (params.momentumBasedSell) {
    if (recentPeak) {
      // Calculate stop price
      const effectivePullback = params.trailingSellPullbackPercent;
      const stopPrice = currentPrice * (1 - effectivePullback);

      state.activeStop = {
        stopPrice,
        recentBottomReference: recentBottom || currentPrice,
        triggeredAt: currentPrice,
        activatedDate: currentDate,
        lastUpdatePrice: currentPrice,
        eligibleLots: profitableLots
      };

      transactionLog.push(
        `MOMENTUM SELL ACTIVATED: Stop @ ${stopPrice.toFixed(2)} (pullback ${(effectivePullback * 100).toFixed(1)}%) | ${profitableLots.length} lots eligible`
      );
      return;
    }
  }

  // TRADITIONAL MODE: Check if risen enough from bottom
  if (!params.momentumBasedSell && recentBottom) {
    if (currentPrice >= recentBottom * (1 + effectiveActivation)) {
      // Existing activation logic...
      const effectivePullback = params.trailingSellPullbackPercent;
      const stopPrice = currentPrice * (1 - effectivePullback);

      state.activeStop = {
        stopPrice,
        recentBottomReference: recentBottom,
        triggeredAt: currentPrice,
        activatedDate: currentDate,
        lastUpdatePrice: currentPrice,
        eligibleLots: profitableLots
      };

      transactionLog.push(
        `TRADITIONAL SELL ACTIVATED: Stop @ ${stopPrice.toFixed(2)} | ${profitableLots.length} lots eligible`
      );
    }
  }
}
```

**Acceptance Criteria:**
- ✓ Momentum mode sets activation to 0%
- ✓ Traditional mode uses configured activation
- ✓ Logs indicate mode type
- ✓ Profitable lots still required

**Verification:**
```bash
# Test: Momentum sell should activate immediately on price rise
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2024-01-01",
    "endDate": "2024-06-30",
    "momentumBasedSell": true,
    "profitRequirement": 0.05
  }' | jq '.data.transactionLog | .[] | select(contains("MOMENTUM SELL ACTIVATED"))'
```

---

### Task 3.2: Enhance Sell Transaction Logging

**File:** `/backend/services/dcaExecutor.js`

**Steps:**
1. Find sell execution logging
2. Add momentum mode indicator
3. Keep existing profit information

**Implementation:**
```javascript
// In executeSell() function
function executeSell(state, lotsToSell, currentPrice, currentDate, params) {
  const { lots, transactionLog } = state;

  // Calculate total shares and profit
  const totalShares = lotsToSell.reduce((sum, lot) => sum + lot.shares, 0);
  const totalCost = lotsToSell.reduce((sum, lot) => sum + (lot.price * lot.shares), 0);
  const totalRevenue = totalShares * currentPrice;
  const profit = totalRevenue - totalCost;
  const profitPercent = (profit / totalCost) * 100;

  // Determine sell type for logging
  const sellType = params.momentumBasedSell ? 'MOMENTUM SELL' : 'TRADITIONAL SELL';

  // Log execution
  transactionLog.push(
    `${sellType} EXECUTED @ $${currentPrice.toFixed(2)} | Shares: ${totalShares.toFixed(4)} | Lots: ${lotsToSell.length} | Profit: $${profit.toFixed(2)} (${profitPercent.toFixed(1)}%)`
  );

  // Remove sold lots
  lotsToSell.forEach(soldLot => {
    const index = lots.findIndex(lot => lot === soldLot);
    if (index !== -1) {
      lots.splice(index, 1);
    }
  });

  // Clear trailing stop sell order
  state.activeStop = null;

  // Update consecutive sell tracking
  // ... existing logic ...
}
```

**Acceptance Criteria:**
- ✓ Transaction log shows sell type (MOMENTUM vs TRADITIONAL)
- ✓ Profit information included
- ✓ Clear formatting

**Verification:**
```bash
# Check sell transaction log format
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NVDA",
    "startDate": "2023-01-01",
    "endDate": "2024-12-31",
    "momentumBasedSell": true
  }' | jq '.data.transactionLog | .[] | select(contains("SELL EXECUTED"))'

# Expected: "MOMENTUM SELL EXECUTED @ $485.67 | Shares: 2.0579 | Lots: 1 | Profit: $127.45 (12.3%)"
```

---

## Phase 4: Results & Statistics (Low Risk, ~2 hours)

### Task 4.1: Add Momentum Statistics to Results

**File:** `/backend/services/dcaExecutor.js`

**Steps:**
1. Find results object construction
2. Add momentum mode indicators
3. Add P/L-related statistics

**Implementation:**
```javascript
// At end of runDCABacktest() function
const results = {
  // Existing fields
  totalPnl,
  totalPnlPercent,
  winRate,
  totalTrades,
  // ...

  // NEW: Momentum mode indicators
  momentumMode: {
    buy: params.momentumBasedBuy,
    sell: params.momentumBasedSell
  },

  // NEW: Enhanced statistics
  maxLotsReached: state.maxLotsReached,

  buyStatistics: {
    total: totalBuys,
    blockedByPnL: state.buyBlockedByPnL || 0,        // NEW
    blockedByMaxLots: blockedByMaxLots,
    blockedByGrid: blockedByGrid
  },

  positionMetrics: {
    avgPnL: state.dailyPnL.reduce((sum, d) => sum + d.pnl, 0) / state.dailyPnL.length,
    maxPnL: Math.max(...state.dailyPnL.map(d => d.pnl)),
    minPnL: Math.min(...state.dailyPnL.map(d => d.pnl)),
    finalPnL: state.positionPnL
  },

  // Existing fields
  transactionLog: state.transactionLog
};
```

**Acceptance Criteria:**
- ✓ Results include momentum mode flags
- ✓ P/L statistics included
- ✓ Buy blocking statistics included
- ✓ Backward compatible (existing fields unchanged)

**Verification:**
```bash
# Test results structure
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2024-01-01",
    "endDate": "2024-06-30",
    "momentumBasedBuy": true,
    "momentumBasedSell": true
  }' | jq '{
    momentumMode: .data.momentumMode,
    maxLotsReached: .data.maxLotsReached,
    buyBlockedByPnL: .data.buyStatistics.blockedByPnL,
    positionMetrics: .data.positionMetrics
  }'
```

---

## Phase 5: Frontend Integration (Low Risk, ~2 hours)

### Task 5.1: Add UI Controls

**File:** `/frontend/src/components/BacktestPage.js`

**Steps:**
1. Find parameter form section
2. Add checkboxes for momentum modes
3. Add tooltips/help text
4. Add conflict warnings

**Implementation:**
```jsx
{/* Add in parameter form section */}
<Box sx={{ mt: 2, mb: 2, p: 2, border: '1px solid #ccc', borderRadius: 1 }}>
  <Typography variant="h6" gutterBottom>
    Momentum Trading Mode
  </Typography>

  <FormControlLabel
    control={
      <Checkbox
        checked={params.momentumBasedBuy || false}
        onChange={(e) => handleParamChange('momentumBasedBuy', e.target.checked)}
      />
    }
    label={
      <Box>
        <Typography>Momentum-Based Buy</Typography>
        <Typography variant="caption" color="text.secondary">
          Immediate activation (0%), buy only when P/L &gt; 0, unlimited lots
        </Typography>
      </Box>
    }
  />

  <FormControlLabel
    control={
      <Checkbox
        checked={params.momentumBasedSell || false}
        onChange={(e) => handleParamChange('momentumBasedSell', e.target.checked)}
      />
    }
    label={
      <Box>
        <Typography>Momentum-Based Sell</Typography>
        <Typography variant="caption" color="text.secondary">
          Immediate activation (0%), fast exit on momentum reversal
        </Typography>
      </Box>
    }
  />

  {/* Warning for conflicting features */}
  {(params.momentumBasedBuy || params.momentumBasedSell) && params.enableDynamicProfile && (
    <Alert severity="warning" sx={{ mt: 1 }}>
      Momentum mode overrides Dynamic Profile activation settings
    </Alert>
  )}
</Box>
```

**Acceptance Criteria:**
- ✓ Checkboxes for both momentum modes
- ✓ Clear labels and descriptions
- ✓ Conflict warnings displayed
- ✓ State updates correctly

**Verification:**
- Open browser to `http://localhost:3000/backtest/long`
- Verify checkboxes appear in form
- Check/uncheck boxes and verify state updates
- Enable conflicting features and verify warning appears

---

### Task 5.2: Update Results Display

**File:** `/frontend/src/components/BacktestPage.js`

**Steps:**
1. Find results display section
2. Add momentum mode indicators
3. Display P/L statistics

**Implementation:**
```jsx
{/* Add to results display section */}
{results && results.momentumMode && (
  <Box sx={{ mt: 2 }}>
    <Typography variant="h6">Momentum Mode</Typography>
    <Grid container spacing={2}>
      <Grid item xs={6}>
        <Typography>
          Buy Mode: {results.momentumMode.buy ? 'MOMENTUM' : 'Traditional'}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography>
          Sell Mode: {results.momentumMode.sell ? 'MOMENTUM' : 'Traditional'}
        </Typography>
      </Grid>
    </Grid>
  </Box>
)}

{results && results.positionMetrics && (
  <Box sx={{ mt: 2 }}>
    <Typography variant="h6">Position Metrics</Typography>
    <Grid container spacing={2}>
      <Grid item xs={4}>
        <Typography>Avg P/L: ${results.positionMetrics.avgPnL.toFixed(2)}</Typography>
      </Grid>
      <Grid item xs={4}>
        <Typography>Max P/L: ${results.positionMetrics.maxPnL.toFixed(2)}</Typography>
      </Grid>
      <Grid item xs={4}>
        <Typography>Min P/L: ${results.positionMetrics.minPnL.toFixed(2)}</Typography>
      </Grid>
    </Grid>
  </Box>
)}

{results && results.buyStatistics && results.buyStatistics.blockedByPnL > 0 && (
  <Alert severity="info" sx={{ mt: 2 }}>
    {results.buyStatistics.blockedByPnL} buy attempts blocked due to P/L ≤ 0
  </Alert>
)}
```

**Acceptance Criteria:**
- ✓ Momentum mode indicators displayed
- ✓ P/L statistics shown
- ✓ Buy blocking statistics shown
- ✓ Clean formatting

**Verification:**
- Run backtest with momentum modes enabled
- Verify results section shows momentum indicators
- Verify P/L metrics displayed correctly

---

## Phase 6: Config File Support (Low Risk, ~1 hour)

### Task 6.1: Update Config Loader

**File:** `/backend/services/portfolioConfigLoader.js`

**Steps:**
1. Add momentum parameters to flattening logic
2. No other changes needed (already handles all parameters)

**Implementation:**
```javascript
// In flattenConfigToParams() function
// momentum parameters automatically included (no special handling needed)

// Verify in validation:
function validateConfig(config) {
  // ... existing validation ...

  // Optional: Add warning if momentumBasedBuy enabled with dynamic profile
  if (config.globalDefaults?.longStrategy?.momentumBasedBuy &&
      config.globalDefaults?.dynamicFeatures?.enableDynamicProfile) {
    console.warn('Warning: momentumBasedBuy enabled with enableDynamicProfile - momentum takes precedence');
  }
}
```

**Acceptance Criteria:**
- ✓ Config files can specify momentum parameters
- ✓ Parameters pass through to executor
- ✓ Warnings logged for conflicts

**Verification:**
```bash
# Create test config
cat > backend/configs/portfolios/test-momentum.json << 'EOF'
{
  "name": "Momentum Test",
  "totalCapitalUsd": 100000,
  "startDate": "2024-01-01",
  "endDate": "2024-06-30",
  "globalDefaults": {
    "basic": {
      "lotSizeUsd": 10000,
      "strategyMode": "long"
    },
    "longStrategy": {
      "momentumBasedBuy": true,
      "momentumBasedSell": true,
      "trailingBuyReboundPercent": 3,
      "trailingSellPullbackPercent": 5,
      "gridIntervalPercent": 10,
      "profitRequirement": 5
    }
  },
  "stocks": ["AAPL", "MSFT", "NVDA"]
}
EOF

# Test loading config
curl http://localhost:3001/api/backtest/portfolio/config/test-momentum | jq '.data.results | .[0].momentumMode'
```

---

## Phase 7: Testing & Validation (Medium Risk, ~4 hours)

### Task 7.1: Create Unit Tests

**File:** `/backend/tests/dcaExecutor.momentum.test.js`

**Create comprehensive test suite:**

```javascript
const { calculatePositionPnL, runDCABacktest } = require('../services/dcaExecutor');

describe('Momentum Buy Mode', () => {
  test('First buy always allowed (no P/L check)', async () => {
    const params = {
      momentumBasedBuy: true,
      lotSizeUsd: 1000,
      maxLots: 5,
      // ... other params
    };

    const results = await runDCABacktest('AAPL', '2024-01-01', '2024-01-31', params);

    // Should have at least one buy (first buy allowed)
    expect(results.totalTrades.buy).toBeGreaterThan(0);
  });

  test('Buy allowed when P/L > 0', async () => {
    // Test implementation...
  });

  test('Buy blocked when P/L <= 0', async () => {
    // Test implementation...
  });

  test('maxLots ignored in momentum mode', async () => {
    const params = {
      momentumBasedBuy: true,
      maxLots: 3,
      lotSizeUsd: 1000,
      gridIntervalPercent: 0.05
    };

    const results = await runDCABacktest('NVDA', '2023-01-01', '2024-12-31', params);

    // Should exceed maxLots in strong uptrend
    expect(results.maxLotsReached).toBeGreaterThan(3);
  });

  // ... more tests
});

describe('P/L Calculation', () => {
  test('Empty position returns 0', () => {
    const pnl = calculatePositionPnL([], 100);
    expect(pnl).toBe(0);
  });

  test('Single lot profit', () => {
    const lots = [{ price: 100, shares: 10 }];
    const pnl = calculatePositionPnL(lots, 110);
    expect(pnl).toBe(100);  // (110-100) * 10
  });

  test('Multiple lots mixed P/L', () => {
    const lots = [
      { price: 100, shares: 10 },  // +100
      { price: 120, shares: 10 }   // -100
    ];
    const pnl = calculatePositionPnL(lots, 110);
    expect(pnl).toBe(0);  // Net zero
  });
});
```

**Run tests:**
```bash
cd backend
npm test -- dcaExecutor.momentum.test.js
```

---

### Task 7.2: Integration Testing

**Create test scripts for various scenarios:**

```bash
# Create comprehensive test script
cat > test_momentum_modes.sh << 'EOF'
#!/bin/bash

BASE_URL="http://localhost:3001"

echo "=========================================="
echo "Test 1: Pure Momentum Mode (Buy + Sell)"
echo "=========================================="
curl -X POST $BASE_URL/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2024-01-01",
    "endDate": "2024-06-30",
    "momentumBasedBuy": true,
    "momentumBasedSell": true,
    "lotSizeUsd": 5000,
    "maxLots": 10
  }' | jq '{
    momentumMode: .data.momentumMode,
    maxLots: .data.maxLotsReached,
    blockedByPnL: .data.buyStatistics.blockedByPnL,
    totalPnl: .data.totalPnl
  }'

echo ""
echo "=========================================="
echo "Test 2: Hybrid Mode (Momentum Buy Only)"
echo "=========================================="
curl -X POST $BASE_URL/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NVDA",
    "startDate": "2023-01-01",
    "endDate": "2024-12-31",
    "momentumBasedBuy": true,
    "momentumBasedSell": false,
    "lotSizeUsd": 10000,
    "maxLots": 5
  }' | jq '{
    momentumMode: .data.momentumMode,
    maxLots: .data.maxLotsReached,
    totalPnl: .data.totalPnl
  }'

echo ""
echo "=========================================="
echo "Test 3: Traditional Mode (Baseline)"
echo "=========================================="
curl -X POST $BASE_URL/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2024-01-01",
    "endDate": "2024-06-30",
    "momentumBasedBuy": false,
    "momentumBasedSell": false,
    "lotSizeUsd": 5000,
    "maxLots": 10
  }' | jq '{
    momentumMode: .data.momentumMode,
    maxLots: .data.maxLotsReached,
    totalPnl: .data.totalPnl
  }'

echo ""
echo "=========================================="
echo "Test 4: Stop Loss Integration"
echo "=========================================="
curl -X POST $BASE_URL/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "momentumBasedBuy": true,
    "stopLossPercent": 0.3,
    "lotSizeUsd": 2000,
    "maxLots": 10
  }' | jq '.data.transactionLog | .[] | select(contains("STOP LOSS"))'

echo ""
echo "All tests completed!"
EOF

chmod +x test_momentum_modes.sh
./test_momentum_modes.sh
```

---

### Task 7.3: Performance Testing

**Create performance test:**

```bash
# Test with long time period and many trades
cat > test_momentum_performance.sh << 'EOF'
#!/bin/bash

echo "Performance Test: 5-year momentum backtest"

time curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NVDA",
    "startDate": "2020-01-01",
    "endDate": "2024-12-31",
    "momentumBasedBuy": true,
    "momentumBasedSell": true,
    "lotSizeUsd": 5000,
    "maxLots": 100,
    "gridIntervalPercent": 0.05
  }' > /tmp/momentum_perf_result.json

echo "Execution time shown above"
echo ""
echo "Results:"
cat /tmp/momentum_perf_result.json | jq '{
  maxLotsReached: .data.maxLotsReached,
  totalBuys: .data.totalTrades.buy,
  totalSells: .data.totalTrades.sell,
  buyBlockedByPnL: .data.buyStatistics.blockedByPnL,
  totalPnl: .data.totalPnl
}'
EOF

chmod +x test_momentum_performance.sh
./test_momentum_performance.sh
```

**Expected:** Execution time within 10% of traditional mode

---

## Phase 8: Documentation (Low Risk, ~2 hours)

### Task 8.1: Update API Documentation

**File:** `/docs/api/dca-backtest.md` (create if doesn't exist)

**Content:**
```markdown
# DCA Backtest API

## Parameters

### Momentum Trading Parameters

#### `momentumBasedBuy` (boolean, default: false)
Enable momentum-based buying mode.

**When enabled:**
- Buy activation threshold = 0% (immediate consideration)
- Buys only execute when position P/L > 0
- `maxLots` constraint removed (unlimited accumulation)
- Grid spacing still enforced

**Use case:** Accumulate positions during uptrends when already profitable

#### `momentumBasedSell` (boolean, default: false)
Enable momentum-based selling mode.

**When enabled:**
- Sell activation threshold = 0% (immediate consideration)
- Sells trigger faster on momentum reversals
- `profitRequirement` still enforced

**Use case:** Exit positions quickly on trend reversals

### Examples

**Pure Momentum Trading:**
```json
{
  "momentumBasedBuy": true,
  "momentumBasedSell": true,
  "trailingBuyReboundPercent": 0.03,
  "trailingSellPullbackPercent": 0.05,
  "profitRequirement": 0.02
}
```

**Hybrid (Momentum Entry, Traditional Exit):**
```json
{
  "momentumBasedBuy": true,
  "momentumBasedSell": false,
  "trailingSellActivationPercent": 0.20
}
```
```

---

### Task 8.2: Create User Guide

**File:** `/docs/guides/momentum-trading.md`

**Content:** Comprehensive guide explaining:
- What is momentum trading?
- When to use momentum mode?
- How it differs from traditional mode
- Parameter tuning guidelines
- Example scenarios
- Risk warnings

---

## Summary Checklist

### Phase 1: Core Infrastructure ✓
- [ ] Task 1.1: Add parameter definitions
- [ ] Task 1.2: Create P/L calculation function
- [ ] Task 1.3: Enhance state tracking
- [ ] Task 1.4: Add daily P/L calculation

### Phase 2: Momentum Buy ✓
- [ ] Task 2.1: Modify buy activation check
- [ ] Task 2.2: Add P/L gating to execution
- [ ] Task 2.3: Modify maxLots check
- [ ] Task 2.4: Enhance transaction logging

### Phase 3: Momentum Sell ✓
- [ ] Task 3.1: Modify sell activation check
- [ ] Task 3.2: Enhance transaction logging

### Phase 4: Results & Statistics ✓
- [ ] Task 4.1: Add momentum statistics

### Phase 5: Frontend ✓
- [ ] Task 5.1: Add UI controls
- [ ] Task 5.2: Update results display

### Phase 6: Config Support ✓
- [ ] Task 6.1: Update config loader

### Phase 7: Testing ✓
- [ ] Task 7.1: Create unit tests
- [ ] Task 7.2: Integration testing
- [ ] Task 7.3: Performance testing

### Phase 8: Documentation ✓
- [ ] Task 8.1: Update API docs
- [ ] Task 8.2: Create user guide

---

## Estimated Timeline

- **Phase 1:** 3 hours
- **Phase 2:** 4 hours
- **Phase 3:** 2 hours
- **Phase 4:** 2 hours
- **Phase 5:** 2 hours
- **Phase 6:** 1 hour
- **Phase 7:** 4 hours
- **Phase 8:** 2 hours

**Total:** ~20 hours

## Success Criteria

1. ✓ All unit tests pass
2. ✓ Integration tests pass for all scenarios
3. ✓ Performance within 10% of traditional mode
4. ✓ Backward compatibility maintained
5. ✓ Transaction logs clear and informative
6. ✓ UI controls functional
7. ✓ Config files support momentum parameters
8. ✓ Documentation complete
