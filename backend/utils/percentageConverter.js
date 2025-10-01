/**
 * Percentage Converter Utilities
 *
 * Standardizes percentage/decimal conversions across the application.
 *
 * CONVENTION:
 * - Internal calculations: ALWAYS use decimals (0.05 = 5%, 1.0 = 100%)
 * - API responses: ALWAYS use decimals for consistency
 * - Display/logging: Convert to percentage for readability
 *
 * This prevents the common bug where percentages get divided by 100 twice
 * or multiplied by 100 twice.
 */

/**
 * Convert decimal to percentage value
 * @param {number} decimal - Decimal value (e.g., 0.05, 1.0, 2.24)
 * @returns {number} Percentage value (e.g., 5, 100, 224)
 * @example
 * toPercent(0.05)  // Returns 5
 * toPercent(1.0)   // Returns 100
 * toPercent(2.24)  // Returns 224
 */
function toPercent(decimal) {
  if (decimal === null || decimal === undefined) return null;
  return decimal * 100;
}

/**
 * Convert percentage value to decimal
 * @param {number} percent - Percentage value (e.g., 5, 100, 224)
 * @returns {number} Decimal value (e.g., 0.05, 1.0, 2.24)
 * @example
 * toDecimal(5)    // Returns 0.05
 * toDecimal(100)  // Returns 1.0
 * toDecimal(224)  // Returns 2.24
 */
function toDecimal(percent) {
  if (percent === null || percent === undefined) return null;
  return percent / 100;
}

/**
 * Format decimal as percentage string for display
 * @param {number} decimal - Decimal value (e.g., 0.0567)
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted percentage string (e.g., "5.67%")
 * @example
 * formatAsPercent(0.0567)     // Returns "5.67%"
 * formatAsPercent(0.0567, 1)  // Returns "5.7%"
 * formatAsPercent(1.0)        // Returns "100.00%"
 */
function formatAsPercent(decimal, decimals = 2) {
  if (decimal === null || decimal === undefined) return 'N/A';
  const percent = toPercent(decimal);
  return `${percent.toFixed(decimals)}%`;
}

/**
 * Parse percentage string to decimal
 * Handles strings like "5%", "5.67%", "100%"
 * @param {string} percentString - Percentage string (e.g., "5%", "100%")
 * @returns {number} Decimal value (e.g., 0.05, 1.0)
 * @example
 * parsePercent("5%")     // Returns 0.05
 * parsePercent("5.67%")  // Returns 0.0567
 * parsePercent("100%")   // Returns 1.0
 */
function parsePercent(percentString) {
  if (!percentString || typeof percentString !== 'string') return null;
  const numericValue = parseFloat(percentString.replace('%', '').trim());
  if (isNaN(numericValue)) return null;
  return toDecimal(numericValue);
}

/**
 * Validate that a value is in decimal format (0-1 range typical)
 * @param {number} value - Value to check
 * @returns {boolean} True if value appears to be a decimal
 * @example
 * isDecimal(0.05)   // Returns true
 * isDecimal(5)      // Returns false (likely a percentage)
 * isDecimal(1.5)    // Returns true (150% is valid)
 */
function isDecimal(value) {
  if (value === null || value === undefined || typeof value !== 'number') return false;
  // If value is between -10 and 10, it's likely a decimal representation
  // (percentages would be -1000 to 1000 for the same range)
  return Math.abs(value) <= 10;
}

/**
 * Ensure value is in decimal format
 * Auto-converts if it appears to be a percentage
 * @param {number} value - Value to normalize
 * @returns {number} Value in decimal format
 * @example
 * ensureDecimal(0.05)   // Returns 0.05
 * ensureDecimal(5)      // Returns 0.05 (assumes it was a percentage)
 * ensureDecimal(100)    // Returns 1.0 (assumes it was a percentage)
 */
function ensureDecimal(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number') return null;

  // If value seems to be a percentage (> 10), convert to decimal
  if (Math.abs(value) > 10) {
    return toDecimal(value);
  }

  return value;
}

/**
 * Create a standardized percentage object for API responses
 * @param {number} decimal - Decimal value
 * @returns {Object} Object with both decimal and percentage values
 * @example
 * createPercentageObject(0.0567)
 * // Returns { decimal: 0.0567, percent: 5.67, formatted: "5.67%" }
 */
function createPercentageObject(decimal, decimals = 2) {
  if (decimal === null || decimal === undefined) {
    return { decimal: null, percent: null, formatted: 'N/A' };
  }

  return {
    decimal: decimal,
    percent: toPercent(decimal),
    formatted: formatAsPercent(decimal, decimals)
  };
}

/**
 * Convert legacy percentage-based response to decimal-based
 * Useful for migrating old API responses
 * @param {Object} data - Object with percentage values
 * @param {Array<string>} percentKeys - Keys that contain percentage values
 * @returns {Object} Object with converted decimal values
 * @example
 * const legacy = { totalReturnPercent: 224, winRate: 60 };
 * convertLegacyPercentages(legacy, ['totalReturnPercent', 'winRate'])
 * // Returns { totalReturnPercent: 2.24, winRate: 0.6 }
 */
function convertLegacyPercentages(data, percentKeys) {
  const converted = { ...data };

  percentKeys.forEach(key => {
    if (converted[key] !== null && converted[key] !== undefined) {
      converted[key] = toDecimal(converted[key]);
    }
  });

  return converted;
}

module.exports = {
  toPercent,
  toDecimal,
  formatAsPercent,
  parsePercent,
  isDecimal,
  ensureDecimal,
  createPercentageObject,
  convertLegacyPercentages
};
