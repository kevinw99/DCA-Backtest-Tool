#!/bin/bash

# Test Nasdaq 100 Portfolio Backtest
#
# This script tests the config-based portfolio backtest for the Nasdaq 100
# Config file: nasdaq100.json
# Stocks: 92 Nasdaq 100 component stocks
# Capital: $3,000,000
# Period: 2021-09-01 to current

echo "================================================"
echo "Testing Nasdaq 100 Portfolio Backtest"
echo "Config: nasdaq100.json"
echo "Stocks: 92 Nasdaq 100 components"
echo "Capital: $3,000,000"
echo "Period: 2021-09-01 to current"
echo "================================================"
echo ""

echo "🚀 Starting backtest (this may take several minutes)..."
echo ""

# Use GET endpoint with simple URL
echo "URL: http://localhost:3001/api/backtest/portfolio/config/nasdaq100"
echo ""

# Run the backtest and save full results
time curl -s http://localhost:3001/api/backtest/portfolio/config/nasdaq100 \
  > /tmp/nasdaq100_results.json

# Display summary
cat /tmp/nasdaq100_results.json | jq '{
  success: .success,
  meta: .meta,
  summary: {
    totalStocks: (.data.stocks | length),
    totalTransactions: .data.totalTransactions,
    rejectedOrders: .data.rejectedOrders,
    finalValue: .data.portfolioMetrics.finalValue,
    totalReturn: .data.portfolioMetrics.totalReturn,
    totalReturnPercent: .data.portfolioMetrics.totalReturnPercent,
    sharpeRatio: .data.portfolioMetrics.sharpeRatio,
    maxDrawdown: .data.portfolioMetrics.maxDrawdown,
    buyAndHold: {
      finalValue: .data.portfolioMetrics.buyAndHold.finalValue,
      totalReturn: .data.portfolioMetrics.buyAndHold.totalReturn,
      totalReturnPercent: .data.portfolioMetrics.buyAndHold.totalReturnPercent
    },
    topPerformers: [
      .data.portfolioMetrics.stocks |
      sort_by(.totalReturnPercent) |
      reverse |
      .[0:5] |
      .[] |
      {symbol: .symbol, return: .totalReturnPercent, finalValue: .finalValue}
    ]
  }
}'

echo ""
echo "================================================"
echo "Full results saved to: /tmp/nasdaq100_results.json"
echo ""
echo "To view individual stock performance:"
echo "  cat /tmp/nasdaq100_results.json | jq '.data.portfolioMetrics.stocks'"
echo ""
echo "To view drill-down URL for a specific stock:"
echo "  cat /tmp/nasdaq100_results.json | jq '.data.stocks[0].drillDownUrl'"
echo ""
echo "✅ Test complete!"
echo ""
