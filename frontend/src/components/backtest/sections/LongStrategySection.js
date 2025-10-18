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
  className = ''
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

  return (
    <section className={`backtest-section long-strategy ${className}`}>
      <SectionHeader
        icon={TrendingUp}
        title="Long Strategy Parameters"
      />

      <div className="parameter-grid">
        {/* Grid Interval */}
        <ParameterInput
          label="Grid Interval (%)"
          value={parameters.gridIntervalPct || 0}
          onChange={(val) => handleChange('gridIntervalPct', val)}
          type="number"
          step="0.1"
          min="0"
          max="100"
          betaAdjusted={betaAdjusted}
          helpText="Percentage drop to trigger buy orders"
          error={getError('gridIntervalPct')}
        />

        {/* Profit Requirement */}
        <ParameterInput
          label="Profit Requirement (%)"
          value={parameters.profitRequirementPct || 0}
          onChange={(val) => handleChange('profitRequirementPct', val)}
          type="number"
          step="0.1"
          min="0"
          max="100"
          betaAdjusted={betaAdjusted}
          helpText="Percentage gain required to trigger sell"
          error={getError('profitRequirementPct')}
        />

        {/* Trailing Stop Parameters - Conditional */}
        {showTrailingStops && (
          <>
            {/* Trailing Buy Activation */}
            <ParameterInput
              label="Trailing Buy Activation (%)"
              value={parameters.trailingBuyActivationPct || 0}
              onChange={(val) => handleChange('trailingBuyActivationPct', val)}
              type="number"
              step="0.1"
              min="0"
              max="100"
              helpText="Price drop to activate trailing buy"
              error={getError('trailingBuyActivationPct')}
            />

            {/* Trailing Buy Rebound */}
            <ParameterInput
              label="Trailing Buy Rebound (%)"
              value={parameters.trailingBuyReboundPct || 0}
              onChange={(val) => handleChange('trailingBuyReboundPct', val)}
              type="number"
              step="0.1"
              min="0"
              max="100"
              helpText="Price rebound from bottom to trigger buy"
              error={getError('trailingBuyReboundPct')}
            />

            {/* Trailing Sell Activation */}
            <ParameterInput
              label="Trailing Sell Activation (%)"
              value={parameters.trailingSellActivationPct || 0}
              onChange={(val) => handleChange('trailingSellActivationPct', val)}
              type="number"
              step="0.1"
              min="0"
              max="100"
              helpText="Price gain to activate trailing sell"
              error={getError('trailingSellActivationPct')}
            />

            {/* Trailing Sell Pullback */}
            <ParameterInput
              label="Trailing Sell Pullback (%)"
              value={parameters.trailingSellPullbackPct || 0}
              onChange={(val) => handleChange('trailingSellPullbackPct', val)}
              type="number"
              step="0.1"
              min="0"
              max="100"
              helpText="Price pullback from peak to trigger sell"
              error={getError('trailingSellPullbackPct')}
            />
          </>
        )}
      </div>

      {/* Trailing Stop Toggles */}
      <div className="checkbox-grid">
        <label>
          <input
            type="checkbox"
            checked={parameters.enableTrailingBuy || false}
            onChange={(e) => handleChange('enableTrailingBuy', e.target.checked)}
          />
          Enable Trailing Buy
        </label>
        <label>
          <input
            type="checkbox"
            checked={parameters.enableTrailingSell || false}
            onChange={(e) => handleChange('enableTrailingSell', e.target.checked)}
          />
          Enable Trailing Sell
        </label>
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
