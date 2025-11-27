"""Health check tools"""

from typing import Dict, Any
import httpx


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
                    "uptime_seconds": data.get("uptime", 0),
                }
            else:
                return {
                    "success": False,
                    "backend_status": "unhealthy",
                    "status_code": response.status_code,
                }

        except httpx.RequestError as e:
            return {
                "success": False,
                "backend_status": "unreachable",
                "error": str(e),
                "suggestion": "Ensure backend API is running on port 3001",
            }
