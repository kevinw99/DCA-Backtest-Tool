/**
 * Portfolio Metrics Service (Spec 28)
 *
 * Calculates comprehensive metrics for portfolio backtests:
 * - Portfolio-level performance (CAGR, Sharpe, max drawdown)
 * - Per-stock metrics and contributions
 * - Capital utilization analysis
 */

/**
 * Calculate complete portfolio metrics
 *
 * @param {PortfolioState} portfolio - Portfolio state object
 * @param {Object} config - Portfolio configuration
 * @param {Map} priceDataMap - Price data for all stocks (NEW)
 * @returns {Object} Complete results with all metrics
 */
function calculatePortfolioMetrics(portfolio, config, priceDataMap) {
  // Generate unique portfolio run ID
  const portfolioRunId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const portfolioSummary = calculatePortfolioSummary(portfolio, config);
  const stockResults = calculatePerStockMetrics(portfolio, config, priceDataMap);
  const capitalUtilizationTimeSeries = portfolio.valuationHistory;
  const portfolioCompositionTimeSeries = buildCompositionTimeSeries(portfolio, capitalUtilizationTimeSeries, priceDataMap);
  const capitalDeploymentTimeSeries = buildCapitalDeploymentTimeSeries(portfolio, capitalUtilizationTimeSeries);
  const rejectedOrders = portfolio.rejectedOrders;
  const capitalFlow = calculateCapitalFlow(portfolio);

  return {
    success: true,
    portfolioRunId,  // NEW
    parameters: config,  // NEW: Include parameters for URL generation
    portfolioSummary,
    stockResults,
    capitalUtilizationTimeSeries,
    portfolioCompositionTimeSeries,  // NEW
    capitalDeploymentTimeSeries,  // NEW: For deployed capital overlay
    rejectedOrders,
    capitalFlow
  };
}

/**
 * Calculate portfolio-level summary metrics
 */
function calculatePortfolioSummary(portfolio, config) {
  const totalBuys = countTotalBuys(portfolio);
  const totalSells = countTotalSells(portfolio);
  const rejectedBuysValue = sumRejectedValue(portfolio.rejectedOrders);

  // Calculate CAGR
  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);
  const years = (endDate - startDate) / (365.25 * 24 * 60 * 60 * 1000);

  const finalValue = portfolio.portfolioValue;
  const initialValue = portfolio.totalCapital;
  const cagr = years > 0 ? (Math.pow(finalValue / initialValue, 1 / years) - 1) : 0;

  // Calculate max drawdown
  const maxDrawdownMetrics = calculateMaxDrawdown(portfolio.valuationHistory, portfolio.totalCapital);

  // Calculate Sharpe and Sortino ratios
  const riskMetrics = calculateRiskMetrics(portfolio.valuationHistory, portfolio.totalCapital);

  // Calculate capital utilization stats
  const utilizationStats = calculateUtilizationStats(portfolio.valuationHistory);

  return {
    // Capital metrics
    totalCapital: portfolio.totalCapital,
    finalPortfolioValue: portfolio.portfolioValue,
    cashReserve: portfolio.cashReserve,
    deployedCapital: portfolio.deployedCapital,
    capitalUtilizationPercent: portfolio.utilizationPercent,
    avgCapitalUtilization: utilizationStats.average,
    maxCapitalUtilization: utilizationStats.max,
    minCapitalUtilization: utilizationStats.min,

    // Performance metrics
    totalReturn: portfolio.totalPNL,
    totalReturnPercent: (portfolio.totalPNL / portfolio.totalCapital) * 100,
    cagr: cagr * 100,  // Convert to percentage
    cagrPercent: cagr * 100,

    // Risk metrics
    maxDrawdown: maxDrawdownMetrics.maxDrawdown,
    maxDrawdownPercent: maxDrawdownMetrics.maxDrawdownPercent,
    maxDrawdownDuration: maxDrawdownMetrics.duration,
    sharpeRatio: riskMetrics.sharpe,
    sortinoRatio: riskMetrics.sortino,
    volatility: riskMetrics.volatility,

    // Activity metrics
    totalBuys,
    totalSells,
    totalTrades: totalBuys + totalSells,
    rejectedBuys: portfolio.rejectedOrders.length,
    rejectedBuysValue,
    rejectedBuysPercent: portfolio.rejectedOrders.length > 0
      ? (portfolio.rejectedOrders.length / (totalBuys + portfolio.rejectedOrders.length)) * 100
      : 0,

    // Efficiency metrics
    winRate: calculateWinRate(portfolio),
    avgWin: calculateAvgWin(portfolio),
    avgLoss: calculateAvgLoss(portfolio),
    profitFactor: calculateProfitFactor(portfolio)
  };
}

