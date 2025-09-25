const database = require('../database');

/**
 * Core DCA Backtesting Service
 * This service contains the shared algorithm that can be used by both:
 * 1. Server API endpoints (with dynamic parameters)
 * 2. Command line execution (with static parameters)
 */

// --- Utility Functions ---
function calculateMetrics(dailyValues, capitalDeployed, transactionLog, prices) {
  const returns = [];
  const portfolioValues = [];
  let peakValue = 0;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  for (let i = 0; i < dailyValues.length; i++) {
    portfolioValues.push(dailyValues[i]);

    if (i > 0) {
      const dailyReturn = (dailyValues[i] - dailyValues[i-1]) / dailyValues[i-1];
      returns.push(dailyReturn);
    }

    if (dailyValues[i] > peakValue) {
      peakValue = dailyValues[i];
    }

    const drawdown = peakValue - dailyValues[i];
    const drawdownPercent = peakValue > 0 ? (drawdown / peakValue) * 100 : 0;

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
    if (drawdownPercent > maxDrawdownPercent) {
      maxDrawdownPercent = drawdownPercent;
    }
  }

  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const returnStdDev = returns.length > 1 ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)) : 0;
  const sharpeRatio = returnStdDev > 0 ? (avgReturn * 252) / (returnStdDev * Math.sqrt(252)) : 0;

  const transactions = transactionLog.filter(log => log.includes('ACTION: SELL'));
  const winningTrades = transactions.filter(log => {
    const pnlMatch = log.match(/PNL: ([-\d.]+)/);
    return pnlMatch && parseFloat(pnlMatch[1]) > 0;
  });
  const winRate = transactions.length > 0 ? (winningTrades.length / transactions.length) * 100 : 0;

  const totalCapitalDeployed = Math.max(...capitalDeployed, 0);
  const avgCapitalDeployed = capitalDeployed.reduce((a, b) => a + b, 0) / capitalDeployed.length;
  const finalValue = portfolioValues[portfolioValues.length - 1];
  const initialValue = portfolioValues[0];
  const totalReturn = finalValue - initialValue;

  const combinedWeightedReturn = totalCapitalDeployed > 0 ?
    (totalReturn / avgCapitalDeployed) * (avgCapitalDeployed / totalCapitalDeployed) * 100 : 0;

  // Calculate DCA annualized return
  const totalReturnDecimal = initialValue > 0 ? (finalValue - initialValue) / initialValue : 0;
  const totalDays = portfolioValues.length;
  const dcaAnnualizedReturn = totalDays > 0 ?
    Math.pow(1 + totalReturnDecimal, 365 / totalDays) - 1 : 0;
  const dcaAnnualizedReturnPercent = dcaAnnualizedReturn * 100;

  return {
    totalReturn: finalValue - initialValue,
    totalReturnPercent: initialValue > 0 ? ((finalValue - initialValue) / initialValue) * 100 : 0,
    annualizedReturn: dcaAnnualizedReturn,
    annualizedReturnPercent: dcaAnnualizedReturnPercent,
    maxDrawdown: maxDrawdown,
    maxDrawdownPercent: maxDrawdownPercent,
    sharpeRatio: sharpeRatio,
    winRate: winRate,
    totalTrades: transactions.length,
    avgCapitalDeployed: avgCapitalDeployed,
    maxCapitalDeployed: totalCapitalDeployed,
    combinedWeightedReturn: combinedWeightedReturn,
    volatility: returnStdDev * Math.sqrt(252) * 100
  };
}

