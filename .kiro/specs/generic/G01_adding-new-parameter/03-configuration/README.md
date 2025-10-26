# G03: Configuration and Defaults

## Overview

This guide covers adding default values for new parameters in configuration files, ensuring consistent behavior across all backtests.

## Configuration File Hierarchy

```
1. Global Defaults (backtestDefaults.json)
   ↓
2. Ticker-Specific Defaults (tickerDefaults/[SYMBOL].json)
   ↓
3. User-Provided Values (from UI or API request)
```

## Step 1: Add to Global Defaults

### Location
File: `/Users/kweng/AI/DCA-Backtest-Tool/config/backtestDefaults.json`

### 1.1: Identify Strategy Sections

The file contains separate configuration sections for each strategy:
- `longStrategy` - Long DCA strategy
- `shortStrategy` - Short selling strategy
- `portfolioBacktest` - Portfolio-level backtests

### 1.2: Add Parameter to All Relevant Strategies

**Example (Momentum Mode - Boolean Parameters):**

```json
{
  "longStrategy": {
    "maxLots": 10,
    "maxLotsToSell": 1,
    "lotSizeUsd": 10000,
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10,

    // ... other parameters ...

    "enableAverageBasedGrid": false,
    "enableAverageBasedSell": false,
    "enableDynamicProfile": false,

    "momentumBasedBuy": false,        // NEW: Add here
    "momentumBasedSell": false,       // NEW: Add here

    "trailingStopOrderType": "market"
  },

  "shortStrategy": {
    // ... short strategy parameters ...

    "momentumBasedBuy": false,        // NEW: Add here too if applicable
    "momentumBasedSell": false
  },

  "portfolioBacktest": {
    // ... portfolio parameters ...
  }
}
```

### 1.3: Parameter Type Guidelines

**Boolean Parameters:**
```json
"enableFeatureX": false,           // Default to disabled for safety
"requireConfirmation": true        // Default to enabled if critical
```

**Percentage Parameters (Backend Format - Decimals):**
```json
"gridIntervalPercent": 0.10,       // 10% in decimal form
"profitRequirement": 0.10,         // 10% in decimal form
"thresholdPercent": 0.05           // 5% in decimal form
```

**Numeric Parameters:**
```json
"maxRetries": 5,
"batchSize": 100,
"timeoutSeconds": 30
```

**String Parameters:**
```json
"orderType": "market",             // Use lowercase for consistency
"strategyMode": "long",
"executionMode": "standard"
```

### 1.4: Placement in Configuration

**Best Practice**: Group related parameters together and add comments.

**Example:**
```json
{
  "longStrategy": {
    // === Basic Strategy Parameters ===
    "maxLots": 10,
    "lotSizeUsd": 10000,

    // === Grid Spacing ===
    "gridIntervalPercent": 0.10,

    // === Profit Requirements ===
    "profitRequirement": 0.10,

    // === Trailing Stop Buy ===
    "trailingBuyActivationPercent": 0.10,
    "trailingBuyReboundPercent": 0.05,

    // === Trailing Stop Sell ===
    "trailingSellActivationPercent": 0.20,
    "trailingSellPullbackPercent": 0.10,

    // === Advanced Features ===
    "enableDynamicGrid": false,
    "enableAverageBasedGrid": false,
    "enableAverageBasedSell": false,
    "enableDynamicProfile": false,

    // === Spec 45: Momentum-Based Trading ===
    "momentumBasedBuy": false,
    "momentumBasedSell": false,

    // === Order Execution ===
    "trailingStopOrderType": "market"
  }
}
```

## Step 2: Add Ticker-Specific Defaults (Optional)

### When to Use Ticker-Specific Defaults

Use ticker-specific defaults when:
- A stock requires special parameter values (high volatility, low price, etc.)
- You want to override global defaults for specific symbols
- Testing has shown certain parameters work better for specific stocks

### Location
Directory: `/Users/kweng/AI/DCA-Backtest-Tool/config/tickerDefaults/`

### 2.1: Create or Update Ticker Configuration

**Example: TSLA.json**
```json
{
  "symbol": "TSLA",
  "longStrategy": {
    "gridIntervalPercent": 0.15,      // Higher grid for TSLA volatility
    "profitRequirement": 0.12,        // Higher profit target
    "momentumBasedBuy": true,         // Enable momentum for growth stock
    "momentumBasedSell": false
  }
}
```

**Example: PLTR.json**
```json
{
  "symbol": "PLTR",
  "longStrategy": {
    "gridIntervalPercent": 0.10,
    "profitRequirement": 0.10,
    "momentumBasedBuy": true,         // Good for momentum trading
    "momentumBasedSell": true
  }
}
```

### 2.2: Ticker Default Precedence

