#!/bin/bash

# Test with detailed logs showing execution validation

echo "Testing Execution-Time Validation..."
echo "====================================="

curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NVDA",
    "startDate": "2022-01-01",
    "endDate": "2022-12-31",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10,
    "enableTrailingBuy": false,
    "enableTrailingSell": false,
    "enableConsecutiveIncrementalBuyGrid": true,
    "gridConsecutiveIncrement": 0.05,
    "enableConsecutiveIncrementalSellProfit": false
  }' 2>/dev/null | jq -r '.data.transactionLog[]' | grep -E "EXECUTION VALIDATION|EXECUTION BLOCKED|ACTION: (BUY|TRAILING STOP BUY)"
