# Spec 55: Beta-Grouped Portfolio Analysis - Design Document

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │  BetaGroupAnalysis.js                                 │  │
│  │  - Beta Group Summary Table                           │  │
│  │  - Beta Group Detail View                             │  │
│  │  - Comparison Charts                                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ HTTP (GET/POST)
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Portfolio Backtest Route                             │  │
│  │  POST /api/backtest/portfolio                         │  │
│  └────────────────┬──────────────────────────────────────┘  │
│                   │                                          │
│  ┌────────────────▼──────────────────────────────────────┐  │
│  │  portfolioBacktestService.js                          │  │
│  │  - Execute portfolio backtest                         │  │
│  │  - Collect per-stock results                          │  │
│  └────────────────┬──────────────────────────────────────┘  │
│                   │                                          │
│  ┌────────────────▼──────────────────────────────────────┐  │
│  │  betaGroupAnalysisService.js (NEW)                    │  │
│  │  - Fetch beta values for all stocks                   │  │
│  │  - Classify stocks into beta ranges                   │  │
│  │  - Aggregate performance per group                    │  │
│  │  - Calculate comparison statistics                    │  │
│  └────────────────┬──────────────────────────────────────┘  │
│                   │                                          │
│  ┌────────────────▼──────────────────────────────────────┐  │
│  │  betaDataService.js (existing)                        │  │
│  │  - Fetch beta from Yahoo Finance/Alpha Vantage        │  │
│  │  - Cache beta values (7-day expiry)                   │  │
│  │  - Handle fallbacks (default to 1.0)                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Data Model

### Beta Group Definition

```javascript
const BETA_RANGES = [
  {
    id: 'low',
    label: '0.00 - 0.50',
    description: 'Low volatility (defensive stocks)',
    minBeta: 0,
    maxBeta: 0.5,
    color: '#4CAF50' // Green
  },
  {
    id: 'below-market',
    label: '0.50 - 1.00',
    description: 'Below-market volatility',
    minBeta: 0.5,
    maxBeta: 1.0,
    color: '#8BC34A' // Light Green
  },
  {
    id: 'market',
    label: '1.00 - 1.50',
    description: 'Market-level volatility',
    minBeta: 1.0,
    maxBeta: 1.5,
    color: '#FFC107' // Amber
  },
  {
    id: 'high',
    label: '1.50 - 2.00',
    description: 'High volatility',
    minBeta: 1.5,
    maxBeta: 2.0,
    color: '#FF9800' // Orange
  },
  {
    id: 'very-high',
    label: '> 2.00',
    description: 'Very high volatility',
    minBeta: 2.0,
    maxBeta: Infinity,
    color: '#F44336' // Red
  }
];
```

### Beta Group Performance Model

```javascript
{
  range: "1.00 - 1.50",
  rangeId: "market",
  description: "Market-level volatility",
  minBeta: 1.0,
  maxBeta: 1.5,
  color: "#FFC107",

  // Stock composition
  stockCount: 50,
  stocks: [
    {
      symbol: "AAPL",
      beta: 1.11,
      totalReturnPercent: 45.2,
      totalReturnDollar: 22600,
      trades: 12,
      winRate: 75.0
    },
    // ... more stocks
  ],

  // Aggregated performance
  performance: {
    totalReturnPercent: 32.5,      // Weighted average across all stocks
    totalReturnDollar: 1625000,    // Sum of all stock returns in group
    cagrPercent: 18.2,             // Compound annual growth rate
    winRate: 68.5,                 // % of profitable trades
    avgProfitPerTrade: 1250,       // Average $ profit on winning trades
    avgLossPerTrade: -580,         // Average $ loss on losing trades
    totalTrades: 650,              // Total number of trades across all stocks
    deployedCapital: 5000000,      // Total capital allocated to this group
    profitFactor: 2.15             // avgProfit / |avgLoss|
  },

  // Top/bottom performers
  topPerformers: [
    { symbol: "NVDA", beta: 2.12, totalReturnPercent: 85.5 },
    { symbol: "META", beta: 1.20, totalReturnPercent: 52.3 },
    { symbol: "AAPL", beta: 1.11, totalReturnPercent: 45.2 }
  ],
  bottomPerformers: [
    { symbol: "INTC", beta: 1.33, totalReturnPercent: -12.5 },
    { symbol: "EBAY", beta: 1.30, totalReturnPercent: -8.2 }
  ]
}
```

### API Response Structure

