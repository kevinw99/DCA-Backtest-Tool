# Tasks: Max Stock Price History

## Task 1: Update YFinance Provider
- [ ] Change `period="5y"` to `period="max"` in `yfinanceProvider.js:21`
- [ ] Test with single stock to verify extended data retrieval
- [ ] Verify data format consistency

## Task 2: Create Rate Limiter Module
- [ ] Create `backend/services/rateLimiter.js`
- [ ] Implement `wait()` method with configurable delay
- [ ] Implement `executeWithRetry()` with exponential backoff
- [ ] Add jitter to prevent synchronized requests
- [ ] Handle 429 rate limit errors specifically
- [ ] Unit test rate limiter

## Task 3: Create Batch Update Script
- [ ] Create `backend/scripts/updateStockHistory.js`
- [ ] Define priority stock lists (Mag7, High Beta Large Cap)
- [ ] Implement stock ordering (priority first)
- [ ] Integrate with rate limiter
- [ ] Add CLI argument parsing (--priority, --symbols, --all, --resume-from, --dry-run)
- [ ] Add progress logging with ETA

## Task 4: Implement Progress Tracking
- [ ] Create progress file at `backend/data/update_progress.json`
- [ ] Save progress after each stock
- [ ] Implement resume functionality
- [ ] Generate summary report on completion

## Task 5: Implement Database Upsert
- [ ] Create upsert function for daily_prices
- [ ] Handle duplicate dates (ON CONFLICT DO UPDATE)
- [ ] Validate data before insert (no null prices)
- [ ] Use transactions for batch inserts

## Task 6: Update Priority Stocks
- [ ] Run script with --priority flag
- [ ] Update Mag7: NVDA, AAPL, MSFT, GOOGL, AMZN, META, TSLA
- [ ] Update High Beta: AMD, NFLX, ORCL, MU, SHOP, PLTR, ARM, AMAT, LRCX, MRVL
- [ ] Verify 20+ years of data for each (where available)
- [ ] Document actual date ranges obtained

## Task 7: Update All Stocks
- [ ] Run script with --all flag
- [ ] Monitor for rate limiting issues
- [ ] Handle any failed stocks with retry
- [ ] Generate final report

## Task 8: Verification & Documentation
- [ ] Query database to confirm extended history
- [ ] Test backtest with dates before 2020
- [ ] Update README with new data capabilities
- [ ] Document the update process for future use

## Completion Checklist
- [ ] All priority stocks have max available history
- [ ] All database stocks updated
- [ ] No rate limit blocks encountered
- [ ] Script is reusable for future updates
- [ ] Documentation complete
