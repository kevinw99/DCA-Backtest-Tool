# Design: Portfolio Parameter Refactoring

## Overview

This document describes the technical design for refactoring portfolio parameter handling to eliminate duplication and unify the logic between config-file mode and non-config mode.

## Architecture

### Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
├─────────────────────────────────────────────────────────────┤
│  PortfolioBacktestPage.js                                   │
│  ┌────────────────────────────────────────────────┐         │
│  │ Config Mode:                                   │         │
│  │   GET /api/backtest/portfolio/config/:name     │         │
│  │   → Just sends config name                     │         │
│  └────────────────────────────────────────────────┘         │
│  ┌────────────────────────────────────────────────┐         │
│  │ Non-Config Mode:                               │         │
│  │   POST /api/portfolio-backtest                 │         │
│  │   → Builds FULL params for each stock          │         │
│  │   → Merges ticker defaults with form values    │         │
│  └────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         BACKEND                              │
├─────────────────────────────────────────────────────────────┤
│  server.js                                                   │
│  ┌────────────────────────────────────────────────┐         │
│  │ Config Mode Route:                             │         │
│  │   portfolioConfigLoader.loadPortfolioConfig()  │         │
│  │   → flattenConfigToParams()                    │         │
│  │   → Merges: {...defaults, ...overrides}        │         │
│  └────────────────────────────────────────────────┘         │
│  ┌────────────────────────────────────────────────┐         │
│  │ Non-Config Mode Route:                         │         │
│  │   Accepts stocks with full params              │         │
│  │   → portfolioBacktestService processes         │         │
│  │   → Simple spread: {...defaults, ...params}    │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  portfolioBacktestService.js                                │
│  ┌────────────────────────────────────────────────┐         │
│  │   For each stock:                              │         │
│  │     {...config.defaultParams, ...stockParams}  │         │
│  └────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

**Problems:**
- Duplication: Two different parameter merging implementations
- Inefficiency: Frontend sends full params even when they match defaults
- Inconsistency: Config mode elegant, non-config mode verbose

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
├─────────────────────────────────────────────────────────────┤
│  PortfolioBacktestPage.js                                   │
│  ┌────────────────────────────────────────────────┐         │
│  │ Config Mode: (unchanged)                       │         │
│  │   GET /api/backtest/portfolio/config/:name     │         │
│  └────────────────────────────────────────────────┘         │
│  ┌────────────────────────────────────────────────┐         │
│  │ Non-Config Mode: (OPTIMIZED)                   │         │
│  │   POST /api/portfolio-backtest                 │         │
│  │   → Sends defaultParams                        │         │
│  │   → Sends ONLY stock-specific overrides        │         │
│  │   → Simple strings for stocks using defaults   │         │
│  └────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         BACKEND                              │
├─────────────────────────────────────────────────────────────┤
│  NEW: utils/parameterMerger.js                              │
│  ┌────────────────────────────────────────────────┐         │
│  │  mergeStockParameters(defaults, overrides)     │         │
│  │    → Single source of truth for merging        │         │
│  │    → Used by BOTH config and non-config modes  │         │
│  │    → Handles nested structures                 │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  server.js                                                   │
│  ┌────────────────────────────────────────────────┐         │
│  │ Config Mode Route: (REFACTORED)                │         │
│  │   portfolioConfigLoader.loadPortfolioConfig()  │         │
│  │   → Uses parameterMerger utility               │         │
│  └────────────────────────────────────────────────┘         │
│  ┌────────────────────────────────────────────────┐         │
│  │ Non-Config Mode Route: (ENHANCED)              │         │
│  │   Accepts mixed stock formats:                 │         │
│  │     - Simple strings: "AAPL"                   │         │
│  │     - With overrides: {symbol, params}         │         │
│  │   → Uses parameterMerger utility               │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  portfolioBacktestService.js (SIMPLIFIED)                   │
│  ┌────────────────────────────────────────────────┐         │
│  │   For each stock:                              │         │
│  │     mergeStockParameters(defaults, overrides)  │         │
│  └────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. New Utility: `parameterMerger.js`

