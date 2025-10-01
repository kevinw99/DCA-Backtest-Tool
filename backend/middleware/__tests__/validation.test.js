/**
 * Unit tests for validation middleware
 */

const {
  validateSymbol,
  validateDateRange,
  validateNumeric,
  validatePercentage,
  validateDCABacktestParams,
  validateSymbolParam
} = require('../validation');

describe('validateSymbol', () => {
  it('should accept valid stock symbols', () => {
    expect(() => validateSymbol('AAPL')).not.toThrow();
    expect(() => validateSymbol('TSLA')).not.toThrow();
    expect(() => validateSymbol('MSFT')).not.toThrow();
  });

  it('should reject empty or null symbols', () => {
    expect(() => validateSymbol('')).toThrow('must be a non-empty string');
    expect(() => validateSymbol(null)).toThrow('must be a non-empty string');
    expect(() => validateSymbol(undefined)).toThrow('must be a non-empty string');
  });

  it('should reject non-string symbols', () => {
    expect(() => validateSymbol(123)).toThrow('must be a non-empty string');
    expect(() => validateSymbol({})).toThrow('must be a non-empty string');
  });

  it('should reject symbols with invalid characters', () => {
    expect(() => validateSymbol('AAPL123')).toThrow('must contain only letters');
    expect(() => validateSymbol('AA-PL')).toThrow('must contain only letters');
  });

  it('should reject symbols exceeding max length', () => {
    expect(() => validateSymbol('TOOLONGSYMBOL')).toThrow('maximum length is 10 characters');
  });
});

describe('validateDateRange', () => {
  it('should accept valid date ranges', () => {
    expect(() => validateDateRange('2024-01-01', '2024-12-31')).not.toThrow();
    expect(() => validateDateRange('2023-01-01', '2023-06-30')).not.toThrow();
  });

  it('should reject missing dates', () => {
    expect(() => validateDateRange(null, '2024-12-31')).toThrow('both startDate and endDate are required');
    expect(() => validateDateRange('2024-01-01', null)).toThrow('both startDate and endDate are required');
  });

  it('should reject invalid date formats', () => {
    expect(() => validateDateRange('invalid', '2024-12-31')).toThrow('use ISO 8601 format');
    expect(() => validateDateRange('2024-01-01', 'invalid')).toThrow('use ISO 8601 format');
  });

  it('should reject startDate >= endDate', () => {
    expect(() => validateDateRange('2024-12-31', '2024-01-01')).toThrow('startDate must be before endDate');
    expect(() => validateDateRange('2024-06-15', '2024-06-15')).toThrow('startDate must be before endDate');
  });

  it('should reject future end dates', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    expect(() => validateDateRange('2024-01-01', futureDateStr)).toThrow('endDate cannot be in the future');
  });

  it('should reject start dates older than 5 years', () => {
    const today = new Date();
    const sixYearsAgo = new Date(today.getFullYear() - 6, today.getMonth(), today.getDate());
    const sixYearsAgoStr = sixYearsAgo.toISOString().split('T')[0];

    expect(() => validateDateRange(sixYearsAgoStr, '2024-01-01')).toThrow('cannot be older than');
  });
});

describe('validateNumeric', () => {
  it('should accept valid numbers', () => {
    expect(() => validateNumeric(100, 'test', { min: 0, max: 1000 })).not.toThrow();
    expect(() => validateNumeric(0.5, 'test', { min: 0, max: 1 })).not.toThrow();
  });

  it('should reject missing required parameters', () => {
    expect(() => validateNumeric(undefined, 'test', { required: true })).toThrow('required parameter is missing');
    expect(() => validateNumeric(null, 'test', { required: true })).toThrow('required parameter is missing');
  });

  it('should allow missing optional parameters', () => {
    expect(() => validateNumeric(undefined, 'test', { required: false })).not.toThrow();
  });

  it('should reject non-numeric values', () => {
    expect(() => validateNumeric('abc', 'test')).toThrow('must be a valid number');
    expect(() => validateNumeric({}, 'test')).toThrow('must be a valid number');
  });

  it('should enforce minimum values', () => {
    expect(() => validateNumeric(5, 'test', { min: 10 })).toThrow('must be at least 10');
  });

  it('should enforce maximum values', () => {
    expect(() => validateNumeric(100, 'test', { max: 50 })).toThrow('must be at most 50');
  });
});

describe('validatePercentage', () => {
  it('should accept valid percentages (0-1)', () => {
    expect(() => validatePercentage(0, 'test')).not.toThrow();
    expect(() => validatePercentage(0.5, 'test')).not.toThrow();
    expect(() => validatePercentage(1, 'test')).not.toThrow();
  });

  it('should reject percentages outside 0-1 range', () => {
    expect(() => validatePercentage(-0.1, 'test')).toThrow('must be at least 0');
    expect(() => validatePercentage(1.5, 'test')).toThrow('must be at most 1');
  });
});

describe('validateDCABacktestParams middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {
        symbol: 'AAPL',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        lotSizeUsd: 10000,
        maxLots: 10,
        profitRequirement: 0.05,
        gridIntervalPercent: 0.1,
        trailingBuyActivationPercent: 0.1,
        trailingBuyReboundPercent: 0.05,
        trailingSellActivationPercent: 0.2,
        trailingSellPullbackPercent: 0.1
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  it('should call next() for valid parameters', () => {
    validateDCABacktestParams(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid symbol', () => {
    req.body.symbol = '123INVALID';
    validateDCABacktestParams(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation Error',
      message: expect.stringContaining('must contain only letters')
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid date range', () => {
    req.body.startDate = '2024-12-31';
    req.body.endDate = '2024-01-01';
    validateDCABacktestParams(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation Error',
      message: expect.stringContaining('startDate must be before endDate')
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid lotSizeUsd', () => {
    req.body.lotSizeUsd = 50; // Below minimum of 100
    validateDCABacktestParams(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation Error',
      message: expect.stringContaining('must be at least 100')
    });
  });

  it('should return 400 for invalid percentage parameters', () => {
    req.body.profitRequirement = 1.5; // Above maximum of 1
    validateDCABacktestParams(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation Error',
      message: expect.stringContaining('must be at most 1')
    });
  });
});

describe('validateSymbolParam middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { params: { symbol: 'AAPL' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  it('should call next() for valid symbol param', () => {
    validateSymbolParam(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid symbol param', () => {
    req.params.symbol = '123';
    validateSymbolParam(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation Error',
      message: expect.stringContaining('must contain only letters')
    });
    expect(next).not.toHaveBeenCalled();
  });
});
