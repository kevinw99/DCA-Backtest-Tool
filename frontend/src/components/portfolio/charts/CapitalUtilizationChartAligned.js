/**
 * Capital Utilization Chart (Aligned Version)
 *
 * Displays deployed capital, cash reserve, and utilization percentage
 * with synchronized x-axis for alignment with other charts.
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
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
  CHART_HEIGHTS
} from '../../charts/SharedChartConfig';

const CapitalUtilizationChartAligned = ({ data, isLastChart }) => {
  const [visibleLines, setVisibleLines] = useState({
    deployedCapital: true,
    cashReserve: true,
    utilizationPercent: true
  });

  const toggleLine = (line) => {
    setVisibleLines(prev => ({ ...prev, [line]: !prev[line] }));
  };

  if (!data || data.length === 0) {
    return <div className="chart-empty">No capital utilization data available</div>;
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;

    return (
      <div style={TOOLTIP_CONFIG.contentStyle}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '13px' }}>
          {formatDate(label)}
        </p>
        {payload.map((entry, index) => {
          const value = entry.name.includes('%')
            ? `${entry.value.toFixed(2)}%`
            : formatCurrency(entry.value);

          return (
            <p key={index} style={{ color: entry.color, margin: '4px 0' }}>
              <strong>{entry.name}:</strong> {value}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="capital-utilization-chart-aligned">
      {/* Legend controls */}
      <div className="chart-legend">
        <label className={!visibleLines.deployedCapital ? 'disabled' : ''}>
          <input
            type="checkbox"
            checked={visibleLines.deployedCapital}
            onChange={() => toggleLine('deployedCapital')}
          />
          <span className="legend-color" style={{ backgroundColor: '#007bff' }}></span>
          Deployed Capital
        </label>
        <label className={!visibleLines.cashReserve ? 'disabled' : ''}>
          <input
            type="checkbox"
            checked={visibleLines.cashReserve}
            onChange={() => toggleLine('cashReserve')}
          />
          <span className="legend-color" style={{ backgroundColor: '#28a745' }}></span>
          Cash Reserve
        </label>
        <label className={!visibleLines.utilizationPercent ? 'disabled' : ''}>
          <input
            type="checkbox"
            checked={visibleLines.utilizationPercent}
            onChange={() => toggleLine('utilizationPercent')}
          />
          <span className="legend-color" style={{ backgroundColor: '#ffc107' }}></span>
          Utilization %
        </label>
      </div>

      <ResponsiveContainer width="100%" height={CHART_HEIGHTS.standard}>
        <LineChart
          data={data}
          syncId={SYNC_ID}
          margin={getChartMargin(isLastChart, true)} // hasDualAxis = true
        >
          <CartesianGrid {...GRID_CONFIG} />
          <XAxis {...getXAxisConfig(isLastChart)} />

          {/* Left Y-axis for dollar amounts */}
          <YAxis
            yAxisId="left"
            {...Y_AXIS_CONFIG}
            tickFormatter={formatCurrency}
            label={{
              value: 'Capital ($)',
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle' }
            }}
          />

          {/* Right Y-axis for percentage */}
          <YAxis
            yAxisId="right"
            orientation="right"
            {...Y_AXIS_CONFIG}
            tickFormatter={(value) => `${value.toFixed(0)}%`}
            label={{
              value: 'Utilization (%)',
              angle: 90,
              position: 'insideRight',
              style: { textAnchor: 'middle' }
            }}
          />

          <Tooltip content={<CustomTooltip />} {...TOOLTIP_CONFIG} />

          {visibleLines.deployedCapital && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="deployedCapital"
              stroke="#007bff"
              strokeWidth={2}
              name="Deployed Capital ($)"
              dot={false}
              connectNulls={true}
            />
          )}

          {visibleLines.cashReserve && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="cashReserve"
              stroke="#28a745"
              strokeWidth={2}
              name="Cash Reserve ($)"
              dot={false}
              connectNulls={true}
            />
          )}

          {visibleLines.utilizationPercent && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="utilizationPercent"
              stroke="#ffc107"
              strokeWidth={2}
              name="Utilization (%)"
              dot={false}
              connectNulls={true}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

CapitalUtilizationChartAligned.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    date: PropTypes.string.isRequired,
    deployedCapital: PropTypes.number,
    cashReserve: PropTypes.number,
    utilizationPercent: PropTypes.number
  })).isRequired,
  isLastChart: PropTypes.bool.isRequired
};

export default CapitalUtilizationChartAligned;
