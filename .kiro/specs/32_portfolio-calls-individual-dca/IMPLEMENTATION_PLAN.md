# Implementation Plan - Portfolio Calls Individual DCA

## Quick Summary

**Goal:** Portfolio backtest should call Individual DCA daily for each stock, with capital availability as the only gate.

**Strategy:** Minimal invasive changes - extract and reuse, don't rewrite.

## Phase 1: Extract Daily Execution (Individual DCA)

### Changes to `dcaBacktestService.js`

**Current structure:**
```javascript
async function runBacktest(params) {
  // Setup (lines 1-1844)
  for (let i = 0; i < pricesWithIndicators.length; i++) {
    // ONE DAY OF EXECUTION (lines 1845-2277)
    const dayData = pricesWithIndicators[i];
    // ... process one day ...
  }
  // Final calculations (lines 2278-2667)
}
```

**Target structure:**
```javascript
// NEW: Extract one day of execution
function processOneDayOfTrading(dayIndex, dayData, state, params, context) {
  // All logic from lines 1845-2277
  // Returns: { state, transactions, logs }
}

async function runBacktest(params) {
  // Setup
  for (let i = 0; i < prices.length; i++) {
    const result = processOneDayOfTrading(i, prices[i], state, params, context);
    state = result.state;
    // ... aggregate results ...
  }
  // Final calculations
}
```

### Minimal Changes Approach

1. **Extract function**: Copy lines 1845-2277 into `processOneDayOfTrading()`
2. **Add context parameter**: `{ buyEnabled: true/false }`
3. **Gate buy execution**: Check `context.buyEnabled` before executing buys
4. **Return results**: State updates, transactions, logs
5. **Test**: Run baseline tests - must match exactly

## Phase 2: Refactor Portfolio (Portfolio Service)

### Changes to `portfolioBacktestService.js`

**Current**: Portfolio has own grid-based logic (~600 lines)

**Target**: Portfolio calls Individual DCA per stock

```javascript
const { processOneDayOfTrading } = require('./dcaBacktestService');

async function runPortfolioBacktest(params) {
  // Initialize per-stock state
  const stockStates = params.stocks.map(stock => initializeStockState(stock));

  for (let dayIndex = 0; dayIndex < prices.length; dayIndex++) {
    for (let stock of stockStates) {
      // Check capital availability
      const hasCapital = availableCapital >= stock.params.lotSizeUsd;

      // Call Individual DCA for this stock for this day
      const result = processOneDayOfTrading(
        dayIndex,
        stock.priceData[dayIndex],
        stock.state,
        stock.params,
        { buyEnabled: hasCapital }  // KEY PARAMETER
      );

      // Update state and capital
      stock.state = result.state;
      if (result.bought) {
        availableCapital -= result.capitalUsed;
      }
      if (result.sold) {
        availableCapital += result.capitalReleased;
      }
    }
  }
}
```

## Testing Strategy

### Baseline Tests (Phase 1)

**Must pass before Phase 2:**

1. APP test: $1,154,291.86 (+1648.99%)
2. TSLA test: $69,148.32 (+115.25%)

**Method:**
```bash
# Test before extraction
curl [APP URL] | grep "Total Return"

# Extract processOneDayOfTrading()
# Test after extraction
curl [APP URL] | grep "Total Return"

# Must match exactly!
```

### Portfolio Tests (Phase 2)

**After Portfolio refactoring:**

1. Single-stock portfolio ≈ Individual DCA (same results)
2. Multi-stock portfolio has reasonable behavior
3. Capital constraints work correctly

## Implementation Steps

### Step 1: Backup Current Implementation
- Git commit current state
- Tag as "before-unified-architecture"

### Step 2: Phase 1 - Extract Daily Execution
1. Create `processOneDayOfTrading()` function
2. Move lines 1845-2277 into function
3. Add `context.buyEnabled` parameter
4. Gate buy execution with context check
5. Return state, transactions, logs
6. Update `runBacktest()` to call new function
7. **TEST**: Run APP and TSLA baseline tests
8. **COMMIT**: "Extract daily execution from Individual DCA"

### Step 3: Phase 2 - Refactor Portfolio
1. Import `processOneDayOfTrading` from dcaBacktestService
2. Create `initializeStockState()` helper
3. Replace portfolio loop to call Individual DCA
4. Implement capital pool management
5. Aggregate results from all stocks
6. Remove old grid-based logic
7. **TEST**: Portfolio single-stock vs Individual DCA
8. **TEST**: Portfolio multi-stock behavior
9. **COMMIT**: "Refactor Portfolio to call Individual DCA"

### Step 4: Cleanup
1. Remove unused dcaSignalEngine.js (no longer needed)
2. Update documentation
3. **COMMIT**: "Clean up after unified architecture"

## Risk Mitigation

### Risk: Breaking Individual DCA
**Mitigation**: Test after every change, baseline tests must pass

### Risk: State management complexity
**Mitigation**: Minimal changes, preserve existing state structure

### Risk: Performance degradation
**Mitigation**: No extra computation, just code reorganization

## Success Criteria

✅ Phase 1:
- [ ] Baseline APP test passes: $1,154,291.86 (+1648.99%)
- [ ] Baseline TSLA test passes: $69,148.32 (+115.25%)
- [ ] All Individual DCA features still work

✅ Phase 2:
- [ ] Portfolio single-stock ≈ Individual DCA results
- [ ] Portfolio multi-stock has reasonable behavior
- [ ] Capital constraints enforced correctly
- [ ] No duplicate code between services

## Timeline

- **Phase 1**: 2-3 hours (extract + test thoroughly)
- **Phase 2**: 2-3 hours (refactor + test thoroughly)
- **Total**: 4-6 hours of careful, tested implementation

## Current Status

✅ Requirements.md created
✅ Test URLs documented
⏳ Starting Phase 1 implementation...
