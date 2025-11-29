=== Request 4: Research - Survival Bias in Beta Numbers ===

**Date:** Thu Nov 27 2025

## Does Beta Have Survival Bias?

**Yes, beta values suffer from survival bias in two ways:**

### 1. Current Beta Only Reflects Surviving Companies
- Today's beta values are only calculated for stocks that still exist
- Companies that went bankrupt, were delisted, or merged don't have current beta values
- This creates selection bias when screening for high/low beta stocks

### 2. Historical Beta Values Change Over Time
- A stock's beta today may be very different from its beta 5 years ago
- Companies often start with higher beta when small/risky and beta decreases as they mature
- Using current beta to filter historical backtests introduces look-ahead bias

## Magnitude of Survival Bias

According to research:
- **North America:** Going back 10 years, datasets with survival bias are missing ~75% of stocks that were trading at that time
- **Europe:** About 50% of stocks would be missing over 10 years
- **Asia:** About 25% would be missing over 10 years
- **Impact:** Research shows look-ahead benchmark bias is 7-8% per annum for US/German stocks

From 1926-2015:
- Only 42.1% of common stocks returned more than short-term Treasuries
- Median stock lifespan was only 7 years before delisting/buyout/merger

## How to Mitigate Beta Survival Bias

### Option 1: Use Survivorship Bias-Free Data Providers
- **[Norgate Data](https://www.norgate.com/)** - Specialty in survivorship bias-free data for US/Australian markets
- **[CRSP](https://www.crsp.org/)** (Center for Research in Security Prices) - Academic standard, includes delisted stocks
- **[Dimensional Fund Advisors](https://www.dimensional.com/)** - Complete historical datasets including delisted stocks

### Option 2: Get Historical Beta Values
Several providers offer historical (time-series) beta:
- **[Bloomberg](https://libguides.babson.edu/beta/Bloomberg)** - Historical beta with adjustable dates, weekly data over 2 years
- **[WRDS Beta Suite](https://wrds-www.wharton.upenn.edu/)** - Calculate beta on daily/weekly/monthly frequencies
- **[CRSP via WRDS](https://library.bu.edu/c.php?g=541045&p=3705853)** - Annual betas available back to 1962
- **[Datastream](https://libanswers.london.edu/faq/175650)** - Historical beta calculated against local index, monthly frequency

### Option 3: Calculate Point-in-Time Beta
- Calculate beta at each historical point in time, not just current beta
- This requires full price history for both stock and benchmark
- Tools like WRDS Beta Suite can do this

## Practical Recommendations for Your Backtests

1. **Accept the limitation:** For free data sources like Yahoo Finance, survival bias is unavoidable
2. **Use conservative assumptions:** Assume delisted stocks would have had poor performance
3. **Diversify:** Don't concentrate too heavily in high-beta stocks
4. **Consider time-weighted beta:** Use 1-year rolling beta instead of 5-year trailing beta
5. **Monitor**: Check if high-beta stocks from 5 years ago are still high-beta today

## Stocks That May Have Changed Beta Significantly

Example: A stock screened for "beta > 1.5" today might have had:
- Lower beta in the past (company was more stable)
- Higher beta in the past (company was riskier/smaller)
- No beta data at all (company didn't exist or was private)

## Sources
- [QuantRocket: Survivorship Bias Primer](https://www.quantrocket.com/blog/survivorship-bias/)
- [Quant Stack Exchange: Survival Bias in Backtesting](https://quant.stackexchange.com/questions/49753/survival-bias-when-backtesting)
- [Penn Library: Historical Betas FAQ](https://faq.library.upenn.edu/business/faq/45560)
- [Boston U: Historical Beta Tutorial](https://library.bu.edu/c.php?g=541081&p=3706309)
- [CRSP Historical Indexes](https://www.crsp.org/research/crsp-historical-indexes/)
