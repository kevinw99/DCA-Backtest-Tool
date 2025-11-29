# Summary of All 6 Requests

**Date:** Thu Nov 27 2025
**Processed By:** Claude (Automated)

---

## Quick Reference - Frontend URLs

| Request | Portfolio | URL |
|---------|-----------|-----|
| #1 | Mag 7 (Converged) | http://localhost:3000/portfolio-backtest?config=mag7_beta_scaled_converged |
| #2 | Mag 7 (Rounded) | http://localhost:3000/portfolio-backtest?config=mag7_beta_scaled_rounded |
| #3 | High Beta Large Cap | http://localhost:3000/portfolio-backtest?config=high_beta_largecap_v2 |

---

## Request 1: Mag 7 Portfolio with Converged Params ✓
**File:** request1_mag7_converged.md
**Config:** mag7_beta_scaled_converged.json

| Metric | DCA | B&H | DCA Wins? |
|--------|-----|-----|-----------|
| CAGR | 19.8% | 25.8% | No |
| Max Drawdown | 21.8% | 50.5% | Yes (-28.7%) |
| Sharpe | 1.15 | 0.86 | Yes |

---

## Request 2: Mag 7 with Rounded Params ✓
**File:** request2_mag7_rounded.md
**Config:** mag7_beta_scaled_rounded.json

| Metric | DCA | B&H | DCA Wins? |
|--------|-----|-----|-----------|
| CAGR | 19.2% | 25.8% | No |
| Max Drawdown | 20.0% | 50.5% | Yes (-30.5%) |
| Sharpe | 1.19 | 0.86 | Yes |

**Conclusion:** Rounded params perform nearly identically to converged params.

---

## Request 3: High Beta Large Cap (Non-Mag7) ✓
**File:** request3_high_beta_largecap.md
**Config:** high_beta_largecap_v2.json
**Stocks:** AMD, NFLX, ORCL, MU, SHOP, PLTR, ARM, AMAT, LRCX, MRVL

| Metric | DCA | B&H | DCA Wins? |
|--------|-----|-----|-----------|
| CAGR | 14.1% | 22.1% | No |
| Max Drawdown | 19.6% | 56.1% | Yes (-36.5%) |
| Sharpe | 0.96 | 0.77 | Yes |

---

## Request 4: Beta Survival Bias Research ✓
**File:** request4_beta_survival_bias.md

**Key Findings:**
- Beta suffers from survival bias (only surviving companies have beta)
- Historical beta changes over time (look-ahead bias)
- 75% of stocks from 10 years ago are now delisted
- **Mitigations:** CRSP, Norgate Data, WRDS Beta Suite for historical beta

---

## Request 5: Market Cap Survival Bias Research ✓
**File:** request5_marketcap_survival_bias.md

**Key Findings:**
- Market cap filtering has survival bias
- Today's $100B companies may have been $10B years ago
- Fixed thresholds become more selective due to inflation
- **Mitigations:** Use index membership (S&P 500) instead of market cap threshold

---

## Request 6: Extended Price History Sources ✓
**File:** request6_extended_price_history.md

**Key Providers:**
| Provider | Coverage | Cost |
|----------|----------|------|
| yfinance | 20+ years | Free |
| EODHD | 30+ years | $20/mo |
| Norgate | 1990s+ | $79/mo |
| CRSP | 1925+ | Academic |

---

## Universal Beta-Scaled Parameters (Recommended)

```
gridIntervalPercent: 5%
profitRequirement: 10%
trailingBuyActivationPercent: 5%
trailingBuyReboundPercent: 2.5%
trailingSellActivationPercent: 15%
trailingSellPullbackPercent: 7.5%
enableBetaScaling: true
betaScalingCoefficient: 1.0
```

---

## Key Insight

**DCA Grid Trading Trade-off:**
- **Sacrifices ~6-8% CAGR** compared to Buy & Hold
- **Reduces drawdown by 30-35%** (from 50-56% to 19-22%)
- **Better Sharpe ratio** (risk-adjusted returns)

This makes DCA ideal for **risk-averse investors** who want exposure to high-growth stocks without the stomach-churning volatility.
