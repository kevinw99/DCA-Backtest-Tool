# Implementation Tasks: Portfolio Visualization Enhancements

## Sprint 1: Backend Data Enhancement (8 hours)

### Task 1.1: Enhance StockState to Track Transactions (2 hours)
**File:** `backend/services/portfolioBacktestService.js`

- [ ] Add `transactions` array to StockState class
- [ ] Add `rejectedOrders` array to StockState class
- [ ] Create `recordTransaction()` method
- [ ] Create `recordRejectedOrder()` method
- [ ] Update all buy/sell logic to call `recordTransaction()`
- [ ] Update rejected buy logic to call `recordRejectedOrder()`
- [ ] Test: Verify transactions are recorded correctly

**Acceptance:**
- All executed transactions logged with full details
- All rejected orders logged with reason and shortfall
- No performance degradation (< 5% increase in backtest time)

### Task 1.2: Add Price Data Collection (2 hours)
**File:** `backend/services/portfolioBacktestService.js`

- [ ] Extract OHLC data from priceDataMap for each stock
- [ ] Format as array of `{ date, open, high, low, close }`
- [ ] Include in stock result object as `priceData`
- [ ] Test: Verify price data matches database

**Acceptance:**
- Price data available for all stocks in portfolio
- Date ranges match portfolio backtest period
- OHLC values are accurate

### Task 1.3: Build Portfolio Composition Time Series (2 hours)
**File:** `backend/services/portfolioBacktestService.js`

- [ ] Create `buildCompositionTimeSeries()` function
- [ ] Sample snapshots at daily intervals
- [ ] For each date, record each stock's market value
- [ ] Include cash reserve and total portfolio value
- [ ] Format: `{ date, [symbol]: value, cash, total }`
- [ ] Test: Verify composition sums equal total portfolio value

**Acceptance:**
- Composition time series covers full backtest period
- Sum of stock values + cash = total portfolio value (within $0.01)
- Efficient sampling (not every tick, daily is sufficient)

### Task 1.4: Add Portfolio Run ID and Parameters (2 hours)
**File:** `backend/services/portfolioBacktestService.js`

- [ ] Generate unique `portfolioRunId` using timestamp + random
- [ ] Include full parameters in response
- [ ] Return enhanced structure with all new fields
- [ ] Update API endpoint to return new structure
- [ ] Test: Verify enhanced response structure

**Acceptance:**
- Unique run ID generated for each backtest
- All parameters included in response
- Backward compatible with existing UI

---

## Sprint 2: Stock Detail Page (8 hours)

### Task 2.1: Create StockDetailPage Component (2 hours)
**File:** `frontend/src/components/StockDetailPage.js`

- [ ] Create page component with routing
- [ ] Extract `symbol` from URL params
- [ ] Extract portfolio run ID from query params
- [ ] Load cached results from sessionStorage
- [ ] Find stock data from cached results
- [ ] Display basic layout with sections
- [ ] Test: Navigate to page via URL

**Acceptance:**
- Page accessible via `/portfolio-backtest/stock/:symbol`
- Loads correct stock data from cache
- Shows "not found" message if cache missing

### Task 2.2: Stock Price Chart with Transactions (3 hours)
**File:** `frontend/src/components/StockPriceChartWithTransactions.js`

- [ ] Create candlestick or line chart component
- [ ] Plot OHLC data
- [ ] Overlay buy transaction markers (green triangles)
- [ ] Overlay sell transaction markers (red triangles)
- [ ] Overlay rejected buy markers (orange hollow triangles)
- [ ] Custom tooltip showing transaction details
- [ ] Zoom and pan functionality
- [ ] Test: All transactions visible on chart

**Acceptance:**
- Chart clearly shows price movement
- All transaction types distinguishable
- Tooltips show transaction details
- Responsive and performant

### Task 2.3: Transaction History Table (2 hours)
**File:** `frontend/src/components/TransactionHistoryTable.js`

- [ ] Create table combining executed and rejected orders
- [ ] Columns: Date, Type, Price, Shares, Value, P&L, Status
- [ ] Sort by date (chronological)
- [ ] Highlight rejected orders (yellow background)
- [ ] Show rejected order details (reason, shortfall)
- [ ] Expandable rows for detailed info
- [ ] Test: All transactions listed correctly

**Acceptance:**
- Executed and rejected orders clearly distinguished
- Chronological order maintained
- Rejected orders show capital shortfall details

### Task 2.4: Add Routing Configuration (1 hour)
**Files:** `frontend/src/App.js`, `frontend/src/components/StockPerformanceTable.js`

- [ ] Add route for `/portfolio-backtest/stock/:symbol`
- [ ] Update StockPerformanceTable to add "View Details" link
- [ ] Generate URLs with all necessary query params
- [ ] Test: Click link navigates to stock detail page
- [ ] Test: URL is shareable and works directly

**Acceptance:**
- Clicking stock row or link navigates correctly
- URL includes all parameters
- Direct URL access works
- Back button returns to portfolio page

---

## Sprint 3: Portfolio Composition Chart (6 hours)

### Task 3.1: Create PortfolioCompositionChart Component (3 hours)
**File:** `frontend/src/components/PortfolioCompositionChart.js`

- [ ] Create stacked area chart using Recharts
- [ ] One area per stock (dynamic based on data)
- [ ] Cash reserve as separate area
- [ ] Total portfolio value as line overlay
- [ ] Assign distinct colors to each stock
- [ ] Implement legend with click-to-hide functionality
- [ ] Test: Chart renders for 1-20 stocks

**Acceptance:**
- Stacked areas show portfolio composition
- Total value line matches sum of areas
- Colors are distinct and consistent
- Legend allows hiding stocks

### Task 3.2: Custom Tooltip (1 hour)
**File:** `frontend/src/components/PortfolioCompositionChart.js`

- [ ] Create custom tooltip component
- [ ] Show date and total portfolio value
- [ ] List each stock's value and % of portfolio
- [ ] Show cash reserve
- [ ] Show day's P&L if available
- [ ] Test: Tooltip shows accurate data

**Acceptance:**
- Tooltip displays on hover
- Shows breakdown by stock
- Percentages sum to 100%
- Formatted currency values

### Task 3.3: Prepare Composition Data in Backend (1 hour)
**File:** `backend/services/portfolioBacktestService.js`

- [ ] Sample portfolio state at daily intervals
- [ ] Build composition snapshot for each day
- [ ] Optimize: Only sample at transaction dates + start/end
- [ ] Test: Data structure matches chart requirements

**Acceptance:**
- Composition data covers full period
- Sampling is efficient (not too many data points)
- Data structure is chart-ready

### Task 3.4: Integration and Styling (1 hour)
**File:** `frontend/src/components/PortfolioCompositionChart.css`

- [ ] Add to PortfolioResults component
- [ ] Style chart container
- [ ] Responsive design (mobile-friendly)
- [ ] Color palette configuration
- [ ] Test: Chart integrates seamlessly

**Acceptance:**
- Chart displays in results page
- Responsive on all screen sizes
- Consistent styling with other charts

---

## Sprint 4: Multi-Stock Price Chart (8 hours)

### Task 4.1: Data Preparation - Normalize Prices (2 hours)
**File:** `frontend/src/utils/chartDataPrepare.js`

- [ ] Create `normalizePrices()` utility function
- [ ] Calculate % change from start for each stock
- [ ] Align dates across all stocks
- [ ] Handle missing dates (fill gaps or skip)
- [ ] Test: Normalization is accurate

**Acceptance:**
- All stocks start at 0% (or 100 if using indexed)
- Date alignment is correct
- % change calculations verified

### Task 4.2: Create MultiStockPriceChart Component (3 hours)
**File:** `frontend/src/components/MultiStockPriceChart.js`

- [ ] Create line chart with multiple series
- [ ] One line per stock (normalized prices)
- [ ] Reference line at 0%
- [ ] Same color palette as composition chart
- [ ] Legend with click-to-hide
- [ ] Y-axis shows % change
- [ ] Test: Chart renders all stocks

**Acceptance:**
- All stock price lines visible
- Colors match other charts
- Legend functional
- Normalized % change is correct

### Task 4.3: Add Transaction Markers (2 hours)
**File:** `frontend/src/components/MultiStockPriceChart.js`

- [ ] Prepare transaction marker data
- [ ] Map transactions to normalized prices
- [ ] Render buy markers (green triangles)
- [ ] Render sell markers (red triangles)
- [ ] Render rejected markers (orange hollow)
- [ ] Custom shapes for each type
- [ ] Test: Markers align with price lines

**Acceptance:**
- All transaction types visible
- Markers color-coded by stock
- Markers positioned at correct price/date
- Distinguishable marker shapes

### Task 4.4: Transaction Marker Tooltips (1 hour)
**File:** `frontend/src/components/MultiStockPriceChart.js`

- [ ] Tooltip on marker hover
- [ ] Show transaction type, date, price
- [ ] Show shares and value
- [ ] Show realized P&L for sells
- [ ] Show shortfall for rejected buys
- [ ] Test: Tooltip shows correct data

**Acceptance:**
- Hovering marker shows tooltip
- Tooltip data matches transaction
- Clear and readable formatting

---

## Sprint 5: Capital Allocation Chart + Polish (6 hours)

