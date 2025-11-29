#!/usr/bin/env node
/**
 * Update Stock History Script
 * Fetches maximum available historical data for stocks using Yahoo Finance
 * with rate limiting to avoid API throttling.
 *
 * Usage:
 *   node scripts/updateStockHistory.js --priority       # Mag7 + High Beta stocks only
 *   node scripts/updateStockHistory.js --all            # All stocks in database
 *   node scripts/updateStockHistory.js --symbols NVDA,AAPL,TSLA
 *   node scripts/updateStockHistory.js --all --resume-from AMD
 *   node scripts/updateStockHistory.js --all --dry-run
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const RateLimiter = require('../services/rateLimiter');
const YFinanceProvider = require('../services/providers/yfinanceProvider');

// Priority stock lists
const PRIORITY_STOCKS = {
  mag7: ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA'],
  highBeta: ['AMD', 'NFLX', 'ORCL', 'MU', 'SHOP', 'PLTR', 'ARM', 'AMAT', 'LRCX', 'MRVL']
};

// Paths
const DB_PATH = path.join(__dirname, '..', 'stocks.db');
const PROGRESS_PATH = path.join(__dirname, '..', 'data', 'update_progress.json');

// Initialize
const db = new sqlite3.Database(DB_PATH);
const yfinance = new YFinanceProvider();
const rateLimiter = new RateLimiter({
  minDelay: 2000,      // 2 seconds between requests
  maxRetries: 3,
  backoffMultiplier: 2
});

// Promisify database methods
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    priority: false,
    all: false,
    symbols: null,
    resumeFrom: null,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--priority':
        options.priority = true;
        break;
      case '--all':
        options.all = true;
        break;
      case '--symbols':
        options.symbols = args[++i]?.split(',').map(s => s.trim().toUpperCase());
        break;
      case '--resume-from':
        options.resumeFrom = args[++i]?.trim().toUpperCase();
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Stock History Update Script
===========================

Usage:
  node scripts/updateStockHistory.js [options]

Options:
  --priority              Update priority stocks only (Mag7 + High Beta Large Cap)
  --all                   Update all stocks in database
  --symbols NVDA,AAPL     Update specific symbols (comma-separated)
  --resume-from SYMBOL    Resume from a specific symbol
  --dry-run               Show what would be updated without making changes
  --help                  Show this help message

Examples:
  node scripts/updateStockHistory.js --priority
  node scripts/updateStockHistory.js --all
  node scripts/updateStockHistory.js --symbols NVDA,AAPL,TSLA
  node scripts/updateStockHistory.js --all --resume-from AMD

Priority Stocks:
  Mag7: ${PRIORITY_STOCKS.mag7.join(', ')}
  High Beta: ${PRIORITY_STOCKS.highBeta.join(', ')}
`);
}

/**
 * Load progress from file
 */
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_PATH)) {
      return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
    }
  } catch (error) {
    console.log('⚠️ Could not load progress file, starting fresh');
  }
  return {
    startedAt: new Date().toISOString(),
    lastUpdatedAt: null,
    totalStocks: 0,
    completed: 0,
    failed: 0,
    results: {}
  };
}

/**
 * Save progress to file
 */
function saveProgress(progress) {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(PROGRESS_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    progress.lastUpdatedAt = new Date().toISOString();
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.error('⚠️ Could not save progress:', error.message);
  }
}

/**
 * Get all stocks from database
 */
async function getAllStocks() {
  const rows = await dbAll('SELECT symbol FROM stocks ORDER BY symbol');
  return rows.map(r => r.symbol);
}

/**
 * Get stock ID by symbol
 */
async function getStockId(symbol) {
  const row = await dbGet('SELECT id FROM stocks WHERE symbol = ?', [symbol]);
  return row?.id;
}

/**
 * Get current date range for a stock
 */
async function getCurrentDateRange(stockId) {
  const row = await dbGet(`
    SELECT MIN(date) as earliest, MAX(date) as latest, COUNT(*) as records
    FROM daily_prices
    WHERE stock_id = ?
  `, [stockId]);
  return row;
}

/**
 * Upsert prices for a stock
 */
async function upsertPrices(stockId, prices) {
  let insertedCount = 0;

  for (const price of prices) {
    // Validate data - skip if essential fields are null
    if (price.close == null || price.date == null) {
      continue;
    }

    try {
      await dbRun(`
        INSERT INTO daily_prices (stock_id, date, open, high, low, close, adjusted_close, volume)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(stock_id, date) DO UPDATE SET
          open = excluded.open,
          high = excluded.high,
          low = excluded.low,
          close = excluded.close,
          adjusted_close = excluded.adjusted_close,
          volume = excluded.volume
      `, [
        stockId,
        price.date,
        price.open,
        price.high,
        price.low,
        price.close,
        price.adjusted_close || price.close,
        price.volume || 0
      ]);
      insertedCount++;
    } catch (error) {
      // Ignore duplicate errors, continue with next
      if (!error.message.includes('UNIQUE constraint')) {
        console.error(`  Warning: ${error.message}`);
      }
    }
  }

  return insertedCount;
}

/**
 * Update a single stock
 */
