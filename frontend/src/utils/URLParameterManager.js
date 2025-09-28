/**
 * URLParameterManager - Centralized URL parameter handling service
 * Handles encoding/decoding backtest parameters to/from URL query strings
 */

class URLParameterManager {
  constructor() {
    this.baseURL = window.location.origin;
  }

  /**
   * Encode current form state to URL parameters
   * @param {Object} parameters - Backtest parameters
   * @param {string} mode - 'single' or 'batch'
   * @returns {string} URL with encoded parameters
   */
  encodeParametersToURL(parameters, mode) {
    try {
      const params = new URLSearchParams();

      // Add mode parameter
      params.set('mode', mode);

      if (mode === 'single') {
        // Single backtest parameters
        this._encodeSingleParameters(params, parameters);
      } else if (mode === 'batch') {
        // Batch parameters
        this._encodeBatchParameters(params, parameters);
      }

      return `${this.baseURL}/${mode === 'batch' ? 'batch' : 'backtest'}?${params.toString()}`;
    } catch (error) {
      console.error('Error encoding parameters to URL:', error);
      return window.location.href;
    }
  }

  /**
   * Decode URL parameters to form state
   * @returns {Object|null} Decoded parameters or null if no parameters
   */
  decodeParametersFromURL() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const params = Object.fromEntries(urlParams.entries());

      if (Object.keys(params).length === 0) {
        return null;
      }

      const mode = params.mode || 'single';

      if (mode === 'single') {
        return this._decodeSingleParameters(params);
      } else if (mode === 'batch') {
        return this._decodeBatchParameters(params);
      }

