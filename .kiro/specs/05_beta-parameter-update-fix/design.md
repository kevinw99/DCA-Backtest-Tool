# Design Document

## Overview

This design addresses the Beta parameter scaling implementation issues by fixing the infinite useEffect loops, ensuring adjusted parameters actually update the form inputs, and adding proper localStorage persistence for the Beta scaling preference. The solution focuses on proper state management, dependency handling, and parameter synchronization.

## Architecture

### State Management Flow

```
User Toggles Beta Scaling
    ↓
enableBetaScaling state updates
    ↓
localStorage persistence
    ↓
calculateAdjustedParameters (if enabled)
    ↓
API call to get beta-adjusted values
    ↓
Update form parameters with adjusted values
    ↓
UI reflects beta-scaled parameters
```

### Component State Structure

```javascript
// Core Beta states
const [enableBetaScaling, setEnableBetaScaling] = useState(false);
const [beta, setBeta] = useState(1.0);
const [coefficient, setCoefficient] = useState(1.0);
const [betaFactor, setBetaFactor] = useState(1.0);

// Parameter states
const [baseParameters, setBaseParameters] = useState({});
const [adjustedParameters, setAdjustedParameters] = useState({});
const [parameters, setParameters] = useState({...}); // Form parameters
```

## Components and Interfaces

### localStorage Integration

#### Beta Scaling Persistence

```javascript
// Initialize from localStorage
const [enableBetaScaling, setEnableBetaScaling] = useState(() => {
  const saved = localStorage.getItem('dca-enable-beta-scaling');
  return saved === 'true';
});

// Persist changes
useEffect(() => {
  localStorage.setItem('dca-enable-beta-scaling', enableBetaScaling.toString());
}, [enableBetaScaling]);
```

### Parameter Update Logic

#### Fixed useEffect Dependencies

```javascript
// Separate effects to avoid circular dependencies
useEffect(() => {
  if (enableBetaScaling && beta && strategyMode === 'long') {
    calculateAdjustedParameters();
  } else {
    resetToBaseParameters();
  }
}, [enableBetaScaling, beta, coefficient, strategyMode]); // Remove parameters from deps
```

#### Parameter Application

```javascript
const applyAdjustedParameters = adjustedParams => {
  if (!adjustedParams || !enableBetaScaling) return;

  setParameters(prev => ({
    ...prev,
    profitRequirement: (adjustedParams.profitRequirement || 0.05) * 100,
    gridIntervalPercent: (adjustedParams.gridIntervalPercent || 0.1) * 100,
    trailingBuyActivationPercent: (adjustedParams.trailingBuyActivationPercent || 0.1) * 100,
    trailingBuyReboundPercent: (adjustedParams.trailingBuyReboundPercent || 0.05) * 100,
    trailingSellActivationPercent: (adjustedParams.trailingSellActivationPercent || 0.2) * 100,
    trailingSellPullbackPercent: (adjustedParams.trailingSellPullbackPercent || 0.1) * 100,
  }));
};
```

### Base Parameter Management

#### Base Parameter Storage

```javascript
const storeBaseParameters = () => {
  if (!enableBetaScaling) {
    // Store current parameters as base when scaling is disabled
    const baseParams = {
      profitRequirement: parameters.profitRequirement / 100,
      gridIntervalPercent: parameters.gridIntervalPercent / 100,
      trailingBuyActivationPercent: parameters.trailingBuyActivationPercent / 100,
      trailingBuyReboundPercent: parameters.trailingBuyReboundPercent / 100,
      trailingSellActivationPercent: parameters.trailingSellActivationPercent / 100,
      trailingSellPullbackPercent: parameters.trailingSellPullbackPercent / 100,
    };
    setBaseParameters(baseParams);
  }
};
```

#### Parameter Reset Logic

```javascript
const resetToBaseParameters = () => {
  if (Object.keys(baseParameters).length > 0) {
    setParameters(prev => ({
      ...prev,
      profitRequirement: baseParameters.profitRequirement * 100,
      gridIntervalPercent: baseParameters.gridIntervalPercent * 100,
      trailingBuyActivationPercent: baseParameters.trailingBuyActivationPercent * 100,
      trailingBuyReboundPercent: baseParameters.trailingBuyReboundPercent * 100,
      trailingSellActivationPercent: baseParameters.trailingSellActivationPercent * 100,
      trailingSellPullbackPercent: baseParameters.trailingSellPullbackPercent * 100,
    }));
  }
  setAdjustedParameters({});
};
```

## Data Models

### Beta State Model

```typescript
interface BetaState {
  enableBetaScaling: boolean; // User preference (persisted)
  beta: number; // Stock beta value
  coefficient: number; // User-adjustable multiplier
  betaFactor: number; // Calculated: beta * coefficient
  baseParameters: ParameterSet; // Original parameter values
  adjustedParameters: ParameterSet; // Beta-scaled parameter values
}

interface ParameterSet {
  profitRequirement: number;
  gridIntervalPercent: number;
  trailingBuyActivationPercent: number;
  trailingBuyReboundPercent: number;
  trailingSellActivationPercent: number;
  trailingSellPullbackPercent: number;
}
```

### localStorage Schema

```javascript
// Keys used for persistence
'dca-enable-beta-scaling': 'true' | 'false'
'dca-single-parameters': JSON // Includes current parameter values
'dca-base-parameters': JSON   // Stores original values before beta scaling
```

## Error Handling

### Infinite Loop Prevention

- **Dependency Management**: Remove `parameters` from useEffect dependencies that update parameters
- **State Isolation**: Separate parameter calculation from parameter application
- **Async Handling**: Ensure async operations don't trigger additional effects

### Parameter Validation

- **Range Checking**: Validate adjusted parameters are within reasonable bounds
- **Fallback Values**: Provide safe defaults when calculations fail
- **User Warnings**: Alert users when beta adjustments create extreme values

### localStorage Robustness

- **Parse Safety**: Handle corrupted localStorage data gracefully
- **Migration**: Support users upgrading from versions without beta scaling persistence
- **Cleanup**: Remove invalid or outdated localStorage entries

## Testing Strategy

### Unit Tests

1. **Parameter Calculation**: Test beta-adjusted parameter calculations
2. **State Management**: Verify useEffect dependencies don't cause loops
3. **localStorage**: Test persistence and restoration of beta scaling preference
4. **Edge Cases**: Test with extreme beta values and coefficient combinations

### Integration Tests

1. **User Workflow**: Test complete enable/disable beta scaling flow
2. **Parameter Updates**: Verify form inputs update when beta scaling is toggled
3. **Session Persistence**: Test that preferences survive page reload
4. **API Integration**: Test parameter calculation API calls and responses

### Performance Tests

1. **Render Cycles**: Ensure no excessive re-renders when toggling beta scaling
2. **Memory Usage**: Verify no memory leaks from useEffect loops
3. **API Efficiency**: Test that parameter calculations don't cause excessive API calls

## Implementation Phases

### Phase 1: Fix Infinite Loops

- Remove problematic useEffect dependencies
- Separate parameter calculation from application
- Add proper async handling

### Phase 2: Implement Parameter Updates

- Create applyAdjustedParameters function
- Add base parameter storage and restoration
- Ensure form inputs reflect beta-scaled values

### Phase 3: Add localStorage Persistence

- Implement enableBetaScaling persistence
- Add base parameter storage to localStorage
- Handle migration from non-persisted versions

### Phase 4: Testing and Validation

- Add comprehensive test coverage
- Validate all user interaction scenarios
- Performance testing and optimization
