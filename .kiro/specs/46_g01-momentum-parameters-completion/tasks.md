# Tasks: Complete Momentum Parameters per G01 Guidelines

## Summary

Complete missing batch mode support and documentation for `momentumBasedBuy` and `momentumBasedSell` parameters to achieve full G01 compliance.

**Estimated Total Time:** 9-15 hours

## Phase 1: Verification & Gap Analysis (1-2 hours)

### Task 1.1: Verify Batch Backend Support
**Estimate:** 30 minutes

**Steps:**
1. Read `/backend/services/batchBacktestService.js`
2. Search for parameter extraction logic
3. Check if `momentumBasedBuy` and `momentumBasedSell` are included
4. Check if parameters pass to `runDCABacktest()`

**Commands:**
```bash
# Search for momentum parameters
grep -n "momentumBased" backend/services/batchBacktestService.js

# Search for parameter extraction pattern
grep -A 20 "const {" backend/services/batchBacktestService.js | grep -E "(momentumBased|=.*req\.body)"
```

**Acceptance Criteria:**
- [ ] Documented whether parameters exist in batch service
- [ ] If missing: Identified exact location to add parameters
- [ ] If present: Confirmed parameters reach executor

---

### Task 1.2: Locate Batch UI Component
**Estimate:** 30 minutes

**Steps:**
1. Search for batch backtest form component
2. Check if it uses shared components (e.g., `LongStrategySection`)
3. Determine parameter input method (form controls, JSON, etc.)

**Commands:**
```bash
# Find batch UI files
find frontend/src/components -name "*atch*" -type f

# Search for batch form
grep -r "batch" frontend/src/components --include="*.js" | grep -i "form\|backtest"

# Check if LongStrategySection is used
grep -r "LongStrategySection" frontend/src/components --include="*.js"
```

**Acceptance Criteria:**
- [ ] Located batch UI component file path
- [ ] Documented current parameter input method
- [ ] Identified if momentum controls already exist

---

### Task 1.3: Test Batch URL Encoding
**Estimate:** 30 minutes

**Steps:**
1. Find a batch backtest URL (if batch mode has shareable URLs)
2. Check if URL includes parameters
3. Test URL encoding/decoding manually

**Commands:**
```bash
# Search for batch URL generation
grep -r "generateShareableUrl\|encodeURI" frontend/src/components --include="*.js" -A 5 | grep -i batch

# Check URLParameterManager batch methods
grep -n "batch" frontend/src/utils/URLParameterManager.js
```

**Acceptance Criteria:**
- [ ] Documented whether batch mode has shareable URLs
- [ ] If yes: Identified encoding/decoding location
- [ ] If no: Documented alternative persistence method

---

### Task 1.4: Create Gap Analysis Report
**Estimate:** 30 minutes

**Deliverable:** Update `requirements.md` with findings

**Format:**
```markdown
## Verification Results

### Backend (batchBacktestService.js)
- [x] Parameters present / [ ] Parameters missing
- Location: `backend/services/batchBacktestService.js:LINE`
- **Action needed:** [YES/NO] - [describe]

### Frontend UI
- Component: `path/to/component.js`
- Momentum controls: [PRESENT/MISSING]
- **Action needed:** [YES/NO] - [describe]

### URL Encoding
- Batch URLs: [EXIST/DON'T EXIST]
- Momentum in URL: [YES/NO]
- **Action needed:** [YES/NO] - [describe]

### Summary
**Total work items:** X
**Estimated effort:** X hours
```

**Acceptance Criteria:**
- [ ] All 3 components verified (backend, frontend, URL)
- [ ] Gap analysis completed
- [ ] Work estimates updated based on findings

---

## Phase 2: Backend Implementation (0-2 hours)

**CONDITIONAL:** Only if verification found gaps

### Task 2.1: Add Parameters to Batch Service
**Estimate:** 1 hour

**File:** `/backend/services/batchBacktestService.js`

