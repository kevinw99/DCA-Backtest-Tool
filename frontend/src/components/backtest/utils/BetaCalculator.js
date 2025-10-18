/**
 * BetaCalculator - Beta scaling calculations for backtest parameters
 *
 * Handles beta-adjusted parameter calculations for both single stock and portfolio modes.
 * Integrates with backend API for beta data fetching.
 */

import backtestDefaults from '../../../config/backtestDefaults.json';

export const BetaCalculator = {
  /**
   * Apply beta scaling to a single value
   *
   * Formula: adjustedValue = baseValue × beta × coefficient
   *
   * @param {number} value - Base value
   * @param {number} beta - Stock beta value
   * @param {number} coefficient - User-selected coefficient multiplier
   * @returns {number} Beta-adjusted value
   */
  applyBetaScaling(value, beta, coefficient) {
    if (!value || !beta || !coefficient) return value;
    return value * beta * coefficient;
  },

  /**
   * Restore base value from beta-adjusted value
   *
   * Formula: baseValue = adjustedValue / (beta × coefficient)
   *
   * @param {number} adjustedValue - Beta-adjusted value
   * @param {number} beta - Stock beta value
   * @param {number} coefficient - User-selected coefficient multiplier
   * @returns {number} Base value
   */
  restoreBaseValue(adjustedValue, beta, coefficient) {
    if (!adjustedValue || !beta || !coefficient) return adjustedValue;
    return adjustedValue / (beta * coefficient);
  },

  /**
   * Get beta value for a stock from backtestDefaults.json
   *
   * @param {string} symbol - Stock symbol
   * @returns {number} Beta value (defaults to 1.0 if not found)
   */
  getStockBeta(symbol) {
    const stockDefaults = backtestDefaults[symbol];
    const globalDefaults = backtestDefaults.global;

    return (
      stockDefaults?.beta?.beta ||
      globalDefaults?.beta?.beta ||
      1.0
    );
  },

  /**
   * Calculate adjusted parameters for a single stock
   *
   * @param {Object} baseParams - Base parameter values
   * @param {string} symbol - Stock symbol
   * @param {number} coefficient - Coefficient multiplier
   * @param {number} manualBeta - Manual beta override (optional)
   * @returns {Object} Beta-adjusted parameters
   */
  calculateAdjustedParameters(baseParams, symbol, coefficient, manualBeta = null) {
    const beta = manualBeta || this.getStockBeta(symbol);
    const betaFactor = beta * coefficient;

    const adjusted = { ...baseParams };

    // Parameters to scale
    const scalableParams = [
      'gridIntervalPercent',
      'profitRequirement',
      'trailingBuyActivationPercent',
      'trailingBuyReboundPercent',
      'trailingSellActivationPercent',
      'trailingSellPullbackPercent',
      'gridConsecutiveIncrement',
      'dynamicGridMultiplier',
      // Short strategy parameters
      'trailingShortActivationPercent',
      'trailingShortPullbackPercent',
      'trailingCoverActivationPercent',
      'trailingCoverReboundPercent'
    ];

    for (const param of scalableParams) {
      if (baseParams[param] !== undefined && baseParams[param] !== null) {
        adjusted[param] = this.applyBetaScaling(baseParams[param], beta, coefficient);

        // Round to reasonable precision
        adjusted[param] = Math.round(adjusted[param] * 100) / 100;

        // Cap at reasonable max (100% for percentages)
        if (param.includes('Percent') || param.includes('Requirement') || param.includes('Interval')) {
          adjusted[param] = Math.min(adjusted[param], 100);
        }
      }
    }

    // Add beta metadata
    adjusted._betaMeta = {
      beta,
      coefficient,
      betaFactor,
      isBetaAdjusted: true
    };

    return adjusted;
  },

  /**
   * Calculate adjusted parameters for portfolio (multiple stocks)
   *
   * Each stock gets its own beta value from backtestDefaults.json
   *
   * @param {Object} baseParams - Base parameter values
   * @param {Array} symbols - Array of stock symbols
   * @param {number} coefficient - Coefficient multiplier
   * @returns {Object} Map of symbol -> adjusted parameters
   */
  calculatePortfolioBetaScaling(baseParams, symbols, coefficient) {
    const portfolioAdjusted = {};

    for (const symbol of symbols) {
      portfolioAdjusted[symbol] = this.calculateAdjustedParameters(
        baseParams,
        symbol,
        coefficient
      );
    }

    return portfolioAdjusted;
  },

  /**
   * Fetch beta data from backend API
   *
   * @param {string} symbol - Stock symbol
   * @param {Object} baseParams - Base parameters to adjust
   * @param {number} coefficient - Coefficient multiplier
   * @returns {Promise<Object>} API response with beta and adjusted parameters
   */
  async fetchBetaFromAPI(symbol, baseParams, coefficient) {
    try {
      const response = await fetch('/api/beta/calculate-adjusted-parameters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol,
          baseParameters: baseParams,
          coefficient
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to calculate adjusted parameters');
      }

      return data.data;
    } catch (error) {
      console.error('Error fetching beta from API:', error);
      throw error;
    }
  },

  /**
   * Fetch beta data with retry logic
   *
   * @param {string} symbol - Stock symbol
   * @param {Object} baseParams - Base parameters
   * @param {number} coefficient - Coefficient multiplier
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<Object>} API response
   */
  async fetchBetaWithRetry(symbol, baseParams, coefficient, maxRetries = 2) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.fetchBetaFromAPI(symbol, baseParams, coefficient);
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError;
  },

  /**
   * Calculate beta factor (beta × coefficient)
   *
   * @param {number} beta - Stock beta value
   * @param {number} coefficient - Coefficient multiplier
   * @returns {number} Beta factor
   */
  calculateBetaFactor(beta, coefficient) {
    return beta * coefficient;
  },

  /**
   * Check if parameters are beta-adjusted
   *
   * @param {Object} parameters - Parameters to check
   * @returns {boolean} True if beta-adjusted
   */
  isBetaAdjusted(parameters) {
    return parameters._betaMeta?.isBetaAdjusted === true;
  },

  /**
   * Get beta metadata from parameters
   *
   * @param {Object} parameters - Parameters with beta metadata
   * @returns {Object|null} Beta metadata or null
   */
  getBetaMeta(parameters) {
    return parameters._betaMeta || null;
  },

  /**
   * Remove beta metadata from parameters (for API submission)
   *
   * @param {Object} parameters - Parameters with beta metadata
   * @returns {Object} Parameters without beta metadata
   */
  removeBetaMeta(parameters) {
    const { _betaMeta, ...cleanParams } = parameters;
    return cleanParams;
  },

  /**
   * Validate beta value
   *
   * @param {number} beta - Beta value to validate
   * @returns {boolean} True if valid
   */
  isValidBeta(beta) {
    return typeof beta === 'number' && beta > 0 && beta < 10;
  },

  /**
   * Validate coefficient value
   *
   * @param {number} coefficient - Coefficient to validate
   * @returns {boolean} True if valid
   */
  isValidCoefficient(coefficient) {
    return typeof coefficient === 'number' && coefficient >= 0.25 && coefficient <= 3.0;
  },

  /**
   * Get recommended coefficient for a beta value
   *
   * For high beta stocks (>2.0), recommend lower coefficient to avoid extreme values
   *
   * @param {number} beta - Stock beta value
   * @returns {number} Recommended coefficient
   */
  getRecommendedCoefficient(beta) {
    if (beta > 2.5) return 0.5;
    if (beta > 2.0) return 0.75;
    if (beta > 1.5) return 1.0;
    if (beta < 0.8) return 1.5;
    return 1.0;
  },

  /**
   * Check if beta-adjusted value is extreme
   *
   * @param {number} adjustedValue - Beta-adjusted value
   * @param {number} baseValue - Base value
   * @param {number} threshold - Threshold ratio (default 2.5x)
   * @returns {boolean} True if extreme
   */
  isExtremeValue(adjustedValue, baseValue, threshold = 2.5) {
    if (!adjustedValue || !baseValue) return false;
    const ratio = adjustedValue / baseValue;
    return ratio > threshold || ratio < 1 / threshold;
  },

  /**
   * Get warning message for extreme values
   *
   * @param {string} paramName - Parameter name
   * @param {number} adjustedValue - Adjusted value
   * @param {number} baseValue - Base value
   * @returns {string} Warning message
   */
  getExtremeValueWarning(paramName, adjustedValue, baseValue) {
    const ratio = (adjustedValue / baseValue).toFixed(2);
    return `${paramName} adjusted to ${adjustedValue.toFixed(2)}% (${ratio}x base value of ${baseValue.toFixed(2)}%). This may lead to unexpected behavior.`;
  }
};

export default BetaCalculator;
