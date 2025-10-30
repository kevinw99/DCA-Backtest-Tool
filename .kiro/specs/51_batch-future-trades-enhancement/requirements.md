# Spec 51: Batch Future Trades Enhancement

## Overview
Enhance the "Future Trades by Stock" section in the batch backtest results page to display additional context information: last trade details, local peak, and local bottom with their respective prices and dates.

## Current State

### Frontend (BatchResults.js)
The `FutureTradeCard` component currently displays:
- Current price and date
- Average cost (if holdings exist)
- Next BUY section:
  - PENDING: Activation price, reference price, rebound percentage
  - ACTIVE: Stop price, lowest price, rebound percentage
- Next SELL section:
  - PENDING: Activation price, reference price, pullback percentage, profit target
  - ACTIVE: Stop price, limit price, last update price, pullback percentage, profit target

### Backend (batchBacktestService.js)
The `calculateFutureTradesForResult` function returns:
```javascript
{
  currentPrice,
  currentPriceDate,
  avgCost,
  hasHoldings,
  isShortStrategy,
  recentPeak,           // Price only, no date
  recentBottom,         // Price only, no date
  buyActivation,
  sellActivation
}
```

### Data Available in Executor
The DCA executor (`dcaExecutor.js`) tracks:
- `recentPeak`: Highest price since last transaction (no date stored)
- `recentBottom`: Lowest price since last transaction (no date stored)
- `lastTransactionDate`: Date of last transaction (no price stored)
- `enhancedTransactions`: Array of all transactions with dates and prices

## Requirements

### FR1: Display Last Trade Information
**Priority: High**

Display the most recent trade (BUY or SELL) with:
- Trade type (BUY/SELL or SHORT/COVER for short strategy)
- Trade price
- Trade date
- Clearly labeled as "Last Trade"

**Acceptance Criteria:**
- Last trade info shows in the FutureTradeCard
- Displays "N/A" if no trades have occurred yet
- Shows the most recent transaction regardless of type
- Uses clear keywords: "Last Trade"

### FR2: Display Local Peak Information
**Priority: High**

Display the local peak (highest price since last transaction) with:
- Peak price
- Date when peak occurred
- Clearly labeled as "Peak"

**Acceptance Criteria:**
- Peak info shows in the FutureTradeCard
- Displays "N/A" if no peak has been tracked
- Shows price and date clearly
- Uses clear keywords: "Peak"

### FR3: Display Local Bottom Information
**Priority: High**

Display the local bottom (lowest price since last transaction) with:
- Bottom price
- Date when bottom occurred
- Clearly labeled as "Bottom"

**Acceptance Criteria:**
- Bottom info shows in the FutureTradeCard
- Displays "N/A" if no bottom has been tracked
- Shows price and date clearly
- Uses clear keywords: "Bottom"

### FR4: Backend Date Tracking
**Priority: High**

Enhance the backend to track dates for peak/bottom:
- Track `recentPeakDate` in dcaExecutor.js
- Track `recentBottomDate` in dcaExecutor.js
- Include these dates in the returned result
- Pass these dates through batchBacktestService.js to frontend

**Acceptance Criteria:**
- Peak date is tracked and updated when peak changes
- Bottom date is tracked and updated when bottom changes
- Dates are included in the futureTrades object
- Same implementation for both long and short strategies

### FR5: Last Trade Extraction
**Priority: High**

Extract last trade information from transaction history:
- Get the most recent transaction from `enhancedTransactions`
- Include trade type, price, and date
- Handle cases where no transactions exist yet

**Acceptance Criteria:**
- Last trade is correctly identified from transaction history
- Works for both BUY and SELL transactions
- Works for both long and short strategies
- Handles empty transaction history gracefully

### FR6: UI Layout Enhancement
**Priority: Medium**

Retrofit the current info box to include new information:
- Add a new section above or below current price section
- Display last trade, peak, and bottom in a compact format
- Ensure readability and clear visual separation
- Maintain responsive design

**Acceptance Criteria:**
- New information is easy to find and read
- Keywords "Last Trade", "Peak", "Bottom" are clearly visible
- Layout doesn't break on different screen sizes
- Visual hierarchy is maintained

## Non-Functional Requirements

### NFR1: Performance
- Data extraction should not significantly impact batch backtest performance
- Additional tracking should have minimal memory overhead

### NFR2: Maintainability
- Code should follow existing patterns in dcaExecutor.js
- Clear comments explaining the new tracking logic
- Consistent with existing code style

### NFR3: Compatibility
- Works with both long and short DCA strategies
- Compatible with all existing batch backtest parameters
- No breaking changes to existing API contracts

## Out of Scope
- Historical peak/bottom tracking (only track since last transaction)
- Multiple peak/bottom tracking (only track global peak/bottom since last transaction)
- Trade performance analysis (focus on information display only)

## URL Parameter Duplication Issue
**Priority: Medium**

**Issue:** The batch results URL contains duplicate symbol lists:
- Path: `/batch/TSLA+APP+HOOD+...`
- Query: `?symbols=TSLA%2CAPP%2CHOOD%2C...`

**Investigation Required:**
- Determine which parameter is actually used by the backend
- Check if both are necessary for routing
- Recommend which to keep (likely the query parameter for consistency)
- Update URL generation logic if needed

**Decision Criteria:**
- Backend should use only one source for symbols
- Frontend should generate URLs with only one symbol list
- Prefer query parameters over path parameters for flexibility
- Ensure backward compatibility with existing bookmarked URLs

## Success Metrics
1. FutureTradeCard displays all three new pieces of information
2. Backend correctly tracks and returns peak/bottom dates
3. Last trade information is accurate and up-to-date
4. No performance degradation in batch backtests
5. URL duplication issue is investigated and documented
