# Spec 50: Portfolio Beta Scaling Support - Implementation Tasks

## Task Overview

Implement beta scaling support in portfolio config mode through config transmission, beta data fetching, and proper application.

**Estimated Time**: 4-6 hours
**Priority**: High (feature currently non-functional)
**Dependencies**: Spec 43 (BetaScalingService must exist)

---

## Phase 1: Config Extraction & Transmission

### Task 1.1: Add extractBetaConfig() Function
**File**: `backend/services/portfolioConfigLoader.js`
**Estimated Time**: 30 minutes

**Implementation**:
```javascript
/**
 * Extract beta scaling configuration from globalDefaults or stock overrides
 * @param {Object} config - Config section containing beta settings
 * @returns {Object|null} Beta scaling config or null if disabled
 */
function extractBetaConfig(config) {
  // Support both nested (config.beta) and flat structure
  const betaSection = config.beta || config;

  // Check if beta scaling is enabled
  const enabled = betaSection.enableBetaScaling === true;

  if (!enabled) {
    return null; // Beta scaling disabled
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

**Test Cases**:
- `extractBetaConfig({ beta: { enableBetaScaling: true, coefficient: 0.1 } })` → returns config
- `extractBetaConfig({ enableBetaScaling: false })` → returns null
- `extractBetaConfig({})` → returns null
- `extractBetaConfig({ enableBetaScaling: true })` → uses default coefficient 1.0

**Acceptance Criteria**:
- ✅ Function extracts beta config from nested structure
- ✅ Function returns null when disabled
- ✅ Function uses default values for missing fields

---

### Task 1.2: Modify configToBacktestParams() to Return betaScaling
**File**: `backend/services/portfolioConfigLoader.js`
**Estimated Time**: 20 minutes

**Changes**:
```javascript
function configToBacktestParams(config) {
  const {
    totalCapitalUsd,
    startDate,
    endDate,
    globalDefaults,
    stocks,
    stockSpecificOverrides = {}
  } = config;

  // ... existing code for lotSize, maxLots, flattenedDefaults ...

  // NEW: Extract beta scaling config
  const betaScaling = extractBetaConfig(globalDefaults);

  // Build stocks array
  const stocksWithParams = stocks.map(symbol => {
    const stockOverrides = stockSpecificOverrides[symbol] || {};

    // NEW: Extract stock-specific beta config
    const stockBetaConfig = extractBetaConfig(stockOverrides);

    const mergedParams = {
      ...flattenedDefaults,
      ...flattenConfigToParams(stockOverrides)
    };

    return {
      symbol,
      params: mergedParams,
      betaConfig: stockBetaConfig  // NEW: Add stock-specific beta config
    };
  });

  return {
    totalCapital: totalCapitalUsd,
    startDate: endDate === 'current' ? startDate : startDate,
    endDate: endDate === 'current' ? getCurrentDate() : endDate,
    lotSizeUsd,
    maxLotsPerStock,
    defaultParams: flattenedDefaults,
    stocks: stocksWithParams,
    indexTracking: config.indexTracking || { enabled: false },
    capitalOptimization: config.capitalOptimization || { enabled: false },
    betaScaling: betaScaling  // NEW: Add beta config to return value
  };
}
```

**Test Cases**:
- Config with `enableBetaScaling: true` → returns betaScaling object
- Config with `enableBetaScaling: false` → returns betaScaling: null
- Config without beta section → returns betaScaling: null
- Stock with override beta → stockConfig.betaConfig populated

**Acceptance Criteria**:
- ✅ betaScaling object included in returned parameters
- ✅ Stock-specific beta configs attached to stock objects
- ✅ Backward compatible with configs without beta section

---

### Task 1.3: Export extractBetaConfig() Function
**File**: `backend/services/portfolioConfigLoader.js`
**Estimated Time**: 5 minutes

**Changes**:
```javascript
module.exports = {
  loadPortfolioConfig,
  configToBacktestParams,
  validateConfig,
  clearConfigCache,
  listAvailableConfigs,
  getCurrentDate,
  extractBetaConfig  // NEW: Export for testing
};
```

**Acceptance Criteria**:
- ✅ Function exported and available for unit testing

---

## Phase 2: Beta Data Fetching

### Task 2.1: Add Beta Fetching to loadAllPriceData()
**File**: `backend/services/portfolioBacktestService.js`
**Estimated Time**: 45 minutes

**Implementation**:

Add beta fetching inside the `pricePromises.map()` loop (around line 668):

```javascript
const pricePromises = stocks.map(async (stockConfig) => {
  const symbol = typeof stockConfig === 'string' ? stockConfig : stockConfig.symbol;

  // ... existing stock and price loading code ...

  let betaData = null;

  // NEW: Fetch beta value for this stock
  try {
    const betaService = require('./betaService');
    const betaResult = await betaService.getBeta(symbol);

    if (betaResult.success && betaResult.beta !== null) {
      betaData = {
        beta: betaResult.beta,
        source: betaResult.source || 'provider',
        cached: betaResult.cached || false
      };
      console.log(`✅ Beta loaded for ${symbol}: ${betaResult.beta.toFixed(3)} (${betaResult.source})`);
    } else {
      console.warn(`⚠️  No beta data for ${symbol}, using fallback beta=1.0`);
      betaData = {
        beta: 1.0,
        source: 'fallback',
        cached: false
      };
    }
  } catch (error) {
    console.warn(`⚠️  Beta fetch error for ${symbol}, using fallback beta=1.0:`, error.message);
    betaData = {
      beta: 1.0,
      source: 'fallback',
      cached: false
    };
  }

  // ... existing return statement ...
  return { symbol, dateMap, skipped: false, betaData };  // Add betaData to return
});
```

**After Promise.all, collect beta data**:

```javascript
const results = await Promise.all(pricePromises);

