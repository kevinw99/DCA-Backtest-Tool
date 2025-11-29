/**
 * Enhanced PortfolioBacktestForm - With full parameter parity to single stock form
 *
 * Uses shared components from backtest/ directory to achieve 100% parameter coverage
 */

import React, { useState, useEffect } from 'react';
import { Play, RefreshCw, TrendingUp } from 'lucide-react';
import StockSelector from './StockSelector';

// Import shared components
import { BasicParametersSection } from './backtest/sections/BasicParametersSection';
import { DateRangeSection } from './backtest/sections/DateRangeSection';
import { LongStrategySection } from './backtest/sections/LongStrategySection';
import { BetaControlsSection } from './backtest/sections/BetaControlsSection';
import { DynamicFeaturesSection } from './backtest/sections/DynamicFeaturesSection';
import { AdaptiveStrategySection } from './backtest/sections/AdaptiveStrategySection';
import { CapitalOptimizationSection } from './backtest/sections/CapitalOptimizationSection';

// Import custom hooks
import { useBacktestValidation } from './backtest/hooks/useBacktestValidation';
import { useBetaScaling } from './backtest/hooks/useBetaScaling';
import { useStockBetas } from './backtest/hooks/useStockBetas';

// Import utilities
import { ParameterHelper } from './backtest/utils/ParameterHelper';

// Import styles
import './PortfolioBacktestForm.css';
import './backtest/BacktestForm.css';

