# Spec 42: Portfolio Backtest Enhancements - Implementation Tasks

## Overview

**Estimated Time:** 6-9 days
**Dependencies:** Spec 39, Spec 36, Spec 37

This spec enhances the Portfolio Backtest feature with 4 major improvements:
1. Stock-specific beta scaling with on-demand fetching
2. Enhanced beta UI showing per-stock beta values
3. URL behavior consistency (localStorage, no URL rewriting)
4. Homepage navigation integration

---

## Phase 1: Backend Beta System (2-3 days)

### Task 1.1: Database Schema
**Time:** 1 hour

- [ ] Create `stock_betas` table in database schema
- [ ] Add `symbol` (VARCHAR, PRIMARY KEY)
- [ ] Add `beta` (REAL, NOT NULL, CHECK 0.1-5.0)
- [ ] Add `source` (VARCHAR, CHECK 'provider' or 'manual')
- [ ] Add `updated_at` (DATETIME, NOT NULL)
- [ ] Add `provider_name` (VARCHAR, default 'yahoo_finance')
- [ ] Add `metadata` (TEXT for JSON)
- [ ] Add `created_at` (DATETIME, NOT NULL)
- [ ] Create index on `updated_at`

**Files:**
- `backend/database.js` - Add table creation in `initializeDatabase()`

**Verification:**
```bash
sqlite3 backend/stocks.db ".schema stock_betas"
```

---

### Task 1.2: Beta Service Module - Core Logic
**Time:** 4-6 hours

- [ ] Create `backend/services/betaService.js`
- [ ] Implement `getBeta(symbol)` - Multi-tier lookup
  - [ ] Check backtestDefaults.json (Tier 1)
  - [ ] Check database cache (Tier 2)
  - [ ] Fetch from provider (Tier 3)
  - [ ] Fallback to default 1.0 (Tier 4)
- [ ] Implement `isCacheStale(updatedAt)` - 30-day expiration check
- [ ] Implement `fetchFromYahooFinance(symbol)` - Provider integration
- [ ] Add beta validation (0.1 - 5.0 range)
- [ ] Add error handling and logging

**Files:**
- `backend/services/betaService.js` (NEW)

**Verification:**
```javascript
const betaService = require('./services/betaService');

// Test Tier 1 (file override)
const appleBeta = await betaService.getBeta('AAPL'); // Should return 1.5 from file

// Test Tier 3 (provider fetch)
const teslaBeta = await betaService.getBeta('TSLA'); // Should fetch from Yahoo
```

---

### Task 1.3: Beta Service - Batch Operations
**Time:** 2-3 hours

- [ ] Implement `getBetaBatch(symbols)` - Parallel batch fetch
  - [ ] Map over symbols with `Promise.all()`
  - [ ] Call `getBeta()` for each symbol
  - [ ] Return object keyed by symbol
- [ ] Implement rate limiting (max 5 concurrent requests)
- [ ] Add timeout handling (5 seconds per request)
- [ ] Add retry logic with exponential backoff

**Files:**
- `backend/services/betaService.js` (additions)

**Verification:**
```javascript
const betas = await betaService.getBetaBatch(['TSLA', 'META', 'AAPL', 'GOOGL', 'PLTR']);
console.log(betas);
// Should complete in < 5 seconds for 5 stocks
```

---

### Task 1.4: Beta Service - Refresh Logic
**Time:** 2 hours

- [ ] Implement `refreshBeta(symbol)` - Force provider fetch
  - [ ] Check if file override exists (throw error if true)
  - [ ] Get previous beta from database
  - [ ] Fetch new beta from provider
  - [ ] Update database cache
  - [ ] Return comparison (new vs old)
- [ ] Add change detection and logging

**Files:**
- `backend/services/betaService.js` (additions)

**Verification:**
```javascript
const result = await betaService.refreshBeta('TSLA');
console.log(result);
// { symbol: 'TSLA', beta: 2.15, previousBeta: 2.1, changed: true }
```

---

### Task 1.5: API Endpoints
**Time:** 3-4 hours

- [ ] Create `GET /api/beta/:symbol` endpoint
  - [ ] Call `betaService.getBeta()`
  - [ ] Return beta + metadata (source, age, isStale)
  - [ ] Handle errors gracefully
