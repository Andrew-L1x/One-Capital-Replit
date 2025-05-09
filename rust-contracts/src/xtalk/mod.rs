//! X-Talk protocol integration for bridgeless cross-chain swaps
//! 
//! This module provides the functionality for interacting with L1X's X-Talk
//! protocol to perform cross-chain operations without traditional bridges.

use serde::{Deserialize, Serialize};
use l1x_sdk::prelude::*;

/// X-Talk message types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum XTalkMessageType {
    /// Request a price quote
    PriceQuote,
    
    /// Execute a swap
    Swap,
    
    /// Cancel a pending operation
    Cancel,
    
    /// Request asset information
    AssetInfo,
}

/// X-Talk swap request message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XTalkSwapRequest {
    /// Source asset identifier
    pub source_asset: String,
    
    /// Target asset identifier
    pub target_asset: String,
    
    /// Amount to swap (in smallest units)
    pub amount: u128,
    
    /// Maximum slippage in basis points (1% = 100 basis points)
    pub slippage_bps: u32,
}

/// X-Talk price quote response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XTalkPriceQuote {
    /// Source asset identifier
    pub source_asset: String,
    
    /// Target asset identifier
    pub target_asset: String,
    
    /// Quote amount (how much target asset you will receive)
    pub quote_amount: u128,
    
    /// Exchange rate in basis points
    pub exchange_rate_bps: u64,
    
    /// Quote expiration timestamp
    pub expires_at: u64,
    
    /// Quote ID for reference
    pub quote_id: String,
}

/// X-Talk swap result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XTalkSwapResult {
    /// Swap transaction ID
    pub tx_id: String,
    
    /// Source asset identifier
    pub source_asset: String,
    
    /// Amount sent from source
    pub source_amount: u128,
    
    /// Target asset identifier
    pub target_asset: String,
    
    /// Amount received in target
    pub target_amount: u128,
    
    /// Actual exchange rate achieved (in basis points)
    pub actual_rate_bps: u64,
    
    /// Fee paid (in smallest units)
    pub fee: u128,
    
    /// Timestamp when the swap completed
    pub completed_at: u64,
}

/// Error types for X-Talk operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum XTalkError {
    /// Insufficient liquidity for the requested swap
    InsufficientLiquidity,
    
    /// Price slippage exceeded the allowed limit
    SlippageExceeded,
    
    /// Operation timed out
    Timeout,
    
    /// Invalid asset identifier
    InvalidAsset,
    
    /// Server error
    ServerError(String),
    
    /// Operation not permitted
    NotPermitted,
}

/// X-Talk client for interacting with the L1X X-Talk protocol
pub struct XTalkClient;

impl XTalkClient {
    /// Gets a price quote for swapping between assets
    pub fn get_price_quote(
        source_asset: &str,
        target_asset: &str,
        amount: u128,
    ) -> Result<XTalkPriceQuote, XTalkError> {
        // In a real implementation, this would call the L1X X-Talk API
        // to get a price quote for the swap
        
        // For now, return a mock quote with a reasonable exchange rate
        let quote = XTalkPriceQuote {
            source_asset: source_asset.to_string(),
            target_asset: target_asset.to_string(),
            quote_amount: amount, // 1:1 exchange rate for simplicity
            exchange_rate_bps: 10000, // 1:1 exchange rate (10000 basis points = 100%)
            expires_at: l1x_sdk::env::block_timestamp() + 300, // 5 minutes validity
            quote_id: format!("quote-{}-{}-{}", source_asset, target_asset, l1x_sdk::env::block_timestamp()),
        };
        
        Ok(quote)
    }
    
    /// Executes a swap using the X-Talk protocol
    pub fn execute_swap(
        swap_request: &XTalkSwapRequest,
    ) -> Result<XTalkSwapResult, XTalkError> {
        // First get a price quote
        let quote = Self::get_price_quote(
            &swap_request.source_asset,
            &swap_request.target_asset,
            swap_request.amount,
        )?;
        
        // In a real implementation, this would call the L1X X-Talk API
        // to execute the swap
        
        // For now, return a mock swap result
        let result = XTalkSwapResult {
            tx_id: format!("tx-{}-{}", swap_request.source_asset, swap_request.target_asset),
            source_asset: swap_request.source_asset.clone(),
            source_amount: swap_request.amount,
            target_asset: swap_request.target_asset.clone(),
            target_amount: quote.quote_amount,
            actual_rate_bps: quote.exchange_rate_bps,
            fee: swap_request.amount / 1000, // 0.1% fee
            completed_at: l1x_sdk::env::block_timestamp(),
        };
        
        Ok(result)
    }
    
    /// Gets the price of an asset in USD
    pub fn get_asset_price(asset_id: &str) -> Result<u128, XTalkError> {
        // In a real implementation, this would query the L1X oracle
        // to get the asset price
        
        // For now, return mock prices for known assets
        let price = match asset_id {
            "BTC" => 50000_00000000, // $50,000 with 8 decimal places
            "ETH" => 3000_00000000,  // $3,000 with 8 decimal places
            "SOL" => 100_00000000,   // $100 with 8 decimal places
            "USDC" => 1_00000000,    // $1 with 8 decimal places
            "USDT" => 1_00000000,    // $1 with 8 decimal places
            _ => return Err(XTalkError::InvalidAsset),
        };
        
        Ok(price)
    }
    
    /// Gets the available liquidity for an asset
    pub fn get_liquidity(asset_id: &str) -> Result<u128, XTalkError> {
        // In a real implementation, this would query the L1X liquidity pools
        
        // For now, return mock liquidity values
        let liquidity = match asset_id {
            "BTC" => 100_00000000,  // 100 BTC
            "ETH" => 1000_00000000, // 1,000 ETH
            "SOL" => 10000_00000000, // 10,000 SOL
            "USDC" => 10000000_00000000, // 10M USDC
            "USDT" => 10000000_00000000, // 10M USDT
            _ => return Err(XTalkError::InvalidAsset),
        };
        
        Ok(liquidity)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_price_quote() {
        let quote = XTalkClient::get_price_quote("BTC", "ETH", 1_00000000).unwrap();
        
        assert_eq!(quote.source_asset, "BTC");
        assert_eq!(quote.target_asset, "ETH");
        assert!(quote.expires_at > l1x_sdk::env::block_timestamp());
    }
    
    #[test]
    fn test_execute_swap() {
        let swap_request = XTalkSwapRequest {
            source_asset: "BTC".to_string(),
            target_asset: "ETH".to_string(),
            amount: 1_00000000, // 1 BTC
            slippage_bps: 50,   // 0.5% slippage
        };
        
        let result = XTalkClient::execute_swap(&swap_request).unwrap();
        
        assert_eq!(result.source_asset, "BTC");
        assert_eq!(result.target_asset, "ETH");
        assert_eq!(result.source_amount, 1_00000000);
        assert!(result.fee > 0);
    }
    
    #[test]
    fn test_asset_price() {
        let btc_price = XTalkClient::get_asset_price("BTC").unwrap();
        let eth_price = XTalkClient::get_asset_price("ETH").unwrap();
        
        assert!(btc_price > 0);
        assert!(eth_price > 0);
        
        // Invalid asset should return an error
        let invalid_result = XTalkClient::get_asset_price("INVALID");
        assert!(invalid_result.is_err());
    }
}
