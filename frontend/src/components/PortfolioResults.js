import React, { useMemo } from 'react';
import PortfolioSummaryCard from './PortfolioSummaryCard';
import StockPerformanceTable from './StockPerformanceTable';
import RejectedOrdersTable from './RejectedOrdersTable';
import DeferredSellsTable from './DeferredSellsTable';
import DailyTradesView from './DailyTradesView';
import PortfolioBuyAndHoldComparison from './PortfolioBuyAndHoldComparison';
import AlignedChartsContainer from './portfolio/AlignedChartsContainer';
import BetaGroupAnalysis from './backtest/BetaGroupAnalysis';
import { preprocessPortfolioChartData } from '../services/chartDataProcessor';
import { getApiUrl } from '../config/api';
import './PortfolioResults.css';

const PortfolioResults = ({ data }) => {
  // Preprocess chart data for aligned display (must be called before any returns)
  const chartData = useMemo(
    () => data ? preprocessPortfolioChartData(data) : null,
    [data]
  );

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
    deferredSells,
    portfolioRunId,
    parameters,
    buyAndHoldSummary,
    comparison,
    skippedStocks,
    betaGrouping,
    betaFilterMetadata,  // Spec 66: Beta range filtering metadata
    etfBenchmark  // Spec 67: ETF benchmark data
  } = data;

  // Count skipped stocks
  const skippedCount = skippedStocks?.length || 0;
  const hasSkippedStocks = skippedCount > 0;

  return (
    <div className="portfolio-results">
      <PortfolioSummaryCard summary={portfolioSummary} comparison={comparison} />

      {/* Skipped Stocks Warning Banner */}
      {hasSkippedStocks && (
        <div className="skipped-stocks-banner">
          <div className="banner-header">
            <span className="banner-icon">⚠️</span>
            <h3 className="banner-title">
              {skippedCount} {skippedCount === 1 ? 'Stock' : 'Stocks'} Skipped Due to Errors
            </h3>
          </div>
          <div className="banner-content">
            <p className="banner-message">
              The following {skippedCount === 1 ? 'stock was' : 'stocks were'} excluded from the portfolio backtest due to data issues:
            </p>
            <ul className="skipped-stocks-list">
              {skippedStocks.map((skipped, idx) => (
                <li key={idx} className="skipped-stock-item">
                  <strong>{skipped.symbol}</strong>: {skipped.error?.message || 'Unknown error'}
                  {skipped.error?.type && (
                    <span className="error-type-badge">{skipped.error.type}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="banner-action">
              Click on the stock rows in the Stock Performance Breakdown below to view detailed error information and troubleshooting steps.
            </p>
          </div>
        </div>
      )}

      {/* Spec 66: Beta Filter Summary */}
      {betaFilterMetadata && betaFilterMetadata.enabled && (
        <div className="beta-filter-summary" style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#e8f4fd',
          borderRadius: '8px',
          border: '1px solid #b3d9f2'
        }}>
          <div className="banner-header">
            <span className="banner-icon">🔍</span>
            <h3 className="banner-title">Beta Range Filter Applied</h3>
          </div>
          <div className="banner-content">
            <p className="banner-message">
              <strong>Range:</strong> {betaFilterMetadata.minBeta ?? 'any'} ≤ beta ≤ {betaFilterMetadata.maxBeta ?? 'any'}
            </p>
            <p className="banner-message">
              <strong>Stocks:</strong> {betaFilterMetadata.includedStocks}/{betaFilterMetadata.totalStocks} included
              ({betaFilterMetadata.excludedStocks} excluded)
            </p>
            {betaFilterMetadata.missingBetaCount > 0 && (
              <p className="banner-message" style={{ color: '#856404', marginTop: '8px' }}>
                ⚠️ {betaFilterMetadata.missingBetaCount} stocks excluded due to missing beta data
              </p>
            )}

            <details style={{ marginTop: '12px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: '500' }}>
                View Included Stocks ({betaFilterMetadata.includedSymbols?.length || 0})
              </summary>
              <ul style={{
                marginTop: '8px',
                paddingLeft: '20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                gap: '4px'
              }}>
                {betaFilterMetadata.includedSymbols?.map(symbol => (
                  <li key={symbol} style={{ listStyle: 'none', padding: '2px' }}>
                    <code>{symbol}</code>
                  </li>
                ))}
              </ul>
            </details>

            <details style={{ marginTop: '8px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: '500' }}>
                View Excluded Stocks ({betaFilterMetadata.excludedSymbols?.length || 0})
              </summary>
              <ul style={{
                marginTop: '8px',
                paddingLeft: '20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                gap: '4px'
              }}>
                {betaFilterMetadata.excludedSymbols?.map(symbol => (
                  <li key={symbol} style={{ listStyle: 'none', padding: '2px' }}>
                    <code>{symbol}</code>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      )}

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
                return `curl -X POST ${getApiUrl('/api/portfolio-backtest')} -H "Content-Type: application/json" -d '${jsonBody.replace(/\n/g, ' ')}'`;
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
                const curlCommand = `curl -X POST ${getApiUrl('/api/portfolio-backtest')} -H "Content-Type: application/json" -d '${jsonBody.replace(/\n/g, ' ')}'`;
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
        <section className="buy-hold-comparison-section">
          <div className="section-header">
            <h3>📊 Adaptive DCA vs Buy & Hold Comparison</h3>
            <p className="section-description">
              Compare the adaptive DCA strategy against a passive Buy & Hold approach with equal capital allocation
            </p>
          </div>
          <PortfolioBuyAndHoldComparison
            comparison={comparison}
            buyAndHoldSummary={buyAndHoldSummary}
            etfBenchmark={etfBenchmark}
          />
        </section>
      )}

      {/* Beta Group Analysis Section */}
      {betaGrouping && (
        <section className="beta-analysis-section">
          <BetaGroupAnalysis betaGrouping={betaGrouping} />
        </section>
      )}

      {/* Aligned Charts Section */}
      <section className="charts-section aligned-charts-section">
        <div className="section-header">
          <h3>📊 Portfolio Performance Charts</h3>
          <p className="section-description">
            Interactive visualizations showing portfolio performance, composition, and capital utilization over time.
            All charts share the same timeline for easy comparison.
          </p>
        </div>
        <AlignedChartsContainer
          chartData={chartData}
          stockResults={stockResults}
        />
      </section>

      <section className="stock-performance-section">
        <div className="section-header">
          <h3>🎯 Stock Performance Breakdown</h3>
          <p className="section-description">
            Individual stock performance and contribution to portfolio returns. Click rows to expand for current holdings and transaction details, or click "View" to see full results.
          </p>
        </div>
        <StockPerformanceTable
          stocks={stockResults}
          portfolioRunId={portfolioRunId}
          parameters={parameters}
          buyAndHoldSummary={buyAndHoldSummary}
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
          <h3>⚠️ Rejected Orders (Capital Constraints)</h3>
          <p className="section-description">
            Buy orders that couldn't be executed due to insufficient capital
          </p>
        </div>
        <RejectedOrdersTable orders={rejectedOrders} />
      </section>

      <section className="deferred-sells-section">
        <div className="section-header">
          <h3>🕐 Deferred Sells Analysis</h3>
          <p className="section-description">
            Sell signals that were postponed due to cash abundance strategy
          </p>
        </div>
        <DeferredSellsTable orders={deferredSells} />
      </section>
    </div>
  );
};

export default PortfolioResults;
