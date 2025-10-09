# Implementation Tasks: Trailing Stop Order Type Parameter

## Task Breakdown

### Phase 1: Backend Implementation

#### Task 1.1: Update dcaBacktestService.js - Parameter Definition
**File**: `backend/services/dcaBacktestService.js`
**Location**: Top of `runDCABacktest` function
**Estimated Time**: 15 minutes

**Steps**:
1. Add `trailingStopOrderType = 'limit'` to function parameters with default value
2. Add validation to ensure value is either 'limit' or 'market'
3. Throw error if invalid value provided

**Code Changes**:
```javascript
const runDCABacktest = async ({
  symbol,
  startDate,
  endDate,
  // ... existing parameters
  trailingStopOrderType = 'limit',  // ADD THIS
  verbose = false
}) => {
  // Validate order type
  if (!['limit', 'market'].includes(trailingStopOrderType)) {
    throw new Error(`Invalid trailingStopOrderType: ${trailingStopOrderType}. Must be 'limit' or 'market'.`);
  }

  // ... rest of function
};
```

**Testing**:
- Test with `trailingStopOrderType='limit'` (should work)
- Test with `trailingStopOrderType='market'` (should work)
- Test with `trailingStopOrderType='invalid'` (should throw error)
- Test with parameter omitted (should default to 'limit')

---

#### Task 1.2: Update Trailing Stop Buy Cancellation Logic
**File**: `backend/services/dcaBacktestService.js`
**Location**: `cancelTrailingStopBuyIfAbovePeak()` function (around line 631)
**Estimated Time**: 20 minutes

**Steps**:
1. Add check at start of function: if `trailingStopOrderType === 'market'`, return false immediately
2. Update log message to indicate order type (add "(LIMIT)" to message)
3. Ensure peak reference is still tracked (for display purposes)

