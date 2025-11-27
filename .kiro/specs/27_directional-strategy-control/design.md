# Spec 27: Directional Strategy Control - Design Document

## Overview

This specification introduces two new boolean flags that provide fine-grained control over directional trading behavior in the DCA strategy. These flags act as secondary controls under their parent feature flags, allowing users to choose between traditional downtrend-only/uptrend-only behavior (Specs 17/18) and adaptive momentum/stop-loss behavior (Spec 25).

## Architecture

### Hierarchical Flag System

```
enableConsecutiveIncrementalBuyGrid (Spec 17)
  └─ enableAdaptiveTrailingBuy (Spec 27)
     ├─ false → Traditional: downtrend buys only (Spec 17)
     └─ true  → Adaptive: momentum uptrend buys (Spec 25)

enableConsecutiveIncrementalSellProfit (Spec 18)
  └─ enableAdaptiveTrailingSell (Spec 27)
     ├─ false → Traditional: uptrend sells only (Spec 18)
     └─ true  → Adaptive: stop-loss downtrend sells (Spec 25)
```

### Key Design Principles

1. **Backward Compatibility**: Default values (both false) preserve existing Spec 17/18 traditional behavior
2. **Parent Flag Dependency**: New flags only take effect when parent flags are enabled
3. **Direction-Based Blocking**: When adaptive flags are disabled, trades in the non-traditional direction are blocked with clear logging
4. **Consistent Integration**: Flags work identically in single-backtest and batch-backtest modes

## Data Flow

### Request Pipeline

```
Frontend (DCABacktestForm.js)
  └─ User sets checkbox values
     └─ Parameters sent to backend API

Backend (server.js)
  └─ Extract parameters from request
     └─ Validate boolean types (validation.js)
        └─ Pass to dcaBacktestService.js

Service (dcaBacktestService.js)
  └─ Log initial strategy mode
     └─ Pass to adaptive parameter calculations
        └─ Block or allow based on direction + flags
```

### Adaptive Parameter Calculation

In `calculateAdaptiveBuyParameters` and `calculateAdaptiveSellParameters`:

```javascript
// Buy logic
if (isUptrend) {
  if (!enableAdaptiveTrailingBuy) {
    // BLOCK uptrend buy
    return { direction: 'up_blocked_spec27' };
  }
  // ALLOW adaptive uptrend buy (Spec 25)
}

// Sell logic
if (isDowntrend) {
  if (!enableAdaptiveTrailingSell) {
    // BLOCK downtrend sell
    return { direction: 'down_blocked_spec27' };
  }
  // ALLOW adaptive downtrend sell (Spec 25)
}
```

## Component Integration

### Backend Components

#### 1. Validation (`backend/middleware/validation.js`)

**Purpose**: Ensure boolean type correctness

**Implementation**:
```javascript
// Spec 27: Directional strategy control flags (optional)
const { enableAdaptiveTrailingBuy, enableAdaptiveTrailingSell } = req.body;
if (enableAdaptiveTrailingBuy !== undefined && typeof enableAdaptiveTrailingBuy !== 'boolean') {
  throw new Error('enableAdaptiveTrailingBuy must be boolean');
}
if (enableAdaptiveTrailingSell !== undefined && typeof enableAdaptiveTrailingSell !== 'boolean') {
  throw new Error('enableAdaptiveTrailingSell must be boolean');
}
```

#### 2. Service Logic (`backend/services/dcaBacktestService.js`)

**Purpose**: Implement direction-based blocking/allowing

**Key Functions Modified**:
- `runDCABacktest` - Added parameters with defaults (false)
- `calculateAdaptiveBuyParameters` - Added uptrend blocking logic
- `calculateAdaptiveSellParameters` - Added downtrend blocking logic

**Blocking Behavior**:
```javascript
// When blocked, return object with:
{
  activation,
  rebound/pullback,
  isAdaptive: false,
  direction: 'up_blocked_spec27' or 'down_blocked_spec27',
  blockReason: 'traditional_downtrend_only' or 'traditional_uptrend_only'
}
```

