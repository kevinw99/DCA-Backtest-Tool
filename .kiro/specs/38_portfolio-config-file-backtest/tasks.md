# Tasks: Portfolio Config File Backtest

## Phase 1: Setup and Config Loader

### Task 1.1: Create directory structure
- [ ] Create `backend/configs/portfolios/` directory
- [ ] Create `backend/data/` directory
- [ ] Create `backend/scripts/` directory

### Task 1.2: Implement portfolioConfigLoader.js
- [ ] Create `backend/services/portfolioConfigLoader.js`
- [ ] Implement `loadPortfolioConfig(configName)` function
  - Read config file from disk using fs.promises
  - Parse JSON
  - Cache in memory
  - Return validated config
- [ ] Implement `validateConfig(config)` function
  - Validate required fields (name, totalCapitalUsd, startDate, endDate, globalDefaults, stocks)
  - Validate data types
  - Validate date formats (YYYY-MM-DD)
  - Validate stocks array is non-empty
  - Validate parameter ranges
- [ ] Implement `configToBacktestParams(config)` function
  - Extract portfolio-level parameters
  - Merge global defaults with stock-specific overrides
  - Return parameters in format expected by portfolioBacktestService
- [ ] Implement `clearConfigCache()` function for testing
- [ ] Add error handling with clear error messages

### Task 1.3: Create example config file
- [ ] Create `backend/configs/portfolios/example-portfolio.json`
- [ ] Include 3-5 stocks
- [ ] Use realistic parameters
- [ ] Add comments in a separate .md file explaining the structure

## Phase 2: API Endpoints

### Task 2.1: Add POST /api/backtest/portfolio/config endpoint
- [ ] Import portfolioConfigLoader in server.js
- [ ] Add POST route handler
- [ ] Extract configFile from request body
- [ ] Load and validate config
- [ ] Convert config to backtest parameters
- [ ] Call existing portfolioBacktestService
- [ ] Return results with meta info
- [ ] Handle errors and return appropriate status codes

### Task 2.2: Add GET /api/backtest/portfolio/config/:configName endpoint
- [ ] Add GET route handler
- [ ] Extract configName from URL params
- [ ] Load and validate config
- [ ] Convert config to backtest parameters
- [ ] Call existing portfolioBacktestService
- [ ] Return results with meta info
- [ ] Handle errors and return appropriate status codes

### Task 2.3: Add logging
- [ ] Log config file loads
- [ ] Log validation failures
- [ ] Log backtest execution start/end
- [ ] Log errors with stack traces

## Phase 3: Helper Script

### Task 3.1: Implement generatePortfolioConfig.js
- [ ] Create `backend/scripts/generatePortfolioConfig.js`
- [ ] Implement command-line argument parsing
  - --name: Portfolio name
  - --description: Portfolio description (optional)
  - --stocks-file: Path to file with stock symbols (one per line)
  - --stocks: Comma-separated stock symbols (alternative to stocks-file)
  - --total-capital: Total capital in USD
  - --start-date: Start date (YYYY-MM-DD)
  - --end-date: End date (YYYY-MM-DD or "current")
  - --use-defaults: Use global defaults from backtestDefaults.json
  - --lot-size: Lot size in USD (if not using defaults)
  - --max-lots: Max lots per stock (if not using defaults)
  - --output: Output file path
- [ ] Implement `loadStocksFromFile(filePath)` function
- [ ] Implement `loadBacktestDefaults()` function
- [ ] Implement `buildDefaultsFromArgs(args)` function
- [ ] Implement `getCurrentDate()` function (returns today in YYYY-MM-DD)
- [ ] Implement `writeConfigFile(config, outputPath)` function
- [ ] Add validation for required arguments
- [ ] Add help text (--help flag)
- [ ] Add error handling

### Task 3.2: Test helper script
- [ ] Create test stocks file with 5 stocks
- [ ] Run script with --use-defaults flag
- [ ] Run script with custom parameters
- [ ] Verify generated config is valid JSON
- [ ] Verify generated config passes validation

## Phase 4: Testing

