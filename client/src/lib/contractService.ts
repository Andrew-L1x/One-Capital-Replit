import { ethers } from 'ethers';
import { 
  VaultABI, 
  BridgeABI, 
  PriceOracleABI, 
  getContractAddress 
} from './contractABI';
import { getProvider } from './web3';

// Fix for ethers v6 - BigNumber is now handled differently
const toBigInt = (value: string | number): bigint => {
  return ethers.parseUnits(value.toString(), 'wei');
};

// Extract a number safely from bigint for display
const fromBigInt = (value: bigint): string => {
  return ethers.formatUnits(value, 'wei');
};

// Type definitions
export interface VaultConfig {
  name: string;
  description: string;
  owner: string;
  createdAt: number;
  lastRebalance: number;
  driftThresholdBasisPoints: number;
  rebalanceIntervalSeconds: number;
  isActive: boolean;
}

export interface AssetAllocation {
  assetAddress: string;
  assetSymbol: string;
  targetPercentage: number;
  currentPercentage: number;
  lastRebalanced: number;
}

export interface TakeProfitSettings {
  strategyType: number;
  targetPercentage: number;
  intervalSeconds: number;
  lastExecution: number;
  baselineValue: string;
  isActive: boolean;
}

export interface SwapQuote {
  sourceAsset: string;
  targetAsset: string;
  sourceAmount: string;
  targetAmount: string;
  fee: string;
  maxSlippageBps: number;
  validUntil: number;
}

export interface PriceData {
  symbol: string;
  price: string;
  updatedAt: number;
  provider: string;
  signature: string;
}

// Contract instances cache
const contractInstances: Record<string, ethers.Contract> = {};

/**
 * Gets a contract instance
 * @param contractName Contract name (Vault, Bridge, or PriceOracle)
 * @param chainId Chain ID (default: current chain)
 * @returns Contract instance
 */
export const getContract = async (
  contractName: 'Vault' | 'Bridge' | 'PriceOracle',
  chainId?: number
): Promise<ethers.Contract | null> => {
  try {
    // Get provider
    const provider = await getProvider();
    if (!provider) {
      throw new Error('Provider not available');
    }
    
    // Use current network if chainId not provided
    let currentChainId = chainId;
    if (!currentChainId && provider) {
      try {
        const network = await provider.getNetwork();
        currentChainId = typeof network.chainId === 'bigint' 
          ? Number(network.chainId) 
          : network.chainId;
      } catch (error) {
        console.error("Error getting network:", error);
        currentChainId = 1; // Default to Ethereum mainnet
      }
    }
    
    // Get contract address
    const address = getContractAddress(currentChainId || 1, contractName);
    if (!address) {
      throw new Error(`No ${contractName} contract address for chain ID ${currentChainId}`);
    }
    
    // Create cache key
    const cacheKey = `${contractName}-${currentChainId}-${address}`;
    
    // Return cached instance if available
    if (contractInstances[cacheKey]) {
      return contractInstances[cacheKey];
    }
    
    // Get contract ABI
    let abi;
    switch (contractName) {
      case 'Vault':
        abi = VaultABI;
        break;
      case 'Bridge':
        abi = BridgeABI;
        break;
      case 'PriceOracle':
        abi = PriceOracleABI;
        break;
      default:
        throw new Error(`Invalid contract name: ${contractName}`);
    }
    
    // Create read-only contract instance
    const contract = new ethers.Contract(address, abi, provider);
    
    // Cache the instance
    contractInstances[cacheKey] = contract;
    
    return contract;
  } catch (error) {
    console.error(`Error getting ${contractName} contract:`, error);
    return null;
  }
};

/**
 * Gets a signer contract instance for making transactions
 * @param contractName Contract name (Vault, Bridge, or PriceOracle)
 * @param chainId Chain ID (default: current chain)
 * @returns Contract instance with signer
 */
