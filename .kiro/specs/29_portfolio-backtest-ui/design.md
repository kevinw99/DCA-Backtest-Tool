# Portfolio Backtest UI - Technical Design

## Architecture Overview

The Portfolio Backtest UI follows the existing application architecture:
- **React** for component-based UI
- **React Router** for navigation and routing
- **Recharts** for data visualization
- **localStorage** for state persistence
- **Fetch API** for backend communication

### Component Hierarchy

```
App.js
├── Route: /portfolio-backtest
│   └── PortfolioBacktestPage (new)
│       ├── PortfolioBacktestForm (new)
│       │   ├── StockSelector (new)
│       │   ├── CapitalSettings (new)
│       │   └── DCAParametersSection (reuse/adapt)
│       └── PortfolioResults (new)
│           ├── PortfolioSummaryCard (new)
│           ├── StockPerformanceTable (new)
│           │   └── StockDetailRow (expandable) (new)
│           ├── CapitalUtilizationChart (new)
│           ├── PortfolioValueChart (new)
│           └── RejectedOrdersTable (new)
```

## Component Specifications

### 1. PortfolioBacktestPage

**Purpose**: Top-level container for portfolio backtest feature with tab-based navigation.

**Location**: `frontend/src/components/PortfolioBacktestPage.js`

**State Management**:
```javascript
const [parameters, setParameters] = useState({
  totalCapital: 500000,
  lotSizeUsd: 10000,
  maxLotsPerStock: 10,
  startDate: '2024-01-01',
  endDate: new Date().toISOString().split('T')[0],
  stocks: ['TSLA', 'AAPL', 'NVDA', 'MSFT'],
  defaultParams: {
    gridIntervalPercent: 0.10,
    profitRequirement: 0.10,
    stopLossPercent: 0.30,
    enableTrailingBuy: false,
    enableTrailingSell: false
  }
});

const [results, setResults] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const [activeTab, setActiveTab] = useState('parameters'); // 'parameters' | 'results'
```

**API Integration**:
```javascript
const runBacktest = async (params) => {
  setLoading(true);
  setError(null);

  try {
    const response = await fetch('http://localhost:3001/api/portfolio-backtest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalCapital: params.totalCapital,
        startDate: params.startDate,
        endDate: params.endDate,
        lotSizeUsd: params.lotSizeUsd,
        maxLotsPerStock: params.maxLotsPerStock,
        defaultParams: params.defaultParams,
        stocks: params.stocks.map(symbol => ({ symbol }))
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Backtest failed');
    }

    setResults(data.data);
    setActiveTab('results');
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

**URL Parameter Support**:
```javascript
// Parse URL parameters on mount
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.has('stocks')) {
    const stocks = urlParams.get('stocks').split(',');
    const totalCapital = parseFloat(urlParams.get('totalCapital')) || 500000;
    const lotSizeUsd = parseFloat(urlParams.get('lotSize')) || 10000;
    const maxLotsPerStock = parseInt(urlParams.get('maxLots')) || 10;
    const startDate = urlParams.get('startDate') || '2024-01-01';
    const endDate = urlParams.get('endDate') || new Date().toISOString().split('T')[0];

    setParameters(prev => ({
      ...prev,
      stocks,
      totalCapital,
      lotSizeUsd,
      maxLotsPerStock,
      startDate,
      endDate
    }));

    // Auto-run if run=true
    if (urlParams.get('run') === 'true') {
      runBacktest({
        stocks,
        totalCapital,
        lotSizeUsd,
        maxLotsPerStock,
        startDate,
        endDate,
        defaultParams: parameters.defaultParams
      });
    }
  }
}, []);

// Update URL when parameters change
useEffect(() => {
  const params = new URLSearchParams();
  params.set('stocks', parameters.stocks.join(','));
  params.set('totalCapital', parameters.totalCapital);
  params.set('lotSize', parameters.lotSizeUsd);
  params.set('maxLots', parameters.maxLotsPerStock);
  params.set('startDate', parameters.startDate);
  params.set('endDate', parameters.endDate);

  window.history.replaceState({}, '', `?${params.toString()}`);
}, [parameters]);
```

**Persistence**:
```javascript
// Save to localStorage on change
useEffect(() => {
  localStorage.setItem('portfolio-backtest-params', JSON.stringify(parameters));
}, [parameters]);

