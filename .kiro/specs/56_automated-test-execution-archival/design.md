# Spec 56: Design Document - Automated Test Execution and Archival

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface                            │
│  (Natural Language Test Description or CLI Command)         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              Test Orchestrator (Main Entry Point)           │
│  - Parse test description                                    │
│  - Coordinate all components                                 │
│  - Handle errors and reporting                               │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┼──────────┬──────────────┐
        │          │          │              │
        ▼          ▼          ▼              ▼
┌─────────┐  ┌──────────┐ ┌────────┐  ┌──────────┐
│ Config  │  │ Command  │ │ Test   │  │ Archive  │
│Generator│  │Generator │ │Executor│  │ Manager  │
└─────────┘  └──────────┘ └────────┘  └──────────┘
     │            │           │              │
     └────────────┴───────────┴──────────────┘
                   │
                   ▼
            ┌─────────────┐
            │  File       │
            │  System     │
            └─────────────┘
```

## Component Design

### 1. Test Orchestrator

**Responsibility:** Main entry point that coordinates all test execution and archival.

**Interface:**
```python
class TestOrchestrator:
    def execute_test(self, description: str) -> TestResult:
        """
        Parse description, generate configs, execute test, and archive results.

        Args:
            description: Natural language test description

        Returns:
            TestResult with archive location and status
        """
        pass
```

**Flow:**
1. Parse test description → TestConfig
2. Generate config files → ConfigFiles
3. Generate commands → Commands
4. Execute test → RawResults
5. Convert to HTML → HTMLResult
6. Archive all artifacts → ArchiveLocation
7. Return TestResult

### 2. Test Description Parser

**Responsibility:** Parse natural language descriptions into structured test configs.

**Interface:**
```python
class TestDescriptionParser:
    def parse(self, description: str) -> TestConfig:
        """
        Parse natural language into structured test configuration.

        Returns TestConfig with:
        - test_type: 'portfolio' | 'batch' | 'single'
        - filters: Dict of filter criteria
        - parameters: Dict of test parameters
        - symbols: List of stock symbols (if specified)
        """
        pass
```

**Parsing Rules:**

**Portfolio Tests:**
- Pattern: `portfolio (backtest)? with (stocks (where)?)? {filter}`
- Filters:
  - `beta > X` → filter by beta value
  - `beta < X` → filter by beta value
  - `sector == Technology` → filter by sector
  - `stocks: [...]` → explicit stock list

**Batch Tests:**
- Pattern: `batch (mode)? testing {parameter} values [{values}] (for {symbol})? (with {constraints})?`
- Extracts:
  - parameter name
  - value list
  - optional symbol
  - other parameter constraints

**Single Tests:**
- Pattern: `single (backtest)? for {symbol} with {parameters}`
- Extracts:
  - symbol
  - parameter overrides

### 3. Config Generator

**Responsibility:** Generate valid config files based on parsed test config.

**Interface:**
```python
class ConfigGenerator:
    def generate_portfolio_config(
        self,
        filters: Dict,
        base_config: str = 'default'
    ) -> PortfolioConfig:
        """Generate portfolio config with filtered stocks."""
        pass

    def generate_batch_config(
        self,
        parameter: str,
        values: List,
        symbol: str = None,
        base_params: Dict = None
    ) -> BatchConfig:
        """Generate batch test configuration."""
        pass

    def generate_single_config(
        self,
        symbol: str,
        parameters: Dict
    ) -> SingleConfig:
        """Generate single backtest parameters."""
        pass
```

**Config File Locations:**
- Portfolio: `backend/configs/portfolios/generated_{timestamp}.json`
- Batch/Single: Embedded in command (no file needed)

### 4. Command Generator

**Responsibility:** Generate executable commands (frontend URLs and curl commands).

**Interface:**
```python
class CommandGenerator:
    def generate_frontend_url(self, test_config: TestConfig) -> str:
        """Generate complete frontend URL with all parameters."""
        pass

    def generate_curl_command(self, test_config: TestConfig) -> str:
        """Generate executable curl command for backend API."""
        pass
```

**URL Generation:**

**Portfolio:**
```
http://localhost:3000/portfolio-backtest?config={generated_config_name}&rerun=true
```

**Batch:**
```
http://localhost:3000/?mode=batch&symbol={symbol}&param={parameter}&values={values}
```

**Single:**
```
http://localhost:3000/backtest/long/{symbol}/results?{all_parameters}
```

**Curl Command Generation:**

All commands use POST with JSON body:
```bash
curl -X POST http://localhost:3001/api/{endpoint} \
  -H "Content-Type: application/json" \
  -d '{json_payload}'
