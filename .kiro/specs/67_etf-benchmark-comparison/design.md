# Spec 67: ETF Benchmark Comparison - Design

## Architecture Overview

The ETF benchmark feature extends the existing portfolio backtest system with an additional comparison metric. It reuses the existing price data infrastructure and Buy & Hold calculation logic, applying it to a single ETF symbol instead of a portfolio of stocks.

```
┌──────────────────────────────────────────────────────────────┐
│ Portfolio Backtest Flow (Enhanced)                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. Load Config (includes benchmarkSymbol)                    │
│         ↓                                                     │
│ 2. Validate Parameters (check if ETF symbol valid)           │
│         ↓                                                     │
│ 3. Fetch Stock Price Data (existing)                         │
│         ↓                                                     │
│ 4. [NEW] Fetch ETF Price Data (if benchmarkSymbol present)   │
│         ↓                                                     │
│ 5. Run DCA Strategy (existing)                               │
│         ↓                                                     │
│ 6. Calculate Buy & Hold for Stocks (existing)                │
│         ↓                                                     │
│ 7. [NEW] Calculate Buy & Hold for ETF                        │
│         ↓                                                     │
│ 8. Generate Comparison Metrics (enhanced)                    │
│         ↓                                                     │
│ 9. Return Results (with etfBenchmark field)                  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Component Analysis

### 1. Backend: Portfolio Config Loader

**File**: `backend/services/portfolioConfigLoader.js`

**Current State**:
- Loads config files from `backend/configs/portfolios/`
- Validates config structure
- Converts to backtest parameters

**Target State**:
- Extract `benchmarkSymbol` from config (optional field)
- Validate that `benchmarkSymbol` is a valid stock symbol (if present)
- Pass `benchmarkSymbol` to backtest service

**Changes Required**:
```javascript
// In configToBacktestParams() around line 113
return {
  totalCapital: totalCapitalUsd,
  // ... existing fields ...

  // Spec 67: ETF benchmark (optional)
  ...(config.benchmarkSymbol && { benchmarkSymbol: config.benchmarkSymbol })
};
```

### 2. Backend: Portfolio Backtest Service

**File**: `backend/services/portfolioBacktestService.js`

**Current State**:
- Runs DCA strategy for each stock
- Calculates Buy & Hold for portfolio stocks
- Returns portfolio summary and comparison

**Target State**:
- Check if `benchmarkSymbol` parameter present
- Fetch ETF price data using existing `priceDataService`
- Calculate ETF Buy & Hold performance
- Add `etfBenchmark` to results

**Implementation Location**: After Buy & Hold calculation (around line 900-950)

**New Function**:
```javascript
/**
 * Calculate ETF benchmark Buy & Hold performance
 * @param {string} symbol - ETF symbol (e.g., "QQQ", "SPY")
 * @param {number} totalCapital - Total capital to invest
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object} ETF benchmark results
 */
