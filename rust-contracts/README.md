# One Capital Auto-Investing Smart Contracts

This directory contains the smart contract code for the One Capital Auto-Investing dApp on L1X blockchain.

## Contract Structure

The smart contracts handle:

1. **Portfolio Management**: Creation and management of investment vaults
2. **Asset Allocation**: Storing and updating portfolio asset allocations 
3. **Rebalancing Logic**: Automated rebalancing based on drift thresholds
4. **Take Profit Settings**: Managing take-profit strategies

## Build Issues

Currently experiencing a bug in the L1X WASM compilation toolchain with the error:
```
thread 'main' panicked at '.../l1x-wasm-llvmir-0.2.2/src/environment_impl.rs:2559:21:
not implemented: MemoryCopy { dst_mem: 0, src_mem: 0 }
```

This appears to be an issue with the L1X toolchain itself rather than our contract code. We'll need to:

1. Report this issue to the L1X development team
2. Try with a different version of the toolchain when available
3. Or use a more simplified contract structure that avoids triggering this error

## Integration with Frontend

The frontend will interact with these contracts through the L1X blockchain client. Contract addresses will be configurable through environment variables in the frontend application.