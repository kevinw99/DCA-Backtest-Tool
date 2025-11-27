import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const DCAVsBuyAndHoldChart = ({ dcaTimeSeries, buyAndHoldTimeSeries, etfBenchmark }) => {
  const [showETF, setShowETF] = useState(true);

  if (!dcaTimeSeries || !buyAndHoldTimeSeries) return null;

  // Merge the time series by date
  const mergedData = dcaTimeSeries.map(dcaPoint => {
    const bhPoint = buyAndHoldTimeSeries.find(bh => bh.date === dcaPoint.date);
    const etfPoint = etfBenchmark?.dailyValues?.find(etf => etf.date === dcaPoint.date);
    return {
      date: dcaPoint.date,
      dcaValue: dcaPoint.portfolioValue,
      buyAndHoldValue: bhPoint?.portfolioValue || null,
      etfValue: etfPoint?.value || null  // Spec 67: Add ETF benchmark value
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3>Portfolio Value Over Time: DCA vs Buy & Hold{etfBenchmark ? ` vs ${etfBenchmark.symbol}` : ''}</h3>
        {etfBenchmark && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={showETF}
              onChange={(e) => setShowETF(e.target.checked)}
            />
            <span>Show {etfBenchmark.symbol} Benchmark</span>
          </label>
        )}
      </div>
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
          {/* Spec 67: ETF Benchmark Line */}
          {etfBenchmark && showETF && (
            <Line
              type="monotone"
              dataKey="etfValue"
              stroke="#ff7300"
              name={`${etfBenchmark.symbol} Benchmark`}
              strokeWidth={2}
              strokeDasharray="10 5"
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DCAVsBuyAndHoldChart;
