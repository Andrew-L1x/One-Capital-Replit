use borsh::{BorshDeserialize, BorshSerialize};
use l1x_sdk::{contract, types::U64};

// Storage key
const STATE_KEY: &[u8] = b"state";

// Simple contract that only stores a U64 value
#[derive(BorshSerialize, BorshDeserialize)]
pub struct Contract;

#[contract]
impl Contract {
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
