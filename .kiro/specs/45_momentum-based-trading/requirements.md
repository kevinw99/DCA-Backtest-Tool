# Requirements: Momentum-Based Trading Mode

## Problem Statement

The current DCA backtest system is primarily designed for **mean-reversion** strategies:
- **Buy on dips**: Wait for price to drop from peak, then buy when it rebounds
- **Sell on spikes**: Wait for price to rise from bottom, then sell when it pulls back
- **Anti-momentum**: Trading against the current trend

This works well for choppy/sideways markets but underperforms in strong trending markets where:
- Strong uptrends: Buying on dips may miss most of the move
- Fast recoveries: Waiting for rebound may miss quick V-shaped bounces
- Momentum plays: Cannot capitalize on "buy high, sell higher" opportunities

### User Requirements

Users want a **momentum-based trading mode** that:

1. **Buys on strength** (not weakness):
   - Trigger buys when price shows upward momentum
   - Buy only when already in profit (confidence signal)
   - Remove position size limits (scale into winning positions)

2. **Sells on weakness** (not strength):
   - Trigger sells when price shows downward momentum
   - Respond faster to trend reversals
   - Maintain profit protection

### Current Limitations

**For Buying:**
- Requires price to drop `trailingBuyActivationPercent` (default 10%) before considering buy
- Then waits for `trailingBuyReboundPercent` (5%) rebound
- `maxLots` limits accumulation in strong trends
- No profit-based gating (buys regardless of P/L status)

**For Selling:**
- Requires price to rise `trailingSellActivationPercent` (default 20%) before considering sell
- Then waits for `trailingSellPullbackPercent` (10%) pullback
- Slow to react to trend reversals

## Proposed Solution

Add two new independent parameters:

### 1. `momentumBasedBuy` (boolean, default: false)

When enabled:
- **Override `trailingBuyActivationPercent` → 0%**
  - Buy consideration starts immediately when price moves up from last buy
- **Only trigger condition: `trailingBuyReboundPercent`**
  - Buy when price rebounds by specified % from local bottom
- **NEW: Profit requirement**
  - Position P/L must be > $0 to allow buy
- **Override `maxLots` → unlimited**
  - Scale positions without artificial caps (only limited by capital)
- **Maintain grid spacing**
  - `gridIntervalPercent` and related grid parameters still apply

### 2. `momentumBasedSell` (boolean, default: false)

When enabled:
- **Override `trailingSellActivationPercent` → 0%**
  - Sell consideration starts immediately when price moves down from peak
- **Only trigger condition: `trailingSellPullbackPercent`**
  - Sell when price pulls back by specified % from local peak
