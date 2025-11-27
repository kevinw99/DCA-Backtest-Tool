# Spec 51: Design Document

## Architecture Overview

This enhancement involves three layers:
1. **Data Collection** (dcaExecutor.js): Track peak/bottom dates during backtest execution
2. **Data Aggregation** (batchBacktestService.js): Extract last trade info and pass all data to frontend
3. **Data Display** (BatchResults.js): Render new information in FutureTradeCard component

## Backend Design

### 1. DCA Executor Enhancement (dcaExecutor.js)

#### Current State
```javascript
let recentPeak = null;      // Price only
let recentBottom = null;    // Price only
let lastTransactionDate = null;  // Date only
```

#### Proposed Changes
```javascript
let recentPeak = null;
let recentBottom = null;
let recentPeakDate = null;     // NEW: Track when peak occurred
let recentBottomDate = null;   // NEW: Track when bottom occurred
let lastTransactionDate = null;
```

#### Implementation Details

**Location: Lines 416-420 (Variable initialization)**
```javascript
// Recent Peak/Bottom Tracking System
let recentPeak = null;        // Highest price since last transaction
let recentBottom = null;      // Lowest price since last transaction
let recentPeakDate = null;    // NEW: Date when peak occurred
let recentBottomDate = null;  // NEW: Date when bottom occurred
let trailingStopBuy = null;
let lastTransactionDate = null;
```

**Location: Lines 517-522 (resetPeakBottomTracking function)**
```javascript
const resetPeakBottomTracking = (currentPrice, currentDate) => {
  recentPeak = currentPrice;
  recentBottom = currentPrice;
  recentPeakDate = currentDate;      // NEW
  recentBottomDate = currentDate;    // NEW
  lastTransactionDate = currentDate;
  transactionLog.push(colorize(
    `  ACTION: Reset peak/bottom tracking - Peak: ${currentPrice.toFixed(2)} (${currentDate}), Bottom: ${currentPrice.toFixed(2)} (${currentDate})`,
    'cyan'
  ));
};
```

**Location: Lines 525-532 (updatePeakBottomTracking function)**
```javascript
const updatePeakBottomTracking = (currentPrice, currentDate) => {
  if (recentPeak === null || currentPrice > recentPeak) {
    recentPeak = currentPrice;
    recentPeakDate = currentDate;  // NEW
  }
  if (recentBottom === null || currentPrice < recentBottom) {
    recentBottom = currentPrice;
    recentBottomDate = currentDate;  // NEW
  }
};
```

**Key Considerations:**
- Must pass `currentDate` parameter to `updatePeakBottomTracking()` wherever it's called
- Need to find all call sites and update them
- Initialize dates on first day (lines 1764-1768)

**Location: Lines 1764-1768 (First day initialization)**
```javascript
if (recentPeak === null || recentBottom === null) {
  recentPeak = currentPrice;
  recentBottom = currentPrice;
  recentPeakDate = dayData.date;      // NEW
  recentBottomDate = dayData.date;    // NEW
  lastTransactionDate = dayData.date;
}
```

**Return Value Enhancement:**
Add `recentPeakDate` and `recentBottomDate` to the return object in `getResults()` function.

### 2. Batch Backtest Service Enhancement (batchBacktestService.js)

#### Location: Lines 282-384 (calculateFutureTradesForResult function)

**Extract Last Trade Information:**
```javascript
function calculateFutureTradesForResult(result) {
  const {
    lots = [],
    shorts = [],
    activeTrailingStopBuy,
    activeTrailingStopSell,
    recentPeak,
    recentBottom,
    recentPeakDate,      // NEW
    recentBottomDate,    // NEW
    backtestParameters: params,
    summary,
    finalMarketPrice,
    enhancedTransactions = []  // Extract transactions
  } = result;

  // ... existing code ...

  // NEW: Extract last trade information
  let lastTrade = null;
  if (enhancedTransactions.length > 0) {
    // Get the last transaction
    const lastTransaction = enhancedTransactions[enhancedTransactions.length - 1];
    lastTrade = {
      type: lastTransaction.type,
      price: lastTransaction.price,
      date: lastTransaction.date
    };
  }

  return {
    currentPrice,
    currentPriceDate: params.endDate,
    avgCost,
    hasHoldings,
    isShortStrategy,
    recentPeak,
    recentBottom,
    recentPeakDate,    // NEW
    recentBottomDate,  // NEW
    lastTrade,         // NEW
    buyActivation,
    sellActivation
  };
}
```

**Key Considerations:**
- `enhancedTransactions` should be included in the result object from executor
- Last transaction is the final element in the array
- Handle empty array case gracefully

### 3. Short DCA Executor Enhancement (shortDCABacktestService.js)

**Same Changes Required:**
- The short DCA strategy likely has its own executor
- Need to apply identical changes for consistency
- Track `recentPeakDate` and `recentBottomDate`
- Return these values in the result

## Frontend Design

### Component Structure

**Location: BatchResults.js, FutureTradeCard component (lines 10-239)**

#### New Section: Trading Context

Add a new section between the header and the trade directions section to display:
1. Last Trade
2. Local Peak
3. Local Bottom

