//! Integration tests for One Capital Auto-Investing smart contracts

use crate::allocation::{AllocationSet, AssetAllocation};
use crate::custodial_vault::{CustodialVault, VaultStatus};
use crate::non_custodial_vault::NonCustodialVault;
use crate::portfolio::Portfolio;
use crate::rebalance::{RebalanceEngine, RebalanceStrategy, RebalanceStatus};
use crate::take_profit::{TakeProfitStrategy, TakeProfitType};
use crate::wallet::{Wallet, WalletType, AccessLevel};
use crate::xtalk::{XTalkClient, XTalkSwapRequest};

#[test]
fn test_full_portfolio_lifecycle() {
    // Create a wallet
    let wallet = Wallet::new_native(
        "wallet-1".to_string(),
        "0xuser1".to_string(),
        "0xpubkey1".to_string(),
    );
    
    // Create a custodial vault
    let mut vault = CustodialVault::new(
        "vault-1".to_string(),
        wallet.id.clone(),
        300, // 3% drift threshold
    );
    
    // Add allocations
    let btc_allocation = AssetAllocation::new("BTC".to_string(), 5000); // 50%
    vault.allocations.add_allocation(btc_allocation).unwrap();
    
    let eth_allocation = AssetAllocation::new("ETH".to_string(), 3000); // 30%
    vault.allocations.add_allocation(eth_allocation).unwrap();
    
    let usdc_allocation = AssetAllocation::new("USDC".to_string(), 2000); // 20%
    vault.allocations.add_allocation(usdc_allocation).unwrap();
    
    // Set take profit strategy (10% gain)
    vault.set_take_profit_strategy(TakeProfitType::Percentage {
        percentage: 1000,
    }).unwrap();
    
    // Deposit funds
    vault.deposit(10000).unwrap(); // $10,000
    assert_eq!(vault.total_value, 10000);
    
    // Current holdings are not according to target allocation
    let current_values = vec![
        ("BTC".to_string(), 6000),  // 60% instead of 50%
        ("ETH".to_string(), 2000),  // 20% instead of 30%
        ("USDC".to_string(), 2000), // 20% as targeted
    ];
    
    // Check if rebalancing is needed
    assert!(RebalanceEngine::needs_rebalancing(
        &vault.allocations,
        &current_values,
        vault.total_value,
    ));
    
    // Generate rebalance transactions
    let transactions = RebalanceEngine::generate_rebalance_transactions(
        &vault.allocations,
        &current_values,
        vault.total_value,
    );
    
    // Verify transactions
    assert_eq!(transactions.len(), 1);
    assert_eq!(transactions[0].0, "BTC"); // Sell BTC
    assert_eq!(transactions[0].1, "ETH"); // Buy ETH
    assert_eq!(transactions[0].2, 1000);  // Amount to swap ($1,000)
    
    // Create rebalance operation
    let mut operation = RebalanceEngine::create_rebalance_operation(
        "rebalance-1".to_string(),
        RebalanceStrategy::Threshold,
        transactions,
    );
    
    // Simulate rebalance execution (normally would happen on-chain)
    vault.allocations.allocations[0].update_current_percentage(5000); // BTC now 50%
    vault.allocations.allocations[1].update_current_percentage(3000); // ETH now 30%
    
    // New balanced values
    let balanced_values = vec![
        ("BTC".to_string(), 5000),
        ("ETH".to_string(), 3000),
        ("USDC".to_string(), 2000),
    ];
    
    // Verify no longer needs rebalancing
    assert!(!RebalanceEngine::needs_rebalancing(
        &vault.allocations,
        &balanced_values,
        vault.total_value,
    ));
    
    // Create portfolio snapshot
    let snapshot = Portfolio::create_snapshot(balanced_values, &vault.allocations);
    assert_eq!(snapshot.total_value, 10000);
    
    // Simulate market movements (20% gain)
    let new_values = vec![
        ("BTC".to_string(), 6000),
        ("ETH".to_string(), 3600),
        ("USDC".to_string(), 2400),
    ];
    
    let new_total = 12000;
    
    // Create new snapshot
    let new_snapshot = Portfolio::create_snapshot(new_values.clone(), &vault.allocations);
    assert_eq!(new_snapshot.total_value, 12000);
    
    // Calculate gain
    let gain = Portfolio::calculate_gain_since(&new_snapshot, &snapshot);
    assert_eq!(gain, 2000);
    
    let gain_percentage = Portfolio::calculate_gain_percentage_since(&new_snapshot, &snapshot);
    assert_eq!(gain_percentage, 2000); // 20% = 2000 basis points
    
    // With 20% gain, take profit should trigger (threshold was 10%)
    if let Some(strategy) = &vault.take_profit {
        let should_take_profit = Portfolio::should_take_profit(
            strategy,
            &new_snapshot,
            &snapshot,
        );
        assert!(should_take_profit);
    }
    
    // The portfolio is now imbalanced due to different growth rates
    // It should need rebalancing again
    assert!(RebalanceEngine::needs_rebalancing(
        &vault.allocations,
        &new_values,
        new_total,
    ));
}

