import React from 'react';
import './PerformanceSummary.css';

const PerformanceSummary = ({ performanceMetrics }) => {
  if (!performanceMetrics) {
    return null;
  }

  const formatPercent = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  const formatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return value.toFixed(decimals);
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDays = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return `${Math.round(value)} days`;
  };

  // Color coding functions
  const getSharpeColor = (value) => {
    if (value > 2) return 'excellent';
    if (value > 1) return 'good';
    if (value > 0) return 'neutral';
    return 'poor';
  };

  const getDrawdownColor = (value) => {
    const percent = Math.abs(value);
    if (percent < 10) return 'excellent';
    if (percent < 20) return 'good';
    if (percent < 30) return 'neutral';
    return 'poor';
  };

  const getWinRateColor = (value) => {
    if (value > 70) return 'excellent';
    if (value > 60) return 'good';
    if (value > 50) return 'neutral';
    return 'poor';
  };

  const getReturnColor = (value) => {
    if (value > 20) return 'excellent';
    if (value > 10) return 'good';
    if (value > 0) return 'neutral';
    return 'poor';
  };

  return (
    <div className="performance-summary">
      <h3 className="performance-title">📊 Performance Metrics</h3>

      <div className="metrics-grid">
        {/* Returns Section */}
        <div className="metric-section">
          <h4 className="section-title">Returns</h4>
          <div className="metric-row">
            <span className="metric-label">Total Return</span>
            <span className={`metric-value ${getReturnColor(performanceMetrics.totalReturnPercent)}`}>
              {formatPercent(performanceMetrics.totalReturnPercent)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">CAGR</span>
            <span className={`metric-value ${getReturnColor(performanceMetrics.cagrPercent)}`}>
              {formatPercent(performanceMetrics.cagrPercent)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Return on Max Deployed</span>
            <span className={`metric-value ${getReturnColor(performanceMetrics.returnOnMaxDeployedPercent)}`}>
              {formatPercent(performanceMetrics.returnOnMaxDeployedPercent)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Return on Avg Deployed</span>
            <span className={`metric-value ${getReturnColor(performanceMetrics.returnOnAvgDeployedPercent)}`}>
              {formatPercent(performanceMetrics.returnOnAvgDeployedPercent)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Time-Weighted Return</span>
            <span className={`metric-value ${getReturnColor(performanceMetrics.timeWeightedReturnPercent)}`}>
              {formatPercent(performanceMetrics.timeWeightedReturnPercent)}
            </span>
          </div>
        </div>

        {/* Risk Metrics Section */}
        <div className="metric-section">
          <h4 className="section-title">Risk-Adjusted</h4>
          <div className="metric-row">
            <span className="metric-label">Sharpe Ratio</span>
            <span className={`metric-value ${getSharpeColor(performanceMetrics.sharpeRatio)}`}>
              {formatNumber(performanceMetrics.sharpeRatio, 3)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Sortino Ratio</span>
            <span className={`metric-value ${getSharpeColor(performanceMetrics.sortinoRatio)}`}>
              {formatNumber(performanceMetrics.sortinoRatio, 3)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Calmar Ratio</span>
            <span className={`metric-value ${getSharpeColor(performanceMetrics.calmarRatio)}`}>
              {formatNumber(performanceMetrics.calmarRatio, 3)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Max Drawdown</span>
            <span className={`metric-value ${getDrawdownColor(performanceMetrics.maxDrawdownPercent)}`}>
              {formatPercent(performanceMetrics.maxDrawdownPercent)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Avg Drawdown</span>
            <span className="metric-value neutral">
              {formatPercent(performanceMetrics.avgDrawdownPercent)}
            </span>
          </div>
        </div>

        {/* Trading Efficiency Section */}
        <div className="metric-section">
          <h4 className="section-title">Trading Efficiency</h4>
          <div className="metric-row">
            <span className="metric-label">Win Rate</span>
            <span className={`metric-value ${getWinRateColor(performanceMetrics.winRatePercent)}`}>
              {formatPercent(performanceMetrics.winRatePercent)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Profit Factor</span>
            <span className={`metric-value ${performanceMetrics.profitFactor > 1.5 ? 'good' : 'neutral'}`}>
              {formatNumber(performanceMetrics.profitFactor, 2)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Expectancy</span>
            <span className={`metric-value ${performanceMetrics.expectancy > 0 ? 'good' : 'poor'}`}>
              {formatCurrency(performanceMetrics.expectancy)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Avg Win</span>
            <span className="metric-value neutral">
              {formatCurrency(performanceMetrics.avgWin)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Avg Loss</span>
            <span className="metric-value neutral">
              {formatCurrency(performanceMetrics.avgLoss)}
            </span>
          </div>
        </div>

        {/* Capital Efficiency Section */}
        <div className="metric-section">
          <h4 className="section-title">Capital Efficiency</h4>
          <div className="metric-row">
            <span className="metric-label">Capital Utilization</span>
            <span className="metric-value neutral">
              {formatPercent(performanceMetrics.capitalUtilizationPercent)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Max Deployed Capital</span>
            <span className="metric-value neutral">
              {formatCurrency(performanceMetrics.maxDeployedCapital)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Avg Deployed Capital</span>
            <span className="metric-value neutral">
              {formatCurrency(performanceMetrics.avgDeployedCapital)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Avg Holding Period</span>
            <span className="metric-value neutral">
              {formatDays(performanceMetrics.avgHoldingPeriod)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Profit per Day Held</span>
            <span className={`metric-value ${performanceMetrics.profitPerDayHeld > 0 ? 'good' : 'poor'}`}>
              {formatCurrency(performanceMetrics.profitPerDayHeld)}
            </span>
          </div>
        </div>

        {/* Opportunity Cost Section */}
        <div className="metric-section">
          <h4 className="section-title">Opportunity Analysis</h4>
          <div className="metric-row">
            <span className="metric-label">Opportunity Cost</span>
            <span className="metric-value neutral">
              {formatCurrency(performanceMetrics.opportunityCost)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Avg Idle Capital</span>
            <span className="metric-value neutral">
              {formatCurrency(performanceMetrics.avgIdleCapital)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Opportunity-Adjusted Return</span>
            <span className={`metric-value ${getReturnColor(performanceMetrics.opportunityCostAdjustedReturnPercent)}`}>
              {formatPercent(performanceMetrics.opportunityCostAdjustedReturnPercent)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Max Drawdown Duration</span>
            <span className="metric-value neutral">
              {formatDays(performanceMetrics.maxDrawdownDuration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceSummary;
