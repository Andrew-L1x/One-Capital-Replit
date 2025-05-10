//! Non-Custodial Vault contract for One Capital Auto-Investing
//! 
//! This module defines a non-custodial vault where the user retains control
//! of the assets while the L1X protocol provides guidance on rebalancing
//! and take-profit opportunities.

use serde::{Deserialize, Serialize};
use borsh::{BorshSerialize, BorshDeserialize};
use l1x_sdk::prelude::*;

use crate::allocation::{AllocationSet, AssetAllocation};
use crate::take_profit::{TakeProfitStrategy, TakeProfitType};
use crate::custodial_vault::VaultStatus;

/// Non-custodial vault for user-controlled portfolio management
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct NonCustodialVault {
    /// Unique identifier for the vault
    pub id: String,
    
    /// Owner of the vault
    pub owner: String,
    
    /// Current status of the vault
    pub status: VaultStatus,
    
    /// Asset allocations for the vault
    pub allocations: AllocationSet,
    
    /// Take profit strategy (if any)
    pub take_profit: Option<TakeProfitStrategy>,
    
    /// Estimated total value in USD (provided by user/oracle)
    pub estimated_value: u128,
    
    /// Timestamp when the vault was created
    pub created_at: u64,
    
    /// Timestamp of the last rebalance
    pub last_rebalance: u64,
    
    /// Last rebalance recommendations
    pub last_recommendations: Vec<RebalanceRecommendation>,
}

/// Recommended rebalance action for a non-custodial vault
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct RebalanceRecommendation {
    /// Asset ID
    pub asset_id: String,
    
    /// Current percentage (basis points)
    pub current_percentage: u32,
    
    /// Target percentage (basis points)
    pub target_percentage: u32,
    
    /// Recommended action
    pub action: RebalanceAction,
    
    /// Suggested amount to buy/sell in USD
    pub amount_usd: u128,
}

/// Type of rebalance action to take
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub enum RebalanceAction {
    /// Buy more of this asset
    Buy,
    
    /// Sell some of this asset
    Sell,
    
    /// No action needed
    NoAction,
}

/// Non-custodial vault contract storage
const STORAGE_CONTRACT_KEY: &[u8] = b"NON_CUSTODIAL_VAULT";

#[derive(BorshSerialize, BorshDeserialize)]
pub struct NonCustodialVaultContract {
    vaults: std::collections::HashMap<String, NonCustodialVault>, // Vault ID -> Vault
    user_vaults: std::collections::HashMap<String, Vec<String>>, // User ID -> Vault IDs
}

