# Tasks: Batch Top Results Display

## Implementation Tasks

### 1. Update Result Limiting Logic ✅
- [x] Change `getTop2UniquePerStock` to `getTopNPerStock(results, n)`
- [x] Update function to accept `n` parameter for flexible limiting
- [x] Remove "unique configuration" logic (just take top N by totalReturn)
- [x] Update call to use `getTopNPerStock(filteredByFilters, 5)` for all stocks view
- [x] Change single stock limit from `slice(0, 5)` to `slice(0, 10)`

### 2. Update UI Labels ✅
- [x] Update "All Stocks" dropdown label to show "top 5 per stock"
- [x] Update individual stock labels to show "top 10 of X results"
- [x] Ensure result counts are accurate

### 3. Testing ✅
- [x] Test single stock filter (verify 10 results)
- [x] Test multiple stocks view (verify 5 per stock)
- [x] Test with coefficient filter
- [x] Test edge cases (stocks with fewer than required results)

## Testing Commands

### Single Stock Batch Test
```bash
curl -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL"],
    "parameterRanges": {
      "profitRequirement": [0.03, 0.05, 0.07, 0.10, 0.12, 0.15, 0.18, 0.20, 0.25, 0.30],
      "gridIntervalPercent": [0.05, 0.10, 0.15],
      "maxLotsToSell": [1, 2]
    }
  }'
```

### Multiple Stocks Batch Test
```bash
curl -X POST http://localhost:3001/api/backtest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "MSFT", "GOOGL"],
    "parameterRanges": {
      "profitRequirement": [0.05, 0.10, 0.15],
      "gridIntervalPercent": [0.05, 0.10],
      "maxLotsToSell": [1, 2]
    }
  }'
```

## Completion Criteria

- [x] Single stock shows top 10 results
- [x] Multiple stocks show top 5 per stock
- [x] UI labels accurately reflect counts
- [x] All existing functionality preserved
- [x] Tested with various scenarios
