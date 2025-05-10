import { DollarSign, ChevronUp, ChevronDown } from 'lucide-react';
import { usePortfolio } from '@/lib/portfolioContext';
import { formatPrice } from '@/lib/usePriceDetails';

export function PortfolioBalance() {
  const { portfolioValue, percentChange, isLoading } = usePortfolio();

  // For now, use mock data for 7d and 30d changes
  // In a real application, we would fetch historical data for these time periods
  const sevenDayChange = 12.8;
  const thirtyDayChange = -2.4;

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <div className="flex items-center gap-2 mb-2 sm:mb-0">
            <DollarSign className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Portfolio Balance</h3>
              <div className="h-6 w-32 bg-muted/50 rounded animate-pulse"></div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">24h Change</h3>
              <div className="h-6 w-16 bg-muted/50 rounded animate-pulse"></div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">7d Change</h3>
              <div className="h-6 w-16 bg-muted/50 rounded animate-pulse"></div>
            </div>
            
            <div className="hidden md:block">
              <h3 className="text-sm font-medium text-muted-foreground">30d Change</h3>
              <div className="h-6 w-16 bg-muted/50 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-2 mb-2 sm:mb-0">
          <DollarSign className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Portfolio Balance</h3>
            <p className="text-2xl font-bold">{formatPrice(portfolioValue)}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">24h Change</h3>
            <p className={`flex items-center text-lg font-medium ${percentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {percentChange >= 0 ? (
                <ChevronUp className="h-4 w-4 mr-1" />
              ) : (
                <ChevronDown className="h-4 w-4 mr-1" />
              )}
              {Math.abs(percentChange).toFixed(1)}%
            </p>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">7d Change</h3>
            <p className="flex items-center text-lg font-medium text-green-600">
              <ChevronUp className="h-4 w-4 mr-1" />
              {sevenDayChange.toFixed(1)}%
            </p>
          </div>
          
          <div className="hidden md:block">
            <h3 className="text-sm font-medium text-muted-foreground">30d Change</h3>
            <p className="flex items-center text-lg font-medium text-red-600">
              <ChevronDown className="h-4 w-4 mr-1" />
              {Math.abs(thirtyDayChange).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}