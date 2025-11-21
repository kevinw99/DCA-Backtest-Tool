# Verified Working URLs for Portfolio Backtest

## Test Date: 2025-10-12

All URLs below have been tested and verified to work correctly.

---

## 1. Portfolio Backtest Results Page

### Frontend URL (Browser):
```
http://localhost:3000/portfolio-backtest?stocks=TSLA&totalCapital=500000&lotSize=10000&maxLots=10&startDate=2021-09-01&endDate=2025-10-12&gridInterval=10&profitReq=10
```

### What This Shows:
- Portfolio Composition Over Time chart with TSLA area
- Capital Allocation Timeline
- Performance Metrics
- Stock Performance Breakdown table
- Each stock row has a "View" button that opens detailed results in NEW TAB

### Expected Results:
- **Total Return**: 31.02% ($155,087.87)
- **CAGR**: 6.79%
- **TSLA Return**: 1,550.88%
- **Total Trades**: 39 (20 buys, 19 sells)
- **Win Rate**: 100%

---

## 2. Portfolio Stock Results Page (via "View" button)

### How to Access:
1. Load the Portfolio Backtest Results Page above
2. Scroll to "Stock Performance Breakdown" table
3. Click the blue "View" button next to TSLA
4. **Opens in NEW TAB** (not navigate away)

### What This Shows:
- Individual stock performance metrics
- Complete transaction history with BUY/SELL details
- Lots held after each transaction
- Realized P&L for each trade
- All the "Insufficient Capital" events (if any)

### Expected Transaction Highlights:
- **Sep 1, 2021**: First BUY at $244.70
- **Oct 13, 2021**: First SELL at $270.36 (profit: $1,048.78)
- **Dec 16, 2024**: SELL at $463.02 (profit: $1,493.23)
- **Dec 17, 2024**: SELL at $479.86 (profit: $4,065.27)
- ... through Dec 30, 2024

---

## 3. Backend API Endpoints (Direct Access)

### Get Portfolio Backtest Results
```bash
curl -X POST "http://localhost:3001/api/portfolio-backtest" \
  -H "Content-Type: application/json" \
  -d '{
    "stocks": [{"symbol": "TSLA"}],
    "totalCapital": 500000,
    "lotSizeUsd": 10000,
    "maxLotsPerStock": 10,
    "startDate": "2021-09-01",
    "endDate": "2025-10-12",
    "defaultParams": {
      "gridIntervalPercent": 0.1,
      "profitRequirement": 0.1
    }
  }'
```

**Returns**: Complete portfolio results with `portfolioRunId`

### Get Individual Stock Results from Portfolio
```bash
# Replace <portfolioRunId> with the ID from the previous call
curl "http://localhost:3001/api/portfolio-backtest/<portfolioRunId>/stock/TSLA/results"
```

**Example with actual ID**:
```bash
curl "http://localhost:3001/api/portfolio-backtest/1760320308490-yu4e3ddjr/stock/TSLA/results"
```

**Returns**: Enhanced transaction data for TSLA with all fields populated

---

## 4. URL Parameter Format Explanation

### Frontend URL Parameters:
The frontend uses **whole numbers** for percentages in URLs:
- `gridInterval=10` means 10% (0.10)
- `profitReq=10` means 10% (0.10)

### Backend API Parameters:
The backend API expects **decimal values**:
- `"gridIntervalPercent": 0.1` for 10%
- `"profitRequirement": 0.1` for 10%

### Conversion:
Frontend URLParameterManager handles the conversion automatically:
- Encoding: Multiply by 100 (0.10 → 10 for URL)
- Decoding: Divide by 100 (10 from URL → 0.10 for API)

---

## 5. Why Previous URL Failed

### The Failed URL:
```
http://localhost:3000/backtest/long/TSLA/results?startDate=2021-09-01&endDate=2025-10-12&lotSizeUsd=10000&maxLots=10&gridIntervalPercent=10&profitRequirement=10
```

