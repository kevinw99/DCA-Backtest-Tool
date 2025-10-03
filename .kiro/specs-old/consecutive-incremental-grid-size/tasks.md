# Implementation Plan

- [x] 1. Create core infrastructure services ✅ COMPLETED
  - Create GridSizeCalculatorService with Python integration
  - Implement AllTimeHighTracker for price monitoring
  - Implement ConsecutiveBuyCounter for state management
  - Add comprehensive logging for all intermediate values
  - _Requirements: 1.1, 1.4, 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 2. Implement Python integration layer ✅ COMPLETED
  - Create PythonIntegrationService for subprocess execution
  - Add error handling and fallback mechanisms for Python failures
  - Implement parameter validation for generate_sequence calls
  - Add Python environment validation checks
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 3. Modify DCA backtest service for dynamic grid sizing ✅ COMPLETED
  - Update dcaBacktestService.js to use consecutive-incremental grid sizes
  - Integrate AllTimeHighTracker and ConsecutiveBuyCounter into backtest logic
  - Implement Max Lots auto-calculation using min(0.7 / gridInterval - 1, 10)
  - Add grid size calculation calls during trailing stop buy processing
  - _Requirements: 2.2, 2.3, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4. Enhance trailing stop buy system integration ✅ COMPLETED
  - Modify trailing stop buy logic to use dynamic grid sizes instead of fixed gridIntervalPercent
  - Update buy order validation to work with variable grid sizes
  - Ensure grid spacing protection works with consecutive-incremental spacing
  - Maintain all existing trailing stop buy safety checks and validation
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 5. Update transaction logging and state management ✅ COMPLETED
  - Enhance transaction records to include consecutiveBuyCount and gridSizeUsed
  - Add allTimeHighAtPurchase and startParameter to transaction logs
  - Implement state reset logic when sell orders are executed
  - Add debug logging for all grid size calculations and state changes
  - _Requirements: 1.2, 3.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 6. Update frontend UI to hide Max Lots input ✅ COMPLETED
  - Modify DCABacktestForm.js to hide Max Lots input field from user interface
  - Add display of calculated Max Lots value in backtest results
  - Update parameter validation to work without user-provided Max Lots
  - Ensure form validation works correctly with hidden Max Lots field
  - _Requirements: 2.1, 8.1, 8.2_

- [x] 7. Enhance results display with grid size information ✅ COMPLETED
  - Update BacktestResults.js to show grid size information in transaction history
  - Add consecutive buy count display for each transaction
  - Include all-time high tracking information in debug display
  - Show calculated Max Lots value in summary metrics
  - _Requirements: 8.2, 8.3, 8.4_

- [x] 8. Implement comprehensive error handling ✅ COMPLETED
  - Add fallback to fixed grid interval when Python integration fails
  - Implement validation for all grid size calculation parameters
  - Add error recovery for corrupted state conditions
  - Ensure graceful degradation when consecutive-incremental system encounters errors
  - _Requirements: 6.4, 6.5_

- [x] 9. Add unit tests for new services ✅ COMPLETED
  - Write tests for GridSizeCalculatorService including Max Lots calculation
  - Create tests for AllTimeHighTracker price update logic
  - Implement tests for ConsecutiveBuyCounter increment and reset functionality
  - Add tests for PythonIntegrationService subprocess execution
  - _Requirements: 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 6.1, 6.2, 6.3_

- [x] 10. Perform integration testing and validation ✅ COMPLETED
  - Test end-to-end consecutive-incremental grid size calculation flow
  - Validate that dynamic grid sizes work correctly with existing trailing stop logic
  - Test Max Lots calculation with various grid interval values (5%, 10%, 15%, 20%)
  - Verify that all logging and debugging information is captured correctly
  - _Requirements: 1.1, 1.4, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 11. Update parameter validation and UI integration ✅ COMPLETED
  - Modify frontend parameter validation to work with consecutive-incremental system
  - Ensure gridInterval compatibility validation is in place
  - Test that UI updates work correctly across all backtest modes
  - Validate that batch optimization mode works with new Max Lots calculation
  - _Requirements: 8.5, 2.1, 2.2, 2.3, 2.4_

