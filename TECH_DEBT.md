# Technical Debt Register

This document tracks known technical debt items that need to be addressed. Each item includes priority, impact, and effort estimates to help with planning.

## Priority Levels
- **P0 (Critical)**: Blocks functionality, causes bugs, or security issues
- **P1 (High)**: Significant impact on UX or performance
- **P2 (Medium)**: Should fix but not urgent
- **P3 (Low)**: Nice to have, refactoring, or cleanup

## Status
- **Open**: Not yet started
- **In Progress**: Currently being worked on
- **Blocked**: Waiting on dependencies
- **Resolved**: Completed

---

## Open Items

### [TD-001] Portfolio Chart X-Axis Alignment Not Working
**Priority:** P1 (High)
**Status:** Open
**Date Added:** 2025-10-26
**Estimated Effort:** 4-8 hours
**Component:** Frontend / Charts

**Description:**
Portfolio charts (Capital Utilization, DCA vs Buy&Hold, Multi-Stock Price, Portfolio Composition) do not have properly synchronized x-axis dates despite implementation attempts in commit `85930e8`.

**Issue:**
The charts show different date ranges and tick marks even though they should all share the same x-axis domain and ticks.

**Location:**
- `frontend/src/components/portfolio/AlignedChartsContainer.js`
- `frontend/src/components/portfolio/charts/*Aligned.js`
- `frontend/src/components/charts/SharedChartConfig.js`

**Attempted Solutions:**
- Added `syncId` to all charts
- Implemented `getSharedXAxisConfig()` utility
- Set explicit `domain` and `ticks` arrays
- Enforced `type="category"` for x-axis

**Root Cause:**
Unknown - Recharts may ignore `domain` and `ticks` for category-type axes, or there may be data preprocessing issues causing inconsistent date arrays.

**Suggested Approach:**
1. Debug: Log actual `ticks` being passed to each chart
2. Verify all charts receive identical date arrays
3. Check if Recharts version has known issues with category axes
4. Consider alternative: Use numeric timestamps with formatted labels
5. Test with minimal reproduction case

**Related:**
- Commit: `85930e8` (wip: Frontend chart alignment and misc updates)
- Previous commits: `5c0fb1e`, `0d8c774`, `a892dd9`, `982e8a3`

**Impact:**
Users cannot easily compare data across portfolio charts due to misaligned x-axes.

---

## Resolved Items

### [TD-000] Example Template
**Priority:** P2
**Status:** Resolved
**Date Added:** 2025-01-01
**Date Resolved:** 2025-01-01
**Resolution:** Description of how it was fixed

---

## Best Practices for Managing This File

1. **Add New Items**: When you discover tech debt, add it here immediately
2. **Reference in Code**: Add TODO comments pointing to this file:
   ```javascript
   // TODO(TD-001): Fix chart alignment - see TECH_DEBT.md
   ```
3. **Link to Commits**: Always reference the commit hash where the debt was introduced
4. **Estimate Effort**: Use T-shirt sizes (Small=1-2h, Medium=4-8h, Large=1-2d, XL=3-5d)
5. **Review Regularly**: During sprint planning, review P0-P1 items
6. **Update Status**: Keep statuses current to track progress

## Alternative: GitHub Issues

For larger teams, consider using GitHub Issues with labels:
- `tech-debt`
- `priority-critical`, `priority-high`, `priority-medium`, `priority-low`
- `effort-small`, `effort-medium`, `effort-large`, `effort-xl`

This allows:
- Better tracking and assignment
- Discussion threads
- Linking to PRs
- Automated project boards
