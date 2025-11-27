# Spec 42: Portfolio Backtest Enhancements - Requirements

## Overview

**Status:** Planning
**Created:** 2025-10-18
**Depends On:** Spec 39 (Shared Backtest Config Components), Spec 36 (Stock-Specific Parameters)

This spec addresses 4 critical enhancements to the Portfolio Backtest feature:

1. **Stock-Specific Beta Scaling System** - On-demand beta fetching with multi-tier caching
2. **Enhanced Beta UI** - Per-stock beta display and management
3. **URL Behavior Consistency** - Match single stock form behavior (no URL rewriting)
4. **Navigation Improvements** - Add portfolio backtest to homepage Testing Mode section

---

## Problem Statement

### Current Limitations

After Spec 39 implementation, the Portfolio Backtest Form has 100% parameter parity with the Single Stock Form. However, several usability and functionality gaps remain:

1. **Beta Scaling Limitations:**
   - Beta values MUST be pre-populated in `backtestDefaults.json`
   - No on-demand fetching from beta provider API
   - UI shows generic note but doesn't display individual stock betas
   - Users can't see which stocks have custom beta vs default beta

2. **URL Behavior Inconsistency:**
   - Portfolio form auto-rewrites URL: `http://localhost:3000/portfolio-backtest?stocks=TSLA,META,...&totalCapital=100000&...`
   - Single stock form preserves clean URL: `http://localhost:3000/`
   - Causes poor UX when bookmarking or sharing links
   - Last used configuration not properly persisted

3. **Navigation Gap:**
   - No direct link to Portfolio Backtest from homepage
   - Users must manually type URL or find link elsewhere
   - Portfolio Backtest is a major feature but hidden

---

## User Requirements

### 1. Stock-Specific Beta Scaling System

**User Story:**
> As a portfolio backtest user, I want each stock in my portfolio to have its own beta value that is automatically fetched from the provider if not already available, so I can get accurate risk-adjusted parameters without manual data entry.

**Acceptance Criteria:**

1. **Multi-Tier Beta Cache System:**
   - **Tier 1 (Static):** backtestDefaults.json - user-defined overrides
   - **Tier 2 (Database):** Cached beta values with timestamps
   - **Tier 3 (Provider):** Live fetch from beta API endpoint

2. **Automatic Beta Resolution:**
   - Check backtestDefaults.json first (highest priority)
   - If not found, check database cache (valid if < 30 days old)
   - If missing or stale, fetch from provider API
   - Store fetched values in database for future use

3. **Performance Requirements:**
   - Batch fetch multiple stock betas in parallel (not sequential)
   - Non-blocking UI - show loading state per stock
   - Cache fetched values to avoid repeated API calls
   - Maximum 5 second timeout per stock beta fetch

4. **Error Handling:**
   - If provider fetch fails, use database cache (even if stale)
   - If no cache exists, fall back to global default beta (1.0)
   - Show warning indicators for fallback values
   - Allow manual retry

**Data Flow:**

```
User selects stocks → Portfolio Form loads
  ↓
For each stock:
  1. Check backtestDefaults.json[symbol].beta.beta
     → If exists: USE (user override)

  2. Check DB: SELECT beta, updated_at FROM stock_betas WHERE symbol = ?
     → If exists AND age < 30 days: USE (fresh cache)

  3. Fetch from API: GET /api/beta/:symbol
     → If success: STORE in DB + USE
     → If failure: FALLBACK to old cache or 1.0

  4. Update UI with beta value + source indicator
```

---

### 2. Enhanced Beta UI

**User Story:**
> As a portfolio backtest user, I want to see beta values for each stock in my portfolio clearly displayed, so I understand how risk scaling is applied to each position.

**Acceptance Criteria:**

1. **Per-Stock Beta Display:**
   - Expandable section showing all stocks in portfolio
   - Each stock shows:
     - Symbol
     - Beta value
     - Source badge (File/Cache/Live/Default)
     - Last updated timestamp (for cache/live)
     - Refresh button

