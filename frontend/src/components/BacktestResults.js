import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Clock, Eye, EyeOff } from 'lucide-react';
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

    const { transactions, enhancedTransactions } = data;

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

    return priceData.dailyPrices.map(day => {
      const transaction = transactionMap[day.date];

      return {
        date: day.date,
        price: parseFloat(day.adjusted_close || day.close || 0),
        ma20: day.ma_20,
        ma50: day.ma_50,
        ma200: day.ma_200,
        rsi: day.rsi_14,
        volatility: day.volatility_20 ? day.volatility_20 * 100 : null,
        transaction: transaction,

        // Different buy markers based on transaction type
        regularBuyMarker: (transaction?.type === 'BUY' && !transaction?.ocoOrderDetail && !transaction?.trailingStopDetail) ? parseFloat(day.adjusted_close || day.close || 0) : null,
        trailingStopBuyMarker: (transaction?.type === 'TRAILING_STOP_LIMIT_BUY') ? parseFloat(day.adjusted_close || day.close || 0) : null,
        ocoLimitBuyMarker: (transaction?.type === 'OCO_LIMIT_BUY' || (transaction?.type === 'BUY' && transaction?.ocoOrderDetail?.type === 'LIMIT_BUY')) ? parseFloat(day.adjusted_close || day.close || 0) : null,
        ocoTrailingBuyMarker: (transaction?.type === 'OCO_TRAILING_BUY' || (transaction?.type === 'BUY' && transaction?.ocoOrderDetail?.type === 'TRAILING_BUY')) ? parseFloat(day.adjusted_close || day.close || 0) : null,
        sellMarker: transaction?.type === 'SELL' ? parseFloat(day.adjusted_close || day.close || 0) : null
      };
    });
  }, [data, priceData]);

  if (!data) {
    return <div>No backtest results available</div>;
  }

  const { summary, transactions, dailyPrices, lots, transactionLog, enhancedTransactions, tradeAnalysis, buyAndHoldResults, outperformance, outperformancePercent } = data;

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

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      return (
        <div className="chart-tooltip">
          <p className="tooltip-date">{formatDate(label)}</p>
          <p className="tooltip-price">Price: {formatCurrency(parseFloat(data.price) || 0)}</p>

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

          {visibleIndicators.ma20 && data.ma20 && (
            <p className="tooltip-indicator">MA20: {formatCurrency(parseFloat(data.ma20) || 0)}</p>
          )}
          {visibleIndicators.ma50 && data.ma50 && (
            <p className="tooltip-indicator">MA50: {formatCurrency(parseFloat(data.ma50) || 0)}</p>
          )}
          {visibleIndicators.ma200 && data.ma200 && (
            <p className="tooltip-indicator">MA200: {formatCurrency(parseFloat(data.ma200) || 0)}</p>
          )}
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
    if (!dailyPrices || dailyPrices.length === 0) return [];

    // Create a map of transaction dates for marking buy/sell points
    const transactionMap = new Map();
    transactions.forEach(transaction => {
      const date = transaction.date;
      if (!transactionMap.has(date)) {
        transactionMap.set(date, []);
      }
      transactionMap.get(date).push(transaction);
    });

    // For now, we'll create a simple portfolio value simulation
    // In a real implementation, this would come from the backend
    let portfolioValue = 0;
    let investedAmount = 0;

    return dailyPrices.map((daily, index) => {
      const date = daily.date;
      const price = daily.price;

      // Simulate portfolio value based on transactions
      const dayTransactions = transactionMap.get(date) || [];
      dayTransactions.forEach(transaction => {
        if (transaction.type === 'BUY') {
          investedAmount += transaction.value;
          portfolioValue += transaction.value;
        } else if (transaction.type === 'SELL') {
          // For sells, adjust portfolio value based on current price
          portfolioValue = portfolioValue * (price / (portfolioValue / investedAmount));
        }
      });

      // For dates without transactions, update portfolio value based on price changes
      if (index > 0 && portfolioValue > 0) {
        const previousPrice = dailyPrices[index - 1].price;
        const priceChange = price / previousPrice;
        portfolioValue = portfolioValue * priceChange;
      }

      const hasBuy = dayTransactions.some(t => t.type === 'BUY');
      const hasSell = dayTransactions.some(t => t.type === 'SELL');

      return {
        date: new Date(date).toLocaleDateString(),
        portfolioValue: portfolioValue || summary.finalValue / dailyPrices.length * (index + 1), // Fallback calculation
        stockPrice: price,
        investedAmount,
        hasBuy,
        hasSell
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

      {/* Price Chart Section */}
      {processedChartData.length > 0 && (
        <div className="chart-section">
          <div className="chart-header">
            <h3>
              <TrendingUp size={20} />
              Price Chart with Transaction Markers
            </h3>
            <div className="indicator-toggles">
              <button
                className={`indicator-toggle ${visibleIndicators.ma20 ? 'active' : ''}`}
                onClick={() => toggleIndicator('ma20')}
              >
                {visibleIndicators.ma20 ? <Eye size={16} /> : <EyeOff size={16} />}
                MA20
              </button>
              <button
                className={`indicator-toggle ${visibleIndicators.ma50 ? 'active' : ''}`}
                onClick={() => toggleIndicator('ma50')}
              >
                {visibleIndicators.ma50 ? <Eye size={16} /> : <EyeOff size={16} />}
                MA50
              </button>
              <button
                className={`indicator-toggle ${visibleIndicators.ma200 ? 'active' : ''}`}
                onClick={() => toggleIndicator('ma200')}
              >
                {visibleIndicators.ma200 ? <Eye size={16} /> : <EyeOff size={16} />}
                MA200
              </button>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={processedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#666"
              />
              <YAxis
                domain={['dataMin - 10', 'dataMax + 10']}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
                stroke="#666"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {/* Price line */}
              <Line
                type="monotone"
                dataKey="price"
                stroke="#2d3748"
                strokeWidth={2}
                dot={false}
                name="Stock Price"
              />

              {/* Moving averages */}
              {visibleIndicators.ma20 && (
                <Line
                  type="monotone"
                  dataKey="ma20"
                  stroke="#f56565"
                  strokeWidth={1}
                  dot={false}
                  strokeDasharray="5 5"
                  name="MA20"
                />
              )}
              {visibleIndicators.ma50 && (
                <Line
                  type="monotone"
                  dataKey="ma50"
                  stroke="#ed8936"
                  strokeWidth={1}
                  dot={false}
                  strokeDasharray="10 5"
                  name="MA50"
                />
              )}
              {visibleIndicators.ma200 && (
                <Line
                  type="monotone"
                  dataKey="ma200"
                  stroke="#9f7aea"
                  strokeWidth={1}
                  dot={false}
                  strokeDasharray="15 5"
                  name="MA200"
                />
              )}

              {/* Transaction markers */}
              <Scatter
                dataKey="regularBuyMarker"
                fill="#38a169"
                shape="triangle"
                name="Regular Buy"
              />
              <Scatter
                dataKey="trailingStopBuyMarker"
                fill="#0891b2"
                shape="star"
                name="Trailing Stop Buy"
              />
              <Scatter
                dataKey="ocoLimitBuyMarker"
                fill="#7c3aed"
                shape="square"
                name="OCO Limit Buy"
              />
              <Scatter
                dataKey="ocoTrailingBuyMarker"
                fill="#2563eb"
                shape="diamond"
                name="OCO Trailing Buy"
              />
              <Scatter
                dataKey="sellMarker"
                fill="#e53e3e"
                shape="triangleDown"
                name="Sell"
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
            {formatPercent(summary.totalReturnPercent)}
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
          <h4>Lots Held</h4>
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
      {(tradeAnalysis || buyAndHoldResults) && (
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
                  <p className={`value ${tradeAnalysis.averageAnnualizedReturnPercent > 0 ? 'positive' : 'negative'}`}>
                    {tradeAnalysis.averageAnnualizedReturnPercent?.toFixed(2)}%
                  </p>
                  <small>All positions (trades + holdings)</small>
                </div>
                <div className="comparison-card">
                  <h4>Completed Trades Only</h4>
                  <p className={`value ${tradeAnalysis.tradeOnlyAverageAnnualizedReturnPercent > 0 ? 'positive' : 'negative'}`}>
                    {tradeAnalysis.tradeOnlyAverageAnnualizedReturnPercent?.toFixed(2)}%
                  </p>
                  <small>{tradeAnalysis.individualTradeReturns?.length || 0} trades</small>
                </div>
                <div className="comparison-card">
                  <h4>Current Holdings Only</h4>
                  <p className={`value ${tradeAnalysis.holdingOnlyAverageAnnualizedReturnPercent > 0 ? 'positive' : 'negative'}`}>
                    {tradeAnalysis.holdingOnlyAverageAnnualizedReturnPercent?.toFixed(2)}%
                  </p>
                  <small>{tradeAnalysis.currentHoldingReturns?.length || 0} holdings</small>
                </div>
              </>
            )}
            {buyAndHoldResults && (
              <>
                <div className="comparison-card buy-hold">
                  <h4>Buy & Hold Strategy</h4>
                  <p className={`value ${buyAndHoldResults.totalReturnPercent > 0 ? 'positive' : 'negative'}`}>
                    {buyAndHoldResults.annualizedReturnPercent?.toFixed(2)}% annualized
                  </p>
                  <small>Final Value: {formatCurrency(buyAndHoldResults.finalValue)}</small>
                </div>
                <div className="comparison-card outperformance">
                  <h4>DCA vs Buy & Hold</h4>
                  <p className={`value ${outperformancePercent > 0 ? 'positive' : 'negative'}`}>
                    {outperformancePercent > 0 ? '+' : ''}{outperformancePercent?.toFixed(2)}%
                  </p>
                  <small>{outperformance > 0 ? 'Outperforming' : 'Underperforming'} by {formatCurrency(Math.abs(outperformance))}</small>
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
          {chartData.length > 0 ? (
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
                  formatter={(value, name) => [
                    name === 'portfolioValue' ? formatCurrency(value) :
                    name === 'stockPrice' ? formatCurrency(value) :
                    formatCurrency(value),
                    name === 'portfolioValue' ? 'Portfolio Value' :
                    name === 'stockPrice' ? 'Stock Price' :
                    'Invested Amount'
                  ]}
                  labelStyle={{ color: '#333' }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />

                {/* Portfolio Value Line */}
                <Line
                  type="monotone"
                  dataKey="portfolioValue"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  name="Portfolio Value"
                />

                {/* Stock Price Line (normalized to portfolio scale for comparison) */}
                <Line
                  type="monotone"
                  dataKey="stockPrice"
                  stroke="#dc2626"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Stock Price"
                  hide={true} // Hide by default since scales might be very different
                />

                {/* Invested Amount Line */}
                <Line
                  type="monotone"
                  dataKey="investedAmount"
                  stroke="#16a34a"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  dot={false}
                  name="Invested Amount"
                />

                {/* Reference line for break-even */}
                {summary.totalCost && (
                  <ReferenceLine
                    y={summary.totalCost}
                    stroke="#666"
                    strokeDasharray="1 1"
                    label={{ value: "Break-even", position: "topRight" }}
                  />
                )}
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
              <span>Portfolio Value</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#16a34a', borderStyle: 'dashed' }}></span>
              <span>Invested Amount</span>
            </div>
          </div>
        </div>
      </div>

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
              <div>Unrealized P&L</div>
              <div>Realized P&L</div>
              <div>Total P&L</div>
              <div>Ann. Return</div>
            </div>

            {enhancedTransactions.map((transaction, index) => {
              const getTransactionIcon = (type) => {
                if (type === 'SELL') return <><TrendingDown size={16} /> SELL</>;
                if (type === 'TRAILING_STOP_LIMIT_BUY') return <><TrendingUp size={16} /> TRAIL BUY</>;
                if (type === 'OCO_LIMIT_BUY') return <><TrendingUp size={16} /> OCO LIMIT</>;
                if (type === 'OCO_TRAILING_BUY') return <><TrendingUp size={16} /> OCO TRAIL</>;
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
                    {transaction.type === 'SELL' && transaction.lotsDetails ?
                      `Sold: ${formatLots(transaction.lotsDetails)}` :
                      `Held: ${formatLots(transaction.lotsAfterTransaction)}`
                    }
                  </div>
                  <div>{transaction.averageCost ? formatCurrency(transaction.averageCost) : 'N/A'}</div>
                  <div className={getMetricClass(transaction.unrealizedPNL)}>
                    {formatCurrency(transaction.unrealizedPNL)}
                  </div>
                  <div className={getMetricClass(transaction.realizedPNL)}>
                    {formatCurrency(transaction.realizedPNL)}
                    {transaction.realizedPNLFromTrade !== 0 && (
                      <small> (+{formatCurrency(transaction.realizedPNLFromTrade)})</small>
                    )}
                  </div>
                  <div className={getMetricClass(transaction.totalPNL)}>
                    {formatCurrency(transaction.totalPNL)}
                  </div>
                  <div className={transaction.type === 'SELL' ? (transaction.annualizedReturnPercent > 0 ? 'positive' : 'negative') : ''}>
                    {transaction.type === 'SELL' && transaction.annualizedReturnPercent !== undefined
                      ? `${transaction.annualizedReturnPercent.toFixed(2)}%`
                      : 'N/A'
                    }
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
                  ) : (
                    <><TrendingDown size={16} /> SELL</>
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
              <div>Ann. Return (Compound)</div>
              <div>Ann. Return (Simple)</div>
            </div>

            {lots.map((lot, index) => {
              const currentPrice = dailyPrices?.[dailyPrices.length - 1]?.close || 0;
              const currentValue = lot.shares * currentPrice;
              const purchaseValue = lot.shares * lot.price;
              const pnl = currentValue - purchaseValue;

              // Calculate annualized return for this holding
              const actualDaysHeld = Math.max(1, Math.ceil((new Date(summary.endDate) - new Date(lot.date)) / (1000 * 60 * 60 * 24)));
              const totalReturn = purchaseValue > 0 ? pnl / purchaseValue : 0;

              // Method 1: Compound (Math.pow) - correct compound interest formula
              let compoundAnnualizedReturn;
              if (totalReturn < 0) {
                compoundAnnualizedReturn = Math.pow(1 - Math.abs(totalReturn), 365 / actualDaysHeld) - 1;
              } else {
                compoundAnnualizedReturn = Math.pow(1 + totalReturn, 365 / actualDaysHeld) - 1;
              }
              const compoundAnnualizedReturnPercent = compoundAnnualizedReturn * 100;

              // Method 2: Simple multiplication - linear approximation
              const simpleAnnualizedReturn = totalReturn * (365 / actualDaysHeld);
              const simpleAnnualizedReturnPercent = simpleAnnualizedReturn * 100;

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
                  <div className={compoundAnnualizedReturnPercent > 0 ? 'positive' : 'negative'}>
                    {compoundAnnualizedReturnPercent.toFixed(2)}%
                  </div>
                  <div className={simpleAnnualizedReturnPercent > 0 ? 'positive' : 'negative'}>
                    {simpleAnnualizedReturnPercent.toFixed(2)}%
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
