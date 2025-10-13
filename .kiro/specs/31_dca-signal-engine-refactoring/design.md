# Design: DCA Signal Engine Refactoring

## Overview

Refactor the DCA trading logic into a shared, pure functional signal engine that can be used by both individual and portfolio backtest implementations. This eliminates code duplication while preserving the unique orchestration needs of each implementation.

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Backtest Orchestration Layer              │
├──────────────────────────┬──────────────────────────────────┤
│  Individual DCA          │  Portfolio DCA                    │
│  - Full simulation loop  │  - Multi-stock coordination       │
│  - Adaptive strategies   │  - Capital pool management        │
│  - Scenario detection    │  - Cross-stock execution order    │
│  - State persistence     │  - Order rejection tracking       │
└──────────────────────────┴──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   DCA Signal Engine (Pure Functions)         │
├─────────────────────────────────────────────────────────────┤
│  Signal Evaluation:                                          │
│  - evaluateBuySignal()   - evaluateSellSignal()             │
│  - evaluateTrailingStop()                                   │
│                                                              │
│  Lot Management:                                             │
│  - selectLotsToSell()    - filterProfitableLots()          │
│  - calculateLotProfit()                                     │
│                                                              │
│  Grid Calculations:                                          │
│  - calculateBuyGrid()    - calculateSellGrid()              │
│  - determineGridPosition()                                  │
│                                                              │
│  State Transformations:                                      │
│  - applyBuyTransaction() - applySellTransaction()           │
│  - updatePeakTracking()                                     │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                Technical Indicators (Existing)               │
├─────────────────────────────────────────────────────────────┤
│  - SMA, EMA, RSI, MACD, Bollinger Bands, ATR               │
│  (Already in technicalIndicators.js)                        │
└─────────────────────────────────────────────────────────────┘
```

### Module Structure

```
backend/
├── services/
│   ├── dcaBacktestService.js          # Individual DCA orchestration
│   ├── portfolioBacktestService.js    # Portfolio orchestration
│   ├── dcaSignalEngine.js             # NEW: Core trading logic (pure functions)
│   ├── technicalIndicators.js         # Existing indicators
│   └── ...
```

## Detailed Design

### 1. DCA Signal Engine Module

**File**: `backend/services/dcaSignalEngine.js`

This module contains pure functions with NO side effects. All functions follow the pattern:
```javascript
function functionName(input1, input2, ...) {
  // Pure computation
  return result;
}
```

#### 1.1 Signal Evaluation Functions

**evaluateBuySignal**
```javascript
/**
 * Evaluate if a buy signal should trigger
 * @param {Object} state - Current trading state
 * @param {Object} params - Trading parameters
 * @param {number} currentPrice - Current market price
 * @param {Object} indicators - Technical indicators
 * @returns {Object} { triggered: boolean, reason: string, gridLevel: number, ... }
 */
function evaluateBuySignal(state, params, currentPrice, indicators) {
  // Check max lots constraint
  if (state.lots.length >= params.maxLots) {
    return { triggered: false, reason: 'Max lots reached' };
  }

  // Calculate buy grid level
  const averageCost = calculateAverageCost(state.lots);
  const gridLevel = calculateBuyGridLevel(averageCost, params.gridIntervalPercent, state.consecutiveBuys);

  // Check if price is below grid level
  if (currentPrice >= gridLevel) {
    return { triggered: false, reason: 'Price above buy grid' };
  }

  // Additional checks (trailing buy, indicators, etc.)
  // ...

  return {
    triggered: true,
    reason: 'Price below buy grid',
    gridLevel,
    consecutiveBuys: state.consecutiveBuys + 1
  };
}
```

**evaluateSellSignal**
```javascript
/**
 * Evaluate if a sell signal should trigger
 * @param {Object} state - Current trading state
 * @param {Object} params - Trading parameters
 * @param {number} currentPrice - Current market price
 * @param {Object} indicators - Technical indicators
 * @returns {Object} { triggered: boolean, reason: string, lotsToSell: Array, ... }
 */
function evaluateSellSignal(state, params, currentPrice, indicators) {
  // No lots to sell
  if (state.lots.length === 0) {
    return { triggered: false, reason: 'No lots to sell' };
  }

  // Find profitable lots
  const profitableLots = filterProfitableLots(state.lots, currentPrice, params.profitRequirement);

  if (profitableLots.length === 0) {
    return { triggered: false, reason: 'No profitable lots' };
  }

  // Select lots to sell (LIFO by default)
  const lotsToSell = selectLotsToSell(profitableLots, params.lotSelectionStrategy || 'LIFO');

  return {
    triggered: true,
    reason: 'Profitable lots available',
    lotsToSell,
    consecutiveSells: state.consecutiveSells + 1
  };
}
```

**evaluateTrailingStop**
```javascript
/**
 * Evaluate trailing stop conditions
 * @param {Object} state - Current trading state
 * @param {Object} params - Trading parameters (trailingStopActivation, trailingStopDistance)
 * @param {number} currentPrice - Current market price
 * @returns {Object} { triggered: boolean, reason: string, lotsToSell: Array, stopPrice: number }
 */
