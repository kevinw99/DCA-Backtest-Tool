# DCA Scenario Detection and Adaptive Strategy - Implementation Tasks

## Phase 1: Core Scenario Detection Service

### Task 1.1: Create Scenario Detection Service

**File:** `/backend/services/scenarioDetectionService.js`

**Steps:**

1. Create new service file
2. Implement `detectScenario()` main entry point
3. Implement `extractMetrics()` to gather relevant data from backtest result
4. Add enable/disable flag check (return `null` if disabled)

**Acceptance Criteria:**

- Service exports main `detectScenario()` function
- Returns `null` when `enableScenarioDetection` is `false`
- Extracts all required metrics from backtest result
- No errors when called with valid backtest result

**Estimated Time:** 1 hour

---

### Task 1.2: Implement Scenario Classification Logic

**File:** `/backend/services/scenarioDetectionService.js`

**Steps:**

1. Define `SCENARIO_THRESHOLDS` configuration object
2. Implement `isDowntrendScenario()` detection
3. Implement `isFastRallyScenario()` detection
4. Implement `isOscillatingUptrendScenario()` detection
5. Implement `classifyScenario()` with priority ordering (downtrend first)

**Acceptance Criteria:**

- Each scenario has clear detection criteria
- Downtrend checked first (highest risk)
- Returns scenario type, key metrics, and analysis
- Falls back to 'mixed' when no clear match

**Estimated Time:** 2 hours

---

### Task 1.3: Implement Confidence Score Calculation

**File:** `/backend/services/scenarioDetectionService.js`

**Steps:**

1. Implement `getScenarioThresholds()` helper
2. Implement `meetsThreshold()` comparison logic
3. Implement `calculateConfidence()` score (0-1 range)
4. Add confidence level interpretation (high/medium/low)

**Acceptance Criteria:**

- Confidence score between 0-1
- Based on how many criteria are met
- Returns higher confidence when all criteria strongly met

**Estimated Time:** 1 hour

---

### Task 1.4: Implement Recommendations Engine

**File:** `/backend/services/scenarioDetectionService.js`

**Steps:**

1. Implement `generateRecommendations()` function
2. Add downtrend recommendations (stop-loss, position sizing, trend filter)
3. Add fast rally recommendations (initial position, wider grids)
4. Add oscillating uptrend recommendations (validation messages)
5. Add priority levels (critical/high/medium/low)

**Acceptance Criteria:**

- Each scenario type generates appropriate recommendations
- Recommendations include: priority, action, reason, suggestion
- At least 2-3 recommendations per scenario
- Clear, actionable language

**Estimated Time:** 2 hours

---

### Task 1.5: Implement Enhanced Risk Metrics

**File:** `/backend/services/scenarioDetectionService.js`

**Steps:**

1. Implement `calculateEnhancedRiskMetrics()` function
2. Calculate `capitalEfficiencyScore`
3. Calculate `opportunityCost` vs buy-and-hold
4. Calculate `scenarioRiskScore` (0-100)
5. Calculate `maxUnrealizedDrawdown`
6. Calculate `buySellRatio`

**Acceptance Criteria:**

- All 5 new metrics calculated correctly
- Capital efficiency considers profitable deployment time
- Risk score properly weighted (return, drawdown, utilization)
- Max unrealized drawdown tracks paper losses

**Estimated Time:** 2 hours

---

## Phase 2: Backend Integration

### Task 2.1: Integrate with DCA Backtest Service

**File:** `/backend/services/dcaBacktestService.js`

**Steps:**

1. Add `enableScenarioDetection` parameter (default: true)
2. Import scenario detection service
3. Call `detectScenario()` after backtest completes
4. Add `scenarioAnalysis` to result object (or null if disabled)
5. Add `enhancedRiskMetrics` to result object

**Acceptance Criteria:**

- No changes to existing backtest logic
- Scenario analysis only runs when enabled
- Result structure unchanged when disabled
- No errors or performance degradation

**Estimated Time:** 1 hour

---

### Task 2.2: Integrate with Short DCA Backtest Service

**File:** `/backend/services/shortDCABacktestService.js`

**Steps:**

1. Mirror changes from long DCA service
2. Adjust scenario detection for short strategy (inverse logic if needed)
3. Test with short strategy backtests

**Acceptance Criteria:**

- Short strategy gets scenario analysis
- Recommendations appropriate for shorts
- Same enable/disable behavior

**Estimated Time:** 1 hour

---

### Task 2.3: Add Configuration to Defaults

**File:** `/config/backtestDefaults.json`

**Steps:**

1. Add `"enableScenarioDetection": true` to defaults

**Acceptance Criteria:**

- Default config includes new flag
- Set to `true` by default

**Estimated Time:** 5 minutes

---

### Task 2.4: Update Batch Backtest Service

