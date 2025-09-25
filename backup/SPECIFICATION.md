# Stock Trading Web Application - Specification Document

## Project Overview
A comprehensive stock trading web application focused on earnings analysis and fundamental metrics visualization, with emphasis on Year-over-Year (YoY) quarterly growth analysis and earnings surprises correlation. The application provides professional, synchronized charts for financial analysis with advanced UX features for correlation analysis.

## Core Requirements

### 1. Chart System Architecture
- **Synchronized time axes**: All charts share the same time axis for proper vertical alignment
- **Stacked chart layout**: Multiple metric charts stacked vertically, all sharing the same x-axis (time)
- **Modular chart system**: User-selectable metrics from a predefined list
- **Interactive timeline**: Unified time navigation across all charts

#### 1.1 Default Metrics (8 core metrics shown by default)
- Stock Price (line chart, smooth)
- Quarterly Revenue (line chart)
- Earnings Surprises (line chart with dual datasets: "Profit Surprise" and "Revenue Surprise")
- YoY Quarterly Revenue Growth (line chart)
- TTM Net EPS (Trailing Twelve Months Earnings Per Share, line chart)
- P/E Ratio (Price-to-Earnings, line chart)
- Gross Margin (line chart)
- Operating Margin (line chart)
- Net Margin (line chart)

#### 1.2 Available Metrics Library (user can add)
- Additional financial ratios
- Volume metrics
- Trading Volume (bar chart)
- YoY EPS Growth (bar chart)
- Other fundamental analysis metrics

#### 1.3 User Customization
- Add/remove metrics from the chart view
- Reorder metric charts
- Save preferred metric configurations
- Show/hide specific metrics via metrics selector

### 2. Price Chart Behavior (Critical UX Requirement)
- **Smart sticky positioning**: Price chart scrolls normally until it reaches the top of viewport, then becomes sticky
- **Never out of view**: Once sticky, price chart remains visible for correlation analysis
- **Space optimization**: Users can scroll past headers/controls first, maximizing chart viewing area
- **Correlation reference**: Other charts scroll underneath the fixed price chart for easy comparison
- **Smooth transitions**: Seamless transition from normal scroll to sticky behavior

### 3. Chart Alignment and Visual Requirements
- **Vertical date axis alignment**: All charts must have date markers aligned vertically
- **Consistent time scale**: Quarterly intervals with standardized formatting (`MMM yyyy`)
- **Earnings surprise labels**: "Profit Surprise" and "Revenue Surprise" (not "EPS Surprise")
- **Chart type consistency**: Line charts for all data types to represent specific report dates
- **Color coding**: Consistent color scheme across metrics (purple for profit, blue for revenue, etc.)
- **YoY calculation accuracy**: True year-over-year growth comparing same fiscal quarters across different years (Q1 2024 vs Q1 2023)
- **Professional styling**: Clean, modern appearance with proper spacing and typography

### 4. Stock Data Features & User Interaction

#### 4.1 Stock Selection
- **Search functionality**: Ticker symbol or company name search
- **Popular stock shortcuts**: One-click selection (NVDA, AAPL, MSFT, GOOGL, AMZN, TSLA, META, NFLX)
- **Auto-load charts**: Display default metrics immediately without additional clicks
- **Error handling**: Clear feedback for invalid symbols or API failures
- **Compare functionality**: Future support for multi-stock comparison

#### 4.2 Time Range Controls
- **Quick zoom options**: 1Y, 2Y, 3Y, 5Y, All time range selection
- **Date range selectors**: From/To date pickers for custom ranges
- **Default view**: 2Y selected by default for optimal analysis balance
- **Synchronized navigation**: All charts update together when time range changes

#### 4.3 Corporate Actions Handling
- **Stock splits detection**: Automatic detection and adjustment
- **Split-adjusted price continuity**: Accurate trend analysis across splits
- **Historical price normalization**: Retroactive adjustments for seamless charts
- **Split ratio tracking**: Display split information with ratios and dates
- **Visual indicators**: Lightning bolt indicators on charts for split events

### 5. Data Sources & API Architecture

#### 5.1 Primary Data Provider - Financial Modeling Prep (FMP)
- **Real-time/Near real-time** stock prices with 5+ years historical data
- **API Configuration**:
  ```
  Environment: DATA_PROVIDER=fmp
  API Key: FMP_API_KEY=<key>
  Rate Limits: 500 requests/day, 5 requests/minute
  ```
- **Core Endpoints**:
  - Daily prices: `/v3/historical-price-full/{symbol}`
  - Quarterly fundamentals: `/v3/income-statement/{symbol}?period=quarter`
  - Earnings calendar: `/v3/historical/earning_calendar/{symbol}` (contains actual vs estimated data)
  - Analyst estimates: `/v3/analyst-estimates/{symbol}?period=quarter`
  - Stock splits: `/v3/historical-price-full/stock_split/{symbol}`

#### 5.2 Data Requirements
- **No sample data**: All data must be real, fetched from APIs
- **5-year historical data**: Default data range for comprehensive analysis
- **Data frequency**: Daily for prices, Quarterly for fundamentals
- **Data freshness**: Check if data is current (within 1 day)

#### 5.3 Core Data Types
- **Daily Prices**: OHLCV data with split adjustments
- **Quarterly Fundamentals**: Revenue, EPS, margins, growth metrics
- **Earnings Surprises**: Actual vs estimated EPS and revenue with percentage differences
- **Corporate Actions**: Stock splits with adjustment factors
- **Earnings Calendar**: Report dates for proper timeline plotting

#### 5.4 Data Processing Rules
- **Quarterly filtering**: Include all quarters with actual fundamental data and reported dates (companies have different fiscal years)
- **Report date plotting**: Use actual earnings report dates, not fiscal period end dates
- **YoY Growth Calculation**: Manual calculation since FMP provides sequential growth, not true year-over-year
- **Earnings Surprises**: Calculated from earnings calendar data (actual vs estimated EPS and revenue)
- **Split Adjustment**: FMP prices are already split-adjusted, no additional adjustment needed
- **Force Refresh**: Development feature to invalidate cached data and fetch fresh data from API
- **Deduplication**: Remove duplicate quarterly records by fiscal_date_ending
- **Split adjustment**: Retroactive price adjustments for continuous price charts

#### 5.5 Alternative API Options (Future Considerations)
- **Alpha Vantage**: 
  - Daily prices: `TIME_SERIES_DAILY` with date ranges
  - Earnings: `EARNINGS` endpoint for quarterly data
  - Rate limits: 25 requests/day free tier
- **IEX Cloud**: **DISCONTINUED** (shut down August 31, 2024)
- **Polygon.io**: 
  - Aggregates: `/v2/aggs/ticker/{symbol}/range/1/day/{from}/{to}`
  - Financials: `/vX/reference/financials/{ticker}`
- **Twelve Data**: Backup option with 800 requests/day

### 6. Technical Architecture

#### 6.1 Backend (Node.js/Express)
- **Provider pattern**: Switchable data providers via environment variables
- **SQLite database**: Local storage for daily_prices, quarterly_fundamentals, corporate_actions
- **Service layer**: stockDataService.js with provider abstraction
- **Error handling**: Comprehensive logging and graceful API failure handling
- **API endpoints**: RESTful API for stock data retrieval and updates

#### 6.2 Frontend (React)
- **Chart.js integration**: Professional chart rendering with date-fns adapter
- **Component architecture**: Modular ChartContainer, Dashboard, StockSearch components
- **State management**: React hooks for stock selection and metric visibility
- **Responsive design**: Mobile-friendly layouts with CSS Grid/Flexbox
- **Interactive charts**: Professional visualizations with Chart.js and TradingView-style UX

#### 6.3 Data Management Strategy

##### Option A: Database + API Layer (Current Implementation)
- **Database**: SQLite for historical and current stock data
  - Tables: stocks, daily_prices, quarterly_fundamentals, corporate_actions
- **API Server**: Node.js/Express backend
- **Data Pipeline**: On-demand updates when stock is requested
- **Pros**: Fast queries, reduced API costs, historical analysis
- **Cons**: Local storage dependency

##### Option B: Hybrid Approach (Future Consideration)
- **Core Data**: Database for frequently requested stocks
- **On-demand**: Direct API calls for rarely requested stocks
- **Smart Caching**: Popular stocks cached longer, obscure stocks fetched fresh

#### 6.4 Data Update Strategy

##### Incremental Data Fetching
- **Price Data**: Request only missing days (e.g., if 7 days old, fetch last 7 days)
- **Fundamental Data**: Check for new earnings reports or quarterly updates
- **API Efficiency**: Minimize calls by fetching only what's needed

##### Data Types & Update Frequency
- **Daily Price Data**: Missing days fetched incrementally
- **Quarterly Fundamentals** (EPS, Revenue, P/E): Check for new earnings releases
- **Real-time Events**: New earnings reports trigger fundamental data updates

##### User Interaction Flow
1. **Stock Symbol Entry**: User enters stock symbol (e.g., "MSFT")
2. **Data Freshness Check**: System checks if it has current data (within 1 day)
3. **Display or Fetch**:
   - If fresh data exists: Display charts immediately with default metrics
   - If no data or stale data: Make incremental API request, then display
4. **Chart Display**: Show synchronized charts with default metrics
5. **Metric Customization**: User can add/remove additional metrics as needed

