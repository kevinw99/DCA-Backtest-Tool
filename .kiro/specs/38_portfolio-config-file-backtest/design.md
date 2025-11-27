# Design: Portfolio Config File Backtest

## Architecture Overview

```
┌─────────────────┐
│  Config Files   │
│  (JSON)         │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  ConfigLoader                       │
│  - Load & validate config           │
│  - Cache configs in memory          │
│  - Merge global + stock overrides   │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  API Routes                         │
│  POST /api/backtest/portfolio/config│
│  GET /api/backtest/portfolio/config │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Existing Portfolio Backtest        │
│  Service (portfolioBacktestService) │
└─────────────────────────────────────┘
```

## Component Design

### 1. Config File Structure

**Directory**: `backend/configs/portfolios/`

**File Naming**: `{name}.json` (lowercase, hyphenated)

**Example Files**:
- `nasdaq100.json`
- `tech-portfolio.json`
- `dividend-stocks.json`

### 2. Config Loader Module

**File**: `backend/services/portfolioConfigLoader.js`

**Responsibilities**:
1. Load config files from disk
2. Validate config structure
3. Cache configs in memory
4. Merge global defaults with stock-specific overrides
5. Convert config to portfolio backtest parameters

**Key Functions**:

```javascript
/**
 * Load and validate a portfolio config file
 * @param {string} configName - Config file name (without .json)
 * @returns {Promise<Object>} Validated config object
 * @throws {Error} If config invalid or not found
 */
async function loadPortfolioConfig(configName)

/**
 * Convert config to portfolio backtest parameters
 * @param {Object} config - Validated config object
 * @returns {Object} Parameters for portfolioBacktestService
 */
function configToBacktestParams(config)

/**
 * Validate config structure and values
 * @param {Object} config - Config object to validate
 * @throws {Error} If validation fails
 */
function validateConfig(config)

/**
 * Clear config cache (for testing/development)
 */
function clearConfigCache()
```

**Config Cache**:
```javascript
const configCache = new Map();
// Key: configName, Value: { config, loadTime, filePath }
```

### 3. API Routes

**File**: `backend/server.js` (add new routes)

#### Route 1: POST /api/backtest/portfolio/config

```javascript
app.post('/api/backtest/portfolio/config', async (req, res) => {
  try {
    const { configFile } = req.body;

    // Load and validate config
    const config = await loadPortfolioConfig(configFile);

    // Convert to backtest parameters
    const backtestParams = configToBacktestParams(config);

    // Run backtest using existing service
    const result = await portfolioBacktestService.runBacktest(backtestParams);

    // Return results
    res.json({
      success: true,
      data: result,
      meta: {
        configFile: configFile,
        portfolioName: config.name
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});
```

#### Route 2: GET /api/backtest/portfolio/config/:configName

```javascript
app.get('/api/backtest/portfolio/config/:configName', async (req, res) => {
  try {
    const { configName } = req.params;

    // Load and validate config
    const config = await loadPortfolioConfig(configName);

    // Convert to backtest parameters
    const backtestParams = configToBacktestParams(config);

    // Run backtest using existing service
    const result = await portfolioBacktestService.runBacktest(backtestParams);

    // Return results
    res.json({
      success: true,
      data: result,
      meta: {
        configFile: `${configName}.json`,
        portfolioName: config.name
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});
```

### 4. Config Validation Schema

**Validation Rules**:

```javascript
const configSchema = {
  name: { type: 'string', required: true },
  description: { type: 'string', required: false },
  totalCapitalUsd: { type: 'number', required: true, min: 1000 },
  startDate: { type: 'string', required: true, format: 'YYYY-MM-DD' },
  endDate: { type: 'string', required: true, format: 'YYYY-MM-DD' },
  globalDefaults: { type: 'object', required: true },
  stocks: { type: 'array', required: true, minLength: 1 },
  stockSpecificOverrides: { type: 'object', required: false }
};

const globalDefaultsSchema = {
  lotSizeUsd: { type: 'number', min: 100 },
  maxLots: { type: 'number', min: 1, max: 100 },
  gridIntervalPercent: { type: 'number', min: 1, max: 50 },
  profitRequirement: { type: 'number', min: 1, max: 100 },
  // ... all other DCA parameters
};
```

### 5. Config to Backtest Parameters Conversion

**Logic**:

