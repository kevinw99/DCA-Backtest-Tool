import React from 'react';
import '../App.css';

/**
 * ScenarioAnalysis Component
 * Displays scenario detection results and recommendations for DCA backtest
 */
const ScenarioAnalysis = ({ scenarioAnalysis }) => {
  // Return null if no scenario analysis available
  if (!scenarioAnalysis) {
    return null;
  }

  const { type, confidence, confidenceLevel, keyMetrics, analysis, recommendations, enhancedRiskMetrics } = scenarioAnalysis;

  // Scenario configuration with colors, icons, and labels
  const SCENARIO_CONFIG = {
    downtrend: {
      label: 'Downtrend',
      icon: '📉',
      color: '#ef4444',
      bgColor: '#fee2e2',
      description: 'Unfavorable for DCA - strategy caught falling knife'
    },
    missed_rally: {
      label: 'Missed Rally',
      icon: '🚀',
      color: '#f59e0b',
      bgColor: '#fef3c7',
      description: 'Opportunity cost - price rallied too quickly'
    },
    oscillating_uptrend: {
      label: 'Oscillating Uptrend',
      icon: '📈',
      color: '#10b981',
      bgColor: '#d1fae5',
      description: 'Optimal for DCA - captured dips and peaks'
    },
    mixed: {
      label: 'Mixed Pattern',
      icon: '🔀',
      color: '#6b7280',
      bgColor: '#f3f4f6',
      description: 'No clear scenario pattern detected'
    }
  };

  const config = SCENARIO_CONFIG[type] || SCENARIO_CONFIG.mixed;

  // Priority color mapping for recommendations
  const PRIORITY_COLORS = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#16a34a'
  };

  // Format numeric values for display
  const formatPercent = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatNumber = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(2);
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="scenario-analysis-card" style={{ borderLeft: `4px solid ${config.color}` }}>
      {/* Header Section */}
      <div className="scenario-header" style={{ backgroundColor: config.bgColor }}>
        <div className="scenario-title">
          <span className="scenario-icon">{config.icon}</span>
          <h3 style={{ color: config.color }}>{config.label}</h3>
          <span
            className="confidence-badge"
            style={{
              backgroundColor: confidence >= 0.8 ? '#10b981' : confidence >= 0.6 ? '#f59e0b' : '#6b7280',
              color: 'white'
            }}
          >
            {confidenceLevel} Confidence ({(confidence * 100).toFixed(0)}%)
          </span>
        </div>
        <p className="scenario-description">{config.description}</p>
        <p className="scenario-analysis">{analysis}</p>
      </div>

      {/* Key Metrics Section */}
      <div className="scenario-metrics">
        <h4>Key Metrics</h4>
        <div className="metrics-grid">
          {Object.entries(keyMetrics).map(([key, value]) => {
            let displayValue;
            let label = key.replace(/([A-Z])/g, ' $1').trim();
            label = label.charAt(0).toUpperCase() + label.slice(1);

            // Format based on metric type
            if (key.includes('Percent') || key.includes('Rate') || key.includes('Return') || key.includes('Utilization')) {
              displayValue = typeof value === 'number' ? formatPercent(value) : value;
            } else if (key.includes('PnL') || key.includes('Cost')) {
              displayValue = typeof value === 'number' ? formatCurrency(value) : value;
            } else if (key.includes('Ratio')) {
              displayValue = typeof value === 'number' ? formatNumber(value) : value;
            } else {
              displayValue = typeof value === 'number' ? formatNumber(value) : value;
            }

            // Color code positive/negative values
            let valueColor = '#1f2937';
            if (typeof value === 'number') {
              if (key.includes('Return') || key.includes('PnL')) {
                valueColor = value >= 0 ? '#10b981' : '#ef4444';
              }
            }

            return (
              <div key={key} className="metric-item">
                <span className="metric-label">{label}</span>
                <span className="metric-value" style={{ color: valueColor }}>
                  {displayValue}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enhanced Risk Metrics Section */}
      {enhancedRiskMetrics && (
        <div className="scenario-risk-metrics">
          <h4>Enhanced Risk Metrics</h4>
          <div className="metrics-grid">
            <div className="metric-item">
              <span className="metric-label">Capital Efficiency Score</span>
              <span className="metric-value">
                {formatNumber(enhancedRiskMetrics.capitalEfficiencyScore)}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Opportunity Cost</span>
              <span className="metric-value" style={{ color: enhancedRiskMetrics.opportunityCost > 0 ? '#ef4444' : '#10b981' }}>
                {formatPercent(enhancedRiskMetrics.opportunityCost)}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Scenario Risk Score</span>
              <span className="metric-value" style={{
                color: enhancedRiskMetrics.scenarioRiskScore > 60 ? '#ef4444' :
                       enhancedRiskMetrics.scenarioRiskScore > 30 ? '#f59e0b' : '#10b981'
              }}>
                {formatNumber(enhancedRiskMetrics.scenarioRiskScore)}/100
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Max Unrealized Drawdown</span>
              <span className="metric-value" style={{ color: enhancedRiskMetrics.maxUnrealizedDrawdown < 0 ? '#ef4444' : '#10b981' }}>
                {formatCurrency(enhancedRiskMetrics.maxUnrealizedDrawdown)}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Buy/Sell Ratio</span>
              <span className="metric-value">
                {formatNumber(enhancedRiskMetrics.buySellRatio)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations Section */}
      {recommendations && recommendations.length > 0 && (
        <div className="scenario-recommendations">
          <h4>Recommendations</h4>
          <div className="recommendations-list">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className="recommendation-item"
                style={{ borderLeft: `3px solid ${PRIORITY_COLORS[rec.priority] || '#6b7280'}` }}
              >
                <div className="recommendation-header">
                  <span
                    className="priority-badge"
                    style={{
                      backgroundColor: PRIORITY_COLORS[rec.priority] || '#6b7280',
                      color: 'white'
                    }}
                  >
                    {rec.priority.toUpperCase()}
                  </span>
                  <span className="recommendation-action">{rec.action}</span>
                </div>
                <p className="recommendation-reason">
                  <strong>Reason:</strong> {rec.reason}
                </p>
                <p className="recommendation-suggestion">
                  <strong>Suggestion:</strong> {rec.suggestion}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScenarioAnalysis;
