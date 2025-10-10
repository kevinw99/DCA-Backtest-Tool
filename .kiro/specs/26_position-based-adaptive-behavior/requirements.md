# Spec 26: Position-Based Adaptive Behavior

## Overview

Enhance Spec 25 (Adaptive Trailing Stops) with position-based restrictions that adjust trading aggressiveness based on portfolio P/L status. This creates a strategic framework where the system is more aggressive when winning and more defensive when losing.

## Business Problem

### Current Limitation

Spec 25 adaptive trailing stops work in both uptrends and downtrends unconditionally. However, trading psychology and risk management suggest we should adjust behavior based on portfolio status:

- **When Winning**: Be more aggressive accumulating on strength (FOMO avoidance)
- **When Losing**: Exit quickly on weakness (cut losses fast)
- **When Neutral**: Use standard behavior (balanced approach)

Without position-based restrictions, the strategy may:
- Buy aggressively during uptrends when already heavily exposed (risk overconcentration)
- Hold losing positions through downtrends hoping for recovery (risk cascade losses)

### Desired Behavior

**Position-aware adaptive trading:**

1. **Winning Position** → Allow uptrend buys (Spec 25 adaptive)
2. **Losing Position** → Allow downtrend sells (Spec 25 adaptive)
3. **Neutral Position** → Standard behavior (downtrend buys, uptrend sells)

This creates a "pyramid up, cut down" strategy that aligns with professional risk management.

## Position Status Definitions

### R1: Position Status Flags

**Three mutually exclusive states:**

1. **`winning_position`**: Unrealized P/L > +lotSizeUsd × 10%
   - Example: $100,000 portfolio, $10,000 lot size → P/L > +$1,000
   - Interpretation: Portfolio is profitable enough to justify aggressive accumulation

2. **`losing_position`**: Unrealized P/L < -lotSizeUsd × 10%
   - Example: $100,000 portfolio, $10,000 lot size → P/L < -$1,000
   - Interpretation: Portfolio is losing enough to warrant defensive exits

3. **`neutral_position`**: Everything in between
   - Interpretation: Portfolio P/L is within normal range, use standard behavior

**Calculation:**
```javascript
const unrealizedPNL = lots.reduce((sum, lot) => {
  return sum + (currentPrice - lot.buyPrice) * lot.shares;
}, 0);

const threshold = lotSizeUsd * 0.10;

if (unrealizedPNL > threshold) {
  positionStatus = 'winning';
} else if (unrealizedPNL < -threshold) {
  positionStatus = 'losing';
} else {
  positionStatus = 'neutral';
}
```

## Requirements

### R2: Winning Position Buy Restrictions

**When `positionStatus === 'winning'`:**

- **Allow**: Uptrend buys (Spec 25 adaptive trailing stops)
  - Condition: `currentPrice > lastBuyPrice` AND all other Spec 25 conditions met
  - Behavior: Tighter trailing stops, faster accumulation on momentum

- **Block**: Downtrend buys in consecutive mode
  - Condition: `currentPrice <= lastBuyPrice` AND `consecutiveBuyCount > 0`
  - Rationale: Avoid averaging down when already profitable

- **Allow**: First buy (count = 0) regardless of direction
  - Rationale: Always allow entry when starting fresh

**When `positionStatus !== 'winning'` (neutral or losing):**

- **Standard behavior**: Only downtrend buys allowed
  - Spec 17/25 normal DCA logic applies
  - No uptrend buys (back to original restriction)

### R3: Losing Position Sell Restrictions

**When `positionStatus === 'losing'`:**

- **Allow**: Downtrend sells (Spec 25 adaptive trailing stops)
  - Condition: `currentPrice < lastSellPrice` AND all other Spec 25 conditions met
  - Behavior: Skip activation, skip profit requirement, tighter pullbacks

- **Block**: Uptrend sells in consecutive mode
  - Condition: `currentPrice >= lastSellPrice` AND `consecutiveSellCount > 0`
  - Rationale: Don't exit prematurely when price is recovering

