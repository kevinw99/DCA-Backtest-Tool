# Design Document: Portfolio Visualization Enhancements

## Architecture Overview

### Component Hierarchy

```
PortfolioResults
├── PortfolioSummaryCard (existing)
├── PortfolioCompositionChart (NEW)
│   ├── StackedAreaChart (portfolio value by stock)
│   └── PortfolioValueLine (total value overlay)
├── MultiStockPriceChart (NEW)
│   ├── NormalizedPriceLines (all stocks)
│   └── TransactionMarkers (buy/sell/rejected)
├── CapitalAllocationChart (NEW)
│   ├── DeployedCapitalStacked (by stock)
│   └── UtilizationLine (% overlay)
├── CapitalUtilizationChart (existing - keep)
├── StockPerformanceTable (ENHANCED)
│   ├── Add: Link to stock detail page
│   └── Add: Rejected order count per stock
└── RejectedOrdersTable (existing)

Stock Detail (REUSE EXISTING)
└── Use existing `/backtest/long/:symbol/results` page
    ├── Enhanced Transaction History (add "Insufficient Capital" support)
    └── Daily Transaction Log (add "Insufficient Capital" support)
```

## Data Flow

### 1. Enhanced Backend Response

Modify `portfolioBacktestService.js` to include additional data:

```javascript
// Current structure
{
  portfolioSummary: {...},
  stockResults: [...],
  capitalUtilizationTimeSeries: [...],
  rejectedOrders: [...]
}

// Enhanced structure
{
  portfolioSummary: {...},
  stockResults: [
    {
      symbol: 'AAPL',
      // existing metrics...
      transactions: [...],          // NEW: individual transactions
      rejectedOrders: [...],        // NEW: stock-specific rejected orders
      priceData: [                  // NEW: OHLC data for chart
        { date: '2024-01-01', open, high, low, close },
        ...
      ]
    }
  ],
  capitalUtilizationTimeSeries: [...],
  portfolioCompositionTimeSeries: [  // NEW
    {
      date: '2024-01-01',
      AAPL: 10000,    // market value
      TSLA: 15000,
      cash: 75000,
      total: 100000
    },
    ...
  ],
  rejectedOrders: [...],
  portfolioRunId: 'uuid-123',        // NEW: for URL generation
  parameters: {...}                   // NEW: for URL reconstruction
}
```

### 2. Frontend State Management

```javascript
// PortfolioBacktestPage state
const [results, setResults] = useState({
  portfolioSummary: {...},
  stockResults: [...],
  capitalUtilizationTimeSeries: [...],
  portfolioCompositionTimeSeries: [...],  // NEW
  rejectedOrders: [...],
  portfolioRunId: 'uuid',
  parameters: {...}
});

// Store in sessionStorage for navigation back from stock detail
sessionStorage.setItem(
  `portfolio-run-${portfolioRunId}`,
  JSON.stringify(results)
);
```

## Component Specifications

### 1. PortfolioCompositionChart

**Purpose:** Show portfolio value composition over time (stacked area)

**Props:**
```typescript
interface PortfolioCompositionChartProps {
  timeSeries: Array<{
    date: string;
    [stockSymbol: string]: number;  // dynamic stock keys
    cash: number;
    total: number;
  }>;
  stocks: string[];  // list of stock symbols
}
```

**Implementation:**
```jsx
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const PortfolioCompositionChart = ({ timeSeries, stocks }) => {
  const [hiddenStocks, setHiddenStocks] = useState(new Set());

  // Color palette (colorblind-friendly)
  const stockColors = {
    AAPL: '#1f77b4', TSLA: '#ff7f0e', NVDA: '#2ca02c',
    MSFT: '#d62728', GOOGL: '#9467bd', AMZN: '#8c564b',
    // ... etc
  };

  return (
    <div className="portfolio-composition-chart">
      <h3>Portfolio Composition Over Time</h3>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={timeSeries}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis yAxisId="left" label="Value ($)" />
          <Tooltip content={<CustomTooltip />} />
          <Legend onClick={handleLegendClick} />

          {/* Stacked areas for each stock */}
          {stocks.map(symbol => (
            !hiddenStocks.has(symbol) && (
              <Area
                key={symbol}
                yAxisId="left"
                type="monotone"
                dataKey={symbol}
                stackId="1"
                fill={stockColors[symbol]}
                stroke={stockColors[symbol]}
                name={symbol}
              />
            )
          ))}

          {/* Cash reserve */}
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="cash"
            stackId="1"
            fill="#e0e0e0"
            stroke="#999"
            name="Cash"
          />

          {/* Total portfolio value line overlay */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="total"
            stroke="#000"
            strokeWidth={3}
            name="Total Value"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
```

