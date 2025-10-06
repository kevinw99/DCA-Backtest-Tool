/**
 * Performance Calculator Service
 *
 * Comprehensive performance metrics calculation for DCA trading strategies
 * with proper handling of variable capital deployment over time.
 */

class PerformanceCalculatorService {
  constructor(riskFreeRate = 0.04) {
    this.riskFreeRate = riskFreeRate; // Default 4% annual risk-free rate
  }

  /**
   * Calculate comprehensive performance metrics for a backtest
   * @param {Object} backtestData - Backtest data including daily values, trades, etc.
   * @returns {Object} Comprehensive performance metrics
   */
  calculateComprehensiveMetrics(backtestData) {
    const {
      dailyPortfolioValues = [],
      dailyCapitalDeployed = [],
      trades = [],
      maxExposure = 0,
      startDate = null,
      endDate = null
    } = backtestData;

    // Validate inputs
    if (dailyPortfolioValues.length === 0) {
      return this._getEmptyMetrics();
    }

    const initialValue = dailyPortfolioValues[0];
    const finalValue = dailyPortfolioValues[dailyPortfolioValues.length - 1];
    const totalDays = dailyPortfolioValues.length;
    const totalYears = totalDays / 252; // Trading days

    // Core performance metrics
    const totalReturn = initialValue > 0 ? (finalValue - initialValue) / initialValue : 0;
    const totalPNL = finalValue - initialValue;
    const cagr = this._calculateCAGR(initialValue, finalValue, totalYears);

    // Capital deployment analysis
    const maxDeployedCapital = Math.max(...dailyCapitalDeployed, 0);
    const avgDeployedCapital = this._calculateAverage(dailyCapitalDeployed);
    const returnOnMaxDeployed = maxDeployedCapital > 0
      ? totalPNL / maxDeployedCapital
      : 0;
    const returnOnAvgDeployed = avgDeployedCapital > 0
      ? totalPNL / avgDeployedCapital
      : 0;

    // CAGR for capital-based returns
    const cagrOnMaxDeployed = this._calculateCAGR(maxDeployedCapital, finalValue, totalYears);
    const cagrOnAvgDeployed = this._calculateCAGR(avgDeployedCapital, finalValue, totalYears);

    // Capital utilization
    const capitalUtilization = maxExposure > 0
      ? avgDeployedCapital / maxExposure
      : 0;

    // Calculate daily returns
    const dailyReturns = this._calculateDailyReturns(dailyPortfolioValues);

    // Risk-adjusted metrics
    const sharpeRatio = this._calculateSharpe(dailyReturns);
    const sortinoRatio = this._calculateSortino(dailyReturns);

    // Drawdown analysis
    const drawdownAnalysis = this._calculateDrawdownAnalysis(dailyPortfolioValues);
    const calmarRatio = drawdownAnalysis.maxDrawdown > 0
      ? cagr / drawdownAnalysis.maxDrawdown
      : 0;

    // Trading efficiency metrics
    const tradingMetrics = this._calculateTradingMetrics(trades);

    // Time-weighted return
    const timeWeightedReturn = this._calculateTimeWeightedReturn(
      dailyPortfolioValues,
      dailyCapitalDeployed
    );

    // Opportunity cost analysis
    const opportunityCostAnalysis = this._calculateOpportunityCost(
      dailyCapitalDeployed,
      maxExposure
    );

    // Log detailed calculation breakdown
    console.log('\n📊 ========== PERFORMANCE METRICS CALCULATION BREAKDOWN ==========');
    console.log('\n📈 INPUT VALUES:');
    console.log(`   Initial Portfolio Value: $${initialValue.toFixed(2)}`);
    console.log(`   Final Portfolio Value: $${finalValue.toFixed(2)}`);
    console.log(`   Max Capital Deployed: $${maxDeployedCapital.toFixed(2)}`);
    console.log(`   Avg Capital Deployed: $${avgDeployedCapital.toFixed(2)}`);
    console.log(`   Max Exposure (Available): $${maxExposure.toFixed(2)}`);
    console.log(`   Total Days: ${totalDays} (${totalYears.toFixed(2)} years)`);
    console.log(`   Number of Trades: ${trades.length}`);

    console.log('\n💰 RETURNS CALCULATIONS:');
    console.log(`   Total Return = (Final - Initial) / Initial`);
    console.log(`              = ($${finalValue.toFixed(2)} - $${initialValue.toFixed(2)}) / $${initialValue.toFixed(2)}`);
    console.log(`              = $${(finalValue - initialValue).toFixed(2)} / $${initialValue.toFixed(2)}`);
    console.log(`              = ${totalReturn.toFixed(4)} = ${(totalReturn * 100).toFixed(2)}%`);

    console.log(`\n   CAGR = (Final / Initial)^(1/Years) - 1`);
    console.log(`        = ($${finalValue.toFixed(2)} / $${initialValue.toFixed(2)})^(1/${totalYears.toFixed(2)}) - 1`);
    console.log(`        = ${(finalValue/initialValue).toFixed(4)}^${(1/totalYears).toFixed(4)} - 1`);
    console.log(`        = ${(cagr + 1).toFixed(4)} - 1`);
    console.log(`        = ${cagr.toFixed(4)} = ${(cagr * 100).toFixed(2)}%`);

    console.log(`\n   Return on Max Deployed = Total PNL / Max Capital`);
    console.log(`                         = ($${finalValue.toFixed(2)} - $${initialValue.toFixed(2)}) / $${maxDeployedCapital.toFixed(2)}`);
    console.log(`                         = $${(finalValue - initialValue).toFixed(2)} / $${maxDeployedCapital.toFixed(2)}`);
    console.log(`                         = ${returnOnMaxDeployed.toFixed(4)} = ${(returnOnMaxDeployed * 100).toFixed(2)}%`);
    console.log(`      CAGR on Max Deployed = (Final / Max Capital)^(1/Years) - 1`);
    console.log(`                          = ($${finalValue.toFixed(2)} / $${maxDeployedCapital.toFixed(2)})^(1/${totalYears.toFixed(2)}) - 1`);
    console.log(`                          = ${cagrOnMaxDeployed.toFixed(4)} = ${(cagrOnMaxDeployed * 100).toFixed(2)}%`);

    console.log(`\n   Return on Avg Deployed = Total PNL / Avg Capital`);
    console.log(`                         = ($${finalValue.toFixed(2)} - $${initialValue.toFixed(2)}) / $${avgDeployedCapital.toFixed(2)}`);
    console.log(`                         = $${(finalValue - initialValue).toFixed(2)} / $${avgDeployedCapital.toFixed(2)}`);
    console.log(`                         = ${returnOnAvgDeployed.toFixed(4)} = ${(returnOnAvgDeployed * 100).toFixed(2)}%`);
    console.log(`      CAGR on Avg Deployed = (Final / Avg Capital)^(1/Years) - 1`);
    console.log(`                          = ($${finalValue.toFixed(2)} / $${avgDeployedCapital.toFixed(2)})^(1/${totalYears.toFixed(2)}) - 1`);
    console.log(`                          = ${cagrOnAvgDeployed.toFixed(4)} = ${(cagrOnAvgDeployed * 100).toFixed(2)}%`);

    console.log(`\n   Time-Weighted Return = ${timeWeightedReturn.toFixed(4)} = ${(timeWeightedReturn * 100).toFixed(2)}%`);

    console.log('\n📉 RISK METRICS:');
    console.log(`   Sharpe Ratio: ${sharpeRatio.toFixed(3)}`);
    console.log(`      Formula: (Avg Daily Return - Risk Free Rate) / Std Dev * sqrt(252)`);
    console.log(`      Daily Returns: ${dailyReturns.length} periods, Risk-Free: ${(this.riskFreeRate * 100).toFixed(2)}% annual`);
    console.log(`   Sortino Ratio: ${sortinoRatio.toFixed(3)}`);
    console.log(`      Formula: (Avg Daily Return - Risk Free Rate) / Downside Std Dev * sqrt(252)`);
    console.log(`      Only uses negative returns for volatility calculation`);
    console.log(`   Calmar Ratio = CAGR / Max Drawdown (as decimal)`);
    console.log(`                = ${cagr.toFixed(4)} / ${drawdownAnalysis.maxDrawdownPercent.toFixed(4)}`);
    console.log(`                = ${calmarRatio.toFixed(3)}`);
    console.log(`   Max Drawdown: ${(drawdownAnalysis.maxDrawdownPercent * 100).toFixed(2)}% ($${drawdownAnalysis.maxDrawdown.toFixed(2)})`);
    console.log(`   Avg Drawdown: ${(drawdownAnalysis.avgDrawdownPercent * 100).toFixed(2)}%`);

    console.log('\n🎯 TRADING EFFICIENCY:');
    console.log(`   Win Rate: ${(tradingMetrics.winRate * 100).toFixed(2)}%`);
    console.log(`   Profit Factor: ${tradingMetrics.profitFactor.toFixed(3)}`);
    console.log(`   Expectancy: $${tradingMetrics.expectancy.toFixed(2)}`);
    console.log(`   Avg Win: $${tradingMetrics.avgWin.toFixed(2)}`);
    console.log(`   Avg Loss: $${tradingMetrics.avgLoss.toFixed(2)}`);
    console.log(`   Avg Holding Period: ${tradingMetrics.avgHoldingPeriod.toFixed(1)} days`);
    console.log(`   Profit Per Day Held: $${tradingMetrics.profitPerDayHeld.toFixed(2)}`);

    console.log('\n💼 CAPITAL EFFICIENCY:');
    console.log(`   Capital Utilization = Avg Deployed / Max Exposure`);
    console.log(`                      = $${avgDeployedCapital.toFixed(2)} / $${maxExposure.toFixed(2)}`);
    console.log(`                      = ${capitalUtilization.toFixed(4)} = ${(capitalUtilization * 100).toFixed(2)}%`);
    console.log(`   Avg Idle Capital: $${opportunityCostAnalysis.avgIdleCapital.toFixed(2)}`);
    console.log(`   Total Opportunity Cost: $${opportunityCostAnalysis.totalOpportunityCost.toFixed(2)}`);
    console.log(`   Opportunity Cost Adjusted Return: ${(opportunityCostAnalysis.adjustedReturn * 100).toFixed(2)}%`);

    console.log('\n📊 ============================================================\n');

    return {
      // Core Performance
      totalReturn,
      totalReturnPercent: totalReturn * 100,
      cagr,
      cagrPercent: cagr * 100,
      returnOnMaxDeployed,
      returnOnMaxDeployedPercent: returnOnMaxDeployed * 100,
      cagrOnMaxDeployed,
      cagrOnMaxDeployedPercent: cagrOnMaxDeployed * 100,
      returnOnAvgDeployed,
      returnOnAvgDeployedPercent: returnOnAvgDeployed * 100,
      cagrOnAvgDeployed,
      cagrOnAvgDeployedPercent: cagrOnAvgDeployed * 100,

      // Risk-Adjusted Metrics
      sharpeRatio,
      sortinoRatio,
      calmarRatio,

      // Drawdown Analysis
      maxDrawdown: drawdownAnalysis.maxDrawdown,
      maxDrawdownPercent: drawdownAnalysis.maxDrawdownPercent,
      avgDrawdown: drawdownAnalysis.avgDrawdown,
      avgDrawdownPercent: drawdownAnalysis.avgDrawdownPercent,
      maxDrawdownDuration: drawdownAnalysis.maxDrawdownDuration,

      // Trading Efficiency
      winRate: tradingMetrics.winRate,
      winRatePercent: tradingMetrics.winRate * 100,
      profitFactor: tradingMetrics.profitFactor,
      expectancy: tradingMetrics.expectancy,
      avgWin: tradingMetrics.avgWin,
      avgLoss: tradingMetrics.avgLoss,
      avgHoldingPeriod: tradingMetrics.avgHoldingPeriod,
      profitPerDayHeld: tradingMetrics.profitPerDayHeld,

      // Capital Metrics
      capitalUtilization,
      capitalUtilizationPercent: capitalUtilization * 100,
      avgDeployedCapital,
      maxDeployedCapital,

      // Time-Weighted Analysis
      timeWeightedReturn,
      timeWeightedReturnPercent: timeWeightedReturn * 100,

      // Opportunity Cost
      opportunityCost: opportunityCostAnalysis.totalOpportunityCost,
      avgIdleCapital: opportunityCostAnalysis.avgIdleCapital,
      opportunityCostAdjustedReturn: opportunityCostAnalysis.adjustedReturn,
      opportunityCostAdjustedReturnPercent: opportunityCostAnalysis.adjustedReturn * 100
    };
  }

