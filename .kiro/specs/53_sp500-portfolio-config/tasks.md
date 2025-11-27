# Spec 53: S&P 500 Portfolio Configuration - Tasks

## Task Breakdown

### Phase 1: Research & Data Collection

#### Task 1.1: Compile Current S&P 500 Stock List
**Objective**: Get accurate list of current S&P 500 component stocks

**Steps**:
1. Access S&P 500 component list from reliable source (Wikipedia, S&P website, Yahoo Finance)
2. Extract all ticker symbols
3. Verify symbols are correct (check for recent changes)
4. Handle multiple share classes (GOOG/GOOGL, BRK.A/BRK.B, etc.)
5. Sort alphabetically
6. Document snapshot date

**Output**: List of ~500 stock symbols

**Validation**:
- Count should be ~500-505 stocks
- No duplicate symbols
- All symbols are valid US stock tickers
- Both share classes included where applicable

**Estimated Time**: 30 minutes

---

#### Task 1.2: Research S&P 500 Historical Changes (2021-2025)
**Objective**: Compile comprehensive list of index additions and removals

**Data Points to Collect**:
- Symbol
- Addition date (if added during period)
- Removal date (if removed during period)
- Reason for change

**Sources**:
1. S&P Dow Jones Indices press releases
2. Financial news (Bloomberg, Reuters, WSJ)
3. Wikipedia S&P 500 historical data
4. Company press releases

**Search Strategy**:
- "S&P 500 additions 2021" through "S&P 500 additions 2025"
- "S&P 500 removals 2021" through "S&P 500 removals 2025"
- "S&P 500 rebalancing [year]"
- Major corporate events (mergers, bankruptcies)

**Priority Events**:
1. Quarterly rebalancing (typically announced ~1 week before effective date)
2. High-profile additions (e.g., Tesla 2020, recent IPOs)
3. Major removals (bankruptcies, mega-mergers)
4. Corporate actions affecting index membership

**Output**: Raw notes with dates and events

**Estimated Time**: 1-2 hours (depending on thoroughness)

---

### Phase 2: File Creation

#### Task 2.1: Create sp500-history.json
**Objective**: Create historical tracking file for S&P 500 index

**Steps**:
1. Create file: `backend/data/sp500-history.json`
2. Add metadata section:
   ```json
   {
     "index": "S&P-500",
     "lastUpdated": "2025-11-02",
     "metadata": {
       "source": "...",
       "coverage": "2021-09-01 to 2025-10-30",
       "totalChanges": <count>,
       "notes": "..."
     }
   }
   ```
3. Add changes array with each event:
   ```json
   {
     "symbol": "...",
     "addedDate": "YYYY-MM-DD" or null,
     "removedDate": "YYYY-MM-DD" or null,
     "notes": "..."
   }
   ```
4. Sort changes by symbol alphabetically
5. Count total changes and update metadata

**Format Verification**:
- All dates in YYYY-MM-DD format
- addedDate < removedDate (when both present)
- No duplicate symbols
- Every entry has notes field

**Estimated Time**: 30 minutes

---

#### Task 2.2: Create sp500.json Configuration
**Objective**: Create portfolio configuration file for S&P 500

**Steps**:
1. Copy `nasdaq100.json` as template
2. Update metadata:
   - `"name": "S&P 500"`
   - `"description": "Portfolio backtest for S&P 500 component stocks"`
3. Update capital settings:
   - `"totalCapitalUsd": 10000000` (10M)
   - Keep `"marginPercent": 20`
4. Update date range if needed (or keep same as NASDAQ-100)
5. Keep all `globalDefaults` sections identical
6. Update `indexTracking`:
   ```json
   "indexTracking": {
     "enabled": true,
     "indexName": "S&P-500",
     "enforceMembership": true,
     "handleRemovals": "liquidate_positions"
   }
   ```
7. Keep `capitalOptimization` section identical
8. Replace `stocks` array with S&P 500 stock list from Task 1.1
9. Keep `stockSpecificOverrides` as empty object

