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

### 1.4 API Endpoints
- **1.4.1** `GET /api/stocks/:symbol` - Get stock data with metrics
- **1.4.2** `GET /api/stocks` - List available stocks with autocomplete
- **1.4.3** `GET /api/metrics` - Available chart metrics
- **1.4.4** `DELETE /api/clear-all-data` - Development endpoint

---

## 2. DCA BACKTEST ENGINE

### 2.1 Portfolio Structure
- **2.1.1** Maximum 5 lots per symbol
- **2.1.2** Each lot = $10,000 USD (configurable)
- **2.1.3** Grid-based buying with 10% price separation minimum

### 2.2 Buying Rules
- **2.2.1** **Initial Purchase**: Buy first lot immediately when starting
- **2.2.2** **Grid-Based Buying**: Buy additional lots only when current price is 10%+ away from ALL existing lot prices
- **2.2.3** **Post-Stop Recovery**: After stop-limit execution, allow buying when price recovers above the trigger price that caused the stop
- **2.2.4** **Technical Filters**:
  - **2.2.4.1** MA20 filter: Only buy when above 20-day moving average
  - **2.2.4.2** Bear market regime filter: Pause buying in extended downtrends

### 2.3 Stop-Limit Mechanism
- **2.3.1** **Activation**: Set stop when price > average cost AND no active stop exists
- **2.3.2** **Batch Selection**: Always sell the 2 highest-priced lots
- **2.3.3** **Limit Price**: Set at 95% of the batch's weighted average cost
- **2.3.4** **Stop Price**: Max(limit price, current price - 10% of initial price)
- **2.3.5** **Stop Validation**: Stop must be > 95% of limit price, < current price, and ≤ 95% of current price
- **2.3.6** **Remaining Lots Compliance**: Must have ≤5% loss tolerance

### 2.4 Execution Rules
- **2.4.1** Daily price evaluation and action execution
- **2.4.2** **Trigger**: Execute when current price ≤ stop price
- **2.4.3** **Condition**: Only execute if execution price > limit price
- **2.4.4** **Post-Execution**: Remove sold lots, recalculate average cost, clear active stop
- **2.4.5** Transaction logging with detailed P&L tracking

### 2.5 Risk Management
- **2.5.1** **Remaining Lots Protection**: Ensure remaining lots after stop execution don't exceed 5% loss
- **2.5.2** **Stop Validation**: Multiple checks to prevent invalid stop prices
- **2.5.3** **Recovery Logic**: Smart re-entry based on market recovery above stop trigger levels

### 2.6 Performance Metrics
- **2.6.1** **Standard Metrics**:
  - **2.6.1.1** Total Return (absolute USD and percentage)
  - **2.6.1.2** Maximum Drawdown (absolute USD and percentage)
  - **2.6.1.3** Sharpe Ratio (risk-adjusted return)
  - **2.6.1.4** Win Rate (percentage of profitable trades)
  - **2.6.1.5** Volatility (annualized standard deviation)
  - **2.6.1.6** Total number of trades executed

- **2.6.2** **DCA-Specific Metrics**:
  - **2.6.2.1** Combined Weighted Return on Capital Deployed
  - **2.6.2.2** Average Capital Deployed (daily average of invested capital)
  - **2.6.2.3** Maximum Capital Deployed (peak investment amount)
  - **2.6.2.4** Buy-and-Hold comparison baseline

### 2.7 API Integration
- **2.7.1** `POST /api/backtest/dca` - Run backtest with parameters
- **2.7.2** Command-line interface via `backtest_dca_optimized.js`
- **2.7.3** Results consistency between UI and CLI

---

## 3. FRONTEND DASHBOARD

### 3.1 Backtest Configuration
- **3.1.1** Parameter input form:
  - **3.1.1.1** Symbol selection with autocomplete
  - **3.1.1.2** Start/End date pickers
  - **3.1.1.3** Lot size ($10,000 default)
  - **3.1.1.4** Maximum lots (5 default)
  - **3.1.1.5** Grid interval percentage (10% default)
  - **3.1.1.6** Remaining lots loss tolerance (5% default)

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
  "remainingLotsLossTolerance": 0.05
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

### 6.3 Error Handling
- **6.3.1** API failure graceful degradation
- **6.3.2** Database connection error recovery
- **6.3.3** Invalid parameter validation
- **6.3.4** Data availability checks

---

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