# Spec 50: Portfolio Margin Support - Implementation Tasks

## Overview

This document provides a step-by-step implementation checklist for adding `marginPercent` parameter to portfolio backtest mode. Tasks are organized by phase with time estimates and verification steps.

**Total Estimated Time:** 4-6 hours

## Phase 0: Verification & Setup (30 min)

### Task 0.1: Verify Current State

**Time:** 15 min

**Actions:**
```bash
# Check for any existing margin-related code
grep -r "margin" backend/services/portfolioBacktestService.js
grep -r "marginPercent" backend/
grep -r "effectiveCapital" backend/
```

**Expected:** No existing margin implementation

**Verify:**
- [ ] No margin-related code in portfolio service
- [ ] Clean slate for implementation

---

### Task 0.2: Create Spec Directory & Files

**Time:** 5 min

**Actions:**
```bash
# Already done, but verify structure
ls -la .kiro/specs/50_portfolio-margin-support/
```

**Expected:**
- requirements.md ✓
- design.md ✓
- tasks.md ✓

**Verify:**
- [ ] All spec files present
- [ ] Ready to proceed with implementation

---

### Task 0.3: Review Portfolio Config Structure

**Time:** 10 min

**File:** `backend/configs/portfolios/nasdaq100.json`

**Actions:**
- Read portfolio config to understand structure
- Identify where `marginPercent` should be added
- Note validation patterns used

**Verify:**
- [ ] Understand config schema
- [ ] Know where to add `marginPercent` field
- [ ] Understand validation approach

---

## Phase 1: Core Backend Implementation (2-3 hours)

### Task 1.1: Add Margin Fields to PortfolioState Constructor

**Time:** 30 min

**File:** `backend/services/portfolioBacktestService.js`

**Location:** `PortfolioState` class constructor (~line 20)

**Changes:**
```javascript
class PortfolioState {
  constructor(config) {
    // Existing fields
    this.totalCapital = config.totalCapitalUsd;
    this.cashReserve = config.totalCapitalUsd;
    this.deployedCapital = 0;
    this.portfolioValue = config.totalCapitalUsd;
    this.totalPNL = 0;

    // NEW: Margin support
    this.marginPercent = config.marginPercent || 0;
    this.effectiveCapital = this.totalCapital * (1 + this.marginPercent / 100);

    // NEW: Margin metrics tracking
    this.marginMetrics = {
      maxMarginUtilization: 0,
      daysOnMargin: 0,
      totalMarginUtilization: 0,
      daysTracked: 0
    };

    // Rest of constructor...
  }
}
```

**Verify:**
- [ ] `marginPercent` field added with default 0
- [ ] `effectiveCapital` calculated correctly
- [ ] `marginMetrics` object initialized
- [ ] No syntax errors
- [ ] Console log added for debugging (optional)

---

### Task 1.2: Modify Capital Constraint Check Logic

**Time:** 45 min

**File:** `backend/services/portfolioBacktestService.js`

**Location:** Buy execution in main simulation loop (~line 487)

**Current Code:**
```javascript
if (portfolio.cashReserve >= currentLotSize) {
  // Execute buy
  portfolio.cashReserve -= currentLotSize;
  portfolio.deployedCapital += currentLotSize;
  stock.addBuy(tx);
  transactionCount++;
} else {
  // Reject
  console.log(`❌ BUY REJECTED`);
  logRejectedOrder(portfolio, stock, { triggered: true }, dayData, date, currentLotSize);
  rejectedCount++;
}
```

**New Code:**
```javascript
// NEW: Check margin limit
const wouldExceedMargin = (portfolio.deployedCapital + currentLotSize) > portfolio.effectiveCapital;

if (!wouldExceedMargin && portfolio.cashReserve >= currentLotSize) {
  // Execute buy - within margin limit and have cash
  portfolio.cashReserve -= currentLotSize;
  portfolio.deployedCapital += currentLotSize;
  stock.addBuy(tx);
  transactionCount++;
} else {
  // Reject - margin limit or cash constraint
  const reason = wouldExceedMargin
    ? `would exceed margin limit (${portfolio.deployedCapital.toFixed(0)} + ${currentLotSize.toFixed(0)} > ${portfolio.effectiveCapital.toFixed(0)})`
    : `insufficient cash reserve (${portfolio.cashReserve.toFixed(0)} < ${currentLotSize.toFixed(0)})`;

  console.log(`❌ BUY REJECTED for ${symbol} on ${date} - ${reason}`);
  logRejectedOrder(portfolio, stock, { triggered: true }, dayData, date, currentLotSize, reason);
  rejectedCount++;

  // Cleanup: Remove lot added by executor if needed
  if (stateBefore.lots.length < state.lots.length) {
    state.lots.pop();
  }
}
```

