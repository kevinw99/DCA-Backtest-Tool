# Spec 51: Implementation Tasks

## Phase 1: Backend Implementation

### Task 1.1: Enhance DCA Executor Peak/Bottom Date Tracking
**File:** `backend/services/dcaExecutor.js`
**Priority:** High
**Estimated Time:** 30 minutes

**Changes:**

1. **Lines 416-420**: Add date tracking variables
   ```javascript
   let recentPeak = null;
   let recentBottom = null;
   let recentPeakDate = null;      // NEW
   let recentBottomDate = null;    // NEW
   let trailingStopBuy = null;
   let lastTransactionDate = null;
   ```

2. **Lines 517-522**: Update `resetPeakBottomTracking` function
   ```javascript
   const resetPeakBottomTracking = (currentPrice, currentDate) => {
     recentPeak = currentPrice;
     recentBottom = currentPrice;
     recentPeakDate = currentDate;      // NEW
     recentBottomDate = currentDate;    // NEW
     lastTransactionDate = currentDate;
     transactionLog.push(colorize(
       `  ACTION: Reset peak/bottom tracking - Peak: ${currentPrice.toFixed(2)} (${currentDate}), ` +
       `Bottom: ${currentPrice.toFixed(2)} (${currentDate})`,
       'cyan'
     ));
   };
   ```

3. **Lines 525-532**: Update `updatePeakBottomTracking` function
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

4. **Find and update all calls to `updatePeakBottomTracking`**
   - Search for: `updatePeakBottomTracking(`
   - Add `currentDate` or `dayData.date` parameter to all calls
   - Expected locations: Daily loop, after executions, etc.

5. **Lines 1764-1768**: Update first day initialization
   ```javascript
   if (recentPeak === null || recentBottom === null) {
     recentPeak = currentPrice;
     recentBottom = currentPrice;
     recentPeakDate = dayData.date;      // NEW
     recentBottomDate = dayData.date;    // NEW
     lastTransactionDate = dayData.date;
   }
   ```

6. **Update return object in `getResults()`**
   - Find the return statement (near end of file)
   - Add `recentPeakDate` and `recentBottomDate` to the returned object

**Verification:**
- Run a single backtest and check console logs for peak/bottom dates
- Verify dates update correctly when peak/bottom changes

---

### Task 1.2: Enhance Short DCA Executor
**File:** `backend/services/shortDCABacktestService.js` (if separate)
**Priority:** High
**Estimated Time:** 20 minutes

**Changes:**
- Apply identical changes from Task 1.1 to short DCA executor
- Ensure consistency between long and short strategies

**Verification:**
- Run a short backtest and verify peak/bottom dates

---

### Task 1.3: Extract Last Trade in Batch Service
**File:** `backend/services/batchBacktestService.js`
**Priority:** High
**Estimated Time:** 20 minutes

**Changes:**

1. **Lines 282-384**: Update `calculateFutureTradesForResult` function

   **a. Add to destructuring (line 283):**
   ```javascript
   const {
     lots = [],
     shorts = [],
     activeTrailingStopBuy,
     activeTrailingStopSell,
     recentPeak,
     recentBottom,
     recentPeakDate,        // NEW
     recentBottomDate,      // NEW
     backtestParameters: params,
     summary,
     finalMarketPrice,
     enhancedTransactions = []  // NEW (if not already there)
   } = result;
   ```

   **b. Add last trade extraction (after line 310):**
   ```javascript
   // Extract last trade information
   let lastTrade = null;
   if (enhancedTransactions && enhancedTransactions.length > 0) {
     const lastTransaction = enhancedTransactions[enhancedTransactions.length - 1];
     lastTrade = {
       type: lastTransaction.type,
       price: lastTransaction.price,
       date: lastTransaction.date
     };
   }
   ```

   **c. Update return statement (lines 373-383):**
   ```javascript
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
   ```

**Verification:**
- Run batch backtest with curl
- Check API response for new fields
- Verify values are correct

---

## Phase 2: Frontend Implementation

### Task 2.1: Add Trading Context Section to FutureTradeCard
**File:** `frontend/src/components/BatchResults.js`
**Priority:** High
**Estimated Time:** 30 minutes

**Changes:**

