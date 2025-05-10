//! Rebalance functionality for One Capital Auto-Investing
//!
//! This module provides the rebalancing engine and strategies for rebalancing
//! portfolio allocations. The rebalancing system handles drift-based and
//! scheduled rebalancing, optimal transaction planning, and execution.

use serde::{Deserialize, Serialize};
use borsh::{BorshDeserialize, BorshSerialize};
use std::collections::HashMap;
use l1x_sdk::prelude::*;

/// Status of a rebalance operation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub enum RebalanceStatus {
    /// Operation is pending
    Pending,
    
    /// Operation is in progress
    InProgress,
    
    /// Operation was completed successfully
    Completed,
    
    /// Operation failed
    Failed,
}

/// Rebalance strategy
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub enum RebalanceStrategy {
    /// Threshold-based rebalancing (asset drift exceeded threshold)
    Threshold,
    
    /// Scheduled rebalancing (time-based)
    Scheduled,
    
    /// Manual rebalancing (user-initiated)
    Manual,
}

/// Rebalance transaction
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct RebalanceTransaction {
    /// Source asset ID
    pub source_asset: String,
    
    /// Target asset ID
    pub target_asset: String,
    
    /// Amount to swap (in source asset's smallest units)
    pub amount: u128,
    
    /// Transaction status
    pub status: RebalanceStatus,
    
    /// Transaction hash if executed
    pub tx_hash: Option<String>,
    
    /// Error message if failed
    pub error: Option<String>,
    
    /// Gas cost of the transaction
    pub gas_cost: Option<u128>,
}

/// Rebalance operation that manages a set of transactions
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct RebalanceOperation {
    /// Unique identifier
    pub id: String,
    
    /// Vault ID
    pub vault_id: Option<String>,
    
    /// Rebalance strategy
    pub strategy: RebalanceStrategy,
    
    /// Timestamp when operation was created
    pub created_at: u64,
    
    /// Transactions to execute
    pub transactions: Vec<RebalanceTransaction>,
    
    /// Overall status
    pub status: RebalanceStatus,
    
    /// Total cost of all transactions
    pub total_cost: Option<u128>,
}

impl RebalanceOperation {
    /// Creates a new rebalance operation
    pub fn new(id: String, strategy: RebalanceStrategy) -> Self {
        Self {
            id,
            vault_id: None,
            strategy,
            created_at: l1x_sdk::env::block_timestamp(),
            transactions: Vec::new(),
            status: RebalanceStatus::Pending,
            total_cost: None,
        }
    }
    
    /// Sets the vault ID
    pub fn with_vault_id(mut self, vault_id: String) -> Self {
        self.vault_id = Some(vault_id);
        self
    }
    
    /// Adds a transaction to the operation
    pub fn add_transaction(&mut self, source: String, target: String, amount: u128) {
        let transaction = RebalanceTransaction {
            source_asset: source,
            target_asset: target,
            amount,
            status: RebalanceStatus::Pending,
            tx_hash: None,
            error: None,
            gas_cost: None,
        };
        
        self.transactions.push(transaction);
    }
    
    /// Executes all transactions in the operation
    pub fn execute(&mut self) -> Result<(), String> {
        if self.transactions.is_empty() {
            return Ok(());
        }
        
        self.status = RebalanceStatus::InProgress;
        let mut total_cost: u128 = 0;
        
        for transaction in &mut self.transactions {
            match self.execute_transaction(transaction) {
                Ok(cost) => {
                    transaction.status = RebalanceStatus::Completed;
                    transaction.gas_cost = Some(cost);
                    total_cost = total_cost.saturating_add(cost);
                },
                Err(e) => {
                    transaction.status = RebalanceStatus::Failed;
                    transaction.error = Some(e.clone());
                    
                    // Roll back or continue based on strategy
                    if self.strategy == RebalanceStrategy::Manual {
                        self.status = RebalanceStatus::Failed;
                        return Err(format!("Transaction failed: {}", e));
                    }
                    
                    // For automated strategies, continue with other transactions
                    l1x_sdk::env::log(&format!("Rebalance transaction failed but continuing: {}", e));
                }
            }
        }
        
        // Set overall status based on transaction results
        let all_completed = self.transactions.iter().all(|t| t.status == RebalanceStatus::Completed);
        let any_completed = self.transactions.iter().any(|t| t.status == RebalanceStatus::Completed);
        
        if all_completed {
            self.status = RebalanceStatus::Completed;
        } else if any_completed {
            // Partial success
            self.status = RebalanceStatus::Completed;
            l1x_sdk::env::log("Rebalance operation partially completed");
        } else {
            self.status = RebalanceStatus::Failed;
        }
        
        self.total_cost = Some(total_cost);
        Ok(())
    }
    
