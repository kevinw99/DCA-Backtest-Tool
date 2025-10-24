/**
 * AlignedChartsContainer
 *
 * Container component that displays multiple portfolio charts in a vertically
 * stacked layout with synchronized x-axes for date alignment.
 */

import React from 'react';
import PropTypes from 'prop-types';
import DCAVsBuyAndHoldChartAligned from './charts/DCAVsBuyAndHoldChartAligned';
import PortfolioCompositionChartAligned from './charts/PortfolioCompositionChartAligned';
import MultiStockPriceChartAligned from './charts/MultiStockPriceChartAligned';
import CapitalUtilizationChartAligned from './charts/CapitalUtilizationChartAligned';
import './AlignedChartsContainer.css';

const AlignedChartsContainer = ({ chartData, stockResults }) => {
  // Define charts in order of display
  const charts = [
    {
      id: 'dcaVsBuyAndHold',
      component: DCAVsBuyAndHoldChartAligned,
      title: 'Portfolio Value: DCA vs Buy & Hold',
      description: 'Compare the active DCA strategy against a passive Buy & Hold approach',
      dataKey: 'dcaVsBuyAndHold',
      props: { data: chartData.dcaVsBuyAndHold }
    },
    {
      id: 'composition',
      component: PortfolioCompositionChartAligned,
      title: 'Portfolio Composition Over Time',
      description: 'Market value composition showing each stock and cash reserve',
      dataKey: 'composition',
      props: { data: chartData.composition }
    },
    {
      id: 'normalizedPrices',
      component: MultiStockPriceChartAligned,
      title: 'Multi-Stock Price Comparison (Normalized)',
      description: 'All stock prices normalized to % change from their starting price',
      dataKey: 'normalizedPrices',
      props: { data: chartData.normalizedPrices, stockResults }
    },
    {
      id: 'capitalUtilization',
      component: CapitalUtilizationChartAligned,
      title: 'Capital Utilization Metrics',
      description: 'Monitor deployed capital, cash reserve, and utilization percentage',
      dataKey: 'capitalUtilization',
      props: { data: chartData.capitalUtilization }
    }
  ];

  return (
    <div className="aligned-charts-container">
      {charts.map((chart, index) => {
        const ChartComponent = chart.component;
        const isLastChart = index === charts.length - 1;

        return (
          <section key={chart.id} className="aligned-chart-section">
            <div className="chart-header">
              <h3 className="chart-title">{chart.title}</h3>
              {chart.description && (
                <p className="chart-description">{chart.description}</p>
              )}
            </div>
            <div className="chart-wrapper">
              <ChartComponent
                {...chart.props}
                isLastChart={isLastChart}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
};

AlignedChartsContainer.propTypes = {
  chartData: PropTypes.shape({
    dcaVsBuyAndHold: PropTypes.array,
    composition: PropTypes.array,
    normalizedPrices: PropTypes.array,
    capitalUtilization: PropTypes.array
  }).isRequired,
  stockResults: PropTypes.array
};

export default AlignedChartsContainer;
