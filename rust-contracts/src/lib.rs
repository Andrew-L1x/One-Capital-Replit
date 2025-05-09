use borsh::{BorshDeserialize, BorshSerialize};
use l1x_sdk::{contract, types::{U64, U128}};

// Include our new modules
pub mod price_oracle;
pub mod x_swap;

// Storage keys
const STATE_KEY: &[u8] = b"state";
const PRICE_KEY_PREFIX: &[u8] = b"price_";
const SWAP_KEY_PREFIX: &[u8] = b"swap_";

// Original simple counter contract
#[derive(BorshSerialize, BorshDeserialize)]
pub struct Counter;

#[contract]
impl Counter {
    pub fn new() {
        let value: U64 = 0.into();
        let data = value.try_to_vec().unwrap();
        l1x_sdk::storage_write(STATE_KEY, &data);
    }

    pub fn get() -> U64 {
        match l1x_sdk::storage_read(STATE_KEY) {
            Some(data) => U64::try_from_slice(&data).unwrap(),
            None => 0.into(),
        }
    }

    pub fn set(value: U64) {
        let data = value.try_to_vec().unwrap();
        l1x_sdk::storage_write(STATE_KEY, &data);
    }
}

// Price Oracle contract
#[derive(BorshSerialize, BorshDeserialize)]
pub struct PriceOracle;

#[contract]
impl PriceOracle {
    pub fn new() {
        // Initialize the owner as the caller
        let caller = l1x_sdk::signer_account_id();
        let data = caller.try_to_vec().unwrap();
        l1x_sdk::storage_write(b"oracle_owner", &data);
        
        // Store owner as first admin
        let admins_key = [b"oracle_admins_", caller.as_bytes()].concat();
        l1x_sdk::storage_write(&admins_key, &[1]); // 1 = true
    }
    
    pub fn update_price(token: String, price: U128) {
        // Ensure caller is authorized
        let caller = l1x_sdk::signer_account_id();
        let admins_key = [b"oracle_admins_", caller.as_bytes()].concat();
        
        if l1x_sdk::storage_read(&admins_key).is_none() {
            l1x_sdk::panic_utf8(b"Unauthorized: not an admin");
        }
        
        // Store price
        let price_key = [PRICE_KEY_PREFIX, token.as_bytes()].concat();
        let price_data = price.try_to_vec().unwrap();
        l1x_sdk::storage_write(&price_key, &price_data);
        
        // Store timestamp
        let timestamp_key = [b"price_timestamp_", token.as_bytes()].concat();
        let timestamp = l1x_sdk::block_timestamp();
        let timestamp_data = timestamp.try_to_vec().unwrap();
        l1x_sdk::storage_write(&timestamp_key, &timestamp_data);
        
        // Emit event
        let event_data = format!("{{\"token\":\"{}\",\"price\":{}}}", token, price.0);
        l1x_sdk::log_utf8(format!("EVENT_PRICE_UPDATED:{}", event_data).as_bytes());
    }
    
    pub fn get_price(token: String) -> U128 {
        let price_key = [PRICE_KEY_PREFIX, token.as_bytes()].concat();
        
        match l1x_sdk::storage_read(&price_key) {
            Some(data) => U128::try_from_slice(&data).unwrap(),
            None => 0.into(),
        }
    }
    
    pub fn add_admin(admin: String) {
        // Ensure caller is the owner
        let caller = l1x_sdk::signer_account_id();
        let owner_data = l1x_sdk::storage_read(b"oracle_owner").unwrap();
        let owner = String::try_from_slice(&owner_data).unwrap();
        
        if caller != owner {
            l1x_sdk::panic_utf8(b"Unauthorized: not the owner");
        }
        
        // Add admin
        let admins_key = [b"oracle_admins_", admin.as_bytes()].concat();
        l1x_sdk::storage_write(&admins_key, &[1]); // 1 = true
    }
}

// Cross-Chain Swap contract
#[derive(BorshSerialize, BorshDeserialize)]
pub struct XSwap;

