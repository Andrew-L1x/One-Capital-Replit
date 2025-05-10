import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDown,
  ChevronsUpDown,
  DollarSign,
  LineChart,
  Percent,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, usePriceDetails } from "@/lib/priceService";

interface AssetPerformance {
  id: number;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
}

interface PortfolioMetrics {
  totalValue: number;
  change24h: number;
  changePercentage24h: number;
  topPerformer: AssetPerformance | null;
  worstPerformer: AssetPerformance | null;
  diversityScore: number;
  diversityPercentage: number;
  uniqueAssets: number;
  totalAssets: number;
}

// Format price with $ sign and 2 decimal places
const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
};

// Format percentage with % sign and 2 decimal places
const formatPercentage = (percentage: number): string => {
  return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
};

export function PerformanceMetrics() {
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  
  // Get vault allocations to calculate portfolio values
  const { data: vaults = [], isLoading: isLoadingVaults } = useQuery<any[]>({
    queryKey: ['/api/vaults']
  });
  
  // Get assets to map symbols to names
  const { data: assets = [], isLoading: isLoadingAssets } = useQuery<any[]>({
    queryKey: ['/api/assets']
  });
  
  // Get current prices and price changes
  const { data: pricesData, isLoading: isLoadingPrices } = useQuery<any>({
    queryKey: ['/api/prices'],
    refetchInterval: 60000, // Refresh every 60 seconds
  });

  // Prepare asset allocations for all vaults
  const { data: allocationsData = [], isLoading: isLoadingAllocations } = useQuery<any[]>({
    queryKey: [vaults.length > 0 ? `/api/vaults/${vaults[0]?.id}/allocations` : null],
    enabled: vaults.length > 0
  });
  
  // Calculate metrics when all data is loaded
  useEffect(() => {
    if (
      !isLoadingVaults && 
      !isLoadingAssets && 
      !isLoadingPrices && 
      !isLoadingAllocations && 
      pricesData && 
      allocationsData.length > 0
    ) {
      const assetPerformance: AssetPerformance[] = [];
      let totalValue = 0;
      let previousTotalValue = 0;

      // Calculate current values and 24h changes
      for (const allocation of allocationsData) {
        const asset = assets.find((a: any) => a.id === allocation.assetId);
        if (asset && pricesData[asset.symbol]) {
          const currentPrice = pricesData[asset.symbol];
          // For demo, generate a previous price 
          const previousPrice = currentPrice * (1 + (Math.random() * 0.2 - 0.1)); // ±10% change
          
          const priceChange = currentPrice - previousPrice;
          const priceChangePercentage = (priceChange / previousPrice) * 100;
          
          const value = allocation.amount * currentPrice;
          const previousValue = allocation.amount * previousPrice;
          
          totalValue += value;
          previousTotalValue += previousValue;
          
          assetPerformance.push({
            id: asset.id,
            symbol: asset.symbol,
            name: asset.name,
            price: currentPrice,
            priceChange24h: priceChange,
            priceChangePercentage24h: priceChangePercentage
          });
        }
      }
      
      // Sort assets by performance
      const sortedByPerformance = [...assetPerformance].sort(
        (a, b) => b.priceChangePercentage24h - a.priceChangePercentage24h
      );
      
      // Calculate overall portfolio metrics
      const change24h = totalValue - previousTotalValue;
      const changePercentage24h = ((totalValue - previousTotalValue) / previousTotalValue) * 100;
      const uniqueAssets = new Set(assetPerformance.map(a => a.symbol)).size;
      const totalAssets = allocationsData.length;
      
      // Calculate diversity score (higher is better)
      // Formula: 1 - sum of (allocation percentage squared)
      // This is a simplified version of Herfindahl-Hirschman Index (HHI)
      let diversityScore = 0;
      if (totalValue > 0 && assetPerformance.length > 1) {
        const allocations = allocationsData.map((allocation: any) => {
          const asset = assets.find((a: any) => a.id === allocation.assetId);
          if (asset && pricesData[asset.symbol]) {
            const value = allocation.amount * pricesData[asset.symbol];
            return value / totalValue;
          }
          return 0;
        });
        
        diversityScore = 1 - allocations.reduce((sum, alloc) => sum + (alloc * alloc), 0);
      }
      
      setMetrics({
        totalValue,
        change24h,
        changePercentage24h,
        topPerformer: sortedByPerformance[0] || null,
        worstPerformer: sortedByPerformance[sortedByPerformance.length - 1] || null,
        diversityScore,
        diversityPercentage: diversityScore * 100,
        uniqueAssets,
        totalAssets
      });
    }
  }, [vaults, assets, pricesData, allocationsData, isLoadingVaults, isLoadingAssets, isLoadingPrices, isLoadingAllocations]);
  
  // Show loading state if data is not loaded yet
  const isLoading = isLoadingVaults || isLoadingAssets || isLoadingPrices || isLoadingAllocations || !metrics;
  
  return (
    <div>
      <h3 className="text-lg font-medium mb-4 flex items-center">
        <LineChart className="h-5 w-5 mr-2" />
        Performance Overview
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Portfolio Value */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="flex items-end space-x-1">
                <div className="text-2xl font-bold">{formatPrice(metrics.totalValue)}</div>
                <div className={`text-sm pb-1 ${metrics.changePercentage24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {metrics.changePercentage24h >= 0 ? (
                    <ArrowUpIcon className="inline h-4 w-4 mr-1" />
                  ) : (
                    <ArrowDownIcon className="inline h-4 w-4 mr-1" />
                  )}
                  {formatPercentage(metrics.changePercentage24h)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* 24h Change */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">24h Change</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="flex flex-col">
                <div className={`text-2xl font-bold ${metrics.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPrice(metrics.change24h)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatPercentage(metrics.changePercentage24h)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Top Performing Asset */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Performing Asset</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : metrics.topPerformer ? (
              <div className="flex flex-col">
                <div className="flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1 text-green-500" />
                  <span className="text-lg font-bold">{metrics.topPerformer.symbol}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{metrics.topPerformer.name}</span>
                </div>
                <div className="text-sm text-green-500 mt-1">
                  {formatPercentage(metrics.topPerformer.priceChangePercentage24h)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
        
        {/* Worst Performing Asset */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Worst Performing Asset</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : metrics.worstPerformer ? (
              <div className="flex flex-col">
                <div className="flex items-center">
                  <TrendingDown className="h-4 w-4 mr-1 text-red-500" />
                  <span className="text-lg font-bold">{metrics.worstPerformer.symbol}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{metrics.worstPerformer.name}</span>
                </div>
                <div className="text-sm text-red-500 mt-1">
                  {formatPercentage(metrics.worstPerformer.priceChangePercentage24h)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
        
        {/* Allocation Diversity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Allocation Diversity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="flex flex-col">
                <div className="flex items-center">
                  <ChevronsUpDown className="h-4 w-4 mr-1" />
                  <span className="text-lg font-bold">{metrics.uniqueAssets} assets</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Diversity score: {metrics.diversityPercentage.toFixed(1)}%
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Portfolio Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Health</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="flex flex-col">
                <div className="flex items-center">
                  {metrics.diversityPercentage > 50 ? (
                    <div className="text-lg font-bold text-green-500">Good</div>
                  ) : metrics.diversityPercentage > 30 ? (
                    <div className="text-lg font-bold text-yellow-500">Moderate</div>
                  ) : (
                    <div className="text-lg font-bold text-red-500">Needs Diversification</div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Based on asset allocation and market exposure
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}