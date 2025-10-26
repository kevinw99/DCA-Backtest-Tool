#!/bin/bash

# Test Momentum-Based Trading Implementation (Spec 45)
# Tests both momentum buy and momentum sell modes

echo "=== Testing Momentum-Based Trading Implementation ==="
echo ""

# Test 1: Momentum Buy Mode
echo "Test 1: Momentum Buy Mode (PLTR 2024)"
echo "Expected: First buy allowed, subsequent buys only when P/L > 0, unlimited lots"
curl -s -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "maxLotsToSell": 1,
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
    symbol: .data.symbol,
    momentumMode: .data.summary.momentumMode,
    maxLotsReached: .data.summary.maxLotsReached,
    buyBlockedByPnL: .data.summary.buyBlockedByPnL,
    totalBuys: .data.summary.totalBuys,
    totalSells: .data.summary.totalSells,
    finalPnL: .data.positionMetrics.finalPnL,
    netROI: .data.summary.netROI
  }'

echo ""
echo "---"
echo ""

# Test 2: Momentum Sell Mode
echo "Test 2: Momentum Sell Mode (PLTR 2024)"
echo "Expected: Immediate sell consideration (0% activation), fast exits on pullbacks"
curl -s -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "maxLotsToSell": 1,
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10,
    "momentumBasedBuy": false,
    "momentumBasedSell": true
  }' | jq '{
    success: .success,
    symbol: .data.symbol,
    momentumMode: .data.summary.momentumMode,
    totalBuys: .data.summary.totalBuys,
    totalSells: .data.summary.totalSells,
    netROI: .data.summary.netROI
  }'

echo ""
echo "---"
echo ""

# Test 3: Combined Momentum Mode
echo "Test 3: Combined Momentum Buy + Sell (PLTR 2024)"
echo "Expected: Both modes active, aggressive trading strategy"
curl -s -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "maxLotsToSell": 1,
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10,
    "momentumBasedBuy": true,
    "momentumBasedSell": true
  }' | jq '{
    success: .success,
    symbol: .data.symbol,
    momentumMode: .data.summary.momentumMode,
    maxLotsReached: .data.summary.maxLotsReached,
    buyBlockedByPnL: .data.summary.buyBlockedByPnL,
    totalBuys: .data.summary.totalBuys,
    totalSells: .data.summary.totalSells,
    finalPnL: .data.positionMetrics.finalPnL,
    netROI: .data.summary.netROI
  }'

echo ""
echo "---"
echo ""

# Test 4: Traditional Mode (baseline comparison)
echo "Test 4: Traditional Mode - Baseline (PLTR 2024)"
echo "Expected: Standard DCA behavior with maxLots=10 limit"
curl -s -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "maxLotsToSell": 1,
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10,
    "momentumBasedBuy": false,
    "momentumBasedSell": false
  }' | jq '{
    success: .success,
    symbol: .data.symbol,
    momentumMode: .data.summary.momentumMode,
    totalBuys: .data.summary.totalBuys,
    totalSells: .data.summary.totalSells,
    netROI: .data.summary.netROI
  }'

echo ""
echo "=== Tests Complete ==="
