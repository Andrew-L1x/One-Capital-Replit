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
import { formatPrice, formatPercentage } from '@/lib/usePriceDetails';
import { usePortfolio } from '@/lib/portfolioContext';
import { ArrowUpIcon, ArrowDownIcon, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

export function AssetAllocationTable() {
  const { isConnected } = useWallet();
  const { portfolioValue, assetAllocations, priceDetails, isLoading } = usePortfolio();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  // Update the timestamp when price details change
  useEffect(() => {
    if (Object.keys(priceDetails).length > 0) {
      setLastUpdated(new Date());
    }
  }, [priceDetails]);
  
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
        <CardTitle>Cryptocurrency Allocation</CardTitle>
        <CardDescription>
          Live allocation data with real-time prices
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-w-full">
          <Table className="min-w-[300px]">
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">24h</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assetAllocations.map(allocation => {
                const symbol = allocation.asset.symbol;
                const priceChange = priceDetails[symbol]?.changePercentage24h || 0;
                const priceChangeFormatted = formatPercentage(priceChange);
                const isPriceUp = priceChange > 0;
                const isPriceDown = priceChange < 0;
                
                return (
                  <TableRow key={allocation.asset.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="font-semibold">{symbol}</span>
                        <span className="text-xs text-muted-foreground">{allocation.asset.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {allocation.amount.toLocaleString(undefined, { 
                        maximumFractionDigits: 3,
                        minimumFractionDigits: 3 
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`${isPriceUp ? 'text-green-500' : ''} ${isPriceDown ? 'text-red-500' : ''}`}>
                        {isPriceUp && '+'}{priceChangeFormatted}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">
                        {Math.round(allocation.percentOfPortfolio)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        
        <div className="mt-4 pt-4 border-t flex flex-col space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total Portfolio Value:</span>
            <span className="font-bold text-lg">
              {formatPrice(portfolioValue)}
            </span>
          </div>
          
          <div className="flex items-center text-xs text-muted-foreground justify-end">
            <Clock className="h-3 w-3 mr-1" />
            Last updated: {lastUpdated.toLocaleTimeString()} • Auto-refreshes every 60 seconds
          </div>
        </div>
      </CardContent>
    </Card>
  );
}