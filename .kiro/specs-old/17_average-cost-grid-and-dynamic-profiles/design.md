# Average Cost Grid & Dynamic Profile Switching - Design Document

## Executive Summary

This design proposes three orthogonal features that work independently but can be combined:
1. **Average-Based Grid Spacing**: Simplify buy logic by checking spacing against average cost only
2. **Average-Based Sell Logic**: Simplify sell logic by using average cost for profit calculations
3. **Dynamic Profile Switching**: Automatically adjust strategy parameters based on P/L performance

**Key Design Principle**: Each feature is independent and opt-in, maintaining full backward compatibility.

---

## 1. Average-Based Grid Spacing Design

### 1.1 Current Implementation Analysis

**File**: `services/dcaBacktestService.js` lines 697-736

```javascript
const respectsGridSpacing = lots.every((lot, index) => {
  const midPrice = (currentPrice + lot.price) / 2;
  const ref = referencePrice || midPrice;

  let gridSize = enableDynamicGrid
    ? calculateDynamicGridSpacing(midPrice, ref, dynamicGridMultiplier, normalizeToReference)
    : gridIntervalPercent;

  const spacing = Math.abs(currentPrice - lot.price) / lot.price;
  return spacing >= gridSize;
});
```

**Problem**: Must check against ALL lots. With 10 lots, that's 10 checks. Complex with consecutive incremental grid.

### 1.2 Proposed Implementation

**New Logic** (when `enableAverageBasedGrid = true`):

```javascript
// Option A: Simple symmetric spacing
const spacingFromAverage = Math.abs(currentPrice - averageCost) / averageCost;
const respectsGridSpacing = spacingFromAverage >= gridIntervalPercent;

// Option B: Asymmetric spacing (RECOMMENDED)
let respectsGridSpacing;
if (currentPrice < averageCost) {
  // Buying below average - ALWAYS enforce spacing
  const spacingBelowAverage = (averageCost - currentPrice) / averageCost;
  respectsGridSpacing = spacingBelowAverage >= gridIntervalPercent;
} else {
  // Buying above average - MORE LENIENT (half the spacing)
  const spacingAboveAverage = (currentPrice - averageCost) / averageCost;
  respectsGridSpacing = spacingAboveAverage >= (gridIntervalPercent * 0.5);
}
```

**Rationale for Asymmetric** (Option B):
- **Below average**: This averages down - require full spacing to avoid over-concentration
- **Above average**: This is averaging up (unusual) - be more lenient since we're already profitable

### 1.3 Edge Cases

**Case 1: First Buy (`averageCost = 0`, `lots.length = 0`)**
```javascript
if (lots.length === 0) {
  respectsGridSpacing = true; // Always allow first buy
}
```

**Case 2: Dynamic Grid Interaction**
```javascript
if (enableAverageBasedGrid && enableDynamicGrid) {
  // Use dynamic grid calculation but with average cost as reference
  const gridSize = calculateDynamicGridSpacing(currentPrice, averageCost, dynamicGridMultiplier, false);
  respectsGridSpacing = Math.abs(currentPrice - averageCost) / averageCost >= gridSize;
}
```

**Case 3: Consecutive Incremental Buy Grid**
```javascript
if (enableAverageBasedGrid && enableConsecutiveIncrementalBuyGrid) {
  // CONFLICT: Both features try to control grid spacing
  // RESOLUTION: Average-based takes precedence, but use incremental grid size
  const buyGridSize = calculateBuyGridSize(/*...*/);
  respectsGridSpacing = Math.abs(currentPrice - averageCost) / averageCost >= buyGridSize;
}
```

### 1.4 Performance Impact

**Before** (lot-based):
- Time complexity: O(n) where n = number of lots
- With 10 lots: 10 comparisons

**After** (average-based):
- Time complexity: O(1)
- Always 1 comparison

**Performance Gain**: ~10x faster for grid spacing checks

---

## 2. Average-Based Sell Logic Design

### 2.1 Current Implementation Analysis

**File**: `services/dcaBacktestService.js` lines 944-956

```javascript
const eligibleLots = lots.filter(lot => {
  let refPrice = isConsecutiveSell ? lastSellPrice : lot.price;
  return currentPrice > refPrice * (1 + lotProfitRequirement);
});

const sortedEligibleLots = eligibleLots.sort((a, b) => b.price - a.price);
const lotsToSell = sortedEligibleLots.slice(0, Math.min(maxLotsToSell, sortedEligibleLots.length));
```

