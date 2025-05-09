//! Asset allocation module for portfolio management
//! 
//! This module defines the core data structures and functions for managing
//! asset allocations within investment portfolios.

use serde::{Deserialize, Serialize};
use l1x_sdk::prelude::*;

/// Represents an asset allocation within a portfolio
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetAllocation {
    /// Asset identifier (e.g., token address)
    pub asset_id: String,
    
    /// Target percentage for this asset in the portfolio (in basis points, 10000 = 100%)
    pub target_percentage: u32,
    
    /// Current percentage of this asset in the portfolio (in basis points)
    pub current_percentage: u32,
    
    /// Last price at which this asset was rebalanced
    pub last_rebalance_price: Option<u128>,
    
    /// Timestamp of the last rebalance
    pub last_rebalance_time: u64,
}

impl AssetAllocation {
    /// Creates a new asset allocation with the specified target percentage
    pub fn new(asset_id: String, target_percentage: u32) -> Self {
        Self {
            asset_id,
            target_percentage,
            current_percentage: 0, // Will be updated during rebalance
            last_rebalance_price: None,
            last_rebalance_time: l1x_sdk::env::block_timestamp(),
        }
    }
    
    /// Checks if the allocation needs rebalancing based on drift threshold
    pub fn needs_rebalancing(&self, drift_threshold_bp: u32) -> bool {
        if self.current_percentage == 0 {
            return true; // New allocation, needs initial balancing
        }
        
        // Calculate drift in basis points
        let drift = if self.current_percentage > self.target_percentage {
            self.current_percentage - self.target_percentage
        } else {
            self.target_percentage - self.current_percentage
        };
        
        drift > drift_threshold_bp
    }
    
    /// Updates the current percentage of this asset
    pub fn update_current_percentage(&mut self, new_percentage: u32) {
        self.current_percentage = new_percentage;
    }
    
    /// Updates the price and timestamp after rebalancing
    pub fn record_rebalance(&mut self, price: Option<u128>) {
        self.last_rebalance_price = price;
        self.last_rebalance_time = l1x_sdk::env::block_timestamp();
    }
}

/// Collection of asset allocations that make up a portfolio
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllocationSet {
    /// List of asset allocations in the portfolio
    pub allocations: Vec<AssetAllocation>,
    
    /// Maximum allowed drift before triggering rebalance (in basis points)
    pub drift_threshold_bp: u32,
}

impl AllocationSet {
    /// Creates a new empty allocation set with the specified drift threshold
    pub fn new(drift_threshold_bp: u32) -> Self {
        Self {
            allocations: Vec::new(),
            drift_threshold_bp,
        }
    }
    
    /// Adds a new asset allocation to the set
    pub fn add_allocation(&mut self, allocation: AssetAllocation) -> Result<(), &'static str> {
        // Validate that the new allocation doesn't push the total over 100%
        let current_total: u32 = self.allocations.iter()
            .map(|a| a.target_percentage)
            .sum();
            
        if current_total + allocation.target_percentage > 10000 {
            return Err("Total allocation exceeds 100%");
        }
        
        self.allocations.push(allocation);
        Ok(())
    }
    
    /// Removes an asset allocation from the set
    pub fn remove_allocation(&mut self, asset_id: &str) -> Result<(), &'static str> {
        let initial_len = self.allocations.len();
        self.allocations.retain(|a| a.asset_id != asset_id);
        
        if self.allocations.len() == initial_len {
            return Err("Asset allocation not found");
        }
        
        Ok(())
    }
    
    /// Updates the target percentage for an existing allocation
    pub fn update_target_percentage(&mut self, asset_id: &str, new_percentage: u32) -> Result<(), &'static str> {
        // Calculate the total of all other allocations
        let others_total: u32 = self.allocations.iter()
            .filter(|a| a.asset_id != asset_id)
            .map(|a| a.target_percentage)
            .sum();
            
        if others_total + new_percentage > 10000 {
            return Err("Total allocation would exceed 100%");
        }
        
        for allocation in &mut self.allocations {
            if allocation.asset_id == asset_id {
                allocation.target_percentage = new_percentage;
                return Ok(());
            }
        }
        
        Err("Asset allocation not found")
    }
    
    /// Checks if any allocations need rebalancing
    pub fn needs_rebalancing(&self) -> bool {
        self.allocations.iter().any(|a| a.needs_rebalancing(self.drift_threshold_bp))
    }
    
    /// Gets the total allocated percentage (should be 10000 for 100%)
    pub fn total_allocation(&self) -> u32 {
        self.allocations.iter().map(|a| a.target_percentage).sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_asset_allocation_basics() {
        let mut allocation = AssetAllocation::new("BTC".to_string(), 5000); // 50%
        assert_eq!(allocation.target_percentage, 5000);
        assert_eq!(allocation.current_percentage, 0);
        
        allocation.update_current_percentage(4500); // 45%
        assert_eq!(allocation.current_percentage, 4500);
        
        // Drift threshold of 300 basis points (3%)
        assert!(allocation.needs_rebalancing(300)); // 5% drift
        assert!(!allocation.needs_rebalancing(600)); // threshold higher than drift
    }
    
    #[test]
    fn test_allocation_set() {
        let mut allocations = AllocationSet::new(300); // 3% drift threshold
        
        // Add BTC allocation (50%)
        let btc = AssetAllocation::new("BTC".to_string(), 5000);
        allocations.add_allocation(btc).unwrap();
        
        // Add ETH allocation (30%)
        let eth = AssetAllocation::new("ETH".to_string(), 3000);
        allocations.add_allocation(eth).unwrap();
        
        // Check total
        assert_eq!(allocations.total_allocation(), 8000); // 80%
        
        // Add too much allocation should fail
        let sol = AssetAllocation::new("SOL".to_string(), 3000); // 30%
        assert!(allocations.add_allocation(sol).is_err()); // Would be 110%
        
        // Update allocation target
        allocations.update_target_percentage("BTC", 6000).unwrap(); // 60%
        
        // Check allocation was updated
        assert_eq!(allocations.allocations[0].target_percentage, 6000);
        
        // Cannot exceed 100%
        assert!(allocations.update_target_percentage("ETH", 5000).is_err()); // Would be 110%
        
        // Remove allocation
        allocations.remove_allocation("BTC").unwrap();
        assert_eq!(allocations.allocations.len(), 1);
        assert_eq!(allocations.allocations[0].asset_id, "ETH");
    }
}
