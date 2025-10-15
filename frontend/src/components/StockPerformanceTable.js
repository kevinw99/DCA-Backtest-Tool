import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, ExternalLink } from 'lucide-react';
import './StockPerformanceTable.css';

const StockPerformanceTable = ({ stocks, portfolioRunId, parameters }) => {
  const [expandedStock, setExpandedStock] = useState(null);
  const [sortField, setSortField] = useState('totalPNL');
  const [sortDirection, setSortDirection] = useState('desc');

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const safeToFixed = (value, decimals = 2) => {
    if (value == null || isNaN(value)) return 'N/A';
    return value.toFixed(decimals);
  };

  const sortedStocks = useMemo(() => {
    if (!stocks) return [];

    return [...stocks].sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }, [stocks, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleToggleExpand = (symbol, event) => {
    // Don't toggle if clicking on the link
    if (event.target.closest('.stock-link-btn')) {
      return;
    }
    setExpandedStock(expandedStock === symbol ? null : symbol);
  };

  const buildStockResultsUrl = (stock) => {
    if (!portfolioRunId || !parameters) return null;

    // Build query parameters from portfolio parameters
    const params = new URLSearchParams();
    params.append('portfolioRunId', portfolioRunId);

    // Add all portfolio parameters
    if (parameters.startDate) params.append('startDate', parameters.startDate);
    if (parameters.endDate) params.append('endDate', parameters.endDate);
    if (parameters.lotSizeUsd) params.append('lotSizeUsd', parameters.lotSizeUsd);
    if (parameters.maxLotsPerStock) params.append('maxLots', parameters.maxLotsPerStock);

    // Add stock-specific parameters (if any)
    if (stock.params) {
      Object.entries(stock.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value);
        }
      });
    }

    return `/backtest/long/${stock.symbol}/results?${params.toString()}`;
  };

  const handleStockLinkClick = (url, event) => {
    event.stopPropagation();
    window.open(url, '_blank');
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="sort-icon">⇅</span>;
    return sortDirection === 'asc' ? <span className="sort-icon">▲</span> : <span className="sort-icon">▼</span>;
  };

  return (
    <div className="stock-performance-table">
      <table>
        <thead>
          <tr>
            <th style={{ width: '40px' }}></th>
            <th onClick={() => handleSort('symbol')} className="sortable">
              Symbol <SortIcon field="symbol" />
            </th>
            <th onClick={() => handleSort('lotsHeld')} className="sortable">
              Lots <SortIcon field="lotsHeld" />
            </th>
            <th onClick={() => handleSort('capitalDeployed')} className="sortable">
              Capital Deployed <SortIcon field="capitalDeployed" />
            </th>
            <th onClick={() => handleSort('marketValue')} className="sortable">
              Market Value <SortIcon field="marketValue" />
            </th>
            <th onClick={() => handleSort('totalPNL')} className="sortable">
              Total P&L <SortIcon field="totalPNL" />
            </th>
            <th onClick={() => handleSort('stockReturnPercent')} className="sortable">
              Return % <SortIcon field="stockReturnPercent" />
            </th>
            <th onClick={() => handleSort('cagr')} className="sortable">
              CAGR <SortIcon field="cagr" />
            </th>
            <th onClick={() => handleSort('contributionToPortfolioReturn')} className="sortable">
              Contribution <SortIcon field="contributionToPortfolioReturn" />
            </th>
            <th onClick={() => handleSort('totalBuys')} className="sortable">
              Buys <SortIcon field="totalBuys" />
            </th>
            <th onClick={() => handleSort('totalSells')} className="sortable">
              Sells <SortIcon field="totalSells" />
            </th>
            <th onClick={() => handleSort('rejectedBuys')} className="sortable">
              Rejected <SortIcon field="rejectedBuys" />
            </th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {sortedStocks.map(stock => (
            <React.Fragment key={stock.symbol}>
              <tr
                className={`stock-row ${expandedStock === stock.symbol ? 'expanded' : ''}`}
                onClick={(e) => handleToggleExpand(stock.symbol, e)}
              >
                <td className="expand-icon">
                  {expandedStock === stock.symbol ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </td>
                <td className="stock-symbol">{stock.symbol}</td>
                <td>{stock.lotsHeld}</td>
                <td>{formatCurrency(stock.capitalDeployed)}</td>
                <td>{formatCurrency(stock.marketValue)}</td>
                <td className={stock.totalPNL >= 0 ? 'positive' : 'negative'}>
                  {formatCurrency(stock.totalPNL)}
                </td>
                <td className={stock.stockReturnPercent >= 0 ? 'positive' : 'negative'}>
                  {safeToFixed(stock.stockReturnPercent, 2)}%
                </td>
                <td>{safeToFixed(stock.cagr, 2)}%</td>
                <td>{safeToFixed(stock.contributionToPortfolioReturn, 2)}%</td>
                <td>{stock.totalBuys}</td>
                <td>{stock.totalSells}</td>
                <td className={stock.rejectedBuys > 0 ? 'highlight' : ''}>
                  {stock.rejectedBuys}
                </td>
                <td>
                  {buildStockResultsUrl(stock) && (
                    <button
                      className="stock-link-btn"
                      onClick={(e) => handleStockLinkClick(buildStockResultsUrl(stock), e)}
                      title={`View detailed results for ${stock.symbol} (includes insufficient capital events)`}
                    >
                      <ExternalLink size={16} />
                      View
                    </button>
                  )}
                </td>
              </tr>

              {expandedStock === stock.symbol && (
                <tr className="stock-detail-row">
                  <td colSpan="13">
                    <StockDetailView stock={stock} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {sortedStocks.length === 0 && (
        <div className="empty-table">
          <p>No stock data available</p>
        </div>
      )}
    </div>
  );
};

const StockDetailView = ({ stock }) => {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="stock-detail">
      <h4>{stock.symbol} - Transaction History ({stock.transactions?.length || 0} transactions)</h4>

      {stock.transactions && stock.transactions.length > 0 ? (
        <div className="transaction-table-wrapper">
          <table className="transaction-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Price</th>
                <th>Quantity</th>
                <th>Amount</th>
                <th>P&L</th>
                <th>Lots After</th>
              </tr>
            </thead>
            <tbody>
              {stock.transactions.map((tx, idx) => (
                <tr key={idx}>
                  <td>{tx.date}</td>
                  <td className={tx.type.includes('BUY') ? 'buy-type' : 'sell-type'}>
                    {tx.type}
                  </td>
                  <td>${tx.price?.toFixed(2) || 'N/A'}</td>
                  <td>{(tx.quantity || tx.shares)?.toFixed(2) || 'N/A'}</td>
                  <td>{formatCurrency(tx.amount || tx.value || 0)}</td>
                  <td className={(tx.pnl || tx.realizedPNLFromTrade || 0) >= 0 ? 'positive' : 'negative'}>
                    {(tx.pnl !== undefined || tx.realizedPNLFromTrade !== undefined) ? formatCurrency(tx.pnl || tx.realizedPNLFromTrade || 0) : '-'}
                  </td>
                  <td>{tx.lotsAfterTransaction?.length || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="no-transactions">No transactions recorded for this stock</p>
      )}
    </div>
  );
};

export default StockPerformanceTable;
