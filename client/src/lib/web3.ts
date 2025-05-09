import { ethers } from "ethers";

// Constants
export const L1X_TESTNET_URL = "https://v2.testnet.l1x.foundation";

// interface for Web3 provider
interface Web3Provider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
}

// Check if window.ethereum exists
const isMetaMaskInstalled = (): boolean => {
  return typeof window !== "undefined" && window.ethereum !== undefined;
};

// Create a direct L1X provider using the testnet URL
export const getL1XDirectProvider = (): ethers.JsonRpcProvider => {
  return new ethers.JsonRpcProvider(L1X_TESTNET_URL);
};

// Get the L1X provider from browser wallet
export const getL1XProvider = async (): Promise<Web3Provider | null> => {
  // First try L1X native wallet if available
  if (typeof window !== "undefined" && window.l1x !== undefined) {
    return window.l1x;
  }
  
  // Fall back to MetaMask as the provider
  if (!isMetaMaskInstalled()) {
    return null;
  }
  
  // Configure MetaMask to use L1X network if possible
  try {
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: '0x3939', // Chain ID for L1X testnet
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
};

// Get Ethereum provider
export const getEthersProvider = async (): Promise<ethers.BrowserProvider | null> => {
  if (!isMetaMaskInstalled()) {
    return null;
  }
  
  return new ethers.BrowserProvider(window.ethereum);
};

// Connect wallet and get accounts
export const connectWallet = async (): Promise<string | null> => {
  try {
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

// Get current connected account
export const getCurrentAccount = async (): Promise<string | null> => {
  try {
    const provider = await getL1XProvider();
    
    if (!provider) {
      return null;
    }
    
    const accounts = await provider.request({
      method: "eth_accounts",
    });
    
    return accounts[0] || null;
  } catch (error) {
    console.error("Error getting current account:", error);
    return null;
  }
};

// Sign message to authenticate
export const signMessage = async (message: string): Promise<{ address: string; signature: string } | null> => {
  try {
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
    const address = await getCurrentAccount();
    
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
    
    const from = await getCurrentAccount();
    
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
