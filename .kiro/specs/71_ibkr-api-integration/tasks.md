# Tasks: IBKR API Integration for Live Trading

## Phase 1: Foundation & Connection (Must Complete First)

### Task 1.1: Project Setup
- [ ] Install IBKR Node.js client library (`@stoqey/ib`)
- [ ] Create backend directory structure: `backend/services/live/`
- [ ] Create configuration file: `backend/config/live.js`
- [ ] Add IBKR environment variables to `.env.example`
- [ ] Update `package.json` with new dependencies
- [ ] Create frontend directory: `frontend/src/components/live/`
- [ ] Create theme files: `frontend/src/styles/themes/live.css`

**Files to create:**
- `backend/services/live/index.js`
- `backend/config/live.js`
- `frontend/src/styles/themes/live.css`

### Task 1.2: IBKR Client Wrapper
- [ ] Implement `IbkrClient` class wrapping `@stoqey/ib`
- [ ] Implement `connect(host, port, clientId)` method
- [ ] Implement `disconnect()` method
- [ ] Implement `isConnected()` status check
- [ ] Implement event callbacks for connection status
- [ ] Add comprehensive error handling

**File:** `backend/services/live/ibkrClient.js`

### Task 1.3: Connection Manager
- [ ] Implement `ConnectionManager` class
- [ ] Implement connection parameter storage
- [ ] Implement auto-reconnection with exponential backoff
- [ ] Implement connection health monitoring
- [ ] Add status change event emitter
- [ ] Write unit tests

**File:** `backend/services/live/connectionManager.js`

### Task 1.4: Connection API Endpoints
- [ ] Create `POST /api/live/connect` endpoint
- [ ] Create `POST /api/live/disconnect` endpoint
- [ ] Create `GET /api/live/status` endpoint
- [ ] Add authentication middleware (if needed)
- [ ] Write integration tests with mock client

**File:** `backend/routes/liveRoutes.js`

### Task 1.5: Basic Frontend Connection UI
- [ ] Create `ConnectionStatus` component with live theme styling
- [ ] Display connection status (disconnected/connecting/connected)
- [ ] Add connect/disconnect buttons
- [ ] Add connection parameter inputs (host, port)
- [ ] Handle connection errors gracefully
- [ ] Add "LIVE" mode indicator badge

**Files:**
- `frontend/src/components/live/ConnectionStatus.js`
- `frontend/src/components/live/ConnectionStatus.css`
- `frontend/src/components/live/LiveModeBanner.js`

---

## Phase 2: Market Data & Positions

### Task 2.1: Market Data Manager
- [ ] Implement `MarketDataManager` class
- [ ] Implement `subscribe(symbols)` method
- [ ] Implement `unsubscribe(symbols)` method
- [ ] Implement price caching with timestamps
- [ ] Implement `getLatestPrice(symbol)` method
- [ ] Handle subscription limits gracefully
- [ ] Add stale price detection

**File:** `backend/services/live/marketDataManager.js`

### Task 2.2: Market Data API Endpoints
- [ ] Create `POST /api/live/subscribe` endpoint
- [ ] Create `POST /api/live/unsubscribe` endpoint
- [ ] Create `GET /api/live/prices` endpoint
- [ ] Create `GET /api/live/prices/:symbol` endpoint
- [ ] Write integration tests

**File:** `backend/routes/liveRoutes.js` (extend)

### Task 2.3: Position Sync from IBKR
- [ ] Implement `PositionsCache` class
- [ ] Implement `getPositions()` from IBKR
- [ ] Calculate real-time P&L
- [ ] Implement position change detection
- [ ] Auto-refresh on trade execution
- [ ] Handle multi-account scenarios

**File:** `backend/services/live/positionsCache.js`

### Task 2.4: Account & Position API Endpoints
- [ ] Create `GET /api/live/positions` endpoint
- [ ] Create `GET /api/live/positions/:symbol` endpoint
- [ ] Create `GET /api/live/account` endpoint
- [ ] Write integration tests

**File:** `backend/routes/liveRoutes.js` (extend)

### Task 2.5: WebSocket Setup
- [ ] Set up WebSocket server for real-time updates
- [ ] Implement price update broadcasting
- [ ] Implement position update broadcasting
- [ ] Implement connection status broadcasting
- [ ] Handle client subscriptions

