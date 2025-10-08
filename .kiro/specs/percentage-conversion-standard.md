# Percentage Conversion Standard

**Date**: 2025-09-30
**Status**: IMPLEMENTED
**Version**: 1.0

---

## Problem Statement

The codebase had inconsistent percentage/decimal conversions leading to display bugs where values appeared 100x smaller or larger than expected (e.g., "2.24%" instead of "224%").

### Root Causes:

1. **Mixed formats**: Some code used percentages (224), others used decimals (2.24)
2. **Double conversion**: Values divided by 100 twice or multiplied by 100 twice
3. **No standard**: Each service/component made its own assumptions
4. **Poor documentation**: Format expectations unclear

---

## Standard Convention

### ✅ **ALWAYS use DECIMALS internally and in API responses**

| Representation | Decimal Format | Percentage Format |
| -------------- | -------------- | ----------------- |
| 5%             | `0.05` ✅      | `5` ❌            |
| 100%           | `1.0` ✅       | `100` ❌          |
| 224%           | `2.24` ✅      | `224` ❌          |
| -15.5%         | `-0.155` ✅    | `-15.5` ❌        |

### Rules:

1. **Backend Services**: Return decimals

   ```javascript
   {
     totalReturn: 2.24,        // ✅ Decimal (224%)
     annualizedReturn: 0.36,   // ✅ Decimal (36%)
     winRate: 0.60             // ✅ Decimal (60%)
   }
   ```

2. **API Responses**: Use decimals

   ```json
   {
     "totalReturnPercent": 2.24,
     "annualizedReturnPercent": 0.36,
     "winRate": 0.6
   }
   ```

3. **Display/Formatting**: Convert decimals to percentages for users

   ```javascript
   formatPerformancePercent(2.24); // Returns "224.00%"
   formatPerformancePercent(0.36); // Returns "36.00%"
   ```

4. **User Input**: Convert percentage input to decimals for storage
   ```javascript
   parsePercentString('10%'); // Returns 0.10
   parsePercentString('224%'); // Returns 2.24
   ```

---

## Utilities Provided

### Backend: `/backend/utils/percentageConverter.js`

```javascript
const { toPercent, toDecimal, formatAsPercent } = require('./utils/percentageConverter');

// Convert decimal to percentage number
toPercent(0.05); // Returns 5
toPercent(2.24); // Returns 224

// Convert percentage to decimal number
toDecimal(5); // Returns 0.05
toDecimal(224); // Returns 2.24

// Format decimal as percentage string
formatAsPercent(0.0567); // Returns "5.67%"
formatAsPercent(2.24, 1); // Returns "224.0%"
```

**Full API:**

- `toPercent(decimal)` - Convert decimal to percentage number
- `toDecimal(percent)` - Convert percentage to decimal number
- `formatAsPercent(decimal, decimals)` - Format decimal as percentage string
- `parsePercent(string)` - Parse "5%" to 0.05
- `isDecimal(value)` - Check if value is in decimal format
- `ensureDecimal(value)` - Auto-convert to decimal if needed
- `createPercentageObject(decimal)` - Create debug object
- `convertLegacyPercentages(data, keys)` - Convert old percentage data

### Frontend: `/frontend/src/utils/percentageUtils.js`

```javascript
import { toPercent, toDecimal, formatPercent } from './utils/percentageUtils';

// Convert decimal to percentage number
toPercent(0.05); // Returns 5
toPercent(2.24); // Returns 224

// Format with options
formatPercent(0.0567, 2, true); // Returns "+5.67%"
formatPercent(2.24, 1, false); // Returns "224.0%"

// Parse user input
parsePercentString('10%'); // Returns 0.10
parsePercentString('+5.67%'); // Returns 0.0567
```

**Full API:**

- `toPercent(decimal)` - Convert decimal to percentage number
- `toDecimal(percent)` - Convert percentage to decimal number
- `formatPercent(decimal, decimals, showSign)` - Format with options
- `formatParameterPercent(decimal)` - Format strategy parameters
- `formatPerformancePercent(decimal)` - Format backtest results
- `parsePercentString(string)` - Parse user input
- `isDecimalFormat(value)` - Check if decimal format
- `ensureDecimal(value)` - Auto-convert if needed
- `isValidPercentage(decimal, min, max)` - Validate range

