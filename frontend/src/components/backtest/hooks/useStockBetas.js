/**
 * useStockBetas - Manage beta state for multiple stocks
 *
 * Fetches beta values from the backend API for portfolio mode.
 * Handles batch fetching, individual refresh, and state management.
 */

import { useState, useEffect, useCallback } from 'react';

export function useStockBetas(stocks = []) {
  const [betaData, setBetaData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch betas for all stocks in parallel
   */
  const fetchBetas = useCallback(async (stockList) => {
    if (!stockList || stockList.length === 0) {
      setBetaData({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/beta/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: stockList })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setBetaData(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch betas');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching betas:', err);

      // Set default beta values on error
      const defaultBetas = {};
      stockList.forEach(symbol => {
        defaultBetas[symbol] = {
          beta: 1.0,
          source: 'default',
          updatedAt: null,
          age: null,
          isStale: false
        };
      });
      setBetaData(defaultBetas);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Refresh beta for a single stock
   */
  const refreshBeta = useCallback(async (symbol) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/beta/${symbol}/refresh`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Check if this is a "cannot refresh" error (file-based beta)
        if (errorData.cannotRefresh) {
          setError(`Cannot refresh ${symbol}: ${errorData.error}`);
          return;
        }

        throw new Error(errorData.error || 'Failed to refresh beta');
      }

      const result = await response.json();

      if (result.success) {
        // Update beta data for this symbol
        setBetaData(prev => ({
          ...prev,
          [symbol]: {
            beta: result.data.beta,
            source: result.data.source,
            updatedAt: result.data.lastUpdated,
            age: 0, // Just fetched
            isStale: false,
            providerName: result.data.providerName
          }
        }));

        console.log(`✅ Refreshed beta for ${symbol}: ${result.data.beta}`);
      } else {
        throw new Error(result.error || 'Failed to refresh beta');
      }
    } catch (err) {
      setError(err.message);
      console.error(`Error refreshing beta for ${symbol}:`, err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Refresh all stocks
   */
  const refreshAll = useCallback(() => {
    fetchBetas(stocks);
  }, [stocks, fetchBetas]);

  /**
   * Fetch betas when stocks array changes
   */
  useEffect(() => {
    fetchBetas(stocks);
  }, [stocks, fetchBetas]);

  return {
    betaData,
    loading,
    error,
    refreshBeta,
    refreshAll,
    fetchBetas
  };
}

export default useStockBetas;
