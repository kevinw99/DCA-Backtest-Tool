# Design: Portfolio Daily Trades View

## Architecture Overview

This feature adds a new component `DailyTradesView` to the portfolio results display. It aggregates all stock transactions by date and displays them in a chronological, expandable table format with cash position tracking.

## Component Structure

```
PortfolioResults (existing)
├── PortfolioSummaryCard
├── Charts Section
├── CurrentHoldings Section
├── StockPerformanceTable (existing - organized by stock)
├── DailyTradesView (NEW - organized by date)    <-- New component
│   ├── DailyTradesSummaryRow (collapsed state)
│   └── DailyTradesDetailView (expanded state)
└── RejectedOrdersTable
```

## Data Flow

### Input Data
- Source: `PortfolioResults` receives `data.stockResults` array
- Each stock has: `{ symbol, transactions: [...], ... }`
- Transaction structure:
  ```javascript
  {
    date: "2024-08-05",
    type: "BUY" | "SELL" | "TRAILING_STOP_BUY" | etc.,
    price: 24.09,
    shares: 415.28,
    value: 10000.00,
    realizedPNLFromTrade: 1500.00,  // for sells
    lotsCost: 8500.00,               // for sells
    lotsDetails: [...]               // for sells
  }
  ```

### Data Aggregation Logic

**Step 1: Flatten and Merge Transactions**
```javascript
const allTransactions = stockResults.flatMap(stock =>
  stock.transactions
    .filter(tx => !tx.type.includes('ABORTED'))  // Exclude aborted transactions
    .map(tx => ({
      ...tx,
      symbol: stock.symbol
    }))
);
```

**Step 2: Group by Date**
```javascript
const transactionsByDate = new Map();

allTransactions.forEach(tx => {
  if (!transactionsByDate.has(tx.date)) {
    transactionsByDate.set(tx.date, []);
  }
  transactionsByDate.get(tx.date).push(tx);
});
```

**Step 3: Calculate Daily Metrics**
```javascript
const dailyTrades = Array.from(transactionsByDate.entries()).map(([date, transactions]) => {
  const buys = transactions.filter(tx => tx.type.includes('BUY'));
  const sells = transactions.filter(tx => tx.type.includes('SELL'));

  const totalBuyAmount = buys.reduce((sum, tx) => sum + tx.value, 0);
  const totalSellAmount = sells.reduce((sum, tx) => sum + tx.value, 0);
  const netCashFlow = totalSellAmount - totalBuyAmount;
  const dailyRealizedPNL = sells.reduce((sum, tx) => sum + (tx.realizedPNLFromTrade || 0), 0);

  return {
    date,
    transactions,
    tradeCount: transactions.length,
    buyCount: buys.length,
    sellCount: sells.length,
    totalBuyAmount,
    totalSellAmount,
    netCashFlow,
    dailyRealizedPNL
  };
});

// Sort chronologically
dailyTrades.sort((a, b) => a.date.localeCompare(b.date));
```

**Step 4: Calculate Running Cash Balance**
```javascript
let runningCash = portfolioSummary.totalCapital;  // Starting capital

dailyTrades.forEach(day => {
  day.cashBefore = runningCash;
  day.cashAfter = runningCash + day.netCashFlow;
  day.cashChange = day.netCashFlow;
  runningCash = day.cashAfter;
});
```

## Component Design

### DailyTradesView Component

**Props:**
```javascript
{
  stockResults: Array,        // All stock results with transactions
  portfolioSummary: Object,   // For initial capital
  portfolioRunId: String,     // For linking to individual stock details
  parameters: Object          // Portfolio parameters
}
```

**State:**
```javascript
{
  expandedDate: String | null,  // Currently expanded date (YYYY-MM-DD)
  sortOrder: 'asc' | 'desc',    // Date sort order
  filterStocks: Array,           // Selected stock symbols (empty = all)
  filterType: 'all' | 'buys' | 'sells'  // Transaction type filter
}
```

**UI Structure:**
```jsx
<section className="daily-trades-section">
  <div className="section-header">
    <h3>📅 Daily Trading Activity</h3>
    <p className="section-description">
      View all trades aggregated by date with cash position tracking
    </p>
  </div>

  <div className="daily-trades-controls">
    <SortOrderToggle />
    <FilterByStockDropdown />
    <FilterByTypeToggle />
  </div>

  <div className="daily-trades-table">
    <table>
      <thead>
        <tr>
          <th>Expand</th>
          <th>Date</th>
          <th>Trades</th>
          <th>Buys</th>
          <th>Sells</th>
          <th>Net Cash Flow</th>
          <th>Daily P&L</th>
          <th>Cash Before</th>
          <th>Cash After</th>
        </tr>
      </thead>
      <tbody>
        {dailyTrades.map(day => (
          <DailyTradeRow
            key={day.date}
            day={day}
            isExpanded={expandedDate === day.date}
            onToggle={handleToggleExpand}
          />
        ))}
      </tbody>
    </table>
  </div>
</section>
```

