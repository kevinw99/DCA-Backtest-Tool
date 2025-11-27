# Portfolio Backtest UI - Implementation Tasks

## Overview

Implementation broken into 4 sprints focusing on incremental delivery:
1. **Sprint 1**: Core form and basic API integration
2. **Sprint 2**: Results visualization components
3. **Sprint 3**: Interactive features and drill-down
4. **Sprint 4**: Polish, testing, and deployment

---

## Sprint 1: Core Form and API Integration (2-3 days)

### Task 1.1: Create StockSelector Component
**Estimate**: 3 hours

**Subtasks**:
- [ ] Create `/frontend/src/components/StockSelector.js`
- [ ] Implement multi-select chip UI with checkboxes/chips
- [ ] Add custom symbol input field with validation
- [ ] Implement add/remove stock functionality
- [ ] Add selected stock count display
- [ ] Style with CSS (chip-based design)
- [ ] Test with various stock selections

**Acceptance Criteria**:
- Can select multiple stocks via clicking chips
- Can add custom symbols (uppercase auto-conversion)
- Shows visual feedback for selected stocks
- Displays count of selected stocks

---

### Task 1.2: Create PortfolioBacktestForm Component
**Estimate**: 4 hours

**Subtasks**:
- [ ] Create `/frontend/src/components/PortfolioBacktestForm.js`
- [ ] Build form layout with sections:
  - Capital Settings (totalCapital, lotSizeUsd, maxLotsPerStock)
  - Stock Selection (integrate StockSelector)
  - Date Range (startDate, endDate)
  - DCA Parameters (gridIntervalPercent, profitRequirement, stopLossPercent, trailing stops)
- [ ] Implement controlled form inputs with state management
- [ ] Add form validation logic
- [ ] Display validation errors inline
- [ ] Add Reset and Submit buttons
- [ ] Style with existing CSS patterns

**Acceptance Criteria**:
- All form fields update state correctly
- Validation prevents invalid submissions
- Error messages display clearly
- Form resets to defaults on Reset click
- Form layout is intuitive and organized

---

### Task 1.3: Create PortfolioBacktestPage Container
**Estimate**: 3 hours

**Subtasks**:
- [ ] Create `/frontend/src/components/PortfolioBacktestPage.js`
- [ ] Set up state management (parameters, results, loading, error)
- [ ] Implement API call to `POST /api/portfolio-backtest`
- [ ] Handle loading states and errors
- [ ] Integrate PortfolioBacktestForm
- [ ] Add tab navigation (Parameters, Results)
- [ ] Implement localStorage persistence
- [ ] Add basic error display

**Acceptance Criteria**:
- Page mounts with default parameters
- Form submission triggers API call
- Loading indicator shows during API call
- Error messages display on API failure
- Results stored in state on success
- Tab navigation works

---

### Task 1.4: URL Parameter Support
**Estimate**: 2 hours

**Subtasks**:
- [ ] Implement URL parameter encoding
- [ ] Parse URL parameters on page load
- [ ] Auto-populate form from URL parameters
- [ ] Update URL when parameters change
- [ ] Support auto-run with `?run=true`

**Acceptance Criteria**:
- URL contains all portfolio configuration
- Opening URL pre-fills form correctly
- URL updates when form changes (without reload)
- `?run=true` triggers automatic backtest execution

---

### Task 1.5: Add Route to App.js
**Estimate**: 1 hour

**Subtasks**:
- [ ] Add `/portfolio-backtest` route in App.js
- [ ] Add navigation link in app header/menu
- [ ] Style navigation link (active state)
- [ ] Test navigation between pages

**Acceptance Criteria**:
- Can navigate to /portfolio-backtest via menu
- Route renders PortfolioBacktestPage
- Navigation link shows active state
- Browser back/forward buttons work

---

## Sprint 2: Results Visualization (3-4 days)

### Task 2.1: Create PortfolioSummaryCard Component
**Estimate**: 3 hours

**Subtasks**:
- [ ] Create `/frontend/src/components/PortfolioSummaryCard.js`
- [ ] Build metric box layout (grid of summary metrics)
- [ ] Display portfolio-level metrics:
  - Total Capital, Final Portfolio Value, Total Return
  - CAGR, Max Drawdown, Sharpe Ratio
  - Total Trades, Win Rate
  - Capital Utilization, Rejected Buys
- [ ] Add icons for each metric (lucide-react)
- [ ] Color-code positive/negative values
- [ ] Highlight rejected buys if > 0
- [ ] Style with card layout

**Acceptance Criteria**:
- All portfolio metrics display correctly
- Positive/negative values color-coded
- Layout is clean and scannable
- Metrics update when results change

---

