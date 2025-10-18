/**
 * useBacktestValidation - Custom hook for real-time form validation
 *
 * Validates backtest parameters as they change and returns validation errors.
 * Implements debouncing to avoid excessive validation on rapid input changes.
 */

import { useState, useEffect, useMemo } from 'react';
import { ValidationHelper } from '../utils/ValidationHelper';

/**
 * Custom hook for backtest form validation
 *
 * @param {Object} parameters - Form parameters to validate
 * @param {string} mode - 'single' or 'portfolio'
 * @param {number} debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns {Object} { errors, warnings, isValid }
 */
export function useBacktestValidation(parameters, mode = 'single', debounceMs = 300) {
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);

  // Debounced validation
  useEffect(() => {
    const timer = setTimeout(() => {
      const validationResults = ValidationHelper.validateBacktestForm(parameters, mode);

      // Separate errors and warnings
      const errorResults = ValidationHelper.getErrors(validationResults);
      const warningResults = ValidationHelper.getWarnings(validationResults);

      setErrors(errorResults);
      setWarnings(warningResults);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [parameters, mode, debounceMs]);

  // Check if form is valid (no errors, warnings are ok)
  const isValid = useMemo(() => {
    return errors.length === 0;
  }, [errors]);

  // Helper to check if a specific field has an error
  const hasError = useMemo(() => {
    return (fieldName) => ValidationHelper.hasError(errors, fieldName);
  }, [errors]);

  // Helper to get error message for a specific field
  const getError = useMemo(() => {
    return (fieldName) => ValidationHelper.getError(errors, fieldName);
  }, [errors]);

  // Helper to check if a specific field has a warning
  const hasWarning = useMemo(() => {
    return (fieldName) => ValidationHelper.hasError(warnings, fieldName);
  }, [warnings]);

  // Helper to get warning message for a specific field
  const getWarning = useMemo(() => {
    return (fieldName) => ValidationHelper.getError(warnings, fieldName);
  }, [warnings]);

  return {
    errors,
    warnings,
    isValid,
    hasError,
    getError,
    hasWarning,
    getWarning
  };
}

export default useBacktestValidation;
