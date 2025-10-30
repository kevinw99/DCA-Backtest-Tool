# Spec 52: Design Document

## Architecture Overview

This enhancement adds two major components to the Future Trades display:

1. **Holdings Display Section** - Shows current lot positions
2. **Smart Execution Status** - Validates grid requirements and shows effective execution price

### Component Stack

```
┌─────────────────────────────────────┐
│   Frontend: FutureTradeCard        │
│   (BatchResults.js)                 │
│   - Holdings Section (NEW)          │
│   - Smart Execution Status (NEW)    │
└─────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────┐
│   Backend: calculateFutureTrades    │
│   (batchBacktestService.js)         │
│   - Add grid validation (NEW)       │
│   - Add effective price calc (NEW)  │
└─────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────┐
│   Backend: DCA Executor Results     │
│   (dcaExecutor.js)                  │
│   - lots[] (already exists)         │
│   - backtestParameters (exists)     │
└───────────────────────────────────── ┘
```

## Current State Analysis

### Data Already Available

From batch backtest results, we already have:

```javascript
result = {
  lots: [
    { price: 631.85, shares: 15.83, date: "2024-10-07" },
    { price: 620.45, shares: 16.11, date: "2024-09-15" }
  ],
  backtestParameters: {
    gridIntervalPercent: 0.10,
    profitRequirement: 0.05,
    dynamicGridMultiplier: 1
  },
  futureTrades: {
    currentPrice: 628.71,
    avgCost: 626.03,
    hasHoldings: true,
    buyActivation: {
      isActive: true,
      stopPrice: 580.27,
      lowestPrice: 552.64
    },
    sellActivation: { /* ... */ }
  }
}
```

**Key Insight**: All data needed is already in the response! We just need to:
1. Pass `lots[]` through `futureTrades` object
2. Calculate grid validation logic
3. Display it in the UI

## Target State

### Enhanced futureTrades Object

```javascript
futureTrades: {
  // Existing fields...
  currentPrice: 628.71,
  avgCost: 626.03,
  hasHoldings: true,

  // NEW: Holdings details
  holdings: [
    {
      price: 631.85,
      shares: 15.83,
      date: "2024-10-07",
      currentValue: 9954.23,
      unrealizedPNL: -49.73,
      unrealizedPNLPercent: -0.0050
    },
    {
      price: 620.45,
      shares: 16.11,
      date: "2024-09-15",
      currentValue: 10127.84,
      unrealizedPNL: 132.98,
      unrealizedPNLPercent: 0.0133
    }
  ],

  // Enhanced BUY activation with grid validation
  buyActivation: {
    isActive: true,
    stopPrice: 580.27,
    lowestPrice: 552.64,

    // NEW: Grid validation
    gridRequirementPrice: 568.67,  // Last buy × (1 - grid%)
    gridSatisfied: false,           // Current price vs grid price
    effectiveExecutionPrice: 568.67, // Max of stop and grid
    executionReady: false,          // Will trade execute now?
    executionStatus: 'WAITING_FOR_GRID',

    // NEW: Guidance text
    targetDistance: -60.04,         // Current - target
    targetDistancePercent: -0.0954, // (Current - target) / current
    explanation: "Trade will execute when price drops to $568.67 or below (10% grid spacing from last buy at $631.85)"
  },

  // Enhanced SELL activation  with grid validation
  sellActivation: {
    // Similar enhancements...
  }
}
```

## Backend Implementation

### Phase 1: Enhance calculateFutureTradesForResult()

**File**: `backend/services/batchBacktestService.js`

**Location**: Lines 282-401 (function calculateFutureTradesForResult)

#### Step 1.1: Extract and Format Holdings

```javascript
function calculateFutureTradesForResult(result) {
  const {
    lots = [],
    shorts = [],
    // ... existing destructuring
  } = result;

  // NEW: Format holdings with P/L calculations
  const holdings = (isShortStrategy ? shorts : lots).map(lot => {
    const currentValue = lot.shares * currentPrice;
    const costBasis = lot.shares * lot.price;
    const unrealizedPNL = currentValue - costBasis;
    const unrealizedPNLPercent = costBasis > 0 ? unrealizedPNL / costBasis : 0;

    return {
      price: lot.price,
      shares: lot.shares,
      date: lot.date,
      currentValue,
      unrealizedPNL,
      unrealizedPNLPercent
    };
  });
```

