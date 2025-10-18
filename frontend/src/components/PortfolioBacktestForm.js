/**
 * Enhanced PortfolioBacktestForm - With full parameter parity to single stock form
 *
 * Uses shared components from backtest/ directory to achieve 100% parameter coverage
 */

import React, { useState } from 'react';
import { Play, RefreshCw, TrendingUp } from 'lucide-react';
import StockSelector from './StockSelector';

// Import shared components
import { BasicParametersSection } from './backtest/sections/BasicParametersSection';
import { DateRangeSection } from './backtest/sections/DateRangeSection';
import { LongStrategySection } from './backtest/sections/LongStrategySection';
import { BetaControlsSection } from './backtest/sections/BetaControlsSection';
import { DynamicFeaturesSection } from './backtest/sections/DynamicFeaturesSection';
import { AdaptiveStrategySection } from './backtest/sections/AdaptiveStrategySection';

// Import custom hooks
import { useBacktestValidation } from './backtest/hooks/useBacktestValidation';
import { useBetaScaling } from './backtest/hooks/useBetaScaling';

// Import utilities
import { ParameterHelper } from './backtest/utils/ParameterHelper';

// Import styles
import './PortfolioBacktestForm.css';
import './backtest/BacktestForm.css';

const PortfolioBacktestForm = ({ parameters, onParametersChange, onSubmit, loading }) => {
  // Validation hook
  const { errors, warnings, isValid, hasError, getError } = useBacktestValidation(
    parameters,
    'portfolio'
  );

  // Beta scaling hook
  const {
    enableBetaScaling,
    betaData,
    adjustedParameters,
    loading: betaLoading,
    error: betaError,
    toggleBetaScaling,
    updateCoefficient,
    updateBeta
  } = useBetaScaling(parameters.stocks || [], parameters.defaultParams, 'portfolio');

  /**
   * Handle top-level field changes (totalCapital, stocks, etc.)
   */
  const handleFieldChange = (field, value) => {
    onParametersChange({
      ...parameters,
      [field]: value
    });
  };

  /**
   * Handle defaultParams changes (grid interval, profit requirement, etc.)
   */
  const handleDefaultParamChange = (field, value) => {
    onParametersChange({
      ...parameters,
      defaultParams: {
        ...parameters.defaultParams,
        [field]: value
      }
    });
  };

  /**
   * Handle stock selection changes
   */
  const handleStocksChange = (stocks) => {
    onParametersChange({
      ...parameters,
      stocks
    });
  };

  /**
   * Handle parameters change from shared components
   * Merges changes into defaultParams
   */
  const handleParametersChange = (newParams) => {
    // Extract top-level fields vs defaultParams fields
    const { totalCapital, lotSizeUsd, maxLotsPerStock, stocks, startDate, endDate, ...defaultFields } = newParams;

    onParametersChange({
      ...parameters,
      ...(totalCapital !== undefined && { totalCapital }),
      ...(lotSizeUsd !== undefined && { lotSizeUsd }),
      ...(maxLotsPerStock !== undefined && { maxLotsPerStock }),
      ...(stocks !== undefined && { stocks }),
      ...(startDate !== undefined && { startDate }),
      ...(endDate !== undefined && { endDate }),
      defaultParams: {
        ...parameters.defaultParams,
        ...defaultFields
      }
    });
  };

  /**
   * Handle form submission
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (isValid) {
      // If beta scaling enabled, submit adjusted parameters
      const submitParams = enableBetaScaling
        ? {
            ...parameters,
            defaultParams: adjustedParameters,
            _betaScaling: {
              enabled: true,
              coefficient: betaData.coefficient
            }
          }
        : parameters;

      onSubmit(submitParams);
    }
  };

  /**
   * Reset to default values
   */
  const handleReset = () => {
    const defaults = ParameterHelper.getPortfolioDefaults();
    onParametersChange({
      ...defaults,
      startDate: parameters.startDate,  // Preserve dates
      endDate: parameters.endDate
    });
  };

  /**
   * Prepare parameters for sections
   * Merge top-level and defaultParams for consistency
   */
  const sectionParams = {
    ...parameters,
    ...parameters.defaultParams
  };

  return (
    <form className="portfolio-backtest-form" onSubmit={handleSubmit}>
      {/* Validation Errors Display */}
      {errors.length > 0 && (
        <div className="validation-errors">
          <h4>⚠️ Please fix the following errors:</h4>
          <ul>
            {errors.map((err, idx) => (
              <li key={idx}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings Display */}
      {warnings.length > 0 && (
        <div className="validation-warnings">
          <h4>⚠ Warnings:</h4>
          <ul>
            {warnings.map((warn, idx) => (
              <li key={idx}>{warn.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Stock Selection (Portfolio-Specific) */}
      <section className="backtest-section stock-selection">
        <div className="section-header">
          <h3>
            <TrendingUp size={20} />
            <span className="title">Stock Selection</span>
          </h3>
        </div>
        <StockSelector
          selectedStocks={parameters.stocks}
          onChange={handleStocksChange}
        />
        {hasError('stocks') && (
          <span className="error-message">{getError('stocks')}</span>
        )}
      </section>

      {/* Basic Parameters (Using Shared Component) */}
      <BasicParametersSection
        parameters={sectionParams}
        onParametersChange={handleParametersChange}
        mode="portfolio"
        showTotalCapital={true}
        showMaxLotsPerStock={true}
        showStrategyMode={false}
        showMaxLotsToSell={false}
        validationErrors={errors}
      />

      {/* Date Range (Using Shared Component) */}
      <DateRangeSection
        parameters={sectionParams}
        onParametersChange={handleParametersChange}
        validationErrors={errors}
      />

      {/* Beta Controls (NEW - Using Shared Component) */}
      <BetaControlsSection
        symbol={parameters.stocks}
        parameters={sectionParams}
        onParametersChange={handleParametersChange}
        mode="portfolio"
        stocks={parameters.stocks}
        enableBetaScaling={enableBetaScaling}
        onBetaScalingChange={toggleBetaScaling}
        betaData={betaData}
        onBetaDataChange={({ coefficient, beta }) => {
          if (coefficient !== undefined) updateCoefficient(coefficient);
          if (beta !== undefined) updateBeta(beta);
        }}
        loading={betaLoading}
        error={betaError}
      />

      {/* Long Strategy Parameters (Using Shared Component) */}
      <LongStrategySection
        parameters={enableBetaScaling ? adjustedParameters : sectionParams}
        onParametersChange={handleDefaultParamChange}
        betaAdjusted={enableBetaScaling}
        validationErrors={errors}
        showTrailingStops={true}
        showOrderType={false}  // Portfolio mode doesn't need order type selection yet
      />

      {/* Dynamic Features (NEW - Using Shared Component) */}
      <DynamicFeaturesSection
        parameters={sectionParams}
        onParametersChange={handleDefaultParamChange}
        validationErrors={errors}
        showBatchRanges={false}
      />

      {/* Adaptive Strategy (NEW - Using Shared Component) */}
      <AdaptiveStrategySection
        parameters={sectionParams}
        onParametersChange={handleDefaultParamChange}
        validationErrors={errors}
      />

      {/* Form Actions */}
      <div className="form-actions">
        <button type="button" onClick={handleReset} className="btn-reset" disabled={loading}>
          <RefreshCw size={18} />
          Reset to Defaults
        </button>
        <button type="submit" className="btn-submit" disabled={loading || !isValid}>
          <Play size={18} />
          {loading ? 'Running Backtest...' : 'Run Portfolio Backtest'}
        </button>
      </div>
    </form>
  );
};

export default PortfolioBacktestForm;
