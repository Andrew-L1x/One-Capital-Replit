//! Price Feed Oracle for One Capital Auto-Investing
//!
//! This module provides an on-chain Oracle for asset price data,
//! with support for updating prices from authorized price providers
//! and querying current and historical price information.

use serde::{Deserialize, Serialize};
use borsh::{BorshSerialize, BorshDeserialize};
use l1x_sdk::prelude::*;

/// Price data for a single asset
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct PriceData {
    /// Asset symbol (e.g., "BTC")
    pub symbol: String,
    
    /// Current price in USD (scaled by 1e8 for precision)
    pub price: u128,
    
    /// Last update timestamp
    pub updated_at: u64,
    
    /// Provider ID who updated the price
    pub provider: String,
    
    /// Optional signature from the provider
    pub signature: Option<String>,
}

/// Price feed authority type
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct PriceFeedAuthority {
    /// Authority address
    pub address: String,
    
    /// Authority name
    pub name: String,
    
    /// Whether this authority is active
    pub active: bool,
    
    /// Timestamp when the authority was added
    pub added_at: u64,
}

/// Price history record
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct PriceHistoryRecord {
    /// Asset symbol
    pub symbol: String,
    
    /// Price in USD (scaled by 1e8)
    pub price: u128,
    
    /// Timestamp of the record
    pub timestamp: u64,
}

/// Price feed contract storage
const STORAGE_CONTRACT_KEY: &[u8] = b"PRICE_FEED";

#[derive(BorshSerialize, BorshDeserialize)]
pub struct PriceFeedContract {
    /// Current prices for all assets
    prices: std::collections::HashMap<String, PriceData>,
    
    /// Authorized price feed providers
    authorities: std::collections::HashMap<String, PriceFeedAuthority>,
    
    /// Price history (we keep a limited history for each asset)
    history: std::collections::HashMap<String, Vec<PriceHistoryRecord>>,
    
    /// Max history records per asset
    max_history_records: usize,
    
    /// Admin address (can add/remove authorities)
    admin: String,
}

#[l1x_sdk::contract]
impl PriceFeedContract {
    fn load() -> Self {
        match l1x_sdk::storage_read(STORAGE_CONTRACT_KEY) {
            Some(bytes) => Self::try_from_slice(&bytes).unwrap(),
            None => panic!("The contract isn't initialized"),
        }
    }

    fn save(&mut self) {
        l1x_sdk::storage_write(STORAGE_CONTRACT_KEY, &self.try_to_vec().unwrap());
    }

    pub fn new(admin: String) {
        let mut state = Self {
            prices: std::collections::HashMap::new(),
            authorities: std::collections::HashMap::new(),
            history: std::collections::HashMap::new(),
            max_history_records: 24, // Keep 24 hours of hourly data by default
            admin,
        };
        
        // Add admin as the first authority
        state.authorities.insert(admin.clone(), PriceFeedAuthority {
            address: admin.clone(),
            name: "Admin".to_string(),
            active: true,
            added_at: l1x_sdk::env::block_timestamp(),
        });
        
        state.save()
    }
    
    /// Checks if the caller is an admin
    fn is_admin() -> bool {
        let state = Self::load();
        let caller = l1x_sdk::env::caller();
        
        state.admin == caller
    }
    
    /// Checks if the caller is an authorized price provider
    fn is_authority() -> bool {
        let state = Self::load();
        let caller = l1x_sdk::env::caller();
        
        if state.admin == caller {
            return true;
        }
        
        match state.authorities.get(&caller) {
            Some(authority) => authority.active,
            None => false,
        }
    }
    
    /// Adds a new price feed authority
    pub fn add_authority(address: String, name: String) -> String {
        if !Self::is_admin() {
            panic!("Only admin can add authorities");
        }
        
        let mut state = Self::load();
        
        if state.authorities.contains_key(&address) {
            panic!("Authority already exists");
        }
        
        let authority = PriceFeedAuthority {
            address: address.clone(),
            name,
            active: true,
            added_at: l1x_sdk::env::block_timestamp(),
        };
        
        state.authorities.insert(address.clone(), authority);
        state.save();
        
        format!("Authority {} added", address)
    }
    
    /// Removes a price feed authority
    pub fn remove_authority(address: String) -> String {
        if !Self::is_admin() {
            panic!("Only admin can remove authorities");
        }
        
        let mut state = Self::load();
        
        if address == state.admin {
            panic!("Cannot remove admin authority");
        }
        
        if !state.authorities.contains_key(&address) {
            panic!("Authority does not exist");
        }
        
        state.authorities.remove(&address);
        state.save();
        
        format!("Authority {} removed", address)
    }
    
    /// Disables a price feed authority
    pub fn disable_authority(address: String) -> String {
        if !Self::is_admin() {
            panic!("Only admin can disable authorities");
        }
        
        let mut state = Self::load();
        
        if address == state.admin {
            panic!("Cannot disable admin authority");
        }
        
        let authority = state.authorities.get_mut(&address)
            .unwrap_or_else(|| panic!("Authority not found: {}", address));
            
        authority.active = false;
        state.save();
        
        format!("Authority {} disabled", address)
    }
    
    /// Enables a price feed authority
    pub fn enable_authority(address: String) -> String {
        if !Self::is_admin() {
            panic!("Only admin can enable authorities");
        }
        
        let mut state = Self::load();
        
        let authority = state.authorities.get_mut(&address)
            .unwrap_or_else(|| panic!("Authority not found: {}", address));
            
        authority.active = true;
        state.save();
        
        format!("Authority {} enabled", address)
    }
    
    /// Sets the maximum number of history records per asset
    pub fn set_max_history_records(max_records: usize) -> String {
        if !Self::is_admin() {
            panic!("Only admin can change max history records");
        }
        
        let mut state = Self::load();
        state.max_history_records = max_records;
        state.save();
        
        format!("Max history records set to {}", max_records)
    }
    
    /// Updates the price for a single asset
    pub fn update_price(symbol: String, price: u128, signature: Option<String>) -> String {
        if !Self::is_authority() {
            panic!("Only authorized price providers can update prices");
        }
        
        let mut state = Self::load();
        let caller = l1x_sdk::env::caller();
        let now = l1x_sdk::env::block_timestamp();
        
        // Create new price data
        let price_data = PriceData {
            symbol: symbol.clone(),
            price,
            updated_at: now,
            provider: caller,
            signature,
        };
        
        // Add to history before updating current price
        let history_record = PriceHistoryRecord {
            symbol: symbol.clone(),
            price,
            timestamp: now,
        };
        
        let history = state.history.entry(symbol.clone())
            .or_insert_with(Vec::new);
            
        history.push(history_record);
        
        // Trim history if needed
        if history.len() > state.max_history_records {
            *history = history[history.len() - state.max_history_records..].to_vec();
        }
        
        // Update current price
        state.prices.insert(symbol.clone(), price_data);
        state.save();
        
        format!("Price updated for {}: {}", symbol, price)
    }
    
    /// Updates prices for multiple assets
    pub fn update_prices(prices_json: String) -> String {
        if !Self::is_authority() {
            panic!("Only authorized price providers can update prices");
        }
        
        // Parse prices from JSON
        let price_updates: Vec<(String, u128)> = serde_json::from_str(&prices_json)
            .unwrap_or_else(|_| panic!("Failed to parse prices"));
            
        let mut state = Self::load();
        let caller = l1x_sdk::env::caller();
        let now = l1x_sdk::env::block_timestamp();
        
        for (symbol, price) in price_updates {
            // Create new price data
            let price_data = PriceData {
                symbol: symbol.clone(),
                price,
                updated_at: now,
                provider: caller.clone(),
                signature: None,
            };
            
            // Add to history
            let history_record = PriceHistoryRecord {
                symbol: symbol.clone(),
                price,
                timestamp: now,
            };
            
            let history = state.history.entry(symbol.clone())
                .or_insert_with(Vec::new);
                
            history.push(history_record);
            
            // Trim history if needed
            if history.len() > state.max_history_records {
                *history = history[history.len() - state.max_history_records..].to_vec();
            }
            
            // Update current price
            state.prices.insert(symbol.clone(), price_data);
        }
        
        state.save();
        
        format!("Updated prices for {} assets", price_updates.len())
    }
    
    /// Gets the current price for a single asset
    pub fn get_price(symbol: String) -> String {
        let state = Self::load();
        
        match state.prices.get(&symbol) {
            Some(price_data) => serde_json::to_string(price_data)
                .unwrap_or_else(|_| "Failed to serialize price data".to_string()),
                
            None => format!("No price data for {}", symbol),
        }
    }
    
    /// Gets the current prices for all assets
    pub fn get_all_prices() -> String {
        let state = Self::load();
        
        let prices: std::collections::HashMap<String, u128> = state.prices
            .iter()
            .map(|(symbol, data)| (symbol.clone(), data.price))
            .collect();
            
        serde_json::to_string(&prices)
            .unwrap_or_else(|_| "Failed to serialize prices".to_string())
    }
    
    /// Gets the price history for a single asset
    pub fn get_price_history(symbol: String) -> String {
        let state = Self::load();
        
        match state.history.get(&symbol) {
            Some(history) => serde_json::to_string(history)
                .unwrap_or_else(|_| "Failed to serialize price history".to_string()),
                
            None => format!("No price history for {}", symbol),
        }
    }
    
    /// Gets the time-weighted average price (TWAP) for an asset
    pub fn get_twap(symbol: String, period_seconds: u64) -> String {
        let state = Self::load();
        
        let history = match state.history.get(&symbol) {
            Some(h) => h,
            None => return format!("No price history for {}", symbol),
        };
        
        if history.is_empty() {
            return format!("No price history for {}", symbol);
        }
        
        let now = l1x_sdk::env::block_timestamp();
        let start_time = now.saturating_sub(period_seconds);
        
        // Filter records within the time window
        let relevant_records: Vec<&PriceHistoryRecord> = history
            .iter()
            .filter(|record| record.timestamp >= start_time)
            .collect();
            
        if relevant_records.is_empty() {
            return format!("No price data for {} in the last {} seconds", symbol, period_seconds);
        }
        
        // Calculate TWAP
        let mut sum_price_time = 0.0;
        let mut total_time = 0.0;
        
        for i in 0..relevant_records.len() - 1 {
            let current = relevant_records[i];
            let next = relevant_records[i + 1];
            
            let time_diff = (next.timestamp - current.timestamp) as f64;
            sum_price_time += (current.price as f64) * time_diff;
            total_time += time_diff;
        }
        
        // Add the last record, using time until now
        let last = relevant_records.last().unwrap();
        let time_diff = (now - last.timestamp) as f64;
        sum_price_time += (last.price as f64) * time_diff;
        total_time += time_diff;
        
        let twap = if total_time > 0.0 {
            sum_price_time / total_time
        } else {
            // If there's only one record or records at the same time
            last.price as f64
        };
        
        // Return the TWAP as a JSON
        let result = serde_json::json!({
            "symbol": symbol,
            "twap": twap,
            "period_seconds": period_seconds,
            "records_used": relevant_records.len(),
        });
        
        serde_json::to_string(&result)
            .unwrap_or_else(|_| "Failed to serialize TWAP result".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_price_update() {
        let symbol = "BTC".to_string();
        let price = 50000_00000000; // $50,000 with 8 decimal precision
        
        let price_data = PriceData {
            symbol: symbol.clone(),
            price,
            updated_at: 0,
            provider: "test_provider".to_string(),
            signature: None,
        };
        
        assert_eq!(price_data.symbol, symbol);
        assert_eq!(price_data.price, price);
    }
    
    #[test]
    fn test_history_record() {
        let record = PriceHistoryRecord {
            symbol: "ETH".to_string(),
            price: 3000_00000000, // $3,000 with 8 decimal precision
            timestamp: 1234567890,
        };
        
        assert_eq!(record.symbol, "ETH");
        assert_eq!(record.price, 3000_00000000);
        assert_eq!(record.timestamp, 1234567890);
    }
}