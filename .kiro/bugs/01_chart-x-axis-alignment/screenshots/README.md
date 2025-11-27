# Screenshots

This directory contains visual evidence of the bug.

## How to Add Screenshots

### macOS
1. Take screenshot: `Cmd + Shift + 4` (select area) or `Cmd + Shift + 3` (full screen)
2. Screenshots save to Desktop by default
3. Move to this directory with descriptive names

### Naming Convention
Use descriptive names with date:
- `YYYY-MM-DD_description.png`
- Example: `2025-10-26_misaligned-chart-axes.png`

## Recommended Screenshots for This Bug

1. **Overview of all charts** - Full page showing all 4 portfolio charts
   - Filename: `overview_all_charts_misaligned.png`
   - Shows: Complete dashboard with all misaligned charts visible

2. **Close-up of x-axes** - Zoomed view of x-axis tick marks
   - Filename: `closeup_xaxis_ticks_not_aligned.png`
   - Shows: Different date ranges/tick positions across charts

3. **Browser console** - Developer tools showing data/props
   - Filename: `console_shared_ticks_data.png`
   - Shows: Console.log output of sharedTicks and sharedDomain

4. **Expected behavior** (if available from other page)
   - Filename: `expected_aligned_axes.png`
   - Shows: Example of properly aligned axes (comparison)

## Current Screenshots

### 2025-10-26_misaligned-chart-axes.png
**Date:** October 26, 2025
**Description:** Shows two portfolio charts (Multi-Stock Price Comparison and Capital Utilization Metrics) with misaligned x-axis tick marks. The charts display different date spacing despite using shared domain and ticks configuration.
**What it shows:**
- Top chart: Multi-stock normalized prices (NVDA, META, GOOG, MSFT, TSLA, AMZN, AAPL)
- Bottom chart: Capital utilization metrics (Deployed Capital, Cash Reserve, Utilization %)
- Clear evidence of x-axis misalignment between the two charts
