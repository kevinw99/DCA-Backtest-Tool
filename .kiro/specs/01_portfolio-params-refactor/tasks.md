# Implementation Tasks: Portfolio Parameter Refactoring

## Overview

This document breaks down the implementation into concrete, testable tasks following the migration phases defined in design.md.

## Phase 1: Create Shared Utility (Zero Risk)

### Task 1.1: Create Parameter Merger Utility

**File:** `/backend/utils/parameterMerger.js`

**Steps:**
1. Create new file with module structure
2. Extract `flattenConfigToParams` logic from `portfolioConfigLoader.js`
3. Rename to `flattenParameters` for clarity
4. Create `mergeStockParameters` function
5. Add JSDoc documentation
6. Export both functions

**Implementation Checklist:**
- [ ] Create `/backend/utils/parameterMerger.js`
- [ ] Implement `flattenParameters(params)` function
  - [ ] Handle nested structure (longStrategy, shortStrategy, etc.)
  - [ ] Handle flat structure (pass through)
  - [ ] Convert percentages (10 → 0.10) for nested structure only
  - [ ] Merge all sections into single flat object
- [ ] Implement `mergeStockParameters(defaults, overrides)` function
  - [ ] Detect structure type (nested vs flat)
  - [ ] Flatten defaults if needed
  - [ ] Flatten overrides if needed
  - [ ] Merge using spread: `{...flatDefaults, ...flatOverrides}`
  - [ ] Return merged parameters
- [ ] Add comprehensive JSDoc comments
- [ ] Export functions

**Acceptance Criteria:**
- ✓ Functions handle both nested and flat parameter structures
- ✓ Percentage conversion works correctly for nested structures
- ✓ Merging correctly prioritizes overrides over defaults
- ✓ Code is well-documented

**Verification:**
```javascript
// Test in Node REPL
const { mergeStockParameters } = require('./backend/utils/parameterMerger');

// Test 1: Flat parameters (non-config mode)
const defaults = { gridIntervalPercent: 0.1, profitRequirement: 0.1 };
const overrides = { gridIntervalPercent: 0.15 };
console.log(mergeStockParameters(defaults, overrides));
// Expected: { gridIntervalPercent: 0.15, profitRequirement: 0.1 }

// Test 2: Nested parameters (config mode)
const nestedDefaults = {
  longStrategy: { gridIntervalPercent: 10, profitRequirement: 10 }
};
const nestedOverrides = {
  longStrategy: { gridIntervalPercent: 15 }
};
console.log(mergeStockParameters(nestedDefaults, nestedOverrides));
// Expected: { gridIntervalPercent: 0.15, profitRequirement: 0.1 }
```

---

## Phase 2: Refactor Config Mode (Low Risk)

### Task 2.1: Update Portfolio Config Loader

**File:** `/backend/services/portfolioConfigLoader.js`

**Steps:**
1. Import `mergeStockParameters` from utility
2. Replace manual merging logic with utility call
3. Remove local `flattenConfigToParams` implementation (now in utility)
4. Test with existing config files

**Implementation Checklist:**
- [ ] Add import: `const { mergeStockParameters } = require('../utils/parameterMerger');`
- [ ] Update `configToBacktestParams` function (lines 81-123)
  - [ ] Replace manual merge with `mergeStockParameters()` call
  - [ ] Pass `config.globalDefaults` and `stockOverrides`
- [ ] Remove `flattenConfigToParams` function (now uses utility version)
- [ ] Update any references to old function

**Acceptance Criteria:**
- ✓ Config loader uses shared utility
- ✓ No duplicate code for parameter flattening
- ✓ Existing config files still work
- ✓ Results match previous implementation

**Verification:**
```bash
# Test with existing config file
curl http://localhost:3001/api/backtest/portfolio/config/nasdaq100 > /tmp/new_result.json

# Compare with previous results (if saved)
# Results should be identical
```

---

## Phase 3: Enhance Non-Config Backend (Low Risk)

