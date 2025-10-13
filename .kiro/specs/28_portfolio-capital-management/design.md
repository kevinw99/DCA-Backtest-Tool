# Spec 28: Portfolio-Based Capital Management - Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Portfolio Backtest Flow                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Initialize Portfolio                                      │
│     - Load config (10 stocks, $500K capital)                 │
│     - Fetch price data for all stocks                        │
│     - Initialize capital pool                                │
│                                                               │
│  2. Chronological Simulation                                 │
│     FOR EACH DATE:                                            │
│       a. Update portfolio valuations                          │
│       b. Process SELLS first (returns capital)               │
│       c. Process BUYS (if capital available)                 │
│       d. Log rejected orders                                  │
│       e. Calculate metrics                                    │
│                                                               │
│  3. Aggregate Results                                         │
│     - Portfolio-level metrics                                 │
│     - Per-stock metrics                                       │
│     - Time-series data                                        │
│     - Rejected order log                                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Core Data Structures

### Portfolio State

```javascript
class PortfolioState {
  constructor(config) {
    this.totalCapital = config.totalCapital;      // 500000
    this.cashReserve = config.totalCapital;       // Starts at total
    this.deployedCapital = 0;                     // Starts at 0

    this.stocks = new Map();                       // symbol -> StockState
    this.rejectedOrders = [];
    this.capitalFlowHistory = [];
    this.valuationHistory = [];
  }

  get availableCapital() {
    return this.cashReserve;
  }

  get portfolioValue() {
    let total = this.cashReserve;
    for (const stock of this.stocks.values()) {
      total += stock.marketValue;
    }
    return total;
  }

  get totalPNL() {
    return this.portfolioValue - this.totalCapital;
  }

  get utilizationPercent() {
    return (this.deployedCapital / this.totalCapital) * 100;
  }
}
```

### Stock State

```javascript
class StockState {
  constructor(symbol, params) {
    this.symbol = symbol;
    this.params = params;

    // Holdings
    this.lots = [];                                // Array of {price, shares, date}
    this.lotsHeld = 0;
    this.averageCost = 0;

    // Capital
    this.capitalDeployed = 0;                      // Sum of lot costs
    this.marketValue = 0;                          // Current position value

    // P&L
    this.unrealizedPNL = 0;
    this.realizedPNL = 0;
    this.totalPNL = 0;

    // Activity
    this.transactions = [];
    this.rejectedBuys = 0;

    // DCA state (passed to dcaBacktestService)
    this.dcaState = {
      lastBuyPrice: null,
      lastSellPrice: null,
      trailingStopBuy: null,
      activeStop: null,
      // ... all DCA state variables
    };
  }

  updateMarketValue(currentPrice) {
    this.marketValue = this.lots.reduce((sum, lot) => {
      return sum + (lot.shares * currentPrice);
    }, 0);

    this.unrealizedPNL = this.marketValue - this.capitalDeployed;
    this.totalPNL = this.realizedPNL + this.unrealizedPNL;
  }
}
```

### Transaction Event

```javascript
{
  date: "2022-03-15",
  symbol: "NVDA",
  type: "BUY" | "SELL" | "REJECTED_BUY",

  // For successful transactions
  price: 245.50,
  shares: 40.73,
  value: 10000,

  // For rejected orders
  reason: "INSUFFICIENT_CAPITAL",
  availableCapital: 8500,
  requiredCapital: 10000,
  shortfall: 1500,

  // Portfolio state snapshot
  portfolioState: {
    cashReserve: 8500,
    deployedCapital: 491500,
    utilizationPercent: 98.3
  }
}
```

## Service Layer Design

### portfolioBacktestService.js

**Main orchestration logic:**

