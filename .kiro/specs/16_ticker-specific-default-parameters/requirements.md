# Ticker-Specific Default Parameters - Requirements

## Overview

Implement ticker-specific default parameters to allow each stock symbol to have its own optimized default configuration based on historical performance and volatility characteristics.

## Current State

- Global default parameters are used for all tickers
- All stocks use the same initial parameter values regardless of their volatility or price characteristics
- Users must manually adjust parameters for each ticker every time they run a backtest
- No persistence of ticker-specific optimized parameters

## Requirements

### FR1: Ticker-Specific Parameter Storage

- Store ticker-specific default parameters in `config/backtestDefaults.json`
- Structure: Top-level object with ticker symbols as keys, parameter objects as values
- Each ticker can have its own complete set of DCA parameters
- File must be human-readable and manually editable JSON format
- Capture ALL backtest parameters including:
  - Basic parameters: lotSizeUsd, maxLots, maxLotsToSell
  - Grid parameters: gridIntervalPercent, profitRequirement
  - Trailing buy parameters: trailingBuyActivationPercent, trailingBuyReboundPercent
  - Trailing sell parameters: trailingSellActivationPercent, trailingSellPullbackPercent
  - Short parameters: maxShorts, maxShortsToCovers, trailingShortActivationPercent, trailingShortPullbackPercent
  - Cover parameters: trailingCoverActivationPercent, trailingCoverReboundPercent
  - Stop loss parameters: hardStopLossPercent, portfolioStopLossPercent, cascadeStopLossPercent
  - Beta parameters: beta, enableBetaScaling, isManualBetaOverride, betaFactor, coefficient
  - Strategy parameters: strategyMode
  - Feature flags: enableConsecutiveIncremental, enableDynamicGrid, enableConsecutiveIncrementalSellProfit, enableScenarioDetection, enableAdaptiveStrategy
  - Other settings: normalizeToReference, dynamicGridMultiplier, adaptationCheckIntervalDays, adaptationRollingWindowDays, minDataDaysBeforeAdaptation, confidenceThreshold
- Exclude non-ticker-specific parameters: symbol, startDate, endDate, availableSymbols, mode, source

### FR2: Save as Default Button

- Add "Save as Default" button to parameter page in individual backtest mode
- Button should be clearly visible and distinct from "Reset to Default" button
- When clicked, save current parameter values as defaults for the current ticker
- If ticker entry doesn't exist in backtestDefaults.json, create new entry
- If ticker entry exists, update with current parameter values
- Show user feedback (success/error message) after save operation
- Only available in single backtest mode (not batch mode)

### FR3: Reset to Default Behavior

- Modify existing "Reset to Default" button behavior
- First check for ticker-specific defaults in backtestDefaults.json
- If ticker-specific defaults exist, use those
- If no ticker-specific defaults, fall back to global defaults in code
- Maintain backward compatibility with existing functionality

### FR4: Global Defaults Fallback

- Keep global default parameters in application code as fallback
- Use global defaults when:
  - No ticker-specific defaults exist
  - backtestDefaults.json file is missing or corrupt
  - Ticker entry is not found in the file
- Ensure seamless fallback without errors

### FR5: Backend API Support

- Create/update API endpoint to save ticker-specific defaults
- Endpoint: POST `/api/backtest/defaults/:symbol`
- Accept full parameter object in request body
- Validate parameter values before saving
- Return success/error response
- Handle file I/O errors gracefully

### FR6: Frontend Integration

- Update App.js to fetch ticker-specific defaults when symbol changes
- Integrate "Save as Default" button into existing parameter UI
- Update parameter initialization logic to check ticker-specific defaults first
- Maintain existing UI layout and styling consistency

## Non-Functional Requirements

### NFR1: Data Integrity

- Validate all parameter values before saving
- Ensure backtestDefaults.json remains valid JSON at all times
- Handle concurrent writes safely (if applicable)

### NFR2: User Experience

- Provide clear visual feedback for save operations
- Display appropriate error messages for failures
- Maintain fast response times (<500ms for save operations)

### NFR3: Maintainability

- Code should be well-documented
- Follow existing code style and patterns
- Minimize changes to existing functionality

### NFR4: Backward Compatibility

- Existing backtests should continue working
- Global defaults should remain accessible
- No breaking changes to API contracts

## Success Criteria

1. Users can save current parameters as ticker-specific defaults
2. Ticker-specific defaults persist across sessions
3. Reset to Default uses ticker-specific defaults when available
4. Manual editing of backtestDefaults.json works correctly
5. System falls back to global defaults when ticker-specific defaults unavailable
6. All existing functionality continues to work

## Out of Scope

- Batch mode "Save as Default" functionality
- Import/export of ticker-specific defaults
- UI for managing all ticker defaults in one view
- Automatic optimization of ticker-specific defaults
- Version control or history of parameter changes
