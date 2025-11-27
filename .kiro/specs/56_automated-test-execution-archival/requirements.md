# Spec 56: Automated Test Execution and Result Archival

## Overview
Create an automated testing framework that allows users to describe test configurations in natural language, automatically generate necessary config files and test commands, execute tests, and archive all artifacts (configs, commands, and HTML results) in organized folders for later review.

## Problem Statement
Currently, running tests and reviewing results requires manual steps:
1. Manually creating config files
2. Manually constructing frontend URLs or curl commands
3. Running tests through browser or terminal
4. Manually saving/capturing results
5. No systematic way to archive test runs for comparison
6. Difficult to reproduce exact test scenarios later

This makes systematic testing, regression testing, and result comparison inefficient.

## User Stories

### Story 1: Portfolio Test with Beta Filter
**As a** user
**I want to** describe a test like "portfolio backtest with stocks beta > 1.75"
**So that** the system automatically:
- Generates a portfolio config file with filtered stocks
- Provides the frontend URL to run the test
- Provides the curl command for backend execution
- Runs the test and saves results as HTML
- Archives everything in a timestamped folder

### Story 2: Batch Parameter Sweep
**As a** user
**I want to** describe a test like "batch mode testing gridIntervalPercent values [5, 10, 15, 20] with default params"
**So that** the system automatically:
- Generates batch test configuration
- Provides test execution commands
- Runs the batch test
- Saves result comparison HTML
- Archives with descriptive folder name

### Story 3: Test Result Review
**As a** user
**I want to** review archived test results
**So that** I can:
- Compare different test runs
- Reproduce exact test conditions
- Share test results with others
- Track performance over time

## Requirements

### Functional Requirements

#### FR1: Test Description Parser
- Accept natural language test descriptions
- Parse test type (portfolio, batch, single)
- Extract filter criteria (e.g., beta > 1.75)
- Extract parameter values and ranges
- Identify required stocks or stock lists

#### FR2: Config File Generation
- Generate portfolio config JSON files for portfolio tests
- Generate batch test configurations
- Generate single backtest configurations
- Apply filters to stock lists (beta, sector, market cap, etc.)
- Validate generated configs before saving

#### FR3: Command Generation
- Generate frontend URLs with all necessary query parameters
- Generate curl commands for backend API calls
- Include all test parameters in commands
- Ensure commands are executable and reproducible

#### FR4: Test Execution
- Execute tests via backend API calls
- Capture full API responses
- Handle async/sync modes appropriately
- Monitor test progress
- Detect and report test failures

#### FR5: Result HTML Generation
- Convert API JSON responses to readable HTML
- Include charts, tables, and summaries
- Preserve all result data
- Make HTML self-contained (embedded CSS/JS if needed)
- Format for easy review and comparison

#### FR6: Test Archival System
- Create timestamped folders for each test run
- Use descriptive folder names (e.g., `2025-01-09_143022_portfolio-beta-gt-1.75`)
- Save all artifacts:
  - Generated config files
  - Frontend URL
  - curl command(s)
  - Test description
  - Result HTML
  - Test metadata (timestamp, duration, status)
- Organize in project's test archive directory

### Non-Functional Requirements

#### NFR1: Usability
- Simple natural language interface for test descriptions
- Clear, readable HTML output
- Easy navigation of archived tests
- Self-documenting test artifacts

#### NFR2: Reproducibility
- All artifacts needed to rerun test must be saved
- Commands must be copy-pasteable
- Configs must be complete and valid
- Results must match original run when reproduced

#### NFR3: Performance
- Test execution should not be slower than manual execution
- HTML generation should complete within 2 seconds
- Archive creation should not impact test performance

#### NFR4: Maintainability
- Modular design for easy extension to new test types
- Clear separation of concerns (parsing, generation, execution, archival)
- Well-documented code
- Reusable components

## Supported Test Types

### 1. Portfolio Backtest with Filters
**Description format:** "portfolio backtest with [filter criteria]"

**Filter criteria examples:**
- `beta > 1.75`
- `beta < 1.0`
- `sector == Technology`
- `market cap > 1B`
- `stocks: [AAPL, MSFT, GOOGL]`