**Code Changes**:
```javascript
const cancelTrailingStopBuyIfAbovePeak = (currentPrice) => {
  // SKIP cancellation check if using market orders
  if (trailingStopOrderType === 'market') {
    return false;  // Never cancel for market orders
  }

  // Existing limit order logic
  if (trailingStopBuy && currentPrice > trailingStopBuy.recentPeakReference) {
    transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY CANCELLED (LIMIT) - Price ${currentPrice.toFixed(2)} > limit price ${trailingStopBuy.recentPeakReference.toFixed(2)} (peak)`, 'yellow'));
    trailingStopBuy = null;
    return true;
  }
  return false;
};
```

**Testing**:
- Test limit order: price exceeds peak → order cancelled
- Test market order: price exceeds peak → order NOT cancelled
- Verify log messages include order type

---

#### Task 1.3: Update Trailing Stop Sell Cancellation Logic
**File**: `backend/services/dcaBacktestService.js`
**Location**: `cancelTrailingStopSellIfBelowBottom()` function (around line 815)
**Estimated Time**: 20 minutes

**Steps**:
1. Add check at start of function: if `trailingStopOrderType === 'market'`, return false immediately
2. Update log message to indicate order type (add "(LIMIT)" to message)
3. Ensure bottom reference is still tracked (for display purposes)

**Code Changes**:
```javascript
const cancelTrailingStopSellIfBelowBottom = (currentPrice) => {
  // SKIP cancellation check if using market orders
  if (trailingStopOrderType === 'market') {
    return false;  // Never cancel for market orders
  }

  // Existing limit order logic
  if (trailingStopSell && currentPrice < trailingStopSell.recentBottomReference) {
    transactionLog.push(colorize(`  ACTION: TRAILING STOP SELL CANCELLED (LIMIT) - Price ${currentPrice.toFixed(2)} < limit price ${trailingStopSell.recentBottomReference.toFixed(2)} (bottom)`, 'yellow'));
    trailingStopSell = null;
    return true;
  }
  return false;
};
```

**Testing**:
- Test limit order: price falls below bottom → order cancelled
- Test market order: price falls below bottom → order NOT cancelled
- Verify log messages include order type

---

#### Task 1.4: Update Buy Execution Logging
**File**: `backend/services/dcaBacktestService.js`
**Location**: `checkTrailingStopBuyExecution()` function (around line 650-750)
**Estimated Time**: 15 minutes

**Steps**:
1. Find the BUY log entry in the execution section
2. Add order type label to the log message
3. Log should show "Trailing stop (LIMIT)" or "Trailing stop (MARKET)"

**Code Changes**:
```javascript
// Inside checkTrailingStopBuyExecution, in the execution block
const orderTypeLabel = trailingStopOrderType === 'market' ? 'MARKET' : 'LIMIT';
transactionLog.push(colorize(`  BUY: Trailing stop (${orderTypeLabel}) executed at ${currentPrice.toFixed(2)} - Lot #${lots.length} purchased`, 'green'));
```

**Testing**:
- Test limit order execution → log shows "(LIMIT)"
- Test market order execution → log shows "(MARKET)"

---

#### Task 1.5: Update Sell Execution Logging
**File**: `backend/services/dcaBacktestService.js`
**Location**: `checkTrailingStopSellExecution()` function (around line 830-930)
**Estimated Time**: 15 minutes

**Steps**:
1. Find the SELL log entry in the execution section
2. Add order type label to the log message
3. Log should show "Trailing stop (LIMIT)" or "Trailing stop (MARKET)"

**Code Changes**:
```javascript
// Inside checkTrailingStopSellExecution, in the execution block
const orderTypeLabel = trailingStopOrderType === 'market' ? 'MARKET' : 'LIMIT';
transactionLog.push(colorize(`  SELL: Trailing stop (${orderTypeLabel}) executed at ${currentPrice.toFixed(2)} - ${lotsToSell.length} lot(s) sold`, 'green'));
```

**Testing**:
- Test limit order execution → log shows "(LIMIT)"
- Test market order execution → log shows "(MARKET)"

---

#### Task 1.6: Update batchBacktestService.js - Add to batchRequestParameters
**File**: `backend/services/batchBacktestService.js`
**Location**: Response construction (around line 635)
**Estimated Time**: 10 minutes

**Steps**:
1. Add `trailingStopOrderType` to `batchRequestParameters` object
2. Use default value 'limit' if not provided

**Code Changes**:
```javascript
batchRequestParameters: {
  enableBetaScaling: mergedParameterRanges.enableBetaScaling,
  enableDynamicGrid: mergedParameterRanges.enableDynamicGrid,
  normalizeToReference: mergedParameterRanges.normalizeToReference,
  enableConsecutiveIncrementalBuyGrid: mergedParameterRanges.enableConsecutiveIncrementalBuyGrid,
  enableConsecutiveIncrementalSellProfit: mergedParameterRanges.enableConsecutiveIncrementalSellProfit,
  gridConsecutiveIncrement: mergedParameterRanges.gridConsecutiveIncrement,
  enableScenarioDetection: mergedParameterRanges.enableScenarioDetection,
  trailingStopOrderType: mergedParameterRanges.trailingStopOrderType || 'limit'  // ADD THIS
}
```

**Testing**:
- Test batch request with `trailingStopOrderType='market'`
- Verify response includes `batchRequestParameters.trailingStopOrderType='market'`

---

#### Task 1.7: Update batchBacktestService.js - Pass to Individual Backtests
**File**: `backend/services/batchBacktestService.js`
**Location**: Individual backtest execution (around line 500+)
**Estimated Time**: 10 minutes

**Steps**:
1. Find where `dcaBacktestService.runDCABacktest` is called
2. Add `trailingStopOrderType` parameter to the call
3. Use value from `mergedParameterRanges` or default to 'limit'

**Code Changes**:
```javascript
const result = await dcaBacktestService.runDCABacktest({
  symbol: combination.symbol,
  startDate: combination.startDate,
  endDate: combination.endDate,
  // ... existing parameters
  trailingStopOrderType: mergedParameterRanges.trailingStopOrderType || 'limit',  // ADD THIS
  verbose: false
});
```

**Testing**:
- Test batch with `trailingStopOrderType='market'`
- Verify all individual backtests use market orders

---

### Phase 2: Frontend Implementation

#### Task 2.1: Update URLParameterManager.js - Add Parameter
**File**: `frontend/src/utils/URLParameterManager.js`
**Estimated Time**: 20 minutes

**Steps**:
1. Add `trailingStopOrderType` to parameter parsing
2. Add to URL generation
3. Handle default value (omit if 'limit')

**Code Changes**:
```javascript
export const getURLParameters = () => {
  const params = new URLSearchParams(window.location.search);

  return {
    // ... existing parameters
    trailingStopOrderType: params.get('trailingStopOrderType') || 'limit',
    // ... rest
  };
};

