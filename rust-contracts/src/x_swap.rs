//! Cross-Chain Swap Contract for L1X
//!
//! This contract enables bridgeless cross-chain swaps using L1X's X-Talk protocol.
//! It provides functionality to:
//! - Initiate swaps between assets across different blockchains
//! - Track and update swap status
//! - Emit events for swap lifecycle
//!
//! All interactions with external chains occur through the X-Talk protocol.

use std::collections::HashMap;

// Error types
pub enum Error {
    Unauthorized,
    InvalidAmount,
    InvalidAsset,
    InvalidChain,
    SwapNotFound,
    InsufficientBalance,
}

// Swap status enum
pub enum SwapStatus {
    Pending,
    Completed,
    Failed,
}

// Event for swap requests
pub struct SwapRequested {
    pub id: u64,
    pub from_asset: String,
    pub to_asset: String,
    pub amount: u128,
    pub target_chain_id: u64,
    pub initiator: Address,
    pub timestamp: u64,
}

// Event for swap completions
pub struct SwapCompleted {
    pub id: u64,
    pub from_asset: String,
    pub to_asset: String,
    pub sent_amount: u128,
    pub received_amount: u128,
    pub target_chain_id: u64,
    pub initiator: Address,
    pub timestamp: u64,
}

// Type aliases
pub type Address = [u8; 20];
pub type Result<T> = std::result::Result<T, Error>;

// Swap record structure
pub struct SwapRecord {
    pub id: u64,
    pub from_asset: String,
    pub to_asset: String,
    pub amount: u128,
    pub target_chain_id: u64,
    pub initiator: Address,
    pub status: SwapStatus,
    pub created_at: u64,
    pub completed_at: Option<u64>,
    pub received_amount: Option<u128>,
}

// Main contract structure
pub struct XSwap {
    /// Contract owner
    owner: Address,
    /// Authorized admins
    admins: Vec<Address>,
    /// Next swap ID
    next_swap_id: u64,
    /// Swap records by ID
    swaps: HashMap<u64, SwapRecord>,
    /// User balances (address -> asset -> amount)
    balances: HashMap<Address, HashMap<String, u128>>,
}

impl XSwap {
    /// Create a new X-Swap contract with the caller as the owner
    pub fn new(caller: Address) -> Self {
        let mut admins = Vec::new();
        admins.push(caller);
        
        XSwap {
            owner: caller,
            admins,
            next_swap_id: 1,
            swaps: HashMap::new(),
            balances: HashMap::new(),
        }
    }
    
    /// Check if caller is authorized
    fn is_authorized(&self, caller: &Address) -> bool {
        if *caller == self.owner {
            return true;
        }
        
        self.admins.contains(caller)
    }
    
    /// Add a new admin
    pub fn add_admin(&mut self, caller: &Address, new_admin: Address) -> Result<()> {
        if caller != &self.owner {
            return Err(Error::Unauthorized);
        }
        
        if !self.admins.contains(&new_admin) {
            self.admins.push(new_admin);
        }
        
        Ok(())
    }
    
    /// Get user balance for an asset
    pub fn get_balance(&self, user: &Address, asset: &str) -> u128 {
        self.balances
            .get(user)
            .and_then(|assets| assets.get(asset))
            .copied()
            .unwrap_or(0)
    }
    
    /// Update user balance
    fn update_balance(&mut self, user: &Address, asset: &str, amount: u128, is_addition: bool) {
        let user_balances = self.balances.entry(*user).or_insert_with(HashMap::new);
        let current_balance = user_balances.get(asset).copied().unwrap_or(0);
        
        if is_addition {
            user_balances.insert(asset.to_string(), current_balance + amount);
        } else {
            // Ensure we don't underflow
            let new_balance = if current_balance >= amount {
                current_balance - amount
            } else {
                0
            };
            user_balances.insert(asset.to_string(), new_balance);
        }
    }
    