function evaluateTrailingStop(state, params, currentPrice) {
  if (!params.trailingSell) {
    return { triggered: false, reason: 'Trailing stop not enabled' };
  }

  if (state.lots.length === 0) {
    return { triggered: false, reason: 'No lots to evaluate' };
  }

  // Check each lot for trailing stop activation
  const lotsToSell = [];

  for (const lot of state.lots) {
    const profitPercent = ((currentPrice - lot.price) / lot.price) * 100;

    // Check if activation threshold met
    if (profitPercent < params.trailingStopActivation) {
      continue;
    }

    // Get peak price for this lot
    const peakPrice = state.peakPrices?.[lot.id] || currentPrice;
    const pullbackPercent = ((peakPrice - currentPrice) / peakPrice) * 100;

    // Check if pullback exceeds distance threshold
    if (pullbackPercent >= params.trailingStopDistance) {
      lotsToSell.push(lot);
    }
  }

  if (lotsToSell.length === 0) {
    return { triggered: false, reason: 'No trailing stop conditions met' };
  }

  return {
    triggered: true,
    reason: 'Trailing stop triggered',
    lotsToSell,
    stopPrice: currentPrice
  };
}
```

#### 1.2 Lot Management Functions

**selectLotsToSell**
```javascript
/**
 * Select lots to sell based on strategy (LIFO, FIFO, etc.)
 * @param {Array} lots - Available lots
 * @param {string} strategy - Selection strategy ('LIFO', 'FIFO', 'HIGHEST_PROFIT')
 * @returns {Array} Selected lots
 */
function selectLotsToSell(lots, strategy = 'LIFO') {
  if (lots.length === 0) return [];

  switch (strategy) {
    case 'LIFO':
      // Return the most recent lot (last in, first out)
      return [lots[lots.length - 1]];

    case 'FIFO':
      // Return the oldest lot (first in, first out)
      return [lots[0]];

    case 'HIGHEST_PROFIT':
      // Return lot with highest profit percentage
      return [lots.reduce((max, lot) =>
        lot.profitPercent > max.profitPercent ? lot : max
      )];

    default:
      return [lots[lots.length - 1]]; // Default to LIFO
  }
}
```

**filterProfitableLots**
```javascript
/**
 * Filter lots that meet minimum profit requirement
 * @param {Array} lots - All lots
 * @param {number} currentPrice - Current market price
 * @param {number} minProfitPercent - Minimum profit percentage
 * @returns {Array} Profitable lots with profit info
 */
function filterProfitableLots(lots, currentPrice, minProfitPercent) {
  return lots
    .map(lot => ({
      ...lot,
      profitPercent: calculateLotProfitPercent(lot, currentPrice)
    }))
    .filter(lot => lot.profitPercent >= minProfitPercent);
}
```

**calculateLotProfitPercent**
```javascript
/**
 * Calculate profit percentage for a lot
 * @param {Object} lot - Lot object with price
 * @param {number} currentPrice - Current market price
 * @returns {number} Profit percentage
 */
function calculateLotProfitPercent(lot, currentPrice) {
  return ((currentPrice - lot.price) / lot.price) * 100;
}
```

#### 1.3 Grid Calculation Functions

**calculateBuyGridLevel**
```javascript
/**
 * Calculate the buy grid level (price threshold for next buy)
 * @param {number} averageCost - Average cost of existing lots
 * @param {number} gridIntervalPercent - Grid interval percentage
 * @param {number} consecutiveBuys - Number of consecutive buys
 * @returns {number} Buy grid price
 */
function calculateBuyGridLevel(averageCost, gridIntervalPercent, consecutiveBuys = 0) {
  if (!averageCost || averageCost === 0) {
    return 0; // No grid level for first buy
  }

  // Apply incremental grid adjustment for consecutive buys
  const adjustedInterval = gridIntervalPercent * (1 + consecutiveBuys * 0.1);

  return averageCost * (1 - adjustedInterval);
}
```

**calculateSellGridLevel**
```javascript
/**
 * Calculate the sell grid level (target price for selling a lot)
 * @param {number} lotCost - Cost basis of the lot
 * @param {number} profitRequirement - Required profit percentage
 * @param {number} consecutiveSells - Number of consecutive sells
 * @returns {number} Sell grid price
 */
