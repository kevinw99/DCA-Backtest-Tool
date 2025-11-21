const { runDCABacktest } = require('./backend/services/dcaBacktestService');
const backtestConfig = require('./backend/config/backtestConfig');

// Get default parameters from shared config
const defaults = backtestConfig.getDefaults();

// Wrapper function for backward compatibility
async function runBacktest() {
  console.log(`Starting OPTIMIZED DCA backtest for ${defaults.symbol}...`);
  console.log(`📊 Using parameters from shared config:`, defaults);

  try {
    // Use the shared core algorithm with shared defaults
    const results = await runDCABacktest({
      ...defaults,
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
