import React, { useState, useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts';
import './CapitalAllocationChart.css';

// Same color palette as other charts
const STOCK_COLORS = [
  '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6610f2',
  '#fd7e14', '#20c997', '#e83e8c', '#6c757d', '#343a40', '#f8f9fa',
  '#495057', '#00d4ff', '#ff6b6b',
];

const CapitalAllocationChart = ({ compositionTimeSeries, capitalUtilizationTimeSeries, capitalDeploymentTimeSeries }) => {
  // Extract stock symbols from composition data (exclude date, cash, total)
  const stockSymbols = useMemo(() => {
    if (!compositionTimeSeries || compositionTimeSeries.length === 0) return [];

    const firstEntry = compositionTimeSeries[0];
    return Object.keys(firstEntry).filter(
      key => key !== 'date' && key !== 'cash' && key !== 'total'
    );
  }, [compositionTimeSeries]);

  // Initialize all stocks as visible (both market value and deployed capital)
  const [visibleStocks, setVisibleStocks] = useState(() => {
    const initial = {};
    stockSymbols.forEach(symbol => {
      initial[symbol] = true;
    });
    return initial;
  });

  const [visibleDeployment, setVisibleDeployment] = useState(() => {
    const initial = {};
    stockSymbols.forEach(symbol => {
      initial[symbol] = true;
    });
    return initial;
  });

  const [showUtilization, setShowUtilization] = useState(true);

  const toggleStock = (symbol) => {
    setVisibleStocks(prev => ({ ...prev, [symbol]: !prev[symbol] }));
  };

  const toggleDeployment = (symbol) => {
    setVisibleDeployment(prev => ({ ...prev, [symbol]: !prev[symbol] }));
  };

  // Merge composition data with utilization data and deployment data
  const mergedData = useMemo(() => {
    if (!compositionTimeSeries || !capitalUtilizationTimeSeries) return [];

    return compositionTimeSeries.map(comp => {
      const util = capitalUtilizationTimeSeries.find(u => u.date === comp.date);
      const deployment = capitalDeploymentTimeSeries
        ? capitalDeploymentTimeSeries.find(d => d.date === comp.date)
        : null;

      const result = {
        ...comp,
        utilizationPercent: util ? util.utilizationPercent : 0
      };

      // Add deployment data for each stock (with "deployed_" prefix to avoid conflicts)
      if (deployment) {
        stockSymbols.forEach(symbol => {
          result[`deployed_${symbol}`] = deployment[symbol] || 0;
        });
      }

      return result;
    });
  }, [compositionTimeSeries, capitalUtilizationTimeSeries, capitalDeploymentTimeSeries, stockSymbols]);

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

    // Find utilization for this date
    const dataPoint = mergedData.find(d => d.date === label);
    const utilization = dataPoint ? dataPoint.utilizationPercent : 0;

    // Calculate total deployed capital
    const totalDeployed = payload
      .filter(entry => entry.dataKey !== 'utilizationPercent')
      .reduce((sum, entry) => sum + (entry.value || 0), 0);

    return (
      <div className="custom-tooltip capital-allocation-tooltip">
        <p className="tooltip-label">{label}</p>
        <p className="tooltip-total">
          <strong>Total Deployed:</strong> {formatCurrency(totalDeployed)}
        </p>
        <p className="tooltip-utilization">
          <strong>Utilization:</strong> {utilization.toFixed(2)}%
        </p>
        <div className="tooltip-breakdown">
          {payload
            .filter(entry => entry.dataKey !== 'utilizationPercent' && entry.value > 0)
            .sort((a, b) => b.value - a.value)
            .map((entry, index) => {
              const percentage = totalDeployed > 0 ? (entry.value / totalDeployed * 100).toFixed(1) : 0;
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
    return <div className="capital-allocation-chart empty">No capital allocation data available</div>;
  }

  return (
    <div className="capital-allocation-chart">
      <h3>Capital Allocation Timeline</h3>
      <p className="chart-description">
        Shows market value (filled areas) vs deployed capital/cost basis (dashed lines) for each stock, with utilization percentage overlay
      </p>

      <div className="chart-legend">
        <div className="legend-section">
          <strong>Market Value:</strong>
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
        {capitalDeploymentTimeSeries && (
          <div className="legend-section">
            <strong>Deployed Capital (Cost Basis):</strong>
            {stockSymbols.map((symbol, index) => (
              <label key={`dep_${symbol}`} className={!visibleDeployment[symbol] ? 'disabled' : ''}>
                <input
                  type="checkbox"
                  checked={visibleDeployment[symbol]}
                  onChange={() => toggleDeployment(symbol)}
                />
                <span
                  className="legend-line"
                  style={{
                    borderTop: `2px dashed ${STOCK_COLORS[index % STOCK_COLORS.length]}`,
                    width: '20px',
                    display: 'inline-block'
                  }}
                ></span>
                {symbol}
              </label>
            ))}
          </div>
        )}
        <div className="legend-section">
          <label className={!showUtilization ? 'disabled' : ''}>
            <input
              type="checkbox"
              checked={showUtilization}
              onChange={() => setShowUtilization(!showUtilization)}
            />
            <span className="legend-line utilization"></span>
            Utilization %
          </label>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={450}>
        <ComposedChart
          data={mergedData}
          margin={{ top: 20, right: 60, left: 20, bottom: 20 }}
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
            yAxisId="left"
            stroke="#666"
            tick={{ fontSize: 12 }}
            tickFormatter={formatCurrency}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#666"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value.toFixed(0)}%`}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Reference line at 80% utilization */}
          {showUtilization && (
            <ReferenceLine
              yAxisId="right"
              y={80}
              stroke="#ff9800"
              strokeDasharray="5 5"
              strokeWidth={1}
              label={{ value: 'High Utilization (80%)', position: 'right', fill: '#ff9800', fontSize: 10 }}
            />
          )}

          {/* Stacked areas for each stock's market value */}
          {stockSymbols.map((symbol, index) => (
            visibleStocks[symbol] && (
              <Area
                key={symbol}
                yAxisId="left"
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

          {/* Dashed lines for each stock's deployed capital (cost basis) */}
          {capitalDeploymentTimeSeries && stockSymbols.map((symbol, index) => (
            visibleDeployment[symbol] && (
              <Line
                key={`deployed_${symbol}`}
                yAxisId="left"
                type="stepAfter"
                dataKey={`deployed_${symbol}`}
                stroke={STOCK_COLORS[index % STOCK_COLORS.length]}
                strokeWidth={2}
                strokeDasharray="5 5"
                name={`${symbol} (Deployed)`}
                dot={false}
              />
            )
          ))}

          {/* Utilization % line */}
          {showUtilization && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="utilizationPercent"
              stroke="#2d3748"
              strokeWidth={3}
              name="Utilization %"
              dot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="utilization-legend">
        <div className="legend-item">
          <span className="indicator low"></span>
          <span>Low (&lt;50%)</span>
        </div>
        <div className="legend-item">
          <span className="indicator medium"></span>
          <span>Medium (50-80%)</span>
        </div>
        <div className="legend-item">
          <span className="indicator high"></span>
          <span>High (&gt;80%)</span>
        </div>
      </div>
    </div>
  );
};

export default CapitalAllocationChart;
