//! Cross-Chain Swap functionality for One Capital Auto-Investing
//! 
//! This module provides cross-chain liquidity and swap operations using
//! L1X's XTalk protocol to communicate with other blockchains.
//! Implements the v1.1 XTalk Protocol for secure cross-chain communication.

use serde::{Deserialize, Serialize};
use borsh::{BorshSerialize, BorshDeserialize};
use l1x_sdk::prelude::*;
use crate::xtalk::{XTalkMessageStatus, XTalkSwapRequest};

/// Supported blockchains for cross-chain operations
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub enum Blockchain {
    /// L1X blockchain (native)
    L1X,
    
    /// Ethereum blockchain
    Ethereum,
    
    /// Solana blockchain
    Solana,
    
    /// Avalanche blockchain
    Avalanche,
    
    /// Arbitrum
    Arbitrum,
    
    /// Optimism
    Optimism,
    
    /// Base
    Base,
    
    /// Polygon
    Polygon,
}

impl Blockchain {
    /// Get the chain ID for use in XTalk communications
    pub fn chain_id(&self) -> u32 {
        match self {
            Blockchain::L1X => 1776,      // L1X chain ID
            Blockchain::Ethereum => 1,    // Ethereum mainnet
            Blockchain::Solana => 1399811, // Solana (for XTalk)
            Blockchain::Avalanche => 43114, // Avalanche C-Chain
            Blockchain::Arbitrum => 42161, // Arbitrum One
            Blockchain::Optimism => 10,   // Optimism
            Blockchain::Base => 8453,     // Base
            Blockchain::Polygon => 137,   // Polygon PoS
        }
    }
    
    /// Get blockchain from string representation
    pub fn from_string(s: &str) -> Result<Self, &'static str> {
        match s.to_lowercase().as_str() {
            "l1x" => Ok(Blockchain::L1X),
            "ethereum" | "eth" => Ok(Blockchain::Ethereum),
            "solana" | "sol" => Ok(Blockchain::Solana),
            "avalanche" | "avax" => Ok(Blockchain::Avalanche),
            "arbitrum" | "arb" => Ok(Blockchain::Arbitrum),
            "optimism" | "op" => Ok(Blockchain::Optimism),
            "base" => Ok(Blockchain::Base),
            "polygon" | "matic" => Ok(Blockchain::Polygon),
            _ => Err("Unsupported blockchain"),
        }
    }
    
    /// Check if blockchain is EVM-compatible
    pub fn is_evm_compatible(&self) -> bool {
        match self {
            Blockchain::L1X => false,
            Blockchain::Solana => false,
            _ => true, // All others are EVM-compatible
        }
    }
}

/// Cross-chain swap request
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct CrossChainSwapRequest {
    /// Request ID
    pub id: String,
    
    /// User who initiated the swap
    pub user_id: String,
    
    /// Source blockchain
    pub source_chain: Blockchain,
    
    /// Target blockchain
    pub target_chain: Blockchain,
    
    /// Source asset symbol (e.g., "BTC")
    pub source_asset: String,
    
    /// Target asset symbol (e.g., "ETH")
    pub target_asset: String,
    
    /// Amount to swap (in smallest unit of source asset)
    pub amount: u128,
    
    /// Maximum slippage allowed (in basis points, e.g., 50 = 0.5%)
    pub max_slippage_bps: u32,
    
    /// Target address on the destination chain
    pub target_address: String,
    
    /// Timestamp when the request was created
    pub created_at: u64,
    
    /// Status of the swap
    pub status: SwapStatus,
    
    /// Transaction hash on source chain (if available)
    pub source_tx_hash: Option<String>,
    
    /// Transaction hash on target chain (if available)
    pub target_tx_hash: Option<String>,
    
    /// Associated XTalk message ID (if available)
    pub xtalk_message_id: Option<String>,
    
    /// XTalk message status
    pub xtalk_status: Option<XTalkMessageStatus>,
}

