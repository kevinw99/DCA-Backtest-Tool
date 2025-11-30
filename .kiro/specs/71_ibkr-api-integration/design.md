# Design: IBKR API Integration for Live Trading

## Platform Mode Architecture

### Unified Product with Distinct Modes

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Adaptive DCA Strategy Platform                         │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────┐    ┌────────────────────────────────────┐   │
│  │      [Backtest]        │    │        [Live Trading] 🔴 LIVE      │   │
│  │   (Blue/Green theme)   │    │      (Orange/Amber theme)          │   │
│  └────────────────────────┘    └────────────────────────────────────┘   │
│                                                                          │
│  Shared: Strategy Parameters, Signal Engine, Charts, Analytics           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Frontend Component Organization

```
frontend/src/
├── components/
│   ├── backtest/           # Backtest-specific components
│   │   ├── DCABacktestForm.js
│   │   ├── PortfolioBacktestForm.js
│   │   └── BacktestResults.js
│   │
│   ├── live/               # Live trading components (new)
│   │   ├── ConnectionStatus.js
│   │   ├── PositionsTable.js
│   │   ├── PendingOrdersQueue.js
│   │   ├── SignalMonitor.js
│   │   ├── PriceWatch.js
│   │   ├── TradingLog.js
│   │   └── LiveModeBanner.js    # "LIVE" indicator
│   │
│   └── shared/             # Shared across modes
│       ├── StrategyParameters.js
│       ├── StockSelector.js
│       ├── Charts/
│       └── Navigation.js
│
├── pages/
│   ├── BacktestPage.js     # Existing
│   └── LiveTradingPage.js  # New
│
├── styles/
│   ├── themes/
│   │   ├── backtest.css    # Blue/green theme
│   │   └── live.css        # Orange/amber theme + warning styles
│   └── shared.css
│
└── context/
    └── TradingModeContext.js  # Tracks current mode
```

### Backend Service Organization

```
backend/
├── services/
│   ├── dcaSignalEngine.js      # Shared - pure signal evaluation
│   ├── dcaBacktestService.js   # Backtest mode
│   ├── portfolioBacktestService.js
│   │
│   └── live/                   # Live trading services (new)
│       ├── ibkrClient.js
│       ├── connectionManager.js
│       ├── marketDataManager.js
│       ├── orderManager.js
│       ├── liveSignalEvaluator.js
│       ├── positionsCache.js
│       ├── tradingLogger.js
│       └── websocketManager.js
│
├── routes/
│   ├── backtestRoutes.js       # Existing
│   └── liveRoutes.js           # New /api/live/*
│
└── config/
    └── live.js                 # Live trading configuration
```

### Visual Differentiation

