# Spec 23: Average-Cost Grid & Sell Logic - Design

## Executive Summary

This spec implements two related features for simplified position tracking:
1. **Average-Based Grid Spacing**: Check buy grid spacing against average cost (O(1) instead of O(n))
2. **Average-Based Sell Logic**: Check sell profitability against average cost (real portfolio compatibility)

Both features are opt-in via parameters, maintaining full backward compatibility.

---

## 1. Average-Based Grid Spacing Design

### 1.1 Current Implementation

**File**: `services/dcaBacktestService.js` lines 697-736

```javascript
const respectsGridSpacing = lots.every((lot, index) => {
  const spacing = Math.abs(currentPrice - lot.price) / lot.price;
  return spacing >= gridIntervalPercent;
});
```

**Complexity**: O(n) where n = number of lots
**Issue**: With 10 lots, performs 10 comparisons per buy attempt

### 1.2 Proposed Implementation

```javascript
function checkGridSpacing(currentPrice, lots, averageCost, gridIntervalPercent) {
  // Original lot-based logic (backward compatible)
  if (!enableAverageBasedGrid) {
    return lots.every((lot) => {
      const spacing = Math.abs(currentPrice - lot.price) / lot.price;
      return spacing >= gridIntervalPercent;
    });
  }

  // New average-based logic
  // Edge case: First buy always allowed
  if (lots.length === 0) {
    return true;
  }

  // Edge case: Handle averageCost = 0
  if (averageCost === 0) {
    return true; // Should not happen if lots.length > 0, but safety check
  }

  // Asymmetric spacing: stricter when buying below average (averaging down)
  if (currentPrice < averageCost) {
    // Buying below average - require full spacing
    const spacingBelowAverage = (averageCost - currentPrice) / averageCost;
    return spacingBelowAverage >= gridIntervalPercent;
  } else {
    // Buying above average - require half spacing (more lenient)
    const spacingAboveAverage = (currentPrice - averageCost) / averageCost;
    return spacingAboveAverage >= (gridIntervalPercent * 0.5);
  }
}
```

**Rationale for Asymmetric Spacing**:
- **Below average (averaging down)**: Strict spacing prevents over-concentration at low prices
- **Above average (averaging up)**: Lenient spacing allows buying in uptrends when already profitable

### 1.3 Integration with Consecutive Buy Grid

When both `enableAverageBasedGrid` and `enableConsecutiveIncrementalBuyGrid` are true:

```javascript
// Calculate incremental grid size
const buyGridSize = calculateBuyGridSize(
  gridIntervalPercent,
  gridConsecutiveIncrement,
  consecutiveBuyCount,
  lastBuyPrice,  // Still track lastBuyPrice for consecutive count
  currentPrice,
  true
);

// Apply to average cost reference
const spacing = Math.abs(currentPrice - averageCost) / averageCost;
return spacing >= buyGridSize;
```

**Key Point**: Average cost is the reference, but incremental sizing still applies.

### 1.4 Integration with Dynamic Grid

```javascript
if (enableAverageBasedGrid && enableDynamicGrid) {
  const gridSize = calculateDynamicGridSpacing(
    currentPrice,
    averageCost,  // Use average cost as reference, not midPrice
    dynamicGridMultiplier,
    false  // Don't normalize when using average cost
  );
  const spacing = Math.abs(currentPrice - averageCost) / averageCost;
  return spacing >= gridSize;
}
```

### 1.5 Performance Analysis

| Metric | Lot-Based | Average-Based | Improvement |
|--------|-----------|---------------|-------------|
| Time Complexity | O(n) | O(1) | ~10x with 10 lots |
| Comparisons per buy | 10 (with 10 lots) | 1 | 10x fewer |
| Total backtest time | 100% | ~95% | 5% faster |

---

## 2. Average-Based Sell Logic Design

### 2.1 Current Implementation

**File**: `services/dcaBacktestService.js` lines 944-1012

```javascript
// Filter eligible lots by individual profitability
const eligibleLots = lots.filter(lot => {
  let refPrice = isConsecutiveSell ? lastSellPrice : lot.price;
  return currentPrice > refPrice * (1 + lotProfitRequirement);
});

// Select highest-priced eligible lots
const sortedEligibleLots = eligibleLots.sort((a, b) => b.price - a.price);
const lotsToSell = sortedEligibleLots.slice(0, maxLotsToSell);

// Calculate limit price
const limitPrice = Math.max(highestLotPrice, stopPrice * 0.95);
```

### 2.2 Proposed Implementation

```javascript
// Check profitability against average cost (when enabled)
const refPrice = enableAverageBasedSell
  ? averageCost
  : (isConsecutiveSell ? lastSellPrice : lot.price);

const isProfitable = currentPrice > refPrice * (1 + lotProfitRequirement);

// Lot selection
let eligibleLots;
if (enableAverageBasedSell) {
  // If profitable by average cost, ALL lots are eligible
  eligibleLots = isProfitable ? [...lots] : [];
} else {
  // Original: filter each lot individually
  eligibleLots = lots.filter(lot => {
    let lotRefPrice = isConsecutiveSell ? lastSellPrice : lot.price;
    return currentPrice > lotRefPrice * (1 + lotProfitRequirement);
  });
}

// Still select highest-priced lots (preserves FIFO behavior)
const sortedEligibleLots = eligibleLots.sort((a, b) => b.price - a.price);
const lotsToSell = sortedEligibleLots.slice(0, maxLotsToSell);

// Calculate limit price
const limitPrice = enableAverageBasedSell
  ? Math.max(averageCost * (1 + profitRequirement), stopPrice * 0.95)
  : Math.max(highestLotPrice, stopPrice * 0.95);
```

**Key Points**:
1. Profitability check uses average cost
2. But we still select specific lots to sell (highest-price first)
3. This preserves transaction history detail
4. Limit price ensures we always sell above average cost + profit requirement

### 2.3 Integration with Consecutive Sell Profit

```javascript
// Calculate incremental profit requirement
const baseProfitRequirement = profitRequirement;
const lotProfitRequirement = isConsecutiveSell && enableConsecutiveIncrementalSellProfit
  ? baseProfitRequirement + (consecutiveSellCount * (baseProfitRequirement * 0.1))
  : baseProfitRequirement;

// Reference price depends on feature flags
const refPrice = enableAverageBasedSell
  ? averageCost  // Always use average cost
  : (isConsecutiveSell ? lastSellPrice : lot.price);  // Original logic

// Profitability check
const isProfitable = currentPrice > refPrice * (1 + lotProfitRequirement);
```

**Behavior Matrix**:

| enableAverageBasedSell | enableConsecutiveSellProfit | Reference Price | Profit Requirement |
|------------------------|----------------------------|-----------------|-------------------|
| false | false | lot.price | profitRequirement |
| false | true | lastSellPrice (if consecutive) | profitRequirement + incremental |
| true | false | averageCost | profitRequirement |
| true | true | averageCost | profitRequirement + incremental |

### 2.4 Transaction History Preservation

**Critical**: Even with average-based sell, we must preserve lot detail for:
- Transaction log readability
- Tax lot tracking (FIFO/LIFO)
- Performance analysis

**Implementation**:
```javascript
// After selling lots
lotsToSell.forEach((soldLot, index) => {
  // Log individual lot details
  transactionLog.push(
    colorize(`    Lot ${index + 1}: Sold ${soldLot.shares.toFixed(4)} shares @ $${soldLot.price.toFixed(2)} -> $${executionPrice.toFixed(2)}, PNL: ${lotPNL.toFixed(2)}`, 'red')
  );

  // Store in enhanced transactions
  enhancedTransactions.push({
    date: currentDate,
    type: 'SELL',
    price: executionPrice,
    shares: soldLot.shares,
    lotPrice: soldLot.price,  // Original lot price
    lotDate: soldLot.date,    // Original lot date
    averageCost: averageCost, // For reference
    // ... other fields
  });
});
```

---

## 3. Logging & Observability

### 3.1 Feature Activation Logging

```javascript
// At start of backtest
if (enableAverageBasedGrid || enableAverageBasedSell) {
  const features = [];
  if (enableAverageBasedGrid) features.push('Average-Based Grid');
  if (enableAverageBasedSell) features.push('Average-Based Sell');
  console.log(`📊 Enabled Features: ${features.join(', ')}`);
}
```

### 3.2 Grid Spacing Logging (Verbose Mode)

```javascript
if (verbose && enableAverageBasedGrid) {
  const spacing = Math.abs(currentPrice - averageCost) / averageCost;
  const required = currentPrice < averageCost
    ? gridIntervalPercent
    : gridIntervalPercent * 0.5;
  transactionLog.push(
    colorize(`  Grid Check: Price $${currentPrice.toFixed(2)} vs Avg $${averageCost.toFixed(2)}, Spacing ${(spacing*100).toFixed(1)}% (required ${(required*100).toFixed(1)}%)`, 'cyan')
  );
}
```

### 3.3 Sell Profitability Logging

```javascript
if (enableAverageBasedSell) {
  const minProfitablePrice = averageCost * (1 + profitRequirement);
  transactionLog.push(
    colorize(`  Profitability: Price $${currentPrice.toFixed(2)} vs Avg $${averageCost.toFixed(2)} + ${(profitRequirement*100).toFixed(1)}% = $${minProfitablePrice.toFixed(2)} ${isProfitable ? '✓' : '✗'}`, 'cyan')
  );
}
```

---

## 4. API Response Format

### 4.1 New Fields in Response

```javascript
{
  success: true,
  data: {
    // ... existing fields

    // New feature flags
    averageBasedGridEnabled: true,
    averageBasedSellEnabled: false,

    // Performance metrics
    performanceMetrics: {
      gridSpacingChecks: 125,  // Number of grid spacing evaluations
      averageCheckTime: 0.05,  // ms (vs 0.5ms for lot-based)
      // ... other metrics
    },

    // Average cost tracking (for UI display)
    averageCostHistory: [
      { date: '2024-01-03', averageCost: 21.87, lots: 1 },
      { date: '2024-01-15', averageCost: 25.50, lots: 2 },
      // ... after each buy/sell
    ]
  }
}
```

### 4.2 Transaction Log Format

No changes to transaction log format - individual lot details are still included even when using average-based logic.

---

## 5. Parameter Validation

### 5.1 Backend Validation

```javascript
function validateParams(params) {
  // ... existing validations

  // New parameter validation
  if (params.enableAverageBasedGrid !== undefined) {
    if (typeof params.enableAverageBasedGrid !== 'boolean') {
      throw new Error('enableAverageBasedGrid must be boolean');
    }
  }

  if (params.enableAverageBasedSell !== undefined) {
    if (typeof params.enableAverageBasedSell !== 'boolean') {
      throw new Error('enableAverageBasedSell must be boolean');
    }
  }

  // Batch mode: can be arrays
  if (Array.isArray(params.enableAverageBasedGrid)) {
    if (!params.enableAverageBasedGrid.every(v => typeof v === 'boolean')) {
      throw new Error('enableAverageBasedGrid array must contain only booleans');
    }
  }

  if (Array.isArray(params.enableAverageBasedSell)) {
    if (!params.enableAverageBasedSell.every(v => typeof v === 'boolean')) {
      throw new Error('enableAverageBasedSell array must contain only booleans');
    }
  }
}
```

### 5.2 Frontend Validation

```javascript
// In batch mode UI
if (isBatchMode) {
  // These can be arrays or single values
  const allowedArrayParams = [
    'profitRequirement',
    'gridIntervalPercent',
    'enableAverageBasedGrid',  // NEW
    'enableAverageBasedSell',  // NEW
    // ... other params
  ];
}
```

---

## 6. Test Strategy

### 6.1 Unit Tests

```javascript
describe('Average-Based Grid Spacing', () => {
  test('first buy always allowed', () => {
    const result = checkGridSpacing(50, [], 0, 0.10);
    expect(result).toBe(true);
  });

  test('buying below average requires full spacing', () => {
    // Average cost: $50, grid: 10%
    // Buy at $44 (12% below) → ALLOWED
    const result = checkGridSpacing(44, [{price:50, shares:100}], 50, 0.10);
    expect(result).toBe(true);

    // Buy at $46 (8% below) → BLOCKED
    const result2 = checkGridSpacing(46, [{price:50, shares:100}], 50, 0.10);
    expect(result2).toBe(false);
  });

  test('buying above average requires half spacing', () => {
    // Average cost: $50, grid: 10% (half = 5%)
    // Buy at $53 (6% above) → ALLOWED
    const result = checkGridSpacing(53, [{price:50, shares:100}], 50, 0.10);
    expect(result).toBe(true);

    // Buy at $52 (4% above) → BLOCKED
    const result2 = checkGridSpacing(52, [{price:50, shares:100}], 50, 0.10);
    expect(result2).toBe(false);
  });
});

describe('Average-Based Sell Logic', () => {
  test('profitability check against average cost', () => {
    // Average cost: $50, profit requirement: 10%
    // Current price: $56 (12% above) → PROFITABLE
    const isProfitable = checkSellProfitability(56, 50, 0.10);
    expect(isProfitable).toBe(true);

    // Current price: $54 (8% above) → NOT PROFITABLE
    const isProfitable2 = checkSellProfitability(54, 50, 0.10);
    expect(isProfitable2).toBe(false);
  });

  test('still selects highest-priced lots', () => {
    const lots = [
      {price: 45, shares: 50},
      {price: 50, shares: 50},
      {price: 55, shares: 50}
    ];
    const lotsToSell = selectLotsToSell(lots, 60, 50, 0.10, 2, true);

    expect(lotsToSell).toHaveLength(2);
    expect(lotsToSell[0].price).toBe(55); // Highest first
    expect(lotsToSell[1].price).toBe(50); // Second highest
  });
});
```