- [ ] Create `POST /api/beta/batch` endpoint
  - [ ] Accept `{ symbols: [...] }` in body
  - [ ] Call `betaService.getBetaBatch()`
  - [ ] Return beta map + metadata
- [ ] Create `POST /api/beta/:symbol/refresh` endpoint
  - [ ] Call `betaService.refreshBeta()`
  - [ ] Return new beta + comparison
- [ ] Add input validation (symbol format, array length)
- [ ] Add error responses (400, 404, 500)

**Files:**
- `backend/routes/betaRoutes.js` (NEW)
- `backend/server.js` - Add route: `app.use('/api/beta', betaRoutes)`

**Verification:**
```bash
# Test single beta
curl http://localhost:3001/api/beta/TSLA | jq

# Test batch
curl -X POST http://localhost:3001/api/beta/batch \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["TSLA", "META", "AAPL"]}' | jq

# Test refresh
curl -X POST http://localhost:3001/api/beta/TSLA/refresh | jq
```

---

### Task 1.6: Yahoo Finance Integration
**Time:** 2-3 hours

- [ ] Add beta parsing to existing Yahoo Finance service
- [ ] Implement `getStockBeta(symbol)` function
- [ ] Parse beta from Yahoo Finance API response
- [ ] Handle missing beta data gracefully
- [ ] Add retry logic for API failures
- [ ] Add rate limiting (5 requests/second)

**Files:**
- `backend/services/yahooFinanceService.js` (additions)

**Verification:**
```javascript
const yahooFinance = require('./services/yahooFinanceService');
const beta = await yahooFinance.getStockBeta('TSLA');
console.log(beta); // 2.1
```

---

## Phase 2: Frontend Beta UI (2-3 days)

### Task 2.1: StockBetaTable Component
**Time:** 4-5 hours

- [ ] Create `frontend/src/components/backtest/shared/StockBetaTable.js`
- [ ] Build table structure (headers: Symbol, Beta, Source, Effective, Last Updated, Actions)
- [ ] Map over stocks array to render rows
- [ ] Display beta value (3 decimal places)
- [ ] Calculate and display effective beta (beta × coefficient)
- [ ] Format timestamp (relative: "2 min ago", "3 days ago")
- [ ] Add refresh button per row (disabled for file source)
- [ ] Add "Refresh All" button in header
- [ ] Handle loading states (show spinner)
- [ ] Handle empty state (no stocks selected)

**Files:**
- `frontend/src/components/backtest/shared/StockBetaTable.js` (NEW)

**Verification:**
- Render with sample data
- Verify all columns display correctly
- Check responsive layout

---

### Task 2.2: BetaSourceBadge Component
**Time:** 1-2 hours

- [ ] Create `frontend/src/components/backtest/shared/BetaSourceBadge.js`
- [ ] Define badge config (color, label, title per source)
  - [ ] File: Blue badge, "From backtestDefaults.json"
  - [ ] Cache: Green badge, "Cached from provider (fresh)"
  - [ ] Live: Yellow badge, "Freshly fetched from provider"
  - [ ] Default: Gray badge, "No data available, using default (1.0)"
- [ ] Add stale indicator (opacity, strikethrough)
- [ ] Add tooltip with full description

**Files:**
- `frontend/src/components/backtest/shared/BetaSourceBadge.js` (NEW)

**Verification:**
- Render all 4 badge types
- Verify colors and labels
- Check stale indicator

---

### Task 2.3: useStockBetas Hook
**Time:** 3-4 hours

- [ ] Create `frontend/src/components/backtest/hooks/useStockBetas.js`
- [ ] Implement `fetchBetas(stockList)` - Call POST /api/beta/batch
- [ ] Implement `refreshBeta(symbol)` - Call POST /api/beta/:symbol/refresh
- [ ] Implement `refreshAll()` - Re-fetch all stocks
- [ ] Add loading state management
- [ ] Add error state management
- [ ] Auto-fetch on mount
- [ ] Auto-fetch when stocks array changes
- [ ] Return: `{ betaData, loading, error, refreshBeta, refreshAll }`

**Files:**
- `frontend/src/components/backtest/hooks/useStockBetas.js` (NEW)

**Verification:**
```javascript
const { betaData, loading, refreshBeta } = useStockBetas(['TSLA', 'META']);
console.log(betaData);
// { TSLA: { beta: 2.1, source: 'live', ... }, META: { beta: 1.45, ... } }
```

