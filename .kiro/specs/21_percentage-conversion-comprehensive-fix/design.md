# Design: Percentage Conversion Comprehensive Fix

## Overview

This design document establishes a **single source of truth** for percentage conversion throughout the application, eliminating the current inconsistencies between form state, API requests, URLs, and display.

## Core Principle

**Decimals Everywhere, Convert at Boundaries**

The existing spec says "ALWAYS use DECIMALS internally and in API responses" but fails to specify URL and form handling. This design completes the standard by defining ALL conversion boundaries.

## Data Flow Architecture

### The Four Boundaries

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   User      │    │    Form     │    │     API     │    │   Backend   │
│   Input     │───▶│    State    │───▶│   Request   │───▶│  Processing │
│  "10%"      │    │   10        │    │   0.10      │    │   0.2595    │
│  (String)   │    │  (Whole)    │    │ (Decimal)   │    │  (Decimal)  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      ▲                                                          │
      │                                                          │
      │            ┌─────────────┐    ┌─────────────┐          │
      │            │   Display   │◀───│  URL Params │◀─────────┘
      │            │  "25.95%"   │    │   25.95     │
      │            │  (String)   │    │  (Whole)    │
      └────────────└─────────────┘    └─────────────┘
```

### Boundary 1: User Input → Form State
**Format Change**: String → Whole Number
**Location**: Form input handlers
**Logic**: Parse string, keep as whole number for UX
**Example**: `"10%"` → `10`

### Boundary 2: Form State → API Request
**Format Change**: Whole Number → Decimal
**Location**: Form onSubmit handlers
**Logic**: Divide by 100
**Example**: `10` → `0.10`

### Boundary 3: Backend Processing → URL Parameters
**Format Change**: Decimal → Whole Number
**Location**: Backend URL logging, frontend URL encoding
**Logic**: Multiply by 100
**Example**: `0.2595` → `25.95`

### Boundary 4: URL Parameters → Internal State
**Format Change**: Whole Number → Decimal
**Location**: URLParameterManager.parseSemanticURL()
**Logic**: Divide by 100
**Example**: `25.95` → `0.2595`

### Boundary 5: Internal State → Display
**Format Change**: Decimal → Percentage String
**Location**: Result components
**Logic**: Multiply by 100, add "%"
**Example**: `0.2595` → `"25.95%"`

## Design Decisions

### Decision 1: URL Format

**Question**: Should URLs use decimals (0.2595) or whole numbers (25.95)?

**Decision**: **Whole numbers**

**Rationale**:
1. **Human Readability**: Users think in "25.95%" not "0.2595"
2. **Shareability**: URLs are copied and shared - should be intuitive
3. **Consistency**: Matches existing URLParameterManager implementation
4. **User Mental Model**: "The URL shows the percentages I entered"

**Alternatives Considered**:
- ❌ Decimals in URL: Technically pure but confusing for users
- ❌ Strings with "%": Would require URL encoding, messy

### Decision 2: Form State Format

**Question**: Should form state store decimals (0.10) or whole numbers (10)?

**Decision**: **Whole numbers**

**Rationale**:
1. **UX Simplicity**: Input shows "10", state stores 10 - no mental mapping
2. **Validation**: Easier to validate ranges (0-100 vs 0-1)
3. **Display**: No conversion needed to show in input field
4. **User Expectation**: Form inputs work with natural numbers

**Alternatives Considered**:
- ❌ Decimals in state: Requires conversion for every input/display, confusing

### Decision 3: API Format

**Question**: Should API use decimals or percentages?

**Decision**: **Decimals** (per existing spec)

**Rationale**:
1. **Consistency**: Existing spec mandates decimals
2. **Backend Processing**: Algorithms work with decimals (0.05 = 5%)
3. **Mathematical Operations**: Easier to multiply/divide decimals
4. **Industry Standard**: Most APIs use decimal format for percentages

**This is NOT changing** - spec already correct, just adding conversions.

### Decision 4: Conversion Timing

**Question**: When should conversion happen?

**Decision**: **At boundaries, using explicit functions**

**Rationale**:
1. **Clear Responsibility**: Each boundary has one conversion point
2. **No Surprises**: No hidden conversions in the middle of logic
3. **Testable**: Each conversion point can be unit tested
4. **Debuggable**: Easy to add logging at boundaries

**Implementation**:
```javascript
// ✅ EXPLICIT - conversion at boundary
const apiParams = {
  gridIntervalPercent: formState.gridInterval / 100
};

// ❌ IMPLICIT - hidden conversion
const apiParams = {
  gridIntervalPercent: processParameter(formState.gridInterval)
};
```

## Component Responsibilities

### Frontend Form (DCABacktestForm.js)

**Responsibilities**:
1. Store whole numbers in state (UX layer)
2. Convert to decimals before API call (boundary)
3. Handle both single and batch parameter conversion

**Key Methods**:
```javascript
// Batch parameter conversion
const convertPercentageArray = (arr) => arr.map(val => val / 100);

