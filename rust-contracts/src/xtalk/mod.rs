//! XTalk Protocol Implementation for L1X Cross-Chain Communications
//! 
//! This module implements the L1X XTalk Protocol as defined in v1.1, enabling
//! secure and reliable communication between different blockchains. The protocol
//! uses a combination of off-chain XTalk Nodes and on-chain Smart Contracts to 
//! validate, achieve consensus on, and execute cross-chain messages.

use serde::{Deserialize, Serialize};
use borsh::{BorshSerialize, BorshDeserialize};
use l1x_sdk::prelude::*;

/// XTalk Message Status
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub enum XTalkMessageStatus {
    /// Message has been broadcasted on source chain
    Broadcasted,
    
    /// Message has been detected by Listener Validators
    Detected,
    
    /// Message has achieved Listener consensus
    ListenerFinalized,
    
    /// Message has been signed by Signer Validators
    SignerFinalized,
    
    /// Message has been relayed to destination chain
    Relayed,
    
    /// Message has been executed on destination chain
    Executed,
    
    /// Message execution failed
    Failed,
}

/// XTalk Message structure
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct XTalkMessage {
    /// Unique message ID
    pub id: String,
    
    /// Source chain ID
    pub source_chain_id: u32,
    
    /// Destination chain ID
    pub destination_chain_id: u32,
    
    /// Target contract address on destination chain
    pub target_contract: String,
    
    /// Target function to call on destination contract
    pub target_function: String,
    
    /// Message payload as bytes
    pub payload: Vec<u8>,
    
    /// Fee paid for message relay
    pub fee: u128,
    
    /// Timestamp when message was created
    pub timestamp: u64,
    
    /// Current message status
    pub status: XTalkMessageStatus,
    
    /// Block number on source chain where message was created
    pub source_block_number: u64,
    
    /// Transaction hash on source chain
    pub source_tx_hash: String,
    
    /// Nonce to prevent replay attacks
    pub nonce: u64,
    
    /// Sender address on source chain
    pub sender: String,
}

/// XTalk message with validator signatures
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct XTalkSignedMessage {
    /// The original XTalk message
    pub message: XTalkMessage,
    
    /// Aggregated validator signatures
    pub signatures: Vec<ValidatorSignature>,
    
    /// Required number of signatures for finality
    pub required_signatures: u32,
}

/// Validator signature for an XTalk message
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct ValidatorSignature {
    /// Validator ID
    pub validator_id: String,
    
    /// Validator role (Listener, Signer, Relayer)
    pub role: ValidatorRole,
    
    /// The signature data
    pub signature: Vec<u8>,
    
    /// Timestamp when signature was created
    pub timestamp: u64,
}

/// Validator roles in the XTalk protocol
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub enum ValidatorRole {
    /// Detects new messages on source chains
    Listener,
    
    /// Signs validated messages
    Signer,
    
    /// Delivers messages to destination chains
    Relayer,
}

/// Error types for XTalk operations
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub enum XTalkError {
    /// Not enough signatures
    InsufficientSignatures,
    
    /// Invalid signature
    InvalidSignature,
    
    /// Message not found
    MessageNotFound,
    
    /// Operation timed out
    Timeout,
    
    /// Invalid chain ID
    InvalidChain,
    
    /// Server error
    ServerError(String),
    
    /// Operation not permitted
    NotPermitted,
    
    /// Message already processed
    DuplicateMessage,
    
    /// Invalid validator
    InvalidValidator,
}

/// Swap specific message structures for use with XTalk for cross-chain swaps

/// Cross-chain swap request message
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct XTalkSwapRequest {
    /// Source asset identifier
    pub source_asset: String,
    
    /// Target asset identifier
    pub target_asset: String,
    
    /// Amount to swap (in smallest units)
    pub amount: u128,
    
    /// Maximum slippage in basis points (1% = 100 basis points)
    pub slippage_bps: u32,
    
    /// Recipient address on target chain
    pub recipient: String,
}

