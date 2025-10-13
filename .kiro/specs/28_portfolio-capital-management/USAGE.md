# Portfolio Backtest - Usage Guide

## Overview

The Portfolio Backtest feature enables realistic simulation of multi-stock DCA strategies with a **shared capital pool**. Unlike individual stock backtests where each stock has isolated capital, this feature enforces a total capital constraint across all stocks, logging rejected orders when capital runs out.

## Quick Start

### Basic Example

```bash
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "totalCapital": 100000,
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "lotSizeUsd": 10000,
    "maxLotsPerStock": 10,
    "defaultParams": {
      "gridIntervalPercent": 0.10,
      "profitRequirement": 0.10
    },
    "stocks": [
      {"symbol": "TSLA"},
      {"symbol": "AAPL"},
      {"symbol": "NVDA"},
      {"symbol": "MSFT"}
    ]
  }'
```

## Request Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `totalCapital` | number | Total capital available for entire portfolio (e.g., 500000) |
| `startDate` | string | Start date in YYYY-MM-DD format |
| `endDate` | string | End date in YYYY-MM-DD format |
| `lotSizeUsd` | number | Dollar amount per lot (e.g., 10000) |
| `stocks` | array | Array of stock objects with `symbol` property |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `maxLotsPerStock` | number | 10 | Maximum lots any single stock can hold |
| `defaultParams` | object | {} | Default DCA parameters applied to all stocks |

### DCA Parameters (in defaultParams)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `gridIntervalPercent` | number | 0.10 | Grid interval as decimal (0.10 = 10%) |
| `profitRequirement` | number | 0.10 | Minimum profit for sells as decimal |
| `stopLossPercent` | number | 0.30 | Stop loss threshold |
| `enableTrailingBuy` | boolean | false | Enable trailing buy stops |
| `enableTrailingSell` | boolean | false | Enable trailing sell stops |

## Response Format

```json
{
  "success": true,
  "data": {
    "portfolioSummary": {
      "totalCapital": 500000,
      "finalPortfolioValue": 543608.39,
      "cashReserve": 401848.34,
      "deployedCapital": 120000,
      "capitalUtilizationPercent": 24,
      "totalReturn": 43608.39,
      "totalReturnPercent": 8.72,
      "cagr": 10.57,
      "maxDrawdown": 40000,
      "maxDrawdownPercent": 8.00,
      "sharpeRatio": 11.89,
      "sortinoRatio": 64.07,
      "totalBuys": 27,
      "totalSells": 15,
      "totalTrades": 42,
      "rejectedBuys": 0,
      "rejectedBuysValue": 0,
      "winRate": 100,
      "avgWin": 1456.56,
      "profitFactor": 0
    },
    "stockResults": [
      {
        "symbol": "NVDA",
        "lotsHeld": 3,
        "capitalDeployed": 30000,
        "marketValue": 33833.88,
        "totalPNL": 18496.79,
        "stockReturnPercent": 61.66,
        "cagr": 10.44,
        "contributionToPortfolioReturn": 42.42,
        "contributionToPortfolioValue": 6.22,
        "totalBuys": 13,
        "totalSells": 10,
        "rejectedBuys": 0,
        "transactions": [...]
      }
    ],
    "capitalUtilizationTimeSeries": [...],
    "rejectedOrders": [...],
    "capitalFlow": [...]
  }
}
```

## Key Metrics Explained

### Portfolio-Level Metrics

**Performance:**
- `totalReturn` - Absolute dollar return
- `totalReturnPercent` - Percentage return on initial capital
- `cagr` - Compound Annual Growth Rate
- `sharpeRatio` - Risk-adjusted return metric
- `maxDrawdown` / `maxDrawdownPercent` - Largest peak-to-trough decline

**Capital Management:**
- `deployedCapital` - Currently invested capital
- `cashReserve` - Available cash
- `capitalUtilizationPercent` - Percentage of capital deployed
- `avgCapitalUtilization` - Average utilization over time

**Trading:**
- `totalTrades` - Total buy and sell transactions
- `winRate` - Percentage of profitable trades
- `rejectedBuys` - Number of rejected buy orders
- `rejectedBuysValue` - Total dollar amount of rejected orders
- `rejectedBuysPercent` - Percentage of buy attempts rejected

### Per-Stock Metrics

- `lotsHeld` - Current number of lots held
- `capitalDeployed` - Total capital invested in this stock
- `marketValue` - Current market value of holdings
- `totalPNL` - Total profit/loss (realized + unrealized)
- `stockReturnPercent` - ROI for this stock
- `contributionToPortfolioReturn` - Percentage contribution to total portfolio returns
- `contributionToPortfolioValue` - Percentage of current portfolio value

## Example Use Cases

### 1. Test Capital Constraint Enforcement

Tight capital scenario to see rejected orders:

```bash
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "totalCapital": 25000,
    "startDate": "2024-01-01",
    "endDate": "2024-03-31",
    "lotSizeUsd": 10000,
    "maxLotsPerStock": 3,
    "defaultParams": {
      "gridIntervalPercent": 0.05,
      "profitRequirement": 0.10
    },
    "stocks": [
      {"symbol": "TSLA"},
      {"symbol": "AAPL"},
      {"symbol": "NVDA"}
    ]
  }'
```

### 2. Compare Individual vs. Portfolio Performance