export const getSignerContract = async (
  contractName: 'Vault' | 'Bridge' | 'PriceOracle',
  chainId?: number
): Promise<ethers.Contract | null> => {
  try {
    // Get provider with signer
    const provider = await getProvider();
    if (!provider) {
      throw new Error('Provider not available');
    }
    
    // Get signer in ethers v6
    let signer;
    if ('getSigner' in provider) {
      // Browser provider
      signer = await (provider as ethers.BrowserProvider).getSigner();
      if (!signer) {
        throw new Error('Signer not available');
      }
    } else {
      throw new Error('Provider does not support signing transactions');
    }
    
    // Get read-only contract first
    const contract = await getContract(contractName, chainId);
    if (!contract) {
      throw new Error(`Failed to get ${contractName} contract`);
    }
    
    // Connect with signer
    return contract.connect(signer);
  } catch (error) {
    console.error(`Error getting ${contractName} contract with signer:`, error);
    return null;
  }
};

// Vault Contract Functions

/**
 * Creates a new investment vault
 * @param name Vault name
 * @param description Vault description
 * @param driftThresholdBasisPoints Rebalance threshold in basis points
 * @returns Transaction receipt
 */
export const createVault = async (
  name: string,
  description: string,
  driftThresholdBasisPoints: number
): Promise<any> => {
  try {
    const contract = await getSignerContract('Vault');
    if (!contract) {
      throw new Error('Vault contract not available');
    }
    
    const tx = await contract.createVault(name, description, driftThresholdBasisPoints);
    return await tx.wait();
  } catch (error) {
    console.error('Error creating vault:', error);
    throw error;
  }
};

/**
 * Gets vault details
 * @param vaultId Vault ID
 * @returns Vault configuration
 */
export const getVault = async (vaultId: number): Promise<VaultConfig | null> => {
  try {
    const contract = await getContract('Vault');
    if (!contract) {
      throw new Error('Vault contract not available');
    }
    
    const result = await contract.getVault(vaultId);
    
    // Parse result with ethers v6 (using Number() instead of toNumber())
    return {
      name: result.name,
      description: result.description,
      owner: result.owner,
      createdAt: Number(result.createdAt),
      lastRebalance: Number(result.lastRebalance),
      driftThresholdBasisPoints: Number(result.driftThresholdBasisPoints),
      rebalanceIntervalSeconds: Number(result.rebalanceIntervalSeconds),
      isActive: result.isActive
    };
  } catch (error) {
    console.error(`Error getting vault ${vaultId}:`, error);
    return null;
  }
};

/**
 * Gets all allocations for a vault
 * @param vaultId Vault ID
 * @returns Array of asset allocations
 */
export const getAllocations = async (vaultId: number): Promise<AssetAllocation[] | null> => {
  try {
    const contract = await getContract('Vault');
    if (!contract) {
      throw new Error('Vault contract not available');
    }
    
    const result = await contract.getAllocations(vaultId);
    
    // Parse result with ethers v6 (using Number() instead of toNumber())
    return result.map((allocation: any) => ({
      assetAddress: allocation.assetAddress,
      assetSymbol: allocation.assetSymbol,
      targetPercentage: Number(allocation.targetPercentage),
      currentPercentage: Number(allocation.currentPercentage),
      lastRebalanced: Number(allocation.lastRebalanced)
    }));
  } catch (error) {
    console.error(`Error getting allocations for vault ${vaultId}:`, error);
    return null;
  }
};

/**
 * Sets an asset allocation for a vault
 * @param vaultId Vault ID
 * @param assetAddress Asset contract address
 * @param assetSymbol Asset symbol
 * @param targetPercentage Target percentage (in basis points)
 * @returns Transaction receipt
 */
export const setAllocation = async (
  vaultId: number,
  assetAddress: string,
  assetSymbol: string,
  targetPercentage: number
): Promise<any> => {
  try {
    const contract = await getSignerContract('Vault');
    if (!contract) {
      throw new Error('Vault contract not available');
    }
    
    const tx = await contract.setAllocation(vaultId, assetAddress, assetSymbol, targetPercentage);
    return await tx.wait();
  } catch (error) {
    console.error('Error setting allocation:', error);
    throw error;
  }
};

/**
 * Gets take profit settings for a vault
 * @param vaultId Vault ID
 * @returns Take profit settings
 */