### Task 3.1: Update Route Handler to Normalize Stocks

**File:** `/backend/server.js`

**Steps:**
1. Import `mergeStockParameters` utility
2. Add normalization logic for stocks array
3. Convert simple strings to `{symbol, params: {}}` format
4. Maintain backward compatibility with existing format

**Implementation Checklist:**
- [ ] Add import at top of file
- [ ] Find POST /api/portfolio-backtest route (around line 1398)
- [ ] Add normalization logic after validation:
  ```javascript
  const normalizedStocks = stocks.map(stock => {
    if (typeof stock === 'string') {
      return { symbol: stock, params: {} };
    } else {
      return {
        symbol: stock.symbol,
        params: stock.params || {}
      };
    }
  });
  ```
- [ ] Update config object to use `normalizedStocks`
- [ ] Add validation for mixed format

**Acceptance Criteria:**
- ✓ Accepts stocks as simple strings: `["AAPL", "MSFT"]`
- ✓ Accepts stocks as objects: `[{symbol: "AAPL", params: {...}}]`
- ✓ Accepts mixed format: `["MSFT", {symbol: "AAPL", params: {...}}]`
- ✓ Backward compatible with old format
- ✓ Returns 400 for invalid formats

**Verification:**
```bash
# Test 1: Simple strings (new format)
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "totalCapital": 500000,
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "lotSizeUsd": 20000,
    "maxLotsPerStock": 5,
    "defaultParams": {
      "gridIntervalPercent": 0.1,
      "profitRequirement": 0.1
    },
    "stocks": ["AAPL", "MSFT"]
  }' | jq '.success'

# Test 2: Mixed format
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "totalCapital": 500000,
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "lotSizeUsd": 20000,
    "maxLotsPerStock": 5,
    "defaultParams": {
      "gridIntervalPercent": 0.1,
      "profitRequirement": 0.1
    },
    "stocks": [
      "MSFT",
      {
        "symbol": "AAPL",
        "params": {
          "gridIntervalPercent": 0.15
        }
      }
    ]
  }' | jq '.success'

# Test 3: Old format (backward compatibility)
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "totalCapital": 500000,
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "lotSizeUsd": 20000,
    "maxLotsPerStock": 5,
    "defaultParams": {
      "gridIntervalPercent": 0.1,
      "profitRequirement": 0.1
    },
    "stocks": [
      {
        "symbol": "AAPL",
        "params": {
          "gridIntervalPercent": 0.1,
          "profitRequirement": 0.1
        }
      }
    ]
  }' | jq '.success'
```

### Task 3.2: Update Portfolio Backtest Service

**File:** `/backend/services/portfolioBacktestService.js`

**Steps:**
1. Import `mergeStockParameters` utility
2. Simplify stock processing loop
3. Remove type checking (already normalized by route handler)
4. Use utility for parameter merging

**Implementation Checklist:**
- [ ] Add import at top of file
- [ ] Find stock processing loop (around line 251-327)
- [ ] Simplify stock config extraction (no type checking needed)
- [ ] Replace manual merge with utility call
- [ ] Keep portfolio constraint application (maxLots, lotSizeUsd)

**Code Changes:**
```javascript
// Before:
for (const stockConfig of config.stocks) {
  const symbol = typeof stockConfig === 'string' ? stockConfig : stockConfig.symbol;
  const stockParams = typeof stockConfig === 'string' ? {} : stockConfig.params || {};
  let params = {
    ...config.defaultParams,
    ...stockParams,
    maxLots: config.maxLotsPerStock,
    lotSizeUsd: config.lotSizeUsd
  };
  // ...
}

// After:
for (const stockConfig of config.stocks) {
  const { symbol, params: stockOverrides } = stockConfig;

  // Merge using shared utility
  let params = mergeStockParameters(config.defaultParams, stockOverrides);

  // Add portfolio constraints
  params.maxLots = config.maxLotsPerStock;
  params.lotSizeUsd = config.lotSizeUsd;

  // ...
}
```

