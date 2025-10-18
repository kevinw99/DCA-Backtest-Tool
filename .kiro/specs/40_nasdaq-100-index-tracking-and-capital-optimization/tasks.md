# Tasks: Nasdaq 100 Index Tracking and Capital Optimization

## Overview

Implementation tasks organized by phase with dependencies, time estimates, and acceptance criteria.

## Phase 1: Research & Data Collection (Week 1 - Days 1-2)

### Task 1.1: Research Nasdaq 100 Historical Changes
**Estimated Time:** 4 hours
**Priority:** Critical
**Dependencies:** None

**Steps:**
1. Search Nasdaq official announcements for quarterly rebalances (2021-09 to 2025-10)
2. Cross-reference with financial news sources:
   - Bloomberg Nasdaq-100 rebalance articles
   - Reuters market news archives
   - CNBC technology sector coverage
3. Check Wikipedia's "Nasdaq-100" page → "Historical components" section
4. Create spreadsheet documenting all changes with 2+ sources per change

**Acceptance Criteria:**
- [ ] All additions/removals from 2021-09-01 to 2025-10-17 documented
- [ ] Each change has at least 2 authoritative sources
- [ ] Dates are in YYYY-MM-DD format
- [ ] Known recent additions (PLTR, APP) are included
- [ ] Known recent removals (NOK, WBA, ILMN) are included

**Deliverable:** Research spreadsheet with columns: Symbol, Added Date, Removed Date, Source 1, Source 2, Notes

---

### Task 1.2: Create Index History Data File
**Estimated Time:** 1 hour
**Priority:** Critical
**Dependencies:** Task 1.1

**Steps:**
1. Create file: `backend/data/nasdaq100-history.json`
2. Convert research spreadsheet to JSON format per schema in design.md
3. Validate JSON syntax
4. Add metadata section with data sources

**Acceptance Criteria:**
- [ ] File exists at `backend/data/nasdaq100-history.json`
- [ ] Valid JSON syntax (no parse errors)
- [ ] Contains at least 10 historical changes
- [ ] All dates are valid YYYY-MM-DD format
- [ ] Includes PLTR, APP, NOK with correct dates

**Deliverable:** `backend/data/nasdaq100-history.json`

---

## Phase 2: Index Tracking Service (Week 1 - Days 3-4)

### Task 2.1: Create Index Tracking Service Skeleton
**Estimated Time:** 2 hours
**Priority:** Critical
**Dependencies:** Task 1.2

**Steps:**
1. Create file: `backend/services/indexTrackingService.js`
2. Implement class structure with methods:
   - `loadIndexHistory(indexName)`
   - `isInIndex(symbol, date)`
   - `getTradingPeriod(symbol, startDate, endDate)`
   - `getIndexChanges(startDate, endDate)`
3. Add JSDoc comments for all methods
4. Add basic error handling

**Acceptance Criteria:**
- [ ] File created with proper class structure
- [ ] All 4 methods defined with parameters
- [ ] JSDoc comments on all public methods
- [ ] Basic error handling for file not found

**Deliverable:** `backend/services/indexTrackingService.js` (skeleton)

---

### Task 2.2: Implement loadIndexHistory()
**Estimated Time:** 2 hours
**Priority:** Critical
**Dependencies:** Task 2.1

**Steps:**
1. Implement file reading using `fs.promises.readFile()`
2. Parse JSON and validate structure
3. Build in-memory Map for O(1) lookups
4. Add caching to prevent re-loading
5. Handle missing file gracefully (backward compatibility)

**Acceptance Criteria:**
- [ ] Successfully loads `nasdaq100-history.json`
- [ ] Creates Map<symbol, {addedDate, removedDate}>
- [ ] Handles missing file without crashing
- [ ] Caches loaded data in memory
- [ ] Logs warning if file not found

**Deliverable:** Working `loadIndexHistory()` method

---

### Task 2.3: Implement isInIndex()
**Estimated Time:** 1 hour
**Priority:** Critical
**Dependencies:** Task 2.2

**Steps:**
1. Implement lookup in cached Map
2. Handle 4 cases:
   - Symbol not in map → return true (backward compat)
   - Date before addedDate → return false
   - Date after removedDate → return false
   - Otherwise → return true
