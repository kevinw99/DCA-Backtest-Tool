# Spec 42: Portfolio Backtest Enhancements - Technical Design

## Architecture Overview

This design addresses 4 enhancements to the Portfolio Backtest system:

1. **Beta Scaling System** - Multi-tier caching with on-demand fetching
2. **Enhanced Beta UI** - Per-stock beta display and management
3. **URL Behavior** - localStorage persistence (no URL rewriting)
4. **Navigation** - Homepage integration

---

## 1. Beta Scaling System Architecture

### 1.1 Multi-Tier Cache System

```
┌─────────────────────────────────────────────────────────────┐
│                    Beta Value Resolution                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────┐
              │  Tier 1: Static File      │
              │  backtestDefaults.json    │
              │  Priority: HIGHEST        │
              │  Update: Manual only      │
              └───────────┬───────────────┘
                          │ Not found?
                          ▼
              ┌───────────────────────────┐
              │  Tier 2: Database Cache   │
              │  stock_betas table        │
              │  Priority: MEDIUM         │
              │  Update: Auto (30 days)   │
              └───────────┬───────────────┘
                          │ Not found or stale?
                          ▼
              ┌───────────────────────────┐
              │  Tier 3: Live Provider    │
              │  Yahoo Finance API        │
              │  Priority: LOW            │
              │  Update: On-demand        │
              └───────────┬───────────────┘
                          │ Failed?
                          ▼
              ┌───────────────────────────┐
              │  Fallback: Default        │
              │  beta = 1.0               │
              │  Priority: FALLBACK       │
              └───────────────────────────┘
```

### 1.2 Database Schema

```sql
-- New table for beta value cache
CREATE TABLE IF NOT EXISTS stock_betas (
  symbol VARCHAR(10) PRIMARY KEY,
  beta REAL NOT NULL CHECK(beta >= 0.1 AND beta <= 5.0),
  source VARCHAR(20) NOT NULL CHECK(source IN ('provider', 'manual')),
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  provider_name VARCHAR(50) DEFAULT 'yahoo_finance',
  metadata TEXT,  -- JSON: { "raw_beta": 1.234, "confidence": 0.95 }
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for cache expiration queries
CREATE INDEX IF NOT EXISTS idx_stock_betas_updated
  ON stock_betas(updated_at);
```

**Field Descriptions:**
- `symbol`: Stock ticker (e.g., 'TSLA')
- `beta`: Validated beta value (0.1 - 5.0 range)
- `source`: 'provider' (auto-fetched) or 'manual' (user-entered)
- `updated_at`: Last update timestamp (used for cache expiration)
- `provider_name`: Which API provided the data
- `metadata`: JSON with additional info (raw beta, confidence score, etc.)
- `created_at`: When first fetched

**Cache Expiration:**
- Values > 30 days old are considered stale
- Stale values trigger automatic refresh
- Stale values used as fallback if refresh fails

### 1.3 Backend API Design

#### A. GET /api/beta/:symbol

**Purpose:** Get beta value for a single stock with auto-fetch if missing

**Request:**
```
GET /api/beta/TSLA
```

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "TSLA",
    "beta": 2.1,
    "source": "cache",
    "updatedAt": "2025-10-15T10:30:00Z",
    "age": 259200,  // seconds (3 days)
    "providerName": "yahoo_finance",
    "isStale": false
  }
}
```

**Logic Flow:**
```javascript
async getBeta(symbol) {
  // 1. Check backtestDefaults.json (highest priority)
  const fileDefaults = getBacktestDefaults();
  const fileBeta = fileDefaults[symbol]?.beta?.beta || fileDefaults.global?.beta?.beta;
  if (fileBeta) {
    return { beta: fileBeta, source: 'file' };
  }

  // 2. Check database cache
  const cached = await db.get('SELECT * FROM stock_betas WHERE symbol = ?', [symbol]);
  const isStale = cached && (Date.now() - new Date(cached.updated_at)) > 30 * 24 * 60 * 60 * 1000;

  if (cached && !isStale) {
    return { beta: cached.beta, source: 'cache', updatedAt: cached.updated_at };
  }

  // 3. Fetch from provider
  try {
    const providerBeta = await fetchFromYahooFinance(symbol);

    // Cache the result
    await db.run(`
      INSERT OR REPLACE INTO stock_betas (symbol, beta, source, provider_name, updated_at)
      VALUES (?, ?, 'provider', 'yahoo_finance', CURRENT_TIMESTAMP)
    `, [symbol, providerBeta]);

    return { beta: providerBeta, source: 'live', updatedAt: new Date() };
  } catch (error) {
    // 4. Fallback to stale cache
    if (cached) {
      return { beta: cached.beta, source: 'cache', updatedAt: cached.updated_at, isStale: true };
    }

    // 5. Fallback to default
    return { beta: 1.0, source: 'default' };
  }
}
```

#### B. POST /api/beta/batch

**Purpose:** Get betas for multiple stocks in parallel

**Request:**
```json
POST /api/beta/batch
Content-Type: application/json

