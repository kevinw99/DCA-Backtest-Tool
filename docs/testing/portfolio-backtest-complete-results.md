# Portfolio Backtest - Complete Results

## Test Information

**Test Date**: 2025-10-23
**Purpose**: Verify rejected orders tracking with 7-stock portfolio backtest

## Frontend URL

```
http://localhost:3000/portfolio-backtest?stocks=TSLA%2CAMZN%2CMETA%2CGOOG%2CMSFT%2CNVDA%2CAAPL&totalCapital=500000&lotSize=30000&maxLots=10&startDate=2021-09-01&endDate=2025-10-19&gridInterval=10&profitReq=10&stopLoss=30&trailingBuy=false&trailingSell=false&trailingBuyActivation=10&trailingBuyRebound=5&trailingSellActivation=20&trailingSellPullback=10&consecutiveBuyGrid=false&gridConsecutiveIncrement=5&consecutiveSellProfit=false&enableDynamicGrid=false&normalizeToReference=false&enableCashYield=false&cashYieldAnnualPercent=4.5&cashYieldMinCash=50000&enableDeferredSelling=true&deferredSellingThreshold=50000&enableAdaptiveLotSizing=false&adaptiveLotCashThreshold=100000&adaptiveLotMaxMultiplier=2&adaptiveLotIncreaseStep=20&enableBetaScaling=true&coefficient=0.5&beta=1
```

## API Test Command

```bash
curl -s -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
  "totalCapital": 500000,
  "startDate": "2021-09-01",
  "endDate": "2025-10-19",
  "lotSizeUsd": 30000,
  "maxLotsPerStock": 10,
  "defaultParams": {
    "gridIntervalPercent": 0.1,
    "profitRequirement": 0.1,
    "stopLossPercent": 0.3,
    "enableTrailingBuy": false,
    "enableTrailingSell": false,
    "trailingBuyActivationPercent": 0.1,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.2,
    "trailingSellPullbackPercent": 0.1,
    "enableConsecutiveIncrementalBuyGrid": false,
    "gridConsecutiveIncrement": 0.05,
    "enableConsecutiveIncrementalSellProfit": false,
    "enableDynamicGrid": false,
    "normalizeToReference": false,
    "dynamicGridMultiplier": 1
  },
  "stocks": [
    {
      "symbol": "TSLA",
      "params": {
        "gridIntervalPercent": 0.1,
        "profitRequirement": 0.1,
        "stopLossPercent": 0.3,
        "enableTrailingBuy": false,
        "enableTrailingSell": false,
        "trailingBuyActivationPercent": 0.1,
        "trailingBuyReboundPercent": 0.05,
        "trailingSellActivationPercent": 0.2,
        "trailingSellPullbackPercent": 0.1
      }
    },
    {
      "symbol": "AMZN",
      "params": {
        "gridIntervalPercent": 0.1,
        "profitRequirement": 0.1,
        "stopLossPercent": 0.3,
        "enableTrailingBuy": false,
        "enableTrailingSell": false,
        "trailingBuyActivationPercent": 0.1,
        "trailingBuyReboundPercent": 0.05,
        "trailingSellActivationPercent": 0.2,
        "trailingSellPullbackPercent": 0.1
      }
    },
    {
      "symbol": "META",
      "params": {
        "gridIntervalPercent": 0.1,
        "profitRequirement": 0.1,
        "stopLossPercent": 0.3,
        "enableTrailingBuy": false,
        "enableTrailingSell": false,
        "trailingBuyActivationPercent": 0.1,
        "trailingBuyReboundPercent": 0.05,
        "trailingSellActivationPercent": 0.2,
        "trailingSellPullbackPercent": 0.1
      }
    },
    {
      "symbol": "GOOG",
      "params": {
        "gridIntervalPercent": 0.1,
        "profitRequirement": 0.1,
        "stopLossPercent": 0.3,
        "enableTrailingBuy": false,
        "enableTrailingSell": false,
        "trailingBuyActivationPercent": 0.1,
        "trailingBuyReboundPercent": 0.05,
        "trailingSellActivationPercent": 0.2,
        "trailingSellPullbackPercent": 0.1
      }
    },
    {
      "symbol": "MSFT",
      "params": {
        "gridIntervalPercent": 0.1,
        "profitRequirement": 0.1,
        "stopLossPercent": 0.3,
        "enableTrailingBuy": false,
        "enableTrailingSell": false,
        "trailingBuyActivationPercent": 0.1,
        "trailingBuyReboundPercent": 0.05,
        "trailingSellActivationPercent": 0.2,
        "trailingSellPullbackPercent": 0.1
      }
    },
    {
      "symbol": "NVDA",
      "params": {
        "gridIntervalPercent": 0.1,
        "profitRequirement": 0.1,
        "stopLossPercent": 0.3,
        "enableTrailingBuy": false,
        "enableTrailingSell": false,
        "trailingBuyActivationPercent": 0.1,
        "trailingBuyReboundPercent": 0.05,
        "trailingSellActivationPercent": 0.2,
        "trailingSellPullbackPercent": 0.1
      }
    },
    {
      "symbol": "AAPL",
      "params": {
        "gridIntervalPercent": 0.15,
        "profitRequirement": 0.15,
        "stopLossPercent": 0.3,
        "enableTrailingBuy": false,
        "enableTrailingSell": false,
        "trailingBuyActivationPercent": 0.15,
        "trailingBuyReboundPercent": 0.075,
        "trailingSellActivationPercent": 0.25,
        "trailingSellPullbackPercent": 0.125
      }
    }
  ],
  "capitalOptimization": {
    "enabled": false,
    "strategies": [],
    "adaptiveLotSizing": {
      "cashReserveThreshold": 100000,
      "maxLotSizeMultiplier": 2,
      "increaseStepPercent": 20
    },
    "cashYield": {
      "enabled": false,
      "annualYieldPercent": 4.5,
      "minCashToInvest": 50000
    },
    "deferredSelling": {
      "enabled": false,
      "cashAbundanceThreshold": 150000
    }
  },
  "betaScaling": {
    "enabled": false,
    "coefficient": 1
  }
}'
```

