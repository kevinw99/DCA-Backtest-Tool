# Spec 43: Beta Scaling Centralization - Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
├─────────────────────────────────────────────────────────────┤
│  Components                                                  │
│  - Send base parameters only                                │
│  - Send beta config (enable, coefficient, manual beta)      │
│  - Receive & display scaled parameters (read-only)          │
│                                                              │
│  Removed:                                                    │
│  - BetaCalculator.applyBetaScaling()                        │
│  - BetaCalculator.calculateAdjustedParameters()             │
│  - useBetaScaling calculation logic                         │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ API Request (base params + beta config)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         BetaScalingService (NEW)                   │    │
│  │  - Single source of truth for scaling              │    │
│  │  - applyBetaScaling(params, symbol, config)        │    │
│  │  - calculateBetaFactor(beta, coefficient)          │    │
│  │  - scaleParameter(value, betaFactor)               │    │
│  │  - validateBetaConfig(config)                      │    │
│  │  - getBetaForSymbol(symbol, config)                │    │
│  └────────────────────────────────────────────────────┘    │
│                       ▲                                      │
│                       │ Uses                                 │
│                       │                                      │
│  ┌────────────────────┴───────────────────────────────┐    │
│  │         BetaService (EXISTING)                     │    │
│  │  - Multi-tier beta resolution                      │    │
│  │  - getBeta(symbol)                                 │    │
│  │  - getBetaBatch(symbols)                           │    │
│  │  - refreshBeta(symbol)                             │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  All Services Use BetaScalingService:                       │
│  - DCA Backtest Service                                     │
│  - Batch Backtest Service                                   │
│  - Portfolio Backtest Service                               │
│                                                              │
│  Deprecated:                                                 │
│  - parameterCorrelationService (scaling functions)          │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. BetaScalingService (NEW)

**Location**: `backend/services/betaScaling/BetaScalingService.js`

#### Class Structure

```javascript
class BetaScalingService {
  constructor(betaService) {
    this.betaService = betaService;
    this.SCALABLE_PARAMETERS = [/* list of 12 parameters */];
    this.BETA_RANGE = { min: 0.01, max: 10.0 };
    this.COEFFICIENT_RANGE = { min: 0.25, max: 3.0 };
  }

  /**
   * Main entry point: Apply beta scaling to parameters
   * @param {Object} baseParameters - Original trading parameters
   * @param {string|string[]} symbol - Stock symbol(s)
   * @param {Object} config - { enableBetaScaling, coefficient, beta, isManualBetaOverride }
   * @returns {Promise<ScalingResult>}
   */
  async applyBetaScaling(baseParameters, symbol, config = {})

  /**
   * Calculate beta factor (beta × coefficient)
   */
  calculateBetaFactor(beta, coefficient)

  /**
   * Scale a single parameter value
   */
  scaleParameter(value, betaFactor)

  /**
   * Validate beta configuration
   */
  validateBetaConfig(config)

  /**
   * Get beta for symbol (uses betaService)
   */
  async getBetaForSymbol(symbol, config)

  /**
   * Validate parameter ranges after scaling
   */
  validateScaledParameters(parameters, betaFactor)

  /**
   * Generate warnings for extreme values
   */
  generateWarnings(betaFactor, scaledParameters)
}
```

#### Return Object: ScalingResult

```javascript
{
  success: boolean,
  baseParameters: Object,      // Original parameters
  adjustedParameters: Object,  // Scaled parameters
  betaInfo: {
    beta: number,              // Stock beta value
    coefficient: number,       // User coefficient
    betaFactor: number,        // beta × coefficient
    source: string,            // Beta source (file/cache/api/default)
    isManualOverride: boolean, // Manual beta flag
    symbol: string,            // Stock symbol
    updatedAt: string          // Beta update timestamp
  },
  warnings: string[],          // Warning messages
  errors: string[],            // Error messages (if any)
  isValid: boolean            // Validation status
}
```

### 2. Backend Service Integration

#### DCA Backtest Service

**File**: `backend/server.js` - POST `/api/backtest/dca`

**Before**:
```javascript
// Extract beta config
const { beta, coefficient, enableBetaScaling } = req.body;

// Call parameterCorrelationService
if (enableBetaScaling && beta) {
  const result = calculateBetaAdjustedParameters(beta, coefficient, parameters);
  // Apply adjusted parameters
}
```

**After**:
```javascript
const betaConfig = {
  enableBetaScaling: req.body.enableBetaScaling,
  coefficient: req.body.coefficient,
  beta: req.body.beta, // Manual override (optional)
  isManualBetaOverride: req.body.isManualBetaOverride
};

const scalingResult = await betaScalingService.applyBetaScaling(
  parameters,
  symbol,
  betaConfig
);

// Use scalingResult.adjustedParameters
// Include scalingResult.betaInfo in response
```

#### Batch Backtest Service

**File**: `backend/services/batchBacktestService.js`

**Before**:
```javascript
// Fetch beta for symbol
const betaData = await betaService.getBeta(symbol);
const beta = betaData.beta;

// For each coefficient
coefficients.forEach(coef => {
  const result = calculateBetaAdjustedParameters(beta, coef, baseParams);
  combinations.push(result);
});
```

