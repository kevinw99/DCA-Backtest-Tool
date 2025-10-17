#!/bin/bash

# Test consecutive incremental buy grid spacing with detailed logs
# Parameters from portfolio test (Test #2)

echo "Testing Consecutive Incremental Buy Grid..."
echo "============================================"

curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NVDA",
    "startDate": "2021-09-01",
    "endDate": "2025-10-12",
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
  }' 2>/dev/null | jq -r '.data.transactionLog[]' | head -80

echo ""
echo "============================================"
echo "Extracting BUY transactions only:"
echo "--------------------------------------------"

curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NVDA",
    "startDate": "2021-09-01",
    "endDate": "2025-10-12",
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
  }' 2>/dev/null | jq -r '.data.transactionLog[]' | grep -E "ACTION: BUY|---"
