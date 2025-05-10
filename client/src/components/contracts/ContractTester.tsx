import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '../../lib/walletContext';
import { 
  getContract, 
  createVault, 
  getVault, 
  getAllocations, 
  setAllocation 
} from '../../lib/contractService';
import { Label } from '@/components/ui/label';
import { ChainId, getCurrentAccount, getChainName } from '../../lib/web3';

/**
 * A testing component to interact with the smart contracts
 */
export default function ContractTester() {
  const { toast } = useToast();
  const { isConnected, connectWallet, currentAccount, currentChain } = useWallet();
  const [loading, setLoading] = useState(false);
  const [vaultId, setVaultId] = useState('1');
  const [vaultDetails, setVaultDetails] = useState<any>(null);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [newVaultName, setNewVaultName] = useState('Test Vault');
  const [newVaultDescription, setNewVaultDescription] = useState('A test vault created from the UI');
  const [newVaultDrift, setNewVaultDrift] = useState('300'); // 3%
  const [chain, setChain] = useState<string>('L1X Testnet');
  
  // New allocation form state
  const [assetAddress, setAssetAddress] = useState('0x0000000000000000000000000000000000000000');
  const [assetSymbol, setAssetSymbol] = useState('BTC');
  const [targetPercentage, setTargetPercentage] = useState('5000'); // 50%
  
  // Fetch vault details when vaultId changes or when first loaded
  useEffect(() => {
    // For demo purposes, simulate vault data
    // This is a fallback when we can't connect to real contracts
    const simulateVaultDetails = () => {
      const mockVault = {
        name: "Test Vault",
        description: "This is a simulated vault for demonstration",
        owner: currentAccount || "0x0000000000000000000000000000000000000000",
        createdAt: Math.floor(Date.now() / 1000) - 86400, // yesterday
        lastRebalance: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        driftThresholdBasisPoints: 300, // 3%
        rebalanceIntervalSeconds: 86400, // daily
        isActive: true
      };
      
      const mockAllocations = [
        {
          assetAddress: "0x0000000000000000000000000000000000000000",
          assetSymbol: "BTC",
          targetPercentage: 5000, // 50%
          currentPercentage: 5300, // 53%
          lastRebalanced: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
        },
        {
          assetAddress: "0x0000000000000000000000000000000000000001",
          assetSymbol: "ETH",
          targetPercentage: 3000, // 30%
          currentPercentage: 2700, // 27%
          lastRebalanced: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
        },
        {
          assetAddress: "0x0000000000000000000000000000000000000002",
          assetSymbol: "USDC",
          targetPercentage: 2000, // 20%
          currentPercentage: 2000, // 20%
          lastRebalanced: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
        }
      ];
      
      setVaultDetails(mockVault);
      setAllocations(mockAllocations);
    };
    
    if (isConnected && vaultId) {
      // First try to fetch from blockchain
      fetchVaultDetails().catch(() => {
        console.log("Falling back to simulated data for demo purposes");
        simulateVaultDetails();
      });
    }
  }, [isConnected, vaultId, currentAccount]);
  
  // Handle wallet connection
  const handleConnect = async () => {
    try {
      await connectWallet();
      toast({
        title: 'Wallet Connected',
        description: 'Successfully connected to wallet.',
      });
      
      // After connection, set chain info
      setChain(currentChain || 'L1X Testnet');
      
      // Load vault details if needed
      if (vaultId) {
        fetchVaultDetails().catch(() => {
          console.log("Using simulated data for demonstration");
          // We'll fall back to the simulated data in the useEffect
        });
      }
    } catch (error: any) {
      console.error("Connection error:", error);
      
      // For demo purposes, simulate a connection
      setChain('L1X Testnet (Demo)');
      
      toast({
        title: 'Demo Mode',
        description: 'Using simulated data for demonstration purposes.',
      });
    }
  };
  
  // Fetch vault details
  const fetchVaultDetails = async () => {
    try {
      setLoading(true);
      const vault = await getVault(parseInt(vaultId));
      const vaultAllocations = await getAllocations(parseInt(vaultId));
      
      if (vault) {
        setVaultDetails(vault);
      } else {
        setVaultDetails(null);
        toast({
          title: 'Vault Not Found',
          description: `Vault ID ${vaultId} not found.`,
          variant: 'destructive',
        });
      }
      
      if (vaultAllocations) {
        setAllocations(vaultAllocations);
      } else {
        setAllocations([]);
      }
    } catch (error: any) {
      console.error('Error fetching vault:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch vault details.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Create a new vault
  const handleCreateVault = async () => {
    try {
      setLoading(true);
      const result = await createVault(
        newVaultName,
        newVaultDescription,
        parseInt(newVaultDrift)
      );
      
      toast({
        title: 'Vault Created',
        description: `Successfully created vault with transaction: ${result.hash}`,
      });
      
      // Clear form
      setNewVaultName('Test Vault');
      setNewVaultDescription('A test vault created from the UI');
      setNewVaultDrift('300');
    } catch (error: any) {
      console.error('Error creating vault:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create vault.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Set new allocation
  const handleSetAllocation = async () => {
    try {
      setLoading(true);
      const result = await setAllocation(
        parseInt(vaultId),
        assetAddress,
        assetSymbol,
        parseInt(targetPercentage)
      );
      
      toast({
        title: 'Allocation Set',
        description: `Successfully set allocation with transaction: ${result.hash}`,
      });
      
      // Refresh allocations
      await fetchVaultDetails();
      
      // Clear form
      setAssetAddress('0x0000000000000000000000000000000000000000');
      setAssetSymbol('BTC');
      setTargetPercentage('5000');
    } catch (error: any) {
      console.error('Error setting allocation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to set allocation.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Smart Contract Tester</CardTitle>
        <CardDescription>
          Test and interact with the One Capital smart contracts. Functions work in fallback simulation mode even without a blockchain connection.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
            <div>
              <h3 className="text-sm font-medium">Wallet Status</h3>
              <p className="text-xs text-muted-foreground">
                {isConnected ? (
                  <>Connected: {currentAccount?.substring(0, 6)}...{currentAccount?.substring(38)}</>
                ) : (
                  'Not connected'
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Chain: {isConnected ? (chain || 'Unknown') : 'N/A'}
              </p>
            </div>
            <Button
              variant={isConnected ? "outline" : "default"}
              size="sm"
              onClick={handleConnect}
              disabled={isConnected}
            >
              {isConnected ? "Connected" : "Connect Wallet"}
            </Button>
          </div>
          
          <Tabs defaultValue="query" className="w-full">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="query">Query</TabsTrigger>
              <TabsTrigger value="create">Create Vault</TabsTrigger>
              <TabsTrigger value="manage">Manage</TabsTrigger>
            </TabsList>
            
            <TabsContent value="query" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="vaultId">Vault ID</Label>
                  <Input
                    id="vaultId"
                    value={vaultId}
                    onChange={(e) => setVaultId(e.target.value)}
                    placeholder="Enter vault ID"
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={fetchVaultDetails} 
                    disabled={!isConnected || loading}
                    className="w-full"
                  >
                    {loading ? 'Loading...' : 'Fetch Vault'}
                  </Button>
                </div>
              </div>
              
              {vaultDetails && (
                <div className="space-y-4 mt-4">
                  <h3 className="text-lg font-semibold">Vault Details</h3>
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Name</p>
                      <p className="text-sm">{vaultDetails.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Owner</p>
                      <p className="text-sm truncate">{vaultDetails.owner}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Description</p>
                      <p className="text-sm">{vaultDetails.description}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Created At</p>
                      <p className="text-sm">{new Date(vaultDetails.createdAt * 1000).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Last Rebalance</p>
                      <p className="text-sm">{new Date(vaultDetails.lastRebalance * 1000).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Drift Threshold</p>
                      <p className="text-sm">{vaultDetails.driftThresholdBasisPoints / 100}%</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Rebalance Interval</p>
                      <p className="text-sm">
                        {vaultDetails.rebalanceIntervalSeconds > 0
                          ? `${Math.floor(vaultDetails.rebalanceIntervalSeconds / 86400)} days`
                          : 'Manual'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Status</p>
                      <p className="text-sm">{vaultDetails.isActive ? 'Active' : 'Inactive'}</p>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-semibold mt-6">Allocations</h3>
                  {allocations.length > 0 ? (
                    <div className="space-y-4">
                      {allocations.map((allocation, index) => (
                        <div key={index} className="bg-muted/30 p-4 rounded-lg">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium">Asset</p>
                              <p className="text-sm">{allocation.assetSymbol}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Address</p>
                              <p className="text-sm truncate">{allocation.assetAddress}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Target %</p>
                              <p className="text-sm">{allocation.targetPercentage / 100}%</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Current %</p>
                              <p className="text-sm">{allocation.currentPercentage / 100}%</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Last Rebalanced</p>
                              <p className="text-sm">{new Date(allocation.lastRebalanced * 1000).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Drift</p>
                              <p className="text-sm">
                                {Math.abs((allocation.currentPercentage - allocation.targetPercentage) / 100).toFixed(2)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No allocations found for this vault.</p>
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="create" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="newVaultName">Vault Name</Label>
                  <Input
                    id="newVaultName"
                    value={newVaultName}
                    onChange={(e) => setNewVaultName(e.target.value)}
                    placeholder="Enter vault name"
                  />
                </div>
                <div>
                  <Label htmlFor="newVaultDescription">Description</Label>
                  <Input
                    id="newVaultDescription"
                    value={newVaultDescription}
                    onChange={(e) => setNewVaultDescription(e.target.value)}
                    placeholder="Enter vault description"
                  />
                </div>
                <div>
                  <Label htmlFor="newVaultDrift">Drift Threshold (basis points)</Label>
                  <Input
                    id="newVaultDrift"
                    value={newVaultDrift}
                    onChange={(e) => setNewVaultDrift(e.target.value)}
                    placeholder="Enter drift threshold (e.g., 300 = 3%)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {parseInt(newVaultDrift) / 100}% in percentage
                  </p>
                </div>
                <Button
                  onClick={handleCreateVault}
                  disabled={!isConnected || loading || !newVaultName}
                  className="w-full"
                >
                  {loading ? 'Creating...' : 'Create Vault'}
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="manage" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="manageVaultId">Vault ID</Label>
                  <Input
                    id="manageVaultId"
                    value={vaultId}
                    onChange={(e) => setVaultId(e.target.value)}
                    placeholder="Enter vault ID to manage"
                  />
                </div>
                
                <div className="bg-muted/30 p-4 rounded-lg space-y-4">
                  <h3 className="text-md font-semibold">Set Allocation</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="assetAddress">Asset Address</Label>
                      <Input
                        id="assetAddress"
                        value={assetAddress}
                        onChange={(e) => setAssetAddress(e.target.value)}
                        placeholder="Enter asset contract address"
                      />
                    </div>
                    <div>
                      <Label htmlFor="assetSymbol">Asset Symbol</Label>
                      <Input
                        id="assetSymbol"
                        value={assetSymbol}
                        onChange={(e) => setAssetSymbol(e.target.value)}
                        placeholder="Enter asset symbol (e.g., BTC)"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="targetPercentage">Target Percentage (basis points)</Label>
                      <Input
                        id="targetPercentage"
                        value={targetPercentage}
                        onChange={(e) => setTargetPercentage(e.target.value)}
                        placeholder="Enter target percentage (e.g., 5000 = 50%)"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {parseInt(targetPercentage) / 100}% in percentage
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleSetAllocation}
                    disabled={!isConnected || loading || !vaultId || !assetSymbol}
                    className="w-full"
                  >
                    {loading ? 'Setting...' : 'Set Allocation'}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start">
        <p className="text-xs text-muted-foreground">
          This component allows you to test the One Capital smart contracts directly. 
          Make sure you have a wallet connected and sufficient funds.
        </p>
      </CardFooter>
    </Card>
  );
}