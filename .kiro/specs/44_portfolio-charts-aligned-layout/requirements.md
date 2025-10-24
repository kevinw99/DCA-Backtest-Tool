# Requirements: Portfolio Charts Aligned Layout

## Overview
Improve the portfolio results visualization by removing redundant charts and aligning all remaining charts to share a common x-axis (date timeline), ensuring accurate date alignment across all visualizations while maintaining interactive legend functionality.

## Problem Statement
The current portfolio results page has:
1. **Redundancy**: "Total Portfolio Value" chart duplicates information already present in other charts
2. **Poor Visual Alignment**: Charts are displayed independently without shared x-axis alignment
3. **Inefficient Space Usage**: Multiple x-axis labels for the same date range waste vertical space
4. **Difficult Comparison**: Users cannot easily correlate events across different metrics at specific dates

## User Requirements

### 1. Remove Redundant Chart
- **Remove**: "Total Portfolio Value" chart
- **Reason**: This information is already represented in other portfolio charts

### 2. Vertically Stacked Charts with Shared X-Axis
All remaining charts must be stacked vertically with:
- **Shared X-Axis**: All charts share the same date timeline
- **Accurate Date Alignment**: Data points at the same date must align vertically across all charts
- **Independent Y-Axes**: Each chart maintains its own y-axis with appropriate scale for its metrics
- **Single X-Axis Label**: Only the bottom chart shows the date axis labels to reduce clutter

### 3. Preserve Interactive Functionality
- **Legend Toggles**: All existing legend toggle functionality must be preserved
  - Example: In "Multi-Stock Price Comparison (Normalized)" users can toggle visibility of:
    - Individual stocks (NVDA, TSLA, META, AMZN, GOOG, AAPL, MSFT, etc.)
    - Transaction types (Buy Orders, Sell Orders, Rejected Orders)
- **Hover/Tooltip**: Cross-chart hover synchronization would be ideal (hover on one chart highlights same date on all charts)

### 4. Consistent Visual Style
- **Labels**: Maintain descriptive titles for each chart
- **Legends**: Keep legends in consistent positions
- **Colors**: Preserve existing color schemes for stocks and transaction types
- **Spacing**: Appropriate vertical spacing between stacked charts

## Charts to Include (in order)

1. **Multi-Stock Price Comparison (Normalized)**
   - All stock prices normalized to % change from starting price
   - Toggle individual stocks
   - Toggle transaction markers (Buy/Sell/Rejected)

2. **Portfolio Performance vs Buy & Hold**
   - DCA strategy vs Buy & Hold comparison
   - Toggle between strategies

3. **Capital Deployment Over Time**
   - Shows capital deployed across all stocks
   - Stack by individual stocks if applicable

4. **Other relevant portfolio metrics charts**
   - Include any other existing charts that provide value

## Success Criteria

1. ✅ "Total Portfolio Value" chart is removed
2. ✅ All remaining charts are vertically stacked
3. ✅ Date x-axis is perfectly aligned across all charts
4. ✅ Each chart has its own appropriate y-axis scale
5. ✅ Only the bottom chart shows x-axis date labels
6. ✅ All legend toggle functionality works as before
7. ✅ Visual consistency maintained across all charts
8. ✅ Responsive design works on different screen sizes
9. ✅ Performance is not degraded by the new layout

## Out of Scope

- Adding new charts or metrics
- Changing calculation logic for any metrics
- Modifying transaction log functionality
- Adding new filtering or date range selection features

## Technical Constraints

- Must work with existing React/Recharts implementation
- Must maintain backwards compatibility with existing data structures
- Should not require backend changes
- Must be performant with large datasets (multiple stocks over years)

## UI/UX Considerations

- Clear visual hierarchy with proper spacing
- Intuitive legend placement that doesn't obstruct charts
- Responsive behavior for different screen widths
- Accessible color schemes and labels
- Print-friendly layout (if applicable)