export const getTakeProfitSettings = async (vaultId: number): Promise<TakeProfitSettings | null> => {
  try {
    const contract = await getContract('Vault');
    if (!contract) {
      throw new Error('Vault contract not available');
    }
    
    const result = await contract.getTakeProfitSettings(vaultId);
    
    // Parse result with ethers v6 (using Number() instead of toNumber())
    return {
      strategyType: Number(result.strategyType),
      targetPercentage: Number(result.targetPercentage),
      intervalSeconds: Number(result.intervalSeconds),
      lastExecution: Number(result.lastExecution),
      baselineValue: result.baselineValue.toString(),
      isActive: result.isActive
    };
  } catch (error) {
    console.error(`Error getting take profit settings for vault ${vaultId}:`, error);
    return null;
  }
};

/**
 * Sets a take profit strategy for a vault
 * @param vaultId Vault ID
 * @param strategyType Strategy type (0=Manual, 1=Percentage, 2=Time)
 * @param targetPercentage Target percentage (for Percentage type)
 * @param intervalSeconds Interval seconds (for Time type)
 * @returns Transaction receipt
 */
export const setTakeProfitStrategy = async (
  vaultId: number,
  strategyType: number,
  targetPercentage: number,
  intervalSeconds: number
): Promise<any> => {
  try {
    const contract = await getSignerContract('Vault');
    if (!contract) {
      throw new Error('Vault contract not available');
    }
    
    const tx = await contract.setTakeProfitStrategy(vaultId, strategyType, targetPercentage, intervalSeconds);
    return await tx.wait();
  } catch (error) {
    console.error('Error setting take profit strategy:', error);
    throw error;
  }
};

/**
 * Executes a manual rebalance for a vault
 * @param vaultId Vault ID
 * @returns Transaction receipt
 */
export const rebalance = async (vaultId: number): Promise<any> => {
  try {
    const contract = await getSignerContract('Vault');
    if (!contract) {
      throw new Error('Vault contract not available');
    }
    
    const tx = await contract.rebalance(vaultId);
    return await tx.wait();
  } catch (error) {
    console.error('Error rebalancing vault:', error);
    throw error;
  }
};

/**
 * Checks if a vault needs rebalancing
 * @param vaultId Vault ID
 * @returns True if rebalancing is needed
 */
export const needsRebalancing = async (vaultId: number): Promise<boolean> => {
  try {
    const contract = await getContract('Vault');
    if (!contract) {
      throw new Error('Vault contract not available');
    }
    
    return await contract.needsRebalancing(vaultId);
  } catch (error) {
    console.error(`Error checking if vault ${vaultId} needs rebalancing:`, error);
    return false;
  }
};

/**
 * Executes a manual take profit for a vault
 * @param vaultId Vault ID
 * @returns Profit amount
 */
export const executeTakeProfit = async (vaultId: number): Promise<string> => {
  try {
    const contract = await getSignerContract('Vault');
    if (!contract) {
      throw new Error('Vault contract not available');
    }
    
    const tx = await contract.executeTakeProfit(vaultId);
    const receipt = await tx.wait();
    
    // Get the profit amount from the event logs
    const event = receipt.events?.find((e: any) => e.event === 'TakeProfitExecuted');
    if (event && event.args && event.args.profitAmount) {
      return event.args.profitAmount.toString();
    }
    
    return '0';
  } catch (error) {
    console.error('Error executing take profit:', error);
    throw error;
  }
};

// Bridge Contract Functions

/**
 * Gets a quote for a cross-chain swap
 * @param sourceChain Source blockchain
 * @param targetChain Target blockchain
 * @param sourceAsset Source asset symbol
 * @param targetAsset Target asset symbol
 * @param amount Amount to swap
 * @returns Swap quote
 */
export const getSwapQuote = async (
  sourceChain: string,
  targetChain: string,
  sourceAsset: string,
  targetAsset: string,
  amount: string
): Promise<SwapQuote | null> => {
  try {
    const contract = await getContract('Bridge');
    if (!contract) {
      throw new Error('Bridge contract not available');
    }
    
    const result = await contract.getSwapQuote(
      sourceChain,
      targetChain,
      sourceAsset,
      targetAsset,
      toBigInt(amount)
    );
    
    // Parse result
    return {
      sourceAsset: result.sourceAsset,
      targetAsset: result.targetAsset,
      sourceAmount: fromBigInt(result.sourceAmount),
      targetAmount: fromBigInt(result.targetAmount),
      fee: fromBigInt(result.fee),
      maxSlippageBps: Number(result.maxSlippageBps),
      validUntil: Number(result.validUntil)
    };
  } catch (error) {
    console.error('Error getting swap quote:', error);
    return null;
  }
};

