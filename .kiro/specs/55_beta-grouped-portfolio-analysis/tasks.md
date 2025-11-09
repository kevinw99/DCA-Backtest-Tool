# Spec 55: Beta-Grouped Portfolio Analysis - Implementation Tasks

## Phase 1: Backend Implementation

### Task 1.1: Create betaGroupAnalysisService.js ⏱️ 2 hours
**Description**: Implement core service for beta grouping analysis

**Files to create**:
- `/Users/kweng/AI/DCA-Backtest-Tool/backend/services/betaGroupAnalysisService.js`

**Implementation checklist**:
- [ ] Define `BETA_RANGES` constant with 5 ranges (0-0.5, 0.5-1, 1-1.5, 1.5-2, >2)
- [ ] Implement `analyzeBetaGroups(stockResults)` main method
- [ ] Implement `_enrichWithBeta(stockResults)` to fetch beta values
  - Use existing `betaDataService` singleton
  - Handle missing beta (default to 1.0)
  - Add error handling for API failures
- [ ] Implement `_classifyByBetaRange(stocksWithBeta)` to group stocks
  - Match each stock to correct beta range
  - Return array of groups with stocks
- [ ] Implement `_aggregateGroupMetrics(groups)` to calculate performance
  - Total return % (weighted average)
  - Total return $ (sum)
  - CAGR %
  - Win rate %
  - Avg profit/loss per trade
  - Total trades count
  - Deployed capital
  - Profit factor
- [ ] Implement `_calculateSummary(stocksWithBeta, groups)` for summary stats
  - Avg/median/min/max beta
  - Best/worst performing groups
- [ ] Export as singleton: `module.exports = new BetaGroupAnalysisService()`

**Testing**:
```bash
# Unit test with sample data
node -e "
const service = require('./services/betaGroupAnalysisService');
const sampleStocks = [
  { symbol: 'AAPL', totalReturnPercent: 45.2, totalReturnDollar: 22600, deployedCapital: 50000, totalTrades: 12, winningTrades: 9 },
  { symbol: 'NVDA', totalReturnPercent: 85.5, totalReturnDollar: 42750, deployedCapital: 50000, totalTrades: 15, winningTrades: 12 }
];
service.analyzeBetaGroups(sampleStocks).then(result => {
  console.log('Groups:', result.groups.length);
  console.log('Summary:', result.summary);
});
"
```

**Success criteria**:
- Service returns object with `groups` and `summary`
- All 5 beta ranges present in groups
- Performance metrics calculated correctly
- Beta values fetched from Yahoo Finance (cached)

---

### Task 1.2: Integrate with portfolioBacktestService.js ⏱️ 1 hour
**Description**: Add beta grouping analysis to portfolio backtest results

**Files to modify**:
- `/Users/kweng/AI/DCA-Backtest-Tool/backend/services/portfolioBacktestService.js`

**Implementation checklist**:
- [ ] Import `betaGroupAnalysisService` at top of file
- [ ] Locate the final return statement in `runPortfolioBacktest()`
- [ ] Extract `stockResults` array with required fields:
  ```javascript
  const stockResults = portfolio.stocks.map(stock => ({
    symbol: stock.symbol,
    totalReturnPercent: stock.getTotalReturnPercent(),
    totalReturnDollar: stock.getTotalReturn(),
    deployedCapital: stock.capitalDeployed,
    totalTrades: stock.trades.length,
    winningTrades: stock.getWinningTradesCount(),
    totalProfit: stock.getTotalProfit(),
    totalLoss: stock.getTotalLoss()
  }));
  ```
- [ ] Call `betaGroupAnalysisService.analyzeBetaGroups(stockResults)`
- [ ] Add `betaGrouping` to response object
- [ ] Handle errors gracefully (log warning, return null for betaGrouping)

**Testing**:
```bash
# Test with curl
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "configPath": "configs/portfolios/nasdaq100.json"
  }' | jq '.data.betaGrouping.summary'

# Should output:
# {
#   "totalStocks": 105,
#   "avgBeta": 1.18,
#   "medianBeta": 1.09,
#   "minBeta": 0.13,
#   "maxBeta": 4.12,
#   "bestPerformingGroup": { ... },
#   "worstPerformingGroup": { ... }
# }
```

**Success criteria**:
- Portfolio backtest response includes `betaGrouping` object
- All 105 NASDAQ-100 stocks classified into beta groups
- Performance metrics match manual calculations
- No errors in server logs

---

### Task 1.3: Add Error Handling and Logging ⏱️ 30 minutes
**Description**: Ensure robust error handling for beta fetching failures

**Files to modify**:
- `/Users/kweng/AI/DCA-Backtest-Tool/backend/services/betaGroupAnalysisService.js`

