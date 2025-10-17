# Design: Portfolio Stock-Specific Parameters

## Architecture Overview

This feature enhances the portfolio backtest system to:
1. Expose all DCA parameters in the portfolio form (matching single-stock form)
2. Automatically apply stock-specific defaults from `backtestDefaults.json`
3. Support per-stock beta scaling with individual beta coefficients
4. Generate accurate single-stock links that reproduce portfolio backtest parameters

## Component Changes

### Frontend Changes

#### 1. PortfolioBacktestForm.js
- Add all missing DCA parameter fields
- Organize into collapsible sections (similar to single-stock form)
- Add beta scaling section with enable/disable toggle
- Show visual indicators for stocks with specific defaults
- Add validation for all new parameters

#### 2. StockSelector.js Enhancement
- Add gear icon (⚙️) next to stocks with specific defaults
- Add tooltip showing which defaults apply
- Add legend explaining icons

#### 3. StockPerformanceTable.js
- Update `buildStockResultsUrl()` to include ALL parameters
- Pass `stock.params` which contains the actual parameters used
- Convert percentages correctly (0.1 → 10 for URL)
- Include boolean flags, beta values, strategy mode

#### 4. PortfolioResults.js
- Display beta coefficient for each stock (if beta scaling enabled)
- Show parameter summary for each stock (expandable section)

### Backend Changes

#### 1. portfolioBacktestService.js
```javascript
// Enhanced stock parameter merging
function mergeStockParameters(symbol, portfolioDefaults, stockConfig) {
  // 1. Load stock-specific defaults from JSON
  const stockDefaults = getStockParameters(symbol);

  // 2. Merge with priority:
  //    portfolioDefaults < stockDefaults < stockConfig.params
  const merged = {
    ...portfolioDefaults,
    ...flattenStockDefaults(stockDefaults),
    ...(stockConfig.params || {})
  };

  // 3. Handle beta scaling
  if (merged.enableBetaScaling) {
    merged.beta = await resolveStockBeta(symbol, merged);
  }

  return merged;
}

async function resolveStockBeta(symbol, params) {
  // Priority: manualBeta > defaults.beta > database.beta > 1.0
  if (params.isManualBetaOverride && params.manualBeta) {
    return params.manualBeta;
  }

  const stockDefaults = getStockParameters(symbol);
  if (stockDefaults.beta && stockDefaults.beta.value) {
    return stockDefaults.beta.value;
  }

  const stock = await database.getStock(symbol);
  if (stock && stock.beta) {
    return stock.beta;
  }

  return 1.0;
}
```

#### 2. portfolioMetricsService.js
- Store actual parameters used for each stock in `stockResults`
- Include beta coefficient in results if beta scaling enabled
- Store parameters in format compatible with single-stock URLs

## Data Flow

### 1. Portfolio Configuration Submission
```
User fills form with all parameters
  ↓
Frontend validates all fields
  ↓
Convert UI percentages (0-100) to API percentages (0-1)
  ↓
POST /api/portfolio-backtest
  {
    totalCapital, lotSizeUsd, maxLotsPerStock,
    startDate, endDate,
    stocks: ['TSLA', 'PLTR', 'APP'],
    defaultParams: {
      gridIntervalPercent: 0.1,  // 10%
      profitRequirement: 0.1,
      enableBetaScaling: true,
      coefficient: 1,
      ...all other params
    }
  }
```

### 2. Backend Parameter Merging
```
For each stock in request.stocks:
  1. Load portfolio defaultParams
  2. Load stock-specific defaults from backtestDefaults.json
  3. Merge: defaultParams < stockDefaults < stock.params
  4. Resolve beta (if enableBetaScaling)
  5. Store final params in stock state
  6. Create DCA executor with final params
```

### 3. Results with Parameters
```
Response includes for each stock:
  {
    symbol: 'PLTR',
    params: {
      // ALL parameters actually used for this stock
      gridIntervalPercent: 0.1,
      profitRequirement: 0.1,
      beta: 2.592,
      enableBetaScaling: true,
      ...
    },
    // ... metrics, transactions, etc.
  }
```

### 4. Single-Stock Link Generation
```
Frontend builds URL from stock.params:
  /backtest/long/PLTR/results?
    portfolioRunId=...&
    startDate=...&
    endDate=...&
    gridIntervalPercent=10&  // Convert 0.1 → 10
    profitRequirement=10&
    beta=2.592&
    enableBetaScaling=true&
    ...
```

## UI Mockups

