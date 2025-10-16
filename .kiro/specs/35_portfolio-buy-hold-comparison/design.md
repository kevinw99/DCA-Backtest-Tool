# Design Document: Portfolio Buy & Hold Comparison

## Overview

This design document details the technical implementation of Buy & Hold comparison for portfolio backtesting. The feature will calculate a passive investment baseline and compare it against the active DCA strategy across multiple metrics.

## Architecture

### High-Level Flow

```
Portfolio Backtest Request
    ↓
runPortfolioBacktest()
├─ Execute DCA strategy (existing)
├─ Generate DCA metrics (existing)
└─ [NEW] Calculate Buy & Hold comparison
    ↓
calculatePortfolioBuyAndHoldComparison()
├─ Calculate per-stock B&H positions
├─ Generate B&H time series
├─ Calculate B&H metrics
└─ Generate comparison metrics
    ↓
Return combined results to frontend
    ↓
PortfolioResults Component
├─ [UPDATED] PortfolioSummaryCard with B&H badge
├─ [NEW] PortfolioBuyAndHoldComparison section
├─ [NEW] DCAVsBuyAndHoldChart component
└─ [UPDATED] StockPerformanceTable with B&H columns
```

---

## Backend Design

### 1. Data Structures

#### Buy & Hold Position (per stock)
```javascript
{
  symbol: 'AAPL',
  allocatedCapital: 10000,        // Capital allocated at start
  startDate: '2020-01-01',
  startPrice: 150.00,
  sharesHeld: 66.67,              // allocatedCapital / startPrice
  endDate: '2024-01-01',
  endPrice: 200.00,
  finalValue: 13334.00,           // sharesHeld * endPrice
  totalReturn: 3334.00,
  totalReturnPercent: 33.34,
  cagr: 7.47,                     // Annualized return
  maxDrawdown: -2500.00,
  maxDrawdownPercent: -25.00,
  sharpeRatio: 1.23,
  contributionToPortfolioReturn: 3334.00
}
```

#### Buy & Hold Portfolio Summary
```javascript
{
  strategy: 'BUY_AND_HOLD',
  totalCapital: 100000,
  numStocks: 10,
  capitalPerStock: 10000,         // Equal allocation

  // Performance metrics
  finalValue: 135000,
  totalReturn: 35000,
  totalReturnPercent: 35.00,
  cagr: 7.81,
  cagrPercent: 781,               // Basis points

  // Risk metrics
  maxDrawdown: -18000,
  maxDrawdownPercent: -18.00,
  maxDrawdownDuration: 45,        // Days
  volatility: 0.18,               // Annualized
  sharpeRatio: 1.15,
  sortinoRatio: 1.42,

  // Per-stock breakdown
  stockPositions: [ /* array of Buy & Hold Position */ ],

  // Time series
  dailyValues: [
    { date: '2020-01-01', portfolioValue: 100000, totalReturn: 0, returnPercent: 0 },
    { date: '2020-01-02', portfolioValue: 101500, totalReturn: 1500, returnPercent: 1.5 },
    // ...
  ]
}
```

#### Comparison Results
```javascript
{
  // Summary comparison
  dcaFinalValue: 142000,
  buyAndHoldFinalValue: 135000,
  outperformanceAmount: 7000,
  outperformancePercent: 5.19,    // (DCA - B&H) / B&H * 100

  // Metric-by-metric comparison
  comparison: {
    totalReturn: {
      dca: 42000,
      buyAndHold: 35000,
      difference: 7000,
      advantage: 'DCA'
    },
    cagr: {
      dca: 9.15,
      buyAndHold: 7.81,
      difference: 1.34,             // Percentage points
      advantage: 'DCA'
    },
    maxDrawdown: {
      dca: -15.5,
      buyAndHold: -18.0,
      difference: 2.5,              // Smaller drawdown is better
      advantage: 'DCA'
    },
    sharpeRatio: {
      dca: 1.35,
      buyAndHold: 1.15,
      difference: 0.20,
      advantage: 'DCA'
    },
    volatility: {
      dca: 0.16,
      buyAndHold: 0.18,
      difference: -0.02,            // Lower is better
      advantage: 'DCA'
    }
  },

  // Per-stock comparison
  stockComparisons: [
    {
      symbol: 'AAPL',
      dcaReturn: 4500,
      buyAndHoldReturn: 3334,
      outperformance: 1166,
      outperformancePercent: 34.98
    },
    // ...
  ]
}
```

