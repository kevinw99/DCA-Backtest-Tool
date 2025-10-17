# URL Parameter Defaults

This document lists all URL parameters supported by the backtest application, their format conversions, and default values when not present in the URL.

## Parameter Sources

All defaults are defined in `/frontend/src/utils/URLParameterManager.js` in the `_decodeSingleParameters` method (lines 574-660).

## Format Conversion Rules

- **Percentages**: URL uses whole numbers (e.g., `10` = 10%), backend expects decimals (e.g., `0.10` = 10%)
- **Booleans**: URL uses `true`/`false` strings, backend expects boolean values
- **Numbers**: Direct numeric values, no conversion needed

## Complete Parameter List

### Basic Parameters

| Parameter | URL Format | Backend Format | Default | Source Line |
|-----------|-----------|----------------|---------|-------------|
| `symbol` | string | string | `''` (empty) | 577 |
| `startDate` | YYYY-MM-DD | YYYY-MM-DD | `'2021-09-01'` | 578 |
| `endDate` | YYYY-MM-DD | YYYY-MM-DD | `''` (empty) | 579 |
| `strategyMode` | string | string | `'long'` | 580 |

### Investment Parameters

| Parameter | URL Format | Backend Format | Default | Source Line |
|-----------|-----------|----------------|---------|-------------|
| `lotSizeUsd` | number | number | `10000` | 585 |
| `maxLots` | number | number | `10` | 586 |
| `maxLotsToSell` | number | number | `1` | 587 |

### Core Strategy Parameters (Percentages)

| Parameter | URL Format | Backend Format | Default (%) | Default (Decimal) | Source Line |
|-----------|-----------|----------------|-------------|-------------------|-------------|
| `gridIntervalPercent` | 10 | 0.10 | 10% | 0.10 | 589 |
| `profitRequirement` | 10 | 0.10 | 10% | 0.10 | 590 |
| `trailingBuyActivationPercent` | 10 | 0.10 | 10% | 0.10 | 591 |
| `trailingBuyReboundPercent` | 5 | 0.05 | 5% | 0.05 | 592 |
| `trailingSellActivationPercent` | 20 | 0.20 | 20% | 0.20 | 593 |
| `trailingSellPullbackPercent` | 10 | 0.10 | 10% | 0.10 | 594 |

### Beta Parameters

| Parameter | URL Format | Backend Format | Default | Source Line |
|-----------|-----------|----------------|---------|-------------|
| `beta` | number | number | `1.0` | 598-599 |
| `coefficient` | number | number | `1.0` | 598-599 |
| `enableBetaScaling` | boolean | boolean | `false` | 600 |
| `isManualBetaOverride` | boolean | boolean | `false` | 601 |

### Grid & Advanced Features (Boolean Flags)

| Parameter | URL Format | Backend Format | Default When Undefined | Source Line |
|-----------|-----------|----------------|------------------------|-------------|
| `enableDynamicGrid` | boolean | boolean | `false` | 620-621 |
| `normalizeToReference` | boolean | boolean | `false` | 623-624 |
| `enableConsecutiveIncrementalBuyGrid` | boolean | boolean | `false` | 626-627 |
| `enableConsecutiveIncrementalSellProfit` | boolean | boolean | `false` | 629-630 |
| `enableScenarioDetection` | boolean | boolean | `false` | 632-633 |
| `enableAverageBasedGrid` | boolean | boolean | `false` | 637-638 |
| `enableAverageBasedSell` | boolean | boolean | `false` | 640-641 |
| `enableDynamicProfile` | boolean | boolean | `false` | 645-646 |

**Note**: All advanced features default to `false` when NOT present in URL. You must explicitly enable them by adding them to the URL.

### Grid Parameters

| Parameter | URL Format | Backend Format | Default (%) | Default (Decimal) | Source Line |
|-----------|-----------|----------------|-------------|-------------------|-------------|
| `dynamicGridMultiplier` | number | number | 1.0 | N/A | 646-648 |
| `gridConsecutiveIncrement` | 5 | 0.05 | 5% | 0.05 | 654-656 |

### Order Type

| Parameter | URL Format | Backend Format | Default | Source Line |
|-----------|-----------|----------------|---------|-------------|
| `trailingStopOrderType` | string | string | `'market'` | 658 |

## Key Changes from Previous Defaults

The following defaults have been changed to provide more predictable behavior:

1. **`startDate`**: Changed from `''` to `'2021-09-01'` - provides a sensible default date range
2. **`profitRequirement`**: Changed from `5%` to `10%` - more conservative profit target
3. **All Grid & Advanced Features**: Changed from `true` to `false` - features must be explicitly enabled
4. **`trailingStopOrderType`**: Changed from `'limit'` to `'market'` - faster execution

## Impact on URL Behavior

**Previously (OLD behavior):**
- If you didn't specify `enableDynamicGrid` in the URL, it would default to `true` (enabled)
- If you didn't specify `normalizeToReference` in the URL, it would default to `true` (enabled)
- This caused unexpected behavior where features were active without being requested

**Now (NEW behavior):**
- If you don't specify advanced features in the URL, they default to `false` (disabled)
- You must explicitly enable features by adding them to the URL:
  ```
  &enableDynamicGrid=true&normalizeToReference=true
  ```

This change ensures that **only the features you explicitly request are active**, making testing and debugging much easier.

## Testing Recommendations

When testing consecutive incremental buy grid:

1. **Explicitly disable Dynamic Grid**:
   - Add `enableDynamicGrid=false` to URL
   - Dynamic Grid modifies spacing calculations

2. **Explicitly disable Normalize to Reference**:
   - Add `normalizeToReference=false` to URL
   - This feature can affect reference price calculations

3. **Explicitly disable Scenario Detection**:
   - Add `enableScenarioDetection=false` to URL
   - Scenario detection can override normal grid behavior

Example minimal test URL:
```
http://localhost:3000/backtest/long/PLTR/results?startDate=2022-01-01&endDate=2022-12-31&lotSizeUsd=10000&maxLots=10&gridIntervalPercent=10&profitRequirement=10&enableTrailingBuy=false&enableTrailingSell=false&enableConsecutiveIncrementalBuyGrid=true&gridConsecutiveIncrement=5&enableDynamicGrid=false&normalizeToReference=false&enableScenarioDetection=false&enableConsecutiveIncrementalSellProfit=false
```

This ensures you're testing ONLY the consecutive incremental buy grid feature without interference from other features.
