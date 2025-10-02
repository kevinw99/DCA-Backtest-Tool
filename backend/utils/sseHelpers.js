/**
 * SSE Helper Functions
 * Utilities for Server-Sent Events communication
 */

/**
 * Initialize SSE connection with proper headers
 * @param {object} res - Express response object
 */
function initSSE(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable Nginx buffering
  });
}

/**
 * Send SSE event to client
 * @param {object} res - Express response object
 * @param {string} eventType - Event type (progress, complete, error)
 * @param {object} data - Event data
 * @returns {boolean} - True if write succeeded, false if backpressure
 */
function sendSSE(res, eventType, data) {
  if (!res || res.destroyed || res.closed) {
    return false;
  }

  try {
    const payload = {
      type: eventType,
      timestamp: Date.now(),
      ...data
    };

    const sseData = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
    return res.write(sseData);
  } catch (error) {
    console.error('Error sending SSE:', error);
    return false;
  }
}

/**
 * Send SSE comment (keep-alive heartbeat)
 * @param {object} res - Express response object
 */
function sendKeepAlive(res) {
  if (!res || res.destroyed || res.closed) {
    return false;
  }

  try {
    res.write(': keep-alive\n\n');
    return true;
  } catch (error) {
    console.error('Error sending keep-alive:', error);
    return false;
  }
}

/**
 * Close SSE connection gracefully
 * @param {object} res - Express response object
 */
function closeSSE(res) {
  if (res && !res.destroyed && !res.closed) {
    res.end();
  }
}

/**
 * Calculate progress percentage
 * @param {number} current - Current item number
 * @param {number} total - Total items
 * @returns {number} - Percentage (0-100)
 */
function calculatePercentage(current, total) {
  if (total === 0) return 0;
  return Math.round((current / total) * 100 * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate estimated time remaining
 * @param {number} current - Current item number
 * @param {number} total - Total items
 * @param {number} elapsedTime - Elapsed time in milliseconds
 * @returns {number} - Estimated time remaining in seconds
 */
function calculateETA(current, total, elapsedTime) {
  if (current === 0) return 0;

  const avgTimePerTest = elapsedTime / current;
  const remaining = total - current;
  const etaMs = remaining * avgTimePerTest;

  return Math.round(etaMs / 1000); // Convert to seconds
}

/**
 * Calculate average time per test
 * @param {number} elapsedTime - Elapsed time in milliseconds
 * @param {number} current - Current item number
 * @returns {number} - Average time per test in seconds
 */
function calculateAvgTime(elapsedTime, current) {
  if (current === 0) return 0;
  return Math.round((elapsedTime / current) / 1000 * 100) / 100; // Seconds, 2 decimals
}

/**
 * Format time duration in human-readable format
 * @param {number} seconds - Time in seconds
 * @returns {string} - Formatted time (e.g., "2m 30s")
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

module.exports = {
  initSSE,
  sendSSE,
  sendKeepAlive,
  closeSSE,
  calculatePercentage,
  calculateETA,
  calculateAvgTime,
  formatDuration
};