---

### 2. Backend Implementation

#### File: `backend/services/portfolioBuyAndHoldService.js` (NEW)

**Main Function:**
```javascript
/**
 * Calculate Buy & Hold strategy for portfolio comparison
 * @param {Map} priceDataMap - Map of symbol -> price array
 * @param {Object} config - Backtest configuration
 * @param {Object} portfolio - Final DCA portfolio state
 * @returns {Object} - Buy & Hold results and comparison
 */
function calculatePortfolioBuyAndHold(priceDataMap, config, portfolio) {
  // 1. Determine equal capital allocation
  const totalCapital = config.totalCapital;
  const symbols = Array.from(priceDataMap.keys());
  const numStocks = symbols.length;
  const capitalPerStock = totalCapital / numStocks;

  // 2. Calculate per-stock B&H positions
  const stockPositions = symbols.map(symbol => {
    return calculateStockBuyAndHold(
      symbol,
      priceDataMap.get(symbol),
      capitalPerStock,
      config.startDate,
      config.endDate
    );
  });

  // 3. Generate portfolio-level time series
  const dailyValues = generateBuyAndHoldTimeSeries(
    stockPositions,
    priceDataMap,
    totalCapital
  );

  // 4. Calculate portfolio-level metrics
  const metrics = calculateBuyAndHoldMetrics(
    dailyValues,
    totalCapital,
    config.startDate,
    config.endDate
  );

  // 5. Generate comparison with DCA results
  const comparison = generateComparisonMetrics(
    portfolio,
    metrics,
    stockPositions
  );

  return {
    buyAndHoldSummary: {
      ...metrics,
      stockPositions,
      dailyValues
    },
    comparison
  };
}
```

**Helper Function: Calculate Single Stock B&H**
```javascript
function calculateStockBuyAndHold(symbol, prices, allocatedCapital, startDate, endDate) {
  // Find start and end prices
  const startPrice = prices.find(p => p.date >= startDate)?.adjusted_close;
  const endPrice = prices.find(p => p.date >= endDate)?.adjusted_close ||
                   prices[prices.length - 1].adjusted_close;

  if (!startPrice || !endPrice) {
    throw new Error(`Missing price data for ${symbol}`);
  }

  // Calculate position
  const sharesHeld = allocatedCapital / startPrice;
  const finalValue = sharesHeld * endPrice;
  const totalReturn = finalValue - allocatedCapital;
  const totalReturnPercent = (totalReturn / allocatedCapital) * 100;

  // Calculate CAGR
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const years = (endDateObj - startDateObj) / (365.25 * 24 * 60 * 60 * 1000);
  const cagr = years > 0 ? (Math.pow(finalValue / allocatedCapital, 1 / years) - 1) * 100 : 0;

  // Calculate daily values for this stock
  const dailyValues = prices
    .filter(p => p.date >= startDate && p.date <= endDate)
    .map(p => ({
      date: p.date,
      price: p.adjusted_close,
      value: sharesHeld * p.adjusted_close,
      returnAmount: (sharesHeld * p.adjusted_close) - allocatedCapital,
      returnPercent: ((sharesHeld * p.adjusted_close) - allocatedCapital) / allocatedCapital * 100
    }));

  // Calculate max drawdown for this stock
  const { maxDrawdown, maxDrawdownPercent, duration } = calculateMaxDrawdownFromValues(dailyValues);

  // Calculate Sharpe ratio for this stock
  const sharpeRatio = calculateSharpeRatioFromValues(dailyValues);

  return {
    symbol,
    allocatedCapital,
    startDate,
    startPrice,
    sharesHeld,
    endDate,
    endPrice,
    finalValue,
    totalReturn,
    totalReturnPercent,
    cagr,
    maxDrawdown,
    maxDrawdownPercent,
    maxDrawdownDuration: duration,
    sharpeRatio,
    dailyValues
  };
}
```

