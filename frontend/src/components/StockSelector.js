import React, { useState, useEffect } from 'react';
import { getAllAvailableStocks } from '../utils/stockDefaults';
import './StockSelector.css';

const StockSelector = ({ selectedStocks = [], onChange }) => {
  const [availableStocks, setAvailableStocks] = useState(() => {
    const saved = localStorage.getItem('portfolio-available-symbols');
    // Use all available stocks from database (18 stocks)
    const defaultSymbols = getAllAvailableStocks();
    const symbols = saved ? JSON.parse(saved) : defaultSymbols;
    return symbols.sort();
  });

  const [customSymbol, setCustomSymbol] = useState('');

  // Persist availableStocks to localStorage
  useEffect(() => {
    localStorage.setItem('portfolio-available-symbols', JSON.stringify(availableStocks));
  }, [availableStocks]);

  const handleToggle = (symbol) => {
    if (selectedStocks.includes(symbol)) {
      onChange(selectedStocks.filter(s => s !== symbol));
    } else {
      onChange([...selectedStocks, symbol]);
    }
  };

  const handleAddCustom = () => {
    const symbol = customSymbol.trim().toUpperCase();
    if (symbol && !availableStocks.includes(symbol)) {
      const newStocks = [...availableStocks, symbol].sort();
      setAvailableStocks(newStocks);
      onChange([...selectedStocks, symbol]);
      setCustomSymbol('');
    } else if (symbol && availableStocks.includes(symbol)) {
      // Symbol already exists, just select it
      if (!selectedStocks.includes(symbol)) {
        onChange([...selectedStocks, symbol]);
      }
      setCustomSymbol('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustom();
    }
  };

  return (
    <div className="stock-selector">
      <div className="stock-chips">
        {availableStocks.map(symbol => (
          <div
            key={symbol}
            className={`stock-chip ${selectedStocks.includes(symbol) ? 'selected' : ''}`}
            onClick={() => handleToggle(symbol)}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggle(symbol);
              }
            }}
          >
            {symbol}
            {selectedStocks.includes(symbol) && <span className="checkmark"> ✓</span>}
          </div>
        ))}
      </div>

      <div className="custom-symbol">
        <input
          type="text"
          placeholder="Add custom symbol (e.g., GOOGL)"
          value={customSymbol}
          onChange={(e) => setCustomSymbol(e.target.value)}
          onKeyPress={handleKeyPress}
          aria-label="Add custom stock symbol"
        />
        <button onClick={handleAddCustom} type="button">
          Add
        </button>
      </div>

      <div className="selected-count">
        {selectedStocks.length} stock{selectedStocks.length !== 1 ? 's' : ''} selected
        {selectedStocks.length > 0 && (
          <span className="selected-list">
            {' '}({selectedStocks.join(', ')})
          </span>
        )}
      </div>
    </div>
  );
};

export default StockSelector;
