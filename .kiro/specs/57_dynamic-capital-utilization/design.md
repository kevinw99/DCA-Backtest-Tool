# Spec 57: Dynamic Capital Utilization - Design Document

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                Portfolio Backtest Service                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Capital Utilization Manager                   │  │
│  │                                                        │  │
│  │  • Track capital usage per stock                      │  │
│  │  • Calculate unused capital                           │  │
│  │  • Execute reallocation (Mode 1)                      │  │
│  │  • Track peak usage (Mode 2)                          │  │
│  │  • Calculate dual metrics                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Daily Trading Loop                            │  │
│  │                                                        │  │
│  │  For each trading day:                                │  │
│  │   1. Execute regular DCA logic                        │  │
│  │   2. Track capital allocation                         │  │
│  │   3. [Mode 1] Reallocate unused capital               │  │
│  │   4. [Mode 2] Update peak capital                     │  │
│  │   5. Update metrics                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Metrics Calculator                            │  │
│  │                                                        │  │
│  │  • Calculate configured capital metrics               │  │
│  │  • Calculate effective capital metrics                │  │
│  │  • Compute capital efficiency                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Configuration Schema

```javascript
// Portfolio config addition
{
  "capitalUtilization": {
    "mode": "off" | "dynamic" | "normalized",
    "minReallocationThreshold": 1000,  // Min unused $ to trigger reallocation
    "reallocationFrequency": "daily",  // How often to reallocate
    "preserveDeferredSelling": true    // Use original capital for deferred selling
  }
}
```

### 2. Capital Utilization Manager

**Location**: `backend/services/capitalUtilizationManager.js`

```javascript
class CapitalUtilizationManager {
  constructor(config) {
    this.mode = config.capitalUtilization?.mode || 'off';
    this.totalCapital = config.totalCapitalUsd;
    this.minThreshold = config.capitalUtilization?.minReallocationThreshold || 1000;

    // Tracking
    this.capitalUsageHistory = [];  // Daily snapshots
    this.peakCapitalUsed = 0;
    this.effectiveCapital = 0;
  }

  /**
   * Track capital usage for the day
   */
  trackDailyUsage(date, stockAllocations) {
    const totalAllocated = Object.values(stockAllocations)
      .reduce((sum, stock) => sum + stock.allocatedCapital, 0);

    const unusedCapital = this.totalCapital - totalAllocated;
    const utilizationPct = (totalAllocated / this.totalCapital) * 100;

    this.capitalUsageHistory.push({
      date,
      totalAllocated,
      unusedCapital,
      utilizationPct,
      stockAllocations: { ...stockAllocations }
    });

    // Update peak (for Mode 2)
    if (totalAllocated > this.peakCapitalUsed) {
      this.peakCapitalUsed = totalAllocated;
    }

    return { totalAllocated, unusedCapital, utilizationPct };
  }

  /**
   * Calculate reallocation amounts for Mode 1
   */
  calculateReallocation(stockAllocations, unusedCapital) {
    if (this.mode !== 'dynamic') return null;
    if (unusedCapital < this.minThreshold) return null;

    const totalAllocated = Object.values(stockAllocations)
      .reduce((sum, stock) => sum + stock.allocatedCapital, 0);

    const reallocation = {};

    for (const [symbol, allocation] of Object.entries(stockAllocations)) {
      if (allocation.hasActivePositions) {
        const currentShare = allocation.allocatedCapital / totalAllocated;
        const additionalCapital = currentShare * unusedCapital;

        reallocation[symbol] = {
          currentCapital: allocation.allocatedCapital,
          additionalCapital,
          newCapital: allocation.allocatedCapital + additionalCapital,
          shareOfReallocation: currentShare
        };
      }
    }

    return reallocation;
  }

  /**
   * Finalize metrics after backtest (Mode 2)
   */
  finalizeMetrics() {
    if (this.mode === 'normalized') {
      this.effectiveCapital = this.peakCapitalUsed;
    } else {
      this.effectiveCapital = this.totalCapital;
    }

    const avgUtilization = this.capitalUsageHistory
      .reduce((sum, day) => sum + day.utilizationPct, 0) / this.capitalUsageHistory.length;

    return {
      totalCapital: this.totalCapital,
      effectiveCapital: this.effectiveCapital,
      peakCapitalUsed: this.peakCapitalUsed,
      avgUtilization,
      capitalEfficiency: this.effectiveCapital / this.totalCapital
    };
  }
}
```

