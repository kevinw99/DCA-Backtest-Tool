/**
 * DCA vs Buy & Hold Chart (Aligned Version)
 *
 * Displays portfolio value comparison between DCA strategy and Buy & Hold
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

const DCAVsBuyAndHoldChartAligned = ({ data, isLastChart, sharedDomain, sharedTicks }) => {
  const [visibleLines, setVisibleLines] = useState({
    dca: true,
    buyAndHold: true
  });

  const toggleLine = (line) => {
    setVisibleLines(prev => ({ ...prev, [line]: !prev[line] }));
  };

  if (!data || data.length === 0) {
    return <div className="chart-empty">No comparison data available</div>;
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;

    return (
      <div style={TOOLTIP_CONFIG.contentStyle}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '13px' }}>
          {formatDate(label)}
        </p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color, margin: '4px 0' }}>
            <strong>{entry.name}:</strong> {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="dca-vs-buyandhold-chart-aligned">
      {/* Legend controls */}
      <div className="chart-legend">
        <label className={!visibleLines.dca ? 'disabled' : ''}>
          <input
            type="checkbox"
            checked={visibleLines.dca}
            onChange={() => toggleLine('dca')}
          />
          <span className="legend-color" style={{ backgroundColor: '#6366f1' }}></span>
          DCA Strategy
        </label>
        <label className={!visibleLines.buyAndHold ? 'disabled' : ''}>
          <input
            type="checkbox"
            checked={visibleLines.buyAndHold}
            onChange={() => toggleLine('buyAndHold')}
          />
          <span className="legend-color" style={{ backgroundColor: '#10b981' }}></span>
          Buy & Hold
        </label>
      </div>

      <ResponsiveContainer width="100%" height={CHART_HEIGHTS.standard}>
        <LineChart
          data={data}
          syncId={SYNC_ID}
          margin={getChartMargin(isLastChart)}
        >
          <CartesianGrid {...GRID_CONFIG} />
          <XAxis {...getXAxisConfig(isLastChart, sharedDomain, sharedTicks)} />
          <YAxis {...Y_AXIS_CONFIG} tickFormatter={formatCurrency} />
          <Tooltip content={<CustomTooltip />} {...TOOLTIP_CONFIG} />

          {visibleLines.dca && (
            <Line
              type="monotone"
              dataKey="dcaValue"
              stroke="#6366f1"
              name="DCA Strategy"
              strokeWidth={2}
              dot={false}
              connectNulls={true}
            />
          )}

          {visibleLines.buyAndHold && (
            <Line
              type="monotone"
              dataKey="buyAndHoldValue"
              stroke="#10b981"
              name="Buy & Hold"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              connectNulls={true}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

DCAVsBuyAndHoldChartAligned.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    date: PropTypes.string.isRequired,
    dcaValue: PropTypes.number,
    buyAndHoldValue: PropTypes.number
  })).isRequired,
  isLastChart: PropTypes.bool.isRequired
};

export default DCAVsBuyAndHoldChartAligned;
