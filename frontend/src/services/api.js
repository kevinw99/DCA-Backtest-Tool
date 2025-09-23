import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds timeout for API calls
});

export const fetchStockData = async (symbol, options = {}) => {
  try {
    const { startDate, endDate, adjusted = true, force = false } = options;
    const params = {};
    
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (adjusted !== undefined) params.adjusted = adjusted;
    if (force) params.force = 'true';

    console.log(`Making API request for ${symbol}...`);
    console.log(`API URL: ${API_BASE_URL}/stocks/${symbol}`);
    console.log(`Params:`, params);
    
    const response = await api.get(`/stocks/${symbol}`, { params });
    
    console.log(`✅ API Response received:`, response.status);
    console.log(`Response data keys:`, Object.keys(response.data));
    console.log(`Daily prices:`, response.data.dailyPrices);
    console.log(`Daily prices length:`, response.data.dailyPrices?.length || 'undefined');
    
    if (response.data.error) {
      console.log(`❌ API returned error:`, response.data.message);
      throw new Error(response.data.message || 'API returned an error');
    }

    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.message || error.response.data?.error || 'Server error';
      throw new Error(`${message} (${error.response.status})`);
    } else if (error.request) {
      // Network error
      throw new Error('Network error - please check your connection and try again');
    } else {
      // Other error
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
};

export const fetchAvailableMetrics = async () => {
  try {
    const response = await api.get('/metrics');
    return response.data;
  } catch (error) {
    console.error('Error fetching metrics:', error);
    throw new Error('Failed to fetch available metrics');
  }
};

export const fetchStocksList = async (searchTerm = '') => {
  try {
    const params = searchTerm ? { search: searchTerm } : {};
    const response = await api.get('/stocks', { params });
    return response.data.stocks || [];
  } catch (error) {
    console.error('Error fetching stocks list:', error);
    return []; // Return empty array on error to not break autocomplete
  }
};

export const healthCheck = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw new Error('API health check failed');
  }
};