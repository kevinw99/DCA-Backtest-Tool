# Additional Requirements: Differential Stock-Specific Defaults

## Requirement 4: Store Only Parameter Differences in backtestDefaults.json

### Problem
Currently, `backtestDefaults.json` stores COMPLETE parameter sets for each stock, including many parameters that are identical to the global defaults. This causes:
- **Data Duplication**: Same values repeated across multiple stocks
- **Maintenance Burden**: When global defaults change, must update all stocks
- **File Bloat**: backtestDefaults.json is unnecessarily large
- **Unclear Intent**: Hard to see which parameters are actually stock-specific

### Solution: Differential Storage

**Stock-specific entries should ONLY contain parameters that differ from global defaults.**

#### Current State Example (PLTR):
```json
"PLTR": {
  "basic": {
    "lotSizeUsd": 10000,         // ❌ Same as global
    "strategyMode": "long"        // ❌ Same as global
  },
  "longStrategy": {
    "maxLots": 10,                          // ❌ Same as global
    "maxLotsToSell": 1,                     // ❌ Same as global
    "gridIntervalPercent": 10,              // ❌ Same as global
    "profitRequirement": 10,                // ❌ Same as global
    "trailingBuyActivationPercent": 10,     // ❌ Same as global
    "trailingBuyReboundPercent": 5,         // ❌ Same as global
    "trailingSellActivationPercent": 20,    // ❌ Same as global
    "trailingSellPullbackPercent": 10       // ❌ Same as global
  },
  "beta": {
    "enableBetaScaling": false,   // ❌ Same as global
    "beta": 2.592,                // ✅ DIFFERENT - KEEP
    "betaFactor": 2.592,          // ✅ DIFFERENT - KEEP
    "coefficient": 1,             // ❌ Same as global
    "isManualBetaOverride": false // ❌ Same as global
  },
  "dynamicFeatures": {
    "enableDynamicGrid": false,                        // ❌ Same as global
    "dynamicGridMultiplier": 1,                        // ❌ Same as global
    "enableConsecutiveIncrementalBuyGrid": false,      // ❌ Same as global
    "gridConsecutiveIncrement": 5,                     // ❌ Same as global
    "enableConsecutiveIncrementalSellProfit": false,   // ❌ Same as global
    "enableScenarioDetection": false,                  // ❌ Same as global
    "normalizeToReference": true                       // ✅ DIFFERENT - KEEP
  },
  "adaptiveStrategy": {
    // ALL ❌ Same as global
  }
}
```

#### Desired State (PLTR):
```json
"PLTR": {
  "beta": {
    "beta": 2.592,
    "betaFactor": 2.592
  },
  "dynamicFeatures": {
    "normalizeToReference": true
  }
}
```

**Benefits**:
- 95% reduction in file size for PLTR
- Clear visibility of what makes PLTR special
- Global defaults can change without affecting stock-specific overrides

### Implementation Requirements

#### 4.1 Loading Logic (Read Operation)

**Function: `getStockParameters(symbol)`**

The loading function must:
1. Load global defaults
2. Load stock-specific overrides (if they exist)
3. Deep merge: `global + stock_overrides`
4. Return complete parameter set

```javascript
// frontend/src/utils/stockDefaults.js
export const getStockParameters = (symbol) => {
  const globalDefaults = backtestDefaults.global;
  const stockOverrides = backtestDefaults[symbol];

  if (!stockOverrides) {
    // No stock-specific overrides - return global defaults
    return deepClone(globalDefaults);
  }

  // Deep merge: global defaults + stock-specific overrides
  return {
    basic: {
      ...globalDefaults.basic,
      ...(stockOverrides.basic || {})
    },
    longStrategy: {
      ...globalDefaults.longStrategy,
      ...(stockOverrides.longStrategy || {})
    },
    shortStrategy: {
      ...globalDefaults.shortStrategy,
      ...(stockOverrides.shortStrategy || {}),
      stopLoss: {
        ...(globalDefaults.shortStrategy?.stopLoss || {}),
        ...(stockOverrides.shortStrategy?.stopLoss || {})
      }
    },
    beta: {
      ...globalDefaults.beta,
      ...(stockOverrides.beta || {})
    },
    dynamicFeatures: {
      ...globalDefaults.dynamicFeatures,
      ...(stockOverrides.dynamicFeatures || {})
    },
    adaptiveStrategy: {
      ...globalDefaults.adaptiveStrategy,
      ...(stockOverrides.adaptiveStrategy || {})
    }
  };
};
```

**Key Points**:
- If stock has NO overrides → return complete global defaults
- If stock has overrides → merge to produce complete parameter set
- Merging handles nested structures (e.g., stopLoss within shortStrategy)

#### 4.2 Saving Logic (Write Operation)

**Function: `saveStockParameters(symbol, parameters)`**

The saving function must:
1. Load global defaults
2. Compare `parameters` with global defaults
3. Extract ONLY parameters that differ
4. Save minimal diff to backtestDefaults.json
5. Delete sections that have NO differences

```javascript
// Backend utility: utils/backtestDefaultsManager.js
function saveStockParameters(symbol, parameters) {
  const globalDefaults = backtestDefaults.global;
  const stockOverrides = {};

  // Compare each section
  for (const section of ['basic', 'longStrategy', 'shortStrategy', 'beta', 'dynamicFeatures', 'adaptiveStrategy']) {
    const sectionDiff = extractDifferences(
      globalDefaults[section],
      parameters[section]
    );

    // Only include section if there are differences
    if (Object.keys(sectionDiff).length > 0) {
      stockOverrides[section] = sectionDiff;
    }
  }

  // If NO differences at all, remove stock entry entirely
  if (Object.keys(stockOverrides).length === 0) {
    delete backtestDefaults[symbol];
  } else {
    backtestDefaults[symbol] = stockOverrides;
  }

  // Persist to file
  fs.writeFileSync(
    'backtestDefaults.json',
    JSON.stringify(backtestDefaults, null, 2)
  );
}

function extractDifferences(globalObj, stockObj) {
  const diff = {};

  for (const key in stockObj) {
    // Handle nested objects (e.g., stopLoss)
    if (typeof stockObj[key] === 'object' && !Array.isArray(stockObj[key])) {
      const nestedDiff = extractDifferences(
        globalObj[key] || {},
        stockObj[key]
      );
      if (Object.keys(nestedDiff).length > 0) {
        diff[key] = nestedDiff;
      }
    }
    // Compare primitive values
    else if (stockObj[key] !== globalObj[key]) {
      diff[key] = stockObj[key];
    }
  }

  return diff;
}
```

**Key Points**:
- Compare parameter-by-parameter
- Handle nested objects (stopLoss, etc.)
- Empty sections are omitted
- Stocks with NO differences are removed entirely

#### 4.3 API Endpoints (Optional - For Future UI)

```javascript
// POST /api/backtest-defaults/:symbol
// Update stock-specific parameters (saves only differences)
router.post('/backtest-defaults/:symbol', (req, res) => {
  const { symbol } = req.params;
  const { parameters } = req.body;

  saveStockParameters(symbol, parameters);

  res.json({
    success: true,
    message: `Saved parameters for ${symbol} (differences only)`
  });
});

// DELETE /api/backtest-defaults/:symbol
// Remove all stock-specific overrides (revert to global defaults)
router.delete('/backtest-defaults/:symbol', (req, res) => {
  const { symbol } = req.params;

  delete backtestDefaults[symbol];
  persistBacktestDefaults();

  res.json({
    success: true,
    message: `Removed stock-specific parameters for ${symbol} (now using global defaults)`
  });
});
```

## Requirement 5: Clean Up Existing backtestDefaults.json

### Task: Remove Duplicate Parameters

**Goal**: Update the current `backtestDefaults.json` to remove all parameters that match global defaults.

### Current Analysis

