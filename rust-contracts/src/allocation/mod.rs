//! Allocation functionality for One Capital Auto-Investing
//! 
//! This module defines asset allocations within a portfolio and handles
//! the drift calculation and rebalancing logic.

use serde::{Deserialize, Serialize};
use borsh::{BorshSerialize, BorshDeserialize};
use l1x_sdk::prelude::*;

/// Asset allocation record for a single asset within a portfolio
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct AssetAllocation {
    /// Asset ID (usually the token symbol, e.g., "BTC")
    pub asset_id: String,
    
    /// Current percentage allocation (in basis points, 10000 = 100%)
    pub current_percentage: u32,
    
    /// Target percentage allocation (in basis points, 10000 = 100%)
    pub target_percentage: u32,
    
    /// Last modified timestamp
    pub last_modified: u64,
    
    /// Last rebalance timestamp
    pub last_rebalance: u64,
    
    /// Last known price (in USD, scaled by 1e8 for precision)
    pub last_price: Option<u128>,
}

impl AssetAllocation {
    /// Creates a new asset allocation
    pub fn new(asset_id: String, target_percentage: u32) -> Self {
        Self {
            asset_id,
            current_percentage: target_percentage, // Initially set to target
            target_percentage,
            last_modified: l1x_sdk::env::block_timestamp(),
            last_rebalance: 0,
            last_price: None,
        }
    }
    
    /// Updates the current percentage allocation
    pub fn update_current_percentage(&mut self, percentage: u32) {
        self.current_percentage = percentage;
        self.last_modified = l1x_sdk::env::block_timestamp();
    }
    
    /// Updates the target percentage allocation
    pub fn update_target_percentage(&mut self, percentage: u32) {
        self.target_percentage = percentage;
        self.last_modified = l1x_sdk::env::block_timestamp();
    }
    
    /// Records a rebalance operation
    pub fn record_rebalance(&mut self, current_price: Option<u128>) {
        self.last_rebalance = l1x_sdk::env::block_timestamp();
        self.current_percentage = self.target_percentage;
        self.last_price = current_price;
    }
    
    /// Calculates drift from target (in basis points)
    pub fn drift(&self) -> u32 {
        if self.current_percentage > self.target_percentage {
            self.current_percentage - self.target_percentage
        } else {
            self.target_percentage - self.current_percentage
        }
    }
    
    /// Calculates drift as a percentage of target (scaled by 100 for precision)
    /// Returns (drift_percentage * 100) for more precise calculations
    pub fn drift_percentage(&self) -> u32 {
        if self.target_percentage == 0 {
            return 0;
        }
        
        let drift_amount = self.drift();
        (drift_amount * 10000) / self.target_percentage
    }
    
    /// Determines if the asset is overweight relative to target
    pub fn is_overweight(&self) -> bool {
        self.current_percentage > self.target_percentage
    }
    
    /// Determines if the asset is underweight relative to target
    pub fn is_underweight(&self) -> bool {
        self.current_percentage < self.target_percentage
    }
    
    /// Creates a drift result for event emission
    pub fn create_drift_result(&self, threshold: u32) -> crate::events::DriftResult {
        let drift_amount = self.drift();
        crate::events::DriftResult {
            asset_id: self.asset_id.clone(),
            current_percentage: self.current_percentage,
            target_percentage: self.target_percentage,
            drift_amount,
            exceeds_threshold: drift_amount > threshold,
        }
    }
}

/// Set of asset allocations for a portfolio
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct AllocationSet {
    /// Drift threshold (in basis points) that triggers rebalancing
    pub drift_threshold_bp: u32,
    
    /// Rebalance frequency in seconds (0 = manual only)
    pub rebalance_frequency_seconds: u64,
    
    /// List of asset allocations
    pub allocations: Vec<AssetAllocation>,
    
    /// Last rebalance timestamp
    pub last_rebalance: u64,
}

impl AllocationSet {
    /// Creates a new allocation set with the specified drift threshold
    pub fn new(drift_threshold_bp: u32) -> Self {
        Self {
            drift_threshold_bp,
            rebalance_frequency_seconds: 0, // Default to manual rebalancing
            allocations: Vec::new(),
            last_rebalance: 0,
        }
    }
    
    /// Sets rebalance frequency
    pub fn set_rebalance_frequency(&mut self, frequency_seconds: u64) {
        self.rebalance_frequency_seconds = frequency_seconds;
    }
    
    /// Adds a new asset allocation to the set
    pub fn add_allocation(&mut self, allocation: AssetAllocation) -> Result<(), &'static str> {
        // Check if the asset already exists
        if self.allocations.iter().any(|a| a.asset_id == allocation.asset_id) {
            return Err("Asset already exists in allocation");
        }
        
        self.allocations.push(allocation);
        Ok(())
    }
    
    /// Updates an existing asset allocation
    pub fn update_allocation(&mut self, asset_id: &str, target_percentage: u32) -> Result<(), &'static str> {
        let allocation = self.allocations.iter_mut()
            .find(|a| a.asset_id == asset_id)
            .ok_or("Asset not found in allocation")?;
            
        allocation.update_target_percentage(target_percentage);
        Ok(())
    }
    
    /// Removes an asset allocation
    pub fn remove_allocation(&mut self, asset_id: &str) -> Result<(), &'static str> {
        let pos = self.allocations.iter()
            .position(|a| a.asset_id == asset_id)
            .ok_or("Asset not found in allocation")?;
            
        self.allocations.remove(pos);
        Ok(())
    }
    
    /// Gets an asset allocation by ID
    pub fn get_allocation(&self, asset_id: &str) -> Option<&AssetAllocation> {
        self.allocations.iter().find(|a| a.asset_id == asset_id)
    }
    
    /// Checks if rebalancing is needed based on drift or time
    pub fn needs_rebalancing(&self) -> bool {
        // Check if time-based rebalancing is needed
        if self.rebalance_frequency_seconds > 0 {
            let current_time = l1x_sdk::env::block_timestamp();
            let elapsed = current_time.saturating_sub(self.last_rebalance);
            
            if elapsed >= self.rebalance_frequency_seconds {
                return true;
            }
        }
        
        // Check if drift-based rebalancing is needed
        for allocation in &self.allocations {
            if allocation.drift() > self.drift_threshold_bp {
                return true;
            }
        }
        
        false
    }
    
    /// Checks if rebalancing is needed and emits appropriate events
    pub fn check_and_emit_rebalance_events(&self, vault_id: &str) -> bool {
        // Check if time-based rebalancing is needed
        if self.rebalance_frequency_seconds > 0 {
            let current_time = l1x_sdk::env::block_timestamp();
            let elapsed = current_time.saturating_sub(self.last_rebalance);
            
            if elapsed >= self.rebalance_frequency_seconds {
                // Emit scheduled rebalance event
                let data = format!("{{\"elapsed_seconds\": {}, \"frequency\": {}}}", 
                    elapsed, self.rebalance_frequency_seconds);
                let event = crate::events::RebalanceEvent::new(
                    crate::events::RebalanceEventType::ScheduledRebalance, 
                    vault_id.to_string()
                ).with_data(data);
                event.emit();
                
                return true;
            }
        }
        
        // Check if drift-based rebalancing is needed
        let mut needs_rebalance = false;
        let mut drift_results = Vec::new();
        
        for allocation in &self.allocations {
            let drift = allocation.drift();
            let drift_result = allocation.create_drift_result(self.drift_threshold_bp);
            
            if drift > self.drift_threshold_bp {
                needs_rebalance = true;
                drift_results.push(drift_result);
            }
        }
        
        // Emit drift exceeded event if needed
        if needs_rebalance && !drift_results.is_empty() {
            crate::events::emit_drift_exceeded_event(vault_id, drift_results);
        }
        
        needs_rebalance
    }
    
    /// Records a rebalance operation
    pub fn record_rebalance(&mut self, prices: &[(String, u128)]) {
        self.last_rebalance = l1x_sdk::env::block_timestamp();
        
        // Create a price map for lookup
        let price_map: std::collections::HashMap<&str, u128> = prices
            .iter()
            .map(|(asset_id, price)| (asset_id.as_str(), *price))
            .collect();
            
        // Update each allocation
        for allocation in &mut self.allocations {
            let price = price_map.get(allocation.asset_id.as_str()).copied();
            allocation.record_rebalance(price);
        }
    }
    
    /// Performs auto-rebalancing calculation and returns transactions needed
    pub fn calculate_rebalance_transactions(
        &self,
        current_values: &[(String, u128)],
        total_value: u128
    ) -> Vec<(String, String, u128)> {
        if total_value == 0 || self.allocations.is_empty() {
            return Vec::new();
        }
        
        // Calculate target values based on allocations
        let mut target_values = Vec::new();
        
        for allocation in &self.allocations {
            let target_value = total_value * (allocation.target_percentage as u128) / 10000;
            target_values.push((allocation.asset_id.clone(), target_value));
        }
        
        // Convert current values to a map for easier lookup
        let current_value_map: std::collections::HashMap<&str, u128> = current_values
            .iter()
            .map(|(asset_id, value)| (asset_id.as_str(), *value))
            .collect();
            
        // Find assets to sell (current > target) and buy (current < target)
        let mut sellers = Vec::new();
        let mut buyers = Vec::new();
        
        for (asset_id, target_value) in &target_values {
            let current_value = *current_value_map.get(asset_id.as_str()).unwrap_or(&0);
            
            if current_value > *target_value {
                // Need to sell some of this asset
                sellers.push((asset_id.clone(), current_value - target_value));
            } else if current_value < *target_value {
                // Need to buy some of this asset
                buyers.push((asset_id.clone(), target_value - current_value));
            }
        }
        
        // Match sellers with buyers to create transactions
        let mut transactions = Vec::new();
        let mut i = 0;
        let mut j = 0;
        
        while i < sellers.len() && j < buyers.len() {
            let (sell_asset, mut sell_amount) = sellers[i].clone();
            let (buy_asset, mut buy_amount) = buyers[j].clone();
            
            let amount_to_swap = sell_amount.min(buy_amount);
            
            if amount_to_swap > 0 {
                transactions.push((sell_asset.clone(), buy_asset.clone(), amount_to_swap));
                
                // Update remaining amounts
                sell_amount -= amount_to_swap;
                buy_amount -= amount_to_swap;
                
                sellers[i] = (sell_asset, sell_amount);
                buyers[j] = (buy_asset, buy_amount);
                
                // Move to next seller or buyer if fully processed
                if sell_amount == 0 {
                    i += 1;
                }
                
                if buy_amount == 0 {
                    j += 1;
                }
            }
        }
        
        transactions
    }
    
    /// Validates that allocation percentages sum to 100%
    pub fn validate_percentages(&self) -> Result<(), &'static str> {
        let total: u32 = self.allocations.iter().map(|a| a.target_percentage).sum();
        
        if total != 10000 {
            return Err("Allocation percentages must sum to 100%");
        }
        
        Ok(())
    }
}

