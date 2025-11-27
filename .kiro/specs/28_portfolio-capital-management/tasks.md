# Spec 28: Portfolio-Based Capital Management - Implementation Tasks

## Task Breakdown

### Phase 1: Backend Core (Portfolio Engine)

#### Task 1.1: Create portfolioBacktestService.js
**File**: `backend/services/portfolioBacktestService.js`

**Sub-tasks:**
1. Create PortfolioState class
   - Properties: totalCapital, cashReserve, deployedCapital
   - Methods: get availableCapital(), get portfolioValue(), get utilizationPercent()

2. Create StockState class
   - Properties: symbol, lots, capitalDeployed, marketValue, P&L metrics
   - Methods: updateMarketValue(price), addLot(lot), removeLot(lot)

3. Implement runPortfolioBacktest() main function
   - Load price data for all stocks
   - Initialize portfolio state
   - Loop through dates chronologically
   - Process sells first, then buys
   - Return aggregated results

4. Implement identifySellOrders()
   - For each stock, evaluate sell signals
   - Return array of sell orders

5. Implement identifyBuyOrders()
   - For each stock (alphabetical order), evaluate buy signals
   - Return array of buy orders

6. Implement executeBuy()
   - Validate capital available
   - Execute buy transaction
   - Update stock state and portfolio state
   - Deduct from cashReserve

7. Implement executeSell()
   - Execute sell transaction
   - Update stock state and portfolio state
   - Add to cashReserve

8. Implement logRejectedOrder()
   - Create rejected order event
   - Include portfolio state snapshot
   - Add to rejectedOrders array

**Acceptance Criteria:**
- ✅ Portfolio maintains capital constraint at all times
- ✅ Buy orders rejected when insufficient capital
- ✅ All transactions logged correctly
- ✅ Capital flows tracked accurately

---

#### Task 1.2: Integrate with dcaBacktestService.js
**File**: `backend/services/dcaBacktestService.js`

**Sub-tasks:**
1. Extract evaluateBuySignal() helper
   - Takes stock state + price data
   - Returns {triggered: bool, type, reason}
   - Does NOT execute, just evaluates

2. Extract evaluateSellSignal() helper
   - Similar to buy signal
   - Returns signal without executing

3. Create stateless execution functions
   - executeBuyTransaction(stock, signal, price, lotSize)
   - executeSellTransaction(stock, signal, price)

**Acceptance Criteria:**
- ✅ DCA logic reusable from portfolio service
- ✅ No breaking changes to existing single-stock backtest
- ✅ All DCA features work in portfolio mode

---

#### Task 1.3: Create portfolioMetricsService.js
**File**: `backend/services/portfolioMetricsService.js`

**Sub-tasks:**
1. Implement calculatePortfolioMetrics()
   - Calculate portfolio-level CAGR
   - Calculate portfolio-level max drawdown
   - Calculate Sharpe and Sortino ratios
   - Calculate total returns

2. Implement calculatePerStockMetrics()
   - Calculate per-stock CAGR, drawdown, Sharpe
   - Calculate contribution percentages
   - Sort by contribution

3. Implement generateTimeSeries()
   - Capital utilization over time
   - Portfolio value over time
   - P&L over time

4. Implement calculateCapitalFlow()
   - Daily buy/sell flows
   - Net capital deployment
   - Rejected order value

**Acceptance Criteria:**
- ✅ All metrics mathematically correct
- ✅ Sum of stock P&L = portfolio P&L
- ✅ Time series data complete for entire period

---

### Phase 2: Backend API

#### Task 2.1: Add Portfolio Backtest Endpoint
**File**: `backend/server.js`

**Sub-tasks:**
1. Create POST /api/portfolio-backtest endpoint
   - Accept portfolio configuration
   - Validate inputs
   - Call portfolioBacktestService
   - Return results

2. Add validation for portfolio requests
   - Validate totalCapital > 0
   - Validate stocks array not empty
   - Validate lotSizeUsd > 0
   - Validate date range

3. Add error handling
   - Catch insufficient price data errors
   - Handle individual stock failures gracefully
   - Return meaningful error messages

**Acceptance Criteria:**
- ✅ Endpoint accepts valid portfolio configs
- ✅ Returns complete results JSON
- ✅ Proper error handling and validation

---

#### Task 2.2: Add Portfolio Configuration Endpoints (Optional v1)
**File**: `backend/server.js`

**Sub-tasks:**
1. GET /api/portfolio/templates
   - Return predefined portfolio templates
   - E.g., "Tech 10", "Diversified 10"

2. POST /api/portfolio/validate
   - Validate portfolio config before running
   - Check stock existence, date ranges

**Acceptance Criteria:**
- ✅ Templates easily selectable
- ✅ Validation prevents errors

---

