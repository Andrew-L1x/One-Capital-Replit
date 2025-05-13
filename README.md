# One Capital Auto-Investing

A cutting-edge decentralized application (dApp) for automated investment portfolio management on the Layer One X (L1X) blockchain, featuring secure cross-chain functionality via the XTalk Protocol.

## Project Overview

One Capital Auto-Investing is a sophisticated dApp that automates portfolio management with the following key features:

- Smart contract-based vaults for custodial and non-custodial investments
- Automated portfolio rebalancing based on target allocations with drift thresholds
- Take-profit strategies with multiple trigger options (manual, time-based, percentage-gain)
- Cross-chain asset management using L1X's XTalk Protocol v1.1
- Real-time price feeds and portfolio performance metrics
- Advanced Web2/Web3 authentication options including wallet connectivity

## Project Structure

The project is structured into two main components:

1. **Smart Contracts**: Located in the `rust-contracts` and `client/src/solidity-contracts` directories
   - **Rust Contracts**: Target WebAssembly for the L1X Virtual Machine
     - Implement core functionality for vaults, allocations, rebalancing, and take-profit logic
     - XTalk Protocol integration for cross-chain messaging and consensus
   - **Solidity Contracts**: Ethereum interfaces for cross-chain operations
     - XTalkBeacon implementation for EVM chains
     - Cross-chain vault and asset management

2. **Web Application (React)**: Located in the `client` directory
   - Frontend: React with Tailwind CSS
   - Backend: Node.js/Express with PostgreSQL
   - Authentication: Multi-method auth with Web3 wallet, Firebase, and traditional email/password

## XTalk Protocol v1.1 Integration

The application implements the latest L1X XTalk Protocol (v1.1) for secure cross-chain communication:

### Core Components
1. **XTalk Node Integration**
   - Support for Listener, Signer, and Relayer validator roles
   - Multi-signature consensus for cross-chain message validation

2. **XTalk Smart Contracts**
   - **XTalkBeacon Contract**: Deployed on EVM chains for message broadcasting and execution
   - **L1X Chain Contracts**:
     - SourceRegistry: Maps source chains to Flow Contracts
     - XTalkConsensusContract: Manages consensus for cross-chain messages
     - FlowContract: Intermediate processing for cross-chain communication

3. **Cross-Chain Asset Operations**
   - Secure bridgeless asset transfers between EVM chains and L1X
   - Cross-chain vault rebalancing with slippage protection
   - Cross-chain take profit strategy execution

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

### Rust Contracts

The Rust smart contracts are organized into the following modules:

- **allocation**: Defines asset allocations and allocation sets
- **custodial_vault**: Implements custodial vault functionality
- **non_custodial_vault**: Implements non-custodial vault functionality
- **portfolio**: Provides portfolio management functions
- **rebalance**: Handles rebalancing logic
- **take_profit**: Implements take profit strategies
- **wallet**: Provides wallet functionality
- **xtalk**: Implements the XTalk Protocol v1.1 for cross-chain communication
- **cross_chain**: Manages cross-chain operations using the XTalk Protocol

To build and test the smart contracts:

```bash
cd rust-contracts
cargo build --target wasm32-unknown-unknown --release
```

### Solidity Contracts

The Solidity contracts provide interfaces for EVM chain integration:

- **ICrossChainBridge.sol**: XTalkBeacon implementation for EVM chains
- **IOneCaptialVault.sol**: Cross-chain vault functionality for Ethereum
- **IPriceFeedOracle.sol**: Price feed integration for asset valuation

## Mathematical Models

The platform implements sophisticated mathematical models for portfolio management:

### Purchasing Assets
```
AssetAmount = (TotalInvestmentAmount × TargetPercentage) ÷ AssetPrice
```

### Rebalancing Assets
Drift-based rebalancing is triggered when:
```
Drift = |CurrentPercentage - TargetPercentage| > DriftThreshold
```

### Take Profit Strategies
Percentage-based take profit executes when:
```
PortfolioGainPercentage = (CurrentValue - BaselineValue) ÷ BaselineValue × 100 ≥ TargetProfitPercentage
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

## Cross-Chain Operations

To perform cross-chain operations:

1. Create a cross-chain vault that supports assets from multiple blockchains
2. Register assets from different chains using the registerCrossChainAsset function
3. Set allocations with the appropriate chain IDs
4. Cross-chain operations will be executed securely through the XTalk Protocol
   - Messages are broadcast from the source chain and validated by XTalk nodes
   - Multiple validators achieve consensus before execution on destination chains
   - The system monitors message status at each stage of the process