```javascript
async function runPortfolioBacktest(config) {
  // 1. Initialize
  const portfolio = new PortfolioState(config);
  const priceDataMap = await loadAllPriceData(config.stocks, config.startDate, config.endDate);

  // 2. Get all unique dates (union of all stock dates)
  const allDates = getAllUniqueDates(priceDataMap);

  // 3. Simulate chronologically
  for (const date of allDates) {
    // a. Update valuations for all stocks
    for (const [symbol, stock] of portfolio.stocks) {
      const currentPrice = priceDataMap.get(symbol).get(date);
      if (currentPrice) {
        stock.updateMarketValue(currentPrice);
      }
    }

    // b. Process SELLS first (returns capital to pool)
    const sellOrders = await identifySellOrders(portfolio, date, priceDataMap);
    for (const order of sellOrders) {
      const sellValue = await executeSell(portfolio, order);
      portfolio.cashReserve += sellValue;
      portfolio.deployedCapital -= sellValue;
    }

    // c. Process BUYS (if capital available)
    const buyOrders = await identifyBuyOrders(portfolio, date, priceDataMap);
    for (const order of buyOrders) {
      if (portfolio.cashReserve >= config.lotSizeUsd) {
        await executeBuy(portfolio, order);
        portfolio.cashReserve -= config.lotSizeUsd;
        portfolio.deployedCapital += config.lotSizeUsd;
      } else {
        logRejectedOrder(portfolio, order, 'INSUFFICIENT_CAPITAL');
      }
    }

    // d. Snapshot portfolio state
    portfolio.valuationHistory.push(createSnapshot(portfolio, date));
  }

  // 4. Calculate final metrics
  return calculatePortfolioMetrics(portfolio);
}
```

### Key Helper Functions

#### identifyBuyOrders()

```javascript
async function identifyBuyOrders(portfolio, date, priceDataMap) {
  const buyOrders = [];

  // Process stocks in deterministic order (alphabetical)
  const sortedSymbols = Array.from(portfolio.stocks.keys()).sort();

  for (const symbol of sortedSymbols) {
    const stock = portfolio.stocks.get(symbol);
    const priceData = priceDataMap.get(symbol).get(date);

    if (!priceData) continue;

    // Check if stock triggers buy signal using existing DCA logic
    const buySignal = evaluateBuySignal(stock, priceData);

    if (buySignal.triggered) {
      buyOrders.push({
        symbol,
        date,
        price: priceData.close,
        signal: buySignal
      });
    }
  }

  return buyOrders;
}
```

#### evaluateBuySignal()

```javascript
function evaluateBuySignal(stock, priceData) {
  // Reuse existing DCA buy logic
  // Check:
  // - Max lots constraint
  // - Grid spacing
  // - Trailing stop conditions
  // - All existing DCA rules

  // This delegates to dcaBacktestService logic
  // but returns a signal instead of executing

  return {
    triggered: true/false,
    type: 'TRAILING_STOP_BUY' | 'IMMEDIATE_BUY',
    stopPrice: 123.45,
    reason: 'Grid spacing met, trailing stop triggered'
  };
}
```

### portfolioMetricsService.js

**Calculates all portfolio-level metrics:**

```javascript
function calculatePortfolioMetrics(portfolio) {
  return {
    portfolioSummary: {
      // Capital
      totalCapital: portfolio.totalCapital,
      finalPortfolioValue: portfolio.portfolioValue,
      cashReserve: portfolio.cashReserve,
      deployedCapital: portfolio.deployedCapital,
      utilizationPercent: portfolio.utilizationPercent,

      // Performance
      totalReturn: portfolio.totalPNL,
      totalReturnPercent: (portfolio.totalPNL / portfolio.totalCapital) * 100,
      cagr: calculateCAGR(portfolio),
      maxDrawdown: calculateMaxDrawdown(portfolio.valuationHistory),
      sharpeRatio: calculateSharpeRatio(portfolio.valuationHistory),
      sortinoRatio: calculateSortinoRatio(portfolio.valuationHistory),

      // Activity
      totalBuys: countTotalBuys(portfolio),
      totalSells: countTotalSells(portfolio),
      rejectedBuys: portfolio.rejectedOrders.length,
      rejectedBuysValue: sumRejectedValue(portfolio.rejectedOrders)
    },

    stockResults: calculatePerStockMetrics(portfolio),

    capitalUtilizationTimeSeries: portfolio.valuationHistory,

    rejectedOrders: portfolio.rejectedOrders,

    capitalFlow: portfolio.capitalFlowHistory
  };
}
```

#### Per-Stock Metrics

