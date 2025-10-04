# Real-Time Batch Progress Updates - Requirements

## Goal

Implement real-time progress updates for batch backtest operations to provide users with immediate feedback during long-running operations (5000+ parameter combinations), showing current progress, ETA, and live results as they complete.

## Why

### Business Value

- **User Experience**: Eliminate the "black box" feeling during 10-15 minute batch operations
- **Trust & Transparency**: Users can see the system is working and not frozen
- **Time Efficiency**: Users can gauge completion time and plan accordingly
- **Early Results**: View best results before full completion
- **Error Visibility**: Detect and abort failing batches early

### User Pain Points (from requests.txt)

> "I ran a batch with +5000 combination, it takes a while without seeing any update on the UI"

**Current Experience:**

1. Click "Run Batch Optimization" → Loading spinner appears
2. Wait 10-15 minutes with NO feedback
3. Suddenly results appear (or timeout error)
4. Cannot tell if system is working or hung

**Desired Experience:**

1. Click "Run Batch Optimization" → Progress bar appears
2. See real-time updates: "Testing NVDA (2458 of 5000) - 49.2% complete"
3. View ETA: "~6 minutes 23 seconds remaining"
4. Preview best result so far
5. Smooth completion with all results

### Integration Points

- Works with existing `batchBacktestService.js` progress callback (line 253-258)
- Enhances loading banner in `App.js` (line 337-342)
- Maintains backward compatibility with existing batch endpoint

## What

### User-Visible Behavior

**Progress Display Components:**

1. **Progress Bar** (0-100%)
   - Visual bar with percentage text
   - Smooth animation between updates
   - Color-coded (blue = processing, green = complete)

2. **Status Information**
   - Current symbol being tested: "NVDA"
   - Test counter: "2458 of 5000"
   - Current parameters: "Beta: 2.1, Coeff: 1.5" (if Beta scaling enabled)

3. **Timing Estimates**
   - Elapsed time: "5m 32s"
   - Estimated remaining: "~6m 23s"
   - Average time per test: "149ms"
   - Updates every 1-2 seconds

4. **Results Summary**
   - Successful tests: 2457
   - Failed tests: 1
   - Current best result: "TSLA - 48.7% annual return"

5. **Error Handling**
   - Connection lost: Show "Reconnecting..." message
   - Timeout: Show "Operation timed out after 15 minutes"
   - Server error: Display error message with option to retry

### Technical Requirements

**Backend (Express.js):**

- New SSE endpoint: `GET /api/backtest/batch/stream`
- Modify existing progress callback to emit SSE events
- Support session management for multiple concurrent batches
- Implement timeout protection (15-minute max)
- Handle client disconnection gracefully

**Frontend (React):**

- Use EventSource API for SSE consumption
- Enhanced loading UI with progress details
- Real-time state updates via React hooks
- Cleanup on component unmount
- Error recovery and reconnection logic

**Data Flow:**

```
User clicks "Run Batch"
  ↓
POST /api/backtest/batch (initiate)
  ↓
Receive sessionId in response
  ↓
Open SSE connection: /api/backtest/batch/stream?sessionId={id}
  ↓
Receive progress events every 1-2 seconds
  ↓
Display updated progress UI
  ↓
Receive 'complete' event with final results
  ↓
Close SSE connection
  ↓
Display BatchResults component
```

## All Needed Context

### Documentation & References

**External Resources:**

- **MDN EventSource API**: https://developer.mozilla.org/en-US/docs/Web/API/EventSource
- **MDN Using SSE**: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
- **better-sse library**: https://matthewwid.github.io/better-sse/
- **Material-UI Progress**: https://mui.com/material-ui/react-progress/
- **Express SSE Tutorial**: https://www.digitalocean.com/community/tutorials/nodejs-server-sent-events-build-realtime-app

**Codebase Files:**

- **Backend Service**: `backend/services/batchBacktestService.js` (progress callback exists)
- **API Endpoint**: `backend/server.js` (lines 1060-1110 - batch endpoint)
- **Frontend App**: `frontend/src/App.js` (loading state management)
- **Loading UI**: `frontend/src/App.css` (existing spinner styles)
- **Batch Results**: `frontend/src/components/BatchResults.js`

