/**
 * Parameter Correlation Service
 * 
 * Handles Beta-based parameter correlation calculations for DCA trading strategies.
 * Adjusts trading parameters based on stock volatility (Beta) to provide risk-adjusted strategies.
 */

class ParameterCorrelationService {
  /**
   * Calculate Beta-adjusted parameters based on correlation formulas
   * @param {number} beta - Stock's Beta value (volatility relative to market)
   * @param {Object} baseParameters - Base parameter values to adjust
   * @returns {Object} Adjusted parameters with validation warnings
   */
  calculateBetaAdjustedParameters(beta, baseParameters = {}) {
    // Validate Beta input
    if (typeof beta !== 'number' || isNaN(beta)) {
      throw new Error('Beta must be a valid number');
    }

    if (beta < 0) {
      throw new Error('Beta cannot be negative');
    }

    // Default base multipliers (as specified in requirements)
    const baseMultipliers = {
      profitRequirementMultiplier: 0.05,
      gridIntervalMultiplier: 0.1,
      trailingBuyActivationMultiplier: 0.1,
      trailingBuyReboundMultiplier: 0.05,
      trailingSellActivationMultiplier: 0.2,
      trailingSellPullbackMultiplier: 0.1,
      ...baseParameters
    };

    // Calculate Beta-adjusted parameters using the formulas from requirements
    const adjustedParameters = {
      profitRequirement: baseMultipliers.profitRequirementMultiplier * beta,
      gridIntervalPercent: baseMultipliers.gridIntervalMultiplier * beta,
      trailingBuyActivationPercent: baseMultipliers.trailingBuyActivationMultiplier * beta,
      trailingBuyReboundPercent: baseMultipliers.trailingBuyReboundMultiplier * beta,
      trailingSellActivationPercent: baseMultipliers.trailingSellActivationMultiplier * beta,
      trailingSellPullbackPercent: baseMultipliers.trailingSellPullbackMultiplier * beta
    };

    // Validate parameter ranges and generate warnings
    const validation = this.validateParameterRanges(adjustedParameters, beta);

    return {
      beta,
      baseMultipliers,
      adjustedParameters,
      warnings: validation.warnings,
      isValid: validation.isValid
    };
  }

  /**
   * Validate that adjusted parameters are within reasonable bounds
   * @param {Object} adjustedParameters - The calculated parameters
   * @param {number} beta - The Beta value used for calculation
   * @returns {Object} Validation result with warnings
   */
  validateParameterRanges(adjustedParameters, beta) {
    const warnings = [];
    let isValid = true;

    // Check profit requirement bounds
    if (adjustedParameters.profitRequirement > 0.2) {
      warnings.push(`Profit requirement of ${(adjustedParameters.profitRequirement * 100).toFixed(1)}% exceeds 20% - consider manual override for Beta ${beta}`);
    }
    if (adjustedParameters.profitRequirement < 0.01) {
      warnings.push(`Profit requirement of ${(adjustedParameters.profitRequirement * 100).toFixed(1)}% is very low - may result in frequent small trades for Beta ${beta}`);
    }

    // Check grid interval bounds
    if (adjustedParameters.gridIntervalPercent > 0.5) {
      warnings.push(`Grid interval of ${(adjustedParameters.gridIntervalPercent * 100).toFixed(1)}% exceeds 50% - may reduce trading frequency for Beta ${beta}`);
    }
    if (adjustedParameters.gridIntervalPercent < 0.01) {
      warnings.push(`Grid interval of ${(adjustedParameters.gridIntervalPercent * 100).toFixed(1)}% is very small - may result in excessive trading for Beta ${beta}`);
    }

    // Check trailing buy parameters
    if (adjustedParameters.trailingBuyActivationPercent > 0.5) {
      warnings.push(`Trailing buy activation of ${(adjustedParameters.trailingBuyActivationPercent * 100).toFixed(1)}% is very high for Beta ${beta}`);
    }
    if (adjustedParameters.trailingBuyReboundPercent > 0.3) {
      warnings.push(`Trailing buy rebound of ${(adjustedParameters.trailingBuyReboundPercent * 100).toFixed(1)}% is very high for Beta ${beta}`);
    }

    // Check trailing sell parameters
    if (adjustedParameters.trailingSellActivationPercent > 1.0) {
      warnings.push(`Trailing sell activation of ${(adjustedParameters.trailingSellActivationPercent * 100).toFixed(1)}% exceeds 100% for Beta ${beta}`);
    }
    if (adjustedParameters.trailingSellPullbackPercent > 0.5) {
      warnings.push(`Trailing sell pullback of ${(adjustedParameters.trailingSellPullbackPercent * 100).toFixed(1)}% is very high for Beta ${beta}`);
    }

    // Check for extreme Beta values
    if (beta > 3.0) {
      warnings.push(`Beta value of ${beta} is extremely high - parameters may be too aggressive`);
    }
    if (beta < 0.1) {
      warnings.push(`Beta value of ${beta} is extremely low - parameters may be too conservative`);
    }

    // Check for parameter consistency
    if (adjustedParameters.trailingBuyReboundPercent >= adjustedParameters.trailingBuyActivationPercent) {
      warnings.push('Trailing buy rebound should be less than activation percentage');
      isValid = false;
    }
    if (adjustedParameters.trailingSellPullbackPercent >= adjustedParameters.trailingSellActivationPercent) {
      warnings.push('Trailing sell pullback should be less than activation percentage');
      isValid = false;
    }

    return { warnings, isValid };
  }

  /**
   * Generate parameter matrix for batch testing with multiple Beta values
   * @param {Array} betaValues - Array of Beta values to test
   * @param {Object} baseParameters - Base parameters to adjust
   * @returns {Array} Array of parameter combinations
   */
  generateBetaParameterMatrix(betaValues, baseParameters = {}) {
    if (!Array.isArray(betaValues) || betaValues.length === 0) {
      throw new Error('betaValues must be a non-empty array');
    }

    return betaValues.map(beta => {
      const result = this.calculateBetaAdjustedParameters(beta, baseParameters);
      return {
        beta,
        parameters: result.adjustedParameters,
        warnings: result.warnings,
        isValid: result.isValid
      };
    });
  }
}

module.exports = new ParameterCorrelationService();