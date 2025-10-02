# Design Document

## Overview

The algorithm performance calculation system will enhance the existing DCA backtesting platform with comprehensive performance metrics that accurately handle variable capital deployment. The design focuses on creating a modular performance calculation service that can be integrated into both individual backtests and batch optimization workflows.

## Architecture

### Core Components

1. **PerformanceCalculatorService** - Main service for computing all performance metrics
2. **CapitalDeploymentTracker** - Tracks and analyzes capital deployment patterns over time
3. **RiskMetricsCalculator** - Specialized calculator for risk-adjusted metrics (Sharpe, Sortino, etc.)
4. **OpportunityCostAnalyzer** - Calculates opportunity costs of idle capital
5. **PerformanceRenderer** - UI components for displaying metrics in various contexts

### Integration Points

- **dcaBacktestService.js** - Enhanced to collect additional data points and call performance calculator
- **batchBacktestService.js** - Modified to include performance metrics in batch results
- **Frontend Components** - New and updated components for displaying performance data

## Components and Interfaces

### PerformanceCalculatorService

```javascript
class PerformanceCalculatorService {
  constructor(riskFreeRate = 0.04) {
    this.riskFreeRate = riskFreeRate;
    this.capitalTracker = new CapitalDeploymentTracker();
    this.riskCalculator = new RiskMetricsCalculator();
    this.opportunityAnalyzer = new OpportunityCostAnalyzer();
  }

  calculateComprehensiveMetrics(backtestData) {
    return {
      // Core Performance
      totalReturn: this.calculateTotalReturn(backtestData),
      cagr: this.calculateCAGR(backtestData),
      returnOnMaxDeployed: this.calculateReturnOnMaxDeployed(backtestData),
      returnOnAvgDeployed: this.calculateReturnOnAvgDeployed(backtestData),

      // Risk-Adjusted Metrics
      sharpeRatio: this.riskCalculator.calculateSharpe(backtestData, this.riskFreeRate),
      sortinoRatio: this.riskCalculator.calculateSortino(backtestData, this.riskFreeRate),
      calmarRatio: this.riskCalculator.calculateCalmar(backtestData),

      // Drawdown Analysis
      maxDrawdown: this.calculateMaxDrawdown(backtestData),
      avgDrawdown: this.calculateAvgDrawdown(backtestData),
      drawdownDuration: this.calculateDrawdownDuration(backtestData),

      // Trading Efficiency
      winRate: this.calculateWinRate(backtestData),
      profitFactor: this.calculateProfitFactor(backtestData),
      expectancy: this.calculateExpectancy(backtestData),
      avgHoldingPeriod: this.calculateAvgHoldingPeriod(backtestData),
      profitPerDayHeld: this.calculateProfitPerDayHeld(backtestData),

      // Time-Weighted Analysis
      timeWeightedReturn: this.calculateTimeWeightedReturn(backtestData),
      moneyWeightedReturn: this.calculateMoneyWeightedReturn(backtestData),

      // Opportunity Cost
      opportunityCost: this.opportunityAnalyzer.calculate(backtestData, this.riskFreeRate),
      opportunityCostAdjustedReturn: this.calculateOpportunityCostAdjustedReturn(backtestData),

      // Capital Efficiency
      capitalUtilization: this.capitalTracker.calculateUtilization(backtestData),
      avgDeployedCapital: this.capitalTracker.calculateAvgDeployed(backtestData),
      maxDeployedCapital: this.capitalTracker.calculateMaxDeployed(backtestData),

      // Benchmark Comparison (if benchmark data available)
      alpha: this.calculateAlpha(backtestData),
      beta: this.calculateBeta(backtestData),
      informationRatio: this.calculateInformationRatio(backtestData),
    };
  }
}
```

### CapitalDeploymentTracker

```javascript
class CapitalDeploymentTracker {
  analyzeDeploymentPattern(dailyCapitalDeployed) {
    return {
      deploymentEvents: this.identifyDeploymentEvents(dailyCapitalDeployed),
      avgDeployed: this.calculateAverage(dailyCapitalDeployed),
      maxDeployed: Math.max(...dailyCapitalDeployed),
      utilizationRate: this.calculateUtilizationRate(dailyCapitalDeployed),
      deploymentTimeline: this.createTimeline(dailyCapitalDeployed),
    };
  }

  calculateTimeWeightedCapital(dailyCapitalDeployed, dailyReturns) {
    // Weight returns by capital deployed at each period
    let weightedReturn = 0;
    let totalWeight = 0;

    for (let i = 0; i < dailyCapitalDeployed.length; i++) {
      const deployed = dailyCapitalDeployed[i];
      if (deployed > 0 && dailyReturns[i] !== undefined) {
        weightedReturn += dailyReturns[i] * deployed;
        totalWeight += deployed;
      }
    }

    return totalWeight > 0 ? weightedReturn / totalWeight : 0;
  }
}
```

