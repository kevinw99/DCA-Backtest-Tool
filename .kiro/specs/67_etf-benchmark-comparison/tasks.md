# Spec 67: ETF Benchmark Comparison - Tasks

## Phase 1: Backend ETF Benchmark Calculation

**Time Estimate**: 2-3 hours

### Task 1.1: Create calculateETFBenchmark Function

**File**: `backend/services/portfolioBacktestService.js`

**Implementation**:
```javascript
/**
 * Calculate ETF benchmark Buy & Hold performance
 * Spec 67: ETF Benchmark Comparison
 */
async function calculateETFBenchmark(symbol, totalCapital, startDate, endDate) {
  // Implementation as per design.md
}
```

**Acceptance Criteria**:
- [ ] Function fetches ETF price data using existing priceDataService
- [ ] Calculates shares purchased at start price
- [ ] Calculates final value at end price
- [ ] Calculates total return percentage
- [ ] Calculates CAGR correctly
- [ ] Calculates max drawdown
- [ ] Returns dailyValues array for chart
- [ ] Handles missing price data gracefully (returns null)

**Testing**:
```bash
# Test with QQQ
node -e "
const service = require('./services/portfolioBacktestService');
const result = await service.calculateETFBenchmark('QQQ', 1000000, '2021-01-01', '2025-01-01');
console.log(JSON.stringify(result, null, 2));
"
```

---

### Task 1.2: Integrate ETF Calculation into Portfolio Backtest

**File**: `backend/services/portfolioBacktestService.js`

**Location**: After Buy & Hold calculation (around line 940)

**Implementation**:
```javascript
// Spec 67: Calculate ETF benchmark if specified
let etfBenchmark = null;
if (config.benchmarkSymbol) {
  console.log(`\n📊 Calculating ETF benchmark: ${config.benchmarkSymbol}`);
  etfBenchmark = await calculateETFBenchmark(
    config.benchmarkSymbol,
    totalCapital,
    startDate,
    endDate
  );

  if (etfBenchmark) {
    console.log(`   ETF Final Value: $${etfBenchmark.finalValue.toLocaleString()}`);
    console.log(`   ETF Total Return: ${etfBenchmark.totalReturn.toFixed(2)}%`);
    console.log(`   ETF CAGR: ${etfBenchmark.cagr.toFixed(2)}%`);
  }
}
```

**Acceptance Criteria**:
- [ ] ETF benchmark calculated only when benchmarkSymbol present
- [ ] Uses same totalCapital as portfolio
- [ ] Uses same date range as portfolio
- [ ] Logs ETF metrics to console
- [ ] Handles missing ETF data without crashing
- [ ] Returns etfBenchmark in results object

---

### Task 1.3: Update Config Loader for Benchmark Symbol

**File**: `backend/services/portfolioConfigLoader.js`

**Location**: `configToBacktestParams()` function around line 113

**Implementation**:
```javascript
return {
  totalCapital: totalCapitalUsd,
  // ... existing fields ...

  // Spec 67: ETF benchmark (optional)
  ...(config.benchmarkSymbol && { benchmarkSymbol: config.benchmarkSymbol })
};
```

**Validation** (in `validateConfig()` function around line 246):
```javascript
// Spec 67: Validate benchmarkSymbol if present
if (config.benchmarkSymbol) {
  if (typeof config.benchmarkSymbol !== 'string' || config.benchmarkSymbol.trim().length === 0) {
    throw new Error('Field "benchmarkSymbol" must be a non-empty string');
  }
  if (!/^[A-Z0-9.-]+$/.test(config.benchmarkSymbol)) {
    throw new Error(`Invalid benchmark symbol: "${config.benchmarkSymbol}" (must be uppercase letters, numbers, dots, or hyphens)`);
  }
}
```

**Acceptance Criteria**:
- [ ] benchmarkSymbol extracted from config if present
- [ ] Validation checks symbol format
- [ ] Backward compatible (works without benchmarkSymbol)
- [ ] Returns benchmarkSymbol in params object

---

### Task 1.4: Support Multi-Scenario ETF Calculation

**File**: `backend/services/portfolioBacktestService.js`

**Context**: For Spec 61 (Optimized Capital Mode), we need to calculate ETF benchmark for each scenario using the appropriate capital amount.

