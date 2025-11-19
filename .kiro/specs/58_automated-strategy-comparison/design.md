# Spec 58: Automated Strategy Comparison - Design Document

## System Architecture

```
┌────────────────────────────────────────────────────────────┐
│              Strategy Comparison Orchestrator               │
│                                                             │
│  Input: stocks[], dates, capital, indexName                │
│                           │                                 │
│         ┌─────────────────┼─────────────────┐              │
│         ▼                 ▼                 ▼              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Buy & Hold │  │ DCA Strategy │  │ Index B&H  │       │
│  │   Service   │  │   Service    │  │  Service   │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
│         │                 │                 │              │
│         └─────────────────┼─────────────────┘              │
│                           ▼                                 │
│              ┌─────────────────────────┐                   │
│              │ Metrics Calculator      │                   │
│              │ & Comparison Generator  │                   │
│              └─────────────────────────┘                   │
│                           │                                 │
│         ┌─────────────────┼─────────────────┐              │
│         ▼                 ▼                 ▼              │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐         │
│   │  JSON    │     │   HTML   │     │ Archive  │         │
│   │ Response │     │  Report  │     │  (Spec56)│         │
│   └──────────┘     └──────────┘     └──────────┘         │
└────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Buy-and-Hold Service

**File**: `backend/services/buyAndHoldService.js`

```javascript
const yahooFinance = require('yahoo-finance2').default;

class BuyAndHoldService {
  /**
   * Execute buy-and-hold for stocks
   */
  async executeBuyAndHoldStocks(stocks, startDate, endDate, totalCapital) {
    const capitalPerStock = totalCapital / stocks.length;
    const positions = [];

    for (const symbol of stocks) {
      try {
        // Get start and end prices
        const historical = await yahooFinance.historical(symbol, {
          period1: startDate,
          period2: endDate,
          interval: '1d'
        });

        const startPrice = historical[0]?.close;
        const endPrice = historical[historical.length - 1]?.close;

        if (!startPrice || !endPrice) {
          console.warn(`Skipping ${symbol} - missing price data`);
          continue;
        }

        const shares = capitalPerStock / startPrice;
        const startValue = capitalPerStock;
        const endValue = shares * endPrice;
        const returnPct = ((endValue - startValue) / startValue) * 100;

        positions.push({
          symbol,
          shares,
          startPrice,
          endPrice,
          startValue,
          endValue,
          return: endValue - startValue,
          returnPct
        });
      } catch (error) {
        console.error(`Error processing ${symbol}:`, error.message);
      }
    }

    const finalValue = positions.reduce((sum, p) => sum + p.endValue, 0);
    const actualCapital = positions.reduce((sum, p) => sum + p.startValue, 0);

    return {
      strategy: 'Buy-and-Hold (Same Stocks)',
      positions,
      initialCapital: actualCapital,
      finalValue,
      totalReturn: finalValue - actualCapital,
      totalROI: ((finalValue - actualCapital) / actualCapital) * 100
    };
  }

  /**
   * Execute buy-and-hold for index
   */
  async executeIndexBuyAndHold(indexSymbol, startDate, endDate, totalCapital) {
    // Map friendly names to Yahoo Finance symbols
    const indexMapping = {
      'S&P-500': '^GSPC',
      'SP500': '^GSPC',
      'NASDAQ-100': '^NDX',
      'NASDAQ100': '^NDX',
      'NASDAQ': '^IXIC'
    };

    const yahooSymbol = indexMapping[indexSymbol] || indexSymbol;

    const historical = await yahooFinance.historical(yahooSymbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d'
    });

    const startPrice = historical[0]?.close;
    const endPrice = historical[historical.length - 1]?.close;

    if (!startPrice || !endPrice) {
      throw new Error(`Missing price data for index ${indexSymbol}`);
    }

    const priceMultiple = endPrice / startPrice;
    const finalValue = totalCapital * priceMultiple;

    return {
      strategy: 'Index Benchmark',
      indexName: indexSymbol,
      indexSymbol: yahooSymbol,
      startPrice,
      endPrice,
      priceMultiple,
      initialCapital: totalCapital,
      finalValue,
      totalReturn: finalValue - totalCapital,
      totalROI: ((finalValue - totalCapital) / totalCapital) * 100
    };
  }
}

module.exports = BuyAndHoldService;
```

### 2. Strategy Comparison Service

**File**: `backend/services/strategyComparisonService.js`

```javascript
const BuyAndHoldService = require('./buyAndHoldService');
const PortfolioBacktestService = require('./portfolioBacktestService');

