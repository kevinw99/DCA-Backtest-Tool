/**
 * AdaptiveStrategySection - Adaptive strategy parameters
 *
 * Allows users to enable and configure automatic strategy adaptation based on market conditions.
 */

import React from 'react';
import { Cpu } from 'lucide-react';
import { SectionHeader } from '../shared/SectionHeader';
import { ParameterInput } from '../shared/ParameterInput';

export const AdaptiveStrategySection = ({
  parameters,
  onParametersChange,
  validationErrors = [],
  className = ''
}) => {
  const handleChange = (field, value) => {
    onParametersChange({
      ...parameters,
      [field]: value
    });
  };

  const handleEnableChange = (enabled) => {
    onParametersChange({
      ...parameters,
      enableAdaptiveStrategy: enabled
    });
  };

  const getError = (field) => {
    const error = validationErrors.find(e => e.field === field);
    return error ? error.message : null;
  };

  const isEnabled = parameters.enableAdaptiveStrategy || false;

  return (
    <section className={`backtest-section adaptive-strategy ${className}`}>
      <SectionHeader
        icon={Cpu}
        title="Adaptive Strategy"
        subtitle="Automatically adjust strategy based on market conditions"
      />

      {/* Enable Adaptive Strategy Checkbox */}
      <div className="parameter-grid">
        <div className="parameter-input checkbox-input">
          <label>
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => handleEnableChange(e.target.checked)}
            />
            <span>Enable Adaptive Strategy</span>
          </label>
        </div>
      </div>

      {/* Adaptive Strategy Parameters (shown when enabled) */}
      {isEnabled && (
        <>
          <div className="parameter-grid">
            <ParameterInput
              label="Adaptation Check Interval (days)"
              value={parameters.adaptationCheckInterval || 30}
              onChange={(val) => handleChange('adaptationCheckInterval', val)}
              type="number"
              min="1"
              max="365"
              helpText="How often to check if strategy adaptation is needed"
              error={getError('adaptationCheckInterval')}
            />

            <ParameterInput
              label="Adaptation Rolling Window (days)"
              value={parameters.adaptationRollingWindow || 90}
              onChange={(val) => handleChange('adaptationRollingWindow', val)}
              type="number"
              min="1"
              max="365"
              helpText="Number of days to analyze when deciding to adapt"
              error={getError('adaptationRollingWindow')}
            />

            <ParameterInput
              label="Min Data Days Before Adaptation"
              value={parameters.minDataDaysBeforeAdaptation || 60}
              onChange={(val) => handleChange('minDataDaysBeforeAdaptation', val)}
              type="number"
              min="1"
              max="365"
              helpText="Minimum trading days required before allowing adaptation"
              error={getError('minDataDaysBeforeAdaptation')}
            />

            <ParameterInput
              label="Confidence Threshold"
              value={parameters.confidenceThreshold || 0.7}
              onChange={(val) => handleChange('confidenceThreshold', val)}
              type="number"
              min="0"
              max="1"
              step="0.1"
              helpText="Confidence level required to trigger adaptation (0.0-1.0)"
              error={getError('confidenceThreshold')}
            />
          </div>

          {/* Info Card */}
          <div className="info-card">
            <h4>How Adaptive Strategy Works</h4>
            <p>
              The adaptive strategy monitors market conditions and automatically switches between
              long and short modes when certain criteria are met:
            </p>
            <ul>
              <li>
                <strong>Check Interval:</strong> How frequently the system evaluates if a strategy
                change is needed
              </li>
              <li>
                <strong>Rolling Window:</strong> The time period used to analyze market trends and
                volatility
              </li>
              <li>
                <strong>Min Data Days:</strong> Ensures sufficient trading history before making
                adaptation decisions
              </li>
              <li>
                <strong>Confidence Threshold:</strong> Higher values require stronger signals to
                trigger strategy changes
              </li>
            </ul>
            <p className="note">
              <strong>Note:</strong> Adaptive strategy is experimental and may result in more
              frequent trading and higher transaction costs.
            </p>
          </div>
        </>
      )}
    </section>
  );
};

export default AdaptiveStrategySection;
