import React, { useState, useEffect, useRef } from 'react';
import { fetchStockData, fetchStocksList } from '../services/api';
import './StockSearch.css';

const StockSearch = ({ onStockSelect, onLoading, onError }) => {
  const [symbol, setSymbol] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [allStocks, setAllStocks] = useState([]);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!symbol.trim()) {
      onError('Please enter a stock symbol');
      return;
    }

    const stockSymbol = symbol.trim().toUpperCase();
    setIsSearching(true);
    onLoading(true);
    onError(null);

    try {
      console.log(`Fetching data for ${stockSymbol}...${forceRefresh ? ' (FORCE REFRESH)' : ''}`);
      // Always fetch adjusted prices by default
      const stockData = await fetchStockData(stockSymbol, { adjusted: true, force: forceRefresh });
      
      if (!stockData.dailyPrices || stockData.dailyPrices.length === 0) {
        throw new Error('No price data available for this symbol');
      }

      onStockSelect(stockData);
      console.log(`Successfully loaded data for ${stockSymbol} (split-adjusted)`);
    } catch (error) {
      console.error('Error fetching stock data:', error);
      onError(error.message || 'Failed to fetch stock data');
    } finally {
      setIsSearching(false);
      onLoading(false);
    }
  };

  // Load all stocks on component mount
  useEffect(() => {
    const loadAllStocks = async () => {
      const stocks = await fetchStocksList();
      setAllStocks(stocks);
    };
    loadAllStocks();
  }, []);

  // Filter suggestions based on input
  useEffect(() => {
    if (symbol.trim().length >= 1) {
      const filtered = allStocks.filter(stock => 
        stock.symbol.toLowerCase().startsWith(symbol.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 10)); // Limit to 10 suggestions
      setShowSuggestions(filtered.length > 0);
      setSelectedSuggestionIndex(-1);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [symbol, allStocks]);

  const handleInputChange = (e) => {
    setSymbol(e.target.value);
  };

  const handleInputKeyDown = (e) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (selectedSuggestionIndex >= 0) {
          e.preventDefault();
          handleSuggestionSelect(suggestions[selectedSuggestionIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
      default:
        break;
    }
  };

  const handleSuggestionSelect = (stock) => {
    setSymbol(stock.symbol);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    // Trigger form submission
    handleQuickSelect(stock.symbol);
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow click events to register
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }, 200);
  };

  const handleInputFocus = () => {
    if (symbol.trim().length >= 1 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleQuickSelect = async (quickSymbol) => {
    setSymbol(quickSymbol);
    setIsSearching(true);
    onLoading(true);
    onError(null);

    try {
      console.log(`Quick selecting ${quickSymbol}...${forceRefresh ? ' (FORCE REFRESH)' : ''}`);
      // Always fetch adjusted prices by default
      const stockData = await fetchStockData(quickSymbol, { adjusted: true, force: forceRefresh });
      
      if (!stockData.dailyPrices || stockData.dailyPrices.length === 0) {
        throw new Error('No price data available for this symbol');
      }

      onStockSelect(stockData);
      console.log(`Successfully loaded data for ${quickSymbol} (split-adjusted)`);
    } catch (error) {
      console.error('Error fetching stock data:', error);
      onError(error.message || 'Failed to fetch stock data');
    } finally {
      setIsSearching(false);
      onLoading(false);
    }
  };

  const popularStocks = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN'];

  return (
    <div className="stock-search">
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-input-group">
          <div className="autocomplete-container">
            <input
              ref={inputRef}
              type="text"
              value={symbol}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onBlur={handleInputBlur}
              onFocus={handleInputFocus}
              placeholder="Enter stock symbol (e.g., NVDA)"
              className="search-input"
              disabled={isSearching}
              autoComplete="off"
            />
            {showSuggestions && (
              <div ref={suggestionsRef} className="suggestions-dropdown">
                {suggestions.map((stock, index) => (
                  <div
                    key={stock.symbol}
                    className={`suggestion-item ${
                      index === selectedSuggestionIndex ? 'selected' : ''
                    }`}
                    onClick={() => handleSuggestionSelect(stock)}
                  >
                    <span className="suggestion-symbol">{stock.symbol}</span>
                    <span className="suggestion-updated">
                      Last updated: {stock.lastUpdated || 'Never'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button 
            type="submit" 
            className="search-button"
            disabled={isSearching}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      <div className="controls-section">
        <div className="force-refresh-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(e.target.checked)}
              className="toggle-checkbox"
              disabled={isSearching}
            />
            <span className="toggle-text">
              🔄 Force Refresh {forceRefresh ? '(Clear cache & fetch fresh data)' : '(Use cached data)'}
            </span>
          </label>
        </div>

        <div className="quick-select">
          <span className="quick-select-label">Popular stocks:</span>
          <div className="quick-select-buttons">
            {popularStocks.map(stock => (
              <button
                key={stock}
                onClick={() => handleQuickSelect(stock)}
                className={`quick-select-button ${forceRefresh ? 'force-refresh-active' : ''}`}
                disabled={isSearching}
              >
                {stock}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockSearch;