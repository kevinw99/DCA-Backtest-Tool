# Spec 24: Dynamic Profile Switching - Design

## Executive Summary

Implement P/L-based automatic profile switching to reduce risk when losing and maximize gains when winning. The system switches between two profiles (Conservative and Aggressive) with 3-day hysteresis to prevent thrashing.

**Key Features**:
1. Conservative profile when Total P/L < 0 (preserve capital)
2. Aggressive profile when Total P/L >= 0 (maximize gains)
3. 3-day hysteresis prevents rapid switching
4. Only overrides 2 parameters (buy activation %, profit requirement)

---

## 1. Profile System Architecture

### 1.1 Profile Definitions

```javascript
const PROFILES = {
  CONSERVATIVE: {
    name: 'Conservative',
    description: 'Preserve capital when losing money',
    trigger: 'Total P/L < 0 for 3+ consecutive days',
    overrides: {
      trailingBuyActivationPercent: 0.10,  // Harder to buy
      profitRequirement: 0.00              // Easier to sell
    },
    color: 'blue'  // For UI display
  },

  AGGRESSIVE: {
    name: 'Aggressive',
    description: 'Maximize gains when making money',
    trigger: 'Total P/L >= 0 for 3+ consecutive days',
    overrides: {
      trailingBuyActivationPercent: 0.00,  // Easier to buy
      profitRequirement: 0.10              // Harder to sell
    },
    color: 'green'  // For UI display
  }
};

const HYSTERESIS_DAYS = 3;  // Require 3 consecutive days before switching
```

### 1.2 State Management

```javascript
// State variables (at top of runDCABacktest function)
let currentProfile = null;           // Current active profile ('CONSERVATIVE' | 'AGGRESSIVE' | null)
let profileSwitchCount = 0;          // Total number of switches
let daysInConservative = 0;          // Total days spent in Conservative
let daysInAggressive = 0;            // Total days spent in Aggressive
let consecutiveDaysInRegion = 0;    // Counter for hysteresis
let lastPnLSign = null;              // Track P/L sign for consecutive days ('positive' | 'negative')

// Store original parameters (to restore if feature is disabled)
let originalParams = null;

// Profile switch history (for metrics and logging)
const profileSwitches = [];
```

### 1.3 Daily Profile Determination

```javascript
function determineAndApplyProfile(currentDate, unrealizedPNL, realizedPNL) {
  if (!enableDynamicProfile) {
    return; // Feature disabled
  }

  const totalPNL = unrealizedPNL + realizedPNL;
  const currentPnLSign = totalPNL >= 0 ? 'positive' : 'negative';
  const targetProfile = totalPNL >= 0 ? 'AGGRESSIVE' : 'CONSERVATIVE';

  // Check if P/L sign changed (reset hysteresis counter)
  if (currentPnLSign !== lastPnLSign) {
    consecutiveDaysInRegion = 1;  // Reset to 1 (current day)
    lastPnLSign = currentPnLSign;
  } else {
    consecutiveDaysInRegion++;
  }

  // Check if we should switch profiles
  if (targetProfile !== currentProfile && consecutiveDaysInRegion >= HYSTERESIS_DAYS) {
    const oldProfile = currentProfile || 'NONE';
    currentProfile = targetProfile;
    profileSwitchCount++;

    // Store original parameters on first switch
    if (!originalParams) {
      originalParams = {
        trailingBuyActivationPercent: trailingBuyActivationPercent,
        profitRequirement: profitRequirement
      };
    }

    // Apply profile overrides
    const profile = PROFILES[currentProfile];
    trailingBuyActivationPercent = profile.overrides.trailingBuyActivationPercent;
    profitRequirement = profile.overrides.profitRequirement;

    // Log the switch
    const switchInfo = {
      date: currentDate,
      from: oldProfile,
      to: currentProfile,
      pnl: totalPNL,
      consecutiveDays: consecutiveDaysInRegion
    };
    profileSwitches.push(switchInfo);

    transactionLog.push(colorize(
      `  🔄 PROFILE SWITCH: ${oldProfile} → ${currentProfile} (P/L: $${totalPNL.toFixed(2)}, ${consecutiveDaysInRegion} days)`,
      'magenta'
    ));
    transactionLog.push(colorize(
      `     Buy Activation: ${(profile.overrides.trailingBuyActivationPercent * 100).toFixed(0)}%, Profit Req: ${(profile.overrides.profitRequirement * 100).toFixed(0)}%`,
      'cyan'
    ));

    // Reset consecutive counter after switch
    consecutiveDaysInRegion = 0;
  }

  // Track days in each profile
  if (currentProfile === 'CONSERVATIVE') {
    daysInConservative++;
  } else if (currentProfile === 'AGGRESSIVE') {
    daysInAggressive++;
  }
}
```