### Task 2.2: Create StockPerformanceTable Component
**Estimate**: 4 hours

**Subtasks**:
- [ ] Create `/frontend/src/components/StockPerformanceTable.js`
- [ ] Build table with columns:
  - Symbol, Lots Held, Capital Deployed, Market Value
  - Total P&L, Return %, CAGR, Contribution
  - Total Buys, Total Sells, Rejected Buys
- [ ] Implement sortable columns (click header to sort)
- [ ] Add sort indicators (▲▼)
- [ ] Color-code P&L values
- [ ] Style table with hover effects

**Acceptance Criteria**:
- Table displays all stock performance data
- Clicking column headers sorts table
- Sort direction toggles on repeated clicks
- P&L values color-coded (green/red)

---

### Task 2.3: Create CapitalUtilizationChart Component
**Estimate**: 3 hours

**Subtasks**:
- [ ] Create `/frontend/src/components/CapitalUtilizationChart.js`
- [ ] Implement Recharts ComposedChart
- [ ] Add lines for:
  - Deployed Capital ($) - left Y-axis
  - Cash Reserve ($) - left Y-axis
  - Utilization Percent (%) - right Y-axis
- [ ] Add legend with checkboxes to toggle lines
- [ ] Implement custom tooltip
- [ ] Style chart with grid and axes

**Acceptance Criteria**:
- Chart displays capital utilization over time
- Dual Y-axes for dollar amounts and percentages
- Lines can be toggled on/off via legend
- Tooltip shows values on hover
- Chart is responsive

---

### Task 2.4: Create PortfolioValueChart Component
**Estimate**: 3 hours

**Subtasks**:
- [ ] Create `/frontend/src/components/PortfolioValueChart.js`
- [ ] Implement Recharts LineChart
- [ ] Plot portfolio value over time
- [ ] Add reference line for initial capital
- [ ] Add markers/dots for buy/sell events
- [ ] Implement custom tooltip (date, value, P&L, recent transactions)
- [ ] Color area under line (gradient for gains/losses)

**Acceptance Criteria**:
- Chart shows portfolio value trend
- Buy/sell events marked on chart
- Tooltip shows detailed information
- Reference line shows initial capital
- Chart is interactive and responsive

---

### Task 2.5: Create RejectedOrdersTable Component
**Estimate**: 2 hours

**Subtasks**:
- [ ] Create `/frontend/src/components/RejectedOrdersTable.js`
- [ ] Build table with columns:
  - Date, Symbol, Price, Lot Size
  - Available Capital, Shortfall, Utilization
- [ ] Add filter dropdown (all stocks, or specific symbol)
- [ ] Calculate and display summary (total rejected, total value)
- [ ] Add empty state for zero rejected orders
- [ ] Style with warning colors

**Acceptance Criteria**:
- Table lists all rejected orders
- Filter works to show specific stocks
- Summary shows total count and value
- Empty state shows when no rejections
- Shortfall amounts highlighted

---

### Task 2.6: Create PortfolioResults Component
**Estimate**: 2 hours

**Subtasks**:
- [ ] Create `/frontend/src/components/PortfolioResults.js`
- [ ] Integrate all visualization components:
  - PortfolioSummaryCard
  - CapitalUtilizationChart
  - PortfolioValueChart
  - StockPerformanceTable
  - RejectedOrdersTable
- [ ] Organize layout with sections
- [ ] Add section headers
- [ ] Pass data props to child components

**Acceptance Criteria**:
- All components render in organized layout
- Data flows correctly to all child components
- Sections have clear visual separation
- Layout is responsive

---

### Task 2.7: Integrate Results into PortfolioBacktestPage
**Estimate**: 1 hour

**Subtasks**:
- [ ] Import PortfolioResults in PortfolioBacktestPage
- [ ] Show PortfolioResults when results exist
- [ ] Switch to results tab after successful backtest
- [ ] Handle empty/null results state

**Acceptance Criteria**:
- Results display after successful backtest
- Tab automatically switches to results
- Results tab only shows when data exists

---

## Sprint 3: Interactive Features (2-3 days)

### Task 3.1: Implement Stock Detail Drill-Down
**Estimate**: 4 hours

**Subtasks**:
- [ ] Add expandable row functionality to StockPerformanceTable
- [ ] Create StockDetailView component (inline within table)
- [ ] Show transaction history table in expanded row:
  - Date, Type, Price, Quantity, Amount, P&L, Lots After
- [ ] Add expand/collapse icon (▶/▼)
- [ ] Track expanded stock in state
- [ ] Style expanded row differently

**Acceptance Criteria**:
- Clicking stock row expands to show details
- Transaction history displays in expanded view
- Only one stock expanded at a time
- Expand icon toggles on click
- Expanded view is visually distinct

