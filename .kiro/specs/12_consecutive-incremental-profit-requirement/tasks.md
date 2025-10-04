# Consecutive Incremental Profit Requirement - Implementation Tasks

## Phase 1: Backend Configuration

### Task 1.1: Update Configuration Defaults

**File**: `config/backtestDefaults.json`

**Action**: Add new parameter to defaults

**Changes**:

```json
{
  // ... existing parameters ...
  "enableConsecutiveIncrementalSellProfit": true
}
```

**Acceptance**: Parameter exists with default value `true`

---

### Task 1.2: Update Validation Middleware

**File**: `backend/middleware/validation.js`

**Action**: Add validation rule for new parameter

**Changes**:

```javascript
const backtestParamsSchema = Joi.object({
  // ... existing fields ...
  enableConsecutiveIncrementalSellProfit: Joi.boolean().optional(),
  // ... rest of fields ...
});
```

**Acceptance**: Validation accepts boolean values for the new parameter

---

## Phase 2: DCA Backtest Service Implementation

### Task 2.1: Add Parameter to Function Signature

**File**: `backend/services/dcaBacktestService.js`
**Location**: Line ~307 (function signature)

**Action**: Add new parameter with default value

**Changes**:

```javascript
async function runDCABacktest({
  // ... existing parameters ...
  profitRequirement,
  enableDynamicGrid = true,
  normalizeToReference = true,
  dynamicGridMultiplier = 1.0,
  enableConsecutiveIncrementalSellProfit = true, // NEW
  // ... rest of parameters ...
})
```

**Acceptance**: Function accepts the new parameter

---

### Task 2.2: Add State Tracking Variables

**File**: `backend/services/dcaBacktestService.js`
**Location**: After line ~420 (after other state initialization)

**Action**: Initialize state tracking variables

**Changes**:

```javascript
// Consecutive incremental profit tracking
let lastActionType = null; // 'buy' | 'sell' | null
let lastSellPrice = null; // Price of last sell, or null
```

**Acceptance**: Variables initialized at start of backtest loop

---

### Task 2.3: Implement Effective Profit Requirement Calculation

**File**: `backend/services/dcaBacktestService.js`
**Location**: Before sell condition check (~line 700, before "Check if we should sell")

**Action**: Calculate effective profit requirement based on consecutive sell logic

**Changes**:

```javascript
// Calculate effective profit requirement for sells
let effectiveProfitRequirement = profitRequirement;

if (enableConsecutiveIncrementalSellProfit && lastActionType === 'sell' && lastSellPrice !== null) {
  // Check if price is still going up from last sell
  if (currentPrice > lastSellPrice) {
    // Calculate current grid size
    let gridSize;
    if (enableDynamicGrid) {
      gridSize = calculateDynamicGridSpacing(
        currentPrice,
        referencePrice || currentPrice,
        dynamicGridMultiplier,
        normalizeToReference
      );
    } else {
      gridSize = gridIntervalPercent;
    }

    effectiveProfitRequirement = profitRequirement + gridSize;

    if (verbose) {
      transactionLog.push(
        colorize(
          `  =� Consecutive uptrend sell: profit req increased to ${(effectiveProfitRequirement * 100).toFixed(2)}% (base ${(profitRequirement * 100).toFixed(2)}% + grid ${(gridSize * 100).toFixed(2)}%)`,
          'cyan'
        )
      );
    }
  } else if (verbose) {
    transactionLog.push(
      colorize(
        `  � Price declined from last sell ($${lastSellPrice.toFixed(2)}), using base profit req ${(profitRequirement * 100).toFixed(2)}%`,
        'cyan'
      )
    );
  }
} else if (verbose && enableConsecutiveIncrementalSellProfit && lastActionType !== 'sell') {
  transactionLog.push(
    colorize(
      `  =� Not consecutive sell, using base profit req ${(profitRequirement * 100).toFixed(2)}%`,
      'cyan'
    )
  );
}
```

**Acceptance**: Effective profit requirement calculated correctly with verbose logging

---

### Task 2.4: Update Sell Condition to Use Effective Profit Requirement

**File**: `backend/services/dcaBacktestService.js`
**Location**: Line ~705 (profit threshold calculation)

**Action**: Replace fixed profit requirement with effective profit requirement

