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
            "details": self.details,
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
