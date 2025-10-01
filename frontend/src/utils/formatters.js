/**
 * Shared formatting utilities for consistent display across components
 * Eliminates code duplication of formatter functions
 */

/**
 * Format currency values consistently across all components
 * @param {number} value - The numeric value to format
 * @returns {string} Formatted currency string (e.g., "$1,234.56")
 */
export const formatCurrency = (value) => {
  if (value === undefined || value === null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Format percentage values with optional sign
 * @param {number} value - The numeric percentage value
 * @param {boolean} showSign - Whether to show + sign for positive values (default: true)
 * @returns {string} Formatted percentage string (e.g., "+12.34%")
 */
export const formatPercent = (value, showSign = true) => {
  if (value === undefined || value === null) return 'N/A';
  const formatted = `${value.toFixed(2)}%`;
  return showSign && value >= 0 ? `+${formatted}` : formatted;
};

/**
 * Format parameter percentages (decimal to percentage)
 * Converts decimal values (e.g., 0.15) to percentage display (e.g., "15.00%")
 * @param {number} value - The decimal value to convert
 * @returns {string} Formatted percentage string
 */
export const formatParameterPercent = (value) => {
  if (value === undefined || value === null) return 'N/A';
  const percentValue = value * 100;
  return formatPercent(percentValue);
};

/**
 * Format performance percentages without sign for absolute values
 * @param {number} value - The numeric percentage value
 * @returns {string} Formatted percentage string without sign
 */
export const formatPerformancePercent = (value) => {
  if (value === undefined || value === null) return 'N/A';
  return `${value.toFixed(2)}%`;
};

/**
 * Format dates consistently
 * @param {string|Date} dateStr - The date to format
 * @param {string} format - Format type: 'short' or 'long' (default: 'short')
 * @returns {string} Formatted date string
 */
export const formatDate = (dateStr, format = 'short') => {
  if (!dateStr) return 'N/A';
  const options =
    format === 'short'
      ? { month: 'short', day: 'numeric', year: '2-digit' }
      : { month: 'long', day: 'numeric', year: 'numeric' };
  return new Date(dateStr).toLocaleDateString('en-US', options);
};

/**
 * Format numbers with commas and specific decimal places
 * @param {number} value - The number to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted number string
 */
export const formatNumber = (value, decimals = 2) => {
  if (value === undefined || value === null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Format large numbers with K, M, B suffixes
 * @param {number} value - The number to format
 * @returns {string} Formatted number with suffix (e.g., "1.2M")
 */
export const formatCompactNumber = (value) => {
  if (value === undefined || value === null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(value);
};
