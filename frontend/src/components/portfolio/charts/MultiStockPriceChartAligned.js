/**
 * Multi-Stock Price Chart (Aligned Version)
 *
 * Displays normalized price comparison across all stocks with transaction markers
 * with synchronized x-axis for alignment with other charts.
 */

import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceDot
} from 'recharts';
import {
  SYNC_ID,
  getChartMargin,
  getXAxisConfig,
  Y_AXIS_CONFIG,
  GRID_CONFIG,
  TOOLTIP_CONFIG,
  formatDate,
  STOCK_COLORS,
  CHART_HEIGHTS
} from '../../charts/SharedChartConfig';

const MultiStockPriceChartAligned = ({ data, stockResults, isLastChart, sharedDomain, sharedTicks }) => {
  // Extract stock symbols
  const stockSymbols = useMemo(() => {
    if (!stockResults) return [];
    return stockResults
      .filter(stock => !stock.skipped)
      .map(stock => stock.symbol);
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

  // Extract transactions from data
  const transactions = useMemo(() => {
    if (!data) return [];

    const allTransactions = [];
    data.forEach(dataPoint => {
      if (dataPoint.transactions) {
        dataPoint.transactions.forEach(tx => {
          const percentChange = dataPoint[tx.symbol];
          if (percentChange !== null && percentChange !== undefined) {
            allTransactions.push({
              date: dataPoint.date,
              symbol: tx.symbol,
              type: tx.type,
              percentChange,
              price: tx.price,
              shares: tx.shares,
              reason: tx.reason
            });
          }
        });
      }
    });
    return allTransactions;
  }, [data]);

  // Get stock color by symbol
  const getStockColorBySymbol = (symbol) => {
    const index = stockSymbols.indexOf(symbol);
    return STOCK_COLORS[index % STOCK_COLORS.length];
  };

  if (!data || data.length === 0) {
    return <div className="chart-empty">No price data available</div>;
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    // Find transactions on this date
    const txOnDate = transactions.filter(tx => tx.date === label);

    return (
      <div style={TOOLTIP_CONFIG.contentStyle}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '13px' }}>
          {formatDate(label)}
        </p>
        <div style={{ marginBottom: txOnDate.length > 0 ? '8px' : '0' }}>
          {payload
            .filter(entry => entry.value !== null && entry.value !== undefined)
            .map((entry, index) => (
              <p key={index} style={{ color: entry.stroke, margin: '4px 0' }}>
                <strong>{entry.name}:</strong> {entry.value >= 0 ? '+' : ''}{entry.value.toFixed(2)}%
              </p>
            ))}
        </div>
        {txOnDate.length > 0 && (
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
            <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', fontSize: '12px' }}>
              Transactions:
            </p>
            {txOnDate.map((tx, index) => {
              let color = '#333';
              if (tx.type.includes('BUY')) color = '#28a745';
              else if (tx.type.includes('SELL')) color = '#007bff';
              else if (tx.type === 'REJECTED') color = '#ffc107';

              return (
                <p key={index} style={{ color, margin: '4px 0', fontSize: '12px' }}>
                  <strong>{tx.symbol}</strong> - {tx.type}
                  {tx.type !== 'REJECTED' && tx.shares && ` ${tx.shares} @ $${tx.price?.toFixed(2)}`}
                  {tx.type === 'REJECTED' && tx.reason && ` (${tx.reason})`}
                </p>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderTransactionMarkers = () => {
    return transactions.map((tx, index) => {
      if (!visibleStocks[tx.symbol]) return null;

      const color = getStockColorBySymbol(tx.symbol);
      let fill, stroke;

      if (tx.type.includes('BUY') && showTransactions.buy) {
        fill = color;
        stroke = '#fff';
      } else if (tx.type.includes('SELL') && showTransactions.sell) {
        fill = '#fff';
        stroke = color;
      } else if (tx.type === 'REJECTED' && showTransactions.rejected) {
        fill = '#ffc107';
        stroke = '#ff9800';
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
        />
      );
    });
  };

  return (
    <div className="multi-stock-price-chart-aligned">
      {/* Legend controls */}
      <div className="chart-legend">
        <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#4a5568', margin: '0 12px 0 0' }}>
          Stocks:
        </h4>
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

      {/* Transaction legend */}
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

      <ResponsiveContainer width="100%" height={CHART_HEIGHTS.tall}>
        <ComposedChart
          data={data}
          syncId={SYNC_ID}
          margin={getChartMargin(isLastChart)}
        >
          <CartesianGrid {...GRID_CONFIG} />
          <XAxis {...getXAxisConfig(isLastChart, sharedDomain, sharedTicks)} />
          <YAxis
            {...Y_AXIS_CONFIG}
            tickFormatter={(value) => `${value.toFixed(0)}%`}
            label={{
              value: '% Change from Start',
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle' }
            }}
          />
          <Tooltip content={<CustomTooltip />} {...TOOLTIP_CONFIG} />

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

MultiStockPriceChartAligned.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  stockResults: PropTypes.array,
  isLastChart: PropTypes.bool.isRequired
};

export default MultiStockPriceChartAligned;