**Format Verification**:
- Valid JSON syntax
- All required fields present
- Stock array contains ~500 symbols
- No duplicate stock symbols
- Dates in YYYY-MM-DD format

**Estimated Time**: 15 minutes

---

### Phase 3: Validation & Testing

#### Task 3.1: Validate JSON Files
**Objective**: Ensure files are syntactically correct and semantically valid

**Steps**:
1. Validate sp500-history.json:
   ```bash
   node -e "const data = require('./backend/data/sp500-history.json'); console.log('✅ Valid JSON'); console.log('Total changes:', data.changes.length);"
   ```

2. Validate sp500.json:
   ```bash
   node -e "const data = require('./backend/configs/portfolios/sp500.json'); console.log('✅ Valid JSON'); console.log('Total stocks:', data.stocks.length);"
   ```

3. Check for duplicates in stock list:
   ```bash
   node -e "const data = require('./backend/configs/portfolios/sp500.json'); const dups = data.stocks.filter((s,i) => data.stocks.indexOf(s) !== i); console.log(dups.length ? 'Duplicates: ' + dups : '✅ No duplicates');"
   ```

4. Verify date formats in history file:
   ```bash
   node -e "const data = require('./backend/data/sp500-history.json'); const regex = /^\d{4}-\d{2}-\d{2}$/; const invalid = data.changes.filter(c => (c.addedDate && !regex.test(c.addedDate)) || (c.removedDate && !regex.test(c.removedDate))); console.log(invalid.length ? 'Invalid dates found' : '✅ All dates valid');"
   ```

**Expected Output**:
- All validation checks pass
- No syntax errors
- No duplicates
- All dates properly formatted

**Estimated Time**: 10 minutes

---

#### Task 3.2: Integration Testing
**Objective**: Verify configuration works with portfolio backtest API

**Prerequisites**:
- Backend server running on port 3001
- Database accessible (if needed)

**Test Script**:
```bash
#!/bin/bash

echo "Testing S&P 500 Portfolio Configuration"
echo "========================================"

# Test 1: Load configuration
echo ""
echo "Test 1: Loading sp500.json via API..."
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{"configFile": "sp500.json", "startDate": "2024-01-01", "endDate": "2024-01-31"}' \
  > /tmp/sp500_test_result.json 2>&1

# Check response
if grep -q "success" /tmp/sp500_test_result.json; then
  echo "✅ Configuration loaded successfully"
else
  echo "❌ Configuration failed to load"
  cat /tmp/sp500_test_result.json
  exit 1
fi

# Test 2: Verify index tracking loaded
echo ""
echo "Test 2: Checking index tracking service..."
if grep -q "S&P-500" /tmp/server_debug.log 2>/dev/null; then
  echo "✅ Index tracking service loaded S&P-500 history"
else
  echo "⚠️  Could not verify index tracking (check server logs manually)"
fi

# Test 3: Check results structure
echo ""
echo "Test 3: Validating response structure..."
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/sp500_test_result.json', 'utf8'));
if (data.success && data.data) {
  console.log('✅ Response has correct structure');
  console.log('   Stocks processed:', data.data.stockResults?.length || 'unknown');
  console.log('   Portfolio results:', data.data.portfolioSummary ? '✅' : '❌');
} else {
  console.log('❌ Response structure invalid');
  process.exit(1);
}
"

echo ""
echo "========================================"
echo "Integration testing complete!"
```

**Manual Verification**:
1. Check server logs for any errors
2. Verify index tracking service loaded sp500-history.json
3. Confirm backtest processed stocks from config
4. Check that stocks outside membership period were skipped

**Expected Outcome**:
- All tests pass
- No errors in server logs
- Backtest completes successfully
- Index tracking enforced correctly

**Estimated Time**: 15 minutes

---

### Phase 4: Documentation

#### Task 4.1: Document Limitations & Coverage
**Objective**: Create clear documentation of what's included and known gaps

