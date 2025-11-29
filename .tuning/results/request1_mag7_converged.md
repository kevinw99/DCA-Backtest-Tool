=== Request 1: Mag 7 Portfolio - Beta-Scaled Converged Params ===

**Date:** Thu Nov 27 21:04:03 PST 2025
**Config File:** backend/configs/portfolios/mag7_beta_scaled_converged.json

## Base Parameters (Beta-Scaled)
| Parameter | Base Value |
|-----------|------------|
| gridIntervalPercent | 3.4% |
| profitRequirement | 10% |
| trailingBuyActivationPercent | 4.4% |
| trailingBuyReboundPercent | 2.2% |
| trailingSellActivationPercent | 12.1% |
| trailingSellPullbackPercent | 7.3% |
| enableBetaScaling | true |
| betaScalingCoefficient | 1.0 |

## Portfolio Results
| Metric | DCA Portfolio | Buy & Hold |
|--------|---------------|------------|
| Total Capital | $700000 | $700000 |
| Final Value | $1507510 | $1849927 |
| Total Return | 115.4% | 164.3% |
| CAGR | 19.8% | 25.8% |
| Max Drawdown | 21.8% | 50.5% |
| Sharpe Ratio | 1.15 | 0.86 |
| Total Trades | 71 | - |
| Win Rate | 100% | - |

## URLs

**Frontend URL:**
```
http://localhost:3000/portfolio-backtest?config=mag7_beta_scaled_converged
```

**API Curl Command:**
```bash
curl -X POST http://localhost:3001/api/backtest/portfolio/config \
  -H "Content-Type: application/json" \
  -d '{"configFile": "mag7_beta_scaled_converged.json"}'
```

## Analysis
- **DCA vs B&H CAGR:** DCA outperforms by -5.9%
- **Risk Comparison:** DCA has 28.6% lower max drawdown
- **Sharpe Comparison:** DCA has better risk-adjusted returns
