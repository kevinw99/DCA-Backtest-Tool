/**
 * Tests for percentage converter utilities
 */

const {
  toPercent,
  toDecimal,
  formatAsPercent,
  parsePercent,
  isDecimal,
  ensureDecimal,
  createPercentageObject,
  convertLegacyPercentages
} = require('../percentageConverter');

describe('toPercent', () => {
  it('should convert decimals to percentages', () => {
    expect(toPercent(0.05)).toBe(5);
    expect(toPercent(1.0)).toBe(100);
    expect(toPercent(2.24)).toBeCloseTo(224, 10);
    expect(toPercent(0.0567)).toBeCloseTo(5.67, 10);
  });

  it('should handle negative values', () => {
    expect(toPercent(-0.05)).toBe(-5);
    expect(toPercent(-1.0)).toBe(-100);
  });

  it('should handle zero', () => {
    expect(toPercent(0)).toBe(0);
  });

  it('should handle null and undefined', () => {
    expect(toPercent(null)).toBe(null);
    expect(toPercent(undefined)).toBe(null);
  });
});

describe('toDecimal', () => {
  it('should convert percentages to decimals', () => {
    expect(toDecimal(5)).toBe(0.05);
    expect(toDecimal(100)).toBe(1.0);
    expect(toDecimal(224)).toBe(2.24);
    expect(toDecimal(5.67)).toBe(0.0567);
  });

  it('should handle negative values', () => {
    expect(toDecimal(-5)).toBe(-0.05);
    expect(toDecimal(-100)).toBe(-1.0);
  });

  it('should handle zero', () => {
    expect(toDecimal(0)).toBe(0);
  });

  it('should handle null and undefined', () => {
    expect(toDecimal(null)).toBe(null);
    expect(toDecimal(undefined)).toBe(null);
  });
});

describe('formatAsPercent', () => {
  it('should format decimals as percentage strings', () => {
    expect(formatAsPercent(0.0567)).toBe('5.67%');
    expect(formatAsPercent(1.0)).toBe('100.00%');
    expect(formatAsPercent(2.24)).toBe('224.00%');
  });

  it('should respect custom decimal places', () => {
    expect(formatAsPercent(0.05678, 3)).toBe('5.678%');
    expect(formatAsPercent(0.05678, 1)).toBe('5.7%');
    expect(formatAsPercent(0.05678, 0)).toBe('6%');
  });

  it('should handle negative values', () => {
    expect(formatAsPercent(-0.0567)).toBe('-5.67%');
  });

  it('should handle null and undefined', () => {
    expect(formatAsPercent(null)).toBe('N/A');
    expect(formatAsPercent(undefined)).toBe('N/A');
  });
});

describe('parsePercent', () => {
  it('should parse percentage strings to decimals', () => {
    expect(parsePercent('5%')).toBe(0.05);
    expect(parsePercent('100%')).toBe(1.0);
    expect(parsePercent('5.67%')).toBe(0.0567);
  });

  it('should handle strings with spaces', () => {
    expect(parsePercent(' 5% ')).toBe(0.05);
    expect(parsePercent('5 %')).toBe(0.05);
  });

  it('should handle negative percentages', () => {
    expect(parsePercent('-5%')).toBe(-0.05);
  });

  it('should handle invalid inputs', () => {
    expect(parsePercent('invalid')).toBe(null);
    expect(parsePercent('')).toBe(null);
    expect(parsePercent(null)).toBe(null);
    expect(parsePercent(undefined)).toBe(null);
    expect(parsePercent(123)).toBe(null); // Not a string
  });
});

describe('isDecimal', () => {
  it('should identify decimal values', () => {
    expect(isDecimal(0.05)).toBe(true);
    expect(isDecimal(1.0)).toBe(true);
    expect(isDecimal(2.24)).toBe(true);
    expect(isDecimal(-0.5)).toBe(true);
  });

  it('should identify percentage values', () => {
    expect(isDecimal(50)).toBe(false);
    expect(isDecimal(100)).toBe(false);
    expect(isDecimal(224)).toBe(false);
    expect(isDecimal(-50)).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(isDecimal(10)).toBe(true); // Boundary case
    expect(isDecimal(10.1)).toBe(false);
    expect(isDecimal(-10)).toBe(true); // Boundary case
    expect(isDecimal(-10.1)).toBe(false);
  });

  it('should handle invalid inputs', () => {
    expect(isDecimal(null)).toBe(false);
    expect(isDecimal(undefined)).toBe(false);
    expect(isDecimal('0.05')).toBe(false); // String
    expect(isDecimal({})).toBe(false); // Object
  });
});

