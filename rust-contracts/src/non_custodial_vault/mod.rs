//! Non-custodial vault implementation for One Capital Auto-Investing
//! 
//! Non-custodial vaults allow users to maintain control over their funds while
//! still benefiting from automated portfolio management strategies.

use serde::{Deserialize, Serialize};
use l1x_sdk::prelude::*;

use crate::allocation::{AllocationSet, AssetAllocation};
use crate::take_profit::TakeProfitStrategy;

/// A non-custodial vault that provides automated management suggestions
/// but requires user approval for transactions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NonCustodialVault {
    /// Unique identifier for the vault
    pub id: String,
    
    /// Owner of the vault
    pub owner: String,
    
    /// Smart contract address of the vault
    pub contract_address: String,
    
    /// Asset allocations for the vault
    pub allocations: AllocationSet,
    
    /// Take profit strategy for the vault
    pub take_profit: Option<TakeProfitStrategy>,
    
    /// Current rebalance nonce (incremented for each rebalance request)
    pub rebalance_nonce: u64,
    
    /// Creation timestamp
    pub created_at: u64,
    
    /// Last rebalance timestamp
    pub last_rebalance: u64,
}

/// Rebalance suggestion for non-custodial vaults
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebalanceSuggestion {
    /// Unique identifier for the suggestion
    pub id: String,
    
    /// Vault ID this suggestion applies to
    pub vault_id: String,
    
    /// Nonce to prevent replay
    pub nonce: u64,
    
    /// Source asset to swap from
    pub source_asset: String,
    
    /// Target asset to swap to
    pub amount: u128,
    
    /// Destination asset
    pub target_asset: String,
    
    /// Expiration timestamp
    pub expires_at: u64,
    
    /// Suggested slippage in basis points
    pub slippage_bps: u32,
}

impl NonCustodialVault {
    /// Creates a new non-custodial vault
    pub fn new(id: String, owner: String, contract_address: String, drift_threshold_bp: u32) -> Self {
        Self {
            id,
            owner,
            contract_address,
            allocations: AllocationSet::new(drift_threshold_bp),
            take_profit: None,
            rebalance_nonce: 0,
            created_at: l1x_sdk::env::block_timestamp(),
            last_rebalance: 0,
        }
    }
    
    /// Checks if the vault needs rebalancing based on allocations
    pub fn needs_rebalancing(&self) -> bool {
        self.allocations.needs_rebalancing()
    }
    