**Verify:**
- [ ] Margin check added before cash check
- [ ] Specific rejection reason provided
- [ ] Log messages include detailed context
- [ ] Executor state cleanup handled
- [ ] Logic tested with console logs

---

### Task 1.3: Update logRejectedOrder Function

**Time:** 30 min

**File:** `backend/services/portfolioBacktestService.js`

**Location:** `logRejectedOrder` function (~line 1052)

**Changes:**

**1. Update function signature:**
```javascript
// OLD
function logRejectedOrder(portfolio, stock, signal, dayData, date, lotSize = null)

// NEW
function logRejectedOrder(portfolio, stock, signal, dayData, date, lotSize = null, reason = null)
```

**2. Add margin context to rejected order:**
```javascript
function logRejectedOrder(portfolio, stock, signal, dayData, date, lotSize = null, reason = null) {
  const lotSizeUsd = lotSize || portfolio.config.lotSizeUsd;

  // NEW: Calculate margin context
  const marginUsed = Math.max(0, portfolio.deployedCapital - portfolio.totalCapital);
  const maxMarginAvailable = portfolio.effectiveCapital - portfolio.totalCapital;
  let marginUtilization = 0;
  if (maxMarginAvailable > 0 && marginUsed > 0) {
    marginUtilization = (marginUsed / maxMarginAvailable) * 100;
  }

  const rejectedOrder = {
    date,
    symbol: stock.symbol,
    orderType: 'BUY',
    lotSize: lotSizeUsd,
    price: dayData.close,
    reason: reason || 'Insufficient capital',  // NEW
    capitalState: {
      cashReserve: portfolio.cashReserve,
      deployedCapital: portfolio.deployedCapital,
      totalCapital: portfolio.totalCapital,
      effectiveCapital: portfolio.effectiveCapital,  // NEW
      marginPercent: portfolio.marginPercent,        // NEW
      marginUsed: marginUsed,                        // NEW
      marginUtilization: marginUtilization           // NEW
    },
    signal: {
      type: signal.type || 'REGULAR_BUY',
      triggered: signal.triggered,
      stopPrice: signal.stopPrice || null,
      reason: signal.reason || null
    }
  };

  portfolio.rejectedOrders.push(rejectedOrder);
  stock.rejectedBuys++;
  stock.rejectedBuyValues += lotSizeUsd;
  stock.rejectedOrders.push(rejectedOrder);
}
```

**Verify:**
- [ ] Function signature updated
- [ ] `reason` parameter added
- [ ] Margin context calculated
- [ ] All margin fields added to capitalState
- [ ] Rejected order includes margin context

---

### Task 1.4: Add Margin Metrics Tracking Function

**Time:** 30 min

**File:** `backend/services/portfolioBacktestService.js`

**Location:** After PortfolioState class (~line 300)

**Add New Function:**
```javascript
/**
 * Update margin utilization metrics
 * Called once per day after transaction processing
 */
function updateMarginMetrics(portfolio) {
  const { deployedCapital, totalCapital, effectiveCapital, marginMetrics } = portfolio;

  // Calculate current margin usage
  const marginUsed = Math.max(0, deployedCapital - totalCapital);
  const maxMarginAvailable = effectiveCapital - totalCapital;

  // Calculate utilization percentage
  let currentUtilization = 0;
  if (maxMarginAvailable > 0 && marginUsed > 0) {
    currentUtilization = (marginUsed / maxMarginAvailable) * 100;
  }

  // Update max utilization
  marginMetrics.maxMarginUtilization = Math.max(
    marginMetrics.maxMarginUtilization,
    currentUtilization
  );

  // Count days on margin
  if (deployedCapital > totalCapital) {
    marginMetrics.daysOnMargin++;
  }

  // Track for average calculation
  marginMetrics.totalMarginUtilization += currentUtilization;
  marginMetrics.daysTracked++;
}
```