### RiskMetricsCalculator

```javascript
class RiskMetricsCalculator {
  calculateSharpe(backtestData, riskFreeRate) {
    const dailyReturns = this.calculateDailyReturns(backtestData.dailyPortfolioValues);
    const excessReturns = dailyReturns.map(r => r - riskFreeRate / 252);
    const avgExcessReturn = this.mean(excessReturns);
    const stdDev = this.standardDeviation(excessReturns);

    return stdDev > 0 ? (avgExcessReturn / stdDev) * Math.sqrt(252) : 0;
  }

  calculateSortino(backtestData, riskFreeRate) {
    const dailyReturns = this.calculateDailyReturns(backtestData.dailyPortfolioValues);
    const excessReturns = dailyReturns.map(r => r - riskFreeRate / 252);
    const avgExcessReturn = this.mean(excessReturns);

    // Only consider negative returns for downside deviation
    const downsideReturns = excessReturns.filter(r => r < 0);
    const downsideDeviation = this.standardDeviation(downsideReturns);

    return downsideDeviation > 0 ? (avgExcessReturn / downsideDeviation) * Math.sqrt(252) : 0;
  }

  calculateMaxDrawdown(portfolioValues) {
    let maxDrawdown = 0;
    let peak = portfolioValues[0];

    for (let i = 1; i < portfolioValues.length; i++) {
      if (portfolioValues[i] > peak) {
        peak = portfolioValues[i];
      } else {
        const drawdown = (peak - portfolioValues[i]) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }

    return maxDrawdown;
  }
}
```

### OpportunityCostAnalyzer

```javascript
class OpportunityCostAnalyzer {
  calculate(backtestData, riskFreeRate) {
    const { dailyCapitalDeployed, maxExposure } = backtestData;
    const dailyRiskFreeRate = riskFreeRate / 252;

    let totalOpportunityCost = 0;

    for (let i = 0; i < dailyCapitalDeployed.length; i++) {
      const deployed = dailyCapitalDeployed[i];
      const idle = maxExposure - deployed;

      if (idle > 0) {
        totalOpportunityCost += idle * dailyRiskFreeRate;
      }
    }

    return {
      totalOpportunityCost,
      avgIdleCapital: this.calculateAvgIdle(dailyCapitalDeployed, maxExposure),
      opportunityLoss: totalOpportunityCost,
      adjustedReturn: this.calculateAdjustedReturn(backtestData, totalOpportunityCost),
    };
  }
}
```

## Data Models

### Enhanced Backtest Result Structure

```javascript
const enhancedBacktestResult = {
  // Existing fields
  symbol: 'AAPL',
  totalPL: 15000,
  totalPLPercent: 30.5,
  trades: [...],

  // New performance data
  performanceMetrics: {
    // Core Performance
    totalReturn: 0.305,
    cagr: 0.087,
    returnOnMaxDeployed: 0.30,
    returnOnAvgDeployed: 0.42,

    // Risk Metrics
    sharpeRatio: 1.45,
    sortinoRatio: 1.89,
    calmarRatio: 2.1,
    maxDrawdown: 0.15,
    avgDrawdown: 0.05,

    // Trading Metrics
    winRate: 0.68,
    profitFactor: 2.3,
    expectancy: 245.50,
    avgHoldingPeriod: 45,
    profitPerDayHeld: 8.75,

    // Capital Metrics
    capitalUtilization: 0.65,
    avgDeployedCapital: 32500,
    maxDeployedCapital: 50000,
    opportunityCost: 1250,

    // Time-Weighted
    timeWeightedReturn: 0.28,
    moneyWeightedReturn: 0.31
  },

  // Enhanced daily tracking
  dailyMetrics: {
    portfolioValues: [...],
    capitalDeployed: [...],
    drawdowns: [...],
    rollingReturns: [...]
  }
};
```

### Batch Results Enhancement

```javascript
const enhancedBatchResult = {
  results: [
    {
      // Existing batch result fields
      symbol: 'AAPL',
      params: {...},
      totalPL: 15000,

      // Key performance metrics for table display
      sharpeRatio: 1.45,
      maxDrawdown: 0.15,
      winRate: 0.68,
      cagr: 0.087,
      calmarRatio: 2.1,

      // Full metrics available on demand
      fullMetrics: {...}
    }
  ],

  // Batch-level analysis
  batchAnalysis: {
    bestSharpe: { symbol: 'AAPL', value: 1.45 },
    lowestDrawdown: { symbol: 'MSFT', value: 0.08 },
    highestWinRate: { symbol: 'GOOGL', value: 0.72 },
    correlationMatrix: {...}
  }
};
```

