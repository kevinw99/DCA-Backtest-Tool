# Ticker-Specific Default Parameters - Implementation Tasks

## Phase 1: Backend Infrastructure

### Task 1.1: Create Global Defaults Constant

- [ ] Create `backend/utils/constants.js` file
- [ ] Define `GLOBAL_DEFAULTS` constant with all default parameter values
- [ ] Export constant for use in other modules
- **Files**: `backend/utils/constants.js` (new)

### Task 1.2: Create Config Service

- [ ] Create `backend/services/configService.js`
- [ ] Implement `getTickerDefaults(symbol)` method
  - Read `config/backtestDefaults.json`
  - Return ticker-specific defaults if exists
  - Return global defaults if ticker not found
  - Handle file not found gracefully
- [ ] Implement `saveTickerDefaults(symbol, parameters)` method
  - Read existing config file
  - Validate parameters
  - Merge/update ticker entry
  - Write atomically to file
- [ ] Implement `validateParameters(parameters)` method
  - Check required fields
  - Validate types and ranges
  - Return validation errors if any
- [ ] Add error handling for file I/O operations
- **Files**: `backend/services/configService.js` (new)

### Task 1.3: Add API Endpoints

- [ ] Add GET `/api/backtest/defaults/:symbol` endpoint
  - Sanitize symbol parameter
  - Call configService.getTickerDefaults()
  - Return { defaults: {...} }
- [ ] Add POST `/api/backtest/defaults/:symbol` endpoint
  - Sanitize symbol parameter
  - Extract parameters from request body
  - Validate parameters
  - Call configService.saveTickerDefaults()
  - Return success/error response
- [ ] Add error handling middleware
- **Files**: `backend/server.js` (update)

### Task 1.4: Transform backtestDefaults.json

- [ ] Backup current `config/backtestDefaults.json`
- [ ] Transform from flat structure to ticker-keyed structure
- [ ] Keep current values as global template
- [ ] Test JSON validity
- **Files**: `config/backtestDefaults.json` (update)

## Phase 2: Frontend Integration

### Task 2.1: Add State Management

- [ ] Add `currentDefaults` state to App.js
- [ ] Add `feedbackMessage` state for user notifications
- [ ] Initialize states in component mount
- **Files**: `frontend/src/App.js` (update)

### Task 2.2: Implement Load Ticker Defaults

- [ ] Create `loadTickerDefaults(symbol)` function
  - Fetch from GET `/api/backtest/defaults/:symbol`
  - Update currentDefaults state
  - Apply defaults to form parameters
  - Handle errors gracefully
- [ ] Add useEffect to call loadTickerDefaults when symbol changes
- [ ] Test with different symbols
- **Files**: `frontend/src/App.js` (update)

### Task 2.3: Implement Save as Default

- [ ] Create `extractTickerSpecificParams()` helper
  - Remove symbol, startDate, endDate, availableSymbols, mode, source
  - Return only ticker-specific parameters
- [ ] Create `saveAsDefault()` function
  - Extract ticker-specific parameters
  - POST to `/api/backtest/defaults/:symbol`
  - Update currentDefaults on success
  - Show feedback message
  - Handle errors
- **Files**: `frontend/src/App.js` (update)

### Task 2.4: Update Reset to Default

- [ ] Modify existing `resetToDefaults()` function
  - Check if currentDefaults exists
  - Use currentDefaults if available
  - Fall back to global defaults otherwise
- [ ] Test reset functionality
- **Files**: `frontend/src/App.js` (update)

### Task 2.5: Add UI Components

- [ ] Add "Save as Default" button in single mode only
- [ ] Style button to match existing design
- [ ] Add feedback message display area
- [ ] Position buttons appropriately
- [ ] Add conditional rendering (only in single mode)
- **Files**: `frontend/src/App.js`, `frontend/src/App.css` (update)

## Phase 3: Testing & Validation

### Task 3.1: Backend Testing

- [ ] Test GET endpoint with existing ticker
- [ ] Test GET endpoint with non-existing ticker
- [ ] Test POST endpoint with valid parameters
- [ ] Test POST endpoint with invalid parameters
- [ ] Test file I/O error handling
- [ ] Test concurrent write scenarios
- **Testing**: Manual/automated

### Task 3.2: Frontend Testing

- [ ] Test loading defaults when changing symbols
- [ ] Test saving current parameters as defaults
- [ ] Test reset to ticker-specific defaults
- [ ] Test reset to global defaults (when no ticker-specific exists)
- [ ] Test error message display
- [ ] Test button visibility (single vs batch mode)
- **Testing**: Manual

### Task 3.3: Integration Testing

- [ ] Save defaults for Symbol A, verify persistence
- [ ] Switch to Symbol B, verify different defaults load
- [ ] Switch back to Symbol A, verify saved defaults still apply
- [ ] Manually edit JSON file, verify changes reflected in UI
- [ ] Test with empty backtestDefaults.json
- [ ] Test with corrupt JSON file
- **Testing**: Manual

## Phase 4: Documentation & Cleanup

### Task 4.1: Code Documentation

- [ ] Add JSDoc comments to configService methods
- [ ] Add comments for API endpoints
- [ ] Add comments for frontend functions
- **Files**: All modified files

### Task 4.2: Update README (if exists)

- [ ] Document ticker-specific defaults feature
- [ ] Explain backtestDefaults.json structure
- [ ] Add usage examples
- **Files**: README.md (if exists)

### Task 4.3: Final Testing

- [ ] Restart backend server
- [ ] Full end-to-end test flow
- [ ] Verify no regressions in existing functionality
- [ ] Test edge cases
- **Testing**: Manual

## Acceptance Criteria

- ✅ Users can save current parameters as ticker-specific defaults via "Save as Default" button
- ✅ Ticker-specific defaults persist in `config/backtestDefaults.json`
- ✅ When symbol changes, appropriate defaults are loaded automatically
- ✅ "Reset to Default" uses ticker-specific defaults when available
- ✅ System falls back to global defaults when ticker-specific not found
- ✅ Manual edits to JSON file are respected
- ✅ Button only appears in single backtest mode
- ✅ Error messages are user-friendly
- ✅ No breaking changes to existing functionality
- ✅ Backend server handles file errors gracefully

## Implementation Order

1. Backend infrastructure (Tasks 1.1 - 1.4)
2. Test backend API endpoints
3. Frontend integration (Tasks 2.1 - 2.5)
4. Integration testing (Task 3.3)
5. Documentation and cleanup (Tasks 4.1 - 4.3)

## Estimated Time

- Phase 1: 2-3 hours
- Phase 2: 2-3 hours
- Phase 3: 1-2 hours
- Phase 4: 1 hour
- **Total**: 6-9 hours