**Integration:** Add call in main loop (~line 550)
```javascript
for (let i = 0; i < allDates.length; i++) {
  const date = allDates[i];

  // ... existing daily processing ...

  // NEW: Update margin metrics
  updateMarginMetrics(portfolio);

  // ... rest of loop ...
}
```

**Verify:**
- [ ] Function created with correct logic
- [ ] Called once per day in main loop
- [ ] Metrics calculated correctly
- [ ] No performance impact

---

### Task 1.5: Add Margin Metrics to Results Output

**Time:** 20 min

**File:** `backend/services/portfolioBacktestService.js`

**Location:** Results construction (~line 580)

**Changes:**
```javascript
// Calculate average margin utilization
const avgMarginUtilization = portfolio.marginMetrics.daysTracked > 0
  ? portfolio.marginMetrics.totalMarginUtilization / portfolio.marginMetrics.daysTracked
  : 0;

// Build results object
const results = {
  // ... existing fields ...

  capitalMetrics: {
    totalCapitalUsd: portfolio.totalCapital,
    cashReserve: portfolio.cashReserve,
    deployedCapital: portfolio.deployedCapital,
    totalCapitalDeployed: portfolio.totalCapitalDeployed,

    // NEW: Margin metrics
    marginPercent: portfolio.marginPercent,
    effectiveCapital: portfolio.effectiveCapital,
    marginUtilization: {
      max: portfolio.marginMetrics.maxMarginUtilization,
      average: avgMarginUtilization,
      daysOnMargin: portfolio.marginMetrics.daysOnMargin,
      totalDays: portfolio.marginMetrics.daysTracked
    }
  },

  // ... rest of results ...
};

return results;
```

**Verify:**
- [ ] Average margin utilization calculated
- [ ] Margin metrics added to capitalMetrics
- [ ] Results object structure correct
- [ ] All metrics included

---

## Phase 2: Validation & Configuration (30-45 min)

### Task 2.1: Add Validation to Portfolio Config Loader

**Time:** 30 min

**File:** `backend/services/portfolioConfigLoader.js`

**Location:** `validatePortfolioConfig` function

**Add Validation:**
```javascript
function validatePortfolioConfig(config) {
  // ... existing validations ...

  // NEW: Validate marginPercent if present
  if (config.marginPercent !== undefined) {
    if (typeof config.marginPercent !== 'number') {
      throw new Error('marginPercent must be a number');
    }

    if (config.marginPercent < 0) {
      throw new Error('marginPercent must be >= 0');
    }

    if (config.marginPercent > 100) {
      throw new Error('marginPercent must be <= 100 (maximum 100% leverage)');
    }

    if (!Number.isFinite(config.marginPercent)) {
      throw new Error('marginPercent must be a finite number');
    }
  }

  // Set default if not provided
  if (config.marginPercent === undefined) {
    config.marginPercent = 0;
  }

  // ... rest of validations ...

  return config;
}
```

**Verify:**
- [ ] Validation rejects negative values
- [ ] Validation rejects values > 100
- [ ] Validation rejects non-numeric values
- [ ] Validation rejects NaN/Infinity
- [ ] Default to 0 when undefined
- [ ] Error messages are clear

---

### Task 2.2: Update Portfolio Config Files (Optional)

**Time:** 15 min

**Files:** `backend/configs/portfolios/*.json`

**Action:** Add `marginPercent` to test portfolio configs

**Example:** Create test config
```json
{
  "name": "Test Portfolio - 20% Margin",
  "totalCapitalUsd": 1000000,
  "marginPercent": 20,
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "globalDefaults": { ... },
  "stocks": ["AAPL", "MSFT", "NVDA"]
}
```

**Verify:**
- [ ] Config files remain valid JSON
- [ ] Portfolio loader accepts new field
- [ ] Test configs load successfully

---

## Phase 3: Testing & Verification (1-2 hours)

### Task 3.1: Create Test Script

**Time:** 30 min

**File:** `backend/test_margin.sh`

**Content:**
```bash
#!/bin/bash

echo "=== Testing Margin Support ==="
echo ""

# Test 1: No margin (baseline)
echo "Test 1: No Margin (baseline)"
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "portfolioConfig": "test-portfolio",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }' | jq '.data.capitalMetrics'

echo ""
echo "---"
echo ""

# Test 2: 20% margin
echo "Test 2: 20% Margin"
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "portfolioConfig": "test-portfolio-margin-20",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }' | jq '.data.capitalMetrics'

echo ""
echo "---"
echo ""

# Test 3: Check rejected orders have margin context
echo "Test 3: Rejected Orders with Margin Context"
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "portfolioConfig": "test-portfolio-margin-20",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }' | jq '.data.rejectedOrders[0]'

echo ""
echo "=== Tests Complete ==="
```

