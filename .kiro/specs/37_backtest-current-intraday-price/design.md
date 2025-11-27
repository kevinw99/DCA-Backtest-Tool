# Design: Backtest with Current Intraday Price

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Backtest Request                            │
│                  (endDate = today's date)                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              stockDataService.getPriceData()                     │
├─────────────────────────────────────────────────────────────────┤
│  1. Fetch historical prices from database                       │
│  2. Check: Is endDate === today AND market open?                │
│     ├─ YES → Fetch current intraday price                       │
│     └─ NO  → Return historical data only                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Market Open? │
                    └───────┬───────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼ YES                       ▼ NO
┌───────────────────────────┐   ┌─────────────────────┐
│ currentPriceService       │   │ Return Historical   │
│ .fetchCurrentPrice()      │   │ Data Only           │
├───────────────────────────┤   └─────────────────────┘
│ • Check 5-min cache       │
│ • Call Yahoo Finance API  │
│ • Build synthetic OHLC    │
│ • Return current bar      │
└───────────────┬───────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│           Merge Historical + Current Price                       │
├─────────────────────────────────────────────────────────────────┤
│  Historical: [2021-01-01, ..., 2025-10-16]                      │
│  + Current:  [2025-10-17 (intraday)]                            │
│  = Complete: [2021-01-01, ..., 2025-10-16, 2025-10-17]          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              dcaBacktestService.runBacktest()                    │
├─────────────────────────────────────────────────────────────────┤
│  Process each day's price (no changes needed):                  │
│  • Historical days: Standard processing                         │
│  • Current day: Processed identically                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backtest Results                              │
├─────────────────────────────────────────────────────────────────┤
│  {                                                               │
│    "includesCurrentPrice": true,                                │
│    "currentPriceTimestamp": "2025-10-17T11:36:00-04:00",        │
│    "finalValue": 145300,                                        │
│    "currentHoldings": [                                         │
│      { "currentPrice": 248.47, "shares": 100 }                  │
│    ]                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. CurrentPriceService (NEW)

**File**: `backend/services/currentPriceService.js`

**Responsibility**: Fetch current intraday prices and determine market status

**Public Methods**:

```javascript
class CurrentPriceService {
  /**
   * Check if US stock market is currently open
   * @returns {boolean} true if market is open, false otherwise
   */
  isMarketOpen()

  /**
   * Fetch current intraday price for a symbol
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @param {object} options - { timeout: 5000, useCache: true }
   * @returns {Promise<object|null>} Price data or null if unavailable
   */
  async fetchCurrentPrice(symbol, options = {})

  /**
   * Fetch current prices for multiple symbols in parallel
   * @param {string[]} symbols - Array of stock symbols
   * @returns {Promise<object>} Map of symbol → price data
   */
  async fetchCurrentPricesParallel(symbols)
}
```

**Internal Methods**:

```javascript
class CurrentPriceService {
  /**
   * Run Python script to fetch data via yfinance
   * @param {string} script - Python code to execute
   * @returns {Promise<string>} Script output
   */
  runPythonScript(script)

  /**
   * Get cached price if available and fresh
   * @param {string} symbol - Stock symbol
   * @returns {object|null} Cached price data or null
   */
  getCachedPrice(symbol)

  /**
   * Store price in cache with 5-minute TTL
   * @param {string} symbol - Stock symbol
   * @param {object} priceData - Price data to cache
   */
  setCachedPrice(symbol, priceData)
}
```

**Cache Implementation**:

```javascript
// In-memory cache with automatic expiration
const priceCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(symbol) {
  // Create 5-minute bucket key
  const now = Date.now();
  const bucket = Math.floor(now / CACHE_TTL_MS);
  return `${symbol}_${bucket}`;
}

function getCachedPrice(symbol) {
  const key = getCacheKey(symbol);
  return priceCache.get(key) || null;
}

function setCachedPrice(symbol, priceData) {
  const key = getCacheKey(symbol);
  priceCache.set(key, priceData);

  // Clean up old entries periodically
  if (priceCache.size > 100) {
    const currentBucket = Math.floor(Date.now() / CACHE_TTL_MS);
    for (const [k, v] of priceCache.entries()) {
      const [, bucket] = k.split('_');
      if (parseInt(bucket) < currentBucket) {
        priceCache.delete(k);
      }
    }
  }
}
```

### 2. StockDataService Enhancement

**File**: `backend/services/stockDataService.js`

**Current Implementation**:
```javascript
async function getPriceData(symbol, startDate, endDate) {
  // Query database for historical prices
  const query = `
    SELECT date, open, high, low, close, volume, adjusted_close
    FROM stock_prices
    WHERE symbol = ? AND date >= ? AND date <= ?
    ORDER BY date ASC
  `;

  const prices = await db.all(query, [symbol, startDate, endDate]);
  return prices;
}
```

**Enhanced Implementation**:
```javascript
const currentPriceService = require('./currentPriceService');

async function getPriceData(symbol, startDate, endDate, options = {}) {
  // 1. Fetch historical prices from database
  const query = `
    SELECT date, open, high, low, close, volume, adjusted_close
    FROM stock_prices
    WHERE symbol = ? AND date >= ? AND date <= ?
    ORDER BY date ASC
  `;

  const historicalPrices = await db.all(query, [symbol, startDate, endDate]);

  // 2. Check if we should add current intraday price
  const today = new Date().toISOString().split('T')[0];
  const shouldFetchCurrent = (
    endDate === today &&
    currentPriceService.isMarketOpen() &&
    options.includeCurrentPrice !== false // Allow opt-out
  );

  if (!shouldFetchCurrent) {
    return historicalPrices;
  }

  // 3. Fetch current intraday price
  try {
    const currentPriceBar = await currentPriceService.fetchCurrentPrice(symbol, {
      timeout: 5000,
      useCache: true
    });

    if (!currentPriceBar) {
      // Fetch failed, return historical only
      return historicalPrices;
    }

    // 4. Check if today's data already exists in historical prices
    const todayIndex = historicalPrices.findIndex(p => p.date === today);

    if (todayIndex >= 0) {
      // Replace stale database entry with live current price
      historicalPrices[todayIndex] = currentPriceBar;
      console.log(`Replaced stale DB entry for ${symbol} ${today} with current price: $${currentPriceBar.close}`);
    } else {
      // Append current price as new entry
      historicalPrices.push(currentPriceBar);
      console.log(`Appended current price for ${symbol} ${today}: $${currentPriceBar.close}`);
    }

    return historicalPrices;

  } catch (error) {
    console.warn(`Could not fetch current price for ${symbol}:`, error.message);
    // Graceful fallback: return historical data only
    return historicalPrices;
  }
}
```

**Key Design Decisions**:
- **Opt-out mechanism**: `options.includeCurrentPrice = false` to disable current price fetch
- **Graceful degradation**: If fetch fails, return historical data (backtest still works)
- **Replace vs. Append**: If today's data exists in DB (stale), replace it; otherwise append
- **Logging**: Clear console logs for debugging

### 3. Portfolio Backtest Enhancement

**File**: `backend/services/portfolioBacktestService.js`

**Challenge**: Portfolio backtests need current prices for **multiple stocks**

**Solution**: Parallel fetching

```javascript
async function runPortfolioBacktest(config) {
  const { stocks, startDate, endDate, ...otherParams } = config;

  // Fetch current prices for all stocks in parallel (if needed)
  const today = new Date().toISOString().split('T')[0];
  let currentPrices = {};

  if (endDate === today && currentPriceService.isMarketOpen()) {
    console.log(`Fetching current prices for ${stocks.length} stocks...`);
    currentPrices = await currentPriceService.fetchCurrentPricesParallel(stocks);
  }

  // Process each stock's backtest
  const results = [];
  for (const symbol of stocks) {
    // getPriceData will use cached current price if available
    const priceData = await stockDataService.getPriceData(symbol, startDate, endDate);

    const stockResult = await runSingleStockBacktest({
      symbol,
      priceData,
      ...otherParams
    });

    results.push(stockResult);
  }

  return {
    success: true,
    data: {
      stockResults: results,
      includesCurrentPrice: Object.keys(currentPrices).length > 0,
      currentPriceTimestamp: new Date().toISOString()
    }
  };
}
```

### 4. Frontend Default End Date

**File**: `frontend/src/components/DCABacktestForm.js`

**Change**:

```javascript
// Before
const [formData, setFormData] = useState({
  symbol: 'AAPL',
  startDate: '2021-01-01',
  endDate: '2025-10-16', // ❌ Hardcoded past date
  // ... other fields
});

// After
const [formData, setFormData] = useState({
  symbol: 'AAPL',
  startDate: '2021-01-01',
  endDate: new Date().toISOString().split('T')[0], // ✅ Today's date
  // ... other fields
});
```

**Same change for**:
- `PortfolioBacktestForm.js`
- `BatchBacktestForm.js` (if exists)

## Data Flow Diagrams

### Scenario 1: Backtest During Market Hours

```
User                Frontend              Backend                Yahoo Finance
  │                    │                    │                         │
  │  Submit Backtest   │                    │                         │
  │  (endDate=today)   │                    │                         │
  ├───────────────────>│                    │                         │
  │                    │  POST /api/backtest│                         │
  │                    ├───────────────────>│                         │
  │                    │                    │  1. Get Historical      │
  │                    │                    │     (DB query)          │
  │                    │                    │                         │
  │                    │                    │  2. Check Market Open   │
  │                    │                    │     (isMarketOpen)      │
  │                    │                    │     → TRUE              │
  │                    │                    │                         │
  │                    │                    │  3. Fetch Current Price │
  │                    │                    ├────────────────────────>│
  │                    │                    │   yfinance.Ticker()     │
  │                    │                    │   .history(1d, 1m)      │
  │                    │                    │<────────────────────────┤
  │                    │                    │   { OHLC data }         │
  │                    │                    │                         │
  │                    │                    │  4. Merge Historical    │
  │                    │                    │     + Current Price     │
  │                    │                    │                         │
  │                    │                    │  5. Run Backtest        │
  │                    │                    │     (DCA executor)      │
  │                    │                    │                         │
  │                    │<───────────────────┤                         │
  │                    │  { results,        │                         │
  │                    │    includesCurrentPrice: true }              │
  │<───────────────────┤                    │                         │
  │  Display Results   │                    │                         │
  │  (with current     │                    │                         │
  │   holdings @       │                    │                         │
  │   current price)   │                    │                         │
```

### Scenario 2: Backtest Outside Market Hours

```
User                Frontend              Backend
  │                    │                    │
  │  Submit Backtest   │                    │
  │  (endDate=today)   │                    │
  ├───────────────────>│                    │
  │                    │  POST /api/backtest│
  │                    ├───────────────────>│
  │                    │                    │  1. Get Historical
  │                    │                    │     (DB query)
  │                    │                    │
  │                    │                    │  2. Check Market Open
  │                    │                    │     (isMarketOpen)
  │                    │                    │     → FALSE (6:00 PM)
  │                    │                    │
  │                    │                    │  3. Skip Current Price
  │                    │                    │     Use historical only
  │                    │                    │
  │                    │                    │  4. Run Backtest
  │                    │                    │     (DCA executor)
  │                    │                    │
  │                    │<───────────────────┤
  │                    │  { results,
  │                    │    includesCurrentPrice: false }
  │<───────────────────┤
  │  Display Results   │
```

## API Specifications

### Enhanced GET/POST Backtest Endpoints

No changes to API contracts, but behavior is enhanced:

**POST /api/backtest/dca**

Request:
```json
{
  "symbol": "AAPL",
  "startDate": "2021-01-01",
  "endDate": "2025-10-17",  // Today's date
  "lotSizeUsd": 10000,
  "maxLots": 10,
  // ... other params
}
```

Response (During Market Hours):
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalReturn": 45.3,
      "finalValue": 145300,
      "includesCurrentPrice": true,
      "currentPriceTimestamp": "2025-10-17T11:36:00-04:00",
      "marketStatus": "OPEN"
    },
    "transactions": [ ... ],
    "currentHoldings": [
      {
        "lotNumber": 1,
        "purchasePrice": 248.02,
        "currentPrice": 248.47,  // Live current price
        "shares": 100,
        "unrealizedPnL": 45.00
      }
    ],
    "transactionLog": [ ... ]
  }
}
```

Response (Outside Market Hours):
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalReturn": 45.3,
      "finalValue": 145300,
      "includesCurrentPrice": false,
      "currentPriceTimestamp": null,
      "marketStatus": "CLOSED"
    },
    // ... rest same as above
  }
}
```

