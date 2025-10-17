# Requirements: Portfolio Stock-Specific Parameters

## Problem Statement

The current portfolio backtest configuration lacks several critical features:

1. **Limited Parameter Exposure**: The portfolio backtest form only exposes a subset of DCA parameters (grid interval, profit requirement, trailing buy/sell). Many advanced parameters available in single-stock backtests (beta scaling, dynamic grid, scenario detection, adaptive strategy, etc.) are not accessible.

2. **No Stock-Specific Defaults**: The system has a `backtestDefaults.json` file with stock-specific configurations (e.g., PLTR, AAPL, TSLA have custom beta values and parameters), but the portfolio backtest doesn't utilize these defaults. All stocks use the same parameters.

3. **Inconsistent Single-Stock Links**: In the portfolio results page, the "View" links to individual stock results don't pass all the parameters that were actually used in the portfolio backtest, making it impossible to reproduce the exact same backtest for a single stock.

4. **Missing Beta Scaling per Stock**: Beta scaling is a key feature where each stock has its own beta coefficient, but the portfolio form doesn't expose this or allow stock-specific beta configurations.

## User Stories

### Story 1: Complete Parameter Access
**As a** portfolio backtest user
**I want** to see and configure ALL DCA parameters in the portfolio form
**So that** I can have the same level of control as single-stock backtests

**Acceptance Criteria**:
- All parameters from single-stock backtest form are available in portfolio form
- Parameters include: beta scaling, dynamic grid, scenario detection, adaptive strategy, average-based logic, etc.
- UI organization matches single-stock form for consistency
- Parameter validation works for all fields

### Story 2: Stock-Specific Default Parameters
**As a** portfolio backtest user
**I want** the system to automatically apply stock-specific defaults from `backtestDefaults.json`
**So that** each stock uses its optimal configuration without manual setup

**Acceptance Criteria**:
- When a stock is selected, check if it has specific defaults in `backtestDefaults.json`
- If stock has defaults: merge stock-specific params with global defaults
- If stock has NO defaults: use portfolio-level default params
- Beta scaling automatically uses stock-specific beta if `enableBetaScaling` is true
- User can see which stocks have specific defaults (visual indicator)

### Story 3: Per-Stock Beta Scaling
**As a** portfolio backtest user
**I want** to enable beta scaling with each stock using its own beta coefficient
**So that** position sizing reflects each stock's individual volatility

**Acceptance Criteria**:
- Portfolio form has "Enable Beta Scaling" checkbox (global toggle)
- When enabled, system fetches/uses each stock's beta from:
  1. `backtestDefaults.json` (if specified)
  2. Database (if not in defaults)
  3. Default value (if not in database)
- Each stock in results page shows its beta coefficient used
- Backend correctly applies per-stock beta scaling

### Story 4: Accurate Single-Stock Result Links
**As a** portfolio backtest user
**I want** the "View" link for each stock in portfolio results to use the EXACT parameters from that stock's portfolio backtest
**So that** I can see detailed single-stock results with identical configuration

**Acceptance Criteria**:
- Link includes ALL parameters that were used for that stock
- If stock used defaults from `backtestDefaults.json`, link includes those
- Beta coefficient is passed if beta scaling was enabled
- Boolean flags (enableConsecutiveIncrementalBuyGrid, etc.) are included
- Strategy mode (long/short) is included
- Clicking the link reproduces the exact same backtest for that single stock

## Detailed Requirements

### 1. Portfolio Form Enhancement

**Add All Missing Parameters**:
```
Current parameters (already in form):
- gridIntervalPercent
- profitRequirement
- stopLossPercent
- trailingBuyActivationPercent
- trailingBuyReboundPercent
- trailingSellActivationPercent
- trailingSellPullbackPercent
- enableTrailingBuy
- enableTrailingSell
- enableConsecutiveIncrementalBuyGrid
- gridConsecutiveIncrement
- enableConsecutiveIncrementalSellProfit

Parameters to ADD:
✅ Beta Scaling Section:
  - enableBetaScaling (boolean)
  - coefficient (number, default 1)
  - isManualBetaOverride (boolean)
  - manualBeta (number, only if isManualBetaOverride)

✅ Dynamic Grid Section:
  - enableDynamicGrid (boolean)
  - dynamicGridMultiplier (number)

✅ Reference Normalization:
  - normalizeToReference (boolean)

✅ Scenario Detection:
  - enableScenarioDetection (boolean)

✅ Average-Based Logic:
  - enableAverageBasedGrid (boolean)
  - enableAverageBasedSell (boolean)

✅ Strategy Mode:
  - strategyMode (radio: "long" | "short")

✅ Trailing Stop Order Type:
  - trailingStopOrderType (radio: "market" | "limit")

✅ Stop Loss (for short strategy):
  - stopLossType (dropdown)
  - stopLossPercent
```