**Location:** `/backend/utils/parameterMerger.js`

**Purpose:** Single source of truth for merging default parameters with stock-specific overrides

**Interface:**

```javascript
/**
 * Merges default parameters with stock-specific overrides
 *
 * @param {Object} defaults - Default parameters (can be nested or flat)
 * @param {Object} overrides - Stock-specific parameter overrides (can be nested or flat)
 * @returns {Object} Merged parameters (always flat structure)
 *
 * @example
 * const defaults = { gridIntervalPercent: 0.1, profitRequirement: 0.1 };
 * const overrides = { gridIntervalPercent: 0.15 };
 * const merged = mergeStockParameters(defaults, overrides);
 * // Result: { gridIntervalPercent: 0.15, profitRequirement: 0.1 }
 *
 * @example - Nested structure (config file format)
 * const defaults = {
 *   longStrategy: { gridIntervalPercent: 10, profitRequirement: 10 },
 *   basic: { lotSizeUsd: 10000 }
 * };
 * const overrides = {
 *   longStrategy: { gridIntervalPercent: 15 }
 * };
 * const merged = mergeStockParameters(defaults, overrides);
 * // Result: { gridIntervalPercent: 0.15, profitRequirement: 0.1, lotSizeUsd: 10000 }
 */
function mergeStockParameters(defaults, overrides) {
  // Implementation details below
}

/**
 * Flattens nested parameter structure into flat object
 * Converts percentage values from whole numbers to decimals
 *
 * @param {Object} params - Nested parameter object
 * @returns {Object} Flattened parameters
 */
function flattenParameters(params) {
  // Implementation details below
}

module.exports = {
  mergeStockParameters,
  flattenParameters
};
```

**Implementation Strategy:**

1. **Support both flat and nested structures:**
   - Non-config mode: Flat parameters (e.g., `{gridIntervalPercent: 0.1}`)
   - Config mode: Nested parameters (e.g., `{longStrategy: {gridIntervalPercent: 10}}`)

2. **Flattening logic (reuse from `portfolioConfigLoader.js`):**
   - Extract parameters from nested sections: `basic`, `longStrategy`, `shortStrategy`, `beta`, etc.
   - Merge all sections into single flat object
   - Convert percentage values (10 → 0.10) only for config mode (nested structure)

3. **Merging logic:**
   - Flatten defaults if needed
   - Flatten overrides if needed
   - Spread merge: `{...flatDefaults, ...flatOverrides}`
   - Return merged flat parameters

4. **Percentage conversion handling:**
   - If input is nested structure (config file format): Apply conversion
   - If input is already flat (non-config format): No conversion needed
   - Detection: Check if structure has `longStrategy`, `shortStrategy`, etc. keys

### 2. Refactor `portfolioConfigLoader.js`

**Current Implementation:**
```javascript
// Lines 81-123: configToBacktestParams()
stocks.map(symbol => {
  const stockOverrides = stockSpecificOverrides[symbol] || {};
  const mergedParams = {
    ...flattenedDefaults,
    ...flattenConfigToParams(stockOverrides)
  };
  return { symbol, params: mergedParams };
});
```

**New Implementation:**
```javascript
const { mergeStockParameters } = require('../utils/parameterMerger');

// Lines 81-123: configToBacktestParams()
stocks.map(symbol => {
  const stockOverrides = stockSpecificOverrides[symbol] || {};
  const mergedParams = mergeStockParameters(
    config.globalDefaults,  // Nested structure
    stockOverrides          // Nested structure
  );
  return { symbol, params: mergedParams };
});
```

**Benefits:**
- Eliminates `flattenConfigToParams()` local implementation
- Uses shared utility for consistency
- Reduces code duplication

### 3. Enhance Backend Route Handler

