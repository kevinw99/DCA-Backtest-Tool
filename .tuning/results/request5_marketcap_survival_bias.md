=== Request 5: Research - Survival Bias in Market Cap Filtering ===

**Date:** Thu Nov 27 2025

## Does Market Cap Filtering Have Survival Bias?

**Yes, market cap filtering suffers from multiple forms of survival bias:**

### 1. Only Surviving Companies Have Market Cap Data
- Delisted, bankrupt, or acquired companies don't appear in current market cap screens
- In North America, 75% of stocks trading 10 years ago have been delisted
- Your "large cap > $100B" screen today only includes survivors

### 2. Historical Market Cap Changes (Look-Ahead Bias)
- A company with $100B market cap today may have been $10B five years ago
- Using today's $100B threshold to backtest 2020 data is look-ahead bias
- Example: NVDA was ~$300B in 2021, now ~$3.5T (12x growth)

### 3. Inflation Effects
- $100B in 2025 ≠ $100B in 2015 in real terms
- Fixed market cap thresholds become more selective over time
- Better to use quantile-based thresholds (e.g., "top 10% by market cap")

### 4. Small Cap Delisting Bias
- Small-cap stocks delist more frequently than large-caps
- The "small-cap premium" discovered in research may be partly due to delisting bias
- Shumway and Warther (1999) attributed small-cap effect to delisting bias in CRSP

## How to Mitigate Market Cap Survival Bias

### Option 1: Use Point-in-Time Index Membership
Instead of market cap threshold, use historical index membership:
- **S&P 500** - Large cap at each point in time
- **Russell 1000/2000** - Large/small cap at each point in time
- **CRSP Index Family** - Various cap-based portfolios

These indices reconstitute periodically, giving you the actual large-cap universe at each historical date.

### Option 2: Historical Market Cap Data Providers
- **[CRSP](https://www.crsp.org/)** - Market cap back to 1925, includes delisted stocks
- **[Compustat](https://wrds-www.wharton.upenn.edu/)** - All US firms filing 10-K reports
- **[WRDS](https://wrds-www.wharton.upenn.edu/)** - Academic access to CRSP + Compustat
- **[World Bank WDI](https://data.worldbank.org/)** - Total market cap by country (free)
- **[Finaeon/Global Financial Data](https://www.finaeon.com/)** - Long-term historical data

### Option 3: Use Quantile-Based Thresholds
Instead of "$100B market cap":
- Use "top 5% by market cap" (adjusts for inflation automatically)
- Kenneth French publishes NYSE percentile breakpoints
- This gives a consistent large-cap definition over time

### Option 4: Accept the Limitation with Caveats
For retail investors using free data:
- Acknowledge backtests have survivorship bias
- Focus on well-established companies less likely to delist
- Use conservative assumptions
- Don't extrapolate to small-cap or speculative stocks

## Handling the "Former Large Cap" Scenario

**Question:** What about stocks that WERE >$100B but now aren't?

**Examples:**
- GE (General Electric) - Was $600B in 2000, now ~$200B
- Intel (INTC) - Was $500B in 2000, now ~$200B
- IBM - Was $250B in 2000, now ~$180B

**Solutions:**
1. Use historical S&P 500 membership (captures companies when they were large)
2. Use trailing 12-month average market cap to smooth fluctuations
3. Include companies that have ever been large-cap in your timeframe

## Historical Market Cap Data Sources (Summary)

| Provider | Coverage | Cost | Delisted? |
|----------|----------|------|-----------|
| CRSP | 1925-present | Paid (academic) | Yes |
| Compustat | 1950s-present | Paid (academic) | Yes |
| Yahoo Finance | 5 years | Free | No |
| EODHD | 30+ years | Paid | Some |
| Polygon.io | 2003-present | Paid | Some |
| Tiingo | 15+ years | Freemium | No |

## Practical Recommendations

1. **For academic rigor:** Use CRSP/Compustat through WRDS
2. **For retail investors:** Use index membership (S&P 500, Nasdaq 100) instead of market cap threshold
3. **Quick check:** Your backtest portfolio - how many stocks existed 5 years ago with similar market cap?

## Sources
- [QuantRocket: Survivorship Bias Primer](https://www.quantrocket.com/blog/survivorship-bias/)
- [CRSP Historical Indexes](https://www.crsp.org/research/crsp-historical-indexes/)
- [Tidy Finance: WRDS, CRSP, and Compustat](https://www.tidy-finance.org/r/wrds-crsp-and-compustat.html)
- [Daloopa: Best Sources for Historical Market Cap Data](https://daloopa.com/blog/analyst-best-practices/best-sources-for-historical-market-capitalization-data)
- [Quant SE: Survival Bias in Backtesting](https://quant.stackexchange.com/questions/49753/survival-bias-when-backtesting)
