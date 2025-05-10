import { ethers } from "ethers";

// Constants
export const L1X_TESTNET_URL = "https://v2.testnet.l1x.foundation";
export const L1X_MAINNET_URL = "https://v2.mainnet.l1x.foundation";
export const ETHEREUM_MAINNET_URL = "https://mainnet.infura.io/v3/your-infura-key";
export const ETHEREUM_GOERLI_URL = "https://goerli.infura.io/v3/your-infura-key";

// Chain IDs
export enum ChainId {
  ETHEREUM_MAINNET = 1,
  ETHEREUM_GOERLI = 5,
  L1X_MAINNET = 1776,
  L1X_TESTNET = 14649, // Updated to v2 testnet
  L1X_TESTNET_V1 = 1777 // Keep old value for compatibility
}

// Get chain name
export const getChainName = (chainId: ChainId): string => {
  switch (chainId) {
    case ChainId.ETHEREUM_MAINNET:
      return "Ethereum Mainnet";
    case ChainId.ETHEREUM_GOERLI:
      return "Ethereum Goerli";
    case ChainId.L1X_MAINNET:
      return "L1X Mainnet";
    case ChainId.L1X_TESTNET:
      return "L1X V2 Testnet";
    case ChainId.L1X_TESTNET_V1:
      return "L1X V1 Testnet";
    default:
      return "Unknown Chain";
  }
};

// Interface for Web3 provider
export interface Web3Provider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, callback: (...args: any[]) => void) => void;
  removeListener?: (event: string, callback: (...args: any[]) => void) => void;
}

// Define window interfaces for web3 providers
declare global {
  interface Window {
    ethereum?: Web3Provider;
    l1x?: Web3Provider;
  }
}

// Check if window.ethereum exists
export const isMetaMaskInstalled = (): boolean => {
  return typeof window !== "undefined" && window.ethereum !== undefined;
};

// Check if window.l1x exists
export const isL1XWalletInstalled = (): boolean => {
  return typeof window !== "undefined" && window.l1x !== undefined;
};

// Create a direct L1X provider using the testnet URL
export const getL1XDirectProvider = (): ethers.JsonRpcProvider => {
  return new ethers.JsonRpcProvider(L1X_TESTNET_URL);
};

// Create a direct Ethereum provider using the mainnet URL
export const getEthereumDirectProvider = (testnet = false): ethers.JsonRpcProvider => {
  return new ethers.JsonRpcProvider(testnet ? ETHEREUM_GOERLI_URL : ETHEREUM_MAINNET_URL);
};

// Get the L1X provider from browser wallet
export const getL1XProvider = async (): Promise<Web3Provider | null> => {
  try {
    // First try L1X native wallet if available
    if (isL1XWalletInstalled() && window.l1x) {
      return window.l1x;
    }
    
    // Fall back to MetaMask as the provider
    if (!isMetaMaskInstalled() || !window.ethereum) {
      throw new Error("No wallet provider detected");
    }
    
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x3929', // Chain ID for L1X v2 testnet (14649 in hex)
          chainName: 'L1X V2 Testnet',
          nativeCurrency: {
            name: 'L1X',
            symbol: 'L1X',
            decimals: 18
          },
          rpcUrls: [L1X_TESTNET_URL],
          blockExplorerUrls: ['https://explorer.testnet.l1x.foundation/']
        }]
      });
    } catch (error) {
      console.warn('Failed to add L1X network to MetaMask:', error);
    }
    
    return window.ethereum;
  } catch (error) {
    console.log("No wallet provider available:", error);
    return null;
  }
};

// Get Ethereum provider
export const getEthersProvider = async (): Promise<ethers.BrowserProvider | null> => {
  if (!isMetaMaskInstalled() || !window.ethereum) {
    return null;
  }
  
  return new ethers.BrowserProvider(window.ethereum);
};

// Generic provider access function - main entry point used by other modules
export const getProvider = async (): Promise<ethers.Provider | null> => {
  try {
    // First try to get L1X provider from wallet
    const provider = await getL1XProvider();
    
    if (provider) {
      // Convert Web3Provider to ethers.BrowserProvider
      return new ethers.BrowserProvider(provider as any);
    }
    
    // Fall back to direct provider
    return getL1XDirectProvider();
  } catch (error) {
    console.error("Error getting provider:", error);
    return null;
  }
};

