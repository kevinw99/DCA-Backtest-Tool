# Spec 39: Design Document - Shared Backtest Configuration Components

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Shared Component Library                      │
│              frontend/src/components/backtest/                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ BasicParameters  │  │ LongStrategy     │  │ BetaControls │  │
│  │ Section          │  │ Section          │  │ Section      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ ShortStrategy    │  │ DynamicFeatures  │  │ Adaptive     │  │
│  │ Section          │  │ Section          │  │ Strategy     │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ TrailingStop     │  │ ValidationHelper │  │ DateRange    │  │
│  │ Section          │  │                  │  │ Section      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ imports
                   ┌───────────┴───────────┐
                   │                       │
                   ▼                       ▼
        ┌──────────────────┐    ┌──────────────────┐
        │ DCABacktestForm  │    │ PortfolioBacktest│
        │                  │    │ Form             │
        │ - Symbol picker  │    │ - Stock selector │
        │ - Batch mode     │    │ - Total capital  │
        │ - All sections   │    │ - All sections   │
        └──────────────────┘    └──────────────────┘
```

## Component Hierarchy

### 1. Shared Components Structure

```
frontend/src/components/backtest/
├── sections/
│   ├── BasicParametersSection.js
│   ├── LongStrategySection.js
│   ├── ShortStrategySection.js
│   ├── BetaControlsSection.js
│   ├── DynamicFeaturesSection.js
│   ├── AdaptiveStrategySection.js
│   ├── TrailingStopSection.js
│   └── DateRangeSection.js
├── utils/
│   ├── ValidationHelper.js
│   ├── ParameterHelper.js
│   └── BetaCalculator.js
├── hooks/
│   ├── useBacktestValidation.js
│   ├── useBetaScaling.js
│   └── useParameterDefaults.js
└── shared/
    ├── ParameterInput.js
    ├── PercentageSlider.js
    └── SectionHeader.js
```

## Component Specifications

### 1. BasicParametersSection

**Purpose:** Common investment parameters (lot size, max lots, etc.)

**Props:**
```javascript
{
  // Required
  parameters: object,          // Current parameter values
  onParametersChange: function, // Callback when parameters change

  // Optional
  mode: 'single' | 'portfolio', // Rendering mode
  showStrategyMode: boolean,     // Show Long/Short toggle (default: true)
  showMaxLotsToSell: boolean,    // Show max lots to sell (default: true)
  validationErrors: array,       // Validation error objects

  // Portfolio-specific
  showTotalCapital: boolean,     // Show total capital field (default: false)
  showMaxLotsPerStock: boolean,  // Show max lots per stock (default: false)
}
```

**State Management:**
- No internal state
- Pure controlled component
- All state managed by parent form

**Validation:**
- Lot size > 0
- Max lots >= 1
- Max lots to sell >= 1 and <= max lots
- Total capital > lot size (portfolio mode)

**Example Usage:**
```javascript
<BasicParametersSection
  parameters={parameters}
  onParametersChange={handleParametersChange}
  mode="portfolio"
  showTotalCapital={true}
  showMaxLotsPerStock={true}
  validationErrors={validationErrors}
/>
```

### 2. BetaControlsSection

**Purpose:** Beta scaling controls with coefficient adjustment

**Props:**
```javascript
{
  // Required
  symbol: string | string[],     // Stock symbol(s)
  parameters: object,            // Current parameter values
  onParametersChange: function,  // Callback when parameters change

  // Optional
  mode: 'single' | 'portfolio',  // Rendering mode
  enableBetaScaling: boolean,    // Beta scaling enabled
  onBetaScalingChange: function, // Toggle beta scaling
  betaData: object,              // { beta, betaFactor, coefficient, ... }
  onBetaDataChange: function,    // Update beta data
  showAdjustedValues: boolean,   // Show β indicators (default: true)

  // API integration
  onCalculateAdjusted: function, // Callback to calculate adjusted params
}
```

**Internal State:**
```javascript
{
  loading: boolean,              // Loading beta data
  error: string | null,          // Error message
  baseParameters: object,        // Pre-scaling parameter values
}
```

**Beta Calculation Logic:**
```javascript
// Single Stock Mode
adjustedValue = baseValue × beta × coefficient