### Phase 3: Frontend

#### Task 3.1: Create PortfolioBacktest.js Component
**File**: `frontend/src/components/PortfolioBacktest.js`

**Sub-tasks:**
1. Create portfolio configuration form
   - Total capital input ($500,000)
   - Lot size input ($10,000)
   - Max lots per stock (10)
   - Date range pickers

2. Create stock selection interface
   - Multi-select dropdown or checkboxes
   - Default to 10 popular stocks
   - Show stock names with symbols

3. Create common parameters section
   - All DCA parameters apply to all stocks
   - Collapsible advanced options

4. Add "Run Portfolio Backtest" button
   - POST to /api/portfolio-backtest
   - Show loading spinner
   - Navigate to results on success

**Acceptance Criteria:**
- ✅ Form validates inputs
- ✅ Easy to configure 10-stock portfolio
- ✅ Clear UX for capital allocation

---

#### Task 3.2: Create PortfolioResults.js Component
**File**: `frontend/src/components/PortfolioResults.js`

**Sub-tasks:**
1. Create PortfolioSummary section
   - Performance cards (Total Return, CAGR, Sharpe, Max Drawdown)
   - Capital utilization gauge/progress bar
   - Rejected orders badge (if any)

2. Create CapitalUtilizationChart
   - Line chart showing deployed vs available capital
   - Utilization % overlay
   - Highlight rejected order dates

3. Create StockAllocationTable
   - Sortable table with columns:
     - Symbol, Lots Held, Capital Deployed, Market Value
     - Unrealized P&L, Realized P&L, Total P&L
     - Return %, CAGR, Contribution %
   - Click row to expand transaction history

4. Create RejectedOrdersLog (if applicable)
   - Table of all rejected orders
   - Show date, symbol, price, available capital, shortfall
   - Highlight impact on portfolio

5. Create PortfolioCharts section
   - Portfolio value over time (line chart)
   - Per-stock contribution (pie chart)
   - Drawdown chart

**Acceptance Criteria:**
- ✅ All metrics displayed clearly
- ✅ Charts render correctly
- ✅ Interactive elements work (sorting, expanding)

---

#### Task 3.3: Add Navigation and Routing
**Files**: `frontend/src/App.js`, routing config

**Sub-tasks:**
1. Add "Portfolio Backtest" nav item
2. Add route: /portfolio-backtest
3. Add route: /portfolio-backtest/results

**Acceptance Criteria:**
- ✅ Navigation works smoothly
- ✅ Results accessible via direct URL

---

### Phase 4: Testing

#### Task 4.1: Unit Tests
**Files**: `backend/services/*.test.js`

**Test Cases:**
1. PortfolioState maintains capital constraints
2. Rejected order logging works correctly
3. Metrics calculations are accurate
4. Per-stock P&L sums to portfolio P&L

**Run:**
```bash
npm test -- portfolioBacktestService.test.js
npm test -- portfolioMetricsService.test.js
```

---

#### Task 4.2: Integration Tests
**File**: `backend/integration/portfolio.test.js`

**Test Scenarios:**
1. 10-stock portfolio with $500K capital
   - Verify capital never exceeded
   - Verify all stocks processed
   - Verify metrics accuracy

2. Edge case: High capital utilization
   - Start with $100K capital
   - 10 stocks, each wants to buy
   - Verify only first N stocks succeed
   - Verify rejected orders logged

3. Comparison test: Individual vs Portfolio
   - Run TSLA individually
   - Run TSLA in 10-stock portfolio
   - Compare transactions when capital unlimited

**Run:**
```bash
npm test -- portfolio.integration.test.js
```

---

#### Task 4.3: Manual Testing
**Test Plan:**

1. **Happy Path**
   - Configure 10 stocks, $500K capital
   - Run backtest (2021-2025)
   - Verify results display correctly
   - Export CSV, verify format

2. **Capital Constraint Testing**
   - Configure $50K capital (tight)
   - Verify rejected orders appear
   - Check rejected orders log
   - Verify capital utilization chart

3. **Performance Testing**
   - 10 stocks, 4-year backtest
   - Measure completion time (target < 30s)
   - Check UI responsiveness

4. **Edge Cases**
   - Single stock in portfolio mode
   - Maximum capital ($10M)
   - Minimum capital ($10K)
   - Missing price data for one stock

---

### Phase 5: Documentation

#### Task 5.1: User Documentation
**File**: `docs/portfolio-backtest.md`

**Contents:**
1. Overview of portfolio mode
2. How to configure a portfolio
3. Understanding portfolio metrics
4. Interpreting rejected orders
5. Example walkthroughs
6. FAQ

---

#### Task 5.2: API Documentation
**File**: `docs/api/portfolio-endpoints.md`

