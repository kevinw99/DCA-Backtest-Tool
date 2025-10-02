# Requirements Document

## Introduction

The Beta Controls component in the DCA trading platform has several calculation and display issues that need to be addressed. The component shows incorrect β-Factor calculations, lacks proper coefficient input handling, and doesn't properly distinguish between beta scaling enabled/disabled states. These issues affect user understanding and trust in the beta-based parameter adjustments.

## Requirements

### Requirement 1

**User Story:** As a user viewing beta information, I want to see accurate β-Factor calculations so that I can trust the parameter adjustments being made.

#### Acceptance Criteria

1. WHEN Beta scaling is enabled THEN β-Factor SHALL equal beta × coefficient
2. WHEN Beta scaling is disabled THEN β-Factor SHALL equal beta (coefficient ignored)
3. WHEN displaying the calculation formula THEN the system SHALL show the correct mathematical result
4. WHEN β-Factor is calculated THEN the displayed value SHALL match the formula shown
5. WHEN coefficient changes THEN β-Factor SHALL recalculate immediately and display correctly

### Requirement 2

**User Story:** As a user in single backtest mode, I want to be able to adjust the coefficient value so that I can test different volatility scaling scenarios without switching to batch mode.

#### Acceptance Criteria

1. WHEN viewing Beta controls in single mode THEN the system SHALL provide an editable coefficient field
2. WHEN coefficient is not specified THEN the system SHALL default to 1.0
3. WHEN user changes coefficient THEN the system SHALL update β-Factor and all dependent parameters
4. WHEN coefficient is edited THEN the system SHALL validate the input is a positive number
5. WHEN coefficient is saved THEN the system SHALL persist the value for the current session

### Requirement 3

**User Story:** As a user, I want to clearly understand whether Beta data is real or mock data so that I can make informed decisions about parameter adjustments.

#### Acceptance Criteria

1. WHEN Beta data is fetched from Yahoo Finance THEN the system SHALL display "Yahoo Finance" as the source
2. WHEN Beta data is mock/default THEN the system SHALL display "Default Value" or "Mock Data" as the source
3. WHEN Beta data fetch fails THEN the system SHALL clearly indicate the fallback source
4. WHEN displaying Beta source THEN the system SHALL include the last updated timestamp when available
5. WHEN manual override is active THEN the system SHALL clearly indicate "Manual Override" as the source

### Requirement 4

**User Story:** As a user, I want the Beta scaling toggle to properly control when coefficient affects calculations so that I can understand when parameters are being adjusted.

#### Acceptance Criteria

1. WHEN Beta scaling is disabled THEN coefficient SHALL NOT affect parameter calculations
2. WHEN Beta scaling is disabled THEN β-Factor SHALL equal the raw beta value
3. WHEN Beta scaling is enabled THEN coefficient SHALL multiply with beta to create β-Factor
4. WHEN toggling Beta scaling THEN the display SHALL immediately reflect the correct calculation mode
5. WHEN Beta scaling state changes THEN dependent parameter displays SHALL update accordingly

### Requirement 5

**User Story:** As a developer, I want proper prop passing and state management so that the Beta controls component receives all necessary data for accurate calculations.

#### Acceptance Criteria

1. WHEN BetaControls component renders THEN it SHALL receive coefficient and betaFactor as props
2. WHEN coefficient changes in parent component THEN BetaControls SHALL receive the updated value
3. WHEN betaFactor is calculated THEN the parent component SHALL pass the correct value to BetaControls
4. WHEN Beta scaling is toggled THEN the parent component SHALL recalculate betaFactor appropriately
5. WHEN component state updates THEN all dependent calculations SHALL remain synchronized
