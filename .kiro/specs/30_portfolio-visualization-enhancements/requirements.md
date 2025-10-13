# Spec 30: Portfolio Visualization Enhancements

## Overview

Enhance the portfolio backtest UI with advanced visualization capabilities and stock drill-down features to better understand portfolio management, capital allocation, and individual stock performance within the portfolio context.

## User Stories

### US-1: Stock Drill-Down with Portfolio Context
**As a** portfolio manager
**I want to** click on a stock in the performance table and see its detailed backtest results with portfolio context
**So that I can** understand how capital constraints and portfolio competition affected that stock's performance

**Acceptance Criteria:**
- Each stock row in StockPerformanceTable has a clickable link to existing page: `/backtest/long/:symbol/results?...`
- Link preserves all portfolio parameters (dates, capital, DCA settings)
- Individual stock view shows the SAME transactions that occurred in the portfolio backtest
- Shows "Insufficient Capital" events in Enhanced Transaction History (similar to "Aborted Buy")
- Shows "Insufficient Capital" events in Daily Transaction Log
- URL is shareable and directly navigable

### US-2: Consolidated Portfolio Value Chart
**As a** portfolio manager
**I want to** see a single chart showing total portfolio value over time with all stock contributions
**So that I can** understand how my portfolio value evolved and which stocks drove performance

**Acceptance Criteria:**
- Stacked area chart showing portfolio composition over time
- Each stock has a distinct color
- Cash reserve shown as separate area
- Total portfolio value line overlay
- Interactive legend to show/hide stocks
- Tooltip shows breakdown on hover

### US-3: Multi-Stock Price Chart with Transactions
**As a** trader
**I want to** see all stock prices normalized and plotted together with buy/sell markers
**So that I can** understand trading timing across the portfolio and correlate with price movements

**Acceptance Criteria:**
- Line chart with normalized prices (0-100% scale relative to start)
- Each stock has a distinct color
- Buy/sell markers color-coded by stock
- Rejected buy orders shown as special markers
- Zoomable and pan-able time axis
- Synchronized with other charts

### US-4: Capital Allocation Timeline
**As a** portfolio manager
**I want to** see how capital was allocated across stocks over time
**So that I can** understand capital utilization patterns and identify periods of high/low deployment

**Acceptance Criteria:**
- Stacked bar chart or area chart showing deployed capital by stock
- Shows capital utilization %
- Highlights periods of capital scarcity (high rejection rates)
- Shows cash reserve levels
- Interactive drill-down to specific dates

## Functional Requirements

### FR-1: Stock Detail Page with Portfolio Context (Reuse Existing Infrastructure)

**FR-1.1: Generate URLs to Existing Results Page**
- StockPerformanceTable generates links to existing page: `/backtest/long/:symbol/results?...`
- URL includes all parameters from portfolio backtest:
  - startDate, endDate
  - lotSizeUsd (from portfolio config)
  - gridIntervalPercent, profitRequirement (stock-specific or default)
  - maxLots (from portfolio config)
- Add new query parameter: `portfolioRunId=<uuid>` to indicate this is from portfolio context
- URL is shareable and directly navigable

**FR-1.2: New Backend Endpoint for Portfolio Stock Results**
- Create endpoint: `GET /api/portfolio-backtest/:runId/stock/:symbol/results`
- Returns data in SAME format as existing DCA backtest endpoint
- Includes all transactions from the portfolio run (not re-computed)
- Includes "Insufficient Capital" events as special transaction type
- Compatible with existing results page components

**FR-1.3: Add "Insufficient Capital" Transaction Event Type**
- New event type similar to "Aborted Buy" in existing system
- Event structure:
  ```javascript
  {
    date: '2024-01-15',
    type: 'INSUFFICIENT_CAPITAL',
    attemptedPrice: 150.00,
    attemptedShares: 66.67,
    attemptedValue: 10000,
    availableCapital: 5000,
    shortfall: 5000,
    reason: 'Portfolio capital deployed to other stocks',
    competingStocks: ['AAPL', 'NVDA']  // stocks holding capital at this time
  }
  ```

**FR-1.4: Enhanced Transaction History Integration**
- Modify existing "Enhanced Transaction History" component to recognize "Insufficient Capital" events
- Display alongside "Aborted Buy", "Buy", "Sell" events
- Yellow/orange background for "Insufficient Capital" rows
- Show details: shortfall amount, available capital, competing stocks

**FR-1.5: Daily Transaction Log Integration**
- Modify existing "Daily Transaction Log" to include "Insufficient Capital" events
- Group by date with other events
- Visual indicator (icon or color) for insufficient capital
- Tooltip or expandable detail showing competing stocks

### FR-2: Consolidated Portfolio Composition Chart

**FR-2.1: Stacked Area Chart**
- Show portfolio value composition over time
- Areas stacked in consistent order (e.g., alphabetical by symbol)
- Include:
  - Each stock's market value
  - Cash reserve
  - Realized P&L accumulated
- Color palette: distinct, accessible colors for up to 20 stocks

