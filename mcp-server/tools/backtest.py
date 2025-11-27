"""Backtest tools"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
import httpx
from errors import handle_backend_error, BackendAPIError, ValidationError, TimeoutError


def register_backtest_tools(mcp, http_client: httpx.AsyncClient):
    """Register backtest tools with MCP server"""

    # ==================== DCA Backtest ====================

    class DCABacktestParams(BaseModel):
        symbol: str = Field(..., description="Stock ticker symbol (e.g., 'TSLA')")
        start_date: str = Field(
            ..., description="Start date in ISO format (YYYY-MM-DD)"
        )
        end_date: str = Field(..., description="End date in ISO format (YYYY-MM-DD)")
        initial_capital: float = Field(
            10000, description="Initial capital in USD", ge=100
        )
        grid_spacing: float = Field(
            0.10,
            description="Grid spacing as decimal (0.10 = 10%)",
            gt=0,
            le=1,
        )
        profit_target: float = Field(
            0.05, description="Profit target as decimal (0.05 = 5%)", gt=0, le=1
        )
        enable_momentum_sell: bool = Field(
            False, description="Enable momentum-based selling"
        )
        enable_trailing_stop_buy: bool = Field(
            False, description="Enable trailing stop buy orders"
        )
        momentum_lookback_period: Optional[int] = Field(
            20, description="Days for momentum calculation", ge=1
        )
        trailing_stop_buy_distance: Optional[float] = Field(
            0.05, description="Trailing stop distance", gt=0, le=1
        )

        class Config:
            json_schema_extra = {
                "examples": [
                    {
                        "symbol": "TSLA",
                        "start_date": "2020-01-01",
                        "end_date": "2024-12-31",
                        "initial_capital": 10000,
                        "grid_spacing": 0.10,
                        "profit_target": 0.05,
                    }
                ]
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
                    "dca_suitability_score": round(
                        results.get("dcaSuitabilityScore", 0), 1
                    ),
                },
                "transaction_summary": {
                    "total_buys": results.get("totalBuys", 0),
                    "total_sells": results.get("totalSells", 0),
                    "avg_buy_price": round(results.get("avgBuyPrice", 0), 2),
                    "avg_sell_price": round(results.get("avgSellPrice", 0), 2),
                },
                "parameters_used": {
                    "grid_spacing": f"{params.grid_spacing * 100}%",
                    "profit_target": f"{params.profit_target * 100}%",
                    "momentum_enabled": params.enable_momentum_sell,
                    "trailing_stop_enabled": params.enable_trailing_stop_buy,
                },
            }

        except httpx.TimeoutException:
            raise TimeoutError("DCA backtest", 60)
        except httpx.RequestError as e:
            raise BackendAPIError(503, f"Cannot connect to backend API: {str(e)}")

    # ==================== Portfolio Backtest ====================

    class StockAllocation(BaseModel):
        symbol: str = Field(..., description="Stock ticker")
        allocation_pct: float = Field(
            ..., description="Portfolio allocation %", ge=0, le=100
        )

    class PortfolioBacktestParams(BaseModel):
        stocks: List[StockAllocation] = Field(
            ..., description="List of stocks with allocations"
        )
        start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
        end_date: str = Field(..., description="End date (YYYY-MM-DD)")
        initial_capital: float = Field(10000, ge=100)
        enable_beta_capital_allocation: bool = Field(
            False, description="Adjust capital by beta"
        )
        grid_spacing: float = Field(0.10, gt=0, le=1)
        profit_target: float = Field(0.05, gt=0, le=1)

        class Config:
            json_schema_extra = {
                "examples": [
                    {
                        "stocks": [
                            {"symbol": "AAPL", "allocation_pct": 30},
                            {"symbol": "GOOGL", "allocation_pct": 30},
                            {"symbol": "MSFT", "allocation_pct": 40},
                        ],
                        "start_date": "2020-01-01",
                        "end_date": "2024-12-31",
                        "initial_capital": 50000,
                        "enable_beta_capital_allocation": True,
                    }
                ]
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
                raise ValidationError(
                    f"Stock allocations must sum to 100% (got {total_allocation}%)"
                )

            # Convert to API format
            payload = {
                "stocks": [
                    {"symbol": s.symbol, "allocation": s.allocation_pct / 100}
                    for s in params.stocks
                ],
                "startDate": params.start_date,
                "endDate": params.end_date,
                "initialCapital": params.initial_capital,
                "enableBetaCapitalAllocation": params.enable_beta_capital_allocation,
                "gridSpacing": params.grid_spacing,
                "profitTarget": params.profit_target,
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
                    "final_capital": round(results["finalCapital"], 2),
                },
                "stock_performance": [
                    {
                        "symbol": stock["symbol"],
                        "return_pct": round(stock["return"], 2),
                        "capital_allocated": round(stock["capitalAllocated"], 2),
                        "final_value": round(stock["finalValue"], 2),
                        "num_trades": stock.get("numTrades", 0),
                    }
                    for stock in results.get("stockResults", [])
                ],
                "capital_allocation_method": (
                    "Beta-adjusted"
                    if params.enable_beta_capital_allocation
                    else "Equal weight"
                ),
            }

        except httpx.TimeoutException:
            raise TimeoutError("Portfolio backtest", 60)
        except httpx.RequestError as e:
            raise BackendAPIError(503, f"Cannot connect to backend: {str(e)}")

    # ==================== Batch Optimization ====================

    class ParameterGrid(BaseModel):
        grid_spacing: List[float] = Field(..., description="Grid spacing values to test")
        profit_target: List[float] = Field(
            ..., description="Profit target values to test"
        )
        enable_momentum_sell: Optional[List[bool]] = Field(
            [False], description="Test with/without momentum"
        )

    class BatchOptimizationParams(BaseModel):
        symbol: str = Field(..., description="Stock ticker")
        start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
        end_date: str = Field(..., description="End date (YYYY-MM-DD)")
        initial_capital: float = Field(10000, ge=100)
        parameter_grid: ParameterGrid = Field(..., description="Parameters to vary")

        class Config:
            json_schema_extra = {
                "examples": [
                    {
                        "symbol": "NVDA",
                        "start_date": "2020-01-01",
                        "end_date": "2024-12-31",
                        "initial_capital": 10000,
                        "parameter_grid": {
                            "grid_spacing": [0.05, 0.10, 0.15],
                            "profit_target": [0.03, 0.05, 0.07],
                            "enable_momentum_sell": [False, True],
                        },
                    }
                ]
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
                    for momentum in grid.enable_momentum_sell or [False]:
                        combinations.append(
                            {
                                "gridSpacing": spacing,
                                "profitTarget": target,
                                "enableMomentumSell": momentum,
                            }
                        )

            payload = {
                "symbol": params.symbol,
                "startDate": params.start_date,
                "endDate": params.end_date,
                "initialCapital": params.initial_capital,
                "parameterCombinations": combinations,
            }

            response = await http_client.post("/api/backtest/batch", json=payload)
            handle_backend_error(response)

            data = response.json()
            if not data.get("success"):
                raise BackendAPIError(500, data.get("error", "Batch optimization failed"))

            results = data["data"]["results"]

            # Sort by total return (descending)
            sorted_results = sorted(
                results, key=lambda x: x["totalReturn"], reverse=True
            )
            best = sorted_results[0]

            return {
                "success": True,
                "symbol": params.symbol,
                "total_combinations_tested": len(results),
                "best_configuration": {
                    "grid_spacing": f"{best['parameters']['gridSpacing'] * 100}%",
                    "profit_target": f"{best['parameters']['profitTarget'] * 100}%",
                    "momentum_enabled": best["parameters"].get(
                        "enableMomentumSell", False
                    ),
                    "total_return_pct": round(best["totalReturn"], 2),
                    "max_drawdown_pct": round(best["maxDrawdown"], 2),
                    "sharpe_ratio": round(best.get("sharpeRatio", 0), 3),
                    "num_trades": best["numTrades"],
                },
                "top_5_configurations": [
                    {
                        "rank": i + 1,
                        "grid_spacing": f"{r['parameters']['gridSpacing'] * 100}%",
                        "profit_target": f"{r['parameters']['profitTarget'] * 100}%",
                        "total_return_pct": round(r["totalReturn"], 2),
                        "sharpe_ratio": round(r.get("sharpeRatio", 0), 3),
                    }
                    for i, r in enumerate(sorted_results[:5])
                ],
            }

        except httpx.TimeoutException:
            raise TimeoutError(
                "Batch optimization", 60
            )
        except httpx.RequestError as e:
            raise BackendAPIError(503, f"Cannot connect to backend: {str(e)}")
