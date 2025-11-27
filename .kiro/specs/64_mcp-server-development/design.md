# Design: MCP Server for DCA Backtest Tool

**Spec Number**: 64
**Date**: January 2025
**Status**: Planning

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Assistant Layer                        │
│              (Claude Code, Claude Desktop, etc.)             │
└───────────────────────────┬─────────────────────────────────┘
                            │ MCP Protocol (stdio/SSE)
                            │ JSON-RPC 2.0
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   MCP Server (FastMCP)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Tool Layer │  │ Validation   │  │ Error Handler│       │
│  │  - 10+ tools│  │ - Pydantic   │  │ - Clear msgs │       │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘       │
│         └─────────────────┴──────────────────┘               │
│                   HTTP Client Layer                          │
│              (aiohttp/httpx - async)                         │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/REST
                            │ JSON payloads
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              DCA Backend API (Express)                       │
│  Port: 3001                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ /api/backtest│  │ /api/stocks  │  │ /api/beta    │      │
│  │    /dca      │  │              │  │              │      │
│  │  /portfolio  │  │              │  │              │      │
│  │    /batch    │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────┬─────────────────────────────────┘
                            │ SQLite
                            ▼
                     ┌──────────────┐
                     │  stocks.db   │
                     │ (Price data, │
                     │ fundamentals)│
                     └──────────────┘
```

---

## Component Design

### 1. MCP Server (Python/FastMCP)

#### 1.1 Server Structure

```python
# mcp_server.py (main entry point)
from fastmcp import FastMCP
import httpx
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime

# Initialize FastMCP server
mcp = FastMCP("DCA Backtest Tool")

# HTTP client for backend API
API_BASE_URL = "http://localhost:3001"
http_client = httpx.AsyncClient(base_url=API_BASE_URL, timeout=60.0)

# Tool implementations below...
```

#### 1.2 Configuration

```python
# config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    backend_api_url: str = "http://localhost:3001"
    api_timeout: int = 60  # seconds
    max_concurrent_requests: int = 5
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
```

#### 1.3 Error Handling

```python
# errors.py
class MCPError(Exception):
    """Base exception for MCP server errors"""
    pass

class BackendAPIError(MCPError):
    """Backend API returned an error"""
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"Backend API error ({status_code}): {message}")

class ValidationError(MCPError):
    """Invalid parameters provided"""
    pass

class TimeoutError(MCPError):
    """Request timed out"""
    pass

def handle_backend_error(response: httpx.Response) -> None:
    """Convert backend API errors to clear MCP errors"""
    if response.status_code >= 400:
        try:
            error_data = response.json()
            message = error_data.get("error", "Unknown error")
        except:
            message = response.text or "Request failed"
        raise BackendAPIError(response.status_code, message)
```

---

## Tool Implementations

### Tool 1: run_dca_backtest

#### Purpose
Run a single-stock DCA backtest with full parameter control.

#### Implementation

```python
from pydantic import BaseModel, Field

class DCABacktestParams(BaseModel):
    symbol: str = Field(..., description="Stock ticker symbol (e.g., 'TSLA')")
    start_date: str = Field(..., description="Start date in ISO format (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date in ISO format (YYYY-MM-DD)")
    initial_capital: float = Field(10000, description="Initial capital in USD", ge=100)
    grid_spacing: float = Field(0.10, description="Grid spacing as decimal (0.10 = 10%)", gt=0, le=1)
    profit_target: float = Field(0.05, description="Profit target as decimal (0.05 = 5%)", gt=0, le=1)
    enable_momentum_sell: bool = Field(False, description="Enable momentum-based selling")
    enable_trailing_stop_buy: bool = Field(False, description="Enable trailing stop buy orders")
    momentum_lookback_period: Optional[int] = Field(20, description="Days for momentum calculation", ge=1)
    trailing_stop_buy_distance: Optional[float] = Field(0.05, description="Trailing stop distance", gt=0, le=1)

    class Config:
        json_schema_extra = {
            "examples": [{
                "symbol": "TSLA",
                "start_date": "2020-01-01",
                "end_date": "2024-12-31",
                "initial_capital": 10000,
                "grid_spacing": 0.10,
                "profit_target": 0.05
            }]
        }

