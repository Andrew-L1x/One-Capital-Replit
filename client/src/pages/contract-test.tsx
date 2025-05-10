import React from 'react';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ContractTester from "@/components/contracts/ContractTester";
import ContractDeployer from "@/components/contracts/ContractDeployer";
import DashboardHeader from "@/components/dashboard/dashboard-header";

/**
 * Contract testing page for testing and deploying contracts
 */
export default function ContractTestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Helmet>
        <title>Contract Testing | One Capital</title>
        <meta name="description" content="Test and deploy One Capital smart contracts" />
      </Helmet>

      <DashboardHeader />

      <div className="container mx-auto px-4 py-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Contract Testing</h1>
          <p className="text-muted-foreground">
            This page allows you to test contract functions and deploy or update contract addresses.
          </p>

          <Card>
            <CardHeader>
              <CardTitle>Smart Contract Testing</CardTitle>
              <CardDescription>
                Test and interact with One Capital contracts directly from this interface
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="tester">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="tester">Function Tester</TabsTrigger>
                  <TabsTrigger value="deployer">Contract Deployer</TabsTrigger>
                </TabsList>
                <TabsContent value="tester" className="mt-6">
                  <ContractTester />
                </TabsContent>
                <TabsContent value="deployer" className="mt-6">
                  <ContractDeployer />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contract Documentation</CardTitle>
              <CardDescription>
                Reference documentation for One Capital smart contracts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium">Vault Contract</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    The Vault contract manages asset allocations, rebalancing, and take profit strategies.
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-muted p-2 rounded">
                      <strong>createVault</strong>: Creates a new investment vault
                    </div>
                    <div className="bg-muted p-2 rounded">
                      <strong>getVault</strong>: Gets vault configuration
                    </div>
                    <div className="bg-muted p-2 rounded">
                      <strong>setAllocation</strong>: Sets target allocation for an asset
                    </div>
                    <div className="bg-muted p-2 rounded">
                      <strong>getAllocations</strong>: Gets all vault allocations
                    </div>
                    <div className="bg-muted p-2 rounded">
                      <strong>rebalance</strong>: Manually rebalances all assets
                    </div>
                    <div className="bg-muted p-2 rounded">
                      <strong>needsRebalancing</strong>: Checks if rebalancing is needed
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium">Bridge Contract</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    The Bridge contract handles cross-chain asset swaps and transfers.
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-muted p-2 rounded">
                      <strong>getSwapQuote</strong>: Gets a quote for asset swaps
                    </div>
                    <div className="bg-muted p-2 rounded">
                      <strong>initiateSwap</strong>: Initiates a cross-chain swap
                    </div>
                    <div className="bg-muted p-2 rounded">
                      <strong>getSupportedChains</strong>: Gets supported blockchains
                    </div>
                    <div className="bg-muted p-2 rounded">
                      <strong>getSupportedAssets</strong>: Gets supported assets for a chain
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium">Price Oracle Contract</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    The Price Oracle contract provides decentralized price feeds.
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-muted p-2 rounded">
                      <strong>getPrice</strong>: Gets the latest price for an asset
                    </div>
                    <div className="bg-muted p-2 rounded">
                      <strong>getPrices</strong>: Gets prices for multiple assets
                    </div>
                    <div className="bg-muted p-2 rounded">
                      <strong>getTWAP</strong>: Gets time-weighted average price
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}