#!/bin/bash

echo "Testing Standalone API with NVDA (matching portfolio params)..."

curl -s -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d @- <<'EOF' | jq '{success, symbol: .data.summary.symbol, buyCount: (.data.enhancedTransactions | map(select(.type | contains("BUY"))) | length), sellCount: (.data.enhancedTransactions | map(select(.type | contains("SELL"))) | length), finalValue: .data.summary.finalPortfolioValue, totalReturn: .data.summary.totalReturn, momentumMode: .data.momentumMode}'
{
  "symbol": "NVDA",
  "startDate": "2021-11-01",
  "endDate": "2025-10-19",
  "lotSizeUsd": 20000,
  "maxLots": 5,
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
  "momentumBasedSell": true,
  "enableBetaScaling": true,
  "betaScalingCoefficient": 0.5
}
EOF
