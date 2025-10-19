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
  id,
  adjustedValue, // Scaled value to display inline
  betaScalingInfo // { betaSymbol, beta, betaFactor, mode }
}) => {
  const inputId = id || `param-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const showAdjustedValue = adjustedValue !== undefined && adjustedValue !== null && betaScalingInfo;

  return (
    <div className={`parameter-input ${error ? 'error' : ''} ${className}`}>
      <label htmlFor={inputId}>
        {label}
        {required && <span className="required">*</span>}
        {betaAdjusted && <span className="beta-indicator" title="Beta-adjusted value"> β</span>}
        {helpText && <span className="help-text">{helpText}</span>}
      </label>
      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
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
          style={showAdjustedValue ? {flexShrink: 0, width: 'auto'} : {}}
        />
        {showAdjustedValue && (
          <span className="adjusted-value-inline" style={{
            color: '#0066cc',
            fontSize: '0.9em',
            whiteSpace: 'nowrap'
          }}>
            → <strong>{adjustedValue.toFixed(2)}%</strong>
            <span style={{fontSize: '0.85em', color: '#666', marginLeft: '4px'}}>
              (scaled for {betaScalingInfo.betaSymbol})
            </span>
          </span>
        )}
      </div>
      {error && <span className="error-message">{error}</span>}
    </div>
  );
};

export default ParameterInput;
