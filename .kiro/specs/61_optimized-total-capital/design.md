# Spec 61: Design Document - Optimized Total Capital

## Architecture Overview

The optimized capital feature uses a two-pass simulation approach:

```
[User Request] ──> [Discovery Run] ──> [Optimization Run] ──> [Results]
       │                  │                    │
       │           Track max deployed    Use optimal capital
       │           capital throughout    for final simulation
       │                  │                    │
       │                  └──────┬─────────────┘
       │                         │
       │              [Capital Analysis Module]
       │                         │
       │                         v
       │              [Buy & Hold Calculator]
       │              (uses same optimal capital)
       │                         │
       └────────────────────────>│
                                 v
                          [Final Response]
```

## Component Design

### 1. Capital Discovery Module

New file: `backend/services/capitalDiscoveryService.js`

```javascript
/**
 * Runs a discovery simulation to find optimal capital requirements
 * @param {Object} config - Portfolio backtest configuration
 * @returns {Object} Discovery results with optimal capital metrics
 */
async function discoverOptimalCapital(config) {
  // Run simulation with very high capital (effectively unlimited)
  const discoveryConfig = {
    ...config,
    totalCapital: config.totalCapital * 10,  // 10x to ensure no constraints
    _discoveryMode: true  // Flag to enable capital tracking
  };

  const result = await runPortfolioBacktest(discoveryConfig);

  return {
    peakDeployedCapital: result.capitalTracking.maxDeployed,
    peakCapitalDate: result.capitalTracking.maxDeployedDate,
    averageDeployedCapital: result.capitalTracking.avgDeployed,
    deploymentHistory: result.capitalTracking.dailyDeployed
  };
}
```

### 2. Portfolio Manager Enhancements

Modify: `backend/services/portfolioBacktestService.js`

Add capital tracking to the Portfolio class:

```javascript
class Portfolio {
  constructor(totalCapital, options = {}) {
    // ... existing constructor

    // Capital tracking for discovery mode
    this.capitalTracking = {
      maxDeployed: 0,
      maxDeployedDate: null,
      totalDeployedDays: 0,
      sumDeployed: 0,
      dailyDeployed: []  // For detailed analysis
    };
  }

  trackCapitalUsage(date) {
    const currentDeployed = this.deployedCapital;

    if (currentDeployed > this.capitalTracking.maxDeployed) {
      this.capitalTracking.maxDeployed = currentDeployed;
      this.capitalTracking.maxDeployedDate = date;
    }

    this.capitalTracking.sumDeployed += currentDeployed;
    this.capitalTracking.totalDeployedDays++;

    // Store daily snapshot (every N days to save memory)
    if (this.capitalTracking.totalDeployedDays % 5 === 0) {
      this.capitalTracking.dailyDeployed.push({
        date,
        deployed: currentDeployed
      });
    }
  }

  getCapitalAnalysis() {
    return {
      maxDeployed: this.capitalTracking.maxDeployed,
      maxDeployedDate: this.capitalTracking.maxDeployedDate,
      avgDeployed: this.capitalTracking.sumDeployed / this.capitalTracking.totalDeployedDays,
      utilizationPercent: (this.capitalTracking.sumDeployed / this.capitalTracking.totalDeployedDays) / this.totalCapital
    };
  }
}
```

### 3. Main Orchestration Logic

In `runPortfolioBacktest()`:

```javascript
async function runPortfolioBacktest(config) {
  const { optimizedTotalCapital = false } = config;

  if (optimizedTotalCapital && !config._optimizationRun) {
    // === DISCOVERY PHASE ===
    console.log('🔍 Starting capital discovery run...');

    const discoveryConfig = {
      ...config,
      totalCapital: Math.max(config.totalCapital || 1000000, 10000000), // Use 10M or 10x user input
      _discoveryMode: true
    };

    const discoveryResult = await runPortfolioBacktest(discoveryConfig);
    const optimalCapital = discoveryResult.capitalAnalysis.peakDeployedCapital;

    console.log(`✅ Discovery complete. Optimal capital: $${optimalCapital.toLocaleString()}`);

    // === OPTIMIZATION PHASE ===
    console.log('🎯 Running optimized backtest...');

    const optimizedConfig = {
      ...config,
      totalCapital: optimalCapital,
      _optimizationRun: true,
      _originalCapital: config.totalCapital
    };

    const optimizedResult = await runPortfolioBacktest(optimizedConfig);

    // Add discovery insights to response
    optimizedResult.capitalAnalysis = {
      userSpecifiedCapital: config.totalCapital,
      optimizedCapital: optimalCapital,
      peakDeployedCapital: optimalCapital,
      peakCapitalDate: discoveryResult.capitalAnalysis.peakCapitalDate,
      averageDeployedCapital: optimizedResult.capitalAnalysis.avgDeployed,
      capitalUtilization: optimizedResult.capitalAnalysis.avgDeployed / optimalCapital,
      rejectedOrderCount: optimizedResult.rejectedOrders?.length || 0,
      capitalSavings: config.totalCapital ? config.totalCapital - optimalCapital : null
    };

    return optimizedResult;
  }

  // === STANDARD BACKTEST (existing logic) ===
  // ... existing implementation
}
```

