# Dynamic Grid Spacing - Design

## Architecture Overview

### Core Calculation Function

Location: `backend/services/shared/backtestUtilities.js`

```javascript
/**
 * Calculate dynamic grid spacing based on square root of price
 * @param {number} currentPrice - Current market price
 * @param {number} referencePrice - Reference price for normalization (e.g., first trade price)
 * @param {number} multiplier - Grid width multiplier (default 1.0 for ~10% at $100)
 * @param {boolean} normalizeToReference - Whether to normalize price to $100 reference
 * @returns {number} Grid spacing as decimal percentage
 */
function calculateDynamicGridSpacing(
  currentPrice,
  referencePrice,
  multiplier = 1.0,
  normalizeToReference = true
) {
  let effectivePrice = currentPrice;

  if (normalizeToReference && referencePrice > 0) {
    // Normalize: first trade ($referencePrice) becomes $100
    effectivePrice = (currentPrice / referencePrice) * 100;
  }

  // Square root grid: gridDollar = sqrt(effectivePrice) × multiplier
  const gridDollar = Math.sqrt(effectivePrice) * multiplier;

  // Return as percentage of current price
  return gridDollar / effectivePrice;
}
```

### Integration Points

## 1. DCA Backtest Service

**File**: `backend/services/dcaBacktestService.js`

**Changes**:

### A. Add parameters to function signature (line ~300)

```javascript
async function runDCABacktest({
  // ... existing parameters ...
  gridIntervalPercent,
  enableDynamicGrid = true,           // NEW
  normalizeToReference = true,        // NEW
  dynamicGridMultiplier = 1.0,        // NEW
  // ... rest of parameters ...
})
```

### B. Track reference price (after line 409)

```javascript
const initialPrice = pricesWithIndicators[0].adjusted_close;
let referencePrice = null; // Will be set on first trade
```

### C. Replace grid spacing validation (line 550)

```javascript
// OLD:
const respectsGridSpacing = lots.every(
  lot => Math.abs(currentPrice - lot.price) / lot.price >= gridIntervalPercent
);

// NEW:
const respectsGridSpacing = lots.every(lot => {
  // Calculate dynamic grid size at midpoint between current and lot price
  const midPrice = (currentPrice + lot.price) / 2;
  const ref = referencePrice || midPrice; // Use midPrice if no reference yet

  let gridSize;
  if (enableDynamicGrid) {
    gridSize = calculateDynamicGridSpacing(
      midPrice,
      ref,
      dynamicGridMultiplier,
      normalizeToReference
    );
  } else {
    gridSize = gridIntervalPercent; // Legacy fixed percentage
  }

  return Math.abs(currentPrice - lot.price) / lot.price >= gridSize;
});
```

### D. Set reference price on first buy (line ~554, after buy execution)

```javascript
lots.push({ price: currentPrice, shares: shares, date: currentDate });

// Set reference price on first trade
if (referencePrice === null) {
  referencePrice = currentPrice;
  if (verbose && enableDynamicGrid && normalizeToReference) {
    console.log(`📍 Reference price set to ${referencePrice.toFixed(2)} (normalized to $100)`);
  }
}

averageCost = recalculateAverageCost();
```

## 2. Short DCA Backtest Service

**File**: `backend/services/shortDCABacktestService.js`

Apply identical changes as DCA service (same line numbers, same logic for shorts).

## 3. Configuration Defaults

**File**: `config/backtestDefaults.json`

```json
{
  "gridIntervalPercent": 0.1,
  "enableDynamicGrid": true,
  "normalizeToReference": true,
  "dynamicGridMultiplier": 1.0
}
```

## 4. Validation

**File**: `backend/middleware/validation.js`

Add validation rules:

```javascript
const backtestParamsSchema = Joi.object({
  // ... existing fields ...
  gridIntervalPercent: Joi.number().min(0.01).max(1.0).optional(),
  enableDynamicGrid: Joi.boolean().optional(),
  normalizeToReference: Joi.boolean().optional(),
  dynamicGridMultiplier: Joi.number().min(0.1).max(5.0).optional(),
  // ... rest of fields ...
});
```

## 5. Frontend Form

**File**: `frontend/src/components/DCABacktestForm.js`

Add new form section after grid interval input:

```jsx
{
  /* Dynamic Grid Spacing Controls */
}
<div className="form-section">
  <h3>Grid Spacing Mode</h3>

  <div className="form-group">
    <label>
      <input
        type="checkbox"
        checked={formData.enableDynamicGrid}
        onChange={e => setFormData({ ...formData, enableDynamicGrid: e.target.checked })}
      />
      Enable Dynamic Grid Spacing
      <span className="help-text">Square root-based grid that adapts to price level</span>
    </label>
  </div>

  {formData.enableDynamicGrid && (
    <>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={formData.normalizeToReference}
            onChange={e => setFormData({ ...formData, normalizeToReference: e.target.checked })}
          />
          Normalize to Reference Price
          <span className="help-text">Treat first trade as $100 for consistent grid behavior</span>
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="dynamicGridMultiplier">
          Grid Multiplier: {formData.dynamicGridMultiplier?.toFixed(1) || '1.0'}
        </label>
        <input
          type="range"
          id="dynamicGridMultiplier"
          min="0.5"
          max="2.0"
          step="0.1"
          value={formData.dynamicGridMultiplier || 1.0}
          onChange={e =>
            setFormData({ ...formData, dynamicGridMultiplier: parseFloat(e.target.value) })
          }
        />
        <span className="help-text">1.0 = ~10% at reference, higher = wider grids</span>
      </div>
    </>
  )}

  {!formData.enableDynamicGrid && (
    <div className="form-group">
      <label htmlFor="gridIntervalPercent">
        Fixed Grid Interval: {((formData.gridIntervalPercent || 0.1) * 100).toFixed(1)}%
      </label>
      <input
        type="range"
        id="gridIntervalPercent"
        min="0.01"
        max="0.50"
        step="0.01"
        value={formData.gridIntervalPercent || 0.1}
        onChange={e =>
          setFormData({ ...formData, gridIntervalPercent: parseFloat(e.target.value) })
        }
      />
    </div>
  )}
</div>;
```

## 6. Results Display

**File**: `frontend/src/components/BacktestResults.js`

Add grid mode indicator:

```jsx
<div className="parameter-info">
  <h3>Grid Spacing Configuration</h3>
  <div className="param-grid">
    <div className="param-item">
      <span className="param-label">Mode:</span>
      <span className="param-value">
        {data.parameters?.enableDynamicGrid ? 'Dynamic (Square Root)' : 'Fixed Percentage'}
      </span>
    </div>
    {data.parameters?.enableDynamicGrid && (
      <>
        <div className="param-item">
          <span className="param-label">Normalization:</span>
          <span className="param-value">
            {data.parameters?.normalizeToReference ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div className="param-item">
          <span className="param-label">Multiplier:</span>
          <span className="param-value">
            {data.parameters?.dynamicGridMultiplier?.toFixed(1) || '1.0'}
          </span>
        </div>
      </>
    )}
    {!data.parameters?.enableDynamicGrid && (
      <div className="param-item">
        <span className="param-label">Grid Size:</span>
        <span className="param-value">
          {((data.parameters?.gridIntervalPercent || 0.1) * 100).toFixed(1)}%
        </span>
      </div>
    )}
  </div>
</div>
```

## Data Flow

```
User Input (Form)
    ↓
URL Parameters (optional)
    ↓
Backend API (/api/backtest/dca)
    ↓
DCA Backtest Service
    ↓
For each price point:
    ├─ Check if buy conditions met
    ├─ If yes: Calculate grid spacing
    │   ├─ Get reference price (first trade)
    │   ├─ Normalize if enabled
    │   ├─ Calculate sqrt-based grid
    │   └─ Validate against existing lots
    └─ Execute trade if spacing OK
    ↓
Results (with grid config included)
    ↓
Frontend Display
```

## Backward Compatibility

- **Default behavior**: Dynamic grid with normalization (new users get best experience)
- **Existing backtests**: Can be re-run with `enableDynamicGrid=false` to reproduce exact results
- **URL parameters**: Old URLs without new params default to dynamic grid
- **Batch optimization**: Works with all three modes

## Testing Strategy

1. **Unit tests**: Test `calculateDynamicGridSpacing()` with various inputs
2. **Integration tests**: Run backtests in all three modes, verify grid spacing
3. **Comparison tests**: Same stock, same parameters, compare fixed vs dynamic
4. **Normalization tests**: Verify $15 stock and $1500 stock behave identically when normalized
5. **Batch tests**: Ensure batch optimization respects grid mode

## Performance Considerations

- **Calculation overhead**: Minimal (one sqrt() per grid check)
- **Memory overhead**: One extra float per backtest (referencePrice)
- **No breaking changes**: All existing APIs continue to work
