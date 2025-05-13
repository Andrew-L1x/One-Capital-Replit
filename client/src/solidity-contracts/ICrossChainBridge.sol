// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ICrossChainBridge
 * @dev Interface for One Capital cross-chain bridge functionality using XTalk Protocol v1.1
 * This contract acts as an XTalkBeacon for cross-chain operations between EVM chains and L1X
 */
interface ICrossChainBridge {
    /**
     * @dev Structure for cross-chain messages
     */
    struct XTalkMessage {
        bytes32 messageId;      // Unique message ID
        uint32 sourceChainId;   // Source chain ID
        uint32 destinationChainId; // Destination chain ID
        address targetContract; // Target contract address on destination chain
        bytes4 targetFunction;  // Target function selector
        bytes payload;          // Message payload
        uint256 fee;            // Fee paid for message relay
        uint256 timestamp;      // Message creation timestamp
        uint8 status;           // Message status
        uint256 sourceBlockNumber; // Block number on source chain
        bytes32 sourceTxHash;   // Tx hash on source chain
        uint256 nonce;          // Nonce to prevent replay attacks
        address sender;         // Sender address
    }
    
    /**
     * @dev Structure for validator signatures
     */
    struct ValidatorSignature {
        address validator;      // Validator address
        uint8 role;             // Validator role (1=Listener, 2=Signer, 3=Relayer)
        bytes signature;        // Signature data
        uint256 timestamp;      // Timestamp when signature was created
    }
    
    /**
     * @dev Structure for cross-chain swap requests
     */
    struct SwapRequest {
        uint256 requestId;      // Unique request ID
        address sender;         // Sender address
        uint32 sourceChainId;   // Source chain ID
        uint32 targetChainId;   // Target chain ID
        string sourceAsset;     // Source asset symbol (e.g., "ETH", "L1X")
        string targetAsset;     // Target asset symbol
        uint256 amount;         // Amount to swap
        uint256 maxSlippageBps; // Maximum allowed slippage (basis points)
        address targetAddress;  // Target address on destination chain
        uint256 timestamp;      // Request timestamp
        uint8 status;           // Status of the swap
        bytes32 sourceTxHash;   // Transaction hash on source chain
        bytes32 targetTxHash;   // Transaction hash on target chain
        bytes32 xtalkMessageId; // Associated XTalk message ID
    }
    
    /**
     * @dev Structure for swap quotes
     */
    struct SwapQuote {
        string sourceAsset;     // Source asset symbol
        string targetAsset;     // Target asset symbol
        uint256 sourceAmount;   // Source amount
        uint256 targetAmount;   // Estimated target amount
        uint256 fee;            // Fee amount
        uint256 maxSlippageBps; // Maximum slippage (basis points)
        uint256 validUntil;     // Quote validity timestamp
    }
    
    /**
     * @dev Event emitted when an XTalk message is broadcasted from this chain
     */
    event XTalkMessageBroadcasted(
        bytes32 indexed messageId,
        uint32 indexed destinationChainId,
        address targetContract,
        bytes4 targetFunction,
        bytes payload,
        address sender
    );
    
    /**
     * @dev Event emitted when an XTalk message is executed on this chain
     */
    event XTalkMessageExecuted(
        bytes32 indexed messageId,
        uint32 indexed sourceChainId,
        address targetContract,
        bytes4 targetFunction,
        bytes payload,
        bool success
    );
    
    /**
     * @dev Event emitted when a cross-chain swap is initiated
     */
    event SwapInitiated(
        uint256 indexed requestId,
        address indexed sender,
        string sourceAsset,
        string targetAsset,
        uint256 amount,
        bytes32 xtalkMessageId
    );
    
    /**
     * @dev Event emitted when a swap status is updated
     */
    event SwapStatusUpdated(
        uint256 indexed requestId,
        uint8 status,
        bytes32 sourceTxHash,
        bytes32 targetTxHash
    );
    
