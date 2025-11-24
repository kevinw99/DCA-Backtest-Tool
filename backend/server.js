require('dotenv').config();
const express = require('express');
const cors = require('cors');
const config = require('./config');
const database = require('./database');
const stockDataService = require('./services/stockDataService');
const validation = require('./middleware/validation');
const sessionManager = require('./utils/sessionManager');
const sseHelpers = require('./utils/sseHelpers');
const ConfigService = require('./services/configService');
const betaService = require('./services/betaService');
const BetaScalingService = require('./services/betaScaling');

const app = express();

// Initialize Beta Scaling Service (Spec 43: Centralized Beta Scaling)
const betaScalingService = new BetaScalingService(betaService);
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// URL Parameter Logging Middleware
app.use((req, res, next) => {
  // Only log for backtest-related endpoints
  if (req.path.includes('/api/backtest/') || req.path.includes('/api/stocks/') && req.method === 'POST') {
    const timestamp = new Date().toISOString();
    const hasUrlParams = Object.keys(req.query).length > 0;
    const hasBodyParams = Object.keys(req.body).length > 0;

    let parameterSource = 'none';
    if (hasUrlParams && hasBodyParams) {
      parameterSource = 'mixed';
    } else if (hasUrlParams) {
      parameterSource = 'url';
    } else if (hasBodyParams) {
      parameterSource = 'form';
    }

    console.log(`\n🌐 URL PARAMETER LOG - ${timestamp}`);
    console.log(`📍 Endpoint: ${req.method} ${req.path}`);
    console.log(`🔗 Parameter Source: ${parameterSource}`);
    console.log(`👤 Client IP: ${req.ip || req.connection.remoteAddress || 'unknown'}`);
    console.log(`🖥️  User Agent: ${req.get('User-Agent') || 'unknown'}`);

    if (hasUrlParams) {
      console.log(`🔗 URL Parameters:`, req.query);
    }

    if (hasBodyParams) {
      // Log body parameters but exclude sensitive data
      const safeBody = { ...req.body };
      // Don't log full price data arrays to keep logs readable
      if (safeBody.prices && Array.isArray(safeBody.prices)) {
        safeBody.prices = `[${safeBody.prices.length} price records]`;
      }
      console.log(`📝 Body Parameters:`, safeBody);
    }

    if (req.body.source) {
      console.log(`📊 Parameter Origin: ${req.body.source} (from batch result, URL sharing, etc.)`);
    }

    console.log(`🌐 Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
    console.log('─────────────────────────────────────────────────────────');
  }

  next();
});

// Routes
// Health check endpoints (both /health and /api/health for compatibility)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Stock Trading API is running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Stock Trading API is running' });
});

// API Documentation - List all available endpoints
app.get('/api', (req, res) => {
  const acceptHeader = req.headers.accept || '';
  const prefersHtml = acceptHeader.includes('text/html');
  const frontendUrl = config.server.frontendUrl;

  const apiData = {
    message: 'DCA Backtest API - Available Endpoints',
    version: '1.0.0',
    endpoints: {
      health: {
        '/health': 'GET - Health check (Render compatibility)',
        '/api/health': 'GET - Health check'
      },
      stocks: {
        '/api/stocks/:symbol': 'GET - Get stock data with metrics (query: startDate, endDate)',
        '/api/stocks/:symbol/beta': 'GET - Get stock beta value',
        '/api/stocks/:symbol/prices': 'GET - Get historical prices (query: startDate, endDate, interval)',
        '/api/stocks/:symbol/fundamentals': 'GET - Get fundamental data (query: startDate, endDate)'
      },
      backtest: {
        '/api/backtest/dca': `POST - Run DCA backtest (single stock) | UI: ${frontendUrl}/backtest/long/NVDA`,
        '/api/backtest/portfolio': `POST - Run portfolio backtest | UI: ${frontendUrl}/portfolio-backtest`,
        '/api/backtest/batch': `POST - Run batch backtest | UI: ${frontendUrl}/batch`
      },
      database: {
        '/api/db/info': 'GET - Get database statistics (file size, table counts)',
        '/api/db/tables': 'GET - List all database tables',
        '/api/db/schema': 'GET - Get database schema',
        '/api/db/:table': 'GET - Query specific table (query: limit, where)',
        '/api/db/query': 'POST - Execute custom SQL query (read-only)',
        '/db-viewer': 'GET - Database viewer UI'
      }
    },
    documentation: 'https://github.com/kevinw99/DCA-Backtest-Tool',
    frontendUrl
  };

  // Return HTML for browsers, JSON for API clients
  if (prefersHtml) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DCA Backtest API - Documentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #1e3a8a 0%, #059669 100%);
      min-height: 100vh;
      padding: 2rem;
      color: #333;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      color: white;
      padding: 2rem;
      text-align: center;
    }
    .header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    .version {
      opacity: 0.9;
      font-size: 0.9rem;
    }
    .content {
      padding: 2rem;
    }
    .category {
      margin-bottom: 2rem;
    }
    .category-title {
      font-size: 1.3rem;
      font-weight: 600;
      color: #1e3a8a;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e5e7eb;
      text-transform: capitalize;
    }
    .endpoint {
      margin-bottom: 0.75rem;
      padding: 0.75rem;
      background: #f9fafb;
      border-radius: 6px;
      border-left: 3px solid #3b82f6;
      transition: all 0.2s;
    }
    .endpoint:hover {
      background: #eff6ff;
      border-left-color: #059669;
      transform: translateX(4px);
    }
    .endpoint-path {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.95rem;
      color: #1e3a8a;
      font-weight: 600;
      display: inline-block;
      margin-bottom: 0.25rem;
    }
    .endpoint-link {
      display: inline-block;
      margin-left: 1rem;
      padding: 0.3rem 0.8rem;
      background: linear-gradient(135deg, #3b82f6 0%, #059669 100%);
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .endpoint-link:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }
    .method-get {
      background: #10b981;
      color: white;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-right: 0.5rem;
    }
    .method-post {
      background: #f59e0b;
      color: white;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-right: 0.5rem;
    }
    .endpoint-desc {
      color: #6b7280;
      font-size: 0.9rem;
      margin-left: 3.5rem;
    }
    .footer {
      background: #f9fafb;
      padding: 1.5rem 2rem;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
    }
    .footer a:hover {
      text-decoration: underline;
    }
    .note {
      background: #fef3c7;
      border-left: 3px solid #f59e0b;
      padding: 1rem;
      margin-top: 1rem;
      border-radius: 6px;
      font-size: 0.9rem;
      color: #78350f;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DCA Backtest API</h1>
      <p class="version">Version ${apiData.version}</p>
    </div>

    <div class="content">
      ${Object.entries(apiData.endpoints).map(([category, endpoints]) => `
        <div class="category">
          <h2 class="category-title">${category}</h2>
          ${Object.entries(endpoints).map(([path, desc]) => {
            const [method, ...descParts] = desc.split(' - ');
            const description = descParts.join(' - ');
            const methodClass = method.toLowerCase().includes('post') ? 'method-post' : 'method-get';

            // Check for UI link in description (format: "Description | UI: url")
            const uiLinkMatch = description.match(/(.+?)\s*\|\s*UI:\s*(.+)/);
            const actualDesc = uiLinkMatch ? uiLinkMatch[1] : description;
            const uiLink = uiLinkMatch ? uiLinkMatch[2].trim() : null;

            // Determine href and clickability
            let href, isClickable, linkText;
            if (method.includes('GET')) {
              href = path.replace(':symbol', 'AAPL').replace(':table', 'stocks');
              isClickable = true;
              linkText = 'Try API';
            } else if (uiLink) {
              href = uiLink;
              isClickable = true;
              linkText = 'Open UI';
            } else {
              href = '#';
              isClickable = false;
              linkText = '';
            }

            return `
              <div class="endpoint">
                <span class="${methodClass}">${method.split(' ')[0]}</span>
                <span class="endpoint-path">${path}</span>
                ${isClickable
                  ? `<a href="${href}" class="endpoint-link" target="_blank">${linkText}</a>`
                  : ''
                }
                <div class="endpoint-desc">${actualDesc}</div>
              </div>
            `;
          }).join('')}
        </div>
      `).join('')}

      <div class="note">
        <strong>Note:</strong> Click "Try API" to test GET endpoints with example parameters, or "Open UI" to access the frontend interface for POST endpoints. You can also use curl or API clients directly.
      </div>
    </div>

    <div class="footer">
      <p>
        📊 <a href="${frontendUrl}/presentation/" target="_blank">Strategy Presentation</a> |
        🎓 <a href="${frontendUrl}/methodology/" target="_blank">Methodology Presentation</a> |
        📚 <a href="${apiData.documentation}" target="_blank">GitHub Documentation</a> |
        💾 <a href="/db-viewer" target="_blank">Database Viewer</a> |
        ❤️ <a href="/api/health" target="_blank">Health Check</a>
      </p>
    </div>
  </div>
</body>
</html>`;
    res.send(html);
  } else {
    res.json(apiData);
  }
});

// Get stock data with all metrics
app.get('/api/stocks/:symbol', validation.validateSymbolParam, validation.validateQueryDateRange, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { startDate, endDate } = req.query;

    console.log(`\n🔍 API REQUEST: /api/stocks/${symbol.toUpperCase()}`);
    if (req.query.force) console.log(`   🔄 FORCE REFRESH requested`);

    // Validate requested date range for backtesting
    const dataValidationErrors = [];

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const today = new Date();
      const thirtyYearsAgo = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());

      if (start < thirtyYearsAgo) {
        dataValidationErrors.push(`Start date ${startDate} is older than 30 years. Available data limited to ${thirtyYearsAgo.toISOString().split('T')[0]} onwards.`);
      }

      if (end > today) {
        dataValidationErrors.push(`End date ${endDate} is in the future. Latest available data is ${today.toISOString().split('T')[0]}.`);
      }

      if (start >= end) {
        dataValidationErrors.push(`Start date ${startDate} must be before end date ${endDate}.`);
      }
    }

    // Get or create stock record
    let stock = await database.getStock(symbol);
    if (!stock) {
      console.log(`🆕 Creating new stock record for ${symbol}`);
      const stockId = await database.createStock(symbol);
      stock = await database.getStock(symbol);
    }

    // Check existing data availability
    const lastPriceDate = await database.getLastPriceDate(stock.id);
    const lastFundamentalDate = await database.getLastFundamentalDate(stock.id);
    const lastCorporateActionDate = await database.getLastCorporateActionDate(stock.id);

    const today = new Date().toISOString().split('T')[0];
    const forceUpdate = req.query.force === 'true';

    // Determine if we need to fetch data
    const needsPriceUpdate = !lastPriceDate || forceUpdate;
    const needsFundamentalUpdate = !lastFundamentalDate || forceUpdate;
    const needsCorporateActionUpdate = !lastCorporateActionDate || forceUpdate;

    // If no data exists, force update regardless of user request
    const autoFetchRequired = !lastPriceDate;
    if (autoFetchRequired) {
      console.log(`📡 No data found for ${symbol}, automatically fetching from provider...`);
    }

    // Update data if needed or required
    if (needsPriceUpdate || needsFundamentalUpdate || needsCorporateActionUpdate) {
      console.log(`📡 FETCHING from provider for ${symbol}:`);
      console.log(`   Prices: ${needsPriceUpdate} | Fundamentals: ${needsFundamentalUpdate} | Corporate Actions: ${needsCorporateActionUpdate}`);

      try {
        await stockDataService.updateStockData(stock.id, symbol, {
          updatePrices: needsPriceUpdate,
          updateFundamentals: needsFundamentalUpdate,
          updateCorporateActions: needsCorporateActionUpdate,
          fromDate: forceUpdate ? null : lastPriceDate,
          forceRefresh: forceUpdate
        });
        await database.updateStockTimestamp(stock.id);
        console.log(`✅ Successfully updated data for ${symbol}`);
      } catch (dataError) {
        console.error(`❌ Failed to fetch data for ${symbol}:`, dataError.message);

        // If we have no data at all, return an error
        if (!lastPriceDate) {
          return res.status(503).json({
            error: 'Stock data unavailable',
            message: `Unable to fetch data for symbol ${symbol}. The symbol may not exist or the data provider may be temporarily unavailable.`,
            details: dataError.message,
            suggestions: [
              'Verify the stock symbol is correct',
              'Try again in a few minutes',
              'Check if the symbol is listed on a major exchange'
            ]
          });
        }

        // If we have some cached data, proceed with warning
        dataValidationErrors.push(`Warning: Unable to fetch latest data for ${symbol}. Using cached data from ${lastPriceDate}.`);
      }
    } else {
      console.log(`💾 Using cached data for ${symbol}`);
    }

    // Check if we should use adjusted prices
    const useAdjusted = req.query.adjusted !== 'false'; // Default to adjusted
    
    // For Alpha Vantage, we now use their native adjusted_close field
    // which already handles splits and dividends properly
    const providerType = process.env.DATA_PROVIDER || 'alphavantage';
    
    // Fetch data from database with validation
    const dailyPrices = await database.getDailyPrices(stock.id, startDate, endDate);
    const quarterlyFundamentals = await database.getQuarterlyFundamentals(stock.id, startDate, endDate);
    const corporateActions = await database.getCorporateActions(stock.id, startDate, endDate);

    // Validate data availability for requested period
    if (startDate && endDate && dailyPrices.length === 0) {
      return res.status(404).json({
        error: 'No data available for requested period',
        message: `No price data found for ${symbol} between ${startDate} and ${endDate}.`,
        availableDataRange: lastPriceDate ? {
          earliestDate: dailyPrices.length > 0 ? dailyPrices[dailyPrices.length - 1].date : null,
          latestDate: lastPriceDate
        } : null,
        suggestions: [
          'Adjust your date range to include available data',
          'Try a more recent date range',
          'Check if the symbol was listed during this period'
        ]
      });
    }

    // Allow backtesting with any amount of data - user decides what's sufficient

    // Calculate derived metrics
    const metrics = stockDataService.calculateMetrics(dailyPrices, quarterlyFundamentals, corporateActions, symbol);

    // Check data quality for earnings announcement dates
    const totalQuarterlyRecords = quarterlyFundamentals.length;
    const recordsWithAnnouncementDates = quarterlyFundamentals.filter(f => f.reported_date).length;
    const missingAnnouncementDates = totalQuarterlyRecords - recordsWithAnnouncementDates;

    console.log(`📤 Response: ${dailyPrices.length} prices, ${quarterlyFundamentals.length} quarters, ${corporateActions.length} actions`);
    if (missingAnnouncementDates > 0) {
      console.warn(`⚠️  ${missingAnnouncementDates}/${totalQuarterlyRecords} quarterly records missing announcement dates`);
    }

    // Determine data coverage for the available period
    const dataRange = dailyPrices.length > 0 ? {
      startDate: dailyPrices[dailyPrices.length - 1].date,
      endDate: dailyPrices[0].date,
      totalDays: dailyPrices.length
    } : null;

    res.json({
      symbol: symbol.toUpperCase(),
      lastUpdated: stock.last_updated,
      dailyPrices,
      quarterlyFundamentals,
      corporateActions,
      metrics,
      adjusted: useAdjusted,
      dataQuality: {
        totalQuarterlyRecords,
        recordsWithAnnouncementDates,
        missingAnnouncementDates,
        announcementDateCoverage: totalQuarterlyRecords > 0 ? Math.round((recordsWithAnnouncementDates / totalQuarterlyRecords) * 100) : 0
      },
      dataRange,
      validationErrors: dataValidationErrors.length > 0 ? dataValidationErrors : undefined,
      autoFetched: autoFetchRequired
    });

  } catch (error) {
    console.error('❌ ERROR in /api/stocks/:symbol:', error);
    console.error('   Error message:', error.message);
    console.error('   Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch stock data', 
      message: error.message 
    });
  }
});

