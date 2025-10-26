# Bug Report: Chart X-Axis Alignment Not Working

## Summary
Portfolio charts (Capital Utilization, DCA vs Buy&Hold, Multi-Stock Price, Portfolio Composition) do not have properly synchronized x-axis dates despite implementation attempts.

## Issue Description
The charts show different date ranges and tick marks even though they should all share the same x-axis domain and ticks for easy comparison across metrics.

## Expected Behavior
- All portfolio charts should display the same date range on x-axis
- Tick marks should be vertically aligned across all charts
- Users should be able to draw a vertical line across charts at any date

## Actual Behavior
- Charts show different date ranges
- Tick marks are not aligned
- Difficult to compare data across charts at specific dates

## Component
Frontend / Charts

## Priority
P1 (High) - Significant impact on UX

## Status
Open

## Date Reported
2025-10-26

## Estimated Effort
4-8 hours (Medium)

## Impact
Users cannot easily compare data across portfolio charts due to misaligned x-axes, reducing the effectiveness of the multi-chart dashboard view.
