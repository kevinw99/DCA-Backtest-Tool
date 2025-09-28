import React, { useState, useEffect } from 'react';
import { Edit2, RotateCcw, Loader2 } from 'lucide-react';
import './BetaControls.css';

const BetaControls = ({
  symbol,
  beta = 1.0,
  onBetaChange,
  isManualOverride = false,
  onToggleManualOverride,
  enableBetaScaling = false,
  onToggleBetaScaling,
  baseParameters = {},
  adjustedParameters = {},
  loading = false,
  error = null
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(beta.toString());
  const [fetchingBeta, setFetchingBeta] = useState(false);
  const [betaSource, setBetaSource] = useState('Default Value');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch beta data when symbol changes (unless manual override is active)
  useEffect(() => {
    if (symbol && !isManualOverride) {
      fetchBetaData();
    }
  }, [symbol, isManualOverride]);

  const fetchBetaData = async () => {
    setFetchingBeta(true);
    try {
      const response = await fetch(`/api/stocks/${symbol}/beta`);
      if (response.ok) {
        const data = await response.json();
        onBetaChange(data.beta);
        setBetaSource(data.source || 'API');
        setLastUpdated(data.lastUpdated);
      }
    } catch (error) {
      console.error('Error fetching Beta data:', error);
    } finally {
      setFetchingBeta(false);
    }
  };

  const handleEditClick = () => {
    setEditValue(beta.toString());
    setIsEditing(true);
  };

  const handleSave = async () => {
    const newBeta = parseFloat(editValue);
    
    if (isNaN(newBeta) || newBeta < 0) {
      alert('Please enter a valid Beta value (must be >= 0)');
      return;
    }

    // If manual override is active, save to API
    if (isManualOverride) {
      try {
        const response = await fetch(`/api/stocks/${symbol}/beta`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            beta: newBeta,
            isManualOverride: true
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          alert(`Failed to update Beta: ${errorData.message || 'Unknown error'}`);
          return;
        }
      } catch (error) {
        alert(`Failed to update Beta: ${error.message}`);
        return;
      }
    }

    onBetaChange(newBeta);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(beta.toString());
    setIsEditing(false);
  };

  const handleToggleManualOverride = () => {
    onToggleManualOverride(!isManualOverride);
  };

  const handleReset = async () => {
    try {
      const response = await fetch(`/api/stocks/${symbol}/beta`);
      if (response.ok) {
        const data = await response.json();
        onBetaChange(data.beta);
        onToggleManualOverride(false);
        setBetaSource(data.source || 'API');
        setLastUpdated(data.lastUpdated);
      }
    } catch (error) {
      console.error('Error resetting Beta data:', error);
    }
  };

  const formatPercentage = (value) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  const hasExtremeParameters = () => {
    if (!enableBetaScaling || !adjustedParameters) return false;
    
    return (
      (adjustedParameters.profitRequirement && adjustedParameters.profitRequirement > 0.2) ||
      (adjustedParameters.gridIntervalPercent && adjustedParameters.gridIntervalPercent > 0.5)
    );
  };

  const getParameterComparisons = () => {
    if (!baseParameters || !adjustedParameters) return [];
    
    const comparisons = [];
    const parameterLabels = {
      profitRequirement: 'Profit Requirement',
      gridIntervalPercent: 'Grid Interval',
      trailingBuyActivationPercent: 'Trailing Buy Activation',
      trailingBuyReboundPercent: 'Trailing Buy Rebound',
      trailingSellActivationPercent: 'Trailing Sell Activation',
      trailingSellPullbackPercent: 'Trailing Sell Pullback'
    };

    Object.keys(parameterLabels).forEach(key => {
      if (baseParameters[key] !== undefined && adjustedParameters[key] !== undefined) {
        comparisons.push({
          label: parameterLabels[key],
          base: baseParameters[key],
          adjusted: adjustedParameters[key]
        });
      }
    });

    return comparisons;
  };

  return (
    <div className="beta-controls">
      {error && (
        <div className="beta-error">
          {error}
        </div>
      )}

      <div className="beta-header">
        <h3>
          Beta (Market Volatility)
          {fetchingBeta && <Loader2 className="beta-loading-spinner" size={16} />}
        </h3>
        
        <div className="beta-value-section">
          <div className="beta-display">
            {isEditing ? (
              <div className="beta-edit-controls">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="beta-input"
                />
                <button onClick={handleSave} className="beta-save-btn">
                  Save
                </button>
                <button onClick={handleCancel} className="beta-cancel-btn">
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <span className="beta-value">{beta.toFixed(2)}</span>
                <button
                  onClick={handleEditClick}
                  className="beta-edit-btn"
                  title="Edit Beta value"
                  disabled={loading}
                >
                  <Edit2 size={16} />
                </button>
              </>
            )}
          </div>
          
          <div className="beta-status">
            <span className="beta-source">
              {isManualOverride ? 'Manual Override' : betaSource}
            </span>
            {lastUpdated && (
              <span className="beta-last-updated">
                Updated: {formatDate(lastUpdated)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="beta-explanation">
        <p>Beta measures stock volatility vs. market:</p>
        <ul>
          <li>Beta = 1.0: Moves with market</li>
          <li>Beta &gt; 1.0: More volatile than market</li>
          <li>Beta &lt; 1.0: Less volatile than market</li>
        </ul>
      </div>

      <div className="beta-controls-section">
        <div className="beta-scaling-toggle">
          <label>
            <input
              type="checkbox"
              checked={enableBetaScaling}
              onChange={(e) => onToggleBetaScaling(e.target.checked)}
              disabled={loading}
            />
            Enable Beta Scaling
          </label>
        </div>

        <div className="beta-override-section">
          <button
            onClick={handleToggleManualOverride}
            className="beta-override-btn"
            disabled={loading}
          >
            Manual Override
          </button>
          
          {isManualOverride && (
            <button
              onClick={handleReset}
              className="beta-reset-btn"
              disabled={loading}
            >
              <RotateCcw size={14} />
              Reset
            </button>
          )}
        </div>
      </div>

      {enableBetaScaling && (
        <div className="beta-parameter-adjustments">
          <h4>Parameter Adjustments</h4>
          
          {hasExtremeParameters() && (
            <div className="beta-warning">
              Some adjusted parameters are extreme. Consider manual override.
            </div>
          )}

          {getParameterComparisons().length > 0 ? (
            <div className="parameter-comparison-grid">
              {getParameterComparisons().map((param, index) => (
                <div key={index} className="parameter-comparison">
                  <span className="parameter-label">{param.label}</span>
                  <div className="parameter-values">
                    <span className="base-value">{formatPercentage(param.base)}</span>
                    <span className="arrow">→</span>
                    <span className="adjusted-value">{formatPercentage(param.adjusted)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No parameter adjustments to display</p>
          )}
        </div>
      )}
    </div>
  );
};

export default BetaControls;