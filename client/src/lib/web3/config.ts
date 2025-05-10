import { http, createConfig } from 'wagmi'
import { mainnet, goerli } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

// Define L1X chains
const l1xMainnet = {
  id: 1776,
  name: 'L1X Mainnet',
  network: 'l1x',
  nativeCurrency: {
    decimals: 18,
    name: 'L1X',
    symbol: 'L1X',
  },
  rpcUrls: {
    public: { http: ['https://mainnet.l1x.foundation'] },
    default: { http: ['https://mainnet.l1x.foundation'] },
  },
  blockExplorers: {
    default: { name: 'L1X Explorer', url: 'https://explorer.l1x.foundation' },
  },
}

const l1xTestnet = {
  id: 1777,
  name: 'L1X Testnet',
  network: 'l1x-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'L1X',
    symbol: 'L1X',
  },
  rpcUrls: {
    public: { http: ['https://v2.testnet.l1x.foundation'] },
    default: { http: ['https://v2.testnet.l1x.foundation'] },
  },
  blockExplorers: {
    default: { name: 'L1X Explorer', url: 'https://explorer.testnet.l1x.foundation' },
  },
}

// WalletConnect Project ID - in a real project, this should be in an environment variable
const projectId = 'YOUR_PROJECT_ID'

// Create the wagmi config
export const config = createConfig({
  chains: [mainnet, goerli, l1xMainnet, l1xTestnet],
  transports: {
    [mainnet.id]: http(),
    [goerli.id]: http(),
    [l1xMainnet.id]: http(),
    [l1xTestnet.id]: http(),
  },
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
})

// Export chains for convenience
export const chains = {
  ETHEREUM_MAINNET: mainnet.id,
  ETHEREUM_GOERLI: goerli.id,
  L1X_MAINNET: l1xMainnet.id,
  L1X_TESTNET: l1xTestnet.id
}

// Helper function to get chain name from ID
export function getChainName(chainId: number): string {
  switch (chainId) {
    case mainnet.id:
      return 'Ethereum Mainnet'
    case goerli.id:
      return 'Ethereum Goerli'
    case l1xMainnet.id:
      return 'L1X Mainnet'
    case l1xTestnet.id:
      return 'L1X Testnet'
    default:
      return 'Unknown Chain'
  }
}