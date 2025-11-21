/**
 * useParameterDefaults - Custom hook for loading parameter defaults
 *
 * Loads default parameters from backtestDefaults.json based on mode (single/portfolio)
 * and symbol(s). Handles stock-specific overrides and global defaults.
 */

import { useState, useEffect } from 'react';
import { ParameterHelper } from '../utils/ParameterHelper';

/**
 * Custom hook for loading parameter defaults
 *
 * @param {string|Array|null} symbol - Stock symbol (single) or symbols (portfolio) or null
 * @param {string} mode - 'single' or 'portfolio'
 * @returns {Object} { parameters, loading, error, reload }
 */
export function useParameterDefaults(symbol, mode = 'single') {
  const [parameters, setParameters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Load parameters based on mode
   */
  const loadParameters = () => {
    setLoading(true);
    setError(null);

    try {
      if (mode === 'single') {
        // Single stock mode: load global + stock-specific defaults
        const stockSymbol = typeof symbol === 'string' ? symbol : 'NVDA';
        const defaults = ParameterHelper.getSingleStockDefaults(stockSymbol);
        setParameters(defaults);
      } else if (mode === 'portfolio') {
        // Portfolio mode: load global defaults
        const defaults = ParameterHelper.getPortfolioDefaults();
        setParameters(defaults);
      } else {
        throw new Error(`Invalid mode: ${mode}`);
      }
    } catch (err) {
      console.error('Failed to load parameter defaults:', err);
      setError(err.message);
      // Set fallback defaults
      setParameters(mode === 'single'
        ? ParameterHelper.getSingleStockDefaults('NVDA')
        : ParameterHelper.getPortfolioDefaults()
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reload parameters (useful when symbol changes)
   */
  const reload = () => {
    loadParameters();
  };

  // Load parameters on mount and when symbol/mode changes
  useEffect(() => {
    loadParameters();
  }, [symbol, mode]);

  return {
    parameters,
    loading,
    error,
    reload
  };
}

export default useParameterDefaults;
