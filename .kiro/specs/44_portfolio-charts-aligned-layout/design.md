# Design: Portfolio Charts Aligned Layout

## Architecture Overview

### Component Structure
```
PortfolioResults
├── ParametersDisplay
├── PerformanceMetrics
├── AlignedChartsContainer (NEW)
│   ├── SynchronizedChartWrapper (NEW)
│   │   ├── NormalizedPriceChart
│   │   ├── PerformanceComparisonChart
│   │   ├── CapitalDeploymentChart
│   │   └── [Other Charts]
│   └── SharedXAxisConfig (NEW)
└── StockPerformanceTable
```

## Design Approach: Recharts ComposedChart with Synchronized Domains

### Option 1: Synchronized ResponsiveContainer (Recommended)

Use Recharts' built-in synchronization features with `syncId` prop:

```jsx
// All charts share the same syncId to synchronize x-axis
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data} syncId="portfolioCharts">
    <XAxis
      dataKey="date"
      hide={!isLastChart} // Only show on last chart
    />
    <YAxis />
    {/* Chart content */}
  </LineChart>
</ResponsiveContainer>
```

**Pros:**
- Built-in Recharts feature
- Automatic cursor synchronization
- Handles responsive resizing well
- Minimal custom code

**Cons:**
- All charts must have same data array length
- Requires careful data preprocessing

### Option 2: Shared Domain Configuration

Explicitly set domain and ticks for all charts:

```jsx
const getSharedXAxisConfig = (allData) => {
  const minDate = Math.min(...allData.map(d => d.timestamp));
  const maxDate = Math.max(...allData.map(d => d.timestamp));
  const ticksCount = 10;

  return {
    domain: [minDate, maxDate],
    ticks: generateDateTicks(minDate, maxDate, ticksCount),
    type: 'number', // Use timestamps for precise alignment
  };
};
```

**Pros:**
- More control over axis behavior
- Can handle different data structures per chart
- Precise alignment control

**Cons:**
- More custom code
- Manual tick generation
- Need to handle edge cases

## Implementation Strategy: Hybrid Approach

Combine both approaches for best results:

### 1. Data Preprocessing Layer

```javascript
// services/chartDataProcessor.js

/**
 * Normalizes all chart data to share the same date range and intervals
 */
export function preprocessPortfolioChartData(portfolioData, startDate, endDate) {
  // Generate master date array (all trading days in range)
  const masterDates = generateTradingDays(startDate, endDate);

  return {
    masterDates,
    normalizedPriceData: alignDataToDates(portfolioData.priceData, masterDates),
    performanceData: alignDataToDates(portfolioData.performance, masterDates),
    capitalData: alignDataToDates(portfolioData.capitalDeployment, masterDates),
    // ... other chart data
  };
}

/**
 * Aligns data points to master date array, filling gaps with null or interpolated values
 */
function alignDataToDates(data, masterDates) {
  return masterDates.map(date => {
    const dataPoint = data.find(d => isSameDay(d.date, date));
    return dataPoint || { date, value: null }; // null gaps won't break line continuity
  });
}
```

### 2. Shared Chart Configuration Component

```javascript
// components/charts/SharedChartConfig.js

export const SHARED_CHART_CONFIG = {
  margin: { top: 10, right: 30, left: 60, bottom: 0 }, // bottom=0 for all but last
  syncId: 'portfolioCharts', // Synchronizes all charts

  // X-axis configuration (shared across all charts)
  xAxisConfig: {
    dataKey: 'date',
    type: 'category', // Use category for date strings, or 'number' for timestamps
    scale: 'band',
    tickFormatter: (date) => format(new Date(date), 'MMM dd, yyyy'),
  },

  // Tooltip configuration
  tooltipConfig: {
    shared: true,
    trigger: 'axis', // Show tooltips for all charts at same x position
  },
};

export function getChartMargin(isLastChart) {
  return {
    ...SHARED_CHART_CONFIG.margin,
    bottom: isLastChart ? 50 : 0, // Only last chart needs bottom margin for x-axis
  };
}
```

### 3. AlignedChartsContainer Component

