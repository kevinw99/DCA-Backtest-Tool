/**
 * Request Validation Middleware
 *
 * Provides validation functions for API requests to ensure data integrity
 * and prevent common errors before processing.
 */

/**
 * Validate symbol parameter
 * @param {string} symbol - Stock symbol
 * @throws {Error} If symbol is invalid
 */
function validateSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Invalid symbol: must be a non-empty string');
  }

  if (symbol.length > 10) {
    throw new Error('Invalid symbol: maximum length is 10 characters');
  }

  if (!/^[A-Z]+$/.test(symbol.toUpperCase())) {
    throw new Error('Invalid symbol: must contain only letters');
  }
}

/**
 * Validate date range
 * @param {string} startDate - Start date in ISO format
 * @param {string} endDate - End date in ISO format
 * @throws {Error} If date range is invalid
 */
function validateDateRange(startDate, endDate) {
  if (!startDate || !endDate) {
    throw new Error('Invalid date range: both startDate and endDate are required');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format: use ISO 8601 format (YYYY-MM-DD)');
  }

  if (start >= end) {
    throw new Error('Invalid date range: startDate must be before endDate');
  }

  const today = new Date();
  if (end > today) {
    throw new Error('Invalid date range: endDate cannot be in the future');
  }

  // Allow backtesting up to 30 years back (reasonable historical data limit)
  const thirtyYearsAgo = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
  if (start < thirtyYearsAgo) {
    throw new Error(`Invalid date range: startDate cannot be older than ${thirtyYearsAgo.toISOString().split('T')[0]} (30 years limit)`);
  }
}

/**
 * Validate numeric parameter
 * @param {any} value - Value to validate
 * @param {string} name - Parameter name
 * @param {Object} options - Validation options
 * @param {number} options.min - Minimum value (inclusive)
 * @param {number} options.max - Maximum value (inclusive)
 * @param {boolean} options.required - Whether parameter is required
 * @throws {Error} If value is invalid
 */
function validateNumeric(value, name, options = {}) {
  const { min, max, required = true } = options;

  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`Invalid ${name}: required parameter is missing`);
    }
    return; // Optional parameter not provided
  }

  const num = Number(value);

  if (isNaN(num)) {
    throw new Error(`Invalid ${name}: must be a valid number`);
  }

  if (min !== undefined && num < min) {
    throw new Error(`Invalid ${name}: must be at least ${min}`);
  }

  if (max !== undefined && num > max) {
    throw new Error(`Invalid ${name}: must be at most ${max}`);
  }
}

/**
 * Validate percentage parameter (0-100 range as whole numbers)
 * @param {any} value - Value to validate
 * @param {string} name - Parameter name
 * @param {boolean} required - Whether parameter is required
 * @throws {Error} If value is invalid
 */
function validatePercentage(value, name, required = true) {
  validateNumeric(value, name, { min: 0, max: 100, required });
}

/**
 * Validate DCA backtest parameters
 */
function validateDCABacktestParams(req, res, next) {
  try {
    const {
      symbol,
      startDate,
      endDate,
      lotSizeUsd,
      maxLots,
      profitRequirement,
      gridIntervalPercent,
      gridConsecutiveIncrement,
      enableConsecutiveIncrementalBuyGrid,
      trailingBuyActivationPercent,
      trailingBuyReboundPercent,
      trailingSellActivationPercent,
      trailingSellPullbackPercent
    } = req.body;

    console.log('🔍 Validating DCA Parameters:');
    console.log(`   symbol: ${symbol}`);
    console.log(`   startDate: ${startDate}, endDate: ${endDate}`);
    console.log(`   lotSizeUsd: ${lotSizeUsd}, maxLots: ${maxLots}`);
    console.log(`   profitRequirement: ${profitRequirement}`);
    console.log(`   gridIntervalPercent: ${gridIntervalPercent}`);
    console.log(`   trailingBuyActivationPercent: ${trailingBuyActivationPercent}`);
    console.log(`   trailingBuyReboundPercent: ${trailingBuyReboundPercent}`);
    console.log(`   trailingSellActivationPercent: ${trailingSellActivationPercent}`);
    console.log(`   trailingSellPullbackPercent: ${trailingSellPullbackPercent}`);

    // Validate required parameters
    validateSymbol(symbol);
    validateDateRange(startDate, endDate);
    validateNumeric(lotSizeUsd, 'lotSizeUsd', { min: 100, max: 1000000 });
    validateNumeric(maxLots, 'maxLots', { min: 1, max: 100 });

    // Validate strategy parameters
    validatePercentage(profitRequirement, 'profitRequirement');
    validatePercentage(gridIntervalPercent, 'gridIntervalPercent');
    validatePercentage(trailingBuyActivationPercent, 'trailingBuyActivationPercent');
    validatePercentage(trailingBuyReboundPercent, 'trailingBuyReboundPercent');
    validatePercentage(trailingSellActivationPercent, 'trailingSellActivationPercent');
    validatePercentage(trailingSellPullbackPercent, 'trailingSellPullbackPercent');

    // Validate consecutive incremental buy grid parameters (optional)
    if (gridConsecutiveIncrement !== undefined) {
      validatePercentage(gridConsecutiveIncrement, 'gridConsecutiveIncrement', false);
    }
    if (enableConsecutiveIncrementalBuyGrid !== undefined && typeof enableConsecutiveIncrementalBuyGrid !== 'boolean') {
      throw new Error('enableConsecutiveIncrementalBuyGrid must be boolean');
    }

    // Validate directional strategy control flags (optional, Spec 27)
    const { enableAdaptiveTrailingBuy, enableAdaptiveTrailingSell } = req.body;
    if (enableAdaptiveTrailingBuy !== undefined && typeof enableAdaptiveTrailingBuy !== 'boolean') {
      throw new Error('enableAdaptiveTrailingBuy must be boolean');
    }
    if (enableAdaptiveTrailingSell !== undefined && typeof enableAdaptiveTrailingSell !== 'boolean') {
      throw new Error('enableAdaptiveTrailingSell must be boolean');
    }

    console.log('✅ Validation passed');
    next();
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    res.status(400).json({
      error: 'Validation Error',
      message: error.message
    });
  }
}