```javascript
function calculatePerStockMetrics(portfolio) {
  const results = [];

  for (const [symbol, stock] of portfolio.stocks) {
    const stockReturn = stock.totalPNL;
    const contributionPercent = (stockReturn / portfolio.totalPNL) * 100;

    results.push({
      symbol,
      lotsHeld: stock.lotsHeld,
      capitalDeployed: stock.capitalDeployed,
      marketValue: stock.marketValue,
      unrealizedPNL: stock.unrealizedPNL,
      realizedPNL: stock.realizedPNL,
      totalPNL: stock.totalPNL,

      // Performance
      stockReturn: stockReturn,
      stockReturnPercent: (stockReturn / stock.capitalDeployed) * 100,
      cagr: calculateStockCAGR(stock),
      maxDrawdown: calculateStockMaxDrawdown(stock),
      sharpeRatio: calculateStockSharpeRatio(stock),

      // Activity
      totalBuys: countBuys(stock),
      totalSells: countSells(stock),
      rejectedBuys: stock.rejectedBuys,

      // Portfolio contribution
      contributionToPortfolioReturn: contributionPercent,
      contributionToPortfolioValue: (stock.marketValue / portfolio.portfolioValue) * 100
    });
  }

  // Sort by contribution descending
  return results.sort((a, b) => b.contributionToPortfolioReturn - a.contributionToPortfolioReturn);
}
```

## API Implementation

### New Endpoint

```javascript
// server.js
app.post('/api/portfolio-backtest', async (req, res) => {
  try {
    const {
      portfolioMode,
      totalCapital,
      startDate,
      endDate,
      lotSizeUsd,
      maxLotsPerStock,
      defaultParams,
      stocks
    } = req.body;

    // Validate
    if (!portfolioMode) {
      return res.status(400).json({
        success: false,
        error: 'Portfolio mode not enabled'
      });
    }

    if (!stocks || stocks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No stocks provided'
      });
    }

    // Run portfolio backtest
    const results = await portfolioBacktestService.runPortfolioBacktest({
      totalCapital,
      startDate,
      endDate,
      lotSizeUsd,
      maxLotsPerStock,
      defaultParams,
      stocks
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Portfolio backtest error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

## Frontend Design

### Component Structure

```
PortfolioBacktest.js
├── PortfolioConfig
│   ├── CapitalSettings ($500K, lot size)
│   ├── StockSelection (10 stocks from list)
│   └── CommonParameters (DCA settings for all)
│
└── [Run Portfolio Backtest Button]

PortfolioResults.js
├── PortfolioSummary
│   ├── Performance Cards (Total Return, CAGR, Sharpe)
│   ├── Capital Utilization Gauge
│   └── Rejected Orders Badge
│
├── CapitalUtilizationChart
│   └── Line chart: Capital Deployed vs Available over time
│
├── StockAllocationTable
│   ├── Per-stock metrics
│   ├── Contribution %
│   ├── Sortable columns
│   └── Click to expand transaction history
│
├── RejectedOrdersLog
│   └── Table of all rejected orders with context
│
└── PortfolioCharts
    ├── Portfolio Value over time
    ├── Per-stock contribution pie chart
    └── Drawdown chart