/// Cross-chain swap result
#[derive(Debug, Clone, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct XTalkSwapResult {
    /// Swap transaction ID
    pub tx_id: String,
    
    /// Source asset identifier
    pub source_asset: String,
    
    /// Amount sent from source
    pub source_amount: u128,
    
    /// Target asset identifier
    pub target_asset: String,
    
    /// Amount received in target
    pub target_amount: u128,
    
    /// Actual exchange rate achieved (in basis points)
    pub actual_rate_bps: u64,
    
    /// Fee paid (in smallest units)
    pub fee: u128,
    
    /// Timestamp when the swap completed
    pub completed_at: u64,
}

/// XTalk Source Registry Contract on L1X
/// Maps source chain IDs to specific FlowContract addresses
#[derive(BorshSerialize, BorshDeserialize)]
pub struct SourceRegistry {
    /// Mapping from source chain ID to FlowContract address
    chain_to_flow_contract: std::collections::HashMap<u32, String>,
    
    /// Owner of the registry
    owner: String,
}

const SOURCE_REGISTRY_KEY: &[u8] = b"SOURCE_REGISTRY";

#[l1x_sdk::contract]
impl SourceRegistry {
    fn load() -> Self {
        match l1x_sdk::storage_read(SOURCE_REGISTRY_KEY) {
            Some(bytes) => Self::try_from_slice(&bytes).unwrap(),
            None => panic!("Source Registry not initialized"),
        }
    }

    fn save(&self) {
        l1x_sdk::storage_write(SOURCE_REGISTRY_KEY, &self.try_to_vec().unwrap());
    }

    pub fn new(owner: String) {
        let contract = Self {
            chain_to_flow_contract: std::collections::HashMap::new(),
            owner,
        };
        contract.save();
    }
    
    /// Register a FlowContract for a source chain
    pub fn register_flow_contract(chain_id: u32, flow_contract: String) -> String {
        let mut contract = Self::load();
        
        // Only owner can register flow contracts
        if l1x_sdk::env::signer_account_id() != contract.owner {
            return "Unauthorized".to_string();
        }
        
        contract.chain_to_flow_contract.insert(chain_id, flow_contract.clone());
        contract.save();
        
        format!("Registered FlowContract {} for chain {}", flow_contract, chain_id)
    }
    
    /// Get the FlowContract address for a source chain
    pub fn get_flow_contract(chain_id: u32) -> String {
        let contract = Self::load();
        
        match contract.chain_to_flow_contract.get(&chain_id) {
            Some(address) => address.clone(),
            None => format!("No FlowContract registered for chain {}", chain_id),
        }
    }
}

/// XTalk Consensus Contract on L1X
/// Manages consensus for cross-chain messages
#[derive(BorshSerialize, BorshDeserialize)]
pub struct XTalkConsensusContract {
    /// Mapping from message ID to listener votes (validator ID -> vote)
    listener_votes: std::collections::HashMap<String, std::collections::HashMap<String, bool>>,
    
    /// Mapping from message ID to signer signatures (validator ID -> signature)
    signer_signatures: std::collections::HashMap<String, std::collections::HashMap<String, ValidatorSignature>>,
    
    /// Messages that have achieved listener consensus
    listener_finalized_messages: std::collections::HashMap<String, XTalkMessage>,
    
    /// Messages that have achieved signer consensus
    signer_finalized_messages: std::collections::HashMap<String, XTalkSignedMessage>,
    
    /// Registered validators (validator ID -> role)
    validators: std::collections::HashMap<String, ValidatorRole>,
    
    /// Required number of validator signatures for each role
    threshold: std::collections::HashMap<ValidatorRole, u32>,
    
    /// Owner of the contract
    owner: String,
}

const XTALK_CONSENSUS_KEY: &[u8] = b"XTALK_CONSENSUS";

#[l1x_sdk::contract]
impl XTalkConsensusContract {
    fn load() -> Self {
        match l1x_sdk::storage_read(XTALK_CONSENSUS_KEY) {
            Some(bytes) => Self::try_from_slice(&bytes).unwrap(),
            None => panic!("XTalk Consensus Contract not initialized"),
        }
    }

