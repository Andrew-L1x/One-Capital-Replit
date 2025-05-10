import React, { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '../../lib/walletContext';
import { Label } from '@/components/ui/label';
import { 
  ChainId, 
  getChainName 
} from '../../lib/web3';
import { 
  getContractAddresses, 
  setContractAddresses 
} from '../../lib/contractABI';

/**
 * ContractDeployer component for setting contract addresses
 */
export default function ContractDeployer() {
  const { toast } = useToast();
  const { isConnected, connectWallet, currentAccount } = useWallet();
  const [loading, setLoading] = useState(false);
  
  // Contract address form state
  const [chainId, setChainId] = useState<string>(ChainId.L1X_TESTNET.toString());
  const [vaultAddress, setVaultAddress] = useState<string>('');
  const [bridgeAddress, setBridgeAddress] = useState<string>('');
  const [oracleAddress, setOracleAddress] = useState<string>('');
  
  // Handle wallet connection
  const handleConnect = async () => {
    try {
      await connectWallet();
      toast({
        title: 'Wallet Connected',
        description: 'Successfully connected to wallet.',
      });
    } catch (error: any) {
      toast({
        title: 'Connection Error',
        description: error.message || 'Failed to connect wallet.',
        variant: 'destructive',
      });
    }
  };
  
  // Load existing contract addresses
  const loadAddresses = () => {
    try {
      setLoading(true);
      const chainIdNum = parseInt(chainId);
      const addresses = getContractAddresses(chainIdNum);
      
      // Set addresses from storage or use demo values if none exist
      setVaultAddress(addresses.Vault || getDemoContractAddress('Vault', chainIdNum));
      setBridgeAddress(addresses.Bridge || getDemoContractAddress('Bridge', chainIdNum));
      setOracleAddress(addresses.PriceOracle || getDemoContractAddress('PriceOracle', chainIdNum));
      
      toast({
        title: 'Addresses Loaded',
        description: `Loaded contract addresses for ${getChainName(chainIdNum as ChainId)}`,
      });
    } catch (error: any) {
      console.error('Error loading addresses:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load contract addresses.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Get demo contract addresses for development
  const getDemoContractAddress = (contractType: string, chainId: number): string => {
    // Generate different addresses based on contract type and chain ID
    const prefix = '0x';
    const chainPrefix = chainId.toString().padStart(4, '0');
    
    switch (contractType) {
      case 'Vault':
        return `${prefix}1111${chainPrefix}000000000000000000000000000000`;
      case 'Bridge':
        return `${prefix}2222${chainPrefix}000000000000000000000000000000`;
      case 'PriceOracle':
        return `${prefix}3333${chainPrefix}000000000000000000000000000000`;
      default:
        return `${prefix}0000000000000000000000000000000000000000`;
    }
  };
  
  // Save contract addresses
  const saveAddresses = () => {
    try {
      setLoading(true);
      const chainIdNum = parseInt(chainId);
      
      setContractAddresses(chainIdNum, {
        Vault: vaultAddress,
        Bridge: bridgeAddress,
        PriceOracle: oracleAddress,
      });
      
      toast({
        title: 'Addresses Saved',
        description: `Saved contract addresses for ${getChainName(chainIdNum as ChainId)}`,
      });
    } catch (error: any) {
      console.error('Error saving addresses:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save contract addresses.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle chain change
  const handleChainChange = (value: string) => {
    setChainId(value);
    // Load addresses for selected chain
    const chainIdNum = parseInt(value);
    const addresses = getContractAddresses(chainIdNum);
    
    setVaultAddress(addresses.Vault || '');
    setBridgeAddress(addresses.Bridge || '');
    setOracleAddress(addresses.PriceOracle || '');
  };
  
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Contract Deployer</CardTitle>
        <CardDescription>
          Set contract addresses for the One Capital smart contracts
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
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="chainId">Blockchain</Label>
              <Select 
                value={chainId}
                onValueChange={handleChainChange}
              >
                <SelectTrigger id="chainId" className="w-full">
                  <SelectValue placeholder="Select blockchain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ChainId.ETHEREUM_MAINNET.toString()}>Ethereum Mainnet</SelectItem>
                  <SelectItem value={ChainId.ETHEREUM_GOERLI.toString()}>Ethereum Goerli</SelectItem>
                  <SelectItem value={ChainId.L1X_MAINNET.toString()}>L1X Mainnet</SelectItem>
                  <SelectItem value={ChainId.L1X_TESTNET.toString()}>L1X Testnet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="vaultAddress">Vault Contract Address</Label>
              <Input
                id="vaultAddress"
                value={vaultAddress}
                onChange={(e) => setVaultAddress(e.target.value)}
                placeholder="Enter Vault contract address"
              />
            </div>
            
            <div>
              <Label htmlFor="bridgeAddress">Bridge Contract Address</Label>
              <Input
                id="bridgeAddress"
                value={bridgeAddress}
                onChange={(e) => setBridgeAddress(e.target.value)}
                placeholder="Enter Bridge contract address"
              />
            </div>
            
            <div>
              <Label htmlFor="oracleAddress">Price Oracle Contract Address</Label>
              <Input
                id="oracleAddress"
                value={oracleAddress}
                onChange={(e) => setOracleAddress(e.target.value)}
                placeholder="Enter Price Oracle contract address"
              />
            </div>
            
            <div className="flex gap-4 pt-4">
              <Button
                variant="outline"
                onClick={loadAddresses}
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Loading...' : 'Load Saved Addresses'}
              </Button>
              <Button
                onClick={saveAddresses}
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Saving...' : 'Save Addresses'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start">
        <p className="text-xs text-muted-foreground">
          This component allows you to set contract addresses for the One Capital smart contracts.
          These addresses will be used by the contract service when making calls to the blockchain.
        </p>
      </CardFooter>
    </Card>
  );
}