---

### Task 2.4: Enhanced BetaControlsSection
**Time:** 2-3 hours

- [ ] Open `frontend/src/components/backtest/sections/BetaControlsSection.js`
- [ ] Import `StockBetaTable` and `useStockBetas`
- [ ] Add portfolio mode detection
- [ ] Integrate `useStockBetas` hook for portfolio mode
- [ ] Pass beta data to `StockBetaTable`
- [ ] Pass refresh handlers to `StockBetaTable`
- [ ] Keep existing single mode UI unchanged
- [ ] Handle loading state (show spinner in table)
- [ ] Handle error state (show error message)

**Files:**
- `frontend/src/components/backtest/sections/BetaControlsSection.js` (modify)

**Verification:**
- Load portfolio form with 3-5 stocks
- Verify beta table displays
- Test refresh button
- Test "Refresh All" button

---

### Task 2.5: CSS Styling
**Time:** 2-3 hours

- [ ] Open `frontend/src/components/backtest/BacktestForm.css`
- [ ] Add `.stock-beta-table` styles
- [ ] Add table header styles
- [ ] Add table row styles (with hover effect)
- [ ] Add badge styles (4 colors: blue, green, yellow, gray)
- [ ] Add stale badge styles (opacity, strikethrough)
- [ ] Add refresh button styles
- [ ] Add loading spinner styles
- [ ] Test responsive layout (table should scroll on mobile)

**Files:**
- `frontend/src/components/backtest/BacktestForm.css` (additions)

**Verification:**
- Check all styles render correctly
- Test hover effects
- Test responsive breakpoints

---

## Phase 3: URL Behavior Fix (1 day)

### Task 3.1: Remove URL Parameter Encoding
**Time:** 2-3 hours

- [ ] Open `frontend/src/components/PortfolioBacktestForm.js`
- [ ] Remove all URLParameterManager imports and usage
- [ ] Remove any `updateURL()` or `encodeToURL()` calls
- [ ] Verify form no longer updates URL on parameter change

**Files:**
- `frontend/src/components/PortfolioBacktestForm.js` (modify)

**Verification:**
- Load `/portfolio-backtest`
- Change parameters
- Verify URL stays clean (no query params appended)

---

### Task 3.2: Add localStorage Persistence
**Time:** 3-4 hours

- [ ] Add localStorage save logic to PortfolioBacktestForm
  - [ ] Use `useEffect` with debounce (1 second)
  - [ ] Save on any parameter change
  - [ ] Key: `'portfolioBacktestConfig'`
- [ ] Add localStorage load logic
  - [ ] Load on component mount
  - [ ] Priority: URL params → localStorage → defaults
- [ ] Implement `parseURLParameters()` function
  - [ ] Parse stocks (comma-separated)
  - [ ] Parse numbers (totalCapital, lotSizeUsd, etc.)
  - [ ] Parse defaultParams from remaining query params
