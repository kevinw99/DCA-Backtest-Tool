# Phase 2 Implementation Plan: Portfolio Calls Individual DCA

## Current Status (Completed)

✅ **Phase 1 Complete**
- Extracted `processOneDayOfTrading()` from Individual DCA (dcaBacktestService.js lines 1852-2290)
- Added `context.buyEnabled` parameter for capital gating
- Baseline tests confirmed: APP and TSLA produce identical results

✅ **Supporting Tasks Complete**
- Fixed API test command display (curl POST instead of GET URL)
- Updated requirements.md with curl test examples
- All changes committed

## Phase 2 Objective

Refactor Portfolio backtest to call Individual DCA's `processOneDayOfTrading()` instead of using its own trading logic.

**Key Change:**
```
BEFORE: Portfolio has processBuys() and processSells() with grid-based logic
AFTER:  Portfolio calls Individual DCA's processOneDayOfTrading(dayData, index, { buyEnabled })
```

## Architecture Understanding

### Current Portfolio Structure

**File:** `/backend/services/portfolioBacktestService.js` (575 lines)

**Key Components:**
1. `PortfolioState` class (lines 19-80) - Manages capital pool
2. `StockState` class (lines 85-192) - Tracks individual stock holdings
3. `runPortfolioBacktest()` (lines 207-297) - Main orchestration
4. `processSells()` (lines 335-367) - **TO BE REPLACED**
5. `processSells()` (lines 372-430) - **TO BE REPLACED**

**Main Loop (lines 239-268):**
```javascript
for (let i = 0; i < allDates.length; i++) {
  const date = allDates[i];

  // Update valuations
  for (const [symbol, stock] of portfolio.stocks) {
    const dayData = priceDataMap.get(symbol).get(date);
    if (dayData) {
      stock.updateMarketValue(dayData.close);
    }
  }

  // Process SELLS first (returns capital)
  const sellResults = await processSells(portfolio, date, priceDataMap);

  // Process BUYS (if capital available)
  const buyResults = await processBuys(portfolio, date, priceDataMap);
}
```

### Individual DCA Structure

**File:** `/backend/services/dcaBacktestService.js`

**Extracted Function:** `processOneDayOfTrading(dayData, i, context = {})` (lines 1852-2290)
- Lives inside `runDCABacktest()` closure
- Has access to all state variables (lots, transactions, signals, etc.)
- Takes `context.buyEnabled` parameter (defaults to true)
- Returns execution results

## Implementation Challenges

### Challenge 1: State Management

**Problem:** Individual DCA's `processOneDayOfTrading()` function exists inside the `runDCABacktest()` closure and accesses closure-scoped state variables.

**Implication:** Portfolio cannot directly call this function because it doesn't have access to the closure.

**Solutions:**
1. **Extract to standalone function** - Move `processOneDayOfTrading()` outside closure, pass state as parameters
2. **Create wrapper function** - Export a function that creates the closure and exposes daily execution
3. **Refactor Individual DCA** - Restructure to support external daily calls

### Challenge 2: State Initialization

**Problem:** Individual DCA initializes complex state structures (lots, transactions, signals, trailing stops, adaptive strategies, etc.)

**Current Initialization (lines 1661-1841):**
- Load price data and indicators
- Initialize lots array, transactions array
- Setup trailing stop state
- Setup adaptive strategy state
- Setup scenario detection state
- Many more features...

**Question:** How does Portfolio initialize this state for each stock?

**Options:**
1. Call Individual DCA's initialization code for each stock
2. Export initialization function from Individual DCA
3. Portfolio reimplements initialization (BAD - defeats purpose)

### Challenge 3: Transaction Accumulation

**Problem:** Portfolio needs to aggregate transactions from all stocks.

**Current:** Portfolio's `StockState` has its own `transactions` array

**After:** Individual DCA produces transactions per stock

**Solution:** Collect and merge transaction arrays from each stock's execution

## Recommended Approach

Given the challenges above, here's the recommended implementation strategy:

### Step 1: Refactor Individual DCA to Support External Calls

**Create new exported function:**
```javascript
/**
 * Create a DCA executor for a stock that can be called day-by-day
 * @returns {Object} { processDay, getState, getResults }
 */
function createDCAExecutor(symbol, params, priceData) {
  // Initialize all state (same as current runDCABacktest)
  const lots = [];
  const transactions = [];
  const signals = { /* ... */ };
  // ... all other state initialization

  // Return functions that operate on this state
  return {
    processDay: (dayData, index, context) => {
      // Same logic as current processOneDayOfTrading
      // but operates on the state in this closure
    },
    getState: () => ({ lots, transactions, signals, /* ... */ }),
    getResults: () => ({ /* compute final results */ })
  };
}

module.exports = { runDCABacktest, createDCAExecutor };
```

