/**
 * LongStrategySection - Long strategy parameters
 *
 * Handles grid interval, profit requirement, trailing stop parameters,
 * and order type configuration for long strategies.
 */

import React from 'react';
import { TrendingUp } from 'lucide-react';
import { SectionHeader } from '../shared/SectionHeader';
import { ParameterInput } from '../shared/ParameterInput';

export const LongStrategySection = ({
  parameters,
  onParametersChange,
  betaAdjusted = false,
  validationErrors = [],
  showTrailingStops = true,
  showOrderType = true,
  className = '',
  displayAdjustedParameters, // Scaled parameter values
  betaScalingInfo // { enabled, betaSymbol, beta, betaFactor, mode }
}) => {
  const handleChange = (field, value) => {
    onParametersChange({
      ...parameters,
      [field]: value
    });
  };

  const getError = (field) => {
    const error = validationErrors.find(e => e.field === field);
    return error ? error.message : null;
  };

  const getAdjustedValue = (field) => {
    return displayAdjustedParameters ? displayAdjustedParameters[field] : undefined;
  };

  return (
    <section className={`backtest-section long-strategy ${className}`}>
      <SectionHeader
        icon={TrendingUp}
        title="Long Strategy Parameters"
        subtitle={betaScalingInfo ? `Beta scaling enabled - showing example scaled values for ${betaScalingInfo.betaSymbol} (β: ${betaScalingInfo.beta.toFixed(2)})` : undefined}
      />

      <div className="parameter-grid">
        {/* Grid Interval */}
        <ParameterInput
          label="Grid Interval (%)"
          value={parameters.gridIntervalPercent || 0}
          onChange={(val) => handleChange('gridIntervalPercent', val)}
          type="number"
          step="0.1"
          min="0"
          max="100"
          betaAdjusted={betaAdjusted}
          helpText="Percentage drop to trigger buy orders"
          error={getError('gridIntervalPercent')}
          adjustedValue={getAdjustedValue('gridIntervalPercent')}
          betaScalingInfo={betaScalingInfo}
        />

        {/* Profit Requirement */}
        <ParameterInput
          label="Profit Requirement (%)"
          value={parameters.profitRequirement || 0}
          onChange={(val) => handleChange('profitRequirement', val)}
          type="number"
          step="0.1"
          min="0"
          max="100"
          betaAdjusted={betaAdjusted}
          helpText="Percentage gain required to trigger sell"
          error={getError('profitRequirement')}
          adjustedValue={getAdjustedValue('profitRequirement')}
          betaScalingInfo={betaScalingInfo}
        />

        {/* Trailing Stop Parameters - Conditional */}
        {showTrailingStops && (
          <>
            {/* Trailing Buy Activation */}
            <ParameterInput
              label="Trailing Buy Activation (%)"
              value={parameters.trailingBuyActivationPercent || 0}
              onChange={(val) => handleChange('trailingBuyActivationPercent', val)}
              type="number"
              step="0.1"
              min="0"
              max="100"
              helpText="Price drop to activate trailing buy"
              error={getError('trailingBuyActivationPercent')}
              adjustedValue={getAdjustedValue('trailingBuyActivationPercent')}
              betaScalingInfo={betaScalingInfo}
            />

            {/* Trailing Buy Rebound */}
            <ParameterInput
              label="Trailing Buy Rebound (%)"
              value={parameters.trailingBuyReboundPercent || 0}
              onChange={(val) => handleChange('trailingBuyReboundPercent', val)}
              type="number"
              step="0.1"
              min="0"
              max="100"
              helpText="Price rebound from bottom to trigger buy"
              error={getError('trailingBuyReboundPercent')}
              adjustedValue={getAdjustedValue('trailingBuyReboundPercent')}
              betaScalingInfo={betaScalingInfo}
            />

            {/* Trailing Sell Activation */}
            <ParameterInput
              label="Trailing Sell Activation (%)"
              value={parameters.trailingSellActivationPercent || 0}
              onChange={(val) => handleChange('trailingSellActivationPercent', val)}
              type="number"
              step="0.1"
              min="0"
              max="100"
              helpText="Price gain to activate trailing sell"
              error={getError('trailingSellActivationPercent')}
              adjustedValue={getAdjustedValue('trailingSellActivationPercent')}
              betaScalingInfo={betaScalingInfo}
            />

            {/* Trailing Sell Pullback */}
            <ParameterInput
              label="Trailing Sell Pullback (%)"
              value={parameters.trailingSellPullbackPercent || 0}
              onChange={(val) => handleChange('trailingSellPullbackPercent', val)}
              type="number"
              step="0.1"
              min="0"
              max="100"
              helpText="Price pullback from peak to trigger sell"
              error={getError('trailingSellPullbackPercent')}
              adjustedValue={getAdjustedValue('trailingSellPullbackPercent')}
              betaScalingInfo={betaScalingInfo}
            />
          </>
        )}
      </div>

      {/* Order Type Toggle */}
      {showOrderType && (
        <div className="order-type-toggle">
          <div className="toggle-label">Trailing Stop Order Type</div>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                value="LIMIT"
                checked={parameters.trailingStopOrderType === 'LIMIT'}
                onChange={() => handleChange('trailingStopOrderType', 'LIMIT')}
              />
              Limit Order
            </label>
            <label>
              <input
                type="radio"
                value="MARKET"
                checked={parameters.trailingStopOrderType === 'MARKET'}
                onChange={() => handleChange('trailingStopOrderType', 'MARKET')}
              />
              Market Order
            </label>
          </div>
        </div>
      )}
    </section>
  );
};

export default LongStrategySection;
