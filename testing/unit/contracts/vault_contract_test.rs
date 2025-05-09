#[cfg(test)]
mod tests {
    use super::*;

    // Mock environment for testing
    struct MockEnv {
        caller: Address,
        balance: u128,
        allocations: Vec<(Address, u8)>,
    }

    impl MockEnv {
        fn new(caller: Address, balance: u128) -> Self {
            MockEnv {
                caller,
                balance,
                allocations: Vec::new(),
            }
        }

        fn add_allocation(&mut self, asset: Address, percentage: u8) {
            self.allocations.push((asset, percentage));
        }
    }

    #[test]
    fn test_create_vault() {
        // Test address for the caller
        let caller = Address::from([1u8; 20]); // Mock address
        
        // Setup test environment
        let mut env = MockEnv::new(caller, 0);
        
        // Create a new vault
        let vault_params = VaultParams {
            name: "Test Vault".to_string(),
            description: "A vault for testing".to_string(),
            rebalance_threshold: 5,
            is_automated: true,
        };
        
        let vault_id = create_vault(&vault_params, env.caller);
        
        // Verify vault was created with correct parameters
        let vault = get_vault(vault_id).unwrap();
        assert_eq!(vault.name, vault_params.name);
        assert_eq!(vault.description, vault_params.description);
        assert_eq!(vault.rebalance_threshold, vault_params.rebalance_threshold);
        assert_eq!(vault.is_automated, vault_params.is_automated);
        assert_eq!(vault.owner, env.caller);
        assert_eq!(vault.balance, 0);
    }

    #[test]
    fn test_deposit() {
        let caller = Address::from([1u8; 20]);
        let mut env = MockEnv::new(caller, 1000);
        
        // Create a vault
        let vault_params = VaultParams {
            name: "Deposit Test Vault".to_string(),
            description: "Testing deposits".to_string(),
            rebalance_threshold: 3,
            is_automated: true,
        };
        let vault_id = create_vault(&vault_params, env.caller);
        
        // Deposit funds
        let deposit_amount = 500;
        let result = deposit_to_vault(vault_id, deposit_amount, env.caller);
        
        // Verify deposit was successful
        assert!(result.is_ok());
        
        // Verify vault balance was updated
        let vault = get_vault(vault_id).unwrap();
        assert_eq!(vault.balance, deposit_amount);
    }

    #[test]
    fn test_withdraw() {
        let caller = Address::from([1u8; 20]);
        let mut env = MockEnv::new(caller, 1000);
        
        // Create a vault and deposit funds
        let vault_id = create_vault(
            &VaultParams {
                name: "Withdraw Test Vault".to_string(),
                description: "Testing withdrawals".to_string(),
                rebalance_threshold: 3,
                is_automated: true,
            },
            env.caller,
        );
        
        deposit_to_vault(vault_id, 800, env.caller).unwrap();
        
        // Withdraw funds
        let withdraw_amount = 300;
        let result = withdraw_from_vault(vault_id, withdraw_amount, env.caller);
        
        // Verify withdrawal was successful
        assert!(result.is_ok());
        
        // Verify vault balance was updated
        let vault = get_vault(vault_id).unwrap();
        assert_eq!(vault.balance, 500); // 800 - 300 = 500
    }

    #[test]
    fn test_withdraw_insufficient_balance() {
        let caller = Address::from([1u8; 20]);
        let mut env = MockEnv::new(caller, 1000);
        
        // Create a vault and deposit funds
        let vault_id = create_vault(
            &VaultParams {
                name: "Insufficient Balance Test".to_string(),
                description: "Testing withdrawal limits".to_string(),
                rebalance_threshold: 3,
                is_automated: true,
            },
            env.caller,
        );
        
        deposit_to_vault(vault_id, 500, env.caller).unwrap();
        
        // Attempt to withdraw more than balance
        let withdraw_amount = 700;
        let result = withdraw_from_vault(vault_id, withdraw_amount, env.caller);
        
        // Verify withdrawal fails with appropriate error
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Insufficient balance for withdrawal");
        
        // Verify vault balance remains unchanged
        let vault = get_vault(vault_id).unwrap();
        assert_eq!(vault.balance, 500);
    }