const skippedStocks = [];
const betaDataMap = new Map();  // NEW: Collect beta data

for (const result of results) {
  const { symbol, dateMap, skipped, error, betaData } = result;

  if (skipped) {
    skippedStocks.push({ symbol, error });
    continue;
  }

  priceDataMap.set(symbol, dateMap);

  // NEW: Store beta data
  if (betaData) {
    betaDataMap.set(symbol, betaData);
  }
}

// ... existing skipped stocks warning ...

// NEW: Attach beta data to priceDataMap for later use
priceDataMap._betaData = betaDataMap;

return priceDataMap;
```

**Test Cases**:
- Stock with beta in database → fetches cached beta
- Stock without beta → uses fallback beta=1.0
- Beta fetch error → uses fallback beta=1.0 and logs warning
- All 96 nasdaq100 stocks → each has betaData entry

**Acceptance Criteria**:
- ✅ Beta values fetched in parallel with price data (no sequential delay)
- ✅ Beta data stored in priceDataMap._betaData
- ✅ Fallback beta=1.0 used when fetch fails
- ✅ Console logs show beta source for each stock

---

### Task 2.2: Add Beta Coverage Summary Logging
**File**: `backend/services/portfolioBacktestService.js`
**Estimated Time**: 15 minutes

**Implementation** (after beta data collection):

```javascript
// NEW: Log beta coverage summary
if (betaDataMap.size > 0) {
  const totalStocks = betaDataMap.size;
  const fetchedCount = Array.from(betaDataMap.values()).filter(b => b.source !== 'fallback').length;
  const fallbackCount = totalStocks - fetchedCount;
  const coveragePercent = (fetchedCount / totalStocks * 100).toFixed(1);

  console.log(`📊 Beta Coverage: ${fetchedCount}/${totalStocks} stocks (${coveragePercent}%)`);

  if (fallbackCount > 0) {
    console.warn(`⚠️  ${fallbackCount} stock(s) using fallback beta=1.0 (no provider data)`);
  }
}
```

**Acceptance Criteria**:
- ✅ Summary shows total stocks, fetched, and fallback counts
- ✅ Warning displayed when fallback count > 0
- ✅ Coverage percentage calculated correctly

---

## Phase 3: Beta Scaling Application

### Task 3.1: Fix Beta Scaling Condition
**File**: `backend/services/portfolioBacktestService.js`
**Estimated Time**: 30 minutes

**Current Code** (line 288):
```javascript
if (config.betaScaling?.enabled) {
```

**New Code**:
```javascript
// Apply beta scaling if enabled (Spec 50)
if (config.betaScaling && config.betaScaling.enabled) {
  const BetaScalingService = require('./betaScaling');
  const betaService = require('./betaService');
  const betaScalingService = new BetaScalingService(betaService);

  // Check for stock-specific beta config override
  const stockBetaConfig = stockConfig.betaConfig || null;
  const betaConfig = stockBetaConfig || config.betaScaling;

  // Get beta value from fetched beta data
  const betaData = priceDataMap._betaData?.get(symbol);
  const beta = betaData?.beta || 1.0;
  const betaSource = betaData?.source || 'unknown';

  try {
    const coefficient = betaConfig.coefficient || 1.0;

    // Apply beta scaling using centralized service (Spec 43)
    const scalingResult = await betaScalingService.applyBetaScaling(
      params,
      symbol,
      {
        enableBetaScaling: true,
        coefficient: coefficient,
        beta: beta,  // Use fetched beta value
        isManualBetaOverride: betaSource === 'manual'
      }
    );

    if (scalingResult.success) {
      console.log(
        `📊 Beta scaling applied for ${symbol}: ` +
        `beta=${beta.toFixed(3)} (${betaSource}), ` +
        `factor=${scalingResult.betaInfo?.betaFactor?.toFixed(2) || 'N/A'}`
      );

      // Use adjusted parameters
      params = { ...params, ...scalingResult.adjustedParameters };

      // Store beta info for results (including source)
      params._betaInfo = {
        ...scalingResult.betaInfo,
        source: betaSource,
        cached: betaData?.cached || false
      };
    } else {
      console.error(`❌ Beta scaling failed for ${symbol}:`, scalingResult.errors);
      console.warn(`⚠️  Using unadjusted parameters for ${symbol}`);
    }
  } catch (error) {
    console.warn(`⚠️  Beta scaling error for ${symbol}, using unadjusted parameters:`, error.message);
  }
}
```

**Acceptance Criteria**:
- ✅ Condition now checks config.betaScaling correctly
- ✅ Uses fetched beta values from priceDataMap._betaData
- ✅ Stock-specific beta config takes precedence over global
- ✅ Beta source logged for transparency

---

### Task 3.2: Include Beta Info in Results
**File**: `backend/services/portfolioMetricsService.js` (or wherever stock results are built)
**Estimated Time**: 20 minutes

**Add beta info to stock results**:

```javascript
// When building stockResults array, include beta info:
const stockResult = {
  symbol: stock.symbol,
  // ... existing metrics ...
  totalPNL: stock.totalPNL,
  totalPNLPercent: ((stock.totalPNL / stock.maxCapitalDeployed) * 100).toFixed(2),
  // ... more metrics ...

  // NEW: Add beta information
  betaInfo: stock.params?._betaInfo || null
};
```

**Acceptance Criteria**:
- ✅ Each stock result includes betaInfo field
- ✅ betaInfo contains: { beta, betaFactor, source, cached }
- ✅ betaInfo is null when beta scaling disabled

---

## Phase 4: Testing & Verification

### Task 4.1: Create Test Config (Beta Disabled)
**File**: `backend/configs/portfolios/nasdaq100-no-beta.json`
**Estimated Time**: 10 minutes

**Copy nasdaq100.json and set**:
```json
"beta": {
  "enableBetaScaling": false,
  ...
}
```

**Acceptance Criteria**:
- ✅ Config file created
- ✅ Validates successfully

---

### Task 4.2: Create Comparison Test Script
**File**: `backend/test_portfolio_beta_comparison.sh`
**Estimated Time**: 30 minutes

```bash
#!/bin/bash

echo "=== Testing Portfolio Beta Scaling ==="
echo ""

# Test 1: Beta enabled (nasdaq100)
echo "1. Running portfolio with BETA SCALING ENABLED..."
curl -s "http://localhost:3001/api/backtest/portfolio/config/nasdaq100" \
  | jq -r '.data.stockResults[0:5] | .[] | "\(.symbol): gridInterval=\(.params.gridIntervalPercent // "N/A"), beta=\(.betaInfo.beta // "N/A")"'

echo ""
echo "2. Running portfolio with BETA SCALING DISABLED..."
curl -s "http://localhost:3001/api/backtest/portfolio/config/nasdaq100-no-beta" \
  | jq -r '.data.stockResults[0:5] | .[] | "\(.symbol): gridInterval=\(.params.gridIntervalPercent // "N/A"), beta=\(.betaInfo.beta // "N/A")"'

echo ""
echo "3. Beta coverage analysis..."
curl -s "http://localhost:3001/api/backtest/portfolio/config/nasdaq100" \
  | jq -r '.data.stockResults | group_by(.betaInfo.source) | .[] | "\(.[0].betaInfo.source): \(length) stocks"'

echo ""
echo "=== Test Complete ==="
```

**Acceptance Criteria**:
- ✅ Script runs both configs
- ✅ Shows parameter differences
- ✅ Shows beta coverage breakdown

---

### Task 4.3: Verify Beta Scaling Logs
**Estimated Time**: 15 minutes

**Manual Verification Steps**:

1. Clear server log:
   ```bash
   > /tmp/server_debug.log
   ```

2. Run portfolio backtest:
   ```bash
   curl "http://localhost:3001/api/backtest/portfolio/config/nasdaq100" > /tmp/portfolio_result.json
   ```

3. Check logs for beta scaling:
   ```bash
   tail -200 /tmp/server_debug.log | grep -E "(📊 Beta|Beta Coverage)"
   ```

**Expected Output**:
```
✅ Beta loaded for AAPL: 1.234 (provider)
✅ Beta loaded for MSFT: 1.023 (cached)
⚠️  No beta data for ADBE, using fallback beta=1.0
...
📊 Beta Coverage: 15/96 stocks (15.6%)
⚠️  81 stock(s) using fallback beta=1.0 (no provider data)
...
📊 Beta scaling applied for NVDA: beta=2.123 (provider), factor=1.11
```

**Acceptance Criteria**:
- ✅ Each stock shows beta load attempt
- ✅ Beta coverage summary displayed
- ✅ Beta scaling application logged for each stock

---

### Task 4.4: Verify Results Include Beta Info
**Estimated Time**: 10 minutes

```bash
# Check first 3 stocks' beta info in results
jq '.data.stockResults[0:3] | .[] | {symbol, betaInfo}' /tmp/portfolio_result.json
```

**Expected Output**:
```json
{
  "symbol": "AAPL",
  "betaInfo": {
    "beta": 1.234,
    "betaFactor": 1.023,
    "source": "provider",
    "cached": false
  }
}
...
```

**Acceptance Criteria**:
- ✅ betaInfo present for all stocks
- ✅ betaInfo includes source field
- ✅ Fallback stocks show source: "fallback"

---

## Phase 5: Documentation & Cleanup

### Task 5.1: Update Portfolio Config README
**File**: `backend/configs/portfolios/README.md`
**Estimated Time**: 20 minutes

**Add section**:

```markdown
## Beta Scaling Configuration

Enable beta scaling to automatically adjust DCA parameters based on stock volatility.

### Global Beta Scaling

```json
"globalDefaults": {
  "beta": {
    "enableBetaScaling": true,
    "beta": 1,
    "betaFactor": 1,
    "coefficient": 0.1,
    "isManualBetaOverride": false
  }
}
```

### Stock-Specific Beta Override

```json
"stockSpecificOverrides": {
  "TSLA": {
    "beta": {
      "enableBetaScaling": true,
      "beta": 2.5,
      "coefficient": 0.15,
      "isManualBetaOverride": true
    }
  }
}
```

### Beta Data Coverage

- Beta values are fetched from provider when available
- Fallback to beta=1.0 (no adjustment) when provider has no data
- Check console logs for beta coverage statistics
```

**Acceptance Criteria**:
- ✅ README updated with beta scaling section
- ✅ Examples show both global and stock-specific configs
- ✅ Explains fallback behavior

---

### Task 5.2: Add Unit Tests for extractBetaConfig()
**File**: `backend/tests/portfolioConfigLoader.test.js` (create if doesn't exist)
**Estimated Time**: 30 minutes

```javascript
const { extractBetaConfig } = require('../services/portfolioConfigLoader');

describe('extractBetaConfig', () => {
  test('extracts beta config when enabled', () => {
    const config = {
      beta: {
        enableBetaScaling: true,
        coefficient: 0.1,
        beta: 1.5
      }
    };
    const result = extractBetaConfig(config);
    expect(result).toEqual({
      enabled: true,
      coefficient: 0.1,
      defaultBeta: 1.5,
      defaultBetaFactor: 1.0,
      isManualBetaOverride: false
    });
  });

  test('returns null when disabled', () => {
    const config = { beta: { enableBetaScaling: false } };
    expect(extractBetaConfig(config)).toBeNull();
  });

  test('uses default values for missing fields', () => {
    const config = { beta: { enableBetaScaling: true } };
    const result = extractBetaConfig(config);
    expect(result.coefficient).toBe(1.0);
    expect(result.defaultBeta).toBe(1.0);
  });

  test('handles flat structure', () => {
    const config = { enableBetaScaling: true, coefficient: 0.2 };
    const result = extractBetaConfig(config);
    expect(result.enabled).toBe(true);
    expect(result.coefficient).toBe(0.2);
  });
});
```

**Acceptance Criteria**:
- ✅ All test cases pass
- ✅ Edge cases covered (null, missing fields, flat structure)

---

## Task Summary

| Phase | Task | File | Time | Priority |
|-------|------|------|------|----------|
| 1 | Add extractBetaConfig() | portfolioConfigLoader.js | 30m | HIGH |
| 1 | Modify configToBacktestParams() | portfolioConfigLoader.js | 20m | HIGH |
| 1 | Export extractBetaConfig() | portfolioConfigLoader.js | 5m | MEDIUM |
| 2 | Add beta fetching | portfolioBacktestService.js | 45m | HIGH |
| 2 | Add coverage logging | portfolioBacktestService.js | 15m | MEDIUM |
| 3 | Fix beta scaling condition | portfolioBacktestService.js | 30m | HIGH |
| 3 | Include beta in results | portfolioMetricsService.js | 20m | MEDIUM |
| 4 | Create test config | nasdaq100-no-beta.json | 10m | LOW |
| 4 | Create comparison script | test_portfolio_beta_comparison.sh | 30m | MEDIUM |
| 4 | Verify logs | Manual | 15m | HIGH |
| 4 | Verify results | Manual | 10m | HIGH |
| 5 | Update README | README.md | 20m | LOW |
| 5 | Add unit tests | portfolioConfigLoader.test.js | 30m | MEDIUM |

**Total Estimated Time**: 4 hours 40 minutes

---

## Success Criteria

### Functional Success
- ✅ Beta scaling runs in portfolio mode when enabled
- ✅ Each stock uses fetched beta value or fallback
- ✅ Stock-specific beta overrides work correctly
- ✅ Results include beta information per stock

### Code Quality Success
- ✅ All new functions have JSDoc comments
- ✅ Error handling for all beta fetch failures
- ✅ Backward compatible with existing configs
- ✅ Unit tests cover extractBetaConfig()

### Operational Success
- ✅ Console logs show beta coverage statistics
- ✅ Logs indicate beta source (provider/cached/fallback) for each stock
- ✅ Test script demonstrates beta on vs off comparison
- ✅ Documentation updated with examples

---

## Rollback Plan

If issues arise after deployment:

1. **Quick Disable**: Set `enableBetaScaling: false` in nasdaq100.json
2. **Code Revert**: Revert configToBacktestParams() changes (beta scaling will be skipped)
3. **Full Rollback**: Revert all changes to portfolioConfigLoader.js and portfolioBacktestService.js

**Impact of Rollback**: Returns to current state (beta scaling non-functional in portfolio mode)