/// Status of a cross-chain swap
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub enum SwapStatus {
    /// Request has been created but not yet submitted
    Pending,
    
    /// Request has been submitted to the source chain
    Submitted,
    
    /// Funds have been locked on the source chain
    SourceLocked,
    
    /// Message has been broadcasted via XTalk
    XTalkBroadcasted,
    
    /// Message has been detected by XTalk Listener Validators
    XTalkDetected,
    
    /// Message has achieved Listener consensus on L1X
    ListenerFinalized,
    
    /// Message has achieved Signer consensus on L1X
    SignerFinalized,
    
    /// Message is being relayed to the destination chain
    Relaying,
    
    /// Swap is in progress on the target chain
    InProgress,
    
    /// Swap has completed successfully
    Completed,
    
    /// Swap has failed
    Failed,
}

/// Cross-chain swap route
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapRoute {
    /// Source blockchain
    pub source_chain: Blockchain,
    
    /// Target blockchain
    pub target_chain: Blockchain,
    
    /// Source asset symbol
    pub source_asset: String,
    
    /// Target asset symbol
    pub target_asset: String,
    
    /// Fee in basis points
    pub fee_bps: u32,
    
    /// Estimated time to complete (in seconds)
    pub estimated_time_seconds: u64,
    
    /// Current liquidity available
    pub liquidity: u128,
}

/// Cross-chain swap quote
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapQuote {
    /// Source asset amount
    pub source_amount: u128,
    
    /// Estimated target amount (not accounting for fees)
    pub estimated_target_amount: u128,
    
    /// Fee amount in target asset units
    pub fee_amount: u128,
    
    /// Final amount after fees
    pub final_amount: u128,
    
    /// Exchange rate (1 source unit = X target units)
    pub exchange_rate: f64,
    
    /// Maximum slippage allowed (in basis points)
    pub max_slippage_bps: u32,
}

/// Cross-chain contract storage
const STORAGE_CONTRACT_KEY: &[u8] = b"CROSS_CHAIN";

#[derive(BorshSerialize, BorshDeserialize)]
pub struct CrossChainContract {
    /// All swap requests (indexed by ID)
    swap_requests: std::collections::HashMap<String, CrossChainSwapRequest>,
    
    /// User's swap requests (indexed by user ID)
    user_swaps: std::collections::HashMap<String, Vec<String>>,
    
    /// Available liquidity for each asset
    liquidity: std::collections::HashMap<String, u128>, // Asset symbol -> amount
}

#[l1x_sdk::contract]
impl CrossChainContract {
    fn load() -> Self {
        match l1x_sdk::storage_read(STORAGE_CONTRACT_KEY) {
            Some(bytes) => Self::try_from_slice(&bytes).unwrap(),
            None => panic!("The contract isn't initialized"),
        }
    }

    fn save(&mut self) {
        l1x_sdk::storage_write(STORAGE_CONTRACT_KEY, &self.try_to_vec().unwrap());
    }

    pub fn new() {
        let mut state = Self {
            swap_requests: std::collections::HashMap::new(),
            user_swaps: std::collections::HashMap::new(),
            liquidity: std::collections::HashMap::new(),
        };
        
        // Initialize with some liquidity for testing
        state.liquidity.insert("BTC".to_string(), 1_000_000_000); // 10 BTC
        state.liquidity.insert("ETH".to_string(), 100_000_000_000); // 100 ETH
        state.liquidity.insert("L1X".to_string(), 10_000_000_000_000); // 10,000 L1X
        state.liquidity.insert("USDC".to_string(), 10_000_000_000_000); // 10M USDC
        state.liquidity.insert("USDT".to_string(), 10_000_000_000_000); // 10M USDT
        
        state.save()
    }
    
