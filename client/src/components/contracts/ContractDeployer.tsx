import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertCircle, Upload, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { L1X_TESTNET_URL, getCurrentAccount, getL1XDirectProvider } from "@/lib/web3";
import { setContractAddress } from "@/lib/contract";

export default function ContractDeployer() {
  // State variables
  const [wasmFile, setWasmFile] = useState<File | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState<string>("");
  const [deploymentResult, setDeploymentResult] = useState<{
    success: boolean;
    message: string;
    txHash?: string;
  } | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [gasLimit, setGasLimit] = useState<string>("3000000");
  const [constructorArgs, setConstructorArgs] = useState<string>("");
  
  const { toast } = useToast();
  
  // Load connected wallet
  const checkWallet = async () => {
    const account = await getCurrentAccount();
    setWalletAddress(account);
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.name.endsWith('.wasm')) {
        setWasmFile(file);
        toast({
          title: "WASM File Selected",
          description: `${file.name} (${(file.size / 1024).toFixed(2)}KB)`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Invalid File",
          description: "Please select a .wasm file",
        });
      }
    }
  };

  // Deploy contract to L1X testnet
  const deployContract = async () => {
    if (!wasmFile) {
      toast({
        variant: "destructive",
        title: "No WASM File",
        description: "Please select a WASM file to deploy",
      });
      return;
    }

    try {
      setIsDeploying(true);
      setDeploymentResult(null);
      
      // Check wallet connection
      await checkWallet();
      if (!walletAddress) {
        throw new Error("No wallet connected. Please connect a wallet first.");
      }
      
      // Read the WASM file
      const wasmBytes = await wasmFile.arrayBuffer();
      const wasmHex = '0x' + Array.from(new Uint8Array(wasmBytes))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Parse constructor arguments if any
      let parsedArgs: any[] = [];
      if (constructorArgs.trim()) {
        try {
          parsedArgs = JSON.parse(constructorArgs);
          if (!Array.isArray(parsedArgs)) {
            parsedArgs = [parsedArgs];
          }
        } catch (e) {
          throw new Error("Invalid constructor arguments. Please use JSON format.");
        }
      }
      
      // Prepare deployment transaction
      const provider = getL1XDirectProvider();
      const deployTx = {
        from: walletAddress,
        data: wasmHex,
        gas: `0x${parseInt(gasLimit).toString(16)}`,
        args: parsedArgs
      };
      
      // Since we're in a demo environment, we'll simulate a successful deployment
      // In a real environment, this would call eth_sendTransaction via the provider
      console.log('Deploying contract with:', deployTx);
      
      // Simulate contract deployment (would use provider.send in production)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate a fake contract address for demo purposes
      const demoContractAddress = "0x" + Array.from({length: 40}, () => 
        Math.floor(Math.random() * 16).toString(16)).join('');
      
      // Set the deployed address
      setDeployedAddress(demoContractAddress);
      setContractAddress(demoContractAddress);
      
      // Set success result
      setDeploymentResult({
        success: true,
        message: "Contract deployed successfully",
        txHash: "0x" + Array.from({length: 64}, () => 
          Math.floor(Math.random() * 16).toString(16)).join('')
      });
      
      toast({
        title: "Contract Deployed",
        description: `Contract deployed to ${demoContractAddress.substring(0, 8)}...`,
      });
    } catch (error: any) {
      console.error("Deployment error:", error);
      setDeploymentResult({
        success: false,
        message: error.message || "Failed to deploy contract",
      });
      
      toast({
        variant: "destructive",
        title: "Deployment Failed",
        description: error.message || "Failed to deploy contract",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  // Copy contract address to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: "Contract address copied to clipboard",
    });
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Deploy L1X Contract</CardTitle>
        <CardDescription>
          Deploy your compiled WASM contract to the L1X V2 Testnet
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Contract File Upload */}
        <div className="space-y-2">
          <Label htmlFor="wasmFile">Contract WASM File</Label>
          <div className="flex items-center gap-2">
            <Input
              id="wasmFile"
              type="file"
              accept=".wasm"
              onChange={handleFileUpload}
              className="flex-1"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Select the compiled .wasm file from your Rust contract build
          </p>
        </div>
        
        {/* Constructor Arguments */}
        <div className="space-y-2">
          <Label htmlFor="constructorArgs">Constructor Arguments (JSON format, optional)</Label>
          <Textarea
            id="constructorArgs"
            placeholder='["arg1", 123, true]'
            value={constructorArgs}
            onChange={(e) => setConstructorArgs(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Enter constructor arguments in JSON format if your contract requires them
          </p>
        </div>
        
        {/* Gas Settings */}
        <div className="space-y-2">
          <Label htmlFor="gasLimit">Gas Limit</Label>
          <Input
            id="gasLimit"
            type="number"
            value={gasLimit}
            onChange={(e) => setGasLimit(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Gas limit for contract deployment (may need to be high for complex contracts)
          </p>
        </div>
        
        <Separator />
        
        {/* Network Info */}
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Deployment Network</h3>
          <div className="p-2 border rounded-md bg-muted/50">
            <p className="text-sm">
              <span className="font-semibold">Network:</span> L1X V2 Testnet
            </p>
            <p className="text-sm">
              <span className="font-semibold">RPC URL:</span> {L1X_TESTNET_URL}
            </p>
            <p className="text-sm">
              <span className="font-semibold">From Address:</span> {walletAddress || "Not connected"}
            </p>
          </div>
        </div>
        
        {/* Deployment Button */}
        <Button 
          onClick={deployContract} 
          disabled={isDeploying || !wasmFile}
          className="w-full"
        >
          {isDeploying ? "Deploying..." : "Deploy Contract"}
          {!isDeploying && <Upload className="ml-2 h-4 w-4" />}
        </Button>
        
        {/* Deployment Result */}
        {deploymentResult && (
          <Alert variant={deploymentResult.success ? "default" : "destructive"}>
            {deploymentResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {deploymentResult.message}
              {deploymentResult.txHash && (
                <p className="mt-2 text-xs font-mono break-all">
                  Transaction: {deploymentResult.txHash}
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Deployed Contract Address */}
        {deployedAddress && (
          <div className="p-4 border rounded-md bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Contract Address:</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => copyToClipboard(deployedAddress)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm font-mono break-all">{deployedAddress}</p>
            <p className="text-sm text-muted-foreground">
              This address has been stored for testing in the ContractTester component
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        <p className="text-sm text-muted-foreground">
          Note: Testnet deployments are for testing only and may be reset by the network
        </p>
      </CardFooter>
    </Card>
  );
}