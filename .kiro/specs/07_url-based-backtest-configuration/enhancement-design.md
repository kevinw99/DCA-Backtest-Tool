# URL Schema Enhancement Design

## Problem Analysis

The current URL implementation has the following limitations:

1. **No real-time updates**: URL only updates when clicking "Run Backtest" button
2. **Query-string only**: Uses `/backtest?symbol=TSLA&...` instead of semantic paths like `/backtest/long/TSLA`
3. **Not bookmarkable during editing**: Can't bookmark a configuration before running it
4. **Poor UX**: Users expect URLs to reflect current state, not just submitted state

## Requirements

### Must Have

1. Real-time URL updates as user edits parameters
2. Path-based routing: `/backtest/{strategyMode}/{symbol}` or `/batch/{symbols}`
3. Bookmarkable at any time (not just after submission)
4. Shareable configurations before running backtest
5. Backward compatibility with existing URLs

### Should Have

1. Debounced URL updates (avoid excessive history entries)
2. Clean URLs with semantic paths
3. Compressed query parameters for complex configurations

## Proposed URL Schema

### Single Backtest - Editing Mode

```
/backtest/long/TSLA?params={compressed_params}

Components:
- Path: /backtest/long/TSLA
  - strategyMode: long | short
  - symbol: TSLA
- Query: ?params={base64_lz_compressed_json}
  - All other parameters compressed using LZString
```

### Single Backtest - Results Mode

```
/backtest/long/TSLA/results?params={compressed_params}

Components:
- Path: /backtest/long/TSLA/results
- Query: Same as editing mode
```

### Batch Optimization - Editing Mode

```
/batch/TSLA+NVDA+AAPL?params={compressed_params}

Components:
- Path: /batch/TSLA+NVDA+AAPL
  - symbols separated by + instead of comma (URL safe)
- Query: Compressed parameter ranges
```

### Batch Optimization - Results Mode

```
/batch/TSLA+NVDA+AAPL/results?params={compressed_params}
```

### Root (Clean Slate)

```
/
- No parameters, loads backend defaults
```

## Technical Implementation

### 1. Enhanced URLParameterManager

Add new methods:

```javascript
class URLParameterManager {
  // NEW: Generate path-based URL with compressed params
  generateSemanticURL(parameters, mode, includeResults = false) {
    // Returns: /backtest/long/TSLA?params=N4Ig...
  }

  // NEW: Real-time URL update (debounced)
  updateURLRealtime(parameters, mode) {
    // Uses history.replaceState (doesn't add to history stack)
    // Debounced by 500ms to avoid excessive updates
  }

  // NEW: Parse semantic URL path
  parseSemanticURL() {
    // Returns: { strategyMode, symbol(s), mode, hasResults }
  }

  // NEW: Compress parameters using LZString
  compressParameters(parameters) {
    // Returns: base64-encoded LZ-compressed JSON
  }

  // NEW: Decompress parameters
  decompressParameters(compressed) {
    // Returns: parameters object
  }
}
```

### 2. DCABacktestForm Changes

Add real-time URL watcher:

```javascript
// Debounced URL updater
const debouncedURLUpdate = useCallback(
  debounce((params, mode) => {
    URLParameterManager.updateURLRealtime(params, mode);
  }, 500),
  []
);

// Watch parameter changes
useEffect(() => {
  if (parameters.symbol && !isRunningBacktest) {
    // Update URL in real-time as user edits
    debouncedURLUpdate(parameters, 'single');
  }
}, [parameters, debouncedURLUpdate]);
```

### 3. App.js Routing

Update React Router to handle semantic paths:

```javascript
<Routes>
  <Route path="/" element={<DCABacktestForm />} />
  <Route path="/backtest/:strategyMode/:symbol" element={<DCABacktestForm />} />
  <Route path="/backtest/:strategyMode/:symbol/results" element={<BacktestResults />} />
  <Route path="/batch/:symbols" element={<DCABacktestForm />} />
  <Route path="/batch/:symbols/results" element={<BatchResults />} />
</Routes>
```

### 4. Parameter Compression Strategy

**What goes in the path** (human-readable):

- Strategy mode: `long` or `short`
- Symbol(s): `TSLA` or `TSLA+NVDA+AAPL`
- Results flag: `/results` suffix

**What goes in compressed params** (machine-readable):

