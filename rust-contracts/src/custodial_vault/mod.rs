//! Custodial Vault contract for One Capital Auto-Investing
//! 
//! This module handles custodial vaults where the funds are managed by the
//! L1X protocol using smart contracts. The vault maintains allocations to
//! assets and handles rebalancing and take-profit operations.

use serde::{Deserialize, Serialize};
use borsh::{BorshSerialize, BorshDeserialize};
use l1x_sdk::prelude::*;

use crate::allocation::{AllocationSet, AssetAllocation};
use crate::take_profit::{TakeProfitStrategy, TakeProfitType};

/// Status of a vault
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub enum VaultStatus {
    /// Vault is active and operational
    Active,
    
    /// Vault is paused (no deposits/withdrawals/rebalances)
    Paused,
    
    /// Vault is closed (no operations possible)
    Closed,
}

/// X-Talk swap request for cross-chain operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XTalkSwapRequest {
    /// Source asset to swap from
    pub source_asset: String,
    
    /// Target asset to swap to
    pub target_asset: String,
    
    /// Amount to swap (in the smallest unit of the source asset)
    pub amount: u128,
    
    /// Maximum allowable slippage in basis points (e.g., 50 = 0.5%)
    pub slippage_bps: u32,
}

/// Custodial vault contract
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct CustodialVault {
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
    
    /// Total value of the vault in USD (scaled)
    pub total_value: u128,
    
    /// Timestamp when the vault was created
    pub created_at: u64,
    
    /// Timestamp of the last rebalance
    pub last_rebalance: u64,
}

/// Custodial Vault contract
const STORAGE_CONTRACT_KEY: &[u8] = b"CUSTODIAL_VAULT";

#[derive(BorshSerialize, BorshDeserialize)]
pub struct CustodialVaultContract {
    vaults: std::collections::HashMap<String, CustodialVault>, // Vault ID -> Vault
    user_vaults: std::collections::HashMap<String, Vec<String>>, // User ID -> Vault IDs
}

#[l1x_sdk::contract]
impl CustodialVaultContract {
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
    
    /// Creates a new vault for a user
    pub fn create_vault(owner: String, vault_id: String, name: String, description: String, drift_threshold_bp: u32) -> String {
        let mut state = Self::load();
        
        if state.vaults.contains_key(&vault_id) {
            panic!("Vault with this ID already exists");
        }
        
        // Create a new vault
        let vault = CustodialVault {
            id: vault_id.clone(),
            owner: owner.clone(),
            status: VaultStatus::Active,
            allocations: AllocationSet::new(drift_threshold_bp),
            take_profit: None,
            total_value: 0,
            created_at: l1x_sdk::env::block_timestamp(),
            last_rebalance: 0,
        };
        
        // Add vault to contract state
        state.vaults.insert(vault_id.clone(), vault);
        
        // Add vault to user's vault list
        let user_vaults = state.user_vaults.entry(owner.clone()).or_insert_with(Vec::new);
        user_vaults.push(vault_id.clone());
        
        state.save();
        
        format!("Vault {} created for user {}", vault_id, owner)
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
            
        let vaults: Vec<&CustodialVault> = user_vault_ids.iter()
            .filter_map(|id| state.vaults.get(id))
            .collect();
            
        serde_json::to_string(&vaults)
            .unwrap_or_else(|_| "Failed to serialize vaults".to_string())
    }
    
    /// Updates vault settings
    pub fn update_vault(vault_id: String, drift_threshold_bp: Option<u32>, status: Option<String>) -> String {
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
        
        state.save();
        
        format!("Vault {} updated", vault_id)
    }
    
    /// Deposits funds into a vault
    pub fn deposit(vault_id: String, amount: u128) -> String {
        let mut state = Self::load();
        
        let vault = state.vaults.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        if vault.status != VaultStatus::Active {
            panic!("Cannot deposit into a non-active vault");
        }
        
        vault.total_value = vault.total_value.checked_add(amount)
            .unwrap_or_else(|| panic!("Overflow when adding deposit"));
            
        state.save();
        
        format!("Deposited {} into vault {}", amount, vault_id)
    }
    
    /// Withdraws funds from a vault
    pub fn withdraw(vault_id: String, amount: u128) -> String {
        let mut state = Self::load();
        
        let vault = state.vaults.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        if vault.status != VaultStatus::Active {
            panic!("Cannot withdraw from a non-active vault");
        }
        
        if vault.total_value < amount {
            panic!("Insufficient funds in vault");
        }
        
        vault.total_value = vault.total_value.checked_sub(amount)
            .unwrap_or_else(|| panic!("Underflow when subtracting withdrawal"));
            
        state.save();
        
        format!("Withdrew {} from vault {}", amount, vault_id)
    }
    