2. **Beta Source Indicators:**
   - **File** (blue badge): From backtestDefaults.json (user override)
   - **Cache** (green badge): From database (< 30 days old)
   - **Live** (yellow badge): Freshly fetched from provider
   - **Default** (gray badge): Fallback to 1.0 (no data available)

3. **Interactive Features:**
   - Refresh button per stock to re-fetch from provider
   - "Refresh All" button to update all stocks
   - Loading spinner while fetching
   - Error state with retry option

4. **Coefficient Control:**
   - Keep existing coefficient slider (0.25 - 3.0×)
   - Show effective beta for each stock: `beta × coefficient`
   - Live preview of adjusted parameters

**UI Mockup:**

```
┌─────────────────────────────────────────────────────────────┐
│ ⚙️ Beta Scaling Controls                                    │
├─────────────────────────────────────────────────────────────┤
│ ☑ Enable Beta Scaling                                       │
│                                                               │
│ Beta Coefficient: [====●====] 1.0x                           │
│                                                               │
│ ▼ Stock-Specific Beta Values (5 stocks)                     │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ Symbol  Beta   Source   Effective  Last Updated   ⟳   │  │
│ │ ──────  ─────  ──────   ─────────  ────────────  ───  │  │
│ │ TSLA    2.100  [Live]   2.10       2 min ago     ⟳    │  │
│ │ META    1.450  [Cache]  1.45       3 days ago    ⟳    │  │
│ │ AAPL    1.500  [File]   1.50       User defined  -    │  │
│ │ GOOGL   1.200  [Cache]  1.20       1 week ago    ⟳    │  │
│ │ PLTR    2.592  [File]   2.59       User defined  -    │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                               │
│ [Refresh All Stocks]                                         │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Notes:**
- Collapsible section to save space (default: expanded)
- When coefficient changes, "Effective" column updates in real-time
- Clicking refresh triggers provider fetch and updates database
- User-defined values (from file) cannot be refreshed (show "-" instead)

---

### 3. URL Behavior Consistency

**User Story:**
> As a portfolio backtest user, I want the URL to remain clean (not filled with parameters) when I use the form, just like the single stock backtest page, so I can bookmark and share a clean link.

**Acceptance Criteria:**

1. **Clean URL Behavior:**
   - Visiting `http://localhost:3000/portfolio-backtest` does NOT modify URL
   - Form loads last used configuration from localStorage
   - No query parameters appended automatically

2. **localStorage Persistence:**
   - Save form state on every parameter change (debounced 1 second)
   - Restore on page load
   - Key: `portfolioBacktestConfig`
   - Include: stocks, totalCapital, lotSizeUsd, maxLotsPerStock, all defaultParams

3. **Backward Compatibility:**
   - URL with query params still works (parse on load)
   - After loading from URL, save to localStorage
   - Don't continue updating URL after initial load

4. **Behavior Parity with Single Stock Form:**
   - Same persistence logic as DCABacktestForm
   - Same restore behavior
   - Users expect consistent experience

**Implementation:**
- Remove URLParameterManager integration
- Add localStorage save/load using ParameterHelper
- Parse URL params only on initial mount
- Never write back to URL

---

### 4. Navigation Improvements

**User Story:**
> As a user visiting the homepage, I want a clear link to Portfolio Backtest in the Testing Mode section, so I can easily access this feature.

**Acceptance Criteria:**

1. **Homepage Testing Mode Section:**
   - Current structure:
     ```
     Testing Mode
     - Single Backtest: Test one parameter combination
     - Batch Optimization: Test multiple parameter combinations
     ```

   - New structure:
     ```
     Testing Mode
     - Single Backtest: Test one parameter combination
     - Batch Optimization: Test multiple parameter combinations
     - Portfolio Backtest: Test strategy across multiple stocks
     ```

