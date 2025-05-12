import React, { createContext, useContext, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useQuery } from '@tanstack/react-query';
import { 
  connectWallet, 
  getL1XProvider, 
  getEthersProvider,
  ChainId,
  getChainProvider,
  getChainName,
  Web3Provider
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
  getProvider: () => ethers.Provider | null;
  getSigner: () => ethers.Signer | null;
  currentAccount: string | null;
  currentChain: string | null;
  provider: ethers.Provider | null;
  chainId: number | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: (chainId: ChainId) => Promise<void>;
}

// Local storage keys
const WALLET_TYPE_KEY = 'one-capital-wallet-type';
const WALLET_ADDRESS_KEY = 'one-capital-wallet-address';

// Create context with default values
const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [currentChain, setCurrentChain] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if the user is authenticated via backend
  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    enabled: true,
    retry: false,
    gcTime: 0,
  });

  // When user data changes, update the authenticated state
  useEffect(() => {
    if (user) {
      setIsAuthenticated(true);
    }
  }, [user]);

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
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        
        if (accounts && accounts.length > 0) {
          const ethersProvider = await getEthersProvider();
          if (ethersProvider) {
            setProvider(ethersProvider);
            const signer = await ethersProvider.getSigner();
            setSigner(signer);
            setWalletAddress(accounts[0]);
            setWalletType('metamask');
          }
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
      if (window.l1x) {
        const accounts = await window.l1x.request({ method: 'eth_accounts' });
        
        if (accounts && accounts.length > 0) {
          const l1xProvider = await getL1XProvider();
          if (l1xProvider) {
            setProvider(l1xProvider as unknown as ethers.Provider);
            setWalletAddress(accounts[0]);
            setWalletType('l1x');
          }
        } else {
          clearWalletState();
        }
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
      
      if (!window.l1x) {
        throw new Error('L1X wallet is not installed');
      }
      
      const accounts = await window.l1x.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      
      if (!address) {
        throw new Error('No account selected');
      }
      
      setWalletType('l1x');
      setWalletAddress(address);
      
      const l1xProvider = await getL1XProvider();
      if (l1xProvider) {
        setProvider(l1xProvider as unknown as ethers.Provider);
      }
      
      localStorage.setItem(WALLET_TYPE_KEY, 'l1x');
      localStorage.setItem(WALLET_ADDRESS_KEY, address);
      
    } catch (error) {
      console.error('Error connecting to L1X wallet:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect to L1X wallet');
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
      
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
      }
      
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      
      if (!address) {
        throw new Error('No account selected');
      }
      
      setWalletType('metamask');
      setWalletAddress(address);
      
      const ethersProvider = await getEthersProvider();
      if (ethersProvider) {
        setProvider(ethersProvider);
        const signer = await ethersProvider.getSigner();
        setSigner(signer);
      }
      
      const network = await window.ethereum.request({ method: 'eth_chainId' });
      const chainIdHex = network?.toString();
      if (chainIdHex) {
        const chainId = parseInt(chainIdHex, 16);
        setChainId(chainId);
        setCurrentChain(getChainName(chainId as ChainId));
      }
      
      localStorage.setItem(WALLET_TYPE_KEY, 'metamask');
      localStorage.setItem(WALLET_ADDRESS_KEY, address);
      
      setupEventListeners();
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect to MetaMask');
      clearWalletState();
    } finally {
      setIsConnecting(false);
    }
  };

  // Setup event listeners for MetaMask
  const setupEventListeners = () => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else if (accounts[0] !== walletAddress) {
          setWalletAddress(accounts[0]);
          localStorage.setItem(WALLET_ADDRESS_KEY, accounts[0]);
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      if (window.ethereum.on) {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
      }

      return () => {
        if (window.ethereum?.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    clearWalletState();
  };

  // Clear wallet state
  const clearWalletState = () => {
    setWalletType(null);
    setWalletAddress(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setCurrentChain(null);
    localStorage.removeItem(WALLET_TYPE_KEY);
    localStorage.removeItem(WALLET_ADDRESS_KEY);
  };

  // Get current provider
  const getProvider = () => provider;

  // Get current signer
  const getSigner = () => signer;

  // Connect wallet
  const connect = async () => {
    try {
      const address = await connectWallet();
      if (address) {
        setWalletAddress(address);
        
        const provider = await getL1XProvider();
        if (provider) {
          const chainId = await provider.request({ method: 'eth_chainId' });
          const chainIdNum = parseInt(chainId, 16);
          setChainId(chainIdNum);
          setCurrentChain(getChainName(chainIdNum as ChainId));
          
          const ethersProvider = await getEthersProvider();
          if (ethersProvider) {
            setProvider(ethersProvider);
            const signer = await ethersProvider.getSigner();
            setSigner(signer);
          }
        }
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      throw error;
    }
  };

  // Disconnect wallet
  const disconnect = () => {
    clearWalletState();
  };

  // Switch chain
  const switchChain = async (targetChainId: ChainId) => {
    try {
      const provider = await getL1XProvider();
      if (!provider) throw new Error('No provider available');

      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });

      setChainId(targetChainId);
      setCurrentChain(getChainName(targetChainId));
    } catch (error: any) {
      if (error.code === 4902) {
        try {
          await provider?.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${targetChainId.toString(16)}`,
              chainName: targetChainId === ChainId.L1X_TESTNET ? 'L1X Testnet' : 'L1X Mainnet',
              nativeCurrency: {
                name: 'L1X',
                symbol: 'L1X',
                decimals: 18
              },
              rpcUrls: [targetChainId === ChainId.L1X_TESTNET ? 
                'https://v2.testnet.l1x.foundation' : 
                'https://v2.mainnet.l1x.foundation'],
              blockExplorerUrls: [targetChainId === ChainId.L1X_TESTNET ?
                'https://explorer.testnet.l1x.foundation/' :
                'https://explorer.l1x.foundation/']
            }]
          });
          setChainId(targetChainId);
          setCurrentChain(getChainName(targetChainId));
        } catch (addError) {
          console.error('Error adding chain:', addError);
          throw addError;
        }
      } else {
        throw error;
      }
    }
  };

  // Context value
  const value: WalletContextType = {
    walletType,
    walletAddress,
    // Consider a user connected if they have a web3 wallet OR if they're authenticated via backend
    isConnected: (walletType !== null && walletAddress !== null) || isAuthenticated,
    isConnecting,
    error,
    connectL1X,
    connectMetaMask,
    connectWallet,
    disconnectWallet,
    getProvider,
    getSigner,
    currentAccount: walletAddress,
    currentChain,
    provider,
    chainId,
    connect,
    disconnect,
    switchChain
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
    ethereum?: Web3Provider;
    l1x?: Web3Provider;
  }
}