**File:** `backend/services/live/websocketManager.js`

### Task 2.6: Frontend Position Dashboard
- [ ] Create `PositionsTable` component
- [ ] Display positions with real-time P&L
- [ ] Show position metrics (quantity, avg cost, market value)
- [ ] Implement WebSocket price updates
- [ ] Add position sorting and filtering

**Files:**
- `frontend/src/components/live/PositionsTable.js`
- `frontend/src/components/live/PositionsTable.css`

### Task 2.7: Frontend Price Watch
- [ ] Create `PriceWatch` component
- [ ] Display subscribed symbols with live prices
- [ ] Show price change indicators (up/down)
- [ ] Add symbol subscription management
- [ ] Handle stale price warnings

**Files:**
- `frontend/src/components/live/PriceWatch.js`
- `frontend/src/components/live/PriceWatch.css`

---

## Phase 2B: Lot Tracking & Strategy Calibration (Critical for DCA)

### Task 2B.1: Local Database Setup
- [ ] Design database schema for lots, positions, reconciliation
- [ ] Create SQLite or PostgreSQL database (configurable)
- [ ] Implement database migrations
- [ ] Create `lots` table with all required fields
- [ ] Create `ibkr_positions` table (cache)
- [ ] Create `reconciliation_status` table
- [ ] Write database access layer

**Files:**
- `backend/database/schema.sql`
- `backend/database/migrations/001_initial.js`
- `backend/services/live/database.js`

### Task 2B.2: Lot Manager
- [ ] Implement `LotManager` class
- [ ] Implement `createLot(symbol, quantity, price, source)` method
- [ ] Implement `getLots(symbol)` method
- [ ] Implement `updateLotOnPartialSell()` method
- [ ] Implement `closeLot(lotId)` method
- [ ] Support lot sources: 'platform', 'reconstructed', 'legacy_residual', 'synthetic'
- [ ] Calculate per-lot P&L and profit target status
- [ ] Write unit tests

**File:** `backend/services/live/lotManager.js`

### Task 2B.3: Reconciliation Service
- [ ] Implement `ReconciliationService` class
- [ ] Implement `reconcilePosition(symbol)` method
- [ ] Compare local lot sum vs IBKR position quantity
- [ ] Detect discrepancies (untracked shares, over-tracked)
- [ ] Generate reconciliation status and suggestions
- [ ] Implement periodic reconciliation checks
- [ ] Write unit tests

**File:** `backend/services/live/reconciliationService.js`

### Task 2B.4: Strategy Calibration Engine (Backfill)
- [ ] Implement `StrategyCalibrationService` class
- [ ] Implement `calculateBackfillWindow(position, lotSize)` method
- [ ] Implement `reconstructPosition(symbol, ibkrPosition, params)` method
- [ ] Run constrained backtest (buy-only, target share count)
- [ ] Use binary search to find starting capital
- [ ] Extract reconstructed lots with different prices
- [ ] Extract strategy state (peaks, bottoms, grid levels, trailing states)
- [ ] Handle residual shares as legacy lot
- [ ] Write unit tests

**File:** `backend/services/live/strategyCalibrationService.js`

### Task 2B.5: Per-Lot Trailing State Tracking
- [ ] Extend lot schema with trailing sell state fields
- [ ] Track `trailingSellActivated` per lot
- [ ] Track `peakSinceActivation` per lot
- [ ] Track `readyToSell` per lot
- [ ] Update trailing states on price changes
- [ ] Integrate with signal evaluation

**File:** `backend/services/live/lotManager.js` (extend)

### Task 2B.6: Calibration API Endpoints
- [ ] Create `POST /api/live/calibrate/:symbol` endpoint
- [ ] Create `GET /api/live/calibration/status/:symbol` endpoint
- [ ] Create `POST /api/live/calibrate/all` endpoint (batch)
- [ ] Create `GET /api/live/lots/:symbol` endpoint
- [ ] Create `GET /api/live/reconciliation/:symbol` endpoint
- [ ] Write integration tests

**File:** `backend/routes/liveRoutes.js` (extend)

### Task 2B.7: First-Time Import Flow
- [ ] Detect first-time connection (no local lots exist)
- [ ] Fetch all positions from IBKR
- [ ] Present import options to user
- [ ] For small positions: auto-import as single lot
- [ ] For large positions: offer calibration or single lot
- [ ] Run calibration for selected positions
- [ ] Store reconstructed lots and strategy state
- [ ] Log import decisions

