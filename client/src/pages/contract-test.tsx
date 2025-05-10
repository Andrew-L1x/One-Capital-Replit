import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import ContractTester from '@/components/contracts/ContractTester';
import ContractDeployer from '@/components/contracts/ContractDeployer';
import { useWallet } from '@/lib/walletContext';
import { ChainId, getChainName } from '@/lib/web3';

export default function ContractTest() {
  const { isConnected, walletAddress, currentChain, connectWallet } = useWallet();
  const [activeTab, setActiveTab] = useState('tester');

  return (
    <>
      <Helmet>
        <title>One Capital | Contract Testing</title>
        <meta name="description" content="Test and deploy smart contracts for the One Capital dApp" />
      </Helmet>
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Contract Testing</h1>
          <p className="text-muted-foreground mt-2">
            Test your smart contracts and manage contract deployments for One Capital
          </p>
          
          {isConnected && (
            <div className="mt-4 p-4 bg-muted/30 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Connected Wallet</p>
                  <p className="text-sm text-muted-foreground truncate">{walletAddress}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Network</p>
                  <p className="text-sm text-muted-foreground">{currentChain || 'Unknown'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <Tabs
          defaultValue={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="mb-8 w-full grid grid-cols-2">
            <TabsTrigger value="tester">Contract Tester</TabsTrigger>
            <TabsTrigger value="deployer">Contract Deployer</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tester" className="space-y-8">
            <ContractTester />
          </TabsContent>
          
          <TabsContent value="deployer" className="space-y-8">
            <ContractDeployer />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}