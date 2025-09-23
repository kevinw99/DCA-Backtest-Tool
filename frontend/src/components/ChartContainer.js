import React, { useRef, useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import './ChartContainer.css';

// Global state for synchronized hover
let globalSyncState = {
  activeHover: null,
  charts: new Map(),
  isHovering: false,
  hoverTimeValue: null
};

// Synchronized hover plugin
const synchronizedHoverPlugin = {
  id: 'synchronizedHover',
  afterInit: (chart) => {
    // Register chart for synchronization only if canvas exists and is in DOM
    if (chart.canvas && chart.canvas.parentNode) {
      globalSyncState.charts.set(chart.canvas.id || `chart-${Date.now()}`, chart);
    }
  },
  beforeDestroy: (chart) => {
    // Unregister chart safely
    if (chart.canvas) {
      globalSyncState.charts.delete(chart.canvas.id || `chart-${Date.now()}`);
    }
  },
  afterEvent: (chart, args) => {
    const event = args.event;
    if (event.type === 'mousemove' && chart.canvas && chart.canvas.parentNode) {
      const canvasRect = chart.canvas.getBoundingClientRect();
      const x = event.x - canvasRect.left;
      
      // Only process if mouse is within chart area
      if (x >= chart.chartArea.left && x <= chart.chartArea.right) {
        // Get the time value at the hover position
        const xScale = chart.scales.x;
        const timeValue = xScale ? xScale.getValueForPixel(x) : null;
        
        // Update global hover state with actual mouse position
        globalSyncState.activeHover = {
          x: x,
          chartArea: chart.chartArea,
          sourceChart: chart.canvas.id,
          timeValue: timeValue
        };
        globalSyncState.isHovering = true;
        globalSyncState.hoverTimeValue = timeValue;
      
        // Update all other charts synchronously
        globalSyncState.charts.forEach((otherChart, chartId) => {
          if (chartId !== chart.canvas.id && otherChart.ctx) {
            // Force immediate redraw without animation
            otherChart.draw();
          }
        });
      }
    } else if (event.type === 'mouseleave') {
      globalSyncState.isHovering = false;
      globalSyncState.activeHover = null;
      globalSyncState.hoverTimeValue = null;
      
      // Update all charts to remove crosshair
      globalSyncState.charts.forEach((otherChart) => {
        if (otherChart.ctx) {
          otherChart.draw();
        }
      });
    }
  },
  afterDraw: (chart) => {
    // Draw synchronized crosshair line
    if (globalSyncState.isHovering && globalSyncState.activeHover && chart.canvas && chart.canvas.parentNode) {
      const ctx = chart.ctx;
      const chartArea = chart.chartArea;
      
      let targetX;
      
      // If this is the source chart, use the actual mouse position
      if (chart.canvas.id === globalSyncState.activeHover.sourceChart) {
        targetX = globalSyncState.activeHover.x;
      } else {
        // For other charts, calculate based on time value
        const xScale = chart.scales.x;
        if (xScale && globalSyncState.hoverTimeValue) {
          targetX = xScale.getPixelForValue(globalSyncState.hoverTimeValue);
        } else {
          return; // Skip if can't calculate position
        }
      }
      
      // Only draw if crosshair is within chart area
      if (targetX >= chartArea.left && targetX <= chartArea.right) {
        ctx.save();
        ctx.strokeStyle = '#ff4757';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.globalAlpha = 0.9;
        
        ctx.beginPath();
        ctx.moveTo(targetX, chartArea.top);
        ctx.lineTo(targetX, chartArea.bottom);
        ctx.stroke();
        
        // Add a small circle at the top and bottom
        ctx.setLineDash([]);
        ctx.fillStyle = '#ff4757';
        ctx.beginPath();
        ctx.arc(targetX, chartArea.top, 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(targetX, chartArea.bottom, 3, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.restore();
      }
    }
  }
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
  synchronizedHoverPlugin
);

const ChartContainer = ({ metricId, metricName, chartType, data, unit, timeRange, splits = [], earnings = [], smooth = false, sharedTimeRange = null, isPriceChart = false }) => {
  const chartRef = useRef(null);
  const [selectedEarning, setSelectedEarning] = useState(null);
  
  // Generate unique chart ID for synchronization
  const chartId = `chart-${metricId}-${Date.now()}`;
  
  useEffect(() => {
    // Set canvas ID for synchronization after component mounts
    const timer = setTimeout(() => {
      if (chartRef.current && chartRef.current.canvas && chartRef.current.canvas.parentNode) {
        chartRef.current.canvas.id = chartId;
        // Re-register in sync state if needed
        if (!globalSyncState.charts.has(chartId)) {
          globalSyncState.charts.set(chartId, chartRef.current);
        }
      }
    }, 100); // Small delay to ensure DOM is ready
    
    return () => clearTimeout(timer);
  }, [chartId]);

  const formatValue = (value, unit) => {
    if (value === null || value === undefined) return 'N/A';
    
    switch (unit) {
      case '$':
        return `$${value.toFixed(2)}`;
      case '%':
        return `${value.toFixed(1)}%`;
      case 'M':
        return `$${value.toFixed(0)}M`;
      case '':
      default:
        return value.toLocaleString();
    }
  };

  const getChartColor = (metricId) => {
    const colors = {
      price: '#3498db',
      revenue: '#2ecc71',
      yoy_revenue_growth: '#27ae60',
      eps: '#9b59b6',
      pe_ratio: '#e74c3c',
      gross_margin: '#f39c12',
      operating_margin: '#e67e22',
      net_margin: '#d35400',
      volume: '#95a5a6',
      yoy_eps_growth: '#8e44ad'
    };
    return colors[metricId] || '#34495e';
  };

  const prepareChartData = () => {
    if (!data || data.length === 0) return null;

    const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Special handling for earnings surprises chart
    if (metricId === 'earnings_surprises') {
      return {
        labels: sortedData.map(item => item.date),
        datasets: [
          {
            label: 'Profit Surprise',
            data: sortedData.map(item => item.eps_surprise || 0),
            backgroundColor: '#9b59b6',
            borderColor: '#8e44ad',
            borderWidth: 1,
          },
          {
            label: 'Revenue Surprise', 
            data: sortedData.map(item => item.revenue_surprise || 0),
            backgroundColor: '#3498db',
            borderColor: '#2980b9',
            borderWidth: 1,
          }
        ]
      };
    }

    // Regular chart handling
    const color = getChartColor(metricId);
    return {
      labels: sortedData.map(item => item.date),
      datasets: [
        {
          label: metricName,
          data: sortedData.map(item => item.value),
          borderColor: color,
          backgroundColor: chartType === 'bar' ? `${color}80` : `${color}20`,
          borderWidth: chartType === 'line' ? (smooth ? 3 : 2) : 1,
          fill: chartType === 'line' ? false : true,
          tension: chartType === 'line' ? (smooth ? 0.4 : 0.1) : 0,
          pointRadius: chartType === 'line' ? (metricId === 'price' ? 0 : (smooth ? 0 : 3)) : 0, // No points for price chart
          pointHoverRadius: chartType === 'line' ? (smooth ? 6 : 5) : 0,
          spanGaps: false, // Don't span gaps for daily data
          pointBackgroundColor: color,
          pointBorderColor: '#fff',
          pointBorderWidth: smooth ? 2 : 1,
        }
      ]
    };
  };

  const getChartOptions = () => {
    // Use shared time range for consistent x-axis alignment, fallback to individual data range
    let minDate, maxDate;
    if (sharedTimeRange) {
      minDate = sharedTimeRange.min;
      maxDate = sharedTimeRange.max;
    } else {
      const allDates = data.map(item => new Date(item.date));
      minDate = new Date(Math.min(...allDates));
      maxDate = new Date(Math.max(...allDates));
    }
    
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 0 // Disable animations for faster synchronization
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
      layout: {
        padding: {
          left: 60,  // Fixed left padding for y-axis labels
          right: 20, // Fixed right padding
          top: 10,   // Fixed top padding
          bottom: 40 // Fixed bottom padding for x-axis labels
        }
      },
      plugins: {
        legend: {
          display: metricId === 'earnings_surprises', // Show legend only for earnings surprises
          position: 'top',
          labels: {
            boxWidth: 15,
            padding: 15,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              // For earnings surprises, use the dataset label instead of the chart name
              if (metricId === 'earnings_surprises') {
                return `${context.dataset.label}: ${formatValue(context.parsed.y, unit)}`;
              }
              return `${metricName}: ${formatValue(context.parsed.y, unit)}`;
            },
            afterBody: function(tooltipItems) {
              if (splits.length > 0) {
                const dateStr = tooltipItems[0].parsed.x;
                const date = new Date(dateStr);
                const splitAtDate = splits.find(s => {
                  const splitDate = new Date(s.date);
                  return Math.abs(splitDate - date) < 24 * 60 * 60 * 1000; // Within 1 day
                });
                if (splitAtDate) {
                  return [`Stock Split: ${splitAtDate.ratio}`, splitAtDate.description || ''];
                }
              }
              return [];
            }
          }
        },
        synchronizedHover: {
          enabled: true
        }
      },
      scales: {
        x: {
          type: 'time',
          min: minDate,
          max: maxDate,
          time: {
            unit: 'day',
            displayFormats: {
              day: 'MMM dd',
              week: 'MMM dd',
              month: 'MMM yyyy', 
              quarter: 'MMM yyyy',
              year: 'yyyy'
            },
            tooltipFormat: 'MMM dd, yyyy'
          },
          ticks: {
            source: 'auto',
            autoSkip: true,
            maxTicksLimit: 8,
            align: 'start',
            major: {
              enabled: true
            },
            padding: 0,
            callback: function(value, index) {
              const date = new Date(value);
              const month = date.toLocaleDateString('en-US', { month: 'short' });
              const year = date.getFullYear();
              return `${month} ${year}`;
            }
          },
          title: {
            display: false
          },
          grid: {
            display: true,
            color: '#f0f0f0',
            drawOnChartArea: true,
            drawTicks: true,
            lineWidth: 1,
            offset: false,
            tickLength: 8
          },
          border: {
            display: true,
            width: 1,
            color: '#e0e0e0'
          },
          offset: false,
          position: 'bottom'
        },
        y: {
          beginAtZero: metricId === 'volume' || metricId.includes('margin'),
          title: {
            display: true,
            text: unit ? `Value (${unit})` : 'Value',
            padding: { top: 0, bottom: 0 }
          },
          grid: {
            display: true,
            color: '#f0f0f0',
            lineWidth: 1,
            offset: false
          },
          border: {
            display: true,
            width: 1,
            color: '#e0e0e0'
          },
          ticks: {
            padding: 5,
            maxTicksLimit: 8,
            callback: function(value) {
              return formatValue(value, unit);
            }
          },
          position: 'left'
        }
      },
      elements: {
        point: {
          hoverBackgroundColor: getChartColor(metricId),
          hoverBorderColor: '#fff',
          hoverBorderWidth: 2
        },
        bar: {
          // Make bars much narrower for all quarterly data to reflect specific report dates
          maxBarThickness: chartType === 'bar' ? 8 : undefined,
          barPercentage: chartType === 'bar' ? 0.3 : undefined,
          categoryPercentage: chartType === 'bar' ? 0.4 : undefined
        }
      }
    };
  };

  const chartData = prepareChartData();

  if (!chartData) {
    return (
      <div className="chart-container">
        <div className="chart-header">
          <h4>{metricName}</h4>
        </div>
        <div className="chart-content">
          <div className="no-data">
            <p>No data available for {metricName}</p>
          </div>
        </div>
      </div>
    );
  }

  const ChartComponent = chartType === 'line' ? Line : Bar;

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h4>{metricName}</h4>
        <div className="chart-info">
          <span className="data-points">{data.length} data points</span>
          <span className="chart-type">({chartType} chart)</span>
          {splits.length > 0 && (
            <span className="split-indicator">⚡ {splits.length} splits</span>
          )}
        </div>
      </div>
      <div className="chart-content">
        <ChartComponent
          ref={chartRef}
          data={chartData}
          options={getChartOptions()}
          id={chartId}
          key={`${metricId}-${sharedTimeRange?.min?.getTime()}`}
        />
        {splits.length > 0 && metricId === 'price' && (
          <div className="split-events">
            <div className="split-events-title">Stock Splits:</div>
            <div className="split-events-list">
              {splits.map((split, index) => (
                <div key={index} className="split-event">
                  <span className="split-date">{new Date(split.date).toLocaleDateString()}</span>
                  <span className="split-ratio">{split.ratio}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {earnings.length > 0 && metricId === 'price' && (
          <div className="earnings-events">
            <div className="earnings-events-title">Earnings Reports:</div>
            <div className="earnings-events-list">
              {earnings.map((earning, index) => (
                <div 
                  key={index} 
                  className="earnings-event"
                  onClick={() => setSelectedEarning(earning)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="earnings-thumbnail">E</span>
                  <span className="earnings-date">{new Date(earning.reported_date || earning.date).toLocaleDateString()}</span>
                  <span className="earnings-eps">EPS: {earning.eps_actual ? `$${earning.eps_actual.toFixed(2)}` : 'N/A'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {selectedEarning && (
          <div className="earnings-modal" onClick={() => setSelectedEarning(null)}>
            <div className="earnings-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="earnings-modal-header">
                <h3>Earnings Report</h3>
                <button 
                  className="earnings-modal-close"
                  onClick={() => setSelectedEarning(null)}
                >
                  ×
                </button>
              </div>
              <div className="earnings-modal-body">
                <div className="earnings-detail">
                  <strong>Fiscal Period:</strong> {selectedEarning.date}
                </div>
                <div className="earnings-detail">
                  <strong>Reported Date:</strong> {selectedEarning.reported_date ? new Date(selectedEarning.reported_date).toLocaleDateString() : 'N/A'}
                </div>
                <div className="earnings-detail">
                  <strong>EPS Actual:</strong> {selectedEarning.eps_actual ? `$${selectedEarning.eps_actual.toFixed(2)}` : 'N/A'}
                </div>
                <div className="earnings-detail">
                  <strong>EPS Estimate:</strong> {selectedEarning.eps_estimate ? `$${selectedEarning.eps_estimate.toFixed(2)}` : 'N/A'}
                </div>
                <div className="earnings-detail">
                  <strong>EPS Surprise:</strong> {selectedEarning.eps_surprise ? `${selectedEarning.eps_surprise.toFixed(1)}%` : 'N/A'}
                </div>
                <div className="earnings-detail">
                  <strong>Revenue Actual:</strong> {selectedEarning.revenue_actual ? `$${(selectedEarning.revenue_actual / 1000000).toFixed(0)}M` : 'N/A'}
                </div>
                <div className="earnings-detail">
                  <strong>Revenue Estimate:</strong> {selectedEarning.revenue_estimate ? `$${(selectedEarning.revenue_estimate / 1000000).toFixed(0)}M` : 'N/A'}
                </div>
                <div className="earnings-detail">
                  <strong>Revenue Surprise:</strong> {selectedEarning.revenue_surprise ? `${selectedEarning.revenue_surprise.toFixed(1)}%` : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChartContainer;