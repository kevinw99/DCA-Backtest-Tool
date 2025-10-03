# Design Document

## Overview

The consecutive-incremental grid size feature enhances the DCA trading platform by implementing dynamic grid sizing for consecutive buy orders. Instead of using a fixed percentage spacing between purchases, the system will calculate progressively larger grid sizes using a mathematical sequence generator. This approach optimizes dollar cost averaging by increasing the spacing between purchases as prices decline further from all-time highs.

## Architecture

### Core Components

1. **Grid Size Calculator Service**: New service responsible for calculating dynamic grid sizes using the Python generate_sequence function
2. **All-Time High Tracker**: Component to track and update all-time high prices throughout the backtest
3. **Consecutive Buy Counter**: State management for tracking consecutive buy order counts
4. **Python Integration Layer**: Subprocess execution wrapper for the generate_sequence function
5. **Enhanced Trailing Stop Buy Logic**: Modified existing logic to use dynamic grid sizes

### Integration Points

- **DCA Backtest Service**: Core integration point where grid size calculations are performed
- **Frontend Parameter Form**: UI modifications to hide Max Lots and show calculated values
- **Transaction Logging**: Enhanced logging to capture grid size information
- **Validation Layer**: Updated validation to work with dynamic Max Lots calculations

## Components and Interfaces

### GridSizeCalculatorService

```javascript
class GridSizeCalculatorService {
  constructor() {
    this.pythonScriptPath = path.join(__dirname, '../../frontend/generate_sequence.py');
  }

  async calculateNextGridSize(params) {
    // params: { n, start, firstDelta, end, ith }
    // Returns: { gridSize, success, error }
  }

  calculateMaxLots(gridInterval) {
    // Returns: min(0.7 / gridInterval - 1, 10)
  }

  calculateStartParameter(allTimeHigh, currentPrice) {
    // Returns: (allTimeHigh - currentPrice) / allTimeHigh
  }
}
```

### AllTimeHighTracker

```javascript
class AllTimeHighTracker {
  constructor(initialPrice) {
    this.allTimeHigh = initialPrice;
  }

  updatePrice(currentPrice) {
    if (currentPrice > this.allTimeHigh) {
      this.allTimeHigh = currentPrice;
      return true; // Updated
    }
    return false; // No change
  }

  getCurrentHigh() {
    return this.allTimeHigh;
  }
}
```

### ConsecutiveBuyCounter

```javascript
class ConsecutiveBuyCounter {
  constructor() {
    this.count = 0;
  }

  incrementBuy() {
    this.count++;
    return this.count;
  }

  resetOnSell() {
    this.count = 0;
    return this.count;
  }

  getCurrentCount() {
    return this.count;
  }
}
```

### PythonIntegrationService

```javascript
class PythonIntegrationService {
  async executeGenerateSequence(n, start, firstDelta, end, ith) {
    // Execute Python script via subprocess
    // Parse output and return grid size
    // Handle errors and provide fallback
  }

  validatePythonEnvironment() {
    // Check if Python is available and script exists
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
  gridIntervalPercent: 0.10, // Used as firstDelta

  // Removed from UI but calculated internally
  maxLots: null, // Calculated as min(0.7 / gridIntervalPercent - 1, 10)

  // New internal state
  consecutiveIncrementalEnabled: true,

  // Existing trailing stop parameters
  profitRequirement: 0.05,
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
  type: "BUY",
  price: 150.00,
  shares: 66.67,
  amount: 10000,

  // New fields for consecutive-incremental tracking
  consecutiveBuyCount: 3,
  allTimeHighAtPurchase: 200.00,
  gridSizeUsed: 0.15, // 15% grid size for this purchase
  startParameter: 0.25, // (200 - 150) / 200 = 0.25
  calculatedFromSequence: true
}
```

### Grid Size Calculation State

```javascript
{
  allTimeHigh: 200.00,
  consecutiveBuyCount: 2,
  maxLotsCalculated: 6,
  lastGridSizeUsed: 0.12,
  sequenceParameters: {
    n: 4, // maxLots - consecutiveBuyCount
    start: 0.20,
    firstDelta: 0.10,
    end: 0.7,
    ith: 3
  }
}
```

