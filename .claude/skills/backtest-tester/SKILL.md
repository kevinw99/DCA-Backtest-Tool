---
name: backtest-tester
description: Test DCA backtest endpoints (single, portfolio, batch) with proper curl commands and result verification. Use when testing API changes, verifying fixes, or validating new features. Creates reusable test scripts and validates response format.
---

# Backtest Tester Skill

Creates and executes comprehensive tests for DCA backtest endpoints.

## When to Use This Skill

Use this skill when:
- Testing API endpoint changes
- Verifying bug fixes
- Validating new parameters
- Regression testing after refactoring
- Creating test scripts for documentation

## Backtest Modes

### 1. Single Backtest

**Endpoint**: `POST /api/backtest/dca`

**Test Template**:
```bash
#!/bin/bash
# test_single_backtest.sh

curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "strategyMode": "long",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "profitRequirement": 0.05,
    "gridIntervalPercent": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10
  }' | jq '{
    success: .success,
    symbol: .data.symbol,
    totalPNL: .data.totalPNL,
    totalBuys: .data.totalBuys,
    totalSells: .data.totalSells,
    finalHoldings: .data.finalHoldings
  }'
```

**Verify Response**:
- ✅ `success: true`
- ✅ `data.symbol` matches request
- ✅ `totalBuys` > 0
- ✅ `totalSells` >= 0
- ✅ `totalPNL` is numeric
- ✅ `transactionLog` exists (if needed for debugging)

### 2. Portfolio Backtest

**Endpoint**: `POST /api/portfolio-backtest`

**Test Template**:
```bash
#!/bin/bash
# test_portfolio_backtest.sh

curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "MSFT", "NVDA"],
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "strategyMode": "long",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "profitRequirement": 0.05,
    "gridIntervalPercent": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10
  }' | jq '{
    success: .success,
    stockCount: (.data.stocks | length),
    portfolioSummary: .data.portfolioSummary,
    stocks: (.data.stocks | map({symbol, totalPNL, totalBuys, totalSells}))
  }'
```

**Verify Response**:
- ✅ `success: true`
- ✅ `data.stocks` array length matches symbols count
- ✅ `portfolioSummary.totalPNL` is sum of individual stocks
- ✅ Each stock has expected fields
- ✅ `deferredSells` array exists

### 3. Batch Backtest

**Endpoint**: `POST /api/backtest/batch`

**Test Template**:
```bash
#!/bin/bash
# test_batch_backtest.sh

curl -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "parameterRanges": {
      "symbols": ["AAPL", "MSFT"],
      "startDate": "2024-01-01",
      "endDate": "2024-06-30",
      "lotSizeUsd": 10000,
      "maxLots": 10,
      "profitRequirement": [0.03, 0.05, 0.07],
      "gridIntervalPercent": [0.10],
      "trailingBuyActivationPercent": [0.10],
      "trailingBuyReboundPercent": [0.05],
      "trailingSellActivationPercent": [0.20],
      "trailingSellPullbackPercent": [0.10],
      "maxLotsToSell": [1],
      "dynamicGridMultiplier": [1.0],
      "enableBetaScaling": false,
      "enableDynamicGrid": true,
      "normalizeToReference": true,
      "enableConsecutiveIncrementalBuyGrid": false,
      "enableConsecutiveIncrementalSellProfit": true
    }
  }' | jq '{
    success: .success,
    totalResults: (.results | length),
    expectedCombinations: 6,
    sample: (.results[0] | {
      symbol: .parameters.symbol,
      profitReq: .parameters.profitRequirement,
      totalReturn: .summary.totalReturn
    })
  }'
```

**Verify Response**:
- ✅ `success: true`
- ✅ `results` array length = symbols × profitRequirement combinations
- ✅ Each result has `parameters`, `summary`, and backtest data
- ✅ Results sorted by specified `sortBy` field

## Testing Parameters

### Test New Boolean Parameter

```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2024-01-01",
    "endDate": "2024-06-30",
    "newBooleanParam": true,
    ...other params...
  }' | jq '{
    success: .success,
    paramInResponse: .data.newBooleanParam
  }'
```

**Verify**:
- ✅ Parameter accepted by backend
- ✅ Parameter appears in response (if echoed back)
- ✅ Behavior changes as expected

### Test New Numeric Parameter

