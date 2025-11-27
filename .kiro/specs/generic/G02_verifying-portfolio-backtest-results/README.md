# G02: Verifying Portfolio Backtest Results

## Purpose

This guide provides a systematic 8-step methodology for verifying portfolio backtest results by comparing them against individual stock backtest results. It ensures that:
1. Frontend parameters reach the backend correctly
2. Portfolio aggregation logic works as expected
3. Individual stocks receive correct parameters (including beta-scaled values)
4. Results match standalone single-stock backtests (when no capital constraints exist)

**Why This Guide Exists**: Parameters may appear in the frontend URL but fail to reach the backend, causing identical results regardless of parameter values. This guide catches such bugs through systematic verification.

## Case Study: Momentum Parameters Bug

### The Discovery

When comparing these two portfolio backtest URLs:

**URL 1** (Momentum enabled):
```
momentumBasedBuy=true&momentumBasedSell=true
```

**URL 2** (Momentum disabled):
```
momentumBasedBuy=false&momentumBasedSell=false
```

**Expected**: Different results (momentum mode buys on strength, traditional mode buys on dips)
**Actual**: IDENTICAL results

### Root Cause Investigation

Examining the backend curl commands revealed the issue:

**Backend Request Payload** (from BOTH URLs):
```json
{
  "totalCapital": 500000,
  "defaultParams": {
    "gridIntervalPercent": 0.1,
    "profitRequirement": 0.1,
    "enableConsecutiveIncrementalBuyGrid": true,
    // ❌ MISSING: momentumBasedBuy
    // ❌ MISSING: momentumBasedSell
  }
}
```

**Problem**: Frontend URL includes momentum parameters, but backend payload doesn't!

**Location**: `PortfolioBacktestPage.js` - `handleSubmit` function not including momentum parameters in API request

### Lesson Learned

**URL parameters alone don't prove a feature works.** You must verify the full data flow:
1. Frontend UI → Frontend state
2. Frontend state → URL encoding
3. URL decoding → Frontend state
4. **Frontend state → Backend API payload** ⚠️ (Where this bug occurred)
5. Backend API → Service layer
6. Service layer → Executor
7. Executor → Results

## Complete Verification Methodology

### Phase 1: Single Parameter Verification

**Goal**: Verify a parameter works in isolation before testing in combination.

#### Step 1.1: Test with Curl (Backend Only)

**Purpose**: Verify backend logic works correctly without frontend involvement.

```bash
# Test parameter enabled
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "startDate": "2024-01-01",
    "endDate": "2024-03-31",
    "lotSizeUsd": 10000,
    "momentumBasedBuy": true,  # Parameter under test
    "momentumBasedSell": false,
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10
  }' | jq '{
    success,
    momentumMode: .data.momentumMode,
    buyCount: .data.summary.totalBuys,
    buyBlockedByPnL: .data.buyBlockedByPnL
  }'

# Test parameter disabled
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    ...
    "momentumBasedBuy": false,  # Parameter disabled
    ...
  }' | jq ...
```

**Verification**:
- [ ] Results are DIFFERENT when parameter value changes
- [ ] Response includes parameter value in `data.parameters` or similar
- [ ] Transaction logs show parameter-specific behavior

#### Step 1.2: Test with Frontend URL (Full Stack)

**Purpose**: Verify frontend correctly encodes and passes parameter to backend.

**URL Format**:
```
http://localhost:3000/backtest/long/PLTR/results?
  startDate=2024-01-01&
  endDate=2024-03-31&
  lotSizeUsd=10000&
  momentumBasedBuy=true&  # Parameter under test
  momentumBasedSell=false&
  gridInterval=10&
  profitReq=10
```

**Verification**:
- [ ] UI shows parameter control (checkbox, input, etc.)
- [ ] URL includes parameter in query string
- [ ] Results match curl test from Step 1.1

#### Step 1.3: Capture Backend Request

**Purpose**: Verify frontend actually sends parameter to backend.

**Method 1: Browser DevTools**
1. Open DevTools → Network tab
2. Access frontend URL
3. Find POST request to `/api/backtest/dca` or `/api/portfolio-backtest`
4. Inspect Request Payload

**Method 2: Server Logs**
```bash
# Clear log
> /tmp/server_debug.log

# Access frontend URL in browser

# Check what backend received
grep "Body Parameters:" /tmp/server_debug.log | tail -1
```

**Verification**:
- [ ] Parameter appears in request payload with correct value
- [ ] Parameter type is correct (boolean as boolean, not string)
- [ ] Parameter name matches backend expectation

### Phase 2: Portfolio Backtest Verification

Portfolio backtest has **THREE critical verification points**:

1. **Frontend URL** - User-visible configuration
2. **Backend Curl Payload** - What backend actually receives
3. **Individual Stock Results** - Per-stock parameter application

