# Requirements: Backtest with Current Intraday Price

## Problem Statement

The current backtest system has a significant limitation:
- **Data Lag**: Backtests only include data up to the most recent daily close in the database
- **During Trading Hours**: If you run a backtest at 11:00 AM on Friday, the latest data is Thursday's close (24+ hours old)
- **Stale Results**: Users cannot see how their strategy performs with **today's live price**
- **Manual Updates**: End date defaults to a fixed past date, requiring manual updates

## Detailed Requirements

### 1. Auto-Fetch Current Intraday Price

#### 1.1 Market Hours Detection

**Requirement**: Determine if the market is currently open.

**Market Hours** (US Stock Market):
- **Monday - Friday**: 9:30 AM - 4:00 PM Eastern Time (ET)
- **Closed**: Weekends, US market holidays

**Implementation Logic**:
```javascript
function isMarketOpen() {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  // Check day of week (0=Sunday, 6=Saturday)
  const dayOfWeek = etTime.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false; // Weekend
  }

  // Check time (9:30 AM = 570 minutes, 4:00 PM = 960 minutes)
  const currentMinutes = etTime.getHours() * 60 + etTime.getMinutes();
  const marketOpen = 9 * 60 + 30;  // 570
  const marketClose = 16 * 60;     // 960

  return currentMinutes >= marketOpen && currentMinutes < marketClose;
}
```

**Note**: Market holidays (e.g., Thanksgiving, Christmas) are not handled in Phase 1.

#### 1.2 Fetch Current Price via Yahoo Finance

**Requirement**: When market is open, fetch the current intraday price.

**API Method**: Use yfinance library (already in use)

**Python Implementation**:
```python
import yfinance as yf
from datetime import datetime
import pytz

def fetch_current_price(symbol):
    """
    Fetch current intraday price for a symbol.
    Returns dict with OHLC data or None if unavailable.
    """
    try:
        ticker = yf.Ticker(symbol)

        # Method 1: Use fast_info for quickest access
        fast_info = ticker.fast_info
        current_price = fast_info.get('lastPrice')

        if not current_price:
            # Method 2: Fallback to 1-day intraday history
            intraday = ticker.history(period='1d', interval='1m')
            if not intraday.empty:
                latest_row = intraday.iloc[-1]
                current_price = latest_row['Close']

        # Get OHLC data for today
        intraday_full = ticker.history(period='1d', interval='1m')

        if intraday_full.empty:
            return None

        # Calculate today's OHLC from minute data
        today_open = intraday_full.iloc[0]['Open']
        today_high = intraday_full['High'].max()
        today_low = intraday_full['Low'].min()
        today_close = current_price  # Use latest price as close
        today_volume = intraday_full['Volume'].sum()

        # Get current timestamp in ET
        et_tz = pytz.timezone('America/New_York')
        now_et = datetime.now(et_tz)

        return {
            'date': now_et.strftime('%Y-%m-%d'),
            'open': float(today_open),
            'high': float(today_high),
            'low': float(today_low),
            'close': float(today_close),
            'volume': int(today_volume),
            'adjusted_close': float(today_close),
            'is_current_intraday': True  # Flag to indicate synthetic data
        }

    except Exception as e:
        print(f"Error fetching current price for {symbol}: {e}")
        return None
```

**Acceptance Criteria**:
- Successfully fetch current price during market hours
- Price is <5 minutes old (Yahoo Finance provides near-real-time data)
- Fallback to previous close if fetch fails
- Handle API errors gracefully (network, rate limits, etc.)

#### 1.3 Synthetic Daily Bar Construction

**Requirement**: Construct a complete OHLC (Open, High, Low, Close) bar for today using intraday data.

**Data Structure**:
```javascript
{
  date: '2025-10-17',           // Today's date
  open: 248.02,                 // First trade price of the day
  high: 250.32,                 // Highest price reached today
  low: 247.27,                  // Lowest price reached today
  close: 248.47,                // Current price (latest)
  volume: 14981067,             // Total volume traded today
  adjusted_close: 248.47,       // Same as close for current day
  is_current_intraday: true     // Metadata flag
}
```