// Single parameter conversion
const convertedParams = {
  ...params,
  gridIntervalPercent: params.gridIntervalPercent / 100,
  profitRequirement: params.profitRequirement / 100,
  // ... all percentage parameters
};
```

**Dependencies**:
- None (vanilla JavaScript conversion)

### URLParameterManager

**Responsibilities**:
1. Encode decimals to whole numbers for URLs
2. Decode whole numbers from URLs to decimals
3. Handle both single values and arrays
4. Support JSON-encoded parameter ranges

**Key Methods**:
```javascript
// Encoding (decimal → whole)
_encodeDecimalArrayAsPercentage(decimalArray) {
  return decimalArray.map(d => d * 100).join(',');
}

// Decoding (whole → decimal)
_decodePercentageArray(str) {
  return str.split(',').map(s => parseFloat(s) / 100);
}
```

**Dependencies**:
- None (self-contained)

### Backend Batch Service (batchBacktestService.js)

**Responsibilities**:
1. Accept decimals from API (no conversion)
2. Pass decimals to beta scaling service
3. Log whole number URLs for debugging
4. Return decimals in results

**Key Changes**:
```javascript
// BEFORE (WORKAROUND):
const baseParams = {
  profitRequirement: profit / 100  // Compensate for frontend bug
};

// AFTER (CORRECT):
const baseParams = {
  profitRequirement: profit  // Frontend sends decimals per spec
};

// URL Logging (decimal → whole):
const toPercent = (decimal) => (decimal * 100).toFixed(3);
const url = `gridIntervalPercent=${toPercent(params.gridIntervalPercent)}`;
```

**Dependencies**:
- parameterCorrelationService (receives decimals)
- dcaBacktestService (receives decimals)

### Backend Single DCA Service (server.js)

**Responsibilities**:
1. Accept decimals from API
2. Convert to decimals for beta scaling (already doing this)
3. Log whole number URLs for debugging (NEW)

**Key Addition**:
```javascript
// Add URL logging similar to batch service
const toPercent = (decimal) => (decimal * 100).toFixed(3);
console.log(`🌐 Equivalent Frontend URL: ...&gridIntervalPercent=${toPercent(finalParams.gridIntervalPercent)}...`);
```

**Dependencies**:
- parameterCorrelationService (receives decimals)
- dcaBacktestService (receives decimals)

## Migration Strategy

### Phase 1: Documentation (No Code Changes)
- Update spec with URL and form conventions
- Add flow diagrams
- Document all conversion boundaries

**Risk**: None
**Rollback**: N/A

### Phase 2: Frontend Conversion (Breaking Change)
- Fix DCABacktestForm to convert whole → decimal
- Apply to both single and batch modes

**Risk**: Backend expects whole numbers (current workaround)
**Mitigation**: Coordinate with Phase 3
**Rollback**: Revert DCABacktestForm.js

### Phase 3: Backend Workaround Removal (Breaking Change)
- Remove `/100` division in batch service
- Backend now expects decimals per spec

**Risk**: Must happen AFTER Phase 2
**Mitigation**: Test extensively before deployment
**Rollback**: Restore `/100` division

### Phase 4: URL Logging (Non-Breaking)
- Fix backend URL logging to show whole numbers
- Add URL logging to single DCA endpoint

**Risk**: None (logging only)
**Rollback**: Revert logging changes

### Phase 5: Verification & Testing
- Confirm URLParameterManager correct (no changes needed)
- Comprehensive testing
- Documentation updates

**Risk**: Low
**Rollback**: N/A

## Testing Strategy

### Unit Tests

**Frontend**:
```javascript
// URLParameterManager.percentages.test.js
describe('Percentage Conversions', () => {
  test('encodes decimals to whole numbers', () => {
    const params = { gridIntervalPercent: [0.2595, 0.1298] };
    const encoded = URLParameterManager.encodeParametersToURL(params);
    expect(encoded).toContain('gridIntervalPercent=25.95,12.98');
  });

  test('decodes whole numbers to decimals', () => {
    const url = '?gridIntervalPercent=25.95,12.98';
    const decoded = URLParameterManager.decodeParametersFromURL(url);
    expect(decoded.gridIntervalPercent).toEqual([0.2595, 0.1298]);
  });

  test('round-trip preserves values', () => {
    const original = { gridIntervalPercent: [0.2595] };
    const encoded = URLParameterManager.encodeParametersToURL(original);
    const decoded = URLParameterManager.decodeParametersFromURL(encoded);
    expect(decoded.gridIntervalPercent[0]).toBeCloseTo(0.2595, 4);
  });
});
```

**Backend**:
```javascript
// percentageConverter.test.js (already exists)
// Verify toPercent() and toDecimal() functions work correctly
```

### Integration Tests

**Manual Test Procedure**:

1. **Form Input Test**:
   - Enter "10" in grid interval field
   - Verify state stores `10`
   - Submit form
   - Verify API receives `0.10`

2. **Backend URL Test**:
   - Run batch test with beta scaling
   - Check terminal logs show `gridIntervalPercent=25.95`
   - NOT `gridIntervalPercent=0.2595`

3. **URL Copy-Paste Test**:
   - Copy URL from backend logs
   - Paste into browser
   - Verify correct parameters loaded
   - Verify same results reproduced

4. **Round-Trip Test**:
   - Enter parameters in form → Submit
   - Get result URL → Copy
   - Paste URL → Load page
   - Verify same parameters displayed

### Edge Cases

1. **Zero values**: `0` → `0.0` → `0`
2. **Negative values**: `-10` → `-0.10` → `-10`
3. **Large values**: `1000` → `10.0` → `1000`
4. **Decimal values**: `25.95` → `0.2595` → `25.95`
5. **Very small values**: `0.01` → `0.0001` → `0.01`

## Error Handling

### Invalid Conversions

**Problem**: User enters non-numeric value
**Solution**: Form validation rejects invalid input
**Fallback**: Default to 0 or previous valid value

**Problem**: URL contains malformed percentage
**Solution**: URLParameterManager filters `NaN` values
**Fallback**: Use default parameter values

**Problem**: API receives unexpected format
**Solution**: Backend validation middleware checks format
**Fallback**: Return 400 error with helpful message

### Precision Loss

**Problem**: Floating point errors in conversion
**Solution**:
- Use `toFixed(3)` for display (3 decimal places)
- Accept small differences in round-trip tests (`toBeCloseTo`)
- Don't rely on exact equality

**Example**:
```javascript
// May have tiny floating point error
const value = 25.95 / 100 * 100; // Could be 25.950000000000003