@mcp.tool()
async def run_dca_backtest(params: DCABacktestParams) -> Dict[str, Any]:
    """
    Run a DCA backtest for a single stock with specified parameters.

    Returns comprehensive metrics including total return, max drawdown,
    number of trades, final capital, and DCA Suitability Score.
    """
    try:
        # Convert params to API format
        payload = params.model_dump()

        # Call backend API
        response = await http_client.post("/api/backtest/dca", json=payload)
        handle_backend_error(response)

        # Parse and format results
        data = response.json()

        if not data.get("success"):
            raise BackendAPIError(500, data.get("error", "Backtest failed"))

        results = data["data"]

        # Format response for AI readability
        return {
            "success": True,
            "symbol": params.symbol,
            "period": f"{params.start_date} to {params.end_date}",
            "metrics": {
                "total_return_pct": round(results["totalReturn"], 2),
                "max_drawdown_pct": round(results["maxDrawdown"], 2),
                "sharpe_ratio": round(results.get("sharpeRatio", 0), 3),
                "num_trades": results["numTrades"],
                "final_capital": round(results["finalCapital"], 2),
                "dca_suitability_score": round(results.get("dcaSuitabilityScore", 0), 1)
            },
            "transaction_summary": {
                "total_buys": results.get("totalBuys", 0),
                "total_sells": results.get("totalSells", 0),
                "avg_buy_price": round(results.get("avgBuyPrice", 0), 2),
                "avg_sell_price": round(results.get("avgSellPrice", 0), 2)
            },
            "parameters_used": {
                "grid_spacing": f"{params.grid_spacing * 100}%",
                "profit_target": f"{params.profit_target * 100}%",
                "momentum_enabled": params.enable_momentum_sell,
                "trailing_stop_enabled": params.enable_trailing_stop_buy
            }
        }

    except httpx.TimeoutException:
        raise TimeoutError("Backtest request timed out after 60 seconds")
    except httpx.RequestError as e:
        raise BackendAPIError(503, f"Cannot connect to backend API: {str(e)}")
```

---

### Tool 2: run_portfolio_backtest

#### Purpose
Run a portfolio backtest with multiple stocks and optional beta-adjusted allocation.

#### Implementation

```python
class StockAllocation(BaseModel):
    symbol: str = Field(..., description="Stock ticker")
    allocation_pct: float = Field(..., description="Portfolio allocation %", ge=0, le=100)

class PortfolioBacktestParams(BaseModel):
    stocks: List[StockAllocation] = Field(..., description="List of stocks with allocations")
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date (YYYY-MM-DD)")
    initial_capital: float = Field(10000, ge=100)
    enable_beta_capital_allocation: bool = Field(False, description="Adjust capital by beta")
    grid_spacing: float = Field(0.10, gt=0, le=1)
    profit_target: float = Field(0.05, gt=0, le=1)

    class Config:
        json_schema_extra = {
            "examples": [{
                "stocks": [
                    {"symbol": "AAPL", "allocation_pct": 30},
                    {"symbol": "GOOGL", "allocation_pct": 30},
                    {"symbol": "MSFT", "allocation_pct": 40}
                ],
                "start_date": "2020-01-01",
                "end_date": "2024-12-31",
                "initial_capital": 50000,
                "enable_beta_capital_allocation": True
            }]
        }