**Behavior**: Filters lots by individual profitability, sells highest-priced eligible lots.

### 2.2 Proposed Implementation

**When** `enableAverageBasedSell = true`:

```javascript
// Profit check against average cost
const isProfitable = currentPrice > averageCost * (1 + profitRequirement);

if (!isProfitable) {
  // No lots are eligible
  eligibleLots = [];
} else {
  // ALL lots are eligible (since we use average cost)
  eligibleLots = [...lots];

  // Still select highest-priced lots for actual selling
  // This preserves FIFO behavior at highest price
  const sortedEligibleLots = eligibleLots.sort((a, b) => b.price - a.price);
  const lotsToSell = sortedEligibleLots.slice(0, Math.min(maxLotsToSell, sortedEligibleLots.length));
}
```

**Key Point**: We check profitability against average cost, but still select which specific lots to sell based on price (highest first).

### 2.3 Limit Price Calculation

**Current**:
```javascript
const limitPrice = Math.max(highestLotPrice, stopPrice * 0.95);
```

**Proposed** (when `enableAverageBasedSell = true`):
```javascript
const minProfitablePrice = averageCost * (1 + profitRequirement);
const limitPrice = Math.max(minProfitablePrice, stopPrice * 0.95);
```

**Rationale**: Ensure sell price is always above average cost + profit requirement.

### 2.4 Consecutive Sell Profit Interaction

**Current consecutive sell logic**:
```javascript
if (isConsecutiveSell) {
  lotProfitRequirement = profitRequirement + (consecutiveSellCount * (profitRequirement * 0.1));
  refPrice = lastSellPrice; // Check against last sell price
}
```

**With average-based sell**:
```javascript
if (enableAverageBasedSell) {
  // ALWAYS use average cost, ignore consecutive sell reference
  refPrice = averageCost;
  // But still apply incremental profit requirement
  lotProfitRequirement = isConsecutiveSell
    ? profitRequirement + (consecutiveSellCount * (profitRequirement * 0.1))
    : profitRequirement;
}
```

**Impact**: Consecutive sell profit still works, but reference is always average cost, not last sell price.

### 2.5 Real Portfolio Management

**Scenario**: User has 100 shares @ average cost $50
- They don't know individual lot prices
- They want to sell 50 shares when price >= $55 (10% profit)

**With average-based sell**:
```javascript
// User inputs:
lots = [{ price: 50, shares: 100, date: '2024-01-01' }]; // Single "lot" representing entire position
averageCost = 50;
profitRequirement = 0.10;

// When price hits $55:
isProfitable = 55 > 50 * 1.10 = 55 > 55; // ✓ True
lotsToSell = [{ price: 50, shares: 50 }]; // Sell 50 shares
```

**Note**: This requires user to input position as single lot with average cost. We need UI support for this.

---

## 3. Dynamic Profile Switching Design

### 3.1 Profile Definitions

```javascript
const PROFILES = {
  CONSERVATIVE: {
    name: 'Conservative',
    trigger: 'P/L < 0',
    overrides: {
      trailingBuyActivationPercent: 0.10,  // 10% - harder to buy
      profitRequirement: 0.00              // 0% - easier to sell
    }
  },
  AGGRESSIVE: {
    name: 'Aggressive',
    trigger: 'P/L >= 0',
    overrides: {
      trailingBuyActivationPercent: 0.00,  // 0% - easier to buy
      profitRequirement: 0.10              // 10% - harder to sell
    }
  }
};
```

### 3.2 Switching Logic

```javascript
// State variables
let currentProfile = null;  // Start with null, will be determined on first day
let profileSwitchCount = 0;  // Track number of switches

// Daily check (at START of each day, before any trading)
function determineProfile() {
  const totalPNL = unrealizedPNL + realizedPNL;
  const newProfile = totalPNL < 0 ? 'CONSERVATIVE' : 'AGGRESSIVE';

  if (currentProfile !== newProfile) {
    // Profile switch detected
    const oldProfile = currentProfile || 'NONE';
    currentProfile = newProfile;
    profileSwitchCount++;

    // Log the switch
    transactionLog.push(colorize(
      `  🔄 PROFILE SWITCH: ${oldProfile} → ${newProfile} (Total P/L: ${totalPNL.toFixed(2)}, ${totalPNL < 0 ? 'Loss' : 'Profit'})`,
      'magenta'
    ));

    // Apply profile overrides
    applyProfileOverrides(PROFILES[currentProfile]);
  }

  return currentProfile;
}

function applyProfileOverrides(profile) {
  // Store original values if not stored
  if (!originalParams) {
    originalParams = {
      trailingBuyActivationPercent: trailingBuyActivationPercent,
      profitRequirement: profitRequirement
    };
  }

  // Apply overrides
  Object.entries(profile.overrides).forEach(([param, value]) => {
    if (param === 'trailingBuyActivationPercent') {
      trailingBuyActivationPercent = value;
    } else if (param === 'profitRequirement') {
      profitRequirement = value;
    }
  });
}
```

