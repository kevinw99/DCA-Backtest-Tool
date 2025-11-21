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
import ComparisonMetricsTable from './ComparisonMetricsTable';
import ScenarioAnalysis from './ScenarioAnalysis';
import { formatCurrency, formatPercent, formatParameterPercent, formatDate } from '../utils/formatters';
import {
  calculatePNLPercentage,
  findMostRecentTransaction,
  calculateBuyAndHoldPercent,
  getCurrentLots,
  calculateCapitalDeployed
} from '../utils/chartCalculations';
import { getApiUrl } from '../config/api';

const BacktestResults = ({ data, chartData: priceData, metadata }) => {
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

    // Create transaction map by date (exclude aborted events as they don't affect portfolio state)
    const transactionMap = transactionsToUse.reduce((acc, transaction) => {
      if (!['ABORTED_BUY', 'ABORTED_SELL'].includes(transaction.type)) {
        acc[transaction.date] = transaction;
      }
      return acc;
    }, {});

    // Get start price for Buy & Hold calculation
    const startPrice = parseFloat(priceData.dailyPrices[0]?.adjusted_close || priceData.dailyPrices[0]?.close || 0);

    // Check if this is short selling strategy
    const isShortSelling = summary?.strategy === 'SHORT_DCA';

    // Track max capital deployed (only goes up, never down)
    let maxCapitalDeployed = 0;

    return priceData.dailyPrices.map(day => {
      const transaction = transactionMap[day.date];
      const currentPrice = parseFloat(day.adjusted_close || day.close || 0);

      // Calculate Total P&L % and Total P&L for this day
      let totalPNLPercent = null;
      let totalPNL = null;
      let totalCapitalDeployed = 0;

      if (transaction) {
        // Use transaction's portfolio state - handle both long and short positions
        const currentLots = getCurrentLots(transaction);
        totalCapitalDeployed = calculateCapitalDeployed(currentLots, lotSizeUsd);

        // Use totalPNL directly from transaction (matches Enhanced Transaction History table)
        totalPNL = transaction.totalPNL || 0;

        // Track max capital deployed (only increases, never decreases)
        maxCapitalDeployed = Math.max(maxCapitalDeployed, totalCapitalDeployed);

        // Calculate Total P&L % based on MAX capital deployed
        totalPNLPercent = calculatePNLPercentage(totalPNL, maxCapitalDeployed);
      } else {
        // Find most recent transaction for capital deployed calculation
        const mostRecentTransaction = findMostRecentTransaction(transactionsToUse, day.date);

        if (mostRecentTransaction) {
          const currentLots = getCurrentLots(mostRecentTransaction);
          totalCapitalDeployed = calculateCapitalDeployed(currentLots, lotSizeUsd);

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

          // Track max capital deployed (only increases, never decreases)
          maxCapitalDeployed = Math.max(maxCapitalDeployed, totalCapitalDeployed);

          // Calculate Total P&L % based on MAX capital deployed
          totalPNLPercent = calculatePNLPercentage(totalPNL, maxCapitalDeployed);
        }
      }

      // Calculate Buy & Hold P&L % (simple percentage change from start)
      const buyAndHoldPercent = calculateBuyAndHoldPercent(currentPrice, startPrice);

      // Calculate break-even value (capital deployed)
      const breakEvenValue = totalCapitalDeployed;

      // Calculate lots deployed as percentage (0-100%) for the chart
      const maxLotsParam = priceData?.backtestParameters?.maxLots || summary?.maxLots || 10;
      let currentLotsCount = 0;

      if (transaction) {
        // For transaction days, use current transaction's lots
        currentLotsCount = getCurrentLots(transaction);
      } else {
        // For non-transaction days, find most recent transaction
        const recentTx = findMostRecentTransaction(transactionsToUse, day.date);
        if (recentTx) {
          currentLotsCount = getCurrentLots(recentTx);
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
        trailingStopSellMarker: (transaction?.type === 'SELL') ? currentPrice : null,

        // Aborted transaction markers (consecutive buy/sell condition failures)
        abortedBuyMarker: (transaction?.type === 'ABORTED_BUY') ? currentPrice : null,
        abortedSellMarker: (transaction?.type === 'ABORTED_SELL') ? currentPrice : null
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

  // Calculate next potential trades based on current holdings and price
  const calculateFutureTrades = () => {
    const currentPrice = priceData?.dailyPrices?.[priceData.dailyPrices.length - 1]?.close || 0;
    const params = priceData?.backtestParameters;
    const recentPeak = priceData?.recentPeak;
    const recentBottom = priceData?.recentBottom;
    const lastTransactionDate = priceData?.lastTransactionDate;
    const activeTrailingStopSell = priceData?.activeTrailingStopSell;
    const activeTrailingStopBuy = priceData?.activeTrailingStopBuy;

    // DEBUG: Log active stop data
    console.log('🔍 calculateFutureTrades - Active Stop Data:', {
      activeTrailingStopSell,
      activeTrailingStopBuy,
      priceDataKeys: priceData ? Object.keys(priceData) : 'no priceData',
      fullPriceData: priceData
    });

    if (!params || currentPrice === 0) return null;

    const isShortStrategy = summary?.strategy === 'SHORT_DCA';
    const hasHoldings = isShortStrategy ? shorts.length > 0 : lots.length > 0;

    // Calculate average cost for sell activation
    let avgCost = 0;
    if (hasHoldings) {
      if (isShortStrategy) {
        const totalValue = shorts.reduce((sum, short) => sum + (short.price * short.shares), 0);
        const totalShares = shorts.reduce((sum, short) => sum + short.shares, 0);
        avgCost = totalShares > 0 ? totalValue / totalShares : 0;
      } else {
        const totalValue = lots.reduce((sum, lot) => sum + (lot.price * lot.shares), 0);
        const totalShares = lots.reduce((sum, lot) => sum + lot.shares, 0);
        avgCost = totalShares > 0 ? totalValue / totalShares : 0;
      }
    }

    // Check if there's an active trailing buy stop
    let buyActivation = null;
    if (activeTrailingStopBuy && activeTrailingStopBuy.isActive) {
      // Active trailing stop buy exists - show its current state
      buyActivation = {
        isActive: true,
        stopPrice: activeTrailingStopBuy.stopPrice,
        lowestPrice: activeTrailingStopBuy.lowestPrice,
        recentPeakReference: activeTrailingStopBuy.recentPeakReference,
        reboundPercent: isShortStrategy ? params.trailingShortPullbackPercent : params.trailingBuyReboundPercent,
        description: isShortStrategy ? 'Active SHORT Stop' : 'Active BUY Stop'
      };
    } else {
      // No active stop - show theoretical activation
      const buyActivationPrice = recentPeak ?
        recentPeak * (1 - (isShortStrategy ? params.trailingShortActivationPercent : params.trailingBuyActivationPercent)) :
        currentPrice * (1 - (isShortStrategy ? params.trailingShortActivationPercent : params.trailingBuyActivationPercent));

      buyActivation = {
        isActive: false,
        activationPercent: isShortStrategy ? params.trailingShortActivationPercent : params.trailingBuyActivationPercent,
        reboundPercent: isShortStrategy ? params.trailingShortPullbackPercent : params.trailingBuyReboundPercent,
        activationPrice: buyActivationPrice,
        referencePrice: recentPeak || currentPrice,
        description: isShortStrategy ? 'Next SHORT' : 'Next BUY'
      };
    }

    // Check if there's an active trailing sell stop
    let sellActivation = null;
    if (hasHoldings) {
      console.log('🔍 Checking SELL activation - hasHoldings:', hasHoldings, 'activeTrailingStopSell:', activeTrailingStopSell);
      if (activeTrailingStopSell && activeTrailingStopSell.isActive) {
        console.log('✅ ACTIVE SELL STOP DETECTED!', activeTrailingStopSell);
        // Active trailing stop exists - show its current state
        sellActivation = {
          isActive: true,
          stopPrice: activeTrailingStopSell.stopPrice,
          limitPrice: activeTrailingStopSell.limitPrice,
          highestPrice: activeTrailingStopSell.highestPrice,
          lastUpdatePrice: activeTrailingStopSell.lastUpdatePrice,
          recentBottomReference: activeTrailingStopSell.recentBottomReference,
          pullbackPercent: isShortStrategy ? params.trailingCoverReboundPercent : params.trailingSellPullbackPercent,
          profitRequirement: avgCost * (1 + params.profitRequirement),
          description: isShortStrategy ? 'Active COVER Stop' : 'Active SELL Stop'
        };
        console.log('✅ sellActivation object created:', sellActivation);
      } else {
        console.log('❌ NO ACTIVE SELL STOP - showing theoretical');
        // No active stop - show theoretical activation price
        const sellActivationPrice = recentBottom ?
          recentBottom * (1 + (isShortStrategy ? params.trailingCoverActivationPercent : params.trailingSellActivationPercent)) :
          currentPrice * (1 + (isShortStrategy ? params.trailingCoverActivationPercent : params.trailingSellActivationPercent));

        sellActivation = {
          isActive: false,
          activationPercent: isShortStrategy ? params.trailingCoverActivationPercent : params.trailingSellActivationPercent,
          pullbackPercent: isShortStrategy ? params.trailingCoverReboundPercent : params.trailingSellPullbackPercent,
          activationPrice: sellActivationPrice,
          referencePrice: recentBottom || currentPrice,
          profitRequirement: avgCost * (1 + params.profitRequirement),
          description: isShortStrategy ? 'Next COVER' : 'Next SELL'
        };
      }
    }

    return {
      currentPrice,
      avgCost,
      hasHoldings,
      isShortStrategy,
      recentPeak,
      recentBottom,
      lastTransactionDate,
      // BUY direction (for LONG) or SHORT direction (for SHORT strategy)
      buyActivation: buyActivation,
      // SELL direction (for LONG) or COVER direction (for SHORT strategy)
      sellActivation: sellActivation
    };
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

    // Return plain text string with separator instead of JSX
    return details.join(' | ');
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

    // Return plain text string with separator instead of JSX
    return details.join(' | ');
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
    // Exclude aborted events from the map as they don't affect portfolio state
    const transactionMap = new Map();
    transactionsToUse.forEach(transaction => {
      if (!['ABORTED_BUY', 'ABORTED_SELL'].includes(transaction.type)) {
        transactionMap.set(transaction.date, transaction);
      }
    });

    // Initialize max capital deployed tracking (only goes up, never down)
    let maxCapitalDeployed = 0;

    return pricesData.map((daily) => {
      const date = daily.date;
      const currentPrice = parseFloat(daily.adjusted_close || daily.close || 0);
      const transaction = transactionMap.get(date);

      // If there's a transaction on this date, use its calculated portfolio state
      // (Aborted events are already filtered out when creating the map)
      if (transaction) {
        // Get the number of positions from lotsAfterTransaction or shortsAfterTransaction
        const currentLots = getCurrentLots(transaction);

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
        const buyAndHoldPercent = calculateBuyAndHoldPercent(currentPrice, startPrice);

        // Track max capital deployed (only increases, never decreases)
        const currentCapitalDeployed = calculateCapitalDeployed(currentLots, lotSizeUsd);
        maxCapitalDeployed = Math.max(maxCapitalDeployed, currentCapitalDeployed);

        // Calculate Total P&L % based on MAX capital deployed
        const totalPNLPercent = calculatePNLPercentage(totalPNL, maxCapitalDeployed);

        // Calculate lots deployed as percentage (0-100%)
        const lotsDeployedPercent = maxLots > 0 ? (currentLots / maxLots) * 100 : 0;

        return {
          date: formatDate(date),
          totalPNL: totalPNL,
          totalPNLPercent: totalPNLPercent,
          currentCapitalDeployed: currentCapitalDeployed,
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
      // Find the most recent transaction before this date (skip aborted events)
      const mostRecentTransaction = findMostRecentTransaction(transactionsToUse, date);

      if (mostRecentTransaction) {
        const currentLots = getCurrentLots(mostRecentTransaction);

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
        const buyAndHoldPercent = calculateBuyAndHoldPercent(currentPrice, startPrice);

        // Track max capital deployed (only increases, never decreases)
        const currentCapitalDeployed = calculateCapitalDeployed(currentLots, lotSizeUsd);
        maxCapitalDeployed = Math.max(maxCapitalDeployed, currentCapitalDeployed);

        // Calculate Total P&L % based on MAX capital deployed
        const totalPNLPercent = calculatePNLPercentage(totalPNL, maxCapitalDeployed);

        // Calculate lots deployed as percentage (0-100%)
        const lotsDeployedPercent = maxLots > 0 ? (currentLots / maxLots) * 100 : 0;

        return {
          date: formatDate(date),
          totalPNL: totalPNL,
          totalPNLPercent: totalPNLPercent,
          currentCapitalDeployed: currentCapitalDeployed,
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
      const buyAndHoldPercent = calculateBuyAndHoldPercent(currentPrice, startPrice);

      // No capital deployed yet - maxCapitalDeployed stays at 0

      return {
        date: new Date(date).toLocaleDateString(),
        totalPNL: 0,
        totalPNLPercent: null,
        currentCapitalDeployed: 0,
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

      {/* API Test Command */}
      {priceData?.backtestParameters && (
        <div className="api-url-section" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '16px' }}>Backend API Test Command</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              readOnly
              value={(() => {
                // Generate curl command for testing the backend API
                // The backend expects POST with JSON body (not GET with query params)
                const jsonBody = JSON.stringify(priceData.backtestParameters, null, 2);
                return `curl -X POST ${getApiUrl('/api/backtest/dca')} -H "Content-Type: application/json" -d '${jsonBody.replace(/\n/g, ' ')}'`;
              })()}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '13px',
                fontFamily: 'monospace',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white'
              }}
              onClick={(e) => e.target.select()}
            />
            <button
              onClick={() => {
                const jsonBody = JSON.stringify(priceData.backtestParameters, null, 2);
                const curlCommand = `curl -X POST ${getApiUrl('/api/backtest/dca')} -H "Content-Type: application/json" -d '${jsonBody.replace(/\n/g, ' ')}'`;
                navigator.clipboard.writeText(curlCommand);
                alert('Curl command copied to clipboard!');
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Copy Command
            </button>
          </div>
          <p style={{ marginTop: '8px', marginBottom: 0, fontSize: '12px', color: '#666' }}>
            Use this curl command to test the backend API directly from terminal
          </p>
        </div>
      )}

      {/* Portfolio Context Banner */}
      {metadata && metadata.source === 'portfolio' && metadata.standaloneTestUrl && (
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          border: '2px solid #2196F3'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '16px', color: '#1976D2' }}>
            📊 Portfolio Drill-Down Results
          </h3>
          <p style={{ marginBottom: '10px', fontSize: '14px', color: '#555' }}>
            These results show how <strong>{summary.symbol}</strong> performed within the portfolio backtest
            (Portfolio Capital: {formatCurrency(metadata.portfolioCapital || 0)})
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1976D2' }}>
              Run Standalone Test:
            </span>
            <a
              href={metadata.standaloneTestUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '8px 16px',
                backgroundColor: '#2196F3',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              🔗 Test {summary.symbol} Without Portfolio Constraints
            </a>
          </div>
          <p style={{ marginTop: '8px', marginBottom: 0, fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
            {metadata.standaloneTestNote || 'Test this stock with the same parameters but without portfolio capital constraints'}
          </p>
        </div>
      )}

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
              <span className="parameter-label">Consecutive Incremental Buy Grid</span>
              <span className="parameter-value">{priceData.backtestParameters.enableConsecutiveIncrementalBuyGrid ? 'Enabled' : 'Disabled'}</span>
            </div>
            {priceData.backtestParameters.enableConsecutiveIncrementalBuyGrid && (
              <div className="parameter-card">
                <span className="parameter-label">Grid Consecutive Increment</span>
                <span className="parameter-value">{formatParameterPercent(priceData.backtestParameters.gridConsecutiveIncrement)}</span>
              </div>
            )}
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
                strokeWidth={1.5}
                dot={false}
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
                  <Scatter
                    yAxisId="price"
                    dataKey="abortedBuyMarker"
                    fill="#90EE90"
                    shape="circle"
                    name="Aborted Buy"
                  />
                  <Scatter
                    yAxisId="price"
                    dataKey="abortedSellMarker"
                    fill="#FFB6C1"
                    shape="circle"
                    name="Aborted Sell"
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
                strokeWidth={1}
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
        <div className={`metrics-grid ${getMetricClass(summary.totalReturnPercent)}`}>
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

                let cagr = null;
                if (years > 0) {
                  const finalValue = 1 + (returnPercent / 100);
                  if (finalValue > 0) {
                    cagr = Math.pow(finalValue, 1 / years) - 1;
                  }
                }

                // Get average capital deployed from backend performance metrics
                const avgCapital = summary.performanceMetrics?.avgDeployedCapital || 0;

                return (
                  <>
                    <span className="metric-value">{formatCurrency(summary.totalReturn)}</span>
                    <span className="metric-separator">|</span>
                    <span className="metric-value">{formatPercent(returnPercent)}</span>
                    <span className="metric-separator">|</span>
                    <span className="metric-label">Avg Capital:</span>
                    <span className="metric-value">{formatCurrency(avgCapital)}</span>
                    {cagr !== null && (
                      <>
                        <span className="metric-separator">|</span>
                        <span className="metric-label">CAGR:</span>
                        <span className="metric-value">{(cagr * 100).toFixed(2)}%</span>
                      </>
                    )}
                  </>
                );
              }
            }

            // Fallback to backend value if chart data not available
            return (
              <>
                <span className="metric-value">{formatCurrency(summary.totalReturn)}</span>
                <span className="metric-separator">|</span>
                <span className="metric-value">{formatPercent(summary.totalReturnPercent)}</span>
              </>
            );
          })()}
        </div>
      </div>

      {/* Buy & Hold Card */}
      {holdResults && Object.keys(holdResults).length > 0 && (
        <div className="metric-card buy-hold-card">
          <h4>{summary.strategy === 'SHORT_DCA' ? 'Short & Hold' : 'Buy & Hold'}</h4>
          <div className={`metrics-grid ${(holdResults.totalReturn || 0) > 0 ? 'positive' : 'negative'}`}>
            {(() => {
              // For Buy & Hold, use fixed capital (lotSizeUsd * maxLots)
              const lotSizeUsd = priceData?.backtestParameters?.lotSizeUsd || summary?.lotSizeUsd || 10000;
              const maxLots = priceData?.backtestParameters?.maxLots || summary?.maxLots || 10;
              const fixedCapital = lotSizeUsd * maxLots;

              // Calculate CAGR from total return % (same method as DCA for consistency)
              const returnPercent = holdResults.totalReturnPercent;
              let cagr = null;

              if (returnPercent !== null && returnPercent !== undefined) {
                const startDate = new Date(summary.startDate || priceData?.backtestParameters?.startDate);
                const endDate = new Date(summary.endDate || priceData?.backtestParameters?.endDate);
                const years = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365.25);

                if (years > 0) {
                  const finalValue = 1 + (returnPercent / 100);
                  if (finalValue > 0) {
                    cagr = Math.pow(finalValue, 1 / years) - 1;
                  }
                }
              }

              return (
                <>
                  <span className="metric-value">{formatCurrency(holdResults.totalReturn)}</span>
                  <span className="metric-separator">|</span>
                  <span className="metric-value">{formatPercent(holdResults.totalReturnPercent)}</span>
                  <span className="metric-separator">|</span>
                  <span className="metric-label">Capital:</span>
                  <span className="metric-value">{formatCurrency(fixedCapital)}</span>
                  {cagr !== null && (
                    <>
                      <span className="metric-separator">|</span>
                      <span className="metric-label">CAGR:</span>
                      <span className="metric-value">{(cagr * 100).toFixed(2)}%</span>
                    </>
                  )}
                </>
              );
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
        {summary.consecutiveIncrementalBuyGridStats?.enabled && (
          <>
            <span><strong>Max Consecutive Buys:</strong> {summary.consecutiveIncrementalBuyGridStats.maxConsecutiveBuyCount}</span>
            <span><strong>Avg Grid Size Used:</strong> {(summary.consecutiveIncrementalBuyGridStats.avgGridSizeUsed * 100).toFixed(1)}%</span>
          </>
        )}
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
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Price</th>
                  <th>Trailing Stop Buy</th>
                  <th>Trailing Stop Sell</th>
                  <th>Shares</th>
                  <th>Grid Size</th>
                  <th>Profit Req</th>
                  <th>Value</th>
                  <th>Lots</th>
                  <th>Avg Cost</th>
                  <th>Holdings Value</th>
                  <th>Unrealized P&L</th>
                  <th>Realized P&L</th>
                  <th>Total P&L</th>
                  <th>Total P&L %</th>
                </tr>
              </thead>
              <tbody>

            {(() => {
              // Debug: Log transaction filtering
              console.log('🔍 Enhanced Transaction History Filtering:');
              console.log(`  Total enhanced transactions: ${enhancedTransactions.length}`);

              // Filter out aborted transactions - they can have type='ABORTED_SELL'/'ABORTED_BUY' OR have shares=0 (aborted)
              const abortedTxs = enhancedTransactions.filter(tx =>
                tx.type.includes('ABORTED') ||
                (tx.shares !== undefined && tx.shares === 0)
              );
              const filteredTxs = enhancedTransactions.filter(tx =>
                !tx.type.includes('ABORTED') &&
                !(tx.shares !== undefined && tx.shares === 0)
              );

              console.log(`  Aborted transactions: ${abortedTxs.length}`);
              console.log(`  Filtered transactions (displayed): ${filteredTxs.length}`);

              if (abortedTxs.length > 0) {
                console.log('  📛 Aborted transaction types:');
                abortedTxs.forEach(tx => {
                  console.log(`    - ${tx.date}: ${tx.type}`);
                });
              }

              // Sample of all transaction types
              const txTypes = [...new Set(enhancedTransactions.map(tx => tx.type))];
              console.log(`  Transaction types in data: ${txTypes.join(', ')}`);

              const getTransactionIcon = (type) => {
                if (type === 'SELL') return <><TrendingDown size={16} /> SELL</>;
                if (type === 'SHORT') return <><TrendingDown size={16} /> SHORT</>;
                if (type === 'COVER') return <><TrendingUp size={16} /> COVER</>;
                if (type === 'EMERGENCY_COVER') return <><TrendingUp size={16} /> EMERGENCY COVER</>;
                if (type === 'TRAILING_STOP_LIMIT_SHORT') return <><TrendingDown size={16} /> TRAIL SHORT</>;
                if (type === 'TRAILING_STOP_LIMIT_BUY') return <><TrendingUp size={16} /> BUY</>;
                if (type === 'OCO_LIMIT_BUY') return <><TrendingUp size={16} /> OCO LIMIT</>;
                if (type === 'OCO_TRAILING_BUY') return <><TrendingUp size={16} /> OCO TRAIL</>;
                if (type === 'ABORTED_BUY') return <><span style={{color: '#90EE90'}}>🚫</span> ABORTED BUY</>;
                if (type === 'ABORTED_SELL') return <><span style={{color: '#FFB6C1'}}>🚫</span> ABORTED SELL</>;
                // Debug: Log unknown transaction types
                if (type && !['SELL', 'SHORT', 'COVER', 'EMERGENCY_COVER', 'TRAILING_STOP_LIMIT_SHORT', 'TRAILING_STOP_LIMIT_BUY', 'OCO_LIMIT_BUY', 'OCO_TRAILING_BUY', 'BUY', 'INITIAL_BUY', 'ABORTED_BUY', 'ABORTED_SELL'].includes(type)) {
                  console.warn('🐛 Unknown transaction type:', type);
                }
                return <><TrendingUp size={16} /> BUY</>;
              };

              return filteredTxs.map((transaction, index) => (
                <tr key={index} className={`table-row ${transaction.type.toLowerCase().replace('_', '-')}`}>
                  <td>{formatDate(transaction.date, 'long')}</td>
                  <td className={`transaction-type ${transaction.type.toLowerCase()}`}>
                    {getTransactionIcon(transaction.type)}
                  </td>
                  <td>{formatCurrency(transaction.price)}</td>
                  <td className="trailing-stop-buy-details">
                    {transaction.type === 'TRAILING_STOP_LIMIT_BUY' ? formatTrailingStopBuyDetails(transaction.trailingStopDetail) :
                     transaction.type === 'ABORTED_BUY' ? <span style={{color: '#90EE90', fontSize: '0.85em'}}>{transaction.abortReason}</span> : ''}
                  </td>
                  <td className="trailing-stop-sell-details">
                    {transaction.type === 'SELL' ? formatTrailingStopSellDetails(transaction.trailingStopDetail) :
                     transaction.type === 'ABORTED_SELL' ? <span style={{color: '#FFB6C1', fontSize: '0.85em'}}>{transaction.abortReason}</span> : ''}
                  </td>
                  <td>{transaction.shares !== undefined ? transaction.shares.toFixed(4) : 'N/A'}</td>
                  <td>
                    {(transaction.type === 'TRAILING_STOP_LIMIT_BUY' || transaction.type === 'ABORTED_BUY') && transaction.buyGridSize !== undefined
                      ? `${(transaction.buyGridSize * 100).toFixed(1)}%`
                      : '-'}
                  </td>
                  <td>
                    {(transaction.type === 'SELL' || transaction.type === 'ABORTED_SELL') && transaction.lotProfitRequirement !== undefined
                      ? `${(transaction.lotProfitRequirement * 100).toFixed(1)}%`
                      : '-'}
                  </td>
                  <td>{formatCurrency(transaction.value)}</td>
                  <td className="lots-column">
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
                  </td>
                  <td>{transaction.averageCost ? formatCurrency(transaction.averageCost) : 'N/A'}</td>
                  <td>
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
                  </td>
                  <td className={getMetricClass(transaction.unrealizedPNL)}>
                    {formatCurrency(transaction.unrealizedPNL)}
                  </td>
                  <td className={getMetricClass(transaction.realizedPNL)}>
                    {formatCurrency(transaction.realizedPNL)}
                    {transaction.realizedPNLFromTrade !== 0 && (
                      <small className={getMetricClass(transaction.realizedPNLFromTrade)}>
                        {transaction.realizedPNLFromTrade >= 0 ? ' (+' : ' ('}{formatCurrency(Math.abs(transaction.realizedPNLFromTrade))})
                      </small>
                    )}
                  </td>
                  <td className={getMetricClass(transaction.totalPNL)}>
                    {formatCurrency(transaction.totalPNL)}
                  </td>
                  <td className={getMetricClass(transaction.totalPNL)}>
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
                  </td>
                </tr>
              ));
            })()}
              </tbody>
            </table>
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
                <div>{formatDate(transaction.date, 'long')}</div>
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
                  <div>{formatDate(lot.date, 'long')}</div>
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
                  <div>{formatDate(short.date, 'long')}</div>
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

      {/* Future Trade Section */}
      {(() => {
        const futureTrades = calculateFutureTrades();
        if (!futureTrades) return null;

        const { currentPrice, avgCost, hasHoldings, isShortStrategy, buyActivation, sellActivation } = futureTrades;
        const currentPriceDate = priceData?.dailyPrices?.[priceData.dailyPrices.length - 1]?.date || 'N/A';

        // Helper function to calculate distance between current price and target price
        const calculateDistance = (targetPrice) => {
          if (!targetPrice || !currentPrice) return null;
          const diff = targetPrice - currentPrice;
          const pct = (diff / currentPrice) * 100;
          return { diff, pct };
        };

        return (
          <div className="holdings-section future-trades-section">
            <h3>
              <Target size={20} />
              Future Trade
            </h3>

            <div className="future-trade-card">
              <div className="card-header" style={{ cursor: 'default' }}>
                <h4>{summary.symbol}</h4>
                <div className="header-info">
                  <span>Current: {formatCurrency(currentPrice)} as of {currentPriceDate}</span>
                  <span className={hasHoldings ? 'has-holdings' : 'no-holdings'}>
                    {hasHoldings ? `Holdings: ${formatCurrency(avgCost)} avg` : 'No Holdings'}
                  </span>
                </div>
              </div>

              <div className="card-body">
                <div className="current-price-section">
                  <div><span className="label">Current Price:</span> <span className="value">{formatCurrency(currentPrice)}</span></div>
                  {hasHoldings && <div><span className="label">Avg Cost:</span> <span className="value">{formatCurrency(avgCost)}</span></div>}
                </div>
                <div className="trade-directions">
                  {/* BUY Direction */}
                  <div className={`buy-section ${buyActivation.isActive ? 'is-active' : 'is-pending'}`}>
                    <h5>
                      <TrendingDown size={16} />
                      {buyActivation.description}
                      <span className="status-badge">
                        {buyActivation.isActive ? 'ACTIVE TRACKING' : 'PENDING'}
                      </span>
                    </h5>
                    {buyActivation.isActive ? (
                      <>
                        <div className="active-stop">
                          <div>
                            <span className="label">Stop Price:</span>
                            <span className="value">{formatCurrency(buyActivation.stopPrice)}</span>
                            {(() => {
                              const dist = calculateDistance(buyActivation.stopPrice);
                              return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                            })()}
                          </div>
                          <div className="detail">
                            {formatParameterPercent(buyActivation.reboundPercent)} rebound
                            from {formatCurrency(buyActivation.lowestPrice)}
                          </div>
                        </div>
                        <div>
                          <span className="label">Lowest Price:</span>
                          <span className="value">{formatCurrency(buyActivation.lowestPrice)}</span>
                          {(() => {
                            const dist = calculateDistance(buyActivation.lowestPrice);
                            return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                          })()}
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="label">Activates at:</span>
                          <span className="value">{formatCurrency(buyActivation.activationPrice)}</span>
                          {(() => {
                            const dist = calculateDistance(buyActivation.activationPrice);
                            return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                          })()}
                        </div>
                        <div className="detail">
                          {formatParameterPercent(buyActivation.activationPercent)} drop
                          from {formatCurrency(buyActivation.referencePrice)}
                        </div>
                        <div>
                          <span className="label">Reference Price:</span>
                          <span className="value">{formatCurrency(buyActivation.referencePrice)}</span>
                          {(() => {
                            const dist = calculateDistance(buyActivation.referencePrice);
                            return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                          })()}
                        </div>
                        <div>
                          <span className="label">Executes on:</span>
                          <span className="value">
                            {formatParameterPercent(buyActivation.reboundPercent)} rebound
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* SELL Direction */}
                  {sellActivation ? (
                    <div className={`sell-section ${sellActivation.isActive ? 'is-active' : 'is-pending'}`}>
                      <h5>
                        <TrendingUp size={16} />
                        {sellActivation.description}
                        <span className="status-badge">
                          {sellActivation.isActive ? 'ACTIVE TRACKING' : 'PENDING'}
                        </span>
                      </h5>
                      {sellActivation.isActive ? (
                        <>
                          <div className="active-stop">
                            <div>
                              <span className="label">Stop Price:</span>
                              <span className="value">{formatCurrency(sellActivation.stopPrice)}</span>
                              {(() => {
                                const dist = calculateDistance(sellActivation.stopPrice);
                                return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                              })()}
                            </div>
                            <div className="detail">
                              {formatParameterPercent(sellActivation.pullbackPercent)} pullback
                              from {formatCurrency(sellActivation.lastUpdatePrice)}
                            </div>
                          </div>
                          {sellActivation.limitPrice && (
                            <div>
                              <span className="label">Limit Price:</span>
                              <span className="value">{formatCurrency(sellActivation.limitPrice)}</span>
                              {(() => {
                                const dist = calculateDistance(sellActivation.limitPrice);
                                return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                              })()}
                            </div>
                          )}
                          <div>
                            <span className="label">Last Update Price:</span>
                            <span className="value">{formatCurrency(sellActivation.lastUpdatePrice)}</span>
                            {(() => {
                              const dist = calculateDistance(sellActivation.lastUpdatePrice);
                              return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                            })()}
                          </div>
                          <div>
                            <span className="label">Profit target:</span>
                            <span className="value">{formatCurrency(sellActivation.profitRequirement)}</span>
                            {(() => {
                              const dist = calculateDistance(sellActivation.profitRequirement);
                              return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                            })()}
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span className="label">Activates at:</span>
                            <span className="value">{formatCurrency(sellActivation.activationPrice)}</span>
                            {(() => {
                              const dist = calculateDistance(sellActivation.activationPrice);
                              return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↑'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                            })()}
                          </div>
                          <div className="detail">
                            {formatParameterPercent(sellActivation.activationPercent)} rise
                            from {formatCurrency(sellActivation.referencePrice)}
                          </div>
                          <div>
                            <span className="label">Reference Price:</span>
                            <span className="value">{formatCurrency(sellActivation.referencePrice)}</span>
                            {(() => {
                              const dist = calculateDistance(sellActivation.referencePrice);
                              return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                            })()}
                          </div>
                          <div>
                            <span className="label">Then trails:</span>
                            <span className="value">
                              {formatParameterPercent(sellActivation.pullbackPercent)} pullback
                            </span>
                          </div>
                          <div>
                            <span className="label">Profit target:</span>
                            <span className="value">{formatCurrency(sellActivation.profitRequirement)}</span>
                            {(() => {
                              const dist = calculateDistance(sellActivation.profitRequirement);
                              return dist && <span className="distance">{dist.pct >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(dist.diff))} ({formatParameterPercent(Math.abs(dist.pct / 100))})</span>;
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="sell-section disabled">
                      <h5>Next {isShortStrategy ? 'COVER' : 'SELL'}</h5>
                      <p>No holdings to sell</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* Performance Metrics Comparison */}
      {summary.performanceMetrics && holdResults && (
        <ComparisonMetricsTable
          dcaMetrics={summary}
          buyAndHoldMetrics={holdResults}
        />
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
