/**
 * Group Metrics Calculator
 *
 * Generic metric aggregation for stock grouping analysis
 * Can be reused for beta grouping, revenue growth grouping, sector grouping, etc.
 */

const { calculateDCASuitabilityScore } = require('./dcaSuitabilityScorer');

/**
 * Aggregate performance metrics for a group of stocks
 *
 * GENERIC - Works for any grouping factor (beta, revenue growth, market cap, etc.)
 *
 * @param {Array} stocks - Array of stock result objects with enriched data
 * @param {Object} backtestPeriod - { startDate, endDate } for CAGR calculation
 * @returns {Object} Aggregated performance metrics
 */
function aggregateGroupMetrics(stocks, backtestPeriod) {
  if (!stocks || stocks.length === 0) {
    return null;
  }

  // Calculate total and average metrics
  const totalReturnDollar = stocks.reduce((sum, s) => sum + (s.totalPNL || 0), 0);
  const deployedCapital = stocks.reduce((sum, s) => sum + (s.maxCapitalDeployed || s.capitalDeployed || 0), 0);

  const totalReturnPercent = deployedCapital > 0
    ? (totalReturnDollar / deployedCapital) * 100
    : 0;

  // Win rate calculation
  const totalBuys = stocks.reduce((sum, s) => sum + (s.totalBuys || 0), 0);
  const totalSells = stocks.reduce((sum, s) => sum + (s.totalSells || 0), 0);
  const totalTrades = totalBuys + totalSells;

  // Calculate wins and losses from transactions
  let winningTrades = 0;
  let losingTrades = 0;
  let totalProfit = 0;
  let totalLoss = 0;
  let profitableExits = 0;  // Sells at profit (not stop loss)
  let stopLossExits = 0;     // Sells at loss (stop loss)

  stocks.forEach(stock => {
    if (stock.transactions && Array.isArray(stock.transactions)) {
      stock.transactions.forEach(tx => {
        if (tx.type === 'sell') {
          // Calculate P&L for this sell
          const pnl = (tx.pnl !== undefined && tx.pnl !== null) ? tx.pnl : 0;

          if (pnl > 0) {
            winningTrades++;
            totalProfit += pnl;
            profitableExits++;
          } else {
            losingTrades++;
            totalLoss += Math.abs(pnl);
            stopLossExits++;
          }
        }
      });
    }
  });

  const winRate = totalSells > 0 ? (winningTrades / totalSells) * 100 : 0;
  const avgProfitPerTrade = winningTrades > 0 ? totalProfit / winningTrades : 0;
  const avgLossPerTrade = losingTrades > 0 ? totalLoss / losingTrades : 0;
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0;

  // Mean reversion score: % of buys that eventually sold at profit (vs stop loss)
  const meanReversionScore = totalBuys > 0
    ? (profitableExits / totalBuys) * 100
    : 0;

  // Trade frequency: average trades per stock per year
  const yearsDuration = calculateYearsDuration(backtestPeriod);
  const tradesPerStock = stocks.length > 0 ? totalTrades / stocks.length : 0;
  const tradeFrequency = yearsDuration > 0 ? tradesPerStock / yearsDuration : 0;

  // Capital utilization: average % of allocated capital deployed
  const avgCapitalUtilization = stocks.length > 0
    ? stocks.reduce((sum, s) => {
        const allocated = (s.maxCapitalDeployed || s.capitalDeployed || 0);
        const utilization = allocated > 0 ? ((s.capitalDeployed || 0) / allocated) * 100 : 0;
        return sum + utilization;
      }, 0) / stocks.length
    : 0;

  // Capital turnover: total traded / average deployed
  const avgDeployed = stocks.reduce((sum, s) => sum + (s.capitalDeployed || 0), 0) / Math.max(stocks.length, 1);
  const totalTraded = totalBuys * avgDeployed; // Simplified: assume each buy = avg lot size
  const capitalTurnover = avgDeployed > 0 ? totalTraded / avgDeployed : 0;

  // Grid utilization: average lots held / max lots
  const gridUtilization = stocks.length > 0
    ? stocks.reduce((sum, s) => {
        const maxLots = (s.params && s.params.maxLots) ? s.params.maxLots : 10;
        const avgLots = s.lotsHeld || 0;
        return sum + ((avgLots / maxLots) * 100);
      }, 0) / stocks.length
    : 0;

  // CAGR calculation
  const cagrPercent = calculateCAGR(totalReturnPercent, yearsDuration);

  // Max drawdown (simplified - would need daily tracking for accuracy)
  const maxDrawdown = stocks.length > 0
    ? Math.max(...stocks.map(s => Math.abs(s.unrealizedPNL || 0) / Math.max(s.capitalDeployed, 1)))
    : 0;

  // Assemble metrics object
  const metrics = {
    // Standard performance
    totalReturnPercent: parseFloat(totalReturnPercent.toFixed(2)),
    totalReturnDollar: parseFloat(totalReturnDollar.toFixed(2)),
    cagrPercent: parseFloat(cagrPercent.toFixed(2)),
    maxDrawdownPercent: parseFloat((maxDrawdown * 100).toFixed(2)),

    // Trading effectiveness
    winRate: parseFloat(winRate.toFixed(2)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    avgProfitPerTrade: parseFloat(avgProfitPerTrade.toFixed(2)),
    avgLossPerTrade: parseFloat(avgLossPerTrade.toFixed(2)),
    tradeFrequency: parseFloat(tradeFrequency.toFixed(2)),
    meanReversionScore: parseFloat(meanReversionScore.toFixed(2)),

    // Capital efficiency
    avgCapitalUtilization: parseFloat(avgCapitalUtilization.toFixed(2)),
    capitalTurnover: parseFloat(capitalTurnover.toFixed(2)),
    deployedCapital: parseFloat(deployedCapital.toFixed(2)),

    // Strategy suitability
    gridUtilization: parseFloat(gridUtilization.toFixed(2)),
    totalTrades,
    totalBuys,
    totalSells
  };

  // Calculate DCA suitability score
  const suitability = calculateDCASuitabilityScore(metrics);
  metrics.dcaSuitabilityScore = suitability.totalScore;
  metrics.suitabilityBreakdown = suitability.breakdown;
  metrics.suitabilityInterpretation = suitability.interpretation;

  return metrics;
}

/**
 * Calculate years duration between two dates
 */
function calculateYearsDuration(backtestPeriod) {
  if (!backtestPeriod || !backtestPeriod.startDate || !backtestPeriod.endDate) {
    return 1; // Default to 1 year if dates not provided
  }

  const start = new Date(backtestPeriod.startDate);
  const end = new Date(backtestPeriod.endDate);
  const diffMs = end - start;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.max(diffDays / 365.25, 0.1); // Minimum 0.1 year to avoid division by zero
}

/**
 * Calculate CAGR (Compound Annual Growth Rate)
 */
function calculateCAGR(totalReturnPercent, years) {
  if (years <= 0 || totalReturnPercent <= -100) {
    return 0;
  }

  const endValue = 100 + totalReturnPercent;
  const startValue = 100;
  const cagr = (Math.pow(endValue / startValue, 1 / years) - 1) * 100;

  return cagr;
}

/**
 * Identify top and bottom performers within a group
 */
function identifyTopBottomPerformers(stocks, topN = 5, bottomN = 5) {
  if (!stocks || stocks.length === 0) {
    return { topPerformers: [], bottomPerformers: [] };
  }

  // Sort by total return percent
  const sorted = [...stocks].sort((a, b) => {
    const aReturn = a.totalPNLPercent || 0;
    const bReturn = b.totalPNLPercent || 0;
    return bReturn - aReturn;
  });

  const topPerformers = sorted.slice(0, topN).map(s => ({
    symbol: s.symbol,
    totalReturnPercent: s.totalPNLPercent || 0,
    totalReturnDollar: s.totalPNL || 0,
    dcaSuitabilityScore: s.dcaSuitabilityScore || 0
  }));

  const bottomPerformers = sorted.slice(-bottomN).reverse().map(s => ({
    symbol: s.symbol,
    totalReturnPercent: s.totalPNLPercent || 0,
    totalReturnDollar: s.totalPNL || 0,
    dcaSuitabilityScore: s.dcaSuitabilityScore || 0
  }));

  return { topPerformers, bottomPerformers };
}

/**
 * Calculate summary statistics across all groups
 */
function calculateSummaryStatistics(allStocks, groups) {
  // Find best and worst performing groups
  const groupsWithPerformance = groups.filter(g => g.performance !== null);

  if (groupsWithPerformance.length === 0) {
    return null;
  }

  const sortedGroups = [...groupsWithPerformance].sort((a, b) =>
    b.performance.totalReturnPercent - a.performance.totalReturnPercent
  );

  const bestGroup = sortedGroups[0];
  const worstGroup = sortedGroups[sortedGroups.length - 1];

  return {
    totalStocks: allStocks.length,
    bestPerformingGroup: {
      rangeId: bestGroup.id,
      range: bestGroup.label,
      totalReturnPercent: bestGroup.performance.totalReturnPercent,
      dcaSuitabilityScore: bestGroup.performance.dcaSuitabilityScore
    },
    worstPerformingGroup: {
      rangeId: worstGroup.id,
      range: worstGroup.label,
      totalReturnPercent: worstGroup.performance.totalReturnPercent,
      dcaSuitabilityScore: worstGroup.performance.dcaSuitabilityScore
    }
  };
}

module.exports = {
  aggregateGroupMetrics,
  identifyTopBottomPerformers,
  calculateSummaryStatistics,
  calculateYearsDuration,
  calculateCAGR
};