### Step 2: Modify Portfolio to Use createDCAExecutor

**In Portfolio's runPortfolioBacktest:**
```javascript
// 3. Initialize DCA executors for each stock
const dcaExecutors = new Map();
for (const stockConfig of config.stocks) {
  const priceData = priceDataMap.get(stockConfig.symbol);
  const executor = dcaBacktestService.createDCAExecutor(
    stockConfig.symbol,
    stockConfig.params,
    priceData
  );
  dcaExecutors.set(stockConfig.symbol, executor);
}

// 5. Simulate chronologically
for (let i = 0; i < allDates.length; i++) {
  const date = allDates[i];

  // Process each stock
  for (const [symbol, executor] of dcaExecutors) {
    const dayData = priceDataMap.get(symbol).get(date);
    if (!dayData) continue;

    // Check capital availability
    const hasCapital = portfolio.availableCapital >= config.lotSizeUsd;

    // Execute one day of DCA
    const result = executor.processDay(dayData, i, {
      buyEnabled: hasCapital
    });

    // Update portfolio capital based on results
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

// 6. Collect results from all executors
const stockResults = {};
for (const [symbol, executor] of dcaExecutors) {
  stockResults[symbol] = executor.getResults();
}
```

### Step 3: Remove Old Portfolio Trading Logic

**Delete:**
- `processBuys()` function
- `processSells()` function
- `StockState` class (or simplify to just track capital)
- Grid-based signal engine calls

**Keep:**
- `PortfolioState` class (capital management)
- Result aggregation logic
- Reporting and metrics

## Implementation Steps

1. **Backup current portfolio service**
   ```bash
   cp backend/services/portfolioBacktestService.js backend/services/portfolioBacktestService.js.backup
   ```

2. **Modify dcaBacktestService.js:**
   - Extract state initialization into separate function
   - Create `createDCAExecutor()` function
   - Export it alongside `runDCABacktest`
   - **Test:** Ensure existing Individual DCA tests still pass

3. **Modify portfolioBacktestService.js:**
   - Replace trading logic with `createDCAExecutor` calls
   - Update capital tracking to use DCA results
   - Aggregate transactions from all executors
   - **Test:** Run simple portfolio backtest

4. **Validation:**
   - Verify APP baseline still works: `$1,154,291.86 (+1648.99%)`
   - Verify TSLA baseline still works: `$69,148.32 (+115.25%)`
   - Test portfolio with 2-3 stocks
   - Verify capital constraints work correctly

## Testing Strategy

### Test 1: Individual DCA Baseline (Must Pass)
```bash
# APP test
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d @test_app_phase1.json

# Expected: $1,154,291.86 (+1648.99%)
```

### Test 2: Portfolio with 1 Stock (Should Match Individual)
```bash
# Portfolio with just APP, same capital
# Should produce similar results to Individual DCA
```

### Test 3: Portfolio with Multiple Stocks
```bash
# Portfolio with APP + TSLA + PLTR
# Verify capital constraints work
# Check for rejected orders when capital exhausted
```

## Risks and Mitigation

**Risk 1: Breaking Individual DCA**
- Mitigation: Test baseline after every change
- Rollback: Keep backup of working version

**Risk 2: Complex State Management**
- Mitigation: Use closure pattern (createDCAExecutor)
- This encapsulates state properly

**Risk 3: Performance**
- Mitigation: Individual DCA is already optimized
- Daily execution is just one iteration

## Success Criteria

✅ APP baseline test: $1,154,291.86 (+1648.99%)
✅ TSLA baseline test: $69,148.32 (+115.25%)
✅ Portfolio backtest runs without errors
✅ Capital gating works (rejected orders logged)
✅ Portfolio with 1 stock ≈ Individual DCA results
✅ All Individual DCA features work in portfolio context

## Next Session TODO

1. Read this plan document
2. Implement `createDCAExecutor()` in dcaBacktestService.js
3. Test that Individual DCA baselines still pass
4. Refactor Portfolio to use `createDCAExecutor()`
5. Test portfolio backtest
6. Commit unified architecture

## Files to Modify

- `/backend/services/dcaBacktestService.js` - Add createDCAExecutor
- `/backend/services/portfolioBacktestService.js` - Replace trading logic
- `/backend/server.js` - No changes needed (API stays same)

## Files to Reference

- `.kiro/specs/32_portfolio-calls-individual-dca/requirements.md` - Full spec
- `test_app_phase1.json` - Test parameters for APP baseline
- `test_tsla_single.json` - Test parameters for TSLA baseline (if exists)