**Sources**:
- **Open**: First minute bar's open price
- **High**: Maximum high from all minute bars today
- **Low**: Minimum low from all minute bars today
- **Close**: Current latest price (most recent minute bar's close)
- **Volume**: Sum of all minute bars' volumes

**Acceptance Criteria**:
- OHLC values are realistic (Low ≤ Open/Close ≤ High)
- Volume is non-zero
- Date is today's date
- Format matches historical daily data

### 2. Price Data Service Enhancement

#### 2.1 Extend `getPriceData()` Function

**Current Behavior** (`stockDataService.js`):
```javascript
async function getPriceData(symbol, startDate, endDate) {
  // Query database for historical prices
  const prices = await database.query(
    'SELECT * FROM stock_prices WHERE symbol = ? AND date BETWEEN ? AND ?',
    [symbol, startDate, endDate]
  );
  return prices;
}
```

**New Behavior**:
```javascript
async function getPriceData(symbol, startDate, endDate) {
  // 1. Get historical prices from database
  const historicalPrices = await database.query(
    'SELECT * FROM stock_prices WHERE symbol = ? AND date BETWEEN ? AND ?',
    [symbol, startDate, endDate]
  );

  // 2. Check if endDate is today and market is open
  const today = new Date().toISOString().split('T')[0];
  const endDateIsToday = endDate === today;

  if (endDateIsToday && isMarketOpen()) {
    // 3. Fetch current intraday price
    const currentPriceBar = await fetchCurrentIntradayPrice(symbol);

    if (currentPriceBar) {
      // 4. Check if today's data already exists in database
      const todayExists = historicalPrices.some(p => p.date === today);

      if (!todayExists) {
        // 5. Append current intraday bar
        historicalPrices.push(currentPriceBar);
      } else {
        // 6. Replace today's database entry with live data
        const todayIndex = historicalPrices.findIndex(p => p.date === today);
        historicalPrices[todayIndex] = currentPriceBar;
      }
    }
  }

  return historicalPrices;
}
```

**Key Points**:
- Non-intrusive: Historical data path unchanged
- Only adds current price when: `endDate === today` AND `isMarketOpen()`
- Replaces stale today's data if it exists in DB
- Graceful fallback: If fetch fails, use historical data only

#### 2.2 Backend Service Layer

**File**: `services/currentPriceService.js` (NEW)

**Purpose**: Centralize current price fetching logic

**Functions**:
```javascript
// services/currentPriceService.js

const { spawn } = require('child_process');

class CurrentPriceService {
  /**
   * Check if US stock market is currently open
   */
  isMarketOpen() {
    const now = new Date();
    const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

    const dayOfWeek = etTime.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;

    const currentMinutes = etTime.getHours() * 60 + etTime.getMinutes();
    return currentMinutes >= 570 && currentMinutes < 960;
  }

  /**
   * Fetch current intraday price for a symbol
   */
  async fetchCurrentPrice(symbol) {
    if (!this.isMarketOpen()) {
      return null; // Market closed, no current price available
    }

    try {
      const pythonScript = `
import yfinance as yf
from datetime import datetime
import pytz
import json

ticker = yf.Ticker("${symbol}")
intraday = ticker.history(period='1d', interval='1m')

if intraday.empty:
    print(json.dumps(None))
else:
    today_open = float(intraday.iloc[0]['Open'])
    today_high = float(intraday['High'].max())
    today_low = float(intraday['Low'].min())
    today_close = float(intraday.iloc[-1]['Close'])
    today_volume = int(intraday['Volume'].sum())

    et_tz = pytz.timezone('America/New_York')
    now_et = datetime.now(et_tz)

    result = {
        'date': now_et.strftime('%Y-%m-%d'),
        'open': today_open,
        'high': today_high,
        'low': today_low,
        'close': today_close,
        'volume': today_volume,
        'adjusted_close': today_close,
        'is_current_intraday': True
    }
    print(json.dumps(result))
`;

      const output = await this.runPythonScript(pythonScript);
      const priceData = JSON.parse(output);

      return priceData;

    } catch (error) {
      console.error(`Error fetching current price for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Run Python script and return output
   */
  runPythonScript(script) {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', ['-c', script]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed: ${stderr}`));
        } else {
          resolve(stdout.trim());
        }
      });

      python.on('error', (error) => {
        reject(new Error(`Failed to start python: ${error.message}`));
      });
    });
  }
}

