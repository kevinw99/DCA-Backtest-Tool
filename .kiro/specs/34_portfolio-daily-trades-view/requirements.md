# Requirements: Portfolio Daily Trades View

## Problem Statement

Currently, the portfolio backtest displays "Stock Performance Breakdown" organized by individual stocks, showing transaction history for each stock separately. Users need a complementary view that aggregates trades by date to understand daily portfolio management activities across all stocks.

## User Story

As a portfolio backtest user, I want to see all trades aggregated by date across all stocks, so I can:
- Understand what happened on each trading day
- See how capital was deployed/recovered on specific dates
- Track cash availability changes as trades execute
- Identify patterns in multi-stock trading behavior
- Analyze daily portfolio activity chronologically

## Key Requirements

### 1. Daily Trade Aggregation View

**Display Trades by Date Instead of by Stock**:
- Merge all stock transactions into a single chronological view
- Group transactions by date
- Only show dates where trades occurred (skip non-trading days)
- Sort dates in chronological order (oldest to newest, or configurable)

### 2. Transaction Details Per Day

**For Each Trading Day, Show**:
- **Date**: Trading date (YYYY-MM-DD format)
- **Transactions List**: All trades that occurred on this date
  - Stock Symbol
  - Transaction Type (BUY, SELL, TRAILING_STOP_BUY, etc.)
  - Price
  - Quantity/Shares
  - Transaction Value
  - P&L (for sells)
- **Trade Count**: Number of trades on this day (e.g., "3 trades")
- **Daily Summary Metrics**:
  - Total Buy Amount (sum of all buys)
  - Total Sell Amount (sum of all sells)
  - Net Cash Flow (sells - buys)
  - Daily Realized P&L (sum of all sell P&Ls)

### 3. Cash Position Tracking

**Show Cash Available After Each Day's Trades**:
- **Cash Before Day**: Cash reserve at start of trading day
- **Cash After Day**: Cash reserve after all trades execute
- **Cash Change**: Delta between before and after
- This helps users understand capital availability evolution

### 4. Visual Design

**Table-Based Layout**:
- Main table with one row per trading day
- Expandable/collapsible rows to show transaction details
- Compact summary view, detailed expanded view
- Responsive design for different screen sizes

**Color Coding**:
- Positive cash flow (net sells > buys): Green highlight
- Negative cash flow (net buys > sells): Red/Orange highlight
- Neutral (equal): Gray/White

### 5. Filtering and Sorting

**User Controls**:
- Sort by date (ascending/descending)
- Filter by date range (optional)
- Filter by transaction type (BUY only, SELL only, or both)
- Filter by specific stock symbols (multi-select)

### 6. Integration with Existing UI

**Placement**:
- Add new section in `PortfolioResults.js` called "Daily Trading Activity"
- Position it after "Stock Performance Breakdown" or make it a tab option
- Maintain consistency with existing design patterns

**Data Source**:
- Use existing transaction data from `stockResults`
- Aggregate on the frontend (no backend changes required initially)
- Consider backend aggregation if performance becomes an issue

## Non-Functional Requirements

### Performance
- Handle portfolios with thousands of transactions efficiently
- Use virtualization for long lists (if >100 trading days)
- Lazy loading for expanded transaction details

### Usability
- Default view: Collapsed rows showing daily summaries
- Click to expand and see individual transactions
- Clear visual hierarchy between dates and transactions
- Responsive on mobile/tablet devices

### Accessibility
- Keyboard navigation support
- Screen reader compatible
- High contrast mode support

## Success Criteria

1. Users can view all trades aggregated by date in chronological order
2. Users can see cash position evolution day-by-day
3. Users can expand any date to see detailed transaction breakdown
4. View performs well with large portfolios (500+ transactions)
5. Design is consistent with existing portfolio UI components
6. Feature is discoverable and intuitive to use

## Out of Scope (For This Spec)

- Backend aggregation API (use frontend aggregation initially)
- Advanced analytics on daily patterns
- Export to CSV/PDF
- Comparison between different portfolio runs
- Intraday transaction timing (all transactions treated as end-of-day)

## Dependencies

- Existing portfolio backtest results structure
- Transaction data from `stockResults` array
- Cash flow tracking from portfolio metrics

## Acceptance Testing

**Test Scenario 1: Basic Display**
- Given a portfolio with 10 stocks and 50 transactions
- When viewing the Daily Trading Activity section
- Then I see dates with trades only (not all calendar dates)
- And dates are sorted chronologically
- And each date shows summary metrics

**Test Scenario 2: Cash Position Tracking**
- Given a portfolio starting with $500,000 capital
- When a day has 3 buys ($30,000 total) and 2 sells ($25,000 total)
- Then cash after day = cash before day + $25,000 - $30,000
- And the net cash flow shows -$5,000

**Test Scenario 3: Transaction Details**
- Given a date with multiple trades
- When I click to expand the date row
- Then I see all transactions for that date
- And each transaction shows stock, type, price, quantity, value, P&L
- And transactions are grouped by stock or time

**Test Scenario 4: Empty State**
- Given a portfolio with no completed trades yet
- When viewing Daily Trading Activity
- Then I see a message "No trades executed during backtest period"

**Test Scenario 5: Large Portfolio Performance**
- Given a portfolio with 500+ transactions across 200+ trading days
- When loading the Daily Trading Activity view
- Then the view loads in <2 seconds
- And scrolling/expanding rows is smooth

## Questions for Clarification

1. Should rejected orders be included in the daily view, or only executed trades?
2. Preferred default sort order: newest first or oldest first?
3. Should we show running cash balance (cumulative) or just daily change?
4. Do we need a "total" row at the top/bottom summarizing all days?
5. Should the view support pagination, or is infinite scroll preferred?