    fn save(&self) {
        l1x_sdk::storage_write(XTALK_CONSENSUS_KEY, &self.try_to_vec().unwrap());
    }

    pub fn new(owner: String) {
        let mut contract = Self {
            listener_votes: std::collections::HashMap::new(),
            signer_signatures: std::collections::HashMap::new(),
            listener_finalized_messages: std::collections::HashMap::new(),
            signer_finalized_messages: std::collections::HashMap::new(),
            validators: std::collections::HashMap::new(),
            threshold: std::collections::HashMap::new(),
            owner,
        };
        
        // Set default thresholds
        contract.threshold.insert(ValidatorRole::Listener, 3); // Need 3 listeners to agree
        contract.threshold.insert(ValidatorRole::Signer, 5);   // Need 5 signers to sign
        contract.threshold.insert(ValidatorRole::Relayer, 1);  // Need 1 relayer
        
        contract.save();
    }
    
    /// Register a validator
    pub fn register_validator(validator_id: String, role: ValidatorRole) -> String {
        let mut contract = Self::load();
        
        // Only owner can register validators
        if l1x_sdk::env::signer_account_id() != contract.owner {
            return "Unauthorized".to_string();
        }
        
        contract.validators.insert(validator_id.clone(), role);
        contract.save();
        
        format!("Registered validator {} as {:?}", validator_id, role)
    }
    
    /// Submit a listener vote for a message
    pub fn submit_listener_vote(message_id: String, message_data: String, vote: bool) -> String {
        let mut contract = Self::load();
        
        let validator_id = l1x_sdk::env::signer_account_id();
        
        // Verify validator is registered as a Listener
        if contract.validators.get(&validator_id) != Some(&ValidatorRole::Listener) {
            return "Not a registered Listener validator".to_string();
        }
        
        // Initialize votes map for this message if it doesn't exist
        if !contract.listener_votes.contains_key(&message_id) {
            contract.listener_votes.insert(message_id.clone(), std::collections::HashMap::new());
        }
        
        // Record the vote
        let votes = contract.listener_votes.get_mut(&message_id).unwrap();
        votes.insert(validator_id.clone(), vote);
        
        // Check if we've reached consensus
        let threshold = *contract.threshold.get(&ValidatorRole::Listener).unwrap();
        let positive_votes = votes.values().filter(|&&v| v).count() as u32;
        
        if positive_votes >= threshold {
            // Consensus reached, mark message as listener finalized
            let message: XTalkMessage = serde_json::from_str(&message_data)
                .unwrap_or_else(|_| panic!("Invalid message data"));
                
            contract.listener_finalized_messages.insert(message_id.clone(), message);
            
            // TODO: Actually notify the FlowContract about the finalized message
            // This would be an external call in a real implementation
            
            contract.save();
            format!("Listener consensus achieved for message {}", message_id)
        } else {
            contract.save();
            format!("Vote recorded for message {}, need {} more votes", 
                message_id, threshold - positive_votes)
        }
    }
    