| Aspect | Backtest Mode | Live Trading Mode |
|--------|---------------|-------------------|
| Primary Color | Blue (#2196F3) | Orange (#FF9800) |
| Accent Color | Green (#4CAF50) | Amber (#FFC107) |
| Background | White/Light Gray | Subtle warm tint |
| Mode Indicator | None | 🔴 "LIVE" badge (always visible) |
| Confirmation | Optional | Required for all orders |
| Warning Banner | None | "Trading with Real Money" |

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐│
│  │ Connection  │  │  Positions  │  │  Pending    │  │  Signal         ││
│  │ Status      │  │  Dashboard  │  │  Orders     │  │  Monitor        ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘│
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ WebSocket + REST
┌────────────────────────────────┼────────────────────────────────────────┐
│                           Backend (Node.js)                              │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                         API Routes                                   ││
│  │  /api/ibkr/connect  /api/ibkr/positions  /api/ibkr/orders  /api/...││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                 │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      IBKR Service Layer                              ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              ││
│  │  │ Connection   │  │ Market Data  │  │ Order        │              ││
│  │  │ Manager      │  │ Manager      │  │ Manager      │              ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘              ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                 │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    Signal Evaluation Layer                           ││
│  │  ┌──────────────────────────┐  ┌──────────────────────────────────┐││
│  │  │ dcaSignalEngine.js       │  │ Live Signal Evaluator            │││
│  │  │ (existing pure functions)│  │ (orchestrates evaluation)        │││
│  │  └──────────────────────────┘  └──────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                 │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      State Management                                ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              ││
│  │  │ Positions    │  │ Pending      │  │ Price        │              ││
│  │  │ Cache        │  │ Orders       │  │ Cache        │              ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘              ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                 │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                        IBKR Client                                   ││
│  │                    (ib-tws-api / @stoqey/ib)                         ││
│  └─────────────────────────────────────────────────────────────────────┘│
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ TCP Socket
                    ┌────────────┴────────────┐
                    │  TWS / IB Gateway       │
                    │  (IBKR Application)     │
                    └─────────────────────────┘
```

## Component Design

### 1. IBKR Client Wrapper (`backend/services/ibkr/ibkrClient.js`)

Wraps the IBKR Node.js library (recommend `@stoqey/ib` for modern async support).

```javascript
// Interface definition
class IbkrClient {
  // Connection
  async connect(host, port, clientId)
  async disconnect()
  isConnected()
  onConnectionStatus(callback)

  // Market Data
  async subscribeMarketData(symbol, callback)
  async unsubscribeMarketData(symbol)

  // Account & Positions
  async getPositions()
  async getAccountSummary()

  // Orders
  async placeOrder(contract, order, transmit = false)
  async modifyOrder(orderId, order)
  async cancelOrder(orderId)
  async transmitOrder(orderId)
  async getOpenOrders()
  async getExecutions()
}
```

### 2. Connection Manager (`backend/services/ibkr/connectionManager.js`)

Handles connection lifecycle, reconnection logic, and health monitoring.

```javascript
class ConnectionManager {
  constructor(ibkrClient) {}

  // Connection settings
  setConnectionParams(host, port, clientId)

  // Lifecycle
  async connect()
  async disconnect()
  getStatus() // 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

  // Auto-reconnection
  enableAutoReconnect(maxAttempts, backoffMs)
  disableAutoReconnect()

  // Events
  onStatusChange(callback)
  onError(callback)
}
```

### 3. Market Data Manager (`backend/services/ibkr/marketDataManager.js`)

Manages market data subscriptions and price caching.

```javascript
class MarketDataManager {
  constructor(ibkrClient) {}

  // Subscriptions
  async subscribe(symbols)
  async unsubscribe(symbols)
  getSubscribedSymbols()

  // Price access
  getLatestPrice(symbol)
  getPriceHistory(symbol, minutes)

  // Events
  onPriceUpdate(callback)
  onDataError(callback)
}
```

### 4. Order Manager (`backend/services/ibkr/orderManager.js`)

Manages order lifecycle with pending order support.

```javascript
class OrderManager {
  constructor(ibkrClient) {}

  // Order creation (always pending by default)
  async createPendingOrder(symbol, action, quantity, orderType, limitPrice?)

  // Pending order management
  getPendingOrders()
  async transmitOrder(orderId)
  async transmitAllPending()
  async cancelPendingOrder(orderId)

  // Active order management
  async getOpenOrders()
  async modifyOrder(orderId, changes)
  async cancelOrder(orderId)

  // Order status
  getOrderStatus(orderId)

  // Events
  onOrderStatusChange(callback)
  onExecution(callback)
}
```

### 5. Live Signal Evaluator (`backend/services/ibkr/liveSignalEvaluator.js`)

Orchestrates signal evaluation using existing pure functions.

```javascript
class LiveSignalEvaluator {
  constructor(marketDataManager, orderManager, positionsCache) {}

  // Configuration
  setStrategyParams(symbol, params)
  getStrategyParams(symbol)

  // Evaluation
  async evaluateSignals(symbol)
  async evaluateAllSymbols()

  // Signal structure
  // {
  //   symbol: 'AAPL',
  //   timestamp: Date,
  //   currentPrice: 150.25,
  //   action: 'BUY' | 'SELL' | 'HOLD',
  //   signalType: 'GRID' | 'TRAILING_STOP' | 'PROFIT_TARGET',
  //   confidence: 0.85,
  //   suggestedQuantity: 100,
  //   suggestedPrice: 150.00,
  //   reasoning: 'Price dropped 10% below grid level'
  // }

  // Events
  onSignalGenerated(callback)
}
```

### 6. Trading Logger (`backend/services/ibkr/tradingLogger.js`)

Comprehensive logging for audit trail.

```javascript
class TradingLogger {
  // Log categories
  logPriceUpdate(symbol, price, timestamp)
  logSignalEvaluation(symbol, inputs, result)
  logOrderEvent(orderId, event, details)
  logPositionChange(symbol, before, after)
  logConnectionEvent(event, details)
  logError(category, error, context)

  // Retrieval
  getLogs(filter) // by date, symbol, category
  exportLogs(format, dateRange)

  // Maintenance
  rotateLogs()
  setRetentionDays(days)
}
```

## Data Models

### Position (Aggregate from IBKR)

```javascript
{
  symbol: 'AAPL',
  quantity: 100,              // Total quantity from IBKR
  averageCost: 145.50,        // IBKR's calculated average
  marketPrice: 150.25,
  marketValue: 15025.00,
  unrealizedPnL: 475.00,
  unrealizedPnLPercent: 3.27,
  lastUpdated: '2025-01-15T10:30:00Z',

  // Lot-level detail (local tracking)
  lots: [
    { lotId: 'lot_001', ... },
    { lotId: 'lot_002', ... }
  ],
  lotsSynced: true            // false if lots don't sum to IBKR quantity
}
```

### Lot (Local Tracking)

```javascript
{
  lotId: 'lot_001',
  symbol: 'AAPL',
  quantity: 50,
  purchasePrice: 142.00,      // Actual fill price
  purchaseDate: '2025-01-10T14:30:00Z',

  // Source tracking
  source: 'platform' | 'imported' | 'synthetic',
  orderId: 'order_123',       // If created via our platform
  ibkrExecutionId: 'exec_456', // IBKR execution reference

  // Real-time calculated fields
  marketPrice: 150.25,
  marketValue: 7512.50,
  unrealizedPnL: 412.50,
  unrealizedPnLPercent: 5.81,

  // Signal evaluation context
  profitTargetPrice: 156.20,  // Based on profitRequirement param
  meetsProftTarget: false,
  daysSinceAcquisition: 5
}
```

### Position with Lots (Combined View)

```javascript
{
  // IBKR aggregate data
  symbol: 'AAPL',
  ibkrQuantity: 100,
  ibkrAverageCost: 145.50,

  // Local lot tracking
  lots: [
    { lotId: 'lot_001', quantity: 50, purchasePrice: 142.00, source: 'platform' },
    { lotId: 'lot_002', quantity: 30, purchasePrice: 148.00, source: 'platform' },
    { lotId: 'lot_003', quantity: 20, purchasePrice: 150.00, source: 'synthetic' }
  ],
  localQuantity: 100,         // Sum of lots

  // Reconciliation status
  isReconciled: true,         // ibkrQuantity === localQuantity
  discrepancy: 0              // ibkrQuantity - localQuantity
}
```

### Pending Order

```javascript
{
  orderId: 'pending_001',
  symbol: 'AAPL',
  action: 'BUY',
  quantity: 50,
  orderType: 'LMT',
  limitPrice: 148.00,
  estimatedCost: 7400.00,
  estimatedCommission: 1.00,
  status: 'PENDING_REVIEW',
  signalSource: {
    type: 'GRID',
    triggerPrice: 149.50,
    gridLevel: 145.00
  },
  createdAt: '2025-01-15T10:30:00Z',
  reviewedAt: null,
  transmittedAt: null
}
```

### Signal

```javascript
{
  id: 'sig_001',
  symbol: 'AAPL',
  timestamp: '2025-01-15T10:30:00Z',
  currentPrice: 149.50,
  action: 'BUY',
  signalType: 'GRID',
  confidence: 0.90,
  suggestedOrder: {
    action: 'BUY',
    quantity: 50,
    orderType: 'LMT',
    limitPrice: 148.00
  },
  evaluation: {
    gridLevel: 145.00,
    gridIntervalPercent: 10,
    priceDropPercent: 12.5,
    existingPosition: 100,
    availableCash: 50000
  },
  reasoning: 'Price at $149.50 is 12.5% below grid level $170.86. Grid interval is 10%.'
}
```

## Source of Truth Architecture

### The Problem

Two systems track position data with different levels of detail:

| System | What It Tracks | Granularity |
|--------|----------------|-------------|
| **IBKR Account** | Actual positions, cash, P&L | Aggregate per symbol |
| **Live Trader DB** | Orders placed, lots acquired | Per-lot detail |

**Key Question:** When they disagree, which is correct?

### IBKR's Lot Tracking Capabilities

IBKR internally tracks tax lots, but access is limited:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    IBKR Data Availability                            │
├─────────────────────────────────────────────────────────────────────┤
│  TWS API: reqPositions()                                            │
│  └─> Returns: {symbol, quantity, avgCost, marketValue}              │
│      ❌ NO lot-level breakdown                                       │
│                                                                      │
│  TWS API: reqExecutions()                                           │
│  └─> Returns: Individual trade executions (fills)                   │
│      ✅ CAN reconstruct lots from execution history                 │
│      ⚠️  Only returns recent executions (few days)                  │
│                                                                      │
│  Flex Query (Web-based)                                             │
│  └─> Returns: Full tax lot detail, historical trades               │
│      ✅ Complete lot information                                    │
│      ❌ Not real-time, requires web authentication                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Source of Truth Decision

**Recommended: Dual Source of Truth with IBKR as Authority**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Source of Truth Model                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  IBKR is AUTHORITATIVE for:                                         │
│  ├─ Total position quantity (how many shares you actually own)      │
│  ├─ Available cash balance                                          │
│  ├─ Order status (filled, cancelled, etc.)                          │
│  └─ Market values and P&L (official numbers)                        │
│                                                                      │
│  Local DB is AUTHORITATIVE for:                                     │
│  ├─ Lot-level purchase prices (for DCA signal evaluation)          │
│  ├─ Strategy metadata (grid level, signal that triggered buy)      │
│  ├─ Order intent (pending orders before transmission)              │
│  └─ Historical signal evaluations                                   │
│                                                                      │
│  RECONCILIATION RULE:                                               │
│  └─ If local lot sum ≠ IBKR position quantity:                     │
│     → IBKR quantity is correct                                      │
│     → Local lots need adjustment (user prompted)                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Reconciliation Scenarios

#### Scenario 1: Normal Operation (In Sync)

```
IBKR Position: AAPL, 150 shares, avg $145
Local Lots:    [50 @ $140] + [50 @ $145] + [50 @ $150] = 150 shares
Status:        ✅ Reconciled
```

#### Scenario 2: External Trade in TWS (Out of Sync)

User buys 50 AAPL directly in TWS (not through our platform):

```
IBKR Position: AAPL, 200 shares, avg $146
Local Lots:    [50 @ $140] + [50 @ $145] + [50 @ $150] = 150 shares
Discrepancy:   +50 shares untracked

Action:
1. Alert user: "50 AAPL shares detected that aren't tracked"
2. Options:
   a) Import as synthetic lot (fetch price from execution or use current price)
   b) Ignore (don't evaluate for DCA signals)
   c) Manual entry (user provides purchase price)
