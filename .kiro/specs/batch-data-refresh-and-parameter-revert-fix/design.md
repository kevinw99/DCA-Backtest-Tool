# Design Document

## Overview

This design addresses two critical issues: (1) implementing a batch data refresh system for all stocks in the batch mode list to ensure current data and beta values, and (2) fixing the parameter reversion logic so that disabling Beta scaling properly restores original user parameters instead of keeping beta-adjusted values.

## Architecture

### Batch Data Refresh System

```
Data Refresh Controller
├── Stock Data Service (concurrent fetching)
├── Beta Data Service (concurrent beta refresh)
├── Progress Tracking
└── Error Handling & Reporting
```

### Parameter State Management

```
Parameter Management
├── Base Parameters (original user values)
├── Current Parameters (displayed in form)
├── Beta Scaling State
└── Restoration Logic
```

## Components and Interfaces

### Batch Data Refresh Implementation

#### Refresh Controller

```javascript
class BatchDataRefreshController {
  async refreshAllBatchStocks(symbols) {
    const results = {
      successful: [],
      failed: [],
      timing: {},
    };

    // Concurrent operations with rate limiting
    const stockPromises = symbols.map(symbol =>
      this.refreshSingleStock(symbol).catch(error => ({ symbol, error }))
    );

    const betaPromises = symbols.map(symbol =>
      this.refreshSingleBeta(symbol).catch(error => ({ symbol, error }))
    );

    // Execute with controlled concurrency
    const stockResults = await Promise.allSettled(stockPromises);
    const betaResults = await Promise.allSettled(betaPromises);

    return this.consolidateResults(stockResults, betaResults);
  }
}
```

#### API Endpoint

```javascript
app.post('/api/batch/refresh-data', async (req, res) => {
  try {
    const { symbols } = req.body;
    const controller = new BatchDataRefreshController();
    const results = await controller.refreshAllBatchStocks(symbols);

    res.json({
      success: true,
      results: results,
      summary: {
        total: symbols.length,
        successful: results.successful.length,
        failed: results.failed.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
```

### Parameter Reversion Fix

#### Enhanced Base Parameter Storage

```javascript
// Store base parameters when enabling beta scaling
const storeBaseParameters = () => {
  const currentBaseParams = {
    profitRequirement: parameters.profitRequirement,
    gridIntervalPercent: parameters.gridIntervalPercent,
    trailingBuyActivationPercent: parameters.trailingBuyActivationPercent,
    trailingBuyReboundPercent: parameters.trailingBuyReboundPercent,
    trailingSellActivationPercent: parameters.trailingSellActivationPercent,
    trailingSellPullbackPercent: parameters.trailingSellPullbackPercent,
  };

  setBaseParameters(currentBaseParams);
  localStorage.setItem('dca-base-parameters', JSON.stringify(currentBaseParams));
};
```

#### Proper Parameter Restoration

```javascript
const restoreBaseParameters = () => {
  // Get base parameters from state or localStorage
  let baseParams = baseParameters;

  if (Object.keys(baseParams).length === 0) {
    const saved = localStorage.getItem('dca-base-parameters');
    if (saved) {
      baseParams = JSON.parse(saved);
    } else {
      // Use default values if no base parameters exist
      baseParams = {
        profitRequirement: 5,
        gridIntervalPercent: 10,
        trailingBuyActivationPercent: 10,
        trailingBuyReboundPercent: 5,
        trailingSellActivationPercent: 20,
        trailingSellPullbackPercent: 10,
      };
    }
  }

  // Restore parameters without triggering localStorage save
  setIsUpdatingBetaParameters(true);
  setParameters(prev => ({
    ...prev,
    ...baseParams,
  }));
  setTimeout(() => setIsUpdatingBetaParameters(false), 100);
};
```

## Data Models

### Batch Refresh Request

```typescript
interface BatchRefreshRequest {
  symbols: string[];
  forceRefresh?: boolean;
  includeBeta?: boolean;
  includeStockData?: boolean;
}
```

### Refresh Results

```typescript
interface RefreshResults {
  successful: Array<{
    symbol: string;
    stockDataUpdated: boolean;
    betaUpdated: boolean;
    newBeta?: number;
    timing: number;
  }>;
  failed: Array<{
    symbol: string;
    error: string;
    type: 'stock_data' | 'beta' | 'both';
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalTime: number;
  };
}
```

### Base Parameter Storage

```typescript
interface BaseParameterState {
  stored: boolean;
  parameters: {
    profitRequirement: number;
    gridIntervalPercent: number;
    trailingBuyActivationPercent: number;
    trailingBuyReboundPercent: number;
    trailingSellActivationPercent: number;
    trailingSellPullbackPercent: number;
  };
  timestamp: string;
}
```

## Error Handling

### Batch Refresh Errors

- **Network Failures**: Continue with other symbols, report failures
- **Rate Limiting**: Implement exponential backoff and retry logic
- **Invalid Symbols**: Log warnings but don't fail entire operation
- **Database Errors**: Retry with fallback to in-memory results

### Parameter Restoration Errors

- **Missing Base Parameters**: Use sensible defaults
- **localStorage Corruption**: Clear corrupted data and use defaults
- **State Synchronization**: Prevent infinite loops with update flags

## Testing Strategy

### Batch Refresh Testing

1. **Concurrent Operations**: Test multiple symbol refresh simultaneously
2. **Error Scenarios**: Test with invalid symbols and network failures
3. **Rate Limiting**: Test behavior under API rate limits
4. **Performance**: Measure refresh times for full batch

### Parameter Reversion Testing

1. **Enable/Disable Cycles**: Test multiple on/off toggles
2. **Parameter Persistence**: Test localStorage save/restore
3. **Edge Cases**: Test with missing or corrupted base parameters
4. **User Workflows**: Test realistic user interaction patterns