- [ ] One-time URL parsing (on mount only, don't update URL)

**Files:**
- `frontend/src/components/PortfolioBacktestForm.js` (modify)

**Verification:**
- Load form, change parameters, reload page
- Verify parameters restored from localStorage
- Load form with URL params: `/portfolio-backtest?stocks=TSLA,META&totalCapital=50000`
- Verify parameters loaded from URL
- Verify URL doesn't update after loading

---

### Task 3.3: Update ParameterHelper
**Time:** 1-2 hours

- [ ] Open `frontend/src/components/backtest/utils/ParameterHelper.js`
- [ ] Add `saveToLocalStorage(key, parameters)` method
  - [ ] JSON.stringify with timestamp
  - [ ] Handle QuotaExceededError
- [ ] Add `loadFromLocalStorage(key)` method
  - [ ] JSON.parse
  - [ ] Remove timestamp field
  - [ ] Handle parse errors
- [ ] Add `clearLocalStorage(key)` method
- [ ] Add `clearOldData()` method for quota management

**Files:**
- `frontend/src/components/backtest/utils/ParameterHelper.js` (additions)

**Verification:**
```javascript
ParameterHelper.saveToLocalStorage('test', { foo: 'bar' });
const data = ParameterHelper.loadFromLocalStorage('test');
console.log(data); // { foo: 'bar' }
```

---

## Phase 4: Navigation (0.5 days)

### Task 4.1: Add Portfolio Card to Homepage
**Time:** 2-3 hours

- [ ] Find homepage component (likely `frontend/src/App.js` or `HomePage.js`)
- [ ] Locate Testing Mode section
- [ ] Add third card for Portfolio Backtest
  - [ ] Title: "Portfolio Backtest"
  - [ ] Description: "Test strategy across multiple stocks"
  - [ ] Link: `/portfolio-backtest`
  - [ ] Icon: `<Briefcase />` from lucide-react
- [ ] Ensure consistent styling with existing cards
- [ ] Update grid layout to accommodate 3 cards

**Files:**
- `frontend/src/App.js` or `frontend/src/components/HomePage.js` (modify)

**Verification:**
- Visit `http://localhost:3000/`
- Verify Portfolio Backtest card appears
- Click card, verify navigation to `/portfolio-backtest`

---

### Task 4.2: CSS Updates for Navigation
**Time:** 1 hour

- [ ] Update homepage CSS for 3-card layout
- [ ] Ensure responsive design (stack on mobile)
- [ ] Add hover effects consistent with other cards
- [ ] Test on different screen sizes

**Files:**
- `frontend/src/App.css` or `frontend/src/components/HomePage.css` (modify)

**Verification:**
- Test desktop layout (3 cards in a row)
- Test tablet layout (2 cards, 1 below)
- Test mobile layout (stacked vertically)

---

## Phase 5: Integration & Testing (1-2 days)

### Task 5.1: End-to-End Testing
**Time:** 3-4 hours

- [ ] Test beta fetching on portfolio form load
  - [ ] Select 3 stocks, verify betas fetch in parallel
  - [ ] Verify loading state shows during fetch
  - [ ] Verify beta table populates with results
- [ ] Test beta source indicators
  - [ ] Stock with file override shows blue "File" badge
  - [ ] Stock fetched from provider shows yellow "Live" badge
  - [ ] Cached stock shows green "Cache" badge
- [ ] Test beta refresh
  - [ ] Click refresh on single stock, verify API call
  - [ ] Click "Refresh All", verify all stocks update
  - [ ] Verify file-based stocks cannot be refreshed
- [ ] Test localStorage persistence
  - [ ] Change parameters, reload page
  - [ ] Verify parameters restored correctly
- [ ] Test URL sharing
  - [ ] Load `/portfolio-backtest?stocks=TSLA,META&totalCapital=50000`
  - [ ] Verify parameters loaded from URL
  - [ ] Change parameters, verify URL stays clean

**Verification Checklist:**
- [ ] Beta table displays for portfolio with 1 stock
- [ ] Beta table displays for portfolio with 10 stocks
- [ ] Refresh single stock works
- [ ] Refresh all stocks works
- [ ] localStorage saves and restores parameters
- [ ] URL params load correctly
- [ ] URL doesn't update on parameter change

---

### Task 5.2: Performance Testing
**Time:** 2-3 hours

- [ ] Test batch beta fetch with 10 stocks
  - [ ] Verify completes in < 5 seconds
  - [ ] Check network tab for parallel requests
- [ ] Test beta fetch with 20 stocks
  - [ ] Verify progressive loading (non-blocking UI)
  - [ ] Check rate limiting works (max 5 concurrent)
- [ ] Test localStorage quota
  - [ ] Save large parameter sets
  - [ ] Verify quota exceeded handling
- [ ] Test form responsiveness during beta loading
  - [ ] Verify user can change parameters while betas load
  - [ ] Verify form doesn't freeze

**Performance Benchmarks:**
- [ ] 5 stocks: < 3 seconds
- [ ] 10 stocks: < 5 seconds
- [ ] 20 stocks: < 10 seconds
- [ ] UI remains responsive during all operations

---

### Task 5.3: Error Handling Testing
**Time:** 2 hours

- [ ] Test beta fetch failures
  - [ ] Disconnect internet, verify fallback to cache
  - [ ] Clear cache, verify fallback to default (1.0)
  - [ ] Verify error message displays
- [ ] Test API errors
  - [ ] Stop backend server, verify error handling
  - [ ] Send invalid symbols, verify 400 error
- [ ] Test edge cases
  - [ ] Empty stock list (should show no beta table)
  - [ ] Single stock (should show 1-row table)
  - [ ] Duplicate stocks (should deduplicate)
  - [ ] Invalid symbols (should show error)

**Error Scenarios:**
- [ ] Network error during beta fetch
- [ ] API timeout (> 5 seconds)
- [ ] Invalid beta value from provider (< 0.1 or > 5.0)
- [ ] localStorage quota exceeded
- [ ] Invalid URL parameters

---

### Task 5.4: Browser Compatibility
**Time:** 1-2 hours

- [ ] Test in Chrome (latest)
- [ ] Test in Firefox (latest)
- [ ] Test in Safari (latest)
- [ ] Test in Edge (latest)
- [ ] Verify localStorage works in all browsers
- [ ] Verify CSS renders correctly in all browsers

**Compatibility Checklist:**
- [ ] Chrome: Beta table, badges, refresh buttons
- [ ] Firefox: Same as Chrome
- [ ] Safari: Same as Chrome
- [ ] Edge: Same as Chrome
- [ ] Mobile Safari: Responsive layout

---

### Task 5.5: Documentation Updates
**Time:** 2 hours

- [ ] Update README with new beta fetching feature
- [ ] Document API endpoints in API docs
- [ ] Add JSDoc comments to new functions
- [ ] Create migration guide for users
- [ ] Update changelog

**Files:**
- `README.md` (updates)
- `docs/API.md` (if exists)
- Inline JSDoc comments

---

## Phase 6: Cleanup & Polish (0.5 days)

### Task 6.1: Code Review
**Time:** 2 hours

- [ ] Review all new code for consistency
- [ ] Check for unused imports
- [ ] Verify error handling is comprehensive
- [ ] Check for console.log statements (remove or convert to proper logging)
- [ ] Run ESLint and fix any errors

**Files:**
- All modified/new files

---

### Task 6.2: Performance Optimization
**Time:** 2 hours

- [ ] Add React.memo() to StockBetaTable if needed
- [ ] Optimize beta fetch (batch size, parallelization)
- [ ] Add caching to avoid redundant fetches
- [ ] Minimize re-renders

**Files:**
- `StockBetaTable.js`
- `useStockBetas.js`

---

### Task 6.3: Final Testing
**Time:** 2 hours

- [ ] Run full regression test suite
- [ ] Verify no breaking changes to existing features
- [ ] Test single stock form (should be unaffected)
- [ ] Test batch mode (should be unaffected)
- [ ] Test portfolio backtest end-to-end

**Regression Checklist:**
- [ ] Single stock backtest still works
- [ ] Batch optimization still works
- [ ] Beta scaling in single form still works
- [ ] All other features unchanged

---

## Task Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1: Backend Beta System | 6 tasks | 2-3 days |
| Phase 2: Frontend Beta UI | 5 tasks | 2-3 days |
| Phase 3: URL Behavior Fix | 3 tasks | 1 day |
| Phase 4: Navigation | 2 tasks | 0.5 days |
| Phase 5: Integration & Testing | 5 tasks | 1-2 days |
| Phase 6: Cleanup & Polish | 3 tasks | 0.5 days |
| **Total** | **24 tasks** | **6-9 days** |

---

## Dependencies

- **Spec 39:** Shared components (BetaControlsSection, hooks, ParameterHelper)
- **Spec 36:** backtestDefaults.json structure
- **Spec 37:** Yahoo Finance API integration
- **Database:** SQLite3 for beta caching
- **External:** Yahoo Finance API

---

## Completion Criteria

- [ ] All 24 tasks completed
- [ ] Beta table displays correctly for portfolio mode
- [ ] Beta fetching works from all 3 tiers (file, cache, provider)
- [ ] Refresh buttons work (single and all)
- [ ] Source badges display correctly
- [ ] URL behavior matches single stock form (clean URL, localStorage)
- [ ] Portfolio Backtest link appears on homepage
- [ ] Navigation works correctly
- [ ] No regressions in existing features
- [ ] All tests passing
- [ ] Documentation updated

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Yahoo Finance API rate limits | Aggressive 30-day caching, rate limiting in code |
| Beta fetch failures | Multi-tier fallback (cache → default) |
| localStorage quota exceeded | Clear old data automatically |
| UI performance with many stocks | Debounce fetches, use React.memo |
| Browser compatibility | Test in all major browsers |

---

**End of Tasks Document**