---

### Task 3.2: Export Functionality
**Estimate**: 3 hours

**Subtasks**:
- [ ] Create utility function to export JSON
- [ ] Create utility function to export CSV (summary, stocks, transactions, rejected orders)
- [ ] Add export buttons to PortfolioResults
- [ ] Implement file download (blob URL)
- [ ] Add export icons and labels

**Acceptance Criteria**:
- Can export full results as JSON
- Can export summary metrics as CSV
- Can export transaction history as CSV
- Can export rejected orders as CSV
- Downloaded files have proper naming and formatting

---

### Task 3.3: Chart Interactions
**Estimate**: 2 hours

**Subtasks**:
- [ ] Add zoom functionality to charts (Recharts brush)
- [ ] Implement pan/scroll on charts
- [ ] Enhance tooltips with more context
- [ ] Add legend interactions (click to hide/show series)

**Acceptance Criteria**:
- Charts support zoom and pan
- Tooltips show comprehensive information
- Legend items can toggle series visibility

---

### Task 3.4: Form Presets/Templates
**Estimate**: 3 hours

**Subtasks**:
- [ ] Create preset configurations (e.g., "Conservative 4-Stock", "Aggressive 10-Stock")
- [ ] Add preset dropdown in form
- [ ] Implement load preset functionality
- [ ] Store custom presets in localStorage
- [ ] Add save current config as preset

**Acceptance Criteria**:
- Pre-defined presets available in dropdown
- Selecting preset populates form
- Can save current config as custom preset
- Custom presets persist in localStorage

---

## Sprint 4: Polish, Testing, Deployment (2-3 days)

### Task 4.1: Styling and Responsive Design
**Estimate**: 4 hours

**Subtasks**:
- [ ] Create `/frontend/src/styles/PortfolioBacktest.css`
- [ ] Refine all component styles for consistency
- [ ] Implement responsive breakpoints (desktop, tablet, mobile)
- [ ] Test on different screen sizes
- [ ] Ensure all text is readable
- [ ] Add hover effects and transitions
- [ ] Polish color scheme

**Acceptance Criteria**:
- UI looks polished and professional
- Responsive on desktop, tablet, mobile
- Colors and spacing are consistent
- Smooth transitions and animations

---

### Task 4.2: Error Handling Improvements
**Estimate**: 2 hours

**Subtasks**:
- [ ] Enhance validation error messages (more descriptive)
- [ ] Add error boundary component for React errors
- [ ] Implement retry mechanism for API failures
- [ ] Add user-friendly error messages
- [ ] Handle edge cases (empty data, network errors)

**Acceptance Criteria**:
- All error cases have clear messages
- User knows how to fix validation errors
- API errors include retry option
- App doesn't crash on unexpected errors

---

### Task 4.3: Loading States and UX Polish
**Estimate**: 2 hours

**Subtasks**:
- [ ] Add loading spinner during API call
- [ ] Add skeleton loaders for charts
- [ ] Add progress indicator if API takes > 3 seconds
- [ ] Add success notification after successful backtest
- [ ] Add smooth transitions between tabs
- [ ] Disable form during submission

**Acceptance Criteria**:
- Clear loading indicators during backtest
- Form disabled during submission
- Success feedback after completion
- Smooth transitions enhance UX

---

### Task 4.4: Accessibility Enhancements
**Estimate**: 3 hours

**Subtasks**:
- [ ] Add aria-labels to all interactive elements
- [ ] Ensure keyboard navigation works (Tab, Enter, Space)
- [ ] Test with screen reader
- [ ] Add focus indicators to all inputs
- [ ] Ensure color contrast meets WCAG AA
- [ ] Add skip links
- [ ] Test with keyboard-only navigation

**Acceptance Criteria**:
- All interactive elements accessible via keyboard
- Screen reader announces important changes
- Focus indicators visible on all inputs
- Color contrast passes WCAG AA
- Navigation possible without mouse

---

### Task 4.5: Documentation and Help Text
**Estimate**: 2 hours

**Subtasks**:
- [ ] Add inline help text for form fields (? icons)
- [ ] Add tooltips explaining metrics
- [ ] Create user guide section in UI (collapsible)
- [ ] Add examples of good configurations
- [ ] Document URL parameter format

**Acceptance Criteria**:
- Help text available for all fields
- Metrics have clear explanations
- User guide accessible in UI
- Examples help users get started

---

### Task 4.6: Component Testing
**Estimate**: 4 hours

**Subtasks**:
- [ ] Write unit tests for StockSelector
- [ ] Write unit tests for PortfolioBacktestForm validation
- [ ] Write component tests for PortfolioSummaryCard
- [ ] Write component tests for StockPerformanceTable
- [ ] Write integration test for full backtest flow
- [ ] Achieve > 80% code coverage

