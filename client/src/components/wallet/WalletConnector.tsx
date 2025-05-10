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
        // Simulated L1X wallet connection
        const walletAddress = `0x${Math.random().toString(16).substr(2, 40)}`;
        
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
            balance: '10.0' // This would come from the blockchain in a real app
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
      // For MetaMask or WalletConnect
      else if (selectedWalletType === WalletType.METAMASK || selectedWalletType === WalletType.WALLETCONNECT) {
        // In a real app, this would use the window.ethereum provider or WalletConnect
        // For now, we'll simulate a successful connection
        setTimeout(() => {
          const walletAddress = `0x${Math.random().toString(16).substr(2, 40)}`;
          
          const newWalletInfo: WalletInfo = {
            walletType: selectedWalletType,
            address: walletAddress,
            chainId: Chain.ETHEREUM, // For MetaMask, we default to Ethereum
            status: 'connected',
            balance: '1.5' // This would come from the blockchain in a real app
          };
          
          setWalletInfo(newWalletInfo);
          setStatus('connected');
          
          if (onConnect) {
            onConnect(newWalletInfo);
          }
        }, 1000);
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
      
      // Send a test transaction through our API
      const response = await apiRequest('/api/wallet/transaction', {
        method: 'POST',
        data: {
          walletAddress: walletInfo.address,
          walletType: walletInfo.walletType,
          chainId: walletInfo.chainId,
          to: '0x0000000000000000000000000000000000000001', // Example recipient
          value: '0.001', // Small test amount
          data: '0x', // No specific contract interaction
        }
      });
      
      if (response.transactionHash) {
        // Transaction submitted successfully
        setStatus('connected');
        
        if (onTransaction) {
          onTransaction(response.transactionHash);
        }
        
        // Show success message
        setError(null);
        alert(`Transaction submitted: ${response.transactionHash}`);
      } else {
        throw new Error(response.error || 'Failed to send transaction');
      }
    } catch (err) {
      console.error('Error sending test transaction:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error sending transaction');
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