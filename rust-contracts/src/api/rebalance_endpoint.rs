//! API endpoints for rebalancing functionality
//!
//! This module provides the API endpoints for triggering rebalancing operations,
//! getting rebalance history, and managing rebalance settings.

use l1x_sdk::prelude::*;
use serde::{Deserialize, Serialize};

use crate::custodial_vault::CustodialVault;
use crate::non_custodial_vault::NonCustodialVault;
use crate::rebalance::scheduled::ScheduledRebalancer;
use crate::events;

/// Request for triggering rebalance
#[derive(Debug, Serialize, Deserialize)]
pub struct RebalanceRequest {
    /// Vault ID to rebalance
    pub vault_id: String,
    
    /// Vault type (custodial or non-custodial)
    pub vault_type: VaultType,
    
    /// Current prices in JSON format
    pub prices_json: String,
}

/// Vault type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum VaultType {
    /// Custodial vault (protocol manages assets)
    Custodial,
    
    /// Non-custodial vault (user manages assets)
    NonCustodial,
}

/// Response from rebalance request
#[derive(Debug, Serialize, Deserialize)]
pub struct RebalanceResponse {
    /// Success status
    pub success: bool,
    
    /// Message describing result
    pub message: String,
    
    /// Details of rebalance operation
    pub details: Option<String>,
}

/// Handles rebalance request
pub fn handle_rebalance_request(request_json: &str) -> String {
    let request: RebalanceRequest = match serde_json::from_str(request_json) {
        Ok(req) => req,
        Err(e) => {
            let response = RebalanceResponse {
                success: false,
                message: format!("Invalid request format: {}", e),
                details: None,
            };
            return serde_json::to_string(&response).unwrap();
        }
    };
    
    let result = match request.vault_type {
        VaultType::Custodial => rebalance_custodial_vault(&request),
        VaultType::NonCustodial => rebalance_non_custodial_vault(&request),
    };
    
    serde_json::to_string(&result).unwrap()
}

/// Rebalances a custodial vault
fn rebalance_custodial_vault(request: &RebalanceRequest) -> RebalanceResponse {
    // Emit rebalance initiated event
    events::emit_rebalance_initiated_event(&request.vault_id, "api_request");
    
    // Attempt to rebalance
    let result = CustodialVault::rebalance(
        request.vault_id.clone(),
        request.prices_json.clone(),
    );
    
    RebalanceResponse {
        success: true,
        message: "Rebalance operation executed".to_string(),
        details: Some(result),
    }
}

/// Rebalances a non-custodial vault by creating a rebalance request
fn rebalance_non_custodial_vault(request: &RebalanceRequest) -> RebalanceResponse {
    // For non-custodial vaults, we can only request a rebalance
    let result = NonCustodialVault::request_rebalance(request.vault_id.clone());
    
    // Plan the rebalance using provided prices
    let plan = NonCustodialVault::plan_rebalance(
        request.vault_id.clone(),
        request.prices_json.clone(),
    );
    
    RebalanceResponse {
        success: true,
        message: result,
        details: Some(plan),
    }
}

/// Request for scheduled rebalancing
#[derive(Debug, Serialize, Deserialize)]
pub struct ScheduledRebalanceRequest {
    /// Prices in JSON format
    pub prices_json: String,
}

/// Handles scheduled rebalance request
pub fn handle_scheduled_rebalance(request_json: &str) -> String {
    let request: ScheduledRebalanceRequest = match serde_json::from_str(request_json) {
        Ok(req) => req,
        Err(e) => {
            let response = RebalanceResponse {
                success: false,
                message: format!("Invalid request format: {}", e),
                details: None,
            };
            return serde_json::to_string(&response).unwrap();
        }
    };
    
    let result = ScheduledRebalancer::run_scheduled_rebalancing(&request.prices_json);
    
    let response = RebalanceResponse {
        success: true,
        message: "Scheduled rebalance executed".to_string(),
        details: Some(result),
    };
    
    serde_json::to_string(&response).unwrap()
}

/// Entry point for rebalancing API
#[no_mangle]
extern "C" fn rebalance_api(request_json_ptr: u64) {
    let request_json = unsafe { l1x_sdk::env::read_input(request_json_ptr) };
    let request_json = String::from_utf8(request_json).unwrap();
    
    l1x_sdk::env::log(&format!("Received rebalance request: {}", request_json));
    
    let response = handle_rebalance_request(&request_json);
    
    l1x_sdk::env::return_output(response.as_bytes());
}

/// Entry point for scheduled rebalancing API
#[no_mangle]
extern "C" fn scheduled_rebalance_api(request_json_ptr: u64) {
    let request_json = unsafe { l1x_sdk::env::read_input(request_json_ptr) };
    let request_json = String::from_utf8(request_json).unwrap();
    
    l1x_sdk::env::log(&format!("Received scheduled rebalance request: {}", request_json));
    
    let response = handle_scheduled_rebalance(&request_json);
    
    l1x_sdk::env::return_output(response.as_bytes());
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_rebalance_request_serialization() {
        let request = RebalanceRequest {
            vault_id: "vault-1".to_string(),
            vault_type: VaultType::Custodial,
            prices_json: r#"[["BTC", 65000], ["ETH", 3500]]"#.to_string(),
        };
        
        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("vault-1"));
        assert!(json.contains("Custodial"));
        
        let parsed: RebalanceRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.vault_id, "vault-1");
        assert_eq!(parsed.vault_type, VaultType::Custodial);
    }
    
    #[test]
    fn test_rebalance_response_serialization() {
        let response = RebalanceResponse {
            success: true,
            message: "Rebalance successful".to_string(),
            details: Some("Executed 2 trades".to_string()),
        };
        
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("true"));
        assert!(json.contains("Rebalance successful"));
        
        let parsed: RebalanceResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.success, true);
        assert_eq!(parsed.message, "Rebalance successful");
        assert_eq!(parsed.details, Some("Executed 2 trades".to_string()));
    }
}