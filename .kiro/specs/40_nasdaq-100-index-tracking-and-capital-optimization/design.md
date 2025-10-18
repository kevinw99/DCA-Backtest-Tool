# Design: Nasdaq 100 Index Tracking and Capital Optimization

## Architecture Overview

This design extends the existing portfolio backtest infrastructure with:
1. **Index Tracking Service** - Manages historical constituency data
2. **Trading Period Enforcement** - Filters stock operations by index membership
3. **Dynamic Capital Allocator** - Optimizes capital deployment strategies
4. **Enhanced Metrics Reporting** - Tracks index-aware and optimization metrics

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Portfolio Backtest Service                    │
│  (backend/services/portfolioBacktestService.js)                 │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ├──────────────────────────────────────────────────┐
                │                                                  │
      ┌─────────▼─────────┐                            ┌──────────▼──────────┐
      │ Index Tracking     │                            │ Capital Optimizer   │
      │ Service            │                            │ Service             │
      │ (NEW)              │                            │ (NEW)               │
      └─────────┬─────────┘                            └──────────┬──────────┘
                │                                                  │
      ┌─────────▼─────────┐                            ┌──────────▼──────────┐
      │ Index History      │                            │ Optimization        │
      │ Data Loader        │                            │ Strategy Manager    │
      │ (nasdaq100-        │                            │                     │
      │  history.json)     │                            │                     │
      └───────────────────┘                            └─────────────────────┘
```

## Component Design

### 1. Index Tracking Service

**File:** `backend/services/indexTrackingService.js`

**Responsibilities:**
- Load and cache index constituency history
- Determine if a stock can be traded on a specific date
- Handle index addition/removal events

**API:**
```javascript
class IndexTrackingService {
  /**
   * Load index history from JSON file
   * @param {string} indexName - Index identifier (e.g., "NASDAQ-100")
   * @returns {Promise<void>}
   */
  async loadIndexHistory(indexName);

  /**
   * Check if stock is in index on given date
   * @param {string} symbol - Stock symbol
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {boolean} True if stock is in index
   */
  isInIndex(symbol, date);

  /**
   * Get trading period for a stock
   * @param {string} symbol - Stock symbol
   * @param {string} backtestStartDate - Backtest start date
   * @param {string} backtestEndDate - Backtest end date
   * @returns {Object} { canTrade, startDate, endDate, isPartial }
   */
  getTradingPeriod(symbol, backtestStartDate, backtestEndDate);

