import React, { useState, useEffect } from 'react';
import { Edit2, RotateCcw, Loader2 } from 'lucide-react';
import './BetaControls.css';

const BetaControls = ({
  symbol,
  beta = 1.0,
  coefficient = 1.0,
  betaFactor = 1.0,
  onBetaChange,
  onCoefficientChange,
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
  const [isCoefficientEditing, setIsCoefficientEditing] = useState(false);
  const [coefficientEditValue, setCoefficientEditValue] = useState(coefficient.toString());
  const [fetchingBeta, setFetchingBeta] = useState(false);
  const [betaSource, setBetaSource] = useState('Default Value');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Update edit values when props change
  useEffect(() => {
    setEditValue(beta.toString());
  }, [beta]);

  useEffect(() => {
    setCoefficientEditValue(coefficient.toString());
  }, [coefficient]);

  // Fetch beta data when symbol changes (unless manual override is active)
  useEffect(() => {
    if (symbol && !isManualOverride) {
      fetchBetaData();
    }
  }, [symbol, isManualOverride]);

  // Helper function to determine proper beta source display
  const determineBetaSource = (apiResponse) => {
    if (!apiResponse) return 'Default Value';

    switch (apiResponse.source) {
      case 'yahoo_finance':
        return 'Yahoo Finance';
      case 'alpha_vantage':
        return 'Alpha Vantage';
      case 'mock':
      case 'default':
        return 'Mock Data';
      case undefined:
      case null:
        return 'Default Value';
      default:
        return apiResponse.source || 'API Default';
    }
  };

  const fetchBetaData = async () => {
    setFetchingBeta(true);
    try {
      const response = await fetch(`/api/stocks/${symbol}/beta`);
      if (response.ok) {
        const data = await response.json();
        onBetaChange(data.beta);
        setBetaSource(determineBetaSource(data));
        setLastUpdated(data.lastUpdated);
      } else {
        // API call failed, fall back to default
        setBetaSource('Default Value (API Error)');
        setLastUpdated(null);
      }
    } catch (error) {
      console.error('Error fetching Beta data:', error);
      setBetaSource('Default Value (Network Error)');
      setLastUpdated(null);
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

  // Coefficient editing handlers
  const handleCoefficientEditClick = () => {
    setCoefficientEditValue(coefficient.toString());
    setIsCoefficientEditing(true);
  };

  const handleCoefficientSave = () => {
    const newCoefficient = parseFloat(coefficientEditValue);

    if (isNaN(newCoefficient) || newCoefficient <= 0) {
      alert('Please enter a valid coefficient value (must be > 0)');
      return;
    }

    if (newCoefficient < 0.1 || newCoefficient > 5.0) {
      const proceed = window.confirm(`Coefficient ${newCoefficient} is outside the recommended range (0.1-5.0). Are you sure you want to continue?`);
      if (!proceed) return;
    }

    onCoefficientChange(newCoefficient);
    setIsCoefficientEditing(false);
  };

  const handleCoefficientCancel = () => {
    setCoefficientEditValue(coefficient.toString());
    setIsCoefficientEditing(false);
  };

  const handleReset = async () => {
    try {
      const response = await fetch(`/api/stocks/${symbol}/beta`);
      if (response.ok) {
        const data = await response.json();
        onBetaChange(data.beta);
        onToggleManualOverride(false);
        setBetaSource(determineBetaSource(data));
        setLastUpdated(data.lastUpdated);
      }
    } catch (error) {
      console.error('Error resetting Beta data:', error);
    }
  };

  const formatPercentage = (value) => {
    return `${value.toFixed(2)}%`;
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
          
          <div className="beta-calculation">
            <div className="calculation-row">
              <span className="calc-label">Beta (Yahoo Finance):</span>
              <span className="calc-value">{beta.toFixed(2)}</span>
            </div>
            <div className="calculation-row">
              <span className="calc-label">Coefficient:</span>
              {isCoefficientEditing ? (
                <div className="beta-edit-controls">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="5.0"
                    value={coefficientEditValue}
                    onChange={(e) => setCoefficientEditValue(e.target.value)}
                    className="beta-input"
                  />
                  <button onClick={handleCoefficientSave} className="beta-save-btn">
                    Save
                  </button>
                  <button onClick={handleCoefficientCancel} className="beta-cancel-btn">
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <span className="calc-value">{coefficient.toFixed(2)}</span>
                  {onCoefficientChange && (
                    <button
                      onClick={handleCoefficientEditClick}
                      className="beta-edit-btn"
                      title="Edit coefficient value"
                      disabled={loading}
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="calculation-row calculation-result">
              <span className="calc-label">β-Factor:</span>
              <span className="calc-value beta-factor">{betaFactor.toFixed(3)}</span>
              <span className="calc-formula">
                = {beta.toFixed(2)} {enableBetaScaling ? `× ${coefficient.toFixed(2)}` : '(scaling disabled)'}
              </span>
            </div>
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
          <h4>Parameter Adjustments (based on β-factor: {betaFactor.toFixed(3)})</h4>
          
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