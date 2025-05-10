/**
 * Contract ABI definitions for One Capital Smart Contracts
 * These ABIs enable interaction with Ethereum smart contracts
 */

// OneCapitalVault ABI
export const VaultABI = [
  // View functions
  "function getVault(uint256 vaultId) view returns (tuple(string name, string description, address owner, uint256 createdAt, uint256 lastRebalance, uint256 driftThresholdBasisPoints, uint256 rebalanceIntervalSeconds, bool isActive))",
  "function getAllocations(uint256 vaultId) view returns (tuple(address assetAddress, string assetSymbol, uint256 targetPercentage, uint256 currentPercentage, uint256 lastRebalanced)[])",
  "function getTakeProfitSettings(uint256 vaultId) view returns (tuple(uint8 strategyType, uint256 targetPercentage, uint256 intervalSeconds, uint256 lastExecution, uint256 baselineValue, bool isActive))",
  "function needsRebalancing(uint256 vaultId) view returns (bool)",
  "function shouldTakeProfit(uint256 vaultId) view returns (bool)",
  
  // Transaction functions
  "function createVault(string name, string description, uint256 driftThresholdBasisPoints) returns (uint256)",
  "function updateVault(uint256 vaultId, string name, string description, uint256 driftThresholdBasisPoints, uint256 rebalanceIntervalSeconds, bool isActive)",
  "function setAllocation(uint256 vaultId, address assetAddress, string assetSymbol, uint256 targetPercentage)",
  "function setTakeProfitStrategy(uint256 vaultId, uint8 strategyType, uint256 targetPercentage, uint256 intervalSeconds)",
  "function rebalance(uint256 vaultId)",
  "function executeTakeProfit(uint256 vaultId) returns (uint256)",
  
  // Events
  "event VaultCreated(uint256 indexed vaultId, address indexed owner, string name)",
  "event VaultUpdated(uint256 indexed vaultId, address indexed owner)",
  "event AllocationUpdated(uint256 indexed vaultId, string assetSymbol, uint256 targetPercentage)",
  "event VaultRebalanced(uint256 indexed vaultId, uint256 timestamp)",
  "event TakeProfitExecuted(uint256 indexed vaultId, uint256 profitAmount)"
];

// CrossChainBridge ABI
export const BridgeABI = [
  // View functions
  "function getSwapQuote(string sourceChain, string targetChain, string sourceAsset, string targetAsset, uint256 amount) view returns (tuple(string sourceAsset, string targetAsset, uint256 sourceAmount, uint256 targetAmount, uint256 fee, uint256 maxSlippageBps, uint256 validUntil))",
  "function getSwapStatus(uint256 requestId) view returns (tuple(uint256 requestId, address sender, string sourceChain, string targetChain, string sourceAsset, string targetAsset, uint256 amount, uint256 maxSlippageBps, string targetAddress, uint256 timestamp, uint8 status, string sourceTxHash, string targetTxHash))",
  "function getUserSwaps(address user) view returns (tuple(uint256 requestId, address sender, string sourceChain, string targetChain, string sourceAsset, string targetAsset, uint256 amount, uint256 maxSlippageBps, string targetAddress, uint256 timestamp, uint8 status, string sourceTxHash, string targetTxHash)[])",
  "function getLiquidity(string asset) view returns (uint256)",
  "function getSupportedChains() view returns (string[])",
  "function getSupportedAssets(string chain) view returns (string[])",
  
  // Transaction functions
  "function initiateSwap(string targetChain, string sourceAsset, string targetAsset, uint256 amount, uint256 maxSlippageBps, string targetAddress) payable returns (uint256)",
  
  // Events
  "event SwapInitiated(uint256 indexed requestId, address indexed sender, string sourceAsset, string targetAsset, uint256 amount)",
  "event SwapStatusUpdated(uint256 indexed requestId, uint8 status, string sourceTxHash, string targetTxHash)"
];