#### Step 2.1: Frontend URL Test

**Example**:
```
http://localhost:3000/portfolio-backtest?
  stocks=TSLA,AMZN,NVDA&
  totalCapital=500000&
  lotSize=20000&
  maxLots=5&
  startDate=2021-11-01&
  endDate=2025-10-19&
  momentumBasedBuy=true&  # Parameter under test
  momentumBasedSell=true&
  gridInterval=10&
  profitReq=10
```

**Verification**:
- [ ] UI reflects parameter values correctly
- [ ] URL includes all parameters
- [ ] Results page loads successfully

#### Step 2.2: Extract Backend Curl Command

**Method**: From browser DevTools Network tab, copy as curl.

**Expected Format**:
```bash
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "totalCapital": 500000,
    "startDate": "2021-11-01",
    "endDate": "2025-10-19",
    "defaultParams": {
      "momentumBasedBuy": true,  # ⚠️ VERIFY THIS EXISTS
      "momentumBasedSell": true,
      "gridIntervalPercent": 0.1,
      ...
    },
    "stocks": [...]
  }'
```

**CRITICAL VERIFICATION**:
- [ ] `defaultParams` object includes parameter under test
- [ ] Parameter value matches frontend URL
- [ ] Parameter type is correct (not stringified if should be boolean/number)

**⚠️ COMMON BUG**: Parameter appears in URL but NOT in backend payload!

#### Step 2.3: Individual Stock Result Verification

**Purpose**: Verify each stock in portfolio receives correct parameters.

**Method**: Click "View" link for individual stock in portfolio results table.

**Example URL**:
```
http://localhost:3000/backtest/long/NVDA/results?
  portfolioRunId=1761502919143-yaocock8t&
  startDate=2021-11-01&
  endDate=2025-10-19&
  momentumBasedBuy=true&  # Inherited from portfolio defaultParams
  momentumBasedSell=true&
  gridIntervalPercent=10.615&  # May be beta-scaled
  ...
```

**Verification**:
- [ ] Parameters match portfolio `defaultParams`
- [ ] Beta-scaled parameters show correct scaled values
- [ ] Stock-specific overrides (if any) are applied
- [ ] Results reflect parameter behavior (e.g., momentum buys on strength)

#### Step 2.4: Standalone Single Stock Comparison

**Purpose**: Verify portfolio stock result matches standalone single stock backtest.

**Method**:
1. From individual stock result page (Step 2.3), copy the URL
2. Remove `portfolioRunId` parameter
3. Run standalone backtest with same parameters

**Example**:
```
# Portfolio stock result (from Step 2.3)
http://localhost:3000/backtest/long/NVDA/results?
  portfolioRunId=1761502919143-yaocock8t&  # Remove this
  startDate=2021-11-01&
  endDate=2025-10-19&
  momentumBasedBuy=true&
  ...

# Standalone single stock backtest (for comparison)
http://localhost:3000/backtest/long/NVDA/results?
  startDate=2021-11-01&
  endDate=2025-10-19&
  momentumBasedBuy=true&
  ...
```

**Expected**: Results should match EXACTLY when:
- ✅ No buy rejections due to capital constraints
- ✅ No deferred selling due to capital optimization
- ✅ All parameters identical

**If results DON'T match**:

**Action 1**: Disable capital optimization features
```
# Add these to URL:
enableDeferredSelling=false&
enableAdaptiveLotSizing=false&
enableCashYield=false
```

**Action 2**: Compare transaction logs
```bash
# Portfolio stock transactions (from API response)
curl ... | jq '.data.stockResults[] | select(.symbol=="NVDA") | .transactionLog[]'

# Standalone stock transactions (from API response)
curl ... | jq '.data.transactionLog[]'

# Find first difference
diff <(curl ... | jq ...) <(curl ... | jq ...)
```

**Action 3**: Check server logs for parameter passing
```bash
grep "NVDA" /tmp/server_debug.log | grep -i "momentum\|parameter"
```

### Phase 3: Result Validation Checklist

When comparing enabled vs disabled parameter values:

#### Quantitative Checks
- [ ] **Different buy counts** (if parameter affects buy logic)
- [ ] **Different sell counts** (if parameter affects sell logic)
- [ ] **Different P/L** (if strategy is fundamentally different)
- [ ] **Different max lots reached** (if parameter affects position sizing)

#### Qualitative Checks (Transaction Logs)
- [ ] **Specific log messages** for parameter behavior (e.g., "MOMENTUM MODE: Buying on strength")
- [ ] **Execution timing differences** (e.g., buys on uptrends vs downtrends)
- [ ] **Order of operations changes** (if parameter modifies execution flow)