**UI Organization**:
- Group parameters into collapsible sections (like single-stock form)
- Sections: Capital Settings, Stock Selection, Date Range, Core DCA, Trailing Strategies, Advanced Features, Beta Scaling, Strategy Configuration
- Use tooltips/help text for each parameter
- Show validation errors inline

### 2. Stock-Specific Defaults Integration

**Backend Logic** (`portfolioBacktestService.js`):
```javascript
// For each stock in portfolio:
for (const stockConfig of config.stocks) {
  const symbol = typeof stockConfig === 'string' ? stockConfig : stockConfig.symbol;

  // 1. Load stock-specific defaults from backtestDefaults.json
  const stockDefaults = getStockParameters(symbol); // from stockDefaults.js

  // 2. Merge priority order:
  //    a) Stock-specific params passed in request (stockConfig.params)
  //    b) Stock-specific defaults from JSON (stockDefaults)
  //    c) Portfolio-level defaults (config.defaultParams)

  const finalParams = {
    ...config.defaultParams,           // Lowest priority
    ...stockDefaults,                   // Medium priority
    ...(stockConfig.params || {}),      // Highest priority
    maxLots: config.maxLotsPerStock,
    lotSizeUsd: config.lotSizeUsd
  };

  // 3. Handle beta scaling
  if (finalParams.enableBetaScaling) {
    if (finalParams.isManualBetaOverride) {
      // Use manualBeta if specified
      finalParams.beta = finalParams.manualBeta;
    } else {
      // Use stock-specific beta from defaults or database
      finalParams.beta = await getStockBeta(symbol);
    }
  }

  // 4. Create executor with final merged params
  const executor = createDCAExecutor(symbol, finalParams, ...);
}
```

**Frontend Logic** (`PortfolioBacktestForm.js`):
```javascript
// When stocks are selected, check for stock-specific defaults
const stocksWithDefaults = selectedStocks.map(symbol => ({
  symbol,
  hasDefaults: hasStockSpecificDefaults(symbol),
  defaults: hasStockSpecificDefaults(symbol) ? getStockParameters(symbol) : null
}));

// Show indicator in stock selector for stocks with defaults
// Example: "PLTR ✓" (has defaults) vs "AMSC" (no defaults)
```

### 3. Beta Scaling Implementation

**Per-Stock Beta Handling**:
- Each stock's beta is determined independently
- Priority order:
  1. Manual override (`manualBeta`) if `isManualBetaOverride` is true
  2. Stock-specific beta from `backtestDefaults.json`
  3. Beta from database (fetched via `/api/stocks/:symbol/beta`)
  4. Default beta = 1.0

**Backend Enhancement**:
```javascript
async function getStockBeta(symbol) {
  // 1. Check backtestDefaults.json
  const stockDefaults = getStockParameters(symbol);
  if (stockDefaults.beta && stockDefaults.beta.value) {
    return stockDefaults.beta.value;
  }

  // 2. Query database
  const stock = await database.getStock(symbol);
  if (stock && stock.beta) {
    return stock.beta;
  }

  // 3. Default
  return 1.0;
}
```

**Results Display**:
- Each stock in results should show: `Beta: 2.59` (if beta scaling enabled)
- Portfolio summary shows: `Avg Beta: 1.85` (weighted by capital deployed)

### 4. Accurate Single-Stock Links

