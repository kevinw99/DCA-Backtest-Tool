import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Clock, Eye, EyeOff, AlertTriangle, Settings } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Scatter,
  Legend
} from 'recharts';

const BacktestResults = ({ data, chartData: priceData }) => {
  const [visibleIndicators, setVisibleIndicators] = useState({
    ma20: true,
    ma50: true,
    ma200: false,
    rsi: false,
    volatility: false
  });

  // Process chart data with transaction markers - moved before conditional return
  const processedChartData = useMemo(() => {
    if (!data || !priceData?.dailyPrices) return [];

    const { transactions, enhancedTransactions, buyAndHoldResults, summary } = data;
    const lotSizeUsd = priceData?.backtestParameters?.lotSizeUsd || 10000;

    // Debug the available transactions
    console.log('🔍 BacktestResults Debug - Available transactions:', {
      transactions: transactions?.length || 0,
      enhancedTransactions: enhancedTransactions?.length || 0,
      firstFewTransactions: transactions?.slice(0, 3),
      firstFewEnhanced: enhancedTransactions?.slice(0, 3)
    });

    // Use the enhanced transactions which have more details
    const transactionsToUse = enhancedTransactions?.length > 0 ? enhancedTransactions : transactions || [];

    // Create transaction map by date
    const transactionMap = transactionsToUse.reduce((acc, transaction) => {
      acc[transaction.date] = transaction;
      return acc;
    }, {});

    // Get start price for Buy & Hold calculation
    const startPrice = parseFloat(priceData.dailyPrices[0]?.adjusted_close || priceData.dailyPrices[0]?.close || 0);

    // Check if this is short selling strategy
    const isShortSelling = summary?.strategy === 'SHORT_DCA';

    return priceData.dailyPrices.map(day => {
      const transaction = transactionMap[day.date];
      const currentPrice = parseFloat(day.adjusted_close || day.close || 0);

      // Calculate Total P&L % and Total P&L for this day
      let totalPNLPercent = null;
      let totalPNL = null;
      let totalCapitalDeployed = 0;

      if (transaction) {
        // Use transaction's portfolio state - handle both long and short positions
        const currentLots = transaction.lotsAfterTransaction ? transaction.lotsAfterTransaction.length :
                           (transaction.shortsAfterTransaction ? transaction.shortsAfterTransaction.length : 0);
        totalCapitalDeployed = currentLots * lotSizeUsd;

        // Use totalPNL directly from transaction (matches Enhanced Transaction History table)
        totalPNL = transaction.totalPNL || 0;

        if (totalCapitalDeployed > 0) {
          totalPNLPercent = (totalPNL / totalCapitalDeployed) * 100;
        }
      } else {
        // Find most recent transaction for capital deployed calculation
        let mostRecentTransaction = null;
        for (let i = transactionsToUse.length - 1; i >= 0; i--) {
          if (new Date(transactionsToUse[i].date) <= new Date(day.date)) {
            mostRecentTransaction = transactionsToUse[i];
            break;
          }
        }

        if (mostRecentTransaction) {
          const currentLots = mostRecentTransaction.lotsAfterTransaction ? mostRecentTransaction.lotsAfterTransaction.length :
                             (mostRecentTransaction.shortsAfterTransaction ? mostRecentTransaction.shortsAfterTransaction.length : 0);
          totalCapitalDeployed = currentLots * lotSizeUsd;

          // Calculate current portfolio state for non-transaction days
          let unrealizedPNL = 0;
          const positions = mostRecentTransaction.lotsAfterTransaction || mostRecentTransaction.shortsAfterTransaction;
          if (positions) {
            unrealizedPNL = positions.reduce((total, position) => {
              const shares = lotSizeUsd / position.price;
              if (mostRecentTransaction.shortsAfterTransaction) {
                // Short position P&L = (short price - current price) * shares
                const positionPNL = (position.price - currentPrice) * shares;
                return total + positionPNL;
              } else {
                // Long position P&L = (current price - purchase price) * shares
                const positionPNL = (currentPrice - position.price) * shares;
                return total + positionPNL;
              }
            }, 0);
          }

          totalPNL = unrealizedPNL + (mostRecentTransaction.realizedPNL || 0);

          if (totalCapitalDeployed > 0) {
            totalPNLPercent = (totalPNL / totalCapitalDeployed) * 100;
          }
        }
      }

      // Calculate Buy & Hold P&L % (simple percentage change from start)
      const buyAndHoldPercent = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;

      return {
        date: day.date,
        price: currentPrice,
        ma20: day.ma_20,
        ma50: day.ma_50,
        ma200: day.ma_200,
        rsi: day.rsi_14,
        volatility: day.volatility_20 ? day.volatility_20 * 100 : null,
        transaction: transaction,

        // P&L percentages for dual Y-axis
        totalPNLPercent: totalPNLPercent,
        totalPNL: totalPNL,
        buyAndHoldPercent: buyAndHoldPercent,

        // Different buy markers based on transaction type
        // Transaction markers - only relevant ones based on strategy mode
        // For short selling: Short entry (SHORT + TRAILING_STOP_LIMIT_SHORT), Cover, Emergency Cover
        trailingStopShortMarker: (transaction?.type === 'TRAILING_STOP_LIMIT_SHORT' || transaction?.type === 'SHORT') ? currentPrice : null,
        coverMarker: (transaction?.type === 'COVER') ? currentPrice : null,
        emergencyCoverMarker: (transaction?.type === 'EMERGENCY_COVER') ? currentPrice : null,

        // For long DCA: only relevant markers
        trailingStopBuyMarker: (transaction?.type === 'TRAILING_STOP_LIMIT_BUY') ? currentPrice : null,
        trailingStopSellMarker: (transaction?.type === 'SELL') ? currentPrice : null
      };
    });
  }, [data, priceData]);

  if (!data) {
    return <div>No backtest results available</div>;
  }

  const {
    summary,
    transactions,
    dailyPrices,
    lots = [], // Default to empty array for short selling
    shorts = [], // Current short positions for short selling strategy
    transactionLog = [], // Default to empty array for short selling
    enhancedTransactions,
    tradeAnalysis = {}, // Default to empty object for short selling
    buyAndHoldResults = {}, // Default to empty object for long strategy
    shortAndHoldResults = {}, // Default to empty object for short selling strategy
    outperformance,
    outperformancePercent,
    questionableEvents = [] // Default to empty array for short selling
  } = data;

  // Use shortAndHoldResults for short selling strategy, buyAndHoldResults for long strategy
  const holdResults = summary?.strategy === 'SHORT_DCA' ? shortAndHoldResults : buyAndHoldResults;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Format decimal parameter values (e.g., 0.1 = 10%) as display percentages
  const formatParameterPercent = (value) => {
    if (value === undefined || value === null) return 'N/A';
    const percentValue = value * 100; // Convert decimal to percentage
    return `${percentValue >= 0 ? '+' : ''}${percentValue.toFixed(2)}%`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit'
    });
  };

  const toggleIndicator = (indicator) => {
    setVisibleIndicators(prev => ({
      ...prev,
      [indicator]: !prev[indicator]
    }));
  };

  // Check if this is short selling strategy for the component
  const isShortSellingStrategy = summary?.strategy === 'SHORT_DCA';

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      return (
        <div className="chart-tooltip">
          <p className="tooltip-date">{formatDate(label)}</p>
          <p className="tooltip-price">Price: {formatCurrency(parseFloat(data.price) || 0)}</p>

          {data.totalPNLPercent !== null && !isShortSellingStrategy && (
            <p className={`tooltip-pnl ${data.totalPNLPercent >= 0 ? 'positive' : 'negative'}`}>
              Total P&L %: {data.totalPNLPercent.toFixed(2)}%
            </p>
          )}

          {data.totalPNL !== null && isShortSellingStrategy && (
            <p className={`tooltip-pnl ${data.totalPNL >= 0 ? 'positive' : 'negative'}`}>
              Total P&L: {formatCurrency(data.totalPNL)}
            </p>
          )}

          <p className={`tooltip-bnh ${data.buyAndHoldPercent >= 0 ? 'positive' : 'negative'}`}>
            Buy & Hold %: {data.buyAndHoldPercent.toFixed(2)}%
          </p>

          {data.transaction && (
            <div>
              <p className={`tooltip-transaction ${data.transaction.type.toLowerCase()}`}>
                {data.transaction.type}: {formatCurrency(parseFloat(data.transaction.price) || 0)}
              </p>
              {data.transaction.ocoOrderDetail && (
                <p className="tooltip-oco">
                  OCO: {data.transaction.ocoOrderDetail.type}
                  {data.transaction.ocoOrderDetail.triggerPrice && ` @ ${formatCurrency(data.transaction.ocoOrderDetail.triggerPrice)}`}
                </p>
              )}
            </div>
          )}

          {/* MA indicators removed from tooltip */}
          {visibleIndicators.rsi && data.rsi && (
            <p className="tooltip-indicator">RSI: {data.rsi !== undefined ? data.rsi.toFixed(1) : 'N/A'}</p>
          )}
        </div>
      );
    }
    return null;
  };

  const getMetricClass = (value) => {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return '';
  };

  const formatLots = (lots) => {
    if (!lots || lots.length === 0) return 'None';
    return lots.map(lot => {
      const price = lot.price !== undefined ? lot.price.toFixed(2) : 'N/A';
      return `$${price}`;
    }).join(', ');
  };

  const formatTrailingStopBuyDetails = (trailingDetail) => {
    if (!trailingDetail) return '';

    const details = [];

    // Recent peak reference (limit price)
    if (trailingDetail.limitPrice !== undefined) {
      details.push(`Limit: $${trailingDetail.limitPrice.toFixed(2)}`);
    }

    // Last update price (actual bottom price when order was last updated)
    if (trailingDetail.lastUpdatePrice !== undefined) {
      details.push(`Bottom: $${trailingDetail.lastUpdatePrice.toFixed(2)}`);
    }

    // Stop price
    if (trailingDetail.stopPrice !== undefined) {
      details.push(`Stop: $${trailingDetail.stopPrice.toFixed(2)}`);
    }

    return (
      <div className="trailing-stop-details-multiline">
        {details.map((detail, index) => (
          <div key={index} className="trailing-stop-detail-line">{detail}</div>
        ))}
      </div>
    );
  };

  const formatTrailingStopSellDetails = (trailingDetail) => {
    if (!trailingDetail) return '';

    const details = [];

    // Recent bottom reference
    if (trailingDetail.recentBottomReference !== undefined) {
      details.push(`Bottom: $${trailingDetail.recentBottomReference.toFixed(2)}`);
    }

    // Last update price (actual peak price when order was last updated)
    if (trailingDetail.lastUpdatePrice !== undefined) {
      details.push(`Peak: $${trailingDetail.lastUpdatePrice.toFixed(2)}`);
    }

    // Stop price
    if (trailingDetail.stopPrice !== undefined) {
      details.push(`Stop: $${trailingDetail.stopPrice.toFixed(2)}`);
    }

    // Limit price
    if (trailingDetail.limitPrice !== undefined) {
      details.push(`Limit: $${trailingDetail.limitPrice.toFixed(2)}`);
    }

    return (
      <div className="trailing-stop-details-multiline">
        {details.map((detail, index) => (
          <div key={index} className="trailing-stop-detail-line">{detail}</div>
        ))}
      </div>
    );
  };

  const prepareChartData = () => {
    // Use price data from priceData (chart data) or fallback to dailyPrices from backtest results
    const pricesData = priceData?.dailyPrices || dailyPrices || [];
    if (!pricesData || pricesData.length === 0) return [];

    // Use enhanced transactions which have complete portfolio state
    const transactionsToUse = enhancedTransactions?.length > 0 ? enhancedTransactions : transactions || [];

    // Get parameters from backtest data
    const maxLots = priceData?.backtestParameters?.maxLots || summary?.maxLots || 10;
    const lotSizeUsd = priceData?.backtestParameters?.lotSizeUsd || summary?.lotSizeUsd || 10000;

    // Create a map of transaction dates to get the enhanced transaction data for each day
    const transactionMap = new Map();
    transactionsToUse.forEach(transaction => {
      transactionMap.set(transaction.date, transaction);
    });

    return pricesData.map((daily) => {
      const date = daily.date;
      const currentPrice = parseFloat(daily.adjusted_close || daily.close || 0);
      const transaction = transactionMap.get(date);

      // If there's a transaction on this date, use its calculated portfolio state
      if (transaction) {
        // Get the number of positions from lotsAfterTransaction or shortsAfterTransaction
        const currentLots = transaction.lotsAfterTransaction ? transaction.lotsAfterTransaction.length :
                           (transaction.shortsAfterTransaction ? transaction.shortsAfterTransaction.length : 0);

        // Calculate holdings value by summing each position's current value
        let holdingsMarketValue = 0;
        const positions = transaction.lotsAfterTransaction || transaction.shortsAfterTransaction;
        if (positions) {
          holdingsMarketValue = positions.reduce((total, position) => {
            const shares = lotSizeUsd / position.price; // shares = $10,000 / purchase price
            if (transaction.shortsAfterTransaction) {
              // For short positions, holdings value = current market value of shorted shares
              // This represents what we would need to pay to close the short positions
              return total + (shares * currentPrice);
            } else {
              // Long position value = current market value
              return total + (shares * currentPrice);
            }
          }, 0);
        }

        // Available cash = (maxLots - currentLots) × $10,000
        const availableCash = (maxLots - currentLots) * lotSizeUsd;

        // Break-even value: for longs = capital invested, for shorts = total short entry value
        const breakEvenValue = transaction.shortsAfterTransaction ?
          positions.reduce((total, position) => total + lotSizeUsd, 0) : // Sum of all short entry values
          currentLots * lotSizeUsd; // Capital invested for longs

        // Use Total P&L directly from Enhanced Transaction History (same as transaction.totalPNL)
        const cumulativeRealizedPNL = transaction.realizedPNL || 0;
        const totalPNL = transaction.totalPNL || 0;

        return {
          date: new Date(date).toLocaleDateString(),
          totalPNL: totalPNL,
          holdingsValue: holdingsMarketValue,
          realizedPNL: cumulativeRealizedPNL,
          breakEvenValue: breakEvenValue,
          stockPrice: currentPrice,
          currentLots: currentLots,
          hasBuy: transaction && ['BUY', 'INITIAL_BUY', 'TRAILING_STOP_LIMIT_BUY'].includes(transaction.type),
          hasSell: transaction && transaction.type === 'SELL'
        };
      }

      // For days without transactions, we need to calculate using the most recent transaction state
      // Find the most recent transaction before this date
      let mostRecentTransaction = null;
      for (let i = transactionsToUse.length - 1; i >= 0; i--) {
        if (new Date(transactionsToUse[i].date) <= new Date(date)) {
          mostRecentTransaction = transactionsToUse[i];
          break;
        }
      }

      if (mostRecentTransaction) {
        const currentLots = mostRecentTransaction.lotsAfterTransaction ? mostRecentTransaction.lotsAfterTransaction.length :
                           (mostRecentTransaction.shortsAfterTransaction ? mostRecentTransaction.shortsAfterTransaction.length : 0);

        // Calculate holdings value using current price but most recent position configuration
        let holdingsMarketValue = 0;
        const positions = mostRecentTransaction.lotsAfterTransaction || mostRecentTransaction.shortsAfterTransaction;
        if (positions) {
          holdingsMarketValue = positions.reduce((total, position) => {
            const shares = lotSizeUsd / position.price;
            if (mostRecentTransaction.shortsAfterTransaction) {
              // For short positions, holdings value = current market value of shorted shares
              // This represents what we would need to pay to close the short positions
              return total + (shares * currentPrice);
            } else {
              // Long position value = current market value
              return total + (shares * currentPrice);
            }
          }, 0);
        }

        // Break-even value: for longs = capital invested, for shorts = total short entry value
        const breakEvenValue = mostRecentTransaction.shortsAfterTransaction ?
          positions.reduce((total, position) => total + lotSizeUsd, 0) : // Sum of all short entry values
          currentLots * lotSizeUsd; // Capital invested for longs
        const cumulativeRealizedPNL = mostRecentTransaction.realizedPNL || 0;
        // For non-transaction days, calculate P&L the same way but using current price
        const unrealizedPNL = mostRecentTransaction.shortsAfterTransaction ?
          // For shorts: P&L = (short entry value - current market value)
          breakEvenValue - holdingsMarketValue :
          // For longs: P&L = (current market value - capital invested)
          holdingsMarketValue - breakEvenValue;
        const totalPNL = unrealizedPNL + cumulativeRealizedPNL;

        return {
          date: new Date(date).toLocaleDateString(),
          totalPNL: totalPNL,
          holdingsValue: holdingsMarketValue,
          realizedPNL: cumulativeRealizedPNL,
          breakEvenValue: breakEvenValue,
          stockPrice: currentPrice,
          currentLots: currentLots,
          hasBuy: false,
          hasSell: false
        };
      }

      // If no transactions have occurred yet, start with initial state

      const hasBuy = transaction && ['BUY', 'INITIAL_BUY', 'TRAILING_STOP_LIMIT_BUY'].includes(transaction.type);
      const hasSell = transaction && transaction.type === 'SELL';

      return {
        date: new Date(date).toLocaleDateString(),
        totalPNL: 0,
        holdingsValue: 0,
        realizedPNL: 0,
        breakEvenValue: 0,
        stockPrice: currentPrice,
        currentLots: 0,
        hasBuy: false,
        hasSell: false
      };
    });
  };

  const chartData = prepareChartData();

  return (
    <div className="results-container">
      <h2 className="results-title">
        <BarChart3 size={24} />
        Backtest Results for {summary.symbol}
      </h2>

      {/* Backtest Parameters Section */}
      {priceData?.backtestParameters && (
        <div className="parameters-section">
          <h3>
            <Settings size={20} />
            Backtest Parameters
          </h3>
          <div className="parameters-grid">
            <div className="parameter-card">
              <span className="parameter-label">Symbol</span>
              <span className="parameter-value">{priceData.backtestParameters.symbol}</span>
            </div>
            <div className="parameter-card">
              <span className="parameter-label">Date Range</span>
              <span className="parameter-value">
                {priceData.backtestParameters.startDate} to {priceData.backtestParameters.endDate}
              </span>
            </div>
            <div className="parameter-card">
              <span className="parameter-label">Lot Size (USD)</span>
              <span className="parameter-value">{formatCurrency(priceData.backtestParameters.lotSizeUsd)}</span>
            </div>
            {summary.strategy === 'SHORT_DCA' ? (
              <>
                <div className="parameter-card">
                  <span className="parameter-label">Max Shorts</span>
                  <span className="parameter-value">{priceData.backtestParameters.maxShorts || 'N/A'}</span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">Max Shorts to Cover</span>
                  <span className="parameter-value">{priceData.backtestParameters.maxShortsToCovers || 'N/A'}</span>
                </div>
              </>
            ) : (
              <>
                <div className="parameter-card">
                  <span className="parameter-label">Max Lots</span>
                  <span className="parameter-value">{priceData.backtestParameters.maxLots}</span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">Max Lots to Sell</span>
                  <span className="parameter-value">{priceData.backtestParameters.maxLotsToSell}</span>
                </div>
              </>
            )}
            <div className="parameter-card">
              <span className="parameter-label">Grid Interval</span>
              <span className="parameter-value">{formatParameterPercent(priceData.backtestParameters.gridIntervalPercent)}</span>
            </div>
            <div className="parameter-card">
              <span className="parameter-label">Profit Requirement</span>
              <span className="parameter-value">{formatParameterPercent(priceData.backtestParameters.profitRequirement)}</span>
            </div>
            {/* Conditional parameter display based on strategy */}
            {summary.strategy === 'SHORT_DCA' ? (
              // Short selling parameters
              <>
                <div className="parameter-card">
                  <span className="parameter-label">Trailing Short Activation</span>
                  <span className="parameter-value">{formatParameterPercent(priceData.backtestParameters.trailingShortActivationPercent || 0)}</span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">Trailing Short Pullback</span>
                  <span className="parameter-value">{formatParameterPercent(priceData.backtestParameters.trailingShortPullbackPercent || 0)}</span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">Trailing Cover Activation</span>
                  <span className="parameter-value">{formatParameterPercent(priceData.backtestParameters.trailingCoverActivationPercent || 0)}</span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">Trailing Cover Rebound</span>
                  <span className="parameter-value">{formatParameterPercent(priceData.backtestParameters.trailingCoverReboundPercent || 0)}</span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">Hard Stop Loss</span>
                  <span className="parameter-value">{formatParameterPercent(priceData.backtestParameters.hardStopLossPercent || 0)}</span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">Portfolio Stop Loss</span>
                  <span className="parameter-value">{formatParameterPercent(priceData.backtestParameters.portfolioStopLossPercent || 0)}</span>
                </div>
              </>
            ) : (
              // Long DCA parameters
              <>
                <div className="parameter-card">
                  <span className="parameter-label">Trailing Buy Activation</span>
                  <span className="parameter-value">{formatParameterPercent(priceData.backtestParameters.trailingBuyActivationPercent || 0)}</span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">Trailing Buy Rebound</span>
                  <span className="parameter-value">{formatParameterPercent(priceData.backtestParameters.trailingBuyReboundPercent || 0)}</span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">Trailing Sell Activation</span>
                  <span className="parameter-value">{formatParameterPercent(priceData.backtestParameters.trailingSellActivationPercent || 0)}</span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">Trailing Sell Pullback</span>
                  <span className="parameter-value">{formatParameterPercent(priceData.backtestParameters.trailingSellPullbackPercent || 0)}</span>
                </div>
              </>
            )}

            {/* Beta Scaling Information */}
            {priceData.backtestParameters.enableBetaScaling && (
              <>
                <div className="parameter-card beta-scaling-card">
                  <span className="parameter-label">Beta Scaling</span>
                  <span className="parameter-value">Enabled</span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">Beta (Yahoo Finance)</span>
                  <span className="parameter-value">{(priceData.backtestParameters.beta || 1.0).toFixed(2)}</span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">Coefficient</span>
                  <span className="parameter-value">{(priceData.backtestParameters.coefficient || 1.0).toFixed(2)}</span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">β-Factor</span>
                  <span className="parameter-value">{(priceData.backtestParameters.betaFactor || 1.0).toFixed(3)}</span>
                </div>
                <div className="parameter-card beta-formula-card">
                  <span className="parameter-label">Formula</span>
                  <span className="parameter-value">
                    {(priceData.backtestParameters.beta || 1.0).toFixed(2)} × {(priceData.backtestParameters.coefficient || 1.0).toFixed(2)} = {(priceData.backtestParameters.betaFactor || 1.0).toFixed(3)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Price Chart Section */}
      {processedChartData.length > 0 && (
        <div className="chart-section">
          <div className="chart-header">
            <h3>
              <TrendingUp size={20} />
              Price Chart with Transaction Markers
            </h3>
            {/* MA indicators removed as requested */}
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={processedChartData} margin={{ top: 20, right: 80, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#666"
              />

              {/* Left Y-axis for Price */}
              <YAxis
                yAxisId="price"
                domain={['dataMin - 10', 'dataMax + 10']}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
                stroke="#666"
                label={{ value: 'Price ($)', angle: -90, position: 'insideLeft' }}
              />

              {/* Right Y-axis for P&L (Percentages for long, Dollar amounts for short) */}
              <YAxis
                yAxisId="percent"
                orientation="right"
                domain={['auto', 'auto']}
                tickFormatter={(value) => isShortSellingStrategy ? `$${(value / 1000).toFixed(0)}k` : `${value.toFixed(0)}%`}
                stroke="#0066cc"
                label={{ value: isShortSellingStrategy ? 'P&L ($)' : 'P&L (%)', angle: 90, position: 'insideRight' }}
              />

              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {/* Price line */}
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="price"
                stroke="#2d3748"
                strokeWidth={2}
                dot={false}
                name="Stock Price"
              />

              {/* P&L lines on right Y-axis - use Total P&L for short selling, Total P&L % for long */}
              <Line
                yAxisId="percent"
                type="monotone"
                dataKey={isShortSellingStrategy ? "totalPNL" : "totalPNLPercent"}
                stroke="#dc2626"
                strokeWidth={3}
                dot={false}
                name={isShortSellingStrategy ? "Total P&L" : "Total P&L %"}
                connectNulls={false}
              />

              <Line
                yAxisId="percent"
                type="monotone"
                dataKey="buyAndHoldPercent"
                stroke="#059669"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
                name="Buy & Hold %"
              />

              {/* MA20 and MA50 indicators removed as requested */}

              {/* Transaction markers - conditional based on strategy */}
              {isShortSellingStrategy ? (
                // Short selling markers
                <>
                  <Scatter
                    yAxisId="price"
                    dataKey="trailingStopShortMarker"
                    fill="#0891b2"
                    shape="star"
                    name="Short Entry"
                  />
                  <Scatter
                    yAxisId="price"
                    dataKey="coverMarker"
                    fill="#10b981"
                    shape="wye"
                    name="Cover"
                  />
                  <Scatter
                    yAxisId="price"
                    dataKey="emergencyCoverMarker"
                    fill="#dc2626"
                    shape="triangle"
                    name="Emergency Cover"
                  />
                </>
              ) : (
                // Long DCA markers
                <>
                  <Scatter
                    yAxisId="price"
                    dataKey="trailingStopBuyMarker"
                    fill="#0891b2"
                    shape="star"
                    name="Buy"
                  />
                  <Scatter
                    yAxisId="price"
                    dataKey="trailingStopSellMarker"
                    fill="#b91c1c"
                    shape="wye"
                    name="Trailing Stop Sell"
                  />
                </>
              )}

              {/* 0% P/L Reference Line on right Y-axis */}
              <ReferenceLine
                yAxisId="percent"
                y={0}
                stroke="#6b7280"
                strokeWidth={2}
                strokeDasharray="8 4"
                label={{ value: "0% P/L", position: "right", style: { fill: "#6b7280", fontSize: "12px" } }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="results-period">
        <Clock size={16} />
        <span>{summary.startDate} to {summary.endDate}</span>
      </div>

      {/* Key Metrics Grid */}
      <div className="results-grid">
        <div className="metric-card">
          <h4>Total Return</h4>
          <p className={`value ${getMetricClass(summary.totalReturn)}`}>
            {formatCurrency(summary.totalReturn)}
          </p>
          <small className={getMetricClass(summary.totalReturnPercent)}>
            {(() => {
              // Calculate total return % using average capital deployed
              if (enhancedTransactions && enhancedTransactions.length > 0) {
                const lotSizeUsd = priceData?.backtestParameters?.lotSizeUsd || 10000;
                let totalCapitalDeployed = 0;
                let dayCount = 0;

                // Calculate average capital deployed over time (correctly for short selling)
                enhancedTransactions.forEach(transaction => {
                  const positions = transaction.lotsAfterTransaction || transaction.shortsAfterTransaction;
                  if (positions) {
                    // For short selling, capital deployed is the cash received from shorting
                    // For long, capital deployed is the cash spent on purchases
                    // Both use lotSizeUsd per position since each position represents $lotSizeUsd invested/received
                    const capitalDeployed = positions.length * lotSizeUsd;
                    totalCapitalDeployed += capitalDeployed;
                    dayCount += 1;
                  }
                });

                const averageCapitalDeployed = dayCount > 0 ? totalCapitalDeployed / dayCount : 0;
                if (averageCapitalDeployed > 0) {
                  const returnPercent = (summary.totalReturn / averageCapitalDeployed) * 100;

                  // Calculate annualized return (CAGR) based on backtest period
                  const startDate = new Date(summary.startDate || priceData?.backtestParameters?.startDate);
                  const endDate = new Date(summary.endDate || priceData?.backtestParameters?.endDate);
                  const years = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365.25);

                  let annualizedReturnText = '';
                  if (years > 0) {
                    const finalValue = 1 + (returnPercent / 100);
                    if (finalValue > 0) {
                      const cagr = Math.pow(finalValue, 1 / years) - 1;
                      const cagrPercent = cagr * 100;
                      annualizedReturnText = ` | CAGR: ${cagrPercent.toFixed(2)}%`;
                    }
                  }

                  return `${formatPercent(returnPercent)} | Avg Capital: ${formatCurrency(averageCapitalDeployed)}${annualizedReturnText}`;
                } else {
                  // If no enhanced transactions, fallback to showing basic info
                  return `${formatPercent(summary.totalReturnPercent)} | Enhanced data unavailable`;
                }
              } else {
                // If no enhanced transactions at all, show basic percentage
                return `${formatPercent(summary.totalReturnPercent)} | No transaction data`;
              }
              return formatPercent(summary.totalReturnPercent);
            })()}
          </small>
        </div>

        <div className="metric-card">
          <h4>Final Portfolio Value</h4>
          <p className="value">
            {formatCurrency(summary.finalValue)}
          </p>
        </div>

        <div className="metric-card">
          <h4>Total Investment</h4>
          <p className="value">
            {formatCurrency(summary.totalCost)}
          </p>
        </div>

        <div className="metric-card">
          <h4>{summary.strategy === 'SHORT_DCA' ? 'Shorts Held' : 'Lots Held'}</h4>
          <p className="value">
            {summary.lotsHeld}
          </p>
        </div>

        <div className="metric-card">
          <h4>Total Trades</h4>
          <p className="value">
            {summary.totalTrades}
          </p>
        </div>

        <div className="metric-card">
          <h4>Win Rate</h4>
          <p className="value">
            {summary.winRate ? formatPercent(summary.winRate) : 'N/A'}
          </p>
        </div>
      </div>

      {/* Strategy Comparison Section */}
      {(tradeAnalysis || holdResults) && (
        <div className="strategy-comparison-section">
          <h3>
            <Target size={20} />
            Strategy Performance Analysis
          </h3>
          <div className="comparison-grid">
            {tradeAnalysis && (
              <>
                <div className="comparison-card">
                  <h4>Average Annualized Return</h4>
                  <p className={`value ${(tradeAnalysis.averageAnnualizedReturnPercent || 0) > 0 ? 'positive' : 'negative'}`}>
                    {isNaN(tradeAnalysis.averageAnnualizedReturnPercent) || tradeAnalysis.averageAnnualizedReturnPercent == null
                      ? 'N/A'
                      : `${tradeAnalysis.averageAnnualizedReturnPercent.toFixed(2)}%`}
                  </p>
                  <small>All positions (trades + holdings)</small>
                </div>
                <div className="comparison-card">
                  <h4>Completed Trades Only</h4>
                  <p className={`value ${(tradeAnalysis.tradeOnlyAverageAnnualizedReturnPercent || 0) > 0 ? 'positive' : 'negative'}`}>
                    {isNaN(tradeAnalysis.tradeOnlyAverageAnnualizedReturnPercent) || tradeAnalysis.tradeOnlyAverageAnnualizedReturnPercent == null
                      ? 'N/A'
                      : `${tradeAnalysis.tradeOnlyAverageAnnualizedReturnPercent.toFixed(2)}%`}
                  </p>
                  <small>{tradeAnalysis.individualTradeReturns?.length || 0} trades</small>
                </div>
                <div className="comparison-card">
                  <h4>{summary.strategy === 'SHORT_DCA' ? 'Current Short Positions Only' : 'Current Holdings Only'}</h4>
                  <p className={`value ${((summary.strategy === 'SHORT_DCA' ? tradeAnalysis.shortOnlyAverageAnnualizedReturnPercent : tradeAnalysis.holdingOnlyAverageAnnualizedReturnPercent) || 0) > 0 ? 'positive' : 'negative'}`}>
                    {(() => {
                      const value = summary.strategy === 'SHORT_DCA' ? tradeAnalysis.shortOnlyAverageAnnualizedReturnPercent : tradeAnalysis.holdingOnlyAverageAnnualizedReturnPercent;
                      return isNaN(value) || value == null ? 'N/A' : `${value.toFixed(2)}%`;
                    })()}
                  </p>
                  <small>{(summary.strategy === 'SHORT_DCA' ? tradeAnalysis.currentShortReturns?.length : tradeAnalysis.currentHoldingReturns?.length) || 0} {summary.strategy === 'SHORT_DCA' ? 'short positions' : 'holdings'}</small>
                </div>
              </>
            )}
            {holdResults && Object.keys(holdResults).length > 0 && (
              <>
                <div className="comparison-card buy-hold">
                  <h4>{summary.strategy === 'SHORT_DCA' ? 'Short & Hold Strategy' : 'Buy & Hold Strategy'}</h4>
                  <p className={`value ${(holdResults.totalReturnPercent || 0) > 0 ? 'positive' : 'negative'}`}>
                    {isNaN(holdResults.annualizedReturnPercent) || holdResults.annualizedReturnPercent == null
                      ? 'N/A'
                      : `${holdResults.annualizedReturnPercent.toFixed(2)}% annualized`}
                  </p>
                  <small>Final Value: {isNaN(holdResults.finalValue) || holdResults.finalValue == null
                    ? 'N/A'
                    : formatCurrency(holdResults.finalValue)}</small>
                </div>
                <div className="comparison-card outperformance">
                  <h4>{summary.strategy === 'SHORT_DCA' ? 'Short DCA vs Short & Hold' : 'DCA vs Buy & Hold'}</h4>
                  <p className={`value ${(outperformancePercent || 0) > 0 ? 'positive' : 'negative'}`}>
                    {isNaN(outperformancePercent) || outperformancePercent == null
                      ? 'N/A'
                      : `${outperformancePercent > 0 ? '+' : ''}${outperformancePercent.toFixed(2)}%`}
                  </p>
                  <small>
                    {isNaN(outperformance) || outperformance == null
                      ? 'N/A'
                      : `${outperformancePercent > 0 ? 'Outperforming' : 'Underperforming'} by ${formatCurrency(Math.abs(outperformance))}`}
                  </small>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Portfolio Performance Chart */}
      <div className="performance-section">
        <h3>Portfolio Value Over Time</h3>
        <div className="performance-chart">
          {chartData && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="date"
                  stroke="#666"
                  fontSize={12}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#666"
                  fontSize={12}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value, name, props) => {
                    const label = name === 'totalPNL' ? 'Total P&L' :
                                name === 'holdingsValue' ? 'Current Holdings Value' :
                                name === 'realizedPNL' ? 'Cumulative Realized P&L' :
                                name === 'breakEvenValue' ? 'Break-even Value (Dynamic)' :
                                name;
                    return [formatCurrency(value), label];
                  }}
                  labelStyle={{ color: '#333' }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />

                {/* Total P&L Line */}
                <Line
                  type="monotone"
                  dataKey="totalPNL"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={false}
                  name="Total P&L"
                />

                {/* Holdings Market Value Line */}
                <Line
                  type="monotone"
                  dataKey="holdingsValue"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={false}
                  name="Current Holdings Value"
                />

                {/* Cumulative Realized P&L Line */}
                <Line
                  type="monotone"
                  dataKey="realizedPNL"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={false}
                  name="Cumulative Realized P&L"
                />


                {/* Dynamic Break-even Line (Average Cost of Holdings) */}
                <Line
                  type="monotone"
                  dataKey="breakEvenValue"
                  stroke="#f97316"
                  strokeWidth={3}
                  strokeDasharray="10 6"
                  dot={false}
                  name="Break-even Value (Dynamic)"
                />

                {/* 0% P/L Reference Line */}
                <ReferenceLine
                  y={0}
                  stroke="#6b7280"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  label={{ value: "0% P/L", position: "right", style: { fill: "#6b7280", fontSize: "12px" } }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-placeholder">
              <p>No data available for chart visualization</p>
            </div>
          )}

          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#2563eb' }}></span>
              <span>Total P&L</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#059669' }}></span>
              <span>Current Holdings Value</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#dc2626' }}></span>
              <span>Cumulative Realized P&L</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#f97316', borderStyle: 'dashed' }}></span>
              <span>Break-even Value (Dynamic)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Questionable Events Section */}
      {questionableEvents && questionableEvents.length > 0 && (
        <div className="questionable-events-section">
          <h3>
            <AlertTriangle size={20} />
            Questionable Events ({questionableEvents.length})
          </h3>
          <div className="questionable-events-table">
            <div className="table-header">
              <div>Date</div>
              <div>Event Type</div>
              <div>Description</div>
              <div>Severity</div>
            </div>
            {questionableEvents.map((event, index) => (
              <div key={index} className={`table-row ${event.severity.toLowerCase()}`}>
                <div>{event.date}</div>
                <div>{event.type}</div>
                <div>{event.description}</div>
                <div className={`severity ${event.severity.toLowerCase()}`}>
                  {event.severity}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Transaction History */}
      <div className="transactions-section">
        <h3>
          <Target size={20} />
          Enhanced Transaction History
        </h3>

        {enhancedTransactions && enhancedTransactions.length > 0 ? (
          <div className="enhanced-transactions-table">
            <div className="table-header">
              <div>Date</div>
              <div>Type</div>
              <div>Price</div>
              <div>Trailing Stop Buy</div>
              <div>Trailing Stop Sell</div>
              <div>Shares</div>
              <div>Value</div>
              <div>Lots</div>
              <div>Avg Cost</div>
              <div>Holdings Value</div>
              <div>Unrealized P&L</div>
              <div>Realized P&L</div>
              <div>Annual Return</div>
              <div>Total P&L</div>
              <div>Total P&L %</div>
            </div>

            {enhancedTransactions.map((transaction, index) => {
              const getTransactionIcon = (type) => {
                if (type === 'SELL') return <><TrendingDown size={16} /> SELL</>;
                if (type === 'SHORT') return <><TrendingDown size={16} /> SHORT</>;
                if (type === 'COVER') return <><TrendingUp size={16} /> COVER</>;
                if (type === 'EMERGENCY_COVER') return <><TrendingUp size={16} /> EMERGENCY COVER</>;
                if (type === 'TRAILING_STOP_LIMIT_SHORT') return <><TrendingDown size={16} /> TRAIL SHORT</>;
                if (type === 'TRAILING_STOP_LIMIT_BUY') return <><TrendingUp size={16} /> BUY</>;
                if (type === 'OCO_LIMIT_BUY') return <><TrendingUp size={16} /> OCO LIMIT</>;
                if (type === 'OCO_TRAILING_BUY') return <><TrendingUp size={16} /> OCO TRAIL</>;
                // Debug: Log unknown transaction types
                if (type && !['SELL', 'SHORT', 'COVER', 'EMERGENCY_COVER', 'TRAILING_STOP_LIMIT_SHORT', 'TRAILING_STOP_LIMIT_BUY', 'OCO_LIMIT_BUY', 'OCO_TRAILING_BUY', 'BUY', 'INITIAL_BUY'].includes(type)) {
                  console.warn('🐛 Unknown transaction type:', type);
                }
                return <><TrendingUp size={16} /> BUY</>;
              };

              return (
                <div key={index} className={`table-row ${transaction.type.toLowerCase().replace('_', '-')}`}>
                  <div>{new Date(transaction.date).toLocaleDateString()}</div>
                  <div className={`transaction-type ${transaction.type.toLowerCase()}`}>
                    {getTransactionIcon(transaction.type)}
                  </div>
                  <div>{formatCurrency(transaction.price)}</div>
                  <div className="trailing-stop-buy-details">
                    {transaction.type === 'TRAILING_STOP_LIMIT_BUY' ? formatTrailingStopBuyDetails(transaction.trailingStopDetail) : ''}
                  </div>
                  <div className="trailing-stop-sell-details">
                    {transaction.type === 'SELL' ? formatTrailingStopSellDetails(transaction.trailingStopDetail) : ''}
                  </div>
                  <div>{transaction.shares !== undefined ? transaction.shares.toFixed(4) : 'N/A'}</div>
                  <div>{formatCurrency(transaction.value)}</div>
                  <div className="lots-column">
                    {(() => {
                      // Handle both long and short selling display
                      if ((transaction.type === 'SELL' || transaction.type === 'COVER') && (transaction.lotsDetails || transaction.shortsDetails)) {
                        const details = transaction.lotsDetails || transaction.shortsDetails;
                        const action = transaction.type === 'COVER' ? 'Covered' : 'Sold';
                        return `${action}: ${formatLots(details)}`;
                      } else {
                        const positions = transaction.lotsAfterTransaction || transaction.shortsAfterTransaction;
                        const holding = transaction.shortsAfterTransaction ? 'Shorted' : 'Held';
                        return `${holding}: ${formatLots(positions)}`;
                      }
                    })()
                    }
                  </div>
                  <div>{transaction.averageCost ? formatCurrency(transaction.averageCost) : 'N/A'}</div>
                  <div>
                    {(() => {
                      // Calculate holdings value by summing each lot's current value
                      const currentPrice = parseFloat(priceData?.dailyPrices?.find(d => d.date === transaction.date)?.adjusted_close ||
                                                     priceData?.dailyPrices?.find(d => d.date === transaction.date)?.close || transaction.price);
                      const lotSizeUsd = priceData?.backtestParameters?.lotSizeUsd || 10000;

                      const positions = transaction.lotsAfterTransaction || transaction.shortsAfterTransaction;
                      if (positions) {
                        const holdingsValue = positions.reduce((total, position) => {
                          const shares = lotSizeUsd / position.price; // shares = $10,000 / purchase price
                          if (transaction.shortsAfterTransaction) {
                            // Short position value = original short value - current market value
                            return total + (lotSizeUsd - (shares * currentPrice));
                          } else {
                            // Long position value = current market value
                            return total + (shares * currentPrice);
                          }
                        }, 0);
                        return formatCurrency(holdingsValue);
                      }
                      return formatCurrency(0);
                    })()}
                  </div>
                  <div className={getMetricClass(transaction.unrealizedPNL)}>
                    {formatCurrency(transaction.unrealizedPNL)}
                  </div>
                  <div className={getMetricClass(transaction.realizedPNL)}>
                    {formatCurrency(transaction.realizedPNL)}
                    {transaction.realizedPNLFromTrade !== 0 && (
                      <small className={getMetricClass(transaction.realizedPNLFromTrade)}>
                        {transaction.realizedPNLFromTrade >= 0 ? ' (+' : ' ('}{formatCurrency(Math.abs(transaction.realizedPNLFromTrade))})
                      </small>
                    )}
                  </div>
                  <div className={(transaction.type === 'SELL' || transaction.type === 'COVER' || transaction.type === 'EMERGENCY_COVER') ? (transaction.annualizedReturnPercent > 0 ? 'positive' : 'negative') : ''}>
                    {(() => {
                      // Handle both SELL (long) and COVER/EMERGENCY_COVER (short) transactions
                      if (transaction.type === 'SELL' || transaction.type === 'COVER' || transaction.type === 'EMERGENCY_COVER') {
                        const details = transaction.lotsDetails || transaction.shortsDetails;
                        if (details && details.length > 0) {
                          const tradedPosition = details[0];
                          const purchaseDate = new Date(tradedPosition.date);
                          const saleDate = new Date(transaction.date);
                          const daysBetween = (saleDate - purchaseDate) / (1000 * 60 * 60 * 24);
                          const yearsBetween = daysBetween / 365.25;

                          if (yearsBetween > 0) {
                            let totalReturn;
                            if (transaction.type === 'SELL') {
                              // Long position: profit when sale price > purchase price
                              totalReturn = (transaction.price - tradedPosition.price) / tradedPosition.price;
                            } else {
                              // Short position: profit when cover price < short price
                              totalReturn = (tradedPosition.price - transaction.price) / tradedPosition.price;
                            }
                            const annualizedReturn = totalReturn / yearsBetween * 100;
                            return `${annualizedReturn.toFixed(2)}%`;
                          }
                        }
                      }
                      return 'N/A';
                    })()}
                  </div>
                  <div className={getMetricClass(transaction.totalPNL)}>
                    {formatCurrency(transaction.totalPNL)}
                  </div>
                  <div className={getMetricClass(transaction.totalPNL)}>
                    {(() => {
                      // Calculate total P/L percentage based on total capital deployed
                      const lotSizeUsd = priceData?.backtestParameters?.lotSizeUsd || 10000;
                      const positions = transaction.lotsAfterTransaction || transaction.shortsAfterTransaction;
                      const totalCapitalDeployed = positions ? positions.length * lotSizeUsd : 0;

                      if (totalCapitalDeployed > 0) {
                        const pnlPercent = (transaction.totalPNL / totalCapitalDeployed) * 100;
                        const sign = pnlPercent >= 0 ? '+' : '';
                        return `${sign}${pnlPercent.toFixed(2)}%`;
                      }
                      return 'N/A';
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        ) : transactions && transactions.length > 0 ? (
          // Fallback to original transaction table if enhanced data not available
          <div className="transactions-table">
            <div className="table-header">
              <div>Date</div>
              <div>Type</div>
              <div>Price</div>
              <div>Shares</div>
              <div>Value</div>
            </div>

            {transactions.map((transaction, index) => (
              <div key={index} className={`table-row ${transaction.type.toLowerCase()}`}>
                <div>{new Date(transaction.date).toLocaleDateString()}</div>
                <div className={`transaction-type ${transaction.type.toLowerCase()}`}>
                  {transaction.type === 'BUY' ? (
                    <><TrendingUp size={16} /> BUY</>
                  ) : transaction.type === 'SHORT' ? (
                    <><TrendingDown size={16} /> SHORT</>
                  ) : transaction.type === 'COVER' ? (
                    <><TrendingUp size={16} /> COVER</>
                  ) : transaction.type === 'SELL' ? (
                    <><TrendingDown size={16} /> SELL</>
                  ) : (
                    <><span size={16} /> {transaction.type}</>
                  )}
                </div>
                <div>{formatCurrency(transaction.price)}</div>
                <div>{transaction.shares.toFixed(4)}</div>
                <div>{formatCurrency(transaction.value)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-transactions">
            <p>No transactions were executed during this backtest period.</p>
          </div>
        )}
      </div>

      {/* Current Holdings */}
      {lots.length > 0 && (
        <div className="holdings-section">
          <h3>
            <DollarSign size={20} />
            Current Holdings
          </h3>

          <div className="holdings-table">
            <div className="table-header">
              <div>Purchase Date</div>
              <div>Purchase Price</div>
              <div>Shares</div>
              <div>Current Price</div>
              <div>Current Value</div>
              <div>P&L</div>
              <div>Ann. Return</div>
            </div>

            {lots.map((lot, index) => {
              const currentPrice = priceData?.dailyPrices?.[priceData.dailyPrices.length - 1]?.close || 0;
              const currentValue = lot.shares * currentPrice;
              const purchaseValue = lot.shares * lot.price;
              const pnl = currentValue - purchaseValue;

              // Calculate annualized return for this holding
              const actualDaysHeld = Math.max(1, Math.ceil((new Date(summary.endDate) - new Date(lot.date)) / (1000 * 60 * 60 * 24)));
              const totalReturn = purchaseValue > 0 ? pnl / purchaseValue : 0;

              // Simple linear annualization (matches backend calculation)
              const annualizedReturn = totalReturn * (365 / actualDaysHeld);
              const annualizedReturnPercent = annualizedReturn * 100;

              return (
                <div key={index} className="table-row">
                  <div>{new Date(lot.date).toLocaleDateString()}</div>
                  <div>{formatCurrency(lot.price)}</div>
                  <div>{lot.shares !== undefined ? lot.shares.toFixed(4) : 'N/A'}</div>
                  <div>{formatCurrency(currentPrice)}</div>
                  <div>{formatCurrency(currentValue)}</div>
                  <div className={getMetricClass(pnl)}>
                    {formatCurrency(pnl)}
                  </div>
                  <div className={annualizedReturnPercent > 0 ? 'positive' : 'negative'}>
                    {annualizedReturnPercent.toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Current Short Positions */}
      {shorts.length > 0 && (
        <div className="holdings-section">
          <h3>
            <TrendingDown size={20} />
            Current Short Positions
          </h3>

          <div className="holdings-table">
            <div className="table-header">
              <div>Short Date</div>
              <div>Short Price</div>
              <div>Shares</div>
              <div>Current Price</div>
              <div>Current Value</div>
              <div>P&L</div>
              <div>Ann. Return</div>
            </div>

            {shorts.map((short, index) => {
              const currentPrice = priceData?.dailyPrices?.[priceData.dailyPrices.length - 1]?.close || 0;
              const currentValue = short.shares * currentPrice; // Current market value of the shorted shares
              const shortValue = short.shares * short.price; // Original value when shorted
              const pnl = (short.price - currentPrice) * short.shares; // P&L from short position (profit when price goes down)

              // Calculate annualized return for this short position
              const endDate = new Date(summary.endDate || priceData?.backtestParameters?.endDate);
              const actualDaysHeld = Math.max(1, Math.ceil((endDate - new Date(short.date)) / (1000 * 60 * 60 * 24)));
              const totalReturn = shortValue > 0 ? pnl / shortValue : 0;

              // Simple linear annualization (matches backend calculation)
              const annualizedReturn = totalReturn * (365 / actualDaysHeld);
              const annualizedReturnPercent = annualizedReturn * 100;

              return (
                <div key={index} className="table-row">
                  <div>{new Date(short.date).toLocaleDateString()}</div>
                  <div>{formatCurrency(short.price)}</div>
                  <div>{short.shares !== undefined ? short.shares.toFixed(4) : 'N/A'}</div>
                  <div>{formatCurrency(currentPrice)}</div>
                  <div>{formatCurrency(currentValue)}</div>
                  <div className={getMetricClass(pnl)}>
                    {formatCurrency(pnl)}
                  </div>
                  <div className={annualizedReturnPercent > 0 ? 'positive' : 'negative'}>
                    {isNaN(annualizedReturnPercent) ? 'N/A' : `${annualizedReturnPercent.toFixed(2)}%`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily Transaction Log */}
      {transactionLog && transactionLog.length > 0 && (
        <div className="transaction-log-section">
          <h3>
            <Clock size={20} />
            Daily Transaction Log
          </h3>
          <div className="transaction-log">
            {transactionLog.map((log, index) => {
              const isDateHeader = log.startsWith('--- ') && log.endsWith(' ---');
              const isAction = log.includes('ACTION:');
              const isInfo = log.includes('INFO:');

              return (
                <div
                  key={index}
                  className={`log-line ${isDateHeader ? 'date-header' : ''} ${isAction ? 'action' : ''} ${isInfo ? 'info' : ''}`}
                >
                  {log}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Strategy Summary */}
      <div className="strategy-summary">
        <h3>Strategy Summary</h3>
        <div className="summary-content">
          <p>
            <strong>Investment Approach:</strong> Dollar Cost Averaging with technical analysis filters
          </p>
          <p>
            <strong>Risk Management:</strong> Grid-based position sizing with stop-loss protection
          </p>
          <p>
            <strong>Market Conditions:</strong> Adaptive entry based on volatility, RSI, and moving averages
          </p>
          <p>
            <strong>Capital Efficiency:</strong> {summary.totalCost > 0 ? ((summary.totalCost / (summary.lotsHeld * 10000)) * 100).toFixed(1) : 0}% of maximum capital deployed
          </p>
        </div>
      </div>
    </div>
  );
};

export default BacktestResults;