---

## 2. Integration Points

### 2.1 Daily Loop Integration

```javascript
// In main daily loop, BEFORE any trading logic
for (let i = 0; i < historicalData.length; i++) {
  const dayData = historicalData[i];
  const currentDate = dayData.date;
  const currentPrice = dayData.close;

  // Calculate current P/L
  const totalSharesHeld = lots.reduce((sum, lot) => sum + lot.shares, 0);
  const totalCostOfHeldLots = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
  const unrealizedPNL = (totalSharesHeld * currentPrice) - totalCostOfHeldLots;
  const totalPNL = unrealizedPNL + realizedPNL;

  // ===== PROFILE DETERMINATION (before any trading) =====
  determineAndApplyProfile(currentDate, unrealizedPNL, realizedPNL);

  // ... rest of daily trading logic (uses potentially updated parameters)
}
```

### 2.2 Timing Diagram

```
Day Start
  ↓
Calculate P/L
  ↓
Determine Profile (check hysteresis)
  ↓
Apply Profile Overrides (if switching)
  ↓
Log Switch (if occurred)
  ↓
Execute Trading Logic (with updated params)
  ↓
Update Position (may change P/L for tomorrow)
  ↓
Day End
```

**Key Point**: Profile is determined BEFORE any trading, so new parameters take effect immediately for that day's decisions.

---

## 3. Active Order Handling

### 3.1 Decision: Preserve Active Orders

When profile switches, **do NOT cancel** active trailing stops. Let them complete naturally.

**Rationale**:
- Active stops represent committed trades based on market setup
- Cancelling them could miss profitable opportunities
- Complexity of cancellation logic
- User confusion if orders suddenly disappear

### 3.2 Implementation

```javascript
// No changes needed - active orders continue with original parameters
// New orders (activated after switch) will use new profile parameters

// Example scenario:
// Day 10: Aggressive profile, trailing stop buy activated at $50 (0% activation)
// Day 11: Switch to Conservative (10% activation requirement)
// Day 12: Price hits $51 → trailing stop executes (using original 0% parameters)
// Day 13: New trailing stop buy activates only if price drops 10% from peak (new parameters)
```

---

## 4. Metrics & Observability

### 4.1 Profile Metrics

```javascript
// Add to results object
const profileMetrics = {
  enabled: enableDynamicProfile,
  totalSwitches: profileSwitchCount,
  daysInConservative: daysInConservative,
  daysInAggressive: daysInAggressive,
  conservativePercent: totalDays > 0 ? (daysInConservative / totalDays * 100) : 0,
  aggressivePercent: totalDays > 0 ? (daysInAggressive / totalDays * 100) : 0,
  switchHistory: profileSwitches.map(sw => ({
    date: sw.date,
    from: sw.from,
    to: sw.to,
    pnl: sw.pnl,
    consecutiveDays: sw.consecutiveDays
  })),
  finalProfile: currentProfile
};
```

### 4.2 Transaction Log Format

```
--- 2024-01-15 ---
Price: 45.50      | R.PNL: 0          | U.PNL: -2500      | T.PNL: -2500      | Holdings: [50.00]
  🔄 PROFILE SWITCH: AGGRESSIVE → CONSERVATIVE (P/L: $-2500.00, 3 days)
     Buy Activation: 10%, Profit Req: 0%

--- 2024-02-20 ---
Price: 55.20      | R.PNL: 5000       | U.PNL: 1500       | T.PNL: 6500       | Holdings: [50.00, 45.00]
  🔄 PROFILE SWITCH: CONSERVATIVE → AGGRESSIVE (P/L: $6500.00, 3 days)
     Buy Activation: 0%, Profit Req: 10%
```

### 4.3 API Response Format

