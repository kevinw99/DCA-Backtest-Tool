# Spec 36: Portfolio Stock-Specific Parameters

## Overview

This specification enhances the portfolio backtest system to provide complete parameter control, automatic stock-specific defaults, per-stock beta scaling, and accurate single-stock result links.

## Problem

The current portfolio backtest has three major limitations:

1. **Incomplete Parameters**: The form only exposes basic DCA parameters (grid interval, profit requirement, trailing buy/sell). Advanced features like beta scaling, dynamic grid, scenario detection, and adaptive strategy are not accessible.

2. **No Stock-Specific Defaults**: The system has `backtestDefaults.json` with stock-specific configurations (e.g., PLTR has custom beta 2.592), but portfolio backtests don't use these defaults. All stocks are forced to use the same parameters.

3. **Inaccurate Links**: The "View" button in portfolio results doesn't pass all parameters to the single-stock backtest, making it impossible to reproduce the exact portfolio backtest for an individual stock.

## Solution

### 1. Complete Parameter Access

Add ALL DCA parameters to the portfolio form, organized into collapsible sections:
- Core DCA Parameters (grid, profit, stop loss)
- Trailing Strategies (buy/sell activation, rebound, pullback)
- **Beta Scaling** (enable, coefficient, manual override) ← NEW
- **Advanced Features** (dynamic grid, scenario detection, average-based) ← NEW
- **Strategy Configuration** (long/short, trailing stop type) ← NEW

### 2. Automatic Stock-Specific Defaults

**Backend logic** to merge parameters with priority:
```
Portfolio Defaults  <  Stock-Specific Defaults  <  Explicit Override
(lowest priority)      (from JSON file)           (highest priority)
```

Example: If PLTR has `profitRequirement: 0.12` in `backtestDefaults.json`, and portfolio form has `0.10`, PLTR uses `0.12` while other stocks use `0.10`.

### 3. Per-Stock Beta Scaling

When "Enable Beta Scaling" is checked:
- Each stock uses its own beta coefficient
- Beta sources (in priority order):
  1. Manual override (if specified)
  2. Stock-specific beta from `backtestDefaults.json`
  3. Beta from database
  4. Default: 1.0
- Results display each stock's beta

### 4. Accurate Single-Stock Links

The "View" button generates URLs with ALL parameters that were actually used for that stock:
```
/backtest/long/PLTR/results?
  portfolioRunId=xxx&
  startDate=2021-09-01&
  endDate=2025-10-16&
  gridIntervalPercent=10&
  profitRequirement=12&      ← PLTR-specific from defaults
  beta=2.592&                ← PLTR-specific beta
  enableBetaScaling=true&
  enableTrailingBuy=false&
  ...                        ← ALL other parameters
```

## Key Features

✅ **Full Parameter Exposure**: All single-stock parameters available in portfolio form
✅ **Smart Defaults**: Stocks with custom configs automatically use them
✅ **Visual Indicators**: Stocks with defaults marked with ⚙️ icon
✅ **Per-Stock Beta**: Each stock uses its own beta coefficient
✅ **Exact Reproduction**: "View" links reproduce exact portfolio backtest
✅ **Parameter Logging**: Backend logs which defaults were applied to which stocks
✅ **Validation**: All parameters validated before submission

## Visual Design

### Enhanced Stock Selector
```
Stock Symbols (Select one or more)

[Select All] [Deselect All]

☑ TSLA ⚙️    ☑ APP      ☐ HOOD
☑ PLTR ⚙️    ☐ AAPL ⚙️  ☑ NVDA ⚙️

Legend: ⚙️ = Has stock-specific defaults

Selected: TSLA, APP, PLTR, NVDA (3 with ⚙️)
```

### Beta Scaling Section
```
📊 Beta Scaling

☑ Enable Beta Scaling
  Use stock-specific beta coefficients for position sizing

  Coefficient: [1.0]  (multiplier)

  ☐ Manual Beta Override
      Manual Beta: [2.5]
      (Override all stock betas)

ℹ️ When enabled, each stock uses its own beta from defaults or database
```

### Results with Beta
```
┌──────┬──────┬────────┬──────┬────────┬────────┐
│Symbol│ Beta │Capital │P&L   │Return %│ Details│
├──────┼──────┼────────┼──────┼────────┼────────┤
│ PLTR │ 2.59 │ $80K   │+$45K │ +56.3% │[View]  │
│ TSLA │ 2.13 │ $60K   │+$32K │ +53.3% │[View]  │
│ APP  │ 1.00 │ $40K   │+$18K │ +45.0% │[View]  │
└──────┴──────┴────────┴──────┴────────┴────────┘
```

## Implementation

### Files to Create/Modify

**Frontend:**
- `frontend/src/components/PortfolioBacktestForm.js` (major enhancement)
- `frontend/src/components/StockSelector.js` (add default indicators)
- `frontend/src/components/StockPerformanceTable.js` (fix link generation)
- `frontend/src/components/PortfolioResults.js` (add beta display)

**Backend:**
- `backend/services/portfolioBacktestService.js` (parameter merging logic)
- `backend/services/portfolioMetricsService.js` (store params in results)

### Time Estimate

- Phase 1: Form Enhancement (8 hours)
- Phase 2: Backend Merging (6 hours)
- Phase 3: Results Enhancement (5 hours)
- Phase 4: Testing (6 hours)
- Phase 5: Documentation (3 hours)

**Total: 28 hours**

## Success Criteria

1. ✅ Portfolio form has ALL parameters from single-stock form
2. ✅ Stocks with defaults in `backtestDefaults.json` automatically use them
3. ✅ Beta scaling works per-stock with correct coefficients
4. ✅ Single-stock "View" links reproduce exact portfolio backtest
5. ✅ Results page shows which parameters were used for each stock
6. ✅ No parameter discrepancies between portfolio and single-stock backtests

## Benefits

**For Users:**
- Full control over portfolio backtest configuration
- No manual setup for stocks with custom defaults
- Accurate beta-based position sizing
- Easy drill-down to individual stock details

**For System:**
- Consistent parameter handling across single-stock and portfolio backtests
- Reusable stock-specific configurations
- Better auditability (all params logged and stored)

## Future Enhancements (Out of Scope)

- Per-stock parameter editing UI in portfolio form
- Visual parameter diff between stocks
- Batch editing of stock parameters
- Import/export of portfolio configurations
- Parameter templates/presets

---

**Spec Created**: 2025-10-16
**Status**: Ready for Implementation
**Priority**: High
**Complexity**: Medium-High
**Dependencies**: backtestDefaults.json, stockDefaults.js, database.stocks table