{
  "symbols": ["TSLA", "META", "AAPL", "GOOGL", "PLTR"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "TSLA": {
      "beta": 2.1,
      "source": "live",
      "updatedAt": "2025-10-18T12:30:00Z",
      "age": 0,
      "isStale": false
    },
    "META": {
      "beta": 1.45,
      "source": "cache",
      "updatedAt": "2025-10-15T10:00:00Z",
      "age": 259200,
      "isStale": false
    },
    "AAPL": {
      "beta": 1.5,
      "source": "file",
      "updatedAt": null,
      "age": null,
      "isStale": false
    },
    "GOOGL": {
      "beta": 1.2,
      "source": "cache",
      "updatedAt": "2025-10-11T08:00:00Z",
      "age": 604800,
      "isStale": false
    },
    "PLTR": {
      "beta": 2.592,
      "source": "file",
      "updatedAt": null,
      "age": null,
      "isStale": false
    }
  },
  "metadata": {
    "totalRequested": 5,
    "fromFile": 2,
    "fromCache": 2,
    "fromProvider": 1,
    "failed": 0
  }
}
```

**Implementation:**
```javascript
async getBetaBatch(symbols) {
  // Fetch all betas in parallel
  const results = await Promise.all(
    symbols.map(symbol => this.getBeta(symbol))
  );

  // Transform to object keyed by symbol
  const betaMap = {};
  symbols.forEach((symbol, i) => {
    betaMap[symbol] = results[i];
  });

  return betaMap;
}
```

**Performance:**
- Parallel execution (not sequential)
- Maximum 5 concurrent provider requests (rate limiting)
- Each request has 5-second timeout
- Failed requests don't block others

#### C. POST /api/beta/:symbol/refresh

**Purpose:** Force refresh beta from provider (ignore cache)

**Request:**
```
POST /api/beta/TSLA/refresh
```

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "TSLA",
    "beta": 2.15,
    "source": "live",
    "updatedAt": "2025-10-18T12:35:00Z",
    "previousBeta": 2.1,
    "changed": true
  }
}
```

**Logic:**
```javascript
async refreshBeta(symbol) {
  // Check if file override exists
  const fileBeta = getBacktestDefaults()[symbol]?.beta?.beta;
  if (fileBeta) {
    throw new Error('Cannot refresh beta: value is defined in backtestDefaults.json (user override)');
  }

  // Fetch from provider
  const newBeta = await fetchFromYahooFinance(symbol);

  // Get previous value
  const previous = await db.get('SELECT beta FROM stock_betas WHERE symbol = ?', [symbol]);

  // Update cache
  await db.run(`
    INSERT OR REPLACE INTO stock_betas (symbol, beta, source, provider_name, updated_at)
    VALUES (?, ?, 'provider', 'yahoo_finance', CURRENT_TIMESTAMP)
  `, [symbol, newBeta]);

  return {
    symbol,
    beta: newBeta,
    source: 'live',
    updatedAt: new Date(),
    previousBeta: previous?.beta,
    changed: previous?.beta !== newBeta
  };
}
```

### 1.4 Beta Service Module

**File:** `backend/services/betaService.js`

