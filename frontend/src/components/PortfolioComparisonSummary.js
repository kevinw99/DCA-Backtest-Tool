/**
 * PortfolioComparisonSummary - Consolidated Portfolio Summary with DCA vs B&H Comparison
 *
 * Spec 69: Replaces PortfolioSummaryCard and PortfolioBuyAndHoldComparison
 * with a single unified component featuring:
 * - DCA vs B&H header cards with outperformance badge
 * - 5-column comparison table with color-coded advantage
 * - Portfolio activity footer for DCA-only metrics
 */

import React from 'react';
import './PortfolioComparisonSummary.css';

const PortfolioComparisonSummary = ({
  portfolioSummary,
  comparison,
  buyAndHoldSummary,
  stockCount = 0,
  deferredSellsCount = 0
}) => {
  // Guard clause
  if (!portfolioSummary) {
    return (
      <div className="portfolio-comparison-summary">
        <div className="loading-message">Loading portfolio summary...</div>
      </div>
    );
  }

  // Formatting helpers
  const formatCurrency = (value) => {
    if (value == null || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value) => {
    if (value == null || isNaN(value)) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  const formatRatio = (value) => {
    if (value == null || isNaN(value)) return 'N/A';
    return value.toFixed(2);
  };

  const formatDifference = (value, format) => {
    if (value == null || isNaN(value)) return 'N/A';
    const prefix = value >= 0 ? '+' : '';
    switch (format) {
      case 'currency':
        return `${prefix}${formatCurrency(value)}`;
      case 'percent':
        return `${prefix}${value.toFixed(2)}% pts`;
      case 'ratio':
        return `${prefix}${value.toFixed(2)}`;
      default:
        return `${prefix}${value.toFixed(2)}`;
    }
  };

  // Determine which strategy wins
  const getAdvantageClass = (dcaValue, bhValue, higherIsBetter) => {
    if (dcaValue == null || bhValue == null) return 'neutral';
    if (higherIsBetter) {
      return dcaValue > bhValue ? 'dca-wins' : dcaValue < bhValue ? 'bh-wins' : 'neutral';
    } else {
      return dcaValue < bhValue ? 'dca-wins' : dcaValue > bhValue ? 'bh-wins' : 'neutral';
    }
  };

  // Check if comparison data is available
  const hasComparison = comparison && comparison.comparison;

  // Build metrics for comparison table
  const metricsConfig = [];

  if (hasComparison) {
    // Returns category
    const returnsMetrics = [];
    if (comparison.comparison.totalReturn) {
      returnsMetrics.push({
        label: 'Total Return',
        data: comparison.comparison.totalReturn,
        format: 'currency',
        higherBetter: true
      });
    }
    if (comparison.comparison.totalReturnPercent) {
      returnsMetrics.push({
        label: 'Total Return %',
        data: comparison.comparison.totalReturnPercent,
        format: 'percent',
        higherBetter: true
      });
    }
    if (comparison.comparison.cagr) {
      returnsMetrics.push({
        label: 'CAGR',
        data: comparison.comparison.cagr,
        format: 'percent',
        higherBetter: true
      });
    }
    if (returnsMetrics.length > 0) {
      metricsConfig.push({ category: 'Returns', metrics: returnsMetrics });
    }

    // Risk-Adjusted category
    const riskAdjustedMetrics = [];
    if (comparison.comparison.sharpeRatio) {
      riskAdjustedMetrics.push({
        label: 'Sharpe Ratio',
        data: comparison.comparison.sharpeRatio,
        format: 'ratio',
        higherBetter: true
      });
    }
    if (comparison.comparison.sortinoRatio) {
      riskAdjustedMetrics.push({
        label: 'Sortino Ratio',
        data: comparison.comparison.sortinoRatio,
        format: 'ratio',
        higherBetter: true
      });
    }
    if (comparison.comparison.calmarRatio) {
      riskAdjustedMetrics.push({
        label: 'Calmar Ratio',
        data: comparison.comparison.calmarRatio,
        format: 'ratio',
        higherBetter: true
      });
    }
    if (riskAdjustedMetrics.length > 0) {
      metricsConfig.push({ category: 'Risk-Adjusted Returns', metrics: riskAdjustedMetrics });
    }

    // Risk Metrics category
    const riskMetrics = [];
    if (comparison.comparison.maxDrawdown) {
      riskMetrics.push({
        label: 'Max Drawdown',
        data: comparison.comparison.maxDrawdown,
        format: 'percent',
        higherBetter: false
      });
    }
    if (comparison.comparison.volatility) {
      riskMetrics.push({
        label: 'Volatility',
        data: comparison.comparison.volatility,
        format: 'percent',
        higherBetter: false
      });
    }
    if (riskMetrics.length > 0) {
      metricsConfig.push({ category: 'Risk Metrics', metrics: riskMetrics });
    }
  }

  return (
    <div className="portfolio-comparison-summary">
      {/* Section Title */}
      <div className="summary-title">
        <h2>Portfolio Performance Comparison</h2>
      </div>

      {/* Header: DCA vs B&H Cards */}
      {hasComparison && (
        <div className="summary-header">
          <div className="strategy-cards">
            <div className="strategy-card dca">
              <span className="strategy-label">DCA Strategy</span>
              <span className="strategy-value">{formatCurrency(comparison.dcaFinalValue)}</span>
            </div>
            <div className="vs-divider">
              <span>vs</span>
            </div>
            <div className="strategy-card bh">
              <span className="strategy-label">Buy & Hold</span>
              <span className="strategy-value">{formatCurrency(comparison.buyAndHoldFinalValue)}</span>
            </div>
          </div>

          <div className={`outperformance-badge ${comparison.outperformanceAmount >= 0 ? 'positive' : 'negative'}`}>
            <span className="badge-label">
              {comparison.outperformanceAmount >= 0 ? 'DCA Outperformance' : 'DCA Underperformance'}
            </span>
            <span className="badge-value">
              {comparison.outperformanceAmount >= 0 ? '+' : ''}
              {formatCurrency(comparison.outperformanceAmount)} ({formatPercent(comparison.outperformancePercent)})
            </span>
          </div>
        </div>
      )}

      {/* Comparison Table */}
      {metricsConfig.length > 0 && (
        <div className="comparison-table-container">
          <table className="comparison-table">
            <thead>
              <tr>
                <th className="col-metric">Metric</th>
                <th className="col-dca">DCA</th>
                <th className="col-bh">Buy & Hold</th>
                <th className="col-diff">Difference</th>
                <th className="col-advantage">Advantage</th>
              </tr>
            </thead>
            <tbody>
              {metricsConfig.map((category, catIdx) => (
                <React.Fragment key={catIdx}>
                  <tr className="category-row">
                    <td colSpan="5">{category.category}</td>
                  </tr>
                  {category.metrics.map((metric, metIdx) => {
                    const { data, format, higherBetter } = metric;
                    const advantageClass = getAdvantageClass(data.dca, data.buyAndHold, higherBetter);
                    const dcaCellClass = advantageClass === 'dca-wins' ? 'cell-winner' : advantageClass === 'bh-wins' ? 'cell-loser' : '';
                    const bhCellClass = advantageClass === 'bh-wins' ? 'cell-winner' : advantageClass === 'dca-wins' ? 'cell-loser' : '';

                    return (
                      <tr key={metIdx} className="metric-row">
                        <td className="metric-label">{metric.label}</td>
                        <td className={`metric-value ${dcaCellClass}`}>
                          {format === 'currency' ? formatCurrency(data.dca) :
                           format === 'percent' ? formatPercent(data.dca) :
                           formatRatio(data.dca)}
                        </td>
                        <td className={`metric-value ${bhCellClass}`}>
                          {format === 'currency' ? formatCurrency(data.buyAndHold) :
                           format === 'percent' ? formatPercent(data.buyAndHold) :
                           formatRatio(data.buyAndHold)}
                        </td>
                        <td className={`difference ${data.difference >= 0 ? 'positive' : 'negative'}`}>
                          {formatDifference(data.difference, format)}
                        </td>
                        <td className={`advantage ${advantageClass}`}>
                          <span className="advantage-badge">
                            {data.advantage === 'DCA' ? 'DCA' : 'B&H'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Portfolio Activity Footer (DCA-only metrics) */}
      <div className="portfolio-activity-footer">
        <div className="activity-header">Portfolio Activity (DCA Strategy)</div>
        <div className="activity-metrics">
          <div className="activity-item">
            <span className="item-label">Stocks</span>
            <span className="item-value">{stockCount}</span>
          </div>
          <div className="activity-item">
            <span className="item-label">Total Trades</span>
            <span className="item-value">
              {(portfolioSummary.totalBuys || 0) + (portfolioSummary.totalSells || 0)}
              <span className="item-detail">
                ({portfolioSummary.totalBuys || 0} buys, {portfolioSummary.totalSells || 0} sells)
              </span>
            </span>
          </div>
          <div className="activity-item">
            <span className="item-label">Win Rate</span>
            <span className="item-value">{formatPercent(portfolioSummary.winRate)}</span>
          </div>
          <div className="activity-item">
            <span className="item-label">Capital Utilization</span>
            <span className="item-value">
              {formatPercent(portfolioSummary.capitalUtilizationPercent)}
              <span className="item-detail">
                (Deployed: {formatCurrency(portfolioSummary.deployedCapital)})
              </span>
            </span>
          </div>
          <div className="activity-item">
            <span className="item-label">Rejected Orders</span>
            <span className={`item-value ${portfolioSummary.rejectedBuys > 0 ? 'highlight-warning' : ''}`}>
              {portfolioSummary.rejectedBuys || 0}
            </span>
          </div>
          <div className="activity-item">
            <span className="item-label">Deferred Sells</span>
            <span className="item-value">{deferredSellsCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioComparisonSummary;
