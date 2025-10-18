# Portfolio Config Files

This directory contains portfolio configuration files for running config-based portfolio backtests.

## Overview

Config-based portfolio backtests allow you to:
- Define large portfolios (100+ stocks) without URL length limitations
- Version control your portfolio configurations
- Easily modify and reuse portfolio setups
- Share portfolio configurations with others
- Run automated tests with simple, short URLs

## Config File Format

Portfolio config files are JSON files with the following structure:

```json
{
  "name": "Portfolio Name",
  "description": "Optional description of the portfolio",
  "totalCapitalUsd": 3000000,
  "startDate": "2021-09-01",
  "endDate": "2025-10-17",
  "globalDefaults": {
    "basic": {
      "lotSizeUsd": 10000,
      "strategyMode": "long"
    },
    "longStrategy": {
      "maxLots": 10,
      "gridIntervalPercent": 10,
      "profitRequirement": 10,
      ...
    },
    ...
  },
  "stocks": [
    "AAPL",
    "MSFT",
    "NVDA",
    ...
  ],
  "stockSpecificOverrides": {
    "AAPL": {
      "basic": {
        "lotSizeUsd": 15000
      },
      "longStrategy": {
        "maxLots": 15
      }
    }
  }
}
```

## Required Fields

- **name** (string): Portfolio name
- **totalCapitalUsd** (number): Total capital allocated to portfolio (minimum: 1000)
- **startDate** (string): Backtest start date in YYYY-MM-DD format
- **endDate** (string): Backtest end date (YYYY-MM-DD or "current" for today)
- **globalDefaults** (object): Default DCA parameters for all stocks
- **stocks** (array): List of stock symbols (1-200 stocks)

## Optional Fields

- **description** (string): Portfolio description
- **stockSpecificOverrides** (object): Per-stock parameter overrides

## Running Backtests

### Using GET Endpoint (Simplest)

```bash
curl http://localhost:3001/api/backtest/portfolio/config/nasdaq100
```

The config file name is `nasdaq100.json`, but you only need to specify `nasdaq100` in the URL.

### Using POST Endpoint

```bash
curl -X POST http://localhost:3001/api/backtest/portfolio/config \
  -H "Content-Type: application/json" \
  -d '{"configFile": "nasdaq100"}'
```

## Creating Config Files

### Using the Generator Script

The easiest way to create a config file is using the `generatePortfolioConfig.js` script:

```bash
# Using a stock symbols file
node scripts/generatePortfolioConfig.js \
  --name "Nasdaq 100" \
  --stocks-file "data/nasdaq100-symbols.txt" \
  --total-capital 3000000 \
  --start-date 2021-09-01 \
  --end-date current \
  --use-defaults \
  --output configs/portfolios/nasdaq100.json

# Using comma-separated stocks
node scripts/generatePortfolioConfig.js \
  --name "Tech Portfolio" \
  --stocks "AAPL,MSFT,NVDA,TSLA,GOOGL" \
  --total-capital 500000 \
  --start-date 2023-01-01 \
  --end-date current \
  --use-defaults \
  --output configs/portfolios/tech-portfolio.json
```

### Generator Script Options

**Required:**
- `--name`: Portfolio name
- `--total-capital`: Total capital in USD
- `--start-date`: Start date (YYYY-MM-DD)
- `--end-date`: End date (YYYY-MM-DD or "current")
- `--output`: Output file path

**Stock Selection (one required):**
- `--stocks-file`: Path to file with stock symbols (one per line)
- `--stocks`: Comma-separated stock symbols

**Parameters (one required):**
- `--use-defaults`: Use global defaults from `config/backtestDefaults.json`
- OR provide custom parameters:
  - `--lot-size`: Lot size in USD (default: 10000)
  - `--max-lots`: Max lots per stock (default: 10)
  - `--grid-interval`: Grid interval percent (default: 10)
  - `--profit-requirement`: Profit requirement percent (default: 10)

**Optional:**
- `--description`: Portfolio description
- `--help`: Show help message

## Example Configs

### Small Tech Portfolio (3 stocks)

```bash
node scripts/generatePortfolioConfig.js \
  --name "Tech Portfolio Example" \
  --stocks "AAPL,MSFT,NVDA" \
  --total-capital 500000 \
  --start-date 2023-01-01 \
  --end-date current \
  --use-defaults \
  --output configs/portfolios/example-tech.json
```

### Nasdaq 100 (92 stocks)