```javascript
{
  success: true,
  data: {
    // Existing portfolio backtest results
    portfolioSummary: {
      totalReturnPercent: 28.5,
      totalReturnDollar: 855000,
      // ... other portfolio metrics
    },
    stockResults: [
      {
        symbol: "AAPL",
        totalReturnPercent: 45.2,
        // ... other stock metrics
      }
      // ... more stocks
    ],

    // NEW: Beta grouping analysis
    betaGrouping: {
      groups: [
        {
          range: "0.00 - 0.50",
          rangeId: "low",
          stockCount: 14,
          stocks: [ /* stock details */ ],
          performance: { /* aggregated metrics */ },
          topPerformers: [ /* top 5 */ ],
          bottomPerformers: [ /* bottom 5 */ ]
        },
        // ... 4 more groups
      ],
      summary: {
        totalStocks: 105,
        avgBeta: 1.18,
        medianBeta: 1.09,
        minBeta: 0.13,
        maxBeta: 4.12,
        bestPerformingGroup: {
          rangeId: "high",
          range: "1.50 - 2.00",
          totalReturnPercent: 42.5
        },
        worstPerformingGroup: {
          rangeId: "low",
          range: "0.00 - 0.50",
          totalReturnPercent: 18.2
        }
      }
    }
  }
}
```

## Backend Implementation

### betaGroupAnalysisService.js (NEW)

