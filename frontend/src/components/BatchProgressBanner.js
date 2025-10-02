import React from 'react';
import './BatchProgressBanner.css';

/**
 * Format time duration in human-readable format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time (e.g., "2m 30s")
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0s';

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * BatchProgressBanner component
 * Displays real-time progress for batch backtest operations
 */
function BatchProgressBanner({ progress, error, isConnected }) {
  if (!progress && !error) {
    return (
      <div className="batch-progress-banner connecting">
        <div className="progress-spinner"></div>
        <div className="progress-content">
          <div className="progress-title">Initializing batch backtest...</div>
          <div className="progress-subtitle">
            {isConnected ? 'Connected to server' : 'Connecting to server...'}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="batch-progress-banner error">
        <div className="progress-icon error-icon">⚠️</div>
        <div className="progress-content">
          <div className="progress-title">Error</div>
          <div className="progress-subtitle">{error}</div>
        </div>
      </div>
    );
  }

  const {
    current,
    total,
    percentage,
    currentSymbol,
    currentBeta,
    currentCoefficient,
    elapsedTime,
    estimatedTimeRemaining,
    successfulTests,
    failedTests,
    bestSoFar
  } = progress;

  return (
    <div className="batch-progress-banner running">
      <div className="progress-header">
        <div className="progress-title">
          Running Batch Backtest: {current} / {total} ({percentage}%)
        </div>
        <div className="progress-timing">
          <span className="elapsed">Elapsed: {formatDuration(elapsedTime)}</span>
          <span className="divider">•</span>
          <span className="eta">ETA: {formatDuration(estimatedTimeRemaining)}</span>
        </div>
      </div>

      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>

      <div className="progress-details">
        <div className="detail-row">
          <div className="detail-item">
            <span className="detail-label">Current Symbol:</span>
            <span className="detail-value">{currentSymbol || 'N/A'}</span>
          </div>

          {currentBeta !== undefined && (
            <div className="detail-item">
              <span className="detail-label">Beta:</span>
              <span className="detail-value">{currentBeta?.toFixed(2)}</span>
            </div>
          )}

          {currentCoefficient !== undefined && (
            <div className="detail-item">
              <span className="detail-label">Coefficient:</span>
              <span className="detail-value">{currentCoefficient?.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="detail-row">
          <div className="detail-item">
            <span className="detail-label">Successful:</span>
            <span className="detail-value success">{successfulTests || 0}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Failed:</span>
            <span className="detail-value error">{failedTests || 0}</span>
          </div>
        </div>

        {bestSoFar && (
          <div className="best-result">
            <div className="best-result-label">Best Result So Far:</div>
            <div className="best-result-content">
              <span className="best-symbol">{bestSoFar.symbol}</span>
              <span className="best-divider">•</span>
              <span className="best-return">
                {(bestSoFar.annualizedReturn * 100).toFixed(2)}% annualized
              </span>
              <span className="best-divider">•</span>
              <span className="best-total">
                {(bestSoFar.totalReturn * 100).toFixed(2)}% total
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BatchProgressBanner;
