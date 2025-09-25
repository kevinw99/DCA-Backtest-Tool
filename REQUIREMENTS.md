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
- **2.2.1** **HIGHEST PRIORITY: Trailing Stop Sales** - Execute trailing stop sell orders first
- **2.2.2** **SECOND PRIORITY: Trailing Stop Limit Buy Management** - Process trailing stop limit buy orders in this sequence:
  - **2.2.2.1** **Cancellation Check**: Cancel orders where current price > limit price (exceeds original peak)
  - **2.2.2.2** **Execution Check**: Execute orders where current price ≥ stop price AND ≤ limit price
  - **2.2.2.3** **Activation Check**: Create new orders when price drops 10% from recent peak (if no active order)
  - **2.2.2.4** **Update Check**: Adjust stop price downward when active order exists and price continues falling
- **2.2.3** **NO REGULAR BUYING** - All purchases are exclusively through trailing stop limit buy orders

### 2.3 Trailing Stop Sell System
- **2.3.1** **Activation Conditions**:
  - **Trigger**: Price rises by `trailingSellActivationPercent` (default 20%) from recent bottom
  - **Recent Bottom Definition**: Lowest price observed after the last buy or sell transaction
- **2.3.2** **Stop Management**:
  - **Initial Stop Price**: current price * (1 - `trailingSellPullbackPercent`) (default 10% below current price)
  - **Limit Price**: targeted lot price (highest-priced eligible lot)
  - **Lot Selection**: Select highest-priced eligible lots that meet profit requirement
  - **Trailing Logic**: If price goes up further, stop price adjusts upward to maintain `trailingSellPullbackPercent` below current price
  - **No Downward Adjustment**: If price goes down, stop price remains fixed
  - **Cancellation**: Cancel when current price ≤ average cost * (1 + `profitRequirement`) (no longer meets profit requirement)
- **2.3.3** **Execution Conditions**:
  - **Trigger**: current price ≤ stop price
  - **Execute**: only if execution price > limit price AND execution price > average cost * (1 + `profitRequirement`)
  - **Execution Price**: always use current close price
- **2.3.4** **Post-Sell Actions**:
  - Remove sold lots, recalculate average cost, clear active stop
  - Reset trailing buy system state

### 2.4 Trailing Stop Limit Buy System
- **2.4.1** **Activation Conditions**:
  - **Trigger**: Price drops by `trailingBuyActivationPercent` (default 10%) from recent peak
  - **Recent Peak Definition**: Highest price observed after the last buy or sell transaction
- **2.4.2** **Order Structure** (Trailing Stop Limit Buy):
  - **Limit Price**: Set to the original peak price (maximum buy price)
  - **Initial Stop Price**: current price * (1 + `trailingBuyReboundPercent`) (default 5% above current price)
  - **Order Type**: Trailing stop limit order (NOT market order)
- **2.4.3** **Trailing Logic**:
  - **Downward Adjustment**: If price goes down further, stop price adjusts downward to maintain `trailingBuyReboundPercent` above current price
  - **No Upward Adjustment**: If price goes up, stop price remains fixed
  - **Execution Trigger**: Buy when current price ≥ stop price
  - **Execution Condition**: Execute ONLY if execution price ≤ limit price (original peak)
- **2.4.4** **Cancellation Logic**:
  - **Auto-Cancel**: Order cancelled when current price > limit price (exceeds original peak)
  - **Re-activation**: After cancellation, new order can be created when activation conditions are met again
  - **Prevents Invalid Execution**: Ensures buy price never exceeds the original peak reference
- **2.4.5** **Execution Conditions**:
  - **Price Validation**: Execution price must be ≤ limit price (original peak)
  - **Grid Spacing**: Must respect `gridIntervalPercent` spacing from ALL existing lots
  - **Portfolio Limits**: Must not exceed maximum lot count
  - **Limit Order**: Execute at current market price only if within limit constraints

### 2.5 Buying Rules Summary
- **2.5.1** **EXCLUSIVE TRAILING STOP LIMIT BUYING**: All purchases are made exclusively through trailing stop limit buy orders
- **2.5.2** **NO REGULAR GRID BUYING**: Traditional grid-based buying is completely removed
- **2.5.3** **NO INITIAL PURCHASE**: No automatic first lot - must wait for trailing stop limit buy trigger
- **2.5.4** **Portfolio Limits**: Maximum 5 lots per symbol, $10,000 per lot (configurable)
- **2.5.5** **Grid Spacing**: Trailing stop limit buys must still respect 10% spacing from existing lots
- **2.5.6** **Price Protection**: Limit price prevents execution above original peak reference price

