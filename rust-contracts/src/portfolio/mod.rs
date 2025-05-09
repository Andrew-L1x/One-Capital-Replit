//! Portfolio management functionality for One Capital Auto-Investing
//! 
//! This module provides higher-level portfolio management functions that
//! integrate allocation, rebalancing, and take-profit strategies.

use serde::{Deserialize, Serialize};
use l1x_sdk::prelude::*;

use crate::allocation::{AllocationSet, AssetAllocation};
use crate::custodial_vault::CustodialVault;
use crate::non_custodial_vault::NonCustodialVault;
use crate::take_profit::{TakeProfitStrategy, TakeProfitType};

/// Represents a portfolio performance snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortfolioSnapshot {
    /// Timestamp when the snapshot was taken
    pub timestamp: u64,
    
    /// Total portfolio value
    pub total_value: u128,
    
    /// Asset values at the time of the snapshot
    pub asset_values: Vec<(String, u128)>,
    
    /// Asset allocations at the time of the snapshot
    pub asset_allocations: Vec<(String, u32)>,
}

/// Portfolio management functions
pub struct Portfolio;

impl Portfolio {
    /// Creates a new portfolio snapshot
    pub fn create_snapshot(
        asset_values: Vec<(String, u128)>,
        allocations: &AllocationSet,
    ) -> PortfolioSnapshot {
        let total_value: u128 = asset_values.iter().map(|(_, value)| *value).sum();
        
        let asset_allocations = allocations.allocations.iter()
            .map(|a| (a.asset_id.clone(), a.current_percentage))
            .collect();
            
        PortfolioSnapshot {
            timestamp: l1x_sdk::env::block_timestamp(),
            total_value,
            asset_values: asset_values.clone(),
            asset_allocations,
        }
    }
    
    /// Calculates portfolio gain/loss since a previous snapshot
    pub fn calculate_gain_since(
        current: &PortfolioSnapshot,
        previous: &PortfolioSnapshot,
    ) -> i128 {
        if previous.total_value == 0 {
            return 0;
        }
        
        let current_value = current.total_value as i128;
        let previous_value = previous.total_value as i128;
        
        current_value - previous_value
    }
    
    /// Calculates portfolio gain/loss percentage since a previous snapshot
    pub fn calculate_gain_percentage_since(
        current: &PortfolioSnapshot,
        previous: &PortfolioSnapshot,
    ) -> i32 {
        if previous.total_value == 0 {
            return 0;
        }
        
        let gain = Self::calculate_gain_since(current, previous);
        
        // Calculate percentage gain in basis points (1% = 100 basis points)
        ((gain as f64) / (previous.total_value as f64) * 10000.0) as i32
    }
    
    /// Checks if portfolio needs rebalancing based on allocation drift
    pub fn needs_rebalancing(
        current_values: &[(String, u128)],
        allocations: &AllocationSet,
        total_value: u128,
    ) -> bool {
        if total_value == 0 {
            return false;
        }
        
        // Calculate current percentages
        let mut current_percentages = std::collections::HashMap::new();
        
        for (asset_id, value) in current_values {
            let percentage = ((value * 10000) / total_value) as u32;
            current_percentages.insert(asset_id.clone(), percentage);
        }
        
        // Check if any allocation has drifted beyond the threshold
        for allocation in &allocations.allocations {
            let current = current_percentages.get(&allocation.asset_id).unwrap_or(&0);
            
            let drift = if *current > allocation.target_percentage {
                current - allocation.target_percentage
            } else {
                allocation.target_percentage - current
            };
            
            if drift > allocations.drift_threshold_bp {
                return true;
            }
        }
        
        false
    }
    
