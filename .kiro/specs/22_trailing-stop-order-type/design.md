# Design: Trailing Stop Order Type Parameter

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  DCABacktestForm.js                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Order Type Selector (Radio/Dropdown)                      │  │
│  │ ○ Limit (default) ○ Market                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                      │
│  URLParameterManager.js                                         │
│  - Add trailingStopOrderType to managed parameters             │
│  - Convert to/from URL query string                            │
│  - Persist across navigation                                   │
│                           ↓                                      │
│  App.js                                                         │
│  - Store in component state                                    │
│  - Pass to form and API calls                                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓ API Request
┌─────────────────────────────────────────────────────────────────┐
│                       Backend (Node.js)                          │
├─────────────────────────────────────────────────────────────────┤
│  dcaBacktestService.js                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ checkTrailingStopBuyActivation()                          │  │
│  │ updateTrailingStopBuy()                                   │  │
│  │ checkTrailingStopBuyExecution() ← ADD orderType check     │  │
│  │ cancelTrailingStopBuyIfAbovePeak() ← SKIP if market       │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ checkTrailingStopSellActivation()                         │  │
│  │ updateTrailingStopSell()                                  │  │
│  │ checkTrailingStopSellExecution() ← ADD orderType check    │  │
│  │ cancelTrailingStopSellIfBelowBottom() ← SKIP if market    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  batchBacktestService.js                                        │
│  - Include trailingStopOrderType in batchRequestParameters     │
│  - Pass to individual backtests                                │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

### Frontend State
```javascript
{
  trailingStopOrderType: 'limit' | 'market',  // Default: 'limit'
}
```

### URL Parameter
```
?trailingStopOrderType=limit
?trailingStopOrderType=market
```

### Backend API Request
```javascript
{
  // ... existing parameters
  trailingStopOrderType: 'limit' | 'market'
}
```

### Batch Request
```javascript
{
  symbols: ['PLTR', 'AAPL'],
  trailingStopOrderType: 'market',  // Non-varying parameter
  parameterRanges: {
    // ... varying parameters
  }
}
```

### Batch Response
```javascript
{
  results: [...],
  batchRequestParameters: {
    enableBetaScaling: false,
    enableDynamicGrid: false,
    // ... other non-varying parameters
    trailingStopOrderType: 'market'  // ADD THIS
  }
}
```

## Component Design

### 1. Backend: dcaBacktestService.js

#### Current Flow (Limit Orders)
```
Price Movement
    ↓
Check Activation (price drop/rise)
    ↓
Activate Trailing Stop (store peak/bottom reference)
    ↓
Update Trailing Stop (track better prices)
    ↓
Check Execution (price rebounds/pulls back)
    ↓
Check Limit (cancel if exceeds peak/bottom) ← CANCELLATION POINT
    ↓
Execute Buy/Sell (if limit not exceeded)
```

#### New Flow (Market Orders)
```
Price Movement
    ↓
Check Activation (price drop/rise)
    ↓
Activate Trailing Stop (store peak/bottom reference)
    ↓
Update Trailing Stop (track better prices)
    ↓
Check Execution (price rebounds/pulls back)
    ↓
[SKIP] Check Limit (if orderType === 'market') ← SKIP CANCELLATION
    ↓
Execute Buy/Sell (always execute)
```

#### Implementation Details

**Function: `cancelTrailingStopBuyIfAbovePeak()`** (Line ~631)
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

**Function: `cancelTrailingStopSellIfBelowBottom()`** (Line ~815)
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

**Function: `checkTrailingStopBuyExecution()`** (Line ~650)
```javascript
const checkTrailingStopBuyExecution = (currentPrice, currentDate) => {
  // ... existing checks

  if (trailingStopBuy && currentPrice >= trailingStopBuy.stopPrice) {
    // For LIMIT orders: check if price is still within limit (below peak)
    // For MARKET orders: always execute
    const withinLimit = currentPrice <= trailingStopBuy.recentPeakReference;
    const shouldExecute = trailingStopOrderType === 'market' || withinLimit;

    if (shouldExecute) {
      // Execute buy
      if (lots.length < maxLots) {
        // ... existing execution logic
        const orderTypeLabel = trailingStopOrderType === 'market' ? 'MARKET' : 'LIMIT';
        transactionLog.push(colorize(`  BUY: Trailing stop (${orderTypeLabel}) executed at ${currentPrice.toFixed(2)}`, 'green'));
        // ... rest of execution
      }
    } else {
      // This is a limit order and price exceeded limit
      // Cancellation will be handled by cancelTrailingStopBuyIfAbovePeak()
    }
  }
};
```

**Parameter Extraction** (Top of function)
```javascript
const runDCABacktest = async ({
  // ... existing parameters
  trailingStopOrderType = 'limit',  // ADD THIS with default
  verbose = false
}) => {
  // Validate order type
  if (!['limit', 'market'].includes(trailingStopOrderType)) {
    throw new Error(`Invalid trailingStopOrderType: ${trailingStopOrderType}. Must be 'limit' or 'market'.`);
  }

  // ... rest of function
};
```

