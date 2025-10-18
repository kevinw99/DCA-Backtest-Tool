# Design: Stock Performance Buy & Hold Comparison Columns

## Architecture Overview

This feature enhances the Stock Performance Breakdown table by adding Buy & Hold (B&H) comparison columns. The implementation involves:

1. **Backend**: Merge per-stock B&H data into `stockResults` array
2. **Frontend**: Add new columns to Stock Performance Table component
3. **Data Flow**: Ensure B&H data flows from calculation service → metrics service → API → frontend

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Portfolio Backtest Flow                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  portfolioBacktestService.js                                    │
│  - Executes DCA strategy for all stocks                         │
│  - Calls calculatePortfolioBuyAndHold()  ◄─── NEW              │
│  - Calls calculatePortfolioMetrics()                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  portfolioBuyAndHoldService.js (EXISTING)                       │
│  - Calculates B&H for each stock                                │
│  - Returns: stockComparisons[] with buyAndHoldReturn,           │
│    buyAndHoldReturnPercent, outperformance, etc.                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  portfolioMetricsService.js (MODIFIED)                          │
│  - Merges B&H data into stockResults[]  ◄─── NEW               │
│  - Adds: bhTotalPNL, bhReturnPercent, pnlDiff, returnDiff      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  API Response (server.js)                                       │
│  {                                                               │
│    stockResults: [                                               │
│      {                                                           │
│        symbol: "AAPL",                                           │
│        totalPNL: 15000,                                          │
│        stockReturnPercent: 12.5,                                 │
│        bhTotalPNL: 10000,          ◄─── NEW                     │
│        bhReturnPercent: 8.3,       ◄─── NEW                     │
│        pnlDiff: 5000,              ◄─── NEW                     │
│        returnDiff: 4.2             ◄─── NEW                     │
│      }                                                           │
│    ]                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  StockPerformanceTable.js (MODIFIED)                            │
│  - Adds 4 new columns to table                                  │
│  - Implements sorting for new columns                           │
│  - Applies color coding (green/red)                             │
└─────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Backend: portfolioMetricsService.js

**Modification**: Enhance `calculatePortfolioMetrics()` to merge B&H data

```javascript
/**
 * Calculate complete portfolio metrics
 * Modified to include Buy & Hold comparison data
 */
function calculatePortfolioMetrics(portfolio, config, priceDataMap, buyAndHoldComparison) {
  // Existing code...
  const portfolioSummary = calculatePortfolioSummary(portfolio, config);
  const stockResults = calculatePerStockMetrics(
    portfolio,
    config,
    priceDataMap,
    buyAndHoldComparison  // NEW: Pass B&H data
  );

  // Rest of existing code...
}
```

**Modification**: Enhance `calculatePerStockMetrics()` to merge B&H data

```javascript
/**
 * Calculate per-stock metrics and contributions
 * Modified to include Buy & Hold comparison data
 */
function calculatePerStockMetrics(portfolio, config, priceDataMap, buyAndHoldComparison) {
  const results = [];
  const portfolioTotalPNL = portfolio.totalPNL;

  for (const [symbol, stock] of portfolio.stocks) {
    // Existing DCA metrics calculation...
    const stockResult = {
      symbol,
      params: stock.params,
      // ... existing fields ...
      totalPNL: stock.totalPNL,
      stockReturnPercent: stockReturnPercent,
      // ... rest of existing fields ...
    };

    // NEW: Merge Buy & Hold data if available
    if (buyAndHoldComparison && buyAndHoldComparison.stockComparisons) {
      const bhStock = buyAndHoldComparison.stockComparisons.find(s => s.symbol === symbol);

      if (bhStock) {
        stockResult.bhTotalPNL = bhStock.buyAndHoldReturn;
        stockResult.bhReturnPercent = bhStock.buyAndHoldReturnPercent;
        stockResult.pnlDiff = bhStock.outperformance;
        stockResult.returnDiff = stockReturnPercent - bhStock.buyAndHoldReturnPercent;
      } else {
        // No B&H data available for this stock
        stockResult.bhTotalPNL = null;
        stockResult.bhReturnPercent = null;
        stockResult.pnlDiff = null;
        stockResult.returnDiff = null;
      }
    }

    results.push(stockResult);
  }

  return results.sort((a, b) => b.contributionToPortfolioReturn - a.contributionToPortfolioReturn);
}
```

### 2. Backend: portfolioBacktestService.js

**Modification**: Pass B&H comparison to metrics service

```javascript
async function runPortfolioBacktest(config) {
  // ... existing backtest execution code ...

  // Calculate Buy & Hold comparison (EXISTING)
  const buyAndHoldComparison = calculatePortfolioBuyAndHold(
    priceDataMap,
    config,
    portfolio
  );

  // Calculate metrics and include B&H comparison (MODIFIED)
  const metricsResults = calculatePortfolioMetrics(
    portfolio,
    config,
    priceDataMap,
    buyAndHoldComparison  // NEW: Pass B&H data
  );

  // Return results with B&H comparison
  return {
    ...metricsResults,
    buyAndHoldComparison  // EXISTING: Portfolio-level B&H
  };
}
```

### 3. Frontend: StockPerformanceTable.js

**New Columns**:

| Column Name | Data Field | Format | Color Coding | Sortable |
|-------------|------------|--------|--------------|----------|
| B&H P&L | `bhTotalPNL` | Currency ($) | Green if positive, red if negative | Yes |
| B&H Return % | `bhReturnPercent` | Percentage (2 decimals) | Green if positive, red if negative | Yes |
| P&L Diff | `pnlDiff` | Currency ($) | Green if positive (DCA wins), red if negative | Yes |
| Return Diff % | `returnDiff` | Percentage (2 decimals) | Green if positive (DCA wins), red if negative | Yes |

**Column Order** (Updated):

```jsx
<thead>
  <tr>
    <th style={{ width: '40px' }}></th>  {/* Expand icon */}
    <th>Symbol</th>
    <th>Lots</th>
    <th>Capital Deployed</th>
    <th>Market Value</th>
    <th>Total P&L</th>          {/* Existing: DCA P&L */}
    <th>Return %</th>            {/* Existing: DCA Return % */}
    <th>CAGR</th>                {/* Existing */}
    <th>B&H P&L</th>             {/* NEW */}
    <th>B&H Return %</th>        {/* NEW */}
    <th>P&L Diff</th>            {/* NEW */}
    <th>Return Diff %</th>       {/* NEW */}
    <th>Contribution</th>        {/* Existing */}
    <th>Buys</th>                {/* Existing */}
    <th>Sells</th>               {/* Existing */}
    <th>Rejected</th>            {/* Existing */}
    <th>Details</th>             {/* Existing */}
  </tr>
</thead>
```

**Implementation**:

```jsx
// Add new column headers with sort handlers
<th onClick={() => handleSort('bhTotalPNL')} className="sortable">
  B&H P&L <SortIcon field="bhTotalPNL" />
</th>
<th onClick={() => handleSort('bhReturnPercent')} className="sortable">
  B&H Return % <SortIcon field="bhReturnPercent" />
</th>
<th onClick={() => handleSort('pnlDiff')} className="sortable">
  P&L Diff <SortIcon field="pnlDiff" />
</th>
<th onClick={() => handleSort('returnDiff')} className="sortable">
  Return Diff % <SortIcon field="returnDiff" />
</th>

// Add new data cells in table body
<td className={stock.bhTotalPNL >= 0 ? 'positive' : 'negative'}>
  {stock.bhTotalPNL != null ? formatCurrency(stock.bhTotalPNL) : 'N/A'}
</td>
<td className={stock.bhReturnPercent >= 0 ? 'positive' : 'negative'}>
  {stock.bhReturnPercent != null ? safeToFixed(stock.bhReturnPercent, 2) + '%' : 'N/A'}
</td>
<td className={stock.pnlDiff >= 0 ? 'positive' : 'negative'}>
  {stock.pnlDiff != null ? formatCurrency(stock.pnlDiff) : 'N/A'}
</td>
<td className={stock.returnDiff >= 0 ? 'positive' : 'negative'}>
  {stock.returnDiff != null ? safeToFixed(stock.returnDiff, 2) + '%' : 'N/A'}
</td>
```

**Helper Function**:

```javascript
const formatDifference = (value, isPercentage = false) => {
  if (value == null || isNaN(value)) return 'N/A';

  const prefix = value >= 0 ? '+' : '';
  if (isPercentage) {
    return `${prefix}${value.toFixed(2)}%`;
  }
  return formatCurrency(value);
};
```

## Data Model

### Stock Result Object (Extended)

```javascript
{
  // Existing fields
  symbol: "AAPL",
  params: { /* stock-specific params */ },
  lotsHeld: 5,
  capitalDeployed: 50000,
  marketValue: 62000,
  totalPNL: 12000,              // DCA total P&L
  stockReturnPercent: 24.0,     // DCA return %
  cagr: 18.5,
  contributionToPortfolioReturn: 15.2,
  totalBuys: 25,
  totalSells: 8,
  rejectedBuys: 2,
  transactions: [ /* ... */ ],
  priceData: [ /* ... */ ],

  // NEW: Buy & Hold comparison fields
  bhTotalPNL: 9000,             // B&H total P&L (same capital, buy once, hold)
  bhReturnPercent: 18.0,        // B&H return %
  pnlDiff: 3000,                // DCA P&L - B&H P&L (positive = DCA wins)
  returnDiff: 6.0               // DCA Return % - B&H Return % (positive = DCA wins)
}
```

## Edge Cases & Error Handling

### Case 1: Missing B&H Data for a Stock

**Scenario**: Stock has no price data for B&H calculation

**Handling**:
- Set `bhTotalPNL`, `bhReturnPercent`, `pnlDiff`, `returnDiff` to `null`
- Frontend displays "N/A" in cells
- Sorting treats `null` values as 0 (or places them at end)

### Case 2: B&H Service Returns Null

**Scenario**: `buyAndHoldComparison` is `null` or `undefined`

**Handling**:
- Skip B&H data merge entirely
- All stocks get `null` B&H fields
- Frontend shows "N/A" for all B&H columns

### Case 3: Stock Symbol Mismatch

**Scenario**: Stock in DCA results not found in B&H results

**Handling**:
- Log warning: `B&H data not found for ${symbol}`
- Set B&H fields to `null` for that stock
- Continue processing other stocks

### Case 4: Sorting with Null Values

**Scenario**: User sorts by B&H column with some null values

**Handling**:
```javascript
const sortedStocks = useMemo(() => {
  if (!stocks) return [];

  return [...stocks].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    // Treat null/undefined as 0 for sorting
    if (aVal == null) aVal = 0;
    if (bVal == null) bVal = 0;

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
}, [stocks, sortField, sortDirection]);
```

## UI/UX Considerations

### Visual Design

1. **Column Headers**:
   - B&H columns grouped visually (consider subtle background color)
   - Tooltip on header: "Buy & Hold: Buy at start, hold until end with equal capital"

2. **Color Coding**:
   - Green: Positive P&L or DCA outperforms B&H
   - Red: Negative P&L or B&H outperforms DCA
   - Gray: N/A (no data)

3. **Difference Columns**:
   - Show "+" prefix for positive differences
   - Example: "+$5,000" or "+3.2%"

### Responsive Behavior

- Table may become wide with 4 new columns
- Consider:
  - Horizontal scroll on smaller screens
  - OR: Make some columns optionally hideable
  - OR: Use collapsible column groups

### Tooltips (Optional Enhancement)

```jsx
<th
  onClick={() => handleSort('pnlDiff')}
  className="sortable"
  title="Difference between DCA P&L and Buy & Hold P&L. Positive means DCA outperformed."
>
  P&L Diff <SortIcon field="pnlDiff" />
</th>
```

## Performance Considerations

### Backend Performance

- **B&H Calculation**: Already calculated by `portfolioBuyAndHoldService.js`
- **Data Merge**: O(n*m) where n = stocks in DCA, m = stocks in B&H
  - With array.find(): Max ~100 stocks, negligible impact
  - Consider Map lookup if portfolio has >1000 stocks

### Frontend Performance

- **Sorting**: Existing implementation handles sorting well
- **Re-renders**: No additional re-renders introduced
- **Memory**: 4 new fields per stock = ~64 bytes per stock = negligible

## Testing Strategy

### Unit Tests

1. **Backend**: `portfolioMetricsService.test.js`
   - Test B&H data merge with valid comparison data
   - Test handling of null B&H comparison
   - Test handling of missing stock in B&H data
   - Test calculation of returnDiff

2. **Frontend**: `StockPerformanceTable.test.js`
   - Test rendering with B&H data
   - Test rendering with null B&H data (displays "N/A")
   - Test sorting by B&H columns
   - Test color coding (positive/negative)

### Integration Tests

1. **End-to-End Flow**:
   - Run portfolio backtest
   - Verify B&H data in API response
   - Verify B&H columns in UI
   - Verify sorting functionality

### Manual Testing Scenarios

1. **Happy Path**:
   - Run nasdaq100 portfolio backtest
   - Verify all 100 stocks have B&H data
   - Sort by each B&H column
   - Verify color coding

2. **Edge Case**:
   - Portfolio with stock missing price data
   - Verify "N/A" displayed correctly

## Backward Compatibility

- **No Breaking Changes**: Existing API responses work without B&H data
- **Graceful Degradation**: If B&H data missing, columns show "N/A"
- **Optional Enhancement**: Can be deployed without breaking existing functionality

## Security Considerations

- No new security concerns
- No user input involved
- Read-only display of calculated data

## Monitoring & Logging

**Add Logging**:
```javascript
// In portfolioMetricsService.js
if (buyAndHoldComparison && buyAndHoldComparison.stockComparisons) {
  console.log(`Merging B&H data for ${buyAndHoldComparison.stockComparisons.length} stocks`);
} else {
  console.warn('No Buy & Hold comparison data available for stock-level metrics');
}
```

## Future Enhancements

1. **Tooltip Details**: Show B&H calculation details on hover
2. **Highlight Winners**: Visually highlight stocks where DCA significantly outperforms B&H
3. **Filter by Outperformance**: Add filter to show only stocks where DCA beats B&H
4. **Export Enhanced Data**: Include B&H comparison in CSV exports
5. **Per-Stock B&H Chart**: Click to see DCA vs B&H performance over time for individual stock

## UI/UX Improvements (Vertical Space Optimization)

### Overview

To improve the portfolio results page user experience, we're implementing several UI improvements to save vertical space and consolidate related information. These changes make the page more scannable and reduce scrolling.

### UI Improvement 1: Compact Multi-Stock Price Comparison

**Current State**:
```jsx
Multi-Stock Price Comparison (Normalized)

Stocks:

NVDA
SHOP
META
SMCI
LRCX
CRWD
```

**Problem**: Each stock symbol on a separate line wastes vertical space

**Solution**: Display all stock symbols inline (like Portfolio Composition)

```jsx
Multi-Stock Price Comparison (Normalized)

Stocks: NVDA • SHOP • META • SMCI • LRCX • CRWD
```

**Implementation**:

File: Component that renders Multi-Stock Price Comparison

```jsx
// BEFORE
<div className="stock-list">
  {stocks.map(symbol => (
    <div key={symbol} className="stock-item">{symbol}</div>
  ))}
</div>

// AFTER
<div className="stock-list-inline">
  <span className="label">Stocks:</span>
  {stocks.map((symbol, index) => (
    <React.Fragment key={symbol}>
      <span className="stock-symbol">{symbol}</span>
      {index < stocks.length - 1 && <span className="separator"> • </span>}
    </React.Fragment>
  ))}
</div>
```

**CSS**:
```css
.stock-list-inline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.stock-list-inline .label {
  font-weight: 600;
  margin-right: 4px;
}

.stock-list-inline .stock-symbol {
  font-family: monospace;
  font-weight: 500;
}

.stock-list-inline .separator {
  color: #999;
}
```

---

### UI Improvement 2: Merge Current Holdings into Stock Performance Breakdown

**Current State**: Two separate sections
1. **Current Holdings** - Shows lots held with purchase details
2. **Stock Performance Breakdown** - Shows performance metrics with expandable transaction history

**Problem**: Redundant - both sections show per-stock information. Users must scroll between sections.

**Solution**: Merge into single section. Expand Stock Performance Breakdown to include current holdings in the expandable detail view.

**New Structure**:

```
Stock Performance Breakdown
Individual stock performance and contribution to portfolio returns

[Table with collapsed rows]
Symbol | Lots | Capital | Market Value | P&L | Return % | ... | Details

[Expanded Row for NVDA]
┌─────────────────────────────────────────────────────────────┐
│ NVDA - Performance & Holdings                               │
├─────────────────────────────────────────────────────────────┤
│ Current Holdings (5 lots held)                              │
│ Total Market Value: $299,575.54                             │
│ Total Unrealized P&L: $249,575.54                           │
│                                                              │
│ Purchase Date | Purchase Price | Shares | Current Price |..│
│ Jul 6, 2022  | $15.83         | 631.54 | $182.15       |..│
│ Oct 3, 2022  | $13.15         | 760.39 | $182.15       |..│
│ ...                                                          │
├─────────────────────────────────────────────────────────────┤
│ Transaction History (17 transactions)                       │
│                                                              │
│ Date       | Type | Price | Quantity | Amount | P&L |...   │
│ Jul 6, 2022| BUY  | $15.83| 631.54   | $10,000| -   |...   │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘
```

**Implementation**:

File: `frontend/src/components/StockPerformanceTable.js`

**Modify `StockDetailView` component**:

```jsx
const StockDetailView = ({ stock }) => {
  // ... existing formatCurrency function ...

  // Filter transactions
  const actualTransactions = stock.transactions?.filter(tx => !tx.type.includes('ABORTED')) || [];

  // NEW: Extract current holdings (lots held)
  const currentHoldings = stock.lotsHeld > 0 ? extractCurrentHoldings(stock) : null;

  return (
    <div className="stock-detail">
      <h4>{stock.symbol} - Performance & Holdings</h4>

      {/* NEW: Current Holdings Section */}
      {currentHoldings && (
        <div className="current-holdings-section">
          <h5>Current Holdings ({stock.lotsHeld} lots held)</h5>
          <div className="holdings-summary">
            <span>Total Market Value: {formatCurrency(stock.marketValue)}</span>
            <span>Total Unrealized P&L: {formatCurrency(stock.unrealizedPNL)}</span>
          </div>

          <table className="holdings-table">
            <thead>
              <tr>
                <th>Purchase Date</th>
                <th>Purchase Price</th>
                <th>Shares</th>
                <th>Current Price</th>
                <th>Current Value</th>
                <th>Unrealized P&L</th>
              </tr>
            </thead>
            <tbody>
              {currentHoldings.map((lot, idx) => (
                <tr key={idx}>
                  <td>{lot.purchaseDate}</td>
                  <td>${lot.purchasePrice.toFixed(2)}</td>
                  <td>{lot.shares.toFixed(2)}</td>
                  <td>${lot.currentPrice.toFixed(2)}</td>
                  <td>{formatCurrency(lot.currentValue)}</td>
                  <td className={lot.unrealizedPNL >= 0 ? 'positive' : 'negative'}>
                    {formatCurrency(lot.unrealizedPNL)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* EXISTING: Transaction History Section */}
      <div className="transaction-history-section">
        <h5>Transaction History ({actualTransactions.length} transactions)</h5>

        {actualTransactions.length > 0 ? (
          <div className="transaction-table-wrapper">
            {/* Existing transaction table */}
          </div>
        ) : (
          <p className="no-transactions">No transactions recorded</p>
        )}
      </div>
    </div>
  );
};

/**
 * NEW: Extract current holdings from stock data
 * Reconstruct lots held from transaction history
 */
function extractCurrentHoldings(stock) {
  // Get the most recent transaction to find current price
  const latestTransaction = stock.transactions?.[stock.transactions.length - 1];
  const currentPrice = latestTransaction?.price || 0;

  // Find all BUY transactions to reconstruct lots
  const buyTransactions = stock.transactions?.filter(tx => tx.type.includes('BUY')) || [];
  const sellTransactions = stock.transactions?.filter(tx => tx.type.includes('SELL')) || [];

  // Build lot tracking (simplified - actual implementation may need to match lotsDetails)
  const lots = [];

  // For each BUY, check if it's still held (not fully sold)
  buyTransactions.forEach(buyTx => {
    // Check if this lot was sold
    let remainingShares = buyTx.shares;

    sellTransactions.forEach(sellTx => {
      if (sellTx.lotsDetails) {
        sellTx.lotsDetails.forEach(soldLot => {
          if (soldLot.date === buyTx.date && Math.abs(soldLot.price - buyTx.price) < 0.01) {
            remainingShares -= soldLot.shares;
          }
        });
      }
    });

    if (remainingShares > 0.01) {  // Still holding this lot
      const currentValue = remainingShares * currentPrice;
      const costBasis = remainingShares * buyTx.price;

      lots.push({
        purchaseDate: buyTx.date,
        purchasePrice: buyTx.price,
        shares: remainingShares,
        currentPrice,
        currentValue,
        unrealizedPNL: currentValue - costBasis
      });
    }
  });

  return lots;
}
```

**CSS Additions**:
```css
.current-holdings-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e0e0e0;
}

.current-holdings-section h5 {
  margin-bottom: 12px;
  color: #333;
}

.holdings-summary {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  font-size: 14px;
}

.holdings-summary span {
  font-weight: 500;
}

.holdings-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.holdings-table th {
  background-color: #f5f5f5;
  padding: 8px;
  text-align: left;
  font-weight: 600;
  border: 1px solid #ddd;
}

.holdings-table td {
  padding: 8px;
  border: 1px solid #ddd;
}

.transaction-history-section h5 {
  margin-bottom: 12px;
  color: #333;
}
```

**Remove**: Separate "Current Holdings" section from `PortfolioResults.js`

---

### UI Improvement 3: Daily Trading Activity - Default Sort Order

**Current State**: Default sort is "Newest First" (descending by date)

**Problem**: Users want to see how portfolio was built chronologically

**Solution**: Change default sort to "Oldest First" (ascending by date)

**Implementation**:

File: Daily Trading Activity component

```jsx
// BEFORE
const [sortOrder, setSortOrder] = useState('desc'); // Newest first

// AFTER
const [sortOrder, setSortOrder] = useState('asc');  // Oldest first

// Update UI label
// BEFORE
<div className="sort-control">
  Sort: {sortOrder === 'desc' ? '↓ Newest First' : '↑ Oldest First'}
</div>

// AFTER (default is now oldest)
<div className="sort-control">
  Sort: {sortOrder === 'asc' ? '↑ Oldest First' : '↓ Newest First'}
</div>
```

---

### UI Improvement Impact Summary

| Improvement | Vertical Space Saved | Implementation Complexity |
|-------------|---------------------|---------------------------|
| Compact stock list in Multi-Stock Price Comparison | ~50-150px (depends on # stocks) | Low |
| Merge Current Holdings into Stock Performance | ~300-500px (entire section removed) | Medium |
| Daily Trading default sort | 0px (UX improvement only) | Very Low |
| **Total Estimated** | **~350-650px saved** | **Medium** |

---

## Buy & Hold Calculation Clarification

### Question: Does the spec include B&H calculation for each stock?

**Answer**: **No, the B&H calculation is already implemented** and does not need to be modified.

**Existing Implementation**:

File: `backend/services/portfolioBuyAndHoldService.js`

```javascript
/**
 * Calculate Buy & Hold for a single stock (ALREADY EXISTS)
 * @param {String} symbol - Stock symbol
 * @param {Array|Map} prices - Price data array or Map(date -> data)
 * @param {Number} allocatedCapital - Capital allocated to this stock
 * @param {String} startDate - Start date (YYYY-MM-DD)
 * @param {String} endDate - End date (YYYY-MM-DD)
 * @returns {Object} - Buy & Hold position details
 */
function calculateStockBuyAndHold(symbol, prices, allocatedCapital, startDate, endDate) {
  // ... (lines 101-162)
  // This function already:
  // 1. Calculates shares bought at start date
  // 2. Calculates final value at end date
  // 3. Calculates total return and return %
  // 4. Calculates CAGR, max drawdown, Sharpe ratio
  // 5. Returns complete B&H metrics for the stock
}
```

**How it's used**:

```javascript
// In calculatePortfolioBuyAndHold() (line 380)
const stockPositions = symbols.map(symbol => {
  const prices = priceDataMap.get(symbol);
  return calculateStockBuyAndHold(
    symbol,
    prices,
    capitalPerStock,      // Equal allocation
    config.startDate,
    config.endDate
  );
}).filter(Boolean);
```

**What This Spec Adds**:

1. ✅ **Merge B&H data into `stockResults`** (backend: portfolioMetricsService)
2. ✅ **Display B&H data in table** (frontend: StockPerformanceTable)
3. ✅ **Calculate comparison metrics** (pnlDiff, returnDiff)

**What Already Exists** (No Changes Needed):

1. ✅ Per-stock B&H calculation (`calculateStockBuyAndHold`)
2. ✅ Portfolio-level B&H calculation (`calculatePortfolioBuyAndHold`)
3. ✅ B&H metrics (total return, return %, CAGR, etc.)

---

## References

- **Spec 35**: Portfolio Buy & Hold Comparison (portfolio-level implementation)
- **Service**: `backend/services/portfolioBuyAndHoldService.js`
- **Component**: `frontend/src/components/StockPerformanceTable.js`
- **Data Model**: `backend/services/portfolioMetricsService.js`
