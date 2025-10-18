/**
 * BetaControlsSection - Beta scaling controls for volatility adjustment
 *
 * Allows users to enable beta scaling, adjust coefficient, and optionally override beta values.
 */

import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { SectionHeader } from '../shared/SectionHeader';
import { ParameterInput } from '../shared/ParameterInput';
import { PercentageSlider } from '../shared/PercentageSlider';
import { StockBetaTable } from '../shared/StockBetaTable';
import { useStockBetas } from '../hooks/useStockBetas';

export const BetaControlsSection = ({
  symbol,
  parameters,
  onParametersChange,
  mode = 'single',
  enableBetaScaling = false,
  onBetaScalingChange,
  betaData = { beta: null, betaFactor: null, coefficient: 1.0 },
  onBetaDataChange,
  loading = false,
  error = null,
  className = '',
  stocks = [] // For portfolio mode: array of stock symbols
}) => {
  const [manualBetaOverride, setManualBetaOverride] = useState(false);
  const [manualBetaValue, setManualBetaValue] = useState('');

  // Portfolio mode: Use hook to manage betas for multiple stocks
  const portfolioBetas = useStockBetas(mode === 'portfolio' && enableBetaScaling ? stocks : []);

  const handleCoefficientChange = (newCoefficient) => {
    const updatedBetaData = {
      ...betaData,
      coefficient: newCoefficient,
      betaFactor: betaData.beta ? (betaData.beta * newCoefficient) : null
    };
    onBetaDataChange(updatedBetaData);
  };

  const handleManualBetaChange = (value) => {
    setManualBetaValue(value);
    if (value && !isNaN(parseFloat(value))) {
      const beta = parseFloat(value);
      const updatedBetaData = {
        ...betaData,
        beta: beta,
        betaFactor: beta * betaData.coefficient,
        isManual: true
      };
      onBetaDataChange(updatedBetaData);
    }
  };

  const toggleManualOverride = () => {
    const newOverrideState = !manualBetaOverride;
    setManualBetaOverride(newOverrideState);

    if (!newOverrideState) {
      // Restore original beta if disabling manual override
      setManualBetaValue('');
      if (betaData.isManual) {
        const updatedBetaData = {
          ...betaData,
          isManual: false
        };
        onBetaDataChange(updatedBetaData);
      }
    }
  };

  return (
    <section className={`backtest-section beta-controls ${className}`}>
      <SectionHeader
        icon={Settings}
        title="Beta Scaling Controls"
        subtitle="Adjust lot sizes based on stock volatility relative to market"
      />

      {/* Enable Beta Scaling Checkbox */}
      <div className="beta-enable-toggle">
        <label>
          <input
            type="checkbox"
            checked={enableBetaScaling}
            onChange={(e) => onBetaScalingChange(e.target.checked)}
          />
          Enable Beta Scaling
        </label>
        <span className="help-text">
          Automatically adjust lot sizes based on stock beta (volatility)
        </span>
      </div>

      {/* Beta Scaling Controls - Only shown when enabled */}
      {enableBetaScaling && (
        <div className="beta-controls-content">
          {/* Loading State */}
          {loading && (
            <div className="loading-spinner">
              <span>Loading beta data...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Beta Value Display (Read-Only) */}
          {!loading && !error && betaData.beta !== null && (
            <div className="beta-value-display">
              <div className="display-label">Current Beta Value</div>
              <div className="beta-value">
                {betaData.beta.toFixed(2)}
                {betaData.isManual && <span className="manual-indicator"> (Manual)</span>}
              </div>
              <span className="help-text">
                {betaData.beta < 1
                  ? 'Lower volatility than market'
                  : betaData.beta > 1
                  ? 'Higher volatility than market'
                  : 'Similar volatility to market'}
              </span>
            </div>
          )}

          {/* Coefficient Slider */}
          {!loading && !error && betaData.beta !== null && (
            <PercentageSlider
              label="Beta Coefficient"
              value={betaData.coefficient}
              onChange={handleCoefficientChange}
              min={0.25}
              max={3.0}
              step={0.25}
              helpText="Multiplier applied to beta value (higher = more aggressive scaling)"
              valueFormatter={(v) => `${v.toFixed(2)}x`}
            />
          )}

          {/* Beta Factor Display */}
          {!loading && !error && betaData.betaFactor !== null && (
            <div className="beta-factor-display">
              <div className="display-label">Calculated Beta Factor</div>
              <div className="beta-factor">
                {betaData.betaFactor.toFixed(2)}
              </div>
              <span className="help-text">
                Beta ({betaData.beta.toFixed(2)}) × Coefficient ({betaData.coefficient.toFixed(2)})
              </span>
            </div>
          )}

          {/* Portfolio Mode: Stock Beta Table */}
          {mode === 'portfolio' && stocks.length > 0 && (
            <StockBetaTable
              stocks={stocks}
              betaData={portfolioBetas.betaData}
              coefficient={betaData.coefficient}
              loading={portfolioBetas.loading}
              onRefresh={portfolioBetas.refreshBeta}
              onRefreshAll={portfolioBetas.refreshAll}
            />
          )}

          {/* Manual Beta Override (Single Stock Only) */}
          {mode === 'single' && (
            <div className="manual-beta-override">
              <label>
                <input
                  type="checkbox"
                  checked={manualBetaOverride}
                  onChange={toggleManualOverride}
                />
                Manual Beta Override
              </label>
              <span className="help-text">
                Override the calculated beta with a custom value
              </span>

              {manualBetaOverride && (
                <ParameterInput
                  label="Manual Beta Value"
                  value={manualBetaValue}
                  onChange={handleManualBetaChange}
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="5.0"
                  helpText="Enter a custom beta value (typically 0.5 - 2.0)"
                />
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default BetaControlsSection;