**Spec References:**

- `.kiro/specs/batch-data-refresh-and-parameter-revert-fix/requirements.md` (Requirement 4: progress indicators)
- `.kiro/specs/url-based-backtest-configuration/` (URL parameter patterns)

### Current Codebase Context

```
backend/
├── server.js (line 1060-1110: batch endpoint)
├── services/
│   ├── batchBacktestService.js (line 253-258: progress callback exists)
│   └── shortBatchBacktestService.js (similar pattern)
frontend/
└── src/
    ├── App.js (line 17: loading state, line 337-342: loading banner)
    ├── App.css (line 129-148: loading spinner styles)
    └── components/
        └── BatchResults.js (displays final results)
```

### Implementation Patterns from Codebase

**Existing Progress Callback (batchBacktestService.js:253-258):**

```javascript
if (progressCallback) {
  progressCallback({
    current: i + 1, // 1-based index
    total: combinations.length,
    currentParams: params, // Full parameter object
    symbol: params.symbol,
  });
}
```

**Current API Pattern (server.js:1060-1110):**

```javascript
app.post('/api/backtest/batch', validation.validateBatchBacktestParams, async (req, res) => {
  let progressData = null;
  const progressCallback = progress => {
    progressData = progress;
    // Could implement WebSocket or Server-Sent Events here for real-time updates
  };

  const results = await runBatchBacktest(options, progressCallback);

  res.json({
    success: true,
    executionTimeMs: executionTime,
    data: results,
  });
});
```

**Frontend Loading Pattern (App.js:183-286):**

```javascript
const handleBacktestSubmit = async (parameters, isBatchMode = false) => {
  setLoading(true);
  setError(null);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parameters),
    });

    const result = await response.json();
    setBatchData(result.data);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### Known Gotchas

**Server-Sent Events (SSE) Specific:**

1. **Browser Connection Limit**: Maximum 6 concurrent SSE connections per domain (HTTP/1.1)
   - Solution: Limit concurrent batch operations or use HTTP/2

2. **Nginx Buffering**: Nginx reverse proxy buffers by default, preventing SSE
   - Solution: Set `X-Accel-Buffering: no` header in Express response

3. **CORS with EventSource**: Cannot use `*` wildcard with credentials
   - Solution: Specify exact origin in CORS configuration

4. **Connection Cleanup**: EventSource doesn't close on React unmount without cleanup
   - Solution: Always call `eventSource.close()` in useEffect cleanup

**Express.js Specific:** 5. **Response Already Sent**: Cannot send SSE after calling `res.json()`

- Solution: Use separate endpoint for streaming vs final results

6. **Memory Leaks**: Open SSE connections hold resources
   - Solution: Track connections and clean up on client disconnect

**React Specific:** 7. **State Updates After Unmount**: EventSource events trigger after component unmounts

- Solution: Use cleanup function and check mounted state

8. **Rapid Re-renders**: Progress updates every 100ms can cause performance issues
   - Solution: Throttle state updates to max 1-2 per second

**Testing:** 9. **EventSource Not in Node.js**: Native EventSource only in browsers

- Solution: Use `eventsource` npm package for backend tests

## Implementation Blueprint

### Data Models and Structure

**Progress Event Payload (TypeScript-style):**

```typescript
interface ProgressEvent {
  type: 'progress' | 'complete' | 'error';
  sessionId: string;

  // Progress tracking
  current: number; // Current test number (1-indexed)
  total: number; // Total tests
  percentage: number; // 0-100

  // Current test details
  currentSymbol: string; // e.g., "NVDA"
  currentBeta?: number; // If Beta scaling enabled
  currentCoefficient?: number;

  // Timing information
  estimatedTimeRemaining: number; // Seconds
  elapsedTime: number; // Seconds
  avgTimePerTest: number; // Seconds

  // Results summary
  successfulTests: number;
  failedTests: number;

  // Best result preview (optional)
  bestSoFar?: {
    symbol: string;
    annualizedReturn: number; // Decimal (0.487 = 48.7%)
    totalReturn: number; // Decimal
  };
}