**Actions:**
```bash
chmod +x backend/test_margin.sh
```

**Verify:**
- [ ] Script created
- [ ] Script executable
- [ ] Ready to run tests

---

### Task 3.2: Test with No Margin (Baseline)

**Time:** 15 min

**Command:**
```bash
./backend/test_margin.sh
```

**Expected Results:**
```json
{
  "capitalMetrics": {
    "totalCapitalUsd": 1000000,
    "marginPercent": 0,
    "effectiveCapital": 1000000,
    "marginUtilization": {
      "max": 0,
      "average": 0,
      "daysOnMargin": 0,
      "totalDays": 252
    }
  }
}
```

**Verify:**
- [ ] Backtest completes without errors
- [ ] marginPercent defaults to 0
- [ ] effectiveCapital equals totalCapital
- [ ] No margin utilization (all zeros)
- [ ] Results identical to behavior without margin field

---

### Task 3.3: Test with 20% Margin

**Time:** 15 min

**Command:**
```bash
./backend/test_margin.sh
```

**Expected Results:**
```json
{
  "capitalMetrics": {
    "totalCapitalUsd": 1000000,
    "marginPercent": 20,
    "effectiveCapital": 1200000,
    "marginUtilization": {
      "max": 85.5,
      "average": 42.3,
      "daysOnMargin": 180,
      "totalDays": 252
    }
  }
}
```

**Verify:**
- [ ] effectiveCapital = 1,200,000 (20% increase)
- [ ] Margin utilization metrics present
- [ ] Max utilization reasonable (< 100%)
- [ ] Days on margin counted
- [ ] More capital deployed than base

---

### Task 3.4: Test Validation Error Handling

**Time:** 20 min

**Test Cases:**

**1. Negative margin:**
```bash
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{"portfolioConfig": "test", "marginPercent": -10}'
```
Expected: Error "must be >= 0"

**2. Excessive margin:**
```bash
curl ... -d '{"marginPercent": 150}'
```
Expected: Error "must be <= 100"

**3. Invalid type:**
```bash
curl ... -d '{"marginPercent": "20%"}'
```
Expected: Error "must be a number"

**Verify:**
- [ ] Negative values rejected
- [ ] Values > 100 rejected
- [ ] Non-numeric values rejected
- [ ] Error messages clear and helpful

---

### Task 3.5: Test Margin Limit Enforcement

**Time:** 20 min

**Setup:**
- Use small capital ($100,000)
- Use low margin (10%)
- Use high volatility stocks

**Expected:**
- Orders rejected when limit reached
- Rejection reason: "would exceed margin limit"
- Rejected orders include margin context

**Verify Rejected Order:**
```bash
./backend/test_margin.sh | jq '.data.rejectedOrders[0]'
```

**Expected:**
```json
{
  "reason": "would exceed margin limit (108000 + 10000 > 110000)",
  "capitalState": {
    "effectiveCapital": 110000,
    "marginPercent": 10,
    "marginUsed": 8000,
    "marginUtilization": 80.0
  }
}
```

**Verify:**
- [ ] Orders rejected at margin limit
- [ ] Rejection reason specific
- [ ] Margin context included
- [ ] Margin utilization calculated correctly

---

### Task 3.6: Regression Testing

**Time:** 20 min

**Test:** Run existing portfolio configs without margin

```bash
# Test nasdaq100 config
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "portfolioConfig": "nasdaq100",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }'
```

**Verify:**
- [ ] Existing configs work unchanged
- [ ] No errors or warnings
- [ ] marginPercent defaults to 0
- [ ] Results identical to previous runs
- [ ] All existing tests pass

---

## Phase 4: Documentation & Cleanup (30 min)

### Task 4.1: Add Inline Code Comments

**Time:** 15 min

**Files:** Modified code sections

**Add Comments:**
```javascript
// Margin Support (Spec 50):
// Calculate effective capital with margin allowance.
// Example: $3M base + 20% margin = $3.6M effective capital.
this.effectiveCapital = this.totalCapital * (1 + this.marginPercent / 100);
```

