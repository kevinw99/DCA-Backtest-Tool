# Design Document

## Overview

The URL-based backtest configuration system will extend the existing React application with URL parameter management, enabling shareable and reproducible backtest configurations. The design implements URL state synchronization while preserving existing localStorage persistence functionality.

## Architecture

### URL Structure Design

**Parameter Page:**

```
http://localhost:3000/
```

**Single Backtest Results:**

```
http://localhost:3000/backtest?symbol=AAPL&startDate=2020-01-01&endDate=2023-12-31&lotSizeUsd=10000&maxLots=10&maxLotsToSell=1&gridIntervalPercent=10&profitRequirement=5&trailingBuyActivationPercent=10&trailingBuyReboundPercent=5&trailingSellActivationPercent=20&trailingSellPullbackPercent=10&mode=single
```

**Batch Optimization Results:**

```
http://localhost:3000/batch?symbols=AAPL&startDate=2020-01-01&endDate=2023-12-31&lotSizeUsd=10000&maxLots=10&maxLotsToSell=1&profitRequirement=5,8,10&gridIntervalPercent=10,15,20&trailingBuyActivationPercent=10,15&trailingBuyReboundPercent=5&trailingSellActivationPercent=20,25&trailingSellPullbackPercent=10&mode=batch
```

**Batch Result Row (Single Test from Batch):**

```
http://localhost:3000/backtest?symbol=AAPL&startDate=2020-01-01&endDate=2023-12-31&lotSizeUsd=10000&maxLots=10&maxLotsToSell=1&gridIntervalPercent=10&profitRequirement=5&trailingBuyActivationPercent=10&trailingBuyReboundPercent=5&trailingSellActivationPercent=20&trailingSellPullbackPercent=10&mode=single&source=batch
```

### State Management Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   URL Params    │◄──►│  React State    │◄──►│  localStorage   │
│                 │    │                 │    │                 │
│ - Query string  │    │ - Form values   │    │ - Persistence   │
│ - Route params  │    │ - Results data  │    │ - Backup store  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Components and Interfaces

### URL Parameter Manager

**Purpose:** Centralized URL parameter handling service

**Interface:**

```javascript
class URLParameterManager {
  // Encode current form state to URL parameters
  encodeParametersToURL(parameters, mode)

  // Decode URL parameters to form state
  decodeParametersFromURL()

  // Update URL without triggering navigation
  updateURL(path, parameters)

  // Check if current URL contains backtest parameters
  hasBacktestParameters()

  // Navigate to results page with parameters
  navigateToResults(parameters, mode)

  // Navigate back to parameter page
  navigateToParameterPage()
}
```

### Enhanced App Component

**Modifications:**

- Add React Router for URL routing
- Implement URL parameter detection on component mount
- Handle browser back/forward navigation
- Coordinate between URL state and component state

**New Routes:**

- `/` - Parameter page (default)
- `/backtest` - Single backtest results with URL parameters
- `/batch` - Batch optimization results with URL parameters

### Enhanced DCABacktestForm Component

**Modifications:**

- Detect URL parameters on mount and populate form
- Update localStorage when URL parameters are loaded
- Prevent URL updates during form editing
- Trigger URL updates only on "Run Backtest" or "Run Batch Optimization"

### Enhanced Results Components

**BacktestResults Modifications:**

- Accept parameters from URL props
- Display parameter source (form vs URL) for debugging
- Provide "Share URL" functionality

**BatchResults Modifications:**

- Generate URLs for individual result rows
- Handle row clicks to navigate to single backtest URLs
- Display batch configuration in URL format

## Data Models

### Parameter Encoding Schema

**Single Backtest Parameters:**

```javascript
{
  symbol: string,
  startDate: string (YYYY-MM-DD),
  endDate: string (YYYY-MM-DD),
  lotSizeUsd: number,
  maxLots: number,
  maxLotsToSell: number,
  gridIntervalPercent: number,
  profitRequirement: number,
  trailingBuyActivationPercent: number,
  trailingBuyReboundPercent: number,
  trailingSellActivationPercent: number,
  trailingSellPullbackPercent: number,
  strategyMode: string ('long'|'short'),
  mode: 'single'
}
```

**Batch Parameters:**

```javascript
{
  symbols: array[string],
  startDate: string (YYYY-MM-DD),
  endDate: string (YYYY-MM-DD),
  lotSizeUsd: number,
  maxLots: number,
  maxLotsToSell: number,
  profitRequirement: array[number],
  gridIntervalPercent: array[number],
  trailingBuyActivationPercent: array[number],
  trailingBuyReboundPercent: array[number],
  trailingSellActivationPercent: array[number],
  trailingSellPullbackPercent: array[number],
  coefficients: array[number],
  enableBetaScaling: boolean,
  strategyMode: string ('long'|'short'),
  mode: 'batch'
}
```

### Server Logging Schema

**Request Log Format:**

```javascript
{
  timestamp: string,
  endpoint: string,
  method: string,
  urlParameters: object,
  formParameters: object,
  parameterSource: 'url' | 'form' | 'mixed',
  clientIP: string,
  userAgent: string
}
```

## Error Handling

### URL Parameter Validation

**Client-Side Validation:**

- Validate parameter types and ranges before URL encoding
- Provide fallback values for invalid parameters
- Display validation errors to user

**Server-Side Validation:**

- Validate all incoming URL parameters
- Log validation failures with details
- Return appropriate error responses for invalid parameters

### Navigation Error Handling

**Browser Compatibility:**

- Handle browsers that don't support History API
- Graceful degradation for older browsers
- Fallback to hash-based routing if needed

**State Synchronization Errors:**

- Detect and resolve conflicts between URL, localStorage, and form state
- Implement recovery mechanisms for corrupted state
- Log state synchronization issues for debugging

## Testing Strategy

### Unit Tests

**URL Parameter Manager:**

- Test parameter encoding/decoding accuracy
- Test URL generation for all parameter combinations
- Test parameter validation and error handling

**Component Integration:**

- Test form population from URL parameters
- Test localStorage synchronization
- Test navigation state management

### Integration Tests

**End-to-End URL Workflows:**

- Test complete single backtest URL sharing workflow
- Test complete batch optimization URL sharing workflow
- Test batch result row URL generation and navigation

**Cross-Browser Testing:**

- Test URL functionality across major browsers
- Test browser back/forward button handling
- Test URL copying and pasting between browser sessions

### Server Logging Tests

**Parameter Logging:**

- Verify all URL parameters are logged correctly
- Test log format consistency
- Test log rotation and storage

**Debug Information:**

- Verify parameter source identification
- Test error condition logging
- Validate log searchability for debugging