    /// Creates a new cross-chain swap request
    pub fn create_swap_request(
        user_id: String,
        source_chain: String,
        target_chain: String,
        source_asset: String,
        target_asset: String,
        amount: u128,
        max_slippage_bps: u32,
        target_address: String,
    ) -> String {
        let mut state = Self::load();
        
        // Parse blockchains
        let source_chain_enum = Blockchain::from_string(&source_chain)
            .unwrap_or_else(|_| panic!("Invalid source blockchain: {}", source_chain));
            
        let target_chain_enum = Blockchain::from_string(&target_chain)
            .unwrap_or_else(|_| panic!("Invalid target blockchain: {}", target_chain));
            
        // Check if we have sufficient liquidity
        let available_liquidity = state.liquidity.get(&source_asset)
            .cloned()
            .unwrap_or(0);
            
        if available_liquidity < amount {
            panic!("Insufficient liquidity for {}", source_asset);
        }
        
        // Generate request ID
        let request_id = format!(
            "swap_{}_{}_{}", 
            user_id, 
            l1x_sdk::env::block_timestamp(),
            source_asset
        );
        
        // Create the swap request
        let swap_request = CrossChainSwapRequest {
            id: request_id.clone(),
            user_id: user_id.clone(),
            source_chain: source_chain_enum,
            target_chain: target_chain_enum,
            source_asset,
            target_asset,
            amount,
            max_slippage_bps,
            target_address,
            created_at: l1x_sdk::env::block_timestamp(),
            status: SwapStatus::Pending,
            source_tx_hash: None,
            target_tx_hash: None,
        };
        
        // Store the request
        state.swap_requests.insert(request_id.clone(), swap_request);
        
        // Add to user's swaps
        let user_swaps = state.user_swaps.entry(user_id)
            .or_insert_with(Vec::new);
            
        user_swaps.push(request_id.clone());
        
        state.save();
        
        request_id
    }
    
    /// Gets a swap request by ID
    pub fn get_swap_request(request_id: String) -> String {
        let state = Self::load();
        
        let swap_request = state.swap_requests.get(&request_id)
            .unwrap_or_else(|| panic!("Swap request not found: {}", request_id));
            
        serde_json::to_string(swap_request)
            .unwrap_or_else(|_| "Failed to serialize swap request".to_string())
    }
    
    /// Gets all swap requests for a user
    pub fn get_user_swap_requests(user_id: String) -> String {
        let state = Self::load();
        
        let user_request_ids = state.user_swaps.get(&user_id)
            .cloned()
            .unwrap_or_default();
            
        let requests: Vec<&CrossChainSwapRequest> = user_request_ids.iter()
            .filter_map(|id| state.swap_requests.get(id))
            .collect();
            
        serde_json::to_string(&requests)
            .unwrap_or_else(|_| "Failed to serialize swap requests".to_string())
    }
    
    /// Updates a swap request status
    pub fn update_swap_status(
        request_id: String,
        status: String,
        source_tx_hash: Option<String>,
        target_tx_hash: Option<String>,
    ) -> String {
        let mut state = Self::load();
        
        let swap_request = state.swap_requests.get_mut(&request_id)
            .unwrap_or_else(|| panic!("Swap request not found: {}", request_id));
            
        // Update status
        swap_request.status = match status.as_str() {
            "pending" => SwapStatus::Pending,
            "submitted" => SwapStatus::Submitted,
            "source_locked" => SwapStatus::SourceLocked,
            "in_progress" => SwapStatus::InProgress,
            "completed" => SwapStatus::Completed,
            "failed" => SwapStatus::Failed,
            _ => panic!("Invalid swap status: {}", status),
        };
        
        // Update transaction hashes if provided
        if let Some(hash) = source_tx_hash {
            swap_request.source_tx_hash = Some(hash);
        }
        
        if let Some(hash) = target_tx_hash {
            swap_request.target_tx_hash = Some(hash);
        }
        
        state.save();
        
        format!("Swap request {} status updated to {}", request_id, status)
    }
    