### Task 4.1: Create test script for small portfolio
- [ ] Create `backend/test_portfolio_config_small.sh`
- [ ] Create config file with 3 stocks (AAPL, MSFT, NVDA)
- [ ] Test POST endpoint
- [ ] Test GET endpoint
- [ ] Verify results structure
- [ ] Check for errors

### Task 4.2: Create test script for medium portfolio
- [ ] Create `backend/test_portfolio_config_medium.sh`
- [ ] Create config file with 20 stocks
- [ ] Test POST endpoint
- [ ] Test GET endpoint
- [ ] Verify performance is acceptable

### Task 4.3: Test error handling
- [ ] Test with non-existent config file
- [ ] Test with invalid JSON
- [ ] Test with missing required fields
- [ ] Test with invalid data types
- [ ] Test with invalid date formats
- [ ] Test with empty stocks array
- [ ] Verify error messages are clear

## Phase 5: Nasdaq 100 Implementation

### Task 5.1: Get Nasdaq 100 stocks list
- [ ] Research current Nasdaq 100 components
- [ ] Create `backend/data/nasdaq100-symbols.txt`
- [ ] Include all 100 stock symbols (one per line)
- [ ] Verify symbols are valid and active

### Task 5.2: Generate Nasdaq 100 config
- [ ] Use helper script to generate config
- [ ] Set total capital to $3,000,000
- [ ] Set lot size to $10,000
- [ ] Set max lots to 10
- [ ] Set start date to 2021-09-01
- [ ] Set end date to current date
- [ ] Use global defaults from backtestDefaults.json
- [ ] Save to `backend/configs/portfolios/nasdaq100.json`

### Task 5.3: Create Nasdaq 100 test script
- [ ] Create `backend/test_nasdaq100_portfolio.sh`
- [ ] Test using GET endpoint (short URL)
- [ ] Pipe output to jq for formatting
- [ ] Add timing to measure performance
- [ ] Save results to file

### Task 5.4: Run and verify Nasdaq 100 backtest
- [ ] Run test script
- [ ] Verify all 100 stocks are processed
- [ ] Verify results structure is correct
- [ ] Verify performance metrics are calculated
- [ ] Check execution time (should be reasonable)
- [ ] Save results for documentation

## Phase 6: Documentation and Cleanup

### Task 6.1: Create README for portfolio configs
- [ ] Create `backend/configs/portfolios/README.md`
- [ ] Explain config file format
- [ ] Provide usage examples
- [ ] Document all config fields
- [ ] Link to helper script documentation

### Task 6.2: Update main documentation
- [ ] Add section to main README about config-based portfolio backtests
- [ ] Document API endpoints
- [ ] Provide curl examples
- [ ] Explain URL length benefits

### Task 6.3: Add examples
- [ ] Create example config for tech portfolio
- [ ] Create example config for dividend portfolio
- [ ] Add comments explaining each config

### Task 6.4: Code cleanup
- [ ] Remove debug console.log statements
- [ ] Ensure consistent error handling
- [ ] Add JSDoc comments to all functions
- [ ] Run linter and fix issues
- [ ] Test all functionality end-to-end

### Task 6.5: Git commit
- [ ] Stage all new files
- [ ] Review changes
- [ ] Create comprehensive commit message
- [ ] Push to repository

## Success Criteria

All tasks complete when:
- ✅ Config loader validates configs correctly
- ✅ API endpoints work for both POST and GET
- ✅ Helper script generates valid configs
- ✅ Small portfolio test passes
- ✅ Nasdaq 100 backtest runs successfully (100 stocks)
- ✅ GET URL is short (~60 characters)
- ✅ Error handling provides clear messages
- ✅ Documentation is complete
- ✅ All code is committed and pushed

## Estimated Time

- Phase 1: 1-2 hours
- Phase 2: 1 hour
- Phase 3: 1 hour
- Phase 4: 1 hour
- Phase 5: 1-2 hours
- Phase 6: 30 minutes

Total: ~5-7 hours

## Dependencies

- Existing `portfolioBacktestService.js` must be working
- Node.js fs.promises API
- Existing `backtestDefaults.json`
- Express.js for API routes