/**
 * Calculate per-stock metrics and contributions
 */
function calculatePerStockMetrics(portfolio, config, priceDataMap) {
  const results = [];
  const portfolioTotalPNL = portfolio.totalPNL;

  for (const [symbol, stock] of portfolio.stocks) {
    const stockTotalPNL = stock.totalPNL;
    const contributionPercent = portfolioTotalPNL !== 0
      ? (stockTotalPNL / portfolioTotalPNL) * 100
      : 0;

    const stockReturn = stock.totalPNL;
    const stockReturnPercent = stock.maxCapitalDeployed > 0
      ? (stockReturn / stock.maxCapitalDeployed) * 100
      : 0;

    // Calculate stock-specific CAGR
    const startDate = new Date(config.startDate);
    const endDate = new Date(config.endDate);
    const years = (endDate - startDate) / (365.25 * 24 * 60 * 60 * 1000);

    const firstBuy = stock.transactions.find(t => t.type.includes('BUY'));
    const stockYears = firstBuy ? (endDate - new Date(firstBuy.date)) / (365.25 * 24 * 60 * 60 * 1000) : years;

    const stockFinalValue = stock.marketValue + stock.realizedPNL;
    const stockInitialValue = stock.capitalDeployed + stock.realizedPNL;
    const stockCAGR = stockYears > 0 && stockInitialValue > 0
      ? (Math.pow(stockFinalValue / stockInitialValue, 1 / stockYears) - 1) * 100
      : 0;

    // Calculate max drawdown for stock
    const stockDrawdown = calculateStockMaxDrawdown(stock);

    // Calculate Sharpe ratio for stock
    const stockSharpe = calculateStockSharpeRatio(stock);

    // Extract price data for this stock
    const priceData = priceDataMap ? extractPriceData(priceDataMap.get(symbol), config.startDate, config.endDate) : [];

    results.push({
      symbol,
      params: stock.params,  // NEW: Include stock-specific parameters

      // Holdings
      lotsHeld: stock.lotsHeld,
      capitalDeployed: stock.capitalDeployed,
      maxCapitalDeployed: stock.maxCapitalDeployed,
      marketValue: stock.marketValue,
      averageCost: stock.averageCost,

      // P&L
      unrealizedPNL: stock.unrealizedPNL,
      realizedPNL: stock.realizedPNL,
      totalPNL: stock.totalPNL,

      // Performance
      stockReturn,
      stockReturnPercent,
      cagr: stockCAGR,
      cagrPercent: stockCAGR,
      maxDrawdown: stockDrawdown.value,
      maxDrawdownPercent: stockDrawdown.percent,
      sharpeRatio: stockSharpe,

      // Activity
      totalBuys: stock.transactions.filter(t => t.type.includes('BUY')).length,
      totalSells: stock.transactions.filter(t => t.type.includes('SELL')).length,
      rejectedBuys: stock.rejectedBuys,
      rejectedBuyValues: stock.rejectedBuyValues,

      // Portfolio contribution
      contributionToPortfolioReturn: contributionPercent,
      contributionToPortfolioValue: (stock.marketValue / portfolio.portfolioValue) * 100,

      // Transaction history
      transactions: stock.transactions,
      rejectedOrders: stock.rejectedOrders || [],  // NEW
      priceData  // NEW: OHLC data for charting
    });
  }

  // Sort by contribution descending
  return results.sort((a, b) => b.contributionToPortfolioReturn - a.contributionToPortfolioReturn);
}

/**
 * Calculate max drawdown from time series
 */
