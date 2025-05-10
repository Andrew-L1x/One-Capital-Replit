import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';
import { useWallet } from '@/lib/walletContext';
import { usePriceDetails, formatPrice } from '@/lib/usePriceDetails';

interface Portfolio {
  totalValue: number;
  previousValue: number;
  percentChange: number;
}

export function PortfolioValue() {
  const { isConnected } = useWallet();
  const [portfolio, setPortfolio] = useState<Portfolio>({
    totalValue: 0,
    previousValue: 0,
    percentChange: 0,
  });
  
  // Fetch current prices with 24h history
  const { priceDetails, loading: pricesLoading } = usePriceDetails(30000);
  
  // Calculate demo portfolio value when prices change
  useEffect(() => {
    if (!isConnected || pricesLoading || Object.keys(priceDetails).length === 0) {
      return;
    }
    
    // For demo purposes, we'll create a sample portfolio with fixed amounts
    const mockPortfolio = [
      { symbol: 'BTC', amount: 0.5 },
      { symbol: 'ETH', amount: 5.0 },
      { symbol: 'L1X', amount: 500.0 },
      { symbol: 'SOL', amount: 15.0 },
      { symbol: 'USDC', amount: 1000.0 }
    ];
    
    let totalValue = 0;
    
    // Calculate total value based on current prices
    mockPortfolio.forEach(holding => {
      if (priceDetails[holding.symbol]) {
        const assetValue = holding.amount * priceDetails[holding.symbol].current;
        totalValue += assetValue;
      }
    });
    
    // Calculate the change over 24 hours
    let previousValue = 0;
    mockPortfolio.forEach(holding => {
      if (priceDetails[holding.symbol] && priceDetails[holding.symbol].previous24h) {
        const assetPrevValue = holding.amount * priceDetails[holding.symbol].previous24h;
        previousValue += assetPrevValue;
      }
    });
    
    // If we don't have previous values, simulate one
    if (previousValue === 0) {
      previousValue = totalValue * 0.95; // Simulate 5% growth by default
    }
    
    const percentChange = previousValue > 0 ? ((totalValue - previousValue) / previousValue) * 100 : 0;
    
    // Update the portfolio state if there's a change
    if (Math.abs(totalValue - portfolio.totalValue) > 0.01) {
      setPortfolio({
        totalValue,
        previousValue,
        percentChange,
      });
    }
  }, [isConnected, priceDetails, pricesLoading, portfolio.totalValue]);
  
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
        {pricesLoading ? (
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