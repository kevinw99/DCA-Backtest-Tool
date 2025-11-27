# Project Structure & Organization

## Root Level Organization

```
stock-trading-dashboard/
├── backend/              # Node.js/Express API server
├── frontend/             # React application
├── config/               # Shared configuration files
├── backup/               # Backup files and documentation
├── .kiro/                # Kiro AI assistant configuration
├── package.json          # Root package.json for workspace commands
├── backtest_dca_optimized.js  # CLI backtest runner
├── compare_strategies.js # Strategy comparison utility
└── restart_server.sh     # Development server management
```

## Backend Structure (`backend/`)

### Core Files
- `server.js` - Express server entry point with API routes
- `database.js` - SQLite database abstraction layer
- `.env` / `.env.example` - Environment configuration

### Services Layer (`backend/services/`)
- `dcaBacktestService.js` - Core DCA backtesting algorithm (shared by CLI/API)
- `batchBacktestService.js` - Batch optimization engine
- `stockDataService.js` - Stock data fetching orchestration
- `technicalIndicatorsService.js` - Technical indicator calculations

### Data Providers (`backend/services/providers/`)
- `yfinanceProvider.js` - Yahoo Finance integration (primary)
- `alphaVantageProvider.js` - Alpha Vantage API client
- `tiingoProvider.js` - Tiingo API client
- `fmpProvider.js` - Financial Modeling Prep client
- `twelveDataProvider.js` - Twelve Data API client
- `iexProvider.js` - IEX Cloud API client

### Scripts (`backend/scripts/`)
- `updateExistingData.js` - Data maintenance utilities
- `createTechnicalIndicatorsTable.js` - Database schema updates
- `adjustNvdaSplits.js` - Stock split adjustments

### Configuration (`backend/config/`)
- `backtestConfig.js` - Backtest parameter management

## Frontend Structure (`frontend/`)

### Core Application (`frontend/src/`)
- `App.js` - Main application component with routing
- `index.js` - React application entry point
- `App.css` / `index.css` - Global styling

### Components (`frontend/src/components/`)
- `DCABacktestForm.js` - Parameter input form (single/batch modes)
- `BacktestResults.js` - Single backtest results display
- `BatchResults.js` - Batch optimization results
- `BacktestChart.js` - Chart visualization component
- `Dashboard.js` - Main dashboard layout
- `D3Dashboard.js` - D3-based advanced charts
- `ChartContainer.js` - Chart wrapper component
- `StockSearch.js` - Stock symbol search/autocomplete
- `MetricsSelector.js` - Chart metrics selection
- `TimeRangeControls.js` - Time period controls

### Services (`frontend/src/services/`)
- `api.js` - Axios-based API client with error handling

### Styling Convention
- Component-specific CSS files (e.g., `Dashboard.css`, `StockSearch.css`)
- Consistent naming: `ComponentName.css` for `ComponentName.js`

## Configuration Files

### Shared Config (`config/`)
- `backtestDefaults.json` - Default backtest parameters and available symbols

### Environment Files
- `backend/.env` - Backend environment variables (API keys, provider selection)
- `frontend/.env` - Frontend environment variables (API URLs)

## Database Structure

### SQLite Tables (`backend/stocks.db`)
- `stocks` - Stock metadata and symbols
- `daily_prices` - OHLCV historical data
- `quarterly_fundamentals` - Earnings and financial data
- `corporate_actions` - Stock splits and dividends
- `technical_indicators` - Calculated technical indicators

## Development Files

### Root Level Scripts
- `backtest_dca_optimized.js` - Standalone CLI backtesting
- `compare_strategies.js` - Strategy comparison utilities
- `restart_server.sh` - Development server management

### Documentation
- `README.md` - Main project documentation
- `REQUIREMENTS.md` - Comprehensive feature requirements
- `IMPLEMENTATION_PLAN.md` - Technical implementation roadmap
- `DCA_STRATEGY_IMPROVEMENTS.md` - Strategy enhancement proposals

## Naming Conventions

### Files & Directories
- **Backend**: camelCase for JavaScript files (`dcaBacktestService.js`)
- **Frontend**: PascalCase for React components (`DCABacktestForm.js`)
- **Config**: kebab-case for configuration (`backtest-defaults.json`)
- **Scripts**: camelCase with descriptive names (`updateExistingData.js`)

### Code Structure
- **Services**: Class-based architecture with dependency injection
- **Components**: Functional React components with hooks
- **APIs**: RESTful endpoints with consistent naming (`/api/backtest/dca`)
- **Database**: snake_case for table/column names (`daily_prices`, `quarterly_fundamentals`)

## Import/Export Patterns

### Backend
```javascript
// Service exports
module.exports = new ServiceClass();

// Database operations
const database = require('./database');

// Provider pattern
const { ProviderClass } = require('./providers/providerName');
```

### Frontend
```javascript
// Component exports
export default ComponentName;

// Service imports
import { apiFunction } from '../services/api';

// Icon imports
import { IconName } from 'lucide-react';
```