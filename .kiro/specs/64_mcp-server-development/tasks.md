# Tasks: MCP Server Development

**Spec Number**: 64
**Date**: January 2025
**Total Estimated Time**: 14-21 hours

---

## Phase 1: Core Setup (2-3 hours)

### Task 1.1: Set Up Python Environment
**Time**: 30 minutes
**Priority**: High

**Steps**:
1. Create `mcp-server/` directory in project root
2. Create virtual environment
3. Install FastMCP and dependencies
4. Set up project structure

**Commands**:
```bash
cd /Users/kweng/AI/DCA-Backtest-Tool
mkdir mcp-server
cd mcp-server
python3 -m venv venv
source venv/bin/activate
pip install fastmcp httpx pydantic pydantic-settings python-dotenv
```

**Acceptance Criteria**:
- [ ] Virtual environment created
- [ ] FastMCP installed successfully
- [ ] Dependencies installed
- [ ] Can import fastmcp without errors

---

### Task 1.2: Create Project Structure
**Time**: 15 minutes
**Priority**: High

**Steps**:
1. Create directory structure
2. Create `__init__.py` files
3. Create placeholder files

**Structure**:
```
mcp-server/
├── mcp_server.py
├── config.py
├── errors.py
├── tools/
│   ├── __init__.py
│   ├── backtest.py
│   ├── stocks.py
│   ├── analysis.py
│   └── health.py
├── tests/
│   ├── __init__.py
│   └── test_tools.py
├── requirements.txt
├── .env.example
└── README.md
```

**Acceptance Criteria**:
- [ ] All directories created
- [ ] All placeholder files created
- [ ] Project structure matches design

---

### Task 1.3: Implement Configuration Module
**Time**: 20 minutes
**Priority**: High

**File**: `config.py`

**Code**:
```python
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """MCP Server configuration settings"""

    # Backend API
    backend_api_url: str = "http://localhost:3001"
    api_timeout: int = 60  # seconds

    # Server settings
    max_concurrent_requests: int = 5
    log_level: str = "INFO"

    # Optional authentication (future)
    api_key: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
```

**Acceptance Criteria**:
- [ ] Settings class created with all fields
- [ ] Can load from .env file
- [ ] Default values set appropriately
- [ ] Can import and use settings

---

### Task 1.4: Implement Error Handling Module
**Time**: 30 minutes
**Priority**: High

**File**: `errors.py`

**Code**:
```python
"""Error handling for MCP server"""

class MCPError(Exception):
    """Base exception for MCP server errors"""
    pass

class BackendAPIError(MCPError):
    """Backend API returned an error"""
    def __init__(self, status_code: int, message: str, details: dict = None):
        self.status_code = status_code
        self.message = message
        self.details = details or {}
        super().__init__(f"Backend API error ({status_code}): {message}")

    def to_dict(self):
        return {
            "error": self.message,
            "status_code": self.status_code,
            "details": self.details
        }

class ValidationError(MCPError):
    """Invalid parameters provided"""
    def __init__(self, message: str, field: str = None):
        self.message = message
        self.field = field
        super().__init__(message)

class TimeoutError(MCPError):
    """Request timed out"""
    def __init__(self, operation: str, timeout: int):
        self.operation = operation
        self.timeout = timeout
        super().__init__(f"{operation} timed out after {timeout} seconds")

def handle_backend_error(response) -> None:
    """Convert backend API errors to clear MCP errors"""
    if response.status_code >= 400:
        try:
            error_data = response.json()
            message = error_data.get("error", "Unknown error")
            details = error_data.get("details", {})
        except:
            message = response.text or "Request failed"
            details = {}

        raise BackendAPIError(response.status_code, message, details)
```

**Acceptance Criteria**:
- [ ] All error classes defined
- [ ] Error conversion logic works
- [ ] Errors include helpful messages
- [ ] Can import and raise errors

---

### Task 1.5: Implement Main Server Entry Point
**Time**: 30 minutes
**Priority**: High

**File**: `mcp_server.py`

