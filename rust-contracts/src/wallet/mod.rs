//! Wallet functionality for One Capital Auto-Investing
//! 
//! This module provides wallet management functions for interacting with
//! L1X blockchain and storing wallet-related data.

use serde::{Deserialize, Serialize};
use l1x_sdk::prelude::*;

/// Supported wallet types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WalletType {
    /// Direct L1X blockchain wallet
    Native,
    
    /// Multi-signature wallet requiring multiple approvals
    MultiSig,
    
    /// Hardware wallet integration
    Hardware,
}

/// Wallet access levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AccessLevel {
    /// Read-only access (can view balances but not transact)
    ReadOnly,
    
    /// Standard access (can perform regular transactions)
    Standard,
    
    /// Admin access (can change wallet settings)
    Admin,
}

/// Represents a wallet for interacting with L1X blockchain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wallet {
    /// Unique identifier for the wallet
    pub id: String,
    
    /// Wallet address on L1X blockchain
    pub address: String,
    
    /// Type of wallet
    pub wallet_type: WalletType,
    
    /// Public key associated with this wallet
    pub public_key: String,
    
    /// Access level for operations
    pub access_level: AccessLevel,
    
    /// Creation timestamp
    pub created_at: u64,
    
    /// Last activity timestamp
    pub last_activity: u64,
}

impl Wallet {
    /// Creates a new native wallet
    pub fn new_native(id: String, address: String, public_key: String) -> Self {
        Self {
            id,
            address,
            wallet_type: WalletType::Native,
            public_key,
            access_level: AccessLevel::Standard,
            created_at: l1x_sdk::env::block_timestamp(),
            last_activity: l1x_sdk::env::block_timestamp(),
        }
    }
    
    /// Creates a new multi-signature wallet
    pub fn new_multi_sig(id: String, address: String, public_key: String) -> Self {
        Self {
            id,
            address,
            wallet_type: WalletType::MultiSig,
            public_key,
            access_level: AccessLevel::Standard,
            created_at: l1x_sdk::env::block_timestamp(),
            last_activity: l1x_sdk::env::block_timestamp(),
        }
    }
    
    /// Updates the last activity timestamp
    pub fn update_activity(&mut self) {
        self.last_activity = l1x_sdk::env::block_timestamp();
    }
    
    /// Changes the wallet's access level
    pub fn change_access_level(&mut self, new_level: AccessLevel) {
        self.access_level = new_level;
        self.update_activity();
    }
    
    /// Checks if the wallet has at least the specified access level
    pub fn has_access(&self, required_level: AccessLevel) -> bool {
        match (required_level, &self.access_level) {
            (AccessLevel::ReadOnly, _) => true,
            (AccessLevel::Standard, AccessLevel::Standard | AccessLevel::Admin) => true,
            (AccessLevel::Admin, AccessLevel::Admin) => true,
            _ => false,
        }
    }
}

/// Functions for connecting and managing wallets
pub struct WalletManager;

impl WalletManager {
    /// Connects a wallet to the platform
    pub fn connect_wallet(address: String, public_key: String) -> Wallet {
        let id = format!("wallet-{}", address);
        Wallet::new_native(id, address, public_key)
    }
    
    /// Signs a message using the wallet (placeholder function)
    pub fn sign_message(_wallet: &Wallet, _message: &[u8]) -> Vec<u8> {
        // In a real implementation, this would interface with the L1X SDK
        // to sign a message using the wallet's private key
        
        // For now, return a mock signature
        vec![0, 1, 2, 3, 4]
    }
    
    /// Verifies a signature (placeholder function)
    pub fn verify_signature(_wallet: &Wallet, _message: &[u8], _signature: &[u8]) -> bool {
        // In a real implementation, this would verify the signature
        // using the wallet's public key
        
        // For now, always return true
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_wallet_creation() {
        let wallet = Wallet::new_native(
            "wallet-1".to_string(),
            "0xaddress".to_string(),
            "0xpubkey".to_string(),
        );
        
        assert_eq!(wallet.wallet_type, WalletType::Native);
        assert_eq!(wallet.access_level, AccessLevel::Standard);
        assert_eq!(wallet.address, "0xaddress");
    }
    
    #[test]
    fn test_wallet_access_levels() {
        let mut wallet = Wallet::new_native(
            "wallet-1".to_string(),
            "0xaddress".to_string(),
            "0xpubkey".to_string(),
        );
        
        // Standard access can do standard operations
        assert!(wallet.has_access(AccessLevel::ReadOnly));
        assert!(wallet.has_access(AccessLevel::Standard));
        assert!(!wallet.has_access(AccessLevel::Admin));
        
        // Upgrade to admin
        wallet.change_access_level(AccessLevel::Admin);
        
        // Admin can do everything
        assert!(wallet.has_access(AccessLevel::ReadOnly));
        assert!(wallet.has_access(AccessLevel::Standard));
        assert!(wallet.has_access(AccessLevel::Admin));
        
        // Downgrade to read-only
        wallet.change_access_level(AccessLevel::ReadOnly);
        
        // Read-only can only do read-only operations
        assert!(wallet.has_access(AccessLevel::ReadOnly));
        assert!(!wallet.has_access(AccessLevel::Standard));
        assert!(!wallet.has_access(AccessLevel::Admin));
    }
    
    #[test]
    fn test_wallet_manager() {
        let wallet = WalletManager::connect_wallet(
            "0xaddress".to_string(),
            "0xpubkey".to_string(),
        );
        
        assert_eq!(wallet.address, "0xaddress");
        assert_eq!(wallet.public_key, "0xpubkey");
    }
}
