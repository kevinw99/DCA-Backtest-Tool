/**
 * Index Tracking Service
 *
 * Manages historical index constituency data to ensure realistic backtests
 * that account for when stocks were actually added or removed from an index.
 *
 * Eliminates survivorship bias by preventing trading of stocks before they
 * were added to the index.
 */

const fs = require('fs').promises;
const path = require('path');

class IndexTrackingService {
  constructor() {
    this.history = null;
    this.stockMap = null;
    this.indexName = null;
  }

  /**
   * Load index history from JSON file
   * @param {string} indexName - Index identifier (e.g., "NASDAQ-100")
   * @returns {Promise<void>}
   */
  async loadIndexHistory(indexName) {
    try {
      // Build file path
      const fileName = indexName.toLowerCase().replace(/[^a-z0-9]/g, '') + '-history.json';
      const filePath = path.join(__dirname, '../data', fileName);

      console.log(`📊 Loading index history: ${indexName} from ${filePath}`);

      // Read and parse file
      const fileContent = await fs.readFile(filePath, 'utf8');
      this.history = JSON.parse(fileContent);
      this.indexName = indexName;

      // Build fast lookup map: symbol => {addedDate, removedDate, notes}
      this.stockMap = new Map();

      for (const change of this.history.changes) {
        this.stockMap.set(change.symbol, {
          addedDate: change.addedDate,
          removedDate: change.removedDate,
          notes: change.notes
        });
      }

      console.log(`✅ Index history loaded: ${this.history.changes.length} tracked changes for ${indexName}`);
      console.log(`   Coverage: ${this.history.metadata.coverage}`);

    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`⚠️  Index history file not found: ${indexName}`);
        console.warn(`   Defaulting to: all stocks in index for entire period (backward compatibility)`);
        this.history = { changes: [], metadata: {} };
        this.stockMap = new Map();
        this.indexName = indexName;
      } else {
        throw new Error(`Failed to load index history for ${indexName}: ${error.message}`);
      }
    }
  }

  /**
   * Check if stock is in index on given date
   * @param {string} symbol - Stock symbol
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {boolean} True if stock is in index on this date
   */
  isInIndex(symbol, date) {
    // If stock not tracked, assume it was in index for entire period (backward compatibility)
    if (!this.stockMap.has(symbol)) {
      return true;
    }

    const info = this.stockMap.get(symbol);

    // Check if date is before stock was added
    if (info.addedDate && date < info.addedDate) {
      return false;
    }

    // Check if date is after stock was removed
    if (info.removedDate && date >= info.removedDate) {
      return false;
    }

    // Stock is in index on this date
    return true;
  }

  /**
   * Get trading period for a stock
   * @param {string} symbol - Stock symbol
   * @param {string} backtestStartDate - Backtest start date (YYYY-MM-DD)
   * @param {string} backtestEndDate - Backtest end date (YYYY-MM-DD)
   * @returns {Object} { canTrade, startDate, endDate, isPartial }
   */
  getTradingPeriod(symbol, backtestStartDate, backtestEndDate) {
    // If stock not tracked, it can trade for entire backtest period
    if (!this.stockMap.has(symbol)) {
      return {
        canTrade: true,
        startDate: backtestStartDate,
        endDate: backtestEndDate,
        isPartial: false
      };
    }

    const info = this.stockMap.get(symbol);

    // Calculate effective start date: max(backtestStart, addedDate || backtestStart)
    const effectiveStartDate = info.addedDate && info.addedDate > backtestStartDate
      ? info.addedDate
      : backtestStartDate;

    // Calculate effective end date: min(backtestEnd, removedDate || backtestEnd)
    const effectiveEndDate = info.removedDate && info.removedDate < backtestEndDate
      ? info.removedDate
      : backtestEndDate;

    // Check if stock can be traded (effective start must be before effective end)
    const canTrade = effectiveStartDate < effectiveEndDate;

    // Check if this is a partial period
    const isPartial = effectiveStartDate !== backtestStartDate || effectiveEndDate !== backtestEndDate;

    return {
      canTrade,
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      isPartial
    };
  }

  /**
   * Get all index changes within date range
   * @param {string} startDate - Range start (YYYY-MM-DD)
   * @param {string} endDate - Range end (YYYY-MM-DD)
   * @returns {Array<Object>} Array of change events: {symbol, date, type, notes}
   */
  getIndexChanges(startDate, endDate) {
    const changes = [];

    for (const change of this.history.changes) {
      // Check for additions within date range
      if (change.addedDate && change.addedDate >= startDate && change.addedDate <= endDate) {
        changes.push({
          symbol: change.symbol,
          date: change.addedDate,
          type: 'addition',
          notes: change.notes
        });
      }

      // Check for removals within date range
      if (change.removedDate && change.removedDate >= startDate && change.removedDate <= endDate) {
        changes.push({
          symbol: change.symbol,
          date: change.removedDate,
          type: 'removal',
          notes: change.notes
        });
      }
    }

    // Sort by date (earliest first)
    changes.sort((a, b) => a.date.localeCompare(b.date));

    return changes;
  }

  /**
   * Get info about a specific stock
   * @param {string} symbol - Stock symbol
   * @returns {Object|null} Stock info or null if not tracked
   */
  getStockInfo(symbol) {
    if (!this.stockMap.has(symbol)) {
      return null;
    }
    return { symbol, ...this.stockMap.get(symbol) };
  }

  /**
   * Check if service is loaded and ready
   * @returns {boolean}
   */
  isLoaded() {
    return this.history !== null && this.stockMap !== null;
  }

  /**
   * Get metadata about loaded index history
   * @returns {Object} Metadata
   */
  getMetadata() {
    if (!this.isLoaded()) {
      return null;
    }

    return {
      indexName: this.indexName,
      totalChanges: this.history.changes.length,
      coverage: this.history.metadata.coverage,
      lastUpdated: this.history.lastUpdated
    };
  }
}

module.exports = IndexTrackingService;
