/**
 * Structured Logging Utility
 *
 * Replaces scattered console.log statements with organized, filterable logging.
 * Provides log levels, timestamps, and consistent formatting.
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

const LOG_LEVEL_NAMES = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];

// Current log level from environment or default to INFO
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

/**
 * Format timestamp for log messages
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Format log message with metadata
 * @param {string} level - Log level name
 * @param {string} category - Log category/module
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 * @returns {string} Formatted log message
 */
function formatLogMessage(level, category, message, data = null) {
  const timestamp = getTimestamp();
  const prefix = `[${timestamp}] [${level}] [${category}]`;

  if (data) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }

  return `${prefix} ${message}`;
}

/**
 * Log message if level is enabled
 * @param {number} level - Log level number
 * @param {string} category - Log category
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
function log(level, category, message, data = null) {
  if (level > currentLogLevel) return;

  const levelName = LOG_LEVEL_NAMES[level];
  const formattedMessage = formatLogMessage(levelName, category, message, data);

  switch (level) {
    case LOG_LEVELS.ERROR:
      console.error(formattedMessage);
      break;
    case LOG_LEVELS.WARN:
      console.warn(formattedMessage);
      break;
    default:
      console.log(formattedMessage);
  }
}

/**
 * Create a logger for a specific category/module
 * @param {string} category - Category name (e.g., 'DCABacktest', 'BatchService')
 * @returns {Object} Logger instance with level methods
 */
function createLogger(category) {
  return {
    error: (message, data) => log(LOG_LEVELS.ERROR, category, message, data),
    warn: (message, data) => log(LOG_LEVELS.WARN, category, message, data),
    info: (message, data) => log(LOG_LEVELS.INFO, category, message, data),
    debug: (message, data) => log(LOG_LEVELS.DEBUG, category, message, data),
    trace: (message, data) => log(LOG_LEVELS.TRACE, category, message, data),

    // Convenience methods for common patterns
    api: (method, path, params = {}) => {
      log(LOG_LEVELS.INFO, category, `${method} ${path}`, params);
    },

    performance: (operation, duration) => {
      log(LOG_LEVELS.DEBUG, category, `${operation} completed in ${duration}ms`);
    },

    result: (operation, result) => {
      log(LOG_LEVELS.INFO, category, `${operation} result`, result);
    }
  };
}

/**
 * Get current log level for testing/debugging
 * @returns {string} Current log level name
 */
function getCurrentLogLevel() {
  return LOG_LEVEL_NAMES[currentLogLevel];
}

module.exports = {
  createLogger,
  getCurrentLogLevel,
  LOG_LEVELS
};
