#!/bin/bash

# Test Momentum Mode in Portfolio Backtest (Spec 45)

echo "=== Testing Momentum Mode - Portfolio Backtest ==="
echo ""

# Test: Portfolio backtest with momentum enabled
echo "Test: Portfolio with momentumBasedBuy=true"
curl -s -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "totalCapital": 100000,
    "startDate": "2024-01-01",
    "endDate": "2024-03-31",
    "lotSizeUsd": 10000,
    "maxLotsPerStock": 10,
    "stocks": ["PLTR", "TSLA"],
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10,
    "momentumBasedBuy": true,
    "momentumBasedSell": false
  }' | jq '{
    success: .success,
    stockCount: (.data.stockResults | length),
    stocks: [.data.stockResults[] | {
      symbol: .symbol,
      momentumMode: .momentumMode,
      buyBlockedByPnL: .buyBlockedByPnL,
      maxLotsReached: .maxLotsReached,
      totalBuys: .totalBuys
    }],
    portfolioValue: .data.portfolioSummary.finalPortfolioValue,
    portfolioReturn: .data.portfolioSummary.totalReturnPercent
  }'

echo ""
echo "=== Test Complete ==="
