/**
 * Frontend Percentage Utilities
 *
 * Standardizes percentage handling in the frontend.
 *
 * CONVENTION (matches backend):
 * - API requests/responses: ALWAYS use whole numbers (10 = 10%, 100 = 100%)
 * - Display: Show as-is with % symbol
 * - Form inputs: Use whole numbers directly (no conversion)
 *
 * This prevents conversion bugs. All percentages are stored as whole numbers everywhere.
 */

/**
 * @deprecated Use whole numbers directly (10 = 10%). No conversion needed.
 * Convert decimal to percentage value
 * @param {number} decimal - Decimal value (e.g., 0.05, 1.0, 2.24)
 * @returns {number} Percentage value (e.g., 5, 100, 224)
 */
export const toPercent = (decimal) => {
  if (decimal === null || decimal === undefined) return null;
  return decimal * 100;
};

/**
 * @deprecated Use whole numbers directly (10 = 10%). No conversion needed.
 * Convert percentage value to decimal
 * @param {number} percent - Percentage value (e.g., 5, 100, 224)
 * @returns {number} Decimal value (e.g., 0.05, 1.0, 2.24)
 */
export const toDecimal = (percent) => {
  if (percent === null || percent === undefined) return null;
  // DEPRECATED: Return as-is since we use whole numbers everywhere now
  return percent;
};

/**
 * Format decimal as percentage string for display
 * @param {number} decimal - Decimal value (e.g., 0.0567)
 * @param {number} decimals - Number of decimal places (default: 2)
 * @param {boolean} showSign - Whether to show + for positive values
 * @returns {string} Formatted percentage string (e.g., "5.67%")
 */
export const formatPercent = (decimal, decimals = 2, showSign = false) => {
  if (decimal === null || decimal === undefined) return 'N/A';

  const percent = toPercent(decimal);
  const formatted = percent.toFixed(decimals);

  if (showSign && percent >= 0) {
    return `+${formatted}%`;
  }

  return `${formatted}%`;
};

/**
 * Parse percentage string to decimal
 * Handles strings like "5%", "5.67%", "+10%", "-5%"
 * @param {string} percentString - Percentage string
 * @returns {number|null} Decimal value or null if invalid
 */
export const parsePercentString = (percentString) => {
  if (!percentString || typeof percentString !== 'string') return null;

  const cleaned = percentString.replace(/[+%\s]/g, '');
  const numericValue = parseFloat(cleaned);

  if (isNaN(numericValue)) return null;

  return toDecimal(numericValue);
};

/**
 * Validate that a value is in decimal format
 * @param {number} value - Value to check
 * @returns {boolean} True if value appears to be a decimal
 */
export const isDecimalFormat = (value) => {
  if (value === null || value === undefined || typeof value !== 'number') return false;
  // Values between -10 and 10 are likely decimals (not percentages)
  return Math.abs(value) <= 10;
};

/**
 * Ensure value is in decimal format
 * Auto-converts if it appears to be a percentage
 * @param {number} value - Value to normalize
 * @returns {number|null} Value in decimal format
 */
export const ensureDecimal = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number') return null;

  // If value seems to be a percentage (> 10), convert to decimal
  if (Math.abs(value) > 10) {
    return toDecimal(value);
  }

  return value;
};

/**
 * Format parameter percentage (input values that are already decimals)
 * Used for strategy parameters like gridIntervalPercent
 * @param {number} decimal - Decimal value (e.g., 0.10)
 * @returns {string} Formatted percentage with sign (e.g., "+10.00%")
 */
export const formatParameterPercent = (decimal) => {
  return formatPercent(decimal, 2, true);
};

/**
 * Format performance percentage (total return, annualized return, etc.)
 * Used for backtest results
 * @param {number} decimal - Decimal value (e.g., 2.24 for 224%)
 * @returns {string} Formatted percentage without sign (e.g., "224.00%")
 */
export const formatPerformancePercent = (decimal) => {
  return formatPercent(decimal, 2, false);
};

/**
 * Create percentage object for debugging/logging
 * @param {number} decimal - Decimal value
 * @returns {Object} Object with multiple representations
 */
export const createPercentageDebugInfo = (decimal) => {
  if (decimal === null || decimal === undefined) {
    return {
      decimal: null,
      percent: null,
      formatted: 'N/A',
      isDecimal: false
    };
  }

  return {
    decimal: decimal,
    percent: toPercent(decimal),
    formatted: formatPercent(decimal),
    isDecimal: isDecimalFormat(decimal)
  };
};

/**
 * Validate percentage value is within expected range
 * @param {number} decimal - Decimal value to validate
 * @param {number} min - Minimum decimal value (default: -10 = -1000%)
 * @param {number} max - Maximum decimal value (default: 10 = 1000%)
 * @returns {boolean} True if within range
 */
export const isValidPercentage = (decimal, min = -10, max = 10) => {
  if (decimal === null || decimal === undefined || typeof decimal !== 'number') {
    return false;
  }

  return decimal >= min && decimal <= max && !isNaN(decimal);
};
