import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import './CapitalUtilizationChart.css';

const CapitalUtilizationChart = ({ timeSeries }) => {
  const [visibleLines, setVisibleLines] = useState({
    deployedCapital: true,
    cashReserve: true,
    utilizationPercent: true
  });

  const toggleLine = (line) => {
    setVisibleLines(prev => ({ ...prev, [line]: !prev[line] }));
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;

    return (
      <div className="custom-tooltip">
        <p className="tooltip-label">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }}>
            <strong>{entry.name}:</strong>{' '}
            {entry.name.includes('%')
              ? `${entry.value.toFixed(2)}%`
              : formatCurrency(entry.value)
            }
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="capital-utilization-chart">
      <div className="chart-legend">
        <label className={!visibleLines.deployedCapital ? 'disabled' : ''}>
          <input
            type="checkbox"
            checked={visibleLines.deployedCapital}
            onChange={() => toggleLine('deployedCapital')}
          />
          <span className="legend-color deployed"></span>
          Deployed Capital
        </label>
        <label className={!visibleLines.cashReserve ? 'disabled' : ''}>
          <input
            type="checkbox"
            checked={visibleLines.cashReserve}
            onChange={() => toggleLine('cashReserve')}
          />
          <span className="legend-color cash"></span>
          Cash Reserve
        </label>
        <label className={!visibleLines.utilizationPercent ? 'disabled' : ''}>
          <input
            type="checkbox"
            checked={visibleLines.utilizationPercent}
            onChange={() => toggleLine('utilizationPercent')}
          />
          <span className="legend-color utilization"></span>
          Utilization %
        </label>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={timeSeries} margin={{ top: 20, right: 60, left: 20, bottom: 20 }}>
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
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {visibleLines.deployedCapital && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="deployedCapital"
              stroke="#007bff"
              strokeWidth={2}
              name="Deployed Capital ($)"
              dot={false}
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
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CapitalUtilizationChart;