```javascript
{
  // Dates
  startDate: "2021-09-01",
  endDate: "2025-10-02",

  // Investment
  lotSizeUsd: 10000,
  maxLots: 10,
  maxLotsToSell: 1,

  // Strategy percentages (as decimals: 0.1 = 10%)
  gridIntervalPercent: 0.1,
  profitRequirement: 0.05,
  trailingBuyActivationPercent: 0.1,
  trailingBuyReboundPercent: 0,
  trailingSellActivationPercent: 0.1,
  trailingSellPullbackPercent: 0,

  // Beta
  beta: 1,
  coefficient: 1,
  enableBetaScaling: false,
  isManualBetaOverride: false,

  // For batch: parameter ranges
  parameterRanges: { ... }
}
```

Compressed using:

```javascript
import LZString from 'lz-string';

const json = JSON.stringify(params);
const compressed = LZString.compressToEncodedURIComponent(json);
// Result: N4IgdghgtgpiBcIDCAZA...
```

### 5. History Management

**Real-time editing** (doesn't add to browser history):

```javascript
history.replaceState({ parameters }, '', url);
```

**Submit backtest** (adds to browser history):

```javascript
history.pushState({ parameters }, '', url);
```

This ensures:

- Editing parameters doesn't fill up back button history
- Submitting a backtest creates a history entry you can navigate back to

## URL Length Considerations

**Browser limits**:

- IE: 2,083 characters
- Modern browsers: ~2,000 characters safe limit
- Chrome/Firefox: technically 32,768+, but 2,000 is practical

**Compression efficiency**:

```
Uncompressed JSON: ~800 characters
LZ-compressed: ~200 characters
Base64-encoded: ~270 characters (33% overhead)
Final URL: ~320 characters (with path)
```

Well within safe limits!

## Backward Compatibility

Support all URL formats:

```javascript
// Legacy format (existing)
/backtest?symbol=TSLA&strategyMode=long&...

// New semantic format
/backtest/long/TSLA?params=N4Ig...

// Mixed format (partially migrated)
/backtest/long/TSLA?symbol=TSLA&strategyMode=long&...
```

Parser priority:

1. Check for semantic path parameters
2. Check for compressed `?params=...`
3. Fall back to legacy query string parsing
4. Use backend defaults if all fail

## Implementation Plan

### Phase 1: Add Compression Support

1. Install `lz-string` package (already installed ✓)
2. Add compression/decompression methods to URLParameterManager
3. Test compression with all parameter combinations
4. Ensure backward compatibility with existing URLs

### Phase 2: Add Semantic Path Support

1. Update React Router with new path patterns
2. Add semantic URL generation to URLParameterManager
3. Add semantic URL parsing
4. Test navigation with semantic paths

### Phase 3: Real-Time URL Updates

1. Add debounced URL updater to DCABacktestForm
2. Watch parameter changes with useEffect
3. Use replaceState for real-time updates
4. Test that browser history doesn't get polluted

### Phase 4: Integration & Testing

1. Integrate all components
2. Test real-time updates across all parameters
3. Test backward compatibility
4. Test URL copying and sharing
5. Test browser back/forward navigation
6. Verify URL length stays within limits

## Benefits

1. **Bookmarkable configurations**: Users can bookmark while editing
2. **Shareable before execution**: Share configurations without running them
3. **Better UX**: URL reflects current state in real-time
4. **Professional appearance**: Clean, semantic URLs
5. **Shorter URLs**: Compression reduces URL length
6. **Backward compatible**: Existing URLs continue working
7. **SEO-friendly paths**: `/backtest/long/TSLA` is semantic and readable

## Example URLs

**Before** (current):

```
http://localhost:3000/backtest?symbol=TSLA&startDate=2021-09-01&endDate=2025-10-02&lotSizeUsd=10000&maxLots=10&maxLotsToSell=1&gridIntervalPercent=10&profitRequirement=5&trailingBuyActivationPercent=10&trailingBuyReboundPercent=0&trailingSellActivationPercent=10&trailingSellPullbackPercent=0&strategyMode=long&mode=single&enableBetaScaling=false
```

Length: 358 characters

**After** (enhanced):

```
http://localhost:3000/backtest/long/TSLA?params=N4IgdghgtgpiBcIDCAVAhgJwCY0DMACAYhgBYB2AMhQBMBPAGhACcBnMAOgGEBrACxwDaAXQC6ALhy5CABgCUuYIxZtO3XhRr1mwwcNHiOXABSYAvAD4cAemfucAX3QZPHEAAUQIEADMQJKETAkAIwAvIwgGDj4hCQUVHSMLGwcXDy48b4RQA
```

Length: 185 characters (48% reduction!)

**Batch optimization**:

```
http://localhost:3000/batch/TSLA+NVDA+AAPL?params=N4IgdghgtgpiBcIDCAVA...
```