```javascript
const yahooFinance = require('./yahooFinanceService');
const db = require('../database');
const { getBacktestDefaults } = require('./configService');

class BetaService {
  constructor() {
    this.CACHE_EXPIRATION_DAYS = 30;
    this.REQUEST_TIMEOUT_MS = 5000;
    this.MAX_CONCURRENT_REQUESTS = 5;
  }

  /**
   * Get beta value for a single stock
   * Multi-tier lookup: file → cache → provider → default
   */
  async getBeta(symbol) {
    // Implementation shown above
  }

  /**
   * Get beta values for multiple stocks in parallel
   */
  async getBetaBatch(symbols) {
    // Implementation shown above
  }

  /**
   * Force refresh beta from provider
   */
  async refreshBeta(symbol) {
    // Implementation shown above
  }

  /**
   * Fetch beta from Yahoo Finance
   */
  async fetchFromYahooFinance(symbol) {
    try {
      const response = await yahooFinance.getQuote(symbol);
      const beta = response.beta || 1.0;

      // Validate beta
      if (beta < 0.1 || beta > 5.0) {
        throw new Error(`Beta value ${beta} out of valid range (0.1 - 5.0)`);
      }

      return beta;
    } catch (error) {
      throw new Error(`Failed to fetch beta for ${symbol}: ${error.message}`);
    }
  }

  /**
   * Check if cached beta is stale
   */
  isCacheStale(updatedAt) {
    const ageMs = Date.now() - new Date(updatedAt).getTime();
    const expirationMs = this.CACHE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
    return ageMs > expirationMs;
  }
}

module.exports = new BetaService();
```

### 1.5 Database Initialization

**File:** `backend/database.js` (add to existing initialization)

```javascript
async function initializeDatabase() {
  // Existing tables...

  // Stock betas cache table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS stock_betas (
      symbol VARCHAR(10) PRIMARY KEY,
      beta REAL NOT NULL CHECK(beta >= 0.1 AND beta <= 5.0),
      source VARCHAR(20) NOT NULL CHECK(source IN ('provider', 'manual')),
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      provider_name VARCHAR(50) DEFAULT 'yahoo_finance',
      metadata TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_stock_betas_updated
      ON stock_betas(updated_at);
  `);
}
```

---

## 2. Enhanced Beta UI Design

### 2.1 Component Architecture

```
PortfolioBacktestForm
  └─ BetaControlsSection (Enhanced)
       ├─ Enable Beta Scaling Checkbox
       ├─ Coefficient Slider
       └─ StockBetaTable (NEW)
            ├─ StockBetaRow (per stock)
            │    ├─ Symbol
            │    ├─ Beta Value
            │    ├─ BetaSourceBadge (NEW)
            │    ├─ Effective Beta (beta × coefficient)
            │    ├─ Last Updated Timestamp
            │    └─ Refresh Button
            └─ Refresh All Button
```

### 2.2 New Component: StockBetaTable

**File:** `frontend/src/components/backtest/shared/StockBetaTable.js`

```javascript
import React from 'react';
import { RefreshCw } from 'lucide-react';
import BetaSourceBadge from './BetaSourceBadge';

export const StockBetaTable = ({
  stocks,
  betaData,
  coefficient,
  loading,
  onRefresh,
  onRefreshAll
}) => {
  return (
    <div className="stock-beta-table">
      <div className="table-header">
        <h4>Stock-Specific Beta Values ({stocks.length} stocks)</h4>
        <button onClick={onRefreshAll} disabled={loading} className="btn-refresh-all">
          <RefreshCw size={16} />
          Refresh All
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Beta</th>
            <th>Source</th>
            <th>Effective</th>
            <th>Last Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map(symbol => {
            const data = betaData[symbol] || { beta: 1.0, source: 'default' };
            const effective = (data.beta * coefficient).toFixed(2);
            const canRefresh = data.source !== 'file';

            return (
              <tr key={symbol}>
                <td className="symbol">{symbol}</td>
                <td className="beta">{data.beta.toFixed(3)}</td>
                <td>
                  <BetaSourceBadge source={data.source} isStale={data.isStale} />
                </td>
                <td className="effective">{effective}</td>
                <td className="timestamp">
                  {data.updatedAt ? formatTimestamp(data.updatedAt) : 'User defined'}
                </td>
                <td className="actions">
                  {canRefresh ? (
                    <button
                      onClick={() => onRefresh(symbol)}
                      disabled={loading}
                      className="btn-refresh-stock"
                      title="Refresh from provider"
                    >
                      <RefreshCw size={14} />
                    </button>
                  ) : (
                    <span className="no-refresh">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}
```

### 2.3 New Component: BetaSourceBadge

**File:** `frontend/src/components/backtest/shared/BetaSourceBadge.js`

```javascript
import React from 'react';

export const BetaSourceBadge = ({ source, isStale }) => {
  const config = {
    file: { label: 'File', color: 'blue', title: 'From backtestDefaults.json (user override)' },
    cache: { label: 'Cache', color: 'green', title: 'Cached from provider (fresh)' },
    live: { label: 'Live', color: 'yellow', title: 'Freshly fetched from provider' },
    default: { label: 'Default', color: 'gray', title: 'No data available, using default (1.0)' }
  };

  const { label, color, title } = config[source] || config.default;
  const className = `beta-source-badge badge-${color}${isStale ? ' stale' : ''}`;

  return (
    <span className={className} title={title}>
      {label}
      {isStale && ' (Stale)'}
    </span>
  );
};

export default BetaSourceBadge;
```

### 2.4 New Hook: useStockBetas

**File:** `frontend/src/components/backtest/hooks/useStockBetas.js`

```javascript
import { useState, useEffect } from 'react';

export function useStockBetas(stocks) {
  const [betaData, setBetaData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch betas for all stocks in parallel
   */
  const fetchBetas = async (stockList) => {
    if (!stockList || stockList.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/beta/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: stockList })
      });

      const result = await response.json();
      if (result.success) {
        setBetaData(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch betas');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching betas:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh beta for a single stock
   */
  const refreshBeta = async (symbol) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/beta/${symbol}/refresh`, {
        method: 'POST'
      });

      const result = await response.json();
      if (result.success) {
        setBetaData(prev => ({
          ...prev,
          [symbol]: result.data
        }));
      } else {
        throw new Error(result.error || 'Failed to refresh beta');
      }
    } catch (err) {
      setError(err.message);
      console.error(`Error refreshing beta for ${symbol}:`, err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh all stocks
   */
  const refreshAll = () => {
    fetchBetas(stocks);
  };

  // Fetch on mount and when stocks change
  useEffect(() => {
    fetchBetas(stocks);
  }, [stocks]);

  return {
    betaData,
    loading,
    error,
    refreshBeta,
    refreshAll
  };
}
```

### 2.5 Enhanced BetaControlsSection

**File:** `frontend/src/components/backtest/sections/BetaControlsSection.js` (modifications)

```javascript
import { StockBetaTable } from '../shared/StockBetaTable';
import { useStockBetas } from '../hooks/useStockBetas';

export const BetaControlsSection = ({
  symbol,  // string for single, array for portfolio
  parameters,
  mode = 'single',
  enableBetaScaling,
  onBetaScalingChange,
  betaData,
  onBetaDataChange,
  loading = false,
  error = null
}) => {
  // For portfolio mode, use new hook
  const {
    betaData: portfolioBetas,
    loading: betasLoading,
    error: betasError,
    refreshBeta,
    refreshAll
  } = mode === 'portfolio' ? useStockBetas(symbol) : { betaData: {}, loading: false };

  return (
    <section className="backtest-section beta-controls">
      <SectionHeader icon={Settings} title="Beta Scaling Controls" />

      {/* Enable Beta Scaling Checkbox */}
      <div className="checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={enableBetaScaling}
            onChange={onBetaScalingChange}
          />
          Enable Beta Scaling
        </label>
      </div>

      {enableBetaScaling && (
        <>
          {/* Coefficient Slider */}
          <PercentageSlider
            label="Beta Coefficient"
            value={betaData.coefficient}
            onChange={(val) => onBetaDataChange({ coefficient: val })}
            min={0.25}
            max={3.0}
            step={0.25}
          />

          {/* Portfolio: Stock Beta Table */}
          {mode === 'portfolio' && (
            <StockBetaTable
              stocks={symbol}
              betaData={portfolioBetas}
              coefficient={betaData.coefficient}
              loading={betasLoading}
              onRefresh={refreshBeta}
              onRefreshAll={refreshAll}
            />
          )}

          {/* Single: Simple Beta Display */}
          {mode === 'single' && (
            <div className="beta-display">
              <div>Current Beta: {betaData.beta}</div>
              <div>Beta Factor: {betaData.betaFactor}</div>
            </div>
          )}
        </>
      )}

      {/* Error Display */}
      {(error || betasError) && (
        <div className="error-message">
          {error || betasError}
        </div>
      )}
    </section>
  );
};
```

### 2.6 CSS Styling

**File:** `frontend/src/components/backtest/BacktestForm.css` (additions)

```css
/* Stock Beta Table */
.stock-beta-table {
  margin-top: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
}

.stock-beta-table .table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.stock-beta-table h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.stock-beta-table table {
  width: 100%;
  border-collapse: collapse;
}

.stock-beta-table thead {
  background-color: #fafafa;
}

.stock-beta-table th {
  padding: 0.5rem;
  text-align: left;
  font-size: 0.85rem;
  font-weight: 600;
  color: #666;
  border-bottom: 1px solid #e0e0e0;
}

.stock-beta-table td {
  padding: 0.5rem;
  font-size: 0.9rem;
  border-bottom: 1px solid #f0f0f0;
}

.stock-beta-table tbody tr:hover {
  background-color: #fafafa;
}

.stock-beta-table .symbol {
  font-weight: 600;
  font-family: monospace;
}

.stock-beta-table .beta,
.stock-beta-table .effective {
  font-family: monospace;
  text-align: right;
}

.stock-beta-table .timestamp {
  color: #666;
  font-size: 0.85rem;
}

.stock-beta-table .actions {
  text-align: center;
}

/* Beta Source Badges */
.beta-source-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.beta-source-badge.badge-blue {
  background-color: #e3f2fd;
  color: #1976d2;
}

.beta-source-badge.badge-green {
  background-color: #e8f5e9;
  color: #388e3c;
}

.beta-source-badge.badge-yellow {
  background-color: #fff3e0;
  color: #f57c00;
}

.beta-source-badge.badge-gray {
  background-color: #f5f5f5;
  color: #757575;
}

.beta-source-badge.stale {
  opacity: 0.7;
  text-decoration: line-through;
}

/* Refresh Buttons */
.btn-refresh-all,
.btn-refresh-stock {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.8rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.btn-refresh-all:hover,
.btn-refresh-stock:hover {
  background-color: #f5f5f5;
  border-color: #999;
}

.btn-refresh-all:disabled,
.btn-refresh-stock:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-refresh-stock {
  padding: 0.25rem 0.5rem;
}

.no-refresh {
  color: #ccc;
}
```

---

## 3. URL Behavior & localStorage Design

### 3.1 Remove URL Parameter Encoding

**Problem:** Portfolio form currently uses URLParameterManager which auto-encodes parameters to URL.

**Solution:** Remove URLParameterManager integration, use localStorage instead.

**File:** `frontend/src/components/PortfolioBacktestForm.js` (modifications)

```javascript
import { useEffect } from 'react';
import { ParameterHelper } from './backtest/utils/ParameterHelper';

const PortfolioBacktestForm = ({ parameters, onParametersChange, onSubmit, loading }) => {
  /**
   * Load parameters on mount
   * Priority: URL params (if any) → localStorage → defaults
   */
  useEffect(() => {
    // Parse URL parameters (one-time only)
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.toString()) {
      // URL has parameters - parse and use them
      const parsedParams = parseURLParameters(urlParams);
      onParametersChange(parsedParams);

      // Save to localStorage for next visit
      ParameterHelper.saveToLocalStorage('portfolioBacktestConfig', parsedParams);
    } else {
      // No URL params - load from localStorage
      const savedParams = ParameterHelper.loadFromLocalStorage('portfolioBacktestConfig');

      if (savedParams) {
        onParametersChange(savedParams);
      } else {
        // No saved params - use defaults
        const defaults = ParameterHelper.getPortfolioDefaults();
        onParametersChange(defaults);
      }
    }
  }, []); // Run only on mount

  /**
   * Save parameters to localStorage on change (debounced)
   */
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      ParameterHelper.saveToLocalStorage('portfolioBacktestConfig', parameters);
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timeoutId);
  }, [parameters]);

  // ... rest of component
};

/**
 * Parse URL parameters into form structure
 */
function parseURLParameters(urlParams) {
  const params = {
    stocks: urlParams.get('stocks')?.split(',') || [],
    totalCapital: parseFloat(urlParams.get('totalCapital')) || 100000,
    lotSizeUsd: parseFloat(urlParams.get('lotSizeUsd')) || 10000,
    maxLotsPerStock: parseInt(urlParams.get('maxLotsPerStock')) || 5,
    startDate: urlParams.get('startDate') || '2020-01-01',
    endDate: urlParams.get('endDate') || new Date().toISOString().split('T')[0],
    defaultParams: {}
  };

  // Parse all other params into defaultParams
  for (const [key, value] of urlParams.entries()) {
    if (!['stocks', 'totalCapital', 'lotSizeUsd', 'maxLotsPerStock', 'startDate', 'endDate'].includes(key)) {
      params.defaultParams[key] = isNaN(value) ? value : parseFloat(value);
    }
  }

  return params;
}
```

### 3.2 localStorage Helper Methods

**File:** `frontend/src/components/backtest/utils/ParameterHelper.js` (additions)

```javascript
class ParameterHelper {
  // ... existing methods

  /**
   * Save parameters to localStorage
   */
  static saveToLocalStorage(key, parameters) {
    try {
      const data = {
        ...parameters,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      // Handle quota exceeded
      if (error.name === 'QuotaExceededError') {
        this.clearOldData();
      }
    }
  }

  /**
   * Load parameters from localStorage
   */
  static loadFromLocalStorage(key) {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        delete parsed.lastUpdated; // Remove timestamp
        return parsed;
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
    return null;
  }

  /**
   * Clear localStorage data
   */
  static clearLocalStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }

  /**
   * Clear old data if quota exceeded
   */
  static clearOldData() {
    // Remove old backtest results, keep only configs
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('backtest_result_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
}
```

### 3.3 Behavior Comparison

| Feature | Single Stock Form | Portfolio Form (Before) | Portfolio Form (After) |
|---------|-------------------|-------------------------|------------------------|
| URL on load | Clean (`/`) | Clean (`/portfolio-backtest`) | Clean (`/portfolio-backtest`) |
| URL after config | Clean | Auto-encodes params | Clean (no change) |
| Persistence | localStorage | URLParameterManager | localStorage |
| Shareable URL | Parse on load | Always has params | Parse on load |
| Bookmark | Works | Messy URL | Works |

---

## 4. Navigation Design

### 4.1 Homepage Structure

**File:** `frontend/src/App.js` or `frontend/src/components/HomePage.js`

**Current Structure:**
```jsx
<section className="testing-mode">
  <h2>Testing Mode</h2>
  <div className="cards">
    <Card title="Single Backtest" link="/backtest/long" />
    <Card title="Batch Optimization" link="/batch" />
  </div>
</section>
```

**New Structure:**
```jsx
<section className="testing-mode">
  <h2>Testing Mode</h2>
  <div className="cards">
    <Card
      title="Single Backtest"
      description="Test one parameter combination"
      link="/backtest/long"
      icon={<TrendingUp />}
    />
    <Card
      title="Batch Optimization"
      description="Test multiple parameter combinations to find optimal settings"
      link="/batch"
      icon={<Layers />}
    />
    <Card
      title="Portfolio Backtest"
      description="Test strategy across multiple stocks"
      link="/portfolio-backtest"
      icon={<Briefcase />}
    />
  </div>
</section>
```

### 4.2 Card Component

```jsx
import { TrendingUp, Layers, Briefcase } from 'lucide-react';

const TestingModeCard = ({ title, description, link, icon }) => {
  return (
    <Link to={link} className="testing-mode-card">
      <div className="card-icon">
        {icon}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </Link>
  );
};
```

### 4.3 CSS Updates

```css
.testing-mode .cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
}

.testing-mode-card {
  display: block;
  padding: 1.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: white;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
}

.testing-mode-card:hover {
  border-color: #1976d2;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.testing-mode-card .card-icon {
  font-size: 2rem;
  color: #1976d2;
  margin-bottom: 1rem;
}

.testing-mode-card h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
}

.testing-mode-card p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}
```

---

## 5. Data Flow Summary

### 5.1 Beta Fetching Flow

```
User loads portfolio form
  │
  ├─→ useStockBetas hook initializes
  │     │
  │     └─→ POST /api/beta/batch { symbols: [...] }
  │           │
  │           └─→ Backend: BetaService.getBetaBatch()
  │                 │
  │                 └─→ For each symbol:
  │                       ├─ Check backtestDefaults.json
  │                       ├─ Check database cache
  │                       ├─ Fetch from Yahoo Finance (if needed)
  │                       └─ Return beta + metadata
  │
  └─→ Frontend receives beta data
        │
        └─→ StockBetaTable displays results
              │
              └─→ User can refresh individual stocks
                    │
                    └─→ POST /api/beta/:symbol/refresh
```

### 5.2 Form Persistence Flow

```
User visits /portfolio-backtest
  │
  ├─→ Check URL for parameters
  │     │
  │     ├─→ If URL has params:
  │     │     ├─ Parse parameters
  │     │     ├─ Load into form
  │     │     └─ Save to localStorage
  │     │
  │     └─→ If URL is clean:
  │           ├─ Load from localStorage
  │           └─ If no localStorage, use defaults
  │
User changes parameters
  │
  └─→ Debounced save to localStorage (1 second)
        │
        └─→ NO URL update (key difference from before)
```

---

## 6. Implementation Phases

### Phase 1: Backend Beta System (2-3 days)
1. Create database table schema
2. Implement BetaService module
3. Create API endpoints (GET, POST batch, POST refresh)
4. Add Yahoo Finance beta fetching
5. Test API endpoints

### Phase 2: Frontend Beta UI (2-3 days)
1. Create StockBetaTable component
2. Create BetaSourceBadge component
3. Create useStockBetas hook
4. Enhance BetaControlsSection
5. Add CSS styling
6. Test beta display and refresh

### Phase 3: URL Behavior Fix (1 day)
1. Remove URLParameterManager integration
2. Add localStorage save/load logic
3. Add URL parameter parsing (one-time)
4. Test persistence and sharing

### Phase 4: Navigation (0.5 days)
1. Update homepage component
2. Add Portfolio Backtest card
3. Test navigation

### Phase 5: Integration & Testing (1-2 days)
1. End-to-end testing
2. Performance testing (batch beta fetching)
3. Error handling verification
4. Browser compatibility

---

## 7. Testing Strategy

### Backend Tests

```javascript
describe('BetaService', () => {
  test('getBeta returns file value first', async () => {
    // Test Tier 1: backtestDefaults.json
  });

  test('getBeta returns cache if file missing', async () => {
    // Test Tier 2: database cache
  });

  test('getBeta fetches from provider if cache stale', async () => {
    // Test Tier 3: provider API
  });

  test('getBeta falls back to default on failure', async () => {
    // Test Tier 4: fallback
  });

  test('getBetaBatch fetches in parallel', async () => {
    // Test parallel execution
  });

  test('refreshBeta updates cache', async () => {
    // Test forced refresh
  });
});
```

### Frontend Tests

```javascript
describe('StockBetaTable', () => {
  test('displays beta values for all stocks', () => {
    // Test table rendering
  });

  test('shows correct source badges', () => {
    // Test badge colors
  });

  test('refresh button calls onRefresh', () => {
    // Test refresh interaction
  });
});

describe('useStockBetas', () => {
  test('fetches betas on mount', () => {
    // Test initial fetch
  });

  test('refreshBeta updates single stock', () => {
    // Test single refresh
  });
});
```

---

**End of Design Document**
