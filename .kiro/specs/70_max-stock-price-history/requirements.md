# Requirements: Max Stock Price History

## Background

Currently, the Yahoo Finance provider fetches only 5 years of historical data (`period="5y"`). Users need longer historical data for backtesting strategies over extended periods (10+ years). The database currently has 557 stocks with data from ~2020 to present.

## Goals

1. Change Yahoo Finance data fetching from 5 years to maximum available history
2. Implement rate limiting to avoid exceeding Yahoo Finance API limits
3. Update priority stocks (Mag7 + High Beta Large Cap) first
4. Update all 557 stocks in database with extended history

## Functional Requirements

### FR-1: Update YFinance Provider
- Change `period="5y"` to `period="max"` in `yfinanceProvider.js`
- This will fetch all available historical data (typically 20-30 years for major stocks)

### FR-2: Rate Limiting System
- Implement rate limiter to prevent API throttling
- Yahoo Finance unofficial limits: ~2000 requests/hour, ~100 requests/minute
- Conservative target: 1 request per 2 seconds (30 requests/minute)
- Add configurable delay between requests
- Add retry logic with exponential backoff for failed requests

### FR-3: Batch Update Script
- Create a script to update stock data in batches
- Priority order:
  1. Mag7 stocks: NVDA, AAPL, MSFT, GOOGL, AMZN, META, TSLA
  2. High Beta Large Cap: AMD, NFLX, ORCL, MU, SHOP, PLTR, ARM, AMAT, LRCX, MRVL
  3. All remaining stocks in database
- Track progress and allow resume on interruption
- Log success/failure for each stock

### FR-4: Data Integrity
- Merge new historical data with existing data (don't delete existing)
- Handle duplicate dates gracefully (upsert)
- Validate data before inserting (no null prices)

## Non-Functional Requirements

### NFR-1: Performance
- Batch update should complete within 3 hours for all 557 stocks
- At 2 seconds per stock: 557 * 2 = 1114 seconds (~19 minutes)
- Allow for retries and delays: target < 1 hour total

### NFR-2: Reliability
- Save progress to allow resume after interruption
- Log all operations for debugging
- Handle network errors gracefully

### NFR-3: Safety
- Never exceed 60 requests per minute
- Add jitter to avoid thundering herd
- Respect rate limit errors (HTTP 429) with longer backoff

## Success Criteria

1. Mag7 stocks have 20+ years of data (where available)
2. High Beta Large Cap stocks have 20+ years of data
3. All database stocks updated without API blocking
4. No data corruption or loss
