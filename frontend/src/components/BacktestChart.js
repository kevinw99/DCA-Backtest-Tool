import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  ReferenceLine,
  Scatter,
  Brush,
  Area,
  AreaChart
} from 'recharts';
import { TrendingUp, Eye, EyeOff, ZoomIn, ZoomOut, RotateCcw, Calendar } from 'lucide-react';
import BacktestResults from './BacktestResults';

const BacktestChart = ({ data, backtestResults }) => {
  const [visibleIndicators, setVisibleIndicators] = useState({
    ma20: true,
    ma50: true,
    ma200: false,
    rsi: true,
    volatility: false,
    volume: false
  });

  const [fullData, setFullData] = useState(null);
  const [zoomRange, setZoomRange] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chartView, setChartView] = useState('backtest'); // 'backtest' or 'full'

  // Load full data when component mounts or symbol changes
  useEffect(() => {
    if (data?.symbol && chartView === 'full') {
      loadFullData(data.symbol);
    }
  }, [data?.symbol, chartView]);

  const loadFullData = async (symbol) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/stocks/${symbol}/full-chart-data?includeIndicators=true`);
      if (response.ok) {
        const result = await response.json();
        setFullData(result);

        // Set initial zoom to backtest period if available
        if (data?.actualStartDate && data?.endDate) {
          const backtestStart = new Date(data.actualStartDate).getTime();
          const backtestEnd = new Date(data.endDate).getTime();
          setZoomRange([backtestStart, backtestEnd]);
        }
      }
    } catch (error) {
      console.error('Error loading full data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Process chart data based on current view
  const chartData = useMemo(() => {
    const sourceData = chartView === 'full' ? fullData?.dailyPrices : data?.dailyPrices;
    if (!sourceData) return [];

    const { actualStartDate, enhancedTransactions = [], transactions = [] } = data || {};

    // Use transactions array (API returns regular transactions, enhanced transactions are empty)
    const transactionsToUse = transactions.length > 0 ? transactions : enhancedTransactions;

    // Debug logging
    console.log('🔍 BacktestChart Debug:', {
      transactionsCount: transactions.length,
      enhancedTransactionsCount: enhancedTransactions.length,
      usingTransactionsArray: transactions.length > 0 ? 'transactions' : 'enhancedTransactions',
      transactionTypes: transactionsToUse.map(t => ({ date: t.date, type: t.type, hasOCO: !!t.ocoOrderDetail }))
    });

    // Create a map of transactions by date for quick lookup
    const transactionMap = transactionsToUse.reduce((acc, transaction) => {
      acc[transaction.date] = transaction;
      return acc;
    }, {});

    return sourceData.map(day => {
      const transaction = transactionMap[day.date];
      const isInBacktestPeriod = actualStartDate ? day.date >= actualStartDate : false;

      const chartDataPoint = {
        date: day.date,
        timestamp: new Date(day.date).getTime(),
        price: parseFloat(day.adjusted_close || day.price || 0),
        ma20: day.ma_20,
        ma50: day.ma_50,
        ma200: day.ma_200,
        rsi: day.rsi_14,
        volatility: day.volatility_20 ? day.volatility_20 * 100 : null,
        volume: day.volume,
        isInBacktestPeriod,
        transaction: transaction,
        // Separate markers for different buy types
        regularBuyMarker: (transaction?.type === 'BUY' && !transaction?.ocoOrderDetail) ? parseFloat(day.adjusted_close || day.price || 0) : null,
        ocoTrailingBuyMarker: (transaction?.type === 'OCO_TRAILING_BUY' || (transaction?.type === 'BUY' && transaction?.ocoOrderDetail?.type === 'TRAILING_BUY')) ? parseFloat(day.adjusted_close || day.price || 0) : null,
        ocoLimitBuyMarker: (transaction?.type === 'OCO_LIMIT_BUY' || (transaction?.type === 'BUY' && transaction?.ocoOrderDetail?.type === 'LIMIT_BUY')) ? parseFloat(day.adjusted_close || day.price || 0) : null,
        sellMarker: transaction?.type === 'SELL' ? parseFloat(day.adjusted_close || day.price || 0) : null,

        // Peak price for trailing stop visualization
        peakPrice: transaction?.trailingStopDetail?.triggered ? transaction.trailingStopDetail.highestPriceBeforeStop : null
      };

      // Log when we have transaction markers
      if (transaction) {
        console.log('📍 Transaction Marker:', {
          date: day.date,
          type: transaction.type,
          price: transaction.price,
          ocoOrderDetail: transaction.ocoOrderDetail,
          regularBuy: chartDataPoint.regularBuyMarker,
          ocoTrailing: chartDataPoint.ocoTrailingBuyMarker,
          ocoLimit: chartDataPoint.ocoLimitBuyMarker,
          sell: chartDataPoint.sellMarker,
          peak: chartDataPoint.peakPrice,
          trailingStopDetail: transaction.trailingStopDetail
        });
      }

      return chartDataPoint;
    });
  }, [data, fullData, chartView]);

  const toggleIndicator = (indicator) => {
    setVisibleIndicators(prev => ({
      ...prev,
      [indicator]: !prev[indicator]
    }));
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit'
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const handleZoomToBacktest = () => {
    if (data?.actualStartDate && data?.endDate) {
      const backtestStart = new Date(data.actualStartDate).getTime();
      const backtestEnd = new Date(data.endDate).getTime();
      setZoomRange([backtestStart, backtestEnd]);
    }
  };

  const handleResetZoom = () => {
    setZoomRange(null);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      return (
        <div className="chart-tooltip">
          <p className="tooltip-date">{formatDate(label)}</p>
          <p className="tooltip-price">Price: {formatCurrency(parseFloat(data.price) || 0)}</p>

          {data.transaction && (
            <p className={`tooltip-transaction ${data.transaction.type.toLowerCase()}`}>
              {data.transaction.type === 'OCO_TRAILING_BUY' ? 'OCO Trailing Buy' :
               data.transaction.type === 'OCO_LIMIT_BUY' ? 'OCO Limit Buy' :
               data.transaction.type === 'BUY' ? 'Regular Buy' :
               data.transaction.type}: {formatCurrency(parseFloat(data.transaction.price) || 0)}
            </p>
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
            <p className="tooltip-indicator">RSI: {data.rsi.toFixed(1)}</p>
          )}

          {visibleIndicators.volatility && data.volatility && (
            <p className="tooltip-indicator">Volatility: {data.volatility.toFixed(1)}%</p>
          )}
        </div>
      );
    }
    return null;
  };

  if (!chartData.length) {
    return (
      <div className="chart-loading">
        {isLoading ? 'Loading chart data...' : 'No chart data available'}
      </div>
    );
  }

  return (
    <div className="chart-container">
      <div className="chart-header">
        <div className="chart-title-section">
          <h2>
            <TrendingUp size={24} />
            {data?.symbol || 'Stock'} - Price Chart & Analysis
          </h2>

          {fullData?.dateRange && (
            <div className="data-range-info">
              <Calendar size={16} />
              <span>
                {fullData.dateRange.totalDays} days available
                ({formatDate(fullData.dateRange.min)} - {formatDate(fullData.dateRange.max)})
              </span>
            </div>
          )}
        </div>

        <div className="chart-controls">
          <div className="view-toggles">
            <button
              className={`view-toggle ${chartView === 'backtest' ? 'active' : ''}`}
              onClick={() => setChartView('backtest')}
            >
              Backtest Period
            </button>
            <button
              className={`view-toggle ${chartView === 'full' ? 'active' : ''}`}
              onClick={() => setChartView('full')}
            >
              All Available Data
            </button>
          </div>

          {chartView === 'full' && (
            <div className="zoom-controls">
              <button
                className="zoom-button"
                onClick={handleZoomToBacktest}
                title="Zoom to backtest period"
              >
                <ZoomIn size={16} />
                Backtest
              </button>
              <button
                className="zoom-button"
                onClick={handleResetZoom}
                title="Reset zoom"
              >
                <RotateCcw size={16} />
                Reset
              </button>
            </div>
          )}

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

            <button
              className={`indicator-toggle ${visibleIndicators.rsi ? 'active' : ''}`}
              onClick={() => toggleIndicator('rsi')}
            >
              {visibleIndicators.rsi ? <Eye size={16} /> : <EyeOff size={16} />}
              RSI
            </button>

            <button
              className={`indicator-toggle ${visibleIndicators.volatility ? 'active' : ''}`}
              onClick={() => toggleIndicator('volatility')}
            >
              {visibleIndicators.volatility ? <Eye size={16} /> : <EyeOff size={16} />}
              Volatility
            </button>

            <button
              className={`indicator-toggle ${visibleIndicators.volume ? 'active' : ''}`}
              onClick={() => toggleIndicator('volume')}
            >
              {visibleIndicators.volume ? <Eye size={16} /> : <EyeOff size={16} />}
              Volume
            </button>
          </div>
        </div>
      </div>

      {/* Main Price Chart with Zoom Capability */}
      <div className="chart-section main-chart">
        <h3>
          {chartView === 'full' ? 'Complete Price History' : 'Backtest Period'}
          {chartView === 'full' && zoomRange && ' (Zoomed)'}
        </h3>

        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#666"
              domain={zoomRange || ['dataMin', 'dataMax']}
              type="category"
              scale="point"
            />
            <YAxis
              domain={['dataMin - 20', 'dataMax + 20']}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
              stroke="#666"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {/* Backtest period highlighting for full view */}
            {chartView === 'full' && data?.actualStartDate && (
              <>
                <ReferenceLine
                  x={data.actualStartDate}
                  stroke="#667eea"
                  strokeDasharray="5 5"
                  label="Backtest Start"
                />
                {data?.endDate && (
                  <ReferenceLine
                    x={data.endDate}
                    stroke="#667eea"
                    strokeDasharray="5 5"
                    label="Backtest End"
                  />
                )}
              </>
            )}

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

            {/* Buy/Sell markers with different types - show in all views */}
            <Scatter
              dataKey="regularBuyMarker"
              fill="#38a169"
              shape="triangle"
              name="Regular Buy"
            />
            <Scatter
              dataKey="ocoTrailingBuyMarker"
              fill="#2563eb"
              shape="diamond"
              name="OCO Trailing Buy"
            />
            <Scatter
              dataKey="ocoLimitBuyMarker"
              fill="#7c3aed"
              shape="square"
              name="OCO Limit Buy"
            />
            <Scatter
              dataKey="sellMarker"
              fill="#e53e3e"
              shape="triangleDown"
              name="Sell Signal"
            />
            <Scatter
              dataKey="peakPrice"
              fill="#f59e0b"
              shape="star"
              name="Peak Price (Stop Set)"
            />

            {/* Brush for zooming - only in full view */}
            {chartView === 'full' && (
              <Brush
                dataKey="date"
                height={30}
                stroke="#667eea"
                startIndex={zoomRange ? Math.floor(chartData.length * 0.7) : undefined}
                endIndex={zoomRange ? chartData.length - 1 : undefined}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Overview Chart - Mini chart showing full timeline with zoom window */}
      {chartView === 'full' && zoomRange && (
        <div className="chart-section overview-chart">
          <h4>Timeline Overview</h4>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <XAxis dataKey="date" tick={false} axisLine={false} />
              <YAxis tick={false} axisLine={false} />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#667eea"
                fill="#667eea"
                fillOpacity={0.3}
              />
              <ReferenceLine
                x={data?.actualStartDate}
                stroke="#e53e3e"
                strokeWidth={2}
              />
              <ReferenceLine
                x={data?.endDate}
                stroke="#e53e3e"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Additional indicator charts - same as before but conditional on chartView */}
      {visibleIndicators.rsi && (
        <div className="chart-section">
          <h3>RSI (Relative Strength Index)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#666"
                domain={zoomRange || ['dataMin', 'dataMax']}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#666"
              />
              <Tooltip
                labelFormatter={formatDate}
                formatter={(value) => [value?.toFixed(1), 'RSI']}
              />

              <ReferenceLine y={70} stroke="#e53e3e" strokeDasharray="3 3" label="Overbought" />
              <ReferenceLine y={30} stroke="#38a169" strokeDasharray="3 3" label="Oversold" />

              <Line
                type="monotone"
                dataKey="rsi"
                stroke="#667eea"
                strokeWidth={2}
                dot={false}
                name="RSI"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Volatility Chart */}
      {visibleIndicators.volatility && (
        <div className="chart-section">
          <h3>Volatility (20-day Annualized)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#666"
                domain={zoomRange || ['dataMin', 'dataMax']}
              />
              <YAxis
                stroke="#666"
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                labelFormatter={formatDate}
                formatter={(value) => [value?.toFixed(1) + '%', 'Volatility']}
              />

              <ReferenceLine y={60} stroke="#e53e3e" strokeDasharray="3 3" label="High Vol" />

              <Line
                type="monotone"
                dataKey="volatility"
                stroke="#764ba2"
                strokeWidth={2}
                dot={false}
                name="Volatility"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Volume Chart */}
      {visibleIndicators.volume && (
        <div className="chart-section">
          <h3>Trading Volume</h3>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#666"
                domain={zoomRange || ['dataMin', 'dataMax']}
              />
              <YAxis
                stroke="#666"
                tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                labelFormatter={formatDate}
                formatter={(value) => [(value / 1000000).toFixed(1) + 'M', 'Volume']}
              />

              <Bar
                dataKey="volume"
                fill="#a0aec0"
                name="Volume"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Backtest Results Section */}
      {backtestResults && (
        <div className="results-section">
          <BacktestResults data={backtestResults} />
        </div>
      )}
    </div>
  );
};

export default BacktestChart;
