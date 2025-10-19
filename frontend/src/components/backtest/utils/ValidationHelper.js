/**
 * ValidationHelper - Centralized validation logic for backtest parameters
 *
 * Provides individual field validators, cross-field validators, and full form validation
 * for both single stock and portfolio backtest modes.
 */

export const ValidationHelper = {
  /**
   * Validate lot size (must be positive)
   */
  validateLotSize(value) {
    if (!value || value <= 0) {
      return { field: 'lotSizeUsd', message: 'Lot size must be a positive number' };
    }
    return null;
  },

  /**
   * Validate max lots (must be >= 1)
   */
  validateMaxLots(value) {
    if (!value || value < 1) {
      return { field: 'maxLots', message: 'Max lots must be at least 1' };
    }
    return null;
  },

  /**
   * Validate max lots to sell (must be >= 1 and <= max lots)
   */
  validateMaxLotsToSell(maxLotsToSell, maxLots) {
    if (!maxLotsToSell || maxLotsToSell < 1) {
      return { field: 'maxLotsToSell', message: 'Max lots to sell must be at least 1' };
    }
    if (maxLotsToSell > maxLots) {
      return { field: 'maxLotsToSell', message: 'Max lots to sell cannot exceed max lots' };
    }
    return null;
  },

  /**
   * Validate grid interval (0-100%)
   */
  validateGridInterval(value) {
    if (value === null || value === undefined) {
      return { field: 'gridIntervalPercent', message: 'Grid interval is required' };
    }
    if (value < 0 || value > 100) {
      return { field: 'gridIntervalPercent', message: 'Grid interval must be between 0 and 100%' };
    }
    return null;
  },

  /**
   * Validate profit requirement (0-100%)
   */
  validateProfitRequirement(value) {
    if (value === null || value === undefined) {
      return { field: 'profitRequirement', message: 'Profit requirement is required' };
    }
    if (value < 0 || value > 100) {
      return { field: 'profitRequirement', message: 'Profit requirement must be between 0 and 100%' };
    }
    return null;
  },

  /**
   * Validate date range (start must be before end)
   */
  validateDateRange(startDate, endDate) {
    if (!startDate) {
      return { field: 'startDate', message: 'Start date is required' };
    }
    if (!endDate) {
      return { field: 'endDate', message: 'End date is required' };
    }
    if (new Date(startDate) >= new Date(endDate)) {
      return { field: 'dateRange', message: 'Start date must be before end date' };
    }
    return null;
  },

  /**
   * Validate beta coefficient (0.25 - 3.0)
   */
  validateBetaCoefficient(value) {
    if (value === null || value === undefined) {
      return { field: 'coefficient', message: 'Beta coefficient is required' };
    }
    if (value < 0.25 || value > 3.0) {
      return { field: 'coefficient', message: 'Beta coefficient must be between 0.25 and 3.0' };
    }
    return null;
  },

  /**
   * Validate total capital (portfolio mode - must be > lot size)
   */
  validateTotalCapital(totalCapital, lotSize) {
    if (!totalCapital || totalCapital <= 0) {
      return { field: 'totalCapital', message: 'Total capital must be a positive number' };
    }
    if (lotSize && totalCapital < lotSize) {
      return { field: 'totalCapital', message: 'Total capital must be at least equal to lot size' };
    }
    return null;
  },

  /**
   * Validate trailing stop logic (activation should be > rebound/pullback for safety)
   * This is a warning, not a hard error
   */
  validateTrailingStopLogic(activation, rebound, type = 'buy') {
    if (!activation || !rebound) return null;

    if (activation <= rebound) {
      return {
        field: type === 'buy' ? 'trailingBuyLogic' : 'trailingSellLogic',
        message: `Warning: ${type === 'buy' ? 'Buy' : 'Sell'} activation (${activation}%) should typically be greater than rebound/pullback (${rebound}%) to avoid immediate triggering`,
        severity: 'warning'
      };
    }
    return null;
  },

  /**
   * Validate percentage value (0-100%)
   */
  validatePercentage(value, fieldName) {
    if (value === null || value === undefined) {
      return { field: fieldName, message: `${fieldName} is required` };
    }
    if (value < 0 || value > 100) {
      return { field: fieldName, message: `${fieldName} must be between 0 and 100%` };
    }
    return null;
  },

  /**
   * Validate stop loss percentage (0-100%)
   */
  validateStopLoss(value) {
    if (value === null || value === undefined) {
      return { field: 'stopLossPercent', message: 'Stop loss is required' };
    }
    if (value < 0 || value > 100) {
      return { field: 'stopLossPercent', message: 'Stop loss must be between 0 and 100%' };
    }
    return null;
  },

  /**
   * Validate stocks selection (portfolio mode)
   */
  validateStocks(stocks) {
    if (!stocks || stocks.length === 0) {
      return { field: 'stocks', message: 'Please select at least one stock' };
    }
    if (stocks.length > 20) {
      return { field: 'stocks', message: 'Maximum 20 stocks allowed' };
    }
    return null;
  },

  /**
   * Check for beta-adjusted extreme values (warning threshold)
   */
  checkBetaAdjustedExtremes(adjustedValue, baseValue, fieldName, threshold = 2.0) {
    if (!adjustedValue || !baseValue) return null;

    const ratio = adjustedValue / baseValue;
    if (ratio > threshold || ratio < 1 / threshold) {
      return {
        field: fieldName,
        message: `Warning: Beta-adjusted value (${adjustedValue.toFixed(2)}) differs significantly from base value (${baseValue.toFixed(2)}). Verify this is intentional.`,
        severity: 'warning'
      };
    }
    return null;
  },

  /**
   * Validate max lots per stock (portfolio mode)
   */
  validateMaxLotsPerStock(value) {
    if (!value || value < 1) {
      return { field: 'maxLotsPerStock', message: 'Max lots per stock must be at least 1' };
    }
    if (value > 100) {
      return { field: 'maxLotsPerStock', message: 'Max lots per stock cannot exceed 100' };
    }
    return null;
  },

  /**
   * Validate short strategy parameters
   */
  validateShortStrategy(parameters) {
    const errors = [];

    if (parameters.maxShorts !== undefined) {
      if (parameters.maxShorts < 1) {
        errors.push({ field: 'maxShorts', message: 'Max shorts must be at least 1' });
      }
    }

    if (parameters.maxShortsToCovers !== undefined) {
      if (parameters.maxShortsToCovers < 1) {
        errors.push({ field: 'maxShortsToCovers', message: 'Max shorts to cover must be at least 1' });
      }
      if (parameters.maxShorts && parameters.maxShortsToCovers > parameters.maxShorts) {
        errors.push({ field: 'maxShortsToCovers', message: 'Max shorts to cover cannot exceed max shorts' });
      }
    }

    return errors;
  },

  /**
   * Validate dynamic grid parameters
   */
  validateDynamicGrid(parameters) {
    const errors = [];

    if (parameters.dynamicGridMultiplier !== undefined) {
      if (parameters.dynamicGridMultiplier < 0.5 || parameters.dynamicGridMultiplier > 2.0) {
        errors.push({ field: 'dynamicGridMultiplier', message: 'Dynamic grid multiplier must be between 0.5 and 2.0' });
      }
    }

    if (parameters.gridConsecutiveIncrement !== undefined) {
      const error = this.validatePercentage(parameters.gridConsecutiveIncrement, 'gridConsecutiveIncrement');
      if (error) errors.push(error);
    }

    return errors;
  },

  /**
   * Validate adaptive strategy parameters
   */
  validateAdaptiveStrategy(parameters) {
    const errors = [];

    if (parameters.adaptationCheckIntervalDays !== undefined) {
      if (parameters.adaptationCheckIntervalDays < 1 || parameters.adaptationCheckIntervalDays > 365) {
        errors.push({ field: 'adaptationCheckIntervalDays', message: 'Check interval must be between 1 and 365 days' });
      }
    }

    if (parameters.adaptationRollingWindowDays !== undefined) {
      if (parameters.adaptationRollingWindowDays < 1 || parameters.adaptationRollingWindowDays > 365) {
        errors.push({ field: 'adaptationRollingWindowDays', message: 'Rolling window must be between 1 and 365 days' });
      }
    }

    if (parameters.confidenceThreshold !== undefined) {
      if (parameters.confidenceThreshold < 0 || parameters.confidenceThreshold > 1) {
        errors.push({ field: 'confidenceThreshold', message: 'Confidence threshold must be between 0 and 1' });
      }
    }

    return errors;
  },

  /**
   * Full form validation for backtest forms
   *
   * @param {Object} parameters - All form parameters
   * @param {string} mode - 'single' or 'portfolio'
   * @returns {Array} Array of validation error objects
   */
  validateBacktestForm(parameters, mode = 'single') {
    const errors = [];

    // Basic parameters
    const lotSizeError = this.validateLotSize(parameters.lotSizeUsd);
    if (lotSizeError) errors.push(lotSizeError);

    const maxLotsError = this.validateMaxLots(parameters.maxLots || parameters.maxLotsPerStock);
    if (maxLotsError) errors.push(maxLotsError);

    if (parameters.maxLotsToSell !== undefined) {
      const maxLotsToSellError = this.validateMaxLotsToSell(
        parameters.maxLotsToSell,
        parameters.maxLots || parameters.maxLotsPerStock
      );
      if (maxLotsToSellError) errors.push(maxLotsToSellError);
    }

    // Date range
    const dateError = this.validateDateRange(parameters.startDate, parameters.endDate);
    if (dateError) errors.push(dateError);

    // Long strategy parameters
    const gridError = this.validateGridInterval(parameters.gridIntervalPercent);
    if (gridError) errors.push(gridError);

    const profitError = this.validateProfitRequirement(parameters.profitRequirement);
    if (profitError) errors.push(profitError);

    if (parameters.stopLossPercent !== undefined) {
      const stopLossError = this.validateStopLoss(parameters.stopLossPercent);
      if (stopLossError) errors.push(stopLossError);
    }

    // Trailing stop logic warnings
    if (parameters.trailingBuyActivationPercent !== undefined && parameters.trailingBuyReboundPercent !== undefined) {
      const buyLogicWarning = this.validateTrailingStopLogic(
        parameters.trailingBuyActivationPercent,
        parameters.trailingBuyReboundPercent,
        'buy'
      );
      if (buyLogicWarning) errors.push(buyLogicWarning);
    }

    if (parameters.trailingSellActivationPercent !== undefined && parameters.trailingSellPullbackPercent !== undefined) {
      const sellLogicWarning = this.validateTrailingStopLogic(
        parameters.trailingSellActivationPercent,
        parameters.trailingSellPullbackPercent,
        'sell'
      );
      if (sellLogicWarning) errors.push(sellLogicWarning);
    }

    // Portfolio-specific validations
    if (mode === 'portfolio') {
      if (parameters.totalCapital !== undefined) {
        const capitalError = this.validateTotalCapital(parameters.totalCapital, parameters.lotSizeUsd);
        if (capitalError) errors.push(capitalError);
      }

      if (parameters.maxLotsPerStock !== undefined) {
        const maxLotsPerStockError = this.validateMaxLotsPerStock(parameters.maxLotsPerStock);
        if (maxLotsPerStockError) errors.push(maxLotsPerStockError);
      }

      if (parameters.stocks !== undefined) {
        const stocksError = this.validateStocks(parameters.stocks);
        if (stocksError) errors.push(stocksError);
      }
    }

    // Short strategy validations (if applicable)
    if (parameters.strategyMode === 'short' || parameters.maxShorts !== undefined) {
      errors.push(...this.validateShortStrategy(parameters));
    }

    // Dynamic grid validations
    if (parameters.enableDynamicGrid || parameters.dynamicGridMultiplier !== undefined) {
      errors.push(...this.validateDynamicGrid(parameters));
    }

    // Adaptive strategy validations
    if (parameters.enableAdaptiveStrategy || parameters.adaptationCheckIntervalDays !== undefined) {
      errors.push(...this.validateAdaptiveStrategy(parameters));
    }

    // Beta coefficient validation (if beta scaling enabled)
    if (parameters.enableBetaScaling && parameters.coefficient !== undefined) {
      const coefficientError = this.validateBetaCoefficient(parameters.coefficient);
      if (coefficientError) errors.push(coefficientError);
    }

    return errors;
  },

  /**
   * Check if a field has an error
   */
  hasError(errors, fieldName) {
    return errors.some(err => err.field === fieldName);
  },

  /**
   * Get error message for a specific field
   */
  getError(errors, fieldName) {
    const error = errors.find(err => err.field === fieldName);
    return error ? error.message : null;
  },

  /**
   * Filter only errors (exclude warnings)
   */
  getErrors(validationResults) {
    return validationResults.filter(result => result.severity !== 'warning');
  },

  /**
   * Filter only warnings
   */
  getWarnings(validationResults) {
    return validationResults.filter(result => result.severity === 'warning');
  }
};

export default ValidationHelper;
