# Percentage Conversion Comprehensive Fix

## Problem Analysis

### Current State (BROKEN)

The existing `percentage-conversion-standard.md` spec says "ALWAYS use DECIMALS internally and in API" but has critical gaps:

1. ❌ **URL parameters format NOT specified**
2. ❌ **Frontend form → API conversion NOT documented**
3. ❌ **Multiple violations throughout codebase**

### Actual Flow (As of 2025-10-07)

**[ISSUE-1]** Frontend Form Input Violation
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. FRONTEND FORM INPUT                                                      │
│    User enters: 10                                                          │
│    State stores: 10 (whole number)                                          │
│    ❌ VIOLATION: Should store 0.10 (decimal) per spec                       │
│    Reference: ISSUE-1                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**[ISSUE-2]** Frontend API Request Violation
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. FRONTEND → BACKEND API (Batch)                                          │
│    POST /api/backtest/batch                                                 │
│    Body: { parameterRanges: { profitRequirement: [10, 5] } }              │
│    ❌ VIOLATION: Should send [0.10, 0.05] (decimals) per spec              │
│    Reference: ISSUE-2                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**[ISSUE-3]** Backend Workaround (Compensating for ISSUE-2)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. BACKEND BATCH SERVICE (After Recent Fix)                                │
│    Receives: 10                                                             │
│    Converts: 10 / 100 = 0.10 ✓                                             │
│    Beta scaling: 0.10 × 2.595 = 0.2595 ✓                                   │
│    ⚠️  WORKAROUND: Backend compensates for ISSUE-2                          │
│    Reference: ISSUE-3                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**[ISSUE-4]** Backend URL Logging Bug
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. BACKEND URL LOGGING                                                      │
│    Has: params.gridIntervalPercent = 0.2595 (decimal)                      │
│    Logs: gridIntervalPercent=0.260 (toPercent multiplies by 100)           │
│    ❌ BUG: Should log 25.95 but logs 0.26 because toPercent receives       │
│           0.002595 instead of 0.2595 (gets divided by 100 somewhere)       │
│    Reference: ISSUE-4                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**[ISSUE-5]** URL Parsing Creates 100x Error
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. URL → FRONTEND PARSING                                                   │
│    URLParameterManager.parseSemanticURL()                                   │
│    Reads: gridIntervalPercent=0.260                                         │
│    Expects whole numbers, divides by 100: 0.260 / 100 = 0.0026            │
│    ❌ VIOLATION: Now 100x too small!                                        │
│    Reference: ISSUE-5                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Root Cause

**MISSING SPECIFICATION**: URL parameter format is undefined, causing incompatible assumptions:

- URLParameterManager assumes: **whole numbers** (10 = 10%)
- Backend URL logging uses: **decimals** (0.2595 = 25.95%)
- Frontend form uses: **whole numbers** (10 = 10%)
- Backend API expects: **decimals** (0.10 = 10%) per spec

## Requirements

### R1: Clarify URL Parameter Convention

**Decision**: URLs MUST use **WHOLE NUMBER PERCENTAGES** for human readability.

**Rationale**:
- URLs are user-facing and shareable
- `gridIntervalPercent=25.95` is more readable than `gridIntervalPercent=0.2595`
- Matches user mental model (people think in "25.95%" not "0.2595")
- Consistent with existing URLParameterManager implementation

**Examples**:
```
✅ CORRECT: gridIntervalPercent=25.95&profitRequirement=10
❌ WRONG:   gridIntervalPercent=0.2595&profitRequirement=0.10
```

### R2: Define ALL Conversion Points

#### [CP-1] User Input → Internal State
**ID**: CP-1
**Location**: Form components (DCABacktestForm.js, etc.)
**Input**: String "10" or "10%"
**Process**: Parse and keep as whole number
**Output**: Number 10
**Rule**: Store as whole numbers in form state for UX
**Example**: `parsePercentString("10%")` → `10`

#### [CP-2] Internal State → API Request
**ID**: CP-2
**Location**: Form onSubmit, URLParameterManager.navigateToResults()
**Input**: Number 10 (whole)
**Process**: Divide by 100
**Output**: Number 0.10 (decimal)
**Rule**: ALL API requests use decimals per spec
**Example**: `formState.gridInterval / 100` → `0.10`
**Fixes**: VIOLATION-1

#### [CP-3] API Response → Display
**ID**: CP-3
**Location**: Result components (BacktestResults.js, BatchResults.js)
**Input**: Number 0.2595 (decimal)
**Process**: Multiply by 100 and format
**Output**: String "25.95%"
**Rule**: Use formatParameterPercent() or formatPerformancePercent()
**Example**: `formatParameterPercent(0.2595)` → `"25.95%"`