```

#### Scenario 3: Partial Fill (Temporary Mismatch)

Order for 100 shares, only 60 filled so far:

```
IBKR Position: AAPL, 210 shares
Local Lots:    150 shares + 60 (partial fill recorded)
Open Order:    40 shares remaining

Status:        ✅ Reconciled (lots + open order = IBKR position)
```

#### Scenario 4: Database Loss/Corruption

Local database lost, IBKR has positions:

```
IBKR Position: AAPL, 200 shares, avg $146
Local Lots:    [empty]

Recovery Options:
1. Import all as single synthetic lot at IBKR avg cost ($146)
2. Query IBKR execution history to reconstruct recent lots
3. Import from Flex Query (full history, manual process)
```

### Reconciliation Algorithm

```javascript
async function reconcilePosition(symbol) {
  const ibkrPosition = await ibkr.getPosition(symbol);
  const localLots = await db.getLots(symbol);
  const openOrders = await db.getOpenBuyOrders(symbol);

  const localQty = sumQuantity(localLots);
  const pendingQty = sumQuantity(openOrders);
  const expectedQty = localQty + pendingQty;

  const discrepancy = ibkrPosition.quantity - expectedQty;

  if (discrepancy === 0) {
    return { status: 'reconciled' };
  }

  if (discrepancy > 0) {
    // More shares at IBKR than we track
    return {
      status: 'untracked_shares',
      untracked: discrepancy,
      suggestedAction: 'import_as_synthetic_lot',
      suggestedPrice: ibkrPosition.avgCost // Or fetch from executions
    };
  }

  if (discrepancy < 0) {
    // We think we have more than IBKR shows (serious issue)
    return {
      status: 'over_tracked',
      overTracked: Math.abs(discrepancy),
      suggestedAction: 'audit_local_lots',
      alert: 'CRITICAL: Local DB shows more shares than IBKR account'
    };
  }
}
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Position Data Flow                               │
└─────────────────────────────────────────────────────────────────────┘

  [Signal Engine evaluates]
           │
           ▼
  ┌─────────────────┐      "Create buy order for 50 AAPL at $148"
  │  Pending Order  │──────────────────────────────────────────────┐
  │  (Local DB)     │                                              │
  └─────────────────┘                                              │
           │                                                       │
           │ User approves (transmit=true)                         │
           ▼                                                       │
  ┌─────────────────┐                                              │
  │  IBKR Order     │ ◄─── Order sent to exchange                  │
  │  (TWS)          │                                              │
  └─────────────────┘                                              │
           │                                                       │
           │ Order fills (execution callback)                      │
           ▼                                                       │
  ┌─────────────────┐      ┌─────────────────┐                     │
  │  IBKR Position  │      │  Local Lot DB   │ ◄── Create lot from │
  │  (updated)      │      │  (new lot)      │     fill price/qty  │
  └─────────────────┘      └─────────────────┘                     │
           │                        │                              │
           │                        │                              │
           ▼                        ▼                              │
  ┌─────────────────────────────────────────────┐                  │
  │           RECONCILIATION CHECK              │ ◄────────────────┘
  │   Sum(local lots) == IBKR position qty?     │
  │   YES → ✅ All good                         │
  │   NO  → ⚠️ Alert user, suggest resolution  │
  └─────────────────────────────────────────────┘
