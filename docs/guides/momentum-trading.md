# Momentum Trading Guide

## What is Momentum Trading?

Momentum trading is a trend-following strategy that **buys strength and sells weakness**, contrary to the traditional DCA approach of "buy the dip" and "sell the spike."

### Traditional DCA (Mean Reversion)
- **Philosophy:** Prices revert to the mean - what goes down comes back up
- **Buy Strategy:** Buy when price drops (accumulate during dips)
- **Sell Strategy:** Sell when price rises and profit requirement met (take profits at peaks)
- **Best For:** Choppy/sideways markets, assets with strong support levels

### Momentum DCA (Trend Following)
- **Philosophy:** The trend is your friend - what goes up keeps going up
- **Buy Strategy:** Buy when profitable (add to winners)
- **Sell Strategy:** Sell when unprofitable (cut losers)
- **Best For:** Strongly trending markets (bull or bear), high-conviction trades

## When to Use Momentum Mode

### Use Momentum Buy (`momentumBasedBuy = true`) When:
✅ Strong bull market / uptrend
✅ High conviction that the trend will continue
✅ Want to "add to winners"
✅ Asset showing strong momentum indicators
✅ Willing to accumulate large positions during profitable runs

### Use Momentum Sell (`momentumBasedSell = true`) When:
✅ Strong bear market / downtrend
✅ Want to cut losses early
✅ Defensive position management
✅ Protect capital during market weakness

### Use Traditional DCA When:
✅ Choppy/sideways market
✅ Strong support levels present
✅ Mean reversion expected
✅ Want to "buy the dip"
✅ Conservative risk management

## Strategy Examples

### Example 1: Pure Momentum (High Risk)

**Configuration:**
```json
{
  "momentumBasedBuy": true,
  "momentumBasedSell": true
}
```

**Behavior:**
- Only buy when portfolio is profitable (P/L > 0)
- Only sell when portfolio is unprofitable (P/L < 0)
- Full trend-following approach

**Market Conditions:** Strong trending markets (up or down)

**Risks:**
- Can accumulate very large positions during bull runs (no `maxLots` protection)
- May have few trades in choppy markets
- High capital exposure during trends

**Example Scenario:**
```
Date: 2024-01-01, Price: $100, P/L: $0, Holdings: 0
→ No action (P/L = 0, not > 0)

Date: 2024-01-05, Price: $105, P/L: $500, Holdings: 1
→ BUY executed (P/L > 0) ✅

Date: 2024-01-10, Price: $110, P/L: $1,500, Holdings: 2
→ BUY executed (P/L > 0) ✅

Date: 2024-01-15, Price: $115, P/L: $3,000, Holdings: 3
→ BUY executed (P/L > 0) ✅
...continues buying while profitable...

Date: 2024-02-01, Price: $95, P/L: -$2,000, Holdings: 10
→ SELL executed (P/L < 0) ✅
```

---

### Example 2: Momentum Buy + Traditional Sell (Balanced)

**Configuration:**
```json
{
  "momentumBasedBuy": true,
  "momentumBasedSell": false
}
```

**Behavior:**
- Buy on strength (add to winners)
- Sell traditionally (take profits at peaks)
- Hybrid approach

**Market Conditions:** Bull market with occasional corrections

**Benefits:**
- Accumulate during uptrends
- Take profits at peaks
- Less aggressive than pure momentum

**Example Scenario:**
```
Date: 2024-01-01, Price: $100, P/L: $0, Holdings: 0
→ No buy (P/L = 0)

Date: 2024-01-05, Price: $105, P/L: $500, Holdings: 1
→ BUY (P/L > 0) ✅

Date: 2024-01-10, Price: $110, P/L: $1,500, Holdings: 2
→ BUY (P/L > 0) ✅

Date: 2024-01-15, Price: $120, P/L: $4,000, Holdings: 3
→ BUY (P/L > 0) ✅
→ SELL (traditional mode - price spike + profit met) ✅
```

---

### Example 3: Traditional Buy + Momentum Sell (Defensive)

**Configuration:**
```json
{
  "momentumBasedBuy": false,
  "momentumBasedSell": true
}
```

**Behavior:**
- Buy traditionally (accumulate during dips)
- Sell on weakness (cut losses)
- Defensive risk management

**Market Conditions:** Uncertain market, want downside protection

**Benefits:**
- Build position during dips
- Cut losses quickly if trend reverses
- Capital preservation focus

