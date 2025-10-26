# G01/07: Unified Parameter Handling - Avoid Duplicate Code

## Purpose

This guide explains the MOST IMPORTANT principle when adding new parameters: **do not create ad-hoc code just for the new parameter**. Instead, ensure it is handled in all relevant places where existing parameters are handled, using the same code paths and patterns.

## The Golden Rule

**When adding a new parameter, find where similar existing parameters are handled and follow the EXACT same pattern.**

Don't create:
- ❌ Special functions just for this parameter
- ❌ Separate code paths that bypass existing systems
- ❌ Duplicate logic that already exists for other parameters
- ❌ Custom handling that doesn't match existing patterns

Instead:
- ✅ Add to existing parameter lists
- ✅ Extend existing functions with your parameter
- ✅ Use the same helper functions other parameters use
- ✅ Follow the same data flow as existing parameters

## Why This Matters

### Problem: Ad-Hoc Code Creates Technical Debt

**Bad Example** (creates duplicate code):
```javascript
// In dcaExecutor.js
async function runDCABacktest({
  gridIntervalPercent = 0.10,
  profitRequirement = 0.10,
  // ... existing parameters ...
}) {
  // Existing parameter handling
  const results = await processStandardBacktest({
    gridIntervalPercent,
    profitRequirement,
    ...
  });

  // NEW PARAMETER - WRONG APPROACH: Creating separate code path
  if (newSpecialParameter !== undefined) {
    const specialResults = await processSpecialBacktest(newSpecialParameter);
    return mergeResults(results, specialResults); // Duplicate logic!
  }

  return results;
}
```

**Problems with this approach**:
1. Creates two separate execution paths (standard vs special)
2. Duplicates result processing logic
3. Makes code harder to maintain (must update two places)
4. Breaks existing testing patterns
5. Harder for future developers to understand

### Solution: Unified Handling

**Good Example** (integrates into existing flow):
```javascript
// In dcaExecutor.js
async function runDCABacktest({
  gridIntervalPercent = 0.10,
  profitRequirement = 0.10,

  // NEW PARAMETER - RIGHT APPROACH: Added to existing parameter list
  newParameter = defaultValue,  // Same pattern as existing params

  // ... other parameters ...
}) {
  // Single, unified execution path handles ALL parameters
  const results = await processBacktest({
    gridIntervalPercent,
    profitRequirement,
    newParameter,  // Treated exactly like other parameters
    ...
  });

  return results;  // Same return path for all parameters
}
```

**Benefits of this approach**:
1. Single execution path (easier to maintain)
2. No duplicate logic
3. Existing tests automatically cover new parameter
4. Clear, consistent code structure
5. Future developers can easily add more parameters

## Reference Design Pattern

### Step 1: Study Existing Parameters First

Before writing any code, **trace an existing parameter through the entire codebase**.

#### Example: Tracing `trailingBuyReboundPercent`

1. **Backend - dcaExecutor.js**:
   ```javascript
   async function runDCABacktest({
     // ... parameters ...
     trailingBuyReboundPercent = 0.05,  // ← Defined here
     // ... parameters ...
   }) {
     // ... daily loop ...
     if (price >= trailingBuyStopPrice) {
       // ← Used in buy logic
       executeBuy();
     }
   }
   ```

2. **Backend - dcaBacktestService.js**:
   ```javascript
   async function runDCABacktest({
     trailingBuyReboundPercent = 0.05,  // ← Extracted from request
   }) {
     const executorResults = await dcaExecutor.runDCABacktest({
       trailingBuyReboundPercent,  // ← Passed to executor
     });
   }
   ```

3. **Backend - server.js**:
   ```javascript
   const results = await dcaBacktestService.runDCABacktest({
     trailingBuyReboundPercent: finalParams.trailingBuyReboundPercent,  // ← Passed from API
   });
   ```

