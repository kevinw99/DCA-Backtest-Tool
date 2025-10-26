# G02: Backend Implementation

## Overview

This guide covers all backend code changes needed to add a new parameter, from the API layer through the service layer to the executor.

## File Modification Order

**CRITICAL**: Follow this exact order to avoid parameter drops:

1. `dcaExecutor.js` - Core trading logic (executor)
2. `dcaBacktestService.js` - Service layer orchestration
3. `server.js` - API route handler

## Step 1: Add Parameter to Executor (dcaExecutor.js)

### Location
File: `/Users/kweng/AI/DCA-Backtest-Tool/backend/services/dcaExecutor.js`

### 1.1: Add to Function Signature

Find the `runDCABacktest()` function signature and add your parameter with destructuring.

**Example (Momentum Mode - Boolean Parameter):**
```javascript
async function runDCABacktest({
  // ... existing parameters ...
  trailingSellPullbackPercent = 0.10,

  // Spec 45: Momentum-based trading
  momentumBasedBuy = false,        // NEW: Add with default value
  momentumBasedSell = false,       // NEW: Add with default value

  // ... other parameters ...
}) {
```

**Pattern for Different Types:**
```javascript
// Boolean parameters
enableFeatureX = false,

// Percentage parameters (backend uses decimals)
thresholdPercent = 0.10,  // 10%

// Numeric parameters
maxRetries = 5,

// String parameters
orderType = 'market',
```

**Line Reference**: Around line 340 in `dcaExecutor.js`

### 1.2: Add Debug Logging (Optional but Recommended)

Add logging to verify parameter values during execution.

**Example:**
```javascript
// Debug logging for momentum mode
console.log(`DEBUG params.momentumBasedBuy: ${momentumBasedBuy} extracted: ${momentumBasedBuy}`);
console.log(`DEBUG params.momentumBasedSell: ${momentumBasedSell} extracted: ${momentumBasedSell}`);
```

**Location**: After parameter extraction, before main execution loop

### 1.3: Implement Parameter Logic

Add the business logic that uses your parameter.

**Example (Momentum Buy - P/L Gating Logic):**
```javascript
// Spec 45: MOMENTUM MODE - Check position P/L
if (momentumBasedBuy) {
  // Exception: First buy always allowed (no position yet)
  if (lots.length > 0 && positionPnL <= 0) {
    transactionLog.push(colorize(
      `✗ MOMENTUM BUY BLOCKED: Position P/L ${positionPnL.toFixed(2)} ≤ 0`,
      'yellow'
    ));
    buyBlockedByPnL++;
    return false;  // Blocked - not profitable
  }
}
```

**Location**: Wherever the parameter affects trading decisions (inside daily loop, in order execution functions, etc.)

### 1.4: Add Statistics Tracking

If your parameter generates statistics, add tracking variables and include them in results.

**Example (Momentum Statistics):**
```javascript
// Initialize statistics tracking
let buyBlockedByPnL = 0;
let maxLotsReached = 0;

// ... in daily loop ...
if (momentumBasedBuy && positionPnL <= 0) {
  buyBlockedByPnL++;  // Track blocked attempts
}

// ... in return statement ...
return {
  // ... existing results ...

  // Spec 45: Momentum statistics
  momentumMode: {
    buy: momentumBasedBuy,
    sell: momentumBasedSell
  },
  maxLotsReached,
  buyBlockedByPnL,

  // ... other results ...
};
```

**Location**:
- Initialize counters at start of function
- Increment during execution
- Return in results object (around line 2160+)

## Step 2: Add Parameter to Service Layer (dcaBacktestService.js)

### Location
File: `/Users/kweng/AI/DCA-Backtest-Tool/backend/services/dcaBacktestService.js`

### 2.1: Extract Parameter from Request

Find the `runDCABacktest()` function signature and add parameter extraction.

**Example:**
```javascript
async function runDCABacktest({
  // ... existing parameters ...
  trailingSellPullbackPercent = 0.10,

  // Spec 45: Momentum-based trading
  momentumBasedBuy = false,      // NEW: Extract with default
  momentumBasedSell = false,     // NEW: Extract with default

  // ... other parameters ...
}) {
```

**Line Reference**: Around line 606 in `dcaBacktestService.js`

### 2.2: Pass to Executor

Find where `dcaExecutor.runDCABacktest()` is called and add your parameter.

**Example:**
```javascript
const executorResults = await dcaExecutor.runDCABacktest({
  // ... existing parameters ...
  trailingSellPullbackPercent,

  // Spec 45: Momentum-based trading
  momentumBasedBuy,           // NEW: Pass to executor
  momentumBasedSell,          // NEW: Pass to executor

  // ... other parameters ...
});
```

**Location**: Where executor is invoked (around line 800+)

### 2.3: Include Statistics in Results (If Applicable)

If your parameter generates statistics, include them in the results object.

**Example:**
```javascript
return {
  // ... existing results ...

  // Spec 45: Momentum-Based Trading Metrics
  momentumMode: executorResults.summary.momentumMode,
  maxLotsReached: executorResults.summary.maxLotsReached,
  buyBlockedByPnL: executorResults.summary.buyBlockedByPnL,

  // ... other results ...
};
```