### DailyTradeRow Component

**Summary Row (Always Visible):**
```jsx
<tr
  className={`daily-trade-row ${isExpanded ? 'expanded' : ''}`}
  onClick={() => onToggle(day.date)}
>
  <td className="expand-icon">
    {isExpanded ? <ChevronDown /> : <ChevronRight />}
  </td>
  <td className="date">{formatDate(day.date)}</td>
  <td>{day.tradeCount}</td>
  <td>{day.buyCount}</td>
  <td>{day.sellCount}</td>
  <td className={day.netCashFlow >= 0 ? 'positive' : 'negative'}>
    {formatCurrency(day.netCashFlow)}
  </td>
  <td className={day.dailyRealizedPNL >= 0 ? 'positive' : 'negative'}>
    {formatCurrency(day.dailyRealizedPNL)}
  </td>
  <td>{formatCurrency(day.cashBefore)}</td>
  <td className="cash-after">{formatCurrency(day.cashAfter)}</td>
</tr>
```

**Expanded Detail View:**
```jsx
{isExpanded && (
  <tr className="daily-trade-detail-row">
    <td colSpan="9">
      <div className="daily-trade-details">
        <h4>Transactions on {formatDate(day.date)}</h4>
        <table className="transaction-detail-table">
          <thead>
            <tr>
              <th>Stock</th>
              <th>Type</th>
              <th>Price</th>
              <th>Quantity</th>
              <th>Value</th>
              <th>P&L</th>
            </tr>
          </thead>
          <tbody>
            {day.transactions.map((tx, idx) => (
              <tr key={idx}>
                <td className="stock-symbol">{tx.symbol}</td>
                <td className={tx.type.includes('BUY') ? 'buy-type' : 'sell-type'}>
                  {tx.type}
                </td>
                <td>${tx.price.toFixed(2)}</td>
                <td>{tx.shares.toFixed(2)}</td>
                <td>{formatCurrency(tx.value)}</td>
                <td className={tx.realizedPNLFromTrade >= 0 ? 'positive' : 'negative'}>
                  {tx.type.includes('SELL')
                    ? formatCurrency(tx.realizedPNLFromTrade)
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </td>
  </tr>
)}
```

## Styling Design

### CSS Classes and Styling

**Layout:**
```css
.daily-trades-section {
  margin-top: 30px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.daily-trades-controls {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
  align-items: center;
}

.daily-trades-table {
  overflow-x: auto;
}

.daily-trades-table table {
  width: 100%;
  border-collapse: collapse;
}

.daily-trades-table th {
  background: #f5f5f5;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #ddd;
}

.daily-trade-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.daily-trade-row:hover {
  background-color: #f9f9f9;
}

.daily-trade-row.expanded {
  background-color: #e8f4f8;
}

.daily-trade-row td {
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
}
```

**Color Coding:**
```css
.positive {
  color: #10b981;
  font-weight: 500;
}

.negative {
  color: #ef4444;
  font-weight: 500;
}

.cash-after {
  font-weight: 600;
  font-size: 0.95em;
  background-color: #fafafa;
}

.buy-type {
  color: #3b82f6;
  font-weight: 500;
}

.sell-type {
  color: #f59e0b;
  font-weight: 500;
}
```

**Responsive Design:**
```css
@media (max-width: 768px) {
  .daily-trades-table th:nth-child(n+6) {
    display: none;
  }

  .daily-trades-table td:nth-child(n+6) {
    display: none;
  }

  .daily-trade-detail-row td {
    padding: 5px;
  }

  .transaction-detail-table {
    font-size: 0.85em;
  }
}
```

## Edge Cases and Error Handling

### 1. No Trades
```jsx
{dailyTrades.length === 0 && (
  <div className="empty-state">
    <p>No trades executed during the backtest period</p>
  </div>
)}
```

### 2. Missing Data
- Handle missing `realizedPNLFromTrade` → default to 0
- Handle missing `value` → calculate from price × shares
- Handle missing `shares` → show 'N/A'

### 3. Large Datasets
- Virtualize table if > 100 rows (use `react-window` or similar)
- Lazy load expanded details
- Consider pagination if > 500 trading days

### 4. Floating Point Precision
- Use `.toFixed(2)` for currency display
- Sum cash flows carefully to avoid accumulated rounding errors

## Integration Steps

### 1. Create Component File
**File:** `frontend/src/components/DailyTradesView.js`
- Implement data aggregation logic
- Implement expandable table UI
- Add sorting and filtering controls

### 2. Create CSS File
**File:** `frontend/src/components/DailyTradesView.css`
- Style table layout
- Add color coding
- Implement responsive design

