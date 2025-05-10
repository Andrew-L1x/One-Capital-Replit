//! Event system for One Capital Auto-Investing
//! 
//! This module provides the event system for emitting contract events
//! that can be captured by the UI or external systems.

use serde::{Deserialize, Serialize};
use l1x_sdk::prelude::*;

/// Event types for rebalancing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RebalanceEventType {
    /// Rebalance initiated
    RebalanceInitiated,
    
    /// Rebalance completed
    RebalanceCompleted,
    
    /// Rebalance failed
    RebalanceFailed,
    
    /// Asset drift exceeded threshold
    DriftExceeded,
    
    /// Scheduled rebalance triggered
    ScheduledRebalance,
}

/// Event for rebalancing operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebalanceEvent {
    /// Event type
    pub event_type: RebalanceEventType,
    
    /// Vault ID
    pub vault_id: String,
    
    /// Timestamp
    pub timestamp: u64,
    
    /// Additional data as JSON string
    pub data: String,
}

impl RebalanceEvent {
    /// Creates a new rebalance event
    pub fn new(event_type: RebalanceEventType, vault_id: String) -> Self {
        Self {
            event_type,
            vault_id,
            timestamp: l1x_sdk::env::block_timestamp(),
            data: String::new(),
        }
    }
    
    /// Sets additional data for the event
    pub fn with_data(mut self, data: String) -> Self {
        self.data = data;
        self
    }
    
    /// Emits the event
    pub fn emit(&self) {
        let event_json = serde_json::to_string(&self).unwrap_or_default();
        l1x_sdk::env::log(&format!("REBALANCE_EVENT:{}", event_json));
    }
}

/// Drift calculation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftResult {
    /// Asset ID
    pub asset_id: String,
    
    /// Current percentage allocation
    pub current_percentage: u32,
    
    /// Target percentage allocation
    pub target_percentage: u32,
    
    /// Drift amount in basis points
    pub drift_amount: u32,
    
    /// Whether the drift exceeds the threshold
    pub exceeds_threshold: bool,
}

/// Helper to emit a drift exceeded event
pub fn emit_drift_exceeded_event(vault_id: &str, assets: Vec<DriftResult>) {
    let data = serde_json::to_string(&assets).unwrap_or_default();
    let event = RebalanceEvent::new(RebalanceEventType::DriftExceeded, vault_id.to_string())
        .with_data(data);
    event.emit();
}

/// Helper to emit a rebalance initiated event
pub fn emit_rebalance_initiated_event(vault_id: &str, trigger: &str) {
    let data = format!("{{\"trigger\": \"{}\"}}", trigger);
    let event = RebalanceEvent::new(RebalanceEventType::RebalanceInitiated, vault_id.to_string())
        .with_data(data);
    event.emit();
}

/// Helper to emit a rebalance completed event
pub fn emit_rebalance_completed_event(vault_id: &str, tx_count: usize, total_cost: Option<u128>) {
    let data = if let Some(cost) = total_cost {
        format!("{{\"transaction_count\": {}, \"total_cost\": {}}}", tx_count, cost)
    } else {
        format!("{{\"transaction_count\": {}}}", tx_count)
    };
    
    let event = RebalanceEvent::new(RebalanceEventType::RebalanceCompleted, vault_id.to_string())
        .with_data(data);
    event.emit();
}

/// Helper to emit a rebalance failed event
pub fn emit_rebalance_failed_event(vault_id: &str, error: &str) {
    let data = format!("{{\"error\": \"{}\"}}", error);
    let event = RebalanceEvent::new(RebalanceEventType::RebalanceFailed, vault_id.to_string())
        .with_data(data);
    event.emit();
}