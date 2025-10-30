---
name: g01-parameter-adder
description: Add new parameters to DCA Backtest Tool following G01 multi-mode compliance guidelines. Use when adding boolean flags, numeric parameters, or configuration options that need to work across single, portfolio, and batch backtest modes. Ensures complete integration across all components.
version: 2.0.0
last_updated: 2025-10-26
changelog: |
  v2.0.0 (2025-10-26): Comprehensive update - merged all G01 documentation details
  v1.1.0 (2025-10-26): Add critical batch mode lessons from Spec 46
  v1.0.0 (2025-10-26): Initial creation
---

# G01 Parameter Adder Skill

Comprehensive guide for adding new parameters to the DCA Backtest Tool, ensuring they work correctly across the entire stack: backend logic, API, configuration, frontend UI, URL encoding, and testing - in ALL applicable modes (single, portfolio, batch).

## ⚠️ CRITICAL: Read These First!

### 1. Batch Mode Special Attention (from Spec 46)

**The #1 mistake when adding parameters**: Batch mode has TWO separate places that must be updated.

**Why Batch Mode is Different:**
Single/Portfolio modes share the same `parameters` state object. Batch mode uses a completely separate `batchParameters` state object AND a separate request construction.

**The Two Critical Updates:**

**Update 1: batchParameters Default State** (DCABacktestForm.js ~lines 80-105)
```javascript
const defaultParams = {
  // ... existing params ...
  enableDynamicProfile: false,
  // ADD YOUR PARAMETER HERE
  newParameter: defaultValue  // ← Must add here!
};
```

**Update 2: Batch Request Payload** (DCABacktestForm.js ~lines 764-791)
```javascript
const batchOptions = {
  parameterRanges: {
    // ... existing params ...
    trailingStopOrderType: batchParameters.trailingStopOrderType,
    // ADD YOUR PARAMETER HERE
    newParameter: batchParameters.newParameter  // ← Must add here too!
  }
};
```

**Verification**: Always check Network tab in browser DevTools to ensure parameter appears in POST request payload.

### 2. Parameter Relationships (ANALYZE FIRST!)

**Before writing ANY code**, analyze how your new parameter interacts with existing parameters:

| Parameter/Condition | Affected by [NewParameter] | Contradictory to [NewParameter] |
|---------------------|---------------------------|----------------------------------|
| List related params | How are they modified?    | Do they conflict?                |

**Example - `momentumBasedBuy`:**
- **Overrides**: `trailingBuyActivationPercent` → 0%, `maxLots` → unlimited
- **Contradicts**: Traditional DCA (buy on weakness) vs Momentum (buy on strength)
- **New Conditions**: Requires position P/L > 0 for buys (except first)

**Documentation Needed**:
- Help text must explain overrides
- UI warnings for contradictions
- Spec must document new conditions

See: `.kiro/specs/generic/G01_adding-new-parameter/02-parameter-relationships/`

### 3. Unified Handling Principle

**✅ DO: Integrate into Existing Code Paths**
- Add parameters to existing parameter handling systems
- Extend existing functions to handle both old and new parameters
- Use the same code paths that existing parameters use

**❌ DON'T: Create Ad-Hoc Code**
- Don't create special handling just for your parameter
- Don't duplicate existing parameter handling logic
- Don't create new code paths that bypass existing systems

**Goal**: A new parameter should "slot into" existing systems seamlessly, following the same patterns as existing parameters.

## When to Use This Skill

Use this skill when adding:
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

## Reference Parameter Designs

**Study these BEFORE implementing your parameter:**

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
See: `.kiro/specs/generic/G01_adding-new-parameter/reference-parameters/trailingBuyReboundPercent.md`

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
See: `.kiro/specs/generic/G01_adding-new-parameter/reference-parameters/enableConsecutiveIncrementalBuyGrid.md`

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

## Complete Implementation Workflow

### Quick Start Checklist

