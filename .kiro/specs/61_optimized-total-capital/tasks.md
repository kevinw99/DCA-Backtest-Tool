# Spec 61: Implementation Tasks - Optimized Total Capital

## Overview

When `optimizedTotalCapital: true`, the system runs TWO scenarios and returns results for both:
1. **Optimal (100%)**: Discovery run with unlimited capital → finds `peakDeployedCapital` → this IS the final result
2. **Constrained (90%)**: Second run with 90% of optimal capital → shows performance with some rejections

## Phase 1: Backend - Capital Tracking

### Task 1.1: Add Capital Tracking to Portfolio Class
**File:** `backend/services/portfolioBacktestService.js`
**Complexity:** Low

- [ ] Add `capitalTracking` object to Portfolio constructor:
  ```javascript
  this.capitalTracking = {
    maxDeployed: 0,
    maxDeployedDate: null,
    totalDeployedDays: 0,
    sumDeployed: 0
  };
  ```
- [ ] Implement `trackCapitalUsage(date)` method
- [ ] Implement `getCapitalAnalysis()` method
- [ ] Call `trackCapitalUsage()` at end of each day in simulation loop

### Task 1.2: Add `optimizedTotalCapital` Parameter
**File:** `backend/server.js` (API endpoint)
**Complexity:** Low

- [ ] Add `optimizedTotalCapital` to request body destructuring
- [ ] Default to `false` for backward compatibility
- [ ] Pass parameter to `portfolioBacktestService`

## Phase 2: Backend - Two-Scenario Orchestration

### Task 2.1: Implement Discovery + Constrained Run Logic
**File:** `backend/services/portfolioBacktestService.js`
**Complexity:** High

- [ ] When `optimizedTotalCapital: true`:
  1. Run discovery with unlimited capital (10M)
  2. Extract `peakDeployedCapital` from tracking
  3. This discovery run IS the optimal (100%) result
  4. Run second simulation with `0.9 * peakDeployedCapital`
  5. Return both scenarios in response

- [ ] Add internal flags:
  - `_isConstrainedRun`: true for the 90% run
  - Prevents infinite recursion

### Task 2.2: Recalculate Metrics with Correct Capital Base
**File:** `backend/services/portfolioBacktestService.js`
**Complexity:** Medium

- [ ] After discovery run, recalculate return percentages using `peakDeployedCapital` as the base (not the unlimited capital)
- [ ] Ensure CAGR, total return %, etc. use correct capital denominator

### Task 2.3: Calculate Buy & Hold for Both Scenarios
**File:** `backend/services/portfolioBuyAndHoldService.js`
**Complexity:** Low

- [ ] Ensure Buy & Hold calculation accepts capital from config
- [ ] Calculate Buy & Hold for optimal scenario (100% capital)
- [ ] Calculate Buy & Hold for constrained scenario (90% capital)

## Phase 3: Response Structure

### Task 3.1: Structure Response with Two Scenarios
**File:** `backend/services/portfolioBacktestService.js`
**Complexity:** Medium

- [ ] Create response structure:
  ```javascript
  {
    data: {
      capitalDiscovery: { peakDeployedCapital, peakCapitalDate, constrainedCapital },
      scenarios: {
        optimal: { capitalAnalysis, dcaResults, buyAndHold, comparison },
        constrained: { capitalAnalysis, dcaResults, buyAndHold, comparison, rejectedOrders }
      }
    }
  }
  ```

### Task 3.2: Include Full Comparison in Both Scenarios
**Complexity:** Low

- [ ] Each scenario includes complete comparison metrics:
  - Total Return (DCA vs B&H)
  - CAGR (DCA vs B&H)
  - Max Drawdown (DCA vs B&H)
  - Sharpe Ratio (DCA vs B&H)
  - Sortino Ratio (DCA vs B&H)
  - Volatility (DCA vs B&H)

## Phase 4: Frontend - Two Tabs

### Task 4.1: Add Tab Navigation for Scenarios
**File:** `frontend/src/components/PortfolioResults.js` (or similar)
**Complexity:** Medium

- [ ] Detect when response has `scenarios` object
- [ ] Create tab UI: "Optimal Capital (100%)" | "Constrained (90%)"
- [ ] Each tab shows full result page with comparison metrics

### Task 4.2: Display Capital Info in Each Tab
**Complexity:** Low

- [ ] Tab 1 header: "Optimal Capital: $185,000 (0 rejections)"
- [ ] Tab 2 header: "Constrained Capital: $166,500 (5 rejections)"

### Task 4.3: Show Rejected Orders in Constrained Tab
**Complexity:** Low

- [ ] Display list of rejected orders with date, symbol, reason
- [ ] Collapsible/expandable section

## Phase 5: Testing & Validation

### Task 5.1: Create Curl Test Script
**File:** `backend/tests/curl_test_optimized_capital.sh`

```bash
#!/bin/bash

# Test optimized capital mode
curl -s -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "stocks": ["AAPL", "MSFT", "NVDA"],
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "startDate": "2021-01-01",
    "endDate": "2025-11-23",
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10,
    "optimizedTotalCapital": true
  }' | jq '
    .data.capitalDiscovery,
    "---OPTIMAL---",
    .data.scenarios.optimal.capitalAnalysis,
    .data.scenarios.optimal.comparison,
    "---CONSTRAINED---",
    .data.scenarios.constrained.capitalAnalysis,
    .data.scenarios.constrained.rejectedOrders | length
  '
```

### Task 5.2: Verification Checklist

- [ ] `optimizedTotalCapital: false` produces unchanged results (backward compatible)
- [ ] `optimizedTotalCapital: true` returns both scenarios
- [ ] Optimal scenario has `rejectedOrderCount: 0`
- [ ] Constrained scenario has `rejectedOrderCount > 0` (usually)
- [ ] Both scenarios have correct Buy & Hold using respective capital
- [ ] All comparison metrics present in both scenarios
- [ ] Frontend displays two tabs correctly

## Verification Commands

```bash
# Verify optimal has zero rejections
curl -s ... | jq '.data.scenarios.optimal.capitalAnalysis.rejectedOrderCount'
# Expected: 0

# Verify constrained has some rejections
curl -s ... | jq '.data.scenarios.constrained.capitalAnalysis.rejectedOrderCount'
# Expected: > 0 (usually)

# Verify both use correct capital
curl -s ... | jq '.data.scenarios.optimal.capitalAnalysis.optimizedCapital, .data.scenarios.constrained.capitalAnalysis.optimizedCapital'
# Expected: 185000, 166500 (90% of 185000)

# Verify Buy & Hold comparison exists in both
curl -s ... | jq '.data.scenarios.optimal.comparison.cagr, .data.scenarios.constrained.comparison.cagr'
# Expected: { dca: X, buyAndHold: Y, advantage: "..." } for both
```

## Dependencies

- Spec 60: Metrics Calculation Standardization (for consistent calculations)
- Existing portfolio backtest infrastructure

## Timeline Estimate

- Phase 1 (Capital Tracking): 1 hour
- Phase 2 (Two-Scenario Logic): 2 hours
- Phase 3 (Response Structure): 1 hour
- Phase 4 (Frontend Tabs): 2 hours
- Phase 5 (Testing): 1 hour

**Total: ~7 hours**
