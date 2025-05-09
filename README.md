# One Capital Auto-Investing

A decentralized application (dApp) for automated investment portfolio management on the Layer One X (L1X) blockchain.

## Project Overview

One Capital Auto-Investing is a dApp that automates portfolio management with the following key features:

- Smart contract-based vaults for custodial and non-custodial investments
- Automated portfolio rebalancing based on target allocations
- Take-profit strategies with multiple trigger options (manual, time-based, percentage-gain)
- Bridgeless swaps using L1X's X-Talk protocol
- Web2/Web3 authentication options

## Project Structure

The project is structured into two main components:

1. **Smart Contracts (Rust)**: Located in the `rust-contracts` directory
   - Written in Rust targeting WebAssembly for the L1X Virtual Machine
   - Implement core functionality for vaults, allocations, rebalancing, and take-profit logic

2. **Web Application (React)**: Located in the `client` directory
   - Frontend: React with Tailwind CSS
   - Backend: Node.js/Express with PostgreSQL
   - Authentication: Support for both Web3 wallet and Firebase email/password

## Getting Started

### Prerequisites

- Node.js (v16+)
- Rust and Cargo (latest stable)
- wasm-pack
- L1X CLI (for deployment)
- PostgreSQL

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/Andrew-L1x/one-capital-autoinvesting.git
   cd one-capital-autoinvesting
   ```

2. Install Node.js dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file with the following variables:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/one_capital
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
   VITE_FIREBASE_APP_ID=your_firebase_app_id
   ```

4. Build the Rust smart contracts:
   ```
   cd rust-contracts
   cargo build
   wasm-pack build --target web
   ```

5. Start the development server:
   ```
   npm run dev
   ```

## Smart Contracts

The Rust smart contracts are organized into the following modules:

- **allocation**: Defines asset allocations and allocation sets
- **custodial_vault**: Implements custodial vault functionality
- **non_custodial_vault**: Implements non-custodial vault functionality
- **portfolio**: Provides portfolio management functions
- **rebalance**: Handles rebalancing logic
- **take_profit**: Implements take profit strategies
- **wallet**: Provides wallet functionality
- **xtalk**: Integrates with L1X's X-Talk protocol for bridgeless swaps

To build and test the smart contracts:

```bash
cd rust-contracts
cargo build --target wasm32-unknown-unknown --release
```

## L1X Contract Development Notes

When working with L1X contracts, please be aware of the following:

### Current L1X Toolchain Limitation

There's a known issue with the L1X WASM LLVMIR toolchain (v0.2.2) that causes the following error:
```
thread 'main' panicked at '.../l1x-wasm-llvmir-0.2.2/src/environment_impl.rs:2559:21:
not implemented: MemoryCopy { dst_mem: 0, src_mem: 0 }
```

This appears to be a limitation in the current L1X toolchain and not an issue with our contract code. While this is being addressed, you can:

1. Use the simplified contract in `rust-contracts/src/lib.rs` which follows the standard L1X contract pattern
2. Check for updates to the L1X toolchain
3. Run `./rust-contracts/deploy.sh` which will build the contract and prepare it for deployment when possible

### Testing with L1X V2 Testnet

To test your contract with the L1X V2 Testnet:

1. Use the Testnet RPC endpoint: `https://v2.testnet.l1x.foundation`
2. Request testnet tokens from the L1X faucet
3. Deploy your contract using the L1X CLI when available

## Running the Application

To run the One Capital Auto-Investing application:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Access the application:
   - Backend API: http://localhost:5000
   - Frontend UI: http://localhost:5173
