# Requirements Document

## Introduction

This feature implements comprehensive URL-based backtest configuration to enable sharing and reproducing backtest results. Users will be able to copy URLs that contain all backtest parameters, allowing them to share specific configurations or debug issues by reproducing exact test conditions in different browser sessions.

## Requirements

### Requirement 1

**User Story:** As a user, I want the URL to update with backtest parameters when I run a single backtest, so that I can share or bookmark specific test configurations.

#### Acceptance Criteria

1. WHEN user clicks "Run Backtest" in single mode THEN the URL SHALL update to include all current parameter values
2. WHEN user navigates to a URL with backtest parameters THEN the system SHALL automatically load those parameters and display the backtest results
3. WHEN user copies and pastes the URL to another browser THEN the same backtest results SHALL be displayed
4. WHEN user navigates back to parameter page from a backtest URL THEN the URL SHALL revert to the parameter page URL

### Requirement 2

**User Story:** As a user, I want the URL to update with batch parameters when I run batch optimization, so that I can reproduce batch test configurations.

#### Acceptance Criteria

1. WHEN user clicks "Run Batch Optimization" THEN the URL SHALL update to include all batch parameter values
2. WHEN user navigates to a batch URL THEN the system SHALL automatically load those parameters and display the batch results
3. WHEN user copies and pastes a batch URL to another browser THEN the same batch optimization results SHALL be displayed
4. WHEN user navigates back to parameter page from a batch URL THEN the URL SHALL revert to the parameter page URL

### Requirement 3

**User Story:** As a user, I want individual batch result rows to generate shareable URLs when clicked, so that I can share specific optimized configurations.

#### Acceptance Criteria

1. WHEN user clicks on a batch result row THEN the URL SHALL update to include the specific parameter combination from that row
2. WHEN user navigates to a batch result URL THEN the system SHALL display the single backtest results for those specific parameters
3. WHEN user copies and pastes a batch result URL to another browser THEN the same single backtest results SHALL be displayed

### Requirement 4

**User Story:** As a developer, I want the server to log URL parameters for debugging purposes, so that I can troubleshoot backtest configuration issues.

#### Acceptance Criteria

1. WHEN server receives a backtest request with URL parameters THEN it SHALL log all parameters to the server log before processing
2. WHEN server processes single backtest requests THEN it SHALL log the source of parameters (URL vs form)
3. WHEN server processes batch requests THEN it SHALL log the batch configuration parameters

### Requirement 5

**User Story:** As a user, I want parameter page persistence to continue working when navigating between pages, so that my form inputs are not lost.

#### Acceptance Criteria

1. WHEN user navigates from parameter page to backtest results THEN parameter values SHALL be preserved in localStorage
2. WHEN user navigates back to parameter page THEN previously entered values SHALL be restored from localStorage
3. WHEN user loads parameters from URL THEN localStorage SHALL be updated with those values
4. WHEN user modifies parameters after loading from URL THEN localStorage SHALL reflect the current form state

### Requirement 6

**User Story:** As a user, I want URL updates to only occur when running tests, so that the URL doesn't change unexpectedly during parameter editing.

#### Acceptance Criteria

1. WHEN user modifies parameters on the parameter page THEN the URL SHALL NOT change
2. WHEN user switches between single and batch modes THEN the URL SHALL NOT change
3. WHEN user navigates to parameter page from any other page THEN the URL SHALL update to reflect parameter page state
4. WHEN user clicks browser back/forward buttons THEN the application SHALL handle URL changes appropriately without breaking navigation