```javascript
function configToBacktestParams(config) {
  const {
    totalCapitalUsd,
    startDate,
    endDate,
    globalDefaults,
    stocks,
    stockSpecificOverrides = {}
  } = config;

  // Build stocks array with merged parameters
  const stocksWithParams = stocks.map(symbol => {
    const stockOverrides = stockSpecificOverrides[symbol] || {};

    return {
      symbol,
      ...globalDefaults,      // Start with global defaults
      ...stockOverrides       // Override with stock-specific params
    };
  });

  return {
    totalCapitalUsd,
    startDate,
    endDate,
    stocks: stocksWithParams
  };
}
```

### 6. Helper Script

**File**: `backend/scripts/generatePortfolioConfig.js`

**Usage**:
```bash
node scripts/generatePortfolioConfig.js \
  --name "Nasdaq 100" \
  --stocks-file "data/nasdaq100-symbols.txt" \
  --total-capital 3000000 \
  --lot-size 10000 \
  --max-lots 10 \
  --start-date 2021-09-01 \
  --end-date current \
  --use-defaults \
  --output configs/portfolios/nasdaq100.json
```

**Script Structure**:

```javascript
const fs = require('fs');
const path = require('path');

// Parse command-line arguments
const args = parseArgs(process.argv);

// Load stock symbols from file
const stocks = loadStocksFromFile(args.stocksFile);

// Load global defaults if --use-defaults flag
const globalDefaults = args.useDefaults
  ? loadBacktestDefaults()
  : buildDefaultsFromArgs(args);

// Build config object
const config = {
  name: args.name,
  description: args.description || `Portfolio backtest for ${args.name}`,
  totalCapitalUsd: args.totalCapital,
  startDate: args.startDate,
  endDate: args.endDate === 'current' ? getCurrentDate() : args.endDate,
  globalDefaults,
  stocks,
  stockSpecificOverrides: {}
};

// Write config to file
writeConfigFile(config, args.output);

console.log(`Portfolio config written to: ${args.output}`);
```

## Data Flow

### Request Flow

1. **User sends request**: `POST /api/backtest/portfolio/config` with `{ configFile: "nasdaq100.json" }`

2. **Config Loader**:
   - Check cache for config
   - If not cached, read from `backend/configs/portfolios/nasdaq100.json`
   - Validate JSON structure
   - Validate required fields
   - Validate data types and ranges
   - Cache validated config
   - Return config object

3. **Parameter Conversion**:
   - Extract portfolio-level params (totalCapital, dates)
   - For each stock in `stocks` array:
     - Start with `globalDefaults`
     - Merge with stock-specific overrides from `stockSpecificOverrides`
     - Create stock object with all parameters
   - Build final parameters object

4. **Backtest Execution**:
   - Pass parameters to existing `portfolioBacktestService`
   - Service runs backtest for all stocks
   - Returns aggregated results

5. **Response**:
   - Return backtest results with meta info (config file name, portfolio name)

### Example Data Transformation

**Input Config**:
```json
{
  "name": "Tech Portfolio",
  "totalCapitalUsd": 100000,
  "startDate": "2023-01-01",
  "endDate": "2024-01-01",
  "globalDefaults": {
    "lotSizeUsd": 5000,
    "maxLots": 5,
    "gridIntervalPercent": 10
  },
  "stocks": ["AAPL", "MSFT"],
  "stockSpecificOverrides": {
    "AAPL": {
      "lotSizeUsd": 7000
    }
  }
}
```

**Output Backtest Parameters**:
```json
{
  "totalCapitalUsd": 100000,
  "startDate": "2023-01-01",
  "endDate": "2024-01-01",
  "stocks": [
    {
      "symbol": "AAPL",
      "lotSizeUsd": 7000,
      "maxLots": 5,
      "gridIntervalPercent": 10
    },
    {
      "symbol": "MSFT",
      "lotSizeUsd": 5000,
      "maxLots": 5,
      "gridIntervalPercent": 10
    }
  ]
}
```

## Error Handling

### Error Types

1. **Config Not Found**:
```json
{
  "success": false,
  "error": "Config file not found: nasdaq100.json"
}
```

2. **Invalid JSON**:
```json
{
  "success": false,
  "error": "Invalid JSON in config file: nasdaq100.json"
}
```

3. **Missing Required Field**:
```json
{
  "success": false,
  "error": "Missing required field: totalCapitalUsd"
}
```