### 3.3 Timing & Hysteresis

**Option A: Instantaneous Switch (PROPOSED)**
- Check P/L at start of each day
- Switch immediately if P/L crosses 0
- Simple, deterministic, testable

**Option B: Hysteresis (Future Enhancement)**
- Require P/L to stay above/below 0 for N consecutive days
- Prevents rapid switching in volatile markets
- More complex, adds state

**Recommendation**: Start with Option A, add hysteresis later if needed.

### 3.4 Impact on Active Orders

**Question**: What happens to active trailing stops when profile switches?

**Answer**: NOTHING - let them complete naturally
- Active `trailingStopBuy` continues with its original parameters
- Active `activeStop` (sell) continues with its original parameters
- Profile only affects NEW order activations

**Rationale**: Changing mid-flight orders would be complex and unpredictable.

### 3.5 Batch Mode Handling

```javascript
// In batch mode, enableDynamicProfile is a single boolean, not an array
// Example batch config:
{
  symbols: ['PLTR', 'TSLA'],
  profitRequirement: [5, 10],        // Test both
  gridIntervalPercent: [10, 15],     // Test both
  enableDynamicProfile: true          // Enable for ALL tests (not an array!)
}
```

**Reasoning**: Dynamic profile is a strategy feature, not a parameter to sweep. Either test with it or without it.

### 3.6 Logging & Metrics

**Transaction Log Additions**:
```
--- 2024-01-15 ---
🔄 PROFILE SWITCH: NONE → AGGRESSIVE (Total P/L: 1250.50, Profit)
  Settings: trailing buy activation 0% → 0%, profit requirement 10% → 10%

--- 2024-02-03 ---
🔄 PROFILE SWITCH: AGGRESSIVE → CONSERVATIVE (Total P/L: -320.15, Loss)
  Settings: trailing buy activation 0% → 10%, profit requirement 10% → 0%
```

**New Metrics** (in results summary):
```javascript
{
  // ... existing metrics
  dynamicProfileMetrics: {
    enabled: true,
    totalSwitches: 5,
    daysInConservative: 45,
    daysInAggressive: 207,
    conservativePercent: 17.86,
    aggressivePercent: 82.14,
    switchDates: ['2024-02-03', '2024-05-12', ...],
  }
}
```

---

## 4. Feature Interactions

### 4.1 Independence Matrix

| Feature A | Feature B | Independent? | Notes |
|-----------|-----------|--------------|-------|
| Average Grid | Average Sell | ✅ Yes | Can enable separately |
| Average Grid | Dynamic Profile | ✅ Yes | Profile changes params, not grid logic |
| Average Sell | Dynamic Profile | ✅ Yes | Profile changes profit req, not sell logic |
| Average Grid | Consecutive Buy Grid | ⚠️ Partial | Both affect grid spacing - average takes precedence |
| Average Sell | Consecutive Sell Profit | ⚠️ Partial | Both affect profit calc - average changes reference |
| Dynamic Profile | Consecutive Buy Grid | ✅ Yes | Independent - both can be active |
| Dynamic Profile | Consecutive Sell Profit | ✅ Yes | Independent - both can be active |

### 4.2 Recommended Combinations

**Combo 1: Real Portfolio Mode**
```javascript
enableAverageBasedGrid: true
enableAverageBasedSell: true
enableDynamicProfile: false  // Manual control
```
**Use Case**: Managing real portfolio with only average cost known

**Combo 2: Adaptive Strategy**
```javascript
enableAverageBasedGrid: false  // Keep lot-based for precision
enableAverageBasedSell: false  // Keep lot-based for precision
enableDynamicProfile: true     // Auto-adjust to market
```
**Use Case**: Backtesting with automatic risk adjustment

**Combo 3: Simplified Backtesting**
```javascript
enableAverageBasedGrid: true   // Faster execution
enableAverageBasedSell: true   // Simpler logic
enableDynamicProfile: false    // Keep parameters constant
```
**Use Case**: Quick parameter sweeps with reduced complexity

### 4.3 Conflicting Scenarios

**Scenario 1**: `enableAverageBasedGrid=true` + `enableConsecutiveIncrementalBuyGrid=true`
- **Conflict**: Both want to control grid spacing
- **Resolution**: Use average cost as reference, but apply incremental grid size
- **Code**:
```javascript
if (enableAverageBasedGrid) {
  const buyGridSize = enableConsecutiveIncrementalBuyGrid
    ? calculateBuyGridSize(/* ... */)
    : gridIntervalPercent;
  respectsGridSpacing = Math.abs(currentPrice - averageCost) / averageCost >= buyGridSize;
}
```

**Scenario 2**: `enableAverageBasedSell=true` + `enableConsecutiveIncrementalSellProfit=true`
- **Conflict**: Consecutive sell uses lastSellPrice as reference, average sell uses averageCost
- **Resolution**: Use averageCost as reference, but still apply incremental profit requirement
- **Code**:
```javascript
const refPrice = enableAverageBasedSell ? averageCost : (isConsecutiveSell ? lastSellPrice : lot.price);
const profitCheck = currentPrice > refPrice * (1 + lotProfitRequirement);
```