**FR-2.2: Portfolio Value Overlay**
- Total portfolio value as line chart overlay
- Thicker line, distinct color (e.g., black or gold)
- Shows total return %
- Start value baseline shown

**FR-2.3: Interactivity**
- Click legend items to show/hide stocks
- Hover tooltip shows:
  - Date
  - Total portfolio value
  - Each stock's value and % of portfolio
  - Cash reserve
  - Day's P&L

### FR-3: Multi-Stock Price Comparison Chart

**FR-3.1: Normalized Price Lines**
- All stock prices normalized to start at 100%
- Y-axis shows % change from start
- Each stock has distinct color (matching composition chart)
- Line thickness: 2px for clarity
- Smooth curves (no sharp corners)

**FR-3.2: Transaction Markers**
- Buy orders: Upward-pointing triangle, filled
- Sell orders: Downward-pointing triangle, filled
- Rejected buys: Upward-pointing triangle, hollow/dashed
- Marker size: 6-8px
- Marker color: matches stock color
- Click marker to show transaction details

**FR-3.3: Multi-Stock Transaction Details**
- Tooltip on marker hover shows:
  - Date and price
  - Transaction type (BUY/SELL/REJECTED)
  - Shares and value
  - If rejected: reason and shortfall
  - Lot cost basis (for sells)
  - Realized P&L (for sells)

### FR-4: Capital Allocation Visualization

**FR-4.1: Capital Deployment Stacked Chart**
- Stacked area or bar chart showing deployed capital by stock
- Same colors as composition chart
- Y-axis: Dollar amount
- Shows how capital is allocated across stocks

**FR-4.2: Utilization Metrics**
- Line overlay showing total utilization %
- Highlight periods above 90% utilization (capital scarcity)
- Highlight periods below 50% utilization (underutilized)
- Show rejected order events as markers on high-utilization periods

## Non-Functional Requirements

### NFR-1: Performance
- Charts must render within 500ms for portfolios up to 20 stocks and 365 days
- Smooth interactions (pan, zoom) at 60fps
- Lazy-load transaction details on demand

### NFR-2: Visual Clarity
- Maximum 10 stocks visible simultaneously without overwhelming chart
- If > 10 stocks, provide grouping or filtering options
- Consistent color scheme across all charts
- Accessible color palette (colorblind-friendly)

### NFR-3: Responsiveness
- Charts adapt to screen width (responsive)
- Mobile view: stack charts vertically
- Touch-friendly interactions on mobile

### NFR-4: Data Integrity
- Cached portfolio stock results must match portfolio-level aggregates
- Total of individual stocks = portfolio total
- No data loss when navigating between views

## Technical Considerations

### Data Structure for Cached Results

```javascript
{
  portfolioResults: {
    portfolioSummary: {...},
    stockResults: [
      {
        symbol: 'AAPL',
        // existing fields...
        detailedTransactions: [...], // all transactions
        rejectedOrders: [...],        // rejected buys specific to this stock
        priceData: [...],             // OHLC data for charting
        portfolioContext: {
          portfolioRunId: 'uuid',
          totalCapital: 100000,
          parameters: {...}
        }
      }
    ],
    // existing fields...
  }
}
```

### Chart Library Recommendation
- **Recharts** (already used for CapitalUtilizationChart)
- Pros: React-friendly, declarative, good performance
- Supports: Area, Line, Scatter (for markers), Composed charts
- Alternative: **Chart.js** with react-chartjs-2 for more advanced features

### URL Structure
```
/portfolio-backtest/stock/:symbol?run=<runId>&dates=2024-01-01,2024-12-31&capital=100000&...
```

## Success Metrics

1. **User Engagement**: 80%+ of portfolio backtest users drill down into at least one stock
2. **Insight Discovery**: Users report finding actionable insights about capital allocation
3. **Performance**: Chart render time < 500ms for typical portfolios
4. **Usability**: < 5% error rate in interpreting multi-stock charts
5. **Retention**: Users return to analyze previous portfolio runs via saved URLs

## Out of Scope

- Real-time portfolio tracking (this is backtest only)
- Comparison of multiple portfolio runs side-by-side (future enhancement)
- What-if analysis (e.g., "what if I had more capital?")
- Export charts as images or PDF
- Custom chart color schemes

## Dependencies

- Spec 28: Portfolio Capital Management (backend)
- Spec 29: Portfolio Backtest UI (frontend foundation)
- Recharts library (or equivalent)
- React Router for stock detail pages

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Charts with 15+ stocks become cluttered | High | Implement grouping, filtering, or "top 10" view |
| Transaction markers overlap on dense trading | Medium | Implement clustering or zoom-to-expand |
| Large datasets (10 stocks × 365 days × OHLC) slow rendering | Medium | Virtualization, data decimation, or canvas rendering |
| Cached data takes significant memory | Low | Compress or lazy-load detailed data |

## Timeline Estimate

- Requirements & Design: 2 hours
- Implementation: 24 hours
  - Stock detail page: 6 hours
  - Portfolio composition chart: 6 hours
  - Multi-stock price chart: 8 hours
  - Capital allocation chart: 4 hours
- Testing: 4 hours
- **Total: 30 hours**
