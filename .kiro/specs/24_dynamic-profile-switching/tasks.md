# Implementation Tasks - Spec 24: Dynamic Profile Switching

## Overview

This document breaks down the implementation of Feature #3 (Dynamic Profile Switching) into specific, actionable tasks.

**Timeline**: 3 weeks total

---

## Phase 1: Core Profile Logic (Week 1)

### Task 1.1: Add Parameter & Validation
**File**: `backend/services/dcaBacktestService.js`
**Estimated Time**: 1 hour

- [ ] Add `enableDynamicProfile` to parameter definition (default: `false`)
- [ ] Add JSDoc documentation for parameter
- [ ] Add validation: must be boolean
- [ ] Add validation: CANNOT be array in batch mode (throw specific error)
- [ ] Update parameter summary logging

**Acceptance Criteria**:
- Parameter accepts `true` or `false`
- Throws error if non-boolean value provided
- Throws error if array provided: `"enableDynamicProfile cannot be an array in batch mode. Use single boolean (true or false)."`
- Default value is `false` (backward compatible)

---

### Task 1.2: Define Profile Constants
**File**: `backend/services/dcaBacktestService.js` (top of file)
**Estimated Time**: 30 minutes

- [ ] Create `PROFILES` constant with Conservative and Aggressive definitions
- [ ] Define `HYSTERESIS_DAYS = 3` constant
- [ ] Add profile color codes for logging
- [ ] Add JSDoc documentation for profile structure

**Code**:
```javascript
/**
 * Profile definitions for dynamic profile switching
 * @constant
 */
const PROFILES = {
  CONSERVATIVE: {
    name: 'Conservative',
    description: 'Preserve capital when losing money',
    trigger: 'Total P/L < 0 for 3+ consecutive days',
    overrides: {
      trailingBuyActivationPercent: 0.10,  // Harder to buy
      profitRequirement: 0.00              // Easier to sell
    },
    color: 'blue'
  },

  AGGRESSIVE: {
    name: 'Aggressive',
    description: 'Maximize gains when making money',
    trigger: 'Total P/L >= 0 for 3+ consecutive days',
    overrides: {
      trailingBuyActivationPercent: 0.00,  // Easier to buy
      profitRequirement: 0.10              // Harder to sell
    },
    color: 'green'
  }
};

const HYSTERESIS_DAYS = 3;  // Require 3 consecutive days before switching
```

**Acceptance Criteria**:
- Constants defined correctly
- JSDoc documentation complete
- Easy to modify in future (Phase 2: user-configurable)

---

### Task 1.3: Initialize Profile State Variables
**File**: `backend/services/dcaBacktestService.js` (inside `runDCABacktest` function)
**Estimated Time**: 30 minutes

- [ ] Add `currentProfile = null` (CONSERVATIVE | AGGRESSIVE | null)
- [ ] Add `profileSwitchCount = 0`
- [ ] Add `daysInConservative = 0`
- [ ] Add `daysInAggressive = 0`
- [ ] Add `consecutiveDaysInRegion = 0` (hysteresis counter)
- [ ] Add `lastPnLSign = null` ('positive' | 'negative')
- [ ] Add `originalParams = null` (store original user parameters)
- [ ] Add `profileSwitches = []` (switch history)

**Code**:
```javascript
// Profile switching state (if enableDynamicProfile is true)
let currentProfile = null;           // Current active profile
let profileSwitchCount = 0;          // Total number of switches
let daysInConservative = 0;          // Total days spent in Conservative
let daysInAggressive = 0;            // Total days spent in Aggressive
let consecutiveDaysInRegion = 0;    // Counter for hysteresis
let lastPnLSign = null;              // Track P/L sign ('positive' | 'negative')
let originalParams = null;           // Store original parameters
const profileSwitches = [];          // Profile switch history
```

**Acceptance Criteria**:
- All state variables initialized
- Clear comments for each variable
- Easy to understand state management

---

### Task 1.4: Implement Profile Determination Function
**File**: `backend/services/dcaBacktestService.js`
**Estimated Time**: 3 hours

