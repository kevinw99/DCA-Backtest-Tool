import React from 'react';

const PortfolioBuyAndHoldComparison = ({ comparison, buyAndHoldSummary }) => {
  if (!comparison || !buyAndHoldSummary) return null;

  const formatCurrency = (value) => {
    if (value == null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value) => {
    if (value == null) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  const formatNumber = (value, decimals = 2) => {
    if (value == null) return 'N/A';
    return value.toFixed(decimals);
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
        <div className="badge-label">
          {comparison.outperformanceAmount >= 0 ? 'DCA Outperformance' : 'DCA Underperformance'}
        </div>
        <div className="badge-value">
          {comparison.outperformanceAmount >= 0 ? '+' : ''}
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
            <td><strong>Total Return</strong></td>
            <td>{formatCurrency(comparison.comparison.totalReturn.dca)}</td>
            <td>{formatCurrency(comparison.comparison.totalReturn.buyAndHold)}</td>
            <td className={comparison.comparison.totalReturn.difference >= 0 ? 'positive' : 'negative'}>
              {comparison.comparison.totalReturn.difference >= 0 ? '+' : ''}
              {formatCurrency(comparison.comparison.totalReturn.difference)}
            </td>
            <td className={getAdvantageClass(comparison.comparison.totalReturn.advantage)}>
              {comparison.comparison.totalReturn.advantage === 'DCA' ? 'DCA' : 'B&H'}
            </td>
          </tr>

          <tr>
            <td><strong>CAGR</strong></td>
            <td>{formatPercent(comparison.comparison.cagr.dca)}</td>
            <td>{formatPercent(comparison.comparison.cagr.buyAndHold)}</td>
            <td className={comparison.comparison.cagr.difference >= 0 ? 'positive' : 'negative'}>
              {comparison.comparison.cagr.difference >= 0 ? '+' : ''}
              {formatPercent(comparison.comparison.cagr.difference)} pts
            </td>
            <td className={getAdvantageClass(comparison.comparison.cagr.advantage)}>
              {comparison.comparison.cagr.advantage === 'DCA' ? 'DCA' : 'B&H'}
            </td>
          </tr>

          <tr>
            <td><strong>Max Drawdown</strong></td>
            <td>{formatPercent(comparison.comparison.maxDrawdown.dca)}</td>
            <td>{formatPercent(comparison.comparison.maxDrawdown.buyAndHold)}</td>
            <td className={comparison.comparison.maxDrawdown.difference >= 0 ? 'positive' : 'negative'}>
              {comparison.comparison.maxDrawdown.difference >= 0 ? '+' : ''}
              {formatPercent(comparison.comparison.maxDrawdown.difference)} pts
            </td>
            <td className={getAdvantageClass(comparison.comparison.maxDrawdown.advantage)}>
              {comparison.comparison.maxDrawdown.advantage === 'DCA' ? 'DCA' : 'B&H'}
            </td>
          </tr>

          <tr>
            <td><strong>Sharpe Ratio</strong></td>
            <td>{formatNumber(comparison.comparison.sharpeRatio.dca)}</td>
            <td>{formatNumber(comparison.comparison.sharpeRatio.buyAndHold)}</td>
            <td className={comparison.comparison.sharpeRatio.difference >= 0 ? 'positive' : 'negative'}>
              {comparison.comparison.sharpeRatio.difference >= 0 ? '+' : ''}
              {formatNumber(comparison.comparison.sharpeRatio.difference)}
            </td>
            <td className={getAdvantageClass(comparison.comparison.sharpeRatio.advantage)}>
              {comparison.comparison.sharpeRatio.advantage === 'DCA' ? 'DCA' : 'B&H'}
            </td>
          </tr>

          <tr>
            <td><strong>Volatility</strong></td>
            <td>{formatPercent(comparison.comparison.volatility.dca)}</td>
            <td>{formatPercent(comparison.comparison.volatility.buyAndHold)}</td>
            <td className={comparison.comparison.volatility.difference <= 0 ? 'positive' : 'negative'}>
              {comparison.comparison.volatility.difference >= 0 ? '+' : ''}
              {formatPercent(comparison.comparison.volatility.difference)} pts
            </td>
            <td className={getAdvantageClass(comparison.comparison.volatility.advantage)}>
              {comparison.comparison.volatility.advantage === 'DCA' ? 'DCA' : 'B&H'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default PortfolioBuyAndHoldComparison;