---

## Migration Guide

### Step 1: Identify Current Format

```javascript
// Check if your value is decimal or percentage
const value = 224;
if (isDecimal(value)) {
  // It's already decimal (unlikely for 224)
} else {
  // It's a percentage, convert it
  const decimal = toDecimal(value); // Returns 2.24
}
```

### Step 2: Update Backend Services

**Before (inconsistent):**

```javascript
// Some services return percentages
return {
  totalReturnPercent: 224, // ❌ Percentage
  winRate: 60, // ❌ Percentage
};
```

**After (standardized):**

```javascript
const { toDecimal } = require('./utils/percentageConverter');

return {
  totalReturnPercent: toDecimal(224), // ✅ 2.24 (decimal)
  winRate: toDecimal(60), // ✅ 0.60 (decimal)
};
```

### Step 3: Update Frontend Display

**Before (incorrect):**

```javascript
// Assuming value is already a percentage
<span>{value.toFixed(2)}%</span> // Shows "2.24%" for decimal 2.24
```

**After (correct):**

```javascript
import { formatPerformancePercent } from './utils/percentageUtils';

<span>{formatPerformancePercent(value)}</span>; // Shows "224.00%" for decimal 2.24
```

### Step 4: Update Form Inputs

**Before:**

```javascript
// Direct percentage value
onChange={(e) => setGridInterval(e.target.value)}  // Stores "10"
```

**After:**

```javascript
import { parsePercentString } from './utils/percentageUtils';

// Convert to decimal for storage/API
onChange={(e) => {
  const decimal = parsePercentString(e.target.value);
  setGridInterval(decimal);  // Stores 0.10
}}
```

---

## Common Patterns

### Pattern 1: Display API Response

```javascript
// API returns: { totalReturn: 2.24 }
import { formatPerformancePercent } from './utils/percentageUtils';

<div>Total Return: {formatPerformancePercent(data.totalReturn)}</div>;
// Displays: "Total Return: 224.00%"
```

### Pattern 2: Send User Input to API

```javascript
import { parsePercentString } from './utils/percentageUtils';

const handleSubmit = () => {
  const decimal = parsePercentString(inputValue); // "10%" -> 0.10
  api.post('/backtest', { gridInterval: decimal });
};
```

### Pattern 3: Debug Percentage Values

```javascript
import { createPercentageDebugInfo } from './utils/percentageUtils';

console.log(createPercentageDebugInfo(2.24));
// {
//   decimal: 2.24,
//   percent: 224,
//   formatted: "224.00%",
//   isDecimal: true
// }
```

### Pattern 4: Legacy Data Migration

```javascript
const { convertLegacyPercentages } = require('./utils/percentageConverter');

const legacy = {
  totalReturnPercent: 224,
  winRate: 60,
  otherField: 'unchanged',
};

const updated = convertLegacyPercentages(legacy, ['totalReturnPercent', 'winRate']);
// {
//   totalReturnPercent: 2.24,
//   winRate: 0.60,
//   otherField: 'unchanged'
// }
```

---

## Testing

### Backend Tests

```bash
npm test -- percentageConverter.test.js
# 34 tests, all passing
```

### Frontend Tests

```bash
npm test -- percentageUtils.test.js
# Tests cover all conversion scenarios
```

---

## Checklist for New Code

When adding percentage-related code, verify:

- [ ] API responses use decimals (0.05, not 5)
- [ ] Display uses `formatPerformancePercent()` or `formatParameterPercent()`
- [ ] User input parsed with `parsePercentString()`
- [ ] No manual `* 100` or `/ 100` operations
- [ ] Documentation states format expectations
- [ ] Tests verify correct conversions

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Double Conversion

```javascript
// Backend sends decimal: 2.24
const percent = value / 100; // Now 0.0224 ❌
return `${percent}%`; // Shows "0.02%" ❌
```

**✅ Correct:**

```javascript
// Backend sends decimal: 2.24
return formatPerformancePercent(value); // Shows "224.00%" ✅
```

### ❌ Mistake 2: Assuming Format

```javascript
// Unknown if value is decimal or percentage
return `${value}%`; // Could be "2.24%" or "224%" ❌
```

**✅ Correct:**

```javascript
// Ensure decimal first
const decimal = ensureDecimal(value);
return formatPerformancePercent(decimal); // Always correct ✅
```

