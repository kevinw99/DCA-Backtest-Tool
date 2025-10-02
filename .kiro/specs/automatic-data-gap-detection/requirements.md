# Automatic Data Gap Detection and Filling - Requirements

## Problem Statement

Currently, backtests for **existing stocks** do not automatically fetch missing data:

- Data is only fetched when a stock is **first created**
- For existing stocks, backtests use whatever data is in the database
- If the requested `endDate` is beyond the latest data in DB, the backtest silently stops at the last available date
- Users see incomplete results without knowing data is missing

**Example Issue**:

- User requests backtest for SEZL from 2021-09-01 to 2025-10-02
- Database only has SEZL data until 2025-07-24
- Backtest shows results only until 2025-07-24
- No error, no warning, no automatic data fetch

## Requirements

### Must Have

1. **Automatic Gap Detection**
   - Before running backtest, check if DB has complete data for requested date range
   - Detect gaps at both start and end of date range
   - Log detected gaps with date ranges

2. **Automatic Gap Filling**
   - If data is missing, automatically fetch it from yfinance
   - Fetch only the missing date range (not entire history)
   - Update database with new data before running backtest

3. **User Feedback**
   - Log when fetching missing data: "=� Fetching missing data for SEZL from 2025-07-25 to 2025-10-02..."
   - Log when fetch completes: " Fetched 50 new price records"
   - Show total time taken for data fetch

4. **Error Handling**
   - If data fetch fails, throw clear error explaining what happened
   - Don't run backtest with incomplete data without user knowing
   - Provide actionable error message (e.g., "Data unavailable beyond 2025-07-24")

### Should Have

1. **Smart Caching**
   - Don't re-fetch data if it was just fetched (within last hour)
   - Check `last_updated` timestamp on stock record
   - Skip fetch if data is fresh

2. **Performance Optimization**
   - Batch database inserts for new price data
   - Use transactions for atomic updates
   - Minimize API calls (fetch only missing ranges)

3. **Stale Data Detection**
   - Check if `endDate` is today but DB data is old (> 1 day)
   - Automatically refresh if data is stale
   - Log: "� Data for SEZL is stale (last updated: 2025-07-24), fetching latest..."

### Nice to Have

1. **Parallel Gap Filling**
   - For batch backtests with multiple symbols, fetch gaps in parallel
   - Improve performance for batch operations

2. **Data Quality Checks**
   - Verify fetched data has no gaps (missing trading days)
   - Check for anomalies (price spikes, zero volume days)
   - Log warnings for data quality issues

## Current Implementation

### Where Data is Fetched Now

**File**: `backend/services/dcaBacktestService.js:315-335`

```javascript
// Only fetches data for NEW stocks
if (!stock) {
  const stockDataService = require('./stockDataService');
  const stockId = await database.createStock(symbol);
  stock = await database.getStock(symbol);

  await stockDataService.updateStockData(stock.id, symbol, {
    updatePrices: true,
    updateFundamentals: true,
    updateCorporateActions: true,
  });
}

// For EXISTING stocks, just queries DB - NO GAP DETECTION
const pricesWithIndicators = await database.getPricesWithIndicators(stock.id, startDate, endDate);
```

### Proposed Solution

Add gap detection **after** getting stock, **before** querying prices:

```javascript
// 1. Get or create stock
let stock = await database.getStock(symbol);
if (!stock) {
  // ... existing creation logic
}

// 2. CHECK FOR GAPS (NEW LOGIC)
const latestDate = await database.getLatestPriceDate(stock.id);
if (latestDate && latestDate < endDate) {
  console.log(
    `=� Data gap detected for ${symbol}: DB has data until ${latestDate}, requested until ${endDate}`
  );

  const stockDataService = require('./stockDataService');
  await stockDataService.updateStockData(stock.id, symbol, {
    updatePrices: true,
    fromDate: latestDate, // Fetch only missing range
    updateFundamentals: false, // Don't re-fetch fundamentals
    updateCorporateActions: false,
  });

  console.log(` Filled gap: fetched data from ${latestDate} to ${endDate}`);
}

// 3. Get price data (now complete)
const pricesWithIndicators = await database.getPricesWithIndicators(stock.id, startDate, endDate);
```

## Database Changes Required

### New Function Needed

**File**: `backend/database.js`

```javascript
/**
 * Get latest price date for a stock
 * @param {number} stockId - Stock ID
 * @returns {Promise<string|null>} Latest date in YYYY-MM-DD format, or null if no data
 */
async getLatestPriceDate(stockId) {
  const result = await this.db.get(
    'SELECT MAX(date) as latest_date FROM daily_prices WHERE stock_id = ?',
    [stockId]
  );
  return result?.latest_date || null;
}
```

### Alternative: Check with Range Query

Could also use existing query and check if result is empty or incomplete:

```javascript
const existingPrices = await database.getPricesWithIndicators(stock.id, startDate, endDate);
const tradingDays = calculateTradingDays(startDate, endDate); // ~252 days/year
const expectedRecords = Math.floor(tradingDays);
const actualRecords = existingPrices.length;

if (actualRecords < expectedRecords * 0.9) {
  // Allow 10% tolerance for holidays
  console.log(`=� Data appears incomplete: expected ~${expectedRecords}, got ${actualRecords}`);
  // Fetch missing data...
}
```

## Success Criteria

1.  Backtest for SEZL with endDate=2025-10-02 automatically fetches data beyond 2025-07-24
2.  Console shows clear logs about gap detection and filling
3.  Backtest results show complete data range (2021-09-01 to 2025-10-02)
4.  Subsequent backtests don't re-fetch if data is already complete
5.  Error handling works: if yfinance has no data beyond 2025-07-24, show clear error
6.  Performance: fetching gaps doesn't significantly slow down backtests

## Testing Plan

1. **Test with known gap**: SEZL (has data until 2025-07-24, request until 2025-10-02)
2. **Test with complete data**: AAPL (likely has recent data)
3. **Test with new stock**: Random ticker that doesn't exist in DB
4. **Test batch mode**: Multiple symbols, some with gaps, some without
5. **Test error case**: Request data for future date (e.g., 2026-01-01)

## Dependencies

- Existing: `stockDataService.updateStockData()` supports `fromDate` parameter
- New: `database.getLatestPriceDate()` function
- Existing: yfinance provider already handles date ranges

## Non-Goals

- **Not** implementing data prefetching or scheduled updates
- **Not** implementing data validation/cleaning (separate concern)
- **Not** implementing alternative data sources if yfinance fails
