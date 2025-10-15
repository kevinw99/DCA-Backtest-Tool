import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceDot,
  Scatter,
  ComposedChart
} from 'recharts';
import './MultiStockPriceChart.css';

// Same color palette as PortfolioCompositionChart
const STOCK_COLORS = [
  '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6610f2',
  '#fd7e14', '#20c997', '#e83e8c', '#6c757d', '#343a40', '#f8f9fa',
  '#495057', '#00d4ff', '#ff6b6b',
];

const MultiStockPriceChart = ({ stockResults }) => {
  // Extract stock symbols
  const stockSymbols = useMemo(() => {
    return stockResults ? stockResults.map(s => s.symbol) : [];
  }, [stockResults]);

  // Initialize all stocks as visible
  const [visibleStocks, setVisibleStocks] = useState(() => {
    const initial = {};
    stockSymbols.forEach(symbol => {
      initial[symbol] = true;
    });
    return initial;
  });

  const [showTransactions, setShowTransactions] = useState({
    buy: true,
    sell: true,
    rejected: true
  });

  const toggleStock = (symbol) => {
    setVisibleStocks(prev => ({ ...prev, [symbol]: !prev[symbol] }));
  };

  const toggleTransaction = (type) => {
    setShowTransactions(prev => ({ ...prev, [type]: !prev[type] }));
  };

  // Normalize price data to % change from start
  const normalizedData = useMemo(() => {
    if (!stockResults || stockResults.length === 0) return [];

    // Collect all unique dates across all stocks
    const allDates = new Set();
    stockResults.forEach(stock => {
      if (stock.priceData) {
        stock.priceData.forEach(d => allDates.add(d.date));
      }
    });

    const sortedDates = Array.from(allDates).sort();

    // Build normalized data structure
    return sortedDates.map(date => {
      const dataPoint = { date };

      stockResults.forEach(stock => {
        const priceEntry = stock.priceData?.find(p => p.date === date);
        if (priceEntry && stock.priceData.length > 0) {
          const startPrice = stock.priceData[0].close;
          const percentChange = ((priceEntry.close - startPrice) / startPrice) * 100;
          dataPoint[stock.symbol] = percentChange;
        } else {
          dataPoint[stock.symbol] = null;
        }
      });

      return dataPoint;
    });
  }, [stockResults]);

  // Collect all transactions and map to chart data points
  const transactions = useMemo(() => {
    if (!stockResults) return [];

    const allTransactions = [];

    stockResults.forEach((stock, index) => {
      const color = STOCK_COLORS[index % STOCK_COLORS.length];

      // Buy transactions
      if (stock.transactions) {
        stock.transactions.forEach(tx => {
          if (tx.type.includes('BUY') && tx.date) {
            const dataPoint = normalizedData.find(d => d.date === tx.date);
            if (dataPoint && dataPoint[stock.symbol] !== null) {
              allTransactions.push({
                date: tx.date,
                symbol: stock.symbol,
                type: 'BUY',
                percentChange: dataPoint[stock.symbol],
                price: tx.price,
                shares: tx.shares,
                color
              });
            }
          } else if (tx.type.includes('SELL') && tx.date) {
            const dataPoint = normalizedData.find(d => d.date === tx.date);
            if (dataPoint && dataPoint[stock.symbol] !== null) {
              allTransactions.push({
                date: tx.date,
                symbol: stock.symbol,
                type: 'SELL',
                percentChange: dataPoint[stock.symbol],
                price: tx.price,
                shares: tx.shares,
                color
              });
            }
          }
        });
      }

      // Rejected orders
      if (stock.rejectedOrders) {
        stock.rejectedOrders.forEach(order => {
          const dataPoint = normalizedData.find(d => d.date === order.date);
          if (dataPoint && dataPoint[stock.symbol] !== null) {
            allTransactions.push({
              date: order.date,
              symbol: stock.symbol,
              type: 'REJECTED',
              percentChange: dataPoint[stock.symbol],
              price: order.price,
              reason: order.reason,
              color
            });
          }
        });
      }
    });

    return allTransactions;
  }, [stockResults, normalizedData]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    // Find transactions on this date
    const txOnDate = transactions.filter(tx => tx.date === label);

    return (
      <div className="custom-tooltip multi-stock-tooltip">
        <p className="tooltip-label">{label}</p>
        <div className="tooltip-prices">
          {payload
            .filter(entry => entry.value !== null)
            .map((entry, index) => (
              <p key={index} style={{ color: entry.stroke }}>
                <strong>{entry.name}:</strong> {entry.value >= 0 ? '+' : ''}{entry.value.toFixed(2)}%
              </p>
            ))}
        </div>
        {txOnDate.length > 0 && (
          <div className="tooltip-transactions">
            <p className="tx-header">Transactions:</p>
            {txOnDate.map((tx, index) => (
              <p key={index} className={`tx-${tx.type.toLowerCase()}`}>
                <strong>{tx.symbol}</strong> - {tx.type}
                {tx.type !== 'REJECTED' && ` ${tx.shares} @ $${tx.price.toFixed(2)}`}
                {tx.type === 'REJECTED' && ` (${tx.reason})`}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTransactionMarkers = () => {
    return transactions.map((tx, index) => {
      if (!visibleStocks[tx.symbol]) return null;

      let fill, stroke, shape;
      if (tx.type === 'BUY' && showTransactions.buy) {
        fill = tx.color;
        stroke = '#fff';
        shape = 'circle';
      } else if (tx.type === 'SELL' && showTransactions.sell) {
        fill = '#fff';
        stroke = tx.color;
        shape = 'circle';
      } else if (tx.type === 'REJECTED' && showTransactions.rejected) {
        fill = '#ffc107';
        stroke = '#ff9800';
        shape = 'cross';
      } else {
        return null;
      }

      return (
        <ReferenceDot
          key={`${tx.symbol}-${tx.date}-${index}`}
          x={tx.date}
          y={tx.percentChange}
          r={5}
          fill={fill}
          stroke={stroke}
          strokeWidth={2}
          shape={shape}
        />
      );
    });
  };

  if (!stockResults || stockResults.length === 0) {
    return <div className="multi-stock-price-chart empty">No stock price data available</div>;
  }

  return (
    <div className="multi-stock-price-chart">
      <h3>Multi-Stock Price Comparison (Normalized)</h3>
      <p className="chart-description">
        All stock prices normalized to % change from their starting price
      </p>

      <div className="chart-controls">
        <div className="stock-legend">
          <h4>Stocks:</h4>
          {stockSymbols.map((symbol, index) => (
            <label key={symbol} className={!visibleStocks[symbol] ? 'disabled' : ''}>
              <input
                type="checkbox"
                checked={visibleStocks[symbol]}
                onChange={() => toggleStock(symbol)}
              />
              <span
                className="legend-color"
                style={{ backgroundColor: STOCK_COLORS[index % STOCK_COLORS.length] }}
              ></span>
              {symbol}
            </label>
          ))}
        </div>

        <div className="transaction-legend">
          <h4>Transactions:</h4>
          <label className={!showTransactions.buy ? 'disabled' : ''}>
            <input
              type="checkbox"
              checked={showTransactions.buy}
              onChange={() => toggleTransaction('buy')}
            />
            <span className="tx-marker buy"></span>
            Buy Orders
          </label>
          <label className={!showTransactions.sell ? 'disabled' : ''}>
            <input
              type="checkbox"
              checked={showTransactions.sell}
              onChange={() => toggleTransaction('sell')}
            />
            <span className="tx-marker sell"></span>
            Sell Orders
          </label>
          <label className={!showTransactions.rejected ? 'disabled' : ''}>
            <input
              type="checkbox"
              checked={showTransactions.rejected}
              onChange={() => toggleTransaction('rejected')}
            />
            <span className="tx-marker rejected"></span>
            Rejected (Insufficient Capital)
          </label>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={500}>
        <ComposedChart
          data={normalizedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="date"
            stroke="#666"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis
            stroke="#666"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value.toFixed(0)}%`}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Price lines for each stock */}
          {stockSymbols.map((symbol, index) => (
            visibleStocks[symbol] && (
              <Line
                key={symbol}
                type="monotone"
                dataKey={symbol}
                stroke={STOCK_COLORS[index % STOCK_COLORS.length]}
                strokeWidth={2}
                name={symbol}
                dot={false}
                connectNulls={true}
              />
            )
          ))}

          {/* Transaction markers */}
          {renderTransactionMarkers()}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MultiStockPriceChart;
