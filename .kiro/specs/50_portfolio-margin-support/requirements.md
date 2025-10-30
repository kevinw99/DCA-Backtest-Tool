# Spec 50: Portfolio Margin Support

## Overview

Add margin trading support to portfolio backtest mode, allowing portfolios to use leverage to increase buying power beyond base capital. This enables testing strategies that utilize margin financing, common in real-world portfolio management.

## Problem Statement

### Current Limitation

Portfolio backtests operate with fixed total capital constraint (`totalCapitalUsd`). When cash reserves are depleted, buy orders are rejected even if the portfolio has unrealized gains.

**Current Behavior:**
```javascript
// Portfolio starts with totalCapitalUsd = $3,000,000
// Buy orders rejected when: cashReserve < lotSizeUsd
// No ability to leverage portfolio equity
```

**Real-World Gap:**
- Real margin accounts allow borrowing against portfolio value
- Investors can deploy more than base capital
- Testing strategies with leverage is not possible

### Desired Behavior

```javascript
// Portfolio with 20% margin
// totalCapitalUsd = $3,000,000
// marginPercent = 20
// effectiveCapital = $3,600,000

// Buy orders allowed when: deployedCapital + lotSize <= $3,600,000
// Track margin usage and metrics
```

## Mode Applicability Analysis

| Mode | Applicable? | Reason |
|------|-------------|--------|
| **Single Stock** | ❌ NO | No capital constraint - infinite buying power |
| **Portfolio** | ✅ YES | Has shared capital pool constraint |
| **Batch** | ✅ YES | When running portfolio configs |

**Scope:** Portfolio backtest mode ONLY

## Parameter Specification

### Parameter Details

- **Name:** `marginPercent`
- **Type:** Number (integer percentage)
- **Range:** 0 to 100
- **Default:** 0 (no margin)
- **Display:** Whole number with "%" suffix
- **Storage:** Store as whole number (e.g., 20 for 20%)

### Examples

```javascript
// No margin (default)
marginPercent: 0
→ effectiveCapital = $3,000,000

// 20% margin
marginPercent: 20
→ effectiveCapital = $3,600,000 ($3M × 1.2)

// 50% margin (high leverage)
marginPercent: 50
→ effectiveCapital = $4,500,000 ($3M × 1.5)
```

## Parameter Relationships Analysis

Following G01 Section 02 - Parameter Relationships Framework:

| Parameter/Condition | Affected by `marginPercent` | Contradictory to `marginPercent` |
|---------------------|----------------------------|----------------------------------|
| **`totalCapitalUsd`** | **BASE MULTIPLIER**: Margin is applied as multiplier (capital × (1 + margin/100)) | **NO**: Works with total capital, doesn't contradict |
| **`cashReserve`** | **INDIRECT**: More capital deployed means lower cash reserve over time | **NO**: Cash reserve is outcome, not input |
| **`deployedCapital`** | **LIMIT RAISED**: Can exceed totalCapitalUsd when margin > 0 | **NO**: Margin specifically enables this |
| **Capital constraint check** | **MODIFIED**: Check against effectiveCapital instead of totalCapitalUsd | **NO**: This is the core modification |
| **Order rejection logic** | **CHANGED**: Reject when exceed effectiveCapital, not just cashReserve | **NO**: Margin directly affects this |
| **`rejectedOrders`** | **REDUCED**: Fewer rejections when margin available | **NO**: Margin reduces rejections (positive effect) |
| **Capital utilization** | **INCREASED**: Can deploy more than 100% of base capital | **NO**: This is the intended effect |
| **Risk exposure** | **INCREASED**: Higher leverage = higher risk | **NO**: Risk is a consequence, not a conflict |

### Key Insights from Analysis

1. **No Direct Overrides**: Margin doesn't override other parameters, it modifies capital availability

2. **No Logical Contradictions**: Margin is compatible with all existing parameters

3. **New Conditions Introduced**:
   - Capital check: `deployedCapital + lotSize <= effectiveCapital`
   - Margin usage tracking: `(deployedCapital - totalCapital) / (effectiveCapital - totalCapital)`
   - Days on margin: Count when `deployedCapital > totalCapitalUsd`

4. **Documentation Needed**:
   - Help text: "Allows portfolio to deploy more than base capital (e.g., 20% = 120% of capital)"
   - Warning: "Higher margin = higher risk exposure"
   - Metrics: Display margin utilization in results

## Functional Requirements

### FR-1: Margin Parameter in Portfolio Config

**Location:** Portfolio config JSON files (top-level field)

```json
{
  "name": "Nasdaq 100",
  "totalCapitalUsd": 3000000,
  "marginPercent": 20,           // NEW: Add margin support
  "startDate": "2021-09-01",
  "endDate": "2025-10-17",
  "globalDefaults": { ... },
  "stocks": [ ... ]
}
```

**Behavior:**
- Field is OPTIONAL (defaults to 0 if omitted)
- Can be overridden via API request parameter
- Validated on config load

