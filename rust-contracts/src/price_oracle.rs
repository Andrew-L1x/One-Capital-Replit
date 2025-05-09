//! Price Oracle Smart Contract for L1X
//!
//! This contract stores price information for various tokens and enables:
//! - Trusted admins to update token prices
//! - Anyone to query the latest prices
//! - Emitting events when prices change

use std::collections::HashMap;
use std::str::FromStr;

// Error types
pub enum Error {
    Unauthorized,
    InvalidToken,
    InvalidPrice,
}

// Event for price updates
pub struct PriceUpdated {
    pub token: String,
    pub price: u128,
    pub timestamp: u64,
    pub updater: Address,
}

// Type aliases
pub type Address = [u8; 20];
pub type Result<T> = std::result::Result<T, Error>;

// Main contract structure
pub struct PriceOracle {
    /// Contract owner
    owner: Address,
    /// Authorized admins who can update prices
    admins: Vec<Address>,
    /// Latest prices for each token (token symbol -> price in USD * 10^8)
    prices: HashMap<String, u128>,
    /// Timestamp of last update for each token
    last_updated: HashMap<String, u64>,
}

impl PriceOracle {
    /// Create a new price oracle with the caller as the owner
    pub fn new(caller: Address) -> Self {
        let mut admins = Vec::new();
        admins.push(caller);
        
        PriceOracle {
            owner: caller,
            admins,
            prices: HashMap::new(),
            last_updated: HashMap::new(),
        }
    }
    
    /// Check if caller is authorized to update prices
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
    
    /// Remove an admin
    pub fn remove_admin(&mut self, caller: &Address, admin: &Address) -> Result<()> {
        if caller != &self.owner {
            return Err(Error::Unauthorized);
        }
        
        if admin == &self.owner {
            return Err(Error::Unauthorized); // Cannot remove owner as admin
        }
        
        self.admins.retain(|a| a != admin);
        
        Ok(())
    }
    
    /// Update price for a specific token
    pub fn update_price(&mut self, caller: &Address, token: String, price: u128, timestamp: u64) -> Result<PriceUpdated> {
        if !self.is_authorized(caller) {
            return Err(Error::Unauthorized);
        }
        
        // Basic validation
        if token.is_empty() {
            return Err(Error::InvalidToken);
        }
        
        if price == 0 {
            return Err(Error::InvalidPrice);
        }
        
        // Update price data
        self.prices.insert(token.clone(), price);
        self.last_updated.insert(token.clone(), timestamp);
        
        // Return event data
        Ok(PriceUpdated {
            token,
            price,
            timestamp,
            updater: *caller,
        })
    }
    
    /// Get price for a specific token
    pub fn get_price(&self, token: &str) -> Option<u128> {
        self.prices.get(token).copied()
    }
    
    /// Get timestamp of last update for a specific token
    pub fn get_last_updated(&self, token: &str) -> Option<u64> {
        self.last_updated.get(token).copied()
    }
    
    /// Get all token prices
    pub fn get_all_prices(&self) -> HashMap<String, u128> {
        self.prices.clone()
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
    }
    
    static mut ORACLE: Option<PriceOracle> = None;
    
