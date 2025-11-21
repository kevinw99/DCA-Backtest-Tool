# Momentum Trading Parameters API Reference

## Overview

Momentum-based trading parameters enable trend-following strategies in the DCA Backtest Tool, allowing traders to "buy strength" and "sell weakness" instead of the traditional "buy dips" and "sell spikes" approach.

**Status:** Available in single, portfolio, and batch backtest modes (Spec 45 + Spec 46)

## Parameters

### momentumBasedBuy

**Type:** Boolean
**Default:** `false`
**Modes:** Single, Portfolio, Batch

**Description:**

Enable momentum-based buying strategy. When enabled, buys are only executed when the portfolio is profitable (P/L > 0), creating a "buy on strength" pattern.

**Traditional DCA Behavior (momentumBasedBuy = false):**
- Buys occur when price drops below activation threshold
- Strategy: "Buy the dip" - accumulate during price declines
- `maxLots` constraint prevents over-buying

**Momentum Mode Behavior (momentumBasedBuy = true):**
- Buy activation threshold set to 0% (neutral position)
- Buys ONLY execute when current P/L > 0
- `maxLots` constraint **removed** (unlimited position accumulation during profitable trends)
- Buy orders are blocked when P/L ≤ 0

**Use Cases:**
- Strong trending/bull markets
- High conviction that trend will continue
- "Add to winners" strategy
- Momentum-following algos

**Side Effects:**
- **Increases `buyBlockedByPnL` counter** when orders are blocked due to negative P/L
- **Removes maxLots protection** - position can grow indefinitely during profitable trends
- May result in fewer total buys compared to traditional mode

**Statistics Tracked:**
- `buyBlockedByPnL`: Count of buy orders blocked due to P/L ≤ 0
- `momentumMode.buyEnabled`: Boolean indicating if momentum buy is active

---

### momentumBasedSell

**Type:** Boolean
**Default:** `false`
**Modes:** Single, Portfolio, Batch

**Description:**

Enable momentum-based selling strategy. When enabled, sells are only executed when the portfolio is unprofitable (P/L < 0), creating a "sell on weakness" pattern.

**Traditional DCA Behavior (momentumBasedSell = false):**
- Sells occur when price rises above activation threshold AND profit requirement met
- Strategy: "Sell the spike" - take profits during price increases
- Standard DCA profit-taking

**Momentum Mode Behavior (momentumBasedSell = true):**
- Sell activation threshold set to 0% (neutral position)
- Sells ONLY execute when current P/L < 0
- Profit requirement still applies (must meet minimum profit per lot)
- Sell orders are blocked when P/L ≥ 0

**Use Cases:**
- Strong declining/bear markets
- Cut losses during downtrends
- "Get out of losers" strategy
- Defensive position management

**Side Effects:**
- **Increases `sellBlockedByPnL` counter** when orders are blocked due to non-negative P/L
- May result in fewer total sells compared to traditional mode
- Works in conjunction with `profitRequirement` - both conditions must be met

**Statistics Tracked:**
- `sellBlockedByPnL`: Count of sell orders blocked due to P/L ≥ 0
- `momentumMode.sellEnabled`: Boolean indicating if momentum sell is active

---

## Parameter Combinations

### Pure Momentum Mode (Buy + Sell)
```json
{
  "momentumBasedBuy": true,
  "momentumBasedSell": true
}
```
**Behavior:**
- Buy on strength (P/L > 0)
- Sell on weakness (P/L < 0)
- Full trend-following strategy
- High risk - can accumulate large positions during trends

### Momentum Buy Only
```json
{
  "momentumBasedBuy": true,
  "momentumBasedSell": false
}
```
**Behavior:**
- Buy on strength (P/L > 0)
- Sell traditionally (sell spikes for profit)
- Hybrid strategy: Accumulate during uptrends, take profits at peaks

### Momentum Sell Only
```json
{
  "momentumBasedBuy": false,
  "momentumBasedSell": true
}
```
**Behavior:**
- Buy traditionally (buy dips)
- Sell on weakness (P/L < 0)
- Hybrid strategy: Accumulate during dips, cut losses during downtrends

### Traditional Mode (Default)
```json
{
  "momentumBasedBuy": false,
  "momentumBasedSell": false
}
```
**Behavior:**
- Buy dips, sell spikes (mean reversion)
- Standard DCA strategy