### 3. Update PortfolioResults
**File:** `frontend/src/components/PortfolioResults.js`
```jsx
import DailyTradesView from './DailyTradesView';

// In render:
<section className="daily-trades-wrapper">
  <DailyTradesView
    stockResults={stockResults}
    portfolioSummary={portfolioSummary}
    portfolioRunId={portfolioRunId}
    parameters={parameters}
  />
</section>
```

### 4. Position in UI
**Option A: Separate Section**
- Place after Stock Performance Breakdown
- Always visible, user scrolls to see it

**Option B: Tabbed Interface**
- Add tabs: "By Stock" | "By Date"
- Switch between StockPerformanceTable and DailyTradesView

**Recommendation:** Use Option A (separate section) for simplicity and discoverability.

## Performance Considerations

### Optimization Strategies

1. **Memoization:**
```javascript
const aggregatedData = useMemo(() => {
  return aggregateTransactionsByDate(stockResults, portfolioSummary);
}, [stockResults, portfolioSummary]);
```

2. **Virtualization:**
```javascript
import { FixedSizeList } from 'react-window';

// Use for lists > 100 items
```

3. **Lazy Expansion:**
- Don't render expanded details until user clicks
- Unmount expanded details when collapsed

4. **Debounced Filtering:**
```javascript
const debouncedFilter = useMemo(
  () => debounce(handleFilterChange, 300),
  []
);
```

## Testing Strategy

### Unit Tests

**Test Data Aggregation:**
```javascript
describe('aggregateTransactionsByDate', () => {
  it('groups transactions by date correctly', () => {
    const stockResults = [...];
    const result = aggregateTransactionsByDate(stockResults);
    expect(result[0].date).toBe('2024-01-05');
    expect(result[0].tradeCount).toBe(3);
  });

  it('calculates cash flow correctly', () => {
    const stockResults = [...];
    const result = aggregateTransactionsByDate(stockResults);
    expect(result[0].netCashFlow).toBe(-5000);  // 3 buys, 2 sells
  });
});
```

**Test Component Rendering:**
```javascript
describe('DailyTradesView', () => {
  it('renders all trading days', () => {
    const { getAllByRole } = render(<DailyTradesView {...props} />);
    const rows = getAllByRole('row');
    expect(rows).toHaveLength(52);  // 52 trading days
  });

  it('expands details on click', () => {
    const { getByText, queryByText } = render(<DailyTradesView {...props} />);
    expect(queryByText('AAPL')).not.toBeInTheDocument();
    fireEvent.click(getByText('2024-01-05'));
    expect(queryByText('AAPL')).toBeInTheDocument();
  });
});
```

### Integration Tests

**Test with Real Portfolio Data:**
- Load actual portfolio backtest result
- Verify all trades are displayed
- Verify cash calculations match expected values
- Verify sorting and filtering work correctly

### Manual Testing

**Scenarios:**
1. Small portfolio (3 stocks, 10 trades)
2. Medium portfolio (10 stocks, 100 trades)
3. Large portfolio (50 stocks, 1000+ trades)
4. Portfolio with no trades
5. Portfolio with only buys
6. Portfolio with only sells

## Accessibility

### ARIA Labels
```jsx
<button aria-label={`Expand trades for ${day.date}`}>
  <ChevronRight />
</button>

<table role="table" aria-label="Daily trading activity">
  <thead>
    <tr role="row">
      <th role="columnheader">Date</th>
      ...
    </tr>
  </thead>
</table>
```

### Keyboard Navigation
- Tab through rows
- Enter/Space to expand/collapse
- Arrow keys to navigate between rows

### Screen Reader Support
- Announce row count: "Showing 52 trading days"
- Announce expanded state: "Row expanded" / "Row collapsed"
- Read cash values with proper formatting

## Future Enhancements (Out of Scope)

1. **Export to CSV:** Download daily trades as spreadsheet
2. **Advanced Filtering:** Date range picker, multiple stock selection
3. **Daily Charts:** Visualize cash flow over time
4. **Comparison Mode:** Compare different portfolio runs side-by-side
5. **Summary Statistics:** Average daily volume, most active days, etc.
6. **Backend Aggregation:** Move aggregation logic to backend for very large portfolios

## Dependencies

**NPM Packages (Already Installed):**
- `react` (existing)
- `lucide-react` (existing, for icons)

**Optional Packages (If Needed):**
- `react-window` (for virtualization if performance issues)
- `date-fns` (for advanced date formatting if needed)

## Timeline Estimate

- **Component Implementation:** 4-6 hours
- **Styling and Responsive Design:** 2-3 hours
- **Testing and Bug Fixes:** 2-3 hours
- **Documentation:** 1 hour
- **Total:** ~10-13 hours

## Risk Assessment

**Low Risk:**
- Using existing data structures
- No backend changes required
- Similar to existing StockPerformanceTable component

**Potential Issues:**
- Performance with very large portfolios (mitigated by virtualization)
- Cash calculation accuracy (mitigated by careful testing)
- UI complexity (mitigated by progressive disclosure with expand/collapse)