```

### Local Database Schema

```sql
-- Lots table (source of truth for lot-level data)
CREATE TABLE lots (
  id UUID PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  purchase_price DECIMAL(10,4) NOT NULL,
  purchase_date TIMESTAMP NOT NULL,

  -- Source tracking
  source ENUM('platform', 'imported', 'synthetic') NOT NULL,
  order_id UUID REFERENCES orders(id),
  ibkr_execution_id VARCHAR(50),

  -- Status
  status ENUM('open', 'partially_sold', 'closed') DEFAULT 'open',
  remaining_quantity DECIMAL(10,2),

  -- Strategy context (for signal evaluation)
  grid_level_at_purchase DECIMAL(10,4),
  signal_type VARCHAR(20),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Position cache (mirrors IBKR, refreshed periodically)
CREATE TABLE ibkr_positions (
  symbol VARCHAR(10) PRIMARY KEY,
  quantity DECIMAL(10,2) NOT NULL,
  avg_cost DECIMAL(10,4) NOT NULL,
  market_value DECIMAL(12,2),
  unrealized_pnl DECIMAL(12,2),
  last_synced TIMESTAMP NOT NULL
);

-- Reconciliation status
CREATE TABLE reconciliation_status (
  symbol VARCHAR(10) PRIMARY KEY,
  local_quantity DECIMAL(10,2),
  ibkr_quantity DECIMAL(10,2),
  discrepancy DECIMAL(10,2),
  status ENUM('reconciled', 'untracked_shares', 'over_tracked'),
  last_checked TIMESTAMP,
  user_acknowledged BOOLEAN DEFAULT FALSE
);
```

### First-Time Import: Cold Start Problem

When launching Live Trader for the first time with existing IBKR positions, we have no lot history.

#### Example Scenarios

**Scenario A: TSLA (Large Profitable Position)**
```
IBKR Data:     720 shares @ $289 avg cost
Current Price: $420 (+45% profit)
Total Value:   $302,400

Import Options:
┌────────────────────────────────────────────────────────────────────┐
│ Option 1: Single Lot (RECOMMENDED)                                 │
│ └─ 1 lot: 720 shares @ $289                                       │
│    ✅ Accurate total P&L                                          │
│    ✅ Simple                                                      │
│    ⚠️  Sell signal = all or nothing                               │
│                                                                    │
│ Option 2: Split by Target Lot Value ($20k)                        │
│ └─ 10 lots: ~72 shares each @ $289                                │
│    ⚠️  All lots have same price = same as single lot for signals  │
│    ❌ Artificial structure doesn't reflect reality                 │
│                                                                    │
│ Option 3: Split by Share Count                                    │
│ └─ User specifies: "100 shares per lot" → 7 lots + 1 partial      │
│    ⚠️  Still all at same avg price                                │
│                                                                    │
│ Option 4: Manual Entry                                            │
│ └─ User enters actual purchase history (if they remember)         │
│    ✅ Most accurate if user has records                           │
│    ❌ Time consuming, user may not have data                       │
└────────────────────────────────────────────────────────────────────┘
```

**Scenario B: NBIS (Small Position at Loss)**
```
IBKR Data:     150 shares @ $110 avg cost
Current Price: $95 (-14% loss)
Total Value:   $14,250

Key Insight: Entire position < typical lot size ($20k)
             This should be 1 lot regardless of settings

Import: 1 lot: 150 shares @ $110
```

#### Recommended Import Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│              FIRST-TIME IMPORT DECISION TREE                        │
└─────────────────────────────────────────────────────────────────────┘

For each IBKR position:

1. Calculate position value at avg cost
   └─ positionValue = shares × avgCost

2. Compare to configured lot size for this stock
   └─ lotSize = getLotSizeForSymbol(symbol) // may vary per stock

3. Decision:
   ┌─────────────────────────────────────────────────────────────────┐
   │ IF positionValue <= lotSize × 1.5:                             │
   │    → Import as SINGLE LOT                                      │
   │    → Rationale: Position is small, don't artificially split    │
   │                                                                │
   │ IF positionValue > lotSize × 1.5:                              │
   │    → Prompt user with options:                                 │
   │      a) Single lot (treat as one purchase)                     │
   │      b) Smart split (estimate N lots at avg price)             │
   │      c) Manual entry (user provides actual lot history)        │
   │      d) Skip tracking (evaluate for BUY only, not SELL)        │
   └─────────────────────────────────────────────────────────────────┘

4. Special handling for positions at loss:
   └─ Positions at loss can remain as single lot
      Sell signals won't trigger anyway until profitable
```

#### Why Splitting at Same Price Doesn't Help

```
TSLA: 720 shares @ $289, current $420

Single Lot Approach:
  Lot 1: 720 shares @ $289 → Profit target: $289 × 1.10 = $318
  Signal: Current $420 > $318 → SELL SIGNAL (all 720 shares)

Split into 10 Lots Approach:
  Lot 1:  72 shares @ $289 → Target $318 → SELL SIGNAL
  Lot 2:  72 shares @ $289 → Target $318 → SELL SIGNAL
  ...
  Lot 10: 72 shares @ $289 → Target $318 → SELL SIGNAL

Result: All 10 lots trigger at same time = same as single lot!
Splitting only helps if lots have DIFFERENT purchase prices.
```

#### Per-Stock Lot Size Configuration

Since lot sizes should vary by stock price, the import should respect this:

```javascript
// Example lot size configuration
const lotSizeConfig = {
  default: 20000,           // $20k default
  bySymbol: {
    'TSLA': 25000,          // Higher-priced stock, bigger lots
    'NBIS': 10000,          // Smaller stock, smaller lots
    'AAPL': 20000,
  },
  // Or calculate dynamically based on stock price
  getDynamicLotSize: (symbol, currentPrice) => {
    // Target ~50-100 shares per lot for manageability
    const targetShares = 75;
    return Math.round(currentPrice * targetShares / 1000) * 1000;
  }
};
```

#### First-Time Import UI Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│           FIRST-TIME SETUP: Import Existing Positions               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Found 5 positions in your IBKR account:                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ TSLA    720 shares @ $289    Value: $208,080   +45%         │   │
│  │ ○ Import as single lot (recommended)                        │   │
│  │ ○ Split into estimated lots                                 │   │
│  │ ○ Enter lot history manually                                │   │
│  │ ○ Don't track (BUY signals only)                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ NBIS    150 shares @ $110    Value: $16,500    -14%         │   │
│  │ ● Import as single lot (auto-selected, small position)      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ AAPL    200 shares @ $180    Value: $36,000    +5%          │   │
│  │ ○ Import as single lot (recommended)                        │   │
│  │ ○ Split into estimated lots                                 │   │
│  │ ○ Enter lot history manually                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Continue with Selected Options]                                   │
│                                                                     │
│  ℹ️ Tip: Single lot is recommended for imported positions.         │
│     Lot-level tracking will work automatically for NEW purchases.  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Post-Import Behavior

