# Spec 33: Implementation Tasks - Batch Future Trades Aggregation

## Phase 1: Backend Implementation

### Task 1.1: Create Future Trades Calculation Function
**File**: `backend/services/batchBacktestService.js`
**Estimated Time**: 30 minutes
**Dependencies**: None

**Steps**:
1. Add `calculateFutureTradesForResult()` function after line 258
2. Extract logic from `BacktestResults.js` lines 289-405 (calculateFutureTrades function)
3. Adapt to work with backtest result object instead of React state
4. Handle both LONG and SHORT strategies
5. Calculate:
   - `currentPrice` from `result.finalMarketPrice`
   - `avgCost` from `result.lots` or `result.shorts`
   - `buyActivation` (active or theoretical)
   - `sellActivation` (active or theoretical, null if no holdings)

**Acceptance Criteria**:
- Function returns object with all required fields
- Works with active trailing stops
- Works with theoretical activation conditions
- Handles edge cases: no holdings, no transactions, missing data
- Supports both LONG and SHORT strategies

**Test Command**:
```javascript
// Add to batchBacktestService.js for testing
console.log('Testing calculateFutureTradesForResult:',
  calculateFutureTradesForResult(mockResult));
```

### Task 1.2: Integrate Future Trades into Batch Results
**File**: `backend/services/batchBacktestService.js`
**Estimated Time**: 15 minutes
**Dependencies**: Task 1.1

**Steps**:
1. After line 513 (after `runDCABacktest()` completes)
2. Call `calculateFutureTradesForResult(result)`
3. Attach to `result.futureTrades`
4. Ensure it's included in the returned results array

**Code Location**: Line 513-515
```javascript
const result = await runDCABacktest({
  ...params,
  verbose: false
});

// [NEW] Add future trades information
result.futureTrades = calculateFutureTradesForResult(result);

// Log for debugging
if (i === 0) {
  console.log('🔍 Sample futureTrades:', result.futureTrades);
}

results.push(result);
```

**Acceptance Criteria**:
- All batch results include `futureTrades` property
- No performance degradation (< 2ms per result)
- Logged sample shows expected data structure

**Test Command**:
```bash
curl -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "MSFT"],
    "parameterRanges": {
      "profitRequirement": [0.05],
      "gridIntervalPercent": [0.1],
      "trailingBuyActivationPercent": [0.1],
      "trailingBuyReboundPercent": [0.05],
      "trailingSellActivationPercent": [0.2],
      "trailingSellPullbackPercent": [0.1]
    }
  }' | jq '.results[0].futureTrades'
```

### Task 1.3: Add Backend Tests
**File**: `backend/__tests__/batchBacktestService.test.js`
**Estimated Time**: 30 minutes
**Dependencies**: Task 1.2

**Steps**:
1. Test `calculateFutureTradesForResult()` with:
   - Active trailing stop buy
   - Active trailing stop sell
   - Theoretical activation (no active stops)
   - No holdings case
   - SHORT strategy
2. Verify all fields present and correct
3. Test edge cases: missing data, zero prices

**Acceptance Criteria**:
- All tests pass
- 100% code coverage for new function

---

## Phase 2: Frontend Implementation

### Task 2.1: Add Future Trades Aggregation Logic
**File**: `frontend/src/components/BatchResults.js`
**Estimated Time**: 20 minutes
**Dependencies**: Phase 1 complete

**Steps**:
1. Add `futureTradesBySymbol` useMemo hook
2. Group results by symbol
3. For each symbol, select best-performing configuration
4. Include parameters and futureTrades for each

**Code Location**: After line 250 (after getTopNPerStock function)
```javascript
// Aggregate future trades by symbol (use best-performing config per stock)
const futureTradesBySymbol = useMemo(() => {
  if (!results || results.length === 0) return {};

  const grouped = {};
  results.forEach(result => {
    const symbol = result.parameters.symbol;
    if (!grouped[symbol]) {
      grouped[symbol] = {
        futureTrades: result.futureTrades,
        parameters: result.parameters,
        rank: results.indexOf(result) + 1,
        totalReturn: result.summary?.totalReturn || 0
      };
    }
  });

  return grouped;
}, [results]);
```

**Acceptance Criteria**:
- Aggregation groups by symbol correctly
- Uses best-performing configuration per stock
- Memoization prevents unnecessary recalculations

