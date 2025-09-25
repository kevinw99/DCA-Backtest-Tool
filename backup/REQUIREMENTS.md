# DCA Trading Platform - Comprehensive Requirements

## Project Overview
A complete Dollar Cost Averaging (DCA) trading platform with three main components:
1. **Stock Data Fetcher & Database Builder** with technical indicator calculations
2. **DCA Backtest Engine** with trailing stop-loss functionality
3. **Frontend Dashboard** displaying stock charts with buy/sell markers and technical indicators

---

## 1. STOCK DATA MANAGEMENT SYSTEM

### 1.1 Data Provider Integration
- **1.1.1** Support multiple free stock data providers
  - **1.1.1.1** YFinance (primary - unlimited free access)
  - **1.1.1.2** Alpha Vantage (fallback)
  - **1.1.1.3** Tiingo (limited to DOW 30)
  - **1.1.1.4** Financial Modeling Prep (backup)

### 1.2 Database Structure
- **1.2.1** SQLite database for local storage
- **1.2.2** Tables:
  - **1.2.2.1** `stocks` - symbol metadata
  - **1.2.2.2** `daily_prices` - OHLCV data
  - **1.2.2.3** `quarterly_fundamentals` - earnings data
  - **1.2.2.4** `corporate_actions` - splits/dividends

### 1.3 Technical Indicators
- **1.3.1** Moving Averages (MA20, MA200)
- **1.3.2** RSI (Relative Strength Index)
- **1.3.3** Volatility indicators (20-day rolling)
- **1.3.4** Bear market regime detection
- **1.3.5** Calculate on-demand vs pre-calculated storage

### 1.4 Data Validation and Auto-Population
- **1.4.1** **Automatic Stock Data Fetching**: When requesting data for a new symbol, automatically fetch from data provider
- **1.4.2** **5-Year Data Range Validation**: Enforce 5-year historical data limit for all requests
- **1.4.3** **Out-of-Range Request Handling**: Provide clear error messages for dates outside available range
- **1.4.4** **Minimum Data Requirements**: Validate sufficient data (30+ days) for reliable backtesting
- **1.4.5** **Data Availability Checks**: Verify data exists before processing requests
- **1.4.6** **Graceful Error Handling**: Provide detailed error messages with suggestions for resolution

### 1.5 API Endpoints
- **1.5.1** `GET /api/stocks/:symbol` - Get stock data with metrics and automatic data population
- **1.5.2** `GET /api/stocks` - List available stocks with autocomplete
- **1.5.3** `GET /api/metrics` - Available chart metrics
- **1.5.4** `DELETE /api/clear-all-data` - Development endpoint
- **1.5.5** `POST /api/backtest/dca` - Run DCA backtest with comprehensive validation

---

## 2. DCA BACKTEST ENGINE

### 2.1 Portfolio Structure
- **2.1.1** Maximum 5 lots per symbol
- **2.1.2** Each lot = $10,000 USD (configurable)
- **2.1.3** Grid-based buying with 10% price separation minimum

### 2.2 Daily Execution Priority Order
Daily processing follows this strict priority hierarchy:
- **2.2.1** **HIGHEST PRIORITY: Trailing Stop Sales** - Execute trailing stops first, then reset OCO orders
- **2.2.2** **SECOND PRIORITY: OCO Order Processing** - Process pending One-Cancels-the-Other orders
- **2.2.3** **LOWEST PRIORITY: Regular Grid-Based Buying** - Only when no OCO orders are pending

### 2.3 Trailing Stop-Limit System
- **2.3.1** **Activation Rules**:
  - Set stop when price > average cost AND no active stop exists AND unrealized P&L > 0
- **2.3.2** **Stop Management**:
  - **Stop Price**: current price * 0.9 (10% trailing distance)
  - **Limit Price**: targeted lot price (highest-priced lot 10% below current price)
  - **Update**: Trailing stop follows price upward, never downward
  - **Cancellation**: Cancel when current price ≤ average cost (no longer profitable)