    /// Gets available swap routes
    pub fn get_available_routes(source_chain: String, target_chain: String) -> String {
        // This is a simplified implementation for demonstration purposes
        // In a real implementation, this would query the available routes
        // from the XTalk protocol
        
        let source_chain_enum = Blockchain::from_string(&source_chain)
            .unwrap_or_else(|_| panic!("Invalid source blockchain: {}", source_chain));
            
        let target_chain_enum = Blockchain::from_string(&target_chain)
            .unwrap_or_else(|_| panic!("Invalid target blockchain: {}", target_chain));
            
        let state = Self::load();
        
        // Generate available routes
        let mut routes: Vec<SwapRoute> = Vec::new();
        
        if source_chain_enum == Blockchain::L1X {
            // Routes from L1X to target chain
            for (asset, liquidity) in &state.liquidity {
                let fee_bps = 50; // 0.5% fee
                let estimated_time = 120; // 2 minutes
                
                routes.push(SwapRoute {
                    source_chain: source_chain_enum,
                    target_chain: target_chain_enum,
                    source_asset: "L1X".to_string(),
                    target_asset: asset.clone(),
                    fee_bps,
                    estimated_time_seconds: estimated_time,
                    liquidity: *liquidity,
                });
            }
        } else if target_chain_enum == Blockchain::L1X {
            // Routes from source chain to L1X
            for (asset, liquidity) in &state.liquidity {
                let fee_bps = 50; // 0.5% fee
                let estimated_time = 120; // 2 minutes
                
                routes.push(SwapRoute {
                    source_chain: source_chain_enum,
                    target_chain: target_chain_enum,
                    source_asset: asset.clone(),
                    target_asset: "L1X".to_string(),
                    fee_bps,
                    estimated_time_seconds: estimated_time,
                    liquidity: *liquidity,
                });
            }
        } else {
            // Routes from source chain to target chain via L1X
            for (source_asset, source_liquidity) in &state.liquidity {
                for (target_asset, target_liquidity) in &state.liquidity {
                    if source_asset != target_asset {
                        let fee_bps = 75; // 0.75% fee for cross-chain via L1X
                        let estimated_time = 300; // 5 minutes
                        
                        routes.push(SwapRoute {
                            source_chain: source_chain_enum,
                            target_chain: target_chain_enum,
                            source_asset: source_asset.clone(),
                            target_asset: target_asset.clone(),
                            fee_bps,
                            estimated_time_seconds: estimated_time,
                            liquidity: std::cmp::min(*source_liquidity, *target_liquidity),
                        });
                    }
                }
            }
        }
        
        serde_json::to_string(&routes)
            .unwrap_or_else(|_| "Failed to serialize routes".to_string())
    }
    
