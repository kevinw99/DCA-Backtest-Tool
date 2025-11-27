# Spec 56: Implementation Tasks

## Phase 1: Core Infrastructure

### Task 1.1: Create Project Structure
**Priority**: High
**Estimated Time**: 30 minutes

- [ ] Create `scripts/test-automation/` directory
- [ ] Create `test-results/` directory in project root
- [ ] Add `test-results/` to `.gitignore`
- [ ] Create initial `scripts/run_test.py` entry point
- [ ] Set up basic Python project structure (requirements.txt if needed)

**Acceptance Criteria**:
- Directory structure exists
- Basic script can be executed
- test-results/ is git-ignored

### Task 1.2: Implement ArchiveManager
**Priority**: High
**Estimated Time**: 2 hours

- [ ] Create `scripts/test-automation/archive_manager.py`
- [ ] Implement folder naming convention (YYYY-MM-DD_HHMMSS_description-slug)
- [ ] Implement `create_archive()` method
- [ ] Implement artifact saving (README.md, config.json, frontend-url.txt, curl-command.sh, metadata.json)
- [ ] Add path validation and security checks
- [ ] Add error handling for disk operations

**Acceptance Criteria**:
- Can create timestamped archive folders
- Can save all artifact types
- Handles errors gracefully
- Validates paths for security

### Task 1.3: Implement Metadata Generation
**Priority**: Medium
**Estimated Time**: 1 hour

- [ ] Define metadata.json structure
- [ ] Implement metadata collection during test execution
- [ ] Add timestamp tracking
- [ ] Add duration tracking
- [ ] Add success/failure status tracking

**Acceptance Criteria**:
- metadata.json contains all required fields
- Timestamps are properly formatted
- Duration calculated correctly

## Phase 2: Config and Command Generation

### Task 2.1: Implement ConfigGenerator
**Priority**: High
**Estimated Time**: 3 hours

- [ ] Create `scripts/test-automation/config_generator.py`
- [ ] Implement `generate_portfolio_config()` with stock filtering
- [ ] Implement beta value lookup integration
- [ ] Implement `generate_batch_config()`
- [ ] Implement `generate_single_config()`
- [ ] Add config validation before saving
- [ ] Handle edge cases (no stocks match filter, invalid parameters)

**Acceptance Criteria**:
- Can generate valid portfolio configs with filters
- Beta filtering works correctly
- Batch configs properly formatted
- All configs validated before use

### Task 2.2: Implement CommandGenerator
**Priority**: High
**Estimated Time**: 2 hours

- [ ] Create `scripts/test-automation/command_generator.py`
- [ ] Implement `generate_frontend_url()` for portfolio tests
- [ ] Implement `generate_frontend_url()` for batch tests
- [ ] Implement `generate_frontend_url()` for single tests
- [ ] Implement `generate_curl_command()` for all test types
- [ ] Add proper URL encoding
- [ ] Add proper JSON escaping for curl commands

**Acceptance Criteria**:
- Frontend URLs are valid and accessible
- Curl commands are executable
- All parameters properly encoded
- Commands match backend API expectations

### Task 2.3: Stock Filter Integration
**Priority**: Medium
**Estimated Time**: 2 hours

- [ ] Create stock database query interface
- [ ] Implement beta filtering (beta > X, beta < X)
- [ ] Implement sector filtering
- [ ] Implement market cap filtering (if needed)
- [ ] Add explicit stock list support
- [ ] Handle filter combinations (AND/OR logic)

**Acceptance Criteria**:
- Can query stocks by beta range
- Can filter by sector
- Can handle explicit stock lists
- Returns valid stock symbols

## Phase 3: Test Execution

### Task 3.1: Implement TestExecutor
**Priority**: High
**Estimated Time**: 3 hours