```

### CapitalUtilizationChart Component

```javascript
function CapitalUtilizationChart({ timeSeries }) {
  const data = timeSeries.map(snapshot => ({
    date: snapshot.date,
    deployed: snapshot.deployedCapital,
    available: snapshot.cashReserve,
    utilization: snapshot.utilizationPercent
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <XAxis dataKey="date" />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />

        <Line yAxisId="left" type="monotone"
              dataKey="deployed" stroke="#8884d8" name="Deployed" />
        <Line yAxisId="left" type="monotone"
              dataKey="available" stroke="#82ca9d" name="Available" />
        <Line yAxisId="right" type="monotone"
              dataKey="utilization" stroke="#ffc658" name="Utilization %" />

        <Tooltip />
        <Legend />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

## Database Schema (Future)

**For saving portfolio configurations:**

```sql
CREATE TABLE portfolio_configs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(255),
  total_capital DECIMAL(15,2),
  lot_size_usd DECIMAL(10,2),
  max_lots_per_stock INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE portfolio_stocks (
  id SERIAL PRIMARY KEY,
  portfolio_id INTEGER REFERENCES portfolio_configs(id),
  symbol VARCHAR(10),
  custom_params JSONB,  -- Stock-specific parameter overrides
  weight_target DECIMAL(5,4),  -- Future: target allocation
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE portfolio_backtest_results (
  id SERIAL PRIMARY KEY,
  portfolio_id INTEGER REFERENCES portfolio_configs(id),
  start_date DATE,
  end_date DATE,
  total_return DECIMAL(15,2),
  cagr DECIMAL(5,4),
  max_drawdown DECIMAL(15,2),
  results_json JSONB,  -- Full results
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Performance Optimizations

### 1. Price Data Loading
```javascript
// Load all stock prices in parallel
const pricePromises = stocks.map(stock =>
  database.getPricesWithIndicators(stock.id, startDate, endDate)
);
const allPrices = await Promise.all(pricePromises);
```

### 2. Caching
```javascript
// Cache calculated metrics that don't change
const metricsCache = new Map();

function getCachedMetric(key, calculator) {
  if (!metricsCache.has(key)) {
    metricsCache.set(key, calculator());
  }
  return metricsCache.get(key);
}
```

### 3. Incremental Calculations
```javascript
// Update metrics incrementally instead of recalculating from scratch
class IncrementalMetrics {
  update(transaction) {
    this.totalPNL += transaction.pnl;
    this.totalBuys += (transaction.type === 'BUY' ? 1 : 0);
    // ... other incremental updates
  }
}
```

## Error Handling

### Capital Constraint Validation

```javascript
function validateCapitalConstraints(portfolio) {
  const calculated = portfolio.deployedCapital + portfolio.cashReserve;
  const expected = portfolio.totalCapital;

  if (Math.abs(calculated - expected) > 0.01) {
    throw new Error(
      `Capital constraint violated: ` +
      `deployed(${portfolio.deployedCapital}) + ` +
      `cash(${portfolio.cashReserve}) = ${calculated}, ` +
      `expected ${expected}`
    );
  }
}

// Call after every transaction
executeBuy(...);
validateCapitalConstraints(portfolio);

executeSell(...);
validateCapitalConstraints(portfolio);
```

## Testing Strategy

### Unit Tests

```javascript
describe('PortfolioState', () => {
  test('maintains capital constraints', () => {
    const portfolio = new PortfolioState({ totalCapital: 500000 });

    // Buy depletes cash
    portfolio.cashReserve -= 10000;
    portfolio.deployedCapital += 10000;

    expect(portfolio.cashReserve + portfolio.deployedCapital).toBe(500000);
  });

  test('rejects buy when insufficient capital', () => {
    const portfolio = new PortfolioState({ totalCapital: 500000 });
    portfolio.cashReserve = 5000;  // Less than lot size

    const canBuy = portfolio.cashReserve >= 10000;
    expect(canBuy).toBe(false);
  });
});
```

### Integration Tests

```javascript
describe('Portfolio Backtest', () => {
  test('10-stock portfolio with $500K capital', async () => {
    const result = await runPortfolioBacktest({
      totalCapital: 500000,
      lotSizeUsd: 10000,
      stocks: ['TSLA', 'AAPL', 'NVDA', ...],
      startDate: '2021-09-01',
      endDate: '2025-10-09'
    });

    expect(result.portfolioSummary.totalCapital).toBe(500000);
    expect(result.stockResults.length).toBe(10);

    // Verify sum of stock P&L = portfolio P&L
    const sumStockPNL = result.stockResults.reduce(
      (sum, stock) => sum + stock.totalPNL, 0
    );
    expect(Math.abs(sumStockPNL - result.portfolioSummary.totalReturn)).toBeLessThan(0.01);
  });
});
```

## Logging Strategy

### Detailed Logging

```javascript
// Log every significant event
logger.info('Portfolio backtest started', {
  totalCapital: config.totalCapital,
  stocks: config.stocks.length,
  dateRange: `${config.startDate} to ${config.endDate}`
});

logger.debug('Processing date', {
  date: currentDate,
  cashReserve: portfolio.cashReserve,
  deployedCapital: portfolio.deployedCapital,
  portfolioValue: portfolio.portfolioValue
});

logger.warn('Buy order rejected', {
  symbol: order.symbol,
  date: order.date,
  price: order.price,
  requiredCapital: 10000,
  availableCapital: portfolio.cashReserve,
  shortfall: 10000 - portfolio.cashReserve
});

logger.info('Portfolio backtest completed', {
  duration: endTime - startTime,
  totalReturn: results.portfolioSummary.totalReturn,
  rejectedOrders: results.rejectedOrders.length
});
```

## Summary

This design provides:
- **Shared capital pool** with strict constraint enforcement
- **Deterministic execution** order (alphabetical by symbol)
- **Complete transparency** with rejected order logging
- **Comprehensive metrics** at both portfolio and stock levels
- **Reusability** of existing DCA backtest logic
- **Scalability** for future enhancements (rebalancing, optimization)

The architecture cleanly separates concerns:
- `portfolioBacktestService.js` - Orchestration
- `dcaBacktestService.js` - Individual stock logic (reused)
- `portfolioMetricsService.js` - Calculations
- Frontend components - Visualization

Next: `tasks.md` with detailed implementation steps.
