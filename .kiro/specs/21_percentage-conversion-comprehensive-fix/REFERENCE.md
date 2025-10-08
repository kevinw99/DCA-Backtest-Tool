# Percentage Conversion - Quick Reference

This document provides numbered references for all percentage conversion issues and fixes.

## 🚨 Current Issues

| ID | Description | Impact | Priority |
|----|-------------|--------|----------|
| **ISSUE-1** | Form stores whole numbers (10) | ✅ OK - UX layer | Low |
| **ISSUE-2** | Frontend sends whole numbers to API (10 instead of 0.10) | ❌ Spec violation | **HIGH** |
| **ISSUE-3** | Backend divides by 100 to compensate | ⚠️ Workaround | **HIGH** |
| **ISSUE-4** | Backend logs `0.26` instead of `25.95` in URLs | ❌ URLs broken | **HIGH** |
| **ISSUE-5** | URL parsing gets 100x smaller values | ⚠️ Cascade error | **HIGH** |
| **ISSUE-6** | Single DCA endpoint beta scaling has /100 workaround | ✅ Fixed | **HIGH** |
| **ISSUE-7** | runDCABacktest call has /100 conversion | ✅ Fixed (server.js:917-923) | **HIGH** |

## 🔧 Violations to Fix

| ID | Location | What's Wrong | How to Fix |
|----|----------|--------------|------------|
| **VIOLATION-1** | `DCABacktestForm.js:686-702`<br>`DCABacktestForm.js:716-732` | Sends whole numbers to API | ✅ Fixed - Add `/ 100` before API call |
| **VIOLATION-2** | `batchBacktestService.js:100-105` | Unnecessary `/100` division | ✅ Fixed - Remove division |
| **VIOLATION-3** | `batchBacktestService.js:464-478` | URL logging shows decimals | ✅ Fixed - Fix `toPercent()` calculation |
| **VIOLATION-4** | `URLParameterManager.js:282-299` | ✅ Already correct | No fix needed |
| **VIOLATION-5** | `server.js:709-717` (beta scaling `/100`)<br>`server.js:720-729` (beta scaling `*100`)<br>`server.js:1050-1062` (short DCA `/100`) | Beta scaling double conversion | ✅ Fixed - Removed all `/100` and `*100` |
| **VIOLATION-6** | `server.js:917-923` | runDCABacktest call divides by 100 | ✅ Fixed - Removed `/100` divisions |

## 📍 Conversion Points

| ID | Name | Input | Output | Status |
|----|------|-------|--------|--------|
| **CP-1** | User Input → State | `"10%"` | `10` | ✅ Working |
| **CP-2** | State → API | `10` | `0.10` | ❌ **Missing** |
| **CP-3** | API → Display | `0.2595` | `"25.95%"` | ✅ Working |
| **CP-4** | State → URL | `0.2595` | `25.95` | ✅ Working |
| **CP-5** | URL → State | `25.95` | `0.2595` | ✅ Working |
| **CP-6** | Backend → URL Log | `0.2595` | `25.95` | ❌ **Broken** |

## 📊 Visual Data Flow

### Current (Broken)
```
User: "10%"
  ↓ [CP-1] ✅
Form: 10
  ↓ [CP-2] ❌ MISSING CONVERSION!
API Request: 10 (should be 0.10)
  ↓ [ISSUE-3] ⚠️ Backend workaround
Backend: 10 / 100 = 0.10
  ↓ Beta scaling
Backend: 0.10 × 2.595 = 0.2595
  ↓ [CP-6] ❌ BROKEN!
URL Log: gridIntervalPercent=0.260 (should be 25.95)
  ↓ [CP-5]
Parsed: 0.26 / 100 = 0.0026 (100x too small!)
  ↓ [CP-3]
Display: "0.26%" ❌ WRONG!
```

