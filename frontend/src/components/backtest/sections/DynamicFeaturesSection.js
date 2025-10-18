/**
 * DynamicFeaturesSection - Dynamic backtest features configuration
 *
 * Handles dynamic grid, consecutive incremental features, scenario detection,
 * and reference normalization.
 */

import React from 'react';
import { Zap } from 'lucide-react';
import { SectionHeader } from '../shared/SectionHeader';
import { ParameterInput } from '../shared/ParameterInput';
import { PercentageSlider } from '../shared/PercentageSlider';

export const DynamicFeaturesSection = ({
  parameters,
  onParametersChange,
  validationErrors = [],
  showBatchRanges = false,
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
    <section className={`backtest-section dynamic-features ${className}`}>
      <SectionHeader
        icon={Zap}
        title="Dynamic Features"
      />

      <div className="checkbox-grid">
        {/* Enable Dynamic Grid */}
        <div className="checkbox-item">
          <label>
            <input
              type="checkbox"
              checked={parameters.enableDynamicGrid || false}
              onChange={(e) => handleChange('enableDynamicGrid', e.target.checked)}
            />
            Enable Dynamic Grid
          </label>
          {parameters.enableDynamicGrid && (
            <div className="nested-control">
              <PercentageSlider
                label="Dynamic Grid Multiplier"
                value={parameters.dynamicGridMultiplier || 1.0}
                onChange={(val) => handleChange('dynamicGridMultiplier', val)}
                min={0.5}
                max={2.0}
                step={0.1}
                helpText="Multiplier for grid spacing based on volatility"
              />
            </div>
          )}
        </div>

        {/* Enable Consecutive Incremental Buy Grid */}
        <div className="checkbox-item">
          <label>
            <input
              type="checkbox"
              checked={parameters.enableConsecutiveIncrementalBuyGrid || false}
              onChange={(e) => handleChange('enableConsecutiveIncrementalBuyGrid', e.target.checked)}
            />
            Enable Consecutive Incremental Buy Grid
          </label>
          {parameters.enableConsecutiveIncrementalBuyGrid && (
            <div className="nested-control">
              <ParameterInput
                label="Grid Consecutive Increment (%)"
                value={parameters.gridConsecutiveIncrement || 0}
                onChange={(val) => handleChange('gridConsecutiveIncrement', val)}
                type="number"
                min="0"
                max="100"
                step="0.1"
                helpText="Percentage increment for consecutive buy grids"
                error={getError('gridConsecutiveIncrement')}
              />
            </div>
          )}
        </div>

        {/* Enable Consecutive Incremental Sell Profit */}
        <div className="checkbox-item">
          <label>
            <input
              type="checkbox"
              checked={parameters.enableConsecutiveIncrementalSellProfit || false}
              onChange={(e) => handleChange('enableConsecutiveIncrementalSellProfit', e.target.checked)}
            />
            Enable Consecutive Incremental Sell Profit
          </label>
        </div>

        {/* Enable Scenario Detection */}
        <div className="checkbox-item">
          <label>
            <input
              type="checkbox"
              checked={parameters.enableScenarioDetection || false}
              onChange={(e) => handleChange('enableScenarioDetection', e.target.checked)}
            />
            Enable Scenario Detection
          </label>
        </div>

        {/* Normalize to Reference */}
        <div className="checkbox-item">
          <label>
            <input
              type="checkbox"
              checked={parameters.normalizeToReference || false}
              onChange={(e) => handleChange('normalizeToReference', e.target.checked)}
            />
            Normalize to Reference
          </label>
        </div>
      </div>
    </section>
  );
};

export default DynamicFeaturesSection;
