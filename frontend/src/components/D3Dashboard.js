import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import TimeRangeControls from './TimeRangeControls';
import MetricsSelector from './MetricsSelector';
import './D3Dashboard.css';

const D3Dashboard = ({ stockData }) => {
  const svgRef = useRef();
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

  useEffect(() => {
    if (stockData && stockData.metrics) {
      const filtered = filterDataByTimeRange(stockData, selectedTimeRange);
      setFilteredData(filtered);
    }
  }, [stockData, selectedTimeRange]);

  useEffect(() => {
    if (filteredData && visibleMetrics.length > 0) {
      drawCharts();
    }
  }, [filteredData, visibleMetrics]);

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
        return data;
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

  const drawCharts = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const containerWidth = 1200;
    const containerHeight = 800;
    const margin = { top: 20, right: 60, bottom: 40, left: 80 };
    const chartHeight = 120;
    const chartSpacing = 20;

    svg.attr("width", containerWidth).attr("height", containerHeight);

    // Calculate shared time domain
    const allDates = [];
    Object.values(filteredData.metrics).forEach(metricData => {
      if (Array.isArray(metricData)) {
        metricData.forEach(item => {
          if (item.date) {
            allDates.push(new Date(item.date));
          }
        });
      }
    });

    if (allDates.length === 0) return;

    const timeDomain = d3.extent(allDates);
    const sharedXScale = d3.scaleTime()
      .domain(timeDomain)
      .range([margin.left, containerWidth - margin.right]);

    // Available metrics configuration
    const availableMetrics = [
      { id: 'price', name: 'Stock Price', unit: '$', color: '#3498db', smooth: true },
      { id: 'revenue', name: 'Quarterly Revenue', unit: 'M', color: '#2ecc71' },
      { id: 'earnings_surprises', name: 'Earnings Surprises', unit: '%', color: '#9b59b6' },
      { id: 'yoy_revenue_growth', name: 'YoY Revenue Growth', unit: '%', color: '#27ae60' },
      { id: 'eps', name: 'TTM Net EPS', unit: '$', color: '#8e44ad' },
      { id: 'pe_ratio', name: 'P/E Ratio', unit: '', color: '#e74c3c' },
      { id: 'gross_margin', name: 'Gross Margin', unit: '%', color: '#f39c12' },
      { id: 'operating_margin', name: 'Operating Margin', unit: '%', color: '#e67e22' },
      { id: 'net_margin', name: 'Net Margin', unit: '%', color: '#d35400' }
    ];

    // Filter and render visible metrics
    const metricsToRender = availableMetrics.filter(metric => 
      visibleMetrics.includes(metric.id) && 
      filteredData.metrics[metric.id] && 
      filteredData.metrics[metric.id].length > 0
    );

    metricsToRender.forEach((metric, index) => {
      const chartY = margin.top + index * (chartHeight + chartSpacing);
      const data = filteredData.metrics[metric.id];
      
      if (!data || data.length === 0) return;

      // Create Y scale for this metric
      let yDomain;
      if (metric.id === 'earnings_surprises') {
        // Special handling for earnings surprises (dual datasets)
        const epsSurprises = data.map(d => d.eps_surprise || 0);
        const revenueSurprises = data.map(d => d.revenue_surprise || 0);
        yDomain = d3.extent([...epsSurprises, ...revenueSurprises]);
      } else {
        yDomain = d3.extent(data, d => d.value);
      }

      const yScale = d3.scaleLinear()
        .domain(yDomain)
        .range([chartY + chartHeight - margin.bottom, chartY + margin.top]);

      // Create chart group
      const chartGroup = svg.append("g")
        .attr("class", `chart-${metric.id}`);

      // Draw chart title
      chartGroup.append("text")
        .attr("x", margin.left)
        .attr("y", chartY + 15)
        .attr("class", "chart-title")
        .style("font-weight", "bold")
        .style("font-size", "14px")
        .text(metric.name);

      // Draw axes
      const xAxis = d3.axisBottom(sharedXScale)
        .tickFormat(d3.timeFormat("%b %Y"))
        .ticks(6);

      const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => {
          switch (metric.unit) {
            case '$': return `$${d.toFixed(2)}`;
            case '%': return `${d.toFixed(1)}%`;
            case 'M': return `$${d.toFixed(0)}M`;
            default: return d.toLocaleString();
          }
        });

      chartGroup.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${chartY + chartHeight - margin.bottom})`)
        .call(xAxis);

      chartGroup.append("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(yAxis);

      // Draw chart data
      if (metric.id === 'earnings_surprises') {
        // Draw dual line chart for earnings surprises
        drawDualLineChart(chartGroup, data, sharedXScale, yScale, chartY);
      } else {
        // Draw single line chart
        drawLineChart(chartGroup, data, sharedXScale, yScale, metric.color, metric.smooth);
      }

      // Add grid lines
      chartGroup.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0, ${chartY + chartHeight - margin.bottom})`)
        .call(d3.axisBottom(sharedXScale)
          .tickSize(-(chartHeight - margin.top - margin.bottom))
          .tickFormat("")
        )
        .style("stroke-dasharray", "2,2")
        .style("opacity", 0.3);
    });

    // Add synchronized hover functionality
    addSynchronizedHover(svg, sharedXScale, containerWidth, containerHeight, margin);
  };

  const drawLineChart = (group, data, xScale, yScale, color, smooth = false) => {
    const line = d3.line()
      .x(d => xScale(new Date(d.date)))
      .y(d => yScale(d.value))
      .curve(smooth ? d3.curveCatmullRom : d3.curveLinear);

    group.append("path")
      .datum(data)
      .attr("class", "line")
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 2)
      .attr("d", line);

    // Add data points
    if (!smooth) {
      group.selectAll(".dot")
        .data(data)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("cx", d => xScale(new Date(d.date)))
        .attr("cy", d => yScale(d.value))
        .attr("r", 3)
        .attr("fill", color);
    }
  };

  const drawDualLineChart = (group, data, xScale, yScale, chartY) => {
    // EPS Surprise line
    const epsLine = d3.line()
      .x(d => xScale(new Date(d.date)))
      .y(d => yScale(d.eps_surprise || 0))
      .curve(d3.curveLinear);

    group.append("path")
      .datum(data)
      .attr("class", "eps-line")
      .attr("fill", "none")
      .attr("stroke", "#9b59b6")
      .attr("stroke-width", 2)
      .attr("d", epsLine);

    // Revenue Surprise line
    const revenueLine = d3.line()
      .x(d => xScale(new Date(d.date)))
      .y(d => yScale(d.revenue_surprise || 0))
      .curve(d3.curveLinear);

    group.append("path")
      .datum(data)
      .attr("class", "revenue-line")
      .attr("fill", "none")
      .attr("stroke", "#3498db")
      .attr("stroke-width", 2)
      .attr("d", revenueLine);

    // Add legend
    const legend = group.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${300}, ${chartY + 15})`);

    legend.append("line")
      .attr("x1", 0).attr("x2", 20)
      .attr("y1", 0).attr("y2", 0)
      .attr("stroke", "#9b59b6")
      .attr("stroke-width", 2);

    legend.append("text")
      .attr("x", 25).attr("y", 5)
      .style("font-size", "12px")
      .text("Profit Surprise");

    legend.append("line")
      .attr("x1", 120).attr("x2", 140)
      .attr("y1", 0).attr("y2", 0)
      .attr("stroke", "#3498db")
      .attr("stroke-width", 2);

    legend.append("text")
      .attr("x", 145).attr("y", 5)
      .style("font-size", "12px")
      .text("Revenue Surprise");
  };

  const addSynchronizedHover = (svg, xScale, width, height, margin) => {
    const hoverLine = svg.append("line")
      .attr("class", "hover-line")
      .style("stroke", "#ff4757")
      .style("stroke-width", 2)
      .style("stroke-dasharray", "5,5")
      .style("opacity", 0);

    const hoverRect = svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .style("fill", "none")
      .style("pointer-events", "all");

    hoverRect
      .on("mousemove", function(event) {
        const [mouseX] = d3.pointer(event);
        
        if (mouseX >= margin.left && mouseX <= width - margin.right) {
          hoverLine
            .attr("x1", mouseX)
            .attr("x2", mouseX)
            .attr("y1", margin.top)
            .attr("y2", height - margin.bottom)
            .style("opacity", 1);
        }
      })
      .on("mouseleave", function() {
        hoverLine.style("opacity", 0);
      });
  };

  const handleTimeRangeChange = (range) => {
    setSelectedTimeRange(range);
  };

  const handleMetricsChange = (newVisibleMetrics) => {
    setVisibleMetrics(newVisibleMetrics);
  };

  if (!stockData) {
    return (
      <div className="d3-dashboard">
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
    <div className="d3-dashboard">
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

      <div className="charts-container">
        <svg ref={svgRef} className="d3-charts"></svg>
      </div>

      {visibleMetrics.length === 0 && (
        <div className="no-metrics">
          <p>No metrics selected. Please select metrics to display from the options above.</p>
        </div>
      )}
    </div>
  );
};

export default D3Dashboard;