class StrategyComparisonService {
  constructor() {
    this.buyAndHoldService = new BuyAndHoldService();
    this.portfolioService = new PortfolioBacktestService();
  }

  async executeComparison(config) {
    console.log('\n🔄 Executing Strategy Comparison...\n');

    const {
      stocks,
      startDate,
      endDate,
      totalCapital,
      indexBenchmark,
      dcaConfigFile
    } = config;

    // Execute all three strategies in parallel
    const [buyHoldStocks, dcaStrategy, indexBenchmark] = await Promise.all([
      this.executeBuyAndHoldStocks(stocks, startDate, endDate, totalCapital),
      this.executeDCAStrategy(dcaConfigFile),
      this.executeIndexBenchmark(indexBenchmark, startDate, endDate, totalCapital)
    ]);

    // Calculate enhanced metrics for all strategies
    const buyHoldMetrics = this.calculateMetrics(buyHoldStocks, startDate, endDate);
    const dcaMetrics = this.extractDCAMetrics(dcaStrategy);
    const indexMetrics = this.calculateMetrics(indexBenchmark, startDate, endDate);

    // Generate comparison
    const comparison = this.generateComparison({
      buyHoldStocks: buyHoldMetrics,
      dcaStrategy: dcaMetrics,
      indexBenchmark: indexMetrics
    });

    return {
      success: true,
      data: {
        buyAndHoldStocks: buyHoldMetrics,
        dcaStrategy: dcaMetrics,
        indexBenchmark: indexMetrics,
        comparison
      }
    };
  }

  async executeBuyAndHoldStocks(stocks, startDate, endDate, totalCapital) {
    console.log('📈 Running Buy-and-Hold (Same Stocks)...');
    return await this.buyAndHoldService.executeBuyAndHoldStocks(
      stocks,
      startDate,
      endDate,
      totalCapital
    );
  }

  async executeDCAStrategy(configFile) {
    console.log('📊 Running DCA Strategy...');
    return await this.portfolioService.executePortfolioBacktest({ configFile });
  }

  async executeIndexBenchmark(indexName, startDate, endDate, totalCapital) {
    console.log('🏁 Running Index Benchmark...');
    return await this.buyAndHoldService.executeIndexBuyAndHold(
      indexName,
      startDate,
      endDate,
      totalCapital
    );
  }

  calculateMetrics(strategyResult, startDate, endDate) {
    const years = (new Date(endDate) - new Date(startDate)) / (365.25 * 24 * 60 * 60 * 1000);
    const annualizedROI = (Math.pow(
      strategyResult.finalValue / strategyResult.initialCapital,
      1 / years
    ) - 1) * 100;

    return {
      ...strategyResult,
      annualizedROI: parseFloat(annualizedROI.toFixed(2)),
      years: parseFloat(years.toFixed(2))
    };
  }

  extractDCAMetrics(dcaResult) {
    const summary = dcaResult.data.summary;

    return {
      strategy: 'DCA Strategy',
      initialCapital: summary.totalCapital,
      effectiveCapital: summary.effectiveCapital || summary.totalCapital,
      finalValue: summary.totalValue,
      totalReturn: summary.totalRealizedPnl,
      totalROI: summary.totalRoi,
      annualizedROI: summary.annualRoi,
      trades: summary.totalTrades,
      winRate: summary.winRate,
      maxCapitalUtilization: summary.maxCapitalUtilized,
      avgCapitalUtilization: summary.avgCapitalUtilization
    };
  }

