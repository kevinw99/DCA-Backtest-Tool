# MCP Server - Claude Code Integration Guide

This guide walks you through setting up the DCA Backtest MCP Server with Claude Code.

## Prerequisites

- ✅ Python 3.11+ installed
- ✅ DCA Backend API running
- ✅ Claude Code installed

## Step 1: Install MCP Server

```bash
cd /Users/kweng/AI/DCA-Backtest-Tool/mcp-server
./install.sh
```

This will:
- Create Python virtual environment
- Install all dependencies
- Create `.env` configuration file

## Step 2: Start Backend API

In the project root directory:

```bash
npm run backend:dev
```

Verify it's running:
```bash
curl http://localhost:3001/api/health
```

Expected output:
```json
{
  "status": "OK",
  "message": "Stock Trading API is running"
}
```

## Step 3: Configure Claude Code

### Find Your MCP Config File

Claude Code MCP configuration is typically at:
- **macOS/Linux**: `~/.config/claude-code/mcp_config.json`
- **Windows**: `%APPDATA%\claude-code\mcp_config.json`

### Add MCP Server Configuration

Edit `mcp_config.json` and add the `dca-backtest` server:

```json
{
  "mcpServers": {
    "dca-backtest": {
      "command": "python",
      "args": [
        "/Users/kweng/AI/DCA-Backtest-Tool/mcp-server/mcp_server.py"
      ],
      "env": {
        "BACKEND_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

**Important**:
- Use **absolute paths** (not relative paths like `./mcp_server.py`)
- Replace `/Users/kweng/...` with your actual project path

### Full Example with Multiple Servers

If you have other MCP servers, your config might look like:

```json
{
  "mcpServers": {
    "dca-backtest": {
      "command": "python",
      "args": ["/Users/kweng/AI/DCA-Backtest-Tool/mcp-server/mcp_server.py"],
      "env": {
        "BACKEND_API_URL": "http://localhost:3001"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/kweng/projects"]
    }
  }
}
```

## Step 4: Restart Claude Code

After modifying `mcp_config.json`:

1. **Completely quit** Claude Code
2. **Reopen** Claude Code

## Step 5: Verify Integration

In Claude Code, try these commands:

### Test 1: Check Backend Health
```
"Check the health of the DCA backend API"
```

Expected response should show backend status, database connection, etc.

### Test 2: List Stocks
```
"List 10 available stocks"
```

Should return a list of stock tickers.

### Test 3: Run Simple Backtest
```
"Run a DCA backtest for AAPL from 2023-01-01 to 2023-12-31"
```

Should return backtest results with metrics.

## Troubleshooting

### Issue: "Tool not found" or "Server not available"

**Causes**:
1. MCP server path is incorrect
2. Python virtual environment not activated
3. Claude Code didn't reload config

**Solutions**:
1. Verify absolute path in `mcp_config.json`
2. Test manually:
   ```bash
   source /Users/kweng/AI/DCA-Backtest-Tool/mcp-server/venv/bin/activate
   python /Users/kweng/AI/DCA-Backtest-Tool/mcp-server/mcp_server.py
   ```
3. Completely quit and reopen Claude Code (not just reload window)

### Issue: "Cannot connect to backend"

**Causes**:
1. Backend API not running
2. Wrong port in configuration

**Solutions**:
1. Start backend: `npm run backend:dev`
2. Verify: `curl http://localhost:3001/api/health`
3. Check `BACKEND_API_URL` in `mcp_config.json`

### Issue: "Permission denied"

**Cause**: Python script doesn't have execute permissions

**Solution**: You don't need execute permission for Python files. Use:
```json
{
  "command": "python",  // ✅ Correct
  "args": ["/path/to/mcp_server.py"]
}
```

Not:
```json
{
  "command": "/path/to/mcp_server.py"  // ❌ Wrong
}
```

### Issue: Import errors when starting MCP server

**Cause**: Dependencies not installed or wrong virtual environment

**Solution**:
```bash
cd /Users/kweng/AI/DCA-Backtest-Tool/mcp-server
source venv/bin/activate
pip install -r requirements.txt
```

## Advanced Configuration

### Custom Backend URL

If your backend runs on a different port:

```json
{
  "dca-backtest": {
    "command": "python",
    "args": ["/path/to/mcp_server.py"],
    "env": {
      "BACKEND_API_URL": "http://localhost:8080"
    }
  }
}
```

### Custom Timeout

For long-running backtests:

```json
{
  "dca-backtest": {
    "command": "python",
    "args": ["/path/to/mcp_server.py"],
    "env": {
      "BACKEND_API_URL": "http://localhost:3001",
      "API_TIMEOUT": "120"
    }
  }
}
```

### Verbose Logging

For debugging:

```json
{
  "dca-backtest": {
    "command": "python",
    "args": ["/path/to/mcp_server.py"],
    "env": {
      "BACKEND_API_URL": "http://localhost:3001",
      "LOG_LEVEL": "DEBUG"
    }
  }
}
```

## Usage Examples

### Basic Queries

```
"What stocks are available?"
"Get information about TSLA"
"Calculate beta for NVDA"
```

### Single Stock Backtests

```
"Run a DCA backtest for TSLA from 2020-2024"
"Backtest PLTR with 15% grid spacing and 3% profit target"
"Test NVDA with momentum selling enabled from 2020-2023"
```

### Portfolio Analysis

```
"Backtest a portfolio of AAPL (30%), GOOGL (30%), MSFT (40%) from 2020-2024"
"Run a portfolio backtest with beta-adjusted capital for tech stocks"
```

### Optimization

```
"Find the best grid spacing for TSLA testing 5%, 10%, and 15%"
"Compare conservative vs aggressive DCA strategies for AAPL"
"Optimize parameters for NVDA from 2020-2024"
```

### Analysis

```
"Is PLTR a good candidate for DCA strategy?"
"What's the DCA suitability score for TSLA?"
"Compare baseline DCA vs momentum-enhanced DCA for NVDA"
```

## Workflow: Starting Everything

### Terminal 1: Backend API
```bash
cd /Users/kweng/AI/DCA-Backtest-Tool
npm run backend:dev
```

### Terminal 2 (Optional): Manual MCP Server Test
```bash
cd /Users/kweng/AI/DCA-Backtest-Tool/mcp-server
source venv/bin/activate
python mcp_server.py
```

### Claude Code
Opens automatically when you start a conversation. MCP server will be launched by Claude Code based on `mcp_config.json`.

## Performance Tips

1. **Start with shorter date ranges** (1 year) before testing longer periods
2. **Use batch optimization sparingly** - it can take 30-120 seconds
3. **Portfolio backtests** require all stocks to have data for the date range
4. **Concurrent requests** are limited to 5 by default

## Security Notes

- MCP server only accepts **local connections** (localhost)
- No authentication required for local use
- All operations are **read-only** (doesn't modify database)
- Backend API should also be local-only

## Next Steps

After successful integration:

1. Try all 10 tools to familiarize yourself
2. Test with different stocks and date ranges
3. Explore parameter optimization
4. Use portfolio backtests for diversified strategies

## Support

For issues:
1. Check syntax with `python -m py_compile mcp_server.py`
2. Verify backend is running: `curl http://localhost:3001/api/health`
3. Check Claude Code logs for error messages
4. See main README.md for detailed troubleshooting

## Related Documentation

- [README.md](README.md) - Full documentation
- [MCP Protocol Docs](https://modelcontextprotocol.io/)
- [Claude Code MCP Guide](https://docs.anthropic.com/claude-code/mcp)
