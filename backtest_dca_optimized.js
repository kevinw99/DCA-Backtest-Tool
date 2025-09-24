const { runDCABacktest } = require('./backend/services/dcaBacktestService');

// --- Strategy Parameters ---
const SYMBOL = 'NVDA';
const START_DATE = '2021-09-01';
const END_DATE = '2025-09-01';
const LOT_SIZE_USD = 10000;
const MAX_LOTS = 5;
const GRID_INTERVAL_PERCENT = 0.10;
const REMAINING_LOTS_LOSS_TOLERANCE = 0.00;

// Wrapper function for backward compatibility
async function runBacktest() {
  console.log(`Starting OPTIMIZED DCA backtest for ${SYMBOL}...`);
  console.log(`Remaining lots loss tolerance: ${(REMAINING_LOTS_LOSS_TOLERANCE * 100).toFixed(1)}%`);

  try {
    // Use the shared core algorithm
    const results = await runDCABacktest({
      symbol: SYMBOL,
      startDate: START_DATE,
      endDate: END_DATE,
      lotSizeUsd: LOT_SIZE_USD,
      maxLots: MAX_LOTS,
      gridIntervalPercent: GRID_INTERVAL_PERCENT,
      remainingLotsLossTolerance: REMAINING_LOTS_LOSS_TOLERANCE,
      verbose: true // Enable detailed logging for command line
    });

    console.log('\n--- OPTIMIZED Backtest Complete ---');
    console.log('Performance improvement achieved through precalculated indicators!');

    return results;

  } catch (error) {
    console.error('Error running backtest:', error);
    throw error;
  }
}

// Run the backtest if this file is executed directly
if (require.main === module) {
  runBacktest()
    .then(results => {
      process.exit(0);
    })
    .catch(error => {
      console.error('Backtest failed:', error);
      process.exit(1);
    });
}

module.exports = { runBacktest };