---

## API Examples

### Single Backtest

```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "strategyMode": "long",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "profitRequirement": 0.05,
    "gridIntervalPercent": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10,
    "momentumBasedBuy": true,
    "momentumBasedSell": true
  }'
```

### Portfolio Backtest

```bash
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "MSFT", "NVDA"],
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "strategyMode": "long",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "profitRequirement": 0.05,
    "gridIntervalPercent": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10,
    "momentumBasedBuy": true,
    "momentumBasedSell": false
  }'
```

### Batch Backtest

```bash
curl -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "parameterRanges": {
      "symbols": ["AAPL", "MSFT", "NVDA"],
      "startDate": "2024-01-01",
      "endDate": "2024-12-31",
      "lotSizeUsd": 10000,
      "maxLots": 10,
      "profitRequirement": [0.05],
      "gridIntervalPercent": [0.10],
      "trailingBuyActivationPercent": [0.10],
      "trailingBuyReboundPercent": [0.05],
      "trailingSellActivationPercent": [0.20],
      "trailingSellPullbackPercent": [0.10],
      "maxLotsToSell": [1],
      "dynamicGridMultiplier": [1.0],
      "enableBetaScaling": false,
      "enableDynamicGrid": true,
      "normalizeToReference": true,
      "enableConsecutiveIncrementalBuyGrid": false,
      "enableConsecutiveIncrementalSellProfit": true,
      "momentumBasedBuy": true,
      "momentumBasedSell": true
    }
  }'
```

---

## Response Format

### Single/Portfolio Backtest Response

The response includes a `momentumMode` object showing the active configuration:

```json
{
  "success": true,
  "data": {
    "momentumMode": {
      "buyEnabled": true,
      "sellEnabled": true
    },
    "buyBlockedByPnL": 12,
    "sellBlockedByPnL": 5,
    "totalBuys": 8,
    "totalSells": 3,
    "totalPNL": 15234.56,
    ...
  }
}
```

**Response Fields:**

- `momentumMode.buyEnabled` (Boolean): `true` if `momentumBasedBuy` was enabled
- `momentumMode.sellEnabled` (Boolean): `true` if `momentumBasedSell` was enabled
- `buyBlockedByPnL` (Number): Count of buy orders blocked due to P/L ≤ 0 (when `momentumBasedBuy` enabled)
- `sellBlockedByPnL` (Number): Count of sell orders blocked due to P/L ≥ 0 (when `momentumBasedSell` enabled)
- `totalBuys` (Number): Actual executed buys (after blocking)
- `totalSells` (Number): Actual executed sells (after blocking)

### Batch Backtest Response

Each result in the `results` array includes the same momentum statistics:

```json
{
  "success": true,
  "results": [
    {
      "parameters": {
        "symbol": "AAPL",
        "momentumBasedBuy": true,
        "momentumBasedSell": true
      },
      "momentumMode": {
        "buyEnabled": true,
        "sellEnabled": true
      },
      "buyBlockedByPnL": 10,
      "sellBlockedByPnL": 3,
      "summary": {
        "totalTrades": 15,
        "totalReturn": 0.234,
        "annualizedReturn": 0.512
      }
    }
  ]
}
```

---

##Parameter Interactions

### Conflicts and Overrides

1. **momentumBasedBuy overrides maxLots constraint**
   - When `momentumBasedBuy = true`, `maxLots` is effectively ignored
   - Position can grow beyond `maxLots` during profitable trends
   - **Warning:** This can create large concentrated positions

2. **momentumBasedSell requires profitRequirement**
   - Both P/L < 0 AND profit requirement must be met
   - Sell will NOT execute if either condition fails

3. **Trailing buy activation threshold overridden**
   - `trailingBuyActivationPercent` is set to 0% when `momentumBasedBuy = true`
   - Original value is stored but not used

4. **Trailing sell activation threshold overridden**
   - `trailingSellActivationPercent` is set to 0% when `momentumBasedSell = true`
   - Original value is stored but not used

### Recommended Combinations

**High Conviction Bullish:**
```json
{
  "momentumBasedBuy": true,
  "momentumBasedSell": false,
  "profitRequirement": 0.05
}
```