// Get chain-specific provider
export const getChainProvider = async (chainId: ChainId): Promise<ethers.Provider | null> => {
  try {
    // First check if we have a browser provider
    if (isMetaMaskInstalled() || isL1XWalletInstalled()) {
      // Get current network
      const provider = await getEthersProvider();
      if (provider) {
        const network = await provider.getNetwork();
        if (network.chainId === BigInt(chainId)) {
          return provider;
        }
        
        // Try to switch to the right network
        try {
          await window.ethereum?.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${chainId.toString(16)}` }],
          });
          return provider;
        } catch (switchError: any) {
          // Network doesn't exist - fall back to direct provider
          console.warn('Failed to switch network:', switchError.message);
        }
      }
    }
    
    // Use direct provider based on chain ID
    switch (chainId) {
      case ChainId.ETHEREUM_MAINNET:
        return getEthereumDirectProvider(false);
      case ChainId.ETHEREUM_GOERLI:
        return getEthereumDirectProvider(true);
      case ChainId.L1X_MAINNET:
      case ChainId.L1X_TESTNET:
        return getL1XDirectProvider();
      default:
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }
  } catch (error) {
    console.error("Error getting chain provider:", error);
    return null;
  }
};

// Connect wallet and get accounts
export const connectWallet = async (): Promise<string | null> => {
  try {
    // Try L1X wallet first
    if (isL1XWalletInstalled()) {
      const accounts = await window.l1x!.request({
        method: "eth_requestAccounts",
      });
      return accounts[0] || null;
    }
    
    // Fall back to MetaMask
    const provider = await getL1XProvider();
    
    if (!provider) {
      throw new Error("No provider found. Please install MetaMask or an L1X wallet.");
    }
    
    const accounts = await provider.request({
      method: "eth_requestAccounts",
    });
    
    return accounts[0] || null;
  } catch (error: any) {
    console.error("Error connecting wallet:", error);
    throw new Error(error.message || "Failed to connect wallet");
  }
};

// Sign message with wallet
export const signMessage = async (message: string): Promise<{ address: string; signature: string }> => {
  try {
    // Try L1X wallet first
    if (isL1XWalletInstalled()) {
      const accounts = await window.l1x!.request({
        method: "eth_accounts",
      });
      const address = accounts[0];
      
      if (!address) {
        throw new Error("No L1X wallet account connected");
      }
      
      const signature = await window.l1x!.request({
        method: "personal_sign",
        params: [message, address],
      });
      
      return { address, signature };
    }
    
    // Fall back to MetaMask
    const provider = await getEthersProvider();
    
    if (!provider) {
      throw new Error("No provider found. Please install MetaMask or an L1X wallet.");
    }
    
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const signature = await signer.signMessage(message);
    
    return { address, signature };
  } catch (error: any) {
    console.error("Error signing message:", error);
    throw new Error(error.message || "Failed to sign message");
  }
};

// Authenticate with backend using wallet signature
export const authenticateWithWallet = async (): Promise<any> => {
  try {
    // Get current connected account
    const address = await connectWallet();
    
    if (!address) {
      throw new Error("No connected account found");
    }
    
    // Generate a random nonce for message signing
    const nonce = Math.floor(Math.random() * 1000000).toString();
    const message = `Sign this message to authenticate with One Capital Auto-Investing. Nonce: ${nonce}`;
    
    // Sign the message
    const { signature } = await signMessage(message) || {};
    
    if (!signature) {
      throw new Error("Failed to sign message");
    }
    
    // Send the signature to the backend for verification
    const response = await fetch("/api/auth/web3/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        walletAddress: address,
        signature,
        message,
      }),
      credentials: "include",
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Authentication failed");
    }
    
    return await response.json();
  } catch (error: any) {
    console.error("Error authenticating with wallet:", error);
    throw new Error(error.message || "Failed to authenticate with wallet");
  }
};

// Contract interaction functions
interface ContractCallOptions {
  contractAddress: string;
  method: string;
  params?: any[];
  value?: string;
}

// Call a read-only contract method
export const callContractMethod = async ({ 
  contractAddress, 
  method, 
  params = [] 
}: ContractCallOptions): Promise<any> => {
  try {
    // First try with direct provider
    const provider = getL1XDirectProvider();
    
    // Use JSON-RPC to call the contract method
    const result = await provider.send("eth_call", [
      {
        to: contractAddress,
        data: encodeMethodCall(method, params),
      },
      "latest"
    ]);
    
    return result;
  } catch (error: any) {
    console.error(`Error calling contract method ${method}:`, error);
    throw new Error(error.message || `Failed to call contract method ${method}`);
  }
};

// Send a transaction to the contract
export const sendContractTransaction = async ({
  contractAddress,
  method,
  params = [],
  value = "0x0"
}: ContractCallOptions): Promise<string> => {
  try {
    const provider = await getL1XProvider();
    
    if (!provider) {
      throw new Error("No provider found. Please install MetaMask or an L1X wallet.");
    }
    
    const from = await connectWallet();
    
    if (!from) {
      throw new Error("No account connected. Please connect your wallet first.");
    }
    
    // Send the transaction
    const txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [{
        from,
        to: contractAddress,
        data: encodeMethodCall(method, params),
        value,
        gas: "0x100000", // Adjust gas as needed
      }],
    });
    
    return txHash;
  } catch (error: any) {
    console.error(`Error sending contract transaction ${method}:`, error);
    throw new Error(error.message || `Failed to send contract transaction ${method}`);
  }
};

// Cross-chain transaction
export interface CrossChainTxParams {
  sourceChainId: ChainId;
  targetChainId: ChainId;
  sourceAsset: string;
  targetAsset: string;
  amount: string;
  targetAddress: string;
  maxSlippageBps: number;
}

// Initiate cross-chain transaction
export const initiateCrossChainTransaction = async (params: CrossChainTxParams): Promise<string> => {
  try {
    // Get source chain provider
    const provider = await getChainProvider(params.sourceChainId);
    if (!provider) {
      throw new Error(`Failed to get provider for chain ID ${params.sourceChainId}`);
    }
    
    // Get a signer for the provider
    const signer = 'getSigner' in provider ? await (provider as ethers.BrowserProvider).getSigner() : null;
    if (!signer) {
      throw new Error("Could not get a signer. Please connect your wallet.");
    }
    
    // Convert chain IDs to names
    const sourceChain = getChainName(params.sourceChainId);
    const targetChain = getChainName(params.targetChainId);
    
    // Import contract ABI and address
    const { BridgeABI, getContractAddress } = await import('./contractABI');
    const bridgeAddress = getContractAddress(params.sourceChainId, 'Bridge');
    
    if (!bridgeAddress) {
      throw new Error(`No bridge contract address for chain ID ${params.sourceChainId}`);
    }
    
    // Create contract instance
    const bridgeContract = new ethers.Contract(bridgeAddress, BridgeABI, signer);
    
    // Check if ETH is being sent
    const value = params.sourceAsset.toUpperCase() === 'ETH' ? 
      ethers.parseEther(params.amount) : 
      ethers.parseUnits('0', 18);
    
    // Initiate the swap
    const tx = await bridgeContract.initiateSwap(
      targetChain,
      params.sourceAsset,
      params.targetAsset,
      ethers.parseUnits(params.amount, 18), // Assuming 18 decimals
      params.maxSlippageBps,
      params.targetAddress,
      { value }
    );
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    // Return the transaction hash
    return receipt.hash;
  } catch (error: any) {
    console.error("Error initiating cross-chain transaction:", error);
    throw new Error(error.message || "Failed to initiate cross-chain transaction");
  }
};

// Get chain ID from chain name
export const getChainId = (chainName: string): ChainId => {
  switch (chainName.toLowerCase()) {
    case "ethereum":
      return ChainId.ETHEREUM_MAINNET;
    case "ethereum-goerli":
      return ChainId.ETHEREUM_GOERLI;
    case "l1x":
      return ChainId.L1X_MAINNET;
    case "l1x-testnet":
      return ChainId.L1X_TESTNET;
    default:
      throw new Error(`Unsupported chain name: ${chainName}`);
  }
};

// Basic ABI encoding (This is a simplified version - a real implementation would use ethers.js ABI encoding)
function encodeMethodCall(method: string, params: any[]): string {
  // This is a placeholder for actual ABI encoding
  // In a real implementation, you would use ethers.js or a similar library
  // to properly encode the method call based on the contract ABI
  console.warn("Using simplified method encoding - replace with proper ABI encoding in production");
  
  // Return a placeholder encoding for now
  const methodId = ethers.keccak256(ethers.toUtf8Bytes(`${method}()`)).substring(0, 10);
  return methodId;
}