**Acceptance Criteria:**
- ✓ Uses shared utility for merging
- ✓ No type checking needed (handled upstream)
- ✓ Portfolio constraints still applied
- ✓ Results match previous implementation

**Verification:**
Run the same curl tests from Task 3.1 and verify results are correct.

---

## Phase 4: Optimize Frontend (Medium Risk)

### Task 4.1: Create Parameter Comparison Utility

**File:** `/frontend/src/utils/parameterComparison.js`

**Steps:**
1. Create utility to compare stock params with defaults
2. Build minimal override object
3. Return only differing parameters

**Implementation Checklist:**
- [ ] Create new file
- [ ] Implement `getStockParameterOverrides(stockParams, defaultParams)` function
  - [ ] Compare each parameter
  - [ ] Only include in overrides if different from default
  - [ ] Handle undefined/null values
  - [ ] Return empty object if no differences
- [ ] Export function

**Acceptance Criteria:**
- ✓ Correctly identifies parameters that differ from defaults
- ✓ Returns empty object when all match defaults
- ✓ Handles edge cases (undefined values, etc.)

### Task 4.2: Update Portfolio Backtest Page

**File:** `/frontend/src/components/PortfolioBacktestPage.js`

**Steps:**
1. Import parameter comparison utility
2. Refactor stock params building logic
3. Send minimal overrides instead of full params
4. Use simple strings when no overrides

**Implementation Checklist:**
- [ ] Import utility function
- [ ] Find stock params building code (around lines 243-302)
- [ ] Refactor to use new approach:
  - [ ] Build defaultParams (converted to decimal)
  - [ ] For each stock:
    - [ ] Get ticker-specific defaults
    - [ ] Compare with form defaults
    - [ ] Build overrides object (only differences)
    - [ ] Return simple string if no overrides
    - [ ] Return {symbol, params: overrides} if has overrides
- [ ] Update fetch call to send new format

**Code Changes:**
```javascript
// Before (simplified):
const stocksWithParams = paramsToUse.stocks.map(symbol => {
  return {
    symbol,
    params: {
      gridIntervalPercent: ... / 100,
      profitRequirement: ... / 100,
      // ... all 20+ parameters
    }
  };
});

// After:
const defaultParamsDecimal = {
  gridIntervalPercent: paramsToUse.defaultParams.gridIntervalPercent / 100,
  profitRequirement: paramsToUse.defaultParams.profitRequirement / 100,
  // ... all defaults
};

const stocksWithMinimalParams = paramsToUse.stocks.map(symbol => {
  const stockParams = getStockParameters(symbol);
  const overrides = getStockParameterOverrides(stockParams, paramsToUse.defaultParams);

  // Convert overrides to decimal
  const overridesDecimal = Object.fromEntries(
    Object.entries(overrides).map(([key, value]) => [
      key,
      isPercentageParam(key) ? value / 100 : value
    ])
  );

  return Object.keys(overridesDecimal).length === 0
    ? symbol  // Simple string if no overrides
    : { symbol, params: overridesDecimal };  // Object with overrides
});

// Send to backend
fetch('http://localhost:3001/api/portfolio-backtest', {
  method: 'POST',
  body: JSON.stringify({
    ...portfolioParams,
    defaultParams: defaultParamsDecimal,
    stocks: stocksWithMinimalParams
  })
});
```

**Acceptance Criteria:**
- ✓ Sends simple strings for stocks using defaults
- ✓ Sends objects with overrides only when needed
- ✓ Payload size reduced by 70-90% for typical portfolios
- ✓ Results match previous implementation

**Verification:**
```bash
# Monitor network tab in browser DevTools
# Check payload size before/after

# Test in browser:
# 1. Enter 8 stocks with same parameters
#    → Should send: ["AAPL", "MSFT", ...]
# 2. Enter 8 stocks, one with different params
#    → Should send: ["MSFT", ..., {symbol: "AAPL", params: {...}}]
```