## Error Handling

### Error Scenarios

1. **Yahoo Finance API Failure**
   - **Cause**: Network error, rate limit, API down
   - **Handling**: Log warning, continue with historical data
   - **User Impact**: None (graceful degradation)

2. **Python Script Failure**
   - **Cause**: Python not installed, yfinance missing
   - **Handling**: Catch exception, log error, return null
   - **User Impact**: None (falls back to historical data)

3. **Invalid Symbol**
   - **Cause**: Symbol not found on Yahoo Finance
   - **Handling**: Return null from fetchCurrentPrice()
   - **User Impact**: None (historical data still works)

4. **Timeout**
   - **Cause**: API call takes >5 seconds
   - **Handling**: Abort fetch, return null
   - **User Impact**: None (historical data used)

### Error Logging

```javascript
// Good error logging example
try {
  const currentPrice = await fetchCurrentPrice(symbol);
} catch (error) {
  console.error('[CurrentPriceService] Error:', {
    symbol,
    error: error.message,
    timestamp: new Date().toISOString(),
    fallback: 'Using historical data only'
  });
  // Continue execution with historical data
}
```

## Performance Optimization

### 1. Caching Strategy

**Cache Key Format**: `${symbol}_${5min_bucket}`

**Example**:
- 11:32 AM → Bucket: 2341432 → Key: `AAPL_2341432`
- 11:36 AM → Same bucket → Key: `AAPL_2341432` (cache hit)
- 11:42 AM → New bucket: 2341433 → Key: `AAPL_2341433` (cache miss)

**Benefits**:
- Multiple backtests within 5 minutes use same cached price
- Automatic expiration (no manual cleanup needed)
- Memory-efficient (max ~100 entries with periodic cleanup)

### 2. Parallel Fetching

**Portfolio Backtest**: Need current prices for 10 stocks

**Sequential** (Slow):
```javascript
for (const symbol of symbols) {
  const price = await fetchCurrentPrice(symbol); // 1-2 seconds each
}
// Total: 10-20 seconds
```

**Parallel** (Fast):
```javascript
const prices = await Promise.all(
  symbols.map(symbol => fetchCurrentPrice(symbol))
);
// Total: 1-2 seconds (concurrent)
```

### 3. Timeout Configuration

**Default**: 5 seconds per symbol
**Reasoning**: Yahoo Finance typically responds in 1-2 seconds; 5 seconds allows buffer for network delays

```javascript
async fetchCurrentPrice(symbol, options = {}) {
  const timeout = options.timeout || 5000;

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeout)
  );

  const fetchPromise = this.runPythonScript(script);

  return Promise.race([fetchPromise, timeoutPromise]);
}
```

## Testing Strategy

### Unit Tests

**File**: `services/__tests__/currentPriceService.test.js`

```javascript
describe('CurrentPriceService', () => {
  test('isMarketOpen() returns true during trading hours', () => {
    // Mock Date to be 11:00 AM ET on a weekday
    // Assert: isMarketOpen() === true
  });

  test('isMarketOpen() returns false on weekends', () => {
    // Mock Date to be Saturday
    // Assert: isMarketOpen() === false
  });

  test('fetchCurrentPrice() returns OHLC data', async () => {
    // Mock Python script output
    // Assert: result has { date, open, high, low, close, volume }
  });

  test('fetchCurrentPrice() uses cache for repeated calls', async () => {
    // Call twice within 5 minutes
    // Assert: Python script only runs once
  });

  test('fetchCurrentPrice() handles API errors gracefully', async () => {
    // Mock API failure
    // Assert: returns null, no exception thrown
  });
});
```