**Code**:
```python
"""MCP Server for DCA Backtest Tool"""

from fastmcp import FastMCP
import httpx
import logging
from config import settings
from errors import handle_backend_error, BackendAPIError, TimeoutError

# Configure logging
logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize FastMCP server
mcp = FastMCP("DCA Backtest Tool")

# HTTP client for backend API
http_client = httpx.AsyncClient(
    base_url=settings.backend_api_url,
    timeout=settings.api_timeout
)

# Import tool implementations
from tools.health import register_health_tools
from tools.stocks import register_stock_tools
from tools.backtest import register_backtest_tools
from tools.analysis import register_analysis_tools

# Register all tools
register_health_tools(mcp, http_client)
register_stock_tools(mcp, http_client)
register_backtest_tools(mcp, http_client)
register_analysis_tools(mcp, http_client)

if __name__ == "__main__":
    logger.info(f"Starting MCP server, connecting to {settings.backend_api_url}")
    mcp.run()
```

**Acceptance Criteria**:
- [ ] FastMCP server initializes
- [ ] HTTP client created
- [ ] Logging configured
- [ ] Can run server (even with empty tools)

---

### Task 1.6: Implement Health Check Tool
**Time**: 30 minutes
**Priority**: High

**File**: `tools/health.py`

**Code**:
```python
"""Health check tools"""

from typing import Dict, Any
import httpx
from errors import BackendAPIError

def register_health_tools(mcp, http_client: httpx.AsyncClient):
    """Register health check tools with MCP server"""

    @mcp.tool()
    async def health_check() -> Dict[str, Any]:
        """
        Check health status of the DCA backend API and database.

        Returns connection status and uptime information.
        """
        try:
            response = await http_client.get("/api/health")

            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "backend_status": "healthy",
                    "database_connected": data.get("database", False),
                    "api_version": data.get("version", "unknown"),
                    "uptime_seconds": data.get("uptime", 0)
                }
            else:
                return {
                    "success": False,
                    "backend_status": "unhealthy",
                    "status_code": response.status_code
                }

        except httpx.RequestError as e:
            return {
                "success": False,
                "backend_status": "unreachable",
                "error": str(e),
                "suggestion": "Ensure backend API is running on port 3001"
            }
```

**Acceptance Criteria**:
- [ ] health_check tool registered
- [ ] Returns proper status
- [ ] Handles connection errors gracefully
- [ ] Can test with Claude Code

---

### Task 1.7: Implement List Stocks Tool
**Time**: 30 minutes
**Priority**: High

**File**: `tools/stocks.py`

**Code**:
```python
"""Stock data tools"""

from typing import Dict, Any
from pydantic import BaseModel, Field
import httpx
from errors import handle_backend_error

def register_stock_tools(mcp, http_client: httpx.AsyncClient):
    """Register stock data tools with MCP server"""

    class ListStocksParams(BaseModel):
        limit: int = Field(100, description="Max number of stocks to return", ge=1, le=500)
        offset: int = Field(0, description="Offset for pagination", ge=0)

    @mcp.tool()
    async def list_stocks(params: ListStocksParams) -> Dict[str, Any]:
        """
        List available stock symbols in the database.

        Returns paginated list of tickers with total count.
        """
        try:
            response = await http_client.get(
                "/api/stocks",
                params={"limit": params.limit, "offset": params.offset}
            )
            handle_backend_error(response)

            data = response.json()

            return {
                "success": True,
                "stocks": data.get("stocks", []),
                "total_count": data.get("totalCount", 0),
                "returned_count": len(data.get("stocks", [])),
                "pagination": {
                    "limit": params.limit,
                    "offset": params.offset,
                    "has_more": (params.offset + params.limit) < data.get("totalCount", 0)
                }
            }

        except httpx.RequestError as e:
            raise BackendAPIError(503, f"Cannot connect to backend: {str(e)}")

    class StockInfoParams(BaseModel):
        symbol: str = Field(..., description="Stock ticker symbol")

    @mcp.tool()
    async def get_stock_info(params: StockInfoParams) -> Dict[str, Any]:
        """
        Get detailed information about a stock including date range, beta, and fundamentals.
        """
        try:
            response = await http_client.get(f"/api/stocks/{params.symbol}")
            handle_backend_error(response)

            data = response.json()

            if not data.get("success"):
                raise BackendAPIError(404, f"Stock {params.symbol} not found")

            info = data["data"]

            return {
                "success": True,
                "symbol": params.symbol,
                "company_name": info.get("companyName", "Unknown"),
                "sector": info.get("sector", "Unknown"),
                "market_cap": info.get("marketCap"),
                "beta": round(info.get("beta", 0), 3) if info.get("beta") else None,
                "available_date_range": {
                    "start": info.get("firstDate"),
                    "end": info.get("lastDate"),
                    "total_trading_days": info.get("totalDays", 0)
                },
                "data_quality": {
                    "has_daily_prices": info.get("hasDailyPrices", False),
                    "has_fundamentals": info.get("hasFundamentals", False)
                }
            }

        except httpx.RequestError as e:
            raise BackendAPIError(503, f"Cannot connect to backend: {str(e)}")
```

