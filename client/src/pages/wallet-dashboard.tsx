import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, BarChart3, Wallet } from 'lucide-react';
import WalletConnector from '@/components/wallet/WalletConnector';
import useWebSocket from '@/hooks/useWebSocket';
import useRealTimePrices from '@/hooks/useRealTimePrices';
import { WalletType, Chain } from '../lib/walletTypes';

/**
 * Wallet dashboard page showing wallet connection, real-time updates,
 * and transaction information.
 * 
 * This page demonstrates:
 * 1. Connecting to L1X wallets
 * 2. Viewing real-time price updates via WebSocket
 * 3. Sending test transactions
 */
export default function WalletDashboard() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState('wallet');
  const { connected: wsConnected, lastMessage, messages } = useWebSocket();
  const { prices, loading: pricesLoading } = useRealTimePrices();

  // Format crypto price with proper decimals and currency symbol
  const formatPrice = (price: number | undefined) => {
    if (price === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  // Format percentage with appropriate sign
  const formatPercentage = (percentage: number | undefined) => {
    if (percentage === undefined) return '0.00%';
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

  // Determine color class based on percentage value
  const getPercentageColorClass = (percentage: number | undefined) => {
    if (percentage === undefined) return 'text-gray-500';
    return percentage >= 0 ? 'text-green-600' : 'text-red-600';
  };

  // Handle wallet connection
  const handleWalletConnect = (walletInfo: any) => {
    console.log('Wallet connected:', walletInfo);
  };

  // Handle wallet disconnection
  const handleWalletDisconnect = () => {
    console.log('Wallet disconnected');
  };

  // Handle transaction events
  const handleTransaction = (txHash: string) => {
    console.log('Transaction submitted:', txHash);
    // Add transaction to the list
    setTransactions(prev => [
      {
        hash: txHash,
        status: 'pending',
        timestamp: new Date().toISOString(),
      },
      ...prev
    ]);
  };

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'update' && lastMessage.channel === 'transactions') {
      // Update transaction status
      if (lastMessage.data?.transactionHash) {
        setTransactions(prev => 
          prev.map(tx => 
            tx.hash === lastMessage.data.transactionHash 
              ? { ...tx, status: lastMessage.data.status } 
              : tx
          )
        );
      }
    }
  }, [lastMessage]);

  return (
    <div className="container max-w-6xl py-8">
      <h1 className="text-3xl font-bold mb-6">Wallet Dashboard</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="wallet">
                <Wallet className="w-4 h-4 mr-2" />
                Wallet
              </TabsTrigger>
              <TabsTrigger value="transactions">
                <BarChart3 className="w-4 h-4 mr-2" />
                Transactions
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="wallet" className="space-y-4">
              <WalletConnector 
                onConnect={handleWalletConnect}
                onDisconnect={handleWalletDisconnect}
                onTransaction={handleTransaction}
                defaultWalletType={WalletType.L1X}
              />
              
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>WebSocket Status</CardTitle>
                  <CardDescription>
                    Real-time updates via WebSocket connection
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center mb-2">
                    <span className="font-medium mr-2">Status:</span>
                    <span className={`text-sm ${wsConnected ? 'text-green-600' : 'text-red-600'}`}>
                      {wsConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="font-medium mb-2">Last Message:</div>
                  {lastMessage ? (
                    <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-32">
                      {JSON.stringify(lastMessage, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-sm text-gray-500">No messages received yet</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="transactions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>
                    History of your blockchain transactions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {transactions.length > 0 ? (
                    <div className="space-y-4">
                      {transactions.map((tx, index) => (
                        <div key={tx.hash} className="border rounded-md p-3">
                          <div className="flex justify-between">
                            <span className="font-medium truncate max-w-[200px]">
                              {tx.hash}
                            </span>
                            <span className={`text-sm font-medium ${
                              tx.status === 'confirmed' ? 'text-green-600' : 
                              tx.status === 'failed' ? 'text-red-600' : 'text-amber-500'
                            }`}>
                              {tx.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {new Date(tx.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No transactions yet. Connect your wallet and send a test transaction.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Live Market Prices</CardTitle>
              <CardDescription>
                Real-time cryptocurrency prices via WebSocket
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pricesLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {prices && Object.entries(prices).map(([symbol, data]) => (
                    <div key={symbol} className="flex justify-between items-center border-b pb-2">
                      <div className="font-medium">{symbol}</div>
                      <div className="flex flex-col items-end">
                        <div className="font-medium">{formatPrice(data.current)}</div>
                        <div className={getPercentageColorClass(data.changePercentage24h)}>
                          {formatPercentage(data.changePercentage24h)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!prices || Object.keys(prices).length === 0) && (
                    <div className="text-center py-4 text-gray-500">
                      No price data available
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Cross-Chain Operations</CardTitle>
                <CardDescription>
                  Manage assets across multiple blockchains
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button className="w-full" disabled={true}>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Swap Assets
                  </Button>
                  <Button className="w-full" variant="outline" disabled={true}>
                    Bridge Assets
                  </Button>
                </div>
                <div className="mt-4 text-sm text-gray-500">
                  Connect your wallet to enable cross-chain operations
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}