  /**
   * Calculate CAGR (Compound Annual Growth Rate)
   */
  _calculateCAGR(initialValue, finalValue, years) {
    if (initialValue <= 0 || years <= 0) return 0;
    return Math.pow(finalValue / initialValue, 1 / years) - 1;
  }

  /**
   * Calculate average of an array
   */
  _calculateAverage(arr) {
    if (!arr || arr.length === 0) return 0;
    const sum = arr.reduce((a, b) => a + b, 0);
    return sum / arr.length;
  }

  /**
   * Calculate daily returns from portfolio values
   */
  _calculateDailyReturns(portfolioValues) {
    const returns = [];
    for (let i = 1; i < portfolioValues.length; i++) {
      if (portfolioValues[i - 1] > 0) {
        const dailyReturn = (portfolioValues[i] - portfolioValues[i - 1]) / portfolioValues[i - 1];
        returns.push(dailyReturn);
      } else {
        returns.push(0);
      }
    }
    return returns;
  }

  /**
   * Calculate Sharpe Ratio
   */
  _calculateSharpe(dailyReturns) {
    if (!dailyReturns || dailyReturns.length === 0) return 0;

    const dailyRiskFreeRate = this.riskFreeRate / 252;
    const excessReturns = dailyReturns.map(r => r - dailyRiskFreeRate);
    const avgExcessReturn = this._calculateAverage(excessReturns);
    const stdDev = this._calculateStdDev(excessReturns);

    if (stdDev === 0) return 0;

    // Annualize: multiply by sqrt(252) for daily returns
    return (avgExcessReturn / stdDev) * Math.sqrt(252);
  }

