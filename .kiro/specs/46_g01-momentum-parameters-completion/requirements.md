# Requirements: Complete Momentum Parameters per G01 Guidelines

## Problem Statement

The `momentumBasedBuy` and `momentumBasedSell` parameters were added in Spec 45, but the implementation is **incomplete** according to G01 (Adding New Parameters) guidelines.

### G01 Multi-Mode Support Principle (Violated)

**From G01 README.md:**
> By default, new parameters should automatically be available across ALL modes:
> - Single backtest (long/short) ✅ DONE
> - Portfolio backtest ✅ DONE
> - Batch mode backtest ❌ **MISSING**

**Current Status:**

| Component | Single Mode | Portfolio Mode | Batch Mode | Status |
|-----------|-------------|----------------|------------|--------|
| **Backend Logic** | | | | |
| `dcaExecutor.js` | ✅ Added | ✅ Used | ✅ Used | Complete |
| `dcaBacktestService.js` | ✅ Added | ✅ Used | ✅ Used | Complete |
| `server.js` API | ✅ Added | ✅ Added | ❓ Unknown | **Need Check** |
| **Configuration** | | | | |
| `backtestDefaults.json` | ✅ Added | ✅ Added | ✅ Added | Complete |
| **Frontend UI** | | | | |
| Single Backtest Form | ✅ Added | N/A | N/A | Complete |
| Portfolio Backtest Form | N/A | ✅ Added (6 refs) | N/A | Complete |
| Batch Backtest Form | N/A | N/A | ❌ **MISSING** | **Incomplete** |
| **URL Handling** | | | | |
| `URLParameterManager.js` | ✅ Added | ✅ Works | ❌ **MISSING** | **Incomplete** |
| **Testing** | | | | |
| Manual curl tests | ✅ Exists | ✅ Exists | ❌ **MISSING** | **Incomplete** |
| **Documentation** | | | | |
| API docs | ❌ **MISSING** | ❌ **MISSING** | ❌ **MISSING** | **Incomplete** |
| User guide | ❌ **MISSING** | ❌ **MISSING** | ❌ **MISSING** | **Incomplete** |

## Analysis Against G01 Checklist

### Phase 1: Backend Core Logic
- [x] **G02-Step1**: Add parameter extraction in `dcaExecutor.js` ✅ DONE
- [x] **G02-Step2**: Implement parameter logic in executor ✅ DONE
- [x] **G02-Step3**: Add statistics tracking ✅ DONE
- [x] **G02-Step4**: Pass parameter from `dcaBacktestService.js` ✅ DONE
- [x] **G02-Step5**: Add parameter to `server.js` route handler ✅ DONE (single + portfolio)
- [ ] **G02-Step5b**: Add parameter to batch API route handler ❌ **NEEDS VERIFICATION**
- [x] **G02-Step6**: Include parameter in API response ✅ DONE

### Phase 2: Configuration
- [x] **G03-Step1**: Add default value to `backtestDefaults.json` ✅ DONE
- [x] **G03-Step2**: Add ticker-specific defaults N/A (not needed)

### Phase 3: Frontend UI
- [x] **G04-Step1**: Add form control to `DCABacktestForm.js` ✅ DONE
- [x] **G04-Step2**: Add to React state initialization ✅ DONE
- [x] **G04-Step3**: Add to localStorage save/load logic ✅ DONE
- [x] **G04-Step4**: Add help text ✅ DONE
- [x] **G04-Step5**: Add to Portfolio form ✅ DONE (manual URL handling in 3 places)
- [ ] **G04-Step6**: Add to Batch form ❌ **MISSING**

### Phase 4: URL Parameter Handling
- [x] **G05-Step1**: Add to `URLParameterManager.js` encoding ✅ DONE
- [x] **G05-Step2**: Add to `URLParameterManager.js` decoding ✅ DONE
- [x] **G05-Step3**: Add to boolean params array ✅ DONE
- [ ] **G05-Step4**: Test URL round-trip for batch mode ❌ **MISSING**

### Phase 5: Testing
- [x] **G06-Step1**: Create curl test command (single) ✅ DONE
- [x] **G06-Step2**: Test backend API directly (single + portfolio) ✅ DONE
- [x] **G06-Step3**: Test frontend UI form (single + portfolio) ✅ DONE
- [x] **G06-Step4**: Test URL encoding/decoding (single + portfolio) ✅ DONE
- [ ] **G06-Step5**: Test batch mode ❌ **MISSING**
- [ ] **G06-Step6**: Verify batch results ❌ **MISSING**

### Phase 6: Documentation
- [ ] **DOC-Step1**: API documentation ❌ **COMPLETELY MISSING**
- [ ] **DOC-Step2**: User guide ❌ **COMPLETELY MISSING**
- [ ] **DOC-Step3**: Update G01 with lessons learned ❌ **MISSING**

## Requirements

### FR-1: Batch Mode Backend Support
**User Story:** As a batch backtest user, I want to use momentum parameters when running batch analysis, so I can compare momentum vs traditional strategies at scale.

**Acceptance Criteria:**
- [ ] Batch backtest API accepts `momentumBasedBuy` parameter
- [ ] Batch backtest API accepts `momentumBasedSell` parameter
- [ ] Parameters pass through to `dcaExecutor.js` correctly
- [ ] Batch results include momentum statistics per symbol
- [ ] Backward compatible (existing batch configs work unchanged)