**Link Generation** (`StockPerformanceTable.js`):
```javascript
const buildStockResultsUrl = (stock, portfolioParams) => {
  const params = new URLSearchParams();

  // Add portfolio metadata
  params.append('portfolioRunId', portfolioRunId);
  params.append('startDate', portfolioParams.startDate);
  params.append('endDate', portfolioParams.endDate);
  params.append('lotSizeUsd', portfolioParams.lotSizeUsd);
  params.append('maxLots', portfolioParams.maxLotsPerStock);

  // Add ALL stock-specific parameters that were actually used
  const stockParams = stock.params || {};

  // Percentage params (stored as 0.1, URL expects 10)
  const percentageParams = [
    'gridIntervalPercent', 'profitRequirement',
    'trailingBuyActivationPercent', 'trailingBuyReboundPercent',
    'trailingSellActivationPercent', 'trailingSellPullbackPercent',
    'gridConsecutiveIncrement', 'stopLossPercent'
  ];

  percentageParams.forEach(param => {
    if (stockParams[param] !== undefined) {
      params.append(param, stockParams[param] * 100);
    }
  });

  // Boolean params
  const booleanParams = [
    'enableTrailingBuy', 'enableTrailingSell',
    'enableConsecutiveIncrementalBuyGrid', 'enableConsecutiveIncrementalSellProfit',
    'enableBetaScaling', 'isManualBetaOverride',
    'enableDynamicGrid', 'normalizeToReference',
    'enableScenarioDetection', 'enableAverageBasedGrid', 'enableAverageBasedSell'
  ];

  booleanParams.forEach(param => {
    if (stockParams[param] !== undefined) {
      params.append(param, stockParams[param]);
    }
  });

  // Numeric params
  if (stockParams.coefficient !== undefined) params.append('coefficient', stockParams.coefficient);
  if (stockParams.manualBeta !== undefined) params.append('manualBeta', stockParams.manualBeta);
  if (stockParams.beta !== undefined) params.append('beta', stockParams.beta);
  if (stockParams.dynamicGridMultiplier !== undefined) params.append('dynamicGridMultiplier', stockParams.dynamicGridMultiplier);

  // String params
  if (stockParams.strategyMode) params.append('strategyMode', stockParams.strategyMode);
  if (stockParams.trailingStopOrderType) params.append('trailingStopOrderType', stockParams.trailingStopOrderType);

  return `/backtest/${stockParams.strategyMode || 'long'}/${stock.symbol}/results?${params.toString()}`;
};
```

## Visual Design Requirements

### Stock Selector Enhancement
```
┌─────────────────────────────────────────────┐
│ Stock Symbols (Select one or more)          │
│                                              │
│ [Select All] [Deselect All]                 │
│                                              │
│ ☑ TSLA ⚙️    ☑ APP      ☐ HOOD ⚙️           │
│ ☑ PLTR ⚙️    ☐ AAPL ⚙️  ☑ NVDA ⚙️           │
│                                              │
│ Legend: ⚙️ = Has stock-specific defaults    │
│                                              │
│ Selected: TSLA, APP, PLTR, NVDA (3 with ⚙️) │
└─────────────────────────────────────────────┘
```

### Beta Scaling Section
```
┌─────────────────────────────────────────────┐
│ 📊 Beta Scaling                              │
│                                              │
│ ☑ Enable Beta Scaling                       │
│   Use stock-specific beta coefficients      │
│   for position sizing                        │
│                                              │
│   Coefficient: [1.0]  (multiplier)          │
│                                              │
│   ☐ Manual Beta Override                    │
│       Manual Beta: [2.5]                    │
│       (Override all stock betas)            │
│                                              │
│ ℹ️ When enabled, each stock uses its own    │
│   beta from defaults or database            │
└─────────────────────────────────────────────┘
```

## Non-Functional Requirements

### Performance
- Form loads in <500ms with all parameters
- Stock-specific defaults loaded asynchronously
- No UI blocking when fetching betas from database

### Usability
- Parameter sections collapsible/expandable
- Default values clearly indicated
- Validation feedback immediate
- Form state persisted in session storage

### Data Integrity
- All parameters validated before submission
- Backend validates parameter merging logic
- Logs show which defaults were applied to which stocks

## Success Criteria

1. ✅ Portfolio form has ALL parameters from single-stock form
2. ✅ Stocks with defaults in `backtestDefaults.json` automatically use them
3. ✅ Beta scaling works per-stock with correct coefficients
4. ✅ Single-stock "View" links reproduce exact portfolio backtest for that stock
5. ✅ Results page shows which parameters were used for each stock
6. ✅ No parameter discrepancies between portfolio and single-stock backtests
7. ✅ User can override stock-specific defaults if desired

## Out of Scope

- Per-stock parameter editing in portfolio form (use defaults or override all)
- Visual parameter diff between stocks
- Batch editing of stock parameters
- Import/export of portfolio configurations
- Historical portfolio backtest comparison

## Dependencies

- Existing `backtestDefaults.json` structure
- `stockDefaults.js` utility functions
- Database schema for stock betas
- Single-stock backtest parameter handling

## Open Questions

1. Should users be able to edit per-stock parameters directly in the portfolio form, or only via defaults?
   - **Recommendation**: Start with defaults-only, add per-stock editing in future spec
2. How to handle conflicts when a parameter is set both in defaults and in portfolio form?
   - **Recommendation**: Portfolio form overrides defaults (explicit wins over implicit)
3. Should the form show which parameters come from defaults vs. portfolio settings?
   - **Recommendation**: Yes, add visual indicators (different color/icon)
