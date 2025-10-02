const { v4: uuidv4 } = require('uuid');

/**
 * Session Manager for tracking batch backtest progress across SSE connections
 * Manages active sessions, SSE connections, and progress state
 */
class SessionManager {
  constructor() {
    // Map of sessionId -> session data
    this.sessions = new Map();
    // Map of sessionId -> SSE response objects
    this.connections = new Map();
  }

  /**
   * Create a new batch session
   * @returns {string} sessionId - UUID for the new session
   */
  createSession() {
    const sessionId = uuidv4();
    this.sessions.set(sessionId, {
      sessionId,
      createdAt: Date.now(),
      status: 'pending', // pending | running | completed | error
      progress: {
        current: 0,
        total: 0,
        percentage: 0,
        elapsedTime: 0,
        estimatedTimeRemaining: 0,
        avgTimePerTest: 0,
        successfulTests: 0,
        failedTests: 0
      }
    });
    return sessionId;
  }

  /**
   * Get session data
   * @param {string} sessionId
   * @returns {object|null} session data or null if not found
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Update session progress
   * @param {string} sessionId
   * @param {object} progressUpdate
   */
  updateProgress(sessionId, progressUpdate) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.progress = { ...session.progress, ...progressUpdate };
      session.lastUpdated = Date.now();
    }
  }

  /**
   * Register SSE connection for a session
   * @param {string} sessionId
   * @param {object} res - Express response object
   */
  registerConnection(sessionId, res) {
    this.connections.set(sessionId, res);
  }

  /**
   * Remove SSE connection
   * @param {string} sessionId
   */
  removeConnection(sessionId) {
    this.connections.delete(sessionId);
  }

  /**
   * Get SSE connection for a session
   * @param {string} sessionId
   * @returns {object|null} Express response object or null
   */
  getConnection(sessionId) {
    return this.connections.get(sessionId) || null;
  }

  /**
   * Mark session as completed
   * @param {string} sessionId
   * @param {object} results - Final batch results
   */
  completeSession(sessionId, results) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.results = results;
      session.completedAt = Date.now();
    }
  }

  /**
   * Mark session as errored
   * @param {string} sessionId
   * @param {string} errorMessage
   */
  errorSession(sessionId, errorMessage) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'error';
      session.error = errorMessage;
      session.completedAt = Date.now();
    }
  }

  /**
   * Clean up old sessions (older than 1 hour)
   */
  cleanup() {
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now - session.createdAt;
      if (age > ONE_HOUR) {
        this.sessions.delete(sessionId);
        this.connections.delete(sessionId);
      }
    }
  }

  /**
   * Get active connection count
   * @returns {number}
   */
  getActiveConnectionCount() {
    return this.connections.size;
  }
}

// Singleton instance
const sessionManager = new SessionManager();

// Clean up old sessions every 10 minutes
setInterval(() => {
  sessionManager.cleanup();
}, 10 * 60 * 1000);

module.exports = sessionManager;