**File:** `backend/services/live/firstTimeImportService.js`

### Task 2B.8: Frontend Calibration UI
- [ ] Create `StrategyCalibration` component
- [ ] Show IBKR positions pending calibration
- [ ] Display calibration options per position
- [ ] Show calibration progress and results
- [ ] Display reconstructed lots with prices and dates
- [ ] Show residual/legacy lot handling
- [ ] Show strategy state initialization results
- [ ] Accept/reject calibration results

**Files:**
- `frontend/src/components/live/StrategyCalibration.js`
- `frontend/src/components/live/StrategyCalibration.css`

### Task 2B.9: Frontend Lot Viewer
- [ ] Create `LotViewer` component
- [ ] Display lots per symbol with all details
- [ ] Show lot source (platform, reconstructed, legacy)
- [ ] Show per-lot P&L and trailing state
- [ ] Show profit target status per lot
- [ ] Highlight lots ready to sell
- [ ] Allow manual lot adjustments (advanced)

**Files:**
- `frontend/src/components/live/LotViewer.js`
- `frontend/src/components/live/LotViewer.css`

### Task 2B.10: Frontend Reconciliation Dashboard
- [ ] Create `ReconciliationStatus` component
- [ ] Show reconciliation status per symbol
- [ ] Highlight discrepancies with warnings
- [ ] Provide resolution options (import, distribute, ignore)
- [ ] Show reconciliation history

**Files:**
- `frontend/src/components/live/ReconciliationStatus.js`
- `frontend/src/components/live/ReconciliationStatus.css`

---

## Phase 3: Signal Evaluation

### Task 3.1: Refactor Signal Engine for Live Use
- [ ] Review existing `dcaSignalEngine.js` functions
- [ ] Identify functions suitable for live evaluation
- [ ] Create adapter functions for live state format
- [ ] Document required inputs and outputs
- [ ] Write unit tests for live evaluation scenarios

**File:** `backend/services/dcaSignalEngine.js` (extend/document)

### Task 3.2: Live Signal Evaluator
- [ ] Implement `LiveSignalEvaluator` class
- [ ] Implement strategy parameter storage per symbol
- [ ] Implement `evaluateSignals(symbol)` method
- [ ] **Integrate with LotManager for per-lot evaluation**
- [ ] Transform current state to signal engine format
- [ ] Call appropriate evaluation functions
- [ ] Generate actionable signal objects (per-lot for sells)
- [ ] Add confidence scoring

**File:** `backend/services/live/liveSignalEvaluator.js`

### Task 3.3: Price Tracking for Signals
- [ ] Implement peak/bottom price tracking
- [ ] Store historical price extremes
- [ ] Reset tracking on position changes
- [ ] Support trailing stop calculations
- [ ] **Load initial state from calibration results**

**File:** `backend/services/live/priceTracker.js`

### Task 3.4: Signal API Endpoints
- [ ] Create `POST /api/live/signals/evaluate` endpoint
- [ ] Create `GET /api/live/signals/latest` endpoint
- [ ] Create `POST /api/live/signals/config` endpoint
- [ ] Create `GET /api/live/signals/config` endpoint
- [ ] Write integration tests

**File:** `backend/routes/liveRoutes.js` (extend)

### Task 3.5: Frontend Signal Monitor
- [ ] Create `SignalMonitor` component
- [ ] Display current signals with recommendations
- [ ] **Show per-lot sell signals with lot details**
- [ ] Show signal reasoning and confidence
- [ ] Color-code by action (buy=green, sell=red, hold=gray)
- [ ] Add signal history view
- [ ] Implement WebSocket signal updates

**Files:**
- `frontend/src/components/live/SignalMonitor.js`
- `frontend/src/components/live/SignalMonitor.css`

---

## Phase 4: Order Management

### Task 4.1: Order Manager
- [ ] Implement `OrderManager` class
- [ ] Implement `createPendingOrder()` with `transmit=false`
- [ ] Implement pending order queue
- [ ] Implement `transmitOrder(orderId)` method
- [ ] Implement `transmitAllPending()` method
- [ ] Implement `cancelPendingOrder(orderId)` method
- [ ] Implement order status tracking
- [ ] Handle IBKR order callbacks
- [ ] **On fill: create new lot in LotManager**