    /// Executes a single transaction
    fn execute_transaction(&self, transaction: &RebalanceTransaction) -> Result<u128, String> {
        // In a real implementation, this would use a swap service or DEX
        // For now, we'll simulate success with a fixed gas cost
        
        l1x_sdk::env::log(&format!(
            "Executing swap: {} {} from {} to {}",
            transaction.amount, 
            transaction.source_asset, 
            transaction.target_asset,
            self.id
        ));
        
        // Simulate transaction execution
        let tx_hash = format!("tx-{}-{}", self.id, l1x_sdk::env::block_timestamp());
        
        // Fixed gas cost for simulation
        let gas_cost = 2_500_000;
        
        Ok(gas_cost)
    }
}

/// Rebalance engine for creating and executing rebalance operations
pub struct RebalanceEngine;

impl RebalanceEngine {
    /// Creates a new rebalance operation from transactions
    pub fn create_rebalance_operation(
        id: String,
        strategy: RebalanceStrategy,
        transactions: Vec<(String, String, u128)>,
    ) -> RebalanceOperation {
        let mut operation = RebalanceOperation::new(id, strategy);
        
        for (source, target, amount) in transactions {
            operation.add_transaction(source, target, amount);
        }
        
        operation
    }
    
    /// Simulates gas costs for a rebalance operation
    pub fn estimate_gas_costs(operation: &RebalanceOperation) -> u128 {
        const BASE_COST: u128 = 1_000_000;
        const PER_TX_COST: u128 = 2_500_000;
        
        let tx_count = operation.transactions.len() as u128;
        BASE_COST + (tx_count * PER_TX_COST)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_create_rebalance_operation() {
        let transactions = vec![
            ("BTC".to_string(), "ETH".to_string(), 100),
            ("BTC".to_string(), "SOL".to_string(), 50),
        ];
        
        let operation = RebalanceEngine::create_rebalance_operation(
            "test-op-1".to_string(),
            RebalanceStrategy::Manual,
            transactions,
        );
        
        assert_eq!(operation.id, "test-op-1");
        assert_eq!(operation.strategy, RebalanceStrategy::Manual);
        assert_eq!(operation.status, RebalanceStatus::Pending);
        assert_eq!(operation.transactions.len(), 2);
        
        let tx1 = &operation.transactions[0];
        assert_eq!(tx1.source_asset, "BTC");
        assert_eq!(tx1.target_asset, "ETH");
        assert_eq!(tx1.amount, 100);
        assert_eq!(tx1.status, RebalanceStatus::Pending);
    }
    
    #[test]
    fn test_execute_rebalance_operation() {
        let transactions = vec![
            ("BTC".to_string(), "ETH".to_string(), 100),
            ("BTC".to_string(), "SOL".to_string(), 50),
        ];
        
        let mut operation = RebalanceEngine::create_rebalance_operation(
            "test-op-2".to_string(),
            RebalanceStrategy::Threshold,
            transactions,
        );
        
        // Execute operation and check results
        let result = operation.execute();
        assert!(result.is_ok());
        
        assert_eq!(operation.status, RebalanceStatus::Completed);
        assert!(operation.total_cost.is_some());
        
        // All transactions should be completed
        for tx in &operation.transactions {
            assert_eq!(tx.status, RebalanceStatus::Completed);
            assert!(tx.gas_cost.is_some());
        }
    }
    
    #[test]
    fn test_estimate_gas_costs() {
        let transactions = vec![
            ("BTC".to_string(), "ETH".to_string(), 100),
            ("BTC".to_string(), "SOL".to_string(), 50),
            ("ETH".to_string(), "AVAX".to_string(), 200),
        ];
        
        let operation = RebalanceEngine::create_rebalance_operation(
            "test-op-3".to_string(),
            RebalanceStrategy::Threshold,
            transactions,
        );
        
        let estimated_cost = RebalanceEngine::estimate_gas_costs(&operation);
        
        // Base cost + (3 * per_tx_cost)
        assert_eq!(estimated_cost, 8_500_000);
    }
}