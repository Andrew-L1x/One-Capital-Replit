use borsh::{BorshDeserialize, BorshSerialize};
use l1x_sdk::contract;

#[derive(BorshSerialize, BorshDeserialize)]
pub struct Contract;

#[contract]
impl Contract {
    pub fn new() {}
    
    pub fn hello() -> bool {
        true
    }
}