**Acceptance Criteria**:
- [ ] list_stocks tool works
- [ ] get_stock_info tool works
- [ ] Pagination handled correctly
- [ ] Error handling works

---

### Task 1.8: Test Core Setup
**Time**: 30 minutes
**Priority**: High

**Steps**:
1. Start backend API (`npm run backend:dev`)
2. Start MCP server (`python mcp_server.py`)
3. Test with Claude Code
4. Verify health_check works
5. Verify list_stocks works

**Test Commands** (in Claude Code):
```
"Check the health of the DCA backend API"
"List all available stocks"
"Get information about TSLA"
```

**Acceptance Criteria**:
- [ ] MCP server starts without errors
- [ ] Claude Code can discover tools
- [ ] health_check returns status
- [ ] list_stocks returns data
- [ ] get_stock_info returns data

---

## Phase 2: Backtest Tools (4-6 hours)

### Task 2.1: Implement run_dca_backtest Tool
**Time**: 2 hours
**Priority**: High

**File**: `tools/backtest.py`

**Implementation**: See design.md for complete code (Tool 1: run_dca_backtest)

**Key Features**:
- Accept all DCA parameters (20+ fields)
- Call `/api/backtest/dca` endpoint
- Format results for AI readability
- Handle errors and timeouts

**Acceptance Criteria**:
- [ ] All parameters supported
- [ ] Returns formatted metrics
- [ ] Timeout handling works
- [ ] Error messages clear
- [ ] Can test via Claude Code

**Test**:
```
"Run a DCA backtest for TSLA from 2020-01-01 to 2024-12-31 with 10% grid spacing"
```

---

### Task 2.2: Implement run_portfolio_backtest Tool
**Time**: 1.5 hours
**Priority**: High

**File**: `tools/backtest.py`

**Implementation**: See design.md (Tool 2: run_portfolio_backtest)

**Key Features**:
- Accept list of stocks with allocations
- Validate allocations sum to 100%
- Support beta-adjusted capital allocation
- Return portfolio + per-stock metrics

**Acceptance Criteria**:
- [ ] Portfolio backtest works
- [ ] Allocation validation works
- [ ] Beta adjustment supported
- [ ] Per-stock breakdown returned

**Test**:
```
"Backtest a portfolio of AAPL (30%), GOOGL (30%), MSFT (40%) from 2020-2024 with beta-adjusted capital"
```

---

### Task 2.3: Implement run_batch_optimization Tool
**Time**: 1.5 hours
**Priority**: Medium

**File**: `tools/backtest.py`

**Implementation**: See design.md (Tool 3: run_batch_optimization)

**Key Features**:
- Accept parameter grids
- Generate all combinations
- Run batch backtest
- Rank results by return
- Return top 5 configurations

**Acceptance Criteria**:
- [ ] Parameter combinations generated
- [ ] Batch backtest works
- [ ] Results ranked correctly
- [ ] Best configuration highlighted

**Test**:
```
"Optimize grid spacing for NVDA testing 5%, 10%, and 15% with profit targets from 3-7%"
```

---

### Task 2.4: Add Request Logging
**Time**: 30 minutes
**Priority**: Medium

**File**: `mcp_server.py`

**Code**:
```python
import time
import asyncio

# Add request logging middleware
@mcp.middleware()
async def log_requests(request, handler):
    start_time = time.time()
    logger.info(f"Tool called: {request.tool_name}")

    try:
        result = await handler(request)
        elapsed = time.time() - start_time
        logger.info(f"Tool {request.tool_name} completed in {elapsed:.2f}s")
        return result
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"Tool {request.tool_name} failed after {elapsed:.2f}s: {str(e)}")
        raise
```

**Acceptance Criteria**:
- [ ] All tool calls logged
- [ ] Timing information included
- [ ] Errors logged with details

---

## Phase 3: Analysis Tools (3-4 hours)

### Task 3.1: Implement calculate_beta Tool
**Time**: 1 hour
**Priority**: Medium

**File**: `tools/analysis.py`

**Implementation**: See design.md (Tool 6: calculate_beta)

**Acceptance Criteria**:
- [ ] Beta calculation works
- [ ] Period parameter supported
- [ ] Returns interpretation
- [ ] Handles errors

**Test**:
```
"Calculate the beta for TSLA over the last year"
```

