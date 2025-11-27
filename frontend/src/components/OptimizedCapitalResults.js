/**
 * OptimizedCapitalResults - Five-tab view for optimized capital mode (Spec 61 - REVISED)
 *
 * When optimizedTotalCapital is enabled, the backend returns FIVE scenarios:
 * - Discovery: Initial run with $10M to find peak deployed capital
 * - Optimal (100%): Fresh backtest with discovered capital, zero rejections
 * - Constrained (90%): Fresh backtest with 90% of optimal capital, some rejections
 * - Constrained (80%): Fresh backtest with 80% of optimal capital, more rejections
 * - Constrained (70%): Fresh backtest with 70% of optimal capital, most rejections
 *
 * This component provides tab navigation between the five scenarios,
 * each showing the full PortfolioResults component.
 */

import React, { useState } from 'react';
import PortfolioResults from './PortfolioResults';
import './OptimizedCapitalResults.css';

const OptimizedCapitalResults = ({ data }) => {
  const [activeScenario, setActiveScenario] = useState('discovery');

  // Extract capital discovery info and scenarios
  const { capitalDiscovery, scenarios } = data;

  if (!scenarios || !scenarios.discovery || !scenarios.optimal || !scenarios.constrained90 || !scenarios.constrained80 || !scenarios.constrained70) {
    console.error('Invalid optimized capital response format:', data);
    return (
      <div className="error-banner">
        <h3>Invalid Response Format</h3>
        <p>The optimized capital response is missing expected scenario data.</p>
      </div>
    );
  }

  const initialCapital = capitalDiscovery?.initialCapital || 0;
  const optimalCapital = capitalDiscovery?.peakDeployedCapital || 0;
  const constrained90Capital = capitalDiscovery?.constrainedCapital90 || 0;
  const constrained80Capital = capitalDiscovery?.constrainedCapital80 || 0;
  const constrained70Capital = capitalDiscovery?.constrainedCapital70 || 0;
  const excessCapital = capitalDiscovery?.excessCapital || 0;
  const peakCapitalDate = capitalDiscovery?.peakCapitalDate || 'N/A';

  // Get rejected orders count for each scenario
  const discoveryRejections = scenarios.discovery.rejectedOrders?.length || 0;
  const optimalRejections = scenarios.optimal.rejectedOrders?.length || 0;
  const constrained90Rejections = scenarios.constrained90.rejectedOrders?.length || 0;
  const constrained80Rejections = scenarios.constrained80.rejectedOrders?.length || 0;
  const constrained70Rejections = scenarios.constrained70.rejectedOrders?.length || 0;

  return (
    <div className="optimized-capital-results">
      {/* Capital Discovery Summary */}
      <div className="capital-discovery-banner">
        <div className="discovery-header">
          <h2>Capital Discovery Complete</h2>
          <p>Five scenarios generated: Discovery, Optimal, and Constrained capital at 90%, 80%, 70%</p>
        </div>
        <div className="discovery-stats">
          <div className="stat-item discovery">
            <span className="stat-label">Initial Capital</span>
            <span className="stat-value">${initialCapital.toLocaleString()}</span>
            <span className="stat-detail">Discovery run</span>
          </div>
          <div className="stat-divider">→</div>
          <div className="stat-item optimal">
            <span className="stat-label">Discovered (100%)</span>
            <span className="stat-value">${optimalCapital.toLocaleString()}</span>
            <span className="stat-detail">Peak on {peakCapitalDate}</span>
          </div>
          <div className="stat-divider">→</div>
          <div className="stat-item constrained">
            <span className="stat-label">Constrained Scenarios</span>
            <span className="stat-value">90% / 80% / 70%</span>
            <span className="stat-detail">Multiple capital levels</span>
          </div>
        </div>
      </div>

      {/* Scenario Tabs */}
      <div className="scenario-tabs">
        <button
          className={`scenario-tab ${activeScenario === 'discovery' ? 'active' : ''}`}
          onClick={() => setActiveScenario('discovery')}
        >
          <span className="tab-icon">🔍</span>
          <span className="tab-title">Discovery</span>
          <span className="tab-subtitle">
            ${initialCapital.toLocaleString()} → ${optimalCapital.toLocaleString()}
          </span>
        </button>
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
          className={`scenario-tab ${activeScenario === 'constrained90' ? 'active' : ''}`}
          onClick={() => setActiveScenario('constrained90')}
        >
          <span className="tab-icon">90%</span>
          <span className="tab-title">Constrained 90%</span>
          <span className="tab-subtitle">
            ${constrained90Capital.toLocaleString()} | {constrained90Rejections} rejections
          </span>
        </button>
        <button
          className={`scenario-tab ${activeScenario === 'constrained80' ? 'active' : ''}`}
          onClick={() => setActiveScenario('constrained80')}
        >
          <span className="tab-icon">80%</span>
          <span className="tab-title">Constrained 80%</span>
          <span className="tab-subtitle">
            ${constrained80Capital.toLocaleString()} | {constrained80Rejections} rejections
          </span>
        </button>
        <button
          className={`scenario-tab ${activeScenario === 'constrained70' ? 'active' : ''}`}
          onClick={() => setActiveScenario('constrained70')}
        >
          <span className="tab-icon">70%</span>
          <span className="tab-title">Constrained 70%</span>
          <span className="tab-subtitle">
            ${constrained70Capital.toLocaleString()} | {constrained70Rejections} rejections
          </span>
        </button>
      </div>

      {/* Scenario Content */}
      <div className="scenario-content">
        {activeScenario === 'discovery' && (
          <div className="scenario-panel discovery">
            <div className="scenario-header">
              <h3>Capital Discovery Scenario</h3>
              <p>
                Initial run with ${initialCapital.toLocaleString()} to discover peak deployed capital.
                Found ${optimalCapital.toLocaleString()} (peak on {peakCapitalDate}), with ${excessCapital.toLocaleString()} unused.
              </p>
            </div>
            <PortfolioResults data={scenarios.discovery} />
          </div>
        )}

        {activeScenario === 'optimal' && (
          <div className="scenario-panel optimal">
            <div className="scenario-header">
              <h3>Optimal Capital Scenario (100%)</h3>
              <p>
                Fresh backtest with discovered capital (${optimalCapital.toLocaleString()}).
                This represents the ceiling performance with exactly the capital needed.
              </p>
            </div>
            <PortfolioResults data={scenarios.optimal} />
          </div>
        )}

        {activeScenario === 'constrained90' && (
          <div className="scenario-panel constrained">
            <div className="scenario-header">
              <h3>Constrained Capital Scenario (90%)</h3>
              <p>
                Fresh backtest with 90% of optimal capital (${constrained90Capital.toLocaleString()}).
                Shows realistic performance with some capital constraints and rejected orders.
              </p>
            </div>
            <PortfolioResults data={scenarios.constrained90} />
          </div>
        )}

        {activeScenario === 'constrained80' && (
          <div className="scenario-panel constrained">
            <div className="scenario-header">
              <h3>Constrained Capital Scenario (80%)</h3>
              <p>
                Fresh backtest with 80% of optimal capital (${constrained80Capital.toLocaleString()}).
                Shows performance with moderate capital constraints and more rejected orders.
              </p>
            </div>
            <PortfolioResults data={scenarios.constrained80} />
          </div>
        )}

        {activeScenario === 'constrained70' && (
          <div className="scenario-panel constrained">
            <div className="scenario-header">
              <h3>Constrained Capital Scenario (70%)</h3>
              <p>
                Fresh backtest with 70% of optimal capital (${constrained70Capital.toLocaleString()}).
                Shows performance with significant capital constraints and most rejected orders.
              </p>
            </div>
            <PortfolioResults data={scenarios.constrained70} />
          </div>
        )}
      </div>
    </div>
  );
};

export default OptimizedCapitalResults;
