# Spec 57: Dynamic Capital Utilization - Implementation Tasks

## Phase 1: Core Infrastructure

### Task 1.1: Create Capital Utilization Manager
**Priority**: High
**Estimated Time**: 3 hours

- [ ] Create `backend/services/capitalUtilizationManager.js`
- [ ] Implement constructor with mode configuration
- [ ] Implement `trackDailyUsage()` method
- [ ] Implement `calculateReallocation()` method for Mode 1
- [ ] Implement `finalizeMetrics()` method for Mode 2
- [ ] Add unit tests for all methods

**Acceptance Criteria**:
- Manager correctly tracks daily capital usage
- Reallocation calculations are accurate
- Peak capital tracking works for Mode 2
- All edge cases handled (zero usage, 100% usage)

### Task 1.2: Add Configuration Schema
**Priority**: High
**Estimated Time**: 1 hour

- [ ] Update portfolio config schema with `capitalUtilization` field
- [ ] Add validation for mode values
- [ ] Add default values for missing fields
- [ ] Update config loader to normalize old configs
- [ ] Document new config fields

**Acceptance Criteria**:
- Config validation rejects invalid modes
- Old configs without field default to mode: 'off'
- Documentation updated

## Phase 2: Mode 1 Implementation (Dynamic Reallocation)

### Task 2.1: Integrate Tracking into Portfolio Service
**Priority**: High
**Estimated Time**: 2 hours

- [ ] Initialize CapitalUtilizationManager in `portfolioBacktestService.js`
- [ ] Add capital tracking after each day's trading
- [ ] Calculate stock allocations daily
- [ ] Log capital utilization metrics
- [ ] Add debug logging for tracking

**Acceptance Criteria**:
- Capital usage tracked for every trading day
- Logs show daily utilization percentage
- No performance degradation (< 2% slowdown)

### Task 2.2: Implement Capital Reallocation Logic
**Priority**: High
**Estimated Time**: 4 hours

- [ ] Create `executeCapitalReallocation()` function
- [ ] Calculate proportional allocation per stock
- [ ] Respect maxLots constraints
- [ ] Execute buy orders with reallocated capital
- [ ] Log reallocation transactions clearly
- [ ] Handle edge cases (no positions, all stocks at max)

**Acceptance Criteria**:
- Reallocation maintains proportional exposure
- Respects maxLots per stock
- Capital utilization reaches >95%
- Transaction log shows reallocation buys

### Task 2.3: Test Mode 1 End-to-End
**Priority**: High
**Estimated Time**: 2 hours

- [ ] Run SP500 high-beta portfolio with mode: 'dynamic'
- [ ] Verify capital utilization >95%
- [ ] Compare performance metrics vs mode: 'off'
- [ ] Check transaction logs for reallocation entries
- [ ] Verify no bugs in deferred selling logic

**Acceptance Criteria**:
- Mode 1 successfully reallocates capital
- No errors or crashes
- Metrics show improved ROI due to full capital deployment

## Phase 3: Mode 2 Implementation (Normalized Capital)

### Task 3.1: Implement Peak Capital Tracking
**Priority**: Medium
**Estimated Time**: 1 hour

- [ ] Track peak capital used during backtest
- [ ] Update peak whenever allocation increases
- [ ] Store daily capital history
- [ ] Calculate average utilization

**Acceptance Criteria**:
- Peak capital accurately reflects maximum usage
- Daily history preserved for analysis

### Task 3.2: Implement Post-Backtest Normalization
**Priority**: Medium
**Estimated Time**: 2 hours

- [ ] Call `finalizeMetrics()` after backtest completes
- [ ] Set effectiveCapital = peakCapitalUsed
- [ ] Recalculate all percentage-based metrics
- [ ] Preserve original metrics for comparison
- [ ] Update deferred selling threshold logic

**Acceptance Criteria**:
- Effective capital set to peak usage
- Metrics recalculated correctly
- Both metric sets available in response

### Task 3.3: Test Mode 2 End-to-End
**Priority**: Medium
**Estimated Time**: 1.5 hours