### 2. MultiStockPriceChart

**Purpose:** Show normalized stock prices with transaction markers

**Props:**
```typescript
interface MultiStockPriceChartProps {
  stockResults: Array<{
    symbol: string;
    priceData: Array<{ date: string; close: number }>;
    transactions: Array<{
      date: string;
      type: 'BUY' | 'SELL';
      price: number;
      shares: number;
      value: number;
    }>;
    rejectedOrders: Array<{
      date: string;
      price: number;
      attemptedValue: number;
    }>;
  }>;
}
```

**Implementation:**
```jsx
const MultiStockPriceChart = ({ stockResults }) => {
  const [hiddenStocks, setHiddenStocks] = useState(new Set());

  // Normalize prices to % change from start
  const normalizedData = useMemo(() => {
    const dateMap = new Map();

    stockResults.forEach(({ symbol, priceData }) => {
      const startPrice = priceData[0].close;

      priceData.forEach(({ date, close }) => {
        if (!dateMap.has(date)) {
          dateMap.set(date, { date });
        }
        const normalized = ((close - startPrice) / startPrice) * 100;
        dateMap.get(date)[symbol] = normalized;
      });
    });

    return Array.from(dateMap.values()).sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );
  }, [stockResults]);

  // Prepare transaction markers
  const markers = useMemo(() => {
    const allMarkers = [];

    stockResults.forEach(({ symbol, transactions, rejectedOrders, priceData }) => {
      const startPrice = priceData[0].close;

      // Executed transactions
      transactions.forEach(tx => {
        const normalized = ((tx.price - startPrice) / startPrice) * 100;
        allMarkers.push({
          date: tx.date,
          symbol,
          type: tx.type,
          normalizedPrice: normalized,
          ...tx
        });
      });

      // Rejected orders
      rejectedOrders.forEach(order => {
        const normalized = ((order.price - startPrice) / startPrice) * 100;
        allMarkers.push({
          date: order.date,
          symbol,
          type: 'REJECTED',
          normalizedPrice: normalized,
          ...order
        });
      });
    });

    return allMarkers;
  }, [stockResults]);

  return (
    <div className="multi-stock-price-chart">
      <h3>Multi-Stock Price Comparison</h3>
      <ResponsiveContainer width="100%" height={500}>
        <LineChart data={normalizedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis label="% Change" />
          <Tooltip content={<PriceTooltip />} />
          <Legend onClick={handleLegendClick} />

          {/* Reference line at 0% */}
          <ReferenceLine y={0} stroke="#000" strokeDasharray="3 3" />

          {/* Price lines for each stock */}
          {stockResults.map(({ symbol }) => (
            !hiddenStocks.has(symbol) && (
              <Line
                key={symbol}
                type="monotone"
                dataKey={symbol}
                stroke={stockColors[symbol]}
                strokeWidth={2}
                dot={false}
                name={symbol}
              />
            )
          ))}

          {/* Transaction markers as scatter points */}
          <Scatter
            data={markers.filter(m => m.type === 'BUY')}
            fill="green"
            shape="triangle"
          />
          <Scatter
            data={markers.filter(m => m.type === 'SELL')}
            fill="red"
            shape="triangleDown"
          />
          <Scatter
            data={markers.filter(m => m.type === 'REJECTED')}
            fill="orange"
            shape="triangleUp"
            fillOpacity={0.5}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
```

### 3. CapitalAllocationChart

**Purpose:** Show deployed capital by stock over time

**Implementation:** Similar to CapitalUtilizationChart but with stacked areas for each stock

### 4. Enhanced StockPerformanceTable