The configuration merging follows this priority (highest to lowest):
1. User-provided values (from UI or API request)
2. Ticker-specific defaults (tickerDefaults/[SYMBOL].json)
3. Global defaults (backtestDefaults.json)
4. Hardcoded fallbacks (in code)

## Step 3: Verify Configuration Loading

### 3.1: Test Default Values

**Test with minimal API request** (should use defaults):
```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "TSLA",
    "startDate": "2024-01-01",
    "endDate": "2024-03-31"
  }' | jq '.data.parameters'
```

**Expected Result**: Response should include default values for all parameters.

### 3.2: Test Ticker-Specific Overrides

**Test with ticker that has custom defaults:**
```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "PLTR",
    "startDate": "2024-01-01",
    "endDate": "2024-03-31"
  }' | jq '.data.parameters.momentumBasedBuy'
```

**Expected Result**: Should return ticker-specific value, not global default.

### 3.3: Test User Override

**Test that user values override all defaults:**
```bash
curl -X POST http://localhost:3001/api/backtest/dca \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "TSLA",
    "momentumBasedBuy": true,
    "startDate": "2024-01-01",
    "endDate": "2024-03-31"
  }' | jq '.data.parameters.momentumBasedBuy'
```

**Expected Result**: Should return `true` (user-provided value).

## Configuration Format Reference

### Percentage Parameters

**JSON Format (Backend):**
```json
"gridIntervalPercent": 0.10        // 10% as decimal
```

**JavaScript Format (Code):**
```javascript
gridIntervalPercent = 0.10         // 10% as decimal
```

**URL Format (Frontend):**
```
?gridIntervalPercent=10            // 10% as whole number
```

### Boolean Parameters

**JSON Format:**
```json
"momentumBasedBuy": false
```

**JavaScript Format:**
```javascript
momentumBasedBuy = false
```

**URL Format:**
```
?momentumBasedBuy=false            // String "false"
```

### Numeric Parameters

**JSON Format:**
```json
"maxLots": 10
```

**JavaScript Format:**
```javascript
maxLots = 10
```

**URL Format:**
```
?maxLots=10
```

## Common Configuration Pitfalls

### Pitfall 1: Wrong Decimal Format for Percentages
**Wrong:**
```json
"gridIntervalPercent": 10          // Backend expects decimal, not whole number
```

**Correct:**
```json
"gridIntervalPercent": 0.10        // 10% as 0.10
```

### Pitfall 2: Inconsistent Defaults Across Strategies
**Problem**: Adding parameter to `longStrategy` but forgetting `shortStrategy`.

**Solution**: Add to ALL strategy sections where applicable:
```json
{
  "longStrategy": {
    "momentumBasedBuy": false
  },
  "shortStrategy": {
    "momentumBasedBuy": false      // Don't forget!
  }
}
```

### Pitfall 3: Missing Comments
**Problem**: Configuration becomes hard to understand.

**Solution**: Add descriptive comments:
```json
{
  // Spec 45: Momentum-Based Trading
  // Enables buying on strength (uptrends) instead of weakness (downtrends)
  "momentumBasedBuy": false,

  // Spec 45: Momentum-Based Selling
  // Enables immediate sell consideration (0% activation) for quick exits
  "momentumBasedSell": false
}
```

### Pitfall 4: Invalid JSON Syntax
**Problem**: Trailing commas, missing quotes, etc.

**Solution**: Validate JSON after editing:
```bash
cat config/backtestDefaults.json | jq '.'
```

If valid, jq will pretty-print the JSON. If invalid, it will show an error.

## Configuration Checklist

- [ ] Added parameter to `backtestDefaults.json` for `longStrategy`
- [ ] Added parameter to `backtestDefaults.json` for `shortStrategy` (if applicable)
- [ ] Added parameter to `backtestDefaults.json` for `portfolioBacktest` (if applicable)
- [ ] Used correct format (decimal for percentages, boolean for flags, etc.)
- [ ] Added descriptive comments explaining the parameter
- [ ] Validated JSON syntax with `jq`
- [ ] Created ticker-specific defaults if needed
- [ ] Tested default value loading with minimal API request
- [ ] Tested ticker-specific override (if applicable)
- [ ] Tested user value override

## Real-World Example

See Spec 45 momentum mode implementation:

**Global Defaults (backtestDefaults.json):**
```json
{
  "longStrategy": {
    "momentumBasedBuy": false,
    "momentumBasedSell": false
  }
}
```

**Ticker-Specific Default (PLTR.json):**
```json
{
  "symbol": "PLTR",
  "longStrategy": {
    "momentumBasedBuy": true,    // Override for growth stock
    "momentumBasedSell": false
  }
}
```

This allows PLTR to default to momentum mode while other stocks use traditional mode.