/**
 * Validate Short DCA backtest parameters
 */
function validateShortDCABacktestParams(req, res, next) {
  try {
    const {
      symbol,
      startDate,
      endDate,
      lotSizeUsd,
      maxShorts,
      profitRequirement,
      gridIntervalPercent,
      trailingShortActivationPercent,
      trailingShortPullbackPercent,
      trailingCoverActivationPercent,
      trailingCoverReboundPercent
    } = req.body;

    // Validate required parameters
    validateSymbol(symbol);
    validateDateRange(startDate, endDate);
    validateNumeric(lotSizeUsd, 'lotSizeUsd', { min: 100, max: 1000000 });
    validateNumeric(maxShorts, 'maxShorts', { min: 1, max: 100 });

    // Validate strategy parameters
    validatePercentage(profitRequirement, 'profitRequirement');
    validatePercentage(gridIntervalPercent, 'gridIntervalPercent');
    validatePercentage(trailingShortActivationPercent, 'trailingShortActivationPercent');
    validatePercentage(trailingShortPullbackPercent, 'trailingShortPullbackPercent');
    validatePercentage(trailingCoverActivationPercent, 'trailingCoverActivationPercent');
    validatePercentage(trailingCoverReboundPercent, 'trailingCoverReboundPercent');

    next();
  } catch (error) {
    res.status(400).json({
      error: 'Validation Error',
      message: error.message
    });
  }
}

/**
 * Validate batch backtest parameters
 * Accepts symbols either at top level OR inside parameterRanges
 */
function validateBatchBacktestParams(req, res, next) {
  try {
    const { symbols: topLevelSymbols, parameterRanges } = req.body;

    // Validate parameter ranges exist
    if (!parameterRanges || typeof parameterRanges !== 'object') {
      throw new Error('Invalid parameterRanges: must be an object');
    }

    // Accept symbols from either top level or inside parameterRanges
    const symbols = topLevelSymbols || parameterRanges.symbols;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      throw new Error('Invalid symbols: must be a non-empty array (either at top level or inside parameterRanges)');
    }

    symbols.forEach(symbol => validateSymbol(symbol));

    // Validate date range if provided
    if (parameterRanges.startDate && parameterRanges.endDate) {
      validateDateRange(parameterRanges.startDate, parameterRanges.endDate);
    }

    next();
  } catch (error) {
    res.status(400).json({
      error: 'Validation Error',
      message: error.message
    });
  }
}

/**
 * Validate symbol parameter middleware
 */
function validateSymbolParam(req, res, next) {
  try {
    const { symbol } = req.params;
    validateSymbol(symbol);
    next();
  } catch (error) {
    res.status(400).json({
      error: 'Validation Error',
      message: error.message
    });
  }
}

/**
 * Validate query date range middleware
 */
function validateQueryDateRange(req, res, next) {
  try {
    const { startDate, endDate } = req.query;

    // Only validate if both dates are provided
    if (startDate && endDate) {
      validateDateRange(startDate, endDate);
    }

    next();
  } catch (error) {
    res.status(400).json({
      error: 'Validation Error',
      message: error.message
    });
  }
}

module.exports = {
  // Utility functions
  validateSymbol,
  validateDateRange,
  validateNumeric,
  validatePercentage,

  // Middleware functions
  validateDCABacktestParams,
  validateShortDCABacktestParams,
  validateBatchBacktestParams,
  validateSymbolParam,
  validateQueryDateRange
};