3. Add date comparison logic
4. Add unit tests

**Acceptance Criteria:**
- [ ] Returns false if stock not yet added
- [ ] Returns false if stock already removed
- [ ] Returns true if stock in index on date
- [ ] Returns true if stock not tracked (backward compat)
- [ ] All unit tests pass

**Deliverable:** Working `isInIndex()` method + unit tests

---

### Task 2.4: Implement getTradingPeriod()
**Estimated Time:** 2 hours
**Priority:** High
**Dependencies:** Task 2.2

**Steps:**
1. Calculate effective start date: `max(backtestStartDate, addedDate || backtestStartDate)`
2. Calculate effective end date: `min(backtestEndDate, removedDate || backtestEndDate)`
3. Calculate trading days between dates
4. Determine if partial period (startDate != backtestStartDate OR endDate != backtestEndDate)
5. Return object with all calculated values

**Acceptance Criteria:**
- [ ] Correctly calculates start/end dates
- [ ] Handles null addedDate/removedDate
- [ ] Correctly identifies partial periods
- [ ] Returns { canTrade, startDate, endDate, tradingDays, isPartial }

**Deliverable:** Working `getTradingPeriod()` method

---

### Task 2.5: Implement getIndexChanges()
**Estimated Time:** 1 hour
**Priority:** Medium
**Dependencies:** Task 2.2

**Steps:**
1. Filter history.changes for events within date range
2. Return array of change objects with symbol, date, type (addition/removal)
3. Sort by date ascending

**Acceptance Criteria:**
- [ ] Returns only changes within specified date range
- [ ] Includes both additions and removals
- [ ] Sorted by date (earliest first)
- [ ] Returns empty array if no changes

**Deliverable:** Working `getIndexChanges()` method

---

## Phase 3: Portfolio Backtest Integration (Week 1-2 - Days 5-7)

### Task 3.1: Modify portfolioConfigLoader to Parse Index Tracking Config
**Estimated Time:** 2 hours
**Priority:** Critical
**Dependencies:** None

**Steps:**
1. Update `validateConfig()` to accept optional `indexTracking` section
2. Update `configToBacktestParams()` to pass through `indexTracking` config
3. Add validation for indexTracking fields
4. Set defaults if section missing

**Acceptance Criteria:**
- [ ] Parses `indexTracking` section from config
- [ ] Validates `enabled`, `indexName`, `enforceMembership` fields
- [ ] Defaults to `{ enabled: false }` if missing
- [ ] Passes indexTracking to backtest params

**Deliverable:** Updated `backend/services/portfolioConfigLoader.js`

---

### Task 3.2: Integrate Index Tracking Service into Portfolio Backtest
**Estimated Time:** 3 hours
**Priority:** Critical
**Dependencies:** Task 2.5, Task 3.1

**Steps:**
1. In `runPortfolioBacktest()`, check if `indexTracking.enabled`
2. If enabled, instantiate IndexTrackingService and load history
3. Store reference for use in daily loop
4. Add error handling for load failures

**Acceptance Criteria:**
- [ ] IndexTrackingService instantiated when enabled
- [ ] History loaded before backtest loop starts
- [ ] Service available to daily loop
- [ ] Backtest runs without errors when disabled

**Deliverable:** Updated `backend/services/portfolioBacktestService.js` (initialization)

---

### Task 3.3: Add Index Membership Checks in Daily Loop
**Estimated Time:** 2 hours
**Priority:** Critical
**Dependencies:** Task 3.2

**Steps:**
1. In daily loop, before executing DCA for each stock:
   - Call `indexTracker.isInIndex(symbol, currentDate)`
   - If false, skip to next stock (continue)
2. Add logging for skipped stocks (debug level)
3. Track skipped days per stock for metrics

**Acceptance Criteria:**
- [ ] Stocks not yet added are skipped
- [ ] Stocks already removed are skipped
- [ ] DCA execution only for in-index stocks
- [ ] Logs indicate why stocks are skipped

**Deliverable:** Updated daily loop with membership checks

---

### Task 3.4: Implement Forced Liquidation on Index Removal
**Estimated Time:** 3 hours
**Priority:** High
**Dependencies:** Task 3.3