**File:** `/backend/server.js` (POST /api/portfolio-backtest endpoint)

**Current Implementation (lines 1398-1616):**
```javascript
app.post('/api/portfolio-backtest', async (req, res) => {
  // ... validation ...

  const config = {
    totalCapital,
    startDate,
    endDate,
    lotSizeUsd,
    maxLotsPerStock,
    defaultParams: finalDefaultParams,
    stocks,  // Array of strings or {symbol, params} objects
    // ...
  };

  const results = await portfolioBacktestService.runPortfolioBacktest(config);
  // ...
});
```

**Enhanced Implementation:**
```javascript
const { mergeStockParameters } = require('./utils/parameterMerger');

app.post('/api/portfolio-backtest', async (req, res) => {
  // ... validation ...

  // Normalize stocks array: convert all to {symbol, params} format
  const normalizedStocks = stocks.map(stock => {
    if (typeof stock === 'string') {
      // Simple string: use all defaults
      return { symbol: stock, params: {} };
    } else {
      // Object with params: keep as-is
      return {
        symbol: stock.symbol,
        params: stock.params || {}
      };
    }
  });

  const config = {
    totalCapital,
    startDate,
    endDate,
    lotSizeUsd,
    maxLotsPerStock,
    defaultParams: finalDefaultParams,
    stocks: normalizedStocks,  // Now always {symbol, params} format
    // ...
  };

  const results = await portfolioBacktestService.runPortfolioBacktest(config);
  // ...
});
```

**Benefits:**
- Normalizes mixed stock formats early
- Makes service layer simpler
- Maintains backward compatibility

### 4. Simplify `portfolioBacktestService.js`

**Current Implementation (lines 251-327):**
```javascript
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
```

**New Implementation:**
```javascript
const { mergeStockParameters } = require('../utils/parameterMerger');

for (const stockConfig of config.stocks) {
  // stockConfig is always {symbol, params} now (normalized by route handler)
  const { symbol, params: stockOverrides } = stockConfig;

  // Merge using shared utility
  let params = mergeStockParameters(config.defaultParams, stockOverrides);

  // Add portfolio constraints (always override)
  params.maxLots = config.maxLotsPerStock;
  params.lotSizeUsd = config.lotSizeUsd;

  // ... rest of logic ...
}
```

**Benefits:**
- Simpler code (no type checking needed)
- Uses shared utility
- Clear separation: merging vs. constraint enforcement

### 5. Update Frontend

**File:** `/frontend/src/components/PortfolioBacktestPage.js`

**Current Implementation (lines 243-302):**
```javascript
const stocksWithParams = paramsToUse.stocks.map(symbol => {
  const stockParams = getStockParameters(symbol);

  return {
    symbol,
    params: {
      gridIntervalPercent: (stockParams.longStrategy.gridIntervalPercent ||
                           paramsToUse.defaultParams.gridIntervalPercent) / 100,
      profitRequirement: (stockParams.longStrategy.profitRequirement ||
                         paramsToUse.defaultParams.profitRequirement) / 100,
      // ... ALL parameters (20+ lines)
    }
  };
});
```

**New Implementation:**
```javascript
const defaultParamsDecimal = {
  gridIntervalPercent: paramsToUse.defaultParams.gridIntervalPercent / 100,
  profitRequirement: paramsToUse.defaultParams.profitRequirement / 100,
  // ... all defaults converted to decimal
};

const stocksWithMinimalParams = paramsToUse.stocks.map(symbol => {
  const stockParams = getStockParameters(symbol);

  // Build ONLY the parameters that differ from defaults
  const overrides = {};

  // Check each parameter
  if (stockParams.longStrategy.gridIntervalPercent &&
      stockParams.longStrategy.gridIntervalPercent !== paramsToUse.defaultParams.gridIntervalPercent) {
    overrides.gridIntervalPercent = stockParams.longStrategy.gridIntervalPercent / 100;
  }

  if (stockParams.longStrategy.profitRequirement &&
      stockParams.longStrategy.profitRequirement !== paramsToUse.defaultParams.profitRequirement) {
    overrides.profitRequirement = stockParams.longStrategy.profitRequirement / 100;
  }

  // ... check all parameters ...

  // If no overrides, return simple string
  if (Object.keys(overrides).length === 0) {
    return symbol;
  }

  // Otherwise return object with overrides
  return { symbol, params: overrides };
});

// Send to backend
const response = await fetch('http://localhost:3001/api/portfolio-backtest', {
  method: 'POST',
  body: JSON.stringify({
    // ... portfolio params
    defaultParams: defaultParamsDecimal,
    stocks: stocksWithMinimalParams  // Mixed: strings and {symbol, params}
  })
});
```