    /// Checks if take profit conditions are met
    pub fn should_take_profit(
        strategy: &TakeProfitStrategy,
        current_snapshot: &PortfolioSnapshot,
        baseline_snapshot: &PortfolioSnapshot,
    ) -> bool {
        match strategy.strategy_type {
            TakeProfitType::Manual => false, // Manual requires explicit trigger
            
            TakeProfitType::Percentage { percentage } => {
                let gain_bps = Self::calculate_gain_percentage_since(current_snapshot, baseline_snapshot);
                gain_bps >= percentage as i32
            },
            
            TakeProfitType::Time { interval_seconds } => {
                let elapsed = current_snapshot.timestamp.saturating_sub(strategy.last_execution);
                elapsed >= interval_seconds
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_portfolio_snapshot() {
        let mut allocations = AllocationSet::new(300);
        
        // Add BTC allocation (60%)
        let btc = AssetAllocation::new("BTC".to_string(), 6000);
        allocations.add_allocation(btc).unwrap();
        
        // Add ETH allocation (40%)
        let eth = AssetAllocation::new("ETH".to_string(), 4000);
        allocations.add_allocation(eth).unwrap();
        
        // Set current percentages
        allocations.allocations[0].update_current_percentage(6000);
        allocations.allocations[1].update_current_percentage(4000);
        
        // Asset values
        let asset_values = vec![
            ("BTC".to_string(), 600),
            ("ETH".to_string(), 400),
        ];
        
        // Create snapshot
        let snapshot = Portfolio::create_snapshot(asset_values, &allocations);
        
        assert_eq!(snapshot.total_value, 1000);
        assert_eq!(snapshot.asset_values.len(), 2);
        assert_eq!(snapshot.asset_allocations.len(), 2);
        
        // Check asset allocations in snapshot
        let btc_allocation = snapshot.asset_allocations.iter()
            .find(|(asset_id, _)| asset_id == "BTC")
            .unwrap();
            
        assert_eq!(btc_allocation.1, 6000); // 60%
    }
    
    #[test]
    fn test_portfolio_gain_calculation() {
        // Previous snapshot
        let previous = PortfolioSnapshot {
            timestamp: 1000,
            total_value: 1000,
            asset_values: vec![
                ("BTC".to_string(), 600),
                ("ETH".to_string(), 400),
            ],
            asset_allocations: vec![
                ("BTC".to_string(), 6000),
                ("ETH".to_string(), 4000),
            ],
        };
        
        // Current snapshot with 20% gain
        let current = PortfolioSnapshot {
            timestamp: 2000,
            total_value: 1200,
            asset_values: vec![
                ("BTC".to_string(), 720),
                ("ETH".to_string(), 480),
            ],
            asset_allocations: vec![
                ("BTC".to_string(), 6000),
                ("ETH".to_string(), 4000),
            ],
        };
        
        let gain = Portfolio::calculate_gain_since(&current, &previous);
        assert_eq!(gain, 200);
        
        let gain_percentage = Portfolio::calculate_gain_percentage_since(&current, &previous);
        assert_eq!(gain_percentage, 2000); // 20% = 2000 basis points
    }
    
    #[test]
    fn test_take_profit_conditions() {
        // Baseline snapshot
        let baseline = PortfolioSnapshot {
            timestamp: 1000,
            total_value: 1000,
            asset_values: vec![],
            asset_allocations: vec![],
        };
        
        // Current snapshot with 15% gain
        let current = PortfolioSnapshot {
            timestamp: 2000,
            total_value: 1150,
            asset_values: vec![],
            asset_allocations: vec![],
        };
        
        // Percentage-based strategy with 10% threshold
        let percentage_strategy = TakeProfitStrategy {
            strategy_type: TakeProfitType::Percentage { percentage: 1000 }, // 10%
            last_execution: 0,
            baseline_value: 1000,
        };
        
        // Should take profit since gain (15%) exceeds threshold (10%)
        assert!(Portfolio::should_take_profit(&percentage_strategy, &current, &baseline));
        
        // Percentage-based strategy with 20% threshold
        let higher_threshold_strategy = TakeProfitStrategy {
            strategy_type: TakeProfitType::Percentage { percentage: 2000 }, // 20%
            last_execution: 0,
            baseline_value: 1000,
        };
        
        // Should not take profit since gain (15%) is below threshold (20%)
        assert!(!Portfolio::should_take_profit(&higher_threshold_strategy, &current, &baseline));
        
        // Time-based strategy with 1 hour interval
        let time_strategy = TakeProfitStrategy {
            strategy_type: TakeProfitType::Time { interval_seconds: 3600 }, // 1 hour
            last_execution: 1000, // Same as baseline timestamp
            baseline_value: 1000,
        };
        
        // Should not take profit since only 1000 seconds have passed (< 3600)
        assert!(!Portfolio::should_take_profit(&time_strategy, &current, &baseline));
    }
}