### 2. Backend: batchBacktestService.js

**Add to `batchRequestParameters`** (Line ~635)
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

**Pass to Individual Backtests** (Line ~500+)
```javascript
const result = await dcaBacktestService.runDCABacktest({
  // ... existing parameters
  trailingStopOrderType: combination.trailingStopOrderType || 'limit',
  // ... rest
});
```

### 3. Frontend: DCABacktestForm.js

**Add State** (with other form fields)
```javascript
const [trailingStopOrderType, setTrailingStopOrderType] = useState('limit');
```

**Add UI Component** (in Advanced Settings section, near other trailing parameters)
```jsx
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
    Limit: Order cancels if price exceeds peak (buy) or bottom (sell) reference.
    Market: Order always executes when stop is triggered.
  </small>
</div>
```

**Initialize from URL** (in useEffect)
```javascript
useEffect(() => {
  if (urlParams.trailingStopOrderType) {
    setTrailingStopOrderType(urlParams.trailingStopOrderType);
  }
}, [urlParams.trailingStopOrderType]);
```

**Include in API Request** (in handleSubmit)
```javascript
const backtestParams = {
  // ... existing parameters
  trailingStopOrderType,
  // ... rest
};
```

**Include in Batch Request** (in batch mode)
```javascript
const batchParams = {
  symbols: selectedSymbols,
  trailingStopOrderType,  // Non-varying parameter
  parameterRanges: {
    // ... varying parameters
  }
};
```

### 4. Frontend: BatchResults.js

**Use `batchRequestParameters` for URL Generation** (Line ~137+)
```javascript
// Use batch request parameters for boolean flags (non-varying parameters)
// Fall back to combination parameters if batch request parameters are not available (backward compatibility)
urlParams.enableDynamicGrid = batchRequestParams.enableDynamicGrid ?? parameters.enableDynamicGrid ?? true;
urlParams.normalizeToReference = batchRequestParams.normalizeToReference ?? parameters.normalizeToReference ?? true;
// ... other parameters
urlParams.trailingStopOrderType = batchRequestParams.trailingStopOrderType ?? parameters.trailingStopOrderType ?? 'limit';  // ADD THIS
```

### 5. Frontend: URLParameterManager.js

**Add to Parameter List**
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

  // Handle trailingStopOrderType
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

### 6. Frontend: App.js

**Add to State Management**
```javascript
const [backtestParams, setBacktestParams] = useState({
  // ... existing state
  trailingStopOrderType: 'limit',
});
```

**Pass to Components**
```javascript
<DCABacktestForm
  // ... existing props
  urlParams={{
    ...urlParams,
    trailingStopOrderType: backtestParams.trailingStopOrderType
  }}
/>
```

## UI Design

### Form Section Layout

```
┌─────────────────────────────────────────────────────────┐
│ Advanced Settings                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Trailing Stop Order Type                               │
│ ○ Limit (prevents buying above peak / selling below    │
│         bottom)                                         │
│ ● Market (always executes, no limit checks)            │
│                                                         │
│ ℹ️  Limit: Order cancels if price exceeds peak (buy)   │
│    or bottom (sell) reference.                         │
│    Market: Order always executes when stop is          │
│    triggered.                                          │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Trailing Buy Activation (%) - Range: 0 to 30, step 5   │
│ [x] 0  [x] 5  [x] 10  [ ] 15  [ ] 20  [ ] 25  [ ] 30  │
│                                                         │
│ Trailing Buy Rebound (%) - Range: 0 to 30, step 5     │
│ ...                                                    │
└─────────────────────────────────────────────────────────┘
```

### Transaction Log Examples

**Limit Order (Current Behavior)**
```
--- 2024-02-14 ---
Price: 25.19
  ACTION: TRAILING STOP BUY CANCELLED (LIMIT) - Price 25.19 > limit price 25.05 (peak)
  ACTION: TRAILING STOP BUY ACTIVATED - Stop: 30.23, Triggered by 0.0% drop from peak 25.19
```

**Market Order (New Behavior)**
```
--- 2024-02-14 ---
Price: 25.19
  BUY: Trailing stop (MARKET) executed at 25.19 - Lot #3 purchased
  Portfolio: 3 lots, Avg: $24.50, Current: $25.19
```

## Algorithm Changes

### Trailing Stop Buy - Limit Order (Existing)
```python
if price <= peak * (1 - activation%):
    activate_trailing_stop()
    store_peak_reference = peak

while trailing_stop_active:
    if price < last_price:
        update_stop_price()  # Track downward

    if price >= stop_price:
        if price > peak_reference:
            cancel_order()  # LIMIT CHECK
            break
        else:
            execute_buy()
            break
```

### Trailing Stop Buy - Market Order (New)
```python
if price <= peak * (1 - activation%):
    activate_trailing_stop()
    store_peak_reference = peak  # For display only

while trailing_stop_active:
    if price < last_price:
        update_stop_price()  # Track downward

    if price >= stop_price:
        execute_buy()  # NO LIMIT CHECK
        break
```

## Data Flow

### Single Mode
```
User Input (Form)
    ↓
State Update (trailingStopOrderType)
    ↓
URL Update (URLParameterManager)
    ↓
API Request
    ↓
Backend Processing
    ↓
Results with Transaction Log
    ↓
Display (with order type in logs)
```

### Batch Mode
```
User Input (Form - Non-varying)
    ↓
Batch Request (includes trailingStopOrderType)
    ↓
Backend: For each combination
    ↓
Run backtest with same orderType
    ↓
Store in batchRequestParameters
    ↓
Batch Results Display
    ↓
Click Row → Generate URL
    ↓
Use batchRequestParams.trailingStopOrderType
```

## Validation

### Frontend Validation
```javascript
const validateOrderType = (value) => {
  if (!['limit', 'market'].includes(value)) {
    return 'Invalid order type. Must be "limit" or "market".';
  }
  return null;
};
```

### Backend Validation
```javascript
if (!['limit', 'market'].includes(trailingStopOrderType)) {
  throw new Error(`Invalid trailingStopOrderType: ${trailingStopOrderType}. Must be 'limit' or 'market'.`);
}
```

## Error Handling

### Invalid Order Type
- Frontend: Show error message, prevent submission
- Backend: Return 400 Bad Request with error message
- Default: Fall back to 'limit' if value is missing or invalid

### Missing Parameter
- Default to 'limit' (preserves current behavior)
- No error thrown

## Performance Considerations

### Computational Impact
- **Negligible**: Single boolean check per price tick
- No additional loops or computations
- Market orders may execute more frequently (more buys/sells)

### Memory Impact
- **None**: No additional data structures
- Same trailing stop objects used

### API Impact
- **None**: One additional string parameter in request/response
- Parameter is simple enum, no validation overhead

## Testing Strategy

### Unit Tests
1. Test limit order cancellation when price exceeds peak
2. Test market order execution when price exceeds peak
3. Test parameter validation (valid/invalid values)
4. Test default value assignment
5. Test URL parameter parsing

### Integration Tests
1. Test full backtest with limit orders (existing behavior)
2. Test full backtest with market orders (new behavior)
3. Test batch mode with limit orders
4. Test batch mode with market orders
5. Test navigation persistence (single → batch → single)

### End-to-End Tests
1. Test URL sharing with trailingStopOrderType=market
2. Test batch result URL generation
3. Test backward compatibility (URLs without parameter)
4. Test 0% activation with both order types
5. Compare total returns: limit vs market

## Migration Plan

### Phase 1: Backend Implementation
1. Add parameter to dcaBacktestService.js
2. Update cancellation functions
3. Update execution functions
4. Add to batchBacktestService.js
5. Add validation

### Phase 2: Frontend Implementation
1. Add to URLParameterManager.js
2. Add to App.js state
3. Add UI to DCABacktestForm.js
4. Update BatchResults.js
5. Add help text and tooltips

### Phase 3: Testing
1. Unit tests for backend logic
2. Integration tests for API
3. UI tests for form
4. End-to-end tests for navigation
5. Batch mode tests

### Phase 4: Documentation
1. Update code comments
2. Add to transaction logs
3. Update user documentation (if exists)
4. Add examples to spec

## Backward Compatibility

### Existing URLs
```
http://localhost:3000/backtest?symbol=PLTR&...
→ trailingStopOrderType defaults to 'limit'
→ Behavior unchanged
```

### New URLs
```
http://localhost:3000/backtest?symbol=PLTR&...&trailingStopOrderType=market
→ Market order behavior applied
→ No limit checks
```

### Database/Storage
- No database changes required (parameter is ephemeral)
- URL-based, no persistence layer

## Security Considerations

### Input Validation
- Validate enum values on backend
- Sanitize user input on frontend
- Reject invalid values with clear error

### No Security Risks
- Parameter does not affect authentication
- Parameter does not expose sensitive data
- Parameter is read-only from user perspective (no write operations)

## Future Enhancements

### Potential Future Features
1. **Per-Direction Order Types**: Separate types for buy vs sell
2. **Hybrid Strategy**: Use limit for buys, market for sells (or vice versa)
3. **Conditional Order Type**: Use market if limit fails X times
4. **Order Type Analytics**: Track execution rate by order type
5. **Batch Range Parameter**: Test multiple order types in single batch (currently out of scope)

### Extension Points
- Add new order types (e.g., "stop-limit-with-fallback")
- Add order type to Future Trade section display
- Add order type to batch results table column
