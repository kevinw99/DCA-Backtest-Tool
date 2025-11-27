#!/bin/bash
set -e

echo "🚀 Installing DCA Trading Simulator MCP Server..."
echo ""

# Check Python version
echo "Checking Python version..."
if ! command -v python3.11 &> /dev/null; then
    echo "❌ Error: Python 3.11+ required"
    echo "Install with: brew install python@3.11"
    exit 1
fi

python_version=$(python3.11 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✓ Found Python $python_version"
echo ""

# Create virtual environment
echo "Creating virtual environment..."
if [ -d "venv" ]; then
    echo "Virtual environment already exists, skipping creation"
else
    python3.11 -m venv venv
    echo "✓ Virtual environment created"
fi
echo ""

# Activate and install dependencies
echo "Installing dependencies..."
source venv/bin/activate
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
echo "✓ Dependencies installed"
echo ""

# Create .env from example
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "✓ .env file created"
else
    echo ".env file already exists, skipping"
fi
echo ""

echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Start backend API:"
echo "   cd .. && npm run backend:dev"
echo ""
echo "2. Start MCP server:"
echo "   cd mcp-server && source venv/bin/activate && python mcp_server.py"
echo ""
echo "3. Configure Claude Code:"
echo "   Add mcp-server to ~/.config/claude-code/mcp_config.json"
echo "   (See README.md for configuration example)"
echo ""
