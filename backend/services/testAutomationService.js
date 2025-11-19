/**
 * Test Automation Service
 * Handles automated test execution and archival
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const betaService = require('./betaService');
const { loadPortfolioConfig, getAvailableConfigs } = require('./portfolioConfigLoader');

const TEST_RESULTS_DIR = path.join(__dirname, '../../test-results');
const PORTFOLIO_CONFIGS_DIR = path.join(__dirname, '../configs/portfolios');
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Parse test description into structured config
 */
async function parseTestDescription(description) {
  const desc = description.toLowerCase().trim();

  // Portfolio test patterns
  const portfolioMatch = desc.match(/portfolio\s+(?:backtest\s+)?(?:with\s+)?(?:stocks?\s+)?(?:where\s+)?(.+)/);
  if (portfolioMatch) {
    const filterStr = portfolioMatch[1];
    const filters = {};

    // Beta filters
    const betaGt = filterStr.match(/beta\s*>\s*([\d.]+)/);
    const betaLt = filterStr.match(/beta\s*<\s*([\d.]+)/);
    const betaGte = filterStr.match(/beta\s*>=\s*([\d.]+)/);
    const betaLte = filterStr.match(/beta\s*<=\s*([\d.]+)/);

    if (betaGt) filters.betaGt = parseFloat(betaGt[1]);
    if (betaLt) filters.betaLt = parseFloat(betaLt[1]);
    if (betaGte) filters.betaGte = parseFloat(betaGte[1]);
    if (betaLte) filters.betaLte = parseFloat(betaLte[1]);

    // Explicit stock list
    const stocksMatch = filterStr.match(/stocks?\s*:\s*\[([^\]]+)\]/);
    if (stocksMatch) {
      filters.symbols = stocksMatch[1].split(',').map(s => s.trim().toUpperCase());
    }

    // Sector filter
    const sectorMatch = filterStr.match(/sector\s*(?:==|=)\s*(\w+)/);
    if (sectorMatch) {
      filters.sector = sectorMatch[1];
    }

    return {
      testType: 'portfolio',
      description,
      filters,
      parameters: {},
      symbols: filters.symbols || []
    };
  }

  // Batch test patterns
  const batchMatch = desc.match(/batch\s+(?:mode\s+)?(?:testing\s+)?(\w+)\s+values?\s+\[([^\]]+)\](?:\s+for\s+(\w+))?(?:\s+with\s+(.+))?/);
  if (batchMatch) {
    const [, parameter, valuesStr, symbol, constraints] = batchMatch;
    const values = valuesStr.split(',').map(v => {
      const num = parseFloat(v.trim());
      return isNaN(num) ? v.trim() : num;
    });

    return {
      testType: 'batch',
      description,
      filters: {},
      parameters: {
        parameter,
        values,
        symbol: symbol ? symbol.toUpperCase() : null,
        constraints: constraints || null
      },
      symbols: symbol ? [symbol.toUpperCase()] : []
    };
  }

  // Single test patterns
  const singleMatch = desc.match(/single\s+(?:backtest\s+)?for\s+(\w+)(?:\s+with\s+(.+))?/);
  if (singleMatch) {
    const [, symbol, paramsStr] = singleMatch;
    const parameters = {};

    if (paramsStr) {
      // Parse boolean flags
      if (paramsStr.includes('beta scaling enabled')) {
        parameters.enableBetaScaling = true;
      }

      // Parse numeric parameters
      const gridMatch = paramsStr.match(/gridinterval(?:percent)?\s*=\s*([\d.]+)/);
      if (gridMatch) {
        parameters.gridIntervalPercent = parseFloat(gridMatch[1]);
      }
    }

    return {
      testType: 'single',
      description,
      filters: {},
      parameters,
      symbols: [symbol.toUpperCase()]
    };
  }

  throw new Error(`Could not parse test description: "${description}"\n\nSupported formats:\n` +
    `- Portfolio: "portfolio backtest with beta > 1.75"\n` +
    `- Batch: "batch mode testing gridIntervalPercent values [5, 10, 15, 20] for AAPL"\n` +
    `- Single: "single backtest for AAPL with beta scaling enabled"`);
}