### 7. User Experience Requirements

#### 7.1 Interactive Features
- **Earnings thumbnails**: Clickable "E" markers on price chart showing earnings reports
- **Earnings modal**: Detailed earnings information with actual/estimated/surprise data
- **Metric selector**: Toggle visibility of different chart metrics with "Show Options" button
- **Responsive interactions**: Smooth hover effects and click feedback

#### 7.2 Chart Interaction
- **Tooltip information**: Formatted values with appropriate units ($, %, M)
- **Split indicators**: Visual markers and information for stock splits (lightning bolt icons)
- **Synchronized tooltips**: Hovering shows data across aligned time axes
- **Mobile responsive**: Touch-friendly interactions on mobile devices
- **Chart legends**: Clear labeling with data point counts and chart types

### 8. Performance Requirements
- **Load time**: Initial chart display within 3 seconds of stock selection
- **API efficiency**: Batch API calls where possible, intelligent caching
- **Memory management**: Efficient data filtering and processing
- **Error recovery**: Graceful handling of rate limits and API timeouts
- **Rate limiting**: Handle FMP's 500 requests/day, 5 requests/minute limits

### 9. Data Quality Standards
- **Accuracy**: Real financial data from verified sources (no sample data)
- **Completeness**: Handle missing data gracefully with "N/A" indicators
- **Consistency**: Uniform date formats and value presentations
- **Validation**: Input validation for stock symbols and API responses
- **Data integrity**: Proper quarterly filtering and deduplication

### 10. Implementation Status & Recent Updates

#### 10.1 Chart Layout Optimization (Critical UX Enhancement)
- **Problem**: Price chart was initially fixed at top, wasting vertical space
- **Solution**: Implemented smart sticky positioning that allows initial scrolling past headers
- **Behavior**: Price chart scrolls normally until reaching viewport top, then becomes sticky
- **Benefit**: Maximizes screen real estate while maintaining correlation functionality
- **Technical fix**: Removed `overflow: hidden` from dashboard, added proper sticky CSS

#### 10.2 Earnings Surprise Enhancement
- **Label correction**: Changed "EPS Surprise" to "Profit Surprise" for clarity
- **Dual metrics**: Display both profit and revenue surprises in same chart
- **Color coding**: Purple for profit surprise, blue for revenue surprise
- **Data integrity**: Process surprises from earnings calendar data, not just quarterly fundamentals

#### 10.3 Data Provider Implementation
- **Primary Provider**: Financial Modeling Prep (FMP) successfully implemented
- **Provider Pattern**: Switchable architecture allows future provider additions
- **Data Quality**: Real earnings data with **FMP's pre-calculated surprise data**
- **API Integration**: Comprehensive endpoints for prices, fundamentals, calendar, estimates, and earnings surprises
- **Earnings Surprises**: Using FMP's dedicated `/v3/earnings-surprises/{symbol}` endpoint instead of manual calculations

### 11. Technical Considerations
- **Web-based application**: React frontend, Node.js/Express backend
- **Interactive charts**: Chart.js with date-fns adapter for professional visualizations
- **Responsive design**: Mobile-first approach with CSS Grid/Flexbox
- **API rate limiting**: Intelligent caching strategy for cost optimization
- **Cross-browser compatibility**: Modern browser support with graceful degradation

### 12. Business & Compliance Considerations
- **API Cost Management**: Monitor usage to stay within FMP limits
- **Data Accuracy**: Financial data from verified, professional sources
- **No compliance requirements**: Informational use, not trading advice
- **Budget considerations**: Free-tier APIs for development, paid tiers for production

### 13. Future Roadmap
- **User authentication**: Portfolio management and saved configurations
- **Additional metrics**: More fundamental analysis ratios and technical indicators
- **Export capabilities**: PDF/CSV export for analysis reports
- **Multi-stock comparison**: Side-by-side analysis of multiple stocks
- **Mobile app**: Native iOS/Android applications
- **Alerts system**: Price and earnings announcement notifications
- **Advanced analytics**: Predictive modeling and trend analysis

### 14. Questions & Discovery Items
- ✅ **Data sources evaluated**: FMP selected as primary provider
- ✅ **Real-time requirements**: 15-minute delay acceptable, daily updates sufficient
- ✅ **Chart alignment**: Vertical date axis alignment implemented
- ✅ **Sticky behavior**: Smart scrolling with space optimization
- **Budget constraints**: Monitor API usage and costs
- **Compliance needs**: Informational use only, no trading functionality

---

**Document Status**: Living specification - updated continuously with new requirements  
**Maintainer**: Development team  
**Last Updated**: 2025-07-26  
**Version**: 2.0 (Major update: merged original SPEC.md with implementation details)