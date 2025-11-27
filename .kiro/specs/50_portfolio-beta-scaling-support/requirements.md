# Spec 50: Portfolio Beta Scaling Support

## Problem Statement

Beta scaling is currently **non-functional in portfolio config mode** due to a configuration mismatch between `portfolioConfigLoader.js` and `portfolioBacktestService.js`.

### Current Behavior

1. **Config exists but is ignored**: `nasdaq100.json` has beta configuration in `globalDefaults.beta`:
   ```json
   "beta": {
     "enableBetaScaling": true,
     "beta": 1,
     "betaFactor": 1,
     "coefficient": 0.1,
     "isManualBetaOverride": false
   }
   ```

2. **Code exists but never executes**: `portfolioBacktestService.js:287-329` has beta scaling implementation:
   ```javascript
   if (config.betaScaling?.enabled) {
     // Beta scaling code (never reached)
   }
   ```

3. **Config loader doesn't pass betaScaling object**: `portfolioConfigLoader.js:81-123` only returns:
   - totalCapital
   - startDate/endDate
   - lotSizeUsd
   - maxLotsPerStock
   - defaultParams (beta params flattened here, but not as a separate object)
   - stocks
   - indexTracking
   - capitalOptimization

4. **Result**: Beta scaling condition is always `undefined?.enabled = undefined`, so the code never runs.

### Evidence from Investigation

**Test URL**: `http://localhost:3000/portfolio-backtest?config=nasdaq100`

**Portfolio Config** (nasdaq100.json):
- Total stocks: 96 (out of 100)
- Beta settings: `enableBetaScaling: true`, `coefficient: 0.1`
- All stocks use global defaults (no overrides)

**Database Beta Coverage**:
- Total beta values in database: 15 stocks
- Nasdaq100 stocks with beta: Only 7 (7.3% coverage)
  - AMZN: 1.281
  - APP: 2.527
  - GOOG: 1.0
  - META: 1.203
  - MSFT: 1.023
  - NVDA: 2.123
  - TSLA: 1.0

**Missing beta data for 89 stocks** including major components like AAPL, ADBE, CSCO, etc.

## Requirements

### Functional Requirements

1. **FR-1: Beta Config Transmission**
   - portfolioConfigLoader must extract beta config from `globalDefaults.beta`
   - portfolioConfigLoader must pass beta config as separate `betaScaling` object in returned parameters
   - Maintain backward compatibility with existing configs

2. **FR-2: Beta Scaling Execution**
   - portfolioBacktestService must apply beta scaling when `config.betaScaling.enabled === true`
   - Each stock must use centralized BetaScalingService (Spec 43 compliance)
   - Log beta application status for each stock

3. **FR-3: Stock-Level Beta Overrides**
   - Support stock-specific beta overrides in `stockSpecificOverrides[symbol].beta`
   - Stock-level beta config should merge with global beta config

4. **FR-4: Beta Data Coverage**
   - System should fetch beta values from provider when missing
   - Fallback to beta=1.0 with warning when provider has no data
   - Log all stocks using fallback beta

### Non-Functional Requirements

1. **NFR-1: Backward Compatibility**
   - Existing portfolio configs without beta section must continue working
   - Default behavior: beta scaling disabled when beta config absent

2. **NFR-2: Performance**
   - Beta fetching should be done in parallel with price data loading
   - Cache beta values to avoid repeated API calls

3. **NFR-3: Observability**
   - Console logs must show beta scaling status for each stock
   - Logs must indicate when beta is fetched vs cached vs fallback
   - Result data should include beta information per stock

## User Stories

### US-1: Portfolio Manager with Beta Scaling
**As a** portfolio backtest user
**I want** beta scaling to work in config mode
**So that** I can adjust DCA parameters based on stock volatility across my entire portfolio

**Acceptance Criteria**:
- Config with `enableBetaScaling: true` applies beta scaling to all stocks
- Each stock's parameters are adjusted by its beta value
- Results show beta-adjusted parameters for each stock

### US-2: Beta Data Transparency
**As a** portfolio backtest user
**I want** to see which stocks have real beta values vs fallback
**So that** I can understand the reliability of beta-adjusted results

**Acceptance Criteria**:
- Console logs show beta value source (fetched/cached/fallback) for each stock
- Result data includes beta information per stock
- Warning displayed when significant portion of portfolio uses fallback beta

### US-3: Stock-Specific Beta Overrides
**As a** portfolio backtest user
**I want** to override beta for specific stocks
**So that** I can use custom beta values when I disagree with provider data

**Acceptance Criteria**:
- Can specify beta override in stockSpecificOverrides
- Override takes precedence over fetched beta
- Override marked as `isManualBetaOverride: true` in results

## Success Metrics

1. **Functionality**: Beta scaling applies to 100% of stocks in portfolio mode
2. **Data Coverage**: Beta values fetched for at least 80% of nasdaq100 stocks
3. **Transparency**: Beta source logged for every stock in portfolio
4. **Performance**: Beta fetching adds <10% overhead to portfolio backtest time

## Out of Scope

- Calculating beta values internally (rely on external provider)
- Custom beta calculation methods
- Historical beta tracking (use latest beta value only)
- Beta adjustment for different time periods

## Related Specs

- **Spec 43**: Centralized Beta Scaling Service (must use this implementation)
- **Spec 28**: Portfolio-Based Capital Management (original portfolio backtest implementation)
- **G01**: Multi-mode parameter compliance (beta must work across all modes)