**Steps:**
1. At start of each day, check for index changes using `getIndexChanges(currentDate, currentDate)`
2. For each removal event:
   - Get current holdings for symbol
   - Calculate liquidation value at current price
   - Sell all holdings at market price
   - Add to cash reserve
   - Log forced liquidation in transaction log
3. Track metrics: forced liquidations count, total value

**Acceptance Criteria:**
- [ ] Detects removal events on exact date
- [ ] Liquidates all holdings for removed stock
- [ ] Adds proceeds to cash reserve
- [ ] Logs liquidation in transaction history
- [ ] Updates equity calculations correctly

**Deliverable:** Forced liquidation logic in daily loop

---

### Task 3.5: Add Index Tracking Metrics to Results
**Estimated Time:** 2 hours
**Priority:** High
**Dependencies:** Task 3.4

**Steps:**
1. Track during backtest:
   - Stocks added during period (symbol, date, trading days, final value)
   - Stocks removed during period (symbol, date, final value)
   - Forced liquidation count and total value
   - Partial period stocks (symbol, total days, trading days, utilization%)
2. Add `indexTracking` section to results object
3. Calculate return% for each added/removed stock

**Acceptance Criteria:**
- [ ] Results include `indexTracking` object
- [ ] `stocksAdded` array populated with correct data
- [ ] `stocksRemoved` array populated with correct data
- [ ] Metrics match actual backtest behavior

**Deliverable:** Enhanced results with index tracking metrics

---

## Phase 4: Capital Optimization Service (Week 2 - Days 8-10)

### Task 4.1: Create Capital Optimizer Service Skeleton
**Estimated Time:** 2 hours
**Priority:** High
**Dependencies:** None

**Steps:**
1. Create file: `backend/services/capitalOptimizerService.js`
2. Implement class structure with methods:
   - `constructor(config)`
   - `getLotSize(symbol, cashReserve, baseLotSize)`
   - `calculateDailyCashYield(cashReserve)`
   - `isCashYieldEnabled()`
   - `getMetrics()`
3. Add JSDoc comments
4. Initialize metrics tracking object

**Acceptance Criteria:**
- [ ] File created with class structure
- [ ] All 5 methods defined
- [ ] Constructor accepts config object
- [ ] Metrics object initialized

**Deliverable:** `backend/services/capitalOptimizerService.js` (skeleton)

---

### Task 4.2: Implement Adaptive Lot Sizing Strategy
**Estimated Time:** 3 hours
**Priority:** High
**Dependencies:** Task 4.1

**Steps:**
1. Implement `getLotSize()`:
   - Check if `adaptive_lot_sizing` in enabled strategies
   - If cash reserve > threshold, calculate multiplier
   - Cap at maxLotSizeMultiplier
   - Track event in metrics
   - Return adjusted lot size
2. Add gradual decrease logic when cash depleted
3. Add unit tests

**Acceptance Criteria:**
- [ ] Returns baseLotSize when cash below threshold
- [ ] Increases lot size when cash above threshold
- [ ] Respects maxLotSizeMultiplier cap
- [ ] Tracks events in metrics
- [ ] Unit tests pass

**Deliverable:** Working adaptive lot sizing

---

### Task 4.3: Implement Cash Yield Strategy
**Estimated Time:** 2 hours
**Priority:** High
**Dependencies:** Task 4.1

**Steps:**
1. Implement `calculateDailyCashYield()`:
   - Check if `cash_yield` in enabled strategies
   - If cash < minCashToInvest, return 0
   - Calculate daily rate: annualYieldPercent / 100 / 365
   - Calculate yield: cashReserve * dailyRate
   - Track in metrics.cashYieldRevenue
   - Return yield amount
2. Add unit tests

**Acceptance Criteria:**
- [ ] Returns 0 when strategy disabled
- [ ] Returns 0 when cash below minimum
- [ ] Correctly calculates daily yield
- [ ] Accumulates in metrics
- [ ] Unit tests pass

**Deliverable:** Working cash yield calculation

---

### Task 4.4: Integrate Capital Optimizer into Portfolio Backtest
**Estimated Time:** 3 hours
**Priority:** High
**Dependencies:** Task 4.2, Task 4.3

**Steps:**
1. Update `portfolioConfigLoader` to parse `capitalOptimization` section
2. In `runPortfolioBacktest()`, instantiate CapitalOptimizerService if enabled
3. In daily loop:
   - Call `getLotSize()` before each DCA execution
   - Use returned lot size instead of static lotSizeUsd
   - After all stock executions, call `calculateDailyCashYield()`
   - Add yield revenue to total equity
4. Track daily cash reserve for metrics

**Acceptance Criteria:**
- [ ] CapitalOptimizerService instantiated when enabled
- [ ] Dynamic lot sizes used during backtest
- [ ] Cash yield calculated and added to equity daily
- [ ] Cash reserve tracked throughout backtest

**Deliverable:** Integrated capital optimization

---

### Task 4.5: Add Capital Optimization Metrics to Results
**Estimated Time:** 2 hours
**Priority:** High
**Dependencies:** Task 4.4

**Steps:**
1. Call `capitalOptimizer.getMetrics()` at end of backtest
2. Calculate additional metrics:
   - Average cash reserve
   - Peak cash reserve
   - Cash yield annualized return
3. Add `capitalOptimization` section to results
4. Include daily cash reserve history for charting

**Acceptance Criteria:**
- [ ] Results include `capitalOptimization` object
- [ ] All metrics accurately reflect backtest behavior
- [ ] Cash reserve history available for frontend

**Deliverable:** Enhanced results with optimization metrics

---

## Phase 5: Frontend Updates (Week 2 - Days 11-12)

### Task 5.1: Create Index Tracking Summary Component
**Estimated Time:** 3 hours
**Priority:** Medium
**Dependencies:** Task 3.5

**Steps:**
1. Update `PortfolioResults.js` to check for `results.indexTracking`
2. Create section showing:
   - Index name
   - Stocks added during backtest (table)
   - Stocks removed during backtest (table)
   - Forced liquidations summary
3. Add styling in CSS

**Acceptance Criteria:**
- [ ] Component renders when indexTracking.enabled
- [ ] Tables show all added/removed stocks with details
- [ ] Data formatted correctly (dates, percentages, currency)
- [ ] Styling matches existing components

**Deliverable:** Index tracking summary UI

---

### Task 5.2: Create Capital Optimization Summary Component
**Estimated Time:** 3 hours
**Priority:** Medium
**Dependencies:** Task 4.5

**Steps:**
1. Update `PortfolioResults.js` to check for `results.capitalOptimization`
2. Create metrics grid showing:
   - Enabled strategies
   - Cash yield revenue
   - Cash yield annualized return
   - Adaptive lot sizing events
   - Max lot size reached
3. Add styling

**Acceptance Criteria:**
- [ ] Component renders when capitalOptimization.enabled
- [ ] All metrics displayed clearly
- [ ] Values formatted correctly
- [ ] Highlights positive revenue in green

**Deliverable:** Capital optimization summary UI

---

### Task 5.3: Enhance Capital Utilization Chart with Index Annotations
**Estimated Time:** 4 hours
**Priority:** Medium
**Dependencies:** Task 5.1

**Steps:**
1. Update `BacktestChart.js` to accept `indexTracking` data
2. Create vertical line annotations for:
   - Stock additions (green line, label "+SYMBOL")
   - Stock removals (red line, label "-SYMBOL")
3. Add annotations to Chart.js configuration
4. Test with multiple additions/removals

**Acceptance Criteria:**
- [ ] Green vertical lines on addition dates
- [ ] Red vertical lines on removal dates
- [ ] Labels positioned clearly
- [ ] Annotations don't obscure data
- [ ] Works with 0 to 20+ changes

**Deliverable:** Enhanced capital utilization chart

---

### Task 5.4: Update Portfolio Config Form (Optional)
**Estimated Time:** 2 hours
**Priority:** Low
**Dependencies:** None

**Steps:**
1. Add checkbox for "Enable Index Tracking"
2. Add checkbox for "Enable Capital Optimization"
3. Add inputs for optimization parameters (thresholds, yields)
4. Update form submission to include new sections

**Acceptance Criteria:**
- [ ] User can enable/disable index tracking
- [ ] User can configure optimization parameters
- [ ] Form validates inputs
- [ ] Config saved to localStorage

**Deliverable:** Enhanced config form (optional - config files are primary interface)

