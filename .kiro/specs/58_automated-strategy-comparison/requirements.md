# Spec 58: Automated Strategy Comparison Framework

## Problem Statement

To properly evaluate trading strategies, we need to compare performance across multiple approaches using identical conditions (same stocks, same timeframe, same capital).

**Current Gap**:
- No way to automatically compare DCA vs Buy-and-Hold
- No benchmark comparison against index performance
- Manual execution of multiple tests is error-prone
- Results not automatically saved for comparison
- No side-by-side visualization of strategy performance

## Business Requirements

### R1: Automated Three-Way Comparison
Automatically execute and compare three strategies:

**Strategy 1: Buy-and-Hold (Same Stocks)**
- Purchase same stocks as DCA strategy
- Buy once at backtest start date
- Hold until backtest end date
- No trading, no rebalancing

**Strategy 2: DCA Strategy (Dynamic Capital Utilization)**
- Execute full DCA strategy with grid trading
- Use Spec 57 capital utilization (mode: 'dynamic' or 'normalized')
- Apply all strategy parameters (grid interval, profit requirement, etc.)

**Strategy 3: Index Benchmark (Buy-and-Hold Index)**
- Buy-and-hold the underlying index itself (S&P 500, NASDAQ-100)
- Single purchase at start date
- Hold until end date
- Represents market baseline performance

### R2: Identical Testing Conditions
All three strategies must use:
- Same capital allocation
- Same date range
- Same stocks (for strategies 1 & 2)
- Same market data

### R3: Comprehensive Comparison Report
Generate report comparing:
- Total returns (absolute $)
- ROI percentages
- Annualized returns
- Maximum drawdown
- Sharpe ratio
- Win rate (for DCA strategy)
- Number of trades (for DCA strategy)
- Time in market
- Capital efficiency

### R4: Automated Archival
Using Spec 56 framework:
- Save all three test results
- Create comparison HTML report
- Archive in timestamped folder
- Include frontend URLs for each test
- Include curl commands for reproducibility

### R5: Configuration Interface
Simple config to trigger comparison:

```json
{
  "comparisonTest": {
    "stocks": ["PLTR", "TSLA", "NVDA"],  // or reference portfolio config
    "startDate": "2021-09-02",
    "endDate": "2025-10-30",
    "totalCapital": 150000,
    "indexBenchmark": "S&P-500",  // or "NASDAQ-100"

    "dcaStrategy": {
      "configFile": "sp500_high_beta",  // or inline config
      "capitalUtilization": {
        "mode": "normalized"
      }
    }
  }
}
```

## Functional Requirements

### FR1: Buy-and-Hold Strategy Implementation

#### FR1.1: Same Stocks Buy-and-Hold
**Algorithm**:
1. On start date, purchase equal-weighted positions in all stocks
2. Allocation: `totalCapital / numberOfStocks` per stock
3. Buy shares: `allocation / startPrice` (fractional shares allowed)
4. Hold all positions until end date
5. Calculate final value: `sum(shares * endPrice)` for all stocks

**Constraints**:
- No rebalancing during holding period
- No trading fees (for fair comparison)
- Survivor bias: Only include stocks that existed on start date

#### FR1.2: Index Buy-and-Hold
**Algorithm**:
1. On start date, purchase index at opening price
2. Investment: `totalCapital` worth of index
3. Hold until end date
4. Calculate final value: `totalCapital * (endIndexPrice / startIndexPrice)`

**Data Requirements**:
- Need historical index price data (S&P 500, NASDAQ-100)
- Use same data source as stock beta calculations (Yahoo Finance)
- Handle index symbol correctly (e.g., ^GSPC for S&P 500, ^NDX for NASDAQ-100)

### FR2: DCA Strategy Execution
Use existing portfolio backtest infrastructure:
- Load portfolio config
- Apply Spec 57 capital utilization (if configured)
- Execute full backtest
- Capture all results

### FR3: Comparison Metrics Calculation

Calculate for each strategy:

