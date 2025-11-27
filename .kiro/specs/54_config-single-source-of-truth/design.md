# Design Document: Configuration Single Source of Truth

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         BEFORE (❌ Bad)                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Backend                          Frontend                 │
│  ┌─────────────────────┐          ┌──────────────────────┐ │
│  │ /config/            │          │ /src/config/         │ │
│  │  backtestDefaults   │          │  backtestDefaults    │ │
│  │  .json (445 lines)  │          │  .json (124 lines)   │ │
│  │  [MASTER]           │          │  [OUTDATED COPY]     │ │
│  └─────────────────────┘          └──────────────────────┘ │
│         ↓                                   ↓               │
│    Used by backend                    Used by frontend     │
│    services                           (direct import)      │
│                                                             │
│  ⚠️  PROBLEM: Configuration drift, duplication             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                         AFTER (✅ Good)                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Backend                          Frontend                 │
│  ┌─────────────────────┐          ┌──────────────────────┐ │
│  │ /config/            │          │                      │ │
│  │  backtestDefaults   │◄─────────│  Fetch via API       │ │
│  │  .json              │  HTTP    │  (no local copy)     │ │
│  │  [SINGLE SOURCE]    │  GET     │                      │ │
│  └─────────────────────┘          └──────────────────────┘ │
│         ↓                                                   │
│    Used by backend                                         │
│    + Served via API                                        │
│                                                             │
│  ✅ SOLUTION: Single source of truth, API-driven           │
└─────────────────────────────────────────────────────────────┘
```

## Component Changes

### Backend (Minimal Changes)

#### 1. API Endpoint (Already Added)
**File**: `backend/server.js:589-607`

```javascript
// Get raw backtest defaults config (for frontend)
app.get('/api/config/backtest-defaults', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, '../config/backtestDefaults.json');
    const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    res.json({
      success: true,
      data: rawConfig
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load backtest defaults config',
      message: error.message
    });
  }
});
```

**Purpose**: Serve raw config JSON to frontend for form population

**Existing Endpoints** (No changes needed):
- `GET /api/backtest/defaults` - Returns flattened global defaults
- `GET /api/backtest/defaults/:symbol` - Returns merged stock-specific defaults

### Frontend (Major Refactoring)

#### Files to Update

1. **`utils/stockDefaults.js`**
   - **Current**: Imports JSON directly
   - **New**: Fetches from `/api/config/backtest-defaults`
   - **Caching**: Store fetched config in module variable

2. **`components/backtest/utils/ParameterHelper.js`**
   - **Current**: Imports JSON for parameter validation/helpers
   - **New**: Uses cached config from stockDefaults.js

3. **`components/backtest/utils/BetaCalculator.js`**
   - **Current**: Imports JSON for beta values
   - **New**: Uses cached config from stockDefaults.js

4. **`components/backtest/shared/BetaSourceBadge.js`**
   - **Current**: Imports JSON to check beta sources
   - **New**: Uses cached config from stockDefaults.js

5. **`components/backtest/hooks/useParameterDefaults.js`**
   - **Current**: Imports JSON in hook
   - **New**: Fetches from API on mount

## Implementation Strategy

### Phase 1: Create Config Service (Centralized)

Create `frontend/src/services/configService.js`:

```javascript
// Singleton pattern for config caching
let cachedConfig = null;
let fetchPromise = null;

export const fetchBacktestDefaults = async () => {
  // Return cached if available
  if (cachedConfig) {
    return cachedConfig;
  }

  // Return existing promise if fetch in progress
  if (fetchPromise) {
    return fetchPromise;
  }

  // Fetch from API
  fetchPromise = fetch('http://localhost:3001/api/config/backtest-defaults')
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        cachedConfig = data.data;
        fetchPromise = null;
        return cachedConfig;
      }
      throw new Error(data.error || 'Failed to load config');
    })
    .catch(error => {
      fetchPromise = null;
      throw error;
    });

  return fetchPromise;
};

// Clear cache (for testing or refresh)
export const clearConfigCache = () => {
  cachedConfig = null;
  fetchPromise = null;
};

// Synchronous access (use after initial fetch)
export const getConfigSync = () => {
  if (!cachedConfig) {
    throw new Error('Config not loaded. Call fetchBacktestDefaults() first.');
  }
  return cachedConfig;
};
```

### Phase 2: Update Each Frontend File

**Pattern**:
1. Remove `import backtestDefaults from '../config/backtestDefaults.json'`
2. Import `fetchBacktestDefaults` from configService
3. Convert synchronous functions to async
4. Handle loading states in components

### Phase 3: Delete Old Files

1. Delete `/frontend/src/config/backtestDefaults.json`
2. Keep `/frontend/src/config/backtestDefaults.json.backup` for reference
3. Update `.gitignore` to prevent accidental re-creation

## Data Flow

### Initialization Flow
```
1. User opens frontend
   ↓
2. App.js (or root component) calls fetchBacktestDefaults()
   ↓
3. configService makes HTTP GET /api/config/backtest-defaults
   ↓
4. Backend reads /config/backtestDefaults.json
   ↓
5. Backend returns JSON in response
   ↓
6. configService caches response
   ↓
7. Components use cached config
```

### Form Population Flow
```
1. User opens backtest form
   ↓
2. Component calls getStockParameters(symbol)
   ↓
3. stockDefaults.js uses cached config
   ↓
4. Returns merged defaults for that symbol
   ↓
5. Form fields populate with default values
```

### Backtest Execution Flow (Unchanged)
```
1. User submits form
   ↓
2. Frontend sends parameters to backend
   ↓
3. Backend merges with defaults (server-side)
   ↓
4. Backtest executes with merged parameters
```

## Error Handling

### API Fetch Failure
- **Fallback**: Use minimal hardcoded defaults in frontend
- **User Message**: "Failed to load default parameters. Using basic defaults."
- **Retry**: Provide manual retry button

### Network Latency
- **Loading State**: Show skeleton/spinner while fetching
- **Timeout**: 10 second timeout for config fetch
- **Offline Mode**: Cache config in localStorage for offline use

## Testing Strategy

### Unit Tests
- Test configService caching behavior
- Test stockDefaults merging logic with API data
- Test error handling when API fails

### Integration Tests
- Test frontend form population after API fetch
- Test backtest execution with API-fetched defaults
- Test cache invalidation

### Manual Testing
1. Start backend server
2. Load frontend
3. Verify forms populate with correct defaults
4. Submit backtest
5. Verify results match expected behavior
6. Stop backend → verify graceful degradation
7. Restart backend → verify cache refresh

## Migration Checklist

- [x] Create API endpoint `/api/config/backtest-defaults`
- [ ] Create `frontend/src/services/configService.js`
- [ ] Update `utils/stockDefaults.js` to use API
- [ ] Update `ParameterHelper.js` to use cached config
- [ ] Update `BetaCalculator.js` to use cached config
- [ ] Update `BetaSourceBadge.js` to use cached config
- [ ] Update `useParameterDefaults.js` to use API
- [ ] Delete `/frontend/src/config/backtestDefaults.json`
- [ ] Test all forms load correctly
- [ ] Test backtests execute correctly
- [ ] Update documentation

## Rollback Plan

If issues arise:
1. Restore `/frontend/src/config/backtestDefaults.json` from backup
2. Revert import changes in 5 frontend files
3. Keep new API endpoint (harmless, unused)
4. Document as "future enhancement"
