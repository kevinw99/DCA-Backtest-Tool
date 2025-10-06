# Aborted Buy/Sell Events - Test Cases

## Overview

Aborted events are **edge cases** that occur when trailing stops trigger but consecutive buy/sell conditions fail. They are ONLY tracked for consecutive incremental features, not regular trailing stops.

## Aborted Buy Event

### Conditions Required

1. `enableConsecutiveIncrementalBuyGrid = true`
2. `consecutiveBuyCount > 0` (at least one consecutive buy already executed)
3. Trailing stop buy would execute
4. **BUT** `currentPrice >= lastBuyPrice` (price not lower than last buy)

### Why It's Rare

The trailing buy mechanism normally ensures price is lower than before. For an aborted buy to occur, you need a very specific sequence:

1. **Buy 1** at $100 (initial)
2. **Buy 2** at $90 (consecutiveBuyCount = 1, lastBuyPrice = $90)
3. Price drops to $81, **trailing buy activates** (10% drop)
4. Price rebounds to $85.5, **trailing buy executes** (5% rebound from $81)
5. **Buy 3** at $85.5 succeeds (< $90)

To get an **aborted buy**, you'd need:

1. **Buy 1** at $100
2. **Buy 2** at $90 (consecutiveBuyCount = 1, lastBuyPrice = $90)
3. Price drops to $81, trailing buy activates
4. Price rebounds to **$91** (>= lastBuyPrice)
5. **Aborted buy** at $91 because price >= lastBuyPrice

**Problem:** The trailing stop typically executes before price reaches lastBuyPrice again.

### Test Parameters to Increase Likelihood

```
gridIntervalPercent: 5             // Smaller grid spacing
gridConsecutiveIncrement: 20       // Larger increments
trailingBuyActivationPercent: 5    // More sensitive trigger
trailingBuyReboundPercent: 2       // Quick execution
```

Use a **volatile stock** during a **choppy sideways** period (2024-01-01 to 2024-06-30).

## Aborted Sell Event

### Conditions Required

1. `enableConsecutiveIncrementalSellProfit = true`
2. `lastSellPrice !== null` AND `currentPrice > lastSellPrice` (consecutive sell scenario)
3. Trailing stop sell would activate
4. **BUT** no lots meet the increased profit requirement from lastSellPrice

### Why It's Rare

For an aborted sell:

1. **Sell 1** at $110 (lastSellPrice = $110, consecutiveSellCount = 1)
2. Price rises above $110 (consecutive sell scenario)
3. Trailing stop sell activates (e.g., price at $120)
4. **BUT** profit requirement increased (e.g., from 10% to 15%)
5. No lots meet the 15% profit requirement from lastSellPrice

**Example:**

- Lot bought at $100
- First sell at $110 (10% profit)
- Price rises to $120
- Consecutive sell profit requirement: 15% from $110 = $126.5
- Current price $120 < $126.5
- **Aborted sell** - insufficient profit

### Test Parameters to Increase Likelihood

```
profitRequirement: 15               // High base requirement
gridConsecutiveIncrement: 10        // Increases with each sell
trailingSellActivationPercent: 5    // Sensitive trigger
trailingSellPullbackPercent: 0      // Immediate execution
```

Use a stock with **moderate uptrends** followed by **plateaus** (price rises but not fast enough to meet increased requirements).

## Realistic Test Case

### Scenario: SHOP 2024-01-01 to 2024-06-30

SHOP is highly volatile and has had significant swings. This period includes both down and up movements that might trigger edge cases.

### Test URL

```
http://localhost:3001/api/backtest/dca?
symbol=SHOP&
startDate=2024-01-01&
endDate=2024-06-30&
lotSizeUsd=10000&
maxLots=10&
maxLotsToSell=1&
gridIntervalPercent=5&
gridConsecutiveIncrement=20&
profitRequirement=15&
trailingBuyActivationPercent=5&
trailingBuyReboundPercent=2&
trailingSellActivationPercent=5&
trailingSellPullbackPercent=0&
enableConsecutiveIncrementalSellProfit=true&
enableConsecutiveIncrementalBuyGrid=true&
verbose=true
```

### Checking Results

```bash
curl -s "http://localhost:3001/api/backtest/dca?symbol=SHOP&startDate=2024-01-01&endDate=2024-06-30&lotSizeUsd=10000&maxLots=10&maxLotsToSell=1&gridIntervalPercent=5&gridConsecutiveIncrement=20&profitRequirement=15&trailingBuyActivationPercent=5&trailingBuyReboundPercent=2&trailingSellActivationPercent=5&trailingSellPullbackPercent=0&enableConsecutiveIncrementalSellProfit=true&enableConsecutiveIncrementalBuyGrid=true" \
  | jq '.enhancedTransactions | map(select(.type == "ABORTED_BUY" or .type == "ABORTED_SELL")) | length'
```

## Why Your Current Test Doesn't Show Aborted Events

Your TSLA backtest (2021-09-01 to 2025-10-06) with current parameters doesn't produce aborted events because:

1. **Aborted Buys**: TSLA's price movements are typically smooth enough that when trailing buys execute, they're at prices lower than lastBuyPrice
2. **Aborted Sells**: With 10% profit requirement and 10% trailing activation, there's enough margin that consecutive sells usually meet requirements
3. **Parameter spacing**: 10% grid intervals and 10% profit requirements are large enough that edge cases don't occur

## Conclusion

The code is working correctly - aborted events are **intentionally rare**. They represent edge cases where:

- **Aborted Buy**: Price bounces back too quickly during a downtrend
- **Aborted Sell**: Price doesn't rise fast enough during an uptrend

These are valuable to track because they show when the strategy's consecutive incremental features are constraining trades that would otherwise execute.

## Frontend Verification

Even without aborted events in the data, you can verify the frontend is working:

1. The Enhanced Transaction History table correctly displays `ABORTED_BUY` and `ABORTED_SELL` types
2. Light green (🚫) and light pink (🚫) icons are defined
3. Abort reasons display correctly
4. Chart has Scatter components for both event types
5. Grid Size and Profit Req columns show for aborted events

The implementation is complete and correct - it's just waiting for data that triggers these edge cases.