- [ ] Create `determineAndApplyProfile(currentDate, unrealizedPNL, realizedPNL)` function
- [ ] Calculate total P/L
- [ ] Determine P/L sign (positive/negative)
- [ ] Implement hysteresis logic (3-day counter)
- [ ] Detect profile switches
- [ ] Store original parameters on first switch
- [ ] Apply profile overrides when switching
- [ ] Log profile switches
- [ ] Track days in each profile
- [ ] Reset hysteresis counter after switch

**Code**:
```javascript
/**
 * Determine and apply dynamic profile based on P/L
 * @param {string} currentDate - Current date
 * @param {number} unrealizedPNL - Unrealized profit/loss
 * @param {number} realizedPNL - Realized profit/loss
 */
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

**Acceptance Criteria**:
- Function works correctly
- Hysteresis prevents thrashing
- Profile switches logged
- Days tracked accurately

---

### Task 1.5: Integrate into Daily Loop
**File**: `backend/services/dcaBacktestService.js` (main daily loop)
**Estimated Time**: 1 hour

- [ ] Call `determineAndApplyProfile()` at start of each day
- [ ] BEFORE any trading logic
- [ ] After P/L calculation
- [ ] Handle first day initialization

**Code**:
```javascript
// In main daily loop
for (let i = 0; i < historicalData.length; i++) {
  const dayData = historicalData[i];
  const currentDate = dayData.date;
  const currentPrice = dayData.close;

  // Calculate current P/L
  const totalSharesHeld = lots.reduce((sum, lot) => sum + lot.shares, 0);
  const totalCostOfHeldLots = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
  const unrealizedPNL = (totalSharesHeld * currentPrice) - totalCostOfHeldLots;

  // ===== PROFILE DETERMINATION (before any trading) =====
  if (i === 0) {
    // First day: initialize profile
    if (enableDynamicProfile) {
      const totalPNL = unrealizedPNL + realizedPNL;
      currentProfile = totalPNL >= 0 ? 'AGGRESSIVE' : 'CONSERVATIVE';
      lastPnLSign = totalPNL >= 0 ? 'positive' : 'negative';
      consecutiveDaysInRegion = 1;

      // Apply initial profile
      const profile = PROFILES[currentProfile];
      originalParams = {
        trailingBuyActivationPercent: trailingBuyActivationPercent,
        profitRequirement: profitRequirement
      };
      trailingBuyActivationPercent = profile.overrides.trailingBuyActivationPercent;
      profitRequirement = profile.overrides.profitRequirement;

      transactionLog.push(colorize(
        `  🎯 INITIAL PROFILE: ${currentProfile} (P/L: $${totalPNL.toFixed(2)})`,
        'magenta'
      ));
    }
  } else {
    // Subsequent days: check for profile switches
    determineAndApplyProfile(currentDate, unrealizedPNL, realizedPNL);
  }

  // ... rest of daily trading logic (uses potentially updated parameters)
}
```

**Acceptance Criteria**:
- Profile determination runs before trading
- First day handled correctly
- Parameters updated immediately

---

### Task 1.6: Unit Tests - Profile Determination
**File**: `backend/tests/dynamicProfile.test.js` (new file)
**Estimated Time**: 3 hours

- [ ] Test: Initial profile is Aggressive when P/L = 0
- [ ] Test: Initial profile is Conservative when P/L < 0
- [ ] Test: Switch to Conservative after 3 consecutive days of losses
- [ ] Test: Switch to Aggressive after 3 consecutive days of profits
- [ ] Test: Hysteresis counter resets when P/L sign changes
- [ ] Test: P/L exactly at zero is treated as positive
- [ ] Test: Profile switches log correctly
- [ ] Test: Days in each profile tracked correctly

**Example Tests**:
```javascript
describe('Profile Determination', () => {
  test('initial profile is Aggressive when P/L = 0', () => {
    const totalPNL = 0;
    const profile = totalPNL >= 0 ? 'AGGRESSIVE' : 'CONSERVATIVE';
    expect(profile).toBe('AGGRESSIVE');
  });

  test('switches to Conservative after 3 consecutive days of losses', () => {
    const tracker = {
      currentProfile: 'AGGRESSIVE',
      consecutiveDaysInRegion: 0,
      lastPnLSign: 'positive'
    };

    // Day 1: negative
    updateProfile(tracker, -100);
    expect(tracker.currentProfile).toBe('AGGRESSIVE'); // No switch yet
    expect(tracker.consecutiveDaysInRegion).toBe(1);

    // Day 2: negative
    updateProfile(tracker, -200);
    expect(tracker.currentProfile).toBe('AGGRESSIVE'); // No switch yet
    expect(tracker.consecutiveDaysInRegion).toBe(2);

    // Day 3: negative
    updateProfile(tracker, -150);
    expect(tracker.currentProfile).toBe('CONSERVATIVE'); // SWITCHED!
    expect(tracker.consecutiveDaysInRegion).toBe(0); // Reset after switch
  });

  test('resets hysteresis counter when P/L sign changes', () => {
    const tracker = {
      currentProfile: 'AGGRESSIVE',
      consecutiveDaysInRegion: 0,
      lastPnLSign: 'positive'
    };

    updateProfile(tracker, -100);  // Day 1: negative (consecutive=1)
    expect(tracker.consecutiveDaysInRegion).toBe(1);

    updateProfile(tracker, -200);  // Day 2: negative (consecutive=2)
    expect(tracker.consecutiveDaysInRegion).toBe(2);

    updateProfile(tracker, +100);  // Day 3: positive (RESET, consecutive=1)
    expect(tracker.consecutiveDaysInRegion).toBe(1);
    expect(tracker.lastPnLSign).toBe('positive');

    updateProfile(tracker, -50);   // Day 4: negative (RESET, consecutive=1)
    expect(tracker.consecutiveDaysInRegion).toBe(1);

    expect(tracker.currentProfile).toBe('AGGRESSIVE'); // Never switched (never hit 3)
  });
});
```

**Acceptance Criteria**:
- All tests pass
- Coverage >90%
- Edge cases covered

---

## Phase 2: Metrics & Logging (Week 2)

### Task 2.1: Add Profile Metrics to Results
**File**: `backend/services/dcaBacktestService.js` (results section)
**Estimated Time**: 2 hours

- [ ] Create `profileMetrics` object
- [ ] Include: enabled, totalSwitches, daysInConservative, daysInAggressive
- [ ] Calculate: conservativePercent, aggressivePercent
- [ ] Include: switchHistory (array of all switches)
- [ ] Include: finalProfile
- [ ] Add to results object

**Code**:
```javascript
// At end of backtest, add to results
const totalDays = historicalData.length;

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