- [ ] Create `scripts/test-automation/test_executor.py`
- [ ] Implement `execute_portfolio()` using requests library
- [ ] Implement `execute_batch()` with async handling
- [ ] Implement `execute_single()`
- [ ] Add timeout configuration
- [ ] Add retry logic for transient failures
- [ ] Capture full JSON responses

**Acceptance Criteria**:
- Can execute all test types via API
- Handles async responses correctly
- Retries on transient failures
- Captures complete results

### Task 3.2: Error Handling and Logging
**Priority**: High
**Estimated Time**: 1.5 hours

- [ ] Add comprehensive logging throughout execution
- [ ] Log API requests and responses
- [ ] Handle network errors gracefully
- [ ] Handle API errors (4xx, 5xx)
- [ ] Handle timeout errors
- [ ] Save error details to archive

**Acceptance Criteria**:
- All operations logged appropriately
- Errors don't crash the system
- Error details preserved in archive
- Clear error messages for users

## Phase 4: HTML Generation

### Task 4.1: Create HTML Template System
**Priority**: Medium
**Estimated Time**: 2 hours

- [ ] Create `scripts/test-automation/html_generator.py`
- [ ] Design HTML template structure
- [ ] Create embedded CSS for dark theme
- [ ] Add responsive layout
- [ ] Create reusable components (headers, tables, charts placeholder)

**Acceptance Criteria**:
- HTML is standalone (no external dependencies)
- Dark theme matches current UI
- Responsive design works on different screens
- Template is reusable across test types

### Task 4.2: Implement Portfolio HTML Generator
**Priority**: Medium
**Estimated Time**: 3 hours

- [ ] Implement `generate_portfolio_html()`
- [ ] Parse portfolio JSON response
- [ ] Create summary section (overall metrics)
- [ ] Create per-stock results table
- [ ] Add stock performance summary
- [ ] Add capital utilization display
- [ ] Format numbers and percentages

**Acceptance Criteria**:
- Displays all portfolio metrics
- Per-stock breakdown is clear
- Numbers formatted correctly
- HTML is readable and useful

### Task 4.3: Implement Batch HTML Generator
**Priority**: Medium
**Estimated Time**: 2.5 hours

- [ ] Implement `generate_batch_html()`
- [ ] Parse batch JSON response
- [ ] Create parameter comparison table
- [ ] Highlight best/worst results
- [ ] Add parameter sweep visualization
- [ ] Format comparison metrics

**Acceptance Criteria**:
- Shows all parameter variations tested
- Comparison table is clear
- Best result highlighted
- Easy to identify trends

### Task 4.4: Implement Single HTML Generator
**Priority**: Low
**Estimated Time**: 2 hours

- [ ] Implement `generate_single_html()`
- [ ] Parse single backtest JSON
- [ ] Display transaction log summary
- [ ] Show key metrics
- [ ] Format trade history
- [ ] Add parameter display

**Acceptance Criteria**:
- Shows all single backtest metrics
- Transaction log is readable
- Parameters clearly displayed

### Task 4.5: Add Chart Support (Optional Enhancement)
**Priority**: Low
**Estimated Time**: 4 hours

- [ ] Evaluate chart library options (Chart.js, D3.js, Plotly)
- [ ] Integrate chosen library
- [ ] Generate equity curve chart data
- [ ] Generate performance comparison charts
- [ ] Embed chart data in HTML
- [ ] Ensure charts work offline

**Acceptance Criteria**:
- Charts render correctly in HTML
- No external dependencies required
- Charts are interactive
- Works in all modern browsers

## Phase 5: Test Description Parsing

### Task 5.1: Implement Portfolio Test Parser
**Priority**: High
**Estimated Time**: 3 hours

- [ ] Create `scripts/test-automation/parser.py`
- [ ] Define portfolio test patterns
- [ ] Implement regex/pattern matching for "portfolio backtest with..."
- [ ] Extract filter criteria (beta > X, beta < X)
- [ ] Extract sector filters
- [ ] Extract explicit stock lists
- [ ] Validate parsed results

