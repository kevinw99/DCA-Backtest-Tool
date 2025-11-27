# Requirements Document

## Introduction

This feature introduces a consecutive-incremental grid size system for the DCA trading platform. Instead of using a fixed grid interval percentage for all buy orders, the system will dynamically calculate increasing grid sizes for consecutive buy orders using a mathematical sequence generator. This enhancement aims to optimize buying behavior by spacing purchases more strategically as the price continues to decline from all-time highs.

## Requirements

### Requirement 1

**User Story:** As a DCA trader, I want the system to use increasing grid sizes for consecutive buy orders, so that I can optimize my dollar cost averaging strategy with larger spacing as prices decline further from peaks.

#### Acceptance Criteria

1. WHEN the system calculates the next buy price THEN it SHALL use the simple function to determine the grid size
   based on consecutive buy count
2. WHEN a sell order is executed THEN the system SHALL reset the consecutive buy count to 0
3. WHEN the first buy order is placed THEN the consecutive buy count SHALL start at 0 and increment to 1 after execution
4. WHEN calculating grid sizes THEN the system SHALL use decimal values (0.1 = 10%, 0.05 = 5%) consistently throughout all calculations

5. WHEN a buy order is executed THEN the system SHALL increment consecutive_buy_count_ith by 1
6. WHEN a sell order is executed THEN the system SHALL reset consecutive_buy_count_ith to 0

### Requirement 4

**User Story:** As a system, I want to calculate dynamic grid sizes using the generate_sequence function, so that consecutive buy orders have progressively larger spacing from all-time high prices.
Please update to use simple formula instead of generate_sequence to calculate next_consecutive_buy_grid_size =

#### Acceptance Criteria

5. WHEN calculating next_consecutive_buy_price THEN the system SHALL use: current_buy_price - (1-next_consecutive_buy_grid_size)

### Requirement 5

**User Story:** As a developer, I want comprehensive logging of all intermediate values, so that I can debug and verify the consecutive-incremental grid size calculations.

#### Acceptance Criteria

2. WHEN consecutive buy count changes THEN the system SHALL log consecutive_buy_count_ith to console
3. WHEN next_consecutive_buy_grid_size is calculated THEN the system SHALL log the returned grid size to console
4. WHEN next_consecutive_buy_price is calculated THEN the system SHALL log the calculated price to console

### Requirement 6

**User Story:** As a user, I want the consecutive-incremental grid size feature to work seamlessly with the existing trailing stop buy system, so that the enhanced grid sizing doesn't interfere with the current trading logic.
Make it configurable to turn on/off consecutive-incremental grid size feature

#### Acceptance Criteria

1. WHEN a trailing stop buy order is triggered THEN the system SHALL use the consecutive-incremental grid size for price calculation
2. WHEN validating buy orders THEN the system SHALL ensure the new price respects the calculated grid spacing from ALL existing lots
3. WHEN the trailing stop buy system activates THEN it SHALL use the dynamically calculated grid size instead of the fixed gridIntervalPercent
4. WHEN portfolio limits are checked THEN the system SHALL use the dynamically calculated Max_Lots value
5. WHEN grid spacing protection is applied THEN it SHALL work with the variable grid sizes from consecutive buys

### Requirement 8

**User Story:** As a user, I want the frontend UI to be updated to reflect the new consecutive-incremental grid size feature, so that I can configure and monitor the enhanced DCA strategy.

#### Acceptance Criteria

3. WHEN displaying transaction history THEN each buy transaction SHALL show the grid size that was used for that specific purchase
4. WHEN showing debug information THEN the system SHALL display consecutive buy counts from the 0th
   consecutive buy price