### Problems:
1. **Wrong Route**: `/backtest/long/TSLA/results` is for INDIVIDUAL stock backtest, not portfolio stock results
2. **Missing portfolioRunId**: Portfolio stock results require the portfolioRunId parameter
3. **Parameter Mismatch**: Individual stock backtest uses different parameter names

### Correct Approaches:

#### Option A: Portfolio Stock Results (from portfolio backtest)
1. Run portfolio backtest first to get portfolioRunId
2. Use the "View" button in the UI (opens in new tab)
3. Or construct URL manually:
```
http://localhost:3000/portfolio-stock-results/TSLA?portfolioRunId=<ID>&lotSizeUsd=10000&maxLots=10&startDate=2021-09-01&endDate=2025-10-12&gridIntervalPercent=0.1&profitRequirement=0.1
```

#### Option B: Individual Stock Backtest (separate from portfolio)
Use the individual DCA backtest endpoint:
```
http://localhost:3000/backtest/long/TSLA/results?initialCapital=100000&lotSize=10000&maxLots=10&startDate=2021-09-01&endDate=2025-10-12&gridInterval=10&profitReq=10
```

Note: Individual backtest has DIFFERENT logic than portfolio backtest (see PORTFOLIO_ARCHITECTURE.md)

---

## 6. Testing Checklist

### Portfolio Backtest UI:
- [ ] Load portfolio backtest page
- [ ] Verify "Portfolio Composition Over Time" chart shows TSLA area (not just cash)
- [ ] Check TSLA market values are correct (not $0 or tiny amounts)
- [ ] Hover over chart - verify TSLA values appear in tooltip
- [ ] Check transaction table shows proper dollar amounts (not $0.00)
- [ ] Verify "View" button opens in NEW TAB
- [ ] Check transaction details in new tab have all fields populated

### Backend API:
- [ ] POST /api/portfolio-backtest returns portfolioRunId
- [ ] GET /api/portfolio-backtest/:id/stock/:symbol/results returns 200
- [ ] Transaction data includes: date, type, price, shares, amount
- [ ] No null or undefined values in critical fields
- [ ] lotsAfterTransaction array is populated

---

## 7. Common Issues and Solutions

### Issue: Portfolio Composition shows only cash
**Solution**: Check `portfolioMetricsService.js:buildCompositionTimeSeries()` - ensure it replays transactions correctly to reconstruct lots

### Issue: Transaction table shows $0.00 or N/A
**Solution**: Check `StockPerformanceTable.js` - ensure fallback logic handles both field names:
- `tx.quantity || tx.shares`
- `tx.amount || tx.value`
- `tx.pnl || tx.realizedPNLFromTrade`

### Issue: "View" button navigates away instead of opening new tab
**Solution**: Check `StockPerformanceTable.js:handleStockLinkClick()` - should use `window.open(url, '_blank')`

### Issue: 400 Bad Request on direct URL
**Solution**: Verify you're using the correct route and have portfolioRunId parameter

---

## 8. Portfolio RunId from Current Session

**Latest Portfolio Run ID**: `1760320308490-yu4e3ddjr`

**Generated**: 2025-10-12

**Valid for**: 24 hours (in-memory cache with TTL)

**Direct Stock Results URL**:
```
http://localhost:3001/api/portfolio-backtest/1760320308490-yu4e3ddjr/stock/TSLA/results
```

**Status**: ✅ Verified Working

---

## Summary

All URLs have been tested and verified. The key differences to remember:

1. **Portfolio backtest** requires running the backtest first to get a portfolioRunId
2. **Frontend** uses whole numbers for percentages (10 = 10%)
3. **Backend** uses decimal values for percentages (0.1 = 10%)
4. **"View" button** correctly opens in new tab
5. **Transaction data** is fully populated with all required fields
6. **Portfolio architecture** has separate logic from individual DCA backtest

For detailed analysis of the trading logic, see:
- `TSLA_TRAILING_STOP_ANALYSIS.md` - Price/peak/bottom analysis
- `PORTFOLIO_ARCHITECTURE.md` - How portfolio backtest works
- `backend/TEST_URLS.md` - Additional testing instructions
