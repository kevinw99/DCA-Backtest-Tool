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
import PerformanceSummary from './PerformanceSummary';
import ScenarioAnalysis from './ScenarioAnalysis';
import { formatCurrency, formatPercent, formatParameterPercent, formatDate } from '../utils/formatters';

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

    // Initialize cumulative capital tracking for average capital deployed calculation
    let cumulativeCapitalDeployed = 0;
    let capitalDeployedDays = 0;

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

        // Update cumulative capital deployed
        cumulativeCapitalDeployed += totalCapitalDeployed;
        capitalDeployedDays += 1;

        // Calculate average capital deployed up to this point
        const avgCapitalDeployed = capitalDeployedDays > 0 ? cumulativeCapitalDeployed / capitalDeployedDays : 0;

        if (avgCapitalDeployed > 0) {
          totalPNLPercent = (totalPNL / avgCapitalDeployed) * 100;
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

          // Update cumulative capital deployed for non-transaction days too
          cumulativeCapitalDeployed += totalCapitalDeployed;
          capitalDeployedDays += 1;

          // Calculate average capital deployed up to this point
          const avgCapitalDeployed = capitalDeployedDays > 0 ? cumulativeCapitalDeployed / capitalDeployedDays : 0;

          if (avgCapitalDeployed > 0) {
            totalPNLPercent = (totalPNL / avgCapitalDeployed) * 100;
          }
        }
      }

      // Calculate Buy & Hold P&L % (simple percentage change from start)
      const buyAndHoldPercent = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;

      // Calculate break-even value (capital deployed)
      const breakEvenValue = totalCapitalDeployed;

      // Calculate lots deployed as percentage (0-100%) for the chart
      const maxLotsParam = priceData?.backtestParameters?.maxLots || summary?.maxLots || 10;
      let currentLotsCount = 0;

      if (transaction) {
        // For transaction days, use current transaction's lots
        currentLotsCount = transaction.lotsAfterTransaction ? transaction.lotsAfterTransaction.length :
                          (transaction.shortsAfterTransaction ? transaction.shortsAfterTransaction.length : 0);
      } else {
        // For non-transaction days, find most recent transaction
        for (let i = transactionsToUse.length - 1; i >= 0; i--) {
          if (new Date(transactionsToUse[i].date) <= new Date(day.date)) {
            currentLotsCount = transactionsToUse[i].lotsAfterTransaction ? transactionsToUse[i].lotsAfterTransaction.length :
                              (transactionsToUse[i].shortsAfterTransaction ? transactionsToUse[i].shortsAfterTransaction.length : 0);
            break;
          }
        }
      }

      const lotsDeployedPercent = maxLotsParam > 0 ? (currentLotsCount / maxLotsParam) * 100 : 0;

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
        breakEvenValue: breakEvenValue,
        lotsDeployedPercent: lotsDeployedPercent,

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

          {data.lotsDeployedPercent !== undefined && data.lotsDeployedPercent !== null && (
            <p className="tooltip-lots">
              Lots Deployed %: {data.lotsDeployedPercent.toFixed(2)}%
            </p>
          )}

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

    // Get start price for Buy & Hold calculation
    const startPrice = parseFloat(pricesData[0]?.adjusted_close || pricesData[0]?.close || 0);

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

    // Initialize cumulative capital tracking for average capital deployed calculation (across ALL days)
    let cumulativeCapitalDeployed = 0;
    let totalDays = 0;

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

        // Calculate Buy & Hold percentage from start price
        const buyAndHoldPercent = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;

        // Track cumulative capital deployed for average calculation
        const capitalDeployed = currentLots * lotSizeUsd;
        cumulativeCapitalDeployed += capitalDeployed;
        totalDays += 1;

        // Calculate Total P&L % based on AVERAGE capital deployed (not end capital!)
        const avgCapitalDeployed = totalDays > 0 ? cumulativeCapitalDeployed / totalDays : 0;
        const totalPNLPercent = avgCapitalDeployed > 0 ? (totalPNL / avgCapitalDeployed) * 100 : null;

        // Calculate lots deployed as percentage (0-100%)
        const lotsDeployedPercent = maxLots > 0 ? (currentLots / maxLots) * 100 : 0;

        return {
          date: new Date(date).toLocaleDateString(),
          totalPNL: totalPNL,
          totalPNLPercent: totalPNLPercent,
          avgCapitalDeployed: avgCapitalDeployed,
          holdingsValue: holdingsMarketValue,
          realizedPNL: cumulativeRealizedPNL,
          breakEvenValue: breakEvenValue,
          lotsDeployedPercent: lotsDeployedPercent,
          stockPrice: currentPrice,
          currentLots: currentLots,
          buyAndHoldPercent: buyAndHoldPercent,
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

        // Calculate Buy & Hold percentage from start price
        const buyAndHoldPercent = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;

        // Track cumulative capital deployed for average calculation
        const capitalDeployed = currentLots * lotSizeUsd;
        cumulativeCapitalDeployed += capitalDeployed;
        totalDays += 1;

        // Calculate Total P&L % based on AVERAGE capital deployed (not end capital!)
        const avgCapitalDeployed = totalDays > 0 ? cumulativeCapitalDeployed / totalDays : 0;
        const totalPNLPercent = avgCapitalDeployed > 0 ? (totalPNL / avgCapitalDeployed) * 100 : null;

        // Calculate lots deployed as percentage (0-100%)
        const lotsDeployedPercent = maxLots > 0 ? (currentLots / maxLots) * 100 : 0;

        return {
          date: new Date(date).toLocaleDateString(),
          totalPNL: totalPNL,
          totalPNLPercent: totalPNLPercent,
          avgCapitalDeployed: avgCapitalDeployed,
          holdingsValue: holdingsMarketValue,
          realizedPNL: cumulativeRealizedPNL,
          breakEvenValue: breakEvenValue,
          lotsDeployedPercent: lotsDeployedPercent,
          stockPrice: currentPrice,
          currentLots: currentLots,
          buyAndHoldPercent: buyAndHoldPercent,
          hasBuy: false,
          hasSell: false
        };
      }

      // If no transactions have occurred yet, start with initial state

      const hasBuy = transaction && ['BUY', 'INITIAL_BUY', 'TRAILING_STOP_LIMIT_BUY'].includes(transaction.type);
      const hasSell = transaction && transaction.type === 'SELL';

      // Calculate Buy & Hold percentage from start price
      const buyAndHoldPercent = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;

      // No capital deployed yet
      cumulativeCapitalDeployed += 0;
      totalDays += 1;

      return {
        date: new Date(date).toLocaleDateString(),
        totalPNL: 0,
        totalPNLPercent: null,
        avgCapitalDeployed: 0,
        holdingsValue: 0,
        realizedPNL: 0,
        breakEvenValue: 0,
        lotsDeployedPercent: 0,
        stockPrice: currentPrice,
        currentLots: 0,
        buyAndHoldPercent: buyAndHoldPercent,
        hasBuy: false,
        hasSell: false
      };
    });
  };

  const chartData = prepareChartData();

  // Debug logging for performance metrics
  console.log('🔍 BacktestResults - Performance Metrics Check:', {
    hasPerformanceMetrics: !!summary.performanceMetrics,
    performanceMetrics: summary.performanceMetrics,
    summaryKeys: Object.keys(summary),
    fullSummary: summary
  });

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
              <span className="parameter-value">
                {priceData.betaInfo && priceData.backtestParameters.enableBetaScaling ? (
                  <>
                    {formatParameterPercent(priceData.betaInfo.baseParameters.gridIntervalPercent)}
                    <span style={{color: '#666', fontSize: '0.9em'}}> scaled to→ </span>
                    {formatParameterPercent(priceData.betaInfo.adjustedParameters.gridIntervalPercent)}
                  </>
                ) : (
                  formatParameterPercent(priceData.backtestParameters.gridIntervalPercent)
                )}
              </span>
            </div>
            <div className="parameter-card">
              <span className="parameter-label">Profit Requirement</span>
              <span className="parameter-value">
                {priceData.betaInfo && priceData.backtestParameters.enableBetaScaling ? (
                  <>
                    {formatParameterPercent(priceData.betaInfo.baseParameters.profitRequirement)}
                    <span style={{color: '#666', fontSize: '0.9em'}}> scaled to→ </span>
                    {formatParameterPercent(priceData.betaInfo.adjustedParameters.profitRequirement)}
                  </>
                ) : (
                  formatParameterPercent(priceData.backtestParameters.profitRequirement)
                )}
              </span>
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
                  <span className="parameter-value">
                    {priceData.betaInfo && priceData.backtestParameters.enableBetaScaling ? (
                      <>
                        {formatParameterPercent(priceData.betaInfo.baseParameters.trailingBuyActivationPercent)}
                        <span style={{color: '#666', fontSize: '0.9em'}}> scaled to→ </span>
                        {formatParameterPercent(priceData.betaInfo.adjustedParameters.trailingBuyActivationPercent)}
                      </>
                    ) : (
                      formatParameterPercent(priceData.backtestParameters.trailingBuyActivationPercent || 0)
                    )}
                  </span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">Trailing Buy Rebound</span>
                  <span className="parameter-value">
                    {priceData.betaInfo && priceData.backtestParameters.enableBetaScaling ? (
                      <>
                        {formatParameterPercent(priceData.betaInfo.baseParameters.trailingBuyReboundPercent)}
                        <span style={{color: '#666', fontSize: '0.9em'}}> scaled to→ </span>
                        {formatParameterPercent(priceData.betaInfo.adjustedParameters.trailingBuyReboundPercent)}
                      </>
                    ) : (
                      formatParameterPercent(priceData.backtestParameters.trailingBuyReboundPercent || 0)
                    )}
                  </span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">Trailing Sell Activation</span>
                  <span className="parameter-value">
                    {priceData.betaInfo && priceData.backtestParameters.enableBetaScaling ? (
                      <>
                        {formatParameterPercent(priceData.betaInfo.baseParameters.trailingSellActivationPercent)}
                        <span style={{color: '#666', fontSize: '0.9em'}}> scaled to→ </span>
                        {formatParameterPercent(priceData.betaInfo.adjustedParameters.trailingSellActivationPercent)}
                      </>
                    ) : (
                      formatParameterPercent(priceData.backtestParameters.trailingSellActivationPercent || 0)
                    )}
                  </span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">Trailing Sell Pullback</span>
                  <span className="parameter-value">
                    {priceData.betaInfo && priceData.backtestParameters.enableBetaScaling ? (
                      <>
                        {formatParameterPercent(priceData.betaInfo.baseParameters.trailingSellPullbackPercent)}
                        <span style={{color: '#666', fontSize: '0.9em'}}> scaled to→ </span>
                        {formatParameterPercent(priceData.betaInfo.adjustedParameters.trailingSellPullbackPercent)}
                      </>
                    ) : (
                      formatParameterPercent(priceData.backtestParameters.trailingSellPullbackPercent || 0)
                    )}
                  </span>
                </div>
              </>
            )}

            {/* Dynamic Grid Parameters */}
            <div className="parameter-card">
              <span className="parameter-label">Dynamic Grid</span>
              <span className="parameter-value">{priceData.backtestParameters.enableDynamicGrid !== false ? 'Enabled' : 'Disabled'}</span>
            </div>
            {priceData.backtestParameters.enableDynamicGrid !== false && (
              <>
                <div className="parameter-card">
                  <span className="parameter-label">Normalize to Reference</span>
                  <span className="parameter-value">{priceData.backtestParameters.normalizeToReference !== false ? 'Yes' : 'No'}</span>
                </div>
                <div className="parameter-card">
                  <span className="parameter-label">Grid Multiplier</span>
                  <span className="parameter-value">{(priceData.backtestParameters.dynamicGridMultiplier || 1.0).toFixed(1)}</span>
                </div>
              </>
            )}

            {/* Consecutive Incremental Parameters */}
            <div className="parameter-card">
              <span className="parameter-label">Consecutive Incremental Buy</span>
              <span className="parameter-value">{priceData.backtestParameters.enableConsecutiveIncremental !== false ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="parameter-card">
              <span className="parameter-label">Consecutive Incremental Sell Profit</span>
              <span className="parameter-value">{priceData.backtestParameters.enableConsecutiveIncrementalSellProfit !== false ? 'Enabled' : 'Disabled'}</span>
            </div>

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
                  <span className="parameter-value">{((priceData.backtestParameters.beta || 1.0) * (priceData.backtestParameters.coefficient || 1.0)).toFixed(3)}</span>
                </div>
                <div className="parameter-card beta-formula-card">
                  <span className="parameter-label">Formula</span>
                  <span className="parameter-value">
                    {(priceData.backtestParameters.beta || 1.0).toFixed(2)} × {(priceData.backtestParameters.coefficient || 1.0).toFixed(2)} = {((priceData.backtestParameters.beta || 1.0) * (priceData.backtestParameters.coefficient || 1.0)).toFixed(3)}
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

              {/* Lots Deployed % line on percent Y-axis */}
              <Line
                yAxisId="percent"
                type="monotone"
                dataKey="lotsDeployedPercent"
                stroke="#f97316"
                strokeWidth={1}
                dot={false}
                name="Lots Deployed %"
              />

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

      {/* Total Return Card */}
      <div className="metric-card total-return-card">
        <h4>Total Return</h4>
        <div className={`metrics ${getMetricClass(summary.totalReturnPercent)}`}>
          {(() => {
            // Get the final Total P&L % from price chart data (matches chart display)
            if (chartData && chartData.length > 0) {
              const finalDataPoint = chartData[chartData.length - 1];
              const returnPercent = finalDataPoint.totalPNLPercent;

              if (returnPercent !== null && returnPercent !== undefined) {
                // Calculate annualized return (CAGR) based on backtest period
                const startDate = new Date(summary.startDate || priceData?.backtestParameters?.startDate);
                const endDate = new Date(summary.endDate || priceData?.backtestParameters?.endDate);
                const years = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365.25);

                let cagrText = '';
                if (years > 0) {
                  const finalValue = 1 + (returnPercent / 100);
                  if (finalValue > 0) {
                    const cagr = Math.pow(finalValue, 1 / years) - 1;
                    const cagrPercent = cagr * 100;
                    cagrText = ` | CAGR: ${cagrPercent.toFixed(2)}%`;
                  }
                }

                // Calculate average capital deployed for display
                const avgCapital = returnPercent !== 0 ? (summary.totalReturn / returnPercent) * 100 : 0;

                return `${formatCurrency(summary.totalReturn)} | ${formatPercent(returnPercent)} | Avg Capital: ${formatCurrency(avgCapital)}${cagrText}`;
              }
            }

            // Fallback to backend value if chart data not available
            return `${formatCurrency(summary.totalReturn)} | ${formatPercent(summary.totalReturnPercent)}`;
          })()}
        </div>
      </div>

      {/* Buy & Hold Card */}
      {holdResults && Object.keys(holdResults).length > 0 && (
        <div className="metric-card buy-hold-card">
          <h4>{summary.strategy === 'SHORT_DCA' ? 'Short & Hold' : 'Buy & Hold'}</h4>
          <div className={`metrics ${(holdResults.totalReturn || 0) > 0 ? 'positive' : 'negative'}`}>
            {(() => {
              // Use the final Buy & Hold % from price chart data (same as chart display)
              if (chartData && chartData.length > 0) {
                const finalDataPoint = chartData[chartData.length - 1];
                const buyHoldPercent = finalDataPoint.buyAndHoldPercent;

                if (buyHoldPercent !== null && buyHoldPercent !== undefined) {
                  // Calculate annualized return (CAGR) for Buy & Hold
                  const startDate = new Date(summary.startDate || priceData?.backtestParameters?.startDate);
                  const endDate = new Date(summary.endDate || priceData?.backtestParameters?.endDate);
                  const years = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365.25);

                  let cagrText = '';
                  if (years > 0) {
                    const finalValue = 1 + (buyHoldPercent / 100);
                    if (finalValue > 0) {
                      const cagr = Math.pow(finalValue, 1 / years) - 1;
                      const cagrPercent = cagr * 100;
                      cagrText = ` | CAGR: ${cagrPercent.toFixed(2)}%`;
                    }
                  }

                  // For Buy & Hold, average capital = initial capital (fixed investment)
                  const avgCapital = buyHoldPercent !== 0 ? (holdResults.totalReturn / buyHoldPercent) * 100 : 0;

                  return `${formatCurrency(holdResults.totalReturn)} | ${formatPercent(buyHoldPercent)} | Avg Capital: ${formatCurrency(avgCapital)}${cagrText}`;
                }
              }

              // Fallback to backend value if chart data not available
              return `${formatCurrency(holdResults.totalReturn)} | ${formatPercent(holdResults.totalReturnPercent)}`;
            })()}
          </div>
        </div>
      )}

      {/* Compact Metrics Section */}
      <div className="compact-metrics">
        <span><strong>Final Portfolio:</strong> {formatCurrency(summary.finalValue)}</span>
        <span><strong>Max Capital:</strong> {formatCurrency(summary.totalCost)}</span>
        <span><strong>{summary.strategy === 'SHORT_DCA' ? 'Shorts' : 'Lots'} Held:</strong> {summary.lotsHeld}</span>
        <span><strong>Total Trades:</strong> {summary.totalTrades}</span>
        <span><strong>Win Rate:</strong> {summary.winRate ? formatPercent(summary.winRate) : 'N/A'}</span>
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
            </div>

            {lots.map((lot, index) => {
              const currentPrice = priceData?.dailyPrices?.[priceData.dailyPrices.length - 1]?.close || 0;
              const currentValue = lot.shares * currentPrice;
              const purchaseValue = lot.shares * lot.price;
              const pnl = currentValue - purchaseValue;

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
            </div>

            {shorts.map((short, index) => {
              const currentPrice = priceData?.dailyPrices?.[priceData.dailyPrices.length - 1]?.close || 0;
              const currentValue = short.shares * currentPrice; // Current market value of the shorted shares
              const shortValue = short.shares * short.price; // Original value when shorted
              const pnl = (short.price - currentPrice) * short.shares; // P&L from short position (profit when price goes down)

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

      {/* Performance Metrics Summary */}
      {summary.performanceMetrics && (
        <PerformanceSummary performanceMetrics={summary.performanceMetrics} />
      )}

      {/* Scenario Analysis */}
      {priceData?.scenarioAnalysis && (
        <ScenarioAnalysis scenarioAnalysis={priceData.scenarioAnalysis} />
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