**Verify:**
- [ ] Key logic sections have explanatory comments
- [ ] Comments explain "why" not just "what"
- [ ] Future maintainers can understand margin logic

---

### Task 4.2: Update Portfolio Config README

**Time:** 10 min

**File:** `backend/configs/portfolios/README.md`

**Add Documentation:**
```markdown
### marginPercent (optional)

- **Type:** Number (integer)
- **Default:** 0 (no margin)
- **Range:** 0-100
- **Description:** Percentage of additional capital available via margin. For example, `marginPercent: 20` means the portfolio can deploy up to 120% of base capital.
- **Example:**
  ```json
  {
    "totalCapitalUsd": 3000000,
    "marginPercent": 20
  }
  ```
  This allows deploying up to $3,600,000 (20% more than base $3M).
- **Use Cases:**
  - Test leverage strategies
  - Simulate margin trading accounts
  - Analyze risk/return with borrowed capital
- **Note:** Portfolio mode only. Single stock mode has no capital constraint.
```

**Verify:**
- [ ] Documentation clear and accurate
- [ ] Examples provided
- [ ] Valid range documented
- [ ] Mode restrictions explained

---

### Task 4.3: Update Spec Status

**Time:** 5 min

**File:** Create `.kiro/specs/50_portfolio-margin-support/status.md`

**Content:**
```markdown
# Spec 50: Status

**Status:** ✅ Implemented

**Implementation Date:** [Date]

**Key Changes:**
- Added `marginPercent` parameter to portfolio config schema
- Modified capital constraint logic in `portfolioBacktestService.js`
- Added margin utilization metrics to results
- Enhanced rejected order logging with margin context

**Testing:**
- ✅ No margin (baseline) - identical to current behavior
- ✅ 20% margin - allows 20% more deployment
- ✅ Validation - rejects invalid values
- ✅ Margin limit - correctly enforces limit
- ✅ Regression - existing configs unchanged

**Documentation:**
- ✅ Code comments added
- ✅ Portfolio config README updated
- ✅ Spec complete (requirements, design, tasks)

**Future Enhancements:**
- Margin interest costs
- Dynamic margin requirements
- Margin calls
- Frontend UI
```

**Verify:**
- [ ] Status documented
- [ ] All tests marked complete
- [ ] Future enhancements listed

---

## Verification Checklist

After completing all tasks, verify:

### Functional Verification

- [ ] Portfolio with margin = 0 behaves identically to current implementation
- [ ] Portfolio with margin = 20 allows ~20% more capital deployment
- [ ] Buy orders correctly rejected when margin limit reached
- [ ] Margin metrics accurately calculated and reported
- [ ] Rejected orders include margin context
- [ ] Invalid margin values rejected with clear errors

### Code Quality

- [ ] Code includes clear comments
- [ ] No console.log statements left in production code
- [ ] No syntax errors or linting issues
- [ ] Code follows existing patterns and style

### Testing

- [ ] Test script created and passing
- [ ] Manual testing shows expected behavior
- [ ] Edge cases verified
- [ ] Regression testing passed

### Documentation

- [ ] Portfolio config README updated
- [ ] Inline comments added
- [ ] Spec status documented

## Success Criteria

Implementation is complete when:

1. ✅ All Phase 1 tasks completed (core logic)
2. ✅ All Phase 2 tasks completed (validation)
3. ✅ All Phase 3 tasks completed (testing)
4. ✅ All Phase 4 tasks completed (documentation)
5. ✅ All verification checklist items checked
6. ✅ No regressions in existing functionality
7. ✅ Test script passes consistently

## Time Summary

| Phase | Estimated Time | Tasks |
|-------|----------------|-------|
| Phase 0: Verification | 30 min | 3 tasks |
| Phase 1: Core Logic | 2.5-3 hours | 5 tasks |
| Phase 2: Validation | 30-45 min | 2 tasks |
| Phase 3: Testing | 1-2 hours | 6 tasks |
| Phase 4: Documentation | 30 min | 3 tasks |
| **Total** | **4-6 hours** | **19 tasks** |

## Notes

- Phases can be done sequentially or with overlap
- Testing can reveal issues requiring Phase 1 revisits
- Documentation can be done incrementally during implementation
- Test script should be run frequently during development
- Keep server logs open for debugging: `tail -f /tmp/server_debug.log`