**Implementation** (in optimized capital mode section):
```javascript
// Calculate ETF benchmark for each scenario if specified
if (config.benchmarkSymbol) {
  console.log(`\n📊 Calculating ETF benchmarks for all scenarios: ${config.benchmarkSymbol}`);

  // Discovery scenario (uses initial capital)
  discoveryResult.etfBenchmark = await calculateETFBenchmark(
    config.benchmarkSymbol,
    initialCapitalForDiscovery,
    startDate,
    endDate
  );

  // Optimal scenario (uses optimal capital)
  optimalResult.etfBenchmark = await calculateETFBenchmark(
    config.benchmarkSymbol,
    optimalCapital,
    startDate,
    endDate
  );

  // Constrained scenario (uses constrained capital)
  constrainedResult.etfBenchmark = await calculateETFBenchmark(
    config.benchmarkSymbol,
    constrainedCapital,
    startDate,
    endDate
  );
}
```

**Acceptance Criteria**:
- [ ] Each scenario gets its own ETF benchmark with appropriate capital
- [ ] Discovery uses $10M (or initial capital)
- [ ] Optimal uses discovered optimal capital
- [ ] Constrained uses 90% of optimal capital
- [ ] All three scenarios show ETF benchmark in results

---

## Phase 2: Frontend Chart Enhancement

**Time Estimate**: 2-3 hours

### Task 2.1: Update PortfolioResults to Extract ETF Benchmark

**File**: `frontend/src/components/PortfolioResults.js`

**Location**: Data destructuring (around line 30-45)

**Implementation**:
```javascript
const {
  portfolioSummary,
  stockResults,
  capitalUtilizationTimeSeries,
  portfolioCompositionTimeSeries,
  capitalDeploymentTimeSeries,
  rejectedOrders,
  deferredSells,
  portfolioRunId,
  parameters,
  buyAndHoldSummary,
  comparison,
  skippedStocks,
  betaGrouping,
  betaFilterMetadata,
  etfBenchmark  // Spec 67: Extract ETF benchmark data
} = data;
```

**Pass to comparison component** (around line 210):
```javascript
<PortfolioBuyAndHoldComparison
  comparison={comparison}
  buyAndHoldSummary={buyAndHoldSummary}
  etfBenchmark={etfBenchmark}  // Spec 67: Pass ETF benchmark
/>
```

**Acceptance Criteria**:
- [ ] etfBenchmark extracted from results data
- [ ] Passed to PortfolioBuyAndHoldComparison component
- [ ] Works correctly when etfBenchmark is null (backward compatible)

---

### Task 2.2: Add ETF Benchmark to Comparison Chart

**File**: `frontend/src/components/PortfolioBuyAndHoldComparison.js`

**Implementation**:
```javascript
// Add state for ETF line toggle
const [showETF, setShowETF] = useState(true);

// Update chart datasets
const datasets = [
  {
    label: 'DCA Strategy',
    data: dcaPortfolioValues,
    borderColor: 'rgb(75, 192, 192)',
    backgroundColor: 'rgba(75, 192, 192, 0.1)',
    fill: false,
    tension: 0.1
  },
  {
    label: 'Buy & Hold',
    data: buyAndHoldPortfolioValues,
    borderColor: 'rgb(54, 162, 235)',
    backgroundColor: 'rgba(54, 162, 235, 0.1)',
    borderDash: [5, 5],
    fill: false,
    tension: 0.1
  },
  // Spec 67: Add ETF Benchmark line
  ...(etfBenchmark && showETF ? [{
    label: `${etfBenchmark.symbol} Benchmark`,
    data: etfBenchmark.dailyValues.map(d => d.value),
    borderColor: 'rgb(255, 159, 64)',  // Orange
    backgroundColor: 'rgba(255, 159, 64, 0.1)',
    borderDash: [10, 5],
    fill: false,
    tension: 0.1
  }] : [])
];

// Add toggle checkbox
{etfBenchmark && (
  <label className="chart-toggle">
    <input
      type="checkbox"
      checked={showETF}
      onChange={(e) => setShowETF(e.target.checked)}
    />
    <span className="toggle-icon">{etfBenchmark.symbol}</span>
    Show {etfBenchmark.symbol} Benchmark
  </label>
)}
```

