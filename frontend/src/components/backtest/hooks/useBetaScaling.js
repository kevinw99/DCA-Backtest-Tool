/**
 * useBetaScaling - Custom hook for beta scaling configuration management
 *
 * NOTE (Spec 43): This hook now ONLY manages beta scaling configuration state.
 * All calculations are handled by the backend BetaScalingService.
 *
 * Backend handles:
 * - Beta value fetching (BetaService)
 * - Parameter scaling calculations (BetaScalingService)
 * - Configuration validation (BetaScalingService)
 *
 * This hook provides:
 * - State management for UI controls (enable toggle, coefficient slider, manual beta)
 * - betaConfig object for API requests
 * - No calculation logic - backend does all the work
 */

import { useState, useCallback } from 'react';

/**
 * Custom hook for beta scaling configuration
 *
 * @param {string|Array} symbol - Stock symbol (not used for calculations, kept for compatibility)
 * @returns {Object} Beta scaling configuration state and functions
 */
export function useBetaScaling(symbol) {
  const [betaConfig, setBetaConfig] = useState({
    enableBetaScaling: false,
    coefficient: 1.0,
    beta: null,  // Manual beta override (null = let backend fetch)
    isManualBetaOverride: false
  });

  /**
   * Toggle beta scaling on/off
   */
  const toggleBetaScaling = useCallback(() => {
    setBetaConfig(prev => ({
      ...prev,
      enableBetaScaling: !prev.enableBetaScaling
    }));
  }, []);

  /**
   * Update coefficient value
   */
  const updateCoefficient = useCallback((newCoefficient) => {
    setBetaConfig(prev => ({
      ...prev,
      coefficient: newCoefficient
    }));
  }, []);

  /**
   * Update beta value (manual override)
   */
  const updateBeta = useCallback((newBeta) => {
    setBetaConfig(prev => ({
      ...prev,
      beta: newBeta,
      isManualBetaOverride: true
    }));
  }, []);

  /**
   * Clear manual beta override (let backend fetch beta)
   */
  const clearManualBeta = useCallback(() => {
    setBetaConfig(prev => ({
      ...prev,
      beta: null,
      isManualBetaOverride: false
    }));
  }, []);

  /**
   * Enable beta scaling
   */
  const enableBetaScaling = useCallback(() => {
    setBetaConfig(prev => ({
      ...prev,
      enableBetaScaling: true
    }));
  }, []);

  /**
   * Disable beta scaling
   */
  const disableBetaScaling = useCallback(() => {
    setBetaConfig(prev => ({
      ...prev,
      enableBetaScaling: false
    }));
  }, []);

  /**
   * Reset beta scaling to defaults
   */
  const resetBetaScaling = useCallback(() => {
    setBetaConfig({
      enableBetaScaling: false,
      coefficient: 1.0,
      beta: null,
      isManualBetaOverride: false
    });
  }, []);

  /**
   * Update entire beta config at once
   */
  const updateBetaConfig = useCallback((newConfig) => {
    setBetaConfig(prev => ({
      ...prev,
      ...newConfig
    }));
  }, []);

  return {
    // Configuration state (for API requests)
    betaConfig,

    // Individual config values (for UI bindings)
    enableBetaScaling: betaConfig.enableBetaScaling,
    coefficient: betaConfig.coefficient,
    beta: betaConfig.beta,
    isManualBetaOverride: betaConfig.isManualBetaOverride,

    // Backwards compatibility (no longer computed here - backend handles it)
    adjustedParameters: {}, // Empty object for backwards compatibility
    betaData: {
      beta: betaConfig.beta || 1.0,
      coefficient: betaConfig.coefficient,
      betaFactor: (betaConfig.beta || 1.0) * betaConfig.coefficient,
      isManualBetaOverride: betaConfig.isManualBetaOverride
    },
    loading: false,
    error: null,

    // State update functions
    toggleBetaScaling,
    updateCoefficient,
    updateBeta,
    clearManualBeta,
    disableBetaScaling,
    resetBetaScaling,
    updateBetaConfig
  };
}

export default useBetaScaling;