#### Step 1.2: Calculate Grid Requirement for BUY

```javascript
  // Calculate BUY grid requirement
  let buyGridValidation = null;

  if (!isShortStrategy && lots.length > 0) {
    // Get the last (most recent) buy
    const lastBuy = lots[lots.length - 1];
    const lastBuyPrice = lastBuy.price;

    // Calculate grid requirement price
    const gridInterval = params.gridIntervalPercent;
    const dynamicMultiplier = params.dynamicGridMultiplier || 1;
    const effectiveGridInterval = gridInterval * dynamicMultiplier;

    const gridRequirementPrice = lastBuyPrice * (1 - effectiveGridInterval);
    const gridSatisfied = currentPrice <= gridRequirementPrice;

    // Calculate effective execution price (most restrictive)
    let effectiveExecutionPrice;
    if (buyActivation.isActive) {
      // If stop is active, need to satisfy BOTH stop and grid
      effectiveExecutionPrice = Math.max(
        buyActivation.stopPrice,
        gridRequirementPrice
      );
    } else {
      // If stop is pending, activation price is the constraint
      effectiveExecutionPrice = buyActivation.activationPrice;
    }

    // Determine execution status
    const stopTriggered = buyActivation.isActive &&
                          currentPrice >= buyActivation.stopPrice;

    let executionStatus, executionReady;
    if (stopTriggered && gridSatisfied) {
      executionStatus = 'READY';
      executionReady = true;
    } else if (stopTriggered && !gridSatisfied) {
      executionStatus = 'WAITING_FOR_GRID';
      executionReady = false;
    } else if (!stopTriggered && gridSatisfied) {
      executionStatus = 'WAITING_FOR_STOP';
      executionReady = false;
    } else {
      executionStatus = 'WAITING';
      executionReady = false;
    }

    // Calculate distance to target
    const targetDistance = currentPrice - effectiveExecutionPrice;
    const targetDistancePercent = currentPrice > 0 ?
      targetDistance / currentPrice : 0;

    // Generate explanation
    let explanation;
    if (executionReady) {
      explanation = `Trade will execute immediately - all conditions met`;
    } else if (executionStatus === 'WAITING_FOR_GRID') {
      const dropNeeded = ((currentPrice - gridRequirementPrice) / currentPrice * 100).toFixed(2);
      explanation = `Trade will execute when price drops to $${gridRequirementPrice.toFixed(2)} or below (${(effectiveGridInterval * 100).toFixed(0)}% grid spacing from last buy at $${lastBuyPrice.toFixed(2)})`;
    } else {
      explanation = `Waiting for trailing stop activation at $${buyActivation.activationPrice.toFixed(2)}`;
    }

    buyGridValidation = {
      gridRequirementPrice,
      gridSatisfied,
      effectiveExecutionPrice,
      executionReady,
      executionStatus,
      targetDistance,
      targetDistancePercent,
      explanation,
      lastBuyPrice,
      gridInterval: effectiveGridInterval
    };
  }
```

#### Step 1.3: Calculate Grid Requirement for SELL