- **2.3.3** **Execution Conditions**:
  - **Trigger**: current price ≤ stop price
  - **Execute**: only if execution price > limit price AND execution price > average cost
  - **Execution Price**: always use current close price (handles gap-down scenarios)
- **2.3.4** **Post-Sell Actions**:
  - Remove sold lots, recalculate average cost, clear active stop
  - **CRITICAL**: Reset all OCO orders with new prices based on current sell price

### 2.4 OCO (One-Cancels-the-Other) Order System
Created automatically after every trailing stop sale:
- **2.4.1** **OCO Order Types**:
  - **Limit Buy Order**: Set at 10% below the sell price
  - **Trailing Buy Order**: Market buy when price drops 10% from highest price since sell
- **2.4.2** **OCO Management Rules**:
  - **Single OCO Rule**: Only one OCO order allowed at any time
  - **Reset on Every Sale**: Each new sell cancels existing OCO and creates new one
  - **Grid Spacing Compliance**: OCO orders must respect 10% spacing from ALL existing lots
  - **Exclusivity**: When OCO orders pending, suspend ALL regular grid-based buying
- **2.4.3** **OCO Execution**:
  - Execute whichever OCO condition triggers first (limit or trailing)
  - Cancel remaining OCO order when one executes
  - Resume regular buying only after OCO orders are cleared

### 2.5 Regular Grid-Based Buying Rules
Only active when NO OCO orders are pending:
- **2.5.1** **Grid Spacing**: Buy only when current price is 10%+ away from ALL existing lot prices
- **2.5.2** **Portfolio Limits**: Maximum 5 lots per symbol, $10,000 per lot (configurable)
- **2.5.3** **Initial Purchase**: Buy first lot immediately when starting
- **2.5.4** **Technical Filters**: ALL DISABLED
  - MA20 filter: DISABLED - Buy regardless of moving average position
  - Bear market regime filter: DISABLED - Continue buying in all market conditions
  - Remaining lots loss tolerance filter: DISABLED

### 2.6 Risk Management
- **2.6.1** **Remaining Lots Loss Tolerance**: Parameter `remainingLotsUnrealizedLossTolerance` (default -0.5)
  - **2.6.1.1** **Definition**: Negative values represent loss percentages (-0.5 = 50% loss threshold)
  - **2.6.1.2** **Calculation**: Unrealized PNL ÷ Total Cost of Held Lots
  - **2.6.1.3** **Action**: Pause buying when loss percentage < tolerance threshold
  - **2.6.1.4** **Example**: -0.3 allows up to 30% loss, -0.7 allows up to 70% loss
- **2.6.2** **Remaining Lots Protection**: Ensure remaining lots after stop execution don't exceed stop-loss tolerance
- **2.6.3** **Stop Validation**: Multiple checks to prevent invalid stop prices

### 2.7 Performance Metrics
- **2.7.1** **Standard Metrics**:
  - **2.7.1.1** Total Return (absolute USD and percentage)
  - **2.7.1.2** Maximum Drawdown (absolute USD and percentage)
  - **2.7.1.3** Sharpe Ratio (risk-adjusted return)
  - **2.7.1.4** Win Rate (percentage of profitable trades)
  - **2.7.1.5** Volatility (annualized standard deviation)
  - **2.7.1.6** Total number of trades executed

- **2.7.2** **DCA-Specific Metrics**:
  - **2.7.2.1** Combined Weighted Return on Capital Deployed
  - **2.7.2.2** Average Capital Deployed (daily average of invested capital)
  - **2.7.2.3** Maximum Capital Deployed (peak investment amount)
  - **2.7.2.4** Buy-and-Hold comparison baseline