### FR-2: Effective Capital Calculation

**Formula:**
```javascript
effectiveCapital = totalCapitalUsd * (1 + marginPercent / 100)
```

**Examples:**
```
totalCapital = $3,000,000, margin = 0%  → effective = $3,000,000
totalCapital = $3,000,000, margin = 20% → effective = $3,600,000
totalCapital = $3,000,000, margin = 50% → effective = $4,500,000
```

**Implementation:**
- Calculate ONCE at portfolio initialization
- Store as `portfolio.effectiveCapital`
- Used for all capital constraint checks

### FR-3: Modified Capital Constraint Logic

**Current Logic:**
```javascript
if (cashReserve >= lotSize) {
  // Execute buy
  cashReserve -= lotSize;
  deployedCapital += lotSize;
} else {
  // Reject - insufficient cash
}
```

**New Logic with Margin:**
```javascript
const wouldExceedMargin = (deployedCapital + lotSize) > effectiveCapital;

if (!wouldExceedMargin && cashReserve >= lotSize) {
  // Execute buy - within margin limit
  cashReserve -= lotSize;
  deployedCapital += lotSize;
} else {
  // Reject - either margin limit or cash constraint
  const reason = wouldExceedMargin
    ? `would exceed margin limit (${deployed+lot} > ${effective})`
    : `insufficient cash reserve (${cash} < ${lot})`;
  rejectOrder(reason);
}
```

**Key Changes:**
1. Check margin limit BEFORE cash check
2. Provide specific rejection reason
3. Allow deployed capital to exceed base capital (when margin > 0)

### FR-4: Margin Metrics Tracking

**Metrics to Track:**

1. **Margin Utilization** (percentage of available margin used):
   ```javascript
   marginUsed = Math.max(0, deployedCapital - totalCapitalUsd)
   maxMarginAvailable = effectiveCapital - totalCapitalUsd
   marginUtilization = (marginUsed / maxMarginAvailable) * 100
   ```

2. **Max Margin Utilization** (peak usage during backtest)
   ```javascript
   maxMarginUtilization = Math.max(...daily_utilization_values)
   ```

3. **Days on Margin** (number of days when deployed > base):
   ```javascript
   daysOnMargin = count(days where deployedCapital > totalCapitalUsd)
   ```

4. **Average Margin Utilization**:
   ```javascript
   avgMarginUtilization = sum(daily_utilization) / totalDays
   ```

**Display in Results:**
```json
{
  "capitalMetrics": {
    "totalCapitalUsd": 3000000,
    "marginPercent": 20,
    "effectiveCapital": 3600000,
    "marginUtilization": {
      "max": 85.5,
      "average": 42.3,
      "daysOnMargin": 342,
      "totalDays": 1000
    }
  }
}
```

### FR-5: Enhanced Rejected Order Logging

**Add Margin Context to Rejected Orders:**

```javascript
{
  "date": "2024-08-15",
  "symbol": "NVDA",
  "orderType": "BUY",
  "lotSize": 25000,
  "price": 120.50,
  "reason": "would exceed margin limit (3580000 + 25000 > 3600000)",  // NEW
  "capitalState": {
    "cashReserve": 420000,
    "deployedCapital": 3580000,
    "totalCapital": 3000000,
    "effectiveCapital": 3600000,      // NEW
    "marginPercent": 20,              // NEW
    "marginUsed": 580000,             // NEW
    "marginUtilization": 96.7         // NEW
  }
}
```

**Benefits:**
- Clear understanding of why order rejected
- Visibility into margin usage at rejection point
- Helps tune margin settings

### FR-6: Validation Rules

**Parameter Validation:**
```javascript
function validateMarginPercent(value) {
  if (value === undefined) return 0;  // Default

  if (typeof value !== 'number') {
    throw new Error('marginPercent must be a number');
  }

  if (value < 0) {
    throw new Error('marginPercent must be >= 0');
  }

  if (value > 100) {
    throw new Error('marginPercent must be <= 100 (maximum 100% leverage)');
  }

  return value;
}
```

**Error Messages:**
- Clear and actionable
- Include valid range
- Help user correct input

## Non-Functional Requirements

### NFR-1: Backward Compatibility

**Requirement:** Existing portfolio configs without `marginPercent` must continue to work identically.

**Implementation:**
```javascript
// Default to 0 if not specified
const marginPercent = config.marginPercent ?? 0;
const effectiveCapital = totalCapital * (1 + marginPercent / 100);

// When margin = 0:
// effectiveCapital = totalCapital
// Logic behaves identically to current implementation
```

**Test:** Run existing portfolio configs and verify identical results.

### NFR-2: Performance

**Requirement:** Margin calculation should not impact backtest performance.

**Analysis:**
- `effectiveCapital` calculated ONCE at initialization (O(1))
- Daily margin check is simple comparison (O(1))
- Margin metrics update is arithmetic (O(1))

