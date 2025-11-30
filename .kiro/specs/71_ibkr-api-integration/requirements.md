# Requirements: IBKR API Integration for Live Trading

## Overview

Integrate the Adaptive DCA Strategy Platform with Interactive Brokers (IBKR) API to enable live trading based on simulation signals. The system will evaluate real-time prices against existing positions and pending orders, generating actionable trading signals that can be reviewed and transmitted manually or automatically.

## Background

The platform currently provides backtesting capabilities to evaluate historical data and generate buy/sell signals based on DCA strategies with trailing stops, dynamic grids, and capital optimization. This integration extends those capabilities to live market conditions using IBKR's TWS (Trader Workstation) or IB Gateway.

## Platform Architecture: Unified Product with Distinct Modes

### Naming Convention
- **Product Name:** Adaptive DCA Strategy Platform
- **Mode 1:** Backtest (existing simulator functionality)
- **Mode 2:** Live Trading (new IBKR integration)

### Design Principles
1. **Single unified product** - One codebase, shared components, consistent experience
2. **Clear mode distinction** - Visual and behavioral differentiation between backtest and live modes
3. **Shared strategy engine** - Same signal evaluation logic powers both modes
4. **Flow from backtest to live** - Users can export successful backtest configs to live trading

## User Requirements

### REQ-1: IBKR Connection Management
**Priority: High**

The system must establish and maintain a connection to IBKR via TWS (Trader Workstation).

**Connection Options:**
| Mode | Port | Use Case |
|------|------|----------|
| TWS Paper | 7497 | Testing & development (recommended for V1) |
| TWS Live | 7496 | Production trading |
| IB Gateway | 4001/4002 | Future: headless/automated operation |

**V1 Scope:** TWS connection only (ports 7496/7497). IB Gateway support deferred to future iteration.

**Acceptance Criteria:**
- Connect to TWS on configurable host:port (default localhost:7497 for paper trading)
- Handle TWS API settings (Enable API, trusted IPs)
- Implement automatic reconnection on connection loss
- Display connection status in the UI (connected, disconnected, reconnecting)
- Support switching between paper (7497) and live (7496) via configuration

### REQ-2: Real-Time Price Feeds
**Priority: High**

The system must receive and process real-time price data for monitored symbols.

**Acceptance Criteria:**
- Subscribe to real-time market data for configured symbols
- Handle market data subscription limits (based on IBKR account tier)
- Cache and display current prices alongside historical context
- Support delayed data fallback when real-time data unavailable
- Implement price feed health monitoring and alerts

### REQ-3: Position and Holdings Sync with Lot Tracking
**Priority: High**

The system must synchronize current positions from IBKR account AND maintain lot-level tracking for DCA signal evaluation.

**The Challenge:**
- IBKR provides aggregate positions (total quantity, average cost)
- DCA signal engine requires lot-level data (individual purchase prices for profit target evaluation)

**Solution: Hybrid Lot Tracking**

| Position Source | Lot Handling |
|----------------|--------------|
| Pre-existing IBKR positions | Import as single "synthetic lot" at average cost |
| New orders via our platform | Track as individual lots with exact fill prices |
| External trades (in TWS) | Detect via position change, prompt user to classify |

**Acceptance Criteria:**
- Fetch current positions (symbol, quantity, average cost, market value) from IBKR
- **Maintain local lot database** for positions created through our platform
- **On first sync**: Import existing IBKR positions as synthetic lots at average cost
- **On order fill**: Create new lot record with actual fill price, date, quantity
- **Lot-to-IBKR reconciliation**: Detect when local lots don't match IBKR position totals
- Display positions in the UI with real-time P&L (both aggregate and per-lot views)
- Support multiple account numbers
- Auto-refresh positions on trade execution
- Handle position discrepancies with user prompts for resolution

**Future Enhancement (Out of Scope V1):**
- Import historical trades via IBKR Flex Query to reconstruct full lot history
- Tax lot selection optimization (FIFO, LIFO, specific lot)

### REQ-4: Configurable Order Transmission Mode
**Priority: Critical**

Orders must support both manual review and automatic transmission, with user-configurable behavior.

**Transmission Modes:**
1. **Manual Mode (default):** Orders created in "pending" state, requiring explicit approval before transmission
2. **Auto Mode:** Orders automatically transmitted after creation (for experienced users/automation)
3. **Hybrid Mode:** Auto-transmit for signals above configurable confidence threshold, manual for others