interface CompleteEvent {
  type: 'complete';
  sessionId: string;
  results: BatchBacktestResults; // Existing result structure
}

interface ErrorEvent {
  type: 'error';
  sessionId: string;
  error: string;
  code?: 'TIMEOUT' | 'INTERNAL_ERROR' | 'CONNECTION_LOST';
}
```

**Session Management:**

```typescript
interface BatchSession {
  id: string; // UUID
  startTime: number; // Timestamp
  parameters: BatchParameters;
  response: ServerResponse; // SSE response object
  status: 'running' | 'complete' | 'error';
  lastUpdate: number; // Timestamp
}

// In-memory session store
const activeSessions = new Map<string, BatchSession>();
```

### Task List

#### Phase 1: Backend SSE Infrastructure

1. ✅ Install dependencies (none required - native Express support)
2. ⬜ Create session management utility (`backend/utils/sessionManager.js`)
3. ⬜ Add SSE helper functions (`backend/utils/sseHelpers.js`)
4. ⬜ Create new SSE endpoint `GET /api/backtest/batch/stream` in `server.js`
5. ⬜ Modify progress callback in `batchBacktestService.js` to emit SSE events
6. ⬜ Add timeout protection (15-minute max)
7. ⬜ Implement connection cleanup on client disconnect
8. ⬜ Add error handling for SSE failures

#### Phase 2: Frontend Progress State

9. ⬜ Create custom hook `useSSEProgress` in `frontend/src/hooks/`
10. ⬜ Add progress state to `App.js`
11. ⬜ Create `BatchProgressBanner` component
12. ⬜ Add CSS styles for progress bar and details
13. ⬜ Implement EventSource connection management
14. ⬜ Add error handling and recovery logic

#### Phase 3: Integration

15. ⬜ Modify `handleBacktestSubmit` to initiate SSE connection
16. ⬜ Connect progress events to UI state updates
17. ⬜ Test with small batch (10 tests)
18. ⬜ Test with medium batch (100 tests)
19. ⬜ Test connection interruption and recovery
20. ⬜ Verify cleanup prevents memory leaks

#### Phase 4: Polish & Optimization

21. ⬜ Add ETA calculation based on running average
22. ⬜ Implement best result preview
23. ⬜ Add throttling for UI updates (max 1-2 per second)
24. ⬜ Optimize for large batches (5000+ tests)
25. ⬜ Add analytics/logging for monitoring

#### Phase 5: Testing & Validation

26. ⬜ Write unit tests for SSE helpers
27. ⬜ Write integration tests for progress flow
28. ⬜ Test cross-browser compatibility (Chrome, Firefox, Safari)
29. ⬜ Load test with 50+ concurrent batch operations
30. ⬜ Memory profiling for leak detection

### Pseudocode

**Backend: SSE Endpoint (`server.js`)**

```javascript
// Session storage
const activeBatchSessions = new Map();

// SSE endpoint
app.get('/api/backtest/batch/stream', (req, res) => {
  const sessionId = req.query.sessionId;

  if (!activeBatchSessions.has(sessionId)) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx compatibility

  // Store response object for this session
  const session = activeBatchSessions.get(sessionId);
  session.response = res;
  session.isConnected = true;

  // Send initial connection event
  sendSSE(res, 'connected', { sessionId, message: 'Connected to progress stream' });

  // Keep-alive heartbeat (every 30 seconds)
  const heartbeatInterval = setInterval(() => {
    if (session.isConnected) {
      res.write(':\n\n'); // SSE comment (ignored by client)
    }
  }, 30000);

  // Cleanup on client disconnect
  req.on('close', () => {
    console.log(`Client disconnected from session ${sessionId}`);
    clearInterval(heartbeatInterval);
    session.isConnected = false;

    // Keep session for potential reconnection (5 minutes)
    setTimeout(() => {
      if (session.status === 'complete') {
        activeBatchSessions.delete(sessionId);
      }
    }, 300000);
  });
});