// Add to results
return {
  success: true,
  data: {
    // ... existing fields
    totalReturn: totalReturnPercent,
    sharpeRatio: sharpeRatio,

    // New field
    profileMetrics: profileMetrics
  }
};
```

**Acceptance Criteria**:
- Metrics calculated correctly
- Included in API response
- All switches tracked

---

### Task 2.2: Enhance Transaction Log
**File**: `backend/services/dcaBacktestService.js`
**Estimated Time**: 1 hour

- [ ] Log profile switches with clear formatting
- [ ] Show parameter changes
- [ ] Use colors for visibility
- [ ] Include P/L amounts
- [ ] Include consecutive day count

**Example Log Output**:
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

**Acceptance Criteria**:
- Switches clearly visible in logs
- Easy to debug profile behavior
- Colors make switches stand out

---

### Task 2.3: Add Verbose Logging
**File**: `backend/services/dcaBacktestService.js`
**Estimated Time**: 1 hour

- [ ] Log current profile in daily header (verbose mode)
- [ ] Log P/L sign tracking
- [ ] Log hysteresis counter progress
- [ ] Log when parameters are overridden

**Example Verbose Log**:
```
--- 2024-01-13 (Verbose) ---
Current Profile: AGGRESSIVE
P/L Sign: negative (consecutive days: 1 / 3 needed)
Parameters: Buy Activation = 0%, Profit Req = 10%

