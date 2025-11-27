# Spec 65: Tasks - DCA Score Sub-Metrics Display

## Status: NO IMPLEMENTATION NEEDED

This spec was created in response to user request #3 from the session. Upon investigation, the requested feature (displaying 4 sub-metrics breakdown for DCA Score) **already exists** in the codebase.

## Investigation Tasks

- [x] Search for existing DCA score display implementations
- [x] Review BetaGroupAnalysis.js component
- [x] Verify backend data availability
- [x] Confirm data flow from backend to frontend
- [x] Document current implementation
- [x] Create spec for documentation purposes

## Finding Summary

**Feature Location**: `frontend/src/components/backtest/BetaGroupAnalysis.js` (lines 167-211)

**How to Access**:
1. Run any portfolio backtest (e.g., nasdaq100 config)
2. Navigate to "Beta Group Analysis" section
3. Click the expand button (▼) on any beta group row
4. See "DCA Suitability Breakdown" showing all 4 components

**What's Displayed**:
- Trade Activity: X/25 pts (with trades/stock/year detail)
- Mean Reversion: X/25 pts (with % profitable exits detail)
- Capital Efficiency: X/25 pts (with % utilization detail)
- Grid Utilization: X/25 pts (with % grid used detail)

## User Communication

Inform the user:
> The 4 sub-metrics breakdown feature you requested is already implemented! When viewing the Beta Group Analysis in your backtest results, click the expand button (▼) on any beta group row to see the detailed breakdown of Trade Activity, Mean Reversion, Capital Efficiency, and Grid Utilization scores (each out of 25 points).

## Optional Future Enhancements (Not Required)

If the user wants better discoverability, could consider:
1. Always-visible mini-breakdown in collapsed view
2. Tooltip on hover over DCA score badge
3. Visual progress bars for each component
4. Add indicator that breakdown is available (e.g., "Click to see breakdown")

But these are **UI/UX improvements**, not missing functionality.

## Conclusion

No implementation work required. The spec serves as documentation that:
1. User requested sub-metrics display
2. Feature already exists
3. User may need guidance on how to access it

**Next Action**: Inform user about the existing feature and how to access it.
