# Spec 39: Shared Backtest Configuration Components

## Overview

Refactor the backtest configuration UI to extract common components that can be shared between Single Stock Backtest Form and Portfolio Backtest Form. This eliminates code duplication and ensures both forms have identical parameter options.

## Current Problem

**Code Duplication:**
- DCABacktestForm.js: 3,180 lines with comprehensive parameter controls
- PortfolioBacktestForm.js: 452 lines with only ~20% of the parameters
- Massive code duplication for common parameters (Grid Interval, Profit Requirement, Trailing Stops, etc.)
- Any bug fix or feature enhancement requires updating both forms

**Feature Inconsistency:**
Portfolio form is missing 80% of the parameters available in single stock form:
- ❌ Beta Scaling (15+ components)
- ❌ Dynamic Grid options (3 out of 5 features)
- ❌ Adaptive Strategy controls (all 3 toggles)
- ❌ Trailing Stop Order Type selection
- ❌ Short Strategy parameters
- ❌ Average-Based Features
- ❌ Dynamic Profile Switching
- ❌ Ticker-Specific Defaults integration

**User Requirement:**
> "Portfolio backtest config page should be similar to single stock backtest config page, with all parameters listed, including beta scaling etc., the only difference is stocks list instead of single stock symbol."

## Goals

1. **Extract Reusable Components:** Create shared UI components for all parameter sections
2. **Unify Parameter Options:** Both forms should have identical parameter controls
3. **Eliminate Duplication:** Single source of truth for each parameter section
4. **Maintain Flexibility:** Allow form-specific customizations where needed
5. **Preserve Functionality:** No regression in existing features

## User Stories

### Story 1: Portfolio Manager Wants Beta Scaling
**As a** portfolio manager
**I want** to apply beta-adjusted parameters to my portfolio backtest
**So that** I can scale grid intervals and profit requirements based on each stock's volatility

**Acceptance Criteria:**
- Portfolio form has Beta Controls section identical to single stock form
- Can enable/disable beta scaling for entire portfolio
- Beta factor applied to all stocks in portfolio (using stock-specific beta from backtestDefaults.json)
- Beta-adjusted parameters display β indicator

### Story 2: Developer Fixes Bug in Trailing Stop Controls
**As a** developer
**I want** to fix a trailing stop bug in one place
**So that** both single and portfolio forms benefit from the fix automatically

**Acceptance Criteria:**
- Trailing stop controls exist as shared component
- Bug fix updates both forms simultaneously
- No code duplication between forms

### Story 3: User Wants Advanced Features in Portfolio Mode
**As a** trader
**I want** access to all advanced features (Dynamic Grid, Adaptive Strategy, etc.) in portfolio backtest
**So that** I can test sophisticated strategies across multiple stocks

**Acceptance Criteria:**
- Portfolio form has all sections from single stock form
- Dynamic Grid, Adaptive Strategy, Average-Based features all available
- Behavior identical to single stock mode

### Story 4: User Wants Stock-Specific Customization
**As a** trader
**I want** to override portfolio defaults with stock-specific parameters from backtestDefaults.json
**So that** high-beta stocks get wider grids automatically

**Acceptance Criteria:**
- Portfolio form supports stock-specific parameter overrides
- Integration with backtestDefaults.json (Spec 36)
- Visual indicator showing which stocks have custom parameters

## Requirements

### Functional Requirements

#### FR1: Shared Component Library
Create reusable React components for all parameter sections:
- BasicParametersSection
- LongStrategySection
- ShortStrategySection
- BetaControlsSection
- DynamicFeaturesSection
- AdaptiveStrategySection
- TrailingStopSection
- ValidationSection

#### FR2: Parameter Parity
Portfolio form must have ALL parameters from single stock form:
- Basic: lotSizeUsd, maxLots, maxLotsToSell, strategyMode
- Long Strategy: gridIntervalPercent, profitRequirement, trailing buy/sell params
- Short Strategy: maxShorts, maxShortsToCovers, stop loss types
- Beta: enableBetaScaling, beta, betaFactor, coefficient, isManualBetaOverride
- Dynamic Features: dynamic grid, consecutive incremental, scenario detection, normalize to reference
- Adaptive Strategy: adaptive trailing buy/sell, scenario detection
- Average-Based: average grid spacing, average sell logic
- Dynamic Profile: enable dynamic profile switching

#### FR3: Form-Specific Rendering
Each form specifies which sections to render and how:
- Single Stock Form: Symbol dropdown + all parameter sections + batch mode
- Portfolio Form: Stock multi-selector + all parameter sections + portfolio-specific (totalCapital, maxLotsPerStock)

#### FR4: Stock-Specific Parameter Integration
Portfolio form loads stock-specific overrides from backtestDefaults.json:
- Global defaults applied to all stocks
- Stock-specific overrides merge with global defaults
- Visual indicator shows which stocks have custom parameters
- User can view/edit stock-specific parameters

#### FR5: Validation Rules
Shared validation logic for common parameters:
- Grid interval: 0-100%
- Profit requirement: 0-100%
- Trailing activation/rebound: 0-100%
- Date range: start < end
- Beta-adjusted parameter warnings

### Non-Functional Requirements

#### NFR1: Zero Regression
- All existing single stock form functionality preserved
- All existing portfolio form functionality preserved
- No breaking changes to API contracts

#### NFR2: Code Reduction
- Target: Reduce total lines of code by 30-40%
- Eliminate 1000+ lines of duplicated code
- Single source of truth for each parameter section

#### NFR3: Maintainability
- Component API documented with JSDoc
- Props clearly defined with PropTypes
- Example usage for each shared component

#### NFR4: Performance
- No performance degradation
- Component re-render optimization with React.memo
- Lazy loading for large sections

## Dependencies

### Existing Specs
- **Spec 36:** Portfolio Stock-Specific Parameters (backtestDefaults.json structure)
- **Spec 25/27:** Adaptive Strategy Controls
- **Spec 23:** Average-Based Features
- **Spec 24:** Dynamic Profile Switching

### External Dependencies
- React 18+
- lucide-react (icons)
- localStorage API

## Out of Scope

1. **Backend Changes:** This spec focuses on frontend refactoring only
2. **New Features:** No new parameters added, only refactoring existing ones
3. **Batch Mode:** Batch testing UI remains in single stock form only (may be addressed in future spec)
4. **UI Design Changes:** Maintain existing look and feel

## Success Metrics

1. **Code Reduction:** 30-40% reduction in total form code (target: ~2000 lines saved)
2. **Feature Parity:** Portfolio form has 100% of single stock parameters (up from 20%)
3. **Zero Bugs:** No regression in existing functionality
4. **Maintainability:** Future parameter additions require changes in one place only

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Breaking existing forms | High | Medium | Incremental refactoring, thorough testing |
| State management complexity | Medium | Medium | Clear component boundaries, prop drilling vs context |
| Beta scaling bugs | Medium | Low | Reuse existing tested logic from DCABacktestForm |
| Parameter override conflicts | Medium | Medium | Clear precedence rules: stock-specific > form-level > global |

## Timeline Estimate

- Component extraction: 2-3 days
- Portfolio form enhancement: 2-3 days
- Integration with backtestDefaults.json: 1 day
- Testing and validation: 1-2 days
- **Total:** 6-9 days
