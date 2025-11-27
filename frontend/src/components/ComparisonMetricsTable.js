import React from 'react';
import './ComparisonMetricsTable.css';

const ComparisonMetricsTable = ({ dcaMetrics, buyAndHoldMetrics }) => {
  // Spec 60: Use backend-calculated CAGR values for consistency
  // Backend now uses unified metricsCalculator for accurate calendar-year CAGR

  // DCA CAGR from backend (cagrOnMaxDeployed - as decimal e.g., 0.5899)
  const dcaCAGR = dcaMetrics?.performanceMetrics?.cagrOnMaxDeployed ?? null;

  // Buy & Hold CAGR from backend (annualizedReturn - as decimal e.g., 0.6651)
  const bnhCAGR = buyAndHoldMetrics?.annualizedReturn ?? null;

  // Helper function to determine metric comparison class
  const getMetricClass = (dcaValue, buyHoldValue, higherIsBetter = true) => {
    if (dcaValue === null || dcaValue === undefined || buyHoldValue === null || buyHoldValue === undefined) {
      return 'metric-similar';
    }

    const diff = Math.abs(dcaValue - buyHoldValue);
    const threshold = Math.abs(buyHoldValue) * 0.1; // 10% difference

    if (diff < threshold) {
      return 'metric-similar';
    }

    const dcaBetter = higherIsBetter
      ? dcaValue > buyHoldValue
      : dcaValue < buyHoldValue;

    // Use two-tier coloring: best for DCA, worse for Buy & Hold
    if (dcaBetter) {
      return 'dca-better';
    } else {
      return 'bnh-better';
    }
  };

  // Helper function to format values
  const formatValue = (value, type = 'number') => {
    if (value === null || value === undefined) {
      return 'N/A';
    }

    switch (type) {
      case 'percent':
        return `${(value * 100).toFixed(2)}%`;
      case 'currency':
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'ratio':
        return value.toFixed(3);
      case 'number':
      default:
        return value.toFixed(2);
    }
  };

  // Helper function to format infinite profit factor
  const formatProfitFactor = (value) => {
    if (value === null || value === undefined) {
      return 'Infinite (no losses)';
    }
    return value.toFixed(3);
  };

  // Metrics organized by category
  const metricsCategories = [
    {
      title: 'Returns',
      metrics: [
        {
          label: 'Total Return',
          dcaValue: dcaMetrics?.totalReturn,
          bnhValue: buyAndHoldMetrics?.totalReturn,
          type: 'currency',
          higherIsBetter: true
        },
        {
          label: `Total Return % (Max Capital: $${dcaMetrics?.performanceMetrics?.maxDeployedCapital?.toLocaleString('en-US', { maximumFractionDigits: 0 }) || 'N/A'})`,
          // Use returnOnMaxDeployedPercent to match the summary card display
          dcaValue: dcaMetrics?.performanceMetrics?.returnOnMaxDeployedPercent ? dcaMetrics.performanceMetrics.returnOnMaxDeployedPercent / 100 : null,
          bnhValue: buyAndHoldMetrics?.totalReturnPercent ? buyAndHoldMetrics.totalReturnPercent / 100 : null,
          type: 'percent',
          higherIsBetter: true
        },
        {
          label: `Total Return % (Weighted Capital: $${dcaMetrics?.performanceMetrics?.avgDeployedCapital?.toLocaleString('en-US', { maximumFractionDigits: 0 }) || 'N/A'})`,
          dcaValue: dcaMetrics?.performanceMetrics?.returnOnAvgDeployedPercent ? dcaMetrics.performanceMetrics.returnOnAvgDeployedPercent / 100 : null,
          bnhValue: null, // B&H doesn't have variable capital deployment
          type: 'percent',
          higherIsBetter: true,
          naForBnh: true
        },
        {
          label: 'CAGR',
          // Use calculated CAGR to match the summary card display
          dcaValue: dcaCAGR,
          bnhValue: bnhCAGR,
          type: 'percent',
          higherIsBetter: true
        }
      ]
    },
    {
      title: 'Risk-Adjusted Returns',
      metrics: [
        {
          label: 'Sharpe Ratio',
          dcaValue: dcaMetrics?.performanceMetrics?.sharpeRatio,
          bnhValue: buyAndHoldMetrics?.sharpeRatio,
          type: 'ratio',
          higherIsBetter: true
        },
        {
          label: 'Sortino Ratio',
          dcaValue: dcaMetrics?.performanceMetrics?.sortinoRatio,
          bnhValue: buyAndHoldMetrics?.sortinoRatio,
          type: 'ratio',
          higherIsBetter: true
        },
        {
          label: 'Calmar Ratio',
          dcaValue: dcaMetrics?.performanceMetrics?.calmarRatio,
          bnhValue: buyAndHoldMetrics?.calmarRatio,
          type: 'ratio',
          higherIsBetter: true
        },
        {
          label: 'Max Drawdown',
          // Spec 60: DCA maxDrawdownPercent is decimal (0.353), B&H is percentage (36.88)
          // DCA from performanceMetrics is already decimal, use directly
          // B&H from buyAndHoldMetrics is percentage, divide by 100
          dcaValue: dcaMetrics?.performanceMetrics?.maxDrawdownPercent ?? null,
          bnhValue: buyAndHoldMetrics?.maxDrawdownPercent ? buyAndHoldMetrics.maxDrawdownPercent / 100 : null,
          type: 'percent',
          higherIsBetter: false
        },
        {
          label: 'Avg Drawdown',
          // Spec 60: DCA avgDrawdownPercent is decimal, B&H is percentage
          dcaValue: dcaMetrics?.performanceMetrics?.avgDrawdownPercent ?? null,
          bnhValue: buyAndHoldMetrics?.avgDrawdownPercent ? buyAndHoldMetrics.avgDrawdownPercent / 100 : null,
          type: 'percent',
          higherIsBetter: false
        }
      ]
    }
  ];

  return (
    <div className="comparison-metrics-section">
      <h3>Performance Metrics Comparison</h3>
      <div className="comparison-table-container">
        <table className="comparison-table">
          <thead>
            <tr>
              <th className="metric-label-header">Metric</th>
              <th className="metric-value-header">DCA Strategy</th>
              <th className="metric-value-header">Buy & Hold</th>
            </tr>
          </thead>
          <tbody>
            {metricsCategories.map((category, catIndex) => (
              <React.Fragment key={catIndex}>
                <tr className="category-header">
                  <td colSpan="3">{category.title}</td>
                </tr>
                {category.metrics.map((metric, metricIndex) => {
                  const dcaClass = metric.naForBnh
                    ? ''
                    : getMetricClass(metric.dcaValue, metric.bnhValue, metric.higherIsBetter);
                  const bnhClass = metric.naForBnh
                    ? 'metric-na'
                    : dcaClass === 'dca-better'
                    ? 'bnh-worse'
                    : dcaClass === 'bnh-better'
                    ? 'dca-worse'
                    : '';

                  return (
                    <tr key={metricIndex} className="metric-row">
                      <td className="metric-label">{metric.label}</td>
                      <td className={`metric-value ${dcaClass === 'dca-better' ? 'metric-best' : dcaClass === 'bnh-better' ? 'metric-worse' : ''}`}>
                        {metric.type === 'profitFactor'
                          ? formatProfitFactor(metric.dcaValue)
                          : formatValue(metric.dcaValue, metric.type)}
                      </td>
                      <td className={`metric-value ${metric.naForBnh ? 'metric-na' : bnhClass === 'bnh-worse' ? 'metric-worse' : bnhClass === 'dca-worse' ? 'metric-best' : ''}`}>
                        {metric.naForBnh ? 'N/A' : formatValue(metric.bnhValue, metric.type)}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ComparisonMetricsTable;
