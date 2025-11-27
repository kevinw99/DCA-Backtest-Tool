# Spec 33: Batch Future Trades Aggregation

## Problem Statement

When running batch mode backtests across multiple stocks, users need to see the aggregated future trades for each stock on the results page to effectively manage a real stock portfolio. Currently, the single backtest view shows "Future Trade" information (next BUY and SELL activation/execution conditions), but this information is not available in batch mode results.

## User Story

As a portfolio manager running batch backtests, I want to see the aggregated future trade information for each stock so that I can understand what trades are likely to execute next across my portfolio and make informed capital allocation decisions.

## Current State

### Single Backtest Mode
- **BacktestResults.js** displays a "Future Trade" section (lines 1508-1643) showing:
  - Current price and average cost
  - Next BUY activation: activation price, rebound requirement
  - Next SELL activation: activation price, pullback requirement, profit target
  - Active trailing stops: stop price, limit price, peak/bottom references

### Batch Backtest Mode
- **BatchResults.js** shows aggregate statistics and detailed results table
- Each stock's individual backtest result includes:
  - `activeTrailingStopBuy` and `activeTrailingStopSell` objects (from dcaBacktestService.js lines 1162-1212)
  - `recentPeak`, `recentBottom`, `lastTransactionDate` (from dcaBacktestService.js lines 1073-1076)
  - Backtest parameters in `result.parameters`
- **Missing**: Aggregation and display of future trade information per stock

## Requirements

### FR1: Backend - Add Future Trade Data to Batch Results
**Priority**: P0 (Core Feature)

Each batch result object must include a `futureTrades` property containing:
- `currentPrice`: Final price from backtest
- `avgCost`: Average cost of current holdings
- `hasHoldings`: Boolean indicating if stock has open positions
- `buyActivation`: Object with next BUY trade details:
  - `isActive`: Boolean (is there an active trailing stop buy?)
  - If active: `stopPrice`, `lowestPrice`, `recentPeakReference`, `reboundPercent`
  - If not active: `activationPercent`, `activationPrice`, `reboundPercent`, `referencePrice`
- `sellActivation`: Object with next SELL trade details (null if no holdings):
  - `isActive`: Boolean (is there an active trailing stop sell?)
  - If active: `stopPrice`, `limitPrice`, `highestPrice`, `lastUpdatePrice`, `recentBottomReference`, `pullbackPercent`, `profitRequirement`
  - If not active: `activationPercent`, `activationPrice`, `pullbackPercent`, `profitRequirement`, `referencePrice`

**Implementation Location**: `backend/services/batchBacktestService.js` lines 500-600
- After each individual backtest completes (line 501-513)
- Calculate future trades using same logic as single backtest
- Attach to `result.futureTrades`

### FR2: Frontend - Add Future Trades Section to Batch Results
**Priority**: P0 (Core Feature)

Add a new "Future Trades by Stock" section to `BatchResults.js` showing:
- One expandable card per stock tested
- Card header shows: Symbol, Current Price, Holdings status
- Card body shows (when expanded):
  - Next BUY: Activation price/condition, execution trigger
  - Next SELL: Activation price/condition, execution trigger, profit target
  - Visual indicators for active vs. theoretical stops

**Design Requirements**:
- Use accordion-style expandable cards (default: all collapsed)
- Color coding: Blue for BUY, Red for SELL, Green for active stops
- Display format matches single backtest "Future Trade" section
- Section appears after "Best Parameters by Stock" and before "Detailed Results Table"

### FR3: Per-Stock Filtering
**Priority**: P1 (Enhancement)

When user filters batch results by stock:
- Show only the selected stock's future trades
- Highlight the future trade card for filtered stock
- Maintain context when switching between stocks

### FR4: Strategy Support
**Priority**: P0 (Core Feature)

Support both LONG and SHORT strategies:
- LONG: Show "Next BUY" and "Next SELL"
- SHORT: Show "Next SHORT" and "Next COVER"
- Use appropriate terminology and color coding per strategy

## Non-Requirements

- **NR1**: Real-time price updates (use final backtest price only)
- **NR2**: Trade recommendations or confidence scores
- **NR3**: Historical future trade predictions (only current/final state)
- **NR4**: Portfolio-level capital allocation optimization

## Success Criteria

1. Batch results include `futureTrades` object for each stock
2. UI displays expandable "Future Trades by Stock" section
3. Information matches single backtest "Future Trade" display format
4. Works for both LONG and SHORT strategies
5. Users can identify which stocks have active trailing stops vs. theoretical activation conditions

## Dependencies

- Existing single backtest future trade calculation logic (BacktestResults.js lines 289-405)
- Existing batch backtest infrastructure (batchBacktestService.js)
- Existing trailing stop state tracking (dcaBacktestService.js)

## Technical Constraints

- Must not impact batch backtest performance (calculation already done in single backtest)
- Must handle edge cases: no holdings, no transactions, missing data
- Must support both Beta-scaled and non-scaled parameter sets
