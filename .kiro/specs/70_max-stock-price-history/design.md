# Design: Max Stock Price History

## Overview

This design extends the stock data fetching system to retrieve maximum available historical data while implementing rate limiting to avoid API throttling.

## Architecture

### Component Changes

```
┌─────────────────────────────────────────────────────────────────┐
│                      Data Update Flow                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────┐  │
│  │ Batch Update │───▶│  Rate Limiter   │───▶│ YFinance API  │  │
│  │   Script     │    │  (2 req/sec)    │    │ period=max    │  │
│  └──────────────┘    └─────────────────┘    └───────────────┘  │
│         │                    │                      │           │
│         │                    │                      │           │
│         ▼                    ▼                      ▼           │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────┐  │
│  │  Progress    │    │  Retry Queue    │    │  SQLite DB    │  │
│  │  Tracker     │    │ (exp backoff)   │    │  (upsert)     │  │
│  └──────────────┘    └─────────────────┘    └───────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. YFinance Provider Update

**File**: `backend/services/providers/yfinanceProvider.js`

```python
# Change from:
hist = ticker.history(period="5y")

# To:
hist = ticker.history(period="max")
```

### 2. Rate Limiter Module

**File**: `backend/services/rateLimiter.js`

```javascript
class RateLimiter {
  constructor(options = {}) {
    this.minDelay = options.minDelay || 2000;     // 2 seconds between requests
    this.maxRetries = options.maxRetries || 3;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.lastRequestTime = 0;
  }

  async wait() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const waitTime = Math.max(0, this.minDelay - elapsed);

    if (waitTime > 0) {
      // Add jitter (0-500ms) to avoid synchronized requests
      const jitter = Math.random() * 500;
      await new Promise(r => setTimeout(r, waitTime + jitter));
    }

    this.lastRequestTime = Date.now();
  }

  async executeWithRetry(fn) {
    let lastError;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      await this.wait();

      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check for rate limit error
        if (error.message.includes('429') || error.message.includes('rate limit')) {
          const backoffTime = this.minDelay * Math.pow(this.backoffMultiplier, attempt + 1);
          console.log(`Rate limited. Waiting ${backoffTime}ms before retry...`);
          await new Promise(r => setTimeout(r, backoffTime));
        }
      }
    }

    throw lastError;
  }
}
```

### 3. Batch Update Script

**File**: `backend/scripts/updateStockHistory.js`

```javascript
const PRIORITY_STOCKS = {
  mag7: ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA'],
  highBeta: ['AMD', 'NFLX', 'ORCL', 'MU', 'SHOP', 'PLTR', 'ARM', 'AMAT', 'LRCX', 'MRVL']
};

async function updateStockHistory(options = {}) {
  const {
    priorityOnly = false,  // Only update priority stocks
    symbols = null,        // Specific symbols to update
    resumeFrom = null      // Resume from specific symbol
  } = options;

  const progress = loadProgress();
  const rateLimiter = new RateLimiter({ minDelay: 2000 });

  // Get stocks to update
  let stocksToUpdate = [];

  if (symbols) {
    stocksToUpdate = symbols;
  } else if (priorityOnly) {
    stocksToUpdate = [...PRIORITY_STOCKS.mag7, ...PRIORITY_STOCKS.highBeta];
  } else {
    // Priority stocks first, then rest
    const allStocks = await getAllStocksFromDb();
    const prioritySet = new Set([...PRIORITY_STOCKS.mag7, ...PRIORITY_STOCKS.highBeta]);
    const nonPriority = allStocks.filter(s => !prioritySet.has(s));
    stocksToUpdate = [...PRIORITY_STOCKS.mag7, ...PRIORITY_STOCKS.highBeta, ...nonPriority];
  }

  // Resume from last position if interrupted
  if (resumeFrom) {
    const idx = stocksToUpdate.indexOf(resumeFrom);
    if (idx > 0) {
      stocksToUpdate = stocksToUpdate.slice(idx);
    }
  }

  // Process each stock
  for (let i = 0; i < stocksToUpdate.length; i++) {
    const symbol = stocksToUpdate[i];

    console.log(`[${i + 1}/${stocksToUpdate.length}] Updating ${symbol}...`);

    try {
      await rateLimiter.executeWithRetry(async () => {
        const prices = await yfinanceProvider.fetchDailyPrices(symbol);
        await upsertPrices(symbol, prices);
        console.log(`  ✅ ${symbol}: ${prices.length} records (${prices[0]?.date} to ${prices[prices.length-1]?.date})`);
      });

      saveProgress(symbol, 'success');
    } catch (error) {
      console.error(`  ❌ ${symbol}: ${error.message}`);
      saveProgress(symbol, 'failed', error.message);
    }
  }

  printSummary();
}
```

### 4. Database Upsert Logic

```javascript
async function upsertPrices(symbol, prices) {
  const stockId = await getStockId(symbol);

  const stmt = db.prepare(`
    INSERT INTO daily_prices (stock_id, date, open, high, low, close, adjusted_close, volume)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(stock_id, date) DO UPDATE SET
      open = excluded.open,
      high = excluded.high,
      low = excluded.low,
      close = excluded.close,
      adjusted_close = excluded.adjusted_close,
      volume = excluded.volume
  `);

  for (const price of prices) {
    if (price.close != null) {  // Validate data
      stmt.run(stockId, price.date, price.open, price.high, price.low,
               price.close, price.adjusted_close, price.volume);
    }
  }
}
```

### 5. Progress Tracking

**File**: `backend/data/update_progress.json`

```json
{
  "startedAt": "2025-11-29T10:00:00Z",
  "lastUpdatedAt": "2025-11-29T10:15:00Z",
  "totalStocks": 557,
  "completed": 45,
  "failed": 2,
  "results": {
    "NVDA": { "status": "success", "records": 5230, "range": "2000-01-03 to 2025-11-28" },
    "AAPL": { "status": "success", "records": 11023, "range": "1980-12-12 to 2025-11-28" },
    "XYZ": { "status": "failed", "error": "Symbol not found" }
  }
}
```

## Rate Limiting Strategy

### Yahoo Finance Limits (Unofficial)
- ~2000 requests per hour
- ~100 requests per minute
- May vary based on IP and usage patterns

### Our Conservative Approach
- 1 request every 2 seconds (30/minute, 1800/hour)
- Exponential backoff on 429 errors: 4s, 8s, 16s
- Random jitter (0-500ms) to avoid synchronized requests
- Maximum 3 retries per stock

### Estimated Time
- 557 stocks × 2.5 seconds average = ~23 minutes
- With retries and delays: ~30-45 minutes total

## CLI Usage

```bash
# Update priority stocks only (Mag7 + High Beta)
node scripts/updateStockHistory.js --priority

# Update specific symbols
node scripts/updateStockHistory.js --symbols NVDA,AAPL,TSLA

# Update all stocks
node scripts/updateStockHistory.js --all

# Resume from specific symbol
node scripts/updateStockHistory.js --all --resume-from AMD

# Dry run (show what would be updated)
node scripts/updateStockHistory.js --all --dry-run
```

## Error Handling

1. **Network Error**: Retry up to 3 times with exponential backoff
2. **Rate Limit (429)**: Wait longer (4x normal delay) and retry
3. **Invalid Symbol**: Log error, mark as failed, continue to next
4. **Database Error**: Stop and report (don't corrupt data)
5. **Interruption**: Save progress, allow resume