- **Allow**: First sell (count = 0) regardless of direction
  - Rationale: Always allow exit when profitable enough

**When `positionStatus !== 'losing'` (neutral or winning):**

- **Standard behavior**: Only uptrend sells allowed
  - Spec 18/25 normal profit-taking logic applies
  - No downtrend sells (back to original restriction)

### R4: State Tracking

Track position status throughout backtest:

- **Update frequency**: After every price update and trade execution
- **State variable**: `positionStatus` ('winning' | 'losing' | 'neutral')
- **Historical tracking**: Include in enhanced transactions for analysis

### R5: Integration with Existing Specs

**Spec 17 (Incremental Buy Grid):**
- Grid spacing calculation unchanged
- Execution blocking now considers position status

**Spec 25 (Adaptive Trailing Stops):**
- Adaptive parameters calculation unchanged
- Direction-based buy/sell activation now considers position status
- Acts as an additional gate on top of Spec 25 logic

**Spec 23 (Average-Based Sell):**
- Average cost calculation unchanged
- Sell profitability checks unchanged

### R6: Logging and Transparency

**Position Status Logging:**
- Log position status on every calculation: `📊 Position Status: WINNING (P/L: +$X,XXX > threshold +$XXX)`
- Log when status changes: `🔄 Position status changed: NEUTRAL → WINNING`
- Log position-based buy/sell blocks: `🚫 BLOCKED: Uptrend buy prevented (position: NEUTRAL, P/L: +$XXX)`

**Enhanced Transaction Logging:**
- Include `positionStatus` field in every transaction
- Include `unrealizedPNL` at time of transaction
- Include `positionThreshold` used for comparison

## Success Criteria

### SC1: Functionality
- ✅ Position status calculated correctly based on unrealized P/L
- ✅ Uptrend buys only allowed in winning position
- ✅ Downtrend sells only allowed in losing position
- ✅ Standard behavior maintained in neutral position
- ✅ First buy/sell (count=0) always allowed

### SC2: Integration
- ✅ Works seamlessly with Spec 17 (grid spacing)
- ✅ Works seamlessly with Spec 25 (adaptive parameters)
- ✅ Works seamlessly with Spec 23 (average-based sell)
- ✅ No breaking changes to existing features

### SC3: Risk Management
- ✅ Prevents over-accumulation during winning streaks
- ✅ Enables faster exits during losing periods
- ✅ Maintains balanced approach in neutral conditions

### SC4: Testing
- ✅ Backtest shows position-based buy blocking
- ✅ Backtest shows position-based sell blocking
- ✅ Logging clearly shows position status and decisions

## Implementation Details

### Backend Changes

**1. State Tracking (dcaBacktestService.js):**
```javascript
let positionStatus = 'neutral'; // 'winning' | 'losing' | 'neutral'
let unrealizedPNL = 0;
const positionThreshold = lotSizeUsd * 0.10;
```

**2. Position Calculation Function:**
```javascript
function calculatePositionStatus(lots, currentPrice, lotSizeUsd) {
  const unrealizedPNL = lots.reduce((sum, lot) => {
    return sum + (currentPrice - lot.buyPrice) * lot.shares;
  }, 0);

  const threshold = lotSizeUsd * 0.10;

  if (unrealizedPNL > threshold) {
    return { status: 'winning', pnl: unrealizedPNL, threshold };
  } else if (unrealizedPNL < -threshold) {
    return { status: 'losing', pnl: unrealizedPNL, threshold };
  } else {
    return { status: 'neutral', pnl: unrealizedPNL, threshold };
  }
}
```

**3. Buy Logic Enhancement:**
- Check position status before allowing uptrend buys
- Log position-based blocks with detailed reasoning

**4. Sell Logic Enhancement:**
- Check position status before allowing downtrend sells
- Log position-based blocks with detailed reasoning

### No Frontend Changes

This is an internal optimization that requires no UI controls. Position status is determined automatically based on portfolio state.