After first-time import, going forward:
- **New BUY orders placed via platform:** Create proper individual lots with actual fill prices
- **Imported positions:** Remain as synthetic lots until sold
- **Mix of old and new:** Over time, as synthetic lots sell and new lots are created, position becomes fully tracked

### Historical Position Reconstruction ("Backfill")

Instead of importing as a single synthetic lot, **run a historical simulation** to reconstruct what the lots would look like if the position was acquired via DCA strategy.

#### The Concept

```
┌─────────────────────────────────────────────────────────────────────┐
│              HISTORICAL POSITION RECONSTRUCTION                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  INPUT:                                                              │
│  ├─ IBKR Position: TSLA, 720 shares, $289 avg cost                  │
│  ├─ Strategy Parameters: grid 10%, profit 10%, trailing 20%/10%     │
│  └─ Historical Price Data: 12 months of TSLA prices                 │
│                                                                      │
│  PROCESS:                                                            │
│  Run backtest simulation CONSTRAINED to end with 720 shares         │
│  Assume infinite capital, let strategy buy according to signals     │
│  Adjust starting capital to produce ~720 shares by end date         │
│                                                                      │
│  OUTPUT:                                                             │
│  ├─ Reconstructed lots with DIFFERENT purchase prices               │
│  ├─ Entry dates for each lot                                        │
│  ├─ Current trailing stop states (peak/bottom tracking)             │
│  ├─ Current grid level position                                     │
│  └─ All strategy state variables initialized                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### A. Time Window for Backfill

**Recommended: 6-12 months, or calculated based on position size**

```javascript
function calculateBackfillWindow(position, lotSize, params) {
  // Estimate how many lots in this position
  const estimatedLots = Math.ceil(
    (position.quantity * position.avgCost) / lotSize
  );

  // Assume ~1 lot acquired per month on average (conservative)
  // Add buffer for market volatility
  const monthsNeeded = Math.max(6, estimatedLots * 1.5);

  // Cap at reasonable maximum
  return Math.min(monthsNeeded, 24); // Max 2 years
}

