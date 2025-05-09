#!/bin/bash

# Set environment variables
export VITE_L1X_RPC_URL=https://v2.testnet.l1x.foundation
export PORT=5000

# Print welcome message
echo "======================================"
echo "One Capital Auto-Investing dApp Setup"
echo "======================================"
echo ""
echo "Setting up environment..."
echo "L1X RPC URL: $VITE_L1X_RPC_URL"
echo ""

# Start the development server
echo "Starting the application..."
npm run dev

# Display URLs
echo ""
echo "======================================"
echo "Application running:"
echo "Backend API: http://localhost:$PORT"
echo "Frontend UI: http://localhost:5173"
echo "======================================"