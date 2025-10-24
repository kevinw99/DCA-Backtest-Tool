# Tasks: Portfolio Charts Aligned Layout

## Phase 1: Data Preprocessing Layer

### Task 1.1: Create Chart Data Processor Service
- [ ] Create `frontend/src/services/chartDataProcessor.js`
- [ ] Implement `generateTradingDays(startDate, endDate)` function
  - Generate array of all trading days in range
  - Handle weekends and market holidays
- [ ] Implement `alignDataToDates(data, masterDates)` function
  - Map data points to master date array
  - Fill gaps with null values to maintain line continuity
- [ ] Implement `preprocessPortfolioChartData(portfolioData, startDate, endDate)` function
  - Generate master dates array
  - Process normalized price data
  - Process performance comparison data
  - Process capital deployment data
  - Return unified data structure
- [ ] Add unit tests for date alignment logic

### Task 1.2: Test Data Preprocessing
- [ ] Test with sample portfolio data
- [ ] Verify date alignment across different data sources
- [ ] Test edge cases (gaps, different start dates per stock)
- [ ] Verify performance with large datasets

## Phase 2: Shared Configuration

### Task 2.1: Create Shared Chart Configuration
- [ ] Create `frontend/src/components/charts/SharedChartConfig.js`
- [ ] Define `SHARED_CHART_CONFIG` object
  - syncId for chart synchronization
  - Common margin settings
  - X-axis configuration
  - Tooltip configuration
  - Color schemes
- [ ] Implement `getChartMargin(isLastChart)` helper
- [ ] Implement date formatter function
- [ ] Export reusable chart utilities

## Phase 3: Container Component

### Task 3.1: Create AlignedChartsContainer Component
- [ ] Create `frontend/src/components/portfolio/AlignedChartsContainer.js`
- [ ] Create `frontend/src/components/portfolio/AlignedChartsContainer.css`
- [ ] Implement container component structure
  - Accept chartData and parameters props
  - Define charts array with metadata
  - Map over charts to render stacked layout
  - Pass shared configuration to each chart
- [ ] Implement CSS for vertical stacking
  - Flexbox layout
  - No gaps between charts for visual continuity
  - Proper spacing between chart sections
  - Responsive width handling
- [ ] Add PropTypes validation

## Phase 4: Individual Chart Components

### Task 4.1: Update NormalizedPriceChart
- [ ] Update `frontend/src/components/portfolio/charts/NormalizedPriceChart.js`
- [ ] Accept new props: syncId, showXAxis, margin, xAxisConfig
- [ ] Implement legend toggle state management
  - Track visibility for each stock
  - Track visibility for transaction types
- [ ] Implement legend click handler
- [ ] Apply shared configuration
- [ ] Conditionally render X-axis based on showXAxis prop
- [ ] Update to use preprocessed data format
- [ ] Add transaction markers as scatter plots
- [ ] Test legend toggle functionality

### Task 4.2: Update PerformanceComparisonChart
- [ ] Update `frontend/src/components/portfolio/charts/PerformanceComparisonChart.js`
- [ ] Accept new props: syncId, showXAxis, margin, xAxisConfig
- [ ] Implement legend toggle for DCA vs Buy & Hold
- [ ] Apply shared configuration
- [ ] Conditionally render X-axis
- [ ] Update to use preprocessed data format
- [ ] Ensure Y-axis shows appropriate scale ($ or %)
- [ ] Test toggle functionality

### Task 4.3: Update CapitalDeploymentChart
- [ ] Update `frontend/src/components/portfolio/charts/CapitalDeploymentChart.js`
- [ ] Accept new props: syncId, showXAxis, margin, xAxisConfig
- [ ] Implement stacked area chart or bar chart
- [ ] Implement legend toggle for individual stocks
- [ ] Apply shared configuration
- [ ] Conditionally render X-axis
- [ ] Update to use preprocessed data format
- [ ] Test toggle functionality

### Task 4.4: Handle Other Existing Charts
- [ ] Identify all other portfolio charts in current implementation
- [ ] For each chart:
  - [ ] Update to accept shared configuration props
  - [ ] Update to use preprocessed data
  - [ ] Implement legend toggle if applicable
  - [ ] Conditionally render X-axis
- [ ] Remove "Total Portfolio Value" chart component

## Phase 5: Integration

