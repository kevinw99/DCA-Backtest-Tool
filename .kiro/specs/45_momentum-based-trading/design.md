# Design: Momentum-Based Trading Mode

## Overview

This document describes the technical design for implementing momentum-based trading modes (`momentumBasedBuy` and `momentumBasedSell`) in the DCA backtest system.

## Architecture

### Current Architecture (Traditional Mean Reversion)

```
┌─────────────────────────────────────────────────────────────┐
│                    TRADITIONAL BUY FLOW                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Price drops 10% from peak                               │
│     ↓                                                        │
│  2. ACTIVATE trailing stop buy                              │
│     ↓                                                        │
│  3. Wait for 5% rebound from bottom                          │
│     ↓                                                        │
│  4. Check: lots.length < maxLots?                           │
│     ↓                                                        │
│  5. Check: Grid spacing valid?                              │
│     ↓                                                        │
│  6. EXECUTE BUY                                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    TRADITIONAL SELL FLOW                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Price rises 20% from bottom                             │
│     ↓                                                        │
│  2. ACTIVATE trailing stop sell                             │
│     ↓                                                        │
│  3. Wait for 10% pullback from peak                          │
│     ↓                                                        │
│  4. Check: Profitable lots exist?                           │
│     ↓                                                        │
│  5. Check: Profit requirement met?                          │
│     ↓                                                        │
│  6. EXECUTE SELL                                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Proposed Architecture (Momentum Mode)

```
┌─────────────────────────────────────────────────────────────┐
│                    MOMENTUM BUY FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Price rebounds ANY amount from bottom                   │
│     ↓                                                        │
│  2. ACTIVATE immediately (0% activation threshold)          │
│     ↓                                                        │
│  3. Wait for X% rebound (configurable)                      │
│     ↓                                                        │
│  4. Check: Position P/L > 0? ◄─── NEW CHECK                │
│     ↓                                                        │
│  5. Check: Capital available? (NO maxLots check)            │
│     ↓                                                        │
│  6. Check: Grid spacing valid?                              │
│     ↓                                                        │
│  7. EXECUTE BUY                                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    MOMENTUM SELL FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Price pulls back ANY amount from peak                   │
│     ↓                                                        │
│  2. ACTIVATE immediately (0% activation threshold)          │
│     ↓                                                        │
│  3. Wait for X% pullback (configurable)                     │
│     ↓                                                        │
│  4. Check: Profitable lots exist?                           │
│     ↓                                                        │
│  5. Check: Profit requirement met?                          │
│     ↓                                                        │
│  6. EXECUTE SELL                                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Parameter Definitions

**File:** `/backend/config/backtestDefaults.json`

```json
{
  "momentumBasedBuy": false,
  "momentumBasedSell": false,

  // Existing parameters (unchanged)
  "trailingBuyActivationPercent": 0.1,
  "trailingBuyReboundPercent": 0.05,
  "trailingSellActivationPercent": 0.2,
  "trailingSellPullbackPercent": 0.1,
  "maxLots": 10
}
```

### 2. Position P/L Calculation

**File:** `/backend/services/dcaExecutor.js`

**New Function:**
```javascript
/**
 * Calculate total unrealized P/L for current position
 *
 * @param {Array} lots - Current position lots [{price, shares, date}]
 * @param {number} currentPrice - Current market price
 * @returns {number} Total unrealized P/L in USD
 */
function calculatePositionPnL(lots, currentPrice) {
  if (lots.length === 0) {
    return 0;
  }

  return lots.reduce((totalPnL, lot) => {
    const pnl = (currentPrice - lot.price) * lot.shares;
    return totalPnL + pnl;
  }, 0);
}
```

**Usage in Daily Processing:**
```javascript
// In processOneDayOfTrading()
const positionPnL = calculatePositionPnL(lots, currentPrice);

// Store for later use in buy checks
state.positionPnL = positionPnL;
```

### 3. Momentum Buy Implementation

