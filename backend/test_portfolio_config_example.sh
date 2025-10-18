#!/bin/bash

# Test Portfolio Config Example (Small Tech Portfolio)
#
# This script tests the config-based portfolio backtest endpoint
# using a small 3-stock portfolio (AAPL, MSFT, NVDA)

echo "================================================"
echo "Testing Config-Based Portfolio Backtest"
echo "Config: example-tech.json"
echo "================================================"
echo ""

# Test GET endpoint (simplest form)
echo "🧪 Testing GET endpoint..."
echo "URL: http://localhost:3001/api/backtest/portfolio/config/example-tech"
echo ""

time curl -s http://localhost:3001/api/backtest/portfolio/config/example-tech \
  | jq '{
    success: .success,
    meta: .meta,
    summary: {
      stocks: (.data.stocks | length),
      totalTransactions: .data.totalTransactions,
      rejectedOrders: .data.rejectedOrders,
      finalValue: .data.portfolioMetrics.finalValue,
      totalReturn: .data.portfolioMetrics.totalReturn,
      totalReturnPercent: .data.portfolioMetrics.totalReturnPercent,
      buyAndHoldReturn: .data.portfolioMetrics.buyAndHold.totalReturnPercent
    }
  }'

echo ""
echo "================================================"
echo ""

# Test POST endpoint
echo "🧪 Testing POST endpoint..."
echo "URL: http://localhost:3001/api/backtest/portfolio/config"
echo "Body: {\"configFile\": \"example-tech\"}"
echo ""

time curl -s -X POST http://localhost:3001/api/backtest/portfolio/config \
  -H "Content-Type: application/json" \
  -d '{"configFile": "example-tech"}' \
  | jq '{
    success: .success,
    meta: .meta,
    summary: {
      stocks: (.data.stocks | length),
      totalTransactions: .data.totalTransactions,
      rejectedOrders: .data.rejectedOrders,
      finalValue: .data.portfolioMetrics.finalValue,
      totalReturn: .data.portfolioMetrics.totalReturn
    }
  }'

echo ""
echo "✅ Test complete!"
echo ""