```javascript
{
  success: true,
  data: {
    // ... existing fields
    totalReturn: 125.5,
    sharpeRatio: 1.8,

    // New field
    profileMetrics: {
      enabled: true,
      totalSwitches: 5,
      daysInConservative: 45,
      daysInAggressive: 207,
      conservativePercent: 17.86,
      aggressivePercent: 82.14,
      switchHistory: [
        {
          date: '2024-01-15',
          from: 'AGGRESSIVE',
          to: 'CONSERVATIVE',
          pnl: -2500,
          consecutiveDays: 3
        },
        // ... more switches
      ],
      finalProfile: 'AGGRESSIVE'
    }
  }
}
```

---

## 5. Parameter Validation

### 5.1 Backend Validation

```javascript
function validateParams(params) {
  // ... existing validations

  // New parameter validation
  if (params.enableDynamicProfile !== undefined) {
    if (typeof params.enableDynamicProfile !== 'boolean') {
      throw new Error('enableDynamicProfile must be boolean');
    }
  }

  // Batch mode: must be single boolean, NOT an array
  if (Array.isArray(params.enableDynamicProfile)) {
    throw new Error('enableDynamicProfile cannot be an array in batch mode. Use single boolean (true or false).');
  }
}
```

### 5.2 Batch Mode Handling

```javascript
// In batch parameter expansion
const batchParams = {
  symbols: ['PLTR', 'TSLA'],
  profitRequirement: [5, 10],           // Arrays OK
  gridIntervalPercent: [10, 15],        // Arrays OK
  enableDynamicProfile: true            // Single boolean only!
};

// This will generate tests:
// 1. PLTR, profit=5, grid=10, dynamicProfile=true
// 2. PLTR, profit=10, grid=10, dynamicProfile=true
// 3. PLTR, profit=5, grid=15, dynamicProfile=true
// 4. PLTR, profit=10, grid=15, dynamicProfile=true
// ... (all with dynamicProfile=true)

// To test without dynamic profile, run separate batch:
const batchParamsNoProfile = {
  ...batchParams,
  enableDynamicProfile: false
};
```

---

## 6. Edge Case Handling

### 6.1 First Day Initialization

```javascript
// On first day (i === 0)
if (i === 0) {
  // Determine initial profile based on starting P/L
  // (Usually 0 → Aggressive, but could be different if initialLots provided)
  const totalPNL = unrealizedPNL + realizedPNL;
  currentProfile = totalPNL >= 0 ? 'AGGRESSIVE' : 'CONSERVATIVE';
  lastPnLSign = totalPNL >= 0 ? 'positive' : 'negative';
  consecutiveDaysInRegion = 1;

  // Apply initial profile
  if (enableDynamicProfile) {
    const profile = PROFILES[currentProfile];
    trailingBuyActivationPercent = profile.overrides.trailingBuyActivationPercent;
    profitRequirement = profile.overrides.profitRequirement;

    transactionLog.push(colorize(
      `  🎯 INITIAL PROFILE: ${currentProfile} (P/L: $${totalPNL.toFixed(2)})`,
      'magenta'
    ));
  }
}
```

### 6.2 P/L Exactly at Zero

```javascript
// totalPNL = 0.00 exactly
// Decision: Treat as POSITIVE (>= 0) → Aggressive profile
const targetProfile = totalPNL >= 0 ? 'AGGRESSIVE' : 'CONSERVATIVE';
```

**Rationale**: Breakeven is not a loss. Stay aggressive.

### 6.3 Hysteresis Counter Reset

```javascript
// Scenario: P/L oscillates around zero
// Day 1: +$100 (positive, consecutive=1)
// Day 2: -$50  (negative, consecutive=1, RESET)
// Day 3: -$80  (negative, consecutive=2)
// Day 4: +$20  (positive, consecutive=1, RESET)

// The counter resets whenever P/L sign changes
if (currentPnLSign !== lastPnLSign) {
  consecutiveDaysInRegion = 1;  // Reset
  lastPnLSign = currentPnLSign;
}
```

### 6.4 Switch Immediately After Meeting Hysteresis

