# DCA Executor Extraction Map

## Goal
Extract ~1,800 lines from runDCABacktest closure into standalone dcaExecutor.js module.

## Extraction Plan

This document maps EXACTLY what code moves where. Follow this systematically.

---

## Phase 1: Create dcaExecutor.js skeleton

**File:** `/backend/services/dcaExecutor.js`

### Dependencies to require
```javascript
const dcaSignalEngine = require('./dcaSignalEngine');
const database = require('../database');
const { assessMarketCondition, calculateDynamicGridSpacing } = require('./dcaBacktestService');
```

### Constants to copy (from dcaBacktestService.js)
- Lines 26-50: PROFILES
- Line 52: HYSTERESIS_DAYS
- Lines 59-62: ADAPTIVE constants
- Lines 885-895: colors object

---

## Phase 2: Extract Helper Functions

All functions below are currently INSIDE runDCABacktest closure. Extract them as standalone functions in dcaExecutor.js.

### 1. recalculateAverageCost (lines 855-862)
```javascript
function recalculateAverageCost(lots) {
  // Copy exact code from lines 855-862
}
```

### 2. calculatePositionStatus (lines 865-880)
```javascript
function calculatePositionStatus(lots, currentPrice, positionThreshold) {
  // Copy exact code from lines 865-880
}
```

### 3. getLotsPrices (line 882)
```javascript
function getLotsPrices(lots) {
  // Copy exact code from line 882
}
```

### 4. colorize (line 897 + colors from 885-895)
```javascript
const colors = { /* from lines 885-895 */ };
function colorize(text, color) {
  // Copy exact code from line 897
}
```

### 5. trackTransaction (lines 900-932)
```javascript
function trackTransaction(enhancedTransactions, transaction, lots, averageCost) {
  // Copy exact code from lines 900-932
  // NOTE: Modifies enhancedTransactions array in place
}
```

### 6. resetPeakBottomTracking (lines 935-940)
```javascript
function resetPeakBottomTracking(state) {
  // Copy exact code from lines 935-940
  // NOTE: Modifies state.recentPeak, state.recentBottom, state.lastTransactionDate
}
```

### 7. updatePeakBottomTracking (lines 943-950)
```javascript
function updatePeakBottomTracking(state, currentPrice, currentDate) {
  // Copy exact code from lines 943-950
}
```

### 8. checkTrailingStopBuyActivation (lines 953-1017)
```javascript
function checkTrailingStopBuyActivation(state, params, currentPrice, dayData, transactionLog, verbose) {
  // Copy exact code from lines 953-1017
  // NOTE: This function uses colorize, modifies state.trailingStopBuy
}
```

### 9. updateTrailingStopBuy (lines 1020-1051)
```javascript
function updateTrailingStopBuy(state, currentPrice, params, dayData, transactionLog, verbose) {
  // Copy exact code from lines 1020-1051
}
```

### 10. cancelTrailingStopBuyIfAbovePeak (lines 1055-1068)
```javascript
function cancelTrailingStopBuyIfAbovePeak(state, currentPrice, params, transactionLog, verbose) {
  // Copy exact code from lines 1055-1068
}
```

### 11. checkTrailingStopBuyExecution (lines 1071-1423)
**LARGEST FUNCTION: 353 lines**
```javascript
function checkTrailingStopBuyExecution(state, params, currentPrice, dayData, transactionLog, context, verbose) {
  // Copy exact code from lines 1071-1423
  // NOTE: This is complex - handles actual buy execution with trailing stops
  // Uses: dcaSignalEngine, trackTransaction, resetPeakBottomTracking, colorize
  // Modifies: state.lots, state.transactions, state.realizedPNL, etc.
}
```

### 12. checkTrailingStopSellActivation (lines 1426-1652)
**SECOND LARGEST: 227 lines**
```javascript
function checkTrailingStopSellActivation(state, params, currentPrice, dayData, transactionLog, verbose) {
  // Copy exact code from lines 1426-1652
  // Handles sell trailing stop activation logic
}
```

### 13. updateTrailingStop (lines 1655-1747)
**93 lines**
```javascript
function updateTrailingStop(state, params, currentPrice, dayData, transactionLog, verbose) {
  // Copy exact code from lines 1655-1747
}
```

### 14. cancelTrailingStopIfUnprofitable (lines 1750-1757)
```javascript
function cancelTrailingStopIfUnprofitable(state, params, transactionLog, verbose) {
  // Copy exact code from lines 1750-1757
}
```

### 15. determineAndApplyProfile (lines 1769-1842)
**74 lines - Profile switching logic**
```javascript
function determineAndApplyProfile(state, params, currentParams, dayData, i, transactionLog, verbose) {
  // Copy exact code from lines 1769-1842
  // Returns: { profile, switchedProfile }
}
```

### 16. processOneDayOfTrading (lines 1852-2286)
**THE CORE: 435 lines**
```javascript
async function processOneDayOfTrading(state, params, currentParams, pricesWithIndicators, dayData, i, context, verbose, adaptiveStrategy) {
  // Copy exact code from lines 1852-2286
  // This is the MAIN trading logic
  // Calls ALL the above helper functions
  // Returns: transaction result
}
```

---

## Phase 3: Extract State Initialization

