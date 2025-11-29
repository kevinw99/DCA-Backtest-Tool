=== Request 6: Research - Extended Stock Price History Sources ===

**Date:** Thu Nov 27 2025

## Current Limitation

Your DCA Backtest Tool currently uses Yahoo Finance data, which typically provides ~5 years of adjusted daily price history for free.

## Options for Longer Historical Data (10, 15, 20+ Years)

### Free Options

| Provider | Coverage | Features | Limitations |
|----------|----------|----------|-------------|
| **[yfinance](https://github.com/ranaroussi/yfinance)** | ~20 years (some stocks) | Python library, easy to use | Unofficial scraping, can break |
| **[Alpha Vantage](https://www.alphavantage.co/)** | 20+ years | Free tier (25/day), Excel support | Rate limited |
| **[Stooq](https://stooq.com/)** | 20+ years | Free download, global markets | Manual download only |

### Low-Cost Options ($20-50/month)

| Provider | Coverage | Cost | Features |
|----------|----------|------|----------|
| **[EODHD](https://eodhd.com/)** | 30+ years | $19.99/mo | 150K+ tickers globally, Ford from 1972 |
| **[Financial Modeling Prep](https://financialmodelingprep.com/)** | 30+ years | $14/mo | SEC filings, fundamentals |
| **[Polygon.io](https://polygon.io/)** | 20 years | $29/mo | Every trade/quote, REST + WebSocket |
| **[Tiingo](https://www.tiingo.com/)** | 15+ years | $10/mo | JSON API, good documentation |

### Premium Options ($100+/month)

| Provider | Coverage | Cost | Features |
|----------|----------|------|----------|
| **[Norgate Data](https://norgatedata.com/)** | 1990s-present | $79/mo | Survivorship bias-free, delisted stocks |
| **[Intrinio](https://intrinio.com/)** | 30+ years | Custom | Institutional grade |
| **[Quandl/NASDAQ Data Link](https://data.nasdaq.com/)** | Varies | Custom | Multiple datasets |

### Academic/Research Grade

| Provider | Coverage | Access | Features |
|----------|----------|--------|----------|
| **[CRSP](https://www.crsp.org/)** | 1925-present | University subscription | Gold standard, includes delisted |
| **[Compustat](https://wrds-www.wharton.upenn.edu/)** | 1950s-present | University subscription | Fundamentals + prices |
| **[WRDS](https://wrds-www.wharton.upenn.edu/)** | Varies | University subscription | Aggregates CRSP, Compustat, etc. |

## Coverage Comparison

```
Time Period Coverage by Provider:

1925|-------------------------------------> CRSP
1950|-------------------------> Compustat
1972|--------------------> EODHD (some stocks like Ford)
1990|-------------> Norgate Data
2000|--------> Yahoo Finance (max)
2005|------> Polygon.io
2020|-> Free Yahoo
     ^
     2025
```

## Practical Recommendations

### For 10-Year Backtests
- **Free:** yfinance (Python) often has 10+ years for major stocks
- **Low-cost:** EODHD ($20/mo) or Tiingo ($10/mo)

### For 15-20 Year Backtests
- **Low-cost:** EODHD or FMP ($15-20/mo)
- **Best quality:** Norgate Data ($79/mo) - survivorship bias-free

### For 30+ Year Backtests (Academic Quality)
- **With university access:** CRSP through WRDS
- **Without:** EODHD or Norgate Data

## How to Get More Years from Yahoo Finance

Yahoo Finance actually has more data than 5 years for many stocks, but the free download is limited. Options:

1. **yfinance Python library:** Can fetch full history
   ```python
   import yfinance as yf
   data = yf.download("AAPL", start="1990-01-01", end="2025-01-01")
   ```

2. **Yahoo Finance Gold:** $50/month - extended download access

3. **Direct API calls:** Can sometimes fetch older data

## Testing Data Availability

For your DCA tool, you can test how much history Yahoo provides:

```bash
# Test how far back Yahoo has data
curl -s "https://query1.finance.yahoo.com/v8/finance/chart/AAPL?period1=0&period2=9999999999&interval=1d" | jq '.chart.result[0].meta.firstTradeDate'
```

## Data Quality Considerations

When using long-term data:
1. **Adjust for splits:** Use adjusted close prices
2. **Survivorship bias:** Use providers that include delisted stocks
3. **Data gaps:** Older data may have missing days
4. **Corporate actions:** Mergers, spin-offs affect continuity

## Recommended Links

- **Free:** [yfinance GitHub](https://github.com/ranaroussi/yfinance)
- **Low-cost:** [EODHD](https://eodhd.com/) - 30+ years, $20/mo
- **Premium:** [Norgate Data](https://norgatedata.com/) - Survivorship bias-free
- **Academic:** [CRSP](https://www.crsp.org/) via [WRDS](https://wrds-www.wharton.upenn.edu/)

## Sources
- [AlgoTrading101: Yahoo Finance API Guide](https://algotrading101.com/learn/yahoo-finance-api-guide/)
- [FMP: Yahoo Finance Alternatives](https://site.financialmodelingprep.com/education/other/Best-Alternatives-to-Yahoo-Finance-for-Downloading-Historical-Stock-Data)
- [EODHD: Beyond Yahoo Finance](https://eodhd.com/financial-academy/fundamental-analysis-examples/beyond-yahoo-finance-api-alternatives-for-financial-data)
- [Norgate Data Overview](https://norgatedata.com/)
- [Polygon Stock API](https://polygon.io/stocks)
- [CRSP Historical Indexes](https://www.crsp.org/research/crsp-historical-indexes/)
