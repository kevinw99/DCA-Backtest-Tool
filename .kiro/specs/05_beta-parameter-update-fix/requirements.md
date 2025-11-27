# Requirements Document

## Introduction

The Beta parameter scaling feature has critical implementation issues where enabling Beta scaling triggers infinite useEffect loops and fails to actually update the form parameters with beta-adjusted values. While the β-Factor calculation is correct, the adjusted parameters are not being applied to the actual form inputs, causing the backtest to run with base parameters instead of beta-scaled ones.

## Requirements

### Requirement 1

**User Story:** As a user enabling Beta scaling, I want the system to avoid infinite loops and excessive re-rendering so that the interface remains responsive and stable.

#### Acceptance Criteria

1. WHEN Beta scaling is toggled THEN the system SHALL trigger parameter recalculation exactly once
2. WHEN useEffect dependencies change THEN the system SHALL not cause infinite loops or excessive localStorage saves
3. WHEN calculateAdjustedParameters runs THEN it SHALL complete without triggering additional useEffect cycles
4. WHEN parameters are updated THEN the system SHALL maintain stable state without continuous recalculation
5. WHEN console logging occurs THEN it SHALL not show repeated "Conditions met/not met" messages

### Requirement 2

**User Story:** As a user with Beta scaling enabled, I want the actual form parameters to update with beta-adjusted values so that my backtest runs with the correct scaled parameters.

#### Acceptance Criteria

1. WHEN Beta scaling is enabled AND adjusted parameters are calculated THEN the form parameters SHALL update to show the beta-scaled values
2. WHEN viewing parameter inputs THEN they SHALL display the actual values that will be used in the backtest
3. WHEN β-Factor is 1.800 AND base trailing sell pullback is 10% THEN the displayed parameter SHALL show 18.0% (10% × 1.8)
4. WHEN parameters are beta-adjusted THEN all affected parameters SHALL update simultaneously and consistently
5. WHEN Beta scaling is disabled THEN parameters SHALL revert to their base values

### Requirement 3

**User Story:** As a user, I want clear visual indication when parameters are beta-adjusted so that I understand which values are being used in calculations.

#### Acceptance Criteria

1. WHEN Beta scaling is enabled THEN parameter inputs SHALL visually indicate they are beta-adjusted
2. WHEN parameters are calculated THEN the system SHALL show both base and adjusted values clearly
3. WHEN backtest results are displayed THEN they SHALL include the actual parameter values used
4. WHEN parameters are extreme due to beta adjustment THEN the system SHALL provide appropriate warnings
5. WHEN switching between scaled and unscaled modes THEN the parameter changes SHALL be immediately visible

### Requirement 4

**User Story:** As a user, I want my Beta scaling preference to be remembered across sessions so that I don't have to re-enable it every time I use the application.

#### Acceptance Criteria

1. WHEN I enable Beta scaling THEN the system SHALL save this preference to localStorage
2. WHEN I reload the application THEN the Beta scaling toggle SHALL restore to my previous setting
3. WHEN Beta scaling is enabled from localStorage THEN all dependent calculations SHALL initialize correctly
4. WHEN I disable Beta scaling THEN the system SHALL update localStorage and remember this preference
5. WHEN switching between different symbols THEN the Beta scaling preference SHALL persist

### Requirement 5

**User Story:** As a developer, I want proper state management and dependency handling so that Beta parameter updates work reliably without side effects.

#### Acceptance Criteria

1. WHEN adjustedParameters state changes THEN it SHALL trigger form parameter updates without causing loops
2. WHEN useEffect dependencies are defined THEN they SHALL not include values that change as a result of the effect
3. WHEN parameters are updated THEN localStorage saves SHALL occur efficiently without duplication
4. WHEN Beta scaling state changes THEN all dependent calculations SHALL complete in the correct order
5. WHEN async operations complete THEN state updates SHALL not conflict with ongoing calculations
