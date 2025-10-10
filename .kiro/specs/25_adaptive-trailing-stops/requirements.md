# Spec 25: Adaptive Trailing Stops for Consecutive Trades

## IMPORTANT: Changes to Spec 17 and Spec 18 Behavior

This spec **modifies and supersedes** the counting logic from Spec 17 (Consecutive Incremental Buy Grid) and Spec 18 (Consecutive Incremental Sell Profit). The new direction-based counting logic enables the adaptive trailing stop behavior described in this spec.

### Interaction with Spec 17 Grid Spacing

**Spec 25 (Adaptive Trailing Stops)** and **Spec 17 (Incremental Buy Grid)** work independently:

- **Spec 25** controls: When trailing stops activate, how tight the rebound/pullback is
- **Spec 17** controls: Grid spacing calculation (downtrend = incremental, uptrend = base)
- **Together**: In uptrends, Spec 25 creates tighter trailing stops (faster accumulation), while Spec 17 uses base grid spacing (standard spacing requirements)

**Key principle**: Grid spacing determines HOW FAR buys must be spaced. Adaptive parameters determine HOW TIGHT the trailing stop is. Both can operate in uptrends and downtrends.

### Interaction with Spec 26 Position-Based Behavior

**Spec 26 (Position-Based Adaptive Behavior)** adds position-aware restrictions to Spec 25:

- **Spec 25** controls: Adaptive parameters (skip activation, tighter stops) based on price direction
- **Spec 26** controls: WHEN adaptive behavior is allowed based on portfolio P/L status
- **Together**: Creates strategic risk management framework

**Position-Based Gating:**

1. **Uptrend Buys (Spec 25 adaptive)**:
   - **Allowed**: Only when portfolio is in `winning_position` (P/L > +10% of lot size)
   - **Blocked**: When portfolio is `neutral` or `losing`
   - **Rationale**: Pyramid up when winning, avoid FOMO when not

2. **Downtrend Sells (Spec 25 adaptive)**:
   - **Allowed**: Only when portfolio is in `losing_position` (P/L < -10% of lot size)
   - **Blocked**: When portfolio is `neutral` or `winning`
   - **Rationale**: Cut losses fast when losing, avoid panic sells when winning

**Key principle**: Spec 26 acts as a strategic gate on Spec 25's adaptive behavior. Adaptive parameters still work, but execution is restricted based on portfolio risk status.

### Revised Consecutive Count Logic

**For Trailing Stop Buy (`consecutiveBuyCount`)**:
- **Same direction continues**: Keep incrementing count
- **Direction reverses**: Reset count to 1 (first buy in new direction), **save new direction**
- **Sell order executes**: Reset count to 0 (opposite action breaks the chain)

**For Trailing Stop Sell (`consecutiveSellCount`)**:
- **Same direction continues**: Keep incrementing count
- **Direction reverses**: Reset count to 1 (first sell in new direction), **save new direction**
- **Buy order executes**: Reset count to 0 (opposite action breaks the chain)

This replaces the simpler "price went up/down" logic from Specs 17 and 18, allowing the adaptive parameters to work correctly in both uptrend and downtrend scenarios.

## Overview

Enhance the existing consecutive buy/sell features to use **adaptive trailing stop parameters** that automatically adjust based on price direction. This makes the strategy more responsive during strong trends by reducing friction (tighter stops) when moving in favorable directions.

## Business Problem

### Current Limitation

The existing consecutive incremental features use **fixed trailing stop parameters** regardless of price direction:

**Consecutive Sells (when `enableConsecutiveIncrementalSellProfit` is enabled):**
- Uses same `trailingSellActivationPercent` and `trailingSellPullbackPercent` whether price is rising OR falling
- During downtrends (price falling), we should exit faster with less friction
- During uptrends (price rising), current behavior is appropriate

**Consecutive Buys (when `enableConsecutiveIncrementalBuyGrid` is enabled):**
- Uses same `trailingBuyActivationPercent` and `trailingBuyReboundPercent` whether price is rising OR falling
- During uptrends (price rising), we should accumulate faster with less friction
- During downtrends (price falling), current behavior is appropriate

### Desired Behavior