---

### Task 3.2: Implement compare_strategies Tool
**Time**: 1.5 hours
**Priority**: Medium

**File**: `tools/analysis.py`

**Implementation**: See design.md (Tool 7: compare_strategies)

**Key Features**:
- Accept 2-5 strategy configurations
- Run backtest for each
- Compare side-by-side
- Recommend best by Sharpe ratio

**Acceptance Criteria**:
- [ ] Multiple strategies compared
- [ ] Side-by-side comparison table
- [ ] Best strategy recommended
- [ ] Clear reasoning provided

**Test**:
```
"Compare baseline DCA (10% grid, 5% profit) vs aggressive DCA (5% grid, 3% profit) for AAPL from 2020-2024"
```

---

### Task 3.3: Implement get_dca_suitability_score Tool
**Time**: 1 hour
**Priority**: Medium

**File**: `tools/analysis.py`

**Implementation**: See design.md (Tool 8: get_dca_suitability_score)

**Acceptance Criteria**:
- [ ] Returns 0-100 score
- [ ] Provides interpretation
- [ ] Includes recommendation
- [ ] Fast response (<5s)

**Test**:
```
"Is PLTR a good candidate for DCA strategy?"
```

---

### Task 3.4: Add Concurrency Control
**Time**: 30 minutes
**Priority**: High

**File**: `mcp_server.py`

**Code**:
```python
import asyncio

# Limit concurrent backtest requests
backtest_semaphore = asyncio.Semaphore(settings.max_concurrent_requests)

# Apply to backtest tools
@mcp.tool()
async def run_dca_backtest(params):
    async with backtest_semaphore:
        # Run backtest...
```

**Acceptance Criteria**:
- [ ] Concurrent requests limited
- [ ] No resource exhaustion
- [ ] Queue works properly

---

## Phase 4: Testing & Documentation (3-4 hours)

### Task 4.1: Write Unit Tests
**Time**: 2 hours
**Priority**: High

**File**: `tests/test_tools.py`

**Tests to Write**:
```python
# Test health check
async def test_health_check_success()
async def test_health_check_backend_down()

# Test stock tools
async def test_list_stocks()
async def test_get_stock_info_valid()
async def test_get_stock_info_invalid()

# Test backtest tools
async def test_run_dca_backtest_success()
async def test_run_dca_backtest_invalid_symbol()
async def test_run_dca_backtest_invalid_dates()

# Test portfolio backtest
async def test_portfolio_backtest_allocations_sum_100()
async def test_portfolio_backtest_allocations_invalid()

# Test batch optimization
async def test_batch_optimization()
```

**Acceptance Criteria**:
- [ ] 90%+ code coverage
- [ ] All edge cases tested
- [ ] Mock backend responses
- [ ] All tests pass

---

### Task 4.2: Create README.md
**Time**: 1 hour
**Priority**: High

**File**: `README.md`