module.exports = new CurrentPriceService();
```

### 3. Default End Date = Today

#### 3.1 Frontend Forms

**Files to Update**:
- `frontend/src/components/DCABacktestForm.js` - Single-stock form
- `frontend/src/components/PortfolioBacktestForm.js` - Portfolio form
- `frontend/src/components/BatchBacktestForm.js` - Batch form (if exists)

**Change**:
```javascript
// OLD: Fixed default end date
const [endDate, setEndDate] = useState('2025-10-16');

// NEW: Dynamic default end date (today)
const [endDate, setEndDate] = useState(() => {
  return new Date().toISOString().split('T')[0];
});
```

**Acceptance Criteria**:
- Default end date is always today's date
- Updates automatically each day
- User can still manually change to a past date
- Persisted selections override default

#### 3.2 Backend Default Handling

**API Endpoints**:
```javascript
// POST /api/backtest/dca
router.post('/backtest/dca', async (req, res) => {
  let { startDate, endDate, ...otherParams } = req.body;

  // If endDate is missing or null, default to today
  if (!endDate) {
    endDate = new Date().toISOString().split('T')[0];
  }

  // Run backtest with auto-extended end date
  const result = await runBacktest({ startDate, endDate, ...otherParams });
  res.json(result);
});
```

### 4. Backtest Logic Integration

#### 4.1 No Changes Required to DCA Executor

**Key Insight**: The DCA backtest executor (`dcaBacktestService.js`) processes a **time-ordered array of daily prices**. It doesn't care if the last entry is:
- Historical data from database
- Current intraday synthetic data

**Why it works**:
- Current price is appended as a standard OHLC bar
- Executor processes it like any other day
- No special handling needed

#### 4.2 Results Interpretation

**Current Day Transactions**:
- May include BUY/SELL orders executed at today's prices
- Positions held reflect current market value

**Metadata Tracking**:
- Add `includesCurrentPrice: true` flag to backtest results
- Include `currentPriceTimestamp` for transparency

**Example Result**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalReturn": 45.3,
      "finalValue": 145300,
      "includesCurrentPrice": true,
      "currentPriceTimestamp": "2025-10-17T11:36:00-04:00"
    },
    "transactions": [ ... ],
    "currentHoldings": [
      { "purchasePrice": 248.02, "currentPrice": 248.47, "shares": 100 }
    ]
  }
}
```

### 5. Error Handling & Fallback

#### 5.1 Fetch Failure Scenarios

**Scenarios**:
1. Yahoo Finance API down
2. Network timeout
3. Symbol not found
4. Rate limit exceeded

**Fallback Strategy**:
```javascript
async function getPriceData(symbol, startDate, endDate) {
  const historicalPrices = await getHistoricalPrices(symbol, startDate, endDate);

  if (endDate === today && isMarketOpen()) {
    try {
      const currentPrice = await fetchCurrentPrice(symbol, { timeout: 5000 });
      if (currentPrice) {
        historicalPrices.push(currentPrice);
      }
    } catch (error) {
      console.warn(`Could not fetch current price for ${symbol}, using historical data only:`, error.message);
      // Continue with historical data only
    }
  }

  return historicalPrices;
}
```

**User Experience**:
- Backtest still runs successfully
- Uses most recent historical close instead
- Warning logged but not displayed to user (transparent fallback)

#### 5.2 Stale Data Handling

**Scenario**: Database has today's data from an earlier run (e.g., pre-market)

**Solution**: Always replace today's database entry with live fetch during market hours

```javascript
const todayExists = historicalPrices.some(p => p.date === today);

if (todayExists) {
  // Replace stale today's data with current live price
  const todayIndex = historicalPrices.findIndex(p => p.date === today);
  historicalPrices[todayIndex] = currentPriceBar;
}
```

### 6. Performance Considerations

#### 6.1 Caching Strategy

