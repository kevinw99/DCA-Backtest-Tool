# Requirements: Portfolio Parameter Refactoring

## Problem Statement

The current portfolio backtest implementation has redundant parameter handling between config-file mode and non-config mode:

### Current Issues

1. **Non-config mode inefficiency**: Frontend sends complete parameter sets for each stock, even when they match defaults
   - Example: 8 stocks × 20+ parameters each = 160+ parameter values in curl command
   - Most parameters are identical to defaults, creating unnecessary payload bloat

2. **Duplicated logic**: Config file mode and non-config mode have separate parameter merging implementations
   - Config mode: Uses `portfolioConfigLoader.js` with `globalDefaults` + `stockSpecificOverrides`
   - Non-config mode: Frontend builds full params, backend does simple spread merge
   - No shared utility for consistent behavior

3. **Inconsistent API design**:
   - Config mode: Elegant design where stocks only specify overrides
   - Non-config mode: Verbose design requiring full parameters for each stock
   - Makes non-config mode unnecessarily complex

### Example of Current Inefficiency

**Current curl command** (simplified for clarity):
```json
{
  "defaultParams": {
    "gridIntervalPercent": 0.1,
    "profitRequirement": 0.1,
    "stopLossPercent": 0.3,
    // ... 15+ more params
  },
  "stocks": [
    {
      "symbol": "TSLA",
      "params": {
        "gridIntervalPercent": 0.1,  // ← Duplicate of default
        "profitRequirement": 0.1,     // ← Duplicate of default
        "stopLossPercent": 0.3,       // ← Duplicate of default
        // ... 15+ more duplicate params
      }
    },
    {
      "symbol": "AMZN",
      "params": {
        "gridIntervalPercent": 0.1,  // ← Duplicate again
        "profitRequirement": 0.1,     // ← Duplicate again
        // ... 15+ more duplicate params
      }
    },
    {
      "symbol": "AAPL",
      "params": {
        "gridIntervalPercent": 0.15,  // ← Only this differs!
        "profitRequirement": 0.15,    // ← Only this differs!
        "stopLossPercent": 0.3,       // ← But still duplicates default
        // ... other params mostly duplicates
      }
    }
    // ... more stocks with mostly duplicate params
  ]
}
```

**Desired curl command** (after refactoring):
```json
{
  "defaultParams": {
    "gridIntervalPercent": 0.1,
    "profitRequirement": 0.1,
    "stopLossPercent": 0.3,
    // ... all default params
  },
  "stocks": [
    "TSLA",  // ← Uses all defaults
    "AMZN",  // ← Uses all defaults
    {
      "symbol": "AAPL",
      "params": {
        "gridIntervalPercent": 0.15,  // ← Only specify differences
        "profitRequirement": 0.15
      }
    }
  ]
}
```

## Requirements

### Functional Requirements

#### FR-1: Support Mixed Stock Format in Non-Config Mode
- **Description**: The `stocks` array must support both simple strings and objects with overrides
- **Acceptance Criteria**:
  - ✓ Accept stocks as simple symbol strings: `["AAPL", "MSFT"]`
  - ✓ Accept stocks as objects with params: `[{symbol: "AAPL", params: {...}}]`
  - ✓ Allow mixing formats: `["MSFT", {symbol: "AAPL", params: {...}}]`
  - ✓ Backend merges `defaultParams` with stock-specific `params` correctly

#### FR-2: Share Parameter Merging Logic Across Both Modes
- **Description**: Create unified utility for merging defaults with stock-specific overrides
- **Acceptance Criteria**:
  - ✓ Single source of truth for parameter merging logic
  - ✓ Config file mode uses the shared utility
  - ✓ Non-config mode uses the shared utility
  - ✓ Consistent behavior across both modes
  - ✓ Handles nested parameter structures (e.g., `longStrategy`, `shortStrategy`)

#### FR-3: Backward Compatibility
- **Description**: Existing API calls must continue to work without changes
- **Acceptance Criteria**:
  - ✓ Old curl commands with full params per stock still work
  - ✓ Existing config files work unchanged
  - ✓ Frontend can continue sending full params (will still work, just not optimal)
  - ✓ No breaking changes to API contract

#### FR-4: Frontend Optimization
- **Description**: Update frontend to send minimal stock-specific parameters
- **Acceptance Criteria**:
  - ✓ Only send stock-specific params when they differ from defaults
  - ✓ Send simple symbol strings when stock uses all defaults
  - ✓ Reduce payload size for portfolio backtests
  - ✓ Maintain compatibility with ticker-specific defaults from `stockDefaults.js`

### Non-Functional Requirements

#### NFR-1: Performance
- **Description**: Refactoring must not degrade performance
- **Acceptance Criteria**:
  - ✓ Parameter merging happens in O(n) time where n = number of stocks
  - ✓ No noticeable slowdown in backtest execution
  - ✓ Config file caching still works

#### NFR-2: Maintainability
- **Description**: Code should be easier to maintain after refactoring
- **Acceptance Criteria**:
  - ✓ Single parameter merging utility reduces duplication
  - ✓ Clear separation of concerns
  - ✓ Well-documented shared utility function
  - ✓ Consistent patterns across config and non-config modes

#### NFR-3: Testing
- **Description**: Changes must be thoroughly tested
- **Acceptance Criteria**:
  - ✓ Test config file mode still works
  - ✓ Test non-config mode with simple strings
  - ✓ Test non-config mode with mixed formats
  - ✓ Test parameter merging with various override scenarios
  - ✓ Test backward compatibility with old curl commands

## Success Criteria

1. **Simplified curl commands**: Non-config mode curl commands are 70-90% smaller for typical portfolios
2. **Unified logic**: Both modes use the same parameter merging utility
3. **Zero breaking changes**: All existing API calls and config files work unchanged
4. **Frontend optimization**: Frontend sends minimal data for portfolio backtests
5. **All tests pass**: Both config and non-config modes verified working

## Out of Scope

- Changing config file format (maintain existing structure)
- Adding new DCA parameters
- Changing validation logic
- Modifying backtest execution logic

## Dependencies

- Existing `portfolioConfigLoader.js` implementation
- Existing `portfolioBacktestService.js` implementation
- Frontend `PortfolioBacktestPage.js` component
- Backend `/api/portfolio-backtest` endpoint

## Assumptions

1. The parameter merging logic from config mode is the correct behavior to standardize on
2. Frontend already has ticker-specific defaults via `stockDefaults.js`
3. Users prefer simpler curl commands when testing manually
4. Reducing payload size is beneficial for performance and clarity