**Contents:**
1. POST /api/portfolio-backtest
   - Request schema
   - Response schema
   - Example requests/responses

2. Error codes and handling

---

### Phase 6: Deployment

#### Task 6.1: Database Migrations (Optional for v1)
**File**: `migrations/add-portfolio-tables.sql`

If storing portfolio configs:
```sql
CREATE TABLE portfolio_configs (...);
CREATE TABLE portfolio_stocks (...);
CREATE TABLE portfolio_results (...);
```

---

#### Task 6.2: Environment Configuration
**File**: `.env`

Add if needed:
```
MAX_PORTFOLIO_STOCKS=20
PORTFOLIO_BACKTEST_TIMEOUT=60000
```

---

## Implementation Order

### Sprint 1: Core Backend (Tasks 1.1-1.3)
**Goal**: Working portfolio backtest engine

**Deliverables**:
- portfolioBacktestService.js complete
- Integration with dcaBacktestService
- portfolioMetricsService.js complete
- Unit tests passing

**Time Estimate**: 2-3 days

---

### Sprint 2: API Layer (Tasks 2.1-2.2)
**Goal**: Portfolio backtest accessible via API

**Deliverables**:
- POST /api/portfolio-backtest endpoint
- Validation and error handling
- API tests passing

**Time Estimate**: 1 day

---

### Sprint 3: Frontend Components (Tasks 3.1-3.3)
**Goal**: Complete UI for portfolio backtesting

**Deliverables**:
- PortfolioBacktest.js form
- PortfolioResults.js display
- All charts and tables
- Navigation integrated

**Time Estimate**: 3-4 days

---

### Sprint 4: Testing & Polish (Tasks 4.1-4.3)
**Goal**: Stable, tested feature

**Deliverables**:
- All unit tests passing
- Integration tests passing
- Manual test plan completed
- Bugs fixed

**Time Estimate**: 2 days

---

### Sprint 5: Documentation (Tasks 5.1-5.2)
**Goal**: Feature documented and ready for users

**Deliverables**:
- User guide complete
- API docs complete
- Example portfolio configs

**Time Estimate**: 1 day

---

**Total Estimate**: 9-11 days of development

---

## Testing Checklist

Before marking complete, verify:

- [ ] Capital constraint maintained at all times
- [ ] Rejected orders logged correctly
- [ ] Portfolio CAGR matches manual calculation
- [ ] Sum of stock P&L = portfolio P&L
- [ ] Capital utilization chart displays correctly
- [ ] Rejected orders log shows all events
- [ ] Per-stock metrics accurate
- [ ] Contribution percentages sum to 100%
- [ ] CSV export works
- [ ] 10-stock backtest completes in < 30s
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Documentation complete

---

## Success Metrics

### Functional
- Portfolio backtest runs successfully with 10 stocks
- Capital constraints never violated
- All metrics calculated correctly

### Performance
- 10-stock, 4-year backtest completes in < 30 seconds
- UI remains responsive during backtest

### User Experience
- Configuration form intuitive and clear
- Results display comprehensive yet readable
- Rejected orders easily understood

---

## Future Enhancements (Post-v1)

1. **Portfolio Optimization**
   - Suggest optimal stock weights
   - Risk parity allocation
   - Factor exposure balancing

2. **Dynamic Rebalancing**
   - Auto-rebalance to target weights
   - Threshold-based rebalancing
   - Calendar-based rebalancing

3. **Risk Management**
   - Position size limits per stock
   - Sector concentration limits
   - Correlation-aware allocation

4. **Advanced Analytics**
   - Portfolio attribution analysis
   - Risk decomposition
   - Factor exposure tracking

5. **Saved Portfolios**
   - Save/load portfolio configurations
   - Portfolio templates library
   - Clone and modify existing portfolios

---

## Code Review Checklist

Before submitting PR:

- [ ] Code follows project style guide
- [ ] All functions have JSDoc comments
- [ ] Complex logic has inline comments
- [ ] No console.log statements (use logger)
- [ ] Error handling comprehensive
- [ ] No magic numbers (use constants)
- [ ] Tests cover edge cases
- [ ] No breaking changes to existing features
- [ ] Performance acceptable
- [ ] Memory leaks checked

---

## Deployment Checklist

Before deploying to production:

- [ ] All tests passing in CI/CD
- [ ] Database migrations run successfully
- [ ] Environment variables configured
- [ ] Documentation deployed
- [ ] Example configurations tested
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
- [ ] User notification prepared

---

## Summary

This implementation adds portfolio-based capital management to the DCA backtest system, enabling realistic simulation of multi-stock portfolios with shared capital constraints. The key innovation is tracking capital utilization and rejected orders, providing insights into real-world portfolio management challenges.

**Next Step**: Begin Sprint 1 - implement portfolioBacktestService.js core logic.