// Portfolio Mode
adjustedValue[symbol] = baseValue × backtestDefaults[symbol].beta × coefficient
```

**Integration with backtestDefaults.json:**
```javascript
// Portfolio mode loads beta from Spec 36 structure
import backtestDefaults from '@/config/backtestDefaults.json';

function getStockBeta(symbol) {
  return backtestDefaults[symbol]?.beta?.beta ||
         backtestDefaults.global.beta.beta ||
         1.0;
}
```

### 3. LongStrategySection

**Purpose:** Long strategy parameters (grid, profit, trailing stops)

**Props:**
```javascript
{
  // Required
  parameters: object,            // Long strategy parameters
  onParametersChange: function,  // Callback when parameters change

  // Optional
  betaAdjusted: boolean,         // Show β indicators
  validationErrors: array,       // Validation error objects
  showTrailingStops: boolean,    // Show trailing stop controls (default: true)
  showOrderType: boolean,        // Show limit/market toggle (default: true)
}
```

**Parameters Controlled:**
- gridIntervalPercent
- profitRequirement
- trailingBuyActivationPercent
- trailingBuyReboundPercent
- trailingSellActivationPercent
- trailingSellPullbackPercent
- enableTrailingBuy
- enableTrailingSell
- trailingStopOrderType (LIMIT | MARKET)

### 4. ShortStrategySection

**Purpose:** Short selling strategy parameters

**Props:**
```javascript
{
  // Required
  parameters: object,            // Short strategy parameters
  onParametersChange: function,  // Callback when parameters change

  // Optional
  betaAdjusted: boolean,         // Show β indicators
  validationErrors: array,       // Validation error objects
  enabled: boolean,              // Strategy mode = 'short' (default: false)
}
```

**Parameters Controlled:**
- maxShorts
- maxShortsToCovers
- gridIntervalPercent (short)
- profitRequirement (short)
- trailingShortActivationPercent
- trailingShortPullbackPercent
- trailingCoverActivationPercent
- trailingCoverReboundPercent
- hardStopLossPercent
- portfolioStopLossPercent
- cascadeStopLossPercent

**Conditional Rendering:**
Only renders when `enabled={true}` (strategy mode = 'short')

### 5. DynamicFeaturesSection

**Purpose:** Advanced grid and strategy features

**Props:**
```javascript
{
  // Required
  parameters: object,            // Dynamic feature parameters
  onParametersChange: function,  // Callback when parameters change

  // Optional
  showBatchRanges: boolean,      // Show batch mode ranges (default: false)
  validationErrors: array,       // Validation error objects
}
```

**Parameters Controlled:**
- enableDynamicGrid
- dynamicGridMultiplier (slider 0.5 - 2.0)
- enableConsecutiveIncrementalBuyGrid
- gridConsecutiveIncrement
- enableConsecutiveIncrementalSellProfit
- enableScenarioDetection
- normalizeToReference

### 6. AdaptiveStrategySection

**Purpose:** Adaptive strategy controls (Spec 25/27)

**Props:**
```javascript
{
  // Required
  parameters: object,            // Adaptive strategy parameters
  onParametersChange: function,  // Callback when parameters change

  // Optional
  validationErrors: array,       // Validation error objects
}
```

**Parameters Controlled:**
- enableAdaptiveStrategy
- adaptationCheckIntervalDays
- adaptationRollingWindowDays
- minDataDaysBeforeAdaptation
- confidenceThreshold

### 7. TrailingStopSection

**Purpose:** Consolidated trailing stop controls with order type selection

**Props:**
```javascript
{
  // Required
  strategyType: 'long' | 'short', // Strategy type
  parameters: object,             // Trailing stop parameters
  onParametersChange: function,   // Callback when parameters change

  // Optional
  betaAdjusted: boolean,          // Show β indicators
  validationErrors: array,        // Validation error objects
  showOrderType: boolean,         // Show limit/market toggle (default: true)
}
```

**Dual Mode Rendering:**
- Long: trailingBuy + trailingSell controls
- Short: trailingShort + trailingCover controls

## Utility Modules

### 1. ValidationHelper.js

**Purpose:** Centralized validation logic for all parameters

```javascript
export const ValidationHelper = {
  // Field validators
  validateLotSize(value) { /* ... */ },
  validateGridInterval(value) { /* ... */ },
  validateProfitRequirement(value) { /* ... */ },
  validateDateRange(startDate, endDate) { /* ... */ },
  validateBetaCoefficient(value) { /* ... */ },

  // Cross-field validation
  validateTrailingStopLogic(activation, rebound) { /* ... */ },
  validateMaxLotsToSell(maxLotsToSell, maxLots) { /* ... */ },

  // Beta-adjusted warnings
  checkBetaAdjustedExtremes(adjustedValue, baseValue, threshold) { /* ... */ },

  // Full form validation
  validateBacktestForm(parameters, mode) { /* ... */ },
};
```

### 2. ParameterHelper.js

**Purpose:** Parameter manipulation and defaults

```javascript
export const ParameterHelper = {
  // Load defaults from backtestDefaults.json
  getGlobalDefaults() { /* ... */ },
  getStockDefaults(symbol) { /* ... */ },
  mergeStockDefaults(globalDefaults, stockDefaults) { /* ... */ },

  // localStorage persistence
  loadFromLocalStorage(key) { /* ... */ },
  saveToLocalStorage(key, parameters) { /* ... */ },

  // URL parameter parsing
  parseURLParameters(queryString) { /* ... */ },
  generateURLParameters(parameters) { /* ... */ },

  // Parameter comparison
  getDifferences(params1, params2) { /* ... */ },
  hasStockSpecificOverrides(symbol) { /* ... */ },
};
```

### 3. BetaCalculator.js

**Purpose:** Beta scaling calculations

```javascript
export const BetaCalculator = {
  // Calculate adjusted parameters
  async calculateAdjustedParameters(baseParams, symbol, coefficient) { /* ... */ },

  // Apply beta scaling
  applyBetaScaling(value, beta, coefficient) { /* ... */ },

  // Restore base parameters
  restoreBaseParameters(adjustedParams, beta, coefficient) { /* ... */ },

  // Batch calculation for portfolio
  async calculatePortfolioBetaScaling(baseParams, symbols, coefficient) { /* ... */ },
};
```

## Custom Hooks

### 1. useBacktestValidation

**Purpose:** Real-time form validation

```javascript
function useBacktestValidation(parameters, mode) {
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    const validationErrors = ValidationHelper.validateBacktestForm(parameters, mode);
    setErrors(validationErrors);
  }, [parameters, mode]);

  return { errors, isValid: errors.length === 0 };
}
```

### 2. useBetaScaling

**Purpose:** Beta scaling state management

```javascript
function useBetaScaling(symbol, initialParameters) {
  const [enableBetaScaling, setEnableBetaScaling] = useState(false);
  const [betaData, setBetaData] = useState({});
  const [baseParameters, setBaseParameters] = useState(initialParameters);
  const [adjustedParameters, setAdjustedParameters] = useState(initialParameters);
  const [loading, setLoading] = useState(false);

  const calculateAdjusted = async () => { /* ... */ };
  const toggleBetaScaling = () => { /* ... */ };
  const updateCoefficient = (newCoefficient) => { /* ... */ };

  return {
    enableBetaScaling,
    betaData,
    baseParameters,
    adjustedParameters,
    loading,
    calculateAdjusted,
    toggleBetaScaling,
    updateCoefficient,
  };
}
```

### 3. useParameterDefaults

**Purpose:** Load and merge parameter defaults

```javascript
function useParameterDefaults(symbol, mode) {
  const [parameters, setParameters] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mode === 'single') {
      // Load global + stock-specific defaults
      const defaults = ParameterHelper.getStockDefaults(symbol);
      setParameters(defaults);
    } else {
      // Portfolio mode: load global defaults
      const defaults = ParameterHelper.getGlobalDefaults();
      setParameters(defaults);
    }
    setLoading(false);
  }, [symbol, mode]);

  return { parameters, loading };
}
```

## Form Integration

### DCABacktestForm Refactored Structure

```javascript
const DCABacktestForm = () => {
  // State management
  const [parameters, setParameters] = useState({});
  const [symbol, setSymbol] = useState('AAPL');
  const [strategyMode, setStrategyMode] = useState('long');
  const [testingMode, setTestingMode] = useState('single');

  // Custom hooks
  const { errors, isValid } = useBacktestValidation(parameters, 'single');
  const {
    enableBetaScaling,
    betaData,
    adjustedParameters,
    toggleBetaScaling,
    calculateAdjusted
  } = useBetaScaling(symbol, parameters);

  return (
    <form onSubmit={handleSubmit}>
      {/* Symbol Selection (form-specific) */}
      <section className="symbol-selection">
        <SymbolDropdown value={symbol} onChange={setSymbol} />
      </section>

      {/* Shared Sections */}
      <BasicParametersSection
        parameters={parameters}
        onParametersChange={setParameters}
        mode="single"
        showStrategyMode={true}
        validationErrors={errors}
      />

      <DateRangeSection
        parameters={parameters}
        onParametersChange={setParameters}
        validationErrors={errors}
      />

      <BetaControlsSection
        symbol={symbol}
        parameters={enableBetaScaling ? adjustedParameters : parameters}
        onParametersChange={setParameters}
        mode="single"
        enableBetaScaling={enableBetaScaling}
        onBetaScalingChange={toggleBetaScaling}
        betaData={betaData}
        onCalculateAdjusted={calculateAdjusted}
      />

      <LongStrategySection
        parameters={enableBetaScaling ? adjustedParameters : parameters}
        onParametersChange={setParameters}
        betaAdjusted={enableBetaScaling}
        validationErrors={errors}
      />

      {strategyMode === 'short' && (
        <ShortStrategySection
          parameters={enableBetaScaling ? adjustedParameters : parameters}
          onParametersChange={setParameters}
          betaAdjusted={enableBetaScaling}
          validationErrors={errors}
          enabled={true}
        />
      )}

      <DynamicFeaturesSection
        parameters={parameters}
        onParametersChange={setParameters}
        showBatchRanges={testingMode === 'batch'}
        validationErrors={errors}
      />

      <AdaptiveStrategySection
        parameters={parameters}
        onParametersChange={setParameters}
        validationErrors={errors}
      />

      {/* Batch Mode (form-specific) */}
      {testingMode === 'batch' && (
        <BatchParameterRanges
          parameters={parameters}
          onParametersChange={setParameters}
        />
      )}

      {/* Submit */}
      <button type="submit" disabled={!isValid}>Run Backtest</button>
    </form>
  );
};
```

### PortfolioBacktestForm Refactored Structure

```javascript
const PortfolioBacktestForm = () => {
  // State management
  const [parameters, setParameters] = useState({});
  const [stocks, setStocks] = useState(['AAPL', 'TSLA', 'NVDA']);
  const [totalCapital, setTotalCapital] = useState(500000);

  // Custom hooks
  const { errors, isValid } = useBacktestValidation(parameters, 'portfolio');
  const {
    enableBetaScaling,
    betaData,
    adjustedParameters,
    toggleBetaScaling,
    calculateAdjusted
  } = useBetaScaling(stocks, parameters);

  return (
    <form onSubmit={handleSubmit}>
      {/* Stock Selection (form-specific) */}
      <section className="stock-selection">
        <StockSelector
          selectedStocks={stocks}
          onChange={setStocks}
        />
      </section>

      {/* Portfolio-Specific Parameters */}
      <section className="portfolio-capital">
        <label>Total Capital ($)</label>
        <input
          type="number"
          value={totalCapital}
          onChange={(e) => setTotalCapital(parseFloat(e.target.value))}
        />
      </section>

      {/* Shared Sections - IDENTICAL to single stock form */}
      <BasicParametersSection
        parameters={parameters}
        onParametersChange={setParameters}
        mode="portfolio"
        showMaxLotsPerStock={true}
        validationErrors={errors}
      />

      <DateRangeSection
        parameters={parameters}
        onParametersChange={setParameters}
        validationErrors={errors}
      />

      <BetaControlsSection
        symbol={stocks}
        parameters={enableBetaScaling ? adjustedParameters : parameters}
        onParametersChange={setParameters}
        mode="portfolio"
        enableBetaScaling={enableBetaScaling}
        onBetaScalingChange={toggleBetaScaling}
        betaData={betaData}
        onCalculateAdjusted={calculateAdjusted}
      />

      <LongStrategySection
        parameters={enableBetaScaling ? adjustedParameters : parameters}
        onParametersChange={setParameters}
        betaAdjusted={enableBetaScaling}
        validationErrors={errors}
      />

      <DynamicFeaturesSection
        parameters={parameters}
        onParametersChange={setParameters}
        validationErrors={errors}
      />

      <AdaptiveStrategySection
        parameters={parameters}
        onParametersChange={setParameters}
        validationErrors={errors}
      />

      {/* Submit */}
      <button type="submit" disabled={!isValid}>Run Portfolio Backtest</button>
    </form>
  );
};
```

## Stock-Specific Parameter Overrides (Portfolio Mode)

### Visual Indicator Design

```
┌─────────────────────────────────────────────────────────┐
│ Stock Selection                                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [✓] AAPL  🎯 (custom params)                           │
│  [✓] TSLA  🎯 (custom params)                           │
│  [✓] NVDA                                                │
│  [✓] PLTR  🎯 (custom params)                           │
│                                                           │
│  [View/Edit Stock-Specific Parameters]                  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Stock-Specific Parameter Modal

