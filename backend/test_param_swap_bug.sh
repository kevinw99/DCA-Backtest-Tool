#!/bin/bash

# Test script to detect parameter swap bug in portfolio vs standalone backtests
# Evidence: Portfolio shows buyGridSize: 0.2123 (trailingSellActivationPercent)
# Evidence: Standalone shows buyGridSize: 0.10615 (gridIntervalPercent)

echo "=========================================="
echo "Testing Parameter Swap Bug"
echo "=========================================="
echo ""
echo "Test Parameters:"
echo "- gridIntervalPercent: 0.10"
echo "- trailingSellActivationPercent: 0.20"
echo "- profitRequirement: 0.05"
echo "- enableBetaScaling: true"
echo "- coefficient: 1.0"
echo ""

echo "Test 1: Portfolio Backtest (NVDA)"
echo "=========================================="
curl -s -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "totalCapital": 100000,
    "startDate": "2024-01-01",
    "endDate": "2024-03-31",
    "lotSizeUsd": 10000,
    "maxLotsPerStock": 10,
    "stocks": [{"symbol": "NVDA"}],
    "defaultParams": {
      "gridIntervalPercent": 0.10,
      "profitRequirement": 0.05,
      "trailingBuyActivationPercent": 0.10,
      "trailingBuyReboundPercent": 0.05,
      "trailingSellActivationPercent": 0.20,
      "trailingSellPullbackPercent": 0.10,
      "enableConsecutiveIncrementalBuyGrid": true,
      "gridConsecutiveIncrement": 0.05
    },
    "enableBetaScaling": true,
    "coefficient": 1.0
  }' > /tmp/portfolio_result.json

echo ""
echo "Portfolio Result - First BUY transaction buyGridSize:"
cat /tmp/portfolio_result.json | jq -r '.data.stockResults[0].transactions[] | select(.type == "BUY") | {date, buyGridSize} | @json' | head -1

echo ""
echo ""
echo "Test 2: Standalone Backtest (NVDA)"
echo "=========================================="
curl -s -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NVDA",
    "startDate": "2024-01-01",
    "endDate": "2024-03-31",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.05,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10,
    "enableConsecutiveIncrementalBuyGrid": true,
    "gridConsecutiveIncrement": 0.05,
    "enableBetaScaling": true,
    "coefficient": 1.0
  }' > /tmp/standalone_result.json

echo ""
echo "Standalone Result - First BUY transaction buyGridSize:"
cat /tmp/standalone_result.json | jq -r '.data.enhancedTransactions[] | select(.type == "BUY") | {date, buyGridSize} | @json' | head -1

echo ""
echo ""
echo "=== Expected Results ==="
echo "Portfolio buyGridSize should be: 0.10 (or scaled version if beta applied)"
echo "Standalone buyGridSize should be: 0.10 (or scaled version if beta applied)"
echo "They should MATCH!"
echo ""
echo "If portfolio shows 0.20 instead, that proves gridIntervalPercent is being swapped with trailingSellActivationPercent"
echo ""
