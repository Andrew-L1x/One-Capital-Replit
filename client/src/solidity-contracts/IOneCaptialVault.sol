// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IOneCapitalVault
 * @dev Interface for One Capital Auto-Investing vault contracts on Ethereum
 * This interface aligns with the on-chain functionality of the L1X vault contracts
 */
interface IOneCapitalVault {
    /**
     * @dev Structure to hold allocation data for a single asset
     */
    struct AssetAllocation {
        address assetAddress;  // Asset's contract address
        string assetSymbol;    // Asset symbol (e.g., "BTC")
        uint256 targetPercentage; // Target percentage allocation (in basis points, 10000 = 100%)
        uint256 currentPercentage; // Current percentage allocation (in basis points, 10000 = 100%)
        uint256 lastRebalanced; // Timestamp of last rebalance for this asset
    }
    
    /**
     * @dev Structure to hold vault configuration
     */
    struct VaultConfig {
        string name;           // Vault name
        string description;    // Vault description
        address owner;         // Vault owner address
        uint256 createdAt;     // Timestamp when the vault was created
        uint256 lastRebalance; // Timestamp of last rebalance
        uint256 driftThresholdBasisPoints; // Rebalance threshold in basis points (e.g., 300 = 3%)
        uint256 rebalanceIntervalSeconds; // Seconds between scheduled rebalances (0 = no schedule)
        bool isActive;         // Whether the vault is active 
    }
    
    /**
     * @dev Structure for take profit settings
     */
    struct TakeProfitSettings {
        enum StrategyType { MANUAL, PERCENTAGE, TIME }
        
        StrategyType strategyType; // Type of take profit strategy
        uint256 targetPercentage;  // Target gain percentage for PERCENTAGE type (in basis points)
        uint256 intervalSeconds;   // Interval for TIME type (in seconds)
        uint256 lastExecution;     // Last execution timestamp
        uint256 baselineValue;     // Value at time of strategy set/last execution
        bool isActive;             // Whether take profit is active
    }
    
    /**
     * @dev Event emitted when a new vault is created
     */
    event VaultCreated(uint256 indexed vaultId, address indexed owner, string name);
    
    /**
     * @dev Event emitted when a vault's configuration is updated
     */
    event VaultUpdated(uint256 indexed vaultId, address indexed owner);
    
    /**
     * @dev Event emitted when an asset allocation is added or updated
     */
    event AllocationUpdated(uint256 indexed vaultId, string assetSymbol, uint256 targetPercentage);
    
    /**
     * @dev Event emitted when a vault is rebalanced
     */
    event VaultRebalanced(uint256 indexed vaultId, uint256 timestamp);
    
    /**
     * @dev Event emitted when a take profit strategy is executed
     */
    event TakeProfitExecuted(uint256 indexed vaultId, uint256 profitAmount);
    
    /**
     * @dev Creates a new investment vault
     * @param name Vault name
     * @param description Vault description
     * @param driftThresholdBasisPoints Rebalance threshold in basis points
     * @return vaultId The ID of the newly created vault
     */
    function createVault(
        string calldata name,
        string calldata description,
        uint256 driftThresholdBasisPoints
    ) external returns (uint256 vaultId);
    
    /**
     * @dev Updates an existing vault's configuration
     * @param vaultId The vault ID to update
     * @param name New vault name (pass empty string to keep unchanged)
     * @param description New vault description (pass empty string to keep unchanged)
     * @param driftThresholdBasisPoints New drift threshold (pass 0 to keep unchanged)
     * @param rebalanceIntervalSeconds New rebalance interval (pass 0 to keep unchanged)
     * @param isActive New active status (pass true to keep unchanged)
     */
    function updateVault(
        uint256 vaultId,
        string calldata name,
        string calldata description,
        uint256 driftThresholdBasisPoints,
        uint256 rebalanceIntervalSeconds,
        bool isActive
    ) external;
    
    /**
     * @dev Gets a vault's configuration
     * @param vaultId The vault ID to query
     * @return config The vault configuration
     */
    function getVault(uint256 vaultId) external view returns (VaultConfig memory config);
    
    /**
     * @dev Sets an asset allocation for a vault
     * @param vaultId The vault ID
     * @param assetAddress The asset contract address
     * @param assetSymbol The asset symbol
     * @param targetPercentage The target percentage allocation (in basis points)
     */
    function setAllocation(
        uint256 vaultId,
        address assetAddress,
        string calldata assetSymbol,
        uint256 targetPercentage
    ) external;
    
    /**
     * @dev Gets all allocations for a vault
     * @param vaultId The vault ID to query
     * @return allocations The array of asset allocations
     */
    function getAllocations(uint256 vaultId) external view returns (AssetAllocation[] memory allocations);
    
    /**
     * @dev Sets a take profit strategy for a vault
     * @param vaultId The vault ID
     * @param strategyType The strategy type (0=MANUAL, 1=PERCENTAGE, 2=TIME)
     * @param targetPercentage The target gain percentage (for PERCENTAGE type)
     * @param intervalSeconds The interval between executions (for TIME type)
     */
    function setTakeProfitStrategy(
        uint256 vaultId,
        uint8 strategyType,
        uint256 targetPercentage,
        uint256 intervalSeconds
    ) external;
    
    /**
     * @dev Gets take profit settings for a vault
     * @param vaultId The vault ID to query
     * @return settings The take profit settings
     */
    function getTakeProfitSettings(uint256 vaultId) external view returns (TakeProfitSettings memory settings);
    
    /**
     * @dev Executes a manual rebalance for a vault
     * @param vaultId The vault ID to rebalance
     */
    function rebalance(uint256 vaultId) external;
    
    /**
     * @dev Checks if a vault needs rebalancing based on drift or time
     * @param vaultId The vault ID to check
     * @return needsRebalance True if rebalancing is needed
     */
    function needsRebalancing(uint256 vaultId) external view returns (bool needsRebalance);
    
    /**
     * @dev Executes a manual take profit for a vault
     * @param vaultId The vault ID 
     * @return profitAmount The amount of profit taken
     */
    function executeTakeProfit(uint256 vaultId) external returns (uint256 profitAmount);
    
    /**
     * @dev Checks if take profit conditions are met for a vault
     * @param vaultId The vault ID to check
     * @return shouldTakeProfit True if take profit conditions are met
     */
    function shouldTakeProfit(uint256 vaultId) external view returns (bool shouldTakeProfit);
}