// Example:
// TSLA: 720 shares × $289 = $208,080
// Lot size: $20,000
// Estimated lots: 10.4 → 11
// Months needed: 11 × 1.5 = 16.5 months
// → Use 16 months of history
```

#### B. Naming

| Option | Pros | Cons |
|--------|------|------|
| "Warm-up Run" | Intuitive | Vague |
| "Dry Run" | Common term | Implies no action |
| "Historical Sync" | Descriptive | Could mean syncing with broker |
| "Position Backfill" | Technical, accurate | Less user-friendly |
| **"Strategy Calibration"** | **Implies tuning to match reality** | **Recommended** |
| "Retrospective Analysis" | Academic | Too formal |

**Recommended name: "Strategy Calibration"** or **"Position Backfill"**

UI could say: *"Calibrating strategy to match your existing TSLA position..."*

#### C. Reconstruction Algorithm

```javascript
async function reconstructPosition(symbol, ibkrPosition, params, lotSize) {
  const { quantity: targetShares, avgCost: targetAvgCost } = ibkrPosition;
  const targetValue = targetShares * targetAvgCost;

  // Fetch historical data
  const months = calculateBackfillWindow(ibkrPosition, lotSize, params);
  const endDate = new Date();
  const startDate = subMonths(endDate, months);
  const priceHistory = await fetchHistoricalPrices(symbol, startDate, endDate);

  // Binary search for starting capital that produces ~target shares
  let startingCapital = targetValue * 1.5; // Initial guess
  let reconstructedResult;

  for (let i = 0; i < 10; i++) { // Max 10 iterations
    reconstructedResult = runBacktest({
      symbol,
      startDate,
      endDate,
      startingCapital,
      params,
      lotSize,
      priceHistory,
      // Don't actually sell - we want to accumulate to target
      sellEnabled: false
    });

    const resultShares = reconstructedResult.totalShares;

    if (Math.abs(resultShares - targetShares) < targetShares * 0.05) {
      // Within 5% - good enough
      break;
    }

    // Adjust capital for next iteration
    startingCapital *= (targetShares / resultShares);
  }

  return {
    lots: reconstructedResult.holdings.map(h => ({
      quantity: h.quantity,
      purchasePrice: h.purchasePrice,
      purchaseDate: h.purchaseDate,
      source: 'reconstructed',
      gridLevelAtPurchase: h.gridLevel,
      trailingState: h.trailingState
    })),
    strategyState: {
      currentPeak: reconstructedResult.peakPrice,
      currentBottom: reconstructedResult.bottomPrice,
      gridLevel: reconstructedResult.currentGridLevel,
      trailingBuyState: reconstructedResult.trailingBuyState,
      trailingSellStates: reconstructedResult.trailingSellStates
    },
    reconstructionMetadata: {
      windowMonths: months,
      simulatedShares: reconstructedResult.totalShares,
      targetShares: targetShares,
      matchPercent: (reconstructedResult.totalShares / targetShares) * 100
    }
  };
}
```

#### D. What Gets Initialized

```
┌─────────────────────────────────────────────────────────────────────┐
│           STRATEGY STATE INITIALIZED BY BACKFILL                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  LOT DATA:                                                          │
│  ├─ Multiple lots at different prices (realistic distribution)     │
│  ├─ Purchase dates for each lot                                     │
│  └─ Grid level at time of each purchase                            │
│                                                                      │
│  PRICE TRACKING:                                                    │
│  ├─ Current peak price (for trailing sell)                         │
│  ├─ Current bottom price (for trailing buy)                        │
│  └─ Price history window for calculations                          │
│                                                                      │
│  TRAILING STOP STATES (per lot):                                    │
│  ├─ Trailing sell activated? (price rose > activation %)           │
│  ├─ Peak since activation (for pullback calculation)               │
│  └─ Ready to sell? (pullback from peak > threshold %)              │
│                                                                      │
│  GRID STATE:                                                        │
│  ├─ Current grid level                                              │
│  ├─ Last grid buy price                                            │
│  └─ Grid increment state (if using consecutive incremental)        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### E. Handling Mismatches (Residual Shares)

The backfill won't produce exact share count. Handle the difference:

```
EXAMPLE:
  IBKR Position:    720 shares @ $289 avg
  Backfill Result:  680 shares across 9 lots
  Residual:         40 shares unaccounted for

┌─────────────────────────────────────────────────────────────────────┐
│                    RESIDUAL HANDLING OPTIONS                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Option 1: LEGACY LOT (Recommended)                                 │
│  ├─ Create special "legacy" lot for residual shares                │
│  ├─ Use IBKR avg cost as purchase price                            │
│  ├─ Mark as source: 'legacy_residual'                              │
│  ├─ Apply simplified rules:                                        │
│  │   ├─ Sell signals: Simple profit target only (no trailing)     │
│  │   ├─ Or: Include in trailing but from current date forward     │
│  │   └─ Buy signals: Don't affect (already have these shares)     │
│  └─ Over time: As you sell reconstructed lots, residual remains   │
│                                                                      │
│  Option 2: DISTRIBUTE RESIDUAL                                      │
│  ├─ Add residual shares proportionally to existing lots            │
│  ├─ Example: 40 shares / 9 lots = ~4.4 shares each                │
│  └─ Keeps lot count same, slightly inflates each lot              │
│                                                                      │
│  Option 3: USER ASSIGNS                                             │
│  ├─ Present residual to user                                       │
│  ├─ Let them assign to existing lot or create new one             │
│  └─ Or let them mark as "do not track"                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Recommended: Option 1 (Legacy Lot)** with special handling:

```javascript
// Legacy lot schema
{
  lotId: 'legacy_TSLA_001',
  symbol: 'TSLA',
  quantity: 40,
  purchasePrice: 289.00,  // IBKR avg cost
  purchaseDate: null,     // Unknown
  source: 'legacy_residual',

  // Special handling flags
  legacyHandling: {
    applyTrailingSell: false,      // Don't track trailing for this lot
    sellOnSimpleProfitOnly: true,  // Sell when price > purchase × (1 + profitReq)
    includeInBuySignals: false,    // Don't consider when calculating buy grids
    notes: 'Residual from position backfill - 40 shares could not be reconstructed'
  }
}
```

#### Backfill UI Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│           STRATEGY CALIBRATION: TSLA                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Current IBKR Position:                                             │
│  └─ 720 shares @ $289.00 avg ($208,080 total)                      │
│                                                                      │
│  Calibration Settings:                                              │
│  ├─ Strategy: DCA with 10% grid, 10% profit, trailing 20%/10%     │
│  ├─ Lot Size: $20,000                                              │
│  └─ Lookback Period: [12 months ▼]                                 │
│                                                                      │
│  [Run Calibration]                                                  │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  ✅ Calibration Complete                                            │
│                                                                      │
│  Reconstructed Position:                                            │
│  ├─ Lot 1:  80 shares @ $245.20 (Feb 2024)                        │
│  ├─ Lot 2:  75 shares @ $268.50 (Apr 2024)                        │
│  ├─ Lot 3:  70 shares @ $255.80 (May 2024)                        │
│  ├─ Lot 4:  82 shares @ $298.40 (Jul 2024)                        │
│  ├─ ...                                                            │
│  └─ Lot 9:  78 shares @ $310.25 (Nov 2024)                        │
│                                                                      │
│  Total Reconstructed: 680 shares                                    │
│  Residual (Legacy Lot): 40 shares @ $289 avg                       │
│                                                                      │
│  Strategy State Initialized:                                        │
│  ├─ ✅ Peak price tracking: $425.50                                │
│  ├─ ✅ Bottom price tracking: $242.10                              │
│  ├─ ✅ Trailing sell states: 7 lots activated                      │
│  └─ ✅ Grid level: $378.20                                         │
│                                                                      │
│  [Accept & Continue]  [Adjust Settings]  [Manual Entry Instead]    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. Evaluation: Is Backfill the Best Approach?

| Approach | Pros | Cons |
|----------|------|------|
| **Single Synthetic Lot** | Simple, fast | No lot distribution, all-or-nothing signals |
| **Manual Entry** | Most accurate if user has data | Time-consuming, user may not have records |
| **IBKR Flex Query Import** | Uses actual trade history | Complex setup, not all users have access |
| **Historical Backfill** ⭐ | Realistic lot distribution, initializes all state | Approximation, may not match reality exactly |

**Verdict: Backfill is the best default approach because:**
1. Produces realistic lot distribution automatically
2. Initializes ALL strategy state (peaks, bottoms, trailing)
3. No manual work required from user
4. Residual handling is tractable
5. Can be refined with user input if needed

**Potential Enhancement: Hybrid Approach**
- Start with backfill
- If user has Flex Query data → use to validate/correct
- If user has partial memory → allow manual override of specific lots

### Key Design Decisions

1. **IBKR is always right for quantity** - If IBKR says you have 100 shares, you have 100 shares. Period.

2. **Local DB enriches with lot detail** - We add the "why" and "when" that IBKR doesn't expose.

3. **Proactive reconciliation** - Check on every position refresh, not just when problems occur.

4. **User in the loop** - Don't auto-correct discrepancies; prompt user to resolve.

5. **Graceful degradation** - If local lots are missing, DCA signals can still work using IBKR avg cost as single synthetic lot.

6. **First-time import favors simplicity** - Default to single lot for imported positions; accurate lot tracking begins with new orders.

## API Endpoints

### Connection
```
POST   /api/ibkr/connect          - Connect to TWS/Gateway
POST   /api/ibkr/disconnect       - Disconnect
GET    /api/ibkr/status           - Get connection status
```

### Positions
```
GET    /api/ibkr/positions        - Get all positions
GET    /api/ibkr/positions/:symbol - Get position for symbol
GET    /api/ibkr/account          - Get account summary
```

### Market Data
```
POST   /api/ibkr/subscribe        - Subscribe to symbols
POST   /api/ibkr/unsubscribe      - Unsubscribe from symbols
GET    /api/ibkr/prices           - Get current prices
GET    /api/ibkr/prices/:symbol   - Get price for symbol
```

### Orders
```
POST   /api/ibkr/orders           - Create pending order
GET    /api/ibkr/orders/pending   - Get pending orders
POST   /api/ibkr/orders/:id/transmit - Transmit pending order
POST   /api/ibkr/orders/transmit-all - Transmit all pending
DELETE /api/ibkr/orders/:id       - Cancel order
GET    /api/ibkr/orders/open      - Get open orders
GET    /api/ibkr/orders/history   - Get order history
```

### Signals
```
POST   /api/ibkr/signals/evaluate - Evaluate signals for symbols
GET    /api/ibkr/signals/latest   - Get latest signals
POST   /api/ibkr/signals/config   - Set strategy parameters
GET    /api/ibkr/signals/config   - Get strategy parameters
```

### Logs
```
GET    /api/ibkr/logs             - Get trading logs
GET    /api/ibkr/logs/export      - Export logs
```

## WebSocket Events

Real-time updates via WebSocket connection:

```javascript
// Server → Client
{ type: 'connection_status', status: 'connected' }
{ type: 'price_update', symbol: 'AAPL', price: 150.25, timestamp: '...' }
{ type: 'position_update', position: {...} }
{ type: 'order_status', orderId: '...', status: 'FILLED', ... }
{ type: 'signal', signal: {...} }
{ type: 'error', category: '...', message: '...' }
```

## Frontend Components

### IBKRDashboard.js
Main dashboard integrating all IBKR functionality.

### ConnectionStatus.js
Shows connection status with connect/disconnect controls.

### PositionsTable.js
Displays current positions with real-time P&L.

### PendingOrdersQueue.js
Order review queue with approve/reject actions.

### SignalMonitor.js
Real-time signal display with action recommendations.

### PriceWatch.js
Live prices for subscribed symbols.

### TradingLog.js
Scrollable log viewer with filtering.

## Integration with Existing Code

### Reusing dcaSignalEngine.js

The existing `dcaSignalEngine.js` contains pure functions for signal evaluation. The `LiveSignalEvaluator` will:

1. Gather current state (price, positions, pending orders)
2. Transform to format expected by signal engine
3. Call appropriate evaluation functions
4. Transform results to live trading signal format

```javascript
// Example integration
const { evaluateGridBuy, evaluateTrailingStopBuy } = require('../dcaSignalEngine');

