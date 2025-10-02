# Coefficient Terminology Implementation Tasks

## Overview

This task list focuses on updating the beta-parameter-correlation feature to use proper terminology:

- **Coefficient**: The multiplier values (0.25, 0.5, 1, 1.5, 2, 3) in batch mode
- **Beta**: The actual beta value from Yahoo Finance for each stock
- **Beta_factor**: The calculated value (beta \* coefficient) used in parameter calculations

## Tasks to Complete

- [ ] 1. Update batch mode UI terminology
  - Update DCABacktestForm batch mode to label multiple values as "Coefficient" instead of "Beta"
  - Change UI labels from "Beta Values" to "Coefficient Values" in batch parameter selection
  - Update tooltips and help text to explain coefficient vs beta vs beta_factor
  - Ensure the predefined options (0.25, 0.5, 1.0, 1.5, 2.0, 3.0) are labeled as coefficients
  - _Requirements: 2.1, 2.4_

- [ ] 2. Update parameter calculation logic to use beta_factor
  - Modify ParameterCorrelationService to calculate beta_factor = beta \* coefficient
  - Update all parameter calculations to use beta_factor instead of direct beta
  - Ensure profitRequirement = 0.05 \* beta_factor
  - Ensure gridIntervalPercent = 0.1 \* beta_factor
  - Ensure trailingBuyActivationPercent = 0.1 \* beta_factor
  - Ensure trailingBuyReboundPercent = 0.05 \* beta_factor
  - Ensure trailingSellActivationPercent = 0.2 \* beta_factor
  - Ensure trailingSellPullbackPercent = 0.1 \* beta_factor
  - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3, 4.4_

- [ ] 3. Update parameter display to show all three values
  - Modify BetaControls component to display beta, coefficient, and beta_factor separately
  - Show calculation: "Beta Factor = Beta (2.1) × Coefficient (1.5) = 3.15"
  - Update parameter display to show base values and final calculated values with beta_factor
  - Add clear labeling for each component in the calculation chain
  - _Requirements: 3.4, 3.5_

- [ ] 4. Update batch backtest service for coefficient handling
  - Modify BatchBacktestService to handle coefficient arrays instead of beta arrays
  - Update parameter matrix generation to use beta \* coefficient calculations
  - Ensure each backtest result stores beta, coefficient, and beta_factor values
  - Update batch result processing to include all three values in output
  - _Requirements: 2.2, 2.3, 2.5_

- [ ] 5. Update batch results display with proper terminology
  - Modify BatchResults component to show coefficient, beta, and beta_factor columns
  - Update result filtering and sorting to work with coefficient values
  - Change column headers from "Beta" to "Coefficient" where appropriate
  - Add beta_factor column to results table
  - Update export functionality to include all three values with proper labels
  - _Requirements: 2.4, 5.2, 5.3_

- [ ] 6. Update API endpoints for coefficient terminology
  - Modify POST /api/backtest/beta-parameters to accept coefficient parameter
  - Update request/response schemas to include beta, coefficient, and beta_factor
  - Ensure backward compatibility with existing beta-only requests
  - Update API documentation to reflect new terminology
  - _Requirements: 3.3, 3.5_

- [ ] 7. Update database storage for coefficient tracking
  - Add coefficient column to relevant database tables if needed
  - Update backtest result storage to include coefficient and beta_factor values
  - Ensure historical data migration handles the terminology change
  - Update database queries to work with new column structure
  - _Requirements: 3.5, 5.1_

- [ ] 8. Update single mode coefficient handling
  - Modify single backtest mode to use coefficient = 1.0 by default
  - Ensure single mode calculations use beta_factor = beta \* 1.0
  - Update single mode UI to optionally show coefficient (defaulting to 1.0)
  - Maintain backward compatibility for existing single mode usage
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 9. Add validation for coefficient values
  - Implement validation to ensure coefficient values are positive numbers
  - Add warnings for extreme coefficient values (e.g., > 5.0 or < 0.1)
  - Update parameter bounds checking to account for beta_factor calculations
  - Ensure coefficient validation in both single and batch modes
  - _Requirements: 2.1, 3.3_

- [ ] 10. Update documentation and help text
  - Update all user-facing documentation to use correct terminology
  - Add explanations of beta vs coefficient vs beta_factor
  - Update example calculations in help text (e.g., "TSLA beta=2.1, coefficient=1.5, beta_factor=3.15")
  - Ensure tooltips and error messages use consistent terminology
  - _Requirements: 3.4, 2.4_

## Example Calculation Reference

For TSLA with beta = 2.1 and coefficient = 1.5:

- beta_factor = 2.1 × 1.5 = 3.15
- Trailing Buy Activation% = 10% × 3.15 = 31.5%
- Trailing Buy Rebound% = 5% × 3.15 = 15.75%
- Trailing Sell Activation% = 20% × 3.15 = 63%
- Trailing Sell Pullback% = 10% × 3.15 = 31.5%
- Profit Requirement = 5% × 3.15 = 15.75%
- Grid Interval% = 10% × 3.15 = 31.5%
