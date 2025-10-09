# Spec 22: Trailing Stop Order Type Parameter

## Overview
Add a `trailingStopOrderType` parameter to control whether trailing stop orders execute as **limit orders** (current behavior with cancellation when price exceeds peak/bottom) or **market orders** (always execute, no cancellation).

## Quick Summary

### Problem
Currently, trailing stop orders use limit prices to prevent:
- **Buy orders**: Executing above the peak price (cancels if price exceeds peak)
- **Sell orders**: Executing below the bottom price (cancels if price falls below bottom)

With `trailingBuyActivationPercent=0%`, orders activate immediately but still cancel if price rebounds past the peak, which may not be the desired behavior for aggressive entry strategies.

### Solution
Add a new parameter `trailingStopOrderType`:
- **`limit`** (default): Current behavior - cancels when price exceeds peak/bottom
- **`market`**: New behavior - always executes when stop is triggered, no cancellation

### Benefits
1. **Flexibility**: Users can choose between conservative (limit) and aggressive (market) strategies
2. **Guaranteed Execution**: Market orders ensure entries/exits happen when stop is triggered
3. **0% Activation**: Makes 0% activation more useful for immediate entry strategies
4. **Backward Compatible**: Defaults to 'limit', preserving existing behavior

## Key Features

### Limit Order (Default - Current Behavior)
```
Price drops 10% → Activate trailing stop (store peak = 25.05)
Price rebounds 5% → Check execution
Price = 25.19 > peak 25.05 → CANCEL order (limit exceeded)
```

### Market Order (New Behavior)
```
Price drops 10% → Activate trailing stop (store peak = 25.05)
Price rebounds 5% → Check execution
Price = 25.19 > peak 25.05 → EXECUTE at 25.19 (no limit check)
```

## Implementation Scope

### Backend Changes
- `backend/services/dcaBacktestService.js`: Add parameter, update cancellation logic
- `backend/services/batchBacktestService.js`: Include in batchRequestParameters

### Frontend Changes
- `frontend/src/utils/URLParameterManager.js`: Add to URL handling
- `frontend/src/App.js`: Add to state management
- `frontend/src/components/DCABacktestForm.js`: Add UI radio buttons
- `frontend/src/components/BatchResults.js`: Preserve in batch result URLs

### Files Changed
- 6 files total
- ~200 lines of code added/modified
- Estimated time: 6.25 hours

## Usage Examples

### Single Mode
```
http://localhost:3000/backtest?symbol=PLTR&startDate=2021-09-01&endDate=2025-10-08
  &trailingBuyActivationPercent=0
  &trailingBuyReboundPercent=20
  &trailingStopOrderType=market  ← Always execute, never cancel
  &...
```

### Batch Mode
```json
{
  "symbols": ["PLTR", "AAPL"],
  "trailingStopOrderType": "market",
  "parameterRanges": {
    "trailingBuyActivationPercent": [0, 5, 10],
    "trailingBuyReboundPercent": [5, 10, 20],
    ...
  }
}
```

## Transaction Log Examples

### Before (Limit Order - Current)
```
--- 2024-02-14 ---
Price: 25.19
  ACTION: TRAILING STOP BUY CANCELLED (LIMIT) - Price 25.19 > limit price 25.05 (peak)
  ACTION: TRAILING STOP BUY ACTIVATED - Stop: 30.23, Triggered by 0.0% drop from peak 25.19
```

### After (Market Order - New)
```
--- 2024-02-14 ---
Price: 25.19
  BUY: Trailing stop (MARKET) executed at 25.19 - Lot #3 purchased
  Portfolio: 3 lots, Avg: $24.50, Current: $25.19
```

## Documents

- **[requirements.md](./requirements.md)**: Detailed business and functional requirements
- **[design.md](./design.md)**: Architecture, component design, data flow
- **[tasks.md](./tasks.md)**: Implementation tasks with time estimates

## Status

- [x] Requirements defined
- [x] Design completed
- [x] Tasks planned
- [ ] Implementation started
- [ ] Backend complete
- [ ] Frontend complete
- [ ] Testing complete
- [ ] Documentation updated
- [ ] Deployed

## Next Steps

1. Start with Phase 1: Backend Implementation
   - Task 1.1: Add parameter to dcaBacktestService.js
   - Task 1.2: Update buy cancellation logic
   - Task 1.3: Update sell cancellation logic
   - Tasks 1.4-1.7: Logging and batch support

2. Phase 2: Frontend Implementation
   - Add URL parameter handling
   - Add UI components
   - Add batch result URL preservation

3. Phase 3: Testing
   - Unit tests for cancellation logic
   - Integration tests for API
   - End-to-end tests for navigation
   - Manual testing with real scenarios

4. Phase 4: Documentation
   - Update code comments
   - Finalize transaction log format
   - Update spec with implementation notes

## Questions & Decisions

### Resolved
- ✅ Parameter name: `trailingStopOrderType` (clear and descriptive)
- ✅ Values: `'limit'` and `'market'` (industry standard terms)
- ✅ Default: `'limit'` (preserves current behavior)
- ✅ Scope: Applies to both buy and sell (simplicity)
- ✅ Batch mode: Non-varying parameter (consistent strategy per batch)

### Open Questions
- ❓ Should we add tooltip/help text explaining the difference?
  - **Recommendation**: Yes, add help text below radio buttons
- ❓ Should transaction logs use different colors for limit vs market?
  - **Recommendation**: No, use label in parentheses for clarity
- ❓ Should Future Trade section indicate order type?
  - **Recommendation**: Future enhancement, not in scope for v1

## Testing Plan

### Critical Test Scenarios
1. **0% Activation + Limit**: Verify cancellation when price exceeds peak
2. **0% Activation + Market**: Verify execution without cancellation
3. **Batch Mode**: Verify parameter preservation in individual URLs
4. **URL Navigation**: Verify parameter persists across pages
5. **Backward Compatibility**: Verify existing URLs work with default

### Success Criteria
- All existing limit order tests pass (no regression)
- Market orders execute without cancellation
- Transaction logs clearly show order type
- URL sharing works correctly
- Batch mode preserves parameter

## Related Features

- **Trailing Stop Buy/Sell**: Core feature being enhanced
- **Batch Parameter Preservation**: Recently implemented (Spec 21)
- **Future Trade Display**: Could show order type in future
- **URL Parameter Conversion**: Handles percentage conversion

## Impact Analysis

### Performance
- **Negligible**: Single boolean check per price tick
- No additional API calls or data structures

### User Experience
- **Positive**: More control over execution strategy
- **Learning Curve**: Minimal (clear labels and help text)
- **Backward Compatible**: Existing behavior unchanged

### Code Complexity
- **Low**: Simple conditional logic
- **Maintainable**: Follows existing patterns
- **Testable**: Easy to test both modes

## References

- Original issue: User question about 0% activation cancellation
- Related: Batch URL parameter preservation (Spec 21)
- Transaction log format: dcaBacktestService.js lines 600-950
