# Spec 33: Design Document - Batch Future Trades Aggregation

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Batch Backtest Flow                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  batchBacktestService.js (lines 410-615)                    │
│  ├─ For each combination:                                   │
│  │  ├─ runDCABacktest() → result object                     │
│  │  ├─ [NEW] calculateFutureTradesForResult()               │
│  │  │  └─ Extracts: activeStops, recentPeak/Bottom,         │
│  │  │     lots, params → futureTrades object                │
│  │  └─ result.futureTrades = futureTradesData               │
│  └─ Return: results[] with futureTrades                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  BatchResults.js                                             │
│  ├─ Aggregate future trades by symbol                       │
│  ├─ Render "Future Trades by Stock" section                 │
│  │  └─ For each stock:                                      │
│  │     ├─ FutureTradeCard component                         │
│  │     │  ├─ Header: Symbol, Price, Holdings                │
│  │     │  └─ Body: BUY/SELL activation details              │
│  │     └─ Expandable accordion                              │
│  └─ Filter by selectedStock                                 │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Backend: Calculate Future Trades

**Location**: `backend/services/batchBacktestService.js`

**Add new function**:
```javascript
/**
 * Calculate future trade information for a backtest result
 * @param {Object} result - DCA backtest result from runDCABacktest
 * @returns {Object} Future trades object
 */
function calculateFutureTradesForResult(result) {
  const {
    lots = [],
    shorts = [],
    activeTrailingStopBuy,
    activeTrailingStopSell,
    recentPeak,
    recentBottom,
    backtestParameters: params,
    summary
  } = result;

  // Determine strategy type
  const isShortStrategy = summary?.strategy === 'SHORT_DCA';
  const hasHoldings = isShortStrategy ? shorts.length > 0 : lots.length > 0;

  // Get final price (last price in backtest)
  const currentPrice = result.finalMarketPrice || summary?.finalPrice || 0;

  // Calculate average cost
  let avgCost = 0;
  if (hasHoldings) {
    const positions = isShortStrategy ? shorts : lots;
    const totalValue = positions.reduce((sum, pos) => sum + (pos.price * pos.shares), 0);
    const totalShares = positions.reduce((sum, pos) => sum + pos.shares, 0);
    avgCost = totalShares > 0 ? totalValue / totalShares : 0;
  }

  // Calculate BUY activation (reuse logic from BacktestResults.js lines 327-352)
  let buyActivation = null;
  if (activeTrailingStopBuy?.isActive) {
    buyActivation = {
      isActive: true,
      stopPrice: activeTrailingStopBuy.stopPrice,
      lowestPrice: activeTrailingStopBuy.lowestPrice,
      recentPeakReference: activeTrailingStopBuy.recentPeakReference,
      reboundPercent: isShortStrategy ? params.trailingShortPullbackPercent : params.trailingBuyReboundPercent,
      description: isShortStrategy ? 'Active SHORT Stop' : 'Active BUY Stop'
    };
  } else {
    const activationPercent = isShortStrategy ? params.trailingShortActivationPercent : params.trailingBuyActivationPercent;
    const reboundPercent = isShortStrategy ? params.trailingShortPullbackPercent : params.trailingBuyReboundPercent;
    const activationPrice = recentPeak
      ? recentPeak * (1 - activationPercent)
      : currentPrice * (1 - activationPercent);

    buyActivation = {
      isActive: false,
      activationPercent,
      reboundPercent,
      activationPrice,
      referencePrice: recentPeak || currentPrice,
      description: isShortStrategy ? 'Next SHORT' : 'Next BUY'
    };
  }

  // Calculate SELL activation (reuse logic from BacktestResults.js lines 354-390)
  let sellActivation = null;
  if (hasHoldings) {
    if (activeTrailingStopSell?.isActive) {
      sellActivation = {
        isActive: true,
        stopPrice: activeTrailingStopSell.stopPrice,
        limitPrice: activeTrailingStopSell.limitPrice,
        highestPrice: activeTrailingStopSell.highestPrice,
        lastUpdatePrice: activeTrailingStopSell.lastUpdatePrice,
        recentBottomReference: activeTrailingStopSell.recentBottomReference,
        pullbackPercent: isShortStrategy ? params.trailingCoverReboundPercent : params.trailingSellPullbackPercent,
        profitRequirement: avgCost * (1 + params.profitRequirement),
        description: isShortStrategy ? 'Active COVER Stop' : 'Active SELL Stop'
      };
    } else {
      const activationPercent = isShortStrategy ? params.trailingCoverActivationPercent : params.trailingSellActivationPercent;
      const pullbackPercent = isShortStrategy ? params.trailingCoverReboundPercent : params.trailingSellPullbackPercent;
      const activationPrice = recentBottom
        ? recentBottom * (1 + activationPercent)
        : currentPrice * (1 + activationPercent);

      sellActivation = {
        isActive: false,
        activationPercent,
        pullbackPercent,
        activationPrice,
        referencePrice: recentBottom || currentPrice,
        profitRequirement: avgCost * (1 + params.profitRequirement),
        description: isShortStrategy ? 'Next COVER' : 'Next SELL'
      };
    }
  }

  return {
    currentPrice,
    avgCost,
    hasHoldings,
    isShortStrategy,
    recentPeak,
    recentBottom,
    buyActivation,
    sellActivation
  };
}
```