#### [CP-4] URL Encoding (navigateToResults)
**ID**: CP-4
**Location**: URLParameterManager.encodeParametersToURL()
**Input**: Number 0.2595 (decimal from API or beta-scaled)
**Process**: Multiply by 100
**Output**: URL param `gridIntervalPercent=25.95`
**Rule**: URLs always use whole numbers
**Example**: `toPercent(0.2595)` → `25.95`

#### [CP-5] URL Decoding (parseSemanticURL)
**ID**: CP-5
**Location**: URLParameterManager.parseSemanticURL()
**Input**: URL param `gridIntervalPercent=25.95`
**Process**: Divide by 100
**Output**: Number 0.2595 (decimal)
**Rule**: Convert to decimals for internal use
**Example**: `parseFloat("25.95") / 100` → `0.2595`

#### [CP-6] Backend URL Logging
**ID**: CP-6
**Location**: batchBacktestService.js, server.js
**Input**: Number 0.2595 (decimal from beta scaling)
**Process**: Multiply by 100
**Output**: URL param `gridIntervalPercent=25.95`
**Rule**: Generate user-friendly URLs
**Example**: `toPercent(0.2595)` → `25.95`
**Fixes**: VIOLATION-3

### R3: Fix Current Violations

#### [VIOLATION-1] Frontend Form State (DCABacktestForm.js)
**Issue ID**: VIOLATION-1
**Related Issues**: ISSUE-2
**Current**: Stores whole numbers (10), sends whole numbers to API
**Required**: Stores whole numbers (10) ✓, converts to decimals (0.10) before API call
**Location**:
- `DCABacktestForm.js:686-702` (batch parameters)
- `DCABacktestForm.js:716-732` (single parameters)

#### [VIOLATION-2] Backend Batch Service (batchBacktestService.js)
**Issue ID**: VIOLATION-2
**Related Issues**: ISSUE-3
**Current**: Compensates for frontend sending whole numbers by dividing by 100
**Required**: Remove compensation - expect decimals from frontend
**Location**: `batchBacktestService.js:100-105`

#### [VIOLATION-3] Backend URL Logging (batchBacktestService.js)
**Issue ID**: VIOLATION-3
**Related Issues**: ISSUE-4
**Current**: URL shows decimals (0.2595) - likely incorrect calculation
**Required**: URL shows whole numbers (25.95)
**Location**: `batchBacktestService.js:464-478`

#### [VIOLATION-4] URLParameterManager JSON Parsing
**Issue ID**: VIOLATION-4
**Status**: ✅ Already Correct
**Current**: Converts JSON-encoded percentage arrays from whole to decimal
**Required**: Keep this conversion (URLs use whole numbers)
**Location**: `URLParameterManager.js:282-299` ✓ (already correct)

### R4: Add Missing Documentation

Update `percentage-conversion-standard.md` with:

1. **URL Parameters Section**
   - Convention: whole numbers
   - Encoding: decimal → whole (multiply by 100)
   - Decoding: whole → decimal (divide by 100)
   - Examples and anti-patterns

2. **Form State Management Section**
   - UX: whole numbers for user input
   - API: decimals for requests
   - Conversion timing and location

3. **Backend URL Generation Section**
   - When: logging individual test URLs
   - Format: whole numbers for readability
   - Utilities: use toPercent() consistently

4. **Complete Flow Diagram**
   - User input → Form state → API request → Backend processing → API response → Display
   - All conversion points clearly marked

## Success Criteria

1. ✅ User enters "10%" in form
2. ✅ Form stores 10 internally (UX)
3. ✅ Form sends 0.10 to API (spec compliance)
4. ✅ Backend receives 0.10, applies beta scaling → 0.2595
5. ✅ Backend logs URL with 25.95 (human readable)
6. ✅ URL param `gridIntervalPercent=25.95` can be copied and pasted
7. ✅ URLParameterManager parses 25.95 → 0.2595 for internal use
8. ✅ Display shows "25.95%" to user
9. ✅ No manual `* 100` or `/ 100` operations outside designated conversion points
10. ✅ All conversions use utility functions (toPercent, toDecimal)

## Non-Functional Requirements

- **Performance**: No performance impact (conversion is trivial)
- **Backward Compatibility**: Existing URLs continue to work
- **Testing**: All conversion points have unit tests
- **Documentation**: Complete flow documented in spec

## Related Files

- `.kiro/specs/percentage-conversion-standard.md` (existing spec to update)
- `frontend/src/components/DCABacktestForm.js` (form state → API)
- `frontend/src/utils/URLParameterManager.js` (URL ↔ internal state)
- `backend/services/batchBacktestService.js` (API input, URL logging)
- `backend/server.js` (single DCA endpoint)
- `frontend/src/utils/formatters.js` (display formatting)
- `backend/utils/percentageConverter.js` (utility functions)
- `frontend/src/utils/percentageUtils.js` (utility functions)