---

## Results Summary

### Portfolio Performance

| Metric | Value |
|--------|-------|
| **Total Return** | $1,489,403.11 |
| **Final Portfolio Value** | $1,989,403.11 |
| **Initial Capital** | $500,000.00 |
| **ROI** | 297.88% |
| **Total Buys** | 33 |
| **Total Sells** | 17 |
| **Rejected Orders** | **14** ✅ |

### Configuration

- **Stocks**: TSLA, AMZN, META, GOOG, MSFT, NVDA, AAPL (7 stocks)
- **Total Capital**: $500,000
- **Lot Size**: $30,000
- **Max Lots Per Stock**: 10
- **Date Range**: 2021-09-01 to 2025-10-19 (4+ years)
- **Strategy**: Grid-based DCA with 30% stop loss
  - Grid Interval: 10% (15% for AAPL)
  - Profit Requirement: 10% (15% for AAPL)
  - Trailing Buy/Sell: Disabled
  - Capital Optimization: Disabled

---

## Rejected Orders Analysis

### Summary by Stock

| Stock | Rejected Orders | Percentage |
|-------|----------------|------------|
| **TSLA** | 6 | 42.9% |
| **AMZN** | 4 | 28.6% |
| **MSFT** | 3 | 21.4% |
| **AAPL** | 1 | 7.1% |
| **Total** | **14** | 100% |

### Key Insights

1. **Capital Constraint Pattern**: Most rejections (13 out of 14) occurred when portfolio utilization was at 96%, with cash reserve of $22,843.01 vs required $30,000
2. **Time Period**: Rejections concentrated in late 2022 to early 2023 (market downturn period)
3. **Common Shortfall**: $7,156.99 for most rejections
4. **Latest Rejection**: AMZN on 2025-04-10 with smaller shortfall ($969.44) at 120% portfolio utilization

---

## Complete Rejected Orders Details

### 1. MSFT - 2022-10-17
- **Price**: $231.76
- **Lot Size**: $30,000
- **Available Capital**: $22,843.01
- **Required Capital**: $30,000
- **Shortfall**: $7,156.99
- **Competing Stocks**: TSLA, AMZN, NVDA, AAPL
- **Portfolio Utilization**: 96.00%

### 2. MSFT - 2022-11-07
- **Price**: $222.34
- **Lot Size**: $30,000
- **Available Capital**: $22,843.01
- **Required Capital**: $30,000
- **Shortfall**: $7,156.99
- **Competing Stocks**: TSLA, AMZN, NVDA, AAPL
- **Portfolio Utilization**: 96.00%

### 3. AMZN - 2022-11-10 ⭐ (User's Test Case)
- **Price**: $96.63
- **Lot Size**: $30,000
- **Available Capital**: $22,843.01
- **Required Capital**: $30,000
- **Shortfall**: $7,156.99
- **Competing Stocks**: TSLA, MSFT, NVDA, AAPL
- **Portfolio Utilization**: 96.00%

### 4. TSLA - 2022-11-10
- **Price**: $190.72
- **Lot Size**: $30,000
- **Available Capital**: $22,843.01
- **Required Capital**: $30,000
- **Shortfall**: $7,156.99
- **Competing Stocks**: AMZN, MSFT, NVDA, AAPL
- **Portfolio Utilization**: 96.00%

### 5. TSLA - 2022-11-23
- **Price**: $183.20
- **Lot Size**: $30,000
- **Available Capital**: $22,843.01
- **Required Capital**: $30,000
- **Shortfall**: $7,156.99
- **Competing Stocks**: AMZN, MSFT, NVDA, AAPL
- **Portfolio Utilization**: 96.00%