```javascript
{isExpanded && (
  <div className="card-body">
    {/* NEW: Trading Context Section */}
    <div className="trading-context-section">
      <h5>Trading Context</h5>
      <div className="context-grid">
        {/* Last Trade */}
        <div className="context-item">
          <span className="context-label">Last Trade:</span>
          {futureTrades.lastTrade ? (
            <span className="context-value">
              {futureTrades.lastTrade.type} at {formatCurrency(futureTrades.lastTrade.price)}
              <span className="context-date"> on {futureTrades.lastTrade.date}</span>
            </span>
          ) : (
            <span className="context-value">N/A</span>
          )}
        </div>

        {/* Local Peak */}
        <div className="context-item">
          <span className="context-label">Peak:</span>
          {futureTrades.recentPeak && futureTrades.recentPeakDate ? (
            <span className="context-value">
              {formatCurrency(futureTrades.recentPeak)}
              <span className="context-date"> on {futureTrades.recentPeakDate}</span>
            </span>
          ) : (
            <span className="context-value">N/A</span>
          )}
        </div>

        {/* Local Bottom */}
        <div className="context-item">
          <span className="context-label">Bottom:</span>
          {futureTrades.recentBottom && futureTrades.recentBottomDate ? (
            <span className="context-value">
              {formatCurrency(futureTrades.recentBottom)}
              <span className="context-date"> on {futureTrades.recentBottomDate}</span>
            </span>
          ) : (
            <span className="context-value">N/A</span>
          )}
        </div>
      </div>
    </div>

    {/* Existing: Current Price Section */}
    <div className="current-price-section">
      {/* ... existing code ... */}
    </div>

    {/* Existing: Trade Directions */}
    <div className="trade-directions">
      {/* ... existing code ... */}
    </div>
  </div>
)}
```

#### Styling Approach

Add new CSS classes in the same file or in a separate stylesheet:

```css
.trading-context-section {
  margin-bottom: 15px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.trading-context-section h5 {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: #555;
}

.context-grid {
  display: grid;
  gap: 8px;
}

.context-item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
}

.context-label {
  font-weight: 600;
  color: #666;
  min-width: 90px;
}

.context-value {
  color: #333;
  font-weight: 500;
}

.context-date {
  color: #888;
  font-size: 0.9em;
  font-weight: normal;
}
```

## Data Flow Diagram

```
┌─────────────────────┐
│   DCA Executor      │
│  (dcaExecutor.js)   │
└──────────┬──────────┘
           │ Track dates during execution
           │ - recentPeakDate
           │ - recentBottomDate
           │ - enhancedTransactions
           ↓
┌─────────────────────┐
│   DCA Backtest      │
│ (dcaBacktestService)│
└──────────┬──────────┘
           │ Return full result
           ↓
┌─────────────────────┐
│  Batch Backtest     │
│(batchBacktestSvc.js)│
│                     │
│ calculateFuture-    │
│ TradesForResult()   │
└──────────┬──────────┘
           │ Extract & format data
           │ - recentPeak + recentPeakDate
           │ - recentBottom + recentBottomDate
           │ - lastTrade from transactions
           ↓
┌─────────────────────┐
│   API Response      │
│  (JSON to Frontend) │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   BatchResults      │
│   Component         │
│                     │
│ FutureTradeCard     │
│ Display new info    │
└─────────────────────┘
```

## URL Parameter Duplication Investigation

### Current State Analysis

**URL Structure:**
```
/batch/TSLA+APP+HOOD+.../results?symbols=TSLA%2CAPP%2CHOOD%2C...&startDate=...
```

**Two Symbol Lists:**
1. **Path Parameter**: `/batch/TSLA+APP+HOOD+...`
2. **Query Parameter**: `?symbols=TSLA%2CAPP%2CHOOD%2C...`

### Investigation Steps

1. **Check Frontend Routing** (React Router configuration)
   - File: `frontend/src/App.js` or routing configuration
   - Determine if path parameter is used for routing only
   - Check if query parameter is what's actually sent to backend

2. **Check Backend API**
   - File: `backend/routes/*.js`
   - Determine which parameter the backend reads
   - Likely uses query parameter for actual data

3. **Check URL Generation**
   - File: `frontend/src/utils/URLParameterManager.js`
   - Method: `generateShareableURL()` for batch mode
   - Check why both parameters are included

### Recommended Solution

**Option 1: Keep Query Parameter Only (Recommended)**
```
/batch/results?symbols=TSLA%2CAPP%2CHOOD%2C...&startDate=...
```
- Cleaner URL structure
- Standard REST API practice
- Easier to parse and modify
- Better for URLs with many parameters

**Option 2: Keep Path Parameter Only**
```
/batch/TSLA+APP+HOOD+.../results?startDate=...
```
- More RESTful URL structure
- Better for bookmarking
- Requires URL encoding in path
- May hit URL length limits with many symbols

**Implementation:**
- Choose Option 1 for flexibility
- Update URLParameterManager.js
- Update routing configuration
- Ensure backward compatibility

## Error Handling

### Backend
- Handle missing `enhancedTransactions` gracefully
- Return `null` for missing peak/bottom dates
- Log warnings for data inconsistencies

### Frontend
- Display "N/A" for missing data
- Handle null/undefined values
- Provide fallbacks for missing dates

## Testing Strategy

### Unit Tests
- Test peak/bottom date tracking in executor
- Test last trade extraction
- Test null/undefined handling

### Integration Tests
- Run batch backtest with curl
- Verify new fields in API response
- Check frontend display

### Manual Testing
- Test with various stocks
- Test with empty transaction history
- Test with long and short strategies

## Backward Compatibility

- New fields are additive (no breaking changes)
- Existing functionality remains unchanged
- Old API consumers can ignore new fields
- Frontend gracefully handles missing new fields

## Performance Considerations

- Date tracking adds minimal overhead (two string assignments per price update)
- Last trade extraction is O(1) (last element access)
- No additional loops or complex operations
- Memory impact negligible (two additional string variables)

## Future Enhancements (Out of Scope)

- Historical peak/bottom tracking (track multiple peaks/bottoms)
- Peak/bottom visualization on charts
- Trade performance analysis
- Alert system for peak/bottom events
