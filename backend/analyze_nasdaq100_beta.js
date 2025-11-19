/**
 * Script to analyze beta distribution for NASDAQ-100 stocks
 * Groups stocks by beta ranges and shows distribution
 */

const betaService = require('./services/betaDataService');
const portfolioConfig = require('./configs/portfolios/nasdaq100.json');

// Beta ranges for grouping
const BETA_RANGES = [
  { min: 0, max: 0.5, label: '0.00 - 0.50' },
  { min: 0.5, max: 1.0, label: '0.50 - 1.00' },
  { min: 1.0, max: 1.5, label: '1.00 - 1.50' },
  { min: 1.5, max: 2.0, label: '1.50 - 2.00' },
  { min: 2.0, max: Infinity, label: '> 2.00' }
];

async function analyzeBetaDistribution() {
  console.log('========================================');
  console.log('NASDAQ-100 Beta Distribution Analysis');
  console.log('========================================\n');

  const stocks = portfolioConfig.stocks;
  console.log(`Total stocks in NASDAQ-100 config: ${stocks.length}\n`);

  // Fetch beta for all stocks
  console.log('Fetching beta values from Yahoo Finance...\n');
  const stockBetas = [];

  for (const symbol of stocks) {
    try {
      const betaData = await betaService.fetchBeta(symbol);
      stockBetas.push({
        symbol,
        beta: betaData.beta,
        source: betaData.source,
        lastUpdated: betaData.lastUpdated
      });
      console.log(`✓ ${symbol}: β=${betaData.beta.toFixed(2)} (source: ${betaData.source})`);
    } catch (error) {
      console.error(`✗ ${symbol}: Failed to fetch beta - ${error.message}`);
      stockBetas.push({
        symbol,
        beta: 1.0,
        source: 'default',
        lastUpdated: new Date().toISOString()
      });
    }
  }

  // Group by beta ranges
  console.log('\n========================================');
  console.log('Beta Distribution by Range');
  console.log('========================================\n');

  const groups = {};
  BETA_RANGES.forEach(range => {
    groups[range.label] = {
      stocks: [],
      count: 0
    };
  });

  stockBetas.forEach(({ symbol, beta }) => {
    for (const range of BETA_RANGES) {
      if (beta >= range.min && beta < range.max) {
        groups[range.label].stocks.push({ symbol, beta });
        groups[range.label].count++;
        break;
      }
    }
  });

  // Print distribution
  BETA_RANGES.forEach(range => {
    const group = groups[range.label];
    const percentage = ((group.count / stocks.length) * 100).toFixed(1);
    console.log(`${range.label.padEnd(15)} │ ${String(group.count).padStart(3)} stocks (${percentage}%)`);

    // Show first 10 stocks in each range
    if (group.stocks.length > 0) {
      const sortedStocks = group.stocks.sort((a, b) => a.beta - b.beta);
      const displayStocks = sortedStocks.slice(0, 10);
      displayStocks.forEach(({ symbol, beta }) => {
        console.log(`${''.padEnd(15)} │   ${symbol.padEnd(6)} β=${beta.toFixed(2)}`);
      });
      if (sortedStocks.length > 10) {
        console.log(`${''.padEnd(15)} │   ... and ${sortedStocks.length - 10} more`);
      }
    }
    console.log('');
  });

  // Statistics
  console.log('========================================');
  console.log('Statistics');
  console.log('========================================\n');

  const betas = stockBetas.map(s => s.beta);
  const avgBeta = betas.reduce((sum, b) => sum + b, 0) / betas.length;
  const minBeta = Math.min(...betas);
  const maxBeta = Math.max(...betas);
  const medianBeta = betas.sort((a, b) => a - b)[Math.floor(betas.length / 2)];

  console.log(`Average Beta:    ${avgBeta.toFixed(2)}`);
  console.log(`Median Beta:     ${medianBeta.toFixed(2)}`);
  console.log(`Min Beta:        ${minBeta.toFixed(2)}`);
  console.log(`Max Beta:        ${maxBeta.toFixed(2)}`);

  // Data source breakdown
  console.log('\n========================================');
  console.log('Data Sources');
  console.log('========================================\n');

  const sources = {};
  stockBetas.forEach(({ source }) => {
    sources[source] = (sources[source] || 0) + 1;
  });

  Object.entries(sources).forEach(([source, count]) => {
    const percentage = ((count / stocks.length) * 100).toFixed(1);
    console.log(`${source.padEnd(20)} │ ${String(count).padStart(3)} stocks (${percentage}%)`);
  });

  console.log('\n========================================\n');

  // Export data for further analysis
  return {
    stocks: stockBetas,
    groups,
    statistics: { avgBeta, medianBeta, minBeta, maxBeta },
    sources
  };
}

// Run analysis
analyzeBetaDistribution()
  .then(results => {
    console.log('Analysis complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });
