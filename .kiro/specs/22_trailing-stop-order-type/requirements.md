# Requirements: Trailing Stop Order Type Parameter

## Overview
Add a new parameter `trailingStopOrderType` to control whether trailing stop orders (both buy and sell) execute as **limit orders** (current behavior) or **market orders** (new behavior).

## Business Requirements

### BR-1: Order Type Selection
- **Requirement**: Users must be able to choose between "limit" and "market" order types for trailing stops
- **Default**: "limit" (preserves current behavior)
- **Scope**: Applies to both trailing stop buy and trailing stop sell orders
- **Rationale**: Limit orders prevent buying above peak or selling below bottom, but may miss execution opportunities. Market orders guarantee execution but may execute at unfavorable prices.

### BR-2: Limit Order Behavior (Current - Default)
- **Trailing Stop Buy**:
  - Order activates when price drops by activation %
  - Order executes when price rebounds by rebound %
  - **Limit**: Order CANCELS if price exceeds the peak reference price (prevents buying higher than earlier opportunity)
- **Trailing Stop Sell**:
  - Order activates when price rises by activation %
  - Order executes when price pulls back by pullback %
  - **Limit**: Order CANCELS if price falls below the bottom reference price (prevents selling lower than earlier opportunity)

### BR-3: Market Order Behavior (New)
- **Trailing Stop Buy**:
  - Order activates when price drops by activation %
  - Order executes when price rebounds by rebound %
  - **No Limit**: Order executes at current market price regardless of peak reference
  - No cancellation due to price exceeding peak
- **Trailing Stop Sell**:
  - Order activates when price rises by activation %
  - Order executes when price pulls back by pullback %
  - **No Limit**: Order executes at current market price regardless of bottom reference
  - No cancellation due to price falling below bottom

### BR-4: Parameter Persistence
- Parameter must persist across page navigation (single ↔ batch ↔ results)
- URL parameter must be preserved in shareable links
- Batch results must preserve the parameter when generating individual run URLs

### BR-5: UI Presentation
- Display as radio button or dropdown in the form
- Show in both single and batch mode forms
- Include in parameter summary/display sections
- Show in batch results table if it varies across combinations

### BR-6: Backward Compatibility
- If parameter is not provided, default to "limit"
- Existing URLs without this parameter should work with default behavior

## Functional Requirements

### FR-1: Parameter Definition
- **Name**: `trailingStopOrderType`
- **Type**: String (enum)
- **Values**: `"limit"` | `"market"`
- **Default**: `"limit"`
- **Validation**: Must be one of the allowed values

### FR-2: Single Mode Support
- Accept parameter from URL query string
- Display in form UI
- Persist in URL when navigating
- Include in API request to backend
- Show in results page URL

### FR-3: Batch Mode Support
- Accept parameter at batch request level (applies to all combinations)
- NOT a range parameter (same value for all combinations)
- Include in batch request payload
- Persist in `batchRequestParameters` in batch response
- Use when generating individual run URLs from batch results

### FR-4: Backend Processing
- Accept parameter in DCA backtest API endpoint
- Use in trailing stop buy/sell logic
- Skip limit price checks when orderType is "market"
- Log order type in transaction logs for debugging

### FR-5: URL Parameter Handling
- **Frontend to Backend**: Pass as `trailingStopOrderType=limit` or `trailingStopOrderType=market`
- **URL Encoding**: No special encoding needed (simple string)
- **Case Sensitivity**: Lowercase only
- **URLParameterManager**: Add to managed parameters list

### FR-6: Transaction Logging
- Include order type in activation messages
- Distinguish between limit and market order execution logs
- Show when limit orders are cancelled (limit mode only)
- Show when market orders execute despite exceeding limit reference

## Non-Functional Requirements

### NFR-1: Performance
- No performance impact - simple boolean-like check
- No additional API calls required

### NFR-2: Testing
- Must test both limit and market modes
- Must test with 0% activation scenarios
- Must verify cancellation behavior differences
- Must verify URL persistence across navigation

### NFR-3: Documentation
- Update inline code comments
- Document in transaction logs
- Include in parameter descriptions

## Use Cases

### UC-1: Aggressive Entry Strategy (Market Order)
**Scenario**: User wants to ensure buy orders execute even if price rebounds strongly
- Set `trailingStopOrderType=market`
- Set `trailingBuyActivationPercent=5%`
- Set `trailingBuyReboundPercent=5%`
- **Result**: Order activates on 5% drop, executes on 5% rebound, even if price exceeds peak

### UC-2: Conservative Entry Strategy (Limit Order - Default)
**Scenario**: User wants to prevent buying at prices higher than recent peak
- Set `trailingStopOrderType=limit` (or omit - default)
- Set `trailingBuyActivationPercent=5%`
- Set `trailingBuyReboundPercent=5%`
- **Result**: Order activates on 5% drop, executes on 5% rebound, but cancels if price exceeds peak

### UC-3: Zero Activation with Market Order
**Scenario**: User wants immediate entry on any price movement
- Set `trailingStopOrderType=market`
- Set `trailingBuyActivationPercent=0%`
- **Result**: Order activates immediately, executes on rebound, never cancels due to peak

### UC-4: Batch Testing Different Order Types
**Scenario**: User wants to compare limit vs market order performance
- Run two separate batches:
  - Batch 1: `trailingStopOrderType=limit` with various trailing parameters
  - Batch 2: `trailingStopOrderType=market` with same trailing parameters
- **Result**: Can compare total returns and execution rates

## Out of Scope

### OS-1: Per-Direction Order Types
- Not supporting separate order types for buy vs sell
- Both buy and sell use the same order type setting
- **Rationale**: Adds complexity without clear use case
- **Future**: Can be added if user requests it

### OS-2: Stop-Loss Order Types
- Not applicable to hard stop loss or portfolio stop loss
- Only affects trailing stop buy and trailing stop sell
- **Rationale**: Stop losses are always market orders by nature

### OS-3: Range Parameter in Batch Mode
- Order type is NOT a range parameter
- Cannot test multiple order types in a single batch
- **Rationale**: Order type affects execution strategy fundamentally; should be consistent across a batch
- **Workaround**: Run separate batches for different order types

## Success Criteria

1. ✅ Parameter accepts "limit" and "market" values
2. ✅ Default value is "limit" (current behavior)
3. ✅ Market orders execute without limit price checks
4. ✅ Limit orders continue to cancel when exceeding limits
5. ✅ Parameter persists across page navigation
6. ✅ Parameter appears in URLs and is shareable
7. ✅ Batch mode preserves parameter in individual run URLs
8. ✅ Transaction logs clearly indicate order type
9. ✅ UI displays option in both single and batch forms
10. ✅ Backward compatible with existing URLs (default to limit)

## Acceptance Criteria

### AC-1: Limit Order Mode (Default)
```
GIVEN a trailing stop buy with trailingStopOrderType=limit
WHEN price drops 10% (activation) and rebounds 5%
AND price exceeds the peak reference
THEN order is CANCELLED
AND no buy is executed
```

### AC-2: Market Order Mode
```
GIVEN a trailing stop buy with trailingStopOrderType=limit
WHEN price drops 10% (activation) and rebounds 5%
AND price exceeds the peak reference
THEN order EXECUTES at current market price
AND buy is completed
```

### AC-3: URL Persistence
```
GIVEN a user sets trailingStopOrderType=market in single mode
WHEN navigating to batch mode and back to single mode
THEN trailingStopOrderType remains "market"
```

### AC-4: Batch Parameter Preservation
```
GIVEN a batch request with trailingStopOrderType=market
WHEN clicking an individual result row
THEN the individual run URL contains trailingStopOrderType=market
```

### AC-5: Backward Compatibility
```
GIVEN a URL without trailingStopOrderType parameter
WHEN loading the backtest
THEN trailingStopOrderType defaults to "limit"
AND behavior matches current/existing behavior
```

## Dependencies

### Code Files
- `backend/services/dcaBacktestService.js` - Core backtest logic
- `backend/services/batchBacktestService.js` - Batch processing
- `frontend/src/components/DCABacktestForm.js` - Form UI
- `frontend/src/components/BatchResults.js` - Batch results display
- `frontend/src/utils/URLParameterManager.js` - URL parameter handling
- `frontend/src/App.js` - Parameter state management

### Related Features
- Trailing stop buy/sell logic
- Batch parameter preservation (recently implemented)
- URL parameter conversion (recently fixed)

## Risks and Mitigations

### Risk 1: Breaking Existing Behavior
- **Mitigation**: Default to "limit" preserves current behavior
- **Mitigation**: Extensive testing with existing URLs

### Risk 2: User Confusion
- **Mitigation**: Clear UI labels explaining limit vs market
- **Mitigation**: Transaction logs clearly show order type and execution/cancellation

### Risk 3: Batch Parameter Mismatch
- **Mitigation**: Use `batchRequestParameters` pattern (already implemented)
- **Mitigation**: Test URL generation from batch results

## Questions to Resolve

1. ❓ Should we add a tooltip or help text to explain the difference between limit and market orders?
2. ❓ Should transaction logs use different colors for limit vs market order execution?
3. ❓ Should the Future Trade section indicate the order type?