**Helper Function: Generate Portfolio Time Series**
```javascript
function generateBuyAndHoldTimeSeries(stockPositions, priceDataMap, totalCapital) {
  // Get union of all dates
  const allDates = new Set();
  priceDataMap.forEach(prices => {
    prices.forEach(p => allDates.add(p.date));
  });

  const sortedDates = Array.from(allDates).sort();

  // For each date, calculate total portfolio value
  const dailyValues = sortedDates.map(date => {
    let portfolioValue = 0;

    stockPositions.forEach(position => {
      const prices = priceDataMap.get(position.symbol);
      // Find price on or before this date
      const relevantPrices = prices.filter(p => p.date <= date);
      if (relevantPrices.length > 0) {
        const price = relevantPrices[relevantPrices.length - 1].adjusted_close;
        portfolioValue += position.sharesHeld * price;
      }
    });

    const totalReturn = portfolioValue - totalCapital;
    const returnPercent = (totalReturn / totalCapital) * 100;

    return {
      date,
      portfolioValue,
      totalReturn,
      returnPercent
    };
  });

  return dailyValues;
}
```

**Helper Function: Calculate B&H Metrics**
```javascript
function calculateBuyAndHoldMetrics(dailyValues, totalCapital, startDate, endDate) {
  const finalValue = dailyValues[dailyValues.length - 1].portfolioValue;
  const totalReturn = finalValue - totalCapital;
  const totalReturnPercent = (totalReturn / totalCapital) * 100;

  // Calculate CAGR
  const years = (new Date(endDate) - new Date(startDate)) / (365.25 * 24 * 60 * 60 * 1000);
  const cagr = years > 0 ? (Math.pow(finalValue / totalCapital, 1 / years) - 1) * 100 : 0;

  // Calculate max drawdown
  const { maxDrawdown, maxDrawdownPercent, duration } = calculateMaxDrawdownFromValues(dailyValues);

  // Calculate volatility and Sharpe ratio
  const dailyReturns = [];
  for (let i = 1; i < dailyValues.length; i++) {
    const prevValue = dailyValues[i - 1].portfolioValue;
    const currValue = dailyValues[i].portfolioValue;
    const dailyReturn = (currValue - prevValue) / prevValue;
    dailyReturns.push(dailyReturn);
  }

  const avgDailyReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);
  const volatility = stdDev * Math.sqrt(252); // Annualized

  const annualizedReturn = avgDailyReturn * 252;
  const sharpeRatio = volatility > 0 ? annualizedReturn / volatility : 0;

  // Calculate Sortino ratio (downside deviation only)
  const downsideReturns = dailyReturns.filter(r => r < 0);
  const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / dailyReturns.length;
  const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252);
  const sortinoRatio = downsideDeviation > 0 ? annualizedReturn / downsideDeviation : 0;

  return {
    totalCapital,
    finalValue,
    totalReturn,
    totalReturnPercent,
    cagr,
    maxDrawdown,
    maxDrawdownPercent,
    maxDrawdownDuration: duration,
    volatility,
    sharpeRatio,
    sortinoRatio
  };
}
```