```bash
node scripts/generatePortfolioConfig.js \
  --name "Nasdaq 100" \
  --stocks-file "data/nasdaq100-symbols.txt" \
  --total-capital 3000000 \
  --start-date 2021-09-01 \
  --end-date current \
  --use-defaults \
  --output configs/portfolios/nasdaq100.json
```

## Stock-Specific Overrides

You can override parameters for specific stocks by editing the `stockSpecificOverrides` field:

```json
{
  "globalDefaults": {
    "basic": { "lotSizeUsd": 10000 },
    "longStrategy": { "maxLots": 10 }
  },
  "stocks": ["AAPL", "MSFT"],
  "stockSpecificOverrides": {
    "AAPL": {
      "basic": { "lotSizeUsd": 15000 },
      "longStrategy": { "maxLots": 15 }
    }
  }
}
```

In this example:
- MSFT uses global defaults: lotSize=$10,000, maxLots=10
- AAPL uses overrides: lotSize=$15,000, maxLots=15

## Testing

Test scripts are available in the `backend/` directory:

```bash
# Test small portfolio (3 stocks)
./test_portfolio_config_example.sh

# Test Nasdaq 100 portfolio (92 stocks)
./test_nasdaq100_portfolio.sh
```

## Validation

The config loader validates:
- Required fields are present
- Data types are correct
- Dates are in YYYY-MM-DD format
- Stock list is non-empty and has 1-200 stocks
- Stock symbols are uppercase alphanumeric with dots/hyphens
- Parameters are within valid ranges
- Stock overrides only reference stocks in the stocks array

## Caching

Config files are cached in memory after first load for performance. To reload a config file, restart the server.

## File Naming

- Use lowercase, hyphenated names: `nasdaq100.json`, `tech-portfolio.json`
- Only alphanumeric characters, hyphens, and underscores allowed
- No directory traversal (paths are sanitized)

## Security

- Config file names are sanitized to prevent directory traversal attacks
- Only files in `backend/configs/portfolios/` can be loaded
- Maximum 200 stocks per config
- Maximum config file size: 1MB

## Example Files

This directory includes:
- `nasdaq100.json` - Nasdaq 100 component stocks ($3M capital, 2021-09-01 to current)
- `example-tech.json` - Small tech portfolio for testing (3 stocks, $500K capital)

## API Response Format

The config-based backtest endpoints return:

```json
{
  "success": true,
  "data": {
    "portfolioRunId": "...",
    "stocks": [...],
    "portfolioMetrics": {
      "finalValue": 3500000,
      "totalReturn": 500000,
      "totalReturnPercent": 16.67,
      "sharpeRatio": 1.5,
      "maxDrawdown": -15.2,
      "buyAndHold": {
        "finalValue": 4000000,
        "totalReturn": 1000000,
        "totalReturnPercent": 33.33
      },
      "stocks": [
        {
          "symbol": "AAPL",
          "finalValue": 45000,
          "totalReturn": 5000,
          "totalReturnPercent": 12.5,
          ...
        },
        ...
      ]
    },
    "totalTransactions": 150,
    "rejectedOrders": 5
  },
  "meta": {
    "configFile": "nasdaq100.json",
    "portfolioName": "Nasdaq 100",
    "portfolioDescription": "Portfolio backtest for all Nasdaq 100 component stocks"
  }
}
```

## URL Comparison

**Before (URL parameters for 10 stocks):**
```
http://localhost:3001/api/backtest/portfolio?stocks=AAPL,MSFT,NVDA,...&totalCapital=1000000&...
~500-1000 characters
```

**After (config-based for 100 stocks):**
```
http://localhost:3001/api/backtest/portfolio/config/nasdaq100
~60 characters
```

**Improvement:** ~90% reduction in URL length

## Troubleshooting

### Config file not found
- Ensure the file exists in `backend/configs/portfolios/`
- Use the correct file name (without `.json` extension in the URL)
- Check file permissions

### Invalid JSON
- Validate JSON syntax using a JSON linter
- Ensure all quotes are double quotes
- Check for trailing commas

### Missing required field
- Verify all required fields are present
- Check field names match exactly (case-sensitive)

### Invalid date format
- Use YYYY-MM-DD format
- Use "current" for today's date

### Empty stocks array
- Ensure at least one stock symbol in the array
- Check for comments or empty lines in stock symbols file

## References

- Portfolio Backtest Service: `backend/services/portfolioBacktestService.js`
- Config Loader Service: `backend/services/portfolioConfigLoader.js`
- Default Parameters: `config/backtestDefaults.json`
- Generator Script: `backend/scripts/generatePortfolioConfig.js`