**File:** `/backend/services/dcaExecutor.js`

#### 3.1: Activation Logic Modification

**Current Code (Lines 539-555):**
```javascript
// checkTrailingStopBuyActivation()
if (!trailingStopBuy && recentPeak && currentPrice <= recentPeak * (1 - effectiveActivation)) {
  // Activate trailing stop buy
}
```

**New Code:**
```javascript
// checkTrailingStopBuyActivation()
function checkTrailingStopBuyActivation(state, currentPrice, currentDate, params) {
  const { trailingStopBuy, recentPeak, recentBottom, lots } = state;

  // Determine effective activation threshold
  let effectiveActivation;
  if (params.momentumBasedBuy) {
    effectiveActivation = 0;  // Immediate activation
  } else {
    // Traditional: Use configured activation or adaptive value
    effectiveActivation = params.trailingBuyActivationPercent;
  }

  // Traditional mode: Need price drop from peak
  // Momentum mode: Just need recentBottom to exist (any price movement tracked)
  if (!trailingStopBuy && recentBottom) {
    // Traditional: Check if dropped enough from peak
    if (!params.momentumBasedBuy && (!recentPeak || currentPrice > recentPeak * (1 - effectiveActivation))) {
      return;  // Not dropped enough
    }

    // ACTIVATE
    const effectiveRebound = params.trailingBuyReboundPercent;
    const stopPrice = currentPrice * (1 + effectiveRebound);

    state.trailingStopBuy = {
      stopPrice,
      recentPeakReference: recentPeak || currentPrice,
      triggeredAt: currentPrice,
      activatedDate: currentDate,
      lastUpdatePrice: currentPrice
    };

    // Log activation
    transactionLog.push(
      `${params.momentumBasedBuy ? 'MOMENTUM' : 'TRADITIONAL'} BUY ACTIVATED at ${stopPrice.toFixed(2)}`
    );
  }
}
```

#### 3.2: Execution Check Modification

**Current Code (Lines 610-1055):**
```javascript
// checkTrailingStopBuyExecution()
if (lots.length >= maxLots) {
  return false;  // Blocked
}
```

**New Code:**
```javascript
// checkTrailingStopBuyExecution()
function checkTrailingStopBuyExecution(state, currentPrice, currentDate, params) {
  // ... existing price/limit checks ...

  // 1. Check if buying is enabled
  if (!params.buyEnabled) {
    transactionLog.push(`BUY BLOCKED: Buying disabled by portfolio`);
    return false;
  }

  // 2. MOMENTUM MODE: Check position P/L
  if (params.momentumBasedBuy) {
    // Exception: First buy always allowed (no position yet)
    if (lots.length > 0 && state.positionPnL <= 0) {
      transactionLog.push(
        `MOMENTUM BUY BLOCKED: Position P/L ${state.positionPnL.toFixed(2)} <= 0`
      );
      return false;  // Blocked - not profitable
    }

    // Log P/L status when buy is allowed
    if (lots.length > 0) {
      transactionLog.push(
        `MOMENTUM BUY ALLOWED: Position P/L ${state.positionPnL.toFixed(2)} > 0`
      );
    }
  }

  // 3. MOMENTUM MODE: Skip maxLots check
  if (!params.momentumBasedBuy) {
    // Traditional mode: Check maxLots
    if (lots.length >= params.maxLots) {
      transactionLog.push(`BUY BLOCKED: Max lots ${params.maxLots} reached`);
      return false;
    }
  } else {
    // Momentum mode: Only check capital availability
    const deployedCapital = lots.reduce((sum, lot) =>
      sum + (lot.price * lot.shares), 0
    );
    const totalCapital = params.maxLots * params.lotSizeUsd;  // Total available

    if (deployedCapital + params.lotSizeUsd > totalCapital) {
      transactionLog.push(
        `BUY BLOCKED: Insufficient capital (${totalCapital - deployedCapital} available)`
      );
      return false;
    }
  }

  // 4. Grid spacing validation (unchanged)
  const respectsGridSpacing = validateGridSpacing(lots, currentPrice, params);
  if (!respectsGridSpacing) {
    transactionLog.push(`BUY BLOCKED: Grid spacing violated`);
    return false;
  }

  // 5. Execute buy
  executeBuy(state, currentPrice, currentDate, params);
  return true;
}
```

