const BetaDataService = require('../betaDataService');
const database = require('../../database');

// Mock the database module
jest.mock('../../database', () => ({
  getStock: jest.fn(),
  createStock: jest.fn(),
  insertBeta: jest.fn(),
  getBetaBySymbol: jest.fn(),
  getAllBetas: jest.fn(),
  getStaleBeats: jest.fn(),
  deleteBeta: jest.fn()
}));

describe('BetaDataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset console methods to avoid test output noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchBeta', () => {
    it('should return cached Beta if fresh', async () => {
      const cachedBeta = {
        beta: 1.5,
        source: 'yahoo_finance',
        last_updated: new Date().toISOString(),
        is_manual_override: false
      };

      database.getBetaBySymbol.mockResolvedValue(cachedBeta);

      const result = await BetaDataService.fetchBeta('TSLA');

      expect(result).toEqual({
        beta: 1.5,
        source: 'yahoo_finance',
        lastUpdated: cachedBeta.last_updated,
        isManualOverride: false
      });
      expect(database.getBetaBySymbol).toHaveBeenCalledWith('TSLA');
    });

    it('should fetch from Yahoo Finance if no cached data', async () => {
      database.getBetaBySymbol.mockResolvedValue(null);
      database.getStock.mockResolvedValue({ id: 1, symbol: 'TSLA' });
      database.insertBeta.mockResolvedValue(1);

      const result = await BetaDataService.fetchBeta('TSLA');

      expect(result.beta).toBe(1.8); // Simulated TSLA Beta
      expect(result.source).toBe('yahoo_finance');
      expect(result.isManualOverride).toBe(false);
      expect(database.insertBeta).toHaveBeenCalled();
    });

    it('should return default Beta if all providers fail', async () => {
      database.getBetaBySymbol.mockResolvedValue(null);
      
      // Mock Yahoo Finance to throw error
      jest.spyOn(BetaDataService, 'getBetaFromYahooFinance').mockRejectedValue(new Error('API Error'));
      jest.spyOn(BetaDataService, 'getBetaFromAlphaVantage').mockRejectedValue(new Error('API Error'));

      const result = await BetaDataService.fetchBeta('UNKNOWN');

      expect(result.beta).toBe(1.0);
      expect(result.source).toBe('default');
      expect(result.isManualOverride).toBe(false);
    });

    it('should use stale cached data if providers fail', async () => {
      const staleBeta = {
        beta: 1.3,
        source: 'yahoo_finance',
        last_updated: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
        is_manual_override: false
      };

      database.getBetaBySymbol.mockResolvedValue(staleBeta);
      jest.spyOn(BetaDataService, 'getBetaFromYahooFinance').mockRejectedValue(new Error('API Error'));
      jest.spyOn(BetaDataService, 'getBetaFromAlphaVantage').mockRejectedValue(new Error('API Error'));

      const result = await BetaDataService.fetchBeta('TEST');

      expect(result.beta).toBe(1.3);
      expect(result.source).toBe('yahoo_finance_stale');
      expect(result.isManualOverride).toBe(false);
    });
  });

  describe('getBetaFromYahooFinance', () => {
    it('should return simulated Beta for known stocks', async () => {
      const result = await BetaDataService.getBetaFromYahooFinance('TSLA');

      expect(result.beta).toBe(1.8);
      expect(result.source).toBe('yahoo_finance');
      expect(result.isManualOverride).toBe(false);
      expect(result.lastUpdated).toBeDefined();
    });

    it('should return random Beta for unknown stocks', async () => {
      const result = await BetaDataService.getBetaFromYahooFinance('UNKNOWN');

      expect(result.beta).toBeGreaterThanOrEqual(0.5);
      expect(result.beta).toBeLessThanOrEqual(2.5);
      expect(result.source).toBe('yahoo_finance');
    });
  });

  describe('getBetaFromAlphaVantage', () => {
    it('should return simulated Beta for known stocks', async () => {
      const result = await BetaDataService.getBetaFromAlphaVantage('NVDA');

      expect(result.beta).toBe(1.55);
      expect(result.source).toBe('alpha_vantage');
      expect(result.isManualOverride).toBe(false);
    });
  });

  describe('cacheBeta', () => {
    it('should cache Beta for existing stock', async () => {
      const stock = { id: 1, symbol: 'TSLA' };
      const betaData = {
        beta: 1.5,
        source: 'yahoo_finance',
        lastUpdated: new Date().toISOString(),
        isManualOverride: false
      };

      database.getStock.mockResolvedValue(stock);
      database.insertBeta.mockResolvedValue(1);

      await BetaDataService.cacheBeta('TSLA', betaData);

      expect(database.getStock).toHaveBeenCalledWith('TSLA');
      expect(database.insertBeta).toHaveBeenCalledWith(1, betaData);
    });

    it('should create stock and cache Beta for new stock', async () => {
      const betaData = {
        beta: 1.2,
        source: 'yahoo_finance',
        lastUpdated: new Date().toISOString(),
        isManualOverride: false
      };

      database.getStock.mockResolvedValue(null);
      database.createStock.mockResolvedValue(2);
      database.insertBeta.mockResolvedValue(1);

      await BetaDataService.cacheBeta('NEWSTOCK', betaData);

      expect(database.createStock).toHaveBeenCalledWith('NEWSTOCK');
      expect(database.insertBeta).toHaveBeenCalledWith(2, betaData);
    });
  });

  describe('isBetaFresh', () => {
    it('should return true for manual overrides', () => {
      const betaData = {
        beta: 1.5,
        last_updated: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
        is_manual_override: true
      };

      const result = BetaDataService.isBetaFresh(betaData);
      expect(result).toBe(true);
    });

    it('should return true for fresh data', () => {
      const betaData = {
        beta: 1.5,
        last_updated: new Date().toISOString(), // Now
        is_manual_override: false
      };

      const result = BetaDataService.isBetaFresh(betaData);
      expect(result).toBe(true);
    });

    it('should return false for stale data', () => {
      const betaData = {
        beta: 1.5,
        last_updated: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
        is_manual_override: false
      };

      const result = BetaDataService.isBetaFresh(betaData);
      expect(result).toBe(false);
    });

    it('should return false for missing data', () => {
      expect(BetaDataService.isBetaFresh(null)).toBe(false);
      expect(BetaDataService.isBetaFresh({})).toBe(false);
    });
  });

  describe('setManualBeta', () => {
    it('should set manual Beta for existing stock', async () => {
      const stock = { id: 1, symbol: 'TSLA' };
      database.getStock.mockResolvedValue(stock);
      database.insertBeta.mockResolvedValue(1);

      const result = await BetaDataService.setManualBeta('TSLA', 2.5);

      expect(result.beta).toBe(2.5);
      expect(result.source).toBe('manual_override');
      expect(result.isManualOverride).toBe(true);
      expect(database.insertBeta).toHaveBeenCalledWith(1, expect.objectContaining({
        beta: 2.5,
        source: 'manual_override',
        isManualOverride: true
      }));
    });

    it('should create stock and set manual Beta for new stock', async () => {
      database.getStock.mockResolvedValue(null);
      database.createStock.mockResolvedValue(2);
      database.insertBeta.mockResolvedValue(1);

      const result = await BetaDataService.setManualBeta('NEWSTOCK', 1.8);

      expect(result.beta).toBe(1.8);
      expect(database.createStock).toHaveBeenCalledWith('NEWSTOCK');
      expect(database.insertBeta).toHaveBeenCalledWith(2, expect.objectContaining({
        beta: 1.8,
        isManualOverride: true
      }));
    });

    it('should validate Beta value', async () => {
      await expect(BetaDataService.setManualBeta('TSLA', -1)).rejects.toThrow('Beta must be a number between 0 and 10');
      await expect(BetaDataService.setManualBeta('TSLA', 15)).rejects.toThrow('Beta must be a number between 0 and 10');
      await expect(BetaDataService.setManualBeta('TSLA', 'invalid')).rejects.toThrow('Beta must be a number between 0 and 10');
    });

    it('should round Beta to 2 decimal places', async () => {
      const stock = { id: 1, symbol: 'TSLA' };
      database.getStock.mockResolvedValue(stock);
      database.insertBeta.mockResolvedValue(1);

      const result = await BetaDataService.setManualBeta('TSLA', 1.23456);

      expect(result.beta).toBe(1.23);
    });
  });

  describe('removeManualBeta', () => {
    it('should remove manual override and fetch fresh data', async () => {
      const stock = { id: 1, symbol: 'TSLA' };
      database.getStock.mockResolvedValue(stock);
      database.deleteBeta.mockResolvedValue(1);
      database.getBetaBySymbol.mockResolvedValue(null); // No cached data after deletion
      database.insertBeta.mockResolvedValue(1);

      const result = await BetaDataService.removeManualBeta('TSLA');

      expect(database.deleteBeta).toHaveBeenCalledWith(1);
      expect(result.beta).toBe(1.8); // Fresh Yahoo Finance data
      expect(result.source).toBe('yahoo_finance');
      expect(result.isManualOverride).toBe(false);
    });

    it('should throw error for non-existent stock', async () => {
      database.getStock.mockResolvedValue(null);

      await expect(BetaDataService.removeManualBeta('NONEXISTENT')).rejects.toThrow('Stock NONEXISTENT not found');
    });
  });

  describe('getBetasForSymbols', () => {
    it('should fetch Betas for multiple symbols', async () => {
      database.getBetaBySymbol.mockImplementation((symbol) => {
        if (symbol === 'TSLA') {
          return Promise.resolve({
            beta: 1.8,
            source: 'yahoo_finance',
            last_updated: new Date().toISOString(),
            is_manual_override: false
          });
        }
        return Promise.resolve(null);
      });

      database.getStock.mockResolvedValue({ id: 1, symbol: 'AAPL' });
      database.insertBeta.mockResolvedValue(1);

      const result = await BetaDataService.getBetasForSymbols(['TSLA', 'AAPL']);

      expect(result.TSLA.beta).toBe(1.8);
      expect(result.AAPL.beta).toBe(1.2); // Fresh Yahoo Finance data
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('should handle errors gracefully', async () => {
      database.getBetaBySymbol.mockRejectedValue(new Error('Database error'));

      const result = await BetaDataService.getBetasForSymbols(['ERROR']);

      expect(result.ERROR.beta).toBeGreaterThanOrEqual(0.5);
      expect(result.ERROR.beta).toBeLessThanOrEqual(2.5);
      expect(result.ERROR.source).toBe('yahoo_finance');
    });
  });

  describe('refreshStaleBeats', () => {
    it('should refresh stale Betas', async () => {
      const staleBetas = [
        { symbol: 'TSLA', beta: 1.5, last_updated: '2023-01-01' },
        { symbol: 'AAPL', beta: 1.0, last_updated: '2023-01-01' }
      ];

      database.getStaleBeats.mockResolvedValue(staleBetas);
      database.getBetaBySymbol.mockResolvedValue(null); // Force fresh fetch
      database.getStock.mockResolvedValue({ id: 1, symbol: 'TEST' });
      database.insertBeta.mockResolvedValue(1);

      const result = await BetaDataService.refreshStaleBeats(24);

      expect(result).toBe(2);
      expect(database.getStaleBeats).toHaveBeenCalledWith(24);
    });

    it('should handle refresh errors gracefully', async () => {
      const staleBetas = [
        { symbol: 'ERROR', beta: 1.5, last_updated: '2023-01-01' }
      ];

      database.getStaleBeats.mockResolvedValue(staleBetas);
      database.getBetaBySymbol.mockResolvedValue(null); // No cached data
      database.getStock.mockResolvedValue({ id: 1, symbol: 'ERROR' });
      database.insertBeta.mockResolvedValue(1);

      const result = await BetaDataService.refreshStaleBeats(24);

      expect(result).toBe(1); // One successful refresh (ERROR gets random Beta)
    });
  });
});