async function calculateETFBenchmark(symbol, totalCapital, startDate, endDate) {
  // 1. Fetch ETF price data
  const priceData = await priceDataService.fetchPriceData(symbol, startDate, endDate);

  if (!priceData || !priceData.dailyPrices || priceData.dailyPrices.length === 0) {
    console.warn(`⚠️  No price data available for ETF benchmark: ${symbol}`);
    return null;
  }

  // 2. Get start and end prices
  const startPrice = parseFloat(priceData.dailyPrices[0].adjusted_close || priceData.dailyPrices[0].close);
  const endPrice = parseFloat(priceData.dailyPrices[priceData.dailyPrices.length - 1].adjusted_close || priceData.dailyPrices[priceData.dailyPrices.length - 1].close);

  // 3. Calculate shares purchased
  const sharesPurchased = totalCapital / startPrice;

  // 4. Calculate final value and returns
  const finalValue = sharesPurchased * endPrice;
  const totalReturn = ((finalValue - totalCapital) / totalCapital) * 100;

  // 5. Calculate CAGR
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const years = (endDateObj - startDateObj) / (365.25 * 24 * 60 * 60 * 1000);
  const cagr = (Math.pow(finalValue / totalCapital, 1 / years) - 1) * 100;

  // 6. Calculate max drawdown
  let peak = startPrice;
  let maxDrawdown = 0;

  for (const day of priceData.dailyPrices) {
    const price = parseFloat(day.adjusted_close || day.close);
    if (price > peak) {
      peak = price;
    }
    const drawdown = ((price - peak) / peak) * 100;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // 7. Build daily values array for chart
  const dailyValues = priceData.dailyPrices.map(day => ({
    date: day.date,
    value: sharesPurchased * parseFloat(day.adjusted_close || day.close)
  }));

  return {
    symbol,
    startDate,
    endDate,
    startPrice,
    endPrice,
    sharesPurchased,
    initialInvestment: totalCapital,
    finalValue,
    totalReturn,
    cagr,
    maxDrawdown,
    dailyValues
  };
}
```

**Integration Point** (in `runPortfolioBacktest` function):
```javascript
// After Buy & Hold calculation (around line 940)

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

// Add to results object
return {
  // ... existing fields ...
  etfBenchmark,  // NEW: Add ETF benchmark data
};
```

### 3. Backend: Server API

**File**: `backend/server.js`

**Current State**:
- POST `/api/backtest/portfolio` endpoint accepts config object
- GET `/api/backtest/portfolio/config/:configName` loads and runs config

**Target State**:
- No changes required (benchmark is part of config)
- Results automatically include `etfBenchmark` field

**Changes Required**: None

### 4. Frontend: Portfolio Backtest Page

**File**: `frontend/src/components/PortfolioBacktestPage.js`

**Current State**:
- Manages form state and API requests
- Displays results using PortfolioResults or OptimizedCapitalResults

**Target State**:
- No changes required (ETF benchmark comes from backend in results)

**Changes Required**: None

### 5. Frontend: Portfolio Results Display

**File**: `frontend/src/components/PortfolioResults.js`

**Current State**:
- Displays portfolio summary, charts, and tables
- Shows DCA vs Buy & Hold comparison

**Target State**:
- Extract `etfBenchmark` from results data
- Pass to chart component
- Display ETF benchmark metrics in comparison section

**Changes Required**:
```javascript
// Around line 30-45 (destructure data)
const {
  portfolioSummary,
  stockResults,
  // ... existing fields ...
  buyAndHoldSummary,
  comparison,
  etfBenchmark,  // NEW: Extract ETF benchmark data
  // ...
} = data;

// Pass to PortfolioBuyAndHoldComparison component (around line 210)
<PortfolioBuyAndHoldComparison
  comparison={comparison}
  buyAndHoldSummary={buyAndHoldSummary}
  etfBenchmark={etfBenchmark}  // NEW: Pass ETF benchmark
/>
```

### 6. Frontend: Buy & Hold Comparison Component

**File**: `frontend/src/components/PortfolioBuyAndHoldComparison.js`

**Current State**:
- Displays comparison table with DCA vs Buy & Hold metrics
- Shows portfolio value chart with two lines

**Target State**:
- Add third column for ETF benchmark metrics
- Add third line to chart for ETF benchmark
- Add toggle checkbox for ETF benchmark line

**Changes Required**:

**A. Comparison Table** (add ETF column):
```javascript
<table className="comparison-table">
  <thead>
    <tr>
      <th>Metric</th>
      <th>DCA Strategy</th>
      <th>Buy & Hold</th>
      <th>ETF Benchmark</th>  {/* NEW */}
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Final Value</td>
      <td>${dcaValue}</td>
      <td>${buyHoldValue}</td>
      <td>${etfBenchmark?.finalValue || 'N/A'}</td>  {/* NEW */}
    </tr>
    {/* ... more rows ... */}
  </tbody>
</table>
```

**B. Chart Enhancement** (add third line):
```javascript
const [showETFLine, setShowETFLine] = useState(true);  // NEW: Toggle state

// In chart data preparation
const chartData = {
  labels: dates,
  datasets: [
    {
      label: 'DCA Strategy',
      data: dcaValues,
      borderColor: 'rgb(75, 192, 192)',
      // ... existing config ...
    },
    {
      label: 'Buy & Hold',
      data: buyHoldValues,
      borderColor: 'rgb(54, 162, 235)',
      borderDash: [5, 5],
      // ... existing config ...
    },
    // NEW: ETF Benchmark line
    ...(etfBenchmark && showETFLine ? [{
      label: `${etfBenchmark.symbol} Benchmark`,
      data: etfBenchmark.dailyValues.map(d => d.value),
      borderColor: 'rgb(255, 159, 64)',  // Orange
      borderDash: [10, 5],
      fill: false,
      tension: 0.1
    }] : [])
  ]
};

// Add toggle checkbox
<label>
  <input
    type="checkbox"
    checked={showETFLine}
    onChange={(e) => setShowETFLine(e.target.checked)}
  />
  Show ETF Benchmark ({etfBenchmark?.symbol})
</label>
```

### 7. Frontend: Optimized Capital Results

**File**: `frontend/src/components/OptimizedCapitalResults.js`

**Current State**:
- Displays three scenario tabs (discovery, optimal, constrained)
- Passes each scenario to PortfolioResults component

**Target State**:
- Ensure `etfBenchmark` is passed through for each scenario
- ETF benchmark should use the same capital as each scenario

**Changes Required**:
```javascript
// No code changes needed - etfBenchmark is already part of scenario data
// Backend must calculate ETF benchmark for each scenario with appropriate capital

// Verification: Each scenario should have:
scenarios.discovery.etfBenchmark (uses discovery capital)
scenarios.optimal.etfBenchmark (uses optimal capital)
scenarios.constrained.etfBenchmark (uses constrained capital)
```

### 8. Portfolio Config Files

**Files**:
- `backend/configs/portfolios/nasdaq100.json`
- `backend/configs/portfolios/nasdaq100_beta_filtered.json`
- `backend/configs/portfolios/sp500.json` (to be created in this spec)
- `backend/configs/portfolios/sp500_beta_filtered.json` (to be created in this spec)

**Changes Required**:
```json
{
  "name": "NASDAQ-100",
  "benchmarkSymbol": "QQQ",  // NEW: Add benchmark
  "totalCapitalUsd": 3000000,
  // ... rest of config ...
}
```

## Data Flow Diagram

```
┌─────────────┐
│ Config File │
│  QQQ / SPY  │
└──────┬──────┘
       │
       ↓
┌──────────────────┐
│ Config Loader    │
│ Extract benchmark│
└──────┬───────────┘
       │
       ↓
┌───────────────────────┐
│ Portfolio Backtest    │
│ Service               │
│ ┌─────────────────┐   │
│ │ Run DCA         │   │
│ │ Calculate B&H   │   │
│ │ Calculate ETF   │←──│─── Fetch ETF prices
│ └─────────────────┘   │
└──────┬────────────────┘
       │
       ↓
┌───────────────────────┐
│ Results Object        │
│ {                     │
│   portfolioSummary,   │
│   buyAndHoldSummary,  │
│   etfBenchmark: {     │
│     symbol: "QQQ",    │
│     finalValue: ...,  │
│     dailyValues: [...] │
│   }                   │
│ }                     │
└──────┬────────────────┘
       │
       ↓
┌────────────────────────┐
│ Frontend Chart         │
│ ├─ DCA (blue)          │
│ ├─ Buy & Hold (green)  │
│ └─ QQQ (orange)        │
└────────────────────────┘
```

## Implementation Phases

### Phase 1: Backend ETF Benchmark Calculation (2-3 hours)

1. Add `calculateETFBenchmark()` function to portfolioBacktestService.js
2. Integrate ETF calculation into portfolio backtest flow
3. Update portfolioConfigLoader to extract and validate benchmarkSymbol
4. Test with QQQ and SPY

### Phase 2: Frontend Chart Enhancement (2-3 hours)

1. Update PortfolioBuyAndHoldComparison.js to handle ETF benchmark data
2. Add third line to chart (orange dashed)
3. Add toggle checkbox for ETF line
4. Test chart rendering with and without ETF data

### Phase 3: Frontend Comparison Display (1-2 hours)

1. Add ETF benchmark column to comparison table
2. Display ETF metrics (final value, return %, CAGR, etc.)
3. Add visual indicators for outperformance/underperformance
4. Handle cases where ETF data is missing

### Phase 4: Config File Updates (1 hour)

1. Add `"benchmarkSymbol": "QQQ"` to all NASDAQ-100 configs
2. Add `"benchmarkSymbol": "SPY"` to all S&P 500 configs
3. Create sp500.json config
4. Create sp500_beta_filtered.json config

### Phase 5: Multi-Scenario Support (1-2 hours)

1. Ensure ETF benchmark calculated for each scenario in optimized capital mode
2. Each scenario uses its own capital amount for ETF calculation
3. Test with optimized capital mode

### Phase 6: Testing & Documentation (1-2 hours)

1. Test NASDAQ-100 with QQQ benchmark
2. Test S&P 500 with SPY benchmark
3. Test backward compatibility (configs without benchmarkSymbol)
4. Update documentation
5. Create verification URLs

## Edge Cases & Error Handling

1. **Missing ETF Price Data**:
   - Log warning, continue without ETF benchmark
   - Display "N/A" in frontend
   - Don't fail the entire backtest

2. **Invalid Benchmark Symbol**:
   - Validate symbol format in config loader
   - Return error if symbol invalid
   - Suggest valid symbols (QQQ, SPY, etc.)

3. **Date Range Mismatch**:
   - ETF data must cover the same date range as portfolio
   - If ETF data incomplete, use available range and show warning

4. **No Benchmark Specified**:
   - Backward compatible - works without benchmarkSymbol
   - Frontend gracefully hides ETF column/line if data missing

## Testing Strategy

1. **Unit Tests** (if applicable):
   - Test `calculateETFBenchmark()` function with known data
   - Verify CAGR and return calculations

2. **Integration Tests**:
   - Test full portfolio backtest with QQQ benchmark
   - Test full portfolio backtest with SPY benchmark
   - Test without benchmark (backward compatibility)

3. **Manual Testing**:
   - Visual verification of chart with three lines
   - Verify ETF metrics match expected values
   - Test toggle functionality
   - Test in optimized capital mode (all scenarios)

## Success Metrics

- ETF benchmark appears in all portfolio backtests that specify benchmarkSymbol
- Chart correctly displays three lines with distinct colors
- Toggle checkbox works correctly
- Performance impact < 1 second per backtest
- Zero errors on existing configs without benchmarkSymbol