Run same stock individually, then in portfolio:

```bash
# Individual TSLA backtest
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "TSLA",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "lotSizeUsd": 10000,
    "maxLots": 10,
    ...
  }'

# TSLA in portfolio with shared capital
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "totalCapital": 100000,
    ...
    "stocks": [
      {"symbol": "TSLA"},
      {"symbol": "AAPL"},
      {"symbol": "NVDA"}
    ]
  }'
```

### 3. Optimize Capital Allocation

Test different capital amounts to find optimal utilization:

```bash
# Test $500K
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -d '{"totalCapital": 500000, ...}'

# Test $300K
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -d '{"totalCapital": 300000, ...}'

# Test $200K
curl -X POST http://localhost:3001/api/portfolio-backtest \
  -d '{"totalCapital": 200000, ...}'
```

## Understanding Rejected Orders

When a buy signal triggers but insufficient capital is available, the order is rejected and logged:

```json
{
  "rejectedOrders": [
    {
      "date": "2024-03-15",
      "symbol": "TSLA",
      "orderType": "BUY",
      "price": 248.42,
      "lotSize": 10000,
      "reason": "INSUFFICIENT_CAPITAL",
      "availableCapital": 5000,
      "requiredCapital": 10000,
      "shortfall": 5000,
      "portfolioState": {
        "deployedCapital": 20000,
        "cashReserve": 5000,
        "utilizationPercent": 80
      }
    }
  ]
}
```

**Key Insights from Rejected Orders:**
- Which stocks are "starved" for capital
- When capital constraints become binding
- How much additional capital would be needed
- Portfolio state at time of rejection

## Processing Order

**Order Execution Priority:**
1. Stocks processed in **alphabetical order** (deterministic)
2. **Sells processed first** (returns capital to pool)
3. **Buys processed second** (if capital available)

This ensures:
- Reproducible results
- Maximum capital availability for buys
- Clear audit trail

## Capital Accounting

The system enforces:
```
deployedCapital + cashReserve = totalCapital + profits
```

- **deployedCapital**: Original cost basis of all current holdings
- **cashReserve**: Available cash (includes realized profits)
- **Profits increase** cashReserve without increasing deployedCapital
- **Capital constraint** validated after every transaction

## Testing Tips

1. **Start small**: Test with 2-3 stocks first
2. **Check rejected orders**: Look for capital constraints
3. **Compare modes**: Run same stocks individually vs. portfolio
4. **Vary capital**: Test different totalCapital amounts
5. **Export data**: Save JSON response for analysis

## Programmatic Access

### Python Example

```python
import requests
import json

response = requests.post('http://localhost:3001/api/portfolio-backtest',
    headers={'Content-Type': 'application/json'},
    json={
        'totalCapital': 500000,
        'startDate': '2024-01-01',
        'endDate': '2024-12-31',
        'lotSizeUsd': 10000,
        'maxLotsPerStock': 10,
        'defaultParams': {
            'gridIntervalPercent': 0.10,
            'profitRequirement': 0.10
        },
        'stocks': [
            {'symbol': 'TSLA'},
            {'symbol': 'AAPL'},
            {'symbol': 'NVDA'},
            {'symbol': 'MSFT'}
        ]
    }
)

data = response.json()
print(f"Final Value: ${data['data']['portfolioSummary']['finalPortfolioValue']:,.2f}")
print(f"Return: {data['data']['portfolioSummary']['totalReturnPercent']:.2f}%")
```

### Node.js Example

```javascript
const axios = require('axios');

async function runPortfolioBacktest() {
  const response = await axios.post('http://localhost:3001/api/portfolio-backtest', {
    totalCapital: 500000,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    lotSizeUsd: 10000,
    maxLotsPerStock: 10,
    defaultParams: {
      gridIntervalPercent: 0.10,
      profitRequirement: 0.10
    },
    stocks: [
      { symbol: 'TSLA' },
      { symbol: 'AAPL' },
      { symbol: 'NVDA' },
      { symbol: 'MSFT' }
    ]
  });

  const { portfolioSummary, stockResults } = response.data.data;
  console.log('Portfolio Return:', portfolioSummary.totalReturnPercent.toFixed(2) + '%');
  console.log('Top Performer:', stockResults[0].symbol, stockResults[0].totalPNL);
}
```

## Troubleshooting

**No trades executed:**
- Check date range has sufficient data
- Verify stock symbols exist in database
- Review default parameters (may be too restrictive)

**Capital constraint too tight:**
- Increase `totalCapital`
- Reduce number of stocks
- Decrease `lotSizeUsd`

**High rejection rate:**
- Portfolio may be under-capitalized
- Consider increasing total capital
- Or reduce lot size / max lots

## Next Steps

1. **Experiment**: Try different capital amounts and stock combinations
2. **Analyze**: Look at rejected orders to understand capital needs
3. **Optimize**: Find the sweet spot for capital utilization
4. **Compare**: Run same stocks in individual mode vs. portfolio mode
5. **Automate**: Build scripts to test multiple scenarios

## Support

For questions or issues:
- Check `.kiro/specs/28_portfolio-capital-management/requirements.md` for detailed specifications
- Review `.kiro/specs/28_portfolio-capital-management/design.md` for technical architecture
- See API implementation in `backend/services/portfolioBacktestService.js`
