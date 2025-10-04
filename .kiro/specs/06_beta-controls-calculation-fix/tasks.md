# Implementation Plan

- [x] 1. Add coefficient state management to DCABacktestForm
  - Add coefficient state variable with default value 1.0
  - Add betaFactor calculated state that updates when beta, coefficient, or enableBetaScaling changes
  - Create calculateBetaFactor helper function that returns beta \* coefficient when scaling enabled, otherwise just beta
  - Add coefficient persistence to localStorage for single mode
  - _Requirements: 2.2, 2.5, 5.1, 5.2_

- [x] 2. Fix BetaControls prop passing in DCABacktestForm
  - Add coefficient and betaFactor props to BetaControls component usage
  - Add onCoefficientChange callback prop to handle coefficient updates
  - Ensure betaFactor is recalculated whenever beta, coefficient, or enableBetaScaling changes
  - Update useEffect hooks to trigger betaFactor recalculation appropriately
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3. Update BetaControls component calculation display
  - Fix β-Factor calculation display to show correct mathematical result
  - Update calculation formula to conditionally show coefficient multiplication based on enableBetaScaling
  - Ensure displayed betaFactor value matches the formula calculation
  - Add conditional display logic for scaling enabled vs disabled states
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4_

- [x] 4. Add coefficient input field to BetaControls
  - Create editable coefficient input field with proper validation
  - Add coefficient change handler with number validation (positive, 0.1-5.0 range)
  - Implement coefficient editing UI similar to beta editing (edit/save/cancel pattern)
  - Add coefficient input to the calculation display section
  - _Requirements: 2.1, 2.3, 2.4, 1.5_

- [x] 5. Enhance beta data source indication
  - Update beta source detection to clearly distinguish between Yahoo Finance, mock data, and defaults
  - Modify fetchBetaData to properly set betaSource based on API response
  - Add clear indication when beta data is mock/default vs real API data
  - Improve source display formatting and add appropriate timestamps
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6. Fix beta scaling toggle behavior
  - Ensure coefficient only affects calculations when enableBetaScaling is true
  - Update parameter calculation logic to respect beta scaling state
  - Fix betaFactor calculation to ignore coefficient when scaling disabled
  - Update dependent parameter displays to reflect correct scaling state
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 7. Update parameter calculation API integration
  - Modify calculateAdjustedParameters function to pass correct coefficient value
  - Ensure API calls include proper coefficient parameter for single mode
  - Update parameter calculation to use betaFactor instead of raw beta
  - Verify backend parameter calculation service handles coefficient correctly
  - _Requirements: 1.5, 5.3, 5.4_

- [x] 8. Add comprehensive validation and error handling
  - Add coefficient input validation with appropriate error messages
  - Implement betaFactor bounds checking and warnings for extreme values
  - Add NaN prevention in all calculation functions
  - Create proper error states for invalid coefficient inputs
  - _Requirements: 2.4, 1.4, 1.5_

- [x] 9. Update component state synchronization
  - Ensure all beta-related state changes trigger appropriate recalculations
  - Fix useEffect dependencies to prevent stale state issues
  - Add proper cleanup for async operations in beta data fetching
  - Verify coefficient changes propagate correctly to all dependent calculations
  - _Requirements: 5.5, 1.5, 2.3_

- [x] 10. Add unit tests for calculation logic
  - Write tests for betaFactor calculation with various beta and coefficient combinations
  - Test coefficient validation and error handling
  - Add tests for beta scaling enabled/disabled scenarios
  - Create tests for edge cases and extreme values
  - _Requirements: All requirements validation_
