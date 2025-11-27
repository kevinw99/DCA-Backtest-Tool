# Spec 28: Portfolio-Based Capital Management

## Problem Statement

Currently, the DCA backtest system treats each stock independently with **fixed capital allocation**:
- Each stock gets $10,000 per lot × 10 max lots = $100,000 maximum
- 10 stocks = $1,000,000 total capital needed
- **Problem**: In reality, not all stocks will use maximum capital simultaneously

In real portfolio management with **$500,000 total capital**:
- Stock A might use 5 lots ($50,000)
- Stock B might use 8 lots ($80,000)
- Stock C might use 3 lots ($30,000)
- Dynamic capital allocation based on available funds
- **Better capital utilization and risk management**

## Proposed Solution

Create a **Portfolio DCA Backtest** mode that:
1. Runs multiple stocks simultaneously with shared capital pool
2. Allocates capital on first-come-first-served basis
3. Rejects buy orders when insufficient capital available
4. Tracks portfolio-level AND individual stock metrics
5. Logs capital utilization and rejected orders over time

## Key Requirements

### R1: Portfolio Configuration

**R1.1 Portfolio Capital Pool**
```javascript
{
  "portfolioMode": true,
  "totalCapital": 500000,  // Total capital for entire portfolio
  "lotSizeUsd": 10000,     // Standard lot size for all stocks
  "maxLotsPerStock": 10,   // Max lots any single stock can hold
  "stocks": [
    { "symbol": "TSLA", "params": {...} },
    { "symbol": "AAPL", "params": {...} },
    // ... 10 stocks total
  ]
}
```

**R1.2 Capital Constraints**
- At any time: `deployedCapital + cashReserve = totalCapital`
- Buy order requires: `availableCapital >= lotSizeUsd`
- Sell order returns capital to pool immediately

### R2: Order Execution Logic

**R2.1 Buy Order Processing**
```javascript
// Daily simulation loop processes ALL stocks
for each date:
  for each stock in portfolio:
    if stock.triggersBuySignal():
      if availableCapital >= lotSizeUsd:
        executeBuy(stock, lotSizeUsd)
        availableCapital -= lotSizeUsd
      else:
        logRejectedOrder(date, stock, 'INSUFFICIENT_CAPITAL')
```

**R2.2 Sell Order Processing**
```javascript
if stock.triggersSellSignal():
  sellValue = executeSell(stock)
  availableCapital += sellValue  // Capital returned to pool
```

**R2.3 Order Priority**
- Process stocks in order: alphabetical by symbol (deterministic)
- First stock to trigger buy gets priority
- No complex prioritization in v1 (can be added later)

### R3: Metrics Tracking

**R3.1 Portfolio-Level Metrics**
```javascript
{
  "portfolioSummary": {
    // Capital metrics
    "totalCapital": 500000,
    "finalPortfolioValue": 650000,
    "cashReserve": 50000,
    "deployedCapital": 350000,
    "capitalUtilizationPercent": 70,

    // Performance metrics
    "totalReturn": 150000,
    "totalReturnPercent": 30,
    "cagr": 8.5,
    "cagrPercent": 8.5,
    "maxDrawdown": 75000,
    "maxDrawdownPercent": 15,
    "sharpeRatio": 1.2,
    "sortinoRatio": 1.8,

    // Activity metrics
    "totalBuys": 45,
    "totalSells": 23,
    "rejectedBuys": 8,
    "rejectedBuysValue": 80000
  }
}
```

**R3.2 Per-Stock Metrics**
```javascript
{
  "stockResults": [
    {
      "symbol": "TSLA",
      "lotsHeld": 5,
      "capitalDeployed": 50000,
      "marketValue": 75000,
      "unrealizedPNL": 25000,
      "realizedPNL": 5000,
      "totalPNL": 30000,

      // Performance metrics
      "stockReturn": 30000,
      "stockReturnPercent": 60,
      "cagr": 12.5,
      "maxDrawdown": 15000,
      "sharpeRatio": 1.5,

      // Activity
      "totalBuys": 7,
      "totalSells": 2,
      "rejectedBuys": 1,

      // Portfolio contribution
      "contributionToPortfolioReturn": 20,  // percent
      "contributionToPortfolioValue": 11.5  // percent
    },
    // ... other stocks
  ]
}
```