    /// Initiate a cross-chain swap
    pub fn cross_chain_swap(
        &mut self,
        caller: &Address,
        from_asset: String,
        to_asset: String,
        amount: u128,
        target_chain_id: u64,
        timestamp: u64,
    ) -> Result<SwapRequested> {
        // Basic validation
        if amount == 0 {
            return Err(Error::InvalidAmount);
        }
        
        if from_asset.is_empty() || to_asset.is_empty() {
            return Err(Error::InvalidAsset);
        }
        
        if target_chain_id == 0 {
            return Err(Error::InvalidChain);
        }
        
        // Check user balance
        let user_balance = self.get_balance(caller, &from_asset);
        if user_balance < amount {
            return Err(Error::InsufficientBalance);
        }
        
        // Deduct balance
        self.update_balance(caller, &from_asset, amount, false);
        
        // Create swap record
        let swap_id = self.next_swap_id;
        self.next_swap_id += 1;
        
        let swap = SwapRecord {
            id: swap_id,
            from_asset: from_asset.clone(),
            to_asset: to_asset.clone(),
            amount,
            target_chain_id,
            initiator: *caller,
            status: SwapStatus::Pending,
            created_at: timestamp,
            completed_at: None,
            received_amount: None,
        };
        
        self.swaps.insert(swap_id, swap);
        
        // Return event data
        Ok(SwapRequested {
            id: swap_id,
            from_asset,
            to_asset,
            amount,
            target_chain_id,
            initiator: *caller,
            timestamp,
        })
    }
    
    /// Complete a swap (called by X-Talk relayer or admin)
    pub fn complete_swap(
        &mut self,
        caller: &Address,
        swap_id: u64,
        received_amount: u128,
        timestamp: u64,
    ) -> Result<SwapCompleted> {
        // Only authorized callers can complete swaps
        if !self.is_authorized(caller) {
            return Err(Error::Unauthorized);
        }
        
        // Get swap record
        let swap = self.swaps.get_mut(&swap_id).ok_or(Error::SwapNotFound)?;
        
        // Update swap record
        swap.status = SwapStatus::Completed;
        swap.completed_at = Some(timestamp);
        swap.received_amount = Some(received_amount);
        
        // Credit user with received asset
        self.update_balance(&swap.initiator, &swap.to_asset, received_amount, true);
        
        // Return event data
        Ok(SwapCompleted {
            id: swap_id,
            from_asset: swap.from_asset.clone(),
            to_asset: swap.to_asset.clone(),
            sent_amount: swap.amount,
            received_amount,
            target_chain_id: swap.target_chain_id,
            initiator: swap.initiator,
            timestamp,
        })
    }
    
    /// Mark a swap as failed (called by X-Talk relayer or admin)
    pub fn fail_swap(&mut self, caller: &Address, swap_id: u64, timestamp: u64) -> Result<()> {
        // Only authorized callers can mark swaps as failed
        if !self.is_authorized(caller) {
            return Err(Error::Unauthorized);
        }
        
        // Get swap record
        let swap = self.swaps.get_mut(&swap_id).ok_or(Error::SwapNotFound)?;
        
        // Update swap record
        swap.status = SwapStatus::Failed;
        swap.completed_at = Some(timestamp);
        
        // Refund user with original asset
        self.update_balance(&swap.initiator, &swap.from_asset, swap.amount, true);
        
        Ok(())
    }
    
    /// Get swap details
    pub fn get_swap(&self, swap_id: u64) -> Option<&SwapRecord> {
        self.swaps.get(&swap_id)
    }
    
    /// Get all swaps for a user
    pub fn get_user_swaps(&self, user: &Address) -> Vec<&SwapRecord> {
        self.swaps
            .values()
            .filter(|s| s.initiator == *user)
            .collect()
    }
}

// Implementation for L1X blockchain API
#[cfg(target_arch = "wasm32")]
pub mod l1x {
    use super::*;
    
    // We'll assume these functions are provided by the L1X runtime
    extern "C" {
        fn l1x_get_caller() -> [u8; 20];
        fn l1x_get_timestamp() -> u64;
        fn l1x_emit_event(event_type: &str, data: &[u8]);
        fn l1x_xtalk_send(chain_id: u64, target_contract: &[u8], message: &[u8]) -> i32;
    }
    
    static mut XSWAP: Option<XSwap> = None;
    