#### 3.3: Transaction Log Enhancement

```javascript
// In executeBuy()
const buyType = params.momentumBasedBuy ? 'MOMENTUM BUY' : 'TRADITIONAL BUY';
const pnlInfo = lots.length > 0 ? ` (P/L: ${state.positionPnL.toFixed(2)})` : '';

transactionLog.push(
  `${buyType} EXECUTED @ ${currentPrice.toFixed(2)}${pnlInfo}`
);
```

### 4. Momentum Sell Implementation

**File:** `/backend/services/dcaExecutor.js`

#### 4.1: Activation Logic Modification

**Current Code:**
```javascript
// checkTrailingStopSellActivation()
if (!activeStop && recentBottom && currentPrice >= recentBottom * (1 + effectiveActivation)) {
  // Activate trailing stop sell
}
```

**New Code:**
```javascript
// checkTrailingStopSellActivation()
function checkTrailingStopSellActivation(state, currentPrice, currentDate, params) {
  const { activeStop, recentBottom, recentPeak, lots } = state;

  // Determine effective activation threshold
  let effectiveActivation;
  if (params.momentumBasedSell) {
    effectiveActivation = 0;  // Immediate activation
  } else {
    // Traditional: Use configured activation or adaptive value
    effectiveActivation = params.trailingSellActivationPercent;
  }

  // Must have profitable lots to activate sell
  const profitableLots = getProfitableLots(lots, currentPrice, params);
  if (profitableLots.length === 0) {
    return;  // No profitable lots
  }

  // Traditional mode: Need price rise from bottom
  // Momentum mode: Just need recentPeak to exist
  if (!activeStop && recentPeak) {
    // Traditional: Check if risen enough from bottom
    if (!params.momentumBasedSell && (!recentBottom || currentPrice < recentBottom * (1 + effectiveActivation))) {
      return;  // Not risen enough
    }

    // ACTIVATE
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

    // Log activation
    transactionLog.push(
      `${params.momentumBasedSell ? 'MOMENTUM' : 'TRADITIONAL'} SELL ACTIVATED at ${stopPrice.toFixed(2)} (${profitableLots.length} lots)`
    );
  }
}
```

#### 4.2: Execution Check Modification

**New Code:**
```javascript
// checkTrailingStopSellExecution()
function checkTrailingStopSellExecution(state, currentPrice, currentDate, params) {
  // ... existing checks (profitable lots, profit requirement) ...

  // Execute sell
  const sellType = params.momentumBasedSell ? 'MOMENTUM SELL' : 'TRADITIONAL SELL';

  transactionLog.push(
    `${sellType} EXECUTED @ ${currentPrice.toFixed(2)} (${lotsToSell.length} lots)`
  );

  executeSell(state, lotsToSell, currentPrice, currentDate, params);
  return true;
}
```

### 5. Data Flow

#### Daily Processing Flow (with Momentum Mode)