### 2.8 Data Validation and Error Handling
- **2.8.1** **Backtest Parameter Validation**: Comprehensive validation of all input parameters
- **2.8.2** **Date Range Validation**: Enforce 5-year data limit and logical date ordering
- **2.8.3** **Data Availability Checks**: Verify sufficient data exists for requested backtest period
- **2.8.4** **Minimum Data Requirements**: Require minimum 30 trading days for reliable backtesting
- **2.8.5** **Auto-Population for New Symbols**: Automatically fetch data when backtesting new symbols
- **2.8.6** **Error Response Standards**: Structured error responses with actionable suggestions

### 2.9 API Integration
- **2.9.1** `POST /api/backtest/dca` - Run backtest with comprehensive validation and auto-population
- **2.9.2** Command-line interface via `backtest_dca_optimized.js`
- **2.9.3** Results consistency between UI and CLI
- **2.9.4** Automatic stock data creation and fetching for new symbols

---

## 3. FRONTEND DASHBOARD

### 3.1 Backtest Configuration
- **3.1.1** Parameter input form:
  - **3.1.1.1** Symbol selection with autocomplete
  - **3.1.1.2** Start/End date pickers
  - **3.1.1.3** Lot size ($10,000 default)
  - **3.1.1.4** Maximum lots (5 default)
  - **3.1.1.5** Grid interval percentage (10% default)
  - **3.1.1.6** Remaining lots loss tolerance (5% default) - for stop-loss mechanism
  - **3.1.1.7** Remaining lots unrealized loss tolerance (50% default) - for buying pause

### 3.2 Chart Visualization
- **3.2.1** **Primary Chart**: Stock price with buy/sell markers
  - **3.2.1.1** Candlestick or line chart options
  - **3.2.1.2** Buy markers (green) at purchase points
  - **3.2.1.3** Sell markers (red) at stop-limit executions
  - **3.2.1.4** Active stop-loss levels overlay

- **3.2.2** **Technical Indicators Overlay**:
  - **3.2.2.1** Moving averages (MA20, MA200)
  - **3.2.2.2** RSI subplot
  - **3.2.2.3** Volatility indicators
  - **3.2.2.4** Volume bars

- **3.2.3** **Chart Views**:
  - **3.2.3.1** Backtest period view (focused)
  - **3.2.3.2** All available data view (with zoom capability)
  - **3.2.3.3** Preceding time period for indicator calculation

### 3.3 Results Display
- **3.3.1** **Summary Metrics Panel**:
  - **3.3.1.1** Total return and percentage
  - **3.3.1.2** Maximum drawdown
  - **3.3.1.3** Sharpe ratio and win rate
  - **3.3.1.4** Number of trades executed

- **3.3.2** **Transaction History**:
  - **3.3.2.1** Chronological list of all trades
  - **3.3.2.2** Buy/sell prices and dates
  - **3.3.2.3** P&L per transaction
  - **3.3.2.4** Running portfolio value

- **3.3.3** **Portfolio Evolution**:
  - **3.3.3.1** Daily portfolio value chart
  - **3.3.3.2** Cash vs invested capital over time
  - **3.3.3.3** Number of lots held timeline

### 3.4 User Interface
- **3.4.1** Responsive React.js frontend
- **3.4.2** Real-time form validation
- **3.4.3** Loading states during backtest execution
- **3.4.4** Error handling and user feedback
- **3.4.5** Export functionality for results

---

## 4. SYSTEM ARCHITECTURE

### 4.1 Backend (Node.js/Express)
- **4.1.1** RESTful API design
- **4.1.2** SQLite database integration
- **4.1.3** Python subprocess for YFinance integration
- **4.1.4** Shared DCA backtest service
- **4.1.5** CORS configuration for frontend

### 4.2 Frontend (React.js)
- **4.2.1** Modern React with hooks
- **4.2.2** Chart.js or D3.js for visualizations
- **4.2.3** Responsive CSS design
- **4.2.4** State management for backtest data

### 4.3 Development Tools
- **4.3.1** Server restart script (`restart_server.sh`)
- **4.3.2** Strategy comparison utilities
- **4.3.3** Command-line backtest runner
- **4.3.4** Git repository with proper .gitignore