@mcp.tool()
async def run_portfolio_backtest(params: PortfolioBacktestParams) -> Dict[str, Any]:
    """
    Run a portfolio backtest with multiple stocks.

    Returns portfolio-level metrics and per-stock performance breakdown.
    """
    try:
        # Validate allocations sum to 100%
        total_allocation = sum(s.allocation_pct for s in params.stocks)
        if not (99.9 <= total_allocation <= 100.1):
            raise ValidationError(f"Stock allocations must sum to 100% (got {total_allocation}%)")

        # Convert to API format
        payload = {
            "stocks": [{"symbol": s.symbol, "allocation": s.allocation_pct / 100} for s in params.stocks],
            "startDate": params.start_date,
            "endDate": params.end_date,
            "initialCapital": params.initial_capital,
            "enableBetaCapitalAllocation": params.enable_beta_capital_allocation,
            "gridSpacing": params.grid_spacing,
            "profitTarget": params.profit_target
        }

        response = await http_client.post("/api/backtest/portfolio", json=payload)
        handle_backend_error(response)

        data = response.json()
        if not data.get("success"):
            raise BackendAPIError(500, data.get("error", "Portfolio backtest failed"))

        results = data["data"]

        return {
            "success": True,
            "portfolio_metrics": {
                "total_return_pct": round(results["portfolioReturn"], 2),
                "max_drawdown_pct": round(results["portfolioMaxDrawdown"], 2),
                "sharpe_ratio": round(results.get("portfolioSharpeRatio", 0), 3),
                "final_capital": round(results["finalCapital"], 2)
            },
            "stock_performance": [
                {
                    "symbol": stock["symbol"],
                    "return_pct": round(stock["return"], 2),
                    "capital_allocated": round(stock["capitalAllocated"], 2),
                    "final_value": round(stock["finalValue"], 2),
                    "num_trades": stock.get("numTrades", 0)
                }
                for stock in results.get("stockResults", [])
            ],
            "capital_allocation_method": "Beta-adjusted" if params.enable_beta_capital_allocation else "Equal weight"
        }

    except httpx.TimeoutException:
        raise TimeoutError("Portfolio backtest timed out")
    except httpx.RequestError as e:
        raise BackendAPIError(503, f"Cannot connect to backend: {str(e)}")
```

---

### Tool 3: run_batch_optimization

#### Purpose
Test multiple parameter combinations to find optimal settings.

#### Implementation

```python
class ParameterGrid(BaseModel):
    grid_spacing: List[float] = Field(..., description="Grid spacing values to test")
    profit_target: List[float] = Field(..., description="Profit target values to test")
    enable_momentum_sell: Optional[List[bool]] = Field([False], description="Test with/without momentum")

class BatchOptimizationParams(BaseModel):
    symbol: str = Field(..., description="Stock ticker")
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date (YYYY-MM-DD)")
    initial_capital: float = Field(10000, ge=100)
    parameter_grid: ParameterGrid = Field(..., description="Parameters to vary")

    class Config:
        json_schema_extra = {
            "examples": [{
                "symbol": "NVDA",
                "start_date": "2020-01-01",
                "end_date": "2024-12-31",
                "initial_capital": 10000,
                "parameter_grid": {
                    "grid_spacing": [0.05, 0.10, 0.15],
                    "profit_target": [0.03, 0.05, 0.07],
                    "enable_momentum_sell": [False, True]
                }
            }]
        }

@mcp.tool()
async def run_batch_optimization(params: BatchOptimizationParams) -> Dict[str, Any]:
    """
    Run batch backtests across parameter combinations to find optimal settings.

    Returns all results ranked by total return, with best configuration highlighted.
    """
    try:
        # Build parameter combinations
        grid = params.parameter_grid
        combinations = []

        for spacing in grid.grid_spacing:
            for target in grid.profit_target:
                for momentum in (grid.enable_momentum_sell or [False]):
                    combinations.append({
                        "gridSpacing": spacing,
                        "profitTarget": target,
                        "enableMomentumSell": momentum
                    })

        payload = {
            "symbol": params.symbol,
            "startDate": params.start_date,
            "endDate": params.end_date,
            "initialCapital": params.initial_capital,
            "parameterCombinations": combinations
        }

        response = await http_client.post("/api/backtest/batch", json=payload)
        handle_backend_error(response)

        data = response.json()
        if not data.get("success"):
            raise BackendAPIError(500, data.get("error", "Batch optimization failed"))

        results = data["data"]["results"]

        # Sort by total return (descending)
        sorted_results = sorted(results, key=lambda x: x["totalReturn"], reverse=True)
        best = sorted_results[0]

        return {
            "success": True,
            "symbol": params.symbol,
            "total_combinations_tested": len(results),
            "best_configuration": {
                "grid_spacing": f"{best['parameters']['gridSpacing'] * 100}%",
                "profit_target": f"{best['parameters']['profitTarget'] * 100}%",
                "momentum_enabled": best['parameters'].get('enableMomentumSell', False),
                "total_return_pct": round(best["totalReturn"], 2),
                "max_drawdown_pct": round(best["maxDrawdown"], 2),
                "sharpe_ratio": round(best.get("sharpeRatio", 0), 3),
                "num_trades": best["numTrades"]
            },
            "top_5_configurations": [
                {
                    "rank": i + 1,
                    "grid_spacing": f"{r['parameters']['gridSpacing'] * 100}%",
                    "profit_target": f"{r['parameters']['profitTarget'] * 100}%",
                    "total_return_pct": round(r["totalReturn"], 2),
                    "sharpe_ratio": round(r.get("sharpeRatio", 0), 3)
                }
                for i, r in enumerate(sorted_results[:5])
            ]
        }

    except httpx.TimeoutException:
        raise TimeoutError("Batch optimization timed out (consider reducing parameter combinations)")
    except httpx.RequestError as e:
        raise BackendAPIError(503, f"Cannot connect to backend: {str(e)}")
