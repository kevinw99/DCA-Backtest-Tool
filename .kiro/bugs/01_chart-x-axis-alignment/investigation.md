# Investigation Log

## Attempted Solutions

### Solution 1: Added syncId
**Commit:** Early implementation
**What was tried:** Added `syncId="portfolioCharts"` to all chart components
**Result:** Did not synchronize x-axes as expected
**Analysis:** syncId only synchronizes tooltips and interactions, not axis rendering

### Solution 2: Implemented getSharedXAxisConfig()
**Commit:** 5c0fb1e, 0d8c774
**What was tried:** Created utility function to generate consistent x-axis configuration
**Result:** Still showed different date ranges
**Analysis:** Charts may be preprocessing data differently before applying config

### Solution 3: Explicit domain and ticks arrays
**Commit:** a892dd9, 982e8a3
**What was tried:**
- Set explicit `domain={sharedDomain}` prop
- Generated explicit `ticks={sharedTicks}` array
- Calculated ticks based on masterDates with consistent interval
**Result:** Charts still not aligned
**Analysis:** Recharts may ignore domain/ticks for category-type axes

### Solution 4: Enforced type="category"
**Commit:** 85930e8 (WIP: Frontend chart alignment and misc updates)
**What was tried:** Explicitly set `type="category"` on all x-axes
**Result:** Still not working
**Analysis:** Root cause unknown

## Current Hypothesis

### Possible Root Causes
1. **Recharts behavior with category axes**
   - Recharts may ignore `domain` and `ticks` props when `type="category"`
   - Category axes auto-calculate domain from data keys

2. **Data preprocessing inconsistencies**
   - Different charts may have different date arrays in their data
   - Missing data points could cause different rendering

3. **Data key mismatches**
   - Each chart uses different data structures
   - Date keys may not be consistent across datasets

4. **Recharts version issue**
   - Known bug in Recharts library
   - May need to upgrade or downgrade version

## Next Steps to Debug

1. **Add console logging**
   - Log `sharedDomain` and `sharedTicks` in AlignedChartsContainer
   - Log actual data.date values in each chart component
   - Compare to verify all charts receive identical props

2. **Verify data consistency**
   - Check if all chartData arrays have the same date values
   - Verify masterDates array is correctly populated
   - Look for missing dates in individual chart data

3. **Check Recharts documentation**
   - Review latest docs for category axis behavior
   - Check if there are known issues with domain/ticks
   - Look for alternative approaches

4. **Test minimal reproduction**
   - Create simple test with 2 charts and hardcoded data
   - Eliminate variables to isolate the issue

5. **Consider alternative approach**
   - Use numeric timestamps instead of category type
   - Format labels with date strings
   - Use `scale="time"` with proper Date objects