**Acceptance Criteria**:
- Recognizes portfolio test descriptions
- Extracts filters correctly
- Handles multiple filter combinations
- Returns structured TestConfig

### Task 5.2: Implement Batch Test Parser
**Priority**: High
**Estimated Time**: 2.5 hours

- [ ] Define batch test patterns
- [ ] Implement regex for "batch mode testing {param} values [...]"
- [ ] Extract parameter name
- [ ] Extract value list
- [ ] Extract symbol (if specified)
- [ ] Extract other parameter constraints
- [ ] Validate parameter names

**Acceptance Criteria**:
- Recognizes batch test descriptions
- Extracts parameter and values
- Handles optional symbol
- Returns valid BatchConfig

### Task 5.3: Implement Single Test Parser
**Priority**: Medium
**Estimated Time**: 2 hours

- [ ] Define single test patterns
- [ ] Implement regex for "single backtest for {symbol} with..."
- [ ] Extract symbol
- [ ] Extract parameter overrides
- [ ] Parse boolean flags (e.g., "beta scaling enabled")
- [ ] Parse numeric parameters

**Acceptance Criteria**:
- Recognizes single test descriptions
- Extracts symbol correctly
- Parses parameters accurately
- Returns valid SingleConfig

### Task 5.4: Parser Error Handling
**Priority**: Medium
**Estimated Time**: 1.5 hours

- [ ] Add validation for parsed configs
- [ ] Provide clear error messages for invalid descriptions
- [ ] Suggest corrections for common mistakes
- [ ] Add example descriptions in error messages
- [ ] Handle ambiguous descriptions

**Acceptance Criteria**:
- Clear error messages for invalid input
- Helpful suggestions provided
- Examples shown to user
- Edge cases handled gracefully

## Phase 6: Archive Index and Integration

### Task 6.1: Create Archive Index Template
**Priority**: Low
**Estimated Time**: 2 hours

- [ ] Design index.html layout
- [ ] Create table of archived tests
- [ ] Add sortable columns (date, type, description)
- [ ] Add clickable links to result.html
- [ ] Style to match dark theme
- [ ] Make responsive

**Acceptance Criteria**:
- Lists all archived tests
- Sortable by date, type, description
- Links work correctly
- Visually appealing

### Task 6.2: Implement Index Update Logic
**Priority**: Low
**Estimated Time**: 2 hours

- [ ] Implement `update_index()` in ArchiveManager
- [ ] Scan test-results/ directory for archives
- [ ] Extract metadata from each archive
- [ ] Generate index table rows
- [ ] Handle missing/corrupted archives
- [ ] Optimize for large number of archives

**Acceptance Criteria**:
- Index updates automatically after each test
- Handles large numbers of archives
- Resilient to corrupted data
- Performance acceptable (<2 seconds)

### Task 6.3: Implement TestOrchestrator
**Priority**: High
**Estimated Time**: 3 hours

- [ ] Create `scripts/test-automation/orchestrator.py`
- [ ] Implement `execute_test()` main flow
- [ ] Coordinate all components (parser → generator → executor → archiver)
- [ ] Add progress reporting
- [ ] Handle errors at each stage
- [ ] Return comprehensive TestResult

**Acceptance Criteria**:
- Coordinates all components correctly
- Handles errors without crashing
- Reports progress to user
- Returns complete result information

### Task 6.4: CLI Interface
**Priority**: Medium
**Estimated Time**: 2 hours

- [ ] Update `scripts/run_test.py` with argument parsing
- [ ] Add help text and usage examples
- [ ] Add verbose/quiet modes
- [ ] Add dry-run mode (show what would be done)
- [ ] Add config file support
- [ ] Format output nicely

**Acceptance Criteria**:
- Easy to use from command line
- Help text is clear
- Supports common options
- Output is readable

## Phase 7: Testing and Documentation

### Task 7.1: Unit Testing
**Priority**: Medium
**Estimated Time**: 4 hours