**File:** `backend/services/live/orderManager.js`

### Task 4.2: Order Validation
- [ ] Validate order against buying power
- [ ] Validate order against position limits
- [ ] Calculate estimated cost and commission
- [ ] Check for duplicate/conflicting orders
- [ ] Implement lot size validation

**File:** `backend/services/live/orderValidator.js`

### Task 4.3: Order API Endpoints
- [ ] Create `POST /api/live/orders` endpoint (create pending)
- [ ] Create `GET /api/live/orders/pending` endpoint
- [ ] Create `POST /api/live/orders/:id/transmit` endpoint
- [ ] Create `POST /api/live/orders/transmit-all` endpoint
- [ ] Create `DELETE /api/live/orders/:id` endpoint
- [ ] Create `GET /api/live/orders/open` endpoint
- [ ] Create `GET /api/live/orders/history` endpoint
- [ ] Write integration tests

**File:** `backend/routes/liveRoutes.js` (extend)

### Task 4.4: Frontend Pending Orders Queue
- [ ] Create `PendingOrdersQueue` component
- [ ] Display pending orders with details
- [ ] **Show which lot a sell order targets**
- [ ] Show estimated cost and commission
- [ ] Add approve (transmit) button per order
- [ ] Add reject (cancel) button per order
- [ ] Add batch approve/reject functionality
- [ ] Show order preview before confirmation
- [ ] Implement WebSocket order updates

**Files:**
- `frontend/src/components/live/PendingOrdersQueue.js`
- `frontend/src/components/live/PendingOrdersQueue.css`

### Task 4.5: Order Execution & Lot Updates
- [ ] Implement WebSocket notifications for order fills
- [ ] **On BUY fill: Create new lot with fill price**
- [ ] **On SELL fill: Update/close target lot**
- [ ] Add toast notifications in frontend
- [ ] Update positions automatically on fill
- [ ] Trigger reconciliation check after fill
- [ ] Log execution details

---

## Phase 5: Logging & Audit Trail

### Task 5.1: Trading Logger
- [ ] Implement `TradingLogger` class
- [ ] Log price updates with timestamps
- [ ] Log signal evaluations with full context
- [ ] Log order lifecycle events
- [ ] Log position changes
- [ ] **Log lot creation/updates/closures**
- [ ] **Log calibration events**
- [ ] **Log reconciliation events**
- [ ] Log connection events
- [ ] Log errors with context

**File:** `backend/services/live/tradingLogger.js`

### Task 5.2: Log Storage
- [ ] Implement file-based log storage
- [ ] Implement log rotation
- [ ] Implement retention policy
- [ ] Support log querying by date/symbol/category

**File:** `backend/services/live/logStorage.js`

### Task 5.3: Log API Endpoints
- [ ] Create `GET /api/live/logs` endpoint with filtering
- [ ] Create `GET /api/live/logs/export` endpoint
- [ ] Add pagination support
- [ ] Write integration tests

**File:** `backend/routes/liveRoutes.js` (extend)

### Task 5.4: Frontend Log Viewer
- [ ] Create `TradingLog` component
- [ ] Display scrollable log with color coding
- [ ] Add filter by category (price, signal, order, lot, calibration, error)
- [ ] Add filter by symbol
- [ ] Add date range selector
- [ ] Add log export button
- [ ] Implement live log streaming via WebSocket

**Files:**
- `frontend/src/components/live/TradingLog.js`
- `frontend/src/components/live/TradingLog.css`

---

## Phase 6: Dashboard Integration

### Task 6.1: Live Trading Dashboard Page
- [ ] Create `LiveDashboard` page component
- [ ] Layout: connection status, positions, lots, signals, orders
- [ ] **Add calibration status overview**
- [ ] **Add reconciliation warnings**
- [ ] Add navigation from main app with mode switcher
- [ ] Apply live mode theme (orange/amber accents)
- [ ] Responsive design for desktop and tablet

**Files:**
- `frontend/src/pages/LiveDashboard.js`
- `frontend/src/pages/LiveDashboard.css`

### Task 6.2: Dashboard Routing & Mode Switching
- [ ] Add route `/live` or `/live-trading`
- [ ] Add mode switcher in header: `[Backtest] | [Live Trading]`
- [ ] Guard route if not connected
- [ ] Show "Trading with Real Money" warning banner
- [ ] Add "LIVE" indicator badge (always visible in live mode)

**File:** `frontend/src/App.js` (extend)

### Task 6.3: Live Settings Page
- [ ] Create live trading settings section
- [ ] Connection parameters (host, port, client ID)
- [ ] Strategy parameters per symbol (import from backtest)
- [ ] **Transmission mode selector (manual/auto/hybrid)**
- [ ] **Auto-transmit safeguards (daily loss limit, position size limit)**
- [ ] Order defaults (order type, lot size)
- [ ] Persist settings to localStorage/backend

**Files:**
- `frontend/src/components/live/LiveSettings.js`
- `frontend/src/components/live/LiveSettings.css`

### Task 6.4: Export Backtest Config to Live
- [ ] Add "Export to Live Trading" button on backtest results
- [ ] Transfer strategy parameters to live mode
- [ ] Navigate to live mode with pre-filled config
- [ ] Show confirmation dialog

**Files:**
- `frontend/src/components/backtest/ExportToLive.js`

---

## Phase 7: Error Handling & Recovery

### Task 7.1: Comprehensive Error Handling
- [ ] Implement error categorization (connection, order, data, reconciliation)
- [ ] Add user-friendly error messages
- [ ] Implement safe mode on repeated failures
- [ ] **Pause auto-transmit on errors**
- [ ] Add error recovery suggestions
- [ ] Log all errors with context

**File:** `backend/services/live/errorHandler.js`

### Task 7.2: Position & Lot Reconciliation on Reconnect
- [ ] Detect position mismatches on reconnect
- [ ] **Compare lot sums with IBKR positions**
- [ ] Alert user on discrepancies
- [ ] Provide reconciliation options (re-calibrate, adjust lots, ignore)
- [ ] **Handle external trades made in TWS directly**

**File:** `backend/services/live/reconciliationService.js` (extend)

### Task 7.3: Frontend Error Display
- [ ] Create error notification system (toast + persistent)
- [ ] Show connection errors prominently with retry button
- [ ] Show order errors with context and suggested action
- [ ] **Show reconciliation warnings with resolution options**
- [ ] Add error dismissal and acknowledgment
- [ ] Add "Emergency Pause Trading" button

**Files:**
- `frontend/src/components/live/ErrorNotifications.js`
- `frontend/src/components/live/ErrorNotifications.css`
- `frontend/src/components/live/EmergencyControls.js`

---

## Phase 8: Testing & Documentation

### Task 8.1: Unit Tests
- [ ] Test signal evaluation logic
- [ ] Test order validation
- [ ] Test state management
- [ ] Test WebSocket event handling
- [ ] Achieve >80% code coverage

### Task 8.2: Integration Tests
- [ ] Test API endpoints with mock IBKR client
- [ ] Test WebSocket communication
- [ ] Test end-to-end signal → order flow
- [ ] Test error scenarios

### Task 8.3: Paper Trading Validation
- [ ] Connect to IBKR paper trading account
- [ ] Run through all workflows manually
- [ ] Verify order placement and fills
- [ ] Verify position sync accuracy
- [ ] Document any issues found

### Task 8.4: Documentation
- [ ] Update README with IBKR setup instructions
- [ ] Document API endpoints
- [ ] Document WebSocket events
- [ ] Create user guide for live trading page
- [ ] Document configuration options

---

## Dependencies Between Tasks

