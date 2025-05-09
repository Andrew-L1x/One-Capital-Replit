use borsh::{BorshDeserialize, BorshSerialize};
use l1x_sdk::{contract, types::U64};

// Storage key for the contract state
const COUNTER_KEY: &[u8] = b"counter";

// Main contract struct
#[derive(BorshSerialize, BorshDeserialize)]
pub struct Contract;

// Contract implementation with L1X-compatible methods
#[contract]
impl Contract {
    // Initialize the contract
    pub fn new() {
        let counter: U64 = 0.into();
        l1x_sdk::storage_write(COUNTER_KEY, &counter.try_to_vec().unwrap());
    }

    // Get the current counter value
    pub fn get_counter() -> U64 {
        match l1x_sdk::storage_read(COUNTER_KEY) {
            Some(bytes) => U64::try_from_slice(&bytes).unwrap(),
            None => {
                0.into()
            }
        }
    }

    // Increment the counter
    pub fn increment_counter() -> U64 {
        let mut counter = Self::get_counter();
        counter.0 += 1;
        l1x_sdk::storage_write(COUNTER_KEY, &counter.try_to_vec().unwrap());
        counter
    }

    // Set the counter to a specific value
    pub fn set_counter(value: U64) -> U64 {
        let old_counter = Self::get_counter();
        l1x_sdk::storage_write(COUNTER_KEY, &value.try_to_vec().unwrap());
        old_counter
    }
}
