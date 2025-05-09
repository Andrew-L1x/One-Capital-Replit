//! One Capital Auto-Investing smart contracts for L1X blockchain
//! 
//! This library provides the core functionality for automated investment
//! portfolio management on the L1X blockchain, including:
//! - Vault management (custodial and non-custodial)
//! - Portfolio allocation and rebalancing
//! - Take profit strategies
//! - Integration with L1X's X-Talk protocol for bridgeless swaps

mod allocation;
mod custodial_vault;
mod non_custodial_vault;
mod portfolio;
mod wallet;
mod xtalk;
mod rebalance;
mod take_profit;

#[cfg(test)]
mod tests;

use wasm_bindgen::prelude::*;

// Export main modules to be accessible from WebAssembly
pub use allocation::*;
pub use custodial_vault::*;
pub use non_custodial_vault::*;
pub use portfolio::*;
pub use wallet::*;
pub use xtalk::*;
pub use rebalance::*;
pub use take_profit::*;

/// Initialize the One Capital Auto-Investing library
/// 
/// This function is exported to WebAssembly and serves as the entry point
/// for the One Capital Auto-Investing smart contracts on the L1X blockchain.
#[wasm_bindgen]
pub fn init() -> Result<(), JsValue> {
    // Initialize logging for better debugging
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
    
    Ok(())
}