// Contract implementation with Borsh serialization
const STORAGE_CONTRACT_KEY: &[u8] = b"ALLOCATION";

#[derive(BorshSerialize, BorshDeserialize)]
pub struct AllocationContract {
    allocations: std::collections::HashMap<String, AllocationSet>, // Vault ID -> AllocationSet
}

#[l1x_sdk::contract]
impl AllocationContract {
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
            allocations: std::collections::HashMap::new(),
        };

        state.save()
    }
    
    /// Creates a new allocation set for a vault
    pub fn create_allocation_set(vault_id: String, drift_threshold_bp: u32) -> String {
        let mut state = Self::load();
        
        if state.allocations.contains_key(&vault_id) {
            panic!("Allocation set already exists for this vault");
        }
        
        let allocation_set = AllocationSet::new(drift_threshold_bp);
        state.allocations.insert(vault_id.clone(), allocation_set);
        state.save();
        
        format!("Allocation set created for vault {}", vault_id)
    }
    
    /// Sets rebalance frequency for a vault
    pub fn set_rebalance_frequency(vault_id: String, frequency_seconds: u64) -> String {
        let mut state = Self::load();
        
        let allocation_set = state.allocations.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Allocation set not found for vault {}", vault_id));
            
        allocation_set.set_rebalance_frequency(frequency_seconds);
        state.save();
        
        format!("Rebalance frequency set for vault {}", vault_id)
    }
    
    /// Adds an asset allocation to a vault
    pub fn add_allocation(vault_id: String, asset_id: String, target_percentage: u32) -> String {
        let mut state = Self::load();
        
        let allocation_set = state.allocations.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Allocation set not found for vault {}", vault_id));
            
        let allocation = AssetAllocation::new(asset_id.clone(), target_percentage);
        allocation_set.add_allocation(allocation)
            .unwrap_or_else(|err| panic!("Failed to add allocation: {}", err));
            
        state.save();
        
        format!("Allocation added for {} in vault {}", asset_id, vault_id)
    }
    
    /// Updates an asset allocation in a vault
    pub fn update_allocation(vault_id: String, asset_id: String, target_percentage: u32) -> String {
        let mut state = Self::load();
        
        let allocation_set = state.allocations.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Allocation set not found for vault {}", vault_id));
            
        allocation_set.update_allocation(&asset_id, target_percentage)
            .unwrap_or_else(|err| panic!("Failed to update allocation: {}", err));
            
        state.save();
        
        format!("Allocation updated for {} in vault {}", asset_id, vault_id)
    }
    
    /// Removes an asset allocation from a vault
    pub fn remove_allocation(vault_id: String, asset_id: String) -> String {
        let mut state = Self::load();
        
        let allocation_set = state.allocations.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Allocation set not found for vault {}", vault_id));
            
        allocation_set.remove_allocation(&asset_id)
            .unwrap_or_else(|err| panic!("Failed to remove allocation: {}", err));
            
        state.save();
        
        format!("Allocation removed for {} in vault {}", asset_id, vault_id)
    }
    
    /// Gets all allocations for a vault
    pub fn get_allocations(vault_id: String) -> String {
        let state = Self::load();
        
        let allocation_set = state.allocations.get(&vault_id)
            .unwrap_or_else(|| panic!("Allocation set not found for vault {}", vault_id));
            
        // Return allocations as JSON
        serde_json::to_string(&allocation_set.allocations)
            .unwrap_or_else(|_| "Failed to serialize allocations".to_string())
    }
    
    /// Gets allocation set information for a vault
    pub fn get_allocation_set(vault_id: String) -> String {
        let state = Self::load();
        
        let allocation_set = state.allocations.get(&vault_id)
            .unwrap_or_else(|| panic!("Allocation set not found for vault {}", vault_id));
            
        // Return allocation set as JSON
        serde_json::to_string(allocation_set)
            .unwrap_or_else(|_| "Failed to serialize allocation set".to_string())
    }
    
    /// Checks if a vault needs rebalancing
    pub fn needs_rebalancing(vault_id: String) -> bool {
        let state = Self::load();
        
        let allocation_set = state.allocations.get(&vault_id)
            .unwrap_or_else(|| panic!("Allocation set not found for vault {}", vault_id));
            
        allocation_set.needs_rebalancing()
    }
    
    /// Records a rebalance operation for a vault
    pub fn record_rebalance(vault_id: String, prices_json: String) -> String {
        let mut state = Self::load();
        
        let allocation_set = state.allocations.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Allocation set not found for vault {}", vault_id));
            
        // Parse prices from JSON
        let prices: Vec<(String, u128)> = serde_json::from_str(&prices_json)
            .unwrap_or_else(|_| panic!("Failed to parse prices"));
            
        allocation_set.record_rebalance(&prices);
        state.save();
        
        format!("Rebalance recorded for vault {}", vault_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_asset_allocation() {
        let mut allocation = AssetAllocation::new("BTC".to_string(), 6000);
        
        assert_eq!(allocation.asset_id, "BTC");
        assert_eq!(allocation.target_percentage, 6000);
        assert_eq!(allocation.current_percentage, 6000);
        
        // Update target percentage
        allocation.update_target_percentage(7000);
        assert_eq!(allocation.target_percentage, 7000);
        assert_eq!(allocation.current_percentage, 6000);
        
        // Calculate drift
        assert_eq!(allocation.drift(), 1000);
        
        // Record rebalance
        allocation.record_rebalance(Some(50000));
        assert_eq!(allocation.current_percentage, 7000);
        assert_eq!(allocation.last_price, Some(50000));
    }
    
    #[test]
    fn test_allocation_set() {
        let mut set = AllocationSet::new(300);
        
        // Add BTC allocation
        let btc = AssetAllocation::new("BTC".to_string(), 6000);
        set.add_allocation(btc).unwrap();
        
        // Add ETH allocation
        let eth = AssetAllocation::new("ETH".to_string(), 4000);
        set.add_allocation(eth).unwrap();
        
        // Validate percentages
        assert!(set.validate_percentages().is_ok());
        
        // Try to add duplicate asset
        let btc_dup = AssetAllocation::new("BTC".to_string(), 5000);
        assert!(set.add_allocation(btc_dup).is_err());
        
        // Update an allocation
        set.update_allocation("BTC", 5000).unwrap();
        
        // Validate that percentages no longer sum to 100%
        assert!(set.validate_percentages().is_err());
        
        // Fix percentages
        set.update_allocation("ETH", 5000).unwrap();
        assert!(set.validate_percentages().is_ok());
        
        // Check if rebalancing is needed (no drift yet)
        assert!(!set.needs_rebalancing());
        
        // Update current percentage to create drift
        let btc_allocation = set.allocations.iter_mut()
            .find(|a| a.asset_id == "BTC")
            .unwrap();
            
        btc_allocation.update_current_percentage(6000);
        
        // Now we should need rebalancing (1000 bp drift > 300 bp threshold)
        assert!(set.needs_rebalancing());
        
        // Record a rebalance
        let prices = vec![
            ("BTC".to_string(), 50000),
            ("ETH".to_string(), 3000),
        ];
        
        set.record_rebalance(&prices);
        
        // After rebalance, we shouldn't need another one
        assert!(!set.needs_rebalancing());
        
        // Set a time-based rebalance frequency
        set.set_rebalance_frequency(86400); // 1 day
        
        // Fast-forward 2 days
        let current_time = l1x_sdk::env::block_timestamp();
        l1x_sdk::env::set_block_timestamp(current_time + 172800);
        
        // Now we should need time-based rebalancing
        assert!(set.needs_rebalancing());
    }
}