# Rejected Orders Test - Verification File

## Test Date
2025-10-23

## Purpose
Verify that the portfolio backtest correctly tracks rejected orders due to insufficient capital.

## Frontend URL (Generates the Test)

```
http://localhost:3000/portfolio-backtest?stocks=TSLA%2CAMZN%2CMETA%2CGOOG%2CMSFT%2CNVDA%2CAAPL&totalCapital=500000&lotSize=30000&maxLots=10&startDate=2021-09-01&endDate=2025-10-19&gridInterval=10&profitReq=10&stopLoss=30&trailingBuy=false&trailingSell=false&trailingBuyActivation=10&trailingBuyRebound=5&trailingSellActivation=20&trailingSellPullback=10&consecutiveBuyGrid=false&gridConsecutiveIncrement=5&consecutiveSellProfit=false&enableDynamicGrid=false&normalizeToReference=false&enableCashYield=false&cashYieldAnnualPercent=4.5&cashYieldMinCash=50000&enableDeferredSelling=true&deferredSellingThreshold=50000&enableAdaptiveLotSizing=false&adaptiveLotCashThreshold=100000&adaptiveLotMaxMultiplier=2&adaptiveLotIncreaseStep=20&enableBetaScaling=true&coefficient=0.5&beta=1
```

## Backend API Test Command

```bash
curl -X POST http://localhost:3001/api/portfolio-backtest \
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

## Quick Verification (Rejected Orders Only)

```bash
curl -X POST http://localhost:3001/api/portfolio-backtest \
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
}' | jq '.data.rejectedOrders'
```

## Test Configuration Summary

- **Stocks**: TSLA, AMZN, META, GOOG, MSFT, NVDA, AAPL (7 stocks)
- **Total Capital**: $500,000
- **Lot Size**: $30,000
- **Max Lots Per Stock**: 10
- **Date Range**: 2021-09-01 to 2025-10-19
- **Strategy**: Grid-based DCA with stop loss (30%)
  - Grid Interval: 10% (15% for AAPL)
  - Profit Requirement: 10% (15% for AAPL)
  - Trailing Buy/Sell: Disabled
  - Capital Optimization: Disabled

## Expected Behavior

When running this test, you should verify:

1. **Rejected Orders are Tracked**: The response should include a `rejectedOrders` array
2. **Rejections Occur When Capital is Constrained**:
   - Maximum deployed capital at any time: 16 lots × $30,000 = $480,000 (leaving $20,000 cash)
   - Rejections happen when cash reserve < $30,000 (lot size)
3. **Each Rejection Includes**:
   - Date, symbol, price
   - Lot size ($30,000)
   - Available capital vs required capital
   - Shortfall amount
   - Competing stocks holding capital
   - Portfolio utilization percentage

## Verification Steps

### Step 1: Start Backend Server
```bash
cd C:\Users\kevin\ai\DCA-Backtest-Tool\backend
npm start
```
Server should be running on http://localhost:3001

### Step 2: Start Frontend Server (Optional)
```bash
cd C:\Users\kevin\ai\DCA-Backtest-Tool\frontend
npm start
```
Frontend will be available on http://localhost:3000

### Step 3: Run Test via Frontend URL
Open the frontend URL in a browser to trigger the backtest with the exact parameters.

### Step 4: Run Test via curl Command
Copy the full curl command above and execute it in your terminal.

### Step 5: Verify Results
Check the response for:
- `.success` should be `true`
- `.data.rejectedOrders` should be an array (may have 0+ entries depending on market conditions)
- Each rejection should have:
  ```json
  {
    "date": "YYYY-MM-DD",
    "symbol": "STOCK_SYMBOL",
    "orderType": "BUY",
    "price": number,
    "lotSize": 30000,
    "attemptedValue": 30000,
    "reason": "INSUFFICIENT_CAPITAL",
    "availableCapital": number,
    "requiredCapital": 30000,
    "shortfall": number,
    "competingStocks": [...],
    "portfolioState": {
      "deployedCapital": number,
      "cashReserve": number,
      "utilizationPercent": number
    }
  }
  ```

## Investigation Summary

**Date**: 2025-10-23
**Finding**: System is working correctly. Rejected orders ARE tracked when capital constraints are triggered.
**Root Cause**: None - no bug found. The system correctly:
  1. Logs rejections to both portfolio and per-stock arrays
  2. Tracks shortfall amounts and competing stocks
  3. Returns rejections in API response
  4. Shows "No Rejected Orders" when capital is never constrained (correct behavior)

## Notes

- The exact number of rejected orders may vary depending on market data and trading patterns
- With 7 stocks and $500k capital, maximum 16 lots can be deployed simultaneously
- Rejections occur when a buy signal triggers but cash reserve < $30,000
- This is expected and correct behavior for portfolio capital management
