import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  connectWallet as connectWeb3Wallet, 
  getCurrentAccount,
  getChainId,
  getChainName,
  ChainId
} from './web3';

// Define wallet types
export type WalletType = 'l1x' | 'metamask' | null;

// Define the context value type
interface WalletContextType {
  walletType: WalletType;
  walletAddress: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connectL1X: () => Promise<void>;
  connectMetaMask: () => Promise<void>;
  connectWallet: () => Promise<string | null>;
  disconnectWallet: () => void;
  getProvider: () => any;
  getSigner: () => any;
  currentAccount: string | null;
  currentChain: string | null;
}

// Local storage keys
const WALLET_TYPE_KEY = 'one-capital-wallet-type';
const WALLET_ADDRESS_KEY = 'one-capital-wallet-address';

// Create context with default values
const WalletContext = createContext<WalletContextType>({
  walletType: null,
  walletAddress: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  connectL1X: async () => {},
  connectMetaMask: async () => {},
  connectWallet: async () => null,
  disconnectWallet: () => {},
  getProvider: () => null,
  getSigner: () => null,
  currentAccount: null,
  currentChain: null,
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<any>(null);
  const [signer, setSigner] = useState<any>(null);
  const [currentChain, setCurrentChain] = useState<string | null>(null);

  // Load wallet state from local storage on component mount
  useEffect(() => {
    const storedWalletType = localStorage.getItem(WALLET_TYPE_KEY) as WalletType;
    const storedWalletAddress = localStorage.getItem(WALLET_ADDRESS_KEY);

    if (storedWalletType && storedWalletAddress) {
      setWalletType(storedWalletType);
      setWalletAddress(storedWalletAddress);
      
      // Auto-reconnect based on stored wallet type
      if (storedWalletType === 'metamask') {
        autoConnectMetaMask();
      } else if (storedWalletType === 'l1x') {
        autoConnectL1X();
      }
    }
  }, []);

  // Auto-connect to MetaMask if previously connected
  const autoConnectMetaMask = async () => {
    try {
      if (window.ethereum) {
        // In real implementation we would use ethers.js
        // For now, just check if accounts are available
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        
        if (accounts && accounts.length > 0) {
          setProvider(window.ethereum);
          setSigner({ address: accounts[0] });
          setWalletAddress(accounts[0]);
          setWalletType('metamask');
        } else {
          clearWalletState();
        }
      }
    } catch (error) {
      console.error('Error auto-connecting to MetaMask:', error);
      clearWalletState();
    }
  };

  // Auto-connect to L1X if previously connected
  const autoConnectL1X = async () => {
    try {
      // This would be replaced with actual L1X SDK code
      // For now, we'll simulate L1X connection status using local storage
      const isConnected = localStorage.getItem(WALLET_ADDRESS_KEY) !== null;
      
      if (isConnected) {
        // In a real implementation, we would initialize the L1X provider here
        setWalletType('l1x');
      } else {
        clearWalletState();
      }
    } catch (error) {
      console.error('Error auto-connecting to L1X:', error);
      clearWalletState();
    }
  };

  // Connect to L1X wallet
  const connectL1X = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      // This would be replaced with actual L1X SDK code
      // For demo purposes, we'll simulate a successful connection
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock L1X address - in production this would come from the L1X wallet SDK
      const l1xAddress = '0xL1X' + Math.random().toString(16).slice(2, 10).toUpperCase();
      
      // Save connection details
      setWalletType('l1x');
      setWalletAddress(l1xAddress);
      
      // Store in local storage
      localStorage.setItem(WALLET_TYPE_KEY, 'l1x');
      localStorage.setItem(WALLET_ADDRESS_KEY, l1xAddress);
      
      // Initialize L1X provider (mock for demo)
      // In reality, we would use the L1X SDK to get a provider
      setProvider({ type: 'l1x' });
      setSigner({ type: 'l1x', address: l1xAddress });
      
      console.log('Connected to L1X wallet:', l1xAddress);
    } catch (error) {
      console.error('Error connecting to L1X wallet:', error);
      setError('Failed to connect to L1X wallet. Please try again.');
      clearWalletState();
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect to MetaMask
  const connectMetaMask = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      // Check if MetaMask is installed
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed. Please install MetaMask first.');
      }
      
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      
      // Save connection details
      setWalletType('metamask');
      setWalletAddress(address);
      setProvider(window.ethereum);
      setSigner({ address });
      
      // Get chain info
      const network = await window.ethereum.request({ method: 'eth_chainId' });
      const chainIdHex = network?.toString();
      if (chainIdHex) {
        const chainId = parseInt(chainIdHex, 16);
        setCurrentChain(getChainName(chainId as ChainId));
      }
      
      // Store in local storage
      localStorage.setItem(WALLET_TYPE_KEY, 'metamask');
      localStorage.setItem(WALLET_ADDRESS_KEY, address);
      
      console.log('Connected to MetaMask:', address);
      
      // Setup event listeners
      setupEventListeners();
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect to MetaMask');
      clearWalletState();
    } finally {
      setIsConnecting(false);
    }
  };
  
  // Connect wallet using web3.ts implementation
  const connectWallet = async (): Promise<string | null> => {
    try {
      setIsConnecting(true);
      setError(null);
      
      // Call the web3.ts connectWallet implementation
      const account = await connectWeb3Wallet();
      
      if (account) {
        // Determine wallet type (MetaMask or L1X) based on provider detection
        const walletType: WalletType = window.l1x ? 'l1x' : 'metamask';
        
        // Save connection details
        setWalletType(walletType);
        setWalletAddress(account);
        
        // Set provider based on wallet type
        setProvider(walletType === 'l1x' ? window.l1x : window.ethereum);
        
        // Store in local storage
        localStorage.setItem(WALLET_TYPE_KEY, walletType);
        localStorage.setItem(WALLET_ADDRESS_KEY, account);
        
        // Get and set chain info
        if (window.ethereum) {
          const network = await window.ethereum.request({ method: 'eth_chainId' });
          const chainIdHex = network?.toString();
          if (chainIdHex) {
            const chainId = parseInt(chainIdHex, 16);
            setCurrentChain(getChainName(chainId as ChainId));
          }
        }
        
        return account;
      }
      
      return null;
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect wallet');
      clearWalletState();
      return null;
    } finally {
      setIsConnecting(false);
    }
  };

  // Setup event listeners for MetaMask
  const setupEventListeners = () => {
    if (window.ethereum) {
      // Handle account changes
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected their wallet
          disconnectWallet();
        } else if (accounts[0] !== walletAddress) {
          // User switched accounts
          setWalletAddress(accounts[0]);
          localStorage.setItem(WALLET_ADDRESS_KEY, accounts[0]);
        }
      });
      
      // Handle chain changes
      window.ethereum.on('chainChanged', () => {
        // MetaMask recommends reloading the page on chain change
        window.location.reload();
      });
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    if (walletType === 'metamask' && window.ethereum) {
      // Remove event listeners
      window.ethereum.removeListener('accountsChanged', () => {});
      window.ethereum.removeListener('chainChanged', () => {});
    }
    
    clearWalletState();
  };

  // Clear wallet state
  const clearWalletState = () => {
    setWalletType(null);
    setWalletAddress(null);
    setProvider(null);
    setSigner(null);
    localStorage.removeItem(WALLET_TYPE_KEY);
    localStorage.removeItem(WALLET_ADDRESS_KEY);
  };

  // Get current provider
  const getProvider = () => provider;

  // Get current signer
  const getSigner = () => signer;

  // Check if wallet is connected
  const isConnected = walletType !== null && walletAddress !== null;

  // Context value
  const value = {
    walletType,
    walletAddress,
    isConnected,
    isConnecting,
    error,
    connectL1X,
    connectMetaMask,
    connectWallet,
    disconnectWallet,
    getProvider,
    getSigner,
    currentAccount: walletAddress, // Alias for walletAddress for compatibility
    currentChain
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

// Custom hook to use the wallet context
export function useWallet() {
  const context = useContext(WalletContext);
  
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  
  return context;
}

// Declare window.ethereum and window.l1x types
declare global {
  interface Window {
    ethereum?: any;
    l1x?: any; // L1X wallet provider
  }
}