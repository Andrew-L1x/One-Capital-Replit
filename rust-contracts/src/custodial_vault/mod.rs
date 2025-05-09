//! Custodial vault implementation for One Capital Auto-Investing
//! 
//! Custodial vaults are managed by the platform and allow for automated
//! rebalancing and take-profit strategies.

use serde::{Deserialize, Serialize};
use l1x_sdk::prelude::*;

use crate::allocation::{AllocationSet, AssetAllocation};
use crate::take_profit::{TakeProfitStrategy, TakeProfitType};
use crate::xtalk::XTalkSwapRequest;

/// Status of a custodial vault
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum VaultStatus {
    /// Vault is active and operational
    Active,
    
    /// Vault is paused and no operations can be performed
    Paused,
    
    /// Vault is in the process of being liquidated
    Liquidating,
    
    /// Vault has been closed
    Closed,
}

/// A custodial vault holding user assets with automated management
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustodialVault {
    /// Unique identifier for the vault
    pub id: String,
    
    /// Owner of the vault
    pub owner: String,
    
    /// Current status of the vault
    pub status: VaultStatus,
    
    /// Asset allocations for the vault
    pub allocations: AllocationSet,
    
    /// Take profit strategy for the vault
    pub take_profit: Option<TakeProfitStrategy>,
    
    /// Total value of assets in the vault (in smallest units)
    pub total_value: u128,
    
    /// Creation timestamp
    pub created_at: u64,
    
    /// Last rebalance timestamp
    pub last_rebalance: u64,
}

impl CustodialVault {
    /// Creates a new custodial vault
    pub fn new(id: String, owner: String, drift_threshold_bp: u32) -> Self {
        Self {
            id,
            owner,
            status: VaultStatus::Active,
            allocations: AllocationSet::new(drift_threshold_bp),
            take_profit: None,
            total_value: 0,
            created_at: l1x_sdk::env::block_timestamp(),
            last_rebalance: 0,
        }
    }
    
    /// Checks if the vault needs rebalancing
    pub fn needs_rebalancing(&self) -> bool {
        if self.status != VaultStatus::Active {
            return false;
        }
        
        self.allocations.needs_rebalancing()
    }
    
    /// Sets up a take profit strategy for the vault
    pub fn set_take_profit_strategy(&mut self, strategy_type: TakeProfitType) -> Result<(), &'static str> {
        if self.status != VaultStatus::Active {
            return Err("Vault is not active");
        }
        
