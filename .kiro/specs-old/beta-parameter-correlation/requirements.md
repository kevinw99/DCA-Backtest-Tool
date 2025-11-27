# Requirements Document

## Introduction

This feature introduces Beta-based parameter correlation to the DCA trading platform, allowing trading parameters to automatically adjust based on a stock's volatility (Beta). Beta represents a stock's volatility relative to the overall market, where Beta = 1 means the stock moves with the market, Beta > 1 indicates higher volatility, and Beta < 1 indicates lower volatility. By correlating key trading parameters with Beta, the platform will provide more appropriate risk-adjusted strategies for different types of stocks.

## Requirements

### Requirement 1

**User Story:** As a trader, I want the system to automatically fetch Beta values for stocks so that my trading parameters can be adjusted based on the stock's volatility characteristics.

#### Acceptance Criteria

1. WHEN a user selects a stock symbol THEN the system SHALL attempt to fetch the Beta value from Yahoo Finance or other available data providers
2. IF Beta data is not available from external sources THEN the system SHALL default to Beta = 1.0
3. WHEN Beta is fetched successfully THEN the system SHALL display the Beta value in the parameter configuration interface
4. WHEN Beta is not available THEN the system SHALL allow users to manually input a custom Beta value
5. WHEN a user manually overrides the Beta value THEN the system SHALL use the user-provided value for all calculations

### Requirement 2

**User Story:** As a trader, I want to configure multiple coefficient values for batch backtesting so that I can test strategies across different volatility scaling scenarios.

#### Acceptance Criteria

1. WHEN configuring batch backtests THEN the system SHALL provide predefined coefficient options: 0.25, 0.5, 1.0, 1.5, 2.0, 3.0
2. WHEN running batch backtests THEN the system SHALL allow users to select multiple coefficient values from the predefined list
3. WHEN multiple coefficient values are selected THEN the system SHALL run separate backtests for each coefficient value
4. WHEN batch results are displayed THEN the system SHALL clearly indicate which coefficient value was used for each result set
5. WHEN calculating parameters THEN the system SHALL compute beta_factor = beta * coefficient for each combination

### Requirement 3

**User Story:** As a trader, I want profit and grid parameters to scale with beta_factor so that higher volatility stocks have appropriately adjusted profit targets and grid spacing.

#### Acceptance Criteria

1. WHEN beta_factor is applied to parameters THEN the system SHALL calculate profitRequirement = 0.05 * beta_factor (where beta_factor = beta * coefficient)
2. WHEN beta_factor is applied to parameters THEN the system SHALL calculate gridIntervalPercent = 0.1 * beta_factor
3. WHEN beta or coefficient changes THEN the system SHALL automatically recalculate beta_factor and these dependent parameters
4. WHEN displaying parameters THEN the system SHALL show the base values, beta value, coefficient, beta_factor, and the final calculated values
5. WHEN saving backtest configurations THEN the system SHALL store the beta value, coefficient, beta_factor, and the calculated parameters

### Requirement 4

**User Story:** As a trader, I want trailing stop parameters to scale with Beta so that higher volatility stocks have wider trailing stops to avoid premature exits.

#### Acceptance Criteria

1. WHEN Beta is applied to parameters THEN the system SHALL calculate trailingBuyActivationPercent = 0.1 * Beta
2. WHEN Beta is applied to parameters THEN the system SHALL calculate trailingBuyReboundPercent = 0.05 * Beta
3. WHEN Beta is applied to parameters THEN the system SHALL calculate trailingSellActivationPercent = 0.2 * Beta
4. WHEN Beta is applied to parameters THEN the system SHALL calculate trailingSellPullbackPercent = 0.1 * Beta
5. WHEN Beta changes THEN the system SHALL automatically recalculate all trailing stop parameters
6. WHEN parameters are displayed THEN the system SHALL clearly indicate which values are Beta-adjusted

### Requirement 5

**User Story:** As a trader, I want to see how Beta affects my backtest results so that I can understand the impact of volatility-adjusted parameters on strategy performance.

#### Acceptance Criteria

1. WHEN viewing backtest results THEN the system SHALL display the Beta value used for the test
2. WHEN comparing results THEN the system SHALL allow sorting and filtering by Beta value
3. WHEN exporting results THEN the system SHALL include Beta value and all Beta-adjusted parameters in the export
4. WHEN viewing batch results THEN the system SHALL provide visualization showing performance across different Beta values
5. WHEN analyzing results THEN the system SHALL calculate and display risk-adjusted metrics that account for Beta

### Requirement 6

**User Story:** As a trader, I want the option to override Beta-based calculations so that I can fine-tune parameters when the automatic scaling doesn't meet my specific needs.

#### Acceptance Criteria

1. WHEN configuring parameters THEN the system SHALL provide a toggle to enable/disable Beta-based scaling
2. WHEN Beta scaling is disabled THEN the system SHALL allow manual input of all parameters
3. WHEN Beta scaling is enabled THEN the system SHALL show both base multipliers and resulting calculated values
4. WHEN switching between modes THEN the system SHALL preserve user inputs and provide clear warnings about parameter changes
5. WHEN saving configurations THEN the system SHALL store whether Beta scaling was enabled or disabled