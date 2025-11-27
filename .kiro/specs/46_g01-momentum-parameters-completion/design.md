# Design: Complete Momentum Parameters per G01 Guidelines

## Overview

This spec ensures `momentumBasedBuy` and `momentumBasedSell` parameters are **fully compliant** with G01 (Adding New Parameters) guidelines by completing missing batch mode support and documentation.

## Design Principles

### 1. Follow G01 Exactly
- Use G01 checklist as verification tool
- Reference G01 patterns for all implementations
- Update G01 with lessons learned from Spec 45

### 2. Consistency Across Modes
- Batch mode should work identically to single/portfolio modes
- Same parameter names, types, and behaviors
- Same URL encoding/decoding rules
- Same configuration defaults

### 3. Minimal Changes
- Don't reinvent - reuse existing patterns from Spec 45
- Only add what's truly missing
- Avoid refactoring existing working code

## Architecture

### Current State (Spec 45 Complete)

```
┌─────────────────────────────────────────────────────────┐
│ Frontend UI                                              │
├─────────────────────────────────────────────────────────┤
│ Single Backtest Form     ✅ Has momentum checkboxes     │
│ Portfolio Backtest Form  ✅ Has momentum checkboxes     │
│ Batch Backtest Form      ❌ MISSING momentum checkboxes │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ URL Parameter Encoding (URLParameterManager.js)         │
├─────────────────────────────────────────────────────────┤
│ Single mode encoding     ✅ Works                       │
│ Portfolio mode encoding  ✅ Works (manual in Page.js)   │
│ Batch mode encoding      ❓ Unknown (need verification) │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Backend API (server.js)                                 │
├─────────────────────────────────────────────────────────┤
│ POST /api/backtest/dca        ✅ Accepts parameters     │
│ POST /api/backtest/portfolio  ✅ Accepts parameters     │
│ POST /api/backtest/batch      ❓ Unknown               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Service Layer                                           │
├─────────────────────────────────────────────────────────┤
│ dcaBacktestService.js    ✅ Passes parameters          │
│ portfolioBacktestService ✅ Uses executor (has params) │
│ batchBacktestService.js  ❓ Unknown (verification)     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Executor (dcaExecutor.js)                               │
├─────────────────────────────────────────────────────────┤
│ Momentum buy logic       ✅ Implemented                 │
│ Momentum sell logic      ✅ Implemented                 │
│ P/L calculation          ✅ Implemented                 │
│ Statistics tracking      ✅ Implemented                 │
└─────────────────────────────────────────────────────────┘
```

### Target State (G01 Compliant)

All three modes (single, portfolio, batch) should have identical support.

## Component Analysis

### 1. Backend Verification (batchBacktestService.js)

**Hypothesis:** Batch service likely already supports parameters because it uses `dcaExecutor.js`.

**Need to verify:**
```javascript
// In batchBacktestService.js - look for this pattern:
const results = await runDCABacktest(
  symbol,
  startDate,
  endDate,
  {
    // ... other parameters ...
    momentumBasedBuy,      // ❓ Is this included?
    momentumBasedSell,     // ❓ Is this included?
  }
);
```

**If missing:** Add parameters to the call (simple fix, ~10 lines of code)

**If present:** No backend changes needed, only documentation!

### 2. Batch Mode Frontend (BatchBacktestForm or equivalent)

**Need to locate:** Where are batch UI controls?
- Could be in `DCABacktestForm.js` with mode switch
- Could be separate `BatchBacktestForm.js` component
- Could be in a batch-specific page component

**Implementation pattern (from Spec 45 single mode):**
```jsx
<FormControlLabel
  control={
    <Checkbox
      checked={params.momentumBasedBuy || false}
      onChange={(e) => handleParamChange('momentumBasedBuy', e.target.checked)}
    />
  }
  label="Momentum-Based Buy"
/>

<FormControlLabel
  control={
    <Checkbox
      checked={params.momentumBasedSell || false}
      onChange={(e) => handleParamChange('momentumBasedSell', e.target.checked)}
    />
  }
  label="Momentum-Based Sell"
/>
```