**Implementation checklist**:
- [ ] Wrap `fetchBeta()` calls in try-catch
- [ ] Log warnings for failed beta fetches
- [ ] Track beta source statistics (yahoo_finance, fallback, default)
- [ ] Add timeout protection for beta fetching (max 30 seconds total)
- [ ] Return partial results if some betas fail

**Testing**:
```bash
# Test with simulated beta service failure
# (Temporarily break betaDataService to verify fallback)
```

**Success criteria**:
- Service continues working even if beta fetching fails
- Warnings logged for missing betas
- Default to beta=1.0 for unavailable stocks

---

## Phase 2: Frontend Implementation

### Task 2.1: Create BetaGroupAnalysis Component ⏱️ 3 hours
**Description**: Build main React component for beta grouping visualization

**Files to create**:
- `/Users/kweng/AI/DCA-Backtest-Tool/frontend/src/components/backtest/BetaGroupAnalysis.js`
- `/Users/kweng/AI/DCA-Backtest-Tool/frontend/src/components/backtest/BetaGroupAnalysis.css`

**Implementation checklist**:
- [ ] Create `BetaGroupAnalysis` main component
  - Accept `betaGrouping` prop
  - Handle null/missing data gracefully
- [ ] Create `BetaGroupSummary` subcomponent
  - Display total stocks, avg/median beta
  - Highlight best/worst performing groups
- [ ] Create `BetaGroupTable` subcomponent
  - Display all 5 beta ranges
  - Show stock count, return %, CAGR, win rate, deployed capital
  - Add color-coded border (left) per group
  - Sortable columns
  - "Details" button per row
- [ ] Create `BetaGroupCharts` subcomponent
  - Bar chart comparing return %, CAGR, win rate
  - Use recharts library
  - Color-coded bars matching group colors
- [ ] Create `BetaGroupDetail` subcomponent
  - Display when group selected
  - Show top 5 and bottom 5 performers
  - Display beta value per stock
  - Link to individual stock results

**CSS Styling**:
```css
.beta-group-analysis {
  margin: 20px 0;
  padding: 20px;
  background: #f9f9f9;
  border-radius: 8px;
}

.beta-group-table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
}

.beta-group-table tr {
  border-left: 4px solid transparent;
}

.beta-group-table th {
  text-align: left;
  padding: 12px;
  background: #e0e0e0;
}

.beta-group-table td {
  padding: 10px 12px;
}
```

**Testing**:
- [ ] Test component with full NASDAQ-100 data
- [ ] Test with empty groups (no stocks in range)
- [ ] Test group selection/detail view
- [ ] Test chart rendering
- [ ] Test responsive layout

**Success criteria**:
- Component renders without errors
- Table displays all 5 groups correctly
- Charts show performance comparison clearly
- Detail view opens when group selected
- Styling matches existing design system

---

### Task 2.2: Integrate with Portfolio Results Page ⏱️ 1 hour
**Description**: Add beta grouping section to portfolio results display

**Files to modify**:
- `/Users/kweng/AI/DCA-Backtest-Tool/frontend/src/pages/PortfolioResultsPage.js` (or equivalent)

**Implementation checklist**:
- [ ] Import `BetaGroupAnalysis` component
- [ ] Locate portfolio results rendering section
- [ ] Add conditional rendering:
  ```javascript
  {backtestData?.betaGrouping && (
    <div className="beta-analysis-section">
      <h2>Beta Group Analysis</h2>
      <BetaGroupAnalysis betaGrouping={backtestData.betaGrouping} />
    </div>
  )}
  ```
- [ ] Add toggle to show/hide beta analysis (optional)
- [ ] Position after portfolio summary, before stock details

**Testing**:
```bash
# Run portfolio backtest from frontend
# Navigate to http://localhost:3000/portfolio/results
# Verify beta analysis section appears
# Verify data matches backend response
```

**Success criteria**:
- Beta analysis section appears in results page
- Section only shown when `betaGrouping` data available
- Data correctly passed from API response to component
- Layout integrates well with existing results sections

---

### Task 2.3: Add Export to CSV Functionality ⏱️ 1 hour
**Description**: Allow users to export beta grouping data to CSV

**Files to modify**:
- `/Users/kweng/AI/DCA-Backtest-Tool/frontend/src/components/backtest/BetaGroupAnalysis.js`

**Implementation checklist**:
- [ ] Add "Export to CSV" button above table
- [ ] Implement `exportToCSV()` function:
  ```javascript
  function exportToCSV(groups) {
    const headers = ['Beta Range', 'Stocks', 'Return %', 'CAGR %', 'Win Rate %', 'Deployed Capital'];
    const rows = groups.map(g => [
      g.label,
      g.stockCount,
      g.performance?.totalReturnPercent || 'N/A',
      g.performance?.cagrPercent || 'N/A',
      g.performance?.winRate || 'N/A',
      g.performance?.deployedCapital || 'N/A'
    ]);
    // Generate CSV and trigger download
  }
  ```