**Add Link Column:**
```jsx
const StockPerformanceTable = ({ stocks, portfolioRunId, parameters }) => {
  const generateStockDetailUrl = (symbol) => {
    const params = new URLSearchParams({
      run: portfolioRunId,
      startDate: parameters.startDate,
      endDate: parameters.endDate,
      totalCapital: parameters.totalCapital,
      lotSize: parameters.lotSizeUsd,
      // ... other parameters
    });

    return `/portfolio-backtest/stock/${symbol}?${params.toString()}`;
  };

  return (
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          {/* ... existing columns ... */}
          <th>Rejected</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {stocks.map(stock => (
          <tr key={stock.symbol}>
            <td>{stock.symbol}</td>
            {/* ... existing cells ... */}
            <td>{stock.rejectedBuys || 0}</td>
            <td>
              <Link to={generateStockDetailUrl(stock.symbol)}>
                View Details →
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

### 5. Enhanced StockPerformanceTable with Links to Existing Results

**Generate URLs to Existing Results Page:**
```jsx
const StockPerformanceTable = ({ stocks, portfolioRunId, parameters }) => {
  const generateStockDetailUrl = (stock) => {
    const params = new URLSearchParams({
      strategyMode: 'long',
      symbol: stock.symbol,
      startDate: parameters.startDate,
      endDate: parameters.endDate,
      lotSizeUsd: parameters.lotSizeUsd,
      maxLots: parameters.maxLotsPerStock,
      gridIntervalPercent: stock.params?.gridIntervalPercent || parameters.defaultParams.gridIntervalPercent,
      profitRequirement: stock.params?.profitRequirement || parameters.defaultParams.profitRequirement,
      // NEW: Indicate this is from portfolio context
      portfolioRunId: portfolioRunId,
      source: 'portfolio'
    });

    return `/backtest/long/${stock.symbol}/results?${params.toString()}`;
  };

  return (
    <table className="stock-performance-table">
      {/* ... existing columns ... */}
      <tbody>
        {stocks.map(stock => (
          <tr key={stock.symbol} onClick={() => window.location.href = generateStockDetailUrl(stock)}>
            <td>
              <Link to={generateStockDetailUrl(stock)}>{stock.symbol}</Link>
            </td>
            {/* ... other cells ... */}
            <td>{stock.rejectedBuys || 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

### 6. New Backend Endpoint: Portfolio Stock Results

**Endpoint:** `GET /api/portfolio-backtest/:runId/stock/:symbol/results`

```javascript
// In server.js
app.get('/api/portfolio-backtest/:runId/stock/:symbol/results', async (req, res) => {
  try {
    const { runId, symbol } = req.params;

    // Retrieve cached portfolio results from storage
    const portfolioResults = await portfolioResultsCache.get(runId);

    if (!portfolioResults) {
      return res.status(404).json({
        success: false,
        error: 'Portfolio run not found',
        message: 'This portfolio run may have expired or does not exist'
      });
    }

    // Find stock data
    const stockData = portfolioResults.stockResults.find(s => s.symbol === symbol);

    if (!stockData) {
      return res.status(404).json({
        success: false,
        error: 'Stock not found in portfolio',
        message: `Stock ${symbol} was not part of this portfolio run`
      });
    }

    // Convert to DCA backtest result format (compatible with existing UI)
    const dcaFormatResult = convertPortfolioStockToDcaFormat(stockData, portfolioResults);

    res.json({
      success: true,
      data: dcaFormatResult,
      metadata: {
        source: 'portfolio',
        portfolioRunId: runId,
        portfolioCapital: portfolioResults.portfolioSummary.totalCapital
      }
    });

  } catch (error) {
    console.error('Error fetching portfolio stock results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stock results',
      message: error.message
    });
  }
});

function convertPortfolioStockToDcaFormat(stockData, portfolioResults) {
  return {
    symbol: stockData.symbol,
    strategyMode: 'long',
    parameters: stockData.params,

    // Convert transactions to DCA format
    transactions: stockData.transactions.map(tx => ({
      date: tx.date,
      type: tx.type,
      price: tx.price,
      shares: tx.shares,
      value: tx.value,
      costBasis: tx.lotsCost,
      realizedPNL: tx.realizedPNL || 0
    })),

    // Add "Insufficient Capital" events as special transactions
    insufficientCapitalEvents: stockData.rejectedOrders.map(order => ({
      date: order.date,
      type: 'INSUFFICIENT_CAPITAL',
      attemptedPrice: order.price,
      attemptedShares: order.attemptedValue / order.price,
      attemptedValue: order.attemptedValue,
      availableCapital: order.availableCapital,
      shortfall: order.shortfall,
      reason: 'Portfolio capital deployed to other stocks',
      competingStocks: order.competingStocks || []
    })),

    // Metrics
    summary: {
      totalReturn: stockData.totalPNL,
      totalReturnPercent: stockData.stockReturnPercent,
      realizedPNL: stockData.realizedPNL,
      unrealizedPNL: stockData.unrealizedPNL,
      totalBuys: stockData.totalBuys,
      totalSells: stockData.totalSells,
      rejectedBuys: stockData.rejectedBuys,
      // ... other metrics
    },

    // Price data for charting
    priceData: stockData.priceData,

    // Portfolio context
    portfolioContext: {
      fromPortfolio: true,
      portfolioRunId: portfolioResults.portfolioRunId,
      totalCapital: portfolioResults.portfolioSummary.totalCapital,
      stocksInPortfolio: portfolioResults.stockResults.map(s => s.symbol)
    }
  };
}
```

### 7. Portfolio Results Cache (Backend)

```javascript
// In backend/services/portfolioResultsCache.js
class PortfolioResultsCache {
  constructor() {
    this.cache = new Map();
    this.maxAge = 24 * 60 * 60 * 1000; // 24 hours
  }

  set(runId, results) {
    this.cache.set(runId, {
      data: results,
      timestamp: Date.now()
    });

    // Clean old entries
    this.cleanup();
  }

  get(runId) {
    const entry = this.cache.get(runId);

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(runId);
      return null;
    }

    return entry.data;
  }

  cleanup() {
    const now = Date.now();
    for (const [runId, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(runId);
      }
    }
  }
}

module.exports = new PortfolioResultsCache();
```

### 8. Enhance Existing Transaction History Components

**Add Support for "Insufficient Capital" Events:**

```jsx
// In existing EnhancedTransactionHistory component
const EnhancedTransactionHistory = ({ transactions, insufficientCapitalEvents = [] }) => {
  // Merge all events and sort by date
  const allEvents = [
    ...transactions.map(tx => ({ ...tx, eventType: 'transaction' })),
    ...insufficientCapitalEvents.map(evt => ({ ...evt, eventType: 'insufficientCapital' }))
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <table className="transaction-history">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Price</th>
          <th>Shares</th>
          <th>Value</th>
          <th>P&L</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        {allEvents.map((event, idx) => {
          if (event.eventType === 'insufficientCapital') {
            return (
              <tr key={idx} className="insufficient-capital-row">
                <td>{event.date}</td>
                <td>
                  <span className="event-badge insufficient">
                    🚫 Insufficient Capital
                  </span>
                </td>
                <td>${event.attemptedPrice.toFixed(2)}</td>
                <td>{event.attemptedShares.toFixed(2)}</td>
                <td>${event.attemptedValue.toFixed(2)}</td>
                <td className="shortfall">-${event.shortfall.toFixed(2)}</td>
                <td>
                  <button onClick={() => showInsufficientCapitalDetails(event)}>
                    View Details
                  </button>
                </td>
              </tr>
            );
          } else {
            return (
              <tr key={idx} className={`${event.type.toLowerCase()}-row`}>
                {/* Existing transaction rendering */}
              </tr>
            );
          }
        })}
      </tbody>
    </table>
  );
};
```

**Insufficient Capital Details Modal:**
```jsx
const InsufficientCapitalDetails = ({ event }) => {
  return (
    <div className="modal">
      <h3>Insufficient Capital Event</h3>
      <div className="detail-grid">
        <div>
          <strong>Date:</strong> {event.date}
        </div>
        <div>
          <strong>Attempted Buy:</strong> ${event.attemptedValue.toFixed(2)}
        </div>
        <div>
          <strong>Available Capital:</strong> ${event.availableCapital.toFixed(2)}
        </div>
        <div>
          <strong>Shortfall:</strong> <span className="negative">${event.shortfall.toFixed(2)}</span>
        </div>
        <div>
          <strong>Reason:</strong> {event.reason}
        </div>
        {event.competingStocks && event.competingStocks.length > 0 && (
          <div>
            <strong>Capital Held By:</strong>
            <ul>
              {event.competingStocks.map(symbol => (
                <li key={symbol}>{symbol}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
```

## Backend Modifications

### Enhance portfolioBacktestService.js

**Add price data collection:**
```javascript
async function runPortfolioBacktest(config) {
  // ... existing code ...

  // NEW: Collect price data for each stock
  const stockPriceData = new Map();

  for (const [symbol, priceData] of priceDataMap.entries()) {
    stockPriceData.set(symbol, priceData.map(p => ({
      date: p.date,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close
    })));
  }

  // NEW: Build portfolio composition time series
  const compositionTimeSeries = [];

  for (const snapshot of capitalUtilizationTimeSeries) {
    const composition = {
      date: snapshot.date,
      cash: snapshot.cashReserve,
      total: snapshot.portfolioValue
    };

    // Add each stock's market value
    for (const [symbol, stockState] of portfolio.stocks.entries()) {
      composition[symbol] = stockState.marketValue;
    }

    compositionTimeSeries.push(composition);
  }

  // NEW: Generate unique run ID
  const portfolioRunId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    success: true,
    portfolioRunId,                           // NEW
    parameters: config,                        // NEW
    portfolioSummary: buildPortfolioSummary(portfolio),
    stockResults: Array.from(portfolio.stocks.values()).map(stock => ({
      symbol: stock.symbol,
      // ... existing fields ...
      transactions: stock.transactions,        // NEW
      rejectedOrders: stock.rejectedOrders,   // NEW
      priceData: stockPriceData.get(stock.symbol)  // NEW
    })),
    capitalUtilizationTimeSeries,
    portfolioCompositionTimeSeries: compositionTimeSeries,  // NEW
    rejectedOrders: portfolio.rejectedOrders
  };
}
```

### Update StockState class

```javascript
class StockState {
  constructor(symbol, params) {
    // ... existing fields ...
    this.transactions = [];      // NEW
    this.rejectedOrders = [];   // NEW
  }

  recordTransaction(type, date, price, shares, value, lotsCost, realizedPNL) {
    this.transactions.push({
      date,
      type,
      price,
      shares,
      value,
      lotsCost,
      realizedPNL
    });
  }

  recordRejectedOrder(date, price, attemptedValue, availableCapital, shortfall) {
    this.rejectedOrders.push({
      date,
      price,
      attemptedValue,
      availableCapital,
      shortfall
    });
  }
}
```

## URL Structure

### Portfolio Main Page
```
/portfolio-backtest?stocks=AAPL,TSLA&capital=100000&...
```

### Stock Detail Page
```
/portfolio-backtest/stock/:symbol?run=<runId>&startDate=2024-01-01&endDate=2024-12-31&capital=100000&...
```

## Routing Configuration

```javascript
// In App.js
<Routes>
  <Route path="/portfolio-backtest" element={<PortfolioBacktestPage />} />
  <Route path="/portfolio-backtest/stock/:symbol" element={<StockDetailPage />} />
</Routes>
```

## Performance Optimizations

1. **Lazy Loading**: Load stock detail data only when needed
2. **Data Decimation**: For long time periods (> 365 days), decimate price data for chart rendering
3. **Virtualization**: Use react-window for large transaction tables
4. **Memoization**: Memoize expensive calculations (normalized prices, markers)
5. **SessionStorage**: Cache portfolio results to avoid re-computation on navigation

## Accessibility

- All charts have ARIA labels
- Color is not the only differentiator (use patterns/shapes)
- Keyboard navigation for interactive elements
- Screen reader announcements for chart interactions

## Testing Strategy

1. **Unit Tests**: Individual chart components with mock data
2. **Integration Tests**: Full portfolio page with realistic data
3. **Visual Regression Tests**: Ensure charts render consistently
4. **Performance Tests**: Measure render time with max data (20 stocks × 365 days)
5. **Accessibility Tests**: WCAG 2.1 AA compliance

## Error Handling

- Missing cached data: Show message + link to re-run backtest
- Invalid portfolio run ID: Redirect to portfolio main page
- Chart render errors: Show error boundary with fallback UI
- No transaction markers visible: Show informational message
