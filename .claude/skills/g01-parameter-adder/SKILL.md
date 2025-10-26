---
name: g01-parameter-adder
description: Add new parameters to DCA Backtest Tool following G01 multi-mode compliance guidelines. Use when adding boolean flags, numeric parameters, or configuration options that need to work across single, portfolio, and batch backtest modes. Ensures complete integration across all components.
version: 1.1.0
last_updated: 2025-10-26
changelog: |
  v1.1.0 (2025-10-26): Add critical batch mode lessons from Spec 46
  v1.0.0 (2025-10-26): Initial creation
---

# G01 Parameter Adder Skill

Adds new parameters to the DCA Backtest Tool following G01 multi-mode support guidelines.

## ⚠️ CRITICAL: Batch Mode Special Attention (from Spec 46)

**The #1 mistake when adding parameters**: Batch mode has TWO separate places that must be updated.

### Why Batch Mode is Different

Single/Portfolio modes share the same `parameters` state object. Batch mode uses a completely separate `batchParameters` state object AND a separate request construction.

### The Two Critical Updates

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

### What Happens If You Forget

**Symptom**: UI checkboxes work, user can toggle them, but parameter is silently ignored by backend.

**Example** (Spec 46 - Momentum Parameters):
- ✅ UI checkboxes existed
- ✅ Backend supported parameters
- ❌ `batchParameters` state missing the parameters
- ❌ Request payload didn't include parameters
- **Result**: Feature appeared to work but did nothing

### Verification Step

**Always check Network tab in browser DevTools**:
```javascript
// POST request to /api/backtest/batch should include:
{
  "parameterRanges": {
    "symbols": [...],
    "newParameter": true  // ← Verify it's here!
  }
}
```

If missing → Check both update locations above.

## When to Use This Skill

Use this skill when:
- Adding new boolean parameters (flags)
- Adding numeric configuration parameters
- Adding any parameter that should work in all backtest modes
- User requests a new configurable option
- Implementing features that need multi-mode support

## G01 Compliance Checklist

Every parameter must be implemented in **all three modes**:
- ✅ Single Backtest Mode
- ✅ Portfolio Backtest Mode
- ✅ Batch Backtest Mode

## Required Components per Mode

### Backend Integration

**Files to modify**:
1. `backend/services/dcaBacktestService.js` (single mode)
2. `backend/services/portfolioBacktestService.js` (portfolio mode)
3. `backend/services/batchBacktestService.js` (batch mode)
4. `backend/services/dcaExecutor.js` (execution logic if needed)

**Changes**:
- Extract parameter from request with default value
- Pass parameter through to executor
- Include in response metadata
- Add to parameter combinations (batch mode)

### Frontend Integration

**Files to modify**:
1. `frontend/src/components/DCABacktestForm.js`
   - Add to default `parameters` state (single/portfolio)
   - Add to default `batchParameters` state (batch)
   - Add UI control (checkbox/input)
   - Add to request payload for all modes

**UI Section**:
Add controls to appropriate section (e.g., LongStrategySection for strategy params)

### URL Parameters (Single/Portfolio Only)

**Files to modify**:
1. `frontend/src/utils/URLParameterManager.js`

**Changes**:
- Add to `encodeParameters()` for URL generation
- Add to `decodeParameters()` for URL parsing
- Handle boolean/number conversions

### Configuration Defaults

**Files to modify**:
1. `config/backtestDefaults.json`

**Changes**:
Add default values for all strategy modes:
```json
{
  "LONG_DCA": {
    "newParameter": defaultValue
  },
  "SHORT_DCA": {
    "newParameter": defaultValue
  }
}
```

## Implementation Workflow

### Phase 1: Verification (1-2 hours)

1. **Check existing support**:
   ```bash
   grep -r "parameterName" backend/services/
   grep -r "parameterName" frontend/src/
   ```

2. **Document current state**:
   - What's already implemented?
   - What's missing?
   - Are there any partial implementations?

3. **Create verification findings** document

### Phase 2: Backend Implementation (1-3 hours)

1. **Single mode** (dcaBacktestService.js):
   ```javascript
   const { parameterName = defaultValue } = req.body;
   ```

2. **Portfolio mode** (portfolioBacktestService.js):
   ```javascript
   const { parameterName = defaultValue } = req.body;
   ```

3. **Batch mode** (batchBacktestService.js):
   ```javascript
   const { parameterName = defaultValue } = parameterRanges;
   // Add to parameter combinations
   ```

4. **Executor** (if execution logic needed):
   ```javascript
   function executeTrade({ parameterName, ... }) {
     if (parameterName) {
       // Custom logic
     }
   }
   ```

### Phase 3: Frontend State (1 hour)

**DCABacktestForm.js**:

1. **Default state** (single/portfolio):
   ```javascript
   const [parameters, setParameters] = useState({
     // ... existing params
     parameterName: defaultValue
   });
   ```

2. **Batch default state**:
   ```javascript
   const defaultParams = {
     // ... existing params
     parameterName: defaultValue
   };
   ```

