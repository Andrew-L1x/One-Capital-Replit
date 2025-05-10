//! Scheduled rebalancing for One Capital Auto-Investing
//!
//! This module provides functionality for time-based scheduled rebalancing
//! of investment portfolios, supporting daily, weekly, and monthly schedules.

use crate::custodial_vault::CustodialVault;
use crate::non_custodial_vault::NonCustodialVault;
use crate::events;
use l1x_sdk::prelude::*;

/// Frequency for scheduled rebalancing
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RebalanceFrequency {
    /// Daily rebalancing
    Daily,
    
    /// Weekly rebalancing
    Weekly,
    
    /// Monthly rebalancing
    Monthly,
    
    /// Custom interval in seconds
    Custom(u64),
}

impl RebalanceFrequency {
    /// Converts frequency to seconds
    pub fn to_seconds(&self) -> u64 {
        match self {
            Self::Daily => 86400,                  // 24 hours
            Self::Weekly => 7 * 86400,             // 7 days
            Self::Monthly => 30 * 86400,           // 30 days (approximation)
            Self::Custom(seconds) => *seconds,
        }
    }
    
    /// Checks if rebalance is due based on last rebalance time
    pub fn is_due(&self, last_rebalance: u64) -> bool {
        let current_time = l1x_sdk::env::block_timestamp();
        let elapsed = current_time.saturating_sub(last_rebalance);
        
        elapsed >= self.to_seconds()
    }
}

/// Scheduled rebalancer that processes vaults based on time schedule
pub struct ScheduledRebalancer;

impl ScheduledRebalancer {
    /// Process all custodial vaults and rebalance if needed
    pub fn process_custodial_vaults(prices_json: &str) -> Vec<String> {
        let mut results = Vec::new();
        let vault_ids = Self::get_active_custodial_vault_ids();
        
        for vault_id in vault_ids {
            // Check if rebalancing is needed based on schedule
            if Self::should_rebalance_custodial(&vault_id) {
                let result = CustodialVault::auto_rebalance(vault_id.clone(), prices_json.to_string());
                results.push(format!("{}: {}", vault_id, result));
            }
        }
        
        results
    }
    
    /// Process all non-custodial vaults and create rebalance requests if needed
    pub fn process_non_custodial_vaults() -> Vec<String> {
        let mut results = Vec::new();
        let vault_ids = Self::get_active_non_custodial_vault_ids();
        
        for vault_id in vault_ids {
            // Check if rebalancing is needed based on schedule
            if Self::should_rebalance_non_custodial(&vault_id) {
                // For non-custodial, we can only create a request
                if NonCustodialVault::check_rebalancing_with_events(&vault_id) {
                    let result = NonCustodialVault::request_rebalance(vault_id.clone());
                    results.push(format!("{}: {}", vault_id, result));
                }
            }
        }
        
        results
    }
    
    /// Determines if a custodial vault should be rebalanced based on schedule
    fn should_rebalance_custodial(vault_id: &str) -> bool {
        CustodialVault::needs_rebalancing(vault_id.to_string())
    }
    
    /// Determines if a non-custodial vault should have a rebalance request created
    fn should_rebalance_non_custodial(vault_id: &str) -> bool {
        NonCustodialVault::needs_rebalancing(vault_id.to_string())
    }
    
    /// Gets active custodial vault IDs
    fn get_active_custodial_vault_ids() -> Vec<String> {
        CustodialVault::get_active_vault_ids()
    }
    
    /// Gets active non-custodial vault IDs
    fn get_active_non_custodial_vault_ids() -> Vec<String> {
        NonCustodialVault::get_active_vault_ids()
    }
    
    /// Main entry point for scheduled rebalancing job
    pub fn run_scheduled_rebalancing(prices_json: &str) -> String {
        // Process custodial vaults (can be auto-rebalanced)
        let custodial_results = Self::process_custodial_vaults(prices_json);
        
        // Process non-custodial vaults (can only request rebalancing)
        let non_custodial_results = Self::process_non_custodial_vaults();
        
        // Combine results
        let mut results = Vec::new();
        results.push(format!("Processed {} custodial vaults", custodial_results.len()));
        results.push(format!("Processed {} non-custodial vaults", non_custodial_results.len()));
        
        // Log details
        for result in &custodial_results {
            l1x_sdk::env::log(&format!("Custodial: {}", result));
        }
        
        for result in &non_custodial_results {
            l1x_sdk::env::log(&format!("Non-custodial: {}", result));
        }
        
        results.join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_rebalance_frequency_to_seconds() {
        assert_eq!(RebalanceFrequency::Daily.to_seconds(), 86400);
        assert_eq!(RebalanceFrequency::Weekly.to_seconds(), 7 * 86400);
        assert_eq!(RebalanceFrequency::Monthly.to_seconds(), 30 * 86400);
        assert_eq!(RebalanceFrequency::Custom(3600).to_seconds(), 3600);
    }
    
    #[test]
    fn test_is_due_for_rebalance() {
        let current_time = l1x_sdk::env::block_timestamp();
        
        // Should not be due if just rebalanced
        let freq = RebalanceFrequency::Daily;
        assert!(!freq.is_due(current_time));
        
        // Should be due if last rebalance was 2 days ago
        let two_days_ago = current_time - (2 * 86400);
        assert!(freq.is_due(two_days_ago));
        
        // Custom frequency test
        let custom_freq = RebalanceFrequency::Custom(3600); // 1 hour
        let one_minute_ago = current_time - 60;
        let two_hours_ago = current_time - (2 * 3600);
        
        assert!(!custom_freq.is_due(one_minute_ago));
        assert!(custom_freq.is_due(two_hours_ago));
    }
}