```javascript
// In processOneDayOfTrading() - dcaExecutor.js

function processOneDayOfTrading(state, priceData, params) {
  const { date, open, high, low, close } = priceData;
  const currentPrice = close;

  // 1. Calculate position P/L (NEW)
  state.positionPnL = calculatePositionPnL(state.lots, currentPrice);

  // 2. Update peak/bottom tracking
  updatePeakBottomTracking(state, currentPrice);

  // 3. Process sell logic first
  if (state.activeStop) {
    updateTrailingStop(state, currentPrice, currentDate, params);
    checkTrailingStopSellExecution(state, currentPrice, currentDate, params);
  } else {
    checkTrailingStopSellActivation(state, currentPrice, currentDate, params);
  }

  // 4. Cancel unprofitable sell orders
  cancelTrailingStopIfUnprofitable(state, currentPrice, params);

  // 5. Process buy logic
  if (state.trailingStopBuy) {
    // Cancel if above limit (LIMIT orders only)
    if (params.trailingStopOrderType === 'limit') {
      cancelTrailingStopBuyIfAbovePeak(state, currentPrice, params);
    }

    // Update stop price
    updateTrailingStopBuy(state, currentPrice, currentDate, params);

    // Check execution
    checkTrailingStopBuyExecution(state, currentPrice, currentDate, params);
  } else {
    checkTrailingStopBuyActivation(state, currentPrice, currentDate, params);
  }

  // 6. Check stop loss
  checkStopLoss(state, currentPrice, currentDate, params);

  // 7. Track capital deployment
  trackCapitalMetrics(state, currentPrice);

  // 8. Return daily stats
  return {
    date,
    price: currentPrice,
    positionPnL: state.positionPnL,  // NEW
    lots: state.lots.length,
    deployedCapital: calculateDeployedCapital(state.lots)
  };
}
```

### 6. Parameter Precedence Rules

When multiple features affect the same parameter:

```javascript
/**
 * Get effective buy activation threshold
 *
 * Precedence (highest to lowest):
 * 1. momentumBasedBuy = true → 0%
 * 2. Dynamic profile (if enabled)
 * 3. Configured value
 */
function getEffectiveBuyActivation(params, profile) {
  // Momentum mode takes absolute precedence
  if (params.momentumBasedBuy) {
    return 0;
  }

  // Dynamic profile
  if (params.enableDynamicProfile && profile) {
    return profile.trailingBuyActivationPercent;
  }

  // Configured value
  return params.trailingBuyActivationPercent;
}

/**
 * Get effective sell activation threshold
 *
 * Same precedence as buy
 */
function getEffectiveSellActivation(params, profile) {
  if (params.momentumBasedSell) {
    return 0;
  }

  if (params.enableDynamicProfile && profile) {
    return profile.trailingSellActivationPercent;
  }

  return params.trailingSellActivationPercent;
}
```

### 7. State Tracking Enhancement

**Current State Object:**
```javascript
const state = {
  lots: [],
  trailingStopBuy: null,
  activeStop: null,
  recentPeak: null,
  recentBottom: null,
  referencePrice: null,
  // ... other state
};
```

**Enhanced State Object:**
```javascript
const state = {
  // Existing fields
  lots: [],
  trailingStopBuy: null,
  activeStop: null,
  recentPeak: null,
  recentBottom: null,
  referencePrice: null,

  // NEW: Momentum mode tracking
  positionPnL: 0,                    // Current unrealized P/L
  maxLotsReached: 0,                 // Max lots held simultaneously
  buyBlockedByPnL: 0,                // Count of buys blocked by P/L <= 0

  // Enhanced transaction log
  transactionLog: []                 // Includes momentum mode indicators
};
```

### 8. Statistics & Reporting

**Enhanced Backtest Results:**
```javascript
const results = {
  // Existing fields
  totalPnl: ...,
  totalPnlPercent: ...,
  winRate: ...,

  // NEW: Momentum mode statistics
  momentumMode: {
    buy: params.momentumBasedBuy,
    sell: params.momentumBasedSell
  },

  maxLotsReached: state.maxLotsReached,

  buyStatistics: {
    total: totalBuys,
    blockedByPnL: state.buyBlockedByPnL,        // NEW
    blockedByMaxLots: blockedByMaxLots,
    blockedByGrid: blockedByGrid
  },

  positionMetrics: {
    avgPnL: avgPositionPnL,                      // NEW
    maxPnL: maxPositionPnL,                      // NEW
    minPnL: minPositionPnL                       // NEW
  }
};
```

## Integration Points

### 1. Frontend Integration

**File:** `/frontend/src/components/BacktestPage.js`

