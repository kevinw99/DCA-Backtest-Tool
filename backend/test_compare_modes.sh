#!/bin/bash

echo "=== TESTING: Portfolio vs Standalone Comparison ==="
echo "Testing with NVDA, identical parameters WITH beta scaling enabled"
echo ""

# Test parameters (identical for both modes)
PARAMS='{
  "symbol": "NVDA",
  "startDate": "2021-11-01",
  "endDate": "2025-10-17",
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
}'

echo "1. Running STANDALONE mode..."
STANDALONE_RESULT=$(curl -s -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d "$PARAMS")

STANDALONE_BUYS=$(echo "$STANDALONE_RESULT" | jq -r '.data.enhancedTransactions | map(select(.type == "TRAILING_STOP_LIMIT_BUY")) | length')
STANDALONE_SELLS=$(echo "$STANDALONE_RESULT" | jq -r '.data.enhancedTransactions | map(select(.type == "SELL")) | length')
STANDALONE_BLOCKED=$(echo "$STANDALONE_RESULT" | jq -r '.data.buyBlockedByPnL')

echo "   Buys: $STANDALONE_BUYS"
echo "   Sells: $STANDALONE_SELLS"
echo "   BuyBlockedByPnL: $STANDALONE_BLOCKED"
echo ""

echo "2. Running PORTFOLIO mode (single stock, WITH beta scaling)..."
PORTFOLIO_RESULT=$(curl -s -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d "{
  \"totalCapital\": 100000,
  \"stocks\": [\"NVDA\"],
  \"startDate\": \"2021-11-01\",
  \"endDate\": \"2025-10-17\",
  \"lotSizeUsd\": 20000,
  \"maxLotsPerStock\": 5,
  \"gridIntervalPercent\": 0.10,
  \"profitRequirement\": 0.10,
  \"trailingBuyActivationPercent\": 0.10,
  \"trailingBuyReboundPercent\": 0.05,
  \"trailingSellActivationPercent\": 0.20,
  \"trailingSellPullbackPercent\": 0.10,
  \"gridConsecutiveIncrement\": 0.05,
  \"enableConsecutiveIncrementalBuyGrid\": true,
  \"enableConsecutiveIncrementalSellProfit\": false,
  \"momentumBasedBuy\": true,
  \"momentumBasedSell\": true,
  \"enableBetaScaling\": true,
  \"betaScalingCoefficient\": 0.5,
  \"enableCapitalOptimization\": false
}")

PORTFOLIO_BUYS=$(echo "$PORTFOLIO_RESULT" | jq -r '.data.stockResults[0].enhancedTransactions | map(select(.type == "TRAILING_STOP_LIMIT_BUY")) | length')
PORTFOLIO_SELLS=$(echo "$PORTFOLIO_RESULT" | jq -r '.data.stockResults[0].enhancedTransactions | map(select(.type == "SELL")) | length')
PORTFOLIO_BLOCKED=$(echo "$PORTFOLIO_RESULT" | jq -r '.data.stockResults[0].buyBlockedByPnL')

echo "   Buys: $PORTFOLIO_BUYS"
echo "   Sells: $PORTFOLIO_SELLS"
echo "   BuyBlockedByPnL: $PORTFOLIO_BLOCKED"
echo ""

echo "=== COMPARISON RESULTS ==="
if [[ "$STANDALONE_BUYS" == "$PORTFOLIO_BUYS" ]] && \
   [[ "$STANDALONE_SELLS" == "$PORTFOLIO_SELLS" ]] && \
   [[ "$STANDALONE_BLOCKED" == "$PORTFOLIO_BLOCKED" ]]; then
  echo "✓ PASS: Both modes produced IDENTICAL results!"
else
  echo "✗ FAIL: Results DO NOT match!"
  echo "   Standalone: $STANDALONE_BUYS buys, $STANDALONE_SELLS sells, $STANDALONE_BLOCKED blocked"
  echo "   Portfolio:  $PORTFOLIO_BUYS buys, $PORTFOLIO_SELLS sells, $PORTFOLIO_BLOCKED blocked"
fi