// Full chart data endpoint for technical analysis
app.get('/api/stocks/:symbol/full-chart-data', validation.validateSymbolParam, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { includeIndicators } = req.query;

    console.log(`\n📊 API REQUEST: /api/stocks/${symbol}/full-chart-data`);

    // Get stock record
    const stock = await database.getStock(symbol);
    if (!stock) {
      return res.status(404).json({ error: `Stock ${symbol} not found` });
    }

    // Get all daily prices with technical indicators
    const dailyPrices = await database.getDailyPrices(stock.id);

    if (includeIndicators === 'true') {
      // Calculate technical indicators for all data
      const stockDataService = require('./services/stockDataService');
      const metrics = stockDataService.calculateMetrics(dailyPrices, [], [], symbol);

      // Merge price data with calculated indicators
      const dataWithIndicators = dailyPrices.map(price => ({
        ...price,
        ma_20: metrics.technicalIndicators?.find(t => t.date === price.date)?.ma20 || null,
        ma_50: metrics.technicalIndicators?.find(t => t.date === price.date)?.ma50 || null,
        ma_200: metrics.technicalIndicators?.find(t => t.date === price.date)?.ma200 || null,
        rsi_14: metrics.technicalIndicators?.find(t => t.date === price.date)?.rsi || null,
        volatility_20: metrics.technicalIndicators?.find(t => t.date === price.date)?.volatility || null
      }));

      const dateRange = dailyPrices.length > 0 ? {
        min: dailyPrices[0].date,
        max: dailyPrices[dailyPrices.length - 1].date,
        totalDays: dailyPrices.length
      } : null;

      res.json({
        symbol: symbol.toUpperCase(),
        dailyPrices: dataWithIndicators,
        metrics: metrics,
        dateRange: dateRange
      });
    } else {
      res.json({
        symbol: symbol.toUpperCase(),
        dailyPrices: dailyPrices
      });
    }

  } catch (error) {
    console.error('❌ ERROR in /api/stocks/:symbol/full-chart-data:', error);
    res.status(500).json({
      error: 'Failed to fetch chart data',
      message: error.message
    });
  }
});

// Database viewer parametric route moved to after specific /api/db/* routes
// to avoid route matching conflicts (see end of database routes section)

// Test Alpha Vantage API directly
app.get('/api/test-av/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const axios = require('axios');
    
    console.log(`🧪 Testing Alpha Vantage API for ${symbol}`);
    
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}&outputsize=compact`;
    console.log(`🔗 Making request to:`, url);
    
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    console.log(`✅ Response status:`, response.status);
    console.log(`✅ Response keys:`, Object.keys(response.data));
    
    if (response.data['Time Series (Daily)']) {
      const dates = Object.keys(response.data['Time Series (Daily)']);
      console.log(`✅ Time series found with ${dates.length} dates`);
    } else {
      console.log(`❌ No Time Series (Daily) found`);
      console.log(`Full response:`, JSON.stringify(response.data, null, 2));
    }
    
    res.json(response.data);
  } catch (error) {
    console.error(`❌ Test error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get beta data for a specific stock symbol
app.get('/api/stocks/:symbol/beta', validation.validateSymbolParam, async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        error: 'Symbol is required',
        message: 'Please provide a valid stock symbol'
      });
    }

    // Use BetaDataService to fetch real Beta data
    const betaDataService = require('./services/betaDataService');
    const betaData = await betaDataService.fetchBeta(symbol);

    console.log(`📊 Beta fetched for ${symbol}: ${betaData.beta} (source: ${betaData.source})`);

    res.json({
      symbol: symbol.toUpperCase(),
      beta: betaData.beta,
      source: betaData.source,
      lastUpdated: betaData.lastUpdated,
      isManualOverride: betaData.isManualOverride
    });

  } catch (error) {
    console.error(`Error fetching beta for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      error: 'Failed to fetch beta data',
      message: error.message
    });
  }
});

// Update/set manual beta override for a stock symbol
app.put('/api/stocks/:symbol/beta', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { beta, isManualOverride } = req.body;

    if (!symbol) {
      return res.status(400).json({
        error: 'Symbol is required',
        message: 'Please provide a valid stock symbol'
      });
    }

    if (typeof beta !== 'number' || isNaN(beta)) {
      return res.status(400).json({
        error: 'Invalid beta value',
        message: 'Beta must be a valid number',
        received: { beta, type: typeof beta }
      });
    }

    if (beta < 0 || beta > 10) {
      return res.status(400).json({
        error: 'Invalid beta value',
        message: 'Beta must be between 0 and 10',
        received: { beta }
      });
    }

    const betaDataService = require('./services/betaDataService');

    let result;
    if (isManualOverride) {
      // Set manual Beta override
      result = await betaDataService.setManualBeta(symbol, beta);
      console.log(`🔧 Manual Beta override set for ${symbol}: ${result.beta}`);
    } else {
      // Remove manual override and fetch fresh data
      result = await betaDataService.removeManualBeta(symbol);
      console.log(`🔄 Manual Beta override removed for ${symbol}, new Beta: ${result.beta}`);
    }

    res.json({
      symbol: symbol.toUpperCase(),
      beta: result.beta,
      source: result.source,
      lastUpdated: result.lastUpdated,
      isManualOverride: result.isManualOverride,
      message: isManualOverride ? 'Manual Beta override set successfully' : 'Manual Beta override removed successfully'
    });

  } catch (error) {
    console.error(`Error updating beta for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      error: 'Failed to update beta data',
      message: error.message
    });
  }
});