```javascript
  // Calculate SELL grid requirement
  let sellGridValidation = null;

  if (hasHoldings && sellActivation) {
    // For SELL, the "grid" is actually the profit requirement
    const profitTargetPrice = avgCost * (1 + params.profitRequirement);
    const profitSatisfied = currentPrice >= profitTargetPrice;

    // Calculate effective execution price
    let effectiveExecutionPrice;
    if (sellActivation.isActive) {
      // If stop is active, need to satisfy BOTH stop and profit
      effectiveExecutionPrice = Math.max(
        sellActivation.stopPrice,
        profitTargetPrice
      );
    } else {
      // If stop is pending, activation price is the constraint
      effectiveExecutionPrice = sellActivation.activationPrice;
    }

    // Determine execution status
    const stopTriggered = sellActivation.isActive &&
                          currentPrice <= sellActivation.stopPrice;

    let executionStatus, executionReady;
    if (stopTriggered && profitSatisfied) {
      executionStatus = 'READY';
      executionReady = true;
    } else if (stopTriggered && !profitSatisfied) {
      executionStatus = 'WAITING_FOR_PROFIT';
      executionReady = false;
    } else if (!stopTriggered && profitSatisfied) {
      executionStatus = 'WAITING_FOR_STOP';
      executionReady = false;
    } else {
      executionStatus = 'WAITING';
      executionReady = false;
    }

    const targetDistance = currentPrice - effectiveExecutionPrice;
    const targetDistancePercent = currentPrice > 0 ?
      targetDistance / currentPrice : 0;

    let explanation;
    if (executionReady) {
      explanation = `Trade will execute immediately - all conditions met`;
    } else if (executionStatus === 'WAITING_FOR_PROFIT') {
      const riseNeeded = ((profitTargetPrice - currentPrice) / currentPrice * 100).toFixed(2);
      explanation = `Trade will execute when price rises to $${profitTargetPrice.toFixed(2)} or above (${(params.profitRequirement * 100).toFixed(0)}% profit target from average cost $${avgCost.toFixed(2)})`;
    } else {
      explanation = `Waiting for trailing stop activation at $${sellActivation.activationPrice.toFixed(2)}`;
    }

    sellGridValidation = {
      gridRequirementPrice: profitTargetPrice,
      gridSatisfied: profitSatisfied,
      effectiveExecutionPrice,
      executionReady,
      executionStatus,
      targetDistance,
      targetDistancePercent,
      explanation,
      profitRequirement: params.profitRequirement
    };
  }
```

#### Step 1.4: Return Enhanced Object

```javascript
  return {
    currentPrice,
    currentPriceDate: params.endDate,
    avgCost,
    hasHoldings,
    isShortStrategy,
    recentPeak,
    recentBottom,
    recentPeakDate,
    recentBottomDate,
    lastTrade,
    holdings,  // NEW
    buyActivation: {
      ...buyActivation,
      ...buyGridValidation  // Merge grid validation
    },
    sellActivation: sellActivation ? {
      ...sellActivation,
      ...sellGridValidation  // Merge grid validation
    } : null
  };
}
```

## Frontend Implementation

### Phase 2: Enhance FutureTradeCard Component

**File**: `frontend/src/components/BatchResults.js`

**Location**: Lines 10-239 (FutureTradeCard component)

#### Step 2.1: Add Holdings Section

Insert after Trading Context section (~line 141):