async function updateStock(symbol, dryRun = false) {
  const stockId = await getStockId(symbol);

  if (!stockId) {
    return { status: 'skipped', reason: 'Symbol not found in database' };
  }

  // Get current data range
  const before = await getCurrentDateRange(stockId);

  if (dryRun) {
    return {
      status: 'dry-run',
      currentRecords: before.records || 0,
      currentRange: before.earliest ? `${before.earliest} to ${before.latest}` : 'No data'
    };
  }

  // Fetch new data
  const prices = await yfinance.fetchDailyPrices(symbol);

  if (!prices || prices.length === 0) {
    return { status: 'failed', reason: 'No data returned from Yahoo Finance' };
  }

  // Upsert prices
  const insertedCount = await upsertPrices(stockId, prices);

  // Get new data range
  const after = await getCurrentDateRange(stockId);

  return {
    status: 'success',
    fetchedRecords: prices.length,
    insertedRecords: insertedCount,
    range: `${after.earliest} to ${after.latest}`,
    totalRecords: after.records,
    newRecords: after.records - (before.records || 0)
  };
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Main update function
 */
async function main() {
  const options = parseArgs();

  if (!options.priority && !options.all && !options.symbols) {
    console.log('❌ Please specify --priority, --all, or --symbols');
    printHelp();
    process.exit(1);
  }

  console.log('\n🚀 Stock History Update Script');
  console.log('=' .repeat(50));

  // Determine stocks to update
  let stocksToUpdate = [];

  if (options.symbols) {
    stocksToUpdate = options.symbols;
    console.log(`📋 Updating specific symbols: ${stocksToUpdate.join(', ')}`);
  } else if (options.priority) {
    stocksToUpdate = [...PRIORITY_STOCKS.mag7, ...PRIORITY_STOCKS.highBeta];
    console.log(`📋 Updating priority stocks (${stocksToUpdate.length} total)`);
    console.log(`   Mag7: ${PRIORITY_STOCKS.mag7.join(', ')}`);
    console.log(`   High Beta: ${PRIORITY_STOCKS.highBeta.join(', ')}`);
  } else if (options.all) {
    const allStocks = await getAllStocks();
    const prioritySet = new Set([...PRIORITY_STOCKS.mag7, ...PRIORITY_STOCKS.highBeta]);
    const nonPriority = allStocks.filter(s => !prioritySet.has(s));

    // Priority stocks first, then rest
    stocksToUpdate = [...PRIORITY_STOCKS.mag7, ...PRIORITY_STOCKS.highBeta, ...nonPriority];
    console.log(`📋 Updating all stocks (${stocksToUpdate.length} total)`);
    console.log(`   Priority stocks first, then ${nonPriority.length} others`);
  }

  // Resume from specific symbol if requested
  if (options.resumeFrom) {
    const idx = stocksToUpdate.findIndex(s => s === options.resumeFrom);
    if (idx > 0) {
      stocksToUpdate = stocksToUpdate.slice(idx);
      console.log(`⏩ Resuming from ${options.resumeFrom} (skipping ${idx} stocks)`);
    } else if (idx === -1) {
      console.log(`⚠️ Symbol ${options.resumeFrom} not found in list`);
    }
  }

  if (options.dryRun) {
    console.log('\n🔍 DRY RUN - No changes will be made\n');
  }

  // Load/initialize progress
  const progress = loadProgress();
  progress.totalStocks = stocksToUpdate.length;

  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  console.log(`\n⏱️ Estimated time: ${formatDuration(stocksToUpdate.length * 2500)}`);
  console.log(`📊 Rate limit: 1 request per 2 seconds\n`);

  // Process each stock
  for (let i = 0; i < stocksToUpdate.length; i++) {
    const symbol = stocksToUpdate[i];
    const elapsed = Date.now() - startTime;
    const avgTime = i > 0 ? elapsed / i : 2500;
    const remaining = (stocksToUpdate.length - i) * avgTime;

    process.stdout.write(`[${i + 1}/${stocksToUpdate.length}] ${symbol.padEnd(6)} `);

    try {
      const result = await rateLimiter.executeWithRetry(
        () => updateStock(symbol, options.dryRun),
        symbol
      );

      if (result.status === 'success') {
        console.log(`✅ ${result.totalRecords} records (${result.range}) +${result.newRecords} new`);
        successCount++;
        progress.results[symbol] = {
          status: 'success',
          records: result.totalRecords,
          range: result.range,
          updatedAt: new Date().toISOString()
        };
      } else if (result.status === 'dry-run') {
        console.log(`🔍 Would update: ${result.currentRecords} records (${result.currentRange})`);
        skipCount++;
      } else if (result.status === 'skipped') {
        console.log(`⏭️ Skipped: ${result.reason}`);
        skipCount++;
      } else {
        console.log(`❌ Failed: ${result.reason}`);
        failCount++;
        progress.results[symbol] = {
          status: 'failed',
          reason: result.reason,
          updatedAt: new Date().toISOString()
        };
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      failCount++;
      progress.results[symbol] = {
        status: 'failed',
        error: error.message,
        updatedAt: new Date().toISOString()
      };
    }

    // Save progress periodically
    if (i % 10 === 0) {
      progress.completed = successCount;
      progress.failed = failCount;
      saveProgress(progress);
    }

    // Show ETA every 20 stocks
    if (i > 0 && i % 20 === 0) {
      console.log(`   ⏱️ ETA: ${formatDuration(remaining)} remaining`);
    }
  }

  // Final progress save
  progress.completed = successCount;
  progress.failed = failCount;
  saveProgress(progress);

  // Print summary
  const totalTime = Date.now() - startTime;
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⏭️ Skipped: ${skipCount}`);
  console.log(`⏱️ Total time: ${formatDuration(totalTime)}`);
  console.log(`📝 Progress saved to: ${PROGRESS_PATH}`);

  // Close database
  db.close();
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
