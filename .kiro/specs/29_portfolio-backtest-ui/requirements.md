# Portfolio Backtest UI - Requirements

## Problem Statement

The portfolio backtest feature (Spec 28) currently exists as an API-only endpoint (`POST /api/portfolio-backtest`), requiring users to interact with it via curl commands or programmatic API calls. This creates a significant barrier to usability and prevents non-technical users from accessing the powerful portfolio capital management capabilities.

**Current State:**
- Portfolio backtest API endpoint fully functional
- Comprehensive backend services (portfolioBacktestService.js, portfolioMetricsService.js)
- No user interface - API access only
- Users must construct JSON payloads manually
- Results returned as raw JSON, requiring external tools for analysis

**Problem:**
Users cannot easily:
1. Configure and run portfolio backtests through a web interface
2. Visualize portfolio-level performance metrics and capital utilization
3. Explore per-stock contributions and performance breakdown
4. Analyze rejected orders and capital constraints
5. Compare individual stock performance vs portfolio mode
6. Adjust parameters and re-run scenarios interactively

## Goals

### Primary Goals

1. **Input Configuration UI**
   - Form interface for portfolio configuration
   - Multi-stock selection with symbol management
   - Capital allocation parameters (total capital, lot size, max lots)
   - Date range selection (start/end dates)
   - Default DCA parameters (grid interval, profit requirement, stop loss, trailing stops)

2. **Results Visualization**
   - Portfolio summary metrics dashboard
   - Per-stock performance breakdown
   - Capital utilization time series chart
   - Rejected orders visualization
   - Portfolio value over time chart
   - Per-stock contribution analysis

3. **Interactive Analysis**
   - Drill-down into per-stock details
   - Transaction history view for each stock
   - Rejected orders filtering and analysis
   - Capital flow visualization
   - Comparison views (portfolio vs individual stocks)

4. **User Experience**
   - Consistent with existing DCA backtest UI patterns
   - URL parameter support for shareable configurations
   - localStorage persistence for user preferences
   - Loading states and error handling
   - Responsive design

### Secondary Goals

1. **Advanced Features**
   - Save/load portfolio configurations
   - Export results (CSV, JSON)
   - Side-by-side comparison of multiple portfolio runs
   - Pre-configured portfolio templates

2. **Integration**
   - Navigation integration with existing UI
   - Shared components with single-stock backtest
   - Unified styling and design system

## Requirements

### Functional Requirements

#### FR1: Portfolio Configuration Form

**FR1.1: Capital Settings**
- Input field for total capital (USD)
- Input field for lot size (USD)
- Input field for max lots per stock (default: 10)
- Validation: positive numbers, reasonable ranges

**FR1.2: Stock Selection**
- Multi-select dropdown for stock symbols
- Option to add custom symbols
- Display of currently selected stocks with remove option
- Support for 2-10 stocks minimum (reasonable portfolio size)
- Validation: at least 1 stock, symbols exist in database

**FR1.3: Date Range**
- Start date picker
- End date picker
- Validation: start < end, dates within available data range
- Quick presets (YTD, 1Y, 3Y, 5Y, Max)

**FR1.4: Default DCA Parameters**
- Grid interval percent (slider/input, default: 10%)
- Profit requirement (slider/input, default: 10%)
- Stop loss percent (slider/input, default: 30%)
- Enable trailing buy (checkbox)
- Enable trailing sell (checkbox)
- Trailing stop parameters (conditionally visible)

**FR1.5: Form Actions**
- Run Backtest button (validates and submits)
- Reset to defaults button
- Save configuration button (localStorage)
- Load configuration button

#### FR2: Results Dashboard

**FR2.1: Portfolio Summary Card**
Display:
- Total Capital
- Final Portfolio Value
- Total Return ($ and %)
- CAGR (Compound Annual Growth Rate)
- Max Drawdown ($ and %)
- Sharpe Ratio
- Sortino Ratio
- Total Trades (Buys + Sells)
- Win Rate (%)
- Rejected Buys Count and Value
- Capital Utilization (Current %)
- Average Capital Utilization

**FR2.2: Stock Performance Table**
Columns:
- Symbol
- Lots Held (current)
- Capital Deployed ($)
- Market Value ($)
- Total P&L ($)
- Stock Return (%)
- CAGR (%)
- Contribution to Portfolio Return (%)
- Contribution to Portfolio Value (%)
- Total Buys
- Total Sells
- Rejected Buys

Actions:
- Sort by any column
- Click row to expand per-stock details

