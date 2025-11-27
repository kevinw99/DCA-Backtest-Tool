# Spec 50: Portfolio Beta Scaling Support - Design

## Design Overview

Fix beta scaling in portfolio mode by bridging the configuration gap between `portfolioConfigLoader.js` and `portfolioBacktestService.js`.

### Root Cause Analysis

**The Bug**: Config mismatch between loader and service

```
portfolioConfigLoader.js:
  ├─ Flattens globalDefaults.beta into defaultParams
  └─ Returns: { totalCapital, startDate, defaultParams, ... }
       ❌ Missing: betaScaling config object

portfolioBacktestService.js:
  └─ Expects: config.betaScaling.enabled
       ❌ Always undefined → beta code never runs
```

### Solution Architecture

**Three-Part Fix**:

1. **Config Extraction**: Extract beta config as separate object in portfolioConfigLoader
2. **Config Transmission**: Pass betaScaling object alongside other config
3. **Beta Data Fetching**: Fetch missing beta values during price data loading

## Detailed Design

### Part 1: Config Extraction (portfolioConfigLoader.js)

#### New Function: `extractBetaConfig()`

```javascript
/**
 * Extract beta scaling configuration from globalDefaults or stock overrides
 * @param {Object} globalDefaults - Global defaults from config
 * @returns {Object|null} Beta scaling config or null if disabled
 */
function extractBetaConfig(globalDefaults) {
  const betaSection = globalDefaults.beta || globalDefaults;

  // Check if beta scaling is enabled
  if (!betaSection.enableBetaScaling) {
    return null; // Disabled or missing
  }

  return {
    enabled: true,
    coefficient: betaSection.coefficient || 1.0,
    defaultBeta: betaSection.beta || 1.0,
    defaultBetaFactor: betaSection.betaFactor || 1.0,
    isManualBetaOverride: betaSection.isManualBetaOverride || false
  };
}
```

#### Modified Function: `configToBacktestParams()`

Add betaScaling to returned parameters:

```javascript
function configToBacktestParams(config) {
  // ... existing code ...

  // Extract beta scaling config
  const betaScaling = extractBetaConfig(globalDefaults);

  return {
    totalCapital: totalCapitalUsd,
    startDate,
    endDate,
    lotSizeUsd,
    maxLotsPerStock,
    defaultParams: flattenedDefaults,
    stocks: stocksWithParams,
    indexTracking: config.indexTracking || { enabled: false },
    capitalOptimization: config.capitalOptimization || { enabled: false },
    betaScaling: betaScaling  // NEW: Add beta config
  };
}
```

### Part 2: Stock-Level Beta Overrides (portfolioConfigLoader.js)

Handle stock-specific beta configs:

```javascript
// In configToBacktestParams() when building stocksWithParams:
const stocksWithParams = stocks.map(symbol => {
  const stockOverrides = stockSpecificOverrides[symbol] || {};

  // Extract stock-level beta config if present
  const stockBetaConfig = stockOverrides.beta
    ? extractBetaConfig({ beta: stockOverrides.beta })
    : null;

  // Merge parameters
  const mergedParams = {
    ...flattenedDefaults,
    ...flattenConfigToParams(stockOverrides)
  };

  return {
    symbol,
    params: mergedParams,
    betaConfig: stockBetaConfig  // NEW: Stock-specific beta config
  };
});
```

### Part 3: Beta Data Fetching (portfolioBacktestService.js)

#### Modified Function: `loadAllPriceData()`

Fetch beta values in parallel with price data:

```javascript
async function loadAllPriceData(stocks, startDate, endDate) {
  const priceDataMap = new Map();
  const betaDataMap = new Map();  // NEW: Track beta data

  const pricePromises = stocks.map(async (stockConfig) => {
    const symbol = typeof stockConfig === 'string' ? stockConfig : stockConfig.symbol;

    // ... existing price loading code ...

    // NEW: Fetch beta if needed
    try {
      const betaService = require('./betaService');
      const betaResult = await betaService.getBeta(symbol);

      if (betaResult.success && betaResult.beta !== null) {
        betaDataMap.set(symbol, {
          beta: betaResult.beta,
          source: betaResult.source || 'provider',
          cached: betaResult.cached || false
        });
        console.log(`✅ Beta loaded for ${symbol}: ${betaResult.beta.toFixed(3)} (${betaResult.source})`);
      } else {
        console.warn(`⚠️  No beta data for ${symbol}, using fallback beta=1.0`);
        betaDataMap.set(symbol, {
          beta: 1.0,
          source: 'fallback',
          cached: false
        });
      }
    } catch (error) {
      console.warn(`⚠️  Beta fetch error for ${symbol}, using fallback beta=1.0:`, error.message);
      betaDataMap.set(symbol, {
        beta: 1.0,
        source: 'fallback',
        cached: false
      });
    }

    return { symbol, dateMap, skipped: false };
  });

  // ... existing code ...

  // Attach beta data to priceDataMap
  priceDataMap._betaData = betaDataMap;

  return priceDataMap;
}
```

#### Modified Section: Beta Scaling Application (portfolioBacktestService.js:287-329)

Update condition to check new config structure:

```javascript
// OLD (line 288):
if (config.betaScaling?.enabled) {

// NEW:
if (config.betaScaling && config.betaScaling.enabled) {

  // Check for stock-specific beta config override
  const stockBetaConfig = stockConfig.betaConfig || null;
  const betaConfig = stockBetaConfig || config.betaScaling;

  // Get beta value from betaDataMap (fetched in loadAllPriceData)
  const betaData = priceDataMap._betaData?.get(symbol);
  const beta = betaData?.beta || 1.0;

  try {
    const coefficient = betaConfig.coefficient || 1.0;

    // Apply beta scaling using centralized service
    const scalingResult = await betaScalingService.applyBetaScaling(
      params,
      symbol,
      {
        enableBetaScaling: true,
        coefficient: coefficient,
        beta: beta,  // Use fetched beta
        isManualBetaOverride: betaData?.source === 'manual'
      }
    );

    if (scalingResult.success) {
      console.log(`📊 Beta scaling applied for ${symbol}: beta=${beta.toFixed(3)} (${betaData?.source}), factor=${scalingResult.betaInfo?.betaFactor?.toFixed(2)}`);

      // Use adjusted parameters
      params = { ...params, ...scalingResult.adjustedParameters };

      // Store beta info for results
      params._betaInfo = {
        ...scalingResult.betaInfo,
        source: betaData?.source,
        cached: betaData?.cached
      };
    }
  } catch (error) {
    console.warn(`⚠️  Beta scaling error for ${symbol}, using unadjusted parameters:`, error.message);
  }
}
```

### Part 4: Results Enhancement

Add beta information to stock results:

```javascript
// In portfolioMetricsService.js or when building stock results:
stockResults.push({
  symbol,
  // ... existing metrics ...
  betaInfo: stock.params._betaInfo || null  // NEW: Include beta info
});
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Config File (nasdaq100.json)                             │
│    globalDefaults.beta: { enableBetaScaling: true, ... }    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. portfolioConfigLoader.extractBetaConfig()                │
│    → Extracts beta config as separate object                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. portfolioConfigLoader.configToBacktestParams()           │
│    → Returns: { ..., betaScaling: { enabled, coefficient } }│
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. portfolioBacktestService.loadAllPriceData()              │
│    → Fetches beta values for all stocks in parallel         │
│    → Stores in priceDataMap._betaData                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. portfolioBacktestService (main loop)                     │
│    → Checks: if (config.betaScaling.enabled)                │
│    → Gets beta from priceDataMap._betaData                  │
│    → Applies BetaScalingService.applyBetaScaling()          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Stock Results                                            │
│    → Each stock includes betaInfo { beta, source, factor }  │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling

### Scenario 1: Beta Fetch Fails
- **Fallback**: Use beta = 1.0 (no scaling)
- **Logging**: Warn about fallback usage
- **Impact**: Stock runs with unadjusted parameters

### Scenario 2: Beta Scaling Application Fails
- **Fallback**: Use unadjusted parameters
- **Logging**: Log error and continue with next stock
- **Impact**: Single stock uses original parameters

### Scenario 3: Beta Config Invalid
- **Fallback**: Disable beta scaling (betaScaling = null)
- **Logging**: Warn about invalid config
- **Impact**: Entire portfolio runs without beta scaling

## Testing Strategy

### Unit Tests

1. **Test extractBetaConfig()**
   - Valid beta config → returns correct object
   - Missing enableBetaScaling → returns null
   - Nested structure → flattens correctly
   - Missing coefficient → uses default 1.0

2. **Test configToBacktestParams()**
   - Beta enabled → includes betaScaling object
   - Beta disabled → betaScaling = null
   - Stock-specific beta → merges with global

### Integration Tests

1. **End-to-End Beta Scaling Test**
   ```bash
   # Test script: test_portfolio_beta_scaling.sh
   curl "http://localhost:3001/api/backtest/portfolio/config/nasdaq100"
   # Verify: Each stock shows beta scaling log
   # Verify: Results include betaInfo per stock
   ```

2. **Compare Beta On vs Off**
   ```bash
   # Create nasdaq100-no-beta.json (enableBetaScaling: false)
   # Run both configs
   # Compare: gridInterval, profitRequirement should differ for high-beta stocks
   ```

3. **Beta Data Coverage Test**
   ```bash
   # Check how many nasdaq100 stocks have beta
   sqlite3 stocks.db "SELECT COUNT(*) FROM stock_beta
     WHERE stock_id IN (SELECT id FROM stocks WHERE symbol IN (...))"
   ```

## Performance Considerations

1. **Parallel Beta Fetching**: Fetch beta values alongside price data (no sequential overhead)
2. **Beta Caching**: BetaService already caches beta values in database
3. **Batch Provider Calls**: If provider supports batch beta requests, use it
4. **Estimated Overhead**: <5 seconds for 100 stocks (parallel fetching)

## Backward Compatibility

1. **No beta section**: betaScaling = null, code path skipped (existing behavior)
2. **enableBetaScaling: false**: betaScaling = null, code path skipped
3. **Old flat config**: extractBetaConfig handles both nested and flat structures

## Future Enhancements (Out of Scope)

1. **Beta History Tracking**: Store beta values over time, analyze changes
2. **Custom Beta Calculation**: Calculate beta from price data directly
3. **Beta Confidence Scores**: Weight beta adjustments by data quality
4. **Beta Visualization**: Show beta distribution across portfolio