### 3. Portfolio Service Integration

**Location**: `backend/services/portfolioBacktestService.js`

```javascript
// Add to executePortfolioBacktest()

async function executePortfolioBacktest(config) {
  // Initialize capital manager
  const capitalManager = new CapitalUtilizationManager(config);

  // ... existing setup ...

  // Main daily loop
  for (const date of tradingDays) {
    // 1. Execute regular trading for all stocks
    for (const stock of stocks) {
      await executeDailyTradingForStock(stock, date, ...);
    }

    // 2. Track capital usage
    const stockAllocations = calculateStockAllocations(stocks);
    const { unusedCapital, utilizationPct } = capitalManager.trackDailyUsage(
      date,
      stockAllocations
    );

    // 3. Reallocate unused capital (Mode 1)
    if (config.capitalUtilization?.mode === 'dynamic' && unusedCapital > 0) {
      const reallocation = capitalManager.calculateReallocation(
        stockAllocations,
        unusedCapital
      );

      if (reallocation) {
        await executeCapitalReallocation(stocks, reallocation, date);
      }
    }

    // Log utilization
    console.log(`[${date}] Capital Utilization: ${utilizationPct.toFixed(2)}% ` +
                `(Unused: $${unusedCapital.toLocaleString()})`);
  }

  // 4. Finalize metrics
  const capitalMetrics = capitalManager.finalizeMetrics();

  // 5. Calculate dual performance metrics
  const configuredMetrics = calculatePerformanceMetrics(
    finalPortfolioValue,
    config.totalCapitalUsd
  );

  const effectiveMetrics = calculatePerformanceMetrics(
    finalPortfolioValue,
    capitalMetrics.effectiveCapital
  );

  return {
    ...existingResults,
    capitalMetrics,
    configuredCapitalMetrics: configuredMetrics,
    effectiveCapitalMetrics: effectiveMetrics
  };
}
```

### 4. Capital Reallocation Logic

```javascript
async function executeCapitalReallocation(stocks, reallocation, date) {
  console.log(`\n[${date}] 💰 Executing Capital Reallocation`);

  for (const [symbol, allocation] of Object.entries(reallocation)) {
    const stock = stocks.find(s => s.symbol === symbol);
    if (!stock) continue;

    const additionalLots = Math.floor(
      allocation.additionalCapital / stock.config.basic.lotSizeUsd
    );

    if (additionalLots > 0) {
      // Check if we haven't exceeded maxLots
      const currentLots = stock.holdings.length;
      const remainingCapacity = stock.config.longStrategy.maxLots - currentLots;
      const lotsToAdd = Math.min(additionalLots, remainingCapacity);

      if (lotsToAdd > 0) {
        console.log(`  ${symbol}: +${lotsToAdd} lots ` +
                    `($${allocation.additionalCapital.toLocaleString()} reallocated)`);

        // Execute buys with reallocated capital
        for (let i = 0; i < lotsToAdd; i++) {
          await executeBuyOrder(stock, date, 'REALLOCATION');
        }
      }
    }
  }
}
```

### 5. Metrics Calculation

```javascript
function calculatePerformanceMetrics(finalValue, capitalBase) {
  const totalReturn = finalValue - capitalBase;
  const totalROI = (totalReturn / capitalBase) * 100;

  // Calculate annualized returns
  const years = (endDate - startDate) / (365 * 24 * 60 * 60 * 1000);
  const annualROI = (Math.pow(finalValue / capitalBase, 1 / years) - 1) * 100;

  // Calculate Sharpe ratio (simplified)
  const returns = dailyReturns.map(r => r / capitalBase);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = calculateStdDev(returns);
  const sharpeRatio = (avgReturn / stdDev) * Math.sqrt(252); // Annualized

  return {
    totalROI: totalROI.toFixed(2),
    annualROI: annualROI.toFixed(2),
    totalReturn: totalReturn.toFixed(2),
    sharpeRatio: sharpeRatio.toFixed(2)
  };
}
```

