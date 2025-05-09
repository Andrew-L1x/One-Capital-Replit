import { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { connectWallet, getCurrentAccount } from "@/lib/web3";
import {
  getContractAddress,
  setContractAddress,
  isContractAvailable,
  getCounter,
  setCounter,
  incrementCounter
} from "@/lib/contract";

export default function ContractTester() {
  // State variables
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [contractAddress, setContractAddressState] = useState<string>(getContractAddress());
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isContractConnected, setIsContractConnected] = useState<boolean>(false);
  const [counterValue, setCounterValue] = useState<number | null>(null);
  const [newCounterValue, setNewCounterValue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  const { toast } = useToast();
  
  // Check initial wallet connection
  useEffect(() => {
    checkWalletConnection();
    checkContractConnection();
  }, []);
  
  // When contract address changes, check if it's available
  useEffect(() => {
    if (contractAddress) {
      checkContractConnection();
    } else {
      setIsContractConnected(false);
    }
  }, [contractAddress]);
  
  // Check if wallet is connected
  const checkWalletConnection = async () => {
    try {
      const account = await getCurrentAccount();
      setWalletAddress(account);
      setIsConnected(!!account);
    } catch (error) {
      console.error("Error checking wallet connection:", error);
    }
  };
  
  // Check if contract is connected
  const checkContractConnection = async () => {
    try {
      setIsLoading(true);
      const isAvailable = await isContractAvailable();
      setIsContractConnected(isAvailable);
      
      if (isAvailable) {
        const counter = await getCounter();
        setCounterValue(counter);
      }
    } catch (error) {
      console.error("Error checking contract connection:", error);
      setIsContractConnected(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Connect wallet
  const handleConnectWallet = async () => {
    try {
      setIsLoading(true);
      const account = await connectWallet();
      setWalletAddress(account);
      setIsConnected(!!account);
      
      if (account) {
        toast({
          title: "Wallet Connected",
          description: `Connected to ${account.substring(0, 6)}...${account.substring(account.length - 4)}`,
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update contract address
  const handleSetContractAddress = () => {
    setContractAddress(contractAddress);
    checkContractConnection();
    
    toast({
      title: "Contract Address Updated",
      description: `Set to ${contractAddress.substring(0, 10)}...`,
    });
  };
  
  // Increment counter
  const handleIncrementCounter = async () => {
    try {
      setIsLoading(true);
      const tx = await incrementCounter();
      setTxHash(tx);
      
      toast({
        title: "Counter Incremented",
        description: `Transaction: ${tx.substring(0, 10)}...`,
      });
      
      // Refresh counter value
      setTimeout(async () => {
        const counter = await getCounter();
        setCounterValue(counter);
        setIsLoading(false);
      }, 2000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Transaction Failed",
        description: error.message || "Failed to increment counter",
      });
      setIsLoading(false);
    }
  };
  
  // Set counter to specific value
  const handleSetCounter = async () => {
    try {
      setIsLoading(true);
      const tx = await setCounter(newCounterValue);
      setTxHash(tx);
      
      toast({
        title: "Counter Updated",
        description: `Set to ${newCounterValue}. Transaction: ${tx.substring(0, 10)}...`,
      });
      
      // Refresh counter value
      setTimeout(async () => {
        const counter = await getCounter();
        setCounterValue(counter);
        setIsLoading(false);
      }, 2000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Transaction Failed",
        description: error.message || "Failed to update counter",
      });
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>L1X Contract Tester</CardTitle>
        <CardDescription>
          Test interaction with deployed L1X contracts on the testnet
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Wallet Connection Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Wallet Connection</h3>
            <Badge variant={isConnected ? "default" : "outline"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          
          {walletAddress ? (
            <div className="p-2 border rounded-md bg-muted/50">
              <p className="text-sm font-mono">{walletAddress}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No wallet connected</p>
          )}
          
          <Button 
            onClick={handleConnectWallet} 
            disabled={isLoading}
            variant={isConnected ? "outline" : "default"}
          >
            {isConnected ? "Reconnect Wallet" : "Connect Wallet"}
          </Button>
        </div>
        
        <Separator />
        
        {/* Contract Connection Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Contract Connection</h3>
            <Badge variant={isContractConnected ? "default" : "outline"}>
              {isContractConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          
          <div className="flex space-x-2">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="contractAddress">Contract Address</Label>
              <Input
                id="contractAddress"
                placeholder="0x123..."
                value={contractAddress}
                onChange={(e) => setContractAddressState(e.target.value)}
              />
            </div>
            <Button 
              className="mt-8" 
              onClick={handleSetContractAddress}
              disabled={!contractAddress}
            >
              Update
            </Button>
          </div>
        </div>
        
        <Separator />
        
        {/* Contract Interaction Section */}
        {isContractConnected ? (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Contract Interaction</h3>
            
            <div className="p-4 border rounded-md bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="font-medium">Counter Value:</span>
                <span className="text-xl font-bold">{counterValue !== null ? counterValue : "..."}</span>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button 
                onClick={handleIncrementCounter} 
                disabled={isLoading || !isConnected}
                className="flex-1"
              >
                Increment Counter
              </Button>
            </div>
            
            <div className="flex space-x-2">
              <div className="grid flex-1 gap-2">
                <Label htmlFor="newCounter">New Counter Value</Label>
                <Input
                  id="newCounter"
                  type="number"
                  min="0"
                  value={newCounterValue}
                  onChange={(e) => setNewCounterValue(parseInt(e.target.value))}
                />
              </div>
              <Button 
                className="mt-8" 
                onClick={handleSetCounter}
                disabled={isLoading || !isConnected}
              >
                Set Value
              </Button>
            </div>
            
            {txHash && (
              <div className="mt-4 p-2 border rounded-md bg-muted/50">
                <p className="text-sm font-semibold">Last Transaction:</p>
                <p className="text-sm font-mono break-all">{txHash}</p>
              </div>
            )}
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Contract Not Connected</AlertTitle>
            <AlertDescription>
              Please enter a valid contract address deployed to the L1X V2 Testnet.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <p className="text-sm text-muted-foreground">
          Connected to L1X V2 Testnet
        </p>
        <Button variant="outline" onClick={checkContractConnection} disabled={isLoading}>
          Refresh
        </Button>
      </CardFooter>
    </Card>
  );
}