### initializeDCAState function
```javascript
function initializeDCAState(params, pricesWithIndicators, verbose) {
  // Initialize ALL ~80 state variables from lines 799-853

  const initialPrice = pricesWithIndicators[0].adjusted_close;

  return {
    // Core trading state
    lots: [],
    transactions: [],
    enhancedTransactions: [],
    lotCounter: 0,
    transactionLog: [],

    // P&L tracking
    realizedPNL: 0,
    unrealizedPNL: 0,
    totalPNL: 0,

    // Position tracking
    averageCost: 0,
    positionStatus: 'neutral',
    portfolioUnrealizedPNL: 0,
    positionThreshold: params.lotSizeUsd * 0.05,

    // DCA state (from lines 813-830)
    dcaState: {
      lastBuyPrice: null,
      lastSellPrice: null,
      consecutiveBuyCount: 0,
      consecutiveSellCount: 0,
      trailingStopBuy: null,
      activeStop: null,
      peak: null,
      bottom: null,
      lastBuyRebound: null,
      lastBuyDirection: null,
      lastSellPullback: null,
      lastSellDirection: null,
      referencePrice: params.normalizeToReference ? initialPrice : null
    },

    // Trailing stop state
    trailingStopBuy: null,
    activeStop: null,

    // Peak/Bottom tracking
    recentPeak: initialPrice,
    recentBottom: initialPrice,
    lastTransactionDate: null,

    // Profile switching state
    currentProfile: PROFILES.DEFAULT,
    profileSwitchCount: 0,
    daysInConservative: 0,
    daysInAggressive: 0,
    lastProfileSwitch: null,

    // Metrics tracking
    maxDrawdown: 0,
    maxDrawdownPercent: 0,
    peakValue: params.lotSizeUsd * params.maxLots,
    maxCapitalDeployed: 0,
    rejectedBuys: 0,
    rejectedBuyValues: 0,

    // Daily tracking
    dailyPortfolioValues: [],

    // ... add ALL other state variables from lines 799-853
  };
}
```

---

## Phase 4: Create Executor Factory

```javascript
function createDCAExecutor(symbol, params, pricesWithIndicators, verbose = false, adaptiveStrategy = null) {
  // Initialize state
  const state = initializeDCAState(params, pricesWithIndicators, verbose);

  // Clone params to track changes
  const currentParams = { ...params };

  return {
    /**
     * Process one day of trading
     */
    processDay: async (dayData, dayIndex, context = { buyEnabled: true }) => {
      return await processOneDayOfTrading(
        state,
        params,
        currentParams,
        pricesWithIndicators,
        dayData,
        dayIndex,
        context,
        verbose,
        adaptiveStrategy
      );
    },

    /**
     * Get current state (for debugging/inspection)
     */
    getState: () => state,

    /**
     * Get final results (call after all days processed)
     */
    getResults: () => {
      // Calculate final metrics from state
      const capitalDeployed = state.lots.reduce((sum, lot) =>
        sum + (lot.shares * lot.price), 0
      );

      const lastPrice = pricesWithIndicators[pricesWithIndicators.length - 1].close;
      const marketValue = state.lots.reduce((sum, lot) =>
        sum + (lot.shares * lastPrice), 0
      );

      state.unrealizedPNL = marketValue - capitalDeployed;
      state.totalPNL = state.realizedPNL + state.unrealizedPNL;

      return {
        summary: {
          symbol,
          lotsHeld: state.lots.length,
          capitalDeployed,
          marketValue,
          unrealizedPNL: state.unrealizedPNL,
          realizedPNL: state.realizedPNL,
          totalPNL: state.totalPNL,
          totalReturn: marketValue + state.realizedPNL,
          returnPercent: state.maxCapitalDeployed > 0 ?
            (state.totalPNL / state.maxCapitalDeployed) * 100 : 0,
          maxDrawdown: state.maxDrawdown,
          maxDrawdownPercent: state.maxDrawdownPercent,
          maxCapitalDeployed: state.maxCapitalDeployed,
          rejectedBuys: state.rejectedBuys,
          rejectedBuyValues: state.rejectedBuyValues,
          buyTransactions: state.transactions.filter(t => t.type === 'BUY').length,
          sellTransactions: state.transactions.filter(t => t.type !== 'BUY').length
        },
        transactions: state.enhancedTransactions,
        lots: state.lots,
        transactionLog: verbose ? state.transactionLog : [],
        dailyPortfolioValues: state.dailyPortfolioValues
      };
    }
  };
}

module.exports = {
  createDCAExecutor
};
```

---

## Testing After Extraction

After creating dcaExecutor.js, test it by modifying runDCABacktest to use it:

```javascript
async function runDCABacktest(params, dayCallback = null) {
  // Load price data (keep existing code)
  const pricesWithIndicators = await loadPriceData(...);

  // Setup adaptive strategy (keep existing code)
  const adaptiveStrategy = params.enableScenarioDetection ?
    setupAdaptiveStrategy(...) : null;

  // Create executor using extracted module
  const executor = createDCAExecutor(
    params.symbol,
    params,
    pricesWithIndicators,
    params.verbose,
    adaptiveStrategy
  );

  // Main loop (simplified)
  for (let i = 0; i < pricesWithIndicators.length; i++) {
    const context = dayCallback ?
      await dayCallback(pricesWithIndicators[i].date, i) :
      { buyEnabled: true };

    await executor.processDay(pricesWithIndicators[i], i, context);
  }

  // Return results
  return executor.getResults();
}
```

**Test command:**
```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d @test_app_phase1_correct.json 2>/dev/null | jq '.data.summary.totalReturn'
```

**MUST produce:** `1154291.8635093626`

---

## Next Session Action

Start with Phase 1: Create the skeleton dcaExecutor.js file with dependencies and constants.
