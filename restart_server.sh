#!/bin/bash

echo "🔄 Restarting backend server on port 3001..."

# Kill any existing Node.js processes running on port 3001
echo "📴 Stopping existing server processes..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
pkill -f "node server.js" 2>/dev/null || true

# Wait a moment for processes to terminate
sleep 1

# Start the backend server
echo "🚀 Starting backend server..."
cd backend && npm start &

# Get the process ID
SERVER_PID=$!

echo "✅ Backend server started with PID: $SERVER_PID"
echo "🌐 Server running at: http://localhost:3001"
echo "📊 Health check: http://localhost:3001/api/health"
echo ""
echo "To stop the server, run: kill $SERVER_PID"
echo "Or use: pkill -f 'node server.js'"