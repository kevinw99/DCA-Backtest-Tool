#!/bin/bash

echo "=========================================="
echo "Testing Portfolio Buy & Hold Comparison"
echo "=========================================="
echo ""

curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["TSLA", "NVDA", "PLTR"],
    "totalCapital": 100000,
    "startDate": "2023-01-01",
    "endDate": "2024-01-01",
    "lotSizeUsd": 10000,
    "maxLotsPerStock": 10,
    "defaultParams": {
      "basic": {
        "gridIntervalPercent": 0.05,
        "profitRequirement": 0.10
      },
      "longStrategy": {
        "enableTrailingBuy": true,
        "trailingBuyActivationPercent": 0.10,
        "trailingBuyReboundPercent": 0.03,
        "enableTrailingSell": true,
        "trailingSellActivationPercent": 0.10,
        "trailingSellPullbackPercent": 0.03
      }
    },
    "stocks": ["TSLA", "NVDA", "PLTR"]
  }' 2>/dev/null | jq '{
    dcaFinalValue: .data.portfolioSummary.finalPortfolioValue,
    dcaTotalReturn: .data.portfolioSummary.totalReturn,
    dcaCAGR: .data.portfolioSummary.cagr,
    buyHoldFinalValue: .data.buyAndHoldSummary.finalValue,
    buyHoldTotalReturn: .data.buyAndHoldSummary.totalReturn,
    buyHoldCAGR: .data.buyAndHoldSummary.cagr,
    outperformance: .data.comparison.outperformanceAmount,
    outperformancePercent: .data.comparison.outperformancePercent,
    comparisonMetrics: .data.comparison.comparison
  }'