### 4.4 Deployment
- **4.4.1** Backend on port 3001
- **4.4.2** Frontend on port 3000
- **4.4.3** Development server management
- **4.4.4** Environment variable configuration

---

## 5. DATA REQUIREMENTS

### 5.1 Stock Data Format
```json
{
  "date": "YYYY-MM-DD",
  "open": number,
  "high": number,
  "low": number,
  "close": number,
  "adjusted_close": number,
  "volume": number
}
```

### 5.2 Backtest Configuration
```javascript
{
  "symbol": "TSLA",
  "startDate": "2021-11-01",
  "endDate": "2023-11-01",
  "lotSizeUsd": 10000,
  "maxLots": 5,
  "gridIntervalPercent": 0.10,
  "remainingLotsLossTolerance": 0.05,
  "remainingLotsUnrealizedLossTolerance": -0.5
}
```

### 5.3 Response Format
```json
{
  "summary": {
    "totalReturn": number,
    "totalReturnPercent": number,
    "maxDrawdown": number,
    "sharpeRatio": number,
    "winRate": number,
    "totalTrades": number
  },
  "transactions": [...],
  "dailyValues": [...],
  "lots": [...]
}
```

---

## 6. QUALITY ASSURANCE

### 6.1 Testing Requirements
- **6.1.1** CLI vs UI result consistency verification
- **6.1.2** Multiple stock symbol testing
- **6.1.3** Edge case handling (market gaps, holidays)
- **6.1.4** Performance testing with large datasets

### 6.2 Validation
- **6.2.1** Transaction log accuracy
- **6.2.2** P&L calculation verification
- **6.2.3** Stop-limit execution logic
- **6.2.4** Technical indicator correctness

### 6.3 Error Handling and Data Validation
- **6.3.1** **API Failure Graceful Degradation**: Continue with cached data when provider fails
- **6.3.2** **Database Connection Error Recovery**: Automatic reconnection and error reporting
- **6.3.3** **Comprehensive Parameter Validation**: Validate all input parameters with detailed error messages
- **6.3.4** **Data Availability Checks**: Pre-validate data existence before processing
- **6.3.5** **Date Range Validation**: Enforce 5-year limit and logical date constraints
- **6.3.6** **Symbol Validation**: Verify symbol exists and can be fetched from data providers
- **6.3.7** **Minimum Data Requirements**: Ensure sufficient data for reliable analysis
- **6.3.8** **Structured Error Responses**: Consistent error format with actionable suggestions
- **6.3.9** **Auto-Recovery Mechanisms**: Automatically fetch missing data when possible

---

### 6.4 Data Management Improvements
- **6.4.1** **Automatic Stock Discovery**: Auto-populate database when new symbols are requested
- **6.4.2** **Intelligent Data Fetching**: Only fetch missing data segments to optimize API usage
- **6.4.3** **Data Quality Monitoring**: Track and report data completeness and quality metrics
- **6.4.4** **Provider Failover**: Automatically switch providers when primary source fails
- **6.4.5** **Cache Management**: Intelligent caching with expiration and refresh strategies
- **6.4.6** **Data Range Optimization**: Provide optimal date range suggestions based on available data

## 7. FUTURE ENHANCEMENTS

### 7.1 Strategy Improvements (from DCA_STRATEGY_IMPROVEMENTS.md)
- **7.1.1** Enhanced stop-loss with market orders for gaps
- **7.1.2** Portfolio-level risk management (50% max drawdown)
- **7.1.3** Volatility filters and market regime detection
- **7.1.4** Dynamic position sizing based on market conditions
- **7.1.5** Multi-timeframe analysis integration

### 7.2 Additional Features
- **7.2.1** Multiple strategy comparison
- **7.2.2** Parameter optimization tools
- **7.2.3** Real-time trading integration
- **7.2.4** Portfolio management for multiple symbols
- **7.2.5** Advanced charting with drawing tools