---

## Phase 6: Testing & Validation (Week 3 - Days 13-15)

### Task 6.1: Write Unit Tests for Index Tracking Service
**Estimated Time:** 4 hours
**Priority:** High
**Dependencies:** Phase 2 complete

**Steps:**
1. Create `backend/tests/indexTrackingService.test.js`
2. Test cases:
   - Load valid history file
   - Handle missing file
   - `isInIndex()` with various dates (before added, after removed, during membership)
   - `getTradingPeriod()` edge cases
   - `getIndexChanges()` date filtering
3. Use Jest or Mocha framework
4. Aim for >90% code coverage

**Acceptance Criteria:**
- [ ] All methods have unit tests
- [ ] Edge cases covered
- [ ] Tests pass consistently
- [ ] Code coverage >90%

**Deliverable:** `backend/tests/indexTrackingService.test.js`

---

### Task 6.2: Write Unit Tests for Capital Optimizer Service
**Estimated Time:** 3 hours
**Priority:** High
**Dependencies:** Phase 4 complete

**Steps:**
1. Create `backend/tests/capitalOptimizerService.test.js`
2. Test cases:
   - Adaptive lot sizing with various cash reserves
   - Cash yield calculation with various parameters
   - Strategy enable/disable
   - Metrics accumulation
3. Aim for >90% code coverage

**Acceptance Criteria:**
- [ ] All methods have unit tests
- [ ] Edge cases covered
- [ ] Tests pass consistently
- [ ] Code coverage >90%

**Deliverable:** `backend/tests/capitalOptimizerService.test.js`

---

### Task 6.3: Write Integration Tests for Portfolio Backtest
**Estimated Time:** 6 hours
**Priority:** Critical
**Dependencies:** Phase 3 complete

**Steps:**
1. Create `backend/tests/portfolioBacktest.integration.test.js`
2. Test scenarios:
   - Backtest with index tracking disabled (baseline)
   - Backtest with index tracking enabled (verify lower returns)
   - Stock added mid-backtest (verify not traded before addition)
   - Stock removed mid-backtest (verify forced liquidation)
   - Cash yield accumulation over time
   - Adaptive lot sizing behavior
3. Use real stock data from database
4. Compare results with expected values

**Acceptance Criteria:**
- [ ] All integration scenarios pass
- [ ] Results match expected behavior
- [ ] No regressions in baseline tests
- [ ] Tests run in <60 seconds

**Deliverable:** `backend/tests/portfolioBacktest.integration.test.js`

---

### Task 6.4: Manual Testing with Nasdaq 100 Config
**Estimated Time:** 4 hours
**Priority:** Critical
**Dependencies:** All phases complete

**Test Plan:**

**Test 1: Baseline (Index Tracking Disabled)**
1. Run backtest with `indexTracking.enabled: false`
2. Record: Final value, return%, transaction count
3. Verify: PLTR traded from 2021-09-01

**Test 2: Index Tracking Enabled**
1. Run backtest with `indexTracking.enabled: true`
2. Record: Final value, return%, transaction count
3. Verify:
   - PLTR NOT traded before 2024-11-18
   - NOK forced liquidation on 2023-12-18
   - Lower returns than baseline (more realistic)

**Test 3: Capital Optimization**
1. Run backtest with both features enabled
2. Verify:
   - Cash yield revenue > $0
   - Adaptive lot sizing events logged
   - Final value higher than Test 2

**Test 4: Transaction Log Inspection**
1. Export transaction log
2. Verify:
   - First PLTR transaction is ON or AFTER 2024-11-18
   - NOK liquidation appears with correct date and value
   - Lot sizes vary over time (if adaptive enabled)

**Acceptance Criteria:**
- [ ] All 4 tests pass
- [ ] Index tracking reduces returns as expected
- [ ] Cash optimization increases returns
- [ ] Transaction logs accurate

**Deliverable:** Manual test results document

---

### Task 6.5: Update Documentation
**Estimated Time:** 3 hours
**Priority:** Medium
**Dependencies:** All phases complete

**Steps:**
1. Update README.md with:
   - Index tracking feature description
   - Capital optimization strategies
   - Config file examples