/**
 * Generate portfolio config with filters
 */
async function generatePortfolioConfig(testConfig) {
  const { filters } = testConfig;
  let stocks = [];

  if (filters.symbols && filters.symbols.length > 0) {
    // Use explicit stock list
    stocks = filters.symbols;
  } else {
    // Load base config and filter stocks
    const baseConfig = await loadPortfolioConfig('nasdaq100');
    stocks = baseConfig.stocks;

    // Apply beta filters
    if (filters.betaGt !== undefined || filters.betaLt !== undefined ||
        filters.betaGte !== undefined || filters.betaLte !== undefined) {
      const filteredStocks = [];

      for (const stock of stocks) {
        const beta = await betaService.getBeta(stock);
        if (beta === null) continue;

        let passesFilter = true;
        if (filters.betaGt !== undefined && !(beta > filters.betaGt)) passesFilter = false;
        if (filters.betaLt !== undefined && !(beta < filters.betaLt)) passesFilter = false;
        if (filters.betaGte !== undefined && !(beta >= filters.betaGte)) passesFilter = false;
        if (filters.betaLte !== undefined && !(beta <= filters.betaLte)) passesFilter = false;

        if (passesFilter) {
          filteredStocks.push(stock);
        }
      }

      stocks = filteredStocks;
    }
  }

  if (stocks.length === 0) {
    throw new Error('No stocks match the filter criteria');
  }

  // Generate config name
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  let filterDesc = '';
  if (filters.betaGt) filterDesc = `beta-gt-${filters.betaGt}`;
  if (filters.betaLt) filterDesc = `beta-lt-${filters.betaLt}`;
  if (filters.betaGte) filterDesc = `beta-gte-${filters.betaGte}`;
  if (filters.betaLte) filterDesc = `beta-lte-${filters.betaLte}`;
  if (filters.symbols) filterDesc = 'custom-stocks';

  const configName = `generated_${timestamp}_${filterDesc}`;

  // Create config object
  const config = {
    name: configName,
    description: `Auto-generated config: ${testConfig.description}`,
    stocks,
    totalCapital: 100000,
    lotSizeUsd: 10000,
    maxLots: 10,
    gridIntervalPercent: 10,
    profitRequirement: 10,
    enableBetaScaling: false,
    trailingStopPercent: 20,
    startDate: '2020-01-01',
    endDate: new Date().toISOString().split('T')[0]
  };

  // Save config file
  const configPath = path.join(PORTFOLIO_CONFIGS_DIR, `${configName}.json`);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  console.log(`✅ Generated portfolio config: ${configName}.json with ${stocks.length} stocks`);

  return { config, configName, configPath };
}

/**
 * Generate batch config
 */
function generateBatchConfig(testConfig) {
  const { parameters } = testConfig;
  const { parameter, values, symbol } = parameters;

  const config = {
    symbols: symbol ? [symbol] : ['AAPL'], // Default to AAPL if no symbol specified
    parameterRanges: {
      [parameter]: values
    }
  };

  return config;
}

/**
 * Generate single backtest config
 */
function generateSingleConfig(testConfig) {
  const { symbols, parameters } = testConfig;

  const config = {
    symbol: symbols[0],
    startDate: '2020-01-01',
    endDate: new Date().toISOString().split('T')[0],
    lotSizeUsd: 10000,
    maxLots: 10,
    gridIntervalPercent: 10,
    profitRequirement: 10,
    enableBetaScaling: false,
    trailingStopPercent: 20,
    trailingBuyActivationPercent: 5,
    trailingSellActivationPercent: 5,
    ...parameters
  };

  return config;
}

/**
 * Generate frontend URLs and curl commands
 */