### Task 2.2: Create FutureTradeCard Component
**File**: `frontend/src/components/BatchResults.js`
**Estimated Time**: 45 minutes
**Dependencies**: Task 2.1

**Steps**:
1. Create `FutureTradeCard` component (add before main component)
2. Implement expandable card with accordion behavior
3. Display:
   - Header: Symbol, current price, holdings status
   - Body: BUY and SELL activation details
4. Use icons from lucide-react: TrendingUp, TrendingDown
5. Apply conditional styling: active stops (green), theoretical (gray)

**Code Location**: Insert after imports, before BatchResults component
```javascript
const FutureTradeCard = ({ symbol, futureTrades, parameters, isSelected }) => {
  // Component implementation from design.md
};
```

**Acceptance Criteria**:
- Card expands/collapses on header click
- Shows correct BUY activation details
- Shows correct SELL activation details (or "No holdings")
- Visual indicators match single backtest style
- Selected stock card is highlighted

### Task 2.3: Add Future Trades Section to Batch Results
**File**: `frontend/src/components/BatchResults.js`
**Estimated Time**: 20 minutes
**Dependencies**: Task 2.2

**Steps**:
1. Add new section after "Best Parameters by Stock" (after line 407)
2. Render grid of FutureTradeCard components
3. Pass symbol, futureTrades, parameters, isSelected to each card
4. Add section title with icon

**Code Location**: Line 408 (after bestParametersBySymbol section)
```javascript
{/* Future Trades by Stock */}
{Object.keys(futureTradesBySymbol).length > 0 && (
  <div className="future-trades-section">
    <h3>🎯 Future Trades by Stock</h3>
    <div className="future-trades-grid">
      {Object.entries(futureTradesBySymbol).map(([symbol, data]) => (
        <FutureTradeCard
          key={symbol}
          symbol={symbol}
          futureTrades={data.futureTrades}
          parameters={data.parameters}
          isSelected={selectedStock === symbol}
        />
      ))}
    </div>
  </div>
)}
```

**Acceptance Criteria**:
- Section appears after "Best Parameters by Stock"
- All tested stocks have cards
- Cards match styling of other sections
- Responsive grid layout

### Task 2.4: Add CSS Styling
**File**: `frontend/src/components/BatchResults.css`
**Estimated Time**: 20 minutes
**Dependencies**: Task 2.3

**Steps**:
1. Add styles for future-trades-section
2. Style future-trade-card (normal and selected states)
3. Style card-header (hover effect, expand icon)
4. Style card-body (trade-directions grid)
5. Style buy-section and sell-section
6. Style active-stop indicator

**Code**: Use styles from design.md CSS section

**Acceptance Criteria**:
- Matches existing batch results visual style
- Responsive grid (1-3 columns based on screen width)
- Hover states work
- Selected card highlighted
- Active stops visually distinct

### Task 2.5: Connect to Stock Filter
**File**: `frontend/src/components/BatchResults.js`
**Estimated Time**: 15 minutes
**Dependencies**: Task 2.3

**Steps**:
1. Pass `isSelected={selectedStock === symbol}` to FutureTradeCard
2. Filter future trades when stock filter is active
3. Auto-expand selected stock's card
4. Scroll to future trades section when filter changes

**Code Location**: Update FutureTradeCard instantiation
```javascript
<FutureTradeCard
  key={symbol}
  symbol={symbol}
  futureTrades={data.futureTrades}
  parameters={data.parameters}
  isSelected={selectedStock === symbol}
/>
```

**Acceptance Criteria**:
- Filtering by stock highlights corresponding card
- Selected card auto-expands
- Smooth scroll to section
- "All Stocks" shows all cards

---

## Phase 3: Testing & Verification

### Task 3.1: Manual Testing - LONG Strategy
**Estimated Time**: 30 minutes
**Dependencies**: Phase 2 complete

**Test Cases**:
1. Run batch backtest with 2-3 stocks
2. Verify future trades section appears
3. Verify each stock has a card
4. Expand each card and verify:
   - Next BUY shows correct activation/execution
   - Next SELL shows correct activation/execution (if holdings)
   - Active stops show green background
5. Filter by stock and verify highlighting

