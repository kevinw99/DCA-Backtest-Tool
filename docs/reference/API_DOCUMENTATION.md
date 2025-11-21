# API Documentation

## Beta Parameter Correlation Endpoints

### Get Beta for Stock

**GET** `/api/stocks/:symbol/beta`

Retrieves the Beta value for a specific stock symbol.

**Parameters:**
- `symbol` (path) - Stock symbol (e.g., "TSLA")

**Response:**
```json
{
  "beta": 1.5,
  "source": "yahoo_finance",
  "lastUpdated": "2025-01-15T10:30:00Z",
  "isManualOverride": false
}
```

**Error Responses:**
- `404` - Stock not found
- `500` - Beta data unavailable

---

### Update Beta Manually

**PUT** `/api/stocks/:symbol/beta`

Manually override the Beta value for a stock.

**Parameters:**
- `symbol` (path) - Stock symbol

**Request Body:**
```json
{
  "beta": 1.8,
  "isManualOverride": true
}
```

**Response:**
```json
{
  "success": true,
  "beta": 1.8,
  "source": "manual_override",
  "lastUpdated": "2025-01-15T11:00:00Z"
}
```

**Error Responses:**
- `400` - Invalid Beta value (must be between 0.1 and 5.0)
- `404` - Stock not found

---

### Calculate Beta-Adjusted Parameters

**POST** `/api/backtest/beta-parameters`

Calculates Beta-adjusted trading parameters based on base parameters and Beta value.

**Request Body:**
```json
{
  "beta": 1.5,
  "baseParameters": {
    "profitRequirement": 0.05,
    "gridIntervalPercent": 0.1,
    "trailingBuyActivationPercent": 0.1,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.2,
    "trailingSellPullbackPercent": 0.1
  }
}
```

**Response:**
```json
{
  "adjustedParameters": {
    "profitRequirement": 0.075,
    "gridIntervalPercent": 0.15,
    "trailingBuyActivationPercent": 0.15,
    "trailingBuyReboundPercent": 0.075,
    "trailingSellActivationPercent": 0.3,
    "trailingSellPullbackPercent": 0.15
  },
  "warnings": [
    "Grid interval exceeds 10% - may reduce trading frequency"
  ],
  "isValid": true
}
```

---

### Enhanced DCA Backtest (with Beta support)

**POST** `/api/backtest/dca`

Runs a single DCA backtest with optional Beta parameter scaling.

**Request Body:**
```json
{
  "symbol": "TSLA",
  "startDate": "2021-01-01",
  "endDate": "2023-12-31",
  "lotSizeUsd": 10000,
  "maxLots": 10,
  "beta": 1.5,
  "enableBetaScaling": true,
  "baseProfitRequirement": 0.05,
  "baseGridIntervalPercent": 0.1,
  "isManualBetaOverride": false
}
```

**Response:**
```json
{
  "summary": {
    "totalReturn": 0.45,
    "annualizedReturn": 0.18,
    "maxDrawdown": -0.25,
    "sharpeRatio": 1.2,
    "totalTrades": 156
  },
  "betaInfo": {
    "beta": 1.5,
    "source": "yahoo_finance",
    "lastUpdated": "2025-01-15T10:30:00Z",
    "enableBetaScaling": true
  },
  "adjustedParameters": {
    "profitRequirement": 0.075,
    "gridIntervalPercent": 0.15
  },
  "transactions": [...],
  "portfolioHistory": [...]
}
```

---

### Batch Backtest with Beta Support

**POST** `/api/backtest/batch-beta`

Runs batch backtests across multiple Beta values and parameter combinations.

**Request Body:**
```json
{
  "symbols": ["TSLA", "NVDA"],
  "betaValues": [0.5, 1.0, 1.5, 2.0],
  "enableBetaScaling": true,
  "parameterRanges": {
    "baseProfitRequirement": [0.03, 0.05, 0.07],
    "baseGridIntervalPercent": [0.08, 0.1, 0.12]
  },
  "startDate": "2021-01-01",
  "endDate": "2023-12-31",
  "lotSizeUsd": 10000,
  "maxLots": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "parameters": {
        "symbol": "TSLA",
        "beta": 1.5,
        "enableBetaScaling": true,
        "baseProfitRequirement": 0.05
      },
      "adjustedParameters": {
        "profitRequirement": 0.075,
        "gridIntervalPercent": 0.15
      },
      "summary": {
        "totalReturn": 0.45,
        "annualizedReturn": 0.18,
        "maxDrawdown": -0.25,
        "sharpeRatio": 1.2
      }
    }
  ],
  "bestPerforming": {
    "byReturn": {...},
    "bySharpe": {...},
    "byDrawdown": {...}
  }
}
```

## Parameter Correlation Formulas

The Beta parameter correlation uses the following formulas:

- **Profit Requirement**: `profitRequirement = baseProfitRequirement * Beta`
- **Grid Interval**: `gridIntervalPercent = baseGridIntervalPercent * Beta`
- **Trailing Buy Activation**: `trailingBuyActivationPercent = baseTrailingBuyActivationPercent * Beta`
- **Trailing Buy Rebound**: `trailingBuyReboundPercent = baseTrailingBuyReboundPercent * Beta`
- **Trailing Sell Activation**: `trailingSellActivationPercent = baseTrailingSellActivationPercent * Beta`
- **Trailing Sell Pullback**: `trailingSellPullbackPercent = baseTrailingSellPullbackPercent * Beta`

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional error details"
}
```

Common error codes:
- `BETA_FETCH_FAILED` - Unable to fetch Beta from external providers
- `INVALID_BETA_VALUE` - Beta value outside acceptable range (0.1 - 5.0)
- `PARAMETER_OUT_OF_BOUNDS` - Calculated parameters exceed safety limits
- `STOCK_NOT_FOUND` - Requested stock symbol not found
- `INSUFFICIENT_DATA` - Not enough historical data for backtest