**Helper Function: Generate Comparison**
```javascript
function generateComparisonMetrics(dcaPortfolio, buyAndHoldMetrics, buyAndHoldStockPositions) {
  const dcaSummary = dcaPortfolio.portfolioSummary || dcaPortfolio;

  // Calculate outperformance
  const outperformanceAmount = dcaSummary.finalPortfolioValue - buyAndHoldMetrics.finalValue;
  const outperformancePercent = (outperformanceAmount / buyAndHoldMetrics.finalValue) * 100;

  // Metric-by-metric comparison
  const comparison = {
    totalReturn: {
      dca: dcaSummary.totalReturn,
      buyAndHold: buyAndHoldMetrics.totalReturn,
      difference: dcaSummary.totalReturn - buyAndHoldMetrics.totalReturn,
      advantage: dcaSummary.totalReturn >= buyAndHoldMetrics.totalReturn ? 'DCA' : 'BUY_AND_HOLD'
    },
    cagr: {
      dca: dcaSummary.cagr,
      buyAndHold: buyAndHoldMetrics.cagr,
      difference: dcaSummary.cagr - buyAndHoldMetrics.cagr,
      advantage: dcaSummary.cagr >= buyAndHoldMetrics.cagr ? 'DCA' : 'BUY_AND_HOLD'
    },
    maxDrawdown: {
      dca: dcaSummary.maxDrawdownPercent,
      buyAndHold: buyAndHoldMetrics.maxDrawdownPercent,
      difference: buyAndHoldMetrics.maxDrawdownPercent - dcaSummary.maxDrawdownPercent, // Better if smaller
      advantage: Math.abs(dcaSummary.maxDrawdownPercent) <= Math.abs(buyAndHoldMetrics.maxDrawdownPercent) ? 'DCA' : 'BUY_AND_HOLD'
    },
    sharpeRatio: {
      dca: dcaSummary.sharpeRatio,
      buyAndHold: buyAndHoldMetrics.sharpeRatio,
      difference: dcaSummary.sharpeRatio - buyAndHoldMetrics.sharpeRatio,
      advantage: dcaSummary.sharpeRatio >= buyAndHoldMetrics.sharpeRatio ? 'DCA' : 'BUY_AND_HOLD'
    },
    volatility: {
      dca: dcaSummary.volatility,
      buyAndHold: buyAndHoldMetrics.volatility,
      difference: buyAndHoldMetrics.volatility - dcaSummary.volatility, // Better if smaller
      advantage: dcaSummary.volatility <= buyAndHoldMetrics.volatility ? 'DCA' : 'BUY_AND_HOLD'
    }
  };

  // Per-stock comparison
  const stockComparisons = dcaPortfolio.stockResults.map(dcaStock => {
    const bhStock = buyAndHoldStockPositions.find(s => s.symbol === dcaStock.symbol);
    if (!bhStock) return null;

    return {
      symbol: dcaStock.symbol,
      dcaReturn: dcaStock.totalPNL,
      dcaReturnPercent: dcaStock.totalPNL / dcaStock.maxCapitalDeployed * 100,
      buyAndHoldReturn: bhStock.totalReturn,
      buyAndHoldReturnPercent: bhStock.totalReturnPercent,
      outperformance: dcaStock.totalPNL - bhStock.totalReturn,
      outperformancePercent: ((dcaStock.totalPNL - bhStock.totalReturn) / bhStock.totalReturn) * 100
    };
  }).filter(Boolean);

  return {
    dcaFinalValue: dcaSummary.finalPortfolioValue,
    buyAndHoldFinalValue: buyAndHoldMetrics.finalValue,
    outperformanceAmount,
    outperformancePercent,
    comparison,
    stockComparisons
  };
}
```

#### File: `backend/services/portfolioBacktestService.js` (MODIFIED)

Add after metrics calculation (around line 350):

```javascript
// Calculate Buy & Hold comparison
const buyAndHoldService = require('./portfolioBuyAndHoldService');
const buyAndHoldResults = buyAndHoldService.calculatePortfolioBuyAndHold(
  priceDataMap,
  config,
  { portfolioSummary: metrics, stockResults }
);

// Include in final results
return {
  success: true,
  portfolioRunId,
  parameters: config,
  portfolioSummary: metrics,
  stockResults,
  // ... existing time series ...
  buyAndHoldSummary: buyAndHoldResults.buyAndHoldSummary,
  comparison: buyAndHoldResults.comparison
};
```

---

## Frontend Design

### 3. Component Architecture

```
PortfolioResults
├─ PortfolioSummaryCard [UPDATED]
│  └─ Add outperformance badge
├─ PortfolioBuyAndHoldComparison [NEW]
│  ├─ ComparisonMetricsTable
│  └─ PerformanceIndicators
├─ DCAVsBuyAndHoldChart [NEW]
│  └─ Dual-line chart (Recharts)
├─ StockPerformanceTable [UPDATED]
│  └─ Add B&H columns per stock
└─ ... existing components
```

