# Requirements: Stock Performance Buy & Hold Comparison Columns

## Overview

Add Buy & Hold (B&H) comparison columns to the Stock Performance Breakdown table in the portfolio backtest results page. This enhancement will allow users to compare each stock's DCA strategy performance against a simple Buy & Hold strategy for the same stock.

## Business Value

- **Performance Comparison**: Users can immediately see which stocks benefited from DCA strategy vs simple B&H
- **Strategy Validation**: Identify stocks where DCA adds value vs stocks where B&H would be better
- **Data-Driven Decisions**: Make informed decisions about which stocks to apply DCA vs B&H
- **Complete Analysis**: Portfolio-level B&H comparison already exists; this adds per-stock granularity

## User Story

**As a** portfolio backtest user
**I want to** see Buy & Hold comparison metrics for each stock in the performance breakdown table
**So that** I can evaluate whether the DCA strategy outperforms Buy & Hold on a per-stock basis

## Functional Requirements

### FR-1: Display Buy & Hold P&L Column

**Given** a portfolio backtest has been executed
**When** I view the Stock Performance Breakdown table
**Then** I should see a "B&H P&L" column showing the total profit/loss if I had used Buy & Hold for that stock

**Acceptance Criteria:**
- Column displays Buy & Hold total P&L in USD (formatted as currency)
- Positive values shown in green, negative in red
- Column is sortable (ascending/descending)

### FR-2: Display Buy & Hold Return % Column

**Given** a portfolio backtest has been executed
**When** I view the Stock Performance Breakdown table
**Then** I should see a "B&H Return %" column showing the percentage return for Buy & Hold

**Acceptance Criteria:**
- Column displays Buy & Hold return percentage
- Positive values shown in green, negative in red
- Column is sortable (ascending/descending)
- Formatted with 2 decimal places (e.g., "23.45%")

### FR-3: Display P&L Difference Column

**Given** a portfolio backtest has been executed
**When** I view the Stock Performance Breakdown table
**Then** I should see a "P&L Diff" column showing the difference between DCA P&L and B&H P&L

**Acceptance Criteria:**
- Column displays: DCA Total P&L - B&H Total P&L
- Positive values (DCA outperforms) shown in green
- Negative values (B&H outperforms) shown in red
- Formatted as currency
- Column is sortable (ascending/descending)

### FR-4: Display Return % Difference Column

**Given** a portfolio backtest has been executed
**When** I view the Stock Performance Breakdown table
**Then** I should see a "Return Diff %" column showing the difference between DCA return % and B&H return %

**Acceptance Criteria:**
- Column displays: DCA Return % - B&H Return %
- Positive values (DCA outperforms) shown in green
- Negative values (B&H outperforms) shown in red
- Formatted with 2 decimal places (e.g., "+5.23%")
- Column is sortable (ascending/descending)

### FR-5: Column Placement

**Given** the existing Stock Performance Breakdown columns
**When** new B&H comparison columns are added
**Then** they should be placed logically in the table

**Acceptance Criteria:**
- B&H columns grouped together for easy comparison
- Suggested placement: After existing "Return %" and "CAGR" columns, before "Contribution"
- Column order:
  1. Existing columns (Symbol, Lots, Capital, Market Value, Total P&L, Return %, CAGR)
  2. **NEW: B&H P&L**
  3. **NEW: B&H Return %**
  4. **NEW: P&L Diff**
  5. **NEW: Return Diff %**
  6. Existing columns (Contribution, Buys, Sells, Rejected, Details)

### FR-6: Handle Missing B&H Data

**Given** a stock does not have B&H comparison data
**When** I view the Stock Performance Breakdown
**Then** the B&H columns should display "N/A" or appropriate placeholder

**Acceptance Criteria:**
- Graceful handling of missing data
- No UI crashes or errors
- Clear indication when B&H data unavailable

## Non-Functional Requirements

### NFR-1: Performance

- Table rendering should not be noticeably slower with additional columns
- Sorting should be responsive (< 100ms for typical portfolio sizes)

### NFR-2: Consistency

- Column styling matches existing columns
- Sort icons match existing implementation
- Color coding (green/red) consistent with existing P&L columns

### NFR-3: Responsiveness

- Table should remain usable on standard screen sizes
- Consider horizontal scroll if needed