```javascript
/**
 * Service to analyze portfolio backtest results grouped by beta ranges
 *
 * Location: /Users/kweng/AI/DCA-Backtest-Tool/backend/services/betaGroupAnalysisService.js
 */

const betaDataService = require('./betaDataService');

const BETA_RANGES = [
  { id: 'low', label: '0.00 - 0.50', minBeta: 0, maxBeta: 0.5, color: '#4CAF50' },
  { id: 'below-market', label: '0.50 - 1.00', minBeta: 0.5, maxBeta: 1.0, color: '#8BC34A' },
  { id: 'market', label: '1.00 - 1.50', minBeta: 1.0, maxBeta: 1.5, color: '#FFC107' },
  { id: 'high', label: '1.50 - 2.00', minBeta: 1.5, maxBeta: 2.0, color: '#FF9800' },
  { id: 'very-high', label: '> 2.00', minBeta: 2.0, maxBeta: Infinity, color: '#F44336' }
];

class BetaGroupAnalysisService {

  /**
   * Analyze portfolio backtest results by beta grouping
   *
   * @param {Array} stockResults - Array of stock backtest results
   * @returns {Object} Beta grouping analysis
   */
  async analyzeBetaGroups(stockResults) {
    // Step 1: Fetch beta values for all stocks
    const stocksWithBeta = await this._enrichWithBeta(stockResults);

    // Step 2: Classify stocks into beta ranges
    const groups = this._classifyByBetaRange(stocksWithBeta);

    // Step 3: Aggregate performance metrics per group
    const groupsWithMetrics = this._aggregateGroupMetrics(groups);

    // Step 4: Calculate summary statistics
    const summary = this._calculateSummary(stocksWithBeta, groupsWithMetrics);

    return {
      groups: groupsWithMetrics,
      summary
    };
  }

  /**
   * Enrich stock results with beta values
   */
  async _enrichWithBeta(stockResults) {
    const enriched = [];

    for (const stock of stockResults) {
      try {
        const betaData = await betaDataService.fetchBeta(stock.symbol);
        enriched.push({
          ...stock,
          beta: betaData.beta,
          betaSource: betaData.source
        });
      } catch (error) {
        console.warn(`Failed to fetch beta for ${stock.symbol}, defaulting to 1.0`);
        enriched.push({
          ...stock,
          beta: 1.0,
          betaSource: 'default'
        });
      }
    }

    return enriched;
  }

  /**
   * Classify stocks into beta ranges
   */
  _classifyByBetaRange(stocksWithBeta) {
    const groups = BETA_RANGES.map(range => ({
      ...range,
      stocks: []
    }));

    for (const stock of stocksWithBeta) {
      for (const group of groups) {
        if (stock.beta >= group.minBeta && stock.beta < group.maxBeta) {
          group.stocks.push(stock);
          break;
        }
      }
    }

    return groups;
  }

  /**
   * Aggregate performance metrics per group
   */
  _aggregateGroupMetrics(groups) {
    return groups.map(group => {
      const stocks = group.stocks;

      if (stocks.length === 0) {
        return {
          ...group,
          stockCount: 0,
          performance: null,
          topPerformers: [],
          bottomPerformers: []
        };
      }

      // Calculate aggregate metrics
      const totalReturnDollar = stocks.reduce((sum, s) => sum + (s.totalReturnDollar || 0), 0);
      const deployedCapital = stocks.reduce((sum, s) => sum + (s.deployedCapital || 0), 0);
      const totalReturnPercent = deployedCapital > 0
        ? (totalReturnDollar / deployedCapital) * 100
        : 0;

      const totalTrades = stocks.reduce((sum, s) => sum + (s.totalTrades || 0), 0);
      const winningTrades = stocks.reduce((sum, s) => sum + (s.winningTrades || 0), 0);
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

      const totalProfit = stocks.reduce((sum, s) => sum + (s.totalProfit || 0), 0);
      const totalLoss = stocks.reduce((sum, s) => sum + (s.totalLoss || 0), 0);
      const avgProfitPerTrade = winningTrades > 0 ? totalProfit / winningTrades : 0;
      const avgLossPerTrade = (totalTrades - winningTrades) > 0
        ? totalLoss / (totalTrades - winningTrades)
        : 0;

      // Calculate CAGR (simplified - assuming portfolio period is known)
      // TODO: Pass portfolio start/end dates for accurate CAGR calculation
      const cagrPercent = totalReturnPercent; // Placeholder

      // Sort stocks by performance
      const sortedStocks = [...stocks].sort((a, b) =>
        (b.totalReturnPercent || 0) - (a.totalReturnPercent || 0)
      );

      return {
        ...group,
        stockCount: stocks.length,
        performance: {
          totalReturnPercent: parseFloat(totalReturnPercent.toFixed(2)),
          totalReturnDollar: parseFloat(totalReturnDollar.toFixed(2)),
          cagrPercent: parseFloat(cagrPercent.toFixed(2)),
          winRate: parseFloat(winRate.toFixed(2)),
          avgProfitPerTrade: parseFloat(avgProfitPerTrade.toFixed(2)),
          avgLossPerTrade: parseFloat(avgLossPerTrade.toFixed(2)),
          totalTrades,
          deployedCapital: parseFloat(deployedCapital.toFixed(2)),
          profitFactor: avgLossPerTrade !== 0 ? avgProfitPerTrade / Math.abs(avgLossPerTrade) : 0
        },
        topPerformers: sortedStocks.slice(0, 5).map(s => ({
          symbol: s.symbol,
          beta: s.beta,
          totalReturnPercent: s.totalReturnPercent
        })),
        bottomPerformers: sortedStocks.slice(-5).reverse().map(s => ({
          symbol: s.symbol,
          beta: s.beta,
          totalReturnPercent: s.totalReturnPercent
        }))
      };
    });
  }

  /**
   * Calculate summary statistics
   */
  _calculateSummary(stocksWithBeta, groups) {
    const betas = stocksWithBeta.map(s => s.beta);
    const avgBeta = betas.reduce((sum, b) => sum + b, 0) / betas.length;
    const sortedBetas = [...betas].sort((a, b) => a - b);
    const medianBeta = sortedBetas[Math.floor(sortedBetas.length / 2)];
    const minBeta = Math.min(...betas);
    const maxBeta = Math.max(...betas);

    // Find best and worst performing groups
    const groupsWithPerformance = groups.filter(g => g.performance !== null);
    const sortedGroups = [...groupsWithPerformance].sort((a, b) =>
      b.performance.totalReturnPercent - a.performance.totalReturnPercent
    );

    const bestGroup = sortedGroups[0];
    const worstGroup = sortedGroups[sortedGroups.length - 1];

    return {
      totalStocks: stocksWithBeta.length,
      avgBeta: parseFloat(avgBeta.toFixed(2)),
      medianBeta: parseFloat(medianBeta.toFixed(2)),
      minBeta: parseFloat(minBeta.toFixed(2)),
      maxBeta: parseFloat(maxBeta.toFixed(2)),
      bestPerformingGroup: bestGroup ? {
        rangeId: bestGroup.id,
        range: bestGroup.label,
        totalReturnPercent: bestGroup.performance.totalReturnPercent
      } : null,
      worstPerformingGroup: worstGroup ? {
        rangeId: worstGroup.id,
        range: worstGroup.label,
        totalReturnPercent: worstGroup.performance.totalReturnPercent
      } : null
    };
  }
}

module.exports = new BetaGroupAnalysisService();
```

### Integration with portfolioBacktestService.js

**Location**: `/Users/kweng/AI/DCA-Backtest-Tool/backend/services/portfolioBacktestService.js`

**Modification**: Add beta grouping analysis to the final response

