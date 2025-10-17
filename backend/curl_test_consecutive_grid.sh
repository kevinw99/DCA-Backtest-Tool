#!/bin/bash

# Test for consecutive incremental buy grid spacing bug
# User reported: Sept 9 buy at $14.37 shows "30%" but Oct 17 buy at $11.87 (only 17.4% away) executed
# Expected: Oct 17 buy should be BLOCKED because 17.4% < 30% required

echo "=== Testing Consecutive Incremental Buy Grid Spacing ==="
echo "Date Range: 2022-01-01 to 2022-12-31"
echo "Symbol: PLTR"
echo "Grid Interval: 10%, Consecutive Increment: 5%"
echo "Expected progression: 15%, 20%, 25%, 30%, 35%..."
echo ""

# Run backtest with consecutive incremental buy grid ENABLED
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "startDate": "2022-01-01",
    "endDate": "2022-12-31",
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
    "enableConsecutiveIncrementalBuyGrid": true,
    "enableConsecutiveIncrementalSellProfit": false,
    "enableScenarioDetection": false,
    "dynamicGridMultiplier": 1,
    "gridConsecutiveIncrement": 0.05,
    "trailingStopOrderType": "market",
    "strategyMode": "long"
  }' > /tmp/consecutive_grid_test.json

echo ""
echo "=== Transaction Log (focusing on Sept-Oct 2022 buys) ==="
echo ""

# Extract transaction log and search for the problematic dates
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/consecutive_grid_test.json', 'utf8'));
if (data.success && data.data.transactionLog) {
  const logs = data.data.transactionLog;

  // Find index of Sept 9, 2022 and show context around it
  const septIndex = logs.findIndex(line => line.includes('2022-09-09'));

  if (septIndex >= 0) {
    console.log('Context around Sept 9, 2022 buy:');
    console.log('='.repeat(80));
    const start = Math.max(0, septIndex - 5);
    const end = Math.min(logs.length, septIndex + 20);
    for (let i = start; i < end; i++) {
      const marker = i === septIndex ? ' <-- SEPT 9 BUY' : '';
      console.log(logs[i] + marker);
    }
  } else {
    console.log('Sept 9, 2022 not found. Showing all BUY transactions:');
    logs.forEach(line => {
      if (line.includes('BUY') || line.includes('SELL')) {
        console.log(line);
      }
    });
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('Summary:');
  console.log('='.repeat(80));
  const summary = data.data;
  console.log('Total Buys:', summary.totalBuys);
  console.log('Total Sells:', summary.totalSells);
  console.log('Final P&L:', summary.totalPNL);
  console.log('Final Holdings:', summary.currentHoldings);
} else {
  console.log('Error: Could not extract transaction log');
  console.log(JSON.stringify(data, null, 2));
}
"
