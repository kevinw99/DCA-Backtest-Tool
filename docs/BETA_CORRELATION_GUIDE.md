# Beta Parameter Correlation Guide

## What is Beta?

Beta is a measure of a stock's volatility relative to the overall market (typically the S&P 500). Understanding Beta helps you assess how much a stock's price moves compared to the broader market:

- **Beta = 1.0**: Stock moves in line with the market
- **Beta > 1.0**: Stock is more volatile than the market (higher risk, potentially higher reward)
- **Beta < 1.0**: Stock is less volatile than the market (lower risk, more stable)

### Examples:
- **Tesla (TSLA)**: Beta ≈ 2.0 - Moves twice as much as the market
- **Apple (AAPL)**: Beta ≈ 1.2 - Slightly more volatile than market
- **Utilities**: Beta ≈ 0.6 - Less volatile, more stable

## How Beta Correlation Works

The Beta correlation feature automatically adjusts your DCA trading parameters based on a stock's volatility characteristics. This creates more appropriate risk-adjusted strategies for different types of stocks.

### Parameter Adjustments

When Beta scaling is enabled, the following parameters are automatically calculated:

| Parameter | Formula | Purpose |
|-----------|---------|---------|
| Profit Requirement | `0.05 × Beta` | Higher volatility stocks need higher profit targets |
| Grid Interval | `0.1 × Beta` | More volatile stocks need wider grid spacing |
| Trailing Buy Activation | `0.1 × Beta` | Wider activation thresholds for volatile stocks |
| Trailing Buy Rebound | `0.05 × Beta` | Larger rebound requirements for entry |
| Trailing Sell Activation | `0.2 × Beta` | Higher activation for volatile sell conditions |
| Trailing Sell Pullback | `0.1 × Beta` | Wider pullback tolerance before selling |

### Example Calculations

For **Tesla (Beta = 2.0)**:
- Profit Requirement: `0.05 × 2.0 = 10%` (vs 5% for market-neutral)
- Grid Interval: `0.1 × 2.0 = 20%` (vs 10% for market-neutral)
- Trailing Buy Activation: `0.1 × 2.0 = 20%` (vs 10% for market-neutral)

For **Utilities Stock (Beta = 0.6)**:
- Profit Requirement: `0.05 × 0.6 = 3%` (vs 5% for market-neutral)
- Grid Interval: `0.1 × 0.6 = 6%` (vs 10% for market-neutral)
- Trailing Buy Activation: `0.1 × 0.6 = 6%` (vs 10% for market-neutral)

## Using Beta Correlation

### Single Mode Backtesting

1. **Select a Stock**: Choose your stock symbol
2. **Beta Auto-Fetch**: The system automatically fetches the latest Beta value
3. **Enable Beta Scaling**: Toggle the "Enable Beta Scaling" option
4. **Review Adjusted Parameters**: See how your base parameters are adjusted
5. **Manual Override**: Optionally override the Beta value if needed
6. **Run Backtest**: Execute with Beta-adjusted parameters

### Batch Mode Testing

1. **Select Multiple Stocks**: Choose stocks with different Beta characteristics
2. **Choose Beta Values**: Select from predefined options (0.25, 0.5, 1.0, 1.5, 2.0, 3.0)
3. **Set Base Parameters**: Define your base parameter ranges
4. **Enable Beta Scaling**: Let the system adjust parameters for each Beta
5. **Run Batch Test**: Compare performance across different volatility scenarios

### Manual Beta Override

Sometimes you may want to use a custom Beta value:

1. **Click "Manual Override"**: Switch to manual Beta input
2. **Enter Custom Beta**: Input your desired Beta value (0.1 - 5.0)
3. **Review Calculations**: See how parameters adjust to your custom Beta
4. **Save Configuration**: Your manual Beta will be remembered

## Best Practices

### When to Use Beta Correlation

✅ **Good Use Cases:**
- Testing strategies across different volatility profiles
- Comparing high-beta vs low-beta stock performance
- Automatically adjusting for stock-specific risk characteristics
- Batch testing with consistent risk-adjusted parameters

❌ **When to Use Manual Parameters:**
- You have specific parameter requirements
- Testing very specific strategy variations
- The stock's Beta doesn't reflect current market conditions
- You want to test extreme parameter combinations

### Beta Value Selection for Batch Testing

- **Conservative Portfolio**: Test Beta values 0.25, 0.5, 1.0
- **Balanced Portfolio**: Test Beta values 0.5, 1.0, 1.5, 2.0
- **Aggressive Portfolio**: Test Beta values 1.0, 1.5, 2.0, 3.0
- **Full Spectrum**: Test all values 0.25, 0.5, 1.0, 1.5, 2.0, 3.0

### Parameter Validation

The system includes safety checks:

- **Beta Range**: 0.1 - 5.0 (extreme values are flagged)
- **Profit Requirement**: Maximum 25% (prevents unrealistic targets)
- **Grid Interval**: Maximum 50% (prevents excessive spacing)
- **Trailing Percentages**: Maximum 50% (prevents extreme thresholds)

## Understanding Results

### Beta Context in Results

Every backtest result includes Beta information:

```
Beta Information:
- Beta Value: 1.5
- Source: Yahoo Finance
- Last Updated: 2025-01-15
- Scaling Enabled: Yes

Adjusted Parameters:
- Profit Requirement: 7.5% (base: 5.0%)
- Grid Interval: 15.0% (base: 10.0%)
```

### Comparing Beta Performance

When analyzing batch results:

1. **Sort by Beta**: See how performance varies with volatility
2. **Filter by Beta Range**: Focus on specific volatility profiles
3. **Beta vs Return Charts**: Visualize the correlation between Beta and performance
4. **Risk-Adjusted Metrics**: Compare Sharpe ratios across different Beta values

## Troubleshooting

### Beta Data Issues

**Problem**: "Beta data unavailable"
**Solution**: 
- System will default to Beta = 1.0
- You can manually override with a custom Beta
- Check if the stock symbol is correct

**Problem**: "Extreme Beta value detected"
**Solution**:
- Review if the Beta value is realistic for your stock
- Consider manual override if the fetched Beta seems incorrect
- Check the data source and last updated timestamp

### Parameter Warnings

**Problem**: "Profit requirement exceeds 20%"
**Solution**:
- Consider using a lower Beta value
- Switch to manual parameter mode
- Review if such high profit targets are realistic

**Problem**: "Grid interval too wide"
**Solution**:
- May reduce trading frequency significantly
- Consider using a lower base grid interval
- Test with historical data to validate effectiveness

## Advanced Features

### Beta Trend Analysis

Monitor how a stock's Beta changes over time:
- Historical Beta values
- Beta stability indicators
- Market condition correlation

### Portfolio Beta Optimization

Use batch testing to build portfolios with target Beta characteristics:
- Low Beta (0.5-0.8): Defensive, stable returns
- Market Beta (0.8-1.2): Balanced market exposure
- High Beta (1.2-2.0): Growth-oriented, higher volatility

### Custom Beta Formulas

Advanced users can modify the correlation formulas in the configuration:
- Adjust base multipliers
- Create custom parameter relationships
- Test alternative volatility adjustments

## Getting Help

- **API Documentation**: See `API_DOCUMENTATION.md` for technical details
- **Configuration**: Check `backtestDefaults.json` for default values
- **Support**: Review error messages and warnings for guidance
- **Community**: Share Beta correlation strategies and results