## Dependencies

- None (self-contained fix)

## Timeline Estimate

- Analysis and planning: 30 minutes ✓
- Implementation: 2-3 hours
- Testing: 1 hour
- Documentation update: 30 minutes
- **Total**: ~4 hours

## Risk Assessment

**Low Risk**:
- Well-defined conversion points
- Utility functions already exist
- Changes are localized
- Easy to test and verify

**Mitigation**:
- Test with multiple percentage values
- Verify URL copy-paste works
- Check both single and batch modes
- Confirm beta-scaled parameters display correctly

---

## Quick Reference Guide

### Issues Summary

| Issue ID | Description | Location | Status |
|----------|-------------|----------|--------|
| **ISSUE-1** | Frontend form stores whole numbers | `DCABacktestForm.js` state | ✅ Acceptable (UX layer) |
| **ISSUE-2** | Frontend sends whole numbers to API | `DCABacktestForm.js` onSubmit | ❌ Must fix (violates spec) |
| **ISSUE-3** | Backend compensates with /100 | `batchBacktestService.js:100-105` | ⚠️ Workaround (remove after ISSUE-2 fixed) |
| **ISSUE-4** | Backend logs wrong URL format | `batchBacktestService.js:464-478` | ❌ Must fix (shows 0.26 instead of 25.95) |
| **ISSUE-5** | URL parsing creates 100x error | `URLParameterManager.js` | ⚠️ Consequence of ISSUE-4 |

### Violations Summary

| Violation ID | Component | Current Behavior | Required Fix | Related Issues |
|--------------|-----------|------------------|--------------|----------------|
| **VIOLATION-1** | Frontend Form | Sends whole numbers to API | Convert to decimals before API | ISSUE-2 |
| **VIOLATION-2** | Backend Batch | Divides by 100 (workaround) | Remove division (expect decimals) | ISSUE-3 |
| **VIOLATION-3** | Backend Logging | Logs decimals in URL | Log whole numbers | ISSUE-4 |
| **VIOLATION-4** | URL Manager | Converts JSON arrays | ✅ Already correct | N/A |

### Conversion Points Summary

| CP ID | Conversion | Input Example | Output Example | Location | Status |
|-------|------------|---------------|----------------|----------|--------|
| **CP-1** | User Input → State | `"10%"` | `10` | Form input handlers | ✅ Correct |
| **CP-2** | State → API | `10` | `0.10` | Form onSubmit | ❌ Missing (VIOLATION-1) |
| **CP-3** | API → Display | `0.2595` | `"25.95%"` | Result components | ✅ Correct |
| **CP-4** | State → URL | `0.2595` | `25.95` | URL encoding | ✅ Correct |
| **CP-5** | URL → State | `25.95` | `0.2595` | URL decoding | ✅ Correct |
| **CP-6** | Backend → URL Log | `0.2595` | `25.95` | Backend logging | ❌ Broken (VIOLATION-3) |

### Data Flow Reference

```
User enters "10%"
    │
    ├─ [CP-1] → Form stores: 10 (whole) ✅
    │
    ├─ [CP-2] → API receives: 0.10 (decimal) ❌ VIOLATION-1
    │                          Currently: 10 (wrong!)
    │
    ├─ Backend processes: 0.10 → beta × 2.595 = 0.2595 ✅
    │                     Currently: 10 / 100 = 0.10 (workaround)
    │
    ├─ [CP-6] → Backend logs URL: 25.95 (whole) ❌ VIOLATION-3
    │                             Currently: 0.26 (100x too small!)
    │
    ├─ [CP-4] → Frontend URL: 25.95 (whole) ✅
    │
    ├─ [CP-5] → URL parsed: 0.2595 (decimal) ⚠️ Gets 0.0026 due to ISSUE-4
    │
    └─ [CP-3] → Display shows: "25.95%" ⚠️ Would show "0.26%" due to cascade
```

### Reporting Issues

When reporting bugs, use these references:

**Example**: "After clicking 'Run' from batch results, the URL shows `gridIntervalPercent=0.26` instead of `25.95` - this is **ISSUE-4** caused by **VIOLATION-3** at conversion point **CP-6**."

**Example**: "Frontend is sending whole numbers (10) instead of decimals (0.10) to the API - this is **ISSUE-2** and **VIOLATION-1** at conversion point **CP-2**."

### Fix Priority

1. **High Priority** (Breaking current functionality):
   - VIOLATION-1 (CP-2): Frontend → API conversion
   - VIOLATION-2 (ISSUE-3): Remove backend workaround
   - VIOLATION-3 (CP-6): Backend URL logging

2. **Medium Priority** (Spec compliance):
   - Document CP-1, CP-3, CP-4, CP-5 (already working)

3. **Low Priority** (Enhancement):
   - Add unit tests for all CPs
   - Add integration tests
