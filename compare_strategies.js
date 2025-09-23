const { runBacktest: runStaticBacktest } = require('./backtest_dca.js');
const { runBacktest: runTrailingBacktest } = require('./backtest_dca_trailing.js');

async function compareStrategies() {
  console.log('='.repeat(80));
  console.log('STRATEGY COMPARISON: STATIC vs TRAILING STOP-LIMIT');
  console.log('='.repeat(80));

  try {
    console.log('\n🔸 Running STATIC Stop-Limit Strategy...');
    const staticResults = await runStaticBacktest();

    console.log('\n🔸 Running TRAILING Stop-Limit Strategy...');
    const trailingResults = await runTrailingBacktest();

    // Comparison Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 STRATEGY COMPARISON SUMMARY');
    console.log('='.repeat(80));

    console.log(`\n🏷️  STATIC Stop-Limit Strategy:`);
    console.log(`   Total P&L: ${staticResults.totalPNL.toFixed(2)}`);
    console.log(`   Realized P&L: ${staticResults.realizedPNL.toFixed(2)}`);
    console.log(`   Unrealized P&L: ${staticResults.unrealizedPNL.toFixed(2)}`);
    console.log(`   Return on Max Exposure: ${staticResults.returnOnMaxExposure.toFixed(2)}%`);
    console.log(`   Final Held Lots: ${staticResults.finalHeldLots}`);
    console.log(`   Total Transactions: ${staticResults.transactionCount}`);

    console.log(`\n🎯 TRAILING Stop-Limit Strategy:`);
    console.log(`   Total P&L: ${trailingResults.totalPNL.toFixed(2)}`);
    console.log(`   Realized P&L: ${trailingResults.realizedPNL.toFixed(2)}`);
    console.log(`   Unrealized P&L: ${trailingResults.unrealizedPNL.toFixed(2)}`);
    console.log(`   Return on Max Exposure: ${trailingResults.returnOnMaxExposure.toFixed(2)}%`);
    console.log(`   Final Held Lots: ${trailingResults.finalHeldLots}`);
    console.log(`   Total Transactions: ${trailingResults.transactionCount}`);

    // Winner Analysis
    const pnlDifference = trailingResults.totalPNL - staticResults.totalPNL;
    const returnDifference = trailingResults.returnOnMaxExposure - staticResults.returnOnMaxExposure;

    console.log(`\n🏆 PERFORMANCE COMPARISON:`);
    console.log(`   P&L Difference: ${pnlDifference > 0 ? '+' : ''}${pnlDifference.toFixed(2)} (${pnlDifference > 0 ? 'Trailing' : 'Static'} wins)`);
    console.log(`   Return Difference: ${returnDifference > 0 ? '+' : ''}${returnDifference.toFixed(2)}% (${returnDifference > 0 ? 'Trailing' : 'Static'} wins)`);
    console.log(`   Transaction Difference: ${trailingResults.transactionCount - staticResults.transactionCount} (${trailingResults.transactionCount > staticResults.transactionCount ? 'Trailing more active' : 'Static more active'})`);

    const winner = pnlDifference > 0 ? 'TRAILING Stop-Limit' : 'STATIC Stop-Limit';
    console.log(`\n🎖️  OVERALL WINNER: ${winner} Strategy`);

  } catch (error) {
    console.error('Error during strategy comparison:', error);
  }
}

// Run comparison if called directly
if (require.main === module) {
  compareStrategies();
}
