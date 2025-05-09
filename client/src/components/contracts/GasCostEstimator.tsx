import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ethers } from 'ethers';
import { 
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { InfoIcon } from 'lucide-react';

interface GasCostEstimatorProps {
  contractAddress: string;
  provider: ethers.Provider | null;
}

type GasEstimateResult = {
  methodName: string;
  estimatedGas: number;
  gasCostInNative: string;
  gasCostInUSD: string;
  complexity: 'Low' | 'Medium' | 'High';
};

// Common contract methods for L1X vaults
const commonMethods = [
  { name: 'createVault', complexity: 'Medium' as const },
  { name: 'depositToVault', complexity: 'Medium' as const },
  { name: 'withdrawFromVault', complexity: 'Medium' as const },
  { name: 'setAllocation', complexity: 'Medium' as const },
  { name: 'rebalanceVault', complexity: 'High' as const },
  { name: 'getTakeProfitSettings', complexity: 'Low' as const },
  { name: 'setTakeProfitSettings', complexity: 'Medium' as const },
];

export function GasCostEstimator({ contractAddress, provider }: GasCostEstimatorProps) {
  const [gasPrice, setGasPrice] = useState<number | null>(null);
  const [nativePrice, setNativePrice] = useState<number>(100); // Mock L1X price in USD 
  const [estimates, setEstimates] = useState<GasEstimateResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGasPrice = async () => {
    if (!provider) {
      setError('No provider connected. Please connect your wallet first.');
      return;
    }
    
    try {
      const price = await provider.getFeeData();
      // Use gasPrice if available, otherwise fall back to a default value
      setGasPrice(price.gasPrice ? Number(price.gasPrice) : 20e9); // Default to 20 gwei if not available
      setError(null);
    } catch (err) {
      console.error('Error fetching gas price:', err);
      setError('Failed to fetch gas price. Using default values for estimation.');
      // Use a default gas price for L1X (e.g., 20 gwei)
      setGasPrice(20e9);
    }
  };

  const estimateGasCosts = async () => {
    if (!provider || !contractAddress) {
      setError('Please connect your wallet and enter a contract address.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    // If we don't have a gas price yet, fetch it
    if (!gasPrice) {
      await fetchGasPrice();
    }
    
    try {
      // In a real implementation, we would use actual contract ABIs and make test calls
      // Here we're using mock data based on method complexity
      
      const mockResults: GasEstimateResult[] = commonMethods.map(method => {
        // Mock gas estimates based on complexity
        let gasEstimate: number;
        switch (method.complexity) {
          case 'Low':
            gasEstimate = 30000 + Math.floor(Math.random() * 20000);
            break;
          case 'Medium':
            gasEstimate = 70000 + Math.floor(Math.random() * 40000);
            break;
          case 'High':
            gasEstimate = 150000 + Math.floor(Math.random() * 100000);
            break;
        }
        
        // Calculate gas cost in L1X (or whatever native token)
        const gasPriceToUse = gasPrice || 20e9; // fallback to 20 gwei
        const gasCostInWei = gasEstimate * Number(gasPriceToUse);
        const gasCostInNative = ethers.formatEther(gasCostInWei.toString());
        
        // Calculate gas cost in USD
        const gasCostInUSD = (Number(gasCostInNative) * nativePrice).toFixed(2);
        
        return {
          methodName: method.name,
          estimatedGas: gasEstimate,
          gasCostInNative: Number(gasCostInNative).toFixed(6),
          gasCostInUSD,
          complexity: method.complexity
        };
      });
      
      setEstimates(mockResults);
    } catch (err) {
      console.error('Error estimating gas costs:', err);
      setError('Failed to estimate gas costs. Please check the contract address.');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get color based on complexity
  const getComplexityColor = (complexity: 'Low' | 'Medium' | 'High') => {
    switch (complexity) {
      case 'Low':
        return 'text-green-600';
      case 'Medium':
        return 'text-yellow-600';
      case 'High':
        return 'text-red-600';
    }
  };

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center">
          Gas Cost Estimator
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="ml-2 h-4 w-4 text-gray-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Estimates the gas cost for common contract operations.
                  This is a simulation and actual costs may vary.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>
          Estimate gas costs for L1X contract operations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Input
                value={contractAddress || ''}
                disabled
                placeholder="Contract Address"
              />
            </div>
            <div>
              <Input
                type="number"
                value={nativePrice}
                onChange={(e) => setNativePrice(Number(e.target.value))}
                placeholder="L1X Price (USD)"
              />
            </div>
          </div>
          
          <Button 
            onClick={estimateGasCosts}
            disabled={isLoading || !contractAddress || !provider}
            className="w-full"
          >
            {isLoading ? 'Estimating...' : 'Estimate Gas Costs'}
          </Button>
          
          {error && (
            <div className="text-sm text-red-500 mt-2">{error}</div>
          )}
          
          {estimates.length > 0 && (
            <Table>
              <TableCaption>Estimated gas costs for contract operations</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Method</TableHead>
                  <TableHead>Gas Units</TableHead>
                  <TableHead>Cost (L1X)</TableHead>
                  <TableHead>Cost (USD)</TableHead>
                  <TableHead>Complexity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimates.map((estimate) => (
                  <TableRow key={estimate.methodName}>
                    <TableCell className="font-medium">{estimate.methodName}</TableCell>
                    <TableCell>{estimate.estimatedGas.toLocaleString()}</TableCell>
                    <TableCell>{estimate.gasCostInNative}</TableCell>
                    <TableCell>${estimate.gasCostInUSD}</TableCell>
                    <TableCell className={getComplexityColor(estimate.complexity)}>
                      {estimate.complexity}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          <div className="text-xs text-gray-500 mt-2">
            Note: These estimates are approximations based on typical usage patterns.
            Actual gas costs will depend on contract implementation, network conditions, 
            and specific transaction parameters.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}