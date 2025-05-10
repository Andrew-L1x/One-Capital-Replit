//! API module for One Capital Auto-Investing
//!
//! This module provides the API endpoints for the One Capital Auto-Investing
//! platform, allowing interaction with the smart contracts from web applications.

/// Rebalancing API endpoints
pub mod rebalance_endpoint;

/// API version
pub const API_VERSION: &str = "1.0.0";

/// API description
pub const API_DESCRIPTION: &str = "One Capital Auto-Investing API";

/// Gets API version and description
pub fn get_api_info() -> String {
    format!("{} v{}", API_DESCRIPTION, API_VERSION)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_api_info() {
        let info = get_api_info();
        assert!(info.contains("One Capital"));
        assert!(info.contains("1.0.0"));
    }
}