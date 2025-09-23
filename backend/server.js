require('dotenv').config();
const express = require('express');
const cors = require('cors');
const database = require('./database');
const stockDataService = require('./services/stockDataService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Stock Trading API is running' });
});

// Get stock data with all metrics
app.get('/api/stocks/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { startDate, endDate } = req.query;
    
    console.log(`\n🔍 API REQUEST: /api/stocks/${symbol.toUpperCase()}`);
    if (req.query.force) console.log(`   🔄 FORCE REFRESH requested`);
    
    // Get or create stock record
    let stock = await database.getStock(symbol);
    if (!stock) {
      const stockId = await database.createStock(symbol);
      stock = await database.getStock(symbol);
    }

    // Check if we need to update data
    const lastPriceDate = await database.getLastPriceDate(stock.id);
    const lastFundamentalDate = await database.getLastFundamentalDate(stock.id);
    const lastCorporateActionDate = await database.getLastCorporateActionDate(stock.id);
    
    const today = new Date().toISOString().split('T')[0];
    const forceUpdate = req.query.force === 'true';

    // Update prices if no existing data or force requested
    const needsPriceUpdate = !lastPriceDate || forceUpdate;
    const needsFundamentalUpdate = !lastFundamentalDate || forceUpdate;
    const needsCorporateActionUpdate = !lastCorporateActionDate || forceUpdate;

    // Update data if needed
    if (needsPriceUpdate || needsFundamentalUpdate || needsCorporateActionUpdate) {
      console.log(`📡 FETCHING from provider for ${symbol}:`);
      console.log(`   Prices: ${needsPriceUpdate} | Fundamentals: ${needsFundamentalUpdate} | Corporate Actions: ${needsCorporateActionUpdate}`);
      
      await stockDataService.updateStockData(stock.id, symbol, {
        updatePrices: needsPriceUpdate,
        updateFundamentals: needsFundamentalUpdate,
        updateCorporateActions: needsCorporateActionUpdate,
        fromDate: forceUpdate ? null : lastPriceDate, // Don't use fromDate when force refreshing
        forceRefresh: forceUpdate
      });
      await database.updateStockTimestamp(stock.id);
    } else {
      console.log(`💾 Using cached data for ${symbol}`);
    }

    // Check if we should use adjusted prices
    const useAdjusted = req.query.adjusted !== 'false'; // Default to adjusted
    
    // For Alpha Vantage, we now use their native adjusted_close field
    // which already handles splits and dividends properly
    const providerType = process.env.DATA_PROVIDER || 'alphavantage';
    
    // Fetch data from database - always get raw data first
    const dailyPrices = await database.getDailyPrices(stock.id, startDate, endDate);
    
    const quarterlyFundamentals = await database.getQuarterlyFundamentals(stock.id, startDate, endDate);
    const corporateActions = await database.getCorporateActions(stock.id, startDate, endDate);

    // Calculate derived metrics
    const metrics = stockDataService.calculateMetrics(dailyPrices, quarterlyFundamentals, corporateActions);

    // Check data quality for earnings announcement dates
    const totalQuarterlyRecords = quarterlyFundamentals.length;
    const recordsWithAnnouncementDates = quarterlyFundamentals.filter(f => f.reported_date).length;
    const missingAnnouncementDates = totalQuarterlyRecords - recordsWithAnnouncementDates;

    console.log(`📤 Response: ${dailyPrices.length} prices, ${quarterlyFundamentals.length} quarters, ${corporateActions.length} actions`);
    if (missingAnnouncementDates > 0) {
      console.warn(`⚠️  ${missingAnnouncementDates}/${totalQuarterlyRecords} quarterly records missing announcement dates`);
    }

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
      }
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

// DCA Backtesting API endpoints
app.post('/api/backtest/dca', async (req, res) => {
  try {
    const {
      symbol,
      startDate,
      endDate,
      lotSizeUsd,
      maxLots,
      gridIntervalPercent,
      remainingLotsLossTolerance
    } = req.body;

    console.log(`🔄 DCA Backtest request for ${symbol}`);

    // Get stock
    const stock = await database.getStock(symbol);
    if (!stock) {
      return res.status(404).json({ error: `Stock ${symbol} not found` });
    }

    // Use the shared core algorithm
    const { runDCABacktest } = require('./services/dcaBacktestService');

    const results = await runDCABacktest({
      symbol,
      startDate,
      endDate,
      lotSizeUsd,
      maxLots,
      gridIntervalPercent: gridIntervalPercent / 100, // Convert to decimal
      remainingLotsLossTolerance: remainingLotsLossTolerance / 100,
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
          volatility: results.volatility
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
        dailyValues: [], // Would need to extract from results
        lots: results.lots
      }
    });

  } catch (error) {
    console.error('DCA backtest error:', error);
    res.status(500).json({ error: error.message });
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
