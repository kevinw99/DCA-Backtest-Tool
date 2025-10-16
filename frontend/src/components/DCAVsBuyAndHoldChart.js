import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const DCAVsBuyAndHoldChart = ({ dcaTimeSeries, buyAndHoldTimeSeries }) => {
  if (!dcaTimeSeries || !buyAndHoldTimeSeries) return null;

  // Merge the two time series by date
  const mergedData = dcaTimeSeries.map(dcaPoint => {
    const bhPoint = buyAndHoldTimeSeries.find(bh => bh.date === dcaPoint.date);
    return {
      date: dcaPoint.date,
      dcaValue: dcaPoint.portfolioValue,
      buyAndHoldValue: bhPoint?.portfolioValue || null
    };
  });

  const formatCurrency = (value) => {
    if (value == null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="dca-vs-buyandhold-chart">
      <h3>Portfolio Value Over Time: DCA vs Buy & Hold</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={mergedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tickFormatter={formatCurrency}
          />
          <Tooltip
            formatter={(value) => formatCurrency(value)}
            labelFormatter={(label) => formatDate(label)}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="dcaValue"
            stroke="#6366f1"
            name="DCA Strategy"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="buyAndHoldValue"
            stroke="#10b981"
            name="Buy & Hold"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DCAVsBuyAndHoldChart;
