#!/bin/bash
# Launch Chrome with remote debugging enabled for Chrome DevTools MCP
# Usage: ./scripts/launch-chrome-debug.sh [optional-url]

PORT=9222
URL="${1:-http://localhost:3000}"

# Check if Chrome is already running with debug port
if lsof -i :$PORT > /dev/null 2>&1; then
    echo "Chrome debug port $PORT is already in use"
    echo "Existing process:"
    lsof -i :$PORT
    exit 0
fi

echo "Launching Chrome with remote debugging on port $PORT..."
echo "Opening: $URL"

# macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
        --remote-debugging-port=$PORT \
        --user-data-dir="/tmp/chrome-debug-profile" \
        "$URL" &
# Linux
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    google-chrome \
        --remote-debugging-port=$PORT \
        --user-data-dir="/tmp/chrome-debug-profile" \
        "$URL" &
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

echo "Chrome launched. Debug port: $PORT"
echo ""
echo "Claude Code can now use Chrome DevTools MCP tools:"
echo "  - mcp__chrome-devtools__list_tabs"
echo "  - mcp__chrome-devtools__get_console_logs"
echo "  - mcp__chrome-devtools__screenshot"
echo "  - mcp__chrome-devtools__evaluate"
echo "  - etc."