**Impact:** < 0.1% performance overhead (negligible)

### NFR-3: Accuracy

**Requirement:** Margin calculations must be precise to avoid rounding errors.

**Implementation:**
- Use JavaScript `Number` (64-bit float, ~15 decimal precision)
- Sufficient for financial calculations up to $1 trillion
- No special precision handling needed

## Success Criteria

✅ **1. Backward Compatibility**
- Portfolio backtest with `marginPercent: 0` produces identical results to current behavior
- Existing configs without `marginPercent` work unchanged
- No regression in existing tests

✅ **2. Functional Correctness**
- Portfolio with 20% margin allows ~20% more capital deployment
- Buy orders correctly rejected when margin limit reached
- Margin metrics accurately calculated

✅ **3. Validation**
- Invalid margin values rejected with clear errors
- Edge cases handled (0%, 100%, negative, non-numeric)

✅ **4. Documentation**
- Code includes clear comments explaining margin logic
- Rejected orders include margin context
- Results display margin utilization metrics

✅ **5. Testing**
- Test script created for various margin percentages
- Manual testing shows expected behavior
- Edge cases verified

## Test Scenarios

### Scenario 1: No Margin (Baseline)

**Config:**
```json
{
  "totalCapitalUsd": 1000000,
  "marginPercent": 0
}
```

**Expected:**
- Effective capital: $1,000,000
- Orders rejected when deployed reaches $1,000,000
- Behavior identical to current implementation
- No margin metrics (all zeros)

### Scenario 2: 20% Margin (Typical)

**Config:**
```json
{
  "totalCapitalUsd": 1000000,
  "marginPercent": 20
}
```

**Expected:**
- Effective capital: $1,200,000
- Orders accepted until deployed reaches $1,200,000
- Margin utilization tracked when deployed > $1,000,000
- ~20% more capital deployed over backtest period

### Scenario 3: 50% Margin (High Leverage)

**Config:**
```json
{
  "totalCapitalUsd": 1000000,
  "marginPercent": 50
}
```

**Expected:**
- Effective capital: $1,500,000
- Orders accepted until deployed reaches $1,500,000
- High margin utilization throughout backtest
- Significantly more capital deployed

### Scenario 4: Invalid Values

**Test Cases:**
```javascript
marginPercent: -10    → Error: "must be >= 0"
marginPercent: 150    → Error: "must be <= 100"
marginPercent: "20%"  → Error: "must be a number"
marginPercent: null   → Default to 0
marginPercent: undefined → Default to 0
```

### Scenario 5: Margin Limit Reached

**Setup:**
- Small capital ($100,000)
- Low margin (10%)
- High volatility stocks (many buy signals)

**Expected:**
- Orders rejected when limit reached
- Rejection reason: "would exceed margin limit"
- Rejected orders include margin context
- Margin utilization approaches 100%

## Out of Scope (Future Enhancements)

### Future: Margin Interest Costs

**Concept:** Charge interest on borrowed capital
```javascript
marginUsed = Math.max(0, deployedCapital - totalCapital)
dailyInterest = marginUsed * (annualRate / 365)
cashReserve -= dailyInterest
```

**New Parameters:**
- `marginInterestRate`: Annual percentage (e.g., 8%)

### Future: Dynamic Margin Requirements

**Concept:** Margin varies by position/volatility
```javascript
requiredMargin = calculatePositionMargin(holdings, volatility, beta)
```

### Future: Margin Calls

**Concept:** Force liquidations when threshold breached
```javascript
if (portfolioValue < deployedCapital * 0.75) {
  liquidatePositions(toMeetMarginRequirement);
}
```

### Future: Frontend UI

**Scope:** Add margin parameter to portfolio configuration UI
- Slider for margin percentage (0-100%)
- Real-time display of effective capital
- Margin utilization chart
- Risk warnings

## Dependencies

**Required Files:**
- `backend/services/portfolioBacktestService.js` - Main implementation
- `backend/services/portfolioConfigLoader.js` - Config validation
- `backend/configs/portfolios/*.json` - Portfolio configs

**No Changes Needed:**
- `dcaBacktestService.js` - Single stock mode (not applicable)
- `dcaExecutor.js` - Executor logic (unchanged)
- `URLParameterManager.js` - URL handling (not applicable)
- `DCABacktestForm.js` - Frontend form (portfolio has separate form)

## References

- G01 Guide: `.kiro/specs/generic/G01_adding-new-parameter/`
- Current capital constraint: `portfolioBacktestService.js:487-492`
- Order rejection: `portfolioBacktestService.js:1052-1091`
- Portfolio config loader: `portfolioConfigLoader.js`

## Summary

Add `marginPercent` parameter to portfolio backtest mode to enable leverage testing. Parameter is portfolio-specific (not applicable to single stock mode). Implementation focuses on modifying capital constraint logic and tracking margin usage metrics. Fully backward compatible with existing configs.