  /**
   * Calculate Sortino Ratio (only penalize downside volatility)
   */
  _calculateSortino(dailyReturns) {
    if (!dailyReturns || dailyReturns.length === 0) return 0;

    const dailyRiskFreeRate = this.riskFreeRate / 252;
    const excessReturns = dailyReturns.map(r => r - dailyRiskFreeRate);
    const avgExcessReturn = this._calculateAverage(excessReturns);

    // Only consider negative returns for downside deviation
    const downsideReturns = excessReturns.filter(r => r < 0);
    if (downsideReturns.length === 0) {
      // No downside, return a high Sortino ratio
      return avgExcessReturn > 0 ? 999 : 0;
    }

    const downsideDeviation = this._calculateStdDev(downsideReturns);
    if (downsideDeviation === 0) return 0;

    // Annualize
    return (avgExcessReturn / downsideDeviation) * Math.sqrt(252);
  }

  /**
   * Calculate standard deviation
   */
  _calculateStdDev(arr) {
    if (!arr || arr.length === 0) return 0;
    const avg = this._calculateAverage(arr);
    const squaredDiffs = arr.map(x => Math.pow(x - avg, 2));
    const variance = this._calculateAverage(squaredDiffs);
    return Math.sqrt(variance);
  }

  /**
   * Calculate comprehensive drawdown analysis
   */
  _calculateDrawdownAnalysis(portfolioValues) {
    if (!portfolioValues || portfolioValues.length === 0) {
      return {
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        avgDrawdown: 0,
        avgDrawdownPercent: 0,
        maxDrawdownDuration: 0
      };
    }

    let peak = portfolioValues[0];
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    const drawdowns = [];
    let currentDrawdownStart = null;
    let currentDrawdownDuration = 0;
    let maxDrawdownDuration = 0;

    for (let i = 1; i < portfolioValues.length; i++) {
      const value = portfolioValues[i];

      if (value > peak) {
        // New peak - end of drawdown period if there was one
        if (currentDrawdownStart !== null) {
          maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDrawdownDuration);
          currentDrawdownStart = null;
          currentDrawdownDuration = 0;
        }
        peak = value;
      } else if (value < peak) {
        // In drawdown
        const drawdown = peak - value;
        const drawdownPercent = drawdown / peak;

        if (drawdownPercent > 0) {
          drawdowns.push(drawdownPercent);

          if (currentDrawdownStart === null) {
            currentDrawdownStart = i;
            currentDrawdownDuration = 1;
          } else {
            currentDrawdownDuration++;
          }
        }

        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
          maxDrawdownPercent = drawdownPercent;
        }
      }
    }

    // Handle ongoing drawdown
    if (currentDrawdownStart !== null) {
      maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDrawdownDuration);
    }

    const avgDrawdownPercent = drawdowns.length > 0
      ? this._calculateAverage(drawdowns)
      : 0;

    return {
      maxDrawdown,
      maxDrawdownPercent,
      avgDrawdown: avgDrawdownPercent * peak,
      avgDrawdownPercent,
      maxDrawdownDuration
    };
  }

  /**
   * Calculate trading efficiency metrics
   */
  _calculateTradingMetrics(trades) {
    if (!trades || trades.length === 0) {
      return {
        winRate: 0,
        profitFactor: 0,
        expectancy: 0,
        avgWin: 0,
        avgLoss: 0,
        avgHoldingPeriod: 0,
        profitPerDayHeld: 0
      };
    }

    const profitableTrades = trades.filter(t => t.profit > 0);
    const losingTrades = trades.filter(t => t.profit < 0);

    const winRate = trades.length > 0 ? profitableTrades.length / trades.length : 0;

    const grossProfits = profitableTrades.reduce((sum, t) => sum + t.profit, 0);
    const grossLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
    const profitFactor = grossLosses > 0 ? grossProfits / grossLosses : 0;

    const avgWin = profitableTrades.length > 0
      ? grossProfits / profitableTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? grossLosses / losingTrades.length
      : 0;

    const lossRate = 1 - winRate;
    const expectancy = (winRate * avgWin) - (lossRate * avgLoss);

    // Calculate average holding period
    let totalHoldingDays = 0;
    let totalPositionDays = 0;
    let totalProfit = 0;

    trades.forEach(trade => {
      if (trade.entryDate && trade.exitDate) {
        const entryDate = new Date(trade.entryDate);
        const exitDate = new Date(trade.exitDate);
        const holdingDays = Math.max(1, Math.floor((exitDate - entryDate) / (1000 * 60 * 60 * 24)));

        totalHoldingDays += holdingDays;

        // For profit per day calculation, weight by position size
        const positionSize = trade.shares || 1;
        totalPositionDays += holdingDays * positionSize;
        totalProfit += trade.profit || 0;
      }
    });

    const avgHoldingPeriod = trades.length > 0 ? totalHoldingDays / trades.length : 0;
    const profitPerDayHeld = totalPositionDays > 0 ? totalProfit / totalPositionDays : 0;

    return {
      winRate,
      profitFactor,
      expectancy,
      avgWin,
      avgLoss,
      avgHoldingPeriod,
      profitPerDayHeld
    };
  }

  /**
   * Calculate time-weighted return accounting for variable capital deployment
   */
  _calculateTimeWeightedReturn(portfolioValues, capitalDeployed) {
    if (!portfolioValues || portfolioValues.length === 0) return 0;
    if (!capitalDeployed || capitalDeployed.length === 0) return 0;

    // Identify capital deployment change events
    const events = [];
    for (let i = 1; i < capitalDeployed.length; i++) {
      if (Math.abs(capitalDeployed[i] - capitalDeployed[i - 1]) > 0.01) {
        events.push(i);
      }
    }

    // If no deployment changes, use simple return
    if (events.length === 0) {
      const initialValue = portfolioValues[0];
      const finalValue = portfolioValues[portfolioValues.length - 1];
      return initialValue > 0 ? (finalValue - initialValue) / initialValue : 0;
    }

    // Calculate sub-period returns
    let compoundedReturn = 1;
    let startIdx = 0;

    for (let i = 0; i <= events.length; i++) {
      const endIdx = i < events.length ? events[i] : portfolioValues.length - 1;

      if (endIdx > startIdx) {
        const startValue = portfolioValues[startIdx];
        const endValue = portfolioValues[endIdx];

        if (startValue > 0) {
          const subPeriodReturn = (endValue - startValue) / startValue;
          compoundedReturn *= (1 + subPeriodReturn);
        }
      }

      startIdx = endIdx;
    }

    return compoundedReturn - 1;
  }

  /**
   * Calculate opportunity cost of idle capital
   */
  _calculateOpportunityCost(capitalDeployed, maxExposure) {
    if (!capitalDeployed || capitalDeployed.length === 0 || maxExposure === 0) {
      return {
        totalOpportunityCost: 0,
        avgIdleCapital: 0,
        adjustedReturn: 0
      };
    }

    const dailyRiskFreeRate = this.riskFreeRate / 252;
    let totalOpportunityCost = 0;
    let totalIdleCapital = 0;

    for (let i = 0; i < capitalDeployed.length; i++) {
      const deployed = capitalDeployed[i];
      const idle = Math.max(0, maxExposure - deployed);
      totalIdleCapital += idle;

      // What idle capital could have earned at risk-free rate
      totalOpportunityCost += idle * dailyRiskFreeRate;
    }

    const avgIdleCapital = capitalDeployed.length > 0
      ? totalIdleCapital / capitalDeployed.length
      : 0;

    // Adjusted return includes what idle capital earned
    const adjustedReturn = totalOpportunityCost / maxExposure;

    return {
      totalOpportunityCost,
      avgIdleCapital,
      adjustedReturn
    };
  }

  /**
   * Get empty metrics object for invalid input
   */
  _getEmptyMetrics() {
    return {
      totalReturn: 0,
      totalReturnPercent: 0,
      cagr: 0,
      cagrPercent: 0,
      returnOnMaxDeployed: 0,
      returnOnMaxDeployedPercent: 0,
      returnOnAvgDeployed: 0,
      returnOnAvgDeployedPercent: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      avgDrawdown: 0,
      avgDrawdownPercent: 0,
      maxDrawdownDuration: 0,
      winRate: 0,
      winRatePercent: 0,
      profitFactor: 0,
      expectancy: 0,
      avgWin: 0,
      avgLoss: 0,
      avgHoldingPeriod: 0,
      profitPerDayHeld: 0,
      capitalUtilization: 0,
      capitalUtilizationPercent: 0,
      avgDeployedCapital: 0,
      maxDeployedCapital: 0,
      timeWeightedReturn: 0,
      timeWeightedReturnPercent: 0,
      opportunityCost: 0,
      avgIdleCapital: 0,
      opportunityCostAdjustedReturn: 0,
      opportunityCostAdjustedReturnPercent: 0
    };
  }
}

module.exports = PerformanceCalculatorService;
