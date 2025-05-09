//! Take profit strategies for One Capital Auto-Investing
//! 
//! This module defines the take profit strategies that can be applied to
//! investment portfolios to realize gains according to different triggers.

use serde::{Deserialize, Serialize};
use l1x_sdk::prelude::*;

/// Types of take profit strategies
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TakeProfitType {
    /// Manual trigger (user must explicitly execute)
    Manual,
    
    /// Percentage-based trigger (execute when gain exceeds percentage)
    Percentage {
        /// Target percentage gain in basis points (10000 = 100%)
        percentage: u32,
    },
    
    /// Time-based trigger (execute at regular intervals)
    Time {
        /// Interval in seconds between executions
        interval_seconds: u64,
    },
}

/// Take profit strategy for a portfolio
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TakeProfitStrategy {
    /// Type of take profit strategy
    pub strategy_type: TakeProfitType,
    
    /// Timestamp of last execution
    pub last_execution: u64,
    
    /// Baseline value for percentage-based strategies
    pub baseline_value: u128,
}

impl TakeProfitStrategy {
    /// Creates a new take profit strategy
    pub fn new(strategy_type: TakeProfitType) -> Self {
        Self {
            strategy_type,
            last_execution: 0,
            baseline_value: 0,
        }
    }
    
    /// Sets the baseline value for percentage-based strategies
    pub fn set_baseline(&mut self, baseline_value: u128) {
        self.baseline_value = baseline_value;
    }
    
    /// Records an execution of the take profit strategy
    pub fn record_execution(&mut self) {
        self.last_execution = l1x_sdk::env::block_timestamp();
    }
    
    /// Determines if the take profit strategy should be executed
    pub fn should_execute(&self, current_prices: &[(String, u128)]) -> bool {
        match &self.strategy_type {
            TakeProfitType::Manual => false, // Manual requires explicit trigger
            
            TakeProfitType::Percentage { percentage } => {
                if self.baseline_value == 0 {
                    return false;
                }
                
                // Calculate current value based on prices
                let current_value: u128 = current_prices
                    .iter()
                    .map(|(_, price)| *price)
                    .sum();
                
                // Calculate gain as a percentage
                if current_value <= self.baseline_value {
                    return false;
                }
                
                let gain = current_value - self.baseline_value;
                let gain_percentage = (gain * 10000) / self.baseline_value;
                
                gain_percentage >= (*percentage as u128)
            },
            
            TakeProfitType::Time { interval_seconds } => {
                let current_time = l1x_sdk::env::block_timestamp();
                let elapsed = current_time.saturating_sub(self.last_execution);
                
                elapsed >= *interval_seconds
            },
        }
    }
    
    /// Executes the take profit strategy (placeholder for actual implementation)
    pub fn execute(&mut self) -> bool {
        // In a real implementation, this would interact with the L1X blockchain
        // to sell assets and realize profits
        
        // For now, just record the execution
        self.record_execution();
        true
    }
}

/// Take profit execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TakeProfitResult {
    /// Strategy that was executed
    pub strategy_type: TakeProfitType,
    
    /// Amount of profit taken
    pub profit_amount: u128,
    
    /// Asset that was sold
    pub asset_sold: String,
    
    /// Asset that was bought (typically a stablecoin)
    pub asset_bought: String,
    
    /// Timestamp of execution
    pub execution_time: u64,
    
    /// Transaction ID
    pub transaction_id: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_manual_strategy() {
        let strategy = TakeProfitStrategy::new(TakeProfitType::Manual);
        
        // Manual strategy should never auto-execute
        assert!(!strategy.should_execute(&[]));
    }
    
    #[test]
    fn test_percentage_strategy() {
        let mut strategy = TakeProfitStrategy::new(TakeProfitType::Percentage {
            percentage: 1000, // 10%
        });
        
        // Set baseline value
        strategy.set_baseline(1000);
        
        // No gain yet
        let no_gain_prices = vec![("BTC".to_string(), 1000)];
        assert!(!strategy.should_execute(&no_gain_prices));
        
        // 5% gain (below threshold)
        let small_gain_prices = vec![("BTC".to_string(), 1050)];
        assert!(!strategy.should_execute(&small_gain_prices));
        
        // 20% gain (above threshold)
        let large_gain_prices = vec![("BTC".to_string(), 1200)];
        assert!(strategy.should_execute(&large_gain_prices));
    }
    
    #[test]
    fn test_time_strategy() {
        let mut strategy = TakeProfitStrategy::new(TakeProfitType::Time {
            interval_seconds: 3600, // 1 hour
        });
        
        // Set last execution to now
        strategy.record_execution();
        
        // Time hasn't elapsed yet
        assert!(!strategy.should_execute(&[]));
        
        // Simulate time passing (1 hour + 1 second)
        let timestamp = l1x_sdk::env::block_timestamp();
        l1x_sdk::env::set_block_timestamp(timestamp + 3601);
        
        // Time has elapsed, should execute
        assert!(strategy.should_execute(&[]));
    }
}
