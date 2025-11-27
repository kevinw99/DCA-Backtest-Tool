"""Stock data tools"""

from typing import Dict, Any
from pydantic import BaseModel, Field
import httpx
from errors import handle_backend_error, BackendAPIError


def register_stock_tools(mcp, http_client: httpx.AsyncClient):
    """Register stock data tools with MCP server"""

    class ListStocksParams(BaseModel):
        limit: int = Field(
            100, description="Max number of stocks to return", ge=1, le=500
        )
        offset: int = Field(0, description="Offset for pagination", ge=0)

    @mcp.tool()
    async def list_stocks(params: ListStocksParams) -> Dict[str, Any]:
        """
        List available stock symbols in the database.

        Returns paginated list of tickers with total count.
        """
        try:
            response = await http_client.get(
                "/api/stocks", params={"limit": params.limit, "offset": params.offset}
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
                    "has_more": (params.offset + params.limit)
                    < data.get("totalCount", 0),
                },
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
                    "total_trading_days": info.get("totalDays", 0),
                },
                "data_quality": {
                    "has_daily_prices": info.get("hasDailyPrices", False),
                    "has_fundamentals": info.get("hasFundamentals", False),
                },
            }

        except httpx.RequestError as e:
            raise BackendAPIError(503, f"Cannot connect to backend: {str(e)}")