### Integration Tests

**File**: `services/__tests__/stockDataService.integration.test.js`

```javascript
describe('getPriceData with current price', () => {
  test('appends current price when endDate is today and market open', async () => {
    // Mock isMarketOpen() → true
    // Mock fetchCurrentPrice() → valid OHLC
    const prices = await getPriceData('AAPL', '2025-01-01', '2025-10-17');
    expect(prices[prices.length - 1].is_current_intraday).toBe(true);
  });

  test('does not append current price when market closed', async () => {
    // Mock isMarketOpen() → false
    const prices = await getPriceData('AAPL', '2025-01-01', '2025-10-17');
    expect(prices.every(p => !p.is_current_intraday)).toBe(true);
  });

  test('replaces stale DB entry with current price', async () => {
    // Insert today's data in DB with old price
    // Mock fetchCurrentPrice() → new price
    const prices = await getPriceData('AAPL', '2025-01-01', '2025-10-17');
    const todayEntry = prices.find(p => p.date === '2025-10-17');
    expect(todayEntry.is_current_intraday).toBe(true);
  });
});
```

### Manual Testing Checklist

- [ ] Run backtest at 11:00 AM ET on a trading day
- [ ] Verify current price appears in results
- [ ] Verify `includesCurrentPrice: true` in response
- [ ] Check current holdings show live prices
- [ ] Run same backtest at 6:00 PM ET
- [ ] Verify `includesCurrentPrice: false` in response
- [ ] Run portfolio backtest with 10 stocks
- [ ] Verify all 10 stocks have current prices
- [ ] Check network tab: API calls complete in <5 seconds
- [ ] Disconnect network and run backtest
- [ ] Verify graceful fallback to historical data

## Security Considerations

1. **Rate Limiting**: Yahoo Finance may rate-limit excessive requests
   - Mitigation: 5-minute cache reduces call frequency

2. **Input Validation**: Ensure symbol parameter is sanitized
   - Prevent: SQL injection, command injection
   - Implementation: Validate symbol format (e.g., /^[A-Z]{1,5}$/)

3. **Error Messages**: Do not expose internal details to frontend
   - Log detailed errors server-side
   - Return generic error messages to client

## Deployment Checklist

- [ ] Install/verify `pytz` library: `pip install pytz`
- [ ] Verify `yfinance` library is installed
- [ ] Update environment variables (if any)
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Deploy to staging
- [ ] Manual test during/outside market hours
- [ ] Monitor logs for errors
- [ ] Deploy to production
- [ ] Update user documentation
