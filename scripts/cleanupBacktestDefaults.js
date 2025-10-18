#!/usr/bin/env node

/**
 * Cleanup script for Spec 36 - Remove duplicate parameters from backtestDefaults.json
 *
 * This script:
 * 1. Loads backtestDefaults.json
 * 2. Extracts only differences from global defaults for each stock
 * 3. Removes stocks with no differences (like MSFT)
 * 4. Creates a backup before modifying
 * 5. Writes cleaned version back to file
 */

const fs = require('fs');
const path = require('path');

// Path to backtestDefaults.json
const configPath = path.join(__dirname, '../frontend/src/config/backtestDefaults.json');
const backupPath = path.join(__dirname, '../frontend/src/config/backtestDefaults.json.backup');

/**
 * Deep clone an object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Extract differences between global defaults and stock parameters
 * Returns only the parameters that differ
 */
function extractDifferences(globalObj, stockObj) {
  if (!stockObj) return {};
  if (!globalObj) return stockObj;

  const diff = {};

  for (const key in stockObj) {
    const globalValue = globalObj[key];
    const stockValue = stockObj[key];

    // Handle nested objects (like stopLoss)
    if (
      typeof stockValue === 'object' &&
      !Array.isArray(stockValue) &&
      stockValue !== null
    ) {
      const nestedDiff = extractDifferences(globalValue || {}, stockValue);
      if (Object.keys(nestedDiff).length > 0) {
        diff[key] = nestedDiff;
      }
    }
    // Compare primitive values
    else if (stockValue !== globalValue) {
      diff[key] = stockValue;
    }
  }

  return diff;
}

/**
 * Clean up stock defaults by removing duplicates
 */
function cleanupStockDefaults() {
  console.log('📦 Loading backtestDefaults.json...\n');

  const backtestDefaults = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const globalDefaults = backtestDefaults.global;
  const cleaned = { global: globalDefaults };

  const sections = ['basic', 'longStrategy', 'shortStrategy', 'beta', 'dynamicFeatures', 'adaptiveStrategy'];

  let totalLinesRemoved = 0;
  let stocksRemoved = 0;

  for (const symbol in backtestDefaults) {
    if (symbol === 'global') continue;

    const stockParams = backtestDefaults[symbol];
    const stockDiff = {};

    // Count original lines for this stock
    const originalLines = JSON.stringify(stockParams, null, 2).split('\n').length;

    // Extract differences for each section
    for (const section of sections) {
      const sectionDiff = extractDifferences(
        globalDefaults[section] || {},
        stockParams[section]
      );

      if (Object.keys(sectionDiff).length > 0) {
        stockDiff[section] = sectionDiff;
      }
    }

    // Only add stock if it has differences
    if (Object.keys(stockDiff).length > 0) {
      cleaned[symbol] = stockDiff;
      const newLines = JSON.stringify(stockDiff, null, 2).split('\n').length;
      const linesRemoved = originalLines - newLines;
      totalLinesRemoved += linesRemoved;

      console.log(`✅ ${symbol}:`);
      console.log(`   Original: ${originalLines} lines`);
      console.log(`   Cleaned: ${newLines} lines`);
      console.log(`   Removed: ${linesRemoved} lines (${((linesRemoved / originalLines) * 100).toFixed(1)}% reduction)`);
      console.log(`   Differences in: ${Object.keys(stockDiff).join(', ')}\n`);
    } else {
      stocksRemoved++;
      totalLinesRemoved += originalLines;
      console.log(`🗑️  ${symbol}: REMOVED (no differences from global)`);
      console.log(`   Removed: ${originalLines} lines\n`);
    }
  }

  const originalFileLines = JSON.stringify(backtestDefaults, null, 2).split('\n').length;
  const cleanedFileLines = JSON.stringify(cleaned, null, 2).split('\n').length;

  console.log('\n📊 Summary:');
  console.log(`   Stocks removed: ${stocksRemoved}`);
  console.log(`   Total lines removed: ${totalLinesRemoved}`);
  console.log(`   File size: ${originalFileLines} → ${cleanedFileLines} lines`);
  console.log(`   Overall reduction: ${((totalLinesRemoved / originalFileLines) * 100).toFixed(1)}%\n`);

  return cleaned;
}

/**
 * Main execution
 */
function main() {
  console.log('🧹 Spec 36 - Cleanup backtestDefaults.json\n');
  console.log('This script removes duplicate parameters that match global defaults.\n');

  // Create backup
  console.log(`💾 Creating backup: ${path.basename(backupPath)}\n`);
  fs.copyFileSync(configPath, backupPath);

  // Clean up
  const cleaned = cleanupStockDefaults();

  // Write cleaned version
  console.log(`💾 Writing cleaned version to: ${path.basename(configPath)}\n`);
  fs.writeFileSync(configPath, JSON.stringify(cleaned, null, 2) + '\n');

  console.log('✅ Cleanup complete!\n');
  console.log('📌 Next steps:');
  console.log('   1. Verify the cleaned file looks correct');
  console.log('   2. Test loading stock parameters');
  console.log(`   3. If issues occur, restore from: ${path.basename(backupPath)}\n`);
}

main();