export const setURLParameter = (key, value) => {
  const params = new URLSearchParams(window.location.search);

  if (key === 'trailingStopOrderType') {
    if (value === 'limit') {
      params.delete('trailingStopOrderType');  // Remove if default
    } else {
      params.set('trailingStopOrderType', value);
    }
  }

  // ... existing parameter handling

  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
};
```

**Testing**:
- Test URL with `trailingStopOrderType=market` → parsed correctly
- Test URL without parameter → defaults to 'limit'
- Test setting parameter to 'limit' → removed from URL
- Test setting parameter to 'market' → added to URL

---

#### Task 2.2: Update App.js - Add to State
**File**: `frontend/src/App.js`
**Estimated Time**: 15 minutes

**Steps**:
1. Add `trailingStopOrderType` to component state
2. Initialize from URL parameters
3. Update state when URL changes
4. Pass to child components

**Code Changes**:
```javascript
const [backtestParams, setBacktestParams] = useState({
  // ... existing state
  trailingStopOrderType: 'limit',
});

useEffect(() => {
  const urlParams = URLParameterManager.getURLParameters();
  setBacktestParams(prev => ({
    ...prev,
    trailingStopOrderType: urlParams.trailingStopOrderType
  }));
}, [/* URL dependencies */]);
```

**Testing**:
- Navigate with different URLs → state updates correctly
- Verify state persists during navigation

---

#### Task 2.3: Update DCABacktestForm.js - Add UI Component
**File**: `frontend/src/components/DCABacktestForm.js`
**Location**: Advanced Settings section (after other trailing parameters)
**Estimated Time**: 30 minutes

**Steps**:
1. Add state: `const [trailingStopOrderType, setTrailingStopOrderType] = useState('limit');`
2. Initialize from URL parameters in useEffect
3. Add radio button UI component
4. Add help text explaining difference
5. Include in form submission (both single and batch)

**Code Changes**:
```jsx
// State
const [trailingStopOrderType, setTrailingStopOrderType] = useState('limit');

// Initialize from URL
useEffect(() => {
  if (urlParams.trailingStopOrderType) {
    setTrailingStopOrderType(urlParams.trailingStopOrderType);
  }
}, [urlParams.trailingStopOrderType]);

// UI Component (in JSX, in Advanced Settings section)
<div className="form-group">
  <label>Trailing Stop Order Type</label>
  <div className="order-type-selector">
    <label className="radio-option">
      <input
        type="radio"
        name="trailingStopOrderType"
        value="limit"
        checked={trailingStopOrderType === 'limit'}
        onChange={(e) => setTrailingStopOrderType(e.target.value)}
      />
      <span>Limit (prevents buying above peak / selling below bottom)</span>
    </label>
    <label className="radio-option">
      <input
        type="radio"
        name="trailingStopOrderType"
        value="market"
        checked={trailingStopOrderType === 'market'}
        onChange={(e) => setTrailingStopOrderType(e.target.value)}
      />
      <span>Market (always executes, no limit checks)</span>
    </label>
  </div>
  <small className="help-text">
    <strong>Limit:</strong> Order cancels if price exceeds peak (buy) or bottom (sell) reference.<br/>
    <strong>Market:</strong> Order always executes when stop is triggered.
  </small>
</div>

// Include in single mode API request
const backtestParams = {
  // ... existing parameters
  trailingStopOrderType,
  // ... rest
};

