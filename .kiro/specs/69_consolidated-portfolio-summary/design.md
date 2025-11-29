# Spec 69: Design Document

## Component Architecture

### New Component: `PortfolioComparisonSummary`

```
PortfolioComparisonSummary
├── SummaryHeader (DCA vs B&H cards with outperformance badge)
├── ComparisonTable (grouped metrics with color coding)
│   ├── Returns category
│   ├── Risk-Adjusted category
│   └── Risk Metrics category
└── PortfolioActivityFooter (DCA-only metrics)
```

## Data Flow

```
PortfolioResults
    │
    ├── portfolioSummary (DCA metrics)
    │   ├── totalCapital
    │   ├── finalPortfolioValue
    │   ├── totalReturn / totalReturnPercent
    │   ├── cagr
    │   ├── maxDrawdown / maxDrawdownPercent
    │   ├── sharpeRatio
    │   ├── volatility
    │   ├── totalBuys / totalSells
    │   ├── winRate
    │   ├── capitalUtilizationPercent
    │   ├── deployedCapital
    │   └── rejectedBuys
    │
    ├── comparison
    │   ├── dcaFinalValue
    │   ├── buyAndHoldFinalValue
    │   ├── outperformanceAmount
    │   ├── outperformancePercent
    │   └── comparison (detailed per-metric)
    │       ├── totalReturn { dca, buyAndHold, difference, advantage }
    │       ├── cagr { dca, buyAndHold, difference, advantage }
    │       ├── maxDrawdown { dca, buyAndHold, difference, advantage }
    │       ├── sharpeRatio { dca, buyAndHold, difference, advantage }
    │       └── volatility { dca, buyAndHold, difference, advantage }
    │
    └── buyAndHoldSummary
        ├── finalValue
        ├── totalReturn
        └── cagr
```

## Component Implementation

### PortfolioComparisonSummary.js

```javascript
import React from 'react';
import './PortfolioComparisonSummary.css';

const PortfolioComparisonSummary = ({
  portfolioSummary,
  comparison,
  buyAndHoldSummary,
  stockCount,
  deferredSellsCount
}) => {
  // Helper functions for formatting
  const formatCurrency = (value) => { /* ... */ };
  const formatPercent = (value) => { /* ... */ };

  // Determine advantage color class
  const getAdvantageClass = (dcaValue, bhValue, higherIsBetter) => {
    if (higherIsBetter) {
      return dcaValue > bhValue ? 'dca-wins' : 'bh-wins';
    } else {
      return dcaValue < bhValue ? 'dca-wins' : 'bh-wins';
    }
  };

  // Metrics configuration
  const metricsConfig = [
    { category: 'Returns', metrics: [
      { label: 'Total Return', key: 'totalReturn', format: 'currency', higherBetter: true },
      { label: 'CAGR', key: 'cagr', format: 'percent', higherBetter: true }
    ]},
    { category: 'Risk-Adjusted', metrics: [
      { label: 'Sharpe Ratio', key: 'sharpeRatio', format: 'ratio', higherBetter: true },
      { label: 'Sortino Ratio', key: 'sortinoRatio', format: 'ratio', higherBetter: true },
      { label: 'Calmar Ratio', key: 'calmarRatio', format: 'ratio', higherBetter: true }
    ]},
    { category: 'Risk Metrics', metrics: [
      { label: 'Max Drawdown', key: 'maxDrawdown', format: 'percent', higherBetter: false },
      { label: 'Volatility', key: 'volatility', format: 'percent', higherBetter: false }
    ]}
  ];

  return (
    <div className="portfolio-comparison-summary">
      {/* Header: DCA vs B&H Cards */}
      <SummaryHeader comparison={comparison} />

      {/* Comparison Table */}
      <ComparisonTable
        metricsConfig={metricsConfig}
        comparison={comparison}
        getAdvantageClass={getAdvantageClass}
      />

      {/* Portfolio Activity Footer */}
      <PortfolioActivityFooter
        portfolioSummary={portfolioSummary}
        stockCount={stockCount}
        deferredSellsCount={deferredSellsCount}
      />
    </div>
  );
};
```

### Sub-components

#### SummaryHeader
```javascript
const SummaryHeader = ({ comparison }) => (
  <div className="summary-header">
    <div className="strategy-card dca">
      <span className="label">DCA Strategy</span>
      <span className="value">{formatCurrency(comparison.dcaFinalValue)}</span>
    </div>
    <div className="vs-divider">vs</div>
    <div className="strategy-card bh">
      <span className="label">Buy & Hold</span>
      <span className="value">{formatCurrency(comparison.buyAndHoldFinalValue)}</span>
    </div>
    <div className={`outperformance-badge ${comparison.outperformanceAmount >= 0 ? 'positive' : 'negative'}`}>
      {comparison.outperformanceAmount >= 0 ? 'DCA Outperformance' : 'DCA Underperformance'}
      <span className="amount">
        {formatCurrency(comparison.outperformanceAmount)} ({formatPercent(comparison.outperformancePercent)})
      </span>
    </div>
  </div>
);
```