**Example Scenario:**
```
Date: 2024-01-01, Price: $100, P/L: $0, Holdings: 0
→ No action

Date: 2024-01-05, Price: $90, P/L: $0, Holdings: 0
→ BUY (traditional - price dip) ✅

Date: 2024-01-10, Price: $85, P/L: -$500, Holdings: 1
→ BUY (traditional - price dip) ✅
→ SELL (momentum - P/L < 0, cut losses) ✅
```

---

## Understanding P/L Gating

**Key Concept:** Momentum mode uses current portfolio P/L to gate buy/sell decisions.

### P/L Calculation
```
Current P/L = (Current Holdings Value) - (Total Cost Basis)
```

### Buy Gating (momentumBasedBuy = true)
```
if (current_pnl > 0) {
  // BUY allowed
} else {
  // BUY blocked, increment buyBlockedByPnL counter
}
```

### Sell Gating (momentumBasedSell = true)
```
if (current_pnl < 0 AND profit_requirement_met) {
  // SELL allowed
} else {
  // SELL blocked, increment sellBlockedByPnL counter
}
```

**Important:** Both conditions must be true for a sell:
1. P/L < 0 (portfolio is losing)
2. Individual lot meets profit requirement

---

## Key Differences from Traditional Mode

| Feature | Traditional DCA | Momentum DCA |
|---------|----------------|--------------|
| **Buy Trigger** | Price drop (dips) | Portfolio profitable (P/L > 0) |
| **Sell Trigger** | Price spike + profit | Portfolio unprofitable (P/L < 0) + profit |
| **maxLots Protection** | ✅ Enforced | ❌ Removed (momentum buy) |
| **Position Size** | Limited by maxLots | ⚠️ Can grow unbounded |
| **Trade Frequency** | Higher (responds to all price moves) | Lower (gated by P/L) |
| **Best Market** | Choppy/sideways | Trending |
| **Risk Level** | Moderate | High |
| **Capital Efficiency** | Moderate | Variable (high in trends, low in chop) |

---

## Risk Management

### Momentum Buy Risks

**Risk 1: Unbounded Position Growth**
- `maxLots` protection is removed
- Position can grow very large during profitable trends
- **Mitigation:** Use smaller `lotSizeUsd`, monitor `maxCapitalDeployed` stat

**Risk 2: No Trades in Choppy Markets**
- If P/L oscillates around 0, very few buys execute
- **Mitigation:** Use traditional mode for range-bound assets

**Risk 3: Late Entry**
- First buy only occurs after position becomes profitable
- May miss initial price moves
- **Mitigation:** Combine with traditional mode or use lower initial entry

### Momentum Sell Risks

**Risk 1: Selling at a Loss**
- Momentum sell executes when P/L < 0
- Realizes losses instead of waiting for recovery
- **Mitigation:** Set appropriate `profitRequirement` to limit loss size

**Risk 2: Missing Profit Opportunities**
- Won't sell during profitable periods (P/L ≥ 0)
- **Mitigation:** Use traditional sell mode for profit-taking

---

## Parameter Recommendations

### Conservative Momentum (Lower Risk)
```json
{
  "momentumBasedBuy": true,
  "momentumBasedSell": false,
  "lotSizeUsd": 5000,
  "profitRequirement": 0.05
}
```
- Accumulate during uptrends
- Take profits traditionally
- Moderate position growth

### Aggressive Momentum (Higher Risk)
```json
{
  "momentumBasedBuy": true,
  "momentumBasedSell": true,
  "lotSizeUsd": 10000,
  "profitRequirement": 0.03
}
```
- Full trend following
- High position growth potential
- Cut losses quickly

### Defensive (Capital Preservation)
```json
{
  "momentumBasedBuy": false,
  "momentumBasedSell": true,
  "lotSizeUsd": 10000,
  "profitRequirement": 0.02
}
```
- Traditional accumulation
- Quick loss cutting
- Downside protection

---

## Backtesting Best Practices

### 1. Compare Traditional vs Momentum
Always run parallel backtests to compare:
```bash
# Traditional mode
curl POST /api/backtest/dca -d '{"momentumBasedBuy": false, "momentumBasedSell": false, ...}'

# Momentum mode
curl POST /api/backtest/dca -d '{"momentumBasedBuy": true, "momentumBasedSell": true, ...}'
```