---

## Testing Tasks

### Task 5.1: Unit Tests for Parameter Merger

**Steps:**
1. Create test file for parameter merger utility
2. Test all merging scenarios
3. Test edge cases

**Test Cases:**
- [ ] Flat defaults + empty overrides → returns defaults
- [ ] Flat defaults + flat overrides → merges correctly
- [ ] Nested defaults + empty overrides → flattens and returns
- [ ] Nested defaults + nested overrides → flattens and merges
- [ ] Mixed (flat defaults + nested overrides) → handles correctly
- [ ] Percentage conversion for nested structure
- [ ] No percentage conversion for flat structure
- [ ] Empty defaults → throws error or returns overrides
- [ ] Unknown parameters → passes through

### Task 5.2: Integration Tests

**Config Mode:**
```bash
# Test existing config files work
curl http://localhost:3001/api/backtest/portfolio/config/nasdaq100 | jq '.success'
curl http://localhost:3001/api/backtest/portfolio/config/example-tech | jq '.success'

# Verify results are consistent
```

**Non-Config Mode:**
```bash
# Create comprehensive test script
cat > test_portfolio_backtest.sh << 'EOF'
#!/bin/bash

echo "Test 1: Old format (full params per stock)"
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "totalCapital": 500000,
    "startDate": "2024-01-01",
    "endDate": "2024-06-30",
    "lotSizeUsd": 20000,
    "maxLotsPerStock": 5,
    "defaultParams": {
      "gridIntervalPercent": 0.1,
      "profitRequirement": 0.1,
      "stopLossPercent": 0.3
    },
    "stocks": [
      {
        "symbol": "AAPL",
        "params": {
          "gridIntervalPercent": 0.1,
          "profitRequirement": 0.1,
          "stopLossPercent": 0.3
        }
      }
    ]
  }' | jq -r '.success, .data.summary.totalPnlPercent'

echo -e "\nTest 2: New format (simple strings)"
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "totalCapital": 500000,
    "startDate": "2024-01-01",
    "endDate": "2024-06-30",
    "lotSizeUsd": 20000,
    "maxLotsPerStock": 5,
    "defaultParams": {
      "gridIntervalPercent": 0.1,
      "profitRequirement": 0.1,
      "stopLossPercent": 0.3
    },
    "stocks": ["AAPL"]
  }' | jq -r '.success, .data.summary.totalPnlPercent'

echo -e "\nTest 3: New format (mixed with overrides)"
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "totalCapital": 500000,
    "startDate": "2024-01-01",
    "endDate": "2024-06-30",
    "lotSizeUsd": 20000,
    "maxLotsPerStock": 5,
    "defaultParams": {
      "gridIntervalPercent": 0.1,
      "profitRequirement": 0.1,
      "stopLossPercent": 0.3
    },
    "stocks": [
      "MSFT",
      {
        "symbol": "AAPL",
        "params": {
          "gridIntervalPercent": 0.15,
          "profitRequirement": 0.15
        }
      }
    ]
  }' | jq -r '.success, .data.summary.totalPnlPercent'

echo -e "\nAll tests completed!"
EOF

chmod +x test_portfolio_backtest.sh
./test_portfolio_backtest.sh
```

**Acceptance Criteria:**
- ✓ All three test formats return success: true
- ✓ Test 1 and Test 2 produce identical results (same stock, same params)
- ✓ Test 3 produces expected results with overrides

### Task 5.3: Payload Size Verification

**Steps:**
1. Test with large portfolio (8+ stocks)
2. Compare payload sizes before/after
3. Verify 70-90% reduction

