# Spec 50: Portfolio Margin Support - Technical Design

## Architecture Overview

This feature adds margin support exclusively to portfolio backtest mode by modifying the capital constraint logic. Implementation is contained within portfolio-specific services with minimal surface area.

### High-Level Design

```
┌──────────────────────────────────────────────────────────────┐
│                  Portfolio Config File                        │
│            (nasdaq100.json, custom-portfolio.json)           │
│                                                               │
│  {                                                           │
│    "totalCapitalUsd": 3000000,                              │
│    "marginPercent": 20,        ← NEW FIELD                  │
│    "startDate": "2021-09-01",                               │
│    ...                                                       │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│            Portfolio Config Loader Service                    │
│          (portfolioConfigLoader.js)                          │
│                                                               │
│  - Load config from JSON file                                │
│  - Validate marginPercent (0-100)                           │
│  - Default to 0 if not specified                            │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│         Portfolio Backtest Service                           │
│      (portfolioBacktestService.js)                           │
│                                                               │
│  PortfolioState {                                            │
│    totalCapital: 3000000                                     │
│    marginPercent: 20           ← NEW                         │
│    effectiveCapital: 3600000   ← NEW (calculated)           │
│    cashReserve: 3000000                                      │
│    deployedCapital: 0                                        │
│    marginMetrics: { ... }      ← NEW                         │
│  }                                                            │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│             Daily Transaction Processing                      │
│                                                               │
│  For each buy order:                                         │
│    Check: deployedCapital + lotSize <= effectiveCapital     │
│    If OK: Execute buy                                        │
│    If NOT: Reject with margin limit reason                   │
│                                                               │
│  After each day:                                             │
│    Update margin metrics                                     │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│               Results with Margin Metrics                     │
│                                                               │
│  {                                                            │
│    capitalMetrics: {                                         │
│      marginPercent: 20,                                      │
│      effectiveCapital: 3600000,                              │
│      marginUtilization: { max, avg, days }                   │
│    },                                                         │
│    rejectedOrders: [ { ...marginContext... } ]               │
│  }                                                            │
└──────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Portfolio Config Schema

**File:** `backend/configs/portfolios/*.json`

**Current Schema:**
```json
{
  "name": "Portfolio Name",
  "description": "Description",
  "totalCapitalUsd": 3000000,
  "startDate": "2021-09-01",
  "endDate": "2025-10-17",
  "globalDefaults": { ... },
  "stocks": [ ... ]
}
```

**Updated Schema:**
```json
{
  "name": "Portfolio Name",
  "description": "Description",
  "totalCapitalUsd": 3000000,
  "marginPercent": 20,           // NEW: Optional, defaults to 0
  "startDate": "2021-09-01",
  "endDate": "2025-10-17",
  "globalDefaults": { ... },
  "stocks": [ ... ]
}
```

**Field Specification:**
- **Field Name:** `marginPercent`
- **Type:** Number (integer)
- **Required:** No (optional)
- **Default:** 0
- **Validation:** `0 <= value <= 100`
- **Location:** Top-level, same as `totalCapitalUsd`

### 2. PortfolioState Class

**File:** `backend/services/portfolioBacktestService.js`

**Class Definition:** Around line 20

**Current Constructor:**
```javascript
class PortfolioState {
  constructor(config) {
    this.totalCapital = config.totalCapitalUsd;
    this.cashReserve = config.totalCapitalUsd;
    this.deployedCapital = 0;
    this.portfolioValue = config.totalCapitalUsd;
    this.totalPNL = 0;

    this.stocks = new Map();
    this.rejectedOrders = [];
    this.deferredSells = [];
    // ... other fields
  }
}
```

**Updated Constructor:**
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
      maxMarginUtilization: 0,      // Peak margin usage (%)
      daysOnMargin: 0,               // Days when deployed > base
      totalMarginUtilization: 0,     // Sum for average calc
      daysTracked: 0                 // Total days
    };

    // Existing fields
    this.stocks = new Map();
    this.rejectedOrders = [];
    this.deferredSells = [];
    // ... other fields
  }
}
```

**Key Calculations:**
```javascript
// Effective capital (done ONCE at initialization)
this.effectiveCapital = this.totalCapital * (1 + this.marginPercent / 100);

// Examples:
// totalCapital = 3000000, marginPercent = 0  → effectiveCapital = 3000000
// totalCapital = 3000000, marginPercent = 20 → effectiveCapital = 3600000
// totalCapital = 3000000, marginPercent = 50 → effectiveCapital = 4500000
```

### 3. Capital Constraint Logic

**File:** `backend/services/portfolioBacktestService.js`

**Location:** Line ~487 (buy execution in main simulation loop)

**Current Implementation:**
```javascript
// Around line 480-495
if (portfolio.cashReserve >= currentLotSize) {
  // Execute buy
  portfolio.cashReserve -= currentLotSize;
  portfolio.deployedCapital += currentLotSize;
  stock.addBuy(tx);
  transactionCount++;
} else {
  // Reject - insufficient capital
  console.log(`❌ BUY REJECTED for ${symbol} on ${date} - insufficient capital`);
  logRejectedOrder(portfolio, stock, { triggered: true }, dayData, date, currentLotSize);
  rejectedCount++;
}
```

**Updated Implementation:**
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

  // NEW: Remove lot added by executor (if applicable)
  if (stateBefore.lots.length < state.lots.length) {
    state.lots.pop();
  }
}
```

**Logic Flow:**
```
1. Calculate: wouldExceedMargin = (deployed + lot) > effective
2. Check cash: cashReserve >= lotSize
3. If BOTH OK → Execute
4. If EITHER fails → Reject with specific reason
```

**Why margin check comes first:**
- Margin is the hard limit (absolute max deployment)
- Cash is a flow constraint (can recover with sells)
- Clearer rejection messages

### 4. Margin Metrics Tracking

**File:** `backend/services/portfolioBacktestService.js`

**New Function:** Add after portfolio class definition (~line 300)

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

**Integration Point:** In main simulation loop (~line 550)

```javascript
for (let i = 0; i < allDates.length; i++) {
  const date = allDates[i];

  // ... existing daily processing ...

  // NEW: Update margin metrics
  updateMarginMetrics(portfolio);

  // ... rest of loop ...
}
```

### 5. Enhanced Rejected Order Logging

**File:** `backend/services/portfolioBacktestService.js`

**Function:** `logRejectedOrder` (~line 1052)

**Current Signature:**
```javascript
function logRejectedOrder(portfolio, stock, signal, dayData, date, lotSize = null)
```

**Updated Signature:**
```javascript
function logRejectedOrder(portfolio, stock, signal, dayData, date, lotSize = null, reason = null)
```

**Updated Implementation:**
```javascript
function logRejectedOrder(portfolio, stock, signal, dayData, date, lotSize = null, reason = null) {
  const lotSizeUsd = lotSize || portfolio.config.lotSizeUsd;

  // Calculate margin context
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
    reason: reason || 'Insufficient capital',  // NEW: Specific reason
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

  // Add to portfolio and stock rejected orders
  portfolio.rejectedOrders.push(rejectedOrder);
  stock.rejectedBuys++;
  stock.rejectedBuyValues += lotSizeUsd;
  stock.rejectedOrders.push(rejectedOrder);
}
```

### 6. Results Schema

**File:** `backend/services/portfolioBacktestService.js`

**Location:** Results construction (~line 580)

**Enhanced Results Object:**
```javascript
// Calculate average margin utilization
const avgMarginUtilization = portfolio.marginMetrics.daysTracked > 0
  ? portfolio.marginMetrics.totalMarginUtilization / portfolio.marginMetrics.daysTracked
  : 0;

const results = {
  // ... existing portfolio metrics ...

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

  rejectedOrders: portfolio.rejectedOrders,  // Now includes margin context
  deferredSells: portfolio.deferredSells
};
```

### 7. Config Validation

**File:** `backend/services/portfolioConfigLoader.js`

**Function:** `validatePortfolioConfig` (~line 50)

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

## Implementation Strategy

### Phase 1: Core Logic (Minimal Risk)

**Goal:** Get basic margin support working

**Tasks:**
1. Add `marginPercent` and `effectiveCapital` to PortfolioState
2. Modify capital constraint check
3. Add margin context to rejected orders

**Risk:** Low - changes are isolated to portfolio service

### Phase 2: Metrics & Reporting

**Goal:** Provide visibility into margin usage

**Tasks:**
1. Implement `updateMarginMetrics` function
2. Call metrics update in daily loop
3. Add metrics to results output

**Risk:** Low - metrics are additive, don't affect logic

### Phase 3: Validation & Testing

**Goal:** Ensure robustness

**Tasks:**
1. Add validation in config loader
2. Write test scripts
3. Test edge cases
4. Verify backward compatibility

**Risk:** Low - validation prevents invalid inputs

## Edge Cases & Error Handling

### Edge Case 1: marginPercent = 0 (No Margin)

**Behavior:**
```javascript
effectiveCapital = totalCapital * (1 + 0/100) = totalCapital
// Logic identical to current implementation
```

**Verification:**
- Run backtest with margin = 0
- Compare results to backtest without margin field
- Should be identical (byte-for-byte if possible)

### Edge Case 2: High Margin (50-100%)

**Behavior:**
- Significantly increases buying power
- May result in very high deployed capital
- Track peak usage for risk assessment

**Consideration:**
- Add warning log if margin > 80% utilized
- Document risk implications

### Edge Case 3: Margin Limit Reached Multiple Times

**Behavior:**
- Multiple orders rejected due to margin
- Each rejection logged with context
- Margin utilization metrics show 100%

**Verification:**
- Test with small capital + low margin
- Verify all rejections have correct reason
- Check margin metrics accuracy

### Edge Case 4: Negative Cash Reserve with Margin

**Scenario:** Cash goes negative from losses, but deployed < effective

**Current Behavior:** Portfolio can have negative cash (from losses)

**New Behavior:** Same - margin doesn't change cash handling

**Logic:**
```javascript
// Cash can be negative (from losses)
// Margin check is independent
if (deployedCapital + lotSize <= effectiveCapital  // Margin OK
    && cashReserve >= lotSize) {                   // Cash OK
  // Execute
}
```

**Note:** Both checks must pass. Margin is upper bound, cash is flow constraint.

### Edge Case 5: Invalid marginPercent Values

**Validation:**
```javascript
marginPercent < 0        → Error: "must be >= 0"
marginPercent > 100      → Error: "must be <= 100"
marginPercent = NaN      → Error: "must be a finite number"
marginPercent = Infinity → Error: "must be a finite number"
marginPercent = "20"     → Error: "must be a number"
marginPercent = null     → Default to 0
marginPercent = undefined → Default to 0
```

## Backward Compatibility

### Approach

**Strategy:** Default to 0, preserve existing behavior

**Implementation:**
```javascript
// In PortfolioState constructor
this.marginPercent = config.marginPercent || 0;  // Default to 0
this.effectiveCapital = this.totalCapital * (1 + this.marginPercent / 100);

// When margin = 0:
// effectiveCapital = totalCapital
// All logic behaves identically
```

**Verification:**
```bash
# Test 1: Existing config (no marginPercent field)
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -d '{"portfolioConfig": "nasdaq100", ...}'

# Test 2: Explicit margin = 0
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -d '{"portfolioConfig": "nasdaq100-with-margin-0", ...}'

# Both should produce identical results
```

## Performance Considerations

### Computational Complexity

**Added Operations per Day:**
- 1 comparison: `deployedCapital + lotSize <= effectiveCapital` (O(1))
- 1 function call: `updateMarginMetrics(portfolio)` (O(1))
- 4 arithmetic ops in metrics: addition, max, comparison (O(1))

**Total Impact:** < 0.1% overhead (negligible)

### Memory Impact

**Additional Memory per Portfolio:**
- `marginPercent`: 8 bytes (number)
- `effectiveCapital`: 8 bytes (number)
- `marginMetrics`: ~40 bytes (object with 4 numbers)

**Total:** ~56 bytes (negligible)

### Optimization

**Calculations Done Once:**
- `effectiveCapital` calculated at initialization (not per-day)

**Calculations Done Daily:**
- Margin utilization (simple arithmetic)

**No optimization needed** - impact already minimal

## Testing Strategy

### Unit Tests (Manual via curl)

**Test 1:** No margin (baseline)
```bash
# Should behave identically to current
curl test with marginPercent = 0
```

**Test 2:** 20% margin (typical)
```bash
# Should allow 20% more deployment
curl test with marginPercent = 20
```

**Test 3:** Invalid values
```bash
# Should reject with clear errors
curl tests with negative, > 100, non-numeric values
```

### Integration Tests

**Test 4:** Full portfolio backtest with margin
```bash
# Use real portfolio config
# Verify margin metrics in results
# Check rejected orders have margin context
```

### Regression Tests

**Test 5:** Existing configs unchanged
```bash
# Run all existing portfolio configs
# Verify identical results
# No new errors or warnings
```

## Future Enhancements (Out of Scope)

### Enhancement 1: Margin Interest Costs

**Implementation:**
```javascript
// Daily interest calculation
const marginUsed = Math.max(0, deployedCapital - totalCapital);
const dailyInterest = marginUsed * (config.marginInterestRate / 365);
cashReserve -= dailyInterest;
```

**New Config Field:**
```json
{
  "marginPercent": 20,
  "marginInterestRate": 0.08  // 8% annual
}
```

### Enhancement 2: Margin Calls

**Implementation:**
```javascript
// Check margin health
const marginHealth = portfolioValue / deployedCapital;

if (marginHealth < config.marginCallThreshold) {
  // Force liquidation of positions
  liquidateToMeetMarginRequirement();
}
```

### Enhancement 3: Position-Based Margin Requirements

**Concept:** Different securities require different margin

```javascript
const requiredMargin = holdings.reduce((total, position) => {
  const marginReq = getMarginRequirement(position.symbol, position.volatility);
  return total + (position.value * marginReq);
}, 0);
```

## Risk Assessment & Mitigation

### Risk 1: Breaking Existing Tests

**Mitigation:**
- Default margin = 0 preserves behavior
- Extensive regression testing
- Feature flag if needed (not expected to be necessary)

### Risk 2: Incorrect Margin Calculations

**Mitigation:**
- Comprehensive unit tests
- Manual verification with known scenarios
- Assertion checks in code

### Risk 3: Parameter Validation Gaps

**Mitigation:**
- Strict validation in config loader
- Clear error messages
- Document valid ranges

## File Locations Summary

```
Backend Services:
  /backend/services/portfolioBacktestService.js  (Main implementation)
  /backend/services/portfolioConfigLoader.js     (Validation)

Configuration:
  /backend/configs/portfolios/*.json             (Portfolio configs)

Testing:
  /backend/test_margin.sh                        (New test script)
```

## Success Metrics

✅ **Implementation Complete When:**
1. PortfolioState has margin fields
2. Capital constraint uses effective capital
3. Margin metrics tracked and reported
4. Config validation includes marginPercent
5. Rejected orders include margin context
6. Test script created and passing
7. Backward compatibility verified
8. Code documented with clear comments

## Summary

Implementation focuses on portfolio backtest service with three key changes:
1. Add margin fields to PortfolioState
2. Modify capital constraint check
3. Track margin utilization metrics

Changes are isolated, backward compatible, and have minimal performance impact. Testing focuses on validation, edge cases, and regression prevention.
