# DCA Backtest Tool - MCP Server

**Model Context Protocol (MCP) Server** for the Grid-Based DCA Backtest Tool, enabling AI assistants to run backtests and analyze strategies via natural language.

## Features

- **10+ Tools** for backtesting, analysis, and optimization
- **Natural Language Interface** via Claude Code or any MCP-compatible client
- **Async Operations** for performance with concurrent request handling
- **Comprehensive Error Handling** with clear, actionable messages
- **Local-Only by Default** for security

## Available Tools

1. **health_check** - Check backend API and database status
2. **list_stocks** - List available stock tickers with pagination
3. **get_stock_info** - Get detailed stock metadata and date ranges
4. **calculate_beta** - Calculate beta coefficient vs S&P 500
5. **run_dca_backtest** - Run single-stock DCA backtest
6. **run_portfolio_backtest** - Run multi-stock portfolio backtest
7. **run_batch_optimization** - Optimize parameters across ranges
8. **compare_strategies** - Compare multiple strategy configurations
9. **get_dca_suitability_score** - Calculate DCA suitability score

## Prerequisites

- **Python 3.11+** (required for FastMCP)
- **DCA Backend API** running on port 3001
- **Claude Code** or other MCP-compatible client

## Installation

### 1. Set Up Python Environment

```bash
cd /Users/kweng/AI/DCA-Backtest-Tool/mcp-server
python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env if you need to change defaults (e.g., different backend URL)
```

### 3. Configure Claude Code

Add to your Claude Code MCP configuration file (`~/.config/claude-code/mcp_config.json`):

```json
{
  "mcpServers": {
    "dca-backtest": {
      "command": "python",
      "args": ["/Users/kweng/AI/DCA-Backtest-Tool/mcp-server/mcp_server.py"],
      "env": {
        "BACKEND_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

**Important**: Use absolute paths, not relative paths.

## Usage

### Starting the Services

#### 1. Start Backend API (in project root)
```bash
npm run backend:dev
```

#### 2. Start MCP Server (in mcp-server directory)
```bash
source venv/bin/activate
python mcp_server.py
```

### Example Prompts

#### Basic Queries
```
"Check the health of the DCA backend API"
"List all available stocks"
"Get information about TSLA"
"Calculate beta for NVDA"
```

#### Single Stock Backtests
```
"Run a DCA backtest for TSLA from 2020-01-01 to 2024-12-31"
"Backtest NVDA with 15% grid spacing and 3% profit target from 2020-2024"
"Test PLTR with momentum selling enabled for the last 3 years"
```

#### Portfolio Backtests
```
"Backtest a portfolio of AAPL (30%), GOOGL (30%), MSFT (40%) from 2020-2024"
"Run a portfolio backtest with beta-adjusted capital allocation for FAANG stocks"
```

#### Optimization & Analysis
```
"Optimize grid spacing for NVDA testing 5%, 10%, and 15% with profit targets from 3-7%"
"Compare baseline DCA (10% grid, 5% profit) vs aggressive DCA (5% grid, 3% profit) for AAPL"
"Is PLTR a good candidate for DCA strategy?"
"Find the best DCA parameters for TSLA over the last 4 years"
```

## Tool Details

### health_check

Check if backend API is reachable and healthy.

**Parameters**: None

**Returns**:
- Backend status (healthy/unhealthy/unreachable)
- Database connection status
- API version
- Uptime

### list_stocks

List available stock tickers from the database.

**Parameters**:
- `limit` (optional): Max stocks to return (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Returns**:
- Array of stock symbols
- Total count
- Pagination info

### get_stock_info

Get detailed information about a specific stock.

**Parameters**:
- `symbol` (required): Stock ticker (e.g., "TSLA")

**Returns**:
- Company name, sector, market cap
- Beta coefficient
- Available date range
- Data quality indicators

### calculate_beta

Calculate beta coefficient relative to S&P 500.

**Parameters**:
- `symbol` (required): Stock ticker
- `period` (optional): Trading days for calculation (default: 252)

**Returns**:
- Beta value
- Correlation coefficient
- Date range used
- Interpretation (low/market/high volatility)

### run_dca_backtest

Run a comprehensive DCA backtest for a single stock.

**Parameters**:
- `symbol` (required): Stock ticker
- `start_date` (required): Start date (YYYY-MM-DD)
- `end_date` (required): End date (YYYY-MM-DD)
- `initial_capital` (optional): Starting capital (default: 10000)
- `grid_spacing` (optional): Grid spacing as decimal (default: 0.10)
- `profit_target` (optional): Profit target as decimal (default: 0.05)
- `enable_momentum_sell` (optional): Enable momentum-based selling (default: false)
- `enable_trailing_stop_buy` (optional): Enable trailing stop buys (default: false)

**Returns**:
- Total return %, max drawdown %, Sharpe ratio
- Number of trades, final capital
- DCA Suitability Score
- Transaction summary
- Parameters used

### run_portfolio_backtest

Run a portfolio backtest with multiple stocks.

**Parameters**:
- `stocks` (required): Array of {symbol, allocation_pct}
- `start_date` (required): Start date (YYYY-MM-DD)
- `end_date` (required): End date (YYYY-MM-DD)
- `initial_capital` (optional): Starting capital (default: 10000)
- `enable_beta_capital_allocation` (optional): Adjust capital by beta (default: false)
- `grid_spacing` (optional): Grid spacing (default: 0.10)
- `profit_target` (optional): Profit target (default: 0.05)

**Returns**:
- Portfolio-level metrics (return, drawdown, Sharpe ratio)
- Per-stock performance breakdown
- Capital allocation method

### run_batch_optimization

Test multiple parameter combinations to find optimal settings.

**Parameters**:
- `symbol` (required): Stock ticker
- `start_date` (required): Start date (YYYY-MM-DD)
- `end_date` (required): End date (YYYY-MM-DD)
- `initial_capital` (optional): Starting capital (default: 10000)
- `parameter_grid` (required): Object with arrays of values to test
  - `grid_spacing`: Array of grid spacing values
  - `profit_target`: Array of profit target values
  - `enable_momentum_sell`: Array of boolean values

**Returns**:
- Total combinations tested
- Best configuration with full metrics
- Top 5 configurations ranked by return

### compare_strategies

Compare 2-5 different strategy configurations side-by-side.

**Parameters**:
- `symbol` (required): Stock ticker
- `strategies` (required): Array of strategy configs (2-5)
- `start_date` (required): Start date (YYYY-MM-DD)
- `end_date` (required): End date (YYYY-MM-DD)
- `initial_capital` (optional): Starting capital (default: 10000)

**Returns**:
- Comparison table with all strategies
- Best strategy recommendation
- Reasoning based on Sharpe ratio

### get_dca_suitability_score

Calculate DCA Suitability Score (0-100) for a stock.

**Parameters**:
- `symbol` (required): Stock ticker
- `start_date` (required): Start date (YYYY-MM-DD)
- `end_date` (required): End date (YYYY-MM-DD)

**Returns**:
- Overall score (0-100)
- Interpretation (Poor/Fair/Good/Excellent candidate)
- Recommendation text

## Troubleshooting

### Backend Connection Issues

**Error**: `Cannot connect to backend: Connection refused`

**Solution**:
1. Ensure backend is running: `npm run backend:dev`
2. Check backend is on port 3001: `curl http://localhost:3001/api/health`
3. Verify BACKEND_API_URL in .env

