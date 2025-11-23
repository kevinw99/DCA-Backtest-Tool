# Spec 61: Optimized Total Capital for Portfolio Backtest

## Problem Statement

Currently in portfolio backtest mode, users must manually specify a `totalCapital` value. This leads to two common issues:

1. **Over-allocation**: User specifies more capital than needed, resulting in unused cash sitting idle
2. **Under-allocation**: User specifies less capital than needed, resulting in rejected buy orders due to capital constraints

This makes it difficult to:
- Fairly compare DCA strategy vs Buy & Hold (different effective capital bases)
- Determine how much capital is actually needed for a given strategy
- Understand the true performance potential of the strategy

## User Requirements

### REQ-1: Optimized Capital Mode Parameter
- Add a new boolean parameter `optimizedTotalCapital` (default: `false`)
- When `true`, the engine automatically calculates the optimal total capital

### REQ-2: Auto-Calculate Optimal Capital
- Run an initial simulation to track the maximum deployed capital at any point
- Use this peak deployed capital as the "optimized total capital"
- Re-run the backtest with this optimized capital value

### REQ-3: Fair Buy & Hold Comparison
- When optimized capital mode is enabled, use the same optimized total capital for Buy & Hold calculation
- This ensures both DCA and Buy & Hold strategies are compared on equal capital footing

### REQ-4: Capital Utilization Metrics
- Report the optimized total capital value in results
- Report capital utilization percentage (average deployed / total capital)
- Report peak capital usage date

### REQ-5: Variant Analysis (Phase 2)
- Support running multiple simulations with different capital levels:
  - 100% of optimal (zero rejections)
  - 90% of optimal (some rejections)
  - 80% of optimal (more rejections)
- Show how performance metrics change with capital constraints

## Technical Requirements

### API Changes

#### Portfolio Backtest Endpoint
```javascript
// New parameter in request body
{
  // ... existing params
  "optimizedTotalCapital": true  // New boolean parameter
}
```

#### Response Additions
```javascript
{
  "data": {
    // ... existing fields
    "capitalAnalysis": {
      "userSpecifiedCapital": 300000,      // Original input (if provided)
      "optimizedCapital": 185000,           // Auto-calculated optimal
      "peakDeployedCapital": 185000,        // Maximum capital used
      "peakCapitalDate": "2022-10-15",      // When peak occurred
      "averageDeployedCapital": 142500,     // Average over period
      "capitalUtilization": 0.77,           // avg/optimized as decimal
      "rejectedOrderCount": 0               // Orders rejected due to capital
    }
  }
}
```

### Algorithm Overview

1. **Discovery Run** (when `optimizedTotalCapital: true`):
   - Run backtest with unlimited capital (or very high value like 10x user input)
   - Track `maxDeployedCapital` throughout the simulation
   - Record the date when peak occurred

2. **Optimization Run**:
   - Set `totalCapital = maxDeployedCapital` from discovery run
   - Re-run the backtest with this optimized value
   - Should result in zero (or minimal) rejected orders

3. **Buy & Hold Alignment**:
   - Calculate Buy & Hold metrics using the same optimized capital
   - Allocate capital proportionally across stocks (same as DCA allocation)

## Success Criteria

1. When `optimizedTotalCapital: true`, the backtest results in zero rejected orders
2. Buy & Hold comparison uses identical capital to DCA
3. Capital utilization metrics are accurate and included in response
4. Backward compatible - default behavior unchanged when parameter is `false`
5. Performance acceptable (max 2x runtime for optimized mode vs standard mode)

## Out of Scope

- Real-time capital optimization during simulation
- Multi-iteration optimization loops
- Frontend UI changes (will be separate spec)
