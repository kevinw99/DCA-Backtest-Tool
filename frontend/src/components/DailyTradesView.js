import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import './DailyTradesView.css';

/**
 * DailyTradesView - Displays portfolio trades aggregated by date
 *
 * Shows all trades across all stocks organized chronologically by trading date.
 * Includes cash position tracking and expandable transaction details.
 *
 * @param {Object} props
 * @param {Array} props.stockResults - Array of stock results with transactions
 * @param {Object} props.portfolioSummary - Portfolio summary with total capital
 * @param {String} props.portfolioRunId - Portfolio run ID for linking
 * @param {Object} props.parameters - Portfolio parameters
 */
const DailyTradesView = ({ stockResults, portfolioSummary, portfolioRunId, parameters }) => {
  const [expandedDate, setExpandedDate] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [filterType, setFilterType] = useState('all'); // 'all', 'buys', 'sells'

  /**
   * Aggregate all transactions by date and calculate daily metrics
   */
  const dailyTrades = useMemo(() => {
    if (!stockResults || !portfolioSummary) {
      return [];
    }

    // Step 1: Flatten all transactions from all stocks
    const allTransactions = [];
    stockResults.forEach(stock => {
      if (stock.transactions && Array.isArray(stock.transactions)) {
        stock.transactions
          .filter(tx => !tx.type.includes('ABORTED')) // Exclude aborted transactions
          .forEach(tx => {
            allTransactions.push({
              ...tx,
              symbol: stock.symbol
            });
          });
      }
    });

    // Step 2: Group transactions by date
    const transactionsByDate = new Map();
    allTransactions.forEach(tx => {
      if (!transactionsByDate.has(tx.date)) {
        transactionsByDate.set(tx.date, []);
      }
      transactionsByDate.get(tx.date).push(tx);
    });

    // Step 3: Calculate daily metrics for each date
    const dailyTradesArray = Array.from(transactionsByDate.entries()).map(([date, transactions]) => {
      // Filter transactions based on filterType
      let filteredTransactions = transactions;
      if (filterType === 'buys') {
        filteredTransactions = transactions.filter(tx => tx.type.includes('BUY'));
      } else if (filterType === 'sells') {
        filteredTransactions = transactions.filter(tx => tx.type.includes('SELL'));
      }

      const buys = filteredTransactions.filter(tx => tx.type.includes('BUY'));
      const sells = filteredTransactions.filter(tx => tx.type.includes('SELL'));

      const totalBuyAmount = buys.reduce((sum, tx) => sum + (tx.value || 0), 0);
      const totalSellAmount = sells.reduce((sum, tx) => sum + (tx.value || 0), 0);
      const netCashFlow = totalSellAmount - totalBuyAmount;
      const dailyRealizedPNL = sells.reduce((sum, tx) => sum + (tx.realizedPNLFromTrade || 0), 0);

      return {
        date,
        transactions: filteredTransactions,
        allTransactions: transactions, // Keep all for cash calculation
        tradeCount: filteredTransactions.length,
        buyCount: buys.length,
        sellCount: sells.length,
        totalBuyAmount,
        totalSellAmount,
        netCashFlow,
        dailyRealizedPNL
      };
    });

    // Step 4: Sort by date
    dailyTradesArray.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.date.localeCompare(b.date);
      } else {
        return b.date.localeCompare(a.date);
      }
    });

    // Step 5: Calculate running cash balance
    // Need to process in chronological order for cash calculation
    const chronologicalTrades = [...dailyTradesArray].sort((a, b) => a.date.localeCompare(b.date));
    let runningCash = portfolioSummary.totalCapital;

    chronologicalTrades.forEach(day => {
      day.cashBefore = runningCash;
      // Use allTransactions for cash calculation to maintain accuracy
      const actualBuys = day.allTransactions.filter(tx => tx.type.includes('BUY'));
      const actualSells = day.allTransactions.filter(tx => tx.type.includes('SELL'));
      const actualBuyAmount = actualBuys.reduce((sum, tx) => sum + (tx.value || 0), 0);
      const actualSellAmount = actualSells.reduce((sum, tx) => sum + (tx.value || 0), 0);
      const actualNetCashFlow = actualSellAmount - actualBuyAmount;

      day.cashAfter = runningCash + actualNetCashFlow;
      day.cashChange = actualNetCashFlow;
      runningCash = day.cashAfter;
    });

    // Filter out dates with no trades (after applying filterType)
    return dailyTradesArray.filter(day => day.tradeCount > 0);
  }, [stockResults, portfolioSummary, sortOrder, filterType]);

  const handleToggleExpand = (date) => {
    setExpandedDate(expandedDate === date ? null : date);
  };

  const handleToggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const formatCurrency = (value) => {
    if (value == null || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!stockResults || !portfolioSummary) {
    return (
      <div className="daily-trades-view empty">
        <p>No data available</p>
      </div>
    );
  }

  if (dailyTrades.length === 0) {
    return (
      <div className="daily-trades-view empty">
        <div className="empty-state">
          <p>No trades executed during the backtest period</p>
          {filterType !== 'all' && (
            <p className="filter-hint">Try changing the filter to see more trades</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="daily-trades-view">
      <div className="daily-trades-controls">
        <button
          onClick={handleToggleSortOrder}
          className="sort-toggle-btn"
        >
          Sort: {sortOrder === 'asc' ? '↑ Oldest First' : '↓ Newest First'}
        </button>

        <div className="filter-type-toggle">
          <label htmlFor="filter-type-select">Show:</label>
          <select
            id="filter-type-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Trades</option>
            <option value="buys">Buys Only</option>
            <option value="sells">Sells Only</option>
          </select>
        </div>

        <div className="trades-count-info">
          {dailyTrades.length} trading day{dailyTrades.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="daily-trades-table-wrapper">
        <table className="daily-trades-table">
          <thead>
            <tr>
              <th className="expand-col"></th>
              <th className="date-col">Date</th>
              <th className="trades-col">Trades</th>
              <th className="buys-col">Buys</th>
              <th className="sells-col">Sells</th>
              <th className="net-flow-col">Net Cash Flow</th>
              <th className="pnl-col">Daily P&amp;L</th>
              <th className="cash-before-col">Cash Before</th>
              <th className="cash-after-col">Cash After</th>
            </tr>
          </thead>
          <tbody>
            {dailyTrades.map(day => (
              <DailyTradeRow
                key={day.date}
                day={day}
                isExpanded={expandedDate === day.date}
                onToggle={handleToggleExpand}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * DailyTradeRow - Individual row for a trading day
 */
const DailyTradeRow = ({ day, isExpanded, onToggle, formatCurrency, formatDate }) => {
  return (
    <>
      <tr
        className={`daily-trade-row ${isExpanded ? 'expanded' : ''}`}
        onClick={() => onToggle(day.date)}
      >
        <td className="expand-icon">
          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </td>
        <td className="date-cell">{formatDate(day.date)}</td>
        <td className="trades-count">{day.tradeCount}</td>
        <td className="buys-count">{day.buyCount}</td>
        <td className="sells-count">{day.sellCount}</td>
        <td className={`net-flow ${day.netCashFlow >= 0 ? 'positive' : 'negative'}`}>
          {formatCurrency(day.netCashFlow)}
        </td>
        <td className={`daily-pnl ${day.dailyRealizedPNL >= 0 ? 'positive' : 'negative'}`}>
          {formatCurrency(day.dailyRealizedPNL)}
        </td>
        <td className="cash-before">{formatCurrency(day.cashBefore)}</td>
        <td className="cash-after">{formatCurrency(day.cashAfter)}</td>
      </tr>

      {isExpanded && (
        <tr className="daily-trade-detail-row">
          <td colSpan="9">
            <DailyTradeDetailView
              day={day}
              formatCurrency={formatCurrency}
            />
          </td>
        </tr>
      )}
    </>
  );
};

/**
 * DailyTradeDetailView - Expanded view showing all transactions for a day
 */
const DailyTradeDetailView = ({ day, formatCurrency }) => {
  // Sort transactions by symbol for better readability
  const sortedTransactions = [...day.transactions].sort((a, b) =>
    a.symbol.localeCompare(b.symbol)
  );

  return (
    <div className="daily-trade-details">
      <h4>Transactions on {day.date} ({day.tradeCount} trade{day.tradeCount !== 1 ? 's' : ''})</h4>

      <div className="transaction-detail-table-wrapper">
        <table className="transaction-detail-table">
          <thead>
            <tr>
              <th>Stock</th>
              <th>Type</th>
              <th>Price</th>
              <th>Quantity</th>
              <th>Value</th>
              <th>P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {sortedTransactions.map((tx, idx) => (
              <tr key={idx}>
                <td className="stock-symbol">{tx.symbol}</td>
                <td className={`transaction-type ${tx.type.includes('BUY') ? 'buy-type' : 'sell-type'}`}>
                  {tx.type}
                </td>
                <td className="price">${tx.price?.toFixed(2) || 'N/A'}</td>
                <td className="quantity">{(tx.shares || tx.quantity)?.toFixed(2) || 'N/A'}</td>
                <td className="value">{formatCurrency(tx.value || 0)}</td>
                <td className={`pnl ${(tx.realizedPNLFromTrade || 0) >= 0 ? 'positive' : 'negative'}`}>
                  {tx.type.includes('SELL') && tx.realizedPNLFromTrade !== undefined
                    ? formatCurrency(tx.realizedPNLFromTrade)
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="daily-summary">
        <div className="summary-item">
          <span className="label">Total Buy Amount:</span>
          <span className="value negative">{formatCurrency(day.totalBuyAmount)}</span>
        </div>
        <div className="summary-item">
          <span className="label">Total Sell Amount:</span>
          <span className="value positive">{formatCurrency(day.totalSellAmount)}</span>
        </div>
        <div className="summary-item">
          <span className="label">Net Cash Flow:</span>
          <span className={`value ${day.netCashFlow >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(day.netCashFlow)}
          </span>
        </div>
        <div className="summary-item">
          <span className="label">Daily Realized P&amp;L:</span>
          <span className={`value ${day.dailyRealizedPNL >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(day.dailyRealizedPNL)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DailyTradesView;