  /**
   * Get all index changes within date range
   * @param {string} startDate - Range start
   * @param {string} endDate - Range end
   * @returns {Array<Object>} Array of addition/removal events
   */
  getIndexChanges(startDate, endDate);
}
```

**Data Structure:**
```javascript
// In-memory cache after loading JSON
{
  indexName: "NASDAQ-100",
  lastUpdated: "2025-10-17",
  stockMap: Map<symbol, {
    addedDate: string | null,  // null = always in index
    removedDate: string | null, // null = still in index
    notes: string
  }>
}
```

**Implementation Notes:**
- Cache loaded on first use (lazy loading)
- Use Map for O(1) symbol lookup
- If symbol not found in map, assume it was in index for entire period (backward compatibility)

### 2. Index History Data File

**File:** `backend/data/nasdaq100-history.json`

**Schema:**
```json
{
  "index": "NASDAQ-100",
  "lastUpdated": "2025-10-17",
  "metadata": {
    "source": "Manually compiled from Nasdaq announcements and financial news",
    "coverage": "2021-09-01 to 2025-10-17",
    "totalChanges": 15
  },
  "changes": [
    {
      "symbol": "PLTR",
      "addedDate": "2024-11-18",
      "removedDate": null,
      "notes": "Added during November 2024 rebalance, replacing Illumina (ILMN)"
    },
    {
      "symbol": "APP",
      "addedDate": "2024-09-23",
      "removedDate": null,
      "notes": "Added during September 2024 rebalance, replacing Walgreens (WBA)"
    },
    {
      "symbol": "NOK",
      "addedDate": null,
      "removedDate": "2023-12-18",
      "notes": "Removed during December 2023 rebalance"
    }
  ]
}
```

**Data Collection Process:**
1. Research Nasdaq official announcements for quarterly rebalances
2. Cross-reference with financial news (Bloomberg, Reuters, CNBC)
3. Verify with Wikipedia's Nasdaq-100 historical changes
4. Document at least 2 sources for each change
5. Update manually when new rebalances occur

### 3. Portfolio Backtest Service Modifications

**File:** `backend/services/portfolioBacktestService.js`

**Changes Required:**

#### 3.1 Integration Point in `runPortfolioBacktest()`

```javascript
async function runPortfolioBacktest(params) {
  const {
    totalCapital,
    startDate,
    endDate,
    lotSizeUsd,
    maxLotsPerStock,
    defaultParams,
    stocks,
    indexTracking = { enabled: false },      // NEW
    capitalOptimization = { enabled: false } // NEW
  } = params;

  // Load index tracking if enabled
  let indexTracker = null;
  if (indexTracking.enabled) {
    const IndexTrackingService = require('./indexTrackingService');
    indexTracker = new IndexTrackingService();
    await indexTracker.loadIndexHistory(indexTracking.indexName || 'NASDAQ-100');
  }

  // Initialize capital optimizer if enabled
  let capitalOptimizer = null;
  if (capitalOptimization.enabled) {
    const CapitalOptimizerService = require('./capitalOptimizerService');
    capitalOptimizer = new CapitalOptimizerService(capitalOptimization);
  }

  // ... existing code ...
}
```

#### 3.2 Daily Loop Modification

```javascript
for (const dateObj of tradingDays) {
  const currentDate = dateObj.date;

  // Check for index changes on this date
  if (indexTracker) {
    const changes = indexTracker.getIndexChanges(currentDate, currentDate);

    for (const change of changes) {
      if (change.removedDate === currentDate) {
        // Force liquidation of removed stock
        await forceLiquidateStock(change.symbol, currentDate, priceDataMap);
      }
    }
  }

  // Execute strategies for each stock
  for (const stockConfig of stocks) {
    const symbol = stockConfig.symbol;

    // Check if stock can be traded today
    if (indexTracker && !indexTracker.isInIndex(symbol, currentDate)) {
      continue; // Skip this stock for today
    }

    // Get dynamic lot size from optimizer (if enabled)
    const currentLotSize = capitalOptimizer
      ? capitalOptimizer.getLotSize(symbol, cashReserve, lotSizeUsd)
      : lotSizeUsd;

    // ... execute DCA strategy with currentLotSize ...
  }

  // Calculate cash yield at end of day (if enabled)
  if (capitalOptimizer && capitalOptimizer.isCashYieldEnabled()) {
    const yieldRevenue = capitalOptimizer.calculateDailyCashYield(cashReserve);
    totalEquity += yieldRevenue;
    cashYieldRevenue += yieldRevenue;
  }
}
```

### 4. Capital Optimizer Service

**File:** `backend/services/capitalOptimizerService.js`

**Responsibilities:**
- Manage multiple optimization strategies
- Calculate dynamic lot sizes
- Calculate cash yield revenue
- Track optimization events

**API:**
```javascript
class CapitalOptimizerService {
  constructor(config) {
    this.config = config;
    this.strategies = config.strategies || [];
    this.metrics = {
      cashYieldRevenue: 0,
      adaptiveLotSizingEvents: 0,
      maxLotSizeReached: config.adaptiveLotSizing?.lotSizeUsd || 10000
    };
  }

  /**
   * Get lot size for a stock based on current cash reserve
   * @param {string} symbol - Stock symbol
   * @param {number} cashReserve - Current cash reserve
   * @param {number} baseLotSize - Baseline lot size
   * @returns {number} Adjusted lot size
   */
  getLotSize(symbol, cashReserve, baseLotSize) {
    if (!this.strategies.includes('adaptive_lot_sizing')) {
      return baseLotSize;
    }

    const config = this.config.adaptiveLotSizing;

    if (cashReserve > config.cashReserveThreshold) {
      const multiplier = Math.min(
        1 + (config.increaseStepPercent / 100),
        config.maxLotSizeMultiplier
      );

      const adjustedLotSize = baseLotSize * multiplier;

      if (adjustedLotSize > this.metrics.maxLotSizeReached) {
        this.metrics.maxLotSizeReached = adjustedLotSize;
      }

      this.metrics.adaptiveLotSizingEvents++;

      return adjustedLotSize;
    }

    return baseLotSize;
  }

  /**
   * Calculate daily cash yield
   * @param {number} cashReserve - Current cash reserve
   * @returns {number} Daily yield revenue
   */
  calculateDailyCashYield(cashReserve) {
    if (!this.strategies.includes('cash_yield')) {
      return 0;
    }

    const config = this.config.cashYield;

    if (cashReserve < config.minCashToInvest) {
      return 0;
    }

    const dailyRate = config.annualYieldPercent / 100 / 365;
    const yieldRevenue = cashReserve * dailyRate;

    this.metrics.cashYieldRevenue += yieldRevenue;

    return yieldRevenue;
  }