1. **Lines 63-68**: Add new section after card-body opening div

   Insert between line 64 (opening `<div className="card-body">`) and line 65 (existing `<div className="current-price-section">`):

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
                 <strong>{futureTrades.lastTrade.type}</strong> at{' '}
                 {formatCurrency(futureTrades.lastTrade.price)}
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

       {/* Existing sections continue below */}
       <div className="current-price-section">
         {/* ... existing code ... */}
       </div>
   ```

**Verification:**
- Check UI renders correctly
- Verify all three items display
- Check N/A shows when data missing

---

### Task 2.2: Add CSS Styling for Trading Context
**File:** `frontend/src/components/BatchResults.js` or stylesheet
**Priority:** Medium
**Estimated Time:** 15 minutes

**Changes:**

Add inline styles or external CSS:

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

**Note:** If using inline styles in JSX, convert to JavaScript object format.

**Verification:**
- Visual inspection of styling
- Check responsive behavior
- Verify readability

---

## Phase 3: URL Investigation

### Task 3.1: Investigate URL Parameter Duplication
**Files:**
- `frontend/src/utils/URLParameterManager.js`
- `frontend/src/App.js` (or routing config)
- `backend/routes/*.js`

**Priority:** Medium
**Estimated Time:** 30 minutes

**Investigation Steps:**

1. **Check Frontend Routing**
   - Open `frontend/src/App.js` or routing configuration
   - Find batch route definition
   - Determine if path parameter is used for routing only

2. **Check Backend API**
   - Find batch backtest route handler
   - Check which parameter source is used (path vs query)
   - Log the parsed parameters

3. **Check URL Generation**
   - Open `frontend/src/utils/URLParameterManager.js`
   - Find `generateShareableURL()` method
   - Check batch mode URL generation logic
   - Determine why both parameters are included

4. **Document Findings**
   - Create findings.md in spec directory
   - Document which parameter is actually used
   - Recommend which to keep (likely query parameter)

**Deliverable:**
- Document current behavior
- Provide recommendation
- No code changes yet (investigation only)

---

### Task 3.2: Fix URL Parameter Duplication (If Needed)
**Files:** `frontend/src/utils/URLParameterManager.js`, routing files
**Priority:** Low
**Estimated Time:** 20 minutes
**Depends On:** Task 3.1

**Implementation:**
- Based on findings from Task 3.1
- Update URL generation to use only one parameter source
- Ensure backward compatibility
- Update any related documentation

**Verification:**
- Generate batch URL and verify format
- Test URL navigation works correctly
- Verify backend receives correct parameters

---

## Phase 4: Testing

### Task 4.1: Backend Unit Testing
**Priority:** High
**Estimated Time:** 20 minutes

**Test Cases:**

1. **Peak/Bottom Date Tracking**
   - Run single backtest
   - Check console logs for peak/bottom dates
   - Verify dates update when peak/bottom changes

2. **Last Trade Extraction**
   - Run batch backtest with curl
   - Verify lastTrade field in response
   - Check with symbols that have no trades

3. **Null Handling**
   - Test with empty transaction history
   - Verify no crashes or errors
   - Check N/A values display correctly

**Commands:**
```bash
# Single backtest test
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "profitRequirement": 0.05,
    "gridIntervalPercent": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10
  }' | jq '.data.recentPeakDate, .data.recentBottomDate'

# Batch backtest test
curl -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "TSLA"],
    "parameterRanges": {
      "startDate": "2024-01-01",
      "endDate": "2024-12-31",
      "profitRequirement": [0.05],
      "gridIntervalPercent": [0.10],
      "trailingBuyActivationPercent": [0.10],
      "trailingBuyReboundPercent": [0.05],
      "trailingSellActivationPercent": [0.20],
      "trailingSellPullbackPercent": [0.10]
    }
  }' | jq '.results[0].futureTrades'
```

---

### Task 4.2: Frontend Integration Testing
**Priority:** High
**Estimated Time:** 15 minutes

**Test Cases:**

1. **Visual Verification**
   - Navigate to batch results page
   - Verify trading context section displays
   - Check all three items (Last Trade, Peak, Bottom)
   - Verify formatting and styling

2. **Data Accuracy**
   - Compare displayed values with API response
   - Verify dates match
   - Check price formatting

3. **Edge Cases**
   - Test with stocks that have no trades (should show N/A)
   - Test with missing peak/bottom dates
   - Verify responsive behavior

**Steps:**
1. Start development server
2. Run batch backtest from UI
3. Navigate to results page
4. Inspect FutureTradeCard components
5. Verify all data displays correctly

---

### Task 4.3: End-to-End Testing
**Priority:** Medium
**Estimated Time:** 20 minutes

**Test Scenarios:**

1. **Long Strategy**
   - Run batch backtest with multiple symbols
   - Verify all cards show trading context
   - Check data accuracy

2. **Short Strategy**
   - Run batch backtest with short strategy
   - Verify trading context displays correctly
   - Verify SHORT/COVER terminology

3. **Mixed Holdings**
   - Test with some symbols having holdings, others not
   - Verify appropriate display for each

---

## Phase 5: Documentation

### Task 5.1: Update API Documentation
**File:** Create or update API documentation
**Priority:** Low
**Estimated Time:** 15 minutes

**Changes:**
- Document new fields in batch backtest response
- Add examples of new data structure
- Update any OpenAPI/Swagger definitions

---

### Task 5.2: Update Component Documentation
**File:** `frontend/src/components/BatchResults.js`
**Priority:** Low
**Estimated Time:** 10 minutes

**Changes:**
- Add JSDoc comments for new trading context section
- Document expected props structure
- Update component description

---

## Summary

**Total Estimated Time:** ~4.5 hours

**Critical Path:**
1. Task 1.1: DCA Executor enhancement
2. Task 1.3: Batch service extraction
3. Task 2.1: Frontend display
4. Task 4.1 & 4.2: Testing

**Dependencies:**
- Task 1.2 depends on Task 1.1
- Task 2.1 depends on Tasks 1.1, 1.2, 1.3
- Task 3.2 depends on Task 3.1
- Task 4.x depends on all implementation tasks

**Risk Areas:**
- Finding all call sites for `updatePeakBottomTracking`
- Ensuring consistency between long and short strategies
- Handling edge cases (missing data)