    /// Sets up take profit strategy for a vault
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
        strategy.set_baseline(vault.total_value);
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
    
    /// Checks if a vault needs rebalancing
    pub fn needs_rebalancing(vault_id: String) -> bool {
        let state = Self::load();
        
        let vault = state.vaults.get(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        if vault.status != VaultStatus::Active {
            return false;
        }
        
        vault.allocations.needs_rebalancing()
    }
    
    /// Executes rebalancing for a vault
    pub fn rebalance(vault_id: String, prices_json: String) -> String {
        let mut state = Self::load();
        
        let vault = state.vaults.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        if vault.status != VaultStatus::Active {
            let error_msg = format!("Cannot rebalance a non-active vault: status is {:?}", vault.status);
            crate::events::emit_rebalance_failed_event(&vault_id, &error_msg);
            panic!("{}", error_msg);
        }
        
        // Parse prices and current values from JSON
        let prices: Vec<(String, u128)> = match serde_json::from_str(&prices_json) {
            Ok(p) => p,
            Err(e) => {
                let error_msg = format!("Failed to parse prices: {}", e);
                crate::events::emit_rebalance_failed_event(&vault_id, &error_msg);
                panic!("{}", error_msg);
            }
        };
        
        // Emit rebalance initiated event
        crate::events::emit_rebalance_initiated_event(&vault_id, "manual");
        
        // First, check if we actually need to rebalance
        if !vault.allocations.check_and_emit_rebalance_events(&vault_id) {
            // No rebalancing needed, but still record the check
            vault.last_rebalance = l1x_sdk::env::block_timestamp();
            state.save();
            return format!("No rebalancing needed for vault {}", vault_id);
        }
        
        // Calculate the rebalance transactions
        let current_values = prices.clone(); // We're using prices as current values for simplicity
        let transactions = vault.allocations.calculate_rebalance_transactions(
            &current_values, 
            vault.total_value
        );
        
        if transactions.is_empty() {
            vault.allocations.record_rebalance(&prices);
            vault.last_rebalance = l1x_sdk::env::block_timestamp();
            state.save();
            
            // Emit completed event with no transactions
            crate::events::emit_rebalance_completed_event(&vault_id, 0, None);
            
            return format!("No rebalance transactions needed for vault {}", vault_id);
        }
        
        // Create a rebalance operation
        let rebalance_id = format!("rebalance-{}-{}", vault_id, l1x_sdk::env::block_timestamp());
        let strategy = crate::rebalance::RebalanceStrategy::Threshold;
        
        let mut operation = crate::rebalance::RebalanceEngine::create_rebalance_operation(
            rebalance_id, 
            strategy, 
            transactions.clone()
        );
        
        // Execute the rebalance
        match operation.execute() {
            Ok(_) => {
                // Record the rebalance
                vault.allocations.record_rebalance(&prices);
                vault.last_rebalance = l1x_sdk::env::block_timestamp();
                
                // Calculate total cost
                let total_cost = operation.total_cost;
                
                // Emit completed event
                crate::events::emit_rebalance_completed_event(
                    &vault_id, 
                    transactions.len(),
                    total_cost
                );
                
                state.save();
                format!("Rebalanced vault {} with {} transactions", vault_id, transactions.len())
            },
            Err(e) => {
                let error_msg = format!("Rebalance failed: {:?}", e);
                crate::events::emit_rebalance_failed_event(&vault_id, &error_msg);
                panic!("{}", error_msg);
            }
        }
    }
    
    /// Auto-rebalance a vault based on its settings
    pub fn auto_rebalance(vault_id: String, prices_json: String) -> String {
        let mut state = Self::load();
        
        let vault = state.vaults.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        if vault.status != VaultStatus::Active {
            return format!("Cannot auto-rebalance inactive vault {}", vault_id);
        }
        
        // Parse prices from JSON
        let prices: Vec<(String, u128)> = match serde_json::from_str(&prices_json) {
            Ok(p) => p,
            Err(e) => {
                return format!("Failed to parse prices: {}", e);
            }
        };
        
        // Check if rebalancing is needed and emit events
        if !vault.allocations.check_and_emit_rebalance_events(&vault_id) {
            return format!("No rebalancing needed for vault {}", vault_id);
        }
        
        // Determine trigger type
        let trigger = if vault.allocations.rebalance_frequency_seconds > 0 {
            let current_time = l1x_sdk::env::block_timestamp();
            let elapsed = current_time.saturating_sub(vault.last_rebalance);
            
            if elapsed >= vault.allocations.rebalance_frequency_seconds {
                "scheduled"
            } else {
                "drift"
            }
        } else {
            "drift"
        };
        
        // Emit rebalance initiated event
        crate::events::emit_rebalance_initiated_event(&vault_id, trigger);
        
        // Calculate the rebalance transactions
        let current_values = prices.clone(); // We're using prices as current values for simplicity
        let transactions = vault.allocations.calculate_rebalance_transactions(
            &current_values, 
            vault.total_value
        );
        
        if transactions.is_empty() {
            vault.allocations.record_rebalance(&prices);
            vault.last_rebalance = l1x_sdk::env::block_timestamp();
            state.save();
            
            // Emit completed event with no transactions
            crate::events::emit_rebalance_completed_event(&vault_id, 0, None);
            
            return format!("No rebalance transactions needed for vault {}", vault_id);
        }
        
        // Create a rebalance operation
        let rebalance_id = format!("rebalance-{}-{}", vault_id, l1x_sdk::env::block_timestamp());
        let strategy = match trigger {
            "scheduled" => crate::rebalance::RebalanceStrategy::Scheduled,
            _ => crate::rebalance::RebalanceStrategy::Threshold,
        };
        
        let mut operation = crate::rebalance::RebalanceEngine::create_rebalance_operation(
            rebalance_id, 
            strategy, 
            transactions.clone()
        );
        
        // Execute the rebalance
        match operation.execute() {
            Ok(_) => {
                // Record the rebalance
                vault.allocations.record_rebalance(&prices);
                vault.last_rebalance = l1x_sdk::env::block_timestamp();
                
                // Calculate total cost
                let total_cost = operation.total_cost;
                
                // Emit completed event
                crate::events::emit_rebalance_completed_event(
                    &vault_id, 
                    transactions.len(),
                    total_cost
                );
                
                state.save();
                format!("Auto-rebalanced vault {} with {} transactions", vault_id, transactions.len())
            },
            Err(e) => {
                let error_msg = format!("Auto-rebalance failed: {:?}", e);
                crate::events::emit_rebalance_failed_event(&vault_id, &error_msg);
                format!("{}", error_msg)
            }
        }
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
    
    /// Executes take profit for a vault
    pub fn execute_take_profit(vault_id: String, current_value: u128, target_asset: String) -> String {
        let mut state = Self::load();
        
        let vault = state.vaults.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        if vault.status != VaultStatus::Active {
            panic!("Cannot execute take profit for a non-active vault");
        }
        
        if vault.take_profit.is_none() {
            panic!("No take profit strategy configured for vault");
        }
        
        let strategy = vault.take_profit.as_mut().unwrap();
        
        // Update strategy execution
        let baseline = strategy.baseline_value;
        strategy.record_execution();
        
        // Calculate profit amount
        let profit_amount = if current_value > baseline {
            current_value - baseline
        } else {
            0 // No profit
        };
        
        // Set new baseline
        strategy.set_baseline(current_value);
        
        state.save();
        
        format!("Take profit executed for vault {}, profit: {}, new baseline: {}", vault_id, profit_amount, current_value)
    }
    
    /// Manually triggers take profit for a vault
    pub fn manual_take_profit(vault_id: String, current_value: u128, target_asset: String) -> String {
        let mut state = Self::load();
        
        let vault = state.vaults.get_mut(&vault_id)
            .unwrap_or_else(|| panic!("Vault not found: {}", vault_id));
            
        if vault.status != VaultStatus::Active {
            panic!("Cannot execute take profit for a non-active vault");
        }
        
        if vault.take_profit.is_none() {
            panic!("No take profit strategy configured for vault");
        }
        
        let strategy = vault.take_profit.as_mut().unwrap();
        
        // Update strategy execution
        let baseline = strategy.baseline_value;
        strategy.record_execution();
        
        // Calculate profit amount
        let profit_amount = if current_value > baseline {
            current_value - baseline
        } else {
            0 // No profit
        };
        
        // Set new baseline
        strategy.set_baseline(current_value);
        
        state.save();
        
        format!("Manual take profit executed for vault {}, profit: {}, new baseline: {}", vault_id, profit_amount, current_value)
    }
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