**Integration point**: After line 513 in batchBacktestService.js
```javascript
const result = await runDCABacktest({
  ...params,
  verbose: false
});

// [NEW] Calculate future trades
result.futureTrades = calculateFutureTradesForResult(result);

results.push(result);
```

### 2. Frontend: Aggregate and Display

**Location**: `frontend/src/components/BatchResults.js`

**Add aggregation function**:
```javascript
// Group future trades by symbol
const futureTradesBySymbol = useMemo(() => {
  if (!results || results.length === 0) return {};

  const grouped = {};
  results.forEach(result => {
    const symbol = result.parameters.symbol;
    if (!grouped[symbol]) {
      grouped[symbol] = [];
    }
    if (result.futureTrades) {
      grouped[symbol].push({
        parameters: result.parameters,
        futureTrades: result.futureTrades,
        rank: results.indexOf(result) + 1
      });
    }
  });

  return grouped;
}, [results]);
```

**Add new section** (after "Best Parameters by Stock", before "Detailed Results Table"):
```jsx
{/* Future Trades by Stock */}
{Object.keys(futureTradesBySymbol).length > 0 && (
  <div className="future-trades-section">
    <h3>🎯 Future Trades by Stock</h3>
    <div className="future-trades-grid">
      {Object.entries(futureTradesBySymbol).map(([symbol, trades]) => {
        // Use the best-performing configuration for this stock
        const bestTrade = trades[0];
        const { futureTrades, parameters } = bestTrade;

        return (
          <FutureTradeCard
            key={symbol}
            symbol={symbol}
            futureTrades={futureTrades}
            parameters={parameters}
            isSelected={selectedStock === symbol}
          />
        );
      })}
    </div>
  </div>
)}
```

