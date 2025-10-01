/**
 * Unit tests for formatting utility functions
 */

import {
  formatCurrency,
  formatPercent,
  formatParameterPercent,
  formatPerformancePercent,
  formatDate,
  formatNumber,
  formatCompactNumber,
} from '../formatters';

describe('formatCurrency', () => {
  it('should format positive currency values', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
    expect(formatCurrency(0.99)).toBe('$0.99');
  });

  it('should format negative currency values', () => {
    expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
  });

  it('should format zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should handle large numbers', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });

  it('should handle null and undefined', () => {
    expect(formatCurrency(null)).toBe('N/A');
    expect(formatCurrency(undefined)).toBe('N/A');
  });

  it('should always show 2 decimal places', () => {
    expect(formatCurrency(100)).toBe('$100.00');
    expect(formatCurrency(100.1)).toBe('$100.10');
  });
});

describe('formatPercent', () => {
  it('should format positive percentages with + sign by default', () => {
    expect(formatPercent(12.34)).toBe('+12.34%');
    expect(formatPercent(0.5)).toBe('+0.50%');
  });

  it('should format negative percentages without + sign', () => {
    expect(formatPercent(-5.67)).toBe('-5.67%');
  });

  it('should format zero with + sign by default', () => {
    expect(formatPercent(0)).toBe('+0.00%');
  });

  it('should omit + sign when showSign is false', () => {
    expect(formatPercent(12.34, false)).toBe('12.34%');
    expect(formatPercent(-5.67, false)).toBe('-5.67%');
  });

  it('should handle null and undefined', () => {
    expect(formatPercent(null)).toBe('N/A');
    expect(formatPercent(undefined)).toBe('N/A');
  });

  it('should always show 2 decimal places', () => {
    expect(formatPercent(5)).toBe('+5.00%');
    expect(formatPercent(5.1)).toBe('+5.10%');
  });
});

describe('formatParameterPercent', () => {
  it('should convert decimal to percentage', () => {
    expect(formatParameterPercent(0.15)).toBe('+15.00%');
    expect(formatParameterPercent(0.05)).toBe('+5.00%');
  });

  it('should handle negative decimals', () => {
    expect(formatParameterPercent(-0.10)).toBe('-10.00%');
  });

  it('should handle zero', () => {
    expect(formatParameterPercent(0)).toBe('+0.00%');
  });

  it('should handle values greater than 1', () => {
    expect(formatParameterPercent(1.5)).toBe('+150.00%');
  });

  it('should handle null and undefined', () => {
    expect(formatParameterPercent(null)).toBe('N/A');
    expect(formatParameterPercent(undefined)).toBe('N/A');
  });
});

describe('formatPerformancePercent', () => {
  it('should format decimal values as percentages (e.g., 2.24 -> 224%)', () => {
    expect(formatPerformancePercent(2.24)).toBe('224.00%');
    expect(formatPerformancePercent(0.1234)).toBe('12.34%');
    expect(formatPerformancePercent(-0.0567)).toBe('-5.67%');
  });

  it('should handle null and undefined', () => {
    expect(formatPerformancePercent(null)).toBe('N/A');
    expect(formatPerformancePercent(undefined)).toBe('N/A');
  });

  it('should always show 2 decimal places', () => {
    expect(formatPerformancePercent(0.05)).toBe('5.00%');
    expect(formatPerformancePercent(1.0)).toBe('100.00%');
  });
});

describe('formatDate', () => {
  it('should format date in short format by default', () => {
    const result = formatDate('2025-01-15T12:00:00Z');
    expect(result).toMatch(/Jan (14|15), 25/); // Account for timezone
  });

  it('should format date in long format when specified', () => {
    const result = formatDate('2025-01-15T12:00:00Z', 'long');
    expect(result).toMatch(/January (14|15), 2025/); // Account for timezone
  });

  it('should handle Date objects', () => {
    const date = new Date(2025, 0, 15); // Month is 0-indexed
    const result = formatDate(date);
    expect(result).toMatch(/Jan 15, 25/);
  });

  it('should handle null and undefined', () => {
    expect(formatDate(null)).toBe('N/A');
    expect(formatDate(undefined)).toBe('N/A');
    expect(formatDate('')).toBe('N/A');
  });
});

describe('formatNumber', () => {
  it('should format numbers with commas and 2 decimals by default', () => {
    expect(formatNumber(1234.56)).toBe('1,234.56');
    expect(formatNumber(1000000)).toBe('1,000,000.00');
  });

  it('should respect custom decimal places', () => {
    expect(formatNumber(1234.56789, 0)).toBe('1,235');
    expect(formatNumber(1234.56789, 4)).toBe('1,234.5679');
  });

  it('should handle negative numbers', () => {
    expect(formatNumber(-1234.56)).toBe('-1,234.56');
  });

  it('should handle zero', () => {
    expect(formatNumber(0)).toBe('0.00');
  });

  it('should handle null and undefined', () => {
    expect(formatNumber(null)).toBe('N/A');
    expect(formatNumber(undefined)).toBe('N/A');
  });
});

describe('formatCompactNumber', () => {
  it('should format thousands with K suffix', () => {
    expect(formatCompactNumber(1500)).toBe('1.5K');
    expect(formatCompactNumber(15000)).toBe('15K');
  });

  it('should format millions with M suffix', () => {
    expect(formatCompactNumber(1500000)).toBe('1.5M');
    expect(formatCompactNumber(15000000)).toBe('15M');
  });

  it('should format billions with B suffix', () => {
    expect(formatCompactNumber(1500000000)).toBe('1.5B');
  });

  it('should handle small numbers without suffix', () => {
    const result = formatCompactNumber(999);
    expect(result).toBe('999');
  });

  it('should handle null and undefined', () => {
    expect(formatCompactNumber(null)).toBe('N/A');
    expect(formatCompactNumber(undefined)).toBe('N/A');
  });
});
