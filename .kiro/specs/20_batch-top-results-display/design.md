# Design: Batch Top Results Display

## Architecture

### Component Changes
Only frontend changes needed in `BatchResults.js`:
- Modify filtering logic to detect single vs. multiple stocks
- Update result limiting based on stock count
- Update UI labels to reflect new limits

### Implementation Strategy

#### 1. Single Stock Detection
```javascript
const isSingleStockView = selectedStock !== 'all';
const stockCount = stocks.length;
```

#### 2. Result Limiting Logic
```javascript
// Current:
const filteredResults = selectedStock === 'all' && selectedBeta === 'all'
  ? getTop2UniquePerStock(filteredByFilters)  // Old: top 2 per stock
  : filteredByFilters.slice(0, 5);            // Old: top 5 when filtered

// New:
const filteredResults = selectedStock === 'all' && selectedBeta === 'all'
  ? getTopNPerStock(filteredByFilters, 5)     // New: top 5 per stock
  : filteredByFilters.slice(0, 10);           // New: top 10 when single stock
```

#### 3. Function Refactoring
Rename and update `getTop2UniquePerStock` to `getTopNPerStock`:
- Accept parameter `n` for number of results per stock
- Keep existing logic for grouping by stock
- Change limit from 2 to `n`
- Remove "unique configuration" logic (not needed - just take top N)

#### 4. UI Label Updates
```javascript
// Dropdown label for "All Stocks" option:
`All Stocks (top 5 per stock, ${filteredResults.length} total results)`

// Dropdown label for individual stock:
`${stock} (top 10 of ${stockResultsCount} results)`
```

## Data Flow

```
Backend Results (sorted by totalReturn desc)
  ↓
Filter by selected stock/coefficient
  ↓
Apply limiting logic:
  - Single stock → top 10
  - Multiple stocks → top 5 per stock
  ↓
Display in table
```

## Edge Cases

1. **Less than required results**: If stock has fewer than 10 results, show all available
2. **Coefficient filter applied**: When both stock and coefficient filters are active, still show top 10
3. **No results**: Existing "No batch results available" message should still work

## Testing Strategy

### Test Case 1: Single Stock
- Filter by single stock (e.g., AAPL)
- Verify exactly 10 results shown (or fewer if less than 10 exist)
- Verify results sorted by Total Return % descending

### Test Case 2: Multiple Stocks
- Select "All Stocks"
- Verify top 5 results per stock
- Verify correct total count in dropdown label

### Test Case 3: With Coefficient Filter
- Select single stock + specific coefficient
- Verify top 10 results for that combination

### Test Case 4: Edge Cases
- Stock with only 3 results → show all 3
- Single stock with 100 results → show exactly 10

## Files to Modify

1. **frontend/src/components/BatchResults.js**
   - Lines 150-220: Update filtering and limiting logic
   - Line 176: Rename function `getTop2UniquePerStock` → `getTopNPerStock`
   - Line 162: Update limiting from `slice(0, 5)` to `slice(0, 10)`
   - Line 161: Update call to `getTopNPerStock(filteredByFilters, 5)`
   - Lines 390-399: Update dropdown option labels

No backend changes required - sorting is already correct.
