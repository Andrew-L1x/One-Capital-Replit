//! Tests for the rebalancing functionality
//! 
//! This module provides comprehensive tests for the drift calculation,
//! auto-rebalancing logic, and event emission.

use crate::allocation::{AllocationSet, AssetAllocation};
use crate::rebalance::{RebalanceEngine, RebalanceStrategy};
use crate::events::DriftResult;

#[test]
fn test_drift_calculation() {
    // Create allocation for Bitcoin - Target 50%, current 55% (5% drift)
    let btc = AssetAllocation::new("BTC".to_string(), 5000);
    
    // Update the current allocation to create drift
    let mut btc_drift = btc.clone();
    btc_drift.update_current_percentage(5500);
    
    // Assert absolute drift calculation
    assert_eq!(btc_drift.drift(), 500); // 5% drift = 500 basis points
    
    // Assert relative drift calculation
    assert_eq!(btc_drift.drift_percentage(), 1000); // 10% of the target (500/5000*10000)
    
    // Assert overweight/underweight determination
    assert!(btc_drift.is_overweight());
    assert!(!btc_drift.is_underweight());
    
    // Create another allocation with underweight
    let mut eth_drift = AssetAllocation::new("ETH".to_string(), 5000);
    eth_drift.update_current_percentage(4500);
    
    // Assert calculations for underweight
    assert_eq!(eth_drift.drift(), 500);
    assert_eq!(eth_drift.drift_percentage(), 1000);
    assert!(!eth_drift.is_overweight());
    assert!(eth_drift.is_underweight());
}

#[test]
fn test_create_drift_result() {
    let mut allocation = AssetAllocation::new("BTC".to_string(), 5000);
    allocation.update_current_percentage(6000);
    
    // Create drift result with threshold 300 bps (3%)
    let result = allocation.create_drift_result(300);
    
    assert_eq!(result.asset_id, "BTC");
    assert_eq!(result.current_percentage, 6000);
    assert_eq!(result.target_percentage, 5000);
    assert_eq!(result.drift_amount, 1000);
    assert!(result.exceeds_threshold); // 10% > 3%
    
    // Create drift result with threshold 1500 bps (15%)
    let result2 = allocation.create_drift_result(1500);
    assert!(!result2.exceeds_threshold); // 10% < 15%
}

#[test]
fn test_calculate_rebalance_transactions() {
    let mut allocation_set = AllocationSet::new(300); // 3% drift threshold
    
    // Add BTC allocation (60%)
    let btc = AssetAllocation::new("BTC".to_string(), 6000);
    allocation_set.add_allocation(btc).unwrap();
    
    // Add ETH allocation (40%)
    let eth = AssetAllocation::new("ETH".to_string(), 4000);
    allocation_set.add_allocation(eth).unwrap();
    
    // Create current values - BTC is 70%, ETH is 30% (out of balance)
    let current_values = vec![
        ("BTC".to_string(), 7000),
        ("ETH".to_string(), 3000),
    ];
    
    let total_value = 10000;
    
    // Calculate rebalance transactions
    let transactions = allocation_set.calculate_rebalance_transactions(
        &current_values, 
        total_value
    );
    
    // Should have 1 transaction: sell BTC, buy ETH
    assert_eq!(transactions.len(), 1);
    
    let (source, target, amount) = &transactions[0];
    assert_eq!(source, "BTC");
    assert_eq!(target, "ETH");
    assert_eq!(*amount, 1000); // Need to move 10% from BTC to ETH
}

#[test]
fn test_allocation_set_needs_rebalancing() {
    let mut allocation_set = AllocationSet::new(300); // 3% drift threshold
    
    // Add BTC allocation (target 50%)
    let btc = AssetAllocation::new("BTC".to_string(), 5000);
    allocation_set.add_allocation(btc).unwrap();
    
    // Add ETH allocation (target 50%)
    let eth = AssetAllocation::new("ETH".to_string(), 5000);
    allocation_set.add_allocation(eth).unwrap();
    
    // Everything at target - no rebalance needed
    assert!(!allocation_set.needs_rebalancing());
    
    // Update BTC current allocation to 55% (5% drift)
    let btc_allocation = allocation_set.allocations.iter_mut()
        .find(|a| a.asset_id == "BTC")
        .unwrap();
    btc_allocation.update_current_percentage(5500);
    
    // Update ETH current allocation to 45% (5% drift)
    let eth_allocation = allocation_set.allocations.iter_mut()
        .find(|a| a.asset_id == "ETH")
        .unwrap();
    eth_allocation.update_current_percentage(4500);
    
    // Now should need rebalancing since drift > threshold
    assert!(allocation_set.needs_rebalancing());
    
    // Reset allocations to target
    btc_allocation.update_current_percentage(5000);
    eth_allocation.update_current_percentage(5000);
    
    // Set up time-based rebalancing (daily)
    allocation_set.set_rebalance_frequency(86400);
    
    // Fast forward 2 days
    let current_time = l1x_sdk::env::block_timestamp();
    l1x_sdk::env::set_block_timestamp(current_time + 172800);
    
    // Should need rebalancing due to time
    assert!(allocation_set.needs_rebalancing());
}

// Integration test for multiple assets rebalancing
#[test]
fn test_multi_asset_rebalancing() {
    let mut allocation_set = AllocationSet::new(200); // 2% drift threshold
    
    // Add BTC allocation (40%)
    let btc = AssetAllocation::new("BTC".to_string(), 4000);
    allocation_set.add_allocation(btc).unwrap();
    
    // Add ETH allocation (30%)
    let eth = AssetAllocation::new("ETH".to_string(), 3000);
    allocation_set.add_allocation(eth).unwrap();
    
    // Add SOL allocation (20%)
    let sol = AssetAllocation::new("SOL".to_string(), 2000);
    allocation_set.add_allocation(sol).unwrap();
    
    // Add AVAX allocation (10%)
    let avax = AssetAllocation::new("AVAX".to_string(), 1000);
    allocation_set.add_allocation(avax).unwrap();
    
    // Create current values with significant drifts
    let current_values = vec![
        ("BTC".to_string(), 3500),  // Under-allocated (35% vs 40%)
        ("ETH".to_string(), 2500),  // Under-allocated (25% vs 30%)
        ("SOL".to_string(), 3000),  // Over-allocated (30% vs 20%)
        ("AVAX".to_string(), 1000), // On target (10%)
    ];
    
    let total_value = 10000;
    
    // Calculate rebalance transactions
    let transactions = allocation_set.calculate_rebalance_transactions(
        &current_values, 
        total_value
    );
    
    // Should generate transactions to correct imbalances
    assert_eq!(transactions.len(), 2);
    
    // Sort transactions for consistent testing
    let mut sorted_transactions = transactions.clone();
    sorted_transactions.sort_by(|a, b| a.0.cmp(&b.0));
    
    // First transaction should involve SOL as source
    let (source1, target1, amount1) = &sorted_transactions[0];
    assert_eq!(source1, "SOL");
    
    // SOL needs to give up 10% (1000 units)
    assert_eq!(*amount1, 1000);
}

// Test rebalance execution with simulated swap
#[test]
fn test_rebalance_operation_execution() {
    // Setup is handled in RebalanceEngine test in rebalance/mod.rs
    let transactions = vec![
        ("BTC".to_string(), "ETH".to_string(), 100),
        ("BTC".to_string(), "SOL".to_string(), 50),
    ];
    
    let operation = RebalanceEngine::create_rebalance_operation(
        "rebalance-test-1".to_string(),
        RebalanceStrategy::Threshold,
        transactions,
    );
    
    // Operation should be in pending state with 2 transactions
    assert_eq!(operation.id, "rebalance-test-1");
    assert_eq!(operation.transactions.len(), 2);
}

