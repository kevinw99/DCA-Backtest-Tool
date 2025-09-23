import React, { useState } from 'react';
import './MetricsSelector.css';

const MetricsSelector = ({ availableMetrics, visibleMetrics, onMetricsChange }) => {
  const [showSelector, setShowSelector] = useState(false);

  const defaultMetrics = availableMetrics.filter(metric => 
    ['price', 'revenue', 'yoy_revenue_growth', 'eps', 'pe_ratio', 'gross_margin', 'operating_margin', 'net_margin'].includes(metric.id)
  );
  
  const additionalMetrics = availableMetrics.filter(metric => 
    !['price', 'revenue', 'yoy_revenue_growth', 'eps', 'pe_ratio', 'gross_margin', 'operating_margin', 'net_margin'].includes(metric.id)
  );

  const handleMetricToggle = (metricId) => {
    const newVisibleMetrics = visibleMetrics.includes(metricId)
      ? visibleMetrics.filter(id => id !== metricId)
      : [...visibleMetrics, metricId];
    
    onMetricsChange(newVisibleMetrics);
  };

  const resetToDefaults = () => {
    onMetricsChange(['price', 'revenue', 'yoy_revenue_growth', 'eps', 'pe_ratio', 'gross_margin', 'operating_margin', 'net_margin']);
  };

  const selectAll = () => {
    onMetricsChange(availableMetrics.map(m => m.id));
  };

  const selectNone = () => {
    onMetricsChange([]);
  };

  return (
    <div className="metrics-selector">
      <div className="selector-header">
        <div className="selector-title">
          <h3>Chart Metrics ({visibleMetrics.length} selected)</h3>
          <button 
            className="toggle-selector"
            onClick={() => setShowSelector(!showSelector)}
          >
            {showSelector ? 'Hide Options' : 'Show Options'}
          </button>
        </div>
        
        {showSelector && (
          <div className="selector-actions">
            <button onClick={resetToDefaults} className="action-button">
              Reset to Defaults
            </button>
            <button onClick={selectAll} className="action-button">
              Select All
            </button>
            <button onClick={selectNone} className="action-button">
              Select None
            </button>
          </div>
        )}
      </div>

      {showSelector && (
        <div className="metrics-options">
          <div className="metrics-section">
            <h4>Default Metrics</h4>
            <div className="metrics-grid">
              {defaultMetrics.map(metric => (
                <label key={metric.id} className="metric-option">
                  <input
                    type="checkbox"
                    checked={visibleMetrics.includes(metric.id)}
                    onChange={() => handleMetricToggle(metric.id)}
                  />
                  <span className="metric-name">{metric.name}</span>
                  <span className="metric-type">({metric.type})</span>
                </label>
              ))}
            </div>
          </div>

          {additionalMetrics.length > 0 && (
            <div className="metrics-section">
              <h4>Additional Metrics</h4>
              <div className="metrics-grid">
                {additionalMetrics.map(metric => (
                  <label key={metric.id} className="metric-option">
                    <input
                      type="checkbox"
                      checked={visibleMetrics.includes(metric.id)}
                      onChange={() => handleMetricToggle(metric.id)}
                    />
                    <span className="metric-name">{metric.name}</span>
                    <span className="metric-type">({metric.type})</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MetricsSelector;