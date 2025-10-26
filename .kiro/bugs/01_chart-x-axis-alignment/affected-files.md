# Affected Files

## Primary Files
- `frontend/src/components/portfolio/AlignedChartsContainer.js`
  - Container component that manages shared domain and ticks
  - Lines 21-47: Calculates sharedDomain and sharedTicks
  - Lines 100-105: Passes props to chart components

## Chart Components
- `frontend/src/components/portfolio/charts/DCAVsBuyAndHoldChartAligned.js`
- `frontend/src/components/portfolio/charts/PortfolioCompositionChartAligned.js`
- `frontend/src/components/portfolio/charts/MultiStockPriceChartAligned.js`
- `frontend/src/components/portfolio/charts/CapitalUtilizationChartAligned.js`

## Shared Configuration
- `frontend/src/components/charts/SharedChartConfig.js`
  - Contains `getSharedXAxisConfig()` utility function
  - Defines common x-axis configuration

## Related Code
- All chart components use Recharts library
- X-axis type is set to `"category"`
- `syncId="portfolioCharts"` applied to all charts
