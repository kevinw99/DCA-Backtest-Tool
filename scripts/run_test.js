#!/usr/bin/env node

/**
 * CLI interface for automated test execution
 * Usage: node scripts/run_test.js "test description"
 */

const path = require('path');
const { runAutomatedTest } = require(path.join(__dirname, '../backend/services/testAutomationService'));

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                     DCA Backtest Tool - Automated Testing                    ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Usage: node scripts/run_test.js "<test description>"

Supported Test Formats:

📊 Portfolio Tests:
   "portfolio backtest with beta > 1.75"
   "portfolio backtest with beta < 1.0"
   "portfolio backtest with stocks: [AAPL, MSFT, GOOGL]"

📈 Batch Tests:
   "batch mode testing gridIntervalPercent values [5, 10, 15, 20] for AAPL"
   "batch testing profitRequirement values [5, 10, 15] for NVDA"

🎯 Single Tests:
   "single backtest for AAPL with beta scaling enabled"
   "single backtest for NVDA with gridInterval=15"

Examples:
   node scripts/run_test.js "portfolio backtest with beta > 1.75"
   node scripts/run_test.js "batch testing gridIntervalPercent values [5, 10, 15] for AAPL"

Results will be saved to: test-results/
View all results: test-results/index.html
`);
    process.exit(0);
  }

  const description = args.join(' ');

  try {
    const result = await runAutomatedTest(description);

    console.log('\n✅ Test execution successful!');
    console.log(`\n📁 Archive Location: test-results/${result.archivePath}`);
    console.log(`🌐 View Results: test-results/${result.archivePath}/result.html`);
    console.log(`📑 View All Tests: test-results/index.html`);
    console.log(`🔗 Frontend URL: ${result.frontendUrl}\n`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test execution failed!');
    console.error(`Error: ${error.message}\n`);

    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

main();
