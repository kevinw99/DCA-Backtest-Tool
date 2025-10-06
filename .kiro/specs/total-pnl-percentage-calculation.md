# Total P&L Percentage Calculation

## Overview

The Total P&L % metric is calculated differently in two places in the application, for different purposes:

1. **Price Chart with Transaction Markers**: Uses **Maximum Capital Ever Deployed** methodology
2. **Enhanced Transaction History Table**: Uses **Current Capital Deployed** methodology

## Methodology Details

### Chart: Maximum Capital Ever Deployed

**Formula:**

```
Total P&L % = (Total P&L / Maximum Capital Ever Deployed) × 100
```

**Where:**

- `Total P&L` = Realized P&L + Unrealized P&L (from transaction data)
- `Maximum Capital Ever Deployed` = Peak number of lots deployed × lot size USD
  - Tracked continuously throughout the backtest
  - Example: If you deployed 1→2→3→4→3→2 lots, max = 4 lots = $40,000

**Why This Method:**

- ✅ **Continuous**: No discontinuous jumps when lot count changes
- ✅ **Realistic**: Cannot exceed -100% in a long-only strategy (no margin)
- ✅ **Fair**: Shows worst-case scenario if all capital deployed at peak is lost
- ✅ **Smooth chart**: Provides clean, interpretable visualization

**Example:**

| Day | Event      | Total P&L | Current Lots | Max Lots | Chart P&L %                      |
| --- | ---------- | --------- | ------------ | -------- | -------------------------------- |
| 1   | Buy #1     | -$500     | 1            | 1        | -500 / 10,000 = **-5%**          |
| 2   | Buy #2     | -$1,200   | 2            | 2        | -1,200 / 20,000 = **-6%**        |
| 3   | Buy #3     | -$2,500   | 3            | 3        | -2,500 / 30,000 = **-8.3%**      |
| 4   | Buy #4     | -$4,000   | 4            | 4        | -4,000 / 40,000 = **-10%**       |
| 5   | Sell #1    | -$3,000   | 3            | **4**    | -3,000 / **40,000** = **-7.5%**  |
| 6   | Price drop | -$5,000   | 3            | **4**    | -5,000 / **40,000** = **-12.5%** |

**Key observations:**

- Days 1-4: Max capital increases with each buy
- Day 5: After sell, **still use max = 4 lots = $40,000** (not current 3 lots)
- Day 6: Denominator remains $40,000, providing continuity
- Chart is smooth - no jumps when lot count changes

### Table: Current Capital Deployed

**Formula:**

```
Total P&L % = (Total P&L / Current Capital Deployed) × 100
```

**Where:**

- `Total P&L` = Realized P&L + Unrealized P&L (same as chart)
- `Current Capital Deployed` = Current number of lots × lot size USD

**Why This Method:**

- ✅ **Accurate snapshot**: Shows actual return on capital currently at risk
- ✅ **Matches transaction state**: Directly corresponds to "Lots" column
- ✅ **Standard finance metric**: How returns are typically reported
- ✅ **Row-by-row accuracy**: Each row's percentage is independently correct

**Example (same data as above):**

| Day | Event      | Total P&L | Current Lots | Current Capital | Table P&L %                  |
| --- | ---------- | --------- | ------------ | --------------- | ---------------------------- |
| 1   | Buy #1     | -$500     | 1            | $10,000         | -500 / 10,000 = **-5%**      |
| 2   | Buy #2     | -$1,200   | 2            | $20,000         | -1,200 / 20,000 = **-6%**    |
| 3   | Buy #3     | -$2,500   | 3            | $30,000         | -2,500 / 30,000 = **-8.3%**  |
| 4   | Buy #4     | -$4,000   | 4            | $40,000         | -4,000 / 40,000 = **-10%**   |
| 5   | Sell #1    | -$3,000   | 3            | $30,000         | -3,000 / 30,000 = **-10%**   |
| 6   | Price drop | -$5,000   | 3            | $30,000         | -5,000 / 30,000 = **-16.7%** |

**Key observations:**

- Day 5: **Discontinuity** - percentage stays -10% despite improved P&L because denominator decreased
- Day 6: Uses current 3 lots ($30,000), not historical max
- Each row shows exact return on that specific portfolio state

## Why Different Methods?

**Chart Purpose**: Visualization of performance trends over time

- Needs smooth, continuous lines
- Focuses on overall strategy performance
- Shows performance relative to worst-case capital deployment

**Table Purpose**: Detailed transaction analysis

- Needs exact per-transaction accuracy
- Shows return on capital actually at risk at each moment
- Standard accounting/finance view

## Real-World Example

**Your 2/23/2022 TDOC backtest:**

| Metric      | Chart                              | Table                         |
| ----------- | ---------------------------------- | ----------------------------- |
| Total P&L   | -$14,915.79                        | -$14,915.79                   |
| Denominator | Max deployed: 6 lots = **$60,000** | Current: 6 lots = **$60,000** |
| Total P&L % | **-24.86%**                        | **-24.86%**                   |

_Note: They match here because you're at peak deployment (6 lots)_

**Later if you sell down to 3 lots with -$12,000 loss:**

| Metric      | Chart                              | Table                         |
| ----------- | ---------------------------------- | ----------------------------- |
| Total P&L   | -$12,000                           | -$12,000                      |
| Denominator | Max deployed: **6 lots = $60,000** | Current: **3 lots = $30,000** |
| Total P&L % | **-20%** (smooth)                  | **-40%** (jump)               |

_Chart shows continuous improvement, table shows accurate snapshot_

## Advantages of This Approach

### Chart Benefits

1. **Cannot exceed -100%**: Impossible values eliminated
2. **Smooth visualization**: No jarring discontinuities
3. **Conservative**: Shows performance against worst-case capital allocation
4. **Comparable**: Easier to compare different backtests

### Table Benefits

1. **Precision**: Exact return on current position
2. **Standard metric**: Matches industry conventions
3. **Decision-making**: Shows actual risk exposure
4. **Audit trail**: Each transaction's impact is clear

## Edge Cases

### No Lots Deployed (Start of backtest)

- Chart: 0% (no capital deployed yet)
- Table: N/A or 0%

### All Lots Sold (Reset to 0)

- Chart: Still uses historical max capital as denominator
- Table: N/A or 0% (no current capital)

### Maximum Loss (-100%)

- Chart: Can hit -100% if all holdings go to $0
- Table: Can hit -100% if all holdings go to $0

Both methods respect the physical limit of -100% for long-only strategies.

## Summary

| Aspect            | Chart                         | Table                    |
| ----------------- | ----------------------------- | ------------------------ |
| **Denominator**   | Maximum capital ever deployed | Current capital deployed |
| **Continuity**    | Smooth, continuous            | Discontinuous at sells   |
| **Purpose**       | Performance visualization     | Transaction accuracy     |
| **Conservative**  | Yes (uses peak)               | No (uses actual)         |
| **Standard**      | Strategy-level returns        | Position-level returns   |
| **Cannot exceed** | -100%                         | -100%                    |

Both methods are correct for their respective purposes. The chart prioritizes smooth visualization, while the table prioritizes exact accounting accuracy.
