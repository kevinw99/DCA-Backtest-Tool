# Bug Reproduction

## How to Reproduce

### Step 1: Start the Application
```bash
# Terminal 1: Start backend
cd backend
node server.js

# Terminal 2: Start frontend
cd frontend
npm start
```

### Step 2: Run Portfolio Backtest
Access any of these URLs to see the misaligned charts:

#### URL 1: NASDAQ-100 Portfolio (Recommended for testing)
```
http://localhost:3000/portfolio/nasdaq100/results
```

#### URL 2: Custom Multi-Stock Portfolio
```
http://localhost:3000/portfolio/custom/results?symbols=PLTR,NVDA,TSLA&startDate=2021-01-01&endDate=2025-01-01&totalCapital=500000&lotSizeUsd=10000&maxLotsPerStock=10&gridIntervalPercent=0.10&profitRequirement=0.10
```

### Step 3: Observe the Charts
Scroll down to the portfolio charts section and notice:
- Different date ranges on x-axes
- Tick marks not vertically aligned
- Cannot draw mental vertical line to compare data at same date

## API Testing (Backend)

### Test Portfolio Backtest Endpoint
```bash
# Create test configuration
cat > /tmp/test_portfolio.json <<'EOF'
{
  "totalCapital": 500000,
  "startDate": "2021-01-01",
  "endDate": "2025-01-01",
  "lotSizeUsd": 10000,
  "maxLotsPerStock": 10,
  "stocks": ["PLTR", "NVDA", "TSLA"],
  "defaultParams": {
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10
  }
}
EOF

# Run backtest
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d @/tmp/test_portfolio.json \
  -o /tmp/portfolio_result.json

# Check chartData structure
jq '.data.chartData | {
  masterDatesCount: (.masterDates | length),
  firstDate: .masterDates[0],
  lastDate: .masterDates[-1],
  dcaDataCount: (.dcaVsBuyAndHold | length),
  compositionCount: (.composition | length),
  normalizedCount: (.normalizedPrices | length),
  capitalCount: (.capitalUtilization | length)
}' /tmp/portfolio_result.json
```

**Expected Output:**
All counts should be equal, indicating same date range across all chart datasets.

**Actual Output:**
Counts are equal, but frontend still renders different x-axis ranges (indicating frontend rendering issue).

## Visual Evidence

### Screenshots
See [screenshots directory](./screenshots/) for visual evidence.

**Recommended screenshots to capture:**
1. Full page showing all 4 charts with misaligned x-axes
2. Close-up of x-axis tick marks showing different positions
3. Browser console showing sharedTicks and sharedDomain values
4. Expected behavior (if available from another page for comparison)

### What You Should See (Expected)
```
Chart 1: |----Jan----|----Apr----|----Jul----|----Oct----|
Chart 2: |----Jan----|----Apr----|----Jul----|----Oct----|
Chart 3: |----Jan----|----Apr----|----Jul----|----Oct----|
         ^           ^           ^           ^
         Vertically aligned ticks
```

### What You Actually See (Actual)
```
Chart 1: |--Jan--|--Apr--|--Jul--|--Oct--|
Chart 2: |----Jan-----|----May-----|----Sep-----|
Chart 3: |---Feb---|---Jun---|---Oct---|
         ^         ^         ^
         Not aligned
```
