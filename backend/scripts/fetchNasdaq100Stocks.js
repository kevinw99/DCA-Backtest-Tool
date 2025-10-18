#!/usr/bin/env node

/**
 * Fetch all Nasdaq 100 stocks data
 * This script pre-loads all Nasdaq 100 stock data into the database
 * so the portfolio backtest doesn't have to fetch them on-demand.
 */

const fs = require('fs').promises;
const path = require('path');
const database = require('../database');
const stockDataService = require('../services/stockDataService');

async function fetchNasdaq100Stocks() {
  console.log('📊 Nasdaq 100 Stock Data Fetcher');
  console.log('=================================\n');

  try {
    // Read Nasdaq 100 symbols from file
    const symbolsFile = path.join(__dirname, '../data/nasdaq100-symbols.txt');
    const content = await fs.readFile(symbolsFile, 'utf8');

    const symbols = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !line.startsWith('#'));

    console.log(`📋 Found ${symbols.length} Nasdaq 100 symbols to fetch\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      const progress = ((i + 1) / symbols.length * 100).toFixed(1);

      console.log(`[${i + 1}/${symbols.length}] ${symbol} (${progress}%)`);

      try {
        // Check if stock exists
        let stock = await database.getStock(symbol);

        if (!stock) {
          console.log(`  🆕 Creating new stock record...`);
          const stockId = await database.createStock(symbol);
          stock = await database.getStock(symbol);

          console.log(`  📡 Fetching data from Yahoo Finance...`);
          await stockDataService.updateStockData(stock.id, symbol, {
            updatePrices: true,
            updateFundamentals: true,
            updateCorporateActions: true
          });
          await database.updateStockTimestamp(stock.id);
          console.log(`  ✅ Successfully fetched and stored`);
          successCount++;
        } else {
          // Check if data needs update
          const latestPriceDate = await database.getLastPriceDate(stock.id);
          const today = new Date().toISOString().split('T')[0];

          if (!latestPriceDate) {
            // Stock exists but has NO price data - fetch everything
            console.log(`  📡 No price data found, fetching full history...`);
            await stockDataService.updateStockData(stock.id, symbol, {
              updatePrices: true,
              updateFundamentals: true,
              updateCorporateActions: true
            });
            await database.updateStockTimestamp(stock.id);
            console.log(`  ✅ Successfully fetched full history`);
            successCount++;
          } else if (latestPriceDate < today) {
            console.log(`  📡 Updating data (last: ${latestPriceDate})...`);
            const nextDay = new Date(latestPriceDate);
            nextDay.setDate(nextDay.getDate() + 1);
            const fromDate = nextDay.toISOString().split('T')[0];

            await stockDataService.updateStockData(stock.id, symbol, {
              updatePrices: true,
              fromDate: fromDate,
              updateFundamentals: false,
              updateCorporateActions: false
            });
            console.log(`  ✅ Updated to ${today}`);
            successCount++;
          } else {
            console.log(`  ⏭️  Already up-to-date (${latestPriceDate})`);
            skipCount++;
          }
        }
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        errorCount++;
        errors.push({ symbol, error: error.message });
      }

      console.log('');
    }

    console.log('\n=================================');
    console.log('📊 Summary');
    console.log('=================================');
    console.log(`✅ Successfully fetched/updated: ${successCount}`);
    console.log(`⏭️  Already up-to-date: ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📈 Total processed: ${symbols.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Failed stocks:');
      errors.forEach(({ symbol, error }) => {
        console.log(`   ${symbol}: ${error}`);
      });
    }

    console.log('\n✅ All done! Nasdaq 100 stocks data is ready.');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the fetcher
fetchNasdaq100Stocks()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