**Acceptance Criteria:**
- Create orders with `transmit=false` (pending state) by default
- Display pending orders in a dedicated review queue
- Allow manual approval (transmit) or rejection of pending orders
- Support batch approval of multiple orders
- Show order preview with estimated cost, commission, and impact
- **Configurable transmission mode per user/session (manual/auto/hybrid)**
- **Auto-transmit safeguards: daily loss limit, position size limit, order count limit**
- **Require explicit acknowledgment to enable auto-transmit mode**
- Log all order state transitions (pending → transmitted → filled/cancelled)

### REQ-5: Signal Evaluation Engine
**Priority: High**

Reuse existing DCA signal evaluation logic to analyze current market conditions.

**Acceptance Criteria:**
- Leverage `dcaSignalEngine.js` pure functions for signal evaluation
- Evaluate buy signals based on price vs. grid levels and trailing stop triggers
- Evaluate sell signals based on profit requirements and trailing stop triggers
- Consider existing positions and pending orders in calculations
- Generate signals without side effects (pure evaluation)
- Support all existing strategy parameters (grid interval, trailing stops, dynamic grid, etc.)

### REQ-6: Order Placement
**Priority: High**

The system must place orders through IBKR API.

**Acceptance Criteria:**
- Support market orders and limit orders
- Calculate appropriate order sizes based on lot sizing rules
- Validate orders against account buying power
- Handle order rejection gracefully with clear error messages
- Support order modification and cancellation
- Implement order timeout handling

### REQ-7: Comprehensive Logging
**Priority: High**

All trading activities must be logged for audit and debugging.

**Acceptance Criteria:**
- Log all price updates with timestamps
- Log all signal evaluations with input parameters and results
- Log all order lifecycle events (created, pending, transmitted, filled, rejected, cancelled)
- Log all position changes
- Log connection status changes
- Implement log rotation and retention policies
- Support log export for analysis

### REQ-8: Web-Based UI with Mode Differentiation
**Priority: High**

Provide a web-based interface for monitoring and control, with clear visual distinction from backtest mode.

**Mode Navigation:**
- Top-level navigation: `[Backtest]` | `[Live Trading]` tabs/buttons
- Clear indication of current mode at all times
- Seamless parameter sharing between modes (export backtest config to live)

**Visual Differentiation (Live Trading Mode):**
- **Distinct color theme:** Orange/amber accent colors (vs blue/green for backtest)
- **Persistent "LIVE" indicator:** Always visible badge/banner when in live mode
- **"Trading with Real Money" warning:** Displayed on first entry and in header
- **Different background tint:** Subtle visual cue that mode has changed
- **Confirmation dialogs:** Required for all order actions

**Dashboard Features:**
- Connection status with IBKR (connected/disconnected/reconnecting)
- Real-time positions with P&L
- Pending orders review queue
- Real-time price display for monitored symbols
- Signal evaluation results with recommended actions
- Order review and approval workflow
- Position performance metrics
- Alert notifications for significant events
- Responsive design for desktop and tablet use

**Safety UX:**
- Confirmation prompt before transmitting any order
- Double-confirmation for auto-transmit mode enablement
- Visual warning when approaching safeguard limits
- Emergency "pause all trading" button

### REQ-9: Error Handling and Recovery
**Priority: High**

The system must handle errors gracefully and recover automatically where possible.

**Acceptance Criteria:**
- Graceful degradation when market data unavailable
- Automatic retry for transient API errors
- Alert on persistent errors requiring manual intervention
- Safe mode: Stop order creation on repeated failures
- Position reconciliation on reconnection
- Clear error messages with suggested remediation

## Non-Functional Requirements

### NFR-1: Reliability
- System uptime target: 99.5% during market hours
- Maximum reconnection time: 30 seconds
- Order acknowledgment within 2 seconds

### NFR-2: Security
- API credentials stored securely (encrypted at rest)
- No credentials in logs or error messages
- Support for IBKR's security requirements (read-only vs trading permissions)

### NFR-3: Performance
- Price update processing latency: < 100ms
- Signal evaluation latency: < 500ms
- UI update frequency: At least 1Hz for prices

### NFR-4: Scalability
- Support monitoring up to 50 symbols simultaneously
- Handle burst of price updates during market volatility

## Future Considerations (Out of Scope for V1)

- CLI interface for automation/scripting
- Automated transmit based on confidence levels
- Multi-strategy support (different parameters per symbol group)
- Historical trade import from IBKR
- Tax lot optimization
- Integration with other brokers