## Error Handling

### Input Validation

```javascript
class PerformanceValidator {
  validateBacktestData(data) {
    const errors = [];

    if (!data.dailyPortfolioValues || data.dailyPortfolioValues.length === 0) {
      errors.push('Daily portfolio values are required');
    }

    if (!data.dailyCapitalDeployed || data.dailyCapitalDeployed.length === 0) {
      errors.push('Daily capital deployed data is required');
    }

    if (data.dailyPortfolioValues.length !== data.dailyCapitalDeployed.length) {
      errors.push('Portfolio values and capital deployed arrays must have same length');
    }

    if (data.trades && data.trades.some(t => !t.entryDate || !t.exitDate)) {
      errors.push('All trades must have entry and exit dates');
    }

    return errors;
  }
}
```

### Graceful Degradation

- If benchmark data is unavailable, skip Alpha/Beta calculations
- If insufficient data for rolling metrics, use available data with warnings
- If risk-free rate is not provided, use default 4% with notification
- Handle division by zero in ratio calculations

## Testing Strategy

### Unit Tests

1. **Metric Calculation Tests**
   - Test each performance metric with known input/output pairs
   - Verify edge cases (zero returns, negative returns, single trade)
   - Test mathematical accuracy against financial libraries

2. **Capital Deployment Tests**
   - Test time-weighted return calculations with various deployment patterns
   - Verify opportunity cost calculations
   - Test capital utilization metrics

3. **Risk Metric Tests**
   - Verify Sharpe ratio calculations against standard formulas
   - Test drawdown calculations with synthetic data
   - Validate Sortino ratio with asymmetric return distributions

### Integration Tests

1. **Service Integration**
   - Test performance calculator with real backtest data
   - Verify integration with existing dcaBacktestService
   - Test batch processing with performance metrics

2. **UI Integration**
   - Test metric display in individual results
   - Verify batch table sorting and filtering
   - Test export functionality with new metrics

### Performance Tests

1. **Calculation Speed**
   - Benchmark metric calculations with large datasets
   - Test batch processing performance impact
   - Optimize calculation algorithms if needed

2. **Memory Usage**
   - Monitor memory usage with daily data arrays
   - Test garbage collection with large batch runs
   - Optimize data structures if needed

## UI Design Specifications

### Individual Backtest Results

```javascript
// Performance Summary Card
const PerformanceSummary = {
  layout: 'grid-2-columns',
  sections: [
    {
      title: 'Returns',
      metrics: [
        { label: 'Total Return', value: '30.5%', color: 'green' },
        { label: 'CAGR', value: '8.7%', color: 'blue' },
        { label: 'Return on Deployed', value: '42.1%', color: 'green' },
      ],
    },
    {
      title: 'Risk Metrics',
      metrics: [
        { label: 'Sharpe Ratio', value: '1.45', color: 'green' },
        { label: 'Max Drawdown', value: '15.2%', color: 'orange' },
        { label: 'Win Rate', value: '68%', color: 'green' },
      ],
    },
  ],
};
```

### Batch Results Table

```javascript
// Enhanced batch table columns
const batchTableColumns = [
  { key: 'symbol', label: 'Symbol', sortable: true },
  { key: 'totalPL', label: 'Total P/L', sortable: true, format: 'currency' },
  { key: 'sharpeRatio', label: 'Sharpe', sortable: true, format: 'decimal', colorCode: true },
  { key: 'maxDrawdown', label: 'Max DD', sortable: true, format: 'percentage', colorCode: true },
  { key: 'winRate', label: 'Win Rate', sortable: true, format: 'percentage' },
  { key: 'cagr', label: 'CAGR', sortable: true, format: 'percentage' },
  { key: 'calmarRatio', label: 'Calmar', sortable: true, format: 'decimal' },
];

// Color coding rules
const colorRules = {
  sharpeRatio: { good: '>1.0', excellent: '>2.0' },
  maxDrawdown: { good: '<10%', warning: '>20%' },
  winRate: { good: '>60%', excellent: '>70%' },
};
```

### Performance Charts

1. **Equity Curve with Drawdown**
   - Main chart: Portfolio value over time
   - Secondary chart: Drawdown periods highlighted
   - Capital deployment overlay

2. **Rolling Performance Metrics**
   - Rolling Sharpe ratio over time
   - Rolling returns vs benchmark
   - Capital utilization timeline

3. **Risk-Return Scatter Plot**
   - For batch results: Risk (drawdown) vs Return
   - Bubble size represents capital efficiency
   - Color coding by Sharpe ratio