Looking at the existing file, here are the stocks and their actual differences:

#### PLTR (Currently 109 lines → Should be ~10 lines)
**Differences Only**:
```json
"PLTR": {
  "beta": {
    "beta": 2.592,
    "betaFactor": 2.592
  },
  "dynamicFeatures": {
    "normalizeToReference": true
  }
}
```

#### AAPL (Currently 53 lines → Should be ~30 lines)
**Differences Only**:
```json
"AAPL": {
  "basic": {
    "lotSizeUsd": 15000
  },
  "longStrategy": {
    "maxLots": 8,
    "maxLotsToSell": 2,
    "gridIntervalPercent": 15,
    "profitRequirement": 15,
    "trailingBuyActivationPercent": 15,
    "trailingBuyReboundPercent": 7.5,
    "trailingSellActivationPercent": 25,
    "trailingSellPullbackPercent": 12.5
  },
  "shortStrategy": {
    "gridIntervalPercent": 15,
    "profitRequirement": 15
  },
  "beta": {
    "beta": 1.5,
    "betaFactor": 1.5
  },
  "dynamicFeatures": {
    "enableScenarioDetection": true,
    "normalizeToReference": true
  },
  "adaptiveStrategy": {
    "enableAdaptiveStrategy": true
  }
}
```

#### TSLA (Currently 53 lines → Should be ~10 lines)
**Differences Only**:
```json
"TSLA": {
  "beta": {
    "beta": 2.592,
    "betaFactor": 2.592
  },
  "dynamicFeatures": {
    "enableConsecutiveIncrementalBuyGrid": true,
    "normalizeToReference": true
  }
}
```

#### SHOP (Currently 53 lines → Should be ~20 lines)
**Differences Only**:
```json
"SHOP": {
  "longStrategy": {
    "profitRequirement": 5,
    "trailingBuyActivationPercent": 5,
    "trailingSellActivationPercent": 5,
    "trailingSellPullbackPercent": 0
  },
  "shortStrategy": {
    "profitRequirement": 5
  },
  "beta": {
    "beta": 2.592,
    "betaFactor": 2.592
  },
  "dynamicFeatures": {
    "enableConsecutiveIncrementalSellProfit": true,
    "normalizeToReference": true
  }
}
```

#### MSFT (Currently 53 lines → Should be REMOVED)
**Differences**: NONE - All parameters match global defaults
```json
// MSFT should be completely removed from backtestDefaults.json
// It will automatically use global defaults
```

### File Size Reduction

**Before**: 326 lines total
**After**: ~70 lines total (78% reduction)

### Migration Steps

1. **Create Backup**:
   ```bash
   cp backtestDefaults.json backtestDefaults.json.backup
   ```

2. **Run Cleanup Script**:
   ```javascript
   // scripts/cleanupBacktestDefaults.js
   const fs = require('fs');
   const backtestDefaults = require('../frontend/src/config/backtestDefaults.json');

   function cleanupStockDefaults() {
     const globalDefaults = backtestDefaults.global;
     const cleaned = { global: globalDefaults };

     for (const symbol in backtestDefaults) {
       if (symbol === 'global') continue;

       const stockParams = backtestDefaults[symbol];
       const stockDiff = {};

       // Extract differences for each section
       for (const section in stockParams) {
         const sectionDiff = extractDifferences(
           globalDefaults[section] || {},
           stockParams[section]
         );

         if (Object.keys(sectionDiff).length > 0) {
           stockDiff[section] = sectionDiff;
         }
       }

       // Only add stock if it has differences
       if (Object.keys(stockDiff).length > 0) {
         cleaned[symbol] = stockDiff;
       } else {
         console.log(`✅ Removed ${symbol} (no differences from global)`);
       }
    }

     return cleaned;
   }

   function extractDifferences(global, stock) {
     const diff = {};

     for (const key in stock) {
       if (typeof stock[key] === 'object' && !Array.isArray(stock[key])) {
         const nestedDiff = extractDifferences(global[key] || {}, stock[key]);
         if (Object.keys(nestedDiff).length > 0) {
           diff[key] = nestedDiff;
         }
       } else if (stock[key] !== global[key]) {
         diff[key] = stock[key];
       }
     }

     return diff;
   }

   // Run cleanup
   const cleaned = cleanupStockDefaults();
   fs.writeFileSync(
     '../frontend/src/config/backtestDefaults.json',
     JSON.stringify(cleaned, null, 2)
   );

   console.log('✅ backtestDefaults.json cleaned successfully!');
   ```