**Changes:**
```javascript
// Find parameter extraction section
const {
  // ... existing parameters ...

  // ADD: Momentum parameters (Spec 45/46)
  momentumBasedBuy = false,
  momentumBasedSell = false
} = req.body || defaultParams;

// Find runDCABacktest call, add parameters
const results = await runDCABacktest(symbol, startDate, endDate, {
  // ... existing parameters ...
  momentumBasedBuy,
  momentumBasedSell
});
```

**Testing:**
```bash
# Create test file
cat > /tmp/test_batch_momentum.json <<EOF
{
  "symbols": ["AAPL", "MSFT"],
  "startDate": "2024-01-01",
  "endDate": "2024-03-31",
  "momentumBasedBuy": true,
  "momentumBasedSell": true,
  "lotSizeUsd": 5000
}
EOF

# Test API
curl -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d @/tmp/test_batch_momentum.json \
  | jq '.data | .[0] | {symbol, momentumMode, maxLotsReached}'
```

**Acceptance Criteria:**
- [ ] Parameters extracted from request body
- [ ] Parameters passed to executor
- [ ] Curl test returns momentum statistics
- [ ] Results include `momentumMode` field

---

### Task 2.2: Verify Batch API Route
**Estimate:** 30 minutes

**File:** `/backend/server.js`

**Check:**
```javascript
// Find batch API route
app.post('/api/backtest/batch', async (req, res) => {
  // Verify momentum parameters included in extraction
  const {
    // ...
    momentumBasedBuy,  // ← Should be here
    momentumBasedSell  // ← Should be here
  } = req.body;
});
```

**If missing:** Add parameters to extraction and pass to service

**Acceptance Criteria:**
- [ ] Batch route extracts momentum parameters
- [ ] Parameters logged in debug output
- [ ] No errors when parameters omitted (uses defaults)

---

## Phase 3: Frontend UI Implementation (1-3 hours)

**CONDITIONAL:** Only if verification found missing UI controls

### Task 3.1: Add Momentum Controls to Batch Form
**Estimate:** 2 hours

**File:** `[Batch UI Component Path from verification]`

**Implementation:**
```jsx
{/* Momentum Trading Parameters */}
<Box sx={{ mt: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
  <Typography variant="h6" gutterBottom>
    Momentum Trading Mode
  </Typography>

  <FormControlLabel
    control={
      <Checkbox
        checked={params.momentumBasedBuy || false}
        onChange={(e) => handleParamChange('momentumBasedBuy', e.target.checked)}
        name="momentumBasedBuy"
      />
    }
    label={
      <Box>
        <Typography>Momentum-Based Buy</Typography>
        <Typography variant="caption" color="text.secondary">
          Buy on strength when P/L > 0, remove maxLots limit
        </Typography>
      </Box>
    }
  />

  <FormControlLabel
    control={
      <Checkbox
        checked={params.momentumBasedSell || false}
        onChange={(e) => handleParamChange('momentumBasedSell', e.target.checked)}
        name="momentumBasedSell"
      />
    }
    label={
      <Box>
        <Typography>Momentum-Based Sell</Typography>
        <Typography variant="caption" color="text.secondary">
          Sell on weakness immediately (0% activation)
        </Typography>
      </Box>
    }
  />
</Box>
```

**Testing:**
1. Open batch backtest page in browser
2. Verify momentum section appears
3. Check/uncheck boxes → verify state updates
4. Submit batch test → verify network request includes parameters
5. View results → verify momentum statistics displayed

**Acceptance Criteria:**
- [ ] Checkboxes appear in batch form
- [ ] State updates on checkbox change
- [ ] Parameters included in API request
- [ ] Help text explains momentum mode
- [ ] Consistent styling with other forms

---

### Task 3.2: Add to React State Management
**Estimate:** 30 minutes

**Add to state initialization:**
```javascript
const [params, setParams] = useState({
  // ... existing parameters ...
  momentumBasedBuy: false,
  momentumBasedSell: false
});
```

**Add to localStorage save/load:**
```javascript
// Save
localStorage.setItem('batchParams', JSON.stringify({
  // ... existing parameters ...
  momentumBasedBuy: params.momentumBasedBuy,
  momentumBasedSell: params.momentumBasedSell
}));

// Load
const savedParams = JSON.parse(localStorage.getItem('batchParams') || '{}');
setParams({
  // ... existing defaults ...
  momentumBasedBuy: savedParams.momentumBasedBuy || false,
  momentumBasedSell: savedParams.momentumBasedSell || false
});
```

