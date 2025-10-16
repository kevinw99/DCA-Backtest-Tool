import React, { useState, useMemo, useEffect } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import './PortfolioCompositionChart.css';

// Color palette for stocks
const STOCK_COLORS = [
  '#007bff', // Blue
  '#28a745', // Green
  '#dc3545', // Red
  '#ffc107', // Yellow
  '#17a2b8', // Cyan
  '#6610f2', // Purple
  '#fd7e14', // Orange
  '#20c997', // Teal
  '#e83e8c', // Pink
  '#6c757d', // Gray
  '#343a40', // Dark gray
  '#f8f9fa', // Light gray
  '#495057', // Medium gray
  '#00d4ff', // Light blue
  '#ff6b6b', // Light red
];

const CASH_COLOR = '#95d5b2'; // Light green for cash
const TOTAL_COLOR = '#2d3748'; // Dark gray for total line

const PortfolioCompositionChart = ({ compositionTimeSeries }) => {
  // Extract stock symbols from the data (exclude date, cash, total)
  const stockSymbols = useMemo(() => {
    if (!compositionTimeSeries || compositionTimeSeries.length === 0) return [];

    const firstEntry = compositionTimeSeries[0];

    // DEBUG: Log the last 5 entries to see what values are at the end
    console.log('🔍 COMPOSITION CHART DEBUG - Last 5 entries:');
    const lastFive = compositionTimeSeries.slice(-5);
    lastFive.forEach((entry, idx) => {
      console.log(`  [${compositionTimeSeries.length - 5 + idx}] ${entry.date}:`, {
        ...entry,
        date: undefined  // Don't log date twice
      });
    });

    return Object.keys(firstEntry).filter(
      key => key !== 'date' && key !== 'cash' && key !== 'total'
    );
  }, [compositionTimeSeries]);

  // Initialize all stocks and cash as visible
  const [visibleSeries, setVisibleSeries] = useState({ cash: true });

  // Update visible series when stock symbols change (data loads)
  useEffect(() => {
    setVisibleSeries(prev => {
      const updated = { ...prev, cash: true };
      stockSymbols.forEach(symbol => {
        // Only add if not already present, preserving user toggles
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

  const formatCurrency = (value) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    // Find the total value for this data point
    const dataPoint = compositionTimeSeries.find(d => d.date === label);
    const totalValue = dataPoint ? dataPoint.total : 0;

    return (
      <div className="custom-tooltip portfolio-composition-tooltip">
        <p className="tooltip-label">{label}</p>
        <p className="tooltip-total">
          <strong>Total Portfolio:</strong> {formatCurrency(totalValue)}
        </p>
        <div className="tooltip-breakdown">
          {payload
            .filter(entry => entry.value > 0)
            .sort((a, b) => b.value - a.value)
            .map((entry, index) => {
              const percentage = totalValue > 0 ? (entry.value / totalValue * 100).toFixed(1) : 0;
              return (
                <p key={index} style={{ color: entry.fill || entry.color }}>
                  <strong>{entry.name}:</strong>{' '}
                  {formatCurrency(entry.value)} ({percentage}%)
                </p>
              );
            })}
        </div>
      </div>
    );
  };

  if (!compositionTimeSeries || compositionTimeSeries.length === 0) {
    return <div className="portfolio-composition-chart empty">No composition data available</div>;
  }

  return (
    <div className="portfolio-composition-chart">
      <h3>Portfolio Composition Over Time</h3>

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

      <ResponsiveContainer width="100%" height={450}>
        <AreaChart
          data={compositionTimeSeries}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          stackOffset="none"
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
            tickFormatter={formatCurrency}
            domain={[0, 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />

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

      {/* Total portfolio value line chart overlay */}
      <div className="total-value-section">
        <h4>Total Portfolio Value</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={compositionTimeSeries}
            margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
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
              tickFormatter={formatCurrency}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(value), 'Total Value']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke={TOTAL_COLOR}
              strokeWidth={3}
              name="Total Portfolio Value"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PortfolioCompositionChart;
