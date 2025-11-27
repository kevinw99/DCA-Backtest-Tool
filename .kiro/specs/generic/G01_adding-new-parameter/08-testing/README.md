# G06: Testing and Verification

## Overview

This guide covers comprehensive testing procedures for new parameters across all modes (single, portfolio, batch) and all layers (backend, frontend, URL).

## IMPORTANT: Multi-Mode Testing Principle

**Test your parameter in ALL modes unless specifically excluded:**
- ✅ Single backtest (long strategy)
- ✅ Single backtest (short strategy, if applicable)
- ✅ Portfolio backtest
- ✅ Batch mode backtest

**For each mode, test:**
- Backend API (curl commands)
- Frontend UI (form controls)
- URL parameters (shareable links)
- Configuration defaults
- Parameter persistence

## Testing Layers

```
┌─────────────────────────────────────────┐
│  Layer 1: Backend API (curl tests)     │  ← Direct API testing
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Layer 2: Frontend UI (manual testing) │  ← User interaction testing
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Layer 3: URL Parameters (link sharing)│  ← Shareability testing
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Layer 4: Results Validation (logs)    │  ← Behavior verification
└─────────────────────────────────────────┘
```

## Step 1: Backend API Testing (curl)

### 1.1: Create Test Script Template

**File**: `/Users/kweng/AI/DCA-Backtest-Tool/backend/test_[parameter_name].sh`

**Example (Momentum Mode Test Script):**
```bash
#!/bin/bash

# Test [Parameter Name] Implementation (Spec XX)
# Tests parameter across all applicable modes

echo "=== Testing [Parameter Name] Implementation ==="
echo ""

# Test 1: Single Backtest - Long Strategy with Parameter Enabled
echo "Test 1: Long Strategy with [Parameter] = true"
curl -s -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "startDate": "2024-01-01",
    "endDate": "2024-03-31",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "parameterName": true
  }' | jq '{
    success: .success,
    symbol: .data.symbol,
    parameterValue: .data.parameterName,
    relevantMetrics: .data.someMetric
  }'

echo ""
echo "---"
echo ""

# Test 2: Single Backtest - Parameter Disabled (baseline)
echo "Test 2: Long Strategy with [Parameter] = false (baseline)"
curl -s -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "startDate": "2024-01-01",
    "endDate": "2024-03-31",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "parameterName": false
  }' | jq '{
    success: .success,
    symbol: .data.symbol,
    parameterValue: .data.parameterName
  }'

echo ""
echo "---"
echo ""

# Test 3: Portfolio Backtest (if applicable)
echo "Test 3: Portfolio Backtest with [Parameter] = true"
curl -s -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["PLTR", "TSLA", "NVDA"],
    "startDate": "2024-01-01",
    "endDate": "2024-03-31",
    "lotSizeUsd": 10000,
    "parameterName": true
  }' | jq '{
    success: .success,
    portfolioMetrics: .data.portfolioMetrics,
    individualBacktests: [.data.results[] | {symbol: .symbol, param: .parameterName}]
  }'

echo ""
echo "---"
echo ""

# Test 4: Batch Mode Backtest (if applicable)
echo "Test 4: Batch Mode with [Parameter] in parameter ranges"
# Note: Batch mode may require parameter ranges format
curl -s -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["PLTR", "TSLA"],
    "startDate": "2024-01-01",
    "endDate": "2024-03-31",
    "parameterRanges": {
      "parameterName": [true, false]
    }
  }' | jq '{
    success: .success,
    totalBacktests: (.data | length),
    sample: .data[0]
  }'

echo ""
echo "=== Tests Complete ==="
```

### 1.2: Make Script Executable

```bash
chmod +x /Users/kweng/AI/DCA-Backtest-Tool/backend/test_[parameter_name].sh
```

### 1.3: Run Backend Tests

```bash
# Start backend server if not running
cd /Users/kweng/AI/DCA-Backtest-Tool/backend
node server.js > /tmp/server_debug.log 2>&1 &

# Wait for server startup
sleep 3

# Run test script
./test_[parameter_name].sh
```

### 1.4: Verify Test Results

**Check for:**
- ✅ `success: true` in all responses
- ✅ Parameter value appears in response
- ✅ Parameter affects behavior (check relevant metrics)
- ✅ No errors in server logs

## Step 2: Frontend UI Testing

### 2.1: Single Backtest Form Testing

**URL**: `http://localhost:3000/`

**Test Steps:**
1. Navigate to single backtest form
2. Locate your parameter control (checkbox, input, etc.)
3. Change parameter value
4. Run backtest
5. Verify parameter appears in results
6. Check browser console for errors

**Verification:**
```javascript
// In browser console
console.log(this.state.parameters.parameterName);
```

