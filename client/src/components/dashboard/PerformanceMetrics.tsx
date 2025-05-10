import { useEffect, useState } from "react";
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
import { formatPrice, formatPercentage } from "@/lib/usePriceDetails";
import { usePortfolio } from "@/lib/portfolioContext";

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

interface AssetAllocationDetails {
  id: number;
  symbol: string;
  name: string;
  amount: number;
  price: number;
  value: number;
  percentage: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
}

export function PerformanceMetrics() {
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [assetAllocations, setAssetAllocations] = useState<AssetAllocationDetails[]>([]);
  
  // Get portfolio data from the shared context
  const { 
    portfolioValue, 
    previousValue,
    percentChange,
    assetAllocations: portfolioAllocations,
    priceDetails,
    isLoading: isLoadingPortfolio
  } = usePortfolio();
  
  // Calculate metrics when portfolio data is loaded
  useEffect(() => {
    // Skip calculation if data is not loaded yet
    if (isLoadingPortfolio || !portfolioAllocations.length || Object.keys(priceDetails).length === 0) {
      return;
    }
    
    // Check if we need to update at all based on existing metrics state
    // This helps break the potential infinite loop
    if (metrics && 
        metrics.totalValue === portfolioValue && 
        metrics.changePercentage24h === percentChange &&
        assetAllocations.length === portfolioAllocations.length) {
      // Data hasn't changed, no need to recalculate
      return;
    }
    
    try {
      const assetPerformance: AssetPerformance[] = [];
      const detailedAllocations: AssetAllocationDetails[] = [];
      
      // Process data from portfolio context
      for (const allocation of portfolioAllocations) {
        const asset = allocation.asset;
        if (priceDetails[asset.symbol]) {
          const priceDetail = priceDetails[asset.symbol];
          const currentPrice = priceDetail.current;
          
          // Add to asset performance list
          assetPerformance.push({
            id: asset.id,
            symbol: asset.symbol,
            name: asset.name,
            price: currentPrice,
            priceChange24h: priceDetail.change24h,
            priceChangePercentage24h: priceDetail.changePercentage24h
          });
          
          // Add to detailed allocations
          detailedAllocations.push({
            id: asset.id,
            symbol: asset.symbol,
            name: asset.name,
            amount: allocation.amount,
            price: currentPrice,
            value: allocation.valueUSD,
            percentage: allocation.percentOfPortfolio,
            priceChange24h: priceDetail.change24h,
            priceChangePercentage24h: priceDetail.changePercentage24h
          });
        }
      }
      
      // Only continue if we have data to work with
      if (assetPerformance.length > 0) {
        // Sort assets by performance
        const sortedByPerformance = [...assetPerformance].sort(
          (a, b) => b.priceChangePercentage24h - a.priceChangePercentage24h
        );
        
        // Calculate overall portfolio metrics
        const change24h = portfolioValue - previousValue;
        const uniqueAssets = new Set(assetPerformance.map(a => a.symbol)).size;
        const totalAssets = portfolioAllocations.length;
        
        // Calculate diversity score (higher is better)
        // Formula: 1 - sum of (allocation percentage squared)
        // This is a simplified version of Herfindahl-Hirschman Index (HHI)
        let diversityScore = 0;
        if (portfolioValue > 0 && assetPerformance.length > 1) {
          const allocPercentages = portfolioAllocations.map(allocation => 
            allocation.percentOfPortfolio / 100 // Convert from percentage to decimal
          );
          
          diversityScore = 1 - allocPercentages.reduce((sum, alloc) => sum + (alloc * alloc), 0);
        }
        
        // Update the component state
        setMetrics({
          totalValue: portfolioValue,
          change24h,
          changePercentage24h: percentChange,
          topPerformer: sortedByPerformance[0] || null,
          worstPerformer: sortedByPerformance[sortedByPerformance.length - 1] || null,
          diversityScore,
          diversityPercentage: diversityScore * 100,
          uniqueAssets,
          totalAssets
        });
        
        setAssetAllocations(detailedAllocations);
      }
    } catch (error) {
      console.error("Error calculating performance metrics:", error);
    }
  }, [portfolioValue, previousValue, percentChange, portfolioAllocations, priceDetails, isLoadingPortfolio, metrics, assetAllocations.length]);
  
  // Show loading state if data is not loaded yet
  const isLoading = isLoadingPortfolio || !metrics;

  // If there's no price data available, display a warning
  useEffect(() => {
    if (Object.keys(priceDetails).length === 0) {
      console.log("No price details available yet, metrics may not display properly");
    }
  }, [priceDetails]);
  
  return (
    <div>
      <h3 className="text-lg font-medium mb-4 flex items-center">
        <LineChart className="h-5 w-5 mr-2" />
        Performance Overview
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
      
      {/* Cryptocurrency Allocation Table */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Cryptocurrency Allocation</CardTitle>
          <CardDescription>
            Live allocation data with real-time prices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : assetAllocations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium text-muted-foreground">Asset</th>
                    <th className="py-2 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="py-2 text-right font-medium text-muted-foreground">Price</th>
                    <th className="py-2 text-right font-medium text-muted-foreground">24h Change</th>
                    <th className="py-2 text-right font-medium text-muted-foreground">Allocation %</th>
                  </tr>
                </thead>
                <tbody>
                  {assetAllocations.map((asset) => (
                    <tr key={asset.id} className="border-b border-muted hover:bg-muted/50 transition-colors">
                      <td className="py-2">
                        <div className="flex items-center">
                          <span className="font-semibold">{asset.symbol}</span>
                          <span className="ml-2 text-muted-foreground text-sm">{asset.name}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <span>{asset.amount.toFixed(3)}</span>
                      </td>
                      <td className="py-2 text-right">
                        <span>{formatPrice(asset.price)}</span>
                      </td>
                      <td className="py-2 text-right">
                        <span className={asset.priceChangePercentage24h >= 0 ? 'text-green-500' : 'text-red-500'}>
                          {formatPercentage(asset.priceChangePercentage24h)}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {asset.percentage.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td colSpan={4} className="py-2 font-medium">Total</td>
                    <td className="py-2 text-right font-bold">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No asset allocations found
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-4 text-right">
            Last updated: {new Date().toLocaleTimeString()} • Auto-refreshes every 60 seconds
          </div>
        </CardContent>
      </Card>
    </div>
  );
}