4. **Configuration - backtestDefaults.json**:
   ```json
   {
     "longStrategy": {
       "trailingBuyReboundPercent": 0.05  // ← Default value
     }
   }
   ```

5. **Frontend - DCABacktestForm.js**:
   ```jsx
   <input
     type="number"
     value={(parameters.trailingBuyReboundPercent ?? 0.05) * 100}  // ← UI control
     onChange={(e) => handleChange('trailingBuyReboundPercent', parseFloat(e.target.value) / 100)}
   />
   ```

6. **Frontend - URLParameterManager.js**:
   ```javascript
   // Encoding
   if (parameters.trailingBuyReboundPercent !== undefined) {
     params.set('trailingBuyReboundPercent',
       this._formatDecimalAsPercentage(parameters.trailingBuyReboundPercent).toString());
   }

   // Decoding
   if (params.trailingBuyReboundPercent !== undefined) {
     decoded.trailingBuyReboundPercent =
       this._parsePercentageAsDecimal(params.trailingBuyReboundPercent, 5);
   }
   ```

### Step 2: Apply the Same Pattern to Your Parameter

Now that you've traced `trailingBuyReboundPercent`, apply the EXACT same pattern to your new parameter.

**Example: Adding `myNewParameter`**

1. **Backend - dcaExecutor.js** (same file, same location):
   ```javascript
   async function runDCABacktest({
     // ... parameters ...
     trailingBuyReboundPercent = 0.05,
     myNewParameter = defaultValue,  // ← Add right next to similar parameter
     // ... parameters ...
   }) {
     // ... daily loop ...
     if (myNewParameter > threshold) {  // ← Use in logic (same style)
       executeAction();
     }
   }
   ```

2. **Backend - dcaBacktestService.js** (same file, same location):
   ```javascript
   async function runDCABacktest({
     trailingBuyReboundPercent = 0.05,
     myNewParameter = defaultValue,  // ← Extract (same pattern)
   }) {
     const executorResults = await dcaExecutor.runDCABacktest({
       trailingBuyReboundPercent,
       myNewParameter,  // ← Pass (same pattern)
     });
   }
   ```

3. **Backend - server.js** (same file, same location):
   ```javascript
   const results = await dcaBacktestService.runDCABacktest({
     trailingBuyReboundPercent: finalParams.trailingBuyReboundPercent,
     myNewParameter: finalParams.myNewParameter,  // ← Pass (same pattern)
   });
   ```

4. **Configuration - backtestDefaults.json** (same file, grouped with similar params):
   ```json
   {
     "longStrategy": {
       "trailingBuyReboundPercent": 0.05,
       "myNewParameter": defaultValue  // ← Default (same pattern)
     }
   }
   ```

5. **Frontend - DCABacktestForm.js** (same file, same section):
   ```jsx
   <input
     type="number"
     value={(parameters.myNewParameter ?? defaultValue) * 100}  // ← UI (same pattern)
     onChange={(e) => handleChange('myNewParameter', parseFloat(e.target.value) / 100)}
   />
   ```

6. **Frontend - URLParameterManager.js** (same file, same methods):
   ```javascript
   // Encoding (in _encodeSingleParameters method, next to similar parameters)
   if (parameters.myNewParameter !== undefined) {
     params.set('myNewParameter',
       this._formatDecimalAsPercentage(parameters.myNewParameter).toString());
   }

   // Decoding (in _decodeSingleParameters method, next to similar parameters)
   if (params.myNewParameter !== undefined) {
     decoded.myNewParameter =
       this._parsePercentageAsDecimal(params.myNewParameter, defaultValue);
   }
   ```

## Common Patterns to Follow

### Pattern 1: Parameter Extraction (Destructuring)

**Existing Pattern**:
```javascript
async function runDCABacktest({
  gridIntervalPercent = 0.10,
  profitRequirement = 0.10,
  trailingBuyActivationPercent = 0.10,
}) {
  // Function body
}
```

