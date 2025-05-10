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
import { usePrices, formatPrice } from '@/lib/priceService';
import { useQuery } from '@tanstack/react-query';

interface Asset {
  id: number;
  name: string;
  symbol: string;
  type: string;
}

interface Vault {
  id: number;
  name: string;
  userId: number;
  description: string;
  type: string;
  rebalanceThreshold: number;
  rebalanceInterval: string;
}

interface Allocation {
  id: number;
  vaultId: number;
  assetId: number;
  targetPercentage: number;
  amount: number;
}

interface AssetWithAllocation {
  asset: Asset;
  amount: number;
  valueUSD: number;
  percentOfPortfolio: number;
  price: number;
}

export function AssetAllocationTable() {
  const { isConnected } = useWallet();
  const [assetAllocations, setAssetAllocations] = useState<AssetWithAllocation[]>([]);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState<number>(0);
  
  // Fetch the user's assets
  const { data: assets, isLoading: assetsLoading } = useQuery<Asset[]>({
    queryKey: ['/api/assets'],
    enabled: isConnected,
  });
  
  // Fetch the user's vaults
  const { data: vaults, isLoading: vaultsLoading } = useQuery<Vault[]>({
    queryKey: ['/api/vaults'],
    enabled: isConnected,
  });
  
  // Fetch asset allocations for each vault
  const allocationsQueries = (vaults || []).map(vault => {
    return useQuery<Allocation[]>({
      queryKey: [`/api/vaults/${vault.id}/allocations`],
      enabled: isConnected && !!vaults?.length,
    });
  });
  
  // Extract asset symbols for price fetching
  const assetSymbols = assets ? assets.map(asset => asset.symbol) : [];
  
  // Fetch current prices
  const { prices, loading: pricesLoading } = usePrices(assetSymbols, 30000);
  
  // Calculate asset allocations when data changes
  useEffect(() => {
    if (!isConnected || assetsLoading || vaultsLoading || pricesLoading || !assets?.length) {
      return;
    }
    
    // First gather all allocations across vaults
    const assetAmounts: Record<number, number> = {};
    let portfolioTotal = 0;
    
    // Sum up allocations for each asset across all vaults
    (vaults || []).forEach((vault, index) => {
      const allocationsQuery = allocationsQueries[index];
      if (allocationsQuery.data) {
        allocationsQuery.data.forEach(allocation => {
          // Add to the total amount for each asset
          if (!assetAmounts[allocation.assetId]) {
            assetAmounts[allocation.assetId] = 0;
          }
          assetAmounts[allocation.assetId] += allocation.amount;
          
          // Calculate value in USD and add to portfolio total
          const asset = assets.find(a => a.id === allocation.assetId);
          if (asset && prices[asset.symbol]) {
            const assetValue = allocation.amount * prices[asset.symbol];
            portfolioTotal += assetValue;
          }
        });
      }
    });
    
    // Create combined asset allocation objects with values
    const allocationData: AssetWithAllocation[] = [];
    
    Object.entries(assetAmounts).forEach(([assetId, amount]) => {
      const assetIdNum = parseInt(assetId, 10);
      const asset = assets.find(a => a.id === assetIdNum);
      
      if (asset && prices[asset.symbol]) {
        const valueUSD = amount * prices[asset.symbol];
        const percentOfPortfolio = (valueUSD / portfolioTotal) * 100;
        
        allocationData.push({
          asset,
          amount,
          valueUSD,
          percentOfPortfolio,
          price: prices[asset.symbol],
        });
      }
    });
    
    // Sort by value (descending)
    allocationData.sort((a, b) => b.valueUSD - a.valueUSD);
    
    setAssetAllocations(allocationData);
    setTotalPortfolioValue(portfolioTotal);
  }, [
    isConnected,
    assets,
    vaults,
    prices,
    allocationsQueries,
    assetsLoading,
    vaultsLoading,
    pricesLoading,
  ]);
  
  // Determine loading state
  const isLoading = assetsLoading || vaultsLoading || pricesLoading || 
    allocationsQueries.some(query => query.isLoading);
  
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
  if (isLoading) {
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