### Enhanced Portfolio Form
```
┌────────────────────────────────────────────────────┐
│ 📊 Portfolio Backtest Configuration                │
├────────────────────────────────────────────────────┤
│                                                     │
│ 💰 Capital Settings                                │
│   Total Capital: [500000]                          │
│   Lot Size: [10000]                                │
│   Max Lots Per Stock: [10]                         │
│                                                     │
│ 📈 Stock Selection                                 │
│   [Select All] [Deselect All]                      │
│   ☑ TSLA ⚙️  ☑ PLTR ⚙️  ☑ APP                     │
│   ☐ NVDA ⚙️  ☐ AAPL ⚙️  ☐ HOOD                    │
│   Selected: 3 stocks (2 with custom defaults)     │
│                                                     │
│ 📅 Date Range                                      │
│   Start: [2021-09-01]  End: [2025-10-16]           │
│                                                     │
│ ⚙️  Core DCA Parameters [Collapse]                 │
│   Grid Interval: [10]%                             │
│   Profit Requirement: [10]%                        │
│   ...                                              │
│                                                     │
│ 📊 Beta Scaling [Expand]                           │
│   ☑ Enable Beta Scaling                            │
│      Each stock uses its own beta coefficient      │
│   Coefficient: [1.0]                               │
│   ☐ Manual Beta Override [2.5]                     │
│                                                     │
│ 🎯 Trailing Strategies [Expand]                    │
│ 🔬 Advanced Features [Expand]                      │
│ 🎮 Strategy Configuration [Expand]                 │
│                                                     │
│ [Reset to Defaults] [Run Portfolio Backtest]       │
└────────────────────────────────────────────────────┘
```

### Stock Performance Table with Accurate Links
```
┌─────────────────────────────────────────────────────────┐
│ 🎯 Stock Performance Breakdown                          │
├──────┬──────┬────────┬──────┬────────┬─────────────────┤
│Symbol│ Beta │Capital │P&L   │Return %│ Details         │
├──────┼──────┼────────┼──────┼────────┼─────────────────┤
│ PLTR │ 2.59 │ $80K   │+$45K │ +56.3% │[View] (exact)   │
│ TSLA │ 2.13 │ $60K   │+$32K │ +53.3% │[View] (exact)   │
│ APP  │ 1.00 │ $40K   │+$18K │ +45.0% │[View] (exact)   │
└──────┴──────┴────────┴──────┴────────┴─────────────────┘

Click [View] opens single-stock backtest with EXACT params:
/backtest/long/PLTR/results?
  portfolioRunId=xxx&
  startDate=2021-09-01&
  endDate=2025-10-16&
  lotSizeUsd=10000&
  maxLots=10&
  gridIntervalPercent=10&
  profitRequirement=12&  ← PLTR-specific from defaults
  beta=2.592&            ← PLTR-specific beta
  enableBetaScaling=true&
  coefficient=1&
  ...
```

## Implementation Plan

### Phase 1: Form Enhancement (8 hours)
1. Add all missing parameter fields to PortfolioBacktestForm
2. Organize into collapsible sections
3. Add beta scaling section
4. Update validation logic
5. Add visual indicators for stocks with defaults

### Phase 2: Backend Parameter Merging (6 hours)
1. Implement `mergeStockParameters()` function
2. Implement `resolveStockBeta()` function
3. Update portfolio backtest service to use merged params
4. Store actual params used in results

### Phase 3: Link Generation Fix (4 hours)
1. Update `buildStockResultsUrl()` to include all params
2. Handle percentage conversions correctly
3. Test link generation for all parameter combinations

### Phase 4: Testing & Validation (6 hours)
1. Test with stocks that have defaults
2. Test with stocks without defaults
3. Test beta scaling enable/disable
4. Test single-stock link reproduction
5. Verify parameter merging priority

**Total Estimate**: 24 hours

## Testing Strategy

### Unit Tests
- Parameter merging logic
- Beta resolution logic
- URL generation with all parameters
- Percentage conversions

### Integration Tests
- Portfolio backtest with mixed stocks (some with defaults, some without)
- Beta scaling with different configurations
- Single-stock link click-through and parameter matching

### Manual Tests
- Submit portfolio backtest with all parameters
- Verify each stock uses correct parameters
- Click "View" links and verify parameters match
- Test with enableBetaScaling ON and OFF

## Success Metrics

1. All parameters from single-stock form available in portfolio form
2. Stocks with defaults automatically use them (verified in logs)
3. Beta scaling shows correct beta for each stock
4. Single-stock "View" links reproduce exact backtest (100% match)
5. No parameter discrepancies in results
