#!/bin/bash
curl -s -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NVDA",
    "startDate": "2020-01-01",
    "endDate": "2025-01-01",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "profitRequirement": 5,
    "gridIntervalPercent": 10,
    "trailingBuyActivationPercent": 10,
    "trailingBuyReboundPercent": 3,
    "trailingSellActivationPercent": 10,
    "trailingSellPullbackPercent": 3,
    "volatilityEnabled": false,
    "rsiEnabled": false,
    "maTrendEnabled": false,
    "trailingStopEnabled": false,
    "dynamicReentryEnabled": false,
    "positionSizingEnabled": false
  }' > /tmp/nvda_result.json

echo "Extracting key metrics..."
jq '{
  dcaTotalReturn: .data.totalReturn,
  dcaMaxCapitalDeployed: .data.performanceMetrics.maxDeployedCapital,
  bnhTotalReturn: .data.buyAndHoldMetrics.totalReturn,
  bnhTotalReturnPercent: .data.buyAndHoldMetrics.totalReturnPercent
}' /tmp/nvda_result.json