4. **Invalid Data Type**:
```json
{
  "success": false,
  "error": "Invalid type for field 'stocks': expected array, got string"
}
```

5. **Invalid Date Format**:
```json
{
  "success": false,
  "error": "Invalid date format for 'startDate': expected YYYY-MM-DD, got 01/01/2023"
}
```

6. **Empty Stocks Array**:
```json
{
  "success": false,
  "error": "Stocks array cannot be empty"
}
```

## File Structure

```
backend/
├── configs/
│   └── portfolios/
│       ├── nasdaq100.json
│       ├── tech-portfolio.json
│       └── example-portfolio.json
├── data/
│   └── nasdaq100-symbols.txt
├── scripts/
│   └── generatePortfolioConfig.js
├── services/
│   ├── portfolioConfigLoader.js  (NEW)
│   └── portfolioBacktestService.js (existing)
├── server.js (modified - add new routes)
└── test_nasdaq100_portfolio.sh (NEW)
```

## Testing Strategy

### Unit Tests

1. **Config Validation**:
   - Valid config passes validation
   - Missing required fields fail
   - Invalid data types fail
   - Invalid date formats fail
   - Empty stocks array fails

2. **Config to Parameters Conversion**:
   - Global defaults applied to all stocks
   - Stock-specific overrides merge correctly
   - Parameters structure matches expected format

3. **Config Loading**:
   - Config file loads successfully
   - Non-existent file throws error
   - Invalid JSON throws error
   - Config caching works correctly

### Integration Tests

1. **API Endpoint Tests**:
   - POST endpoint with valid config returns results
   - POST endpoint with invalid config returns error
   - GET endpoint with valid config name returns results
   - GET endpoint with invalid config name returns error

2. **End-to-End Tests**:
   - Generate config with helper script
   - Run backtest using generated config
   - Verify results match expected format
   - Test with Nasdaq 100 (100 stocks)

### Test Scripts

1. `test_portfolio_config_small.sh` - Test with 3 stocks
2. `test_portfolio_config_large.sh` - Test with 50 stocks
3. `test_nasdaq100_portfolio.sh` - Test with Nasdaq 100

## Performance Considerations

### Caching Strategy

- **Cache configs in memory** after first load
- **Cache key**: Config file name
- **Cache invalidation**: Manual restart or cache clear endpoint
- **Memory usage**: ~1KB per config file, negligible for 100s of configs

### File I/O Optimization

- **Read config files asynchronously** (use `fs.promises`)
- **Parallel backtest execution** (existing service handles this)
- **Stream large responses** if needed (existing service handles this)

### URL Length Comparison

**Current GET URL** (10 stocks):
```
http://localhost:3000/backtest/portfolio?stocks=AAPL,MSFT,NVDA,...&totalCapital=1000000&lotSizeUsd=10000&...
~500-1000 characters
```

**New GET URL** (100 stocks):
```
http://localhost:3001/api/backtest/portfolio/config/nasdaq100
~60 characters
```

**Improvement**: ~90% reduction in URL length

## Security Considerations

1. **File Path Validation**:
   - Sanitize config file names to prevent directory traversal
   - Only allow alphanumeric + hyphen + underscore
   - Restrict to `configs/portfolios/` directory

2. **JSON Validation**:
   - Validate all input fields
   - Reject unknown fields (strict schema)
   - Limit array sizes (max 200 stocks)

3. **Resource Limits**:
   - Max config file size: 1MB
   - Max stocks per config: 200
   - Rate limit API endpoints

## Future Enhancements

1. **Config File Management API**:
   - GET /api/configs/portfolios - List all configs
   - DELETE /api/configs/portfolios/:name - Delete config
   - PUT /api/configs/portfolios/:name - Update config

2. **Config Versioning**:
   - Track config file versions
   - Support rollback to previous versions

3. **Web UI for Config Creation**:
   - Form-based config builder
   - Drag-and-drop stock selection
   - Parameter presets

4. **Config Templates**:
   - Pre-built configs for common scenarios
   - S&P 500, Nasdaq 100, Dow 30, etc.

## References

- Existing portfolio backtest service: `backend/services/portfolioBacktestService.js`
- Existing defaults: `config/backtestDefaults.json`
- Node.js fs.promises API: https://nodejs.org/api/fs.html#promises-api