**Create FutureTradeCard component**:
```jsx
const FutureTradeCard = ({ symbol, futureTrades, parameters, isSelected }) => {
  const [isExpanded, setIsExpanded] = useState(isSelected);
  const { currentPrice, avgCost, hasHoldings, buyActivation, sellActivation } = futureTrades;

  return (
    <div className={`future-trade-card ${isSelected ? 'selected' : ''}`}>
      <div
        className="card-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h4>{symbol}</h4>
        <div className="header-info">
          <span>Price: {formatCurrency(currentPrice)}</span>
          <span className={hasHoldings ? 'has-holdings' : 'no-holdings'}>
            {hasHoldings ? `Holdings: ${formatCurrency(avgCost)} avg` : 'No Holdings'}
          </span>
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="card-body">
          <div className="trade-directions">
            {/* BUY Direction */}
            <div className="buy-section">
              <h5>
                <TrendingDown size={16} />
                {buyActivation.description}
              </h5>
              {buyActivation.isActive ? (
                <div className="active-stop">
                  <span className="label">Stop Price:</span>
                  <span className="value">{formatCurrency(buyActivation.stopPrice)}</span>
                  <span className="detail">
                    ({formatParameterPercent(buyActivation.reboundPercent)} rebound
                    from {formatCurrency(buyActivation.lowestPrice)})
                  </span>
                </div>
              ) : (
                <>
                  <div>
                    <span className="label">Activates at:</span>
                    <span className="value">{formatCurrency(buyActivation.activationPrice)}</span>
                    <span className="detail">
                      ({formatParameterPercent(buyActivation.activationPercent)} drop
                      from {formatCurrency(buyActivation.referencePrice)})
                    </span>
                  </div>
                  <div>
                    <span className="label">Executes on:</span>
                    <span className="value">
                      {formatParameterPercent(buyActivation.reboundPercent)} rebound
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* SELL Direction */}
            {sellActivation ? (
              <div className="sell-section">
                <h5>
                  <TrendingUp size={16} />
                  {sellActivation.description}
                </h5>
                {sellActivation.isActive ? (
                  <>
                    <div className="active-stop">
                      <span className="label">Stop Price:</span>
                      <span className="value">{formatCurrency(sellActivation.stopPrice)}</span>
                      <span className="detail">
                        ({formatParameterPercent(sellActivation.pullbackPercent)} pullback
                        from {formatCurrency(sellActivation.lastUpdatePrice)})
                      </span>
                    </div>
                    {sellActivation.limitPrice && (
                      <div>
                        <span className="label">Limit Price:</span>
                        <span className="value">{formatCurrency(sellActivation.limitPrice)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <span className="label">Activates on:</span>
                      <span className="value">
                        {formatParameterPercent(sellActivation.activationPercent)} rise
                        from {formatCurrency(sellActivation.referencePrice)}
                      </span>
                    </div>
                    <div>
                      <span className="label">Then trails:</span>
                      <span className="value">
                        {formatParameterPercent(sellActivation.pullbackPercent)} pullback
                      </span>
                    </div>
                  </>
                )}
                <div>
                  <span className="label">Profit target:</span>
                  <span className="value">{formatCurrency(sellActivation.profitRequirement)}</span>
                </div>
              </div>
            ) : (
              <div className="sell-section disabled">
                <h5>Next SELL</h5>
                <p>No holdings to sell</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
```

## CSS Styling

Add to `BatchResults.js` styles:
```css
.future-trades-section {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 8px;
}

.future-trades-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.future-trade-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s;
}

.future-trade-card.selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.card-header {
  padding: 1rem;
  background: #f3f4f6;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header:hover {
  background: #e5e7eb;
}

.header-info {
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
  color: #6b7280;
}

.has-holdings {
  color: #10b981;
  font-weight: 600;
}

.no-holdings {
  color: #9ca3af;
}

.card-body {
  padding: 1rem;
}

.trade-directions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.buy-section h5 {
  color: #0891b2;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.sell-section h5 {
  color: #dc2626;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.sell-section.disabled h5 {
  color: #9ca3af;
}

.active-stop {
  background: #d1fae5;
  padding: 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.label {
  color: #6b7280;
  font-size: 0.85rem;
  margin-right: 0.5rem;
}

.value {
  font-weight: 600;
  color: #111827;
}

.detail {
  color: #9ca3af;
  font-size: 0.85rem;
  margin-left: 0.5rem;
}
```

## Edge Cases

1. **No holdings**: SELL section shows "No holdings to sell"
2. **No transactions**: BUY shows theoretical activation, SELL disabled
3. **Missing recentPeak/Bottom**: Use currentPrice as fallback
4. **Strategy mismatch**: Check `summary.strategy` for correct terminology
5. **Multiple results per stock**: Show best-performing configuration

## Performance Considerations

- **Backend**: Future trades calculated once per backtest (~1ms overhead)
- **Frontend**: Memoized aggregation, lazy card expansion
- **Memory**: ~500 bytes per stock for future trades data

## Testing Strategy

1. **Unit tests**: Test `calculateFutureTradesForResult()` with various states
2. **Integration tests**: Verify batch results include futureTrades
3. **UI tests**: Verify card expansion, filtering, styling
4. **Edge cases**: No holdings, no transactions, missing data