**BEFORE writing code:**
1. ✅ Read parameter relationship analysis guide
2. ✅ Study reference parameter that matches your type (boolean/number/percentage)
3. ✅ Create parameter relationship table for your parameter
4. ✅ Identify overrides, contradictions, and new conditions
5. ✅ Plan help text and UI warnings

**Implementation order (CRITICAL to follow this exact order):**
1. ✅ Backend: dcaExecutor.js → dcaBacktestService.js → portfolioBacktestService.js → batchBacktestService.js → server.js
2. ✅ Configuration: backtestDefaults.json
3. ✅ Frontend: DCABacktestForm.js (parameters + batchParameters + UI + request payload)
4. ✅ URL: URLParameterManager.js (encode + decode)
5. ✅ Testing: curl scripts for all 3 modes

### Phase 1: Verification (1-2 hours)

**Check existing support:**
```bash
grep -r "parameterName" backend/services/
grep -r "parameterName" frontend/src/
```

**Document:**
- What's already implemented?
- What's missing?
- Are there partial implementations?

### Phase 2: Backend Implementation (2-4 hours)

**File Modification Order (CRITICAL):**

**Step 1: dcaExecutor.js** (~line 340)
```javascript
async function runDCABacktest({
  // ... existing parameters ...
  trailingSellPullbackPercent = 0.10,

  // NEW: Add your parameter with default value
  newParameter = defaultValue,

  // ... other parameters ...
}) {
  // Add logic that uses newParameter
  if (newParameter) {
    // Your custom logic here
  }

  // Return in results
  return {
    // ... existing results ...
    newParameterStats: { /* ... */ },
  };
}
```

**Step 2: dcaBacktestService.js** (~line 606)
```javascript
async function runDCABacktest({
  // ... existing parameters ...

  // NEW: Extract parameter with default
  newParameter = defaultValue,

  // ... other parameters ...
}) {
  // Pass to executor
  const result = await dcaExecutor.runDCABacktest({
    // ... existing params ...
    newParameter,  // NEW: Pass through
    // ... other params ...
  });

  return result;
}
```

**Step 3: portfolioBacktestService.js** (if applicable)
```javascript
// Extract from config or request
const newParameter = stock.config.newParameter ?? globalDefaults.newParameter ?? defaultValue;

// Pass to executor
const stockResult = await dcaExecutor.runDCABacktest({
  // ... existing params ...
  newParameter,  // NEW: Pass through
  // ... other params ...
});
```

**Step 4: batchBacktestService.js**
```javascript
// Extract from parameterRanges
const { newParameter = defaultValue } = parameterRanges;

// Add to parameter combinations
const combinations = generateParameterCombinations({
  // ... existing params ...
  newParameter: Array.isArray(newParameter) ? newParameter : [newParameter],
  // ... other params ...
});
```

**Step 5: server.js** - API endpoint
```javascript
app.post('/api/backtest/dca', async (req, res) => {
  const {
    // ... existing params ...
    newParameter,  // NEW: Extract from req.body
    // ... other params ...
  } = req.body;

  // Pass to service
  const result = await dcaBacktestService.runDCABacktest({
    // ... existing params ...
    newParameter,  // NEW: Pass through
    // ... other params ...
  });
});
```

**CRITICAL**: Each layer must EXPLICITLY pass the parameter. Do NOT rely on spread operators alone, as they can silently drop parameters.

### Phase 3: Configuration (15 min)

**backtestDefaults.json:**
```json
{
  "global": {
    "longStrategy": {
      "newParameter": defaultValue
    },
    "shortStrategy": {
      "newParameter": defaultValue
    }
  }
}
```

### Phase 4: Frontend State & UI (2-3 hours)

**DCABacktestForm.js:**

**4.1: Single/Portfolio State** (~line 50)
```javascript
const [parameters, setParameters] = useState({
  // ... existing params ...
  newParameter: defaultValue,  // NEW: Add to state
});
```

