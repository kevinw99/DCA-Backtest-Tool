/**
 * StockBetaTable - Display beta values for multiple stocks in portfolio
 *
 * Shows per-stock beta values with:
 * - Symbol
 * - Beta value
 * - Source badge (File/Cache/Live/Default)
 * - Effective beta (beta × coefficient)
 * - Last updated timestamp
 * - Refresh button (per stock and bulk)
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';
import BetaSourceBadge from './BetaSourceBadge';

export const StockBetaTable = ({
  stocks = [],
  betaData = {},
  coefficient = 1.0,
  loading = false,
  onRefresh,
  onRefreshAll
}) => {
  if (!stocks || stocks.length === 0) {
    return null;
  }

  /**
   * Format timestamp to relative time
   */
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'User defined';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="stock-beta-table">
      <div className="table-header">
        <h4>Stock-Specific Beta Values ({stocks.length} stock{stocks.length !== 1 ? 's' : ''})</h4>
        <button
          onClick={onRefreshAll}
          disabled={loading}
          className="btn-refresh-all"
          title="Refresh all stocks from provider"
        >
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          Refresh All
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Beta</th>
            <th>Source</th>
            <th>Effective</th>
            <th>Last Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((symbol) => {
            const data = betaData[symbol] || {
              beta: 1.0,
              source: 'default',
              updatedAt: null,
              isStale: false
            };

            const effective = (data.beta * coefficient).toFixed(2);
            const canRefresh = data.source !== 'file';

            return (
              <tr key={symbol}>
                <td className="symbol">{symbol}</td>
                <td className="beta">{data.beta.toFixed(3)}</td>
                <td>
                  <BetaSourceBadge source={data.source} isStale={data.isStale} />
                </td>
                <td className="effective">{effective}</td>
                <td className="timestamp">
                  {formatTimestamp(data.updatedAt)}
                </td>
                <td className="actions">
                  {canRefresh ? (
                    <button
                      onClick={() => onRefresh(symbol)}
                      disabled={loading}
                      className="btn-refresh-stock"
                      title="Refresh from provider"
                    >
                      <RefreshCw size={14} className={loading ? 'spinning' : ''} />
                    </button>
                  ) : (
                    <span className="no-refresh" title="File-based beta cannot be refreshed">
                      -
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {loading && (
        <div className="loading-overlay">
          <RefreshCw size={24} className="spinning" />
          <span>Fetching beta values...</span>
        </div>
      )}
    </div>
  );
};

export default StockBetaTable;
