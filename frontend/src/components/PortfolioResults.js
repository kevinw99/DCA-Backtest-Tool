import React from 'react';
import PortfolioSummaryCard from './PortfolioSummaryCard';
import StockPerformanceTable from './StockPerformanceTable';
import CapitalUtilizationChart from './CapitalUtilizationChart';
import PortfolioCompositionChart from './PortfolioCompositionChart';
import MultiStockPriceChart from './MultiStockPriceChart';
import RejectedOrdersTable from './RejectedOrdersTable';
import PortfolioCurrentHoldings from './PortfolioCurrentHoldings';
import DailyTradesView from './DailyTradesView';
import PortfolioBuyAndHoldComparison from './PortfolioBuyAndHoldComparison';
import DCAVsBuyAndHoldChart from './DCAVsBuyAndHoldChart';
import './PortfolioResults.css';

const PortfolioResults = ({ data }) => {
  if (!data) {
    return (
      <div className="portfolio-results empty">
        <p>No results data available</p>
      </div>
    );
  }

  const {
    portfolioSummary,
    stockResults,
    capitalUtilizationTimeSeries,
    portfolioCompositionTimeSeries,
    capitalDeploymentTimeSeries,
    rejectedOrders,
    portfolioRunId,
    parameters,
    buyAndHoldSummary,
    comparison
  } = data;

  return (
    <div className="portfolio-results">
      <PortfolioSummaryCard summary={portfolioSummary} comparison={comparison} />

      {/* Backend API Test Command */}
      {parameters && (
        <div className="api-url-section" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '16px' }}>Backend API Test Command</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              readOnly
              value={(() => {
                // Generate curl command for testing the backend API
                const jsonBody = JSON.stringify(parameters, null, 2);
                return `curl -X POST http://localhost:3001/api/portfolio-backtest -H "Content-Type: application/json" -d '${jsonBody.replace(/\n/g, ' ')}'`;
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
                const jsonBody = JSON.stringify(parameters, null, 2);
                const curlCommand = `curl -X POST http://localhost:3001/api/portfolio-backtest -H "Content-Type: application/json" -d '${jsonBody.replace(/\n/g, ' ')}'`;
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

      {comparison && buyAndHoldSummary && (
        <>
          <section className="buy-hold-comparison-section">
            <div className="section-header">
              <h3>📊 DCA vs Buy & Hold Comparison</h3>
              <p className="section-description">
                Compare the active DCA strategy against a passive Buy & Hold approach with equal capital allocation
              </p>
            </div>
            <PortfolioBuyAndHoldComparison
              comparison={comparison}
              buyAndHoldSummary={buyAndHoldSummary}
            />
          </section>

          <section className="charts-section">
            <div className="section-header">
              <h3>📈 Portfolio Value: DCA vs Buy & Hold</h3>
              <p className="section-description">
                Visualize how the two strategies compare over time
              </p>
            </div>
            <DCAVsBuyAndHoldChart
              dcaTimeSeries={capitalUtilizationTimeSeries}
              buyAndHoldTimeSeries={buyAndHoldSummary.dailyValues}
            />
          </section>
        </>
      )}

      <section className="charts-section">
        <div className="section-header">
          <h3>📊 Portfolio Composition Over Time</h3>
          <p className="section-description">
            Visualize how your portfolio composition changes over time with each stock's market value
          </p>
        </div>
        <PortfolioCompositionChart compositionTimeSeries={portfolioCompositionTimeSeries} />
      </section>

      <section className="charts-section">
        <div className="section-header">
          <h3>📈 Multi-Stock Price Comparison</h3>
          <p className="section-description">
            Compare normalized price movements across all stocks with transaction markers
          </p>
        </div>
        <MultiStockPriceChart stockResults={stockResults} />
      </section>

      <section className="charts-section">
        <div className="section-header">
          <h3>⚡ Capital Utilization Metrics</h3>
          <p className="section-description">
            Monitor deployed capital, cash reserve, and utilization percentage
          </p>
        </div>
        <CapitalUtilizationChart timeSeries={capitalUtilizationTimeSeries} />
      </section>

      <section className="current-holdings-section">
        <div className="section-header">
          <h3>💼 Current Holdings</h3>
          <p className="section-description">
            Detailed breakdown of all current positions at the end of the backtest period
          </p>
        </div>
        <PortfolioCurrentHoldings stockResults={stockResults} />
      </section>

      <section className="stock-performance-section">
        <div className="section-header">
          <h3>🎯 Stock Performance Breakdown</h3>
          <p className="section-description">
            Individual stock performance and contribution to portfolio returns (click rows to expand, or click "View" to see detailed results)
          </p>
        </div>
        <StockPerformanceTable
          stocks={stockResults}
          portfolioRunId={portfolioRunId}
          parameters={parameters}
        />
      </section>

      <section className="daily-trades-section">
        <div className="section-header">
          <h3>📅 Daily Trading Activity</h3>
          <p className="section-description">
            View all trades aggregated by date with cash position tracking (click rows to expand and see transaction details)
          </p>
        </div>
        <DailyTradesView
          stockResults={stockResults}
          portfolioSummary={portfolioSummary}
          portfolioRunId={portfolioRunId}
          parameters={parameters}
        />
      </section>

      <section className="rejected-orders-section">
        <div className="section-header">
          <h3>⚠️ Rejected Orders Analysis</h3>
          <p className="section-description">
            Buy orders that couldn't be executed due to insufficient capital
          </p>
        </div>
        <RejectedOrdersTable orders={rejectedOrders} />
      </section>
    </div>
  );
};

export default PortfolioResults;