function generateCommands(testConfig, generatedConfig) {
  let frontendUrl = '';
  let curlCommand = '';

  if (testConfig.testType === 'portfolio') {
    const { configName } = generatedConfig;
    frontendUrl = `${FRONTEND_URL}/portfolio-backtest?config=${configName}&rerun=true`;

    curlCommand = `curl -X POST ${BACKEND_URL}/api/portfolio-backtest \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(generatedConfig.config, null, 2)}'`;

  } else if (testConfig.testType === 'batch') {
    const { parameter, values, symbol } = testConfig.parameters;
    frontendUrl = `${FRONTEND_URL}/?mode=batch&symbol=${symbol || 'AAPL'}&param=${parameter}&values=${values.join(',')}`;

    curlCommand = `curl -X POST ${BACKEND_URL}/api/backtest/batch?async=true \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(generatedConfig, null, 2)}'`;

  } else if (testConfig.testType === 'single') {
    const params = new URLSearchParams();
    Object.entries(generatedConfig).forEach(([key, value]) => {
      if (key !== 'symbol') {
        params.append(key, value);
      }
    });

    frontendUrl = `${FRONTEND_URL}/backtest/long/${generatedConfig.symbol}/results?${params.toString()}`;

    curlCommand = `curl -X POST ${BACKEND_URL}/api/backtest/dca \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(generatedConfig, null, 2)}'`;
  }

  return { frontendUrl, curlCommand };
}

/**
 * Execute test via backend API
 */
