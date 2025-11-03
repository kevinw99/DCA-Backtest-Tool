# Spec 54: Configuration Single Source of Truth

## Problem Statement

Currently, `backtestDefaults.json` exists in two locations:
1. `/config/backtestDefaults.json` (445 lines, master, used by backend)
2. `/frontend/src/config/backtestDefaults.json` (124 lines, outdated copy, used by frontend)

This duplication causes:
- **Configuration drift**: Files diverge over time (445 lines vs 124 lines)
- **Maintenance burden**: Updates must be made in two places
- **Inconsistency**: Backend and frontend may use different default values
- **Confusion**: Which file is the source of truth?

## Root Cause Analysis

The frontend imports the JSON file directly to populate form default values. However, this violates separation of concerns:

**Backend owns the defaults** because:
- Backend is where backtests execute
- Backend merges user parameters with defaults
- Backend has the authoritative business logic

**Frontend should only**:
- Display UI forms
- Fetch defaults from backend API to populate forms
- Submit user input to backend

## Requirements

### FR1: Single Source of Truth
- **ONLY ONE FILE**: `/config/backtestDefaults.json` exists on backend
- Frontend has **NO local copy** of this file
- All configuration changes happen in **ONE place**

### FR2: Frontend Defaults Fetching
- Frontend fetches defaults from existing backend API endpoints:
  - `GET /api/backtest/defaults` - Get global defaults
  - `GET /api/backtest/defaults/:symbol` - Get stock-specific defaults
  - `GET /api/config/backtest-defaults` - Get raw config (newly added)
- Frontend caches fetched defaults to avoid repeated API calls

### FR3: Backward Compatibility
- All existing functionality must continue to work
- No breaking changes to API contracts
- No changes to backtest execution logic

### FR4: Build Independence
- Frontend build must not depend on files outside `src/` directory
- No symlinks or workarounds
- Clean separation between frontend and backend

## Success Criteria

1. ✅ Only one `backtestDefaults.json` file exists at `/config/`
2. ✅ Frontend successfully fetches defaults from API
3. ✅ Frontend forms populate with correct default values
4. ✅ Backtests execute with correct merged parameters
5. ✅ Frontend build completes without errors
6. ✅ No configuration drift possible

## Out of Scope

- Changing default values themselves (only refactoring structure)
- API endpoint modifications (use existing endpoints)
- Backend configuration loading logic (already works correctly)

## Dependencies

- Existing API endpoints: `/api/backtest/defaults` and `/api/backtest/defaults/:symbol`
- New API endpoint: `/api/config/backtest-defaults` (added in this spec)

## Timeline

- Implementation: 2-3 hours
- Testing: 1 hour
- Total: 3-4 hours