### FR-2: Batch Mode Frontend UI
**User Story:** As a batch backtest user, I want UI controls for momentum parameters in the batch form, so I can easily enable/disable momentum mode for batch tests.

**Acceptance Criteria:**
- [ ] Batch form includes momentum parameter checkboxes
- [ ] Parameters persist in localStorage
- [ ] Parameters encoded in shareable URLs
- [ ] Help text explains momentum mode impact on batch tests
- [ ] UI state management works correctly

### FR-3: Comprehensive Documentation
**User Story:** As a new user, I want documentation explaining momentum parameters, so I understand when and how to use them.

**Acceptance Criteria:**
- [ ] API documentation includes momentum parameters
- [ ] User guide explains momentum trading concepts
- [ ] Examples provided for all three modes (single, portfolio, batch)
- [ ] Curl test examples documented
- [ ] Parameter interactions documented

### FR-4: Testing Completeness
**User Story:** As a developer, I want comprehensive tests for momentum parameters in batch mode, so I know they work correctly.

**Acceptance Criteria:**
- [ ] Curl test script for batch mode with momentum
- [ ] Verified batch results match expected behavior
- [ ] URL encoding/decoding tested for batch mode
- [ ] Performance tested (batch with 50+ symbols)

## Gap Analysis Summary

### Critical Gaps (Must Fix)
1. **Batch Mode Support**: Missing completely
   - Backend: Need to verify `batchBacktestService.js` passes parameters
   - Frontend: Need to add UI controls to batch form
   - Testing: Need batch-specific tests

2. **Documentation**: Missing completely
   - No API documentation
   - No user guide
   - No curl examples documented

### Minor Gaps (Should Fix)
3. **G01 Update**: Lessons learned not captured
   - Portfolio manual URL handling is tricky
   - P/L gating required careful state management
   - Should document these patterns in G01

## Success Criteria

1. **Batch mode works identically to single/portfolio modes**
   - ✅ Parameters accepted
   - ✅ Logic executes correctly
   - ✅ Results include momentum statistics
   - ✅ UI controls functional

2. **Documentation complete**
   - ✅ API reference includes parameters
   - ✅ User guide explains concepts
   - ✅ Examples for all modes
   - ✅ Curl tests documented

3. **G01 compliance achieved**
   - ✅ All checklist items complete
   - ✅ Multi-mode support verified
   - ✅ Testing comprehensive
   - ✅ Documentation exists

## Affected Files

### Backend (Need Verification)
- `/Users/kweng/AI/DCA-Backtest-Tool/backend/services/batchBacktestService.js` ❓
- `/Users/kweng/AI/DCA-Backtest-Tool/backend/server.js` ❓ (batch route)

### Frontend (Need Implementation)
- `/Users/kweng/AI/DCA-Backtest-Tool/frontend/src/components/batch/BatchBacktestForm.js` ❌ (or equivalent)
- `/Users/kweng/AI/DCA-Backtest-Tool/frontend/src/utils/URLParameterManager.js` ❓ (batch encoding)

### Documentation (Need Creation)
- `/docs/api/momentum-parameters.md` ❌ NEW
- `/docs/guides/momentum-trading.md` ❌ NEW
- `/.kiro/specs/generic/G01_adding-new-parameter/lessons-learned.md` ❌ NEW

### Testing (Need Creation)
- `/backend/test_momentum_batch.sh` ❌ NEW

## Out of Scope

- Additional momentum features (already implemented in Spec 45)
- Performance optimizations (already good enough)
- New momentum parameters (just complete existing ones)
- Machine learning or automatic parameter tuning

## Dependencies

- Spec 45 (Momentum-Based Trading) must be fully implemented
- G01 (Adding New Parameters) spec exists
- Batch backtest infrastructure exists and working

## Risks

### Risk 1: Batch Service Already Has Parameters
**Likelihood:** Medium
**Impact:** Low
**Mitigation:** Start with verification phase - check if batch service already passes parameters through. If yes, only documentation is needed.

### Risk 2: Batch Form Doesn't Exist or Has Different Structure
**Likelihood:** Medium
**Impact:** Medium
**Mitigation:** Research batch UI implementation first. May need to add parameters in different location than expected.

### Risk 3: Documentation Effort Underestimated
**Likelihood:** High
**Impact:** Low
**Mitigation:** Use Spec 45 documentation as template. Focus on practical examples over theory.

## Assumptions

1. Batch backtest infrastructure exists and is functional
2. Batch mode uses same executor (`dcaExecutor.js`) as single/portfolio modes
3. URLParameterManager encoding/decoding already handles batch mode URLs
4. Momentum parameters should work identically across all modes
5. Documentation can be created in markdown format

## Next Steps

1. **Verification Phase** (~1 hour)
   - Check if `batchBacktestService.js` already passes parameters
   - Check if batch API route includes parameters
   - Determine actual gaps vs assumptions

2. **Implementation Phase** (~3-5 hours)
   - Add batch UI controls if needed
   - Verify/fix batch backend if needed
   - Create documentation files

3. **Testing Phase** (~2 hours)
   - Create batch test scripts
   - Verify batch results
   - Test URL encoding for batch

4. **Documentation Phase** (~3 hours)
   - Write API documentation
   - Write user guide
   - Update G01 with lessons learned
