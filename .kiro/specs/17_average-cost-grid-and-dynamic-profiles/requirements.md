# Average Cost Grid & Dynamic Profile Switching - Requirements

## Overview
Enhance the DCA algorithm to support:
1. Average-based grid spacing (instead of individual lot spacing)
2. Average-based sell logic (maintaining backward compatibility)
3. Dynamic profile switching based on P/L performance
4. Real-world portfolio management compatibility

## Motivation

### Primary Goals
1. **Real Portfolio Management**: Enable algo to manage real stock portfolios where individual lot prices may not be tracked, only average cost
2. **Simplified Position Tracking**: Reduce complexity by tracking aggregate position instead of individual lots
3. **Dynamic Risk Management**: Automatically adjust aggressiveness based on performance
4. **Backward Compatibility**: Preserve existing behavior as default, allow opt-in to new features

## Requirements

### 1. Average-Based Grid Spacing for Buys

**Current Behavior**:
- Check spacing against EVERY individual lot
- New buy must be >= `gridIntervalPercent` away from ALL existing lots
- Formula: `|currentPrice - lot.price| / lot.price >= gridIntervalPercent`

**Proposed Behavior** (when enabled):
- Check spacing against average cost ONLY
- New buy must be >= `gridIntervalPercent` away from average cost
- Formula: `|currentPrice - averageCost| / averageCost >= gridIntervalPercent`

**Questions to Answer**:
- Should spacing be symmetric (both directions) or asymmetric?
  - Buying above average: Should we still maintain 10% spacing?
  - Buying below average: Definitely maintain 10% spacing
- Should we combine with existing trailing stop logic?
- What about first buy when averageCost = 0?

### 2. Average-Based Sell Logic

**Current Behavior**:
- Sell logic filters lots by profitability: `currentPrice > lot.price * (1 + lotProfitRequirement)`
- Selects highest-priced eligible lots (FIFO at highest price)
- Limit price = `max(highestLotPrice, stopPrice * 0.95)`

**Proposed Behavior** (when enabled):
- Profit check: `currentPrice > averageCost * (1 + profitRequirement)`
- Sell ALL lots or sell maxLotsToSell (TBD)
- Limit price = `max(averageCost * (1 + profitRequirement), stopPrice * 0.95)`

**Critical Questions**:
- Which lots to sell when not all lots?
  - Option A: Still sell highest-priced lots (current behavior)
  - Option B: Sell proportionally across all lots
  - Option C: Sell specific lots based on criteria
- Does this make consecutive sell profit logic simpler or more complex?
- How to track sold lots for transaction history?

### 3. Dynamic Profile Switching

**Profile Definitions**:

**Conservative Profile** (active when P/L < 0):
- **Goal**: Make it harder to buy, easier to sell (preserve capital)
- `trailingBuyActivationPercent = 10%` (require 10% drop before activating buy)
- `profitRequirement = 0%` (sell at any profit)
- All other parameters: use user-specified defaults

**Aggressive Profile** (active when P/L > 0):
- **Goal**: Make it easier to buy, harder to sell (maximize gains)
- `trailingBuyActivationPercent = 0%` (activate buy immediately on any drop)
- `profitRequirement = 10%` (require 10% profit before selling)
- All other parameters: use user-specified defaults

**Switching Logic**:
- Switch point: When total P/L crosses 0
- Total P/L = `unrealizedPNL + realizedPNL`
- Should switch be instantaneous or have hysteresis to prevent oscillation?
- Should switch happen mid-day or only at day boundaries?

**Implementation Questions**:
- Should active trailing stops be affected by profile switch?
- Should we log profile switches in transaction log?
- How to handle batch mode with profile switching?
- Should profile override consecutive incremental features?

### 4. Parameter Control

**New Parameters Needed**:
1. `enableAverageBasedGrid` (boolean)
   - Default: `false`
   - UI: Checkbox in "Advanced Grid Options"
   - Batch: Support array `[true, false]`

2. `enableAverageBasedSell` (boolean)
   - Default: `false`
   - UI: Checkbox in "Advanced Sell Options"
   - Batch: Support array `[true, false]`

3. `enableDynamicProfile` (boolean)
   - Default: `false`
   - UI: Checkbox in "Strategy Options"
   - Batch: Support array `[true, false]`

**Parameter Dependencies**:
- Can `enableAverageBasedSell` be true while `enableAverageBasedGrid` is false? (Yes - independent)
- Should dynamic profile force both average-based features? (No - independent)

## User Stories

### US1: Real Portfolio Management
**As a** real portfolio manager
**I want to** track only average cost, not individual lots
**So that** the algo matches my broker's position tracking

**Acceptance Criteria**:
- Can enable average-based grid without breaking existing backtests
- Average cost updates correctly after each buy/sell
- Grid spacing works with average cost reference

### US2: Simplified Testing
**As a** algo developer
**I want to** test average-based logic vs lot-based logic
**So that** I can compare performance and choose the better approach

**Acceptance Criteria**:
- Can run same backtest with both modes
- Results are comparable
- Performance difference is clear in metrics

### US3: Dynamic Risk Management
**As a** trader
**I want** the algo to automatically become conservative when losing
**So that** I preserve capital in drawdowns and maximize gains in uptrends

**Acceptance Criteria**:
- Profile switches at P/L = 0 crossing
- Conservative profile reduces buying in losses
- Aggressive profile increases profit targets in gains
- Profile switches are logged

## Open Questions

1. **Average-based grid spacing direction**:
   - Should buying ABOVE average cost also require 10% spacing?
   - Or only enforce spacing when buying BELOW average cost?

2. **First buy handling**:
   - When `averageCost = 0` and `lots.length = 0`, what is the reference?
   - Should first buy always be allowed?

3. **Lot selection for average-based sell**:
   - Sell highest-priced lots (current behavior)?
   - Sell lowest-priced lots (FIFO true)?
   - Sell proportionally?

4. **Profile switching timing**:
   - Instantaneous or end-of-day?
   - Should there be hysteresis (e.g., need to stay above 0 for N days)?

5. **Interaction with consecutive incremental features**:
   - Should dynamic profile override consecutive buy grid?
   - Should dynamic profile override consecutive sell profit?
   - Or are they additive?

6. **Transaction history**:
   - How to show average-based trades in transaction log?
   - Should we show virtual "lot prices" for compatibility?

## Success Metrics

1. **Backward Compatibility**: All existing backtests produce identical results when new features are disabled
2. **Performance**: Average-based logic should be within 5% performance of lot-based logic
3. **Simplicity**: Reduced code complexity when using average-based logic
4. **Real-world Usability**: Can successfully track real portfolio with only average cost input
5. **Dynamic Adaptation**: Profile switching reduces max drawdown by 10%+ in volatile markets

## Dependencies

- Current DCA backtest service
- Frontend parameter UI
- Batch test infrastructure
- Transaction logging system

## Constraints

1. Must maintain backward compatibility with all existing features
2. Must work in both single and batch modes
3. Must not break consecutive incremental features
4. Must preserve all transaction history functionality
5. Performance should not degrade significantly