### 4. Buy & Hold Integration

Modify: `backend/services/portfolioBuyAndHoldService.js`

```javascript
function calculatePortfolioBuyAndHold(priceDataMap, config, portfolio) {
  // Use optimized capital if available
  const effectiveCapital = config._optimizedCapital || config.totalCapital;

  // Calculate allocation per stock based on effective capital
  const stockCount = Object.keys(priceDataMap).length;
  const capitalPerStock = effectiveCapital / stockCount;

  // ... rest of calculation using effectiveCapital
}
```

## Data Flow

### Request Flow (optimizedTotalCapital: true)

```
1. API receives request with optimizedTotalCapital: true
   └── totalCapital: 300000 (user specified, used as fallback)

2. Discovery Phase
   └── Run with totalCapital: 10,000,000 (effectively unlimited)
   └── Track deployedCapital every day
   └── Record: maxDeployed = 185,000, maxDate = "2022-10-15"

3. Optimization Phase
   └── Run with totalCapital: 185,000 (the optimal value)
   └── All buy orders should execute (no capital constraints)

4. Buy & Hold Calculation
   └── Uses same 185,000 capital for fair comparison
   └── Allocates proportionally: 185,000 / 3 stocks = 61,666.67 each

5. Response includes capitalAnalysis object
```

### Response Structure

```javascript
{
  "success": true,
  "data": {
    // ... existing portfolio backtest data

    "capitalAnalysis": {
      "mode": "optimized",
      "userSpecifiedCapital": 300000,
      "optimizedCapital": 185000,
      "peakDeployedCapital": 185000,
      "peakCapitalDate": "2022-10-15",
      "averageDeployedCapital": 142500,
      "capitalUtilization": 0.77,
      "rejectedOrderCount": 0,
      "capitalSavings": 115000,  // 300k - 185k = saved capital
      "capitalSavingsPercent": 38.33
    },

    "comparison": {
      // Both DCA and Buy & Hold using optimizedCapital: 185000
      "dcaFinalValue": 425000,
      "buyAndHoldFinalValue": 380000,
      // ...
    }
  }
}
```

## Performance Considerations

1. **Double Execution**: Optimized mode runs backtest twice
   - Discovery run: Full simulation with capital tracking
   - Optimization run: Final simulation with optimal capital
   - Mitigation: Cache price data between runs

2. **Memory Usage**: Capital tracking stores daily snapshots
   - Mitigation: Sample every 5 days instead of every day
   - Configurable sampling rate via `_capitalTrackingInterval`

3. **API Response Time**: ~2x slower for optimized mode
   - Acceptable trade-off for improved accuracy
   - Frontend can show loading indicator

## Testing Strategy

### Unit Tests
- `capitalDiscoveryService.test.js`: Test discovery logic
- `portfolioBacktestService.test.js`: Test two-pass orchestration

### Integration Tests
- Verify zero rejected orders when optimizedTotalCapital: true
- Verify Buy & Hold uses same capital as DCA
- Verify backward compatibility when parameter is false

### Curl Test Commands

```bash
# Standard mode (backward compatible)
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{"stocks":["AAPL","MSFT","NVDA"],"totalCapital":300000,...}'

# Optimized mode
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{"stocks":["AAPL","MSFT","NVDA"],"totalCapital":300000,"optimizedTotalCapital":true,...}'
```

## Migration Path

1. Add parameter with default `false` - no breaking changes
2. Frontend can enable via checkbox when ready
3. Future: Make optimized mode the default for new users