```

---

### Tool 4: list_stocks

#### Purpose
Get available stock symbols from the database.

#### Implementation

```python
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
```

---

### Tool 5: get_stock_info

#### Purpose
Get detailed information about a specific stock.

#### Implementation

```python
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

---

### Tool 6: calculate_beta

#### Purpose
Calculate beta coefficient for a stock relative to S&P 500.

#### Implementation

```python
class BetaParams(BaseModel):
    symbol: str = Field(..., description="Stock ticker symbol")
    period: int = Field(252, description="Number of trading days for calculation", ge=30, le=1260)

@mcp.tool()
async def calculate_beta(params: BetaParams) -> Dict[str, Any]:
    """
    Calculate beta coefficient for a stock over a specified period.

    Returns beta value, correlation coefficient, and date range used.
    """
    try:
        response = await http_client.post(
            "/api/beta/calculate",
            json={"symbol": params.symbol, "period": params.period}
        )
        handle_backend_error(response)

        data = response.json()

        if not data.get("success"):
            raise BackendAPIError(500, data.get("error", "Beta calculation failed"))

        result = data["data"]

        return {
            "success": True,
            "symbol": params.symbol,
            "beta": round(result["beta"], 3),
            "correlation": round(result.get("correlation", 0), 3),
            "period_days": params.period,
            "date_range": {
                "start": result.get("startDate"),
                "end": result.get("endDate")
            },
            "interpretation": (
                "Low volatility (< 1)" if result["beta"] < 1 else
                "Market volatility (≈ 1)" if 0.95 <= result["beta"] <= 1.05 else
                "High volatility (> 1)"
            )
        }

    except httpx.RequestError as e:
        raise BackendAPIError(503, f"Cannot connect to backend: {str(e)}")
```

---

### Tool 7: compare_strategies

#### Purpose
Compare multiple strategy configurations side-by-side.

#### Implementation