- [ ] Format currency values properly
- [ ] Include summary stats in CSV
- [ ] Name file with timestamp: `beta-analysis-2025-11-09.csv`

**Testing**:
- [ ] Click "Export to CSV" button
- [ ] Verify CSV downloads correctly
- [ ] Open CSV in Excel/Sheets, verify formatting

**Success criteria**:
- CSV downloads successfully
- Data matches table display
- CSV opens correctly in spreadsheet apps
- Filename includes timestamp

---

## Phase 3: Testing & Validation

### Task 3.1: Backend Unit Tests ⏱️ 2 hours
**Description**: Write comprehensive unit tests for beta grouping service

**Files to create**:
- `/Users/kweng/AI/DCA-Backtest-Tool/backend/tests/betaGroupAnalysisService.test.js`

**Test cases**:
- [ ] Test `_enrichWithBeta()` with mock beta service
- [ ] Test `_classifyByBetaRange()` with edge cases (beta=0, beta=∞)
- [ ] Test `_aggregateGroupMetrics()` with various stock counts
- [ ] Test `_calculateSummary()` with empty groups
- [ ] Test error handling (beta fetch failures)
- [ ] Test performance (105 stocks should complete in <2 seconds)

**Success criteria**:
- All tests pass
- Code coverage >80%
- Performance targets met

---

### Task 3.2: Integration Testing with Real Data ⏱️ 1 hour
**Description**: Validate beta grouping with full NASDAQ-100 portfolio

**Testing steps**:
1. **Run portfolio backtest**:
   ```bash
   curl -X POST http://localhost:3001/api/backtest/portfolio \
     -H "Content-Type: application/json" \
     -d '{"configPath": "configs/portfolios/nasdaq100.json"}' \
     > /tmp/portfolio_beta_test.json
   ```

2. **Verify beta distribution**:
   ```bash
   node -e "
   const data = require('/tmp/portfolio_beta_test.json');
   const groups = data.data.betaGrouping.groups;
   groups.forEach(g => {
     console.log(\`\${g.label}: \${g.stockCount} stocks, Return: \${g.performance?.totalReturnPercent}%\`);
   });
   "
   ```

3. **Compare with analysis script**:
   ```bash
   # Run analyze_nasdaq100_beta.js
   node backend/analyze_nasdaq100_beta.js > /tmp/beta_standalone.log

   # Compare stock counts per range
   # Expected: 14, 22, 50, 13, 6
   ```

**Validation checklist**:
- [ ] All 105 stocks classified
- [ ] Stock counts match analysis script: 14, 22, 50, 13, 6
- [ ] Beta values match Yahoo Finance data
- [ ] Performance metrics are reasonable (no negative win rates, etc.)
- [ ] Best/worst group identification is correct

**Success criteria**:
- Beta distribution matches standalone analysis
- All stocks accounted for
- Performance metrics validated manually for sample group

---

### Task 3.3: Frontend UI/UX Testing ⏱️ 1 hour
**Description**: Validate user interface and user experience

**Testing checklist**:
- [ ] Load portfolio results page
- [ ] Verify beta analysis section displays
- [ ] Check table formatting (colors, alignment, sorting)
- [ ] Test charts (bars, tooltips, legend)
- [ ] Click "Details" for each group, verify drill-down
- [ ] Test CSV export
- [ ] Test responsive layout (mobile, tablet, desktop)
- [ ] Verify loading states (while data fetching)
- [ ] Verify error states (if data missing)

**Success criteria**:
- UI is visually appealing and consistent
- All interactions work smoothly
- No console errors or warnings
- Performance is acceptable (<1 second rendering)

---

## Phase 4: Documentation & Deployment

### Task 4.1: Update API Documentation ⏱️ 30 minutes
**Description**: Document new beta grouping response structure

**Files to modify**:
- `/Users/kweng/AI/DCA-Backtest-Tool/docs/api.md` (if exists)
- Or create `/Users/kweng/AI/DCA-Backtest-Tool/.kiro/specs/55_beta-grouped-portfolio-analysis/api-documentation.md`

**Documentation checklist**:
- [ ] Document `betaGrouping` response object structure
- [ ] Provide example response JSON
- [ ] Document beta range definitions
- [ ] Document performance metric calculations
- [ ] Include curl example for testing

**Success criteria**:
- API documentation complete and accurate
- Examples tested and verified

---

### Task 4.2: Update User Documentation ⏱️ 30 minutes
**Description**: Create user guide for beta grouping feature

**Files to create**:
- `/Users/kweng/AI/DCA-Backtest-Tool/.kiro/specs/55_beta-grouped-portfolio-analysis/user-guide.md`

