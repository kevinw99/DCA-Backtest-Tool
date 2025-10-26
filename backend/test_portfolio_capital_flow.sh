#!/bin/bash

echo "=========================================================================="
echo "Bug #3 Investigation: Portfolio Capital Allocation Analysis"
echo "=========================================================================="
echo ""
echo "Testing: Why portfolio executed 1 BUY vs standalone executing 5 BUYs"
echo ""
echo "Portfolio Config:"
echo "  - Total Capital: $500,000"
echo "  - Stocks: TSLA, AMZN, META, GOOG, MSFT, NVDA, AAPL (7 stocks)"
echo "  - Lot Size: $20,000 per stock"
echo "  - Max Lots: 5 per stock"
echo "  - Beta Scaling: Enabled (coefficient 0.5)"
echo "  - Momentum: Buy=true, Sell=true"
echo ""
echo "--------------------------------------------------------------------------"
echo "Step 1: Portfolio Backtest (EXACT user parameters)"
echo "--------------------------------------------------------------------------"

PORTFOLIO_RESULT=$(curl -s -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "totalCapital": 500000,
    "startDate": "2021-11-01",
    "endDate": "2025-10-19",
    "stocks": [
      {"symbol": "TSLA"},
      {"symbol": "AMZN"},
      {"symbol": "META"},
      {"symbol": "GOOG"},
      {"symbol": "MSFT"},
      {"symbol": "NVDA"},
      {"symbol": "AAPL"}
    ],
    "defaultParams": {
      "lotSizeUsd": 20000,
      "maxLotsPerStock": 5,
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
  }')

echo ""
echo "Portfolio Results Summary:"
echo "=========================="
echo "$PORTFOLIO_RESULT" | jq '{
  success,
  totalCapital: .data.totalCapital,
  finalValue: .data.finalValue,
  totalReturn: .data.totalReturn,
  stockResults: [.data.stockResults[] | {
    symbol,
    buyCount: (.transactions | map(select(.type == "BUY")) | length),
    sellCount: (.transactions | map(select(.type == "SELL")) | length),
    firstBuy: (.transactions | map(select(.type == "BUY"))[0].date // "none"),
    finalValue,
    totalReturn
  }]
}'

echo ""
echo "NVDA Specific Details:"
echo "======================"
echo "$PORTFOLIO_RESULT" | jq '.data.stockResults[] | select(.symbol == "NVDA") | {
  symbol,
  momentumMode,
  buyCount: (.transactions | map(select(.type == "BUY")) | length),
  sellCount: (.transactions | map(select(.type == "SELL")) | length),
  firstBuy: (.transactions | map(select(.type == "BUY"))[0] // {}),
  allBuys: [.transactions | map(select(.type == "BUY"))[]]
}'

echo ""
echo "--------------------------------------------------------------------------"
echo "Step 2: Standalone Backtest (SAME parameters as NVDA in portfolio)"
echo "--------------------------------------------------------------------------"
echo ""
echo "NVDA Beta-Scaled Parameters (from portfolio):"
echo "  - gridIntervalPercent: 0.10615 (10% × 2.123^0.5)"
echo "  - profitRequirement: 0.10615"
echo "  - trailingBuyActivationPercent: 0.10615"
echo "  - trailingBuyReboundPercent: 0.053075"
echo "  - trailingSellActivationPercent: 0.2123"
echo "  - trailingSellPullbackPercent: 0.10615"
echo "  - gridConsecutiveIncrement: 0.053075"
echo ""

STANDALONE_RESULT=$(curl -s -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NVDA",
    "startDate": "2021-11-01",
    "endDate": "2025-10-19",
    "lotSizeUsd": 20000,
    "maxLots": 5,
    "gridIntervalPercent": 0.10615,
    "profitRequirement": 0.10615,
    "trailingBuyActivationPercent": 0.10615,
    "trailingBuyReboundPercent": 0.053075,
    "trailingSellActivationPercent": 0.2123,
    "trailingSellPullbackPercent": 0.10615,
    "gridConsecutiveIncrement": 0.053075,
    "enableConsecutiveIncrementalBuyGrid": true,
    "enableConsecutiveIncrementalSellProfit": false,
    "momentumBasedBuy": true,
    "momentumBasedSell": true,
    "strategyMode": "long"
  }')

echo "Standalone Results Summary:"
echo "==========================="
echo "$STANDALONE_RESULT" | jq '{
  success,
  symbol: .data.summary.symbol,
  momentumMode: .data.momentumMode,
  buyCount: (.data.enhancedTransactions | map(select(.type | contains("BUY"))) | length),
  sellCount: (.data.enhancedTransactions | map(select(.type | contains("SELL"))) | length),
  firstBuy: (.data.enhancedTransactions | map(select(.type | contains("BUY")))[0] // {}),
  buyBlockedByPnL: .data.buyBlockedByPnL,
  finalValue: .data.summary.finalValue,
  totalReturn: .data.summary.totalReturn
}'

echo ""
echo "All BUY Transactions (Standalone):"
echo "==================================="
echo "$STANDALONE_RESULT" | jq '.data.enhancedTransactions | map(select(.type | contains("BUY"))) | .[] | {date, price, type, lots}'

echo ""
echo "--------------------------------------------------------------------------"
echo "Step 3: Comparison Analysis"
echo "--------------------------------------------------------------------------"

PORTFOLIO_BUYS=$(echo "$PORTFOLIO_RESULT" | jq '.data.stockResults[] | select(.symbol == "NVDA") | .transactions | map(select(.type == "BUY")) | length')
STANDALONE_BUYS=$(echo "$STANDALONE_RESULT" | jq '.data.enhancedTransactions | map(select(.type | contains("BUY"))) | length')

PORTFOLIO_FIRST_BUY=$(echo "$PORTFOLIO_RESULT" | jq -r '.data.stockResults[] | select(.symbol == "NVDA") | .transactions | map(select(.type == "BUY"))[0].date // "none"')
STANDALONE_FIRST_BUY=$(echo "$STANDALONE_RESULT" | jq -r '.data.enhancedTransactions | map(select(.type | contains("BUY")))[0].date // "none"')

echo ""
echo "Comparison Results:"
echo "==================="
echo "Portfolio NVDA BUYs: $PORTFOLIO_BUYS"
echo "Standalone NVDA BUYs: $STANDALONE_BUYS"
echo ""
echo "Portfolio First BUY: $PORTFOLIO_FIRST_BUY"
echo "Standalone First BUY: $STANDALONE_FIRST_BUY"
echo ""

if [ "$PORTFOLIO_BUYS" = "$STANDALONE_BUYS" ]; then
  echo "✅ MATCH: Both executed same number of BUYs"
else
  echo "❌ MISMATCH: Portfolio executed $PORTFOLIO_BUYS BUYs, Standalone executed $STANDALONE_BUYS BUYs"
  echo ""
  echo "Root Cause Analysis:"
  echo "===================="
  echo "Portfolio uses SHARED capital pool across all 7 stocks:"
  echo "  - Total Capital: $500,000"
  echo "  - Per-stock theoretical max: $500k / 7 ≈ $71,429"
  echo "  - NVDA needs for 5 lots: 5 × $20,000 = $100,000"
  echo ""
  echo "Standalone uses DEDICATED capital pool:"
  echo "  - Available Capital: maxLots × lotSize = 5 × $20,000 = $100,000"
  echo ""
  echo "Hypothesis: Other stocks consumed shared capital before NVDA's later BUY opportunities"
fi

echo ""
echo "--------------------------------------------------------------------------"
echo "Step 4: Capital Allocation Timeline"
echo "--------------------------------------------------------------------------"
echo ""
echo "Checking which stocks executed BUYs first (chronologically)..."
echo ""

echo "$PORTFOLIO_RESULT" | jq -r '.data.stockResults[] |
  {
    symbol,
    firstBuy: (.transactions | map(select(.type == "BUY"))[0].date // "none"),
    buyCount: (.transactions | map(select(.type == "BUY")) | length),
    totalDeployed: (.transactions | map(select(.type == "BUY")) | map(.value) | add // 0)
  } |
  "\(.symbol): \(.buyCount) buys, first on \(.firstBuy), total deployed: $\(.totalDeployed)"
'

echo ""
echo "=========================================================================="
echo "Investigation Complete"
echo "=========================================================================="