**Acceptance Criteria:**
- [ ] Parameters in initial state
- [ ] Parameters persist on page refresh
- [ ] Parameters cleared when "Reset" clicked

---

## Phase 4: URL Encoding (0-2 hours)

**CONDITIONAL:** Only if batch mode uses shareable URLs

### Task 4.1: Add Manual URL Handling (if needed)
**Estimate:** 1.5 hours

**Pattern from PortfolioBacktestPage.js:**

```javascript
// 1. URL Decoding (in useEffect)
useEffect(() => {
  const searchParams = new URLSearchParams(window.location.search);

  setParams(prev => ({
    ...prev,
    momentumBasedBuy: searchParams.get('momentumBasedBuy') === 'true',
    momentumBasedSell: searchParams.get('momentumBasedSell') === 'true'
  }));
}, []);

// 2. URL Encoding (in generateShareableUrl)
const generateShareableUrl = () => {
  const params = new URLSearchParams(window.location.search);

  if (currentParams.momentumBasedBuy) {
    params.set('momentumBasedBuy', 'true');
  } else {
    params.delete('momentumBasedBuy');
  }

  if (currentParams.momentumBasedSell) {
    params.set('momentumBasedSell', 'true');
  } else {
    params.delete('momentumBasedSell');
  }

  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
};
```

**Testing:**
1. Set momentum parameters in UI
2. Click "Share" or generate URL
3. Copy URL and paste in new tab
4. Verify momentum checkboxes are checked
5. Verify backtest uses momentum mode

**Acceptance Criteria:**
- [ ] URL includes `?momentumBasedBuy=true&momentumBasedSell=true`
- [ ] URL loading sets correct checkbox state
- [ ] Round-trip preserves parameter values

---

## Phase 5: Documentation (3-4 hours)

### Task 5.1: Create API Documentation
**Estimate:** 1.5 hours

**File:** Create `/docs/api/momentum-parameters.md`

**Structure:**
```markdown
# Momentum Trading Parameters API Reference

## Overview
Two independent boolean parameters control momentum-based trading...

## momentumBasedBuy

**Type:** Boolean
**Default:** `false`
**Modes:** Single, Portfolio, Batch

**Description:** Enables momentum-based buy strategy...

**Behavior:**
- Activation threshold: 0% (immediate)
- P/L requirement: > $0 (except first buy)
- maxLots: Unlimited (capital only)
- Grid spacing: Still enforced

**API Examples:**

### Single Mode
```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "startDate": "2024-01-01",
    "endDate": "2024-06-30",
    "momentumBasedBuy": true
  }'
```

### Portfolio Mode
```bash
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d @nasdaq100.json
```
(Config file with `"momentumBasedBuy": true` in globalDefaults)

### Batch Mode
```bash
curl -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "MSFT", "NVDA"],
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "momentumBasedBuy": true,
    "lotSizeUsd": 5000
  }'
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "momentumMode": {
      "buy": true,
      "sell": false
    },
    "maxLotsReached": 8,
    "buyStatistics": {
      "total": 12,
      "blockedByPnL": 4
    }
  }
}
```

## momentumBasedSell
[Similar structure...]

## Combined Usage
[Examples of both parameters together...]

## Parameter Interactions
[Document conflicts with other features...]
```

**Acceptance Criteria:**
- [ ] All 3 modes documented with examples
- [ ] Curl commands tested and working
- [ ] Response format documented
- [ ] Parameter interactions documented

---

### Task 5.2: Create User Guide
**Estimate:** 1.5 hours

**File:** Create `/docs/guides/momentum-trading.md`