```javascript
const betaGroupAnalysisService = require('./betaGroupAnalysisService');

async function runPortfolioBacktest(config) {
  // ... existing portfolio backtest logic ...

  // Collect stock results
  const stockResults = portfolio.stocks.map(stock => ({
    symbol: stock.symbol,
    totalReturnPercent: stock.getTotalReturnPercent(),
    totalReturnDollar: stock.getTotalReturn(),
    deployedCapital: stock.capitalDeployed,
    totalTrades: stock.trades.length,
    winningTrades: stock.getWinningTradesCount(),
    totalProfit: stock.getTotalProfit(),
    totalLoss: stock.getTotalLoss(),
    // ... other metrics
  }));

  // NEW: Analyze beta grouping
  const betaGrouping = await betaGroupAnalysisService.analyzeBetaGroups(stockResults);

  return {
    success: true,
    data: {
      portfolioSummary: { /* ... */ },
      stockResults,
      betaGrouping // Add beta grouping to response
    }
  };
}
```

## Frontend Implementation

### Component Structure

**Location**: `/Users/kweng/AI/DCA-Backtest-Tool/frontend/src/components/backtest/BetaGroupAnalysis.js`

```javascript
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function BetaGroupAnalysis({ betaGrouping }) {
  const [selectedGroup, setSelectedGroup] = useState(null);

  if (!betaGrouping || !betaGrouping.groups) {
    return null;
  }

  return (
    <div className="beta-group-analysis">
      <h2>Beta Group Analysis</h2>

      {/* Summary Section */}
      <BetaGroupSummary summary={betaGrouping.summary} />

      {/* Comparison Table */}
      <BetaGroupTable
        groups={betaGrouping.groups}
        onSelectGroup={setSelectedGroup}
      />

      {/* Comparison Charts */}
      <BetaGroupCharts groups={betaGrouping.groups} />

      {/* Detail View (when group selected) */}
      {selectedGroup && (
        <BetaGroupDetail group={selectedGroup} />
      )}
    </div>
  );
}

function BetaGroupSummary({ summary }) {
  return (
    <div className="beta-summary">
      <div className="summary-stats">
        <div className="stat">
          <span className="label">Total Stocks:</span>
          <span className="value">{summary.totalStocks}</span>
        </div>
        <div className="stat">
          <span className="label">Avg Beta:</span>
          <span className="value">{summary.avgBeta}</span>
        </div>
        <div className="stat">
          <span className="label">Best Group:</span>
          <span className="value">{summary.bestPerformingGroup?.range}
            ({summary.bestPerformingGroup?.totalReturnPercent}%)</span>
        </div>
      </div>
    </div>
  );
}

function BetaGroupTable({ groups, onSelectGroup }) {
  return (
    <table className="beta-group-table">
      <thead>
        <tr>
          <th>Beta Range</th>
          <th>Stocks</th>
          <th>Total Return %</th>
          <th>CAGR %</th>
          <th>Win Rate %</th>
          <th>Deployed Capital</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {groups.map(group => (
          <tr key={group.rangeId} style={{ borderLeft: `4px solid ${group.color}` }}>
            <td>{group.label}</td>
            <td>{group.stockCount}</td>
            <td>{group.performance?.totalReturnPercent || 'N/A'}</td>
            <td>{group.performance?.cagrPercent || 'N/A'}</td>
            <td>{group.performance?.winRate || 'N/A'}</td>
            <td>${(group.performance?.deployedCapital || 0).toLocaleString()}</td>
            <td>
              <button onClick={() => onSelectGroup(group)}>Details</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BetaGroupCharts({ groups }) {
  const chartData = groups
    .filter(g => g.performance !== null)
    .map(g => ({
      range: g.label,
      'Total Return %': g.performance.totalReturnPercent,
      'CAGR %': g.performance.cagrPercent,
      'Win Rate %': g.performance.winRate
    }));

  return (
    <div className="beta-group-charts">
      <h3>Performance Comparison</h3>
      <BarChart width={800} height={400} data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="range" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="Total Return %" fill="#8884d8" />
        <Bar dataKey="CAGR %" fill="#82ca9d" />
        <Bar dataKey="Win Rate %" fill="#ffc658" />
      </BarChart>
    </div>
  );
}

function BetaGroupDetail({ group }) {
  return (
    <div className="beta-group-detail">
      <h3>{group.label} - Detailed View</h3>

      <div className="performers">
        <div className="top-performers">
          <h4>Top Performers</h4>
          <ul>
            {group.topPerformers.map(stock => (
              <li key={stock.symbol}>
                {stock.symbol} (β={stock.beta}): {stock.totalReturnPercent}%
              </li>
            ))}
          </ul>
        </div>

        <div className="bottom-performers">
          <h4>Bottom Performers</h4>
          <ul>
            {group.bottomPerformers.map(stock => (
              <li key={stock.symbol}>
                {stock.symbol} (β={stock.beta}): {stock.totalReturnPercent}%
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
```

