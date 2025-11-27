# Consecutive Incremental Sell Grid - Requirements

## Problem Statement

Current DCA strategy uses a fixed profit requirement for all sells, which can lead to:

- **Selling too early during strong uptrends**: Missing larger profit opportunities when price momentum is strong
- **Not capturing runaway price increases**: When price rapidly increases, we sell at minimum profit and miss the ride
- **Inefficient profit capture**: Not adapting sell strategy to market momentum

The goal is to implement an **adaptive profit requirement** that increases for consecutive sells during uptrends, allowing the strategy to "let winners run" while still taking profits systematically.

## Core Concept

**Dynamic Profit Requirement on Consecutive Sells**

When the price is rising and we execute consecutive sells (no buys in between), increase the profit requirement progressively by adding the current grid size. This creates a "trailing profit ladder" that captures more upside during strong trends.

### Key Conditions

The profit requirement increases **ONLY** when **BOTH** conditions are met:

1. **Consecutive sell**: The last action was a sell (no buy in between)
2. **Price going up**: Current price > last sell price

If either condition fails, reset to base profit requirement.

## Requirements

### Requirement 1

**User Story:** As a DCA trader, I want the system to use increasing profit margins for consecutive sell orders, so that I can optimize my profit-taking strategy with larger spacing as prices rise further from the lowest held price.

#### Acceptance Criteria

1. WHEN the system calculates the next sell price THEN it SHALL use the generate_sequence function to determine the profit margin based on consecutive sell count
2. WHEN a buy order is executed THEN the system SHALL reset the consecutive sell count to 0
3. WHEN the first sell order is placed THEN the consecutive sell count SHALL start at 0 and increment to 1 after execution
4. WHEN calculating profit margins THEN the system SHALL use decimal values (0.1 = 10%, 0.05 = 5%) consistently throughout all calculations

### Requirement 2

**User Story:** As a user, I want the Max Lots to Sell option to be automatically calculated and hidden from the UI, so that the system can dynamically determine the maximum number of lots to sell based on the profit margin interval and mathematical constraints.

#### Acceptance Criteria

1. WHEN the user configures backtest parameters THEN the Max Lots to Sell input field SHALL NOT be displayed in the UI
2. WHEN calculating Max Lots to Sell THEN the system SHALL use the formula: min(0.7 / profitMarginInterval - 1, 10)
3. WHEN profitMarginInterval is 10% (0.1) THEN Max Lots to Sell SHALL be calculated as min(0.7/0.1 - 1, 10) = min(6, 10) = 6
4. WHEN profitMarginInterval is 5% (0.05) THEN Max Lots to Sell SHALL be calculated as min(0.7/0.05 - 1, 10) = min(13, 10) = 10

### Requi

rement 3

**User Story:** As a system, I want to track lowest price held in current holdings and consecutive sell counts, so that I can calculate appropriate profit margins based on the current market position relative to the lowest held price.

#### Acceptance Criteria

1. WHEN the backtest starts THEN the system SHALL initialize lowest_price_held to null (no holdings initially)
2. WHEN a buy order is executed THEN the system SHALL update lowest_price_held to the minimum of current lowest_price_held and buy price
3. WHEN a sell order is executed THEN the system SHALL increment consecutive_sell_count_ith by 1
4. WHEN a buy order is executed THEN the system SHALL reset consecutive_sell_count_ith to 0
5. WHEN calculating the start parameter THEN the system SHALL use: (current_sell_price - lowest_price_held) / lowest_price_held

### Requirement 4

**User Story:** As a system, I want to calculate dynamic profit margins using the generate_sequence function, so that consecutive sell orders have progressively larger profit requirements from the lowest held price.

#### Acceptance Criteria

1. WHEN calculating the next sell profit margin THEN the system SHALL call generate_sequence(n, start, firstDelta, end=0.7, ith+1)
2. WHEN determining n THEN the system SHALL use: Max_Lots_to_Sell - consecutive_sell_count_ith
3. WHEN determining start THEN the system SHALL use: (current_sell_price - lowest_price_held) / lowest_price_held
4. WHEN determining firstDelta THEN the system SHALL use the configured profitMarginInterval option (e.g., 0.05 for 5%)
5. WHEN calculating next_consecutive_sell_price THEN the system SHALL use: lowest_price_held \* (1 + next_consecutive_sell_profit_margin)