// Load from localStorage on mount
useEffect(() => {
  const saved = localStorage.getItem('portfolio-backtest-params');
  if (saved) {
    setParameters(JSON.parse(saved));
  }
}, []);
```

---

### 2. PortfolioBacktestForm

**Purpose**: Input form for configuring portfolio backtest parameters.

**Location**: `frontend/src/components/PortfolioBacktestForm.js`

**Props**:
```typescript
interface PortfolioBacktestFormProps {
  parameters: PortfolioParameters;
  onParametersChange: (parameters: PortfolioParameters) => void;
  onSubmit: () => void;
  loading: boolean;
}
```

**Layout Structure**:
```jsx
<form className="portfolio-backtest-form">
  <section className="capital-settings">
    <h3>💰 Capital Settings</h3>
    <div className="input-group">
      <label>Total Capital ($)</label>
      <input type="number" value={totalCapital} onChange={...} />
    </div>
    <div className="input-group">
      <label>Lot Size ($)</label>
      <input type="number" value={lotSizeUsd} onChange={...} />
    </div>
    <div className="input-group">
      <label>Max Lots Per Stock</label>
      <input type="number" value={maxLotsPerStock} onChange={...} />
    </div>
  </section>

  <section className="stock-selection">
    <h3>📈 Stock Selection</h3>
    <StockSelector
      selectedStocks={stocks}
      onChange={handleStocksChange}
    />
  </section>

  <section className="date-range">
    <h3>📅 Date Range</h3>
    <div className="input-group">
      <label>Start Date</label>
      <input type="date" value={startDate} onChange={...} />
    </div>
    <div className="input-group">
      <label>End Date</label>
      <input type="date" value={endDate} onChange={...} />
    </div>
  </section>

  <section className="dca-parameters">
    <h3>⚙️ Default DCA Parameters</h3>
    <div className="input-group">
      <label>Grid Interval (%)</label>
      <input type="number" step="0.01" value={gridIntervalPercent * 100} onChange={...} />
    </div>
    <div className="input-group">
      <label>Profit Requirement (%)</label>
      <input type="number" step="0.01" value={profitRequirement * 100} onChange={...} />
    </div>
    <div className="input-group">
      <label>Stop Loss (%)</label>
      <input type="number" step="0.01" value={stopLossPercent * 100} onChange={...} />
    </div>
    <div className="checkbox-group">
      <label>
        <input type="checkbox" checked={enableTrailingBuy} onChange={...} />
        Enable Trailing Buy
      </label>
    </div>
    <div className="checkbox-group">
      <label>
        <input type="checkbox" checked={enableTrailingSell} onChange={...} />
        Enable Trailing Sell
      </label>
    </div>
  </section>

  <div className="form-actions">
    <button type="button" onClick={handleReset}>Reset to Defaults</button>
    <button type="submit" onClick={onSubmit} disabled={loading}>
      {loading ? 'Running...' : 'Run Backtest'}
    </button>
  </div>
