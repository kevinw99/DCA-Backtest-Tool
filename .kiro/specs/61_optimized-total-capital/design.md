# Spec 61: Design Document - Optimized Total Capital

## Architecture Overview

The optimized capital feature finds the minimum capital needed for full strategy execution, then runs TWO scenarios for comparison:

```
[User Request] ──> [Discovery Run] ──────────────────────────────────> [Results]
       │                  │                                                │
       │           Track max deployed                              TWO RESULT TABS:
       │           capital throughout                                      │
       │                  │                                    ┌───────────┴───────────┐
       │                  │                                    │                       │
       │                  v                              [Tab 1: 100%]          [Tab 2: 90%]
       │           optimalCapital                        Optimal Capital      Constrained Capital
       │                  │                              Zero rejections      Some rejections
       │                  │                                    │                       │
       │           ┌──────┴──────┐                      Full comparison        Full comparison
       │           │             │                       DCA vs B&H            DCA vs B&H
       │           v             v
       │     [100% Run]    [90% Run]
       │     (Discovery     (2nd Run)
       │      IS final)
       │           │             │
       └───────────┴─────────────┴──────────────> [Final Response with 2 Scenarios]
```

## Key Insight: Discovery Run IS the Final Result

The discovery run with unlimited capital:
- Produces the **ceiling performance** with zero rejected orders
- Records `peakDeployedCapital` = exact capital needed
- **No re-run needed** - this IS the 100% optimal scenario result

We only need a second run for the 90% constrained scenario.

## Component Design

### 1. Capital Tracking in Portfolio Class

Modify: `backend/services/portfolioBacktestService.js`

```javascript
class Portfolio {
  constructor(totalCapital, options = {}) {
    // ... existing constructor

    // Capital tracking (always enabled)
    this.capitalTracking = {
      maxDeployed: 0,
      maxDeployedDate: null,
      totalDeployedDays: 0,
      sumDeployed: 0
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
  }

  getCapitalAnalysis() {
    return {
      maxDeployed: this.capitalTracking.maxDeployed,
      maxDeployedDate: this.capitalTracking.maxDeployedDate,
      avgDeployed: this.capitalTracking.sumDeployed / this.capitalTracking.totalDeployedDays,
      utilizationPercent: this.capitalTracking.maxDeployed / this.totalCapital
    };
  }
}
```

### 2. Main Orchestration Logic

In `runPortfolioBacktest()`:

```javascript
async function runPortfolioBacktest(config) {
  const { optimizedTotalCapital = false } = config;

  if (optimizedTotalCapital && !config._isConstrainedRun) {
    // === DISCOVERY RUN (100% Optimal) ===
    console.log('🔍 Running discovery with unlimited capital...');

    const discoveryConfig = {
      ...config,
      totalCapital: Math.max(config.totalCapital || 1000000, 10000000), // Effectively unlimited
      _trackCapital: true
    };

    const optimalResult = await runPortfolioBacktest(discoveryConfig);
    const optimalCapital = optimalResult.capitalAnalysis.peakDeployedCapital;

    console.log(`✅ Optimal capital found: $${optimalCapital.toLocaleString()}`);

    // Recalculate metrics with correct totalCapital = optimalCapital
    // (Discovery run already has the DCA results, just need to adjust capital basis)
    optimalResult.capitalAnalysis.optimizedCapital = optimalCapital;
    optimalResult.capitalAnalysis.mode = 'optimal';
    optimalResult.capitalAnalysis.rejectedOrderCount = 0;

    // Calculate Buy & Hold with optimal capital
    optimalResult.buyAndHold = calculatePortfolioBuyAndHold(
      priceDataMap,
      { ...config, totalCapital: optimalCapital },
      optimalResult
    );

    // === CONSTRAINED RUN (90% Capital) ===
    console.log('🎯 Running constrained scenario at 90% capital...');

    const constrainedCapital = Math.floor(optimalCapital * 0.9);
    const constrainedConfig = {
      ...config,
      totalCapital: constrainedCapital,
      _isConstrainedRun: true
    };

    const constrainedResult = await runPortfolioBacktest(constrainedConfig);
    constrainedResult.capitalAnalysis = {
      optimizedCapital: constrainedCapital,
      mode: 'constrained_90',
      percentOfOptimal: 90,
      rejectedOrderCount: constrainedResult.rejectedOrders?.length || 0
    };

    // Calculate Buy & Hold with constrained capital
    constrainedResult.buyAndHold = calculatePortfolioBuyAndHold(
      priceDataMap,
      { ...config, totalCapital: constrainedCapital },
      constrainedResult
    );

    // Return both scenarios
    return {
      success: true,
      data: {
        scenarios: {
          optimal: optimalResult,      // Tab 1: 100% capital, 0 rejections
          constrained: constrainedResult  // Tab 2: 90% capital, some rejections
        },
        capitalDiscovery: {
          peakDeployedCapital: optimalCapital,
          peakCapitalDate: optimalResult.capitalAnalysis.peakCapitalDate,
          constrainedCapital: constrainedCapital
        }
      }
    };
  }

  // === STANDARD BACKTEST (existing logic) ===
  // ... existing implementation with capital tracking always enabled
}
```

### 3. Buy & Hold Uses Same Capital

Modify: `backend/services/portfolioBuyAndHoldService.js`

```javascript
function calculatePortfolioBuyAndHold(priceDataMap, config, dcaResult) {
  // Use the totalCapital from config (either optimal or constrained)
  const totalCapital = config.totalCapital;

  // Calculate allocation per stock
  const stockCount = Object.keys(priceDataMap).length;
  const capitalPerStock = totalCapital / stockCount;

  // ... rest of calculation
  // Returns full comparison metrics (CAGR, Sharpe, Max Drawdown, etc.)
}
```

## Data Flow

### Request Flow (optimizedTotalCapital: true)

```
1. API receives request with optimizedTotalCapital: true
   └── User may specify totalCapital (used as fallback/minimum)

2. Discovery Run
   └── Run with totalCapital: 10,000,000 (effectively unlimited)
   └── Track deployedCapital every day
   └── Record: peakDeployed = $185,000, date = "2022-10-15"
   └── This IS the 100% optimal result (zero rejections)

3. Recalculate with Correct Capital Basis
   └── Set totalCapital = $185,000 for metrics calculation
   └── Calculate Buy & Hold with same $185,000

4. Constrained Run (90%)
   └── Run with totalCapital: $166,500 (90% of optimal)
   └── Some buy orders may be rejected
   └── Calculate Buy & Hold with same $166,500

5. Return Both Scenarios in Response
```

### Response Structure

```javascript
{
  "success": true,
  "data": {
    "capitalDiscovery": {
      "peakDeployedCapital": 185000,
      "peakCapitalDate": "2022-10-15",
      "constrainedCapital": 166500
    },
    "scenarios": {
      "optimal": {
        // Tab 1: 100% Capital - Ceiling Performance
        "capitalAnalysis": {
          "mode": "optimal",
          "optimizedCapital": 185000,
          "rejectedOrderCount": 0,
          "capitalUtilization": 0.77  // avg/total
        },
        "dcaResults": {
          "finalValue": 425000,
          "totalReturn": 240000,
          "totalReturnPercent": 129.73,
          "cagr": 25.38,
          "maxDrawdown": 25.99,
          "sharpeRatio": 1.14,
          "sortinoRatio": 1.82,
          "volatility": 22.17
        },
        "buyAndHold": {
          "finalValue": 380000,
          "totalReturn": 195000,
          "totalReturnPercent": 105.41,
          "cagr": 22.15,
          "maxDrawdown": 43.94,
          "sharpeRatio": 1.20,
          "sortinoRatio": 1.65,
          "volatility": 36.50
        },
        "comparison": {
          "totalReturn": { "dca": 129.73, "buyAndHold": 105.41, "advantage": "DCA" },
          "cagr": { "dca": 25.38, "buyAndHold": 22.15, "advantage": "DCA" },
          "maxDrawdown": { "dca": 25.99, "buyAndHold": 43.94, "advantage": "DCA" },
          "sharpeRatio": { "dca": 1.14, "buyAndHold": 1.20, "advantage": "BUY_AND_HOLD" },
          "volatility": { "dca": 22.17, "buyAndHold": 36.50, "advantage": "DCA" }
        }
      },
      "constrained": {
        // Tab 2: 90% Capital - Realistic Performance
        "capitalAnalysis": {
          "mode": "constrained_90",
          "optimizedCapital": 166500,
          "percentOfOptimal": 90,
          "rejectedOrderCount": 5
        },
        "dcaResults": {
          "finalValue": 405000,
          "totalReturn": 238500,
          "totalReturnPercent": 143.24,  // Higher % due to lower capital base
          "cagr": 24.85,
          "maxDrawdown": 24.12,
          "sharpeRatio": 1.11,
          // ... other metrics
        },
        "buyAndHold": {
          "finalValue": 342000,
          "totalReturn": 175500,
          "totalReturnPercent": 105.41,
          "cagr": 22.15,
          // ... other metrics
        },
        "comparison": {
          // Full comparison same as optimal tab
        },
        "rejectedOrders": [
          { "date": "2022-03-15", "symbol": "NVDA", "reason": "capital constraint" },
          // ...
        ]
      }
    }
  }
}
```

## Frontend: Two Tabs

The frontend will display two tabs, each containing a **COMPLETE backtest result page** (identical structure to current results, just with different capital):

### Tab 1: Optimal Capital (100%)
A complete backtest run with `totalCapital = peakDeployedCapital`:
- Capital used: `$185,000` (auto-discovered)
- Zero rejected orders
- **Full result page including:**
  - Portfolio summary (final value, total return, CAGR)
  - Performance metrics (Sharpe, Sortino, Calmar, Volatility)
  - Max drawdown analysis
  - Per-stock breakdown
  - Transaction log
  - All charts (portfolio value, drawdown, allocation)
  - Buy & Hold comparison with same capital
  - Full comparison table (DCA vs B&H)

### Tab 2: Constrained Capital (90%)
A complete backtest run with `totalCapital = peakDeployedCapital * 0.9`:
- Capital used: `$166,500` (90% of optimal)
- Some rejected orders due to capital constraint
- **Full result page including:**
  - Portfolio summary (final value, total return, CAGR)
  - Performance metrics (Sharpe, Sortino, Calmar, Volatility)
  - Max drawdown analysis
  - Per-stock breakdown
  - Transaction log
  - All charts (portfolio value, drawdown, allocation)
  - Buy & Hold comparison with same capital
  - Full comparison table (DCA vs B&H)
  - **Rejected orders list** (additional section)

## Performance Considerations

1. **Two Simulations Total**:
   - Discovery run (100% optimal) - ~50% of total time
   - Constrained run (90%) - ~50% of total time
   - Total: ~2x standard mode runtime

2. **Price Data Caching**:
   - Cache fetched price data during discovery run
   - Reuse for constrained run
   - Reduces API calls and improves performance

3. **Memory**: Capital tracking is lightweight (just peak/sum/count)

## Testing Strategy

### Curl Test Commands

```bash
# Optimized mode - returns both scenarios
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "stocks": ["AAPL", "MSFT", "NVDA"],
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "startDate": "2021-01-01",
    "endDate": "2025-11-23",
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "optimizedTotalCapital": true
  }' | jq '.data.scenarios.optimal.capitalAnalysis, .data.scenarios.constrained.capitalAnalysis'
```

### Verification Checklist
- [ ] Optimal scenario has zero rejected orders
- [ ] Constrained scenario has some rejected orders
- [ ] Both scenarios use correct capital for Buy & Hold
- [ ] All comparison metrics present in both tabs
- [ ] Backward compatibility when optimizedTotalCapital: false