### 2.2: Portfolio Backtest Form Testing

**URL**: `http://localhost:3000/backtest/portfolio`

**Test Steps:**
1. Navigate to portfolio backtest form
2. Verify parameter control is visible
3. Set parameter value
4. Add multiple symbols
5. Run portfolio backtest
6. Verify parameter applied to all symbols

### 2.3: Batch Mode Form Testing

**URL**: `http://localhost:3000/batch`

**Test Steps:**
1. Navigate to batch mode form
2. Verify parameter control exists
3. Test with single value
4. Test with parameter range (if applicable to batch mode)
5. Run batch backtest
6. Verify parameter combinations tested

### 2.4: Parameter Persistence Testing

**Test localStorage:**
1. Set parameter to non-default value
2. Refresh page
3. Verify parameter value persists

**Expected**: Parameter retains value after refresh

## Step 3: URL Parameter Testing

### 3.1: URL Encoding Test

**Test Steps:**
1. Set parameter in form
2. Run backtest
3. Check results URL

**Expected URL Format:**
```
http://localhost:3000/backtest/long/PLTR/results?
  startDate=2024-01-01&
  endDate=2024-03-31&
  ...
  parameterName=true  ← Should appear in URL
```

**Verification:**
```bash
# URL should include parameter
# Example for boolean:
parameterName=true

# Example for percentage:
thresholdPercent=10  # (displayed as whole number)

# Example for numeric:
maxRetries=5
```

### 3.2: URL Decoding Test

**Test Steps:**
1. Copy results URL with parameter
2. Open in new browser tab/window
3. Verify parameter restored in form
4. Verify results match original

**Expected**: Parameter values restored exactly

### 3.3: URL Sharing Test

**Test Steps:**
1. Run backtest with custom parameters
2. Copy results URL
3. Send to another browser/device
4. Verify parameter configuration loads correctly

## Step 4: Results Validation

### 4.1: Transaction Log Verification

**View transaction logs to verify parameter behavior:**

```bash
# Run backtest
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "TSLA",
    "parameterName": true,
    ...
  }' > /tmp/backtest_response.json

# Extract transaction logs
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/backtest_response.json', 'utf8'));
if (data.success && data.data.transactionLog) {
  data.data.transactionLog.forEach(line => console.log(line));
}
"
```

**Look for:**
- Parameter-specific log messages
- Behavior changes when parameter enabled vs disabled
- Statistics reflecting parameter impact

### 4.2: Statistical Verification

**Check statistics match expected behavior:**

```bash
# Compare enabled vs disabled
curl -s -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{"symbol":"PLTR","parameterName":true,...}' | jq '.data.stats'

curl -s -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{"symbol":"PLTR","parameterName":false,...}' | jq '.data.stats'

# Compare outputs
diff <(curl ... parameterName=true ...) <(curl ... parameterName=false ...)
```

## Step 5: Edge Case Testing

### 5.1: Default Value Test

**Test without providing parameter:**
```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "TSLA"
    # parameterName NOT included
  }' | jq '.data.parameterName'
```

**Expected**: Should use default value from config

### 5.2: Invalid Value Test

**Test with invalid values:**
```bash
# Boolean parameter with invalid value
curl -X POST http://localhost:3001/api/backtest/dca \
  -d '{"parameterName": "invalid"}' ...

# Percentage parameter out of range
curl -X POST http://localhost:3001/api/backtest/dca \
  -d '{"thresholdPercent": 150}' ...  # Over 100%

# Negative values for positive-only parameters
curl -X POST http://localhost:3001/api/backtest/dca \
  -d '{"maxRetries": -5}' ...
```

**Expected**: Should handle gracefully (validation error or default value)

### 5.3: Undefined/Null Test

**Test with undefined/null:**
```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -d '{"parameterName": null}' ...
```

**Expected**: Should fallback to default value

## Step 6: Multi-Symbol Testing

### 6.1: Portfolio Backtest with Parameter

**Test parameter applies to all symbols:**
```bash
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -d '{
    "symbols": ["PLTR", "TSLA", "NVDA"],
    "parameterName": true
  }' | jq '[.data.results[] | {symbol: .symbol, param: .parameterName}]'
```

**Expected**: All symbols show `parameterName: true`

### 6.2: Batch Mode with Parameter Variations

**Test parameter across different values:**
```bash
curl -X POST http://localhost:3001/api/backtest/batch \
  -d '{
    "symbols": ["PLTR", "TSLA"],
    "parameterRanges": {
      "parameterName": [true, false]
    }
  }' | jq '.data | length'
```

**Expected**: 2 symbols × 2 values = 4 backtests total

## Step 7: Server Log Verification

### 7.1: Enable Debug Logging

**Add to your code temporarily:**
```javascript
console.log('DEBUG parameterName:', parameterName, 'extracted:', parameterName);
```

### 7.2: Monitor Logs

```bash
# Clear logs
> /tmp/server_debug.log

# Run test
curl -X POST http://localhost:3001/api/backtest/dca \
  -d '{"parameterName": true}' ...

# Check logs
grep "parameterName" /tmp/server_debug.log
```

**Expected Output:**
```
API Layer: parameterName: true
Service Layer: parameterName: true
Executor: parameterName: true extracted: true
```

## Comprehensive Testing Checklist

### Backend Testing
- [ ] Tested with parameter enabled via curl
- [ ] Tested with parameter disabled via curl
- [ ] Tested with default value (parameter omitted)
- [ ] Tested in single backtest mode
- [ ] Tested in portfolio backtest mode
- [ ] Tested in batch mode
- [ ] Verified parameter appears in API response
- [ ] Verified parameter affects backtest behavior
- [ ] Checked server logs show correct parameter flow
- [ ] No errors in backend logs

### Frontend Testing
- [ ] Parameter control appears in single backtest form
- [ ] Parameter control appears in portfolio backtest form
- [ ] Parameter control appears in batch mode form
- [ ] Parameter updates state correctly
- [ ] Parameter persists to localStorage
- [ ] Parameter restores from localStorage on refresh
- [ ] No errors in browser console

### URL Testing
- [ ] Parameter appears in results URL when enabled
- [ ] Parameter appears in results URL when disabled/custom value
- [ ] Parameter correctly converts type (bool→string, decimal→percentage, etc.)
- [ ] Shared URL restores parameter correctly
- [ ] URL decoding matches original values
- [ ] Round-trip encoding/decoding works perfectly

### Results Validation
- [ ] Transaction logs show parameter-specific behavior
- [ ] Statistics reflect parameter impact
- [ ] Enabled vs disabled produces different results (if expected)
- [ ] Results match expected behavior from spec

### Edge Cases
- [ ] Handles undefined/null gracefully
- [ ] Handles invalid values gracefully
- [ ] Works with ticker-specific defaults
- [ ] Works across multiple symbols (portfolio/batch)

## Real-World Testing Example (Momentum Mode)

### Backend Test
```bash
# Test momentum buy blocks trades when P/L ≤ 0
./test_momentum_mode.sh

# Expected output shows buyBlockedByPnL > 0 when enabled
```

### Frontend Test
```
1. Navigate to http://localhost:3000/
2. Check "Enable Momentum-Based Buy"
3. Run backtest for TSLA 2021-09-01 to 2022-03-01
4. Verify buyBlockedByPnL appears in results
```

### URL Test
```
# Results URL should include:
?momentumBasedBuy=true&momentumBasedSell=false

# Share URL → parameters restore correctly
```

### Verification
```
# Transaction logs show blocked buys:
✗ MOMENTUM BUY BLOCKED: Position P/L -7167.00 ≤ 0

# Statistics show impact:
"buyBlockedByPnL": 9,
"momentumMode": {"buy": true, "sell": false}
```

## Troubleshooting Failed Tests

### Parameter Not in API Response
**Fix**: Add to server.js API response construction (G02-Step3.3)

### Parameter Not in URL
**Fix**: Add to URLParameterManager.js encoding (G05-Step1)

### Parameter Not Restored from URL
**Fix**: Add to URLParameterManager.js decoding (G05-Step2)

### Parameter Not in Frontend Form
**Fix**: Add UI control to DCABacktestForm.js (G04-Step3)

### Parameter Not Affecting Behavior
**Fix**: Verify logic in dcaExecutor.js (G02-Step1.3)

### Parameter Dropped at Service Layer
**Fix**: Add to server.js runDCABacktest() call (G02-Step3.2)

## Automated Testing Script Template

```bash
#!/bin/bash
# Comprehensive parameter test suite

echo "=== COMPREHENSIVE PARAMETER TESTING ==="

# Function to test parameter
test_parameter() {
  local mode=$1
  local value=$2
  echo "Testing $mode with parameterName=$value"

  curl -s -X POST http://localhost:3001/api/backtest/$mode \
    -H "Content-Type: application/json" \
    -d "{\"symbol\":\"PLTR\",\"parameterName\":$value}" | jq '{success, param: .data.parameterName}'
}

# Test across modes
test_parameter "dca" "true"
test_parameter "dca" "false"
test_parameter "portfolio" "true"
test_parameter "batch" "true"

echo "=== TESTS COMPLETE ==="
```

This comprehensive testing ensures your parameter works correctly across all modes and layers!