function calculateSellGridLevel(lotCost, profitRequirement, consecutiveSells = 0) {
  // Apply incremental profit adjustment for consecutive sells
  const adjustedProfit = profitRequirement * (1 + consecutiveSells * 0.1);

  return lotCost * (1 + adjustedProfit);
}
```

**calculateAverageCost**
```javascript
/**
 * Calculate average cost of all lots
 * @param {Array} lots - Array of lot objects
 * @returns {number} Average cost per share
 */
function calculateAverageCost(lots) {
  if (lots.length === 0) return 0;

  const totalCost = lots.reduce((sum, lot) => sum + (lot.price * lot.shares), 0);
  const totalShares = lots.reduce((sum, lot) => sum + lot.shares, 0);

  return totalShares > 0 ? totalCost / totalShares : 0;
}
```

#### 1.4 State Transformation Functions

**applyBuyTransaction**
```javascript
/**
 * Apply a buy transaction to the state
 * @param {Object} state - Current trading state
 * @param {Object} transaction - Buy transaction details
 * @returns {Object} New state (immutable)
 */
function applyBuyTransaction(state, transaction) {
  const newLot = {
    id: generateLotId(),
    price: transaction.price,
    shares: transaction.shares,
    date: transaction.date,
    value: transaction.value
  };

  return {
    ...state,
    lots: [...state.lots, newLot],
    consecutiveBuys: state.consecutiveBuys + 1,
    consecutiveSells: 0, // Reset sell counter
    totalInvested: state.totalInvested + transaction.value
  };
}
```

**applySellTransaction**
```javascript
/**
 * Apply a sell transaction to the state
 * @param {Object} state - Current trading state
 * @param {Object} transaction - Sell transaction details
 * @param {Array} lotsToRemove - Lots being sold
 * @returns {Object} New state (immutable)
 */
function applySellTransaction(state, transaction, lotsToRemove) {
  const lotIds = lotsToRemove.map(lot => lot.id);
  const remainingLots = state.lots.filter(lot => !lotIds.includes(lot.id));

  return {
    ...state,
    lots: remainingLots,
    consecutiveSells: state.consecutiveSells + 1,
    consecutiveBuys: 0, // Reset buy counter
    totalRealized: state.totalRealized + transaction.pnl
  };
}
```

**updatePeakTracking**
```javascript
/**
 * Update peak prices for trailing stop tracking
 * @param {Object} state - Current trading state
 * @param {number} currentPrice - Current market price
 * @returns {Object} New state with updated peaks
 */
function updatePeakTracking(state, currentPrice) {
  const peakPrices = { ...state.peakPrices };

  for (const lot of state.lots) {
    const currentPeak = peakPrices[lot.id] || lot.price;
    peakPrices[lot.id] = Math.max(currentPeak, currentPrice);
  }

  return {
    ...state,
    peakPrices
  };
}
```

### 2. Integration with Individual DCA

**File**: `backend/services/dcaBacktestService.js`

The individual DCA service will be refactored to use the signal engine while maintaining its complex orchestration:

**Before:**
```javascript
// Lines 1845+: Direct implementation
for (let i = 0; i < pricesWithIndicators.length; i++) {
  const dayData = pricesWithIndicators[i];

  // Inline buy signal logic
  if (lots.length < params.maxLots && currentPrice < buyGridLevel) {
    executeBuy();
  }

  // Inline sell signal logic
  const profitableLots = lots.filter(lot => ...);
  if (profitableLots.length > 0) {
    executeSell();
  }
}
```

**After:**
```javascript
const dcaEngine = require('./dcaSignalEngine');

// Lines 1845+: Use signal engine
for (let i = 0; i < pricesWithIndicators.length; i++) {
  const dayData = pricesWithIndicators[i];

  // Evaluate sell first (using engine)
  const sellSignal = dcaEngine.evaluateSellSignal(state, params, currentPrice, indicators);
  if (sellSignal.triggered) {
    executeSell(sellSignal);
  }

  // Evaluate trailing stop (using engine)
  const trailingStopSignal = dcaEngine.evaluateTrailingStop(state, params, currentPrice);
  if (trailingStopSignal.triggered) {
    executeSell(trailingStopSignal);
  }

  // Evaluate buy (using engine)
  const buySignal = dcaEngine.evaluateBuySignal(state, params, currentPrice, indicators);
  if (buySignal.triggered) {
    executeBuy(buySignal);
  }

  // Update state (using engine)
  state = dcaEngine.updatePeakTracking(state, currentPrice);
}
```

### 3. Integration with Portfolio DCA

**File**: `backend/services/portfolioBacktestService.js`

The portfolio service will use the same signal engine with its capital-aware orchestration:

**Before:**
```javascript
// Lines 461+: Inline buy signal logic
evaluateBuySignal(stock, currentPrice) {
  if (stock.lots.length >= stock.params.maxLots) {
    return { triggered: false };
  }

  const averageCost = this.calculateAverageCost(stock.lots);
  const buyGridLevel = averageCost * (1 - stock.params.gridIntervalPercent);

  if (currentPrice >= buyGridLevel) {
    return { triggered: false };
  }

  return { triggered: true, gridLevel: buyGridLevel };
}
```

**After:**
```javascript
const dcaEngine = require('./dcaSignalEngine');