- [ ] Run SP500 high-beta portfolio with mode: 'normalized'
- [ ] Verify effectiveCapital = peak usage
- [ ] Compare metrics: configured vs effective
- [ ] Verify trading behavior unchanged
- [ ] Check deferred selling works correctly

**Acceptance Criteria**:
- Mode 2 accurately normalizes capital base
- Trading behavior identical to mode: 'off'
- Metrics show true strategy performance

## Phase 4: Metrics Calculation

### Task 4.1: Implement Dual Metrics Calculation
**Priority**: High
**Estimated Time**: 2 hours

- [ ] Create `calculatePerformanceMetrics()` function
- [ ] Calculate metrics for configured capital
- [ ] Calculate metrics for effective capital
- [ ] Implement Sharpe ratio calculation
- [ ] Add annualized ROI calculation
- [ ] Calculate capital efficiency

**Acceptance Criteria**:
- Both metric sets calculated correctly
- Formulas match financial standards
- Unit tests validate calculations

### Task 4.2: Update API Response Structure
**Priority**: High
**Estimated Time**: 1.5 hours

- [ ] Add `capitalMetrics` object to response
- [ ] Add `configuredCapitalMetrics` object
- [ ] Add `effectiveCapitalMetrics` object
- [ ] Include capital usage history
- [ ] Maintain backward compatibility

**Acceptance Criteria**:
- API response includes all new fields
- Existing fields unchanged
- Old clients don't break

## Phase 5: Frontend Integration

### Task 5.1: Create Capital Utilization Component
**Priority**: Medium
**Estimated Time**: 3 hours

- [ ] Create `CapitalUtilizationSection.js` component
- [ ] Display total vs effective capital stats
- [ ] Show peak usage and average utilization
- [ ] Add metric toggle (configured vs effective)
- [ ] Style to match existing UI

**Acceptance Criteria**:
- Component displays all capital metrics
- Toggle switches between metric views
- Responsive design

### Task 5.2: Add Utilization Chart
**Priority**: Low
**Estimated Time**: 3 hours

- [ ] Create line chart showing capital utilization over time
- [ ] Plot unused capital percentage
- [ ] Highlight reallocation events (Mode 1)
- [ ] Add tooltip with daily details
- [ ] Make chart interactive

**Acceptance Criteria**:
- Chart clearly shows utilization trend
- Interactive and responsive
- Works with large datasets

### Task 5.3: Update Portfolio Results Page
**Priority**: Medium
**Estimated Time**: 1.5 hours

- [ ] Integrate CapitalUtilizationSection
- [ ] Update summary cards to show effective metrics
- [ ] Add toggle to switch metric display
- [ ] Update all ROI/return displays
- [ ] Add "?" tooltip explaining metrics

**Acceptance Criteria**:
- Capital utilization section visible
- User can toggle between metric views
- UI clearly indicates which metrics are shown

## Phase 6: Testing & Validation

### Task 6.1: Unit Tests
**Priority**: High
**Estimated Time**: 3 hours

- [ ] Test CapitalUtilizationManager all methods
- [ ] Test reallocation calculation logic
- [ ] Test metrics calculation formulas
- [ ] Test edge cases (zero, 100%, margin)
- [ ] Achieve >90% code coverage

**Acceptance Criteria**:
- All public methods have tests
- Edge cases covered
- Tests pass consistently

### Task 6.2: Integration Tests
**Priority**: High
**Estimated Time**: 3 hours

- [ ] Test full backtest with mode: 'off'
- [ ] Test full backtest with mode: 'dynamic'
- [ ] Test full backtest with mode: 'normalized'
- [ ] Test mode switching (same config, different modes)
- [ ] Test with margin trading enabled

**Acceptance Criteria**:
- All modes work end-to-end
- Results are consistent and reproducible
- No errors or crashes

### Task 6.3: Comparison Tests
**Priority**: Medium
**Estimated Time**: 2 hours