When user clicks "View/Edit Stock-Specific Parameters":

```
┌─────────────────────────────────────────────────────────┐
│ Stock-Specific Parameter Overrides                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Stock: [AAPL ▼]                                         │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Beta Parameters                                      ││
│  │   Beta: 1.5 (from backtestDefaults.json)            ││
│  │   Beta Factor: 1.5                                   ││
│  │                                                       ││
│  │ Long Strategy                                        ││
│  │   Grid Interval: 15% (global: 10%)                  ││
│  │   Profit Requirement: 15% (global: 10%)             ││
│  │                                                       ││
│  │ Dynamic Features                                     ││
│  │   Normalize to Reference: ✓ (global: ✗)            ││
│  │   Enable Scenario Detection: ✓ (global: ✗)         ││
│  │                                                       ││
│  │ [Reset to Global Defaults] [Save Changes]           ││
│  └─────────────────────────────────────────────────────┘│
│                                                           │
│  Note: Stock-specific parameters are loaded from         │
│  backtestDefaults.json. Changes here will NOT save       │
│  to the file (use Spec 36 cleanup script to update).     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Parameter Merging Logic

```javascript
function getEffectiveParameters(symbol, globalParams) {
  // 1. Load from backtestDefaults.json
  const stockDefaults = ParameterHelper.getStockDefaults(symbol);

  // 2. Merge: stock-specific > global > hardcoded defaults
  const merged = {
    ...HARDCODED_DEFAULTS,
    ...globalParams,
    ...stockDefaults,
  };

  // 3. Apply beta scaling if enabled
  if (enableBetaScaling) {
    const beta = merged.beta?.beta || 1.0;
    const coefficient = merged.beta?.coefficient || 1.0;

    return BetaCalculator.applyBetaScaling(merged, beta, coefficient);
  }

  return merged;
}
```

## CSS Sharing Strategy

### Shared Stylesheet

```css
/* frontend/src/components/backtest/BacktestForm.css */