#### Parameter Echo Checks
- [ ] Response includes parameter in `.data.parameters` object
- [ ] Response includes parameter-specific metadata (e.g., `.data.momentumMode: true`)
- [ ] Logs show parameter value during initialization

### Phase 4: Troubleshooting Guide

#### Problem 1: Parameter Appears in URL but Not in Backend Payload

**Symptom**: Frontend URL shows `param=value`, but curl payload doesn't include it.

**Root Cause Locations**:

1. **Single Backtest**: `URLParameterManager.js`
   - `_decodeSingleParameters()` - Missing decode logic
   - `_encodeSingleParameters()` - Missing encode logic
   - Missing in parameter override arrays

2. **Portfolio Backtest**: `PortfolioBacktestPage.js`
   - `handleSubmit()` - Not including parameter in `defaultParams` object
   - State initialization - Missing from `useState()` default
   - URL parsing - Missing from `searchParams.get()` calls

**Fix**: See G01 (Adding New Parameters) for integration steps.

#### Problem 2: Same Results Regardless of Parameter Value

**Symptom**: Changing parameter value doesn't affect results.

**Diagnostic Steps**:

1. **Verify backend receives parameter**:
   ```bash
   grep "Body Parameters:" /tmp/server_debug.log
   ```

2. **Verify service layer extracts parameter**:
   ```bash
   grep "Running backtest with" /tmp/server_debug.log
   ```

3. **Verify executor receives parameter**:
   Add log in `dcaExecutor.js`:
   ```javascript
   console.log(`[EXECUTOR] momentumBasedBuy: ${momentumBasedBuy}`);
   ```

4. **Verify parameter is used in logic**:
   ```bash
   grep -n "momentumBasedBuy" backend/services/dcaExecutor.js
   ```

**Common Causes**:
- Parameter not passed from API → service layer (`server.js`)
- Parameter not passed from service → executor
- Parameter defined but never used in logic
- Parameter used in dead code (unreachable condition)

#### Problem 3: Portfolio Results Don't Match Individual Stock Results

**Symptom**: Stock result from portfolio differs from standalone single stock backtest.

**Diagnostic Flow**:

```
Is capital optimization enabled?
├─ Yes → Disable it, test again
│   ├─ Results now match → Capital constraints affecting portfolio
│   └─ Results still differ → Continue to next check
│
└─ No → Check parameter values
    ├─ Are parameters identical?
    │   ├─ No → Portfolio may be using different defaults
    │   └─ Yes → Continue to next check
    │
    └─ Compare transaction logs line by line
        ├─ Find first divergence
        ├─ Check what happened at that date
        └─ Trace through executor logic for that scenario
```

**Example: Finding First Divergence**:
```bash
# Save portfolio stock transactions
curl ... | jq '.data.stockResults[0].transactionLog[]' > portfolio_txns.txt

# Save standalone transactions
curl ... | jq '.data.transactionLog[]' > standalone_txns.txt

# Find first difference
diff -u portfolio_txns.txt standalone_txns.txt | head -20
```

#### Problem 4: UI Shows Parameter but Doesn't Update Results

**Symptom**: Clicking checkbox/changing value doesn't trigger new results.

**Diagnostic Steps**:

1. **Check React state update**:
   ```javascript
   // In component, add useEffect
   useEffect(() => {
     console.log('[STATE UPDATE] momentumBasedBuy:', parameters.momentumBasedBuy);
   }, [parameters.momentumBasedBuy]);
   ```

2. **Check form submission**:
   ```javascript
   const handleSubmit = (e) => {
     console.log('[FORM SUBMIT] Parameters:', parameters);
     // ... rest of submit logic
   };
   ```

3. **Check URL encoding**:
   - Browser DevTools → Network
   - Find POST request
   - Inspect payload
   - Verify parameter included

**Common Causes**:
- State not updating (check `handleChange` function)
- Form not re-submitting (check submit button/trigger)
- Parameter not included in submission payload
- Backend caching results (restart server)

### Phase 5: Documentation Requirements

After verifying a feature works, document:

#### In Spec (requirements.md)
- [ ] Expected behavior with parameter enabled
- [ ] Expected behavior with parameter disabled
- [ ] Interaction with other parameters (see G01/08)
- [ ] Special cases (first buy, no capital, etc.)

#### In Spec (design.md)
- [ ] Data flow diagram showing parameter path
- [ ] Backend logic description
- [ ] Frontend UI controls
- [ ] URL encoding/decoding rules

#### In Spec (testing.md)
- [ ] Curl command for testing enabled state
- [ ] Curl command for testing disabled state
- [ ] Expected output differences
- [ ] Known edge cases and validation

