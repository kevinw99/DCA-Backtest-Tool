# G01: Adding New Parameters - Overview and Checklist

## Purpose

This guide documents the complete process for adding new parameters to the DCA Backtest Tool, ensuring they work correctly across the entire stack: backend logic, API, configuration, frontend UI, URL encoding, and testing.

## When to Use This Guide

Use this guide whenever you need to add:
- New boolean flags (e.g., `enableFeatureX`, `momentumBasedBuy`)
- New numeric parameters (e.g., `thresholdPercent`, `maxRetries`)
- New string parameters (e.g., `orderType`, `strategyMode`)

## IMPORTANT: Multi-Mode Support Principle

**By default, new parameters should automatically be available across ALL modes:**
- Single backtest (long/short)
- Portfolio backtest
- Batch mode backtest

**This includes ALL layers:**
- Backend API endpoints and logic
- UI configuration forms
- URL parameter encoding/decoding
- API curl commands
- Configuration defaults

**Only exclude a parameter from a specific mode if:**
- It fundamentally doesn't make sense (e.g., portfolio-level parameter in single backtest)
- It creates logical conflicts (e.g., batch-specific parallelization settings)
- It requires mode-specific implementation

**Default Assumption**: If you're adding a parameter, assume it should work everywhere until proven otherwise.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Journey                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. FRONTEND UI (DCABacktestForm.js)                        │
│     - User sets parameters via checkboxes/inputs            │
│     - Form state managed in React component                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. URL ENCODING (URLParameterManager.js)                   │
│     - Parameters encoded to shareable URL                   │
│     - _encodeSingleParameters() method                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. API REQUEST (fetch POST /api/backtest/dca)              │
│     - Parameters sent in request body as JSON               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. BACKEND API (server.js)                                 │
│     - Route: POST /api/backtest/dca                         │
│     - Extract parameters from req.body                      │
│     - Pass to service layer                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  5. SERVICE LAYER (dcaBacktestService.js)                   │
│     - runDCABacktest() function                             │
│     - Apply defaults from backtestDefaults.json             │
│     - Pass to executor                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  6. EXECUTOR (dcaExecutor.js)                               │
│     - Core trading logic                                    │
│     - Uses parameters to control behavior                   │
│     - Returns results with statistics                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  7. RESULTS DISPLAY                                         │
│     - API response with backtest results                    │
│     - Frontend displays charts and metrics                  │
│     - URL preserves configuration for sharing               │
└─────────────────────────────────────────────────────────────┘
```

## Complete Checklist

Use this checklist to ensure all steps are completed when adding a new parameter.

### Phase 1: Backend Core Logic
- [ ] **G02-Step1**: Add parameter extraction in `dcaExecutor.js` function signature
- [ ] **G02-Step2**: Implement parameter logic in executor
- [ ] **G02-Step3**: Add statistics tracking if needed
- [ ] **G02-Step4**: Pass parameter from `dcaBacktestService.js` to executor
- [ ] **G02-Step5**: Add parameter to `server.js` route handler
- [ ] **G02-Step6**: Include parameter in API response if needed

### Phase 2: Configuration
- [ ] **G03-Step1**: Add default value to `backtestDefaults.json` (all strategies)
- [ ] **G03-Step2**: Add ticker-specific defaults if needed

### Phase 3: Frontend UI
- [ ] **G04-Step1**: Add form control to `DCABacktestForm.js`
- [ ] **G04-Step2**: Add to React state initialization
- [ ] **G04-Step3**: Add to localStorage save/load logic
- [ ] **G04-Step4**: Add help text explaining the parameter

### Phase 4: URL Parameter Handling
- [ ] **G05-Step1**: Add to `URLParameterManager.js` encoding method
- [ ] **G05-Step2**: Add to `URLParameterManager.js` decoding method
- [ ] **G05-Step3**: Add to override support arrays (boolean/number/string/percentage)
- [ ] **G05-Step4**: Test URL round-trip encoding/decoding

### Phase 5: Testing
- [ ] **G06-Step1**: Create curl test command
- [ ] **G06-Step2**: Test backend API directly
- [ ] **G06-Step3**: Test frontend UI form
- [ ] **G06-Step4**: Test URL encoding/decoding
- [ ] **G06-Step5**: Test parameter persistence (localStorage)
- [ ] **G06-Step6**: Verify results in transaction logs

## Common Pitfalls (Lessons from Momentum Mode Implementation)

### Pitfall 1: Parameter Dropped at API Layer
**Symptom**: Parameter appears in req.body debug logs but doesn't reach the service layer.

**Cause**: In `server.js`, the `runDCABacktest()` call uses an explicit parameter list. If your new parameter isn't included, it gets dropped.

**Fix**: Always add new parameters to the `runDCABacktest()` call in `server.js`.

### Pitfall 2: URL Missing Parameter
**Symptom**: Parameter works in backtest but doesn't appear in shareable URL.

**Cause**: `URLParameterManager.js` encoding methods don't include the new parameter.

**Fix**: Add parameter to BOTH `_encodeSingleParameters()` and `_decodeSingleParameters()` methods.

### Pitfall 3: Parameter Not Persisting
**Symptom**: Parameter resets to default when navigating or refreshing.

**Cause**: Parameter not included in localStorage or URL decoding logic.

**Fix**: Ensure parameter is in both URL encoding AND React state management.

### Pitfall 4: Wrong Parameter Type in URL
**Symptom**: Boolean becomes string "true", percentage becomes whole number, etc.

**Cause**: URL query parameters are always strings and need proper type conversion.

**Fix**:
- Booleans: Use `.toString()` when encoding, `_parseBoolean()` when decoding
- Percentages: Use `_formatDecimalAsPercentage()` encoding, `_parsePercentageAsDecimal()` decoding
- Numbers: Use `.toString()` encoding, `_parseNumber()` decoding

## Parameter Types and Handling

### Boolean Parameters
- **Examples**: `momentumBasedBuy`, `enableDynamicGrid`, `normalizeToReference`
- **URL Format**: `"true"` or `"false"` (strings)
- **Backend Format**: `true` or `false` (booleans)
- **Default Value**: Usually `false`

### Percentage Parameters
- **Examples**: `gridIntervalPercent`, `profitRequirement`, `trailingBuyActivationPercent`
- **URL Format**: Whole numbers (e.g., `10` for 10%)
- **Backend Format**: Decimals (e.g., `0.10` for 10%)
- **Conversion**: Multiply by 100 for URL, divide by 100 for backend

### Numeric Parameters
- **Examples**: `lotSizeUsd`, `maxLots`, `dynamicGridMultiplier`
- **URL Format**: Numbers as strings (e.g., `"10000"`)
- **Backend Format**: Numbers (e.g., `10000`)
- **Default Value**: Depends on parameter

### String Parameters
- **Examples**: `symbol`, `strategyMode`, `trailingStopOrderType`
- **URL Format**: Strings (e.g., `"TSLA"`, `"market"`)
- **Backend Format**: Strings
- **Default Value**: Depends on parameter

## File Locations Reference

```
Backend:
  /Users/kweng/AI/DCA-Backtest-Tool/backend/services/dcaExecutor.js
  /Users/kweng/AI/DCA-Backtest-Tool/backend/services/dcaBacktestService.js
  /Users/kweng/AI/DCA-Backtest-Tool/backend/server.js

Configuration:
  /Users/kweng/AI/DCA-Backtest-Tool/config/backtestDefaults.json
  /Users/kweng/AI/DCA-Backtest-Tool/config/tickerDefaults/[SYMBOL].json

Frontend:
  /Users/kweng/AI/DCA-Backtest-Tool/frontend/src/components/DCABacktestForm.js
  /Users/kweng/AI/DCA-Backtest-Tool/frontend/src/utils/URLParameterManager.js

Testing:
  /Users/kweng/AI/DCA-Backtest-Tool/backend/test_*.sh
  /tmp/server_debug.log
```

## Next Steps

1. Read **G02** for detailed backend implementation steps
2. Read **G03** for configuration file updates
3. Read **G04** for frontend UI implementation
4. Read **G05** for URL parameter handling
5. Read **G06** for testing and verification procedures

## Real-World Example

See Spec 45 (Momentum-Based Trading) for a complete implementation example:
- `.kiro/specs/45_momentum-based-trading/`
- Parameters added: `momentumBasedBuy`, `momentumBasedSell` (booleans)
- All checklist steps completed successfully
