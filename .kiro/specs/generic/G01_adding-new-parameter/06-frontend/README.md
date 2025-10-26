# G04: Frontend UI Components

## Overview

This guide covers adding UI controls for new parameters in the frontend React application, ensuring users can configure them through the web interface.

## File Location

Primary File: `/Users/kweng/AI/DCA-Backtest-Tool/frontend/src/components/DCABacktestForm.js`

## Step 1: Understand the Form Structure

### 1.1: Component Architecture

The `DCABacktestForm.js` component is a class-based React component with:
- **State Management**: Parameters stored in `this.state.parameters`
- **Event Handlers**: `handleChange()` for updating parameters
- **Render Method**: JSX defining the form layout

### 1.2: Form Sections

The form is organized into logical sections:
```
├── Basic Parameters (symbol, dates, lot size)
├── Investment Parameters (maxLots, maxLotsToSell)
├── Grid Spacing
├── Profit Requirements
├── Trailing Stop Buy
├── Trailing Stop Sell
├── Advanced Features (checkboxes for optional features)
└── Execution Settings
```

## Step 2: Add Parameter to State

### 2.1: Initialize in State

Find the `constructor()` or initial state definition and add your parameter.

**Note**: For DCABacktestForm.js, state initialization happens in `loadParametersFromStorage()` or defaults.

**Example (Ensure parameter has default):**
```javascript
// In loadParametersFromStorage() or similar
const defaultParameters = {
  // ... existing defaults ...
  enableDynamicProfile: false,

  // Spec 45: Momentum-based trading
  momentumBasedBuy: false,           // NEW: Add default
  momentumBasedSell: false,          // NEW: Add default

  trailingStopOrderType: 'market'
};
```

**Line Reference**: Check parameter initialization around state setup or `componentDidMount()`.

## Step 3: Add UI Control

### 3.1: Choose Control Type

**Boolean Parameters** → Checkbox
**Numeric Parameters** → Number input
**Percentage Parameters** → Number input (with % label)
**String Parameters** → Text input or select dropdown

### 3.2: Add Checkbox (Boolean Parameters)

**Example (Momentum Mode Checkboxes):**
```jsx
{/* Spec 45: Momentum-Based Trading */}
<div className="form-group checkbox-group">
  <label>
    <input
      type="checkbox"
      checked={parameters.momentumBasedBuy ?? false}
      onChange={(e) => handleChange('momentumBasedBuy', e.target.checked)}
    />
    Enable Momentum-Based Buy (Spec 45)
  </label>
  <span className="form-help">
    Buy on strength: 0% activation (immediate consideration), P/L &gt; 0 required (except first buy), unlimited lots (capital-limited only). Overrides trailingBuyActivationPercent.
  </span>
</div>

<div className="form-group checkbox-group">
  <label>
    <input
      type="checkbox"
      checked={parameters.momentumBasedSell ?? false}
      onChange={(e) => handleChange('momentumBasedSell', e.target.checked)}
    />
    Enable Momentum-Based Sell (Spec 45)
  </label>
  <span className="form-help">
    Sell on weakness: 0% activation (immediate consideration), fast exit on momentum reversal. Overrides trailingSellActivationPercent. Still requires profitRequirement.
  </span>
</div>
```

**Key Elements:**
- `className="form-group checkbox-group"` - Consistent styling
- `checked={parameters.parameterName ?? false}` - Null coalescing for undefined values
- `onChange={(e) => handleChange('parameterName', e.target.checked)}` - Update state
- `<span className="form-help">` - Help text explaining the parameter

**Line Reference**: Add to appropriate section, for momentum mode it was around line 2107-2134.

### 3.3: Add Number Input (Numeric Parameters)

**Example (Max Lots):**
```jsx
<div className="form-group">
  <label>Max Retries:</label>
  <input
    type="number"
    min="0"
    max="100"
    step="1"
    value={parameters.maxRetries ?? 5}
    onChange={(e) => handleChange('maxRetries', parseInt(e.target.value))}
  />
  <span className="form-help">
    Maximum number of retry attempts (0-100)
  </span>
</div>
```

**Key Elements:**
- `type="number"` - Numeric input
- `min`, `max`, `step` - Validation constraints
- `parseInt(e.target.value)` - Convert string to number
- Null coalescing for default value

