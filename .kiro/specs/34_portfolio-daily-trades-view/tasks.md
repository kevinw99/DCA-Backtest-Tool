# Tasks: Portfolio Daily Trades View

## Implementation Checklist

### Phase 1: Component Foundation

- [ ] **Task 1.1: Create DailyTradesView Component**
  - File: `frontend/src/components/DailyTradesView.js`
  - Implement basic component structure with props interface
  - Add data aggregation logic (flatten, group by date, calculate metrics)
  - Add running cash balance calculation
  - Implement state management (expandedDate, sortOrder, filters)
  - Add helper functions for formatting (currency, dates)
  - **Estimated:** 3 hours

- [ ] **Task 1.2: Create DailyTradesView Styling**
  - File: `frontend/src/components/DailyTradesView.css`
  - Style main section container
  - Style controls area (filters, sort toggles)
  - Style summary table (header, rows, cells)
  - Add color coding (positive/negative, buy/sell)
  - Implement hover and expanded states
  - Add responsive breakpoints for mobile
  - **Estimated:** 2 hours

- [ ] **Task 1.3: Implement Summary Row Component**
  - Create `DailyTradeSummaryRow` subcomponent
  - Display: date, trade counts, cash flows, cash positions
  - Add expand/collapse icon with click handler
  - Apply conditional styling based on net cash flow
  - **Estimated:** 1 hour

### Phase 2: Detail View Implementation

- [ ] **Task 2.1: Implement Expanded Detail View**
  - Create `DailyTradeDetailView` subcomponent
  - Display transaction table with all trades for the date
  - Show: symbol, type, price, quantity, value, P&L
  - Apply color coding for transaction types
  - Add smooth expand/collapse animation
  - **Estimated:** 2 hours

- [ ] **Task 2.2: Add Sorting and Filtering Controls**
  - Implement sort order toggle (ascending/descending dates)
  - Add transaction type filter (all/buys/sells)
  - Add stock symbol multi-select filter (optional)
  - Update UI to reflect active filters
  - Persist filter state in component state
  - **Estimated:** 2 hours

### Phase 3: Integration and Polish

- [ ] **Task 3.1: Integrate with PortfolioResults**
  - File: `frontend/src/components/PortfolioResults.js`
  - Import `DailyTradesView` component
  - Add new section after "Stock Performance Breakdown"
  - Pass required props: `stockResults`, `portfolioSummary`, `portfolioRunId`, `parameters`
  - Add section header with icon and description
  - **Estimated:** 1 hour

- [ ] **Task 3.2: Handle Edge Cases**
  - Add empty state when no trades exist
  - Handle missing transaction fields gracefully (default values)
  - Validate cash calculation accuracy
  - Handle aborted transactions (filter them out)
  - Add loading state if needed
  - **Estimated:** 1 hour

- [ ] **Task 3.3: Optimize Performance**
  - Add `useMemo` for data aggregation
  - Add `useCallback` for event handlers
  - Test with large portfolios (500+ transactions)
  - Consider virtualization if scrolling is slow (react-window)
  - Profile component render performance
  - **Estimated:** 1.5 hours

### Phase 4: Testing and Validation

- [ ] **Task 4.1: Unit Testing**
  - Test data aggregation logic
    - Verify transactions grouped by date correctly
    - Verify daily metrics calculated accurately
    - Verify cash flow calculations are correct
  - Test edge cases
    - Empty transaction list
    - Missing P&L values
    - Dates with single transaction
  - **Estimated:** 2 hours

- [ ] **Task 4.2: Integration Testing**
  - Test with real portfolio backtest data
  - Verify all trades from stockResults appear in daily view
  - Verify cash before/after matches expected values
  - Test expand/collapse functionality
  - Test sorting (ascending/descending)
  - Test filtering (type, stocks)
  - **Estimated:** 1.5 hours

- [ ] **Task 4.3: Manual Testing Scenarios**
  - Small portfolio (3 stocks, 10 trades)
  - Medium portfolio (10 stocks, 100 trades)
  - Large portfolio (50 stocks, 1000+ trades)
  - Portfolio with only buys
  - Portfolio with only sells
  - Portfolio with mixed transactions
  - Test on different browsers (Chrome, Firefox, Safari)
  - Test responsive design on mobile/tablet
  - **Estimated:** 2 hours

### Phase 5: Accessibility and Documentation

- [ ] **Task 5.1: Accessibility Improvements**
  - Add ARIA labels to expand/collapse buttons
  - Add role attributes to table elements
  - Test keyboard navigation (Tab, Enter, Space, Arrow keys)
  - Test with screen reader (VoiceOver on macOS)
  - Ensure color contrast meets WCAG AA standards
  - Add focus indicators for keyboard navigation
  - **Estimated:** 1.5 hours

- [ ] **Task 5.2: Documentation**
  - Add JSDoc comments to component functions
  - Document props interface with PropTypes or TypeScript
  - Add README section explaining the feature
  - Update user guide if one exists
  - Add inline code comments for complex logic
  - **Estimated:** 1 hour

### Phase 6: Final Review and Deployment

- [ ] **Task 6.1: Code Review**
  - Self-review code for best practices
  - Check for console warnings/errors
  - Verify no unused imports or variables
  - Ensure consistent code style
  - Run linter if configured
  - **Estimated:** 0.5 hours