**4.2: Batch State** (~line 80-105)
```javascript
const defaultParams = {
  // ... existing params ...
  newParameter: defaultValue,  // NEW: Add to batch state
};

const [batchParameters, setBatchParameters] = useState(defaultParams);
```

**4.3: UI Control** (in appropriate section, e.g., LongStrategySection.js)

For boolean:
```jsx
<div className="form-group">
  <label>
    <input
      type="checkbox"
      checked={parameters.newParameter ?? false}
      onChange={(e) => handleChange('newParameter', e.target.checked)}
    />
    Parameter Label
  </label>
  <div className="help-text">
    Description of what this parameter does.
    {parameters.conflictingParam && (
      <div className="warning">⚠️ Note: This overrides conflictingParam</div>
    )}
  </div>
</div>
```

For number/percentage:
```jsx
<div className="form-group">
  <label>Parameter Label (%)</label>
  <input
    type="number"
    value={parameters.newParameter ?? defaultValue}
    onChange={(e) => handleChange('newParameter', parseFloat(e.target.value))}
    step="0.01"
    min="0"
    max="100"
  />
  <div className="help-text">
    Description of what this parameter does.
  </div>
</div>
```

**4.4: Request Payload - Single/Portfolio** (handleSubmit)
```javascript
const requestData = {
  ...parameters,  // Includes newParameter via spread
  // Or explicit:
  newParameter: parameters.newParameter,
};
```

**4.5: Request Payload - Batch** (handleSubmit batch section ~line 764-791)
```javascript
const batchOptions = {
  parameterRanges: {
    symbols: selectedStocks,
    // ... existing params ...
    newParameter: batchParameters.newParameter,  // NEW: CRITICAL!
    // ... other params ...
  }
};
```

### Phase 5: URL Parameters (1-2 hours)

**URLParameterManager.js:**

**5.1: Encoding** (_encodeSingleParameters method)
```javascript
_encodeSingleParameters(params, searchParams) {
  // ... existing encoding ...

  // NEW: Add your parameter
  if (params.newParameter !== undefined) {
    searchParams.set('newParameter', params.newParameter.toString());
  }
}
```

**5.2: Decoding** (_decodeSingleParameters method)
```javascript
_decodeSingleParameters(searchParams) {
  return {
    // ... existing params ...

    // NEW: Add your parameter
    // For boolean:
    newParameter: searchParams.get('newParameter') === 'true',

    // For number:
    newParameter: parseFloat(searchParams.get('newParameter') || defaultValue),

    // For percentage (stored as whole number in URL, decimal in backend):
    newParameter: (parseFloat(searchParams.get('newParameter') || (defaultValue * 100))) / 100,
  };
}
```

**5.3: Portfolio Mode Manual URL Handling**

**IMPORTANT**: Portfolio backtest uses manual URL handling in `PortfolioBacktestPage.js`, NOT URLParameterManager.

**Update 3 places in PortfolioBacktestPage.js:**

1. **Default state initialization** (~line 57)
```javascript
const [parameters, setParameters] = useState({
  // ... existing params ...
  newParameter: defaultValue,  // NEW
});
```

2. **URL decoding** (~line 125)
```javascript
useEffect(() => {
  const searchParams = new URLSearchParams(location.search);
  // ... existing params ...

  // NEW: Decode from URL
  const newParameter = searchParams.get('newParameter') === 'true'; // boolean
  // or
  const newParameter = parseFloat(searchParams.get('newParameter') || defaultValue); // number

  setParameters(prev => ({
    ...prev,
    newParameter,
  }));
}, [location.search]);
```

3. **URL encoding** (~line 200)
```javascript
const params = new URLSearchParams();
// ... existing params ...

// NEW: Encode to URL
params.set('newParameter', parameters.newParameter.toString());

navigate(`/portfolio/results?${params.toString()}`);
```

### Phase 6: Testing (2-3 hours)

