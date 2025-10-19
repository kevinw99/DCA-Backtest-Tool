# Spec 43: Beta Scaling Logic Centralization

## Problem Statement

Currently, beta scaling logic is scattered across both frontend and backend code:

### Frontend Issues
- **BetaCalculator.js**: Performs parameter scaling calculations
- **useBetaScaling.js**: Manages beta scaling state and calculations
- **URL Parameter Manager**: Handles scaled vs. base parameter detection
- **Multiple components**: Apply scaling logic independently

### Backend Issues
- **parameterCorrelationService.js**: Duplicates scaling logic
- **server.js**: Applies beta scaling in DCA endpoint
- **batchBacktestService.js**: Implements separate scaling for batch mode
- **portfolioBacktestService.js**: Handles per-stock scaling

### Core Problems

1. **Code Duplication**: Same scaling formula (`value × beta × coefficient`) implemented in 5+ places
2. **Inconsistent Application**: Different codepaths may produce different results
3. **Maintenance Burden**: Bug fixes require changes in multiple locations
4. **Testing Complexity**: Must test scaling in every location separately
5. **Poor Separation of Concerns**: Frontend should not perform business logic calculations
6. **Architecture Violation**: Scaling is business logic that belongs in backend only

## Requirements

### Functional Requirements

#### FR1: Centralized Backend Service
- Create a single `BetaScalingService` class in backend
- All parameter scaling logic must be in this service only
- Service must handle all backtest modes: single, batch, portfolio

#### FR2: Consistent Scaling Formula
- Formula: `scaledValue = baseValue × beta × coefficient`
- Exception: Zero values remain zero (not scaled)
- Support 12 scalable parameters:
  - gridIntervalPercent
  - profitRequirement
  - trailingBuyActivationPercent
  - trailingBuyReboundPercent
  - trailingSellActivationPercent
  - trailingSellPullbackPercent
  - gridConsecutiveIncrement
  - dynamicGridMultiplier
  - trailingShortActivationPercent
  - trailingShortPullbackPercent
  - trailingCoverActivationPercent
  - trailingCoverReboundPercent

#### FR3: Beta Resolution
- Multi-tier resolution (existing betaService.js):
  1. backtestDefaults.json (user override)
  2. Database cache (fresh)
  3. Provider API (Yahoo Finance)
  4. Database cache (stale)
  5. Default (1.0)

#### FR4: Validation & Error Handling
- Validate beta range: 0.01 to 10.0
- Validate coefficient range: 0.25 to 3.0
- Warn on extreme betaFactor (> 5.0 or < 0.1)
- Validate parameter ranges after scaling
- Graceful fallback to base parameters on error

#### FR5: Frontend Simplification
- Remove all scaling calculation logic from frontend
- Frontend only sends:
  - Base parameters
  - Beta configuration (enableBetaScaling, coefficient, manual beta)
- Frontend receives scaled parameters from backend
- Display beta info to user (read-only)

#### FR6: Backward Compatibility
- Support existing URL parameters
- Handle legacy requests with pre-scaled parameters
- Maintain all existing API contracts

### Non-Functional Requirements

#### NFR1: Performance
- Scaling calculation must complete in < 10ms per stock
- Batch mode: Support 100+ stocks without timeout
- Cache beta values to minimize API calls

#### NFR2: Maintainability
- Single source of truth for scaling logic
- Well-documented service API
- Comprehensive unit tests (>90% coverage)
- Clear error messages

#### NFR3: Extensibility
- Easy to add new scalable parameters
- Support for future scaling strategies
- Pluggable beta providers

## Success Criteria

1. **Zero Logic Duplication**: Scaling formula exists in exactly one place
2. **All Tests Pass**: Existing tests continue to work
3. **Consistent Results**: Same input produces same output across all modes
4. **Frontend Simplified**: Frontend code reduced by removing calculation logic
5. **Backend Centralized**: All scaling happens in BetaScalingService
6. **Documentation Complete**: Service API fully documented
7. **No Regression**: All existing features work identically

## Out of Scope

- Changing the scaling formula or algorithm
- Adding new scalable parameters
- Modifying beta fetching logic
- UI/UX changes to beta controls
- Performance optimization beyond requirements

## Risks & Mitigation

### Risk 1: Breaking Changes
- **Mitigation**: Comprehensive testing before/after refactoring
- **Mitigation**: Support both old and new parameter formats during transition

### Risk 2: Missed Code Locations
- **Mitigation**: Thorough code search for all beta-related code
- **Mitigation**: Grep for all scaling-related keywords

### Risk 3: Performance Regression
- **Mitigation**: Benchmark before/after
- **Mitigation**: Cache beta values aggressively

### Risk 4: Test Coverage Gaps
- **Mitigation**: Write tests first for new service
- **Mitigation**: Verify all existing tests still pass

## Acceptance Criteria

- [ ] BetaScalingService class created and tested
- [ ] All backend services use BetaScalingService
- [ ] Frontend calculation logic removed
- [ ] All tests passing (backend + frontend)
- [ ] Manual testing of all backtest modes
- [ ] Documentation updated
- [ ] Code review completed
- [ ] Git commit with detailed message