```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2024-01-01",
    "endDate": "2024-06-30",
    "newNumericParam": 0.15,
    ...other params...
  }' | jq '{
    success: .success,
    paramValue: .data.newNumericParam
  }'
```

**Verify**:
- ✅ Numeric value accepted
- ✅ Calculations use the parameter correctly
- ✅ Edge cases handled (0, negative, very large)

## Parallel Testing Strategy

Use Task tool to test multiple scenarios concurrently:

```javascript
// Launch 4 test agents in parallel
Task agent 1: "Test single backtest with default parameters"
Task agent 2: "Test portfolio backtest with 3 symbols"
Task agent 3: "Test batch backtest with parameter variations"
Task agent 4: "Test edge cases and error handling"
```

## Transaction Log Analysis

For detailed debugging:

```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d @test_payload.json > /tmp/result.json

# Extract transaction logs
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/result.json', 'utf8'));
if (data.success && data.data.transactionLog) {
  data.data.transactionLog.forEach(line => console.log(line));
}
" > /tmp/transaction_log.txt

# Search for specific events
grep "BUY" /tmp/transaction_log.txt
grep "SELL" /tmp/transaction_log.txt
grep "2024-06-15" /tmp/transaction_log.txt
```

## Error Testing

### Test Invalid Parameters

```bash
# Missing required field
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL"}' | jq '.success, .error'

# Invalid symbol
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{"symbol": "INVALID", ...}' | jq '.success, .error'

# Invalid date range
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2024-12-31", "endDate": "2024-01-01", ...}' \
  | jq '.success, .error'
```

**Verify**:
- ✅ `success: false`
- ✅ Meaningful error message
- ✅ No server crash

## Test Script Organization

Create organized test directory:

```
backend/
  tests/
    single/
      test_basic.sh
      test_momentum.sh
      test_edge_cases.sh
    portfolio/
      test_multi_stock.sh
      test_deferred_sells.sh
    batch/
      test_parameter_combinations.sh
      test_momentum_batch.sh
```

## Regression Test Suite

Create master test runner:

```bash
#!/bin/bash
# run_all_tests.sh

echo "Running DCA Backtest Test Suite"
echo "================================"

FAILED=0

# Single mode tests
echo "Testing Single Mode..."
bash tests/single/test_basic.sh || FAILED=$((FAILED+1))
bash tests/single/test_momentum.sh || FAILED=$((FAILED+1))

# Portfolio mode tests
echo "Testing Portfolio Mode..."
bash tests/portfolio/test_multi_stock.sh || FAILED=$((FAILED+1))

# Batch mode tests
echo "Testing Batch Mode..."
bash tests/batch/test_parameter_combinations.sh || FAILED=$((FAILED+1))

if [ $FAILED -eq 0 ]; then
  echo "✅ All tests passed!"
else
  echo "❌ $FAILED test(s) failed"
  exit 1
fi
```

## Performance Testing

Test with large date ranges:

```bash
# Test performance with 5-year range
time curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2019-01-01",
    "endDate": "2024-12-31",
    ...
  }' > /dev/null
```

**Monitor**:
- Response time
- Memory usage
- Transaction log size

## Best Practices

1. ✅ **Use reduced date ranges** for tests (1-3 months for quick tests)
2. ✅ **Save test scripts** in version control
3. ✅ **Include jq filters** to extract relevant data
4. ✅ **Test all three modes** when adding new parameters
5. ✅ **Create regression tests** after fixing bugs
6. ✅ **Use parallel testing** for comprehensive coverage
7. ✅ **Document expected results** in test scripts
8. ✅ **Test error conditions** not just happy path

## Quick Test Commands

**Quick single test**:
```bash
curl -s -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","startDate":"2024-01-01","endDate":"2024-03-31"}' \
  | jq '.success, .data.totalPNL'
```

**Quick portfolio test**:
```bash
curl -s -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{"symbols":["AAPL","MSFT"],"startDate":"2024-01-01","endDate":"2024-03-31"}' \
  | jq '.success, .data.portfolioSummary.totalPNL'
```

**Quick batch test**:
```bash
curl -s -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{"parameterRanges":{"symbols":["AAPL"],"startDate":"2024-01-01","endDate":"2024-03-31","profitRequirement":[0.05]}}' \
  | jq '.success, (.results | length)'
```

## Reference

- Test Scripts: `backend/test_*.sh`
- API Endpoints: `backend/server.js`
- Response Format: Check individual service files
