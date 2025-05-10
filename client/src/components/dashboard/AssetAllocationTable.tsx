import { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWallet } from '@/lib/walletContext';
import { formatPrice, usePriceDetails } from '@/lib/usePriceDetails';

interface AssetWithAllocation {
  asset: {
    id: number;
    name: string;
    symbol: string;
    type: string;
  };
  amount: number;
  valueUSD: number;
  percentOfPortfolio: number;
  price: number;
}

export function AssetAllocationTable() {
  const { isConnected } = useWallet();
  const [assetAllocations, setAssetAllocations] = useState<AssetWithAllocation[]>([]);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch current prices with 24h history
  const { priceDetails, loading: pricesLoading } = usePriceDetails(30000);
  
  // Calculate asset allocations when data changes
  useEffect(() => {
    if (!isConnected || pricesLoading || Object.keys(priceDetails).length === 0) {
      return;
    }
    
    setIsLoading(true);
    
    // Define demo portfolio for our demonstration
    const mockPortfolio = [
      { id: 1, name: "Bitcoin", symbol: "BTC", type: "crypto", amount: 0.5 },
      { id: 2, name: "Ethereum", symbol: "ETH", type: "crypto", amount: 5.0 },
      { id: 3, name: "Layer One X", symbol: "L1X", type: "crypto", amount: 500.0 },
      { id: 4, name: "Solana", symbol: "SOL", type: "crypto", amount: 15.0 },
      { id: 5, name: "USD Coin", symbol: "USDC", type: "stablecoin", amount: 1000.0 }
    ];
    
    // Calculate total portfolio value
    let portfolioTotal = 0;
    mockPortfolio.forEach(asset => {
      if (priceDetails[asset.symbol]) {
        const assetValue = asset.amount * priceDetails[asset.symbol].current;
        portfolioTotal += assetValue;
      }
    });
    
    // Create allocation data objects with values
    const allocationData: AssetWithAllocation[] = [];
    
    mockPortfolio.forEach(asset => {
      if (priceDetails[asset.symbol]) {
        const valueUSD = asset.amount * priceDetails[asset.symbol].current;
        const percentOfPortfolio = portfolioTotal > 0 ? (valueUSD / portfolioTotal) * 100 : 0;
        
        allocationData.push({
          asset: {
            id: asset.id,
            name: asset.name,
            symbol: asset.symbol,
            type: asset.type
          },
          amount: asset.amount,
          valueUSD,
          percentOfPortfolio,
          price: priceDetails[asset.symbol].current,
        });
      }
    });
    
    // Sort by value (descending)
    allocationData.sort((a, b) => b.valueUSD - a.valueUSD);
    
    setAssetAllocations(allocationData);
    setTotalPortfolioValue(portfolioTotal);
    setIsLoading(false);
  }, [isConnected, priceDetails, pricesLoading]);
  
  // Empty state for when wallet is not connected
  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
          <CardDescription>Connect your wallet to view your asset allocations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <p className="text-muted-foreground">No asset data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Loading state
  if (isLoading || pricesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
          <CardDescription>Loading asset data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Empty state when no allocations are found
  if (assetAllocations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
          <CardDescription>No assets in your portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <p className="text-muted-foreground">Create a vault and add assets to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Allocation</CardTitle>
        <CardDescription>
          Current allocation of assets across all vaults
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Token</TableHead>
              <TableHead className="text-right">Price (USD)</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Value (USD)</TableHead>
              <TableHead className="text-right">% of Portfolio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assetAllocations.map(allocation => (
              <TableRow key={allocation.asset.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span>{allocation.asset.name}</span>
                    <span className="text-xs text-muted-foreground">{allocation.asset.symbol}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {formatPrice(allocation.price)}
                </TableCell>
                <TableCell className="text-right">
                  {allocation.amount.toLocaleString(undefined, { 
                    maximumFractionDigits: 8,
                    minimumFractionDigits: 2 
                  })}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatPrice(allocation.valueUSD)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline">
                    {allocation.percentOfPortfolio.toFixed(2)}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <div className="mt-4 pt-4 border-t flex justify-between items-center">
          <span className="font-semibold">Total Portfolio Value:</span>
          <span className="font-bold text-lg">
            {formatPrice(totalPortfolioValue)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}