# Environment Configuration

## Beta Parameter Correlation Settings

The following environment variables control the Beta parameter correlation feature:

### Core Beta Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BETA_DATA_PROVIDER` | `yahoo_finance` | Primary data provider for Beta values (`yahoo_finance`, `alpha_vantage`) |
| `BETA_DEFAULT_VALUE` | `1.0` | Default Beta value when data is unavailable |
| `BETA_MIN_VALUE` | `0.1` | Minimum allowed Beta value for validation |
| `BETA_MAX_VALUE` | `5.0` | Maximum allowed Beta value for validation |

### Caching and Performance

| Variable | Default | Description |
|----------|---------|-------------|
| `BETA_CACHE_EXPIRATION_HOURS` | `24` | Hours before cached Beta data expires |
| `BETA_ENABLE_CACHING` | `true` | Enable/disable Beta data caching |
| `BETA_FETCH_TIMEOUT_MS` | `5000` | Timeout for Beta API requests (milliseconds) |

### Retry and Fallback

| Variable | Default | Description |
|----------|---------|-------------|
| `BETA_RETRY_ATTEMPTS` | `3` | Number of retry attempts for failed Beta fetches |
| `BETA_RETRY_DELAY_MS` | `1000` | Delay between retry attempts (milliseconds) |
| `BETA_ENABLE_FALLBACK_PROVIDERS` | `true` | Enable fallback to secondary data providers |

### Logging and Debugging

| Variable | Default | Description |
|----------|---------|-------------|
| `BETA_LOG_FETCH_ATTEMPTS` | `false` | Log all Beta fetch attempts for debugging |

## Configuration Examples

### Production Configuration
```bash
# Optimized for production use
BETA_DATA_PROVIDER=yahoo_finance
BETA_CACHE_EXPIRATION_HOURS=24
BETA_FETCH_TIMEOUT_MS=5000
BETA_RETRY_ATTEMPTS=3
BETA_ENABLE_CACHING=true
BETA_ENABLE_FALLBACK_PROVIDERS=true
BETA_LOG_FETCH_ATTEMPTS=false
```

### Development Configuration
```bash
# Enhanced logging and shorter cache for development
BETA_DATA_PROVIDER=yahoo_finance
BETA_CACHE_EXPIRATION_HOURS=1
BETA_FETCH_TIMEOUT_MS=10000
BETA_RETRY_ATTEMPTS=2
BETA_ENABLE_CACHING=true
BETA_ENABLE_FALLBACK_PROVIDERS=true
BETA_LOG_FETCH_ATTEMPTS=true
```

### Conservative Configuration
```bash
# Stricter Beta value bounds for conservative trading
BETA_DATA_PROVIDER=yahoo_finance
BETA_DEFAULT_VALUE=1.0
BETA_MIN_VALUE=0.2
BETA_MAX_VALUE=3.0
BETA_CACHE_EXPIRATION_HOURS=48
```

### High-Frequency Configuration
```bash
# Faster timeouts and more frequent updates
BETA_CACHE_EXPIRATION_HOURS=6
BETA_FETCH_TIMEOUT_MS=3000
BETA_RETRY_ATTEMPTS=2
BETA_RETRY_DELAY_MS=500
```

## Data Provider Configuration

### Yahoo Finance (Recommended)
```bash
BETA_DATA_PROVIDER=yahoo_finance
# No additional API key required
# Unlimited requests
# Most reliable Beta data
```

### Alpha Vantage (Fallback)
```bash
BETA_DATA_PROVIDER=alpha_vantage
ALPHA_VANTAGE_API_KEY=your_api_key_here
# Requires API key
# 25 requests per day (free tier)
# Good data quality
```

## Performance Tuning

### For High-Volume Batch Testing
```bash
# Optimize for batch operations with many stocks
BETA_CACHE_EXPIRATION_HOURS=72
BETA_FETCH_TIMEOUT_MS=3000
BETA_RETRY_ATTEMPTS=2
BETA_ENABLE_CACHING=true
```

### For Real-Time Applications
```bash
# Optimize for fresh data and quick responses
BETA_CACHE_EXPIRATION_HOURS=6
BETA_FETCH_TIMEOUT_MS=2000
BETA_RETRY_ATTEMPTS=1
BETA_ENABLE_FALLBACK_PROVIDERS=false
```

## Troubleshooting

### Common Issues and Solutions

**Issue**: Beta fetch timeouts
```bash
# Increase timeout and retry settings
BETA_FETCH_TIMEOUT_MS=10000
BETA_RETRY_ATTEMPTS=5
BETA_RETRY_DELAY_MS=2000
```

**Issue**: Too many API requests
```bash
# Increase cache duration
BETA_CACHE_EXPIRATION_HOURS=48
BETA_ENABLE_CACHING=true
```

**Issue**: Unrealistic Beta values
```bash
# Tighten validation bounds
BETA_MIN_VALUE=0.2
BETA_MAX_VALUE=3.0
```

**Issue**: Debugging data fetch problems
```bash
# Enable detailed logging
BETA_LOG_FETCH_ATTEMPTS=true
```

## Security Considerations

- **API Keys**: Store API keys securely and never commit to version control
- **Rate Limiting**: Respect API provider rate limits with appropriate caching
- **Input Validation**: Beta values are validated against min/max bounds
- **Error Handling**: Failed fetches gracefully fall back to default values

## Migration Guide

### From Manual Parameters to Beta Correlation

1. **Backup Current Configuration**: Save your existing parameter settings
2. **Enable Beta Features**: Add Beta environment variables to your `.env`
3. **Test with Default Settings**: Start with default Beta configuration
4. **Gradually Tune**: Adjust cache expiration and retry settings as needed
5. **Monitor Performance**: Watch for any impact on backtest execution time

### Updating Existing Installations

1. **Copy New Variables**: Add Beta variables from `.env.example` to your `.env`
2. **Restart Services**: Restart backend server to load new configuration
3. **Verify Functionality**: Test Beta fetching with a known stock symbol
4. **Adjust as Needed**: Tune settings based on your usage patterns