**Generates:**
- Portfolio config JSON file
- Frontend URL: `http://localhost:3000/portfolio-backtest?config=[generated-config-name]`
- curl command for `/api/portfolio-backtest`

### 2. Batch Parameter Sweep
**Description format:** "batch mode testing [parameter] values [value list] with [other constraints]"

**Examples:**
- `batch mode testing gridIntervalPercent values [5, 10, 15, 20] with default params`
- `batch mode testing profitRequirement values [5, 10, 15] for AAPL`

**Generates:**
- Batch test config JSON
- Frontend URL with parameter ranges
- curl command for `/api/backtest/batch`

### 3. Single Stock Backtest
**Description format:** "single backtest for [symbol] with [parameters]"

**Examples:**
- `single backtest for AAPL with beta scaling enabled`
- `single backtest for NVDA with gridInterval=15`

**Generates:**
- Single backtest params
- Frontend URL with all parameters
- curl command for `/api/backtest/dca`

## Archive Folder Structure

```
test-results/
├── 2025-01-09_143022_portfolio-beta-gt-1.75/
│   ├── README.md                    # Test description and summary
│   ├── config.json                  # Generated config file
│   ├── frontend-url.txt             # Frontend URL
│   ├── curl-command.sh              # Executable curl command
│   ├── result.html                  # Test result HTML
│   └── metadata.json                # Test metadata (timestamp, duration, etc.)
│
├── 2025-01-09_144530_batch-gridInterval-sweep/
│   ├── README.md
│   ├── config.json
│   ├── frontend-url.txt
│   ├── curl-command.sh
│   ├── result.html
│   └── metadata.json
│
└── index.html                       # Archive index listing all tests
```

## Example Workflows

### Example 1: Portfolio Test with Beta Filter

**User input:**
```
"Run portfolio backtest with stocks where beta > 1.75"
```

**System actions:**
1. Parse criteria: portfolio test, filter by beta > 1.75
2. Query beta database, get stocks: [NVDA, AMD, TSLA, ...]
3. Generate `portfolio-beta-gt-1.75.json` config file
4. Generate frontend URL and curl command
5. Execute backend API call
6. Convert JSON response to HTML
7. Create archive folder: `2025-01-09_143022_portfolio-beta-gt-1.75/`
8. Save all artifacts
9. Report success and provide archive location

### Example 2: Batch Parameter Sweep

**User input:**
```
"Test gridIntervalPercent values [5, 10, 15, 20] for AAPL with all other defaults"
```

**System actions:**
1. Parse: batch test, parameter=gridIntervalPercent, values=[5,10,15,20], symbol=AAPL
2. Generate batch config JSON
3. Generate frontend URL and curl command
4. Execute batch backtest
5. Convert batch results to comparison HTML
6. Archive with folder: `2025-01-09_144530_batch-gridInterval-AAPL/`
7. Save all artifacts
8. Report results location

## Success Criteria

1. **Automation**: User can describe test in one sentence and get complete test execution + archival
2. **Reproducibility**: Archived tests can be re-run from saved artifacts with identical results
3. **Discoverability**: Archive index HTML allows easy browsing of past tests
4. **Completeness**: All necessary information saved (no manual reconstruction needed)
5. **Usability**: HTML results are readable and useful for decision-making

## Out of Scope (Future Enhancements)

- Web UI for test management
- Automated regression testing (schedule periodic runs)
- Result comparison visualization (diff between test runs)
- Test templates and presets
- Export to PDF or other formats
- Integration with CI/CD pipelines

## Dependencies

- Existing backend API endpoints (portfolio, batch, single backtest)
- Beta database for stock filtering
- Frontend result pages
- File system access for archival

## Risks and Mitigations

**Risk:** Natural language parsing might misinterpret user intent
**Mitigation:** Show parsed intent back to user for confirmation before execution

**Risk:** Generated configs might be invalid
**Mitigation:** Validate configs before saving and executing

**Risk:** Disk space usage from archived tests
**Mitigation:** Implement optional cleanup policy (auto-delete tests older than X days)

## Notes

- This spec is for design and planning only - no code changes yet
- Implementation will require Python script or Node.js service
- Could be integrated as Claude Code skill or standalone CLI tool
- Archive location should be configurable (default: `test-results/` in project root)