### ❌ Mistake 3: Mixed Formats in Same Object

```javascript
// ❌ Inconsistent
{
  totalReturn: 2.24,      // Decimal
  winRate: 60            // Percentage
}
```

**✅ Correct:**

```javascript
// ✅ All decimals
{
  totalReturn: 2.24,     // Decimal (224%)
  winRate: 0.60          // Decimal (60%)
}
```

---

## Files Updated

### New Files Created:

1. `/backend/utils/percentageConverter.js` - Backend utilities
2. `/backend/utils/__tests__/percentageConverter.test.js` - Backend tests (34 tests)
3. `/frontend/src/utils/percentageUtils.js` - Frontend utilities
4. This documentation file

### Modified Files:

1. `/frontend/src/utils/formatters.js` - Added standard imports and docs
2. `/frontend/src/utils/__tests__/formatters.test.js` - Updated tests

---

## Quick Reference

| Task             | Backend                             | Frontend                                     |
| ---------------- | ----------------------------------- | -------------------------------------------- |
| Decimal → String | `formatAsPercent(0.05)` → `"5.00%"` | `formatPerformancePercent(0.05)` → `"5.00%"` |
| String → Decimal | `parsePercent("5%")` → `0.05`       | `parsePercentString("5%")` → `0.05`          |
| Decimal → Number | `toPercent(0.05)` → `5`             | `toPercent(0.05)` → `5`                      |
| Number → Decimal | `toDecimal(5)` → `0.05`             | `toDecimal(5)` → `0.05`                      |
| Check Format     | `isDecimal(value)`                  | `isDecimalFormat(value)`                     |
| Auto-convert     | `ensureDecimal(value)`              | `ensureDecimal(value)`                       |

---

## Support

For questions or issues with percentage conversions:

1. Check this documentation first
2. Review utility function JSDoc comments
3. Look at test files for usage examples
4. Verify API response format with browser DevTools

---

---

## URL Parameters and Form State (Added 2025-10-08)

### URL Parameter Convention

**URLs MUST use WHOLE NUMBER PERCENTAGES for human readability:**

| Internal (Decimal) | URL Parameter | Display |
| ------------------ | ------------- | ------- |
| `0.10` | `gridIntervalPercent=10` | `"10%"` |
| `0.2595` | `profitRequirement=25.95` | `"25.95%"` |
| `0.05` | `trailingBuyReboundPercent=5` | `"5%"` |

**Rationale:**
- URLs are user-facing and shareable
- `gridIntervalPercent=25.95` is more readable than `gridIntervalPercent=0.2595`
- Matches user mental model (people think in "25.95%" not "0.2595")

**Examples:**
```
✅ CORRECT: /backtest/long/PLTR?gridIntervalPercent=10&profitRequirement=5
❌ WRONG:   /backtest/long/PLTR?gridIntervalPercent=0.10&profitRequirement=0.05
```

### Form State Convention

**Forms SHOULD store WHOLE NUMBERS for better UX:**

```javascript
// Form state stores whole numbers
const [gridInterval, setGridInterval] = useState(10); // 10% stored as 10

// Convert to decimals when sending to API
const apiParams = {
  gridIntervalPercent: gridInterval / 100 // 10 → 0.10
};
```

**Rationale:**
- Input shows "10", state stores 10 - no mental mapping needed
- Easier to validate ranges (0-100 vs 0-1)
- No conversion needed to display in input field

---

## Complete Data Flow

### All Conversion Points

```
┌─────────────┐  CP-1   ┌─────────────┐  CP-2   ┌─────────────┐
│ User Input  │────────▶│  Form State │────────▶│ API Request │
│   "10%"     │ parse   │     10      │ /100    │    0.10     │
│  (String)   │         │  (Whole)    │         │  (Decimal)  │
└─────────────┘         └─────────────┘         └─────────────┘
                                                        │
                                                        ▼
      ┌─────────────┐         ┌─────────────┐  ┌─────────────┐
      │   Display   │◀────────│ URL Params  │◀─│   Backend   │
      │  "25.95%"   │  CP-3   │    25.95    │  │   0.2595    │
      │  (String)   │  *100   │  (Whole)    │  │  (Decimal)  │
      └─────────────┘         └─────────────┘  └─────────────┘
           ▲                         ▲               │
           │                         │ CP-6          │
           └─────────────────────────┴───────────────┘
                              CP-4, CP-5
                              Backend URL logging
```