#[l1x_sdk::contract]
impl NonCustodialVaultContract {
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
            vaults: std::collections::HashMap::new(),
            user_vaults: std::collections::HashMap::new(),
        };

        state.save()
    }
    
    /// Creates a new non-custodial vault for a user
    pub fn create_vault(owner: String, vault_id: String, name: String, description: String, drift_threshold_bp: u32) -> String {
        let mut state = Self::load();
        
        if state.vaults.contains_key(&vault_id) {
            panic!("Vault with this ID already exists");
        }
        
        // Create a new vault
        let vault = NonCustodialVault {
            id: vault_id.clone(),
            owner: owner.clone(),
            status: VaultStatus::Active,
            allocations: AllocationSet::new(drift_threshold_bp),
            take_profit: None,
            estimated_value: 0,
            created_at: l1x_sdk::env::block_timestamp(),
            last_rebalance: 0,
            last_recommendations: Vec::new(),
        };
        
        // Add vault to contract state
        state.vaults.insert(vault_id.clone(), vault);
        
        // Add vault to user's vault list
        let user_vaults = state.user_vaults.entry(owner.clone()).or_insert_with(Vec::new);
        user_vaults.push(vault_id.clone());
        
        state.save();
        
        format!("Non-custodial vault {} created for user {}", vault_id, owner)
    }
    
    /// Gets a vault by ID
    pub fn get_vault(vault_id: String) -> String {
        let state = Self::load();
        
        let vault = state.vaults.get(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        serde_json::to_string(vault)
            .unwrap_or_else(|_| "Failed to serialize vault".to_string())
    }
    
    /// Gets all vaults for a user
    pub fn get_user_vaults(owner: String) -> String {
        let state = Self::load();
        
        let user_vault_ids = state.user_vaults.get(&owner)
            .cloned()
            .unwrap_or_default();
            
        let vaults: Vec<&NonCustodialVault> = user_vault_ids.iter()
            .filter_map(|id| state.vaults.get(id))
            .collect();
            
        serde_json::to_string(&vaults)
            .unwrap_or_else(|_| "Failed to serialize vaults".to_string())
    }
    
    /// Updates vault settings
    pub fn update_vault(vault_id: String, drift_threshold_bp: Option<u32>, status: Option<String>, estimated_value: Option<u128>) -> String {
        let mut state = Self::load();
        
        let vault = state.vaults.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        // Update drift threshold if provided
        if let Some(threshold) = drift_threshold_bp {
            vault.allocations.drift_threshold_bp = threshold;
        }
        
        // Update status if provided
        if let Some(status_str) = status {
            vault.status = match status_str.as_str() {
                "active" => VaultStatus::Active,
                "paused" => VaultStatus::Paused,
                "closed" => VaultStatus::Closed,
                _ => panic!("Invalid vault status: {}", status_str),
            };
        }
        
        // Update estimated value if provided
        if let Some(value) = estimated_value {
            vault.estimated_value = value;
        }
        
        state.save();
        
        format!("Vault {} updated", vault_id)
    }
    
    /// Sets up a take profit strategy for a vault
    pub fn set_take_profit(vault_id: String, strategy_type: String, target_percentage: Option<u32>, interval_seconds: Option<u64>) -> String {
        let mut state = Self::load();
        
        let vault = state.vaults.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        if vault.status != VaultStatus::Active {
            panic!("Cannot set take profit for a non-active vault");
        }
        
        // Create appropriate strategy based on type
        let take_profit_type = match strategy_type.as_str() {
            "manual" => TakeProfitType::Manual,
            
            "percentage" => {
                let percentage = target_percentage
                    .unwrap_or_else(|| panic!("Percentage required for percentage-based take profit"));
                    
                TakeProfitType::Percentage { percentage }
            },
            
            "time" => {
                let interval = interval_seconds
                    .unwrap_or_else(|| panic!("Interval required for time-based take profit"));
                    
                TakeProfitType::Time { interval_seconds: interval }
            },
            
            _ => panic!("Invalid take profit strategy type: {}", strategy_type),
        };
        
        let mut strategy = TakeProfitStrategy::new(take_profit_type);
        strategy.set_baseline(vault.estimated_value);
        vault.take_profit = Some(strategy);
        
        state.save();
        
        format!("Take profit strategy set for vault {}", vault_id)
    }
    
    /// Gets take profit strategy for a vault
    pub fn get_take_profit(vault_id: String) -> String {
        let state = Self::load();
        
        let vault = state.vaults.get(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        match &vault.take_profit {
            Some(strategy) => serde_json::to_string(strategy)
                .unwrap_or_else(|_| "Failed to serialize take profit strategy".to_string()),
                
            None => "No take profit strategy configured".to_string(),
        }
    }
    
    /// Adds an asset allocation
    pub fn add_allocation(vault_id: String, asset_id: String, target_percentage: u32, current_percentage: Option<u32>) -> String {
        let mut state = Self::load();
        
        let vault = state.vaults.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        let mut allocation = AssetAllocation::new(asset_id.clone(), target_percentage);
        
        // If current percentage provided, update it
        if let Some(current) = current_percentage {
            allocation.update_current_percentage(current);
        }
        
        vault.allocations.add_allocation(allocation)
            .unwrap_or_else(|err| panic!("Failed to add allocation: {}", err));
            
        state.save();
        
        format!("Allocation added for {} in vault {}", asset_id, vault_id)
    }
    
    /// Updates an asset allocation
    pub fn update_allocation(vault_id: String, asset_id: String, target_percentage: u32, current_percentage: Option<u32>) -> String {
        let mut state = Self::load();
        
        let vault = state.vaults.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        vault.allocations.update_allocation(&asset_id, target_percentage)
            .unwrap_or_else(|err| panic!("Failed to update allocation: {}", err));
            
        // If current percentage provided, update it
        if let Some(current) = current_percentage {
            let allocation = vault.allocations.allocations.iter_mut()
                .find(|a| a.asset_id == asset_id)
                .unwrap();
                
            allocation.update_current_percentage(current);
        }
        
        state.save();
        
        format!("Allocation updated for {} in vault {}", asset_id, vault_id)
    }
    
    /// Gets allocations for a vault
    pub fn get_allocations(vault_id: String) -> String {
        let state = Self::load();
        
        let vault = state.vaults.get(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        serde_json::to_string(&vault.allocations.allocations)
            .unwrap_or_else(|_| "Failed to serialize allocations".to_string())
    }
    
    /// Checks if rebalancing is needed
    pub fn needs_rebalancing(vault_id: String) -> bool {
        let state = Self::load();
        
        let vault = state.vaults.get(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        if vault.status != VaultStatus::Active {
            return false;
        }
        
        vault.allocations.needs_rebalancing()
    }
    
    /// Generates rebalancing recommendations
    pub fn generate_rebalance_recommendations(vault_id: String, prices_json: String) -> String {
        let mut state = Self::load();
        
        let vault = state.vaults.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        if vault.status != VaultStatus::Active {
            panic!("Cannot generate recommendations for a non-active vault");
        }
        
        // Parse prices from JSON
        let prices: Vec<(String, u128)> = serde_json::from_str(&prices_json)
            .unwrap_or_else(|_| panic!("Failed to parse prices"));
            
        let total_value = vault.estimated_value;
        
        if total_value == 0 {
            panic!("Vault has no estimated value");
        }
        
        // Generate recommendations
        let mut recommendations = Vec::new();
        
        for allocation in &vault.allocations.allocations {
            let current_value = total_value * (allocation.current_percentage as u128) / 10000;
            let target_value = total_value * (allocation.target_percentage as u128) / 10000;
            
            let action = if current_value < target_value {
                RebalanceAction::Buy
            } else if current_value > target_value {
                RebalanceAction::Sell
            } else {
                RebalanceAction::NoAction
            };
            
            let amount_usd = if current_value < target_value {
                target_value - current_value
            } else if current_value > target_value {
                current_value - target_value
            } else {
                0
            };
            
            recommendations.push(RebalanceRecommendation {
                asset_id: allocation.asset_id.clone(),
                current_percentage: allocation.current_percentage,
                target_percentage: allocation.target_percentage,
                action,
                amount_usd,
            });
        }
        
        // Store recommendations
        vault.last_recommendations = recommendations.clone();
        vault.last_rebalance = l1x_sdk::env::block_timestamp();
        
        // Update allocation current percentages to match target
        // (assumes user will follow recommendations)
        for allocation in &mut vault.allocations.allocations {
            allocation.update_current_percentage(allocation.target_percentage);
        }
        
        state.save();
        
        serde_json::to_string(&recommendations)
            .unwrap_or_else(|_| "Failed to serialize recommendations".to_string())
    }
    
    /// Gets previous rebalancing recommendations
    pub fn get_rebalance_recommendations(vault_id: String) -> String {
        let state = Self::load();
        
        let vault = state.vaults.get(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        serde_json::to_string(&vault.last_recommendations)
            .unwrap_or_else(|_| "Failed to serialize recommendations".to_string())
    }
    
    /// Checks if take profit should be executed
    pub fn should_take_profit(vault_id: String, current_value: u128) -> bool {
        let state = Self::load();
        
        let vault = state.vaults.get(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        if vault.status != VaultStatus::Active || vault.take_profit.is_none() {
            return false;
        }
        
        let strategy = vault.take_profit.as_ref().unwrap();
        
        match &strategy.strategy_type {
            TakeProfitType::Manual => false, // Manual requires explicit trigger
            
            TakeProfitType::Percentage { percentage } => {
                let baseline = strategy.baseline_value;
                if baseline == 0 || current_value <= baseline {
                    return false;
                }
                
                let gain = current_value - baseline;
                let gain_percentage = (gain * 10000) / baseline;
                
                gain_percentage >= (*percentage as u128)
            },
            
            TakeProfitType::Time { interval_seconds } => {
                let now = l1x_sdk::env::block_timestamp();
                let elapsed = now.saturating_sub(strategy.last_execution);
                
                elapsed >= *interval_seconds
            },
        }
    }
    
    /// Gets take profit recommendation
    pub fn get_take_profit_recommendation(vault_id: String, current_value: u128, target_asset: String) -> String {
        let mut state = Self::load();
        
        let vault = state.vaults.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        if vault.status != VaultStatus::Active || vault.take_profit.is_none() {
            return "No take profit strategy configured or vault not active".to_string();
        }
        
        let should_take_profit = Self::should_take_profit(vault_id.clone(), current_value);
        
        if !should_take_profit {
            return "Take profit conditions not met".to_string();
        }
        
        let strategy = vault.take_profit.as_mut().unwrap();
        
        // Calculate profit amount
        let baseline = strategy.baseline_value;
        let profit_amount = if current_value > baseline {
            current_value - baseline
        } else {
            0 // No profit
        };
        
        // Update strategy execution
        strategy.record_execution();
        strategy.set_baseline(current_value);
        
        state.save();
        
        format!("Take profit recommended: sell assets equivalent to {} USD and convert to {}", profit_amount, target_asset)
    }
}

impl NonCustodialVault {
    /// Creates a new non-custodial vault
    pub fn new(id: String, owner: String, drift_threshold_bp: u32) -> Self {
        Self {
            id,
            owner,
            status: VaultStatus::Active,
            allocations: AllocationSet::new(drift_threshold_bp),
            take_profit: None,
            estimated_value: 0,
            created_at: l1x_sdk::env::block_timestamp(),
            last_rebalance: 0,
            last_recommendations: Vec::new(),
        }
    }
    
    /// Updates the estimated value
    pub fn update_estimated_value(&mut self, value: u128) {
        self.estimated_value = value;
    }
    
    /// Checks if rebalancing is needed
    pub fn needs_rebalancing(&self) -> bool {
        if self.status != VaultStatus::Active {
            return false;
        }
        
        self.allocations.needs_rebalancing()
    }
    
    /// Generates rebalancing recommendations
    pub fn generate_rebalance_recommendations(&mut self) -> Vec<RebalanceRecommendation> {
        let mut recommendations = Vec::new();
        
        if self.status != VaultStatus::Active || self.estimated_value == 0 {
            return recommendations;
        }
        
        for allocation in &self.allocations.allocations {
            let current_value = self.estimated_value * (allocation.current_percentage as u128) / 10000;
            let target_value = self.estimated_value * (allocation.target_percentage as u128) / 10000;
            
            let action = if current_value < target_value {
                RebalanceAction::Buy
            } else if current_value > target_value {
                RebalanceAction::Sell
            } else {
                RebalanceAction::NoAction
            };
            
            let amount_usd = if current_value < target_value {
                target_value - current_value
            } else if current_value > target_value {
                current_value - target_value
            } else {
                0
            };
            
            recommendations.push(RebalanceRecommendation {
                asset_id: allocation.asset_id.clone(),
                current_percentage: allocation.current_percentage,
                target_percentage: allocation.target_percentage,
                action,
                amount_usd,
            });
        }
        
        self.last_recommendations = recommendations.clone();
        self.last_rebalance = l1x_sdk::env::block_timestamp();
        
        recommendations
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
            300, // 3% drift threshold
        );
        
        assert_eq!(vault.status, VaultStatus::Active);
        assert_eq!(vault.estimated_value, 0);
        assert_eq!(vault.owner, "owner-1");
        assert!(vault.last_recommendations.is_empty());
    }
    
    #[test]
    fn test_rebalance_recommendations() {
        let mut vault = NonCustodialVault::new(
            "vault-1".to_string(),
            "owner-1".to_string(),
            300,
        );
        
        // Add allocations
        let btc = AssetAllocation::new("BTC".to_string(), 6000);
        vault.allocations.add_allocation(btc).unwrap();
        
        let eth = AssetAllocation::new("ETH".to_string(), 4000);
        vault.allocations.add_allocation(eth).unwrap();
        
        // Set current percentages
        vault.allocations.allocations[0].update_current_percentage(7000); // 70% (exceeds target)
        vault.allocations.allocations[1].update_current_percentage(3000); // 30% (below target)
        
        // Set estimated value
        vault.update_estimated_value(10000);
        
        // Generate recommendations
        let recommendations = vault.generate_rebalance_recommendations();
        
        // Check that we have recommendations for both assets
        assert_eq!(recommendations.len(), 2);
        
        // Check BTC recommendation (should sell)
        let btc_rec = recommendations.iter().find(|r| r.asset_id == "BTC").unwrap();
        assert_eq!(btc_rec.action, RebalanceAction::Sell);
        assert_eq!(btc_rec.amount_usd, 1000); // 70% - 60% = 10% of 10000 = 1000
        
        // Check ETH recommendation (should buy)
        let eth_rec = recommendations.iter().find(|r| r.asset_id == "ETH").unwrap();
        assert_eq!(eth_rec.action, RebalanceAction::Buy);
        assert_eq!(eth_rec.amount_usd, 1000); // 40% - 30% = 10% of 10000 = 1000
    }
}