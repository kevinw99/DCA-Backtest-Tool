# Spec 39: Implementation Tasks - Shared Backtest Configuration Components

## Task Breakdown

### Phase 1: Foundation & Utilities (Days 1-2)

#### Task 1.1: Create Project Structure
**Estimated Time:** 30 minutes

- [ ] Create directory structure:
  ```
  frontend/src/components/backtest/
  ├── sections/
  ├── utils/
  ├── hooks/
  └── shared/
  ```
- [ ] Create empty component files
- [ ] Create utility module files
- [ ] Create custom hook files

**Verification:**
- All directories and files exist
- No import errors

---

#### Task 1.2: Implement ValidationHelper Utility
**Estimated Time:** 2 hours

- [ ] Create `frontend/src/components/backtest/utils/ValidationHelper.js`
- [ ] Implement individual field validators:
  - [ ] `validateLotSize(value)`
  - [ ] `validateMaxLots(value)`
  - [ ] `validateMaxLotsToSell(maxLotsToSell, maxLots)`
  - [ ] `validateGridInterval(value)`
  - [ ] `validateProfitRequirement(value)`
  - [ ] `validateDateRange(startDate, endDate)`
  - [ ] `validateBetaCoefficient(value)`
  - [ ] `validateTotalCapital(totalCapital, lotSize)`
- [ ] Implement cross-field validators:
  - [ ] `validateTrailingStopLogic(activation, rebound)`
- [ ] Implement beta-adjusted warnings:
  - [ ] `checkBetaAdjustedExtremes(adjustedValue, baseValue, threshold)`
- [ ] Implement full form validator:
  - [ ] `validateBacktestForm(parameters, mode)`
- [ ] Write unit tests for all validators

**Verification:**
- All tests pass
- Validation correctly identifies invalid inputs
- Returns structured error objects with field names and messages

---

#### Task 1.3: Implement ParameterHelper Utility
**Estimated Time:** 2 hours

- [ ] Create `frontend/src/components/backtest/utils/ParameterHelper.js`
- [ ] Implement default loading:
  - [ ] `getGlobalDefaults()` - Load from backtestDefaults.json
  - [ ] `getStockDefaults(symbol)` - Merge global + stock-specific
  - [ ] `mergeStockDefaults(globalDefaults, stockDefaults)` - Deep merge logic
- [ ] Implement localStorage persistence:
  - [ ] `loadFromLocalStorage(key)`
  - [ ] `saveToLocalStorage(key, parameters)`
  - [ ] `clearLocalStorage(key)`
- [ ] Implement URL parameter parsing:
  - [ ] `parseURLParameters(queryString)` - Parse query params
  - [ ] `generateURLParameters(parameters)` - Generate URL string
- [ ] Implement parameter comparison:
  - [ ] `getDifferences(params1, params2)` - Show what changed
  - [ ] `hasStockSpecificOverrides(symbol)` - Check if stock has custom params
- [ ] Write unit tests

**Verification:**
- Successfully loads from backtestDefaults.json
- Deep merge works correctly (nested objects)
- localStorage read/write works
- URL parsing round-trips correctly

---

#### Task 1.4: Implement BetaCalculator Utility
**Estimated Time:** 2 hours

- [ ] Create `frontend/src/components/backtest/utils/BetaCalculator.js`
- [ ] Implement single stock beta calculation:
  - [ ] `applyBetaScaling(value, beta, coefficient)` - Scale single value
  - [ ] `calculateAdjustedParameters(baseParams, symbol, coefficient)` - Scale all params
  - [ ] `restoreBaseParameters(adjustedParams, beta, coefficient)` - Reverse scaling
- [ ] Implement portfolio beta calculation:
  - [ ] `calculatePortfolioBetaScaling(baseParams, symbols, coefficient)` - Multi-stock scaling
  - [ ] Load beta from backtestDefaults.json per stock
- [ ] Implement API integration:
  - [ ] `fetchBetaFromAPI(symbol)` - Call `/api/beta/calculate-adjusted-parameters`
  - [ ] Error handling and retry logic
- [ ] Write unit tests