**Structure:**
```markdown
# Momentum Trading Guide

## What is Momentum Trading?

### Traditional DCA (Mean Reversion)
- **Buy:** On price dips (weakness)
- **Sell:** On price spikes (strength)
- **Philosophy:** "Buy low, sell high"
- **Best for:** Choppy, sideways markets

### Momentum DCA (Trend Following)
- **Buy:** On price rebounds (strength)
- **Sell:** On price pullbacks (weakness)
- **Philosophy:** "Add to winners, cut losers fast"
- **Best for:** Trending markets

## When to Use Momentum Mode

### Use Momentum Buy When:
- Strong uptrends expected
- High confidence in trend continuation
- Want to scale into winning positions
- Have sufficient capital

### Use Momentum Sell When:
- Want fast exits on reversals
- Prefer to lock in profits quickly
- Markets are volatile

### Use Traditional Mode When:
- Choppy/sideways markets
- Mean reversion expected
- Want to "buy the dip"
- Limited capital (maxLots constraint)

## Parameter Combinations

### Pure Momentum (Aggressive)
```json
{
  "momentumBasedBuy": true,
  "momentumBasedSell": true,
  "trailingBuyReboundPercent": 0.02,
  "trailingSellPullbackPercent": 0.03
}
```
**Best for:** Strong trending stocks, high conviction

### Momentum Buy Only (Growth Focus)
```json
{
  "momentumBasedBuy": true,
  "momentumBasedSell": false,
  "trailingSellActivationPercent": 0.20,
  "trailingSellPullbackPercent": 0.10
}
```
**Best for:** Accumulating winners, patient exits

### Momentum Sell Only (Fast Exits)
```json
{
  "momentumBasedBuy": false,
  "momentumBasedSell": true,
  "trailingBuyActivationPercent": 0.10
}
```
**Best for:** Traditional entry, quick profit-taking

## Real-World Examples

### Example 1: NVDA Strong Uptrend (2023-2024)
[Comparison of traditional vs momentum results...]

### Example 2: PLTR Volatile Growth (2024)
[Comparison showing momentum advantages...]

### Example 3: Portfolio Batch Test
[Batch mode comparing 50 stocks...]

## Best Practices

1. **Start Conservative:** Test with small position sizes first
2. **Monitor P/L:** Watch buyBlockedByPnL statistic
3. **Adjust Rebound %:** Tune sensitivity based on volatility
4. **Combine Wisely:** Consider market conditions

## Common Pitfalls

1. **Over-accumulation:** Momentum can build large positions quickly
2. **False breakouts:** Can trigger multiple buys before reversal
3. **Capital depletion:** Ensure sufficient capital for momentum buying

## Parameter Tuning Guide
[Table of recommended parameters for different market conditions...]
```

**Acceptance Criteria:**
- [ ] Clear explanation of momentum vs traditional
- [ ] When to use guidelines
- [ ] Real examples with actual results
- [ ] Best practices documented
- [ ] Common mistakes highlighted

---

### Task 5.3: Update G01 with Lessons Learned
**Estimate:** 1 hour

**File:** Create `.kiro/specs/generic/G01_adding-new-parameter/lessons-learned.md`

**Content:**
```markdown
# Lessons Learned: Adding New Parameters

This document captures patterns and pitfalls discovered while adding parameters to the DCA Backtest Tool.

## From Spec 45: Momentum-Based Trading

### Pattern 1: P/L Gating for Buy Orders

**Problem:** Need to gate buy execution based on position profitability.

**Solution:**
```javascript
// Calculate P/L once per day at start
function processOneDayOfTrading(state, priceData, params) {
  state.positionPnL = calculatePositionPnL(state.lots, priceData.close);

  // Use in buy check
  if (params.momentumBasedBuy && state.lots.length > 0) {
    if (state.positionPnL <= 0) {
      // Block buy, log reason
      return false;
    }
  }
}
```

**Key Learning:** Calculate state once, use everywhere. Don't recalculate in each function.

### Pattern 2: Portfolio Manual URL Handling

**Problem:** Portfolio page doesn't use URLParameterManager.

**Solution:** Must add parameter in 3 places:
1. State initialization (~line 57)
2. URL decoding (searchParams parsing, ~line 125)
3. URL encoding (params.set, ~line 200)

**Key Learning:** Portfolio mode is special case. Always check portfolio page separately.

### Pattern 3: Conditional Feature Activation

**Problem:** Parameter should override other parameters (activation → 0%).

**Solution:**
```javascript
let effectiveActivation;
if (params.momentumBasedBuy) {
  effectiveActivation = 0;  // Override
} else {
  effectiveActivation = params.trailingBuyActivationPercent;  // Normal
}
```

**Key Learning:** Feature flags can override numeric parameters. Document clearly.

### Pattern 4: Statistics Tracking

**Problem:** Need to track new metrics (buyBlockedByPnL).

**Solution:**
```javascript
// Add to state initialization
const state = {
  // ... existing ...
  buyBlockedByPnL: 0
};

