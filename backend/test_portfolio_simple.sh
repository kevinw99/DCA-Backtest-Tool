#!/bin/bash

echo "Testing Portfolio API with NVDA only..."

curl -s -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d @- <<'EOF' | jq '{success, stockResults: [.data.stockResults[] | {symbol, buyCount: (.transactions | map(select(.type == "BUY")) | length), sellCount: (.transactions | map(select(.type == "SELL")) | length), firstBuy: (.transactions | map(select(.type == "BUY"))[0].date // "none"), allBuyDates: [.transactions | map(select(.type == "BUY"))[].date], finalValue, totalReturn}]}'
{
  "totalCapital": 500000,
  "startDate": "2021-11-01",
  "endDate": "2025-10-19",
  "lotSizeUsd": 20000,
  "maxLotsPerStock": 5,
  "stocks": [
    {"symbol": "NVDA"}
  ],
  "defaultParams": {
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10,
    "gridConsecutiveIncrement": 0.05,
    "enableConsecutiveIncrementalBuyGrid": true,
    "enableConsecutiveIncrementalSellProfit": false,
    "momentumBasedBuy": true,
    "momentumBasedSell": true
  },
  "enableBetaScaling": true,
  "betaScalingCoefficient": 0.5
}
EOF
