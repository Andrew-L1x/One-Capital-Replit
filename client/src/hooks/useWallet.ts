import { useWallet as useWalletContext } from '../lib/walletContext';
import { ChainId } from '../lib/web3';

export function useWallet() {
  const wallet = useWalletContext();

  const switchToL1XTestnet = async () => {
    try {
      await wallet.switchChain(ChainId.L1X_TESTNET);
    } catch (error) {
      console.error('Error switching to L1X Testnet:', error);
      throw error;
    }
  };

  const switchToL1XMainnet = async () => {
    try {
      await wallet.switchChain(ChainId.L1X_MAINNET);
    } catch (error) {
      console.error('Error switching to L1X Mainnet:', error);
      throw error;
    }
  };

  const switchToEthereumMainnet = async () => {
    try {
      await wallet.switchChain(ChainId.ETHEREUM_MAINNET);
    } catch (error) {
      console.error('Error switching to Ethereum Mainnet:', error);
      throw error;
    }
  };

  const switchToEthereumTestnet = async () => {
    try {
      await wallet.switchChain(ChainId.ETHEREUM_GOERLI);
    } catch (error) {
      console.error('Error switching to Ethereum Testnet:', error);
      throw error;
    }
  };

  return {
    ...wallet,
    switchToL1XTestnet,
    switchToL1XMainnet,
    switchToEthereumMainnet,
    switchToEthereumTestnet,
  };
} 