# Spec 43: Beta Scaling Centralization - Implementation Tasks

## Phase 1: Create BetaScalingService (Backend)

### Task 1.1: Create Service Directory Structure
- [ ] Create directory: `backend/services/betaScaling/`
- [ ] Create file: `BetaScalingService.js`
- [ ] Create file: `BetaScalingService.test.js`
- [ ] Create file: `index.js` (exports)

### Task 1.2: Implement BetaScalingService Core Logic
- [ ] Define class structure with constructor
- [ ] Define SCALABLE_PARAMETERS constant (12 parameters)
- [ ] Define BETA_RANGE and COEFFICIENT_RANGE constants
- [ ] Implement `calculateBetaFactor(beta, coefficient)`
- [ ] Implement `scaleParameter(value, betaFactor)`
- [ ] Implement `validateBetaConfig(config)`
- [ ] Implement `validateScaledParameters(parameters, betaFactor)`
- [ ] Implement `generateWarnings(betaFactor, scaledParameters)`

### Task 1.3: Implement Main applyBetaScaling Method
- [ ] Implement `async applyBetaScaling(baseParameters, symbol, config)`
- [ ] Handle enableBetaScaling=false case (return base parameters)
- [ ] Validate configuration
- [ ] Fetch beta from betaService
- [ ] Calculate betaFactor
- [ ] Scale all scalable parameters
- [ ] Validate scaled parameters
- [ ] Generate warnings
- [ ] Return ScalingResult object

### Task 1.4: Implement Helper Methods
- [ ] Implement `async getBetaForSymbol(symbol, config)`
- [ ] Handle manual beta override case
- [ ] Handle array of symbols (for future batch support)
- [ ] Error handling and logging

### Task 1.5: Write Unit Tests
- [ ] Test calculateBetaFactor() with various inputs
- [ ] Test scaleParameter() with zero and non-zero values
- [ ] Test validateBetaConfig() with valid/invalid configs
- [ ] Test applyBetaScaling() with enableBetaScaling=false
- [ ] Test applyBetaScaling() with manual beta override
- [ ] Test applyBetaScaling() with fetched beta
- [ ] Test warning generation for extreme betaFactor
- [ ] Test error handling for invalid beta/coefficient
- [ ] Test all 12 scalable parameters
- [ ] Test that non-scalable parameters are unchanged
- [ ] Achieve >90% code coverage

## Phase 2: Integrate BetaScalingService into Backend

### Task 2.1: Update DCA Backtest Endpoint
**File**: `backend/server.js`

- [ ] Import BetaScalingService
- [ ] Locate POST `/api/backtest/dca` endpoint
- [ ] Extract beta configuration from request body
- [ ] Replace parameterCorrelationService call with BetaScalingService
- [ ] Use scalingResult.adjustedParameters for backtest
- [ ] Include scalingResult.betaInfo in API response
- [ ] Add error handling for scaling failures
- [ ] Test endpoint with curl

### Task 2.2: Update Batch Backtest Service
**File**: `backend/services/batchBacktestService.js`

- [ ] Import BetaScalingService
- [ ] Locate `generateParameterCombinations()` function
- [ ] Replace beta scaling logic with BetaScalingService
- [ ] For each coefficient, call applyBetaScaling()
- [ ] Store betaInfo in combination object
- [ ] Update combination structure
- [ ] Test batch backtest with beta scaling

### Task 2.3: Update Portfolio Backtest Service
**File**: `backend/services/portfolioBacktestService.js`

- [ ] Import BetaScalingService
- [ ] Locate stock parameter preparation logic
- [ ] For each stock, call applyBetaScaling()
- [ ] Store per-stock betaInfo
- [ ] Update portfolio result structure
- [ ] Test portfolio backtest with beta scaling

### Task 2.4: Update Server Initialization
**File**: `backend/server.js`

- [ ] Instantiate BetaScalingService (after betaService)
- [ ] Pass betaService to BetaScalingService constructor
- [ ] Make betaScalingService available to all endpoints

## Phase 3: Frontend Simplification

### Task 3.1: Simplify BetaCalculator.js
**File**: `frontend/src/components/backtest/utils/BetaCalculator.js`

- [ ] Remove `applyBetaScaling()` function
- [ ] Remove `restoreBaseValue()` function
- [ ] Remove `calculateAdjustedParameters()` function
- [ ] Remove `calculatePortfolioBetaScaling()` function
- [ ] Keep `getStockBeta()` for display purposes
- [ ] Keep validation functions (`isValidBeta`, `isValidCoefficient`)
- [ ] Keep `getRecommendedCoefficient()` for UI hints
- [ ] Keep `calculateBetaFactor()` for display only
- [ ] Add comments explaining backend handles calculations

### Task 3.2: Simplify useBetaScaling Hook
**File**: `frontend/src/components/backtest/hooks/useBetaScaling.js`

- [ ] Remove calculation logic from hook
- [ ] Keep state management for beta config
- [ ] Simplify to only manage:
  - enableBetaScaling (boolean)
  - coefficient (number)
  - beta (number, manual override)
  - isManualBetaOverride (boolean)
- [ ] Return betaConfig object for API requests
- [ ] Remove adjustedParameters state
- [ ] Remove portfolio adjustment logic
- [ ] Update hook to be config-only

### Task 3.3: Update Components to Use Simplified Hook
**Files**: All components using useBetaScaling