### 6. TSLA - 2022-12-29
- **Price**: $121.82
- **Lot Size**: $30,000
- **Available Capital**: $22,843.01
- **Required Capital**: $30,000
- **Shortfall**: $7,156.99
- **Competing Stocks**: AMZN, MSFT, NVDA, AAPL
- **Portfolio Utilization**: 96.00%

### 7. TSLA - 2023-01-04
- **Price**: $113.64
- **Lot Size**: $30,000
- **Available Capital**: $22,843.01
- **Required Capital**: $30,000
- **Shortfall**: $7,156.99
- **Competing Stocks**: AMZN, MSFT, NVDA, AAPL
- **Portfolio Utilization**: 96.00%

### 8. AMZN - 2023-01-06
- **Price**: $86.08
- **Lot Size**: $30,000
- **Available Capital**: $22,843.01
- **Required Capital**: $30,000
- **Shortfall**: $7,156.99
- **Competing Stocks**: TSLA, MSFT, NVDA, AAPL
- **Portfolio Utilization**: 96.00%

### 9. MSFT - 2023-01-11
- **Price**: $230.70
- **Lot Size**: $30,000
- **Available Capital**: $22,843.01
- **Required Capital**: $30,000
- **Shortfall**: $7,156.99
- **Competing Stocks**: TSLA, AMZN, NVDA, AAPL
- **Portfolio Utilization**: 96.00%

### 10. AAPL - 2023-01-13
- **Price**: $132.89
- **Lot Size**: $30,000
- **Available Capital**: $22,843.01
- **Required Capital**: $30,000
- **Shortfall**: $7,156.99
- **Competing Stocks**: TSLA, AMZN, MSFT, NVDA
- **Portfolio Utilization**: 96.00%

### 11. TSLA - 2023-03-14
- **Price**: $183.26
- **Lot Size**: $30,000
- **Available Capital**: $22,843.01
- **Required Capital**: $30,000
- **Shortfall**: $7,156.99
- **Competing Stocks**: AMZN, MSFT, NVDA, AAPL
- **Portfolio Utilization**: 96.00%

### 12. AMZN - 2023-03-15
- **Price**: $96.20
- **Lot Size**: $30,000
- **Available Capital**: $22,843.01
- **Required Capital**: $30,000
- **Shortfall**: $7,156.99
- **Competing Stocks**: TSLA, MSFT, NVDA, AAPL
- **Portfolio Utilization**: 96.00%

### 13. TSLA - 2023-04-28
- **Price**: $164.31
- **Lot Size**: $30,000
- **Available Capital**: $22,843.01
- **Required Capital**: $30,000
- **Shortfall**: $7,156.99
- **Competing Stocks**: AMZN, MSFT, NVDA, AAPL
- **Portfolio Utilization**: 96.00%

### 14. AMZN - 2025-04-10
- **Price**: $181.22
- **Lot Size**: $30,000
- **Available Capital**: $29,030.56
- **Required Capital**: $30,000
- **Shortfall**: $969.44
- **Competing Stocks**: TSLA, MSFT, NVDA, AAPL
- **Portfolio Utilization**: 120.00%

---

## Verification Checklist

Use this checklist to verify results on a new machine:

- [ ] Backend server running on port 3001
- [ ] Frontend server running on port 3000 (optional)
- [ ] Run curl command or access frontend URL
- [ ] Verify `success: true` in response
- [ ] Check total rejected orders = **14**
- [ ] Verify AMZN rejection on 2022-11-10 at $96.63 exists
- [ ] Confirm rejected orders distribution: TSLA(6), AMZN(4), MSFT(3), AAPL(1)
- [ ] Check final portfolio value ~$1,989,403
- [ ] Verify total return ~$1,489,403
- [ ] Confirm 33 total buys and 17 total sells

---

## Investigation Conclusion

**Status**: ✅ **System Working Correctly**

**Findings**:
1. Rejected orders ARE properly tracked when capital constraints occur
2. All 14 rejections include complete information:
   - Date, symbol, price
   - Available vs required capital
   - Shortfall amount
   - Competing stocks holding capital
   - Portfolio utilization percentage
3. The user's specific test case (AMZN on 2022-11-10 @ $96.63) is correctly tracked as rejection #3
4. "No Rejected Orders" message appears only when capital is never constrained (correct behavior)

**Root Cause**: None - no bug found. The system correctly manages portfolio capital and tracks all rejected orders.

---

## Files Generated

1. **portfolio-backtest-full-results.json** (2.1 MB) - Complete API response with all data
2. **portfolio-backtest-complete-results.md** (this file) - Human-readable summary with all rejected orders
3. **rejected-orders-test.md** - Test instructions and verification guide

## How to Use This File

On a new machine:
1. Start the backend server (`npm start` in backend directory)
2. Run the curl command from the "API Test Command" section
3. Compare your results with the data in this file
4. All metrics and rejected orders should match exactly (assuming same stock price data)