```jsx
// components/portfolio/AlignedChartsContainer.js

import React from 'react';
import { SHARED_CHART_CONFIG } from '../charts/SharedChartConfig';
import NormalizedPriceChart from './charts/NormalizedPriceChart';
import PerformanceComparisonChart from './charts/PerformanceComparisonChart';
import CapitalDeploymentChart from './charts/CapitalDeploymentChart';

const AlignedChartsContainer = ({ chartData, parameters }) => {
  const charts = [
    { id: 'price', component: NormalizedPriceChart, title: 'Multi-Stock Price Comparison (Normalized)' },
    { id: 'performance', component: PerformanceComparisonChart, title: 'Portfolio Performance vs Buy & Hold' },
    { id: 'capital', component: CapitalDeploymentChart, title: 'Capital Deployment Over Time' },
  ];

  return (
    <div className="aligned-charts-container">
      {charts.map((chart, index) => {
        const ChartComponent = chart.component;
        const isLastChart = index === charts.length - 1;

        return (
          <div key={chart.id} className="chart-wrapper">
            <h3 className="chart-title">{chart.title}</h3>
            <ChartComponent
              data={chartData[chart.id]}
              syncId={SHARED_CHART_CONFIG.syncId}
              showXAxis={isLastChart}
              margin={getChartMargin(isLastChart)}
              xAxisConfig={SHARED_CHART_CONFIG.xAxisConfig}
            />
          </div>
        );
      })}
    </div>
  );
};

export default AlignedChartsContainer;
```

### 4. Individual Chart Component Pattern

```jsx
// components/portfolio/charts/NormalizedPriceChart.js

import React, { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const NormalizedPriceChart = ({ data, syncId, showXAxis, margin, xAxisConfig }) => {
  // Track which series are visible (for legend toggle)
  const [visibleSeries, setVisibleSeries] = useState({
    NVDA: true,
    TSLA: true,
    META: true,
    // ... all stocks
    buyOrders: true,
    sellOrders: true,
    rejectedOrders: true,
  });

  const handleLegendClick = (dataKey) => {
    setVisibleSeries(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} syncId={syncId} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" />

        {/* X-axis: only shown on last chart */}
        <XAxis
          {...xAxisConfig}
          hide={!showXAxis}
        />

        {/* Y-axis: each chart has its own */}
        <YAxis
          label={{ value: '% Change from Start', angle: -90, position: 'insideLeft' }}
        />

        {/* Synchronized tooltip across all charts */}
        <Tooltip
          content={<CustomTooltip />}
          shared={true}
          cursor={{ stroke: 'rgba(0, 0, 0, 0.1)' }}
        />

        {/* Legend with toggle functionality */}
        <Legend
          onClick={(e) => handleLegendClick(e.dataKey)}
          wrapperStyle={{ cursor: 'pointer' }}
        />

        {/* Render lines only for visible series */}
        {data.stocks.map(stock => (
          visibleSeries[stock.symbol] && (
            <Line
              key={stock.symbol}
              type="monotone"
              dataKey={`normalized_${stock.symbol}`}
              stroke={stock.color}
              dot={false}
              strokeWidth={2}
            />
          )
        ))}

        {/* Transaction markers as scatter plots */}
        {visibleSeries.buyOrders && (
          <Scatter dataKey="buyOrders" fill="green" shape="triangle" />
        )}
        {visibleSeries.sellOrders && (
          <Scatter dataKey="sellOrders" fill="blue" shape="triangle" />
        )}
        {visibleSeries.rejectedOrders && (
          <Scatter dataKey="rejectedOrders" fill="red" shape="circle" />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
};

export default NormalizedPriceChart;
```

## Data Structure Design

### Preprocessed Chart Data Format

```javascript
{
  // Master date array used by all charts
  masterDates: ['2023-01-01', '2023-01-02', ...],

  // Normalized price chart data
  price: [
    {
      date: '2023-01-01',
      normalized_NVDA: 0,      // % change from start
      normalized_TSLA: 0,
      normalized_META: 0,
      // ... other stocks
      buyOrders: [{ symbol: 'NVDA', shares: 10 }],
      sellOrders: [],
      rejectedOrders: [],
    },
    // ... one entry per date
  ],

  // Performance comparison data
  performance: [
    {
      date: '2023-01-01',
      dcaStrategy: 10000,      // Portfolio value
      buyAndHold: 10000,       // Buy & hold value
      dcaReturns: 0,           // % returns
      buyAndHoldReturns: 0,
    },
    // ... one entry per date
  ],

  // Capital deployment data
  capital: [
    {
      date: '2023-01-01',
      totalCapital: 1000,
      NVDA: 500,
      TSLA: 300,
      META: 200,
      // ... breakdown by stock
    },
    // ... one entry per date
  ],
}
```

