#!/usr/bin/env node

/**
 * Command-line DCA Backtest Runner
 * Uses the shared dcaBacktestService with yfinance data
 */

const { runDCABacktest } = require('./services/dcaBacktestService');

async function main() {
  // Default parameters - you can modify these
  const params = {
    symbol: process.argv[2] || 'TSLA',
    startDate: process.argv[3] || '2023-01-01',
    endDate: process.argv[4] || '2023-12-31',
    lotSizeUsd: parseFloat(process.argv[5]) || 1000,
    maxLots: parseInt(process.argv[6]) || 5,
    gridIntervalPercent: parseFloat(process.argv[7]) || 0.10, // 10%
    remainingLotsLossTolerance: parseFloat(process.argv[8]) || 0.05, // 5%
    verbose: true
  };

  console.log('🚀 DCA Backtest Runner with YFinance');
  console.log('=====================================');
  console.log('Usage: node run_dca_backtest.js [SYMBOL] [START_DATE] [END_DATE] [LOT_SIZE] [MAX_LOTS] [GRID_INTERVAL] [LOSS_TOLERANCE]');
  console.log('Example: node run_dca_backtest.js TSLA 2023-01-01 2023-12-31 1000 5 0.10 0.05');
  console.log('');

  try {
    const results = await runDCABacktest(params);

    console.log('\n🎯 Backtest completed successfully!');
    console.log('📊 Use the web interface at http://localhost:3000 for detailed charts and analysis.');

  } catch (error) {
    console.error('❌ Backtest failed:', error.message);
    process.exit(1);
  }
}

main();