### 4. Component Designs

#### Component: `PortfolioBuyAndHoldComparison.js` (NEW)

```javascript
import React from 'react';
import './PortfolioBuyAndHoldComparison.css';

const PortfolioBuyAndHoldComparison = ({ comparison, buyAndHoldSummary }) => {
  if (!comparison || !buyAndHoldSummary) return null;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value) => {
    return `${value?.toFixed(2)}%`;
  };

  const getAdvantageClass = (advantage) => {
    return advantage === 'DCA' ? 'advantage-dca' : 'advantage-bh';
  };

  return (
    <div className="buy-hold-comparison">
      <h3>DCA vs Buy & Hold Comparison</h3>

      {/* Overall Performance */}
      <div className="comparison-summary">
        <div className="strategy-card dca-card">
          <div className="strategy-label">DCA Strategy</div>
          <div className="strategy-value">{formatCurrency(comparison.dcaFinalValue)}</div>
        </div>

        <div className="vs-divider">
          <span>vs</span>
        </div>

        <div className="strategy-card bh-card">
          <div className="strategy-label">Buy & Hold</div>
          <div className="strategy-value">{formatCurrency(comparison.buyAndHoldFinalValue)}</div>
        </div>
      </div>

      {/* Outperformance Badge */}
      <div className={`outperformance-badge ${comparison.outperformanceAmount >= 0 ? 'positive' : 'negative'}`}>
        <div className="badge-label">Outperformance</div>
        <div className="badge-value">
          {formatCurrency(comparison.outperformanceAmount)} ({formatPercent(comparison.outperformancePercent)})
        </div>
      </div>

      {/* Detailed Comparison Table */}
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>DCA</th>
            <th>Buy & Hold</th>
            <th>Difference</th>
            <th>Advantage</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total Return</td>
            <td>{formatCurrency(comparison.comparison.totalReturn.dca)}</td>
            <td>{formatCurrency(comparison.comparison.totalReturn.buyAndHold)}</td>
            <td className={comparison.comparison.totalReturn.difference >= 0 ? 'positive' : 'negative'}>
              {formatCurrency(comparison.comparison.totalReturn.difference)}
            </td>
            <td className={getAdvantageClass(comparison.comparison.totalReturn.advantage)}>
              {comparison.comparison.totalReturn.advantage}
            </td>
          </tr>

          <tr>
            <td>CAGR</td>
            <td>{formatPercent(comparison.comparison.cagr.dca)}</td>
            <td>{formatPercent(comparison.comparison.cagr.buyAndHold)}</td>
            <td className={comparison.comparison.cagr.difference >= 0 ? 'positive' : 'negative'}>
              {formatPercent(comparison.comparison.cagr.difference)} pts
            </td>
            <td className={getAdvantageClass(comparison.comparison.cagr.advantage)}>
              {comparison.comparison.cagr.advantage}
            </td>
          </tr>

          <tr>
            <td>Max Drawdown</td>
            <td>{formatPercent(comparison.comparison.maxDrawdown.dca)}</td>
            <td>{formatPercent(comparison.comparison.maxDrawdown.buyAndHold)}</td>
            <td className={comparison.comparison.maxDrawdown.difference >= 0 ? 'positive' : 'negative'}>
              {formatPercent(comparison.comparison.maxDrawdown.difference)} pts
            </td>
            <td className={getAdvantageClass(comparison.comparison.maxDrawdown.advantage)}>
              {comparison.comparison.maxDrawdown.advantage}
            </td>
          </tr>

          <tr>
            <td>Sharpe Ratio</td>
            <td>{comparison.comparison.sharpeRatio.dca?.toFixed(2)}</td>
            <td>{comparison.comparison.sharpeRatio.buyAndHold?.toFixed(2)}</td>
            <td className={comparison.comparison.sharpeRatio.difference >= 0 ? 'positive' : 'negative'}>
              {comparison.comparison.sharpeRatio.difference?.toFixed(2)}
            </td>
            <td className={getAdvantageClass(comparison.comparison.sharpeRatio.advantage)}>
              {comparison.comparison.sharpeRatio.advantage}
            </td>
          </tr>

          <tr>
            <td>Volatility</td>
            <td>{formatPercent(comparison.comparison.volatility.dca * 100)}</td>
            <td>{formatPercent(comparison.comparison.volatility.buyAndHold * 100)}</td>
            <td className={comparison.comparison.volatility.difference <= 0 ? 'positive' : 'negative'}>
              {formatPercent(comparison.comparison.volatility.difference * 100)} pts
            </td>
            <td className={getAdvantageClass(comparison.comparison.volatility.advantage)}>
              {comparison.comparison.volatility.advantage}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default PortfolioBuyAndHoldComparison;
```