**Logging**:
```javascript
// Initial configuration
if (enableAdaptiveTrailingBuy) {
  console.log(`📈 Buy Direction: ADAPTIVE (Spec 25) - allows uptrend buys`);
} else {
  console.log(`📉 Buy Direction: TRADITIONAL (Spec 17) - downtrend only`);
}

// During execution
if (direction === 'up_blocked_spec27') {
  console.log(`🚫 BUY BLOCKED (Spec 27): Price rising but enableAdaptiveTrailingBuy=false`);
}
```

#### 3. Route Handler (`backend/server.js`)

**Purpose**: Extract and pass parameters

**Implementation**:
```javascript
// Extraction
const {
  enableAdaptiveTrailingBuy,
  enableAdaptiveTrailingSell
} = params;

// Passing to service
await runDCABacktest({
  ...otherParams,
  enableAdaptiveTrailingBuy: finalParams.enableAdaptiveTrailingBuy,
  enableAdaptiveTrailingSell: finalParams.enableAdaptiveTrailingSell
});
```

#### 4. Batch Backtest (`backend/services/batchBacktestService.js`)

**Purpose**: Support flags in batch mode

**Integration Points**:
1. Default parameter extraction (lines 54-55)
2. Beta scaling combinations (lines 143-144)
3. Non-Beta scaling combinations (lines 204-205)
4. Function parameters (lines 275-276)
5. Merged parameter ranges (lines 293-294)
6. Frontend URL generation (lines 495-496)
7. Batch request parameters (lines 662-663)

### Frontend Components

#### 1. Parameter Form (`frontend/src/components/DCABacktestForm.js`)

**Default Values** (lines 96-97):
```javascript
enableAdaptiveTrailingBuy: false,
enableAdaptiveTrailingSell: false,
```

**URL Parameter Mappings** (lines 399-400):
```javascript
enableAdaptiveTrailingBuy: (value) => value === 'true' || value === true,
enableAdaptiveTrailingSell: (value) => value === 'true' || value === true,
```

**CommonParams List** (lines 441-442):
```javascript
'enableAdaptiveTrailingBuy', 'enableAdaptiveTrailingSell',
```

**UI Checkboxes**:

Buy Checkbox (lines 1972-1984):
```javascript
{parameters.enableConsecutiveIncrementalBuyGrid && (
  <div className="form-group checkbox-group" style={{ marginLeft: '20px' }}>
    <label>
      <input
        type="checkbox"
        checked={parameters.enableAdaptiveTrailingBuy ?? false}
        onChange={(e) => handleChange('enableAdaptiveTrailingBuy', e.target.checked)}
      />
      Enable Adaptive Uptrend Buys (Spec 25)
    </label>
    <span className="form-help">
      When enabled: Allow momentum buys when price rises (Spec 25).
      When disabled: Only buy on downtrends (Spec 17 traditional)
    </span>
  </div>
)}
```

Sell Checkbox (lines 2002-2017):
```javascript
{parameters.enableConsecutiveIncrementalSellProfit && (
  <div className="form-group checkbox-group" style={{ marginLeft: '20px' }}>
    <label>
      <input
        type="checkbox"
        checked={parameters.enableAdaptiveTrailingSell ?? false}
        onChange={(e) => handleChange('enableAdaptiveTrailingSell', e.target.checked)}
      />
      Enable Adaptive Downtrend Sells (Spec 25)
    </label>
    <span className="form-help">
      When enabled: Allow stop-loss sells when price falls (Spec 25).
      When disabled: Only sell on uptrends (Spec 18 traditional)
    </span>
  </div>
)}
```

## Strategy Combinations

### Four Distinct Behaviors

| Buy Flag | Sell Flag | Strategy Description |
|----------|-----------|---------------------|
| false | false | **Traditional DCA** (Specs 17+18): Downtrend buys only, uptrend sells only |
| true | false | **Momentum Buy + Traditional Sell**: Uptrend momentum buys (Spec 25), uptrend sells only |
| false | true | **Traditional Buy + Stop Loss**: Downtrend buys only, downtrend stop-loss sells (Spec 25) |
| true | true | **Full Adaptive** (Spec 25): Momentum uptrend buys, stop-loss downtrend sells |