**Acceptance Criteria**:
- All major components have tests
- Form validation logic fully tested
- Integration test covers happy path
- Code coverage > 80%

---

### Task 4.7: End-to-End Testing
**Estimate**: 3 hours

**Subtasks**:
- [ ] Manual testing: Full backtest workflow
- [ ] Test with various stock combinations (2-10 stocks)
- [ ] Test with different capital amounts
- [ ] Test error scenarios (invalid stocks, API errors)
- [ ] Test URL parameter sharing
- [ ] Test export functionality
- [ ] Browser compatibility testing (Chrome, Firefox, Safari)

**Acceptance Criteria**:
- Full workflow works end-to-end
- All features function correctly
- No console errors in supported browsers
- URL sharing works
- Exports download correctly

---

### Task 4.8: Performance Testing
**Estimate**: 2 hours

**Subtasks**:
- [ ] Test with maximum stocks (10 stocks)
- [ ] Test with long date ranges (5+ years)
- [ ] Measure API response time
- [ ] Measure chart rendering time
- [ ] Optimize if any performance issues
- [ ] Add data pagination/virtualization if needed

**Acceptance Criteria**:
- API responds in < 10 seconds for 10 stocks
- Charts render in < 3 seconds
- UI remains responsive during data load
- No performance bottlenecks

---

### Task 4.9: Deployment Preparation
**Estimate**: 1 hour

**Subtasks**:
- [ ] Update README with portfolio backtest instructions
- [ ] Add feature to changelog
- [ ] Create demo configuration examples
- [ ] Prepare release notes
- [ ] Verify production build works

**Acceptance Criteria**:
- README includes portfolio backtest documentation
- Changelog updated
- Production build successful
- Demo configs ready

---

## Summary

### Total Estimated Time: 15-19 days

#### Sprint 1 (Core): 13 hours (1.5-2 days)
- StockSelector: 3h
- PortfolioBacktestForm: 4h
- PortfolioBacktestPage: 3h
- URL parameters: 2h
- Routing: 1h

#### Sprint 2 (Visualization): 17 hours (2-3 days)
- PortfolioSummaryCard: 3h
- StockPerformanceTable: 4h
- CapitalUtilizationChart: 3h
- PortfolioValueChart: 3h
- RejectedOrdersTable: 2h
- PortfolioResults: 2h

#### Sprint 3 (Interactivity): 12 hours (1.5-2 days)
- Stock drill-down: 4h
- Export functionality: 3h
- Chart interactions: 2h
- Presets/templates: 3h

#### Sprint 4 (Polish): 22 hours (3-4 days)
- Styling and responsive: 4h
- Error handling: 2h
- Loading states: 2h
- Accessibility: 3h
- Documentation: 2h
- Component testing: 4h
- E2E testing: 3h
- Performance testing: 2h

**Total: 64 hours (8-10 working days at 6-8 hours/day)**

---

## Dependencies Between Tasks

```
Sprint 1 (Foundation):
  Task 1.1 (StockSelector) → Task 1.2 (Form) → Task 1.3 (Page) → Task 1.4 (URL) → Task 1.5 (Route)

Sprint 2 (Visualization):
  All Task 2.1-2.5 (components) → Task 2.6 (PortfolioResults) → Task 2.7 (Integration)

Sprint 3 (Interactivity):
  Requires Sprint 2 complete
  Tasks 3.1-3.4 can be done in parallel

Sprint 4 (Polish):
  Requires Sprint 1-3 complete
  Tasks 4.1-4.6 can be done in parallel
  Task 4.7-4.9 must be sequential
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| API response too slow for 10 stocks | Test early in Sprint 1; optimize backend if needed |
| Chart rendering performance issues | Implement data downsampling in Sprint 2 |
| Complex table interactions cause bugs | Thorough testing in Sprint 3 |
| Accessibility requirements not met | Dedicated Sprint 4 task with validation |
| Browser compatibility issues | Test early and often on target browsers |

---

## Definition of Done

For each task:
- [ ] Code written and follows project conventions
- [ ] Component tested (unit or integration test)
- [ ] Responsive design verified
- [ ] Error handling implemented
- [ ] Code reviewed (self-review minimum)
- [ ] Documentation updated (inline comments, README)
- [ ] No console errors or warnings
- [ ] Accessibility checked (keyboard, screen reader)

For the feature (Sprint 4 complete):
- [ ] All user stories from requirements.md satisfied
- [ ] All acceptance criteria met
- [ ] End-to-end testing passed
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Ready for production deployment
