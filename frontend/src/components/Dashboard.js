import React, { useState, useEffect } from 'react';
import ChartContainer from './ChartContainer';
import TimeRangeControls from './TimeRangeControls';
import MetricsSelector from './MetricsSelector';
import './Dashboard.css';

const Dashboard = ({ stockData }) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('2Y');
  const [visibleMetrics, setVisibleMetrics] = useState([
    'price',
    'revenue',
    'earnings_surprises',
    'yoy_revenue_growth',
    'eps',
    'pe_ratio',
    'gross_margin',
    'operating_margin',
    'net_margin'
  ]);
  const [filteredData, setFilteredData] = useState(null);
  const [sharedTimeRange, setSharedTimeRange] = useState(null);

  useEffect(() => {
    if (stockData && stockData.metrics) {
      const filtered = filterDataByTimeRange(stockData, selectedTimeRange);
      setFilteredData(filtered);
      
      // Debug: Check if YoY revenue growth data is available
      console.log(`🎨 FRONTEND: Available metrics:`, Object.keys(filtered.metrics));
      console.log(`🎨 YoY Revenue Growth data:`, filtered.metrics.yoy_revenue_growth?.length || 0, 'points');
      if (filtered.metrics.yoy_revenue_growth?.length > 0) {
        console.log(`🎨 Sample YoY data:`, filtered.metrics.yoy_revenue_growth.slice(0, 3));
      }
      
      // Calculate shared time range from all metrics data with consistent tick boundaries
      const allDates = [];
      Object.values(filtered.metrics).forEach(metricData => {
        if (Array.isArray(metricData)) {
          metricData.forEach(item => {
            if (item.date) {
              allDates.push(new Date(item.date));
            }
          });
        }
      });
      
      if (allDates.length > 0) {
        const rawMinDate = new Date(Math.min(...allDates));
        const rawMaxDate = new Date(Math.max(...allDates));
        
        // Align to quarter boundaries for consistent tick alignment
        const minDate = new Date(rawMinDate.getFullYear(), Math.floor(rawMinDate.getMonth() / 3) * 3, 1);
        const maxDate = new Date(rawMaxDate.getFullYear(), Math.ceil((rawMaxDate.getMonth() + 1) / 3) * 3, 1);
        
        setSharedTimeRange({ 
          min: minDate, 
          max: maxDate,
          raw: { min: rawMinDate, max: rawMaxDate }
        });
      }
    }
  }, [stockData, selectedTimeRange]);

  const filterDataByTimeRange = (data, timeRange) => {
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case '1Y':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case '2Y':
        startDate = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
        break;
      case '3Y':
        startDate = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
        break;
      case '5Y':
        startDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
        break;
      case 'All':
      default:
        return data; // Return all data
    }

    const startDateStr = startDate.toISOString().split('T')[0];

    const filteredMetrics = {};
    Object.keys(data.metrics).forEach(metricKey => {
      if (Array.isArray(data.metrics[metricKey])) {
        filteredMetrics[metricKey] = data.metrics[metricKey].filter(item => 
          item.date >= startDateStr
        );
      }
    });

    return {
      ...data,
      metrics: filteredMetrics
    };
  };

  const handleTimeRangeChange = (range) => {
    setSelectedTimeRange(range);
  };

  const handleMetricsChange = (newVisibleMetrics) => {
    setVisibleMetrics(newVisibleMetrics);
  };


  if (!stockData || !filteredData) {
    return (
      <div className="dashboard">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  const availableMetrics = [
    { id: 'price', name: 'Stock Price', type: 'line', unit: '$', smooth: true },
    { id: 'revenue', name: 'Quarterly Revenue', type: 'line', unit: 'M' },
    { id: 'earnings_surprises', name: 'Earnings Surprises', type: 'line', unit: '%' },
    { id: 'yoy_revenue_growth', name: 'YoY Revenue Growth', type: 'line', unit: '%' },
    { id: 'eps', name: 'TTM Net EPS', type: 'line', unit: '$' },
    { id: 'pe_ratio', name: 'P/E Ratio', type: 'line', unit: '' },
    { id: 'gross_margin', name: 'Gross Margin', type: 'line', unit: '%' },
    { id: 'operating_margin', name: 'Operating Margin', type: 'line', unit: '%' },
    { id: 'net_margin', name: 'Net Margin', type: 'line', unit: '%' },
    { id: 'volume', name: 'Trading Volume', type: 'bar', unit: '' },
    { id: 'yoy_eps_growth', name: 'YoY EPS Growth', type: 'line', unit: '%' }
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="stock-info">
          <h2>{stockData.symbol}</h2>
          <span className="last-updated">
            Last updated: {stockData.lastUpdated || 'Just now'}
          </span>
        </div>
        
        <div className="dashboard-controls">
          <TimeRangeControls 
            selectedRange={selectedTimeRange}
            onRangeChange={handleTimeRangeChange}
          />
        </div>
      </div>

      <MetricsSelector 
        availableMetrics={availableMetrics}
        visibleMetrics={visibleMetrics}
        onMetricsChange={handleMetricsChange}
      />

      <div className="charts-layout">
        {/* Fixed price chart section */}
        {visibleMetrics.includes('price') && (
          <div className="price-chart-fixed-section">
            {(() => {
              const metric = availableMetrics.find(m => m.id === 'price');
              const data = filteredData.metrics['price'];
              
              if (metric && data && data.length > 0) {
                const showSplits = filteredData.metrics.splits;
                const splitsData = showSplits ? filteredData.metrics.splits : [];
                const showEarnings = filteredData.metrics.earnings_surprises;
                const earningsData = showEarnings ? filteredData.metrics.earnings_surprises : [];

                return (
                  <ChartContainer
                    key="price"
                    metricId="price"
                    metricName={metric.name}
                    chartType={metric.type}
                    data={data}
                    unit={metric.unit}
                    timeRange={selectedTimeRange}
                    splits={splitsData}
                    earnings={earningsData}
                    smooth={metric.smooth}
                    sharedTimeRange={sharedTimeRange}
                    isPriceChart={true}
                  />
                );
              }
              return null;
            })()}
          </div>
        )}

        {/* Scrollable charts section */}
        <div className="other-charts-scrollable-section">
          {visibleMetrics.filter(metricId => metricId !== 'price').map(metricId => {
            const metric = availableMetrics.find(m => m.id === metricId);
            const data = filteredData.metrics[metricId];
            
            if (!metric || !data || data.length === 0) {
              return null;
            }

            return (
              <ChartContainer
                key={metricId}
                metricId={metricId}
                metricName={metric.name}
                chartType={metric.type}
                data={data}
                unit={metric.unit}
                timeRange={selectedTimeRange}
                splits={[]}
                earnings={[]}
                smooth={metric.smooth}
                sharedTimeRange={sharedTimeRange}
                isPriceChart={false}
              />
            );
          })}
        </div>
      </div>

      {visibleMetrics.length === 0 && (
        <div className="no-metrics">
          <p>No metrics selected. Please select metrics to display from the options above.</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;