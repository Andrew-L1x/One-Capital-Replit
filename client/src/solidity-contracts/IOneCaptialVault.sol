// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IOneCapitalVault
 * @dev Interface for One Capital Auto-Investing vault contracts on Ethereum
 * This interface aligns with the on-chain functionality of the L1X vault contracts
 * and supports XTalk Protocol v1.1 for cross-chain operations
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
        uint32 chainId;        // Chain ID where the asset is located (0 = native chain)
        bool crossChainAsset;  // Whether this is a cross-chain asset
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
        bool isCrossChain;     // Whether this vault supports cross-chain assets
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
        bool applyToCrossChain;    // Whether to apply to cross-chain assets
    }
    
    /**
     * @dev Structure for cross-chain asset information
     */
    struct CrossChainAssetInfo {
        uint32 sourceChainId;  // Source chain ID
        address localAddress;  // Address on this chain (if wrapped)
        address remoteAddress; // Address on remote chain
        string symbol;         // Asset symbol
        bool isWrapped;        // Whether this is a wrapped representation
        bytes32 bridgeId;      // Associated XTalk bridge ID
    }
    
    /**
     * @dev Structure for XTalk message processing
     */
    struct XTalkMessageInfo {
        bytes32 messageId;     // XTalk message ID
        uint32 sourceChainId;  // Source chain ID
        uint8 status;          // Message status
        uint256 timestamp;     // Message timestamp
        bytes payload;         // Message payload
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
     * @dev Event emitted when a cross-chain operation is initiated
     */
    event CrossChainOperationInitiated(
        uint256 indexed vaultId, 
        bytes32 indexed xtalkMessageId, 
        string operationType
    );
    
    /**
     * @dev Event emitted when a cross-chain operation is completed
     */
    event CrossChainOperationCompleted(
        uint256 indexed vaultId, 
        bytes32 indexed xtalkMessageId, 
        bool success
    );
    
    /**
     * @dev Creates a new investment vault
     * @param name Vault name
     * @param description Vault description
     * @param driftThresholdBasisPoints Rebalance threshold in basis points
     * @param isCrossChain Whether this vault supports cross-chain assets
     * @return vaultId The ID of the newly created vault
     */
    function createVault(
        string calldata name,
        string calldata description,
        uint256 driftThresholdBasisPoints,
        bool isCrossChain
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
     * @param chainId The chain ID where the asset is located (0 = native chain)
     */
    function setAllocation(
        uint256 vaultId,
        address assetAddress,
        string calldata assetSymbol,
        uint256 targetPercentage,
        uint32 chainId
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
     * @param applyToCrossChain Whether to apply to cross-chain assets
     */
    function setTakeProfitStrategy(
        uint256 vaultId,
        uint8 strategyType,
        uint256 targetPercentage,
        uint256 intervalSeconds,
        bool applyToCrossChain
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
     * @return messageIds Any XTalk message IDs created for cross-chain operations
     */
    function rebalance(uint256 vaultId) external returns (bytes32[] memory messageIds);
    
    /**
     * @dev Checks if a vault needs rebalancing based on drift or time
     * @param vaultId The vault ID to check
     * @return needsRebalance True if rebalancing is needed
     * @return driftedAssets Array of asset symbols that have drifted beyond threshold
     */
    function needsRebalancing(uint256 vaultId) external view returns (
        bool needsRebalance, 
        string[] memory driftedAssets
    );
    
    /**
     * @dev Executes a manual take profit for a vault
     * @param vaultId The vault ID 
     * @return profitAmount The amount of profit taken
     * @return messageIds Any XTalk message IDs created for cross-chain operations
     */
    function executeTakeProfit(uint256 vaultId) external returns (
        uint256 profitAmount,
        bytes32[] memory messageIds
    );
    
    /**
     * @dev Checks if take profit conditions are met for a vault
     * @param vaultId The vault ID to check
     * @return shouldTakeProfit True if take profit conditions are met
     */
    function shouldTakeProfit(uint256 vaultId) external view returns (bool shouldTakeProfit);
    
    /**
     * @dev Registers a cross-chain asset in the vault
     * @param vaultId The vault ID
     * @param sourceChainId The chain ID where the asset is located
     * @param localAddress The wrapped address on this chain (if applicable)
     * @param remoteAddress The address on the remote chain
     * @param symbol The asset symbol
     * @return assetInfo The registered cross-chain asset info
     */
    function registerCrossChainAsset(
        uint256 vaultId,
        uint32 sourceChainId,
        address localAddress,
        address remoteAddress,
        string calldata symbol
    ) external returns (CrossChainAssetInfo memory assetInfo);
    
    /**
     * @dev Gets information about a registered cross-chain asset
     * @param vaultId The vault ID
     * @param symbol The asset symbol
     * @return assetInfo The cross-chain asset information
     */
    function getCrossChainAssetInfo(
        uint256 vaultId,
        string calldata symbol
    ) external view returns (CrossChainAssetInfo memory assetInfo);
    
    /**
     * @dev Process an XTalk message received from another chain
     * This function is called by the XTalkBeacon contract when executing messages
     * @param messageInfo The XTalk message information
     * @return success Whether the message was processed successfully
     */
    function processXTalkMessage(
        XTalkMessageInfo calldata messageInfo
    ) external returns (bool success);
    
    /**
     * @dev Gets the status of an XTalk operation
     * @param messageId The XTalk message ID
     * @return status The current status (0=Pending, 1=Processing, 2=Completed, 3=Failed)
     * @return timestamp When the status was last updated
     */
    function getXTalkOperationStatus(
        bytes32 messageId
    ) external view returns (uint8 status, uint256 timestamp);
}