      return null;
    } catch (error) {
      console.error('Error decoding parameters from URL:', error);
      return null;
    }
  }

  /**
   * Update URL without triggering navigation
   * @param {string} path - URL path
   * @param {Object} parameters - Parameters to encode
   */
  updateURL(path, parameters) {
    try {
      const url = this.encodeParametersToURL(parameters, parameters.mode);
      window.history.pushState({ parameters }, '', url);
      console.log('🌐 URL updated:', url);
    } catch (error) {
      console.error('Error updating URL:', error);
    }
  }

  /**
   * Check if current URL contains backtest parameters
   * @returns {boolean} True if URL has backtest parameters
   */
  hasBacktestParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('mode') || urlParams.has('symbol');
  }

  /**
   * Navigate to results page with parameters
   * @param {Object} parameters - Backtest parameters
   * @param {string} mode - 'single' or 'batch'
   */
  navigateToResults(parameters, mode) {
    try {
      const url = this.encodeParametersToURL(parameters, mode);
      window.history.pushState({ parameters, mode }, '', url);
      console.log('🚀 Navigated to results:', url);
    } catch (error) {
      console.error('Error navigating to results:', error);
    }
  }

  /**
   * Navigate back to parameter page
   */
  navigateToParameterPage() {
    try {
      const cleanURL = `${this.baseURL}/`;
      window.history.pushState({}, '', cleanURL);
      console.log('🏠 Navigated to parameter page:', cleanURL);
    } catch (error) {
      console.error('Error navigating to parameter page:', error);
    }
  }

  /**
   * Generate URL for sharing
   * @param {Object} parameters - Parameters to share
   * @param {string} mode - 'single' or 'batch'
   * @returns {string} Shareable URL
   */
  generateShareableURL(parameters, mode) {
    return this.encodeParametersToURL(parameters, mode);
  }

  // Private helper methods

  /**
   * Encode single backtest parameters
   * @private
   */
  _encodeSingleParameters(params, parameters) {
    // Basic parameters
    if (parameters.symbol) params.set('symbol', parameters.symbol);
    if (parameters.startDate) params.set('startDate', parameters.startDate);
    if (parameters.endDate) params.set('endDate', parameters.endDate);
    if (parameters.strategyMode) params.set('strategyMode', parameters.strategyMode);

    // Investment parameters
    if (parameters.lotSizeUsd) params.set('lotSizeUsd', parameters.lotSizeUsd.toString());
    if (parameters.maxLots) params.set('maxLots', parameters.maxLots.toString());
    if (parameters.maxLotsToSell) params.set('maxLotsToSell', parameters.maxLotsToSell.toString());

    // Strategy parameters (convert decimal to percentage for URL)
    if (parameters.gridIntervalPercent !== undefined) params.set('gridIntervalPercent', this._formatDecimalAsPercentage(parameters.gridIntervalPercent).toString());
    if (parameters.profitRequirement !== undefined) params.set('profitRequirement', this._formatDecimalAsPercentage(parameters.profitRequirement).toString());
    if (parameters.trailingBuyActivationPercent !== undefined) params.set('trailingBuyActivationPercent', this._formatDecimalAsPercentage(parameters.trailingBuyActivationPercent).toString());
    if (parameters.trailingBuyReboundPercent !== undefined) params.set('trailingBuyReboundPercent', this._formatDecimalAsPercentage(parameters.trailingBuyReboundPercent).toString());
    if (parameters.trailingSellActivationPercent !== undefined) params.set('trailingSellActivationPercent', this._formatDecimalAsPercentage(parameters.trailingSellActivationPercent).toString());
    if (parameters.trailingSellPullbackPercent !== undefined) params.set('trailingSellPullbackPercent', this._formatDecimalAsPercentage(parameters.trailingSellPullbackPercent).toString());

    // Short selling parameters
    if (parameters.maxShorts) params.set('maxShorts', parameters.maxShorts.toString());
    if (parameters.maxShortsToCovers) params.set('maxShortsToCovers', parameters.maxShortsToCovers.toString());
    if (parameters.trailingShortActivationPercent !== undefined) params.set('trailingShortActivationPercent', this._formatDecimalAsPercentage(parameters.trailingShortActivationPercent).toString());
    if (parameters.trailingShortPullbackPercent !== undefined) params.set('trailingShortPullbackPercent', this._formatDecimalAsPercentage(parameters.trailingShortPullbackPercent).toString());
    if (parameters.trailingCoverActivationPercent !== undefined) params.set('trailingCoverActivationPercent', this._formatDecimalAsPercentage(parameters.trailingCoverActivationPercent).toString());
    if (parameters.trailingCoverReboundPercent !== undefined) params.set('trailingCoverReboundPercent', this._formatDecimalAsPercentage(parameters.trailingCoverReboundPercent).toString());
    if (parameters.hardStopLossPercent !== undefined) params.set('hardStopLossPercent', this._formatDecimalAsPercentage(parameters.hardStopLossPercent).toString());
    if (parameters.portfolioStopLossPercent !== undefined) params.set('portfolioStopLossPercent', this._formatDecimalAsPercentage(parameters.portfolioStopLossPercent).toString());

    // Beta parameters
    if (parameters.beta !== undefined) params.set('beta', parameters.beta.toString());
    if (parameters.coefficient !== undefined) params.set('coefficient', parameters.coefficient.toString());
    if (parameters.enableBetaScaling !== undefined) params.set('enableBetaScaling', parameters.enableBetaScaling.toString());
    if (parameters.isManualBetaOverride !== undefined) params.set('isManualBetaOverride', parameters.isManualBetaOverride.toString());

    // Source information for debugging
    if (parameters.source) params.set('source', parameters.source);
  }

  /**
   * Encode batch parameters
   * @private
   */
  _encodeBatchParameters(params, parameters) {
    // Basic parameters
    if (parameters.symbols) {
      if (Array.isArray(parameters.symbols)) {
        params.set('symbols', parameters.symbols.join(','));
      } else {
        params.set('symbols', parameters.symbols);
      }
    }
    if (parameters.startDate) params.set('startDate', parameters.startDate);
    if (parameters.endDate) params.set('endDate', parameters.endDate);
    if (parameters.strategyMode) params.set('strategyMode', parameters.strategyMode);

    // Investment parameters
    if (parameters.lotSizeUsd) params.set('lotSizeUsd', parameters.lotSizeUsd.toString());
    if (parameters.maxLots) params.set('maxLots', parameters.maxLots.toString());
    if (parameters.maxLotsToSell) params.set('maxLotsToSell', parameters.maxLotsToSell.toString());
    if (parameters.maxShorts) params.set('maxShorts', parameters.maxShorts.toString());
    if (parameters.maxShortsToCovers) params.set('maxShortsToCovers', parameters.maxShortsToCovers.toString());

    // Parameter ranges (encode arrays as comma-separated strings, convert decimal to percentage)
    if (parameters.parameterRanges) {
      const ranges = parameters.parameterRanges;
      if (ranges.profitRequirement) params.set('profitRequirement', this._encodeDecimalArrayAsPercentage(ranges.profitRequirement));
      if (ranges.gridIntervalPercent) params.set('gridIntervalPercent', this._encodeDecimalArrayAsPercentage(ranges.gridIntervalPercent));
      if (ranges.trailingBuyActivationPercent) params.set('trailingBuyActivationPercent', this._encodeDecimalArrayAsPercentage(ranges.trailingBuyActivationPercent));
      if (ranges.trailingBuyReboundPercent) params.set('trailingBuyReboundPercent', this._encodeDecimalArrayAsPercentage(ranges.trailingBuyReboundPercent));
      if (ranges.trailingSellActivationPercent) params.set('trailingSellActivationPercent', this._encodeDecimalArrayAsPercentage(ranges.trailingSellActivationPercent));
      if (ranges.trailingSellPullbackPercent) params.set('trailingSellPullbackPercent', this._encodeDecimalArrayAsPercentage(ranges.trailingSellPullbackPercent));
      if (ranges.trailingShortActivationPercent) params.set('trailingShortActivationPercent', this._encodeDecimalArrayAsPercentage(ranges.trailingShortActivationPercent));
      if (ranges.trailingShortPullbackPercent) params.set('trailingShortPullbackPercent', this._encodeDecimalArrayAsPercentage(ranges.trailingShortPullbackPercent));
      if (ranges.trailingCoverActivationPercent) params.set('trailingCoverActivationPercent', this._encodeDecimalArrayAsPercentage(ranges.trailingCoverActivationPercent));
      if (ranges.trailingCoverReboundPercent) params.set('trailingCoverReboundPercent', this._encodeDecimalArrayAsPercentage(ranges.trailingCoverReboundPercent));
      if (ranges.hardStopLossPercent) params.set('hardStopLossPercent', this._encodeDecimalArrayAsPercentage(ranges.hardStopLossPercent));
      if (ranges.portfolioStopLossPercent) params.set('portfolioStopLossPercent', this._encodeDecimalArrayAsPercentage(ranges.portfolioStopLossPercent));
      if (ranges.coefficients) params.set('coefficients', this._encodeArray(ranges.coefficients)); // Coefficients are not percentages
    }

    // Beta parameters (check both top-level and nested in parameterRanges)
    const enableBetaScaling = parameters.enableBetaScaling ?? parameters.parameterRanges?.enableBetaScaling;
    if (enableBetaScaling !== undefined) params.set('enableBetaScaling', enableBetaScaling.toString());
  }

  /**
   * Decode single backtest parameters
   * @private
   */
  _decodeSingleParameters(params) {
    // Parse Beta parameters first to determine if scaling should be applied
    const beta = this._parseNumber(params.beta, 1.0);
    const coefficient = this._parseNumber(params.coefficient, 1.0);
    const enableBetaScaling = this._parseBoolean(params.enableBetaScaling, false);
    const betaFactor = enableBetaScaling ? beta * coefficient : 1.0;

    const decoded = {
      mode: 'single',
      // Basic parameters
      symbol: params.symbol || '',
      startDate: params.startDate || '',
      endDate: params.endDate || '',
      strategyMode: params.strategyMode || 'long',

      // Investment parameters
      lotSizeUsd: this._parseNumber(params.lotSizeUsd, 10000),
      maxLots: this._parseNumber(params.maxLots, 10),
      maxLotsToSell: this._parseNumber(params.maxLotsToSell, 1),

      // Strategy parameters - apply Beta scaling if enabled and parameters appear to be base values
      gridIntervalPercent: this._parseParameterWithBetaScaling(params.gridIntervalPercent, 10, betaFactor, enableBetaScaling),
      profitRequirement: this._parseParameterWithBetaScaling(params.profitRequirement, 5, betaFactor, enableBetaScaling),
      trailingBuyActivationPercent: this._parseParameterWithBetaScaling(params.trailingBuyActivationPercent, 10, betaFactor, enableBetaScaling),
      trailingBuyReboundPercent: this._parseParameterWithBetaScaling(params.trailingBuyReboundPercent, 5, betaFactor, enableBetaScaling),
      trailingSellActivationPercent: this._parseParameterWithBetaScaling(params.trailingSellActivationPercent, 20, betaFactor, enableBetaScaling),
      trailingSellPullbackPercent: this._parseParameterWithBetaScaling(params.trailingSellPullbackPercent, 10, betaFactor, enableBetaScaling),

      // Beta parameters
      beta: beta,
      coefficient: coefficient,
      enableBetaScaling: enableBetaScaling,
      isManualBetaOverride: this._parseBoolean(params.isManualBetaOverride, false),

      // Source information
      source: params.source || 'url'
    };

    // Short selling parameters
    if (params.strategyMode === 'short') {
      decoded.maxShorts = this._parseNumber(params.maxShorts, 10);
      decoded.maxShortsToCovers = this._parseNumber(params.maxShortsToCovers, 1);
      decoded.trailingShortActivationPercent = this._parsePercentageAsDecimal(params.trailingShortActivationPercent, 10);
      decoded.trailingShortPullbackPercent = this._parsePercentageAsDecimal(params.trailingShortPullbackPercent, 5);
      decoded.trailingCoverActivationPercent = this._parsePercentageAsDecimal(params.trailingCoverActivationPercent, 20);
      decoded.trailingCoverReboundPercent = this._parsePercentageAsDecimal(params.trailingCoverReboundPercent, 10);
      decoded.hardStopLossPercent = this._parsePercentageAsDecimal(params.hardStopLossPercent, 50);
      decoded.portfolioStopLossPercent = this._parsePercentageAsDecimal(params.portfolioStopLossPercent, 30);
    }

    return decoded;
  }

  /**
   * Decode batch parameters
   * @private
   */
  _decodeBatchParameters(params) {
    const decoded = {
      mode: 'batch',
      // Basic parameters (use defaults if missing from URL)
      symbols: params.symbols ? params.symbols.split(',').map(s => s.trim()) : ['TSLA'],
      startDate: params.startDate || '2021-09-01',
      endDate: params.endDate || '2025-09-01',
      strategyMode: params.strategyMode || 'long',

      // Investment parameters
      lotSizeUsd: this._parseNumber(params.lotSizeUsd, 10000),
      maxLots: this._parseNumber(params.maxLots, 10),
      maxLotsToSell: this._parseNumber(params.maxLotsToSell, 1),

      // Parameter ranges (convert percentage arrays to decimal for backend)
      parameterRanges: {
        profitRequirement: this._decodePercentageArray(params.profitRequirement, [3, 5, 8]),
        gridIntervalPercent: this._decodePercentageArray(params.gridIntervalPercent, [8, 10, 15]),
        trailingBuyActivationPercent: this._decodePercentageArray(params.trailingBuyActivationPercent, [10]),
        trailingBuyReboundPercent: this._decodePercentageArray(params.trailingBuyReboundPercent, [5]),
        trailingSellActivationPercent: this._decodePercentageArray(params.trailingSellActivationPercent, [20]),
        trailingSellPullbackPercent: this._decodePercentageArray(params.trailingSellPullbackPercent, [10]),
        coefficients: this._decodeArray(params.coefficients, [1.0])
      },

      // Beta parameters
      enableBetaScaling: this._parseBoolean(params.enableBetaScaling, false),

      // Source information
      source: params.source || 'url'
    };

    // Short selling parameter ranges
    if (params.strategyMode === 'short') {
      decoded.maxShorts = this._parseNumber(params.maxShorts, 10);
      decoded.maxShortsToCovers = this._parseNumber(params.maxShortsToCovers, 1);
      decoded.parameterRanges.trailingShortActivationPercent = this._decodePercentageArray(params.trailingShortActivationPercent, [10]);
      decoded.parameterRanges.trailingShortPullbackPercent = this._decodePercentageArray(params.trailingShortPullbackPercent, [5]);
      decoded.parameterRanges.trailingCoverActivationPercent = this._decodePercentageArray(params.trailingCoverActivationPercent, [20]);
      decoded.parameterRanges.trailingCoverReboundPercent = this._decodePercentageArray(params.trailingCoverReboundPercent, [10]);
      decoded.parameterRanges.hardStopLossPercent = this._decodePercentageArray(params.hardStopLossPercent, [50]);
      decoded.parameterRanges.portfolioStopLossPercent = this._decodePercentageArray(params.portfolioStopLossPercent, [30]);
    }

    return decoded;
  }

  // Utility helper methods

  _encodeArray(array) {
    if (!Array.isArray(array)) return array?.toString() || '';
    return array.join(',');
  }

  _decodeArray(str, defaultValue = []) {
    if (!str) return defaultValue;
    return str.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
  }

  _parseNumber(str, defaultValue) {
    const num = parseFloat(str);
    return isNaN(num) ? defaultValue : num;
  }

  _parseBoolean(str, defaultValue) {
    if (str === 'true') return true;
    if (str === 'false') return false;
    return defaultValue;
  }

  /**
   * Parse percentage value from URL and convert to decimal for backend
   * URL contains percentage values (e.g., 10 = 10%)
   * Backend expects decimal values (e.g., 0.1 = 10%)
   */
  _parsePercentageAsDecimal(str, defaultPercentage) {
    const percentageValue = this._parseNumber(str, defaultPercentage);
    return percentageValue / 100; // Convert percentage to decimal
  }

  /**
   * Convert decimal value to percentage for URL encoding
   * Internal decimal values (e.g., 0.1 = 10%)
   * URL stores percentage values (e.g., 10 = 10%)
   */
  _formatDecimalAsPercentage(decimalValue) {
    return decimalValue * 100; // Convert decimal to percentage
  }

  /**
   * Parse parameter value with intelligent Beta scaling detection
   * Determines if URL value is a base value needing scaling or already scaled
   * @private
   */
  _parseParameterWithBetaScaling(str, defaultPercentage, betaFactor, enableBetaScaling) {
    if (!enableBetaScaling || betaFactor === 1.0) {
      // No scaling needed, use normal percentage parsing
      return this._parsePercentageAsDecimal(str, defaultPercentage);
    }

    const urlValue = this._parseNumber(str, defaultPercentage);
    const baseValueAsPercentage = defaultPercentage;
    const scaledValueAsPercentage = baseValueAsPercentage * betaFactor;

    // Heuristic: if URL value is close to base value, it's probably a base value that needs scaling
    // if URL value is close to scaled value, it's probably already scaled
    const distanceToBase = Math.abs(urlValue - baseValueAsPercentage);
    const distanceToScaled = Math.abs(urlValue - scaledValueAsPercentage);

    if (distanceToBase < distanceToScaled) {
      // URL value is closer to base value, apply scaling
      console.log(`🔢 Applying Beta scaling: ${urlValue}% (base) → ${(urlValue * betaFactor).toFixed(2)}% (scaled) with β-factor ${betaFactor.toFixed(3)}`);
      return (urlValue * betaFactor) / 100; // Scale then convert to decimal
    } else {
      // URL value is closer to scaled value, already scaled
      console.log(`🔢 Using Beta-scaled value: ${urlValue}% (already scaled)`);
      return urlValue / 100; // Just convert to decimal
    }
  }

  /**
   * Decode percentage array from URL and convert to decimal array for backend
   */
  _decodePercentageArray(str, defaultPercentageArray = []) {
    if (!str) return defaultPercentageArray.map(p => p / 100); // Convert defaults to decimals
    return str.split(',').map(s => {
      const num = parseFloat(s.trim());
      return isNaN(num) ? 0 : (num / 100); // Convert percentage to decimal
    }).filter(n => n >= 0);
  }

  /**
   * Encode decimal array to percentage array for URL
   */
  _encodeDecimalArrayAsPercentage(decimalArray) {
    if (!Array.isArray(decimalArray)) return decimalArray?.toString() || '';
    return decimalArray.map(val => this._formatDecimalAsPercentage(val)).join(',');
  }
}

// Export singleton instance
export default new URLParameterManager();