### MCP Server Not Starting

**Error**: `ModuleNotFoundError: No module named 'fastmcp'`

**Solution**:
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### Tool Not Found in Claude Code

**Solution**:
1. Restart Claude Code after config changes
2. Verify mcp_config.json syntax (valid JSON)
3. Check absolute paths (not relative)
4. Ensure MCP server is running

### Backtest Timeouts

**Error**: `Backtest timed out after 60 seconds`

**Solution**:
1. Reduce date range (test with 1 year first)
2. Increase API_TIMEOUT in .env
3. Check backend logs for errors

### Permission Denied

**Error**: `Permission denied: /path/to/mcp_server.py`

**Solution**:
```bash
# You don't need execute permission for Python files
python mcp_server.py  # Works without chmod +x
```

## Development

### Project Structure

```
mcp-server/
├── mcp_server.py          # Main entry point
├── config.py              # Configuration settings
├── errors.py              # Error handling
├── tools/
│   ├── __init__.py
│   ├── health.py          # Health check tool
│   ├── stocks.py          # Stock data tools
│   ├── backtest.py        # Backtest tools (DCA, portfolio, batch)
│   └── analysis.py        # Analysis tools (beta, compare, suitability)
├── tests/
│   └── __init__.py
├── requirements.txt       # Python dependencies
├── .env.example           # Example configuration
└── README.md             # This file
```

### Running Tests

```bash
source venv/bin/activate
pytest tests/ -v
```

### Code Formatting

```bash
black .
ruff check .
```

## Architecture

```
┌─────────────────────────┐
│   AI Assistant          │
│  (Claude Code, etc.)    │
└──────────┬──────────────┘
           │ MCP Protocol (JSON-RPC)
           ▼
┌─────────────────────────┐
│   MCP Server (FastMCP)  │
│  - 10+ tools            │
│  - Async operations     │
└──────────┬──────────────┘
           │ HTTP/REST
           ▼
┌─────────────────────────┐
│  DCA Backend API        │
│  (Express, Port 3001)   │
└──────────┬──────────────┘
           │ SQLite
           ▼
       ┌───────┐
       │stocks.db│
       └───────┘
```

## Performance

- Tool responses: <2 seconds (stock data)
- Backtests: 10-30 seconds (varies by date range)
- Batch optimization: 30-120 seconds (depends on combinations)
- Concurrent requests: Up to 5 simultaneous

## Security

- **Local-only by default**: Server only accepts connections from localhost
- **No authentication required** for local use
- **Read-only operations**: MCP server doesn't modify database
- **Rate limiting**: Controlled via MAX_CONCURRENT_REQUESTS

## License

MIT (same as DCA Backtest Tool)

## Support

For issues, questions, or feature requests, please see the main project repository.

## Related Documentation

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [FastMCP Documentation](https://github.com/jlowin/fastmcp)
- [Claude Code MCP Integration](https://docs.anthropic.com/claude-code/mcp)
- DCA Backend API Documentation (see main project README)
- Development Skills (see `.claude/skills/` in project root)