- [ ] Run same portfolio config with all 3 modes
- [ ] Compare final portfolio values
- [ ] Verify Mode 1 has higher capital deployed
- [ ] Verify Mode 2 metrics match Mode 1 behavior
- [ ] Document differences in test results

**Acceptance Criteria**:
- Clear understanding of mode differences
- Results documented for review
- Performance characteristics understood

### Task 6.4: Performance Testing
**Priority**: Medium
**Estimated Time**: 1.5 hours

- [ ] Benchmark backtest time: mode 'off' vs 'dynamic'
- [ ] Measure memory usage increase
- [ ] Test with large portfolio (100+ stocks)
- [ ] Profile hot paths
- [ ] Optimize if overhead > 10%

**Acceptance Criteria**:
- Mode 1 overhead < 10%
- Mode 2 overhead < 2%
- No memory leaks
- Large portfolios work smoothly

## Phase 7: Documentation & Polish

### Task 7.1: API Documentation
**Priority**: Medium
**Estimated Time**: 2 hours

- [ ] Document new config fields
- [ ] Document API response additions
- [ ] Provide config examples for each mode
- [ ] Document performance implications
- [ ] Add troubleshooting guide

**Acceptance Criteria**:
- All new fields documented
- Examples are clear and working
- Performance notes included

### Task 7.2: User Guide
**Priority**: Low
**Estimated Time**: 2 hours

- [ ] Write guide explaining capital utilization
- [ ] Explain when to use each mode
- [ ] Provide interpretation guide for metrics
- [ ] Add visual diagrams
- [ ] Include real examples

**Acceptance Criteria**:
- Non-technical users can understand
- Clear decision guide for mode selection
- Examples demonstrate real use cases

### Task 7.3: Migration Guide
**Priority**: Low
**Estimated Time**: 1 hour

- [ ] Document how to migrate existing configs
- [ ] Explain backward compatibility
- [ ] Provide before/after comparison
- [ ] List potential gotchas
- [ ] Provide rollback instructions

**Acceptance Criteria**:
- Existing users can upgrade safely
- No breaking changes for old configs
- Clear communication about changes

## Phase 8: Edge Cases & Polish

### Task 8.1: Handle Edge Cases
**Priority**: High
**Estimated Time**: 2 hours

- [ ] Handle zero capital deployment gracefully
- [ ] Handle 100% capital utilization
- [ ] Handle margin trading edge cases
- [ ] Handle stock liquidation scenarios
- [ ] Add error messages for invalid states

**Acceptance Criteria**:
- All edge cases handled gracefully
- Clear error messages
- No crashes or undefined behavior

### Task 8.2: Logging & Debugging
**Priority**: Medium
**Estimated Time**: 1.5 hours

- [ ] Add comprehensive debug logging
- [ ] Log reallocation decisions
- [ ] Log peak capital updates
- [ ] Add warning logs for unexpected states
- [ ] Create log analysis script

**Acceptance Criteria**:
- Logs provide full visibility
- Easy to debug issues
- Performance not impacted

### Task 8.3: Final Review & Testing
**Priority**: High
**Estimated Time**: 2 hours

- [ ] Code review all changes
- [ ] Run full test suite
- [ ] Test with real historical data
- [ ] Verify metrics match expectations
- [ ] Get user feedback

**Acceptance Criteria**:
- All tests pass
- Code meets quality standards
- Ready for production use

## Summary

**Total Estimated Time**: ~45-50 hours

**Critical Path**:
1. Phase 1 (Infrastructure) → Phase 2 (Mode 1) → Phase 4 (Metrics) → Phase 6 (Testing)
2. Phase 3 (Mode 2) can be done in parallel with Phase 5 (Frontend)

**Minimum Viable Product (MVP)**:
- Phase 1, 2, 4.1, 4.2, 6.1, 6.2, 8.1
- Estimated: ~25 hours
- Delivers: Mode 1 with dual metrics

**Full Feature Set**:
- All phases except 7.2, 7.3 (docs)
- Estimated: ~40 hours
- Delivers: Both modes with frontend

**Production Ready**:
- All phases
- Estimated: ~50 hours
- Delivers: Complete feature with documentation
