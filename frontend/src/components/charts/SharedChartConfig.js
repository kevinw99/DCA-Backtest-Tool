/**
 * Shared Chart Configuration
 *
 * Configuration and utilities shared across all aligned portfolio charts
 * to ensure consistent styling, synchronization, and behavior.
 */

// Sync ID used across all charts to synchronize interactions
export const SYNC_ID = 'portfolioChartsSync';

// Common margins for charts - all charts now show x-axis
const BASE_MARGIN = {
  top: 10,
  right: 30,
  left: 60,
  bottom: 50 // All charts show x-axis now
};

/**
 * Get chart margin based on position
 * @param {boolean} isLastChart - Whether this is the last chart in the stack (no longer used)
 * @param {boolean} hasDualAxis - Whether chart has dual y-axes (adds right margin)
 */
export function getChartMargin(isLastChart = false, hasDualAxis = false) {
  return {
    ...BASE_MARGIN,
    right: hasDualAxis ? 60 : 30,
    bottom: 50 // All charts have bottom margin for x-axis
  };
}

/**
 * Common X-axis configuration
 * @param {boolean} showXAxis - Whether to display x-axis (always true now - all charts show dates)
 * @param {Array} domain - Explicit domain to ensure all charts use same range
 * @param {Array} ticks - Explicit tick marks to ensure all charts show same dates
 */
export function getXAxisConfig(showXAxis = true, domain = null, ticks = null) {
  const config = {
    dataKey: 'date',
    stroke: '#666',
    tick: { fontSize: 12 },
    tickFormatter: (value) => {
      const date = new Date(value);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    },
    hide: false, // Always show x-axis on all charts
    height: 50,
    type: 'category', // Use category type for consistent spacing
    allowDataOverflow: false, // Don't allow data outside domain
    interval: 'preserveStartEnd' // Show first and last tick, auto-space others
  };

  // Add explicit domain if provided
  if (domain && domain.length === 2) {
    config.domain = domain;
  }

  // Add explicit ticks if provided (forces all charts to use same tick marks)
  if (ticks && Array.isArray(ticks) && ticks.length > 0) {
    config.ticks = ticks;
  }

  return config;
}

/**
 * Common Y-axis configuration
 */
export const Y_AXIS_CONFIG = {
  stroke: '#666',
  tick: { fontSize: 12 }
};

/**
 * Common CartesianGrid configuration
 */
export const GRID_CONFIG = {
  strokeDasharray: '3 3',
  stroke: '#e0e0e0'
};

/**
 * Common Tooltip configuration
 */
export const TOOLTIP_CONFIG = {
  cursor: { stroke: 'rgba(0, 0, 0, 0.1)', strokeWidth: 1 },
  contentStyle: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid #ccc',
    borderRadius: '4px',
    padding: '10px'
  }
};

/**
 * Format currency values
 */
export function formatCurrency(value) {
  if (value == null) return 'N/A';

  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Format date for display
 */
export function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Format percentage values
 */
export function formatPercent(value) {
  if (value == null) return 'N/A';
  return `${value.toFixed(2)}%`;
}

/**
 * Stock color palette (consistent across all charts)
 */
export const STOCK_COLORS = [
  '#007bff', // Blue
  '#28a745', // Green
  '#dc3545', // Red
  '#ffc107', // Yellow
  '#17a2b8', // Cyan
  '#6610f2', // Purple
  '#fd7e14', // Orange
  '#20c997', // Teal
  '#e83e8c', // Pink
  '#6c757d', // Gray
  '#343a40', // Dark gray
  '#f8f9fa', // Light gray
  '#495057', // Medium gray
  '#00d4ff', // Light blue
  '#ff6b6b', // Light red
];

/**
 * Get color for a stock by index
 */
export function getStockColor(index) {
  return STOCK_COLORS[index % STOCK_COLORS.length];
}

/**
 * Transaction marker colors
 */
export const TRANSACTION_COLORS = {
  BUY: {
    fill: '#28a745',
    stroke: '#fff'
  },
  SELL: {
    fill: '#fff',
    stroke: '#007bff'
  },
  REJECTED: {
    fill: '#ffc107',
    stroke: '#ff9800'
  }
};

/**
 * Chart heights
 */
export const CHART_HEIGHTS = {
  standard: 300,
  tall: 400,
  short: 250
};

export default {
  SYNC_ID,
  getChartMargin,
  getXAxisConfig,
  Y_AXIS_CONFIG,
  GRID_CONFIG,
  TOOLTIP_CONFIG,
  formatCurrency,
  formatDate,
  formatPercent,
  STOCK_COLORS,
  getStockColor,
  TRANSACTION_COLORS,
  CHART_HEIGHTS
};