### Phase 4: Frontend UI (1-2 hours)

Add UI controls:

**For boolean parameters**:
```jsx
<div className="form-group">
  <label>
    <input
      type="checkbox"
      checked={parameters.parameterName ?? false}
      onChange={(e) => handleChange('parameterName', e.target.checked)}
    />
    Parameter Label
  </label>
  <div className="help-text">
    Description of what this parameter does
  </div>
</div>
```

**For numeric parameters**:
```jsx
<div className="form-group">
  <label>Parameter Label</label>
  <input
    type="number"
    value={parameters.parameterName ?? defaultValue}
    onChange={(e) => handleChange('parameterName', parseFloat(e.target.value))}
    step="0.01"
  />
</div>
```

### Phase 5: API Request Payload (30 min)

**Single/Portfolio mode**:
```javascript
const requestData = {
  ...parameters,
  parameterName: parameters.parameterName
  // (may already be included via spread)
};
```

**Batch mode** (DCABacktestForm.js handleSubmit):
```javascript
const batchOptions = {
  parameterRanges: {
    // ... existing params
    parameterName: batchParameters.parameterName
  }
};
```

### Phase 6: URL Parameters (1-2 hours)

**URLParameterManager.js**:

**Encoding**:
```javascript
encodeParameters(params) {
  // ... existing encoding
  if (params.parameterName !== undefined) {
    searchParams.set('parameterName', params.parameterName.toString());
  }
}
```

**Decoding**:
```javascript
decodeParameters(searchParams) {
  // For boolean:
  parameterName: searchParams.get('parameterName') === 'true',

  // For number:
  parameterName: parseFloat(searchParams.get('parameterName') || defaultValue)
}
```

### Phase 7: Configuration Defaults (15 min)

**backtestDefaults.json**:
```json
{
  "LONG_DCA": {
    "parameterName": defaultValue
  },
  "SHORT_DCA": {
    "parameterName": defaultValue
  },
  "LONG_TRAILING": {
    "parameterName": defaultValue
  },
  "SHORT_TRAILING": {
    "parameterName": defaultValue
  }
}
```

### Phase 8: Testing (2-3 hours)

**Create test scripts**:

1. **Single mode test**:
   ```bash
   curl -X POST http://localhost:3001/api/backtest/dca \
     -H "Content-Type: application/json" \
     -d '{"symbol": "AAPL", "parameterName": testValue, ...}'
   ```

2. **Portfolio mode test**:
   ```bash
   curl -X POST http://localhost:3001/api/portfolio-backtest \
     -H "Content-Type: application/json" \
     -d '{"symbols": ["AAPL", "MSFT"], "parameterName": testValue, ...}'
   ```

3. **Batch mode test**:
   ```bash
   curl -X POST http://localhost:3001/api/backtest/batch \
     -H "Content-Type: application/json" \
     -d '{"parameterRanges": {"symbols": ["AAPL"], "parameterName": testValue, ...}}'
   ```

**Verify**:
- Parameter appears in response
- Behavior changes as expected
- All three modes work identically

### Phase 9: Documentation (2-3 hours)

1. **API documentation**: Create `/docs/api/parameter-name.md`
2. **User guide**: Create `/docs/guides/feature-name.md`
3. **Update G01**: Add lessons learned to G01 README

## Common Pitfalls

### ❌ Pitfall 1: Batch State Missing
**Problem**: Added to `parameters` but forgot `batchParameters`
**Solution**: Always add to BOTH states in DCABacktestForm.js

### ❌ Pitfall 2: Batch Request Missing
**Problem**: Added to state but not to batch request payload
**Solution**: Add to `parameterRanges` in handleSubmit batch section

### ❌ Pitfall 3: URL Encoding Missing
**Problem**: Parameter works but can't be shared via URL
**Solution**: Add to URLParameterManager encode/decode

### ❌ Pitfall 4: Wrong Default Value
**Problem**: Parameter defaults to wrong value in batch mode
**Solution**: Use same default across all modes

## Verification

After implementation, verify with this checklist:

```
Single Mode:
  ✅ Backend extracts parameter
  ✅ UI control exists
  ✅ State includes parameter
  ✅ Request sends parameter
  ✅ URL encodes/decodes parameter
  ✅ Config has default value

Portfolio Mode:
  ✅ Backend extracts parameter
  ✅ UI control exists (same form)
  ✅ State includes parameter
  ✅ Request sends parameter
  ✅ URL encodes/decodes parameter
  ✅ Config has default value

Batch Mode:
  ✅ Backend extracts parameter
  ✅ UI control exists (same form)
  ✅ Batch state includes parameter
  ✅ Batch request sends parameter
  ✅ N/A (batch doesn't use URLs)
  ✅ Config has default value
```

## Reference

- G01 Guidelines: `.kiro/specs/generic/G01_adding-new-parameter/README.md`
- Example Implementation: `.kiro/specs/45_momentum-based-trading/`
- Completion Example: `.kiro/specs/46_g01-momentum-parameters-completion/`