**Follow This Pattern**:
```javascript
async function runDCABacktest({
  gridIntervalPercent = 0.10,
  profitRequirement = 0.10,
  trailingBuyActivationPercent = 0.10,
  yourNewParameter = defaultValue,  // ← Same destructuring pattern
}) {
  // Function body
}
```

### Pattern 2: Parameter Passing

**Existing Pattern**:
```javascript
const results = await dcaExecutor.runDCABacktest({
  symbol,
  priceData,
  gridIntervalPercent,
  profitRequirement,
  // ... more parameters ...
});
```

**Follow This Pattern**:
```javascript
const results = await dcaExecutor.runDCABacktest({
  symbol,
  priceData,
  gridIntervalPercent,
  profitRequirement,
  yourNewParameter,  // ← Same passing pattern
  // ... more parameters ...
});
```

### Pattern 3: Configuration Grouping

**Existing Pattern** (backtestDefaults.json):
```json
{
  "longStrategy": {
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05
  }
}
```

**Follow This Pattern**:
```json
{
  "longStrategy": {
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "yourNewParameter": defaultValue  // ← Grouped with related params
  }
}
```

### Pattern 4: UI Control Structure

**Existing Pattern**:
```jsx
<div className="form-group">
  <label>Grid Interval (%):</label>
  <input
    type="number"
    value={(parameters.gridIntervalPercent ?? 0.10) * 100}
    onChange={(e) => handleChange('gridIntervalPercent', parseFloat(e.target.value) / 100)}
  />
  <span className="form-help">Percentage drop to trigger buy orders</span>
</div>
```

**Follow This Pattern**:
```jsx
<div className="form-group">
  <label>Your New Parameter (%):</label>
  <input
    type="number"
    value={(parameters.yourNewParameter ?? defaultValue) * 100}  // ← Same structure
    onChange={(e) => handleChange('yourNewParameter', parseFloat(e.target.value) / 100)}
  />
  <span className="form-help">Your parameter description here</span>
</div>
```

### Pattern 5: URL Parameter Handling

**Existing Pattern** (_encodeSingleParameters):
```javascript
if (parameters.gridIntervalPercent !== undefined) {
  params.set('gridIntervalPercent',
    this._formatDecimalAsPercentage(parameters.gridIntervalPercent).toString());
}
if (parameters.profitRequirement !== undefined) {
  params.set('profitRequirement',
    this._formatDecimalAsPercentage(parameters.profitRequirement).toString());
}
```

**Follow This Pattern**:
```javascript
if (parameters.gridIntervalPercent !== undefined) {
  params.set('gridIntervalPercent',
    this._formatDecimalAsPercentage(parameters.gridIntervalPercent).toString());
}
if (parameters.profitRequirement !== undefined) {
  params.set('profitRequirement',
    this._formatDecimalAsPercentage(parameters.profitRequirement).toString());
}
if (parameters.yourNewParameter !== undefined) {
  params.set('yourNewParameter',
    this._formatDecimalAsPercentage(parameters.yourNewParameter).toString());  // ← Same helper function
}
```

## Opportunities to Refactor

### When You Notice Duplicate Logic

If you find yourself writing similar code to existing parameter handling but slightly different, **this is a sign to refactor**.

**Example: Multiple Parameters with Same Validation**

**Before (Duplicate Code)**:
```javascript
// Existing parameter validation
if (gridIntervalPercent < 0 || gridIntervalPercent > 1) {
  throw new Error('gridIntervalPercent must be between 0 and 1');
}

if (profitRequirement < 0 || profitRequirement > 1) {
  throw new Error('profitRequirement must be between 0 and 1');
}

// Your new parameter - DON'T DUPLICATE!
if (yourNewParameter < 0 || yourNewParameter > 1) {
  throw new Error('yourNewParameter must be between 0 and 1');
}
```