### Integration with Portfolio Results Page

**Location**: `/Users/kweng/AI/DCA-Backtest-Tool/frontend/src/pages/PortfolioResultsPage.js`

```javascript
import BetaGroupAnalysis from '../components/backtest/BetaGroupAnalysis';

function PortfolioResultsPage() {
  const [backtestData, setBacktestData] = useState(null);

  // ... existing fetch logic ...

  return (
    <div className="portfolio-results">
      <h1>Portfolio Backtest Results</h1>

      {/* Existing portfolio summary */}
      <PortfolioSummary data={backtestData.portfolioSummary} />

      {/* NEW: Beta grouping analysis */}
      {backtestData.betaGrouping && (
        <BetaGroupAnalysis betaGrouping={backtestData.betaGrouping} />
      )}

      {/* Existing stock results */}
      <StockResultsTable results={backtestData.stockResults} />
    </div>
  );
}
```

## Testing Strategy

### Unit Tests

**Backend**:
1. **betaGroupAnalysisService.js**
   - Test `_enrichWithBeta()`: Verify beta fetching for 105 stocks
   - Test `_classifyByBetaRange()`: Verify correct grouping
   - Test `_aggregateGroupMetrics()`: Verify calculations (return %, CAGR, win rate)
   - Test `_calculateSummary()`: Verify summary statistics

**Frontend**:
1. **BetaGroupAnalysis.js**
   - Test component renders with valid data
   - Test component handles missing data gracefully
   - Test group selection interaction
   - Test chart rendering

### Integration Tests

1. **Full Portfolio Backtest with Beta Grouping**
   - Run portfolio backtest for nasdaq100.json
   - Verify `betaGrouping` object in response
   - Verify all 105 stocks are classified
   - Verify performance metrics are accurate

### Manual Testing

1. **UI Testing**
   - Verify beta group table displays correctly
   - Verify charts render properly
   - Verify drill-down to group details works
   - Verify performance comparison is clear

2. **Performance Testing**
   - Measure beta fetching time (target: <2 seconds for 105 stocks with caching)
   - Measure aggregation time (target: <500ms)

## Edge Cases

1. **Missing Beta Values**
   - **Issue**: Beta unavailable for some stocks
   - **Solution**: Default to 1.0, mark as 'default' source, display warning in UI

2. **Empty Beta Groups**
   - **Issue**: Some beta ranges may have 0 stocks
   - **Solution**: Display "N/A" for performance metrics, hide from charts

3. **Capital Constraint Rejections** (Phase 2)
   - **Issue**: Stocks compete for capital, complicating attribution
   - **Solution**: Phase 1 assumes sufficient capital; Phase 2 will track rejection reasons

4. **Beta Value Changes Over Time**
   - **Issue**: Beta may change during backtest period
   - **Solution**: Use latest beta value; future enhancement could track beta evolution

## Performance Considerations

1. **Beta Fetching**
   - Leverage existing cache (7-day expiry)
   - Parallel fetching for multiple stocks
   - Target: <2 seconds for 105 stocks

2. **Aggregation**
   - Single-pass aggregation where possible
   - Avoid nested loops (O(n) complexity)
   - Target: <500ms for 105 stocks

3. **Frontend Rendering**
   - Lazy-load charts (only render when visible)
   - Paginate stock lists if >100 stocks
   - Use React.memo for expensive components

## Security Considerations

- No new security risks introduced
- Beta fetching uses existing authenticated service
- No sensitive data exposed in beta grouping

## Deployment Plan

**Phase 1: Backend**
1. Create `betaGroupAnalysisService.js`
2. Integrate with `portfolioBacktestService.js`
3. Test with curl commands
4. Deploy to backend

**Phase 2: Frontend**
1. Create `BetaGroupAnalysis.js` component
2. Integrate with portfolio results page
3. Test with real portfolio backtest
4. Deploy to frontend

**Phase 3: Validation**
1. Run full NASDAQ-100 backtest
2. Verify beta distribution matches analysis script
3. Validate performance metrics manually
4. Gather user feedback