**R3.3 Time-Series Data**
```javascript
{
  "capitalUtilizationTimeSeries": [
    {
      "date": "2021-09-01",
      "totalCapital": 500000,
      "deployedCapital": 50000,
      "cashReserve": 450000,
      "utilizationPercent": 10,
      "portfolioValue": 500000,
      "totalPNL": 0
    },
    // ... daily snapshots
  ]
}
```

### R4: Rejected Order Logging

**R4.1 Rejected Order Event**
```javascript
{
  "rejectedOrders": [
    {
      "date": "2022-03-15",
      "time": "close",
      "symbol": "NVDA",
      "orderType": "BUY",
      "lotSize": 10000,
      "price": 245.50,
      "reason": "INSUFFICIENT_CAPITAL",
      "availableCapital": 8500,
      "requiredCapital": 10000,
      "shortfall": 1500,
      "portfolioState": {
        "deployedCapital": 491500,
        "cashReserve": 8500,
        "utilizationPercent": 98.3
      }
    }
  ]
}
```

**R4.2 Logging Requirements**
- Log every rejected buy order
- Include complete context (portfolio state, reason, shortfall)
- Count rejected orders per stock
- Calculate total missed opportunity value

### R5: Capital Flow Tracking

**R5.1 Daily Capital Flow**
```javascript
{
  "capitalFlow": [
    {
      "date": "2022-03-15",
      "buys": 30000,        // Total capital deployed in buys
      "sells": 15000,       // Total capital returned from sells
      "netFlow": -15000,    // Negative = net deployment
      "startingCash": 100000,
      "endingCash": 85000,
      "rejectedBuysValue": 10000
    }
  ]
}
```

### R6: Portfolio Rebalancing (Future)

**Out of Scope for v1, but designed for future:**
- Auto-rebalancing to maintain target weights
- Dynamic lot size based on portfolio size
- Priority rules for capital allocation
- Risk-based position sizing

## API Design

### POST /api/portfolio-backtest

**Request:**
```javascript
{
  "portfolioMode": true,
  "totalCapital": 500000,
  "startDate": "2021-09-01",
  "endDate": "2025-10-09",
  "lotSizeUsd": 10000,
  "maxLotsPerStock": 10,

  // Common parameters for all stocks (or per-stock override)
  "defaultParams": {
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    // ... all DCA parameters
  },

  "stocks": [
    {
      "symbol": "TSLA",
      // Optional per-stock overrides
      "params": {
        "beta": 2.086,
        "coefficient": 1
      }
    },
    { "symbol": "AAPL" },
    { "symbol": "NVDA" },
    { "symbol": "MSFT" },
    { "symbol": "GOOGL" },
    { "symbol": "AMZN" },
    { "symbol": "META" },
    { "symbol": "AMD" },
    { "symbol": "NFLX" },
    { "symbol": "DIS" }
  ]
}
```

**Response:**
```javascript
{
  "success": true,
  "data": {
    "portfolioSummary": { /* R3.1 */ },
    "stockResults": [ /* R3.2 */ ],
    "capitalUtilizationTimeSeries": [ /* R3.3 */ ],
    "rejectedOrders": [ /* R4.1 */ ],
    "capitalFlow": [ /* R5.1 */ ]
  }
}
```

## Implementation Architecture

### Component Structure

```
backend/
  services/
    portfolioBacktestService.js     # NEW - Portfolio orchestration
    dcaBacktestService.js            # Existing - Used for each stock
    portfolioMetricsService.js       # NEW - Portfolio-level calculations

frontend/
  components/
    PortfolioBacktest.js             # NEW - Portfolio config form
    PortfolioResults.js              # NEW - Portfolio results display
    PortfolioChart.js                # NEW - Capital utilization chart
    StockAllocation.js               # NEW - Per-stock breakdown
```

