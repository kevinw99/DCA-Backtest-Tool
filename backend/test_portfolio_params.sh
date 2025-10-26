#!/bin/bash

echo "=== Testing Standalone with EXACT Portfolio Parameters ==="
echo ""
echo "Parameters:"
echo "- lotSizeUsd: 20000"
echo "- maxLots: 5"
echo "- gridIntervalPercent: 0.10615 (beta-scaled)"
echo "- momentumBasedBuy: true"
echo "- momentumBasedSell: true"
echo ""

curl -s -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{"symbol":"NVDA","startDate":"2021-11-01","endDate":"2025-10-19","lotSizeUsd":20000,"maxLots":5,"gridIntervalPercent":0.10615,"profitRequirement":0.10615,"trailingBuyActivationPercent":0.10615,"trailingBuyReboundPercent":0.053075,"trailingSellActivationPercent":0.2123,"trailingSellPullbackPercent":0.10615,"gridConsecutiveIncrement":0.053075,"enableConsecutiveIncrementalBuyGrid":true,"enableConsecutiveIncrementalSellProfit":false,"momentumBasedBuy":true,"momentumBasedSell":true,"strategyMode":"long"}' \
  | jq '{success, symbol: .data.summary.symbol, momentumMode: .data.momentumMode, totalBuys: (.data.enhancedTransactions | map(select(.type | contains("BUY"))) | length), totalSells: (.data.enhancedTransactions | map(select(.type | contains("SELL"))) | length), firstBuy: .data.enhancedTransactions[0].date, finalValue: .data.summary.finalValue, totalReturn: .data.summary.totalReturn, buyBlockedByPnL: .data.buyBlockedByPnL}'

echo ""
echo "=== Expected (from Portfolio) ==="
echo "- Only 1 BUY on December 7, 2021"
echo "- Total Return: +466%"
echo ""