```python
class StrategyConfig(BaseModel):
    name: str = Field(..., description="Strategy name for identification")
    grid_spacing: float = Field(..., gt=0, le=1)
    profit_target: float = Field(..., gt=0, le=1)
    enable_momentum_sell: bool = Field(False)
    enable_trailing_stop_buy: bool = Field(False)

class CompareStrategiesParams(BaseModel):
    symbol: str = Field(..., description="Stock ticker")
    strategies: List[StrategyConfig] = Field(..., description="Strategies to compare", min_items=2, max_items=5)
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date (YYYY-MM-DD)")
    initial_capital: float = Field(10000, ge=100)

@mcp.tool()
async def compare_strategies(params: CompareStrategiesParams) -> Dict[str, Any]:
    """
    Compare multiple strategy configurations for the same stock and period.

    Returns side-by-side comparison with best strategy recommendation.
    """
    try:
        # Run backtest for each strategy
        results = []

        for strategy in params.strategies:
            backtest_params = DCABacktestParams(
                symbol=params.symbol,
                start_date=params.start_date,
                end_date=params.end_date,
                initial_capital=params.initial_capital,
                grid_spacing=strategy.grid_spacing,
                profit_target=strategy.profit_target,
                enable_momentum_sell=strategy.enable_momentum_sell,
                enable_trailing_stop_buy=strategy.enable_trailing_stop_buy
            )

            result = await run_dca_backtest(backtest_params)
            results.append({
                "strategy_name": strategy.name,
                "parameters": {
                    "grid_spacing": f"{strategy.grid_spacing * 100}%",
                    "profit_target": f"{strategy.profit_target * 100}%",
                    "momentum": strategy.enable_momentum_sell,
                    "trailing_stop": strategy.enable_trailing_stop_buy
                },
                "metrics": result["metrics"]
            })

        # Find best by Sharpe ratio
        best = max(results, key=lambda x: x["metrics"].get("sharpe_ratio", 0))

        return {
            "success": True,
            "symbol": params.symbol,
            "period": f"{params.start_date} to {params.end_date}",
            "strategies_compared": len(results),
            "comparison_table": results,
            "recommendation": {
                "best_strategy": best["strategy_name"],
                "reason": f"Highest Sharpe ratio ({best['metrics']['sharpe_ratio']})",
                "total_return": f"{best['metrics']['total_return_pct']}%",
                "max_drawdown": f"{best['metrics']['max_drawdown_pct']}%"
            }
        }

    except Exception as e:
        raise BackendAPIError(500, f"Strategy comparison failed: {str(e)}")
```

---

### Tool 8: get_dca_suitability_score

#### Purpose
Calculate DCA Suitability Score from backtest results.

#### Implementation

```python
@mcp.tool()
async def get_dca_suitability_score(symbol: str, start_date: str, end_date: str) -> Dict[str, Any]:
    """
    Get DCA Suitability Score for a stock (runs default backtest and extracts score).

    Returns overall score (0-100) and component breakdown.
    """
    try:
        # Run default backtest to get suitability score
        backtest_params = DCABacktestParams(
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            initial_capital=10000,
            grid_spacing=0.10,
            profit_target=0.05
        )

        result = await run_dca_backtest(backtest_params)

        # Extract suitability score from results
        score = result["metrics"].get("dca_suitability_score", 0)

        # Interpret score
        interpretation = (
            "Poor candidate" if score < 30 else
            "Fair candidate" if score < 50 else
            "Good candidate" if score < 70 else
            "Excellent candidate"
        )

        return {
            "success": True,
            "symbol": symbol,
            "overall_score": score,
            "interpretation": interpretation,
            "recommendation": (
                f"{symbol} is a {interpretation.lower()} for DCA strategy based on "
                f"historical trade activity, mean reversion, and capital efficiency."
            )
        }

    except Exception as e:
        raise BackendAPIError(500, f"Suitability score calculation failed: {str(e)}")
```

---

### Tool 9: health_check

#### Purpose
Verify backend API and database connectivity.

#### Implementation