**Scenario 3**: `enableDynamicProfile=true` + user sets `profitRequirement=20%`
- **Conflict**: User wants 20% profit, but profile wants to override to 0% or 10%
- **Resolution**: Profile overrides user settings (that's the point!)
- **Behavior**: User's 20% is ignored, profile dictates 0% (conservative) or 10% (aggressive)

---

## 5. Implementation Plan

### 5.1 Phase 1: Average-Based Grid (Week 1)

**Files to Modify**:
- `backend/services/dcaBacktestService.js`
  - Add `enableAverageBasedGrid` parameter
  - Modify grid spacing check (lines 697-736)
  - Add tests for edge cases

**Testing**:
- Unit tests: first buy, buying above/below average, dynamic grid interaction
- Integration tests: compare performance with/without feature
- Regression tests: verify backward compatibility

### 5.2 Phase 2: Average-Based Sell (Week 2)

**Files to Modify**:
- `backend/services/dcaBacktestService.js`
  - Add `enableAverageBasedSell` parameter
  - Modify lot selection logic (lines 944-1012)
  - Modify limit price calculation (line 963)
  - Add tests for consecutive sell interaction

**Testing**:
- Unit tests: profitability check, lot selection, limit price
- Integration tests: full backtest with average-based sell
- Edge case tests: single lot, multiple lots, consecutive sells

### 5.3 Phase 3: Dynamic Profile Switching (Week 3)

**Files to Modify**:
- `backend/services/dcaBacktestService.js`
  - Add `enableDynamicProfile` parameter
  - Add profile determination logic
  - Add profile switching logic
  - Add logging for switches
  - Add metrics calculation

**Testing**:
- Unit tests: profile determination, switching logic, parameter overrides
- Integration tests: full backtest crossing P/L = 0 multiple times
- Performance tests: verify no performance degradation

### 5.4 Phase 4: UI & Documentation (Week 4)

**Files to Modify**:
- Frontend parameter UI components
- API endpoints
- Batch test infrastructure
- Documentation

**Deliverables**:
- UI checkboxes for three new parameters
- Updated API documentation
- User guide with examples
- Migration guide for existing users

---

## 6. Critical Issues & Resolutions

### Issue 1: Average Cost = 0 on First Buy
**Problem**: Can't calculate spacing when averageCost = 0
**Solution**: Always allow first buy (`if (lots.length === 0) return true`)

### Issue 2: Selling Above Average Cost
**Problem**: When buying above average, we're already in profit. Should we enforce spacing?
**Solution**: Use asymmetric spacing - half spacing requirement when buying above average

### Issue 3: Profile Switching Frequency
**Problem**: Rapid switching in volatile markets could thrash parameters
**Solution**:
- Phase 1: Accept rapid switching (simple, testable)
- Phase 2: Add hysteresis if needed (require N consecutive days)

### Issue 4: Consecutive Features Interaction
**Problem**: Average-based logic conflicts with consecutive incremental features
**Solution**: Average-based takes precedence for reference price, but still applies incremental sizing

### Issue 5: Batch Mode with Dynamic Profile
**Problem**: Should dynamic profile be swept like other parameters?
**Solution**: No - it's a strategy flag, not a parameter. Single boolean for all tests.

### Issue 6: Transaction History Compatibility
**Problem**: External tools expect individual lot prices in transaction log
**Solution**: Continue logging actual lot prices, even when using average cost for calculations

### Issue 7: Real Portfolio Initial Input
**Problem**: User doesn't know individual lot prices, only average cost
**Solution**:
- UI: Add "Import Position" feature
- User inputs: shares, average cost, date
- Backend creates single "lot" representing entire position

---

## 7. Performance Analysis

### 7.1 Time Complexity

**Current (Lot-Based)**:
- Grid spacing check: O(n) per buy attempt
- Sell lot selection: O(n log n) sorting + O(n) filtering

**Proposed (Average-Based)**:
- Grid spacing check: O(1) per buy attempt
- Sell lot selection: O(n log n) sorting (same)

**Expected Improvement**: ~10x faster grid checks with 10 lots

### 7.2 Space Complexity

**No change**: Still store individual lots for transaction history

### 7.3 Backtesting Speed

**Test Case**: 252 days, 10 lots, 100 buy attempts
- **Current**: ~100 * 10 = 1000 grid checks
- **Proposed**: ~100 * 1 = 100 grid checks
- **Speedup**: ~10x for grid checking portion (~5-10% of total runtime)

**Overall Expected Speedup**: 5-10% faster backtests when average-based grid enabled

---

## 8. Rollout Strategy

### 8.1 Feature Flags (Default OFF)

```javascript
// All new features default to FALSE
const DEFAULT_PARAMS = {
  // ... existing params
  enableAverageBasedGrid: false,
  enableAverageBasedSell: false,
  enableDynamicProfile: false
};
```

### 8.2 Gradual Adoption

1. **Week 1-2**: Internal testing only
2. **Week 3**: Beta release to select users
3. **Week 4**: Public release with documentation
4. **Week 5+**: Monitor feedback, iterate

### 8.3 Backward Compatibility Verification

**Test Suite**:
```bash
# Run all existing backtests with new code, verify identical results
npm run test:backward-compat

# Expected: 0 differences when all features disabled
```

---

## 9. Open Questions for Product Owner

### Question 1: Average-Based Grid Spacing Direction
**Should buying ABOVE average cost require full spacing or half spacing?**
- Option A: Full spacing (10%) - more conservative
- Option B: Half spacing (5%) - more flexible
- **Recommendation**: Half spacing (allows averaging up when profitable)

### Question 2: Lot Selection for Average-Based Sell
**When using average cost, which lots should we sell?**
- Option A: Highest-priced lots (current behavior)
- Option B: Lowest-priced lots (true FIFO)
- Option C: Proportional across all lots
- **Recommendation**: Highest-priced lots (preserves current behavior)

### Question 3: Dynamic Profile Hysteresis
**Should we require P/L to stay above/below 0 for multiple days before switching?**
- Option A: Immediate switching (simple)
- Option B: N-day hysteresis (prevents thrashing)
- **Recommendation**: Start with immediate, add hysteresis if needed

### Question 4: Profile Parameter Scope
**Should dynamic profile only override buy/sell params, or also grid/trailing params?**
- Current proposal: Only override trailingBuyActivationPercent and profitRequirement
- Alternative: Also override gridIntervalPercent, trailingSellActivationPercent, etc.
- **Recommendation**: Keep narrow scope for Phase 1, expand in Phase 2

### Question 5: Real Portfolio UI
**How should users input existing positions?**
- Option A: Manual entry (shares, average cost, date)
- Option B: Broker import (CSV/API)
- Option C: Both
- **Recommendation**: Start with manual entry, add import later

---

## 10. Success Criteria

### Functional Requirements
- ✅ All three features can be enabled/disabled independently
- ✅ Backward compatibility: existing tests produce identical results
- ✅ Average-based grid: single reference point (average cost)
- ✅ Average-based sell: profitability check against average cost
- ✅ Dynamic profile: automatic switching at P/L = 0 crossing
- ✅ Transaction log: includes profile switches
- ✅ Metrics: includes profile switch counts and duration

### Performance Requirements
- ✅ Backtesting speed: <10% overhead when features disabled
- ✅ Backtesting speed: 5-10% faster when average-based grid enabled
- ✅ Memory usage: no significant increase

### Quality Requirements
- ✅ Test coverage: >90% for new code
- ✅ Documentation: complete user guide with examples
- ✅ Code review: approved by 2+ developers
- ✅ Beta testing: 0 critical bugs after 2 weeks

---

## Appendix: Code Snippets

### A.1 Complete Grid Spacing Implementation

```javascript
// In checkTrailingStopBuyExecution function
function checkGridSpacing(currentPrice, lots, averageCost) {
  // Original lot-based logic
  if (!enableAverageBasedGrid) {
    return lots.every((lot, index) => {
      const midPrice = (currentPrice + lot.price) / 2;
      const ref = referencePrice || midPrice;

      let gridSize;
      if (enableDynamicGrid) {
        gridSize = calculateDynamicGridSpacing(midPrice, ref, dynamicGridMultiplier, normalizeToReference);
      } else if (enableConsecutiveIncrementalBuyGrid) {
        const isLastBuy = (index === lots.length - 1);
        gridSize = isLastBuy ? buyGridSize : gridIntervalPercent;
      } else {
        gridSize = gridIntervalPercent;
      }

      const spacing = Math.abs(currentPrice - lot.price) / lot.price;
      return spacing >= gridSize;
    });
  }

  // New average-based logic
  if (lots.length === 0) {
    return true; // Always allow first buy
  }

  // Determine grid size (may be incremental)
  const gridSize = enableConsecutiveIncrementalBuyGrid
    ? calculateBuyGridSize(gridIntervalPercent, gridConsecutiveIncrement, consecutiveBuyCount, lastBuyPrice, currentPrice, true)
    : gridIntervalPercent;

  // Asymmetric spacing
  if (currentPrice < averageCost) {
    // Buying below average - require full spacing
    const spacingBelowAverage = (averageCost - currentPrice) / averageCost;
    return spacingBelowAverage >= gridSize;
  } else {
    // Buying above average - require half spacing
    const spacingAboveAverage = (currentPrice - averageCost) / averageCost;
    return spacingAboveAverage >= (gridSize * 0.5);
  }
}
```

### A.2 Complete Dynamic Profile Implementation

```javascript
// State variables (at top of function)
let currentProfile = null;
let profileSwitchCount = 0;
let originalParams = null;

// Profile definitions
const PROFILES = {
  CONSERVATIVE: {
    name: 'Conservative',
    trigger: 'P/L < 0',
    overrides: {
      trailingBuyActivationPercent: 0.10,
      profitRequirement: 0.00
    }
  },
  AGGRESSIVE: {
    name: 'Aggressive',
    trigger: 'P/L >= 0',
    overrides: {
      trailingBuyActivationPercent: 0.00,
      profitRequirement: 0.10
    }
  }
};

// At start of daily loop
if (enableDynamicProfile) {
  const totalPNL = unrealizedPNL + realizedPNL;
  const newProfile = totalPNL < 0 ? 'CONSERVATIVE' : 'AGGRESSIVE';

  if (currentProfile !== newProfile) {
    const oldProfile = currentProfile || 'NONE';
    currentProfile = newProfile;
    profileSwitchCount++;

    // Store original params on first switch
    if (!originalParams) {
      originalParams = {
        trailingBuyActivationPercent: trailingBuyActivationPercent,
        profitRequirement: profitRequirement
      };
    }

    // Apply overrides
    const profile = PROFILES[currentProfile];
    trailingBuyActivationPercent = profile.overrides.trailingBuyActivationPercent;
    profitRequirement = profile.overrides.profitRequirement;

    // Log switch
    transactionLog.push(colorize(
      `  🔄 PROFILE SWITCH: ${oldProfile} → ${newProfile} (Total P/L: ${totalPNL.toFixed(2)})`,
      'magenta'
    ));
    transactionLog.push(colorize(
      `     Settings: Buy activation ${(profile.overrides.trailingBuyActivationPercent * 100).toFixed(0)}%, Profit req ${(profile.overrides.profitRequirement * 100).toFixed(0)}%`,
      'cyan'
    ));

    actionsOccurred = true;
  }
}
```

---

## Summary

This design proposes three independent, opt-in features:

1. **Average-Based Grid Spacing**: O(1) grid checks instead of O(n), simpler logic
2. **Average-Based Sell Logic**: Profitability against average cost, compatible with real portfolios
3. **Dynamic Profile Switching**: Automatic risk adjustment based on P/L performance

All features maintain full backward compatibility and can be combined or used separately.

**Recommendation**: Implement in three phases, validate each phase independently, then test combinations.
