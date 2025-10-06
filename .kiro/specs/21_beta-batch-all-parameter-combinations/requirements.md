# Spec #21: Beta Batch - All Parameter Combinations

## Problem
When Beta scaling is enabled in batch backtests, only 3 results are generated instead of all parameter combinations. The code was only using the FIRST value `[0]` of each parameter array instead of iterating through all combinations.

### Example Bug
With these parameters:
- coefficients: [1, 0.25, 0.5] (3 values)
- profitRequirement: [0.10, 0.05] (2 values)
- gridIntervalPercent: [0.10, 0.05] (2 values)
- Other arrays with 2 values each

**Expected**: 3 × 2 × 2 × 2 × 2 × 1 × 2 = 192 combinations
**Actual (buggy)**: 3 × 1 × 1 × 1 × 1 × 1 × 1 = 3 combinations

## Root Cause
In `batchBacktestService.js` lines 87-144, the Beta scaling path only iterated through `coefficients` and `maxLotsToSell`, using hardcoded `[0]` index for all other parameters:

```javascript
const baseParams = {
  profitRequirement: profitRequirement[0],  // ❌ Only first value
  gridIntervalPercent: gridIntervalPercent[0],  // ❌ Only first value
  // ...all other params using [0]
};
```

## Solution
Add nested loops for ALL parameters (like the non-Beta path does), iterating through:
- coefficient
- maxLotsToSell
- profitRequirement
- gridIntervalPercent
- trailingBuyActivationPercent
- trailingBuyReboundPercent
- trailingSellActivationPercent
- trailingSellPullbackPercent
- dynamicGridMultiplier

Each combination gets Beta scaling applied to its base parameters.

## Success Criteria
- Beta batch tests generate all parameter combinations (not just 3)
- UI correctly shows top 10 for single stock, top 5 per stock for multiple
- Results are properly sorted by Total Return %