    // Helper to get singleton instance
    fn get_xswap() -> &'static mut XSwap {
        unsafe {
            if XSWAP.is_none() {
                let caller = l1x_get_caller();
                XSWAP = Some(XSwap::new(caller));
            }
            XSWAP.as_mut().unwrap()
        }
    }
    
    // Public contract API functions
    
    /// Initiate a cross-chain swap
    #[no_mangle]
    pub extern "C" fn cross_chain_swap(
        from_asset_ptr: *const u8, from_asset_len: usize,
        to_asset_ptr: *const u8, to_asset_len: usize,
        amount: u128,
        target_chain_id: u64
    ) -> i32 {
        let caller = unsafe { l1x_get_caller() };
        let timestamp = unsafe { l1x_get_timestamp() };
        
        // Convert asset names from pointers to strings
        let from_asset_slice = unsafe { std::slice::from_raw_parts(from_asset_ptr, from_asset_len) };
        let from_asset = match std::str::from_utf8(from_asset_slice) {
            Ok(s) => s.to_string(),
            Err(_) => return -1, // Invalid UTF-8
        };
        
        let to_asset_slice = unsafe { std::slice::from_raw_parts(to_asset_ptr, to_asset_len) };
        let to_asset = match std::str::from_utf8(to_asset_slice) {
            Ok(s) => s.to_string(),
            Err(_) => return -1, // Invalid UTF-8
        };
        
        let xswap = get_xswap();
        match xswap.cross_chain_swap(&caller, from_asset, to_asset, amount, target_chain_id, timestamp) {
            Ok(event) => {
                // In a real implementation, we would serialize the event and emit it
                let event_type = "SwapRequested";
                let event_data = format!(
                    "{{\"id\":{},\"fromAsset\":\"{}\",\"toAsset\":\"{}\",\"amount\":{},\"targetChainId\":{}}}",
                    event.id, event.from_asset, event.to_asset, event.amount, event.target_chain_id
                );
                
                unsafe {
                    l1x_emit_event(event_type, event_data.as_bytes());
                    
                    // In a real implementation, we would also send a message to the target chain
                    // using L1X's X-Talk protocol
                    let x_talk_message = format!(
                        "{{\"action\":\"swap\",\"swapId\":{},\"fromAsset\":\"{}\",\"toAsset\":\"{}\",\"amount\":{}}}",
                        event.id, event.from_asset, event.to_asset, event.amount
                    );
                    
                    // Target contract address would be known in advance for the specific chain
                    let target_contract = b"target_contract_address_on_chain";
                    
                    l1x_xtalk_send(target_chain_id, target_contract, x_talk_message.as_bytes());
                }
                
                event.id as i32 // Return swap ID as success
            },
            Err(Error::InvalidAmount) => -2,
            Err(Error::InvalidAsset) => -3,
            Err(Error::InvalidChain) => -4,
            Err(Error::InsufficientBalance) => -5,
            _ => -1,
        }
    }
    
    /// Complete a swap (called by X-Talk relayer)
    #[no_mangle]
    pub extern "C" fn complete_swap(swap_id: u64, received_amount: u128) -> i32 {
        let caller = unsafe { l1x_get_caller() };
        let timestamp = unsafe { l1x_get_timestamp() };
        
        let xswap = get_xswap();
        match xswap.complete_swap(&caller, swap_id, received_amount, timestamp) {
            Ok(event) => {
                // Emit event
                let event_type = "SwapCompleted";
                let event_data = format!(
                    "{{\"id\":{},\"fromAsset\":\"{}\",\"toAsset\":\"{}\",\"sentAmount\":{},\"receivedAmount\":{}}}",
                    event.id, event.from_asset, event.to_asset, event.sent_amount, event.received_amount
                );
                
                unsafe {
                    l1x_emit_event(event_type, event_data.as_bytes());
                }
                
                0 // Success
            },
            Err(Error::Unauthorized) => -2,
            Err(Error::SwapNotFound) => -3,
            _ => -1,
        }
    }
    
    /// Mark a swap as failed (called by X-Talk relayer)
    #[no_mangle]
    pub extern "C" fn fail_swap(swap_id: u64) -> i32 {
        let caller = unsafe { l1x_get_caller() };
        let timestamp = unsafe { l1x_get_timestamp() };
        
        let xswap = get_xswap();
        match xswap.fail_swap(&caller, swap_id, timestamp) {
            Ok(_) => {
                // Emit event
                let event_type = "SwapFailed";
                let event_data = format!("{{\"id\":{}}}", swap_id);
                
                unsafe {
                    l1x_emit_event(event_type, event_data.as_bytes());
                }
                
                0 // Success
            },
            Err(Error::Unauthorized) => -2,
            Err(Error::SwapNotFound) => -3,
            _ => -1,
        }
    }
    
    /// Get user balance for an asset
    #[no_mangle]
    pub extern "C" fn get_balance(
        user_ptr: *const u8,
        asset_ptr: *const u8, asset_len: usize
    ) -> u128 {
        // Convert user address from pointer
        let user_slice = unsafe { std::slice::from_raw_parts(user_ptr, 20) };
        let mut user = [0u8; 20];
        user.copy_from_slice(user_slice);
        
        // Convert asset name from pointer to string
        let asset_slice = unsafe { std::slice::from_raw_parts(asset_ptr, asset_len) };
        let asset = match std::str::from_utf8(asset_slice) {
            Ok(s) => s,
            Err(_) => return 0, // Invalid UTF-8
        };
        
        let xswap = get_xswap();
        xswap.get_balance(&user, asset)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    fn create_address(val: u8) -> Address {
        let mut addr = [0u8; 20];
        addr[0] = val;
        addr
    }
    
    #[test]
    fn test_cross_chain_swap() {
        let owner = create_address(1);
        let mut xswap = XSwap::new(owner);
        
        // Setup user with some balance
        xswap.update_balance(&owner, "ETH", 1000, true);
        
        // Test swap with valid parameters
        let result = xswap.cross_chain_swap(
            &owner,
            "ETH".to_string(),
            "BTC".to_string(),
            100,
            2, // Target chain ID
            12345,
        );
        
        assert!(result.is_ok());
        let event = result.unwrap();
        assert_eq!(event.from_asset, "ETH");
        assert_eq!(event.to_asset, "BTC");
        assert_eq!(event.amount, 100);
        
        // Check balance was deducted
        let balance = xswap.get_balance(&owner, "ETH");
        assert_eq!(balance, 900);
        
        // Get the swap
        let swap = xswap.get_swap(event.id).unwrap();
        assert_eq!(swap.from_asset, "ETH");
        assert_eq!(swap.to_asset, "BTC");
        assert_eq!(swap.amount, 100);
        assert!(matches!(swap.status, SwapStatus::Pending));
        
        // Complete the swap
        let complete_result = xswap.complete_swap(&owner, event.id, 5, 12346);
        assert!(complete_result.is_ok());
        
        // Check updated swap status
        let updated_swap = xswap.get_swap(event.id).unwrap();
        assert!(matches!(updated_swap.status, SwapStatus::Completed));
        assert_eq!(updated_swap.received_amount, Some(5));
        
        // Check BTC was credited to user
        let btc_balance = xswap.get_balance(&owner, "BTC");
        assert_eq!(btc_balance, 5);
    }
    
    #[test]
    fn test_failed_swap() {
        let owner = create_address(1);
        let mut xswap = XSwap::new(owner);
        
        // Setup user with some balance
        xswap.update_balance(&owner, "ETH", 1000, true);
        
        // Create a swap
        let result = xswap.cross_chain_swap(
            &owner,
            "ETH".to_string(),
            "BTC".to_string(),
            100,
            2,
            12345,
        );
        
        let swap_id = result.unwrap().id;
        
        // Initial ETH balance after swap started
        let initial_eth_balance = xswap.get_balance(&owner, "ETH");
        assert_eq!(initial_eth_balance, 900);
        
        // Mark swap as failed
        let fail_result = xswap.fail_swap(&owner, swap_id, 12346);
        assert!(fail_result.is_ok());
        
        // Check swap is marked as failed
        let failed_swap = xswap.get_swap(swap_id).unwrap();
        assert!(matches!(failed_swap.status, SwapStatus::Failed));
        
        // Check ETH was refunded
        let refunded_eth_balance = xswap.get_balance(&owner, "ETH");
        assert_eq!(refunded_eth_balance, 1000);
    }
    
    #[test]
    fn test_insufficient_balance() {
        let owner = create_address(1);
        let mut xswap = XSwap::new(owner);
        
        // Setup user with insufficient balance
        xswap.update_balance(&owner, "ETH", 50, true);
        
        // Attempt swap with amount greater than balance
        let result = xswap.cross_chain_swap(
            &owner,
            "ETH".to_string(),
            "BTC".to_string(),
            100,
            2,
            12345,
        );
        
        assert!(matches!(result, Err(Error::InsufficientBalance)));
        
        // Balance should remain unchanged
        let balance = xswap.get_balance(&owner, "ETH");
        assert_eq!(balance, 50);
    }
}