### 2.6 Risk Management
- **2.6.1** **Profit Requirement**: Parameter `profitRequirement` (default 0.05 = 5% profit requirement)
  - **2.6.1.1** **Definition**: Positive values represent minimum profit percentages required for selling
  - **2.6.1.2** **Calculation**: Execution must exceed average cost * (1 + profitRequirement)
  - **2.6.1.3** **Action**: Only execute sells when profit requirement is met
  - **2.6.1.4** **Example**: 0.05 requires 5% profit, 0.1 requires 10% profit
- **2.6.2** **Grid Spacing Protection**: Ensure adequate spacing between lot purchase prices
- **2.6.3** **Stop Validation**: Multiple checks to prevent invalid stop prices

### 2.7 Performance Metrics
- **2.7.1** **Standard Metrics**:
  - **2.7.1.1** Total Return (absolute USD and percentage)
  - **2.7.1.2** Annualized Return (portfolio-level): (1 + total return) ^ (365 / total days) - 1
  - **2.7.1.3** Maximum Drawdown (absolute USD and percentage)
  - **2.7.1.4** Sharpe Ratio (risk-adjusted return)
  - **2.7.1.5** Win Rate (percentage of profitable trades)
  - **2.7.1.6** Volatility (annualized standard deviation)
  - **2.7.1.7** Total number of trades executed

- **2.7.2** **DCA-Specific Metrics**:
  - **2.7.2.1** Combined Weighted Return on Capital Deployed
  - **2.7.2.2** Average Capital Deployed (daily average of invested capital)
  - **2.7.2.3** Maximum Capital Deployed (peak investment amount)
  - **2.7.2.4** Buy-and-Hold comparison baseline with annualized return

- **2.7.3** **Trade-Level Annualized Return Analysis**:
  - **2.7.3.1** Individual trade annualized return: (1 + trade return) ^ (365 / backtest days) - 1
  - **2.7.3.2** Average annualized return across all trades
  - **2.7.3.3** Trade-by-trade return analysis with buy/sell dates and prices
  - **2.7.3.4** Comparison of average trade annualized return vs buy-and-hold annualized return

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

### 2.10 Questionable Events Detection System
- **2.10.1** **Purpose**: Monitor and flag potentially problematic trading scenarios during backtesting
- **2.10.2** **Same-Day Sell/Buy Detection**:
  - **Detection Logic**: Flag when both trailing stop sell and trailing stop buy orders execute on the same trading day
  - **Rationale**: Same-day execution of both order types may indicate:
    - Algorithm instability or oscillation
    - Inappropriate parameter settings
    - Market volatility exceeding strategy assumptions
    - Potential loss of intended strategy behavior
- **2.10.3** **Event Data Structure**:
  - **Date**: Trading date when event occurred
  - **Event Type**: Category of questionable behavior (e.g., "SAME_DAY_SELL_BUY")
  - **Description**: Human-readable explanation of the detected issue
  - **Severity**: Risk level classification ("WARNING", "ERROR")
- **2.10.4** **Implementation**:
  - **Backend**: Events tracked in `questionableEvents` array and logged during backtest execution
  - **Frontend**: Dedicated "Questionable Events" section displayed before transaction history
  - **Console Output**: Events listed in backtest summary when verbose logging enabled
- **2.10.5** **User Benefits**:
  - **Strategy Validation**: Identify when trading logic may be working incorrectly
  - **Parameter Tuning**: Discover parameter combinations that lead to unstable behavior
  - **Risk Assessment**: Understand potential issues with strategy implementation

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
  "maxLots": 10,
  "maxLotsToSell": 1,
  "gridIntervalPercent": 0.10,
  "profitRequirement": 0.05,
  "trailingBuyActivationPercent": 0.10,
  "trailingBuyReboundPercent": 0.05,
  "trailingSellActivationPercent": 0.20,
  "trailingSellPullbackPercent": 0.10
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
- **7.2.2** ✅ **IMPLEMENTED**: Parameter optimization tools (Batch Testing Engine)
- **7.2.3** Real-time trading integration
- **7.2.4** Portfolio management for multiple symbols
- **7.2.5** Advanced charting with drawing tools

---

## 8. BATCH OPTIMIZATION ENGINE (IMPLEMENTED)

### 8.1 Overview
The Batch Optimization Engine allows users to run multiple DCA backtests with different parameter combinations to identify optimal settings for maximum returns.

### 8.2 Core Features

