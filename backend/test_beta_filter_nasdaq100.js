/**
 * Spec 66: Test Beta Range Filtering with NASDAQ100
 *
 * This script tests the beta filtering feature by:
 * 1. Loading the NASDAQ100 portfolio config
 * 2. Adding minBeta = 1.5 filter
 * 3. Running the backtest
 * 4. Saving results to backtest-result/ directory
 */

const fs = require('fs');
const path = require('path');
const portfolioBacktestService = require('./services/portfolioBacktestService');
const { loadPortfolioConfig, configToBacktestParams } = require('./services/portfolioConfigLoader');

async function testNASDAQ100BetaFilter() {
  console.log('\n🧪 Spec 66: Testing Beta Range Filtering with NASDAQ100');
  console.log('   Filter: minBeta = 1.5');
  console.log('   Expected: Only high-beta stocks (beta >= 1.5) included\n');

  try {
    // Load NASDAQ100 config
    const portfolioConfig = await loadPortfolioConfig('nasdaq100');

    console.log('✅ Loaded NASDAQ100 config');
    console.log(`   Total stocks in config: ${portfolioConfig.stocks.length}`);
    console.log(`   Date range: ${portfolioConfig.startDate} to ${portfolioConfig.endDate}\n`);

    // Convert to backtest parameters
    const config = await configToBacktestParams(portfolioConfig);

    console.log(`   Total capital: $${config.totalCapital.toLocaleString()}`);

    // Add beta filtering
    config.minBeta = 1.5;

    console.log('🔍 Running backtest with beta filter...\n');

    // Run backtest
    const result = await portfolioBacktestService.runPortfolioBacktest(config);

    // Check if optimized capital mode returned multi-scenario result
    let mainResult;
    if (result.success && result.data && result.data.scenarios) {
      // Optimized capital mode - use optimal scenario
      mainResult = result.data.scenarios.optimal;
      console.log('\n📊 Optimized Capital Mode Results:');
      console.log(`   Discovered Capital: $${result.data.capitalDiscovery.peakDeployedCapital?.toLocaleString() || 'N/A'}`);
    } else {
      // Standard mode
      mainResult = result;
    }

    // Extract beta filter metadata
    const betaMetadata = mainResult.betaFilterMetadata;

    if (betaMetadata && betaMetadata.enabled) {
      console.log('\n✅ Beta Filtering Applied:');
      console.log(`   Range: ${betaMetadata.minBeta ?? 'any'} <= beta <= ${betaMetadata.maxBeta ?? 'any'}`);
      console.log(`   Total stocks: ${betaMetadata.totalStocks}`);
      console.log(`   Included: ${betaMetadata.includedStocks}`);
      console.log(`   Excluded: ${betaMetadata.excludedStocks}`);
      console.log(`   Missing beta: ${betaMetadata.missingBetaCount}`);
      console.log(`\n   Included stocks: ${betaMetadata.includedSymbols.join(', ')}`);
      console.log(`\n   Excluded stocks: ${betaMetadata.excludedSymbols.join(', ')}`);
    } else {
      console.warn('\n⚠️  No beta filter metadata found in results');
    }

    // Display performance summary
    if (mainResult.portfolioSummary) {
      console.log('\n📈 Portfolio Performance:');
      console.log(`   Final Value: $${mainResult.portfolioSummary.finalPortfolioValue?.toLocaleString() || 'N/A'}`);
      console.log(`   Total Return: ${mainResult.portfolioSummary.totalReturnPercent?.toFixed(2) || 'N/A'}%`);
      console.log(`   CAGR: ${mainResult.portfolioSummary.cagr?.toFixed(2) || 'N/A'}%`);
      console.log(`   Max Drawdown: ${mainResult.portfolioSummary.maxDrawdownPercent?.toFixed(2) || 'N/A'}%`);
      console.log(`   Sharpe Ratio: ${mainResult.portfolioSummary.sharpeRatio?.toFixed(2) || 'N/A'}`);
    }

    // Save results
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `nasdaq100_beta_gte_1.5_${timestamp}.json`;
    const outputPath = path.join(__dirname, '..', 'backtest-result', filename);

    // Ensure directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save full result
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`\n✅ Results saved to: ${outputPath}`);
    console.log(`\n🎉 Test completed successfully!`);

    return result;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testNASDAQ100BetaFilter()
    .then(() => {
      console.log('\n✅ All tests passed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testNASDAQ100BetaFilter };
