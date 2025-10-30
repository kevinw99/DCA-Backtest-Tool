#!/bin/bash

echo "=== Testing Margin Support (Spec 50) ==="
echo ""

# Test 1: No margin (baseline)
echo "Test 1: No Margin (baseline) - marginPercent = 0"
echo "Expected: effectiveCapital = totalCapital"
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "portfolioConfig": "nasdaq100",
    "startDate": "2024-01-01",
    "endDate": "2024-03-31"
  }' 2>/dev/null | jq '.data.capitalMetrics | {totalCapitalUsd, marginPercent, effectiveCapital, marginUtilization}'

echo ""
echo "---"
echo ""

# Test 2: 20% margin
echo "Test 2: 20% Margin"
echo "Expected: effectiveCapital = totalCapital * 1.2"
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "portfolioConfig": "nasdaq100",
    "marginPercent": 20,
    "startDate": "2024-01-01",
    "endDate": "2024-03-31"
  }' 2>/dev/null | jq '.data.capitalMetrics | {totalCapitalUsd, marginPercent, effectiveCapital, marginUtilization}'

echo ""
echo "---"
echo ""

# Test 3: Check rejected orders have margin context
echo "Test 3: Rejected Orders with Margin Context"
echo "Expected: rejectedOrders include capitalState with margin fields"
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "portfolioConfig": "nasdaq100",
    "marginPercent": 10,
    "startDate": "2024-01-01",
    "endDate": "2024-03-31"
  }' 2>/dev/null | jq '.data.rejectedOrders[0] | {date, symbol, reason, capitalState}'

echo ""
echo "---"
echo ""

# Test 4: Invalid margin values
echo "Test 4: Invalid Margin Values"
echo ""

echo "4a. Negative margin (-10):"
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "portfolioConfig": "nasdaq100",
    "marginPercent": -10,
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  }' 2>/dev/null | jq '{success, error}'

echo ""

echo "4b. Excessive margin (150):"
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "portfolioConfig": "nasdaq100",
    "marginPercent": 150,
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  }' 2>/dev/null | jq '{success, error}'

echo ""
echo "=== Tests Complete ==="