**Adaptive trailing stops that reduce friction during favorable price movements:**

#### Consecutive Sells - Two Cases

**Case 1: Price Falling (Downtrend)** - Exit faster
- **Price Direction:** `currentPrice < previousSellPrice`
- **Activation:** Ignore `trailingSellActivationPercent` (activate immediately)
- **Profit Requirement:** Ignore `profitRequirement` (exit immediately regardless of profit)
- **Pullback:** Reduce progressively each consecutive sell
  - Formula: `pullback = max(previousPullback * 0.5, 0.02)`
  - Minimum: 2%
- **Rationale:** Price falling after sell = get out faster before it drops more

**Case 2: Price Rising (Uptrend)** - Current behavior
- **Price Direction:** `currentPrice >= previousSellPrice`
- **Parameters:** Use current `trailingSellActivationPercent` and `trailingSellPullbackPercent`
- **Rationale:** Price rising after sell = good, take time to maximize profit

#### Consecutive Buys - Two Cases

**Case 1: Price Rising (Uptrend)** - Accumulate faster
- **Price Direction:** `currentPrice > previousBuyPrice`
- **Activation:** Ignore `trailingBuyActivationPercent` (activate immediately)
- **Rebound:** Reduce progressively each consecutive buy
  - Formula: `rebound = max(previousRebound * 0.8, 0.05)`
  - Minimum: 5%
- **Rationale:** Price rising after buy = momentum, buy more aggressively

**Case 2: Price Falling (Downtrend)** - Current behavior
- **Price Direction:** `currentPrice <= previousBuyPrice`
- **Parameters:** Use current `trailingBuyActivationPercent` and `trailingBuyReboundPercent`
- **Rationale:** Price falling after buy = good, current DCA logic applies

## Requirements

### R1: Track Previous Trade Prices
- **R1.1** Store `lastSellPrice` (price of most recent sell execution)
- **R1.2** Store `lastBuyPrice` (price of most recent buy execution) - already exists
- **R1.3** Reset to `null` when consecutive sequence ends

### R1B: Track Price Direction for Consecutive Trades (Revised from Specs 17 & 18)
- **R1B.1** Store `lastBuyDirection` ('up' | 'down' | null) - tracks direction of last buy relative to previous buy
- **R1B.2** Store `lastSellDirection` ('up' | 'down' | null) - tracks direction of last sell relative to previous sell
- **R1B.3** Update direction on each trade execution:
  - **Buy**: `lastBuyDirection = (currentPrice > lastBuyPrice) ? 'up' : 'down'`
  - **Sell**: `lastSellDirection = (currentPrice > lastSellPrice) ? 'up' : 'down'`
- **R1B.4** Update consecutive counts based on direction:
  - **Same direction**: Increment count (e.g., `consecutiveBuyCount++`)
  - **Direction reverses**: Reset count to 1, save new direction
  - **Opposite trade type**: Reset count to 0, clear direction
- **R1B.5** On first trade in sequence (count = 0), set count = 1 and save direction

### R2: Adaptive Sell Trailing Stops
- **R2.1** Detect downtrend: `currentPrice < lastSellPrice`
- **R2.2** When downtrend detected during consecutive sells:
  - Skip activation check (activate trailing stop immediately)
  - Skip profit requirement check (ignore `profitRequirement` parameter)
  - Calculate adaptive pullback: `max(lastPullback * 0.5, 0.02)`
  - Track `lastPullback` for next iteration
- **R2.3** When uptrend (`currentPrice >= lastSellPrice`):
  - Use standard activation and pullback parameters
  - Reset `lastPullback` to base value

### R3: Adaptive Buy Trailing Stops
- **R3.1** Detect uptrend: `currentPrice > lastBuyPrice`
- **R3.2** When uptrend detected during consecutive buys:
  - Skip activation check (activate trailing stop immediately)
  - Calculate adaptive rebound: `max(lastRebound * 0.8, 0.05)`
  - Track `lastRebound` for next iteration
- **R3.3** When downtrend (`currentPrice <= lastBuyPrice`):
  - Use standard activation and rebound parameters
  - Reset `lastRebound` to base value

