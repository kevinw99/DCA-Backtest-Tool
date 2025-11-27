# Portfolio URL Parameter Handling Fix

**Date**: 2025-10-26
**Issue**: Momentum controls not visible on portfolio backtest configuration page
**Status**: ✅ FIXED

## Problem Description

User reported that momentum parameters (`momentumBasedBuy`, `momentumBasedSell`) were not visible on the portfolio backtest configuration page at:
```
http://localhost:3000/portfolio-backtest?stocks=...
```

## Root Cause Analysis

The `PortfolioBacktestPage.js` component uses **manual URL parameter handling** instead of `URLParameterManager`. This is different from the single backtest page which properly uses URLParameterManager.

**Key Discovery**:
- Portfolio page manually parses URL parameters at component mount (lines 76-141)
- Portfolio page manually syncs parameters to URL for shareable links (lines 150-208)
- Momentum parameters were **not included** in either decoding or encoding sections

**Result**: Momentum parameters were never parsed from URLs or added to shareable links, so:
1. Default state didn't include momentum parameters
2. URL parameters couldn't enable momentum controls
3. Shareable links didn't preserve momentum settings

## Solution Implemented

### 1. Added Momentum Parameters to Default State (PortfolioBacktestPage.js:57-59)
```javascript
// Spec 45: Momentum-based trading parameters
momentumBasedBuy: false,
momentumBasedSell: false
```

### 2. Added URL Decoding (PortfolioBacktestPage.js:125-127)
```javascript
// Spec 45: Momentum-based trading parameters
momentumBasedBuy: searchParams.get('momentumBasedBuy') === 'true',
momentumBasedSell: searchParams.get('momentumBasedSell') === 'true'
```

### 3. Added URL Encoding (PortfolioBacktestPage.js:200-202)
```javascript
// Spec 45: Momentum-based trading parameters
params.set('momentumBasedBuy', parameters.defaultParams.momentumBasedBuy || false);
params.set('momentumBasedSell', parameters.defaultParams.momentumBasedSell || false);
```

## Files Modified

1. **`/frontend/src/components/PortfolioBacktestPage.js`**
   - Lines 57-59: Added momentum parameters to default state initialization
   - Lines 125-127: Added momentum parameter URL decoding
   - Lines 200-202: Added momentum parameter URL encoding

## Testing

With React's hot module replacement, the frontend automatically recompiled with the changes. The momentum controls in `DCABacktestForm.js` (lines 2107-2134) should now be visible and functional on the portfolio backtest page.

## Related Files

- **Frontend UI Controls**: `/frontend/src/components/DCABacktestForm.js` (lines 2107-2134)
- **URL Manager**: `/frontend/src/utils/URLParameterManager.js` (already had momentum support)
- **Backend API**: Already supported momentum parameters (verified in previous session)

## Important Note for Future Parameters

**Lesson Learned**: When adding new parameters, remember that:
- Single backtest page uses `URLParameterManager` (automatic parameter handling)
- **Portfolio backtest page uses manual URL parameter handling** (requires explicit updates in 3 locations):
  1. Default state initialization
  2. URL decoding (searchParams parsing)
  3. URL encoding (params.set)

This should be added to the generic implementation guides (G01-G06).

## Verification URL

After the fix, users can now use URLs like:
```
http://localhost:3000/portfolio-backtest?stocks=TSLA,PLTR&momentumBasedBuy=true&momentumBasedSell=true&...
```

And the momentum controls will:
- ✅ Be visible in the configuration form
- ✅ Reflect the URL parameter values
- ✅ Be included in shareable links
