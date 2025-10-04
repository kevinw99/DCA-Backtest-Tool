# Design Document

## Overview

This design addresses the Beta Controls calculation and display issues by implementing proper coefficient handling, accurate β-Factor calculations, and clear data source indication. The solution focuses on fixing the mathematical calculations, improving prop management, and enhancing user experience with proper coefficient input controls.

## Architecture

### Component Structure

```
DCABacktestForm (Parent)
├── State Management
│   ├── beta (number)
│   ├── coefficient (number) - NEW
│   ├── betaFactor (number) - CALCULATED
│   ├── enableBetaScaling (boolean)
│   └── isManualBetaOverride (boolean)
└── BetaControls (Child)
    ├── Display Components
    ├── Calculation Logic
    └── Input Controls
```

### Data Flow

1. **Parent Component**: Manages beta, coefficient, and enableBetaScaling state
2. **Calculation Engine**: Computes betaFactor based on scaling state
3. **Child Component**: Receives calculated values and displays them accurately
4. **User Interactions**: Coefficient changes trigger recalculation cascade

## Components and Interfaces

### DCABacktestForm Enhancements

#### New State Variables

```javascript
const [coefficient, setCoefficient] = useState(1.0);
const [betaFactor, setBetaFactor] = useState(1.0);
```

#### Calculation Logic

```javascript
const calculateBetaFactor = (beta, coefficient, enableBetaScaling) => {
  return enableBetaScaling ? beta * coefficient : beta;
};
```

#### Props to BetaControls

```javascript
<BetaControls
  // Existing props...
  coefficient={coefficient}
  betaFactor={betaFactor}
  onCoefficientChange={setCoefficient}
/>
```

### BetaControls Component Updates

#### Coefficient Input Section

```javascript
<div className="coefficient-input">
  <label>Coefficient:</label>
  <input
    type="number"
    value={coefficient}
    onChange={handleCoefficientChange}
    step="0.1"
    min="0.1"
    max="5.0"
  />
</div>
```

#### Corrected Calculation Display

```javascript
<div className="calculation-result">
  <span>β-Factor: {betaFactor.toFixed(3)}</span>
  <span className="formula">
    = {beta.toFixed(2)} {enableBetaScaling ? `× ${coefficient.toFixed(2)}` : '(scaling disabled)'}
  </span>
</div>
```

### Data Source Enhancement

#### Beta Source Detection

```javascript
const determineBetaSource = apiResponse => {
  if (apiResponse.source === 'yahoo_finance') return 'Yahoo Finance';
  if (apiResponse.source === 'alpha_vantage') return 'Alpha Vantage';
  if (apiResponse.source === 'mock' || !apiResponse.source) return 'Mock Data';
  return 'API Default';
};
```

## Data Models

### Beta State Model

```typescript
interface BetaState {
  beta: number; // Raw beta value from API
  coefficient: number; // User-adjustable multiplier
  betaFactor: number; // Calculated: beta * coefficient (if scaling enabled) or beta
  enableBetaScaling: boolean; // Controls whether coefficient affects calculations
  isManualOverride: boolean; // Whether user manually set beta
  source: string; // Data source indicator
  lastUpdated: Date; // When beta was last fetched
}
```

### Calculation Parameters

```typescript
interface CalculationParams {
  baseMultipliers: {
    profitRequirementMultiplier: 0.05;
    gridIntervalMultiplier: 0.1;
    trailingBuyActivationMultiplier: 0.1;
    trailingBuyReboundMultiplier: 0.05;
    trailingSellActivationMultiplier: 0.2;
    trailingSellPullbackMultiplier: 0.1;
  };
  betaFactor: number;
  adjustedParameters: Record<string, number>;
}
```

## Error Handling

### Calculation Validation

- **Invalid Coefficient**: Validate coefficient is positive number between 0.1 and 5.0
- **NaN Prevention**: Check for NaN values in calculations and provide fallbacks
- **Extreme Values**: Warn when betaFactor results in extreme parameter values

### Data Source Fallbacks

- **API Failure**: Fall back to default beta = 1.0 with clear "Default Value" indication
- **Invalid Response**: Validate API response structure before using data
- **Network Issues**: Show loading states and error messages appropriately

## Testing Strategy

### Unit Tests

1. **Calculation Logic**: Test betaFactor calculation with various inputs
2. **State Management**: Verify state updates trigger correct recalculations
3. **Validation**: Test coefficient input validation and error handling
4. **Edge Cases**: Test with extreme beta values and coefficient combinations

### Integration Tests

1. **Component Communication**: Verify prop passing between parent and child
2. **User Interactions**: Test coefficient editing and beta scaling toggle
3. **API Integration**: Test beta data fetching and source indication
4. **Parameter Updates**: Verify dependent parameter recalculation

### Visual Tests

1. **Calculation Display**: Verify mathematical formulas show correct results
2. **Source Indication**: Test various data source scenarios
3. **Loading States**: Verify loading indicators during API calls
4. **Error States**: Test error message display and recovery

## Implementation Phases

### Phase 1: Fix Calculation Logic

- Add coefficient state to DCABacktestForm
- Implement proper betaFactor calculation
- Update BetaControls props

### Phase 2: Add Coefficient Input

- Create coefficient input field in BetaControls
- Add validation and change handlers
- Implement coefficient persistence

### Phase 3: Enhance Data Source Display

- Improve beta source detection
- Add clear mock data indication
- Enhance timestamp display

### Phase 4: Testing and Validation

- Add comprehensive test coverage
- Validate all calculation scenarios
- Test user interaction flows
