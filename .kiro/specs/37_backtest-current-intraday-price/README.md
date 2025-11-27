# Spec 37: Backtest with Current Intraday Price

## Overview

Enable backtests to include today's trading data by fetching the current intraday price during market hours and using it as the "close" price for the current day.

## Problem

Currently, backtests end at the most recent **historical daily close** available in the database:
- If running a backtest during trading hours on Friday, the latest data is Thursday's close
- Users cannot see how their strategy performs with **today's current price**
- The 1-day lag makes backtests feel outdated during active trading

## Solution

**Auto-extend backtests to include current day**:
1. **Default end date**: Always use today's date (current date) as the end date
2. **Fetch current price**: During market hours (9:30 AM - 4:00 PM ET), fetch the current intraday price
3. **Append to historical data**: Add today's data as a synthetic daily bar with current price as "close"
4. **Run backtest**: Process historical data + today's current price

## User Stories

### Story 1: Backtest with Current Intraday Price
**As a** trader
**I want** my backtests to include today's current price during market hours
**So that** I can see how my strategy is performing right now

**Acceptance Criteria**:
- Backtest automatically includes today's date when market is open
- Current intraday price is fetched via Yahoo Finance API
- Today's price is treated as a daily close for backtesting purposes
- Outside market hours, use last available close (previous day's close)
- Backtest shows accurate position status with current prices

### Story 2: Default End Date = Today
**As a** user
**I want** the default end date to always be today's date
**So that** I don't have to manually update it every time

**Acceptance Criteria**:
- Single-stock backtest form defaults to today's date
- Portfolio backtest form defaults to today's date
- Batch backtest form defaults to today's date
- User can still override with a past date if desired

## Key Features

✅ **Auto-fetch current price** during market hours (9:30 AM - 4:00 PM ET)
✅ **Yahoo Finance API integration** for real-time intraday data
✅ **Synthetic daily bar** for current day (Open, High, Low, Close)
✅ **Market hours detection** (use current price vs. previous close)
✅ **Seamless integration** with existing backtest logic
✅ **No UI changes required** (works behind the scenes)
✅ **Default end date = Today** across all backtest forms

## Benefits

**For Users**:
- See current performance without waiting for market close
- More relevant and actionable backtest results
- No need to manually set end date

**For System**:
- Leverages existing Yahoo Finance infrastructure
- Minimal code changes (data layer enhancement)
- Backward compatible with historical-only backtests

## Implementation Approach

See detailed technical design in `design.md`.

## Time Estimate

**Total: 8 hours**
- Requirements & Design: 1 hour ✅ (This spec)
- Backend Implementation: 4 hours
- Testing & Validation: 2 hours
- Documentation: 1 hour

## Dependencies

- Yahoo Finance API (yfinance library) - Already in use
- Existing price data service
- Market hours calculation logic

## Success Criteria

1. ✅ Backtests automatically include today's current price during market hours
2. ✅ Current price fetched via Yahoo Finance with <5 minute latency
3. ✅ Outside market hours, use previous day's close
4. ✅ Synthetic daily bar properly formatted (OHLC)
5. ✅ Default end date = Today for all backtest forms
6. ✅ Backtest results accurately reflect current positions
7. ✅ No breaking changes to existing backtest logic

## Out of Scope

- Real-time streaming price updates (this is a one-time fetch per backtest run)
- Intraday backtesting with minute-level data
- Live trading integration
- Price alerts or notifications

---

**Spec Created**: 2025-10-17
**Status**: Ready for Implementation
**Priority**: High
**Complexity**: Medium