/* Section styling */
.backtest-section {
  background: #f8f9fa;
  padding: 20px;
  margin-bottom: 20px;
  border-radius: 8px;
}

.backtest-section h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
  color: #333;
}

/* Input grid layout */
.parameter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 15px;
}

/* Input styling */
.parameter-input {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.parameter-input label {
  font-weight: 500;
  color: #555;
}

.parameter-input input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

/* Beta-adjusted indicator */
.beta-adjusted::after {
  content: " β";
  color: #0066cc;
  font-weight: bold;
  font-size: 0.9em;
}

/* Validation error */
.parameter-input.error input {
  border-color: #dc3545;
}

.error-message {
  color: #dc3545;
  font-size: 0.85em;
}

/* Stock-specific indicator */
.stock-specific-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.9em;
  color: #0066cc;
}
```

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         User Action                           │
│          (Change Grid Interval from 10% to 15%)              │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│               LongStrategySection                             │
│          onChange={handleParametersChange}                    │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│               Parent Form (DCA/Portfolio)                     │
│          setParameters({ ...params, gridInterval: 15 })       │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ├─────────────────────────────┐
                       │                             │
                       ▼                             ▼
           ┌───────────────────┐       ┌───────────────────────┐
           │ ValidationHelper  │       │ BetaCalculator        │
           │ - Check 0-100%    │       │ - Recalc adjusted     │
           │ - Update errors   │       │   if beta enabled     │
           └───────────────────┘       └───────────────────────┘
                       │                             │
                       └─────────────┬───────────────┘
                                     │
                                     ▼
                       ┌──────────────────────────┐
                       │  Re-render All Sections  │
                       │  with Updated Parameters │
                       └──────────────────────────┘
```