### R4: Consecutive Sequence Management
- **R4.1** Adaptive parameters only apply when consecutive feature is enabled
- **R4.2** Reset adaptive state when consecutive count resets to 0
- **R4.3** Initialize `lastPullback` to `trailingSellPullbackPercent` on first sell
- **R4.4** Initialize `lastRebound` to `trailingBuyReboundPercent` on first buy

### R5: Logging and Transparency
- **R5.1** Log when adaptive trailing stops activate
- **R5.2** Log calculated adaptive parameters (pullback/rebound %)
- **R5.3** Log price direction determination
- **R5.4** Include in transaction log for debugging

## Success Criteria

### SC1: Functionality
- ✅ Consecutive sells exit faster during price declines
- ✅ Consecutive buys accumulate faster during price rises
- ✅ Standard behavior maintained when price moves unfavorably
- ✅ Minimum thresholds prevent excessive tightening

### SC2: Integration
- ✅ Works with existing `enableConsecutiveIncrementalSellProfit` feature
- ✅ Works with existing `enableConsecutiveIncrementalBuyGrid` feature
- ✅ Compatible with all other DCA features (dynamic grid, average-based, etc.)
- ✅ No breaking changes to existing behavior when features disabled

### SC3: Testing
- ✅ Backtest shows faster exits during consecutive sell downtrends
- ✅ Backtest shows faster accumulation during consecutive buy uptrends
- ✅ Verify minimum thresholds enforced (2% sell, 5% buy)
- ✅ Confirm adaptive state resets correctly

## Out of Scope

- No new UI parameters (uses existing consecutive feature flags)
- No changes to non-consecutive trades
- No changes to profit requirements for sells (except skipping activation)
- No changes to grid spacing for buys (except skipping activation)

## Dependencies

- Requires `enableConsecutiveIncrementalSellProfit` for adaptive sell behavior
- Requires `enableConsecutiveIncrementalBuyGrid` for adaptive buy behavior
- Builds on existing consecutive count and last trade price tracking

## Technical Constraints

- **Minimum Pullback:** 2% (0.02) - prevents too-tight stops on sells
- **Minimum Rebound:** 5% (0.05) - prevents too-tight stops on buys
- **Decay Factors:**
  - Sell pullback decay: 0.5 (50% reduction per iteration)
  - Buy rebound decay: 0.8 (20% reduction per iteration)

## Example Scenarios

### Example 1: Consecutive Sells During Downtrend

```
Initial: trailingSellPullbackPercent = 5% (0.05), profitRequirement = 10%

Trade 1: Sell at $100
  - Standard behavior (first sell)
  - Pullback: 5%, profit requirement: 10%

Trade 2: Current price = $98 (< $100, downtrend)
  - Adaptive: Skip activation, skip profit requirement, pullback = max(5% * 0.5, 2%) = 2.5%
  - Tighter stop, exits faster regardless of profit

Trade 3: Current price = $96 (< $98, still downtrend)
  - Adaptive: Skip activation, skip profit requirement, pullback = max(2.5% * 0.5, 2%) = 2%
  - Minimum reached, stays at 2%, still ignoring profit requirement

Trade 4: Current price = $97 (> $96, uptrend now)
  - Standard: Reset to base 5% pullback, respect profit requirement
```

### Example 2: Consecutive Buys During Uptrend

```
Initial: trailingBuyReboundPercent = 5% (0.05)

Trade 1: Buy at $50
  - Standard behavior (first buy)
  - Rebound: 5%

Trade 2: Current price = $52 (> $50, uptrend)
  - Adaptive: Skip activation, rebound = max(5% * 0.8, 5%) = 5%
  - First iteration, same as base

Trade 3: Current price = $53 (> $52, still uptrend)
  - Adaptive: Skip activation, rebound = max(5% * 0.8, 5%) = 5%
  - Minimum already reached

Trade 4: Current price = $51 (< $53, downtrend now)
  - Standard: Reset to base 5% rebound
```

## Risk Mitigation

1. **Minimum thresholds** prevent stops from becoming too tight
2. **Direction detection** ensures adaptive behavior only in favorable conditions
3. **Reset mechanism** returns to standard behavior when trend reverses
4. **Logging** provides full transparency for debugging and analysis