## Example Scenarios

### Example 1: Winning Position - Uptrend Buy Allowed

```
Holdings: 5 lots @ avg $200
Current Price: $250
Unrealized P/L: 5 lots × ($250 - $200) × shares = +$2,500
Threshold: $10,000 × 10% = $1,000
Position Status: WINNING ($2,500 > $1,000)

Last Buy: $240
Current Price: $250 (UP from $240)
Consecutive Buy Count: 2

Decision: ✅ ALLOW uptrend buy (position: WINNING)
Spec 25 adaptive parameters apply (tighter stops)
```

### Example 2: Neutral Position - Uptrend Buy Blocked

```
Holdings: 3 lots @ avg $200
Current Price: $210
Unrealized P/L: 3 lots × ($210 - $200) × shares = +$500
Threshold: $10,000 × 10% = $1,000
Position Status: NEUTRAL (+$500 < +$1,000)

Last Buy: $205
Current Price: $210 (UP from $205)
Consecutive Buy Count: 1

Decision: 🚫 BLOCK uptrend buy (position: NEUTRAL)
Standard behavior: only allow downtrend buys
```

### Example 3: Losing Position - Downtrend Sell Allowed

```
Holdings: 8 lots @ avg $300
Current Price: $280
Unrealized P/L: 8 lots × ($280 - $300) × shares = -$2,000
Threshold: $10,000 × 10% = $1,000
Position Status: LOSING (-$2,000 < -$1,000)

Last Sell: $290
Current Price: $280 (DOWN from $290)
Consecutive Sell Count: 2

Decision: ✅ ALLOW downtrend sell (position: LOSING)
Spec 25 adaptive parameters apply (skip activation, tight pullback)
```

### Example 4: Neutral Position - Downtrend Sell Blocked

```
Holdings: 6 lots @ avg $150
Current Price: $155
Unrealized P/L: 6 lots × ($155 - $150) × shares = +$750
Threshold: $10,000 × 10% = $1,000
Position Status: NEUTRAL (+$750 < +$1,000)

Last Sell: $160
Current Price: $155 (DOWN from $160)
Consecutive Sell Count: 1

Decision: 🚫 BLOCK downtrend sell (position: NEUTRAL)
Standard behavior: only allow uptrend sells
```

## Out of Scope

- No new parameters or UI controls
- No changes to profit requirements or grid spacing
- No changes to trailing stop activation logic (only execution gating)
- No position status-based parameter scaling (fixed 10% threshold)

## Dependencies

- Requires Spec 25 (Adaptive Trailing Stops) implementation
- Requires Spec 17 (Incremental Buy Grid) implementation
- Builds on existing consecutive count and direction tracking

## Technical Constraints

- **Fixed Threshold**: 10% of lot size (not configurable)
- **No Hysteresis**: Threshold is same for entering/exiting states
- **Lot-Based Calculation**: Uses lot size, not total portfolio value
- **Unrealized Only**: Only considers unrealized P/L, not realized gains

## Risk Mitigation

1. **Fixed threshold** prevents parameter over-optimization
2. **Position-based logic** creates natural risk management framework
3. **Logging transparency** ensures behavior is auditable
4. **No parameter changes** means existing strategy logic remains intact
5. **Gradual rollout** allows testing before full adoption

## Performance Expectations

**Winning streak scenarios**:
- More uptrend accumulation (pyramid up)
- Better capture of momentum trends
- Risk: potential overconcentration

**Losing streak scenarios**:
- Faster exits on continued weakness
- Better loss mitigation
- Risk: premature exits before recovery

**Choppy markets**:
- Frequent status changes
- More standard behavior
- Similar to current performance

## Testing Strategy

1. **Unit tests**: Position status calculation with various P/L values
2. **Integration tests**: Buy/sell blocking based on position status
3. **Backtest comparison**: Same stock with/without Spec 26
4. **Edge cases**: Status transitions, first trades, empty holdings
5. **Real-world scenarios**: TSLA backtest showing all three position states