#### Component: `DCAVsBuyAndHoldChart.js` (NEW)

```javascript
import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const DCAVsBuyAndHoldChart = ({ dcaTimeSeries, buyAndHoldTimeSeries }) => {
  // Merge the two time series by date
  const mergedData = dcaTimeSeries.map(dcaPoint => {
    const bhPoint = buyAndHoldTimeSeries.find(bh => bh.date === dcaPoint.date);
    return {
      date: dcaPoint.date,
      dcaValue: dcaPoint.portfolioValue,
      buyAndHoldValue: bhPoint?.portfolioValue || null
    };
  });

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="dca-vs-buyandhold-chart">
      <h3>Portfolio Value Over Time: DCA vs Buy & Hold</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={mergedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => new Date(date).toLocaleDateString()}
          />
          <YAxis
            tickFormatter={formatCurrency}
          />
          <Tooltip
            formatter={(value) => formatCurrency(value)}
            labelFormatter={(label) => new Date(label).toLocaleDateString()}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="dcaValue"
            stroke="#6366f1"
            name="DCA Strategy"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="buyAndHoldValue"
            stroke="#10b981"
            name="Buy & Hold"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DCAVsBuyAndHoldChart;
```

#### Update: `PortfolioSummaryCard.js`

Add outperformance badge after final value metric:

```javascript
{comparison && (
  <div className={`metric-box outperformance-badge ${comparison.outperformanceAmount >= 0 ? 'positive' : 'negative'}`}>
    <div className="label">vs Buy & Hold</div>
    <div className="value">
      {comparison.outperformanceAmount >= 0 ? '+' : ''}
      {formatCurrency(comparison.outperformanceAmount)}
    </div>
    <div className="sub-value">
      {formatPercent(comparison.outperformancePercent)} {comparison.outperformanceAmount >= 0 ? 'outperformance' : 'underperformance'}
    </div>
  </div>
)}
```

#### Update: `StockPerformanceTable.js`

Add Buy & Hold columns:

```javascript
<th>B&H Return</th>
<th>B&H Return %</th>
<th>Outperformance</th>

// In row rendering:
{stockComparison && (
  <>
    <td>{formatCurrency(stockComparison.buyAndHoldReturn)}</td>
    <td className={stockComparison.buyAndHoldReturnPercent >= 0 ? 'positive' : 'negative'}>
      {formatPercent(stockComparison.buyAndHoldReturnPercent)}
    </td>
    <td className={stockComparison.outperformance >= 0 ? 'positive' : 'negative'}>
      {formatCurrency(stockComparison.outperformance)} ({formatPercent(stockComparison.outperformancePercent)})
    </td>
  </>
)}
```

---

## CSS Styling

### File: `frontend/src/App.css` (additions)

