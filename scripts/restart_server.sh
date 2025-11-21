#!/bin/bash

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "🔄 Restarting both backend and frontend servers..."

# Kill any existing processes
echo "📴 Stopping existing server processes..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true  # Backend port
lsof -ti:3000 | xargs kill -9 2>/dev/null || true  # Frontend port
pkill -f "node server.js" 2>/dev/null || true
pkill -f "react-scripts start" 2>/dev/null || true

# Wait a moment for processes to terminate
sleep 2

# Check and install backend dependencies if needed
if [ ! -d "$SCRIPT_DIR/backend/node_modules" ]; then
  echo "📦 Installing backend dependencies..."
  cd "$SCRIPT_DIR/backend" && npm install
fi

# Check and install frontend dependencies if needed
if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  cd "$SCRIPT_DIR/frontend" && npm install
fi

# Start the backend server
echo "🚀 Starting backend server on port 3001..."
cd "$SCRIPT_DIR/backend" && npm start > /dev/null 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start the frontend server
echo "🚀 Starting frontend server on port 3000..."
cd "$SCRIPT_DIR/frontend" && npm start > /dev/null 2>&1 &
FRONTEND_PID=$!

echo "✅ Backend server started with PID: $BACKEND_PID"
echo "✅ Frontend server started with PID: $FRONTEND_PID"
echo ""
echo "🌐 Backend API: http://localhost:3001"
echo "🌐 Frontend UI: http://localhost:3000"
echo "📊 Health check: http://localhost:3001/api/health"
echo ""
echo "To stop servers, run:"
echo "  Backend: kill $BACKEND_PID"
echo "  Frontend: kill $FRONTEND_PID"
echo "Or use: pkill -f 'node server.js' && pkill -f 'react-scripts'"