# Design Document

## Overview

The consecutive-incremental sell grid size feature enhances the DCA trading platform by implementing dynamic profit margin sizing for consecutive sell orders. Instead of using a fixed profit requirement percentage for all sales, the system will calculate progressively larger profit margins using a mathematical sequence generator. This approach optimizes profit-taking by increasing the profit requirements as prices rise further from the lowest price held in current holdings.

## Architecture

### Core Components

1. **Sell Profit Margin Calculator Service**: New service responsible for calculating dynamic profit margins using the Python generate_sequence function
2. **Lowest Price Held Tracker**: Component to track and update the lowest price among current holdings
3. **Consecutive Sell Counter**: State management for tracking consecutive sell order counts
4. **Python Integration Layer**: Subprocess execution wrapper for the generate_sequence function (shared with buy system)
5. **Enhanced Trailing Stop Sell Logic**: Modified existing logic to use dynamic profit margins

### Integration Points

- **DCA Backtest Service**: Core integration point where profit margin calculations are performed
- **Frontend Parameter Form**: UI modifications to hide Max Lots to Sell and show calculated values
- **Transaction Logging**: Enhanced logging to capture profit margin information
- **Validation Layer**: Updated validation to work with dynamic Max Lots to Sell calculations

## Components and Interfaces

### SellProfitMarginCalculatorService

```javascript
class SellProfitMarginCalculatorService {
  constructor() {
    this.pythonScriptPath = path.join(__dirname, '../../frontend/generate_sequence.py');
  }

  async calculateNextProfitMargin(params) {
    // params: { n, start, firstDelta, end, ith }
    // Returns: { profitMargin, success, error }
  }

  calculateMaxLotsToSell(profitMarginInterval) {
    // Returns: min(0.7 / profitMarginInterval - 1, 10)
  }

  calculateStartParameter(lowestPriceHeld, currentPrice) {
    // Returns: (currentPrice - lowestPriceHeld) / lowestPriceHeld
  }
}
```

### LowestPriceHeldTracker

```javascript
class LowestPriceHeldTracker {
  constructor() {
    this.lowestPriceHeld = null;
  }

  updateOnBuy(buyPrice) {
    if (this.lowestPriceHeld === null || buyPrice < this.lowestPriceHeld) {
      this.lowestPriceHeld = buyPrice;
      return true; // Updated
    }
    return false; // No change
  }

  updateOnSell(remainingLots) {
    if (remainingLots.length === 0) {
      this.lowestPriceHeld = null;
    } else {
      this.lowestPriceHeld = Math.min(...remainingLots.map(lot => lot.price));
    }
    return this.lowestPriceHeld;
  }

  getCurrentLowest() {
    return this.lowestPriceHeld;
  }
}
```

### ConsecutiveSellCounter

```javascript
class ConsecutiveSellCounter {
  constructor() {
    this.count = 0;
  }

  incrementSell() {
    this.count++;
    return this.count;
  }

  resetOnBuy() {
    this.count = 0;
    return this.count;
  }

  getCurrentCount() {
    return this.count;
  }
}
```

## Data Models

### Enhanced Backtest Configuration

```javascript
{
  // Existing parameters
  symbol: "TSLA",
  startDate: "2021-11-01",
  endDate: "2023-11-01",
  lotSizeUsd: 10000,
  profitRequirement: 0.05, // Used as profitMarginInterval for firstDelta

  // Removed from UI but calculated internally
  maxLotsToSell: null, // Calculated as min(0.7 / profitRequirement - 1, 10)

  // New internal state
  consecutiveIncrementalSellEnabled: true,

  // Existing trailing stop parameters
  gridIntervalPercent: 0.10,
  trailingBuyActivationPercent: 0.10,
  trailingBuyReboundPercent: 0.05,
  trailingSellActivationPercent: 0.20,
  trailingSellPullbackPercent: 0.10
}
```

### Enhanced Transaction Record

```javascript
{
  date: "2023-01-15",
  type: "SELL",
  price: 200.00,
  shares: 50.00,
  amount: 10000,

  // New fields for consecutive-incremental sell tracking
  consecutiveSellCount: 2,
  lowestPriceHeldAtSale: 120.00,
  profitMarginUsed: 0.25, // 25% profit margin for this sale
  startParameter: 0.67, // (200 - 120) / 120 = 0.67
  calculatedFromSequence: true
}
```

### Sell Profit Margin Calculation State