### 3. URL Encoding for Batch Mode

**Check if batch URLs use URLParameterManager:**
- If YES: Already works (parameters already in encoding/decoding)
- If NO: Need to add manual handling (like portfolio mode)

**From Spec 45, URLParameterManager already has:**
```javascript
// Encoding
if (parameters.momentumBasedBuy !== undefined)
  params.set('momentumBasedBuy', parameters.momentumBasedBuy.toString());

// Decoding
if (params.momentumBasedBuy !== undefined) {
  decoded.momentumBasedBuy = this._parseBoolean(params.momentumBasedBuy, false);
}

// Boolean params array
const booleanParams = [
  // ... other booleans ...
  'momentumBasedBuy', 'momentumBasedSell'
];
```

### 4. Documentation Structure

**Create two new documentation files:**

#### File 1: `/docs/api/momentum-parameters.md`
```markdown
# Momentum Trading Parameters

## momentumBasedBuy

**Type:** Boolean
**Default:** `false`
**Modes:** Single, Portfolio, Batch

**Description:**
Enable momentum-based buying strategy...

**When enabled:**
- Buy activation threshold = 0%
- Buys only when P/L > 0
- maxLots constraint removed

**API Example (Single Mode):**
```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "momentumBasedBuy": true
  }'
```

**API Example (Batch Mode):**
```bash
curl -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "MSFT", "NVDA"],
    "momentumBasedBuy": true
  }'
```
```

#### File 2: `/docs/guides/momentum-trading.md`
```markdown
# Momentum Trading Guide

## What is Momentum Trading?

Traditional DCA: Buy dips, sell spikes (mean reversion)
Momentum DCA: Buy strength, sell weakness (trend following)

## When to Use

**Use Momentum Mode when:**
- Strong trending markets
- High conviction in trend continuation
- Want to "add to winners"

**Use Traditional Mode when:**
- Choppy/sideways markets
- Mean reversion expected
- Want to "buy the dip"

## Examples

### Pure Momentum (Buy + Sell)
...

### Hybrid Strategies
...
```

## Implementation Plan

### Phase 1: Verification (1-2 hours)

**Goal:** Determine exact gaps

**Tasks:**
1. Search `batchBacktestService.js` for momentum parameters
2. Locate batch UI component
3. Test batch URL encoding manually
4. Document current state vs required state

**Decision Points:**
- If batch backend complete → Skip backend work
- If batch UI doesn't exist → May need larger refactor
- If batch URLs work → Skip URL work

### Phase 2: Backend (0-2 hours)

**If needed:**

**File:** `/backend/services/batchBacktestService.js`

**Changes:**
```javascript
// Add to parameter extraction
const {
  // ... existing parameters ...
  momentumBasedBuy = false,
  momentumBasedSell = false
} = req.body;

// Add to runDCABacktest call
const results = await runDCABacktest(symbol, startDate, endDate, {
  // ... existing parameters ...
  momentumBasedBuy,
  momentumBasedSell
});
```

**Testing:**
```bash
# Create test script
curl -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "MSFT"],
    "startDate": "2024-01-01",
    "endDate": "2024-06-30",
    "momentumBasedBuy": true,
    "momentumBasedSell": true
  }' | jq '.data | .[0].momentumMode'
```

### Phase 3: Frontend UI (1-3 hours)

**If needed:**

**Locate batch form component, then add:**

```jsx
{/* Momentum Trading Section */}
<Box sx={{ mt: 2 }}>
  <Typography variant="h6">Momentum Mode</Typography>

  <FormControlLabel
    control={<Checkbox checked={params.momentumBasedBuy || false}
                       onChange={(e) => handleParamChange('momentumBasedBuy', e.target.checked)} />}
    label="Momentum-Based Buy"
  />

  <FormControlLabel
    control={<Checkbox checked={params.momentumBasedSell || false}
                       onChange={(e) => handleParamChange('momentumBasedSell', e.target.checked)} />}
    label="Momentum-Based Sell"
  />

  <Typography variant="caption" color="text.secondary">
    Momentum mode: Buy on strength (P/L > 0), sell on weakness.
    See docs for details.
  </Typography>
</Box>
```