// Increment when blocking
if (positionPnL <= 0) {
  state.buyBlockedByPnL++;
}

// Include in results
return {
  buyStatistics: {
    blockedByPnL: state.buyBlockedByPnL
  }
};
```

**Key Learning:** Plan statistics upfront. Easier to add during implementation.

## Checklist Additions

Based on Spec 45, add these to G01 checklist:

- [ ] **If parameter overrides others:** Document precedence clearly
- [ ] **If parameter gates execution:** Add counter/statistic for blocked actions
- [ ] **If parameter affects multiple modes:** Test portfolio manual URL handling
- [ ] **If parameter changes activation:** Log mode type in transactions

## Common Mistakes to Avoid

1. **Forgetting portfolio manual URL handling** (3 places!)
2. **Not tracking statistics for new blocking conditions**
3. **Inconsistent parameter precedence across functions**
4. **Missing help text explaining parameter impact**
```

**Acceptance Criteria:**
- [ ] Patterns documented with code examples
- [ ] Portfolio URL handling documented
- [ ] Statistics tracking pattern documented
- [ ] Common mistakes listed

---

## Phase 6: Testing & Verification (2 hours)

### Task 6.1: Create Batch Test Script
**Estimate:** 1 hour

**File:** Create `/backend/test_momentum_batch.sh`

**Content:**
```bash
#!/bin/bash

BASE_URL="http://localhost:3001"
RESULTS_DIR="/tmp/momentum_batch_tests"

mkdir -p $RESULTS_DIR

echo "======================================"
echo "Momentum Parameters - Batch Mode Tests"
echo "======================================"

echo ""
echo "Test 1: Batch with momentum buy only"
curl -X POST $BASE_URL/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "MSFT", "NVDA"],
    "startDate": "2024-01-01",
    "endDate": "2024-06-30",
    "momentumBasedBuy": true,
    "momentumBasedSell": false,
    "lotSizeUsd": 5000
  }' > $RESULTS_DIR/test1_momentum_buy.json

jq '.data | map({
  symbol,
  momentumMode,
  maxLotsReached,
  buyBlockedByPnL,
  totalPnl
})' $RESULTS_DIR/test1_momentum_buy.json

echo ""
echo "Test 2: Batch with both momentum modes"
curl -X POST $BASE_URL/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["PLTR", "TSLA"],
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "momentumBasedBuy": true,
    "momentumBasedSell": true,
    "trailingBuyReboundPercent": 0.03,
    "trailingSellPullbackPercent": 0.05,
    "lotSizeUsd": 10000
  }' > $RESULTS_DIR/test2_both_momentum.json

jq '.data | map({
  symbol,
  momentumMode,
  totalTrades,
  totalPnl
})' $RESULTS_DIR/test2_both_momentum.json

echo ""
echo "Test 3: Batch traditional mode (baseline)"
curl -X POST $BASE_URL/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "MSFT", "NVDA"],
    "startDate": "2024-01-01",
    "endDate": "2024-06-30",
    "momentumBasedBuy": false,
    "momentumBasedSell": false,
    "lotSizeUsd": 5000
  }' > $RESULTS_DIR/test3_traditional.json

jq '.data | map({
  symbol,
  momentumMode,
  maxLotsReached,
  totalPnl
})' $RESULTS_DIR/test3_traditional.json

echo ""
echo "Test 4: Large batch (performance test)"
curl -X POST $BASE_URL/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "NFLX", "PLTR", "AMD"],
    "startDate": "2024-01-01",
    "endDate": "2024-03-31",
    "momentumBasedBuy": true,
    "lotSizeUsd": 5000
  }' > $RESULTS_DIR/test4_large_batch.json

echo "Processed $(jq '.data | length' $RESULTS_DIR/test4_large_batch.json) symbols"

echo ""
echo "========================================="
echo "All tests complete. Results in $RESULTS_DIR"
echo "========================================="
```