  /**
   * Check if cash yield strategy is enabled
   * @returns {boolean}
   */
  isCashYieldEnabled() {
    return this.strategies.includes('cash_yield') && this.config.cashYield?.enabled;
  }

  /**
   * Get optimization metrics
   * @returns {Object} Metrics object
   */
  getMetrics() {
    return { ...this.metrics, strategies: this.strategies };
  }
}

module.exports = CapitalOptimizerService;
```

### 5. Config File Updates

**File:** `backend/configs/portfolios/nasdaq100.json`

**Add New Sections:**
```json
{
  "name": "Nasdaq 100",
  "description": "Portfolio backtest for all Nasdaq 100 component stocks with index tracking",
  "totalCapitalUsd": 3000000,
  "startDate": "2021-09-01",
  "endDate": "2025-10-17",

  // ... existing globalDefaults ...

  "indexTracking": {
    "enabled": true,
    "indexName": "NASDAQ-100",
    "enforceMembership": true,
    "handleRemovals": "liquidate_positions"
  },

  "capitalOptimization": {
    "enabled": true,
    "strategies": ["adaptive_lot_sizing", "cash_yield"],
    "adaptiveLotSizing": {
      "cashReserveThreshold": 100000,
      "maxLotSizeMultiplier": 2.0,
      "increaseStepPercent": 20
    },
    "cashYield": {
      "enabled": true,
      "annualYieldPercent": 4.5,
      "minCashToInvest": 50000
    }
  },

  "stocks": [ /* ... */ ],
  "stockSpecificOverrides": {}
}
```

### 6. Results Data Structure Updates

**File:** `backend/services/portfolioBacktestService.js` (return value)

**Enhanced Results:**
```javascript
{
  // Existing fields
  summary: { /* ... */ },
  stockResults: [ /* ... */ ],
  dailyMetrics: [ /* ... */ ],

  // NEW: Index tracking metrics
  indexTracking: {
    enabled: true,
    indexName: "NASDAQ-100",
    stocksAdded: [
      {
        symbol: "PLTR",
        addedDate: "2024-11-18",
        tradingDays: 245,
        returnPercent: 85.4,
        finalValue: 128450.00
      },
      {
        symbol: "APP",
        addedDate: "2024-09-23",
        tradingDays: 290,
        returnPercent: 42.1,
        finalValue: 95320.50
      }
    ],
    stocksRemoved: [
      {
        symbol: "NOK",
        removedDate: "2023-12-18",
        tradingDays: 468,
        finalValue: 45230.50,
        returnPercent: -8.2
      }
    ],
    forcedLiquidations: 1,
    forcedLiquidationValue: 45230.50,
    partialPeriodStocks: [
      {
        symbol: "PLTR",
        totalDays: 1506,
        tradingDays: 245,
        utilizationPercent: 16.3
      }
    ]
  },

  // NEW: Capital optimization metrics
  capitalOptimization: {
    enabled: true,
    strategies: ["adaptive_lot_sizing", "cash_yield"],
    averageCashReserve: 285400.50,
    peakCashReserve: 425600.00,
    cashReserveHistory: [ /* daily values */ ],
    cashYieldRevenue: 12450.75,
    cashYieldAnnualizedReturn: 4.37, // Calculated
    adaptiveLotSizing: {
      events: 127,
      maxLotSizeReached: 18000,
      averageLotSize: 12340
    }
  }
}
```

### 7. Frontend Updates

**File:** `frontend/src/components/PortfolioResults.js`

**New UI Sections:**

#### 7.1 Index Tracking Summary Card
```jsx
{results.indexTracking?.enabled && (
  <div className="index-tracking-summary">
    <h3>📊 Index Tracking: {results.indexTracking.indexName}</h3>

    {results.indexTracking.stocksAdded.length > 0 && (
      <div className="stocks-added">
        <h4>Stocks Added During Backtest</h4>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Added Date</th>
              <th>Trading Days</th>
              <th>Return</th>
              <th>Final Value</th>
            </tr>
          </thead>
          <tbody>
            {results.indexTracking.stocksAdded.map(stock => (
              <tr key={stock.symbol}>
                <td>{stock.symbol}</td>
                <td>{stock.addedDate}</td>
                <td>{stock.tradingDays}</td>
                <td className={stock.returnPercent >= 0 ? 'positive' : 'negative'}>
                  {stock.returnPercent.toFixed(2)}%
                </td>
                <td>${stock.finalValue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {results.indexTracking.stocksRemoved.length > 0 && (
      <div className="stocks-removed">
        <h4>Stocks Removed During Backtest</h4>
        {/* Similar table for removed stocks */}
      </div>
    )}
  </div>
)}
```

#### 7.2 Capital Optimization Summary Card
```jsx
{results.capitalOptimization?.enabled && (
  <div className="capital-optimization-summary">
    <h3>💰 Capital Optimization</h3>

    <div className="metrics-grid">
      <div className="metric">
        <label>Strategies Enabled</label>
        <value>{results.capitalOptimization.strategies.join(', ')}</value>
      </div>

      {results.capitalOptimization.cashYieldRevenue > 0 && (
        <>
          <div className="metric">
            <label>Cash Yield Revenue</label>
            <value className="positive">
              +${results.capitalOptimization.cashYieldRevenue.toLocaleString()}
            </value>
          </div>
          <div className="metric">
            <label>Cash Yield Annualized Return</label>
            <value>{results.capitalOptimization.cashYieldAnnualizedReturn.toFixed(2)}%</value>
          </div>
        </>
      )}

      {results.capitalOptimization.adaptiveLotSizing && (
        <>
          <div className="metric">
            <label>Adaptive Lot Sizing Events</label>
            <value>{results.capitalOptimization.adaptiveLotSizing.events}</value>
          </div>
          <div className="metric">
            <label>Max Lot Size Reached</label>
            <value>${results.capitalOptimization.adaptiveLotSizing.maxLotSizeReached.toLocaleString()}</value>
          </div>
        </>
      )}
    </div>
  </div>
)}
```

#### 7.3 Enhanced Capital Utilization Chart

**File:** `frontend/src/components/BacktestChart.js`

**Add Annotations for Index Changes:**
```javascript
// When rendering the capital utilization chart
const indexChangeAnnotations = results.indexTracking?.enabled ? [
  ...results.indexTracking.stocksAdded.map(stock => ({
    type: 'line',
    mode: 'vertical',
    scaleID: 'x',
    value: stock.addedDate,
    borderColor: 'green',
    borderWidth: 2,
    label: {
      content: `+${stock.symbol}`,
      enabled: true,
      position: 'top'
    }
  })),
  ...results.indexTracking.stocksRemoved.map(stock => ({
    type: 'line',
    mode: 'vertical',
    scaleID: 'x',
    value: stock.removedDate,
    borderColor: 'red',
    borderWidth: 2,
    label: {
      content: `-${stock.symbol}`,
      enabled: true,
      position: 'top'
    }
  }))
] : [];

// Add to chart options
options.plugins.annotation = {
  annotations: indexChangeAnnotations
};
```

## Data Flow Diagram

```
┌────────────────────┐
│ Portfolio Config   │
│ (nasdaq100.json)   │
└─────────┬──────────┘
          │
          ▼
┌─────────────────────────────────┐
│ portfolioConfigLoader           │
│ - Loads config                  │
│ - Validates indexTracking       │
│ - Validates capitalOptimization │
└─────────┬───────────────────────┘
          │
          ▼
┌───────────────────────────────────────────────────┐
│ portfolioBacktestService.runPortfolioBacktest()   │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ 1. Load Index History (if enabled)          │ │
│  │    ├─ indexTrackingService.loadIndexHistory │ │
│  │    └─ Read nasdaq100-history.json           │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ 2. Initialize Capital Optimizer (if enabled)│ │
│  │    └─ new CapitalOptimizerService(config)   │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ 3. Daily Loop                               │ │
│  │    For each trading day:                    │ │
│  │    ├─ Check index changes                   │ │
│  │    ├─ Handle removals (liquidate)           │ │
│  │    ├─ For each stock:                       │ │
│  │    │  ├─ Check if in index                  │ │
│  │    │  ├─ Get dynamic lot size               │ │
│  │    │  └─ Execute DCA strategy               │ │
│  │    └─ Calculate cash yield                  │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ 4. Aggregate Metrics                        │ │
│  │    ├─ Index tracking metrics                │ │
│  │    ├─ Capital optimization metrics          │ │
│  │    └─ Standard backtest metrics             │ │
│  └─────────────────────────────────────────────┘ │
└───────────────────┬───────────────────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │ Return Results  │
          └─────────┬───────┘
                    │
                    ▼
          ┌─────────────────┐
          │ Frontend        │
          │ PortfolioResults│
          └─────────────────┘
```

## Performance Considerations

### 1. Index Tracking Lookups
- **Strategy:** Cache index history in memory as Map
- **Complexity:** O(1) per stock per day
- **Impact:** ~100 stocks × ~1500 days = 150k lookups → negligible (<5ms total)

### 2. Capital Optimization Calculations
- **Strategy:** Simple arithmetic, no complex algorithms
- **Complexity:** O(1) per day for cash yield
- **Impact:** Negligible

### 3. Memory Usage
- Index history: ~100 entries × ~100 bytes = 10KB
- Optimization state: ~1KB
- **Total Additional Memory:** <20KB (negligible)

## Error Handling

### 1. Missing Index History File
```javascript
// In indexTrackingService.js
async loadIndexHistory(indexName) {
  try {
    const filePath = path.join(__dirname, `../data/${indexName.toLowerCase()}-history.json`);
    const data = await fs.readFile(filePath, 'utf8');
    this.history = JSON.parse(data);
  } catch (error) {
    console.warn(`⚠️  Index history file not found: ${indexName}`);
    console.warn(`   Defaulting to: all stocks in index for entire period`);
    this.history = { changes: [] };
  }
}
```

### 2. Invalid Dates in History
```javascript
// Validate dates when loading
for (const change of data.changes) {
  if (change.addedDate && !isValidDate(change.addedDate)) {
    throw new Error(`Invalid addedDate for ${change.symbol}: ${change.addedDate}`);
  }
  if (change.removedDate && !isValidDate(change.removedDate)) {
    throw new Error(`Invalid removedDate for ${change.symbol}: ${change.removedDate}`);
  }
}
```

### 3. Forced Liquidation Failures
```javascript
// In portfolioBacktestService.js
async function forceLiquidateStock(symbol, date, priceDataMap) {
  try {
    const priceData = priceDataMap.get(symbol)?.get(date);

    if (!priceData) {
      console.error(`❌ Cannot liquidate ${symbol} on ${date}: no price data`);
      return { success: false, reason: 'no_price_data' };
    }

    // ... perform liquidation ...

    console.log(`🔄 Forced liquidation: ${symbol} removed from index on ${date}`);
    return { success: true, value: liquidationValue };

  } catch (error) {
    console.error(`❌ Forced liquidation failed for ${symbol}:`, error);
    return { success: false, reason: error.message };
  }
}
```

## Testing Strategy

### Unit Tests

**File:** `backend/tests/indexTrackingService.test.js`
- Test loading valid index history
- Test handling missing file
- Test isInIndex() with various dates
- Test getTradingPeriod() edge cases

**File:** `backend/tests/capitalOptimizerService.test.js`
- Test adaptive lot sizing calculations
- Test cash yield calculations
- Test strategy enable/disable

### Integration Tests

**File:** `backend/tests/portfolioBacktest.integration.test.js`
- Test backtest with index tracking enabled
- Test forced liquidation on removal
- Test stock not traded before addition
- Test cash yield revenue calculation

### Manual Testing Checklist

1. Run nasdaq100 backtest WITHOUT index tracking → Verify baseline results
2. Run nasdaq100 backtest WITH index tracking → Verify lower returns (more realistic)
3. Compare PLTR results: with vs without tracking
4. Verify forced liquidation appears in transaction log
5. Verify cash yield revenue adds up correctly
6. Verify adaptive lot sizing events in results

## Migration Path

### Phase 1: Core Infrastructure (Week 1)
- Create `indexTrackingService.js`
- Create `nasdaq100-history.json` with manual research
- Add basic index membership checks

### Phase 2: Portfolio Integration (Week 1)
- Modify `portfolioBacktestService.js` to use index tracking
- Implement forced liquidation
- Add index tracking metrics to results

### Phase 3: Capital Optimization (Week 2)
- Create `capitalOptimizerService.js`
- Implement adaptive lot sizing
- Implement cash yield strategy

### Phase 4: Frontend Updates (Week 2)
- Add index tracking summary card
- Add capital optimization summary card
- Enhance capital utilization chart with annotations

### Phase 5: Testing & Documentation (Week 3)
- Write unit tests
- Write integration tests
- Manual testing and verification
- Update user documentation

## Backward Compatibility

- Existing configs without `indexTracking` section → Default to `enabled: false`
- Existing configs without `capitalOptimization` section → Default to `enabled: false`
- No breaking changes to existing API endpoints
- Existing backtest results format unchanged (only additions)

## Future Enhancements

### 1. Automatic Index Data Fetching
- API integration with index providers
- Scheduled updates for latest changes

### 2. Additional Optimization Strategies
- Strategy B: Dynamic Grid Tightening
- Strategy C: Opportunistic Stock Addition
- Strategy E: Smart Rebalancing

### 3. Multi-Index Support
- S&P 500 tracking
- Russell 2000 tracking
- Custom index definitions

### 4. ML-based Capital Allocation
- Predict optimal lot sizes using historical patterns
- Adaptive strategy selection based on market conditions