// Modified batch endpoint - now initiates SSE
app.post('/api/backtest/batch', validation.validateBatchBacktestParams, async (req, res) => {
  const sessionId = uuidv4();
  const startTime = Date.now();

  // Create session
  const session = {
    id: sessionId,
    startTime,
    parameters: req.body,
    response: null,
    isConnected: false,
    status: 'running',
    lastUpdate: startTime,
  };

  activeBatchSessions.set(sessionId, session);

  // Return session ID immediately
  res.json({
    success: true,
    sessionId,
    message:
      'Batch processing started. Connect to /api/backtest/batch/stream?sessionId=' + sessionId,
  });

  // Process batch asynchronously
  processBatchAsync(sessionId, req.body).catch(error => {
    if (session.isConnected && session.response) {
      sendSSE(session.response, 'error', {
        sessionId,
        error: error.message,
        code: 'INTERNAL_ERROR',
      });
      session.response.end();
    }
    session.status = 'error';
  });
});

// Async batch processing
async function processBatchAsync(sessionId, parameters) {
  const session = activeBatchSessions.get(sessionId);
  const startTime = Date.now();
  let testTimes = [];

  const progressCallback = progress => {
    if (!session.isConnected || !session.response) return;

    // Calculate timing metrics
    const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    testTimes.push(Date.now() - (session.lastUpdate || startTime));
    session.lastUpdate = Date.now();

    const avgTimePerTest = testTimes.reduce((a, b) => a + b, 0) / testTimes.length / 1000;
    const testsRemaining = progress.total - progress.current;
    const estimatedTimeRemaining = Math.ceil(testsRemaining * avgTimePerTest);

    // Send progress event
    sendSSE(session.response, 'progress', {
      sessionId,
      current: progress.current,
      total: progress.total,
      percentage: Math.round((progress.current / progress.total) * 100),
      currentSymbol: progress.symbol,
      currentBeta: progress.currentParams.beta,
      currentCoefficient: progress.currentParams.coefficient,
      estimatedTimeRemaining,
      elapsedTime,
      avgTimePerTest: avgTimePerTest.toFixed(3),
      successfulTests: progress.current - 1, // Simplified
      failedTests: 0,
      bestSoFar: session.bestResult || null,
    });
  };

  // Run batch with progress callback
  const results = await runBatchBacktest({
    ...parameters,
    progressCallback,
  });

  // Send completion event
  if (session.isConnected && session.response) {
    sendSSE(session.response, 'complete', {
      sessionId,
      results,
    });
    session.response.end();
  }

  session.status = 'complete';
}

// SSE helper function
function sendSSE(res, eventType, data) {
  res.write(`event: ${eventType}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
```

**Frontend: SSE Connection Hook (`hooks/useSSEProgress.js`)**

```javascript
import { useState, useEffect, useRef } from 'react';

export function useSSEProgress(sessionId) {
  const [progress, setProgress] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;

    const eventSource = new EventSource(
      `http://localhost:3001/api/backtest/batch/stream?sessionId=${sessionId}`
    );

    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', event => {
      const data = JSON.parse(event.data);
      console.log('SSE Connected:', data.message);
      setIsConnected(true);
      setError(null);
    });

    eventSource.addEventListener('progress', event => {
      const progressData = JSON.parse(event.data);
      setProgress(progressData);
    });

    eventSource.addEventListener('complete', event => {
      const completeData = JSON.parse(event.data);
      setResults(completeData.results);
      setIsConnected(false);
      eventSource.close();
    });

    eventSource.addEventListener('error', event => {
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('SSE connection closed');
        setIsConnected(false);
      } else {
        const errorData = event.data ? JSON.parse(event.data) : null;
        setError(errorData?.error || 'Connection error');
        setIsConnected(false);
        eventSource.close();
      }
    });

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setIsConnected(false);
      }
    };

    // Cleanup on unmount
    return () => {
      if (eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
      }
    };
  }, [sessionId]);

  return { progress, results, isConnected, error };
}
```

**Frontend: Progress Banner Component**

```javascript
// components/BatchProgressBanner.js
import React from 'react';
import './BatchProgressBanner.css';