#### In Code Comments
```javascript
// Spec 45: Momentum-based buying
// When enabled, buys on price strength (uptrends) instead of weakness
// Overrides trailingBuyActivationPercent to 0 (immediate consideration)
// See .kiro/specs/45_momentum-based-trading/ for full details
if (momentumBasedBuy) {
  // ... implementation
}
```

## Verification Checklist Template

Copy this checklist for each new feature:

```markdown
## Feature: [Feature Name]
## Parameters: [param1, param2, ...]

### Phase 1: Single Parameter Verification
- [ ] Backend curl test (enabled) - different results ✓
- [ ] Backend curl test (disabled) - different results ✓
- [ ] Frontend URL test - matches curl results ✓
- [ ] DevTools inspection - parameter in payload ✓

### Phase 2: Portfolio Verification
- [ ] Portfolio frontend URL works ✓
- [ ] Backend curl includes parameter in defaultParams ✓
- [ ] Individual stock inherits parameter correctly ✓
- [ ] Standalone comparison matches (no capital constraints) ✓

### Phase 3: Result Validation
- [ ] Quantitative differences confirmed ✓
- [ ] Transaction log shows expected behavior ✓
- [ ] Response echoes parameter value ✓

### Phase 4: Edge Cases
- [ ] First buy/sell behavior correct ✓
- [ ] Maxlots reached behavior correct ✓
- [ ] No capital available behavior correct ✓
- [ ] Parameter conflicts handled (see G01/08) ✓

### Phase 5: Documentation
- [ ] Spec requirements.md updated ✓
- [ ] Spec design.md updated ✓
- [ ] Spec testing.md with verification commands ✓
- [ ] Code comments added ✓
```

## Best Practices

### 1. Always Test Backend First

**Why**: If backend doesn't work, frontend can't fix it. Curl tests eliminate frontend as a variable.

**Pattern**:
```
Backend curl ✓ → Frontend URL ✓ → Portfolio URL ✓
     ↓                ↓                 ↓
   Works?          Works?            Works?
```

### 2. Compare Enabled vs Disabled, Not Just Enabled

**Why**: Feature might not work, but you won't know if you only test enabled state.

**Pattern**:
```bash
# Test 1: Feature enabled
curl ... -d '{"param": true}' > enabled.json

# Test 2: Feature disabled
curl ... -d '{"param": false}' > disabled.json

# Verify different
diff <(jq '.data.summary' enabled.json) <(jq '.data.summary' disabled.json)
```

### 3. Extract Exact Backend Payload from Browser

**Why**: Frontend may transform parameters in unexpected ways.

**Method**:
```
1. Open DevTools → Network tab
2. Access frontend URL
3. Find POST request
4. Right-click → Copy → Copy as cURL
5. Use that exact curl for testing
```

**This reveals**:
- Missing parameters (bug in this guide's case study)
- Type conversions (string "true" vs boolean true)
- Unexpected parameter names (frontend vs backend naming)

### 4. Use Transaction Logs as Source of Truth

**Why**: Results summary may not show parameter effect, but transaction logs always do.

**Pattern**:
```bash
# Extract transaction logs
curl ... | jq '.data.transactionLog[]' > logs.txt

# Search for parameter-specific behavior
grep -i "momentum\|strength\|weakness" logs.txt

# Verify timing
grep "2024-01-15" logs.txt  # Check specific date behavior
```

### 5. Disable Capital Optimization for Baseline Testing

**Why**: Capital constraints introduce variable behavior that obscures parameter testing.

**Baseline Configuration**:
```json
{
  "capitalOptimization": {
    "enabled": false  // Disable for initial testing
  },
  "betaScaling": {
    "enabled": false  // Disable for initial testing
  },
  "enableDeferredSelling": false,
  "enableAdaptiveLotSizing": false,
  "enableCashYield": false
}
```

**After baseline verification**, enable optimization features one at a time.

## Integration with Other Guides

This verification guide complements:

- **G01** (Adding New Parameters): Follow G01 implementation steps, then use G02 to verify
- **Spec Template**: Include verification commands in `testing.md` section
- **CLAUDE.md**: Use curl testing approach for all bug fixes and features

## Summary

Effective verification requires testing the **complete data flow**, not just the visible UI:

1. **Backend Logic** (curl) - Does core logic work?
2. **Frontend Integration** (URL) - Does frontend pass parameters correctly?
3. **Data Flow** (DevTools/logs) - Are parameters actually reaching backend?
4. **Result Validation** (comparison) - Do results differ as expected?
5. **Edge Cases** (specific scenarios) - Does it handle special cases?

**Key Insight**: Parameters in URL don't prove anything. Only backend payload inspection proves frontend integration works.

The case study bug (momentum parameters missing from backend payload) demonstrates why this comprehensive verification is critical - UI can look perfect while silently failing.