#### 8.2.1 Parameter Optimization
- **Multi-Stock Testing**: Test across 16 predefined stocks (TSLA, NVDA, AAPL, MSFT, AMZN, PLTR, U, META, SHOP, TDOC, JD, BABA, LMND, NIO, KNDI, API)
- **Parameter Ranges**:
  - `profitRequirement`: 0-50% in 5% intervals (default: 5%)
  - `gridIntervalPercent`: 5-20% in 5% intervals (default: 10%)
  - `trailingBuyActivationPercent`: 5-20% in 5% intervals (default: 10%)
  - `trailingBuyReboundPercent`: 0-10% in 5% intervals (default: 5%)
  - `trailingSellActivationPercent`: 10-50% in 10% intervals (default: 20%)
  - `trailingSellPullbackPercent`: 0-10% in 5% intervals (default: 10%)

#### 8.2.2 Fixed Parameters
- `lotSizeUsd`: $10,000
- `maxLots`: 10
- `startDate`: 2021-09-01
- `endDate`: 2025-09-01

### 8.3 User Interface Components

#### 8.3.1 Mode Selection
- **Single Backtest Mode**: Test one specific parameter combination
- **Batch Optimization Mode**: Test multiple parameter combinations

#### 8.3.2 Parameter Configuration
- **Single Mode**: Individual input fields for each parameter
- **Batch Mode**: Checkbox grids for selecting parameter ranges
- **Symbol Selection**: Multi-select checkboxes for stock symbols
- **Combination Counter**: Real-time display of total combinations

#### 8.3.3 Results Display
Three main tabs:
1. **Parameters**: Input configuration
2. **Chart & Analysis**: Single backtest visualization (single mode only)
3. **Batch Results**: Comprehensive optimization results (batch mode only)

### 8.4 Batch Results Report

#### 8.4.1 Executive Summary
- **Overall Statistics**: Average returns, win rates across all tests
- **Execution Metrics**: Success/failure rates, processing time
- **Best Overall Performance**: Top-performing parameter combination

#### 8.4.2 Best Parameters by Stock
For each tested stock:
- **Best for Total Return**: Parameters yielding highest total return
- **Best for Annualized Return**: Parameters yielding highest annualized return
- **Performance Comparison**: Side-by-side comparison of both approaches

#### 8.4.3 Detailed Results Table
Sortable table showing all results with:
- **Performance Metrics**:
  - Total Return (calculated as: (Final Value - Initial Investment) / Initial Investment)
  - Annualized Return (calculated as: (1 + Total Return)^(365/Days) - 1)
  - Total number of buy and sell trades
  - Win Rate (profitable trades / total trades)
  - Average profit per trade
  - Maximum drawdown (peak-to-trough decline)
  - Capital utilization rate (average deployed / total available)

- **Parameter Details**: All tested parameter combinations
- **Stock Filtering**: Filter results by specific stocks
- **Top Results Highlighting**: Visual emphasis on best-performing combinations

#### 8.4.4 Metrics Explanation
Comprehensive documentation of how each metric is calculated:
- **Total Return**: (Final Portfolio Value - Initial Investment) / Initial Investment
- **Annualized Return**: (1 + Total Return)^(365 / Days in Period) - 1
- **Win Rate**: Number of profitable trades / Total number of trades
- **Capital Utilization**: Average capital deployed / Total available capital
- **Maximum Drawdown**: Largest peak-to-trough decline in portfolio value

### 8.5 Technical Implementation

#### 8.5.1 Backend Services
- **`batchBacktestService.js`**: Core batch processing engine
- **Parameter Generation**: Automatic combination generation
- **Progress Tracking**: Real-time progress monitoring
- **Error Handling**: Individual test failure isolation
- **Performance Metrics**: Comprehensive calculation suite

#### 8.5.2 API Endpoints
- **`POST /api/backtest/batch`**: Execute batch optimization
- **Request Format**: Parameter ranges and options
- **Response Format**: Complete results with summary statistics

#### 8.5.3 Frontend Components
- **`DCABacktestForm.js`**: Enhanced form with batch mode support
- **`BatchResults.js`**: Comprehensive results visualization
- **`App.js`**: Mode management and routing
- **CSS Styling**: Complete UI styling for batch features

### 8.6 Performance Characteristics
- **Parallel Processing**: Multiple backtests run concurrently
- **Memory Efficient**: Optimized for large parameter spaces
- **Progress Reporting**: Real-time status updates
- **Error Resilience**: Continue processing despite individual failures
- **Result Caching**: Efficient data handling for large result sets

### 8.7 Usage Workflow
1. **Select Batch Mode**: Choose "Batch Optimization" in mode selection
2. **Configure Stocks**: Select one or more stocks to test
3. **Set Parameter Ranges**: Choose parameter values using checkboxes
4. **Review Combinations**: Check total combination count
5. **Execute Batch**: Start optimization process
6. **Analyze Results**: Review comprehensive report
7. **Identify Optimal Parameters**: Use best parameters for single backtests

This implementation provides users with powerful optimization capabilities to find the best DCA strategy parameters for their specific needs and market conditions.