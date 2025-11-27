# Spec 34: Portfolio Daily Trades View

## Overview

This specification adds a new **Daily Trading Activity** view to the portfolio backtest results. Instead of organizing trades by stock (as in the existing Stock Performance Breakdown), this view aggregates all trades by **date**, allowing users to see daily portfolio management activities across all stocks chronologically.

## Key Features

1. **Date-Based Aggregation**: All trades merged and grouped by trading date
2. **Cash Position Tracking**: Shows cash available before and after each day's trades
3. **Daily Metrics**: Trade counts, buy/sell amounts, net cash flow, realized P&L per day
4. **Expandable Details**: Click any date row to see individual transactions
5. **Filtering & Sorting**: Sort chronologically (asc/desc), filter by type or stock
6. **Only Trading Days**: Shows only dates with actual trades (skips empty days)

## User Benefits

- **Daily Portfolio Visibility**: See exactly what happened on any given trading day
- **Capital Flow Analysis**: Track how cash reserves change day-by-day
- **Multi-Stock Coordination**: Understand when multiple stocks traded on the same day
- **Chronological Insight**: Identify trading patterns and busy/quiet periods

## Visual Design

```
┌────────────────────────────────────────────────────────────────────┐
│  📅 Daily Trading Activity                                         │
│  View all trades aggregated by date with cash position tracking   │
├────────────────────────────────────────────────────────────────────┤
│  [Sort: ↓ Newest First]  [Filter: All Trades ▼]  [Stocks: All ▼] │
├────┬────────────┬────────┬──────┬───────┬─────────────┬───────────┤
│  › │ Date       │ Trades │ Buys │ Sells │ Net Flow    │ Cash After│
├────┼────────────┼────────┼──────┼───────┼─────────────┼───────────┤
│  › │ 2024-08-15 │    5   │   3  │   2   │ -$5,000 🔴  │ $485,000  │
│  › │ 2024-08-08 │    3   │   2  │   1   │ +$10,000 🟢 │ $490,000  │
│  ∨ │ 2024-08-05 │    2   │   1  │   1   │  $0         │ $480,000  │
│    ├─────────────────────────────────────────────────────────────┤
│    │ Transactions on 2024-08-05:                                 │
│    │  • AAPL  │ BUY  │ $180.50 │ 55.4 shares │ $10,000 │ -      │
│    │  • PLTR  │ SELL │ $29.28  │ 341.3 shares│ $10,000 │ +$1,500│
│    └─────────────────────────────────────────────────────────────┘
```

## Technical Approach

### Frontend Implementation (No Backend Changes)

1. **Component**: `DailyTradesView.js` (new component in `frontend/src/components/`)
2. **Data Source**: Existing `stockResults` array from portfolio backtest response
3. **Aggregation**: Client-side grouping by date with cash flow calculations
4. **Integration**: Add section to `PortfolioResults.js` after Stock Performance Breakdown

### Data Flow

```
PortfolioResults
  ↓ (props: stockResults, portfolioSummary)
DailyTradesView
  ↓ (aggregate transactions)
dailyTrades = [
  {
    date: "2024-08-05",
    transactions: [array of all trades on this date],
    tradeCount: 5,
    buyCount: 3,
    sellCount: 2,
    totalBuyAmount: 30000,
    totalSellAmount: 25000,
    netCashFlow: -5000,
    dailyRealizedPNL: 2500,
    cashBefore: 500000,
    cashAfter: 495000
  },
  ...
]
```

## Files to Create/Modify

### New Files
- `frontend/src/components/DailyTradesView.js` (main component)
- `frontend/src/components/DailyTradesView.css` (styling)

### Modified Files
- `frontend/src/components/PortfolioResults.js` (add new section)

### No Backend Changes Required
All data already available in existing portfolio backtest response.

## Implementation Phases

1. **Phase 1**: Component foundation and data aggregation (6 hours)
2. **Phase 2**: Detail view and filters (4 hours)
3. **Phase 3**: Integration and polish (3.5 hours)
4. **Phase 4**: Testing and validation (5.5 hours)
5. **Phase 5**: Accessibility and docs (2.5 hours)
6. **Phase 6**: Review and deployment (2.5 hours)

**Total Estimated Time**: 24 hours

## Success Metrics

✅ Users can view daily portfolio activity chronologically
✅ Cash position visible before/after each trading day
✅ Expand any date to see transaction details
✅ Performs well with 500+ transactions
✅ Accessible via keyboard and screen reader
✅ Consistent with existing portfolio UI design

## Related Specs

- **Spec 28**: Portfolio Capital Management (provides transaction data)
- **Spec 29**: Portfolio Backtest UI (existing results page)
- **Spec 30**: Portfolio Visualization Enhancements (design patterns)
- **Spec 32**: Portfolio Calls Individual DCA (transaction structure)

## Questions Answered

1. **Rejected orders included?** No, show only executed trades (can add rejected orders view separately)
2. **Default sort order?** Newest first (descending), user can toggle
3. **Cash balance format?** Show both "Cash Before" and "Cash After" columns
4. **Total row needed?** Not in MVP, can add as enhancement
5. **Pagination vs infinite scroll?** Neither initially, use virtualization if >100 days

## Next Steps

1. ✅ Requirements documented
2. ✅ Design documented
3. ✅ Tasks documented
4. ⏭️ Begin implementation (Phase 1)
5. ⏭️ Gather user feedback and iterate

---

**Spec Created**: 2025-10-15
**Status**: Ready for Implementation
**Priority**: Medium
**Complexity**: Medium
