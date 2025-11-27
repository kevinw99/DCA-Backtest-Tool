# Portfolio-Calls-Individual-DCA Architecture - Requirements

## Problem Statement

**Current Architecture:**
- Portfolio backtest has its own simplified grid-based trading logic
- Individual DCA has mature, feature-rich trailing stop logic with 30+ advanced features
- **These are two completely different algorithms**
- Portfolio benefits don't translate to individual DCA improvements

**Core Issue:**
If portfolio and individual DCA use different algorithms, then:
- Portfolio backtest results don't reflect real individual DCA behavior
- Improvements to individual DCA don't benefit portfolio
- It's unclear how portfolio allocation affects actual individual DCA performance
- **Portfolio backtest has no meaning** - it's testing a different strategy!

## User's Vision

> "The motivation is to utilize the mature single DCA to portfolio backtest. If they are two different algo, then it is hard to see how portfolio backtest affect the single DCA algo collectively, then there is no meaning to have portfolio backtest at all!"

**Key Insight:**
Portfolio should not have its own trading logic. Instead:
1. **Portfolio orchestrates** capital allocation across stocks
2. **Individual DCA executes** the actual trading decisions for each stock
3. **Capital availability** is the only difference between single-stock and multi-stock

## Proposed Architecture

### Integration Point

**Daily execution flow:**
```
FOR EACH day:
  FOR EACH stock in portfolio:
    hasCapital = checkCapitalAvailability(stock)

    result = runIndividualDCAForOneDay(stock, {
      buyEnabled: hasCapital,  // <-- KEY PARAMETER
      sellEnabled: true        // Always allow sells
    })

    IF result.bought:
      allocateCapital(result.capitalUsed)

    IF result.sold:
      releaseCapital(result.capitalReleased)
```

###Key Parameter: `buyEnabled`

**Purpose:** Gate buy execution based on capital availability

**Behavior:**
- `buyEnabled: true` → Normal Individual DCA execution (evaluate and execute buys)
- `buyEnabled: false` → Skip buy execution, log "No capital available", only process sells

**This single parameter** unifies both backends:
- Single-stock backtest: Always `buyEnabled: true`
- Portfolio backtest: `buyEnabled: hasCapitalForStock()`

## Goals

### Primary Goals

1. **Unified Trading Logic**
   - Portfolio uses the same mature Individual DCA algorithm
   - Single source of truth for all trading decisions
   - Improvements benefit both single-stock and multi-stock scenarios

2. **Capital-Gated Execution**
   - Extract daily execution logic from Individual DCA
   - Add `buyEnabled` parameter to gate buy operations
   - Portfolio manages capital allocation, Individual DCA handles trading

3. **Consistent Behavior**
   - Single-stock backtest with $100k should behave identically to:
   - Portfolio backtest with 1 stock and $100k capital
   - Only difference: capital constraints in portfolio

### Secondary Goals

4. **Preserve All Features**
   - Keep all 30+ Individual DCA features working
   - Maintain trailing stops, adaptive strategies, scenario detection
   - No feature regression

5. **Clean Architecture**
   - Clear separation: Portfolio = orchestration, Individual DCA = execution
   - Minimal changes to existing Individual DCA logic
   - Easy to understand and maintain

## Non-Goals

- ❌ Simplifying Individual DCA logic (keep all features)
- ❌ Changing Individual DCA algorithm (preserve trailing stops)
- ❌ Modifying Individual DCA's advanced features
- ❌ Creating a new "shared signal engine" (wrong approach - different algorithms)

## Success Criteria

### Functional Requirements

1. **Unified Algorithm**
   - Portfolio backtest calls Individual DCA daily for each stock
   - Individual DCA can run in "single-day" mode with state preservation
   - `buyEnabled` parameter correctly gates buy operations

2. **Capital Management**
   - Portfolio tracks available capital pool
   - Allocates capital when Individual DCA buys
   - Releases capital when Individual DCA sells
   - Logs "no capital available" events clearly

3. **Behavioral Consistency**
   - Single-stock backtest results unchanged
   - Portfolio with 1 stock ≈ Single-stock backtest (same algorithm)
   - All Individual DCA features work in portfolio context

### Testing Requirements

