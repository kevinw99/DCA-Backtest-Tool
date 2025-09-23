const db = require('./backend/database.js');

// --- Strategy Parameters ---
const SYMBOL = 'TSLA';
const START_DATE = '2021-11-01';
const END_DATE = '2021-11-05';
const LOT_SIZE_USD = 10000;
const MAX_LOTS = 5;
const GRID_INTERVAL_PERCENT = 0.1;
const REMAINING_LOTS_LOSS_TOLERANCE = 0.05;

// --- Backtesting Metrics Calculation Functions ---
function calculateMetrics(dailyValues, capitalDeployed, transactionLog, prices) {
  // ...existing code... (keeping your existing implementation)
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

  const totalCapitalDeployed = Math.max(...capitalDeployed);
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

// --- Portfolio Drawdown Calculation ---
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

// --- Market Condition Assessment ---
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

// --- Buy and Hold Calculation ---
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

async function runBacktest() {
  console.log(`Starting OPTIMIZED DCA backtest for ${SYMBOL}...`);
  console.log(`Using precalculated technical indicators from database`);

  try {
    // 1. Get Stock ID
    const stock = await db.getStock(SYMBOL);
    if (!stock) {
      console.error(`Stock symbol ${SYMBOL} not found in the database.`);
      return;
    }

    // 2. Get Combined Price and Technical Indicator Data (OPTIMIZED!)
    const pricesWithIndicators = await db.getPricesWithIndicators(stock.id, START_DATE, END_DATE);
    if (pricesWithIndicators.length === 0) {
      console.error(`No price/indicator data found for ${SYMBOL} between ${START_DATE} and ${END_DATE}.`);
      return;
    }
    console.log(`Successfully fetched ${pricesWithIndicators.length} records with technical indicators.`);

    // --- Backtesting Logic (OPTIMIZED) ---
    let lots = [];
    let realizedPNL = 0;
    let averageCost = 0;
    let initialPrice = pricesWithIndicators[0].adjusted_close;
    let trailingAmount = initialPrice * 0.10;
    let transactionLog = [];
    let activeStop = null;
    let dailyPortfolioValues = [];
    let dailyCapitalDeployed = [];

    const recalculateAverageCost = () => {
      if (lots.length > 0) {
        const totalCost = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
        const totalShares = lots.reduce((sum, lot) => sum + lot.shares, 0);
        return totalCost / totalShares;
      }
      return 0;
    };

    const getLotsPrices = (lotArray) => `[${lotArray.map(l => l.price.toFixed(2)).join(', ')}]`;

    const attemptToSetStop = (currentPrice) => {
      if (lots.length > 0 && currentPrice > averageCost && !activeStop) {
        const sortedLots = [...lots].sort((a, b) => b.price - a.price);
        const batchToSell = sortedLots.slice(0, 2);
        const remainingLots = sortedLots.slice(2);

        const remainingLotsCompliant = remainingLots.every(lot =>
          lot.price <= currentPrice * (1 + REMAINING_LOTS_LOSS_TOLERANCE)
        );

        if (remainingLots.length === 0 || remainingLotsCompliant) {
          const batchCost = batchToSell.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
          const batchShares = batchToSell.reduce((sum, lot) => sum + lot.shares, 0);
          const batchWeightedAverage = batchCost / batchShares;
          const limitPrice = batchWeightedAverage * (1 - REMAINING_LOTS_LOSS_TOLERANCE);
          const stopPrice = Math.max(limitPrice, currentPrice - trailingAmount);
          const minStopPrice = limitPrice * 0.95;

          if (stopPrice > minStopPrice && stopPrice < currentPrice && stopPrice <= currentPrice * 0.95) {
            activeStop = { stopPrice: stopPrice, limitPrice: limitPrice, lotsToSell: batchToSell };
            transactionLog.push(`  ACTION: INFO: New stop-limit order set for batch ${getLotsPrices(batchToSell)}. Stop: ${stopPrice.toFixed(2)}, Limit: ${limitPrice.toFixed(2)}`);
          }
        }
      }
    };

    // Main loop through each day's data (OPTIMIZED!)
    for (let i = 0; i < pricesWithIndicators.length; i++) {
      const dayData = pricesWithIndicators[i];
      const currentPrice = dayData.adjusted_close;
      const holdingsAtStartOfDay = [...lots];
      averageCost = recalculateAverageCost();

      // Use precalculated technical indicators (NO CALCULATION NEEDED!)
      const marketCondition = assessMarketCondition(dayData);

      // Daily PNL Calculation
      const totalSharesHeld = holdingsAtStartOfDay.reduce((sum, lot) => sum + lot.shares, 0);
      const totalCostOfHeldLots = holdingsAtStartOfDay.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
      const unrealizedPNL = (totalSharesHeld * currentPrice) - totalCostOfHeldLots;
      const totalPNL = realizedPNL + unrealizedPNL;

      // Portfolio risk management
      const currentPortfolioValue = totalCostOfHeldLots + realizedPNL + unrealizedPNL;
      const portfolioDrawdown = calculatePortfolioDrawdown(dailyPortfolioValues);
      const maxPortfolioDrawdown = 0.50;
      const portfolioAtRisk = lots.length > 0 && portfolioDrawdown.maxDrawdownPercent > maxPortfolioDrawdown;

      dailyPortfolioValues.push(currentPortfolioValue);
      dailyCapitalDeployed.push(totalCostOfHeldLots);

      const pad = (str, len) => String(str).padEnd(len);
      let actionsOccurred = false;
      const dayStartLogLength = transactionLog.length;

      // Stop mechanism
      if (activeStop && currentPrice <= activeStop.stopPrice) {
        const { stopPrice, limitPrice, lotsToSell } = activeStop;
        const gapPercent = Math.abs(currentPrice - stopPrice) / stopPrice;

        let executionPrice, executionType;

        if (gapPercent > 0.10) {
          executionPrice = currentPrice;
          executionType = "MARKET (Emergency)";
        } else if (gapPercent > 0.05) {
          executionPrice = currentPrice;
          executionType = "MARKET (Gap)";
        } else {
          executionPrice = Math.max(currentPrice, limitPrice);
          executionType = "LIMIT";
        }

        if (executionPrice > limitPrice * 0.90) {
          let totalSaleValue = 0;
          let costOfSoldLots = 0;

          lotsToSell.forEach(soldLot => {
            totalSaleValue += soldLot.shares * executionPrice;
            costOfSoldLots += soldLot.shares * soldLot.price;
          });

          const pnl = totalSaleValue - costOfSoldLots;
          realizedPNL += pnl;

          lots = lots.filter(l => !lotsToSell.find(sl => sl.price === l.price && sl.shares === l.shares));
          averageCost = recalculateAverageCost();

          transactionLog.push(
            `  ACTION: SELL (${executionType}): Trigger ${stopPrice.toFixed(2)} executed at ${executionPrice.toFixed(2)}. PNL: ${pnl.toFixed(2)}. Gap: ${(gapPercent*100).toFixed(1)}%. Lots: ${getLotsPrices(lots)}, New Avg Cost: ${averageCost.toFixed(2)}`
          );
          activeStop = null;
          actionsOccurred = true;
        }
      }

      // Enhanced Buying Strategy with OPTIMIZED indicators
      let didBuy = false;
      if (lots.length < MAX_LOTS) {
        let canBuy = false;
        let buyReasons = [];
        let skipReasons = [];

        // Basic grid spacing check
        if (lots.length === 0) {
          // Wait for technical indicators to be available (OPTIMIZED CHECK!)
          if (dayData.ma_20 && dayData.volatility_20 && dayData.rsi_14) {
            canBuy = true;
            buyReasons.push("First lot");
          } else {
            canBuy = false;
            skipReasons.push("Waiting for technical indicators to become available");
          }
        } else {
          const isFarEnough = lots.every(lot => Math.abs(currentPrice - lot.price) / lot.price >= GRID_INTERVAL_PERCENT);
          if (isFarEnough) {
            canBuy = true;
            buyReasons.push("Grid spacing");

            // Post-sell recovery logic
            if (transactionLog.some(t => t.includes('SELL'))) {
              const recentSells = transactionLog.filter(t => t.includes('SELL'));
              if (recentSells.length > 0) {
                const lastSell = recentSells[recentSells.length - 1];
                const triggerMatch = lastSell.match(/Trigger ([\d.]+)/);
                if (triggerMatch) {
                  const lastTriggerPrice = parseFloat(triggerMatch[1]);
                  if (currentPrice <= lastTriggerPrice) {
                    canBuy = false;
                    skipReasons.push(`Price ${currentPrice.toFixed(2)} below last trigger ${lastTriggerPrice.toFixed(2)}`);
                  } else {
                    buyReasons.push("Above last trigger");
                  }
                }
              }
            }
          } else {
            skipReasons.push("Too close to existing lots");
          }
        }

        // Apply trading filters using OPTIMIZED indicators
        if (canBuy) {
          if (portfolioAtRisk) {
            canBuy = false;
            skipReasons.push(`Portfolio drawdown ${portfolioDrawdown.maxDrawdownPercent.toFixed(1)}% > 50%`);
          }

          if (dayData.volatility_20 && dayData.volatility_20 > 0.60) {
            canBuy = false;
            skipReasons.push(`High volatility ${(dayData.volatility_20*100).toFixed(1)}%`);
          }

          if (dayData.ma_20 && currentPrice < dayData.ma_20 * 0.98) {
            canBuy = false;
            skipReasons.push(`Price ${currentPrice.toFixed(2)} below MA20 ${dayData.ma_20.toFixed(2)}`);
          }

          if (marketCondition.regime === 'bear') {
            canBuy = false;
            skipReasons.push("Bear market regime");
          }

          // Oversold opportunity
          if (dayData.rsi_14 && dayData.rsi_14 < 30 && marketCondition.weeklyTrend !== 'bearish') {
            canBuy = true;
            buyReasons.push(`Oversold RSI ${dayData.rsi_14.toFixed(1)}`);
            skipReasons = [];
          }
        }

        if (canBuy) {
          const shares = LOT_SIZE_USD / currentPrice;
          lots.push({ price: currentPrice, shares: shares });
          averageCost = recalculateAverageCost();

          const reasonsText = buyReasons.length > 0 ? ` (${buyReasons.join(', ')})` : '';
          transactionLog.push(`  ACTION: BUY: Bought 1 lot at ${currentPrice.toFixed(2)}${reasonsText}. Lots: ${getLotsPrices(lots)}, New Avg Cost: ${averageCost.toFixed(2)}`);

          // Add market context using OPTIMIZED indicators
          if (dayData.ma_20 || dayData.volatility_20) {
            const contextInfo = [];
            if (dayData.ma_20) contextInfo.push(`MA20: ${dayData.ma_20.toFixed(2)}`);
            if (dayData.volatility_20) contextInfo.push(`Vol: ${(dayData.volatility_20*100).toFixed(1)}%`);
            if (dayData.rsi_14) contextInfo.push(`RSI: ${dayData.rsi_14.toFixed(1)}`);
            if (contextInfo.length > 0) {
              transactionLog.push(`  INFO: Market context - ${contextInfo.join(', ')}, Regime: ${marketCondition.regime}, Trend: ${marketCondition.weeklyTrend}`);
            }
          }

          activeStop = null;
          didBuy = true;
          actionsOccurred = true;
        } else if (skipReasons.length > 0) {
          const isFarEnough = lots.length === 0 || lots.every(lot => Math.abs(currentPrice - lot.price) / lot.price >= GRID_INTERVAL_PERCENT);
          if (isFarEnough && skipReasons.length > 0) {
            transactionLog.push(`  INFO: Buy skipped - ${skipReasons.join(', ')}`);
            actionsOccurred = true;
          }
        }
      }

      // Set/re-evaluate stop
      if (didBuy) {
        attemptToSetStop(currentPrice);
      } else {
        attemptToSetStop(currentPrice);
      }

      if (transactionLog.length > dayStartLogLength) {
        actionsOccurred = true;
      }

      // Create header
      if (actionsOccurred) {
        let header = `--- ${dayData.date} ---\n`;
        header += `${pad('Price: ' + currentPrice.toFixed(2), 18)}| `;
        header += `${pad('R.PNL: ' + realizedPNL.toFixed(0), 18)}| `;
        header += `${pad('U.PNL: ' + unrealizedPNL.toFixed(0), 18)}| `;
        header += `${pad('T.PNL: ' + totalPNL.toFixed(0), 18)}| `;
        header += `Holdings: ${getLotsPrices(holdingsAtStartOfDay)}`;

        transactionLog.splice(dayStartLogLength, 0, header);
      } else {
        const singleLine = `--- ${dayData.date} --- ${pad('Price: ' + currentPrice.toFixed(2), 18)}| ${pad('R.PNL: ' + realizedPNL.toFixed(0), 18)}| ${pad('U.PNL: ' + unrealizedPNL.toFixed(0), 18)}| ${pad('T.PNL: ' + totalPNL.toFixed(0), 18)}| Holdings: ${getLotsPrices(holdingsAtStartOfDay)}`;
        transactionLog.push(singleLine);
      }
    }

    // --- REPORTING (same as before) ---
    console.log('\n--- Transaction Log ---');
    transactionLog.forEach(log => console.log(log));

    console.log('\n--- Final Summary (OPTIMIZED WITH PRECALCULATED INDICATORS) ---');
    const totalSharesHeld = lots.reduce((sum, lot) => sum + lot.shares, 0);
    const totalCostOfHeldLots = lots.reduce((sum, lot) => sum + lot.price * lot.shares, 0);
    const finalPrice = pricesWithIndicators[pricesWithIndicators.length - 1].adjusted_close;
    const marketValueOfHeldLots = totalSharesHeld * finalPrice;
    const unrealizedPNL = marketValueOfHeldLots - totalCostOfHeldLots;
    const totalPNL = realizedPNL + unrealizedPNL;
    const maxExposure = MAX_LOTS * LOT_SIZE_USD;
    const returnOnMaxExposure = (totalPNL / maxExposure) * 100;

    console.log(`Ending Date: ${pricesWithIndicators[pricesWithIndicators.length - 1].date}`);
    console.log(`Final Held Lots: ${lots.length}`);
    console.log(`Total Shares Held: ${totalSharesHeld.toFixed(2)}`);
    console.log(`Average Cost of Holdings: ${(totalCostOfHeldLots / totalSharesHeld).toFixed(2)}`);
    console.log(`Final Market Price: ${finalPrice.toFixed(2)}`);
    console.log(`Market Value of Holdings: ${marketValueOfHeldLots.toFixed(2)}`);
    console.log(`\nRealized P&L: ${realizedPNL.toFixed(2)}`);
    console.log(`Unrealized P&L: ${unrealizedPNL.toFixed(2)}`);
    console.log(`Total P&L: ${totalPNL.toFixed(2)}`);
    console.log(`Return on Max Exposure (${maxExposure}): ${returnOnMaxExposure.toFixed(2)}%`);

    // Calculate metrics
    const { totalReturn, totalReturnPercent, maxDrawdown, maxDrawdownPercent, sharpeRatio, winRate, totalTrades, avgCapitalDeployed, maxCapitalDeployed, combinedWeightedReturn, volatility } = calculateMetrics(dailyPortfolioValues, dailyCapitalDeployed, transactionLog, pricesWithIndicators);

    console.log(`\n--- Backtesting Metrics ---`);
    console.log(`Total Return: ${totalReturn.toFixed(2)} USD (${totalReturnPercent.toFixed(2)}%)`);
    console.log(`Max Drawdown: ${maxDrawdown.toFixed(2)} USD (${maxDrawdownPercent.toFixed(2)}%)`);
    console.log(`Sharpe Ratio: ${sharpeRatio.toFixed(2)}`);
    console.log(`Win Rate: ${winRate.toFixed(2)}%`);
    console.log(`Total Trades: ${totalTrades}`);
    console.log(`Avg Capital Deployed: ${avgCapitalDeployed.toFixed(2)} USD`);
    console.log(`Max Capital Deployed: ${maxCapitalDeployed.toFixed(2)} USD`);
    console.log(`Combined Weighted Return: ${combinedWeightedReturn.toFixed(2)}%`);
    console.log(`Volatility: ${volatility.toFixed(2)}%`);

    const initialCapital = LOT_SIZE_USD * MAX_LOTS;
    const buyAndHoldResults = calculateBuyAndHold(pricesWithIndicators, initialCapital);

    console.log(`\n--- Buy and Hold Metrics ---`);
    console.log(`Total Return: ${buyAndHoldResults.totalReturn.toFixed(2)} USD (${buyAndHoldResults.totalReturnPercent.toFixed(2)}%)`);
    console.log(`Max Drawdown: ${buyAndHoldResults.maxDrawdown.toFixed(2)} USD (${buyAndHoldResults.maxDrawdownPercent.toFixed(2)}%)`);
    console.log(`Sharpe Ratio: ${buyAndHoldResults.sharpeRatio.toFixed(2)}`);
    console.log(`Volatility: ${buyAndHoldResults.volatility.toFixed(2)}%`);
    console.log(`Final Value: ${buyAndHoldResults.finalValue.toFixed(2)} USD`);
    console.log(`Shares Held: ${buyAndHoldResults.shares.toFixed(2)}`);

    const dcaFinalValue = totalCostOfHeldLots + realizedPNL + unrealizedPNL;
    const outperformance = dcaFinalValue - buyAndHoldResults.finalValue;
    const outperformancePercent = (outperformance / buyAndHoldResults.finalValue) * 100;

    console.log(`\n--- Strategy Comparison (DCA vs Buy & Hold) ---`);
    console.log(`DCA Final Portfolio Value: ${dcaFinalValue.toFixed(2)} USD`);
    console.log(`Buy & Hold Final Value: ${buyAndHoldResults.finalValue.toFixed(2)} USD`);
    console.log(`Outperformance: ${outperformance.toFixed(2)} USD (${outperformancePercent.toFixed(2)}%)`);
    console.log(`DCA Max Drawdown: ${maxDrawdownPercent.toFixed(2)}% vs B&H: ${buyAndHoldResults.maxDrawdownPercent.toFixed(2)}%`);
    console.log(`DCA Sharpe Ratio: ${sharpeRatio.toFixed(2)} vs B&H: ${buyAndHoldResults.sharpeRatio.toFixed(2)}`);
    console.log(`DCA Volatility: ${volatility.toFixed(2)}% vs B&H: ${buyAndHoldResults.volatility.toFixed(2)}%`);
    console.log(`Combined Weighted Return (DCA only): ${combinedWeightedReturn.toFixed(2)}%`);

    return {
      strategy: 'OPTIMIZED_STATIC',
      symbol: SYMBOL,
      startDate: START_DATE,
      endDate: END_DATE,
      finalLots: lots.length,
      totalSharesHeld: totalSharesHeld,
      averageCostOfHoldings: totalSharesHeld > 0 ? totalCostOfHeldLots / totalSharesHeld : 0,
      finalMarketPrice: finalPrice,
      marketValueOfHoldings: marketValueOfHeldLots,
      realizedPNL: realizedPNL,
      unrealizedPNL: unrealizedPNL,
      totalPNL: totalPNL,
      returnOnMaxExposure: returnOnMaxExposure,
      totalReturn: totalReturn,
      totalReturnPercent: totalReturnPercent,
      maxDrawdown: maxDrawdown,
      maxDrawdownPercent: maxDrawdownPercent,
      sharpeRatio: sharpeRatio,
      winRate: winRate,
      totalTrades: totalTrades,
      avgCapitalDeployed: avgCapitalDeployed,
      maxCapitalDeployed: maxCapitalDeployed,
      combinedWeightedReturn: combinedWeightedReturn,
      volatility: volatility,
      dcaFinalValue: dcaFinalValue,
      buyAndHoldResults: buyAndHoldResults,
      outperformance: outperformance,
      outperformancePercent: outperformancePercent,
      transactionLog: transactionLog
    };

  } catch (error) {
    console.error('Error running backtest:', error);
    throw error;
  }
}

// Run the backtest if this file is executed directly
if (require.main === module) {
  runBacktest()
    .then(results => {
      console.log('\n--- OPTIMIZED Backtest Complete ---');
      console.log('Performance improvement achieved through precalculated indicators!');
    })
    .catch(error => {
      console.error('Backtest failed:', error);
      process.exit(1);
    });
}

module.exports = { runBacktest };