**Line Reference**: Around line 1216+ in `dcaBacktestService.js`

## Step 3: Add Parameter to API Layer (server.js)

### Location
File: `/Users/kweng/AI/DCA-Backtest-Tool/backend/server.js`

### 3.1: Explicit Parameter Preservation (CRITICAL)

Find the parameter merging section and explicitly preserve your parameter.

**Example:**
```javascript
const params = {
  ...backtestConfig.mergeWithDefaults(req.body),

  // Spec 45: Explicitly preserve momentum parameters from request
  momentumBasedBuy: req.body.momentumBasedBuy ?? false,
  momentumBasedSell: req.body.momentumBasedSell ?? false,
};
```

**Why This is Needed**: The `mergeWithDefaults()` function may drop parameters that aren't in the defaults file yet. Explicit preservation ensures they survive.

**Line Reference**: Around line 679-682 in `server.js`

### 3.2: Add to runDCABacktest() Call

**CRITICAL STEP**: This is where the momentum mode bug occurred. The `runDCABacktest()` call uses an explicit parameter list. If your parameter isn't here, it gets dropped.

**Example:**
```javascript
const results = await dcaBacktestService.runDCABacktest({
  // ... ~30 existing parameters ...
  trailingStopOrderType: finalParams.trailingStopOrderType,

  // Spec 45: Momentum-based trading
  momentumBasedBuy: finalParams.momentumBasedBuy,        // NEW: MUST ADD HERE
  momentumBasedSell: finalParams.momentumBasedSell,      // NEW: MUST ADD HERE

  // ... other parameters ...
});
```

**Line Reference**: Around line 913-914 in `server.js`

**Common Bug**: Forgetting this step means the parameter appears in req.body and params but doesn't reach the service layer.

### 3.3: Add to API Response (If Applicable)

If your parameter generates statistics or affects results, include them in the API response.

**Example:**
```javascript
res.json({
  success: true,
  data: {
    // ... existing response fields ...

    // Spec 45: Include momentum mode statistics
    momentumMode: results.momentumMode,
    maxLotsReached: results.maxLotsReached,
    buyBlockedByPnL: results.buyBlockedByPnL,
    positionMetrics: results.positionMetrics,

    // ... other fields ...
  }
});
```

**Line Reference**: Around line 1007-1010 in `server.js`

## Step 4: Verify Parameter Flow

### Add Debug Logging at Each Layer

**server.js (API Layer):**
```javascript
console.log('=== DEBUG: LONG DCA ENDPOINT CALLED ===');
console.log('Strategy Mode in request:', req.body.strategyMode);
console.log('momentumBasedBuy:', req.body.momentumBasedBuy);
```

**dcaBacktestService.js (Service Layer):**
```javascript
console.log('Service received momentumBasedBuy:', momentumBasedBuy);
```

**dcaExecutor.js (Executor):**
```javascript
console.log('DEBUG params.momentumBasedBuy:', momentumBasedBuy, 'extracted:', momentumBasedBuy);
```

### Test Parameter Flow

```bash
# Clear logs
> /tmp/server_debug.log

# Make test request
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "TSLA",
    "momentumBasedBuy": true,
    ...
  }'

# Check logs
grep "momentumBasedBuy" /tmp/server_debug.log
```

**Expected Output:**
```
API Layer: momentumBasedBuy: true
Service Layer: momentumBasedBuy: true
Executor: momentumBasedBuy: true extracted: true
```

## Common Backend Pitfalls

### Pitfall 1: Parameter Not in runDCABacktest() Call
**Symptom**: Parameter in req.body but undefined in service layer

**Fix**: Add to explicit parameter list in `server.js` line ~913

### Pitfall 2: Wrong Default Value
**Symptom**: Parameter works when explicitly set but fails when omitted

**Fix**: Ensure consistent defaults across all three files:
- `dcaExecutor.js` function signature
- `dcaBacktestService.js` function signature
- `server.js` explicit preservation fallback (`??` operator)

### Pitfall 3: Type Mismatch
**Symptom**: Parameter value changes type between layers

**Fix**:
- Booleans: Use `?? false` not `|| false` (avoids false being truthy)
- Numbers: Use `?? 0` for required, `?? undefined` for optional
- Strings: Use `?? 'default'` for required, `?? undefined` for optional

## Backend Implementation Checklist

- [ ] Added parameter to `dcaExecutor.js` function signature with default
- [ ] Implemented parameter logic in executor
- [ ] Added statistics tracking if needed
- [ ] Included statistics in executor return object
- [ ] Added parameter to `dcaBacktestService.js` function signature
- [ ] Passed parameter to executor call
- [ ] Included statistics in service return object
- [ ] Added explicit parameter preservation in `server.js`
- [ ] Added parameter to `runDCABacktest()` call in `server.js`
- [ ] Included statistics in API response
- [ ] Added debug logging at all three layers
- [ ] Tested parameter flow with curl command

## Real-World Example

See Spec 45 implementation for momentum mode:
- `dcaExecutor.js` lines 340-341 (extraction), 520-728 (buy logic), 1158-1225 (sell logic)
- `dcaBacktestService.js` lines 606-607 (extraction), 1216-1220 (statistics)
- `server.js` lines 679-682 (preservation), 913-914 (call), 1007-1010 (response)