export function BatchProgressBanner({ progress, onCancel }) {
  if (!progress) return null;

  const formatTime = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="batch-progress-banner">
      {/* Progress Bar */}
      <div className="progress-container">
        <div className="progress-bar" style={{ width: `${progress.percentage}%` }}>
          {progress.percentage.toFixed(1)}%
        </div>
      </div>

      {/* Status Information */}
      <div className="progress-details">
        <div className="progress-main">
          <span className="progress-icon">🔄</span>
          <span className="progress-text">
            Testing {progress.currentSymbol}({progress.current.toLocaleString()} of{' '}
            {progress.total.toLocaleString()})
            {progress.currentBeta &&
              ` - Beta: ${progress.currentBeta.toFixed(2)}, Coeff: ${progress.currentCoefficient}`}
          </span>
        </div>

        {/* Timing */}
        <div className="progress-timing">
          <span>⏱️ Elapsed: {formatTime(progress.elapsedTime)}</span>
          <span>⏳ Remaining: ~{formatTime(progress.estimatedTimeRemaining)}</span>
          <span>⚡ {(progress.avgTimePerTest * 1000).toFixed(0)}ms/test</span>
        </div>

        {/* Results Summary */}
        <div className="progress-results">
          <span className="success">✅ {progress.successfulTests}</span>
          {progress.failedTests > 0 && <span className="failed">❌ {progress.failedTests}</span>}
        </div>

        {/* Best Result Preview */}
        {progress.bestSoFar && (
          <div className="progress-best">
            <span className="best-label">Current Best:</span>
            <span className="best-symbol">{progress.bestSoFar.symbol}</span>
            <span className="best-return">
              {(progress.bestSoFar.annualizedReturn * 100).toFixed(1)}% annual
            </span>
          </div>
        )}
      </div>

      {/* Cancel Button (optional) */}
      {onCancel && (
        <button onClick={onCancel} className="cancel-button">
          Cancel
        </button>
      )}
    </div>
  );
}
```

**Frontend: Integration in App.js**

```javascript
import { useSSEProgress } from './hooks/useSSEProgress';
import { BatchProgressBanner } from './components/BatchProgressBanner';

const handleBacktestSubmit = async (parameters, isBatchMode = false) => {
  if (!isBatchMode) {
    // Existing single backtest logic
    return;
  }

  setLoading(true);
  setError(null);
  setBatchData(null);

  try {
    // Initiate batch processing
    const response = await fetch('http://localhost:3001/api/backtest/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parameters),
    });

    const { sessionId } = await response.json();
    setBatchSessionId(sessionId); // Triggers SSE connection via hook
  } catch (err) {
    setError(err.message);
    setLoading(false);
  }
};

// In component body
const { progress, results, isConnected, error: sseError } = useSSEProgress(batchSessionId);

// Update batch data when results arrive
useEffect(() => {
  if (results) {
    setBatchData(results);
    setLoading(false);
    setActiveTab('results');
  }
}, [results]);

// Handle SSE errors
useEffect(() => {
  if (sseError) {
    setError(sseError);
    setLoading(false);
  }
}, [sseError]);

// In JSX
{
  loading && testMode === 'batch' && (
    <BatchProgressBanner
      progress={progress}
      onCancel={() => {
        // Cancel logic
        setBatchSessionId(null);
        setLoading(false);
      }}
    />
  );
}
```

### Integration Points

**1. Database Integration:** None required (uses existing batch service)

**2. Configuration:** None required (uses existing validation)

**3. Routes:**

- **New**: `GET /api/backtest/batch/stream` (SSE endpoint)
- **Modified**: `POST /api/backtest/batch` (returns sessionId)

**4. Frontend State Management:**

- **New State**: `batchSessionId`, `sseProgress`
- **Modified**: `loading` logic for batch operations

**5. Backward Compatibility:**

- Keep existing batch endpoint behavior
- SSE is opt-in based on presence of sessionId
- Graceful degradation if EventSource not supported

## Validation Loop

### Level 1: Syntax & Style

```bash
# Backend
cd backend
npm run lint
npm run test

# Frontend
cd frontend
npm run lint
npm run test
```

**Expected:** No linting errors, existing tests pass

### Level 2: Unit Tests

```bash
# Backend SSE helpers
cd backend
npm test -- utils/__tests__/sseHelpers.test.js

