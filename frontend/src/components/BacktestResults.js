import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Clock } from 'lucide-react';

const BacktestResults = ({ data }) => {
  if (!data) {
    return <div>No backtest results available</div>;
  }

  const { summary, transactions, dailyValues, lots } = data;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getMetricClass = (value) => {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return '';
  };

  return (
    <div className="results-container">
      <h2 className="results-title">
        <BarChart3 size={24} />
        Backtest Results for {summary.symbol}
      </h2>

      <div className="results-period">
        <Clock size={16} />
        <span>{summary.startDate} to {summary.endDate}</span>
      </div>

      {/* Key Metrics Grid */}
      <div className="results-grid">
        <div className="metric-card">
          <h4>Total Return</h4>
          <p className={`value ${getMetricClass(summary.totalReturn)}`}>
            {formatCurrency(summary.totalReturn)}
          </p>
          <small className={getMetricClass(summary.totalReturnPercent)}>
            {formatPercent(summary.totalReturnPercent)}
          </small>
        </div>

        <div className="metric-card">
          <h4>Final Portfolio Value</h4>
          <p className="value">
            {formatCurrency(summary.finalValue)}
          </p>
        </div>

        <div className="metric-card">
          <h4>Total Investment</h4>
          <p className="value">
            {formatCurrency(summary.totalCost)}
          </p>
        </div>

        <div className="metric-card">
          <h4>Lots Held</h4>
          <p className="value">
            {summary.lotsHeld}
          </p>
        </div>

        <div className="metric-card">
          <h4>Total Trades</h4>
          <p className="value">
            {summary.totalTrades}
          </p>
        </div>

        <div className="metric-card">
          <h4>Win Rate</h4>
          <p className="value">
            {summary.winRate ? formatPercent(summary.winRate) : 'N/A'}
          </p>
        </div>
      </div>

      {/* Portfolio Performance Chart */}
      <div className="performance-section">
        <h3>Portfolio Value Over Time</h3>
        <div className="performance-chart">
          {/* Simple line chart representation */}
          <div className="chart-placeholder">
            <p>Portfolio performance visualization would go here</p>
            <p>Final Value: {formatCurrency(summary.finalValue)}</p>
            <p>Peak Value: {formatCurrency(Math.max(...dailyValues.map(d => d.portfolioValue)))}</p>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="transactions-section">
        <h3>
          <Target size={20} />
          Transaction History
        </h3>

        {transactions.length > 0 ? (
          <div className="transactions-table">
            <div className="table-header">
              <div>Date</div>
              <div>Type</div>
              <div>Price</div>
              <div>Shares</div>
              <div>Value</div>
            </div>

            {transactions.map((transaction, index) => (
              <div key={index} className={`table-row ${transaction.type.toLowerCase()}`}>
                <div>{new Date(transaction.date).toLocaleDateString()}</div>
                <div className={`transaction-type ${transaction.type.toLowerCase()}`}>
                  {transaction.type === 'BUY' ? (
                    <><TrendingUp size={16} /> BUY</>
                  ) : (
                    <><TrendingDown size={16} /> SELL</>
                  )}
                </div>
                <div>{formatCurrency(transaction.price)}</div>
                <div>{transaction.shares.toFixed(4)}</div>
                <div>{formatCurrency(transaction.value)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-transactions">
            <p>No transactions were executed during this backtest period.</p>
          </div>
        )}
      </div>

      {/* Current Holdings */}
      {lots.length > 0 && (
        <div className="holdings-section">
          <h3>
            <DollarSign size={20} />
            Current Holdings
          </h3>

          <div className="holdings-table">
            <div className="table-header">
              <div>Purchase Date</div>
              <div>Purchase Price</div>
              <div>Shares</div>
              <div>Current Value</div>
              <div>P&L</div>
            </div>

            {lots.map((lot, index) => {
              const currentPrice = dailyValues[dailyValues.length - 1]?.price || 0;
              const currentValue = lot.shares * currentPrice;
              const purchaseValue = lot.shares * lot.price;
              const pnl = currentValue - purchaseValue;

              return (
                <div key={index} className="table-row">
                  <div>{new Date(lot.date).toLocaleDateString()}</div>
                  <div>{formatCurrency(lot.price)}</div>
                  <div>{lot.shares.toFixed(4)}</div>
                  <div>{formatCurrency(currentValue)}</div>
                  <div className={getMetricClass(pnl)}>
                    {formatCurrency(pnl)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Strategy Summary */}
      <div className="strategy-summary">
        <h3>Strategy Summary</h3>
        <div className="summary-content">
          <p>
            <strong>Investment Approach:</strong> Dollar Cost Averaging with technical analysis filters
          </p>
          <p>
            <strong>Risk Management:</strong> Grid-based position sizing with stop-loss protection
          </p>
          <p>
            <strong>Market Conditions:</strong> Adaptive entry based on volatility, RSI, and moving averages
          </p>
          <p>
            <strong>Capital Efficiency:</strong> {summary.totalCost > 0 ? ((summary.totalCost / (summary.lotsHeld * 10000)) * 100).toFixed(1) : 0}% of maximum capital deployed
          </p>
        </div>
      </div>
    </div>
  );
};

export default BacktestResults;