  generateComparison(strategies) {
    const { buyHoldStocks, dcaStrategy, indexBenchmark } = strategies;

    // Find best strategy by ROI
    const allStrategies = [
      { name: 'Buy-and-Hold (Stocks)', roi: buyHoldStocks.totalROI },
      { name: 'DCA Strategy', roi: dcaStrategy.totalROI },
      { name: 'Index Benchmark', roi: indexBenchmark.totalROI }
    ];

    const bestStrategy = allStrategies.reduce((best, current) =>
      current.roi > best.roi ? current : best
    );

    // Calculate outperformance
    const dcaVsStocks = dcaStrategy.totalROI - buyHoldStocks.totalROI;
    const dcaVsIndex = dcaStrategy.totalROI - indexBenchmark.totalROI;

    return {
      summary: {
        bestStrategy: bestStrategy.name,
        bestROI: bestStrategy.roi
      },
      dcaOutperformance: {
        vsStocks: `${dcaVsStocks > 0 ? '+' : ''}${dcaVsStocks.toFixed(2)}%`,
        vsIndex: `${dcaVsIndex > 0 ? '+' : ''}${dcaVsIndex.toFixed(2)}%`
      },
      comparisonTable: [
        {
          metric: 'Total ROI',
          buyHoldStocks: `${buyHoldStocks.totalROI.toFixed(2)}%`,
          dcaStrategy: `${dcaStrategy.totalROI.toFixed(2)}%`,
          indexBenchmark: `${indexBenchmark.totalROI.toFixed(2)}%`,
          best: bestStrategy.name
        },
        {
          metric: 'Annualized ROI',
          buyHoldStocks: `${buyHoldStocks.annualizedROI.toFixed(2)}%`,
          dcaStrategy: `${dcaStrategy.annualizedROI.toFixed(2)}%`,
          indexBenchmark: `${indexBenchmark.annualizedROI.toFixed(2)}%`
        },
        {
          metric: 'Total Return',
          buyHoldStocks: `$${buyHoldStocks.totalReturn.toFixed(0)}`,
          dcaStrategy: `$${dcaStrategy.totalReturn.toFixed(0)}`,
          indexBenchmark: `$${indexBenchmark.totalReturn.toFixed(0)}`
        }
      ]
    };
  }
}

module.exports = StrategyComparisonService;
```

### 3. API Route

**File**: `backend/routes/comparisonRoutes.js`

```javascript
const express = require('express');
const StrategyComparisonService = require('../services/strategyComparisonService');

const router = express.Router();
const comparisonService = new StrategyComparisonService();

router.post('/comparison', async (req, res) => {
  try {
    const result = await comparisonService.executeComparison(req.body);
    res.json(result);
  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
```

### 4. Spec 56 Integration

**Extend**: `scripts/test-automation/run_portfolio_test.py`

Add comparison support:

```python
def run_comparison_test(config_name, description):
    """Run strategy comparison test."""
    print(f"🔄 Running Strategy Comparison: {config_name}")

    # Execute comparison
    api_response = requests.post(
        f"{BACKEND_URL}/api/backtest/comparison",
        json={"dcaConfigFile": config_name}
    )

    # Create archive
    archive_path = create_archive_folder(description)

    # Save all three strategy results
    save_strategy_result(archive_path, "buy-and-hold-stocks", api_response["buyAndHoldStocks"])
    save_strategy_result(archive_path, "dca-strategy", api_response["dcaStrategy"])
    save_strategy_result(archive_path, "index-benchmark", api_response["indexBenchmark"])

    # Generate comparison HTML
    generate_comparison_html(archive_path, api_response)

    print(f"✅ Comparison complete: {archive_path}")
```

### 5. Frontend Component

**File**: `frontend/src/components/StrategyComparisonPage.js`

```javascript
function StrategyComparisonPage() {
  const [results, setResults] = useState(null);

  return (
    <div className="strategy-comparison">
      <h1>Strategy Comparison Results</h1>

      <ComparisonSummary summary={results?.comparison} />

      <ComparisonTable data={results?.comparison?.comparisonTable} />

      <EquityCurveChart
        buyHoldStocks={results?.buyAndHoldStocks}
        dcaStrategy={results?.dcaStrategy}
        indexBenchmark={results?.indexBenchmark}
      />

      <div className="individual-results">
        <StrategyCard strategy={results?.buyAndHoldStocks} />
        <StrategyCard strategy={results?.dcaStrategy} />
        <StrategyCard strategy={results?.indexBenchmark} />
      </div>
    </div>
  );
}
```

## Data Flow

1. User triggers comparison via API or frontend
2. StrategyComparisonService orchestrates three parallel executions
3. Each strategy service returns standardized results
4. Metrics calculator normalizes all metrics
5. Comparison generator creates comparison table and insights
6. Results returned as JSON and archived via Spec 56
7. Frontend displays side-by-side comparison

## Performance Considerations

- **Parallel Execution**: Run all 3 strategies concurrently using `Promise.all()`
- **Data Caching**: Cache Yahoo Finance API calls
- **Estimated Time**: 2-5 minutes total for typical portfolio
- **Memory Usage**: ~100MB for full comparison

## Error Handling

```javascript
try {
  const results = await Promise.allSettled([
    executeBuyHold(),
    executeDCA(),
    executeIndex()
  ]);

  // Handle partial failures
  const successful = results.filter(r => r.status === 'fulfilled');
  if (successful.length < 2) {
    throw new Error('Insufficient strategy results for comparison');
  }

  return generatePartialComparison(successful);
} catch (error) {
  return {
    success: false,
    error: error.message,
    partialResults: /* any successful strategies */
  };
}
```
