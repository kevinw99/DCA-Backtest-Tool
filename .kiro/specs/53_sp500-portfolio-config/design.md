# Spec 53: S&P 500 Portfolio Configuration - Design

## Architecture Overview

This spec creates configuration files and data files only. No code changes are required as the existing portfolio backtest infrastructure fully supports the new S&P 500 configuration.

```
backend/
├── configs/
│   └── portfolios/
│       ├── nasdaq100.json          (existing reference)
│       └── sp500.json              (NEW - mirrors nasdaq100 structure)
├── data/
│   ├── nasdaq100-history.json      (existing reference)
│   └── sp500-history.json          (NEW - tracks S&P 500 changes)
└── services/
    ├── indexTrackingService.js     (existing - no changes)
    ├── portfolioConfigLoader.js    (existing - no changes)
    └── portfolioBacktestService.js (existing - no changes)
```

## File Specifications

### 1. sp500.json Structure

```json
{
  "name": "S&P 500",
  "description": "Portfolio backtest for S&P 500 component stocks",
  "totalCapitalUsd": 10000000,
  "marginPercent": 20,
  "startDate": "2021-09-02",
  "endDate": "2025-10-30",
  "globalDefaults": {
    "basic": { /* same as nasdaq100 */ },
    "longStrategy": { /* same as nasdaq100 */ },
    "shortStrategy": { /* same as nasdaq100 */ },
    "beta": { /* same as nasdaq100 */ },
    "dynamicFeatures": { /* same as nasdaq100 */ },
    "adaptiveStrategy": { /* same as nasdaq100 */ }
  },
  "indexTracking": {
    "enabled": true,
    "indexName": "S&P-500",
    "enforceMembership": true,
    "handleRemovals": "liquidate_positions"
  },
  "capitalOptimization": { /* same as nasdaq100 */ },
  "stocks": [ /* array of ~500 S&P 500 symbols */ ],
  "stockSpecificOverrides": {}
}
```

**Key Design Decisions**:

1. **Capital Allocation**: 10M USD (vs 3M for NASDAQ-100)
   - **Reasoning**: S&P 500 has ~500 stocks vs NASDAQ-100's ~100 stocks
   - **Calculation**: 3M × (500/100) = 15M, but reduced to 10M for practical testing
   - **Per-stock allocation**: ~20K USD per stock on average

2. **Date Range**: Same as NASDAQ-100 (2021-09-02 to 2025-10-30)
   - **Reasoning**: Allows direct comparison between indices
   - **Coverage**: ~4 years of trading data

3. **Strategy Parameters**: Identical to NASDAQ-100
   - **Reasoning**: Proven conservative parameters
   - **Flexibility**: Users can override via URL parameters

4. **Index Name**: "S&P-500" (with hyphen)
   - **Reasoning**: Consistent with "NASDAQ-100" naming pattern
   - **Note**: IndexTrackingService converts to "sp500-history.json" filename

### 2. sp500-history.json Structure

```json
{
  "index": "S&P-500",
  "lastUpdated": "2025-11-02",
  "metadata": {
    "source": "S&P Dow Jones Indices press releases and financial news",
    "coverage": "2021-09-01 to 2025-10-30",
    "totalChanges": "<number of tracked changes>",
    "notes": "Quarterly rebalancing. Special additions/removals as needed. Multiple share classes counted separately."
  },
  "changes": [
    {
      "symbol": "TICKER",
      "addedDate": "YYYY-MM-DD",
      "removedDate": "YYYY-MM-DD" or null,
      "notes": "Reason for change"
    }
    // ... more changes
  ]
}
```

**Change Event Types to Track**:
1. **Annual/Quarterly Rebalancing**: Scheduled index reconstitution
2. **Mergers/Acquisitions**: Company acquired and delisted
3. **Bankruptcies**: Company went bankrupt
4. **Spin-offs**: New company spun off and added
5. **IPOs**: New listing that met criteria
6. **Failed Criteria**: Company no longer met index requirements (market cap, liquidity, etc.)

**Data Quality Standards**:
- Date format: YYYY-MM-DD (ISO 8601)
- `addedDate`: First trading day as S&P 500 component
- `removedDate`: Last trading day as S&P 500 component (null if still in index)
- `notes`: Brief explanation of change (1-2 sentences)

### 3. Integration with Existing Systems

#### IndexTrackingService Integration

**Filename Resolution**:
```javascript
// indexName: "S&P-500"
// fileName: "sp500-history.json"
const fileName = indexName.toLowerCase().replace(/[^a-z0-9]/g, '') + '-history.json';
// "S&P-500" → "sp500" → "sp500-history.json" ✅
```

**Usage Flow**:
1. Portfolio config loaded by `portfolioConfigLoader.js`
2. `indexTracking.indexName` = "S&P-500" detected
3. `IndexTrackingService.loadIndexHistory("S&P-500")` called
4. Loads `backend/data/sp500-history.json`
5. During backtest, `isInIndex(symbol, date)` checked for each stock/day
6. Stocks traded only during valid membership periods

#### Portfolio Backtest API Usage

**Endpoint**: `POST /api/backtest/portfolio`

**Request Body**:
```json
{
  "configFile": "sp500.json"
}
```

**Behavior**:
- Loads `backend/configs/portfolios/sp500.json`
- Loads `backend/data/sp500-history.json` (via IndexTrackingService)
- Runs backtest across ~500 stocks
- Enforces index membership per historical data
- Returns aggregated portfolio results