- [ ] **Task 6.2: Cross-Browser Testing**
  - Test on Chrome (latest)
  - Test on Firefox (latest)
  - Test on Safari (latest)
  - Test on Edge (latest)
  - Fix any browser-specific issues
  - **Estimated:** 1 hour

- [ ] **Task 6.3: User Acceptance Testing**
  - Demo feature to stakeholders
  - Gather feedback on UX/UI
  - Make adjustments based on feedback
  - Verify all requirements met
  - **Estimated:** 1 hour

## Optional Enhancements (Post-MVP)

- [ ] **Enhancement 1: Export to CSV**
  - Add "Export" button to download daily trades as CSV
  - Format data for Excel compatibility
  - **Estimated:** 2 hours

- [ ] **Enhancement 2: Date Range Filter**
  - Add date picker for start/end date filtering
  - Update view to show only trades within range
  - **Estimated:** 2 hours

- [ ] **Enhancement 3: Summary Statistics**
  - Add aggregate row showing totals across all days
  - Show: total trades, total buys, total sells, net cash flow
  - **Estimated:** 1 hour

- [ ] **Enhancement 4: Daily Chart Visualization**
  - Add mini-chart showing cash flow over time
  - Integrate with existing chart library (Recharts)
  - **Estimated:** 3 hours

- [ ] **Enhancement 5: Backend Aggregation**
  - Move aggregation logic to backend for large portfolios
  - Create new endpoint: `/api/portfolio-backtest/daily-trades`
  - Update frontend to fetch from API
  - **Estimated:** 4 hours

## Dependencies and Blockers

**Blockers:**
- None (all required data already available)

**Dependencies:**
- Existing portfolio backtest results structure
- Transaction data in `stockResults` array
- Portfolio summary data for initial capital

**Optional Dependencies:**
- `react-window` (if virtualization needed for large datasets)
- Date picker library (if date range filter added)

## Testing Checklist

### Functional Tests
- [ ] Daily trades display in chronological order
- [ ] Only days with trades are shown (no empty days)
- [ ] Cash before/after calculations are accurate
- [ ] Net cash flow matches (sells - buys)
- [ ] Daily P&L sums all sell profits correctly
- [ ] Expand/collapse works for all rows
- [ ] Sort order toggle works (asc/desc)
- [ ] Transaction type filter works (all/buys/sells)
- [ ] Stock filter works (multi-select)
- [ ] Color coding applied correctly (positive=green, negative=red)

### Edge Case Tests
- [ ] Portfolio with no trades shows empty state
- [ ] Portfolio with 1 trade displays correctly
- [ ] Portfolio with 1000+ trades performs well
- [ ] Missing P&L values handled gracefully (default to 0)
- [ ] Missing shares/value calculated from available data
- [ ] Aborted transactions filtered out
- [ ] Dates formatted correctly (YYYY-MM-DD or localized)

### UI/UX Tests
- [ ] Table is readable and columns aligned
- [ ] Mobile view is usable (responsive design)
- [ ] Hover states provide feedback
- [ ] Expanded rows visually distinct from collapsed
- [ ] Icons are clear and intuitive
- [ ] Color coding is not the only indicator (accessible to colorblind)

### Performance Tests
- [ ] Component loads in <1 second with 100 trades
- [ ] Component loads in <3 seconds with 1000 trades
- [ ] Expanding a row is instant (<100ms)
- [ ] Sorting/filtering updates in <500ms
- [ ] No memory leaks when expanding/collapsing multiple times

### Accessibility Tests
- [ ] Can navigate table with keyboard only
- [ ] Expand/collapse works with Enter/Space keys
- [ ] Screen reader announces row count
- [ ] Screen reader announces expand/collapse state
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Focus indicators visible for all interactive elements

## Acceptance Criteria

✅ **Feature Complete When:**

1. User can view all trades aggregated by date in a table
2. User can see cash position (before/after) for each trading day
3. User can expand any date row to see individual transaction details
4. User can sort dates in ascending or descending order
5. User can filter by transaction type (all/buys/sells)
6. Design is consistent with existing portfolio UI
7. View performs well with portfolios of 500+ transactions
8. Component is accessible via keyboard and screen reader
9. All edge cases handled gracefully (empty state, missing data)
10. Code is documented with JSDoc comments
11. Manual testing completed across all scenarios
12. No console errors or warnings

## Time Estimate Summary

| Phase | Estimated Time |
|-------|---------------|
| Phase 1: Component Foundation | 6 hours |
| Phase 2: Detail View | 4 hours |
| Phase 3: Integration | 3.5 hours |
| Phase 4: Testing | 5.5 hours |
| Phase 5: Accessibility & Docs | 2.5 hours |
| Phase 6: Review & Deployment | 2.5 hours |
| **Total** | **24 hours** |

**Note:** This is a conservative estimate including testing and documentation. Actual implementation may be faster depending on familiarity with the codebase.

## Next Steps

1. Review requirements and design documents
2. Clarify any open questions with stakeholders
3. Begin Phase 1: Component Foundation
4. Implement incrementally and test continuously
5. Gather feedback early and adjust as needed