#[contract]
impl XSwap {
    pub fn new() {
        // Initialize owner
        let caller = l1x_sdk::signer_account_id();
        let data = caller.try_to_vec().unwrap();
        l1x_sdk::storage_write(b"xswap_owner", &data);
        
        // Store owner as first admin
        let admins_key = [b"xswap_admins_", caller.as_bytes()].concat();
        l1x_sdk::storage_write(&admins_key, &[1]); // 1 = true
        
        // Initialize next swap ID
        let next_id: u64 = 1;
        let next_id_data = next_id.try_to_vec().unwrap();
        l1x_sdk::storage_write(b"xswap_next_id", &next_id_data);
    }
    
    pub fn cross_chain_swap(from_asset: String, to_asset: String, amount: U128, target_chain_id: U64) -> U64 {
        // Ensure caller has sufficient balance (simplified)
        let caller = l1x_sdk::signer_account_id();
        let balance_key = [b"balance_", caller.as_bytes(), b"_", from_asset.as_bytes()].concat();
        
        let balance = match l1x_sdk::storage_read(&balance_key) {
            Some(data) => U128::try_from_slice(&data).unwrap(),
            None => 0.into(),
        };
        
        if balance.0 < amount.0 {
            l1x_sdk::panic_utf8(b"Insufficient balance");
        }
        
        // Deduct balance
        let new_balance = U128(balance.0 - amount.0);
        let balance_data = new_balance.try_to_vec().unwrap();
        l1x_sdk::storage_write(&balance_key, &balance_data);
        
        // Get and increment swap ID
        let next_id_data = l1x_sdk::storage_read(b"xswap_next_id").unwrap();
        let swap_id = u64::try_from_slice(&next_id_data).unwrap();
        
        let next_id = swap_id + 1;
        let next_id_data = next_id.try_to_vec().unwrap();
        l1x_sdk::storage_write(b"xswap_next_id", &next_id_data);
        
        // Store swap data
        let swap_key = [SWAP_KEY_PREFIX, &swap_id.to_le_bytes()].concat();
        let swap_data = format!(
            "{{\"id\":{},\"from_asset\":\"{}\",\"to_asset\":\"{}\",\"amount\":{},\"target_chain_id\":{},\"initiator\":\"{}\",\"status\":\"pending\",\"created_at\":{}}}",
            swap_id, from_asset, to_asset, amount.0, target_chain_id.0, caller, l1x_sdk::block_timestamp()
        );
        l1x_sdk::storage_write(&swap_key, swap_data.as_bytes());
        
        // Emit event
        let event_data = format!(
            "{{\"id\":{},\"fromAsset\":\"{}\",\"toAsset\":\"{}\",\"amount\":{},\"targetChainId\":{}}}",
            swap_id, from_asset, to_asset, amount.0, target_chain_id.0
        );
        l1x_sdk::log_utf8(format!("EVENT_SWAP_REQUESTED:{}", event_data).as_bytes());
        
        // Return swap ID
        swap_id.into()
    }
    
    pub fn complete_swap(swap_id: U64, received_amount: U128) {
        // Ensure caller is authorized (simplified)
        let caller = l1x_sdk::signer_account_id();
        let admins_key = [b"xswap_admins_", caller.as_bytes()].concat();
        
        if l1x_sdk::storage_read(&admins_key).is_none() {
            l1x_sdk::panic_utf8(b"Unauthorized: not an admin");
        }
        
        // Get swap data
        let swap_key = [SWAP_KEY_PREFIX, &swap_id.0.to_le_bytes()].concat();
        let swap_data = match l1x_sdk::storage_read(&swap_key) {
            Some(data) => String::from_utf8(data).unwrap(),
            None => l1x_sdk::panic_utf8(b"Swap not found"),
        };
        
        // This is a simplified implementation - in a real contract we would parse and update the JSON
        // For this example, we'll just create a new completed status record
        
        // In a real contract, we would:
        // 1. Parse the JSON to get swap details
        // 2. Credit the user with the received tokens
        // 3. Update the swap record
        
        // Emit completion event
        let event_data = format!(
            "{{\"id\":{},\"receivedAmount\":{}}}",
            swap_id.0, received_amount.0
        );
        l1x_sdk::log_utf8(format!("EVENT_SWAP_COMPLETED:{}", event_data).as_bytes());
    }
}