// PriceFeedOracle ABI
export const PriceOracleABI = [
  // View functions
  "function getPrice(string symbol) view returns (tuple(string symbol, uint256 price, uint256 updatedAt, address provider, bytes signature))",
  "function getPrices(string[] symbols) view returns (tuple(string symbol, uint256 price, uint256 updatedAt, address provider, bytes signature)[])",
  "function getPriceHistory(string symbol, uint256 count) view returns (tuple(string symbol, uint256 price, uint256 timestamp)[])",
  "function getTWAP(string symbol, uint256 periodSeconds) view returns (uint256)",
  "function getActiveAuthorities() view returns (tuple(address authAddress, string name, bool active, uint256 addedAt)[])",
  "function getHeartbeatStatus() view returns (uint256, bool)",
  
  // Transaction functions (admin only)
  "function updatePrice(string symbol, uint256 price, bytes signature)",
  "function updatePrices(string[] symbols, uint256[] prices)",
  "function addAuthority(address authAddress, string name)",
  "function removeAuthority(address authAddress)",
  "function disableAuthority(address authAddress)",
  "function enableAuthority(address authAddress)",
  
  // Events
  "event PriceUpdated(string indexed symbol, uint256 price, address indexed provider, uint256 timestamp)",
  "event AuthorityAdded(address indexed authAddress, string name, uint256 timestamp)",
  "event AuthorityRemoved(address indexed authAddress, uint256 timestamp)"
];

// Contract address structure
export interface ContractAddressMap {
  Vault: string;
  Bridge: string;
  PriceOracle: string;
}

// Contract addresses on different networks
// These will be populated after deployment
export const ContractAddresses: Record<number, ContractAddressMap> = {
  // Ethereum Mainnet
  1: {
    Vault: "",
    Bridge: "",
    PriceOracle: ""
  },
  // Ethereum Goerli Testnet
  5: {
    Vault: "",
    Bridge: "",
    PriceOracle: ""
  },
  // L1X Mainnet
  1776: {
    Vault: "",
    Bridge: "",
    PriceOracle: ""
  },
  // L1X Testnet
  1777: {
    Vault: "",
    Bridge: "",
    PriceOracle: ""
  }
};

/**
 * Updates the contract addresses for a specific network
 * @param chainId Network chain ID
 * @param addresses Contract addresses
 */
export const setContractAddresses = (
  chainId: number, 
  addresses: Partial<ContractAddressMap>
) => {
  if (!ContractAddresses[chainId]) {
    ContractAddresses[chainId] = {
      Vault: "",
      Bridge: "",
      PriceOracle: ""
    };
  }
  
  if (addresses.Vault) {
    ContractAddresses[chainId].Vault = addresses.Vault;
  }
  
  if (addresses.Bridge) {
    ContractAddresses[chainId].Bridge = addresses.Bridge;
  }
  
  if (addresses.PriceOracle) {
    ContractAddresses[chainId].PriceOracle = addresses.PriceOracle;
  }
};

/**
 * Gets all contract addresses for a specific network
 * @param chainId Network chain ID
 * @returns Contract addresses for the network
 */
export const getContractAddresses = (chainId: number): ContractAddressMap => {
  return ContractAddresses[chainId] || {
    Vault: "",
    Bridge: "",
    PriceOracle: ""
  };
};

/**
 * Checks if contracts are configured for a specific network
 * @param chainId Network chain ID
 * @returns True if contracts are configured
 */
export const hasContractsForNetwork = (chainId: number): boolean => {
  const addresses = ContractAddresses[chainId];
  if (!addresses) return false;
  
  return !!(addresses.Vault && addresses.Bridge && addresses.PriceOracle);
};

/**
 * Gets a specific contract address for a network
 * @param chainId Network chain ID
 * @param contractName Contract name (Vault, Bridge, or PriceOracle)
 * @returns Contract address
 */
export const getContractAddress = (
  chainId: number, 
  contractName: keyof ContractAddressMap
): string => {
  const addresses = ContractAddresses[chainId];
  if (!addresses) return "";
  
  return addresses[contractName] || "";
};