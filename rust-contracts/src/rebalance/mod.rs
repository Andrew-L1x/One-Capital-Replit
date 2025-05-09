//! Rebalancing functionality for One Capital Auto-Investing
//! 
//! This module provides the core logic for rebalancing portfolios
//! according to target allocations.

use serde::{Deserialize, Serialize};
use l1x_sdk::prelude::*;

use crate::allocation::AllocationSet;
use crate::xtalk::{XTalkClient, XTalkSwapRequest, XTalkSwapResult, XTalkError};

/// Rebalance strategy types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RebalanceStrategy {
    /// Rebalance only when drift exceeds threshold
    Threshold,
    
    /// Rebalance on a time schedule
    Scheduled,
    
    /// Rebalance when portfolio changes (deposits/withdrawals)
    OnChange,
}

/// Status of a rebalance operation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RebalanceStatus {
    /// Rebalance is pending execution
    Pending,
    
    /// Rebalance is currently in progress
    InProgress,
    
    /// Rebalance has completed successfully
    Completed,
    
    /// Rebalance failed
    Failed,
    
    /// Rebalance was cancelled
    Cancelled,
}

/// Represents a rebalance transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebalanceTransaction {
    /// Source asset to swap from
    pub source_asset: String,
    
    /// Target asset to swap to
    pub target_asset: String,
    
    /// Amount to swap
    pub amount: u128,
    
    /// Result of the swap (if completed)
    pub result: Option<XTalkSwapResult>,
    
    /// Status of this transaction
    pub status: RebalanceStatus,
    
    /// Error message (if failed)
    pub error: Option<String>,
}

/// Rebalance operation for a portfolio
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebalanceOperation {
    /// Unique identifier for this rebalance
    pub id: String,
    
    /// Strategy used for this rebalance
    pub strategy: RebalanceStrategy,
    
    /// Transactions needed for rebalancing
    pub transactions: Vec<RebalanceTransaction>,
    
    /// Overall status of the rebalance
    pub status: RebalanceStatus,
    
    /// Timestamp when rebalance started
    pub start_time: u64,
    
    /// Timestamp when rebalance completed or failed
    pub end_time: Option<u64>,
    
    /// Total cost of rebalancing (e.g., fees, slippage)
    pub total_cost: Option<u128>,
}

impl RebalanceOperation {
    /// Creates a new rebalance operation
    pub fn new(id: String, strategy: RebalanceStrategy) -> Self {
        Self {
            id,
            strategy,
            transactions: Vec::new(),
            status: RebalanceStatus::Pending,
            start_time: l1x_sdk::env::block_timestamp(),
            end_time: None,
            total_cost: None,
        }
    }
    
    /// Adds a transaction to the rebalance operation
    pub fn add_transaction(&mut self, source_asset: String, target_asset: String, amount: u128) {
        let transaction = RebalanceTransaction {
            source_asset,
            target_asset,
            amount,
            result: None,
            status: RebalanceStatus::Pending,
            error: None,
        };
        
        self.transactions.push(transaction);
    }
    
    /// Updates the status of the rebalance operation
    pub fn update_status(&mut self, status: RebalanceStatus) {
        self.status = status;
        
        if status == RebalanceStatus::Completed || status == RebalanceStatus::Failed || status == RebalanceStatus::Cancelled {
            self.end_time = Some(l1x_sdk::env::block_timestamp());
        }
    }
    
    /// Calculates the total cost of the rebalance
    pub fn calculate_total_cost(&mut self) {
        let mut total = 0u128;
        
        for transaction in &self.transactions {
            if let Some(result) = &transaction.result {
                total = total.saturating_add(result.fee);
            }
        }
        
        self.total_cost = Some(total);
    }
    
    /// Executes all pending transactions in the rebalance
    pub fn execute(&mut self) -> Result<(), XTalkError> {
        if self.status != RebalanceStatus::Pending {
            return Ok(());
        }
        
        self.update_status(RebalanceStatus::InProgress);
        let mut all_success = true;
        
        for transaction in &mut self.transactions {
            if transaction.status != RebalanceStatus::Pending {
                continue;
            }
            
            transaction.status = RebalanceStatus::InProgress;
            
            // Create swap request
            let swap_request = XTalkSwapRequest {
                source_asset: transaction.source_asset.clone(),
                target_asset: transaction.target_asset.clone(),
                amount: transaction.amount,
                slippage_bps: 50, // 0.5% slippage
            };
            
            // Execute the swap
            match XTalkClient::execute_swap(&swap_request) {
                Ok(result) => {
                    transaction.result = Some(result);
                    transaction.status = RebalanceStatus::Completed;
                },
                Err(error) => {
                    transaction.error = Some(format!("{:?}", error));
                    transaction.status = RebalanceStatus::Failed;
                    all_success = false;
                }
            }
        }
        
        // Update overall status
        if all_success {
            self.update_status(RebalanceStatus::Completed);
        } else {
            self.update_status(RebalanceStatus::Failed);
        }
        
        // Calculate total cost
        self.calculate_total_cost();
        
        Ok(())
    }
}

/// Core rebalancing engine
pub struct RebalanceEngine;

impl RebalanceEngine {
    /// Generates rebalance transactions for a set of allocations
    pub fn generate_rebalance_transactions(
        allocations: &AllocationSet,
        current_values: &[(String, u128)],
        total_value: u128,
    ) -> Vec<(String, String, u128)> {
        if total_value == 0 || allocations.allocations.is_empty() {
            return Vec::new();
        }
        
        // Calculate target values based on allocations
        let mut target_values = Vec::new();
        
        for allocation in &allocations.allocations {
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
    
    /// Creates a rebalance operation from transactions
    pub fn create_rebalance_operation(
        id: String,
        strategy: RebalanceStrategy,
        transactions: Vec<(String, String, u128)>,
    ) -> RebalanceOperation {
        let mut operation = RebalanceOperation::new(id, strategy);
        
        for (source_asset, target_asset, amount) in transactions {
            operation.add_transaction(source_asset, target_asset, amount);
        }
        
        operation
    }
    
    /// Determines if a portfolio needs rebalancing based on current and target allocations
    pub fn needs_rebalancing(
        allocations: &AllocationSet,
        current_values: &[(String, u128)],
        total_value: u128,
    ) -> bool {
        if total_value == 0 || allocations.allocations.is_empty() {
            return false;
        }
        
        // Calculate current percentages
        let mut current_percentages = std::collections::HashMap::new();
        
        for (asset_id, value) in current_values {
            let percentage = ((*value * 10000) / total_value) as u32;
            current_percentages.insert(asset_id.clone(), percentage);
        }
        
        // Check if any allocation exceeds the drift threshold
        for allocation in &allocations.allocations {
            let current_percentage = current_percentages.get(&allocation.asset_id).copied().unwrap_or(0);
            
            let drift = if current_percentage > allocation.target_percentage {
                current_percentage - allocation.target_percentage
            } else {
                allocation.target_percentage - current_percentage
            };
            
            if drift > allocations.drift_threshold_bp {
                return true;
            }
        }
        
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::allocation::AssetAllocation;
    
    #[test]
    fn test_generate_rebalance_transactions() {
        let mut allocations = AllocationSet::new(300); // 3% drift threshold
        
        // Add BTC allocation (50%)
        let btc = AssetAllocation::new("BTC".to_string(), 5000);
        allocations.add_allocation(btc).unwrap();
        
        // Add ETH allocation (50%)
        let eth = AssetAllocation::new("ETH".to_string(), 5000);
        allocations.add_allocation(eth).unwrap();
        
        // Current values: BTC is 60%, ETH is 40%
        let current_values = vec![
            ("BTC".to_string(), 600),
            ("ETH".to_string(), 400),
        ];
        
        // Generate transactions
        let transactions = RebalanceEngine::generate_rebalance_transactions(
            &allocations,
            &current_values,
            1000, // Total value
        );
        
        // Should have one transaction: sell BTC, buy ETH
        assert_eq!(transactions.len(), 1);
        assert_eq!(transactions[0].0, "BTC"); // Sell BTC
        assert_eq!(transactions[0].1, "ETH"); // Buy ETH
        assert_eq!(transactions[0].2, 100);   // Amount to swap ($100)
    }
    
    #[test]
    fn test_create_rebalance_operation() {
        let transactions = vec![
            ("BTC".to_string(), "ETH".to_string(), 100),
            ("BTC".to_string(), "SOL".to_string(), 50),
        ];
        
        let operation = RebalanceEngine::create_rebalance_operation(
            "rebalance-1".to_string(),
            RebalanceStrategy::Threshold,
            transactions,
        );
        
        assert_eq!(operation.id, "rebalance-1");
        assert_eq!(operation.strategy, RebalanceStrategy::Threshold);
        assert_eq!(operation.transactions.len(), 2);
        assert_eq!(operation.status, RebalanceStatus::Pending);
    }
    
    #[test]
    fn test_needs_rebalancing() {
        let mut allocations = AllocationSet::new(300); // 3% drift threshold
        
        // Add BTC allocation (50%)
        let btc = AssetAllocation::new("BTC".to_string(), 5000);
        allocations.add_allocation(btc).unwrap();
        
        // Add ETH allocation (50%)
        let eth = AssetAllocation::new("ETH".to_string(), 5000);
        allocations.add_allocation(eth).unwrap();
        
        // Case 1: Perfect balance (50/50)
        let balanced_values = vec![
            ("BTC".to_string(), 500),
            ("ETH".to_string(), 500),
        ];
        
        assert!(!RebalanceEngine::needs_rebalancing(&allocations, &balanced_values, 1000));
        
        // Case 2: Minor imbalance (52/48) - below threshold
        let minor_imbalance = vec![
            ("BTC".to_string(), 520),
            ("ETH".to_string(), 480),
        ];
        
        assert!(!RebalanceEngine::needs_rebalancing(&allocations, &minor_imbalance, 1000));
        
        // Case 3: Significant imbalance (60/40) - above threshold
        let major_imbalance = vec![
            ("BTC".to_string(), 600),
            ("ETH".to_string(), 400),
        ];
        
        assert!(RebalanceEngine::needs_rebalancing(&allocations, &major_imbalance, 1000));
    }
}