--- 2024-01-14 (Verbose) ---
Current Profile: AGGRESSIVE
P/L Sign: negative (consecutive days: 2 / 3 needed)
Parameters: Buy Activation = 0%, Profit Req = 10%

--- 2024-01-15 (Verbose) ---
Current Profile: AGGRESSIVE → CONSERVATIVE (SWITCHING!)
P/L Sign: negative (consecutive days: 3 / 3 needed) ✓
Parameters: Buy Activation = 0% → 10%, Profit Req = 10% → 0%
```

**Acceptance Criteria**:
- Verbose mode shows profile state
- Easy to debug hysteresis logic
- Clear parameter tracking

---

### Task 2.4: Unit Tests - Metrics Calculation
**File**: `backend/tests/dynamicProfileMetrics.test.js` (new file)
**Estimated Time**: 2 hours

- [ ] Test: Metrics calculation accuracy
- [ ] Test: Switch history format
- [ ] Test: Percentage calculations
- [ ] Test: Final profile tracking
- [ ] Test: Zero switches case
- [ ] Test: Multiple switches case

**Example Test**:
```javascript
describe('Profile Metrics', () => {
  test('calculates percentages correctly', () => {
    const totalDays = 252;
    const daysInConservative = 45;
    const daysInAggressive = 207;

    const conservativePercent = (daysInConservative / totalDays) * 100;
    const aggressivePercent = (daysInAggressive / totalDays) * 100;

    expect(conservativePercent).toBeCloseTo(17.86, 2);
    expect(aggressivePercent).toBeCloseTo(82.14, 2);
  });

  test('tracks switch history correctly', () => {
    const switches = [
      { date: '2024-01-15', from: 'AGGRESSIVE', to: 'CONSERVATIVE', pnl: -2500, consecutiveDays: 3 },
      { date: '2024-02-20', from: 'CONSERVATIVE', to: 'AGGRESSIVE', pnl: 6500, consecutiveDays: 3 }
    ];

    expect(switches.length).toBe(2);
    expect(switches[0].from).toBe('AGGRESSIVE');
    expect(switches[0].to).toBe('CONSERVATIVE');
    expect(switches[0].pnl).toBeLessThan(0);
  });
});
```

**Acceptance Criteria**:
- All tests pass
- Metrics accurate
- Edge cases covered

---

## Phase 3: Integration & Testing (Week 3)

### Task 3.1: Integration Tests - Full Backtests
**File**: `backend/tests/integration/dynamicProfile.integration.test.js` (new file)
**Estimated Time**: 3 hours

- [ ] Test: PLTR 2021-2025 with dynamic profiles
- [ ] Test: Profile switches occur at correct times
- [ ] Test: Metrics are accurate
- [ ] Test: Backward compatibility (same results when disabled)
- [ ] Test: Performance validation (overhead <1%)

**Example Test**:
```javascript
describe('Dynamic Profile Integration', () => {
  test('PLTR 2021-2025: switches profiles correctly', async () => {
    const params = {
      symbol: 'PLTR',
      startDate: '2021-09-01',
      endDate: '2025-01-01',
      lotSizeUsd: 10000,
      maxLots: 10,
      gridIntervalPercent: 0.10,
      profitRequirement: 0.10,
      enableDynamicProfile: true
    };

    const result = await runDCABacktest(params);

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
    const params = {
      symbol: 'PLTR',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      lotSizeUsd: 10000,
      maxLots: 10,
      gridIntervalPercent: 0.10,
      profitRequirement: 0.10
    };

    const result1 = await runDCABacktest(params);
    const result2 = await runDCABacktest({
      ...params,
      enableDynamicProfile: false
    });

    // Should produce identical results
    expect(result1.data.totalReturn).toBeCloseTo(result2.data.totalReturn, 2);
    expect(result1.data.transactions.length).toBe(result2.data.transactions.length);
  });
});
```

**Acceptance Criteria**:
- Integration tests pass
- Profile switching works correctly
- Backward compatibility verified

---

### Task 3.2: Performance Validation Tests
**File**: `backend/tests/integration/dynamicProfilePerformance.test.js` (new file)
**Estimated Time**: 2 hours

- [ ] Test: Reduces max drawdown in volatile markets
- [ ] Test: Maintains similar returns (within 10%)
- [ ] Test: Improves Sharpe ratio
- [ ] Test: Reasonable switch count (3-10 switches)

**Example Test**:
```javascript
describe('Profile Switching Performance Impact', () => {
  test('reduces max drawdown in volatile markets', async () => {
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
    expect(returnPercentDiff).toBeLessThan(0.10);
  });
});
```

**Acceptance Criteria**:
- Performance improvements validated
- Drawdown reduction demonstrated
- Returns maintained

---

### Task 3.3: Edge Case Tests
**File**: `backend/tests/dynamicProfileEdgeCases.test.js` (new file)
**Estimated Time**: 2 hours

- [ ] Test: P/L oscillating around zero (hysteresis prevents thrashing)
- [ ] Test: P/L exactly at zero (treated as positive)
- [ ] Test: First day with negative P/L (starts Conservative)
- [ ] Test: Active trailing stop when profile switches (preserves order)
- [ ] Test: Parameter override and restoration

**Example Tests**:
```javascript
describe('Edge Cases', () => {
  test('P/L oscillating around zero does not cause rapid switching', () => {
    const tracker = {
      currentProfile: 'AGGRESSIVE',
      consecutiveDaysInRegion: 0,
      lastPnLSign: 'positive',
      switchCount: 0
    };

    updateProfile(tracker, +100);  // Day 1: positive
    updateProfile(tracker, -50);   // Day 2: negative (reset)
    updateProfile(tracker, +200);  // Day 3: positive (reset)
    updateProfile(tracker, -100);  // Day 4: negative (reset)
    updateProfile(tracker, -80);   // Day 5: negative (2 consecutive)
    updateProfile(tracker, +20);   // Day 6: positive (reset)

    // Should never switch (never hit 3 consecutive)
    expect(tracker.switchCount).toBe(0);
    expect(tracker.currentProfile).toBe('AGGRESSIVE');
  });

  test('P/L exactly at zero is treated as positive', () => {
    const totalPNL = 0.00;
    const profile = totalPNL >= 0 ? 'AGGRESSIVE' : 'CONSERVATIVE';
    expect(profile).toBe('AGGRESSIVE');
  });
});
```

**Acceptance Criteria**:
- All edge cases handled
- No unexpected behavior
- Tests pass

---

### Task 3.4: Batch Mode Validation
**File**: `backend/tests/dynamicProfileBatchMode.test.js` (new file)
**Estimated Time**: 1 hour

- [ ] Test: Rejects array for `enableDynamicProfile`
- [ ] Test: Accepts single boolean in batch
- [ ] Test: Error message is clear

**Example Test**:
```javascript
describe('Batch Mode Validation', () => {
  test('rejects array for enableDynamicProfile', async () => {
    const params = {
      symbol: 'PLTR',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      lotSizeUsd: 10000,
      maxLots: 10,
      enableDynamicProfile: [true, false]  // INVALID!
    };

    await expect(runBatchBacktest(params)).rejects.toThrow(
      'enableDynamicProfile cannot be an array in batch mode'
    );
  });

  test('accepts single boolean in batch', async () => {
    const params = {
      symbol: ['PLTR', 'TSLA'],
      profitRequirement: [5, 10],
      enableDynamicProfile: true  // Single boolean OK
    };

    const result = await runBatchBacktest(params);
    expect(result.success).toBe(true);
    // Should generate 4 tests (2 symbols × 2 profit requirements)
    expect(result.data.length).toBe(4);
    // All with dynamicProfile=true
    result.data.forEach(test => {
      expect(test.profileMetrics.enabled).toBe(true);
    });
  });
});
```

**Acceptance Criteria**:
- Batch mode validation works
- Error messages clear
- Tests pass

---

## Phase 4: Frontend & Documentation

### Task 4.1: Frontend UI
**File**: `frontend/src/components/BacktestParameters.jsx` (or similar)
**Estimated Time**: 2 hours

- [ ] Add checkbox: "Enable Dynamic Profile Switching"
- [ ] Add tooltip with explanation
- [ ] Add section: "Strategy Adaptation"
- [ ] Display profile metrics in results
- [ ] Show profile switch history (table or timeline)

**Example UI**:
```jsx
<div className="parameter-group">
  <h3>Strategy Adaptation</h3>

  <div className="checkbox-group">
    <input
      type="checkbox"
      id="enableDynamicProfile"
      checked={params.enableDynamicProfile || false}
      onChange={(e) => setParams({
        ...params,
        enableDynamicProfile: e.target.checked
      })}
    />
    <label htmlFor="enableDynamicProfile">
      Enable Dynamic Profile Switching
      <Tooltip>
        Automatically adjust strategy based on P/L performance:
        - Conservative when losing (P/L &lt; 0): Harder to buy, easier to sell
        - Aggressive when winning (P/L ≥ 0): Easier to buy, harder to sell
        Requires 3 consecutive days before switching to prevent thrashing.
      </Tooltip>
    </label>
  </div>

  {params.enableDynamicProfile && (
    <div className="warning">
      ⚠️ Note: This feature overrides trailingBuyActivationPercent and profitRequirement
    </div>
  )}