3. **Verify with Tests**:
   - Load parameters for each stock using `getStockParameters()`
   - Compare with original full parameters
   - Ensure no differences (except omitted duplicates)

### Benefits of Cleanup

1. **Clarity**: Immediately see what makes each stock unique
2. **Maintainability**: Changing global defaults doesn't require updating all stocks
3. **Performance**: Smaller file, faster loading
4. **Correctness**: No risk of stale parameters that should have been global

### Expected Final Structure

```json
{
  "global": {
    "basic": { ... },
    "longStrategy": { ... },
    "shortStrategy": { ... },
    "beta": { ... },
    "dynamicFeatures": { ... },
    "adaptiveStrategy": { ... }
  },
  "PLTR": {
    "beta": {
      "beta": 2.592,
      "betaFactor": 2.592
    },
    "dynamicFeatures": {
      "normalizeToReference": true
    }
  },
  "AAPL": {
    "basic": { "lotSizeUsd": 15000 },
    "longStrategy": { /* 8 overrides */ },
    "shortStrategy": { /* 2 overrides */ },
    "beta": { "beta": 1.5, "betaFactor": 1.5 },
    "dynamicFeatures": { /* 2 overrides */ },
    "adaptiveStrategy": { "enableAdaptiveStrategy": true }
  },
  "TSLA": {
    "beta": { "beta": 2.592, "betaFactor": 2.592 },
    "dynamicFeatures": {
      "enableConsecutiveIncrementalBuyGrid": true,
      "normalizeToReference": true
    }
  },
  "SHOP": {
    "longStrategy": { /* 4 overrides */ },
    "shortStrategy": { "profitRequirement": 5 },
    "beta": { "beta": 2.592, "betaFactor": 2.592 },
    "dynamicFeatures": {
      "enableConsecutiveIncrementalSellProfit": true,
      "normalizeToReference": true
    }
  }
}
```

**Note**: MSFT is completely removed since it has no stock-specific parameters.

## Updated Success Criteria

Adding to the original success criteria:

8. ✅ **backtestDefaults.json only stores parameter differences** from global defaults
9. ✅ **Loading merges stock-specific + global** to produce complete parameter set
10. ✅ **Saving extracts only differences** before persisting to file
11. ✅ **Existing backtestDefaults.json cleaned up** to remove duplicates
12. ✅ **MSFT entry removed** since it had no stock-specific parameters

## Implementation Tasks

### Phase 6: Differential Defaults (4 hours)

1. **Update `getStockParameters()` function** (1 hour)
   - Ensure proper deep merging of global + stock overrides
   - Add unit tests for merge logic

2. **Create `saveStockParameters()` function** (1.5 hours)
   - Implement difference extraction logic
   - Handle nested objects correctly
   - Add unit tests for diff extraction

3. **Create cleanup script** (0.5 hour)
   - Script to clean existing backtestDefaults.json
   - Run and verify results

4. **Update documentation** (1 hour)
   - Document differential storage approach
   - Update README with maintenance guidelines
   - Add examples of adding new stock-specific parameters

## Risk Assessment

**Low Risk**:
- Existing `getStockParameters()` already does merging
- Only need to enhance save logic
- Backward compatible (can still read old full-parameter format)

**Mitigation**:
- Keep backup of original backtestDefaults.json
- Extensive unit tests for merge/diff logic
- Gradual migration (can run both formats during transition)