// Include in batch mode request
const batchParams = {
  symbols: selectedSymbols,
  trailingStopOrderType,  // Non-varying parameter
  parameterRanges: {
    // ... varying parameters
  }
};
```

**Testing**:
- Select "Limit" → state updates, URL updates
- Select "Market" → state updates, URL updates
- Submit single test → parameter sent to backend
- Submit batch test → parameter sent to backend

---

#### Task 2.4: Update BatchResults.js - Use batchRequestParameters
**File**: `frontend/src/components/BatchResults.js`
**Location**: URL generation section (around line 137+)
**Estimated Time**: 10 minutes

**Steps**:
1. Add `trailingStopOrderType` to URL parameter generation
2. Use `batchRequestParams.trailingStopOrderType` with fallback

**Code Changes**:
```javascript
// Use batch request parameters for non-varying parameters
urlParams.trailingStopOrderType = batchRequestParams.trailingStopOrderType ?? parameters.trailingStopOrderType ?? 'limit';
```

**Testing**:
- Create batch with `trailingStopOrderType='market'`
- Click result row
- Verify individual run URL contains `trailingStopOrderType=market`

---

#### Task 2.5: Add CSS Styles for Order Type Selector
**File**: `frontend/src/components/DCABacktestForm.css` (or inline styles)
**Estimated Time**: 15 minutes

**Steps**:
1. Add styles for radio button group
2. Add styles for help text
3. Ensure consistent spacing with other form elements

**Code Changes**:
```css
.order-type-selector {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 10px 0;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.radio-option:hover {
  background-color: #f5f5f5;
}

.radio-option input[type="radio"] {
  cursor: pointer;
}

.help-text {
  display: block;
  margin-top: 8px;
  font-size: 0.9em;
  color: #666;
  line-height: 1.5;
}

.help-text strong {
  color: #333;
}
```

**Testing**:
- Verify radio buttons display correctly
- Verify hover effects work
- Verify help text is readable
- Test on different screen sizes

---

### Phase 3: Testing

#### Task 3.1: Backend Unit Tests - Limit Order Cancellation
**File**: New test file or existing test suite
**Estimated Time**: 30 minutes

**Test Cases**:
1. Limit order - buy cancelled when price exceeds peak
2. Limit order - sell cancelled when price falls below bottom
3. Market order - buy NOT cancelled when price exceeds peak
4. Market order - sell NOT cancelled when price falls below bottom
5. Invalid order type - throws error
6. Missing order type - defaults to 'limit'

---

#### Task 3.2: Integration Tests - API Endpoints
**Estimated Time**: 30 minutes

**Test Cases**:
1. POST /api/backtest/dca with `trailingStopOrderType=limit`
2. POST /api/backtest/dca with `trailingStopOrderType=market`
3. POST /api/backtest/dca without trailingStopOrderType (default)
4. POST /api/backtest/batch with `trailingStopOrderType=market`
5. Verify batchRequestParameters includes trailingStopOrderType

---

#### Task 3.3: End-to-End Tests - URL Navigation
**Estimated Time**: 45 minutes

**Test Cases**:
1. Load URL with `trailingStopOrderType=market` → form shows "Market" selected
2. Load URL without parameter → form shows "Limit" selected
3. Change from Limit to Market → URL updates
4. Navigate single → batch → single → parameter persists
5. Click batch result row → individual URL has correct parameter
6. Share URL with parameter → recipient sees same setting

---

#### Task 3.4: Manual Testing - Transaction Logs
**Estimated Time**: 30 minutes

**Test Scenarios**:
1. **Limit order with 0% activation**: Verify orders cancel when price exceeds peak
2. **Market order with 0% activation**: Verify orders execute even when price exceeds peak
3. **Limit order normal scenario**: Verify standard behavior
4. **Market order normal scenario**: Verify no cancellations
5. **Compare total returns**: Run same parameters with limit vs market

**Test URL Examples**:
```
# Limit order (0% activation)
http://localhost:3000/backtest?symbol=PLTR&startDate=2021-09-01&endDate=2025-10-08&trailingBuyActivationPercent=0&trailingBuyReboundPercent=20&trailingStopOrderType=limit&...

# Market order (0% activation)
http://localhost:3000/backtest?symbol=PLTR&startDate=2021-09-01&endDate=2025-10-08&trailingBuyActivationPercent=0&trailingBuyReboundPercent=20&trailingStopOrderType=market&...
```

---

### Phase 4: Documentation

#### Task 4.1: Update Code Comments
**Estimated Time**: 20 minutes

**Files**:
- `backend/services/dcaBacktestService.js`
- `backend/services/batchBacktestService.js`

**Changes**:
- Document `trailingStopOrderType` parameter
- Explain difference between limit and market orders
- Document cancellation logic

---

#### Task 4.2: Update Transaction Log Format
**Estimated Time**: 10 minutes

**Changes**:
- Ensure all buy/sell logs include order type label
- Ensure cancellation logs indicate "(LIMIT)" order type
- Add examples to spec document

---

#### Task 4.3: Update Spec with Implementation Notes
**Estimated Time**: 15 minutes

**Changes**:
- Mark completed tasks
- Add implementation notes
- Add verification URLs
- Document any deviations from original plan

---

## Task Summary

### Backend Tasks (6 tasks)
- Task 1.1: Parameter definition (15 min)
- Task 1.2: Buy cancellation logic (20 min)
- Task 1.3: Sell cancellation logic (20 min)
- Task 1.4: Buy execution logging (15 min)
- Task 1.5: Sell execution logging (15 min)
- Task 1.6: Batch request parameters (10 min)
- Task 1.7: Batch individual backtests (10 min)

**Total Backend Time**: ~1.75 hours

### Frontend Tasks (5 tasks)
- Task 2.1: URLParameterManager (20 min)
- Task 2.2: App.js state (15 min)
- Task 2.3: DCABacktestForm UI (30 min)
- Task 2.4: BatchResults URL generation (10 min)
- Task 2.5: CSS styles (15 min)

**Total Frontend Time**: ~1.5 hours

### Testing Tasks (4 tasks)
- Task 3.1: Backend unit tests (30 min)
- Task 3.2: Integration tests (30 min)
- Task 3.3: E2E tests (45 min)
- Task 3.4: Manual testing (30 min)

**Total Testing Time**: ~2.25 hours

### Documentation Tasks (3 tasks)
- Task 4.1: Code comments (20 min)
- Task 4.2: Transaction log format (10 min)
- Task 4.3: Spec updates (15 min)

**Total Documentation Time**: ~0.75 hours

**TOTAL ESTIMATED TIME**: ~6.25 hours

## Task Dependencies

```
Phase 1 (Backend) → Phase 2 (Frontend) → Phase 3 (Testing) → Phase 4 (Documentation)

Within Phase 1:
  Task 1.1 (Parameter) → All other Task 1.x tasks

Within Phase 2:
  Task 2.1 (URLParameterManager) → Task 2.2 (App.js) → Task 2.3 (Form UI)
  Task 2.4 (BatchResults) depends on Task 1.6 (Backend batch params)

Within Phase 3:
  All testing tasks depend on Phase 1 and Phase 2 completion
```

## Verification Checklist

After implementation, verify:

- [ ] Backend accepts `trailingStopOrderType` parameter
- [ ] Default value is 'limit'
- [ ] Invalid values throw error
- [ ] Limit orders cancel when price exceeds peak/bottom
- [ ] Market orders never cancel due to peak/bottom
- [ ] Transaction logs show order type
- [ ] Frontend UI displays radio buttons
- [ ] URL updates when selection changes
- [ ] Parameter persists across navigation
- [ ] Batch mode preserves parameter
- [ ] Batch result URLs include correct parameter
- [ ] All tests pass
- [ ] Documentation updated

## Risk Mitigation

### High-Risk Tasks
1. **Task 1.2 & 1.3** (Cancellation logic): Ensure market orders don't break existing limit order behavior
   - **Mitigation**: Extensive testing with both order types

2. **Task 2.3** (Form UI): Ensure state synchronization between form, URL, and backend
   - **Mitigation**: Test all navigation paths

3. **Task 3.4** (Manual testing): Ensure real-world scenarios work as expected
   - **Mitigation**: Test with multiple stocks and parameter combinations

## Success Metrics

- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ Manual testing confirms expected behavior
- ✅ Zero regression in existing limit order functionality
- ✅ Market orders execute without cancellation
- ✅ Transaction logs are clear and informative
- ✅ UI is intuitive and well-documented
- ✅ URL sharing works correctly
- ✅ Batch mode preserves parameter correctly
