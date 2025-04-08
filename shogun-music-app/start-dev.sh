#!/bin/bash
echo "Starting Shogun Music App Development Environment..."

# Start the API server in the background
node server.js &
SERVER_PID=$!

# Wait a moment for the server to start
sleep 2

# Start the React dev server
npm run start &
CLIENT_PID=$!

echo "Both servers started!"
echo "API Server: http://localhost:3001"
echo "React App: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Handle shutdown
function cleanup {
  echo "Stopping servers..."
  kill $SERVER_PID
  kill $CLIENT_PID
  exit 0
}

trap cleanup INT

# Keep script running
wait 