**New UI Controls:**
```jsx
<FormControlLabel
  control={
    <Checkbox
      checked={params.momentumBasedBuy}
      onChange={(e) => handleParamChange('momentumBasedBuy', e.target.checked)}
    />
  }
  label="Momentum-Based Buy (0% activation, P/L > 0 required)"
/>

<FormControlLabel
  control={
    <Checkbox
      checked={params.momentumBasedSell}
      onChange={(e) => handleParamChange('momentumBasedSell', e.target.checked)}
    />
  }
  label="Momentum-Based Sell (0% activation, fast exit)"
/>

{/* Warning when conflicting features enabled */}
{params.momentumBasedBuy && params.enableDynamicProfile && (
  <Alert severity="warning">
    Momentum Buy overrides Dynamic Profile activation settings
  </Alert>
)}
```

### 2. Portfolio Backtest Integration

**File:** `/backend/services/portfolioBacktestService.js`

**No changes required** - momentum mode works at stock level:
- Portfolio capital constraints still apply
- Day callbacks still work (`buyEnabled` still checked)
- Beta scaling still applies to rebound % (not activation %)

### 3. Config File Support

**File:** `/backend/configs/portfolios/example-momentum.json`

**Example Config:**
```json
{
  "name": "Momentum Tech Portfolio",
  "totalCapitalUsd": 500000,
  "startDate": "2021-01-01",
  "endDate": "2024-12-31",

  "globalDefaults": {
    "basic": {
      "lotSizeUsd": 20000,
      "strategyMode": "long"
    },
    "longStrategy": {
      "momentumBasedBuy": true,
      "momentumBasedSell": true,
      "trailingBuyReboundPercent": 3,
      "trailingSellPullbackPercent": 5,
      "profitRequirement": 2,
      "gridIntervalPercent": 10,
      "maxLots": 999,
      "enableDynamicProfile": false
    }
  },

  "stocks": ["AAPL", "MSFT", "NVDA", "TSLA", "META"],

  "stockSpecificOverrides": {
    "TSLA": {
      "longStrategy": {
        "trailingBuyReboundPercent": 5,
        "trailingSellPullbackPercent": 8
      }
    }
  }
}
```

## Edge Cases & Error Handling

### Edge Case 1: First Buy After Stop Loss

**Scenario:** Position stopped out, P/L reset to 0 (realized loss)

**Handling:**
```javascript
// In checkTrailingStopBuyExecution()
if (params.momentumBasedBuy) {
  // Exception: First buy always allowed
  if (lots.length === 0) {
    // No position - allow first buy regardless of P/L
  } else if (state.positionPnL <= 0) {
    // Have position but P/L <= 0 - block buy
    return false;
  }
}
```

### Edge Case 2: All Lots Sold, P/L History

**Scenario:** Sold all lots profitably, P/L = 0 (no position)

**Handling:**
```javascript
// After sell execution
if (lots.length === 0) {
  state.positionPnL = 0;  // Reset - no position
  state.recentPeak = null;
  state.recentBottom = null;
  // Next buy is "first buy" - allowed
}
```

### Edge Case 3: Rapid Price Swings

**Scenario:** Price swings up/down rapidly, multiple activation attempts

**Handling:**
- Existing logic handles this (one active order at a time)
- Sell and buy orders mutually exclusive
- No changes needed

### Edge Case 4: maxLots = 0 in Momentum Mode

**Scenario:** User sets `maxLots = 0` with `momentumBasedBuy = true`

**Handling:**
```javascript
// Validation in parameter processing
if (params.momentumBasedBuy && params.maxLots <= 0) {
  throw new Error(
    'maxLots must be > 0 even in momentum mode (defines capital allocation)'
  );
}
```

### Edge Case 5: Portfolio Capital Exhausted

**Scenario:** Momentum buy mode, all portfolio capital deployed