**Create Test Script:** `backend/test_newparameter.sh`

```bash
#!/bin/bash

echo "=== Testing newParameter ==="

# Test 1: Single Mode
echo "Test 1: Single Mode"
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "newParameter": testValue
  }' | jq '.data.newParameterStats'

# Test 2: Portfolio Mode
echo "Test 2: Portfolio Mode"
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "portfolioConfig": "test-portfolio",
    "newParameter": testValue
  }' | jq '.data.portfolioMetrics'

# Test 3: Batch Mode
echo "Test 3: Batch Mode"
curl -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "parameterRanges": {
      "symbols": ["AAPL", "MSFT"],
      "newParameter": [false, true]
    }
  }' | jq '.results[].newParameterStats'
```

**Verification Checklist:**
```
Single Mode:
  ✅ Backend extracts parameter correctly
  ✅ UI control visible and functional
  ✅ State includes parameter
  ✅ Request payload includes parameter
  ✅ URL encodes/decodes parameter
  ✅ Config has default value
  ✅ Behavior changes as expected

Portfolio Mode:
  ✅ Backend extracts parameter correctly
  ✅ UI control visible (shared with single)
  ✅ State includes parameter
  ✅ Request payload includes parameter
  ✅ Manual URL handling in PortfolioBacktestPage.js
  ✅ Config has default value
  ✅ Behavior changes as expected

Batch Mode:
  ✅ Backend extracts parameter correctly
  ✅ UI control visible (shared with single)
  ✅ batchParameters state includes parameter
  ✅ Batch request payload includes parameter (CRITICAL!)
  ✅ Parameter combinations generated correctly
  ✅ Config has default value
  ✅ Behavior changes as expected
```

### Phase 7: Documentation (1-2 hours)

1. **API documentation**: Create `/docs/api/parameter-name.md`
2. **User guide**: Create `/docs/guides/feature-name.md`
3. **Update G01**: Add lessons learned to `.kiro/specs/generic/G01_adding-new-parameter/`

## Common Pitfalls & Solutions

### ❌ Pitfall 1: Creating Ad-Hoc Code (MOST COMMON!)

**Wrong Approach:**
```javascript
// Bad: Creating special handling just for this parameter
if (newParameter !== undefined) {
  const specialValue = processNewParameter(newParameter);
  return specialBacktestLogic(specialValue);
}
```

**Correct Approach:**
```javascript
// Good: Adding to existing parameter flow
async function runDCABacktest({
  trailingBuyReboundPercent = 0.05,  // Existing
  newParameter = defaultValue,        // NEW: Follows same pattern
}) {
  // Uses same execution logic as all other parameters
}
```

### ❌ Pitfall 2: Batch State Missing

**Problem**: Added to `parameters` but forgot `batchParameters`

**Solution**: Always add to BOTH states in DCABacktestForm.js
- Default `parameters` state (~line 50)
- Default `batchParameters` const (~line 80-105)

### ❌ Pitfall 3: Batch Request Payload Missing

**Problem**: Added to state but not to batch request construction

**Solution**: Add to `parameterRanges` in handleSubmit batch section (~line 764-791)

**Verification**: Check Network tab - parameter MUST appear in POST request body.

### ❌ Pitfall 4: URL Encoding Missing

**Problem**: Parameter works but can't be shared via URL

**Solution**: Add to URLParameterManager encode/decode methods

### ❌ Pitfall 5: Parameter Dropped at API Layer

**Problem**: Parameter in req.body but undefined in service layer

**Cause**: Not included in runDCABacktest() call in server.js