## Testing Strategy

### Backend Testing

**Test 1: Traditional Mode (flags=false)**
```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "TSLA",
    "startDate": "2021-09-01",
    "endDate": "2025-10-09",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "enableConsecutiveIncrementalBuyGrid": true,
    "enableConsecutiveIncrementalSellProfit": true,
    "enableAdaptiveTrailingBuy": false,
    "enableAdaptiveTrailingSell": false
  }'
```

**Expected**:
- Log: "📉 Buy Direction: TRADITIONAL (Spec 17) - downtrend only"
- Log: "📉 Sell Direction: TRADITIONAL (Spec 18) - uptrend only"
- Uptrend buys blocked with "🚫 BUY BLOCKED (Spec 27)"
- Downtrend sells blocked with "🚫 SELL BLOCKED (Spec 27)"

**Test 2: Adaptive Mode (flags=true)**
```bash
# Same as Test 1 but with:
    "enableAdaptiveTrailingBuy": true,
    "enableAdaptiveTrailingSell": true
```

**Expected**:
- Log: "📈 Buy Direction: ADAPTIVE (Spec 25) - allows uptrend buys"
- Log: "📈 Sell Direction: ADAPTIVE (Spec 25) - allows downtrend sells"
- Uptrend buys allowed with adaptive logic
- Downtrend sells allowed with adaptive logic

### Frontend Testing

1. **UI Display**: Checkboxes only appear when parent flags are enabled
2. **Indentation**: Checkboxes display with 20px left margin
3. **Help Text**: Clear explanation of behavior in both states
4. **URL Sync**: Parameters correctly added to shareable URL
5. **State Management**: Checkbox state persists across form interactions

### Batch Mode Testing

1. **Parameter Matrix**: Flags correctly expanded in batch combinations
2. **URL Generation**: Frontend URLs include both flags
3. **Results Display**: Batch results correctly show flag states
4. **Beta Scaling**: Flags work with both Beta and non-Beta modes

## Performance Considerations

### Minimal Overhead

- **Boolean checks**: O(1) operation on every buy/sell evaluation
- **No state tracking**: Flags don't maintain additional state
- **Early exit**: Blocked trades exit immediately without further processing

### Logging Impact

- **Development**: Verbose logging helps debugging
- **Production**: Can be reduced or removed for performance

## Error Handling

### Validation Errors

```javascript
// Type validation
if (typeof enableAdaptiveTrailingBuy !== 'boolean') {
  throw new Error('enableAdaptiveTrailingBuy must be boolean');
}
```

### Default Handling

```javascript
// Missing values default to false (traditional behavior)
enableAdaptiveTrailingBuy = false
enableAdaptiveTrailingSell = false
```

## Future Extensions

### Potential Enhancements

1. **Partial Direction Control**: Allow trades in opposite direction but with different parameters
2. **Time-Based Switching**: Toggle flags based on time of day or market volatility
3. **Dynamic Adjustment**: Auto-adjust flags based on recent performance
4. **Portfolio-Level Control**: Different direction settings per symbol in batch mode
5. **Analytics**: Track performance differences between traditional and adaptive modes

## Related Specifications

- **Spec 17**: Consecutive Incremental Buy Grid (parent for buy flag)
- **Spec 18**: Revised Consecutive Incremental Sell Profit (parent for sell flag)
- **Spec 25**: Adaptive Trailing Stops (enabled when flags are true)
- **Spec 26**: Position-Based Adaptive Behavior (orthogonal gating mechanism)

## Completion Status

✅ **100% Complete**

All implementation tasks finished:
- Backend validation, service logic, and route handling
- Frontend UI checkboxes and parameter management
- Batch mode integration
- Comprehensive testing
- Documentation (requirements, design, tasks)