    /// Submit a signer signature for a message
    pub fn submit_signature(message_id: String, signature: Vec<u8>) -> String {
        let mut contract = Self::load();
        
        let validator_id = l1x_sdk::env::signer_account_id();
        
        // Verify validator is registered as a Signer
        if contract.validators.get(&validator_id) != Some(&ValidatorRole::Signer) {
            return "Not a registered Signer validator".to_string();
        }
        
        // Check if message has achieved listener consensus
        if !contract.listener_finalized_messages.contains_key(&message_id) {
            return format!("Message {} has not achieved listener consensus", message_id);
        }
        
        // Initialize signatures map for this message if it doesn't exist
        if !contract.signer_signatures.contains_key(&message_id) {
            contract.signer_signatures.insert(message_id.clone(), std::collections::HashMap::new());
        }
        
        // Record the signature
        let signatures = contract.signer_signatures.get_mut(&message_id).unwrap();
        signatures.insert(validator_id.clone(), ValidatorSignature {
            validator_id: validator_id.clone(),
            role: ValidatorRole::Signer,
            signature,
            timestamp: l1x_sdk::env::block_timestamp(),
        });
        
        // Check if we've reached consensus
        let threshold = *contract.threshold.get(&ValidatorRole::Signer).unwrap();
        let signature_count = signatures.len() as u32;
        
        if signature_count >= threshold {
            // Consensus reached, mark message as signer finalized
            let message = contract.listener_finalized_messages.get(&message_id).unwrap().clone();
            
            // Collect all signatures
            let sig_vec: Vec<ValidatorSignature> = signatures.values().cloned().collect();
            
            // Create signed message
            let signed_message = XTalkSignedMessage {
                message,
                signatures: sig_vec,
                required_signatures: threshold,
            };
            
            contract.signer_finalized_messages.insert(message_id.clone(), signed_message);
            
            // TODO: Actually notify the FlowContract about the finalized signatures
            // This would be an external call in a real implementation
            
            contract.save();
            format!("Signer consensus achieved for message {}", message_id)
        } else {
            contract.save();
            format!("Signature recorded for message {}, need {} more signatures", 
                message_id, threshold - signature_count)
        }
    }
    
    /// Get a message that has achieved listener consensus
    pub fn get_listener_finalized_message(message_id: String) -> String {
        let contract = Self::load();
        
        match contract.listener_finalized_messages.get(&message_id) {
            Some(message) => serde_json::to_string(message)
                .unwrap_or_else(|_| "Error serializing message".to_string()),
            None => format!("Message {} not found or not finalized by listeners", message_id),
        }
    }
    
    /// Get a message that has achieved signer consensus
    pub fn get_signer_finalized_message(message_id: String) -> String {
        let contract = Self::load();
        
        match contract.signer_finalized_messages.get(&message_id) {
            Some(message) => serde_json::to_string(message)
                .unwrap_or_else(|_| "Error serializing message".to_string()),
            None => format!("Message {} not found or not finalized by signers", message_id),
        }
    }
}

/// XTalk Flow Contract on L1X
/// Processes messages for a specific source chain
#[derive(BorshSerialize, BorshDeserialize)]
pub struct FlowContract {
    /// Stored event data from source chain
    event_data: std::collections::HashMap<String, Vec<u8>>,
    
    /// Message hashes for signer validation
    message_hashes: std::collections::HashMap<String, Vec<u8>>,
    
    /// Owner of the contract
    owner: String,
    
    /// Parent consensus contract
    consensus_contract: String,
    
    /// Source chain ID
    source_chain_id: u32,
}

const FLOW_CONTRACT_KEY: &[u8] = b"FLOW_CONTRACT";

#[l1x_sdk::contract]
impl FlowContract {
    fn load() -> Self {
        match l1x_sdk::storage_read(FLOW_CONTRACT_KEY) {
            Some(bytes) => Self::try_from_slice(&bytes).unwrap(),
            None => panic!("Flow Contract not initialized"),
        }
    }

    fn save(&self) {
        l1x_sdk::storage_write(FLOW_CONTRACT_KEY, &self.try_to_vec().unwrap());
    }

    pub fn new(owner: String, consensus_contract: String, source_chain_id: u32) {
        let contract = Self {
            event_data: std::collections::HashMap::new(),
            message_hashes: std::collections::HashMap::new(),
            owner,
            consensus_contract,
            source_chain_id,
        };
        contract.save();
    }
    
    /// Store validated event data from source chain
    pub fn store_event_data(message_id: String, data: Vec<u8>) -> String {
        let mut contract = Self::load();
        
        // Check if caller is the consensus contract
        if l1x_sdk::env::predecessor_account_id() != contract.consensus_contract {
            return "Unauthorized: only consensus contract can store event data".to_string();
        }
        
        // Store the event data
        contract.event_data.insert(message_id.clone(), data.clone());
        
        // Generate message hash for signers
        // In a real implementation, this would be a deterministic hash based on
        // the message content and destination details
        let message_hash = l1x_sdk::env::keccak256(&data);
        contract.message_hashes.insert(message_id.clone(), message_hash.to_vec());
        
        contract.save();
        
        format!("Event data stored for message {}", message_id)
    }
    