**Solution**: Explicitly pass parameter through each layer (don't rely on spread alone)

### ❌ Pitfall 6: Portfolio URL Handling Missing

**Problem**: Parameter works in single mode URL but not portfolio mode URL

**Cause**: Portfolio uses manual URL handling, not URLParameterManager

**Solution**: Update 3 places in PortfolioBacktestPage.js (default state, URL decoding, URL encoding)

### ❌ Pitfall 7: Missing Parameter Relationship Analysis

**Problem**: Parameter conflicts with existing parameters, causing unexpected behavior

**Solution**: Create parameter relationship table BEFORE coding. Document overrides, contradictions, and new conditions.

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
  /Users/kweng/AI/DCA-Backtest-Tool/frontend/src/components/PortfolioBacktestPage.js (manual URL handling)
  /Users/kweng/AI/DCA-Backtest-Tool/frontend/src/components/backtest/sections/LongStrategySection.js (shared UI)
  /Users/kweng/AI/DCA-Backtest-Tool/frontend/src/utils/URLParameterManager.js

Testing:
  /Users/kweng/AI/DCA-Backtest-Tool/backend/test_*.sh
  /tmp/server_debug.log
```

## Real-World Examples

### Example 1: Spec 45 - Momentum-Based Trading

**Parameters Added**: `momentumBasedBuy`, `momentumBasedSell` (booleans)

**Full implementation**: `.kiro/specs/45_momentum-based-trading/`

**Key Lessons**:
- Portfolio page needs manual URL handling (3 places in PortfolioBacktestPage.js)
- Shared components (`LongStrategySection.js`) provide UI to both single and portfolio forms
- Explicit parameter preservation in server.js is CRITICAL
- Parameter relationship analysis revealed overrides and contradictions

### Example 2: Spec 46 - G01 Momentum Parameters Completion

**Problem**: Batch mode silently ignored momentum parameters

**Root Cause**:
- ✅ UI checkboxes existed
- ✅ Backend supported parameters
- ❌ `batchParameters` state missing the parameters
- ❌ Request payload didn't include parameters

**Solution**: Added to both `batchParameters` state AND batch request payload

**Lesson**: ALWAYS verify Network tab shows parameter in request body

## G01 Guide Structure

This skill is a condensed version of the comprehensive G01 guide:

1. **[01-overview](../../.kiro/specs/generic/G01_adding-new-parameter/01-overview/)** - Overview, checklist, architecture
2. **[02-parameter-relationships](../../.kiro/specs/generic/G01_adding-new-parameter/02-parameter-relationships/)** - Parameter interaction analysis (READ FIRST!)
3. **[03-unified-handling](../../.kiro/specs/generic/G01_adding-new-parameter/03-unified-handling/)** - Integration principles
4. **[04-backend](../../.kiro/specs/generic/G01_adding-new-parameter/04-backend/)** - Backend implementation
5. **[05-configuration](../../.kiro/specs/generic/G01_adding-new-parameter/05-configuration/)** - Configuration defaults
6. **[06-frontend](../../.kiro/specs/generic/G01_adding-new-parameter/06-frontend/)** - Frontend UI components
7. **[07-url](../../.kiro/specs/generic/G01_adding-new-parameter/07-url/)** - URL parameter encoding
8. **[08-testing](../../.kiro/specs/generic/G01_adding-new-parameter/08-testing/)** - Comprehensive testing

## Summary

Adding a new parameter is straightforward when you:

1. ✅ **Analyze parameter relationships FIRST** (create relationship table)
2. ✅ **Study reference parameters** (use as templates)
3. ✅ **Follow existing patterns** (don't create ad-hoc code)
4. ✅ **Update batch mode correctly** (state + request payload)
5. ✅ **Test across all modes** (single, portfolio, batch)
6. ✅ **Use the comprehensive checklist**

**The key to success**: Study existing parameters and follow the same patterns they use, rather than inventing new ways to handle your parameter.

## Next Steps for Implementation

1. Read `.kiro/specs/generic/G01_adding-new-parameter/02-parameter-relationships/`
2. Create parameter relationship table for your parameter
3. Study reference parameter matching your type (boolean/number)
4. Follow implementation workflow phase by phase
5. Test comprehensively across all three modes
6. Document lessons learned
