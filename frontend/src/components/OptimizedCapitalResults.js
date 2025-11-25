/**
 * OptimizedCapitalResults - Two-tab view for optimized capital mode (Spec 61)
 *
 * When optimizedTotalCapital is enabled, the backend returns two scenarios:
 * - Optimal (100%): Discovery run with auto-discovered capital, zero rejections
 * - Constrained (90%): Second run with 90% of optimal capital, some rejections
 *
 * This component provides tab navigation between the two scenarios,
 * each showing the full PortfolioResults component.
 */

import React, { useState } from 'react';
import PortfolioResults from './PortfolioResults';
import './OptimizedCapitalResults.css';

const OptimizedCapitalResults = ({ data }) => {
  const [activeScenario, setActiveScenario] = useState('optimal');

  // Extract capital discovery info and scenarios
  const { capitalDiscovery, scenarios } = data;

  if (!scenarios || !scenarios.optimal || !scenarios.constrained) {
    console.error('Invalid optimized capital response format:', data);
    return (
      <div className="error-banner">
        <h3>Invalid Response Format</h3>
        <p>The optimized capital response is missing expected scenario data.</p>
      </div>
    );
  }

  const optimalCapital = capitalDiscovery?.peakDeployedCapital || 0;
  const constrainedCapital = capitalDiscovery?.constrainedCapital || 0;
  const peakCapitalDate = capitalDiscovery?.peakCapitalDate || 'N/A';

  // Get rejected orders count for each scenario
  const optimalRejections = scenarios.optimal.rejectedOrders?.length || 0;
  const constrainedRejections = scenarios.constrained.rejectedOrders?.length || 0;

  return (
    <div className="optimized-capital-results">
      {/* Capital Discovery Summary */}
      <div className="capital-discovery-banner">
        <div className="discovery-header">
          <h2>Capital Discovery Complete</h2>
          <p>Two scenarios generated to compare optimal vs constrained capital performance</p>
        </div>
        <div className="discovery-stats">
          <div className="stat-item optimal">
            <span className="stat-label">Optimal Capital (100%)</span>
            <span className="stat-value">${optimalCapital.toLocaleString()}</span>
            <span className="stat-detail">Peak on {peakCapitalDate}</span>
          </div>
          <div className="stat-divider">vs</div>
          <div className="stat-item constrained">
            <span className="stat-label">Constrained Capital (90%)</span>
            <span className="stat-value">${constrainedCapital.toLocaleString()}</span>
            <span className="stat-detail">{constrainedRejections} rejected orders</span>
          </div>
        </div>
      </div>

      {/* Scenario Tabs */}
      <div className="scenario-tabs">
        <button
          className={`scenario-tab ${activeScenario === 'optimal' ? 'active' : ''}`}
          onClick={() => setActiveScenario('optimal')}
        >
          <span className="tab-icon">100%</span>
          <span className="tab-title">Optimal Capital</span>
          <span className="tab-subtitle">
            ${optimalCapital.toLocaleString()} | {optimalRejections} rejections
          </span>
        </button>
        <button
          className={`scenario-tab ${activeScenario === 'constrained' ? 'active' : ''}`}
          onClick={() => setActiveScenario('constrained')}
        >
          <span className="tab-icon">90%</span>
          <span className="tab-title">Constrained Capital</span>
          <span className="tab-subtitle">
            ${constrainedCapital.toLocaleString()} | {constrainedRejections} rejections
          </span>
        </button>
      </div>

      {/* Scenario Content */}
      <div className="scenario-content">
        {activeScenario === 'optimal' && (
          <div className="scenario-panel optimal">
            <div className="scenario-header">
              <h3>Optimal Capital Scenario (100%)</h3>
              <p>
                Using the exact capital needed for zero rejected orders.
                This represents the ceiling performance of your strategy.
              </p>
            </div>
            <PortfolioResults data={scenarios.optimal} />
          </div>
        )}

        {activeScenario === 'constrained' && (
          <div className="scenario-panel constrained">
            <div className="scenario-header">
              <h3>Constrained Capital Scenario (90%)</h3>
              <p>
                Using 90% of optimal capital to show realistic performance with some rejected orders.
                This helps understand the impact of capital constraints.
              </p>
            </div>
            <PortfolioResults data={scenarios.constrained} />
          </div>
        )}
      </div>
    </div>
  );
};

export default OptimizedCapitalResults;