### 3.4: Add Percentage Input (Percentage Parameters)

**Example (Threshold Percent):**
```jsx
<div className="form-group">
  <label>Threshold Percent (%):</label>
  <input
    type="number"
    min="0"
    max="100"
    step="0.1"
    value={(parameters.thresholdPercent ?? 0.10) * 100}
    onChange={(e) => handleChange('thresholdPercent', parseFloat(e.target.value) / 100)}
  />
  <span className="form-help">
    Threshold percentage for triggering (0-100%)
  </span>
</div>
```

**Key Elements:**
- Display value: `value * 100` (decimal → percentage)
- Store value: `parseFloat(value) / 100` (percentage → decimal)
- `step="0.1"` for decimal percentages

### 3.5: Add Select Dropdown (String Parameters)

**Example (Order Type):**
```jsx
<div className="form-group">
  <label>Order Type:</label>
  <select
    value={parameters.orderType ?? 'market'}
    onChange={(e) => handleChange('orderType', e.target.value)}
  >
    <option value="market">Market</option>
    <option value="limit">Limit</option>
    <option value="stop">Stop</option>
  </select>
  <span className="form-help">
    Type of order to execute (market, limit, or stop)
  </span>
</div>
```

## Step 4: Placement and Organization

### 4.1: Find Appropriate Section

Place your UI control in a logical section:

**Example Sections:**
- **Basic Parameters**: Fundamental settings (symbol, dates)
- **Investment Parameters**: Money-related (lot size, max lots)
- **Strategy Parameters**: Core trading logic (grid, profit requirement)
- **Advanced Features**: Optional features (usually checkboxes)
- **Execution Settings**: Order types, stop modes

### 4.2: Group Related Parameters

**Good Practice:**
```jsx
{/* === Trailing Stop Buy === */}
<div className="form-group">
  <label>Trailing Buy Activation (%):</label>
  {/* ... */}
</div>
<div className="form-group">
  <label>Trailing Buy Rebound (%):</label>
  {/* ... */}
</div>

{/* === Spec 45: Momentum-Based Trading === */}
<div className="form-group checkbox-group">
  {/* Momentum Buy checkbox */}
</div>
<div className="form-group checkbox-group">
  {/* Momentum Sell checkbox */}
</div>
```

### 4.3: Add Section Comments

Use JSX comments to mark sections:
```jsx
{/* ============================================ */}
{/* Spec 45: Momentum-Based Trading             */}
{/* ============================================ */}
```

## Step 5: Handle State Changes

### 5.1: Use Existing handleChange Handler

The `handleChange` function should already exist:
```javascript
handleChange = (name, value) => {
  this.setState({
    parameters: {
      ...this.state.parameters,
      [name]: value
    }
  }, () => {
    // Optional: Save to localStorage
    this.saveParametersToStorage();

    // Optional: Update URL
    this.updateURL();
  });
};
```

**Usage:**
```jsx
onChange={(e) => handleChange('parameterName', e.target.value)}
onChange={(e) => handleChange('parameterName', e.target.checked)}  // for checkboxes
onChange={(e) => handleChange('parameterName', parseInt(e.target.value))}  // for numbers
```

### 5.2: Ensure Parameter Persists

Check that your parameter is included in:
1. **localStorage save** - `saveParametersToStorage()`
2. **localStorage load** - `loadParametersFromStorage()`
3. **URL encoding** - See G05 for URL parameter handling

## Step 6: Add Help Text

### 6.1: Write Clear Help Text

**Good Help Text:**
- Explains what the parameter does
- Mentions valid range or format
- Notes any side effects or overrides

**Example:**
```jsx
<span className="form-help">
  Buy on strength: 0% activation (immediate consideration), P/L &gt; 0 required (except first buy), unlimited lots (capital-limited only). Overrides trailingBuyActivationPercent.
</span>
```

### 6.2: HTML Entities in JSX

Use HTML entities for special characters:
- `&gt;` for `>`
- `&lt;` for `<`
- `&amp;` for `&`

## Step 7: Styling

### 7.1: Use Existing CSS Classes

Common classes in the project:
- `.form-group` - Standard form field wrapper
- `.checkbox-group` - Checkbox field wrapper
- `.form-help` - Help text styling