**Make executable:**
```bash
chmod +x backend/test_momentum_batch.sh
```

**Run tests:**
```bash
./backend/test_momentum_batch.sh
```

**Acceptance Criteria:**
- [ ] All 4 tests run successfully
- [ ] Test 1 shows momentum buy statistics
- [ ] Test 2 shows both momentum modes
- [ ] Test 3 shows traditional mode (baseline)
- [ ] Test 4 completes in reasonable time (< 30s)

---

### Task 6.2: Manual UI Testing
**Estimate:** 30 minutes

**Test Plan:**
1. **Frontend UI:**
   - [ ] Open batch backtest page
   - [ ] Verify momentum checkboxes appear
   - [ ] Toggle checkboxes → verify visual state change
   - [ ] Submit test → verify network request includes parameters
   - [ ] View results → verify momentum statistics shown

2. **URL Persistence (if applicable):**
   - [ ] Enable momentum parameters
   - [ ] Generate shareable URL
   - [ ] Copy URL to new tab
   - [ ] Verify parameters preserved

3. **localStorage Persistence:**
   - [ ] Enable momentum parameters
   - [ ] Refresh page
   - [ ] Verify checkboxes still checked

**Acceptance Criteria:**
- [ ] All UI tests pass
- [ ] No console errors
- [ ] Parameters persist correctly

---

### Task 6.3: Cross-Mode Verification
**Estimate:** 30 minutes

**Goal:** Verify momentum parameters work identically across all 3 modes

**Test Matrix:**

| Test Case | Single Mode | Portfolio Mode | Batch Mode |
|-----------|-------------|----------------|------------|
| momentumBasedBuy=true | ✓ Test | ✓ Test | ✓ Test |
| momentumBasedSell=true | ✓ Test | ✓ Test | ✓ Test |
| Both=true | ✓ Test | ✓ Test | ✓ Test |
| Both=false | ✓ Test | ✓ Test | ✓ Test |

**For each test:**
1. Run backtest in all 3 modes with same symbol/dates
2. Compare `momentumMode` in results
3. Verify statistics present
4. Verify transaction logs show correct mode

**Acceptance Criteria:**
- [ ] All 12 tests (4 × 3 modes) pass
- [ ] Results consistent across modes
- [ ] No errors or warnings

---

## Summary Checklist

### Verification Phase ✓
- [ ] Task 1.1: Verify batch backend
- [ ] Task 1.2: Locate batch UI
- [ ] Task 1.3: Test batch URLs
- [ ] Task 1.4: Gap analysis report

### Backend Phase (if needed) ✓
- [ ] Task 2.1: Add parameters to batch service
- [ ] Task 2.2: Verify batch API route

### Frontend Phase (if needed) ✓
- [ ] Task 3.1: Add UI controls
- [ ] Task 3.2: State management

### URL Phase (if needed) ✓
- [ ] Task 4.1: Manual URL handling

### Documentation Phase ✓
- [ ] Task 5.1: API documentation
- [ ] Task 5.2: User guide
- [ ] Task 5.3: G01 lessons learned

### Testing Phase ✓
- [ ] Task 6.1: Batch test script
- [ ] Task 6.2: Manual UI testing
- [ ] Task 6.3: Cross-mode verification

## Estimated Timeline

**Minimum (if batch already complete):**
- Verification: 2 hours
- Documentation: 4 hours
- Testing: 2 hours
- **Total: 8 hours**

**Maximum (if full implementation needed):**
- Verification: 2 hours
- Backend: 2 hours
- Frontend: 3 hours
- URL: 2 hours
- Documentation: 4 hours
- Testing: 2 hours
- **Total: 15 hours**

## Success Criteria

- [x] All G01 checklist items complete
- [ ] Batch mode supports momentum parameters
- [ ] API documentation complete
- [ ] User guide complete
- [ ] All tests pass
- [ ] Cross-mode consistency verified