**Verification:**
- Beta scaling formula correct: `adjustedValue = baseValue × beta × coefficient`
- Portfolio mode uses correct beta per stock
- Restoring base parameters works (reversible)
- API integration works

---

### Phase 2: Custom Hooks (Day 2)

#### Task 2.1: Implement useBacktestValidation Hook
**Estimated Time:** 1.5 hours

- [ ] Create `frontend/src/components/backtest/hooks/useBacktestValidation.js`
- [ ] Implement hook:
  - [ ] Accept `parameters` and `mode` as arguments
  - [ ] Use `useEffect` to validate on parameter changes
  - [ ] Return `{ errors, isValid }`
- [ ] Add debouncing to avoid excessive validation
- [ ] Write unit tests

**Verification:**
- Hook returns validation errors correctly
- Re-validates when parameters change
- Debouncing works (doesn't validate on every keystroke)

---

#### Task 2.2: Implement useBetaScaling Hook
**Estimated Time:** 2 hours

- [ ] Create `frontend/src/components/backtest/hooks/useBetaScaling.js`
- [ ] Implement state management:
  - [ ] `enableBetaScaling` state
  - [ ] `betaData` state (beta, betaFactor, coefficient)
  - [ ] `baseParameters` state
  - [ ] `adjustedParameters` state
  - [ ] `loading` state
  - [ ] `error` state
- [ ] Implement functions:
  - [ ] `toggleBetaScaling()` - Enable/disable beta scaling
  - [ ] `calculateAdjusted()` - Fetch and calculate adjusted params
  - [ ] `updateCoefficient(newCoefficient)` - Update coefficient and recalculate
- [ ] Handle single vs portfolio mode
- [ ] Write unit tests

**Verification:**
- Toggling beta scaling updates parameters
- Coefficient changes trigger recalculation
- Portfolio mode handles multiple symbols
- State persists correctly

---

#### Task 2.3: Implement useParameterDefaults Hook
**Estimated Time:** 1 hour

- [ ] Create `frontend/src/components/backtest/hooks/useParameterDefaults.js`
- [ ] Implement default loading logic:
  - [ ] Single mode: Load global + stock-specific defaults
  - [ ] Portfolio mode: Load global defaults only
- [ ] Handle loading state
- [ ] Handle errors
- [ ] Write unit tests

**Verification:**
- Defaults load from backtestDefaults.json
- Single mode merges stock-specific overrides
- Portfolio mode uses global defaults
- Loading state works

---

### Phase 3: Shared UI Components (Days 3-4)

#### Task 3.1: Create Shared Input Components
**Estimated Time:** 2 hours

- [ ] Create `frontend/src/components/backtest/shared/ParameterInput.js`
  - [ ] Props: label, value, onChange, type, min, max, step, error, helpText
  - [ ] Renders label, input, error message, help text
  - [ ] Supports beta-adjusted indicator
- [ ] Create `frontend/src/components/backtest/shared/PercentageSlider.js`
  - [ ] Props: label, value, onChange, min, max, step
  - [ ] Renders slider with percentage display
- [ ] Create `frontend/src/components/backtest/shared/SectionHeader.js`
  - [ ] Props: icon, title, subtitle
  - [ ] Consistent section header styling
- [ ] Write component tests

**Verification:**
- Components render correctly
- Controlled inputs work (value/onChange)
- Error states display properly
- Beta indicators show when `betaAdjusted={true}`

---

#### Task 3.2: Implement BasicParametersSection
**Estimated Time:** 3 hours

- [ ] Create `frontend/src/components/backtest/sections/BasicParametersSection.js`
- [ ] Implement prop interface:
  - [ ] `parameters`, `onParametersChange`, `mode`, `validationErrors`
  - [ ] `showStrategyMode`, `showMaxLotsToSell`, `showTotalCapital`, `showMaxLotsPerStock`
- [ ] Implement UI:
  - [ ] Lot Size input
  - [ ] Max Lots input
  - [ ] Max Lots to Sell input (conditional)
  - [ ] Strategy Mode toggle (Long/Short) (conditional)
  - [ ] Total Capital input (portfolio mode)
  - [ ] Max Lots Per Stock input (portfolio mode)
- [ ] Add validation error display
- [ ] Write component tests

**Verification:**
- Single mode shows correct inputs
- Portfolio mode shows portfolio-specific inputs
- Validation errors display correctly
- onChange callback fires with updated parameters

---

#### Task 3.3: Implement DateRangeSection
**Estimated Time:** 1 hour

- [ ] Create `frontend/src/components/backtest/sections/DateRangeSection.js`
- [ ] Implement prop interface:
  - [ ] `parameters`, `onParametersChange`, `validationErrors`
- [ ] Implement UI:
  - [ ] Start Date input
  - [ ] End Date input
- [ ] Add date range validation
- [ ] Write component tests

**Verification:**
- Date inputs work correctly
- Validation ensures start < end
- Default to reasonable date range

---

#### Task 3.4: Implement LongStrategySection
**Estimated Time:** 3 hours

- [ ] Create `frontend/src/components/backtest/sections/LongStrategySection.js`
- [ ] Implement prop interface:
  - [ ] `parameters`, `onParametersChange`, `betaAdjusted`, `validationErrors`
  - [ ] `showTrailingStops`, `showOrderType`
- [ ] Implement UI:
  - [ ] Grid Interval input (with β indicator if betaAdjusted)
  - [ ] Profit Requirement input (with β indicator if betaAdjusted)
  - [ ] Trailing Buy Activation input
  - [ ] Trailing Buy Rebound input
  - [ ] Trailing Sell Activation input
  - [ ] Trailing Sell Pullback input
  - [ ] Enable Trailing Buy checkbox
  - [ ] Enable Trailing Sell checkbox
  - [ ] Trailing Stop Order Type (LIMIT/MARKET) radio buttons (conditional)
- [ ] Add validation
- [ ] Write component tests

**Verification:**
- All inputs render correctly
- Beta indicators show when betaAdjusted=true
- Trailing stop logic validated (activation > rebound)
- Order type selection works

---

#### Task 3.5: Implement BetaControlsSection
**Estimated Time:** 4 hours

- [ ] Create `frontend/src/components/backtest/sections/BetaControlsSection.js`
- [ ] Implement prop interface:
  - [ ] `symbol`, `parameters`, `onParametersChange`, `mode`
  - [ ] `enableBetaScaling`, `onBetaScalingChange`
  - [ ] `betaData`, `onBetaDataChange`
  - [ ] `onCalculateAdjusted`, `showAdjustedValues`
- [ ] Implement UI:
  - [ ] Enable Beta Scaling checkbox
  - [ ] Beta display (read-only)
  - [ ] Coefficient slider (0.25 - 3.0)
  - [ ] Beta Factor calculation display (beta × coefficient)
  - [ ] Manual Beta Override checkbox
  - [ ] Manual Beta input (if override enabled)
  - [ ] "Calculate Adjusted Parameters" button
  - [ ] Loading spinner
  - [ ] Error message display
- [ ] Implement single vs portfolio mode differences:
  - [ ] Single: Show single beta value
  - [ ] Portfolio: Show "Applied to all stocks using stock-specific beta values"
- [ ] Integrate with BetaCalculator utility
- [ ] Write component tests

**Verification:**
- Beta scaling toggle works
- Coefficient slider updates beta factor
- Calculate button fetches adjusted parameters
- Portfolio mode uses per-stock beta values
- Loading and error states work

---

#### Task 3.6: Implement ShortStrategySection
**Estimated Time:** 3 hours

- [ ] Create `frontend/src/components/backtest/sections/ShortStrategySection.js`
- [ ] Implement prop interface:
  - [ ] `parameters`, `onParametersChange`, `betaAdjusted`, `validationErrors`, `enabled`
- [ ] Implement UI:
  - [ ] Max Shorts input
  - [ ] Max Shorts to Cover input
  - [ ] Grid Interval (short) input
  - [ ] Profit Requirement (short) input
  - [ ] Trailing Short Activation input
  - [ ] Trailing Short Pullback input
  - [ ] Trailing Cover Activation input
  - [ ] Trailing Cover Rebound input
  - [ ] Hard Stop Loss input
  - [ ] Portfolio Stop Loss input
  - [ ] Cascade Stop Loss input
- [ ] Add warning message about unlimited loss risk
- [ ] Conditional rendering based on `enabled` prop
- [ ] Write component tests

**Verification:**
- Only renders when enabled=true
- All short strategy parameters render
- Stop loss inputs work
- Warning message displays

---

#### Task 3.7: Implement DynamicFeaturesSection
**Estimated Time:** 2 hours

- [ ] Create `frontend/src/components/backtest/sections/DynamicFeaturesSection.js`
- [ ] Implement prop interface:
  - [ ] `parameters`, `onParametersChange`, `validationErrors`
  - [ ] `showBatchRanges`
- [ ] Implement UI:
  - [ ] Enable Dynamic Grid checkbox
  - [ ] Dynamic Grid Multiplier slider (0.5 - 2.0)
  - [ ] Enable Consecutive Incremental Buy Grid checkbox
  - [ ] Grid Consecutive Increment input (conditional)
  - [ ] Enable Consecutive Incremental Sell Profit checkbox
  - [ ] Enable Scenario Detection checkbox
  - [ ] Normalize to Reference checkbox
- [ ] Show batch ranges when `showBatchRanges=true`
- [ ] Write component tests

**Verification:**
- All toggles work
- Conditional inputs show/hide correctly
- Slider updates multiplier value
- Batch mode shows ranges

---

#### Task 3.8: Implement AdaptiveStrategySection
**Estimated Time:** 2 hours

- [ ] Create `frontend/src/components/backtest/sections/AdaptiveStrategySection.js`
- [ ] Implement prop interface:
  - [ ] `parameters`, `onParametersChange`, `validationErrors`
- [ ] Implement UI:
  - [ ] Enable Adaptive Strategy checkbox
  - [ ] Adaptation Check Interval (days) input (conditional)
  - [ ] Adaptation Rolling Window (days) input (conditional)
  - [ ] Min Data Days Before Adaptation input (conditional)
  - [ ] Confidence Threshold input (conditional)
- [ ] Add info card explaining adaptive strategy
- [ ] Write component tests

**Verification:**
- Adaptive strategy toggle works
- Conditional inputs show when enabled
- Default values set correctly
- Info card explains feature

---

### Phase 4: Form Refactoring (Days 5-6)

#### Task 4.1: Refactor DCABacktestForm to Use Shared Components
**Estimated Time:** 4 hours

- [ ] Import all shared components
- [ ] Import custom hooks
- [ ] Replace inline parameter sections with shared components:
  - [ ] BasicParametersSection
  - [ ] DateRangeSection
  - [ ] BetaControlsSection
  - [ ] LongStrategySection
  - [ ] ShortStrategySection (conditional)
  - [ ] DynamicFeaturesSection
  - [ ] AdaptiveStrategySection
- [ ] Use `useBacktestValidation` hook
- [ ] Use `useBetaScaling` hook
- [ ] Remove duplicated code
- [ ] Ensure batch mode still works
- [ ] Update CSS imports
- [ ] Run integration tests

**Verification:**
- DCABacktestForm renders correctly
- All parameters work as before
- No regressions
- Batch mode still functional
- Beta scaling works
- Validation works

---

#### Task 4.2: Enhance PortfolioBacktestForm with All Parameters
**Estimated Time:** 5 hours

- [ ] Import all shared components
- [ ] Import custom hooks
- [ ] Add all missing sections:
  - [ ] BetaControlsSection (NEW)
  - [ ] LongStrategySection (enhanced with all parameters)
  - [ ] DynamicFeaturesSection (NEW)
  - [ ] AdaptiveStrategySection (NEW)
- [ ] Update BasicParametersSection usage:
  - [ ] Set `mode="portfolio"`
  - [ ] Enable `showTotalCapital={true}`
  - [ ] Enable `showMaxLotsPerStock={true}`
- [ ] Use `useBacktestValidation` hook
- [ ] Use `useBetaScaling` hook
- [ ] Implement stock-specific parameter overrides:
  - [ ] Load from backtestDefaults.json
  - [ ] Show custom parameter indicators (🎯 icon)
  - [ ] Create stock-specific parameter modal
- [ ] Update CSS imports
- [ ] Run integration tests

**Verification:**
- Portfolio form has all parameters from single form
- Beta scaling works for portfolio
- Stock-specific parameters load from backtestDefaults.json
- Custom parameter indicators show correctly
- Validation works
- No regressions

---

#### Task 4.3: Implement Stock-Specific Parameter Modal (Portfolio)
**Estimated Time:** 3 hours

- [ ] Create `frontend/src/components/backtest/StockParameterModal.js`
- [ ] Implement UI:
  - [ ] Stock selector dropdown
  - [ ] Parameter comparison table (global vs stock-specific)
  - [ ] Highlight differences
  - [ ] "Reset to Global Defaults" button
  - [ ] "Close" button
- [ ] Load parameters from backtestDefaults.json
- [ ] Display read-only (note: changes don't save to file)
- [ ] Write component tests

**Verification:**
- Modal opens/closes correctly
- Shows correct stock-specific parameters
- Differences highlighted
- Reset button works

---

### Phase 5: CSS & Styling (Day 7)

#### Task 5.1: Create Shared CSS Stylesheet
**Estimated Time:** 2 hours

- [ ] Create `frontend/src/components/backtest/BacktestForm.css`
- [ ] Implement shared styles:
  - [ ] `.backtest-section` - Section container
  - [ ] `.parameter-grid` - Grid layout
  - [ ] `.parameter-input` - Input styling
  - [ ] `.beta-adjusted::after` - β indicator
  - [ ] `.error` - Error state
  - [ ] `.error-message` - Error message
  - [ ] `.stock-specific-indicator` - 🎯 icon
- [ ] Import in both DCABacktestForm and PortfolioBacktestForm
- [ ] Remove duplicated CSS from original forms

**Verification:**
- Both forms styled consistently
- Beta indicators show correctly
- Validation errors styled properly
- Responsive layout works

---

#### Task 5.2: Update DCABacktestForm CSS
**Estimated Time:** 1 hour

- [ ] Remove duplicated styles now in shared CSS
- [ ] Keep form-specific styles (batch mode, etc.)
- [ ] Ensure no visual regressions

**Verification:**
- Single stock form looks identical to before
- No broken styles

---

#### Task 5.3: Update PortfolioBacktestForm CSS
**Estimated Time:** 1 hour

- [ ] Remove duplicated styles now in shared CSS
- [ ] Keep form-specific styles (stock selector, total capital)
- [ ] Ensure consistent with single stock form

**Verification:**
- Portfolio form matches single form styling
- Form-specific elements styled correctly

---

### Phase 6: Integration & Testing (Days 8-9)

#### Task 6.1: Integration Testing - Single Stock Form
**Estimated Time:** 3 hours

- [ ] Test all parameter sections render
- [ ] Test parameter changes propagate correctly
- [ ] Test beta scaling enable/disable
- [ ] Test beta coefficient changes
- [ ] Test validation errors
- [ ] Test batch mode (ensure not broken)
- [ ] Test form submission
- [ ] Test URL parameter loading
- [ ] Test localStorage persistence

**Test Cases:**
1. Load form with default parameters
2. Change grid interval, verify validation
3. Enable beta scaling, verify adjusted parameters
4. Change coefficient, verify recalculation
5. Switch to batch mode, verify ranges work
6. Submit form, verify API call
7. Load from URL parameters
8. Refresh page, verify localStorage restored

---

#### Task 6.2: Integration Testing - Portfolio Form
**Estimated Time:** 4 hours

- [ ] Test all parameter sections render (NEW sections)
- [ ] Test parameter changes propagate correctly
- [ ] Test beta scaling for portfolio
- [ ] Test stock-specific parameter loading
- [ ] Test custom parameter indicators (🎯)
- [ ] Test stock parameter modal
- [ ] Test validation errors
- [ ] Test form submission
- [ ] Test multi-stock beta calculation

**Test Cases:**
1. Load form with default parameters
2. Select stocks with custom parameters (AAPL, PLTR)
3. Verify 🎯 indicators show
4. Open stock parameter modal
5. Verify stock-specific parameters displayed
6. Enable beta scaling
7. Verify per-stock beta applied
8. Change coefficient, verify recalculation
9. Submit form, verify API call
10. Verify backend receives stock-specific parameters

---

#### Task 6.3: Regression Testing
**Estimated Time:** 2 hours

- [ ] Test existing single stock backtest flows
- [ ] Test existing portfolio backtest flows
- [ ] Verify no visual regressions
- [ ] Verify no functional regressions
- [ ] Test on different screen sizes (responsive)
- [ ] Test browser compatibility (Chrome, Firefox, Safari)

**Regression Checklist:**
- [ ] Single stock backtest runs successfully
- [ ] Portfolio backtest runs successfully
- [ ] Batch mode works (single stock only)
- [ ] Results display correctly
- [ ] Charts render
- [ ] Future trade predictions work
- [ ] URL sharing works

---

#### Task 6.4: Performance Testing
**Estimated Time:** 1 hour

- [ ] Measure component render times
- [ ] Check for unnecessary re-renders
- [ ] Optimize with React.memo if needed
- [ ] Test with large portfolios (20 stocks)
- [ ] Ensure no lag when changing parameters

**Performance Targets:**
- Component render < 50ms
- Form interaction feels instant
- No lag when typing in inputs
- Beta calculation < 500ms

---

### Phase 7: Documentation & Cleanup (Day 9)

#### Task 7.1: Write Component Documentation
**Estimated Time:** 2 hours

- [ ] Add JSDoc comments to all components
- [ ] Document prop interfaces with PropTypes
- [ ] Create usage examples
- [ ] Document custom hooks with examples
- [ ] Update README with component library overview

**Documentation Sections:**
- Component API (props, events)
- Usage examples
- Integration patterns
- Customization options

---

#### Task 7.2: Code Cleanup
**Estimated Time:** 1 hour

- [ ] Remove commented-out code
- [ ] Remove unused imports
- [ ] Consistent code formatting
- [ ] Run ESLint and fix issues
- [ ] Remove console.log statements

**Cleanup Checklist:**
- [ ] No lint errors
- [ ] No console warnings
- [ ] Consistent naming conventions
- [ ] All files formatted

---

#### Task 7.3: Update Project Documentation
**Estimated Time:** 1 hour

- [ ] Update README.md with component refactoring info
- [ ] Document shared component library
- [ ] Update developer guide
- [ ] Add migration notes for future developers

**Documentation Files:**
- README.md
- CHANGELOG.md
- Developer Guide (if exists)

---

## Summary

**Total Estimated Time:** 6-9 days (48-72 hours)

### Milestone Breakdown:
- **Phase 1 (Foundation):** 7.5 hours - Utilities and helpers
- **Phase 2 (Hooks):** 4.5 hours - Custom React hooks
- **Phase 3 (UI Components):** 20 hours - Shared React components
- **Phase 4 (Form Refactoring):** 12 hours - Integrate shared components
- **Phase 5 (CSS):** 4 hours - Styling and consistency
- **Phase 6 (Testing):** 10 hours - Integration and regression testing
- **Phase 7 (Documentation):** 4 hours - Docs and cleanup

**Total:** 62 hours (~8 working days)

### Critical Path:
1. Phase 1 (Utilities) → Phase 2 (Hooks) → Phase 3 (Components)
2. Phase 3 (Components) → Phase 4 (Form Refactoring)
3. Phase 4 (Form Refactoring) → Phase 6 (Testing)
4. All phases → Phase 7 (Documentation)

### Risk Areas:
- **Beta scaling refactoring:** Complex logic, high risk of regression
- **Stock-specific parameters:** Integration with backtestDefaults.json
- **Portfolio form enhancement:** Large scope, many new features

### Success Criteria:
- ✅ Zero regression in single stock form
- ✅ Portfolio form has 100% parameter parity with single form
- ✅ 30-40% code reduction (target: 1000+ lines removed)
- ✅ All tests pass
- ✅ No performance degradation
