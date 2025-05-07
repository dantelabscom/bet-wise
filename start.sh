#!/bin/bash

# Kill any existing Node.js processes
echo "Stopping any existing Node.js processes..."
pkill -f node || true

# Wait a moment to ensure processes are terminated
sleep 2

# Start the server with the custom server.js file
echo "Starting the server with custom WebSocket support..."
node server.js 