4. **Baseline Preservation**

   Individual DCA test cases MUST produce identical results after refactoring:

   **Test 1: APP (2021-09-01 to 2025-10-14)**
   ```
   Frontend URL:
   http://localhost:3000/backtest/long/APP/results?startDate=2021-09-01&endDate=2025-10-14&lotSizeUsd=10000&maxLots=10&maxLotsToSell=1&gridIntervalPercent=10&profitRequirement=10&trailingBuyActivationPercent=5&trailingBuyReboundPercent=5&trailingSellActivationPercent=20&trailingSellPullbackPercent=10&beta=2.592&coefficient=1&enableBetaScaling=false&isManualBetaOverride=false&enableDynamicGrid=false&normalizeToReference=true&enableConsecutiveIncrementalBuyGrid=true&enableConsecutiveIncrementalSellProfit=true&enableScenarioDetection=false&enableAverageBasedGrid=false&enableAverageBasedSell=false&dynamicGridMultiplier=1&gridConsecutiveIncrement=5

   Backend API (curl):
   curl -X POST http://localhost:3001/api/backtest/dca -H "Content-Type: application/json" -d '{
     "startDate": "2021-09-01",
     "endDate": "2025-10-14",
     "lotSizeUsd": 10000,
     "maxLots": 10,
     "maxLotsToSell": 1,
     "gridIntervalPercent": 0.1,
     "profitRequirement": 0.1,
     "trailingBuyActivationPercent": 0.05,
     "trailingBuyReboundPercent": 0.05,
     "trailingSellActivationPercent": 0.2,
     "trailingSellPullbackPercent": 0.1,
     "beta": 2.592,
     "coefficient": 1,
     "enableBetaScaling": false,
     "isManualBetaOverride": false,
     "enableDynamicGrid": false,
     "normalizeToReference": true,
     "enableConsecutiveIncrementalBuyGrid": true,
     "enableConsecutiveIncrementalSellProfit": true,
     "enableScenarioDetection": false,
     "enableAverageBasedGrid": false,
     "enableAverageBasedSell": false,
     "dynamicGridMultiplier": 1,
     "gridConsecutiveIncrement": 0.05,
     "symbol": "APP",
     "strategyMode": "long"
   }'

   Expected Results:
   - Total Return: $1,154,291.86
   - Return %: +1648.99%
   - Avg Capital: $48,015.49
   - CAGR: 100.36%
   ```

   **Test 2: TSLA (2021-09-01 to 2025-10-14)**
   ```
   URL: http://localhost:3000/backtest/long/TSLA/results?startDate=2021-09-01&endDate=2025-10-14&lotSizeUsd=10000&maxLots=10&maxLotsToSell=1&gridIntervalPercent=10&profitRequirement=10&trailingBuyActivationPercent=10&trailingBuyReboundPercent=5&trailingSellActivationPercent=20&trailingSellPullbackPercent=10&beta=2.592&coefficient=1&enableBetaScaling=false&isManualBetaOverride=false&enableDynamicGrid=false&normalizeToReference=true&enableConsecutiveIncrementalBuyGrid=true&enableConsecutiveIncrementalSellProfit=false&enableScenarioDetection=false&enableAverageBasedGrid=false&enableAverageBasedSell=false&dynamicGridMultiplier=1&gridConsecutiveIncrement=5

   Expected Results:
   - Total Return: $69,148.32
   - Return %: +115.25%
   - Avg Capital: $42,735.21
   - CAGR: 20.46%
   ```

   **Acceptance Criteria:**
   - Both tests produce EXACT same results after refactoring (within $0.01 tolerance)
   - All transactions occur on same dates
   - Buy/sell prices match exactly
   - No regressions in any metrics

5. **Portfolio Validation**
   - Portfolio backtest produces reasonable multi-stock results
   - Capital constraints observed correctly
   - Per-stock behavior matches Individual DCA when capital available

### Implementation Requirements

6. **Code Organization**
   - Extract daily execution function from Individual DCA main loop
   - Add `buyEnabled` flag to execution context
   - Modify Portfolio to call Individual DCA instead of own logic
   - Remove old Portfolio trading logic (grid-based code)

7. **State Management**
   - Individual DCA maintains per-stock state across days
   - Portfolio manages capital pool state
   - Clear boundaries between portfolio state and stock state

## Architecture Comparison

### Before (Current - WRONG)