## API Response Structure

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalCapital": 3000000,
      "effectiveCapital": 850000,
      "peakCapitalUsed": 850000,
      "avgCapitalUtilization": 28.3,
      "capitalEfficiency": 0.283,

      "configuredCapitalMetrics": {
        "totalROI": "15.2",
        "annualROI": "3.8",
        "totalReturn": "456000",
        "sharpeRatio": "0.65"
      },

      "effectiveCapitalMetrics": {
        "totalROI": "53.7",
        "annualROI": "13.4",
        "totalReturn": "456000",
        "sharpeRatio": "1.15"
      },

      "capitalUtilizationMode": "normalized"
    },

    "capitalUsageHistory": [
      {
        "date": "2021-09-02",
        "totalAllocated": 480000,
        "unusedCapital": 2520000,
        "utilizationPct": 16.0
      },
      // ... daily snapshots
    ],

    "stockResults": [ /* existing stock results */ ]
  }
}
```

## Frontend Integration

### Capital Utilization Display Component

```javascript
// Add to PortfolioResultsPage.js

function CapitalUtilizationSection({ summary }) {
  const [metricView, setMetricView] = useState('effective'); // 'configured' | 'effective'

  return (
    <div className="capital-utilization-section">
      <h2>Capital Utilization Analysis</h2>

      <div className="utilization-stats">
        <StatCard
          label="Total Capital"
          value={formatCurrency(summary.totalCapital)}
        />
        <StatCard
          label="Effective Capital"
          value={formatCurrency(summary.effectiveCapital)}
          highlight={summary.effectiveCapital !== summary.totalCapital}
        />
        <StatCard
          label="Peak Usage"
          value={formatCurrency(summary.peakCapitalUsed)}
        />
        <StatCard
          label="Avg Utilization"
          value={`${summary.avgCapitalUtilization.toFixed(1)}%`}
        />
      </div>

      <div className="metrics-toggle">
        <button
          className={metricView === 'configured' ? 'active' : ''}
          onClick={() => setMetricView('configured')}
        >
          Configured Capital Metrics
        </button>
        <button
          className={metricView === 'effective' ? 'active' : ''}
          onClick={() => setMetricView('effective')}
        >
          Effective Capital Metrics (True Performance)
        </button>
      </div>

      <MetricsTable
        metrics={
          metricView === 'configured'
            ? summary.configuredCapitalMetrics
            : summary.effectiveCapitalMetrics
        }
      />
    </div>
  );
}
```

## Database Schema (No Changes Required)

No database changes needed - all calculations happen in-memory during backtest execution.

## Configuration Migration

For existing portfolio configs without `capitalUtilization`:

```javascript
function normalizeConfig(config) {
  if (!config.capitalUtilization) {
    config.capitalUtilization = {
      mode: 'off',  // Preserve existing behavior
      minReallocationThreshold: 1000,
      reallocationFrequency: 'daily',
      preserveDeferredSelling: true
    };
  }
  return config;
}
```

## Performance Considerations

### Mode 1 (Dynamic) Performance Impact:
- **Additional computation per day**: O(n) where n = number of stocks with positions
- **Worst case**: ~48 stocks × 1000 days = 48,000 reallocation calculations
- **Expected overhead**: <5% increase in backtest time

### Mode 2 (Normalized) Performance Impact:
- **Additional computation**: Minimal - just tracking peak value
- **Expected overhead**: <1% increase in backtest time

### Optimization Strategies:
1. Only reallocate when `unusedCapital > minThreshold`
2. Cache stock allocation calculations
3. Batch reallocation operations
4. Skip reallocation if all stocks at maxLots

## Error Handling

```javascript
// Handle edge cases
if (effectiveCapital === 0) {
  return {
    error: 'NO_CAPITAL_DEPLOYED',
    message: 'No capital was deployed during backtest period',
    metrics: null
  };
}

if (effectiveCapital > totalCapital * 1.5 && config.marginPercent === 0) {
  console.warn('Effective capital exceeds total capital without margin - possible bug');
}
```

## Testing Strategy

### Unit Tests:
1. CapitalUtilizationManager tracking logic
2. Reallocation calculation algorithm
3. Metrics calculation (both modes)
4. Edge cases (zero usage, 100% usage, margin)

### Integration Tests:
1. Full portfolio backtest with Mode 1
2. Full portfolio backtest with Mode 2
3. Comparison: same config with all 3 modes
4. Verify backward compatibility (mode: 'off')

### Performance Tests:
1. Benchmark backtest time with mode 'off' vs 'dynamic'
2. Memory usage tracking
3. Large portfolio (100+ stocks) stress test
