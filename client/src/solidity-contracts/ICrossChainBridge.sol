// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ICrossChainBridge
 * @dev Interface for One Capital cross-chain bridge functionality
 * This interface enables cross-chain operations between Ethereum and L1X
 */
interface ICrossChainBridge {
    /**
     * @dev Structure for cross-chain swap requests
     */
    struct SwapRequest {
        uint256 requestId;     // Unique request ID
        address sender;        // Sender address
        string sourceChain;    // Source blockchain (e.g., "ethereum", "l1x")
        string targetChain;    // Target blockchain
        string sourceAsset;    // Source asset symbol (e.g., "ETH", "L1X")
        string targetAsset;    // Target asset symbol
        uint256 amount;        // Amount to swap
        uint256 maxSlippageBps; // Maximum allowed slippage (basis points)
        string targetAddress;  // Target address on destination chain
        uint256 timestamp;     // Request timestamp
        uint8 status;          // Status (0=Pending, 1=Processing, 2=Completed, 3=Failed)
        string sourceTxHash;   // Transaction hash on source chain
        string targetTxHash;   // Transaction hash on target chain
    }
    
    /**
     * @dev Structure for swap quotes
     */
    struct SwapQuote {
        string sourceAsset;    // Source asset symbol
        string targetAsset;    // Target asset symbol
        uint256 sourceAmount;  // Source amount
        uint256 targetAmount;  // Estimated target amount
        uint256 fee;           // Fee amount
        uint256 maxSlippageBps; // Maximum slippage (basis points)
        uint256 validUntil;    // Quote validity timestamp
    }
    
    /**
     * @dev Event emitted when a cross-chain swap is initiated
     */
    event SwapInitiated(
        uint256 indexed requestId,
        address indexed sender,
        string sourceAsset,
        string targetAsset,
        uint256 amount
    );
    
    /**
     * @dev Event emitted when a swap status is updated
     */
    event SwapStatusUpdated(
        uint256 indexed requestId,
        uint8 status,
        string sourceTxHash,
        string targetTxHash
    );
    
    /**
     * @dev Initiates a cross-chain swap
     * @param targetChain Target blockchain
     * @param sourceAsset Source asset symbol
     * @param targetAsset Target asset symbol
     * @param amount Amount to swap
     * @param maxSlippageBps Maximum slippage allowed (in basis points)
     * @param targetAddress Address on target chain to receive funds
     * @return requestId The unique ID for this swap request
     */
    function initiateSwap(
        string calldata targetChain,
        string calldata sourceAsset,
        string calldata targetAsset,
        uint256 amount,
        uint256 maxSlippageBps,
        string calldata targetAddress
    ) external payable returns (uint256 requestId);
    
    /**
     * @dev Gets a quote for a cross-chain swap
     * @param sourceChain Source blockchain
     * @param targetChain Target blockchain
     * @param sourceAsset Source asset symbol
     * @param targetAsset Target asset symbol
     * @param amount Amount to swap
     * @return quote The swap quote
     */
    function getSwapQuote(
        string calldata sourceChain,
        string calldata targetChain,
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
     * @return chains Array of supported blockchain names
     */
    function getSupportedChains() external view returns (string[] memory chains);
    
    /**
     * @dev Gets the supported assets for a specific chain
     * @param chain The blockchain name
     * @return assets Array of supported asset symbols
     */
    function getSupportedAssets(string calldata chain) external view returns (string[] memory assets);
}