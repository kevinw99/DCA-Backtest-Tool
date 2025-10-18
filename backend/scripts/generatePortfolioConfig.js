#!/usr/bin/env node

/**
 * Generate Portfolio Config File
 *
 * This script generates a portfolio configuration JSON file for backtesting.
 * It supports loading stock symbols from a file or comma-separated list,
 * and can use global defaults from backtestDefaults.json or custom parameters.
 *
 * Usage:
 *   node generatePortfolioConfig.js \
 *     --name "Portfolio Name" \
 *     --stocks-file "data/stocks.txt" \
 *     --total-capital 3000000 \
 *     --start-date 2021-09-01 \
 *     --end-date current \
 *     --use-defaults \
 *     --output configs/portfolios/my-portfolio.json
 */

const fs = require('fs').promises;
const path = require('path');

// Parse command-line arguments
function parseArgs(argv) {
  const args = {};

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
      return args;
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];

      // Handle flags without values
      if (key === 'use-defaults') {
        args[key] = true;
        continue;
      }

      if (!value || value.startsWith('--')) {
        console.error(`Error: Missing value for ${arg}`);
        process.exit(1);
      }

      args[key] = value;
      i++; // Skip next argument since we consumed it
    }
  }

  return args;
}

// Show help message
function showHelp() {
  console.log(`
Generate Portfolio Config File

Usage:
  node generatePortfolioConfig.js [options]

Required Options:
  --name <name>              Portfolio name
  --total-capital <amount>   Total capital in USD
  --start-date <date>        Start date (YYYY-MM-DD)
  --end-date <date>          End date (YYYY-MM-DD or "current")
  --output <path>            Output file path

Stock Selection (one required):
  --stocks-file <path>       Path to file with stock symbols (one per line)
  --stocks <symbols>         Comma-separated stock symbols (e.g., "AAPL,MSFT,NVDA")

Parameter Options (one required):
  --use-defaults             Use global defaults from config/backtestDefaults.json
  OR provide custom parameters:
  --lot-size <amount>        Lot size in USD (default: 10000)
  --max-lots <number>        Max lots per stock (default: 10)
  --grid-interval <percent>  Grid interval percent (default: 10)
  --profit-requirement <percent> Profit requirement percent (default: 10)

Optional:
  --description <text>       Portfolio description
  --help, -h                 Show this help message

Examples:
  # Generate Nasdaq 100 portfolio config using defaults
  node generatePortfolioConfig.js \\
    --name "Nasdaq 100" \\
    --stocks-file "data/nasdaq100-symbols.txt" \\
    --total-capital 3000000 \\
    --start-date 2021-09-01 \\
    --end-date current \\
    --use-defaults \\
    --output configs/portfolios/nasdaq100.json

  # Generate tech portfolio with custom parameters
  node generatePortfolioConfig.js \\
    --name "Tech Portfolio" \\
    --stocks "AAPL,MSFT,NVDA,TSLA,GOOGL" \\
    --total-capital 500000 \\
    --start-date 2023-01-01 \\
    --end-date current \\
    --lot-size 15000 \\
    --max-lots 8 \\
    --output configs/portfolios/tech-portfolio.json
`);
}

// Validate required arguments
function validateArgs(args) {
  const required = ['name', 'total-capital', 'start-date', 'end-date', 'output'];

  for (const field of required) {
    if (!args[field]) {
      console.error(`Error: Missing required argument --${field}`);
      return false;
    }
  }

  // Must have either stocks-file or stocks
  if (!args['stocks-file'] && !args['stocks']) {
    console.error('Error: Must provide either --stocks-file or --stocks');
    return false;
  }

  // Must have either use-defaults or custom parameters
  if (!args['use-defaults'] && !args['lot-size']) {
    console.error('Error: Must provide either --use-defaults or custom parameters (--lot-size, --max-lots, etc.)');
    return false;
  }

  // Validate total capital is a number
  const totalCapital = parseFloat(args['total-capital']);
  if (isNaN(totalCapital) || totalCapital < 1000) {
    console.error('Error: total-capital must be a number >= 1000');
    return false;
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(args['start-date'])) {
    console.error('Error: start-date must be in YYYY-MM-DD format');
    return false;
  }

  if (args['end-date'] !== 'current' && !dateRegex.test(args['end-date'])) {
    console.error('Error: end-date must be YYYY-MM-DD or "current"');
    return false;
  }

  return true;
}

// Load stock symbols from file
async function loadStocksFromFile(filePath) {
  try {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    const content = await fs.readFile(absolutePath, 'utf8');

    // Split by newlines, trim whitespace, filter empty lines
    const stocks = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !line.startsWith('#')); // Allow comments

    return stocks;
  } catch (error) {
    throw new Error(`Failed to load stocks from file ${filePath}: ${error.message}`);
  }
}

// Load backtest defaults from config file
async function loadBacktestDefaults() {
  try {
    const defaultsPath = path.join(__dirname, '../../config/backtestDefaults.json');
    const content = await fs.readFile(defaultsPath, 'utf8');
    const defaults = JSON.parse(content);

    // Return the global defaults
    return defaults.global;
  } catch (error) {
    throw new Error(`Failed to load backtest defaults: ${error.message}`);
  }
}

