#!/bin/bash

echo "========================================"
echo "Test: Batch Mode with Momentum Parameters"
echo "========================================"
echo ""

# Test 1: Both momentum modes enabled
echo "Test 1: Batch with momentumBasedBuy=true, momentumBasedSell=true"
echo ""

curl -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "parameterRanges": {
      "symbols": ["AAPL"],
      "startDate": "2024-01-01",
      "endDate": "2024-03-31",
      "lotSizeUsd": 10000,
      "maxLots": 10,
      "profitRequirement": [0.05],
      "gridIntervalPercent": [0.10],
      "trailingBuyActivationPercent": [0.10],
      "trailingBuyReboundPercent": [0.05],
      "trailingSellActivationPercent": [0.20],
      "trailingSellPullbackPercent": [0.10],
      "maxLotsToSell": [1],
      "dynamicGridMultiplier": [1.0],
      "enableBetaScaling": false,
      "enableDynamicGrid": true,
      "normalizeToReference": true,
      "enableConsecutiveIncrementalBuyGrid": false,
      "enableConsecutiveIncrementalSellProfit": true,
      "momentumBasedBuy": true,
      "momentumBasedSell": true
    }
  }' 2>/dev/null | jq '{
    success: .success,
    totalResults: (.results | length),
    firstResult: (.results[0] | {
      symbol: .parameters.symbol,
      momentumMode: .momentumMode,
      totalPnl: .totalPNL,
      buyBlockedByPnL: .buyBlockedByPnL,
      totalTrades: .summary.totalTrades
    })
  }'

echo ""
echo "========================================"
echo "If momentumMode shows buyEnabled=true and sellEnabled=true, the fix works!"
echo "========================================"