describe('ensureDecimal', () => {
  it('should keep decimal values as-is', () => {
    expect(ensureDecimal(0.05)).toBe(0.05);
    expect(ensureDecimal(1.0)).toBe(1.0);
    expect(ensureDecimal(2.24)).toBe(2.24);
  });

  it('should convert percentage values to decimals', () => {
    expect(ensureDecimal(50)).toBe(0.5);
    expect(ensureDecimal(100)).toBe(1.0);
    expect(ensureDecimal(224)).toBe(2.24);
  });

  it('should handle negative values', () => {
    expect(ensureDecimal(-0.05)).toBe(-0.05);
    expect(ensureDecimal(-50)).toBe(-0.5);
  });

  it('should handle boundary cases', () => {
    expect(ensureDecimal(10)).toBe(10); // At boundary, keep as-is
    expect(ensureDecimal(10.1)).toBeCloseTo(0.101, 10); // Above boundary, convert
  });

  it('should handle invalid inputs', () => {
    expect(ensureDecimal(null)).toBe(null);
    expect(ensureDecimal(undefined)).toBe(null);
    expect(ensureDecimal('50')).toBe(null); // String
  });
});

describe('createPercentageObject', () => {
  it('should create percentage object with all formats', () => {
    const result = createPercentageObject(0.0567);
    expect(result).toEqual({
      decimal: 0.0567,
      percent: 5.67,
      formatted: '5.67%'
    });
  });

  it('should respect custom decimal places', () => {
    const result = createPercentageObject(0.05678, 3);
    expect(result.formatted).toBe('5.678%');
  });

  it('should handle null and undefined', () => {
    expect(createPercentageObject(null)).toEqual({
      decimal: null,
      percent: null,
      formatted: 'N/A'
    });
    expect(createPercentageObject(undefined)).toEqual({
      decimal: null,
      percent: null,
      formatted: 'N/A'
    });
  });
});

describe('convertLegacyPercentages', () => {
  it('should convert specified percentage fields to decimals', () => {
    const legacy = {
      totalReturnPercent: 224,
      winRate: 60,
      maxDrawdownPercent: 15,
      otherField: 'unchanged'
    };

    const result = convertLegacyPercentages(legacy, [
      'totalReturnPercent',
      'winRate',
      'maxDrawdownPercent'
    ]);

    expect(result).toEqual({
      totalReturnPercent: 2.24,
      winRate: 0.6,
      maxDrawdownPercent: 0.15,
      otherField: 'unchanged'
    });
  });

  it('should not modify original object', () => {
    const legacy = { totalReturnPercent: 224 };
    convertLegacyPercentages(legacy, ['totalReturnPercent']);
    expect(legacy.totalReturnPercent).toBe(224); // Original unchanged
  });

  it('should handle null and undefined values', () => {
    const legacy = {
      field1: null,
      field2: undefined,
      field3: 50
    };

    const result = convertLegacyPercentages(legacy, ['field1', 'field2', 'field3']);

    expect(result.field1).toBe(null);
    expect(result.field2).toBe(undefined);
    expect(result.field3).toBe(0.5);
  });

  it('should handle empty percent keys array', () => {
    const legacy = { totalReturnPercent: 224 };
    const result = convertLegacyPercentages(legacy, []);
    expect(result).toEqual(legacy);
  });
});

describe('round-trip conversions', () => {
  it('should maintain precision in round-trip conversions', () => {
    const original = 0.0567;
    const asPercent = toPercent(original);
    const backToDecimal = toDecimal(asPercent);
    expect(backToDecimal).toBeCloseTo(original, 10);
  });

  it('should handle multiple round trips', () => {
    let value = 2.24;
    for (let i = 0; i < 10; i++) {
      value = toPercent(value);
      value = toDecimal(value);
    }
    expect(value).toBeCloseTo(2.24, 10);
  });
});
