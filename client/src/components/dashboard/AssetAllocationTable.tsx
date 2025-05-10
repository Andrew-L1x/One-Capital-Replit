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
import { formatPrice } from '@/lib/usePriceDetails';
import { usePortfolio } from '@/lib/portfolioContext';

export function AssetAllocationTable() {
  const { isConnected } = useWallet();
  const { portfolioValue, assetAllocations, isLoading } = usePortfolio();
  
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
                <TableCell className="text-right">
                  <Badge variant="outline">
                    {Math.round(allocation.percentOfPortfolio)}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <div className="mt-4 pt-4 border-t flex justify-between items-center">
          <span className="font-semibold">Total Portfolio Value:</span>
          <span className="font-bold text-lg">
            {formatPrice(portfolioValue)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}