#[test]
fn test_non_custodial_workflow() {
    // Create a non-custodial vault
    let mut vault = NonCustodialVault::new(
        "vault-2".to_string(),
        "0xuser2".to_string(),
        "0xcontract2".to_string(),
        300, // 3% drift threshold
    );
    
    // Add allocations
    let btc_allocation = AssetAllocation::new("BTC".to_string(), 5000); // 50%
    vault.allocations.add_allocation(btc_allocation).unwrap();
    
    let eth_allocation = AssetAllocation::new("ETH".to_string(), 5000); // 50%
    vault.allocations.add_allocation(eth_allocation).unwrap();
    
    // Current values (60/40 split)
    let current_values = vec![
        ("BTC".to_string(), 6000),
        ("ETH".to_string(), 4000),
    ];
    
    // Generate rebalance suggestions
    let suggestions = vault.generate_rebalance_suggestions(&current_values, 10000);
    
    // Verify suggestions
    assert_eq!(suggestions.len(), 1);
    assert_eq!(suggestions[0].source_asset, "BTC");
    assert_eq!(suggestions[0].target_asset, "ETH");
    assert_eq!(suggestions[0].amount, 1000);
    
    // Nonce should have been incremented
    assert_eq!(vault.rebalance_nonce, 1);
    
    // Simulate user approving and executing the swap
    // Then update the allocations to reflect the new balance
    let new_values = vec![
        ("BTC".to_string(), 5000),
        ("ETH".to_string(), 5000),
    ];
    
    vault.update_allocations_after_rebalance(&new_values, 10000);
    
    // Verify allocations are updated
    assert_eq!(vault.allocations.allocations[0].current_percentage, 5000);
    assert_eq!(vault.allocations.allocations[1].current_percentage, 5000);
    
    // Last rebalance should be updated
    assert!(vault.last_rebalance > 0);
}

#[test]
fn test_xtalk_integration() {
    // Create a price quote
    let quote = XTalkClient::get_price_quote("BTC", "ETH", 1_00000000).unwrap();
    
    // Verify quote details
    assert_eq!(quote.source_asset, "BTC");
    assert_eq!(quote.target_asset, "ETH");
    assert!(quote.expires_at > 0);
    
    // Create and execute a swap
    let swap_request = XTalkSwapRequest {
        source_asset: "BTC".to_string(),
        target_asset: "ETH".to_string(),
        amount: 1_00000000,
        slippage_bps: 50,
    };
    
    let result = XTalkClient::execute_swap(&swap_request).unwrap();
    
    // Verify swap result
    assert_eq!(result.source_asset, "BTC");
    assert_eq!(result.target_asset, "ETH");
    assert_eq!(result.source_amount, 1_00000000);
    assert!(result.fee > 0);
    
    // Get asset prices
    let btc_price = XTalkClient::get_asset_price("BTC").unwrap();
    let eth_price = XTalkClient::get_asset_price("ETH").unwrap();
    
    // Verify prices
    assert!(btc_price > 0);
    assert!(eth_price > 0);
    
    // Get liquidity
    let btc_liquidity = XTalkClient::get_liquidity("BTC").unwrap();
    let eth_liquidity = XTalkClient::get_liquidity("ETH").unwrap();
    
    // Verify liquidity
    assert!(btc_liquidity > 0);
    assert!(eth_liquidity > 0);
}