**Create**: `backend/configs/portfolios/README.md` (if doesn't exist) or update existing

**Content to Add**:
```markdown
## S&P 500 Portfolio Configuration

### Overview
- **File**: `sp500.json`
- **Stocks**: ~500 S&P 500 component stocks
- **Capital**: $10M USD
- **Date Range**: 2021-09-02 to 2025-10-30
- **Features**: Full feature parity with NASDAQ-100 config

### Survival Bias Handling
- **Historical Tracking**: `backend/data/sp500-history.json`
- **Coverage**: 2021-09-01 to 2025-10-30
- **Source**: S&P Dow Jones Indices press releases and financial news
- **Limitations**:
  - [Document any gaps in historical data]
  - [Note if exact dates are uncertain for some events]

### Stock List Snapshot
- **Date**: 2025-11-02
- **Count**: [exact number] stocks
- **Source**: [source used]
- **Notes**:
  - Multiple share classes included where both are in index (e.g., GOOG/GOOGL)
  - Current constituents as of snapshot date

### Usage
```bash
# Via API
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{"configFile": "sp500.json"}'
```

### Maintenance
- Update quarterly with index rebalancing changes
- Verify stock symbols remain valid
- Extend historical tracking as needed
```

**Estimated Time**: 10 minutes

---

#### Task 4.2: Update CLAUDE.md (if needed)
**Objective**: Document new configuration for future reference

**Add Section** (if portfolio configs not already documented):
```markdown
## Portfolio Configurations

Available portfolio backtest configurations:

### NASDAQ-100
- **File**: `backend/configs/portfolios/nasdaq100.json`
- **Stocks**: ~100 stocks
- **Historical Tracking**: `backend/data/nasdaq100-history.json`

### S&P 500
- **File**: `backend/configs/portfolios/sp500.json`
- **Stocks**: ~500 stocks
- **Historical Tracking**: `backend/data/sp500-history.json`

All portfolio configs include:
- Index tracking for survival bias elimination
- Capital optimization strategies
- Beta scaling support
- Advanced trading features
```

**Estimated Time**: 5 minutes

---

## Task Summary

| Phase | Task | Estimated Time | Priority |
|-------|------|----------------|----------|
| 1.1 | Compile S&P 500 stock list | 30 min | High |
| 1.2 | Research historical changes | 1-2 hours | High |
| 2.1 | Create sp500-history.json | 30 min | High |
| 2.2 | Create sp500.json | 15 min | High |
| 3.1 | Validate JSON files | 10 min | High |
| 3.2 | Integration testing | 15 min | High |
| 4.1 | Document limitations | 10 min | Medium |
| 4.2 | Update CLAUDE.md | 5 min | Low |

**Total Estimated Time**: 2-3 hours

## Task Dependencies

```
1.1 (Stock List) ──┐
                   ├──> 2.2 (Create sp500.json) ──┐
1.2 (Historical) ──┼──> 2.1 (Create history.json) ┤
                   │                                ├──> 3.1 (Validate) ──> 3.2 (Test) ──> 4.1, 4.2 (Docs)
                   └────────────────────────────────┘
```

**Critical Path**: Research (1.1, 1.2) → File Creation (2.1, 2.2) → Validation (3.1, 3.2)

## Success Criteria Checklist

- [ ] S&P 500 stock list compiled (~500 stocks)
- [ ] Historical changes researched (2021-2025)
- [ ] sp500-history.json created and validated
- [ ] sp500.json created and validated
- [ ] JSON syntax validated
- [ ] No duplicate stocks
- [ ] Integration test passes
- [ ] Index tracking works correctly
- [ ] Documentation complete
- [ ] Known limitations documented

## Notes

- **Parallel Work**: Task 1.1 and 1.2 can be done concurrently
- **Iterative Refinement**: Historical data can be refined over time as more sources are found
- **Testing Environment**: Need backend server running for integration testing
- **Research Time**: Historical research is the most time-consuming task; focus on major events first
