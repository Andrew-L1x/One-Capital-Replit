/**
 * Supported wallet types for L1X integration
 */
export enum WalletType {
  L1X = 'l1x',
  METAMASK = 'metamask',
  WALLETCONNECT = 'walletconnect',
  PHANTOM = 'phantom',
  COINBASE = 'coinbase'
}

/**
 * Supported blockchain networks with their chain IDs
 */
export enum Chain {
  L1X = 'l1x', 
  ETHEREUM = '1',
  SOLANA = 'solana',
  POLYGON = '137',
  AVALANCHE = '43114',
  BSC = '56'
}

/**
 * Connection status for wallets
 */
export enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  ERROR = 'error'
}

/**
 * Transaction status
 */
export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed'
}