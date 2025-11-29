=== Request 2: Mag 7 Portfolio - Rounded Beta-Scaled Params ===

**Date:** Thu Nov 27 21:05:19 PST 2025
**Config File:** backend/configs/portfolios/mag7_beta_scaled_rounded.json

## Base Parameters (Rounded)
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
| Total Capital | $700,000 | $700,000 |
| Final Value | $1473118 | $1849927 |
| Total Return | 110.4% | 164.3% |
| CAGR | 19.2% | 25.8% |
| Max Drawdown | 20% | 50.5% |
| Sharpe Ratio | 1.19 | 0.86 |
| Total Trades | 70 | - |
| Win Rate | 100% | - |

## Comparison: Rounded vs Converged Params

| Metric | Rounded | Converged | Difference |
|--------|---------|-----------|------------|
| CAGR | 19.2% | 19.8% | -0.6% |
| Max Drawdown | 20.0% | 21.8% | -1.8% (better) |
| Sharpe | 1.19 | 1.15 | +0.04 (better) |

## URLs

**Frontend URL:**
```
http://localhost:3000/portfolio-backtest?config=mag7_beta_scaled_rounded
```

## Conclusion
The rounded params perform nearly identically to the precisely tuned params, with:
- Slightly lower CAGR (-0.6%)
- Slightly better risk metrics (lower drawdown, higher Sharpe)

**Recommendation:** Use rounded params for simplicity - the performance difference is negligible.
