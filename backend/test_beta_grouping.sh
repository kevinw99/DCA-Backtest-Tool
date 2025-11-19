#!/bin/bash

echo "Testing beta grouping with small portfolio..."

curl -X POST http://localhost:3001/api/backtest/portfolio/config \
  -H "Content-Type: application/json" \
  -d '{"configFile":"test_beta_small"}' \
  > /tmp/beta_test_full.json 2>&1

if [ $? -eq 0 ]; then
  echo "✓ Request completed"
  echo ""
  echo "=== Beta Grouping Summary ==="
  cat /tmp/beta_test_full.json | jq '.data.betaGrouping.summary'

  echo ""
  echo "=== Groups Overview ==="
  cat /tmp/beta_test_full.json | jq '.data.betaGrouping.groups[] | {id, label, stockCount, dcaScore: .performance.dcaSuitabilityScore}'
else
  echo "✗ Request failed"
  cat /tmp/beta_test_full.json
fi