## Stock List Compilation Strategy

### Data Sources (Priority Order)

1. **Primary**: S&P Dow Jones Indices official website
2. **Secondary**: Wikipedia S&P 500 component list (updated frequently)
3. **Tertiary**: Yahoo Finance S&P 500 screener
4. **Validation**: Cross-reference multiple sources

### Stock Selection Criteria

**Include**:
- All current S&P 500 components as of spec creation date (2025-11-02)
- Both share classes if both are in index (e.g., GOOG and GOOGL)
- Use most common trading symbol

**Exclude**:
- Delisted companies (unless they were components during backtest period)
- Stocks that IPO'd after backtest end date
- Non-US traded stocks

### Organization

**Sorting**: Alphabetical by ticker symbol (for easy maintenance)

**Format**: JSON array of strings
```json
"stocks": [
  "A",
  "AAL",
  "AAPL",
  // ... ~500 more
  "ZTS"
]
```

## Historical Tracking Data Strategy

### Research Approach

**Time Period**: 2021-09-01 to 2025-10-30 (4+ years)

**Sources**:
1. S&P Dow Jones Indices press releases
2. Financial news archives (Bloomberg, Reuters, WSJ)
3. Wikipedia historical edit history
4. SEC filings and announcements

**Focus Areas**:
- Quarterly index rebalancing announcements
- Major corporate events (mergers, bankruptcies)
- High-profile additions (recent IPOs like Airbnb, Snowflake)
- Notable removals (fallen companies)

### Documentation Standard

**Complete Entry Example**:
```json
{
  "symbol": "TSLA",
  "addedDate": "2020-12-21",
  "removedDate": null,
  "notes": "Added December 2020 as largest company ever added to S&P 500 by market cap"
}
```

**Partial Information Example**:
```json
{
  "symbol": "XYZ",
  "addedDate": null,
  "removedDate": "2023-06-15",
  "notes": "Removed due to acquisition by ABC Corp. Addition date uncertain (pre-2021)."
}
```

### Coverage Strategy

**High Priority** (must track):
- All additions during 2021-2025
- All removals during 2021-2025
- Current constituents (as of 2025-11-02)

**Medium Priority** (track if findable):
- Exact dates for pre-2021 additions
- Corporate action details
- Historical notes and context

**Low Priority** (nice to have):
- Pre-2020 addition dates for stocks already in index
- Minor technical changes
- Symbol changes

## Validation & Testing

### Configuration Validation

**Checks**:
1. JSON syntax valid
2. All required fields present
3. Date formats correct (YYYY-MM-DD)
4. Numbers are valid (no negative capital, etc.)
5. Index name matches expected format
6. Stock symbols unique (no duplicates)

**Tool**: Use Node.js to load and validate JSON structure

### Historical Data Validation

**Checks**:
1. JSON syntax valid
2. All dates in YYYY-MM-DD format
3. `addedDate` < `removedDate` (when both present)
4. No duplicate symbols
5. Dates within reasonable range (not future dates)
6. Notes field present for all entries

**Tool**: Simple validation script

### Integration Testing

**Manual Test**:
```bash
# Start backend server
cd backend && npm start

# Test portfolio backtest endpoint
curl -X POST http://localhost:3001/api/backtest/portfolio \
  -H "Content-Type: application/json" \
  -d '{"configFile": "sp500.json"}' \
  | jq '.'
```

**Expected Outcome**:
- Configuration loads successfully
- Historical tracking data loads successfully
- Backtest runs across all S&P 500 stocks
- Results returned with proper aggregation
- No errors in server logs

## Maintenance Considerations

### Future Updates

**Quarterly Index Changes**:
- Update `sp500-history.json` with new additions/removals
- Update `stocks` array in `sp500.json` to reflect current constituents
- Document in `lastUpdated` field

**Annual Review**:
- Verify stock symbols still valid
- Check for corporate actions (mergers, name changes)
- Update date range if extending backtest period

### Documentation

**Include in Spec**:
- Date of stock list snapshot
- Date of historical data coverage
- Known limitations or gaps in data
- Sources used for research

## Performance Considerations

### Backtest Duration

**Estimate**: ~500 stocks × 4 years × 252 trading days = ~504,000 stock-days

**Expected Runtime**:
- Single backtest: 30-60 seconds (depending on hardware)
- With index tracking: +5-10% overhead (minimal)

**Optimization**:
- Existing parallel processing in portfolioBacktestService
- Index tracking uses Map for O(1) lookups
- No code changes needed

### Memory Usage

**Estimate**:
- Price data: ~500 stocks × 1000 days × 100 bytes = ~50 MB
- Configuration: ~50 KB
- Historical tracking: ~20 KB
- Total: ~50-60 MB (well within limits)

## Success Metrics

1. **Configuration Complete**: sp500.json has all required fields
2. **Stock List Accurate**: ~500 S&P 500 component stocks included
3. **Historical Data Comprehensive**: Major changes from 2021-2025 tracked
4. **Integration Works**: Backtest runs successfully via API
5. **Feature Parity**: All nasdaq100.json features present
6. **Documentation Clear**: Coverage and limitations documented

## Rollback Plan

**If Issues Found**:
1. Configuration file is standalone (doesn't affect other configs)
2. Historical data file is standalone (doesn't affect other indices)
3. No code changes = no risk to existing functionality
4. Simply remove/fix the new files if problems occur

**No Risk to Existing System**: This is a pure data addition, not a code change
