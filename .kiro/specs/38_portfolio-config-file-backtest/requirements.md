# Requirements: Portfolio Config File Backtest

## Problem Statement

Currently, portfolio backtests must be run via GET requests with all parameters in the URL. For large portfolios (e.g., Nasdaq 100 with 100 stocks), this approach has several limitations:

1. **URL Length Limits**: Browser and server URL length limits (~2000-8000 characters) can be exceeded with 100 stocks
2. **Poor Maintainability**: Long URLs are difficult to read, modify, and version control
3. **No Reusability**: Cannot easily save and reuse portfolio configurations
4. **Limited Testing**: Difficult to create automated test scripts for complex portfolios

## User Story

As a user running portfolio backtests, I want to define my portfolio configuration in a JSON file so that I can:
- Run backtests on large portfolios (100+ stocks) without URL length limitations
- Save and version control my portfolio configurations
- Easily modify and reuse portfolio setups
- Create automated test scripts that reference config files
- Share portfolio configurations with others

## Functional Requirements

### 1. Portfolio Config File Format

#### 1.1 File Format
- **Format**: JSON
- **Location**: `backend/configs/portfolios/` directory
- **Naming Convention**: `{name}.json` (e.g., `nasdaq100.json`, `tech-portfolio.json`)

#### 1.2 Config File Schema

```json
{
  "name": "Portfolio Name",
  "description": "Optional description",
  "totalCapitalUsd": 3000000,
  "startDate": "2021-09-01",
  "endDate": "2025-10-17",
  "globalDefaults": {
    "lotSizeUsd": 10000,
    "maxLots": 10,
    "gridIntervalPercent": 10,
    "profitRequirement": 10,
    "trailingBuyActivationPercent": 10,
    "trailingBuyReboundPercent": 5,
    "trailingSellActivationPercent": 20,
    "trailingSellPullbackPercent": 10,
    "enableTrailingBuy": false,
    "enableTrailingSell": false,
    "enableConsecutiveIncrementalBuyGrid": true,
    "gridConsecutiveIncrement": 5,
    "enableConsecutiveIncrementalSellProfit": false
  },
  "stocks": [
    "AAPL",
    "MSFT",
    "NVDA",
    "..."
  ],
  "stockSpecificOverrides": {
    "AAPL": {
      "lotSizeUsd": 15000,
      "maxLots": 15
    },
    "TSLA": {
      "gridIntervalPercent": 15,
      "profitRequirement": 15
    }
  }
}
```

#### 1.3 Config Field Definitions

**Portfolio-Level Fields**:
- `name` (string, required): Portfolio name
- `description` (string, optional): Portfolio description
- `totalCapitalUsd` (number, required): Total capital allocated to portfolio
- `startDate` (string, required): Backtest start date (YYYY-MM-DD)
- `endDate` (string, required): Backtest end date (YYYY-MM-DD or "current")
- `globalDefaults` (object, required): Default DCA parameters for all stocks
- `stocks` (array, required): List of stock symbols
- `stockSpecificOverrides` (object, optional): Per-stock parameter overrides

**globalDefaults Fields**: All fields from `backtestDefaults.json` are supported

**stockSpecificOverrides**: Any field from `globalDefaults` can be overridden per stock

### 2. API Endpoint

#### 2.1 New Endpoint: POST /api/backtest/portfolio/config

**Request Body**:
```json
{
  "configFile": "nasdaq100.json"
}
```

**Response**: Same format as existing `POST /api/backtest/portfolio` endpoint

#### 2.2 Simplified GET Endpoint

**Endpoint**: `GET /api/backtest/portfolio/config/:configName`

**Example**: `GET /api/backtest/portfolio/config/nasdaq100`

This provides a simple URL that users can bookmark or share.

### 3. Config File Validation

The system must validate:
1. **File Existence**: Config file exists in `backend/configs/portfolios/`
2. **JSON Validity**: File contains valid JSON
3. **Required Fields**: All required fields are present
4. **Data Types**: Fields have correct data types
5. **Date Format**: Dates are in YYYY-MM-DD format
6. **Stock Symbols**: Stock list is non-empty array
7. **Parameter Values**: Parameters are within valid ranges

Error responses must clearly indicate what validation failed.

### 4. Helper Script

Create a Node.js script `backend/scripts/generatePortfolioConfig.js` that:

**Input**: Command-line arguments or interactive prompts
**Output**: Generated portfolio config JSON file

**Usage Example**:
```bash
node scripts/generatePortfolioConfig.js \
  --name "Nasdaq 100" \
  --stocks-file "data/nasdaq100-symbols.txt" \
  --total-capital 3000000 \
  --lot-size 10000 \
  --max-lots 10 \
  --start-date 2021-09-01 \
  --end-date current \
  --use-defaults
```

### 5. Nasdaq 100 Use Case

Create a complete example demonstrating the feature:

1. **Data File**: `backend/data/nasdaq100-symbols.txt` containing all 100 Nasdaq symbols
2. **Config File**: `backend/configs/portfolios/nasdaq100.json` generated from the data
3. **Test Script**: `backend/test_nasdaq100_portfolio.sh` that runs the backtest

**Test Script Example**:
```bash
#!/bin/bash
# Test Nasdaq 100 portfolio backtest using config file

curl -X POST http://localhost:3001/api/backtest/portfolio/config \
  -H "Content-Type: application/json" \
  -d '{"configFile": "nasdaq100.json"}' \
  | jq '.'
```

Or using simplified GET:
```bash
curl http://localhost:3001/api/backtest/portfolio/config/nasdaq100 | jq '.'
```

## Non-Functional Requirements

### Performance
- Config file loading should be fast (<100ms for typical portfolios)
- Config files should be cached in memory to avoid repeated disk reads
- Cache should invalidate when config file is modified

### Maintainability
- Config file format should be well-documented
- JSON schema should be exportable for IDE validation
- Error messages should be clear and actionable

### Usability
- Config files should be human-readable and easy to edit
- Example config files should be provided
- Helper script should make it easy to create new configs

## Success Criteria

1. ✅ Successfully run Nasdaq 100 portfolio backtest (100 stocks) using config file
2. ✅ Config file size is reasonable (<50KB for 100 stocks)
3. ✅ URL for GET endpoint is short (<200 characters)
4. ✅ Config validation provides clear error messages
5. ✅ Helper script generates valid config files
6. ✅ Documentation is complete and clear

## Out of Scope

- Web UI for creating/editing config files (future enhancement)
- Config file encryption or authentication (use file system permissions)
- Real-time config file watching/hot-reload (manual restart required)
- Config file versioning or history tracking (use git)

## References

- Existing portfolio backtest endpoint: `POST /api/backtest/portfolio`
- Existing defaults file: `config/backtestDefaults.json`
- Existing URL parameter manager: `frontend/src/utils/URLParameterManager.js`