### Task 5.1: Update PortfolioResults Component
- [ ] Read existing `frontend/src/components/PortfolioResults.js`
- [ ] Import AlignedChartsContainer
- [ ] Import chartDataProcessor
- [ ] Add useMemo hook to preprocess chart data
- [ ] Replace individual chart components with AlignedChartsContainer
- [ ] Remove TotalPortfolioValueChart from render
- [ ] Update PropTypes if needed
- [ ] Verify no breaking changes to other functionality

### Task 5.2: Update CSS Styling
- [ ] Update `frontend/src/components/PortfolioResults.css`
- [ ] Ensure AlignedChartsContainer integrates well with page layout
- [ ] Adjust spacing and margins as needed
- [ ] Verify responsive behavior
- [ ] Test on different screen sizes

## Phase 6: Testing & Refinement

### Task 6.1: Visual Alignment Testing
- [ ] Run portfolio backtest with multiple stocks
- [ ] Verify x-axis alignment across all charts
  - Add vertical gridlines for visual verification
  - Check that dates line up pixel-perfect
- [ ] Test with different date ranges
- [ ] Test with different numbers of stocks

### Task 6.2: Interaction Testing
- [ ] Test legend toggles on each chart
  - Verify individual stock visibility toggles
  - Verify transaction marker toggles
  - Verify strategy comparison toggles
- [ ] Test hover synchronization
  - Hover over one chart
  - Verify cursor appears on all charts at same x-position
  - Verify tooltips show correct data
- [ ] Test responsive behavior
  - Resize browser window
  - Test on tablet size
  - Test on mobile size

### Task 6.3: Data Integrity Testing
- [ ] Verify no data loss during preprocessing
- [ ] Compare original data with displayed data
- [ ] Test edge cases:
  - Stocks with different start dates
  - Stocks with data gaps
  - Very short date ranges (< 1 month)
  - Very long date ranges (> 5 years)
  - Large portfolios (20+ stocks)

### Task 6.4: Performance Testing
- [ ] Test rendering performance with large dataset
  - 20 stocks over 5 years
  - Measure initial render time (target: < 500ms)
  - Measure interaction response time (target: < 100ms)
- [ ] Profile React component renders
- [ ] Optimize if needed:
  - Add React.memo where appropriate
  - Optimize data preprocessing
  - Consider data downsampling for very large datasets

### Task 6.5: Cross-browser Testing
- [ ] Test on Chrome
- [ ] Test on Firefox
- [ ] Test on Safari
- [ ] Test on Edge
- [ ] Verify consistent behavior across all browsers

## Phase 7: Documentation & Cleanup

### Task 7.1: Update Documentation
- [ ] Add JSDoc comments to new components
- [ ] Add JSDoc comments to new service functions
- [ ] Update any relevant README sections
- [ ] Document new props and data structures

### Task 7.2: Code Cleanup
- [ ] Remove unused code from old chart implementations
- [ ] Remove "Total Portfolio Value" chart file if standalone
- [ ] Clean up any console.logs or debug code
- [ ] Ensure consistent code style
- [ ] Run linter and fix any issues

### Task 7.3: Final Testing
- [ ] Run full regression test suite
- [ ] Test complete portfolio backtest flow
- [ ] Verify all existing functionality still works
- [ ] Test error handling (no data, API errors, etc.)

## Phase 8: Deployment

### Task 8.1: Create Git Commit
- [ ] Stage all changes
- [ ] Create descriptive commit message
- [ ] Include before/after screenshots if applicable

### Task 8.2: User Acceptance Testing
- [ ] Demo new layout to user
- [ ] Gather feedback
- [ ] Make adjustments if needed

## Estimated Timeline

- Phase 1: Data Preprocessing - 2-3 hours
- Phase 2: Shared Configuration - 1 hour
- Phase 3: Container Component - 1-2 hours
- Phase 4: Individual Charts - 3-4 hours
- Phase 5: Integration - 1-2 hours
- Phase 6: Testing & Refinement - 2-3 hours
- Phase 7: Documentation - 1 hour
- Phase 8: Deployment - 0.5 hour

**Total Estimated Time: 11.5-16.5 hours**

## Dependencies

- React (existing)
- Recharts library (existing)
- date-fns for date manipulation (may need to add)

## Rollback Plan

If issues arise:
1. Keep old chart components as backup
2. Use feature flag to toggle between old/new layout
3. Can revert commit if needed
4. Preprocessor service is isolated and won't affect other features