### After Fix (Working)
```
User: "10%"
  ↓ [CP-1] ✅
Form: 10
  ↓ [CP-2] ✅ FIX: Add / 100
API Request: 0.10 ✓
  ↓ Backend processing (no workaround needed)
Backend: 0.10 × 2.595 = 0.2595
  ↓ [CP-6] ✅ FIX: Correct toPercent()
URL Log: gridIntervalPercent=25.95 ✓
  ↓ [CP-5] ✅
Parsed: 25.95 / 100 = 0.2595 ✓
  ↓ [CP-3] ✅
Display: "25.95%" ✓
```

## 🎯 Fix Sequence

**CRITICAL ORDER** (must follow exactly):

1. **Fix VIOLATION-1** (Frontend → API conversion)
   - File: `DCABacktestForm.js`
   - Change: Add `/ 100` before sending to API
   - Tests: Frontend sends decimals

2. **Fix VIOLATION-2** (Remove backend workaround)
   - File: `batchBacktestService.js:100-105`
   - Change: Remove `/ 100` division
   - Tests: Backend receives decimals directly

3. **Fix VIOLATION-3** (Backend URL logging)
   - File: `batchBacktestService.js:464-478`
   - Change: Fix toPercent() calculation
   - Tests: URLs show whole numbers (25.95 not 0.26)

**⚠️ DO NOT** fix VIOLATION-2 before VIOLATION-1 - this will break batch tests!

## 📝 How to Report Issues

Use these numbered references when reporting bugs:

**Template**:
```
Issue: [Brief description]
Reference: ISSUE-X, VIOLATION-Y, CP-Z
Location: [File:line]
Expected: [What should happen]
Actual: [What currently happens]
```

**Example 1**:
```
Issue: Backend logs show wrong URL parameter
Reference: ISSUE-4, VIOLATION-3, CP-6
Location: batchBacktestService.js:470
Expected: gridIntervalPercent=25.95
Actual: gridIntervalPercent=0.260
```

**Example 2**:
```
Issue: Frontend sending wrong format to API
Reference: ISSUE-2, VIOLATION-1, CP-2
Location: DCABacktestForm.js:690
Expected: API receives profitRequirement: 0.10
Actual: API receives profitRequirement: 10
```

## 🔍 Testing Checklist

After implementing fixes, verify:

- [ ] **CP-1**: Form stores whole numbers (10) ✓
- [ ] **CP-2**: API receives decimals (0.10) - **MUST FIX**
- [ ] **CP-3**: Display shows percentages ("25.95%") ✓
- [ ] **CP-4**: URLs encode whole numbers (25.95) ✓
- [ ] **CP-5**: URLs decode to decimals (0.2595) ✓
- [ ] **CP-6**: Backend logs whole numbers (25.95) - **MUST FIX**

### Test Case: Beta Scaling (PLTR, coefficient=1)

**Input**: User enters 10% for grid interval
**Expected Flow**:
1. Form stores: `10`
2. API sends: `0.10`
3. Backend receives: `0.10`
4. Beta scaling: `0.10 × 2.595 = 0.2595`
5. URL logs: `gridIntervalPercent=25.95`
6. URL parses: `0.2595`
7. Display shows: `"25.95%"`

**Current (Broken) Flow**:
1. Form stores: `10` ✓
2. API sends: `10` ❌ VIOLATION-1
3. Backend receives: `10`, divides by 100 → `0.10` ⚠️ ISSUE-3
4. Beta scaling: `0.10 × 2.595 = 0.2595` ✓
5. URL logs: `gridIntervalPercent=0.260` ❌ VIOLATION-3
6. URL parses: `0.0026` ❌ ISSUE-5
7. Display shows: `"0.26%"` ❌

## 📚 Related Documents

- **requirements.md**: Complete problem analysis and requirements
- **design.md**: Architectural decisions and design rationale
- **tasks.md**: Step-by-step implementation tasks
- **percentage-conversion-standard.md**: Original spec (needs update)

## 🆘 Need Help?

1. Check this REFERENCE.md for quick lookup
2. See requirements.md for detailed analysis
3. See design.md for architectural context
4. See tasks.md for implementation steps

---

**Last Updated**: 2025-10-07
**Status**: Spec created, implementation pending