function calculateMaxDrawdown(timeSeries, initialCapital) {
  if (!timeSeries || timeSeries.length === 0) {
    return { maxDrawdown: 0, maxDrawdownPercent: 0, duration: 0 };
  }

  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let duration = 0;
  let peak = initialCapital;
  let peakDate = null;
  let drawdownStart = null;

  for (const snapshot of timeSeries) {
    const value = snapshot.portfolioValue;

    if (value > peak) {
      peak = value;
      peakDate = snapshot.date;
      drawdownStart = null;
    } else {
      const drawdown = peak - value;
      const drawdownPercent = (drawdown / peak) * 100;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;

        if (!drawdownStart) {
          drawdownStart = peakDate;
        }

        // Calculate duration in days
        if (drawdownStart) {
          const start = new Date(drawdownStart);
          const current = new Date(snapshot.date);
          duration = Math.floor((current - start) / (24 * 60 * 60 * 1000));
        }
      }
    }
  }

  return {
    maxDrawdown,
    maxDrawdownPercent,
    duration
  };
}

/**
 * Calculate risk metrics (Sharpe, Sortino, Volatility)
 */
function calculateRiskMetrics(timeSeries, initialCapital) {
  if (!timeSeries || timeSeries.length < 2) {
    return { sharpe: 0, sortino: 0, volatility: 0 };
  }

  // Calculate daily returns
  const returns = [];
  for (let i = 1; i < timeSeries.length; i++) {
    const prevValue = timeSeries[i - 1].portfolioValue;
    const currValue = timeSeries[i].portfolioValue;
    const dailyReturn = (currValue - prevValue) / prevValue;
    returns.push(dailyReturn);
  }

  // Calculate mean return
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate volatility (standard deviation)
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized

  // Calculate Sharpe ratio (assume risk-free rate = 0)
  const sharpe = volatility > 0 ? (meanReturn * 252) / volatility : 0;

  // Calculate Sortino ratio (only downside volatility)
  const negativeReturns = returns.filter(r => r < 0);
  const downsideVariance = negativeReturns.length > 0
    ? negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
    : 0;
  const downsideVol = Math.sqrt(downsideVariance) * Math.sqrt(252);
  const sortino = downsideVol > 0 ? (meanReturn * 252) / downsideVol : 0;

  return {
    sharpe,
    sortino,
    volatility: volatility * 100  // Convert to percentage
  };
}

/**
 * Calculate capital utilization statistics
 */
function calculateUtilizationStats(timeSeries) {
  if (!timeSeries || timeSeries.length === 0) {
    return { average: 0, max: 0, min: 0 };
  }

  const utilizations = timeSeries.map(s => s.utilizationPercent);

  return {
    average: utilizations.reduce((sum, u) => sum + u, 0) / utilizations.length,
    max: Math.max(...utilizations),
    min: Math.min(...utilizations)
  };
}

/**
 * Calculate stock-specific max drawdown
 */
function calculateStockMaxDrawdown(stock) {
  // Simplified version based on transactions
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let peak = 0;

  for (const transaction of stock.transactions) {
    if (transaction.type.includes('BUY')) {
      if (stock.marketValue > peak) {
        peak = stock.marketValue;
      }
    } else if (transaction.type.includes('SELL')) {
      const drawdown = peak - stock.marketValue;
      const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }
    }
  }

  return {
    value: maxDrawdown,
    percent: maxDrawdownPercent
  };
}

/**
 * Calculate stock-specific Sharpe ratio
 */
function calculateStockSharpeRatio(stock) {
  // Simplified based on realized trades
  const sells = stock.transactions.filter(t => t.type.includes('SELL'));

  if (sells.length < 2) return 0;

  const returns = sells.map(s => s.realizedPNLFromTrade);
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  return stdDev > 0 ? meanReturn / stdDev : 0;
}

/**
 * Calculate capital flow over time
 */