#[test]
fn test_drift_threshold_exceeded() {
    // Create allocations with different drift thresholds
    let mut allocation_set = AllocationSet::new(300); // 3% drift threshold
    let btc = AssetAllocation::new("BTC".to_string(), 3000);
    let eth = AssetAllocation::new("ETH".to_string(), 3000);
    let sol = AssetAllocation::new("SOL".to_string(), 4000);
    
    allocation_set.add_allocation(btc).unwrap();
    allocation_set.add_allocation(eth).unwrap();
    allocation_set.add_allocation(sol).unwrap();
    
    // Update current allocations with drift below threshold
    // BTC: 32% vs 30% - 2% drift - below threshold
    allocation_set.allocations[0].update_current_percentage(3200);
    
    // ETH: 27% vs 30% - 3% drift - at threshold, not exceeding
    allocation_set.allocations[1].update_current_percentage(2700);
    
    // SOL: 41% vs 40% - 1% drift - below threshold
    allocation_set.allocations[2].update_current_percentage(4100);
    
    // Should not need rebalancing yet
    assert!(!allocation_set.needs_rebalancing());
    
    // Increase the drift to exceed threshold
    // ETH: 26% vs 30% - 4% drift - above threshold
    allocation_set.allocations[1].update_current_percentage(2600);
    
    // Now it should need rebalancing
    assert!(allocation_set.needs_rebalancing());
}

#[test]
fn test_drift_percentage_calculation() {
    // Test with standard allocation
    let mut btc = AssetAllocation::new("BTC".to_string(), 5000); // 50%
    btc.update_current_percentage(5500); // 55% 
    
    // Drift is 500 basis points (5%)
    assert_eq!(btc.drift(), 500);
    
    // Drift percentage is 10% of the target (5% / 50% * 100)
    assert_eq!(btc.drift_percentage(), 1000);
    
    // Test with small allocation
    let mut small = AssetAllocation::new("AVAX".to_string(), 500); // 5%
    small.update_current_percentage(600); // 6%
    
    // Drift is 100 basis points (1%)
    assert_eq!(small.drift(), 100);
    
    // Drift percentage is 20% of the target (1% / 5% * 100)
    assert_eq!(small.drift_percentage(), 2000);
}

#[test]
fn test_complex_rebalancing_scenario() {
    // Create a more complex allocation set
    let mut allocation_set = AllocationSet::new(200); // 2% drift threshold
    
    // Add multiple assets with different allocations
    allocation_set.add_allocation(AssetAllocation::new("BTC".to_string(), 4000)).unwrap();  // 40%
    allocation_set.add_allocation(AssetAllocation::new("ETH".to_string(), 3000)).unwrap();  // 30%
    allocation_set.add_allocation(AssetAllocation::new("SOL".to_string(), 1500)).unwrap();  // 15%
    allocation_set.add_allocation(AssetAllocation::new("AVAX".to_string(), 1000)).unwrap(); // 10%
    allocation_set.add_allocation(AssetAllocation::new("USDC".to_string(), 500)).unwrap();  // 5%
    
    // Set current values with significant drifts
    let current_values = vec![
        ("BTC".to_string(), 4500),   // 45% - over-allocated by 5%
        ("ETH".to_string(), 2500),   // 25% - under-allocated by 5%
        ("SOL".to_string(), 1800),   // 18% - over-allocated by 3%
        ("AVAX".to_string(), 700),   // 7%  - under-allocated by 3%
        ("USDC".to_string(), 500),   // 5%  - on target
    ];
    
    let total_value = 10000;
    
    // Calculate rebalance transactions
    let transactions = allocation_set.calculate_rebalance_transactions(
        &current_values,
        total_value
    );
    
    // Should generate transactions to correct the imbalances
    assert!(transactions.len() > 0);
    
    // There should be at least one transaction selling BTC (over-allocated)
    assert!(transactions.iter().any(|(source, _, _)| source == "BTC"));
    
    // There should be at least one transaction buying ETH (under-allocated)
    assert!(transactions.iter().any(|(_, target, _)| target == "ETH"));
    
    // Total amount being moved around should be 800 units (sum of absolute deviations)
    let total_amount: u128 = transactions.iter().map(|(_, _, amount)| *amount).sum();
    assert_eq!(total_amount, 800);
}