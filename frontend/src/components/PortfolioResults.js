import React from 'react';
import PortfolioSummaryCard from './PortfolioSummaryCard';
import StockPerformanceTable from './StockPerformanceTable';
import CapitalUtilizationChart from './CapitalUtilizationChart';
import PortfolioCompositionChart from './PortfolioCompositionChart';
import MultiStockPriceChart from './MultiStockPriceChart';
import CapitalAllocationChart from './CapitalAllocationChart';
import RejectedOrdersTable from './RejectedOrdersTable';
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
    parameters
  } = data;

  return (
    <div className="portfolio-results">
      <PortfolioSummaryCard summary={portfolioSummary} />

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
          <h3>💰 Capital Allocation Timeline</h3>
          <p className="section-description">
            Track capital deployment across stocks with utilization percentage overlay
          </p>
        </div>
        <CapitalAllocationChart
          compositionTimeSeries={portfolioCompositionTimeSeries}
          capitalUtilizationTimeSeries={capitalUtilizationTimeSeries}
          capitalDeploymentTimeSeries={capitalDeploymentTimeSeries}
        />
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
