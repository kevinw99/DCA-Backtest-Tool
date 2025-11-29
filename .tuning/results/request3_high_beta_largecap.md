=== Request 3 (Fixed): High Beta Large Cap Portfolio ===

**Date:** Thu Nov 27 2025
**Config File:** backend/configs/portfolios/high_beta_largecap_v2.json

## Selection Criteria
- Market Cap: > $20 Billion
- Beta: > 1.5
- **Excludes Magnificent 7** (NVDA, AAPL, MSFT, GOOGL, AMZN, META, TSLA)
- Source: Yahoo Finance beta values via API

## Selected Stocks (10 Stocks)
| Symbol | Beta | Approx Market Cap |
|--------|------|-------------------|
| AMD | 1.91 | ~$220B |
| NFLX | 1.59 | ~$400B |
| ORCL | 1.53 | ~$450B |
| MU | 1.57 | ~$110B |
| SHOP | 2.59 | ~$140B |
| PLTR | 2.59 | ~$150B |
| ARM | 4.12 | ~$150B |
| AMAT | 1.81 | ~$180B |
| LRCX | 1.84 | ~$100B |
| MRVL | 1.94 | ~$75B |

**Average Beta:** ~2.24

## Base Parameters (Rounded Beta-Scaled)
| Parameter | Base Value |
|-----------|------------|
| gridIntervalPercent | 5% |
| profitRequirement | 10% |
| trailingBuyActivationPercent | 5% |
| trailingBuyReboundPercent | 2.5% |
| trailingSellActivationPercent | 15% |
| trailingSellPullbackPercent | 7.5% |
| enableBetaScaling | true |
| betaScalingCoefficient | 1.0 |

## Portfolio Results
| Metric | DCA Portfolio | Buy & Hold |
|--------|---------------|------------|
| Total Capital | $1,000,000 | $1,000,000 |
| CAGR | **14.1%** | 22.1% |
| Total Return | 74.9% | 133.4% |
| Max Drawdown | **19.6%** | 56.1% |
| Sharpe Ratio | **0.96** | 0.77 |
| Total Trades | 95 | - |
| Win Rate | 100% | - |

## Analysis
- **CAGR Comparison:** B&H outperforms DCA by 8% CAGR
- **Risk Comparison:** DCA has **36.5%** lower max drawdown (19.6% vs 56.1%)
- **Sharpe Comparison:** DCA has **24%** better risk-adjusted returns (0.96 vs 0.77)
- **Trade Activity:** 95 trades over 4+ years, 100% win rate

## Key Insight
This non-Mag7 high-beta portfolio shows the same pattern:
- **DCA sacrifices returns** (~8% lower CAGR)
- **DCA dramatically reduces risk** (56% → 20% max drawdown)
- **DCA has better Sharpe ratio** (better risk-adjusted returns)

For risk-averse investors wanting exposure to high-beta growth stocks, DCA grid trading provides a much smoother ride.

## URLs

**Frontend URL:**
```
http://localhost:3000/portfolio-backtest?config=high_beta_largecap_v2
```

**API Curl Command:**
```bash
curl -X POST http://localhost:3001/api/backtest/portfolio/config \
  -H "Content-Type: application/json" \
  -d '{"configFile": "high_beta_largecap_v2.json"}'
```

## Free Stock Screener Links

**Finviz Screener (Manual Beta Check):**
```
https://finviz.com/screener.ashx?v=111&f=cap_largeover&ft=4&o=-marketcap
```
- Filter: Market Cap = Large ($10B+) or Mega ($200B+)
- Then check Beta column > 1.5

**Yahoo Finance Screener:**
```
https://finance.yahoo.com/screener/new
```
- Create custom screen: Market Cap > $20B, Beta > 1.5

**TradingView Screener:**
```
https://www.tradingview.com/screener/
```
- Filter: Market Cap > 20B, Beta > 1.5