</form>
```

**Validation Logic**:
```javascript
const validateParameters = (params) => {
  const errors = [];

  if (params.totalCapital <= 0) {
    errors.push('Total capital must be positive');
  }

  if (params.lotSizeUsd <= 0) {
    errors.push('Lot size must be positive');
  }

  if (params.maxLotsPerStock <= 0) {
    errors.push('Max lots per stock must be positive');
  }

  if (params.stocks.length === 0) {
    errors.push('At least one stock must be selected');
  }

  if (params.stocks.length > 20) {
    errors.push('Maximum 20 stocks allowed');
  }

  if (new Date(params.startDate) >= new Date(params.endDate)) {
    errors.push('Start date must be before end date');
  }

  if (params.defaultParams.gridIntervalPercent <= 0 || params.defaultParams.gridIntervalPercent > 1) {
    errors.push('Grid interval must be between 0 and 100%');
  }

  if (params.defaultParams.profitRequirement <= 0 || params.defaultParams.profitRequirement > 1) {
    errors.push('Profit requirement must be between 0 and 100%');
  }

  return errors;
};
```

---

### 3. StockSelector

**Purpose**: Multi-select component for choosing stock symbols.

**Location**: `frontend/src/components/StockSelector.js`

**Props**:
```typescript
interface StockSelectorProps {
  selectedStocks: string[];
  onChange: (stocks: string[]) => void;
}
```

**Component Structure**:
```jsx
const StockSelector = ({ selectedStocks, onChange }) => {
  const [availableStocks, setAvailableStocks] = useState([
    'TSLA', 'AAPL', 'NVDA', 'MSFT', 'AMZN', 'META', 'GOOGL'
  ]);
  const [customSymbol, setCustomSymbol] = useState('');

  const handleToggle = (symbol) => {
    if (selectedStocks.includes(symbol)) {
      onChange(selectedStocks.filter(s => s !== symbol));
    } else {
      onChange([...selectedStocks, symbol]);
    }
  };

  const handleAddCustom = () => {
    const symbol = customSymbol.trim().toUpperCase();
    if (symbol && !availableStocks.includes(symbol)) {
      setAvailableStocks([...availableStocks, symbol].sort());
      onChange([...selectedStocks, symbol]);
      setCustomSymbol('');
    }
  };

  return (
    <div className="stock-selector">
      <div className="stock-chips">
        {availableStocks.map(symbol => (
          <div
            key={symbol}
            className={`stock-chip ${selectedStocks.includes(symbol) ? 'selected' : ''}`}
            onClick={() => handleToggle(symbol)}
          >
            {symbol}
            {selectedStocks.includes(symbol) && ' ✓'}
          </div>
        ))}
      </div>

      <div className="custom-symbol">
        <input
          type="text"
          placeholder="Add custom symbol..."
          value={customSymbol}
          onChange={(e) => setCustomSymbol(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddCustom()}
        />
        <button onClick={handleAddCustom}>Add</button>
      </div>

      <div className="selected-count">
        {selectedStocks.length} stock{selectedStocks.length !== 1 ? 's' : ''} selected
      </div>
    </div>
  );
};
```

**Styling** (CSS):
```css
.stock-selector {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.stock-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.stock-chip {
  padding: 0.5rem 1rem;
  border: 2px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.stock-chip:hover {
  border-color: #007bff;
}

.stock-chip.selected {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.custom-symbol {
  display: flex;
  gap: 0.5rem;
}

.custom-symbol input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.custom-symbol button {
  padding: 0.5rem 1rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
```

---

### 4. PortfolioResults

**Purpose**: Display comprehensive portfolio backtest results with visualizations and drill-down capability.

**Location**: `frontend/src/components/PortfolioResults.js`

**Props**:
```typescript
interface PortfolioResultsProps {
  data: PortfolioBacktestResults;
}

interface PortfolioBacktestResults {
  portfolioSummary: PortfolioSummary;
  stockResults: StockResult[];
  capitalUtilizationTimeSeries: CapitalUtilization[];
  rejectedOrders: RejectedOrder[];
}
```

**Component Structure**:
```jsx
const PortfolioResults = ({ data }) => {
  const [expandedStock, setExpandedStock] = useState(null);
  const [rejectedOrdersFilter, setRejectedOrdersFilter] = useState('all');

  return (
    <div className="portfolio-results">
      <PortfolioSummaryCard summary={data.portfolioSummary} />

      <section className="charts-section">
        <div className="chart-container">
          <h3>Portfolio Value Over Time</h3>
          <PortfolioValueChart
            timeSeries={data.capitalUtilizationTimeSeries}
            summary={data.portfolioSummary}
          />
        </div>

        <div className="chart-container">
          <h3>Capital Utilization</h3>
          <CapitalUtilizationChart
            timeSeries={data.capitalUtilizationTimeSeries}
          />
        </div>
      </section>

      <section className="stock-performance-section">
        <h3>Stock Performance Breakdown</h3>
        <StockPerformanceTable
          stocks={data.stockResults}
          expandedStock={expandedStock}
          onToggleExpand={setExpandedStock}
        />
      </section>

      <section className="rejected-orders-section">
        <h3>Rejected Orders Analysis</h3>
        <RejectedOrdersTable
          orders={data.rejectedOrders}
          filter={rejectedOrdersFilter}
          onFilterChange={setRejectedOrdersFilter}
        />
      </section>
    </div>
  );
};
```

---

### 5. PortfolioSummaryCard

**Purpose**: Display high-level portfolio metrics in a card layout.

**Location**: `frontend/src/components/PortfolioSummaryCard.js`

**Component Structure**:
```jsx
const PortfolioSummaryCard = ({ summary }) => {
  return (
    <div className="portfolio-summary-card">
      <div className="summary-header">
        <h2>Portfolio Summary</h2>
        <div className="summary-badge">
          <span className={summary.totalReturnPercent >= 0 ? 'positive' : 'negative'}>
            {summary.totalReturnPercent >= 0 ? '▲' : '▼'}
            {Math.abs(summary.totalReturnPercent).toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="summary-grid">
        <MetricBox
          label="Total Capital"
          value={formatCurrency(summary.totalCapital)}
          icon="💰"
        />
        <MetricBox
          label="Final Portfolio Value"
          value={formatCurrency(summary.finalPortfolioValue)}
          icon="📊"
        />
        <MetricBox
          label="Total Return"
          value={formatCurrency(summary.totalReturn)}
          change={summary.totalReturnPercent}
          icon="💹"
        />
        <MetricBox
          label="CAGR"
          value={`${summary.cagr.toFixed(2)}%`}
          icon="📈"
        />
        <MetricBox
          label="Max Drawdown"
          value={formatCurrency(summary.maxDrawdown)}
          subValue={`${summary.maxDrawdownPercent.toFixed(2)}%`}
          icon="📉"
        />
        <MetricBox
          label="Sharpe Ratio"
          value={summary.sharpeRatio.toFixed(2)}
          icon="⚖️"
        />
        <MetricBox
          label="Total Trades"
          value={`${summary.totalBuys + summary.totalSells}`}
          subValue={`${summary.totalBuys} buys, ${summary.totalSells} sells`}
          icon="🔄"
        />
        <MetricBox
          label="Win Rate"
          value={`${summary.winRate.toFixed(1)}%`}
          icon="🎯"
        />
        <MetricBox
          label="Capital Utilization"
          value={`${summary.capitalUtilizationPercent.toFixed(1)}%`}
          subValue={`Avg: ${summary.avgCapitalUtilization?.toFixed(1) || 0}%`}
          icon="📊"
        />
        <MetricBox
          label="Rejected Buys"
          value={summary.rejectedBuys}
          subValue={formatCurrency(summary.rejectedBuysValue)}
          highlight={summary.rejectedBuys > 0}
          icon="⚠️"
        />
      </div>
    </div>
  );
};

const MetricBox = ({ label, value, subValue, change, icon, highlight }) => (
  <div className={`metric-box ${highlight ? 'highlight' : ''}`}>
    <div className="metric-icon">{icon}</div>
    <div className="metric-content">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {subValue && <div className="metric-subvalue">{subValue}</div>}
      {change !== undefined && (
        <div className={`metric-change ${change >= 0 ? 'positive' : 'negative'}`}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
        </div>
      )}
    </div>
  </div>
);
```

**Styling** (CSS):
```css
.portfolio-summary-card {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.metric-box {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
  border-left: 4px solid #007bff;
}

.metric-box.highlight {
  background: #fff3cd;
  border-left-color: #ffc107;
}

.metric-icon {
  font-size: 2rem;
}

.metric-content {
  flex: 1;
}

.metric-label {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.metric-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
}

.metric-subvalue {
  font-size: 0.875rem;
  color: #666;
  margin-top: 0.25rem;
}

.metric-change {
  font-size: 0.875rem;
  font-weight: 600;
  margin-top: 0.25rem;
}

.metric-change.positive {
  color: #28a745;
}

.metric-change.negative {
  color: #dc3545;
}
```

---

### 6. StockPerformanceTable

**Purpose**: Sortable table showing per-stock performance with expandable details.

**Location**: `frontend/src/components/StockPerformanceTable.js`

**Component Structure**:
```jsx
const StockPerformanceTable = ({ stocks, expandedStock, onToggleExpand }) => {
  const [sortField, setSortField] = useState('totalPNL');
  const [sortDirection, setSortDirection] = useState('desc');

  const sortedStocks = useMemo(() => {
    return [...stocks].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [stocks, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="stock-performance-table">
      <table>
        <thead>
          <tr>
            <th></th>
            <th onClick={() => handleSort('symbol')}>Symbol</th>
            <th onClick={() => handleSort('lotsHeld')}>Lots Held</th>
            <th onClick={() => handleSort('capitalDeployed')}>Capital Deployed</th>
            <th onClick={() => handleSort('marketValue')}>Market Value</th>
            <th onClick={() => handleSort('totalPNL')}>Total P&L</th>
            <th onClick={() => handleSort('stockReturnPercent')}>Return %</th>
            <th onClick={() => handleSort('cagr')}>CAGR</th>
            <th onClick={() => handleSort('contributionToPortfolioReturn')}>Contribution</th>
            <th onClick={() => handleSort('totalBuys')}>Buys</th>
            <th onClick={() => handleSort('totalSells')}>Sells</th>
            <th onClick={() => handleSort('rejectedBuys')}>Rejected</th>
          </tr>
        </thead>
        <tbody>
          {sortedStocks.map(stock => (
            <React.Fragment key={stock.symbol}>
              <tr
                className={`stock-row ${expandedStock === stock.symbol ? 'expanded' : ''}`}
                onClick={() => onToggleExpand(expandedStock === stock.symbol ? null : stock.symbol)}
              >
                <td>
                  {expandedStock === stock.symbol ? '▼' : '▶'}
                </td>
                <td className="stock-symbol">{stock.symbol}</td>
                <td>{stock.lotsHeld}</td>
                <td>{formatCurrency(stock.capitalDeployed)}</td>
                <td>{formatCurrency(stock.marketValue)}</td>
                <td className={stock.totalPNL >= 0 ? 'positive' : 'negative'}>
                  {formatCurrency(stock.totalPNL)}
                </td>
                <td className={stock.stockReturnPercent >= 0 ? 'positive' : 'negative'}>
                  {stock.stockReturnPercent.toFixed(2)}%
                </td>
                <td>{stock.cagr.toFixed(2)}%</td>
                <td>{stock.contributionToPortfolioReturn.toFixed(2)}%</td>
                <td>{stock.totalBuys}</td>
                <td>{stock.totalSells}</td>
                <td className={stock.rejectedBuys > 0 ? 'highlight' : ''}>
                  {stock.rejectedBuys}
                </td>
              </tr>

              {expandedStock === stock.symbol && (
                <tr className="stock-detail-row">
                  <td colSpan="12">
                    <StockDetailView stock={stock} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const StockDetailView = ({ stock }) => (
  <div className="stock-detail">
    <h4>{stock.symbol} - Transaction History</h4>
    <table className="transaction-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Price</th>
          <th>Quantity</th>
          <th>Amount</th>
          <th>P&L</th>
          <th>Lots After</th>
        </tr>
      </thead>
      <tbody>
        {stock.transactions?.map((tx, idx) => (
          <tr key={idx}>
            <td>{tx.date}</td>
            <td className={tx.type === 'BUY' ? 'buy' : 'sell'}>{tx.type}</td>
            <td>${tx.price.toFixed(2)}</td>
            <td>{tx.quantity?.toFixed(2)}</td>
            <td>{formatCurrency(tx.amount)}</td>
            <td className={tx.pnl >= 0 ? 'positive' : 'negative'}>
              {tx.pnl ? formatCurrency(tx.pnl) : '-'}
            </td>
            <td>{tx.lotsAfterTransaction?.length || 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
```

---

### 7. CapitalUtilizationChart

**Purpose**: Time series visualization of capital deployment and utilization.

**Location**: `frontend/src/components/CapitalUtilizationChart.js`

**Component Structure**:
```jsx
const CapitalUtilizationChart = ({ timeSeries }) => {
  const [visibleLines, setVisibleLines] = useState({
    deployedCapital: true,
    cashReserve: true,
    utilizationPercent: true
  });

  const toggleLine = (line) => {
    setVisibleLines(prev => ({ ...prev, [line]: !prev[line] }));
  };

  return (
    <div className="capital-utilization-chart">
      <div className="chart-legend">
        <label>
          <input
            type="checkbox"
            checked={visibleLines.deployedCapital}
            onChange={() => toggleLine('deployedCapital')}
          />
          Deployed Capital
        </label>
        <label>
          <input
            type="checkbox"
            checked={visibleLines.cashReserve}
            onChange={() => toggleLine('cashReserve')}
          />
          Cash Reserve
        </label>
        <label>
          <input
            type="checkbox"
            checked={visibleLines.utilizationPercent}
            onChange={() => toggleLine('utilizationPercent')}
          />
          Utilization %
        </label>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={timeSeries}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {visibleLines.deployedCapital && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="deployedCapital"
              stroke="#8884d8"
              name="Deployed Capital ($)"
            />
          )}

          {visibleLines.cashReserve && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="cashReserve"
              stroke="#82ca9d"
              name="Cash Reserve ($)"
            />
          )}

          {visibleLines.utilizationPercent && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="utilizationPercent"
              stroke="#ffc658"
              name="Utilization (%)"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;

  return (
    <div className="custom-tooltip">
      <p className="label">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} style={{ color: entry.color }}>
          {entry.name}: {entry.value.toFixed(2)}
        </p>
      ))}
    </div>
  );
};
```

---

### 8. RejectedOrdersTable

**Purpose**: Display and analyze rejected buy orders due to capital constraints.

**Location**: `frontend/src/components/RejectedOrdersTable.js`

**Component Structure**:
```jsx
const RejectedOrdersTable = ({ orders, filter, onFilterChange }) => {
  const symbols = useMemo(() => {
    return ['all', ...new Set(orders.map(o => o.symbol))];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return filter === 'all'
      ? orders
      : orders.filter(o => o.symbol === filter);
  }, [orders, filter]);

  const totalRejectedValue = filteredOrders.reduce((sum, o) => sum + o.lotSize, 0);

  return (
    <div className="rejected-orders-table">
      <div className="rejected-orders-header">
        <div className="summary">
          <span className="count">{filteredOrders.length} rejected orders</span>
          <span className="value">Total value: {formatCurrency(totalRejectedValue)}</span>
        </div>

        <select value={filter} onChange={(e) => onFilterChange(e.target.value)}>
          {symbols.map(symbol => (
            <option key={symbol} value={symbol}>
              {symbol === 'all' ? 'All Stocks' : symbol}
            </option>
          ))}
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Symbol</th>
            <th>Price</th>
            <th>Lot Size</th>
            <th>Available Capital</th>
            <th>Shortfall</th>
            <th>Utilization</th>
          </tr>
        </thead>
        <tbody>
          {filteredOrders.map((order, idx) => (
            <tr key={idx}>
              <td>{order.date}</td>
              <td className="stock-symbol">{order.symbol}</td>
              <td>${order.price.toFixed(2)}</td>
              <td>{formatCurrency(order.lotSize)}</td>
              <td>{formatCurrency(order.availableCapital)}</td>
              <td className="shortfall">{formatCurrency(order.shortfall)}</td>
              <td>{order.portfolioState.utilizationPercent.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {filteredOrders.length === 0 && (
        <div className="empty-state">
          <p>✅ No rejected orders{filter !== 'all' ? ` for ${filter}` : ''}</p>
          <p className="help-text">All buy signals were executed successfully!</p>
        </div>
      )}
    </div>
  );
};
```

---

## Data Flow

### 1. Initial Load
```
User navigates to /portfolio-backtest
  ↓
PortfolioBacktestPage mounts
  ↓
Check URL parameters → Parse if present
  ↓
Check localStorage → Load saved params if no URL params
  ↓
Initialize form with parameters
  ↓
If URL has run=true → Auto-execute backtest
```

### 2. User Input Flow
```
User changes form field
  ↓
onChange handler updates state
  ↓
State change triggers useEffect
  ↓
Save to localStorage
  ↓
Update URL parameters (without run=true)
```

### 3. Backtest Execution Flow
```
User clicks "Run Backtest"
  ↓
Validate parameters
  ↓
If invalid → Show error messages
  ↓
If valid → setLoading(true)
  ↓
POST to /api/portfolio-backtest
  ↓
Wait for response
  ↓
Parse response data
  ↓
setResults(data)
  ↓
setLoading(false)
  ↓
Switch to results tab
  ↓
URL updated with run=true
```

### 4. Results Interaction Flow
```
User views results
  ↓
Can click stock row → Expand details
  ↓
Can filter rejected orders → Re-render table
  ↓
Can hover chart → Show tooltip
  ↓
Can click export → Generate CSV/JSON download
```

---

## Routing Integration

### App.js Route Addition
```jsx
import PortfolioBacktestPage from './components/PortfolioBacktestPage';

<Routes>
  {/* Existing routes */}
  <Route path="/" element={<AppContent />} />

  {/* New portfolio backtest route */}
  <Route path="/portfolio-backtest" element={<PortfolioBacktestPage />} />
</Routes>
```

### Navigation Menu Update
```jsx
<nav className="app-nav">
  <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
    Single Stock Backtest
  </Link>
  <Link to="/portfolio-backtest" className={location.pathname === '/portfolio-backtest' ? 'active' : ''}>
    Portfolio Backtest
  </Link>
</nav>
```

---

## State Management Strategy

### Local Component State
Use `useState` for:
- Form input values
- Loading states
- Error messages
- UI state (expanded rows, visible chart lines)

### URL State
Encode in URL query parameters:
- Portfolio configuration (stocks, capital, dates)
- Auto-run flag
- Results view flag

### localStorage State
Persist to localStorage:
- Last used portfolio configuration
- User preferences (collapsed sections, chart settings)
- Available symbols list

### Prop Drilling
Pass down via props:
- Results data (read-only, no need for context)
- Callback handlers (onChange, onSubmit)

**No Redux/Context needed** - Component tree is shallow enough for prop drilling.

---

## Error Handling

### Form Validation Errors
```jsx
const [validationErrors, setValidationErrors] = useState([]);

const validateForm = () => {
  const errors = [];

  if (parameters.totalCapital <= 0) {
    errors.push({ field: 'totalCapital', message: 'Must be positive' });
  }

  if (parameters.stocks.length === 0) {
    errors.push({ field: 'stocks', message: 'Select at least one stock' });
  }

  setValidationErrors(errors);
  return errors.length === 0;
};

// Display errors
{validationErrors.map(err => (
  <div key={err.field} className="error-message">
    {err.field}: {err.message}
  </div>
))}
```

### API Errors
```jsx
const [apiError, setApiError] = useState(null);

try {
  const response = await fetch('/api/portfolio-backtest', {...});
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Backtest failed');
  }
} catch (err) {
  setApiError(err.message);
}

// Display error
{apiError && (
  <div className="api-error">
    <AlertTriangle />
    {apiError}
    <button onClick={() => setApiError(null)}>Dismiss</button>
  </div>
)}
```

### Stock Not Found Errors
```jsx
// Backend returns: "Stock GOOGL not found in database"
// Extract stock symbol and suggest alternatives

if (error.includes('not found in database')) {
  const symbol = error.match(/Stock (\w+) not found/)?.[1];
  return (
    <div className="error-message">
      <p>{error}</p>
      <p className="help-text">
        Tip: Available stocks include TSLA, AAPL, NVDA, MSFT.
        <button onClick={() => removeStock(symbol)}>Remove {symbol}</button>
      </p>
    </div>
  );
}
```

---

## Performance Optimizations

### 1. Memo Heavy Components
```jsx
const StockPerformanceTable = React.memo(({ stocks, ... }) => {
  // Only re-render if stocks data changes
});
```

### 2. useMemo for Expensive Calculations
```jsx
const sortedStocks = useMemo(() => {
  return [...stocks].sort((a, b) => b.totalPNL - a.totalPNL);
}, [stocks, sortField, sortDirection]);
```

### 3. Virtualization for Large Tables
```jsx
import { FixedSizeList } from 'react-window';

// If transactions > 1000, use virtualized list
{transactions.length > 1000 ? (
  <FixedSizeList
    height={400}
    itemCount={transactions.length}
    itemSize={40}
  >
    {TransactionRow}
  </FixedSizeList>
) : (
  <table>...</table>
)}
```

### 4. Debounce Form Inputs
```jsx
const debouncedSave = useMemo(
  () => debounce((params) => {
    localStorage.setItem('portfolio-params', JSON.stringify(params));
  }, 500),
  []
);

useEffect(() => {
  debouncedSave(parameters);
}, [parameters]);
```

---

## Testing Strategy

### Unit Tests
- Form validation logic
- Data transformation functions
- Sorting and filtering logic

### Component Tests
- Form inputs update state correctly
- Stock selector adds/removes stocks
- Table sorting works
- Chart renders with data

### Integration Tests
- Full backtest flow (form → API → results)
- URL parameter parsing
- localStorage persistence

### E2E Tests
- User can complete full backtest workflow
- Results display correctly
- Export functionality works

---

## Accessibility Considerations

1. **Keyboard Navigation**: All interactive elements accessible via Tab
2. **Screen Reader Labels**: aria-label on icon buttons
3. **Focus Indicators**: Visible focus rings on all inputs
4. **Error Announcements**: aria-live regions for validation errors
5. **Table Headers**: Proper th/td structure with scope attributes
6. **Color Contrast**: WCAG AA compliant (4.5:1 minimum)

---

## Mobile Responsiveness

### Breakpoints
```css
/* Desktop (default) */
@media (min-width: 1024px) {
  .summary-grid { grid-template-columns: repeat(5, 1fr); }
}

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) {
  .summary-grid { grid-template-columns: repeat(3, 1fr); }
}

/* Mobile */
@media (max-width: 767px) {
  .summary-grid { grid-template-columns: 1fr; }
  .stock-performance-table { overflow-x: auto; }
}
```

---

## File Structure

```
frontend/src/
├── components/
│   ├── PortfolioBacktestPage.js        (new)
│   ├── PortfolioBacktestForm.js        (new)
│   ├── StockSelector.js                (new)
│   ├── PortfolioResults.js             (new)
│   ├── PortfolioSummaryCard.js         (new)
│   ├── StockPerformanceTable.js        (new)
│   ├── CapitalUtilizationChart.js      (new)
│   ├── PortfolioValueChart.js          (new)
│   └── RejectedOrdersTable.js          (new)
├── utils/
│   └── portfolioHelpers.js             (new)
├── styles/
│   └── PortfolioBacktest.css           (new)
└── App.js                              (modified - add route)
```

---

## Dependencies

### Existing (No new installs needed)
- react (18.x)
- react-router-dom (6.x)
- recharts (2.x)
- lucide-react (icons)

### Styling
Use existing CSS approach (no new CSS framework needed)