    #[test]
    fn test_set_allocation() {
        let caller = Address::from([1u8; 20]);
        let mut env = MockEnv::new(caller, 1000);
        
        // Create a vault
        let vault_id = create_vault(
            &VaultParams {
                name: "Allocation Test Vault".to_string(),
                description: "Testing allocations".to_string(),
                rebalance_threshold: 3,
                is_automated: true,
            },
            env.caller,
        );
        
        // Set allocations for different assets
        let btc_address = Address::from([2u8; 20]);
        let eth_address = Address::from([3u8; 20]);
        let l1x_address = Address::from([4u8; 20]);
        
        // Add allocations
        set_allocation(vault_id, btc_address, 50, env.caller).unwrap();
        set_allocation(vault_id, eth_address, 30, env.caller).unwrap();
        set_allocation(vault_id, l1x_address, 20, env.caller).unwrap();
        
        // Verify allocations were set correctly
        let allocations = get_allocations(vault_id);
        assert_eq!(allocations.len(), 3);
        
        // Verify individual allocations
        let btc_allocation = allocations.iter().find(|a| a.asset == btc_address).unwrap();
        let eth_allocation = allocations.iter().find(|a| a.asset == eth_address).unwrap();
        let l1x_allocation = allocations.iter().find(|a| a.asset == l1x_address).unwrap();
        
        assert_eq!(btc_allocation.percentage, 50);
        assert_eq!(eth_allocation.percentage, 30);
        assert_eq!(l1x_allocation.percentage, 20);
        
        // Verify total allocation is 100%
        let total = allocations.iter().map(|a| a.percentage).sum::<u8>();
        assert_eq!(total, 100);
    }

    #[test]
    fn test_rebalance() {
        let caller = Address::from([1u8; 20]);
        let mut env = MockEnv::new(caller, 1000);
        
        // Create a vault with allocations and deposit funds
        let vault_id = create_vault(
            &VaultParams {
                name: "Rebalance Test Vault".to_string(),
                description: "Testing rebalancing".to_string(),
                rebalance_threshold: 5,
                is_automated: true,
            },
            env.caller,
        );
        
        deposit_to_vault(vault_id, 1000, env.caller).unwrap();
        
        // Set allocations
        let btc_address = Address::from([2u8; 20]);
        let eth_address = Address::from([3u8; 20]);
        
        set_allocation(vault_id, btc_address, 60, env.caller).unwrap();
        set_allocation(vault_id, eth_address, 40, env.caller).unwrap();
        
        // Simulate price changes causing drift in actual allocations
        simulate_allocation_drift(vault_id, btc_address, 70); // BTC increased to 70%
        simulate_allocation_drift(vault_id, eth_address, 30); // ETH decreased to 30%
        
        // Perform rebalance
        let result = rebalance_vault(vault_id, env.caller);
        
        // Verify rebalance was successful
        assert!(result.is_ok());
        
        // Verify allocations were reset to target percentages
        let allocations = get_allocations(vault_id);
        let btc_allocation = allocations.iter().find(|a| a.asset == btc_address).unwrap();
        let eth_allocation = allocations.iter().find(|a| a.asset == eth_address).unwrap();
        
        assert_eq!(btc_allocation.current_percentage, 60);
        assert_eq!(eth_allocation.current_percentage, 40);
        
        // Verify rebalance history was updated
        let history = get_rebalance_history(vault_id);
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].vault_id, vault_id);
    }

    #[test]
    fn test_unauthorized_operations() {
        let owner = Address::from([1u8; 20]);
        let other_user = Address::from([5u8; 20]);
        let mut env = MockEnv::new(owner, 1000);
        
        // Create a vault as owner
        let vault_id = create_vault(
            &VaultParams {
                name: "Security Test Vault".to_string(),
                description: "Testing access control".to_string(),
                rebalance_threshold: 3,
                is_automated: true,
            },
            env.caller,
        );
        
        // Try to withdraw as another user
        let result = withdraw_from_vault(vault_id, 100, other_user);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Unauthorized: not vault owner");
        
        // Try to set allocation as another user
        let btc_address = Address::from([2u8; 20]);
        let result = set_allocation(vault_id, btc_address, 100, other_user);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Unauthorized: not vault owner");
        
        // Try to rebalance as another user
        let result = rebalance_vault(vault_id, other_user);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Unauthorized: not vault owner");
    }
}

// Helper functions for tests (would be implemented in actual contract)
fn simulate_allocation_drift(vault_id: u64, asset: Address, new_percentage: u8) {
    // This function would simulate price changes affecting allocation percentages
    // In a real implementation, this would be calculated based on market prices
}