**Benefits:**
- Significantly smaller payloads (70-90% reduction for typical portfolios)
- Simple strings when stock uses all defaults
- Only send overrides when needed
- Backend handles merging consistently

## Data Flow

### Config File Mode (No Changes)

```
1. User: GET /portfolio?config=nasdaq100
2. Frontend: GET /api/backtest/portfolio/config/nasdaq100
3. Backend:
   a. Load configs/portfolios/nasdaq100.json
   b. Extract globalDefaults (nested structure)
   c. For each stock:
      - Get stockSpecificOverrides[symbol] (nested structure or empty)
      - Call mergeStockParameters(globalDefaults, overrides)
      - Returns flat merged params
   d. Run portfolio backtest
4. Return results
```

### Non-Config Mode (New Flow)

```
1. User fills form in frontend
2. Frontend:
   a. Build defaultParams from form values
   b. For each stock:
      - Get ticker-specific defaults from stockDefaults.js
      - Compare with defaultParams
      - If different: add to overrides object
      - If same: skip (use default)
   c. Build stocks array:
      - Simple string if no overrides
      - {symbol, params: overrides} if has overrides
3. POST /api/portfolio-backtest with:
   {
     defaultParams: {...},
     stocks: ["MSFT", {symbol: "AAPL", params: {...}}, ...]
   }
4. Backend:
   a. Route handler normalizes all stocks to {symbol, params}
   b. For each stock:
      - Call mergeStockParameters(defaultParams, stock.params)
      - Returns flat merged params
      - Add portfolio constraints (maxLots, lotSizeUsd)
   c. Run portfolio backtest
5. Return results
```

## Migration Strategy

### Phase 1: Create Shared Utility (Zero Risk)
- Create `utils/parameterMerger.js`
- Extract flattening logic from `portfolioConfigLoader.js`
- Add comprehensive unit tests
- No impact on running system

### Phase 2: Refactor Config Mode (Low Risk)
- Update `portfolioConfigLoader.js` to use new utility
- Test with existing config files
- Verify all tests pass
- Config mode API unchanged

### Phase 3: Enhance Non-Config Backend (Low Risk)
- Update route handler to normalize stocks array
- Update service to use shared utility
- Maintain backward compatibility (accept old format)
- Test with both old and new formats

### Phase 4: Optimize Frontend (Medium Risk)
- Update frontend to send minimal params
- Add feature flag for gradual rollout
- Test with various stock configurations
- Monitor payload sizes

## Testing Strategy

### Unit Tests

1. **parameterMerger.js:**
   - Test flat parameter merging
   - Test nested parameter merging
   - Test percentage conversion
   - Test empty overrides
   - Test full overrides

2. **portfolioConfigLoader.js:**
   - Test with existing config files
   - Test parameter merging with overrides
   - Test backward compatibility

3. **Route handler:**
   - Test simple string stocks
   - Test object stocks with params
   - Test mixed formats
   - Test backward compatibility with old format

### Integration Tests

1. **Config mode:**
   - Load nasdaq100.json and run backtest
   - Verify results match previous version
   - Test with stock overrides