```
Phase 1 (Foundation)
    │
    ├── Task 1.1 → Task 1.2 → Task 1.3 → Task 1.4 → Task 1.5
    │
    ▼
Phase 2 (Market Data & Positions)
    │
    ├── Task 2.1 → Task 2.2
    ├── Task 2.3 → Task 2.4
    ├── Task 2.5 (WebSocket - enables real-time frontend)
    ├── Task 2.6 (needs 2.3, 2.4, 2.5)
    └── Task 2.7 (needs 2.1, 2.2, 2.5)
    │
    ▼
Phase 2B (Lot Tracking & Strategy Calibration) ⭐ CRITICAL FOR DCA
    │
    ├── Task 2B.1 (Database) - Can start after Phase 1
    ├── Task 2B.2 (LotManager) → Task 2B.5 (Per-Lot Trailing)
    ├── Task 2B.3 (Reconciliation) - needs 2B.2, Phase 2.3
    ├── Task 2B.4 (Calibration Engine) - needs 2B.2, uses backtest engine
    ├── Task 2B.6 (API) - needs 2B.2, 2B.3, 2B.4
    ├── Task 2B.7 (First-Time Import) - needs 2B.4, Phase 2.3
    ├── Task 2B.8 (Calibration UI) - needs 2B.6, Phase 2.5
    ├── Task 2B.9 (Lot Viewer UI) - needs 2B.6, Phase 2.5
    └── Task 2B.10 (Reconciliation UI) - needs 2B.6, Phase 2.5
    │
    ▼
Phase 3 (Signals) - Needs Phase 2B for per-lot evaluation
    │
    ├── Task 3.1 → Task 3.2 (needs Phase 2B.2 for lot integration)
    ├── Task 3.3 (needs Phase 2B.4 for initial state)
    ├── Task 3.4 (needs 3.2)
    └── Task 3.5 (needs 3.4, Phase 2.5, Phase 2B.9)
    │
    ▼
Phase 4 (Orders) - Needs Phase 2B for lot creation on fill
    │
    ├── Task 4.1 (needs Phase 2B.2) → Task 4.2 → Task 4.3
    ├── Task 4.4 (needs 4.3, Phase 2.5, Phase 2B.9)
    └── Task 4.5 (needs 4.1, Phase 2.5, Phase 2B.2)
    │
    ▼
Phase 5 (Logging) - Can start independently after Phase 1
    │
    ├── Task 5.1 (includes lot/calibration events) → Task 5.2 → Task 5.3
    └── Task 5.4 (needs 5.3, Phase 2.5)
    │
    ▼
Phase 6 (Dashboard) - After all component phases
    │
    ├── Task 6.1 (includes calibration & reconciliation) → Task 6.2
    ├── Task 6.3 (transmission modes, safeguards)
    └── Task 6.4 (export backtest to live)
    │
    ▼
Phase 7 (Error Handling) - Can be woven throughout
    │
    ├── Task 7.1 (error categories including reconciliation)
    ├── Task 7.2 (extends Phase 2B.3)
    └── Task 7.3 (emergency controls)
    │
    ▼
Phase 8 (Testing) - Ongoing + final validation
```

**Critical Path:**
```
Phase 1 → Phase 2 (2.1-2.5) → Phase 2B (2B.1-2B.7) → Phase 3 → Phase 4 → Phase 6
                                    ↓
                              Full DCA signal evaluation with per-lot tracking
```

## Quick Start Path (Minimum Viable Product)

For rapid iteration, focus on these tasks first:

### Path A: Basic Connection (No DCA Signals)
1. **Task 1.1-1.4**: Get connected to IBKR
2. **Task 2.1-2.4**: Get positions and prices
3. **Task 4.1, 4.3**: Create and manage pending orders
4. **Task 5.1**: Basic logging
5. **Task 6.1**: Simple dashboard

This gives you:
- ✅ Connection to IBKR
- ✅ View positions (aggregate)
- ✅ View prices
- ✅ Create pending orders (manual transmit via TWS)
- ✅ Basic audit trail

### Path B: Full DCA Strategy Support (Recommended)
1. **Phase 1**: Foundation & Connection
2. **Phase 2 (2.1-2.5)**: Market data, positions, WebSocket
3. **Phase 2B (2B.1-2B.7)**: Database, lot tracking, calibration engine
4. **Phase 3 (3.1-3.4)**: Signal evaluation with lot integration
5. **Phase 4 (4.1-4.3)**: Order management with lot creation
6. **Phase 6 (6.1-6.2)**: Dashboard with calibration status

This gives you:
- ✅ Connection to IBKR
- ✅ View positions with **per-lot breakdown**
- ✅ **Strategy Calibration** - reconstruct lots from existing positions
- ✅ **Full DCA signal evaluation** (buy grid, trailing stops, per-lot profit targets)
- ✅ Create pending orders with lot tracking
- ✅ Real-time dashboard with reconciliation status

### Why Path B is Recommended

Without lot tracking (Path A), you can only see aggregate positions. The DCA signal engine requires:
- Individual lot purchase prices for profit target calculation
- Per-lot trailing sell state tracking
- Grid reference prices based on lot positions

Path B adds ~10 tasks but enables the core value proposition: applying your backtested DCA strategy to live trading with the same granularity.