**Problem**: Fetching current price for every backtest is inefficient

**Solution**: Short-lived cache (5 minutes)

```javascript
// In-memory cache with TTL
const priceCache = new Map();

async function fetchCurrentPrice(symbol) {
  const cacheKey = `${symbol}_${Date.now() - (Date.now() % 300000)}`; // 5-min buckets

  if (priceCache.has(cacheKey)) {
    return priceCache.get(cacheKey);
  }

  const price = await fetchFromYahoo(symbol);
  priceCache.set(cacheKey, price);

  return price;
}
```

**Benefits**:
- Multiple concurrent backtests for same symbol use cached price
- Cache invalidates every 5 minutes automatically
- Reduces Yahoo Finance API calls

#### 6.2 Parallel Fetching (Portfolio Backtests)

**Scenario**: Portfolio backtest with 10 stocks needs current prices for all

**Solution**: Parallel fetching

```javascript
async function fetchCurrentPricesForPortfolio(symbols) {
  const pricePromises = symbols.map(symbol => fetchCurrentPrice(symbol));
  const prices = await Promise.all(pricePromises);

  return symbols.reduce((acc, symbol, index) => {
    acc[symbol] = prices[index];
    return acc;
  }, {});
}
```

## Success Criteria

### Functional Requirements

1. ✅ **Current Price Fetch**: Successful API call during market hours with <5 min latency
2. ✅ **Synthetic Bar**: OHLC data correctly constructed from intraday minute data
3. ✅ **Market Hours Detection**: Accurate determination of market open/close
4. ✅ **Default End Date**: All forms default to today's date
5. ✅ **Backtest Integration**: Current price seamlessly included in backtest processing
6. ✅ **Results Accuracy**: Current holdings reflect latest prices

### Non-Functional Requirements

7. ✅ **Performance**: Price fetch completes in <3 seconds
8. ✅ **Reliability**: Graceful fallback if fetch fails (use historical data)
9. ✅ **Caching**: 5-minute cache reduces redundant API calls
10. ✅ **Backward Compatibility**: Historical-only backtests work unchanged

### Edge Cases

11. ✅ **Weekend/After Hours**: No current price fetch, use previous close
12. ✅ **Market Holidays**: Treated as market closed (no fetch)
13. ✅ **Stale Database Entry**: Replaced with current live price
14. ✅ **API Failure**: Backtest continues with historical data only

## Out of Scope (Future Enhancements)

- Real-time streaming updates (WebSocket)
- Intraday backtesting with minute-level granularity
- Extended hours trading (pre-market 4:00-9:30 AM, after-hours 4:00-8:00 PM)
- Market holiday calendar integration
- Multiple data source fallbacks (Alpha Vantage, IEX, etc.)

## Dependencies

- **yfinance library**: Already installed and in use
- **pytz library**: For timezone handling (install if missing: `pip install pytz`)
- **Existing services**: `stockDataService.js`, `dcaBacktestService.js`

## Testing Requirements

### Unit Tests

1. `isMarketOpen()` - Various days/times
2. `fetchCurrentPrice()` - Mock Yahoo Finance responses
3. `getPriceData()` - With and without current price
4. Synthetic bar construction - OHLC validation

### Integration Tests

1. Full backtest with current price during market hours
2. Full backtest outside market hours (historical only)
3. Portfolio backtest with current prices for multiple symbols
4. API failure scenarios

### Manual Tests

1. Run backtest at 11:00 AM ET on a trading day
2. Verify current price appears in results
3. Run same backtest at 6:00 PM ET
4. Verify no current price (uses previous close)
5. Compare with separate single-stock backtest

## Rollout Plan

### Phase 1: Backend Implementation (4 hours)
- Create `currentPriceService.js`
- Enhance `getPriceData()` in `stockDataService.js`
- Add caching logic
- Unit tests

### Phase 2: Frontend Updates (1 hour)
- Update default end dates to today
- No other UI changes needed

### Phase 3: Testing & Validation (2 hours)
- Integration tests
- Manual testing during/outside market hours
- Performance benchmarks

### Phase 4: Documentation (1 hour)
- API documentation
- User guide updates
- Code comments