**After**:
```javascript
for (const coefficient of coefficients) {
  const scalingResult = await betaScalingService.applyBetaScaling(
    baseParameters,
    symbol,
    { enableBetaScaling: true, coefficient }
  );

  combinations.push({
    parameters: scalingResult.adjustedParameters,
    betaInfo: scalingResult.betaInfo
  });
}
```

#### Portfolio Backtest Service

**File**: `backend/services/portfolioBacktestService.js`

**Before**:
```javascript
// Each stock: fetch beta, calculate adjusted params
for (const stock of stocks) {
  const beta = await betaService.getBeta(stock.symbol);
  const adjusted = calculateBetaAdjustedParameters(
    beta.beta,
    coefficient,
    baseParams
  );
  stock.parameters = adjusted.adjustedParameters;
}
```

**After**:
```javascript
for (const stock of stocks) {
  const scalingResult = await betaScalingService.applyBetaScaling(
    baseParameters,
    stock.symbol,
    { enableBetaScaling: stock.enableBetaScaling, coefficient: stock.coefficient }
  );

  stock.parameters = scalingResult.adjustedParameters;
  stock.betaInfo = scalingResult.betaInfo;
}
```

### 3. Frontend Changes

#### Remove Calculation Logic

**Files to Modify**:
- `frontend/src/components/backtest/utils/BetaCalculator.js`
  - **Remove**: `applyBetaScaling()`, `calculateAdjustedParameters()`
  - **Keep**: `getStockBeta()` (for display), `isValidBeta()`, `isValidCoefficient()`

- `frontend/src/components/backtest/hooks/useBetaScaling.js`
  - **Remove**: All calculation logic
  - **Keep**: State management for UI controls
  - **Simplify**: Return beta config object for API requests

#### Simplified Frontend Flow

```javascript
// useBetaScaling.js (SIMPLIFIED)
function useBetaScaling(symbol, baseParameters) {
  const [betaConfig, setBetaConfig] = useState({
    enableBetaScaling: false,
    coefficient: 1.0,
    beta: null,  // Manual override
    isManualBetaOverride: false
  });

  // Return config for API request
  return {
    betaConfig,
    updateCoefficient: (coef) => setBetaConfig({...betaConfig, coefficient: coef}),
    toggleBetaScaling: () => setBetaConfig({...betaConfig, enableBetaScaling: !betaConfig.enableBetaScaling}),
    updateBeta: (beta) => setBetaConfig({...betaConfig, beta, isManualBetaOverride: true})
  };
}

// Component usage
const { betaConfig, updateCoefficient } = useBetaScaling(symbol, parameters);

// API request
const apiPayload = {
  ...baseParameters,     // Send base parameters
  ...betaConfig,         // Send beta configuration
  symbol
};

const response = await fetch('/api/backtest/dca', {
  method: 'POST',
  body: JSON.stringify(apiPayload)
});

// Response includes adjusted parameters + betaInfo
const { adjustedParameters, betaInfo } = response.data;
```

### 4. Data Flow

#### Single Stock Backtest

```
1. User sets base parameters + beta config in UI
2. Frontend sends:
   {
     symbol: "TSLA",
     lotSizeUsd: 10000,
     gridIntervalPercent: 10,  // BASE parameter
     profitRequirement: 10,    // BASE parameter
     enableBetaScaling: true,
     coefficient: 1.5,
     beta: null  // Let backend fetch
   }
3. Backend BetaScalingService:
   a. Fetch beta for TSLA (2.065)
   b. Calculate betaFactor = 2.065 × 1.5 = 3.0975
   c. Scale parameters:
      gridIntervalPercent = 10 × 3.0975 = 30.975
      profitRequirement = 10 × 3.0975 = 30.975
   d. Validate ranges
   e. Return ScalingResult
4. Backend runs backtest with adjusted parameters
5. Frontend receives:
   {
     success: true,
     data: { /* backtest results */ },
     betaInfo: {
       beta: 2.065,
       coefficient: 1.5,
       betaFactor: 3.0975,
       baseParameters: { gridIntervalPercent: 10, profitRequirement: 10 },
       adjustedParameters: { gridIntervalPercent: 30.975, profitRequirement: 30.975 }
     }
   }
6. Frontend displays betaInfo to user (read-only)
```

#### Batch Backtest

```
1. User sets parameter ranges + beta scaling
2. Frontend sends:
   {
     symbol: "TSLA",
     paramRanges: {
       gridIntervalPercent: [5, 10, 15],  // BASE values
       profitRequirement: [5, 10, 15]     // BASE values
     },
     enableBetaScaling: true,
     coefficients: [1.0, 1.5, 2.0]
   }
3. Backend BatchBacktestService:
   a. Fetch beta for TSLA once
   b. For each coefficient:
      - Use BetaScalingService to scale ALL parameter combinations
      - Generate combinations with adjusted parameters
   c. Run backtests for all combinations
4. Frontend receives all results with betaInfo per combination
```

#### Portfolio Backtest