const PortfolioBacktestForm = ({ parameters, onParametersChange, onSubmit, loading }) => {
  // Advanced settings expand/collapse state
  const [advancedSettingsExpanded, setAdvancedSettingsExpanded] = React.useState(false);

  // Merge parameters for validation (validator expects flat structure)
  const mergedParams = {
    ...parameters,
    ...parameters.defaultParams
  };

  // Validation hook
  const { errors, warnings, isValid, hasError, getError } = useBacktestValidation(
    mergedParams,
    'portfolio'
  );

  // Beta scaling hook - pass initial config from parameters._betaScaling
  const {
    enableBetaScaling,
    betaData,
    adjustedParameters,
    loading: betaLoading,
    error: betaError,
    toggleBetaScaling,
    updateCoefficient,
    updateBeta
  } = useBetaScaling(parameters.stocks || [], parameters.defaultParams, 'portfolio', parameters._betaScaling);

  // Fetch betas for portfolio stocks
  const portfolioBetas = useStockBetas(enableBetaScaling ? (parameters.stocks || []) : []);

  // Calculate example adjusted parameters using first stock's beta for inline display
  const getDisplayAdjustedParameters = () => {
    if (!enableBetaScaling || !parameters.stocks || parameters.stocks.length === 0 || !parameters.defaultParams) {
      return null;
    }

    const firstStock = parameters.stocks[0];
    const firstStockBeta = portfolioBetas.betaData[firstStock];

    if (!firstStockBeta) {
      return null;
    }

    const betaFactor = firstStockBeta.beta * betaData.coefficient;
    const scalableParams = [
      'gridIntervalPercent',
      'profitRequirement',
      'trailingBuyActivationPercent',
      'trailingBuyReboundPercent',
      'trailingSellActivationPercent',
      'trailingSellPullbackPercent',
      'gridConsecutiveIncrement',
      'dynamicGridMultiplier',
      'trailingShortActivationPercent',
      'trailingShortPullbackPercent',
      'trailingCoverActivationPercent',
      'trailingCoverReboundPercent'
    ];

    const exampleAdjusted = { ...parameters.defaultParams };
    scalableParams.forEach(param => {
      if (parameters.defaultParams[param] !== undefined && parameters.defaultParams[param] !== 0) {
        exampleAdjusted[param] = parameters.defaultParams[param] * betaFactor;
      }
    });

    return {
      parameters: exampleAdjusted,
      betaSymbol: firstStock,
      beta: firstStockBeta.beta,
      betaFactor: betaFactor
    };
  };

  const displayAdjustedInfo = getDisplayAdjustedParameters();

  /**
   * Sync beta scaling state with parameters._betaScaling
   */
  useEffect(() => {
    // Only update if beta scaling state has changed
    const currentBetaConfig = parameters._betaScaling || {};
    const hasChanges =
      currentBetaConfig.enabled !== enableBetaScaling ||
      currentBetaConfig.coefficient !== betaData.coefficient ||
      currentBetaConfig.beta !== betaData.beta;

    if (hasChanges) {
      onParametersChange({
        ...parameters,
        _betaScaling: {
          enabled: enableBetaScaling,
          coefficient: betaData.coefficient,
          beta: betaData.beta
        }
      });
    }
  }, [enableBetaScaling, betaData.coefficient, betaData.beta]);

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
   * Accepts either (field, value) signature OR full updated parameters object
   */
  const handleDefaultParamChange = (fieldOrParams, value) => {
    // If first argument is an object, it's the full updated parameters from shared sections
    if (typeof fieldOrParams === 'object' && fieldOrParams !== null) {
      onParametersChange({
        ...parameters,
        defaultParams: {
          ...parameters.defaultParams,
          ...fieldOrParams  // Merge all updated fields
        }
      });
    } else {
      // Legacy (field, value) signature
      onParametersChange({
        ...parameters,
        defaultParams: {
          ...parameters.defaultParams,
          [fieldOrParams]: value
        }
      });
    }
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

    // Remove top-level fields from defaultParams to prevent conflicts
    // (In case old localStorage data has them in the wrong place)
    const {
      totalCapital: _removeTC,
      lotSizeUsd: _removeLot,
      maxLotsPerStock: _removeMax,
      stocks: _removeStocks,
      startDate: _removeStart,
      endDate: _removeEnd,
      ...cleanedDefaultParams
    } = parameters.defaultParams || {};

    onParametersChange({
      ...parameters,
      ...(totalCapital !== undefined && { totalCapital }),
      ...(lotSizeUsd !== undefined && { lotSizeUsd }),
      ...(maxLotsPerStock !== undefined && { maxLotsPerStock }),
      ...(stocks !== undefined && { stocks }),
      ...(startDate !== undefined && { startDate }),
      ...(endDate !== undefined && { endDate }),
      defaultParams: {
        ...cleanedDefaultParams,
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

      {/* Spec 66: Beta Range Filter */}
      <section className="backtest-section beta-filter-section">
        <div className="section-header">
          <h3>
            <TrendingUp size={20} />
            <span className="title">Beta Range Filter (Optional)</span>
          </h3>
        </div>
        <div className="section-content">
          <p className="hint" style={{ marginBottom: '15px' }}>
            Filter portfolio stocks by beta (volatility relative to market).
            Leave blank for no filtering.
          </p>
          <div className="parameter-grid">
            <div className="parameter-input">
              <label htmlFor="minBeta">Min Beta</label>
              <input
                id="minBeta"
                type="number"
                step="0.1"
                min="0"
                value={parameters.minBeta !== undefined ? parameters.minBeta : ''}
                onChange={(e) => onParametersChange({
                  ...parameters,
                  minBeta: e.target.value === '' ? undefined : parseFloat(e.target.value)
                })}
                placeholder="e.g., 1.5"
                disabled={loading}
              />
              <span className="help-text">Include stocks with beta ≥ this value</span>
            </div>

            <div className="parameter-input">
              <label htmlFor="maxBeta">Max Beta</label>
              <input
                id="maxBeta"
                type="number"
                step="0.1"
                min="0"
                value={parameters.maxBeta !== undefined ? parameters.maxBeta : ''}
                onChange={(e) => onParametersChange({
                  ...parameters,
                  maxBeta: e.target.value === '' ? undefined : parseFloat(e.target.value)
                })}
                placeholder="e.g., 2.5"
                disabled={loading}
              />
              <span className="help-text">Include stocks with beta ≤ this value</span>
            </div>
          </div>

          {/* Validation warning for invalid range */}
          {parameters.minBeta !== undefined && parameters.maxBeta !== undefined &&
           parameters.minBeta > parameters.maxBeta && (
            <div className="error-message" style={{ marginTop: '10px' }}>
              ⚠️ Min Beta must be less than or equal to Max Beta
            </div>
          )}

          {/* Info message when filters are active */}
          {(parameters.minBeta !== undefined || parameters.maxBeta !== undefined) && (
            <div className="info-message" style={{ marginTop: '10px' }}>
              ℹ️ Active filter: {
                parameters.minBeta !== undefined && parameters.maxBeta !== undefined
                  ? `${parameters.minBeta} ≤ beta ≤ ${parameters.maxBeta}`
                  : parameters.minBeta !== undefined
                  ? `beta ≥ ${parameters.minBeta}`
                  : `beta ≤ ${parameters.maxBeta}`
              }
            </div>
          )}
        </div>
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
        baseParameters={sectionParams}
        adjustedParameters={adjustedParameters}
        loading={betaLoading}
        error={betaError}
      />

      {/* Long Strategy Parameters (Using Shared Component) */}
      <LongStrategySection
        parameters={sectionParams}  // Always pass base parameters
        onParametersChange={handleDefaultParamChange}
        betaAdjusted={false}  // Don't mark inputs as beta-adjusted (they show base values)
        validationErrors={errors}
        showTrailingStops={true}
        showOrderType={false}  // Portfolio mode doesn't need order type selection yet
        showMomentumTrading={false}  // Momentum trading is in Advanced Settings for portfolio
        displayAdjustedParameters={displayAdjustedInfo?.parameters}
        betaScalingInfo={displayAdjustedInfo ? {
          enabled: enableBetaScaling,
          betaSymbol: displayAdjustedInfo.betaSymbol,
          beta: displayAdjustedInfo.beta,
          betaFactor: displayAdjustedInfo.betaFactor,
          mode: 'portfolio'
        } : null}
      />

      {/* Capital Optimization (Using Shared Component) - Outside Advanced Settings */}
      <CapitalOptimizationSection
        totalCapital={parameters.totalCapital}
        parameters={sectionParams}
        onParametersChange={handleDefaultParamChange}
        validationErrors={errors}
      />

      {/* Advanced Settings - Collapsible Section */}
      <div className="advanced-settings-section" style={{ marginTop: '20px', marginBottom: '20px' }}>
        <button
          type="button"
          className="advanced-settings-toggle"
          onClick={() => setAdvancedSettingsExpanded(!advancedSettingsExpanded)}
          style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eaeaea'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
        >
          <span>Advanced Settings</span>
          <span style={{ transform: advancedSettingsExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
            ▼
          </span>
        </button>

        {advancedSettingsExpanded && (
          <div className="advanced-settings-content" style={{ marginTop: '15px', paddingLeft: '10px', borderLeft: '3px solid #e0e0e0' }}>
            {/* Momentum Trading Mode (Spec 45) */}
            <section className="backtest-section momentum-trading">
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Momentum Trading Mode (Spec 45)</h4>
              <div className="checkbox-group" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label htmlFor="portfolio-momentumBasedBuy" aria-label="Enable Momentum-Based Buy" style={{ display: 'flex', alignItems: 'start', cursor: 'pointer' }}>
                  <input
                    id="portfolio-momentumBasedBuy"
                    type="checkbox"
                    checked={sectionParams.momentumBasedBuy || false}
                    onChange={(e) => handleDefaultParamChange({ momentumBasedBuy: e.target.checked })}
                    style={{ marginRight: '8px', marginTop: '2px' }}
                  />
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong>Enable Momentum-Based Buy</strong>
                    <span style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      Buy on strength: 0% activation, P/L &gt; 0 required (except first buy). Overrides trailingBuyActivationPercent.
                    </span>
                  </span>
                </label>
                <label htmlFor="portfolio-momentumBasedSell" aria-label="Enable Momentum-Based Sell" style={{ display: 'flex', alignItems: 'start', cursor: 'pointer' }}>
                  <input
                    id="portfolio-momentumBasedSell"
                    type="checkbox"
                    checked={sectionParams.momentumBasedSell || false}
                    onChange={(e) => handleDefaultParamChange({ momentumBasedSell: e.target.checked })}
                    style={{ marginRight: '8px', marginTop: '2px' }}
                  />
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong>Enable Momentum-Based Sell</strong>
                    <span style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      Sell on weakness: 0% activation, fast exit on momentum reversal. Overrides trailingSellActivationPercent.
                    </span>
                  </span>
                </label>
              </div>
            </section>

            {/* Dynamic Features (Using Shared Component) */}
            <DynamicFeaturesSection
              parameters={sectionParams}
              onParametersChange={handleDefaultParamChange}
              validationErrors={errors}
              showBatchRanges={false}
            />

            {/* Adaptive Strategy (Using Shared Component) */}
            <AdaptiveStrategySection
              parameters={sectionParams}
              onParametersChange={handleDefaultParamChange}
              validationErrors={errors}
            />
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="form-actions">
        <button type="button" onClick={handleReset} className="btn-reset" disabled={loading}>
          <RefreshCw size={18} />
          Reset to Defaults
        </button>
        <button type="submit" className="btn-submit" disabled={loading || !isValid}>
          <Play size={18} />
          {loading ? 'Running Simulation...' : 'Run Portfolio Simulation'}
        </button>
      </div>
    </form>
  );
};

export default PortfolioBacktestForm;