**Contents**:
```markdown
# DCA Backtest Tool - MCP Server

MCP (Model Context Protocol) server for the Grid-Based DCA Backtest Tool,
enabling AI assistants to run backtests and analyze strategies via natural language.

## Features

- 10+ tools for backtesting, analysis, and optimization
- Natural language interface via Claude Code
- Async operations for performance
- Comprehensive error handling
- Local-only by default (secure)

## Installation

### Prerequisites
- Python 3.11+
- DCA Backend API running on port 3001
- Claude Code or MCP-compatible client

### Setup
```bash
cd mcp-server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env if needed
```

### Configuration
Add to Claude Code config (`~/.config/claude-code/mcp_config.json`):
```json
{
  "mcpServers": {
    "dca-backtest": {
      "command": "python",
      "args": ["/absolute/path/to/mcp-server/mcp_server.py"],
      "env": {
        "BACKEND_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

## Usage

### Start Backend API
```bash
cd /path/to/DCA-Backtest-Tool
npm run backend:dev
```

### Start MCP Server
```bash
cd mcp-server
source venv/bin/activate
python mcp_server.py
```

### Example Prompts

**Basic**:
- "List available stocks"
- "Run a DCA backtest for TSLA from 2020-2024"
- "What's the beta of NVDA?"

**Advanced**:
- "Compare 3 different grid spacings for AAPL"
- "Is PLTR a good candidate for DCA strategy?"
- "Backtest a portfolio with beta-adjusted allocation"

## Available Tools

1. `health_check` - Backend API status
2. `list_stocks` - Available tickers
3. `get_stock_info` - Stock metadata
4. `calculate_beta` - Beta calculation
5. `run_dca_backtest` - Single stock backtest
6. `run_portfolio_backtest` - Portfolio backtest
7. `run_batch_optimization` - Parameter optimization
8. `compare_strategies` - Strategy comparison
9. `get_dca_suitability_score` - DCA suitability analysis

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## License

MIT (same as DCA Backtest Tool)
```

**Acceptance Criteria**:
- [ ] Installation instructions clear
- [ ] Configuration documented
- [ ] Example prompts provided
- [ ] Troubleshooting section included

---

### Task 4.3: Create Integration Guide
**Time**: 1 hour
**Priority**: Medium

**File**: `INTEGRATION-GUIDE.md`

**Contents**:
- Claude Code setup steps
- Testing integration
- Common issues and fixes
- Advanced configuration

**Acceptance Criteria**:
- [ ] Step-by-step guide complete
- [ ] Screenshots/examples included
- [ ] Covers all MCP clients

---

## Phase 5: Deployment & Polish (2-3 hours)

### Task 5.1: Create Installation Script
**Time**: 1 hour
**Priority**: Medium

**File**: `install.sh`

**Code**:
```bash
#!/bin/bash
set -e

echo "Installing DCA Backtest MCP Server..."

# Check Python version
python_version=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
required_version="3.11"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "Error: Python 3.11+ required (found $python_version)"
    exit 1
fi

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv venv

# Activate and install dependencies
echo "Installing dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create .env from example
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
fi

echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Start backend API: npm run backend:dev"
echo "2. Start MCP server: source venv/bin/activate && python mcp_server.py"
echo "3. Configure Claude Code (see INTEGRATION-GUIDE.md)"
```

**Acceptance Criteria**:
- [ ] Script installs dependencies
- [ ] Creates virtual environment
- [ ] Checks Python version
- [ ] Provides next steps

---

### Task 5.2: Create requirements.txt
**Time**: 15 minutes
**Priority**: High

**File**: `requirements.txt`

**Contents**:
```
fastmcp>=0.3.0
httpx>=0.25.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
python-dotenv>=1.0.0

# Testing
pytest>=7.4.0
pytest-asyncio>=0.21.0
pytest-cov>=4.1.0

# Development
black>=23.0.0
ruff>=0.1.0
```

**Acceptance Criteria**:
- [ ] All dependencies listed
- [ ] Version constraints specified
- [ ] Can install without errors

---

### Task 5.3: Create .env.example
**Time**: 10 minutes
**Priority**: Medium

**File**: `.env.example`

**Contents**:
```bash
# Backend API Configuration
BACKEND_API_URL=http://localhost:3001

# Server Settings
API_TIMEOUT=60
MAX_CONCURRENT_REQUESTS=5
LOG_LEVEL=INFO

# Optional: Authentication (future)
# API_KEY=your_api_key_here
```

**Acceptance Criteria**:
- [ ] All config options documented
- [ ] Default values provided
- [ ] Comments explain purpose

---

### Task 5.4: Create TROUBLESHOOTING.md
**Time**: 1 hour
**Priority**: Medium

**File**: `TROUBLESHOOTING.md`

**Contents**:
```markdown
# Troubleshooting

## Backend Connection Issues

**Error**: `Cannot connect to backend: Connection refused`

**Solution**:
1. Ensure backend is running: `npm run backend:dev`
2. Check backend is on port 3001: `curl http://localhost:3001/api/health`
3. Verify BACKEND_API_URL in .env

## MCP Server Not Starting

**Error**: `ModuleNotFoundError: No module named 'fastmcp'`

**Solution**:
```bash
source venv/bin/activate
pip install -r requirements.txt
```

## Tool Not Found in Claude Code

**Solution**:
1. Restart Claude Code after config changes
2. Verify mcp_config.json syntax
3. Check absolute paths (not relative)
4. Ensure MCP server is running

## Backtest Timeouts

**Error**: `Backtest timed out after 60 seconds`

**Solution**:
1. Reduce date range (test with 1 year first)
2. Increase API_TIMEOUT in .env
3. Check backend logs for errors

## Permission Denied

**Error**: `Permission denied: /path/to/mcp_server.py`

**Solution**:
```bash
chmod +x install.sh
python mcp_server.py  # Don't need execute permission for Python
```

## Beta Calculation Fails

**Error**: `Insufficient data for beta calculation`

**Solution**:
- Stock may not have enough price history
- Reduce period parameter (e.g., 30 days instead of 252)
- Check stock data availability: `get_stock_info`
```

**Acceptance Criteria**:
- [ ] Common issues documented
- [ ] Solutions provided
- [ ] Examples included

---

### Task 5.5: Final Integration Test
**Time**: 30 minutes
**Priority**: High

**Steps**:
1. Fresh install using `install.sh`
2. Start backend API
3. Start MCP server
4. Test all 10 tools via Claude Code
5. Verify error handling
6. Check logs

**Test Prompts**:
```
1. "Check backend health"
2. "List 10 stocks"
3. "Get info for AAPL"
4. "Calculate beta for TSLA"
5. "Run DCA backtest for NVDA 2023-2024"
6. "Is PLTR good for DCA?"
7. "Compare 2 strategies for GOOGL"
8. "Optimize parameters for MSFT"
9. "Backtest AAPL/GOOGL/MSFT portfolio"
10. "Test with invalid symbol XYZ"
```

**Acceptance Criteria**:
- [ ] All tools work correctly
- [ ] Error messages clear
- [ ] Performance acceptable (<30s per backtest)
- [ ] Logs show proper activity

---

## Optional Enhancements (Phase 6+)

### Task 6.1: Add Caching Layer
**Time**: 2 hours
**Priority**: Low

**Benefits**:
- Speed up repeated queries
- Reduce backend load
- Better user experience

**Implementation**:
```python
from cachetools import TTLCache

# Cache backtest results for 1 hour
backtest_cache = TTLCache(maxsize=100, ttl=3600)

@mcp.tool()
async def run_dca_backtest(params):
    cache_key = f"{params.symbol}:{params.start_date}:{params.end_date}:{params.grid_spacing}"

    if cache_key in backtest_cache:
        return backtest_cache[cache_key]

    result = await _run_backtest(params)
    backtest_cache[cache_key] = result
    return result
```

---

### Task 6.2: Add Progress Streaming (Future)
**Time**: 3 hours
**Priority**: Low

**Benefits**:
- Show progress for long backtests
- Better UX for batch operations

**Note**: Requires MCP protocol support for streaming

---

### Task 6.3: Add Docker Support
**Time**: 1 hour
**Priority**: Low

**File**: `Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "mcp_server.py"]
```

---

## Summary

### Total Time Estimate: 14-21 hours

**Phase 1** (Core Setup): 2-3 hours
- Environment setup
- Project structure
- Health check + list stocks
- Basic testing

**Phase 2** (Backtest Tools): 4-6 hours
- run_dca_backtest
- run_portfolio_backtest
- run_batch_optimization
- Request logging

**Phase 3** (Analysis Tools): 3-4 hours
- calculate_beta
- compare_strategies
- get_dca_suitability_score
- Concurrency control

**Phase 4** (Testing & Docs): 3-4 hours
- Unit tests
- README
- Integration guide

**Phase 5** (Deployment): 2-3 hours
- Installation script
- Troubleshooting guide
- Final testing

### Success Metrics

✅ All 10 tools implemented and tested
✅ Claude Code integration works seamlessly
✅ Error messages clear and actionable
✅ Documentation complete
✅ Installation takes <5 minutes
✅ Can run backtests via natural language

---

## Dependencies

### External
- FastMCP framework
- httpx (HTTP client)
- pydantic (validation)
- Claude Code or MCP client

### Internal
- DCA Backend API running on port 3001
- stocks.db accessible
- All backend endpoints functional

---

## Testing Checklist

Before marking spec as complete:

- [ ] All 10 tools implemented
- [ ] Unit tests written (90%+ coverage)
- [ ] Integration tests pass
- [ ] Documentation complete
- [ ] Installation script works
- [ ] Claude Code integration tested
- [ ] Error handling verified
- [ ] Performance acceptable
- [ ] Logs provide useful information
- [ ] README includes all setup steps

---

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| FastMCP API changes | High | Pin version in requirements.txt |
| Backend API changes | High | Version backend endpoints |
| Long backtest timeouts | Medium | Add timeout warnings, suggest date range reduction |
| Concurrent request overload | Medium | Semaphore limiting + queue |
| Installation issues | Low | Comprehensive troubleshooting guide |

---

## Next Steps After Completion

1. **User Feedback**: Collect feedback from users
2. **Performance Tuning**: Optimize slow operations
3. **Caching Layer**: Add result caching
4. **Advanced Analytics**: More analysis tools
5. **Remote Deployment**: Support cloud deployment
6. **Monitoring**: Add metrics and health checks
