const fs = require('fs');
const path = require('path');

// Load portfolio result
const portfolioResult = JSON.parse(fs.readFileSync('/tmp/portfolio_result.json', 'utf8'));
const nasdaq100Config = require('./configs/portfolios/nasdaq100.json');

// Get index join dates mapping
const joinDatesMap = {};
nasdaq100Config.stocks.forEach(stock => {
  joinDatesMap[stock.symbol] = stock.indexJoinDate;
});

// Extract stocks with beta > 1.75
const highBetaStocks = [];

if (portfolioResult.success && portfolioResult.data.stockResults) {
  portfolioResult.data.stockResults.forEach(stock => {
    if (stock.beta !== null && stock.beta > 1.75) {
      highBetaStocks.push({
        symbol: stock.symbol,
        beta: stock.beta,
        indexJoinDate: joinDatesMap[stock.symbol] || null
      });
    }
  });
}

// Sort by beta descending
highBetaStocks.sort((a, b) => b.beta - a.beta);

console.log(`Found ${highBetaStocks.length} stocks with beta > 1.75:`);
console.log(highBetaStocks.map(s => `  ${s.symbol}: β=${s.beta.toFixed(2)}, joined=${s.indexJoinDate || 'unknown'}`).join('\n'));

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
