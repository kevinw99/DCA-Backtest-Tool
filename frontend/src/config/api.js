/**
 * Centralized API Configuration
 *
 * Use REACT_APP_API_URL environment variable for production deployments
 * Falls back to localhost:3001 for local development
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const getApiUrl = (path) => {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const getApiBaseUrl = () => API_BASE_URL;

export default {
  getApiUrl,
  getApiBaseUrl,
  BASE_URL: API_BASE_URL
};