    /// Get the hash that Signer Validators need to sign
    pub fn get_message_hash(message_id: String) -> Vec<u8> {
        let contract = Self::load();
        
        match contract.message_hashes.get(&message_id) {
            Some(hash) => hash.clone(),
            None => panic!("Message hash not found for {}", message_id),
        }
    }
    
    /// Create relay payload for Relayer Validators
    pub fn prepare_relay_payload(message_id: String) -> String {
        let contract = Self::load();
        
        // Check if we have stored event data for this message
        if !contract.event_data.contains_key(&message_id) {
            return format!("No event data found for message {}", message_id);
        }
        
        // In a real implementation, this would fetch the signed message from
        // the consensus contract and package it with the event data
        
        // For now, just return a message indicating success
        format!("Relay payload prepared for message {}", message_id)
    }
}

/// XTalk client for interaction with the XTalk protocol
pub struct XTalkClient;

impl XTalkClient {
    /// Create a cross-chain message request
    pub fn create_message(
        destination_chain_id: u32,
        target_contract: &str,
        target_function: &str,
        payload: Vec<u8>,
    ) -> String {
        // In a real implementation, this would interact with the XTalkBeacon
        // contract on the source chain to register the message
        
        format!("Message created for chain {} targeting contract {}.{}",
            destination_chain_id, target_contract, target_function)
    }
    
    /// Check message status
    pub fn check_message_status(message_id: &str) -> XTalkMessageStatus {
        // In a real implementation, this would query the appropriate contracts
        // to determine the current status of the message
        
        XTalkMessageStatus::Broadcasted
    }
    
    /// Execute a cross-chain swap via XTalk
    pub fn execute_swap(
        swap_request: &XTalkSwapRequest,
        destination_chain_id: u32,
    ) -> Result<String, XTalkError> {
        // Serialize the swap request
        let payload = serde_json::to_vec(swap_request)
            .map_err(|e| XTalkError::ServerError(e.to_string()))?;
        
        // Create the cross-chain message
        let message_id = Self::create_message(
            destination_chain_id,
            "TokenSwapContract", // Target contract on destination chain
            "executeSwap",       // Target function
            payload,
        );
        
        Ok(message_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_message_creation() {
        let payload = vec![1, 2, 3, 4];
        let message_id = XTalkClient::create_message(
            1, // Ethereum
            "0xTargetContract",
            "targetFunction",
            payload,
        );
        
        assert!(!message_id.is_empty());
    }
    
    #[test]
    fn test_message_status() {
        let status = XTalkClient::check_message_status("test_message_id");
        
        assert_eq!(status, XTalkMessageStatus::Broadcasted);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_price_quote() {
        let quote = XTalkClient::get_price_quote("BTC", "ETH", 1_00000000).unwrap();
        
        assert_eq!(quote.source_asset, "BTC");
        assert_eq!(quote.target_asset, "ETH");
        assert!(quote.expires_at > l1x_sdk::env::block_timestamp());
    }
    
    #[test]
    fn test_execute_swap() {
        let swap_request = XTalkSwapRequest {
            source_asset: "BTC".to_string(),
            target_asset: "ETH".to_string(),
            amount: 1_00000000, // 1 BTC
            slippage_bps: 50,   // 0.5% slippage
        };
        
        let result = XTalkClient::execute_swap(&swap_request).unwrap();
        
        assert_eq!(result.source_asset, "BTC");
        assert_eq!(result.target_asset, "ETH");
        assert_eq!(result.source_amount, 1_00000000);
        assert!(result.fee > 0);
    }
    
    #[test]
    fn test_asset_price() {
        let btc_price = XTalkClient::get_asset_price("BTC").unwrap();
        let eth_price = XTalkClient::get_asset_price("ETH").unwrap();
        
        assert!(btc_price > 0);
        assert!(eth_price > 0);
        
        // Invalid asset should return an error
        let invalid_result = XTalkClient::get_asset_price("INVALID");
        assert!(invalid_result.is_err());
    }
}
