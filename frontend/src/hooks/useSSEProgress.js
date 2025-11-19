import { useState, useEffect, useRef } from 'react';
import { getApiBaseUrl } from '../config/api';

/**
 * Custom hook for Server-Sent Events progress tracking
 * @param {string} sessionId - Session ID for the batch backtest
 * @param {string} baseURL - Base URL for the API (default: from centralized config)
 * @returns {object} Progress state and connection status
 */
function useSSEProgress(sessionId, baseURL = getApiBaseUrl()) {
  const [progress, setProgress] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [results, setResults] = useState(null);

  const eventSourceRef = useRef(null);

  useEffect(() => {
    // Don't connect if no sessionId
    if (!sessionId) {
      return;
    }

    console.log(`🔌 Connecting to SSE stream for session ${sessionId}`);

    // Create EventSource connection
    const eventSource = new EventSource(
      `${baseURL}/api/backtest/batch/stream?sessionId=${sessionId}`
    );
    eventSourceRef.current = eventSource;

    // Handle connection open
    eventSource.onopen = () => {
      console.log('✅ SSE connection opened');
      setIsConnected(true);
      setError(null);
    };

    // Handle 'connected' event
    eventSource.addEventListener('connected', (event) => {
      const data = JSON.parse(event.data);
      console.log('🔌 SSE connected:', data.message);
    });

    // Handle 'progress' events
    eventSource.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      console.log(`📊 Progress update: ${data.percentage}%`, data);
      setProgress(data);
    });

    // Handle 'complete' event
    eventSource.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data);
      console.log('✅ Batch backtest complete:', data);
      setIsComplete(true);
      setResults(data.data);

      // Close connection after completion
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    });

    // Handle 'error' event from server
    eventSource.addEventListener('error', (event) => {
      if (event.data) {
        const data = JSON.parse(event.data);
        console.error('❌ SSE error event:', data.error);
        setError(data.error);
        setIsComplete(true);
      }
    });

    // Handle connection errors
    eventSource.onerror = (event) => {
      console.error('❌ SSE connection error:', event);

      // EventSource automatically retries, but if it's closed, update state
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('🔌 SSE connection closed');
        setIsConnected(false);

        // Only set error if we haven't completed successfully
        if (!isComplete) {
          setError('Connection to server lost');
        }
      }
    };

    // Cleanup function
    return () => {
      console.log('🔌 Cleaning up SSE connection');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [sessionId, baseURL, isComplete]);

  return {
    progress,
    isConnected,
    error,
    isComplete,
    results
  };
}

export default useSSEProgress;