**Defensive/Risk Management:**
```json
{
  "momentumBasedBuy": false,
  "momentumBasedSell": true,
  "profitRequirement": 0.02
}
```

**Pure Trend Following (High Risk):**
```json
{
  "momentumBasedBuy": true,
  "momentumBasedSell": true,
  "profitRequirement": 0.05
}
```

---

## Frontend UI

Momentum parameters are available in the UI with checkboxes:

**Location:** Single Backtest Form, Portfolio Backtest Form, Batch Backtest Form

**UI Controls:**
- ☑ Enable Momentum-Based Buy (Spec 45)
- ☑ Enable Momentum-Based Sell (Spec 45)

**Help Text:**
> Momentum mode: Buy on strength (P/L > 0), sell on weakness (P/L < 0). See docs for details.

---

## URL Parameters

For single and portfolio backtests, momentum parameters can be encoded in shareable URLs:

**URL Format:**
```
http://localhost:3000/backtest?mode=single&symbol=AAPL
  &momentumBasedBuy=true
  &momentumBasedSell=true
  ...other parameters...
```

**Encoding Rules:**
- `momentumBasedBuy`: Boolean → "true" or "false" (string)
- `momentumBasedSell`: Boolean → "true" or "false" (string)

**Decoding:**
```javascript
const momentumBasedBuy = searchParams.get('momentumBasedBuy') === 'true';
const momentumBasedSell = searchParams.get('momentumBasedSell') === 'true';
```

**Note:** Batch mode does not use shareable URLs. Parameters are passed via POST request body.

---

## Configuration Defaults

Default values are defined in `/config/backtestDefaults.json`:

```json
{
  "LONG_DCA": {
    "momentumBasedBuy": false,
    "momentumBasedSell": false
  },
  "SHORT_DCA": {
    "momentumBasedBuy": false,
    "momentumBasedSell": false
  },
  "LONG_TRAILING": {
    "momentumBasedBuy": false,
    "momentumBasedSell": false
  },
  "SHORT_TRAILING": {
    "momentumBasedBuy": false,
    "momentumBasedSell": false
  }
}
```

These defaults can be overridden on a per-ticker basis in `/config/tickerDefaults/[SYMBOL].json`.

---

## Error Handling

### Validation Errors

**Missing Required Fields:**
```json
{
  "success": false,
  "error": "Missing required parameter: symbol"
}
```

**Invalid Parameter Types:**
```json
{
  "success": false,
  "error": "momentumBasedBuy must be a boolean"
}
```

### Execution Warnings

Momentum mode does not generate errors during execution, but statistics counters track blocked orders:

- Check `buyBlockedByPnL` to see how many buy attempts were blocked
- Check `sellBlockedByPnL` to see how many sell attempts were blocked
- High blocked counts may indicate the strategy is not suitable for the selected asset/timeframe

---

## Performance Considerations

1. **Momentum mode can reduce trade frequency**
   - Fewer buys when P/L ≤ 0
   - Fewer sells when P/L ≥ 0
   - May result in lower capital utilization

2. **Position size can grow unbounded**
   - `momentumBasedBuy` removes `maxLots` protection
   - Monitor `maxCapitalDeployed` in results
   - Use appropriate `lotSizeUsd` to manage risk

3. **Best suited for trending markets**
   - Performs poorly in choppy/sideways markets
   - Traditional DCA may outperform in mean-reverting conditions

---

## Related Documentation

- [Momentum Trading Guide](/docs/guides/momentum-trading.md) - Conceptual guide and strategy examples
- [G01: Adding New Parameters](/specs/generic/G01_adding-new-parameter/README.md) - Implementation guide for developers
- [Spec 45: Momentum-Based Trading](/specs/45_momentum-based-trading/) - Original implementation spec
- [Spec 46: G01 Momentum Parameters Completion](/specs/46_g01-momentum-parameters-completion/) - Batch mode completion spec

---

## Changelog

**Spec 45 (Momentum-Based Trading):**
- Added `momentumBasedBuy` and `momentumBasedSell` parameters
- Implemented for single and portfolio backtest modes
- Added P/L gating logic in executor
- Added statistics tracking

**Spec 46 (G01 Momentum Parameters Completion):**
- Added batch backtest mode support
- Completed multi-mode compliance with G01 guidelines
- Created comprehensive API documentation
- Created user guide and examples