// Lines 461+: Use signal engine
evaluateBuySignal(stock, currentPrice) {
  const state = {
    lots: stock.lots,
    consecutiveBuys: stock.consecutiveBuys || 0,
    consecutiveSells: stock.consecutiveSells || 0
  };

  return dcaEngine.evaluateBuySignal(state, stock.params, currentPrice, {});
}
```

## Data Structures

### State Object
```javascript
{
  lots: [
    {
      id: 'lot-1',
      price: 100.50,
      shares: 10,
      date: '2024-01-01',
      value: 1005.00
    }
  ],
  consecutiveBuys: 2,
  consecutiveSells: 0,
  totalInvested: 2000.00,
  totalRealized: 150.00,
  peakPrices: {
    'lot-1': 110.00,
    'lot-2': 115.00
  }
}
```

### Parameters Object
```javascript
{
  maxLots: 10,
  gridIntervalPercent: 0.10,  // 10%
  profitRequirement: 0.10,    // 10%
  stopLoss: 0.30,             // 30%
  trailingSell: true,
  trailingStopActivation: 0.20,  // 20%
  trailingStopDistance: 0.10,    // 10%
  lotSelectionStrategy: 'LIFO'
}
```

### Signal Result Objects

**Buy Signal:**
```javascript
{
  triggered: true,
  reason: 'Price below buy grid',
  gridLevel: 90.00,
  consecutiveBuys: 3
}
```

**Sell Signal:**
```javascript
{
  triggered: true,
  reason: 'Profitable lots available',
  lotsToSell: [{ id: 'lot-1', ... }],
  consecutiveSells: 2
}
```

**Trailing Stop Signal:**
```javascript
{
  triggered: true,
  reason: 'Trailing stop triggered',
  lotsToSell: [{ id: 'lot-1', ... }],
  stopPrice: 105.00
}
```

## Testing Strategy

### Unit Tests for Signal Engine

Each pure function can be tested in isolation:

```javascript
describe('dcaSignalEngine', () => {
  describe('evaluateBuySignal', () => {
    it('should trigger when price below grid and lots < maxLots', () => {
      const state = { lots: [{ price: 100, shares: 10 }], consecutiveBuys: 0 };
      const params = { maxLots: 10, gridIntervalPercent: 0.10 };
      const result = dcaEngine.evaluateBuySignal(state, params, 85, {});

      expect(result.triggered).toBe(true);
      expect(result.gridLevel).toBe(90);
    });

    it('should not trigger when max lots reached', () => {
      const state = { lots: Array(10).fill({ price: 100 }), consecutiveBuys: 0 };
      const params = { maxLots: 10, gridIntervalPercent: 0.10 };
      const result = dcaEngine.evaluateBuySignal(state, params, 85, {});

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('Max lots reached');
    });
  });

  // Similar tests for other functions...
});
```

### Integration Tests

Test that both individual and portfolio backtests produce same results after refactoring:

```javascript
describe('Backtest Integration', () => {
  it('should produce identical results before/after refactoring', async () => {
    const params = { /* test params */ };
    const beforeResults = await runOldIndividualBacktest(params);
    const afterResults = await runNewIndividualBacktest(params);

    expect(afterResults).toEqual(beforeResults);
  });
});
```

## Performance Considerations

1. **Function Call Overhead**: Pure functions add some overhead, but should be negligible
2. **Immutability**: State transformations create new objects, but JavaScript is optimized for this
3. **Hot Path Optimization**: Profile to identify any bottlenecks
4. **Benchmark Before/After**: Ensure no significant regression

## Migration Strategy

1. **Create New Module**: Build dcaSignalEngine.js with all pure functions
2. **Test Standalone**: Unit test all engine functions
3. **Refactor Portfolio First**: Simpler codebase, easier to validate
4. **Validate Portfolio**: Run full test suite + manual verification
5. **Refactor Individual DCA**: More complex, but can reference portfolio approach
6. **Validate Individual**: Ensure all tests pass, compare results
7. **Remove Old Code**: Clean up duplicated logic once confident
8. **Documentation**: Update architecture docs

## Rollback Plan

If issues arise:
1. Keep old code alongside new code temporarily
2. Add feature flag to switch between implementations
3. Can revert individual files if needed
4. Comprehensive test coverage catches regressions early

## Documentation

Update the following:
- Architecture overview diagram
- API documentation (no changes, but document internal refactoring)
- Developer guide with new module structure
- Code comments explaining signal engine usage
