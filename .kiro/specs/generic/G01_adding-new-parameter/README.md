# G01: Adding New Parameters - Complete Guide

## Purpose

This comprehensive guide documents the complete process for adding new parameters to the Grid-Based DCA Trading Simulator. It ensures parameters work correctly across the entire stack: backend logic, API, configuration, frontend UI, URL encoding, and testing - in ALL applicable modes (single, portfolio, batch).

## Guide Structure

This guide is organized into 8 sections:

1. **[01-overview](./01-overview/)** - Overview, checklist, and architecture
2. **[02-parameter-relationships](./02-parameter-relationships/)** - Analyzing parameter interactions and conflicts (CRITICAL - READ FIRST!)
3. **[03-unified-handling](./03-unified-handling/)** - Unified parameter handling principles (CRITICAL - READ SECOND!)
4. **[04-backend](./04-backend/)** - Backend implementation (executor, service, API)
5. **[05-configuration](./05-configuration/)** - Configuration defaults and ticker-specific settings
6. **[06-frontend](./06-frontend/)** - Frontend UI components and React state
7. **[07-url](./07-url/)** - URL parameter encoding and decoding
8. **[08-testing](./08-testing/)** - Comprehensive testing across all modes

## Critical Principle: Parameter Relationships & Unified Handling

**READ 02-parameter-relationships and 03-unified-handling FIRST before implementing any new parameter!**

The most important principle when adding a new parameter:

### ✅ DO: Integrate into Existing Code Paths
- Add parameters to existing parameter handling systems
- Extend existing functions to handle both old and new parameters
- Use the same code paths that existing parameters use

### ❌ DON'T: Create Ad-Hoc Code
- Don't create special handling just for your parameter
- Don't duplicate existing parameter handling logic
- Don't create new code paths that bypass existing systems

**Goal**: A new parameter should "slot into" existing systems seamlessly, following the same patterns as existing parameters.

## Reference Parameter Designs

To understand where to integrate new parameters, study these existing parameters as templates:

### Reference 1: Number Type Parameter - `trailingBuyReboundPercent`

**Type**: Percentage (stored as decimal, displayed as whole number)
**Purpose**: Price rebound from bottom required to trigger trailing buy
**Used in**: Single backtest, portfolio backtest, batch mode

**Why this is a good reference**:
- Widely integrated across all modes
- Shows percentage handling (decimal ↔ whole number conversion)
- Has configuration defaults
- Has URL parameter support
- Used in core executor logic

**Key Integration Points**:
See [`reference-parameters/trailingBuyReboundPercent.md`](./reference-parameters/trailingBuyReboundPercent.md) for complete breakdown.

### Reference 2: Boolean Type Parameter - `enableConsecutiveIncrementalBuyGrid`

**Type**: Boolean
**Purpose**: Enable incremental buy grid spacing that increases with each consecutive buy
**Used in**: Single backtest, portfolio backtest, batch mode

**Why this is a good reference**:
- Complete boolean parameter example
- Shows conditional feature activation pattern
- Integrated across ALL modes (single, portfolio, batch)
- Has configuration defaults
- Has URL parameter support
- Shows how to add feature flags

**Key Integration Points**:
See [`reference-parameters/enableConsecutiveIncrementalBuyGrid.md`](./reference-parameters/enableConsecutiveIncrementalBuyGrid.md) for complete breakdown.

## When to Use This Guide

Use this guide whenever you need to add:
- **Boolean flags** (e.g., `enableFeatureX`, `momentumBasedBuy`)
- **Numeric parameters** (e.g., `maxRetries`, `batchSize`)
- **Percentage parameters** (e.g., `thresholdPercent`, `gridIntervalPercent`)
- **String parameters** (e.g., `orderType`, `strategyMode`)

## Multi-Mode Support Principle

**By default, new parameters should automatically be available across ALL modes:**
- Single backtest (long/short)
- Portfolio backtest
- Batch mode backtest

**This includes ALL layers:**
- Backend API endpoints and logic
- UI configuration forms
- URL parameter encoding/decoding
- API curl commands
- Configuration defaults

**Only exclude a parameter from a specific mode if:**
- It fundamentally doesn't make sense (e.g., portfolio-level parameter in single backtest)
- It creates logical conflicts (e.g., batch-specific parallelization settings)
- It requires mode-specific implementation

**Default Assumption**: If you're adding a parameter, assume it should work everywhere until proven otherwise.

## Quick Start: Adding a New Parameter

### Step 1: Study Reference Parameters (REQUIRED)

Before writing any code, study the reference parameters:

1. **If adding a number/percentage parameter**:
   - Read `reference-parameters/trailing BuyReboundPercent.md`
   - Trace through all files showing how it's integrated
   - Follow the exact same pattern for your parameter

