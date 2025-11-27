# Requirements: Nasdaq 100 Index Tracking and Capital Optimization

## Overview

Current Nasdaq 100 portfolio backtests suffer from **survivorship bias** and **unrealistic capital allocation** that produce artificially inflated returns. This specification addresses four critical issues to make portfolio backtests historically accurate and capital-efficient.

## Problem Statement

### Issue 1: Survivorship Bias - Index Additions
**Current Behavior:**
- Backtest includes all current Nasdaq 100 stocks for the entire backtest period
- Example: APP (AppLovin) and PLTR (Palantir) were added to Nasdaq 100 recently (2024) but backtest includes them from 2021
- This captures their best-performing periods BEFORE they were actually in the index
- Results in artificially inflated returns that would be impossible to achieve in reality

**Required Behavior:**
- Track historical Nasdaq 100 index additions with exact dates
- Only trade a stock AFTER it's added to the index
- Example: If PLTR was added on 2024-11-18, backtest should only trade PLTR from 2024-11-18 onwards

### Issue 2: Index Removals
**Current Behavior:**
- Backtest continues trading stocks that were dropped from Nasdaq 100
- Example: NOK (Nokia) was dropped from Nasdaq 100 but backtest still trades it

**Required Behavior:**
- Track historical Nasdaq 100 index removals with exact dates
- Stop trading a stock AFTER it's removed from the index
- Handle position liquidation when stock is removed

### Issue 3: Partial Trading Period Handling
**Current Behavior:**
- Undefined behavior when a stock doesn't have data for the entire backtest period
- Capital allocation assumes all stocks trade for full period

**Required Behavior:**
- Calculate actual trading days available for each stock within backtest period
- Adjust capital allocation based on actual availability
- Report partial period metrics separately in results

### Issue 4: Idle Cash Optimization
**Current Behavior:**
- Static lot size allocation ($10k per stock)
- After initial deployment, cash reserve accumulates (image shows ~$300k after March 2024)
- Idle cash earns 0% return, dragging down portfolio performance

**Required Behavior:**
- Implement dynamic capital allocation strategies to utilize idle cash:
  - **Strategy A: Adaptive Lot Sizing** - Increase lot sizes when cash reserve exceeds threshold
  - **Strategy B: Dynamic Grid Tightening** - Reduce grid intervals when cash available
  - **Strategy C: Opportunistic Stock Addition** - Add more stocks from Nasdaq 100 when cash available
  - **Strategy D: Cash Yield** - Allocate idle cash to money market/treasury (assume 4-5% annual yield)
  - **Strategy E: Rebalancing** - Redistribute capital from underperforming to outperforming stocks

## Functional Requirements

### FR1: Index Constituency Data Management

**FR1.1: Data Source**
- Manually research and compile historical Nasdaq 100 constituency changes from 2021-09-01 to present
- Sources: Nasdaq official announcements, financial news archives, Wikipedia history
- Minimum data: Symbol, addition date, removal date (if applicable)

**FR1.2: Data Storage**
- Create JSON file: `backend/data/nasdaq100-history.json`
- Schema:
```json
{
  "index": "NASDAQ-100",
  "lastUpdated": "2025-10-17",
  "changes": [
    {
      "symbol": "PLTR",
      "addedDate": "2024-11-18",
      "removedDate": null,
      "notes": "Added during November 2024 rebalance"
    },
    {
      "symbol": "NOK",
      "addedDate": null,
      "removedDate": "2023-12-18",
      "notes": "Removed during December 2023 rebalance"
    }
  ]
}
```

**FR1.3: Config Integration**
- Add `indexTracking` section to portfolio config files:
```json
{
  "indexTracking": {
    "enabled": true,
    "indexName": "NASDAQ-100",
    "enforceMembership": true,
    "handleRemovals": "liquidate_positions"
  }
}
```

### FR2: Trading Period Enforcement

**FR2.1: Entry Rules**
- If `indexTracking.enabled = true`:
  - Do NOT place any orders before stock's `addedDate`
  - Start trading on the first trading day ON or AFTER `addedDate`

**FR2.2: Exit Rules**
- If stock has `removedDate`:
  - Stop placing new buy orders immediately on `removedDate`
  - Liquidate all existing positions at market price on `removedDate`
  - Record forced liquidation in transaction log

**FR2.3: Stocks Without Tracking Data**
- If stock not found in `nasdaq100-history.json`:
  - Assume it was in index for entire backtest period (backward compatibility)
  - Log warning about missing tracking data

### FR3: Partial Period Capital Allocation

**FR3.1: Trading Days Calculation**
- Calculate actual trading days for each stock:
  ```
  actualTradingDays = min(backtestEndDate, removedDate || backtestEndDate)
                     - max(backtestStartDate, addedDate || backtestStartDate)
  ```

**FR3.2: Capital Allocation Adjustment**
- Current: Equal allocation = `totalCapital / numberOfStocks`
- New: Weighted by availability
  ```
  totalTradingDayCapacity = sum(actualTradingDays for all stocks)
  stockAllocation = (stockActualTradingDays / totalTradingDayCapacity) * totalCapital
  ```