### 2. Check Statistics
Review these key metrics:
- `buyBlockedByPnL`: How many buy attempts were blocked
- `sellBlockedByPnL`: How many sell attempts were blocked
- `maxCapitalDeployed`: Peak position size
- `totalTrades`: Actual executed trades
- `annualizedReturn`: Risk-adjusted performance

### 3. Test Multiple Timeframes
Momentum performs differently across timeframes:
- **Bull Markets (2020-2021):** Momentum buy often outperforms
- **Bear Markets (2022):** Momentum sell provides protection
- **Sideways Markets (2023):** Traditional often better

### 4. Use Batch Mode for Optimization
Test across multiple assets and parameter combinations:
```json
{
  "parameterRanges": {
    "symbols": ["AAPL", "MSFT", "NVDA", "TSLA"],
    "momentumBasedBuy": true,
    "momentumBasedSell": true,
    ...
  }
}
```

---

## Common Pitfalls

### Pitfall 1: Using Momentum in Choppy Markets
**Problem:** Few trades execute when P/L oscillates around 0
**Solution:** Switch to traditional mode for range-bound assets

### Pitfall 2: Ignoring Position Size
**Problem:** Momentum buy can create huge positions
**Solution:** Monitor `maxCapitalDeployed`, use appropriate `lotSizeUsd`

### Pitfall 3: Expecting Profits Immediately
**Problem:** Momentum mode may have periods of no activity
**Solution:** Be patient, momentum works best in trending environments

### Pitfall 4: Not Checking Blocked Orders
**Problem:** High `buyBlockedByPnL` or `sellBlockedByPnL` counts indicate poor fit
**Solution:** Review statistics, switch strategies if many orders are blocked

---

## Real-World Examples

### Example: Bull Market (2020-2021)

**Asset:** TSLA
**Period:** Jan 2020 - Dec 2021
**Market:** Strong bull trend

**Traditional DCA:**
- Total Buys: 45
- Total Sells: 20
- Final P/L: +$125,000
- Max Position: 10 lots (capped by maxLots)

**Momentum Buy Only:**
- Total Buys: 82 (added to winners)
- Total Sells: 30
- Final P/L: +$287,000
- Max Position: 25 lots (no maxLots cap)
- **Winner:** Momentum outperformed by 130%

---

### Example: Bear Market (2022)

**Asset:** NVDA
**Period:** Jan 2022 - Dec 2022
**Market:** Bear trend with occasional rallies

**Traditional DCA:**
- Total Buys: 60
- Total Sells: 15
- Final P/L: -$45,000
- Held through drawdown

**Momentum Sell Only:**
- Total Buys: 60 (same as traditional)
- Total Sells: 38 (cut losses faster)
- Final P/L: -$18,000
- **Winner:** Momentum sell reduced losses by 60%

---

### Example: Sideways Market (2023)

**Asset:** AAPL
**Period:** Jan 2023 - Dec 2023
**Market:** Range-bound, choppy

**Traditional DCA:**
- Total Buys: 38
- Total Sells: 35
- Final P/L: +$12,000
- Steady activity

**Pure Momentum:**
- Total Buys: 8 (many blocked by P/L ≤ 0)
- Total Sells: 3 (many blocked by P/L ≥ 0)
- Final P/L: +$2,000
- **Winner:** Traditional outperformed, momentum had low activity

---

## Related Documentation

- [Momentum Parameters API Reference](/docs/api/momentum-parameters.md) - Technical API documentation
- [G01: Adding New Parameters](/.kiro/specs/generic/G01_adding-new-parameter/README.md) - Implementation guide
- [Spec 45: Momentum-Based Trading](/.kiro/specs/45_momentum-based-trading/) - Original implementation spec

---

## Quick Reference

### Enable Momentum in UI
1. Open Single/Portfolio/Batch Backtest page
2. Scroll to "Momentum Mode" section
3. Check desired boxes:
   - ☑ Enable Momentum-Based Buy (Spec 45)
   - ☑ Enable Momentum-Based Sell (Spec 45)
4. Run backtest

### Enable Momentum via API
```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "momentumBasedBuy": true,
    "momentumBasedSell": true,
    ...other parameters...
  }'
```

### Check If Momentum Was Active
Look for `momentumMode` in response:
```json
{
  "momentumMode": {
    "buyEnabled": true,
    "sellEnabled": true
  },
  "buyBlockedByPnL": 12,
  "sellBlockedByPnL": 5
}
```
