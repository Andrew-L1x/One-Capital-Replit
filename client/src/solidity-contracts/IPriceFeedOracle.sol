// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IPriceFeedOracle
 * @dev Interface for One Capital price feed oracle contract
 * This provides price data for all assets supported by the platform
 */
interface IPriceFeedOracle {
    /**
     * @dev Structure for price data
     */
    struct PriceData {
        string symbol;      // Asset symbol (e.g., "BTC")
        uint256 price;      // Price in USD (scaled by 1e8 for precision)
        uint256 updatedAt;  // Last update timestamp
        address provider;   // Provider who updated the price
        bytes signature;    // Optional signature from the provider
    }
    
    /**
     * @dev Structure for price feed authority
     */
    struct PriceFeedAuthority {
        address authAddress; // Authority address
        string name;         // Authority name
        bool active;         // Whether this authority is active
        uint256 addedAt;     // Timestamp when the authority was added
    }
    
    /**
     * @dev Structure for price history record
     */
    struct PriceHistoryRecord {
        string symbol;      // Asset symbol
        uint256 price;      // Price in USD (scaled by 1e8)
        uint256 timestamp;  // Timestamp of the record
    }
    
    /**
     * @dev Event emitted when a price is updated
     */
    event PriceUpdated(
        string indexed symbol,
        uint256 price,
        address indexed provider,
        uint256 timestamp
    );
    
    /**
     * @dev Event emitted when an authority is added
     */
    event AuthorityAdded(
        address indexed authAddress,
        string name,
        uint256 timestamp
    );
    
    /**
     * @dev Event emitted when an authority is removed
     */
    event AuthorityRemoved(
        address indexed authAddress,
        uint256 timestamp
    );
    
    /**
     * @dev Updates the price for a single asset
     * @param symbol Asset symbol
     * @param price Price in USD (scaled by 1e8)
     * @param signature Optional signature for verification
     */
    function updatePrice(
        string calldata symbol,
        uint256 price,
        bytes calldata signature
    ) external;
    
    /**
     * @dev Updates prices for multiple assets
     * @param symbols Array of asset symbols
     * @param prices Array of prices
     */
    function updatePrices(
        string[] calldata symbols,
        uint256[] calldata prices
    ) external;
    
    /**
     * @dev Gets the current price for a single asset
     * @param symbol Asset symbol
     * @return priceData The current price data
     */
    function getPrice(string calldata symbol) external view returns (PriceData memory priceData);
    
    /**
     * @dev Gets the current prices for multiple assets
     * @param symbols Array of asset symbols
     * @return priceDataArray Array of price data
     */
    function getPrices(string[] calldata symbols) external view returns (PriceData[] memory priceDataArray);
    
    /**
     * @dev Gets price history for an asset
     * @param symbol Asset symbol
     * @param count Maximum number of history records to return
     * @return history Array of price history records
     */
    function getPriceHistory(string calldata symbol, uint256 count) external view returns (PriceHistoryRecord[] memory history);
    
    /**
     * @dev Gets the time-weighted average price (TWAP) for an asset
     * @param symbol Asset symbol
     * @param periodSeconds Time period for TWAP calculation
     * @return twapPrice The time-weighted average price
     */
    function getTWAP(string calldata symbol, uint256 periodSeconds) external view returns (uint256 twapPrice);
    
    /**
     * @dev Adds a new price feed authority
     * @param authAddress Authority address
     * @param name Authority name
     */
    function addAuthority(address authAddress, string calldata name) external;
    
    /**
     * @dev Removes a price feed authority
     * @param authAddress Authority address
     */
    function removeAuthority(address authAddress) external;
    
    /**
     * @dev Disables a price feed authority
     * @param authAddress Authority address
     */
    function disableAuthority(address authAddress) external;
    
    /**
     * @dev Enables a price feed authority
     * @param authAddress Authority address
     */
    function enableAuthority(address authAddress) external;
    
    /**
     * @dev Gets all active price feed authorities
     * @return authorities Array of active authorities
     */
    function getActiveAuthorities() external view returns (PriceFeedAuthority[] memory authorities);
    
    /**
     * @dev Gets latest heartbeat status (when the price feed was last updated)
     * @return lastUpdateTime Last update timestamp
     * @return isActive Whether the price feed is considered active
     */
    function getHeartbeatStatus() external view returns (uint256 lastUpdateTime, bool isActive);
}