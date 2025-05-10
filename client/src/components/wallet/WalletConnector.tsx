import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Wallet } from 'lucide-react';
import { apiRequest } from '../../lib/queryClient';
import { Chain, WalletType, ConnectionStatus } from '../../lib/walletTypes';
import useWebSocket from '@/hooks/useWebSocket';

// Types for the wallet connector
type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type WalletInfo = {
  walletType: WalletType;
  address: string;
  chainId: string;
  status: WalletStatus;
  balance?: string;
  lastActive?: string;
  error?: string;
};

interface WalletConnectorProps {
  onConnect?: (walletInfo: WalletInfo) => void;
  onDisconnect?: () => void;
  onTransaction?: (txHash: string) => void;
  defaultWalletType?: WalletType;
}

/**
 * Wallet connector component for L1X blockchain integration
 * 
 * Allows users to connect to their blockchain wallets and execute transactions.
 * Supports L1X and MetaMask/WalletConnect wallets.
 */
export default function WalletConnector({
  onConnect,
  onDisconnect,
  onTransaction,
  defaultWalletType = WalletType.L1X
}: WalletConnectorProps) {
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [status, setStatus] = useState<WalletStatus>('disconnected');
  const [selectedWalletType, setSelectedWalletType] = useState<WalletType>(defaultWalletType);
  const [chainId, setChainId] = useState<string>(Chain.L1X);
  const [error, setError] = useState<string | null>(null);
  const { connected, lastMessage } = useWebSocket(['transactions']);
  
  
  // Handle transaction updates from WebSocket
  useEffect(() => {
    if (lastMessage && 
        lastMessage.type === 'update' && 
        lastMessage.channel === 'transactions' &&
        lastMessage.data?.status === 'confirmed' &&
        onTransaction
       ) {
      onTransaction(lastMessage.data.transactionHash);
    }
  }, [lastMessage, onTransaction]);

  // Connect to wallet
  const connectWallet = useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);
      
      // In a real app, this would interact with the actual wallet SDK
      // For L1X wallet
      if (selectedWalletType === WalletType.L1X) {
        // Check if L1X wallet is available in window object
        if (!window.l1x) {
          // Try to redirect to L1X wallet app store or website
          throw new Error('L1X wallet not found. Please install the L1X wallet extension first.');
        }
        
        try {
          // Request accounts from L1X wallet
          const accounts = await window.l1x.request({ method: 'eth_requestAccounts' });
          if (!accounts || accounts.length === 0) {
            throw new Error('No accounts found in L1X wallet.');
          }
          
          const walletAddress = accounts[0];
          
          // Get balance from L1X wallet
          const balanceHex = await window.l1x.request({ 
            method: 'eth_getBalance', 
            params: [walletAddress, 'latest'] 
          });
          
          // Convert balance from hex and wei to L1X
          const balanceInWei = parseInt(balanceHex, 16);
          const balanceInL1X = balanceInWei / 1e18;
          
          // Connect through our API
          const response = await apiRequest('/api/wallet/connect', {
            method: 'POST',
            data: {
              walletType: selectedWalletType,
              address: walletAddress,
              chainId
            }
          });
          
          if (response.success) {
            const newWalletInfo: WalletInfo = {
              walletType: selectedWalletType,
              address: walletAddress,
              chainId,
              status: 'connected',
              balance: balanceInL1X.toFixed(4)
            };
            
            setWalletInfo(newWalletInfo);
            setStatus('connected');
            
            if (onConnect) {
              onConnect(newWalletInfo);
            }
          } else {
            throw new Error(response.message || 'Failed to connect wallet');
          }
        } catch (error) {
          // If L1X wallet fails, show error
          console.error('Error connecting to L1X wallet:', error);
          throw new Error(error instanceof Error ? error.message : 'Failed to connect to L1X wallet');
        }
      } 
      // For MetaMask
      else if (selectedWalletType === WalletType.METAMASK) {
        // Check if MetaMask is installed
        if (!window.ethereum) {
          throw new Error('MetaMask is not installed. Please install MetaMask first.');
        }
        
        // Request accounts from MetaMask
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts found. Please check your MetaMask connection.');
        }
        
        const walletAddress = accounts[0];
        
        // Get chain info
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        const chainName = parseInt(chainIdHex, 16).toString();
        
        // Get wallet balance
        const balanceHex = await window.ethereum.request({ 
          method: 'eth_getBalance', 
          params: [walletAddress, 'latest'] 
        });
        
        // Convert balance from hex and wei to ETH
        const balanceInWei = parseInt(balanceHex, 16);
        const balanceInEth = balanceInWei / 1e18;
        
        // Connect through our API
        const response = await apiRequest('/api/wallet/connect', {
          method: 'POST',
          data: {
            walletType: selectedWalletType,
            address: walletAddress,
            chainId: chainName
          }
        });
        
        if (response.success) {
          const newWalletInfo: WalletInfo = {
            walletType: selectedWalletType,
            address: walletAddress,
            chainId: chainName,
            status: 'connected',
            balance: balanceInEth.toFixed(4)
          };
          
          setWalletInfo(newWalletInfo);
          setStatus('connected');
          
          if (onConnect) {
            onConnect(newWalletInfo);
          }
        } else {
          throw new Error(response.message || 'Failed to connect wallet');
        }
      }
      // For WalletConnect
      else if (selectedWalletType === WalletType.WALLETCONNECT) {
        throw new Error('WalletConnect integration not implemented yet.');
      }
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error connecting wallet');
    }
  }, [selectedWalletType, chainId, onConnect]);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    setWalletInfo(null);
    setStatus('disconnected');
    
    if (onDisconnect) {
      onDisconnect();
    }
  }, [onDisconnect]);

  // Process a test transaction
  const sendTestTransaction = useCallback(async () => {
    if (!walletInfo || walletInfo.status !== 'connected') {
      setError('Wallet not connected');
      return;
    }

    try {
      setStatus('connecting'); // Show loading state
      
      // Different transaction handling based on wallet type
      if (walletInfo.walletType === WalletType.METAMASK) {
        if (!window.ethereum) {
          throw new Error('MetaMask is not available');
        }
        
        // Prompt user to send a small transaction via MetaMask
        const transactionParameters = {
          to: '0x0000000000000000000000000000000000000001', // Example recipient 
          from: walletInfo.address,
          value: '0x' + (1e14).toString(16), // Small amount in wei (0.0001 ETH)
        };
        
        // Send the transaction using MetaMask
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [transactionParameters],
        });
        
        if (txHash) {
          // Transaction submitted successfully
          setStatus('connected');
          
          if (onTransaction) {
            onTransaction(txHash);
          }
          
          // Also record it through our API
          await apiRequest('/api/wallet/transaction', {
            method: 'POST',
            data: {
              walletAddress: walletInfo.address,
              walletType: walletInfo.walletType,
              chainId: walletInfo.chainId,
              transactionHash: txHash,
            }
          });
          
          // Show success message
          setError(null);
          alert(`Transaction submitted: ${txHash}`);
        } else {
          throw new Error('Transaction was rejected');
        }
      }
      // For L1X wallet
      else if (walletInfo.walletType === WalletType.L1X) {
        if (!window.l1x) {
          throw new Error('L1X wallet is not available');
        }
        
        // Prompt user to send a small transaction via L1X wallet
        const transactionParameters = {
          to: '0x0000000000000000000000000000000000000001', // Example recipient
          from: walletInfo.address,
          value: '0x' + (1e14).toString(16), // Small amount in wei (0.0001 L1X)
        };
        
        // Send the transaction using L1X wallet
        const txHash = await window.l1x.request({
          method: 'eth_sendTransaction',
          params: [transactionParameters],
        });
        
        if (txHash) {
          // Transaction submitted successfully
          setStatus('connected');
          
          if (onTransaction) {
            onTransaction(txHash);
          }
          
          // Also record it through our API
          await apiRequest('/api/wallet/transaction', {
            method: 'POST',
            data: {
              walletAddress: walletInfo.address,
              walletType: walletInfo.walletType,
              chainId: walletInfo.chainId,
              transactionHash: txHash,
            }
          });
          
          // Show success message
          setError(null);
          alert(`Transaction submitted: ${txHash}`);
        } else {
          throw new Error('Transaction was rejected');
        }
      }
      // For other wallet types (fallback)
      else {
        throw new Error('Test transactions not supported for this wallet type');
      }
    } catch (err) {
      console.error('Error sending test transaction:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error sending transaction');
    } finally {
      setStatus('connected'); // Reset status
    }
  }, [walletInfo, onTransaction]);

  // Render wallet connection status badge
  const renderStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <Badge variant="outline" className="ml-2 bg-green-500 text-white"><CheckCircle className="w-3 h-3 mr-1" /> Connected</Badge>;
      case 'connecting':
        return <Badge variant="outline" className="ml-2"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Connecting</Badge>;
      case 'error':
        return <Badge variant="destructive" className="ml-2"><XCircle className="w-3 h-3 mr-1" /> Error</Badge>;
      default:
        return <Badge variant="outline" className="ml-2"><Wallet className="w-3 h-3 mr-1" /> Disconnected</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Wallet Connection</span>
          {renderStatusBadge()}
        </CardTitle>
        <CardDescription>
          Connect your wallet to interact with the L1X blockchain
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error && (
          <div className="p-3 mb-4 text-sm text-red-500 bg-red-50 rounded-md">
            {error}
          </div>
        )}
        
        {walletInfo?.status === 'connected' ? (
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="text-sm font-medium text-gray-500">Wallet Type</div>
              <div>{walletInfo.walletType}</div>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="text-sm font-medium text-gray-500">Address</div>
              <div className="text-sm truncate">{walletInfo.address}</div>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="text-sm font-medium text-gray-500">Network</div>
              <div>{walletInfo.chainId}</div>
            </div>
            
            {walletInfo.balance && (
              <div className="p-3 bg-gray-50 rounded-md">
                <div className="text-sm font-medium text-gray-500">Balance</div>
                <div>{walletInfo.balance}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={selectedWalletType === WalletType.L1X ? "default" : "outline"}
                onClick={() => setSelectedWalletType(WalletType.L1X)}
                className="w-full"
              >
                L1X
              </Button>
              <Button
                variant={selectedWalletType === WalletType.METAMASK ? "default" : "outline"}
                onClick={() => setSelectedWalletType(WalletType.METAMASK)}
                className="w-full"
              >
                MetaMask
              </Button>
              <Button
                variant={selectedWalletType === WalletType.WALLETCONNECT ? "default" : "outline"}
                onClick={() => setSelectedWalletType(WalletType.WALLETCONNECT)}
                className="w-full"
              >
                WalletConnect
              </Button>
            </div>
            
            {selectedWalletType === WalletType.L1X && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Select Network</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={chainId === Chain.L1X ? "default" : "outline"}
                    onClick={() => setChainId(Chain.L1X)}
                    size="sm"
                    className="w-full"
                  >
                    L1X
                  </Button>
                  <Button
                    variant={chainId === Chain.ETHEREUM ? "default" : "outline"}
                    onClick={() => setChainId(Chain.ETHEREUM)}
                    size="sm"
                    className="w-full"
                  >
                    Ethereum
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        {walletInfo?.status === 'connected' ? (
          <>
            <Button 
              variant="outline" 
              onClick={disconnectWallet}
            >
              Disconnect
            </Button>
            <Button 
              onClick={sendTestTransaction}
              disabled={status === 'connecting'}
            >
              {status === 'connecting' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing
                </>
              ) : (
                'Send Test Transaction'
              )}
            </Button>
          </>
        ) : (
          <Button 
            className="w-full" 
            onClick={connectWallet}
            disabled={status === 'connecting'}
          >
            {status === 'connecting' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect Wallet'
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}