```javascript
// Day 1-2: P/L positive, Aggressive active
// Day 3: P/L negative (consecutive=1)
// Day 4: P/L negative (consecutive=2)
// Day 5: P/L negative (consecutive=3) → SWITCH to Conservative

// After switch, reset counter to 0 (or 1?)
// Decision: Reset to 0, so next switch also requires 3 consecutive days
consecutiveDaysInRegion = 0;  // After switch
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

```javascript
describe('Profile Determination', () => {
  test('initial profile is Aggressive when P/L = 0', () => {
    const profile = determineProfile(0);
    expect(profile).toBe('AGGRESSIVE');
  });

  test('switches to Conservative after 3 consecutive days of losses', () => {
    const tracker = new ProfileTracker();

    tracker.update(1, -100);  // Day 1: negative (consecutive=1)
    expect(tracker.currentProfile).toBe('AGGRESSIVE'); // No switch yet

    tracker.update(2, -200);  // Day 2: negative (consecutive=2)
    expect(tracker.currentProfile).toBe('AGGRESSIVE'); // No switch yet

    tracker.update(3, -150);  // Day 3: negative (consecutive=3)
    expect(tracker.currentProfile).toBe('CONSERVATIVE'); // SWITCHED!
  });

  test('resets hysteresis counter when P/L sign changes', () => {
    const tracker = new ProfileTracker();

    tracker.update(1, -100);  // Day 1: negative (consecutive=1)
    tracker.update(2, -200);  // Day 2: negative (consecutive=2)
    tracker.update(3, +100);  // Day 3: positive (consecutive=1, RESET)
    tracker.update(4, -50);   // Day 4: negative (consecutive=1, RESET again)

    expect(tracker.currentProfile).toBe('AGGRESSIVE'); // No switch (never hit 3)
  });

  test('P/L exactly at zero is treated as positive', () => {
    const profile = determineProfile(0);
    expect(profile).toBe('AGGRESSIVE');
  });
});