**Testing:**
1. Open batch backtest page
2. Verify checkboxes appear
3. Toggle checkboxes, verify state updates
4. Submit batch test, verify parameters in request
5. Verify results show momentum statistics

### Phase 4: URL Encoding (0-2 hours)

**If batch uses manual URL handling:**

**Pattern from PortfolioBacktestPage.js (Spec 45):**

```javascript
// 1. State initialization
const [params, setParams] = useState({
  // ... other params ...
  momentumBasedBuy: false,
  momentumBasedSell: false
});

// 2. URL Decoding (in useEffect)
const momentumBasedBuy = searchParams.get('momentumBasedBuy') === 'true';
const momentumBasedSell = searchParams.get('momentumBasedSell') === 'true';

// 3. URL Encoding (in generateShareableUrl)
if (params.momentumBasedBuy) params.set('momentumBasedBuy', 'true');
if (params.momentumBasedSell) params.set('momentumBasedSell', 'true');
```

### Phase 5: Documentation (3-4 hours)

**File 1:** `/docs/api/momentum-parameters.md` (~1.5 hours)
- Parameter definitions
- API examples for all 3 modes
- Response format
- Error cases

**File 2:** `/docs/guides/momentum-trading.md` (~1.5 hours)
- Conceptual explanation
- When to use
- Parameter combinations
- Real examples with results

**File 3:** Update G01 lessons learned (~1 hour)
- Document P/L gating pattern
- Document portfolio manual URL handling
- Document statistics tracking pattern

### Phase 6: Testing (2 hours)

**Create:** `/backend/test_momentum_batch.sh`

```bash
#!/bin/bash

echo "Test 1: Batch mode with momentum buy"
curl -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "MSFT", "NVDA"],
    "startDate": "2024-01-01",
    "endDate": "2024-06-30",
    "momentumBasedBuy": true
  }' | jq '.data | map({
    symbol,
    momentumMode,
    maxLotsReached,
    buyBlockedByPnL
  })'

echo "Test 2: Batch mode with both momentum modes"
curl -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["PLTR", "TSLA"],
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "momentumBasedBuy": true,
    "momentumBasedSell": true
  }' | jq '.data | map({
    symbol,
    momentumMode,
    totalPnl
  })'

echo "Test 3: URL round-trip (if batch has URLs)"
# Test URL encoding/decoding
```

## Success Metrics

### Completion Checklist (G01)
- [x] Backend Core Logic (already done in Spec 45)
- [ ] Backend API for batch mode ← **VERIFY/FIX**
- [x] Configuration (already done in Spec 45)
- [ ] Frontend UI for batch mode ← **ADD**
- [x] URL Parameter Handling (single/portfolio done)
- [ ] URL for batch mode ← **VERIFY/ADD**
- [ ] Testing for batch mode ← **CREATE**
- [ ] Documentation ← **CREATE**

### Functional Verification
- [ ] Batch API accepts momentum parameters
- [ ] Batch UI shows momentum controls
- [ ] Batch results include momentum statistics
- [ ] Batch URLs preserve momentum settings
- [ ] All 3 modes work identically
- [ ] Documentation complete and accurate

## Risks & Mitigations

### Risk: Batch Service Has Different Architecture
**Mitigation:** Verification phase will discover this early. Adjust plan accordingly.

### Risk: No Batch UI Form Exists
**Mitigation:** Parameters may be passed differently (JSON upload?). Document alternative approach.

### Risk: Documentation Takes Longer Than Expected
**Mitigation:** Use Spec 45 as template. Focus on examples over theory.

## Assumptions

1. Batch backtest uses same executor as single/portfolio
2. Batch mode has some form of UI (even if minimal)
3. URLParameterManager is used across all modes
4. Markdown documentation format is acceptable
5. Momentum logic doesn't need changes (Spec 45 implementation correct)

## Out of Scope

- Changes to momentum trading logic (Spec 45 complete)
- Performance improvements
- Additional momentum parameters
- Machine learning or automatic parameter selection
- Short strategy momentum (future work)
