#!/bin/bash

# Backend URL captured from frontend request (lines 8-34 of /tmp/server_debug.log)
# Testing with date range 2024-01-01 to 2025-01-01 to reduce output size

echo "=== Testing DCA Backtest with Market Orders ==="
echo "Date Range: 2024-01-01 to 2025-01-01"
echo ""

# Run backtest and save full response
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "startDate": "2024-01-01",
    "endDate": "2025-01-01",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "maxLotsToSell": 1,
    "gridIntervalPercent": 0.1,
    "profitRequirement": 0.1,
    "trailingBuyActivationPercent": 0,
    "trailingBuyReboundPercent": 0.2,
    "trailingSellActivationPercent": 0.05,
    "trailingSellPullbackPercent": 0.2,
    "beta": 2.595,
    "coefficient": 1,
    "enableBetaScaling": false,
    "isManualBetaOverride": false,
    "enableDynamicGrid": false,
    "normalizeToReference": false,
    "enableConsecutiveIncrementalBuyGrid": false,
    "enableConsecutiveIncrementalSellProfit": false,
    "enableScenarioDetection": false,
    "dynamicGridMultiplier": 1,
    "gridConsecutiveIncrement": 0.1,
    "trailingStopOrderType": "market",
    "strategyMode": "long"
  }' > /tmp/backtest_response.json

echo ""
echo "=== Extracting Daily Transaction Logs ==="
echo ""

# Extract and display the transaction log (transactionLog array in the response)
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/backtest_response.json', 'utf8'));
if (data.success && data.data.transactionLog) {
  console.log('Transaction Log:');
  console.log('================');
  data.data.transactionLog.forEach(line => console.log(line));
} else {
  console.log('Error: Could not extract transaction log');
  console.log(JSON.stringify(data, null, 2));
}
"
