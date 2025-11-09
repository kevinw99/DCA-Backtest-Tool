/**
 * Beta Group Analysis Service
 *
 * Analyzes portfolio backtest results grouped by beta ranges
 * Identifies which beta groups are most suitable for DCA strategy
 *
 * BETA-SPECIFIC implementation
 * Reusable pattern for other factors (revenue growth, market cap, etc.)
 */

const betaDataService = require('./betaDataService');
const {
  aggregateGroupMetrics,
  identifyTopBottomPerformers,
  calculateSummaryStatistics
} = require('./helpers/groupMetricsCalculator');

// BETA-SPECIFIC: Range definitions
const BETA_RANGES = [
  {
    id: 'low',
    label: '0.00 - 0.50',
    description: 'Low volatility (defensive stocks)',
    minBeta: 0,
    maxBeta: 0.5,
    color: '#4CAF50'
  },
  {
    id: 'below-market',
    label: '0.50 - 1.00',
    description: 'Below-market volatility',
    minBeta: 0.5,
    maxBeta: 1.0,
    color: '#8BC34A'
  },
  {
    id: 'market',
    label: '1.00 - 1.50',
    description: 'Market-level volatility',
    minBeta: 1.0,
    maxBeta: 1.5,
    color: '#FFC107'
  },
  {
    id: 'high',
    label: '1.50 - 2.00',
    description: 'High volatility',
    minBeta: 1.5,
    maxBeta: 2.0,
    color: '#FF9800'
  },
  {
    id: 'very-high',
    label: '> 2.00',
    description: 'Very high volatility',
    minBeta: 2.0,
    maxBeta: Infinity,
    color: '#F44336'
  }
];

class BetaGroupAnalysisService {

  /**
   * Main analysis entry point
   *
   * @param {Array} stockResults - Stock backtest results from portfolio
   * @param {Object} backtestPeriod - { startDate, endDate }
   * @returns {Object} Beta grouping analysis
   */
  async analyzeBetaGroups(stockResults, backtestPeriod) {
    try {
      console.log(`[BetaGroupAnalysis] Starting analysis for ${stockResults.length} stocks...`);

      // BETA-SPECIFIC: Enrich stocks with beta values
      const stocksWithBeta = await this._enrichWithBeta(stockResults);

      // BETA-SPECIFIC: Classify into beta ranges
      const groups = this._classifyByBetaRange(stocksWithBeta);

      // GENERIC: Aggregate performance metrics per group
      const groupsWithMetrics = this._aggregateGroupMetrics(groups, backtestPeriod);

      // GENERIC: Calculate summary statistics
      const summary = this._calculateSummary(stocksWithBeta, groupsWithMetrics);

      console.log(`[BetaGroupAnalysis] Analysis complete. Groups: ${groupsWithMetrics.length}`);

      return {
        groups: groupsWithMetrics,
        summary
      };

    } catch (error) {
      console.error('[BetaGroupAnalysis] Analysis failed:', error);
      return null;
    }
  }

  /**
   * BETA-SPECIFIC: Enrich stock results with beta values
   */
  async _enrichWithBeta(stockResults) {
    const enriched = [];

    for (const stock of stockResults) {
      // Skip stocks that were skipped in backtest
      if (stock.skipped) {
        continue;
      }

      try {
        const betaData = await betaDataService.fetchBeta(stock.symbol);
        enriched.push({
          ...stock,
          beta: betaData.beta,
          betaSource: betaData.source
        });
      } catch (error) {
        console.warn(`[BetaGroupAnalysis] Failed to fetch beta for ${stock.symbol}, defaulting to 1.0`);
        enriched.push({
          ...stock,
          beta: 1.0,
          betaSource: 'default'
        });
      }
    }

    return enriched;
  }

  /**
   * BETA-SPECIFIC: Classify stocks into beta ranges
   */
  _classifyByBetaRange(stocksWithBeta) {
    const groups = BETA_RANGES.map(range => ({
      ...range,
      stocks: []
    }));

    for (const stock of stocksWithBeta) {
      for (const group of groups) {
        if (stock.beta >= group.minBeta && stock.beta < group.maxBeta) {
          group.stocks.push(stock);
          break;
        }
      }
    }

    return groups;
  }

  /**
   * GENERIC: Aggregate performance metrics for each group
   */
  _aggregateGroupMetrics(groups, backtestPeriod) {
    return groups.map(group => {
      const stocks = group.stocks;

      if (stocks.length === 0) {
        return {
          ...group,
          stockCount: 0,
          performance: null,
          topPerformers: [],
          bottomPerformers: []
        };
      }

      // Use generic helper to calculate metrics
      const performance = aggregateGroupMetrics(stocks, backtestPeriod);

      // Identify top/bottom performers
      const { topPerformers, bottomPerformers } = identifyTopBottomPerformers(stocks, 5, 5);

      // Add beta values to performers
      const enrichedTopPerformers = topPerformers.map(p => {
        const stock = stocks.find(s => s.symbol === p.symbol);
        return { ...p, beta: stock ? stock.beta : null };
      });

      const enrichedBottomPerformers = bottomPerformers.map(p => {
        const stock = stocks.find(s => s.symbol === p.symbol);
        return { ...p, beta: stock ? stock.beta : null };
      });

      return {
        ...group,
        stockCount: stocks.length,
        performance,
        topPerformers: enrichedTopPerformers,
        bottomPerformers: enrichedBottomPerformers
      };
    });
  }

  /**
   * GENERIC: Calculate summary statistics across all groups
   */
  _calculateSummary(stocksWithBeta, groups) {
    // Calculate beta statistics
    const betas = stocksWithBeta.map(s => s.beta);
    const avgBeta = betas.reduce((sum, b) => sum + b, 0) / Math.max(betas.length, 1);
    const sortedBetas = [...betas].sort((a, b) => a - b);
    const medianBeta = sortedBetas[Math.floor(sortedBetas.length / 2)] || 0;
    const minBeta = Math.min(...betas, 0);
    const maxBeta = Math.max(...betas, 0);

    // Use generic helper for group comparison
    const groupStats = calculateSummaryStatistics(stocksWithBeta, groups);

    return {
      totalStocks: stocksWithBeta.length,
      avgBeta: parseFloat(avgBeta.toFixed(2)),
      medianBeta: parseFloat(medianBeta.toFixed(2)),
      minBeta: parseFloat(minBeta.toFixed(2)),
      maxBeta: parseFloat(maxBeta.toFixed(2)),
      ...groupStats
    };
  }
}

// Export singleton instance
module.exports = new BetaGroupAnalysisService();
