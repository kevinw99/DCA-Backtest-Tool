const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function getSP500HighBetaStocks() {
  console.log('🔍 Analyzing S&P 500 stocks for beta > 1.5...\n');

  // Load SP500 config
  const sp500Config = require('./configs/portfolios/sp500.json');
  console.log(`📊 Loaded ${sp500Config.stocks.length} S&P 500 stocks`);

  // Fetch beta values using batch API (max 50 per request)
  const batchSize = 50;
  const batches = [];
  for (let i = 0; i < sp500Config.stocks.length; i += batchSize) {
    batches.push(sp500Config.stocks.slice(i, i + batchSize));
  }

  console.log(`📦 Fetching beta values in ${batches.length} batches...`);

  const stocksWithBeta = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      console.log(`   Batch ${i + 1}/${batches.length}: ${batch.length} symbols`);

      const response = await axios.post('http://localhost:3001/api/beta/batch', {
        symbols: batch
      });

      if (response.data.success) {
        for (const [symbol, betaData] of Object.entries(response.data.data)) {
          if (betaData.beta !== null && betaData.beta !== undefined) {
            stocksWithBeta.push({ symbol, beta: betaData.beta });
            successCount++;
          } else {
            failCount++;
          }
        }
      } else {
        console.log(`⚠️  Batch ${i + 1} failed:`, response.data.error);
        failCount += batch.length;
      }
    } catch (error) {
      console.log(`❌ Error fetching batch ${i + 1}:`, error.message);
      failCount += batch.length;
    }
  }

  console.log(`\n✅ Retrieved beta for ${successCount} stocks`);
  if (failCount > 0) {
    console.log(`⚠️  Failed to get beta for ${failCount} stocks`);
  }

  // Filter for beta > 1.5
  const highBetaStocks = stocksWithBeta
    .filter(s => s.beta > 1.5)
    .sort((a, b) => b.beta - a.beta);

  console.log(`\n🎯 Found ${highBetaStocks.length} stocks with beta > 1.5:`);
  highBetaStocks.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.symbol}: β=${s.beta.toFixed(3)}`);
  });

  // Create high-beta config
  const highBetaConfig = {
    name: "S&P 500 High Beta (β > 1.5)",
    description: "Portfolio backtest for S&P 500 stocks with beta > 1.5 (higher volatility)",
    totalCapitalUsd: 3000000,
    marginPercent: 20,
    startDate: "2021-09-02",
    endDate: "2025-10-30",
    globalDefaults: sp500Config.globalDefaults,
    indexTracking: {
      enabled: true,
      indexName: "S&P-500",
      enforceMembership: true,
      handleRemovals: "liquidate_positions"
    },
    stocks: highBetaStocks.map(s => s.symbol)
  };

  // Save config
  const configPath = path.join(__dirname, 'configs', 'portfolios', 'sp500_high_beta.json');
  fs.writeFileSync(configPath, JSON.stringify(highBetaConfig, null, 2));

  console.log(`\n✅ Created config file: ${configPath}`);
  console.log(`\n📋 Config summary:`);
  console.log(`   - Name: ${highBetaConfig.name}`);
  console.log(`   - Stocks: ${highBetaConfig.stocks.length}`);
  console.log(`   - Capital: $${highBetaConfig.totalCapitalUsd.toLocaleString()}`);
  console.log(`   - Survivor bias protection: ${highBetaConfig.indexTracking.enabled ? 'ENABLED' : 'DISABLED'}`);

  console.log(`\n🚀 To run backtest:`);
  console.log(`   curl -X POST http://localhost:3001/api/backtest/portfolio/config \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"configFile": "sp500_high_beta"}'`);

  console.log(`\n🌐 Frontend URL:`);
  console.log(`   http://localhost:3000/portfolio-backtest?config=sp500_high_beta`);

  return {
    highBetaStocks,
    configPath
  };
}

// Run if called directly
if (require.main === module) {
  getSP500HighBetaStocks()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { getSP500HighBetaStocks };