### 7.2: Follow Existing Patterns

**Match existing field structure:**
```jsx
<div className="form-group">
  <label>Label Text:</label>
  <input ... />
  <span className="form-help">Help text</span>
</div>
```

## Step 8: Portfolio and Batch Mode Support

### 8.1: IMPORTANT - Automatic Availability

**New parameters should automatically be available in:**
- Portfolio backtest configuration
- Batch mode backtest configuration

**Unless the parameter specifically doesn't make sense in those contexts.**

### 8.2: When to Exclude from Portfolio/Batch Mode

Exclude a parameter from portfolio/batch mode only if:
- It's portfolio-level only (e.g., `portfolioStopLossPercent`)
- It's batch-specific (e.g., `parallelExecutions`)
- It fundamentally conflicts with multi-symbol execution

### 8.3: Verification

After adding a parameter, verify it appears in:

**Portfolio Backtest Form:**
```
http://localhost:3000/backtest/portfolio
```

**Batch Mode Form:**
```
http://localhost:3000/batch
```

Check that:
- Parameter control is visible
- Parameter saves to state correctly
- Parameter appears in API requests
- Parameter works correctly across multiple symbols

## Frontend Implementation Checklist

- [ ] Added parameter to state initialization/defaults
- [ ] Added UI control (checkbox, input, select)
- [ ] Used correct control type for parameter type
- [ ] Added to appropriate form section
- [ ] Included descriptive label
- [ ] Added help text explaining parameter
- [ ] Used `handleChange` for state updates
- [ ] Applied proper type conversion (e.g., percentage decimal ↔ whole number)
- [ ] Ensured parameter persists to localStorage
- [ ] Followed existing styling patterns
- [ ] Tested UI control updates state correctly
- [ ] Verified parameter appears in portfolio backtest UI
- [ ] Verified parameter appears in batch mode UI
- [ ] Tested parameter works with multiple symbols (if applicable)

## Common Frontend Pitfalls

### Pitfall 1: Missing Null Coalescing
**Problem**: Form breaks when parameter is undefined

**Wrong:**
```jsx
<input
  type="checkbox"
  checked={parameters.momentumBasedBuy}  // Breaks if undefined
  ...
/>
```

**Correct:**
```jsx
<input
  type="checkbox"
  checked={parameters.momentumBasedBuy ?? false}  // Safe default
  ...
/>
```

### Pitfall 2: Wrong Type Conversion for Percentages
**Problem**: Percentage parameters stored incorrectly

**Wrong:**
```jsx
// Backend expects 0.10, but this stores 10
<input
  value={parameters.gridIntervalPercent}
  onChange={(e) => handleChange('gridIntervalPercent', parseFloat(e.target.value))}
/>
```

**Correct:**
```jsx
// Display as 10, store as 0.10
<input
  value={(parameters.gridIntervalPercent ?? 0.10) * 100}
  onChange={(e) => handleChange('gridIntervalPercent', parseFloat(e.target.value) / 100)}
/>
```

### Pitfall 3: Not Handling Undefined Values
**Problem**: Form shows NaN or empty when parameter missing

**Fix**: Always provide fallback with `??` operator
```jsx
value={parameters.maxLots ?? 10}  // Not just parameters.maxLots
```

### Pitfall 4: Missing Help Text
**Problem**: Users don't understand what parameter does

**Fix**: Always add `<span className="form-help">` with clear explanation

## Real-World Example

See momentum mode implementation in `DCABacktestForm.js` lines 2107-2134:

```jsx
{/* Spec 45: Momentum-Based Trading */}
<div className="form-group checkbox-group">
  <label>
    <input
      type="checkbox"
      checked={parameters.momentumBasedBuy ?? false}
      onChange={(e) => handleChange('momentumBasedBuy', e.target.checked)}
    />
    Enable Momentum-Based Buy (Spec 45)
  </label>
  <span className="form-help">
    Buy on strength: 0% activation (immediate consideration), P/L &gt; 0 required (except first buy), unlimited lots (capital-limited only). Overrides trailingBuyActivationPercent.
  </span>
</div>
```

This follows all best practices:
- ✅ Null coalescing for default
- ✅ Proper event handler
- ✅ Clear label with spec reference
- ✅ Detailed help text
- ✅ Consistent styling