### Data Flow

```
1. User configures portfolio (10 stocks + $500K capital)
2. Backend loads price data for all stocks
3. Simulation engine:
   - Loop through dates chronologically
   - For each date:
     a. Check each stock for buy/sell signals
     b. Process sells first (return capital)
     c. Process buys (if capital available)
     d. Log rejected orders
     e. Calculate portfolio metrics
4. Return aggregated results
```

## Success Criteria

### SC1: Capital Constraint Enforcement
- ✅ Never exceed totalCapital
- ✅ deployedCapital + cashReserve = totalCapital at all times
- ✅ Reject buy orders when insufficient capital
- ✅ All rejected orders logged with context

### SC2: Metrics Accuracy
- ✅ Portfolio-level CAGR matches manual calculation
- ✅ Sum of stock returns = portfolio return
- ✅ Capital utilization % correct at all times
- ✅ Max drawdown tracks lowest portfolio value

### SC3: Individual Stock Tracking
- ✅ Each stock has complete transaction history
- ✅ Per-stock P&L matches individual backtest
- ✅ Stock contribution percentages sum to 100%

### SC4: Rejected Order Transparency
- ✅ Every rejected order logged with full context
- ✅ Total missed opportunity value calculated
- ✅ Per-stock rejected order count available

### SC5: Performance
- ✅ 10-stock portfolio backtest completes in < 30 seconds
- ✅ UI displays results clearly with charts
- ✅ CSV export includes portfolio and per-stock data

## Example Scenario

**Configuration:**
- Total Capital: $500,000
- Lot Size: $10,000
- Max Lots per Stock: 10
- Portfolio: 10 stocks (TSLA, AAPL, NVDA, MSFT, GOOGL, AMZN, META, AMD, NFLX, DIS)

**Simulation Results:**
```
Portfolio Summary:
- Final Value: $687,500 (+37.5%)
- Capital Utilized: 85% average
- CAGR: 8.9%
- Max Drawdown: -22%
- Rejected Buys: 12 orders ($120,000 missed)

Top Performers:
1. NVDA: +125% (3 lots held, $45K deployed)
2. TSLA: +89% (4 lots held, $50K deployed)
3. AMD: +67% (5 lots held, $48K deployed)

Capital Events:
- 2022-03-15: NVDA buy rejected (only $8.5K available)
- 2023-11-02: AMD buy rejected (only $5K available)
- 2024-07-18: META buy rejected (fully deployed)
```

## Testing Strategy

### Unit Tests
- Capital constraint enforcement
- Buy/sell order processing
- Metrics calculations (portfolio & per-stock)
- Rejected order logging

### Integration Tests
- Full 10-stock portfolio backtest
- Verify sum(stock returns) = portfolio return
- Test edge cases (all stocks buying simultaneously)

### Comparison Tests
- Run same stock individually vs in portfolio
- Verify metrics match when capital unlimited
- Compare capital utilization scenarios

## Dependencies

- Existing DCA backtest service (reused for each stock)
- All existing DCA features (Spec 17, 18, 23, 25, 26, 27)
- Database for storing portfolio configurations (future)

## Out of Scope (v1)

- Portfolio optimization / auto-rebalancing
- Risk-weighted position sizing
- Correlation-based diversification
- Tax lot accounting
- Multi-currency support
- Short positions in portfolio mode

## Risk Mitigation

### Data Integrity
- Validate capital constraints after every transaction
- Assert: deployedCapital + cashReserve = totalCapital
- Log warnings if constraints violated

### Performance
- Load price data for all stocks upfront
- Process dates chronologically (single pass)
- Cache calculated metrics

### User Experience
- Clear rejected order notifications
- Visual capital utilization chart
- Export detailed audit trail

## Future Enhancements

### v2: Portfolio Optimization
- Target weight allocation
- Auto-rebalancing triggers
- Risk-based position sizing

### v3: Advanced Features
- Tax-loss harvesting
- Correlation tracking
- Risk parity allocation
- Factor exposure analysis
