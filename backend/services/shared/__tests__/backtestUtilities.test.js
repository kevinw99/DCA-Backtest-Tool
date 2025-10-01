/**
 * Unit tests for shared backtest utilities
 */

const {
  calculatePortfolioDrawdown,
  assessMarketCondition,
  calculateBuyAndHold,
  calculateShortAndHold,
  calculateSharpeRatio,
  calculateWinRate,
  validateBacktestParameters
} = require('../backtestUtilities');

describe('calculatePortfolioDrawdown', () => {
  it('should return zero drawdown for empty portfolio', () => {
    const result = calculatePortfolioDrawdown([]);
    expect(result).toEqual({ maxDrawdown: 0, maxDrawdownPercent: 0 });
  });

  it('should calculate drawdown correctly for declining portfolio', () => {
    const portfolioValues = [10000, 9000, 8000, 7000];
    const result = calculatePortfolioDrawdown(portfolioValues);

    expect(result.maxDrawdown).toBe(3000);
    expect(result.maxDrawdownPercent).toBe(30);
  });

  it('should track maximum drawdown even after recovery', () => {
    const portfolioValues = [10000, 8000, 9000, 7000, 9500];
    const result = calculatePortfolioDrawdown(portfolioValues);

    // Max drawdown was from 10000 to 7000 = 3000 (30%)
    expect(result.maxDrawdown).toBe(3000);
    expect(result.maxDrawdownPercent).toBe(30);
  });

  it('should handle portfolio with only gains', () => {
    const portfolioValues = [10000, 11000, 12000, 13000];
    const result = calculatePortfolioDrawdown(portfolioValues);

    expect(result.maxDrawdown).toBe(0);
    expect(result.maxDrawdownPercent).toBe(0);
  });

  it('should handle single value portfolio', () => {
    const result = calculatePortfolioDrawdown([10000]);
    expect(result.maxDrawdown).toBe(0);
    expect(result.maxDrawdownPercent).toBe(0);
  });
});

describe('assessMarketCondition', () => {
  it('should return neutral for missing indicators', () => {
    const result = assessMarketCondition({});
    expect(result).toEqual({
      regime: 'neutral',
      isHighVolatility: false,
      weeklyTrend: 'neutral',
      volatility: null
    });
  });

  it('should identify bull market', () => {
    const indicators = {
      adjusted_close: 150,
      ma_200: 140,
      ma_50: 145,
      volatility_20: 0.25
    };

    const result = assessMarketCondition(indicators);
    expect(result.regime).toBe('bull');
    expect(result.isHighVolatility).toBe(false);
  });

  it('should identify bear market', () => {
    const indicators = {
      adjusted_close: 130,
      ma_200: 140,
      ma_50: 135,
      volatility_20: 0.30
    };

    const result = assessMarketCondition(indicators);
    expect(result.regime).toBe('bear');
  });

  it('should identify high volatility', () => {
    const indicators = {
      adjusted_close: 150,
      ma_200: 140,
      ma_50: 145,
      volatility_20: 0.45
    };

    const result = assessMarketCondition(indicators);
    expect(result.isHighVolatility).toBe(true);
  });

  it('should include weekly trend if provided', () => {
    const indicators = {
      adjusted_close: 150,
      ma_200: 140,
      ma_50: 145,
      weekly_trend: 'bullish'
    };

    const result = assessMarketCondition(indicators);
    expect(result.weeklyTrend).toBe('bullish');
  });
});

describe('calculateBuyAndHold', () => {
  const prices = [
    { adjusted_close: 100 },
    { adjusted_close: 110 },
    { adjusted_close: 120 }
  ];

  it('should calculate buy-and-hold returns correctly', () => {
    const result = calculateBuyAndHold(prices, 10000);

    expect(result.shares).toBe(100); // 10000 / 100
    expect(result.finalValue).toBe(12000); // 100 shares * 120
    expect(result.totalReturn).toBe(2000); // 12000 - 10000
    expect(result.returnPercent).toBe(20); // (2000 / 10000) * 100
  });

  it('should use average capital for comparison when provided', () => {
    const result = calculateBuyAndHold(prices, 10000, 15000);

    expect(result.totalReturn).toBe(2000);
    expect(result.returnPercent).toBeCloseTo(13.33, 1); // (2000 / 15000) * 100
  });

  it('should handle negative returns', () => {
    const decliningPrices = [
      { adjusted_close: 100 },
      { adjusted_close: 90 },
      { adjusted_close: 80 }
    ];

    const result = calculateBuyAndHold(decliningPrices, 10000);

    expect(result.totalReturn).toBe(-2000); // 8000 - 10000
    expect(result.returnPercent).toBe(-20);
  });
});

describe('calculateShortAndHold', () => {
  const prices = [
    { adjusted_close: 100 },
    { adjusted_close: 90 },
    { adjusted_close: 80 }
  ];

  it('should calculate short-and-hold returns correctly (profit on decline)', () => {
    const result = calculateShortAndHold(prices, 10000);

    expect(result.shares).toBe(100); // 10000 / 100
    // Final value = 10000 + (100 * (100 - 80)) = 10000 + 2000 = 12000
    expect(result.finalValue).toBe(12000);
    expect(result.totalReturn).toBe(2000);
    expect(result.returnPercent).toBe(20);
  });

  it('should show loss when price increases (short position)', () => {
    const risingPrices = [
      { adjusted_close: 100 },
      { adjusted_close: 110 },
      { adjusted_close: 120 }
    ];

    const result = calculateShortAndHold(risingPrices, 10000);

    // Final value = 10000 + (100 * (100 - 120)) = 10000 - 2000 = 8000
    expect(result.finalValue).toBe(8000);
    expect(result.totalReturn).toBe(-2000);
    expect(result.returnPercent).toBe(-20);
  });

  it('should use average capital for comparison when provided', () => {
    const result = calculateShortAndHold(prices, 10000, 15000);

    expect(result.totalReturn).toBe(2000);
    expect(result.returnPercent).toBeCloseTo(13.33, 1);
  });
});

