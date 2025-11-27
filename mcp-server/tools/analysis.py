"""Analysis tools"""

from typing import Dict, Any, List
from pydantic import BaseModel, Field
import httpx
from errors import handle_backend_error, BackendAPIError


def register_analysis_tools(mcp, http_client: httpx.AsyncClient):
    """Register analysis tools with MCP server"""

    # ==================== Calculate Beta ====================

    class BetaParams(BaseModel):
        symbol: str = Field(..., description="Stock ticker symbol")
        period: int = Field(
            252,
            description="Number of trading days for calculation",
            ge=30,
            le=1260,
        )

    @mcp.tool()
    async def calculate_beta(params: BetaParams) -> Dict[str, Any]:
        """
        Calculate beta coefficient for a stock over a specified period.

        Returns beta value, correlation coefficient, and date range used.
        """
        try:
            response = await http_client.post(
                "/api/beta/calculate",
                json={"symbol": params.symbol, "period": params.period},
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
                    "end": result.get("endDate"),
                },
                "interpretation": (
                    "Low volatility (< 1)"
                    if result["beta"] < 1
                    else "Market volatility (≈ 1)"
                    if 0.95 <= result["beta"] <= 1.05
                    else "High volatility (> 1)"
                ),
            }

        except httpx.RequestError as e:
            raise BackendAPIError(503, f"Cannot connect to backend: {str(e)}")

    # ==================== Compare Strategies ====================

    class StrategyConfig(BaseModel):
        name: str = Field(..., description="Strategy name for identification")
        grid_spacing: float = Field(..., gt=0, le=1)
        profit_target: float = Field(..., gt=0, le=1)
        enable_momentum_sell: bool = Field(False)
        enable_trailing_stop_buy: bool = Field(False)

    class CompareStrategiesParams(BaseModel):
        symbol: str = Field(..., description="Stock ticker")
        strategies: List[StrategyConfig] = Field(
            ..., description="Strategies to compare", min_length=2, max_length=5
        )
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
                # Build backtest params
                backtest_params = {
                    "symbol": params.symbol,
                    "start_date": params.start_date,
                    "end_date": params.end_date,
                    "initial_capital": params.initial_capital,
                    "grid_spacing": strategy.grid_spacing,
                    "profit_target": strategy.profit_target,
                    "enable_momentum_sell": strategy.enable_momentum_sell,
                    "enable_trailing_stop_buy": strategy.enable_trailing_stop_buy,
                }

                # Call backend API directly
                response = await http_client.post(
                    "/api/backtest/dca", json=backtest_params
                )
                handle_backend_error(response)

                data = response.json()
                if not data.get("success"):
                    raise BackendAPIError(
                        500, f"Backtest failed for {strategy.name}"
                    )

                result_data = data["data"]
                results.append(
                    {
                        "strategy_name": strategy.name,
                        "parameters": {
                            "grid_spacing": f"{strategy.grid_spacing * 100}%",
                            "profit_target": f"{strategy.profit_target * 100}%",
                            "momentum": strategy.enable_momentum_sell,
                            "trailing_stop": strategy.enable_trailing_stop_buy,
                        },
                        "metrics": {
                            "total_return_pct": round(result_data["totalReturn"], 2),
                            "max_drawdown_pct": round(result_data["maxDrawdown"], 2),
                            "sharpe_ratio": round(
                                result_data.get("sharpeRatio", 0), 3
                            ),
                            "num_trades": result_data["numTrades"],
                            "final_capital": round(result_data["finalCapital"], 2),
                        },
                    }
                )

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
                    "max_drawdown": f"{best['metrics']['max_drawdown_pct']}%",
                },
            }

        except Exception as e:
            raise BackendAPIError(500, f"Strategy comparison failed: {str(e)}")

    # ==================== DCA Suitability Score ====================

    class DcaSuitabilityParams(BaseModel):
        symbol: str = Field(..., description="Stock ticker")
        start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
        end_date: str = Field(..., description="End date (YYYY-MM-DD)")

    @mcp.tool()
    async def get_dca_suitability_score(params: DcaSuitabilityParams) -> Dict[str, Any]:
        """
        Get DCA Suitability Score for a stock (runs default backtest and extracts score).

        Returns overall score (0-100) and component breakdown.
        """
        try:
            # Run default backtest to get suitability score
            backtest_params = {
                "symbol": params.symbol,
                "start_date": params.start_date,
                "end_date": params.end_date,
                "initial_capital": 10000,
                "grid_spacing": 0.10,
                "profit_target": 0.05,
            }

            response = await http_client.post("/api/backtest/dca", json=backtest_params)
            handle_backend_error(response)

            data = response.json()
            if not data.get("success"):
                raise BackendAPIError(500, data.get("error", "Backtest failed"))

            result = data["data"]

            # Extract suitability score from results
            score = result.get("dcaSuitabilityScore", 0)

            # Interpret score
            interpretation = (
                "Poor candidate"
                if score < 30
                else "Fair candidate"
                if score < 50
                else "Good candidate"
                if score < 70
                else "Excellent candidate"
            )

            return {
                "success": True,
                "symbol": params.symbol,
                "overall_score": round(score, 1),
                "interpretation": interpretation,
                "recommendation": (
                    f"{params.symbol} is a {interpretation.lower()} for DCA strategy based on "
                    f"historical trade activity, mean reversion, and capital efficiency."
                ),
            }

        except httpx.RequestError as e:
            raise BackendAPIError(503, f"Cannot connect to backend: {str(e)}")
        except Exception as e:
            raise BackendAPIError(500, f"Suitability score calculation failed: {str(e)}")
