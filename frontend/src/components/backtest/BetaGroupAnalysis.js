import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './BetaGroupAnalysis.css';

/**
 * Beta Group Analysis Component
 *
 * Displays portfolio backtest results grouped by beta ranges.
 * Shows which beta groups are most suitable for DCA strategy.
 */
const BetaGroupAnalysis = ({ betaGrouping }) => {
  const [expandedGroup, setExpandedGroup] = useState(null);

  if (!betaGrouping || !betaGrouping.groups) {
    return null;
  }

  const { groups, summary } = betaGrouping;

  // Filter out empty groups
  const activeGroups = groups.filter(g => g.stockCount > 0);

  if (activeGroups.length === 0) {
    return null;
  }

  const toggleGroup = (groupId) => {
    setExpandedGroup(expandedGroup === groupId ? null : groupId);
  };

  const getSuitabilityColor = (score) => {
    if (score >= 75) return '#4CAF50'; // Green - Excellent
    if (score >= 60) return '#8BC34A'; // Light green - Good
    if (score >= 45) return '#FFC107'; // Yellow - Fair
    if (score >= 30) return '#FF9800'; // Orange - Poor
    return '#F44336'; // Red - Very poor
  };

  const getSuitabilityLabel = (score) => {
    if (score >= 75) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 45) return 'Fair';
    if (score >= 30) return 'Poor';
    return 'Very Poor';
  };

  return (
    <div className="beta-group-analysis">
      <div className="beta-analysis-header">
        <h2>Beta Group Analysis</h2>
        <p className="beta-analysis-subtitle">
          Performance and DCA suitability by stock volatility (beta)
        </p>
      </div>

      {/* Summary Statistics */}
      <div className="beta-summary-stats">
        <div className="stat-card">
          <div className="stat-label">Total Stocks</div>
          <div className="stat-value">{summary.totalStocks}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Average Beta</div>
          <div className="stat-value">{summary.avgBeta?.toFixed(2) || 'N/A'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Median Beta</div>
          <div className="stat-value">{summary.medianBeta?.toFixed(2) || 'N/A'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Beta Range</div>
          <div className="stat-value">
            {summary.minBeta?.toFixed(2) || 'N/A'} - {summary.maxBeta?.toFixed(2) || 'N/A'}
          </div>
        </div>
      </div>

      {/* Best Performing Group Highlight */}
      {summary.bestPerformingGroup && (
        <div className="best-group-highlight">
          <div className="highlight-icon">🏆</div>
          <div className="highlight-content">
            <div className="highlight-title">Best Performing Beta Group</div>
            <div className="highlight-details">
              <span className="highlight-range">{summary.bestPerformingGroup.range}</span>
              <span className="highlight-return">
                Return: {summary.bestPerformingGroup.totalReturnPercent?.toFixed(2)}%
              </span>
              <span className="highlight-score">
                DCA Score: {summary.bestPerformingGroup.dcaSuitabilityScore?.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Beta Groups Table */}
      <div className="beta-groups-container">
        <h3>Performance by Beta Range</h3>
        <div className="beta-groups-table">
          <div className="beta-table-header">
            <div className="col-range">Beta Range</div>
            <div className="col-stocks">Stocks</div>
            <div className="col-return">Total Return</div>
            <div className="col-cagr">CAGR</div>
            <div className="col-win-rate">Win Rate</div>
            <div className="col-dca-score">DCA Score</div>
            <div className="col-expand"></div>
          </div>

          {activeGroups.map(group => {
            const perf = group.performance;
            const isExpanded = expandedGroup === group.id;
            const suitabilityColor = getSuitabilityColor(perf?.dcaSuitabilityScore || 0);

            return (
              <div key={group.id} className="beta-group-row">
                <div
                  className="beta-group-summary"
                  onClick={() => toggleGroup(group.id)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleGroup(group.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                >
                  <div className="col-range">
                    <div className="range-badge" style={{ borderColor: group.color }}>
                      {group.label}
                    </div>
                    <div className="range-description">{group.description}</div>
                  </div>
                  <div className="col-stocks">{group.stockCount}</div>
                  <div className="col-return">
                    {perf ? (
                      <span className={perf.totalReturnPercent >= 0 ? 'positive' : 'negative'}>
                        {perf.totalReturnPercent?.toFixed(2)}%
                      </span>
                    ) : 'N/A'}
                  </div>
                  <div className="col-cagr">
                    {perf ? `${perf.cagrPercent?.toFixed(2)}%` : 'N/A'}
                  </div>
                  <div className="col-win-rate">
                    {perf ? `${perf.winRate?.toFixed(1)}%` : 'N/A'}
                  </div>
                  <div className="col-dca-score">
                    {perf ? (
                      <div className="dca-score-badge" style={{ backgroundColor: suitabilityColor }}>
                        <span className="score-value">{perf.dcaSuitabilityScore?.toFixed(0)}</span>
                        <span className="score-label">{getSuitabilityLabel(perf.dcaSuitabilityScore)}</span>
                      </div>
                    ) : 'N/A'}
                  </div>
                  <div className="col-expand">
                    <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && perf && (
                  <div className="beta-group-details">
                    {/* Strategy Suitability Metrics */}
                    <div className="details-section">
                      <h4>DCA Suitability Breakdown</h4>
                      <div className="suitability-grid">
                        <div className="suitability-metric">
                          <div className="metric-label">Trade Activity</div>
                          <div className="metric-value">
                            {perf.suitabilityBreakdown?.tradeActivity || 0}/25
                          </div>
                          <div className="metric-detail">
                            {perf.tradeFrequency?.toFixed(1)} trades/stock/year
                          </div>
                        </div>
                        <div className="suitability-metric">
                          <div className="metric-label">Mean Reversion</div>
                          <div className="metric-value">
                            {perf.suitabilityBreakdown?.meanReversion || 0}/25
                          </div>
                          <div className="metric-detail">
                            {perf.meanReversionScore?.toFixed(1)}% profitable exits
                          </div>
                        </div>
                        <div className="suitability-metric">
                          <div className="metric-label">Capital Efficiency</div>
                          <div className="metric-value">
                            {perf.suitabilityBreakdown?.capitalEfficiency || 0}/25
                          </div>
                          <div className="metric-detail">
                            {perf.avgCapitalUtilization?.toFixed(1)}% utilization
                          </div>
                        </div>
                        <div className="suitability-metric">
                          <div className="metric-label">Grid Utilization</div>
                          <div className="metric-value">
                            {perf.suitabilityBreakdown?.gridUtilization || 0}/25
                          </div>
                          <div className="metric-detail">
                            {perf.gridUtilization?.toFixed(1)}% grid used
                          </div>
                        </div>
                      </div>
                      <div className="suitability-interpretation">
                        {perf.suitabilityInterpretation}
                      </div>
                    </div>

                    {/* Additional Metrics */}
                    <div className="details-section">
                      <h4>Additional Metrics</h4>
                      <div className="metrics-grid">
                        <div className="metric-item">
                          <span className="metric-name">Profit Factor:</span>
                          <span className="metric-val">{perf.profitFactor?.toFixed(2)}</span>
                        </div>
                        <div className="metric-item">
                          <span className="metric-name">Capital Turnover:</span>
                          <span className="metric-val">{perf.capitalTurnover?.toFixed(2)}x</span>
                        </div>
                        <div className="metric-item">
                          <span className="metric-name">Total Trades:</span>
                          <span className="metric-val">{perf.totalTrades}</span>
                        </div>
                        <div className="metric-item">
                          <span className="metric-name">Deployed Capital:</span>
                          <span className="metric-val">${perf.deployedCapital?.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Top/Bottom Performers */}
                    <div className="details-section performers-section">
                      {group.topPerformers && group.topPerformers.length > 0 && (
                        <div className="performers-column">
                          <h4>Top Performers</h4>
                          <div className="performers-list">
                            {group.topPerformers.slice(0, 3).map((stock, idx) => (
                              <div key={idx} className="performer-item">
                                <span className="performer-symbol">{stock.symbol}</span>
                                <span className="performer-beta">β: {stock.beta?.toFixed(2)}</span>
                                <span className="performer-return positive">
                                  {stock.totalReturnPercent?.toFixed(1)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {group.bottomPerformers && group.bottomPerformers.length > 0 && (
                        <div className="performers-column">
                          <h4>Bottom Performers</h4>
                          <div className="performers-list">
                            {group.bottomPerformers.slice(0, 3).map((stock, idx) => (
                              <div key={idx} className="performer-item">
                                <span className="performer-symbol">{stock.symbol}</span>
                                <span className="performer-beta">β: {stock.beta?.toFixed(2)}</span>
                                <span className="performer-return negative">
                                  {stock.totalReturnPercent?.toFixed(1)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Interpretation Guide */}
      <div className="interpretation-guide">
        <h4>Understanding DCA Suitability Score</h4>
        <p>
          The DCA Suitability Score (0-100) measures how well a beta group fits the DCA strategy mechanics:
        </p>
        <ul>
          <li><strong>Trade Activity (25pts):</strong> Enough volatility to create buying opportunities</li>
          <li><strong>Mean Reversion (25pts):</strong> Price recovery after dips (essential for DCA)</li>
          <li><strong>Capital Efficiency (25pts):</strong> Effective deployment of allocated capital</li>
          <li><strong>Grid Utilization (25pts):</strong> Volatility matches grid spacing</li>
        </ul>
        <p className="interpretation-note">
          <strong>Note:</strong> A high DCA score indicates structural fit for the strategy,
          not necessarily highest returns. Use this to identify stocks where DCA mechanics work best.
        </p>
      </div>
    </div>
  );
};

BetaGroupAnalysis.propTypes = {
  betaGrouping: PropTypes.shape({
    groups: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        label: PropTypes.string,
        description: PropTypes.string,
        color: PropTypes.string,
        stockCount: PropTypes.number,
        performance: PropTypes.shape({
          totalReturnPercent: PropTypes.number,
          cagrPercent: PropTypes.number,
          winRate: PropTypes.number,
          profitFactor: PropTypes.number,
          tradeFrequency: PropTypes.number,
          meanReversionScore: PropTypes.number,
          avgCapitalUtilization: PropTypes.number,
          capitalTurnover: PropTypes.number,
          gridUtilization: PropTypes.number,
          dcaSuitabilityScore: PropTypes.number,
          totalTrades: PropTypes.number,
          deployedCapital: PropTypes.number,
          suitabilityBreakdown: PropTypes.shape({
            tradeActivity: PropTypes.number,
            meanReversion: PropTypes.number,
            capitalEfficiency: PropTypes.number,
            gridUtilization: PropTypes.number
          }),
          suitabilityInterpretation: PropTypes.string
        }),
        topPerformers: PropTypes.arrayOf(
          PropTypes.shape({
            symbol: PropTypes.string,
            beta: PropTypes.number,
            totalReturnPercent: PropTypes.number
          })
        ),
        bottomPerformers: PropTypes.arrayOf(
          PropTypes.shape({
            symbol: PropTypes.string,
            beta: PropTypes.number,
            totalReturnPercent: PropTypes.number
          })
        )
      })
    ),
    summary: PropTypes.shape({
      totalStocks: PropTypes.number,
      avgBeta: PropTypes.number,
      medianBeta: PropTypes.number,
      minBeta: PropTypes.number,
      maxBeta: PropTypes.number,
      bestPerformingGroup: PropTypes.shape({
        rangeId: PropTypes.string,
        range: PropTypes.string,
        totalReturnPercent: PropTypes.number,
        dcaSuitabilityScore: PropTypes.number
      })
    })
  })
};

export default BetaGroupAnalysis;