// Calculate annualized return for individual trades and current holdings
function calculateTradeAnnualizedReturns(enhancedTransactions, startDate, endDate, currentHoldings, finalPrice) {
  const tradeReturns = [];
  const holdingReturns = [];
  const buyTransactions = enhancedTransactions.filter(t => t.type === 'TRAILING_STOP_LIMIT_BUY');
  const sellTransactions = enhancedTransactions.filter(t => t.type === 'SELL');

  // Calculate total backtest period in days (for current holdings only)
  const totalBacktestDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));

  // Calculate annualized returns for completed trades
  for (const sellTx of sellTransactions) {
    if (sellTx.realizedPNLFromTrade && sellTx.lotsDetails) {
      for (const lotSold of sellTx.lotsDetails) {
        // Find the corresponding buy transaction for this lot
        const buyTx = buyTransactions.find(buy =>
          buy.price === lotSold.price && buy.date <= sellTx.date
        );

        if (buyTx) {
          const investment = lotSold.price * lotSold.shares;
          const returns = (sellTx.price - lotSold.price) * lotSold.shares;
          const totalReturn = investment + returns;
          const returnPercent = investment > 0 ? returns / investment : 0;

          // Calculate actual days held for this specific trade
          const actualDaysHeld = Math.max(1, Math.ceil((new Date(sellTx.date) - new Date(buyTx.date)) / (1000 * 60 * 60 * 24)));

          // Calculate annualized return: (1 + total return) ^ (365 / actual days held) - 1
          const annualizedReturn = Math.pow(1 + returnPercent, 365 / actualDaysHeld) - 1;

          tradeReturns.push({
            type: 'COMPLETED_TRADE',
            buyDate: buyTx.date,
            sellDate: sellTx.date,
            buyPrice: lotSold.price,
            sellPrice: sellTx.price,
            shares: lotSold.shares,
            investment: investment,
            returns: returns,
            returnPercent: returnPercent * 100,
            annualizedReturn: annualizedReturn,
            annualizedReturnPercent: annualizedReturn * 100,
            actualDaysHeld: actualDaysHeld
          });
        }
      }
    }
  }

  // Calculate annualized returns for current holdings (open positions)
  if (currentHoldings && currentHoldings.length > 0 && finalPrice > 0) {
    for (const holding of currentHoldings) {
      const investment = holding.price * holding.shares;
      const currentValue = finalPrice * holding.shares;
      const returns = currentValue - investment;
      const returnPercent = investment > 0 ? returns / investment : 0;

      // Calculate actual days held for this specific holding
      const actualDaysHeld = Math.max(1, Math.ceil((new Date(endDate) - new Date(holding.date)) / (1000 * 60 * 60 * 24)));

      // For negative returns, use: (1 - abs(total_return)) ^ (365 / days) - 1
      // For positive returns, use: (1 + total_return) ^ (365 / days) - 1
      let annualizedReturn;
      if (returnPercent < 0) {
        annualizedReturn = Math.pow(1 - Math.abs(returnPercent), 365 / actualDaysHeld) - 1;
      } else {
        annualizedReturn = Math.pow(1 + returnPercent, 365 / actualDaysHeld) - 1;
      }

      holdingReturns.push({
        type: 'CURRENT_HOLDING',
        buyDate: holding.date,
        sellDate: endDate, // Theoretical sell date for annualized calculation
        buyPrice: holding.price,
        sellPrice: finalPrice, // Current market price
        shares: holding.shares,
        investment: investment,
        returns: returns,
        returnPercent: returnPercent * 100,
        annualizedReturn: annualizedReturn,
        annualizedReturnPercent: annualizedReturn * 100,
        actualDaysHeld: actualDaysHeld
      });
    }
  }

  // Combine all returns for overall average
  const allReturns = [...tradeReturns, ...holdingReturns];
  const avgAnnualizedReturn = allReturns.length > 0 ?
    allReturns.reduce((sum, trade) => sum + trade.annualizedReturn, 0) / allReturns.length : 0;
  const avgAnnualizedReturnPercent = avgAnnualizedReturn * 100;

  // Separate averages for completed trades and holdings
  const tradeOnlyAvg = tradeReturns.length > 0 ?
    tradeReturns.reduce((sum, trade) => sum + trade.annualizedReturn, 0) / tradeReturns.length : 0;
  const holdingOnlyAvg = holdingReturns.length > 0 ?
    holdingReturns.reduce((sum, holding) => sum + holding.annualizedReturn, 0) / holdingReturns.length : 0;

  return {
    individualTradeReturns: tradeReturns,
    currentHoldingReturns: holdingReturns,
    allReturns: allReturns,
    averageAnnualizedReturn: avgAnnualizedReturn,
    averageAnnualizedReturnPercent: avgAnnualizedReturnPercent,
    tradeOnlyAverageAnnualizedReturnPercent: tradeOnlyAvg * 100,
    holdingOnlyAverageAnnualizedReturnPercent: holdingOnlyAvg * 100
  };
}

function calculatePortfolioDrawdown(portfolioValues) {
  if (portfolioValues.length === 0) return { maxDrawdown: 0, maxDrawdownPercent: 0 };

  let maxValue = Math.max(0, portfolioValues[0]);
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  for (const value of portfolioValues) {
    if (value > maxValue && value > 0) {
      maxValue = value;
    }

    if (maxValue > 0) {
      const drawdown = Math.max(0, maxValue - value);
      const drawdownPercent = (drawdown / maxValue) * 100;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
      if (drawdownPercent > maxDrawdownPercent) {
        maxDrawdownPercent = drawdownPercent;
      }
    }
  }

  return { maxDrawdown, maxDrawdownPercent };
}

function assessMarketCondition(indicators) {
  if (!indicators.ma_200 || !indicators.ma_50) {
    return { regime: 'neutral', isHighVolatility: false, weeklyTrend: 'neutral', volatility: null };
  }

  const currentPrice = indicators.adjusted_close;
  let marketRegime = 'neutral';

  if (currentPrice > indicators.ma_200 && indicators.ma_50 > indicators.ma_200) {
    marketRegime = 'bull';
  } else if (currentPrice < indicators.ma_200 && indicators.ma_50 < indicators.ma_200) {
    marketRegime = 'bear';
  }

  const isHighVolatility = indicators.volatility_20 && indicators.volatility_20 > 0.40;

  return {
    regime: marketRegime,
    isHighVolatility: isHighVolatility,
    weeklyTrend: indicators.weekly_trend || 'neutral',
    volatility: indicators.volatility_20
  };
}

function calculateBuyAndHold(prices, initialCapital) {
  const startPrice = prices[0].adjusted_close;
  const endPrice = prices[prices.length - 1].adjusted_close;
  const shares = initialCapital / startPrice;
  const finalValue = shares * endPrice;
  const totalReturn = finalValue - initialCapital;
  const totalReturnPercent = (totalReturn / initialCapital) * 100;

  // Calculate annualized return: (1 + total return) ^ (365 / days) - 1
  const totalDays = prices.length;
  const annualizedReturn = totalDays > 0 ?
    Math.pow(1 + (totalReturnPercent / 100), 365 / totalDays) - 1 : 0;
  const annualizedReturnPercent = annualizedReturn * 100;

  let peakValue = initialCapital;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  const dailyValues = [];

  for (const price of prices) {
    const currentValue = shares * price.adjusted_close;
    dailyValues.push(currentValue);

    if (currentValue > peakValue) {
      peakValue = currentValue;
    }

    const drawdown = peakValue - currentValue;
    const drawdownPercent = (drawdown / peakValue) * 100;

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
    if (drawdownPercent > maxDrawdownPercent) {
      maxDrawdownPercent = drawdownPercent;
    }
  }

  const returns = [];
  for (let i = 1; i < dailyValues.length; i++) {
    returns.push((dailyValues[i] - dailyValues[i-1]) / dailyValues[i-1]);
  }
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const volatility = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)) * Math.sqrt(252) * 100;
  const sharpeRatio = volatility > 0 ? (avgReturn * 252) / (volatility / 100) : 0;

  return {
    totalReturn: totalReturn,
    totalReturnPercent: totalReturnPercent,
    annualizedReturn: annualizedReturn,
    annualizedReturnPercent: annualizedReturnPercent,
    maxDrawdown: maxDrawdown,
    maxDrawdownPercent: maxDrawdownPercent,
    sharpeRatio: sharpeRatio,
    volatility: volatility,
    finalValue: finalValue,
    shares: shares
  };
}