**File:** `/backend/services/batchBacktestService.js`

**Steps:**

1. Pass `enableScenarioDetection` flag to individual backtests
2. Implement `calculateScenarioDistribution()` function
3. Add scenario summary to batch results
4. Calculate symbol-scenario matrix

**Acceptance Criteria:**

- Each backtest in batch gets scenario analysis
- Aggregate distribution calculated (count per scenario type)
- Symbols grouped by scenario type
- Returns `null` for summary if disabled

**Estimated Time:** 2 hours

---

## Phase 3: Frontend UI Components

### Task 3.1: Create Scenario Analysis Component

**File:** `/frontend/src/components/ScenarioAnalysis.js`

**Steps:**

1. Create new React component
2. Define scenario configuration (icons, colors, labels)
3. Implement scenario header with icon and confidence badge
4. Implement key metrics display section
5. Implement recommendations list with priority styling
6. Handle null scenario (when disabled)

**Acceptance Criteria:**

- Component renders when scenario analysis present
- Returns null when scenario analysis not available
- Color-coded by scenario type
- Responsive design
- Clear visual hierarchy

**Estimated Time:** 3 hours

---

### Task 3.2: Create Batch Scenario Summary Component

**File:** `/frontend/src/components/BatchScenarioSummary.js`

**Steps:**

1. Create new React component
2. Implement scenario distribution bar chart
3. Implement symbol grouping by scenario
4. Add expandable details sections
5. Calculate and display percentages

**Acceptance Criteria:**

- Bar chart shows distribution visually
- Percentages calculated correctly
- Symbols clickable/expandable per scenario
- Handles null summary gracefully

**Estimated Time:** 3 hours

---

### Task 3.3: Add CSS Styling

**File:** `/frontend/src/App.css` or component-specific CSS

**Steps:**

1. Add `.scenario-analysis-card` styles
2. Add `.scenario-header` styles with border colors
3. Add `.confidence-badge` styles
4. Add `.recommendation` styles with priority variants
5. Add `.batch-scenario-summary` styles
6. Add `.scenario-chart` bar chart styles

**Acceptance Criteria:**

- Professional, clean design
- Color-coded by scenario type
- Priority badges clearly visible
- Responsive layout

**Estimated Time:** 2 hours

---

### Task 3.4: Integrate Scenario Analysis into BacktestResults

**File:** `/frontend/src/components/BacktestResults.js`

**Steps:**

1. Import `ScenarioAnalysis` component
2. Add scenario analysis section after metrics
3. Pass `scenarioAnalysis` and `enhancedRiskMetrics` props
4. Add section header

**Acceptance Criteria:**

- Scenario analysis displayed in results
- Positioned logically (after main metrics, before transactions)
- Only shown when available

**Estimated Time:** 30 minutes

---

### Task 3.5: Integrate Scenario Summary into BatchResults

**File:** `/frontend/src/components/BatchResults.js`

**Steps:**

1. Import `BatchScenarioSummary` component
2. Add summary section at top of batch results
3. Pass `scenarioSummary` prop from batch results
4. Add expand/collapse functionality

**Acceptance Criteria:**

- Summary displayed prominently
- Easy to understand distribution
- Can expand to see symbol details

**Estimated Time:** 30 minutes

---

### Task 3.6: Add Enable/Disable Toggle to Form

**File:** `/frontend/src/components/DCABacktestForm.js`

**Steps:**

1. Add checkbox for `enableScenarioDetection`
2. Default to `true` (checked)
3. Add helpful tooltip/description
4. Persist to localStorage
5. Include in both single and batch modes

**Acceptance Criteria:**

- Checkbox visible and functional
- Defaults to enabled
- Saved to localStorage
- Included in form submission

**Estimated Time:** 30 minutes

---

## Phase 4: Testing and Validation

### Task 4.1: Unit Tests for Scenario Detection

**File:** `/backend/services/scenarioDetectionService.test.js`

**Steps:**

1. Create test file
2. Test downtrend detection with sample data
3. Test fast rally detection with sample data
4. Test oscillating uptrend detection with sample data
5. Test confidence calculation
6. Test recommendations generation
7. Test enable/disable flag

**Acceptance Criteria:**

- All scenario types correctly detected
- Edge cases handled (no trades, all losses, etc.)
- Confidence scores reasonable
- Disable flag works

**Estimated Time:** 3 hours

---

### Task 4.2: Integration Tests

**File:** `/backend/services/dcaBacktestService.test.js`

**Steps:**

1. Test backtest with scenario detection enabled
2. Test backtest with scenario detection disabled
3. Verify result structure
4. Test batch backtest scenario distribution
5. Test performance (ensure <100ms overhead)

**Acceptance Criteria:**