    // Helper to get singleton oracle instance
    fn get_oracle() -> &'static mut PriceOracle {
        unsafe {
            if ORACLE.is_none() {
                let caller = l1x_get_caller();
                ORACLE = Some(PriceOracle::new(caller));
            }
            ORACLE.as_mut().unwrap()
        }
    }
    
    // Public contract API functions
    
    /// Update price for a specific token
    #[no_mangle]
    pub extern "C" fn update_price(token_ptr: *const u8, token_len: usize, price: u128) -> i32 {
        let caller = unsafe { l1x_get_caller() };
        let timestamp = unsafe { l1x_get_timestamp() };
        
        // Convert token name from pointer to string
        let token_slice = unsafe { std::slice::from_raw_parts(token_ptr, token_len) };
        let token = match std::str::from_utf8(token_slice) {
            Ok(s) => s.to_string(),
            Err(_) => return -1, // Invalid UTF-8
        };
        
        let oracle = get_oracle();
        match oracle.update_price(&caller, token, price, timestamp) {
            Ok(event) => {
                // In a real implementation, we would serialize the event and emit it
                let event_type = "PriceUpdated";
                let event_data = format!("{{\"token\":\"{}\",\"price\":{},\"timestamp\":{}}}", 
                    event.token, event.price, event.timestamp);
                
                unsafe {
                    l1x_emit_event(event_type, event_data.as_bytes());
                }
                0 // Success
            },
            Err(Error::Unauthorized) => -2,
            Err(Error::InvalidToken) => -3,
            Err(Error::InvalidPrice) => -4,
        }
    }
    
    /// Get price for a specific token
    #[no_mangle]
    pub extern "C" fn get_price(token_ptr: *const u8, token_len: usize) -> u128 {
        // Convert token name from pointer to string
        let token_slice = unsafe { std::slice::from_raw_parts(token_ptr, token_len) };
        let token = match std::str::from_utf8(token_slice) {
            Ok(s) => s,
            Err(_) => return 0, // Invalid UTF-8
        };
        
        let oracle = get_oracle();
        oracle.get_price(token).unwrap_or(0)
    }
    
    /// Add a new admin
    #[no_mangle]
    pub extern "C" fn add_admin(admin_ptr: *const u8) -> i32 {
        let caller = unsafe { l1x_get_caller() };
        
        // Convert admin address from pointer
        let admin_slice = unsafe { std::slice::from_raw_parts(admin_ptr, 20) };
        let mut admin = [0u8; 20];
        admin.copy_from_slice(admin_slice);
        
        let oracle = get_oracle();
        match oracle.add_admin(&caller, admin) {
            Ok(_) => 0, // Success
            Err(Error::Unauthorized) => -2,
            _ => -1, // Other error
        }
    }
    
    /// Remove an admin
    #[no_mangle]
    pub extern "C" fn remove_admin(admin_ptr: *const u8) -> i32 {
        let caller = unsafe { l1x_get_caller() };
        
        // Convert admin address from pointer
        let admin_slice = unsafe { std::slice::from_raw_parts(admin_ptr, 20) };
        let mut admin = [0u8; 20];
        admin.copy_from_slice(admin_slice);
        
        let oracle = get_oracle();
        match oracle.remove_admin(&caller, &admin) {
            Ok(_) => 0, // Success
            Err(Error::Unauthorized) => -2,
            _ => -1, // Other error
        }
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
    fn test_new_oracle() {
        let owner = create_address(1);
        let oracle = PriceOracle::new(owner);
        
        assert_eq!(oracle.owner, owner);
        assert_eq!(oracle.admins.len(), 1);
        assert_eq!(oracle.admins[0], owner);
        assert!(oracle.prices.is_empty());
        assert!(oracle.last_updated.is_empty());
    }
    
    #[test]
    fn test_update_price() {
        let owner = create_address(1);
        let mut oracle = PriceOracle::new(owner);
        
        let result = oracle.update_price(&owner, "BTC".to_string(), 5000000000000, 1234567890);
        assert!(result.is_ok());
        
        let price = oracle.get_price("BTC").unwrap();
        assert_eq!(price, 5000000000000);
        
        let timestamp = oracle.get_last_updated("BTC").unwrap();
        assert_eq!(timestamp, 1234567890);
    }
    
    #[test]
    fn test_unauthorized_update() {
        let owner = create_address(1);
        let mut oracle = PriceOracle::new(owner);
        
        let unauthorized = create_address(2);
        let result = oracle.update_price(&unauthorized, "BTC".to_string(), 5000000000000, 1234567890);
        assert!(matches!(result, Err(Error::Unauthorized)));
    }
    
    #[test]
    fn test_admin_management() {
        let owner = create_address(1);
        let mut oracle = PriceOracle::new(owner);
        
        let new_admin = create_address(2);
        let unauthorized = create_address(3);
        
        // Owner can add admin
        let result = oracle.add_admin(&owner, new_admin);
        assert!(result.is_ok());
        assert_eq!(oracle.admins.len(), 2);
        
        // Non-owner cannot add admin
        let result = oracle.add_admin(&unauthorized, create_address(4));
        assert!(matches!(result, Err(Error::Unauthorized)));
        
        // New admin can update prices
        let result = oracle.update_price(&new_admin, "ETH".to_string(), 3000000000000, 1234567890);
        assert!(result.is_ok());
        
        // Owner can remove admin
        let result = oracle.remove_admin(&owner, &new_admin);
        assert!(result.is_ok());
        assert_eq!(oracle.admins.len(), 1);
        
        // Removed admin can no longer update prices
        let result = oracle.update_price(&new_admin, "LTC".to_string(), 1000000000000, 1234567890);
        assert!(matches!(result, Err(Error::Unauthorized)));
    }
}