## Error Handling

### Python Integration Errors

1. **Python Not Available**: Fall back to fixed grid interval method
2. **Script Execution Failure**: Log error and use original grid calculation
3. **Invalid Parameters**: Validate inputs before calling Python function
4. **Parsing Errors**: Handle malformed Python output gracefully

### Grid Size Calculation Errors

1. **Invalid Sequence Parameters**: Validate n >= 3, start >= 0, end <= 0.7
2. **Division by Zero**: Handle cases where allTimeHigh equals current price
3. **Negative Grid Sizes**: Ensure all calculated grid sizes are positive
4. **Excessive Grid Sizes**: Cap grid sizes at reasonable maximum values

### State Management Errors

1. **Counter Overflow**: Reset consecutive buy counter if it exceeds reasonable limits
2. **All-Time High Corruption**: Validate and recover from invalid all-time high values
3. **State Synchronization**: Ensure all components maintain consistent state

## Testing Strategy

### Unit Tests

1. **GridSizeCalculatorService Tests**:
   - Test calculateMaxLots with various grid intervals
   - Test calculateStartParameter with different price scenarios
   - Test Python integration with mock subprocess calls

2. **AllTimeHighTracker Tests**:
   - Test initialization with different starting prices
   - Test price updates with increasing and decreasing prices
   - Test edge cases with equal prices

3. **ConsecutiveBuyCounter Tests**:
   - Test increment and reset functionality
   - Test counter persistence across multiple operations
   - Test boundary conditions

### Integration Tests

1. **End-to-End Grid Size Calculation**:
   - Test complete flow from price data to grid size calculation
   - Verify Python function integration works correctly
   - Test fallback behavior when Python fails

2. **Backtest Integration**:
   - Test that consecutive-incremental grid sizes work with existing trailing stop logic
   - Verify transaction logging includes new grid size information
   - Test that Max Lots calculation affects portfolio limits correctly

3. **UI Integration**:
   - Test that Max Lots field is hidden in configuration form
   - Verify that calculated Max Lots value is displayed in results
   - Test that transaction history shows grid size information

### Performance Tests

1. **Python Subprocess Performance**:
   - Measure execution time for generate_sequence calls
   - Test performance with large numbers of consecutive calculations
   - Verify memory usage remains reasonable

2. **Backtest Performance Impact**:
   - Compare backtest execution time with and without consecutive-incremental feature
   - Test performance with maximum consecutive buy scenarios
   - Verify no significant performance degradation

### Edge Case Tests

1. **Extreme Market Conditions**:
   - Test with continuously declining prices (many consecutive buys)
   - Test with volatile markets (frequent buy/sell alternation)
   - Test with flat markets (no all-time high updates)

2. **Parameter Boundary Tests**:
   - Test with minimum grid interval (5%)
   - Test with maximum grid interval (20%)
   - Test with edge case Max Lots calculations

3. **Error Recovery Tests**:
   - Test behavior when Python script is missing
   - Test recovery from corrupted state
   - Test graceful degradation scenarios

## Implementation Phases

### Phase 1: Core Infrastructure

- Implement GridSizeCalculatorService
- Create AllTimeHighTracker and ConsecutiveBuyCounter
- Set up Python integration layer
- Add comprehensive logging

### Phase 2: Backtest Integration

- Modify DCA backtest service to use dynamic grid sizes
- Update trailing stop buy logic
- Implement Max Lots auto-calculation
- Add transaction record enhancements

### Phase 3: UI Updates

- Hide Max Lots input field
- Add calculated Max Lots display
- Enhance transaction history with grid size information
- Add debug information display

### Phase 4: Testing and Validation

- Implement comprehensive test suite
- Perform end-to-end validation
- Optimize performance
- Add error handling and recovery mechanisms

This design ensures that the consecutive-incremental grid size feature integrates seamlessly with the existing DCA trading platform while providing enhanced functionality and maintaining system reliability.
