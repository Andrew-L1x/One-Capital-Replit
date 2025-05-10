//! One Capital Auto-Investing Smart Contracts
//!
//! This library provides a comprehensive set of Rust smart contracts for the
//! One Capital Auto-Investing dApp on the L1X blockchain. The contracts manage
//! custodial and non-custodial investment vaults, asset allocations, rebalancing
//! operations, take-profit strategies, cross-chain swaps, and price feeds.

/// Allocation functionality for managing asset allocations within vaults
pub mod allocation;

/// Portfolio management that integrates allocation, rebalancing, and take-profit
pub mod portfolio;

/// Custodial vault implementation where user funds are managed by the protocol
pub mod custodial_vault;

/// Non-custodial vault implementation where user retains control of funds
pub mod non_custodial_vault;

/// Take profit strategies for automated profit realization
pub mod take_profit;

/// Cross-chain swap functionality using L1X XTalk protocol
pub mod cross_chain;

/// Price feed oracle service for real-time asset pricing
pub mod price_feed;

/// Event system for contract event emission
pub mod events;

/// Rebalance functionality for portfolio balancing
pub mod rebalance;

/// Wallet functionality for user wallet interactions
pub mod wallet;

/// XTalk protocol integration
pub mod xtalk;

/// Contract version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Contract description
pub const DESCRIPTION: &str = "One Capital Auto-Investing Smart Contracts";

#[cfg(test)]
mod tests {
    #[test]
    fn version_check() {
        assert_eq!(super::VERSION, env!("CARGO_PKG_VERSION"));
    }
}