# Ticker-Specific Default Parameters - Design

## Architecture Overview

The system will support ticker-specific default parameters through a JSON configuration file and backend/frontend integration.

```
┌─────────────┐         ┌──────────────────┐         ┌───────────────────┐
│   Frontend  │ ◄─────► │  Backend API     │ ◄─────► │ backtestDefaults  │
│   (App.js)  │         │  (server.js)     │         │     .json         │
└─────────────┘         └──────────────────┘         └───────────────────┘
      │                          │                            │
      │ Save as Default          │ POST /defaults/:symbol     │ Write ticker
      │ Reset to Default         │ GET /defaults/:symbol      │ Read ticker
      │ Symbol Change            │                            │ defaults
```

## Data Structure

### backtestDefaults.json Structure

```json
{
  "AAPL": {
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "maxLotsToSell": 1,
    "gridIntervalPercent": 0.1,
    "profitRequirement": 0.1,
    "trailingBuyActivationPercent": 0.1,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.2,
    "trailingSellPullbackPercent": 0.1,
    "maxShorts": 6,
    "maxShortsToCovers": 3,
    "trailingShortActivationPercent": 0.25,
    "trailingShortPullbackPercent": 0.15,
    "trailingCoverActivationPercent": 0.2,
    "trailingCoverReboundPercent": 0.1,
    "hardStopLossPercent": 0.3,
    "portfolioStopLossPercent": 0.25,
    "cascadeStopLossPercent": 0.35,
    "beta": 1.5,
    "enableBetaScaling": true,
    "isManualBetaOverride": false,
    "betaFactor": 1.5,
    "coefficient": 1,
    "strategyMode": "long",
    "enableConsecutiveIncremental": true,
    "enableDynamicGrid": false,
    "enableConsecutiveIncrementalSellProfit": false,
    "enableScenarioDetection": true,
    "enableAdaptiveStrategy": true,
    "normalizeToReference": true,
    "dynamicGridMultiplier": 1,
    "adaptationCheckIntervalDays": 30,
    "adaptationRollingWindowDays": 90,
    "minDataDaysBeforeAdaptation": 90,
    "confidenceThreshold": 0.7
  },
  "TSLA": {
    // ... TSLA-specific parameters
  }
}
```

### Global Defaults (Hardcoded Fallback)

```javascript
const GLOBAL_DEFAULTS = {
  lotSizeUsd: 10000,
  maxLots: 10,
  maxLotsToSell: 1,
  gridIntervalPercent: 0.1,
  profitRequirement: 0.1,
  trailingBuyActivationPercent: 0.1,
  trailingBuyReboundPercent: 0.05,
  trailingSellActivationPercent: 0.2,
  trailingSellPullbackPercent: 0.1,
  maxShorts: 6,
  maxShortsToCovers: 3,
  trailingShortActivationPercent: 0.25,
  trailingShortPullbackPercent: 0.15,
  trailingCoverActivationPercent: 0.2,
  trailingCoverReboundPercent: 0.1,
  hardStopLossPercent: 0.3,
  portfolioStopLossPercent: 0.25,
  cascadeStopLossPercent: 0.35,
  beta: 1,
  enableBetaScaling: false,
  isManualBetaOverride: false,
  betaFactor: 1,
  coefficient: 1,
  strategyMode: 'long',
  enableConsecutiveIncremental: false,
  enableDynamicGrid: false,
  enableConsecutiveIncrementalSellProfit: false,
  enableScenarioDetection: false,
  enableAdaptiveStrategy: false,
  normalizeToReference: false,
  dynamicGridMultiplier: 1,
  adaptationCheckIntervalDays: 30,
  adaptationRollingWindowDays: 90,
  minDataDaysBeforeAdaptation: 90,
  confidenceThreshold: 0.7,
};
```

## Component Design

### Backend Components

#### 1. Configuration Service (New)

**File**: `backend/services/configService.js`

Responsibilities:

- Read/write ticker-specific defaults from/to `config/backtestDefaults.json`
- Merge ticker-specific defaults with global defaults
- Validate parameter values
- Handle file I/O errors gracefully

```javascript
class ConfigService {
  constructor(configPath) {
    this.configPath = configPath;
    this.globalDefaults = GLOBAL_DEFAULTS;
  }

  // Get defaults for a specific ticker
  getTickerDefaults(symbol) {
    // Returns ticker-specific if exists, else global defaults
  }

  // Save ticker-specific defaults
  saveTickerDefaults(symbol, parameters) {
    // Validate, then save to JSON file
  }

  // Validate parameter values
  validateParameters(parameters) {
    // Check types, ranges, required fields
  }
}
```

#### 2. API Endpoints (Updated)

**File**: `backend/server.js`

New/Modified Endpoints:

```javascript
// GET /api/backtest/defaults/:symbol
// Returns ticker-specific defaults or global defaults

// POST /api/backtest/defaults/:symbol
// Saves ticker-specific defaults
// Body: { parameters: {...} }
```

### Frontend Components

#### 1. App.js Updates

**State Management**:

```javascript
const [currentDefaults, setCurrentDefaults] = useState(null);
```

**Functions**:

```javascript
// Fetch ticker-specific defaults when symbol changes
const loadTickerDefaults = async symbol => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/backtest/defaults/${symbol}`);
    const data = await response.json();
    setCurrentDefaults(data.defaults);
    // Apply defaults to form state
    applyDefaults(data.defaults);
  } catch (error) {
    console.error('Failed to load ticker defaults:', error);
    // Fall back to global defaults
  }
};

// Save current parameters as ticker-specific defaults
const saveAsDefault = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/backtest/defaults/${parameters.symbol}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parameters: extractTickerSpecificParams() }),
    });
    if (response.ok) {
      setFeedbackMessage('Saved as default for ' + parameters.symbol);
    }
  } catch (error) {
    setFeedbackMessage('Failed to save defaults: ' + error.message);
  }
};

// Reset to ticker-specific or global defaults
const resetToDefaults = () => {
  if (currentDefaults) {
    applyDefaults(currentDefaults);
  } else {
    // Fallback to global defaults
    applyDefaults(GLOBAL_DEFAULTS);
  }
};

// Extract only ticker-specific parameters (exclude symbol, dates, etc.)
const extractTickerSpecificParams = () => {
  const { symbol, startDate, endDate, availableSymbols, mode, source, ...tickerParams } =
    parameters;
  return tickerParams;
};
```

**UI Changes**:

1. Add "Save as Default" button next to "Reset to Default"
2. Add feedback message display area
3. Call `loadTickerDefaults()` when symbol changes

```jsx
{
  /* Only show in single mode */
}
{
  parameters.mode === 'single' && (
    <div className="default-buttons">
      <button onClick={resetToDefaults}>Reset to Default</button>
      <button onClick={saveAsDefault}>Save as Default for {parameters.symbol}</button>
    </div>
  );
}

{
  feedbackMessage && <div className="feedback-message">{feedbackMessage}</div>;
}
```

## Data Flow

### 1. Load Ticker Defaults (Symbol Change)

```
User selects symbol → loadTickerDefaults(symbol) → GET /api/backtest/defaults/:symbol
                                                    ↓
                                                    configService.getTickerDefaults(symbol)
                                                    ↓
                                                    Read backtestDefaults.json
                                                    ↓
                                                    Return ticker defaults or global defaults
                                                    ↓
Frontend receives defaults → Apply to form state
```

### 2. Save as Default

```
User clicks "Save as Default" → saveAsDefault() → Extract ticker-specific params
                                                   ↓
                                                   POST /api/backtest/defaults/:symbol
                                                   ↓
                                                   configService.validateParameters()
                                                   ↓
                                                   configService.saveTickerDefaults()
                                                   ↓
                                                   Read existing backtestDefaults.json
                                                   ↓
                                                   Merge/update ticker entry
                                                   ↓
                                                   Write backtestDefaults.json
                                                   ↓
Frontend shows success/error message
```

### 3. Reset to Default

```
User clicks "Reset to Default" → Check if currentDefaults exists
                                 ↓
                                 YES: Apply ticker-specific defaults
                                 NO: Apply global defaults
                                 ↓
                                 Update form state
```

## Error Handling

### Backend

- File not found: Return global defaults
- Invalid JSON: Log error, return global defaults
- Write errors: Return 500 error with message
- Validation errors: Return 400 with specific field errors

### Frontend

- Network errors: Show error message, use cached/global defaults
- Invalid response: Show error message, maintain current state
- Save failures: Show error message, don't update currentDefaults

## Validation Rules

### Parameter Validation

- `lotSizeUsd`: number > 0
- `maxLots`: integer >= 1
- `maxLotsToSell`: integer >= 1, <= maxLots
- All percentage values: number >= 0
- `strategyMode`: one of ['long', 'SHORT_DCA']
- Boolean flags: true/false
- `confidenceThreshold`: number 0-1

## File Structure

```
DCA-Claude-Kiro/
├── backend/
│   ├── server.js (updated with new endpoints)
│   └── services/
│       └── configService.js (new)
├── frontend/
│   └── src/
│       ├── App.js (updated with save/load logic)
│       └── App.css (updated with button styles)
└── config/
    └── backtestDefaults.json (updated structure)
```

## Migration Strategy

1. **Backward Compatibility**: Existing `backtestDefaults.json` will be transformed from flat structure to ticker-keyed structure
2. **Gradual Adoption**: System works with both empty JSON and populated ticker-specific configs
3. **No Breaking Changes**: All existing functionality continues to work

## Security Considerations

- Validate all input parameters before saving
- Sanitize symbol names (alphanumeric only)
- Limit file size to prevent DOS attacks
- Use atomic file writes to prevent corruption
- No sensitive data in configuration files

## Performance Considerations

- Cache loaded defaults in memory (backend)
- Debounce save operations (frontend)
- Async file I/O operations
- Response time target: < 100ms for reads, < 500ms for writes

## Testing Strategy

### Unit Tests

- configService parameter validation
- File read/write operations
- Merge logic for defaults

### Integration Tests

- API endpoint responses
- End-to-end save/load flow
- Error scenarios (file missing, corrupt JSON)

### Manual Testing

- Save defaults for multiple tickers
- Switch between tickers and verify correct defaults load
- Reset to defaults works correctly
- Manual JSON editing is preserved
- Batch mode doesn't show "Save as Default" button
