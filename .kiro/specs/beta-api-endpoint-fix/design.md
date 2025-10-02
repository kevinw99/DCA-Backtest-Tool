# Design Document

## Overview

This design addresses the Beta parameter calculation API failure by implementing proper endpoint validation, error handling, and ensuring the backend service correctly processes beta parameter calculation requests. The solution focuses on API reliability, proper error reporting, and fallback mechanisms.

## Architecture

### API Endpoint Structure

```
POST /api/backtest/beta-parameters
├── Request Validation
├── Parameter Correlation Service
├── Response Formatting
└── Error Handling
```

### Request/Response Flow

```
Frontend Request → API Validation → Service Call → Response Format → Frontend Update
     ↓                    ↓              ↓              ↓              ↓
Error Handling ← Validation Error ← Service Error ← Format Error ← Display Error
```

## Components and Interfaces

### API Endpoint Implementation

#### Request Format

```javascript
POST /api/backtest/beta-parameters
{
  "symbol": "TSLA",
  "coefficient": 1.0,
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

#### Response Format

```javascript
{
  "success": true,
  "adjustedParameters": {
    "profitRequirement": 0.09,
    "gridIntervalPercent": 0.18,
    "trailingBuyActivationPercent": 0.18,
    "trailingBuyReboundPercent": 0.09,
    "trailingSellActivationPercent": 0.36,
    "trailingSellPullbackPercent": 0.18
  },
  "beta": 1.8,
  "coefficient": 1.0,
  "betaFactor": 1.8
}
```

### Backend Service Integration

#### Parameter Correlation Service

```javascript
const parameterCorrelationService = require('./services/parameterCorrelationService');

app.post('/api/backtest/beta-parameters', async (req, res) => {
  try {
    const { symbol, coefficient, baseParameters } = req.body;

    // Validate request
    if (!symbol || !baseParameters) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: symbol and baseParameters',
      });
    }

    // Get beta value
    const beta = await getBetaForSymbol(symbol);

    // Calculate adjusted parameters
    const result = parameterCorrelationService.calculateBetaAdjustedParameters(
      beta,
      coefficient || 1.0,
      baseParameters
    );

    res.json({
      success: true,
      adjustedParameters: result.adjustedParameters,
      beta: result.beta,
      coefficient: result.coefficient,
      betaFactor: result.betaFactor,
    });
  } catch (error) {
    console.error('Beta parameter calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error calculating beta parameters',
    });
  }
});
```

## Data Models

### Request Validation Schema

```typescript
interface BetaParameterRequest {
  symbol: string;
  coefficient?: number;
  baseParameters: {
    profitRequirement: number;
    gridIntervalPercent: number;
    trailingBuyActivationPercent: number;
    trailingBuyReboundPercent: number;
    trailingSellActivationPercent: number;
    trailingSellPullbackPercent: number;
  };
}
```

### Error Response Schema

```typescript
interface ErrorResponse {
  success: false;
  message: string;
  details?: string;
  code?: string;
}
```

## Error Handling

### API Level Errors

- **400 Bad Request**: Invalid or missing parameters
- **404 Not Found**: Symbol not found or beta data unavailable
- **500 Internal Server Error**: Service calculation failures
- **503 Service Unavailable**: Backend service temporarily unavailable

### Frontend Error Handling

- **Network Errors**: Display connectivity issues with retry option
- **Validation Errors**: Show specific parameter validation failures
- **Service Errors**: Display calculation service unavailable message
- **Timeout Errors**: Handle long-running calculations with progress indicators

## Testing Strategy

### API Testing

1. **Endpoint Existence**: Verify `/api/backtest/beta-parameters` route exists
2. **Request Validation**: Test with valid and invalid request payloads
3. **Service Integration**: Test parameter correlation service integration
4. **Error Scenarios**: Test various failure conditions and error responses

### Integration Testing

1. **Frontend-Backend**: Test complete request/response cycle
2. **Error Propagation**: Verify errors are properly displayed in UI
3. **Retry Logic**: Test retry mechanisms and fallback behavior
4. **Performance**: Test response times and timeout handling
