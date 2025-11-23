# Spec 61: Implementation Tasks - Optimized Total Capital

## Phase 1: Backend Infrastructure

### Task 1.1: Add Capital Tracking to Portfolio Class
**File:** `backend/services/portfolioBacktestService.js`
**Complexity:** Medium

- [ ] Add `capitalTracking` object to Portfolio constructor
- [ ] Implement `trackCapitalUsage(date)` method
- [ ] Implement `getCapitalAnalysis()` method
- [ ] Call `trackCapitalUsage()` at end of each day loop
- [ ] Add unit tests for capital tracking

### Task 1.2: Add `optimizedTotalCapital` Parameter
**File:** `backend/server.js` (API endpoint)
**Complexity:** Low

- [ ] Add `optimizedTotalCapital` to request body validation
- [ ] Pass parameter to `portfolioBacktestService`
- [ ] Add to parameter logging for debugging

### Task 1.3: Implement Two-Pass Orchestration
**File:** `backend/services/portfolioBacktestService.js`
**Complexity:** High

- [ ] Add discovery phase logic when `optimizedTotalCapital: true`
- [ ] Add internal flags: `_discoveryMode`, `_optimizationRun`
- [ ] Implement discovery run with high capital (10M or 10x user input)
- [ ] Extract `peakDeployedCapital` from discovery results
- [ ] Implement optimization run with optimal capital
- [ ] Merge capital analysis into final response

### Task 1.4: Update Buy & Hold Calculator
**File:** `backend/services/portfolioBuyAndHoldService.js`
**Complexity:** Low

- [ ] Accept `_optimizedCapital` from config
- [ ] Use `_optimizedCapital` when available, otherwise `totalCapital`
- [ ] Ensure proportional allocation uses correct capital base

## Phase 2: Response Enhancements

### Task 2.1: Add `capitalAnalysis` to Response
**File:** `backend/services/portfolioBacktestService.js`
**Complexity:** Medium

- [ ] Create `capitalAnalysis` object structure
- [ ] Calculate capital savings if user specified different amount
- [ ] Calculate utilization percentage
- [ ] Include in both discovery and optimized responses

### Task 2.2: Update Comparison Metrics
**File:** `backend/services/portfolioBacktestService.js`
**Complexity:** Low

- [ ] Ensure comparison uses consistent capital for both strategies
- [ ] Add note in response indicating capital basis for comparison

## Phase 3: Testing & Validation

### Task 3.1: Create Curl Test Script
**File:** `backend/tests/curl_test_optimized_capital.sh`
**Complexity:** Low

- [ ] Test standard mode (backward compatibility)
- [ ] Test optimized mode with various stock combinations
- [ ] Verify zero rejected orders in optimized mode
- [ ] Compare results between modes

### Task 3.2: Integration Testing
**Complexity:** Medium

- [ ] Verify discovery phase finds correct peak capital
- [ ] Verify optimization run uses discovered capital
- [ ] Verify Buy & Hold uses same capital
- [ ] Verify capital metrics are accurate
- [ ] Test edge cases (single stock, many stocks, volatile stocks)

## Phase 4: Performance Optimization (Optional)

### Task 4.1: Cache Price Data Between Runs
**File:** `backend/services/portfolioBacktestService.js`
**Complexity:** Medium

- [ ] Cache fetched price data during discovery run
- [ ] Reuse cached data for optimization run
- [ ] Clear cache after completion

### Task 4.2: Reduce Capital Tracking Memory
**Complexity:** Low

- [ ] Sample daily deployed capital every N days
- [ ] Make sampling interval configurable
- [ ] Only store samples needed for analysis

## Verification Checklist

### Functional Verification
- [ ] `optimizedTotalCapital: false` produces identical results to before
- [ ] `optimizedTotalCapital: true` results in zero rejected orders
- [ ] Buy & Hold comparison uses same capital as DCA
- [ ] Capital analysis metrics are present and accurate
- [ ] API response time is acceptable (<2x standard mode)

### Test Commands

```bash
# Standard mode (verify backward compatibility)
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "stocks": ["AAPL", "MSFT", "NVDA"],
    "totalCapital": 300000,
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "startDate": "2021-01-01",
    "endDate": "2025-11-23",
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10
  }' | jq '.data.rejectedOrders | length'

# Optimized mode (should return 0 rejected orders)
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "stocks": ["AAPL", "MSFT", "NVDA"],
    "totalCapital": 300000,
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
  }' | jq '.data.capitalAnalysis, .data.rejectedOrders | length'
```

## Dependencies

- Spec 60: Metrics Calculation Standardization (for consistent CAGR/drawdown calculations)
- Existing portfolio backtest infrastructure

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Discovery run picks wrong peak | High | Add debugging logs to trace capital tracking |
| Performance degradation | Medium | Cache price data, optimize tracking |
| Memory issues with long backtests | Low | Sample capital at intervals, not every day |
| Breaking existing behavior | High | Extensive backward compatibility testing |

## Timeline Estimate

- Phase 1: 2-3 hours (infrastructure changes)
- Phase 2: 1 hour (response enhancements)
- Phase 3: 1-2 hours (testing & validation)
- Phase 4: Optional, 1 hour if needed

**Total: 4-6 hours**