## Testing Strategy

### Unit Tests

```javascript
// BasicParametersSection.test.js
describe('BasicParametersSection', () => {
  it('renders all inputs in single mode', () => { /* ... */ });
  it('renders portfolio-specific inputs in portfolio mode', () => { /* ... */ });
  it('calls onParametersChange with updated values', () => { /* ... */ });
  it('displays validation errors', () => { /* ... */ });
});

// ValidationHelper.test.js
describe('ValidationHelper', () => {
  it('validates lot size > 0', () => { /* ... */ });
  it('validates grid interval 0-100%', () => { /* ... */ });
  it('validates trailing stop logic', () => { /* ... */ });
});

// BetaCalculator.test.js
describe('BetaCalculator', () => {
  it('applies beta scaling correctly', () => { /* ... */ });
  it('restores base parameters', () => { /* ... */ });
  it('handles portfolio beta calculation', () => { /* ... */ });
});
```

### Integration Tests

```javascript
// DCABacktestForm.integration.test.js
describe('DCABacktestForm Integration', () => {
  it('updates all sections when beta scaling enabled', () => { /* ... */ });
  it('validates form before submission', () => { /* ... */ });
  it('loads stock defaults on symbol change', () => { /* ... */ });
});

// PortfolioBacktestForm.integration.test.js
describe('PortfolioBacktestForm Integration', () => {
  it('applies stock-specific overrides from backtestDefaults.json', () => { /* ... */ });
  it('shows custom parameter indicators', () => { /* ... */ });
  it('validates portfolio-specific constraints', () => { /* ... */ });
});
```