**Before**:

```javascript
const profitThreshold = averageCost * (1 + profitRequirement);
```

**After**:

```javascript
const profitThreshold = averageCost * (1 + effectiveProfitRequirement);
```

**Acceptance**: Sell threshold uses effective profit requirement

---

### Task 2.5: Update State After Sell Execution

**File**: `backend/services/dcaBacktestService.js`
**Location**: After sell execution (~line 780, after shares sold)

**Action**: Update state tracking variables after successful sell

**Changes**:

```javascript
// Update consecutive sell tracking
lastActionType = 'sell';
lastSellPrice = currentPrice;

if (verbose) {
  transactionLog.push(
    colorize(
      `   SELL executed at $${currentPrice.toFixed(2)} (profit req: ${(effectiveProfitRequirement * 100).toFixed(2)}%)`,
      'green'
    )
  );
}
```

**Acceptance**: State updated after sell with proper logging

---

### Task 2.6: Update State After Buy Execution

**File**: `backend/services/dcaBacktestService.js`
**Location**: After buy execution (~line 580, after shares bought)

**Action**: Reset state tracking variables after successful buy

**Changes**:

```javascript
// Reset consecutive sell tracking on buy
lastActionType = 'buy';
lastSellPrice = null;

if (verbose) {
  transactionLog.push(colorize(`   BUY executed at $${currentPrice.toFixed(2)}`, 'green'));
}
```

**Acceptance**: State reset after buy with proper logging

---

## Phase 3: Short DCA Backtest Service Implementation

### Task 3.1: Add Parameter to Function Signature

**File**: `backend/services/shortDCABacktestService.js`
**Location**: Line ~337 (function signature)

**Action**: Same as Task 2.1 but for short service

**Acceptance**: Function accepts the new parameter

---

### Task 3.2: Add State Tracking Variables

**File**: `backend/services/shortDCABacktestService.js`
**Location**: After line ~424

**Action**: Initialize state tracking for shorts

**Changes**:

```javascript
// Consecutive incremental cover profit tracking
let lastActionType = null; // 'short' | 'cover' | null
let lastCoverPrice = null; // Price of last cover, or null
```

**Acceptance**: Variables initialized for short strategy

---

### Task 3.3: Implement Effective Profit Requirement Calculation (Inverse Logic)

**File**: `backend/services/shortDCABacktestService.js`
**Location**: Before cover condition check

**Action**: Calculate effective profit requirement for covers (inverse: price declining)

**Changes**: Similar to Task 2.3 but with inverse logic:

- Increase profit requirement when `lastActionType === 'cover' && currentPrice < lastCoverPrice`
- Reset when `lastActionType === 'short' || currentPrice >= lastCoverPrice`

**Acceptance**: Effective profit requirement calculated for shorts with proper inversions

---

### Task 3.4-3.6: Update Cover/Short Conditions and State

**File**: `backend/services/shortDCABacktestService.js`

**Action**: Apply Tasks 2.4-2.6 logic to short service with appropriate inversions

**Acceptance**: Short service mirrors long service with correct inverse logic

---

## Phase 4: Frontend UI Implementation

### Task 4.1: Add UI Checkbox in DCABacktestForm

**File**: `frontend/src/components/DCABacktestForm.js`
**Location**: Long Strategy Parameters section, after profit requirement input (~line 1690)

**Action**: Add checkbox control for new parameter

**Changes**:

```jsx
<div className="form-group checkbox-group">
  <label>
    <input
      type="checkbox"
      checked={parameters.enableConsecutiveIncrementalSellProfit ?? true}
      onChange={e => handleChange('enableConsecutiveIncrementalSellProfit', e.target.checked)}
    />
    Enable Consecutive Incremental Sell Profit
  </label>
  <span className="form-help">
    Increase profit requirement for consecutive sells during uptrends (profit req + grid size)
  </span>
</div>
```

**Acceptance**: Checkbox appears in form, properly bound to state

---

### Task 4.2: Update Results Display

**File**: `frontend/src/components/BacktestResults.js`
**Location**: Parameter display section

**Action**: Show whether feature is enabled in results

**Changes**:

```jsx
<div className="param-item">
  <span className="param-label">Consecutive Incremental Sell:</span>
  <span className="param-value">
    {data.parameters?.enableConsecutiveIncrementalSellProfit !== false ? 'Enabled' : 'Disabled'}
  </span>
</div>
```

**Acceptance**: Results display shows feature status

---

## Phase 5: Testing

### Task 5.1: Manual Test - Feature Enabled with Dynamic Grid

**Test Case**: AMZN 2024-01-01 to 2024-12-31

**Configuration**:

- `profitRequirement`: 0.05
- `enableDynamicGrid`: true
- `enableConsecutiveIncrementalSellProfit`: true

**Expected**:

- First sell uses 5% profit requirement
- Consecutive uptrend sells use 5% + dynamic grid size
- Price declines reset to 5%
- Buys reset to 5%

**Acceptance**: Transaction log shows varying profit requirements based on consecutive logic

---

### Task 5.2: Manual Test - Feature Enabled with Fixed Grid

**Test Case**: TSLA 2024-01-01 to 2024-12-31

**Configuration**:

- `profitRequirement`: 0.05
- `gridIntervalPercent`: 0.10
- `enableDynamicGrid`: false
- `enableConsecutiveIncrementalSellProfit`: true

**Expected**:

- First sell uses 5% profit requirement
- Consecutive uptrend sells use 15% (5% + 10%)
- Resets work correctly

**Acceptance**: Transaction log shows 5% or 15% profit requirements

---

### Task 5.3: Manual Test - Feature Disabled (Legacy Behavior)

**Test Case**: Same as Task 5.1

**Configuration**:

- `profitRequirement`: 0.05
- `enableConsecutiveIncrementalSellProfit`: false

**Expected**:

- All sells use 5% profit requirement
- No incremental behavior

**Acceptance**: Results identical to old behavior

---

### Task 5.4: Comparison Test

**Test Case**: Run same backtest with feature enabled vs disabled

**Configuration**: NVDA 2024-01-01 to 2024-12-31

**Expected**:

- Enabled version shows higher total profit during uptrends
- Enabled version shows higher profit per sell
- Transaction counts may differ

**Acceptance**: Enabled version demonstrates improved profit capture

---

## Phase 6: Documentation and Cleanup

### Task 6.1: Verify All Logging

**Action**: Review transaction logs to ensure all state changes are logged

**Acceptance**: Logs clearly show:

- When profit requirement is increased
- When profit requirement is reset
- Actual profit requirement used for each sell

---

### Task 6.2: Backend Server Restart

**Action**: Kill existing backend server and restart

**Command**:

```bash
lsof -ti:3001 | xargs kill -9 2>/dev/null && cd backend && node server.js
```

**Acceptance**: Backend running with new code

---

### Task 6.3: Final Integration Test

**Action**: Run full backtest from UI with all features enabled

**Configuration**:

- All new parameters enabled
- Dynamic grid enabled
- Beta scaling enabled (if applicable)

**Acceptance**: No errors, results display correctly, logs are clear

---

## Task Summary

| Phase                | Tasks        | Estimated Files |
| -------------------- | ------------ | --------------- |
| 1. Backend Config    | 2            | 2 files         |
| 2. DCA Service       | 6            | 1 file          |
| 3. Short DCA Service | 6            | 1 file          |
| 4. Frontend UI       | 2            | 2 files         |
| 5. Testing           | 4            | -               |
| 6. Cleanup           | 3            | -               |
| **Total**            | **23 tasks** | **6 files**     |

## Critical Path

1. Task 1.1 (Config defaults) � Task 2.1-2.6 (DCA service) � Task 4.1 (UI) � Task 5.1 (Test)
2. Task 1.2 (Validation) � All backend tasks
3. Task 3.1-3.6 (Short service) � Parallel to Task 2.x
4. Task 4.2 (Results) � After testing

## Risk Areas

1. **State synchronization**: Ensure `lastActionType` and `lastSellPrice` update correctly
2. **Grid calculation**: Verify dynamic grid integration doesn't break
3. **Logging verbosity**: Ensure logs don't become too noisy
4. **Backward compatibility**: Test with old URLs and configurations

## Dependencies

-  Dynamic grid spacing feature (already implemented)
-  `calculateDynamicGridSpacing()` function available
-  Existing sell condition logic in place
