import React, { useState, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import './RejectedOrdersTable.css';

const RejectedOrdersTable = ({ orders }) => {
  const [filter, setFilter] = useState('all');

  const symbols = useMemo(() => {
    if (!orders || orders.length === 0) return ['all'];
    return ['all', ...new Set(orders.map(o => o.symbol))];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return filter === 'all'
      ? orders
      : orders.filter(o => o.symbol === filter);
  }, [orders, filter]);

  const totalRejectedValue = filteredOrders.reduce((sum, o) => sum + (o.lotSize || 0), 0);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  if (!orders || orders.length === 0) {
    return (
      <div className="rejected-orders-table empty">
        <div className="empty-state">
          <div className="success-icon">✓</div>
          <h3>No Rejected Orders</h3>
          <p>All buy signals were executed successfully!</p>
          <p className="help-text">This means the portfolio had sufficient capital for all trading opportunities.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rejected-orders-table">
      <div className="rejected-orders-header">
        <div className="summary">
          <AlertTriangle size={24} color="#ffc107" />
          <div>
            <span className="count">{filteredOrders.length} rejected order{filteredOrders.length !== 1 ? 's' : ''}</span>
            <span className="value">Total value: {formatCurrency(totalRejectedValue)}</span>
          </div>
        </div>

        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {symbols.map(symbol => (
            <option key={symbol} value={symbol}>
              {symbol === 'all' ? 'All Stocks' : symbol}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Symbol</th>
              <th>Price</th>
              <th>Lot Size</th>
              <th>Available Capital</th>
              <th>Shortfall</th>
              <th>Utilization</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order, idx) => (
              <tr key={idx}>
                <td>{order.date}</td>
                <td className="stock-symbol">{order.symbol}</td>
                <td>${order.price.toFixed(2)}</td>
                <td>{formatCurrency(order.lotSize)}</td>
                <td>{formatCurrency(order.availableCapital)}</td>
                <td className="shortfall">{formatCurrency(order.shortfall)}</td>
                <td>{order.portfolioState?.utilizationPercent?.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredOrders.length === 0 && filter !== 'all' && (
        <div className="no-results">
          <p>No rejected orders for {filter}</p>
        </div>
      )}
    </div>
  );
};

export default RejectedOrdersTable;
