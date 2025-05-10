import { createWalletClient, createPublicClient, http, custom } from 'viem';
import { mainnet } from 'viem/chains';

// Define L1X chains for viem
export const l1xMainnet = {
  id: 1776,
  name: 'L1X Mainnet',
  network: 'l1x',
  nativeCurrency: {
    decimals: 18,
    name: 'L1X',
    symbol: 'L1X',
  },
  rpcUrls: {
    default: {
      http: ['https://mainnet.l1x.foundation'],
    },
    public: {
      http: ['https://mainnet.l1x.foundation'],
    },
  },
};

export const l1xTestnet = {
  id: 1777,
  name: 'L1X Testnet',
  network: 'l1x-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'L1X',
    symbol: 'L1X',
  },
  rpcUrls: {
    default: {
      http: ['https://v2.testnet.l1x.foundation'],
    },
    public: {
      http: ['https://v2.testnet.l1x.foundation'],
    },
  },
};

// Create a wallet client with injected provider (MetaMask)
export function getWalletClient() {
  // Check if window.ethereum exists
  if (typeof window !== 'undefined' && window.ethereum) {
    return createWalletClient({
      chain: mainnet,
      transport: custom(window.ethereum),
    });
  }
  return null;
}

// Create a wallet client for L1X
export function getL1XWalletClient() {
  // Check if window.l1x exists
  if (typeof window !== 'undefined' && window.l1x) {
    return createWalletClient({
      chain: l1xTestnet,
      transport: custom(window.l1x),
    });
  }
  return null;
}

// Get a public client for any chain
export function getPublicClient(chainId: number) {
  let chain;
  switch (chainId) {
    case 1776:
      chain = l1xMainnet;
      break;
    case 1777:
      chain = l1xTestnet;
      break;
    default:
      chain = mainnet;
  }

  return createPublicClient({
    chain,
    transport: http(),
  });
}

// Helper for getting account address
export async function getAccount() {
  const walletClient = getWalletClient();
  if (!walletClient) return null;
  
  try {
    const accounts = await walletClient.getAddresses();
    return accounts[0] || null;
  } catch (error) {
    console.error('Error getting account:', error);
    return null;
  }
}

// Helper for getting balance
export async function getBalance(address: string, chainId: number = 1) {
  const publicClient = getPublicClient(chainId);
  if (!publicClient || !address) return null;
  
  try {
    // Ensure the address is formatted correctly with 0x prefix
    const formattedAddress = address.startsWith('0x') 
      ? address as `0x${string}` 
      : `0x${address}` as `0x${string}`;
      
    const balance = await publicClient.getBalance({ address: formattedAddress });
    return balance;
  } catch (error) {
    console.error('Error getting balance:', error);
    return null;
  }
}

// Send a transaction
export async function sendTransaction(to: string, value: bigint) {
  const walletClient = getWalletClient();
  if (!walletClient) throw new Error('No wallet client available');
  
  const account = await getAccount();
  if (!account) throw new Error('No account connected');
  
  try {
    // Ensure the destination address is formatted correctly with 0x prefix
    const formattedTo = to.startsWith('0x') 
      ? to as `0x${string}` 
      : `0x${to}` as `0x${string}`;
      
    const hash = await walletClient.sendTransaction({
      account,
      to: formattedTo,
      value,
    });
    
    return hash;
  } catch (error) {
    console.error('Error sending transaction:', error);
    throw error;
  }
}