```python
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

---

## Implementation Phases

### Phase 1: Core Setup (2-3 hours)

**Goal**: Get basic MCP server running with essential tools.

**Tasks**:
1. Set up Python environment with FastMCP
2. Create project structure:
   ```
   mcp-server/
   ├── mcp_server.py       # Main entry point
   ├── config.py           # Configuration
   ├── errors.py           # Error handling
   ├── tools/              # Tool implementations
   │   ├── __init__.py
   │   ├── backtest.py     # Backtest tools
   │   ├── stocks.py       # Stock data tools
   │   └── analysis.py     # Analysis tools
   ├── requirements.txt
   └── README.md
   ```
3. Implement health_check tool
4. Implement list_stocks tool
5. Implement run_dca_backtest tool
6. Test with Claude Code

**Success Criteria**:
- MCP server starts without errors
- AI assistant can list stocks
- AI assistant can run basic backtest

---

### Phase 2: Advanced Tools (4-6 hours)

**Goal**: Add portfolio, batch, and analysis capabilities.

**Tasks**:
1. Implement run_portfolio_backtest
2. Implement run_batch_optimization
3. Implement compare_strategies
4. Implement get_stock_info
5. Implement calculate_beta
6. Implement get_dca_suitability_score
7. Add comprehensive error handling
8. Add request logging

**Success Criteria**:
- All 10 tools functional
- Clear error messages
- Timeout handling works

---

### Phase 3: Testing & Documentation (3-4 hours)

**Goal**: Ensure reliability and usability.

**Tasks**:
1. Write unit tests for each tool
2. Write integration tests with mock backend
3. Create usage documentation
4. Create example prompts
5. Add logging and debugging tools
6. Performance optimization

**Success Criteria**:
- 90%+ test coverage
- Clear documentation
- Example workflows tested

---

### Phase 4: Deployment & Configuration (2-3 hours)

**Goal**: Make MCP server easy to install and use.

**Tasks**:
1. Create installation script
2. Create Claude Code integration guide
3. Create troubleshooting guide
4. Add configuration options
5. Create systemd service file (optional)

**Success Criteria**:
- One-command installation
- Works with Claude Code out-of-box
- Clear setup instructions

---

## File Structure (Final)

```
mcp-server/
├── mcp_server.py              # Main FastMCP server
├── config.py                  # Configuration settings
├── errors.py                  # Error classes
├── tools/
│   ├── __init__.py
│   ├── backtest.py            # run_dca_backtest, run_portfolio_backtest, run_batch_optimization
│   ├── stocks.py              # list_stocks, get_stock_info
│   ├── analysis.py            # compare_strategies, get_dca_suitability_score, calculate_beta
│   └── health.py              # health_check
├── tests/
│   ├── test_backtest_tools.py
│   ├── test_stock_tools.py
│   ├── test_analysis_tools.py
│   └── mock_backend.py        # Mock backend for testing
├── requirements.txt
├── pyproject.toml             # Poetry/setuptools config
├── README.md                  # User documentation
├── INTEGRATION-GUIDE.md       # Claude Code integration steps
├── TROUBLESHOOTING.md         # Common issues and fixes
├── .env.example               # Example configuration
└── install.sh                 # Installation script
```

---

## API Schema Examples

### Tool Schema (Auto-generated by FastMCP)

```json
{
  "name": "run_dca_backtest",
  "description": "Run a DCA backtest for a single stock with specified parameters. Returns comprehensive metrics including total return, max drawdown, number of trades, final capital, and DCA Suitability Score.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "symbol": {
        "type": "string",
        "description": "Stock ticker symbol (e.g., 'TSLA')"
      },
      "start_date": {
        "type": "string",
        "description": "Start date in ISO format (YYYY-MM-DD)"
      },
      "end_date": {
        "type": "string",
        "description": "End date in ISO format (YYYY-MM-DD)"
      },
      "initial_capital": {
        "type": "number",
        "description": "Initial capital in USD",
        "default": 10000,
        "minimum": 100
      },
      "grid_spacing": {
        "type": "number",
        "description": "Grid spacing as decimal (0.10 = 10%)",
        "default": 0.10,
        "minimum": 0,
        "maximum": 1,
        "exclusiveMinimum": true
      },
      "profit_target": {
        "type": "number",
        "description": "Profit target as decimal (0.05 = 5%)",
        "default": 0.05,
        "minimum": 0,
        "maximum": 1,
        "exclusiveMinimum": true
      },
      "enable_momentum_sell": {
        "type": "boolean",
        "description": "Enable momentum-based selling",
        "default": false
      }
    },
    "required": ["symbol", "start_date", "end_date"]
  }
}
```

---

## Testing Strategy

### Unit Tests

```python
# tests/test_backtest_tools.py
import pytest
from mcp_server import run_dca_backtest, DCABacktestParams

@pytest.mark.asyncio
async def test_run_dca_backtest_success(mock_backend):
    """Test successful DCA backtest"""
    params = DCABacktestParams(
        symbol="TSLA",
        start_date="2020-01-01",
        end_date="2024-12-31"
    )

    result = await run_dca_backtest(params)

    assert result["success"] == True
    assert "metrics" in result
    assert result["metrics"]["total_return_pct"] is not None

