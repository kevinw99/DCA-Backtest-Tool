# Option 3: Major Refactoring Plan

## Objective

Extract `processOneDayOfTrading` and all its dependencies from `runDCABacktest` closure into standalone, reusable code that both Individual DCA and Portfolio can call.

## Test Results Proving Need

**Individual DCA (APP)**: $1,154,291.86 total return (38+ buys, many sells)
**Portfolio (1 stock APP)**: $54,653.90 total return (38 buys, 0 sells)

**20x performance difference** - Portfolio is missing Individual DCA's complete algorithm.

## Scope Analysis

### Code to Extract

**From dcaBacktestService.js:**

1. **processOneDayOfTrading function** (lines 1852-2290, ~438 lines)
2. **Helper functions** (~30 functions, ~1200 lines):
   - `recalculateAverageCost()`
   - `calculatePositionStatus()`
   - `assessMarketCondition()`
   - `colorize()`
   - `setupAdaptiveStrategy()`
   - `setupTrailingStops()`
   - Signal evaluation functions
   - Transaction execution functions
   - Metrics calculation functions
   - And ~20 more...

3. **State initialization** (lines 798-877, ~200 lines):
   - lots, transactions, signals
   - dcaState, adaptiveStrategy
   - Trailing stops, metrics tracking
   - And ~30 more state variables

**Total**: ~1800 lines

### State Variables Required

From closure analysis (lines 798-1850), `processOneDayOfTrading` accesses:

```javascript
// Core state
lots, transactions, enhancedTransactions
lotCounter, transactionLog

// DCA state
dcaState (object with ~15 properties)
currentParams, originalParams

// Metrics
unrealizedPNL, realizedPNL, totalPNL
maxDrawdown, maxDrawdownPercent
peakValue, maxCapitalDeployed
rejectedBuys, rejectedBuyValues

// Strategy state
adaptiveStrategy
positionStatus, portfolioUnrealizedPNL, positionThreshold

// Configuration
params, pricesWithIndicators
verbose, colorizedEnabled

// ~80+ total variables
```

## Refactoring Strategy

### Phase 1: Create DCA Executor Module

**New file**: `/backend/services/dcaExecutor.js`

This module will contain:
1. All extracted helper functions
2. `createDCAExecutor(symbol, params, pricesWithIndicators)` function
3. Returns executor object with `processDay()`, `getState()`, `getResults()` methods

### Phase 2: Modify Individual DCA to Use Executor

**Modify**: `/backend/services/dcaBacktestService.js`

1. Import `createDCAExecutor` from dcaExecutor.js
2. Refactor `runDCABacktest` to use executor:
   ```javascript
   async function runDCABacktest(params, dayCallback = null) {
     // Load price data
     const pricesWithIndicators = await loadPriceData(...);

     // Create executor
     const executor = createDCAExecutor(params.symbol, params, pricesWithIndicators);

     // Main loop
     for (let i = 0; i < pricesWithIndicators.length; i++) {
       const context = dayCallback ?
         await dayCallback(pricesWithIndicators[i].date, i) :
         { buyEnabled: true };

       executor.processDay(pricesWithIndicators[i], i, context);
     }

     // Return results
     return executor.getResults();
   }
   ```

### Phase 3: Modify Portfolio to Use Executor

**Modify**: `/backend/services/portfolioBacktestService.js`

1. Import `createDCAExecutor` from dcaExecutor.js
2. Replace `processBuys`/`processSells` with executor calls:
   ```javascript
   // Initialize executors for each stock
   const executors = new Map();
   for (const stockConfig of config.stocks) {
     const priceData = priceDataMap.get(stockConfig.symbol);
     const executor = createDCAExecutor(stockConfig.symbol, stockParams, priceDataArray);
     executors.set(stockConfig.symbol, executor);
   }

   // Main chronological loop
   for (let i = 0; i < allDates.length; i++) {
     const date = allDates[i];

     for (const [symbol, executor] of executors) {
       const dayData = priceDataMap.get(symbol).get(date);
       if (!dayData) continue;

       const hasCapital = portfolio.cashReserve >= config.lotSizeUsd;
       const result = executor.processDay(dayData, i, { buyEnabled: hasCapital });

       // Update portfolio capital
       if (result.bought) {
         portfolio.cashReserve -= result.capitalUsed;
         portfolio.deployedCapital += result.capitalUsed;
       }
       if (result.sold) {
         portfolio.cashReserve += result.capitalReleased;
         portfolio.deployedCapital -= result.capitalReleased;
       }
     }
   }
   ```

## Implementation Steps

### Step 1: Extract Helper Functions (FIRST)

Create `/backend/services/dcaExecutorHelpers.js` with all helper functions:
- Start with the simplest helpers (colorize, calculatePositionStatus, etc.)
- Make them standalone (no closure dependencies)
- Export as module

### Step 2: Extract State Initialization

Create state initialization function:
```javascript
function initializeDCAState(params, pricesWithIndicators) {
  return {
    // Core state
    lots: [],
    transactions: [],
    lotCounter: 0,

    // DCA state
    dcaState: { /* ... */ },

    // Metrics
    unrealizedPNL: 0,
    realizedPNL: 0,
    // ... all ~80 variables
  };
}
```

### Step 3: Extract processOneDayOfTrading

Convert arrow function to standalone:
```javascript
function processOneDayOfTrading(state, dayData, dayIndex, context) {
  // Same logic as current, but:
  // - Access state via state parameter
  // - Call helpers via imports
  // - Return transaction results

  return {
    bought: false,
    sold: false,
    capitalUsed: 0,
    capitalReleased: 0,
    transaction: null
  };
}
```

### Step 4: Create createDCAExecutor

```javascript
function createDCAExecutor(symbol, params, pricesWithIndicators) {
  const state = initializeDCAState(params, pricesWithIndicators);

  return {
    processDay: (dayData, i, context) => {
      return processOneDayOfTrading(state, dayData, i, context);
    },

    getState: () => state,

    getResults: () => {
      return calculateFinalResults(state, symbol, params, pricesWithIndicators);
    }
  };
}
```

### Step 5: Test Individual DCA Baseline

After each change:
```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d @test_app_phase1_correct.json 2>/dev/null | jq '.data.summary.totalReturn'
```

Must produce: `1154291.8635093626`

### Step 6: Refactor Portfolio

Replace Portfolio's trading logic with executor calls.

### Step 7: Test Portfolio with 1 Stock

```bash
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d @/tmp/portfolio_app_only.json 2>/dev/null | jq '.data.portfolioSummary.totalReturn'
```

Should produce: ~`1154291.86` (match Individual DCA)

## Risk Mitigation

1. **Backup before starting**:
   ```bash
   cp backend/services/dcaBacktestService.js backend/services/dcaBacktestService.js.before-refactor
   ```

2. **Test after every change**: Run APP baseline test

3. **Incremental approach**: Extract one helper at a time

4. **Rollback plan**: Keep backup, use git to revert if needed

## Success Criteria

✅ Individual DCA baseline: $1,154,291.86
✅ Portfolio with 1 stock: $1,154,291.86 (must match!)
✅ Portfolio with multiple stocks: Works with capital gating
✅ No code duplication: Both use exact same code path
✅ All Individual DCA features work in Portfolio context

## Estimated Effort

- **Step 1-4**: 2-3 hours (extraction and refactoring)
- **Step 5**: 30 min (testing Individual DCA)
- **Step 6**: 1 hour (refactor Portfolio)
- **Step 7**: 30 min (testing Portfolio)

**Total**: 4-5 hours

## Next Action

Start with Step 1: Extract the simplest helper functions first to validate the approach.