function calculateCapitalFlow(portfolio) {
  // Group transactions by date
  const flowByDate = new Map();

  for (const stock of portfolio.stocks.values()) {
    for (const transaction of stock.transactions) {
      if (!flowByDate.has(transaction.date)) {
        flowByDate.set(transaction.date, { buys: 0, sells: 0 });
      }

      const flow = flowByDate.get(transaction.date);

      if (transaction.type.includes('BUY')) {
        flow.buys += transaction.value;
      } else if (transaction.type.includes('SELL')) {
        flow.sells += transaction.value;
      }
    }
  }

  // Convert to array and calculate net flow
  const capitalFlow = [];
  let cumulativeCash = portfolio.totalCapital;

  for (const [date, flow] of flowByDate) {
    const netFlow = flow.sells - flow.buys;  // Positive = cash in, negative = cash out
    cumulativeCash += netFlow;

    capitalFlow.push({
      date,
      buys: flow.buys,
      sells: flow.sells,
      netFlow,
      cumulativeCash
    });
  }

  return capitalFlow.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Helper: Count total buys across all stocks
 */
function countTotalBuys(portfolio) {
  let count = 0;
  for (const stock of portfolio.stocks.values()) {
    count += stock.transactions.filter(t => t.type.includes('BUY')).length;
  }
  return count;
}

/**
 * Helper: Count total sells across all stocks
 */
function countTotalSells(portfolio) {
  let count = 0;
  for (const stock of portfolio.stocks.values()) {
    count += stock.transactions.filter(t => t.type.includes('SELL')).length;
  }
  return count;
}

/**
 * Helper: Sum rejected order values
 */
function sumRejectedValue(rejectedOrders) {
  return rejectedOrders.reduce((sum, order) => sum + order.lotSize, 0);
}

/**
 * Calculate win rate for portfolio
 */
function calculateWinRate(portfolio) {
  let wins = 0;
  let total = 0;

  for (const stock of portfolio.stocks.values()) {
    for (const transaction of stock.transactions) {
      if (transaction.type.includes('SELL')) {
        total++;
        if (transaction.realizedPNLFromTrade > 0) {
          wins++;
        }
      }
    }
  }

  return total > 0 ? (wins / total) * 100 : 0;
}

/**
 * Calculate average win
 */
function calculateAvgWin(portfolio) {
  const wins = [];

  for (const stock of portfolio.stocks.values()) {
    for (const transaction of stock.transactions) {
      if (transaction.type.includes('SELL') && transaction.realizedPNLFromTrade > 0) {
        wins.push(transaction.realizedPNLFromTrade);
      }
    }
  }

  return wins.length > 0 ? wins.reduce((sum, w) => sum + w, 0) / wins.length : 0;
}

/**
 * Calculate average loss
 */
function calculateAvgLoss(portfolio) {
  const losses = [];

  for (const stock of portfolio.stocks.values()) {
    for (const transaction of stock.transactions) {
      if (transaction.type.includes('SELL') && transaction.realizedPNLFromTrade < 0) {
        losses.push(Math.abs(transaction.realizedPNLFromTrade));
      }
    }
  }

  return losses.length > 0 ? losses.reduce((sum, l) => sum + l, 0) / losses.length : 0;
}

/**
 * Calculate profit factor
 */
function calculateProfitFactor(portfolio) {
  let totalWins = 0;
  let totalLosses = 0;

  for (const stock of portfolio.stocks.values()) {
    for (const transaction of stock.transactions) {
      if (transaction.type.includes('SELL')) {
        if (transaction.realizedPNLFromTrade > 0) {
          totalWins += transaction.realizedPNLFromTrade;
        } else {
          totalLosses += Math.abs(transaction.realizedPNLFromTrade);
        }
      }
    }
  }

  return totalLosses > 0 ? totalWins / totalLosses : 0;
}

/**
 * Extract price data from priceDataMap
 */
function extractPriceData(dateMap, startDate, endDate) {
  if (!dateMap) return [];

  const priceData = [];
  for (const [date, data] of dateMap) {
    if (date >= startDate && date <= endDate) {
      priceData.push({
        date,
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close
      });
    }
  }

  return priceData.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Build portfolio composition time series
 * Calculates market value for each stock at each date in the time series
 */
function buildCompositionTimeSeries(portfolio, capitalUtilizationTimeSeries, priceDataMap) {
  const compositionSeries = [];

  for (const snapshot of capitalUtilizationTimeSeries) {
    const composition = {
      date: snapshot.date,
      cash: snapshot.cashReserve,
      total: snapshot.portfolioValue
    };

    // Calculate each stock's market value at this specific date
    for (const [symbol, stock] of portfolio.stocks) {
      // Get price data for this stock (Map of date -> price data)
      const stockDateMap = priceDataMap.get(symbol);

      if (!stockDateMap) {
        composition[symbol] = 0;
        continue;
      }

      // Reconstruct lots at this date by replaying BUY/SELL transactions
      const transactionsUpToDate = stock.transactions.filter(tx => tx.date <= snapshot.date);

      if (transactionsUpToDate.length === 0) {
        composition[symbol] = 0;
        continue;
      }

      // Replay transactions to reconstruct lots held at this specific date
      let lotsHeld = [];
      for (const tx of transactionsUpToDate) {
        if (tx.type.includes('BUY')) {
          // Add lot to holdings
          lotsHeld.push({ price: tx.price, shares: tx.shares, date: tx.date });
        } else if (tx.type.includes('SELL') && tx.lotsDetails && Array.isArray(tx.lotsDetails)) {
          // Remove sold lots
          for (const soldLot of tx.lotsDetails) {
            const index = lotsHeld.findIndex(l =>
              Math.abs(l.price - soldLot.price) < 0.01 &&
              l.date === soldLot.date
            );
            if (index !== -1) {
              lotsHeld.splice(index, 1);
            }
          }
        }
      }

      if (lotsHeld.length === 0) {
        composition[symbol] = 0;
        continue;
      }

      // Find the price at this date, or use the most recent price before this date
      let priceAtDate = stockDateMap.get(snapshot.date);

      // If price not found for this exact date (weekend/holiday), find the most recent price
      if (!priceAtDate) {
        // Get all dates from the price map and sort them
        const availableDates = Array.from(stockDateMap.keys()).sort();

        // Find the most recent date that's before or equal to snapshot.date
        let mostRecentDate = null;
        for (const date of availableDates) {
          if (date <= snapshot.date) {
            mostRecentDate = date;
          } else {
            break;  // Dates are sorted, so we can stop
          }
        }

        if (mostRecentDate) {
          priceAtDate = stockDateMap.get(mostRecentDate);
        }
      }

      // If still no price found, set to 0 (this shouldn't happen in normal cases)
      if (!priceAtDate) {
        composition[symbol] = 0;
        continue;
      }

      const currentPrice = parseFloat(priceAtDate.close || 0);

      // Calculate market value: sum of (lot.shares * current price)
      let marketValue = 0;
      for (const lot of lotsHeld) {
        marketValue += lot.shares * currentPrice;
      }

      composition[symbol] = marketValue;
    }

    compositionSeries.push(composition);
  }

  return compositionSeries;
}

/**
 * Build capital deployment time series - tracks deployed capital (cost basis) over time
 * Similar to composition series but shows actual capital deployed, not market value
 */
function buildCapitalDeploymentTimeSeries(portfolio, capitalUtilizationTimeSeries) {
  const deploymentSeries = [];

  for (const snapshot of capitalUtilizationTimeSeries) {
    const deployment = {
      date: snapshot.date
    };

    // Calculate each stock's deployed capital at this specific date
    for (const [symbol, stock] of portfolio.stocks) {
      // Replay transactions up to this date to calculate deployed capital
      const transactionsUpToDate = stock.transactions.filter(tx => tx.date <= snapshot.date);

      let deployedCapital = 0;
      for (const tx of transactionsUpToDate) {
        if (tx.type.includes('BUY')) {
          deployedCapital += tx.value;
        } else if (tx.type.includes('SELL') && tx.lotsCost) {
          deployedCapital -= tx.lotsCost;
        }
      }

      deployment[symbol] = deployedCapital;
    }

    deploymentSeries.push(deployment);
  }

  return deploymentSeries;
}

module.exports = {
  calculatePortfolioMetrics,
  calculatePortfolioSummary,
  calculatePerStockMetrics,
  buildCapitalDeploymentTimeSeries
};
