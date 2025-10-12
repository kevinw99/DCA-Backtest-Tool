# Spec 27: Directional Strategy Control - Task List

## Status: ✅ 100% COMPLETE

All tasks have been successfully implemented, tested, and documented.

---

## Phase 1: Backend Implementation

### ✅ Task 1.1: Add Backend Defaults
**Status**: COMPLETE
**File**: `backend/config/backtestDefaults.json`

**Changes**:
```json
{
  "enableAdaptiveTrailingBuy": false,
  "enableAdaptiveTrailingSell": false
}
```

**Verification**: Defaults applied when parameters not provided in request

---

### ✅ Task 1.2: Add Validation
**Status**: COMPLETE
**File**: `backend/middleware/validation.js`
**Lines**: 161-168

**Changes**:
```javascript
// Spec 27: Directional strategy control flags (optional)
const { enableAdaptiveTrailingBuy, enableAdaptiveTrailingSell } = req.body;
if (enableAdaptiveTrailingBuy !== undefined && typeof enableAdaptiveTrailingBuy !== 'boolean') {
  throw new Error('enableAdaptiveTrailingBuy must be boolean');
}
if (enableAdaptiveTrailingSell !== undefined && typeof enableAdaptiveTrailingSell !== 'boolean') {
  throw new Error('enableAdaptiveTrailingSell must be boolean');
}
```

**Verification**:
- Send non-boolean value → 400 error with clear message
- Send boolean value → passes validation

---

### ✅ Task 1.3: Update DCA Backtest Service
**Status**: COMPLETE
**File**: `backend/services/dcaBacktestService.js`

**Changes**:

1. **Function Parameters** (lines 567-568):
```javascript
enableAdaptiveTrailingBuy = false,
enableAdaptiveTrailingSell = false,
```

2. **Modified `calculateAdaptiveSellParameters`** (lines 394-474):
```javascript
// Spec 27: Check if we should block or allow downtrend sells
if (isDowntrend) {
  if (!enableAdaptiveTrailingSell) {
    return {
      activation,
      pullback,
      skipProfitRequirement: false,
      isAdaptive: false,
      direction: 'down_blocked_spec27',
      blockReason: 'traditional_uptrend_only'
    };
  }
  // Continue with adaptive logic...
}
```

3. **Modified `calculateAdaptiveBuyParameters`** (lines 476-551):
```javascript
// Spec 27: Check if we should block or allow uptrend buys
if (isUptrend) {
  if (!enableAdaptiveTrailingBuy) {
    return {
      activation,
      rebound,
      isAdaptive: false,
      direction: 'up_blocked_spec27',
      blockReason: 'traditional_downtrend_only'
    };
  }
  // Continue with adaptive logic...
}
```

4. **Configuration Logging** (lines 656-670):
```javascript
if (enableConsecutiveIncrementalBuyGrid) {
  if (enableAdaptiveTrailingBuy) {
    console.log(`📈 Buy Direction: ADAPTIVE (Spec 25) - allows uptrend buys`);
  } else {
    console.log(`📉 Buy Direction: TRADITIONAL (Spec 17) - downtrend only`);
  }
}
```

5. **Execution Blocking Logs** (lines 982-998, 1413-1420):
```javascript
if (direction === 'up_blocked_spec27') {
  console.log(`🚫 BUY BLOCKED (Spec 27): Price rising but enableAdaptiveTrailingBuy=false`);
  return;
}
```

**Verification**:
- flags=false → Traditional mode with blocking
- flags=true → Adaptive mode with allowing

---

### ✅ Task 1.4: Update Route Handler
**Status**: COMPLETE
**File**: `backend/server.js`

**Changes**:

1. **Parameter Extraction** (lines 693-696):
```javascript
// Spec 27: Directional strategy control flags
enableAdaptiveTrailingBuy,
enableAdaptiveTrailingSell
} = params;
```

2. **Function Call** (lines 928-929):
```javascript
enableAdaptiveTrailingBuy: finalParams.enableAdaptiveTrailingBuy,
enableAdaptiveTrailingSell: finalParams.enableAdaptiveTrailingSell,
```

**Verification**: Parameters correctly passed from request to service

---

### ✅ Task 1.5: Add Batch Mode Support
**Status**: COMPLETE
**File**: `backend/services/batchBacktestService.js`

**Changes**:

1. **Default Parameter Extraction** (lines 54-55)
2. **Beta Scaling Combinations** (lines 143-144)
3. **Non-Beta Scaling Combinations** (lines 204-205)
4. **Function Parameters** (lines 275-276)
5. **Merged Parameter Ranges** (lines 293-294)
6. **Frontend URL Generation** (lines 495-496)
7. **Batch Request Parameters** (lines 662-663)

**Verification**: Flags work in batch mode with proper URL generation

---

## Phase 2: Frontend Implementation

### ✅ Task 2.1: Add Default Values
**Status**: COMPLETE
**File**: `frontend/src/components/DCABacktestForm.js`
**Lines**: 96-97

**Changes**:
```javascript
// Spec 27: Directional strategy control flags
enableAdaptiveTrailingBuy: false,
enableAdaptiveTrailingSell: false,
```

---

### ✅ Task 2.2: Add URL Parameter Mappings
**Status**: COMPLETE
**File**: `frontend/src/components/DCABacktestForm.js`
**Lines**: 399-400

**Changes**:
```javascript
// Spec 27: Directional strategy control flags
enableAdaptiveTrailingBuy: (value) => value === 'true' || value === true,
enableAdaptiveTrailingSell: (value) => value === 'true' || value === true,
```

**Verification**: URL params correctly parsed from shareable links

---

### ✅ Task 2.3: Add to CommonParams List
**Status**: COMPLETE
**File**: `frontend/src/components/DCABacktestForm.js`
**Lines**: 441-442

**Changes**:
```javascript
// Spec 27: Directional strategy control flags
'enableAdaptiveTrailingBuy', 'enableAdaptiveTrailingSell',
```

**Verification**: Params included in generated URLs

---

### ✅ Task 2.4: Add Buy Checkbox UI
**Status**: COMPLETE
**File**: `frontend/src/components/DCABacktestForm.js`
**Lines**: 1972-1984

**Changes**:
```javascript
{parameters.enableConsecutiveIncrementalBuyGrid && (
  <div className="form-group checkbox-group" style={{ marginLeft: '20px' }}>
    <label>
      <input
        type="checkbox"
        checked={parameters.enableAdaptiveTrailingBuy ?? false}
        onChange={(e) => handleChange('enableAdaptiveTrailingBuy', e.target.checked)}
      />
      Enable Adaptive Uptrend Buys (Spec 25)
    </label>
    <span className="form-help">
      When enabled: Allow momentum buys when price rises (Spec 25).
      When disabled: Only buy on downtrends (Spec 17 traditional)
    </span>
  </div>
)}
```

**Verification**:
- Checkbox only appears when `enableConsecutiveIncrementalBuyGrid` is true
- Indented 20px from parent
- Clear help text
- State updates correctly

---

### ✅ Task 2.5: Add Sell Checkbox UI
**Status**: COMPLETE
**File**: `frontend/src/components/DCABacktestForm.js`
**Lines**: 2002-2017

**Changes**:
```javascript
{parameters.enableConsecutiveIncrementalSellProfit && (
  <div className="form-group checkbox-group" style={{ marginLeft: '20px' }}>
    <label>
      <input
        type="checkbox"
        checked={parameters.enableAdaptiveTrailingSell ?? false}
        onChange={(e) => handleChange('enableAdaptiveTrailingSell', e.target.checked)}
      />
      Enable Adaptive Downtrend Sells (Spec 25)
    </label>
    <span className="form-help">
      When enabled: Allow stop-loss sells when price falls (Spec 25).
      When disabled: Only sell on uptrends (Spec 18 traditional)
    </span>
  </div>
)}
```

**Verification**:
- Checkbox only appears when `enableConsecutiveIncrementalSellProfit` is true
- Indented 20px from parent
- Clear help text
- State updates correctly

---

## Phase 3: Testing & Verification

### ✅ Task 3.1: Backend Unit Testing
**Status**: COMPLETE
**Method**: Manual curl testing

**Test 1: Traditional Mode (flags=false)**
```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "TSLA",
    "startDate": "2021-09-01",
    "endDate": "2025-10-09",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "enableConsecutiveIncrementalBuyGrid": true,
    "enableConsecutiveIncrementalSellProfit": true,
    "enableAdaptiveTrailingBuy": false,
    "enableAdaptiveTrailingSell": false
  }'
```

