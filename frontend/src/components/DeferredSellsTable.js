import React, { useState, useMemo } from 'react';
import { Clock } from 'lucide-react';
import './DeferredSellsTable.css';

const DeferredSellsTable = ({ orders }) => {
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

  const totalDeferredValue = filteredOrders.reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
  const totalDeferredProfit = filteredOrders.reduce((sum, o) => sum + (o.estimatedProfit || 0), 0);

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
      <div className="deferred-sells-table empty">
        <div className="empty-state">
          <div className="success-icon">✓</div>
          <h3>No Deferred Sells</h3>
          <p>All sell signals were executed as triggered!</p>
          <p className="help-text">Deferred selling postpones sells when cash reserve exceeds the threshold to keep capital deployed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="deferred-sells-table">
      <div className="deferred-sells-header">
        <div className="summary">
          <Clock size={24} color="#17a2b8" />
          <div>
            <span className="count">{filteredOrders.length} deferred sell{filteredOrders.length !== 1 ? 's' : ''}</span>
            <span className="value">Est. value: {formatCurrency(totalDeferredValue)} | Est. profit: {formatCurrency(totalDeferredProfit)}</span>
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
              <th>Stop Price</th>
              <th>Lots to Sell</th>
              <th>Est. Value</th>
              <th>Est. Profit</th>
              <th>Cash Reserve</th>
              <th>Threshold</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order, idx) => (
              <tr key={idx}>
                <td>{order.date}</td>
                <td className="stock-symbol">{order.symbol}</td>
                <td>${order.price.toFixed(2)}</td>
                <td>${order.stopPrice?.toFixed(2) || 'N/A'}</td>
                <td>{order.lotsToSell}</td>
                <td>{formatCurrency(order.estimatedValue)}</td>
                <td className={order.estimatedProfit >= 0 ? 'profit' : 'loss'}>
                  {formatCurrency(order.estimatedProfit)}
                </td>
                <td>{formatCurrency(order.cashReserve)}</td>
                <td>{formatCurrency(order.cashThreshold)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredOrders.length === 0 && filter !== 'all' && (
        <div className="no-results">
          <p>No deferred sells for {filter}</p>
        </div>
      )}
    </div>
  );
};

export default DeferredSellsTable;
