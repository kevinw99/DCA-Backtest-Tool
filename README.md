# Stock Trading Dashboard

A comprehensive web application for stock analysis with focus on YoY quarterly growth and financial metrics, featuring synchronized charts and up to 5 years of historical data.

## Features

### 📊 Default Metrics (8 charts shown by default)
- **Stock Price**: Daily closing prices with interactive line chart
- **Quarterly Revenue**: Revenue per quarter in millions
- **YoY Revenue Growth**: Year-over-year revenue growth percentage
- **TTM Net EPS**: Trailing twelve months earnings per share
- **P/E Ratio**: Price-to-earnings ratio over time
- **Gross Margin**: Gross profit margin percentage
- **Operating Margin**: Operating profit margin percentage  
- **Net Margin**: Net profit margin percentage

### 🎯 Key Features
- **Synchronized Charts**: All charts share the same time axis for easy comparison
- **Stock Split Handling**: Automatic detection and adjustment for accurate trend analysis
- **Split-Adjusted Prices**: Toggle between raw and split-adjusted price views
- **Time Range Controls**: 1Y, 2Y, 3Y, 5Y, and All time periods
- **Incremental Updates**: Smart data fetching - only gets new data since last update
- **Split Event Markers**: Visual indicators on charts showing when splits occurred
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Popular Stock Quick-Select**: One-click access to NVDA, AAPL, MSFT, GOOGL, TSLA, AMZN

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- Alpha Vantage API key (free at [alphavantage.co](https://www.alphavantage.co/support/#api-key))

### Installation & Setup
```bash
# Clone or download the project
# cd stock-trading-dashboard

# Install all dependencies (backend + frontend)
npm install

# Set up your API key
cp backend/.env.example backend/.env
# Edit backend/.env and add your Alpha Vantage API key:
# ALPHA_VANTAGE_API_KEY=your_key_here

# Start both backend and frontend in development mode
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

### First Usage
1. Open http://localhost:3000
2. Enter a stock symbol (e.g., "NVDA") or click a popular stock button
3. Wait for data to load (first time may take 30-60 seconds)
4. Explore the synchronized charts with time range controls
5. Use the metrics selector to add/remove charts

## How It Works

### Data Flow
1. **User Input**: Enter stock symbol
2. **Data Check**: System checks if local data exists and is fresh (<1 day old)
3. **API Fetch**: If needed, fetches missing data from Alpha Vantage
4. **Storage**: Stores data in local SQLite database (last 5 years only)
5. **Display**: Shows synchronized charts with calculated metrics

### Incremental Updates
- **Smart Fetching**: Only downloads missing days (e.g., if data is 7 days old, fetches last 7 days)
- **Earnings Detection**: Automatically detects new quarterly reports
- **5-Year Limit**: Keeps database size manageable by limiting to 5 years of data

## Architecture

### Backend (Node.js/Express)
- **Database**: SQLite with tables for stocks, daily_prices, quarterly_fundamentals
- **API Integration**: Alpha Vantage for stock data and earnings
- **Endpoints**: RESTful API for stock data and metrics

### Frontend (React)
- **Charts**: Chart.js with react-chartjs-2 for interactive visualizations
- **State Management**: React hooks for data and UI state
- **Responsive UI**: CSS Grid and Flexbox for mobile-friendly design

### Data Sources
- **Price Data**: Alpha Vantage TIME_SERIES_DAILY
- **Fundamentals**: Alpha Vantage INCOME_STATEMENT and EARNINGS APIs
- **Rate Limits**: Handles API rate limiting gracefully

## Development

### Running in Development
```bash
# Start both services with hot reload
npm run dev

# Or run individually:
npm run backend:dev    # Backend only (port 3001)
npm run frontend:dev   # Frontend only (port 3000)

# Update existing stocks with split data:
cd backend && npm run update-splits
```

### Project Structure
```
stock-trading-dashboard/
├── backend/
│   ├── database.js           # SQLite database operations
│   ├── server.js            # Express API server
│   ├── services/
│   │   └── stockDataService.js  # Alpha Vantage integration
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── services/         # API client
│   │   └── App.js           # Main application
│   └── package.json
└── README.md
```

## Troubleshooting

### Common Issues

**"API call frequency limit reached"**
- Alpha Vantage free tier: 5 calls/minute, 500 calls/day
- Wait 1 minute between requests or upgrade to paid plan

**"No time series data found"**
- Check if stock symbol is valid (e.g., "NVDA" not "Nvidia")
- Verify API key is correct in backend/.env

**Charts not displaying**
- Check browser console for errors
- Ensure backend is running on port 3001
- Verify data was successfully fetched

**First load is slow**
- Initial data fetch can take 30-60 seconds for full 5-year history
- Subsequent loads are much faster (incremental updates only)

### Performance Tips
- **Popular Stocks**: Data for NVDA, AAPL, etc. loads faster after first fetch
- **Time Ranges**: Use shorter time ranges (1Y, 2Y) for faster chart rendering
- **Metrics**: Hide unused metrics to improve chart performance

## API Reference

### GET /api/stocks/:symbol
Fetch stock data with all calculated metrics.

**Response:**
```json
{
  "symbol": "NVDA",
  "lastUpdated": "2024-07-26",
  "dailyPrices": [...],
  "quarterlyFundamentals": [...],
  "metrics": {
    "price": [...],
    "revenue": [...],
    "yoy_revenue_growth": [...],
    "eps": [...],
    "pe_ratio": [...],
    "gross_margin": [...],
    "operating_margin": [...],
    "net_margin": [...]
  }
}
```

### GET /api/metrics
Get available metrics configuration.

### GET /api/health
API health check endpoint.

## Project Documentation
- **[SPEC.md](SPEC.md)**: Evolving requirements and feature specifications
- **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)**: Technical implementation roadmap and architecture decisions

## License
MIT