- [ ] Update `DCABacktestForm.js`
- [ ] Update `PortfolioBacktestForm.js`
- [ ] Update `BetaControlsSection.js`
- [ ] Components send betaConfig to API
- [ ] Components receive and display betaInfo from API response
- [ ] Update to show adjusted parameters (read-only)

### Task 3.4: Update URL Parameter Manager
**File**: `frontend/src/utils/URLParameterManager.js`

- [ ] Keep parsing of beta config parameters
- [ ] Remove _parseParameterWithBetaScaling() logic (if safe)
- [ ] Ensure backward compatibility with old URLs
- [ ] Test URL generation/parsing

## Phase 4: Testing & Verification

### Task 4.1: Backend Testing
- [ ] Run all backend unit tests
- [ ] Run all backend integration tests
- [ ] Test DCA endpoint manually with curl
- [ ] Test batch endpoint with beta scaling
- [ ] Test portfolio endpoint with beta scaling
- [ ] Verify betaInfo in all responses
- [ ] Test with enableBetaScaling=false
- [ ] Test with manual beta override
- [ ] Test error cases (invalid beta, invalid coefficient)

### Task 4.2: Frontend Testing
- [ ] Run all frontend unit tests
- [ ] Test DCA backtest form with beta scaling
- [ ] Test batch backtest form with beta scaling
- [ ] Test portfolio backtest form with beta scaling
- [ ] Verify betaInfo display in UI
- [ ] Test beta controls (coefficient slider, enable toggle)
- [ ] Test manual beta override
- [ ] Test URL parameter backward compatibility

### Task 4.3: End-to-End Testing
- [ ] Test complete flow: UI → API → Backend → Response → UI
- [ ] Test single stock backtest with beta scaling
- [ ] Test batch backtest with multiple coefficients
- [ ] Test portfolio backtest with per-stock beta
- [ ] Compare results with old implementation (should match)
- [ ] Test all 12 scalable parameters scale correctly
- [ ] Test edge cases (beta=1, coefficient=1, etc.)

### Task 4.4: Performance Testing
- [ ] Benchmark BetaScalingService.applyBetaScaling() (target: <10ms)
- [ ] Benchmark batch mode with 20 combinations (target: <100ms)
- [ ] Benchmark portfolio mode with 10 stocks (target: <500ms)
- [ ] Profile memory usage
- [ ] Verify no performance regression

## Phase 5: Cleanup & Documentation

### Task 5.1: Code Cleanup
- [ ] Mark deprecated functions in parameterCorrelationService
- [ ] Add deprecation warnings/comments
- [ ] Remove unused imports
- [ ] Remove commented-out code
- [ ] Format code consistently

### Task 5.2: Update Documentation
- [ ] Document BetaScalingService API in README
- [ ] Add JSDoc comments to all methods
- [ ] Update architecture diagrams
- [ ] Create migration guide for developers
- [ ] Update API documentation with betaInfo field

### Task 5.3: Add Logging
- [ ] Log beta scaling operations (debug level)
- [ ] Log warnings for extreme betaFactor
- [ ] Log errors for invalid configuration
- [ ] Add performance metrics logging

## Phase 6: Deployment

### Task 6.1: Pre-Deployment Checklist
- [ ] All tests passing (backend + frontend)
- [ ] No console errors in browser
- [ ] No backend errors in logs
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Code review completed

### Task 6.2: Git Commit
- [ ] Stage all changes
- [ ] Write comprehensive commit message
- [ ] Include migration notes
- [ ] Reference spec #43
- [ ] Push to repository

### Task 6.3: Post-Deployment Verification
- [ ] Monitor logs for errors
- [ ] Test production endpoints
- [ ] Verify all backtest modes work
- [ ] Check performance metrics

## Rollback Plan

If critical issues found:
- [ ] Revert git commit
- [ ] Or: Add feature flag to disable BetaScalingService
- [ ] Fallback to parameterCorrelationService
- [ ] Investigate and fix issues
- [ ] Re-deploy

## Success Criteria Checklist

- [ ] BetaScalingService implemented and tested
- [ ] All backend services use BetaScalingService
- [ ] Frontend calculation logic removed
- [ ] All unit tests passing (100%)
- [ ] All integration tests passing (100%)
- [ ] Manual testing completed for all modes
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Code review approved
- [ ] Git commit created with detailed message
- [ ] Zero duplicated scaling logic
- [ ] Consistent results across all modes
- [ ] Backward compatibility maintained

## Estimated Timeline

- Phase 1: 4-6 hours (Core service implementation + tests)
- Phase 2: 3-4 hours (Backend integration)
- Phase 3: 2-3 hours (Frontend simplification)
- Phase 4: 3-4 hours (Testing & verification)
- Phase 5: 1-2 hours (Cleanup & documentation)
- Phase 6: 1 hour (Deployment)

**Total**: 14-20 hours

## Dependencies

- betaService.js (existing)
- parameterCorrelationService.js (deprecated after migration)
- Backend server running
- Frontend build tools

## Risks

- **Breaking backward compatibility**: Mitigate with thorough testing
- **Performance regression**: Mitigate with benchmarking
- **Missed code locations**: Mitigate with comprehensive grep search
- **Test failures**: Mitigate by running tests frequently during development

## Notes

- Keep parameterCorrelationService for now (mark deprecated)
- Can remove deprecated code in future cleanup
- Feature flag approach allows gradual rollout if needed
- Comprehensive testing is critical for success