**Test Command**:
```bash
# Start servers
npm run dev  # Terminal 1
node backend/server.js  # Terminal 2

# Navigate to: http://localhost:3000/backtest?mode=batch
# Fill form with: AAPL, MSFT, TSLA
# Submit and verify future trades section
```

**Acceptance Criteria**:
- All stocks show future trade cards
- Data matches expectations
- No console errors
- Visual styling matches design

### Task 3.2: Manual Testing - SHORT Strategy
**Estimated Time**: 20 minutes
**Dependencies**: Task 3.1

**Test Cases**:
1. Run batch backtest with SHORT strategy
2. Verify terminology: "Next SHORT", "Next COVER"
3. Verify calculations for short positions
4. Verify active stops work correctly

**Test Command**:
```bash
# Navigate to: http://localhost:3000/backtest/short?mode=batch
# Fill form with: TSLA, NVDA
# Submit and verify future trades section shows SHORT terminology
```

**Acceptance Criteria**:
- SHORT terminology used throughout
- Calculations correct for short positions
- Active stops display correctly

### Task 3.3: Edge Case Testing
**Estimated Time**: 20 minutes
**Dependencies**: Task 3.2

**Test Cases**:
1. **No holdings**: Verify SELL section shows "No holdings to sell"
2. **No transactions**: Verify BUY shows theoretical only
3. **Missing data**: Verify graceful fallback to currentPrice
4. **Multiple configurations**: Verify best one selected per stock
5. **Beta scaling**: Verify parameters displayed correctly

**Acceptance Criteria**:
- No crashes on edge cases
- Graceful degradation
- Informative messages

### Task 3.4: Performance Testing
**Estimated Time**: 15 minutes
**Dependencies**: Task 3.3

**Test Cases**:
1. Run batch with 10 stocks, 50 combinations
2. Measure:
   - Backend: Future trades calculation time
   - Frontend: Initial render time
   - Frontend: Card expansion time
3. Verify < 5% overhead vs. before

**Acceptance Criteria**:
- Backend < 2ms per result
- Frontend initial render < 100ms
- Card expansion < 50ms
- No memory leaks

### Task 3.5: Integration Testing with curl
**Estimated Time**: 15 minutes
**Dependencies**: Task 3.4

**Test Command**:
```bash
# Test batch endpoint includes futureTrades
curl -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "MSFT", "GOOGL"],
    "parameterRanges": {
      "profitRequirement": [0.05, 0.07],
      "gridIntervalPercent": [0.1],
      "trailingBuyActivationPercent": [0.1],
      "trailingBuyReboundPercent": [0.05],
      "trailingSellActivationPercent": [0.2],
      "trailingSellPullbackPercent": [0.1],
      "maxLotsToSell": [1],
      "startDate": "2024-01-01",
      "endDate": "2025-01-01",
      "lotSizeUsd": 10000,
      "maxLots": 10
    }
  }' | jq '.results[] | {symbol: .parameters.symbol, futureTrades: .futureTrades}'
```

**Acceptance Criteria**:
- Response includes futureTrades for all results
- Structure matches design spec
- All required fields present

---

## Phase 4: Documentation & Cleanup

### Task 4.1: Update README
**File**: `README.md` or `docs/FEATURES.md`
**Estimated Time**: 15 minutes
**Dependencies**: Phase 3 complete

**Steps**:
1. Add "Future Trades Aggregation" section
2. Explain feature purpose
3. Add screenshot or description
4. Document how to use in batch mode

**Acceptance Criteria**:
- Clear explanation of feature
- User-friendly documentation

### Task 4.2: Code Review & Cleanup
**Estimated Time**: 20 minutes
**Dependencies**: Task 4.1

**Steps**:
1. Remove debug console.logs
2. Add JSDoc comments to new functions
3. Verify consistent code style
4. Check for unused imports
5. Run linter

**Acceptance Criteria**:
- No debug logs in production code
- All functions documented
- Linter passes
- Code review approved

---

## Summary

**Total Estimated Time**: 5-6 hours

**Phase Breakdown**:
- Phase 1 (Backend): 1.25 hours
- Phase 2 (Frontend): 2.25 hours
- Phase 3 (Testing): 2 hours
- Phase 4 (Documentation): 0.5 hours

**Key Milestones**:
1. Backend includes futureTrades in batch results
2. Frontend displays future trades section
3. All tests pass
4. Feature documented