describe('Profile Overrides', () => {
  test('Conservative profile overrides parameters correctly', () => {
    const params = {
      trailingBuyActivationPercent: 0.05,
      profitRequirement: 0.15
    };

    applyProfile('CONSERVATIVE', params);

    expect(params.trailingBuyActivationPercent).toBe(0.10);
    expect(params.profitRequirement).toBe(0.00);
  });

  test('Aggressive profile overrides parameters correctly', () => {
    const params = {
      trailingBuyActivationPercent: 0.05,
      profitRequirement: 0.15
    };

    applyProfile('AGGRESSIVE', params);

    expect(params.trailingBuyActivationPercent).toBe(0.00);
    expect(params.profitRequirement).toBe(0.10);
  });
});
```

### 7.2 Integration Tests

```javascript
describe('Full Backtest with Dynamic Profiles', () => {
  test('PLTR 2021-2025: switches profiles correctly', async () => {
    const params = {
      symbol: 'PLTR',
      startDate: '2021-09-01',
      endDate: '2025-01-01',
      lotSizeUsd: 10000,
      maxLots: 10,
      gridIntervalPercent: 0.10,
      profitRequirement: 0.10,  // Will be overridden by profiles
      trailingBuyActivationPercent: 0.05,  // Will be overridden
      enableDynamicProfile: true
    };

    const result = await runDCABacktest(params);

    // Assertions
    expect(result.success).toBe(true);
    expect(result.data.profileMetrics.enabled).toBe(true);
    expect(result.data.profileMetrics.totalSwitches).toBeGreaterThan(0);
    expect(result.data.profileMetrics.daysInConservative).toBeGreaterThan(0);
    expect(result.data.profileMetrics.daysInAggressive).toBeGreaterThan(0);

    // Verify switches occurred at correct times
    const switches = result.data.profileMetrics.switchHistory;
    switches.forEach(sw => {
      if (sw.to === 'CONSERVATIVE') {
        expect(sw.pnl).toBeLessThan(0); // Switched when losing
      } else {
        expect(sw.pnl).toBeGreaterThanOrEqual(0); // Switched when winning
      }
    });
  });

  test('backward compatibility: same results when disabled', async () => {
    const paramsOriginal = {
      symbol: 'PLTR',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      lotSizeUsd: 10000,
      maxLots: 10,
      gridIntervalPercent: 0.10,
      profitRequirement: 0.10
    };

    const paramsWithFeature = {
      ...paramsOriginal,
      enableDynamicProfile: false
    };

    const result1 = await runDCABacktest(paramsOriginal);
    const result2 = await runDCABacktest(paramsWithFeature);

    // Should produce identical results
    expect(result1.data.totalReturn).toBeCloseTo(result2.data.totalReturn, 2);
    expect(result1.data.transactions.length).toBe(result2.data.transactions.length);
  });
});
```

### 7.3 Performance Validation

```javascript
describe('Profile Switching Performance Impact', () => {
  test('reduces max drawdown in volatile markets', async () => {
    // Test on known volatile period
    const params = {
      symbol: 'PLTR',
      startDate: '2022-01-01',  // Known bear market
      endDate: '2022-12-31',
      lotSizeUsd: 10000,
      maxLots: 10,
      gridIntervalPercent: 0.10,
      profitRequirement: 0.10
    };

    const resultWithout = await runDCABacktest({
      ...params,
      enableDynamicProfile: false
    });

    const resultWith = await runDCABacktest({
      ...params,
      enableDynamicProfile: true
    });

    // Profile switching should reduce drawdown
    expect(resultWith.data.maxDrawdownPercent)
      .toBeLessThan(resultWithout.data.maxDrawdownPercent);

    // But maintain similar returns (within 10%)
    const returnDiff = Math.abs(resultWith.data.totalReturn - resultWithout.data.totalReturn);
    const returnPercentDiff = returnDiff / resultWithout.data.totalReturn;
    expect(returnPercentDiff).toBeLessThan(0.10);  // Within 10%
  });
});
```

---

## 8. Implementation Checklist

### Backend Changes
- [ ] Add `enableDynamicProfile` parameter
- [ ] Add profile state variables
- [ ] Implement `determineAndApplyProfile()` function
- [ ] Add hysteresis logic
- [ ] Store original parameters
- [ ] Apply profile overrides
- [ ] Calculate profile metrics
- [ ] Add profile switch logging
- [ ] Update API response format
- [ ] Add parameter validation (reject arrays)

### Frontend Changes
- [ ] Add checkbox in UI
- [ ] Add tooltip with clear explanation
- [ ] Display profile metrics in results
- [ ] Show profile switch history (optional)
- [ ] Add warning about parameter overrides

### Testing
- [ ] Unit tests for profile determination
- [ ] Unit tests for hysteresis logic
- [ ] Unit tests for parameter overrides
- [ ] Integration tests for full backtests
- [ ] Performance validation (drawdown reduction)
- [ ] Backward compatibility tests
- [ ] Edge case tests (P/L=0, day 1, etc.)

### Documentation
- [ ] Update API documentation
- [ ] Create user guide with examples
- [ ] Document profile definitions
- [ ] Document parameter overrides
- [ ] Create comparison guide (with/without profiles)

---

## 9. Performance Analysis

### 9.1 Computational Overhead

```javascript
// Per-day overhead
function determineAndApplyProfile() {
  // O(1) operations:
  // - Calculate totalPNL (simple addition)
  // - Compare P/L sign (single comparison)
  // - Update counter (single increment)
  // - Check threshold (single comparison)
  // - Apply overrides (2 assignments)

  // Expected: < 0.01ms per day
  // Total for 252 days: < 2.5ms
  // Negligible compared to typical backtest time (100-500ms)
}
```

**Conclusion**: Overhead is negligible (<1% of total backtest time).

### 9.2 Memory Usage

```javascript
// Additional memory
const profileSwitches = [];  // ~20 bytes per switch × 5-10 switches = 100-200 bytes
const stateVariables = 7 * 8; // 7 integers × 8 bytes = 56 bytes

// Total: < 1 KB additional memory
```

**Conclusion**: Memory impact is negligible.

---

## 10. Rollout Plan

### Week 1: Core Implementation
- Implement profile determination logic
- Implement hysteresis mechanism
- Add parameter overrides
- Unit tests for core logic

### Week 2: Metrics & Logging
- Add profile metrics calculation
- Add transaction log integration
- Update API response format
- Integration tests

### Week 3: Polish & Deploy
- Frontend UI
- Documentation
- Performance validation
- Beta testing
- Production deployment

---

## Summary

Spec 24 implements automatic profile switching based on P/L:

**Core Features**:
- Conservative profile when P/L < 0 (preserve capital)
- Aggressive profile when P/L >= 0 (maximize gains)
- 3-day hysteresis prevents thrashing
- Only overrides 2 parameters (buy activation %, profit requirement)

**Benefits**:
- Automatic risk management
- Reduced drawdowns in losses
- Maximized gains in profits
- Zero overhead (<1% performance impact)

**Timeline**: 3 weeks, can be done independently or after Spec 23.