@pytest.mark.asyncio
async def test_run_dca_backtest_invalid_symbol(mock_backend):
    """Test backtest with invalid symbol"""
    params = DCABacktestParams(
        symbol="INVALID",
        start_date="2020-01-01",
        end_date="2024-12-31"
    )

    with pytest.raises(BackendAPIError) as exc:
        await run_dca_backtest(params)

    assert "not found" in str(exc.value).lower()
```

### Integration Tests

```python
# tests/test_integration.py
import pytest
from fastmcp.testing import MCPTestClient

@pytest.mark.asyncio
async def test_full_workflow():
    """Test complete workflow: list stocks → get info → run backtest"""
    async with MCPTestClient("mcp_server") as client:
        # List stocks
        stocks = await client.call_tool("list_stocks", {"limit": 10})
        assert len(stocks["stocks"]) > 0

        # Get info for first stock
        symbol = stocks["stocks"][0]
        info = await client.call_tool("get_stock_info", {"symbol": symbol})
        assert info["success"] == True

        # Run backtest
        backtest = await client.call_tool("run_dca_backtest", {
            "symbol": symbol,
            "start_date": "2023-01-01",
            "end_date": "2023-12-31"
        })
        assert backtest["success"] == True
```

---

## Error Handling Patterns

### User-Friendly Error Messages

```python
# Good error messages for AI interpretation
{
    "error": "Stock symbol 'XYZ' not found in database",
    "suggestion": "Use list_stocks tool to see available symbols",
    "available_stocks_sample": ["AAPL", "TSLA", "GOOGL", "..."]
}

{
    "error": "Date range invalid: start_date must be before end_date",
    "details": {
        "start_date": "2024-01-01",
        "end_date": "2020-01-01"
    },
    "suggestion": "Swap the dates or use a valid date range"
}

{
    "error": "Backtest timeout: processing took longer than 60 seconds",
    "suggestion": "Try reducing the date range or use batch optimization with fewer parameter combinations"
}
```

---

## Performance Considerations

### Concurrency

```python
# Allow up to 5 concurrent backtest requests
import asyncio
semaphore = asyncio.Semaphore(5)

@mcp.tool()
async def run_dca_backtest(params: DCABacktestParams):
    async with semaphore:
        # Run backtest...
```

### Caching (Future Enhancement)

```python
# Cache backtest results for 1 hour
from cachetools import TTLCache
cache = TTLCache(maxsize=100, ttl=3600)

@mcp.tool()
async def run_dca_backtest(params: DCABacktestParams):
    cache_key = f"{params.symbol}:{params.start_date}:{params.end_date}:{params.grid_spacing}"
    if cache_key in cache:
        return cache[cache_key]

    result = await _run_backtest(params)
    cache[cache_key] = result
    return result
```

---

## Security Considerations

### Local-Only by Default

```python
# config.py
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

# Reject remote connections
def validate_request_origin(request):
    if request.client.host not in ALLOWED_HOSTS:
        raise SecurityError("MCP server only accepts local connections")
```

### Rate Limiting

```python
from slowapi import Limiter

limiter = Limiter(key_func=lambda: "global")

@limiter.limit("10/minute")
@mcp.tool()
async def run_batch_optimization(params):
    # Prevent abuse of expensive operations
```

---

## Deployment Options

### Option 1: Local Development (Recommended)

```bash
# Install and run locally
cd mcp-server
pip install -e .
python mcp_server.py

# Configure Claude Code
# Add to claude_desktop_config.json:
{
  "mcpServers": {
    "dca-backtest": {
      "command": "python",
      "args": ["/path/to/mcp_server.py"]
    }
  }
}
```

### Option 2: System Service (Linux)

```ini
# /etc/systemd/system/dca-mcp-server.service
[Unit]
Description=DCA Backtest MCP Server
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/path/to/mcp-server
ExecStart=/usr/bin/python3 mcp_server.py
Restart=always

[Install]
WantedBy=multi-user.target
```

### Option 3: Docker (Future)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "mcp_server.py"]
```

---

## Integration with Claude Code

### Installation Steps