**Handling:**
```javascript
// Portfolio level callback
const dayContext = await dayCallback(date, dayIndex);

// If portfolio runs out of cash, disable buys for all stocks
if (dayContext.availableCash < minCashReserve) {
  params.buyEnabled = false;  // Blocks all buys across stocks
}
```

## Performance Considerations

### 1. P/L Calculation Overhead

**Analysis:**
```javascript
// O(n) where n = number of lots
function calculatePositionPnL(lots, currentPrice) {
  return lots.reduce((sum, lot) =>
    sum + (currentPrice - lot.price) * lot.shares
  , 0);
}
```

**Impact:** Negligible
- Called once per day per stock
- Same complexity as existing profit checks
- For 10 lots: ~10 operations
- For 100 lots (momentum mode): ~100 operations (still very fast)

### 2. Grid Spacing Validation

**Analysis:** No change - same grid validation as traditional mode

**Impact:** None

### 3. Transaction Log Size

**Analysis:** Additional log entries for P/L status

**Impact:** Minimal
- ~1-2 extra log lines per buy attempt
- For 1000-day backtest: ~2000 extra lines worst case
- Negligible memory/storage impact

## Testing Strategy

### Unit Tests

**File:** `/backend/tests/dcaExecutor.momentum.test.js`

**Test Cases:**

```javascript
describe('Momentum Buy Mode', () => {
  test('First buy always allowed (no P/L check)', () => {
    // Setup: Empty position
    // Execute: Trigger buy
    // Assert: Buy executes
  });

  test('Buy allowed when P/L > 0', () => {
    // Setup: Position with $100 unrealized profit
    // Execute: Trigger buy
    // Assert: Buy executes
  });

  test('Buy blocked when P/L <= 0', () => {
    // Setup: Position with -$50 unrealized loss
    // Execute: Trigger buy
    // Assert: Buy blocked, log entry created
  });

  test('Activation threshold = 0% (immediate)', () => {
    // Setup: Price at any level
    // Execute: Price moves up slightly
    // Assert: Buy order activates immediately
  });

  test('maxLots ignored in momentum mode', () => {
    // Setup: maxLots = 5, already have 5 lots, P/L > 0
    // Execute: Trigger buy
    // Assert: Buy executes (traditional mode would block)
  });

  test('Grid spacing still enforced', () => {
    // Setup: Last buy at $100, gridInterval = 10%
    // Execute: Try to buy at $105 (only 5% away)
    // Assert: Buy blocked by grid spacing
  });

  test('Capital constraint enforced', () => {
    // Setup: Total capital $10k, deployed $10k
    // Execute: Trigger buy for $1k
    // Assert: Buy blocked (insufficient capital)
  });
});

describe('Momentum Sell Mode', () => {
  test('Activation threshold = 0% (immediate)', () => {
    // Setup: Profitable position
    // Execute: Price drops slightly from peak
    // Assert: Sell order activates immediately
  });

  test('Profit requirement still enforced', () => {
    // Setup: Position with lots below profit requirement
    // Execute: Trigger sell
    // Assert: Only profitable lots eligible
  });
});

describe('P/L Calculation', () => {
  test('Empty position returns 0', () => {
    // Setup: lots = []
    // Execute: calculatePositionPnL(lots, 100)
    // Assert: Returns 0
  });

  test('Single lot profit calculated correctly', () => {
    // Setup: 1 lot @ $100, current $110
    // Execute: calculatePositionPnL(lots, 110)
    // Assert: Returns positive value
  });

  test('Multiple lots with mixed P/L', () => {
    // Setup: Lot 1 @ $100 (profit), Lot 2 @ $120 (loss)
    // Current: $110
    // Execute: calculatePositionPnL(lots, 110)
    // Assert: Returns net P/L
  });
});
```

### Integration Tests

**Test Scenarios:**

1. **Pure Momentum Mode Backtest:**
   - Symbol: AAPL, 2020-2024
   - momentumBasedBuy = true, momentumBasedSell = true
   - Verify: Accumulates in uptrends, exits on weakness