```javascript
{
  lowestPriceHeld: 120.00,
  consecutiveSellCount: 1,
  maxLotsToSellCalculated: 6,
  lastProfitMarginUsed: 0.15,
  sequenceParameters: {
    n: 5, // maxLotsToSell - consecutiveSellCount
    start: 0.50,
    firstDelta: 0.05,
    end: 0.7,
    ith: 2
  }
}
```

## Error Handling

### Python Integration Errors

1. **Python Not Available**: Fall back to fixed profit requirement method
2. **Script Execution Failure**: Log error and use original profit calculation
3. **Invalid Parameters**: Validate inputs before calling Python function
4. **Parsing Errors**: Handle malformed Python output gracefully

### Profit Margin Calculation Errors

1. **Invalid Sequence Parameters**: Validate n >= 3, start >= 0, end <= 0.7
2. **Division by Zero**: Handle cases where lowestPriceHeld is zero or null
3. **Negative Profit Margins**: Ensure all calculated profit margins are positive
4. **Excessive Profit Margins**: Cap profit margins at reasonable maximum values

### State Management Errors

1. **Counter Overflow**: Reset consecutive sell counter if it exceeds reasonable limits
2. **Lowest Price Corruption**: Validate and recover from invalid lowest price values
3. **State Synchronization**: Ensure all components maintain consistent state

## Testing Strategy

### Unit Tests

1. **SellProfitMarginCalculatorService Tests**:
   - Test calculateMaxLotsToSell with various profit margin intervals
   - Test calculateStartParameter with different price scenarios
   - Test Python integration with mock subprocess calls

2. **LowestPriceHeldTracker Tests**:
   - Test initialization with no holdings
   - Test price updates with buy and sell operations
   - Test edge cases with single lot scenarios

3. **ConsecutiveSellCounter Tests**:
   - Test increment and reset functionality
   - Test counter persistence across multiple operations
   - Test boundary conditions

### Integration Tests

1. **End-to-End Profit Margin Calculation**:
   - Test complete flow from price data to profit margin calculation
   - Verify Python function integration works correctly
   - Test fallback behavior when Python fails

2. **Backtest Integration**:
   - Test that consecutive-incremental profit margins work with existing trailing stop logic
   - Verify transaction logging includes new profit margin information
   - Test that Max Lots to Sell calculation affects portfolio limits correctly

3. **UI Integration**:
   - Test that Max Lots to Sell field is hidden in configuration form
   - Verify that calculated Max Lots to Sell value is displayed in results
   - Test that transaction history shows profit margin information

### Performance Tests

1. **Python Subprocess Performance**:
   - Measure execution time for generate_sequence calls
   - Test performance with large numbers of consecutive calculations
   - Verify memory usage remains reasonable

2. **Backtest Performance Impact**:
   - Compare backtest execution time with and without consecutive-incremental feature
   - Test performance with maximum consecutive sell scenarios
   - Verify no significant performance degradation

### Edge Case Tests

1. **Extreme Market Conditions**:
   - Test with continuously rising prices (many consecutive sells)
   - Test with volatile markets (frequent buy/sell alternation)
   - Test with declining markets (no sell opportunities)

2. **Parameter Boundary Tests**:
   - Test with minimum profit margin interval (5%)
   - Test with maximum profit margin interval (20%)
   - Test with edge case Max Lots to Sell calculations

3. **Error Recovery Tests**:
   - Test behavior when Python script is missing
   - Test recovery from corrupted state
   - Test graceful degradation scenarios

## Implementation Phases

### Phase 1: Core Infrastructure

- Implement SellProfitMarginCalculatorService
- Create LowestPriceHeldTracker and ConsecutiveSellCounter
- Enhance existing Python integration layer for sell calculations
- Add comprehensive logging for sell operations

### Phase 2: Backtest Integration

- Modify DCA backtest service to use dynamic profit margins
- Update trailing stop sell logic
- Implement Max Lots to Sell auto-calculation
- Add transaction record enhancements for sell operations

### Phase 3: UI Updates

- Hide Max Lots to Sell input field
- Add calculated Max Lots to Sell display
- Enhance transaction history with profit margin information
- Add debug information display for sell operations

### Phase 4: Testing and Validation

- Implement comprehensive test suite
- Perform end-to-end validation
- Optimize performance
- Add error handling and recovery mechanisms

This design ensures that the consecutive-incremental sell profit margin feature integrates seamlessly with the existing DCA trading platform while providing enhanced selling functionality and maintaining system reliability.