### 6.2 Integration Tests

```javascript
describe('Full Backtest Integration', () => {
  test('backward compatibility: same results when disabled', async () => {
    const paramsOriginal = { /* ... standard params */ };
    const paramsWithFeature = {
      ...paramsOriginal,
      enableAverageBasedGrid: false,
      enableAverageBasedSell: false
    };

    const result1 = await runDCABacktest(paramsOriginal);
    const result2 = await runDCABacktest(paramsWithFeature);

    expect(result1.totalReturn).toBeCloseTo(result2.totalReturn, 2);
    expect(result1.trades).toEqual(result2.trades);
  });

  test('real portfolio scenario', async () => {
    // User has 100 shares @ average cost $50
    const params = {
      symbol: 'TEST',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      // Simulate existing position
      initialLots: [{ price: 50, shares: 100, date: '2023-01-01' }],
      lotSizeUsd: 5000,
      maxLots: 5,
      gridIntervalPercent: 0.10,
      profitRequirement: 0.10,
      enableAverageBasedGrid: true,
      enableAverageBasedSell: true
    };

    const result = await runDCABacktest(params);

    // Verify algorithm respects average cost
    expect(result.success).toBe(true);
    expect(result.data.averageCostHistory).toBeDefined();
  });
});
```

### 6.3 Performance Benchmarks

```javascript
describe('Performance', () => {
  test('average-based grid is faster', async () => {
    const params = {
      symbol: 'PLTR',
      startDate: '2021-09-01',
      endDate: '2025-01-01',
      maxLots: 10  // Larger position for meaningful test
    };

    const start1 = Date.now();
    const result1 = await runDCABacktest({ ...params, enableAverageBasedGrid: false });
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    const result2 = await runDCABacktest({ ...params, enableAverageBasedGrid: true });
    const time2 = Date.now() - start2;

    // Should be at least 5% faster
    expect(time2).toBeLessThan(time1 * 0.95);
  });
});
```

---

## 7. Implementation Checklist

### Backend Changes
- [ ] Add `enableAverageBasedGrid` and `enableAverageBasedSell` parameters
- [ ] Implement `checkGridSpacing()` with average cost logic
- [ ] Implement sell profitability check with average cost logic
- [ ] Handle edge cases (first buy, averageCost = 0, etc.)
- [ ] Integrate with consecutive incremental features
- [ ] Add logging for feature activation and verbose details
- [ ] Update API response format with new fields
- [ ] Add parameter validation

### Frontend Changes
- [ ] Add checkboxes in parameter UI
- [ ] Add tooltips explaining features
- [ ] Update batch mode UI to support new parameters
- [ ] Display average cost in results (optional enhancement)

### Testing
- [ ] Unit tests for grid spacing logic
- [ ] Unit tests for sell logic
- [ ] Integration tests for full backtests
- [ ] Performance benchmarks
- [ ] Backward compatibility tests
- [ ] Edge case tests

### Documentation
- [ ] Update API documentation
- [ ] Create user guide with examples
- [ ] Update CLAUDE.md with new features
- [ ] Create migration guide

---

## 8. Rollout Plan

### Week 1: Average-Based Grid
- Implement grid spacing logic
- Unit tests
- Integration tests
- Code review

### Week 2: Average-Based Sell
- Implement sell profitability logic
- Unit tests
- Integration tests
- Code review

### Week 3: Polish & Deploy
- Frontend UI
- Documentation
- Performance benchmarks
- Beta testing
- Production deployment

---

## Summary

This spec implements two focused features for simplified position tracking:

1. **Average-Based Grid**: O(1) grid checks, 5-10% faster backtests
2. **Average-Based Sell**: Real portfolio compatibility with average cost tracking

Both features are opt-in, maintain full backward compatibility, and integrate cleanly with existing features (consecutive incremental, dynamic grid).

**Next**: Spec 24 will handle Dynamic Profile Switching independently.
