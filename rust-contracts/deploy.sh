#!/bin/bash

echo "Building L1X contract..."
# Build the contract for wasm32-unknown-unknown target
cargo build --release --target wasm32-unknown-unknown

echo "Ready to deploy to L1X V2 Testnet"
echo "RPC Endpoint: https://v2.testnet.l1x.foundation"
echo ""
echo "When L1X CLI is available, this script will be updated to perform actual deployment."