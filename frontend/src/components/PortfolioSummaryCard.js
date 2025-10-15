import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, Target, BarChart3, AlertTriangle, Activity } from 'lucide-react';
import './PortfolioSummaryCard.css';

const PortfolioSummaryCard = ({ summary }) => {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value) => {
    if (value == null || isNaN(value)) return 'N/A';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const safeToFixed = (value, decimals = 2) => {
    if (value == null || isNaN(value)) return 'N/A';
    return value.toFixed(decimals);
  };

  return (
    <div className="portfolio-summary-card">
      <div className="summary-header">
        <h2>Portfolio Summary</h2>
        <div className={`summary-badge ${summary.totalReturnPercent >= 0 ? 'positive' : 'negative'}`}>
          {summary.totalReturnPercent >= 0 ? '▲' : '▼'}
          {safeToFixed(Math.abs(summary.totalReturnPercent), 2)}%
        </div>
      </div>

      <div className="summary-grid">
        <MetricBox
          label="Total Capital"
          value={formatCurrency(summary.totalCapital)}
          icon={<DollarSign size={24} />}
        />

        <MetricBox
          label="Final Portfolio Value"
          value={formatCurrency(summary.finalPortfolioValue)}
          icon={<BarChart3 size={24} />}
        />

        <MetricBox
          label="Total Return"
          value={formatCurrency(summary.totalReturn)}
          change={summary.totalReturnPercent}
          icon={<TrendingUp size={24} />}
        />

        <MetricBox
          label="CAGR"
          value={`${safeToFixed(summary.cagr, 2)}%`}
          icon={<Activity size={24} />}
          subValue="Compound Annual Growth"
        />

        <MetricBox
          label="Max Drawdown"
          value={formatCurrency(summary.maxDrawdown)}
          subValue={`${safeToFixed(summary.maxDrawdownPercent, 2)}%`}
          icon={<TrendingDown size={24} />}
        />

        <MetricBox
          label="Sharpe Ratio"
          value={safeToFixed(summary.sharpeRatio, 2)}
          icon={<Target size={24} />}
          subValue="Risk-adjusted return"
        />

        <MetricBox
          label="Total Trades"
          value={summary.totalBuys + summary.totalSells}
          subValue={`${summary.totalBuys} buys, ${summary.totalSells} sells`}
          icon={<Activity size={24} />}
        />

        <MetricBox
          label="Win Rate"
          value={`${safeToFixed(summary.winRate, 1)}%`}
          icon={<Target size={24} />}
        />

        <MetricBox
          label="Capital Utilization"
          value={`${safeToFixed(summary.capitalUtilizationPercent, 1)}%`}
          subValue={`Deployed: ${formatCurrency(summary.deployedCapital)}`}
          icon={<BarChart3 size={24} />}
        />

        <MetricBox
          label="Rejected Buys"
          value={summary.rejectedBuys}
          subValue={formatCurrency(summary.rejectedBuysValue || 0)}
          highlight={summary.rejectedBuys > 0}
          icon={<AlertTriangle size={24} />}
        />
      </div>
    </div>
  );
};

const MetricBox = ({ label, value, subValue, change, icon, highlight }) => (
  <div className={`metric-box ${highlight ? 'highlight' : ''}`}>
    <div className="metric-icon">{icon}</div>
    <div className="metric-content">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {subValue && <div className="metric-subvalue">{subValue}</div>}
      {change !== undefined && (
        <div className={`metric-change ${change >= 0 ? 'positive' : 'negative'}`}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
        </div>
      )}
    </div>
  </div>
);

export default PortfolioSummaryCard;
