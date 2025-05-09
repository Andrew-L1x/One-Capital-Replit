import { ethers } from "ethers";

// interface for Web3 provider
interface Web3Provider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
}

// Check if window.ethereum exists
const isMetaMaskInstalled = (): boolean => {
  return typeof window !== "undefined" && window.ethereum !== undefined;
};

// Get the L1X provider
export const getL1XProvider = async (): Promise<Web3Provider | null> => {
  // For now, we use MetaMask as the provider
  // In production, this would be replaced with an L1X-specific provider
  if (!isMetaMaskInstalled()) {
    return null;
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
