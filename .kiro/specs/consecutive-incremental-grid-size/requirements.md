# Requirements Document

## Introduction

This feature introduces a consecutive-incremental grid size system for the DCA trading platform. Instead of using a fixed grid interval percentage for all buy orders, the system will dynamically calculate increasing grid sizes for consecutive buy orders using a mathematical sequence generator. This enhancement aims to optimize buying behavior by spacing purchases more strategically as the price continues to decline from all-time highs.

## Requirements

### Requirement 1

**User Story:** As a DCA trader, I want the system to use increasing grid sizes for consecutive buy orders, so that I can optimize my dollar cost averaging strategy with larger spacing as prices decline further from peaks.

#### Acceptance Criteria

1. WHEN the system calculates the next buy price THEN it SHALL use the generate_sequence function to determine the grid size based on consecutive buy count
2. WHEN a sell order is executed THEN the system SHALL reset the consecutive buy count to 0
3. WHEN the first buy order is placed THEN the consecutive buy count SHALL start at 0 and increment to 1 after execution
4. WHEN calculating grid sizes THEN the system SHALL use decimal values (0.1 = 10%, 0.05 = 5%) consistently throughout all calculations

### Requirement 2

**User Story:** As a user, I want the Max Lots option to be automatically calculated and hidden from the UI, so that the system can dynamically determine the maximum number of lots based on the grid interval and mathematical constraints.

#### Acceptance Criteria

1. WHEN the user configures backtest parameters THEN the Max Lots input field SHALL NOT be displayed in the UI
2. WHEN calculating Max Lots THEN the system SHALL use the formula: min(0.7 / gridInterval - 1, 10)
3. WHEN gridInterval is 10% (0.1) THEN Max Lots SHALL be calculated as min(0.7/0.1 - 1, 10) = min(6, 10) = 6
4. WHEN gridInterval is 5% (0.05) THEN Max Lots SHALL be calculated as min(0.7/0.05 - 1, 10) = min(13, 10) = 10

### Requirement 3

**User Story:** As a system, I want to track all-time high prices and consecutive buy counts, so that I can calculate appropriate grid sizes based on the current market position relative to peaks.

#### Acceptance Criteria

1. WHEN the backtest starts THEN the system SHALL initialize all_time_high_price to the first available price
2. WHEN processing each trading day THEN the system SHALL update all_time_high_price if current price exceeds the existing all-time high
3. WHEN a buy order is executed THEN the system SHALL increment consecutive_buy_count_ith by 1
4. WHEN a sell order is executed THEN the system SHALL reset consecutive_buy_count_ith to 0
5. WHEN calculating the start parameter THEN the system SHALL use: (all_time_high_price - current_buy_price) / all_time_high_price

### Requirement 4

**User Story:** As a system, I want to calculate dynamic grid sizes using the generate_sequence function, so that consecutive buy orders have progressively larger spacing from all-time high prices.

#### Acceptance Criteria

1. WHEN calculating the next buy grid size THEN the system SHALL call generate_sequence(n, start, firstDelta, end=0.7, ith+1)
2. WHEN determining n THEN the system SHALL use: Max_Lots - consecutive_buy_count_ith
3. WHEN determining start THEN the system SHALL use: (all_time_high_price - current_buy_price) / all_time_high_price
4. WHEN determining firstDelta THEN the system SHALL use the configured gridInterval option (e.g., 0.05 for 5%)
5. WHEN calculating next_consecutive_buy_price THEN the system SHALL use: current_buy_price - all_time_high_price \* next_consecutive_buy_grid_size

### Requirement 5

**User Story:** As a developer, I want comprehensive logging of all intermediate values, so that I can debug and verify the consecutive-incremental grid size calculations.

#### Acceptance Criteria

1. WHEN any grid size calculation occurs THEN the system SHALL log all_time_high_price to console
2. WHEN consecutive buy count changes THEN the system SHALL log consecutive_buy_count_ith to console
3. WHEN start parameter is calculated THEN the system SHALL log the start value to console
4. WHEN generate_sequence is called THEN the system SHALL log n, start, firstDelta, and ith parameters to console
5. WHEN next_consecutive_buy_grid_size is calculated THEN the system SHALL log the returned grid size to console
6. WHEN next_consecutive_buy_price is calculated THEN the system SHALL log the calculated price to console

### Requirement 6

**User Story:** As a user, I want the system to integrate the Python generate_sequence function with the Node.js backend, so that the consecutive-incremental grid size calculations are performed accurately.

#### Acceptance Criteria

1. WHEN the backend needs to calculate grid sizes THEN it SHALL execute the Python generate_sequence function via subprocess
2. WHEN calling the Python function THEN the system SHALL pass all required parameters (n, start, firstDelta, end, ith)
3. WHEN the Python function returns results THEN the system SHALL parse the output and extract the grid size value
4. WHEN Python execution fails THEN the system SHALL fall back to the original fixed grid interval method
5. WHEN integrating with existing trailing stop buy logic THEN the system SHALL maintain all existing validation and safety checks

### Requirement 7

**User Story:** As a user, I want the consecutive-incremental grid size feature to work seamlessly with the existing trailing stop buy system, so that the enhanced grid sizing doesn't interfere with the current trading logic.

#### Acceptance Criteria

1. WHEN a trailing stop buy order is triggered THEN the system SHALL use the consecutive-incremental grid size for price calculation
2. WHEN validating buy orders THEN the system SHALL ensure the new price respects the calculated grid spacing from ALL existing lots
3. WHEN the trailing stop buy system activates THEN it SHALL use the dynamically calculated grid size instead of the fixed gridIntervalPercent
4. WHEN portfolio limits are checked THEN the system SHALL use the dynamically calculated Max_Lots value
5. WHEN grid spacing protection is applied THEN it SHALL work with the variable grid sizes from consecutive buys

### Requirement 8

**User Story:** As a user, I want the frontend UI to be updated to reflect the new consecutive-incremental grid size feature, so that I can configure and monitor the enhanced DCA strategy.

#### Acceptance Criteria

1. WHEN displaying backtest configuration THEN the Max Lots field SHALL be hidden from the user interface
2. WHEN showing backtest results THEN the system SHALL display the actual Max Lots value that was calculated and used
3. WHEN displaying transaction history THEN each buy transaction SHALL show the grid size that was used for that specific purchase
4. WHEN showing debug information THEN the system SHALL display consecutive buy counts and all-time high tracking
5. WHEN parameter validation occurs THEN the system SHALL validate that gridInterval is compatible with the consecutive-incremental system
