import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';
import { useWallet } from '@/lib/walletContext';
import { usePrices, formatPrice } from '@/lib/priceService';
import { useQuery } from '@tanstack/react-query';

interface Portfolio {
  totalValue: number;
  previousValue: number;
  percentChange: number;
}

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

export function PortfolioValue() {
  const { isConnected, walletAddress } = useWallet();
  const [portfolio, setPortfolio] = useState<Portfolio>({
    totalValue: 0,
    previousValue: 0,
    percentChange: 0,
  });
  
  // Fetch the user's assets from the API
  const { data: assets, isLoading: assetsLoading } = useQuery<Asset[]>({
    queryKey: ['/api/assets'],
    enabled: isConnected,
  });
  
  // Fetch the user's vaults from the API
  const { data: vaults, isLoading: vaultsLoading } = useQuery<Vault[]>({
    queryKey: ['/api/vaults'],
    enabled: isConnected,
  });
  
  // Fetch asset allocations for each vault
  const allocationsQueries = (vaults || []).map(vault => {
    return useQuery<Allocation[]>({
      queryKey: [`/api/vaults/${vault.id}/allocations`],
      enabled: isConnected && vaults !== undefined,
    });
  });
  
  // Extract asset symbols for price fetching
  const assetSymbols = assets ? assets.map(asset => asset.symbol) : [];
  
  // Fetch current prices for all assets
  const { prices, loading: pricesLoading } = usePrices(assetSymbols, 30000);
  
  // Calculate portfolio value when prices or allocations change
  useEffect(() => {
    if (!isConnected || assetsLoading || pricesLoading || vaultsLoading) return;
    
    let totalValue = 0;
    
    // Calculate total value from allocations in all vaults
    (vaults || []).forEach((vault, index) => {
      const allocationsQuery = allocationsQueries[index];
      if (allocationsQuery.data) {
        allocationsQuery.data.forEach((allocation) => {
          const asset = assets?.find(a => a.id === allocation.assetId);
          if (asset && prices[asset.symbol]) {
            const assetValue = allocation.amount * prices[asset.symbol];
            totalValue += assetValue;
          }
        });
      }
    });
    
    // For demonstration purposes, calculate a previous value 
    // In a real app, we would store historical data
    const previousValue = totalValue * (1 - (Math.random() * 0.1 - 0.05));
    const percentChange = ((totalValue - previousValue) / previousValue) * 100;
    
    setPortfolio({
      totalValue,
      previousValue,
      percentChange,
    });
  }, [
    isConnected, 
    assetsLoading, 
    vaultsLoading, 
    pricesLoading, 
    prices, 
    assets, 
    vaults, 
    allocationsQueries
  ]);
  
  // Show loading state
  const isLoading = assetsLoading || pricesLoading || vaultsLoading || 
    allocationsQueries.some(query => query.isLoading);
  
  // Show empty state if no wallet is connected
  if (!isConnected) {
    return (
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Portfolio Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col">
            <p className="text-sm text-muted-foreground">
              Connect your wallet to view your portfolio value
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">Portfolio Value</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-baseline">
              <h2 className="text-3xl font-bold tracking-tight">
                {formatPrice(portfolio.totalValue)}
              </h2>
              <Badge 
                variant={portfolio.percentChange >= 0 ? "default" : "destructive"}
                className="ml-3 text-xs px-2 py-1"
              >
                {portfolio.percentChange >= 0 ? (
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 mr-1" />
                )}
                {Math.abs(portfolio.percentChange).toFixed(2)}%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              Updated just now
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}