import React from 'react';
import './TimeRangeControls.css';

const TimeRangeControls = ({ selectedRange, onRangeChange }) => {
  const timeRanges = [
    { id: '1Y', label: '1Y' },
    { id: '2Y', label: '2Y' },
    { id: '3Y', label: '3Y' },
    { id: '5Y', label: '5Y' },
    { id: 'All', label: 'All' }
  ];

  return (
    <div className="time-range-controls">
      <label className="controls-label">Zoom:</label>
      <div className="range-buttons">
        {timeRanges.map(range => (
          <button
            key={range.id}
            className={`range-button ${selectedRange === range.id ? 'active' : ''}`}
            onClick={() => onRangeChange(range.id)}
          >
            {range.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TimeRangeControls;