2. Create `docs/index-tracking-guide.md` with:
   - How to update index history data
   - How to configure index tracking
   - Interpretation of results
3. Add JSDoc comments to all new files

**Acceptance Criteria:**
- [ ] README updated
- [ ] User guide created
- [ ] All public APIs have JSDoc
- [ ] Examples include both disabled and enabled configs

**Deliverable:** Updated documentation

---

## Phase 7: Deployment & Monitoring (Week 3 - Days 16-17)

### Task 7.1: Update Default Nasdaq 100 Config
**Estimated Time:** 1 hour
**Priority:** High
**Dependencies:** Task 6.4 complete

**Steps:**
1. Update `backend/configs/portfolios/nasdaq100.json`
2. Set `indexTracking.enabled: true`
3. Set `capitalOptimization.enabled: true`
4. Use conservative optimization parameters
5. Commit changes

**Acceptance Criteria:**
- [ ] Config file updated
- [ ] Runs successfully via API
- [ ] Results show realistic returns

**Deliverable:** Updated nasdaq100.json config

---

### Task 7.2: Performance Testing
**Estimated Time:** 3 hours
**Priority:** Medium
**Dependencies:** Task 7.1

**Steps:**
1. Benchmark backtest execution time:
   - Without features: X seconds
   - With index tracking: X + Y seconds
   - With full optimization: X + Z seconds
2. Verify Y < 5 seconds and Z < 10 seconds
3. Profile bottlenecks if needed
4. Optimize if performance degrades >20%

**Acceptance Criteria:**
- [ ] Index tracking adds <5 seconds overhead
- [ ] Full optimization adds <10 seconds total overhead
- [ ] No memory leaks
- [ ] CPU usage reasonable

**Deliverable:** Performance test report

---

### Task 7.3: Create Monitoring Dashboard (Optional)
**Estimated Time:** 4 hours
**Priority:** Low
**Dependencies:** Phase 5 complete

**Steps:**
1. Create comparison view in frontend:
   - Side-by-side: with/without index tracking
   - Side-by-side: with/without optimization
2. Add charts showing:
   - Return impact of index tracking
   - Return boost from optimization
3. Add explanatory text

**Acceptance Criteria:**
- [ ] Comparison view functional
- [ ] Charts render correctly
- [ ] Clearly shows impact of features

**Deliverable:** Comparison dashboard (optional enhancement)

---

## Summary Timeline

| Phase | Days | Key Deliverables |
|-------|------|-----------------|
| Phase 1: Research | 1-2 | Index history data file |
| Phase 2: Index Tracking | 3-4 | indexTrackingService.js |
| Phase 3: Integration | 5-7 | Portfolio backtest with tracking |
| Phase 4: Optimization | 8-10 | capitalOptimizerService.js |
| Phase 5: Frontend | 11-12 | UI components |
| Phase 6: Testing | 13-15 | Tests + validation |
| Phase 7: Deployment | 16-17 | Production ready |

**Total Estimated Time:** 17 days (3+ weeks)

## Risk Mitigation

| Risk | Mitigation Task |
|------|----------------|
| Inaccurate historical data | Task 1.1 - Require 2+ sources per change |
| Performance degradation | Task 7.2 - Benchmark and optimize |
| Complex bugs | Task 6.1-6.3 - Comprehensive testing |
| User confusion | Task 6.5 - Clear documentation |

## Dependencies Graph

```
1.1 → 1.2 → 2.1 → 2.2 → 2.3
                     ↓
                    2.4
                     ↓
                    2.5 → 3.2 → 3.3 → 3.4 → 3.5
                              ↓
3.1 ────────────────────────┘

4.1 → 4.2 → 4.4 → 4.5
      ↓
     4.3 ─┘

3.5 → 5.1 → 5.3
4.5 → 5.2

All → 6.1, 6.2, 6.3, 6.4 → 7.1 → 7.2
```

## Definition of Done

A task is considered complete when:
1. ✅ Code is written and follows project style guidelines
2. ✅ Unit tests written and passing (if applicable)
3. ✅ Integration tests passing (if applicable)
4. ✅ Manual testing completed and documented
5. ✅ Code reviewed (self-review minimum)
6. ✅ Documentation updated
7. ✅ No console errors or warnings
8. ✅ Committed to version control with clear commit message