2. **Non-config mode:**
   - Test with old format (full params per stock)
   - Test with new format (minimal params)
   - Test with mixed stock formats
   - Verify results match old implementation

### Verification Commands

**Test 1: Old format (should still work):**
```bash
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "defaultParams": {...},
    "stocks": [
      {
        "symbol": "AAPL",
        "params": {
          "gridIntervalPercent": 0.1,
          "profitRequirement": 0.1,
          // ... full params
        }
      }
    ]
  }'
```

**Test 2: New format (simple strings):**
```bash
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "defaultParams": {...},
    "stocks": ["AAPL", "MSFT", "NVDA"]
  }'
```

**Test 3: New format (mixed):**
```bash
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "defaultParams": {
      "gridIntervalPercent": 0.1,
      "profitRequirement": 0.1,
      // ... defaults
    },
    "stocks": [
      "MSFT",  // Uses all defaults
      "NVDA",  // Uses all defaults
      {
        "symbol": "AAPL",
        "params": {
          "gridIntervalPercent": 0.15,  // Only override
          "profitRequirement": 0.15
        }
      }
    ]
  }'
```

**Test 4: Config mode (should work unchanged):**
```bash
curl http://localhost:3001/api/backtest/portfolio/config/nasdaq100
```

## Error Handling

### Backend Validation

1. **Route handler:**
   - Validate stocks array is not empty
   - Validate each stock is string or {symbol, params} object
   - Validate symbols are valid format
   - Return 400 Bad Request for invalid format

2. **Parameter merger:**
   - Handle missing defaults gracefully
   - Handle empty overrides
   - Validate parameter types
   - Log warnings for unknown parameters

### Frontend Validation

1. **Before sending:**
   - Validate all stocks have symbols
   - Validate override values are valid numbers/booleans
   - Validate required defaultParams are present

## Backward Compatibility

### Guaranteed Compatibility

1. **Old curl commands:** Continue to work
   - Full params per stock still accepted
   - Backend handles both formats

2. **Config files:** No changes required
   - Existing config files work unchanged
   - Same config file format

3. **API contract:** No breaking changes
   - POST /api/portfolio-backtest accepts same fields
   - Additional flexibility (mixed formats) is additive

### Deprecation Path (Future)

Eventually we could deprecate full params per stock:
1. Add deprecation warning in logs when old format detected
2. Document new format as preferred
3. After 6+ months, consider making old format unsupported

## Performance Impact

### Expected Improvements

1. **Payload size:** 70-90% reduction for typical portfolios
   - Example: 8 stocks × 20 params = 160 values
   - New: 20 defaults + 2-4 overrides = 22-24 values
   - Reduction: ~85%

2. **Network transfer:** Faster API calls
   - Smaller JSON payloads
   - Less bandwidth usage

3. **Parsing time:** Negligible difference
   - Merging adds minimal overhead
   - Already doing similar work in service layer

### Potential Concerns

1. **Additional function call:** `mergeStockParameters()` adds one function call per stock
   - Impact: Negligible (JavaScript object spread is fast)
   - Benefit: Cleaner code worth minimal overhead

2. **Frontend logic:** More complex parameter comparison
   - Impact: One-time cost when building request
   - Benefit: Significantly smaller payloads

## Security Considerations

- **No new attack vectors:** Still validating all parameters
- **No sensitive data exposure:** Same data as before, just less of it
- **Input validation:** Maintained at same level
- **Config file path traversal:** Existing protection unchanged

## Future Enhancements

1. **Smart defaults from ticker metadata:**
   - Use historical volatility to suggest grid intervals
   - Use market cap for lot sizing recommendations

2. **Parameter presets:**
   - Save common parameter combinations
   - Quick selection of conservative/moderate/aggressive strategies

3. **Diff visualization:**
   - Show which stocks use custom parameters
   - Highlight overrides in UI

4. **Validation improvements:**
   - Suggest optimal parameter ranges
   - Warn about potentially problematic combinations