- Scenario analysis present when enabled
- Null when disabled
- No breaking changes to existing tests
- Performance acceptable

**Estimated Time:** 2 hours

---

### Task 4.3: Manual Validation

**Steps:**

1. Run 100 diverse backtests
2. Manually classify each scenario
3. Compare with algorithm classification
4. Calculate accuracy rate (target: >90%)
5. Identify misclassifications and adjust thresholds

**Acceptance Criteria:**

- > 90% agreement with manual classification
- Document any edge cases
- Threshold adjustments if needed

**Estimated Time:** 4 hours

---

### Task 4.4: UI Testing

**Steps:**

1. Test scenario analysis display with all scenario types
2. Test batch scenario summary
3. Test enable/disable toggle
4. Test responsive design (mobile/tablet/desktop)
5. Cross-browser testing

**Acceptance Criteria:**

- All UI components render correctly
- No visual bugs
- Works on all major browsers
- Responsive design works

**Estimated Time:** 2 hours

---

## Phase 5: Documentation and Rollout

### Task 5.1: Update API Documentation

**File:** `/backend/README.md` or API docs

**Steps:**

1. Document `enableScenarioDetection` parameter
2. Document scenario analysis result structure
3. Document enhanced risk metrics
4. Add usage examples

**Acceptance Criteria:**

- Clear documentation of new features
- Examples provided
- Migration guide (no breaking changes)

**Estimated Time:** 1 hour

---

### Task 5.2: Create User Guide

**File:** `/docs/scenario-detection-guide.md`

**Steps:**

1. Explain three scenario types
2. Provide interpretation guide
3. Explain recommendations
4. Add FAQ section

**Acceptance Criteria:**

- Non-technical explanation
- Visual examples
- Clear action items

**Estimated Time:** 2 hours

---

### Task 5.3: Add Feature Flag Management

**File:** `/frontend/src/utils/featureFlags.js` (if not exists)

**Steps:**

1. Create feature flag utility
2. Add `SCENARIO_DETECTION` flag
3. Allow easy toggling for testing
4. Add to settings page (future)

**Acceptance Criteria:**

- Centralized flag management
- Easy to enable/disable for testing
- Prepared for A/B testing

**Estimated Time:** 1 hour

---

### Task 5.4: Performance Optimization

**Files:** Various

**Steps:**

1. Profile scenario detection performance
2. Optimize heavy calculations
3. Add memoization where beneficial
4. Ensure <100ms overhead target met

**Acceptance Criteria:**

- Scenario detection completes in <100ms
- No noticeable impact on backtest speed
- Memory usage reasonable

**Estimated Time:** 2 hours

---

### Task 5.5: Error Handling and Logging

**Files:** Various service files

**Steps:**

1. Add try-catch blocks around scenario detection
2. Add meaningful error logging
3. Ensure graceful degradation on errors
4. Add debug logging (when verbose flag set)

**Acceptance Criteria:**

- No crashes from scenario detection
- Useful error messages logged
- System continues working if detection fails
- Debug logging available

**Estimated Time:** 1 hour

---

## Summary

### Total Estimated Time: 40-45 hours

### Breakdown by Phase:

- **Phase 1: Core Service** - 8 hours
- **Phase 2: Backend Integration** - 5 hours
- **Phase 3: Frontend UI** - 9.5 hours
- **Phase 4: Testing** - 11 hours
- **Phase 5: Documentation & Rollout** - 7 hours

### Priority Order:

1. **P0 (Must Have):** Tasks 1.1-1.5, 2.1, 2.3, 3.1, 3.4, 3.6, 4.1
2. **P1 (Should Have):** Tasks 2.2, 2.4, 3.2, 3.3, 3.5, 4.2, 4.3
3. **P2 (Nice to Have):** Tasks 4.4, 5.1-5.5

### Dependencies:

- Phase 2 depends on Phase 1 completion
- Phase 3 depends on Phase 2 completion
- Phase 4 can start after core features (Phases 1-2)
- Phase 5 runs in parallel with Phase 4

### Risk Mitigation:

- Start with enable/disable flag (Task 2.3) - ensures easy rollback
- Unit tests early (Task 4.1) - catch issues quickly
- Manual validation (Task 4.3) - ensure accuracy
- Performance testing (Task 5.4) - prevent slowdowns

### Quick Win Path (Minimum Viable Product):

If time is limited, implement in this order:

1. Tasks 1.1-1.4 (Core detection, 6 hours)
2. Task 2.1 (Integration, 1 hour)
3. Task 2.3 (Config, 5 min)
4. Task 3.1 (UI component, 3 hours)
5. Task 3.4 (Display in results, 30 min)
6. Task 3.6 (Toggle, 30 min)

**MVP Total: ~11 hours** - Gives you basic scenario detection in individual backtests with a working UI and toggle.