**FR2.3: Per-Stock Detail View**
For each stock (expandable):
- Transaction history table
  - Date, Type, Price, Quantity, P&L, Running Total
- Rejected orders list
  - Date, Price, Reason, Available Capital, Required Capital
- Stock-specific metrics visualization

**FR2.4: Capital Utilization Chart**
- Time series line chart
- X-axis: Date
- Y-axis: Capital Utilization (%)
- Lines:
  - Deployed Capital ($)
  - Cash Reserve ($)
  - Utilization Percent (%)
- Interactive tooltips on hover

**FR2.5: Portfolio Value Chart**
- Time series line chart
- X-axis: Date
- Y-axis: Portfolio Value ($)
- Lines:
  - Total Portfolio Value
  - Initial Capital (reference line)
- Markers for buy/sell events
- Interactive tooltips showing:
  - Date
  - Portfolio Value
  - P&L ($, %)
  - Recent transactions

**FR2.6: Rejected Orders Analysis**
- Summary card: Total rejected orders, total value, rejection rate
- Table of rejected orders:
  - Date, Symbol, Order Type, Price, Lot Size, Reason
  - Available Capital, Required Capital, Shortfall
  - Portfolio State (deployed, cash, utilization)
- Filter by symbol
- Sort by date, symbol, shortfall

#### FR3: Interactive Features

**FR3.1: Drill-Down Navigation**
- Click stock in table → expand to show details
- Click transaction → highlight on chart
- Click rejected order → show portfolio state at that time

**FR3.2: Chart Interactions**
- Zoom: Select date range on chart
- Pan: Drag to scroll through time
- Hover: Show detailed tooltip
- Toggle series visibility (deployed/cash/utilization)

**FR3.3: Export Functionality**
- Export full results as JSON
- Export summary metrics as CSV
- Export transaction history as CSV
- Export rejected orders as CSV

#### FR4: URL Parameter Support

**FR4.1: Shareable URLs**
Encode parameters in URL:
- Total capital
- Lot size
- Max lots per stock
- Stock symbols (comma-separated)
- Date range
- Default DCA parameters

**FR4.2: Auto-Execution**
- Parse URL parameters on page load
- Auto-populate form fields
- Auto-execute backtest if `?run=true` in URL
- Display results immediately

### Non-Functional Requirements

#### NFR1: Performance
- Form renders in < 100ms
- Backtest submission response < 500ms
- Results visualization renders in < 2s for 4 stocks over 1 year
- Chart interactions < 50ms latency

#### NFR2: Usability
- Consistent with existing DCA backtest UI patterns
- Intuitive form layout with logical grouping
- Clear error messages with actionable guidance
- Loading indicators during backtest execution
- Success/error notifications

#### NFR3: Accessibility
- Keyboard navigation support
- Screen reader compatible
- WCAG 2.1 Level AA compliance
- High contrast mode support

#### NFR4: Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

#### NFR5: Responsive Design
- Desktop: 1920x1080 (primary)
- Tablet: 1024x768 (supported)
- Mobile: 375x667 (view only, not optimized for input)

## User Stories

### US1: Run Portfolio Backtest
**As a** trader
**I want to** configure and run a portfolio backtest through a web interface
**So that** I can test my DCA strategy across multiple stocks with shared capital constraints

**Acceptance Criteria:**
- Can select 2-10 stocks from dropdown
- Can set total capital, lot size, and max lots
- Can configure default DCA parameters
- Can submit and receive results
- Results display comprehensive portfolio metrics

### US2: Analyze Capital Utilization
**As a** portfolio manager
**I want to** visualize how capital is utilized over time
**So that** I can understand if my portfolio is under-capitalized or over-capitalized

**Acceptance Criteria:**
- Chart shows deployed capital vs cash reserve over time
- Chart shows utilization percentage
- Can see peak utilization and average utilization
- Can identify periods of capital constraints

### US3: Identify Capital-Starved Stocks
**As a** trader
**I want to** see which stocks had buy orders rejected due to insufficient capital
**So that** I can adjust my capital allocation or stock selection

**Acceptance Criteria:**
- Table shows all rejected orders with details
- Can filter rejected orders by stock symbol
- Can see portfolio state at time of rejection
- Can calculate how much additional capital would be needed

### US4: Compare Stock Contributions
**As a** portfolio manager
**I want to** see each stock's contribution to overall portfolio return
**So that** I can identify best and worst performers

**Acceptance Criteria:**
- Table shows per-stock P&L and return percentage
- Table shows contribution to portfolio return and value
- Can sort by contribution percentage
- Can see which stocks generated most profit

### US5: Share Portfolio Configuration
**As a** trader
**I want to** share a portfolio backtest configuration via URL
**So that** I can collaborate with others or save configurations for later

**Acceptance Criteria:**
- URL contains all configuration parameters
- Opening URL auto-populates form fields
- Can bookmark URL for later use
- Can share URL with others who see same configuration

### US6: Drill Into Stock Details
**As a** trader
**I want to** drill down into individual stock performance within the portfolio
**So that** I can understand the trading activity and P&L breakdown

**Acceptance Criteria:**
- Can click stock in table to expand details
- See full transaction history for that stock
- See rejected orders for that stock
- See stock-specific metrics and charts

## Success Metrics

1. **Adoption Rate**: 80% of users who run single-stock backtests also try portfolio backtest within 1 month
2. **Usability**: Users can successfully complete a portfolio backtest without documentation 90% of the time
3. **Performance**: Average backtest execution time < 5 seconds for 4 stocks over 1 year
4. **Engagement**: Users run average of 5+ portfolio backtests per session
5. **Feature Usage**: 60% of users explore rejected orders analysis
6. **Sharing**: 30% of portfolio backtests result in shared URLs

## Out of Scope

The following are explicitly **not** included in this spec:

1. **Portfolio Optimization**: Automated capital allocation optimization
2. **Real-Time Portfolio Tracking**: Live portfolio monitoring with real market data
3. **Multi-Currency Support**: Only USD-based portfolios
4. **Custom Per-Stock Parameters**: All stocks use the same default DCA parameters
5. **Portfolio Rebalancing**: No automatic or manual rebalancing features
6. **Risk Analysis**: Advanced risk metrics (VaR, CVaR, correlation matrices)
7. **Monte Carlo Simulation**: Probabilistic scenario analysis
8. **Machine Learning**: Automated parameter tuning or prediction
9. **Mobile-Optimized UI**: Responsive but not optimized for mobile input
10. **Backend Changes**: This spec is frontend-only; backend API is fixed

## Dependencies

### Backend Dependencies (Already Complete)
- ✅ `/api/portfolio-backtest` endpoint (Spec 28)
- ✅ portfolioBacktestService.js
- ✅ portfolioMetricsService.js
- ✅ Stock price data in database

### Frontend Dependencies (Existing)
- ✅ React framework and routing
- ✅ Recharts library for visualization
- ✅ Existing UI component library
- ✅ URL parameter management utilities
- ✅ localStorage persistence utilities
- ✅ Styling system (CSS)

### New Frontend Components (To Be Created)
- ⬜ PortfolioBacktestForm component
- ⬜ PortfolioResults component
- ⬜ PortfolioSummaryCard component
- ⬜ StockPerformanceTable component
- ⬜ CapitalUtilizationChart component
- ⬜ PortfolioValueChart component
- ⬜ RejectedOrdersTable component
- ⬜ Portfolio route integration

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Backend API response time too slow for 10 stocks | Medium | Test with 10 stocks; optimize backend if needed; show loading indicator |
| Large result payload causes UI performance issues | Medium | Implement pagination for transaction tables; lazy-load chart data |
| URL parameter length exceeds browser limits | Low | Use compression; fallback to localStorage for large configs |
| Complex UI overwhelming for new users | Medium | Progressive disclosure; collapsible sections; inline help text |
| Chart rendering slow on large datasets | Medium | Data downsampling for charts; virtualization for tables |
| Browser compatibility issues with modern JS | Low | Use polyfills; test on target browsers; graceful degradation |

## Open Questions

1. Should we support per-stock parameter customization (different grid intervals per stock)?
   - **Decision**: Out of scope for v1; all stocks use default parameters

2. Should we show individual stock charts within portfolio results?
   - **Decision**: Yes, as expandable drill-down within stock details

3. Should we support saving multiple portfolio configurations (named presets)?
   - **Decision**: Secondary goal; implement if time permits

4. Should we visualize correlation between stock movements?
   - **Decision**: Out of scope; too complex for v1

5. What's the maximum number of stocks we should support?
   - **Decision**: Soft limit of 10 stocks for UI usability; backend supports more

## References

- **Spec 28**: `.kiro/specs/28_portfolio-capital-management/` - Backend implementation
- **USAGE.md**: `.kiro/specs/28_portfolio-capital-management/USAGE.md` - API documentation
- **Existing UI**: `frontend/src/components/DCABacktestForm.js` - Reference for form patterns
- **Existing Results**: `frontend/src/components/BacktestResults.js` - Reference for results display
- **Batch Results**: `frontend/src/components/BatchResults.js` - Reference for multi-item results
