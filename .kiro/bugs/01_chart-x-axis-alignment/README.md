# Bug #01: Chart X-Axis Alignment Not Working

**Status:** Open
**Priority:** P1 (High)
**Component:** Frontend / Charts
**Date Reported:** 2025-10-26
**Estimated Effort:** 4-8 hours

## Quick Links
- [Bug Report](./bug-report.md) - Detailed description and impact
- [Reproduction Steps](./reproduction.md) - How to reproduce with URLs and curl commands
- [Investigation Log](./investigation.md) - What has been tried and current hypothesis
- [Affected Files](./affected-files.md) - Code locations and line numbers
- [Related Commits](./commits.md) - Git history of attempts
- [Effort Log](./effort-log.md) - Time spent and remaining work

## Summary
Portfolio charts show different date ranges and tick marks on x-axes despite attempts to synchronize them using shared domain, ticks, and syncId. This makes it difficult for users to compare data across charts.

## Current Hypothesis
Recharts may ignore `domain` and `ticks` props for category-type axes, requiring an alternative approach using numeric timestamps with formatted labels.

## Next Steps
1. Add debug logging to verify data consistency
2. Research Recharts documentation for category axis behavior
3. Test alternative approach with numeric scale
4. Create minimal reproduction case
