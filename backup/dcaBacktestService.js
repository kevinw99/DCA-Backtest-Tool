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

  return {
    totalReturn: finalValue - initialValue,
    totalReturnPercent: initialValue > 0 ? ((finalValue - initialValue) / initialValue) * 100 : 0,
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

    // OCO (One-Cancels-the-Other) Order System
    let ocoOrders = []; // Array of OCO order pairs

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

    const attemptToSetStop = (currentPrice) => {
      if (lots.length > 0 && currentPrice > averageCost && !activeStop) {
        // Calculate current unrealized P&L
        const totalSharesHeld = lots.reduce((sum, lot) => sum + lot.shares, 0);
        const totalCostOfHeldLots = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
        const unrealizedPNL = (totalSharesHeld * currentPrice) - totalCostOfHeldLots;

        // Only set trailing stop if unrealized P&L > 0
        if (unrealizedPNL > 0) {
          // Find the highest-priced lot that is 10% below the current price
          const eligibleLots = lots.filter(lot => lot.price <= currentPrice * 0.9);

          if (eligibleLots.length > 0) {
            const sortedEligibleLots = eligibleLots.sort((a, b) => b.price - a.price);
            const lotToSell = sortedEligibleLots[0]; // Select highest-priced eligible lot

            // New pricing logic:
            // Stop Price: current price * 0.9
            // Limit Price: the targeted lot price
            const stopPrice = currentPrice * 0.9;
            const limitPrice = lotToSell.price;

            activeStop = {
              stopPrice: stopPrice,
              limitPrice: limitPrice,
              lotsToSell: [lotToSell],
              highestPrice: currentPrice,  // Track highest price for trailing
              initialStopPrice: stopPrice
            };
            transactionLog.push(colorize(`  ACTION: TRAILING STOP-LIMIT SET for lot ${lotToSell.price.toFixed(2)}. Stop: ${stopPrice.toFixed(2)}, Limit: ${limitPrice.toFixed(2)} (Unrealized P&L: ${unrealizedPNL.toFixed(2)})`, 'yellow'));
          }
        }
      }
    };

    // Update trailing stop when price moves higher
    const updateTrailingStop = (currentPrice) => {
      if (activeStop && currentPrice > activeStop.highestPrice) {
        // Keep stop price at current price * 0.9
        const newStopPrice = currentPrice * 0.9;

        if (newStopPrice > activeStop.stopPrice) {
          const oldStopPrice = activeStop.stopPrice;
          activeStop.stopPrice = newStopPrice;
          activeStop.highestPrice = currentPrice;

          transactionLog.push(colorize(`  ACTION: TRAILING STOP UPDATED from ${oldStopPrice.toFixed(2)} to ${newStopPrice.toFixed(2)} (High: ${currentPrice.toFixed(2)})`, 'cyan'));
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

    // OCO Order Management Functions
    const createOCOOrders = (sellPrice, currentDate) => {
      const limitBuyPrice = sellPrice * 0.9; // 10% below sell price
      const trailingBuyOrder = {
        type: 'TRAILING_BUY',
        highestPriceSinceSell: sellPrice,
        triggerDropPercent: 0.1 // 10% drop from highest
      };

      const ocoOrder = {
        id: Date.now() + Math.random(),
        limitBuy: {
          type: 'LIMIT_BUY',
          price: limitBuyPrice
        },
        trailingBuy: trailingBuyOrder,
        createdPrice: sellPrice,
        date: currentDate
      };

      ocoOrders.push(ocoOrder);
      transactionLog.push(colorize(`  OCO: Reset and created new OCO orders - Limit buy at ${limitBuyPrice.toFixed(2)}, Trailing buy on 10% drop from high`, 'blue'));
    };

    const checkOCOOrders = (currentPrice, currentDate) => {
      for (let i = ocoOrders.length - 1; i >= 0; i--) {
        const oco = ocoOrders[i];
        let orderExecuted = false;

        // Update trailing buy high water mark
        if (currentPrice > oco.trailingBuy.highestPriceSinceSell) {
          oco.trailingBuy.highestPriceSinceSell = currentPrice;
        }

        // Check limit buy order
        if (currentPrice <= oco.limitBuy.price) {
          // Execute limit buy only if it respects grid spacing
          if (lots.length < maxLots) {
            const respectsGridSpacing = lots.every(lot => Math.abs(currentPrice - lot.price) / lot.price >= gridIntervalPercent);
            if (respectsGridSpacing) {
              const shares = lotSizeUsd / currentPrice;
              lots.push({ price: currentPrice, shares: shares, date: currentDate });
              averageCost = recalculateAverageCost();

              // Calculate P&L values after OCO buy
              const totalSharesHeldAfterBuy = lots.reduce((sum, lot) => sum + lot.shares, 0);
              const totalCostOfHeldLotsAfterBuy = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
              const unrealizedPNLAfterBuy = (totalSharesHeldAfterBuy * currentPrice) - totalCostOfHeldLotsAfterBuy;
              const totalPNLAfterBuy = realizedPNL + unrealizedPNLAfterBuy;

              // Record enhanced transaction
              enhancedTransactions.push({
                date: currentDate,
                type: 'OCO_LIMIT_BUY',
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
                ocoOrderDetail: {
                  type: 'LIMIT_BUY',
                  triggerPrice: oco.limitBuy.price,
                  originalSellPrice: oco.createdPrice
                },
                trailingStopDetail: null
              });

              transactionLog.push(colorize(`  ACTION: OCO LIMIT BUY executed at ${currentPrice.toFixed(2)}. Lots: ${getLotsPrices(lots)}, New Avg Cost: ${averageCost.toFixed(2)}`, 'green'));

              // Cancel existing trailing stop since OCO executed (condition changed)
              if (activeStop) {
                transactionLog.push(colorize(`  ACTION: Cancelled trailing stop due to OCO LIMIT BUY execution`, 'cyan'));
                activeStop = null;
              }

              // Attempt to set up new trailing stop if conditions allow
              attemptToSetStop(currentPrice);

              orderExecuted = true;
            } else {
              transactionLog.push(colorize(`  INFO: OCO LIMIT BUY blocked at ${currentPrice.toFixed(2)} - violates grid spacing rule`, 'yellow'));
            }
          }
        }

        // Check trailing buy order (only if limit buy hasn't executed)
        if (!orderExecuted) {
          const dropFromHigh = (oco.trailingBuy.highestPriceSinceSell - currentPrice) / oco.trailingBuy.highestPriceSinceSell;
          if (dropFromHigh >= oco.trailingBuy.triggerDropPercent) {
            // Execute trailing buy (market order) only if it respects grid spacing
            if (lots.length < maxLots) {
              const respectsGridSpacing = lots.every(lot => Math.abs(currentPrice - lot.price) / lot.price >= gridIntervalPercent);
              if (respectsGridSpacing) {
                const shares = lotSizeUsd / currentPrice;
                lots.push({ price: currentPrice, shares: shares, date: currentDate });
                averageCost = recalculateAverageCost();

                // Calculate P&L values after OCO trailing buy
                const totalSharesHeldAfterBuy = lots.reduce((sum, lot) => sum + lot.shares, 0);
                const totalCostOfHeldLotsAfterBuy = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
                const unrealizedPNLAfterBuy = (totalSharesHeldAfterBuy * currentPrice) - totalCostOfHeldLotsAfterBuy;
                const totalPNLAfterBuy = realizedPNL + unrealizedPNLAfterBuy;

                // Record enhanced transaction
                enhancedTransactions.push({
                  date: currentDate,
                  type: 'OCO_TRAILING_BUY',
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
                  ocoOrderDetail: {
                    type: 'TRAILING_BUY',
                    dropFromHigh: dropFromHigh,
                    highWaterMark: oco.trailingBuy.highestPriceSinceSell,
                    originalSellPrice: oco.createdPrice
                  },
                  trailingStopDetail: null
                });

                transactionLog.push(colorize(`  ACTION: OCO TRAILING BUY executed at ${currentPrice.toFixed(2)} (${(dropFromHigh*100).toFixed(1)}% drop from ${oco.trailingBuy.highestPriceSinceSell.toFixed(2)}). Lots: ${getLotsPrices(lots)}, New Avg Cost: ${averageCost.toFixed(2)}`, 'green'));

                // Cancel existing trailing stop since OCO executed (condition changed)
                if (activeStop) {
                  transactionLog.push(colorize(`  ACTION: Cancelled trailing stop due to OCO TRAILING BUY execution`, 'cyan'));
                  activeStop = null;
                }

                // Attempt to set up new trailing stop if conditions allow
                attemptToSetStop(currentPrice);

                orderExecuted = true;
              } else {
                transactionLog.push(colorize(`  INFO: OCO TRAILING BUY blocked at ${currentPrice.toFixed(2)} - violates grid spacing rule`, 'yellow'));
              }
            }
          }
        }

        // Remove OCO order if executed
        if (orderExecuted) {
          ocoOrders.splice(i, 1);
        }
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

      // Update trailing stop if price has moved higher
      updateTrailingStop(currentPrice);

      // Cancel trailing stop if price falls below average cost (no longer profitable)
      cancelTrailingStopIfUnprofitable(currentPrice);

      // HIGHEST PRIORITY: Check and potentially execute OCO orders (executes first)
      checkOCOOrders(currentPrice, dayData.date);

      // SECOND PRIORITY: Trailing Stop mechanism (executes after OCO orders)
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
            ocoOrderDetail: null, // Will be set when OCO is created
            trailingStopDetail: {
              triggered: true,
              stopPrice: stopPrice,
              limitPrice: limitPrice,
              executionPrice: executionPrice,
              highestPriceBeforeStop: activeStop.highestPrice
            }
          });

          transactionLog.push(
            colorize(`  ACTION: SELL: Trailing stop ${stopPrice.toFixed(2)} executed at ${executionPrice.toFixed(2)}. PNL: ${pnl.toFixed(2)}. Lots: ${getLotsPrices(lots)}, New Avg Cost: ${averageCost.toFixed(2)}`, 'red')
          );

          // Post-sell execution per updated requirements:
          // 2.4.5.1: Remove sold lots, recalculate average cost, clear active stop (done above)
          // 2.4.5.2: Reset OCO orders - clear existing and create new based on current sell price
          ocoOrders = []; // Clear all existing OCO orders - only one OCO order allowed
          createOCOOrders(executionPrice, dayData.date);

          // 2.4.5.3: Set up new trailing stop limit order
          activeStop = null; // Clear current stop first
          // New stop will be set by attemptToSetStop() later in this iteration

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


      // Enhanced Buying Strategy with stringent first lot filters
      let didBuy = false;
      console.log(`🔍 Buy Check - Date: ${dayData.date}, Lots: ${lots.length}/${maxLots}, OCO Orders: ${ocoOrders.length}`);
      if (lots.length < maxLots) {
        let canBuy = false;
        let buyReasons = [];
        let skipReasons = [];

        // OCO Order Exclusivity Check - if OCO orders are pending, suspend regular buying
        if (ocoOrders.length > 0) {
          canBuy = false;
          skipReasons.push("OCO orders pending - regular buying suspended");
        } else {
          // First lot or subsequent lots - apply same grid logic
          if (lots.length === 0) {
            canBuy = true;
            buyReasons.push("First lot");
          } else {
            // Subsequent lots - existing grid logic
            const isFarEnough = lots.every(lot => Math.abs(currentPrice - lot.price) / lot.price >= gridIntervalPercent);
            if (isFarEnough) {
              canBuy = true;
              buyReasons.push("Grid spacing");

            } else {
              skipReasons.push("Too close to existing lots");
            }
          }
        }

        // All technical filters are DISABLED per updated requirements
        // The strategy now buys aggressively based purely on grid spacing
        // No MA20, bear market, or remaining lots loss tolerance filters applied

        if (canBuy) {
          const shares = lotSizeUsd / currentPrice;
          lots.push({ price: currentPrice, shares: shares, date: dayData.date });
          averageCost = recalculateAverageCost();

          // Calculate P&L values after buy
          const totalSharesHeldAfterBuy = lots.reduce((sum, lot) => sum + lot.shares, 0);
          const totalCostOfHeldLotsAfterBuy = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
          const unrealizedPNLAfterBuy = (totalSharesHeldAfterBuy * currentPrice) - totalCostOfHeldLotsAfterBuy;
          const totalPNLAfterBuy = realizedPNL + unrealizedPNLAfterBuy;

          // Record enhanced transaction
          enhancedTransactions.push({
            date: dayData.date,
            type: 'BUY',
            price: currentPrice,
            shares: shares,
            value: lotSizeUsd,
            lotsDetails: null, // N/A for buys
            lotsAfterTransaction: [...lots],
            averageCost: averageCost,
            unrealizedPNL: unrealizedPNLAfterBuy,
            realizedPNL: realizedPNL,
            totalPNL: totalPNLAfterBuy,
            realizedPNLFromTrade: 0, // N/A for buys
            ocoOrderDetail: null,
            trailingStopDetail: null
          });

          const reasonsText = buyReasons.length > 0 ? ` (${buyReasons.join(', ')})` : '';
          transactionLog.push(colorize(`  ACTION: BUY: Bought 1 lot at ${currentPrice.toFixed(2)}${reasonsText}. Lots: ${getLotsPrices(lots)}, New Avg Cost: ${averageCost.toFixed(2)}`, 'green'));

          // Add market context
          if (dayData.ma_20 || dayData.volatility_20) {
            const contextInfo = [];
            if (dayData.ma_20) contextInfo.push(`MA20: ${dayData.ma_20.toFixed(2)}`);
            if (dayData.volatility_20) contextInfo.push(`Vol: ${(dayData.volatility_20*100).toFixed(1)}%`);
            if (dayData.rsi_14) contextInfo.push(`RSI: ${dayData.rsi_14.toFixed(1)}`);
            if (contextInfo.length > 0) {
              transactionLog.push(colorize(`  INFO: Market context - ${contextInfo.join(', ')}, Regime: ${marketCondition.regime}, Trend: ${marketCondition.weeklyTrend}`, 'blue'));
            }
          }

          if (activeStop) {
            transactionLog.push(colorize(`  ACTION: TRAILING STOP CANCELLED due to new buy. Previous stop: ${activeStop.stopPrice.toFixed(2)}`, 'magenta'));
            activeStop = null;
          }
          didBuy = true;
          actionsOccurred = true;
        } else if (skipReasons.length > 0) {
          const isFarEnough = lots.length === 0 || lots.every(lot => Math.abs(currentPrice - lot.price) / lot.price >= gridIntervalPercent);
          if (isFarEnough && skipReasons.length > 0) {
            transactionLog.push(colorize(`  INFO: Buy skipped - ${skipReasons.join(', ')}`, 'white'));
            actionsOccurred = true;
          }
        }
      }

      // Set/re-evaluate stop
      attemptToSetStop(currentPrice);

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
      console.log(`Max Drawdown: ${metrics.maxDrawdown.toFixed(2)} USD (${metrics.maxDrawdownPercent.toFixed(2)}%)`);
      console.log(`Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
      console.log(`Win Rate: ${metrics.winRate.toFixed(2)}%`);
      console.log(`Total Trades: ${metrics.totalTrades}`);
      console.log(`Volatility: ${metrics.volatility.toFixed(2)}%`);

      console.log(`\n--- Strategy Comparison (DCA vs Buy & Hold) ---`);
      console.log(`DCA Final Portfolio Value: ${dcaFinalValue.toFixed(2)} USD`);
      console.log(`Buy & Hold Final Value: ${buyAndHoldResults.finalValue.toFixed(2)} USD`);
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
      maxDrawdown: metrics.maxDrawdown,
      maxDrawdownPercent: metrics.maxDrawdownPercent,
      sharpeRatio: metrics.sharpeRatio,
      winRate: metrics.winRate,
      totalTrades: metrics.totalTrades,
      avgCapitalDeployed: metrics.avgCapitalDeployed,
      maxCapitalDeployed: metrics.maxCapitalDeployed,
      combinedWeightedReturn: metrics.combinedWeightedReturn,
      volatility: metrics.volatility,
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
