/**
 * PercentageSlider - Slider input with percentage display
 */

import React from 'react';

export const PercentageSlider = ({
  label,
  value,
  onChange,
  min = 0.5,
  max = 2.0,
  step = 0.25,
  helpText,
  showValue = true,
  valueFormatter = (v) => v.toFixed(2)
}) => {
  return (
    <div className="percentage-slider">
      <label>
        {label}
        {showValue && <span className="slider-value">{valueFormatter(value)}</span>}
      </label>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
      />
      <div className="slider-markers">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {helpText && <span className="help-text">{helpText}</span>}
    </div>
  );
};

export default PercentageSlider;
