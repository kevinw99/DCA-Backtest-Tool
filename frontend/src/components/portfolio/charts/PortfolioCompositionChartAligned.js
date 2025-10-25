/**
 * Portfolio Composition Chart (Aligned Version)
 *
 * Displays stacked area chart showing market value composition of portfolio
 * with synchronized x-axis for alignment with other charts.
 */

import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import {
  SYNC_ID,
  getChartMargin,
  getXAxisConfig,
  Y_AXIS_CONFIG,
  GRID_CONFIG,
  TOOLTIP_CONFIG,
  formatCurrency,
  formatDate,
  STOCK_COLORS,
  CHART_HEIGHTS
} from '../../charts/SharedChartConfig';

const CASH_COLOR = '#95d5b2'; // Light green for cash

const PortfolioCompositionChartAligned = ({ data, isLastChart, sharedDomain }) => {
  // Extract stock symbols from the data (exclude date, cash, total)
  const stockSymbols = useMemo(() => {
    if (!data || data.length === 0) return [];

    const firstEntry = data[0];
    return Object.keys(firstEntry).filter(
      key => key !== 'date' && key !== 'cash' && key !== 'total'
    );
  }, [data]);

  // Initialize all stocks and cash as visible
  const [visibleSeries, setVisibleSeries] = useState({ cash: true });

  // Update visible series when stock symbols change
  useEffect(() => {
    setVisibleSeries(prev => {
      const updated = { ...prev, cash: true };
      stockSymbols.forEach(symbol => {
        if (!(symbol in prev)) {
          updated[symbol] = true;
        } else {
          updated[symbol] = prev[symbol];
        }
      });
      return updated;
    });
  }, [stockSymbols]);

  const toggleSeries = (key) => {
    setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!data || data.length === 0) {
    return <div className="chart-empty">No composition data available</div>;
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    // Find the total value for this data point
    const dataPoint = data.find(d => d.date === label);
    const totalValue = dataPoint ? dataPoint.total : 0;

    return (
      <div style={TOOLTIP_CONFIG.contentStyle}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '13px' }}>
          {formatDate(label)}
        </p>
        <p style={{ margin: '4px 0 8px 0', fontWeight: 'bold' }}>
          Total Portfolio: {formatCurrency(totalValue)}
        </p>
        <div>
          {payload
            .filter(entry => entry.value > 0)
            .sort((a, b) => b.value - a.value)
            .map((entry, index) => {
              const percentage = totalValue > 0 ? (entry.value / totalValue * 100).toFixed(1) : 0;
              return (
                <p key={index} style={{ color: entry.fill || entry.color, margin: '4px 0' }}>
                  <strong>{entry.name}:</strong>{' '}
                  {formatCurrency(entry.value)} ({percentage}%)
                </p>
              );
            })}
        </div>
      </div>
    );
  };

  return (
    <div className="portfolio-composition-chart-aligned">
      {/* Legend controls */}
      <div className="chart-legend">
        {stockSymbols.map((symbol, index) => (
          <label key={symbol} className={!visibleSeries[symbol] ? 'disabled' : ''}>
            <input
              type="checkbox"
              checked={visibleSeries[symbol]}
              onChange={() => toggleSeries(symbol)}
            />
            <span
              className="legend-color"
              style={{ backgroundColor: STOCK_COLORS[index % STOCK_COLORS.length] }}
            ></span>
            {symbol}
          </label>
        ))}
        <label className={!visibleSeries.cash ? 'disabled' : ''}>
          <input
            type="checkbox"
            checked={visibleSeries.cash}
            onChange={() => toggleSeries('cash')}
          />
          <span className="legend-color" style={{ backgroundColor: CASH_COLOR }}></span>
          Cash Reserve
        </label>
      </div>

      <ResponsiveContainer width="100%" height={CHART_HEIGHTS.tall}>
        <AreaChart
          data={data}
          syncId={SYNC_ID}
          margin={getChartMargin(isLastChart)}
          stackOffset="none"
        >
          <CartesianGrid {...GRID_CONFIG} />
          <XAxis {...getXAxisConfig(isLastChart, sharedDomain)} />
          <YAxis {...Y_AXIS_CONFIG} tickFormatter={formatCurrency} domain={[0, 'auto']} />
          <Tooltip content={<CustomTooltip />} {...TOOLTIP_CONFIG} />

          {/* Stacked areas for each stock */}
          {stockSymbols.map((symbol, index) => (
            visibleSeries[symbol] && (
              <Area
                key={symbol}
                type="monotone"
                dataKey={symbol}
                stackId="1"
                stroke={STOCK_COLORS[index % STOCK_COLORS.length]}
                fill={STOCK_COLORS[index % STOCK_COLORS.length]}
                fillOpacity={0.7}
                name={symbol}
              />
            )
          ))}

          {/* Cash reserve area */}
          {visibleSeries.cash && (
            <Area
              type="monotone"
              dataKey="cash"
              stackId="1"
              stroke={CASH_COLOR}
              fill={CASH_COLOR}
              fillOpacity={0.7}
              name="Cash"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

PortfolioCompositionChartAligned.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  isLastChart: PropTypes.bool.isRequired
};

export default PortfolioCompositionChartAligned;