// Build defaults from command-line arguments
function buildDefaultsFromArgs(args) {
  const lotSize = args['lot-size'] ? parseFloat(args['lot-size']) : 10000;
  const maxLots = args['max-lots'] ? parseInt(args['max-lots'], 10) : 10;
  const gridInterval = args['grid-interval'] ? parseFloat(args['grid-interval']) : 10;
  const profitRequirement = args['profit-requirement'] ? parseFloat(args['profit-requirement']) : 10;

  return {
    basic: {
      lotSizeUsd: lotSize,
      strategyMode: "long"
    },
    longStrategy: {
      maxLots: maxLots,
      maxLotsToSell: 1,
      gridIntervalPercent: gridInterval,
      profitRequirement: profitRequirement,
      trailingBuyActivationPercent: 10,
      trailingBuyReboundPercent: 5,
      trailingSellActivationPercent: 20,
      trailingSellPullbackPercent: 10
    },
    shortStrategy: {
      maxShorts: 6,
      maxShortsToCovers: 3,
      gridIntervalPercent: 10,
      profitRequirement: 10,
      trailingShortActivationPercent: 25,
      trailingShortPullbackPercent: 15,
      trailingCoverActivationPercent: 20,
      trailingCoverReboundPercent: 10,
      stopLoss: {
        hardStopLossPercent: 30,
        portfolioStopLossPercent: 25,
        cascadeStopLossPercent: 35
      }
    },
    beta: {
      enableBetaScaling: false,
      beta: 1,
      betaFactor: 1,
      coefficient: 1,
      isManualBetaOverride: false
    },
    dynamicFeatures: {
      enableDynamicGrid: false,
      dynamicGridMultiplier: 1,
      enableConsecutiveIncrementalBuyGrid: false,
      gridConsecutiveIncrement: 5,
      enableConsecutiveIncrementalSellProfit: false,
      enableScenarioDetection: false,
      normalizeToReference: false
    },
    adaptiveStrategy: {
      enableAdaptiveStrategy: false,
      adaptationCheckIntervalDays: 30,
      adaptationRollingWindowDays: 90,
      minDataDaysBeforeAdaptation: 90,
      confidenceThreshold: 0.7
    }
  };
}

// Get current date in YYYY-MM-DD format
function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Write config to file
async function writeConfigFile(config, outputPath) {
  try {
    const absolutePath = path.isAbsolute(outputPath)
      ? outputPath
      : path.join(process.cwd(), outputPath);

    // Ensure directory exists
    const dir = path.dirname(absolutePath);
    await fs.mkdir(dir, { recursive: true });

    // Write JSON with pretty formatting
    await fs.writeFile(
      absolutePath,
      JSON.stringify(config, null, 2) + '\n',
      'utf8'
    );

    return absolutePath;
  } catch (error) {
    throw new Error(`Failed to write config file: ${error.message}`);
  }
}

// Main function
async function main() {
  const args = parseArgs(process.argv);

  // Show help if requested
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Validate arguments
  if (!validateArgs(args)) {
    console.log('\nRun with --help for usage information');
    process.exit(1);
  }

  try {
    console.log('📋 Generating portfolio config...\n');

    // Load stock symbols
    let stocks;
    if (args['stocks-file']) {
      console.log(`Loading stocks from: ${args['stocks-file']}`);
      stocks = await loadStocksFromFile(args['stocks-file']);
      console.log(`✅ Loaded ${stocks.length} stocks\n`);
    } else {
      stocks = args['stocks'].split(',').map(s => s.trim());
      console.log(`✅ Using ${stocks.length} stocks from command line\n`);
    }

    // Load or build global defaults
    let globalDefaults;
    if (args['use-defaults']) {
      console.log('Loading global defaults from backtestDefaults.json');
      globalDefaults = await loadBacktestDefaults();
      console.log('✅ Loaded global defaults\n');
    } else {
      console.log('Building custom defaults from arguments');
      globalDefaults = buildDefaultsFromArgs(args);
      console.log('✅ Built custom defaults\n');
    }

    // Resolve end date
    const endDate = args['end-date'] === 'current'
      ? getCurrentDate()
      : args['end-date'];

    // Build config object
    const config = {
      name: args['name'],
      description: args['description'] || `Portfolio backtest for ${args['name']}`,
      totalCapitalUsd: parseFloat(args['total-capital']),
      startDate: args['start-date'],
      endDate: endDate,
      globalDefaults: globalDefaults,
      stocks: stocks,
      stockSpecificOverrides: {}
    };

    // Write config file
    console.log(`Writing config to: ${args['output']}`);
    const writtenPath = await writeConfigFile(config, args['output']);

    console.log('\n✅ Portfolio config generated successfully!');
    console.log('\nConfig Summary:');
    console.log(`  Name: ${config.name}`);
    console.log(`  Stocks: ${config.stocks.length}`);
    console.log(`  Capital: $${config.totalCapitalUsd.toLocaleString()}`);
    console.log(`  Period: ${config.startDate} to ${endDate}`);
    console.log(`  File: ${writtenPath}`);

    console.log('\nTo run backtest:');
    const configFileName = path.basename(args['output']).replace('.json', '');
    console.log(`  curl http://localhost:3001/api/backtest/portfolio/config/${configFileName}`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run main function
main();