## Constraints

- Must work with existing portfolio backtest infrastructure
- Must not break existing functionality
- Must use existing Buy & Hold calculation service (`portfolioBuyAndHoldService.js`)

## Dependencies

### B&H Comparison Columns
- **Backend**: `portfolioBuyAndHoldService.js` (already exists - calculates per-stock B&H)
- **Backend**: `portfolioMetricsService.js` (needs modification to merge B&H data into stockResults)
- **Frontend**: `StockPerformanceTable.js` (needs new columns)

### UI/UX Improvements
- **Frontend**: `PortfolioResults.js` (main results page component)
- **Frontend**: Multi-Stock Price Comparison component (needs inline stock list)
- **Frontend**: Daily Trading Activity component (needs default sort order change)
- **Frontend**: Current Holdings component (needs to be merged into Stock Performance)

## UI/UX Improvements (Vertical Space Optimization)

### FR-7: Compact Multi-Stock Price Comparison

**Given** the Multi-Stock Price Comparison chart section displays many stocks
**When** I view the portfolio results page
**Then** stock symbols should be displayed in a single line (like Portfolio Composition) instead of one per line

**Acceptance Criteria:**
- All stock symbols displayed inline (e.g., "NVDA • SHOP • META • SMCI • LRCX • CRWD")
- Similar layout to "Portfolio Composition Over Time" section
- Saves vertical space on the page

### FR-8: Current Holdings Collapsed by Default

**Given** the Current Holdings section contains detailed lot information
**When** I view the portfolio results page
**Then** holdings details should be collapsed by default with expand/collapse functionality

**Acceptance Criteria:**
- Holdings summary visible (total market value, capital deployed, unrealized P&L)
- Per-stock holdings collapsed by default (like Stock Performance Breakdown)
- Click to expand shows lot-level details (purchase date, price, shares, etc.)
- Consistent expand/collapse behavior with other sections

### FR-9: Merge Current Holdings into Stock Performance Breakdown

**Given** both Current Holdings and Stock Performance Breakdown show per-stock data
**When** I view the portfolio results page
**Then** they should be combined into a single section to save space

**Acceptance Criteria:**
- Use Stock Performance Breakdown table structure as the main view
- Add current holdings information to each stock's expandable detail section
- When row is expanded, show both:
  - Transaction history (existing)
  - Current holdings (lot-level details: purchase date, price, shares, current value, unrealized P&L)
- Remove separate Current Holdings section
- One-stop view for all stock-level information

**Suggested Expandable Section Layout:**
```
[Stock Symbol Row - collapsed]

[Expanded Section]
├─ Current Holdings (if stock is held)
│  └─ Lot details table (purchase date, price, shares, current value, unrealized P&L)
└─ Transaction History
   └─ All transactions table (existing)
```

### FR-10: Daily Trading Activity Default Sort Order

**Given** the Daily Trading Activity section allows sorting by date
**When** I view the portfolio results page
**Then** trades should be sorted oldest first by default (not newest first)

**Acceptance Criteria:**
- Default sort: ↑ Oldest First (ascending by date)
- User can click to change to ↓ Newest First
- Rationale: Users want to see how portfolio was built over time chronologically

## Out of Scope

- Modifying Buy & Hold calculation logic (already exists in `portfolioBuyAndHoldService.js`)
- Adding B&H comparison to other views (e.g., charts, transaction history)
- Per-stock B&H parameter customization
- Portfolio-level B&H comparison enhancements (already exists separately)
- Changing existing B&H calculation algorithm

## Success Metrics

### B&H Comparison Columns
- Users can immediately identify which stocks benefited from DCA
- All columns are sortable and functional
- No performance degradation in table rendering
- Zero bugs related to missing or incorrect B&H data

### UI/UX Improvements
- Vertical space reduced by at least 30%
- Stock symbols in Multi-Stock Price Comparison displayed inline
- Current Holdings and Stock Performance Breakdown merged successfully
- Daily Trading Activity defaults to chronological order (oldest first)
- Expand/collapse functionality works smoothly

## References

- **Existing Spec 35**: Portfolio Buy & Hold Comparison (portfolio-level)
- **Backend Service**: `backend/services/portfolioBuyAndHoldService.js`
- **Frontend Component**: `frontend/src/components/StockPerformanceTable.js`