describe('calculateSharpeRatio', () => {
  it('should return 0 for empty returns array', () => {
    expect(calculateSharpeRatio([])).toBe(0);
  });

  it('should return 0 for zero standard deviation', () => {
    const constantReturns = [0.01, 0.01, 0.01, 0.01];
    const result = calculateSharpeRatio(constantReturns);
    expect(result).toBe(0);
  });

  it('should calculate positive Sharpe ratio for good returns', () => {
    const dailyReturns = [0.01, 0.02, 0.015, 0.012, 0.018]; // ~1-2% daily
    const result = calculateSharpeRatio(dailyReturns, 0.02);

    expect(result).toBeGreaterThan(0);
    expect(typeof result).toBe('number');
    expect(isNaN(result)).toBe(false);
  });

  it('should calculate negative Sharpe ratio for poor returns', () => {
    const dailyReturns = [-0.01, -0.02, -0.015, -0.012, -0.018];
    const result = calculateSharpeRatio(dailyReturns, 0.02);

    expect(result).toBeLessThan(0);
  });

  it('should use custom risk-free rate', () => {
    const dailyReturns = [0.01, 0.02, 0.015];
    const result1 = calculateSharpeRatio(dailyReturns, 0.02);
    const result2 = calculateSharpeRatio(dailyReturns, 0.05);

    expect(result2).toBeLessThan(result1); // Higher risk-free rate = lower Sharpe
  });
});

describe('calculateWinRate', () => {
  it('should calculate win rate correctly', () => {
    const transactions = [
      { profit: 100 },
      { profit: -50 },
      { profit: 200 },
      { profit: -30 },
      { profit: 150 }
    ];

    const result = calculateWinRate(transactions);

    expect(result.wins).toBe(3);
    expect(result.losses).toBe(2);
    expect(result.total).toBe(5);
    expect(result.winRate).toBe(60); // 3/5 * 100
  });

  it('should handle all winning trades', () => {
    const transactions = [
      { profit: 100 },
      { profit: 200 },
      { profit: 150 }
    ];

    const result = calculateWinRate(transactions);

    expect(result.winRate).toBe(100);
    expect(result.wins).toBe(3);
    expect(result.losses).toBe(0);
  });

  it('should handle all losing trades', () => {
    const transactions = [
      { profit: -100 },
      { profit: -200 }
    ];

    const result = calculateWinRate(transactions);

    expect(result.winRate).toBe(0);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(2);
  });

  it('should use custom profit key', () => {
    const transactions = [
      { profitAmount: 100 },
      { profitAmount: -50 }
    ];

    const result = calculateWinRate(transactions, 'profitAmount');

    expect(result.wins).toBe(1);
    expect(result.losses).toBe(1);
  });

  it('should return 0 for empty transactions', () => {
    const result = calculateWinRate([]);
    expect(result.winRate).toBe(0);
    expect(result.total).toBe(0);
  });

  it('should ignore transactions without profit field', () => {
    const transactions = [
      { profit: 100 },
      { other: 'data' }, // Missing profit field
      { profit: -50 }
    ];

    const result = calculateWinRate(transactions);
    expect(result.total).toBe(2); // Only counts transactions with profit field
  });
});

describe('validateBacktestParameters', () => {
  const validParams = {
    symbol: 'AAPL',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    lotSizeUsd: 10000,
    gridIntervalPercent: 0.10
  };

  it('should pass validation for valid parameters', () => {
    expect(() => validateBacktestParameters(validParams)).not.toThrow();
  });

  it('should throw error for missing symbol', () => {
    const params = { ...validParams, symbol: '' };
    expect(() => validateBacktestParameters(params)).toThrow('Invalid symbol');
  });

  it('should throw error for invalid symbol type', () => {
    const params = { ...validParams, symbol: 123 };
    expect(() => validateBacktestParameters(params)).toThrow('Invalid symbol');
  });

  it('should throw error for missing dates', () => {
    const params = { ...validParams, startDate: undefined };
    expect(() => validateBacktestParameters(params)).toThrow('Invalid date range');
  });

  it('should throw error when startDate >= endDate', () => {
    const params = { ...validParams, startDate: '2024-12-31', endDate: '2024-01-01' };
    expect(() => validateBacktestParameters(params)).toThrow('startDate must be before endDate');
  });

  it('should throw error for invalid lotSizeUsd', () => {
    const params = { ...validParams, lotSizeUsd: 0 };
    expect(() => validateBacktestParameters(params)).toThrow('Invalid lotSizeUsd');
  });

  it('should throw error for gridIntervalPercent > 1', () => {
    const params = { ...validParams, gridIntervalPercent: 1.5 };
    expect(() => validateBacktestParameters(params)).toThrow('Invalid gridIntervalPercent');
  });

  it('should throw error for gridIntervalPercent <= 0', () => {
    const params = { ...validParams, gridIntervalPercent: 0 };
    expect(() => validateBacktestParameters(params)).toThrow('Invalid gridIntervalPercent');
  });

  it('should allow gridIntervalPercent to be undefined', () => {
    const params = { ...validParams };
    delete params.gridIntervalPercent;
    expect(() => validateBacktestParameters(params)).not.toThrow();
  });
});
