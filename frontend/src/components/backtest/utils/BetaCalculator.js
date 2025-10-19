/**
 * BetaCalculator - Beta scaling utilities for UI display and validation
 *
 * NOTE (Spec 43): All beta scaling CALCULATIONS are now handled by the backend
 * BetaScalingService. This file only contains UI helpers and validation functions.
 *
 * Backend handles:
 * - Beta value fetching (BetaService)
 * - Parameter scaling calculations (BetaScalingService)
 * - Configuration validation (BetaScalingService)
 *
 * Frontend keeps:
 * - Display helpers (getStockBeta for UI hints)
 * - Validation functions (isValidBeta, isValidCoefficient)
 * - Recommended values (getRecommendedCoefficient)
 * - Beta factor display calculation (calculateBetaFactor)
 */

import backtestDefaults from '../../../config/backtestDefaults.json';

export const BetaCalculator = {
  /**
   * Get beta value for a stock from backtestDefaults.json
   * Used for UI display/hints only - backend fetches actual beta for calculations
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
   * Calculate beta factor (beta × coefficient)
   * Used for UI display only - not for actual parameter scaling
   *
   * @param {number} beta - Stock beta value
   * @param {number} coefficient - Coefficient multiplier
   * @returns {number} Beta factor
   */
  calculateBetaFactor(beta, coefficient) {
    return beta * coefficient;
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
   * Fetch beta data from backend API
   * Backend API now uses BetaScalingService for all calculations
   *
   * @param {string} symbol - Stock symbol
   * @param {Object} baseParams - Base parameters to adjust
   * @param {number} coefficient - Coefficient multiplier
   * @returns {Promise<Object>} API response with beta and adjusted parameters
   */
  async fetchBetaFromAPI(symbol, baseParams, coefficient) {
    try {
      const response = await fetch('/api/backtest/beta-parameters', {
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
