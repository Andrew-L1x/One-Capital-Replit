import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent,
} from "@/components/ui/card";
import { usePortfolio } from "@/lib/portfolioContext";
import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";

// Helper function to format currency
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

export function PortfolioBalance() {
  const { portfolioValue, percentChange, isLoading } = usePortfolio();
  const [priceClass, setPriceClass] = useState("text-green-600");
  
  // Calculate which color to use based on percentChange
  useEffect(() => {
    if (percentChange >= 0) {
      setPriceClass("text-green-600");
    } else {
      setPriceClass("text-red-600");
    }
  }, [percentChange]);
  
  if (isLoading) {
    return (
      <Card className="relative mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="animate-pulse bg-muted h-8 w-40 rounded"></div>
            <div className="animate-pulse bg-muted h-8 w-24 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="relative mb-4 border-t-4 border-primary">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Total Portfolio Value</div>
            <div className="text-2xl font-bold">{formatCurrency(portfolioValue)}</div>
          </div>
          
          <div className="flex items-center">
            <div className={`flex items-center ${priceClass}`}>
              {percentChange >= 0 ? (
                <ArrowUpRight className="h-5 w-5 mr-1" />
              ) : (
                <ArrowDownRight className="h-5 w-5 mr-1" />
              )}
              <span className="text-lg font-semibold">
                {percentChange >= 0 ? "+" : ""}{percentChange.toFixed(2)}%
              </span>
            </div>
            <div className="text-xs ml-2 text-muted-foreground">
              24h
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}