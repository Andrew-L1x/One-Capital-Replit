import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';
import { useWallet } from '@/lib/walletContext';
import { formatPrice } from '@/lib/usePriceDetails';
import { usePortfolio } from '@/lib/portfolioContext';

export function PortfolioValue() {
  const { isConnected } = useWallet();
  const { portfolioValue, percentChange, isLoading } = usePortfolio();
  
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
                {formatPrice(portfolioValue)}
              </h2>
              <Badge 
                variant={percentChange >= 0 ? "default" : "destructive"}
                className="ml-3 text-xs px-2 py-1"
              >
                {percentChange >= 0 ? (
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 mr-1" />
                )}
                {Math.abs(percentChange).toFixed(2)}%
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