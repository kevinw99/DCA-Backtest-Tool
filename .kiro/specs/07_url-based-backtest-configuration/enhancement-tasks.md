# URL Schema Enhancement - Implementation Tasks

## Phase 1: Add Compression Support to URLParameterManager

### Task 1.1: Add Parameter Compression Methods

**File**: `frontend/src/utils/URLParameterManager.js`

Add methods:

```javascript
/**
 * Compress parameters using LZString
 * @param {Object} parameters - Parameters to compress
 * @returns {string} Base64-encoded compressed string
 */
compressParameters(parameters) {
  try {
    const json = JSON.stringify(parameters);
    const compressed = LZString.compressToEncodedURIComponent(json);
    return compressed;
  } catch (error) {
    console.error('Error compressing parameters:', error);
    return '';
  }
}

/**
 * Decompress parameters from compressed string
 * @param {string} compressed - Compressed parameter string
 * @returns {Object|null} Decompressed parameters or null
 */
decompressParameters(compressed) {
  try {
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) return null;
    return JSON.parse(json);
  } catch (error) {
    console.error('Error decompressing parameters:', error);
    return null;
  }
}
```

**Testing**:

- Test with all single backtest parameters
- Test with all batch parameters
- Test with edge cases (empty, null, undefined)
- Verify compression ratio (should be ~75% reduction)

---

### Task 1.2: Add Semantic URL Generation

**File**: `frontend/src/utils/URLParameterManager.js`

Add method:

```javascript
/**
 * Generate semantic URL with path-based routing
 * @param {Object} parameters - Backtest parameters
 * @param {string} mode - 'single' or 'batch'
 * @param {boolean} includeResults - Include /results suffix
 * @returns {string} Semantic URL
 */
generateSemanticURL(parameters, mode, includeResults = false) {
  try {
    let path = '';

    if (mode === 'single') {
      const strategyMode = parameters.strategyMode || 'long';
      const symbol = parameters.symbol || '';
      path = `/backtest/${strategyMode}/${symbol}`;
    } else if (mode === 'batch') {
      const symbols = parameters.symbols || parameters.parameterRanges?.symbols || [];
      const symbolPath = symbols.join('+');
      path = `/batch/${symbolPath}`;
    }

    if (includeResults) {
      path += '/results';
    }

    // Compress all parameters
    const compressed = this.compressParameters(parameters);
    const url = `${this.baseURL}${path}?params=${compressed}`;

    return url;
  } catch (error) {
    console.error('Error generating semantic URL:', error);
    return window.location.href;
  }
}
```

**Testing**:

- Test single backtest URLs for long/short strategies
- Test batch URLs with multiple symbols
- Test with/without results suffix
- Verify URL format: `/backtest/long/TSLA?params=...`

---

### Task 1.3: Add Semantic URL Parsing

**File**: `frontend/src/utils/URLParameterManager.js`

Add method:

```javascript
/**
 * Parse semantic URL path
 * @returns {Object|null} Parsed path components
 */
parseSemanticURL() {
  try {
    const pathname = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);

    // Check for compressed params
    const compressed = urlParams.get('params');
    let parameters = compressed ? this.decompressParameters(compressed) : null;

    // Parse path components
    const parts = pathname.split('/').filter(p => p);

    if (parts[0] === 'backtest' && parts.length >= 3) {
      // /backtest/{strategyMode}/{symbol}[/results]
      const hasResults = parts[parts.length - 1] === 'results';
      const symbol = hasResults ? parts[2] : parts[parts.length - 1];
      const strategyMode = parts[1];

      return {
        mode: 'single',
        strategyMode,
        symbol,
        hasResults,
        parameters: parameters || {}
      };
    } else if (parts[0] === 'batch' && parts.length >= 2) {
      // /batch/{symbols}[/results]
      const hasResults = parts[parts.length - 1] === 'results';
      const symbolsPath = hasResults ? parts[1] : parts[parts.length - 1];
      const symbols = symbolsPath.split('+');

      return {
        mode: 'batch',
        symbols,
        hasResults,
        parameters: parameters || {}
      };
    }

    return null;
  } catch (error) {
    console.error('Error parsing semantic URL:', error);
    return null;
  }
}
```

**Testing**:

- Test parsing `/backtest/long/TSLA`
- Test parsing `/backtest/short/NVDA`
- Test parsing `/batch/TSLA+NVDA+AAPL`
- Test parsing with `/results` suffix
- Test backward compatibility with legacy URLs

---