```javascript
{
  "strategy": "Buy-and-Hold (Same Stocks)" | "DCA Strategy" | "Index Benchmark",

  // Core Metrics
  "initialCapital": 150000,
  "finalValue": 189500,
  "totalReturn": 39500,
  "totalROI": 26.33,
  "annualizedROI": 6.15,

  // Risk Metrics
  "maxDrawdown": -18.5,
  "sharpeRatio": 0.85,
  "volatility": 15.2,

  // Trading Metrics (DCA only)
  "numberOfTrades": 342,
  "winRate": 68.5,
  "avgHoldingPeriod": 45,  // days

  // Capital Efficiency (DCA only)
  "avgCapitalUtilization": 95.2,
  "maxCapitalUsed": 148000,

  // Time Metrics
  "startDate": "2021-09-02",
  "endDate": "2025-10-30",
  "durationDays": 1520,
  "durationYears": 4.16
}
```

### FR4: Comparison Report Generation

Generate HTML report with:

**Summary Table**:
| Metric | Buy-and-Hold (Stocks) | DCA Strategy | Index Benchmark | Best Strategy |
|--------|----------------------|--------------|-----------------|---------------|
| Total ROI | 26.3% | 53.7% | 22.1% | **DCA** |
| Annual ROI | 6.1% | 13.4% | 5.2% | **DCA** |
| Max Drawdown | -18.5% | -12.3% | -20.1% | **DCA** |
| Sharpe Ratio | 0.85 | 1.15 | 0.72 | **DCA** |

**Visual Charts**:
1. Equity curve comparison (all three on same chart)
2. Returns distribution
3. Drawdown comparison
4. Monthly returns heatmap

**Key Insights**:
- Which strategy performed best
- Risk-adjusted performance (Sharpe ratio)
- DCA outperformance vs index
- Capital efficiency gains

### FR5: Integration with Spec 56
Extend Spec 56 automation to handle comparison tests:
- New test type: "strategy_comparison"
- Archive all three results in single folder
- Generate comparison HTML report
- Save individual frontend URLs
- Save comparison curl command

## Technical Requirements

### TR1: Buy-and-Hold Service
Create `backend/services/buyAndHoldService.js`:

```javascript
class BuyAndHoldService {
  /**
   * Execute buy-and-hold backtest for given stocks
   */
  async executeBuyAndHold(stocks, startDate, endDate, totalCapital) {
    // Equal-weight allocation
    const capitalPerStock = totalCapital / stocks.length;

    // Buy on start date
    const positions = await Promise.all(
      stocks.map(symbol => this.buyStock(symbol, startDate, capitalPerStock))
    );

    // Calculate final value on end date
    const finalValue = await this.calculateFinalValue(positions, endDate);

    return {
      strategy: 'Buy-and-Hold (Same Stocks)',
      positions,
      initialCapital: totalCapital,
      finalValue,
      totalReturn: finalValue - totalCapital,
      totalROI: ((finalValue - totalCapital) / totalCapital) * 100
    };
  }

  /**
   * Execute buy-and-hold for index
   */
  async executeIndexBuyAndHold(indexSymbol, startDate, endDate, totalCapital) {
    const startPrice = await this.getIndexPrice(indexSymbol, startDate);
    const endPrice = await this.getIndexPrice(indexSymbol, endDate);

    const priceMultiple = endPrice / startPrice;
    const finalValue = totalCapital * priceMultiple;

    return {
      strategy: 'Index Benchmark',
      indexSymbol,
      startPrice,
      endPrice,
      initialCapital: totalCapital,
      finalValue,
      totalReturn: finalValue - totalCapital,
      totalROI: ((finalValue - totalCapital) / totalCapital) * 100
    };
  }
}
```

### TR2: Strategy Comparison Service
Create `backend/services/strategyComparisonService.js`:

```javascript
class StrategyComparisonService {
  async executeComparison(config) {
    console.log('🔄 Executing Strategy Comparison...\n');

    // Execute all three strategies
    const [buyHoldResult, dcaResult, indexResult] = await Promise.all([
      this.executeBuyAndHoldStocks(config),
      this.executeDCAStrategy(config),
      this.executeIndexBenchmark(config)
    ]);

    // Calculate comparison metrics
    const comparison = this.calculateComparison([
      buyHoldResult,
      dcaResult,
      indexResult
    ]);

    // Identify best strategy
    const bestStrategy = this.identifyBestStrategy(comparison);

    return {
      success: true,
      data: {
        buyAndHoldStocks: buyHoldResult,
        dcaStrategy: dcaResult,
        indexBenchmark: indexResult,
        comparison,
        bestStrategy
      }
    };
  }
}
```

### TR3: API Endpoints

**POST /api/backtest/comparison**
Execute strategy comparison:

Request:
```json
{
  "stocks": ["PLTR", "TSLA", "NVDA"],
  "startDate": "2021-09-02",
  "endDate": "2025-10-30",
  "totalCapital": 150000,
  "indexBenchmark": "S&P-500",
  "dcaConfigFile": "sp500_high_beta"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "buyAndHoldStocks": { /* metrics */ },
    "dcaStrategy": { /* metrics */ },
    "indexBenchmark": { /* metrics */ },
    "comparison": {
      "summary": [ /* comparison table */ ],
      "bestStrategy": "DCA Strategy",
      "dcaOutperformance": {
        "vsStocks": "+27.4%",
        "vsIndex": "+31.6%"
      }
    }
  }
}
```

### TR4: Index Price Data Integration
Extend Yahoo Finance integration:
- Fetch historical index prices
- Cache index data
- Handle index symbols (^GSPC, ^NDX, ^IXIC)
- Add index data to database (optional)

### TR5: Frontend Comparison Page
Create new route: `/strategy-comparison?test=<test_id>`

Display:
- Three strategy results side-by-side
- Comparison table
- Equity curve chart
- Key insights summary
- Links to individual detailed results

## Edge Cases

### EC1: Stock Missing on Start Date
If a stock didn't exist on start date:
- Exclude from buy-and-hold strategy
- Adjust capital allocation for remaining stocks
- Note exclusion in report

### EC2: Stock Delisted During Period
Buy-and-hold:
- Position value goes to zero on delisting date
- Report delisting in results

DCA:
- Handled by existing index tracking service

### EC3: Index Data Unavailable
If index historical data missing:
- Skip index benchmark test
- Proceed with other two strategies
- Note limitation in report

### EC4: Different Date Ranges
If DCA config has different dates than comparison config:
- Override with comparison config dates
- Warn user about override
- Use consistent dates for fair comparison

## Success Criteria

1. ✅ All three strategies execute successfully
2. ✅ Results are reproducible (same inputs = same outputs)
3. ✅ Comparison report clearly shows best strategy
4. ✅ Visual charts aid in understanding performance
5. ✅ Archived results can be re-loaded and viewed
6. ✅ Execution time < 5 minutes for typical portfolio
7. ✅ No errors with survivor bias or missing data

## Non-Goals

- Real-time strategy execution (backtest only)
- More than 3 strategy comparison (keep it focused)
- Machine learning strategy recommendations
- Automated parameter optimization
- Live trading integration

## Dependencies

- Spec 56: Test automation and archival
- Spec 57: Capital utilization (for DCA strategy)
- Existing portfolio backtest infrastructure
- Index price data source (Yahoo Finance)
- Chart library (for visualization)

## Testing Strategy

1. **Unit Tests**: Individual strategy execution, metrics calculation
2. **Integration Tests**: Full comparison flow
3. **Comparison Tests**: Validate metrics accuracy against manual calculations
4. **Edge Case Tests**: Missing stocks, delistings, data gaps
5. **Performance Tests**: Ensure execution time acceptable

## Documentation

- API documentation for comparison endpoint
- User guide for running comparisons
- Interpretation guide for results
- Example comparison reports
- Frontend usage instructions
