require('dotenv').config();
const express = require('express');
const cors = require('cors');
const database = require('./database');
const stockDataService = require('./services/stockDataService');
const validation = require('./middleware/validation');

const app = express();
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
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Stock Trading API is running' });
});

// Get stock data with all metrics
app.get('/api/stocks/:symbol', validation.validateSymbolParam, validation.validateQueryDateRange, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { startDate, endDate } = req.query;

    console.log(`\n🔍 API REQUEST: /api/stocks/${symbol.toUpperCase()}`);
    if (req.query.force) console.log(`   🔄 FORCE REFRESH requested`);

    // Validate requested date range for backtesting
    let dataValidationErrors = [];

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const today = new Date();
      const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());

      if (start < fiveYearsAgo) {
        dataValidationErrors.push(`Start date ${startDate} is older than 5 years. Available data limited to ${fiveYearsAgo.toISOString().split('T')[0]} onwards.`);
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

    // Validate sufficient data for backtesting
    if (startDate && endDate && dailyPrices.length < 30) {
      dataValidationErrors.push(`Limited data available: Only ${dailyPrices.length} trading days found for the requested period. Minimum 30 days recommended for reliable backtesting.`);
    }

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

// Database viewer endpoint
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
    let params = [];
    
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

// DCA Backtesting API endpoints
app.post('/api/backtest/dca', validation.validateDCABacktestParams, async (req, res) => {
  try {
    console.log('=== DEBUG: LONG DCA ENDPOINT CALLED ===');
    console.log('Strategy Mode in request:', req.body.strategyMode);
    console.log('Full request body:', req.body);
    console.log('=====================================');

    // Merge request parameters with shared defaults
    const params = backtestConfig.mergeWithDefaults(req.body);

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
      enableBetaScaling,
      isManualBetaOverride
    } = params;

    // Process Beta-adjusted parameters if Beta scaling is enabled
    let finalParams = { ...params };
    let betaInfo = null;

    if (enableBetaScaling && beta) {
      try {
        const parameterCorrelationService = require('./services/parameterCorrelationService');

        // Use coefficient from request, default to 1.0 if not provided
        const coefficientValue = coefficient !== undefined ? coefficient : 1.0;
        const betaResult = parameterCorrelationService.calculateBetaAdjustedParameters(beta, coefficient, {
          profitRequirement: profitRequirement / 100, // Convert from percentage
          gridIntervalPercent: gridIntervalPercent / 100,
          trailingBuyActivationPercent: trailingBuyActivationPercent / 100,
          trailingBuyReboundPercent: trailingBuyReboundPercent / 100,
          trailingSellActivationPercent: trailingSellActivationPercent / 100,
          trailingSellPullbackPercent: trailingSellPullbackPercent / 100
        });

        // Update parameters with Beta-adjusted values (convert back to percentages)
        finalParams = {
          ...finalParams,
          profitRequirement: betaResult.adjustedParameters.profitRequirement * 100,
          gridIntervalPercent: betaResult.adjustedParameters.gridIntervalPercent * 100,
          trailingBuyActivationPercent: betaResult.adjustedParameters.trailingBuyActivationPercent * 100,
          trailingBuyReboundPercent: betaResult.adjustedParameters.trailingBuyReboundPercent * 100,
          trailingSellActivationPercent: betaResult.adjustedParameters.trailingSellActivationPercent * 100,
          trailingSellPullbackPercent: betaResult.adjustedParameters.trailingSellPullbackPercent * 100
        };

        betaInfo = {
          beta: betaResult.beta,
          coefficient: betaResult.coefficient,
          betaFactor: betaResult.betaFactor,
          baseParameters: {
            profitRequirement: profitRequirement,
            gridIntervalPercent: gridIntervalPercent,
            trailingBuyActivationPercent: trailingBuyActivationPercent,
            trailingBuyReboundPercent: trailingBuyReboundPercent,
            trailingSellActivationPercent: trailingSellActivationPercent,
            trailingSellPullbackPercent: trailingSellPullbackPercent
          },
          adjustedParameters: {
            profitRequirement: finalParams.profitRequirement,
            gridIntervalPercent: finalParams.gridIntervalPercent,
            trailingBuyActivationPercent: finalParams.trailingBuyActivationPercent,
            trailingBuyReboundPercent: finalParams.trailingBuyReboundPercent,
            trailingSellActivationPercent: finalParams.trailingSellActivationPercent,
            trailingSellPullbackPercent: finalParams.trailingSellPullbackPercent
          },
          warnings: betaResult.warnings,
          isValid: betaResult.isValid,
          isManualOverride: isManualBetaOverride || false
        };

        console.log(`🧮 Beta scaling applied: Beta=${beta}, Warnings=${betaResult.warnings.length}`);
        if (betaResult.warnings.length > 0) {
          console.log('⚠️  Beta warnings:', betaResult.warnings);
        }

      } catch (error) {
        console.error('Error applying Beta scaling:', error);
        // Continue with original parameters if Beta scaling fails
        betaInfo = {
          error: `Beta scaling failed: ${error.message}`,
          beta: beta,
          coefficient: 1.0,
          betaFactor: beta, // When scaling fails, beta_factor = beta * 1.0 = beta
          fallbackToOriginal: true
        };
      }
    }

    // Save updated parameters to config (for consistency between CLI and UI)
    backtestConfig.saveDefaults({ ...finalParams, strategyMode: 'long' });

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

    // Validate date range (5-year limit and logical dates)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());

    if (start < fiveYearsAgo) {
      return res.status(400).json({
        error: 'Date range out of bounds',
        message: `Start date ${startDate} is older than 5 years. Backtesting limited to data from ${fiveYearsAgo.toISOString().split('T')[0]} onwards.`,
        availableFrom: fiveYearsAgo.toISOString().split('T')[0]
      });
    }

    if (end > today) {
      return res.status(400).json({
        error: 'Date range out of bounds',
        message: `End date ${endDate} is in the future. Latest available date is ${today.toISOString().split('T')[0]}.`,
        availableTo: today.toISOString().split('T')[0]
      });
    }

    if (start >= end) {
      return res.status(400).json({
        error: 'Invalid date range',
        message: `Start date ${startDate} must be before end date ${endDate}.`
      });
    }

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

    // Check if stock has any price data
    if (!needsDataFetch) {
      const existingPrices = await database.getDailyPrices(stock.id, startDate, endDate);
      if (!existingPrices || existingPrices.length === 0) {
        console.log(`📊 No price data found for ${symbol}, fetching data...`);
        needsDataFetch = true;
      }
    }

    // Fetch data if needed
    if (needsDataFetch) {
      try {
        console.log(`📡 Fetching data for ${symbol}...`);
        await stockDataService.updateStockData(stock.id, symbol, {
          updatePrices: true,
          updateFundamentals: true,
          updateCorporateActions: true
        });
        await database.updateStockTimestamp(stock.id);
      } catch (fetchError) {
        return res.status(503).json({
          error: 'Unable to fetch stock data',
          message: `Could not retrieve data for symbol ${symbol}. The symbol may not exist or the data provider may be temporarily unavailable.`,
          details: fetchError.message
        });
      }
    }

    // Get daily prices for the backtest period
    const dailyPrices = await database.getDailyPrices(stock.id, startDate, endDate);

    // Validate sufficient data for backtesting
    if (!dailyPrices || dailyPrices.length === 0) {
      return res.status(404).json({
        error: 'No data available for backtest period',
        message: `No price data found for ${symbol} between ${startDate} and ${endDate} even after attempting to fetch data.`,
        suggestion: 'The symbol may not have been listed during this period or may not exist.'
      });
    }

    if (dailyPrices.length < 30) {
      return res.status(400).json({
        error: 'Insufficient data for backtesting',
        message: `Only ${dailyPrices.length} trading days found for the requested period. Minimum 30 days required for reliable backtesting.`,
        availableDays: dailyPrices.length,
        minimumRequired: 30
      });
    }

    // Use the shared core algorithm
    const { runDCABacktest } = require('./services/dcaBacktestService');

    const results = await runDCABacktest({
      symbol: finalParams.symbol,
      startDate: finalParams.startDate,
      endDate: finalParams.endDate,
      lotSizeUsd: finalParams.lotSizeUsd,
      maxLots: finalParams.maxLots,
      maxLotsToSell: finalParams.maxLotsToSell,
      gridIntervalPercent: finalParams.gridIntervalPercent, // Already in decimal format from config
      remainingLotsLossTolerance: finalParams.remainingLotsLossTolerance, // Already in decimal format from config
      profitRequirement: finalParams.profitRequirement,
      trailingBuyActivationPercent: finalParams.trailingBuyActivationPercent,
      trailingBuyReboundPercent: finalParams.trailingBuyReboundPercent,
      trailingSellActivationPercent: finalParams.trailingSellActivationPercent,
      trailingSellPullbackPercent: finalParams.trailingSellPullbackPercent,
      verbose: false // Don't log to console for API calls
    });

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
          performanceMetrics: results.performanceMetrics
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
        outperformance: results.outperformance,
        outperformancePercent: results.outperformancePercent,
        // Include Beta information if Beta scaling was used
        ...(betaInfo && { betaInfo: betaInfo })
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

    // Save updated parameters to config (for consistency between CLI and UI)
    backtestConfig.saveDefaults({ ...normalizedParams, strategyMode: 'short' });

    const results = await runShortDCABacktest(normalizedParams);
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

app.post('/api/backtest/batch', validation.validateBatchBacktestParams, async (req, res) => {
  try {
    console.log('📊 Received batch backtest request');

    const { runBatchBacktest } = require('./services/batchBacktestService');

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

    // Set up progress tracking for long-running batch tests
    let progressData = null;
    const progressCallback = (progress) => {
      progressData = progress;
      // Could implement WebSocket or Server-Sent Events here for real-time updates
    };

    console.log('🚀 Starting batch backtest with options:', options);

    const startTime = Date.now();
    const results = await runBatchBacktest(options, progressCallback);
    const executionTime = Date.now() - startTime;

    console.log(`✅ Batch backtest completed in ${(executionTime / 1000).toFixed(1)}s`);
    console.log(`📈 Best result: ${results.summary?.overallBest?.summary?.annualizedReturn.toFixed(2)}% annualized return`);

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
    console.log(`📈 Best result: ${results.summary?.overallBest?.summary?.annualizedReturn.toFixed(2)}% annualized return`);

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

    // Fetch Beta for the symbol
    const betaDataService = require('./services/betaDataService');
    const betaData = await betaDataService.fetchBeta(symbol);
    const beta = betaData.beta;

    // Calculate Beta-adjusted parameters
    const parameterCorrelationService = require('./services/parameterCorrelationService');
    const result = parameterCorrelationService.calculateBetaAdjustedParameters(beta, coefficient, baseParameters);

    console.log(`✅ Beta parameters calculated: Beta=${beta}, Coefficient=${coefficient}, β-factor=${result.betaFactor.toFixed(3)}`);

    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        beta: result.beta,
        coefficient: result.coefficient,
        betaFactor: result.betaFactor,
        userParameters: result.userParameters,
        adjustedParameters: {
          // Convert to percentages for frontend
          profitRequirement: result.adjustedParameters.profitRequirement * 100,
          gridIntervalPercent: result.adjustedParameters.gridIntervalPercent * 100,
          trailingBuyActivationPercent: result.adjustedParameters.trailingBuyActivationPercent * 100,
          trailingBuyReboundPercent: result.adjustedParameters.trailingBuyReboundPercent * 100,
          trailingSellActivationPercent: result.adjustedParameters.trailingSellActivationPercent * 100,
          trailingSellPullbackPercent: result.adjustedParameters.trailingSellPullbackPercent * 100
        },
        warnings: result.warnings,
        isValid: result.isValid,
        calculation: {
          formula: `Beta (${beta}) × Coefficient (${coefficient}) = β-factor (${result.betaFactor.toFixed(3)})`,
          example: `Profit Requirement = 5% × ${result.betaFactor.toFixed(3)} = ${(result.adjustedParameters.profitRequirement * 100).toFixed(2)}%`
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  database.close();
  process.exit(0);
});
