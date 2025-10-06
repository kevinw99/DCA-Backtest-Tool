# Spec #20: Batch Top Results Display

## Overview
Improve batch backtest results display to show optimal number of results based on whether a single stock or multiple stocks are being analyzed.

## Problem Statement
Currently, batch results show top 2 unique configurations per stock when viewing all stocks. This doesn't provide enough visibility into the best performing parameter combinations, especially when analyzing a single stock where users want to see more options.

## Requirements

### Display Rules
1. **Single Stock Mode**: When filtering by a single stock, display top 10 best results sorted by Total Return %
2. **Multiple Stocks Mode**: When viewing all stocks or multiple stocks, display top 5 best results per stock sorted by Total Return %

### Sorting
- Primary sort: Total Return % (descending)
- Results should already be sorted by the backend

### UI Updates
- Update filter dropdown text to reflect new limits:
  - "All Stocks (top 5 per stock, X total results)"
  - "SYMBOL (top 10 of X results)"

### Backward Compatibility
- Maintain existing filter functionality (stock filter, coefficient filter)
- Keep existing "Run" button behavior
- Preserve all existing metrics and columns

## Success Criteria
1. Single stock filter shows exactly 10 best results (or fewer if less than 10 exist)
2. Multiple stocks view shows top 5 per stock
3. Results are correctly sorted by Total Return % in descending order
4. UI labels accurately reflect the number of results shown

## Out of Scope
- Changing backend sorting logic (already sorts by totalReturn)
- Adding new metrics or columns
- Modifying the "Run" button functionality