- [x] 12. Final testing and documentation updates ✅ COMPLETED
  - Perform comprehensive end-to-end testing with various market scenarios
  - Test edge cases including continuous declining markets and volatile conditions
  - Update REQUIREMENTS.md to reflect consecutive-incremental grid size feature
  - Verify all console logging works correctly for debugging purposes
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 1.1, 1.2, 1.4_

## Phase 2: UI-Configurable Toggle Feature

- [x] 13. Add UI toggle control for consecutive-incremental grid sizing ✅ COMPLETED
  - Add checkbox/toggle input to DCABacktestForm.js for "Enable Consecutive-Incremental Grid Sizing"
  - Position toggle control logically within the form layout near grid interval settings
  - Add appropriate labeling and help text to explain the feature
  - Set default value to false (disabled) to maintain backward compatibility
  - Include toggle state in form validation and parameter handling

- [x] 14. Update backend API to handle toggle parameter ✅ COMPLETED
  - Modify DCA backtest endpoint to accept enableConsecutiveIncremental parameter
  - Update parameter validation to include the new toggle parameter
  - Ensure the toggle parameter is properly passed through batch optimization modes
  - Add the toggle parameter to shortDCABacktestService.js for short selling support
  - Update API documentation and error handling for the new parameter

- [x] 15. Implement conditional logic in DCA backtest service ✅ COMPLETED
  - Modify dcaBacktestService.js to conditionally use consecutive-incremental or fixed grid sizing
  - When toggle is disabled, revert to original fixed grid interval behavior
  - When toggle is enabled, use existing consecutive-incremental logic
  - Ensure Max Lots calculation respects the toggle setting (auto-calculate when enabled, use provided value when disabled)
  - Maintain proper state management for both modes

- [x] 16. Update frontend Max Lots input handling ✅ COMPLETED
  - Show/hide Max Lots input field based on toggle state
  - When consecutive-incremental is enabled, hide input and show calculated value
  - When consecutive-incremental is disabled, show input field for manual entry
  - Update form validation to require Max Lots input only when toggle is disabled
  - Ensure smooth UI transitions when toggle state changes

- [x] 17. Update batch optimization and URL parameter handling ✅ COMPLETED
  - Ensure batch optimization mode properly handles the toggle parameter
  - Update URL parameter parsing to include enableConsecutiveIncremental
  - Modify batch result generation to respect toggle setting for each optimization run
  - Update result display to indicate which mode was used for each backtest
  - Ensure backward compatibility with existing batch optimization URLs

- [x] 18. Update results display and transaction logging ✅ COMPLETED
  - Modify BacktestResults.js to conditionally show consecutive-incremental specific columns
  - When toggle is disabled, hide Grid Size Used, Consecutive Buys, All-Time High, Start Parameter columns
  - When toggle is enabled, show all consecutive-incremental related information
  - Update summary metrics display to reflect which mode was used
  - Ensure result exports include toggle state information

- [ ] 19. Add comprehensive testing for toggle functionality
  - Write unit tests for conditional logic in backend services
  - Test frontend toggle behavior and UI state management
  - Verify backward compatibility when toggle is disabled
  - Test batch optimization with mixed toggle settings
  - Validate API parameter handling for both enabled and disabled states

- [x] 20. Update configuration defaults and validation ✅ COMPLETED
  - Add enableConsecutiveIncremental to backtestDefaults.json with default value false
  - Update parameter validation schemas to include the new toggle parameter
  - Ensure proper error handling when toggle conflicts with other parameters
  - Update any configuration documentation or help text
  - Test default parameter loading and form initialization

- [x] 21. Perform integration testing for toggle feature ✅ COMPLETED
  - Test end-to-end functionality with toggle enabled and disabled
  - Verify smooth switching between modes within the same session
  - Test that results are consistent with expected behavior for each mode
  - Validate that all existing functionality remains intact when toggle is disabled
  - Test edge cases and error scenarios for both modes