```javascript
{/* [Spec 52] Current Holdings Section */}
{hasHoldings && futureTrades.holdings && futureTrades.holdings.length > 0 && (
  <div className="holdings-section" style={{
    marginBottom: '15px',
    padding: '12px',
    backgroundColor: '#f0f8ff',
    borderRadius: '6px',
    border: '1px solid #b0d4f1'
  }}>
    <h5 style={{
      margin: '0 0 10px 0',
      fontSize: '14px',
      fontWeight: '600',
      color: '#555'
    }}>
      Current Holdings ({futureTrades.holdings.length} lot{futureTrades.holdings.length !== 1 ? 's' : ''})
    </h5>

    {/* Summary */}
    <div style={{
      marginBottom: '10px',
      padding: '8px',
      backgroundColor: 'white',
      borderRadius: '4px',
      fontWeight: '500'
    }}>
      <span>Average Cost: {formatCurrency(avgCost)}</span>
      <span style={{ marginLeft: '20px' }}>
        Total Value: {formatCurrency(
          futureTrades.holdings.reduce((sum, h) => sum + h.currentValue, 0)
        )}
      </span>
    </div>

    {/* Individual Lots */}
    <div style={{ display: 'grid', gap: '8px' }}>
      {futureTrades.holdings.map((holding, idx) => (
        <div key={idx} style={{
          padding: '8px',
          backgroundColor: 'white',
          borderRadius: '4px',
          fontSize: '13px',
          borderLeft: `3px solid ${holding.unrealizedPNL >= 0 ? '#4caf50' : '#f44336'}`
        }}>
          <div style={{ fontWeight: '600', marginBottom: '4px' }}>
            Lot {idx + 1}: {formatCurrency(holding.price)} × {holding.shares.toFixed(2)} shares
            <span style={{ color: '#888', fontSize: '11px', marginLeft: '8px' }}>
              {holding.date}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span>Value: {formatCurrency(holding.currentValue)}</span>
            <span style={{
              color: holding.unrealizedPNL >= 0 ? '#4caf50' : '#f44336',
              fontWeight: '600'
            }}>
              P/L: {formatCurrency(holding.unrealizedPNL)}
              ({formatPerformancePercent(holding.unrealizedPNLPercent)})
            </span>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

#### Step 2.2: Enhance BUY Section with Grid Status

Replace existing BUY section (~lines 149-134) with:

```javascript
{/* BUY Direction with Grid Validation */}
<div className={`buy-section ${buyActivation.isActive ? 'is-active' : 'is-pending'}`}>
  <h5>
    <TrendingDown size={16} />
    {buyActivation.description}

    {/* [Spec 52] Execution Status Badge */}
    {buyActivation.executionStatus && (
      <span className={`status-badge execution-${buyActivation.executionStatus.toLowerCase()}`}
        style={{
          marginLeft: '10px',
          padding: '3px 8px',
          fontSize: '11px',
          borderRadius: '4px',
          backgroundColor: buyActivation.executionReady ? '#4caf50' : '#ff9800',
          color: 'white'
        }}
      >
        {buyActivation.executionStatus === 'READY' && '✅ READY TO EXECUTE'}
        {buyActivation.executionStatus === 'WAITING_FOR_GRID' && '⏳ WAITING FOR GRID'}
        {buyActivation.executionStatus === 'WAITING_FOR_STOP' && '⏳ WAITING FOR STOP'}
        {buyActivation.executionStatus === 'WAITING' && '⏳ WAITING'}
      </span>
    )}
  </h5>

  {/* [Spec 52] Grid Validation Details */}
  {buyActivation.gridRequirementPrice && (
    <div className="grid-validation" style={{
      marginTop: '10px',
      marginBottom: '10px',
      padding: '10px',
      backgroundColor: '#fffbf0',
      borderRadius: '4px',
      border: '1px solid #ffe082'
    }}>
      <div style={{ marginBottom: '6px', fontSize: '13px' }}>
        <strong>Execution Requirements:</strong>
      </div>
      <div style={{ display: 'grid', gap: '4px', fontSize: '12px' }}>
        <div>
          Trailing Stop: {formatCurrency(buyActivation.stopPrice)}
          <span style={{ marginLeft: '8px', color: buyActivation.isActive ? '#4caf50' : '#ff9800' }}>
            {buyActivation.isActive ? '✓' : '○'}
          </span>
        </div>
        <div>
          Grid Spacing: {formatCurrency(buyActivation.gridRequirementPrice)}
          <span style={{ marginLeft: '8px', color: buyActivation.gridSatisfied ? '#4caf50' : '#f44336' }}>
            {buyActivation.gridSatisfied ? '✓' : '✗'}
          </span>
        </div>
        <div style={{ fontWeight: '600', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #ffe082' }}>
          → Effective Target: {formatCurrency(buyActivation.effectiveExecutionPrice)}
        </div>
      </div>
    </div>
  )}

  {/* Target Distance */}
  {buyActivation.effectiveExecutionPrice && (
    <div style={{
      padding: '8px',
      backgroundColor: '#f5f5f5',
      borderRadius: '4px',
      fontSize: '13px',
      marginBottom: '10px'
    }}>
      <div>Current: {formatCurrency(currentPrice)}</div>
      <div style={{ fontWeight: '600', marginTop: '4px' }}>
        Target: {formatCurrency(buyActivation.effectiveExecutionPrice)}
        <span style={{ marginLeft: '8px', color: buyActivation.targetDistance < 0 ? '#f44336' : '#4caf50' }}>
          {buyActivation.targetDistance < 0 ? '↓' : '↑'}
          {formatCurrency(Math.abs(buyActivation.targetDistance))}
          ({formatPerformancePercent(Math.abs(buyActivation.targetDistancePercent))})
        </span>
      </div>
    </div>
  )}

  {/* Explanation */}
  {buyActivation.explanation && (
    <div style={{
      fontSize: '12px',
      color: '#666',
      fontStyle: 'italic',
      padding: '8px',
      backgroundColor: '#fafafa',
      borderRadius: '4px'
    }}>
      {buyActivation.explanation}
    </div>
  )}

  {/* ... existing stop/activation details ... */}
</div>
```

#### Step 2.3: Similar Enhancement for SELL Section

Apply same pattern to SELL section with appropriate adjustments.

## Visual Design

### Execution Status Color Coding

```
✅ READY - Green (#4caf50)
  All conditions met, trade will execute

⏳ WAITING FOR GRID - Orange (#ff9800)
  Stop triggered but grid not satisfied

⏳ WAITING FOR STOP - Orange (#ff9800)
  Grid satisfied but stop not triggered

⏳ WAITING - Gray (#9e9e9e)
  Neither condition met
```

### Holdings Display Design

```
┌─ Current Holdings (2 lots) ──────────────┐
│ Average Cost: $626.03 | Total: $20,082  │
│                                          │
│ ┃ Lot 1: $631.85 × 15.83 shares         │
│ ┃ Value: $9,954 | P/L: -$50 (-0.5%)     │
│ ┃ 2024-10-07                            │
│                                          │
│ ┃ Lot 2: $620.45 × 16.11 shares         │
│ ┃ Value: $10,128 | P/L: +$133 (+1.3%)   │
│ ┃ 2024-09-15                            │
└──────────────────────────────────────────┘
```

Green bar = profit, Red bar = loss

## Data Flow Diagram

```
Backend: DCA Executor
  ↓ lots[], parameters
Backend: calculateFutureTradesForResult()
  ↓ Calculate grid validation
  ↓ Calculate effective execution price
  ↓ Format holdings with P/L
  ↓
Backend: API Response
  ↓ Enhanced futureTrades object
  ↓
Frontend: FutureTradeCard
  ↓ Render holdings section
  ↓ Render execution status
  ↓ Show target price and distance
```

## Edge Cases

### Case 1: No Holdings (First Buy)
- Holdings section: Hidden
- BUY grid validation: Skip (no last buy to compare)
- Show only trailing stop condition

### Case 2: Multiple Lots at Same Price
- Display as separate lots (with same price)
- Grid calculation uses most recent

### Case 3: Dynamic Grid Active
- Use `dynamicGridMultiplier` in calculation
- Show effective grid percentage in explanation

### Case 4: Active Stop but Grid Not Satisfied
- **Most important case** - this is the whole point!
- Show clear "WAITING FOR GRID" status
- Explain exactly what price is needed

## Testing Strategy

### Unit Tests
- Grid calculation logic
- Execution status determination
- P/L calculations
- Edge cases (no holdings, first buy, etc.)

### Integration Tests
- Backend: Verify enhanced futureTrades object
- Frontend: Verify UI renders correctly
- End-to-end: Match display to actual execution

### Manual Testing with APP Example
1. Run batch backtest with APP
2. Verify holdings show correctly
3. Verify grid requirement calculated correctly
4. Verify execution status matches reality
5. Manually place trade to confirm guidance is accurate

## Performance Considerations

- Holdings formatting: O(n) where n = number of lots (typically < 10)
- Grid validation: O(1) calculation
- No additional API calls
- No database queries
- All calculations client-side from existing data

Total overhead: < 5ms per stock

## Backward Compatibility

- All new fields are additive
- Old clients will ignore new fields
- No breaking changes to existing API
- Works with all existing batch tests
