import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchVaultValue, formatUSD, formatPercentChange } from '@/lib/priceService';
import { ArrowDown, ArrowUp, ArrowRight, TrendingUp } from 'lucide-react';

interface PortfolioValueProps {
  vaultId: number;
  refreshInterval?: number; // in ms, defaults to 60 seconds
}

export function PortfolioValue({ vaultId, refreshInterval = 60000 }: PortfolioValueProps) {
  const [loading, setLoading] = useState(true);
  const [vaultValue, setVaultValue] = useState<number | null>(null);
  const [assetValues, setAssetValues] = useState<any[]>([]);
  const [percentChange24h, setPercentChange24h] = useState<number>(0);
  const [percentChange7d, setPercentChange7d] = useState<number>(2.5); // Mock 7-day change, this would be calculated from historical data
  
  // Fetch vault value data
  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await fetchVaultValue(vaultId);
      
      if (data) {
        setVaultValue(data.vaultValue);
        setAssetValues(data.assetValues);
        
        // Mock 24h change - in a real app, this would come from historical data
        // Random number between -5 and +5 for demo purposes
        const mockChange = (Math.random() * 10) - 5;
        setPercentChange24h(mockChange);
      }
    } catch (error) {
      console.error('Error fetching portfolio value:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchData();
    
    // Setup refresh interval
    const intervalId = setInterval(fetchData, refreshInterval);
    
    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, [vaultId, refreshInterval]);
  
  // Determine arrow icon for price change
  const renderChangeIcon = (change: number) => {
    if (change > 0) {
      return <ArrowUp className="h-4 w-4 text-green-500" />;
    } else if (change < 0) {
      return <ArrowDown className="h-4 w-4 text-red-500" />;
    } else {
      return <ArrowRight className="h-4 w-4 text-gray-500" />;
    }
  };
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">Portfolio Balance</CardTitle>
        <CardDescription>Real-time value of your portfolio</CardDescription>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <div className="pt-4">
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-3xl font-bold">
                {vaultValue !== null ? formatUSD(vaultValue) : '$0.00'}
              </div>
              
              <div className="mt-1 flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  {renderChangeIcon(percentChange24h)}
                  <span className={`text-sm ${percentChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentChange(percentChange24h)}
                  </span>
                  <span className="text-xs text-muted-foreground">(24h)</span>
                </div>
                
                <div className="flex items-center space-x-1">
                  {renderChangeIcon(percentChange7d)}
                  <span className={`text-sm ${percentChange7d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentChange(percentChange7d)}
                  </span>
                  <span className="text-xs text-muted-foreground">(7d)</span>
                </div>
              </div>
            </div>
            
            {/* Asset allocation bars */}
            <div className="space-y-2">
              <div className="text-sm font-medium flex items-center">
                <TrendingUp className="h-4 w-4 mr-1 text-muted-foreground" />
                <span>Asset Allocation</span>
              </div>
              
              {assetValues.length > 0 ? (
                assetValues.map((asset) => (
                  <div key={asset.assetId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{asset.symbol}</span>
                      <span>{formatUSD(asset.value)}</span>
                    </div>
                    <Progress 
                      value={(asset.value / (vaultValue || 1)) * 100} 
                      className={`h-2 ${getColorForAsset(asset.symbol)}`}
                    />
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">
                  No assets in this portfolio
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper to get color for specific assets
function getColorForAsset(symbol: string): string {
  const colors: Record<string, string> = {
    'BTC': 'bg-orange-500',
    'ETH': 'bg-purple-500',
    'L1X': 'bg-blue-500',
    'SOL': 'bg-green-500',
    'USDC': 'bg-cyan-500',
    'USDT': 'bg-green-400',
  };
  
  return colors[symbol] || 'bg-gray-500';
}