## CSS Layout Design

```css
/* components/portfolio/AlignedChartsContainer.css */

.aligned-charts-container {
  display: flex;
  flex-direction: column;
  gap: 0; /* No gap - charts should be visually connected */
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.chart-wrapper {
  margin-bottom: 30px; /* Spacing between chart sections */
}

.chart-wrapper:last-child {
  margin-bottom: 0;
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #333;
}

.chart-subtitle {
  font-size: 12px;
  color: #666;
  margin-bottom: 15px;
}

/* Ensure all charts have same width */
.chart-wrapper .recharts-wrapper {
  margin-left: 0 !important;
  margin-right: 0 !important;
}

/* Style for synchronized cursor */
.recharts-tooltip-cursor {
  stroke: rgba(0, 0, 0, 0.1);
  stroke-width: 1px;
  stroke-dasharray: 3 3;
}
```

## Integration Points

### 1. Update PortfolioResults.js

```jsx
// Remove TotalPortfolioValueChart
// Add AlignedChartsContainer

import AlignedChartsContainer from './AlignedChartsContainer';
import { preprocessPortfolioChartData } from '../../services/chartDataProcessor';

function PortfolioResults({ portfolioData, parameters }) {
  // Preprocess data once for all charts
  const chartData = useMemo(
    () => preprocessPortfolioChartData(
      portfolioData,
      parameters.startDate,
      parameters.endDate
    ),
    [portfolioData, parameters.startDate, parameters.endDate]
  );

  return (
    <div className="portfolio-results">
      <ParametersDisplay parameters={parameters} />
      <PerformanceMetrics metrics={portfolioData.metrics} />

      {/* NEW: Aligned charts container */}
      <AlignedChartsContainer
        chartData={chartData}
        parameters={parameters}
      />

      <StockPerformanceTable stocks={portfolioData.stockResults} />
    </div>
  );
}
```

### 2. Data Flow

```
Backend API Response
  ↓
portfolioData (raw)
  ↓
preprocessPortfolioChartData() [NEW SERVICE]
  ↓
chartData (normalized with aligned dates)
  ↓
AlignedChartsContainer
  ↓
Individual Chart Components
  ↓
Recharts with syncId
```

## Edge Cases & Considerations

### 1. Different Data Availability
- Some stocks may have data gaps (holidays, halted trading)
- Solution: Use null values to maintain alignment without breaking lines

### 2. Performance with Large Datasets
- Multiple stocks over multiple years = thousands of data points
- Solution:
  - Downsample for initial render
  - Use virtualization if needed
  - Memoize processed data

### 3. Responsive Behavior
- Charts must resize together
- Solution: Use ResponsiveContainer for all charts, same width constraints

### 4. Transaction Markers Overlap
- Multiple transactions on same date can overlap
- Solution:
  - Small vertical offset for overlapping markers
  - Tooltip shows all transactions at that date

### 5. Legend Space Management
- Many stocks = long legend
- Solution:
  - Use compact legend layout
  - Consider separate legend section if needed
  - Scrollable legend for very large portfolios

## Testing Strategy

1. **Visual Alignment Test**: Verify date alignment by adding vertical gridlines
2. **Interaction Test**: Toggle legends and verify chart updates
3. **Synchronization Test**: Hover over one chart, verify cursor appears on all
4. **Data Integrity Test**: Verify no data loss during preprocessing
5. **Performance Test**: Test with large portfolio (20+ stocks, 5+ years)
6. **Responsive Test**: Test on different screen sizes
7. **Edge Case Test**: Test with stocks that have different start dates

## Success Metrics

- [ ] All charts share exact x-axis alignment (pixel-perfect)
- [ ] Legend toggles work for all interactive elements
- [ ] Hover synchronization works across all charts
- [ ] Performance: < 100ms to render all charts
- [ ] No visual jank during resize or interaction
- [ ] Maintains functionality on mobile devices