- **Maintain profit requirement**
  - `profitRequirement` still applies (don't sell at loss)

## Requirements

### Functional Requirements

#### FR-1: Momentum-Based Buy Mode
**Description:** Add `momentumBasedBuy` parameter to enable momentum-based buying

**User Story:** As a trader, I want to accumulate positions during uptrends when I'm already profitable, so I can capitalize on strong momentum moves.

**Acceptance Criteria:**
- ✓ New boolean parameter `momentumBasedBuy` defaults to `false`
- ✓ When `false`: Existing buy behavior unchanged (backward compatible)
- ✓ When `true`:
  - ✓ `trailingBuyActivationPercent` effectively becomes 0% (immediate consideration)
  - ✓ Buy triggers based solely on `trailingBuyReboundPercent` from local bottom
  - ✓ Buy executes ONLY if position P/L > 0
  - ✓ `maxLots` constraint removed (unlimited accumulation)
  - ✓ Grid spacing constraints still enforced
  - ✓ Capital constraints still enforced (can't buy if no capital)

#### FR-2: Position P/L Calculation for Buy Gating
**Description:** Calculate total position P/L to gate buy execution

**Acceptance Criteria:**
- ✓ Calculate unrealized P/L: `sum((currentPrice - lot.price) × lot.shares)`
- ✓ Buy allowed if P/L > $0
- ✓ Buy blocked if P/L <= $0
- ✓ Recalculate P/L every day before buy checks
- ✓ Log P/L status in transaction logs

#### FR-3: Unlimited Lots in Momentum Buy Mode
**Description:** Remove `maxLots` constraint when `momentumBasedBuy = true`

**Acceptance Criteria:**
- ✓ Skip `lots.length >= maxLots` check when in momentum mode
- ✓ Only limit: available capital (`totalCapital - deployedCapital`)
- ✓ Still respect portfolio-level capital constraints
- ✓ Track maximum lots reached as statistic

#### FR-4: Momentum-Based Sell Mode
**Description:** Add `momentumBasedSell` parameter to enable momentum-based selling

**User Story:** As a trader, I want to exit positions quickly when momentum reverses, so I can protect profits in trend reversals.

**Acceptance Criteria:**
- ✓ New boolean parameter `momentumBasedSell` defaults to `false`
- ✓ When `false`: Existing sell behavior unchanged (backward compatible)
- ✓ When `true`:
  - ✓ `trailingSellActivationPercent` effectively becomes 0% (immediate consideration)
  - ✓ Sell triggers based solely on `trailingSellPullbackPercent` from local peak
  - ✓ `profitRequirement` still enforced (don't sell at loss)
  - ✓ `maxLotsToSell` still applies (batch selling rules unchanged)

#### FR-5: Independent Mode Control
**Description:** Buy and sell momentum modes operate independently

**Acceptance Criteria:**
- ✓ Can enable `momentumBasedBuy` without `momentumBasedSell`
- ✓ Can enable `momentumBasedSell` without `momentumBasedBuy`
- ✓ Can enable both simultaneously
- ✓ Can disable both (default traditional behavior)

#### FR-6: Transaction Logging Enhancement
**Description:** Log momentum mode status in transaction logs

**Acceptance Criteria:**
- ✓ Log when buy blocked due to P/L <= 0
- ✓ Log when buy allowed due to P/L > 0
- ✓ Log current P/L in transaction details
- ✓ Log "MOMENTUM BUY" vs "TRADITIONAL BUY"
- ✓ Log "MOMENTUM SELL" vs "TRADITIONAL SELL"

### Non-Functional Requirements

#### NFR-1: Backward Compatibility
**Description:** Existing backtests must produce identical results

**Acceptance Criteria:**
- ✓ When `momentumBasedBuy = false` and `momentumBasedSell = false`: Results identical
- ✓ All existing parameters work unchanged
- ✓ No breaking API changes
- ✓ Config files work without modification

#### NFR-2: Performance
**Description:** Momentum mode should not degrade performance

**Acceptance Criteria:**
- ✓ P/L calculation is O(n) where n = number of lots
- ✓ No additional loops or nested iterations
- ✓ Execution time within 5% of traditional mode

#### NFR-3: Code Quality
**Description:** Implementation follows existing patterns

**Acceptance Criteria:**
- ✓ Consistent with existing DCA executor code style
- ✓ Well-documented functions and logic
- ✓ Clear variable names
- ✓ Comprehensive code comments

## Affected Parameters & Conditions

### Momentum-Based Buy - Affected Parameters

#### Direct Overrides (Hard Changes)
| Parameter | Original Behavior | Momentum Mode Behavior |
|-----------|-------------------|------------------------|
| `trailingBuyActivationPercent` | 10% drop required | **0%** (immediate) |
| `maxLots` | Hard limit enforced | **Unlimited** (capital only) |

#### New Conditions (Additions)
| Condition | Check | Behavior |
|-----------|-------|----------|
| **Position P/L > 0** | `sum((currentPrice - lot.price) × shares)` | Buy ONLY if profitable |

#### Maintained Parameters (No Change)
| Parameter | Behavior | Notes |
|-----------|----------|-------|
| `trailingBuyReboundPercent` | Still used for stop price | Primary trigger |
| `gridIntervalPercent` | Still enforced | Grid spacing unchanged |
| `enableConsecutiveIncrementalBuyGrid` | Still applies | Widens grid in downtrends |
| `enableDynamicGrid` | Still applies | Dynamic grid calculation |
| `stopLossPercent` | Still triggers | Hard stop still active |
| `buyEnabled` (portfolio) | Still enforced | Portfolio can still block |

#### Potentially Conflicting Features

**1. Dynamic Profile (Spec 24) - CONFLICT LIKELY**
- **What it does:** Changes `trailingBuyActivationPercent` to 0% in AGGRESSIVE profile (winning position)
- **Conflict:** Both momentum mode and dynamic profile set activation to 0%
- **Resolution:**
  - If `momentumBasedBuy = true`: Activation ALWAYS 0%, ignore profile changes
  - If `momentumBasedBuy = false`: Profile changes apply normally
- **Recommendation:** Disable `enableDynamicProfile` when using momentum mode, or document that momentum takes precedence

**2. Adaptive Trailing Buy (Spec 25/27) - SIMILAR CONCEPT**
- **What it does:** Changes rebound % based on market regime (uptrend vs downtrend)
- **Conflict:** Both adjust buy behavior dynamically
- **Resolution:**
  - If `momentumBasedBuy = true`: Still use `trailingBuyReboundPercent` (adaptive can still modify it)
  - Adaptive logic for rebound decay can coexist
- **Recommendation:** Can work together (adaptive adjusts rebound, momentum gates by profit)

**3. Position-Based Gating (Spec 26) - OVERLAP**
- **What it does:** Blocks uptrend buys when position is NOT 'winning'
- **Conflict:** Both use position status for buy gating
- **Resolution:**
  - Spec 26 uses threshold (10% of lotSize) with hysteresis (3 days)
  - Momentum uses simpler P/L > 0 with no hysteresis
  - If both enabled: Use stricter check (must satisfy both)
- **Recommendation:** Choose one approach or combine (P/L > 0 AND winning status)

**4. Capital Optimization (Spec 40) - PORTFOLIO LEVEL**
- **What it does:** Adaptive lot sizing, cash yield, deferred selling
- **Conflict:** Momentum removes maxLots, but portfolio still has total capital limit
- **Resolution:**
  - Portfolio capital constraints still apply
  - Can't exceed total portfolio capital
  - Day callback can still block buys via `buyEnabled`
- **Recommendation:** Works together (portfolio manages capital, momentum manages per-stock)

**5. Beta Scaling (Spec 43) - PARAMETER ADJUSTMENT**
- **What it does:** Scales parameters like grid interval by beta coefficient
- **Conflict:** May scale `trailingBuyActivationPercent` which momentum sets to 0
- **Resolution:**
  - If `momentumBasedBuy = true`: Activation already 0, beta scaling has no effect
  - Beta can still scale `trailingBuyReboundPercent`
- **Recommendation:** Works together (beta scales rebound, momentum handles activation)

**6. Stop Loss - IMPORTANT INTERACTION**
- **What it does:** Sells entire position when price drops `stopLossPercent` below average cost
- **Conflict:** If stop loss triggers, position sold → P/L resets → Can buy again?
- **Resolution:**
  - Stop loss still triggers normally
  - After stop loss: position = 0, P/L = realized loss
  - Next buy would be first buy (no P/L requirement for first buy)
- **Recommendation:** Clarify if first buy after stop loss requires P/L > 0 (probably NOT)

### Momentum-Based Sell - Affected Parameters

#### Direct Overrides (Hard Changes)
| Parameter | Original Behavior | Momentum Mode Behavior |
|-----------|-------------------|------------------------|
| `trailingSellActivationPercent` | 20% rise required | **0%** (immediate) |

#### Maintained Parameters (No Change)
| Parameter | Behavior | Notes |
|-----------|----------|-------|
| `trailingSellPullbackPercent` | Still used for stop price | Primary trigger |
| `profitRequirement` | Still enforced | Don't sell at loss |
| `maxLotsToSell` | Still applies | Batch selling unchanged |
| `enableAverageBasedSell` | Still applies | Eligibility calculation method |

#### Potentially Conflicting Features

**1. Dynamic Profile (Spec 24) - CONFLICT LIKELY**
- **What it does:** Changes `trailingSellActivationPercent` based on position status
- **Conflict:** Both momentum mode and dynamic profile modify activation
- **Resolution:**
  - If `momentumBasedSell = true`: Activation ALWAYS 0%, ignore profile changes
  - If `momentumBasedSell = false`: Profile changes apply normally
- **Recommendation:** Disable `enableDynamicProfile` when using momentum mode

**2. Adaptive Trailing Sell (Spec 25) - SIMILAR CONCEPT**
- **What it does:** Changes pullback % based on market regime
- **Conflict:** Both adjust sell behavior dynamically
- **Resolution:**
  - If `momentumBasedSell = true`: Still use `trailingSellPullbackPercent` (adaptive can still modify it)
  - Adaptive logic for pullback decay can coexist
- **Recommendation:** Can work together (adaptive adjusts pullback, momentum sets activation to 0)

**3. Consecutive Incremental Sell Profit (Spec 17) - INTERACTION**
- **What it does:** Increases profit requirement for each consecutive uptrend sell
- **Conflict:** Both affect sell trigger conditions
- **Resolution:**
  - `profitRequirement` still applies in momentum mode
  - Consecutive incremental can still increase profit requirement
  - Works together: Activation at 0%, but profit threshold increases
- **Recommendation:** Can work together (momentum triggers fast, but requires higher profit)

**4. Deferred Selling (Capital Optimization) - INTERACTION**
- **What it does:** Defers sells when portfolio has high cash reserves
- **Conflict:** May block sells that momentum mode wants to execute
- **Resolution:**
  - Portfolio-level constraints take precedence
  - Momentum mode can trigger sell, but portfolio can block via `sellEnabled`
- **Recommendation:** Works together (portfolio controls overall strategy)

## Use Cases

### Use Case 1: Pure Momentum Trading
**Configuration:**
```json
{
  "momentumBasedBuy": true,
  "momentumBasedSell": true,
  "trailingBuyReboundPercent": 0.03,      // 3% rebound triggers buy
  "trailingSellPullbackPercent": 0.05,     // 5% pullback triggers sell
  "profitRequirement": 0.05,               // 5% profit minimum
  "gridIntervalPercent": 0.10,             // 10% grid spacing
  "enableDynamicProfile": false            // Disable to avoid conflict
}
```

**Behavior:**
- Buy: As soon as price rebounds 3% from any local bottom (if P/L > 0)
- Sell: As soon as price pulls back 5% from any local peak (if profitable)
- Trend following: Accumulates in uptrends, exits quickly on reversals

### Use Case 2: Momentum Accumulation, Traditional Exit
**Configuration:**
```json
{
  "momentumBasedBuy": true,
  "momentumBasedSell": false,
  "trailingBuyReboundPercent": 0.02,      // 2% rebound triggers buy
  "trailingSellActivationPercent": 0.20,   // 20% rise to consider sell
  "trailingSellPullbackPercent": 0.10      // 10% pullback triggers sell
}
```

**Behavior:**
- Buy: Aggressive momentum accumulation (if P/L > 0)
- Sell: Conservative exit (wait for 20% rise, then sell on 10% pullback)
- Strategy: Capture trends aggressively, exit carefully

### Use Case 3: Traditional Accumulation, Momentum Exit
**Configuration:**
```json
{
  "momentumBasedBuy": false,
  "momentumBasedSell": true,
  "trailingBuyActivationPercent": 0.10,    // 10% drop to consider buy
  "trailingBuyReboundPercent": 0.05,       // 5% rebound triggers buy
  "trailingSellPullbackPercent": 0.03      // 3% pullback triggers sell
}
```

**Behavior:**
- Buy: Traditional mean reversion (buy dips)
- Sell: Fast momentum exit (sell on first sign of weakness)
- Strategy: Buy low, sell at first reversal signal

### Use Case 4: Strong Trend Following
**Configuration:**
```json
{
  "momentumBasedBuy": true,
  "momentumBasedSell": true,
  "trailingBuyReboundPercent": 0.01,       // 1% rebound (very sensitive)
  "trailingSellPullbackPercent": 0.02,     // 2% pullback (very sensitive)
  "profitRequirement": 0.02,               // 2% profit minimum
  "gridIntervalPercent": 0.05,             // 5% grid (tight)
  "maxLots": 999                           // Effectively unlimited
}
```

**Behavior:**
- Buy: Hyper-aggressive accumulation on any small rebound (if profitable)
- Sell: Hyper-sensitive exit on any small pullback
- Strategy: Ride strong trends, exit immediately on weakness

## Success Criteria

1. **Momentum buy mode works:**
   - ✓ Buys trigger without waiting for activation % drop
   - ✓ Buys only execute when P/L > 0
   - ✓ Can accumulate unlimited lots (capital permitting)
   - ✓ Grid spacing still enforced

2. **Momentum sell mode works:**
   - ✓ Sells trigger without waiting for activation % rise
   - ✓ Sells still require profit
   - ✓ Responds faster to trend reversals

3. **Backward compatibility:**
   - ✓ When both flags = false: Results identical to current implementation
   - ✓ No breaking changes to API or config format

4. **Transaction logs:**
   - ✓ Clear logging of momentum mode status
   - ✓ P/L tracked in transaction details
   - ✓ Buy blocking reasons logged

5. **Testing:**
   - ✓ Tested with various stock symbols
   - ✓ Tested with different parameter combinations
   - ✓ Verified in trending and choppy markets
   - ✓ Compared performance vs traditional mode

## Out of Scope

- Automatic detection of trending vs mean-reverting markets
- Machine learning for optimal parameter selection
- Multi-timeframe momentum analysis
- Momentum indicators (RSI, MACD, etc.)
- Short selling momentum strategies (future enhancement)
- Options or derivatives trading

## Open Questions

1. **First buy after stop loss:**
   - Should first buy after stop loss require P/L > 0?
   - **Recommendation:** NO - first buy always allowed (position reset)

2. **Interaction with position-based gating (Spec 26):**
   - Use simple P/L > 0 or complex winning/losing threshold?
   - **Recommendation:** Simple P/L > 0 (easier to understand)

3. **Capital management across portfolio:**
   - How to prevent one stock from using all capital in momentum mode?
   - **Recommendation:** Portfolio-level callbacks can still gate buys

4. **Maximum lots tracking:**
   - Should we track "would have hit maxLots"  for comparison?
   - **Recommendation:** YES - add statistic `maxLotsIgnored` for analysis

5. **Sell everything on momentum reversal:**
   - Should momentum sell mode sell ALL lots at once vs batch?
   - **Recommendation:** Keep `maxLotsToSell` (gradual exit safer)

## Assumptions

1. Users understand momentum trading is higher risk
2. Users will test both modes before live trading
3. P/L > 0 is sufficient for profitability check (no threshold)
4. Grid spacing is still important even in momentum mode
5. Unlimited lots means "limited only by capital" not truly infinite
6. Portfolio-level constraints still apply in momentum mode

## Dependencies

- Existing DCA backtest executor (`dcaExecutor.js`)
- Position P/L calculation logic
- Transaction logging system
- Parameter validation and processing
- Frontend parameter inputs

## Risk Mitigation

### Risk 1: Over-accumulation in False Breakouts
**Mitigation:**
- Grid spacing still enforced (can't buy too close)
- P/L > 0 requirement prevents doubling down in losses
- Portfolio capital limits still apply

### Risk 2: Rapid Exits Locking in Small Gains
**Mitigation:**
- `profitRequirement` still enforced
- User can tune `trailingSellPullbackPercent` for more patience
- Can combine with traditional mode (momentum buy, traditional sell)

### Risk 3: Conflicting Features
**Mitigation:**
- Clear documentation of conflicts
- Recommendation to disable conflicting features
- Precedence rules documented

### Risk 4: Performance Degradation
**Mitigation:**
- P/L calculation is O(n) - same as existing profit checks
- No additional nested loops
- Reuse existing position tracking logic