## Migration Strategy

### Phase 1: Extract Shared Components (No Breaking Changes)
1. Create new component files in `frontend/src/components/backtest/`
2. Extract logic from DCABacktestForm (keep original intact)
3. Write unit tests for shared components
4. Verify components work in isolation

### Phase 2: Integrate into DCABacktestForm
1. Refactor DCABacktestForm to use shared components
2. Run integration tests
3. Manual QA on single stock backtest
4. Fix any regressions

### Phase 3: Enhance PortfolioBacktestForm
1. Add all missing sections using shared components
2. Implement stock-specific parameter overrides
3. Integrate beta scaling
4. Run integration tests
5. Manual QA on portfolio backtest

### Phase 4: Cleanup
1. Remove duplicated code from both forms
2. Update documentation
3. Final regression testing
4. Deploy

## Performance Considerations

### Component Memoization

```javascript
// Prevent unnecessary re-renders
export const LongStrategySection = React.memo(({ parameters, onParametersChange, ...props }) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison function
  return (
    prevProps.parameters === nextProps.parameters &&
    prevProps.betaAdjusted === nextProps.betaAdjusted
  );
});
```

### Debounced Validation

```javascript
// Avoid excessive validation on rapid input changes
const debouncedValidation = useMemo(
  () => debounce((params) => {
    const errors = ValidationHelper.validateBacktestForm(params, mode);
    setValidationErrors(errors);
  }, 300),
  [mode]
);
```

## Accessibility

- All inputs have associated labels
- Validation errors announced to screen readers
- Keyboard navigation support
- Focus management for modals
- ARIA attributes for custom controls