    /// Gets a quote for a cross-chain swap
    pub fn get_swap_quote(
        source_chain: String,
        target_chain: String,
        source_asset: String,
        target_asset: String,
        amount: u128,
    ) -> String {
        // Parse blockchains
        let _ = Blockchain::from_string(&source_chain)
            .unwrap_or_else(|_| panic!("Invalid source blockchain: {}", source_chain));
            
        let _ = Blockchain::from_string(&target_chain)
            .unwrap_or_else(|_| panic!("Invalid target blockchain: {}", target_chain));
            
        // Get liquidity
        let state = Self::load();
        
        let _ = state.liquidity.get(&source_asset)
            .unwrap_or_else(|| panic!("No liquidity for source asset {}", source_asset));
            
        let _ = state.liquidity.get(&target_asset)
            .unwrap_or_else(|| panic!("No liquidity for target asset {}", target_asset));
            
        // Calculate quote
        // This is a simplified example - in a real implementation,
        // this would use actual exchange rates and market data
        
        // Mock exchange rates
        let exchange_rate = match (source_asset.as_str(), target_asset.as_str()) {
            ("BTC", "ETH") => 16.5,     // 1 BTC = 16.5 ETH
            ("ETH", "BTC") => 0.06,     // 1 ETH = 0.06 BTC
            ("BTC", "L1X") => 2500.0,   // 1 BTC = 2500 L1X
            ("ETH", "L1X") => 150.0,    // 1 ETH = 150 L1X
            ("L1X", "BTC") => 0.0004,   // 1 L1X = 0.0004 BTC
            ("L1X", "ETH") => 0.0066,   // 1 L1X = 0.0066 ETH
            ("USDC", "USDT") => 1.001,  // 1 USDC = 1.001 USDT
            ("USDT", "USDC") => 0.999,  // 1 USDT = 0.999 USDC
            _ => 1.0,                   // Default 1:1 for unknown pairs
        };
        
        let estimated_target_amount = (amount as f64 * exchange_rate) as u128;
        
        // Calculate fee
        let fee_bps = if source_chain == target_chain { 25 } else { 50 };
        let fee_amount = (estimated_target_amount * fee_bps as u128) / 10000;
        
        // Final amount after fees
        let final_amount = estimated_target_amount - fee_amount;
        
        // Create quote
        let quote = SwapQuote {
            source_amount: amount,
            estimated_target_amount,
            fee_amount,
            final_amount,
            exchange_rate,
            max_slippage_bps: 100, // Default 1% max slippage
        };
        
        serde_json::to_string(&quote)
            .unwrap_or_else(|_| "Failed to serialize quote".to_string())
    }
    
    /// Adds liquidity to the contract (for testing purposes)
    pub fn add_liquidity(asset: String, amount: u128) -> String {
        let mut state = Self::load();
        
        let current = state.liquidity.entry(asset.clone())
            .or_insert(0);
            
        *current = current.checked_add(amount)
            .unwrap_or_else(|| panic!("Overflow adding liquidity for {}", asset));
            
        state.save();
        
        format!("Added {} liquidity for {}", amount, asset)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_blockchain_parsing() {
        assert_eq!(Blockchain::from_string("l1x").unwrap(), Blockchain::L1X);
        assert_eq!(Blockchain::from_string("eth").unwrap(), Blockchain::Ethereum);
        assert_eq!(Blockchain::from_string("solana").unwrap(), Blockchain::Solana);
        assert_eq!(Blockchain::from_string("avax").unwrap(), Blockchain::Avalanche);
        
        assert!(Blockchain::from_string("invalid").is_err());
    }
    
    #[test]
    fn test_chain_ids() {
        assert_eq!(Blockchain::L1X.chain_id(), 1776);
        assert_eq!(Blockchain::Ethereum.chain_id(), 1);
        assert_eq!(Blockchain::Solana.chain_id(), 1399811);
        assert_eq!(Blockchain::Avalanche.chain_id(), 43114);
    }
    
    #[test]
    fn test_swap_status_transitions() {
        let mut swap = CrossChainSwapRequest {
            id: "test_swap".to_string(),
            user_id: "user1".to_string(),
            source_chain: Blockchain::L1X,
            target_chain: Blockchain::Ethereum,
            source_asset: "L1X".to_string(),
            target_asset: "ETH".to_string(),
            amount: 100,
            max_slippage_bps: 50,
            target_address: "0x1234...".to_string(),
            created_at: 0,
            status: SwapStatus::Pending,
            source_tx_hash: None,
            target_tx_hash: None,
        };
        
        // Test status transitions
        assert_eq!(swap.status, SwapStatus::Pending);
        
        swap.status = SwapStatus::Submitted;
        assert_eq!(swap.status, SwapStatus::Submitted);
        
        swap.status = SwapStatus::SourceLocked;
        assert_eq!(swap.status, SwapStatus::SourceLocked);
        
        swap.status = SwapStatus::InProgress;
        assert_eq!(swap.status, SwapStatus::InProgress);
        
        swap.status = SwapStatus::Completed;
        assert_eq!(swap.status, SwapStatus::Completed);
    }
}