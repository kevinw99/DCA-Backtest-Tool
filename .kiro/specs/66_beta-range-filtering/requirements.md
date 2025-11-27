# Requirements: Beta Range Filtering for Portfolio Backtests

## Problem Statement

Currently, portfolio backtests (e.g., NASDAQ100, SP500) include all stocks in the portfolio without the ability to filter by beta. Users want to focus on specific risk profiles by filtering stocks based on their beta values (volatility relative to the market).

For example, a user might want to:
- Only backtest high-beta stocks (beta > 1.5) for aggressive strategies
- Filter to moderate-beta stocks (1.0 <= beta <= 1.5) for balanced strategies
- Exclude high-volatility stocks (beta <= 1.0) for conservative strategies

## Current Limitations

1. No way to filter portfolio constituents by beta
2. All stocks in a portfolio list (NASDAQ100, SP500) are included in backtests
3. Users cannot test strategies on specific beta ranges
4. No UI controls for beta filtering in any backtest mode

## Proposed Solution

Add beta range filtering capability to all portfolio backtest modes (single portfolio, batch) with:
- **minBeta**: Minimum beta threshold (inclusive)
- **maxBeta**: Maximum beta threshold (inclusive)
- Default: No filtering (all stocks included)
- Applies to all portfolio types (NASDAQ100, SP500, etc.)

## Functional Requirements

### FR-1: Beta Range Parameters

- **FR-1.1**: Support `minBeta` parameter (optional, number >= 0)
- **FR-1.2**: Support `maxBeta` parameter (optional, number >= 0)
- **FR-1.3**: Both parameters are optional and independent
- **FR-1.4**: If only `minBeta` set: include stocks with beta >= minBeta
- **FR-1.5**: If only `maxBeta` set: include stocks with beta <= maxBeta
- **FR-1.6**: If both set: include stocks with minBeta <= beta <= maxBeta
- **FR-1.7**: If neither set: include all stocks (current behavior)

### FR-2: Beta Data Source

- **FR-2.1**: Use existing beta values from stocks database
- **FR-2.2**: Handle missing beta values gracefully (exclude or include based on strategy)
- **FR-2.3**: Validate beta data exists for portfolio constituents

### FR-3: Multi-Mode Support

- **FR-3.1**: Single portfolio backtest mode support
- **FR-3.2**: Batch portfolio backtest mode support
- **FR-3.3**: Consistent behavior across all modes

### FR-4: Frontend UI

- **FR-4.1**: Add beta filter controls to portfolio backtest page
- **FR-4.2**: Add beta filter controls to batch backtest mode
- **FR-4.3**: Display filtered stock count before running backtest
- **FR-4.4**: Show which stocks were filtered in/out

### FR-5: Results Display

- **FR-5.1**: Show beta range filter applied in results
- **FR-5.2**: Display number of stocks filtered
- **FR-5.3**: List stocks included in filtered portfolio

## Non-Functional Requirements

### NFR-1: Performance

- Beta filtering should not significantly impact backtest execution time
- Filtering happens before backtest execution (not during)

### NFR-2: Data Quality

- Handle missing beta values without crashing
- Log warnings for stocks without beta data

### NFR-3: Validation

- Validate minBeta <= maxBeta if both provided
- Validate beta values are non-negative
- Provide clear error messages for invalid inputs

### NFR-4: Backward Compatibility

- Existing portfolio backtests continue to work without beta filters
- Default behavior unchanged when no beta parameters provided

## Success Criteria

1. ✅ User can filter NASDAQ100 portfolio to beta > 1.5
2. ✅ User can filter SP500 portfolio to 1.0 <= beta <= 2.0
3. ✅ Batch mode supports beta filtering across multiple runs
4. ✅ UI shows filtered stock count before execution
5. ✅ Results display which stocks were included/excluded
6. ✅ All existing portfolio backtests continue to work unchanged

## Out of Scope

- Individual stock backtests (single stock mode) - beta filtering not applicable
- Dynamic beta calculation - use existing pre-calculated values
- Beta updates or recalculation - use current database values
- Multi-factor filtering (combining beta with other metrics) - future enhancement
- Custom beta calculation methods - use standard market beta

## Dependencies

- Existing stocks database with beta values
- Current portfolio backtest infrastructure
- Frontend portfolio backtest components

## Risk Assessment

### Low Risk
- Using existing beta data from database
- Adding optional parameters (backward compatible)

### Medium Risk
- Missing beta values for some stocks
- UI complexity with multiple filter options

### Mitigation
- Handle missing beta gracefully (default exclusion with warning)
- Start with simple UI, iterate based on feedback
- Comprehensive testing with various beta ranges