        self.take_profit = Some(TakeProfitStrategy::new(strategy_type));
        Ok(())
    }
    
    /// Deposits funds into the vault
    pub fn deposit(&mut self, amount: u128) -> Result<(), &'static str> {
        if self.status != VaultStatus::Active {
            return Err("Vault is not active");
        }
        
        self.total_value = self.total_value.checked_add(amount)
            .ok_or("Overflow in deposit calculation")?;
            
        Ok(())
    }
    
    /// Withdraws funds from the vault
    pub fn withdraw(&mut self, amount: u128) -> Result<(), &'static str> {
        if self.status != VaultStatus::Active {
            return Err("Vault is not active");
        }
        
        if amount > self.total_value {
            return Err("Insufficient funds");
        }
        
        self.total_value = self.total_value.checked_sub(amount)
            .ok_or("Underflow in withdrawal calculation")?;
            
        Ok(())
    }
    
    /// Rebalances the portfolio according to target allocations
    pub fn rebalance(&mut self, prices: &[(String, u128)]) -> Result<Vec<XTalkSwapRequest>, &'static str> {
        if self.status != VaultStatus::Active {
            return Err("Vault is not active");
        }
        
        if self.total_value == 0 {
            return Err("Vault has no assets to rebalance");
        }
        
        // Convert prices to a map for easier lookup
        let price_map: std::collections::HashMap<&str, u128> = prices
            .iter()
            .map(|(asset_id, price)| (asset_id.as_str(), *price))
            .collect();
            
        // Calculate current values for each asset
        let mut current_values: Vec<(String, u128)> = Vec::with_capacity(self.allocations.allocations.len());
        
        for allocation in &self.allocations.allocations {
            let price = *price_map.get(allocation.asset_id.as_str())
                .ok_or("Price not found for asset")?;
                
            // Calculate current value (simplified - in real impl, would get actual balances)
            let current_value = self.total_value * (allocation.current_percentage as u128) / 10000;
            current_values.push((allocation.asset_id.clone(), current_value));
        }
        
        // Calculate target values
        let mut target_values: Vec<(String, u128)> = Vec::with_capacity(self.allocations.allocations.len());
        
        for allocation in &self.allocations.allocations {
            let target_value = self.total_value * (allocation.target_percentage as u128) / 10000;
            target_values.push((allocation.asset_id.clone(), target_value));
        }
        
        // Generate swap requests
        let mut swap_requests = Vec::new();
        
        // Find assets to sell (current > target)
        let mut sellers: Vec<(String, u128)> = Vec::new();
        let mut buyers: Vec<(String, u128)> = Vec::new();
        
        for i in 0..current_values.len() {
            let (asset_id, current_value) = &current_values[i];
            let (_, target_value) = &target_values[i];
            
            if current_value > target_value {
                // Need to sell this asset
                sellers.push((asset_id.clone(), current_value - target_value));
            } else if current_value < target_value {
                // Need to buy this asset
                buyers.push((asset_id.clone(), target_value - current_value));
            }
        }
        
        // Match sellers with buyers to create swap requests
        let mut i = 0;
        let mut j = 0;
        
        while i < sellers.len() && j < buyers.len() {
            let (sell_asset, mut sell_amount) = sellers[i].clone();
            let (buy_asset, mut buy_amount) = buyers[j].clone();
            
            let amount_to_swap = sell_amount.min(buy_amount);
            
            if amount_to_swap > 0 {
                // Create a swap request
                let swap_request = XTalkSwapRequest {
                    source_asset: sell_asset.clone(),
                    target_asset: buy_asset.clone(),
                    amount: amount_to_swap,
                    slippage_bps: 50, // 0.5% slippage
                };
                
                swap_requests.push(swap_request);
                
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
        
        // Update last rebalance timestamp
        self.last_rebalance = l1x_sdk::env::block_timestamp();
        
        // Update current percentages for each allocation
        // In a real implementation, these would be updated after swaps complete
        for allocation in &mut self.allocations.allocations {
            let target_percentage = allocation.target_percentage;
            allocation.update_current_percentage(target_percentage);
            
            let price = *price_map.get(allocation.asset_id.as_str())
                .unwrap_or(&0);
                
            allocation.record_rebalance(Some(price));
        }
        
        Ok(swap_requests)
    }
    
    /// Checks if take profit conditions are met
    pub fn should_take_profit(&self, current_prices: &[(String, u128)]) -> bool {
        if self.status != VaultStatus::Active || self.take_profit.is_none() {
            return false;
        }
        
        match &self.take_profit {
            Some(strategy) => strategy.should_execute(current_prices),
            None => false,
        }
    }
    
    /// Changes the vault status
    pub fn change_status(&mut self, new_status: VaultStatus) {
        self.status = new_status;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::take_profit::TakeProfitType;
    
    #[test]
    fn test_custodial_vault_creation() {
        let vault = CustodialVault::new(
            "vault-1".to_string(),
            "owner-1".to_string(),
            300, // 3% drift threshold
        );
        
        assert_eq!(vault.status, VaultStatus::Active);
        assert_eq!(vault.total_value, 0);
        assert_eq!(vault.owner, "owner-1");
    }
    
    #[test]
    fn test_vault_deposits_and_withdrawals() {
        let mut vault = CustodialVault::new(
            "vault-1".to_string(),
            "owner-1".to_string(),
            300,
        );
        
        // Initial deposit
        vault.deposit(1000).unwrap();
        assert_eq!(vault.total_value, 1000);
        
        // Another deposit
        vault.deposit(500).unwrap();
        assert_eq!(vault.total_value, 1500);
        
        // Partial withdrawal
        vault.withdraw(300).unwrap();
        assert_eq!(vault.total_value, 1200);
        
        // Excessive withdrawal should fail
        assert!(vault.withdraw(1500).is_err());
        assert_eq!(vault.total_value, 1200); // Value unchanged
        
        // Change vault status to paused
        vault.change_status(VaultStatus::Paused);
        
        // Deposit should fail
        assert!(vault.deposit(100).is_err());
        assert_eq!(vault.total_value, 1200); // Value unchanged
    }
    
    #[test]
    fn test_take_profit_strategy() {
        let mut vault = CustodialVault::new(
            "vault-1".to_string(),
            "owner-1".to_string(),
            300,
        );
        
        // Set take profit strategy
        vault.set_take_profit_strategy(TakeProfitType::Percentage { 
            percentage: 1000, // 10%
        }).unwrap();
        
        assert!(vault.take_profit.is_some());
        
        // Paused vault cannot change strategy
        vault.change_status(VaultStatus::Paused);
        assert!(vault.set_take_profit_strategy(TakeProfitType::Manual).is_err());
    }
}