2. **Link Behavior:**
   - Clicking "Portfolio Backtest" navigates to `/portfolio-backtest`
   - Icon: TrendingUp (portfolio/multi-stock theme)
   - Consistent styling with existing links

3. **Visual Consistency:**
   - Same card style as Single/Batch
   - Same hover effects
   - Same layout structure

**Implementation:**
- Modify homepage component (likely `src/App.js` or `src/components/HomePage.js`)
- Add Portfolio Backtest card to Testing Mode section
- Ensure responsive layout (3 cards in a row)

---

## Technical Requirements

### Backend Changes

1. **New Database Table:**
   ```sql
   CREATE TABLE IF NOT EXISTS stock_betas (
     symbol VARCHAR(10) PRIMARY KEY,
     beta REAL NOT NULL,
     source VARCHAR(20) NOT NULL,  -- 'provider', 'manual'
     updated_at DATETIME NOT NULL,
     provider_name VARCHAR(50),     -- e.g., 'yahoo_finance'
     metadata TEXT                   -- JSON with extra info
   );
   ```

2. **New API Endpoints:**
   - `GET /api/beta/:symbol` - Get beta for single stock (with auto-fetch if missing)
   - `POST /api/beta/batch` - Get betas for multiple stocks (parallel fetch)
   - `POST /api/beta/:symbol/refresh` - Force refresh from provider
   - `GET /api/beta/:symbol/history` - Get historical beta values (future)

3. **Beta Service Module:**
   - `backend/services/betaService.js`:
     - `getBeta(symbol)` - Multi-tier lookup
     - `getBetaBatch(symbols)` - Parallel batch fetch
     - `refreshBeta(symbol)` - Force provider fetch
     - `cacheBeta(symbol, beta, source)` - Store in DB

4. **Provider Integration:**
   - Reuse existing Yahoo Finance integration from Spec 37
   - Add beta-specific parsing logic
   - Implement retry with exponential backoff
   - Rate limiting (max 5 requests/second)

### Frontend Changes

1. **Enhanced BetaControlsSection:**
   - Add stock list display
   - Add per-stock beta indicators
   - Add refresh buttons
   - Add loading/error states

2. **New Components:**
   - `StockBetaTable.js` - Display stock beta values in table
   - `BetaSourceBadge.js` - Color-coded source indicators

3. **Updated Hooks:**
   - `useBetaScaling.js` - Add batch beta fetching logic
   - New: `useStockBetas.js` - Manage beta state for multiple stocks

4. **localStorage Integration:**
   - Remove URLParameterManager from PortfolioBacktestForm
   - Add localStorage save on parameter change
   - Add localStorage load on mount

5. **Navigation:**
   - Update homepage to add Portfolio Backtest link

---

## Non-Functional Requirements

### Performance

1. **Beta Fetching:**
   - Batch requests complete in < 5 seconds for 10 stocks
   - Parallel requests (not sequential)
   - Non-blocking UI (show progressive loading)

2. **localStorage:**
   - Debounce saves (1 second delay)
   - Async reads/writes
   - Handle quota exceeded errors gracefully

3. **Database:**
   - Index on `symbol` (primary key)
   - Index on `updated_at` for cache expiration queries

### Reliability

1. **Beta Fetching:**
   - Retry failed requests (max 3 attempts)
   - Exponential backoff (1s, 2s, 4s)
   - Fallback to cache on failure
   - Fallback to default (1.0) if no cache

2. **Data Integrity:**
   - Validate beta values (0.1 - 5.0 range)
   - Log all provider fetch operations
   - Store metadata (provider, timestamp)

### Usability

1. **Loading States:**
   - Show spinner while fetching betas
   - Show which stocks are loading vs loaded
   - Allow form interaction while betas load

2. **Error Messages:**
   - Clear error messages for fetch failures
   - Suggest retry actions
   - Indicate when using fallback values

3. **Visual Feedback:**
   - Source badges clearly indicate data origin
   - Stale data warnings (> 30 days)
   - Timestamp shows last update time

