/**
 * Beta Scaling Service
 *
 * Centralized service for applying beta-based parameter scaling to trading strategies.
 * This is the SINGLE SOURCE OF TRUTH for all beta scaling calculations.
 *
 * Key Features:
 * - Scales trading parameters based on stock volatility (beta)
 * - Integrates with BetaService for multi-tier beta resolution
 * - Supports manual beta overrides
 * - Validates configuration and scaled parameters
 * - Generates warnings for extreme values
 * - Handles all backtest modes (single, batch, portfolio)
 *
 * Formula: scaledValue = baseValue × beta × coefficient
 * Exception: Zero values remain zero (not scaled)
 */

class BetaScalingService {
  /**
   * Initialize Beta Scaling Service
   * @param {BetaService} betaService - Service for beta value resolution
   */
  constructor(betaService) {
    if (!betaService) {
      throw new Error('BetaScalingService requires a BetaService instance');
    }

    this.betaService = betaService;

    // List of all scalable parameters (12 total)
    this.SCALABLE_PARAMETERS = [
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

    // Validation ranges
    this.BETA_RANGE = { min: 0.01, max: 10.0 };
    this.COEFFICIENT_RANGE = { min: 0.25, max: 3.0 };
    this.EXTREME_BETA_FACTOR = { high: 5.0, low: 0.1 };
  }

  /**
   * Main entry point: Apply beta scaling to trading parameters
   *
   * @param {Object} baseParameters - Original trading parameters (unscaled)
   * @param {string} symbol - Stock symbol for beta resolution
   * @param {Object} config - Beta scaling configuration
   * @param {boolean} config.enableBetaScaling - Whether to apply scaling
   * @param {number} config.coefficient - Coefficient multiplier (default: 1.0)
   * @param {number} [config.beta] - Manual beta override (optional)
   * @param {boolean} [config.isManualBetaOverride] - Flag for manual override
   *
   * @returns {Promise<ScalingResult>} Scaling result with adjusted parameters and metadata
   *
   * @example
   * const result = await betaScalingService.applyBetaScaling(
   *   { gridIntervalPercent: 0.1, profitRequirement: 0.1 },
   *   'TSLA',
   *   { enableBetaScaling: true, coefficient: 1.5 }
   * );
   * // result.adjustedParameters: { gridIntervalPercent: 0.30975, profitRequirement: 0.30975 }
   * // result.betaInfo.betaFactor: 3.0975 (beta: 2.065 × coefficient: 1.5)
   */
  async applyBetaScaling(baseParameters, symbol, config = {}) {
    try {
      // Default configuration
      const {
        enableBetaScaling = false,
        coefficient = 1.0,
        beta: manualBeta = null,
        isManualBetaOverride = false
      } = config;

      // If beta scaling is disabled, return base parameters as-is
      if (!enableBetaScaling) {
        return {
          success: true,
          baseParameters,
          adjustedParameters: baseParameters,
          betaInfo: {
            beta: 1.0,
            coefficient: 1.0,
            betaFactor: 1.0,
            source: 'disabled',
            isManualOverride: false,
            symbol,
            updatedAt: null
          },
          warnings: [],
          errors: [],
          isValid: true
        };
      }

      // Validate configuration
      const configValidation = this.validateBetaConfig({ coefficient, beta: manualBeta });
      if (!configValidation.isValid) {
        return {
          success: false,
          baseParameters,
          adjustedParameters: baseParameters,
          betaInfo: null,
          warnings: configValidation.warnings,
          errors: configValidation.errors,
          isValid: false
        };
      }

      // Get beta value (either manual override or from betaService)
      const betaData = await this.getBetaForSymbol(symbol, { beta: manualBeta, isManualBetaOverride });

      // Calculate beta factor
      const betaFactor = this.calculateBetaFactor(betaData.beta, coefficient);

      // Scale all parameters
      const adjustedParameters = this.scaleAllParameters(baseParameters, betaFactor);

      // Validate scaled parameters
      const validation = this.validateScaledParameters(adjustedParameters, betaFactor);

      // Generate warnings
      const warnings = this.generateWarnings(betaFactor, adjustedParameters, coefficient);

      // Build beta info object
      const betaInfo = {
        beta: betaData.beta,
        coefficient,
        betaFactor,
        source: betaData.source,
        isManualOverride: isManualBetaOverride,
        symbol,
        updatedAt: betaData.updatedAt
      };

      return {
        success: true,
        baseParameters,
        adjustedParameters,
        betaInfo,
        warnings: [...configValidation.warnings, ...warnings, ...validation.warnings],
        errors: [],
        isValid: validation.isValid
      };

    } catch (error) {
      console.error('Error in BetaScalingService.applyBetaScaling:', error);

      // Return base parameters on error (graceful fallback)
      return {
        success: false,
        baseParameters,
        adjustedParameters: baseParameters,
        betaInfo: null,
        warnings: [],
        errors: [`Beta scaling error: ${error.message}`],
        isValid: false
      };
    }
  }

  /**
   * Calculate beta factor (beta × coefficient)
   * @param {number} beta - Stock beta value
   * @param {number} coefficient - Coefficient multiplier
   * @returns {number} Beta factor
   */
  calculateBetaFactor(beta, coefficient) {
    return beta * coefficient;
  }

  /**
   * Scale a single parameter value
   * Special rule: Zero values remain zero (not scaled)
   *
   * @param {number} value - Parameter value to scale
   * @param {number} betaFactor - Beta factor to apply
   * @returns {number} Scaled value
   */
  scaleParameter(value, betaFactor) {
    // Zero values remain zero (no scaling)
    if (value === 0 || value === null || value === undefined) {
      return 0;
    }

    return value * betaFactor;
  }

  /**
   * Scale all scalable parameters
   * @param {Object} baseParameters - Original parameters
   * @param {number} betaFactor - Beta factor to apply
   * @returns {Object} Parameters with scaled values
   */
  scaleAllParameters(baseParameters, betaFactor) {
    const adjustedParameters = { ...baseParameters };

    // Scale each scalable parameter
    this.SCALABLE_PARAMETERS.forEach(paramName => {
      if (paramName in baseParameters) {
        adjustedParameters[paramName] = this.scaleParameter(
          baseParameters[paramName],
          betaFactor
        );
      }
    });

    return adjustedParameters;
  }

  /**
   * Validate beta configuration
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result { isValid, warnings, errors }
   */
  validateBetaConfig(config) {
    const warnings = [];
    const errors = [];
    let isValid = true;

    const { coefficient, beta } = config;

    // Validate coefficient
    if (coefficient !== undefined && coefficient !== null) {
      if (typeof coefficient !== 'number' || isNaN(coefficient)) {
        errors.push('Coefficient must be a valid number');
        isValid = false;
      } else if (coefficient <= 0) {
        errors.push('Coefficient must be greater than 0');
        isValid = false;
      } else if (coefficient < this.COEFFICIENT_RANGE.min || coefficient > this.COEFFICIENT_RANGE.max) {
        warnings.push(`Coefficient ${coefficient} is outside recommended range (${this.COEFFICIENT_RANGE.min}-${this.COEFFICIENT_RANGE.max})`);
      }

      // Coefficient warnings for extreme values
      if (coefficient > 5.0) {
        warnings.push(`Coefficient ${coefficient} is extremely high (>5.0) - parameters may be overly aggressive`);
      } else if (coefficient > 3.0) {
        warnings.push(`Coefficient ${coefficient} is very high (>3.0) - review parameter bounds carefully`);
      } else if (coefficient < 0.1) {
        warnings.push(`Coefficient ${coefficient} is extremely low (<0.1) - parameters may be overly conservative`);
      }
    }

    // Validate beta (if manual override)
    if (beta !== undefined && beta !== null) {
      if (typeof beta !== 'number' || isNaN(beta)) {
        errors.push('Beta must be a valid number');
        isValid = false;
      } else if (beta < 0) {
        errors.push('Beta cannot be negative');
        isValid = false;
      } else if (beta < this.BETA_RANGE.min || beta > this.BETA_RANGE.max) {
        warnings.push(`Beta ${beta} is outside typical range (${this.BETA_RANGE.min}-${this.BETA_RANGE.max})`);
      }
    }

    return { isValid, warnings, errors };
  }

  /**
   * Get beta for a symbol
   * Uses manual override if provided, otherwise fetches from betaService
   *
   * @param {string} symbol - Stock symbol
   * @param {Object} options - Options
   * @param {number} [options.beta] - Manual beta override
   * @param {boolean} [options.isManualBetaOverride] - Manual override flag
   * @returns {Promise<Object>} Beta data { beta, source, updatedAt }
   */
  async getBetaForSymbol(symbol, options = {}) {
    const { beta: manualBeta, isManualBetaOverride } = options;

    // Use manual beta override if provided
    if (isManualBetaOverride && manualBeta !== null && manualBeta !== undefined) {
      return {
        beta: manualBeta,
        source: 'manual_override',
        updatedAt: new Date().toISOString()
      };
    }

    // Fetch beta from betaService
    try {
      const betaData = await this.betaService.getBeta(symbol);
      return {
        beta: betaData.beta,
        source: betaData.source,
        updatedAt: betaData.updatedAt
      };
    } catch (error) {
      console.warn(`Failed to fetch beta for ${symbol}, using default:`, error.message);

      // Fallback to default beta = 1.0
      return {
        beta: 1.0,
        source: 'default_fallback',
        updatedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Validate scaled parameters are within reasonable bounds
   * @param {Object} adjustedParameters - Scaled parameters
   * @param {number} betaFactor - Beta factor used
   * @returns {Object} Validation result { isValid, warnings }
   */
  validateScaledParameters(adjustedParameters, betaFactor) {
    const warnings = [];
    let isValid = true;

    // Check profit requirement bounds
    if (adjustedParameters.profitRequirement > 0.2) {
      warnings.push(`Profit requirement of ${(adjustedParameters.profitRequirement * 100).toFixed(1)}% exceeds 20% (betaFactor: ${betaFactor.toFixed(2)})`);
    }
    if (adjustedParameters.profitRequirement < 0.01 && adjustedParameters.profitRequirement > 0) {
      warnings.push(`Profit requirement of ${(adjustedParameters.profitRequirement * 100).toFixed(1)}% is very low (betaFactor: ${betaFactor.toFixed(2)})`);
    }

    // Check grid interval bounds
    if (adjustedParameters.gridIntervalPercent > 0.5) {
      warnings.push(`Grid interval of ${(adjustedParameters.gridIntervalPercent * 100).toFixed(1)}% exceeds 50% (betaFactor: ${betaFactor.toFixed(2)})`);
    }
    if (adjustedParameters.gridIntervalPercent < 0.01 && adjustedParameters.gridIntervalPercent > 0) {
      warnings.push(`Grid interval of ${(adjustedParameters.gridIntervalPercent * 100).toFixed(1)}% is very small (betaFactor: ${betaFactor.toFixed(2)})`);
    }

    // Check trailing buy parameters
    if (adjustedParameters.trailingBuyActivationPercent > 0.5) {
      warnings.push(`Trailing buy activation of ${(adjustedParameters.trailingBuyActivationPercent * 100).toFixed(1)}% is very high (betaFactor: ${betaFactor.toFixed(2)})`);
    }
    if (adjustedParameters.trailingBuyReboundPercent > 0.3) {
      warnings.push(`Trailing buy rebound of ${(adjustedParameters.trailingBuyReboundPercent * 100).toFixed(1)}% is very high (betaFactor: ${betaFactor.toFixed(2)})`);
    }

    // Check trailing sell parameters
    if (adjustedParameters.trailingSellActivationPercent > 1.0) {
      warnings.push(`Trailing sell activation of ${(adjustedParameters.trailingSellActivationPercent * 100).toFixed(1)}% exceeds 100% (betaFactor: ${betaFactor.toFixed(2)})`);
    }
    if (adjustedParameters.trailingSellPullbackPercent > 0.5) {
      warnings.push(`Trailing sell pullback of ${(adjustedParameters.trailingSellPullbackPercent * 100).toFixed(1)}% is very high (betaFactor: ${betaFactor.toFixed(2)})`);
    }

    // Check parameter consistency
    if (adjustedParameters.trailingBuyReboundPercent >= adjustedParameters.trailingBuyActivationPercent) {
      if (adjustedParameters.trailingBuyReboundPercent > 0 && adjustedParameters.trailingBuyActivationPercent > 0) {
        warnings.push('Trailing buy rebound should be less than activation percentage');
        isValid = false;
      }
    }
    if (adjustedParameters.trailingSellPullbackPercent >= adjustedParameters.trailingSellActivationPercent) {
      if (adjustedParameters.trailingSellPullbackPercent > 0 && adjustedParameters.trailingSellActivationPercent > 0) {
        warnings.push('Trailing sell pullback should be less than activation percentage');
        isValid = false;
      }
    }

    return { isValid, warnings };
  }

  /**
   * Generate warnings for extreme values
   * @param {number} betaFactor - Beta factor value
   * @param {Object} adjustedParameters - Scaled parameters
   * @param {number} coefficient - Coefficient used
   * @returns {string[]} Array of warning messages
   */
  generateWarnings(betaFactor, adjustedParameters, coefficient) {
    const warnings = [];

    // Check for extreme beta factor
    if (betaFactor > this.EXTREME_BETA_FACTOR.high) {
      warnings.push(`Beta factor of ${betaFactor.toFixed(2)} is extremely high - parameters may be too aggressive`);
    } else if (betaFactor < this.EXTREME_BETA_FACTOR.low) {
      warnings.push(`Beta factor of ${betaFactor.toFixed(2)} is extremely low - parameters may be too conservative`);
    }

    return warnings;
  }
}

module.exports = BetaScalingService;
