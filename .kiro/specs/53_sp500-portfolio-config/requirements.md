# Spec 53: S&P 500 Portfolio Configuration

## Overview

Create a comprehensive S&P 500 portfolio backtest configuration (`sp500.json`) that mirrors the features and sophistication of the existing `nasdaq100.json` configuration. This includes proper survival bias handling through index tracking, capital optimization strategies, beta scaling support, and all advanced trading features.

## Requirements

### 1. Portfolio Configuration File

**Location**: `backend/configs/portfolios/sp500.json`

**Must Include**:
- Portfolio metadata (name, description)
- Capital settings (totalCapitalUsd, marginPercent)
- Date range for backtest (startDate, endDate)
- Global defaults for all trading strategies
- All S&P 500 component stocks (current constituents)
- Stock-specific overrides capability
- Index tracking configuration
- Capital optimization strategies
- Beta scaling support

### 2. Survival Bias Handling

**Critical Requirement**: Implement index tracking to eliminate survivorship bias

**Implementation**:
- Create `backend/data/sp500-history.json` file tracking:
  - When stocks were added to S&P 500
  - When stocks were removed from S&P 500
  - Reason for changes (annual reconstitution, special additions, mergers, bankruptcies)
- Use same format as `nasdaq100-history.json`
- Integration with existing `IndexTrackingService`

**Why This Matters**:
- Prevents backtesting with stocks that weren't in the index at the time
- Eliminates look-ahead bias
- Provides realistic historical performance
- Ensures positions are liquidated when stocks are removed from index

### 3. Feature Parity with NASDAQ-100 Config

Must include ALL features from `nasdaq100.json`:

#### Global Defaults
- **Basic settings**: lotSizeUsd, strategyMode
- **Long strategy**: maxLots, gridIntervalPercent, profitRequirement, stopLossPercent, trailing buy/sell settings, momentum features
- **Short strategy**: maxShorts, gridIntervalPercent, profitRequirement, trailing short/cover settings, stop loss configurations
- **Beta scaling**: enableBetaScaling, beta, betaFactor, coefficient, isManualBetaOverride
- **Dynamic features**: enableDynamicGrid, dynamicGridMultiplier, consecutive incremental grids, scenario detection, normalization
- **Adaptive strategy**: enableAdaptiveStrategy, adaptation intervals, rolling windows, confidence thresholds

#### Index Tracking
```json
"indexTracking": {
  "enabled": true,
  "indexName": "S&P-500",
  "enforceMembership": true,
  "handleRemovals": "liquidate_positions"
}
```

#### Capital Optimization
- **Adaptive lot sizing**: Dynamic lot size adjustment based on cash reserves
- **Cash yield**: Earn interest on idle cash
- **Deferred selling**: Hold sell orders when cash is abundant

### 4. S&P 500 Stock List

**Requirement**: Include current S&P 500 component stocks (as of data gathering date)

**Approach**:
- Research and compile current S&P 500 constituents
- Verify stock symbols are correct and tradeable
- Document the date of constituency snapshot

**Note**: S&P 500 has ~500-505 stocks (can exceed 500 due to multiple share classes)

### 5. Historical Tracking Data

**Timeline Coverage**: Minimum 4 years (2021-2025) to match nasdaq100 config date range

**Data Required**:
- Annual reconstitution events (typically quarterly for S&P 500)
- Mid-period additions (IPOs, spin-offs that meet criteria)
- Removals due to:
  - Mergers/acquisitions
  - Bankruptcies
  - Failing to meet index criteria
  - Corporate actions

**Source**: S&P Dow Jones Indices press releases, financial news archives

### 6. Capital Settings

**Suggested Values** (can be adjusted):
- `totalCapitalUsd`: 10,000,000 (larger than NASDAQ-100's 3M due to more stocks)
- `marginPercent`: 20 (same as NASDAQ-100)
- `lotSizeUsd`: 10,000 (same as NASDAQ-100)

**Rationale**: S&P 500 has ~5x more stocks than NASDAQ-100, so proportionally more capital is needed

### 7. Trading Strategy Defaults

**Requirement**: Use same conservative defaults as NASDAQ-100 config

**Why**:
- Proven strategy parameters
- Appropriate risk management
- Balanced approach for diversified portfolio

**Key Settings**:
- Grid interval: 10%
- Profit requirement: 10%
- Stop loss: 30%
- Max lots: 40 per stock
- Trailing orders: Disabled by default
- Momentum-based trading: Disabled by default

## Success Criteria

1. ✅ `sp500.json` created with all required sections
2. ✅ `sp500-history.json` created with comprehensive historical tracking
3. ✅ All features from `nasdaq100.json` included
4. ✅ Index tracking properly configured
5. ✅ Capital optimization strategies enabled
6. ✅ Beta scaling support configured
7. ✅ Complete stock list with correct symbols
8. ✅ Configuration validates against portfolio config schema
9. ✅ Ready for use in portfolio backtests via API

## Non-Goals

- Not implementing new features (only feature parity)
- Not modifying existing portfolio backtest service
- Not creating custom S&P 500-specific strategies
- Not backtesting the configuration (that's for user to do)

## Dependencies

- Existing `IndexTrackingService` (no changes needed)
- Existing `portfolioConfigLoader.js` (no changes needed)
- Existing portfolio backtest infrastructure (no changes needed)
- Historical S&P 500 constituency data (needs research and compilation)

## Risks & Mitigation

**Risk 1**: Historical constituency data may be incomplete
- **Mitigation**: Document coverage period clearly, mark uncertain data with notes

**Risk 2**: S&P 500 has more frequent changes than NASDAQ-100
- **Mitigation**: Focus on major changes, document coverage limitations

**Risk 3**: Stock symbols may have changed over time
- **Mitigation**: Use current symbols, note historical symbol changes in history file

**Risk 4**: Multiple share classes (e.g., GOOG/GOOGL)
- **Mitigation**: Include both if both are in index, document relationship

## Timeline

1. Research S&P 500 constituency (current + historical): 1-2 hours
2. Create sp500-history.json: 30 minutes
3. Create sp500.json configuration: 15 minutes
4. Validation and testing: 15 minutes

**Total Estimated Time**: 2-3 hours