// Solution: Use fixed precision
const display = value.toFixed(3); // "25.950"

// Solution: Use tolerance in tests
expect(value).toBeCloseTo(25.95, 2); // Within 0.01
```

## Performance Considerations

**Conversion Overhead**: Negligible
- Simple arithmetic operations (×100, ÷100)
- No complex calculations
- No I/O or network calls

**Memory Impact**: None
- No additional data structures
- In-place conversions
- No caching needed

**Optimization**: Not required
- Conversion is already O(1) for single values
- O(n) for arrays (unavoidable)

## Security Considerations

**Input Validation**:
- Validate numeric ranges in form
- Validate format in API middleware
- Sanitize URL parameters

**Injection Prevention**:
- No string concatenation for URLs
- Use template literals or URL constructors
- Encode special characters properly

**Example**:
```javascript
// ❌ VULNERABLE - string concatenation
const url = `/api/backtest?param=` + userInput;

// ✅ SAFE - proper encoding
const params = new URLSearchParams({ param: userInput });
const url = `/api/backtest?${params}`;
```

## Backward Compatibility

**Existing URLs**: Continue to work
- URLParameterManager already expects whole numbers
- No format change in URLs
- Old URLs parse correctly

**Existing API Calls**: May break if sending whole numbers
- Current workaround: backend divides by 100
- After fix: backend expects decimals
- **Migration needed**: Update all API clients

**Database**: No impact
- No stored percentage data format
- All data is transient (request/response)

## Documentation Requirements

### Code Comments

**Critical Points**:
```javascript
// Frontend Form
// Convert whole numbers to decimals for API (10 → 0.10)
const apiParams = { gridIntervalPercent: formState.gridInterval / 100 };

// Backend URL Logging
// Convert decimals to whole numbers for URL (0.2595 → 25.95)
const urlParam = toPercent(params.gridIntervalPercent);

// URLParameterManager Decoding
// Convert whole numbers from URL to decimals (25.95 → 0.2595)
return parseFloat(urlParam) / 100;
```

### JSDoc Annotations

```javascript
/**
 * Convert form state to API parameters
 * @param {Object} formState - Form state with whole number percentages
 * @returns {Object} API parameters with decimal percentages
 * @example
 * // Form state: { gridInterval: 10 }
 * // API params: { gridIntervalPercent: 0.10 }
 */
function convertToAPIParams(formState) {
  return {
    gridIntervalPercent: formState.gridInterval / 100
  };
}
```

### User Documentation

**Help Text**:
```
Grid Interval: Enter as percentage (e.g., 10 for 10%)
The system will automatically convert for processing.
```

**URL Sharing**:
```
You can copy and share URLs from the browser address bar or backend logs.
All parameters are shown as percentages for readability.
```

## Success Criteria

**Functional**:
- [ ] URLs show whole number percentages (25.95 not 0.2595)
- [ ] Frontend sends decimals to API (0.10 not 10)
- [ ] Backend receives decimals correctly
- [ ] URLParameterManager handles all formats
- [ ] Copy-paste URLs work correctly

**Non-Functional**:
- [ ] Zero breaking changes to existing URLs
- [ ] No performance degradation
- [ ] Complete documentation
- [ ] All tests passing
- [ ] Code comments accurate

**Quality**:
- [ ] No manual `* 100` or `/ 100` outside conversion boundaries
- [ ] Consistent use of utility functions
- [ ] Clear separation of concerns
- [ ] Testable and debuggable

## Future Enhancements

**Potential Improvements**:
1. Type-safe conversion functions (TypeScript)
2. Centralized conversion service
3. Automatic format detection
4. Conversion telemetry/monitoring

**Out of Scope** (for this spec):
- Changing decimal standard (keep decimals per existing spec)
- Refactoring all percentage handling to new service
- Migrating stored data formats
- Adding new percentage input components