**FR3.3: Reporting**
- Add to portfolio results:
  - `partialPeriodStocks`: List of stocks with partial trading periods
  - `averageTradingDaysPerStock`: Mean trading days across all stocks
  - `capitalAllocationByStock`: Map of symbol → allocated capital

### FR4: Dynamic Capital Optimization

**FR4.1: Configuration**
- Add `capitalOptimization` section to portfolio config:
```json
{
  "capitalOptimization": {
    "enabled": true,
    "strategies": ["adaptive_lot_sizing", "cash_yield"],
    "adaptiveLotSizing": {
      "cashReserveThreshold": 100000,
      "maxLotSizeMultiplier": 2.0,
      "increaseStepPercent": 20
    },
    "cashYield": {
      "enabled": true,
      "annualYieldPercent": 4.5,
      "minCashToInvest": 50000
    }
  }
}
```

**FR4.2: Strategy A - Adaptive Lot Sizing**
- Monitor cash reserve daily
- When `cashReserve > cashReserveThreshold`:
  - Increase lot size by `increaseStepPercent`
  - Cap at `lotSizeUsd * maxLotSizeMultiplier`
- When cash depleted:
  - Gradually reduce lot size back to baseline

**FR4.3: Strategy D - Cash Yield**
- Calculate daily cash reserve
- Apply daily interest rate: `dailyRate = annualYieldPercent / 365`
- If `cashReserve > minCashToInvest`:
  - Add to portfolio equity: `cashYieldRevenue = cashReserve * dailyRate`
  - Track separately in metrics: `totalCashYieldRevenue`

**FR4.4: Future Strategies (Placeholder)**
- Strategy B: Dynamic Grid Tightening
- Strategy C: Opportunistic Stock Addition
- Strategy E: Rebalancing
- Document placeholders for future implementation

### FR5: Results Reporting Enhancements

**FR5.1: Index Tracking Metrics**
- Add to portfolio results:
```javascript
{
  indexTracking: {
    enabled: true,
    stocksAdded: [
      { symbol: "PLTR", addedDate: "2024-11-18", tradingDays: 245 }
    ],
    stocksRemoved: [
      { symbol: "NOK", removedDate: "2023-12-18", finalValue: 45230.50 }
    ],
    forcedLiquidations: 2,
    forcedLiquidationValue: 125840.75
  }
}
```

**FR5.2: Capital Optimization Metrics**
- Add to portfolio results:
```javascript
{
  capitalOptimization: {
    strategies: ["adaptive_lot_sizing", "cash_yield"],
    averageCashReserve: 285400.50,
    peakCashReserve: 425600.00,
    cashYieldRevenue: 12450.75,
    adaptiveLotSizingEvents: 45,
    maxLotSizeReached: 18000
  }
}
```

**FR5.3: Capital Utilization Enhancement**
- Existing chart shows: deployedCapital, cashReserve, utilizationPercent
- Add: `cashYieldRevenue` as a separate line
- Add annotation markers for index changes (additions/removals)

## Non-Functional Requirements

### NFR1: Data Accuracy
- Index constituency data must be manually verified from multiple sources
- Minimum 2 authoritative sources required for each date

### NFR2: Performance
- Index tracking checks should add < 5ms per stock per day to backtest execution
- Support up to 200 stocks with index tracking enabled

### NFR3: Backward Compatibility
- Existing portfolio configs without `indexTracking` section should work unchanged
- Default behavior: `indexTracking.enabled = false`

### NFR4: Configurability
- All optimization strategies must be individually enable/disable via config
- Conservative defaults to prevent aggressive over-optimization

## Success Criteria

1. **Survivorship Bias Eliminated**: Backtest results with `indexTracking.enabled = true` should show lower returns than current implementation (more realistic)

2. **Capital Efficiency Improved**: With `cashYield` strategy enabled, idle cash should contribute 4-5% annual return instead of 0%

3. **Transparency**: Results clearly show which stocks were added/removed and impact on performance

4. **Historical Accuracy**: Stock trading periods match actual Nasdaq 100 membership periods (verified against historical records)

## Out of Scope

- Automatic fetching of index constituency data from external APIs
- Advanced machine learning for capital allocation
- Cross-index portfolio backtests (S&P 500, Russell 2000, etc.)
- Real-time index tracking for live trading

## Dependencies

- Existing portfolio backtest infrastructure
- `backend/data/` directory for storing index history
- Manual research for historical index changes from 2021-09-01 to present

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Inaccurate historical data | High - Wrong trading periods produce invalid results | Verify from multiple authoritative sources |
| Complex capital allocation logic | Medium - Bugs could produce invalid metrics | Comprehensive unit tests with known scenarios |
| Performance degradation | Low - Daily checks could slow large backtests | Cache index membership lookups |
| User confusion | Medium - More complex config files | Provide clear examples and documentation |
