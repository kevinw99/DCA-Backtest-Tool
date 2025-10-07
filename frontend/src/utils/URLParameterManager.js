/**
 * URLParameterManager - Centralized URL parameter handling service
 * Handles encoding/decoding backtest parameters to/from URL query strings
 * Supports both legacy query-string format and new semantic path format with compression
 */

import LZString from 'lz-string';

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
   * Uses pushState to create a new history entry (enables back button)
   * @param {Object} parameters - Backtest parameters
   * @param {string} mode - 'single' or 'batch'
   */
  navigateToResults(parameters, mode) {
    try {
      // Use new semantic URL format with /results suffix
      const url = this.generateSemanticURL(parameters, mode, true);
      window.history.pushState({ parameters, mode, results: true }, '', url);
      console.log('🚀 Navigated to results (pushState):', url);
    } catch (error) {
      console.error('Error navigating to results:', error);
      // Fallback to legacy URL encoding
      const fallbackUrl = this.encodeParametersToURL(parameters, mode);
      window.history.pushState({ parameters, mode }, '', fallbackUrl);
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

  /**
   * Compress parameters using LZString
   * @param {Object} parameters - Parameters to compress
   * @returns {string} Base64-encoded compressed string
   */
  compressParameters(parameters) {
    try {
      const json = JSON.stringify(parameters);
      const compressed = LZString.compressToEncodedURIComponent(json);
      return compressed;
    } catch (error) {
      console.error('Error compressing parameters:', error);
      return '';
    }
  }

  /**
   * Decompress parameters from compressed string
   * @param {string} compressed - Compressed parameter string
   * @returns {Object|null} Decompressed parameters or null
   */
  decompressParameters(compressed) {
    try {
      if (!compressed) return null;
      const json = LZString.decompressFromEncodedURIComponent(compressed);
      if (!json) return null;
      return JSON.parse(json);
    } catch (error) {
      console.error('Error decompressing parameters:', error);
      return null;
    }
  }

  /**
   * Generate semantic URL with path-based routing and parameters
   * @param {Object} parameters - Backtest parameters
   * @param {string} mode - 'single' or 'batch'
   * @param {boolean} includeResults - Include /results suffix
   * @param {boolean} useCompression - Use compression for parameters (default: false for readability)
   * @returns {string} Semantic URL
   */
  generateSemanticURL(parameters, mode, includeResults = false, useCompression = false) {
    try {
      let path = '';

      if (mode === 'single') {
        const strategyMode = parameters.strategyMode || 'long';
        const symbol = parameters.symbol || '';
        if (!symbol) {
          console.warn('Cannot generate semantic URL without symbol');
          return `${this.baseURL}/`;
        }
        path = `/backtest/${strategyMode}/${symbol}`;
      } else if (mode === 'batch') {
        const symbols = parameters.symbols || parameters.parameterRanges?.symbols || [];
        if (symbols.length === 0) {
          console.warn('Cannot generate semantic URL without symbols');
          return `${this.baseURL}/`;
        }
        const symbolPath = symbols.join('+');
        path = `/batch/${symbolPath}`;
      }

      if (includeResults) {
        path += '/results';
      }

      // Prepare parameters (excluding path parameters to avoid redundancy)
      const paramsToEncode = { ...parameters };
      if (mode === 'single') {
        delete paramsToEncode.symbol;
        delete paramsToEncode.strategyMode;
      } else if (mode === 'batch') {
        delete paramsToEncode.symbols;
      }

      let url;
      if (useCompression) {
        // Use compressed format
        const compressed = this.compressParameters(paramsToEncode);
        url = `${this.baseURL}${path}?params=${compressed}`;
        console.log(`🔗 Generated semantic URL (${mode}, compressed):`, url);
        console.log(`   Original size: ${JSON.stringify(parameters).length} chars`);
        console.log(`   Compressed size: ${compressed.length} chars`);
        console.log(`   Compression ratio: ${(compressed.length / JSON.stringify(parameters).length * 100).toFixed(1)}%`);
      } else {
        // Use uncompressed query parameters for readability
        const queryParams = new URLSearchParams();

        // Add all parameters as individual query params
        for (const [key, value] of Object.entries(paramsToEncode)) {
          if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'object') {
              queryParams.set(key, JSON.stringify(value));
            } else {
              queryParams.set(key, value.toString());
            }
          }
        }

        url = `${this.baseURL}${path}?${queryParams.toString()}`;
        console.log(`🔗 Generated semantic URL (${mode}, uncompressed):`, url);
        console.log(`   URL length: ${url.length} chars`);
      }

      return url;
    } catch (error) {
      console.error('Error generating semantic URL:', error);
      return window.location.href;
    }
  }

  /**
   * Parse semantic URL path
   * @returns {Object|null} Parsed path components
   */
  parseSemanticURL() {
    try {
      const pathname = window.location.pathname;
      const urlParams = new URLSearchParams(window.location.search);

      let parameters = {};

      // Check for compressed params first
      const compressed = urlParams.get('params');
      if (compressed) {
        parameters = this.decompressParameters(compressed) || {};
        console.log('📦 Decompressed parameters from URL:', Object.keys(parameters));
      } else {
        // No compression - extract all query parameters directly
        const percentageParams = [
          'gridIntervalPercent', 'profitRequirement',
          'trailingBuyActivationPercent', 'trailingBuyReboundPercent',
          'trailingSellActivationPercent', 'trailingSellPullbackPercent',
          'trailingShortActivationPercent', 'trailingShortPullbackPercent',
          'trailingCoverActivationPercent', 'trailingCoverReboundPercent',
          'hardStopLossPercent', 'portfolioStopLossPercent', 'cascadeStopLossPercent'
        ];

        for (const [key, value] of urlParams.entries()) {
          // Try to parse JSON values (for objects/arrays)
          try {
            if (value.startsWith('{') || value.startsWith('[')) {
              const parsed = JSON.parse(value);

              // Special handling for parameterRanges - convert percentage arrays to decimals
              if (key === 'parameterRanges' && typeof parsed === 'object') {
                const percentageRangeParams = [
                  'gridIntervalPercent', 'profitRequirement',
                  'trailingBuyActivationPercent', 'trailingBuyReboundPercent',
                  'trailingSellActivationPercent', 'trailingSellPullbackPercent',
                  'trailingShortActivationPercent', 'trailingShortPullbackPercent',
                  'trailingCoverActivationPercent', 'trailingCoverReboundPercent',
                  'hardStopLossPercent', 'portfolioStopLossPercent', 'cascadeStopLossPercent'
                ];

                for (const param of percentageRangeParams) {
                  if (Array.isArray(parsed[param])) {
                    // Convert whole number percentages to decimals: [5, 10] -> [0.05, 0.10]
                    parsed[param] = parsed[param].map(v => v / 100);
                  }
                }
              }

              parameters[key] = parsed;
            } else {
              // Parse as appropriate type
              if (value === 'true') parameters[key] = true;
              else if (value === 'false') parameters[key] = false;
              else if (!isNaN(value) && value !== '') {
                parameters[key] = parseFloat(value);
              }
              else parameters[key] = value;
            }
          } catch (e) {
            parameters[key] = value;
          }
        }

        if (Object.keys(parameters).length > 0) {
          console.log('📋 Extracted uncompressed parameters from URL:', Object.keys(parameters));
        }
      }

      // Check for individual parameter overrides in URL (these override compressed params)
      const parameterOverrides = this._extractParameterOverrides(urlParams);
      if (Object.keys(parameterOverrides).length > 0) {
        console.log('🔄 Applying URL parameter overrides:', parameterOverrides);
        parameters = { ...parameters, ...parameterOverrides };
      }

      // Parse path components
      const parts = pathname.split('/').filter(p => p);

      if (parts[0] === 'backtest' && parts.length >= 3) {
        // /backtest/{strategyMode}/{symbol}[/results]
        const hasResults = parts[parts.length - 1] === 'results';
        const symbol = hasResults ? parts[2] : parts[parts.length - 1];
        const strategyMode = parts[1];

        console.log('📥 Parsed semantic URL (single):', { symbol, strategyMode, hasResults });

        return {
          mode: 'single',
          strategyMode,
          symbol,
          hasResults,
          parameters: { ...parameters, symbol, strategyMode }
        };
      } else if (parts[0] === 'batch' && parts.length >= 2) {
        // /batch/{symbols}[/results]
        const hasResults = parts[parts.length - 1] === 'results';
        const symbolsPath = hasResults ? parts[1] : parts[parts.length - 1];
        const symbols = symbolsPath.split('+').filter(s => s);

        console.log('📥 Parsed semantic URL (batch):', { symbols, hasResults });

        // Use already-converted parameters if parameterRanges was JSON-encoded
        // (conversion happens at line 280-299 above)
        let batchParams;
        if (parameters.parameterRanges) {
          // parameterRanges was already parsed and converted from JSON
          console.log('✅ Using pre-converted parameterRanges from JSON');
          batchParams = {
            mode: 'batch',
            symbols,
            ...parameters
          };
        } else {
          // Fall back to legacy comma-separated format
          console.log('📋 Decoding batch parameters from comma-separated format');
          const rawParams = {};
          for (const [key, value] of urlParams.entries()) {
            rawParams[key] = value; // Keep as string
          }
          rawParams.symbols = symbols.join(',');
          batchParams = this._decodeBatchParameters(rawParams);
        }

        return {
          mode: 'batch',
          symbols,
          hasResults,
          parameters: batchParams
        };
      }

      // Not a semantic URL
      return null;
    } catch (error) {
      console.error('Error parsing semantic URL:', error);
      return null;
    }
  }

  /**
   * Update URL in real-time (uses replaceState to avoid history pollution)
   * @param {Object} parameters - Current parameters
   * @param {string} mode - 'single' or 'batch'
   */
  updateURLRealtime(parameters, mode) {
    try {
      const url = this.generateSemanticURL(parameters, mode, false);
      window.history.replaceState({ parameters, mode }, '', url);
      console.log('🔄 URL updated (real-time):', url);
    } catch (error) {
      console.error('Error updating URL:', error);
    }
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
    // Basic parameters - prioritize parameterRanges.symbols over top-level symbols
    const symbols = parameters.parameterRanges?.symbols || parameters.symbols;
    if (symbols) {
      if (Array.isArray(symbols)) {
        params.set('symbols', symbols.join(','));
      } else {
        params.set('symbols', symbols);
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

      // Strategy parameters - parse as percentages without applying Beta scaling
      // Beta scaling will be handled by the backend when enableBetaScaling=true
      gridIntervalPercent: this._parsePercentageAsDecimal(params.gridIntervalPercent, 10),
      profitRequirement: this._parsePercentageAsDecimal(params.profitRequirement, 5),
      trailingBuyActivationPercent: this._parsePercentageAsDecimal(params.trailingBuyActivationPercent, 10),
      trailingBuyReboundPercent: this._parsePercentageAsDecimal(params.trailingBuyReboundPercent, 5),
      trailingSellActivationPercent: this._parsePercentageAsDecimal(params.trailingSellActivationPercent, 20),
      trailingSellPullbackPercent: this._parsePercentageAsDecimal(params.trailingSellPullbackPercent, 10),

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
   * Parse percentage value from URL (whole numbers to decimals)
   * URL has whole numbers (10, 12.975), backend expects decimals (0.10, 0.12975)
   * @param {string} str - URL parameter value (e.g., "12.975")
   * @param {number} defaultPercentage - Default whole number (e.g., 10 for 10%)
   * @returns {number} Decimal value for backend (e.g., 0.12975)
   */
  _parsePercentageAsDecimal(str, defaultPercentage) {
    const wholeNumber = this._parseNumber(str, defaultPercentage);
    // Convert whole number percentage to decimal: 12.975 -> 0.12975
    return wholeNumber / 100;
  }

  /**
   * Format percentage value for URL (decimals to whole numbers)
   * Backend uses decimals (0.10), URL uses whole numbers (10)
   * @param {number} decimalValue - Decimal value (e.g., 0.10 for 10%)
   * @returns {number} Whole number percentage (e.g., 10)
   */
  _formatDecimalAsPercentage(decimalValue) {
    // Convert decimal to whole number percentage: 0.10 -> 10, 0.12975 -> 12.975
    return decimalValue * 100;
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
      return urlValue * betaFactor; // Scale (no decimal conversion)
    } else {
      // URL value is closer to scaled value, already scaled
      console.log(`🔢 Using Beta-scaled value: ${urlValue}% (already scaled)`);
      return urlValue; // No conversion needed
    }
  }

  /**
   * Decode percentage array from URL (whole numbers in URL, decimals for backend)
   * Converts 5,10 -> [0.05, 0.10] for backend compatibility
   */
  _decodePercentageArray(str, defaultPercentageArray = []) {
    if (!str) return defaultPercentageArray; // Return defaults as-is
    return str.split(',').map(s => {
      const num = parseFloat(s.trim());
      if (isNaN(num)) return 0;
      // Convert whole number percentages to decimals for backend
      // 5 -> 0.05, 10 -> 0.10, etc.
      return num / 100;
    }).filter(n => n >= 0);
  }

  /**
   * Encode percentage array for URL (decimals from backend to whole numbers for URL)
   * Converts [0.05, 0.10] -> "5,10" for URL
   */
  _encodeDecimalArrayAsPercentage(decimalArray) {
    if (!Array.isArray(decimalArray)) return decimalArray?.toString() || '';
    // Convert decimals to whole number percentages for URL
    // 0.05 -> 5, 0.10 -> 10, etc.
    return decimalArray.map(d => d * 100).join(',');
  }

  /**
   * Extract individual parameter overrides from URL query string
   * Supports overriding parameters from compressed params
   * @private
   */
  _extractParameterOverrides(urlParams) {
    const overrides = {};

    // List of all supported parameter names
    const percentageParams = [
      'gridIntervalPercent', 'profitRequirement',
      'trailingBuyActivationPercent', 'trailingBuyReboundPercent',
      'trailingSellActivationPercent', 'trailingSellPullbackPercent',
      'trailingShortActivationPercent', 'trailingShortPullbackPercent',
      'trailingCoverActivationPercent', 'trailingCoverReboundPercent',
      'hardStopLossPercent', 'portfolioStopLossPercent', 'cascadeStopLossPercent',
      'gridConsecutiveIncrement'
    ];

    const numberParams = [
      'lotSizeUsd', 'maxLots', 'maxLotsToSell',
      'maxShorts', 'maxShortsToCovers',
      'beta', 'coefficient', 'dynamicGridMultiplier'
    ];

    const booleanParams = [
      'enableBetaScaling', 'isManualBetaOverride',
      'enableDynamicGrid',
      'normalizeToReference', 'enableConsecutiveIncrementalSellProfit',
      'enableConsecutiveIncrementalBuyGrid'
    ];

    const stringParams = ['symbol', 'startDate', 'endDate', 'strategyMode', 'source'];

    // Extract percentage parameters (convert from percentage to decimal)
    percentageParams.forEach(param => {
      if (urlParams.has(param) && param !== 'params') {
        const value = urlParams.get(param);
        overrides[param] = this._parsePercentageAsDecimal(value, 0);
        console.log(`  📊 Override ${param}: ${value}% → ${overrides[param]}`);
      }
    });

    // Extract number parameters
    numberParams.forEach(param => {
      if (urlParams.has(param) && param !== 'params') {
        const value = urlParams.get(param);
        overrides[param] = this._parseNumber(value, 0);
        console.log(`  🔢 Override ${param}: ${overrides[param]}`);
      }
    });

    // Extract boolean parameters
    booleanParams.forEach(param => {
      if (urlParams.has(param) && param !== 'params') {
        const value = urlParams.get(param);
        overrides[param] = this._parseBoolean(value, false);
        console.log(`  ✅ Override ${param}: ${overrides[param]}`);
      }
    });

    // Extract string parameters
    stringParams.forEach(param => {
      if (urlParams.has(param) && param !== 'params') {
        const value = urlParams.get(param);
        overrides[param] = value;
        console.log(`  📝 Override ${param}: ${overrides[param]}`);
      }
    });

    return overrides;
  }
}

// Export singleton instance
export default new URLParameterManager();