    /// Generates rebalance suggestions based on current allocations and prices
    pub fn generate_rebalance_suggestions(
        &mut self,
        current_values: &[(String, u128)],
        total_value: u128
    ) -> Vec<RebalanceSuggestion> {
        if !self.needs_rebalancing() || total_value == 0 {
            return Vec::new();
        }
        
        // Map current values to asset IDs
        let current_value_map: std::collections::HashMap<&str, u128> = current_values
            .iter()
            .map(|(asset_id, value)| (asset_id.as_str(), *value))
            .collect();
            
        // Calculate target values based on allocations
        let mut target_values = Vec::new();
        
        for allocation in &self.allocations.allocations {
            let target_value = total_value * (allocation.target_percentage as u128) / 10000;
            target_values.push((allocation.asset_id.clone(), target_value));
        }
        
        // Generate rebalance suggestions
        let mut suggestions = Vec::new();
        
        // Find assets to sell (current > target)
        let mut sellers: Vec<(String, u128)> = Vec::new();
        let mut buyers: Vec<(String, u128)> = Vec::new();
        
        for allocation in &self.allocations.allocations {
            let current_value = *current_value_map.get(allocation.asset_id.as_str()).unwrap_or(&0);
            let target_value = total_value * (allocation.target_percentage as u128) / 10000;
            
            if current_value > target_value {
                // Need to sell this asset
                sellers.push((allocation.asset_id.clone(), current_value - target_value));
            } else if current_value < target_value {
                // Need to buy this asset
                buyers.push((allocation.asset_id.clone(), target_value - current_value));
            }
        }
        
        // Match sellers with buyers to create swap suggestions
        let mut i = 0;
        let mut j = 0;
        
        while i < sellers.len() && j < buyers.len() {
            let (sell_asset, mut sell_amount) = sellers[i].clone();
            let (buy_asset, mut buy_amount) = buyers[j].clone();
            
            let amount_to_swap = sell_amount.min(buy_amount);
            
            if amount_to_swap > 0 {
                // Create a suggestion
                let suggestion = RebalanceSuggestion {
                    id: format!("suggestion-{}-{}", self.id, self.rebalance_nonce),
                    vault_id: self.id.clone(),
                    nonce: self.rebalance_nonce,
                    source_asset: sell_asset.clone(),
                    amount: amount_to_swap,
                    target_asset: buy_asset.clone(),
                    expires_at: l1x_sdk::env::block_timestamp() + 3600, // 1 hour expiry
                    slippage_bps: 50, // 0.5% slippage
                };
                
                suggestions.push(suggestion);
                
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
        
        // Increment nonce for next rebalance
        self.rebalance_nonce += 1;
        
        suggestions
    }
    
    /// Updates current allocation percentages after rebalance
    pub fn update_allocations_after_rebalance(&mut self, current_values: &[(String, u128)], total_value: u128) {
        if total_value == 0 {
            return;
        }
        
        // Update current percentages based on actual values
        for allocation in &mut self.allocations.allocations {
            let current_value = current_values.iter()
                .find(|(asset_id, _)| *asset_id == allocation.asset_id)
                .map(|(_, value)| *value)
                .unwrap_or(0);
                
            let current_percentage = ((current_value as f64) / (total_value as f64) * 10000.0) as u32;
            allocation.update_current_percentage(current_percentage);
        }
        
        self.last_rebalance = l1x_sdk::env::block_timestamp();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_non_custodial_vault_creation() {
        let vault = NonCustodialVault::new(
            "vault-1".to_string(),
            "owner-1".to_string(),
            "0xcontract".to_string(),
            300, // 3% drift threshold
        );
        
        assert_eq!(vault.owner, "owner-1");
        assert_eq!(vault.contract_address, "0xcontract");
        assert_eq!(vault.rebalance_nonce, 0);
    }
    
    #[test]
    fn test_rebalance_suggestions() {
        let mut vault = NonCustodialVault::new(
            "vault-1".to_string(),
            "owner-1".to_string(),
            "0xcontract".to_string(),
            300,
        );
        
        // Add BTC allocation (50%)
        let btc = AssetAllocation::new("BTC".to_string(), 5000);
        vault.allocations.add_allocation(btc).unwrap();
        
        // Add ETH allocation (50%)
        let eth = AssetAllocation::new("ETH".to_string(), 5000);
        vault.allocations.add_allocation(eth).unwrap();
        
        // Current values: BTC is 60%, ETH is 40%
        let current_values = vec![
            ("BTC".to_string(), 600),
            ("ETH".to_string(), 400),
        ];
        
        // Total value of 1000
        let total_value = 1000;
        
        // Generate rebalance suggestions
        let suggestions = vault.generate_rebalance_suggestions(&current_values, total_value);
        
        // Should have one suggestion to sell BTC and buy ETH
        assert_eq!(suggestions.len(), 1);
        assert_eq!(suggestions[0].source_asset, "BTC");
        assert_eq!(suggestions[0].target_asset, "ETH");
        assert_eq!(suggestions[0].amount, 100); // Need to move 10% from BTC to ETH
        
        // Nonce should have been incremented
        assert_eq!(vault.rebalance_nonce, 1);
    }
    
    #[test]
    fn test_update_allocations() {
        let mut vault = NonCustodialVault::new(
            "vault-1".to_string(),
            "owner-1".to_string(),
            "0xcontract".to_string(),
            300,
        );
        
        // Add BTC allocation (50%)
        let btc = AssetAllocation::new("BTC".to_string(), 5000);
        vault.allocations.add_allocation(btc).unwrap();
        
        // Add ETH allocation (50%)
        let eth = AssetAllocation::new("ETH".to_string(), 5000);
        vault.allocations.add_allocation(eth).unwrap();
        
        // Current values after rebalance: exactly 50/50
        let current_values = vec![
            ("BTC".to_string(), 500),
            ("ETH".to_string(), 500),
        ];
        
        // Update allocations
        vault.update_allocations_after_rebalance(&current_values, 1000);
        
        // Check that current percentages were updated
        assert_eq!(vault.allocations.allocations[0].current_percentage, 5000);
        assert_eq!(vault.allocations.allocations[1].current_percentage, 5000);
        
        // Last rebalance should be updated
        assert!(vault.last_rebalance > 0);
    }
}