```

### 5. Test Executor

**Responsibility:** Execute tests via backend API and capture results.

**Interface:**
```python
class TestExecutor:
    def execute_portfolio(self, config: PortfolioConfig) -> Dict:
        """Execute portfolio backtest and return JSON results."""
        pass

    def execute_batch(self, config: BatchConfig) -> Dict:
        """Execute batch backtest and return JSON results."""
        pass

    def execute_single(self, config: SingleConfig) -> Dict:
        """Execute single backtest and return JSON results."""
        pass
```

**Implementation:**
- Use Python `requests` library
- POST to backend API
- Handle async/sync modes
- Capture full JSON response
- Include error handling and retries

### 6. HTML Result Generator

**Responsibility:** Convert JSON results to readable, standalone HTML.

**Interface:**
```python
class HTMLResultGenerator:
    def generate_portfolio_html(self, results: Dict) -> str:
        """Generate HTML for portfolio backtest results."""
        pass

    def generate_batch_html(self, results: Dict) -> str:
        """Generate HTML for batch test results."""
        pass

    def generate_single_html(self, results: Dict) -> str:
        """Generate HTML for single backtest results."""
        pass
```

**HTML Structure:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Test Results - {description}</title>
    <style>
        /* Embedded CSS for standalone viewing */
        /* Dark theme, similar to current UI */
    </style>
</head>
<body>
    <h1>Test Results: {description}</h1>

    <section class="summary">
        <!-- Key metrics and summary -->
    </section>

    <section class="charts">
        <!-- Embedded charts (using Chart.js or similar) -->
    </section>

    <section class="tables">
        <!-- Result tables -->
    </section>

    <section class="metadata">
        <!-- Test configuration and execution details -->
    </section>
</body>
</html>
```

### 7. Archive Manager

**Responsibility:** Create archive folders and save all artifacts.

**Interface:**
```python
class ArchiveManager:
    def create_archive(
        self,
        test_config: TestConfig,
        config_files: ConfigFiles,
        commands: Commands,
        results: Dict,
        html: str
    ) -> ArchivePath:
        """
        Create timestamped archive folder with all artifacts.

        Saves:
        - README.md: Test description and summary
        - config.json: Generated config
        - frontend-url.txt: Frontend URL
        - curl-command.sh: Executable curl command
        - result.html: HTML results
        - metadata.json: Test metadata

        Returns:
        - Path to created archive folder
        """
        pass

    def update_index(self, archive_path: ArchivePath):
        """Update test-results/index.html with new test entry."""
        pass
```

**Folder Naming:**
```
{YYYY-MM-DD}_{HHMMSS}_{description-slug}/
```

Examples:
- `2025-01-09_143022_portfolio-beta-gt-1.75/`
- `2025-01-09_144530_batch-gridInterval-AAPL/`
- `2025-01-09_150015_single-NVDA-beta-scaling/`

## Data Structures

### TestConfig
```python
@dataclass
class TestConfig:
    test_type: str  # 'portfolio' | 'batch' | 'single'
    description: str  # Original user description
    filters: Dict[str, Any]  # Filter criteria
    parameters: Dict[str, Any]  # Test parameters
    symbols: List[str]  # Stock symbols
    timestamp: datetime
```

### ConfigFiles
```python
@dataclass
class ConfigFiles:
    portfolio_config: Optional[Dict] = None  # For portfolio tests
    config_path: Optional[str] = None  # Path where saved
```

### Commands
```python
@dataclass
class Commands:
    frontend_url: str
    curl_command: str
```

### TestResult
```python
@dataclass
class TestResult:
    success: bool
    archive_path: str
    description: str
    timestamp: datetime
    duration_seconds: float
    error: Optional[str] = None
```

## File System Structure

```
DCA-Backtest-Tool/
├── backend/
│   └── configs/
│       └── portfolios/
│           └── generated_20250109_143022.json
│
├── test-results/                     # New directory
│   ├── index.html                     # Archive index
│   │
│   ├── 2025-01-09_143022_portfolio-beta-gt-1.75/
│   │   ├── README.md
│   │   ├── config.json
│   │   ├── frontend-url.txt
│   │   ├── curl-command.sh
│   │   ├── result.html
│   │   └── metadata.json
│   │
│   └── 2025-01-09_144530_batch-gridInterval-AAPL/
│       ├── README.md
│       ├── config.json
│       ├── frontend-url.txt
│       ├── curl-command.sh
│       ├── result.html
│       └── metadata.json
│
└── scripts/
    └── run_test.py                    # CLI entry point
```

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create TestOrchestrator skeleton
2. Implement Archive Manager
3. Create basic file structure
4. Implement metadata.json generation

### Phase 2: Config and Command Generation
1. Implement Config Generator for all test types
2. Implement Command Generator
3. Add config validation
4. Test config generation with existing stocks

### Phase 3: Test Execution
1. Implement Test Executor
2. Add error handling and retries
3. Test with real backend API
4. Validate JSON responses

### Phase 4: HTML Generation
1. Create HTML templates
2. Implement portfolio HTML generator
3. Implement batch HTML generator
4. Implement single HTML generator
5. Add embedded charts/styles

### Phase 5: Test Description Parsing
1. Implement simple parser for portfolio tests
2. Add batch test parsing
3. Add single test parsing
4. Add validation and error messages

### Phase 6: Archive Index
1. Create archive index.html template
2. Implement index update logic
3. Add search/filter capabilities
4. Add sorting options

## Configuration

### Environment Variables
```bash
# Test results archive location
TEST_ARCHIVE_DIR=./test-results

# Backend API base URL
BACKEND_API_URL=http://localhost:3001

# Frontend base URL
FRONTEND_URL=http://localhost:3000

# Default base configs
DEFAULT_PORTFOLIO_CONFIG=nasdaq100
```

### Config File (optional)
```json
{
  "archive": {
    "base_dir": "./test-results",
    "max_age_days": null,
    "auto_cleanup": false
  },
  "backend": {
    "url": "http://localhost:3001",
    "timeout": 300
  },
  "frontend": {
    "url": "http://localhost:3000"
  },
  "defaults": {
    "portfolio_config": "nasdaq100",
    "lot_size": 10000,
    "max_lots": 10
  }
}
```

## API Endpoints Used

### Portfolio Backtest
```
POST /api/portfolio-backtest
Body: {config object from portfolio config file}
```

### Batch Backtest
```
POST /api/backtest/batch?async=true
Body: {batch config with parameterRanges}
```

### Single Backtest
```
POST /api/backtest/dca
Body: {single backtest parameters}
```

## Error Handling

### Parsing Errors
- Invalid test description format
- Unknown filter criteria
- Invalid parameter names

**Handling:** Return clear error message explaining what's wrong and provide example

### Config Generation Errors
- No stocks match filter criteria
- Invalid parameter values
- Missing required fields

**Handling:** Log error, show what was attempted, suggest fixes

### Test Execution Errors
- Backend API not available
- Request timeout
- Invalid response format

**Handling:** Save error to archive, include in metadata.json, return TestResult with error

### Archival Errors
- Disk space issues
- Permission errors

**Handling:** Log error, attempt cleanup, notify user

## Security Considerations

1. **Input Validation:** Sanitize all user input before file system operations
2. **Path Traversal:** Validate archive paths don't escape test-results directory
3. **Command Injection:** Properly escape all shell commands
4. **File Size Limits:** Limit max result HTML size to prevent disk exhaustion

## Performance Considerations

1. **Parallel Execution:** For batch tests, leverage existing async API
2. **Caching:** Cache beta values and stock lists
3. **HTML Generation:** Use templates for faster generation
4. **Index Updates:** Incremental updates, don't regenerate entire index

## Testing Strategy

1. **Unit Tests:** Each component tested independently
2. **Integration Tests:** Full end-to-end test execution
3. **Validation Tests:** Ensure generated configs are valid
4. **Regression Tests:** Compare new results with archived baseline

## Future Enhancements

1. **Web UI:** Browse and manage archived tests
2. **Comparison Tool:** Side-by-side comparison of test results
3. **Scheduled Tests:** Run tests on schedule
4. **Notifications:** Alert on test completion or failure
5. **Export:** Export results to PDF, CSV, etc.
6. **Templates:** Predefined test templates
7. **CI/CD Integration:** Run as part of build pipeline