// Get list of previously entered stocks for autocomplete
app.get('/api/stocks', async (req, res) => {
  try {
    const { search } = req.query;
    
    // Get all stocks from database, optionally filtered by search term
    let sql = 'SELECT symbol, last_updated FROM stocks';
    const params = [];
    
    if (search) {
      sql += ' WHERE symbol LIKE ? ';
      params.push(`${search.toUpperCase()}%`);
    }
    
    sql += ' ORDER BY last_updated DESC, symbol ASC';
    
    const stocks = await new Promise((resolve, reject) => {
      database.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({
      stocks: stocks.map(stock => ({
        symbol: stock.symbol,
        lastUpdated: stock.last_updated
      }))
    });
  } catch (error) {
    console.error('Error fetching stocks list:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch stocks list', 
      message: error.message 
    });
  }
});

// Get available metrics list
app.get('/api/metrics', (req, res) => {
  const defaultMetrics = [
    { id: 'price', name: 'Stock Price', type: 'line', default: true },
    { id: 'revenue', name: 'Quarterly Revenue', type: 'bar', default: true },
    { id: 'yoy_revenue_growth', name: 'YoY Revenue Growth', type: 'bar', default: true },
    { id: 'eps', name: 'TTM Net EPS', type: 'bar', default: true },
    { id: 'pe_ratio', name: 'P/E Ratio', type: 'line', default: true },
    { id: 'gross_margin', name: 'Gross Margin', type: 'line', default: true },
    { id: 'operating_margin', name: 'Operating Margin', type: 'line', default: true },
    { id: 'net_margin', name: 'Net Margin', type: 'line', default: true }
  ];

  const additionalMetrics = [
    { id: 'volume', name: 'Trading Volume', type: 'bar', default: false },
    { id: 'yoy_eps_growth', name: 'YoY EPS Growth', type: 'bar', default: false },
    { id: 'debt_to_equity', name: 'Debt-to-Equity Ratio', type: 'line', default: false }
  ];

  res.json({
    defaultMetrics,
    additionalMetrics
  });
});

// Clear all data from database (development endpoint)
app.delete('/api/clear-all-data', async (req, res) => {
  try {
    console.log('🗑️  API REQUEST: Clear all data from database');
    const deletedCounts = await database.clearAllData();
    
    res.json({
      success: true,
      message: 'All data cleared successfully',
      deletedCounts
    });
  } catch (error) {
    console.error('Error clearing all data:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Import shared config
const backtestConfig = require('./config/backtestConfig');

// Initialize configService for ticker-specific defaults
const configService = new ConfigService();

// Get default parameters endpoint
app.get('/api/backtest/defaults', (req, res) => {
  try {
    const defaults = backtestConfig.getDefaults();
    res.json({
      success: true,
      data: defaults
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load default parameters',
      message: error.message
    });
  }
});

// Get raw backtest defaults config (for frontend)
app.get('/api/config/backtest-defaults', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, '../config/backtestDefaults.json');
    const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    res.json({
      success: true,
      data: rawConfig
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load backtest defaults config',
      message: error.message
    });
  }
});

// Get ticker-specific default parameters
app.get('/api/backtest/defaults/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;

    // Sanitize symbol (alphanumeric only)
    const sanitizedSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    if (!sanitizedSymbol) {
      return res.status(400).json({
        success: false,
        error: 'Invalid symbol'
      });
    }

    const defaults = await configService.getTickerDefaults(sanitizedSymbol);

    res.json({
      success: true,
      defaults: defaults
    });
  } catch (error) {
    console.error(`Error fetching defaults for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to load ticker defaults',
      message: error.message
    });
  }
});

// Save ticker-specific default parameters
app.post('/api/backtest/defaults/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { parameters } = req.body;

    // Sanitize symbol (alphanumeric only)
    const sanitizedSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    if (!sanitizedSymbol) {
      return res.status(400).json({
        success: false,
        error: 'Invalid symbol'
      });
    }

    if (!parameters || typeof parameters !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Parameters object is required'
      });
    }

    // Save ticker-specific defaults (validation is done inside the service)
    await configService.saveTickerDefaults(sanitizedSymbol, parameters);

    res.json({
      success: true,
      message: `Saved defaults for ${sanitizedSymbol}`
    });
  } catch (error) {
    console.error(`Error saving defaults for ${req.params.symbol}:`, error);

    // Check if it's a validation error
    if (error.message.includes('Invalid parameters')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to save ticker defaults',
      message: error.message
    });
  }
});

// DCA Backtesting API endpoints
app.post('/api/backtest/dca', validation.validateDCABacktestParams, async (req, res) => {
  try {
    console.log('=== DEBUG: LONG DCA ENDPOINT CALLED ===');
    console.log('Strategy Mode in request:', req.body.strategyMode);
    console.log('Full request body:', req.body);
    console.log('=====================================');

    // Merge request parameters with shared defaults
    const params = {
      ...backtestConfig.mergeWithDefaults(req.body),
      // Spec 45: Explicitly preserve momentum parameters from request
      momentumBasedBuy: req.body.momentumBasedBuy ?? false,
      momentumBasedSell: req.body.momentumBasedSell ?? false
    };

    const {
      symbol,
      startDate,
      endDate,
      lotSizeUsd,
      maxLots,
      maxLotsToSell,
      gridIntervalPercent,
      remainingLotsLossTolerance,
      profitRequirement,
      trailingBuyActivationPercent,
      trailingBuyReboundPercent,
      trailingSellActivationPercent,
      trailingSellPullbackPercent,
      // Beta-related parameters
      beta,
      coefficient,
      betaScalingCoefficient,  // Alternative name for coefficient
      enableBetaScaling,
      isManualBetaOverride,
      // Spec 27: Directional strategy control flags
      enableAdaptiveTrailingBuy,
      enableAdaptiveTrailingSell
    } = params;

    // Process Beta-adjusted parameters using centralized BetaScalingService (Spec 43)
    let finalParams = { ...params };
    let betaInfo = null;

    // Apply beta scaling if enabled
    const scalingResult = await betaScalingService.applyBetaScaling(
      params,  // Base parameters
      symbol,  // Stock symbol for beta resolution
      {
        enableBetaScaling,
        coefficient: coefficient || betaScalingCoefficient || 1.0,
        beta,  // Manual beta override (optional)
        isManualBetaOverride
      }
    );

    if (scalingResult.success) {
      // Use adjusted parameters
      finalParams = { ...params, ...scalingResult.adjustedParameters };

      // Set beta info for response
      if (enableBetaScaling && scalingResult.betaInfo) {
        betaInfo = {
          ...scalingResult.betaInfo,
          baseParameters: scalingResult.baseParameters,
          adjustedParameters: scalingResult.adjustedParameters,
          warnings: scalingResult.warnings,
          isValid: scalingResult.isValid
        };

        console.log(`🧮 Beta scaling applied: Beta=${betaInfo.beta}, Factor=${betaInfo.betaFactor?.toFixed(2) || 'N/A'}, Warnings=${betaInfo.warnings?.length || 0}`);
        if (betaInfo.warnings && betaInfo.warnings.length > 0) {
          console.log('⚠️  Beta warnings:', betaInfo.warnings);
        }
      }
    } else {
      // Scaling failed - use base parameters and log error
      console.error('❌ Beta scaling failed:', scalingResult.errors);
      betaInfo = {
        error: scalingResult.errors.join('; '),
        beta: beta || 1.0,
        coefficient: coefficient || 1.0,
        betaFactor: (beta || 1.0) * (coefficient || 1.0),
        fallbackToOriginal: true,
        warnings: scalingResult.warnings
      };
    }

    // Note: No longer saving to backtestDefaults.json on every request to avoid polluting config file
    // Use POST /api/backtest/defaults/:symbol endpoint to explicitly save ticker-specific defaults

    console.log(`🔄 DCA Backtest request for ${symbol} (${startDate} to ${endDate})`);

    // Validate backtest parameters
    if (!symbol || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Symbol, startDate, and endDate are required for backtesting',
        received: { symbol, startDate, endDate }
      });
    }

    // Validate strategy parameters to prevent 0 trades scenario (use finalParams for Beta-adjusted values)
    const paramValidationErrors = [];

    if (finalParams.trailingBuyReboundPercent < 0) {
      paramValidationErrors.push(`trailingBuyReboundPercent must be greater than or equal to 0 (received: ${finalParams.trailingBuyReboundPercent}). Negative values are not allowed.`);
    }

    if (finalParams.trailingSellPullbackPercent < 0) {
      paramValidationErrors.push(`trailingSellPullbackPercent must be greater than or equal to 0 (received: ${finalParams.trailingSellPullbackPercent}). Negative values are not allowed.`);
    }

    if (finalParams.profitRequirement < 0) {
      paramValidationErrors.push(`profitRequirement must be greater than or equal to 0 (received: ${finalParams.profitRequirement}). Negative values prevent profitable sales.`);
    }

    if (finalParams.trailingBuyActivationPercent < 0) {
      paramValidationErrors.push(`trailingBuyActivationPercent must be greater than or equal to 0 (received: ${finalParams.trailingBuyActivationPercent}). Negative values are not allowed.`);
    }

    if (finalParams.trailingSellActivationPercent < 0) {
      paramValidationErrors.push(`trailingSellActivationPercent must be greater than or equal to 0 (received: ${finalParams.trailingSellActivationPercent}). Negative values are not allowed.`);
    }

    if (finalParams.gridIntervalPercent <= 0) {
      paramValidationErrors.push(`gridIntervalPercent must be greater than 0 (received: ${finalParams.gridIntervalPercent}). A value of 0 prevents grid spacing validation.`);
    }

    // Check for unreasonably large values that could cause issues
    if (finalParams.trailingBuyReboundPercent >= 100) {
      paramValidationErrors.push(`trailingBuyReboundPercent should be less than 100% (received: ${finalParams.trailingBuyReboundPercent}%). Values >= 100% may cause unexpected behavior.`);
    }

    if (finalParams.trailingSellPullbackPercent >= 100) {
      paramValidationErrors.push(`trailingSellPullbackPercent should be less than 100% (received: ${finalParams.trailingSellPullbackPercent}%). Values >= 100% may cause unexpected behavior.`);
    }

    if (paramValidationErrors.length > 0) {
      return res.status(400).json({
        error: 'Invalid strategy parameters',
        message: 'The provided parameters would likely result in 0 trades. Please adjust the parameters.',
        validationErrors: paramValidationErrors,
        receivedParameters: {
          trailingBuyReboundPercent,
          trailingSellPullbackPercent,
          profitRequirement,
          trailingBuyActivationPercent,
          trailingSellActivationPercent,
          gridIntervalPercent
        }
      });
    }

    // Note: Date range validation is handled by the validation middleware
    // No need for duplicate validation here

    // Get or create stock record and ensure data is available
    let stock = await database.getStock(symbol);
    let needsDataFetch = false;

    if (!stock) {
      console.log(`🆕 Creating new stock record for backtest: ${symbol}`);
      try {
        const stockId = await database.createStock(symbol);
        stock = await database.getStock(symbol);
        needsDataFetch = true;
      } catch (createError) {
        return res.status(503).json({
          error: 'Unable to create stock record',
          message: `Could not create stock record for symbol ${symbol}.`,
          details: createError.message
        });
      }
    }

    // Get daily prices for the backtest period
    let dailyPrices = await database.getDailyPrices(stock.id, startDate, endDate);

    // If stock exists but has no price data, fetch it
    if (!dailyPrices || dailyPrices.length === 0) {
      console.log(`📡 Stock ${symbol} exists but has no price data for ${startDate} to ${endDate}. Fetching...`);
      try {
        await stockDataService.updateStockData(stock.id, symbol, {
          updatePrices: true,
          updateFundamentals: true,
          updateCorporateActions: true
        });
        await database.updateStockTimestamp(stock.id);

        // Retry getting daily prices after fetch
        dailyPrices = await database.getDailyPrices(stock.id, startDate, endDate);

        // Don't need data for entire requested period - backtest will use whatever data is available
        // If symbol wasn't trading during requested dates, it will use the data that exists
      } catch (fetchError) {
        return res.status(503).json({
          error: 'Unable to fetch stock data',
          message: `Could not retrieve data for symbol ${symbol}. The symbol may not exist or the data provider may be temporarily unavailable.`,
          details: fetchError.message
        });
      }
    }

    // Allow backtesting with any amount of data - user decides what's sufficient

    // Use the shared core algorithm
    const { runDCABacktest } = require('./services/dcaBacktestService');

    // ✅ VIOLATION-5 FIX (ISSUE-7): Frontend now sends decimals (0.10 for 10%)
    // No need to divide by 100 - parameters are already decimals from frontend
    const results = await runDCABacktest({
      symbol: finalParams.symbol,
      startDate: finalParams.startDate,
      endDate: finalParams.endDate,
      lotSizeUsd: finalParams.lotSizeUsd,
      maxLots: finalParams.maxLots,
      maxLotsToSell: finalParams.maxLotsToSell,
      gridIntervalPercent: finalParams.gridIntervalPercent,
      remainingLotsLossTolerance: finalParams.remainingLotsLossTolerance,
      profitRequirement: finalParams.profitRequirement,
      trailingBuyActivationPercent: finalParams.trailingBuyActivationPercent,
      trailingBuyReboundPercent: finalParams.trailingBuyReboundPercent,
      trailingSellActivationPercent: finalParams.trailingSellActivationPercent,
      trailingSellPullbackPercent: finalParams.trailingSellPullbackPercent,
      enableDynamicGrid: finalParams.enableDynamicGrid,
      normalizeToReference: finalParams.normalizeToReference,
      dynamicGridMultiplier: finalParams.dynamicGridMultiplier,
      enableConsecutiveIncrementalSellProfit: finalParams.enableConsecutiveIncrementalSellProfit,
      enableConsecutiveIncrementalBuyGrid: finalParams.enableConsecutiveIncrementalBuyGrid,
      gridConsecutiveIncrement: finalParams.gridConsecutiveIncrement,
      enableScenarioDetection: finalParams.enableScenarioDetection,
      enableAdaptiveStrategy: finalParams.enableAdaptiveStrategy,
      adaptationCheckIntervalDays: finalParams.adaptationCheckIntervalDays,
      adaptationRollingWindowDays: finalParams.adaptationRollingWindowDays,
      minDataDaysBeforeAdaptation: finalParams.minDataDaysBeforeAdaptation,
      confidenceThreshold: finalParams.confidenceThreshold,
      trailingStopOrderType: finalParams.trailingStopOrderType,
      enableAverageBasedGrid: finalParams.enableAverageBasedGrid,
      enableAverageBasedSell: finalParams.enableAverageBasedSell,
      enableDynamicProfile: finalParams.enableDynamicProfile,
      // Spec 27: Directional strategy control flags
      enableAdaptiveTrailingBuy: finalParams.enableAdaptiveTrailingBuy,
      enableAdaptiveTrailingSell: finalParams.enableAdaptiveTrailingSell,
      // Spec 45: Momentum-based trading
      momentumBasedBuy: finalParams.momentumBasedBuy,
      momentumBasedSell: finalParams.momentumBasedSell,
      verbose: false // Don't log to console for API calls
    });

    console.log('📤 API Response - scenarioAnalysis:', JSON.stringify(results.scenarioAnalysis, null, 2));

    res.json({
      success: true,
      data: {
        summary: {
          symbol: results.symbol,
          startDate: results.startDate,
          endDate: results.endDate,
          totalReturn: results.totalPNL,
          totalReturnPercent: results.totalReturnPercent,
          finalValue: results.dcaFinalValue,
          totalCost: results.maxCapitalDeployed,
          lotsHeld: results.finalLots,
          totalTrades: results.totalTrades,
          maxDrawdown: results.maxDrawdown,
          maxDrawdownPercent: results.maxDrawdownPercent,
          sharpeRatio: results.sharpeRatio,
          winRate: results.winRate,
          volatility: results.volatility,
          performanceMetrics: results.performanceMetrics,
          scenarioAnalysis: results.scenarioAnalysis,
          adaptiveStrategy: results.adaptiveStrategy
        },
        transactions: (() => {
          const transactions = [];
          let currentDate = '';

          // Process transaction log to properly associate dates with actions
          results.transactionLog.forEach(log => {
            // Check if this line contains a date header
            const dateMatch = log.match(/--- ([\d-]+) ---/);
            if (dateMatch) {
              currentDate = dateMatch[1];
              return;
            }

            // Check for buy/sell actions
            const buyMatch = log.match(/ACTION: BUY: Bought 1 lot at ([\d.]+)/);
            const sellMatch = log.match(/ACTION: SELL.*executed at ([\d.]+)/);

            if (buyMatch) {
              const price = parseFloat(buyMatch[1]);
              transactions.push({
                type: 'BUY',
                date: currentDate,
                price: price,
                shares: lotSizeUsd / price,
                value: lotSizeUsd
              });
            } else if (sellMatch) {
              const price = parseFloat(sellMatch[1]);
              // Parse PNL and shares from the sell log
              const pnlMatch = log.match(/PNL: ([-\d.]+)/);
              const pnl = pnlMatch ? parseFloat(pnlMatch[1]) : 0;

              transactions.push({
                type: 'SELL',
                date: currentDate,
                price: price,
                shares: 0, // Shares info not easily extractable from current log format
                value: 0,  // Could be calculated but complex
                pnl: pnl
              });
            }
          });

          return transactions;
        })(),
        enhancedTransactions: results.enhancedTransactions,
        dailyPrices: dailyPrices,
        lots: results.lots,
        transactionLog: results.transactionLog,
        tradeAnalysis: results.tradeAnalysis,
        buyAndHoldResults: results.buyAndHoldResults,
        // Spec 59: Add buyAndHoldMetrics for frontend compatibility (alias for buyAndHoldResults)
        buyAndHoldMetrics: results.buyAndHoldResults,
        outperformance: results.outperformance,
        outperformancePercent: results.outperformancePercent,
        // Peak/Bottom tracking for Future Trade display
        recentPeak: results.recentPeak,
        recentBottom: results.recentBottom,
        lastTransactionDate: results.lastTransactionDate,
        // Active trailing stop information
        activeTrailingStopSell: results.activeTrailingStopSell,
        activeTrailingStopBuy: results.activeTrailingStopBuy,
        // Include Beta information if Beta scaling was used
        ...(betaInfo && { betaInfo: betaInfo }),
        // Include profile metrics if dynamic profile switching is enabled
        ...(results.profileMetrics && { profileMetrics: results.profileMetrics }),
        // Spec 45: Include momentum mode statistics
        momentumMode: results.momentumMode,
        maxLotsReached: results.maxLotsReached,
        buyBlockedByPnL: results.buyBlockedByPnL,
        positionMetrics: results.positionMetrics,
        // Spec 59: Add comprehensive performance metrics at top level
        performanceMetrics: results.performanceMetrics
      }
    });

  } catch (error) {
    console.error('DCA backtest error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch Backtest API endpoint - Run multiple backtests with different parameters
// Short Selling DCA Backtest endpoint
app.post('/api/backtest/short-dca', validation.validateShortDCABacktestParams, async (req, res) => {
  try {
    console.log('=== DEBUG: SHORT DCA ENDPOINT CALLED ===');
    console.log('\n📊 RECEIVED SHORT SELLING DCA BACKTEST REQUEST');
    console.log('Strategy Mode in request:', req.body.strategyMode);
    console.log('Full request body:', req.body);
    console.log('========================================');
    const startTime = Date.now();

    const { runShortDCABacktest } = require('./services/shortDCABacktestService');

    console.log('Request parameters:', JSON.stringify(req.body, null, 2));

    // Use the config system to merge with defaults (same as long DCA)
    const normalizedParams = backtestConfig.mergeWithDefaults(req.body);

    console.log('Normalized parameters:', JSON.stringify(normalizedParams, null, 2));

    // Note: No longer saving to backtestDefaults.json on every request to avoid polluting config file
    // Use POST /api/backtest/defaults/:symbol endpoint to explicitly save ticker-specific defaults

    // ✅ VIOLATION-5 FIX: Frontend now sends decimals (0.10 for 10%)
    // No need to divide by 100 - parameters are already decimals from frontend
    const algoParams = {
      ...normalizedParams
    };

    const results = await runShortDCABacktest(algoParams);
    const executionTime = Date.now() - startTime;

    console.log(`\n✅ Short DCA backtest completed in ${(executionTime/1000).toFixed(1)}s`);
    console.log(`📈 Final Value: $${results.shortDCAFinalValue?.toFixed(2) || 'N/A'}`);
    console.log(`💰 Max Capital Deployed: $${results.maxCapitalDeployed?.toFixed(2) || 'N/A'}`);

    // Create response format compatible with frontend
    const response = {
      success: true,
      executionTimeMs: executionTime,
      data: {
        symbol: results.symbol,
        strategy: results.strategy,
        backtestParameters: {
          symbol: normalizedParams.symbol,
          startDate: normalizedParams.startDate,
          endDate: normalizedParams.endDate,
          gridIntervalPercent: normalizedParams.gridIntervalPercent,
          profitRequirement: normalizedParams.profitRequirement,
          trailingShortActivationPercent: normalizedParams.trailingShortActivationPercent,
          trailingShortPullbackPercent: normalizedParams.trailingShortPullbackPercent,
          trailingCoverActivationPercent: normalizedParams.trailingCoverActivationPercent,
          trailingCoverReboundPercent: normalizedParams.trailingCoverReboundPercent,
          lotSizeUsd: normalizedParams.lotSizeUsd,
          maxShorts: normalizedParams.maxShorts,
          maxShortsToCovers: normalizedParams.maxShortsToCovers,
          hardStopLossPercent: normalizedParams.hardStopLossPercent,
          portfolioStopLossPercent: normalizedParams.portfolioStopLossPercent,
          cascadeStopLossPercent: normalizedParams.cascadeStopLossPercent
        },
        transactions: results.enhancedTransactions || [],
        enhancedTransactions: results.enhancedTransactions || [],
        transactionLog: results.transactionLog || [],
        tradeAnalysis: results.tradeAnalysis || {},
        shortAndHoldResults: results.shortAndHoldResults || {},
        // Spec 59: Add shortAndHoldMetrics for frontend compatibility (alias for shortAndHoldResults)
        shortAndHoldMetrics: results.shortAndHoldResults || {},
        outperformance: results.outperformance || 0,
        outperformancePercent: results.outperformancePercent || 0,
        questionableEvents: results.questionableEvents || [],
        shorts: results.shorts || [],
        summary: {
          strategy: results.strategy,
          symbol: results.symbol,
          finalValue: results.shortDCAFinalValue,
          totalCost: results.maxCapitalDeployed || (results.finalShorts * normalizedParams.lotSizeUsd),
          lotsHeld: results.finalShorts,
          totalReturn: results.totalReturn,
          totalReturnPercent: results.totalReturnPercent,
          annualizedReturn: results.annualizedReturn,
          maxDrawdown: results.maxDrawdown,
          maxDrawdownPercent: results.maxDrawdownPercent,
          sharpeRatio: results.sharpeRatio,
          winRate: results.winRate,
          profitFactor: results.profitFactor || 0,
          avgWin: results.avgWin || 0,
          avgLoss: results.avgLoss || 0,
          totalTrades: results.totalTrades,
          executionTimeMs: executionTime
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('\n❌ SHORT DCA BACKTEST ERROR:', error);

    if (error.message && error.message.includes('validation')) {
      res.status(400).json({
        success: false,
        error: error.message || 'Invalid short selling strategy parameters',
        message: error.details || 'The provided parameters would likely result in 0 trades or unsafe risk levels. Please adjust the parameters.',
        validationErrors: error.validationErrors || [],
        receivedParameters: error.receivedParameters || {}
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Short DCA backtest failed',
        message: error.message || 'An unexpected error occurred during backtesting'
      });
    }
  }
});

// SSE Streaming endpoint for batch backtest progress
app.get('/api/backtest/batch/stream', (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'sessionId query parameter is required'
    });
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  console.log(`🔌 SSE connection established for session ${sessionId}`);

  // Initialize SSE connection
  sseHelpers.initSSE(res);

  // Register this connection with the session
  sessionManager.registerConnection(sessionId, res);

  // Send initial connection event
  sseHelpers.sendSSE(res, 'connected', {
    sessionId,
    message: 'Connected to progress stream'
  });

  // Set up keep-alive heartbeat (every 30 seconds)
  const keepAliveInterval = setInterval(() => {
    if (res.destroyed || res.closed) {
      clearInterval(keepAliveInterval);
      return;
    }
    sseHelpers.sendKeepAlive(res);
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    console.log(`🔌 SSE connection closed for session ${sessionId}`);
    clearInterval(keepAliveInterval);
    sessionManager.removeConnection(sessionId);
  });
});

app.post('/api/backtest/batch', validation.validateBatchBacktestParams, async (req, res) => {
  try {
    console.log('📊 Received batch backtest request');

    const { runBatchBacktest } = require('./services/batchBacktestService');

    const options = req.body;
    const { async: isAsync = false } = req.query; // Support async mode via query param

    // Validate required fields
    if (!options.parameterRanges) {
      return res.status(400).json({
        success: false,
        error: 'parameterRanges is required'
      });
    }

    // If symbols are at top level, merge them into parameterRanges
    if (options.symbols && !options.parameterRanges.symbols) {
      options.parameterRanges.symbols = options.symbols;
    }

    // If startDate/endDate are at top level, merge them into parameterRanges
    if (options.startDate && !options.parameterRanges.startDate) {
      options.parameterRanges.startDate = options.startDate;
    }
    if (options.endDate && !options.parameterRanges.endDate) {
      options.parameterRanges.endDate = options.endDate;
    }

    // ASYNC MODE: Create session and run backtest in background
    if (isAsync || isAsync === 'true') {
      const sessionId = sessionManager.createSession();
      console.log(`🔄 Starting async batch backtest with session ${sessionId}`);

      // Return session ID immediately
      res.json({
        success: true,
        sessionId,
        message: 'Batch backtest started. Connect to /api/backtest/batch/stream for progress updates.'
      });

      // Run backtest asynchronously (don't await)
      runBatchBacktest(options, null, sessionId).catch(error => {
        console.error('Async batch backtest error:', error);
        sessionManager.errorSession(sessionId, error.message);

        // Try to send error event via SSE if connection exists
        const connection = sessionManager.getConnection(sessionId);
        if (connection) {
          sseHelpers.sendSSE(connection, 'error', {
            sessionId,
            error: error.message
          });
          sseHelpers.closeSSE(connection);
          sessionManager.removeConnection(sessionId);
        }
      });

      return;
    }

    // SYNC MODE (backward compatible): Wait for results
    console.log('🚀 Starting synchronous batch backtest with options:', options);

    const startTime = Date.now();
    const results = await runBatchBacktest(options, null, null); // No progress callback or session
    const executionTime = Date.now() - startTime;

    console.log(`✅ Batch backtest completed in ${(executionTime / 1000).toFixed(1)}s`);
    console.log(`📈 Best result: ${results.summary?.overallBest?.summary?.annualizedReturn?.toFixed(2) || 'N/A'}% annualized return`);

    res.json({
      success: true,
      executionTimeMs: executionTime,
      data: results
    });

  } catch (error) {
    console.error('Batch backtest error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Short Selling Batch Backtest API endpoint
app.post('/api/backtest/short-batch', validation.validateBatchBacktestParams, async (req, res) => {
  try {
    console.log('📊 Received short selling batch backtest request');

    const { runShortBatchBacktest } = require('./services/shortBatchBacktestService');

    const options = req.body;

    // Validate required fields
    if (!options.parameterRanges) {
      return res.status(400).json({
        success: false,
        error: 'parameterRanges is required'
      });
    }

    // If symbols are at top level, merge them into parameterRanges
    if (options.symbols && !options.parameterRanges.symbols) {
      options.parameterRanges.symbols = options.symbols;
    }

    // If startDate/endDate are at top level, merge them into parameterRanges
    if (options.startDate && !options.parameterRanges.startDate) {
      options.parameterRanges.startDate = options.startDate;
    }
    if (options.endDate && !options.parameterRanges.endDate) {
      options.parameterRanges.endDate = options.endDate;
    }

    // Set up progress tracking for long-running batch tests
    let progressData = null;
    const progressCallback = (progress) => {
      progressData = progress;
      // Could implement WebSocket or Server-Sent Events here for real-time updates
    };

    console.log('🚀 Starting short selling batch backtest with options:', options);

    const startTime = Date.now();
    const results = await runShortBatchBacktest(options, progressCallback);
    const executionTime = Date.now() - startTime;

    console.log(`✅ Short selling batch backtest completed in ${(executionTime / 1000).toFixed(1)}s`);
    console.log(`📈 Best result: ${results.summary?.overallBest?.summary?.annualizedReturn?.toFixed(2) || 'N/A'}% annualized return`);

    res.json({
      success: true,
      executionTimeMs: executionTime,
      data: results
    });

  } catch (error) {
    console.error('Short selling batch backtest error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Beta parameter calculation API endpoint
app.post('/api/backtest/beta-parameters', async (req, res) => {
  try {
    const { symbol, coefficient = 1.0, baseParameters } = req.body;

    if (!symbol) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Symbol is required for beta parameter calculation',
        received: { symbol, coefficient }
      });
    }

    // Validate coefficient
    if (typeof coefficient !== 'number' || coefficient <= 0) {
      return res.status(400).json({
        error: 'Invalid coefficient value',
        message: 'Coefficient must be a positive number',
        received: { coefficient, type: typeof coefficient }
      });
    }

    console.log(`🧮 Calculating Beta parameters for ${symbol} with coefficient ${coefficient}`);

    // Calculate Beta-adjusted parameters using centralized BetaScalingService (Spec 43)
    const scalingResult = await betaScalingService.applyBetaScaling(
      baseParameters,
      symbol,
      {
        enableBetaScaling: true,
        coefficient
      }
    );

    if (!scalingResult.success) {
      return res.status(500).json({
        error: 'Beta scaling failed',
        message: scalingResult.errors.join('; '),
        warnings: scalingResult.warnings
      });
    }

    console.log(`✅ Beta parameters calculated: Beta=${scalingResult.betaInfo.beta}, Coefficient=${coefficient}, β-factor=${scalingResult.betaInfo.betaFactor?.toFixed(3) || 'N/A'}`);

    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        beta: scalingResult.betaInfo.beta,
        coefficient: scalingResult.betaInfo.coefficient,
        betaFactor: scalingResult.betaInfo.betaFactor,
        userParameters: scalingResult.baseParameters,
        adjustedParameters: {
          // Convert to percentages for frontend (if needed - check if frontend expects decimals or percentages)
          profitRequirement: scalingResult.adjustedParameters.profitRequirement * 100,
          gridIntervalPercent: scalingResult.adjustedParameters.gridIntervalPercent * 100,
          trailingBuyActivationPercent: scalingResult.adjustedParameters.trailingBuyActivationPercent * 100,
          trailingBuyReboundPercent: scalingResult.adjustedParameters.trailingBuyReboundPercent * 100,
          trailingSellActivationPercent: scalingResult.adjustedParameters.trailingSellActivationPercent * 100,
          trailingSellPullbackPercent: scalingResult.adjustedParameters.trailingSellPullbackPercent * 100
        },
        warnings: scalingResult.warnings,
        isValid: scalingResult.isValid,
        calculation: {
          formula: `Beta (${scalingResult.betaInfo.beta}) × Coefficient (${coefficient}) = β-factor (${scalingResult.betaInfo.betaFactor?.toFixed(3) || 'N/A'})`,
          example: `Profit Requirement = ${(scalingResult.baseParameters.profitRequirement * 100).toFixed(0)}% × ${scalingResult.betaInfo.betaFactor?.toFixed(3) || 'N/A'} = ${(scalingResult.adjustedParameters.profitRequirement * 100).toFixed(2)}%`
        }
      }
    });

  } catch (error) {
    console.error('Beta parameter calculation error:', error);
    res.status(500).json({
      error: 'Failed to calculate beta parameters',
      message: error.message
    });
  }
});

// Portfolio backtest API endpoint
app.post('/api/portfolio-backtest', async (req, res) => {
  try {
    const {
      totalCapital,
      startDate,
      endDate,
      lotSizeUsd,
      maxLotsPerStock = 10,
      defaultParams,
      stocks,
      // Extract ALL DCA parameters that might be at top level
      gridIntervalPercent,
      profitRequirement,
      trailingBuyActivationPercent,
      trailingBuyReboundPercent,
      trailingSellActivationPercent,
      trailingSellPullbackPercent,
      enableDynamicGrid,
      normalizeToReference,
      dynamicGridMultiplier,
      enableConsecutiveIncrementalSellProfit,
      enableConsecutiveIncrementalBuyGrid,
      gridConsecutiveIncrement,
      enableAdaptiveTrailingBuy,
      enableAdaptiveTrailingSell,
      trailingStopOrderType,
      maxLotsToSell,
      // Capital Optimization parameters
      enableCashYield,
      cashYieldAnnualPercent,
      cashYieldMinCash,
      enableDeferredSelling,
      deferredSellingThreshold,
      enableAdaptiveLotSizing,
      adaptiveLotCashThreshold,
      adaptiveLotMaxMultiplier,
      adaptiveLotIncreaseStep,
      // Beta scaling parameters
      _betaScaling,
      enableBetaScaling,
      coefficient,
      betaScalingCoefficient,  // Alternative name for coefficient
      beta,
      // Spec 45: Momentum-based trading
      momentumBasedBuy,
      momentumBasedSell,
      // Spec 61: Optimized capital discovery
      optimizedTotalCapital
    } = req.body;

    // Validation
    // Spec 61: totalCapital is optional when optimizedTotalCapital is true
    if (!optimizedTotalCapital && (!totalCapital || totalCapital <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid totalCapital',
        message: 'Total capital must be a positive number (or use optimizedTotalCapital: true to auto-discover)'
      });
    }

    if (!Array.isArray(stocks) || stocks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid stocks array',
        message: 'Please provide an array of stocks for the portfolio'
      });
    }

    if (!lotSizeUsd || lotSizeUsd <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid lotSizeUsd',
        message: 'Lot size must be a positive number'
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing date range',
        message: 'Both startDate and endDate are required'
      });
    }

    // Build defaultParams from top-level parameters if not provided
    // Only include defined parameters (skip undefined ones)
    const finalDefaultParams = defaultParams || Object.fromEntries(
      Object.entries({
        gridIntervalPercent,
        profitRequirement,
        trailingBuyActivationPercent,
        trailingBuyReboundPercent,
        trailingSellActivationPercent,
        trailingSellPullbackPercent,
        enableDynamicGrid,
        normalizeToReference,
        dynamicGridMultiplier,
        enableConsecutiveIncrementalSellProfit,
        enableConsecutiveIncrementalBuyGrid,
        gridConsecutiveIncrement,
        enableAdaptiveTrailingBuy,
        enableAdaptiveTrailingSell,
        trailingStopOrderType,
        maxLotsToSell,
        // Spec 45: Momentum-based trading
        momentumBasedBuy,
        momentumBasedSell
      }).filter(([_, value]) => value !== undefined)
    );

    // Build capital optimization config
    // Check both top-level and defaultParams for capital optimization settings
    const capitalOptimizationParams = {
      enableCashYield,
      cashYieldAnnualPercent,
      cashYieldMinCash,
      enableDeferredSelling,
      deferredSellingThreshold,
      enableAdaptiveLotSizing,
      adaptiveLotCashThreshold,
      adaptiveLotMaxMultiplier,
      adaptiveLotIncreaseStep
    };

    // Also check defaultParams for capital optimization settings
    const defaultParamsCapitalOpt = defaultParams || {};

    const capitalOptimizationConfig = {
      enabled:
        capitalOptimizationParams.enableCashYield ||
        capitalOptimizationParams.enableDeferredSelling ||
        capitalOptimizationParams.enableAdaptiveLotSizing ||
        defaultParamsCapitalOpt.enableCashYield ||
        defaultParamsCapitalOpt.enableDeferredSelling ||
        defaultParamsCapitalOpt.enableAdaptiveLotSizing ||
        false,
      strategies: [
        ...(capitalOptimizationParams.enableAdaptiveLotSizing || defaultParamsCapitalOpt.enableAdaptiveLotSizing ? ['adaptive_lot_sizing'] : []),
        ...(capitalOptimizationParams.enableCashYield || defaultParamsCapitalOpt.enableCashYield ? ['cash_yield'] : []),
        ...(capitalOptimizationParams.enableDeferredSelling || defaultParamsCapitalOpt.enableDeferredSelling ? ['deferred_selling'] : [])
      ],
      adaptiveLotSizing: {
        cashReserveThreshold: capitalOptimizationParams.adaptiveLotCashThreshold || defaultParamsCapitalOpt.adaptiveLotCashThreshold || totalCapital * 0.2,
        maxLotSizeMultiplier: capitalOptimizationParams.adaptiveLotMaxMultiplier || defaultParamsCapitalOpt.adaptiveLotMaxMultiplier || 2.0,
        increaseStepPercent: capitalOptimizationParams.adaptiveLotIncreaseStep || defaultParamsCapitalOpt.adaptiveLotIncreaseStep || 20
      },
      cashYield: {
        enabled: capitalOptimizationParams.enableCashYield || defaultParamsCapitalOpt.enableCashYield || false,
        annualYieldPercent: capitalOptimizationParams.cashYieldAnnualPercent || defaultParamsCapitalOpt.cashYieldAnnualPercent || 4.5,
        minCashToInvest: capitalOptimizationParams.cashYieldMinCash || defaultParamsCapitalOpt.cashYieldMinCash || Math.max(10000, totalCapital * 0.1)
      },
      deferredSelling: {
        enabled: capitalOptimizationParams.enableDeferredSelling || defaultParamsCapitalOpt.enableDeferredSelling || false,
        cashAbundanceThreshold: capitalOptimizationParams.deferredSellingThreshold || defaultParamsCapitalOpt.deferredSellingThreshold || totalCapital * 0.3
      }
    };

    // Handle both string arrays and object arrays for stocks
    const stockSymbols = stocks.map(s => typeof s === 'string' ? s : s.symbol);

    console.log(`📊 Portfolio backtest requested:`);
    console.log(`   Capital: ${totalCapital ? `$${totalCapital.toLocaleString()}` : 'Auto-discover (optimized mode)'}`);
    console.log(`   Lot Size: $${lotSizeUsd.toLocaleString()}`);
    console.log(`   Stocks: ${stocks.length} (${stockSymbols.join(', ')})`);
    console.log(`   Period: ${startDate} to ${endDate}`);
    console.log(`   finalDefaultParams:`, JSON.stringify(finalDefaultParams, null, 2));
    if (capitalOptimizationConfig.enabled) {
      console.log(`   💰 Capital Optimization: ENABLED`);
      console.log(`      Strategies: ${capitalOptimizationConfig.strategies.join(', ')}`);
      if (capitalOptimizationConfig.strategies.includes('cash_yield')) {
        console.log(`      Cash Yield: ${capitalOptimizationConfig.cashYield.annualYieldPercent}% annual`);
      }
      if (capitalOptimizationConfig.strategies.includes('deferred_selling')) {
        console.log(`      Deferred Selling: Skip sells when cash > $${capitalOptimizationConfig.deferredSelling.cashAbundanceThreshold.toLocaleString()}`);
      }
      if (capitalOptimizationConfig.strategies.includes('adaptive_lot_sizing')) {
        console.log(`      Adaptive Lot Sizing: ${capitalOptimizationConfig.adaptiveLotSizing.maxLotSizeMultiplier}x when cash > $${capitalOptimizationConfig.adaptiveLotSizing.cashReserveThreshold.toLocaleString()}`);
      }
    }

    const portfolioBacktestService = require('./services/portfolioBacktestService');

    // Handle beta scaling configuration
    const betaScalingConfig = _betaScaling || {
      enabled: enableBetaScaling || false,
      coefficient: coefficient || betaScalingCoefficient || 1.0,
      beta: beta
    };

    const config = {
      // Spec 61: When optimizedTotalCapital is true, use a default placeholder capital
      totalCapital: totalCapital || (optimizedTotalCapital ? 10000000 : null),
      startDate,
      endDate,
      lotSizeUsd,
      maxLotsPerStock,
      defaultParams: finalDefaultParams,
      stocks,
      capitalOptimization: capitalOptimizationConfig,
      betaScaling: betaScalingConfig,
      // Spec 61: Optimized capital discovery
      optimizedTotalCapital: optimizedTotalCapital || false
    };

    const results = await portfolioBacktestService.runPortfolioBacktest(config);

    // Spec 61: Handle two-scenario response format
    if (results.success && results.data && results.data.scenarios) {
      // Optimized capital mode returns two scenarios
      const { optimal, constrained } = results.data.scenarios;
      console.log(`✅ Portfolio backtest complete (Optimized Capital Mode):`);
      console.log(`   Discovered Optimal Capital: $${results.data.capitalDiscovery.peakDeployedCapital?.toLocaleString() || 'N/A'}`);
      console.log(`   Optimal Final Value: $${optimal?.portfolioSummary?.finalPortfolioValue?.toLocaleString() || 'N/A'}`);
      console.log(`   Constrained Final Value: $${constrained?.portfolioSummary?.finalPortfolioValue?.toLocaleString() || 'N/A'}`);
      console.log(`   Constrained Rejected Orders: ${constrained?.capitalAnalysis?.rejectedOrderCount || 0}`);

      // Return the two-scenario response directly
      res.json(results);
    } else {
      // Standard single-scenario mode
      console.log(`✅ Portfolio backtest complete:`);
      console.log(`   Final Value: $${results.portfolioSummary?.finalPortfolioValue?.toLocaleString() || 'N/A'}`);
      console.log(`   Total Return: ${results.portfolioSummary?.totalReturnPercent?.toFixed(2) || 'N/A'}%`);
      console.log(`   CAGR: ${results.portfolioSummary?.cagr?.toFixed(2) || 'N/A'}%`);
      console.log(`   Capital Utilization: ${results.portfolioSummary?.capitalUtilizationPercent?.toFixed(1) || 'N/A'}%`);
      console.log(`   Rejected Buys: ${results.portfolioSummary?.rejectedBuys || 0}`);

      // Cache results for drill-down
      const portfolioResultsCache = require('./services/portfolioResultsCache');
      if (results.portfolioRunId) {
        portfolioResultsCache.set(results.portfolioRunId, results);
      }

      res.json({
        success: true,
        data: results
      });
    }

  } catch (error) {
    console.error('Portfolio backtest error:', error);
    res.status(500).json({
      success: false,
      error: 'Portfolio backtest failed',
      message: error.message
    });
  }
});

// Config-based portfolio backtest endpoints
const portfolioConfigLoader = require('./services/portfolioConfigLoader');

// POST endpoint - Run portfolio backtest from config file
app.post('/api/backtest/portfolio/config', async (req, res) => {
  try {
    const { configFile } = req.body;

    if (!configFile) {
      return res.status(400).json({
        success: false,
        error: 'Missing configFile parameter',
        message: 'Please provide a configFile name (e.g., "nasdaq100.json" or "nasdaq100")'
      });
    }

    console.log(`📋 Portfolio config backtest requested: ${configFile}`);

    // Load and validate config
    const config = await portfolioConfigLoader.loadPortfolioConfig(configFile);

    // Convert config to backtest parameters
    const backtestParams = portfolioConfigLoader.configToBacktestParams(config);

    // Run backtest using existing service
    const portfolioBacktestService = require('./services/portfolioBacktestService');
    const results = await portfolioBacktestService.runPortfolioBacktest(backtestParams);

    console.log(`✅ Config-based portfolio backtest complete:`);
    console.log(`   Portfolio: ${config.name}`);
    console.log(`   Stocks: ${config.stocks.length}`);
    console.log(`   Final Value: $${results.portfolioSummary.finalPortfolioValue.toLocaleString()}`);
    console.log(`   Total Return: ${results.portfolioSummary.totalReturnPercent?.toFixed(2) || 'N/A'}%`);

    // Cache results for drill-down
    const portfolioResultsCache = require('./services/portfolioResultsCache');
    portfolioResultsCache.set(results.portfolioRunId, results);

    res.json({
      success: true,
      data: results,
      meta: {
        configFile: configFile,
        portfolioName: config.name,
        portfolioDescription: config.description
      }
    });

  } catch (error) {
    console.error('Config-based portfolio backtest error:', error);
    res.status(400).json({
      success: false,
      error: 'Config-based portfolio backtest failed',
      message: error.message
    });
  }
});

// GET endpoint - Run portfolio backtest from config name (simplified URL)
app.get('/api/backtest/portfolio/config/:configName', async (req, res) => {
  try {
    const { configName } = req.params;
    const { rerun } = req.query;

    console.log(`📋 Portfolio config backtest requested (GET): ${configName}${rerun ? ' [RERUN FORCED]' : ''}`);

    // Load and validate config
    const config = await portfolioConfigLoader.loadPortfolioConfig(configName);

    // Convert config to backtest parameters
    const backtestParams = portfolioConfigLoader.configToBacktestParams(config);

    // Run backtest using existing service
    const portfolioBacktestService = require('./services/portfolioBacktestService');
    const results = await portfolioBacktestService.runPortfolioBacktest(backtestParams);

    // Set cache-control headers to prevent browser caching
    // This ensures fresh results on every request, especially with rerun=true
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    // Spec 61: Handle two-scenario response format
    if (results.success && results.data && results.data.scenarios) {
      // Optimized capital mode returns two scenarios
      const { optimal, constrained } = results.data.scenarios;
      console.log(`✅ Config-based portfolio backtest complete (Optimized Capital Mode):`);
      console.log(`   Portfolio: ${config.name}`);
      console.log(`   Stocks: ${config.stocks.length}`);
      console.log(`   Discovered Optimal Capital: $${results.data.capitalDiscovery?.peakDeployedCapital?.toLocaleString() || 'N/A'}`);
      console.log(`   Optimal Final Value: $${optimal?.portfolioSummary?.finalPortfolioValue?.toLocaleString() || 'N/A'}`);
      console.log(`   Constrained Final Value: $${constrained?.portfolioSummary?.finalPortfolioValue?.toLocaleString() || 'N/A'}`);
      console.log(`   Constrained Rejected Orders: ${constrained?.capitalAnalysis?.rejectedOrderCount || 0}`);

      // Return the two-scenario response directly with meta
      res.json({
        ...results,
        meta: {
          configFile: `${configName}.json`,
          portfolioName: config.name,
          portfolioDescription: config.description,
          rerun: rerun === 'true' || rerun === '1'
        }
      });
    } else {
      // Standard single-scenario mode
      console.log(`✅ Config-based portfolio backtest complete:`);
      console.log(`   Portfolio: ${config.name}`);
      console.log(`   Stocks: ${config.stocks.length}`);
      console.log(`   Final Value: $${results.portfolioSummary?.finalPortfolioValue?.toLocaleString() || 'N/A'}`);
      console.log(`   Total Return: ${results.portfolioSummary?.totalReturnPercent?.toFixed(2) || 'N/A'}%`);

      // Cache results for drill-down
      const portfolioResultsCache = require('./services/portfolioResultsCache');
      if (results.portfolioRunId) {
        portfolioResultsCache.set(results.portfolioRunId, results);
      }

      res.json({
        success: true,
        data: results,
        meta: {
          configFile: `${configName}.json`,
          portfolioName: config.name,
          portfolioDescription: config.description,
          rerun: rerun === 'true' || rerun === '1'
        }
      });
    }

  } catch (error) {
    console.error('Config-based portfolio backtest error:', error);
    res.status(400).json({
      success: false,
      error: 'Config-based portfolio backtest failed',
      message: error.message
    });
  }
});

// Helper function to convert portfolio transactions to enhanced DCA format
function convertPortfolioTransactionsToDCAFormat(transactions, priceData) {
  const enhancedTransactions = [];
  let lots = [];
  let realizedPNL = 0;

  // Create a date-to-price map for quick lookups
  const priceMap = new Map();
  if (priceData && priceData.dailyPrices) {
    priceData.dailyPrices.forEach(day => {
      priceMap.set(day.date, parseFloat(day.adjusted_close || day.close));
    });
  }

  for (const tx of transactions) {
    const currentPrice = priceMap.get(tx.date) || tx.price;

    if (tx.type && tx.type.includes('BUY')) {
      // Add lot to holdings
      lots.push({ price: tx.price, shares: tx.shares, date: tx.date });

      // Calculate metrics
      const totalShares = lots.reduce((sum, lot) => sum + lot.shares, 0);
      const totalCost = lots.reduce((sum, lot) => sum + (lot.price * lot.shares), 0);
      const averageCost = totalShares > 0 ? totalCost / totalShares : 0;
      const marketValue = totalShares * currentPrice;
      const unrealizedPNL = marketValue - totalCost;

      enhancedTransactions.push({
        date: tx.date,
        type: 'TRAILING_STOP_LIMIT_BUY', // Frontend expects this type
        price: tx.price,
        shares: tx.shares,
        amount: tx.value || (tx.price * tx.shares),
        quantity: tx.shares, // Add explicit quantity field
        lotsAfterTransaction: lots.map(l => ({ ...l })), // Deep copy
        averageCost,
        unrealizedPNL,
        realizedPNL,
        totalPNL: realizedPNL + unrealizedPNL,
        pnl: 0, // No P&L on buy transactions
        realizedPNLFromTrade: 0,
        ocoOrderDetail: null,
        trailingStopDetail: null
      });

    } else if (tx.type && tx.type.includes('SELL')) {
      // Calculate P&L before removing lots
      const soldValue = tx.value || (tx.price * tx.shares);
      const soldCost = tx.lotsCost || 0;
      const tradeProfit = soldValue - soldCost;
      realizedPNL += tradeProfit;

      // Remove sold lots
      if (tx.lotsDetails && Array.isArray(tx.lotsDetails)) {
        for (const soldLot of tx.lotsDetails) {
          const index = lots.findIndex(l =>
            Math.abs(l.price - soldLot.price) < 0.01 &&
            l.date === soldLot.date
          );
          if (index !== -1) {
            lots.splice(index, 1);
          }
        }
      }

      // Recalculate metrics after sell
      const totalShares = lots.reduce((sum, lot) => sum + lot.shares, 0);
      const totalCost = lots.reduce((sum, lot) => sum + (lot.price * lot.shares), 0);
      const averageCost = totalShares > 0 ? totalCost / totalShares : 0;
      const marketValue = totalShares * currentPrice;
      const unrealizedPNL = marketValue - totalCost;

      enhancedTransactions.push({
        date: tx.date,
        type: 'SELL',
        price: tx.price,
        shares: tx.shares,
        amount: soldValue,
        quantity: tx.shares, // Add explicit quantity field
        lotsDetails: tx.lotsDetails || [],
        lotsAfterTransaction: lots.map(l => ({ ...l })), // Deep copy
        averageCost,
        unrealizedPNL,
        realizedPNL,
        totalPNL: realizedPNL + unrealizedPNL,
        pnl: tradeProfit, // P&L for this specific sell
        realizedPNLFromTrade: tradeProfit,
        ocoOrderDetail: null
      });
    }
  }

  return enhancedTransactions;
}

// Portfolio stock results endpoint - retrieve individual stock from cached portfolio run
app.get('/api/portfolio-backtest/:runId/stock/:symbol/results', async (req, res) => {
  try {
    const { runId, symbol } = req.params;

    console.log(`📋 Portfolio stock results requested: ${symbol} from run ${runId}`);

    const portfolioResultsCache = require('./services/portfolioResultsCache');
    const portfolioResults = portfolioResultsCache.get(runId);

    if (!portfolioResults) {
      return res.status(404).json({
        success: false,
        error: 'Portfolio run not found',
        message: 'This portfolio run does not exist. It may have been cleared when the server restarted. Please re-run the portfolio backtest.'
      });
    }

    // Find stock data in results
    const stockData = portfolioResults.stockResults.find(s => s.symbol === symbol);

    if (!stockData) {
      return res.status(404).json({
        success: false,
        error: 'Stock not found in portfolio',
        message: `Stock ${symbol} was not part of portfolio run ${runId}`
      });
    }

    // Convert portfolio transactions to enhanced DCA format
    const enhancedTransactions = convertPortfolioTransactionsToDCAFormat(
      stockData.transactions,
      stockData.priceData
    );

    // Convert to DCA backtest result format (compatible with existing results page)
    const dcaFormatResult = {
      symbol: stockData.symbol,
      strategyMode: 'long',
      parameters: {
        ...portfolioResults.parameters.defaultParams,
        ...stockData.params,
        lotSizeUsd: portfolioResults.parameters.lotSizeUsd,
        maxLots: portfolioResults.parameters.maxLotsPerStock
      },

      // Provide both enhanced and original transactions
      transactions: enhancedTransactions,
      enhancedTransactions: enhancedTransactions,

      // Add "Insufficient Capital" events as special transactions
      insufficientCapitalEvents: stockData.rejectedOrders.map(order => ({
        date: order.date,
        type: 'INSUFFICIENT_CAPITAL',
        attemptedPrice: order.price,
        attemptedShares: order.attemptedValue / order.price,
        attemptedValue: order.attemptedValue,
        availableCapital: order.availableCapital,
        shortfall: order.shortfall,
        reason: 'Portfolio capital deployed to other stocks',
        competingStocks: order.competingStocks || []
      })),

      // Metrics
      summary: {
        symbol: stockData.symbol,
        startDate: portfolioResults.parameters.startDate,
        endDate: portfolioResults.parameters.endDate,
        totalReturn: stockData.totalPNL,
        totalReturnPercent: stockData.stockReturnPercent,
        totalCost: stockData.maxCapitalDeployed,
        realizedPNL: stockData.realizedPNL,
        unrealizedPNL: stockData.unrealizedPNL,
        totalBuys: stockData.totalBuys,
        totalSells: stockData.totalSells,
        rejectedBuys: stockData.rejectedBuys,
        cagr: stockData.cagr,
        sharpeRatio: stockData.sharpeRatio,
        maxDrawdown: stockData.maxDrawdown,
        maxDrawdownPercent: stockData.maxDrawdownPercent,
        performanceMetrics: {
          avgDeployedCapital: stockData.avgCapitalDeployed || stockData.maxCapitalDeployed,
          maxCapitalDeployed: stockData.maxCapitalDeployed
        }
      },

      // Price data for charting
      priceData: stockData.priceData,

      // Portfolio context
      portfolioContext: {
        fromPortfolio: true,
        portfolioRunId: runId,
        totalCapital: portfolioResults.portfolioSummary.totalCapital,
        stocksInPortfolio: portfolioResults.stockResults.map(s => s.symbol),
        contributionToPortfolio: stockData.contributionToPortfolioReturn,
        dateRange: {
          startDate: portfolioResults.parameters.startDate,
          endDate: portfolioResults.parameters.endDate
        }
      }
    };

    // Calculate Buy & Hold comparison for this stock
    const { calculateBuyAndHold } = require('./services/dcaBacktestService');
    const initialCapital = portfolioResults.parameters.lotSizeUsd * portfolioResults.parameters.maxLotsPerStock;
    const avgCapitalForComparison = stockData.maxCapitalDeployed || initialCapital;

    // Transform priceData to use adjusted_close (calculateBuyAndHold expects this property)
    const pricesForBuyAndHold = stockData.priceData.map(p => ({
      ...p,
      adjusted_close: p.adjusted_close || p.close
    }));

    const buyAndHoldResults = calculateBuyAndHold(
      pricesForBuyAndHold,
      initialCapital,
      avgCapitalForComparison
    );

    // Calculate outperformance metrics
    const dcaFinalValue = stockData.totalPNL + (stockData.maxCapitalDeployed || initialCapital);
    const outperformance = dcaFinalValue - buyAndHoldResults.finalValue;
    const outperformancePercent = stockData.stockReturnPercent - buyAndHoldResults.totalReturnPercent;

    // Add Buy & Hold results to response
    dcaFormatResult.buyAndHoldResults = buyAndHoldResults;
    // Spec 59: Add buyAndHoldMetrics for frontend compatibility (alias for buyAndHoldResults)
    dcaFormatResult.buyAndHoldMetrics = buyAndHoldResults;
    dcaFormatResult.outperformance = outperformance;
    dcaFormatResult.outperformancePercent = outperformancePercent;

    // Build standalone test URL with same parameters (without portfolio capital constraints)
    // Convert decimal percentage parameters to whole numbers for URL (0.1 → 10)
    const percentageParams = [
      'gridIntervalPercent',
      'profitRequirement',
      'trailingBuyActivationPercent',
      'trailingBuyReboundPercent',
      'trailingSellActivationPercent',
      'trailingSellPullbackPercent',
      'stopLossPercent',
      'gridConsecutiveIncrement'
    ];

    const urlParams = {};

    // Get the actual params used for this specific stock (which may override defaultParams)
    const stockParams = stockData.params || portfolioResults.parameters.defaultParams;

    // Iterate through stock-specific parameters first, then fill in from defaultParams
    const allParams = { ...portfolioResults.parameters.defaultParams, ...stockParams };

    for (const [key, value] of Object.entries(allParams)) {
      if (value === undefined || value === null) continue;

      // Convert decimal percentages to whole numbers for URL
      if (percentageParams.includes(key) && typeof value === 'number') {
        urlParams[key] = (value * 100).toString();
      } else if (typeof value === 'boolean') {
        urlParams[key] = value.toString();
      } else if (typeof value === 'number') {
        urlParams[key] = value.toString();
      } else if (typeof value === 'string') {
        urlParams[key] = value;
      }
    }

    const standaloneParams = new URLSearchParams({
      startDate: portfolioResults.parameters.startDate,
      endDate: portfolioResults.parameters.endDate,
      lotSizeUsd: portfolioResults.parameters.lotSizeUsd.toString(),
      maxLots: portfolioResults.parameters.maxLotsPerStock.toString(),
      ...urlParams
    });

    const standaloneTestUrl = `/backtest/long/${symbol}/results?${standaloneParams.toString()}`;

    console.log(`✅ Retrieved ${symbol} from portfolio run ${runId}`);

    res.json({
      success: true,
      data: dcaFormatResult,
      metadata: {
        source: 'portfolio',
        portfolioRunId: runId,
        portfolioCapital: portfolioResults.portfolioSummary.totalCapital,
        standaloneTestUrl: standaloneTestUrl,
        standaloneTestNote: 'Test this stock with the same parameters but without portfolio capital constraints'
      }
    });

  } catch (error) {
    console.error('Error fetching portfolio stock results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stock results',
      message: error.message
    });
  }
});

// Batch data refresh API endpoint
app.post('/api/batch/refresh-data', async (req, res) => {
  try {
    const { symbols = [], forceRefresh = true, includeBeta = true, includeStockData = true } = req.body;

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid symbols array',
        message: 'Please provide an array of stock symbols to refresh'
      });
    }

    console.log(`🔄 Batch refresh requested for ${symbols.length} symbols: ${symbols.join(', ')}`);
    const startTime = Date.now();

    const results = {
      successful: [],
      failed: [],
      summary: {
        total: symbols.length,
        successful: 0,
        failed: 0,
        totalTime: 0
      }
    };

    // Create concurrent operations for stock data and beta refresh
    const refreshPromises = symbols.map(async (symbol) => {
      const symbolStartTime = Date.now();
      const result = {
        symbol: symbol.toUpperCase(),
        stockDataUpdated: false,
        betaUpdated: false,
        newBeta: null,
        timing: 0,
        errors: []
      };

      try {
        // Refresh stock data if requested
        if (includeStockData) {
          try {
            let stock = await database.getStock(symbol);
            if (!stock) {
              const stockId = await database.createStock(symbol);
              stock = { id: stockId, symbol: symbol.toUpperCase() };
            }

            await stockDataService.updateStockData(stock.id, symbol, {
              updatePrices: true,
              updateFundamentals: true,
              updateCorporateActions: true,
              forceRefresh: forceRefresh
            });
            await database.updateStockTimestamp(stock.id);
            result.stockDataUpdated = true;
            console.log(`✅ Stock data updated for ${symbol}`);
          } catch (error) {
            result.errors.push(`Stock data: ${error.message}`);
            console.error(`❌ Stock data update failed for ${symbol}:`, error.message);
          }
        }

        // Refresh beta data if requested
        if (includeBeta) {
          try {
            // Force fresh beta fetch by clearing cache first
            const stock = await database.getStock(symbol);
            if (stock) {
              await database.deleteBeta(stock.id);
            }

            const betaDataService = require('./services/betaDataService');
            const betaData = await betaDataService.fetchBeta(symbol);
            result.betaUpdated = true;
            result.newBeta = betaData.beta;
            console.log(`✅ Beta updated for ${symbol}: ${betaData.beta}`);
          } catch (error) {
            result.errors.push(`Beta: ${error.message}`);
            console.error(`❌ Beta update failed for ${symbol}:`, error.message);
          }
        }

        result.timing = Date.now() - symbolStartTime;

        if (result.stockDataUpdated || result.betaUpdated) {
          results.successful.push(result);
        } else {
          results.failed.push({
            symbol: result.symbol,
            errors: result.errors,
            timing: result.timing
          });
        }

      } catch (error) {
        result.errors.push(`General: ${error.message}`);
        result.timing = Date.now() - symbolStartTime;
        results.failed.push({
          symbol: result.symbol,
          errors: result.errors,
          timing: result.timing
        });
        console.error(`❌ Complete failure for ${symbol}:`, error.message);
      }
    });

    // Execute all refresh operations concurrently
    await Promise.allSettled(refreshPromises);

    // Calculate final summary
    results.summary.successful = results.successful.length;
    results.summary.failed = results.failed.length;
    results.summary.totalTime = Date.now() - startTime;

    console.log(`🏁 Batch refresh completed: ${results.summary.successful}/${results.summary.total} successful in ${results.summary.totalTime}ms`);

    res.json({
      success: true,
      results: results,
      message: `Batch refresh completed: ${results.summary.successful}/${results.summary.total} symbols updated successfully`
    });

  } catch (error) {
    console.error('Batch refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Batch refresh failed',
      message: error.message
    });
  }
});

// Beta API routes (Spec 42)
const betaRoutes = require('./routes/betaRoutes');
app.use('/api/beta', betaRoutes);

// Clear portfolio config cache endpoint
app.post('/api/config/clear-cache', (req, res) => {
  try {
    portfolioConfigLoader.clearConfigCache();
    res.json({
      success: true,
      message: 'Portfolio config cache cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Test Automation API (Spec 56)
app.post('/api/test/automated', async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || typeof description !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Test description is required and must be a string'
      });
    }

    console.log(`\n🎯 Automated Test Request: ${description}`);

    const testAutomationService = require('./services/testAutomationService');
    const result = await testAutomationService.runAutomatedTest(description);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Automated test failed:', error);

    res.status(500).json({
      error: 'Test Execution Error',
      message: error.message,
      details: error.stack
    });
  }
});

// Get test archive index
app.get('/api/test/archives', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const testResultsDir = path.join(__dirname, '../test-results');

    await fs.mkdir(testResultsDir, { recursive: true });
    const entries = await fs.readdir(testResultsDir, { withFileTypes: true });
    const archives = [];

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'index.html') {
        try {
          const metadataPath = path.join(testResultsDir, entry.name, 'metadata.json');
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
          archives.push({ ...metadata, folder: entry.name });
        } catch (error) {
          // Skip directories without metadata
        }
      }
    }

    // Sort by timestamp (newest first)
    archives.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: archives
    });

  } catch (error) {
    console.error('❌ Failed to fetch test archives:', error);

    res.status(500).json({
      error: 'Archive Retrieval Error',
      message: error.message
    });
  }
});

// ============================================================================
// Database Viewer Routes (integrated from db-viewer.js)
// ============================================================================

// Get list of tables with row counts
app.get('/api/db/tables', (req, res) => {
  const db = database.db;

  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      return res.json({ error: err.message });
    }

    const tablePromises = tables.map(table => {
      return new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, row) => {
          if (err) reject(err);
          else resolve({ name: table.name, count: row.count });
        });
      });
    });

    Promise.all(tablePromises)
      .then(tablesWithCounts => {
        res.json({ tables: tablesWithCounts });
      })
      .catch(err => {
        res.json({ error: err.message });
      });
  });
});

// Get database schema
app.get('/api/db/schema', (req, res) => {
  const db = database.db;

  db.all("SELECT name, sql FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) {
      res.json({ error: err.message });
    } else {
      res.json({ tables: rows });
    }
  });
});

// Execute SQL query (read-only)
app.post('/api/db/query', (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  // Basic security check - only allow SELECT queries
  const trimmedQuery = query.trim().toUpperCase();
  if (!trimmedQuery.startsWith('SELECT')) {
    return res.status(403).json({ error: 'Only SELECT queries are allowed' });
  }

  const db = database.db;

  db.all(query, (err, rows) => {
    if (err) {
      res.json({ error: err.message });
    } else {
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      res.json({ columns, rows });
    }
  });
});

// Database viewer UI (accessible at /db-viewer)
app.get('/db-viewer', (req, res) => {
  const dbViewerHTML = require('fs').readFileSync(require('path').join(__dirname, 'db-viewer.html'), 'utf8');
  res.send(dbViewerHTML.replace(/http:\/\/localhost:8080/g, ''));
});

// Database info endpoint - Get database statistics
app.get('/api/db/info', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const dbPath = path.join(__dirname, 'stocks.db');

  try {
    // Check if database file exists
    if (!fs.existsSync(dbPath)) {
      return res.json({
        error: 'Database file not found',
        path: dbPath
      });
    }

    const stats = fs.statSync(dbPath);
    const db = database.db; // Access the sqlite3 database instance directly

    // Get row counts for main tables
    const queries = [
      { name: 'stocks', query: 'SELECT COUNT(*) as count FROM stocks' },
      { name: 'daily_prices', query: 'SELECT COUNT(*) as count FROM daily_prices' },
      { name: 'stock_beta', query: 'SELECT COUNT(*) as count FROM stock_beta' },
      { name: 'corporate_actions', query: 'SELECT COUNT(*) as count FROM corporate_actions' },
      { name: 'technical_indicators', query: 'SELECT COUNT(*) as count FROM technical_indicators' }
    ];

    const countPromises = queries.map(item => {
      return new Promise((resolve, reject) => {
        db.get(item.query, (err, row) => {
          if (err) {
            // Table might not exist, return 0
            resolve({ table: item.name, count: 0 });
          } else {
            resolve({ table: item.name, count: row.count });
          }
        });
      });
    });

    Promise.all(countPromises)
      .then(tableCounts => {
        const totalRows = tableCounts.reduce((sum, item) => sum + item.count, 0);

        res.json({
          database: {
            path: dbPath,
            exists: true,
            size_bytes: stats.size,
            size_mb: (stats.size / 1024 / 1024).toFixed(2),
            modified: stats.mtime,
            created: stats.birthtime
          },
          tables: tableCounts,
          summary: {
            total_rows: totalRows,
            stocks_count: tableCounts.find(t => t.table === 'stocks')?.count || 0,
            price_records: tableCounts.find(t => t.table === 'daily_prices')?.count || 0,
            beta_values: tableCounts.find(t => t.table === 'stock_beta')?.count || 0
          },
          server: {
            hostname: require('os').hostname(),
            platform: process.platform,
            node_version: process.version,
            uptime_seconds: process.uptime()
          }
        });
      })
      .catch(err => {
        res.status(500).json({ error: err.message });
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Database table viewer endpoint (parametric route - must be AFTER specific /api/db/* routes)
app.get('/api/db/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const { limit = 50, where } = req.query;

    // Security: only allow specific tables
    const allowedTables = ['stocks', 'daily_prices', 'quarterly_fundamentals', 'corporate_actions'];
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Table not allowed' });
    }

    let sql = `SELECT * FROM ${table}`;
    if (where) {
      sql += ` WHERE ${where}`;
    }
    sql += ` ORDER BY id DESC LIMIT ${parseInt(limit)}`;

    const rows = await new Promise((resolve, reject) => {
      database.db.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ table, rows, count: rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database viewer available at http://localhost:${PORT}/db-viewer`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  database.close();
  process.exit(0);
});
