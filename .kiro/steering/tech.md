# Technology Stack & Build System

## Architecture

**Full-stack JavaScript application** with separate backend API and React frontend, using SQLite for local data storage.

## Backend Stack

- **Runtime**: Node.js (v16+)
- **Framework**: Express.js with CORS middleware
- **Database**: SQLite3 with custom database.js abstraction layer
- **Data Providers**: Multiple stock data APIs with fallback system
  - YFinance (primary - unlimited free)
  - Alpha Vantage (fallback - 25 requests/day)
  - Tiingo, FMP, TwelveData (additional providers)
- **Environment**: dotenv for configuration management

## Frontend Stack

- **Framework**: React 18 with functional components and hooks
- **Charts**: Chart.js with react-chartjs-2 for interactive visualizations
- **UI Components**: Lucide React icons, custom CSS styling
- **HTTP Client**: Axios for API communication
- **Date Handling**: date-fns and react-datepicker
- **State Management**: React hooks (useState, useEffect) with localStorage persistence

## Development Tools

- **Backend Dev Server**: nodemon for hot reload
- **Frontend Dev Server**: react-scripts (Create React App)
- **Process Management**: Custom restart_server.sh script
- **Package Management**: npm with separate package.json files

## Common Commands

### Development Setup
```bash
# Install all dependencies (root, backend, frontend)
npm install

# Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# Start both servers in development mode
npm run dev
# OR use the restart script
./restart_server.sh
```

### Individual Services
```bash
# Backend only (port 3001)
cd backend && npm run dev

# Frontend only (port 3000) 
cd frontend && npm start

# Backend production
cd backend && npm start
```

### Backtesting Commands
```bash
# Run CLI backtest
node backtest_dca_optimized.js

# Compare strategies
node compare_strategies.js

# Update stock splits data
cd backend && npm run update-splits
```

### Database Management
```bash
# Update existing stock data
cd backend && node scripts/updateExistingData.js

# Create technical indicators table
cd backend && node scripts/createTechnicalIndicatorsTable.js

# Adjust NVDA splits
cd backend && node scripts/adjustNvdaSplits.js
```

## Environment Configuration

### Required Environment Variables
- `ALPHA_VANTAGE_API_KEY`: Alpha Vantage API key
- `DATA_PROVIDER`: Provider selection (yfinance, alphavantage, tiingo, fmp, twelvedata)
- `PORT`: Backend port (default: 3001)

### Default Ports
- **Backend API**: http://localhost:3001
- **Frontend UI**: http://localhost:3000
- **Health Check**: http://localhost:3001/api/health

## Build & Deployment

### Production Build
```bash
# Frontend production build
cd frontend && npm run build

# Backend runs directly with Node.js
cd backend && npm start
```

### Development Workflow
1. Use `./restart_server.sh` to restart both services
2. Backend auto-reloads with nodemon
3. Frontend hot-reloads with react-scripts
4. API proxy configured in frontend package.json