**Acceptance Criteria**:
- [ ] Third line appears in chart when etfBenchmark present
- [ ] Line is orange and uses dashed style
- [ ] Toggle checkbox controls ETF line visibility
- [ ] Chart aligns all three lines on same time axis
- [ ] Works correctly when etfBenchmark is null
- [ ] Legend shows all three lines with correct labels

**Testing**:
- Load portfolio backtest with QQQ benchmark
- Verify three lines appear
- Toggle ETF line on/off
- Check colors and line styles

---

### Task 2.3: Add ETF Benchmark to Comparison Table

**File**: `frontend/src/components/PortfolioBuyAndHoldComparison.js`

**Implementation**:
```javascript
<table className="comparison-table">
  <thead>
    <tr>
      <th>Metric</th>
      <th>DCA Strategy</th>
      <th>Buy & Hold</th>
      {etfBenchmark && <th>{etfBenchmark.symbol} Benchmark</th>}
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Final Portfolio Value</td>
      <td className="value-cell">${dcaValue.toLocaleString()}</td>
      <td className="value-cell">${buyHoldValue.toLocaleString()}</td>
      {etfBenchmark && (
        <td className="value-cell">${etfBenchmark.finalValue.toLocaleString()}</td>
      )}
    </tr>
    <tr>
      <td>Total Return</td>
      <td className="percent-cell">{dcaReturn}%</td>
      <td className="percent-cell">{buyHoldReturn}%</td>
      {etfBenchmark && (
        <td className="percent-cell">{etfBenchmark.totalReturn.toFixed(2)}%</td>
      )}
    </tr>
    <tr>
      <td>CAGR</td>
      <td className="percent-cell">{dcaCagr}%</td>
      <td className="percent-cell">{buyHoldCagr}%</td>
      {etfBenchmark && (
        <td className="percent-cell">{etfBenchmark.cagr.toFixed(2)}%</td>
      )}
    </tr>
    <tr>
      <td>Max Drawdown</td>
      <td className="percent-cell">{dcaDrawdown}%</td>
      <td className="percent-cell">{buyHoldDrawdown}%</td>
      {etfBenchmark && (
        <td className="percent-cell">{etfBenchmark.maxDrawdown.toFixed(2)}%</td>
      )}
    </tr>
    {/* Add more rows as needed */}
  </tbody>
</table>
```

**Acceptance Criteria**:
- [ ] ETF column appears only when etfBenchmark present
- [ ] Shows ETF symbol in column header
- [ ] Displays all key metrics (final value, return, CAGR, drawdown)
- [ ] Formatting matches other columns
- [ ] Works correctly without etfBenchmark (backward compatible)

---

## Phase 3: Config File Updates

**Time Estimate**: 1 hour

### Task 3.1: Add Benchmark to NASDAQ-100 Configs

**Files**:
- `backend/configs/portfolios/nasdaq100.json`
- `backend/configs/portfolios/nasdaq100_beta_filtered.json`

**Changes**:
```json
{
  "name": "NASDAQ-100",
  "benchmarkSymbol": "QQQ",  // ADD THIS LINE
  "totalCapitalUsd": 3000000,
  ...
}
```

**Acceptance Criteria**:
- [ ] All NASDAQ-100 configs have `"benchmarkSymbol": "QQQ"`
- [ ] JSON files remain valid
- [ ] Backtests show QQQ benchmark

---

### Task 3.2: Create S&P 500 Config Files

**File**: `backend/configs/portfolios/sp500.json`

**Content**: Copy from nasdaq100.json and modify:
- Change name to "S&P 500"
- Change benchmarkSymbol to "SPY"
- Update stocks array to S&P 500 symbols
- Update date ranges if needed

**File**: `backend/configs/portfolios/sp500_beta_filtered.json`

**Content**: Copy from sp500.json and add:
- Set `"minBeta": 1.5`
- Update name to "S&P 500 - High Beta (≥1.5)"

**Acceptance Criteria**:
- [ ] sp500.json created with SPY benchmark
- [ ] sp500_beta_filtered.json created with minBeta: 1.5 and SPY benchmark
- [ ] Both files validate successfully
- [ ] Stock symbols are valid S&P 500 constituents