# Frontend progress hook
cd frontend
npm test -- hooks/__tests__/useSSEProgress.test.js
```

**Expected:**

- SSE event formatting is correct
- Progress calculations are accurate
- EventSource cleanup prevents memory leaks

### Level 3: Integration Tests

**Manual Testing Steps:**

1. **Small Batch (10 tests):**

   ```
   - Navigate to batch mode
   - Configure: 2 symbols × 5 parameter combinations
   - Click "Run Batch Optimization"
   - Verify: Progress bar updates smoothly
   - Verify: ETA appears and counts down
   - Verify: Results display at completion
   ```

2. **Medium Batch (100 tests):**

   ```
   - Configure: 5 symbols × 20 parameter combinations
   - Run batch
   - Verify: Progress updates every 1-2 seconds
   - Verify: Current symbol changes as tests progress
   - Verify: Best result preview updates
   ```

3. **Connection Interruption:**

   ```
   - Start large batch
   - Open DevTools Network tab
   - Throttle connection to "Slow 3G"
   - Verify: Connection maintains or reconnects
   - Verify: Progress resumes after reconnection
   ```

4. **Tab Switch:**

   ```
   - Start batch
   - Switch to different browser tab
   - Wait 30 seconds
   - Switch back
   - Verify: Progress continues updating
   ```

5. **Browser Refresh:**
   ```
   - Start batch
   - Refresh browser mid-process
   - Verify: Shows error or allows reconnection
   ```

### Level 4: Performance Tests

```bash
# Load testing (if Artillery installed)
artillery run backend/tests/performance/batch-sse-load.yml
```

**Performance Targets:**

- Support 50+ concurrent batch operations
- SSE message delivery < 200ms latency
- Memory usage increase < 50MB per 100 operations
- No memory leaks after 1000 operations

## Final Validation Checklist

**Functionality:**

- [ ] Progress bar displays and updates correctly
- [ ] Percentage calculation is accurate (current/total × 100)
- [ ] ETA calculation is reasonable (based on running average)
- [ ] Current symbol displays correctly
- [ ] Best result preview updates
- [ ] Completion event triggers results display
- [ ] Error events display error messages

**Error Handling:**

- [ ] Connection loss shows reconnecting message
- [ ] Timeout after 15 minutes shows error
- [ ] Server error shows user-friendly message
- [ ] EventSource cleanup on component unmount
- [ ] Session cleanup after completion

**Performance:**

- [ ] UI remains responsive during updates
- [ ] No memory leaks (tested with Chrome DevTools)
- [ ] Works with 5000+ test combinations
- [ ] Update frequency throttled (1-2 per second)
- [ ] Concurrent batches don't interfere

**Compatibility:**

- [ ] Works in Chrome, Firefox, Safari, Edge
- [ ] Graceful degradation for old browsers
- [ ] Works through Nginx reverse proxy (if deployed)
- [ ] CORS headers configured correctly

**User Experience:**

- [ ] Progress is visible immediately after starting
- [ ] No "black box" feeling during operation
- [ ] Can estimate completion time
- [ ] Can see best results before completion
- [ ] Clear error messages if something fails

**Backward Compatibility:**

- [ ] Existing batch endpoint still works without SSE
- [ ] Existing batch results display unchanged
- [ ] No breaking changes to API contracts
- [ ] URL parameter sharing still works

## Success Metrics

**Quantitative:**

- Progress updates delivered within 200ms
- Zero memory leaks after 1000 operations
- 99% uptime for SSE connections
- < 5 second reconnection time

**Qualitative:**

- Users can see progress during long batches
- Users can estimate completion time
- Users feel system is responsive
- Reduced support requests about "frozen" batches

## Implementation Timeline

- **Phase 1** (Backend): 6-8 hours
- **Phase 2** (Frontend): 6-8 hours
- **Phase 3** (Integration): 3-4 hours
- **Phase 4** (Polish): 3-4 hours
- **Phase 5** (Testing): 4-6 hours

**Total: 22-30 hours** (~3-4 days)