async function executeTest(testConfig, generatedConfig) {
  console.log(`🚀 Executing ${testConfig.testType} test...`);

  let endpoint = '';
  let payload = null;

  if (testConfig.testType === 'portfolio') {
    endpoint = `${BACKEND_URL}/api/portfolio-backtest`;
    payload = generatedConfig.config;

  } else if (testConfig.testType === 'batch') {
    endpoint = `${BACKEND_URL}/api/backtest/batch?async=false`; // Use sync for immediate results
    payload = generatedConfig;

  } else if (testConfig.testType === 'single') {
    endpoint = `${BACKEND_URL}/api/backtest/dca`;
    payload = generatedConfig;
  }

  try {
    const response = await axios.post(endpoint, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 300000 // 5 minute timeout
    });

    console.log(`✅ Test execution completed successfully`);
    return response.data;

  } catch (error) {
    console.error(`❌ Test execution failed:`, error.message);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data:`, error.response.data);
    }
    throw error;
  }
}

/**
 * Generate HTML from test results
 */
function generateResultHTML(testConfig, results, commands) {
  const { testType, description } = testConfig;
  const { frontendUrl, curlCommand } = commands;

  let summaryHTML = '';
  let detailsHTML = '';

  if (testType === 'portfolio') {
    const data = results.data || results;
    const overall = data.overallMetrics || {};

    summaryHTML = `
      <div class="summary-grid">
        <div class="metric">
          <div class="metric-label">Total Value</div>
          <div class="metric-value">$${(overall.totalValue || 0).toLocaleString()}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Total Profit</div>
          <div class="metric-value profit">${overall.totalProfit >= 0 ? '+' : ''}$${(overall.totalProfit || 0).toLocaleString()}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Win Rate</div>
          <div class="metric-value">${((overall.winRate || 0) * 100).toFixed(1)}%</div>
        </div>
        <div class="metric">
          <div class="metric-label">Stocks Tested</div>
          <div class="metric-value">${data.stocks?.length || 0}</div>
        </div>
      </div>`;

    if (data.stocks && data.stocks.length > 0) {
      detailsHTML = `
        <h2>Stock Results</h2>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Final Value</th>
              <th>Profit</th>
              <th>ROI</th>
              <th>Total Trades</th>
            </tr>
          </thead>
          <tbody>
            ${data.stocks.map(stock => `
              <tr>
                <td><strong>${stock.symbol}</strong></td>
                <td>$${(stock.finalValue || 0).toLocaleString()}</td>
                <td class="${(stock.profit || 0) >= 0 ? 'profit' : 'loss'}">
                  ${(stock.profit || 0) >= 0 ? '+' : ''}$${(stock.profit || 0).toLocaleString()}
                </td>
                <td>${((stock.roi || 0) * 100).toFixed(2)}%</td>
                <td>${stock.totalTrades || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    }

  } else if (testType === 'batch') {
    const data = results.data || results;
    const batchResults = data.results || [];

    summaryHTML = `
      <div class="summary-grid">
        <div class="metric">
          <div class="metric-label">Parameter Tested</div>
          <div class="metric-value">${testConfig.parameters.parameter}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Values Tested</div>
          <div class="metric-value">${testConfig.parameters.values.length}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Symbol</div>
          <div class="metric-value">${testConfig.parameters.symbol || 'AAPL'}</div>
        </div>
      </div>`;

    if (batchResults.length > 0) {
      detailsHTML = `
        <h2>Batch Results</h2>
        <table>
          <thead>
            <tr>
              <th>Value</th>
              <th>Final Value</th>
              <th>Total Profit</th>
              <th>ROI</th>
              <th>Total Trades</th>
            </tr>
          </thead>
          <tbody>
            ${batchResults.map(result => `
              <tr>
                <td><strong>${result.paramValue}</strong></td>
                <td>$${(result.finalValue || 0).toLocaleString()}</td>
                <td class="${(result.totalProfit || 0) >= 0 ? 'profit' : 'loss'}">
                  ${(result.totalProfit || 0) >= 0 ? '+' : ''}$${(result.totalProfit || 0).toLocaleString()}
                </td>
                <td>${((result.roi || 0) * 100).toFixed(2)}%</td>
                <td>${result.totalTrades || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    }

  } else if (testType === 'single') {
    const data = results.data || results;

    summaryHTML = `
      <div class="summary-grid">
        <div class="metric">
          <div class="metric-label">Symbol</div>
          <div class="metric-value">${data.symbol || testConfig.symbols[0]}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Final Value</div>
          <div class="metric-value">$${(data.finalValue || 0).toLocaleString()}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Total Profit</div>
          <div class="metric-value profit">${(data.totalProfit || 0) >= 0 ? '+' : ''}$${(data.totalProfit || 0).toLocaleString()}</div>
        </div>
        <div class="metric">
          <div class="metric-label">ROI</div>
          <div class="metric-value">${((data.roi || 0) * 100).toFixed(2)}%</div>
        </div>
      </div>`;

    if (data.trades && data.trades.length > 0) {
      detailsHTML = `
        <h2>Trade History (Last 20 trades)</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Price</th>
              <th>Quantity</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            ${data.trades.slice(-20).map(trade => `
              <tr>
                <td>${trade.date}</td>
                <td class="${trade.type.toLowerCase()}">${trade.type}</td>
                <td>$${(trade.price || 0).toFixed(2)}</td>
                <td>${trade.quantity || 0}</td>
                <td>$${(trade.value || 0).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    }
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Test Results - ${description}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #0a0e27;
      color: #e0e0e0;
      padding: 20px;
      line-height: 1.6;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    h1 {
      color: #60a5fa;
      margin-bottom: 10px;
      font-size: 2em;
    }

    h2 {
      color: #60a5fa;
      margin-top: 30px;
      margin-bottom: 15px;
      font-size: 1.5em;
      border-bottom: 2px solid #1e40af;
      padding-bottom: 10px;
    }

    .test-info {
      background-color: #1e293b;
      border-left: 4px solid #3b82f6;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 4px;
    }

    .test-info p {
      margin: 5px 0;
    }

    .label {
      color: #94a3b8;
      font-weight: 600;
      margin-right: 10px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }

    .metric {
      background-color: #1e293b;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #334155;
    }

    .metric-label {
      color: #94a3b8;
      font-size: 0.9em;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .metric-value {
      color: #e0e0e0;
      font-size: 1.8em;
      font-weight: 600;
    }

    .metric-value.profit {
      color: #10b981;
    }

    .metric-value.loss {
      color: #ef4444;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background-color: #1e293b;
      border-radius: 8px;
      overflow: hidden;
    }

    thead {
      background-color: #334155;
    }

    th {
      padding: 12px;
      text-align: left;
      color: #e0e0e0;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.85em;
      letter-spacing: 0.5px;
    }

    td {
      padding: 12px;
      border-bottom: 1px solid #334155;
    }

    tbody tr:hover {
      background-color: #2d3748;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .profit {
      color: #10b981;
    }

    .loss {
      color: #ef4444;
    }

    .buy {
      color: #10b981;
      font-weight: 600;
    }

    .sell {
      color: #ef4444;
      font-weight: 600;
    }

    .commands {
      background-color: #1e293b;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border: 1px solid #334155;
    }

    .commands h3 {
      color: #60a5fa;
      margin-bottom: 10px;
    }

    .command-block {
      background-color: #0f172a;
      padding: 15px;
      border-radius: 4px;
      margin: 10px 0;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 0.9em;
      overflow-x: auto;
      border: 1px solid #334155;
    }

    .command-block a {
      color: #60a5fa;
      text-decoration: none;
      word-break: break-all;
    }

    .command-block a:hover {
      text-decoration: underline;
    }

    .command-block pre {
      white-space: pre-wrap;
      word-wrap: break-word;
      color: #94a3b8;
    }

    .metadata {
      background-color: #1e293b;
      padding: 15px;
      border-radius: 8px;
      margin-top: 30px;
      border: 1px solid #334155;
    }

    .metadata h3 {
      color: #60a5fa;
      margin-bottom: 10px;
    }

    code {
      background-color: #0f172a;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 0.9em;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Test Results</h1>

    <div class="test-info">
      <p><span class="label">Test Type:</span>${testType.toUpperCase()}</p>
      <p><span class="label">Description:</span>${description}</p>
      <p><span class="label">Executed:</span>${new Date().toLocaleString()}</p>
    </div>

    <h2>Summary</h2>
    ${summaryHTML}

    ${detailsHTML}

    <div class="commands">
      <h3>Frontend URL</h3>
      <div class="command-block">
        <a href="${frontendUrl}" target="_blank">${frontendUrl}</a>
      </div>

      <h3>cURL Command</h3>
      <div class="command-block">
        <pre>${curlCommand}</pre>
      </div>
    </div>

    <div class="metadata">
      <h3>Full Results Data</h3>
      <div class="command-block">
        <pre>${JSON.stringify(results, null, 2)}</pre>
      </div>
    </div>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Create archive folder and save artifacts
 */
async function createArchive(testConfig, generatedConfig, commands, results, resultHTML) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];

  // Create description slug
  let descSlug = testConfig.description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  const folderName = `${timestamp}_${descSlug}`;
  const archivePath = path.join(TEST_RESULTS_DIR, folderName);

  // Create archive directory
  await fs.mkdir(archivePath, { recursive: true });

  // Save README.md
  const readme = `# Test Archive: ${testConfig.description}

**Test Type:** ${testConfig.testType}
**Executed:** ${new Date().toISOString()}

## Description
${testConfig.description}

## Test Configuration
${JSON.stringify(testConfig, null, 2)}

## Results Summary
- Archive Location: \`${folderName}\`
- Frontend URL: See \`frontend-url.txt\`
- Backend Command: See \`curl-command.sh\`
- Results: See \`result.html\`

## Files in This Archive
- \`README.md\` - This file
- \`config.json\` - Generated test configuration
- \`frontend-url.txt\` - Frontend URL to reproduce test
- \`curl-command.sh\` - Executable backend API command
- \`result.html\` - Test results in HTML format
- \`metadata.json\` - Test execution metadata
`;

  await fs.writeFile(path.join(archivePath, 'README.md'), readme);

  // Save config.json
  await fs.writeFile(
    path.join(archivePath, 'config.json'),
    JSON.stringify(generatedConfig, null, 2)
  );

  // Save frontend-url.txt
  await fs.writeFile(
    path.join(archivePath, 'frontend-url.txt'),
    commands.frontendUrl
  );

  // Save curl-command.sh
  await fs.writeFile(
    path.join(archivePath, 'curl-command.sh'),
    `#!/bin/bash\n\n${commands.curlCommand}\n`
  );

  // Make curl-command.sh executable
  await fs.chmod(path.join(archivePath, 'curl-command.sh'), 0o755);

  // Save result.html
  await fs.writeFile(path.join(archivePath, 'result.html'), resultHTML);

  // Save metadata.json
  const metadata = {
    testType: testConfig.testType,
    description: testConfig.description,
    timestamp: new Date().toISOString(),
    archivePath: folderName,
    success: true
  };

  await fs.writeFile(
    path.join(archivePath, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  console.log(`✅ Archive created: ${folderName}`);

  return { archivePath: folderName, fullPath: archivePath };
}

/**
 * Update archive index.html
 */
async function updateArchiveIndex() {
  // Read all archive directories
  await fs.mkdir(TEST_RESULTS_DIR, { recursive: true });
  const entries = await fs.readdir(TEST_RESULTS_DIR, { withFileTypes: true });
  const archives = [];

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'index.html') {
      try {
        const metadataPath = path.join(TEST_RESULTS_DIR, entry.name, 'metadata.json');
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
        archives.push({ ...metadata, folder: entry.name });
      } catch (error) {
        console.warn(`Could not read metadata for ${entry.name}`);
      }
    }
  }

  // Sort by timestamp (newest first)
  archives.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const indexHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Test Archive Index</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #0a0e27;
      color: #e0e0e0;
      padding: 20px;
      line-height: 1.6;
    }

    .container {
      max-width: 1600px;
      margin: 0 auto;
    }

    h1 {
      color: #60a5fa;
      margin-bottom: 20px;
      font-size: 2.5em;
    }

    .stats {
      background-color: #1e293b;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      border: 1px solid #334155;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }

    .stat {
      text-align: center;
    }

    .stat-value {
      font-size: 2em;
      font-weight: 600;
      color: #60a5fa;
    }

    .stat-label {
      color: #94a3b8;
      margin-top: 5px;
      text-transform: uppercase;
      font-size: 0.85em;
      letter-spacing: 0.5px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background-color: #1e293b;
      border-radius: 8px;
      overflow: hidden;
    }

    thead {
      background-color: #334155;
    }

    th {
      padding: 15px;
      text-align: left;
      color: #e0e0e0;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.85em;
      letter-spacing: 0.5px;
      cursor: pointer;
      user-select: none;
    }

    th:hover {
      background-color: #3f4d66;
    }

    td {
      padding: 15px;
      border-bottom: 1px solid #334155;
    }

    tbody tr:hover {
      background-color: #2d3748;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .test-type {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 0.85em;
      font-weight: 600;
      text-transform: uppercase;
    }

    .test-type.portfolio {
      background-color: #1e3a8a;
      color: #93c5fd;
    }

    .test-type.batch {
      background-color: #713f12;
      color: #fcd34d;
    }

    .test-type.single {
      background-color: #064e3b;
      color: #6ee7b7;
    }

    .view-link {
      color: #60a5fa;
      text-decoration: none;
      font-weight: 600;
    }

    .view-link:hover {
      text-decoration: underline;
    }

    .timestamp {
      color: #94a3b8;
      font-size: 0.9em;
    }
  </style>
  <script>
    function sortTable(columnIndex) {
      const table = document.querySelector('table');
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));

      rows.sort((a, b) => {
        const aValue = a.cells[columnIndex].textContent;
        const bValue = b.cells[columnIndex].textContent;

        if (columnIndex === 0) {
          // Sort by date
          return new Date(bValue) - new Date(aValue);
        } else {
          // Sort alphabetically
          return aValue.localeCompare(bValue);
        }
      });

      rows.forEach(row => tbody.appendChild(row));
    }
  </script>
</head>
<body>
  <div class="container">
    <h1>Test Archive Index</h1>

    <div class="stats">
      <div class="stats-grid">
        <div class="stat">
          <div class="stat-value">${archives.length}</div>
          <div class="stat-label">Total Tests</div>
        </div>
        <div class="stat">
          <div class="stat-value">${archives.filter(a => a.testType === 'portfolio').length}</div>
          <div class="stat-label">Portfolio Tests</div>
        </div>
        <div class="stat">
          <div class="stat-value">${archives.filter(a => a.testType === 'batch').length}</div>
          <div class="stat-label">Batch Tests</div>
        </div>
        <div class="stat">
          <div class="stat-value">${archives.filter(a => a.testType === 'single').length}</div>
          <div class="stat-label">Single Tests</div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th onclick="sortTable(0)">Date</th>
          <th onclick="sortTable(1)">Type</th>
          <th onclick="sortTable(2)">Description</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${archives.map(archive => `
          <tr>
            <td class="timestamp">${new Date(archive.timestamp).toLocaleString()}</td>
            <td><span class="test-type ${archive.testType}">${archive.testType}</span></td>
            <td>${archive.description}</td>
            <td>
              <a href="${archive.folder}/result.html" class="view-link" target="_blank">View Results</a>
              |
              <a href="${archive.folder}/README.md" class="view-link" target="_blank">README</a>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  await fs.writeFile(path.join(TEST_RESULTS_DIR, 'index.html'), indexHTML);
  console.log(`✅ Archive index updated with ${archives.length} tests`);
}

/**
 * Main orchestrator - executes test end-to-end
 */
async function runAutomatedTest(description) {
  const startTime = Date.now();

  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎯 Starting automated test: ${description}`);
    console.log(`${'='.repeat(80)}\n`);

    // Parse description
    console.log('📝 Parsing test description...');
    const testConfig = await parseTestDescription(description);
    console.log(`✅ Parsed as ${testConfig.testType} test`);
    console.log(`   Filters:`, JSON.stringify(testConfig.filters));
    console.log(`   Parameters:`, JSON.stringify(testConfig.parameters));

    // Generate config
    console.log('\n⚙️  Generating test configuration...');
    let generatedConfig;

    if (testConfig.testType === 'portfolio') {
      generatedConfig = await generatePortfolioConfig(testConfig);
    } else if (testConfig.testType === 'batch') {
      generatedConfig = generateBatchConfig(testConfig);
    } else if (testConfig.testType === 'single') {
      generatedConfig = generateSingleConfig(testConfig);
    }

    // Generate commands
    console.log('\n🔗 Generating URLs and commands...');
    const commands = generateCommands(testConfig, generatedConfig);
    console.log(`✅ Frontend URL: ${commands.frontendUrl}`);

    // Execute test
    console.log('\n🚀 Executing test...');
    const results = await executeTest(testConfig, generatedConfig);

    // Generate HTML
    console.log('\n📊 Generating result HTML...');
    const resultHTML = generateResultHTML(testConfig, results, commands);
    console.log('✅ HTML generated');

    // Create archive
    console.log('\n💾 Creating archive...');
    const archive = await createArchive(testConfig, generatedConfig, commands, results, resultHTML);

    // Update index
    console.log('\n📇 Updating archive index...');
    await updateArchiveIndex();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ Test completed successfully in ${duration}s`);
    console.log(`📁 Archive: test-results/${archive.archivePath}`);
    console.log(`🌐 View results: test-results/${archive.archivePath}/result.html`);
    console.log(`📑 View all tests: test-results/index.html`);
    console.log(`${'='.repeat(80)}\n`);

    return {
      success: true,
      archivePath: archive.archivePath,
      fullPath: archive.fullPath,
      duration,
      frontendUrl: commands.frontendUrl
    };

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.error(`\n${'='.repeat(80)}`);
    console.error(`❌ Test failed after ${duration}s`);
    console.error(`Error: ${error.message}`);
    console.error(`${'='.repeat(80)}\n`);

    throw error;
  }
}

module.exports = {
  runAutomatedTest,
  parseTestDescription,
  generatePortfolioConfig,
  generateBatchConfig,
  generateSingleConfig,
  generateCommands,
  executeTest,
  generateResultHTML,
  createArchive,
  updateArchiveIndex
};
