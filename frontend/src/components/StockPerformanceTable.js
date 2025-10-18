import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, ExternalLink } from 'lucide-react';
import './StockPerformanceTable.css';

const StockPerformanceTable = ({ stocks, portfolioRunId, parameters, buyAndHoldSummary }) => {
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

  // Merge Buy & Hold data with stock results
  const stocksWithBH = useMemo(() => {
    if (!stocks) return [];

    // If no B&H data available, return stocks as-is
    if (!buyAndHoldSummary || !buyAndHoldSummary.stockPositions) {
      return stocks;
    }

    // Merge B&H data into each stock
    return stocks.map(stock => {
      const bhStock = buyAndHoldSummary.stockPositions.find(bh => bh && bh.symbol === stock.symbol);

      if (!bhStock) {
        return {
          ...stock,
          bhTotalPNL: null,
          bhReturnPercent: null,
          diffPNL: null,
          diffReturnPercent: null
        };
      }

      // Calculate differences
      const diffPNL = stock.totalPNL - bhStock.totalReturn;
      const diffReturnPercent = stock.stockReturnPercent - bhStock.totalReturnPercent;

      return {
        ...stock,
        bhTotalPNL: bhStock.totalReturn,
        bhReturnPercent: bhStock.totalReturnPercent,
        diffPNL,
        diffReturnPercent
      };
    });
  }, [stocks, buyAndHoldSummary]);

  const sortedStocks = useMemo(() => {
    if (!stocksWithBH) return [];

    return [...stocksWithBH].sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }, [stocksWithBH, sortField, sortDirection]);

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

    // Add portfolio-level boolean flags from defaultParams
    if (parameters.defaultParams) {
      // Add trailing buy/sell flags - default to false if not explicitly set
      params.append('enableTrailingBuy', parameters.defaultParams.enableTrailingBuy || false);
      params.append('enableTrailingSell', parameters.defaultParams.enableTrailingSell || false);

      if (parameters.defaultParams.enableConsecutiveIncrementalBuyGrid !== undefined) {
        params.append('enableConsecutiveIncrementalBuyGrid', parameters.defaultParams.enableConsecutiveIncrementalBuyGrid);
      }
      if (parameters.defaultParams.enableConsecutiveIncrementalSellProfit !== undefined) {
        params.append('enableConsecutiveIncrementalSellProfit', parameters.defaultParams.enableConsecutiveIncrementalSellProfit);
      }
    }

    // Add beta scaling parameters if enabled
    if (parameters._betaScaling?.enabled) {
      params.append('enableBetaScaling', 'true');
      if (parameters._betaScaling.coefficient !== undefined) {
        params.append('coefficient', parameters._betaScaling.coefficient);
      }
      // Beta value is fetched per stock, so don't append it here
    }

    // Add stock-specific parameters (if any)
    if (stock.params) {
      // List of parameters that are stored as decimals in backend but need to be whole numbers in URL
      const percentageParams = [
        'gridIntervalPercent', 'profitRequirement',
        'trailingBuyActivationPercent', 'trailingBuyReboundPercent',
        'trailingSellActivationPercent', 'trailingSellPullbackPercent',
        'gridConsecutiveIncrement'
      ];

      Object.entries(stock.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Convert decimal percentage values to whole numbers for URL
          // Backend stores 0.1 (10%), URL expects 10 (which URLParameterManager converts back to 0.1)
          if (percentageParams.includes(key)) {
            params.append(key, value * 100);
          } else {
            params.append(key, value);
          }
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
            <th style={{ width: '100px' }}>Details</th>
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
              DCA Return % <SortIcon field="stockReturnPercent" />
            </th>
            <th onClick={() => handleSort('bhTotalPNL')} className="sortable bh-column">
              B&H P&L <SortIcon field="bhTotalPNL" />
            </th>
            <th onClick={() => handleSort('bhReturnPercent')} className="sortable bh-column">
              B&H Return % <SortIcon field="bhReturnPercent" />
            </th>
            <th onClick={() => handleSort('diffPNL')} className="sortable diff-column">
              Δ P&L <SortIcon field="diffPNL" />
            </th>
            <th onClick={() => handleSort('diffReturnPercent')} className="sortable diff-column">
              Δ Return % <SortIcon field="diffReturnPercent" />
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
                <td>{stock.lotsHeld}</td>
                <td>{formatCurrency(stock.capitalDeployed)}</td>
                <td>{formatCurrency(stock.marketValue)}</td>
                <td className={stock.totalPNL >= 0 ? 'positive' : 'negative'}>
                  {formatCurrency(stock.totalPNL)}
                </td>
                <td className={stock.stockReturnPercent >= 0 ? 'positive' : 'negative'}>
                  {safeToFixed(stock.stockReturnPercent, 2)}%
                </td>
                <td className={`bh-column ${stock.bhTotalPNL !== null && stock.bhTotalPNL >= 0 ? 'positive' : stock.bhTotalPNL !== null ? 'negative' : ''}`}>
                  {stock.bhTotalPNL !== null ? formatCurrency(stock.bhTotalPNL) : '-'}
                </td>
                <td className={`bh-column ${stock.bhReturnPercent !== null && stock.bhReturnPercent >= 0 ? 'positive' : stock.bhReturnPercent !== null ? 'negative' : ''}`}>
                  {stock.bhReturnPercent !== null ? `${safeToFixed(stock.bhReturnPercent, 2)}%` : '-'}
                </td>
                <td className={`diff-column ${stock.diffPNL !== null && stock.diffPNL >= 0 ? 'positive' : stock.diffPNL !== null ? 'negative' : ''}`}>
                  {stock.diffPNL !== null ? formatCurrency(stock.diffPNL) : '-'}
                </td>
                <td className={`diff-column ${stock.diffReturnPercent !== null && stock.diffReturnPercent >= 0 ? 'positive' : stock.diffReturnPercent !== null ? 'negative' : ''}`}>
                  {stock.diffReturnPercent !== null ? `${safeToFixed(stock.diffReturnPercent, 2)}%` : '-'}
                </td>
                <td>{safeToFixed(stock.cagr, 2)}%</td>
                <td>{safeToFixed(stock.contributionToPortfolioReturn, 2)}%</td>
                <td>{stock.totalBuys}</td>
                <td>{stock.totalSells}</td>
                <td className={stock.rejectedBuys > 0 ? 'highlight' : ''}>
                  {stock.rejectedBuys}
                </td>
              </tr>

              {expandedStock === stock.symbol && (
                <tr className="stock-detail-row">
                  <td colSpan="17">
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

/**
 * Extract current holdings (lots held) from stock data
 * Reconstructs which lots are currently held based on transaction history
 */
const extractCurrentHoldings = (stock) => {
  if (!stock.transactions || stock.transactions.length === 0) {
    return [];
  }

  // Get the most recent transaction to find current price
  const latestTransaction = stock.transactions[stock.transactions.length - 1];
  const currentPrice = latestTransaction?.price || 0;

  // Find all BUY transactions to reconstruct lots
  const buyTransactions = stock.transactions.filter(tx => tx.type.includes('BUY'));
  const sellTransactions = stock.transactions.filter(tx => tx.type.includes('SELL'));

  const lots = [];

  // For each BUY, check if it's still held (not fully sold)
  buyTransactions.forEach(buyTx => {
    let remainingShares = buyTx.shares || buyTx.quantity || 0;

    // Check if this lot was sold
    sellTransactions.forEach(sellTx => {
      if (sellTx.lotsDetails) {
        sellTx.lotsDetails.forEach(soldLot => {
          if (soldLot.date === buyTx.date && Math.abs(soldLot.price - buyTx.price) < 0.01) {
            remainingShares -= (soldLot.shares || soldLot.quantity || 0);
          }
        });
      }
    });

    if (remainingShares > 0.01) {  // Still holding this lot
      const currentValue = remainingShares * currentPrice;
      const costBasis = remainingShares * buyTx.price;

      lots.push({
        purchaseDate: buyTx.date,
        purchasePrice: buyTx.price,
        shares: remainingShares,
        currentPrice,
        currentValue,
        unrealizedPNL: currentValue - costBasis
      });
    }
  });

  return lots;
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

  // Filter out aborted transactions (they don't represent actual trades)
  const allTransactions = stock.transactions || [];
  const actualTransactions = allTransactions.filter(tx => !tx.type.includes('ABORTED'));

  // Extract current holdings if stock is held
  const currentHoldings = stock.lotsHeld > 0 ? extractCurrentHoldings(stock) : null;

  // Debug logging
  console.log(`🔍 ${stock.symbol} Transaction Filtering:`);
  console.log(`  Total transactions: ${allTransactions.length}`);
  console.log(`  Actual transactions (filtered): ${actualTransactions.length}`);
  console.log(`  Aborted count: ${allTransactions.length - actualTransactions.length}`);

  // Log first few transactions to see their types
  allTransactions.slice(0, 5).forEach((tx, idx) => {
    console.log(`  [${idx}] ${tx.date} - ${tx.type} (filtered out: ${tx.type.includes('ABORTED')})`);
  });

  // Log aborted transactions specifically
  const abortedTransactions = allTransactions.filter(tx => tx.type.includes('ABORTED'));
  if (abortedTransactions.length > 0) {
    console.log(`  📛 Aborted transactions (${abortedTransactions.length}):`);
    abortedTransactions.forEach(tx => {
      console.log(`    - ${tx.date}: ${tx.type}`);
    });
  }

  return (
    <div className="stock-detail">
      <h4>{stock.symbol} - Performance & Holdings</h4>

      {/* NEW: Current Holdings Section */}
      {currentHoldings && currentHoldings.length > 0 && (
        <div className="current-holdings-section">
          <h5>Current Holdings ({stock.lotsHeld} lots held)</h5>
          <div className="holdings-summary">
            <span>Total Market Value: {formatCurrency(stock.marketValue)}</span>
            <span>Total Unrealized P&L: {formatCurrency(stock.unrealizedPNL)}</span>
          </div>

          <table className="holdings-table">
            <thead>
              <tr>
                <th>Purchase Date</th>
                <th>Purchase Price</th>
                <th>Shares</th>
                <th>Current Price</th>
                <th>Current Value</th>
                <th>Unrealized P&L</th>
              </tr>
            </thead>
            <tbody>
              {currentHoldings.map((lot, idx) => (
                <tr key={idx}>
                  <td>{lot.purchaseDate}</td>
                  <td>${lot.purchasePrice.toFixed(2)}</td>
                  <td>{lot.shares.toFixed(2)}</td>
                  <td>${lot.currentPrice.toFixed(2)}</td>
                  <td>{formatCurrency(lot.currentValue)}</td>
                  <td className={lot.unrealizedPNL >= 0 ? 'positive' : 'negative'}>
                    {formatCurrency(lot.unrealizedPNL)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transaction History Section */}
      <div className="transaction-history-section">
        <h5>Transaction History ({actualTransactions.length} transactions)</h5>

        {actualTransactions.length > 0 ? (
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
                {actualTransactions.map((tx, idx) => (
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
    </div>
  );
};

export default StockPerformanceTable;