    /**
     * @dev Broadcasts an XTalk message to another chain
     * @param destinationChainId The destination chain ID
     * @param targetContract The target contract address on the destination chain
     * @param targetFunction The function selector to call on the target contract
     * @param payload The call data to pass to the target function
     * @return messageId The unique ID for this message
     */
    function broadcastXTalkMessage(
        uint32 destinationChainId,
        address targetContract,
        bytes4 targetFunction,
        bytes calldata payload
    ) external payable returns (bytes32 messageId);
    
    /**
     * @dev Executes an XTalk message that originated from another chain
     * This function is called by XTalk Relayer Validators after message consensus
     * @param message The XTalk message to execute
     * @param signatures Array of validator signatures that approved this message
     * @return success Whether the message execution was successful
     */
    function executeXTalkMessage(
        XTalkMessage calldata message,
        ValidatorSignature[] calldata signatures
    ) external returns (bool success);
    
    /**
     * @dev Initiates a cross-chain swap using the XTalk protocol
     * @param targetChainId Target blockchain ID
     * @param sourceAsset Source asset symbol
     * @param targetAsset Target asset symbol
     * @param amount Amount to swap
     * @param maxSlippageBps Maximum slippage allowed (in basis points)
     * @param targetAddress Address on target chain to receive funds
     * @return requestId The unique ID for this swap request
     */
    function initiateSwap(
        uint32 targetChainId,
        string calldata sourceAsset,
        string calldata targetAsset,
        uint256 amount,
        uint256 maxSlippageBps,
        address targetAddress
    ) external payable returns (uint256 requestId);
    
    /**
     * @dev Gets a quote for a cross-chain swap
     * @param sourceChainId Source blockchain ID
     * @param targetChainId Target blockchain ID
     * @param sourceAsset Source asset symbol
     * @param targetAsset Target asset symbol
     * @param amount Amount to swap
     * @return quote The swap quote
     */
    function getSwapQuote(
        uint32 sourceChainId,
        uint32 targetChainId,
        string calldata sourceAsset,
        string calldata targetAsset,
        uint256 amount
    ) external view returns (SwapQuote memory quote);
    
    /**
     * @dev Gets the status of a swap request
     * @param requestId The request ID to query
     * @return request The swap request
     */
    function getSwapStatus(uint256 requestId) external view returns (SwapRequest memory request);
    
    /**
     * @dev Gets the status of an XTalk message
     * @param messageId The message ID to query
     * @return message The XTalk message
     */
    function getXTalkMessageStatus(bytes32 messageId) external view returns (XTalkMessage memory message);
    
    /**
     * @dev Gets all swap requests for a user
     * @param user The user address to query
     * @return requests The array of swap requests
     */
    function getUserSwaps(address user) external view returns (SwapRequest[] memory requests);
    
    /**
     * @dev Gets the current total liquidity for a specific asset
     * @param asset The asset symbol to query
     * @return liquidity The total liquidity amount
     */
    function getLiquidity(string calldata asset) external view returns (uint256 liquidity);
    
    /**
     * @dev Gets the supported blockchains
     * @return chainIds Array of supported blockchain IDs
     * @return chainNames Array of supported blockchain names
     */
    function getSupportedChains() external view returns (uint32[] memory chainIds, string[] memory chainNames);
    
    /**
     * @dev Gets the supported assets for a specific chain
     * @param chainId The blockchain ID
     * @return assets Array of supported asset symbols
     */
    function getSupportedAssets(uint32 chainId) external view returns (string[] memory assets);
    
    /**
     * @dev Gets the minimum required signatures for message execution
     * @return minSignatures The minimum number of signatures required
     */
    function getMinRequiredSignatures() external view returns (uint256 minSignatures);
    
    /**
     * @dev Gets the registered XTalk validators
     * @return validators Array of validator addresses
     * @return roles Array of validator roles (1=Listener, 2=Signer, 3=Relayer)
     */
    function getXTalkValidators() external view returns (address[] memory validators, uint8[] memory roles);
}