---

## Success Criteria

1. **Beta Scaling:**
   - ✅ Betas auto-fetched from provider if not in backtestDefaults.json
   - ✅ Database cache reduces API calls by > 90%
   - ✅ UI clearly shows beta value and source for each stock
   - ✅ Manual refresh works for individual stocks and all stocks

2. **URL Behavior:**
   - ✅ Portfolio backtest URL stays clean (no auto query params)
   - ✅ Last used config restored from localStorage
   - ✅ Shared URLs with params still work (parse on load)

3. **Navigation:**
   - ✅ Portfolio Backtest link visible on homepage
   - ✅ Link works and navigates to correct page
   - ✅ Consistent styling with other Testing Mode options

4. **User Experience:**
   - ✅ Beta fetching happens transparently in background
   - ✅ Users understand where each beta value comes from
   - ✅ Form remains responsive during beta loading
   - ✅ Error recovery works without user intervention

---

## Out of Scope

1. **Historical Beta Tracking** - Future enhancement
2. **Custom Beta Input UI** - Users can edit backtestDefaults.json for now
3. **Beta Charting** - Visual beta trends over time
4. **Multi-Provider Beta Comparison** - Use only Yahoo Finance for now
5. **DCABacktestForm Refactoring** - Separate spec (future)

---

## Dependencies

- **Spec 39:** Shared components (BetaControlsSection, hooks)
- **Spec 36:** backtestDefaults.json structure
- **Spec 37:** Current price API infrastructure (reuse for beta fetching)
- **External:** Yahoo Finance API for beta data

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Yahoo Finance API rate limits | High | Implement aggressive caching, 30-day expiration |
| Beta fetch failures | Medium | Multi-tier fallback system (cache → default) |
| UI performance with many stocks | Low | Virtualized list if portfolio > 20 stocks |
| localStorage quota exceeded | Low | Store only essential data, add error handling |
| Stale beta data | Medium | Show age indicators, allow manual refresh |

---

## Future Enhancements

1. **Historical Beta Tracking:**
   - Store beta value changes over time
   - Chart showing beta trend
   - Use historical average for more stable calculations

2. **Custom Beta Input:**
   - UI to manually edit beta values
   - Save to backtestDefaults.json
   - Override provider values

3. **Beta Alerts:**
   - Notify when beta changes significantly
   - Warning for high-beta portfolios (avg > 1.5)

4. **Multi-Provider Support:**
   - Fetch from multiple sources
   - Compare and average
   - Select preferred provider

---

## Appendix

### Beta Value Sources Priority

1. **backtestDefaults.json** (Highest priority)
   - User-defined overrides
   - Never auto-update
   - Always respected

2. **Database Cache**
   - Fetched from provider
   - Valid if < 30 days old
   - Updated on manual refresh

3. **Live Provider Fetch**
   - Fetched on-demand
   - Cached immediately
   - Used if no cache or cache stale

4. **Global Default** (Fallback)
   - beta = 1.0
   - Used if all else fails
   - Shown with warning

### Beta Fetch Timing

- **On Form Load:** Fetch betas for all selected stocks in parallel
- **On Stock Selection Change:** Fetch beta for newly added stocks
- **On Manual Refresh:** Re-fetch from provider, update cache
- **On Beta Enable Toggle:** Fetch if not already loaded

### localStorage Schema

```javascript
{
  "portfolioBacktestConfig": {
    "stocks": ["TSLA", "META", "AAPL"],
    "totalCapital": 100000,
    "lotSizeUsd": 10000,
    "maxLotsPerStock": 5,
    "startDate": "2020-01-01",
    "endDate": "2024-01-01",
    "defaultParams": {
      "gridIntervalPercent": 10,
      "profitRequirement": 10,
      "enableTrailingStopBuy": true,
      // ... all other params
    },
    "lastUpdated": "2025-10-18T12:34:56.789Z"
  }
}
```

---

**End of Requirements**
