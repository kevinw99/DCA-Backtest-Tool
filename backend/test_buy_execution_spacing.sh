#!/bin/bash

# Get full transaction log showing BUY execution with spacing details

echo "Getting full transaction log around BUY executions..."
echo "======================================================"

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
  }' 2>/dev/null | jq -r '.data.transactionLog[]' | grep -B 3 "ACTION: TRAILING STOP BUY EXECUTED" | head -40