async evaluateSignals(symbol) {
  const currentPrice = this.marketData.getLatestPrice(symbol);
  const position = this.positionsCache.get(symbol);
  const params = this.strategyParams.get(symbol);

  // Transform to backtest-like state
  const state = {
    currentPrice,
    holdings: position ? [{ purchasePrice: position.averageCost, quantity: position.quantity }] : [],
    peakPrice: this.priceTracker.getPeak(symbol),
    bottomPrice: this.priceTracker.getBottom(symbol),
    // ... other state
  };

  // Evaluate using existing pure functions
  const gridSignal = evaluateGridBuy(state, params);
  const trailingSignal = evaluateTrailingStopBuy(state, params);

  // Combine and return actionable signal
  return this.combineSignals(symbol, gridSignal, trailingSignal);
}
```

## Error Handling Strategy

### Connection Errors
- Automatic retry with exponential backoff
- Max 5 retries before requiring manual intervention
- Alert user via WebSocket on persistent failures

### Market Data Errors
- Fall back to delayed data if available
- Continue operation with stale prices up to 5 minutes
- Pause signal evaluation if prices older than 5 minutes

### Order Errors
- Never retry order placement automatically (safety)
- Log full error details
- Alert user immediately
- Keep order in pending state for review

### Recovery
- On reconnection: reconcile positions and orders
- Detect and alert on position mismatches
- Safe mode: stop new order creation until manual approval

## Security Considerations

1. **Credentials Storage**: Use environment variables or encrypted config file
2. **API Permissions**: Support read-only mode for monitoring
3. **Order Confirmation**: Two-step order process (create → transmit)
4. **Audit Trail**: Immutable logging of all trading decisions
5. **Rate Limiting**: Respect IBKR API limits

## Testing Strategy

### Unit Tests
- Signal evaluation logic
- Order creation and validation
- State management

### Integration Tests
- Mock IBKR client for API tests
- WebSocket event handling

### Paper Trading
- Full integration testing with IBKR paper account
- End-to-end signal → order flow

## Configuration

```javascript
// config/ibkr.js
module.exports = {
  connection: {
    host: process.env.IBKR_HOST || '127.0.0.1',
    port: process.env.IBKR_PORT || 7497, // Paper trading default
    clientId: process.env.IBKR_CLIENT_ID || 1,
  },
  autoReconnect: {
    enabled: true,
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
  },
  marketData: {
    maxSubscriptions: 50,
    staleThresholdMs: 300000, // 5 minutes
  },
  orders: {
    // Transmission mode: 'manual' | 'auto' | 'hybrid'
    transmissionMode: 'manual',

    // For hybrid mode: auto-transmit signals above this confidence threshold
    autoTransmitConfidenceThreshold: 0.90,

    // Auto-transmit safeguards (applies to 'auto' and 'hybrid' modes)
    safeguards: {
      maxDailyLoss: 5000,        // Pause auto-transmit if daily loss exceeds this
      maxPositionSize: 50000,    // Don't auto-transmit if position would exceed this
      maxDailyOrders: 20,        // Max auto-transmitted orders per day
      requireAcknowledgment: true // User must explicitly enable auto/hybrid mode
    },

    confirmationRequired: true,
  },
  logging: {
    enabled: true,
    retentionDays: 90,
    rotationSizeMb: 100,
  }
};
```