- [ ] Create test suite structure
- [ ] Write tests for ConfigGenerator
- [ ] Write tests for CommandGenerator
- [ ] Write tests for Parser
- [ ] Write tests for ArchiveManager
- [ ] Achieve >80% code coverage

**Acceptance Criteria**:
- All components have unit tests
- Tests cover happy path and error cases
- Code coverage >80%
- Tests are maintainable

### Task 7.2: Integration Testing
**Priority**: Medium
**Estimated Time**: 3 hours

- [ ] Create end-to-end test scenarios
- [ ] Test portfolio backtest flow
- [ ] Test batch backtest flow
- [ ] Test single backtest flow
- [ ] Test error scenarios
- [ ] Verify archives created correctly

**Acceptance Criteria**:
- Full workflows tested
- Archives verified
- Error handling tested
- Results match expectations

### Task 7.3: Documentation
**Priority**: Low
**Estimated Time**: 3 hours

- [ ] Write README for test automation system
- [ ] Document CLI usage with examples
- [ ] Document test description syntax
- [ ] Add troubleshooting guide
- [ ] Create example test descriptions
- [ ] Document configuration options

**Acceptance Criteria**:
- Clear usage instructions
- Examples provided
- Common issues documented
- Easy for new users to understand

### Task 7.4: User Acceptance Testing
**Priority**: Low
**Estimated Time**: 2 hours

- [ ] Run test with real portfolio backtest
- [ ] Run test with real batch backtest
- [ ] Run test with real single backtest
- [ ] Verify HTML results are useful
- [ ] Verify archives are complete
- [ ] Get user feedback and iterate

**Acceptance Criteria**:
- Real tests execute successfully
- Results are useful and readable
- User can reproduce tests from archives
- No critical issues found

## Phase 8: Polish and Optimization

### Task 8.1: Performance Optimization
**Priority**: Low
**Estimated Time**: 2 hours

- [ ] Profile slow operations
- [ ] Optimize beta value lookups
- [ ] Cache stock lists if appropriate
- [ ] Optimize HTML generation
- [ ] Reduce archive creation time

**Acceptance Criteria**:
- HTML generation <2 seconds
- Archive creation doesn't slow tests
- No noticeable performance impact

### Task 8.2: Security Hardening
**Priority**: Medium
**Estimated Time**: 2 hours

- [ ] Sanitize all user input
- [ ] Validate all file paths
- [ ] Prevent path traversal attacks
- [ ] Validate command injection risks
- [ ] Add file size limits
- [ ] Review error messages for info leaks

**Acceptance Criteria**:
- Input validation comprehensive
- File operations secure
- No command injection possible
- File sizes limited

### Task 8.3: Error Message Improvements
**Priority**: Low
**Estimated Time**: 1 hour

- [ ] Review all error messages
- [ ] Make messages more helpful
- [ ] Add suggestions for fixes
- [ ] Improve formatting
- [ ] Add color coding for terminal output

**Acceptance Criteria**:
- Error messages are clear and actionable
- Users know what to do when errors occur
- Messages are consistently formatted

## Summary

**Total Estimated Time**: ~60-70 hours

**Critical Path Tasks** (must be done in order):
1. Phase 1 → Phase 2 → Phase 3 → Phase 5 → Phase 6.3 (Orchestrator)
2. Phase 4 can be done in parallel with Phase 5
3. Phase 6.1-6.2 (Index) can be done after Phase 1
4. Phase 7-8 after all core functionality complete

**Minimum Viable Product** (MVP):
- Tasks 1.1, 1.2, 2.1, 2.2, 3.1, 5.1, 6.3
- Enables basic portfolio test execution and archival
- Estimated: ~20 hours

**Full Feature Set**:
- All Phase 1-6 tasks
- Estimated: ~45 hours

**Production Ready**:
- All tasks including testing, documentation, and polish
- Estimated: ~60-70 hours
