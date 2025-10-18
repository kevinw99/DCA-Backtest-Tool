/**
 * BasicParametersSection - Basic backtest parameters
 *
 * Handles lot size, max lots, strategy mode, and portfolio-specific parameters.
 */

import React from 'react';
import { DollarSign } from 'lucide-react';
import { SectionHeader } from '../shared/SectionHeader';
import { ParameterInput } from '../shared/ParameterInput';

export const BasicParametersSection = ({
  parameters,
  onParametersChange,
  mode = 'single',
  showStrategyMode = true,
  showMaxLotsToSell = true,
  showTotalCapital = false,
  showMaxLotsPerStock = false,
  validationErrors = [],
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
    <section className={`backtest-section basic-parameters ${className}`}>
      <SectionHeader
        icon={DollarSign}
        title={mode === 'portfolio' ? 'Capital Settings' : 'Investment Parameters'}
      />

      <div className="parameter-grid">
        {/* Portfolio: Total Capital */}
        {showTotalCapital && (
          <ParameterInput
            label="Total Capital ($)"
            value={parameters.totalCapital || 0}
            onChange={(val) => handleChange('totalCapital', val)}
            type="number"
            step="1000"
            min="0"
            helpText="Total amount of capital available for the portfolio"
            error={getError('totalCapital')}
          />
        )}

        {/* Lot Size */}
        <ParameterInput
          label="Lot Size ($)"
          value={parameters.lotSizeUsd || 0}
          onChange={(val) => handleChange('lotSizeUsd', val)}
          type="number"
          step="1000"
          min="0"
          helpText="Dollar amount per lot (typically $5,000 - $20,000)"
          error={getError('lotSizeUsd')}
        />

        {/* Max Lots (Single) or Max Lots Per Stock (Portfolio) */}
        {mode === 'single' && (
          <ParameterInput
            label="Max Lots"
            value={parameters.maxLots || 0}
            onChange={(val) => handleChange('maxLots', val)}
            type="number"
            min="1"
            max="100"
            helpText="Maximum number of lots to hold"
            error={getError('maxLots')}
          />
        )}

        {showMaxLotsPerStock && (
          <ParameterInput
            label="Max Lots Per Stock"
            value={parameters.maxLotsPerStock || 0}
            onChange={(val) => handleChange('maxLotsPerStock', val)}
            type="number"
            min="1"
            max="100"
            helpText="Maximum number of lots any single stock can hold"
            error={getError('maxLotsPerStock')}
          />
        )}

        {/* Max Lots to Sell */}
        {showMaxLotsToSell && mode === 'single' && (
          <ParameterInput
            label="Max Lots to Sell"
            value={parameters.maxLotsToSell || 1}
            onChange={(val) => handleChange('maxLotsToSell', val)}
            type="number"
            min="1"
            max={parameters.maxLots || 100}
            helpText="Maximum lots to sell in a single transaction"
            error={getError('maxLotsToSell')}
          />
        )}
      </div>

      {/* Strategy Mode Toggle (Single Stock Only) */}
      {showStrategyMode && mode === 'single' && (
        <div className="strategy-mode-toggle">
          <div className="toggle-label">Strategy Mode</div>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                value="long"
                checked={parameters.strategyMode === 'long'}
                onChange={() => handleChange('strategyMode', 'long')}
              />
              Long (Buy & Hold + Sell)
            </label>
            <label>
              <input
                type="radio"
                value="short"
                checked={parameters.strategyMode === 'short'}
                onChange={() => handleChange('strategyMode', 'short')}
              />
              Short (Short Selling)
            </label>
          </div>
        </div>
      )}
    </section>
  );
};

export default BasicParametersSection;
