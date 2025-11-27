# Requirements: DCA Signal Engine Refactoring

## Problem Statement

Currently, the portfolio backtest (`portfolioBacktestService.js`) and individual DCA backtest (`dcaBacktestService.js`) have completely separate implementations of the core trading logic:

- **Individual DCA**: 2,667 lines with 30+ advanced features (adaptive strategies, trailing stops, scenario detection, etc.)
- **Portfolio DCA**: 617 lines with simplified logic optimized for multi-stock + capital constraints

This duplication creates several issues:

1. **Code duplication**: Core trading logic (buy/sell signals, grid calculations, lot selection) is duplicated
2. **Maintenance burden**: Bug fixes or improvements must be applied to both implementations
3. **Feature disparity**: Portfolio backtest lacks advanced features from individual DCA (trailing stops work differently, no adaptive strategies, etc.)
4. **Testing complexity**: Same logic must be tested twice in different contexts

## Current Architecture Issues

### Individual DCA Backtest
- Assumes **unlimited capital** - executes all buy signals immediately
- Processes entire backtest in one run (not day-by-day)
- Complex state management with adaptive strategies
- 30+ advanced features including:
  - Adaptive trailing stops
  - Dynamic profile switching
  - Scenario detection (accumulation, breakout, rally, etc.)
  - Real-time strategy adaptation
  - Position-based behavior

### Portfolio Backtest
- Has **capital constraints** - must check available capital before buying
- Processes day-by-day with cross-stock capital dependencies
- Simplified logic without advanced features
- Execution order matters: SELL first (return capital), then BUY (use available capital)
- Tracks rejected orders due to insufficient capital

### Why Portfolio Can't Call Individual DCA

**5 Fundamental Incompatibilities:**

1. **State Management Mismatch**: Individual DCA manages single stock state; portfolio needs independent states for multiple stocks
2. **Capital Model Incompatibility**: Individual assumes unlimited capital; portfolio has shared capital pool
3. **Execution Order Requirements**: Portfolio needs to coordinate sells/buys across stocks for capital flow
4. **Feature Complexity**: Individual has 2,667 lines; portfolio optimized at 617 lines
5. **Return Structure**: Individual returns complete backtest; portfolio needs incremental day-by-day execution

## Proposed Solution: DCA Signal Engine

Extract core trading logic into a **shared signal engine** that both implementations can use, while maintaining their specific orchestration patterns.

### Core Concept: Pure Functions

Create stateless, pure functions that:
- Take current state + market data as input
- Return signals/decisions/calculations as output
- Have NO side effects
- Are easily testable in isolation

### What Gets Shared (DCA Signal Engine)

**1. Signal Evaluation**
- `evaluateBuySignal(state, params, currentPrice, indicators)` → `{ triggered, reason, gridLevel, ... }`
- `evaluateSellSignal(state, params, currentPrice, indicators)` → `{ triggered, reason, lots, ... }`
- `evaluateTrailingStop(state, params, currentPrice)` → `{ triggered, stopPrice, lots, ... }`

**2. Lot Selection**
- `selectLotsToSell(lots, strategy)` → `selectedLots[]`
- `calculateLotProfitPercent(lot, currentPrice)` → `profitPercent`
- `filterProfitableLots(lots, currentPrice, minProfit)` → `profitableLots[]`

**3. Grid Calculations**
- `calculateBuyGridLevel(averageCost, gridInterval, consecutiveCount)` → `gridPrice`
- `calculateSellGridLevel(lotCost, profitRequirement, consecutiveCount)` → `targetPrice`
- `determineGridPosition(currentPrice, gridLevels)` → `position`

**4. State Transformations**
- `applyBuyTransaction(state, transaction)` → `newState`
- `applySellTransaction(state, transaction)` → `newState`
- `updatePeakTracking(state, currentPrice)` → `newState`

**5. Indicator Calculations** (already partially extracted)
- SMA, EMA, RSI, MACD, Bollinger Bands, ATR

### What Stays Separate

**Individual DCA Orchestration:**
- Main simulation loop
- Adaptive strategy management
- Scenario detection
- State persistence
- Full backtest return structure

**Portfolio Orchestration:**
- Multi-stock state management
- Capital pool management
- Cross-stock execution coordination
- Order rejection tracking
- Day-by-day incremental processing

## Goals

### Primary Goals

1. **Eliminate code duplication**: Share core trading logic between implementations
2. **Enable feature parity**: Portfolio can use advanced features from individual DCA
3. **Improve maintainability**: Fix bugs once, benefits both implementations
4. **Increase testability**: Pure functions are easier to test in isolation

### Secondary Goals

1. **Preserve performance**: No regression in backtest execution time
2. **Maintain backward compatibility**: All existing tests must pass
3. **Keep clean separation**: Clear boundaries between shared engine and orchestration logic
4. **Enable future features**: Make it easy to add new strategies/indicators

## Success Criteria

1. ✅ Both individual and portfolio backtests use the same signal engine
2. ✅ All existing tests pass without modification
3. ✅ No performance regression (< 5% slowdown acceptable)
4. ✅ Portfolio backtest can use trailing stops with same logic as individual DCA
5. ✅ New signal logic can be added once and used by both implementations
6. ✅ Code coverage maintained or improved
7. ✅ Documentation updated to reflect new architecture

## Out of Scope

- **Frontend changes**: This is purely backend refactoring
- **API changes**: Endpoints and response formats remain unchanged
- **Database changes**: No data model modifications
- **New features**: Focus is on refactoring existing functionality
- **Performance optimization**: Not the primary goal (but shouldn't regress)

## Risks and Mitigation

### Risk 1: Breaking Existing Functionality
- **Mitigation**: Comprehensive test suite before refactoring
- **Mitigation**: Incremental approach - refactor one component at a time
- **Mitigation**: Keep old code alongside new code temporarily

### Risk 2: Performance Regression
- **Mitigation**: Benchmark before/after
- **Mitigation**: Profile hot paths
- **Mitigation**: Optimize pure functions if needed

### Risk 3: Increased Complexity
- **Mitigation**: Clear documentation
- **Mitigation**: Well-defined interfaces
- **Mitigation**: Keep engine functions simple and focused

### Risk 4: Testing Effort
- **Mitigation**: Leverage existing test infrastructure
- **Mitigation**: Pure functions are easier to test
- **Mitigation**: Can test engine independently from orchestration

## Dependencies

- Existing codebase must be in stable state (✅ committed baseline)
- Backend server must be testable via curl commands
- No external API changes required
- No database migrations needed

## Assumptions

1. Current individual DCA logic is correct and desired behavior
2. Portfolio backtest should match individual DCA logic where applicable
3. Pure functional approach is acceptable (no external state dependencies)
4. Performance is acceptable with function call overhead
5. Test coverage is sufficient to catch regressions

## Constraints

1. **Backward compatibility**: All existing endpoints must work unchanged
2. **No API changes**: Response formats must remain identical
3. **Time limit**: Complete refactoring in reasonable timeframe
4. **Code quality**: Maintain or improve code quality metrics
5. **Documentation**: Must document new architecture clearly