1. **Install MCP Server**:
   ```bash
   cd /path/to/DCA-Backtest-Tool
   git clone mcp-server  # Or create mcp-server directory
   cd mcp-server
   pip install -r requirements.txt
   ```

2. **Configure Claude Code**:
   Edit `~/.config/claude-code/mcp_config.json`:
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

3. **Start Backend API**:
   ```bash
   cd /path/to/DCA-Backtest-Tool
   npm run backend:dev
   ```

4. **Test Integration**:
   ```bash
   # In Claude Code:
   # "List available stocks"
   # "Run a DCA backtest for TSLA from 2020-2024"
   ```

---

## Example Prompts

### Basic Usage

```
"What stocks are available in the database?"
→ Uses list_stocks tool

"Run a DCA backtest for NVDA from 2020-01-01 to 2024-12-31"
→ Uses run_dca_backtest tool

"What's the beta of TSLA?"
→ Uses calculate_beta tool
```

### Advanced Usage

```
"Compare 3 different grid spacings for AAPL (5%, 10%, 15%) from 2020-2024"
→ Uses run_batch_optimization or compare_strategies

"Is PLTR a good candidate for DCA strategy?"
→ Uses get_dca_suitability_score

"Backtest a portfolio of AAPL (30%), GOOGL (30%), MSFT (40%) with beta-adjusted capital"
→ Uses run_portfolio_backtest
```

### Workflow Examples

```
"Find the best DCA strategy for TSLA over the last 4 years"
1. Uses get_stock_info to verify data availability
2. Uses run_batch_optimization to test parameter grid
3. Returns best configuration with metrics

"Show me all tech stocks and backtest the top 3 performers"
1. Uses list_stocks
2. Uses get_stock_info for each to filter by sector
3. Uses run_dca_backtest for each
4. Compares results and ranks
```

---

## Trade-offs and Decisions

### Decision 1: FastMCP vs Custom MCP Implementation
**Choice**: FastMCP
**Rationale**:
- FastMCP handles MCP protocol details (stdio, SSE transport)
- Pydantic integration for parameter validation
- Less boilerplate code
- Well-maintained by MCP community

### Decision 2: Sync vs Async HTTP Client
**Choice**: Async (httpx/aiohttp)
**Rationale**:
- Backtests can take 10-30 seconds
- Async allows concurrent requests
- Better performance for batch operations
- FastMCP supports async natively

### Decision 3: Tool Granularity
**Choice**: 10 tools (not 3 mega-tools, not 30 micro-tools)
**Rationale**:
- Each tool has clear single purpose
- Easy for AI to discover and use
- Matches backend API structure
- Avoids overwhelming AI with too many options

### Decision 4: Error Message Format
**Choice**: Structured JSON with suggestions
**Rationale**:
- AI can interpret and act on errors
- Suggestions guide next steps
- Clear distinction between user error vs system error

### Decision 5: Local-Only by Default
**Choice**: No remote access without explicit configuration
**Rationale**:
- Security best practice
- Prevents accidental exposure
- Matches Claude Code local execution model

---

## Rollback Plan

If MCP server doesn't work as expected:

1. **Disable MCP server**: Remove from Claude Code config
2. **Fall back to curl**: Continue using curl commands for testing
3. **Debug incrementally**: Enable one tool at a time
4. **Check logs**: FastMCP provides detailed error logs

**Risk**: Very low - MCP server is additive, doesn't modify existing code

---

## Future Enhancements (Phase 2+)

1. **Streaming Results**: For long-running backtests, stream progress updates
2. **Caching Layer**: Cache backtest results to speed up repeated queries
3. **Advanced Analytics**: Add more analysis tools (correlation matrix, risk metrics)
4. **Chart Generation**: Return base64-encoded charts (if MCP supports images)
5. **Database Queries**: Direct SQLite queries for custom analysis
6. **Remote Deployment**: Deploy MCP server on cloud with authentication

---

## References

- [FastMCP Documentation](https://github.com/jlowin/fastmcp)
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Claude Code MCP Integration](https://docs.anthropic.com/claude-code/mcp)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- DCA Backend API (internal documentation)