#### ComparisonTable
```javascript
const ComparisonTable = ({ metricsConfig, comparison, getAdvantageClass }) => (
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
      {metricsConfig.map(category => (
        <React.Fragment key={category.category}>
          <tr className="category-row">
            <td colSpan="5">{category.category}</td>
          </tr>
          {category.metrics.map(metric => {
            const data = comparison.comparison[metric.key];
            const advantageClass = getAdvantageClass(data.dca, data.buyAndHold, metric.higherBetter);
            return (
              <tr key={metric.key} className="metric-row">
                <td className="metric-label">{metric.label}</td>
                <td className={`metric-value ${advantageClass === 'dca-wins' ? 'winner' : 'loser'}`}>
                  {formatValue(data.dca, metric.format)}
                </td>
                <td className={`metric-value ${advantageClass === 'bh-wins' ? 'winner' : 'loser'}`}>
                  {formatValue(data.buyAndHold, metric.format)}
                </td>
                <td className={`difference ${data.difference >= 0 ? 'positive' : 'negative'}`}>
                  {formatDifference(data.difference, metric.format)}
                </td>
                <td className={`advantage ${advantageClass}`}>
                  {data.advantage}
                </td>
              </tr>
            );
          })}
        </React.Fragment>
      ))}
    </tbody>
  </table>
);
```

#### PortfolioActivityFooter
```javascript
const PortfolioActivityFooter = ({ portfolioSummary, stockCount, deferredSellsCount }) => (
  <div className="portfolio-activity-footer">
    <div className="activity-header">Portfolio Activity</div>
    <div className="activity-metrics">
      <div className="activity-item">
        <span className="label">Stocks</span>
        <span className="value">{stockCount}</span>
      </div>
      <div className="activity-item">
        <span className="label">Trades</span>
        <span className="value">
          {portfolioSummary.totalBuys + portfolioSummary.totalSells}
          <span className="detail">({portfolioSummary.totalBuys} buys, {portfolioSummary.totalSells} sells)</span>
        </span>
      </div>
      <div className="activity-item">
        <span className="label">Win Rate</span>
        <span className="value">{portfolioSummary.winRate?.toFixed(1)}%</span>
      </div>
      <div className="activity-item">
        <span className="label">Capital Utilization</span>
        <span className="value">{portfolioSummary.capitalUtilizationPercent?.toFixed(1)}%</span>
      </div>
      <div className="activity-item">
        <span className="label">Rejected Orders</span>
        <span className="value">{portfolioSummary.rejectedBuys || 0}</span>
      </div>
      <div className="activity-item">
        <span className="label">Deferred Sells</span>
        <span className="value">{deferredSellsCount || 0}</span>
      </div>
    </div>
  </div>
);
```

## CSS Styling

### Color Scheme (from ComparisonMetricsTable.css)

```css
/* Winner cell (green) */
.winner {
  background: #a7f3d0;
  border-left: 3px solid #059669;
  color: #065f46;
}

/* Loser cell (red) */
.loser {
  background: #fee2e2;
  border-left: 3px solid #ef4444;
  color: #991b1b;
}

/* Advantage badge */
.advantage.dca-wins {
  background: #10b981;
  color: white;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 4px;
}

.advantage.bh-wins {
  background: #6366f1;
  color: white;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 4px;
}

/* Positive/Negative difference */
.difference.positive {
  color: #059669;
}

.difference.negative {
  color: #dc2626;
}
```

## Integration with PortfolioResults.js

### Before
```javascript
<PortfolioSummaryCard summary={portfolioSummary} comparison={comparison} />
{/* ... other content ... */}
{comparison && buyAndHoldSummary && (
  <section className="buy-hold-comparison-section">
    <PortfolioBuyAndHoldComparison
      comparison={comparison}
      buyAndHoldSummary={buyAndHoldSummary}
    />
  </section>
)}
```

### After
```javascript
<PortfolioComparisonSummary
  portfolioSummary={portfolioSummary}
  comparison={comparison}
  buyAndHoldSummary={buyAndHoldSummary}
  stockCount={stockResults?.length || 0}
  deferredSellsCount={deferredSells?.length || 0}
/>
```

## Responsive Design

```css
@media (max-width: 768px) {
  .summary-header {
    flex-direction: column;
    gap: 10px;
  }

  .activity-metrics {
    grid-template-columns: repeat(2, 1fr);
  }

  .comparison-table {
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .activity-metrics {
    grid-template-columns: 1fr;
  }
}
```