### Requirement 5

**User Story:** As a developer, I want comprehensive logging of all intermediate values, so that I can debug and verify the consecutive-incremental sell profit margin calculations.

#### Acceptance Criteria

1. WHEN any profit margin calculation occurs THEN the system SHALL log lowest_price_held to console
2. WHEN consecutive sell count changes THEN the system SHALL log consecutive_sell_count_ith to console
3. WHEN start parameter is calculated THEN the system SHALL log the start value to console
4. WHEN generate_sequence is called THEN the system SHALL log n, start, firstDelta, and ith parameters to console
5. WHEN next_consecutive_sell_profit_margin is calculated THEN the system SHALL log the returned profit margin to console
6. WHEN next_consecutive_sell_price is calculated THEN the system SHALL log the calculated price to console

### Requirement 6

**User Story:** As a user, I want the system to integrate the Python generate_sequence function with the Node.js backend for sell calculations, so that the consecutive-incremental sell profit margin calculations are performed accurately.

#### Acceptance Criteria

1. WHEN the backend needs to calculate sell profit margins THEN it SHALL execute the Python generate_sequence function via subprocess
2. WHEN calling the Python function THEN the system SHALL pass all required parameters (n, start, firstDelta, end, ith)
3. WHEN the Python function returns results THEN the system SHALL parse the output and extract the profit margin value
4. WHEN Python execution fails THEN the system SHALL fall back to the original fixed profit requirement method
5. WHEN integrating with existing trailing stop sell logic THEN the system SHALL maintain all existing validation and safety checks

### Requirement 7

**User Story:** As a user, I want the consecutive-incremental sell profit margin feature to work seamlessly with the existing trailing stop sell system, so that the enhanced profit margin sizing doesn't interfere with the current trading logic.

#### Acceptance Criteria

1. WHEN a trailing stop sell order is triggered THEN the system SHALL use the consecutive-incremental profit margin for price calculation
2. WHEN validating sell orders THEN the system SHALL ensure the new price respects the calculated profit margin from the lowest held price
3. WHEN the trailing stop sell system activates THEN it SHALL use the dynamically calculated profit margin instead of the fixed profitRequirement
4. WHEN portfolio limits are checked THEN the system SHALL use the dynamically calculated Max_Lots_to_Sell value
5. WHEN profit requirement validation is applied THEN it SHALL work with the variable profit margins from consecutive sells

### Requirement 8

**User Story:** As a user, I want the frontend UI to be updated to reflect the new consecutive-incremental sell profit margin feature, so that I can configure and monitor the enhanced DCA selling strategy.

#### Acceptance Criteria

1. WHEN displaying backtest configuration THEN the Max Lots to Sell field SHALL be hidden from the user interface
2. WHEN showing backtest results THEN the system SHALL display the actual Max Lots to Sell value that was calculated and used
3. WHEN displaying transaction history THEN each sell transaction SHALL show the profit margin that was used for that specific sale
4. WHEN showing debug information THEN the system SHALL display consecutive sell counts and lowest price held tracking
5. WHEN parameter validation occurs THEN the system SHALL validate that profitMarginInterval is compatible with the consecutive-incremental system

### Requirement 9

**User Story:** As a system, I want to properly manage the lowest price held tracking when lots are sold, so that the reference point for profit margin calculations remains accurate.

#### Acceptance Criteria

1. WHEN all lots are sold THEN the system SHALL reset lowest_price_held to null
2. WHEN partial lots are sold THEN the system SHALL recalculate lowest_price_held from remaining lots
3. WHEN new lots are purchased after partial sales THEN the system SHALL update lowest_price_held to include the new purchase price
4. WHEN lots are sold in FIFO order THEN the system SHALL maintain accurate lowest_price_held based on remaining lots
5. WHEN no lots remain THEN consecutive_sell_count_ith SHALL be reset to 0
