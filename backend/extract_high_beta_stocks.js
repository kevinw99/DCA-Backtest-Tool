const fs = require('fs');
const path = require('path');

// Load data
const portfolioResult = JSON.parse(fs.readFileSync('/tmp/portfolio_result.json', 'utf8'));
const nasdaq100Config = require('./configs/portfolios/nasdaq100.json');

// Get index join dates mapping
const joinDatesMap = {};
nasdaq100Config.stocks.forEach(stock => {
  joinDatesMap[stock.symbol] = stock.indexJoinDate;
});

// Extract all stocks from beta grouping groups
const allStocksWithBeta = [];

if (portfolioResult.success && portfolioResult.data.betaGrouping) {
  portfolioResult.data.betaGrouping.groups.forEach(group => {
    // Add from topPerformers
    if (group.topPerformers) {
      group.topPerformers.forEach(s => {
        if (!allStocksWithBeta.find(x => x.symbol === s.symbol)) {
          allStocksWithBeta.push({symbol: s.symbol, beta: s.beta});
        }
      });
    }
    // Add from bottomPerformers
    if (group.bottomPerformers) {
      group.bottomPerformers.forEach(s => {
        if (!allStocksWithBeta.find(x => x.symbol === s.symbol)) {
          allStocksWithBeta.push({symbol: s.symbol, beta: s.beta});
        }
      });
    }
  });
}

// Filter for beta > 1.75
const highBetaStocks = allStocksWithBeta
  .filter(s => s.beta > 1.75)
  .map(s => ({
    symbol: s.symbol,
    beta: s.beta,
    indexJoinDate: joinDatesMap[s.symbol] || null
  }))
  .sort((a, b) => b.beta - a.beta);

console.log(`Found ${highBetaStocks.length} stocks with beta > 1.75:`);
highBetaStocks.forEach(s => {
  console.log(`  ${s.symbol}: β=${s.beta.toFixed(3)}, joined=${s.indexJoinDate || 'unknown'}`);
});

// Create portfolio config
const highBetaConfig = {
  totalCapital: 3000000,
  marginPercent: 20,
  startDate: "2021-09-02",
  endDate: "2025-10-22",
  lotSizeUsd: 5000,
  maxLotsPerStock: 10,
  globalDefaults: nasdaq100Config.globalDefaults,
  stocks: highBetaStocks.map(s => ({
    symbol: s.symbol,
    indexJoinDate: s.indexJoinDate
  }))
};

// Save config
const configPath = path.join(__dirname, 'configs', 'portfolios', 'nasdaq100_high_beta.json');
fs.writeFileSync(configPath, JSON.stringify(highBetaConfig, null, 2));
console.log(`\n✅ Created config file: ${configPath}`);
console.log(`\nTo run backtest:`);
console.log(`curl -X POST http://localhost:3001/api/backtest/portfolio/config \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -d '{"configFile": "nasdaq100_high_beta"}'`);