**Verification Script:**
```bash
# Before optimization (save old payload)
cat > old_payload.json << 'EOF'
{
  "defaultParams": {...},
  "stocks": [
    {"symbol": "AAPL", "params": {...20+ params...}},
    {"symbol": "MSFT", "params": {...20+ params...}},
    ...
  ]
}
EOF

# After optimization (new payload)
cat > new_payload.json << 'EOF'
{
  "defaultParams": {...},
  "stocks": [
    "AAPL",
    "MSFT",
    "NVDA",
    "TSLA",
    "AMZN",
    {"symbol": "GOOG", "params": {"gridIntervalPercent": 0.15}}
  ]
}
EOF

# Compare sizes
echo "Old payload size: $(wc -c < old_payload.json) bytes"
echo "New payload size: $(wc -c < new_payload.json) bytes"
echo "Reduction: $(echo "scale=1; 100 * (1 - $(wc -c < new_payload.json) / $(wc -c < old_payload.json))" | bc)%"
```

---

## Documentation Tasks

### Task 6.1: Update API Documentation

**File:** Create `/docs/api/portfolio-backtest.md` (if doesn't exist) or update existing

**Content:**
- [ ] Document new stock array format
- [ ] Show examples of all three formats
- [ ] Explain parameter merging behavior
- [ ] Add migration guide

### Task 6.2: Update Code Comments

**Files to update:**
- [ ] `/backend/utils/parameterMerger.js` - comprehensive JSDoc
- [ ] `/backend/server.js` - comment on normalization logic
- [ ] `/backend/services/portfolioBacktestService.js` - update comments
- [ ] `/frontend/src/components/PortfolioBacktestPage.js` - explain optimization

### Task 6.3: Create Migration Guide

**File:** `/docs/migration/portfolio-params-optimization.md`

**Content:**
- [ ] Explain what changed
- [ ] Show before/after curl examples
- [ ] List benefits
- [ ] Provide migration timeline (if deprecating old format)

---

## Rollout Tasks

### Task 7.1: Feature Flag (Optional)

If gradual rollout desired:
- [ ] Add feature flag `OPTIMIZE_PORTFOLIO_PARAMS`
- [ ] Frontend checks flag before using new format
- [ ] Monitor for issues
- [ ] Remove flag after stable

### Task 7.2: Monitoring

- [ ] Add logging for payload sizes (before/after)
- [ ] Monitor error rates
- [ ] Track API response times
- [ ] Verify no performance degradation

### Task 7.3: User Communication

- [ ] Update changelog
- [ ] Notify users of optimization
- [ ] Provide examples of new format
- [ ] Announce deprecation timeline (if applicable)

---

## Summary Checklist

### Phase 1: Shared Utility ✓
- [ ] Task 1.1: Create parameter merger utility

### Phase 2: Config Mode ✓
- [ ] Task 2.1: Update portfolio config loader

### Phase 3: Non-Config Backend ✓
- [ ] Task 3.1: Update route handler
- [ ] Task 3.2: Update backtest service

### Phase 4: Frontend ✓
- [ ] Task 4.1: Create comparison utility
- [ ] Task 4.2: Update backtest page

### Testing ✓
- [ ] Task 5.1: Unit tests
- [ ] Task 5.2: Integration tests
- [ ] Task 5.3: Payload verification

### Documentation ✓
- [ ] Task 6.1: API docs
- [ ] Task 6.2: Code comments
- [ ] Task 6.3: Migration guide

### Rollout ✓
- [ ] Task 7.1: Feature flag (optional)
- [ ] Task 7.2: Monitoring
- [ ] Task 7.3: User communication

---

## Estimated Timeline

- **Phase 1:** 2-3 hours
- **Phase 2:** 1-2 hours
- **Phase 3:** 2-3 hours
- **Phase 4:** 3-4 hours
- **Testing:** 2-3 hours
- **Documentation:** 1-2 hours
- **Rollout:** 1 hour

**Total:** ~12-18 hours

## Success Metrics

1. ✓ All existing tests pass
2. ✓ New tests added and passing
3. ✓ Payload size reduced by 70-90%
4. ✓ Zero breaking changes
5. ✓ Both config and non-config modes work
6. ✓ Code duplication eliminated
7. ✓ Documentation complete
