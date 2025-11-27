"""MCP Server for DCA Backtest Tool"""

from fastmcp import FastMCP
import httpx
import logging
from config import settings

# Configure logging
logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Initialize FastMCP server
mcp = FastMCP("DCA Backtest Tool")

# HTTP client for backend API
http_client = httpx.AsyncClient(
    base_url=settings.backend_api_url, timeout=settings.api_timeout
)

# Import tool implementations
from tools.health import register_health_tools
from tools.stocks import register_stock_tools
from tools.backtest import register_backtest_tools
from tools.analysis import register_analysis_tools

# Register all tools
logger.info("Registering MCP tools...")
register_health_tools(mcp, http_client)
register_stock_tools(mcp, http_client)
register_backtest_tools(mcp, http_client)
register_analysis_tools(mcp, http_client)
logger.info("All tools registered successfully")

if __name__ == "__main__":
    logger.info(f"Starting MCP server, connecting to {settings.backend_api_url}")
    mcp.run()