**Results**: ✅ PASS
- Log shows: "📉 Buy Direction: TRADITIONAL (Spec 17) - downtrend only"
- Log shows: "📉 Sell Direction: TRADITIONAL (Spec 18) - uptrend only"
- Uptrend buys correctly blocked
- Downtrend sells correctly blocked

**Test 2: Adaptive Mode (flags=true)**
```bash
# Same as Test 1 but with enableAdaptiveTrailingBuy: true, enableAdaptiveTrailingSell: true
```

**Results**: ✅ PASS
- Log shows: "📈 Buy Direction: ADAPTIVE (Spec 25) - allows uptrend buys"
- Log shows: "📈 Sell Direction: ADAPTIVE (Spec 25) - allows downtrend sells"
- Uptrend buys correctly allowed
- Downtrend sells correctly allowed

---

### ✅ Task 3.2: Frontend UI Testing
**Status**: COMPLETE (Manual verification)

**Test Cases**:
1. ✅ Checkboxes hidden when parent flags disabled
2. ✅ Checkboxes appear when parent flags enabled
3. ✅ Checkboxes indented with 20px left margin
4. ✅ Help text displays correctly
5. ✅ State updates on checkbox change
6. ✅ Default values (false) applied correctly

---

### ✅ Task 3.3: URL Parameter Testing
**Status**: COMPLETE (Manual verification)

**Test Cases**:
1. ✅ Generate URL with flags=true → URL includes `&enableAdaptiveTrailingBuy=true`
2. ✅ Load URL with flags → Checkboxes show correct state
3. ✅ URL sharing works correctly

---

### ✅ Task 3.4: Batch Mode Testing
**Status**: COMPLETE (Code inspection)

**Verified**:
1. ✅ Parameters correctly extracted from batch request
2. ✅ Flags passed to individual backtest runs
3. ✅ Frontend URLs generated with both flags
4. ✅ Batch results include flag values

---

## Phase 4: Documentation

### ✅ Task 4.1: Requirements Document
**Status**: COMPLETE
**File**: `.kiro/specs/27_directional-strategy-control/requirements.md`

**Content**:
- Overview and motivation
- Two new boolean flags
- Parent flag dependencies
- Four strategy combinations
- Integration with Specs 17, 18, 25, 26
- Examples and use cases
- Testing requirements

---

### ✅ Task 4.2: Design Document
**Status**: COMPLETE
**File**: `.kiro/specs/27_directional-strategy-control/design.md`

**Content**:
- Architecture overview
- Hierarchical flag system
- Data flow diagrams
- Component integration details
- Backend and frontend implementation
- Testing strategy
- Performance considerations
- Future extensions

---

### ✅ Task 4.3: Tasks Document
**Status**: COMPLETE
**File**: `.kiro/specs/27_directional-strategy-control/tasks.md`

**Content**: This file

---

## Summary

### Files Modified

**Backend**:
1. `backend/config/backtestDefaults.json`
2. `backend/middleware/validation.js`
3. `backend/services/dcaBacktestService.js`
4. `backend/server.js`
5. `backend/services/batchBacktestService.js`

**Frontend**:
1. `frontend/src/components/DCABacktestForm.js`

**Documentation**:
1. `.kiro/specs/27_directional-strategy-control/requirements.md`
2. `.kiro/specs/27_directional-strategy-control/design.md`
3. `.kiro/specs/27_directional-strategy-control/tasks.md`

### Total Changes

- **Backend files modified**: 5
- **Frontend files modified**: 1
- **Documentation files created**: 3
- **Total lines added**: ~400
- **Backend testing**: 2 curl tests (both passing)
- **Frontend testing**: 6 manual tests (all passing)

### Implementation Quality

✅ **Code Quality**:
- Clear comments with "Spec 27" markers
- Consistent naming conventions
- Proper error handling
- Comprehensive logging

✅ **Testing Coverage**:
- Backend: Traditional and adaptive modes tested
- Frontend: UI rendering and state management tested
- Integration: URL parameters and batch mode verified

✅ **Documentation**:
- Complete requirements specification
- Detailed design document
- Comprehensive task list with verification

✅ **Backward Compatibility**:
- Default values (false) preserve existing behavior
- No breaking changes to existing APIs
- Parent flag dependencies properly enforced

---

## Completion Timestamp

**Date**: 2025-10-10
**Status**: 100% COMPLETE
**Ready for**: Production deployment
