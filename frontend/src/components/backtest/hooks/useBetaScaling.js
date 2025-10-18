/**
 * useBetaScaling - Custom hook for beta scaling state management
 *
 * Manages beta scaling state, calculations, and API integration for both
 * single stock and portfolio modes.
 */

import { useState, useEffect, useCallback } from 'react';
import { BetaCalculator } from '../utils/BetaCalculator';

/**
 * Custom hook for beta scaling
 *
 * @param {string|Array} symbol - Stock symbol (string) or symbols (array for portfolio)
 * @param {Object} initialParameters - Initial base parameters
 * @param {string} mode - 'single' or 'portfolio'
 * @returns {Object} Beta scaling state and functions
 */
export function useBetaScaling(symbol, initialParameters, mode = 'single') {
  const [enableBetaScaling, setEnableBetaScaling] = useState(false);
  const [betaData, setBetaData] = useState({
    beta: 1.0,
    betaFactor: 1.0,
    coefficient: 1.0,
    isManualBetaOverride: false
  });
  const [baseParameters, setBaseParameters] = useState(initialParameters);
  const [adjustedParameters, setAdjustedParameters] = useState(initialParameters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Portfolio-specific: map of symbol -> adjusted params
  const [portfolioAdjusted, setPortfolioAdjusted] = useState({});

  /**
   * Toggle beta scaling on/off
   */
  const toggleBetaScaling = useCallback(() => {
    setEnableBetaScaling(prev => !prev);
  }, []);

  /**
   * Update coefficient and recalculate adjusted parameters
   */
  const updateCoefficient = useCallback((newCoefficient) => {
    setBetaData(prev => ({
      ...prev,
      coefficient: newCoefficient,
      betaFactor: prev.beta * newCoefficient
    }));
  }, []);

  /**
   * Update beta value (manual override)
   */
  const updateBeta = useCallback((newBeta) => {
    setBetaData(prev => ({
      ...prev,
      beta: newBeta,
      betaFactor: newBeta * prev.coefficient,
      isManualBetaOverride: true
    }));
  }, []);

  /**
   * Calculate adjusted parameters (single stock mode)
   */
  const calculateAdjustedSingle = useCallback(async () => {
    if (mode !== 'single' || !symbol) return;

    setLoading(true);
    setError(null);

    try {
      // Try to fetch from API first
      const apiResponse = await BetaCalculator.fetchBetaWithRetry(
        symbol,
        baseParameters,
        betaData.coefficient
      );

      // Update beta data from API
      setBetaData(prev => ({
        ...prev,
        beta: apiResponse.beta,
        betaFactor: apiResponse.betaFactor,
        isManualBetaOverride: false
      }));

      // Use API-calculated adjusted parameters
      setAdjustedParameters(apiResponse.adjustedParameters);
    } catch (apiError) {
      console.warn('API fetch failed, using local calculation:', apiError);

      // Fallback to local calculation using backtestDefaults.json
      const beta = betaData.isManualBetaOverride
        ? betaData.beta
        : BetaCalculator.getStockBeta(symbol);

      const localAdjusted = BetaCalculator.calculateAdjustedParameters(
        baseParameters,
        symbol,
        betaData.coefficient,
        betaData.isManualBetaOverride ? betaData.beta : null
      );

      setBetaData(prev => ({
        ...prev,
        beta,
        betaFactor: beta * prev.coefficient
      }));

      setAdjustedParameters(localAdjusted);
    } finally {
      setLoading(false);
    }
  }, [symbol, baseParameters, betaData.coefficient, betaData.beta, betaData.isManualBetaOverride, mode]);

  /**
   * Calculate adjusted parameters (portfolio mode)
   */
  const calculateAdjustedPortfolio = useCallback(() => {
    if (mode !== 'portfolio' || !Array.isArray(symbol)) return;

    setLoading(true);
    setError(null);

    try {
      // Use local calculation for portfolio (each stock gets its own beta from backtestDefaults.json)
      const portfolioResults = BetaCalculator.calculatePortfolioBetaScaling(
        baseParameters,
        symbol,
        betaData.coefficient
      );

      setPortfolioAdjusted(portfolioResults);

      // For portfolio, adjustedParameters is the average or representative set
      // In practice, each stock will use its own adjusted params
      setAdjustedParameters(baseParameters); // Keep base params as reference
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [symbol, baseParameters, betaData.coefficient, mode]);

  /**
   * Calculate adjusted parameters (mode-aware)
   */
  const calculateAdjusted = useCallback(() => {
    if (mode === 'single') {
      return calculateAdjustedSingle();
    } else {
      return calculateAdjustedPortfolio();
    }
  }, [mode, calculateAdjustedSingle, calculateAdjustedPortfolio]);

  /**
   * Update base parameters (when user changes a base value)
   */
  const updateBaseParameters = useCallback((newBaseParams) => {
    setBaseParameters(newBaseParams);
  }, []);

  /**
   * Reset beta scaling to defaults
   */
  const resetBetaScaling = useCallback(() => {
    setEnableBetaScaling(false);
    setBetaData({
      beta: 1.0,
      betaFactor: 1.0,
      coefficient: 1.0,
      isManualBetaOverride: false
    });
    setAdjustedParameters(baseParameters);
    setPortfolioAdjusted({});
    setError(null);
  }, [baseParameters]);

  /**
   * Get adjusted parameters for a specific symbol (portfolio mode)
   */
  const getAdjustedForSymbol = useCallback((stockSymbol) => {
    if (mode !== 'portfolio') return adjustedParameters;
    return portfolioAdjusted[stockSymbol] || baseParameters;
  }, [mode, portfolioAdjusted, adjustedParameters, baseParameters]);

  // Auto-calculate when beta scaling is enabled and coefficient changes
  useEffect(() => {
    if (enableBetaScaling) {
      calculateAdjusted();
    } else {
      // When disabled, use base parameters
      setAdjustedParameters(baseParameters);
      setPortfolioAdjusted({});
    }
  }, [enableBetaScaling, betaData.coefficient, betaData.beta, baseParameters, calculateAdjusted]);

  // Load initial beta value from backtestDefaults.json
  useEffect(() => {
    if (mode === 'single' && symbol && !betaData.isManualBetaOverride) {
      const beta = BetaCalculator.getStockBeta(symbol);
      setBetaData(prev => ({
        ...prev,
        beta,
        betaFactor: beta * prev.coefficient
      }));
    }
  }, [symbol, mode, betaData.isManualBetaOverride]);

  return {
    // State
    enableBetaScaling,
    betaData,
    baseParameters,
    adjustedParameters,
    portfolioAdjusted,
    loading,
    error,

    // Functions
    toggleBetaScaling,
    updateCoefficient,
    updateBeta,
    calculateAdjusted,
    updateBaseParameters,
    resetBetaScaling,
    getAdjustedForSymbol
  };
}

export default useBetaScaling;
