/**
 * ParameterInput - Reusable parameter input component
 *
 * Handles label, input, error messages, help text, and beta-adjusted indicators.
 */

import React from 'react';

export const ParameterInput = ({
  label,
  value,
  onChange,
  type = 'number',
  min,
  max,
  step,
  error,
  helpText,
  betaAdjusted = false,
  disabled = false,
  required = false,
  className = '',
  id
}) => {
  const inputId = id || `param-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className={`parameter-input ${error ? 'error' : ''} ${className}`}>
      <label htmlFor={inputId}>
        {label}
        {required && <span className="required">*</span>}
        {betaAdjusted && <span className="beta-indicator" title="Beta-adjusted value"> β</span>}
        {helpText && <span className="help-text">{helpText}</span>}
      </label>
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(e) => {
          const val = type === 'number'
            ? (e.target.value === '' ? '' : parseFloat(e.target.value))
            : e.target.value;
          onChange(val);
        }}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={error ? 'has-error' : ''}
      />
      {error && <span className="error-message">{error}</span>}
    </div>
  );
};

export default ParameterInput;