</div>

{/* In results display */}
{result.profileMetrics?.enabled && (
  <div className="profile-metrics">
    <h4>Profile Metrics</h4>
    <div>Total Switches: {result.profileMetrics.totalSwitches}</div>
    <div>Days in Conservative: {result.profileMetrics.daysInConservative} ({result.profileMetrics.conservativePercent.toFixed(1)}%)</div>
    <div>Days in Aggressive: {result.profileMetrics.daysInAggressive} ({result.profileMetrics.aggressivePercent.toFixed(1)}%)</div>
    <div>Final Profile: {result.profileMetrics.finalProfile}</div>

    <h5>Switch History</h5>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>From</th>
          <th>To</th>
          <th>P/L</th>
        </tr>
      </thead>
      <tbody>
        {result.profileMetrics.switchHistory.map((sw, i) => (
          <tr key={i}>
            <td>{sw.date}</td>
            <td>{sw.from}</td>
            <td>{sw.to}</td>
            <td>${sw.pnl.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
```

**Acceptance Criteria**:
- Checkbox works correctly
- Tooltip is informative
- Results display profile metrics
- Switch history visible

---

### Task 4.2: API Documentation
**File**: `docs/api.md`
**Estimated Time**: 1 hour

- [ ] Document `enableDynamicProfile` parameter
- [ ] Document `profileMetrics` response field
- [ ] Document profile definitions
- [ ] Add curl examples

**Example**:
```markdown
### POST /api/backtest/dca

#### New Parameters (Spec 24)

**enableDynamicProfile** (boolean, default: false)
- Automatically switch between Conservative and Aggressive profiles based on P/L
- Conservative (P/L < 0): trailingBuyActivationPercent=10%, profitRequirement=0%
- Aggressive (P/L >= 0): trailingBuyActivationPercent=0%, profitRequirement=10%
- Requires 3 consecutive days before switching (hysteresis)
- Cannot be array in batch mode

#### Response Format

```json
{
  "success": true,
  "data": {
    "totalReturn": 125.5,
    "sharpeRatio": 1.8,
    "profileMetrics": {
      "enabled": true,
      "totalSwitches": 5,
      "daysInConservative": 45,
      "daysInAggressive": 207,
      "conservativePercent": 17.86,
      "aggressivePercent": 82.14,
      "switchHistory": [
        {
          "date": "2024-01-15",
          "from": "AGGRESSIVE",
          "to": "CONSERVATIVE",
          "pnl": -2500,
          "consecutiveDays": 3
        }
      ],
      "finalProfile": "AGGRESSIVE"
    }
  }
}
```
```

**Acceptance Criteria**:
- Complete API documentation
- Working curl examples
- Clear parameter descriptions

---

### Task 4.3: User Documentation
**File**: `docs/dynamic-profile-switching.md` (new file)
**Estimated Time**: 3 hours

- [ ] Write user guide: What is dynamic profile switching?
- [ ] Write user guide: When to use it?
- [ ] Write user guide: How profiles work?
- [ ] Write user guide: What parameters are overridden?
- [ ] Add examples with real backtests
- [ ] Add performance comparison data
- [ ] Add FAQ section

**Sections**:
1. **Overview**: What is dynamic profile switching?
2. **Profile Definitions**: Conservative vs Aggressive
3. **Hysteresis**: Why 3-day requirement?
4. **Use Cases**: When should I enable this?
5. **Performance**: Impact on drawdown and returns
6. **Examples**: Real backtest comparisons
7. **FAQ**: Common questions

**Acceptance Criteria**:
- Complete user guide
- Clear examples
- Covers all use cases

---

### Task 4.4: Developer Documentation
**File**: `docs/dev/dynamic-profile-implementation.md` (new file)
**Estimated Time**: 2 hours

- [ ] Document implementation details
- [ ] Document profile determination logic
- [ ] Document hysteresis algorithm
- [ ] Document metrics calculation
- [ ] Document testing strategy
- [ ] Add code examples

**Acceptance Criteria**:
- Developers can understand implementation
- Future maintainers can modify safely
- Edge cases documented

---

## Phase 5: Validation & Rollout

### Task 5.1: Backward Compatibility Validation
**File**: `backend/tests/backwardCompatibility.test.js`
**Estimated Time**: 2 hours

- [ ] Run entire existing test suite
- [ ] Verify 0 differences when feature disabled
- [ ] Create automated regression test
- [ ] Test with multiple symbols (PLTR, TSLA, AAPL)
- [ ] Test with different date ranges

**Acceptance Criteria**:
- All existing tests pass
- No regressions detected
- Results identical when disabled

---

### Task 5.2: Performance Benchmarks
**File**: `backend/benchmarks/dynamicProfile.benchmark.js` (new file)
**Estimated Time**: 2 hours

- [ ] Benchmark baseline (feature disabled)
- [ ] Benchmark with dynamic profile enabled
- [ ] Verify <1% overhead
- [ ] Create performance report

**Example Benchmark**:
```javascript
describe('Performance Benchmarks', () => {
  test('dynamic profile has negligible overhead', async () => {
    const params = {
      symbol: 'PLTR',
      startDate: '2021-01-01',
      endDate: '2024-12-31',
      lotSizeUsd: 10000,
      maxLots: 10
    };

    // Baseline
    const start1 = Date.now();
    await runDCABacktest({ ...params, enableDynamicProfile: false });
    const time1 = Date.now() - start1;

    // With profile switching
    const start2 = Date.now();
    await runDCABacktest({ ...params, enableDynamicProfile: true });
    const time2 = Date.now() - start2;

    const overhead = (time2 - time1) / time1;
    expect(overhead).toBeLessThan(0.01);  // Less than 1% overhead
  });
});
```

**Acceptance Criteria**:
- Benchmarks complete
- Performance targets met (<1% overhead)
- Report generated

---

### Task 5.3: Beta Testing
**Duration**: 1 week
**Estimated Time**: Ongoing monitoring

- [ ] Deploy to staging environment
- [ ] Invite 5-10 beta testers
- [ ] Collect feedback
- [ ] Monitor for bugs
- [ ] Fix critical issues
- [ ] Iterate on UX based on feedback

**Acceptance Criteria**:
- Beta testers can use feature
- No critical bugs reported
- Feedback incorporated

---

### Task 5.4: Production Deployment
**Estimated Time**: 2 hours

- [ ] Create deployment checklist
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Monitor error logs (first 24 hours)
- [ ] Monitor performance metrics
- [ ] Create support documentation for issues

**Acceptance Criteria**:
- Successful deployment
- No errors in production
- Performance acceptable
- Support ready

---

## Risk Mitigation

### High Risk Items

**1. Profile Thrashing (Rapid Switching)**
- **Risk**: P/L oscillates around 0, causing frequent switches
- **Mitigation**: 3-day hysteresis (Task 1.4)
- **Fallback**: Add emergency limit (max 10 switches per backtest)
- **Monitoring**: Track switch count, alert if >10

**2. Backward Compatibility Break**
- **Risk**: Feature changes existing behavior when disabled
- **Mitigation**: Extensive regression testing (Task 5.1)
- **Fallback**: Feature flags to disable remotely
- **Monitoring**: Automated tests on every commit

### Medium Risk Items

**3. User Confusion (Parameter Override Behavior)**
- **Risk**: Users don't understand parameter overrides
- **Mitigation**: Clear tooltips, warnings, documentation (Tasks 4.1, 4.3)
- **Fallback**: Add "current profile" indicator in UI
- **Monitoring**: User feedback collection

**4. Performance Validation (Does it help?)**
- **Risk**: Feature doesn't improve results
- **Mitigation**: Benchmark on multiple symbols/timeframes (Task 3.2)
- **Fallback**: Make feature opt-in (already is!)
- **Monitoring**: Performance metrics in production

### Low Risk Items

**5. Implementation Bugs**
- **Risk**: Edge cases missed
- **Mitigation**: Comprehensive unit tests (Tasks 1.6, 2.4, 3.3)
- **Fallback**: Beta testing period
- **Monitoring**: Error tracking

---

## Success Criteria

### Must Have (P0)
- ✅ Profile switching works correctly with 3-day hysteresis
- ✅ Parameter overrides apply/restore properly
- ✅ Transaction log shows all switches
- ✅ Metrics calculation accurate
- ✅ Backward compatible when disabled
- ✅ UI checkbox and tooltip
- ✅ Complete documentation

### Should Have (P1)
- ✅ Reduces max drawdown by 10%+ (validated on multiple symbols)
- ✅ Performance comparison tool (before/after)
- ✅ Profile history display in UI
- ✅ Beta tested by 5+ users

### Nice to Have (P2)
- ⭕ Configurable hysteresis days (Phase 2 enhancement)
- ⭕ Custom profile definitions (Phase 2 enhancement)
- ⭕ Real-time profile indicator in UI
- ⭕ Profile switch email alerts

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Core Logic | Week 1 | Profile determination & switching |
| Phase 2: Metrics & Logging | Week 2 | Transaction logs, metrics |
| Phase 3: Integration & Testing | Week 3 | Full testing, validation |
| Phase 4: UI & Docs | Concurrent | Complete user-facing features |
| Phase 5: Validation | Ongoing | Testing, beta, deployment |
| **Total** | **3 weeks** | **Production-ready feature** |

---

## Dependencies

### Internal
- Current DCA backtest service (stable)
- Frontend parameter UI (requires updates)
- Batch test infrastructure (requires validation updates)

### External
- None (all internal changes)

### Team
- Product Owner: Review specifications and answer open questions
- QA: Test all scenarios
- DevOps: Deploy staging for beta

---

## Open Questions (for Product Owner)

1. **Hysteresis Duration**: Confirmed 3 days? Or should it be 5 days?
2. **Active Orders**: Confirmed preserve (don't cancel) when profile switches?
3. **Profile Parameter Scope**: Confirmed only buy/sell params (not grid/trailing)?
4. **Starting Profile**: Confirmed NULL → determine on Day 1 based on P/L?
5. **Cooldown Period**: Do we need a limit on switches (e.g., once per week)?

**Recommendation**: Schedule 30-minute decision meeting before Phase 1.

---

## Notes

- This spec is **independent** of Spec 23 (Average-Cost features)
- Can be implemented **before, after, or in parallel** with Spec 23
- Can be used **with or without** average-cost features
- **Timeline**: 3 weeks after Spec 23, or can be done in parallel if resources allow