---

## Phase 4: Testing & Verification

**Time Estimate**: 2 hours

### Task 4.1: Backend Testing

**Test 1**: NASDAQ-100 with QQQ benchmark
```bash
curl -X POST http://localhost:3001/api/backtest/portfolio/config/nasdaq100_beta_filtered \
  | jq '.data.scenarios.optimal.etfBenchmark'
```

**Expected**: ETF benchmark data with QQQ metrics

**Test 2**: S&P 500 with SPY benchmark
```bash
curl -X POST http://localhost:3001/api/backtest/portfolio/config/sp500_beta_filtered \
  | jq '.data.scenarios.optimal.etfBenchmark'
```

**Expected**: ETF benchmark data with SPY metrics

**Test 3**: Backward compatibility
```bash
# Test with old config without benchmarkSymbol
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "totalCapital": 1000000,
    "stocks": [{"symbol": "AAPL", "params": {...}}],
    ...
  }' | jq '.etfBenchmark'
```

**Expected**: `null` (no error)

**Acceptance Criteria**:
- [ ] QQQ benchmark appears in NASDAQ-100 results
- [ ] SPY benchmark appears in S&P 500 results
- [ ] No errors with configs lacking benchmarkSymbol
- [ ] ETF metrics are reasonable (positive returns for bull market periods)

---

### Task 4.2: Frontend Testing

**Test 1**: Chart with three lines
- Navigate to: `http://localhost:3000/portfolio-backtest?config=nasdaq100_beta_filtered`
- Verify: Three lines appear (DCA, Buy & Hold, QQQ)
- Verify: Colors are distinct (blue, green, orange)
- Verify: Toggle works

**Test 2**: Comparison table
- Check ETF column appears
- Verify metrics match backend response
- Check formatting is consistent

**Test 3**: Multi-scenario mode
- Verify ETF benchmark appears in all three tabs (Discovery, Optimal, Constrained)
- Check each scenario uses appropriate capital

**Acceptance Criteria**:
- [ ] Chart displays three lines correctly
- [ ] Toggle checkbox works
- [ ] ETF column in comparison table
- [ ] All metrics display correctly
- [ ] Works in multi-scenario mode

---

### Task 4.3: Create Verification URLs

**NASDAQ-100 Beta Filtered**:
```
Frontend: http://localhost:3000/portfolio-backtest?config=nasdaq100_beta_filtered&rerun=true
Backend: curl http://localhost:3001/api/backtest/portfolio/config/nasdaq100_beta_filtered?rerun=true
```

**S&P 500 Beta Filtered**:
```
Frontend: http://localhost:3000/portfolio-backtest?config=sp500_beta_filtered&rerun=true
Backend: curl http://localhost:3001/api/backtest/portfolio/config/sp500_beta_filtered?rerun=true
```

**Acceptance Criteria**:
- [ ] All URLs return valid results
- [ ] ETF benchmark data present
- [ ] Charts display correctly
- [ ] No console errors

---

## Summary Checklist

### Backend
- [ ] calculateETFBenchmark function implemented
- [ ] ETF calculation integrated into portfolio backtest
- [ ] Config loader extracts benchmarkSymbol
- [ ] Multi-scenario support for ETF benchmark
- [ ] Error handling for missing ETF data

### Frontend
- [ ] PortfolioResults passes etfBenchmark to comparison component
- [ ] Chart displays third line for ETF benchmark
- [ ] Toggle checkbox controls ETF line
- [ ] Comparison table includes ETF column
- [ ] Backward compatible (works without ETF data)

### Config Files
- [ ] NASDAQ-100 configs updated with QQQ
- [ ] S&P 500 config created with SPY
- [ ] S&P 500 beta filtered config created
- [ ] All configs validate successfully

### Testing
- [ ] Backend tests pass
- [ ] Frontend tests pass
- [ ] Verification URLs work
- [ ] No regressions in existing functionality

---

## Total Time Estimate: 8-11 hours

- Phase 1: Backend (2-3 hours)
- Phase 2: Frontend (2-3 hours)
- Phase 3: Configs (1 hour)
- Phase 4: Testing (2 hours)
- Buffer (1-2 hours)