```css
/* Buy & Hold Comparison Section */
.buy-hold-comparison {
  background: white;
  border-radius: 8px;
  padding: 24px;
  margin: 24px 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.buy-hold-comparison h3 {
  margin: 0 0 24px 0;
  font-size: 1.25rem;
  color: #1f2937;
}

/* Comparison Summary Cards */
.comparison-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-bottom: 24px;
}

.strategy-card {
  flex: 1;
  max-width: 300px;
  padding: 24px;
  border-radius: 8px;
  text-align: center;
  border: 2px solid;
}

.strategy-card.dca-card {
  border-color: #6366f1;
  background: #f0f0ff;
}

.strategy-card.bh-card {
  border-color: #10b981;
  background: #f0fdf4;
}

.strategy-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.strategy-value {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
}

.vs-divider {
  font-size: 1.5rem;
  font-weight: 700;
  color: #9ca3af;
}

/* Outperformance Badge */
.outperformance-badge {
  padding: 16px 24px;
  border-radius: 8px;
  text-align: center;
  margin-bottom: 24px;
}

.outperformance-badge.positive {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.outperformance-badge.negative {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

.badge-label {
  font-size: 0.875rem;
  font-weight: 600;
  opacity: 0.9;
  margin-bottom: 4px;
}

.badge-value {
  font-size: 1.5rem;
  font-weight: 700;
}

/* Comparison Table */
.comparison-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
}

.comparison-table th {
  background: #f9fafb;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
}

.comparison-table td {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.comparison-table td.positive {
  color: #059669;
  font-weight: 600;
}

.comparison-table td.negative {
  color: #dc2626;
  font-weight: 600;
}

.comparison-table td.advantage-dca {
  color: #6366f1;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.875rem;
}

.comparison-table td.advantage-bh {
  color: #10b981;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.875rem;
}

/* Chart Styling */
.dca-vs-buyandhold-chart {
  background: white;
  border-radius: 8px;
  padding: 24px;
  margin: 24px 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.dca-vs-buyandhold-chart h3 {
  margin: 0 0 16px 0;
  font-size: 1.125rem;
  color: #1f2937;
}

/* Responsive Design */
@media (max-width: 768px) {
  .comparison-summary {
    flex-direction: column;
  }

  .strategy-card {
    max-width: 100%;
  }

  .comparison-table {
    font-size: 0.875rem;
  }

  .comparison-table th,
  .comparison-table td {
    padding: 8px;
  }
}
```

---

## Edge Case Handling

### 1. Missing Price Data
- If a stock has no price on start date, use first available price after start date
- If a stock has no price on end date, use last available price before end date
- Log warnings for data gaps

### 2. Very Short Backtest Periods
- If backtest period < 1 year, calculate returns but mark CAGR as "N/A" or use actual period
- Show warning: "Period too short for meaningful annualized metrics"

### 3. Zero or Negative Returns
- Handle Math.pow() edge cases for CAGR calculation
- Prevent division by zero in Sharpe ratio calculation
- Show "N/A" for undefined metrics

### 4. Stocks Added Mid-Period
- DCA may start buying a stock mid-period
- B&H should still buy at backtest start date
- May create comparison asymmetry (document in UI)

---

## Testing Strategy

### Unit Tests
- `calculateStockBuyAndHold()` with various price scenarios
- `generateBuyAndHoldTimeSeries()` with multiple stocks
- `calculateBuyAndHoldMetrics()` validation
- `generateComparisonMetrics()` with edge cases

### Integration Tests
- Full portfolio backtest with B&H comparison
- Single stock portfolio
- 10-stock portfolio
- Mixed performance (some outperform, some underperform)

### Manual Verification
- Create spreadsheet with same calculations
- Verify CAGR, max drawdown, Sharpe ratio match
- Check time series values spot check

---

## Performance Considerations

- Reuse existing price data (no additional API calls)
- Calculate time series in single pass
- Use efficient date lookups (Map or binary search)
- Limit time series snapshots if needed (e.g., daily instead of tick-by-tick)
- Expected overhead: < 500ms for typical 10-stock portfolio

---

## Future Enhancements

1. **Rebalancing Options**: Monthly/quarterly rebalancing for B&H
2. **Alternative Allocations**: Market cap weighted, equal dollar, custom weights
3. **Transaction Costs**: Add configurable transaction costs to both strategies
4. **Tax Considerations**: Long-term vs short-term capital gains comparison
5. **Benchmark Comparison**: Add S&P 500, NASDAQ as benchmarks
6. **Monte Carlo Simulation**: Risk analysis under different market scenarios
