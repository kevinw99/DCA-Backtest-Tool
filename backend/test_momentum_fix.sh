#!/bin/bash

echo "=== Testing Portfolio Momentum Parameters Fix ==="
echo ""
echo "Waiting for server to be ready..."
sleep 4

echo "Test 1: Momentum ENABLED (momentumBasedBuy=true)"
echo "================================================="
curl -s -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{"totalCapital":100000,"startDate":"2024-01-01","endDate":"2024-03-31","lotSizeUsd":10000,"maxLotsPerStock":10,"stocks":[{"symbol":"NVDA"}],"defaultParams":{"gridIntervalPercent":0.10,"profitRequirement":0.10,"trailingBuyActivationPercent":0.10,"trailingBuyReboundPercent":0.05,"trailingSellActivationPercent":0.20,"trailingSellPullbackPercent":0.10,"momentumBasedBuy":true,"momentumBasedSell":false}}' \
  | jq '{success, stockResults: [.data.stockResults[] | {symbol, momentumMode, totalBuys: (.transactions | map(select(.type == "BUY")) | length), finalValue}]}'

echo ""
echo "Test 2: Momentum DISABLED (momentumBasedBuy=false)"
echo "==================================================="
curl -s -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{"totalCapital":100000,"startDate":"2024-01-01","endDate":"2024-03-31","lotSizeUsd":10000,"maxLotsPerStock":10,"stocks":[{"symbol":"NVDA"}],"defaultParams":{"gridIntervalPercent":0.10,"profitRequirement":0.10,"trailingBuyActivationPercent":0.10,"trailingBuyReboundPercent":0.05,"trailingSellActivationPercent":0.20,"trailingSellPullbackPercent":0.10,"momentumBasedBuy":false,"momentumBasedSell":false}}' \
  | jq '{success, stockResults: [.data.stockResults[] | {symbol, momentumMode, totalBuys: (.transactions | map(select(.type == "BUY")) | length), finalValue}]}'

echo ""
echo "=== Expected Results ==="
echo "Test 1 should show: momentumMode=true, different buy count"
echo "Test 2 should show: momentumMode=false (or null), different buy count"
echo "Results should be DIFFERENT if fix works!"