/**
 * Core DCA Backtest Algorithm
 * @param {Object} params - Backtest parameters
 * @param {string} params.symbol - Stock symbol
 * @param {string} params.startDate - Start date (YYYY-MM-DD)
 * @param {string} params.endDate - End date (YYYY-MM-DD)
 * @param {number} params.lotSizeUsd - Amount per lot in USD
 * @param {number} params.maxLots - Maximum number of lots
 * @param {number} params.gridIntervalPercent - Grid interval as decimal (0.10 for 10%)
 * @param {number} params.remainingLotsLossTolerance - Loss tolerance as decimal (0.05 for 5%)
 * @param {boolean} params.verbose - Whether to log detailed output (default: true)
 * @returns {Promise<Object>} Backtest results
 */
async function runDCABacktest(params) {
  const {
    symbol,
    startDate,
    endDate,
    lotSizeUsd,
    maxLots,
    maxLotsToSell = 1, // Default to 1 lot for backward compatibility
    gridIntervalPercent,
    remainingLotsLossTolerance,
    remainingLotsUnrealizedLossTolerance = -0.5, // Default -50% loss tolerance for remaining lots
    verbose = true
  } = params;

  if (verbose) {
    console.log(`🎯 Starting DCA backtest for ${symbol}...`);
    console.log(`📊 Parameters: ${lotSizeUsd} USD/lot, ${maxLots} max lots, ${(gridIntervalPercent*100).toFixed(1)}% grid`);
  }

  try {
    // 1. Get Stock ID
    const stock = await database.getStock(symbol);
    if (!stock) {
      throw new Error(`Stock symbol ${symbol} not found in the database.`);
    }

    // 2. Get Combined Price and Technical Indicator Data
    const pricesWithIndicators = await database.getPricesWithIndicators(stock.id, startDate, endDate);
    if (pricesWithIndicators.length === 0) {
      throw new Error(`No price/indicator data found for ${symbol} between ${startDate} and ${endDate}.`);
    }

    if (verbose) {
      console.log(`📈 Fetched ${pricesWithIndicators.length} records with technical indicators.`);
    }

    // --- Core Backtesting Algorithm ---
    let lots = [];
    let realizedPNL = 0;
    let averageCost = 0;
    let initialPrice = pricesWithIndicators[0].adjusted_close;
    let trailingAmount = initialPrice * 0.10;
    let transactionLog = [];
    let activeStop = null;
    let dailyPortfolioValues = [];
    let dailyCapitalDeployed = [];

    // Recent Peak/Bottom Tracking System (simplified approach)
    let recentPeak = null;  // Highest price since last transaction
    let recentBottom = null; // Lowest price since last transaction
    let trailingStopBuy = null; // Active trailing stop buy order
    let lastTransactionDate = null; // Track when peak/bottom tracking started

    const recalculateAverageCost = () => {
      if (lots.length > 0) {
        const totalCost = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
        const totalShares = lots.reduce((sum, lot) => sum + lot.shares, 0);
        return totalCost / totalShares;
      }
      return 0;
    };

    const getLotsPrices = (lotArray) => `[${lotArray.map(l => l.price.toFixed(2)).join(', ')}]`;

    // Color codes for terminal output
    const colors = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      reset: '\x1b[0m',
      bright: '\x1b[1m'
    };

    const colorize = (text, color) => `${colors[color]}${text}${colors.reset}`;

    // Reset peak/bottom tracking after any transaction
    const resetPeakBottomTracking = (currentPrice, currentDate) => {
      recentPeak = currentPrice;
      recentBottom = currentPrice;
      lastTransactionDate = currentDate;
      transactionLog.push(colorize(`  ACTION: Reset peak/bottom tracking - Peak: ${currentPrice.toFixed(2)}, Bottom: ${currentPrice.toFixed(2)}`, 'cyan'));
    };

    // Update recent peak and bottom tracking
    const updatePeakBottomTracking = (currentPrice) => {
      if (recentPeak === null || currentPrice > recentPeak) {
        recentPeak = currentPrice;
      }
      if (recentBottom === null || currentPrice < recentBottom) {
        recentBottom = currentPrice;
      }
    };

    // Check if trailing stop buy should be activated
    const checkTrailingStopBuyActivation = (currentPrice, currentDate) => {
      if (!trailingStopBuy && recentPeak && currentPrice <= recentPeak * 0.9) {
        // Price dropped 10% from recent peak - activate trailing stop buy
        trailingStopBuy = {
          stopPrice: currentPrice * 1.05, // 5% above current price
          triggeredAt: currentPrice,
          activatedDate: currentDate,
          recentPeakReference: recentPeak,
          lastUpdatePrice: currentPrice  // Track the actual bottom price (price when order was last updated)
        };
        transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY ACTIVATED - Stop: ${trailingStopBuy.stopPrice.toFixed(2)}, Triggered by 10% drop from peak ${recentPeak.toFixed(2)}`, 'blue'));
      }
    };

    // Update trailing stop buy (move stop down if price goes down further)
    const updateTrailingStopBuy = (currentPrice) => {
      if (trailingStopBuy) {
        const newStopPrice = currentPrice * 1.05; // Always 5% above current price
        if (newStopPrice < trailingStopBuy.stopPrice) {
          const oldStopPrice = trailingStopBuy.stopPrice;
          trailingStopBuy.stopPrice = newStopPrice;
          trailingStopBuy.lastUpdatePrice = currentPrice;  // Update the actual bottom price
          transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY UPDATED from ${oldStopPrice.toFixed(2)} to ${newStopPrice.toFixed(2)} (Price: ${currentPrice.toFixed(2)})`, 'blue'));
        }
      }
    };

    // Cancel trailing stop buy if price exceeds the peak (limit price)
    const cancelTrailingStopBuyIfAbovePeak = (currentPrice) => {
      if (trailingStopBuy && currentPrice > trailingStopBuy.recentPeakReference) {
        transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY CANCELLED - Price ${currentPrice.toFixed(2)} > limit price ${trailingStopBuy.recentPeakReference.toFixed(2)} (peak)`, 'yellow'));
        trailingStopBuy = null;
        return true;
      }
      return false;
    };

    // Check if trailing stop buy should execute
    const checkTrailingStopBuyExecution = (currentPrice, currentDate) => {
      if (trailingStopBuy && currentPrice >= trailingStopBuy.stopPrice) {
        // Check if price is still within limit (below peak)
        if (currentPrice <= trailingStopBuy.recentPeakReference) {
          // Trailing stop buy triggered - check if we can execute
          if (lots.length < maxLots) {
            const respectsGridSpacing = lots.every(lot => Math.abs(currentPrice - lot.price) / lot.price >= gridIntervalPercent);
            if (respectsGridSpacing) {
            // Execute the trailing stop buy
            const shares = lotSizeUsd / currentPrice;
            lots.push({ price: currentPrice, shares: shares, date: currentDate });
            averageCost = recalculateAverageCost();

            // Calculate P&L values after trailing stop buy
            const totalSharesHeldAfterBuy = lots.reduce((sum, lot) => sum + lot.shares, 0);
            const totalCostOfHeldLotsAfterBuy = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
            const unrealizedPNLAfterBuy = (totalSharesHeldAfterBuy * currentPrice) - totalCostOfHeldLotsAfterBuy;
            const totalPNLAfterBuy = realizedPNL + unrealizedPNLAfterBuy;

            // Record enhanced transaction
            enhancedTransactions.push({
              date: currentDate,
              type: 'TRAILING_STOP_LIMIT_BUY',
              price: currentPrice,
              shares: shares,
              value: lotSizeUsd,
              lotsDetails: null,
              lotsAfterTransaction: [...lots],
              averageCost: averageCost,
              unrealizedPNL: unrealizedPNLAfterBuy,
              realizedPNL: realizedPNL,
              totalPNL: totalPNLAfterBuy,
              realizedPNLFromTrade: 0,
              ocoOrderDetail: null,
              trailingStopDetail: {
                triggered: true,
                stopPrice: trailingStopBuy.stopPrice,
                limitPrice: trailingStopBuy.recentPeakReference, // Peak price is the limit price
                recentPeakReference: trailingStopBuy.recentPeakReference,
                activatedAt: trailingStopBuy.triggeredAt,
                priceWhenOrderSet: trailingStopBuy.triggeredAt, // Price when trailing stop was triggered
                lastUpdatePrice: trailingStopBuy.lastUpdatePrice, // Actual bottom price when order was last updated
                executionPrice: currentPrice
              }
            });

            transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY EXECUTED at ${currentPrice.toFixed(2)} (stop: ${trailingStopBuy.stopPrice.toFixed(2)}). Lots: ${getLotsPrices(lots)}, New Avg Cost: ${averageCost.toFixed(2)}`, 'green'));

            // Clear trailing stop buy and reset peak/bottom tracking
            trailingStopBuy = null;
            resetPeakBottomTracking(currentPrice, currentDate);

              return true; // Transaction occurred
            } else {
              transactionLog.push(colorize(`  INFO: TRAILING STOP BUY blocked at ${currentPrice.toFixed(2)} - violates grid spacing rule`, 'yellow'));
            }
          } else {
            transactionLog.push(colorize(`  INFO: TRAILING STOP BUY blocked at ${currentPrice.toFixed(2)} - max lots reached`, 'yellow'));
          }
        } else {
          // Price exceeded limit price - order should have been cancelled already
          transactionLog.push(colorize(`  ACTION: TRAILING STOP BUY CANCELLED - Price ${currentPrice.toFixed(2)} > limit price ${trailingStopBuy.recentPeakReference.toFixed(2)} (peak)`, 'yellow'));
          trailingStopBuy = null;
        }
      }
      return false; // No transaction
    };

    // Check if trailing stop sell should be activated (when price rises 20% from recent bottom)
    const checkTrailingStopSellActivation = (currentPrice) => {
      if (lots.length > 0 && currentPrice > averageCost && !activeStop && recentBottom && currentPrice >= recentBottom * 1.2) {
        // Price rose 20% from recent bottom - activate trailing stop sell
        // Calculate current unrealized P&L
        const totalSharesHeld = lots.reduce((sum, lot) => sum + lot.shares, 0);
        const totalCostOfHeldLots = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
        const unrealizedPNL = (totalSharesHeld * currentPrice) - totalCostOfHeldLots;

        // Only set trailing stop if unrealized P&L > 0
        if (unrealizedPNL > 0) {
          // Find the highest-priced lot that is eligible for selling
          // Eligible lots are those with price < stop price * (1 - loss_tolerance)
          const stopPrice = currentPrice * 0.90;
          const maxEligiblePrice = stopPrice * (1 - remainingLotsLossTolerance);

          transactionLog.push(colorize(`DEBUG LOT SELECTION: currentPrice=${currentPrice.toFixed(2)}, stopPrice=${stopPrice.toFixed(2)}, remainingLotsLossTolerance=${remainingLotsLossTolerance}, maxEligiblePrice=${maxEligiblePrice.toFixed(2)}`, 'cyan'));
          transactionLog.push(colorize(`DEBUG ALL LOTS: ${lots.map(lot => `$${lot.price.toFixed(2)}`).join(', ')}`, 'cyan'));

          const eligibleLots = lots.filter(lot => lot.price < maxEligiblePrice);

          transactionLog.push(colorize(`DEBUG ELIGIBLE LOTS: ${eligibleLots.map(lot => `$${lot.price.toFixed(2)}`).join(', ')} (${eligibleLots.length} eligible)`, 'cyan'));

          if (eligibleLots.length > 0) {
            const sortedEligibleLots = eligibleLots.sort((a, b) => b.price - a.price);
            const lotToSell = sortedEligibleLots[0]; // Select highest-priced eligible lot

            transactionLog.push(colorize(`DEBUG SELECTED LOT: $${lotToSell.price.toFixed(2)} (highest among eligible)`, 'cyan'));

            // New pricing logic based on requirements:
            // Stop Price: current price * 0.90 (10% below current price)
            // Limit Price: the targeted lot price
            const stopPrice = currentPrice * 0.90;
            const limitPrice = lotToSell.price;

            activeStop = {
              stopPrice: stopPrice,
              limitPrice: limitPrice,
              lotsToSell: [lotToSell],
              highestPrice: currentPrice,  // Track highest price for trailing
              recentBottomReference: recentBottom,
              triggerCondition: 'recent_bottom_10pct_rise',
              priceWhenOrderSet: currentPrice,  // Track the price when the trailing stop was first set
              lastUpdatePrice: currentPrice  // Track the actual peak price when order was last updated
            };
            transactionLog.push(colorize(`  ACTION: TRAILING STOP SELL ACTIVATED - Stop: ${stopPrice.toFixed(2)}, Limit: ${limitPrice.toFixed(2)}, Triggered by 20% rise from bottom ${recentBottom.toFixed(2)} (Unrealized P&L: ${unrealizedPNL.toFixed(2)})`, 'yellow'));
          }
        }
      }
    };

    // Update trailing stop when price moves higher (maintains 10% below current price)
    const updateTrailingStop = (currentPrice) => {
      if (activeStop && currentPrice > activeStop.highestPrice) {
        // Keep stop price at current price * 0.90 (10% below current price per new requirements)
        const newStopPrice = currentPrice * 0.90;

        if (newStopPrice > activeStop.stopPrice) {
          const oldStopPrice = activeStop.stopPrice;
          const oldLimitPrice = activeStop.limitPrice;

          // Recalculate lot selection with new stop price
          const maxEligiblePrice = newStopPrice * (1 - remainingLotsLossTolerance);
          const eligibleLots = lots.filter(lot => lot.price < maxEligiblePrice);

          if (eligibleLots.length > 0) {
            const sortedEligibleLots = eligibleLots.sort((a, b) => b.price - a.price);
            const newLotToSell = sortedEligibleLots[0]; // Select highest-priced eligible lot

            activeStop.stopPrice = newStopPrice;
            activeStop.limitPrice = newLotToSell.price;
            activeStop.lotsToSell = [newLotToSell];
            activeStop.highestPrice = currentPrice;
            activeStop.lastUpdatePrice = currentPrice;

            transactionLog.push(colorize(`  ACTION: TRAILING STOP SELL UPDATED from stop ${oldStopPrice.toFixed(2)} to ${newStopPrice.toFixed(2)}, limit ${oldLimitPrice.toFixed(2)} to ${newLotToSell.price.toFixed(2)} (High: ${currentPrice.toFixed(2)})`, 'cyan'));
            transactionLog.push(colorize(`  DEBUG: Updated eligible lots: ${eligibleLots.map(lot => `$${lot.price.toFixed(2)}`).join(', ')}, selected: $${newLotToSell.price.toFixed(2)}`, 'cyan'));
          } else {
            // No eligible lots, cancel the stop
            activeStop = null;
            transactionLog.push(colorize(`  ACTION: TRAILING STOP CANCELLED - No eligible lots at price ${currentPrice.toFixed(2)} with maxEligiblePrice ${maxEligiblePrice.toFixed(2)}`, 'yellow'));
          }
        }
      }
    };

    // Cancel trailing stop if price falls below average cost (no longer profitable)
    const cancelTrailingStopIfUnprofitable = (currentPrice) => {
      if (activeStop && currentPrice <= averageCost) {
        const cancelledStopPrice = activeStop.stopPrice;
        activeStop = null;
        transactionLog.push(colorize(`  ACTION: TRAILING STOP CANCELLED - Price ${currentPrice.toFixed(2)} <= average cost ${averageCost.toFixed(2)} (stop was ${cancelledStopPrice.toFixed(2)})`, 'yellow'));
      }
    };


    // Enhanced transaction records for UI
    let enhancedTransactions = [];

    // Main loop through each day's data
    for (let i = 0; i < pricesWithIndicators.length; i++) {
      const dayData = pricesWithIndicators[i];
      const currentPrice = dayData.adjusted_close;
      const holdingsAtStartOfDay = [...lots];
      averageCost = recalculateAverageCost();

      const marketCondition = assessMarketCondition(dayData);

      // Daily PNL Calculation
      const totalSharesHeld = holdingsAtStartOfDay.reduce((sum, lot) => sum + lot.shares, 0);
      const totalCostOfHeldLots = holdingsAtStartOfDay.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
      const unrealizedPNL = (totalSharesHeld * currentPrice) - totalCostOfHeldLots;
      const totalPNL = realizedPNL + unrealizedPNL;

      // Portfolio tracking
      const currentPortfolioValue = totalCostOfHeldLots + realizedPNL + unrealizedPNL;

      dailyPortfolioValues.push(currentPortfolioValue);
      dailyCapitalDeployed.push(totalCostOfHeldLots);

      // Remaining lots loss tolerance check
      const remainingLotsLossPercent = lots.length > 0 ? unrealizedPNL / totalCostOfHeldLots : 0;
      const remainingLotsAtRisk = lots.length > 0 && remainingLotsLossPercent < remainingLotsUnrealizedLossTolerance;

      const pad = (str, len) => String(str).padEnd(len);
      let actionsOccurred = false;
      const dayStartLogLength = transactionLog.length;

      // Initialize peak/bottom tracking on first day if not started
      if (recentPeak === null || recentBottom === null) {
        recentPeak = currentPrice;
        recentBottom = currentPrice;
        lastTransactionDate = dayData.date;
      }

      // Update recent peak and bottom tracking
      updatePeakBottomTracking(currentPrice);

      // Check if trailing stop sell should be activated (price rises 10% from recent bottom)
      checkTrailingStopSellActivation(currentPrice);

      // Update trailing stop if price has moved higher
      updateTrailingStop(currentPrice);

      // Cancel trailing stop if price falls below average cost (no longer profitable)
      cancelTrailingStopIfUnprofitable(currentPrice);

      // HIGHEST PRIORITY: Execute trailing stop sells first
      if (activeStop && currentPrice <= activeStop.stopPrice) {
        const { stopPrice, limitPrice, lotsToSell } = activeStop;

        // Always use current price as execution price
        const executionPrice = currentPrice;

        // Execute only if execution price > limit price AND execution price > average cost (to ensure profitable sell)
        if (executionPrice > limitPrice && executionPrice > averageCost) {
          let totalSaleValue = 0;
          let costOfSoldLots = 0;

          lotsToSell.forEach(soldLot => {
            totalSaleValue += soldLot.shares * executionPrice;
            costOfSoldLots += soldLot.shares * soldLot.price;
          });

          const pnl = totalSaleValue - costOfSoldLots;
          realizedPNL += pnl;

          // Calculate unrealized P&L before removing sold lots
          const totalSharesHeldBeforeSell = lots.reduce((sum, lot) => sum + lot.shares, 0);
          const totalCostOfHeldLotsBeforeSell = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
          const unrealizedPNLBeforeSell = (totalSharesHeldBeforeSell * currentPrice) - totalCostOfHeldLotsBeforeSell;

          lots = lots.filter(l => !lotsToSell.find(sl => sl.price === l.price && sl.shares === l.shares));
          averageCost = recalculateAverageCost();

          // Calculate values after sell
          const totalSharesHeldAfterSell = lots.reduce((sum, lot) => sum + lot.shares, 0);
          const totalCostOfHeldLotsAfterSell = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
          const unrealizedPNLAfterSell = (totalSharesHeldAfterSell * currentPrice) - totalCostOfHeldLotsAfterSell;
          const totalPNLAfterSell = realizedPNL + unrealizedPNLAfterSell;

          // Calculate annualized return for this trade based on actual holding period
          // Find the buy date for the lots being sold (use the lot with the target price)
          const soldLotPrice = activeStop.limitPrice; // This is the price of the lot being sold
          const buyTransaction = enhancedTransactions.find(t =>
            t.type === 'TRAILING_STOP_LIMIT_BUY' && Math.abs(t.price - soldLotPrice) < 0.01
          );

          let actualDaysHeld = 1; // Default to 1 day if we can't find the buy date
          if (buyTransaction) {
            actualDaysHeld = Math.ceil((new Date(dayData.date) - new Date(buyTransaction.date)) / (1000 * 60 * 60 * 24));
            actualDaysHeld = Math.max(1, actualDaysHeld); // Ensure at least 1 day
          }

          const totalReturnPercent = costOfSoldLots > 0 ? pnl / costOfSoldLots : 0;
          const annualizedReturn = actualDaysHeld > 0 ?
            Math.pow(1 + totalReturnPercent, 365 / actualDaysHeld) - 1 : 0;
          const annualizedReturnPercent = annualizedReturn * 100;

          // Record enhanced transaction
          enhancedTransactions.push({
            date: dayData.date,
            type: 'SELL',
            price: executionPrice,
            shares: lotsToSell.reduce((sum, lot) => sum + lot.shares, 0),
            value: totalSaleValue,
            lotsDetails: lotsToSell.map(lot => ({ price: lot.price, shares: lot.shares })),
            lotsAfterTransaction: [...lots],
            averageCost: averageCost,
            unrealizedPNL: unrealizedPNLAfterSell,
            realizedPNL: realizedPNL,
            totalPNL: totalPNLAfterSell,
            realizedPNLFromTrade: pnl,
            annualizedReturn: annualizedReturn,
            annualizedReturnPercent: annualizedReturnPercent,
            ocoOrderDetail: null,
            trailingStopDetail: {
              triggered: true,
              stopPrice: stopPrice,
              limitPrice: limitPrice,
              executionPrice: executionPrice,
              highestPriceBeforeStop: activeStop.highestPrice,
              recentBottomReference: activeStop.recentBottomReference,
              priceWhenOrderSet: activeStop.priceWhenOrderSet,
              lastUpdatePrice: activeStop.lastUpdatePrice  // Actual peak price when order was last updated
            }
          });

          transactionLog.push(
            colorize(`  ACTION: TRAILING STOP SELL EXECUTED at ${executionPrice.toFixed(2)} (stop: ${stopPrice.toFixed(2)}). PNL: ${pnl.toFixed(2)}, Ann.Return: ${annualizedReturnPercent.toFixed(2)}% (${actualDaysHeld} days). Lots: ${getLotsPrices(lots)}, New Avg Cost: ${averageCost.toFixed(2)}`, 'red')
          );

          // Clear active stop and reset peak/bottom tracking after sell
          activeStop = null;
          resetPeakBottomTracking(currentPrice, dayData.date);

          actionsOccurred = true;
        } else {
          const reason = executionPrice <= limitPrice
            ? `Execution price ${executionPrice.toFixed(2)} <= limit price ${limitPrice.toFixed(2)}`
            : `Execution price ${executionPrice.toFixed(2)} <= average cost ${averageCost.toFixed(2)} (would be unprofitable)`;
          transactionLog.push(
            colorize(`  INFO: Trailing stop execution BLOCKED - ${reason}`, 'yellow')
          );
        }
      }

      // SECOND PRIORITY: Execute trailing stop buy orders
      // First, check if we need to cancel due to price exceeding limit
      const wasCancelled = cancelTrailingStopBuyIfAbovePeak(currentPrice);
      if (wasCancelled) {
        actionsOccurred = true;
      }

      const trailingStopBuyExecuted = checkTrailingStopBuyExecution(currentPrice, dayData.date);
      if (trailingStopBuyExecuted) {
        actionsOccurred = true;
      } else {
        // Check if trailing stop buy should be activated (only if not currently active)
        if (!trailingStopBuy) {
          checkTrailingStopBuyActivation(currentPrice, dayData.date);
        }

        // Update trailing stop buy if active
        updateTrailingStopBuy(currentPrice);
      }

      // NO REGULAR BUYING - All purchases are exclusively through trailing stop buy orders
      // Regular grid-based buying logic has been completely removed

      if (transactionLog.length > dayStartLogLength) {
        actionsOccurred = true;
      }

      // Create header and log entries
      if (actionsOccurred) {
        let header = `--- ${dayData.date} ---\n`;
        header += `${pad('Price: ' + currentPrice.toFixed(2), 18)}| `;
        header += `${pad('R.PNL: ' + realizedPNL.toFixed(0), 18)}| `;
        header += `${pad('U.PNL: ' + unrealizedPNL.toFixed(0), 18)}| `;
        header += `${pad('T.PNL: ' + totalPNL.toFixed(0), 18)}| `;
        header += `Holdings: ${getLotsPrices(holdingsAtStartOfDay)}`;

        transactionLog.splice(dayStartLogLength, 0, header);
      } else if (verbose) {
        // For command line, show all days. For API, only show action days
        const singleLine = `--- ${dayData.date} --- ${pad('Price: ' + currentPrice.toFixed(2), 18)}| ${pad('R.PNL: ' + realizedPNL.toFixed(0), 18)}| ${pad('U.PNL: ' + unrealizedPNL.toFixed(0), 18)}| ${pad('T.PNL: ' + totalPNL.toFixed(0), 18)}| Holdings: ${getLotsPrices(holdingsAtStartOfDay)}`;
        transactionLog.push(singleLine);
      }
    }

    // Calculate final results
    const totalSharesHeld = lots.reduce((sum, lot) => sum + lot.shares, 0);
    const totalCostOfHeldLots = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
    const finalPrice = pricesWithIndicators[pricesWithIndicators.length - 1].adjusted_close;
    const marketValueOfHeldLots = totalSharesHeld * finalPrice;
    const unrealizedPNL = marketValueOfHeldLots - totalCostOfHeldLots;
    const totalPNL = realizedPNL + unrealizedPNL;
    const maxExposure = maxLots * lotSizeUsd;
    const returnOnMaxExposure = (totalPNL / maxExposure) * 100;

    // Calculate metrics
    const metrics = calculateMetrics(dailyPortfolioValues, dailyCapitalDeployed, transactionLog, pricesWithIndicators);
    const initialCapital = lotSizeUsd * maxLots;
    const buyAndHoldResults = calculateBuyAndHold(pricesWithIndicators, initialCapital);
    const dcaFinalValue = totalCostOfHeldLots + realizedPNL + unrealizedPNL;
    const outperformance = dcaFinalValue - buyAndHoldResults.finalValue;
    const outperformancePercent = (outperformance / buyAndHoldResults.finalValue) * 100;

    // Calculate individual trade annualized returns including current holdings
    const tradeAnalysis = calculateTradeAnnualizedReturns(enhancedTransactions, startDate, endDate, lots, finalPrice);

    // Print summary if verbose
    if (verbose) {
      console.log('\n--- Transaction Log ---');
      transactionLog.forEach(log => console.log(log));

      console.log('\n--- Final Summary ---');
      console.log(`Ending Date: ${pricesWithIndicators[pricesWithIndicators.length - 1].date}`);
      console.log(`Final Held Lots: ${lots.length}`);
      console.log(`Total Shares Held: ${totalSharesHeld.toFixed(2)}`);
      console.log(`Average Cost of Holdings: ${totalSharesHeld > 0 ? (totalCostOfHeldLots / totalSharesHeld).toFixed(2) : 'N/A'}`);
      console.log(`Final Market Price: ${finalPrice.toFixed(2)}`);
      console.log(`Market Value of Holdings: ${marketValueOfHeldLots.toFixed(2)}`);
      console.log(`\nRealized P&L: ${realizedPNL.toFixed(2)}`);
      console.log(`Unrealized P&L: ${unrealizedPNL.toFixed(2)}`);
      console.log(`Total P&L: ${totalPNL.toFixed(2)}`);
      console.log(`Return on Max Exposure (${maxExposure}): ${returnOnMaxExposure.toFixed(2)}%`);

      console.log(`\n--- Backtesting Metrics ---`);
      console.log(`Total Return: ${metrics.totalReturn.toFixed(2)} USD (${metrics.totalReturnPercent.toFixed(2)}%)`);
      console.log(`DCA Annualized Return: ${metrics.annualizedReturnPercent.toFixed(2)}%`);
      console.log(`Max Drawdown: ${metrics.maxDrawdown.toFixed(2)} USD (${metrics.maxDrawdownPercent.toFixed(2)}%)`);
      console.log(`Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
      console.log(`Win Rate: ${metrics.winRate.toFixed(2)}%`);
      console.log(`Average Trade Annualized Return: ${tradeAnalysis.averageAnnualizedReturnPercent.toFixed(2)}%`);
      console.log(`  - Completed Trades Only: ${tradeAnalysis.tradeOnlyAverageAnnualizedReturnPercent.toFixed(2)}% (${tradeAnalysis.individualTradeReturns.length} trades)`);
      console.log(`  - Current Holdings Only: ${tradeAnalysis.holdingOnlyAverageAnnualizedReturnPercent.toFixed(2)}% (${tradeAnalysis.currentHoldingReturns.length} holdings)`);
      console.log(`  - Combined (All Positions): ${tradeAnalysis.averageAnnualizedReturnPercent.toFixed(2)}% (${tradeAnalysis.allReturns.length} total)`);
      console.log(`Total Trades: ${metrics.totalTrades}`);
      console.log(`Volatility: ${metrics.volatility.toFixed(2)}%`);

      // Add detailed current holdings calculations
      if (tradeAnalysis.currentHoldingReturns.length > 0) {
        console.log(`\n--- Current Holdings Annualized Return Calculations ---`);
        tradeAnalysis.currentHoldingReturns.forEach((holding, index) => {
          console.log(`Holding ${index + 1}: Buy @$${holding.buyPrice.toFixed(2)} → Current @$${holding.sellPrice.toFixed(2)}`);
          console.log(`  Investment: $${holding.investment.toFixed(2)}, Current Value: $${(holding.investment + holding.returns).toFixed(2)}`);
          console.log(`  P&L: $${holding.returns.toFixed(2)} (${holding.returnPercent.toFixed(2)}%)`);
          console.log(`  Annualized Return: ${holding.annualizedReturnPercent.toFixed(2)}% (${holding.totalBacktestDays} days backtest period)`);
          console.log(`  Formula: ${holding.returnPercent < 0 ? `(1 - |${holding.returnPercent.toFixed(2)}%|) ^ (365 / ${holding.totalBacktestDays}) - 1` : `(1 + ${holding.returnPercent.toFixed(2)}%) ^ (365 / ${holding.totalBacktestDays}) - 1`}`);
        });
      }

      console.log(`\n--- Strategy Comparison (DCA vs Buy & Hold) ---`);
      console.log(`DCA Final Portfolio Value: ${dcaFinalValue.toFixed(2)} USD`);
      console.log(`Buy & Hold Final Value: ${buyAndHoldResults.finalValue.toFixed(2)} USD`);
      console.log(`DCA Total Return: ${metrics.totalReturnPercent.toFixed(2)}% vs B&H: ${buyAndHoldResults.totalReturnPercent.toFixed(2)}%`);
      console.log(`DCA Annualized Return: ${metrics.annualizedReturnPercent.toFixed(2)}% vs B&H: ${buyAndHoldResults.annualizedReturnPercent.toFixed(2)}%`);
      console.log(`Outperformance: ${outperformance.toFixed(2)} USD (${outperformancePercent.toFixed(2)}%)`);
      console.log(`DCA Max Drawdown: ${metrics.maxDrawdownPercent.toFixed(2)}% vs B&H: ${buyAndHoldResults.maxDrawdownPercent.toFixed(2)}%`);
    }

    return {
      strategy: 'SHARED_CORE',
      symbol: symbol,
      startDate: startDate,
      endDate: endDate,
      finalLots: lots.length,
      totalSharesHeld: totalSharesHeld,
      averageCostOfHoldings: totalSharesHeld > 0 ? totalCostOfHeldLots / totalSharesHeld : 0,
      finalMarketPrice: finalPrice,
      marketValueOfHoldings: marketValueOfHeldLots,
      realizedPNL: realizedPNL,
      unrealizedPNL: unrealizedPNL,
      totalPNL: totalPNL,
      returnOnMaxExposure: returnOnMaxExposure,
      totalReturn: metrics.totalReturn,
      totalReturnPercent: metrics.totalReturnPercent,
      annualizedReturn: metrics.annualizedReturn,
      annualizedReturnPercent: metrics.annualizedReturnPercent,
      maxDrawdown: metrics.maxDrawdown,
      maxDrawdownPercent: metrics.maxDrawdownPercent,
      sharpeRatio: metrics.sharpeRatio,
      winRate: metrics.winRate,
      totalTrades: metrics.totalTrades,
      avgCapitalDeployed: metrics.avgCapitalDeployed,
      maxCapitalDeployed: metrics.maxCapitalDeployed,
      combinedWeightedReturn: metrics.combinedWeightedReturn,
      volatility: metrics.volatility,
      tradeAnalysis: tradeAnalysis,
      dcaFinalValue: dcaFinalValue,
      buyAndHoldResults: buyAndHoldResults,
      outperformance: outperformance,
      outperformancePercent: outperformancePercent,
      transactionLog: transactionLog,
      lots: lots,
      enhancedTransactions: enhancedTransactions
    };

    console.log(`🔍 DCA Backtest Debug - Enhanced Transactions: ${enhancedTransactions.length} total`);

  } catch (error) {
    if (verbose) {
      console.error('Error running DCA backtest:', error);
    }
    throw error;
  }
}

module.exports = {
  runDCABacktest,
  calculateMetrics,
  calculatePortfolioDrawdown,
  assessMarketCondition,
  calculateBuyAndHold
};