/**
 * Initiates a cross-chain swap
 * @param targetChain Target blockchain
 * @param sourceAsset Source asset symbol
 * @param targetAsset Target asset symbol
 * @param amount Amount to swap
 * @param maxSlippageBps Maximum slippage allowed (in basis points)
 * @param targetAddress Address on target chain to receive funds
 * @param value ETH value to send (for ETH swaps)
 * @returns Transaction receipt
 */
export const initiateSwap = async (
  targetChain: string,
  sourceAsset: string,
  targetAsset: string,
  amount: string,
  maxSlippageBps: number,
  targetAddress: string,
  value?: string
): Promise<any> => {
  try {
    const contract = await getSignerContract('Bridge');
    if (!contract) {
      throw new Error('Bridge contract not available');
    }
    
    const tx = await contract.initiateSwap(
      targetChain,
      sourceAsset,
      targetAsset,
      toBigInt(amount),
      maxSlippageBps,
      targetAddress,
      { value: value ? toBigInt(value) : toBigInt(0) }
    );
    
    return await tx.wait();
  } catch (error) {
    console.error('Error initiating swap:', error);
    throw error;
  }
};

/**
 * Gets supported blockchains for cross-chain swaps
 * @returns Array of supported blockchain names
 */
export const getSupportedChains = async (): Promise<string[] | null> => {
  try {
    const contract = await getContract('Bridge');
    if (!contract) {
      throw new Error('Bridge contract not available');
    }
    
    return await contract.getSupportedChains();
  } catch (error) {
    console.error('Error getting supported chains:', error);
    return null;
  }
};

/**
 * Gets supported assets for a specific blockchain
 * @param chain Blockchain name
 * @returns Array of supported asset symbols
 */
export const getSupportedAssets = async (chain: string): Promise<string[] | null> => {
  try {
    const contract = await getContract('Bridge');
    if (!contract) {
      throw new Error('Bridge contract not available');
    }
    
    return await contract.getSupportedAssets(chain);
  } catch (error) {
    console.error(`Error getting supported assets for ${chain}:`, error);
    return null;
  }
};

// Price Oracle Contract Functions

/**
 * Gets the current price for a single asset
 * @param symbol Asset symbol
 * @returns Price data
 */
export const getPrice = async (symbol: string): Promise<PriceData | null> => {
  try {
    const contract = await getContract('PriceOracle');
    if (!contract) {
      throw new Error('PriceOracle contract not available');
    }
    
    const result = await contract.getPrice(symbol);
    
    // Parse result
    return {
      symbol: result.symbol,
      price: result.price.toString(),
      updatedAt: result.updatedAt.toNumber(),
      provider: result.provider,
      signature: result.signature
    };
  } catch (error) {
    console.error(`Error getting price for ${symbol}:`, error);
    return null;
  }
};

/**
 * Gets the current prices for multiple assets
 * @param symbols Array of asset symbols
 * @returns Array of price data
 */
export const getPrices = async (symbols: string[]): Promise<PriceData[] | null> => {
  try {
    const contract = await getContract('PriceOracle');
    if (!contract) {
      throw new Error('PriceOracle contract not available');
    }
    
    const result = await contract.getPrices(symbols);
    
    // Parse result
    return result.map((data: any) => ({
      symbol: data.symbol,
      price: data.price.toString(),
      updatedAt: data.updatedAt.toNumber(),
      provider: data.provider,
      signature: data.signature
    }));
  } catch (error) {
    console.error('Error getting prices:', error);
    return null;
  }
};

/**
 * Gets the time-weighted average price (TWAP) for an asset
 * @param symbol Asset symbol
 * @param periodSeconds Time period for TWAP calculation
 * @returns TWAP price
 */
export const getTWAP = async (symbol: string, periodSeconds: number): Promise<string | null> => {
  try {
    const contract = await getContract('PriceOracle');
    if (!contract) {
      throw new Error('PriceOracle contract not available');
    }
    
    const result = await contract.getTWAP(symbol, periodSeconds);
    return result.toString();
  } catch (error) {
    console.error(`Error getting TWAP for ${symbol}:`, error);
    return null;
  }
};