### Task 5.1: Create CapitalAllocationChart Component (2 hours)
**File:** `frontend/src/components/CapitalAllocationChart.js`

- [ ] Stacked area chart of deployed capital by stock
- [ ] Line overlay for utilization %
- [ ] Same colors as other charts
- [ ] Highlight high-utilization periods (> 90%)
- [ ] Test: Chart renders correctly

**Acceptance:**
- Shows capital deployment over time
- Utilization % line is accurate
- High-utilization periods highlighted

### Task 5.2: Session Storage for Portfolio Results (1 hour)
**File:** `frontend/src/components/PortfolioBacktestPage.js`

- [ ] Save results to sessionStorage on backtest complete
- [ ] Key by portfolio run ID
- [ ] Retrieve on stock detail page navigation
- [ ] Clear old runs (keep last 5)
- [ ] Test: Navigation works with cached data

**Acceptance:**
- Results cached after backtest
- Stock detail page loads from cache
- No redundant API calls

### Task 5.3: Color Palette and Accessibility (1 hour)
**File:** `frontend/src/utils/colorPalette.js`

- [ ] Define colorblind-friendly palette
- [ ] Test with color blindness simulators
- [ ] Ensure sufficient contrast
- [ ] Add ARIA labels to charts
- [ ] Test: Screen reader compatibility

**Acceptance:**
- Colors are distinguishable for colorblind users
- ARIA labels present on all charts
- Screen readers can interpret chart data

### Task 5.4: Integration Testing and Bug Fixes (2 hours)

- [ ] Test full flow: Run backtest → View results → Drill down to stock
- [ ] Test with various stock counts (1, 5, 10, 15)
- [ ] Test with different date ranges
- [ ] Performance test with maximum data
- [ ] Fix any bugs discovered
- [ ] Cross-browser testing

**Acceptance:**
- All features work end-to-end
- No console errors
- Performance acceptable (< 1s render time)

---

## Sprint 6: Documentation and Testing (4 hours)

### Task 6.1: Unit Tests (2 hours)

- [ ] Test `normalizePrices()` utility
- [ ] Test chart data preparation functions
- [ ] Test URL generation for stock detail
- [ ] Test sessionStorage caching
- [ ] Test component render (React Testing Library)

**Acceptance:**
- 80%+ code coverage for new components
- All edge cases tested
- Tests pass consistently

### Task 6.2: Update User Documentation (1 hour)
**File:** `.kiro/specs/30_portfolio-visualization-enhancements/user-guide.md`

- [ ] Document portfolio composition chart
- [ ] Document multi-stock price chart
- [ ] Document stock detail drill-down
- [ ] Add screenshots/examples
- [ ] Explain rejected order visibility

**Acceptance:**
- Clear, concise user guide
- Screenshots illustrate features
- Common use cases covered

### Task 6.3: Performance Optimization (1 hour)

- [ ] Memoize expensive calculations
- [ ] Optimize data structure for charts
- [ ] Reduce re-renders with React.memo
- [ ] Test performance with large datasets
- [ ] Document performance benchmarks

**Acceptance:**
- Chart render time < 500ms for 10 stocks × 365 days
- No janky interactions
- Smooth scrolling and zooming

---

## Definition of Done

- [ ] All tasks completed and tested
- [ ] Code reviewed and approved
- [ ] No console errors or warnings
- [ ] Responsive on desktop, tablet, mobile
- [ ] Accessibility tested (WCAG 2.1 AA)
- [ ] Performance benchmarks met
- [ ] User documentation complete
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Deployed to staging environment
- [ ] Stakeholder demo completed

---

## Estimated Timeline

| Sprint | Tasks | Hours | Cumulative |
|--------|-------|-------|------------|
| Sprint 1 | Backend Data Enhancement | 8 | 8 |
| Sprint 2 | Stock Detail Page | 8 | 16 |
| Sprint 3 | Portfolio Composition Chart | 6 | 22 |
| Sprint 4 | Multi-Stock Price Chart | 8 | 30 |
| Sprint 5 | Capital Allocation Chart + Polish | 6 | 36 |
| Sprint 6 | Documentation and Testing | 4 | 40 |

**Total Estimated Time: 40 hours (5 days @ 8 hours/day)**

---

## Dependencies

- Recharts library (already installed)
- React Router v6 (already installed)
- Backend portfolio backtest service (Spec 28 - complete)
- Frontend portfolio UI (Spec 29 - complete)

---

## Risks

1. **Performance with many stocks**: Mitigate with data decimation and virtualization
2. **Chart clutter with 15+ stocks**: Implement grouping or filtering
3. **Browser compatibility**: Test on major browsers (Chrome, Firefox, Safari, Edge)
4. **Mobile usability**: Simplify charts for small screens
