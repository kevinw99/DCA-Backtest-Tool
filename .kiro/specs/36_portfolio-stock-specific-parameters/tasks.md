# Tasks: Portfolio Stock-Specific Parameters

## Phase 1: Frontend Form Enhancement

- [ ] **Task 1.1: Add Missing Parameter Fields** (4 hours)
  - Add beta scaling section (enableBetaScaling, coefficient, isManualBetaOverride, manualBeta)
  - Add dynamic grid section (enableDynamicGrid, dynamicGridMultiplier)
  - Add scenario detection toggle
  - Add average-based logic toggles (enableAverageBasedGrid, enableAverageBasedSell)
  - Add strategy mode radio (long/short)
  - Add trailing stop order type radio (market/limit)
  - Add normalizeToReference checkbox

- [ ] **Task 1.2: Organize Form into Collapsible Sections** (2 hours)
  - Create collapsible section component
  - Group parameters: Core DCA, Trailing Strategies, Beta Scaling, Advanced Features, Strategy Config
  - Default: Core and Beta sections expanded, others collapsed
  - Save collapsed state to session storage

- [ ] **Task 1.3: Update Validation Logic** (1 hour)
  - Add validation for all new fields
  - Validate beta ranges (0.1 - 10.0)
  - Validate coefficient > 0
  - Validate conditional fields (gridConsecutiveIncrement when enableConsecutiveIncrementalBuyGrid)

- [ ] **Task 1.4: Add Visual Indicators for Stock Defaults** (1 hour)
  - Enhance StockSelector component
  - Add gear icon (⚙️) next to stocks with defaults
  - Add tooltip showing which defaults apply
  - Add legend: "⚙️ = Has stock-specific defaults"
  - Show count: "Selected: 5 stocks (3 with custom defaults)"

## Phase 2: Backend Parameter Merging

- [ ] **Task 2.1: Implement Parameter Merging Function** (3 hours)
  - Create `mergeStockParameters(symbol, portfolioDefaults, stockConfig)` function
  - Load stock-specific defaults from `backtestDefaults.json`
  - Flatten nested structure (basic, longStrategy, beta, etc.)
  - Merge with priority: portfolioDefaults < stockDefaults < stockConfig.params
  - Add comprehensive logging to show which defaults were applied

- [ ] **Task 2.2: Implement Beta Resolution Logic** (2 hours)
  - Create `resolveStockBeta(symbol, params)` async function
  - Check manual override first
  - Check backtestDefaults.json second
  - Query database third
  - Default to 1.0
  - Add logging for beta source

- [ ] **Task 2.3: Update Portfolio Backtest Service** (1 hour)
  - Call `mergeStockParameters()` for each stock before creating executor
  - Pass merged params to createDCAExecutor()
  - Store final params in stock state for results

## Phase 3: Results Enhancement

- [ ] **Task 3.1: Store Actual Parameters in Results** (2 hours)
  - Update portfolioMetricsService.js
  - Include `params` object in each stockResult
  - Store ALL parameters that were actually used
  - Include resolved beta if beta scaling enabled

- [ ] **Task 3.2: Update Single-Stock Link Generation** (2 hours)
  - Update `buildStockResultsUrl()` in StockPerformanceTable.js
  - Include ALL parameters from stock.params
  - Handle percentage conversion (0.1 → 10 for URL)
  - Handle boolean params
  - Handle numeric params (coefficient, beta, dynamicGridMultiplier)
  - Handle string params (strategyMode, trailingStopOrderType)
  - Test with all parameter combinations

- [ ] **Task 3.3: Display Beta in Results** (1 hour)
  - Add "Beta" column to StockPerformanceTable (only if beta scaling enabled)
  - Show beta coefficient for each stock
  - Add tooltip explaining beta's effect on position sizing

## Phase 4: Testing & Validation

- [ ] **Task 4.1: Unit Tests** (3 hours)
  - Test parameter merging with various combinations
  - Test beta resolution logic
  - Test URL generation with all parameters
  - Test percentage conversions
  - Test parameter validation

- [ ] **Task 4.2: Integration Tests** (2 hours)
  - Test portfolio backtest with stocks that have defaults (PLTR, TSLA, AAPL)
  - Test with stocks without defaults (APP, HOOD, NVDA)
  - Test mixed portfolio (some with defaults, some without)
  - Test beta scaling enabled/disabled
  - Verify parameters in logs match expectations

- [ ] **Task 4.3: Link Click-Through Tests** (1 hour)
  - Run portfolio backtest
  - Click "View" link for each stock
  - Verify single-stock backtest has EXACT same parameters
  - Compare transaction counts and results
  - Test all parameter types (percentages, booleans, numerics, strings)

## Phase 5: Documentation & Polish

- [ ] **Task 5.1: Update Form Help Text** (1 hour)
  - Add detailed help text for beta scaling
  - Explain stock-specific defaults behavior
  - Add tooltips for all new parameters

- [ ] **Task 5.2: Add Logging** (1 hour)
  - Log which defaults were applied to which stocks
  - Log resolved beta for each stock
  - Log parameter merge process (debug level)

- [ ] **Task 5.3: Update User Documentation** (1 hour)
  - Document beta scaling feature
  - Document stock-specific defaults behavior
  - Document how to add custom defaults to backtestDefaults.json

## Acceptance Criteria Checklist

- [ ] All parameters from single-stock form available in portfolio form
- [ ] Form organized into collapsible sections matching single-stock layout
- [ ] Beta scaling section with enable toggle and coefficient
- [ ] Stock selector shows indicators for stocks with defaults
- [ ] Backend correctly merges parameters (portfolio < stockDefaults < stockConfig)
- [ ] Beta resolution follows correct priority (manual > defaults > database > 1.0)
- [ ] Each stock in results includes `params` object with actual parameters used
- [ ] Single-stock "View" links include ALL parameters
- [ ] Clicking "View" link reproduces exact portfolio backtest for that stock
- [ ] Beta column appears in results table when beta scaling enabled
- [ ] Validation works for all new fields
- [ ] Logs show which defaults were applied
- [ ] Tests pass for all parameter combinations

## Time Estimate Summary

| Phase | Tasks | Hours |
|-------|-------|-------|
| Phase 1: Form Enhancement | 4 tasks | 8 hours |
| Phase 2: Backend Merging | 3 tasks | 6 hours |
| Phase 3: Results Enhancement | 3 tasks | 5 hours |
| Phase 4: Testing | 3 tasks | 6 hours |
| Phase 5: Documentation | 3 tasks | 3 hours |
| **Total** | **16 tasks** | **28 hours** |

## Dependencies

- Existing `backtestDefaults.json` structure
- `stockDefaults.js` utility functions (`getStockParameters`, `hasStockSpecificDefaults`)
- Database `stocks` table with beta column
- Single-stock backtest parameter handling

## Risk Assessment

**Medium Risk:**
- Parameter merging logic complexity (many edge cases)
- Beta resolution from multiple sources
- URL parameter handling (many types: percentage, boolean, numeric, string)

**Mitigation:**
- Comprehensive unit tests for merging logic
- Clear logging at each decision point
- Extensive manual testing with various stock combinations

## Notes

- Keep backward compatibility: portfolio backtests without beta scaling should still work
- Form should be mobile-responsive (collapsible sections help)
- Consider adding "Advanced Mode" toggle to hide/show advanced parameters
- Future enhancement: Per-stock parameter editing UI (not in this spec)