```
┌─────────────────────────────────────┐
│     portfolioBacktestService.js     │
│  - Grid-based buy/sell logic        │
│  - Simple profit-taking              │
│  - Capital pool management           │
│  - ~600 lines                        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      dcaBacktestService.js          │
│  - Trailing stop buy/sell logic     │
│  - Adaptive strategies               │
│  - 30+ advanced features             │
│  - ~2,600 lines                      │
└─────────────────────────────────────┘

❌ PROBLEM: Two different algorithms!
```

### After (Proposed - CORRECT)

```
┌─────────────────────────────────────┐
│     portfolioBacktestService.js     │
│  - Capital pool orchestration        │
│  - Calls Individual DCA per stock    │
│  - Aggregates results                │
│  - ~400 lines (simplified)           │
└──────────────┬──────────────────────┘
               │
               │ FOR EACH stock, EACH day:
               │   runOneDayOfDCA(stock, { buyEnabled })
               ▼
┌─────────────────────────────────────┐
│      dcaBacktestService.js          │
│  - Daily execution function          │
│  - Trailing stop buy/sell logic      │
│  - Adaptive strategies (all kept)    │
│  - buyEnabled parameter added        │
│  - ~2,700 lines (minor additions)    │
└─────────────────────────────────────┘

✅ SOLUTION: Single algorithm, capital-gated!
```

## Benefits

### For Users

1. **Meaningful Portfolio Backtest**
   - Portfolio results reflect actual Individual DCA behavior
   - Can confidently use portfolio allocation insights
   - Single-stock and multi-stock use same proven algorithm

2. **Unified Development**
   - Improve Individual DCA → Portfolio automatically benefits
   - Test once, works everywhere
   - Consistent behavior across all scenarios

### For Development

3. **Maintainability**
   - Single source of truth for trading logic
   - Only one algorithm to maintain and improve
   - Clear separation of concerns (orchestration vs execution)

4. **Extensibility**
   - New Individual DCA features automatically work in portfolio
   - Easy to add new capital management strategies
   - Simple to test and validate

## Risks and Mitigation

### Risk 1: Performance

**Risk:** Calling Individual DCA per stock per day might be slower

**Mitigation:**
- Individual DCA is already optimized for full backtests (1000+ days)
- Daily execution is just one iteration of existing loop
- Can optimize later if needed (caching, etc.)

### Risk 2: State Management

**Risk:** Managing per-stock state across days might be complex

**Mitigation:**
- Individual DCA already manages complex state
- Extract state structure from current implementation
- Portfolio just maintains array of stock states

### Risk 3: Breaking Changes

**Risk:** Modifications to Individual DCA might break existing functionality

**Mitigation:**
- Extract daily execution with minimal changes
- Keep all existing features intact
- Comprehensive testing before/after (baseline preservation)
- Phased implementation (extract → test → integrate)

## Implementation Phases

### Phase 1: Extract Daily Execution (Individual DCA)

**Goal:** Create `runOneDayOfDCA()` function

**Changes:**
- Extract one iteration of main loop (lines 1845-2277)
- Add `buyEnabled` parameter to execution context
- Return execution results (bought, sold, state changes)
- Test: Single-stock backtest produces identical results

### Phase 2: Refactor Portfolio (Portfolio Service)

**Goal:** Replace portfolio logic with Individual DCA calls

**Changes:**
- Remove old grid-based trading logic
- Implement capital pool management
- Loop through stocks calling `runOneDayOfDCA()`
- Aggregate results from all stocks
- Test: Portfolio produces reasonable multi-stock results

### Phase 3: Validation and Cleanup

**Goal:** Verify unified architecture works correctly

**Changes:**
- Run comprehensive test suite
- Compare results to baseline
- Clean up old dcaSignalEngine.js (no longer needed)
- Update documentation

## Open Questions

1. **State Initialization:** How to initialize per-stock state in portfolio context?
   - **Answer:** Portfolio creates initial state structure for each stock on first day

2. **Transaction Logging:** How to aggregate logs from multiple stocks?
   - **Answer:** Portfolio collects logs per stock, can display separately or merged

3. **Adaptive Strategies:** Do adaptive strategies work per-stock or portfolio-wide?
   - **Answer:** Per-stock (each stock has independent adaptive strategy)

## References

- Individual DCA main loop: `/backend/services/dcaBacktestService.js` lines 1845-2277
- Portfolio orchestration: `/backend/services/portfolioBacktestService.js` lines 300-600
- User's vision: `requests.txt` lines 32-42
