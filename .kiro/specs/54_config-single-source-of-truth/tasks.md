# Implementation Tasks: Spec 54

## Backend Tasks

### ✅ Task 1: Create API Endpoint
**Status**: COMPLETED
**File**: `backend/server.js`
**Lines**: 589-607

Already added endpoint:
```
GET /api/config/backtest-defaults
```

Returns raw `backtestDefaults.json` content.

---

## Frontend Tasks

### Task 2: Create Config Service
**File**: `frontend/src/services/configService.js` (NEW)
**Estimated Time**: 30 minutes

Create centralized service for fetching and caching config:
- Singleton pattern for caching
- Async fetch from API
- Error handling
- Cache invalidation support

**Dependencies**: None

---

### Task 3: Update stockDefaults.js
**File**: `frontend/src/utils/stockDefaults.js`
**Estimated Time**: 45 minutes

Changes:
1. Remove: `import backtestDefaults from '../config/backtestDefaults.json'`
2. Import: `import { fetchBacktestDefaults } from '../services/configService'`
3. Make functions async where needed
4. Use fetched config instead of imported JSON

**Dependencies**: Task 2

---

### Task 4: Update ParameterHelper.js
**File**: `frontend/src/components/backtest/utils/ParameterHelper.js`
**Estimated Time**: 30 minutes

Changes:
1. Remove JSON import
2. Import configService
3. Use cached config via `getConfigSync()`

**Dependencies**: Task 2

---

### Task 5: Update BetaCalculator.js
**File**: `frontend/src/components/backtest/utils/BetaCalculator.js`
**Estimated Time**: 30 minutes

Changes:
1. Remove JSON import
2. Import configService
3. Use cached config via `getConfigSync()`

**Dependencies**: Task 2

---

### Task 6: Update BetaSourceBadge.js
**File**: `frontend/src/components/backtest/shared/BetaSourceBadge.js`
**Estimated Time**: 20 minutes

Changes:
1. Remove JSON import
2. Import configService
3. Use cached config via `getConfigSync()`

**Dependencies**: Task 2

---

### Task 7: Update useParameterDefaults.js
**File**: `frontend/src/components/backtest/hooks/useParameterDefaults.js`
**Estimated Time**: 30 minutes

Changes:
1. Remove JSON import
2. Use `fetchBacktestDefaults()` in useEffect
3. Add loading state
4. Handle fetch errors

**Dependencies**: Task 2

---

### Task 8: Initialize Config on App Load
**File**: `frontend/src/App.js` (or root component)
**Estimated Time**: 20 minutes

Add config preload:
```javascript
useEffect(() => {
  fetchBacktestDefaults().catch(console.error);
}, []);
```

**Dependencies**: Task 2

---

### Task 9: Delete Old Config File
**File**: `frontend/src/config/backtestDefaults.json`
**Estimated Time**: 5 minutes

1. Delete the file
2. Keep `.backup` for reference
3. Verify no other files reference it

**Dependencies**: Tasks 3-7 completed

---

## Testing Tasks

### Task 10: Test Backend Endpoint
**Estimated Time**: 10 minutes

```bash
# Start backend
cd backend && npm start

# Test endpoint
curl http://localhost:3001/api/config/backtest-defaults
```

Verify:
- Returns 200 OK
- JSON structure matches file
- All expected fields present

---

### Task 11: Test Frontend Build
**Estimated Time**: 15 minutes

```bash
# Build frontend
cd frontend && npm run build
```

Verify:
- No build errors
- No missing imports
- Bundle size reasonable

---

### Task 12: Test Form Population
**Estimated Time**: 30 minutes

1. Start both backend and frontend
2. Open backtest form
3. Verify default values populate correctly
4. Test with different stock symbols
5. Verify stock-specific defaults load

---

### Task 13: Test Backtest Execution
**Estimated Time**: 20 minutes

1. Submit backtest with default values
2. Verify backtest executes correctly
3. Verify results match expected behavior
4. Test with custom parameter overrides

---

### Task 14: Test Error Handling
**Estimated Time**: 20 minutes

1. Stop backend server
2. Reload frontend
3. Verify graceful error handling
4. Verify fallback behavior
5. Start backend
6. Verify recovery

---

## Documentation Tasks

### Task 15: Update README (if needed)
**Estimated Time**: 15 minutes

Document:
- New architecture (single source of truth)
- API endpoint for config
- How to modify default values

---

## Total Estimated Time

- Backend: 0 hours (already done)
- Frontend Development: 3.5 hours
- Testing: 1.75 hours
- Documentation: 0.25 hours

**Total**: ~5.5 hours

---

## Task Execution Order

**Phase 1: Foundation**
1. Task 2 (configService) ← START HERE
2. Task 8 (App.js preload)

**Phase 2: Migration**
3. Task 3 (stockDefaults.js)
4. Task 4 (ParameterHelper.js)
5. Task 5 (BetaCalculator.js)
6. Task 6 (BetaSourceBadge.js)
7. Task 7 (useParameterDefaults.js)

**Phase 3: Cleanup**
8. Task 9 (Delete old file)

**Phase 4: Testing**
9. Task 10 (Backend endpoint)
10. Task 11 (Frontend build)
11. Task 12 (Form population)
12. Task 13 (Backtest execution)
13. Task 14 (Error handling)

**Phase 5: Documentation**
14. Task 15 (README)

---

## Success Criteria Checklist

- [ ] Only one config file exists: `/config/backtestDefaults.json`
- [ ] Frontend fetches config from API
- [ ] Forms populate with correct defaults
- [ ] Backtests execute correctly
- [ ] Frontend builds without errors
- [ ] Error handling works gracefully
- [ ] No configuration drift possible
- [ ] Documentation updated