2. **Hybrid Mode: Momentum Buy, Traditional Sell:**
   - Symbol: NVDA, 2022-2024
   - momentumBasedBuy = true, momentumBasedSell = false
   - Verify: Aggressive entry, conservative exit

3. **Conflicting Features Handling:**
   - Enable momentumBasedBuy + enableDynamicProfile
   - Verify: Momentum takes precedence

4. **Stop Loss Integration:**
   - Momentum mode with stop loss enabled
   - Verify: Stop loss triggers, resets P/L, next buy allowed

5. **Portfolio Level Integration:**
   - Portfolio with mixed momentum/traditional stocks
   - Verify: Capital constraints work correctly

### Performance Tests

**Test Cases:**

1. **Large Position (100+ lots):**
   - Run backtest allowing unlimited accumulation
   - Measure P/L calculation time per day
   - Assert: < 1ms per calculation

2. **Long Backtest (10 years):**
   - Run 2500-day backtest with momentum mode
   - Measure total execution time
   - Assert: Within 10% of traditional mode

3. **Transaction Log Size:**
   - Run backtest with momentum mode
   - Measure transaction log size
   - Assert: < 2x traditional mode size

## Migration Strategy

### Phase 1: Core Implementation (Low Risk)
1. Add `momentumBasedBuy` and `momentumBasedSell` parameters
2. Implement P/L calculation function
3. Add parameter defaults
4. Unit tests for new functions

### Phase 2: Buy Logic Integration (Medium Risk)
1. Modify activation check (effective activation = 0)
2. Add P/L gating in execution check
3. Skip maxLots check in momentum mode
4. Enhanced transaction logging
5. Integration tests

### Phase 3: Sell Logic Integration (Low Risk)
1. Modify activation check (effective activation = 0)
2. Enhanced transaction logging
3. Integration tests

### Phase 4: Frontend & Config Support (Low Risk)
1. Add UI checkboxes
2. Add validation warnings
3. Update config file loader
4. Test with example configs

### Phase 5: Documentation & Testing (Low Risk)
1. Update API documentation
2. Create user guide
3. Performance testing
4. User acceptance testing

## Rollback Plan

If issues discovered:

1. **Immediate:** Set defaults to `false` in config
2. **Short-term:** Add feature flag to disable
3. **Long-term:** Revert code changes (isolated feature)

Feature is fully backward compatible - setting both flags to `false` restores exact original behavior.

## Future Enhancements

### Enhancement 1: Momentum Strength Threshold
```javascript
// Instead of simple P/L > 0, use % threshold
{
  "momentumBuyThresholdPercent": 5  // Buy only if position up 5%+
}
```

### Enhancement 2: Adaptive Rebound/Pullback
```javascript
// Adjust rebound % based on current momentum
if (momentum === 'strong') {
  effectiveRebound = trailingBuyReboundPercent * 0.5;  // Tighter
} else {
  effectiveRebound = trailingBuyReboundPercent;
}
```

### Enhancement 3: Momentum Indicators
```javascript
// Use RSI, MACD for momentum detection
{
  "momentumIndicator": "rsi",
  "rsiThreshold": 50  // Buy when RSI > 50
}
```

### Enhancement 4: Graduated Position Sizing
```javascript
// Increase lot size as P/L grows
if (positionPnL > lotSizeUsd * 2) {
  nextLotSize = lotSizeUsd * 1.5;  // Bigger lots in strong trends
}
```

## Summary

The momentum-based trading mode is implemented as:

1. **Two independent boolean flags** controlling buy/sell behavior
2. **Minimal code changes** to existing executor logic
3. **Full backward compatibility** when flags = false
4. **Clear precedence rules** when conflicting features enabled
5. **Enhanced logging** for transparency
6. **Comprehensive testing** strategy

Key benefits:
- ✓ Captures strong trends more effectively
- ✓ Removes artificial position size limits
- ✓ Protects capital (only buy in profit)
- ✓ Responds faster to reversals
- ✓ Fully configurable and testable
