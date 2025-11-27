"""Configuration settings for MCP Server"""

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