**Documentation checklist**:
- [ ] Explain what beta grouping is
- [ ] Explain how to interpret results
- [ ] Provide examples ("Which beta group performed best?")
- [ ] Include screenshots of UI
- [ ] Add FAQs (common questions)

**Success criteria**:
- User guide is clear and comprehensive
- Non-technical users can understand
- Screenshots illustrate key features

---

### Task 4.3: Create Git Commit and PR ⏱️ 15 minutes
**Description**: Package work for deployment

**Git workflow**:
1. **Review changes**:
   ```bash
   git status
   git diff
   ```

2. **Stage and commit**:
   ```bash
   git add backend/services/betaGroupAnalysisService.js
   git add backend/services/portfolioBacktestService.js
   git add frontend/src/components/backtest/BetaGroupAnalysis.js
   git add .kiro/specs/55_beta-grouped-portfolio-analysis/

   git commit -m "feat(spec-55): Implement beta-grouped portfolio analysis

   - Add betaGroupAnalysisService for grouping stocks by beta ranges
   - Integrate beta grouping with portfolio backtest results
   - Create BetaGroupAnalysis React component with table and charts
   - Support 5 beta ranges: 0-0.5, 0.5-1, 1-1.5, 1.5-2, >2
   - Include CSV export functionality
   - Tested with NASDAQ-100 (105 stocks)

   Related: Spec 55"
   ```

3. **Create Pull Request** (if using PR workflow):
   ```bash
   git push origin spec-55-beta-grouped-analysis
   # Create PR via GitHub UI
   ```

**Success criteria**:
- Clean commit history
- Descriptive commit message
- All files included
- PR created (if applicable)

---

## Task Summary

| Phase | Task | Estimated Time | Priority |
|-------|------|----------------|----------|
| 1 | Backend: Create betaGroupAnalysisService.js | 2 hours | HIGH |
| 1 | Backend: Integrate with portfolioBacktestService.js | 1 hour | HIGH |
| 1 | Backend: Error handling and logging | 30 minutes | MEDIUM |
| 2 | Frontend: Create BetaGroupAnalysis component | 3 hours | HIGH |
| 2 | Frontend: Integrate with results page | 1 hour | HIGH |
| 2 | Frontend: Add CSV export | 1 hour | MEDIUM |
| 3 | Testing: Backend unit tests | 2 hours | HIGH |
| 3 | Testing: Integration with real data | 1 hour | HIGH |
| 3 | Testing: Frontend UI/UX testing | 1 hour | MEDIUM |
| 4 | Documentation: API docs | 30 minutes | MEDIUM |
| 4 | Documentation: User guide | 30 minutes | LOW |
| 4 | Deployment: Git commit and PR | 15 minutes | HIGH |

**Total Estimated Time**: ~13.5 hours

---

## Dependencies

- **External**:
  - betaDataService.js (existing)
  - portfolioBacktestService.js (existing)
  - Yahoo Finance API (via betaDataService)
  - recharts library (frontend charts)

- **Internal**:
  - Task 1.2 depends on Task 1.1 (service must exist before integration)
  - Task 2.2 depends on Task 2.1 (component must exist before integration)
  - Task 3.2 depends on Tasks 1.1 and 1.2 (backend must be complete)
  - Task 3.3 depends on Tasks 2.1 and 2.2 (frontend must be complete)

---

## Risk Mitigation

1. **Risk**: Beta fetching takes too long (>2 seconds for 105 stocks)
   - **Mitigation**: Leverage existing cache, implement timeout protection

2. **Risk**: Some stocks have missing beta values
   - **Mitigation**: Default to 1.0, log warnings, display source in UI

3. **Risk**: Capital constraints complicate performance attribution
   - **Mitigation**: Phase 1 assumes sufficient capital, Phase 2 will handle constraints

4. **Risk**: UI becomes cluttered with too much data
   - **Mitigation**: Use drill-down pattern, show summary first, details on demand

---

## Future Enhancements (Phase 2)

1. **Capital Constraint Awareness**
   - Track rejected buys per stock
   - Account for capital competition in performance attribution

2. **Time-Series Analysis**
   - Show beta group performance over time (monthly/quarterly)
   - Identify which groups perform better in different market conditions

3. **Custom Beta Ranges**
   - Allow user to define custom beta groupings
   - Support percentile-based ranges (e.g., top 20%, middle 60%, bottom 20%)

4. **Risk-Adjusted Metrics**
   - Calculate Sharpe ratio per beta group
   - Calculate Sortino ratio per beta group
   - Show max drawdown per group

5. **Sector Integration**
   - Combine beta grouping with sector analysis
   - Answer: "Do high-beta tech stocks outperform high-beta healthcare stocks?"