```
1. User sets stocks + global parameters + beta scaling
2. Frontend sends:
   {
     stocks: ["TSLA", "AAPL", "MSFT"],
     totalCapital: 500000,
     defaultParams: {
       gridIntervalPercent: 10,  // BASE
       profitRequirement: 10     // BASE
     },
     enableBetaScaling: true,
     coefficient: 1.5  // Applied to ALL stocks
   }
3. Backend PortfolioBacktestService:
   a. For each stock:
      - Use BetaScalingService with stock's symbol
      - Each stock gets its own beta (TSLA=2.065, AAPL=1.2, MSFT=0.9)
      - Each stock gets scaled parameters
   b. Run portfolio backtest with per-stock adjusted parameters
4. Frontend receives portfolio results with per-stock betaInfo
```

## Migration Strategy

### Phase 1: Create BetaScalingService
1. Implement `BetaScalingService` class
2. Write comprehensive unit tests
3. Verify against existing `parameterCorrelationService` output

### Phase 2: Backend Integration
1. Update `server.js` DCA endpoint
2. Update `batchBacktestService.js`
3. Update `portfolioBacktestService.js`
4. Verify all tests pass

### Phase 3: Frontend Simplification
1. Remove calculation logic from `BetaCalculator.js`
2. Simplify `useBetaScaling.js` hook
3. Update components to use simplified hook
4. Verify UI works correctly

### Phase 4: Cleanup
1. Mark `parameterCorrelationService` scaling functions as deprecated
2. Update documentation
3. Remove unused code
4. Final testing

## Testing Strategy

### Unit Tests

**BetaScalingService**:
```javascript
describe('BetaScalingService', () => {
  describe('applyBetaScaling', () => {
    it('should scale parameters correctly with valid beta and coefficient');
    it('should handle zero parameter values (not scale them)');
    it('should fetch beta from betaService when not provided');
    it('should use manual beta override when provided');
    it('should validate beta range (0.01-10.0)');
    it('should validate coefficient range (0.25-3.0)');
    it('should generate warnings for extreme betaFactor');
    it('should return error for invalid configuration');
    it('should handle single symbol (string)');
    it('should handle multiple symbols (array)');
  });

  describe('calculateBetaFactor', () => {
    it('should calculate beta × coefficient correctly');
    it('should handle edge cases (beta=1, coefficient=1)');
  });

  describe('scaleParameter', () => {
    it('should scale non-zero values');
    it('should not scale zero values');
  });

  describe('validateBetaConfig', () => {
    it('should validate valid configuration');
    it('should reject invalid beta');
    it('should reject invalid coefficient');
  });
});
```

### Integration Tests

**Backend Endpoints**:
- Test DCA endpoint with beta scaling enabled/disabled
- Test batch endpoint with multiple coefficients
- Test portfolio endpoint with per-stock scaling
- Verify betaInfo in all responses

**Frontend**:
- Test that scaled parameters are received and displayed
- Test beta config state management
- Test UI controls update correctly

### Regression Tests

- Run all existing tests
- Verify identical output for same inputs
- Compare before/after refactoring results

## Performance Considerations

### Optimization Strategies

1. **Beta Caching**: Cache beta values in BetaService (already implemented)
2. **Batch Beta Fetching**: Use `getBetaBatch()` for portfolio mode
3. **Lazy Evaluation**: Only scale when enableBetaScaling=true
4. **Memoization**: Cache scaled parameter sets for repeated requests

### Expected Performance

- **Single Stock**: < 10ms (beta fetch + scaling)
- **Batch Mode**: < 100ms for 20 combinations
- **Portfolio Mode**: < 500ms for 10 stocks (parallel beta fetch)

## Backward Compatibility

### URL Parameter Support

**Old Format** (frontend-scaled):
```
?gridInterval=30.975&profitReq=30.975&beta=2.065&coefficient=1.5
```

**New Format** (base + config):
```
?gridInterval=10&profitReq=10&enableBetaScaling=true&coefficient=1.5
```

**Strategy**: Backend detects scaled vs. base parameters and handles both

### API Contract

- Existing API endpoints maintain same signatures
- Response format remains identical
- New `betaInfo` field added to responses (optional, non-breaking)

## Documentation Updates

### Files to Update

1. **API Documentation**: Document betaInfo response field
2. **Service Documentation**: BetaScalingService API reference
3. **Architecture Diagrams**: Update with new service
4. **Developer Guide**: How to use BetaScalingService
5. **Migration Guide**: For developers using old approach

## Rollback Plan

If issues arise:
1. **Feature Flag**: Add `USE_BETA_SCALING_SERVICE` flag
2. **Fallback Logic**: Keep `parameterCorrelationService` as backup
3. **Gradual Rollout**: Enable per-endpoint (DCA first, then batch, then portfolio)
4. **Monitoring**: Log all scaling operations for debugging

## Success Metrics

- [ ] All 50+ beta scaling locations refactored to use BetaScalingService
- [ ] Frontend code reduced by 200+ lines
- [ ] Zero duplicated scaling logic
- [ ] All tests passing (100% of existing tests)
- [ ] Performance maintained or improved
- [ ] Documentation complete