**After (Unified Validation)**:
```javascript
// Refactor to unified validation function
function validatePercentage(value, paramName) {
  if (value < 0 || value > 1) {
    throw new Error(`${paramName} must be between 0 and 1`);
  }
}

// Use unified function for all percentage parameters
validatePercentage(gridIntervalPercent, 'gridIntervalPercent');
validatePercentage(profitRequirement, 'profitRequirement');
validatePercentage(yourNewParameter, 'yourNewParameter');  // ← Same function!
```

**Benefits**:
1. Single source of truth for validation logic
2. Easier to update validation rules (one place)
3. Consistent error messages
4. Less code to maintain

### When to Consider Refactoring

Consider refactoring if:
1. **Adding your parameter requires copying existing code** - Extract common logic into shared functions
2. **You see 3+ similar parameter patterns** - Create a helper function or pattern
3. **Parameter handling differs only by parameter name** - Generalize the handling
4. **You're writing the same conversion logic** - Use existing helper functions

## Real-World Example: Portfolio Backtest URL Handling

### Problem Discovered in Spec 45

When adding `momentumBasedBuy` and `momentumBasedSell` parameters, we discovered that:
- Single backtest uses `URLParameterManager` (automatic, unified handling)
- **Portfolio backtest uses manual URL parameter handling** (each parameter manually added)

This is a case where portfolio page has NOT unified with single backtest URL handling.

### The Current (Non-Unified) Approach

**PortfolioBacktestPage.js requires 3 manual steps**:

1. **Add to default state** (~line 57):
   ```javascript
   momentumBasedBuy: false,
   momentumBasedSell: false
   ```

2. **Add to URL decoding** (~line 125):
   ```javascript
   momentumBasedBuy: searchParams.get('momentumBasedBuy') === 'true',
   momentumBasedSell: searchParams.get('momentumBasedSell') === 'true'
   ```

3. **Add to URL encoding** (~line 200):
   ```javascript
   params.set('momentumBasedBuy', parameters.defaultParams.momentumBasedBuy || false);
   params.set('momentumBasedSell', parameters.defaultParams.momentumBasedSell || false);
   ```

### Lesson Learned

**This is NOT ideal** because:
- Must remember to update 3 places for each parameter
- Different from single backtest (uses URLParameterManager)
- Easy to forget one location (as happened with momentum parameters)

**Future Refactoring Opportunity**:
- Make portfolio page use URLParameterManager too
- Then new parameters automatically work (unified handling)

**For Now**:
- Document this difference clearly
- Always check all 3 locations when adding parameters to portfolio

## Checklist: Ensuring Unified Handling

Before considering your parameter implementation complete, verify:

- [ ] **Backend Functions**: Parameter added to existing function signatures (not new functions)
- [ ] **Backend Calls**: Parameter passed using same pattern as existing params
- [ ] **Configuration**: Parameter added to same config file sections as similar params
- [ ] **Frontend Forms**: Parameter control added to same form sections as similar controls
- [ ] **URL Encoding**: Parameter encoded using same helper functions as similar params
- [ ] **URL Decoding**: Parameter decoded using same helper functions as similar params
- [ ] **No Duplicate Code**: No logic copied from existing parameters (refactored to shared functions if needed)
- [ ] **Same Code Paths**: Parameter flows through same execution paths as existing parameters
- [ ] **Consistent Patterns**: All usage follows existing patterns exactly

## Summary

The key to successful parameter implementation is **mimicry, not innovation**.

✅ **DO**:
- Study existing parameters thoroughly
- Follow existing patterns exactly
- Use existing helper functions
- Add to existing code paths
- Refactor duplicates to shared functions

❌ **DON'T**:
- Create special handling for your parameter
- Duplicate existing logic
- Create new code paths
- Invent new patterns
- Bypass existing systems

**Remember**: If you find yourself writing more than a few lines of "new" code for a parameter, you're probably doing it wrong. Most parameter additions should be simple additions to existing patterns, not creation of new patterns.