2. **If adding a boolean parameter**:
   - Read `reference-parameters/enableConsecutiveIncrementalBuyGrid.md`
   - Trace through all files showing how it's integrated
   - Follow the exact same pattern for your parameter

### Step 2: Analyze Parameter Relationships

**CRITICAL STEP**: Before writing any code, analyze how your parameter interacts with existing parameters.

1. **Read [02-parameter-relationships](./02-parameter-relationships/README.md)**
2. **Create a relationship table** for your parameter showing:
   - What parameters are affected by your new parameter
   - What parameters contradict your new parameter
   - What conditions are introduced
3. **Identify conflicts** that need UI warnings or mutual exclusion
4. **Document overrides** that need clear help text

This analysis prevents bugs, user confusion, and logic conflicts!

### Step 3: Follow the Checklist

Use the complete checklist in [01-overview](./01-overview/README.md#complete-checklist) to ensure all steps are completed.

### Step 4: Implement Backend First

1. Read [04-backend](./04-backend/README.md)
2. Add parameter to executor → service → API (in that order)
3. Test with curl before proceeding to frontend

### Step 5: Add Configuration

1. Read [05-configuration](./05-configuration/README.md)
2. Add defaults to `backtestDefaults.json`
3. Add ticker-specific defaults if needed

### Step 6: Add Frontend UI

1. Read [06-frontend](./06-frontend/README.md)
2. Add UI controls to form
3. Verify parameter appears in ALL mode forms (single, portfolio, batch)

### Step 7: Add URL Support

1. Read [07-url](./07-url/README.md)
2. Add encoding and decoding to `URLParameterManager.js`
3. Test round-trip URL parameter handling

### Step 8: Test Comprehensively

1. Read [08-testing](./08-testing/README.md)
2. Test backend API directly (curl)
3. Test frontend UI (manual)
4. Test URL encoding/decoding
5. Test across ALL modes (single, portfolio, batch)

## Common Pitfalls to Avoid

### Pitfall 1: Creating Ad-Hoc Code (MOST COMMON!)

**Wrong Approach**:
```javascript
// Bad: Creating special handling just for this parameter
if (newParameter !== undefined) {
  // Special code path that doesn't follow existing patterns
  const specialValue = processNewParameter(newParameter);
  return specialBacktestLogic(specialValue);
}
```

**Correct Approach**:
```javascript
// Good: Adding to existing parameter flow
async function runDCABacktest({
  // Existing parameters
  trailingBuyReboundPercent = 0.05,

  // New parameter added alongside existing ones
  newParameter = defaultValue,  // Follows same pattern

  // Other parameters
}) {
  // Uses same execution logic as all other parameters
}
```

**Read [03-unified-handling](./03-unified-handling/README.md) for detailed examples.**

### Pitfall 2: Missing Modes

**Symptom**: Parameter works in single backtest but not portfolio/batch mode.

**Cause**: Forgot to add to all mode forms or backend endpoints.

**Fix**: Always verify parameter in ALL modes.

### Pitfall 3: URL Parameter Not Working

**Symptom**: Parameter works in UI but doesn't appear in shareable URL.

**Cause**: Missing from `URLParameterManager.js` encoding/decoding.

**Fix**: See [07-url](./07-url/README.md) for proper URL handling.

### Pitfall 4: Parameter Dropped at API Layer

**Symptom**: Parameter in req.body but undefined in service layer.

**Cause**: Not included in `runDCABacktest()` call in `server.js`.

**Fix**: See [04-backend](./04-backend/README.md#step-3-add-parameter-to-api-layer) for explicit parameter passing.

## File Locations Reference

```
Backend:
  /Users/kweng/AI/DCA-Backtest-Tool/backend/services/dcaExecutor.js
  /Users/kweng/AI/DCA-Backtest-Tool/backend/services/dcaBacktestService.js
  /Users/kweng/AI/DCA-Backtest-Tool/backend/services/portfolioBacktestService.js
  /Users/kweng/AI/DCA-Backtest-Tool/backend/services/batchBacktestService.js
  /Users/kweng/AI/DCA-Backtest-Tool/backend/server.js

Configuration:
  /Users/kweng/AI/DCA-Backtest-Tool/config/backtestDefaults.json
  /Users/kweng/AI/DCA-Backtest-Tool/config/tickerDefaults/[SYMBOL].json

Frontend:
  /Users/kweng/AI/DCA-Backtest-Tool/frontend/src/components/DCABacktestForm.js
  /Users/kweng/AI/DCA-Backtest-Tool/frontend/src/components/PortfolioBacktestForm.js
  /Users/kweng/AI/DCA-Backtest-Tool/frontend/src/components/PortfolioBacktestPage.js (manual URL handling)
  /Users/kweng/AI/DCA-Backtest-Tool/frontend/src/components/backtest/sections/LongStrategySection.js (shared component)
  /Users/kweng/AI/DCA-Backtest-Tool/frontend/src/utils/URLParameterManager.js

Testing:
  /Users/kweng/AI/DCA-Backtest-Tool/backend/test_*.sh
  /tmp/server_debug.log
```

## Portfolio Backtest Special Handling

**IMPORTANT**: Portfolio backtest uses **manual URL parameter handling**, unlike single backtest which uses `URLParameterManager`.

When adding a parameter that should work in portfolio mode, you MUST update these 3 places in `PortfolioBacktestPage.js`:

1. **Default state initialization** (~line 57)
2. **URL decoding** (searchParams parsing, ~line 125)
3. **URL encoding** (params.set, ~line 200)

**Lesson from Spec 45**: This is easy to miss! Portfolio momentum controls weren't visible until URL handling was added.

See [06-frontend](./06-frontend/README.md#portfolio-and-batch-mode-support) for details.

## Real-World Examples

### Example 1: Spec 45 - Momentum-Based Trading

**Parameters Added**: `momentumBasedBuy`, `momentumBasedSell` (booleans)

**Full implementation**: `.kiro/specs/45_momentum-based-trading/`

**Key Files Modified**:
- Backend: `dcaExecutor.js`, `dcaBacktestService.js`, `server.js`
- Config: `backtestDefaults.json`
- Frontend: `DCABacktestForm.js`, `LongStrategySection.js`, `PortfolioBacktestPage.js`
- URL: `URLParameterManager.js`
- Testing: `test_momentum_mode.sh`, `test_momentum_portfolio.sh`

**Lessons Learned**:
- Portfolio page needs manual URL handling (3 places)
- Shared components (`LongStrategySection.js`) provide UI to both single and portfolio forms
- Explicit parameter preservation in `server.js` is CRITICAL

### Example 2: Spec 23 - Average-Based Features

**Parameters Added**: `enableAverageBasedGrid`, `enableAverageBasedSell` (booleans)

**Shows**: How to add multiple related boolean parameters that work together.

### Example 3: Spec 24 - Dynamic Profile Switching

**Parameters Added**: `enableDynamicProfile` (boolean)

**Shows**: Feature flag pattern for conditional logic activation.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Journey                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. FRONTEND UI (DCABacktestForm.js)                        │
│     - User sets parameters via checkboxes/inputs            │
│     - Form state managed in React component                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. URL ENCODING (URLParameterManager.js)                   │
│     - Parameters encoded to shareable URL                   │
│     - _encodeSingleParameters() method                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. API REQUEST (fetch POST /api/backtest/dca)              │
│     - Parameters sent in request body as JSON               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. BACKEND API (server.js)                                 │
│     - Route: POST /api/backtest/dca                         │
│     - Extract parameters from req.body                      │
│     - Pass to service layer                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  5. SERVICE LAYER (dcaBacktestService.js)                   │
│     - runDCABacktest() function                             │
│     - Apply defaults from backtestDefaults.json             │
│     - Pass to executor                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  6. EXECUTOR (dcaExecutor.js)                               │
│     - Core trading logic                                    │
│     - Uses parameters to control behavior                   │
│     - Returns results with statistics                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  7. RESULTS DISPLAY                                         │
│     - API response with backtest results                    │
│     - Frontend displays charts and metrics                  │
│     - URL preserves configuration for sharing               │
└─────────────────────────────────────────────────────────────┘
```

## Next Steps

1. **Read [02-parameter-relationships](./02-parameter-relationships/README.md)** - CRITICAL for analyzing parameter interactions FIRST
2. **Read [03-unified-handling](./03-unified-handling/README.md)** - CRITICAL for understanding how to integrate parameters correctly
3. **Study reference parameters** - See how existing parameters are integrated
4. **Read [01-overview](./01-overview/README.md)** - Complete checklist and overview
5. **Follow implementation guides** - 04-backend → 05-configuration → 06-frontend → 07-url → 08-testing
6. **Test comprehensively** - Verify parameter works across ALL modes

## Summary

Adding a new parameter is straightforward when you:
1. Follow existing parameter patterns (use reference parameters!)
2. Integrate into existing systems (don't create ad-hoc code!)
3. Test across all modes (single, portfolio, batch)
4. Use the comprehensive checklist

The key to success is **studying existing parameters** and **following the same patterns** they use, rather than inventing new ways to handle your parameter.