## Phase 2: Add Real-Time URL Updates to DCABacktestForm

### Task 2.1: Create Debounced URL Updater

**File**: `frontend/src/components/DCABacktestForm.js`

Add imports:

```javascript
import { debounce } from 'lodash'; // or implement custom debounce
```

Add state and refs:

```javascript
const [isEditingParameters, setIsEditingParameters] = useState(true);
const debouncedURLUpdateRef = useRef(null);
```

Create debounced updater:

```javascript
// Create debounced URL updater (only once)
useEffect(() => {
  debouncedURLUpdateRef.current = debounce((params, mode) => {
    const url = URLParameterManager.generateSemanticURL(params, mode, false);
    window.history.replaceState({ parameters: params }, '', url);
    console.log('= URL updated (real-time):', url);
  }, 500); // 500ms debounce

  return () => {
    debouncedURLUpdateRef.current?.cancel();
  };
}, []);
```

**Testing**:

- Verify debounce works (updates only after 500ms of no changes)
- Verify no memory leaks on component unmount
- Verify replaceState doesn't pollute browser history

---

### Task 2.2: Watch Parameter Changes

**File**: `frontend/src/components/DCABacktestForm.js`

Add effect to watch parameters:

```javascript
// Update URL in real-time as user edits parameters
useEffect(() => {
  // Only update if:
  // 1. We have a symbol (valid configuration)
  // 2. We're in editing mode (not viewing results)
  // 3. We're not currently running a backtest
  if (parameters.symbol && isEditingParameters && !loading) {
    debouncedURLUpdateRef.current?.(parameters, 'single');
  }
}, [parameters, isEditingParameters, loading]);

// Watch batch parameters too
useEffect(() => {
  const symbols = batchParameters.parameterRanges?.symbols || [];
  if (symbols.length > 0 && isEditingParameters && !batchLoading) {
    debouncedURLUpdateRef.current?.(batchParameters, 'batch');
  }
}, [batchParameters, isEditingParameters, batchLoading]);
```

**Testing**:

- Change symbol � URL updates after 500ms
- Change dates � URL updates
- Change strategy parameters � URL updates
- Switch between single/batch � URL updates
- Verify no updates during backtest execution

---

### Task 2.3: Update Backtest Submission to Use pushState

**File**: `frontend/src/components/DCABacktestForm.js`

Modify `handleRunBacktest`:

```javascript
const handleRunBacktest = async () => {
  try {
    setLoading(true);
    setIsEditingParameters(false); // Mark as viewing results

    // Push to history (creates new history entry)
    const url = URLParameterManager.generateSemanticURL(parameters, 'single', true);
    window.history.pushState({ parameters, mode: 'single', results: true }, '', url);
    console.log('=� Running backtest, URL:', url);

    // ... rest of backtest logic
  } catch (error) {
    setIsEditingParameters(true); // Revert to editing on error
    // ... error handling
  }
};
```

**Testing**:

- Run backtest � URL changes to `/backtest/long/TSLA/results`
- Browser back button � Returns to editing mode
- Verify history entry is created (can navigate back)

---

## Phase 3: Update App.js Routing

### Task 3.1: Add Semantic Route Patterns

**File**: `frontend/src/App.js`

Update routes:

```javascript
import { BrowserRouter, Routes, Route, useParams, useLocation } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root - clean slate */}
        <Route path="/" element={<DCABacktestForm />} />

        {/* Single backtest - editing */}
        <Route path="/backtest/:strategyMode/:symbol" element={<DCABacktestForm />} />

        {/* Single backtest - results */}
        <Route path="/backtest/:strategyMode/:symbol/results" element={<DCABacktestForm />} />

        {/* Batch - editing */}
        <Route path="/batch/:symbols" element={<DCABacktestForm />} />

        {/* Batch - results */}
        <Route path="/batch/:symbols/results" element={<DCABacktestForm />} />

        {/* Legacy backward compatibility */}
        <Route path="/backtest" element={<DCABacktestForm />} />
        <Route path="/batch" element={<DCABacktestForm />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Testing**:

- Navigate to `/backtest/long/TSLA` � Form loads with TSLA long params
- Navigate to `/batch/TSLA+NVDA` � Batch form loads with those symbols
- Navigate to legacy `/backtest?symbol=TSLA` � Backward compatibility works
- Browser back/forward � Navigation works correctly

---

### Task 3.2: Initialize Parameters from Semantic URL

**File**: `frontend/src/components/DCABacktestForm.js`

Add effect to load from semantic URL:

```javascript
// Load parameters from semantic URL on mount
useEffect(() => {
  const semanticParams = URLParameterManager.parseSemanticURL();

  if (semanticParams) {
    console.log('=� Loading from semantic URL:', semanticParams);

    if (semanticParams.mode === 'single') {
      // Merge with defaults
      const fullParams = {
        ...defaults,
        ...semanticParams.parameters,
        symbol: semanticParams.symbol,
        strategyMode: semanticParams.strategyMode,
      };

      setParameters(fullParams);
      setStrategyMode(semanticParams.strategyMode);

      // Auto-run if in results mode
      if (semanticParams.hasResults) {
        setIsEditingParameters(false);
        // Trigger backtest execution
        // ... (existing auto-run logic)
      }
    } else if (semanticParams.mode === 'batch') {
      // Similar for batch mode
      // ...
    }
  } else {
    // Try legacy URL format
    const legacyParams = URLParameterManager.decodeParametersFromURL();
    if (legacyParams) {
      console.log('=� Loading from legacy URL:', legacyParams);
      // ... (existing logic)
    }
  }
}, []); // Only on mount
```

**Testing**:

- Open `/backtest/long/TSLA?params=...` � Loads parameters correctly
- Open `/backtest/long/TSLA/results?params=...` � Auto-runs backtest
- Open `/batch/TSLA+NVDA?params=...` � Loads batch configuration
- Open legacy URL � Still works (backward compatibility)

---

## Phase 4: Testing & Validation

### Task 4.1: Manual Testing

- [ ] Create single backtest configuration
- [ ] Verify URL updates in real-time as you edit
- [ ] Copy URL and open in new tab � Same configuration loads
- [ ] Bookmark URL � Bookmark works after browser restart
- [ ] Run backtest � URL changes to include `/results`
- [ ] Browser back button � Returns to editing mode
- [ ] Share URL with colleague � Same configuration loads

### Task 4.2: Test Batch Mode

- [ ] Create batch configuration with 3 symbols
- [ ] Verify URL shows `/batch/TSLA+NVDA+AAPL`
- [ ] Edit parameter ranges � URL updates
- [ ] Copy and share URL � Configuration loads correctly
- [ ] Run batch � URL includes `/results`
- [ ] Click batch result row � Navigates to single backtest with correct params

### Task 4.3: Test Backward Compatibility

- [ ] Open old URL format `/backtest?symbol=TSLA&...`
- [ ] Verify it still works
- [ ] Verify it migrates to new format after first edit
- [ ] Test mixed URLs (partial semantic, partial query string)

### Task 4.4: Test URL Length

- [ ] Create configuration with all parameters
- [ ] Measure URL length (should be < 500 characters)
- [ ] Verify compression is working (compare to uncompressed)
- [ ] Test with batch mode and many parameter ranges

### Task 4.5: Test Edge Cases

- [ ] Invalid symbol in URL � Graceful fallback
- [ ] Corrupted compressed params � Fallback to defaults
- [ ] Missing required parameters � Use defaults
- [ ] XSS attempts in URL � Sanitized correctly
- [ ] Very long symbol names � Handled correctly
- [ ] Special characters in parameters � Encoded properly

---

## Phase 5: Documentation & Cleanup

### Task 5.1: Update README

- Document new URL schema
- Provide examples of shareable URLs
- Explain real-time updates feature

### Task 5.2: Add Code Comments

- Document compression/decompression methods
- Explain debouncing strategy
- Document URL parsing logic

### Task 5.3: Clean Up Console Logs

- Remove debug logs or make them conditional
- Keep important user-facing logs
- Ensure production build has minimal logging

---

## Success Criteria

 URL updates in real-time as user edits parameters (debounced)
 Semantic paths: `/backtest/long/TSLA` instead of `/backtest?symbol=TSLA`
 Bookmarkable URLs work at any time (not just after submission)
 Shared URLs load exact same configuration
 Browser back/forward navigation works correctly
 Backward compatibility with existing URLs maintained
 URL length < 500 characters (well within browser limits)
 No browser history pollution from real-time updates
 Auto-execution works when loading URLs with `/results` suffix
 Batch mode URLs work with multiple symbols

---

## Notes

- **LZString** already installed in package.json (verified)
- **React Router** already installed and configured
- **Lodash** may need to be installed for debounce (or implement custom)
- **Browser compatibility**: Target modern browsers (Chrome, Firefox, Safari, Edge)
- **URL length**: Target < 500 chars, max safe 2,000 chars