**CP-1: User Input → Form State**
- Input: String `"10%"` or `"10"`
- Process: Parse and keep as whole number
- Output: Number `10`
- Location: Form input handlers

**CP-2: Form State → API Request**
- Input: Number `10` (whole)
- Process: Divide by 100
- Output: Number `0.10` (decimal)
- Location: Form onSubmit handlers
- **Fixed in**: `DCABacktestForm.js`

**CP-3: API Response → Display**
- Input: Number `0.2595` (decimal)
- Process: Multiply by 100 and format
- Output: String `"25.95%"`
- Location: Result components
- Uses: `formatParameterPercent()` or `formatPerformancePercent()`

**CP-4: Form State → URL Encoding**
- Input: Number `0.2595` (decimal from API or beta-scaled)
- Process: Multiply by 100
- Output: URL param `gridIntervalPercent=25.95`
- Location: `URLParameterManager.encodeParametersToURL()`

**CP-5: URL Decoding → Internal State**
- Input: URL param `gridIntervalPercent=25.95`
- Process: Divide by 100
- Output: Number `0.2595` (decimal)
- Location: `URLParameterManager.parseSemanticURL()`

**CP-6: Backend → URL Logging**
- Input: Number `0.2595` (decimal from beta scaling)
- Process: Multiply by 100
- Output: URL param `gridIntervalPercent=25.95`
- Location: Backend URL logging (batch/single endpoints)
- **Fixed in**: `batchBacktestService.js`

---

## Fixed Violations (2025-10-08)

### Summary of Issues Found and Fixed

| Violation | Location | Issue | Fix |
|-----------|----------|-------|-----|
| **VIOLATION-1** | `DCABacktestForm.js:686-702` | Sent whole numbers to API | ✅ Added `/100` conversion |
| **VIOLATION-2** | `batchBacktestService.js:100-105` | Backend compensated with `/100` | ✅ Removed workaround |
| **VIOLATION-3** | `batchBacktestService.js:464-478` | URL logging showed decimals | ✅ Fixed `toPercent()` |
| **VIOLATION-4** | `URLParameterManager.js:282-299` | ✅ Already correct | No fix needed |
| **VIOLATION-5** | `server.js:709-729, 1050-1062` | Beta scaling double conversion | ✅ Removed `/100` and `*100` |
| **VIOLATION-6** | `server.js:917-923` | runDCABacktest call divided by 100 | ✅ Removed `/100` |

### Complete Fix Log

**Issue Chain:**
1. Frontend sent whole numbers (10) instead of decimals (0.10) to API
2. Backend compensated with `/100` division
3. Beta scaling had additional `/100` and `*100` conversions
4. runDCABacktest call had another `/100` division
5. Result: Values were 100x too small in transactions

**Root Cause:**
Missing specification for:
- URL parameter format (whole vs decimal)
- Form state format (whole vs decimal)
- Boundary conversions between components

**Solution:**
- Defined URL format: whole numbers for readability
- Defined form format: whole numbers for UX
- Added explicit conversions at all 6 boundaries
- Removed all compensating workarounds

---

## Batch URL Readability (Added 2025-10-08)

### Readable Batch URLs

Batch URLs now use flat query strings instead of JSON encoding:

**Before (unreadable):**
```
/batch/PLTR/results?parameterRanges=%7B%22symbols%22%3A%5B%22PLTR%22%5D...
```

**After (readable):**
```
/batch/PLTR/results?symbols=PLTR&coefficients=1,0.5&profitRequirement=10&gridIntervalPercent=10&trailingBuyActivationPercent=10,5...
```

**Implementation:**
- Arrays encoded as comma-separated values: `coefficients=1,0.5`
- Percentages as whole numbers: `profitRequirement=10` (for 10%)
- Location: `URLParameterManager.generateSemanticURL()`

---

**Last Updated**: 2025-10-08
**Maintained By**: Development Team
**Related Specs**:

- Phase 1-3 Refactoring Completion
- Batch Results Display Fix
- `.kiro/specs/21_percentage-conversion-comprehensive-fix/` - Complete fix documentation
